const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('curlAPI', {
  run: (command) => ipcRenderer.invoke('curl:run', command),
});
