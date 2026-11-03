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

// ===== 热力图：最近一年，按周排列；53 列按容器宽度等分，不再横向滚动 =====
function renderHeatmap() {
  var WEEKS = 53;
  var today = Dates.today();
  var start = Dates.parse(Dates.offset(-364));
  start.setDate(start.getDate() - start.getDay());
  var months = [], cur = -1, gh = '';
  for (var w = 0; w < WEEKS; w++) {
    var col = '', monthStart = false;
    for (var d = 0; d < 7; d++) {
      var day = new Date(start);
      day.setDate(day.getDate() + w * 7 + d);
      var ds = Dates.fmt(day);
      var cls = ds > today ? 'hm-future' : isCheckedIn(ds) ? 'hm-4' : 'hm-0';
      col += '<span class="hm-cell ' + cls + '" title="' + ds + '"></span>';
      if (d === 0 && day.getMonth() !== cur) {
        cur = day.getMonth();
        months.push({ week: w, label: (cur + 1) + '月' });
        monthStart = true;
      }
    }
    gh += '<div class="heatmap-col' + (monthStart && w > 0 ? ' month-sep' : '') + '">' + col + '</div>';
  }
  // 月份标签按百分比定位；两个标签挨得太近（不足 3 周）时跳过前一个，避免重叠
  $('heatmapMonths').innerHTML = months.filter(function (mp, i) {
    return i === months.length - 1 || months[i + 1].week - mp.week >= 3;
  }).map(function (mp) {
    return '<span style="left:' + (mp.week / WEEKS * 100).toFixed(2) + '%">' + mp.label + '</span>';
  }).join('');
  $('heatmapGrid').innerHTML = gh;
}
