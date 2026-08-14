export class NotificationManager {
  constructor() {
    this.container = document.getElementById('toast');
    this.timer = null;
  }
  
  show(msg, type = 'info') {
    const icons = {
      info: 'ℹ️',
      success: '✅',
      warn: '⚠️',
      error: '❌'
    };
    
    this.container.textContent = `${icons[type] || 'ℹ️'} ${msg}`;
    this.container.className = 'show';
    
    clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.container.classList.remove('show');
    }, 3000);
  }
  
  hide() {
    this.container.classList.remove('show');
    clearTimeout(this.timer);
  }
}