export class ExplorerManager {
  constructor(app) {
    this.app = app;
    this.container = null;
    this.treeContainer = null;
    this.searchInput = null;
    this.currentGroup = null;
    this._setup();
  }
  
  _setup() {
    this.container = document.createElement('div');
    this.container.className = 'explorer-container';
    
    // Toolbar
    const toolbar = document.createElement('div');
    toolbar.className = 'explorer-toolbar';
    
    const addBtn = document.createElement('button');
    addBtn.textContent = '+ Add';
    addBtn.addEventListener('click', () => this._addObject());
    toolbar.appendChild(addBtn);
    
    const folderBtn = document.createElement('button');
    folderBtn.textContent = '📁';
    folderBtn.title = 'Create Folder';
    folderBtn.addEventListener('click', () => this._createFolder());
    toolbar.appendChild(folderBtn);
    
    const expandBtn = document.createElement('button');
    expandBtn.textContent = '↕';
    expandBtn.title = 'Expand All';
    expandBtn.addEventListener('click', () => this._expandAll());
    toolbar.appendChild(expandBtn);
    
    this.container.appendChild(toolbar);
    
    // Search
    const search = document.createElement('div');
    search.className = 'explorer-search';
    this.searchInput = document.createElement('input');
    this.searchInput.type = 'text';
    this.searchInput.placeholder = 'Search Workspace...';
    this.searchInput.addEventListener('input', () => this.updateExplorer(this.currentGroup));
    search.appendChild(this.searchInput);
    this.container.appendChild(search);
    
    // Tree
    this.treeContainer = document.createElement('div');
    this.treeContainer.className = 'explorer-tree';
    this.container.appendChild(this.treeContainer);
  }
  
  getExplorerElement() {
    return this.container;
  }
  
  updateExplorer(group) {
    this.currentGroup = group;
    this.treeContainer.innerHTML = '';
    
    if (!group) {
      this._renderEmpty();
      return;
    }
    
    const ul = document.createElement('ul');
    const rootLi = document.createElement('li');
    rootLi.innerHTML = '<span class="arrow">▼</span> Workspace';
    rootLi.style.fontWeight = '700';
    ul.appendChild(rootLi);
    
    const nestedUl = document.createElement('ul');
    nestedUl.className = 'nested';
    
    const searchTerm = this.searchInput.value.toLowerCase();
    const items = this._filterItems(group.children, searchTerm);
    
    items.forEach((obj, index) => {
      const li = this._createItem(obj, index);
      nestedUl.appendChild(li);
    });
    
    rootLi.appendChild(nestedUl);
    this.treeContainer.appendChild(ul);
    
    // Update status
    this.app._updateStatusBar();
  }
  
  _renderEmpty() {
    const div = document.createElement('div');
    div.style.cssText = 'text-align: center; color: var(--text-dim); padding: 20px;';
    div.textContent = 'No model loaded. Import a model or create a part.';
    this.treeContainer.appendChild(div);
  }
  
  _filterItems(children, term) {
    if (!term) return children;
    return Array.from(children).filter(obj => {
      const name = obj.userData.partName || obj.userData.className || 'Part';
      return name.toLowerCase().includes(term);
    });
  }
  
  _createItem(obj, index) {
    const li = document.createElement('li');
    const name = obj.userData.partName || obj.userData.className || `Part ${index}`;
    let icon = '📦';
    if (obj.userData.className === 'Model') icon = '🧩';
    else if (obj.userData.className === 'Folder') icon = '📁';
    
    li.innerHTML = `
      <span class="explorer-icon">${icon}</span>
      <span class="explorer-label">${name}</span>
      <span class="explorer-toggle">
        <button title="Toggle visibility">👁</button>
        <button title="Toggle lock">🔓</button>
      </span>
    `;
    
    li.dataset.index = index;
    li.addEventListener('click', () => {
      this.app.setSelectedObject(obj);
    });
    li.addEventListener('dblclick', () => {
      const newName = prompt('Rename:', name);
      if (newName) {
        obj.userData.partName = newName;
        this.updateExplorer(this.currentGroup);
        this.app.notify(`Renamed to ${newName}`, 'info');
      }
    });
    
    const selected = this.app.getSelectedObject();
    if (selected === obj) li.classList.add('selected');
    
    // Context menu
    li.addEventListener('contextmenu', (e) => {
      e.stopPropagation();
      if (this.app.contextMenuManager) {
        const items = [
          { label: 'Rename', action: () => {
            const newName = prompt('Rename:', name);
            if (newName) { obj.userData.partName = newName; this.updateExplorer(this.currentGroup); }
          }},
          { label: 'Duplicate', action: () => this._duplicateObject(obj) },
          { label: 'Delete', action: () => this._deleteObject(obj) },
          { label: 'Focus', action: () => {
            if (this.app.viewportManager) {
              this.app.viewportManager._focusObject(obj);
            }
          }}
        ];
        this.app.contextMenuManager.show(e.clientX, e.clientY, items);
      }
    });
    
    return li;
  }
  
  _addObject() {
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
    if (part.userData.material === undefined) part.userData.material = 'Plastic';
    if (part.userData.anchored === undefined) part.userData.anchored = true;
    if (part.userData.canCollide === undefined) part.userData.canCollide = true;
    
    group.add(part);
    this.updateExplorer(group);
    this.app.setSelectedObject(part);
    this.app.notify('Added Part', 'info');
  }
  
  _createFolder() {
    const group = this.app.getCurrentGroup();
    if (!group) {
      this.app.notify('No workspace to add to', 'warn');
      return;
    }
    
    // Create a group as folder
    const folder = new THREE.Group();
    folder.userData.className = 'Folder';
    folder.userData.partName = 'Folder';
    group.add(folder);
    this.updateExplorer(group);
    this.app.notify('Created Folder', 'info');
  }
  
  _duplicateObject(obj) {
    const group = this.app.getCurrentGroup();
    if (!group) return;
    
    const copy = obj.clone(true);
    copy.userData = JSON.parse(JSON.stringify(obj.userData || {}));
    copy.position.x += 1.5;
    group.add(copy);
    this.updateExplorer(group);
    this.app.setSelectedObject(copy);
    this.app.notify('Duplicated object', 'info');
  }
  
  _deleteObject(obj) {
    const group = this.app.getCurrentGroup();
    if (!group) return;
    
    group.remove(obj);
    if (obj.geometry) obj.geometry.dispose();
    if (obj.material) {
      if (Array.isArray(obj.material)) obj.material.forEach(m => m.dispose());
      else obj.material.dispose();
    }
    if (this.app.getSelectedObject() === obj) {
      this.app.setSelectedObject(null);
    }
    this.updateExplorer(group);
    this.app.notify('Deleted object', 'info');
  }
  
  _expandAll() {
    // Expand all tree nodes
    this.treeContainer.querySelectorAll('.nested').forEach(el => {
      el.style.display = 'block';
    });
    this.treeContainer.querySelectorAll('.arrow').forEach(el => {
      el.textContent = '▼';
    });
  }
}