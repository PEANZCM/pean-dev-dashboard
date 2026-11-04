// ============================================================
//  伴学首页：AI 状态球、陪学计时、持续对话、今天的证据、分心提醒
//  · 没有 Key 时计时照常工作，只是没有 AI 的回应
//  · AI 的话一律当纯文本显示
// ============================================================
var Comp = { orb: null, busy: 0, failed: false, timer: 0, away: { sec: 0, lastNudge: 0 }, nudged: false, sending: false, evidenceAt: 0 };
var MAX_CHAT = 300, SHOW_CHAT = 120, SEND_CHAT = 20;

/* ---------- 状态球：所有 AI 请求都经过这里 ---------- */
function renderOrbStatus() {
  var running = !!S.daily.study.running;
  $('orbStatus').textContent = Comp.busy ? '思考中' : Comp.nudged ? '在催你回来' : running ? '陪学中' : !AI.ready ? '还没连接 AI' : Comp.failed ? '刚才没连上' : '待命';
}

function orbAnimated() { return S.settings.motion !== 'off'; }

function orbTrack(promise) {
  Comp.busy++;
  if (Comp.orb && orbAnimated()) Comp.orb.think();
  renderOrbStatus();
  return promise.then(function (r) {
    Comp.busy--;
    Comp.failed = !r.ok;
    if (!Comp.busy && Comp.orb && orbAnimated()) Comp.orb.finish(r.ok ? 'done' : 'fail');
    renderOrbStatus();
    return r;
  });
}

/* ---------- 对话 ---------- */
function pushChat(role, content, kind) {
  S.chat.messages.push({ role: role, content: content, at: new Date().toISOString(), kind: kind || '' });
  if (S.chat.messages.length > MAX_CHAT) S.chat.messages.splice(0, S.chat.messages.length - MAX_CHAT);
  Store.save('chat.json', S.chat);
  renderChat();
}

function renderChat() {
  var log = $('chatLog'), list = S.chat.messages.slice(-SHOW_CHAT), last = '';
  log.innerHTML = '';
  if (!list.length) log.appendChild(el('p', 'muted chat-empty', { textContent: AI.ready ? '有什么想说的，直接告诉我。' : '在设置里填写 DeepSeek API Key 后，AI 会在这里陪你学习。' }));
  list.forEach(function (m) {
    var day = Dates.fmt(new Date(m.at));
    if (day !== last) { log.appendChild(el('div', 'chat-day', { textContent: Dates.cn(day) })); last = day; }
    log.appendChild(el('div', 'chat-msg ' + m.role + (m.kind === 'nudge' ? ' nudge' : ''), { textContent: m.content }));
  });
  if (Comp.sending) log.appendChild(el('div', 'chat-msg assistant muted', { textContent: '正在想…' }));
  log.scrollTop = log.scrollHeight;
}

async function companionBrief() {
  var today = Dates.today(), ev = await cachedEvidence();
  return ['【我的情况】\n' + aiContext(), '【今天的计划】\n' + Review.planText(S.daily.plans[today]), '【今天的证据】\n' + Review.evidenceText(ev), studyLine()].join('\n\n');
}

function studyLine() {
  var run = S.daily.study.running;
  return run ? '【陪学】正在计时：' + run.task + '，已经 ' + Review.duration((Date.now() - run.start) / 1000) : '【陪学】现在没有计时';
}

async function sendChat() {
  var input = $('chatInput'), text = input.value.trim();
  if (!text || Comp.sending) return;
  if (!AI.ready) { showToast('先在设置里填写 API Key'); return; }
  input.value = '';
  pushChat('user', text);
  Comp.sending = true;
  renderChat();
  var brief = await companionBrief();
  var r = await aiAsk({
    system: aiPersona() + '\n' + Review.CHAT_SYSTEM + '\n\n' + brief,
    messages: S.chat.messages.slice(-SEND_CHAT).map(function (m) { return { role: m.role, content: m.content }; }),
    maxTokens: 1000
  });
  Comp.sending = false;
  if (r.ok) pushChat('assistant', r.text); else { showToast(r.error); renderChat(); }
}

// 陪学过程里的一句话：有 AI 用 AI 写，失败就用给定的文案（可以为空）
async function coachSay(instruction, fallback, kind) {
  var r = AI.ready ? await aiAsk({
    system: aiPersona() + '\n' + instruction + '不要标题，不要 Markdown。',
    messages: [{ role: 'user', content: await companionBrief() }], maxTokens: 300
  }) : { ok: false };
  var text = r.ok ? r.text : fallback;
  if (text) pushChat('assistant', text, kind);
  return text;
}

/* ---------- 陪学计时 ---------- */
function studyTask() {
  var plan = S.daily.plans[Dates.today()];
  var item = plan && plan.items.filter(function (x) { return !x.done; })[0];
  if (item) return item.text;
  var cur = Plan.currentStage(S.plan, S.progress);
  var left = cur && Plan.tasks(cur).filter(function (x) { return !Plan.isDone(S.progress, x.id); })[0];
  return left ? left.text : '自由学习';
}

function clock(sec) {
  var p = function (n) { return String(n).padStart(2, '0'); };
  return p(Math.floor(sec / 3600)) + ':' + p(Math.floor(sec / 60) % 60) + ':' + p(Math.floor(sec) % 60);
}

function renderStudy() {
  var run = S.daily.study.running, total = Review.studyTotal(S.daily.study, Dates.today());
  $('studyClock').textContent = clock(run ? (Date.now() - run.start) / 1000 : 0);
  $('studyTask').textContent = run ? run.task : '开始后我会盯着这段时间';
  $('studyTotal').textContent = total ? '今天已学 ' + Review.duration(total) : '';
  var btn = $('studyBtn');
  btn.textContent = run ? '结束' : '开始学习';
  // 结束平时是普通玻璃，鼠标移上去才变红
  var kind = run ? 'clear' : 'blue';
  btn.classList.toggle('ending', !!run);
  if (btn.getAttribute('data-glass') !== kind) { btn.setAttribute('data-glass', kind); Glass.refresh(btn); }
  renderOrbStatus();
}

function startClock() {
  clearInterval(Comp.timer);
  Comp.timer = setInterval(function () { if (S.daily.study.running) $('studyClock').textContent = clock((Date.now() - S.daily.study.running.start) / 1000); }, 1000);
}

function toggleStudy() {
  if (S.daily.study.running) finishStudy(); else beginStudy();
}

function beginStudy() {
  var now = Date.now();
  S.daily.study.running = { start: now, beat: now, task: studyTask(), away: 0 };
  Comp.away = { sec: 0, lastNudge: 0 };
  saveDaily();
  renderStudy();
  startClock();
  if (!LOCAL.track) showToast('打开设置里的时长统计后，走神时我才能提醒你');
  coachSay('用户刚开始一段陪学，要做的事写在【陪学】里。用一句话陪他开始，点出这段时间该做到什么，30 字以内。', '', '');
}

async function finishStudy() {
  var s = Review.finishSession(S.daily.study, Date.now());
  clearInterval(Comp.timer);
  Comp.nudged = false;
  saveDaily();
  renderStudy();
  if (!s) { showToast('不到 1 分钟，这段没有记录'); return; }
  Comp.evidenceAt = 0;
  refreshEvidence();
  await coachSay('用户刚结束一段陪学：做「' + s.task + '」，时长 ' + Review.duration(s.sec) + '，其中离开开发软件约 ' + Math.round(s.away / 60) + ' 分钟。按实际时长和证据回应，两三句，说具体的事和下一步。', '这段学了 ' + Review.duration(s.sec) + '，记下了。', '');
}

// 软件关着的时候计时不能继续跑：心跳断了就按最后一次心跳结束
function closeStaleStudy() {
  var had = !!S.daily.study.running, s = Review.closeStale(S.daily.study, Date.now());
  if (!had || S.daily.study.running) return;
  clearInterval(Comp.timer);
  Comp.nudged = false;
  saveDaily();
  renderStudy();
  pushChat('assistant', s ? '上次陪学在软件关闭或电脑睡眠时断了，记了 ' + Review.duration(s.sec) + '。' : '上次陪学不到 1 分钟就断了，没有记录。');
}

// 每分钟一次：电脑睡眠时心跳也会断，醒来先结束，不把睡着的时间算进去
function studyBeat() {
  closeStaleStudy();
  var run = S.daily.study.running;
  if (!run) return;
  run.beat = Date.now();
  saveDaily();
}

/* ---------- 分心提醒：主进程每 15 秒报一次前台软件 ---------- */
function onUsageSample(sample) {
  if (!S.daily.study.running) return;
  if (sample.dev && Comp.nudged) { Comp.nudged = false; renderOrbStatus(); }
  if (!sample.dev && !sample.self) S.daily.study.running.away += sample.sec;
  if (!Review.awayStep(Comp.away, sample, Date.now())) return;
  Comp.nudged = true;
  renderOrbStatus();
  var fb = '已经 ' + Math.round(Comp.away.sec / 60) + ' 分钟没碰开发软件了，回来继续？';
  coachSay('用户在陪学计时中，已经 ' + Math.round(Comp.away.sec / 60) + ' 分钟没有使用开发软件。写一句话把他叫回来，30 字以内。', fb, 'nudge').then(function (t) {
    dashboardAPI.showNotification('PEAN的开发小天地', (t || fb).slice(0, 80));
  });
}

/* ---------- 今天的证据 ---------- */
async function cachedEvidence() {
  if (!Comp.evidence || Date.now() - Comp.evidenceAt > 5 * 60 * 1000) await refreshEvidence();
  return Comp.evidence;
}

async function refreshEvidence() {
  Comp.evidence = await gatherEvidence(Dates.today());
  Comp.evidenceAt = Date.now();
  var box = $('todayEvidence');
  box.innerHTML = '';
  evidenceLines(Comp.evidence).forEach(function (t) { box.appendChild(el('p', 'ai-diff', { textContent: t })); });
}

function setOrbTheme(dark) {
  if (!Comp.orb) return;
  Comp.orb.dark = dark;
  Comp.orb.wake();
}

function bindCompanion() {
  on('studyBtn', toggleStudy);
  on('chatSend', sendChat);
  on('evidenceRefresh', refreshEvidence);
  $('chatInput').addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendChat(); }
  });
  dashboardAPI.onUsageSample(onUsageSample);
  Comp.orb = new Orb($('orbCanvas'), { size: 64, dark: !!S.settings.darkMode });
}

function startCompanion() {
  closeStaleStudy();
  if (S.daily.study.running) startClock();
  renderChat();
  renderStudy();
  refreshEvidence();
}
