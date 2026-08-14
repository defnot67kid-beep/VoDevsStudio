import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { TransformControls } from 'three/addons/controls/TransformControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';

// --- Setup Scene, Camera, Renderer ---
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x1a1b1e);

// The viewport is now a docked pane (not the full window) — size against its
// own container so the canvas fills the space left by the ribbon, toolbox,
// explorer/properties dock, and status bar.
const viewportEl = document.getElementById('viewport');
function viewportSize() {
    return {
        w: viewportEl.clientWidth || window.innerWidth,
        h: viewportEl.clientHeight || window.innerHeight,
    };
}

const camera = new THREE.PerspectiveCamera(45, viewportSize().w / viewportSize().h, 0.1, 1000);
camera.position.set(8, 5, 12);
camera.lookAt(0, 0, 0);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(viewportSize().w, viewportSize().h);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.2;
viewportEl.appendChild(renderer.domElement);

// --- Controls ---
const orbitControls = new OrbitControls(camera, renderer.domElement);
orbitControls.enableDamping = true;
orbitControls.dampingFactor = 0.05;
orbitControls.target.set(0, 0, 0);
orbitControls.maxPolarAngle = Math.PI / 2.2;
orbitControls.minDistance = 3;
orbitControls.maxDistance = 30;

// --- Transform Controls with custom scaling ---
const transformControls = new TransformControls(camera, renderer.domElement);
scene.add(transformControls);
transformControls.addEventListener('dragging-changed', (event) => {
    orbitControls.enabled = !event.value;
});

// --- Custom scale mirroring logic ---
let isAltPressed = false;
let initialScale = null;
let initialObject = null;

// Store initial scale when starting to scale
transformControls.addEventListener('mouseDown', () => {
    if (transformControls.getMode() === 'scale' && selectedObject) {
        initialObject = selectedObject;
        initialScale = selectedObject.scale.clone();
    }
});

// Apply mirror scaling during drag
transformControls.addEventListener('objectChange', () => {
    if (isAltPressed && initialObject && initialScale && transformControls.getMode() === 'scale') {
        // Get the current scale from the object
        const currentScale = initialObject.scale;
        
        // Find which axis changed most
        const dx = Math.abs(currentScale.x - initialScale.x);
        const dy = Math.abs(currentScale.y - initialScale.y);
        const dz = Math.abs(currentScale.z - initialScale.z);
        
        // Determine the dominant axis of change
        let dominantAxis = 'x';
        let maxChange = dx;
        if (dy > maxChange) { dominantAxis = 'y'; maxChange = dy; }
        if (dz > maxChange) { dominantAxis = 'z'; maxChange = dz; }
        
        // Apply the same scale change to all axes (mirror/uniform)
        if (maxChange > 0.001) {
            const scaleFactor = currentScale[dominantAxis] / initialScale[dominantAxis];
            // Clamp to prevent extreme values
            const clampedFactor = Math.max(0.1, Math.min(10, scaleFactor));
            initialObject.scale.set(
                initialScale.x * clampedFactor,
                initialScale.y * clampedFactor,
                initialScale.z * clampedFactor
            );
        }
    }
});

// Reset when done
transformControls.addEventListener('mouseUp', () => {
    initialScale = null;
    initialObject = null;
});

// --- Lights ---
const ambient = new THREE.AmbientLight(0x404060);
scene.add(ambient);
const keyLight = new THREE.DirectionalLight(0xffeedd, 1.2);
keyLight.position.set(5, 10, 7);
keyLight.castShadow = true;
keyLight.shadow.mapSize.width = 1024;
keyLight.shadow.mapSize.height = 1024;
scene.add(keyLight);
const fillLight = new THREE.DirectionalLight(0x4488ff, 0.6);
fillLight.position.set(-5, 0, 5);
scene.add(fillLight);

// --- Environment ---
const groundGeo = new THREE.PlaneGeometry(30, 30);
const groundMat = new THREE.ShadowMaterial({ opacity: 0.4 });
const ground = new THREE.Mesh(groundGeo, groundMat);
ground.rotation.x = -Math.PI / 2;
ground.position.y = -0.5;
ground.receiveShadow = true;
scene.add(ground);
const gridHelper = new THREE.GridHelper(20, 20, 0x88aaff, 0x446688);
gridHelper.position.y = -0.48;
scene.add(gridHelper);

// --- Model Management ---
let currentGroup = null;
let selectedObject = null;
let selectionBox = null;

// --- DOM Refs ---
const statusEl = document.getElementById('status');
const fileNameEl = document.getElementById('fileName');
const modelChildrenEl = document.getElementById('modelChildren');
const searchBox = document.getElementById('searchBox');
const propsPanel = document.getElementById('properties');
const propName = document.getElementById('propName');
const propClass = document.getElementById('propClass');
const propPosX = document.getElementById('propPosX');
const propPosY = document.getElementById('propPosY');
const propPosZ = document.getElementById('propPosZ');
const propRotX = document.getElementById('propRotX');
const propRotY = document.getElementById('propRotY');
const propRotZ = document.getElementById('propRotZ');
const propSizeX = document.getElementById('propSizeX');
const propSizeY = document.getElementById('propSizeY');
const propSizeZ = document.getElementById('propSizeZ');
const propColor = document.getElementById('propColor');
const propMaterial = document.getElementById('propMaterial');
const propAnchored = document.getElementById('propAnchored');
const propCanCollide = document.getElementById('propCanCollide');
const propTruss = document.getElementById('propTruss');
const propTexFace = document.getElementById('propTexFace');
const propTexType = document.getElementById('propTexType');
const propTexAddBtn = document.getElementById('propTexAddBtn');
const propTexList = document.getElementById('propTexList');

// New Explorer/Insert/Context-menu/Toolbox refs
const workspaceAddBtn = document.getElementById('workspaceAddBtn');
const workspaceExtrasEl = document.getElementById('workspaceExtras');
const insertObjectMenu = document.getElementById('insertObjectMenu');
const insertObjectSearch = document.getElementById('insertObjectSearch');
const insertObjectList = document.getElementById('insertObjectList');
const contextMenuEl = document.getElementById('contextMenu');

// Toolbox — the community marketplace panel (Store / My Assets). Publishing into
// it happens elsewhere (right-click → Save to Vodevs); this panel is purely for
// browsing + inserting what's been published, like Roblox's Toolbox/Creator Store.
const toolboxBtn = document.getElementById('toolboxBtn');
const closeToolboxBtn = document.getElementById('closeToolboxBtn');
const toolboxPanel = document.getElementById('toolboxPanel');
const toolboxSearch = document.getElementById('toolboxSearch');
const toolboxList = document.getElementById('toolboxList');
const toolboxEmpty = document.getElementById('toolboxEmpty');
const toolboxBrowseEl = document.getElementById('toolboxBrowse');
const toolboxDetailEl = document.getElementById('toolboxDetail');
const toolboxDetailBack = document.getElementById('toolboxDetailBack');
const toolboxDetailIcon = document.getElementById('toolboxDetailIcon');
const toolboxDetailName = document.getElementById('toolboxDetailName');
const toolboxDetailMeta = document.getElementById('toolboxDetailMeta');
const toolboxDetailInsert = document.getElementById('toolboxDetailInsert');
const toolboxDetailRemove = document.getElementById('toolboxDetailRemove');
const statObjectCountEl = document.getElementById('statObjectCount');
const statSelectionEl = document.getElementById('statSelection');
const statCamPosEl = document.getElementById('statCamPos');
const toolboxTabButtons = document.querySelectorAll('.toolbox-tab');
const toolboxChipButtons = document.querySelectorAll('.chip');
let toolboxActiveTab = 'store'; // 'store' = everyone's published assets, 'mine' = assets you saved
let toolboxActiveCategory = 'all'; // 'all' | 'model' | 'part' | 'instance'

// Applies Vortex-Studio-matching defaults
function ensurePartDefaults(obj) {
    if (obj.userData.material === undefined) obj.userData.material = 'Plastic';
    if (obj.userData.anchored === undefined) obj.userData.anchored = true;
    if (obj.userData.canCollide === undefined) obj.userData.canCollide = true;
    if (obj.userData.truss === undefined) obj.userData.truss = obj.userData.className === 'TrussPart';
    if (!Array.isArray(obj.userData.textures)) obj.userData.textures = [];
}

// --- Helper Functions ---
function moveCamera(vec) {
    camera.position.add(vec);
    orbitControls.target.add(vec);
}

function selectObject(obj) {
    if (selectedObject) {
        if (selectionBox) scene.remove(selectionBox);
        transformControls.detach();
    }
    selectedObject = obj;
    if (selectedObject) {
        selectionBox = new THREE.BoxHelper(selectedObject, 0x00a2ff);
        scene.add(selectionBox);
        transformControls.attach(selectedObject);
        updateProperties(selectedObject);
        propsPanel.classList.remove('panel-hidden');
    } else {
        propsPanel.classList.add('panel-hidden');
    }
    updateExplorer(currentGroup);
}

function deleteSelected() {
    if (!selectedObject || !currentGroup) return;
    currentGroup.remove(selectedObject);
    selectedObject.geometry.dispose();
    if (Array.isArray(selectedObject.material)) selectedObject.material.forEach(m => m.dispose());
    else selectedObject.material.dispose();
    
    selectObject(null);
    updateExplorer(currentGroup);
    statusEl.textContent = `🗑️ Deleted part.`;
}

// --- Properties UI ---
function renderTextureList(obj) {
    propTexList.innerHTML = '';
    const textures = (obj && Array.isArray(obj.userData.textures)) ? obj.userData.textures : [];
    if (textures.length === 0) {
        const li = document.createElement('li');
        li.className = 'texture-empty';
        li.style.border = 'none';
        li.style.background = 'transparent';
        li.textContent = 'No textures applied';
        propTexList.appendChild(li);
        return;
    }
    textures.forEach((t, i) => {
        const li = document.createElement('li');
        const label = document.createElement('span');
        label.textContent = `${t.face}: ${t.texture}`;
        const remove = document.createElement('span');
        remove.className = 'tex-remove';
        remove.textContent = '✕';
        remove.onclick = () => {
            obj.userData.textures.splice(i, 1);
            renderTextureList(obj);
        };
        li.appendChild(label);
        li.appendChild(remove);
        propTexList.appendChild(li);
    });
}

function updateProperties(obj) {
    if (!obj) return;
    ensurePartDefaults(obj);
    propName.value = obj.userData.partName || 'Part';
    propClass.textContent = obj.userData.className || 'Part';
    propMaterial.value = obj.userData.material;
    propAnchored.checked = obj.userData.anchored;
    propCanCollide.checked = obj.userData.canCollide;
    propTruss.checked = obj.userData.truss;
    renderTextureList(obj);
    
    propPosX.value = obj.position.x.toFixed(2);
    propPosY.value = obj.position.y.toFixed(2);
    propPosZ.value = obj.position.z.toFixed(2);
    
    const euler = new THREE.Euler().setFromQuaternion(obj.quaternion);
    propRotX.value = THREE.MathUtils.radToDeg(euler.x).toFixed(1);
    propRotY.value = THREE.MathUtils.radToDeg(euler.y).toFixed(1);
    propRotZ.value = THREE.MathUtils.radToDeg(euler.z).toFixed(1);
    
    const box = new THREE.Box3().setFromObject(obj);
    const size = new THREE.Vector3();
    box.getSize(size);
    propSizeX.value = size.x.toFixed(2);
    propSizeY.value = size.y.toFixed(2);
    propSizeZ.value = size.z.toFixed(2);
    
    if (obj.material && obj.material.color) {
        propColor.value = '#' + obj.material.color.getHexString();
    }
}

function bindPropInput(id, applyFn) {
    const el = document.getElementById(id);
    el.addEventListener('input', () => {
        if (selectedObject) applyFn(selectedObject, parseFloat(el.value));
    });
    el.addEventListener('change', () => { if (selectedObject) updateProperties(selectedObject); });
}
bindPropInput('propPosX', (obj, v) => obj.position.x = v);
bindPropInput('propPosY', (obj, v) => obj.position.y = v);
bindPropInput('propPosZ', (obj, v) => obj.position.z = v);

document.getElementById('propRotX').addEventListener('input', (e) => {
    if (!selectedObject) return;
    const euler = new THREE.Euler(THREE.MathUtils.degToRad(parseFloat(e.target.value)), 0, 0);
    selectedObject.quaternion.setFromEuler(euler);
});

function updateObjectScale(obj, x, y, z) {
    if (!obj.userData.baseSize) {
        const box = new THREE.Box3().setFromObject(obj);
        const size = new THREE.Vector3();
        box.getSize(size);
        obj.userData.baseSize = size.clone();
    }
    const base = obj.userData.baseSize;
    const newScaleX = x / base.x;
    const newScaleY = y / base.y;
    const newScaleZ = z / base.z;
    obj.scale.set(newScaleX, newScaleY, newScaleZ);
}
bindPropInput('propSizeX', (obj, v) => updateObjectScale(obj, v, parseFloat(propSizeY.value), parseFloat(propSizeZ.value)));
bindPropInput('propSizeY', (obj, v) => updateObjectScale(obj, parseFloat(propSizeX.value), v, parseFloat(propSizeZ.value)));
bindPropInput('propSizeZ', (obj, v) => updateObjectScale(obj, parseFloat(propSizeX.value), parseFloat(propSizeY.value), v));

propColor.addEventListener('input', (e) => {
    if (selectedObject && selectedObject.material) {
        selectedObject.material.color.set(e.target.value);
    }
});

propName.addEventListener('change', (e) => {
    if (selectedObject) {
        selectedObject.userData.partName = e.target.value;
        updateExplorer(currentGroup);
    }
});

propMaterial.addEventListener('change', (e) => {
    if (selectedObject) selectedObject.userData.material = e.target.value;
});
propAnchored.addEventListener('change', (e) => {
    if (selectedObject) selectedObject.userData.anchored = e.target.checked;
});
propCanCollide.addEventListener('change', (e) => {
    if (selectedObject) selectedObject.userData.canCollide = e.target.checked;
});
propTruss.addEventListener('change', (e) => {
    if (selectedObject) selectedObject.userData.truss = e.target.checked;
});

propTexAddBtn.addEventListener('click', () => {
    if (!selectedObject) return;
    ensurePartDefaults(selectedObject);
    const face = propTexFace.value;
    const texture = propTexType.value;
    const existingIndex = selectedObject.userData.textures.findIndex(t => t.face === face);
    if (existingIndex >= 0) selectedObject.userData.textures[existingIndex].texture = texture;
    else selectedObject.userData.textures.push({ face, texture });
    renderTextureList(selectedObject);
});

// --- ROBUST SLOPE DETECTION & SLICE DECOMPOSITION (v2 — geometry-accurate) ---
//
// The old version flagged ANY mesh with >30% "angled" triangles as a wedge. Curved,
// organic glTF surfaces (car roofs, hoods, fenders, door skins) are made almost entirely
// of angled triangles too, so on a typical car nearly every part got misclassified and
// blown apart into stacks of boxes built from a naive linear-taper guess. That's why a
// 141-part CAR.gltf turned into 846 mangled parts (141 * 6 slices = every single part).
//
// Fixed by:
//   1) classifyWedge() — only treats a mesh as a wedge if it has ONE dominant, isolated
//      slope face (like a real wedge/ramp), a low triangle count (real wedge primitives
//      are simple; curved body panels are highly tessellated), and few distinct face
//      normals overall. Organic surfaces fail these tests and are left untouched.
//   2) decomposeMeshIntoSlices() — instead of assuming a perfect linear taper along a
//      hardcoded Z axis, it raycasts straight down through the ACTUAL mesh geometry at
//      each slice column to sample the real surface height, and picks the true taper
//      axis (X, Z, or diagonal/corner) from the slope face's own normal. The staircase
//      now hugs the real imported shape instead of guessing.

// Build local (object-space) triangles with face normal + area, straight from geometry.
function getLocalTriangles(mesh) {
    const geo = mesh.geometry;
    const posAttr = geo && geo.getAttribute('position');
    if (!posAttr) return [];
    const index = geo.index ? geo.index.array : null;
    const triCount = index ? Math.floor(index.length / 3) : Math.floor(posAttr.count / 3);
    const tris = [];
    for (let i = 0; i < triCount; i++) {
        const ia = index ? index[i * 3]     : i * 3;
        const ib = index ? index[i * 3 + 1] : i * 3 + 1;
        const ic = index ? index[i * 3 + 2] : i * 3 + 2;
        const a = new THREE.Vector3().fromBufferAttribute(posAttr, ia);
        const b = new THREE.Vector3().fromBufferAttribute(posAttr, ib);
        const c = new THREE.Vector3().fromBufferAttribute(posAttr, ic);
        const cross = b.clone().sub(a).cross(c.clone().sub(a));
        const area = cross.length() * 0.5;
        if (area < 1e-9) continue;
        tris.push({ normal: cross.normalize(), area });
    }
    return tris;
}

// Group triangle normals into clusters of near-identical direction, weighted by area.
// A simple wedge has a handful of clusters (top, bottom, 2 walls, 1 slope). A curved
// organic surface has many, since its normal changes continuously.
function clusterNormals(triangles, angleTolDeg = 6) {
    const tol = Math.cos(THREE.MathUtils.degToRad(angleTolDeg));
    const clusters = [];
    for (const t of triangles) {
        let match = null;
        for (const c of clusters) {
            if (c.avg.dot(t.normal) > tol) { match = c; break; }
        }
        if (match) {
            match.sum.addScaledVector(t.normal, t.area);
            match.area += t.area;
            match.avg = match.sum.clone().normalize();
        } else {
            clusters.push({ sum: t.normal.clone().multiplyScalar(t.area), avg: t.normal.clone(), area: t.area });
        }
    }
    clusters.sort((a, b) => b.area - a.area);
    return clusters;
}

// Decide whether a mesh is genuinely a simple wedge/ramp (one planar slope face) as
// opposed to a curved/organic surface. Returns null (not a wedge) or the slope axis to
// stair-step along.
function classifyWedge(mesh) {
    if (!mesh.geometry) return null;
    const triangles = getLocalTriangles(mesh);
    // Real wedge/ramp primitives are simple (a handful of faces). Curved body panels
    // from a glTF car are highly tessellated — this alone filters most of them out.
    if (triangles.length === 0 || triangles.length > 60) return null;

    const totalArea = triangles.reduce((s, t) => s + t.area, 0);
    if (totalArea < 1e-6) return null;

    const clusters = clusterNormals(triangles, 6);
    if (clusters.length > 10) return null; // too many distinct faces for a simple prism

    // A slope face's normal is neither a top/bottom cap (~Y) nor a vertical wall (~XZ plane).
    const slopeClusters = clusters.filter(c => Math.abs(c.avg.y) > 0.15 && Math.abs(c.avg.y) < 0.94);
    if (slopeClusters.length === 0) return null;

    const dominant = slopeClusters[0];
    const dominantFrac = dominant.area / totalArea;
    const otherSlopeArea = slopeClusters.slice(1).reduce((s, c) => s + c.area, 0);

    // Require ONE dominant, isolated slope plane. Organic surfaces produce many
    // competing slope directions instead of a single consistent one.
    if (dominantFrac < 0.12) return null;
    if (otherSlopeArea > dominant.area * 0.5) return null;

    const nx = dominant.avg.x, nz = dominant.avg.z;
    if (Math.hypot(nx, nz) < 1e-4) return null;

    const axisMode = (Math.abs(nx) > 0.3 && Math.abs(nz) > 0.3) ? 'corner'
        : (Math.abs(nx) >= Math.abs(nz) ? 'x' : 'z');

    return { axisMode };
}

// Shared raycaster for sampling the real mesh surface height at a given local (x,z)
// column, straight down (-Y) through the geometry in its own object space.
const _slopeRaycaster = new THREE.Raycaster();
const _slopeDownDir = new THREE.Vector3(0, -1, 0);
function sampleLocalTopY(localMesh, x, z, rayStartY) {
    _slopeRaycaster.set(new THREE.Vector3(x, rayStartY, z), _slopeDownDir);
    _slopeRaycaster.far = rayStartY * 2 + 1000;
    const hits = _slopeRaycaster.intersectObject(localMesh, false);
    return hits.length > 0 ? hits[0].point.y : null;
}

// Decompose a classified wedge mesh into a staircase of boxes that follows the real
// sampled surface, correctly oriented/placed to match the original part.
function decomposeMeshIntoSlices(mesh, slices = 6, classification = null) {
    if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox();
    const localBox = mesh.geometry.boundingBox;
    const localSize = new THREE.Vector3();
    localBox.getSize(localSize);
    if (localSize.x < 1e-6 || localSize.y < 1e-6 || localSize.z < 1e-6) return [];

    const pos = new THREE.Vector3();
    const quat = new THREE.Quaternion();
    const scale = new THREE.Vector3();
    mesh.matrixWorld.decompose(pos, quat, scale);

    const cls = classification || classifyWedge(mesh) || { axisMode: 'z' };
    const localMesh = new THREE.Mesh(mesh.geometry); // identity transform → raycast in local space
    const rayStartY = localBox.max.y + Math.max(localSize.y, 1) * 0.5 + 0.5;

    const color = (mesh.material && mesh.material.color) ? mesh.material.color.getHex() : 0xcccccc;
    const materialName = mesh.userData.material || 'Plastic';
    const anchored = mesh.userData.anchored !== false;
    const canCollide = mesh.userData.canCollide !== false;
    const baseName = mesh.userData.partName || 'Wedge';
    const MIN_HEIGHT = Math.max(localSize.y * 0.01, 0.001);

    const parts = [];
    let idx = 0;
    function makeBox(localCenter, size) {
        if (size.y < MIN_HEIGHT || size.x < 1e-6 || size.z < 1e-6) return;
        const worldPos = localCenter.clone().applyQuaternion(quat).add(pos);
        const geo = new THREE.BoxGeometry(size.x, size.y, size.z);
        const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.6, metalness: 0.1 });
        const part = new THREE.Mesh(geo, mat);
        part.position.copy(worldPos);
        part.quaternion.copy(quat);
        part.castShadow = true;
        part.receiveShadow = true;
        idx++;
        part.userData.className = 'Part';
        part.userData.sourceShape = 'DecomposedWedge';
        part.userData.partName = `${baseName}_slice${idx}`;
        part.userData.material = materialName;
        part.userData.anchored = anchored;
        part.userData.canCollide = canCollide;
        part.userData.truss = false;
        part.userData.textures = [];
        parts.push(part);
    }

    if (cls.axisMode === 'corner') {
        // Two-axis taper (corner wedge): sample a slices×slices grid, skipping cells
        // that fall outside the mesh's real footprint (no raycast hit there) instead of
        // assuming an idealized triangular footprint.
        const cellX = localSize.x / slices;
        const cellZ = localSize.z / slices;
        for (let i = 0; i < slices; i++) {
            for (let j = 0; j < slices; j++) {
                const cx = localBox.min.x + cellX * (i + 0.5);
                const cz = localBox.min.z + cellZ * (j + 0.5);
                const topY = sampleLocalTopY(localMesh, cx, cz, rayStartY);
                if (topY === null) continue;
                const height = topY - localBox.min.y;
                if (height < MIN_HEIGHT) continue;
                makeBox(
                    new THREE.Vector3(cx, localBox.min.y + height / 2, cz),
                    new THREE.Vector3(cellX * scale.x, height * scale.y, cellZ * scale.z)
                );
            }
        }
    } else {
        // Single-axis taper (straight wedge/ramp): step along the real dominant slope
        // axis, sampling the real height at each column's center — no assumed direction.
        const along = cls.axisMode; // 'x' or 'z'
        const step = along === 'x' ? localSize.x / slices : localSize.z / slices;
        const otherSize = along === 'x' ? localSize.z : localSize.x;
        for (let i = 0; i < slices; i++) {
            const centerAlong = (along === 'x' ? localBox.min.x : localBox.min.z) + step * (i + 0.5);
            const cx = along === 'x' ? centerAlong : (localBox.min.x + localSize.x / 2);
            const cz = along === 'x' ? (localBox.min.z + localSize.z / 2) : centerAlong;
            const topY = sampleLocalTopY(localMesh, cx, cz, rayStartY);
            if (topY === null) continue;
            const height = topY - localBox.min.y;
            if (height < MIN_HEIGHT) continue;
            const size = along === 'x'
                ? new THREE.Vector3(step * scale.x, height * scale.y, otherSize * scale.z)
                : new THREE.Vector3(otherSize * scale.x, height * scale.y, step * scale.z);
            makeBox(new THREE.Vector3(cx, localBox.min.y + height / 2, cz), size);
        }
    }

    return parts;
}

// Process all meshes in a group, detecting genuine wedges and decomposing them.
function processWedgesInGroup(group) {
    const slices = Math.max(2, parseInt(document.getElementById('wedgeSteps')?.value, 10) || 6);
    const meshesToProcess = [];

    group.traverse((child) => {
        if (child.isMesh) meshesToProcess.push(child);
    });

    let decomposedCount = 0;
    meshesToProcess.forEach((mesh) => {
        const classification = classifyWedge(mesh);
        if (!classification) return;

        const parts = decomposeMeshIntoSlices(mesh, slices, classification);
        if (parts.length > 0) {
            group.remove(mesh);
            mesh.geometry.dispose();
            if (Array.isArray(mesh.material)) mesh.material.forEach(m => m.dispose());
            else mesh.material.dispose();

            parts.forEach(p => group.add(p));
            decomposedCount++;
        }
    });

    return decomposedCount;
}

// --- Roblox XML Parser ---
function parseRobloxXML(xmlText) {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlText, 'text/xml');
    const items = xmlDoc.getElementsByTagName('Item');
    const meshes = [];

    function getVector3(properties, name) {
        const vecNode = properties.querySelector(`[name="${name}"]`);
        if (!vecNode) return new THREE.Vector3(1, 1, 1);
        const x = parseFloat(vecNode.querySelector('X')?.textContent || 1);
        const y = parseFloat(vecNode.querySelector('Y')?.textContent || 1);
        const z = parseFloat(vecNode.querySelector('Z')?.textContent || 1);
        return new THREE.Vector3(x, y, z);
    }

    function getCFrame(properties, name) {
        const cfNode = properties.querySelector(`[name="${name}"]`);
        if (!cfNode) return { pos: new THREE.Vector3(0,0,0), rot: new THREE.Quaternion() };
        const x = parseFloat(cfNode.querySelector('X')?.textContent || 0);
        const y = parseFloat(cfNode.querySelector('Y')?.textContent || 0);
        const z = parseFloat(cfNode.querySelector('Z')?.textContent || 0);
        const r00 = parseFloat(cfNode.querySelector('R00')?.textContent || 1);
        const r01 = parseFloat(cfNode.querySelector('R01')?.textContent || 0);
        const r02 = parseFloat(cfNode.querySelector('R02')?.textContent || 0);
        const r10 = parseFloat(cfNode.querySelector('R10')?.textContent || 0);
        const r11 = parseFloat(cfNode.querySelector('R11')?.textContent || 1);
        const r12 = parseFloat(cfNode.querySelector('R12')?.textContent || 0);
        const r20 = parseFloat(cfNode.querySelector('R20')?.textContent || 0);
        const r21 = parseFloat(cfNode.querySelector('R21')?.textContent || 0);
        const r22 = parseFloat(cfNode.querySelector('R22')?.textContent || 1);
        const matrix = new THREE.Matrix4();
        matrix.set(r00, r01, r02, x, r10, r11, r12, y, r20, r21, r22, z, 0, 0, 0, 1);
        const pos = new THREE.Vector3();
        const quat = new THREE.Quaternion();
        const scale = new THREE.Vector3();
        matrix.decompose(pos, quat, scale);
        return { pos, rot: quat };
    }

    function getColor(properties) {
        const colorNode = properties.querySelector('[name="Color3uint8"]');
        if (!colorNode) return 0xcccccc;
        const val = parseInt(colorNode.textContent);
        const r = (val >> 16) & 0xFF;
        const g = (val >> 8) & 0xFF;
        const b = val & 0xFF;
        return (r << 16) | (g << 8) | b;
    }

    function getBool(properties, name, fallback) {
        const node = properties.querySelector(`bool[name="${name}"]`);
        if (!node) return fallback;
        return node.textContent.trim().toLowerCase() === 'true';
    }

    function getVortexMaterial(properties) {
        const node = properties.querySelector('token[name="Material"], string[name="Material"]');
        const raw = (node ? node.textContent : '').trim();
        const map = {
            Wood: 'Wood', WoodPlanks: 'Wood',
            Metal: 'Metal', DiamondPlate: 'Metal', CorrodedMetal: 'Metal', Foil: 'Metal',
            Grass: 'Grass', LeafyGrass: 'Grass', Ground: 'Grass',
            Ice: 'Ice', Glacier: 'Ice',
            SmoothPlastic: 'Paint', Neon: 'Paint',
        };
        return map[raw] || 'Plastic';
    }

    const supportedParts = ['Part', 'WedgePart', 'CornerWedgePart', 'Seat', 'VehicleSeat', 'SpawnLocation', 'TrussPart'];
    const wedgeSteps = Math.max(1, parseInt(document.getElementById('wedgeSteps')?.value, 10) || 6);

    for (let item of items) {
        const className = item.getAttribute('class');
        const properties = item.querySelector('Properties');
        const nameNode = properties?.querySelector('string[name="Name"]');
        const partName = nameNode ? nameNode.textContent : className;

        if (!properties) continue;
        if (!supportedParts.includes(className)) continue;

        // Skip MeshPart - its geometry is encrypted/binary and can't be parsed
        if (className === 'MeshPart') {
            console.log(`Skipping MeshPart "${partName}" - geometry is encrypted/binary`);
            continue;
        }

        const size = getVector3(properties, 'Size');
        const cf = getCFrame(properties, 'CFrame');
        const color = getColor(properties);
        const material = getVortexMaterial(properties);
        const anchored = getBool(properties, 'Anchored', true);
        const canCollide = getBool(properties, 'CanCollide', true);

        if (className === 'WedgePart' || className === 'CornerWedgePart') {
            // Use the new slice decomposition for XML wedges too
            const sliceCount = Math.max(2, parseInt(document.getElementById('wedgeSteps')?.value, 10) || 6);
            const stepDefs = className === 'WedgePart'
                ? buildWedgeSteps(size, sliceCount)
                : buildCornerWedgeSteps(size, sliceCount);

            stepDefs.forEach((step, i) => {
                const worldPos = stepOffsetToWorld(step.offset, cf);
                const geometry = new THREE.BoxGeometry(step.size.x, step.size.y, step.size.z);
                const mat = new THREE.MeshStandardMaterial({ color: color, roughness: 0.6, metalness: 0.1 });
                const mesh = new THREE.Mesh(geometry, mat);
                mesh.position.copy(worldPos);
                mesh.quaternion.copy(cf.rot);
                mesh.castShadow = true;
                mesh.receiveShadow = true;

                mesh.userData.className = 'Part';
                mesh.userData.sourceShape = className;
                mesh.userData.partName = `${partName}_slice${i + 1}`;
                mesh.userData.material = material;
                mesh.userData.anchored = anchored;
                mesh.userData.canCollide = canCollide;
                mesh.userData.truss = false;
                mesh.userData.textures = [];
                meshes.push(mesh);
            });
            continue;
        }

        // Regular Part (including Seat, VehicleSeat, SpawnLocation, TrussPart)
        const geometry = new THREE.BoxGeometry(size.x, size.y, size.z);
        const mat = new THREE.MeshStandardMaterial({ color: color, roughness: 0.6, metalness: 0.1 });
        const mesh = new THREE.Mesh(geometry, mat);
        mesh.position.copy(cf.pos);
        mesh.quaternion.copy(cf.rot);
        mesh.castShadow = true;
        mesh.receiveShadow = true;

        mesh.userData.className = className;
        mesh.userData.partName = partName;
        mesh.userData.material = material;
        mesh.userData.anchored = anchored;
        mesh.userData.canCollide = canCollide;
        mesh.userData.truss = className === 'TrussPart';
        mesh.userData.textures = [];
        meshes.push(mesh);
    }

    const group = new THREE.Group();
    meshes.forEach(m => group.add(m));
    
    const box = new THREE.Box3().setFromObject(group);
    const center = new THREE.Vector3();
    box.getCenter(center);
    group.position.sub(center);
    
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);
    if (maxDim > 15) {
        const scale = 10 / maxDim;
        group.scale.set(scale, scale, scale);
    }
    return group;
}

// Helper for XML wedge decomposition (keeping original for compatibility)
function buildWedgeSteps(size, steps) {
    const out = [];
    const stepDepth = size.z / steps;
    for (let i = 0; i < steps; i++) {
        const stepHeight = size.y * (steps - i) / steps;
        if (stepHeight <= 0) continue;
        const localZ = -size.z / 2 + stepDepth * (i + 0.5);
        const localY = -size.y / 2 + stepHeight / 2;
        out.push({
            size: { x: size.x, y: stepHeight, z: stepDepth },
            offset: { x: 0, y: localY, z: localZ }
        });
    }
    return out;
}

function buildCornerWedgeSteps(size, steps) {
    const out = [];
    const cellX = size.x / steps;
    const cellZ = size.z / steps;
    for (let i = 0; i < steps; i++) {
        for (let j = 0; j < steps; j++) {
            if (i + j >= steps) continue;
            const stepHeight = size.y * (steps - (i + j)) / steps;
            if (stepHeight <= 0) continue;
            const localX = -size.x / 2 + cellX * (i + 0.5);
            const localZ = -size.z / 2 + cellZ * (j + 0.5);
            const localY = -size.y / 2 + stepHeight / 2;
            out.push({
                size: { x: cellX, y: stepHeight, z: cellZ },
                offset: { x: localX, y: localY, z: localZ }
            });
        }
    }
    return out;
}

function stepOffsetToWorld(offset, cf) {
    const v = new THREE.Vector3(offset.x, offset.y, offset.z);
    v.applyQuaternion(cf.rot);
    v.add(cf.pos);
    return v;
}

// --- Explorer UI ---
function updateExplorer(group) {
    modelChildrenEl.innerHTML = '';
    if (!group) {
        document.querySelector('#importedModelNode .tree-node').textContent = 'ImportedModel (Empty)';
        return;
    }
    document.querySelector('#importedModelNode .tree-node').textContent = `ImportedModel (${group.children.length} items)`;
    
    const searchTerm = searchBox.value.toLowerCase();
    
    group.children.forEach((obj, index) => {
        const name = obj.userData.partName || obj.userData.className || `Part ${index}`;
        if (searchTerm && !name.toLowerCase().includes(searchTerm)) return;
        
        const li = document.createElement('li');
        
        let icon = '📦';
        if (obj.userData.sourceShape === 'WedgePart' || obj.userData.sourceShape === 'CornerWedgePart' || obj.userData.sourceShape === 'DecomposedWedge') icon = '🪜';
        else if (obj.userData.className === 'MeshPart') icon = '🌀';
        else if (obj.userData.className === 'Part') icon = '📦';
        else if (obj.userData.className === 'TrussPart') icon = '🏗️';
        
        li.innerHTML = `${icon} ${name}`;
        li.dataset.index = index;
        
        li.ondblclick = () => {
            const newName = prompt("Rename Part:", name);
            if (newName) {
                obj.userData.partName = newName;
                updateExplorer(group);
            }
        };

        li.onclick = (e) => {
            e.stopPropagation();
            selectObject(obj);
        };

        li.oncontextmenu = (e) => {
            e.preventDefault();
            e.stopPropagation();
            selectObject(obj);
            showContextMenu(e.clientX, e.clientY, buildPartContextMenuItems(obj));
        };

        if (selectedObject === obj) li.classList.add('selected');
        modelChildrenEl.appendChild(li);
    });

    renderWorkspaceExtras();
}

// Search listener
searchBox.addEventListener('input', () => updateExplorer(currentGroup));

// =====================================================================
// Insert Object (the "+" next to Workspace) + non-visual instance nodes
// =====================================================================
// Roblox Studio lets you insert lots of instance types under Workspace —
// most of them (Script, Folder, SpawnLocation, ClickDetector, etc.) have no
// 3D geometry of their own, they're just organizational/logic nodes. We
// track those separately from the THREE parts so the Explorer tree can show
// them without touching the 3D scene.
let extraInstances = []; // { id, className, name, icon }
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

function renderWorkspaceExtras() {
    workspaceExtrasEl.innerHTML = '';
    extraInstances.forEach((inst) => {
        const li = document.createElement('li');
        li.innerHTML = `${inst.icon} ${inst.name}`;
        li.dataset.extraId = inst.id;

        li.ondblclick = () => {
            const newName = prompt('Rename ' + inst.className + ':', inst.name);
            if (newName) {
                inst.name = newName;
                renderWorkspaceExtras();
            }
        };

        li.onclick = (e) => {
            e.stopPropagation();
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

function addInstance(className) {
    if (className === 'Part') {
        closeInsertMenu();
        createNewPart('Part');
        return;
    }
    if (className === 'MeshPart') {
        closeInsertMenu();
        document.getElementById('fileInput').click();
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

workspaceAddBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    const rect = workspaceAddBtn.getBoundingClientRect();
    openInsertMenu(rect.left, rect.bottom + 6);
});
insertObjectSearch.addEventListener('input', () => renderInsertMenuList(insertObjectSearch.value));

document.getElementById('workspaceNode').addEventListener('contextmenu', (e) => {
    e.preventDefault();
    e.stopPropagation();
    showContextMenu(e.clientX, e.clientY, [
        { label: 'Insert Object...', icon: '➕', onClick: () => openInsertMenu(e.clientX, e.clientY) },
        { sep: true },
        { label: 'Export Scene JSON', icon: '📦', onClick: () => exportSceneToVortexJSON() },
        { sep: true },
        { label: 'Save Model to Vodevs', icon: '🧩', onClick: () => saveModelToVodevs() },
    ]);
});

// =====================================================================
// Generic right-click Context Menu
// =====================================================================
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
insertObjectMenu.addEventListener('click', (e) => e.stopPropagation());
contextMenuEl.addEventListener('click', (e) => e.stopPropagation());
toolboxPanel.addEventListener('click', (e) => e.stopPropagation());
document.addEventListener('click', () => { hideContextMenu(); closeInsertMenu(); });
window.addEventListener('blur', () => { hideContextMenu(); closeInsertMenu(); });
document.addEventListener('scroll', () => { hideContextMenu(); }, true);

function duplicatePart(obj) {
    if (!obj || !currentGroup) return null;
    const clone = obj.clone();
    clone.geometry = obj.geometry.clone();
    clone.material = Array.isArray(obj.material) ? obj.material.map(m => m.clone()) : obj.material.clone();
    clone.userData = JSON.parse(JSON.stringify(obj.userData));
    clone.position.copy(obj.position).add(new THREE.Vector3(1, 0, 1));
    currentGroup.add(clone);
    updateExplorer(currentGroup);
    selectObject(clone);
    statusEl.textContent = `📑 Duplicated ${clone.userData.partName || 'Part'}.`;
    return clone;
}

function buildPartContextMenuItems(obj) {
    return [
        { label: 'Rename', icon: '✏️', onClick: () => {
            const newName = prompt('Rename Part:', obj.userData.partName || 'Part');
            if (newName) { obj.userData.partName = newName; updateExplorer(currentGroup); }
        } },
        { label: 'Duplicate', icon: '📑', onClick: () => duplicatePart(obj) },
        { sep: true },
        { label: 'Save', icon: '💾', onClick: () => saveObjectLocally(obj) },
        { label: 'Export', icon: '📦', onClick: () => exportObjectAsJSON(obj) },
        { sep: true },
        { label: 'Save to Vodevs', icon: '🧩', onClick: () => saveToVodevs(obj) },
        { sep: true },
        { label: 'Delete', icon: '🗑️', danger: true, onClick: () => { selectObject(obj); deleteSelected(); } },
    ];
}

function buildExtraContextMenuItems(inst) {
    return [
        { label: 'Rename', icon: '✏️', onClick: () => {
            const newName = prompt('Rename ' + inst.className + ':', inst.name);
            if (newName) { inst.name = newName; renderWorkspaceExtras(); }
        } },
        { sep: true },
        { label: 'Save', icon: '💾', onClick: () => saveObjectLocally(inst) },
        { label: 'Export', icon: '📦', onClick: () => exportObjectAsJSON(inst) },
        { sep: true },
        { label: 'Save to Vodevs', icon: '🧩', onClick: () => saveToVodevs(inst) },
        { sep: true },
        { label: 'Delete', icon: '🗑️', danger: true, onClick: () => {
            extraInstances = extraInstances.filter(i => i.id !== inst.id);
            renderWorkspaceExtras();
        } },
    ];
}

// =====================================================================
// Vodevs — community asset marketplace, browsed through the Toolbox panel
// =====================================================================
// Assets are kept in this browser's localStorage under 'vodevs_library'.
// This mirrors Roblox's Toolbox/Creator Store: publishing (right-click →
// Save to Vodevs, or the private Save) writes into this library; the
// Toolbox panel only ever browses and inserts from it. Note: since this
// web editor has no backend/server, "others can use it" currently means
// anyone using this same browser profile — wiring it to a real shared
// backend later just means swapping loadVodevsLibrary/saveVodevsLibrary
// for API calls, the rest of the UI stays the same.
const VODEVS_KEY = 'vodevs_library';

function loadVodevsLibrary() {
    try {
        const raw = localStorage.getItem(VODEVS_KEY);
        return raw ? JSON.parse(raw) : [];
    } catch (e) {
        return [];
    }
}
function saveVodevsLibrary(list) {
    try {
        localStorage.setItem(VODEVS_KEY, JSON.stringify(list));
    } catch (e) {
        showToast('Could not save: ' + e.message, 'error');
    }
}

// Shared shape-capture for a single Part/MeshPart or a non-visual instance —
// used by both the private "Save" and the public "Save to Vodevs" actions.
function buildAssetEntry(source, name) {
    if (source.isMesh) {
        // A real 3D Part/MeshPart — capture enough to rebuild a box part on insert.
        ensurePartDefaults(source);
        const box = new THREE.Box3().setFromObject(source);
        const size = new THREE.Vector3();
        box.getSize(size);
        const color = (source.material && source.material.color) ? source.material.color.getHex() : 0x888888;
        return {
            name,
            kind: 'part',
            className: source.userData.className || 'Part',
            size: { x: size.x || 1, y: size.y || 1, z: size.z || 1 },
            color,
            material: source.userData.material,
            anchored: source.userData.anchored,
            canCollide: source.userData.canCollide,
            truss: source.userData.truss,
            textures: source.userData.textures || [],
        };
    }
    // A non-visual instance (Script, Folder, etc.)
    return {
        name,
        kind: 'instance',
        className: source.className,
        icon: source.icon,
    };
}

// isPrivate=false → "Save to Vodevs": publishes it, so it shows up for
// everyone in the Toolbox → Store tab.
// isPrivate=true  → "Save": stays only visible to you, under Toolbox →
// My Assets — a personal quick-save, not a community publish.
function publishAsset(source, isPrivate) {
    const name = prompt(isPrivate ? 'Save as:' : 'Save to Vodevs as:', (source.userData && source.userData.partName) || source.name || 'Asset');
    if (!name) return;

    const entry = buildAssetEntry(source, name);
    entry.id = 'vodevs_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
    entry.author = 'You';
    entry.private = !!isPrivate;
    entry.savedAt = Date.now();

    const lib = loadVodevsLibrary();
    lib.unshift(entry);
    saveVodevsLibrary(lib);
    renderToolbox();

    if (isPrivate) {
        statusEl.textContent = `💾 Saved "${name}" — see it under Toolbox → My Assets.`;
        showToast(`Saved "${name}"`, 'success');
    } else {
        statusEl.textContent = `🧩 Published "${name}" to Vodevs — everyone can now insert it from the Toolbox.`;
        showToast(`Saved "${name}" to Vodevs`, 'success');
    }
}
function saveToVodevs(source) { publishAsset(source, false); }
function saveObjectLocally(source) { publishAsset(source, true); }

function saveModelToVodevs() {
    if (!currentGroup || currentGroup.children.length === 0) {
        showToast('Nothing to save — add or import a part first', 'warn');
        return;
    }
    const name = prompt('Save whole model to Vodevs as:', fileNameEl.textContent !== 'No file selected' ? fileNameEl.textContent.replace(/\.[^.]+$/, '') : 'Model');
    if (!name) return;

    const partsData = currentGroup.children.filter(c => c.isMesh).map((obj) => {
        ensurePartDefaults(obj);
        const box = new THREE.Box3().setFromObject(obj);
        const size = new THREE.Vector3();
        box.getSize(size);
        const color = (obj.material && obj.material.color) ? obj.material.color.getHex() : 0x888888;
        return {
            name: obj.userData.partName,
            position: { x: obj.position.x, y: obj.position.y, z: obj.position.z },
            size: { x: size.x || 1, y: size.y || 1, z: size.z || 1 },
            color,
            material: obj.userData.material,
            anchored: obj.userData.anchored,
            canCollide: obj.userData.canCollide,
            truss: obj.userData.truss,
        };
    });

    const entry = {
        id: 'vodevs_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
        name,
        kind: 'model',
        parts: partsData,
        author: 'You',
        private: false,
        savedAt: Date.now(),
    };
    const lib = loadVodevsLibrary();
    lib.unshift(entry);
    saveVodevsLibrary(lib);
    renderToolbox();
    statusEl.textContent = `🧩 Published model "${name}" to Vodevs (${partsData.length} parts).`;
    showToast(`Saved "${name}" to Vodevs`, 'success');
}

function insertFromVodevs(entry) {
    if (!currentGroup) {
        currentGroup = new THREE.Group();
        scene.add(currentGroup);
    }
    if (entry.kind === 'part') {
        const part = new THREE.Mesh(
            new THREE.BoxGeometry(entry.size.x, entry.size.y, entry.size.z),
            new THREE.MeshStandardMaterial({ color: entry.color })
        );
        part.position.set(0, entry.size.y / 2, 0);
        part.castShadow = true;
        part.receiveShadow = true;
        part.userData.className = entry.className || 'Part';
        part.userData.partName = entry.name;
        part.userData.material = entry.material;
        part.userData.anchored = entry.anchored;
        part.userData.canCollide = entry.canCollide;
        part.userData.truss = entry.truss;
        part.userData.textures = entry.textures ? JSON.parse(JSON.stringify(entry.textures)) : [];
        currentGroup.add(part);
        updateExplorer(currentGroup);
        selectObject(part);
        statusEl.textContent = `📥 Inserted "${entry.name}" from Vodevs.`;
        showToast(`Inserted "${entry.name}"`, 'success');
    } else if (entry.kind === 'model') {
        entry.parts.forEach((p) => {
            const part = new THREE.Mesh(
                new THREE.BoxGeometry(p.size.x, p.size.y, p.size.z),
                new THREE.MeshStandardMaterial({ color: p.color })
            );
            part.position.set(p.position.x, p.position.y, p.position.z);
            part.castShadow = true;
            part.receiveShadow = true;
            part.userData.className = 'Part';
            part.userData.partName = p.name;
            part.userData.material = p.material;
            part.userData.anchored = p.anchored;
            part.userData.canCollide = p.canCollide;
            part.userData.truss = p.truss;
            part.userData.textures = [];
            currentGroup.add(part);
        });
        updateExplorer(currentGroup);
        statusEl.textContent = `📥 Inserted model "${entry.name}" (${entry.parts.length} parts) from Vodevs.`;
        showToast(`Inserted "${entry.name}"`, 'success');
    } else {
        const inst = { id: 'inst_' + (extraIdCounter++), className: entry.className, name: entry.name, icon: entry.icon || '🧩' };
        extraInstances.push(inst);
        renderWorkspaceExtras();
        statusEl.textContent = `📥 Inserted "${entry.name}" from Vodevs.`;
        showToast(`Inserted "${entry.name}"`, 'success');
    }
}

function removeFromVodevs(id) {
    if (!confirm('Remove this asset?')) return;
    const lib = loadVodevsLibrary().filter(e => e.id !== id);
    saveVodevsLibrary(lib);
    renderToolbox();
    closeToolboxDetail();
}

// Which category chip an entry belongs to.
function toolboxCategoryOf(entry) {
    return entry.kind === 'model' ? 'model' : entry.kind === 'part' ? 'part' : 'instance';
}

// Store tab = everything anyone has published (i.e. not private).
// My Assets tab = everything *you* saved, published or private.
function getToolboxEntries() {
    const lib = loadVodevsLibrary();
    return lib.filter(e => toolboxActiveTab === 'mine' ? e.author === 'You' : !e.private);
}

function renderToolbox(filter) {
    if (filter === undefined) filter = toolboxSearch.value;
    const term = filter.trim().toLowerCase();
    const entries = getToolboxEntries().filter(e => {
        if (toolboxActiveCategory !== 'all' && toolboxCategoryOf(e) !== toolboxActiveCategory) return false;
        return e.name.toLowerCase().includes(term);
    });

    toolboxList.innerHTML = '';
    toolboxEmpty.style.display = entries.length === 0 ? 'block' : 'none';
    toolboxEmpty.innerHTML = toolboxActiveTab === 'mine'
        ? `You haven't saved anything yet. Right-click a part or model → <b>Save</b> (private) or <b>Save to Vodevs</b> (public) to see it here.`
        : `Nothing published yet. Right-click a part or model → <b>Save to Vodevs</b> to publish it so everyone can insert it.`;

    entries.forEach((entry) => {
        const li = document.createElement('li');
        li.className = 'vodevs-item';
        const icon = entry.kind === 'model' ? '🧩' : entry.kind === 'part' ? '📦' : (entry.icon || '🧩');
        const visibility = entry.private ? 'Private' : 'Vodevs';
        const metaText = entry.kind === 'model'
            ? `Model · ${entry.parts.length} parts · ${visibility}`
            : `${entry.className || 'Part'} · ${visibility}`;
        li.innerHTML = `
            <div class="vi-icon">${icon}</div>
            <div class="vi-info">
                <div class="vi-name">${entry.name}</div>
                <div class="vi-meta">${metaText}</div>
            </div>
            <div class="vi-actions">
                <button class="vi-insert">Insert</button>
            </div>
        `;
        li.querySelector('.vi-insert').onclick = (e) => { e.stopPropagation(); insertFromVodevs(entry); };
        li.onclick = () => openToolboxDetail(entry);
        toolboxList.appendChild(li);
    });
}

// Item detail page — like clicking into a listing on Creator Store (image 8).
function openToolboxDetail(entry) {
    toolboxBrowseEl.style.display = 'none';
    toolboxDetailEl.style.display = 'flex';
    toolboxDetailIcon.textContent = entry.kind === 'model' ? '🧩' : entry.kind === 'part' ? '📦' : (entry.icon || '🧩');
    toolboxDetailName.textContent = entry.name;
    toolboxDetailMeta.textContent = `By @${(entry.author || 'You').toLowerCase()} · ${entry.private ? 'Private — only visible to you' : 'Published to Vodevs'}`;
    toolboxDetailInsert.onclick = () => insertFromVodevs(entry);
    toolboxDetailRemove.style.display = entry.author === 'You' ? '' : 'none';
    toolboxDetailRemove.onclick = () => removeFromVodevs(entry.id);
}
function closeToolboxDetail() {
    toolboxDetailEl.style.display = 'none';
    toolboxBrowseEl.style.display = 'block';
}
toolboxDetailBack.addEventListener('click', closeToolboxDetail);

toolboxTabButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
        toolboxTabButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        toolboxActiveTab = btn.dataset.tab;
        closeToolboxDetail();
        renderToolbox();
    });
});
toolboxChipButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
        toolboxChipButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        toolboxActiveCategory = btn.dataset.cat;
        renderToolbox();
    });
});

function setToolboxVisible(visible) {
    toolboxPanel.classList.toggle('panel-hidden', !visible);
    document.getElementById('viewToggleToolbox')?.classList.toggle('active', visible);
    if (visible) { toolboxSearch.value = ''; closeToolboxDetail(); renderToolbox(''); }
}
toolboxBtn.addEventListener('click', () => {
    setToolboxVisible(toolboxPanel.classList.contains('panel-hidden'));
});
closeToolboxBtn.addEventListener('click', () => setToolboxVisible(false));
toolboxSearch.addEventListener('input', () => renderToolbox(toolboxSearch.value));

// --- Load Model ---
function flattenMeshesIntoGroup(root, group) {
    root.updateWorldMatrix(true, true);
    const meshes = [];
    root.traverse((child) => {
        if (child.isMesh) meshes.push(child);
    });

    meshes.forEach((mesh, i) => {
        mesh.updateWorldMatrix(true, false);
        const pos = new THREE.Vector3();
        const quat = new THREE.Quaternion();
        const scale = new THREE.Vector3();
        mesh.matrixWorld.decompose(pos, quat, scale);

        mesh.position.copy(pos);
        mesh.quaternion.copy(quat);
        mesh.scale.copy(scale);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        mesh.userData.className = 'MeshPart';
        mesh.userData.partName = mesh.name && mesh.name.trim() ? mesh.name : `MeshPart_${i + 1}`;
        ensurePartDefaults(mesh);

        group.add(mesh);
    });

    return meshes.length;
}

function loadModelFile(file) {
    const ext = file.name.split('.').pop().toLowerCase();
    const reader = new FileReader();
    clearModel();
    statusEl.textContent = `⏳ Loading ${file.name} ...`;
    fileNameEl.textContent = file.name;

    const onLoad = (group) => {
        // 🔥 KEY FIX: Process ALL wedges in the group, regardless of source
        const wedgesFound = processWedgesInGroup(group);
        
        scene.add(group);
        currentGroup = group;
        updateExplorer(group);
        statusEl.textContent = `✅ Loaded ${file.name} (${group.children.length} part${group.children.length === 1 ? '' : 's'})${wedgesFound > 0 ? ` — Decomposed ${wedgesFound} wedge${wedgesFound > 1 ? 's' : ''}` : ''}`;
        selectObject(null);
    };

    if (ext === 'gltf' || ext === 'glb') {
        const url = URL.createObjectURL(file);
        new GLTFLoader().load(url, (gltf) => {
            const group = new THREE.Group();
            const meshCount = flattenMeshesIntoGroup(gltf.scene, group);
            if (meshCount === 0) {
                statusEl.textContent = `⚠️ No meshes found in glTF.`;
                URL.revokeObjectURL(url);
                return;
            }

            const box = new THREE.Box3().setFromObject(group);
            const size = box.getSize(new THREE.Vector3());
            const maxDim = Math.max(size.x, size.y, size.z);
            if (maxDim > 5) {
                const scale = 4 / maxDim;
                group.scale.set(scale, scale, scale);
            } else if (maxDim < 0.5) {
                const scale = 2 / maxDim;
                group.scale.set(scale, scale, scale);
            }
            const center = new THREE.Vector3();
            box.getCenter(center);
            group.position.sub(center);
            onLoad(group);
            URL.revokeObjectURL(url);
        }, undefined, (error) => {
            statusEl.textContent = `❌ Error loading glTF`;
            console.error(error);
        });
    } 
    else if (ext === 'obj') {
        reader.onload = (e) => {
            try {
                const obj = new OBJLoader().parse(e.target.result);
                const group = new THREE.Group();
                const meshCount = flattenMeshesIntoGroup(obj, group);
                if (meshCount === 0) {
                    statusEl.textContent = `⚠️ No meshes found in OBJ.`;
                    return;
                }

                const box = new THREE.Box3().setFromObject(group);
                const size = box.getSize(new THREE.Vector3());
                const maxDim = Math.max(size.x, size.y, size.z);
                if (maxDim > 5) {
                    const scale = 4 / maxDim;
                    group.scale.set(scale, scale, scale);
                } else if (maxDim < 0.5 && maxDim > 0.01) {
                    const scale = 2 / maxDim;
                    group.scale.set(scale, scale, scale);
                }
                const center = new THREE.Vector3();
                box.getCenter(center);
                group.position.sub(center);
                onLoad(group);
            } catch (err) {
                statusEl.textContent = `❌ Error parsing OBJ`;
                console.error(err);
            }
        };
        reader.readAsText(file);
    } 
    else if (ext === 'xml' || ext === 'rbxlx' || ext === 'rbxmx') {
        reader.onload = (e) => {
            try {
                const group = parseRobloxXML(e.target.result);
                if (group.children.length === 0) {
                    statusEl.textContent = `⚠️ No supported parts found in ${ext.toUpperCase()}. (MeshParts are skipped because their geometry is encrypted/binary)`;
                    return;
                }
                onLoad(group);
            } catch (err) {
                statusEl.textContent = `❌ Error parsing ${ext.toUpperCase()}`;
                console.error(err);
            }
        };
        reader.readAsText(file);
    }
    else if (ext === 'rbxl' || ext === 'rbxm') {
        statusEl.textContent = `⚠️ .${ext} is Roblox's binary format — not readable here.`;
        showToast(
            `.${ext} is Roblox's binary format and can't be parsed in-browser. In Studio, use File → Save As and pick the ${ext === 'rbxl' ? '.rbxlx' : '.rbxmx'} (XML) option, then import that file instead.`,
            'warn'
        );
    }
    else {
        statusEl.textContent = `❌ Unsupported file type: ${ext}`;
    }
}

function clearModel() {
    if (currentGroup) {
        scene.remove(currentGroup);
        currentGroup.traverse(child => {
            if (child.isMesh) {
                child.geometry.dispose();
                if (Array.isArray(child.material)) child.material.forEach(m => m.dispose());
                else child.material.dispose();
            }
        });
        currentGroup = null;
    }
    selectObject(null);
    fileNameEl.textContent = 'No file selected';
    document.getElementById('fileInput').value = '';
    updateExplorer(null);
    statusEl.textContent = '🗑️ Model cleared';
}

// --- UI Events ---
document.getElementById('fileInput').addEventListener('change', (e) => {
    if (e.target.files[0]) loadModelFile(e.target.files[0]);
});

document.getElementById('clearBtn').addEventListener('click', clearModel);

// Creates a fresh box Part and drops it into the scene/explorer/selection.
// Shared by the toolbar "Add Part" button and the Explorer "+" Insert Object menu.
function createNewPart(name) {
    const part = new THREE.Mesh(
        new THREE.BoxGeometry(4, 1, 4),
        new THREE.MeshStandardMaterial({ color: 0x888888 })
    );
    part.position.set(0, 0.5, 0);
    part.castShadow = true;
    part.receiveShadow = true;
    part.userData.className = 'Part';
    part.userData.partName = name || 'Part';
    ensurePartDefaults(part);

    if (!currentGroup) {
        currentGroup = new THREE.Group();
        scene.add(currentGroup);
    }
    currentGroup.add(part);
    updateExplorer(currentGroup);
    selectObject(part);
    statusEl.textContent = `➕ Added ${part.userData.partName}.`;
    return part;
}

document.getElementById('addPartBtn').addEventListener('click', () => createNewPart('Part'));

document.getElementById('refreshExplorerBtn').addEventListener('click', () => {
    if (currentGroup) updateExplorer(currentGroup);
});

// --- Toast ---
const toastEl = document.getElementById('toast');
const toastIconEl = document.getElementById('toastIcon');
const toastMessageEl = document.getElementById('toastMessage');
function showToast(msg, type = 'info') {
    const icons = { info: 'ℹ️', success: '✅', error: '❌', warn: '⚠️' };
    toastIconEl.textContent = icons[type] || 'ℹ️';
    toastMessageEl.textContent = msg;
    toastEl.className = 'toast show ' + type;
    clearTimeout(toastEl._timeout);
    toastEl._timeout = setTimeout(() => toastEl.classList.remove('show'), 3500);
}

// --- Vortex JSON Export ---
function generateProjectId() {
    const chars = '0123456789abcdef';
    let id = '';
    for (let i = 0; i < 32; i++) id += chars[Math.floor(Math.random() * 16)];
    return id;
}

// Shared file-download helper for any JSON export (whole scene or a single object).
function downloadJSON(filename, dataObj) {
    try {
        const jsonString = JSON.stringify(dataObj, null, 2);
        const blob = new Blob([jsonString], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 2000);
        return true;
    } catch (e) {
        showToast('Export failed: ' + e.message, 'error');
        return false;
    }
}

// Right-click → Export on a single Part/MeshPart or instance — exports just
// that object, unlike the toolbar's "Export JSON" which exports the whole scene.
function exportObjectAsJSON(source) {
    const name = (source.userData && source.userData.partName) || source.name || 'Object';
    let data;

    if (source.isMesh) {
        ensurePartDefaults(source);
        source.updateWorldMatrix(true, false);
        const worldPos = new THREE.Vector3();
        const worldQuat = new THREE.Quaternion();
        const worldScale = new THREE.Vector3();
        source.matrixWorld.decompose(worldPos, worldQuat, worldScale);

        let size = new THREE.Vector3(1, 1, 1);
        if (source.geometry) {
            if (!source.geometry.boundingBox) source.geometry.computeBoundingBox();
            source.geometry.boundingBox.getSize(size);
            size.set(
                Math.abs(size.x * worldScale.x) || 1,
                Math.abs(size.y * worldScale.y) || 1,
                Math.abs(size.z * worldScale.z) || 1
            );
        }
        const color = (source.material && source.material.color) ? source.material.color : { r: 0.6, g: 0.6, b: 0.6 };
        const opacity = (source.material && source.material.opacity !== undefined) ? source.material.opacity : 1;

        data = {
            name,
            className: source.userData.className || 'Part',
            position: { x: worldPos.x, y: worldPos.y, z: worldPos.z },
            rotation: { x: worldQuat.x, y: worldQuat.y, z: worldQuat.z, w: worldQuat.w },
            scale: { x: size.x, y: size.y, z: size.z },
            color: { r: color.r, g: color.g, b: color.b, a: opacity },
            material: source.userData.material,
            anchored: source.userData.anchored,
            can_collide: source.userData.canCollide,
            truss: source.userData.truss,
            textures: (source.userData.textures || []).map(t => ({ face: t.face, texture: t.texture })),
        };
    } else {
        data = { name, className: source.className };
    }

    const filename = name.replace(/[^a-z0-9_\-]+/gi, '_') + '.json';
    if (downloadJSON(filename, data)) {
        statusEl.textContent = `📦 Exported "${name}" to ${filename}`;
        showToast('Exported ' + filename, 'success');
    }
}

function exportSceneToVortexJSON() {
    if (!currentGroup || currentGroup.children.length === 0) {
        showToast('Nothing to export — add or import a part first', 'warn');
        statusEl.textContent = '⚠️ Nothing to export.';
        return;
    }

    const parts = currentGroup.children.map((obj, index) => {
        obj.updateWorldMatrix(true, false);
        const worldPos = new THREE.Vector3();
        const worldQuat = new THREE.Quaternion();
        const worldScale = new THREE.Vector3();
        obj.matrixWorld.decompose(worldPos, worldQuat, worldScale);

        let size = new THREE.Vector3(1, 1, 1);
        if (obj.geometry) {
            if (!obj.geometry.boundingBox) obj.geometry.computeBoundingBox();
            obj.geometry.boundingBox.getSize(size);
            size.set(
                Math.abs(size.x * worldScale.x) || 1,
                Math.abs(size.y * worldScale.y) || 1,
                Math.abs(size.z * worldScale.z) || 1
            );
        }

        const color = (obj.material && obj.material.color) ? obj.material.color : { r: 0.6, g: 0.6, b: 0.6 };
        const opacity = (obj.material && obj.material.opacity !== undefined) ? obj.material.opacity : 1;

        ensurePartDefaults(obj);

        return {
            name: obj.userData.partName || obj.userData.className || ('Part_' + index),
            position: { x: worldPos.x, y: worldPos.y, z: worldPos.z },
            rotation: { x: worldQuat.x, y: worldQuat.y, z: worldQuat.z, w: worldQuat.w },
            scale: { x: size.x, y: size.y, z: size.z },
            color: { r: color.r, g: color.g, b: color.b, a: opacity },
            material: obj.userData.material,
            group: 0,
            anchored: obj.userData.anchored,
            can_collide: obj.userData.canCollide,
            truss: obj.userData.truss,
            textures: obj.userData.textures.map(t => ({ face: t.face, texture: t.texture })),
        };
    });

    const vortexJson = {
        project_id: generateProjectId(),
        parts: parts,
        lights: [],
        groups: [{ name: 'Group 0', parent_group: null }],
    };

    const jsonString = JSON.stringify(vortexJson, null, 2);
    const baseName = (fileNameEl.textContent && fileNameEl.textContent !== 'No file selected')
        ? fileNameEl.textContent.replace(/\.[^.]+$/, '')
        : 'scene';
    const filename = baseName + '_vortex.json';

    try {
        const blob = new Blob([jsonString], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 2000);
        statusEl.textContent = `📦 Exported ${parts.length} part${parts.length === 1 ? '' : 's'} to ${filename}`;
        showToast('Exported ' + filename, 'success');
    } catch (e) {
        statusEl.textContent = '❌ Export failed';
        showToast('Export failed: ' + e.message, 'error');
    }
}

document.getElementById('exportBtn').addEventListener('click', exportSceneToVortexJSON);

document.addEventListener('dragover', (e) => e.preventDefault());
document.addEventListener('drop', (e) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) {
        const ext = file.name.split('.').pop().toLowerCase();
        if (['xml', 'rbxlx', 'rbxmx', 'rbxl', 'rbxm', 'gltf', 'glb', 'obj'].includes(ext)) {
            loadModelFile(file);
            const dt = new DataTransfer();
            dt.items.add(file);
            document.getElementById('fileInput').files = dt.files;
        }
    }
});

function resizeViewport() {
    const { w, h } = viewportSize();
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
}
window.addEventListener('resize', resizeViewport);
// The docked panels/ribbon can also change the viewport's size without a
// window resize (e.g. toggling the Toolbox or Properties panel) — watch the
// container itself so the canvas always matches its actual pixel size.
if (window.ResizeObserver) {
    new ResizeObserver(resizeViewport).observe(viewportEl);
}

// --- Keyboard Shortcuts ---
const keys = {};
window.addEventListener('keydown', e => {
    keys[e.key.toLowerCase()] = true;
    
    // Alt key handling for mirror scaling
    if (e.key === 'Alt') {
        isAltPressed = true;
        // Optional: Change cursor or visual indicator
    }
    
    if (e.key === '1') transformControls.setMode('translate');
    if (e.key === '2') transformControls.setMode('rotate');
    if (e.key === '3') transformControls.setMode('scale');
    
    if (e.key.toLowerCase() === 'f' && selectedObject) {
        const box = new THREE.Box3().setFromObject(selectedObject);
        const center = new THREE.Vector3();
        box.getCenter(center);
        const size = box.getSize(new THREE.Vector3()).length();
        orbitControls.target.copy(center);
        camera.position.copy(center.clone().add(new THREE.Vector3(size, size * 0.6, size)));
    }
    
    if (e.key === 'Delete' || e.key === 'Backspace') {
        deleteSelected();
    }
});

window.addEventListener('keyup', e => {
    keys[e.key.toLowerCase()] = false;
    
    // Release alt key
    if (e.key === 'Alt') {
        isAltPressed = false;
    }
});

// --- Animation Loop ---
function animate() {
    requestAnimationFrame(animate);
    
    const speed = 0.08;
    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
    forward.y = 0; forward.normalize();
    right.y = 0; right.normalize();

    if (keys['w']) moveCamera(forward.clone().multiplyScalar(speed));
    if (keys['s']) moveCamera(forward.clone().multiplyScalar(-speed));
    if (keys['a']) moveCamera(right.clone().multiplyScalar(-speed));
    if (keys['d']) moveCamera(right.clone().multiplyScalar(speed));
    if (keys['q']) moveCamera(new THREE.Vector3(0, -speed, 0));
    if (keys['e']) moveCamera(new THREE.Vector3(0, speed, 0));

    if (selectionBox) selectionBox.update();

    orbitControls.update();
    renderer.render(scene, camera);

    // --- Status bar stats ---
    const objCount = currentGroup ? currentGroup.children.length : 0;
    statObjectCountEl.textContent = `${objCount} object${objCount === 1 ? '' : 's'}`;
    statSelectionEl.textContent = selectedObject
        ? (selectedObject.userData.partName || selectedObject.userData.className || 'Part')
        : 'No selection';
    statCamPosEl.textContent = `Cam: ${camera.position.x.toFixed(1)}, ${camera.position.y.toFixed(1)}, ${camera.position.z.toFixed(1)}`;
}
animate();

statusEl.textContent = 'Ready. Drop rbxlx/rbxmx/XML, glTF, or OBJ.';

// =====================================================================
// Ribbon — tab switching + View-tab dock toggles + Model/Test aliases
// =====================================================================
const ribbonTabButtons = document.querySelectorAll('.ribbon-tab');
const ribbonPages = document.querySelectorAll('.ribbon-page');
ribbonTabButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
        ribbonTabButtons.forEach(b => b.classList.remove('active'));
        ribbonPages.forEach(p => p.classList.remove('active'));
        btn.classList.add('active');
        document.querySelector(`.ribbon-page[data-ribbon-page="${btn.dataset.ribbon}"]`)?.classList.add('active');
        resizeViewport();
    });
});

// Buttons on non-Home ribbon pages that alias an existing action (e.g. the
// "Part" button on the Model tab reuses the Home tab's Add Part button).
document.querySelectorAll('[data-alias]').forEach((btn) => {
    btn.addEventListener('click', () => document.getElementById(btn.dataset.alias)?.click());
});

// View tab — toggle the docked panels on/off, like Roblox Studio's View ribbon.
function toggleDockPanel(panel, toggleBtn) {
    const nowHidden = !panel.classList.contains('panel-hidden');
    panel.classList.toggle('panel-hidden', nowHidden);
    toggleBtn.classList.toggle('active', !nowHidden);
    resizeViewport();
}
const viewToggleExplorerBtn = document.getElementById('viewToggleExplorer');
const viewToggleGridBtn = document.getElementById('viewToggleGrid');
viewToggleExplorerBtn.addEventListener('click', () => toggleDockPanel(document.getElementById('explorer'), viewToggleExplorerBtn));
document.getElementById('viewToggleProperties').addEventListener('click', () => {
    // Properties visibility is otherwise driven by selection; treat this as a manual override.
    propsPanel.classList.toggle('panel-hidden');
    document.getElementById('viewToggleProperties').classList.toggle('active', !propsPanel.classList.contains('panel-hidden'));
});
document.getElementById('viewToggleToolbox').addEventListener('click', () => {
    setToolboxVisible(toolboxPanel.classList.contains('panel-hidden'));
});
viewToggleGridBtn.addEventListener('click', () => {
    gridHelper.visible = !gridHelper.visible;
    viewToggleGridBtn.classList.toggle('active', gridHelper.visible);
});

// Test tab — there's no runtime/game server in this web editor, so Play just
// acknowledges the click rather than pretending to simulate anything.
document.getElementById('playBtn').addEventListener('click', () => {
    showToast('Play mode isn\u2019t available in the web editor', 'warn');
});
