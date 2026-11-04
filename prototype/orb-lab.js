// AI 思考图标实验室：三种背景、大小两种尺寸同时看，改参数立刻生效
(function () {
  'use strict';

  var orbs = [], DEF = JSON.parse(JSON.stringify(Orb.P)), P = Orb.P, KEY = 'orb-params';
  // 调过的参数存在本机，关掉窗口再打开还在
  try { Object.assign(P, JSON.parse(localStorage.getItem(KEY + '-v3') || '{}')); } catch (e) {}
  var $ = function (id) { return document.getElementById(id); };
  var SIZES = [[140], [24]];

  document.querySelectorAll('.stage').forEach(function (stage) {
    SIZES.forEach(function (list) {
      var row = document.createElement('div');
      row.className = 'row';
      list.forEach(function (size) {
        var c = document.createElement('canvas');
        row.appendChild(c);
        orbs.push(new Orb(c, { size: size, dark: stage.dataset.dark === '1' }));
      });
      stage.appendChild(row);
    });
  });
  window.__orbs = orbs;

  var NAMES = { thinking: '思考中', standby: '待命', done: '完成', fail: '失败' };
  function all(fn) { orbs.forEach(fn); }
  setInterval(function () { $('state').textContent = NAMES[orbs[0].state]; }, 80);

  $('bThink').onclick = function () { all(function (o) { o.think(); }); };
  ['Done', 'Cancel', 'Fail'].forEach(function (n) {
    $('b' + n).onclick = function () { all(function (o) { o.finish(n.toLowerCase()); }); };
  });
  $('bFast').onclick = function () { all(function (o) { o.think(); o.finish('done'); }); };
  // 每隔一小段随机切一次状态，看任何时刻打断都不跳
  $('bChaos').onclick = function () {
    var seq = ['think', 'done', 'think', 'fail', 'think', 'cancel', 'think', 'done'], i = 0;
    (function next() {
      if (i >= seq.length) return;
      var s = seq[i++];
      all(function (o) { if (s === 'think') o.think(); else { clearTimeout(o.timer); o.thinkAt = 0; o.finish(s); } });
      setTimeout(next, 260 + Math.random() * 420);
    })();
  };

  var LIST = [
    ['speed', '平均转速', 1, 14, 0.1], ['pulse', '快慢幅度', 0, 0.9, 0.01], ['pulsePeriod', '快慢周期（秒）', 0.5, 4, 0.05],
    ['trail', '拖尾长度', 0.8, 6, 0.1], ['kepler', '近核加速', 0, 0.9, 0.02], ['orbitB', '轨道扁度', 0.1, 0.6, 0.01],
    ['lineWidth', '线宽', 0.025, 0.09, 0.001], ['glow', '发光', 0, 3, 0.05], ['blend', '思考过渡带', 0.05, 1, 0.01], ['softBlend', '待命过渡带', 0.05, 1, 0.01],
    ['mergeResponse', '汇聚速度（秒）', 0.12, 0.8, 0.01], ['mergeStagger', '汇聚错峰', 0, 1.6, 0.05], ['mergeCarry', '汇聚惯性', 0, 1, 0.05],
    ['response', '发散速度（秒）', 0.25, 1.2, 0.01], ['stagger', '发散错峰', 0, 2.5, 0.05],
    ['damping', '阻尼', 0.55, 1, 0.01], ['flow', '待命流转', 0, 0.6, 0.01], ['gap', '轨道缺口', 0.06, 0.3, 0.01],
    ['sweepMs', '逆时针走圈（毫秒）', 250, 1400, 10], ['writeMs', '手写对勾（毫秒）', 150, 1000, 10], ['holdDone', '对勾停留（毫秒）', 400, 3000, 100]
  ];
  function showJson() {
    $('json').value = JSON.stringify(P);
    try { localStorage.setItem(KEY + '-v3', JSON.stringify(P)); } catch (e) {}
  }
  function bind() {
    var box = $('sliders');
    box.innerHTML = '';
    LIST.forEach(function (m) {
      var l = document.createElement('label');
      l.innerHTML = m[1] + '<b>' + P[m[0]] + '</b><input type="range" min="' + m[2] + '" max="' + m[3] + '" step="' + m[4] + '" value="' + P[m[0]] + '">';
      l.querySelector('input').addEventListener('input', function () {
        P[m[0]] = +this.value;
        l.querySelector('b').textContent = this.value;
        showJson();
        all(function (o) { o.wake(); });
      });
      box.appendChild(l);
    });
    $('green').value = P.green; $('red').value = P.red;
    showJson();
  }
  ['green', 'red'].forEach(function (k) {
    $(k).addEventListener('input', function () { P[k] = this.value; showJson(); all(function (o) { o.wake(); }); });
  });
  $('bReset').onclick = function () { Object.keys(DEF).forEach(function (k) { P[k] = DEF[k]; }); bind(); };
  // 把之前复制的参数贴进下面的框，点这个按钮就恢复
  $('bApply').onclick = function () {
    try { Object.assign(P, JSON.parse($('json').value)); bind(); all(function (o) { o.wake(); }); }
    catch (e) { $('json').value = '参数格式不对：' + $('json').value; }
  };
  $('bCopy').onclick = function () { navigator.clipboard.writeText($('json').value); };
  bind();
})();
