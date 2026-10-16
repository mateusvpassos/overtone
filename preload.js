const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  mixes: () => ipcRenderer.invoke('mix:list'),
  saveMix: (name, data) => ipcRenderer.invoke('mix:save', name, data),
  loadMix: file => ipcRenderer.invoke('mix:load', file),
  deleteMix: file => ipcRenderer.invoke('mix:delete', file),
  openMixFolder: () => ipcRenderer.invoke('mix:folder')
});
