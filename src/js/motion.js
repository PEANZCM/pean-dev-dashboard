// ============================================================
//  动效：一套弹簧管所有交互（参数来自 v1.1 原型定稿）
//  · 按压：放大 + 轻微跟手 + 朝手指方向拉伸，松手果冻回弹（拉长 → 压扁 → 回正，只弹一次）
//  · 标签滑块：弹簧飞行 + 按速度拉伸 + 移动中略微放大；可以按住左右拖
//  · 弹层：按住顶部往下拖，1:1 跟手，拖得够远或甩得够快就关掉，否则弹回
//  transform 只由这里写，CSS 不再给这些元素做 transform 过渡，避免两套动画抢
// ============================================================
var Motion = (function () {
  'use strict';

  var D = {
    pressScale: 1.06, pressResp: 0.26, pressDamp: 0.62, follow: 0.06,
    pressStretch: 0.6, pressMax: 0.1, jelly: 0.45,
    dragStretch: 0.45, dragMax: 0.12, lift: 1.12,
    tabResp: 0.42, tabDamp: 0.74
  };
  var level = 'full';                 // full | reduced | off
  var active = [], raf = 0, last = 0;

  function P(k) {
    if (level === 'reduced') {
      if (k === 'pressStretch' || k === 'dragStretch' || k === 'follow') return 0;
      if (k === 'pressScale') return 1.03;
      if (k === 'pressDamp' || k === 'jelly' || k === 'tabDamp') return 1;
      if (k === 'lift') return 1;
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

  // 缩放 × 沿 th 轴的体积守恒拉伸（st<0 = 沿该轴压扁）
  function matrix(sc, st, th) {
    var sx = 1 + Math.max(st, -0.3), sy = 1 / sx, c = Math.cos(th), n = Math.sin(th);
    return [sc * (c * c * sx + n * n * sy), sc * c * n * (sx - sy), sc * (n * n * sx + c * c * sy)];
  }

  /* ---------- 按压 ---------- */
  function pressable(el) {
    if (el._press) return;
    var o = el._press = {
      ox: new Spring(0), oy: new Spring(0), sc: new Spring(1), st: new Spring(0, 0.2, 0.85), ang: 0,
      rect: null, down: false,
      step: function (dt) {
        o.ox.step(dt); o.oy.step(dt); o.sc.step(dt); o.st.step(dt);
        var m = matrix(o.sc.x, o.st.x, o.ang);
        var rest = !o.down && settled(o.ox, 0.05) && settled(o.oy, 0.05) && settled(o.sc, 0.0005) && settled(o.st, 0.0005);
        el.style.transform = rest ? '' : 'translate(' + o.ox.x.toFixed(2) + 'px,' + o.oy.x.toFixed(2) + 'px) matrix(' +
          m[0].toFixed(4) + ',' + m[1].toFixed(4) + ',' + m[1].toFixed(4) + ',' + m[2].toFixed(4) + ',0,0)';
        return !rest;
      }
    };
    function track(e) {
      var r = o.rect, rx = e.clientX - (r.left + r.width / 2), ry = e.clientY - (r.top + r.height / 2);
      o.ox.tune(D.pressResp, 0.85).target = rx * P('follow');
      o.oy.tune(D.pressResp, 0.85).target = ry * P('follow');
      var nx = rx / (r.width / 2), ny = ry / (r.height / 2), d = Math.hypot(nx, ny);
      if (d > 0.08) o.ang = Math.atan2(ry, rx);
      o.st.tune(0.2, 0.85).target = Math.min(d * P('pressStretch') * 0.12, D.pressMax);
    }
    el.addEventListener('pointerdown', function (e) {
      if (level === 'off' || e.button !== 0 || el.disabled) return;
      o.down = true;
      el.style.transform = '';
      o.rect = el.getBoundingClientRect();
      o.sc.tune(D.pressResp, P('pressDamp')).target = P('pressScale');
      track(e);
      kick(o);
    });
    el.addEventListener('pointermove', function (e) { if (o.down) { track(e); kick(o); } });
    function up() {
      if (!o.down) return;
      o.down = false;
      o.sc.tune(D.pressResp, P('pressDamp')).target = 1;
      o.ox.tune(D.pressResp, P('pressDamp')).target = 0;
      o.oy.tune(D.pressResp, P('pressDamp')).target = 0;
      o.st.tune(0.32, P('jelly')).target = 0;
      kick(o);
    }
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
    el.addEventListener('pointerleave', up);
  }

  /* ---------- 标签滑块 ---------- */
  var G = null;
  function initTabs(tabsEl, glider, onPick) {
    G = { tabs: tabsEl, glider: glider, cx: new Spring(0), w: new Spring(0), sc: new Spring(1), scrub: null, ready: false };
    G.step = function (dt) {
      var moving = (G.scrub && G.scrub.moved) || Math.abs(G.cx.v) > 60;
      G.sc.tune(0.3, level === 'full' ? 0.7 : 1).target = moving && level === 'full' ? 1 + (D.lift - 1) * 1.2 : 1;
      G.cx.step(dt); G.w.step(dt); G.sc.step(dt);
      var st = level === 'full' ? Math.min(Math.abs(G.cx.v) * D.dragStretch * 0.0004, D.dragMax) : 0;
      glider.style.width = G.w.x.toFixed(1) + 'px';
      glider.style.transform = 'translateX(' + (G.cx.x - G.w.x / 2 - 4).toFixed(1) + 'px) scale(' +
        (G.sc.x * (1 + st)).toFixed(4) + ',' + (G.sc.x / (1 + st)).toFixed(4) + ')';
      return !(G.scrub || (settled(G.cx, 0.2) && settled(G.w, 0.2) && settled(G.sc, 0.0005)));
    };
    function tabsList() { return Array.prototype.slice.call(tabsEl.querySelectorAll('.tab')); }
    function nearest(x) {
      var best = null, bd = 1e9;
      tabsList().forEach(function (t) { var d = Math.abs(t.offsetLeft + t.offsetWidth / 2 - x); if (d < bd) { bd = d; best = t; } });
      return best;
    }
    tabsEl.addEventListener('pointerdown', function (e) {
      if (e.button !== 0) return;
      try { tabsEl.setPointerCapture(e.pointerId); } catch (err) {}
      var x = e.clientX - tabsEl.getBoundingClientRect().left;
      G.scrub = { x0: x, off: x - G.cx.x, moved: false, lastX: x, lastT: e.timeStamp, v: 0 };
    });
    tabsEl.addEventListener('pointermove', function (e) {
      var s = G.scrub;
      if (!s) return;
      var x = e.clientX - tabsEl.getBoundingClientRect().left;
      if (!s.moved && Math.abs(x - s.x0) > 6) s.moved = true;
      if (!s.moved) return;
      var dt = Math.max((e.timeStamp - s.lastT) / 1000, 0.001);
      s.v = s.v * 0.5 + (x - s.lastX) / dt * 0.5;
      s.lastX = x; s.lastT = e.timeStamp;
      var ts = tabsList(), a = ts[0], b = ts[ts.length - 1];
      G.cx.jump(Math.min(Math.max(x - s.off, a.offsetLeft + a.offsetWidth / 2), b.offsetLeft + b.offsetWidth / 2), s.v);
      kick(G);
    });
    function up(e) {
      var s = G.scrub;
      if (!s) return;
      G.scrub = null;
      var x = e.clientX - tabsEl.getBoundingClientRect().left;
      onPick(nearest(s.moved ? G.cx.x : x));
      kick(G);
    }
    tabsEl.addEventListener('pointerup', up);
    tabsEl.addEventListener('pointercancel', up);
  }

  function glideTo(tab, animate) {
    if (!G || !tab) return;
    var cx = tab.offsetLeft + tab.offsetWidth / 2, w = tab.offsetWidth;
    if (!animate || !G.ready || level === 'off') {
      G.cx.jump(cx); G.w.jump(w); G.sc.jump(1); G.ready = true;
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
      s = { y0: e.clientY, lastY: e.clientY, lastT: e.timeStamp, v: 0 };
    });
    handle.addEventListener('pointermove', function (e) {
      if (!s) return;
      var dy = e.clientY - s.y0;
      var dt = Math.max((e.timeStamp - s.lastT) / 1000, 0.001);
      s.v = s.v * 0.5 + (e.clientY - s.lastY) / dt * 0.5;
      s.lastY = e.clientY; s.lastT = e.timeStamp;
      y.jump(dy > 0 ? dy : dy * 0.2, s.v);       // 往上拖只有一点橡皮筋
      kick(o);
    });
    function up() {
      if (!s) return;
      var v = s.v; s = null;
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
