export class ShortcutManager {
  constructor(app) {
    this.app = app;
    this.shortcuts = new Map();
    this._setup();
  }
  
  init() {
    // Called after app initialization
  }
  
  _setup() {
    document.addEventListener('keydown', (e) => {
      this._handleKeydown(e);
    });
  }
  
  register(keys, action, description) {
    const key = this._normalizeKeys(keys);
    this.shortcuts.set(key, { action, description });
  }
  
  _handleKeydown(e) {
    const keys = this._getKeyCombo(e);
    const shortcut = this.shortcuts.get(keys);
    if (shortcut) {
      e.preventDefault();
      shortcut.action();
    }
    
    // Default shortcuts
    this._handleDefaultShortcuts(e);
  }
  
  _handleDefaultShortcuts(e) {
    const k = e.key.toLowerCase();
    const ctrl = e.ctrlKey || e.metaKey;
    const shift = e.shiftKey;
    
    // Transform modes
    if (!ctrl && !shift) {
      if (k === 'q') this.app.ribbonManager._setTransformMode('select');
      if (k === 'w') this.app.ribbonManager._setTransformMode('translate');
      if (k === 'e') this.app.ribbonManager._setTransformMode('rotate');
      if (k === 'r') this.app.ribbonManager._setTransformMode('scale');
      if (k === 'f') {
        const obj = this.app.getSelectedObject();
        if (obj && this.app.viewportManager) {
          this.app.viewportManager._focusObject(obj);
        }
      }
      if (k === 'delete' || k === 'backspace') {
        this.app.ribbonManager._deleteSelected();
      }
      if (k === 'f2') {
        const obj = this.app.getSelectedObject();
        if (obj) {
          const name = obj.userData.partName || 'Part';
          const newName = prompt('Rename:', name);
          if (newName) {
            obj.userData.partName = newName;
            this.app.explorerManager.updateExplorer(this.app.getCurrentGroup());
            this.app.notify(`Renamed to ${newName}`, 'info');
          }
        }
      }
    }
    
    // Ctrl shortcuts
    if (ctrl) {
      if (k === 'z') {
        e.preventDefault();
        if (shift) {
          this.app.historyManager?.redo();
        } else {
          this.app.historyManager?.undo();
        }
      }
      if (k === 'y') {
        e.preventDefault();
        this.app.historyManager?.redo();
      }
      if (k === 'd') {
        e.preventDefault();
        this.app.ribbonManager._duplicateSelected();
      }
      if (k === 'k') {
        e.preventDefault();
        this._openCommandPalette();
      }
      if (k === 's') {
        e.preventDefault();
        this.app.notify('Save not implemented', 'warn');
      }
      if (k === 'o') {
        e.preventDefault();
        this.app.ribbonManager._importModel();
      }
    }
  }
  
  _getKeyCombo(e) {
    const parts = [];
    if (e.ctrlKey || e.metaKey) parts.push('ctrl');
    if (e.shiftKey) parts.push('shift');
    if (e.altKey) parts.push('alt');
    parts.push(e.key.toLowerCase());
    return parts.join('+');
  }
  
  _normalizeKeys(keys) {
    if (Array.isArray(keys)) {
      return keys.map(k => k.toLowerCase()).join('+');
    }
    return keys.toLowerCase();
  }
  
  _openCommandPalette() {
    const palette = document.getElementById('commandPalette');
    if (!palette) return;
    
    palette.classList.toggle('open');
    if (palette.classList.contains('open')) {
      const input = document.getElementById('commandSearch');
      input.value = '';
      input.focus();
      this._updateCommandResults('');
    }
  }
  
  _updateCommandResults(search) {
    const container = document.getElementById('commandResults');
    if (!container) return;
    
    const commands = [
      { label: 'Move Tool', icon: '↕', shortcut: 'W', action: () => this.app.ribbonManager._setTransformMode('translate') },
      { label: 'Rotate Tool', icon: '🔄', shortcut: 'E', action: () => this.app.ribbonManager._setTransformMode('rotate') },
      { label: 'Scale Tool', icon: '↔', shortcut: 'R', action: () => this.app.ribbonManager._setTransformMode('scale') },
      { label: 'Select', icon: '▼', shortcut: 'Q', action: () => this.app.ribbonManager._setTransformMode('select') },
      { label: 'Add Part', icon: '📦', shortcut: '', action: () => this.app.ribbonManager._addPart() },
      { label: 'Import Model', icon: '📂', shortcut: 'Ctrl+O', action: () => this.app.ribbonManager._importModel() },
      { label: 'Export Scene', icon: '📦', shortcut: '', action: () => this.app.ribbonManager._exportScene() },
      { label: 'Toggle Grid', icon: '⊞', shortcut: '', action: () => this.app.ribbonManager._toggleGrid() },
      { label: 'Reset Layout', icon: '⟳', shortcut: '', action: () => this.app.dockManager.resetLayout() },
      { label: 'Undo', icon: '↩', shortcut: 'Ctrl+Z', action: () => this.app.historyManager?.undo() },
      { label: 'Redo', icon: '↪', shortcut: 'Ctrl+Y', action: () => this.app.historyManager?.redo() },
      { label: 'Focus Selected', icon: '🎯', shortcut: 'F', action: () => {
        const obj = this.app.getSelectedObject();
        if (obj && this.app.viewportManager) {
          this.app.viewportManager._focusObject(obj);
        }
      }},
      { label: 'Delete Selected', icon: '🗑️', shortcut: 'Delete', action: () => this.app.ribbonManager._deleteSelected() },
      { label: 'Open Explorer', icon: '📂', shortcut: '', action: () => this.app.ribbonManager._togglePanel('explorer') },
      { label: 'Open Properties', icon: '⚙️', shortcut: '', action: () => this.app.ribbonManager._togglePanel('properties') },
      { label: 'Open Toolbox', icon: '🧰', shortcut: '', action: () => this.app.ribbonManager._togglePanel('toolbox') },
      { label: 'Open Output', icon: '📝', shortcut: '', action: () => this.app.ribbonManager._togglePanel('output') }
    ];
    
    const filtered = search ? commands.filter(c => 
      c.label.toLowerCase().includes(search.toLowerCase()) ||
      c.shortcut.toLowerCase().includes(search.toLowerCase())
    ) : commands;
    
    container.innerHTML = '';
    filtered.forEach((cmd, idx) => {
      const el = document.createElement('div');
      el.className = 'command-result';
      if (idx === 0) el.classList.add('selected');
      el.innerHTML = `
        <span class="cmd-icon">${cmd.icon}</span>
        <span>${cmd.label}</span>
        <span class="cmd-shortcut">${cmd.shortcut}</span>
      `;
      el.addEventListener('click', () => {
        cmd.action();
        document.getElementById('commandPalette').classList.remove('open');
      });
      container.appendChild(el);
    });
    
    // Keyboard navigation
    const results = container.querySelectorAll('.command-result');
    let selectedIndex = 0;
    
    const onKeydown = (e) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        selectedIndex = (selectedIndex + 1) % results.length;
        results.forEach((el, i) => el.classList.toggle('selected', i === selectedIndex));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        selectedIndex = (selectedIndex - 1 + results.length) % results.length;
        results.forEach((el, i) => el.classList.toggle('selected', i === selectedIndex));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (results[selectedIndex]) {
          results[selectedIndex].click();
        }
      } else if (e.key === 'Escape') {
        document.getElementById('commandPalette').classList.remove('open');
      }
    };
    
    document.getElementById('commandSearch').addEventListener('keydown', onKeydown);
  }
}