// ============================================================
//  AI 教练：开场白、周复盘、提醒文案、规划助手、任务拆解
//  · 没填 Key、断网、AI 出错时都退回原样（名言 / 固定提醒），不影响打卡
//  · 规划助手和任务拆解只生成草稿：你确认放进编辑器，再点保存才写入
//  · AI 返回的内容一律当文本显示，复盘走转义过的 Markdown
// ============================================================
var AI = { ready: false, canEncrypt: true, busyOpener: false, busyReview: false };

function aiOpts() { return { diary: !!S.settings.aiDiary, mood: !!S.settings.aiMood }; }
function aiPersona() { return Coach.persona(S.settings.aiTone, S.settings.aiCustomTone); }
function aiAsk(o) { o.model = S.settings.aiModel; return dashboardAPI.aiChat(o); }
function aiContext() { return Coach.context(S, aiOpts()); }

function parseJson(text) {
  try { return JSON.parse(text); } catch (e) { throw new Error('AI 返回的格式不对，再试一次'); }
}

// ===== 开场白：每天一条，缓存在 ai.json =====
function currentOpener() {
  var o = S.ai.opener;
  return AI.ready && o && o.date === Dates.today() ? o : null;
}

function renderQuoteCard() {
  var o = currentOpener();
  $('quoteCardTitle').textContent = o ? '教练开场白' : '今日一句';
  if (o) {
    $('quoteText').textContent = o.text;
    $('quoteAuthor').textContent = '— AI 教练';
  } else {
    displayQuote();
  }
}

async function generateOpener(manual) {
  if (!AI.ready || AI.busyOpener) return;
  AI.busyOpener = true;
  if (manual) $('quoteAuthor').textContent = '正在想…';
  var r = await aiAsk({
    system: aiPersona() + '\n写一段打开软件时看到的开场白：两三句话、80 字以内，结合数据说具体的事，并点出今天最该做的一件事。不要标题，不要 Markdown。',
    messages: [{ role: 'user', content: aiContext() }], maxTokens: 300
  });
  AI.busyOpener = false;
  if (r.ok) {
    S.ai.opener = { date: Dates.today(), text: r.text };
    Store.save('ai.json', S.ai);
  } else if (manual) {
    showToast(r.error);
  }
  renderQuoteCard();
}

// ===== 周复盘：每周一条，第一次打开软件时自动生成 =====
function renderReview() {
  var box = $('aiReviewBody'), btn = $('aiReviewBtn'), rv = S.ai.review;
  btn.style.display = AI.ready ? '' : 'none';
  btn.textContent = AI.busyReview ? '生成中…' : rv ? '重新生成' : '生成复盘';
  btn.disabled = AI.busyReview;
  $('aiReviewMeta').textContent = rv ? '生成于 ' + Dates.cn(rv.date) : '';
  if (!AI.ready) { box.textContent = '在设置里填写 DeepSeek API Key 后，这里每周会有一份复盘。'; box.className = 'ai-review muted'; return; }
  if (!rv) { box.textContent = AI.busyReview ? '正在看你这周的记录，深度思考可能要一两分钟…' : '还没有复盘。'; box.className = 'ai-review muted'; return; }
  box.className = 'ai-review';
  box.innerHTML = parseMarkdown(rv.text);
}

async function generateReview(manual) {
  if (!AI.ready || AI.busyReview) return;
  AI.busyReview = true;
  renderReview();
  var r = await aiAsk({
    system: aiPersona() + '\n写一份过去 7 天的学习复盘，用 Markdown，300 字以内，分三段：### 这周做到了、### 卡在哪里、### 下周就做这三件。必须引用数据里的具体事实，建议要具体到任务。',
    messages: [{ role: 'user', content: aiContext() }], deep: true
  });
  AI.busyReview = false;
  if (r.ok) {
    S.ai.review = { week: Coach.weekKey(), date: Dates.today(), text: r.text };
    Store.save('ai.json', S.ai);
  } else if (manual) {
    showToast(r.error);
  }
  renderReview();
}

// ===== 晚间提醒：有 AI 就写一句针对性的，失败退回固定文案 =====
async function reminderText() {
  var fallback = '今天还没打卡哦！坚持下去，别断了连续天数';
  if (!AI.ready) return fallback;
  var r = await aiAsk({
    system: aiPersona() + '\n用户今天还没打卡，写一条系统通知提醒他，30 字以内，结合数据，不要标题。',
    messages: [{ role: 'user', content: aiContext() }], maxTokens: 120
  });
  return r.ok ? r.text.slice(0, 80) : fallback;
}

// ===== 规划助手：在编辑器里生成草稿 → 看改动 → 放进编辑器（还要点保存才写入） =====
function diffLines(d) {
  var out = [];
  if (d.stagesAdded.length) out.push('新增阶段：' + d.stagesAdded.join('、'));
  if (d.stagesChanged.length) out.push('修改阶段：' + d.stagesChanged.join('、'));
  if (d.stagesRemoved.length) out.push('删除阶段：' + d.stagesRemoved.map(function (s) { return s.title + (s.done ? '（' + s.done + ' 项完成记录会归档）' : ''); }).join('、'));
  if (d.tasksAdded.length) out.push('新增任务 ' + d.tasksAdded.length + ' 项：' + d.tasksAdded.slice(0, 6).join('；') + (d.tasksAdded.length > 6 ? ' …' : ''));
  if (d.tasksChanged.length) out.push('改写任务 ' + d.tasksChanged.length + ' 项');
  if (d.tasksRemoved.length) {
    var done = d.tasksRemoved.filter(function (t) { return t.done; }).length;
    out.push('删除任务 ' + d.tasksRemoved.length + ' 项' + (done ? '，其中 ' + done + ' 项已完成' : ''));
  }
  return out.length ? out : ['没有改动'];
}

function mountPlanAssistant(area) {
  var box = el('div', 'ai-box');
  box.appendChild(el('div', 'ai-box-title', { textContent: 'AI 帮我调整规划' }));
  var input = el('textarea', 'input', { rows: 2, placeholder: '比如：我想把鸿蒙提前到这学期，再加一条 AI 方向' });
  var go = el('button', 'pill-btn tint sm', { textContent: '生成草稿' });
  var result = el('div', 'ai-result');
  box.appendChild(input);
  box.appendChild(go);
  box.appendChild(result);
  area.insertBefore(box, area.firstChild);
  go.addEventListener('click', async function () {
    var want = input.value.trim();
    if (!AI.ready) { showToast('先在设置里填写 API Key'); return; }
    if (!want) { showToast('先说说你想怎么调整'); return; }
    var current = collectStages();
    go.disabled = true; go.textContent = '思考中…';
    result.textContent = '';
    var r = await aiAsk({
      system: aiPersona() + '\n根据用户要求调整学习规划，输出 JSON：{"summary":"一句话说明改了什么","stages":[{"id","title","time","desc","output","items":[{"id","text","star"}或{"week":"周标签"}]}]}。' +
        '必须输出完整规划。保留不改动的内容；已有阶段和任务必须沿用原 id，新增的不写 id。done=true 的任务不要删除。',
      messages: [{ role: 'user', content: '【我的情况】\n' + aiContext() + '\n\n【当前规划 JSON】\n' + JSON.stringify(Coach.planForAI(current, S.progress)) + '\n\n【我的要求】\n' + want }],
      deep: true, json: true
    });
    go.disabled = false; go.textContent = '生成草稿';
    if (!r.ok) { showToast(r.error); return; }
    var d;
    try { d = Coach.applyDraft(current, parseJson(r.text), S.progress); } catch (e) { showToast(e.message); return; }
    result.innerHTML = '';
    if (d.summary) result.appendChild(el('p', 'ai-summary', { textContent: d.summary }));
    diffLines(d.diff).forEach(function (t) { result.appendChild(el('p', 'ai-diff', { textContent: t })); });
    var row = el('div', 'ai-actions');
    var yes = el('button', 'pill-btn primary sm', { textContent: '用这版草稿' });
    var no = el('button', 'pill-btn sm', { textContent: '放弃' });
    yes.addEventListener('click', function () { renderEditor(d.stages); showToast('草稿已放进编辑器，检查后点保存才会生效'); });
    no.addEventListener('click', function () { result.innerHTML = ''; });
    row.appendChild(yes); row.appendChild(no);
    result.appendChild(row);
    decorate(result);
  });
  decorate(box);
}

// ===== 任务拆解：把一个大任务拆成今天能做完的小步骤 =====
async function breakdownTask(row, btn) {
  if (!AI.ready) { showToast('先在设置里填写 API Key'); return; }
  var text = row.querySelector('input').value.trim();
  if (!text) return;
  var old = btn.textContent;
  btn.disabled = true; btn.textContent = '…';
  var r = await aiAsk({
    system: aiPersona() + '\n把用户的任务拆成 3 到 6 个具体、一次能做完的小步骤，每步一句话。输出 JSON：{"subtasks":["步骤一","步骤二"]}。',
    messages: [{ role: 'user', content: '任务：' + text + '\n\n【背景】\n' + aiContext() }], json: true, maxTokens: 800
  });
  btn.disabled = false; btn.textContent = old;
  if (!r.ok) { showToast(r.error); return; }
  var list;
  try { list = Coach.subtasks(parseJson(r.text)); } catch (e) { showToast(e.message); return; }
  var next = row.nextElementSibling;
  if (next && next.classList.contains('ai-sub')) next.remove();
  var box = el('div', 'ai-sub');
  list.forEach(function (t) { box.appendChild(el('p', 'ai-diff', { textContent: '· ' + t })); });
  var bar = el('div', 'ai-actions');
  var yes = el('button', 'pill-btn primary sm', { textContent: '加到这条任务后面' });
  var no = el('button', 'pill-btn sm', { textContent: '放弃' });
  yes.addEventListener('click', function () {
    var at = box;
    list.forEach(function (t) { var n = editorRow({ type: 'task', text: t }); at.parentNode.insertBefore(n, at.nextSibling); at = n; });
    var host = box.parentNode;
    box.remove();
    decorate(host);
  });
  no.addEventListener('click', function () { box.remove(); });
  bar.appendChild(yes); bar.appendChild(no);
  box.appendChild(bar);
  row.parentNode.insertBefore(box, row.nextSibling);
  decorate(box);
}

// ===== 设置 =====
function renderAISettings() {
  var s = S.settings;
  $('aiKeyStatus').textContent = AI.ready ? '已保存（系统加密，不会显示）' : AI.canEncrypt ? '未填写' : '这台电脑无法加密保存';
  $('aiKeyClear').style.display = AI.ready ? '' : 'none';
  $('aiTest').style.display = AI.ready ? '' : 'none';
  $('aiToneSelect').value = s.aiTone;
  addModelOption(s.aiModel);
  $('aiModelSelect').value = s.aiModel;
  $('aiCustomTone').style.display = s.aiTone === 'custom' ? '' : 'none';
  $('aiCustomTone').value = s.aiCustomTone || '';
  $('aiDiaryToggle').classList.toggle('on', !!s.aiDiary);
  $('aiMoodToggle').classList.toggle('on', !!s.aiMood);
}

// 接口列出的其他模型追加到下拉框；已选的模型即使暂时拿不到列表也要留在选项里
function addModelOption(id) {
  var sel = $('aiModelSelect');
  if (!id || sel.querySelector('option[value="' + CSS.escape(id) + '"]')) return;
  sel.appendChild(el('option', '', { value: id, textContent: '全部用 ' + id }));
}

async function loadModels() {
  var r = await dashboardAPI.aiModels();
  if (!r.ok) return;
  r.models.filter(function (id) { return id !== 'deepseek-flash' && id !== 'deepseek-v4-pro'; }).forEach(addModelOption);
}

function aiSet(k, v) {
  S.settings[k] = v;
  Store.save('settings.json', S.settings);
  renderAISettings();
}

async function refreshAIStatus() {
  var st = await dashboardAPI.aiStatus();
  AI.ready = st.hasKey; AI.canEncrypt = st.canEncrypt;
  renderAISettings(); renderReview(); renderQuoteCard();
  if (AI.ready) loadModels();
}

function bindAI() {
  on('aiKeySave', async function () {
    var inp = $('aiKeyInput'), r = await dashboardAPI.aiSetKey(inp.value);
    inp.value = '';                // 存完立刻清空，界面上不留 Key
    if (!r.ok) { showToast(r.error); return; }
    await refreshAIStatus();
    showToast('Key 已加密保存');
    generateOpener(false);
  });
  on('aiKeyClear', async function () {
    if (!window.confirm('删除已保存的 API Key？')) return;
    await dashboardAPI.aiClearKey();
    await refreshAIStatus();
  });
  on('aiTest', async function () {
    var b = $('aiTest');
    b.disabled = true; b.textContent = '测试中…';
    var r = await aiAsk({ system: '只回复两个字：连通', messages: [{ role: 'user', content: '测试' }], maxTokens: 20 });
    b.disabled = false; b.textContent = '测试连接';
    showToast(r.ok ? '连接正常' : r.error);
  });
  $('aiToneSelect').addEventListener('change', function () { aiSet('aiTone', this.value); });
  $('aiModelSelect').addEventListener('change', function () { aiSet('aiModel', this.value); });
  $('aiCustomTone').addEventListener('change', function () { aiSet('aiCustomTone', this.value.trim().slice(0, 300)); });
  on('aiDiaryToggle', function () { aiSet('aiDiary', !S.settings.aiDiary); });
  on('aiMoodToggle', function () { aiSet('aiMood', !S.settings.aiMood); });
  on('aiReviewBtn', function () { generateReview(true); });
}

async function startAI() {
  await refreshAIStatus();
  if (!AI.ready) return;
  if (!currentOpener()) generateOpener(false);
  if (!S.ai.review || S.ai.review.week !== Coach.weekKey()) generateReview(false);
}
