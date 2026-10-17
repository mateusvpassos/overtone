const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  mixes: () => ipcRenderer.invoke('mix:list'),
  saveMix: (name, data) => ipcRenderer.invoke('mix:save', name, data),
  loadMix: file => ipcRenderer.invoke('mix:load', file),
  deleteMix: file => ipcRenderer.invoke('mix:delete', file),
  openMixFolder: () => ipcRenderer.invoke('mix:folder'),
  exportAudio: (name, format, rate, left, right) => ipcRenderer.invoke('export:audio', name, format, rate, left, right),
  reveal: file => ipcRenderer.invoke('export:reveal', file),
  pickFolder: () => ipcRenderer.invoke('export:pick-folder'),
  writeAudioTo: (dir, name, format, rate, left, right) => ipcRenderer.invoke('export:audio-to', dir, name, format, rate, left, right),
  saveFile: (name, ext, bytes) => ipcRenderer.invoke('export:file', name, ext, bytes),
  autosave: data => ipcRenderer.send('auto:save', data),
  autosaveLoad: () => ipcRenderer.invoke('auto:load'),
  readSample: file => ipcRenderer.invoke('sample:read', file),
  saveAudio: (rate, left, right) => ipcRenderer.invoke('audio:save', rate, left, right),
  readAudio: name => ipcRenderer.invoke('audio:read', name),
  openMidi: () => ipcRenderer.invoke('learn:open-mid'),
  setFullscreen: on => ipcRenderer.invoke('win:fullscreen', on),
  mixVersions: file => ipcRenderer.invoke('mix:versions', file),
  mixVersionLoad: (file, id) => ipcRenderer.invoke('mix:version-load', file, id)
});
