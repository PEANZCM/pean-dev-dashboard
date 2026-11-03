const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('dashboardAPI', {
  // 数据文件读写
  readFile: (filename) => ipcRenderer.invoke('data:read', filename),
  writeFile: (filename, content) => ipcRenderer.invoke('data:write', filename, content),
  getDataDir: () => ipcRenderer.invoke('data:getDir'),

  // 截图
  saveScreenshot: (base64) => ipcRenderer.invoke('screenshot:save', base64),
  readScreenshot: (filename) => ipcRenderer.invoke('screenshot:read', filename),
  deleteScreenshot: (filename) => ipcRenderer.invoke('screenshot:delete', filename),

  // 手动选择图片上传
  openImage: () => ipcRenderer.invoke('dialog:openImage'),

  // 系统通知
  showNotification: (title, body) => ipcRenderer.invoke('notification:show', title, body),

  // 备份
  exportBackup: () => ipcRenderer.invoke('backup:export'),
  importBackup: () => ipcRenderer.invoke('backup:import'),

  // 新闻
  fetchNews: () => ipcRenderer.invoke('news:fetch'),

  // 打开外部链接
  openExternal: (url) => ipcRenderer.invoke('shell:openExternal', url),

  // 获取应用图标
  getAppIcon: () => ipcRenderer.invoke('app:getIcon'),

  // 液态玻璃：捕获页面背景纹理
  captureBackground: () => ipcRenderer.invoke('glass:capture'),
});
