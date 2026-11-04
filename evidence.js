// ============================================================
//  打卡证据（主进程，只读）：指定文件夹的改动、git 提交、开发软件前台时长
//  · 只看文件名和修改时间，不读文件内容；git 只跑固定参数的 log
//  · AI 不能调用这里的任何东西：软件收集好，把摘要写进请求
// ============================================================
const fs = require('fs');
const path = require('path');
const { execFile, spawn } = require('child_process');

const SKIP = new Set(['node_modules', 'oh_modules', '.git', '.hvigor', '.gradle', '.idea', '.vscode', '.next', '.venv', 'venv', '__pycache__', 'dist', 'build', 'out', 'target', 'coverage']);
const MAX_ENTRIES = 30000;

// 算作开发软件的进程（小写进程名 → 显示名），其他软件不记录
const DEV_APPS = {
  code: 'VS Code', trae: 'Trae', 'trae cn': 'Trae', cursor: 'Cursor', devecostudio64: 'DevEco Studio', devecostudio: 'DevEco Studio',
  idea64: 'IntelliJ IDEA', webstorm64: 'WebStorm', pycharm64: 'PyCharm', clion64: 'CLion', studio64: 'Android Studio', devenv: 'Visual Studio',
  windowsterminal: '终端', powershell: '终端', pwsh: '终端', cmd: '终端', claude: 'Claude'
};

function dayRange(date) {
  const [y, m, d] = date.split('-').map(Number);
  return [new Date(y, m - 1, d).getTime(), new Date(y, m - 1, d + 1).getTime()];
}

// 当天改过的文件：跳过依赖和构建目录，不跟随链接，文件再多也有上限
async function scanFolder(root, date) {
  const [from, to] = dayRange(date);
  const found = [], stack = [root];
  let seen = 0;
  while (stack.length && seen < MAX_ENTRIES) {
    const dir = stack.pop();
    let entries;
    try { entries = await fs.promises.readdir(dir, { withFileTypes: true }); } catch (e) { continue; }
    for (const e of entries) {
      if (++seen > MAX_ENTRIES) break;
      const fp = path.join(dir, e.name);
      if (e.isDirectory()) { if (!SKIP.has(e.name)) stack.push(fp); continue; }
      if (!e.isFile()) continue;
      try {
        const t = (await fs.promises.stat(fp)).mtimeMs;
        if (t >= from && t < to) found.push({ rel: path.relative(root, fp).replace(/\\/g, '/'), t });
      } catch (err) {}
    }
  }
  found.sort((a, b) => b.t - a.t);
  const exts = {};
  found.forEach((f) => { const x = path.extname(f.rel).toLowerCase() || '无后缀'; exts[x] = (exts[x] || 0) + 1; });
  return { name: path.basename(root), files: found.length, exts, recent: found.slice(0, 12).map((f) => f.rel), truncated: seen > MAX_ENTRIES };
}

function git(dir, args) {
  return new Promise((resolve) => {
    execFile('git', ['--no-pager', '-C', dir].concat(args), { windowsHide: true, timeout: 10000, maxBuffer: 4 * 1024 * 1024, encoding: 'utf8' },
      (err, out) => resolve(err ? null : out));
  });
}

function parseGitLog(out, email) {
  const r = { commits: [], insertions: 0, deletions: 0 };
  out.split('\x01').slice(1).forEach((chunk) => {
    const lines = chunk.split('\n'), head = lines[0].split('\x02');
    if (email && head[0].toLowerCase() !== email) return;
    r.commits.push((head[1] || '').slice(0, 80));
    const stat = lines.slice(1).join(' ');
    const add = /(\d+) insertion/.exec(stat), del = /(\d+) deletion/.exec(stat);
    if (add) r.insertions += +add[1];
    if (del) r.deletions += +del[1];
  });
  return r;
}

// 只算自己的提交（别人的提交拉下来不算你做的）
async function gitDay(dir, date) {
  const email = ((await git(dir, ['config', 'user.email'])) || '').trim().toLowerCase();
  const out = await git(dir, ['log', '--all', '--no-merges', '--no-ext-diff', '--no-textconv', '--shortstat', '--format=%x01%ae%x02%s',
    '--since=' + date + ' 00:00:00', '--until=' + date + ' 23:59:59']);
  if (out == null) return null;
  return Object.assign({ name: path.basename(dir) }, parseGitLog(out, email));
}

// 选的文件夹本身是仓库，或者下一层有仓库（选了放项目的总文件夹）
function findRepos(folder) {
  if (fs.existsSync(path.join(folder, '.git'))) return [folder];
  try {
    return fs.readdirSync(folder, { withFileTypes: true })
      .filter((e) => e.isDirectory() && fs.existsSync(path.join(folder, e.name, '.git')))
      .map((e) => path.join(folder, e.name));
  } catch (e) { return []; }
}

async function collect(folders, date, usage, tracking) {
  const live = folders.filter((f) => fs.existsSync(f));
  const ev = { date, folderCount: folders.length, missing: folders.filter((f) => !live.includes(f)), folders: [], repos: [], tracking: !!tracking, usage: usage.days[date] || {} };
  for (const f of live) {
    ev.folders.push(await scanFolder(f, date));
    for (const repo of findRepos(f)) {
      const g = await gitDay(repo, date);
      if (g) ev.repos.push(g);
    }
  }
  return ev;
}

/* ---------- 开发软件时长 ---------- */
function isDev(proc) { return !!DEV_APPS[String(proc).toLowerCase()]; }
function isSelf(proc) { return /^(PEAN的开发小天地|electron)$/i.test(proc); }

// 只记开发软件；30 天以前的自动删掉
function addSample(usage, date, proc, sec) {
  const label = DEV_APPS[String(proc).toLowerCase()];
  if (!label) return false;
  const day = usage.days[date] || (usage.days[date] = {});
  day[label] = (day[label] || 0) + sec;
  const old = new Date(Date.parse(date) - 30 * 864e5).toISOString().slice(0, 10);
  Object.keys(usage.days).forEach((d) => { if (d < old) delete usage.days[d]; });
  return true;
}

// PowerShell 每 15 秒报一次前台进程名和无操作秒数；主程序没了它自己退出
function trackerScript(pid, interval) {
  return "$ErrorActionPreference='SilentlyContinue';[Console]::OutputEncoding=[Text.Encoding]::UTF8;" +
    "Add-Type -TypeDefinition 'using System;using System.Runtime.InteropServices;public static class PeanFg{" +
    "[DllImport(\"user32.dll\")]public static extern IntPtr GetForegroundWindow();" +
    "[DllImport(\"user32.dll\")]public static extern uint GetWindowThreadProcessId(IntPtr h,out uint p);" +
    "[StructLayout(LayoutKind.Sequential)]public struct LI{public uint s;public uint t;}" +
    "[DllImport(\"user32.dll\")]public static extern bool GetLastInputInfo(ref LI i);" +
    "public static long Idle(){LI i=new LI();i.s=8;GetLastInputInfo(ref i);return (uint)((uint)Environment.TickCount-i.t)/1000;}}';" +
    "while($true){if(-not(Get-Process -Id " + pid + ")){exit};$p=0;" +
    "[void][PeanFg]::GetWindowThreadProcessId([PeanFg]::GetForegroundWindow(),[ref]$p);" +
    "$n=(Get-Process -Id $p).ProcessName;[Console]::WriteLine($n+[char]9+[PeanFg]::Idle());" +
    "[Console]::Out.Flush();Start-Sleep -Seconds " + interval + "}";
}

const INTERVAL = 15, IDLE_LIMIT = 300;

// onSample(进程名, 秒数, 是否离开电脑)：离开超过 5 分钟算离开；睡眠醒来的那段时间不算
function startTracker(onSample, interval) {
  const step = interval || INTERVAL;
  const child = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', trackerScript(process.pid, step)], { windowsHide: true, stdio: ['ignore', 'pipe', 'ignore'] });
  let buf = '', last = Date.now();
  child.stdout.setEncoding('utf8');
  child.stdout.on('data', (s) => {
    buf += s;
    const lines = buf.split(/\r?\n/);
    buf = lines.pop();
    lines.forEach((line) => {
      const [proc, idle] = line.split('\t'), now = Date.now(), gap = (now - last) / 1000;
      last = now;
      if (proc) onSample(proc, Math.min(gap, step * 2), +idle >= IDLE_LIMIT);
    });
  });
  child.on('error', () => {});
  return () => { try { child.kill(); } catch (e) {} };
}

module.exports = { DEV_APPS, SKIP, isDev, isSelf, scanFolder, parseGitLog, gitDay, findRepos, collect, addSample, startTracker };
