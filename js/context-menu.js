export class ContextMenuManager {
  constructor(app) {
    this.app = app;
    this.container = document.getElementById('vxContextMenu');
    this.isOpen = false;
    this._setup();
  }
  
  _setup() {
    document.addEventListener('click', (e) => {
      if (!this.container.contains(e.target)) {
        this.hide();
      }
    });
    
    document.addEventListener('contextmenu', (e) => {
      // Allow default context menu if not in app
      if (!e.target.closest('#app')) return;
      e.preventDefault();
    });
  }
  
  show(x, y, items) {
    this.container.innerHTML = '';
    this.container.style.display = 'block';
    this.isOpen = true;
    
    items.forEach(item => {
      if (item.separator) {
        const sep = document.createElement('div');
        sep.className = 'vx-ctx-sep';
        this.container.appendChild(sep);
        return;
      }
      
      const el = document.createElement('div');
      el.className = 'vx-ctx-item';
      if (item.disabled) el.classList.add('disabled');
      
      if (item.submenu) {
        // Submenu
        el.innerHTML = `
          <span class="vx-ctx-icon">${item.icon || '›'}</span>
          <span class="vx-ctx-label">${item.label}</span>
          <span class="vx-ctx-shortcut">▶</span>
        `;
        el.addEventListener('mouseenter', () => {
          // Show submenu
          const subItems = item.submenu;
          const rect = el.getBoundingClientRect();
          this.show(rect.right, rect.top, subItems);
        });
      } else {
        el.innerHTML = `
          <span class="vx-ctx-icon">${item.icon || ''}</span>
          <span class="vx-ctx-label">${item.label}</span>
          <span class="vx-ctx-shortcut">${item.shortcut || ''}</span>
        `;
        el.addEventListener('click', (e) => {
          e.stopPropagation();
          if (item.action && !item.disabled) {
            item.action();
          }
          this.hide();
        });
      }
      
      this.container.appendChild(el);
    });
    
    // Position
    const maxWidth = 300;
    const maxHeight = 400;
    const rect = this.container.getBoundingClientRect();
    let posX = Math.min(x, window.innerWidth - maxWidth);
    let posY = Math.min(y, window.innerHeight - maxHeight);
    posX = Math.max(10, posX);
    posY = Math.max(10, posY);
    this.container.style.left = posX + 'px';
    this.container.style.top = posY + 'px';
  }
  
  hide() {
    this.container.style.display = 'none';
    this.container.innerHTML = '';
    this.isOpen = false;
  }
  
  isVisible() {
    return this.isOpen;
  }
}