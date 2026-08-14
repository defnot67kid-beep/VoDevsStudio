export class DockManager {
  constructor(app) {
    this.app = app;
    this.panels = new Map();
    this.layout = {
      root: null,
      panels: {}
    };
    this.draggingPanel = null;
    this.dragGhost = null;
    this.dragIndicators = [];
    this.isDragging = false;
    this.currentPanelId = 0;
    this._init();
  }
  
  _init() {
    this._createDockContainer();
    this._createDragIndicators();
    this._setupGlobalListeners();
  }
  
  _createDockContainer() {
    const container = document.getElementById('dock-container');
    this.container = container;
    this.root = this._createLayoutNode('root', 'row');
    container.appendChild(this.root.element);
  }
  
  _createLayoutNode(id, direction = 'row', size = null) {
    const element = document.createElement('div');
    element.className = `dock-layout ${direction}`;
    element.dataset.dockId = id;
    if (size !== null) {
      if (direction === 'row') element.style.flex = size;
      else element.style.flex = size;
    }
    return {
      id,
      direction,
      element,
      children: [],
      size,
      parent: null
    };
  }
  
  _createDragIndicators() {
    const positions = ['left', 'right', 'top', 'bottom', 'center'];
    positions.forEach(pos => {
      const indicator = document.createElement('div');
      indicator.className = `dock-indicator ${pos}`;
      document.body.appendChild(indicator);
      this.dragIndicators.push(indicator);
    });
  }
  
  _setupGlobalListeners() {
    document.addEventListener('mousemove', this._onDragMove.bind(this));
    document.addEventListener('mouseup', this._onDragEnd.bind(this));
    document.addEventListener('keydown', this._onKeyDown.bind(this));
  }
  
  registerPanel(id, config) {
    if (this.panels.has(id)) {
      console.warn(`Panel ${id} already registered`);
      return;
    }
    
    const panel = {
      id,
      title: config.title || id,
      component: config.component,
      canClose: config.canClose !== false,
      canFloat: config.canFloat !== false,
      defaultZone: config.defaultZone || 'center',
      config,
      state: {
        docked: true,
        zone: config.defaultZone || 'center',
        floating: false,
        position: null,
        size: config.defaultSize || { width: 300, height: 250 },
        minimized: false,
        closed: false,
        tabGroup: null,
        active: false
      }
    };
    
    this.panels.set(id, panel);
    this._createPanelElement(panel);
    
    // Dock to default zone
    this._dockPanel(id, config.defaultZone || 'center');
    
    return panel;
  }
  
  _createPanelElement(panel) {
    const element = document.createElement('div');
    element.className = 'dock-panel';
    element.dataset.panelId = panel.id;
    
    // Header
    const header = document.createElement('div');
    header.className = 'dock-panel-header';
    
    const title = document.createElement('span');
    title.className = 'dock-panel-title';
    title.textContent = panel.title;
    header.appendChild(title);
    
    // Actions
    const actions = document.createElement('div');
    actions.className = 'dock-panel-actions';
    
    // Collapse button
    const collapseBtn = document.createElement('button');
    collapseBtn.className = 'dock-panel-action';
    collapseBtn.textContent = '−';
    collapseBtn.title = 'Collapse';
    collapseBtn.addEventListener('click', () => {
      this._toggleCollapse(panel.id);
    });
    actions.appendChild(collapseBtn);
    
    // Float/undock button
    const floatBtn = document.createElement('button');
    floatBtn.className = 'dock-panel-action';
    floatBtn.textContent = '⛶';
    floatBtn.title = 'Float';
    floatBtn.addEventListener('click', () => {
      if (panel.state.floating) {
        this._dockPanel(panel.id, panel.state.zone || 'center');
      } else {
        this._floatPanel(panel.id);
      }
    });
    actions.appendChild(floatBtn);
    
    // Three-dot menu
    const menuBtn = document.createElement('button');
    menuBtn.className = 'dock-panel-action';
    menuBtn.textContent = '⋮';
    menuBtn.title = 'Menu';
    menuBtn.addEventListener('click', (e) => {
      this._showPanelMenu(panel.id, e);
    });
    actions.appendChild(menuBtn);
    
    // Close button
    if (panel.canClose) {
      const closeBtn = document.createElement('button');
      closeBtn.className = 'dock-panel-action close';
      closeBtn.textContent = '✕';
      closeBtn.title = 'Close';
      closeBtn.addEventListener('click', () => {
        this._closePanel(panel.id);
      });
      actions.appendChild(closeBtn);
    }
    
    header.appendChild(actions);
    element.appendChild(header);
    
    // Body
    const body = document.createElement('div');
    body.className = 'dock-panel-body';
    body.appendChild(panel.component);
    element.appendChild(body);
    
    // Drag handle
    header.addEventListener('mousedown', (e) => {
      if (e.target.closest('.dock-panel-action')) return;
      this._startDrag(panel.id, e);
    });
    
    panel.element = element;
    panel.header = header;
    panel.body = body;
    panel.titleEl = title;
    panel.collapseBtn = collapseBtn;
    panel.floatBtn = floatBtn;
    panel.menuBtn = menuBtn;
  }
  
  _dockPanel(id, zone, targetId = null) {
    const panel = this.panels.get(id);
    if (!panel) return;
    
    if (panel.state.floating) {
      this._removeFloatingPanel(id);
    }
    
    panel.state.docked = true;
    panel.state.floating = false;
    panel.state.zone = zone;
    panel.state.closed = false;
    
    // Remove from current parent
    if (panel.element.parentNode) {
      panel.element.parentNode.removeChild(panel.element);
    }
    
    // Find or create zone
    let zoneContainer = this._getZoneContainer(zone, targetId);
    if (!zoneContainer) {
      zoneContainer = this._createZoneContainer(zone);
    }
    
    // Add panel to zone
    if (zoneContainer._isTabGroup) {
      // Add as tab
      this._addTabToGroup(id, zoneContainer);
    } else {
      zoneContainer.appendChild(panel.element);
      panel.element.style.flex = '1';
      panel.element.classList.add('docked');
      panel.element.classList.remove('floating');
    }
    
    this._updatePanelState(id);
    this._saveLayout();
    this._triggerResize();
  }
  
  _floatPanel(id) {
    const panel = this.panels.get(id);
    if (!panel || !panel.canFloat) return;
    
    // Remove from current parent
    if (panel.element.parentNode) {
      panel.element.parentNode.removeChild(panel.element);
    }
    
    panel.state.docked = false;
    panel.state.floating = true;
    panel.state.closed = false;
    
    // Position floating window
    const rect = panel.element.getBoundingClientRect();
    const x = rect.left || 100;
    const y = rect.top || 100;
    const w = panel.state.size?.width || 300;
    const h = panel.state.size?.height || 250;
    
    panel.element.classList.remove('docked');
    panel.element.classList.add('floating');
    panel.element.style.left = x + 'px';
    panel.element.style.top = y + 'px';
    panel.element.style.width = w + 'px';
    panel.element.style.height = h + 'px';
    panel.element.style.position = 'fixed';
    panel.element.style.zIndex = '100';
    
    document.body.appendChild(panel.element);
    
    // Add resize handles
    this._addResizeHandles(panel);
    
    // Bring to front
    this._bringToFront(id);
    
    this._updatePanelState(id);
    this._saveLayout();
    this._triggerResize();
  }
  
  _addResizeHandles(panel) {
    const directions = ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'];
    directions.forEach(dir => {
      const handle = document.createElement('div');
      handle.className = `resize-handle ${dir}`;
      handle.dataset.direction = dir;
      handle.addEventListener('mousedown', (e) => {
        this._startResize(panel.id, dir, e);
      });
      panel.element.appendChild(handle);
    });
  }
  
  _startResize(panelId, direction, e) {
    e.preventDefault();
    const panel = this.panels.get(panelId);
    if (!panel) return;
    
    this.resizeData = {
      panelId,
      direction,
      startX: e.clientX,
      startY: e.clientY,
      startWidth: panel.element.offsetWidth,
      startHeight: panel.element.offsetHeight,
      startLeft: panel.element.offsetLeft,
      startTop: panel.element.offsetTop
    };
    
    document.body.style.cursor = this._getResizeCursor(direction);
    document.body.style.pointerEvents = 'none';
    
    document.addEventListener('mousemove', this._onResizeMove.bind(this));
    document.addEventListener('mouseup', this._onResizeEnd.bind(this));
  }
  
  _onResizeMove(e) {
    if (!this.resizeData) return;
    const data = this.resizeData;
    const panel = this.panels.get(data.panelId);
    if (!panel) return;
    
    const dx = e.clientX - data.startX;
    const dy = e.clientY - data.startY;
    const dir = data.direction;
    
    let newWidth = data.startWidth;
    let newHeight = data.startHeight;
    let newLeft = data.startLeft;
    let newTop = data.startTop;
    
    if (dir.includes('e')) newWidth = Math.max(200, data.startWidth + dx);
    if (dir.includes('w')) {
      newWidth = Math.max(200, data.startWidth - dx);
      newLeft = data.startLeft + (data.startWidth - newWidth);
    }
    if (dir.includes('s')) newHeight = Math.max(150, data.startHeight + dy);
    if (dir.includes('n')) {
      newHeight = Math.max(150, data.startHeight - dy);
      newTop = data.startTop + (data.startHeight - newHeight);
    }
    
    panel.element.style.width = newWidth + 'px';
    panel.element.style.height = newHeight + 'px';
    panel.element.style.left = newLeft + 'px';
    panel.element.style.top = newTop + 'px';
    
    panel.state.size = { width: newWidth, height: newHeight };
  }
  
  _onResizeEnd(e) {
    document.removeEventListener('mousemove', this._onResizeMove.bind(this));
    document.removeEventListener('mouseup', this._onResizeEnd.bind(this));
    document.body.style.cursor = '';
    document.body.style.pointerEvents = '';
    this.resizeData = null;
    this._saveLayout();
  }
  
  _getResizeCursor(dir) {
    const map = {
      'n': 'ns-resize', 's': 'ns-resize',
      'e': 'ew-resize', 'w': 'ew-resize',
      'ne': 'nesw-resize', 'sw': 'nesw-resize',
      'nw': 'nwse-resize', 'se': 'nwse-resize'
    };
    return map[dir] || 'default';
  }
  
  _startDrag(panelId, e) {
    const panel = this.panels.get(panelId);
    if (!panel) return;
    
    // Don't drag if panel is docked and we want to prevent accidental drag
    if (panel.state.docked && !panel.state.floating) {
      // Allow drag from docked panels too
    }
    
    this.isDragging = true;
    this.draggingPanel = panelId;
    
    const rect = panel.element.getBoundingClientRect();
    
    // Create ghost
    this.dragGhost = document.createElement('div');
    this.dragGhost.className = 'dock-ghost';
    this.dragGhost.textContent = panel.title;
    this.dragGhost.style.width = rect.width + 'px';
    this.dragGhost.style.height = rect.height + 'px';
    this.dragGhost.style.left = e.clientX - rect.width / 2 + 'px';
    this.dragGhost.style.top = e.clientY - 20 + 'px';
    document.body.appendChild(this.dragGhost);
    
    // Show indicators
    this.dragIndicators.forEach(ind => ind.classList.add('active'));
    
    // Remove panel from current position if floating or docked
    if (panel.state.floating) {
      panel.element.style.display = 'none';
    } else {
      // Hide the panel but keep placeholder
      panel.element.style.opacity = '0.3';
    }
  }
  
  _onDragMove(e) {
    if (!this.isDragging || !this.dragGhost) return;
    
    const panelId = this.draggingPanel;
    const panel = this.panels.get(panelId);
    if (!panel) return;
    
    // Update ghost position
    const rect = this.dragGhost.getBoundingClientRect();
    this.dragGhost.style.left = e.clientX - rect.width / 2 + 'px';
    this.dragGhost.style.top = e.clientY - 20 + 'px';
    
    // Check for docking zones
    const zone = this._detectDropZone(e.clientX, e.clientY);
    
    // Update indicators
    this.dragIndicators.forEach(ind => {
      ind.classList.toggle('highlight', ind.dataset.zone === zone);
    });
  }
  
  _onDragEnd(e) {
    if (!this.isDragging) return;
    
    const panelId = this.draggingPanel;
    const panel = this.panels.get(panelId);
    
    // Remove ghost
    if (this.dragGhost) {
      document.body.removeChild(this.dragGhost);
      this.dragGhost = null;
    }
    
    // Hide indicators
    this.dragIndicators.forEach(ind => ind.classList.remove('active', 'highlight'));
    
    // Determine drop zone
    const zone = this._detectDropZone(e.clientX, e.clientY);
    
    if (zone && panel) {
      // Dock to zone
      if (zone === 'float') {
        this._floatPanel(panelId);
      } else {
        this._dockPanel(panelId, zone);
      }
    } else if (panel) {
      // Drop without docking - float at drop position
      if (panel.state.docked) {
        this._floatPanel(panelId);
      }
      // Position floating
      if (panel.state.floating) {
        panel.element.style.display = 'block';
        const rect = panel.element.getBoundingClientRect();
        panel.element.style.left = e.clientX - rect.width / 2 + 'px';
        panel.element.style.top = e.clientY - 20 + 'px';
      }
    }
    
    // Restore panel visibility
    if (panel) {
      panel.element.style.opacity = '1';
      panel.element.style.display = 'block';
    }
    
    this.isDragging = false;
    this.draggingPanel = null;
    this._saveLayout();
  }
  
  _detectDropZone(x, y) {
    const container = this.container;
    const rect = container.getBoundingClientRect();
    
    // Check if inside container
    if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) {
      return 'float';
    }
    
    const relX = (x - rect.left) / rect.width;
    const relY = (y - rect.top) / rect.height;
    const threshold = 0.25;
    
    // Top
    if (relY < threshold) return 'top';
    // Bottom
    if (relY > 1 - threshold) return 'bottom';
    // Left
    if (relX < threshold) return 'left';
    // Right
    if (relX > 1 - threshold) return 'right';
    // Center
    return 'center';
  }
  
  _getZoneContainer(zone, targetId = null) {
    // Find existing zone container
    const containers = this.root.element.querySelectorAll('.dock-layout');
    for (const container of containers) {
      if (container.dataset.zone === zone) {
        return container;
      }
    }
    return null;
  }
  
  _createZoneContainer(zone) {
    const container = document.createElement('div');
    container.className = 'dock-layout column';
    container.dataset.zone = zone;
    container.style.flex = '1';
    container.style.minHeight = '0';
    container.style.minWidth = '0';
    container.style.display = 'flex';
    container.style.flexDirection = 'column';
    
    // Add to appropriate parent
    const parent = this._getParentForZone(zone);
    parent.appendChild(container);
    return container;
  }
  
  _getParentForZone(zone) {
    // Simplified: add all zones to root
    return this.root.element;
  }
  
  _addTabToGroup(panelId, groupContainer) {
    const panel = this.panels.get(panelId);
    if (!panel) return;
    
    // Create tab group if needed
    if (!groupContainer._tabGroup) {
      this._createTabGroup(groupContainer);
    }
    
    const tabGroup = groupContainer._tabGroup;
    tabGroup.panels.push(panelId);
    
    // Add tab button
    const tabBtn = document.createElement('button');
    tabBtn.className = 'dock-group-tab active';
    tabBtn.textContent = panel.title;
    tabBtn.addEventListener('click', () => {
      this._activateTab(panelId, tabGroup);
    });
    tabGroup.tabsContainer.appendChild(tabBtn);
    
    // Show panel content
    const contentContainer = tabGroup.contentContainer;
    contentContainer.appendChild(panel.element);
    panel.element.style.display = 'flex';
    panel.element.style.flex = '1';
    
    this._activateTab(panelId, tabGroup);
  }
  
  _createTabGroup(container) {
    const group = document.createElement('div');
    group.className = 'dock-group';
    group.style.flex = '1';
    group.style.display = 'flex';
    group.style.flexDirection = 'column';
    group.style.minHeight = '0';
    
    const tabs = document.createElement('div');
    tabs.className = 'dock-group-tabs';
    group.appendChild(tabs);
    
    const content = document.createElement('div');
    content.className = 'dock-group-content';
    group.appendChild(content);
    
    container.appendChild(group);
    container._tabGroup = {
      container: group,
      tabsContainer: tabs,
      contentContainer: content,
      panels: [],
      activePanel: null
    };
  }
  
  _activateTab(panelId, tabGroup) {
    // Hide all panels
    tabGroup.contentContainer.querySelectorAll('.dock-panel').forEach(el => {
      el.style.display = 'none';
    });
    
    // Show selected panel
    const panel = this.panels.get(panelId);
    if (panel) {
      panel.element.style.display = 'flex';
      panel.element.style.flex = '1';
      tabGroup.activePanel = panelId;
    }
    
    // Update tab buttons
    tabGroup.tabsContainer.querySelectorAll('.dock-group-tab').forEach((btn, idx) => {
      btn.classList.toggle('active', idx === tabGroup.panels.indexOf(panelId));
    });
  }
  
  _toggleCollapse(id) {
    const panel = this.panels.get(id);
    if (!panel) return;
    
    panel.state.minimized = !panel.state.minimized;
    if (panel.state.minimized) {
      panel.body.style.display = 'none';
      panel.collapseBtn.textContent = '+';
    } else {
      panel.body.style.display = 'flex';
      panel.collapseBtn.textContent = '−';
    }
    this._saveLayout();
    this._triggerResize();
  }
  
  _closePanel(id) {
    const panel = this.panels.get(id);
    if (!panel || !panel.canClose) return;
    
    panel.state.closed = true;
    panel.element.style.display = 'none';
    this._saveLayout();
    this._triggerResize();
  }
  
  _showPanelMenu(panelId, e) {
    e.stopPropagation();
    const panel = this.panels.get(panelId);
    if (!panel) return;
    
    // Use context menu system
    const menuItems = [
      { label: 'Dock', submenu: [
        { label: 'Left', action: () => this._dockPanel(panelId, 'left') },
        { label: 'Right', action: () => this._dockPanel(panelId, 'right') },
        { label: 'Top', action: () => this._dockPanel(panelId, 'top') },
        { label: 'Bottom', action: () => this._dockPanel(panelId, 'bottom') }
      ]},
      { label: 'Float', action: () => this._floatPanel(panelId) },
      { label: 'Close', action: () => this._closePanel(panelId) },
      { label: 'Reset Position', action: () => this._resetPanel(panelId) }
    ];
    
    // Use app's context menu manager
    if (this.app.contextMenuManager) {
      this.app.contextMenuManager.show(e.clientX, e.clientY, menuItems);
    }
  }
  
  _resetPanel(id) {
    const panel = this.panels.get(id);
    if (!panel) return;
    
    // Remove from current location
    if (panel.element.parentNode) {
      panel.element.parentNode.removeChild(panel.element);
    }
    
    panel.state = {
      docked: true,
      zone: panel.defaultZone || 'center',
      floating: false,
      position: null,
      size: { width: 300, height: 250 },
      minimized: false,
      closed: false,
      tabGroup: null,
      active: false
    };
    
    this._dockPanel(id, panel.defaultZone || 'center');
    this._saveLayout();
  }
  
  _removeFloatingPanel(id) {
    const panel = this.panels.get(id);
    if (!panel) return;
    
    panel.element.classList.remove('floating');
    panel.element.style.position = '';
    panel.element.style.left = '';
    panel.element.style.top = '';
    panel.element.style.width = '';
    panel.element.style.height = '';
    panel.element.style.zIndex = '';
    
    // Remove resize handles
    panel.element.querySelectorAll('.resize-handle').forEach(el => el.remove());
  }
  
  _bringToFront(id) {
    const panel = this.panels.get(id);
    if (!panel || !panel.state.floating) return;
    
    // Get max z-index among floating panels
    let maxZ = 100;
    this.panels.forEach(p => {
      if (p.state.floating && p.element.style.zIndex) {
        const z = parseInt(p.element.style.zIndex) || 100;
        if (z > maxZ) maxZ = z;
      }
    });
    panel.element.style.zIndex = maxZ + 1;
  }
  
  _updatePanelState(id) {
    const panel = this.panels.get(id);
    if (!panel) return;
    
    // Update float button
    if (panel.floatBtn) {
      panel.floatBtn.textContent = panel.state.floating ? '⛶' : '⛶';
      panel.floatBtn.title = panel.state.floating ? 'Dock' : 'Float';
    }
  }
  
  _triggerResize() {
    // Trigger resize event for viewport and other panels
    window.dispatchEvent(new Event('resize'));
    if (this.app.viewportManager) {
      this.app.viewportManager.resize();
    }
  }
  
  // Layout persistence
  _saveLayout() {
    const state = {};
    this.panels.forEach((panel, id) => {
      state[id] = {
        docked: panel.state.docked,
        floating: panel.state.floating,
        zone: panel.state.zone,
        closed: panel.state.closed,
        minimized: panel.state.minimized
      };
      if (panel.state.floating) {
        const rect = panel.element.getBoundingClientRect();
        state[id].position = { left: rect.left, top: rect.top };
        state[id].size = { width: rect.width, height: rect.height };
      }
      if (panel.state.docked && panel.element.parentNode) {
        const parent = panel.element.parentNode;
        if (parent.dataset && parent.dataset.zone) {
          state[id].zone = parent.dataset.zone;
        }
      }
    });
    
    try {
      localStorage.setItem('vodevs_layout', JSON.stringify(state));
    } catch (e) {
      console.warn('Failed to save layout:', e);
    }
  }
  
  restoreLayout() {
    try {
      const saved = localStorage.getItem('vodevs_layout');
      if (!saved) return;
      
      const state = JSON.parse(saved);
      this.panels.forEach((panel, id) => {
        if (state[id]) {
          const s = state[id];
          if (s.closed) {
            panel.state.closed = true;
            panel.element.style.display = 'none';
          } else if (s.floating) {
            this._floatPanel(id);
            if (s.position) {
              panel.element.style.left = s.position.left + 'px';
              panel.element.style.top = s.position.top + 'px';
            }
            if (s.size) {
              panel.element.style.width = s.size.width + 'px';
              panel.element.style.height = s.size.height + 'px';
              panel.state.size = s.size;
            }
          } else if (s.docked) {
            this._dockPanel(id, s.zone || panel.defaultZone || 'center');
            if (s.minimized) {
              this._toggleCollapse(id);
            }
          }
        }
      });
    } catch (e) {
      console.warn('Failed to restore layout:', e);
      this.resetLayout();
    }
  }
  
  resetLayout() {
    localStorage.removeItem('vodevs_layout');
    // Reset all panels to default
    this.panels.forEach((panel, id) => {
      if (panel.element.parentNode) {
        panel.element.parentNode.removeChild(panel.element);
      }
      panel.state = {
        docked: true,
        zone: panel.defaultZone || 'center',
        floating: false,
        position: null,
        size: { width: 300, height: 250 },
        minimized: false,
        closed: false,
        tabGroup: null,
        active: false
      };
      panel.element.style.display = 'flex';
      panel.element.classList.remove('floating');
      panel.element.classList.add('docked');
      panel.element.style.position = '';
      panel.element.style.left = '';
      panel.element.style.top = '';
      panel.element.style.width = '';
      panel.element.style.height = '';
      
      // Clear container
      this.container.innerHTML = '';
      this.root = this._createLayoutNode('root', 'row');
      this.container.appendChild(this.root.element);
      
      // Redock
      this._dockPanel(id, panel.defaultZone || 'center');
    });
    
    this._triggerResize();
  }
  
  getPanel(id) {
    return this.panels.get(id);
  }
  
  getPanelState(id) {
    const panel = this.panels.get(id);
    return panel ? panel.state : null;
  }
  
  _onKeyDown(e) {
    if (e.key === 'Escape' && this.isDragging) {
      this._onDragEnd(e);
    }
  }
}