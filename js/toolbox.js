export class ToolboxManager {
  constructor(app) {
    this.app = app;
    this.container = null;
    this.grid = null;
    this.categories = null;
    this.searchInput = null;
    this.currentCategory = 'All';
    this.assets = [];
    this._setup();
  }
  
  _setup() {
    this.container = document.createElement('div');
    this.container.className = 'toolbox-container';
    
    // Header tabs
    const tabs = document.createElement('div');
    tabs.className = 'toolbox-tabs';
    ['Store', 'My Assets'].forEach(name => {
      const tab = document.createElement('button');
      tab.className = `tb-tab${name === 'Store' ? ' active' : ''}`;
      tab.textContent = name;
      tab.addEventListener('click', () => {
        tabs.querySelectorAll('.tb-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        this._loadTab(name);
      });
      tabs.appendChild(tab);
    });
    this.container.appendChild(tabs);
    
    // Search
    const search = document.createElement('div');
    search.className = 'toolbox-search';
    this.searchInput = document.createElement('input');
    this.searchInput.type = 'text';
    this.searchInput.placeholder = '🔍 Search assets...';
    this.searchInput.addEventListener('input', () => this._filterAssets());
    search.appendChild(this.searchInput);
    this.container.appendChild(search);
    
    // Toolbar
    const toolbar = document.createElement('div');
    toolbar.className = 'toolbox-toolbar';
    
    const sortSelect = document.createElement('select');
    sortSelect.className = 'tb-sort-select';
    ['Popular', 'Newest', 'Recently Used', 'Name'].forEach(opt => {
      const option = document.createElement('option');
      option.value = opt.toLowerCase();
      option.textContent = `Sort: ${opt}`;
      sortSelect.appendChild(option);
    });
    sortSelect.addEventListener('change', () => this._filterAssets());
    toolbar.appendChild(sortSelect);
    
    const viewBtns = ['▦', '☷'];
    viewBtns.forEach((icon, i) => {
      const btn = document.createElement('button');
      btn.className = `tb-toolbar-btn${i === 0 ? ' active' : ''}`;
      btn.innerHTML = `<span class="icon">${icon}</span>`;
      btn.title = i === 0 ? 'Grid View' : 'List View';
      btn.addEventListener('click', () => {
        toolbar.querySelectorAll('.tb-toolbar-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this._setView(i === 0 ? 'grid' : 'list');
      });
      toolbar.appendChild(btn);
    });
    
    this.container.appendChild(toolbar);
    
    // Body
    const body = document.createElement('div');
    body.className = 'toolbox-body';
    
    // Categories
    const categories = document.createElement('div');
    categories.className = 'toolbox-categories';
    categories.innerHTML = `
      <button class="tb-cat-item active" data-category="All">All</button>
      <button class="tb-cat-item" data-category="Models">Models</button>
      <button class="tb-cat-item" data-category="Meshes">Meshes</button>
      <button class="tb-cat-item" data-category="Parts">Parts</button>
      <button class="tb-cat-item" data-category="Vehicles">Vehicles</button>
      <button class="tb-cat-item" data-category="Buildings">Buildings</button>
      <button class="tb-cat-item" data-category="Scripts">Scripts</button>
      <button class="tb-cat-item" data-category="Textures">Textures</button>
      <button class="tb-cat-item" data-category="Sounds">Sounds</button>
      <button class="tb-cat-item" data-category="Decals">Decals</button>
      <button class="tb-cat-item" data-category="UI">UI</button>
      <button class="tb-cat-item" data-category="Templates">Templates</button>
    `;
    categories.addEventListener('click', (e) => {
      const btn = e.target.closest('.tb-cat-item');
      if (!btn) return;
      categories.querySelectorAll('.tb-cat-item').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      this.currentCategory = btn.dataset.category;
      this._filterAssets();
    });
    this.categories = categories;
    body.appendChild(categories);
    
    // Grid
    const grid = document.createElement('div');
    grid.className = 'toolbox-grid';
    this.grid = grid;
    body.appendChild(grid);
    
    this.container.appendChild(body);
    
    // Load initial assets
    this._loadAssets();
  }
  
  getToolboxElement() {
    return this.container;
  }
  
  _loadTab(name) {
    if (name === 'Store') {
      this._loadStoreAssets();
    } else {
      this._loadMyAssets();
    }
  }
  
  _loadAssets() {
    // Load from toolbox.json structure
    const data = {
      categories: [
        { name: 'Models', assets: [
          { id: 'm_house', name: 'Simple House', thumbnail: '🏠', author: 'Vodevs' },
          { id: 'm_tree', name: 'Low Poly Tree', thumbnail: '🌳', author: 'BuildPro' }
        ]},
        { name: 'Meshes', assets: [
          { id: 'me_rock', name: 'Rock Cluster', thumbnail: '🪨', author: 'Vodevs' }
        ]},
        { name: 'Parts', assets: [
          { id: 'p_cube', name: 'Basic Cube', thumbnail: '📦', author: 'Vodevs' },
          { id: 'p_ramp', name: 'Ramp', thumbnail: '🪜', author: 'Vodevs' }
        ]}
      ]
    };
    
    this.assets = data.categories.flatMap(c => 
      c.assets.map(a => ({ ...a, category: c.name }))
    );
    this._renderAssets();
  }
  
  _loadStoreAssets() {
    // Load from marketplace
    const data = {
      categories: [
        { name: 'Featured', assets: [
          { id: 'mp_castle', name: 'Medieval Castle', thumbnail: '🏰', author: 'VodevsHQ' },
          { id: 'mp_spaceship', name: 'Spaceship Bridge', thumbnail: '🚀', author: 'DevMaster' }
        ]}
      ]
    };
    
    this.assets = data.categories.flatMap(c => 
      c.assets.map(a => ({ ...a, category: c.name }))
    );
    this._renderAssets();
  }
  
  _loadMyAssets() {
    this.assets = [
      { id: 'my_1', name: 'My Tower', thumbnail: '🏗️', author: 'Me', category: 'My Assets' },
      { id: 'my_2', name: 'Custom Car', thumbnail: '🚗', author: 'Me', category: 'My Assets' }
    ];
    this._renderAssets();
  }
  
  _renderAssets() {
    this.grid.innerHTML = '';
    const filtered = this._getFilteredAssets();
    
    if (filtered.length === 0) {
      const empty = document.createElement('div');
      empty.style.cssText = 'grid-column: 1/-1; text-align: center; color: var(--text-dim); padding: 30px;';
      empty.textContent = 'No assets found';
      this.grid.appendChild(empty);
      return;
    }
    
    filtered.forEach(asset => {
      const card = document.createElement('div');
      card.className = 'tb-asset-card';
      card.innerHTML = `
        <div class="tb-asset-thumb">${asset.thumbnail || '📦'}</div>
        <div class="tb-asset-name">${asset.name}</div>
        <div class="tb-asset-author">${asset.author || 'Vodevs'}</div>
      `;
      card.addEventListener('click', () => {
        this._insertAsset(asset);
      });
      card.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        if (this.app.contextMenuManager) {
          const items = [
            { label: 'Insert', action: () => this._insertAsset(asset) },
            { label: 'Favorite', action: () => this._favoriteAsset(asset) },
            { label: 'Delete', action: () => this._deleteAsset(asset) }
          ];
          this.app.contextMenuManager.show(e.clientX, e.clientY, items);
        }
      });
      this.grid.appendChild(card);
    });
  }
  
  _getFilteredAssets() {
    let filtered = this.assets;
    
    // Category filter
    if (this.currentCategory && this.currentCategory !== 'All') {
      filtered = filtered.filter(a => a.category === this.currentCategory);
    }
    
    // Search filter
    const search = this.searchInput.value.toLowerCase();
    if (search) {
      filtered = filtered.filter(a => 
        a.name.toLowerCase().includes(search) ||
        (a.author && a.author.toLowerCase().includes(search))
      );
    }
    
    // Sort
    const sort = this.container.querySelector('.tb-sort-select')?.value || 'popular';
    switch (sort) {
      case 'name':
        filtered.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case 'newest':
        filtered.sort((a, b) => (b.id || '').localeCompare(a.id || ''));
        break;
      default:
        // Keep as is
        break;
    }
    
    return filtered;
  }
  
  _filterAssets() {
    this._renderAssets();
  }
  
  _setView(mode) {
    this.grid.style.gridTemplateColumns = mode === 'grid' 
      ? 'repeat(auto-fill, minmax(80px, 1fr))'
      : '1fr';
    this.grid.querySelectorAll('.tb-asset-card').forEach(card => {
      if (mode === 'list') {
        card.style.display = 'flex';
        card.style.alignItems = 'center';
        card.style.gap = '8px';
        card.style.textAlign = 'left';
        card.querySelector('.tb-asset-thumb').style.height = '32px';
        card.querySelector('.tb-asset-thumb').style.width = '32px';
        card.querySelector('.tb-asset-thumb').style.flexShrink = '0';
      } else {
        card.style.display = 'block';
        card.style.textAlign = 'center';
        card.querySelector('.tb-asset-thumb').style.height = '44px';
        card.querySelector('.tb-asset-thumb').style.width = 'auto';
        card.querySelector('.tb-asset-thumb').style.flexShrink = 'unset';
      }
    });
  }
  
  _insertAsset(asset) {
    this.app.notify(`Inserting ${asset.name}...`, 'info');
    
    // Create a basic part as placeholder
    const group = this.app.getCurrentGroup();
    if (!group) {
      this.app.notify('No workspace to insert into', 'warn');
      return;
    }
    
    const part = new THREE.Mesh(
      new THREE.BoxGeometry(2, 2, 2),
      new THREE.MeshStandardMaterial({ color: 0x4488ff })
    );
    part.position.set(0, 1, 0);
    part.castShadow = true;
    part.receiveShadow = true;
    part.userData.className = 'Part';
    part.userData.partName = asset.name;
    part.userData.material = 'Plastic';
    part.userData.anchored = true;
    part.userData.canCollide = true;
    
    group.add(part);
    this.app.explorerManager.updateExplorer(group);
    this.app.setSelectedObject(part);
    this.app.notify(`Inserted ${asset.name}`, 'success');
  }
  
  _favoriteAsset(asset) {
    // Toggle favorite
    const favorites = JSON.parse(localStorage.getItem('vodevs_favorites') || '[]');
    const idx = favorites.indexOf(asset.id);
    if (idx >= 0) {
      favorites.splice(idx, 1);
      this.app.notify(`Removed ${asset.name} from favorites`, 'info');
    } else {
      favorites.push(asset.id);
      this.app.notify(`Added ${asset.name} to favorites`, 'success');
    }
    localStorage.setItem('vodevs_favorites', JSON.stringify(favorites));
  }
  
  _deleteAsset(asset) {
    if (confirm(`Delete ${asset.name}?`)) {
      this.assets = this.assets.filter(a => a.id !== asset.id);
      this._renderAssets();
      this.app.notify(`Deleted ${asset.name}`, 'info');
    }
  }
}