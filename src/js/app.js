// ============================================================
//  启动：加载数据（首次运行自动迁移规划）、外观、事件绑定、跨天检测、晚间提醒
// ============================================================

var S = {};   // 全部状态，各视图模块共享

var DEFAULTS = {
  'checkin.json': { dates: [] },
  'streak.json': { current: 0, startDate: null, lastUpdate: null },
  'flame.json': { total: 0 },
  'medals.json': { liveMedal: null, frozenMedals: [], labelMemory: { blue: [], purple: [], crimson: [], gold: [] }, grandSlam: 0 },
  'diary.json': { entries: {} },
  'mood.json': { moods: {} },
  'quotes.json': { custom: [], lastShownDate: null, currentQuote: null },
  'settings.json': { darkMode: false, reminderHour: 20, lastReminded: null, wallpaper: 'auto', wallAnimated: true, glass: 'balanced', motion: 'full' },
  'screenshots.json': { shots: {} },
  'ai.json': { opener: null, review: null },
  'daily.json': { plans: {}, reviews: {}, chats: {}, study: { running: null, sessions: {} } },
  'chat.json': { messages: [] }
};
var KEYS = { chat: 'chat.json', checkin: 'checkin.json', streak: 'streak.json', flame: 'flame.json', medals: 'medals.json', diary: 'diary.json', mood: 'mood.json', quotes: 'quotes.json', settings: 'settings.json', shots: 'screenshots.json', ai: 'ai.json', daily: 'daily.json' };

async function loadAll() {
  for (var k in KEYS) S[k] = await Store.load(KEYS[k], JSON.parse(JSON.stringify(DEFAULTS[KEYS[k]])));
  ['blue', 'purple', 'crimson', 'gold'].forEach(function (t) {
    S.medals.labelMemory = S.medals.labelMemory || {};
    S.medals.labelMemory[t] = S.medals.labelMemory[t] || [];
  });
  S.daily.study = S.daily.study || { running: null, sessions: {} };
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  [['reminderHour', 20], ['wallpaper', 'auto'], ['wallAnimated', true], ['glass', 'balanced'], ['motion', reduce ? 'reduced' : 'full'], ['aiTone', 'warm'], ['aiModel', 'auto'], ['aiDiary', false], ['aiMood', false], ['aiGate', false]].forEach(function (kv) {
    if (S.settings[kv[0]] == null) S.settings[kv[0]] = kv[1];
  });

  // 规划：没有 plan.json 就从旧 tasks.json 迁移（旧文件不动）
  var plan = await Store.load('plan.json', null);
  if (plan && plan.schema === Plan.SCHEMA) {
    S.plan = plan;
    S.plan.archived = S.plan.archived || [];
    S.progress = await Store.load('progress.json', { done: {} });
  } else {
    var old = await Store.load('tasks.json', null);
    var m = Plan.migrate(old);
    S.plan = m.plan; S.progress = m.progress;
    await Store.save('plan.json', S.plan);
    await Store.save('progress.json', S.progress);
    await Store.save('meta.json', { schema: Plan.SCHEMA, migratedAt: new Date().toISOString(), from: old ? 'tasks.json' : 'default' });
  }
}

function renderAll() {
  renderToday(); renderCheckin(); renderFlames(); renderStreakDots();
  renderPlanViews(); renderCalendar(); renderHeatmap();
  showDailyQuote(); renderCustomQuotes(); renderReview();
}

// ===== 跨天 + 晚间提醒：每分钟检查一次 =====
var currentDate = '';
function tick() {
  var now = Dates.today();
  if (now !== currentDate) {
    currentDate = now;
    if (Rules.detectBreak(S)) saveRules();
    renderToday(); renderCheckin(); renderFlames(); renderStreakDots(); renderCalendar(); renderHeatmap(); renderPlanCard();
  }
  dailyTick();
  $('greeting').textContent = greeting();
  // 旧版只在启动和跨天时检查，软件开着过 20 点不会提醒；现在每分钟检查，每天最多一次
  if (new Date().getHours() >= S.settings.reminderHour && !isCheckedIn(now) && S.settings.lastReminded !== now) {
    S.settings.lastReminded = now;
    Store.save('settings.json', S.settings);
    reminderText().then(function (t) { dashboardAPI.showNotification('PEAN的开发小天地', t); });
  }
}

// ===== 外观：玻璃 / 动效 / 壁纸 =====
// 哪些元素是什么玻璃：按钮自身是玻璃；卡片、顶栏、标签栏、弹层是「容器玻璃」
var GLASS_MAP = [
  ['#viewTabs', 'tabs'], ['#tabGlider', 'glider'], ['.card', 'card'], ['.sheet', 'sheet'],
  ['.checkin-btn', 'blue'], ['.pill-btn.primary', 'blue'], ['.pill-btn.tint', 'tint'],
  ['.pill-btn', 'clear'], ['.icon-btn', 'clear'], ['.mood-btn', 'clear'], ['.seg-btn', 'clear'],
  ['.set-nav-btn.active', 'tint'], ['.set-nav-btn', 'clear'],
  ['.task-edit-add-btn', 'tint'], ['.task-edit-del-btn', 'clear']
];
var PRESS = '.pill-btn, .icon-btn, .checkin-btn, .mood-btn, .seg-btn, .set-nav-btn, .task-edit-add-btn, .task-edit-del-btn';

// 给一块区域里的按钮都装上玻璃和弹簧（编辑器这种动态生成的内容也要调用）
function decorate(root) {
  GLASS_MAP.forEach(function (m) {
    root.querySelectorAll(m[0]).forEach(function (el) { if (!el.hasAttribute('data-glass')) el.setAttribute('data-glass', m[1]); });
  });
  root.querySelectorAll('[data-glass]').forEach(Glass.register);
  root.querySelectorAll(PRESS).forEach(Motion.pressable);
  Glass.relayout();
}

function setupLook() {
  GLASS_MAP.forEach(function (m) {
    document.querySelectorAll(m[0]).forEach(function (el) { if (!el.hasAttribute('data-glass')) el.setAttribute('data-glass', m[1]); });
  });
  Wallpaper.init();
  Glass.init();
  document.querySelectorAll(PRESS).forEach(Motion.pressable);
}

var wallImage = null;
async function applyWallpaper() {
  var w = S.settings.wallpaper;
  if (w === 'image' && !wallImage) wallImage = await dashboardAPI.readWallpaper();
  if (w === 'image' && !wallImage) w = 'auto';          // 图片丢了就退回跟随主题
  Wallpaper.set(w, !!S.settings.darkMode, wallImage);
  Wallpaper.setAnimated(S.settings.wallAnimated);
}

function applyTheme() {
  var s = S.settings;
  document.body.classList.toggle('dark', !!s.darkMode);
  $('settingsThemeToggle').classList.toggle('on', !!s.darkMode);
  $('wallAnimToggle').classList.toggle('on', !!s.wallAnimated);
  $('reminderHour').value = String(s.reminderHour);
  $('wallpaperSelect').value = s.wallpaper;
  $('glassSelect').value = s.glass;
  $('motionSelect').value = s.motion;
  Glass.setDark(s.darkMode);
  setOrbTheme(!!s.darkMode);
  Glass.setQuality(s.glass);
  Motion.setLevel(s.motion);
  applyWallpaper();
}

function saveSetting(k, v) {
  S.settings[k] = v;
  Store.save('settings.json', S.settings);
  applyTheme();
}
function toggleDarkMode() { saveSetting('darkMode', !S.settings.darkMode); }

async function resetProgress() {
  // 只清进度，保留你的人生规划本身
  S.checkin = { dates: [] };
  S.streak = JSON.parse(JSON.stringify(DEFAULTS['streak.json']));
  S.flame = { total: 0 };
  S.medals = JSON.parse(JSON.stringify(DEFAULTS['medals.json']));
  S.progress = { done: {} };
  S.diary = { entries: {} };
  S.mood = { moods: {} };
  S.ai = { opener: null, review: null };   // AI 的开场白和复盘是根据旧进度写的，一起清掉
  Store.save('ai.json', S.ai);
  S.daily = JSON.parse(JSON.stringify(DEFAULTS['daily.json']));
  await Store.save('daily.json', S.daily);
  await Store.save('chat.json', { messages: [] });
  saveRules();
  await Store.save('progress.json', S.progress);
  await Store.save('diary.json', S.diary);
  await Store.save('mood.json', S.mood);
  location.reload();
}

function loadAboutIcon() {
  dashboardAPI.getAppIcon().then(function (url) {
    if (!url) return;
    $('aboutIconImg').src = url;
    $('aboutIconImg').style.display = '';
    $('aboutIconFallback').style.display = 'none';
  }).catch(function () {});
}

function on(id, fn) { $(id).addEventListener('click', fn); }

function bindEvents() {
  on('checkinBtn', doCheckin);
  on('makeupBtn', doMakeup);
  on('cancelCheckinBtn', cancelCheckin);

  on('medalWallBtn', function () { renderMedalWall(); openSheet('medalSheet'); });
  on('settingsBtn', function () { $('settingsResetConfirm').style.display = 'none'; openSheet('settingsSheet'); });
  on('aboutRepo', function () { dashboardAPI.openExternal('https://github.com/PEANZCM/pean-dev-dashboard'); });

  on('calPrev', function () { calMonth.setMonth(calMonth.getMonth() - 1); renderCalendar(); });
  on('calNext', function () { calMonth.setMonth(calMonth.getMonth() + 1); renderCalendar(); });
  on('calToday', function () { calMonth = new Date(); renderCalendar(); });

  document.querySelectorAll('.mood-btn').forEach(function (b) { b.addEventListener('click', function () { setMood(b.dataset.mood); }); });
  on('diaryEditBtn', function () { toggleDiaryMode(false); });
  on('diaryPreviewBtn', function () { toggleDiaryMode(true); });
  $('diaryText').addEventListener('blur', saveDiary);
  // 边写边存（停笔 0.8 秒），关窗口前再存一次，不会因为关软件丢掉正在写的日记
  var diaryTimer = 0;
  $('diaryText').addEventListener('input', function () { clearTimeout(diaryTimer); diaryTimer = setTimeout(saveDiary, 800); });
  window.addEventListener('beforeunload', saveDiary);
  on('uploadShotBtn', uploadScreenshots);

  on('quoteRefresh', refreshQuote);
  on('quoteAdd', addCustomQuote);
  on('quoteSave', saveCustomQuote);
  on('quoteCancel', function () { closeSheet(); });
  on('customQuotesToggle', toggleCustomQuotes);

  on('editTasksBtn', openTaskEditor);
  on('taskSave', saveTaskEdits);
  on('taskCancel', function () { closeSheet(); });

  on('settingsThemeToggle', toggleDarkMode);
  on('settingsExport', async function () { showToast(await dashboardAPI.exportBackup() ? '备份已导出' : '导出取消'); });
  on('settingsImport', async function () {
    if (await dashboardAPI.importBackup()) { showToast('备份已导入，即将刷新'); setTimeout(function () { location.reload(); }, 1000); }
  });
  on('settingsReset', function () { $('settingsResetConfirm').style.display = 'flex'; });
  $('reminderHour').addEventListener('change', function () {
    S.settings.reminderHour = +this.value;
    Store.save('settings.json', S.settings);
    showToast(S.settings.reminderHour > 23 ? '已关闭打卡提醒' : '每天 ' + S.settings.reminderHour + ':00 后没打卡会提醒你');
  });
  on('wallAnimToggle', function () { saveSetting('wallAnimated', !S.settings.wallAnimated); });
  $('glassSelect').addEventListener('change', function () { saveSetting('glass', this.value); });
  $('motionSelect').addEventListener('change', function () { saveSetting('motion', this.value); });
  $('wallpaperSelect').addEventListener('change', async function () {
    if (this.value !== 'image') { saveSetting('wallpaper', this.value); return; }
    var src = await dashboardAPI.pickWallpaper();      // 主进程复制一份到数据目录
    if (src) { wallImage = src; saveSetting('wallpaper', 'image'); showToast('壁纸已更换'); }
    else this.value = S.settings.wallpaper;
  });
  on('settingsResetYes', resetProgress);
  on('settingsResetNo', function () { $('settingsResetConfirm').style.display = 'none'; });

}

async function init() {
  await loadAll();
  currentDate = Dates.today();
  if (Rules.detectBreak(S)) saveRules();
  setupLook();
  applyTheme();
  renderAll();
  openDayDetail(currentDate);
  loadAboutIcon();
  bindShell();
  bindHeatmap();
  bindEvents();
  bindAI();
  bindDaily();
  bindCompanion();
  await refreshAIStatus();
  startCompanion();      // 要在 tick 之前：tick 会刷新陪学心跳，先判断上次是不是断了
  tick();
  startDaily();
  startAI();
  setInterval(tick, 60 * 1000);
}

init();
