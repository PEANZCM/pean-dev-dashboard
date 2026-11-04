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

  // AI（Key 只存在主进程，这里只有存、删、用，没有读）
  aiStatus: () => ipcRenderer.invoke('ai:status'),
  aiSetKey: (key) => ipcRenderer.invoke('ai:setKey', key),
  aiClearKey: () => ipcRenderer.invoke('ai:clearKey'),
  aiChat: (o) => ipcRenderer.invoke('ai:chat', o),
  aiModels: () => ipcRenderer.invoke('ai:models'),

  // 打卡证据（只读）和本机设置：监控文件夹只能经系统选择框添加
  collectEvidence: (date) => ipcRenderer.invoke('evidence:collect', date),
  onUsageSample: (fn) => ipcRenderer.on('usage:sample', (e, sample) => fn(sample)),
  localGet: () => ipcRenderer.invoke('local:get'),
  localSet: (patch) => ipcRenderer.invoke('local:set', patch),
  localAddFolder: () => ipcRenderer.invoke('local:addFolder'),
  localRemoveFolder: (folder) => ipcRenderer.invoke('local:removeFolder', folder),

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
