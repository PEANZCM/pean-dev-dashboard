// ============================================================
//  界面框架：标签切页、弹层（sheet）
// ============================================================

// ===== 切页：旧视图先淡出、隐藏，新视图再淡入 —— 任何时刻只有一个视图在显示 =====
var UI = { view: 'today', switching: false };

function moveGlider() {
  var active = document.querySelector('.tab.active');
  if (!active) return;
  var g = $('tabGlider');
  g.style.width = active.offsetWidth + 'px';
  g.style.transform = 'translateX(' + (active.offsetLeft - 4) + 'px)';
}

function showView(name) {
  if (name === UI.view || UI.switching) return;
  var from = document.querySelector('.view.active');
  var to = document.querySelector('.view[data-view="' + name + '"]');
  if (!from || !to) return;
  UI.view = name;
  UI.switching = true;
  document.querySelectorAll('.tab').forEach(function (t) {
    var on = t.dataset.view === name;
    t.classList.toggle('active', on);
    t.setAttribute('aria-selected', on ? 'true' : 'false');
  });
  moveGlider();
  from.classList.add('leave');
  setTimeout(function () {
    from.classList.remove('active', 'leave');
    window.scrollTo(0, 0);
    to.classList.add('active', 'enter');
    if (name === 'progress') renderHeatmap();   // 热力图按可见宽度排版
    setTimeout(function () { to.classList.remove('enter'); UI.switching = false; }, 340);
  }, 160);
}

// ===== 弹层：同一时间只开一个；点背景、按 Esc、点关闭按钮都能收起 =====
var Sheet = { current: null, onClose: null };

function openSheet(id, onClose) {
  var layer = $('sheetLayer');
  if (Sheet.current) closeSheet(true);
  Sheet.current = id;
  Sheet.onClose = onClose || null;
  layer.classList.remove('closing');
  layer.classList.add('open');
  $(id).classList.add('active');
}

function closeSheet(immediate) {
  var id = Sheet.current;
  if (!id) return;
  var layer = $('sheetLayer'), sheet = $(id), cb = Sheet.onClose;
  Sheet.current = null; Sheet.onClose = null;
  function done() {
    sheet.classList.remove('active');
    layer.classList.remove('open', 'closing');
    if (cb) cb();
  }
  if (immediate) return done();
  layer.classList.add('closing');
  setTimeout(done, 200);
}

function bindShell() {
  document.querySelectorAll('.tab').forEach(function (t) {
    t.addEventListener('click', function () { showView(t.dataset.view); });
  });
  window.addEventListener('resize', moveGlider);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(moveGlider);
  moveGlider();

  var layer = $('sheetLayer');
  layer.addEventListener('click', function (e) {
    if (e.target === layer) closeSheet();
    if (e.target.closest && e.target.closest('[data-close]')) closeSheet();
  });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeSheet(); });
}
