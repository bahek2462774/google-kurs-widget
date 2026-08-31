const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  getPairs: () => ipcRenderer.invoke('pairs:get'),
  getCatalog: () => ipcRenderer.invoke('pairs:catalog'),
  addPair: (from, to) => ipcRenderer.invoke('pairs:add', { from, to }),
  removePair: (id) => ipcRenderer.invoke('pairs:remove', { id }),
  reorderPairs: (ids) => ipcRenderer.invoke('pairs:reorder', { ids }),
  getInterval: () => ipcRenderer.invoke('interval:get'),
  setInterval: (minutes) => ipcRenderer.invoke('interval:set', { minutes }),
  openSettings: () => ipcRenderer.invoke('settings:open'),
  requestRefresh: () => ipcRenderer.invoke('refresh:request'),
  onRatesUpdated: (callback) => {
    const listener = (_event, pairs) => callback(pairs);
    ipcRenderer.on('rates:updated', listener);
    return () => ipcRenderer.removeListener('rates:updated', listener);
  }
});
