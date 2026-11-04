// ============================================================
//  每日计划和打卡审核
//  · 计划：和教练商量（晚上商量明天），点「定下这份计划」才生效
//  · 审核：打卡前收集证据 → AI 判断 → 没达标写理由 → 驳回就不能打卡
//  · 断网或 AI 出错：先打卡，联网后补审；补审没过要写理由，驳回或逾期就撤销那天
//  · 没有 Key 或没开审核时，打卡和原来完全一样
// ============================================================
var RV = { date: null, verdict: null, ev: null, busy: false, rechecking: false, ticks: 0 };
var PC = { date: null, busy: false };

function saveDaily() { Store.save('daily.json', S.daily); }
function gateOn() { return AI.ready && !!S.settings.aiGate; }
function dayName(date) { return date === Dates.today() ? '今天' : date === Dates.yesterday() ? '昨天' : date === Dates.offset(1) ? '明天' : Dates.cn(date); }

function allTaskIds() {
  var ids = {};
  Plan.allTasks(S.plan).forEach(function (x) { ids[x.id] = true; });
  return ids;
}

// ===== 今日计划卡片 =====
function renderPlanCard() {
  var today = Dates.today(), plan = S.daily.plans[today], box = $('planItems'), target = Review.planTarget();
  box.innerHTML = '';
  $('planTalkBtn').textContent = target === today ? (plan ? '调整今天的计划' : '和教练商量今天') : (S.daily.plans[target] ? '调整明天的计划' : '商量明天的计划');
  $('planTalkBtn').style.display = AI.ready ? '' : 'none';
  if (!plan) {
    box.appendChild(el('p', 'muted plan-empty', { textContent: AI.ready ? '今天还没有定计划。' : '在设置里填写 DeepSeek API Key 后，可以每天和教练商量计划。' }));
  } else {
    plan.items.forEach(function (x) {
      var row = el('div', 'task' + (x.done ? ' done' : ''));
      row.innerHTML = '<div class="ck"></div><div class="tx">' + escapeHtml(x.text) + '</div>';
      row.addEventListener('click', function () { togglePlanItem(x); });
      box.appendChild(row);
    });
  }
  var tomorrow = S.daily.plans[Dates.offset(1)];
  $('planNext').textContent = tomorrow ? '明天的计划已定好，共 ' + tomorrow.items.length + ' 项' : '';
  renderReviewAlert();
}

function togglePlanItem(x) {
  x.done = !x.done;
  saveDaily();
  // 计划项对应总规划里的任务时一起勾上
  if (x.taskId && Plan.isDone(S.progress, x.taskId) !== x.done && allTaskIds()[x.taskId]) {
    Plan.toggle(S.progress, x.taskId);
    Store.save('progress.json', S.progress);
    renderPlanViews();
  }
  renderPlanCard();
}

function renderReviewAlert() {
  var box = $('reviewAlert'), owed = Review.owed(S.daily), wait = Review.pending(S.daily);
  box.innerHTML = '';
  box.style.display = owed.length || wait.length ? '' : 'none';
  if (owed.length) {
    var d = owed[0];
    box.appendChild(el('span', '', { textContent: dayName(d) + '的打卡补审没过，' + Dates.cn(S.daily.reviews[d].deadline) + '结束前不写理由会被撤销' }));
    var b = el('button', 'pill-btn danger sm', { textContent: '去写理由' });
    b.addEventListener('click', function () { openReview(d); });
    box.appendChild(b);
    decorate(box);
  } else if (wait.length) {
    box.appendChild(el('span', '', { textContent: wait.map(dayName).join('、') + '的打卡等联网后补审' }));
  }
}

// ===== 商量计划：AI 先拟一份，你说怎么改，满意了点「定下」 =====
function planChat() { return S.daily.chats[PC.date] || (S.daily.chats[PC.date] = { messages: [], draft: null }); }

function openPlanChat() {
  if (!AI.ready) { showToast('先在设置里填写 API Key'); return; }
  PC.date = Review.planTarget();
  $('planChatTitle').textContent = '商量' + dayName(PC.date) + '的计划';
  openSheet('planChatSheet');
  renderPlanChat();
  if (!planChat().messages.length) sendPlanChat('');
}

function renderPlanChat() {
  var c = planChat(), log = $('planChatLog'), draft = $('planDraft');
  log.innerHTML = '';
  c.messages.forEach(function (m) { log.appendChild(el('div', 'chat-msg ' + m.role, { textContent: m.content })); });
  if (PC.busy) log.appendChild(el('div', 'chat-msg assistant muted', { textContent: '正在想…' }));
  log.scrollTop = log.scrollHeight;
  draft.innerHTML = '';
  draft.style.display = c.draft ? '' : 'none';
  if (c.draft) {
    draft.appendChild(el('div', 'ai-box-title', { textContent: '当前方案' }));
    c.draft.forEach(function (x, i) { draft.appendChild(el('p', 'ai-diff', { textContent: (i + 1) + '. ' + x.text })); });
    var ok = el('button', 'pill-btn primary sm', { textContent: '定下这份计划' });
    ok.addEventListener('click', confirmPlan);
    draft.appendChild(ok);
    decorate(draft);
  }
  $('planChatSend').disabled = PC.busy;
  Glass.relayout();
}

function planBrief() {
  var today = Dates.today(), lines = [aiContext()];
  lines.push('【今天的计划】\n' + Review.planText(S.daily.plans[today]));
  lines.push('【要商量的日期】' + PC.date + '（' + dayName(PC.date) + '）');
  var c = planChat();
  if (c.draft) lines.push('【当前方案】\n' + c.draft.map(function (x) { return x.text; }).join('\n'));
  var cur = Plan.currentStage(S.plan, S.progress);
  if (cur) lines.push('【当前阶段任务 id】' + JSON.stringify(Plan.tasks(cur).filter(function (x) { return !Plan.isDone(S.progress, x.id); }).slice(0, 15).map(function (x) { return { id: x.id, text: x.text }; })));
  return lines.join('\n');
}

async function sendPlanChat(text) {
  if (PC.busy) return;
  var date = PC.date, c = planChat();
  if (text) c.messages.push({ role: 'user', content: text });
  PC.busy = true;
  renderPlanChat();
  var r = await aiAsk({
    system: aiPersona() + '\n' + Review.PLAN_SYSTEM,
    messages: [{ role: 'user', content: planBrief() }].concat(c.messages.slice(-16)).concat(text ? [] : [{ role: 'user', content: '先根据我的情况拟一份计划。' }]),
    json: true, maxTokens: 1500
  });
  PC.busy = false;
  if (r.ok) {
    try {
      var p = Review.parsePlan(parseJson(r.text), allTaskIds());
      c.messages.push({ role: 'assistant', content: p.reply });
      if (p.items) c.draft = p.items;
      saveDaily();
    } catch (e) { showToast(e.message); }
  } else showToast(r.error);
  if (PC.date === date) renderPlanChat();
}

function confirmPlan() {
  var c = planChat(), old = S.daily.plans[PC.date];
  S.daily.plans[PC.date] = { items: Review.mergeDone(c.draft, old && old.items), agreedAt: new Date().toISOString() };
  saveDaily();
  closeSheet();
  renderPlanCard();
  showToast(dayName(PC.date) + '的计划定好了');
}

function pruneChats() {
  var old = Dates.offset(-7);
  Object.keys(S.daily.chats).forEach(function (d) { if (d < old) delete S.daily.chats[d]; });
}

// ===== 打卡入口：今日打卡和补打昨天都走这里 =====
function commitCheckin(date) {
  if (isCheckedIn(date)) return;
  if (date === Dates.today()) afterCheckinChange(Rules.checkin(S));
  else if (date === Dates.yesterday()) afterCheckinChange(Rules.makeup(S));
}

function guardCheckin(date) {
  var st = Review.status(S.daily, date);
  if (!gateOn() || st === 'passed' || st === 'excused' || st === 'pending') commitCheckin(date);
  else openReview(date);
}

// 撤销打卡时，等着补审的记录也没有意义了
function dropPendingReview(date) {
  if (Review.status(S.daily, date) !== 'pending') return;
  delete S.daily.reviews[date];
  saveDaily();
  renderReviewAlert();
}

function setReview(date, rec) {
  S.daily.reviews[date] = Object.assign({ at: new Date().toISOString() }, rec);
  saveDaily();
}

// ===== 审核弹层 =====
function evidenceLines(ev) {
  var out = [];
  var files = ev.folders.reduce(function (n, f) { return n + f.files; }, 0);
  var commits = ev.repos.reduce(function (n, r) { return n + r.commits.length; }, 0);
  out.push(ev.folderCount ? '文件改动 ' + files + ' 个，Git 提交 ' + commits + ' 次' : '没有设置监控文件夹');
  if (ev.missing && ev.missing.length) out.push('找不到文件夹：' + ev.missing.join('、'));
  var apps = Object.keys(ev.usage);
  out.push(apps.length ? '开发软件 ' + apps.map(function (a) { return a + ' ' + Review.duration(ev.usage[a]); }).join('、') : ev.tracking ? '开发软件没有使用记录' : '没有开启时长统计');
  out.push('日记 ' + ev.diary.chars + ' 字，截图 ' + ev.shots + ' 张');
  return out;
}

async function gatherEvidence(date) {
  var ev = await dashboardAPI.collectEvidence(date);
  if (!ev) ev = { folderCount: 0, folders: [], repos: [], usage: {}, tracking: false };
  var entry = (S.diary.entries[date] || '').trim();
  ev.diary = { chars: entry.length, text: S.settings.aiDiary ? entry.slice(0, 1500) : '' };
  ev.shots = (S.shots.shots[date] || []).length;
  return ev;
}

function reviewBrief(date, ev) {
  return '【审核日期】' + date + '（' + dayName(date) + '）\n【当天计划】\n' + Review.planText(S.daily.plans[date]) + '\n\n【证据】\n' + Review.evidenceText(ev) + '\n\n【总体情况】\n' + aiContext();
}

function askVerdict(date, ev) {
  return aiAsk({ system: aiPersona() + '\n' + Review.REVIEW_SYSTEM, messages: [{ role: 'user', content: reviewBrief(date, ev) }], deep: true, json: true });
}

function reviewView(state, title, lines) {
  $('reviewStatus').className = 'review-status ' + state;
  $('reviewStatus').textContent = title;
  var box = $('reviewVerdict');
  box.innerHTML = '';
  (lines || []).forEach(function (t) { box.appendChild(el('p', 'ai-diff', { textContent: t })); });
}

function showReason(on) {
  $('reviewReasonBox').style.display = on ? '' : 'none';
  $('reviewReasonBtn').disabled = false;
  Glass.relayout();
}

async function openReview(date) {
  if (RV.busy) return;
  RV.date = date; RV.verdict = null; RV.ev = null; RV.busy = true;
  $('reviewTitle').textContent = dayName(date) + '的打卡审核';
  $('reviewEvidence').innerHTML = '';
  $('reviewReason').value = '';
  showReason(false);
  reviewView('busy', '正在看证据，深度思考可能要一两分钟…');
  openSheet('reviewSheet');

  var ev = RV.ev = await gatherEvidence(date);
  evidenceLines(ev).forEach(function (t) { $('reviewEvidence').appendChild(el('p', 'ai-diff', { textContent: t })); });
  var r = await askVerdict(date, ev), v = null;
  RV.busy = false;
  if (r.ok) { try { v = Review.parseVerdict(parseJson(r.text)); } catch (e) { r = { ok: false, error: e.message }; } }
  var st = Review.status(S.daily, date);

  if (!r.ok) {
    // AI 不可用不拦你：先打卡，之后补审。已经欠着理由的那天没有「先打卡」可言
    if (st === 'owed') { reviewView('fail', '现在审不了：' + r.error, ['联网后再试一次。']); return; }
    setReview(date, { status: 'pending' });
    commitCheckin(date);
    renderReviewAlert();
    reviewView('wait', '已先打卡，联网后自动补审', [r.error]);
    return;
  }
  if (v.met) {
    setReview(date, { status: 'passed', summary: v.summary });
    commitCheckin(date);
    renderReviewAlert();
    reviewView('ok', '审核通过', [v.summary]);
    return;
  }
  RV.verdict = v;
  reviewView('fail', '没有达标', [v.summary].concat(v.missing.map(function (t) { return '· ' + t; })));
  showReason(true);
}

async function submitReason() {
  var text = $('reviewReason').value.trim(), date = RV.date, btn = $('reviewReasonBtn');
  if (!text) { showToast('先写下理由'); return; }
  if (RV.busy) return;
  RV.busy = true;
  btn.disabled = true;
  btn.textContent = '审核中…';
  var r = await aiAsk({
    system: aiPersona() + '\n' + Review.REASON_SYSTEM,
    messages: [{ role: 'user', content: reviewBrief(date, RV.ev) + '\n\n【审核结论】' + RV.verdict.summary + '\n【用户的理由】\n' + text }],
    deep: true, json: true
  }), v = null;
  RV.busy = false;
  btn.disabled = false;
  btn.textContent = '提交理由';
  if (r.ok) { try { v = Review.parseReason(parseJson(r.text)); } catch (e) { r = { ok: false, error: e.message }; } }
  var owedDay = Review.status(S.daily, date) === 'owed';
  if (!r.ok) {
    if (owedDay) { showToast(r.error); return; }
    setReview(date, { status: 'pending', reason: text });
    commitCheckin(date);
    renderReviewAlert();
    showReason(false);
    reviewView('wait', '已先打卡，联网后自动补审', [r.error]);
    return;
  }
  if (v.accept) {
    setReview(date, { status: 'excused', reason: text, reply: v.reply });
    commitCheckin(date);
    showReason(false);
    reviewView('ok', '理由通过', [v.reply]);
  } else if (owedDay) {
    revokeDay(date, text, v.reply);
    showReason(false);
    reviewView('fail', '理由被驳回，这天的打卡已撤销', [v.reply]);
  } else {
    setReview(date, { status: 'rejected', reason: text, reply: v.reply });
    reviewView('fail', '理由被驳回，不能打卡', [v.reply, '补上任务后可以再打一次卡，或者写更具体的理由。']);
  }
  renderReviewAlert();
}

function revokeDay(date, reason, reply) {
  Rules.revoke(S, date);
  saveRules();
  setReview(date, { status: 'rejected', reason: reason || '', reply: reply || '', revoked: true });
  renderCheckin(); renderFlames(); renderStreakDots(); renderCalendar(); renderHeatmap();
}

// ===== 补审：启动、恢复联网、每半小时各试一次 =====
async function recheckPending() {
  if (!AI.ready || RV.rechecking) return;
  RV.rechecking = true;
  var list = Review.pending(S.daily);
  for (var i = 0; i < list.length; i++) {
    var date = list[i];
    if (date === RV.date && RV.busy) continue;
    var r = await askVerdict(date, await gatherEvidence(date));
    if (!r.ok) break;                 // 还是连不上，下次再说
    var v;
    try { v = Review.parseVerdict(parseJson(r.text)); } catch (e) { continue; }
    if (Review.status(S.daily, date) !== 'pending') continue;   // 等待期间你撤销了打卡
    if (v.met) setReview(date, { status: 'passed', summary: v.summary });
    else {
      setReview(date, { status: 'owed', summary: v.summary, deadline: Review.deadline() });
      dashboardAPI.showNotification('打卡补审没过', dayName(date) + '：' + v.summary.slice(0, 60));
    }
  }
  RV.rechecking = false;
  renderReviewAlert();
}

function revokeOverdue() {
  Review.overdue(S.daily).forEach(function (date) {
    revokeDay(date, '', '过了期限没有写理由');
    dashboardAPI.showNotification('打卡已撤销', date + ' 的补审没过，也没有在期限内写理由');
  });
  renderReviewAlert();
}

// 晚上提醒商量明天的计划，每天最多一次
function planNudge() {
  var today = Dates.today();
  if (!gateOn() || new Date().getHours() < 21 || S.settings.lastPlanNudge === today || S.daily.plans[Dates.offset(1)]) return;
  S.settings.lastPlanNudge = today;
  Store.save('settings.json', S.settings);
  dashboardAPI.showNotification('PEAN的开发小天地', '明天的计划还没定，花两分钟和教练商量一下');
}

function dailyTick() {
  revokeOverdue();
  planNudge();
  if (++RV.ticks % 30 === 0) recheckPending();
}

// ===== 设置 =====
var LOCAL = { folders: [], track: false, background: false, autostart: false, canAutostart: false };

function renderReviewSettings() {
  $('aiGateToggle').classList.toggle('on', !!S.settings.aiGate);
  $('trackToggle').classList.toggle('on', LOCAL.track);
  $('backgroundToggle').classList.toggle('on', LOCAL.background || LOCAL.autostart);
  $('autostartToggle').classList.toggle('on', LOCAL.autostart);
  $('autostartRow').style.display = LOCAL.canAutostart ? '' : 'none';
  var box = $('watchFolders');
  box.innerHTML = '';
  if (!LOCAL.folders.length) box.appendChild(el('p', 'muted plan-empty', { textContent: '还没有文件夹，AI 看不到你的文件改动和 git 提交。' }));
  LOCAL.folders.forEach(function (f) {
    var row = el('div', 'set-row');
    row.appendChild(el('span', 'folder-path', { textContent: f }));
    var b = el('button', 'pill-btn sm danger', { textContent: '移除' });
    b.addEventListener('click', async function () { LOCAL = await dashboardAPI.localRemoveFolder(f); renderReviewSettings(); });
    row.appendChild(b);
    box.appendChild(row);
  });
  decorate(box);
}

async function setLocal(patch) {
  LOCAL = await dashboardAPI.localSet(patch);
  renderReviewSettings();
}

function bindDaily() {
  on('planTalkBtn', openPlanChat);
  on('planChatSend', function () {
    var t = $('planChatInput').value.trim();
    if (!t) return;
    $('planChatInput').value = '';
    sendPlanChat(t);
  });
  $('planChatInput').addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); $('planChatSend').click(); }
  });
  on('reviewReasonBtn', submitReason);
  on('aiGateToggle', function () {
    if (!S.settings.aiGate && !AI.ready) { showToast('先在上面填好 API Key'); return; }
    var locked = Review.owed(S.daily).length || Review.status(S.daily, Dates.today()) === 'rejected';
    if (S.settings.aiGate && locked) { showToast('今天有被驳回的打卡，明天才能关闭审核'); return; }
    S.settings.aiGate = !S.settings.aiGate;
    Store.save('settings.json', S.settings);
    renderReviewSettings();
  });
  on('trackToggle', function () { setLocal({ track: !LOCAL.track }); });
  on('backgroundToggle', function () { setLocal({ background: !(LOCAL.background || LOCAL.autostart), autostart: false }); });
  on('autostartToggle', function () { setLocal({ autostart: !LOCAL.autostart }); });
  on('watchAdd', async function () { LOCAL = await dashboardAPI.localAddFolder(); renderReviewSettings(); });
  window.addEventListener('online', recheckPending);
}

async function startDaily() {
  pruneChats();
  LOCAL = await dashboardAPI.localGet();
  renderReviewSettings();
  renderPlanCard();
  revokeOverdue();
  recheckPending();
}
