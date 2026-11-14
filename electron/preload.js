const { contextBridge, ipcRenderer } = require('electron');

/**
 * 只暴露必要的能力给渲染进程（contextIsolation 开启，渲染端拿不到 Node）
 */
contextBridge.exposeInMainWorld('native', {
  isElectron: true,
  platform: process.platform,

  // 文件
  openFileDialog: () => ipcRenderer.invoke('dialog:openFile'),
  saveAsDialog: (defaultName, content) => ipcRenderer.invoke('dialog:saveAs', defaultName, content),
  openFolderDialog: () => ipcRenderer.invoke('dialog:openFolder'),
  readFile: (p) => ipcRenderer.invoke('fs:read', p),
  writeFile: (p, content) => ipcRenderer.invoke('fs:write', p, content),
  listTree: (dir) => ipcRenderer.invoke('fs:listTree', dir),

  // 应用
  getInfo: () => ipcRenderer.invoke('app:getInfo'),
  setTitle: (t) => ipcRenderer.invoke('app:setTitle', t),
  setDirty: (d) => ipcRenderer.invoke('app:setDirty', d),
  getRecent: () => ipcRenderer.invoke('app:recent'),
  addRecent: (p) => ipcRenderer.invoke('app:addRecent', p),
  showInFolder: (p) => ipcRenderer.invoke('app:showInFolder', p),
  openExternal: (url) => ipcRenderer.invoke('shell:openExternal', url),
  close: () => ipcRenderer.invoke('app:close'),
  toggleDevTools: () => ipcRenderer.invoke('app:toggleDevTools'),

  // 后台驻留偏好（托盘菜单与设置面板共用同一份状态）
  getAppPrefs: () => ipcRenderer.invoke('app:getPrefs'),
  setAppPrefs: (patch) => ipcRenderer.invoke('app:setPrefs', patch),

  // 事件
  onOpenFile: (cb) => {
    const h = (_e, p) => cb(p);
    ipcRenderer.on('open-file', h);
    return () => ipcRenderer.removeListener('open-file', h);
  },
  onMenuCommand: (cb) => {
    const h = (_e, cmd, payload) => cb(cmd, payload);
    ipcRenderer.on('menu-command', h);
    return () => ipcRenderer.removeListener('menu-command', h);
  },
  onPrefsChanged: (cb) => {
    const h = (_e, p) => cb(p);
    ipcRenderer.on('prefs-changed', h);
    return () => ipcRenderer.removeListener('prefs-changed', h);
  }
});
