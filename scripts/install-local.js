// 本机一键安装：npm run install-local [-- --close]
// 1. 软件在运行就停下（加 --close 会先正常关闭窗口）
// 2. 备份真实数据 + 当前安装的 app.asar 到 ../备份/<时间>_v<版本>安装前/
// 3. 打包新版 app.asar，替换已安装版本并校验
// 4. 启动新版
const fs = require('fs');
const path = require('path');
const { execFileSync, spawn } = require('child_process');
const asar = require('@electron/asar');

const ROOT = path.resolve(__dirname, '..');
const VERSION = require(path.join(ROOT, 'package.json')).version;
const INSTALL = path.join(process.env.LOCALAPPDATA, 'LearningDashboard');
const EXE = path.join(INSTALL, 'PEAN的开发小天地.exe');
const ASAR = path.join(INSTALL, 'resources', 'app.asar');
const DATA = path.join(process.env.APPDATA, 'learning-dashboard', 'data');
const FILES = ['main.js', 'preload.js', 'package.json', 'src', 'build/icon.ico'];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function running() {
  const out = execFileSync('tasklist', ['/FI', 'IMAGENAME eq PEAN的开发小天地.exe', '/FO', 'CSV', '/NH'], { encoding: 'utf8' });
  return out.includes('PEAN');
}
function stamp() {
  const d = new Date(), p = (n) => String(n).padStart(2, '0');
  return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + '_' + p(d.getHours()) + p(d.getMinutes());
}

(async () => {
  if (!fs.existsSync(EXE)) throw new Error('没找到已安装的软件：' + EXE);

  if (running()) {
    if (!process.argv.includes('--close')) throw new Error('软件正在运行，请先关闭（或加 --close 让脚本正常关闭它）');
    // 不带 /F：只给窗口发正常关闭消息，软件会先保存；后台辅助进程会报“只能强制终止”，随主窗口一起退出，忽略即可
    try { execFileSync('taskkill', ['/IM', 'PEAN的开发小天地.exe'], { stdio: 'ignore' }); } catch (e) {}
    for (let i = 0; i < 20 && running(); i++) await sleep(500);
    if (running()) throw new Error('软件没有正常退出，请手动关闭后重试');
  }

  const backup = path.join(ROOT, '..', '备份', stamp() + '_v' + VERSION + '安装前');
  fs.mkdirSync(backup, { recursive: true });
  fs.cpSync(DATA, path.join(backup, 'userdata'), { recursive: true });
  fs.copyFileSync(ASAR, path.join(backup, '旧版_app.asar'));
  console.log('已备份到 ' + backup);

  const stage = fs.mkdtempSync(path.join(require('os').tmpdir(), 'pean-stage-'));
  FILES.forEach((f) => fs.cpSync(path.join(ROOT, f), path.join(stage, f), { recursive: true }));
  const packed = path.join(stage, '..', path.basename(stage) + '.asar');
  await asar.createPackage(stage, packed);
  fs.copyFileSync(packed, ASAR + '.new');
  fs.renameSync(ASAR + '.new', ASAR);
  if (!fs.readFileSync(packed).equals(fs.readFileSync(ASAR))) throw new Error('替换后校验不一致');
  fs.rmSync(stage, { recursive: true, force: true });
  fs.rmSync(packed, { force: true });
  console.log('已安装 v' + VERSION + ' → ' + ASAR);

  spawn(EXE, [], { detached: true, stdio: 'ignore' }).unref();
  console.log('已启动新版');
})().catch((e) => { console.error('安装失败：' + e.message); process.exit(1); });
