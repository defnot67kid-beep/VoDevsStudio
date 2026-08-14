import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { TransformControls } from 'three/addons/controls/TransformControls.js';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// =========== PAGE NAVIGATION ===========
const homePage = document.getElementById('homePage');
const editorPage = document.getElementById('editorPage');

function showHome() {
    homePage.style.display = 'flex';
    editorPage.style.display = 'none';
}

function showEditor() {
    homePage.style.display = 'none';
    editorPage.style.display = 'flex';
    setTimeout(() => onWindowResize(), 0);
}

document.getElementById('startTourBtn').addEventListener('click', () => {
    showEditor();
    initEditor();
});

// Any experience card click opens editor
document.querySelectorAll('.experience-card').forEach(card => {
    card.addEventListener('click', () => {
        showEditor();
        initEditor();
    });
});

// =========== THREE.JS SETUP ===========
let scene, camera, renderer, orbitControls, transformControls, currentGroup;
let selectedTransformMode = 0; // 0=move, 1=rotate, 2=scale
let extraInstances = [];
let extraIdCounter = 1;

const INSERTABLE_TYPES = [
    { group: 'Frequently Used', className: 'Part', icon: '📦' },
    { group: 'Frequently Used', className: 'Script', icon: '📄' },
    { group: 'Frequently Used', className: 'Folder', icon: '📁' },
    { group: 'Frequently Used', className: 'Tool', icon: '🛠️' },
    { group: 'Frequently Used', className: 'SpawnLocation', icon: '⚙️' },
    { group: 'Frequently Used', className: 'MeshPart', icon: '🌐' },
    { group: 'Frequently Used', className: 'Model', icon: '🧩' },
    { group: '3D Interfaces', className: 'ClickDetector', icon: '🔵' },
    { group: '3D Interfaces', className: 'Decal', icon: '🖼️' },
    { group: '3D Interfaces', className: 'Dialog', icon: '💬' },
    { group: '3D Interfaces', className: 'DialogChoice', icon: '🗨️' },
    { group: '3D Interfaces', className: 'DragDetector', icon: '🧲' },
    { group: '3D Interfaces', className: 'MaterialVariant', icon: '🎨' },
    { group: '3D Interfaces', className: 'ProximityPrompt', icon: '📋' },
    { group: '3D Interfaces', className: 'SurfaceAppearance', icon: '🔷' },
];

function initEditor() {
    if (scene) return; // Already initialized

    // DOM Elements
    const viewport = document.getElementById('viewport');
    const fileInput = document.getElementById('fileInput');
    const fileName = document.getElementById('fileName');
    const statusEl = document.getElementById('status');
    const toastEl = document.getElementById('toast');
    const toastMessage = document.getElementById('toastMessage');
    const toastIcon = document.getElementById('toastIcon');

    // THREE.JS Setup
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1a1a2e);
    scene.fog = new THREE.Fog(0x1a1a2e, 100, 1000);

    camera = new THREE.PerspectiveCamera(75, viewport.clientWidth / viewport.clientHeight, 0.1, 10000);
    camera.position.set(30, 20, 30);
    camera.lookAt(0, 0, 0);

    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setSize(viewport.clientWidth, viewport.clientHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowShadowMap;
    viewport.appendChild(renderer.domElement);

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);
    const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
    directionalLight.position.set(50, 100, 50);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    directionalLight.shadow.camera.far = 200;
    directionalLight.shadow.camera.left = -100;
    directionalLight.shadow.camera.right = 100;
    directionalLight.shadow.camera.top = 100;
    directionalLight.shadow.camera.bottom = -100;
    scene.add(directionalLight);

    // Grid
    const gridHelper = new THREE.GridHelper(100, 100, 0x444444, 0x222222);
    scene.add(gridHelper);

    // Controls
    orbitControls = new OrbitControls(camera, renderer.domElement);
    orbitControls.autoRotate = false;
    transformControls = new TransformControls(camera, renderer.domElement);
    transformControls.addEventListener('dragging-changed', (e) => orbitControls.enabled = !e.value);
    scene.add(transformControls);

    // Create initial workspace group
    currentGroup = new THREE.Group();
    currentGroup.name = 'Workspace';
    scene.add(currentGroup);

    // Workspace node in explorer
    const workspaceNode = document.getElementById('workspaceNode');
    const workspaceAddBtn = document.getElementById('workspaceAddBtn');
    const workspaceExtrasEl = document.getElementById('workspaceExtras');
    const modelChildren = document.getElementById('modelChildren');
    const insertObjectMenu = document.getElementById('insertObjectMenu');
    const insertObjectSearch = document.getElementById('insertObjectSearch');
    const insertObjectList = document.getElementById('insertObjectList');
    const contextMenuEl = document.getElementById('contextMenu');

    // Helper functions
    function ensurePartDefaults(obj) {
        if (!obj.userData) obj.userData = {};
        if (!obj.userData.className) obj.userData.className = 'Part';
        if (!obj.userData.partName) obj.userData.partName = obj.name || 'Part';
        if (obj.userData.material === undefined) obj.userData.material = 'Plastic';
        if (obj.userData.anchored === undefined) obj.userData.anchored = false;
        if (obj.userData.canCollide === undefined) obj.userData.canCollide = true;
        if (obj.userData.textures === undefined) obj.userData.textures = [];
    }

    function selectObject(obj) {
        if (selectedObj) selectedObj.children.forEach(c => c.visible = true);
        selectedObj = obj;
        transformControls.attach(obj);
        if (obj.isMesh) {
            obj.children.forEach(c => c.visible = false);
            updateProperties(obj);
            updateExplorer();
        }
    }

    function updateExplorer() {
        modelChildren.innerHTML = '';
        currentGroup.children.forEach((obj) => {
            if (obj.isMesh) {
                const li = document.createElement('li');
                li.innerHTML = `<span class="arrow">▼</span><span class="tree-node">${obj.userData.partName || obj.name}</span>`;
                li.onclick = () => selectObject(obj);
                li.oncontextmenu = (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    showContextMenu(e.clientX, e.clientY, buildPartContextMenuItems(obj));
                };
                modelChildren.appendChild(li);
            }
        });
        renderWorkspaceExtras();
    }

    function renderWorkspaceExtras() {
        workspaceExtrasEl.innerHTML = '';
        extraInstances.forEach((inst) => {
            const li = document.createElement('li');
            li.innerHTML = `<span class="tree-node">${inst.icon} ${inst.name}</span>`;
            li.onclick = () => {
                selectObject(null);
                document.querySelectorAll('#workspaceExtras li').forEach(n => n.classList.remove('selected'));
                li.classList.add('selected');
            };
            li.oncontextmenu = (e) => {
                e.preventDefault();
                e.stopPropagation();
                showContextMenu(e.clientX, e.clientY, buildExtraContextMenuItems(inst));
            };
            workspaceExtrasEl.appendChild(li);
        });
    }

    function updateProperties(obj) {
        ensurePartDefaults(obj);
        document.getElementById('propName').value = obj.userData.partName || '';
        document.getElementById('propClass').textContent = obj.userData.className || 'Part';
        document.getElementById('propMaterial').value = obj.userData.material || 'Plastic';
        document.getElementById('propPosX').value = obj.position.x.toFixed(2);
        document.getElementById('propPosY').value = obj.position.y.toFixed(2);
        document.getElementById('propPosZ').value = obj.position.z.toFixed(2);
        const euler = new THREE.Euler().setFromQuaternion(obj.quaternion);
        document.getElementById('propRotX').value = (euler.x * 180 / Math.PI).toFixed(1);
        document.getElementById('propRotY').value = (euler.y * 180 / Math.PI).toFixed(1);
        document.getElementById('propRotZ').value = (euler.z * 180 / Math.PI).toFixed(1);
        if (obj.geometry) {
            obj.geometry.computeBoundingBox();
            const size = new THREE.Vector3();
            obj.geometry.boundingBox.getSize(size);
            document.getElementById('propSizeX').value = (size.x * obj.scale.x).toFixed(2);
            document.getElementById('propSizeY').value = (size.y * obj.scale.y).toFixed(2);
            document.getElementById('propSizeZ').value = (size.z * obj.scale.z).toFixed(2);
        }
        if (obj.material && obj.material.color) {
            document.getElementById('propColor').value = '#' + obj.material.color.getHexString();
        }
        document.getElementById('propAnchored').checked = obj.userData.anchored || false;
        document.getElementById('propCanCollide').checked = obj.userData.canCollide !== false;
    }

    function showToast(msg, type = 'info') {
        toastMessage.textContent = msg;
        toastIcon.textContent = type === 'success' ? '✅' : type === 'error' ? '❌' : 'ℹ️';
        toastEl.classList.add('show');
        setTimeout(() => toastEl.classList.remove('show'), 3000);
    }

    function createNewPart(name = 'Part') {
        const geom = new THREE.BoxGeometry(2, 2, 2);
        const mat = new THREE.MeshStandardMaterial({ color: 0xcccccc });
        const part = new THREE.Mesh(geom, mat);
        part.position.set(0, 5, 0);
        part.castShadow = true;
        part.receiveShadow = true;
        ensurePartDefaults(part);
        part.userData.partName = name;
        currentGroup.add(part);
        updateExplorer();
        selectObject(part);
        showToast(`Created ${name}`, 'success');
    }

    function addInstance(className) {
        if (className === 'Part') {
            closeInsertMenu();
            createNewPart('Part');
            return;
        }
        if (className === 'MeshPart') {
            closeInsertMenu();
            fileInput.click();
            showToast('Choose a glTF/OBJ/rbxlx file to insert as a MeshPart', 'info');
            return;
        }
        const meta = INSERTABLE_TYPES.find(t => t.className === className);
        const inst = {
            id: 'inst_' + (extraIdCounter++),
            className,
            name: className,
            icon: meta ? meta.icon : '🧩',
        };
        extraInstances.push(inst);
        renderWorkspaceExtras();
        closeInsertMenu();
        statusEl.textContent = `➕ Inserted ${className} into Workspace.`;
        showToast(`Inserted ${className}`, 'success');
    }

    function renderInsertMenuList(filter = '') {
        insertObjectList.innerHTML = '';
        const term = filter.trim().toLowerCase();
        let lastGroup = null;
        INSERTABLE_TYPES.filter(t => t.className.toLowerCase().includes(term)).forEach(t => {
            if (t.group !== lastGroup) {
                const label = document.createElement('div');
                label.className = 'floating-menu-group-label';
                label.textContent = t.group;
                insertObjectList.appendChild(label);
                lastGroup = t.group;
            }
            const item = document.createElement('div');
            item.className = 'floating-menu-item';
            item.innerHTML = `<span class="fmi-icon">${t.icon}</span><span>${t.className}</span>`;
            item.onclick = () => addInstance(t.className);
            insertObjectList.appendChild(item);
        });
    }

    function openInsertMenu(x, y) {
        renderInsertMenuList('');
        insertObjectSearch.value = '';
        insertObjectMenu.style.display = 'flex';
        const menuW = 230;
        const left = Math.min(x, window.innerWidth - menuW - 10);
        const top = Math.min(y, window.innerHeight - 360);
        insertObjectMenu.style.left = left + 'px';
        insertObjectMenu.style.top = Math.max(top, 10) + 'px';
        insertObjectSearch.focus();
    }

    function closeInsertMenu() {
        insertObjectMenu.style.display = 'none';
    }

    function showContextMenu(x, y, items) {
        contextMenuEl.innerHTML = '';
        items.forEach((it) => {
            if (it.sep) {
                const li = document.createElement('li');
                li.className = 'context-menu-sep';
                contextMenuEl.appendChild(li);
                return;
            }
            const li = document.createElement('li');
            if (it.danger) li.classList.add('danger');
            li.innerHTML = `<span>${it.icon || ''}</span><span>${it.label}</span>`;
            li.onclick = (e) => { e.stopPropagation(); hideContextMenu(); it.onClick(); };
            contextMenuEl.appendChild(li);
        });
        contextMenuEl.style.display = 'flex';
        const menuW = 200;
        const left = Math.min(x, window.innerWidth - menuW - 10);
        const top = Math.min(y, window.innerHeight - (items.length * 34 + 20));
        contextMenuEl.style.left = Math.max(left, 10) + 'px';
        contextMenuEl.style.top = Math.max(top, 10) + 'px';
    }

    function hideContextMenu() {
        contextMenuEl.style.display = 'none';
    }

    function buildPartContextMenuItems(obj) {
        return [
            { label: 'Rename', icon: '✏️', onClick: () => {
                const newName = prompt('Rename Part:', obj.userData.partName || 'Part');
                if (newName) { obj.userData.partName = newName; updateExplorer(); }
            } },
            { label: 'Duplicate', icon: '📑', onClick: () => {
                const clone = obj.clone();
                clone.geometry = obj.geometry.clone();
                clone.material = obj.material.clone();
                clone.userData = JSON.parse(JSON.stringify(obj.userData));
                clone.position.add(new THREE.Vector3(1, 0, 1));
                currentGroup.add(clone);
                updateExplorer();
                selectObject(clone);
            } },
            { sep: true },
            { label: 'Delete', icon: '🗑️', danger: true, onClick: () => {
                currentGroup.remove(obj);
                updateExplorer();
            } },
        ];
    }

    function buildExtraContextMenuItems(inst) {
        return [
            { label: 'Rename', icon: '✏️', onClick: () => {
                const newName = prompt('Rename ' + inst.className + ':', inst.name);
                if (newName) { inst.name = newName; renderWorkspaceExtras(); }
            } },
            { sep: true },
            { label: 'Delete', icon: '🗑️', danger: true, onClick: () => {
                extraInstances = extraInstances.filter(i => i.id !== inst.id);
                renderWorkspaceExtras();
            } },
        ];
    }

    // Event Listeners
    let selectedObj = null;

    workspaceAddBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const rect = workspaceAddBtn.getBoundingClientRect();
        openInsertMenu(rect.left, rect.bottom + 6);
    });

    insertObjectSearch.addEventListener('input', () => renderInsertMenuList(insertObjectSearch.value));

    workspaceNode.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        e.stopPropagation();
        showContextMenu(e.clientX, e.clientY, [
            { label: 'Insert Object...', icon: '➕', onClick: () => openInsertMenu(e.clientX, e.clientY) },
        ]);
    });

    insertObjectMenu.addEventListener('click', (e) => e.stopPropagation());
    contextMenuEl.addEventListener('click', (e) => e.stopPropagation());
    document.addEventListener('click', () => { hideContextMenu(); closeInsertMenu(); });
    window.addEventListener('blur', () => { hideContextMenu(); closeInsertMenu(); });

    document.getElementById('addPartBtn').addEventListener('click', () => createNewPart('Part'));
    document.getElementById('clearBtn').addEventListener('click', () => {
        currentGroup.children = [];
        extraInstances = [];
        updateExplorer();
        statusEl.textContent = '✨ Cleared.';
        showToast('Cleared all parts', 'success');
    });

    document.getElementById('exportBtn').addEventListener('click', () => {
        if (!currentGroup || currentGroup.children.length === 0) {
            showToast('Nothing to export', 'warn');
            return;
        }
        const parts = currentGroup.children.filter(c => c.isMesh).map((obj) => ({
            name: obj.userData.partName || 'Part',
            position: obj.position.toArray(),
            size: [obj.scale.x * 2, obj.scale.y * 2, obj.scale.z * 2],
        }));
        const json = JSON.stringify({ parts }, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'export.json';
        a.click();
        showToast('Exported successfully', 'success');
    });

    fileInput.addEventListener('change', () => {
        const file = fileInput.files[0];
        if (!file) return;
        fileName.textContent = file.name;
        const reader = new FileReader();
        reader.onload = (e) => {
            const content = e.target.result;
            const loader = file.name.endsWith('.obj') ? new OBJLoader() : new GLTFLoader();
            try {
                const obj = file.name.endsWith('.obj') ? loader.parse(content) : loader.parse(content, '');
                currentGroup.add(obj);
                updateExplorer();
                showToast('Loaded ' + file.name, 'success');
            } catch (err) {
                showToast('Failed to load: ' + err.message, 'error');
            }
        };
        reader.readAsText(file);
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        if (e.key === '1') selectedTransformMode = 0;
        if (e.key === '2') selectedTransformMode = 1;
        if (e.key === '3') selectedTransformMode = 2;
        if (e.key === 'Delete' && selectedObj) {
            currentGroup.remove(selectedObj);
            selectedObj = null;
            transformControls.detach();
            updateExplorer();
        }
        if (e.key === 'f' && selectedObj) {
            camera.position.copy(selectedObj.position).add(new THREE.Vector3(10, 10, 10));
            camera.lookAt(selectedObj.position);
        }
    });

    transformControls.setMode(['translate', 'rotate', 'scale'][selectedTransformMode]);

    // Animation Loop
    function animate() {
        requestAnimationFrame(animate);
        orbitControls.update();
        renderer.render(scene, camera);
    }
    animate();

    function onWindowResize() {
        const viewport = document.getElementById('viewport');
        if (!viewport) return;
        const w = viewport.clientWidth;
        const h = viewport.clientHeight;
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h);
    }

    window.addEventListener('resize', onWindowResize);
    onWindowResize();
}

// Start on home page
showHome();
