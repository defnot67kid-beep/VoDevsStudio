export class RibbonManager {
  constructor(app) {
    this.app = app;
    this.container = document.getElementById('ribbon-content');
    this.tabs = document.querySelectorAll('.ribbon-tab');
    this._setup();
  }
  
  _setup() {
    // Tab switching
    this.tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        this.tabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        this._switchTab(tab.dataset.tab);
      });
    });
    
    // Initialize ribbon content
    this._buildRibbonContent();
    
    // Show home by default
    this._switchTab('home');
  }
  
  init() {
    // Additional setup if needed
  }
  
  _buildRibbonContent() {
    // Define ribbon groups
    const groups = {
      home: {
        label: 'Home',
        items: [
          { id: 'selectBtn', label: 'Select', icon: '▼', action: () => this._setTransformMode('select') },
          { id: 'moveBtn', label: 'Move', icon: '↕', action: () => this._setTransformMode('translate') },
          { id: 'rotateBtn', label: 'Rotate', icon: '🔄', action: () => this._setTransformMode('rotate') },
          { id: 'scaleBtn', label: 'Scale', icon: '↔', action: () => this._setTransformMode('scale') },
          { id: 'sep1', separator: true },
          { id: 'importBtn', label: 'Import', icon: '📂', action: () => this._importModel() },
          { id: 'exportBtn', label: 'Export', icon: '📦', action: () => this._exportScene() },
          { id: 'sep2', separator: true },
          { id: 'addPartBtn', label: 'Add Part', icon: '📦', action: () => this._addPart() },
          { id: 'deleteBtn', label: 'Delete', icon: '🗑️', action: () => this._deleteSelected() },
          { id: 'duplicateBtn', label: 'Duplicate', icon: '⧉', action: () => this._duplicateSelected() },
          { id: 'sep3', separator: true },
          { id: 'undoBtn', label: 'Undo', icon: '↩', action: () => this._undo() },
          { id: 'redoBtn', label: 'Redo', icon: '↪', action: () => this._redo() }
        ]
      },
      model: {
        label: 'Model',
        items: [
          { id: 'partBtn', label: 'Part', icon: '📦', action: () => this._addPart() },
          { id: 'sphereBtn', label: 'Sphere', icon: '⚪', action: () => this._addPrimitive('sphere') },
          { id: 'cylinderBtn', label: 'Cylinder', icon: '🛢️', action: () => this._addPrimitive('cylinder') },
          { id: 'wedgeBtn', label: 'Wedge', icon: '🔺', action: () => this._addPrimitive('wedge') }
        ]
      },
      test: {
        label: 'Test',
        items: [
          { id: 'playBtn', label: 'Play', icon: '▶', action: () => this.app.notify('Play mode not implemented', 'warn') },
          { id: 'stopBtn', label: 'Stop', icon: '⏹', action: () => this.app.notify('Stop not implemented', 'warn') },
          { id: 'pauseBtn', label: 'Pause', icon: '⏸', action: () => this.app.notify('Pause not implemented', 'warn') }
        ]
      },
      view: {
        label: 'View',
        items: [
          { id: 'gridToggle', label: 'Grid', icon: '⊞', toggle: true, state: true, action: () => this._toggleGrid() },
          { id: 'wireframeToggle', label: 'Wireframe', icon: '▦', toggle: true, state: false, action: () => this._toggleWireframe() },
          { id: 'sep1', separator: true },
          { id: 'panels', label: 'Panels', icon: '▤', menu: [
            { label: 'Explorer', action: () => this._togglePanel('explorer') },
            { label: 'Properties', action: () => this._togglePanel('properties') },
            { label: 'Toolbox', action: () => this._togglePanel('toolbox') },
            { label: 'Output', action: () => this._togglePanel('output') },
            { label: 'Script Editor', action: () => this._togglePanel('scriptEditor') }
          ]},
          { id: 'resetLayout', label: 'Reset Layout', icon: '⟳', action: () => this.app.dockManager.resetLayout() },
          { id: 'saveLayout', label: 'Save Layout', icon: '💾', action: () => this.app.dockManager._saveLayout() }
        ]
      },
      plugins: {
        label: 'Plugins',
        items: [
          { id: 'pluginsBtn', label: 'Plugins', icon: '🔌', action: () => this.app.notify('Plugins panel not implemented', 'warn') }
        ]
      }
    };
    
    // Build ribbon groups
    this.container.innerHTML = '';
    Object.entries(groups).forEach(([key, group]) => {
      const groupEl = document.createElement('div');
      groupEl.className = 'ribbon-group';
      groupEl.dataset.group = key;
      groupEl.style.display = 'none';
      
      group.items.forEach(item => {
        if (item.separator) {
          const sep = document.createElement('div');
          sep.style.cssText = 'width: 1px; height: 24px; background: var(--border); margin: 0 4px;';
          groupEl.appendChild(sep);
          return;
        }
        
        if (item.menu) {
          // Menu button
          const btn = document.createElement('button');
          btn.className = 'ribbon-btn';
          btn.innerHTML = `<span class="ribbon-icon">${item.icon}</span> ${item.label}`;
          btn.addEventListener('click', (e) => {
            this._showPanelMenu(item.menu, e);
          });
          groupEl.appendChild(btn);
          return;
        }
        
        const btn = document.createElement('button');
        btn.className = 'ribbon-btn';
        btn.id = item.id;
        btn.innerHTML = `<span class="ribbon-icon">${item.icon}</span> ${item.label}`;
        if (item.toggle) {
          btn.dataset.toggle = 'true';
          btn.dataset.state = item.state ? 'true' : 'false';
          if (item.state) btn.classList.add('active');
        }
        btn.addEventListener('click', () => {
          if (item.toggle) {
            const state = btn.dataset.state === 'true';
            btn.dataset.state = (!state).toString();
            btn.classList.toggle('active');
            if (item.action) item.action();
          } else if (item.action) {
            item.action();
          }
        });
        groupEl.appendChild(btn);
      });
      
      this.container.appendChild(groupEl);
    });
  }
  
  _switchTab(tab) {
    this.container.querySelectorAll('.ribbon-group').forEach(g => {
      g.style.display = g.dataset.group === tab ? 'flex' : 'none';
    });
  }
  
  _setTransformMode(mode) {
    if (this.app.viewportManager) {
      this.app.viewportManager._setTransformMode(mode);
      // Update viewport toolbar
      const vpToolbar = document.querySelector('.viewport-toolbar');
      if (vpToolbar) {
        vpToolbar.querySelectorAll('.vp-tool-btn').forEach(b => {
          b.classList.toggle('active', b.dataset.mode === mode);
        });
      }
    }
  }
  
  _importModel() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.glb,.gltf,.obj';
    input.onchange = (e) => {
      if (e.target.files[0] && this.app.viewportManager) {
        this.app.viewportManager.loadModel(e.target.files[0]);
      }
    };
    input.click();
  }
  
  _exportScene() {
    const group = this.app.getCurrentGroup();
    if (!group || group.children.length === 0) {
      this.app.notify('Nothing to export', 'warn');
      return;
    }
    
    const parts = group.children.map((obj, i) => {
      const wp = new THREE.Vector3();
      const wq = new THREE.Quaternion();
      const ws = new THREE.Vector3();
      obj.matrixWorld.decompose(wp, wq, ws);
      let size = new THREE.Vector3(1, 1, 1);
      if (obj.geometry) {
        if (!obj.geometry.boundingBox) obj.geometry.computeBoundingBox();
        obj.geometry.boundingBox.getSize(size);
        size.set(Math.abs(size.x * ws.x) || 1, Math.abs(size.y * ws.y) || 1, Math.abs(size.z * ws.z) || 1);
      }
      const color = obj.material?.color || { r: 0.6, g: 0.6, b: 0.6 };
      return {
        name: obj.userData.partName || `Part_${i}`,
        position: { x: wp.x, y: wp.y, z: wp.z },
        rotation: { x: wq.x, y: wq.y, z: wq.z, w: wq.w },
        scale: { x: size.x, y: size.y, z: size.z },
        color: { r: color.r, g: color.g, b: color.b, a: 1 },
        material: obj.userData.material || 'Plastic',
        anchored: obj.userData.anchored || true,
        can_collide: obj.userData.canCollide || true
      };
    });
    
    const json = JSON.stringify({ project_id: Date.now().toString(36), parts }, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'scene.vodevs';
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    this.app.notify(`Exported ${parts.length} parts`, 'success');
  }
  
  _addPart() {
    const group = this.app.getCurrentGroup();
    if (!group) {
      this.app.notify('No workspace to add to', 'warn');
      return;
    }
    
    const part = new THREE.Mesh(
      new THREE.BoxGeometry(2, 1, 2),
      new THREE.MeshStandardMaterial({ color: 0x888888 })
    );
    part.position.set(0, 0.5, 0);
    part.castShadow = true;
    part.receiveShadow = true;
    part.userData.className = 'Part';
    part.userData.partName = 'Part';
    part.userData.material = 'Plastic';
    part.userData.anchored = true;
    part.userData.canCollide = true;
    
    group.add(part);
    this.app.explorerManager.updateExplorer(group);
    this.app.setSelectedObject(part);
    this.app.notify('Added Part', 'info');
  }
  
  _addPrimitive(type) {
    const group = this.app.getCurrentGroup();
    if (!group) {
      this.app.notify('No workspace to add to', 'warn');
      return;
    }
    
    let geometry;
    let name = type.charAt(0).toUpperCase() + type.slice(1);
    switch (type) {
      case 'sphere':
        geometry = new THREE.SphereGeometry(1, 16, 16);
        break;
      case 'cylinder':
        geometry = new THREE.CylinderGeometry(1, 1, 2, 16);
        break;
      case 'wedge':
        // Simplified wedge
        const shape = new THREE.Shape();
        shape.moveTo(-1, -1);
        shape.lineTo(1, -1);
        shape.lineTo(-1, 1);
        shape.closePath();
        const extrudeSettings = { steps: 1, depth: 2, bevelEnabled: false };
        geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);
        break;
      default:
        geometry = new THREE.BoxGeometry(2, 1, 2);
    }
    
    const part = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ color: 0x888888 }));
    part.position.set(0, 1, 0);
    part.castShadow = true;
    part.receiveShadow = true;
    part.userData.className = 'Part';
    part.userData.partName = name;
    part.userData.material = 'Plastic';
    part.userData.anchored = true;
    part.userData.canCollide = true;
    
    group.add(part);
    this.app.explorerManager.updateExplorer(group);
    this.app.setSelectedObject(part);
    this.app.notify(`Added ${name}`, 'info');
  }
  
  _deleteSelected() {
    const obj = this.app.getSelectedObject();
    const group = this.app.getCurrentGroup();
    if (!obj || !group) {
      this.app.notify('No object selected', 'warn');
      return;
    }
    
    group.remove(obj);
    if (obj.geometry) obj.geometry.dispose();
    if (obj.material) {
      if (Array.isArray(obj.material)) obj.material.forEach(m => m.dispose());
      else obj.material.dispose();
    }
    this.app.setSelectedObject(null);
    this.app.explorerManager.updateExplorer(group);
    this.app.notify('Deleted object', 'info');
  }
  
  _duplicateSelected() {
    const obj = this.app.getSelectedObject();
    const group = this.app.getCurrentGroup();
    if (!obj || !group) {
      this.app.notify('No object selected', 'warn');
      return;
    }
    
    const copy = obj.clone(true);
    copy.userData = JSON.parse(JSON.stringify(obj.userData || {}));
    copy.position.x += 1.5;
    group.add(copy);
    this.app.explorerManager.updateExplorer(group);
    this.app.setSelectedObject(copy);
    this.app.notify('Duplicated object', 'info');
  }
  
  _undo() {
    this.app.notify('Undo not implemented', 'warn');
  }
  
  _redo() {
    this.app.notify('Redo not implemented', 'warn');
  }
  
  _toggleGrid() {
    const viewport = this.app.viewportManager;
    if (viewport) {
      const grid = viewport.scene.children.find(c => c instanceof THREE.GridHelper);
      if (grid) {
        grid.visible = !grid.visible;
        this.app.notify(`Grid ${grid.visible ? 'shown' : 'hidden'}`, 'info');
      }
    }
  }
  
  _toggleWireframe() {
    const group = this.app.getCurrentGroup();
    if (!group) {
      this.app.notify('No model loaded', 'warn');
      return;
    }
    group.traverse(child => {
      if (child.isMesh && child.material) {
        if (Array.isArray(child.material)) {
          child.material.forEach(m => m.wireframe = !m.wireframe);
        } else {
          child.material.wireframe = !child.material.wireframe;
        }
      }
    });
    this.app.notify('Toggled wireframe', 'info');
  }
  
  _togglePanel(id) {
    const panel = this.app.dockManager.getPanel(id);
    if (!panel) {
      this.app.notify(`Panel ${id} not found`, 'error');
      return;
    }
    if (panel.state.closed) {
      panel.state.closed = false;
      panel.element.style.display = 'flex';
      this.app.dockManager._dockPanel(id, panel.state.zone || panel.defaultZone || 'center');
      this.app.notify(`Opened ${panel.title}`, 'info');
    } else {
      this.app.dockManager._closePanel(id);
      this.app.notify(`Closed ${panel.title}`, 'info');
    }
    this.app.dockManager._saveLayout();
  }
  
  _showPanelMenu(menuItems, e) {
    if (this.app.contextMenuManager) {
      this.app.contextMenuManager.show(e.clientX, e.clientY, menuItems);
    }
  }
}