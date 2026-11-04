// 用和正式软件同一个 Electron 打开原型：npm run lab，AI 思考图标：npm run orb
const { app, BrowserWindow } = require('electron');
const path = require('path');

app.whenReady().then(() => {
  const win = new BrowserWindow({
    width: 1280, height: 820, title: '液态玻璃实验室',
    backgroundColor: '#000000', autoHideMenuBar: true,
    webPreferences: { contextIsolation: true, nodeIntegration: false, backgroundThrottling: false }
  });
  win.loadFile(path.join(__dirname, process.argv.includes('orb') ? 'orb-lab.html' : 'index.html'));
});

app.on('window-all-closed', () => app.quit());
