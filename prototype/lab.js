/* ============================================================
   液态玻璃实验室：形状注册、交互物理、调参面板、帧循环
   交互只有一套弹簧：
   · 按压：缩放弹簧 + 轻微跟手偏移
   · 拖动：位置 1:1 跟手（不让弹簧去追），松手后带速度弹回
   · 拉伸：由（平滑后的）速度决定方向和幅度，体积守恒 sx·sy = 1
   ============================================================ */
(function () {
  'use strict';

  var DEF = {
    wallpaper: 'dawn', animated: true, dark: false,
    refr: 0.6, edge: 0.6, blur: 1.5, panelBlur: 14, chroma: 0.18, rim: 0.7,
    tint: 1, sat: 1.3, shadow: 0.35, glow: 0,
    pressScale: 1.06, pressResp: 0.26, pressDamp: 0.62, follow: 0.06,
    pressStretch: 0.6, pressMax: 0.1,
    lift: 1.12, dragResp: 0.36, dragDamp: 0.72, dragStretch: 0.45, dragMax: 0.12,
    jelly: 0.45, tabResp: 0.42, tabDamp: 0.74, quality: 1
  };

  var CONTROLS = [
    '壁纸',
    { k: 'wallpaper', label: '壁纸', type: 'select', opts: [['dawn', '晨雾（浅）'], ['aurora', '极光（深）'], ['sunset', '日落'], ['ocean', '深海'], ['stripes', '条纹测试'], ['image', '自选图片…']] },
    { k: 'animated', label: '动态壁纸', type: 'check' },
    { k: 'dark', label: '深色模式', type: 'check' },
    '玻璃质感',
    { k: 'refr', label: '折射强度', min: 0, max: 1.5, step: 0.01 },
    { k: 'edge', label: '边缘宽度', min: 0.1, max: 1, step: 0.01 },
    { k: 'blur', label: '按钮模糊', min: 0, max: 12, step: 0.1 },
    { k: 'panelBlur', label: '面板模糊', min: 0, max: 40, step: 0.5 },
    { k: 'chroma', label: '色散', min: 0, max: 0.6, step: 0.01 },
    { k: 'rim', label: '高光边', min: 0, max: 1.5, step: 0.01 },
    { k: 'tint', label: '染色浓度', min: 0, max: 1.5, step: 0.01 },
    { k: 'sat', label: '饱和度', min: 0.5, max: 2, step: 0.01 },
    { k: 'shadow', label: '阴影', min: 0, max: 1, step: 0.01 },
    { k: 'glow', label: '按压光晕', min: 0, max: 1, step: 0.01 },
    '按压',
    { k: 'pressScale', label: '按压放大', min: 1, max: 1.2, step: 0.005 },
    { k: 'pressResp', label: '响应时间', min: 0.1, max: 0.8, step: 0.01 },
    { k: 'pressDamp', label: '阻尼', min: 0.3, max: 1, step: 0.01 },
    { k: 'follow', label: '跟手偏移', min: 0, max: 0.2, step: 0.005 },
    { k: 'pressStretch', label: '按压拉伸', min: 0, max: 2, step: 0.01 },
    { k: 'pressMax', label: '按压最大拉伸', min: 0, max: 0.3, step: 0.005 },
    '拖动',
    { k: 'lift', label: '拿起放大', min: 1, max: 1.3, step: 0.005 },
    { k: 'dragResp', label: '回弹响应', min: 0.15, max: 0.9, step: 0.01 },
    { k: 'dragDamp', label: '回弹阻尼', min: 0.3, max: 1, step: 0.01 },
    { k: 'dragStretch', label: '拖动拉伸', min: 0, max: 2, step: 0.01 },
    { k: 'dragMax', label: '拖动最大拉伸', min: 0, max: 0.4, step: 0.005 },
    '松手果冻感',
    { k: 'jelly', label: '果冻阻尼', min: 0.2, max: 1, step: 0.01 },
    '标签滑块',
    { k: 'tabResp', label: '响应时间', min: 0.15, max: 0.9, step: 0.01 },
    { k: 'tabDamp', label: '阻尼', min: 0.3, max: 1, step: 0.01 },
    '画质',
    { k: 'quality', label: '渲染分辨率', min: 0.5, max: 1, step: 0.05 }
  ];

  var PRESETS = {
    dawn:   { base: [0.93, 0.92, 0.96], colors: [[1, 0.74, 0.58], [0.98, 0.6, 0.74], [0.58, 0.7, 1], [0.62, 0.9, 0.82]] },
    aurora: { base: [0.04, 0.05, 0.11], colors: [[0.16, 0.36, 0.96], [0.56, 0.26, 0.92], [0.08, 0.72, 0.68], [0.92, 0.34, 0.6]] },
    sunset: { base: [0.18, 0.07, 0.16], colors: [[1, 0.48, 0.2], [0.94, 0.26, 0.46], [0.48, 0.2, 0.72], [1, 0.76, 0.32]] },
    ocean:  { base: [0.02, 0.07, 0.14], colors: [[0, 0.44, 0.72], [0.08, 0.7, 0.8], [0.2, 0.3, 0.9], [0.04, 0.2, 0.42]] }
  };

  var TINT = {
    clear:  { l: [1, 1, 1, 0.12], d: [0.1, 0.11, 0.14, 0.35] },
    card:   { l: [1, 1, 1, 0.2],  d: [0.06, 0.07, 0.1, 0.45] },
    bar:    { l: [1, 1, 1, 0.24], d: [0.06, 0.07, 0.1, 0.48] },
    glider: { l: [1, 1, 1, 0.32], d: [1, 1, 1, 0.12] },
    blue:   { l: [0.05, 0.45, 1, 0.62], d: [0.05, 0.42, 1, 0.6] },
    green:  { l: [0.1, 0.78, 0.45, 0.6], d: [0.1, 0.72, 0.42, 0.58] },
    red:    { l: [1, 0.27, 0.23, 0.6],   d: [1, 0.27, 0.23, 0.58] }
  };
  var LIGHT = [-0.54, -0.84];

  /* ---------- 参数持久化（浏览器存储可能不可用，全部兜底） ---------- */
  var P = Object.assign({}, DEF);
  try { Object.assign(P, JSON.parse(localStorage.getItem('glassLab.v1') || '{}')); } catch (e) {}
  if (P.wallpaper === 'image') P.wallpaper = 'dawn';
  function save() { try { localStorage.setItem('glassLab.v1', JSON.stringify(P)); } catch (e) {} }

  var canvas = document.getElementById('gl');
  var GL = null;
  try { GL = new GLGlass(canvas); } catch (e) { console.error(e); toast('WebGL 初始化失败：' + e.message); }

  var S = 1;                       // CSS 像素 → 设备像素
  var shapes = [], glOrder = [];
  var G = null;                    // 标签滑块

  function tintOf(name) {
    var t = TINT[name] || TINT.clear;
    t = P.dark ? t.d : t.l;
    return [t[0], t[1], t[2], Math.min(1, t[3] * P.tint)];
  }

  /* ---------- 形状 ---------- */
  function roleOf(el) {
    if (el.id === 'tabbar') return 'bar';
    if (el.classList.contains('panel') || el.classList.contains('lgc-bg')) return 'card';
    if (el.classList.contains('orb')) return 'orb';
    return 'btn';
  }

  function makeShape(el, engine) {
    var s = {
      el: el, engine: engine, role: roleOf(el),
      tintName: el.getAttribute(engine === 'gl' ? 'data-gl' : 'data-css'),
      home: { x: 0, y: 0, w: 0, h: 0 }, radius: 0,
      ox: new Spring(0), oy: new Spring(0), sc: new Spring(1),
      st: new Spring(0, 0.16, 1), ang: 0,     // 拉伸量（负值 = 沿同一轴压扁）+ 拉伸轴角度
      glow: new Spring(0, 0.25, 1),
      gx: 0, gy: 0, vx: 0, vy: 0, lastT: 0, samples: [],
      pressing: false, dragging: false, lastTf: '',
      css: engine === 'css' ? new CSSGlass(el) : null
    };
    if (s.tintName === 'card' && s.role === 'bar') s.tintName = 'bar';
    if (s.role === 'bar') s.tintName = 'bar';
    if (el.hasAttribute('data-drag')) bindDrag(s);
    else if (s.role === 'btn') bindPress(s);
    return s;
  }

  function bevelOf(s, hw, hh) {
    return Math.min(P.edge * Math.min(hw, hh), s.role === 'card' || s.role === 'bar' ? 24 : 36);
  }
  function refrOf(s, bevel) {
    var k = s.role === 'card' || s.role === 'bar' ? 0.5 : s.role === 'glider' ? 1.3 : 1;
    return P.refr * bevel * k;
  }
  function blurOf(s) {
    return s.role === 'card' || s.role === 'bar' ? P.panelBlur : s.role === 'glider' ? P.blur * 0.5 : P.blur;
  }

  function measure() {
    shapes.forEach(function (s) {
      var t = s.el.style.transform;
      s.el.style.transform = 'none';
      var r = s.el.getBoundingClientRect();
      s.el.style.transform = t;
      s.home = { x: r.left, y: r.top, w: r.width, h: r.height };
      s.radius = parseFloat(getComputedStyle(s.el).borderTopLeftRadius) || 0;
    });
    measureTabs();
    applyCSS();
  }

  /* CSS 方案的静态参数：只在调参/尺寸变化时更新，不进帧循环 */
  function applyCSS() {
    var root = document.documentElement.style;
    root.setProperty('--rim', P.rim);
    root.setProperty('--shadow', P.shadow);
    shapes.forEach(function (s) {
      if (!s.css) return;
      var hw = s.home.w / 2, hh = s.home.h / 2;
      var bevel = bevelOf(s, hw, hh);
      s.css.update({
        w: s.home.w, h: s.home.h, radius: s.radius, bevel: bevel,
        amt: refrOf(s, bevel), chroma: P.chroma, blur: blurOf(s), sat: P.sat
      });
      var t = tintOf(s.tintName);
      var colored = s.tintName === 'blue' || s.tintName === 'green' || s.tintName === 'red';
      s.el.style.setProperty('--tint', t.slice(0, 3).map(function (v) { return Math.round(v * 255); }).join(','));
      s.el.style.setProperty('--ta', (t[3] * (colored ? 0.85 : 0.75)).toFixed(3));
    });
  }

  /* 线性部分：缩放 × 沿 ang 轴的体积守恒拉伸（st<0 时沿该轴压扁 = 果冻回弹） */
  function linear(sc, st, th) {
    var sx = 1 + Math.max(st, -0.3), sy = 1 / sx;
    var c = Math.cos(th), n = Math.sin(th);
    return [sc * (c * c * sx + n * n * sy), sc * c * n * (sx - sy), sc * (n * n * sx + c * c * sy)];
  }

  /* 松手：拉伸量欠阻尼回零 → 拉长、压扁、再回正一次 */
  function releaseStretch(s) {
    s.st.tune(0.32, P.jelly).target = 0;
  }

  /* ---------- 按压：指针在按钮内移动时，按钮被“拉”向指针方向 ---------- */
  function bindPress(s) {
    var el = s.el;
    function track(e) {
      var rx = e.clientX - (s.home.x + s.home.w / 2), ry = e.clientY - (s.home.y + s.home.h / 2);
      s.ox.tune(P.pressResp, 0.85).target = rx * P.follow;
      s.oy.tune(P.pressResp, 0.85).target = ry * P.follow;
      s.gx = rx; s.gy = ry;
      // 归一化到按钮半尺寸：边缘按下比中心按下拉得更明显
      var nx = rx / (s.home.w / 2), ny = ry / (s.home.h / 2), d = Math.hypot(nx, ny);
      if (d > 0.08) s.ang = Math.atan2(ry, rx);
      s.st.tune(0.2, 0.85).target = Math.min(d * P.pressStretch * 0.12, P.pressMax);
    }
    el.addEventListener('pointerdown', function (e) {
      if (e.button !== 0) return;
      try { el.setPointerCapture(e.pointerId); } catch (err) {}
      s.pressing = true;
      s.sc.tune(P.pressResp, P.pressDamp).target = P.pressScale;
      s.glow.target = 1;
      track(e);
    });
    el.addEventListener('pointermove', function (e) { if (s.pressing) track(e); });
    function up() {
      if (!s.pressing) return;
      s.pressing = false;
      s.sc.tune(P.pressResp, P.pressDamp).target = 1;
      s.ox.tune(P.pressResp, P.pressDamp).target = 0;
      s.oy.tune(P.pressResp, P.pressDamp).target = 0;
      s.glow.target = 0;
      releaseStretch(s);
    }
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
  }

  /* ---------- 拖动 ----------
     速度 = 最近 80ms 内首末两点的位移 / 时间差。
     逐事件求导时，相邻事件间隔可能只有 1~4ms，算出的速度会剧烈跳动，
     拉伸量跟着抖 —— 这就是之前拖动时“微微乱抖”的原因 */
  var WIN = 80;
  function velocity(s) {
    var a = s.samples, n = a.length;
    if (n < 2) return [0, 0];
    var p = a[n - 1], q = a[0], dt = (p.t - q.t) / 1000;
    if (dt < 0.012) return [s.vx, s.vy];
    return [(p.x - q.x) / dt, (p.y - q.y) / dt];
  }
  function pushSample(s, t, x, y) {
    s.samples.push({ t: t, x: x, y: y });
    while (s.samples.length > 2 && t - s.samples[0].t > WIN) s.samples.shift();
  }

  function bindDrag(s) {
    var el = s.el, grabX = 0, grabY = 0;
    el.addEventListener('pointerdown', function (e) {
      if (e.button !== 0) return;
      try { el.setPointerCapture(e.pointerId); } catch (err) {}
      s.dragging = true;
      el.classList.add('dragging');
      grabX = e.clientX - s.ox.x; grabY = e.clientY - s.oy.x;
      s.samples = []; pushSample(s, e.timeStamp, e.clientX, e.clientY);
      s.lastT = e.timeStamp; s.vx = 0; s.vy = 0;
      s.sc.tune(0.3, 0.7).target = P.lift;
      s.glow.target = 1;
    });
    el.addEventListener('pointermove', function (e) {
      if (!s.dragging) return;
      var evs = e.getCoalescedEvents ? e.getCoalescedEvents() : [];
      if (!evs.length) evs = [e];
      for (var i = 0; i < evs.length; i++) pushSample(s, evs[i].timeStamp, evs[i].clientX, evs[i].clientY);
      s.lastT = e.timeStamp;
      var v = velocity(s);
      s.vx = v[0]; s.vy = v[1];
      s.ox.jump(e.clientX - grabX, s.vx);
      s.oy.jump(e.clientY - grabY, s.vy);
      s.gx = e.clientX - (s.home.x + s.home.w / 2 + s.ox.x);
      s.gy = e.clientY - (s.home.y + s.home.h / 2 + s.oy.x);
    });
    function up(e) {
      if (!s.dragging) return;
      s.dragging = false;
      el.classList.remove('dragging');
      if (e.timeStamp - s.lastT > 60) { s.vx = 0; s.vy = 0; }
      s.ox.tune(P.dragResp, P.dragDamp); s.ox.target = 0; s.ox.v = s.vx;
      s.oy.tune(P.dragResp, P.dragDamp); s.oy.target = 0; s.oy.v = s.vy;
      s.sc.tune(0.3, 0.62).target = 1;
      s.glow.target = 0;
      releaseStretch(s);
    }
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
  }

  /* ---------- 标签滑块 ---------- */
  function initTabs() {
    var bar = document.getElementById('tabbar');
    var tabs = Array.prototype.slice.call(bar.querySelectorAll('.tab'));
    G = { tabs: tabs, rects: [], active: 0, cx: new Spring(0), w: new Spring(0), sc: new Spring(1), cy: 0, h: 0, ready: false, scrub: null };

    function nearest(x) {
      var best = 0, bd = 1e9;
      G.rects.forEach(function (r, i) {
        var d = Math.abs(r.left + r.width / 2 - x);
        if (d < bd) { bd = d; best = i; }
      });
      return best;
    }
    bar.addEventListener('pointerdown', function (e) {
      if (e.button !== 0) return;
      try { bar.setPointerCapture(e.pointerId); } catch (err) {}
      G.scrub = { x0: e.clientX, off: e.clientX - G.cx.x, moved: false, lastX: e.clientX, lastT: e.timeStamp, v: 0 };
    });
    bar.addEventListener('pointermove', function (e) {
      var sc = G.scrub;
      if (!sc) return;
      if (!sc.moved && Math.abs(e.clientX - sc.x0) > 6) sc.moved = true;
      if (!sc.moved) return;
      var dt = Math.max((e.timeStamp - sc.lastT) / 1000, 0.001);
      sc.v = sc.v * 0.5 + (e.clientX - sc.lastX) / dt * 0.5;
      sc.lastX = e.clientX; sc.lastT = e.timeStamp;
      var first = G.rects[0], last = G.rects[G.rects.length - 1];
      var x = Math.min(Math.max(e.clientX - sc.off, first.left + first.width / 2), last.left + last.width / 2);
      G.cx.jump(x, sc.v);
    });
    function up(e) {
      var sc = G.scrub;
      if (!sc) return;
      G.scrub = null;
      select(nearest(sc.moved ? G.cx.x : e.clientX));
    }
    bar.addEventListener('pointerup', up);
    bar.addEventListener('pointercancel', up);
  }

  function select(i) {
    G.active = i;
    G.tabs.forEach(function (t, j) { t.classList.toggle('active', j === i); });
    var r = G.rects[i];
    G.cx.tune(P.tabResp, P.tabDamp).target = r.left + r.width / 2;
    G.w.tune(P.tabResp, Math.min(1, P.tabDamp + 0.15)).target = r.width;
  }

  function measureTabs() {
    if (!G) return;
    G.rects = G.tabs.map(function (t) { return t.getBoundingClientRect(); });
    var r = G.rects[G.active];
    G.cy = r.top + r.height / 2; G.h = r.height;
    G.cx.jump(r.left + r.width / 2); G.w.jump(r.width);
  }

  /* ---------- 帧循环 ---------- */
  var glList = [], last = 0, time = 0, frames = 0, fpsT = 0;
  var fpsEl = document.getElementById('fps');

  function glDesc(s, cx, cy, hw, hh, L, radius) {
    var bevel = bevelOf(s, hw, hh);
    var det = L[0] * L[2] - L[1] * L[1];
    var m = [L[2] / det, -L[1] / det, -L[1] / det, L[0] / det];
    var gxl = (m[0] * s.gx + m[2] * s.gy) * S, gyl = (m[1] * s.gx + m[3] * s.gy) * S;
    return {
      cx: cx * S, cy: cy * S, hw: hw * S, hh: hh * S, m: m,
      tint: tintOf(s.tintName), radius: radius * S,
      refr: refrOf(s, bevel) * S, bevel: bevel * S,
      lod: Math.log2(1 + blurOf(s) * S),
      gx: gxl, gy: gyl, glow: s.glow.x * P.glow, boost: s.role === 'glider' ? 0.35 : 0
    };
  }

  function frame(now) {
    var dt = last ? Math.min((now - last) / 1000, 1 / 20) : 1 / 60;
    last = now; time += dt;

    glList.length = 0;
    for (var i = 0; i < glOrder.length; i++) {
      var s = glOrder[i];
      if (s === 'glider') { glList.push(stepGlider(dt)); continue; }
      stepShape(s, dt);
      if (s.engine === 'gl') {
        var L = s.L || [1, 0, 1];
        glList.push(glDesc(s, s.home.x + s.home.w / 2 + s.ox.x, s.home.y + s.home.h / 2 + s.oy.x,
          s.home.w / 2, s.home.h / 2, L, s.radius));
      }
    }
    if (GL) GL.render(time, P.animated && GL.mode === 0, glList,
      { dpr: S, chroma: P.chroma, rim: P.rim, shadow: P.shadow, sat: P.sat, light: LIGHT });

    frames++;
    if (now - fpsT > 500) { fpsEl.textContent = Math.round(frames * 1000 / (now - fpsT)) + ' fps'; frames = 0; fpsT = now; }
    requestAnimationFrame(frame);
  }

  function stepShape(s, dt) {
    if (s.role === 'card' || s.role === 'bar') return;
    if (s.dragging) {
      // 指针停住 40ms 视为静止，拉伸平滑收回
      if (performance.now() - s.lastT > 40) { s.vx = 0; s.vy = 0; s.samples.length = 0; }
      var sp = Math.hypot(s.vx, s.vy);
      // 拉伸轴只在速度足够时更新，并按轴向（模 π）平滑转动，低速时不会原地打转
      if (sp > 80) {
        var dA = Math.atan2(s.vy, s.vx) - s.ang;
        dA = dA - Math.PI * Math.round(dA / Math.PI);
        s.ang += dA * (1 - Math.exp(-dt / 0.05));
      }
      s.st.tune(0.16, 1).target = Math.min(sp * P.dragStretch * 0.0004, P.dragMax);
    }
    s.ox.step(dt); s.oy.step(dt); s.sc.step(dt);
    s.st.step(dt); s.glow.step(dt);
    var L = s.L = linear(s.sc.x, s.st.x, s.ang);
    var tf = 'translate(' + s.ox.x.toFixed(2) + 'px,' + s.oy.x.toFixed(2) + 'px) matrix(' +
      L[0].toFixed(4) + ',' + L[1].toFixed(4) + ',' + L[1].toFixed(4) + ',' + L[2].toFixed(4) + ',0,0)';
    if (tf !== s.lastTf) { s.el.style.transform = tf; s.lastTf = tf; }
    if (s.css) {
      s.el.style.setProperty('--glow', (s.glow.x * P.glow).toFixed(3));
      s.el.style.setProperty('--gx', (50 + s.gx / s.home.w * 100).toFixed(1) + '%');
      s.el.style.setProperty('--gy', (50 + s.gy / s.home.h * 100).toFixed(1) + '%');
    }
  }

  var gliderShape = { role: 'glider', tintName: 'glider', gx: 0, gy: 0, glow: { x: 0 } };
  function stepGlider(dt) {
    var moving = G.scrub && G.scrub.moved || Math.abs(G.cx.v) > 60;
    G.sc.tune(0.3, 0.7).target = moving ? 1 + (P.lift - 1) * 1.2 : 1;
    G.cx.step(dt); G.w.step(dt); G.sc.step(dt);
    var st = Math.min(Math.abs(G.cx.v) * P.dragStretch * 0.0004, P.dragMax);
    var L = [G.sc.x * (1 + st), 0, G.sc.x / (1 + st)];
    return glDesc(gliderShape, G.cx.x, G.cy, G.w.x / 2, G.h / 2, L, G.h / 2);
  }

  /* ---------- 壁纸 ---------- */
  function stripes() {
    var c = document.createElement('canvas');
    c.width = 1600; c.height = 1000;
    var x = c.getContext('2d');
    var cols = ['#ff5a5f', '#ffb400', '#00a699', '#007aff', '#8e44ad', '#f2f2f2'];
    for (var i = -40; i < 80; i++) {
      x.fillStyle = cols[(i + 400) % cols.length];
      x.beginPath();
      x.moveTo(i * 40, 0); x.lineTo(i * 40 + 20, 0); x.lineTo(i * 40 + 20 - 1000, 1000); x.lineTo(i * 40 - 1000, 1000);
      x.fill();
    }
    x.fillStyle = 'rgba(0,0,0,.78)';
    x.font = 'bold 120px system-ui, "Microsoft YaHei"';
    for (var r = 0; r < 5; r++) x.fillText('液态玻璃 Liquid Glass 0123', 40 - r * 120, 170 + r * 200);
    return c;
  }
  function setWallpaper(name) {
    if (!GL) return;
    if (name === 'image') { document.getElementById('imgInput').click(); return; }
    if (name === 'stripes') GL.setImage(stripes());
    else GL.setPreset(PRESETS[name] || PRESETS.dawn);
  }
  document.getElementById('imgInput').addEventListener('change', function (e) {
    var f = e.target.files && e.target.files[0];
    if (!f) return;
    createImageBitmap(f).then(function (b) { GL.setImage(b); toast('已换成你的图片（刷新后不保留）'); })
      .catch(function () { toast('图片读取失败'); });
  });

  /* ---------- 调参面板 ---------- */
  var inputs = {};
  function buildControls() {
    var body = document.getElementById('ctrlBody');
    CONTROLS.forEach(function (c) {
      if (typeof c === 'string') {
        var h = document.createElement('div'); h.className = 'grp'; h.textContent = c; body.appendChild(h);
        return;
      }
      var row = document.createElement('label');
      row.className = 'row' + (c.type === 'check' ? ' check' : '');
      var lab = document.createElement('span'); lab.textContent = c.label; row.appendChild(lab);
      var inp;
      if (c.type === 'select') {
        inp = document.createElement('select');
        c.opts.forEach(function (o) { var op = document.createElement('option'); op.value = o[0]; op.textContent = o[1]; inp.appendChild(op); });
        inp.addEventListener('change', function () { set(c.k, inp.value); });
        row.appendChild(inp);
      } else if (c.type === 'check') {
        inp = document.createElement('input'); inp.type = 'checkbox';
        inp.addEventListener('change', function () { set(c.k, inp.checked); });
        row.appendChild(inp);
      } else {
        inp = document.createElement('input'); inp.type = 'range';
        inp.min = c.min; inp.max = c.max; inp.step = c.step;
        var out = document.createElement('output');
        inp.addEventListener('input', function () { set(c.k, +inp.value); });
        inp._out = out;
        row.appendChild(inp); row.appendChild(out);
      }
      inputs[c.k] = { el: inp, c: c };
      body.appendChild(row);
    });
    syncControls();
  }
  function fmt(v, step) { var d = step < 0.01 ? 3 : step < 0.1 ? 2 : step < 1 ? 1 : 0; return (+v).toFixed(d); }
  function syncControls() {
    Object.keys(inputs).forEach(function (k) {
      var it = inputs[k];
      if (it.c.type === 'check') it.el.checked = !!P[k];
      else it.el.value = P[k];
      if (it.el._out) it.el._out.textContent = fmt(P[k], it.c.step);
    });
  }
  function set(k, v) {
    P[k] = v;
    var it = inputs[k];
    if (it && it.el._out) it.el._out.textContent = fmt(v, it.c.step);
    if (k === 'wallpaper') setWallpaper(v);
    if (k === 'dark') document.body.classList.toggle('dark', !!v);
    if (k === 'quality') resize();
    else applyCSS();
    save();
  }
  document.getElementById('resetBtn').addEventListener('click', function () {
    P = Object.assign({}, DEF);
    document.body.classList.toggle('dark', P.dark);
    setWallpaper(P.wallpaper);
    syncControls(); resize(); save();
    toast('已恢复默认参数');
  });
  document.getElementById('copyBtn').addEventListener('click', function () {
    var txt = JSON.stringify(P, null, 1);
    (navigator.clipboard ? navigator.clipboard.writeText(txt) : Promise.reject())
      .then(function () { toast('参数已复制，可以直接粘贴给我'); })
      .catch(function () { console.log(txt); toast('复制失败，参数已输出到控制台'); });
  });

  var toastT = 0;
  function toast(msg) {
    var t = document.getElementById('toast');
    t.textContent = msg; t.classList.add('show');
    clearTimeout(toastT); toastT = setTimeout(function () { t.classList.remove('show'); }, 1800);
  }

  /* ---------- 启动 ---------- */
  function resize() {
    S = (window.devicePixelRatio || 1) * P.quality;
    if (GL) GL.resize(Math.round(innerWidth * S), Math.round(innerHeight * S));
    measure();
  }

  function boot() {
    var list = document.getElementById('list'), html = '';
    for (var i = 1; i <= 30; i++) html += '<p><b>第 ' + i + ' 条</b>　滚动时，内容滑到顶部会逐渐变模糊，而不是被硬切。</p>';
    list.innerHTML = html;

    document.body.classList.toggle('dark', !!P.dark);
    var bar = makeShape(document.getElementById('tabbar'), 'gl');
    shapes.push(bar);
    var gl = Array.prototype.map.call(document.querySelectorAll('[data-gl]:not(#tabbar)'), function (el) { return makeShape(el, 'gl'); });
    var css = Array.prototype.map.call(document.querySelectorAll('[data-css]'), function (el) { return makeShape(el, 'css'); });
    shapes = shapes.concat(gl, css);
    // WebGL 绘制顺序：标签栏 → 滑块 → 卡片 → 按钮
    glOrder = [bar, 'glider']
      .concat(gl.filter(function (s) { return s.role === 'card'; }))
      .concat(gl.filter(function (s) { return s.role !== 'card'; }))
      .concat(css);

    initTabs();
    buildControls();
    setWallpaper(P.wallpaper);
    resize();
    window.addEventListener('resize', resize);
    // 布局变化（窗口缩放、字体加载）都要重新量位置，否则玻璃和按钮会错位
    if (window.ResizeObserver) new ResizeObserver(function () { resize(); }).observe(document.querySelector('.stage'));
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(measure);
    requestAnimationFrame(frame);
  }

  boot();
})();
