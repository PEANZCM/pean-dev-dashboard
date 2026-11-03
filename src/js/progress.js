// ============================================================
//  进度视图：路线图、日历 + 当日详情（心情/日记/截图）、热力图
// ============================================================

var calMonth = new Date();
var selectedDate = null;

// ===== 路线图：直接读规划数据，编辑后立即同步 =====
// 原来的「时间规划」表并进来了：每个节点带时间、核心产出和阶段进度
function renderRoadmap() {
  var cur = Plan.currentStage(S.plan, S.progress);
  var t = Plan.totals(S.plan, S.progress);
  $('roadmapHint').textContent = S.plan.stages.length + ' 个阶段 · 总进度 ' + t.pct + '%';
  $('roadmapFlow').innerHTML = S.plan.stages.map(function (s) {
    var st = Plan.stageStats(s, S.progress);
    var state = Plan.isStageDone(s, S.progress) ? 'done' : cur && s.id === cur.id ? 'current' : '';
    return '<div class="rm-node ' + state + '">' +
      '<div class="rm-top"><div class="rm-icon">' + iconSvg(state === 'done' ? 'check' : s.icon || 'star') + '</div>' +
      '<div class="rm-time">' + escapeHtml(s.time || '—') + '</div></div>' +
      '<div class="rm-title">' + escapeHtml(s.title) + '</div>' +
      (s.output ? '<div class="rm-output">' + escapeHtml(s.output) + '</div>' : '') +
      '<div class="rm-bar"><i style="width:' + (st.total ? Math.round(st.done / st.total * 100) : 0) + '%"></i></div>' +
      '<div class="rm-count">' + st.done + ' / ' + st.total + '</div></div>';
  }).join('');
}

// ===== 日历 =====
function renderCalendar() {
  var y = calMonth.getFullYear(), m = calMonth.getMonth();
  $('calTitle').textContent = y + '年 ' + Dates.MONTHS[m];
  var startWeekday = new Date(y, m, 1).getDay();
  var daysInMonth = new Date(y, m + 1, 0).getDate();
  var prevDays = new Date(y, m, 0).getDate();
  var today = Dates.today(), html = '', i;
  for (i = startWeekday - 1; i >= 0; i--) html += '<div class="cal-cell other-month"><span class="cal-day-num">' + (prevDays - i) + '</span></div>';
  for (var d = 1; d <= daysInMonth; d++) {
    var ds = Dates.fmt(new Date(y, m, d));
    var future = ds > today;
    var mood = S.mood.moods[ds];
    var hasDiary = S.diary.entries[ds] && S.diary.entries[ds].trim();
    var cls = 'cal-cell' + (isCheckedIn(ds) ? ' checked' : future ? '' : ' unchecked') + (future ? ' future' : '') +
      (ds === today ? ' today' : '') + (ds === selectedDate ? ' selected' : '');
    html += '<div class="' + cls + '" data-date="' + ds + '"><span class="cal-day-num">' + d + '</span>' +
      (mood ? '<span class="cal-mood">' + escapeHtml(mood) + '</span>' : '') +
      (hasDiary ? '<span class="cal-diary-dot"></span>' : '') + '</div>';
  }
  var remaining = (7 - (startWeekday + daysInMonth) % 7) % 7;
  for (i = 1; i <= remaining; i++) html += '<div class="cal-cell other-month"><span class="cal-day-num">' + i + '</span></div>';
  var grid = $('calGrid');
  grid.innerHTML = html;
  grid.querySelectorAll('.cal-cell[data-date]').forEach(function (cell) {
    cell.addEventListener('click', function () { openDayDetail(cell.dataset.date); });
  });
}

// ===== 当天详情：固定在日历右边，默认显示今天，点日历换日子 =====
function openDayDetail(dateStr) {
  if (selectedDate && selectedDate !== dateStr) saveDiary();
  selectedDate = dateStr;
  document.querySelectorAll('.cal-cell[data-date]').forEach(function (c) { c.classList.toggle('selected', c.dataset.date === dateStr); });
  $('dayDetailDate').textContent = (dateStr === Dates.today() ? '今天 · ' : '') + Dates.cn(dateStr);
  var status = $('dayDetailStatus');
  var checked = isCheckedIn(dateStr);
  status.textContent = checked ? '✓ 已打卡' : '未打卡';
  status.className = 'day-detail-status' + (checked ? '' : ' not-checked');
  var mood = S.mood.moods[dateStr] || '';
  document.querySelectorAll('.mood-btn').forEach(function (b) { b.classList.toggle('selected', !!mood && b.dataset.mood === mood); });
  $('diaryText').value = S.diary.entries[dateStr] || '';
  toggleDiaryMode(false, true);
  renderScreenshots(dateStr);
}

function setMood(mood) {
  if (!selectedDate) return;
  if (mood) S.mood.moods[selectedDate] = mood;
  else delete S.mood.moods[selectedDate];
  Store.save('mood.json', S.mood);
  document.querySelectorAll('.mood-btn').forEach(function (b) { b.classList.toggle('selected', !!mood && b.dataset.mood === mood); });
  renderCalendar();
  showToast(mood ? '心情已记录' : '心情已清除');
}

function saveDiary() {
  if (!selectedDate) return;
  var text = $('diaryText').value;
  if (text.trim()) S.diary.entries[selectedDate] = text;
  else delete S.diary.entries[selectedDate];
  Store.save('diary.json', S.diary);
  renderCalendar();
}

function toggleDiaryMode(preview, silent) {
  $('diaryText').style.display = preview ? 'none' : '';
  $('diaryPreview').style.display = preview ? '' : 'none';
  $('diaryEditBtn').classList.toggle('active', !preview);
  $('diaryPreviewBtn').classList.toggle('active', preview);
  if (preview && !silent) {
    saveDiary();
    $('diaryPreview').innerHTML = parseMarkdown($('diaryText').value);
  }
}

// ===== 截图记录 =====
async function uploadScreenshots() {
  if (!selectedDate) return;
  var date = selectedDate;
  var files = await dashboardAPI.openImage();
  if (!files || !files.length) return;
  (S.shots.shots[date] = S.shots.shots[date] || []).push.apply(S.shots.shots[date], files);
  Store.save('screenshots.json', S.shots);
  renderScreenshots(date);
  showToast('上传了 ' + files.length + ' 张截图');
}

function renderScreenshots(dateStr) {
  var grid = $('screenshotGrid');
  var shots = S.shots.shots[dateStr] || [];
  if (!shots.length) { grid.innerHTML = '<div class="screenshot-empty">还没有截图记录</div>'; return; }
  grid.innerHTML = '';
  shots.forEach(function (name, idx) {
    var item = document.createElement('div');
    item.className = 'screenshot-item';
    var img = document.createElement('img');
    var del = document.createElement('div');
    del.className = 'screenshot-delete';
    del.textContent = '✕';
    del.addEventListener('click', function (e) { e.stopPropagation(); deleteScreenshot(dateStr, idx); });
    item.appendChild(img);
    item.appendChild(del);
    grid.appendChild(item);   // 先按顺序占位，图片异步填充，顺序不会乱
    dashboardAPI.readScreenshot(name).then(function (src) { if (src) img.src = src; });
  });
}

function deleteScreenshot(dateStr, idx) {
  var shots = S.shots.shots[dateStr] || [];
  if (idx < 0 || idx >= shots.length) return;
  dashboardAPI.deleteScreenshot(shots[idx]);
  shots.splice(idx, 1);
  if (!shots.length) delete S.shots.shots[dateStr];
  Store.save('screenshots.json', S.shots);
  renderScreenshots(dateStr);
  showToast('截图已删除');
}

// ===== 热力图：最近一年 =====
// 每一列是一周（周日在最上），每一格是一天；53 列按宽度等分，不横向滚动。
// 为了看得懂：左边标星期，上面标月份（跨年处带年份），相邻月份深浅交替，
// 今天描边，鼠标移上去显示具体日期，点一下跳到那天的详情
var WEEKS = 53;

function heatDays() {
  var start = Dates.parse(Dates.offset(-364));
  start.setDate(start.getDate() - start.getDay());
  var out = [];
  for (var i = 0; i < WEEKS * 7; i++) {
    var d = new Date(start);
    d.setDate(d.getDate() + i);
    out.push(d);
  }
  return out;
}

// 一段日期里最长的连续打卡天数
function longestRun(days) {
  var best = 0, run = 0;
  days.forEach(function (d) {
    run = isCheckedIn(Dates.fmt(d)) ? run + 1 : 0;
    if (run > best) best = run;
  });
  return best;
}

function renderHeatmap() {
  var today = Dates.today(), days = heatDays();
  var cells = '', labels = '', lastMonth = -1, count = 0;
  ['日', '一', '二', '三', '四', '五', '六'].forEach(function (w, i) {
    cells += '<span class="hm-wd">' + (i % 2 ? w : '') + '</span>';
  });
  days.forEach(function (d, i) {
    var ds = Dates.fmt(d), week = Math.floor(i / 7);
    var state = ds > today ? 'hm-future' : isCheckedIn(ds) ? 'hm-4' : 'hm-0';
    if (state === 'hm-4') count++;
    cells += '<span class="hm-cell ' + state + (d.getMonth() % 2 ? ' alt' : '') + (ds === today ? ' hm-today' : '') + '" data-date="' + ds + '"></span>';
    // 月份标签放在这个月 1 号所在的那一列；第一列补上起始月份
    if (d.getMonth() !== lastMonth && (d.getDate() === 1 || i === 0)) {
      lastMonth = d.getMonth();
      var withYear = i === 0 || d.getMonth() === 0;
      // 靠近右边缘的标签贴着最后一列右对齐，免得溢出卡片
      var pos = week > WEEKS - 3 ? 'grid-column:-2;justify-self:end' : 'grid-column:' + (week + 2);
      labels += '<span style="' + pos + '">' + (withYear ? d.getFullYear() + '年' : '') + (d.getMonth() + 1) + '月</span>';
    }
  });
  $('heatmapMonths').innerHTML = labels;
  $('heatmapGrid').innerHTML = cells;
  var monthCount = S.checkin.dates.filter(function (ds) { return ds.slice(0, 7) === today.slice(0, 7); }).length;
  $('heatmapSummary').textContent = '最近一年打卡 ' + count + ' 天 · 最长连续 ' + longestRun(days) + ' 天 · 本月 ' + monthCount + ' 天';
}

function heatTip(ds) {
  var d = Dates.parse(ds), today = Dates.today();
  var s = d.getFullYear() + '年' + Dates.cn(ds);
  if (ds > today) return s + ' · 还没到';
  s += ds === today ? ' · 今天' : '';
  s += isCheckedIn(ds) ? ' · 已打卡' : ' · 未打卡';
  if (S.mood.moods[ds]) s += ' ' + S.mood.moods[ds];
  if (S.diary.entries[ds] && S.diary.entries[ds].trim()) s += ' · 有日记';
  return s;
}

function bindHeatmap() {
  var grid = $('heatmapGrid'), tip = $('hmTip'), box = $('heatmap');
  grid.addEventListener('mouseover', function (e) {
    var c = e.target.closest('.hm-cell');
    if (!c) return;
    tip.textContent = heatTip(c.dataset.date);
    var r = c.getBoundingClientRect(), b = box.getBoundingClientRect();
    tip.style.display = 'block';
    var x = r.left - b.left + r.width / 2;
    x = Math.max(tip.offsetWidth / 2, Math.min(b.width - tip.offsetWidth / 2, x));
    tip.style.left = x + 'px';
    tip.style.top = (r.top - b.top - 8) + 'px';
  });
  grid.addEventListener('mouseleave', function () { tip.style.display = 'none'; });
  grid.addEventListener('click', function (e) {
    var c = e.target.closest('.hm-cell');
    if (!c || c.dataset.date > Dates.today()) return;
    var d = Dates.parse(c.dataset.date);
    calMonth = new Date(d.getFullYear(), d.getMonth(), 1);
    renderCalendar();
    openDayDetail(c.dataset.date);
    $('dayDetail').scrollIntoView({ behavior: 'smooth', block: 'center' });
  });
}
