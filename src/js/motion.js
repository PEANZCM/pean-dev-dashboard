// ============================================================
//  动效：一套弹簧管所有交互
//  · 按钮：按下放大；按住可以拖着走一段（越拉阻力越大，像橡皮筋）。
//    拉伸只沿水平 / 竖直方向、按像素计算：不产生剪切，药丸按钮斜着拖也不会歪；
//    形状只由手指拉出的距离决定，不看速度，手的细微抖动不会让按钮乱抖。
//    松手弹回一次，形状几乎不过冲
//  · 标签滑块：按住拖动时变成透明放大镜，浮到文字上方、比底下的胶囊更大，
//    按速度动态拉伸；松手吸附到最近的标签，飞行中同样拉伸
//  · 弹层：按住顶部往下拖，1:1 跟手，拖得够远或甩得够快就关掉，否则弹回
//  transform 只由这里写；每次写完通知 Glass，让卡片磨砂层上的「洞」跟着按钮一起动
// ============================================================
var Motion = (function () {
  'use strict';

  var D = {
    pressScale: 1.08, pressResp: 0.24, pressDamp: 0.6,   // 松手缩回过冲约 9%
    rubber: 22,                       // 按钮最多被拖出多远（px），越接近越拉不动
    pullStretch: 6,                   // 每个方向最多拉长多少像素（宽按钮横向几乎看不出，纵向明显）
    waist: 0.25,                      // 拉长一个方向时，另一方向收窄的比例
    backResp: 0.36, backDamp: 0.62,   // 位置弹回：过冲约 8%，有一次清楚的回弹
    jelly: 0.8,                       // 形状回正阻尼：过冲约 1.5%，几乎看不到晃动
    tabResp: 0.42, tabDamp: 0.7,
    lensScale: 1.45, flyScale: 1.22, tabStretch: 0.5, tabMax: 0.2
  };
  var level = 'full';                 // full | reduced | off
  var active = [], raf = 0, last = 0;

  function P(k) {
    if (level === 'reduced') {
      if (/Stretch$/.test(k) || k === 'rubber') return 0;
      if (k === 'pressScale') return 1.03;
      if (/Damp$/.test(k) || k === 'jelly') return 1;
      if (k === 'lensScale' || k === 'flyScale') return 1.06;
    }
    return D[k];
  }

  function kick(o) {
    if (active.indexOf(o) === -1) active.push(o);
    if (!raf) { last = 0; raf = requestAnimationFrame(frame); }
  }
  function frame(now) {
    var dt = last ? Math.min((now - last) / 1000, 1 / 20) : 1 / 60;
    last = now;
    active = active.filter(function (o) { return o.step(dt); });
    raf = active.length ? requestAnimationFrame(frame) : 0;
  }
  function settled(s, eps) { return Math.abs(s.x - s.target) < eps && Math.abs(s.v) < eps * 20; }

  // 只沿水平 / 竖直拉伸：矩阵没有斜切项，按钮的边永远保持水平和竖直
  function axisMatrix(sc, ex, ey, w, h) {
    var rx = ex / w, ry = ey / h;
    return [sc * (1 + rx - D.waist * ry), 0, sc * (1 + ry - D.waist * rx)];
  }

  // iOS 式橡皮筋：拉得越远越吃力，永远到不了上限
  function rubber(d, L) { return L ? Math.sign(d) * L * (1 - 1 / (Math.abs(d) * 0.55 / L + 1)) : 0; }

  // 最近 80ms 首末两点求速度：逐事件求导会因为事件间隔不均而抖
  function Velocity() { this.s = []; }
  Velocity.prototype.add = function (t, x, y) {
    this.s.push({ t: t, x: x, y: y });
    while (this.s.length > 2 && t - this.s[0].t > 80) this.s.shift();
  };
  Velocity.prototype.get = function () {
    var a = this.s, n = a.length;
    if (n < 2) return [0, 0];
    var dt = (a[n - 1].t - a[0].t) / 1000;
    return dt < 0.012 ? [0, 0] : [(a[n - 1].x - a[0].x) / dt, (a[n - 1].y - a[0].y) / dt];
  };

  function writeXf(el, tx, ty, m) {
    if (m) {
      el._xf = { tx: tx, ty: ty, a: m[0], b: m[1], c: m[1], d: m[2] };
      el.style.transform = 'translate(' + tx.toFixed(2) + 'px,' + ty.toFixed(2) + 'px) matrix(' +
        m[0].toFixed(4) + ',' + m[1].toFixed(4) + ',' + m[1].toFixed(4) + ',' + m[2].toFixed(4) + ',0,0)';
    } else {
      el._xf = null;
      el.style.transform = '';
    }
    if (window.Glass) Glass.moved(el);
  }

  /* ---------- 按钮：按压 + 橡皮筋拖动 + 回弹 ---------- */
  function pressable(el) {
    if (el._press) return;
    var o = el._press = {
      ox: new Spring(0), oy: new Spring(0), sc: new Spring(1),
      ex: new Spring(0, 0.3, 0.8), ey: new Spring(0, 0.3, 0.8),   // 两个方向各拉长多少像素
      w: 1, h: 1, down: false, x0: 0, y0: 0, moved: false, vel: new Velocity(), lastMove: 0,
      step: function (dt) {
        if (o.down) {
          // 按下时形状直接由当前拉出的距离算出，同一个位置永远是同一个形状
          var L = Math.max(D.rubber, 1);
          o.ex.jump(Math.min(Math.abs(o.ox.x) / L, 1) * P('pullStretch'));
          o.ey.jump(Math.min(Math.abs(o.oy.x) / L, 1) * P('pullStretch'));
        }
        o.ox.step(dt); o.oy.step(dt); o.sc.step(dt); o.ex.step(dt); o.ey.step(dt);
        var rest = !o.down && settled(o.ox, 0.05) && settled(o.oy, 0.05) && settled(o.sc, 0.0005) && settled(o.ex, 0.02) && settled(o.ey, 0.02);
        writeXf(el, o.ox.x, o.oy.x, rest ? null : axisMatrix(o.sc.x, o.ex.x, o.ey.x, o.w, o.h));
        return !rest;
      }
    };
    el.addEventListener('pointerdown', function (e) {
      if (level === 'off' || e.button !== 0 || el.disabled) return;
      try { el.setPointerCapture(e.pointerId); } catch (err) {}
      o.down = true; o.moved = false;
      o.x0 = e.clientX; o.y0 = e.clientY;
      o.w = el.offsetWidth || 1; o.h = el.offsetHeight || 1;
      o.vel = new Velocity(); o.vel.add(e.timeStamp, e.clientX, e.clientY); o.lastMove = performance.now();
      o.sc.tune(D.pressResp, P('pressDamp')).target = P('pressScale');
      kick(o);
    });
    el.addEventListener('pointermove', function (e) {
      if (!o.down) return;
      var evs = e.getCoalescedEvents ? e.getCoalescedEvents() : [];
      (evs.length ? evs : [e]).forEach(function (ev) { o.vel.add(ev.timeStamp, ev.clientX, ev.clientY); });
      o.lastMove = performance.now();
      var dx = e.clientX - o.x0, dy = e.clientY - o.y0;
      if (Math.hypot(dx, dy) > 8) o.moved = true;
      var L = P('rubber');
      o.ox.jump(rubber(dx, L));
      o.oy.jump(rubber(dy, L));
      kick(o);
    });
    function up() {
      if (!o.down) return;
      o.down = false;
      var v = performance.now() - o.lastMove > 60 ? [0, 0] : o.vel.get();
      o.ox.tune(D.backResp, P('backDamp')); o.ox.target = 0; o.ox.v = v[0] * 0.1;
      o.oy.tune(D.backResp, P('backDamp')); o.oy.target = 0; o.oy.v = v[1] * 0.1;
      o.sc.tune(D.pressResp, P('pressDamp')).target = 1;
      o.ex.tune(0.3, P('jelly')).target = 0;
      o.ey.tune(0.3, P('jelly')).target = 0;
      kick(o);
    }
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
    // 拖着走了一段再松手 = 只是在玩弹簧，不触发点击
    el.addEventListener('click', function (e) {
      if (o.moved) { e.stopImmediatePropagation(); e.preventDefault(); o.moved = false; }
    }, true);
  }

  /* ---------- 标签滑块 ---------- */
  var G = null;
  function initTabs(tabsEl, glider, onPick) {
    G = { tabs: tabsEl, glider: glider, cx: new Spring(0), w: new Spring(0), sc: new Spring(1), st: new Spring(0, 0.24, 1), scrub: null, ready: false, lens: false };
    function setLens(on) {
      if (G.lens === on) return;
      G.lens = on;
      glider.classList.toggle('lens', on);       // 浮到文字上方
      glider.setAttribute('data-glass', on ? 'lens' : 'glider');
      if (window.Glass) Glass.refresh(glider);
    }
    G.step = function (dt) {
      var scrubbing = G.scrub && G.scrub.moved, flying = Math.abs(G.cx.v) > 60;
      var v = scrubbing ? G.scrub.vel.get()[0] : G.cx.v;
      G.sc.tune(0.32, level === 'full' ? 0.6 : 1).target = scrubbing ? P('lensScale') : flying ? P('flyScale') : 1;
      G.st.target = Math.min(Math.abs(v) * P('tabStretch') * 0.0004, D.tabMax);
      setLens(level === 'full' && (scrubbing || flying || G.sc.x > 1.08));
      G.cx.step(dt); G.w.step(dt); G.sc.step(dt); G.st.step(dt);
      // 主要横向拉长，高度只轻微收一点：被拿起来的滑块始终比底下的胶囊更高
      var sx = G.sc.x * (1 + G.st.x), sy = G.sc.x * (1 - G.st.x * 0.3), tx = G.cx.x - G.w.x / 2 - 4;
      glider.style.width = G.w.x.toFixed(1) + 'px';
      glider.style.transform = 'translateX(' + tx.toFixed(1) + 'px) scale(' + sx.toFixed(4) + ',' + sy.toFixed(4) + ')';
      glider._xf = { tx: tx, ty: 0, a: sx, b: 0, c: 0, d: sy };
      if (window.Glass) Glass.moved(glider);
      var rest = !G.scrub && settled(G.cx, 0.2) && settled(G.w, 0.2) && settled(G.sc, 0.0005) && settled(G.st, 0.0005);
      if (rest) setLens(false);
      return !rest;
    };
    function tabsList() { return Array.prototype.slice.call(tabsEl.querySelectorAll('.tab')); }
    function nearest(x) {
      var best = null, bd = 1e9;
      tabsList().forEach(function (t) { var d = Math.abs(t.offsetLeft + t.offsetWidth / 2 - x); if (d < bd) { bd = d; best = t; } });
      return best;
    }
    function localX(e) { return e.clientX - tabsEl.getBoundingClientRect().left; }
    tabsEl.addEventListener('pointerdown', function (e) {
      if (e.button !== 0) return;
      try { tabsEl.setPointerCapture(e.pointerId); } catch (err) {}
      var x = localX(e);
      G.scrub = { x0: x, off: x - G.cx.x, moved: false, vel: new Velocity() };
      G.scrub.vel.add(e.timeStamp, x, 0);
    });
    tabsEl.addEventListener('pointermove', function (e) {
      var s = G.scrub;
      if (!s) return;
      var x = localX(e);
      s.vel.add(e.timeStamp, x, 0);
      if (!s.moved && Math.abs(x - s.x0) > 6) s.moved = true;
      if (!s.moved) return;
      var ts = tabsList(), a = ts[0], b = ts[ts.length - 1];
      var lo = a.offsetLeft + a.offsetWidth / 2, hi = b.offsetLeft + b.offsetWidth / 2, want = x - s.off;
      // 拖出两端时同样是橡皮筋
      G.cx.jump(want < lo ? lo + rubber(want - lo, 18) : want > hi ? hi + rubber(want - hi, 18) : want);
      kick(G);
    });
    function up(e) {
      var s = G.scrub;
      if (!s) return;
      G.scrub = null;
      if (s.moved) G.cx.v = s.vel.get()[0] * 0.5;
      onPick(nearest(s.moved ? G.cx.x : localX(e)));
      kick(G);
    }
    tabsEl.addEventListener('pointerup', up);
    tabsEl.addEventListener('pointercancel', up);
  }

  function glideTo(tab, animate) {
    if (!G || !tab) return;
    var cx = tab.offsetLeft + tab.offsetWidth / 2, w = tab.offsetWidth;
    if (!animate || !G.ready || level === 'off') {
      G.cx.jump(cx); G.w.jump(w); G.sc.jump(1); G.st.jump(0); G.ready = true;
      G.step(0);
      return;
    }
    G.cx.tune(D.tabResp, P('tabDamp')).target = cx;
    G.w.tune(D.tabResp, Math.min(1, P('tabDamp') + 0.15)).target = w;
    kick(G);
  }

  /* ---------- 弹层下拉关闭 ---------- */
  function sheetDrag(sheet, handle, close) {
    var y = new Spring(0, 0.35, 0.8), s = null, leaving = false;
    var o = {
      step: function (dt) {
        if (leaving) return false;   // 交给关闭动画从当前位置滑下去
        y.step(dt);
        var rest = !s && settled(y, 0.3);
        sheet.style.transform = rest ? '' : 'translateY(' + y.x.toFixed(1) + 'px)';
        return !rest;
      }
    };
    handle.addEventListener('pointerdown', function (e) {
      if (e.button !== 0 || level === 'off' || e.target.closest('button,input,select,textarea')) return;
      try { handle.setPointerCapture(e.pointerId); } catch (err) {}
      leaving = false;
      s = { y0: e.clientY, vel: new Velocity() };
      s.vel.add(e.timeStamp, 0, e.clientY);
    });
    handle.addEventListener('pointermove', function (e) {
      if (!s) return;
      s.vel.add(e.timeStamp, 0, e.clientY);
      var dy = e.clientY - s.y0;
      y.jump(dy > 0 ? dy : rubber(dy, 30), s.vel.get()[1]);
      kick(o);
    });
    function up() {
      if (!s) return;
      var v = s.vel.get()[1]; s = null;
      if (y.x > 120 || v > 900) { leaving = true; y.jump(0); close(); return; }
      y.tune(0.35, 0.8).target = 0;
      kick(o);
    }
    handle.addEventListener('pointerup', up);
    handle.addEventListener('pointercancel', up);
  }

  return {
    pressable: pressable, initTabs: initTabs, glideTo: glideTo, sheetDrag: sheetDrag,
    setLevel: function (l) {
      level = l;
      document.body.classList.toggle('motion-on', l !== 'off');
    }
  };
})();
