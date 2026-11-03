// ============================================================
//  规划编辑器：阶段增删改排序 + 任务增删改
//  每一行都带着自己的 id，改文字 / 挪位置都不会丢完成状态
//  点「取消」不改动任何数据；点「保存」才写入
// ============================================================

var ICON_CHOICES = [['rocket', '火箭'], ['globe', '地球'], ['phone', '手机'], ['wrench', '扳手'], ['dumbbell', '哑铃'],
  ['star', '星星'], ['book', '书本'], ['trophy', '奖杯'], ['flame', '火焰'], ['bulb', '灯泡']];

function el(tag, cls, attrs) {
  var e = document.createElement(tag);
  if (cls) e.className = cls;
  if (attrs) Object.keys(attrs).forEach(function (k) { e[k] = attrs[k]; });
  return e;
}

function editorRow(item) {
  var week = item.type === 'week';
  var row = el('div', 'task-edit-row' + (week ? ' week-row' : ''));
  row.dataset.id = item.id || Plan.newId(week ? 'w' : 't');
  row.dataset.type = week ? 'week' : 'task';
  var input = el('input', 'task-edit-input', {
    type: 'text',
    placeholder: week ? '周标签（如 Week 1 · HTML + CSS）' : '任务内容（★ 开头为重点任务）',
    value: week ? item.text || '' : (item.star ? '★ ' : '') + (item.text || '')
  });
  var del = el('button', 'task-edit-del-btn', { textContent: '✕', title: '删除此条' });
  del.addEventListener('click', function () { row.remove(); });
  row.appendChild(input);
  row.appendChild(del);
  return row;
}

function field(cls, value, placeholder) {
  return el('input', 'task-edit-input stage-field ' + cls, { type: 'text', value: value || '', placeholder: placeholder });
}

function editorStage(s) {
  var box = el('div', 'task-edit-stage');
  box.dataset.id = s.id;

  var head = el('div', 'stage-edit-head');
  var icon = el('select', 'task-edit-input stage-field f-icon');
  ICON_CHOICES.forEach(function (c) {
    var o = el('option', '', { value: c[0], textContent: c[1] });
    if (c[0] === (s.icon || 'star')) o.selected = true;
    icon.appendChild(o);
  });
  head.appendChild(field('f-title', s.title, '阶段名称'));
  head.appendChild(field('f-time', s.time, '时间（如 大一上）'));
  head.appendChild(icon);
  var tools = el('div', 'stage-edit-tools');
  [['↑', -1, '上移'], ['↓', 1, '下移']].forEach(function (b) {
    var btn = el('button', 'task-edit-add-btn', { textContent: b[0], title: b[2] });
    btn.addEventListener('click', function () {
      var sib = b[1] < 0 ? box.previousElementSibling : box.nextElementSibling;
      if (sib && sib.classList.contains('task-edit-stage')) box.parentNode.insertBefore(box, b[1] < 0 ? sib : sib.nextSibling);
    });
    tools.appendChild(btn);
  });
  var delStage = el('button', 'task-edit-del-btn', { textContent: '删除阶段', title: '删除整个阶段' });
  delStage.addEventListener('click', function () {
    var name = box.querySelector('.f-title').value || '未命名阶段';
    var st = Plan.stageStats(s, S.progress);
    var msg = '删除阶段「' + name + '」？' + (st.done ? '\n其中 ' + st.done + ' 个已完成任务的记录会归档保留。' : '') + '\n（点保存后才生效）';
    if (window.confirm(msg)) box.remove();
  });
  tools.appendChild(delStage);
  head.appendChild(tools);
  box.appendChild(head);

  var sub = el('div', 'stage-edit-head');
  sub.appendChild(field('f-output', s.output, '核心产出（如 第一个鸿蒙原生App）'));
  sub.appendChild(field('f-desc', s.desc, '一句话简介'));
  box.appendChild(sub);

  var list = el('div', 'task-edit-list');
  (s.items || []).forEach(function (it) { list.appendChild(editorRow(it)); });
  box.appendChild(list);

  [['+ 添加任务', 'task', ''], ['+ 添加周标签', 'week', ' week']].forEach(function (b) {
    var btn = el('button', 'task-edit-add-btn' + b[2], { textContent: b[0] });
    btn.addEventListener('click', function () {
      var row = editorRow({ type: b[1] });
      list.appendChild(row);
      row.querySelector('input').focus();
    });
    box.appendChild(btn);
  });
  return box;
}

function openTaskEditor() {
  var area = $('taskEditArea');
  area.innerHTML = '';
  var stages = el('div', 'plan-edit-stages');
  S.plan.stages.forEach(function (s) { stages.appendChild(editorStage(s)); });
  area.appendChild(stages);
  var add = el('button', 'task-edit-add-btn plan-add-stage', { textContent: '+ 新增阶段' });
  add.addEventListener('click', function () {
    var box = editorStage({ id: Plan.newId('s'), title: '', time: '', desc: '', output: '', icon: 'star', items: [] });
    stages.appendChild(box);
    box.querySelector('.f-title').focus();
  });
  area.appendChild(add);
  openSheet('planSheet');
}

function saveTaskEdits() {
  var old = {};
  S.plan.stages.forEach(function (s) { old[s.id] = s; });
  var next = [];
  document.querySelectorAll('#taskEditArea .task-edit-stage').forEach(function (box) {
    var v = function (c) { return box.querySelector(c).value.trim(); };
    var items = [];
    box.querySelectorAll('.task-edit-row').forEach(function (row) {
      var text = row.querySelector('input').value.trim();
      if (!text) return;
      if (row.dataset.type === 'week') items.push({ type: 'week', id: row.dataset.id, text: text });
      else { var st = Plan.splitStar(text); items.push({ type: 'task', id: row.dataset.id, text: st.text, star: st.star }); }
    });
    next.push({ id: box.dataset.id, title: v('.f-title') || '未命名阶段', time: v('.f-time'), desc: v('.f-desc'), output: v('.f-output'), icon: v('.f-icon'), items: items });
    delete old[box.dataset.id];
  });
  // 被删掉的阶段：有完成记录的归档，进度记录本身一直保留
  Object.keys(old).forEach(function (id) {
    if (Plan.stageStats(old[id], S.progress).done > 0) {
      old[id].archivedAt = new Date().toISOString();
      S.plan.archived.push(old[id]);
    }
  });
  S.plan.stages = next;
  Store.save('plan.json', S.plan);
  closeSheet();
  renderPlanViews();
  showToast('规划已保存');
}
