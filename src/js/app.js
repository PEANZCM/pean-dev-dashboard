// ============================================================
//  启动：加载数据（首次运行自动迁移规划）、事件绑定、跨天检测、晚间提醒
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
  'settings.json': { darkMode: false, reminderHour: 20, lastReminded: null },
  'screenshots.json': { shots: {} }
};
var KEYS = { checkin: 'checkin.json', streak: 'streak.json', flame: 'flame.json', medals: 'medals.json', diary: 'diary.json', mood: 'mood.json', quotes: 'quotes.json', settings: 'settings.json', shots: 'screenshots.json' };

async function loadAll() {
  for (var k in KEYS) S[k] = await Store.load(KEYS[k], JSON.parse(JSON.stringify(DEFAULTS[KEYS[k]])));
  ['blue', 'purple', 'crimson', 'gold'].forEach(function (t) {
    S.medals.labelMemory = S.medals.labelMemory || {};
    S.medals.labelMemory[t] = S.medals.labelMemory[t] || [];
  });
  if (S.settings.reminderHour == null) S.settings.reminderHour = 20;

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
  showDailyQuote(); renderCustomQuotes();
}

// ===== 跨天 + 晚间提醒：每分钟检查一次 =====
var currentDate = '';
function tick() {
  var now = Dates.today();
  if (now !== currentDate) {
    currentDate = now;
    if (Rules.detectBreak(S)) saveRules();
    renderToday(); renderCheckin(); renderFlames(); renderStreakDots(); renderCalendar(); renderHeatmap();
  }
  // 旧版只在启动和跨天时检查，软件开着过 20 点不会提醒；现在每分钟检查，每天最多一次
  if (new Date().getHours() >= S.settings.reminderHour && !isCheckedIn(now) && S.settings.lastReminded !== now) {
    S.settings.lastReminded = now;
    Store.save('settings.json', S.settings);
    dashboardAPI.showNotification('PEAN的开发小天地', '今天还没打卡哦！坚持下去，别断了连续天数');
  }
}

// ===== 设置 =====
function applyTheme() {
  document.body.classList.toggle('dark', !!S.settings.darkMode);
  $('settingsThemeToggle').classList.toggle('on', !!S.settings.darkMode);
}
function toggleDarkMode() {
  S.settings.darkMode = !S.settings.darkMode;
  Store.save('settings.json', S.settings);
  applyTheme();
}

async function resetProgress() {
  // 只清进度，保留你的人生规划本身
  S.checkin = { dates: [] };
  S.streak = JSON.parse(JSON.stringify(DEFAULTS['streak.json']));
  S.flame = { total: 0 };
  S.medals = JSON.parse(JSON.stringify(DEFAULTS['medals.json']));
  S.progress = { done: {} };
  S.diary = { entries: {} };
  S.mood = { moods: {} };
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

  on('medalWallBtn', function () { renderMedalWall(); $('medalWallView').style.display = 'block'; });
  on('medalWallBack', function () { $('medalWallView').style.display = 'none'; });

  on('calPrev', function () { calMonth.setMonth(calMonth.getMonth() - 1); renderCalendar(); });
  on('calNext', function () { calMonth.setMonth(calMonth.getMonth() + 1); renderCalendar(); });
  on('calToday', function () { calMonth = new Date(); renderCalendar(); });

  on('dayDetailClose', closeDayDetail);
  document.querySelectorAll('.mood-btn').forEach(function (b) { b.addEventListener('click', function () { setMood(b.dataset.mood); }); });
  on('diaryEditBtn', function () { toggleDiaryMode(false); });
  on('diaryPreviewBtn', function () { toggleDiaryMode(true); });
  $('diaryText').addEventListener('blur', saveDiary);
  on('uploadShotBtn', uploadScreenshots);

  on('quoteRefresh', refreshQuote);
  on('quoteAdd', addCustomQuote);
  on('quoteSave', saveCustomQuote);
  on('quoteCancel', function () { $('quoteModal').style.display = 'none'; });

  on('editTasksBtn', openTaskEditor);
  on('taskSave', saveTaskEdits);
  on('taskCancel', function () { $('taskModal').style.display = 'none'; });

  on('settingsThemeToggle', toggleDarkMode);
  on('settingsExport', async function () { showToast(await dashboardAPI.exportBackup() ? '备份已导出' : '导出取消'); });
  on('settingsImport', async function () {
    if (await dashboardAPI.importBackup()) { showToast('备份已导入，即将刷新'); setTimeout(function () { location.reload(); }, 1000); }
  });
  on('settingsReset', function () { $('settingsResetConfirm').style.display = 'inline-flex'; });
  on('settingsResetYes', resetProgress);
  on('settingsResetNo', function () { $('settingsResetConfirm').style.display = 'none'; });

  document.querySelectorAll('.modal').forEach(function (m) {
    if (m.id === 'settingsModal') return;   // 设置弹窗有自己的关闭动画
    m.addEventListener('click', function (e) { if (e.target === m) m.style.display = 'none'; });
  });
}

async function init() {
  await loadAll();
  currentDate = Dates.today();
  if (Rules.detectBreak(S)) saveRules();
  applyTheme();
  renderAll();
  loadAboutIcon();
  bindEvents();
  tick();
  setInterval(tick, 60 * 1000);
}

init();
