const { app, BrowserWindow, ipcMain, dialog, Notification, nativeImage, shell, safeStorage } = require('electron');
const path = require('path');
const fs = require('fs');
const ai = require('./ai.js');

// 测试用：PEAN_USERDATA=某个目录 时用独立数据目录启动，不碰真实数据
if (process.env.PEAN_USERDATA) app.setPath('userData', path.resolve(process.env.PEAN_USERDATA));

let mainWindow;
const DATA_DIR = path.join(app.getPath('userData'), 'data');
const SHOT_DIR = path.join(DATA_DIR, 'screenshots');

// 渲染进程只能读写这些数据文件（防止 ../ 之类的路径穿越）；备份也用这份清单
const DATA_FILES = [
  'checkin.json', 'streak.json', 'flame.json', 'medals.json', 'tasks.json', 'plan.json', 'progress.json',
  'meta.json', 'diary.json', 'mood.json', 'quotes.json', 'settings.json', 'screenshots.json', 'ai.json'
];

function dataPath(name) {
  return DATA_FILES.includes(name) ? path.join(DATA_DIR, name) : null;
}
function shotPath(name) {
  const base = path.basename(String(name || ''));
  return /^shot_[\w.-]+$/.test(base) ? path.join(SHOT_DIR, base) : null;
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 1000,
    minHeight: 650,
    title: 'PEAN的开发小天地',
    backgroundColor: '#F2F2F7',
    icon: path.join(__dirname, 'build', 'icon.ico'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: false   // 窗口被遮挡时计时器照常运行（跨天检测、晚间提醒）
    },
    show: false,
    autoHideMenuBar: true,
    frame: true
  });

  // 窗口只显示本地页面：不跳转、不弹新窗口（链接交给系统浏览器），主进程握着 API Key，这里要收紧
  mainWindow.webContents.on('will-navigate', (e, url) => { if (!url.startsWith('file:')) e.preventDefault(); });
  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  mainWindow.loadFile(path.join(__dirname, 'src', 'index.html'));
  mainWindow.once('ready-to-show', () => mainWindow.show());
  mainWindow.on('closed', () => { mainWindow = null; });
}

// Windows 打包后不设置 AppUserModelId，系统通知可能不显示
app.setAppUserModelId('com.trae.pean-dashboard');

app.whenReady().then(() => {
  fs.mkdirSync(SHOT_DIR, { recursive: true });
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// ===== IPC: 数据文件读写 =====
ipcMain.handle('data:read', (e, filename) => {
  try {
    const fp = dataPath(filename);
    if (!fp || !fs.existsSync(fp)) return null;
    return fs.readFileSync(fp, 'utf-8');
  } catch (err) { return null; }
});

ipcMain.handle('data:write', (e, filename, content) => {
  try {
    const fp = dataPath(filename);
    if (!fp) return false;
    const tmp = fp + '.tmp';
    fs.writeFileSync(tmp, content, 'utf-8');
    fs.renameSync(tmp, fp);
    return true;
  } catch (err) { return false; }
});

// ===== IPC: 截图 =====
ipcMain.handle('screenshot:read', (e, filename) => {
  try {
    const fp = shotPath(filename);
    if (!fp || !fs.existsSync(fp)) return null;
    const ext = path.extname(fp).slice(1).toLowerCase();
    const mime = ext === 'jpg' ? 'jpeg' : ext || 'png';
    return 'data:image/' + mime + ';base64,' + fs.readFileSync(fp).toString('base64');
  } catch (err) { return null; }
});

ipcMain.handle('screenshot:delete', (e, filename) => {
  try {
    const fp = shotPath(filename);
    if (fp && fs.existsSync(fp)) fs.unlinkSync(fp);
    return true;
  } catch (err) { return false; }
});

ipcMain.handle('dialog:openImage', async () => {
  try {
    const result = await dialog.showOpenDialog(mainWindow, {
      title: '选择截图',
      filters: [{ name: '图片', extensions: ['png', 'jpg', 'jpeg', 'gif', 'bmp', 'webp'] }],
      properties: ['openFile', 'multiSelections']
    });
    if (result.canceled || !result.filePaths.length) return null;
    return result.filePaths.map((src) => {
      const ext = path.extname(src).toLowerCase() || '.png';
      const name = 'shot_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8) + ext;
      fs.copyFileSync(src, path.join(SHOT_DIR, name));
      return name;
    });
  } catch (err) { return null; }
});

// ===== IPC: 自选壁纸（复制一份到数据目录，只保留最新一张） =====
const WALL_EXT = ['.png', '.jpg', '.jpeg', '.webp', '.bmp', '.gif'];
const MIME = { '.png': 'png', '.jpg': 'jpeg', '.jpeg': 'jpeg', '.webp': 'webp', '.bmp': 'bmp', '.gif': 'gif' };
function wallFile() {
  const f = fs.readdirSync(DATA_DIR).find((n) => /^wallpaper\.\w+$/.test(n));
  return f ? path.join(DATA_DIR, f) : null;
}
function wallDataUrl(fp) {
  return 'data:image/' + MIME[path.extname(fp).toLowerCase()] + ';base64,' + fs.readFileSync(fp).toString('base64');
}
ipcMain.handle('wallpaper:pick', async () => {
  try {
    const result = await dialog.showOpenDialog(mainWindow, {
      title: '选择壁纸',
      filters: [{ name: '图片', extensions: WALL_EXT.map((e) => e.slice(1)) }],
      properties: ['openFile']
    });
    if (result.canceled || !result.filePaths.length) return null;
    const src = result.filePaths[0], ext = path.extname(src).toLowerCase();
    if (!WALL_EXT.includes(ext)) return null;
    const old = wallFile();
    if (old) fs.unlinkSync(old);
    const dest = path.join(DATA_DIR, 'wallpaper' + ext);
    fs.copyFileSync(src, dest);
    return wallDataUrl(dest);
  } catch (err) { return null; }
});
ipcMain.handle('wallpaper:read', () => {
  try { const fp = wallFile(); return fp ? wallDataUrl(fp) : null; } catch (err) { return null; }
});

// ===== IPC: 系统通知 =====
ipcMain.handle('notification:show', (e, title, body) => {
  try {
    if (!Notification.isSupported()) return false;
    new Notification({ title, body, silent: false }).show();
    return true;
  } catch (err) { return false; }
});

// ===== IPC: 备份导出/导入 =====
ipcMain.handle('backup:export', async () => {
  try {
    const result = await dialog.showSaveDialog(mainWindow, {
      title: '导出备份',
      defaultPath: 'PEAN开发小天地备份_' + new Date().toISOString().slice(0, 10) + '.json',
      filters: [{ name: 'JSON', extensions: ['json'] }]
    });
    if (result.canceled || !result.filePath) return null;
    const backup = { version: 4, app: app.getVersion(), date: new Date().toISOString(), data: {} };
    DATA_FILES.forEach((f) => {
      const fp = path.join(DATA_DIR, f);
      if (fs.existsSync(fp)) backup.data[f] = fs.readFileSync(fp, 'utf-8');
    });
    fs.writeFileSync(result.filePath, JSON.stringify(backup, null, 2), 'utf-8');
    return result.filePath;
  } catch (err) { return null; }
});

ipcMain.handle('backup:import', async () => {
  try {
    const result = await dialog.showOpenDialog(mainWindow, {
      title: '导入备份',
      filters: [{ name: 'JSON', extensions: ['json'] }],
      properties: ['openFile']
    });
    if (result.canceled || !result.filePaths.length) return null;
    const backup = JSON.parse(fs.readFileSync(result.filePaths[0], 'utf-8'));
    if (!backup.data) return null;
    // 先整体校验：只认白名单文件名，内容必须是合法 JSON；任何一项不合格就整个放弃，不写半份
    const files = Object.keys(backup.data).filter((f) => dataPath(f));
    files.forEach((f) => JSON.parse(backup.data[f]));
    files.forEach((f) => fs.writeFileSync(dataPath(f), backup.data[f], 'utf-8'));
    // 旧版备份只有 tasks.json：删掉当前规划，启动时按备份里的 tasks.json 重新迁移
    if (backup.data['tasks.json'] && !backup.data['plan.json']) {
      ['plan.json', 'progress.json'].forEach((f) => { try { fs.unlinkSync(path.join(DATA_DIR, f)); } catch (err) {} });
    }
    return true;
  } catch (err) { return null; }
});

// ===== IPC: AI =====
// Key 用系统加密（Windows DPAPI）保存在数据目录之外，不进备份，渲染进程读不到
const KEY_FILE = path.join(app.getPath('userData'), 'ai-key.bin');
// 测试用：只接受本机地址，防止 Key 被发到别处
const AI_BASE = /^http:\/\/127\.0\.0\.1:\d+$/.test(process.env.PEAN_AI_BASE || '') ? process.env.PEAN_AI_BASE : undefined;

function readKey() {
  try { return fs.existsSync(KEY_FILE) ? safeStorage.decryptString(fs.readFileSync(KEY_FILE)) : null; } catch (err) { return null; }
}
ipcMain.handle('ai:status', () => ({ hasKey: !!readKey(), canEncrypt: safeStorage.isEncryptionAvailable() }));
ipcMain.handle('ai:setKey', (e, key) => {
  const k = String(key || '').trim();
  if (!k || /\s/.test(k)) return { ok: false, error: 'Key 格式不对' };
  if (!safeStorage.isEncryptionAvailable()) return { ok: false, error: '这台电脑无法加密保存 Key' };
  fs.writeFileSync(KEY_FILE, safeStorage.encryptString(k));
  return { ok: true };
});
ipcMain.handle('ai:clearKey', () => { try { fs.unlinkSync(KEY_FILE); } catch (err) {} return true; });
ipcMain.handle('ai:chat', (e, o) => {
  const key = readKey();
  if (!key) return { ok: false, noKey: true, error: '还没有填 API Key' };
  return ai.chat(key, {
    system: String(o.system || ''), messages: Array.isArray(o.messages) ? o.messages : [],
    model: o.model, deep: !!o.deep, json: !!o.json, maxTokens: o.maxTokens
  }, { base: AI_BASE });
});
ipcMain.handle('ai:models', () => {
  const key = readKey();
  return key ? ai.listModels(key, { base: AI_BASE }) : { ok: false, noKey: true };
});

// ===== IPC: 打开外部链接 =====
ipcMain.handle('shell:openExternal', (e, url) => {
  if (typeof url !== 'string' || !/^https?:\/\//i.test(url)) return false;
  shell.openExternal(url);
  return true;
});

// ===== IPC: 应用图标（base64 PNG） =====
ipcMain.handle('app:getIcon', () => {
  try {
    const iconPath = path.join(__dirname, 'build', 'icon.ico');
    if (fs.existsSync(iconPath)) {
      const img = nativeImage.createFromPath(iconPath);
      if (!img.isEmpty()) return img.toDataURL();
    }
  } catch (err) {}
  return null;
});
