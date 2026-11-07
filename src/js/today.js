// ============================================================
//  打卡、火焰、7 天点阵、学习任务、总进度
// ============================================================

function saveRules() {
  Store.save('checkin.json', S.checkin);
  Store.save('streak.json', S.streak);
  Store.save('flame.json', S.flame);
  Store.save('medals.json', S.medals);
}

function isCheckedIn(dateStr) { return S.checkin.dates.indexOf(dateStr) !== -1; }
function currentStreak() { return Rules.computeStreak(new Set(S.checkin.dates)).n; }

function afterCheckinChange(res) {
  if (res.ok) saveRules();
  showToast(res.msg);
  renderCheckin(); renderFlames(); renderStreakDots(); renderCalendar(); renderHeatmap();
}
function doCheckin() {
  if (isCheckedIn(Dates.today())) { showToast('今天已经打卡了'); return; }
  guardCheckin(Dates.today());
}
function doMakeup() {
  if (isCheckedIn(Dates.yesterday())) { showToast('昨天已经打卡了'); return; }
  guardCheckin(Dates.yesterday());
}
function cancelCheckin() {
  dropPendingReview(Dates.today());
  afterCheckinChange(Rules.cancel(S));
}

function greeting() {
  var h = new Date().getHours();
  return h < 5 ? '夜深了' : h < 11 ? '早上好' : h < 13 ? '中午好' : h < 18 ? '下午好' : '晚上好';
}

// 打开软件第一眼：今天是哪天、现在在哪个阶段、还剩多少
function renderToday() {
  $('todayDate').textContent = Dates.cn(Dates.today());
  $('greeting').textContent = greeting();
  var cur = Plan.currentStage(S.plan, S.progress);
  if (!cur) {
    $('heroStage').textContent = S.plan.stages.length ? '全部阶段都完成了' : '还没有规划';
    $('heroStageSub').textContent = S.plan.stages.length ? '去「编辑规划」写下新的目标吧' : '点「编辑规划」开始写你的路线';
    $('heroRemain').textContent = '';
    return;
  }
  var idx = S.plan.stages.indexOf(cur), st = Plan.stageStats(cur, S.progress);
  $('heroStage').textContent = stageLabel(cur, idx);
  $('heroStageSub').textContent = stageSub(cur);
  $('heroRemain').textContent = st.total ? '这个阶段还剩 ' + (st.total - st.done) + ' 项 · 已完成 ' + st.done + ' / ' + st.total : '这个阶段还没有任务';
}

function setDisabled(btn, off) {
  btn.disabled = off;
  btn.style.opacity = off ? '0.4' : '';
  btn.style.cursor = off ? 'not-allowed' : '';
}

function renderCheckin() {
  var checked = isCheckedIn(Dates.today());
  var btn = $('checkinBtn');
  btn.classList.toggle('done', checked);
  btn.setAttribute('data-glass', checked ? 'green' : 'blue');   // 有色液态玻璃：没打卡蓝、打完绿
  Glass.refresh(btn);
  btn.querySelector('.checkin-label').textContent = checked ? '今日已打卡' : gateOn() ? '申请打卡' : '今日打卡';
  btn.querySelector('.checkin-emoji').innerHTML = iconSvg(checked ? 'check' : 'book');
  setDisabled($('makeupBtn'), isCheckedIn(Dates.yesterday()));
  setDisabled($('cancelCheckinBtn'), !checked);
  var n = currentStreak();
  $('streakCount').textContent = n;
  $('medalHint').textContent = medalHintText(n);
}

// 连续天数下面的一句话：离下一枚奖章还有多远
function medalHintText(n) {
  var order = Rules.ORDER, tier = Rules.getTier(n), next = order[order.indexOf(tier) + 1];
  if (!next) return '已达到最高等级 · ' + Rules.TIERS[tier].name;
  var left = Rules.TIERS[next].min - n;
  return (tier === 'none' ? '再坚持 ' : '距' + Rules.TIERS[next].name + '还差 ') + left + ' 天' + (tier === 'none' ? '拿到第一枚奖章' : '');
}

function renderFlames() {
  var total = S.flame.total, bd = Rules.flameBreakdown(total);
  var streak = currentStreak(), supers = Rules.superFlames(streak);
  var el = $('flameDisplay'), countEl = $('flameCount');
  if (total === 0 && !supers.length) {
    el.innerHTML = '<span class="flame-placeholder">打卡后获得火焰 ' + iconSvg('flame') + '</span>';
    countEl.textContent = '0 个小火焰';
    return;
  }
  var html = '', i;
  if (supers.length) {
    html += '<div class="super-flame-row">' + supers.map(function (lvl) {
      return '<span class="super-flame super-flame-' + lvl + '">' + iconSvg('flame') + '</span>';
    }).join('') + '</div>';
    if (total > 0) html += '<div class="flame-divider"></div>';
  }
  for (i = 0; i < bd.large; i++) html += '<span class="flame-large">' + iconSvg('flame') + '</span>';
  for (i = 0; i < bd.medium; i++) html += '<span class="flame-medium">' + iconSvg('flame') + '</span>';
  for (i = 0; i < bd.small; i++) html += '<span class="flame-small">' + iconSvg('flame') + '</span>';
  el.innerHTML = html;
  var parts = [];
  if (supers.length) parts.push(supers.length + '个超级火焰');
  if (bd.large) parts.push(bd.large + '大火焰');
  if (bd.medium) parts.push(bd.medium + '中火焰');
  if (bd.small) parts.push(bd.small + '小火焰');
  countEl.innerHTML = '共 ' + total + ' 个小火焰' + (parts.length ? '（' + parts.join(' + ') + '）' : '') +
    (supers.length ? '<br><span class="super-flame-hint">' + Rules.superFlameLabel(streak) + '</span>' : '');
}

function renderStreakDots() {
  var today = Dates.today(), html = '';
  for (var i = 6; i >= 0; i--) {
    var ds = Dates.offset(-i), d = Dates.parse(ds);
    html += '<div class="dot-wrap"><span class="dot-label">' + Dates.WEEKS[d.getDay()] + '</span><span class="dot ' +
      (isCheckedIn(ds) ? 'filled' : '') + ' ' + (ds === today ? 'today' : '') + '"></span></div>';
  }
  $('streakDots').innerHTML = html;
}

// ===== 学习任务（按阶段折叠，当前阶段默认展开） =====
function stageLabel(s, i) { return '阶段 ' + i + ' · ' + s.title; }
function stageSub(s) { return [s.time, s.desc].filter(Boolean).join(' · '); }

function renderStages() {
  var board = $('board');
  // 勾选任务会重绘列表：记住哪些阶段是展开的，别把你点开的阶段又收起来
  var first = !board.children.length, opened = {};
  board.querySelectorAll('.stage.open').forEach(function (e) { opened[e.dataset.id] = true; });
  board.innerHTML = '';
  var cur = Plan.currentStage(S.plan, S.progress);
  S.plan.stages.forEach(function (s, idx) {
    var st = Plan.stageStats(s, S.progress);
    var allDone = st.total > 0 && st.done === st.total;
    var isCur = cur && s.id === cur.id;
    var el = document.createElement('div');
    el.className = 'stage' + (allDone ? ' done' : '') + (isCur ? ' current' : '');
    el.dataset.id = s.id;
    el.innerHTML =
      '<div class="stage-head">' +
        '<div class="stage-num">' + (allDone ? '✓' : idx) + '</div>' +
        '<div class="stage-meta"><h3>' + escapeHtml(stageLabel(s, idx)) + '</h3><div class="stage-sub">' + escapeHtml(stageSub(s)) + '</div>' +
        '<div class="stage-bar"><i style="width:' + (st.total ? Math.round(st.done / st.total * 100) : 0) + '%"></i></div></div>' +
        '<div class="stage-count">' + st.done + '/' + st.total + '</div>' +
        '<div class="stage-arrow">›</div>' +
      '</div>' +
      '<div class="stage-body"><div class="stage-tasks"></div></div>';
    var body = el.querySelector('.stage-tasks');
    s.items.forEach(function (x) {
      if (x.type === 'week') {
        var wl = document.createElement('div');
        wl.className = 'week-label';
        wl.textContent = x.text;
        body.appendChild(wl);
        return;
      }
      var t = document.createElement('div');
      t.className = 'task' + (Plan.isDone(S.progress, x.id) ? ' done' : '');
      t.innerHTML = '<div class="ck"></div><div class="tx' + (x.star ? ' star' : '') + '">' +
        (x.star ? '<span class="star-icon">★</span> ' : '') + escapeHtml(x.text) + '</div>';
      t.addEventListener('click', function () {
        Plan.toggle(S.progress, x.id);
        Store.save('progress.json', S.progress);
        renderPlanViews();
      });
      body.appendChild(t);
    });
    el.querySelector('.stage-head').addEventListener('click', function () { el.classList.toggle('open'); });
    if (first ? isCur : opened[s.id]) el.classList.add('open');
    board.appendChild(el);
  });
}

function updateStats() {
  var t = Plan.totals(S.plan, S.progress);
  $('doneCount').textContent = t.done;
  $('totalCount').textContent = t.total;
  $('pctNum').textContent = t.pct + '%';
  var c = 2 * Math.PI * 50;
  $('ringFg').style.strokeDashoffset = c - t.pct / 100 * c;
}

// 规划或进度变化后，所有依赖规划的视图一起刷新
function renderPlanViews() {
  renderToday(); renderStages(); updateStats(); renderRoadmap();
}
