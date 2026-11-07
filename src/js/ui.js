// ============================================================
//  界面框架：标签切页、弹层（sheet）
//  动画只用位移，不用透明度：祖先元素一旦半透明，里面的液态玻璃会瞬间变平
// ============================================================

var UI = { view: 'today' };

function activeTab() { return document.querySelector('.tab.active'); }

// ===== 切页：和 iOS 一样即时切换，新页面从下方轻轻弹上来；任何时刻只显示一个视图 =====
function showView(name) {
  if (name === UI.view) { Motion.glideTo(activeTab(), true); return; }
  var from = document.querySelector('.view.active');
  var to = document.querySelector('.view[data-view="' + name + '"]');
  if (!from || !to) return;
  UI.view = name;
  document.querySelectorAll('.tab').forEach(function (t) {
    var on = t.dataset.view === name;
    t.classList.toggle('active', on);
    t.setAttribute('aria-selected', on ? 'true' : 'false');
  });
  Motion.glideTo(activeTab(), true);
  from.classList.remove('active', 'enter');
  window.scrollTo(0, 0);
  to.classList.remove('enter');
  void to.offsetWidth;            // 重新触发进场动画
  to.classList.add('active', 'enter');
}

// ===== 弹层：同一时间只开一个；点背景、按 Esc、点关闭、按住顶部下拉都能收起 =====
var Sheet = { current: null, onClose: null, closing: 0 };

function openSheet(id, onClose) {
  var layer = $('sheetLayer');
  if (Sheet.current) closeSheet(true);
  clearTimeout(Sheet.closing);
  Sheet.current = id;
  Sheet.onClose = onClose || null;
  layer.classList.remove('closing');
  layer.classList.add('open');
  var s = $(id);
  s.style.transform = '';
  s.classList.add('active');
  Glass.refresh(s);
}

function closeSheet(immediate) {
  var id = Sheet.current;
  if (!id) return;
  var layer = $('sheetLayer'), sheet = $(id), cb = Sheet.onClose;
  Sheet.current = null; Sheet.onClose = null;
  function done() {
    sheet.classList.remove('active');
    sheet.style.transform = '';
    layer.classList.remove('open', 'closing');
    if (cb) cb();
  }
  if (immediate) return done();
  layer.classList.add('closing');
  Sheet.closing = setTimeout(done, 300);
}

// ===== 设置分页：四页共用一个滚动区，选中项换成带色玻璃 =====
function showSettingsPage(name) {
  document.querySelectorAll('.set-page').forEach(function (p) { p.classList.toggle('active', p.dataset.page === name); });
  document.querySelectorAll('.set-nav-btn').forEach(function (b) {
    var on = b.dataset.page === name;
    b.classList.toggle('active', on);
    b.setAttribute('aria-selected', on ? 'true' : 'false');
    b.setAttribute('data-glass', on ? 'tint' : 'clear');
    Glass.refresh(b);
  });
  document.querySelector('.settings-sheet .sheet-body').scrollTop = 0;
  Glass.relayout();
}

// ===== 关于软件：版本号和更新记录都来自 CHANGELOG =====
function renderAbout() {
  $('aboutVersion').textContent = 'V' + CHANGELOG[0].v + (CHANGELOG[0].edition ? '-' + CHANGELOG[0].edition : '');
  $('aboutLog').innerHTML = CHANGELOG.map(function (x, i) {
    return '<div class="log-row"><div class="log-head"><b>V' + escapeHtml(x.v) + '</b><span>' + escapeHtml(x.title) + '</span>' +
      (i ? '' : '<em>最新</em>') + '<time>' + escapeHtml(x.date) + '</time></div><ul>' +
      x.items.map(function (t) { return '<li>' + escapeHtml(t) + '</li>'; }).join('') + '</ul></div>';
  }).join('');
}

function bindShell() {
  var tabs = $('viewTabs');
  Motion.initTabs(tabs, $('tabGlider'), function (tab) { if (tab) showView(tab.dataset.view); });
  // 键盘（Tab + 回车）仍然能切页；鼠标点击由滑块的按住/拖动逻辑处理
  document.querySelectorAll('.tab').forEach(function (t) {
    t.addEventListener('click', function (e) { if (e.detail === 0) showView(t.dataset.view); });
  });
  var place = function () { Motion.glideTo(activeTab(), false); };
  window.addEventListener('resize', place);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(place);
  place();

  $('settingsNav').addEventListener('click', function (e) {
    var b = e.target.closest('.set-nav-btn');
    if (b) showSettingsPage(b.dataset.page);
  });
  renderAbout();

  var layer = $('sheetLayer');
  layer.addEventListener('click', function (e) {
    if (e.target.classList.contains('sheet-dim') || e.target === layer) closeSheet();
    if (e.target.closest && e.target.closest('[data-close]')) closeSheet();
  });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeSheet(); });
  document.querySelectorAll('.sheet').forEach(function (s) {
    Motion.sheetDrag(s, s.querySelector('.sheet-head'), function () { if (Sheet.current === s.id) closeSheet(); });
  });
}
