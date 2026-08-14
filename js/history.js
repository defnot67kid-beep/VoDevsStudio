export class HistoryManager {
  constructor(app) {
    this.app = app;
    this.undoStack = [];
    this.redoStack = [];
    this.maxHistory = 50;
    this.isGrouping = false;
    this.currentGroup = null;
  }
  
  push(action) {
    if (this.isGrouping) {
      if (!this.currentGroup) {
        this.currentGroup = { actions: [], label: 'Group' };
        this.undoStack.push(this.currentGroup);
        this.redoStack = [];
      }
      this.currentGroup.actions.push(action);
    } else {
      this.undoStack.push(action);
      this.redoStack = [];
    }
    
    if (this.undoStack.length > this.maxHistory) {
      this.undoStack.shift();
    }
    
    this._updateUI();
  }
  
  undo() {
    if (this.undoStack.length === 0) {
      this.app.notify('Nothing to undo', 'info');
      return;
    }
    
    const action = this.undoStack.pop();
    this.redoStack.push(action);
    this._executeAction(action, 'undo');
    this._updateUI();
    this.app.notify('Undo', 'info');
  }
  
  redo() {
    if (this.redoStack.length === 0) {
      this.app.notify('Nothing to redo', 'info');
      return;
    }
    
    const action = this.redoStack.pop();
    this.undoStack.push(action);
    this._executeAction(action, 'redo');
    this._updateUI();
    this.app.notify('Redo', 'info');
  }
  
  _executeAction(action, direction) {
    if (Array.isArray(action.actions)) {
      // Group action
      const actions = direction === 'undo' ? [...action.actions].reverse() : action.actions;
      actions.forEach(a => this._executeSingle(a, direction));
    } else {
      this._executeSingle(action, direction);
    }
  }
  
  _executeSingle(action, direction) {
    const fn = direction === 'undo' ? action.undo : action.redo;
    if (fn) fn();
  }
  
  beginGroup(label) {
    this.isGrouping = true;
    this.currentGroup = { actions: [], label: label || 'Group' };
  }
  
  endGroup() {
    if (this.isGrouping && this.currentGroup) {
      if (this.currentGroup.actions.length > 0) {
        this.undoStack.push(this.currentGroup);
        this.redoStack = [];
        this._updateUI();
      }
    }
    this.isGrouping = false;
    this.currentGroup = null;
  }
  
  _updateUI() {
    // Update ribbon buttons
    const undoBtn = document.getElementById('undoBtn');
    const redoBtn = document.getElementById('redoBtn');
    if (undoBtn) {
      undoBtn.style.opacity = this.undoStack.length > 0 ? '1' : '0.4';
    }
    if (redoBtn) {
      redoBtn.style.opacity = this.redoStack.length > 0 ? '1' : '0.4';
    }
  }
  
  clear() {
    this.undoStack = [];
    this.redoStack = [];
    this._updateUI();
  }
}