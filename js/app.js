import { DockManager } from './docking.js';
import { ViewportManager } from './viewport.js';
import { ExplorerManager } from './explorer.js';
import { PropertiesManager } from './properties.js';
import { ToolboxManager } from './toolbox.js';
import { RibbonManager } from './ribbon.js';
import { ContextMenuManager } from './context-menu.js';
import { HistoryManager } from './history.js';
import { ShortcutManager } from './shortcuts.js';
import { NotificationManager } from './notifications.js';

class VodevsApp {
  constructor() {
    this.dockManager = new DockManager(this);
    this.viewportManager = new ViewportManager(this);
    this.explorerManager = new ExplorerManager(this);
    this.propertiesManager = new PropertiesManager(this);
    this.toolboxManager = new ToolboxManager(this);
    this.ribbonManager = new RibbonManager(this);
    this.contextMenuManager = new ContextMenuManager(this);
    this.historyManager = new HistoryManager(this);
    this.shortcutManager = new ShortcutManager(this);
    this.notificationManager = new NotificationManager();
    
    this.selectedObject = null;
    this.currentGroup = null;
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.orbitControls = null;
    this.transformControls = null;
    
    this._init();
  }
  
  _init() {
    // Initialize managers
    this.ribbonManager.init();
    this.shortcutManager.init();
    
    // Register panels with dock manager
    this._registerPanels();
    
    // Restore layout
    this.dockManager.restoreLayout();
    
    // Setup viewport
    this.viewportManager.setupViewport();
    
    console.log('Vodevs Studio initialized');
  }
  
  _registerPanels() {
    this.dockManager.registerPanel('viewport', {
      title: 'Viewport',
      component: this.viewportManager.getViewportElement(),
      canClose: false,
      canFloat: false,
      defaultZone: 'center'
    });
    
    this.dockManager.registerPanel('explorer', {
      title: 'Explorer',
      component: this.explorerManager.getExplorerElement(),
      canClose: true,
      canFloat: true,
      defaultZone: 'left'
    });
    
    this.dockManager.registerPanel('properties', {
      title: 'Properties',
      component: this.propertiesManager.getPropertiesElement(),
      canClose: true,
      canFloat: true,
      defaultZone: 'right'
    });
    
    this.dockManager.registerPanel('toolbox', {
      title: 'Toolbox',
      component: this.toolboxManager.getToolboxElement(),
      canClose: true,
      canFloat: true,
      defaultZone: 'left'
    });
    
    this.dockManager.registerPanel('output', {
      title: 'Output',
      component: this._createOutputPanel(),
      canClose: true,
      canFloat: true,
      defaultZone: 'bottom'
    });
    
    this.dockManager.registerPanel('scriptEditor', {
      title: 'Script Editor',
      component: this._createScriptEditorPanel(),
      canClose: true,
      canFloat: true,
      defaultZone: 'bottom'
    });
  }
  
  _createOutputPanel() {
    const container = document.createElement('div');
    container.className = 'output-container';
    container.style.cssText = `
      display: flex; flex-direction: column; height: 100%; padding: 4px 8px;
      font-family: Consolas, monospace; font-size: 12px; color: var(--text-muted);
      background: #0a0c10; overflow-y: auto;
    `;
    
    // Toolbar
    const toolbar = document.createElement('div');
    toolbar.style.cssText = `
      display: flex; align-items: center; gap: 8px;
      padding: 4px 0; border-bottom: 1px solid var(--border);
      flex-shrink: 0;
    `;
    
    const clearBtn = document.createElement('button');
    clearBtn.textContent = 'Clear';
    clearBtn.style.cssText = 'background: var(--panel); border: 1px solid var(--border); color: var(--text); padding: 2px 8px; border-radius: var(--radius); font-size: 11px;';
    clearBtn.addEventListener('click', () => {
      container.querySelectorAll('.log-line').forEach(el => el.remove());
    });
    toolbar.appendChild(clearBtn);
    
    // Filter buttons
    ['Info', 'Warning', 'Error', 'Debug'].forEach(type => {
      const btn = document.createElement('button');
      btn.textContent = type;
      btn.dataset.filter = type.toLowerCase();
      btn.style.cssText = 'background: transparent; border: none; color: var(--text-dim); padding: 2px 6px; font-size: 11px;';
      btn.addEventListener('click', () => {
        btn.classList.toggle('active');
        _applyFilters();
      });
      toolbar.appendChild(btn);
    });
    
    container.appendChild(toolbar);
    
    const logArea = document.createElement('div');
    logArea.style.cssText = 'flex: 1; overflow-y: auto; padding-top: 4px;';
    container.appendChild(logArea);
    
    // Log method
    container.log = (msg, type = 'info') => {
      const line = document.createElement('div');
      line.className = `log-line ${type}`;
      const timestamp = new Date().toLocaleTimeString();
      line.textContent = `[${timestamp}] ${msg}`;
      line.style.cssText = `
        padding: 1px 0;
        ${type === 'error' ? 'color: #ff6b6b;' : ''}
        ${type === 'warn' ? 'color: #ffd93d;' : ''}
        ${type === 'info' ? 'color: #6bcbff;' : ''}
        ${type === 'debug' ? 'color: #8a8fa8;' : ''}
      `;
      logArea.appendChild(line);
      logArea.scrollTop = logArea.scrollHeight;
    };
    
    container.log('Vodevs Studio initialized', 'info');
    container.log('Ready for imports', 'info');
    
    function _applyFilters() {
      const filters = new Set();
      toolbar.querySelectorAll('[data-filter].active').forEach(btn => filters.add(btn.dataset.filter));
      logArea.querySelectorAll('.log-line').forEach(line => {
        let show = true;
        if (filters.size > 0) {
          const type = line.className.split(' ')[1] || 'info';
          show = filters.has(type);
        }
        line.style.display = show ? 'block' : 'none';
      });
    }
    
    return container;
  }
  
  _createScriptEditorPanel() {
    const container = document.createElement('div');
    container.className = 'script-editor-container';
    container.style.cssText = `
      display: flex; flex-direction: column; height: 100%;
      background: #0a0c10;
    `;
    
    // Tabs
    const tabs = document.createElement('div');
    tabs.style.cssText = `
      display: flex; align-items: center; gap: 2px;
      padding: 2px 8px; background: var(--panel);
      border-bottom: 1px solid var(--border);
      flex-shrink: 0; height: 30px; overflow-x: auto;
    `;
    
    const addTab = (name) => {
      const tab = document.createElement('button');
      tab.textContent = name;
      tab.style.cssText = `
        background: transparent; border: none; color: var(--text-dim);
        padding: 2px 10px; font-size: 11px; font-weight: 600;
        border-radius: 3px 3px 0 0; white-space: nowrap;
      `;
      tab.addEventListener('click', () => {
        tabs.querySelectorAll('button').forEach(t => t.style.background = 'transparent');
        tab.style.background = 'var(--panel-raised)';
        tab.style.color = 'var(--text)';
      });
      tabs.appendChild(tab);
      return tab;
    };
    
    // Add initial script
    const defaultTab = addTab('Script.lua');
    defaultTab.style.background = 'var(--panel-raised)';
    defaultTab.style.color = 'var(--text)';
    
    // Add new script button
    const addBtn = document.createElement('button');
    addBtn.textContent = '+';
    addBtn.style.cssText = `
      background: transparent; border: none; color: var(--text-dim);
      padding: 0 6px; font-size: 16px; font-weight: 300;
    `;
    addBtn.addEventListener('click', () => {
      const name = `Script${tabs.querySelectorAll('button').length}.lua`;
      addTab(name);
    });
    tabs.appendChild(addBtn);
    container.appendChild(tabs);
    
    // Editor area
    const editor = document.createElement('textarea');
    editor.style.cssText = `
      flex: 1; background: #0a0c10; border: none; color: var(--text-muted);
      font-family: Consolas, monospace; font-size: 13px;
      padding: 8px 12px; resize: none; outline: none;
      line-height: 1.6; tab-size: 2;
    `;
    editor.placeholder = '-- Write your script here...\nlocal part = workspace.Part\npart.Position = Vector3.new(0, 5, 0)';
    container.appendChild(editor);
    
    // Line numbers (simplified)
    const lineNumbers = document.createElement('div');
    lineNumbers.style.cssText = `
      position: absolute; left: 0; top: 30px; bottom: 0;
      width: 36px; padding: 8px 4px; text-align: right;
      color: var(--text-dim); font-family: Consolas, monospace;
      font-size: 13px; pointer-events: none; overflow: hidden;
      background: #0a0c10; border-right: 1px solid var(--border);
    `;
    container.style.position = 'relative';
    container.appendChild(lineNumbers);
    
    editor.addEventListener('input', () => {
      const lines = editor.value.split('\n').length;
      lineNumbers.innerHTML = Array.from({length: lines}, (_, i) => i + 1).join('<br>');
    });
    editor.dispatchEvent(new Event('input'));
    
    return container;
  }
  
  // Public API
  getSelectedObject() { return this.selectedObject; }
  setSelectedObject(obj) {
    this.selectedObject = obj;
    this.propertiesManager.updateProperties(obj);
    this.explorerManager.updateExplorer(this.currentGroup);
  }
  getCurrentGroup() { return this.currentGroup; }
  setCurrentGroup(group) {
    this.currentGroup = group;
    this.explorerManager.updateExplorer(group);
    this._updateStatusBar();
  }
  
  _updateStatusBar() {
    const statusParts = document.getElementById('statusParts');
    const statusTriangles = document.getElementById('statusTriangles');
    if (this.currentGroup) {
      statusParts.textContent = this.currentGroup.children.length;
      let triCount = 0;
      this.currentGroup.traverse(child => {
        if (child.isMesh && child.geometry) {
          const idx = child.geometry.index;
          const pos = child.geometry.getAttribute('position');
          if (pos) triCount += idx ? idx.count / 3 : pos.count / 3;
        }
      });
      statusTriangles.textContent = Math.round(triCount);
    } else {
      statusParts.textContent = '0';
      statusTriangles.textContent = '0';
    }
  }
  
  notify(msg, type = 'info') {
    this.notificationManager.show(msg, type);
    const output = this.dockManager.getPanel('output');
    if (output && output.component.log) {
      output.component.log(msg, type);
    }
  }
}

export const app = new VodevsApp();