/* ============================================================
   AI 思考图标
   状态：思考（三条拖尾绕核逆时针转）
     → 完成：三条线汇聚成一条，逆时针走完整圈，再从左到右手写对勾（深绿），停留后变成待命
     → 取消：汇聚成圆环，横线写出来，进入待命
     → 失败：汇聚成一条，逆时针走到缺口处停下，成为断开的轨道（暗红），静止
     待命：圆环 + 横线，形状不动，只有颜色流转

   所有状态共用同一个圆环半径和同一个线宽。
   · 轨道线（3 条）：思考时各走各的；其他状态三条的目标完全相同，所以「一条线」真的是
     三条重合，汇聚和发散都不用拼接。重合后多余的两条会隐去
   · 记号线（1 条）：对勾或横线。先写出来，之后对勾和横线之间直接形变
   切换时把新旧位置和速度的差值记成偏移，再用弹簧把偏移衰减到 0，
   所以任何一帧都能切换、能被打断，位置和速度都连续
   ============================================================ */
(function (g) {
  'use strict';

  var STRANDS = 3, N = 64, CH = 7, TOTAL = STRANDS * N;
  var X = 0, Y = 1, R = 2, G = 3, B = 4, A = 5, W = 6;
  var SUB = 1 / 240, TAU = Math.PI * 2;
  var RING = 0.82;                         // 圆环半径（轨道的长轴也用它，所以汇聚时不会缩放）
  var START = -75 / 180 * Math.PI;         // 圆环从这里开始逆时针走，失败的缺口在它和终点之间
  var PAD = 0.5;                           // 画布每边比图标多出多少（占边长），光晕在里面淡完，碰不到画布的方形边界
  // 红黄绿蓝四个 iOS 系统色为主，首尾相接；其他颜色只在它们之间很窄的过渡带里出现
  var PALETTE = [[255, 59, 48], [255, 204, 0], [52, 199, 89], [0, 122, 255]];

  var P = {
    speed: 7,          // 平均转速（弧度 / 秒）
    pulse: 0.6,        // 快慢幅度：0 = 匀速，0.6 = 在 0.4 到 1.6 倍之间起伏
    pulsePeriod: 1.6,  // 一快一慢的周期（秒）
    trail: 4.5,        // 拖尾长度（弧度）
    orbitB: 0.2,       // 轨道扁度
    kepler: 0.6,       // 轨道速度变化：越大，近核处越快
    lineWidth: 0.05,   // 线宽（占图标边长），所有状态统一
    glow: 2,           // 发光强度
    response: 0.64,    // 发散 / 形变速度（秒）
    mergeResponse: 0.3,// 汇聚成圆的速度（秒）
    mergeCarry: 0.3,   // 汇聚时保留多少原来的速度，太大会先甩出去再回来
    damping: 0.86,     // 阻尼，1 = 不过冲
    stagger: 1.6,      // 发散时拖尾比头部慢多少
    mergeStagger: 0.4, // 汇聚时拖尾比头部慢多少
    flow: 0.16,        // 待命时颜色流转速度（圈 / 秒）
    blend: 0.2,        // 思考时主色之间过渡带的宽度
    softBlend: 0.8,    // 待命时主色之间过渡带的宽度
    gap: 0.13,         // 断开的轨道缺多少（占整圈）
    sweepMs: 620,      // 逆时针走圈的时长
    writeMs: 420,      // 手写对勾的时长
    minThink: 600,     // 最短思考时长（毫秒），防止秒回时一闪而过
    holdDone: 1400,    // 对勾写完后停留多久再回到待命（毫秒）
    green: '#248A3D',
    red: '#D34A4A'
  };

  function hex(c) { var n = parseInt(c.slice(1), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; }
  function rainbow(u, band) {
    band = band || P.blend;
    u -= Math.floor(u);
    var p = u * PALETTE.length, i = Math.floor(p), f = p - i, a = PALETTE[i], b = PALETTE[(i + 1) % PALETTE.length];
    // 每段大部分是纯色，只在末尾的过渡带里换到下一个主色
    f = Math.max(0, (f - (1 - band)) / band);
    f = f * f * (3 - 2 * f);
    // 按亮度而不是数值混合，两色中间不会发灰发脏
    return [lit(a[0], b[0], f), lit(a[1], b[1], f), lit(a[2], b[2], f)];
  }
  function lit(a, b, f) { return Math.sqrt(a * a * (1 - f) + b * b * f); }
  // 待命配色：一圈正好走完四个主色，每种颜色只出现一次，并逆时针缓慢转动
  function ringColor(ang, t) { return rainbow(ang / TAU + t * P.flow, P.softBlend); }
  // 横线取圆环上半圈的颜色，两端和旁边的圆环同色
  function lineColor(x, t) { return rainbow(t * P.flow + 0.25 * (1 - x / 0.44), P.softBlend); }

  /* ---------- 记号线：按弧长均匀取点，从左到右 ---------- */
  function resample(raw, count) {
    var len = [0], i;
    for (i = 1; i < raw.length; i++) len.push(len[i - 1] + Math.hypot(raw[i][0] - raw[i - 1][0], raw[i][1] - raw[i - 1][1]));
    var total = len[len.length - 1], out = [], j = 0;
    for (i = 0; i < count; i++) {
      var d = total * i / (count - 1);
      while (j < raw.length - 2 && len[j + 1] < d) j++;
      var f = (d - len[j]) / Math.max(len[j + 1] - len[j], 1e-6);
      out.push([raw[j][0] + (raw[j + 1][0] - raw[j][0]) * f, raw[j][1] + (raw[j + 1][1] - raw[j][1]) * f]);
    }
    return out;
  }
  function checkPath() {
    var a = [-0.4, 0.03], m = [-0.1, 0.33], b = [0.43, -0.3], k = 0.09, raw = [a];
    var u = Math.hypot(m[0] - a[0], m[1] - a[1]), v = Math.hypot(b[0] - m[0], b[1] - m[1]);
    var p = [m[0] + (a[0] - m[0]) * k / u, m[1] + (a[1] - m[1]) * k / u], q = [m[0] + (b[0] - m[0]) * k / v, m[1] + (b[1] - m[1]) * k / v];
    for (var i = 0; i <= 16; i++) {
      var t = i / 16, s = 1 - t;
      raw.push([s * s * p[0] + 2 * s * t * m[0] + t * t * q[0], s * s * p[1] + 2 * s * t * m[1] + t * t * q[1]]);
    }
    raw.push(b);
    return resample(raw, N);
  }
  var MARKS = { done: checkPath(), standby: resample([[-0.44, 0], [0.44, 0]], N) };

  /* ---------- 补间：走圈和手写是「过程」，用时长固定的曲线 ---------- */
  function outCubic(x) { return 1 - Math.pow(1 - x, 3); }
  function inOutCubic(x) { return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; }
  function Tween(v) { this.v = this.from = this.to = v; this.t = 0; this.dur = 0; this.delay = 0; this.ease = outCubic; }
  Tween.prototype.go = function (to, dur, delay, ease) {
    this.from = this.v; this.to = to; this.t = 0; this.dur = dur; this.delay = delay || 0; this.ease = ease || outCubic;
  };
  Tween.prototype.step = function (ms) {
    if (this.v === this.to) return;
    this.t += ms;
    var x = Math.min(1, Math.max(0, (this.t - this.delay) / Math.max(this.dur, 1)));
    this.v = x >= 1 ? this.to : this.from + (this.to - this.from) * this.ease(x);
  };

  function Orb(canvas, opt) {
    opt = opt || {};
    this.c = canvas;
    this.ctx = canvas.getContext('2d');
    this.core = document.createElement('canvas');
    this.cctx = this.core.getContext('2d');
    this.size = opt.size || 96;
    this.dark = opt.dark !== false;
    var dpr = this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    var full = this.size * (1 + PAD * 2);
    canvas.width = canvas.height = this.core.width = this.core.height = Math.round(full * dpr);
    // 画布比图标大，用负外边距收回去，排版上它仍然只占 size × size
    canvas.style.width = canvas.style.height = full + 'px';
    canvas.style.margin = -this.size * PAD + 'px';
    canvas.style.pointerEvents = 'none';
    // 边缘羽化：不管光晕开多大，到画布边界时一定已经透明，看不到方形
    var half = canvas.width / 2;
    this.fade = this.ctx.createRadialGradient(half, half, half * 0.72, half, half, half);
    this.fade.addColorStop(0, 'rgba(0,0,0,1)');
    this.fade.addColorStop(1, 'rgba(0,0,0,0)');
    this.t = 0;
    this.state = 'standby';
    this.thinkAt = 0;
    this.timer = 0;
    this.off = new Float32Array(TOTAL * CH);     // 轨道线：偏移
    this.vel = new Float32Array(TOTAL * CH);     // 轨道线：偏移的速度
    this.tgt = new Float32Array(TOTAL * CH);
    this.snap = new Float32Array(TOTAL * CH);    // 发散开始时的形状
    this.mix = new Float32Array(TOTAL);          // 每个点还剩多少留在 snap 上
    this.mixV = new Float32Array(TOTAL);
    this.blending = false;
    this.out = new Float32Array(TOTAL * CH);     // 这一帧实际画的
    this.sweep = new Tween(1);                   // 圆环走到了整圈的几分之几
    this.write = new Tween(1);                   // 记号线写到了几分之几
    this.mark = 'standby';
    this.mOff = new Float32Array(N * 5);         // 记号线：偏移（位置 + 颜色）
    this.mVel = new Float32Array(N * 5);
    this.mOut = new Float32Array(N * 5);
    this.glow = this.glowTarget(); this.glowV = 0;
    this.raf = 0; this.last = 0; this.drawn = 0; this.frames = 0;
    this.frame = this.frame.bind(this);
    this.evalOrbit(this.state, this.t, this.out);
    this.evalMark(this.t, this.mOut);
    this.draw();
    this.wake();
  }

  Orb.prototype.glowTarget = function () { return { thinking: 1, standby: 0.4, done: 0.3, fail: 0.3 }[this.state]; };

  // 深色背景上同一个深色看不清，提亮一档
  Orb.prototype.tone = function (c) {
    var v = hex(c), m = this.dark ? 1.35 : 1;
    return [Math.min(255, v[0] * m), Math.min(255, v[1] * m), Math.min(255, v[2] * m)];
  };
  Orb.prototype.solid = function (state) { return state === 'done' ? this.tone(P.green) : state === 'fail' ? this.tone(P.red) : null; };

  // 轨道线在时刻 t 的目标
  Orb.prototype.evalOrbit = function (state, t, a) {
    var s, k, o = 0;
    if (state === 'thinking') {
      // 对周期起伏的转速积分：转角连续，一段快一段慢
      var w = P.speed * (t + P.pulse * P.pulsePeriod / TAU * Math.sin(TAU * t / P.pulsePeriod));
      for (s = 0; s < STRANDS; s++) {
        var tilt = (s / STRANDS) * Math.PI + 0.35 - t * 0.12, ct = Math.cos(tilt), st = Math.sin(tilt);
        for (k = 0; k < N; k++, o += CH) {
          var u = k / (N - 1), th = -w + s * 2.09 + u * P.trail;
          var ph = th + P.kepler * Math.sin(th);
          var ex = RING * Math.cos(ph), ey = P.orbitB * Math.sin(ph), depth = (Math.sin(ph) + 1) / 2;
          var c = rainbow(s / STRANDS + u * 0.42 - t * 0.14);
          a[o + X] = ex * ct - ey * st;
          a[o + Y] = ex * st + ey * ct;
          a[o + R] = c[0]; a[o + G] = c[1]; a[o + B] = c[2];
          a[o + A] = Math.pow(1 - u, 1.15) * (0.55 + 0.45 * depth);
          a[o + W] = 0.4 + 0.6 * (1 - u);
        }
      }
      return;
    }
    // 其他状态：三条线的目标完全相同，都是同一段圆弧，头部在最前面逆时针走
    var solid = this.solid(state), arc = this.sweep.v * TAU;
    for (s = 0; s < STRANDS; s++) {
      for (k = 0; k < N; k++, o += CH) {
        var f = 1 - k / (N - 1), ang = START - arc * f;
        var x = RING * Math.cos(ang), y = RING * Math.sin(ang), col = solid || ringColor(ang, t);
        a[o + X] = x; a[o + Y] = y;
        a[o + R] = col[0]; a[o + G] = col[1]; a[o + B] = col[2];
        a[o + A] = 1; a[o + W] = 1;
      }
    }
  };

  // 记号线的目标：思考和失败时保持上一个形状，由 write 收回
  Orb.prototype.evalMark = function (t, a) {
    var pts = MARKS[this.mark], solid = this.solid(this.state === 'done' ? 'done' : this.state === 'fail' ? 'fail' : '');
    for (var k = 0, o = 0; k < N; k++, o += 5) {
      var p = pts[k], c = solid || lineColor(p[0], t);
      a[o] = p[0]; a[o + 1] = p[1]; a[o + 2] = c[0]; a[o + 3] = c[1]; a[o + 4] = c[2];
    }
  };

  // 切换的核心：记下「当前实际位置和速度」与新目标的差，之后弹簧把差值消掉
  Orb.prototype.go = function (state) {
    var h = 1 / 120, size = this.out.length, a0 = new Float32Array(size), a1 = new Float32Array(size), b0 = new Float32Array(size), b1 = new Float32Array(size), i;
    var prev = this.state, oldMark = new Float32Array(this.mOut);
    this.evalOrbit(prev, this.t, a0);
    this.evalOrbit(prev, this.t + h, a1);

    var visible = this.write.v > 0.02;
    this.state = state;
    if (state === 'thinking') {
      this.write.go(0, 240, 0, inOutCubic);
    } else {
      // 从思考过来：先汇聚成靠近起点的一小段，再逆时针走开；已经是圆环就只调整到新长度
      var from = prev === 'thinking';
      if (from) { this.sweep.v = this.sweep.from = 0.12; }
      this.sweep.go(state === 'fail' ? 1 - P.gap : 1, P.sweepMs, from ? 120 : 0, outCubic);
      if (state === 'fail') {
        this.write.go(0, 240, 0, inOutCubic);
      } else {
        this.mark = state;
        if (visible) this.write.go(1, 200, 0, inOutCubic);
        else {
          this.write.v = this.write.from = 0;
          // 对勾和横线都等圆环走到一大半才开始写
          this.write.go(1, P.writeMs, from ? P.sweepMs * 0.72 : 0, inOutCubic);
        }
      }
    }
    this.evalOrbit(state, this.t, b0);
    this.evalOrbit(state, this.t + h, b1);
    for (i = 0; i < size; i++) {
      var oldV = (a1[i] - a0[i]) / h + this.vel[i], newV = (b1[i] - b0[i]) / h;
      this.vel[i] = (oldV - newV) * P.mergeCarry;
      this.off[i] = this.out[i] - b0[i];
    }
    // 发散的目标转得很快，偏移叠上去会把线甩到圆外，所以改成从当前形状混合到轨道：永远不会超出圆
    this.blending = state === 'thinking';
    if (this.blending) {
      this.snap.set(this.out);
      this.mix.fill(1); this.mixV.fill(0);
      this.off.fill(0); this.vel.fill(0);
    }
    // 记号线：可见时形变；还没写出来时直接换形状，不飞行
    this.evalMark(this.t, this.mOut);
    for (i = 0; i < this.mOut.length; i++) {
      this.mOff[i] = visible ? oldMark[i] - this.mOut[i] : 0;
      if (!visible) this.mVel[i] = 0;
    }
    this.wake();
  };

  /* 外部接口：think() 开始思考；finish('done' | 'cancel' | 'fail') 结束 */
  Orb.prototype.think = function () {
    clearTimeout(this.timer);
    this.thinkAt = performance.now();
    if (this.state !== 'thinking') this.go('thinking');
  };
  Orb.prototype.finish = function (how) {
    var self = this, wait = this.state === 'thinking' ? Math.max(0, P.minThink - (performance.now() - this.thinkAt)) : 0;
    clearTimeout(this.timer);
    this.timer = setTimeout(function () {
      if (how === 'fail') return self.go('fail');
      if (how === 'cancel') return self.go('standby');
      self.go('done');
      self.timer = setTimeout(function () { self.go('standby'); }, P.sweepMs * 0.72 + P.writeMs + P.holdDone);
    }, wait);
  };

  Orb.prototype.wake = function () {
    if (!this.raf) { this.last = 0; this.raf = requestAnimationFrame(this.frame); }
  };

  function decay(off, vel, i, k, c, n, h) {
    var x = off[i], v = vel[i];
    for (var q = 0; q < n; q++) { v += (-k * x - c * v) * h; x += v * h; }
    off[i] = x; vel[i] = v;
    return x;
  }

  Orb.prototype.stepSprings = function (dt) {
    var n = Math.max(1, Math.ceil(dt / SUB)), h = dt / n, rest = true, i, ch, x;
    for (var p = 0; p < TOTAL; p++) {
      // 三条线错开一点到达：汇聚时一条接一条并进去，发散时一条接一条分开
      var u = (p % N) / (N - 1), strand = Math.floor(p / N), merging = this.state !== 'thinking';
      var w = merging ? TAU / (P.mergeResponse * (1 + P.mergeStagger * u) * (1 + 0.08 * strand)) : TAU / (P.response * (1 + P.stagger * u) * (1 + 0.18 * strand));
      var k = w * w, c = 2 * P.damping * w;
      if (this.blending && Math.abs(decay(this.mix, this.mixV, p, k, c, n, h)) > 0.002) rest = false;
      for (ch = 0; ch < CH; ch++) {
        x = decay(this.off, this.vel, p * CH + ch, k, c, n, h);
        if (rest && Math.abs(x) > (ch >= R && ch <= B ? 0.6 : 0.002)) rest = false;
      }
    }
    var mw = TAU / P.response, mk = mw * mw, mc = 2 * P.damping * mw;
    for (i = 0; i < this.mOff.length; i++) {
      x = decay(this.mOff, this.mVel, i, mk, mc, n, h);
      if (rest && Math.abs(x) > (i % 5 >= 2 ? 0.6 : 0.002)) rest = false;
    }
    return rest;
  };

  Orb.prototype.frame = function (now) {
    this.raf = 0;
    var dt = this.last ? Math.min((now - this.last) / 1000, 1 / 20) : 1 / 60, i;
    this.last = now;
    this.t += dt;
    this.sweep.step(dt * 1000);
    this.write.step(dt * 1000);
    var rest = this.stepSprings(dt) && this.sweep.v === this.sweep.to && this.write.v === this.write.to;
    var gw = TAU / 0.5, gt = this.glowTarget();
    this.glowV += (-(gw * gw) * (this.glow - gt) - 2 * gw * this.glowV) * dt;
    this.glow += this.glowV * dt;
    if (Math.abs(this.glow - gt) > 0.005) rest = false;
    this.evalOrbit(this.state, this.t, this.tgt);
    if (this.blending) {
      for (i = 0; i < this.out.length; i++) this.out[i] = this.tgt[i] + this.mix[i / CH | 0] * (this.snap[i] - this.tgt[i]);
    } else {
      for (i = 0; i < this.out.length; i++) this.out[i] = this.tgt[i] + this.off[i];
    }
    this.evalMark(this.t, this.mOut);
    for (i = 0; i < this.mOut.length; i++) this.mOut[i] += this.mOff[i];

    // 待命只有颜色在走，30 帧足够；对勾和断开的轨道停稳后完全不再绘制
    var quiet = rest && this.state === 'standby';
    if (!quiet || now - this.drawn >= 33) { this.draw(); this.drawn = now; this.frames++; }
    if (rest && (this.state === 'done' || this.state === 'fail')) return;
    this.raf = requestAnimationFrame(this.frame);
  };

  Orb.prototype.draw = function () {
    var ctx = this.ctx, cc = this.cctx, S = this.c.width, half = S / 2, scale = this.size * this.dpr / 2 * 0.92, a = this.out, ch = this;
    var lw = Math.max(1.5, this.size * P.lineWidth) * this.dpr, merged = this.state !== 'thinking';
    function pen(r, gg, b, al, wd) {
      // 半透明段用平头，否则相邻段的圆头叠在一起会出现一串亮点
      cc.lineCap = al > 0.97 ? 'round' : 'butt';
      cc.lineJoin = 'round';
      cc.lineWidth = lw * Math.max(0.05, wd);
      cc.strokeStyle = 'rgba(' + clamp(r) + ',' + clamp(gg) + ',' + clamp(b) + ',' + al.toFixed(3) + ')';
      cc.beginPath();
    }
    function px(v) { return half + v * scale; }
    cc.clearRect(0, 0, S, S);
    for (var s = 0; s < STRANDS; s++) {
      var o = s * N * CH;
      // 颜色、透明度、粗细相近的连续点合成一笔：路径连续，半透明时不会露出一排小缺口，
      // 纯色的圆环只需要一笔。每笔在两点中间接上一笔
      var key = -1;
      for (var k = 0; k < N; k++) {
        var p = o + k * CH, al = Math.min(1, Math.max(0, a[p + A]));
        // 已经和第一条重合的部分不再画：重合就是一条线，不叠出更粗的边
        var hide = al < 0.004 || (merged && s && Math.hypot(a[p + X] - a[k * CH + X], a[p + Y] - a[k * CH + Y]) < 0.008);
        var next = hide ? -1 : (clamp(a[p + R]) >> 4) * 16777216 + (clamp(a[p + G]) >> 4) * 65536 + (clamp(a[p + B]) >> 4) * 4096 + Math.round(al * 16) * 32 + Math.round(a[p + W] * 12);
        if (next !== key) {
          var mx = k ? (a[p - CH + X] + a[p + X]) / 2 : a[p + X], my = k ? (a[p - CH + Y] + a[p + Y]) / 2 : a[p + Y];
          if (key !== -1) { cc.lineTo(px(mx), px(my)); cc.stroke(); }
          key = next;
          if (!hide) { pen(a[p + R], a[p + G], a[p + B], al, a[p + W]); cc.moveTo(px(mx), px(my)); }
        }
        if (!hide) cc.lineTo(px(a[p + X]), px(a[p + Y]));
      }
      if (key !== -1) cc.stroke();
      // 半透明的线是平头，头部补半个圆，和拖尾连成圆头
      var h1 = o + CH, ha = Math.min(1, Math.max(0, a[o + A]));
      if (ha > 0.004 && ha <= 0.97 && !(merged && s && Math.hypot(a[o + X] - a[X], a[o + Y] - a[Y]) < 0.008)) {
        var dir = Math.atan2(a[o + Y] - a[h1 + Y], a[o + X] - a[h1 + X]);
        cc.fillStyle = 'rgba(' + clamp(a[o + R]) + ',' + clamp(a[o + G]) + ',' + clamp(a[o + B]) + ',' + ha.toFixed(3) + ')';
        cc.beginPath();
        cc.arc(px(a[o + X]), px(a[o + Y]), lw * Math.max(0.05, a[o + W]) / 2, dir - Math.PI / 2, dir + Math.PI / 2);
        cc.fill();
      }
    }
    // 记号线：只画到 write 写到的位置，末端落在两点之间，写起来才连续
    var m = ch.mOut, end = this.write.v * (N - 1);
    for (var j = 0; j < N - 1 && j < end; j++) {
      var f = Math.min(1, end - j), i0 = j * 5, i1 = i0 + 5;
      pen(m[i0 + 2], m[i0 + 3], m[i0 + 4], 1, 1);
      cc.moveTo(px(m[i0]), px(m[i0 + 1]));
      cc.lineTo(px(m[i0] + (m[i1] - m[i0]) * f), px(m[i0 + 1] + (m[i1 + 1] - m[i0 + 1]) * f));
      cc.stroke();
    }
    ctx.clearRect(0, 0, S, S);
    var amt = Math.max(0, this.glow) * P.glow;
    if (amt > 0.01) {
      ctx.save();
      ctx.globalCompositeOperation = this.dark ? 'lighter' : 'source-over';
      ctx.filter = 'blur(' + (lw * 2.6).toFixed(1) + 'px)';
      ctx.globalAlpha = Math.min(1, amt * (this.dark ? 0.9 : 0.55));
      ctx.drawImage(this.core, 0, 0);
      ctx.filter = 'blur(' + (lw * 0.9).toFixed(1) + 'px)';
      ctx.globalAlpha = Math.min(1, amt * (this.dark ? 0.8 : 0.4));
      ctx.drawImage(this.core, 0, 0);
      ctx.restore();
    }
    ctx.drawImage(this.core, 0, 0);
    ctx.globalCompositeOperation = 'destination-in';
    ctx.fillStyle = this.fade;
    ctx.fillRect(0, 0, S, S);
    ctx.globalCompositeOperation = 'source-over';
  };

  function clamp(v) { return v < 0 ? 0 : v > 255 ? 255 : v | 0; }

  Orb.P = P;
  g.Orb = Orb;
})(window);
