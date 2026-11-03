const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('dashboardAPI', {
  // 数据文件读写（主进程按白名单限制文件名）
  readFile: (filename) => ipcRenderer.invoke('data:read', filename),
  writeFile: (filename, content) => ipcRenderer.invoke('data:write', filename, content),

  // 截图
  readScreenshot: (filename) => ipcRenderer.invoke('screenshot:read', filename),
  deleteScreenshot: (filename) => ipcRenderer.invoke('screenshot:delete', filename),
  openImage: () => ipcRenderer.invoke('dialog:openImage'),

  // 自选壁纸
  pickWallpaper: () => ipcRenderer.invoke('wallpaper:pick'),
  readWallpaper: () => ipcRenderer.invoke('wallpaper:read'),

  // 系统通知
  showNotification: (title, body) => ipcRenderer.invoke('notification:show', title, body),

  // 备份
  exportBackup: () => ipcRenderer.invoke('backup:export'),
  importBackup: () => ipcRenderer.invoke('backup:import'),

  // 打开外部链接
  openExternal: (url) => ipcRenderer.invoke('shell:openExternal', url),

  // 获取应用图标
  getAppIcon: () => ipcRenderer.invoke('app:getIcon')
});
