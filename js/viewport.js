import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { TransformControls } from 'three/addons/controls/TransformControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';

export class ViewportManager {
  constructor(app) {
    this.app = app;
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.orbitControls = null;
    this.transformControls = null;
    this.selectionBox = null;
    this.transformMode = 'select';
    this.keys = {};
    this._setup();
  }
  
  _setup() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x111122);
    
    // Camera
    this.camera = new THREE.PerspectiveCamera(45, 1, 0.1, 1000);
    this.camera.position.set(8, 5, 12);
    
    // Renderer
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.2;
    
    // Orbit controls
    this.orbitControls = new OrbitControls(this.camera, this.renderer.domElement);
    this.orbitControls.enableDamping = true;
    this.orbitControls.dampingFactor = 0.05;
    this.orbitControls.target.set(0, 0, 0);
    this.orbitControls.maxPolarAngle = Math.PI / 2.2;
    this.orbitControls.minDistance = 3;
    this.orbitControls.maxDistance = 30;
    
    // Transform controls
    this.transformControls = new TransformControls(this.camera, this.renderer.domElement);
    this.scene.add(this.transformControls);
    this.transformControls.addEventListener('dragging-changed', (e) => {
      this.orbitControls.enabled = !e.value;
    });
    
    // Lights
    const ambient = new THREE.AmbientLight(0x404060);
    this.scene.add(ambient);
    const keyLight = new THREE.DirectionalLight(0xffeedd, 1.2);
    keyLight.position.set(5, 10, 7);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.width = 1024;
    keyLight.shadow.mapSize.height = 1024;
    this.scene.add(keyLight);
    const fillLight = new THREE.DirectionalLight(0x4488ff, 0.6);
    fillLight.position.set(-5, 0, 5);
    this.scene.add(fillLight);
    
    // Ground
    const groundGeo = new THREE.PlaneGeometry(30, 30);
    const groundMat = new THREE.ShadowMaterial({ opacity: 0.4 });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.5;
    ground.receiveShadow = true;
    this.scene.add(ground);
    const gridHelper = new THREE.GridHelper(20, 20, 0x88aaff, 0x446688);
    gridHelper.position.y = -0.48;
    this.scene.add(gridHelper);
    
    // Keyboard
    window.addEventListener('keydown', (e) => {
      this.keys[e.key.toLowerCase()] = true;
      this._handleKeyDown(e);
    });
    window.addEventListener('keyup', (e) => {
      this.keys[e.key.toLowerCase()] = false;
    });
    
    // Start animation loop
    this._animate();
  }
  
  getViewportElement() {
    const container = document.createElement('div');
    container.className = 'viewport-container';
    container.appendChild(this.renderer.domElement);
    
    // Toolbar
    const toolbar = document.createElement('div');
    toolbar.className = 'viewport-toolbar';
    
    const modes = [
      { id: 'select', icon: '▼', label: 'Select' },
      { id: 'translate', icon: '↕', label: 'Move' },
      { id: 'rotate', icon: '🔄', label: 'Rotate' },
      { id: 'scale', icon: '↔', label: 'Scale' }
    ];
    
    modes.forEach(mode => {
      const btn = document.createElement('button');
      btn.className = `vp-tool-btn${mode.id === 'select' ? ' active' : ''}`;
      btn.textContent = mode.icon;
      btn.title = mode.label;
      btn.dataset.mode = mode.id;
      btn.addEventListener('click', () => {
        this._setTransformMode(mode.id);
        toolbar.querySelectorAll('.vp-tool-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
      });
      toolbar.appendChild(btn);
    });
    
    container.appendChild(toolbar);
    
    // Status
    const status = document.createElement('div');
    status.className = 'viewport-status';
    status.textContent = '✨ Ready. Drop models to import.';
    container.appendChild(status);
    
    // Controls hint
    const hint = document.createElement('div');
    hint.className = 'viewport-controls-hint';
    hint.innerHTML = `
      <b>WASD</b> Move &nbsp;|&nbsp; <b>Q/E</b> Up/Down &nbsp;|&nbsp; <b>F</b> Focus<br>
      <b>1</b> Move &nbsp; <b>2</b> Rotate &nbsp; <b>3</b> Scale &nbsp; <b>Del</b> Delete
    `;
    container.appendChild(hint);
    
    // Setup drop
    container.addEventListener('dragover', (e) => e.preventDefault());
    container.addEventListener('drop', (e) => {
      e.preventDefault();
      const file = e.dataTransfer.files[0];
      if (file) this.loadModel(file);
    });
    
    // Store refs
    container._status = status;
    container._toolbar = toolbar;
    
    // Resize observer
    const ro = new ResizeObserver(() => this.resize());
    ro.observe(container);
    
    this._container = container;
    this.resize();
    
    return container;
  }
  
  resize() {
    if (!this._container) return;
    const w = this._container.clientWidth;
    const h = this._container.clientHeight;
    if (w > 0 && h > 0) {
      this.renderer.setSize(w, h);
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
    }
  }
  
  _setTransformMode(mode) {
    this.transformMode = mode;
    const selected = this.app.getSelectedObject();
    if (selected) {
      if (mode === 'select') {
        this.transformControls.detach();
      } else {
        this.transformControls.attach(selected);
        this.transformControls.setMode(mode);
      }
    }
  }
  
  _handleKeyDown(e) {
    const k = e.key;
    if (k === '1') this._setTransformMode('translate');
    if (k === '2') this._setTransformMode('rotate');
    if (k === '3') this._setTransformMode('scale');
    if (k === 'Escape') this._setTransformMode('select');
    if (k === 'f' && this.app.getSelectedObject()) {
      this._focusObject(this.app.getSelectedObject());
    }
    if (k === 'Delete' || k === 'Backspace') {
      this._deleteSelected();
    }
  }
  
  _focusObject(obj) {
    const box = new THREE.Box3().setFromObject(obj);
    const center = new THREE.Vector3();
    box.getCenter(center);
    const size = box.getSize(new THREE.Vector3()).length();
    this.orbitControls.target.copy(center);
    this.camera.position.copy(center.clone().add(new THREE.Vector3(size, size * 0.6, size)));
  }
  
  _deleteSelected() {
    const obj = this.app.getSelectedObject();
    const group = this.app.getCurrentGroup();
    if (!obj || !group) return;
    
    group.remove(obj);
    if (obj.geometry) obj.geometry.dispose();
    if (obj.material) {
      if (Array.isArray(obj.material)) obj.material.forEach(m => m.dispose());
      else obj.material.dispose();
    }
    this.app.setSelectedObject(null);
    this.app.notify('Deleted object', 'info');
  }
  
  loadModel(file) {
    const ext = file.name.split('.').pop().toLowerCase();
    const reader = new FileReader();
    
    this._container._status.textContent = `⏳ Loading ${file.name} ...`;
    
    const onLoad = (group) => {
      this.scene.add(group);
      this.app.setCurrentGroup(group);
      this.app.notify(`Loaded ${file.name}`, 'success');
      this._container._status.textContent = `✅ Loaded ${file.name}`;
    };
    
    if (ext === 'gltf' || ext === 'glb') {
      const url = URL.createObjectURL(file);
      new GLTFLoader().load(url, (gltf) => {
        const group = new THREE.Group();
        this._flattenMeshes(gltf.scene, group);
        this._scaleGroup(group);
        onLoad(group);
        URL.revokeObjectURL(url);
      }, undefined, (e) => {
        this._container._status.textContent = '❌ Error loading glTF';
        this.app.notify('Error loading glTF', 'error');
        console.error(e);
      });
    } else if (ext === 'obj') {
      reader.onload = (e) => {
        try {
          const obj = new OBJLoader().parse(e.target.result);
          const group = new THREE.Group();
          this._flattenMeshes(obj, group);
          this._scaleGroup(group);
          onLoad(group);
        } catch (err) {
          this._container._status.textContent = '❌ Error parsing OBJ';
          this.app.notify('Error parsing OBJ', 'error');
          console.error(err);
        }
      };
      reader.readAsText(file);
    } else {
      this._container._status.textContent = `❌ Unsupported: ${ext}`;
      this.app.notify(`Unsupported file type: ${ext}`, 'error');
    }
  }
  
  _flattenMeshes(root, group) {
    root.updateWorldMatrix(true, true);
    const meshes = [];
    root.traverse(child => { if (child.isMesh) meshes.push(child); });
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
      mesh.userData.partName = mesh.name && mesh.name.trim() ? mesh.name : `MeshPart_${i+1}`;
      this._ensureDefaults(mesh);
      group.add(mesh);
    });
  }
  
  _scaleGroup(group) {
    const box = new THREE.Box3().setFromObject(group);
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);
    if (maxDim > 5) { const s = 4 / maxDim; group.scale.set(s, s, s); }
    else if (maxDim < 0.5) { const s = 2 / maxDim; group.scale.set(s, s, s); }
    const center = new THREE.Vector3();
    box.getCenter(center);
    group.position.sub(center);
  }
  
  _ensureDefaults(obj) {
    if (obj.userData.material === undefined) obj.userData.material = 'Plastic';
    if (obj.userData.anchored === undefined) obj.userData.anchored = true;
    if (obj.userData.canCollide === undefined) obj.userData.canCollide = true;
  }
  
  _animate() {
    requestAnimationFrame(() => this._animate());
    
    // WASD movement
    const speed = 0.08;
    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(this.camera.quaternion);
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(this.camera.quaternion);
    forward.y = 0; forward.normalize();
    right.y = 0; right.normalize();
    
    if (this.keys['w']) this._moveCamera(forward.clone().multiplyScalar(speed));
    if (this.keys['s']) this._moveCamera(forward.clone().multiplyScalar(-speed));
    if (this.keys['a']) this._moveCamera(right.clone().multiplyScalar(-speed));
    if (this.keys['d']) this._moveCamera(right.clone().multiplyScalar(speed));
    if (this.keys['q']) this._moveCamera(new THREE.Vector3(0, -speed, 0));
    if (this.keys['e']) this._moveCamera(new THREE.Vector3(0, speed, 0));
    
    // Selection box
    const selected = this.app.getSelectedObject();
    if (selected) {
      if (!this.selectionBox) {
        this.selectionBox = new THREE.BoxHelper(selected, 0x00a2ff);
        this.scene.add(this.selectionBox);
      } else {
        this.selectionBox.update();
      }
    } else if (this.selectionBox) {
      this.scene.remove(this.selectionBox);
      this.selectionBox = null;
    }
    
    this.orbitControls.update();
    this.renderer.render(this.scene, this.camera);
  }
  
  _moveCamera(vec) {
    this.camera.position.add(vec);
    this.orbitControls.target.add(vec);
  }
}