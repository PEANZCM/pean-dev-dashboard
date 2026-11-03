const { app, BrowserWindow, ipcMain, dialog, Notification, nativeImage, session } = require('electron');
const path = require('path');
const fs = require('fs');
const https = require('https');
const http = require('http');

let mainWindow;
const DATA_DIR = path.join(app.getPath('userData'), 'data');
const SHOT_DIR = path.join(DATA_DIR, 'screenshots');

function ensureDirs() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(SHOT_DIR)) fs.mkdirSync(SHOT_DIR, { recursive: true });
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
      backgroundThrottling: false   // 窗口被遮挡时仍保持计时器/rAF/截图可用，玻璃纹理不陈化
    },
    show: false,
    autoHideMenuBar: true,
    frame: true
  });

  mainWindow.loadFile(path.join(__dirname, 'src', 'index.html'));
  mainWindow.once('ready-to-show', () => mainWindow.show());
  mainWindow.on('closed', () => { mainWindow = null; });
}

app.whenReady().then(() => {
  ensureDirs();
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
    const fp = path.join(DATA_DIR, filename);
    if (!fs.existsSync(fp)) return null;
    return fs.readFileSync(fp, 'utf-8');
  } catch (err) { return null; }
});

ipcMain.handle('data:write', (e, filename, content) => {
  try {
    const fp = path.join(DATA_DIR, filename);
    const tmp = fp + '.tmp';
    fs.writeFileSync(tmp, content, 'utf-8');
    fs.renameSync(tmp, fp);
    return true;
  } catch (err) { return false; }
});

// ===== IPC: 截图 =====
ipcMain.handle('screenshot:save', (e, base64Data) => {
  try {
    const buf = Buffer.from(base64Data, 'base64');
    const name = 'shot_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8) + '.png';
    const fp = path.join(SHOT_DIR, name);
    fs.writeFileSync(fp, buf);
    return name;
  } catch (err) { return null; }
});

ipcMain.handle('screenshot:read', (e, filename) => {
  try {
    const fp = path.join(SHOT_DIR, filename);
    if (!fs.existsSync(fp)) return null;
    const buf = fs.readFileSync(fp);
    return 'data:image/png;base64,' + buf.toString('base64');
  } catch (err) { return null; }
});

ipcMain.handle('screenshot:delete', (e, filename) => {
  try {
    const fp = path.join(SHOT_DIR, filename);
    if (fs.existsSync(fp)) fs.unlinkSync(fp);
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
    const savedFiles = [];
    for (const srcPath of result.filePaths) {
      const ext = path.extname(srcPath).toLowerCase() || '.png';
      const name = 'shot_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8) + ext;
      const destPath = path.join(SHOT_DIR, name);
      fs.copyFileSync(srcPath, destPath);
      savedFiles.push(name);
    }
    return savedFiles;
  } catch (err) { return null; }
});

// ===== IPC: 系统通知 =====
ipcMain.handle('notification:show', (e, title, body) => {
  try {
    if (Notification.isSupported()) {
      const n = new Notification({ title, body, silent: false });
      n.show();
      return true;
    }
    return false;
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
    const backup = { version: 3, date: new Date().toISOString(), data: {} };
    const files = ['checkin.json', 'streak.json', 'flame.json', 'medals.json', 'tasks.json', 'diary.json', 'mood.json', 'quotes.json', 'settings.json', 'screenshots.json', 'news.json'];
    files.forEach(f => {
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
    const raw = fs.readFileSync(result.filePaths[0], 'utf-8');
    const backup = JSON.parse(raw);
    if (!backup.data) return null;
    Object.keys(backup.data).forEach(f => {
      const fp = path.join(DATA_DIR, f);
      fs.writeFileSync(fp, backup.data[f], 'utf-8');
    });
    return true;
  } catch (err) { return null; }
});

ipcMain.handle('data:getDir', () => DATA_DIR);

// ===== IPC: 液态玻璃背景捕获（renderer 负责先隐藏玻璃画布再调用） =====
ipcMain.handle('glass:capture', async (e) => {
  try {
    const win = BrowserWindow.fromWebContents(e.sender);
    if (!win) return null;
    const img = await win.webContents.capturePage();
    const sz = img.getSize();
    return { data: img.toJPEG(90).toString('base64'), w: sz.width, h: sz.height };
  } catch (err) { return null; }
});

// ===== IPC: 打开外部链接 =====
ipcMain.handle('shell:openExternal', (e, url) => {
  try {
    if (url && (url.startsWith('http://') || url.startsWith('https://'))) {
      require('electron').shell.openExternal(url);
      return true;
    }
  } catch (err) {}
  return false;
});

// ===== IPC: 获取应用图标（base64 PNG）=====
ipcMain.handle('app:getIcon', () => {
  try {
    var iconPath = path.join(__dirname, 'build', 'icon.ico');
    if (!fs.existsSync(iconPath)) iconPath = path.join(__dirname, 'icon.ico');
    if (fs.existsSync(iconPath)) {
      var img = nativeImage.createFromPath(iconPath);
      if (!img.isEmpty()) return img.toDataURL();
    }
  } catch (err) {}
  return null;
});

// ===== IPC: RSS新闻抓取 =====
function fetchUrl(url) {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith('https') ? https : http;
    const req = mod.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml,text/xml,*/*'
      },
      timeout: 10000
    }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return resolve(fetchUrl(res.headers.location));
      }
      if (res.statusCode !== 200) {
        return reject(new Error('HTTP ' + res.statusCode));
      }
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => resolve(data));
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
  });
}

function parseRSS(xml, sourceName) {
  var items = [];
  var itemRegex = /<item[\s\S]*?<\/item>/gi;
  var matches = xml.match(itemRegex) || [];
  for (var i = 0; i < Math.min(matches.length, 15); i++) {
    var block = matches[i];
    var title = block.match(/<title><!\[CDATA\[([\s\S]*?)\]\]><\/title>/i) || block.match(/<title>([\s\S]*?)<\/title>/i);
    var link = block.match(/<link><!\[CDATA\[([\s\S]*?)\]\]><\/link>/i) || block.match(/<link>([\s\S]*?)<\/link>/i);
    var desc = block.match(/<description><!\[CDATA\[([\s\S]*?)\]\]><\/description>/i) || block.match(/<description>([\s\S]*?)<\/description>/i);
    var date = block.match(/<pubDate>([\s\S]*?)<\/pubDate>/i);
    if (title) {
          var cleanDesc = desc ? desc[1].replace(/<[^>]+>/g, '').trim().slice(0, 120) : '';
          var cats = categorizeNews(title[1].trim(), cleanDesc);
          items.push({
            title: title[1].trim(),
            link: link ? link[1].trim() : '',
            desc: cleanDesc,
            date: date ? date[1].trim() : '',
            source: sourceName,
            cats: cats
          });
    }
  }
  return items;
}

var NEWS_SOURCES = [
  { name: 'IT之家', url: 'https://www.ithome.com/rss/' },
  { name: '36氪', url: 'https://36kr.com/feed' },
  { name: '少数派', url: 'https://sspai.com/feed' },
  { name: '华为中国', url: 'https://www.huawei.com/cn/rss-feeds/press-releases' },
  { name: 'CNBeta', url: 'https://rss.cnbeta.com/rss' },
  { name: 'V2EX', url: 'https://www.v2ex.com/index.xml' },
  { name: '爱范儿', url: 'https://www.ifanr.com/feed' },
  { name: 'Solidot', url: 'https://www.solidot.org/index.rss' },
  { name: '品玩', url: 'https://pingwest.com/feed' }
];

// 关键词分类：匹配标题/描述中的关键词，标注分类标签
var NEWS_KEYWORDS = [
  { cat: '航天', words: ['航天','火箭','卫星','空间站','月球','火星','探测器','发射','宇航','太空','银河','星舰'] },
  { cat: '华为', words: ['华为','鸿蒙','HarmonyOS','Mate','Pura','麒麟','海思','问界','智界','享界'] },
  { cat: '苹果', words: ['苹果','Apple','iPhone','iPad','Mac','iOS','macOS','Swift','库克','Tim Cook'] },
  { cat: '小米', words: ['小米','Redmi','MIUI','HyperOS','雷军','卢伟冰'] },
  { cat: '三星', words: ['三星','Samsung','Galaxy'] },
  { cat: 'OPPO', words: ['OPPO','一加','OnePlus','realme','ColorOS'] },
  { cat: 'vivo', words: ['vivo','iQOO','OriginOS'] },
  { cat: '英伟达', words: ['英伟达','Nvidia','RTX','GTX','CUDA','黄仁勋'] },
  { cat: 'AI', words: ['AI','人工智能','大模型','GPT','ChatGPT','Claude','Gemini','LLM','深度学习','机器学习','OpenAI','智能','算法','神经网络'] },
  { cat: '科技突破', words: ['突破','首创','首次','量子','芯片','纳米','基因','CRISPR','核聚变','超导','突破性'] },
  { cat: '外星人', words: ['外星','UFO','不明飞行物','地外','外星生命','SETI','信号','宇宙生命'] },
  { cat: '手机', words: ['手机','旗舰','折叠屏','平板','旗舰机','智能手机'] }
];

function categorizeNews(title, desc) {
  var text = (title + ' ' + (desc || '')).toLowerCase();
  var cats = [];
  for (var i = 0; i < NEWS_KEYWORDS.length; i++) {
    var kw = NEWS_KEYWORDS[i];
    for (var j = 0; j < kw.words.length; j++) {
      if (text.indexOf(kw.words[j].toLowerCase()) !== -1) {
        if (cats.indexOf(kw.cat) === -1) cats.push(kw.cat);
        break;
      }
    }
  }
  return cats;
}

ipcMain.handle('news:fetch', async () => {
  var allNews = [];
  var promises = NEWS_SOURCES.map(function(src) {
    return fetchUrl(src.url).then(function(xml) {
      var items = parseRSS(xml, src.name);
      allNews = allNews.concat(items);
    }).catch(function(err) {
      console.error('Failed to fetch ' + src.name + ':', err.message);
    });
  });
  await Promise.all(promises);
  // 按时间排序（新的在前）
  allNews.sort(function(a, b) {
    var da = a.date ? new Date(a.date) : new Date(0);
    var db = b.date ? new Date(b.date) : new Date(0);
    return db - da;
  });
  // 限制数量
  allNews = allNews.slice(0, 50);
  return { news: allNews, fetchTime: new Date().toISOString() };
});
