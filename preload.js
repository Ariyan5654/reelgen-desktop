const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  processVideo: (payload) => ipcRenderer.invoke('process-video', payload)
});
