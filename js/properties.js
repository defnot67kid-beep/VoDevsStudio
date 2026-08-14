import * as THREE from 'three';

export class PropertiesManager {
  constructor(app) {
    this.app = app;
    this.container = null;
    this.currentObject = null;
    this._setup();
  }
  
  _setup() {
    this.container = document.createElement('div');
    this.container.className = 'properties-container';
    
    // Property search
    const search = document.createElement('div');
    search.className = 'prop-search';
    const input = document.createElement('input');
    input.type = 'text';
    input.placeholder = 'Search properties...';
    input.addEventListener('input', () => this._filterProperties(input.value));
    search.appendChild(input);
    this.container.appendChild(search);
    
    // Property groups
    this.groups = {};
    const groupDefs = [
      { id: 'identity', label: 'Identity' },
      { id: 'transform', label: 'Transform' },
      { id: 'appearance', label: 'Appearance' },
      { id: 'physics', label: 'Physics' },
      { id: 'surface', label: 'Surface' }
    ];
    
    groupDefs.forEach(def => {
      const group = this._createGroup(def.id, def.label);
      this.groups[def.id] = group;
      this.container.appendChild(group.element);
    });
    
    // No selection state
    this._showEmpty();
  }
  
  getPropertiesElement() {
    return this.container;
  }
  
  _createGroup(id, label) {
    const element = document.createElement('div');
    element.className = 'prop-group';
    element.dataset.group = id;
    
    const header = document.createElement('div');
    header.className = 'prop-group-header';
    header.innerHTML = `
      <span class="arrow">▾</span>
      <span class="prop-group-label">${label}</span>
    `;
    header.addEventListener('click', () => {
      const body = element.querySelector('.prop-group-body');
      const arrow = header.querySelector('.arrow');
      body.classList.toggle('collapsed');
      arrow.classList.toggle('collapsed');
    });
    element.appendChild(header);
    
    const body = document.createElement('div');
    body.className = 'prop-group-body';
    element.appendChild(body);
    
    return { element, body, header, id };
  }
  
  _showEmpty() {
    Object.values(this.groups).forEach(g => g.body.innerHTML = '');
    const empty = document.createElement('div');
    empty.style.cssText = 'text-align: center; color: var(--text-dim); padding: 20px;';
    empty.textContent = 'Select an object to view properties';
    this.container.appendChild(empty);
  }
  
  updateProperties(obj) {
    this.currentObject = obj;
    
    if (!obj) {
      this._showEmpty();
      return;
    }
    
    // Clear all groups
    Object.values(this.groups).forEach(g => g.body.innerHTML = '');
    
    // Populate groups
    this._populateIdentity(obj);
    this._populateTransform(obj);
    this._populateAppearance(obj);
    this._populatePhysics(obj);
    this._populateSurface(obj);
  }
  
  _populateIdentity(obj) {
    const body = this.groups.identity.body;
    const name = document.createElement('div');
    name.className = 'prop-row';
    name.innerHTML = `
      <input type="text" id="propName" value="${obj.userData.partName || 'Part'}" placeholder="Name">
    `;
    name.querySelector('input').addEventListener('change', (e) => {
      obj.userData.partName = e.target.value;
      this.app.explorerManager.updateExplorer(this.app.getCurrentGroup());
      this.app.notify(`Renamed to ${e.target.value}`, 'info');
    });
    body.appendChild(name);
    
    const className = document.createElement('div');
    className.className = 'prop-row';
    className.innerHTML = `
      <span style="color:var(--text-dim);font-size:12px;">Class: ${obj.userData.className || 'Part'}</span>
    `;
    body.appendChild(className);
  }
  
  _populateTransform(obj) {
    const body = this.groups.transform.body;
    
    // Position
    const posGroup = document.createElement('div');
    posGroup.innerHTML = `
      <span style="font-size:11px;color:var(--text-dim);">Position</span>
      <div class="prop-vector3">
        <span class="vec-label">X</span><input type="number" id="propPosX" step="0.1" value="${obj.position.x.toFixed(2)}">
        <span class="vec-label">Y</span><input type="number" id="propPosY" step="0.1" value="${obj.position.y.toFixed(2)}">
        <span class="vec-label">Z</span><input type="number" id="propPosZ" step="0.1" value="${obj.position.z.toFixed(2)}">
      </div>
    `;
    posGroup.querySelectorAll('input').forEach(input => {
      input.addEventListener('change', () => {
        obj.position.set(
          parseFloat(posGroup.querySelector('#propPosX').value) || 0,
          parseFloat(posGroup.querySelector('#propPosY').value) || 0,
          parseFloat(posGroup.querySelector('#propPosZ').value) || 0
        );
      });
    });
    body.appendChild(posGroup);
    
    // Rotation
    const euler = new THREE.Euler().setFromQuaternion(obj.quaternion);
    const rotGroup = document.createElement('div');
    rotGroup.innerHTML = `
      <span style="font-size:11px;color:var(--text-dim);">Rotation (Euler)</span>
      <div class="prop-vector3">
        <span class="vec-label">X</span><input type="number" id="propRotX" step="1" value="${THREE.MathUtils.radToDeg(euler.x).toFixed(1)}">
        <span class="vec-label">Y</span><input type="number" id="propRotY" step="1" value="${THREE.MathUtils.radToDeg(euler.y).toFixed(1)}">
        <span class="vec-label">Z</span><input type="number" id="propRotZ" step="1" value="${THREE.MathUtils.radToDeg(euler.z).toFixed(1)}">
      </div>
    `;
    rotGroup.querySelectorAll('input').forEach(input => {
      input.addEventListener('change', () => {
        const rx = THREE.MathUtils.degToRad(parseFloat(rotGroup.querySelector('#propRotX').value) || 0);
        const ry = THREE.MathUtils.degToRad(parseFloat(rotGroup.querySelector('#propRotY').value) || 0);
        const rz = THREE.MathUtils.degToRad(parseFloat(rotGroup.querySelector('#propRotZ').value) || 0);
        obj.quaternion.setFromEuler(new THREE.Euler(rx, ry, rz));
      });
    });
    body.appendChild(rotGroup);
    
    // Size
    const box = new THREE.Box3().setFromObject(obj);
    const size = new THREE.Vector3();
    box.getSize(size);
    const sizeGroup = document.createElement('div');
    sizeGroup.innerHTML = `
      <span style="font-size:11px;color:var(--text-dim);">Size</span>
      <div class="prop-vector3">
        <span class="vec-label">X</span><input type="number" id="propSizeX" step="0.1" value="${size.x.toFixed(2)}">
        <span class="vec-label">Y</span><input type="number" id="propSizeY" step="0.1" value="${size.y.toFixed(2)}">
        <span class="vec-label">Z</span><input type="number" id="propSizeZ" step="0.1" value="${size.z.toFixed(2)}">
      </div>
    `;
    sizeGroup.querySelectorAll('input').forEach(input => {
      input.addEventListener('change', () => {
        // Scale the object based on size change
        const newSize = new THREE.Vector3(
          parseFloat(sizeGroup.querySelector('#propSizeX').value) || 1,
          parseFloat(sizeGroup.querySelector('#propSizeY').value) || 1,
          parseFloat(sizeGroup.querySelector('#propSizeZ').value) || 1
        );
        const currentSize = new THREE.Vector3();
        new THREE.Box3().setFromObject(obj).getSize(currentSize);
        if (currentSize.length() > 0) {
          const scale = newSize.clone().divide(currentSize);
          obj.scale.multiply(scale);
        }
      });
    });
    body.appendChild(sizeGroup);
  }
  
  _populateAppearance(obj) {
    const body = this.groups.appearance.body;
    
    // Color
    const colorGroup = document.createElement('div');
    const colorHex = obj.material?.color ? '#' + obj.material.color.getHexString() : '#cccccc';
    colorGroup.innerHTML = `
      <span style="font-size:11px;color:var(--text-dim);">Color</span>
      <div class="prop-row">
        <input type="color" id="propColor" value="${colorHex}">
      </div>
    `;
    colorGroup.querySelector('input').addEventListener('change', (e) => {
      if (obj.material) obj.material.color.set(e.target.value);
    });
    body.appendChild(colorGroup);
    
    // Material
    const matGroup = document.createElement('div');
    matGroup.innerHTML = `
      <span style="font-size:11px;color:var(--text-dim);">Material</span>
      <div class="prop-row">
        <select id="propMaterial">
          ${['Plastic', 'Wood', 'Metal', 'Grass', 'Ice', 'Paint'].map(m =>
            `<option value="${m}" ${obj.userData.material === m ? 'selected' : ''}>${m}</option>`
          ).join('')}
        </select>
      </div>
    `;
    matGroup.querySelector('select').addEventListener('change', (e) => {
      obj.userData.material = e.target.value;
    });
    body.appendChild(matGroup);
    
    // Transparency
    const transGroup = document.createElement('div');
    transGroup.innerHTML = `
      <label class="prop-checkbox">
        <input type="checkbox" id="propTransparent"> Transparent
      </label>
    `;
    transGroup.querySelector('input').addEventListener('change', (e) => {
      if (obj.material) {
        obj.material.transparent = e.target.checked;
        obj.material.opacity = e.target.checked ? 0.5 : 1;
      }
    });
    body.appendChild(transGroup);
  }
  
  _populatePhysics(obj) {
    const body = this.groups.physics.body;
    
    const props = [
      { id: 'propAnchored', label: 'Anchored', key: 'anchored' },
      { id: 'propCanCollide', label: 'Can Collide', key: 'canCollide' }
    ];
    
    props.forEach(p => {
      const group = document.createElement('div');
      group.innerHTML = `
        <label class="prop-checkbox">
          <input type="checkbox" id="${p.id}" ${obj.userData[p.key] ? 'checked' : ''}> ${p.label}
        </label>
      `;
      group.querySelector('input').addEventListener('change', (e) => {
        obj.userData[p.key] = e.target.checked;
      });
      body.appendChild(group);
    });
  }
  
  _populateSurface(obj) {
    const body = this.groups.surface.body;
    const surfaces = ['Front', 'Back', 'Top', 'Bottom', 'Left', 'Right'];
    
    surfaces.forEach(surf => {
      const group = document.createElement('div');
      group.innerHTML = `
        <label class="prop-checkbox">
          <input type="checkbox"> ${surf}
        </label>
      `;
      body.appendChild(group);
    });
  }
  
  _filterProperties(search) {
    const groups = this.container.querySelectorAll('.prop-group');
    groups.forEach(group => {
      const labels = group.querySelectorAll('.prop-group-label, .prop-row span, .prop-checkbox');
      let visible = !search;
      if (search) {
        labels.forEach(label => {
          if (label.textContent.toLowerCase().includes(search.toLowerCase())) {
            visible = true;
          }
        });
      }
      group.style.display = visible ? 'block' : 'none';
    });
  }
}