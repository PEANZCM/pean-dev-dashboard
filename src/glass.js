/* ============================================================
   液态玻璃引擎 v4 —— 在 liquid-glass-react 位移方案基础上重做质感
   ------------------------------------------------------------
   分级策略（性能关键）：
   · shell（顶栏/卡片/弹窗）：只用 backdrop-filter + 自绘高光，
     不做 feDisplacementMap（大面积 SVG 滤镜是 CPU 灾难）
   · btn（按钮）：SVG feDisplacementMap 真折射，位移随尺寸缩放，
     backdrop 只在按压时降到 0 模糊，让折射清晰可见
   质感来自：低不透明度底色 + 多层内阴影厚度 + 方向性高光环
             + 冷暖错位色散 + 边缘折光
   动画：真正的欠阻尼弹簧（过冲 25%+ 的 Q 弹），拖动为「手托重物」
          —— 目标跟手、位置弹簧追、速度驱动拉伸倾斜
   标签：滑块弹簧飞行 + 速度体积补偿拉伸 + 目标 tab 缩放脉冲
   ============================================================ */
(function () {
  'use strict';

  var REDUCED = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  var SVG_NS = 'http://www.w3.org/2000/svg';

  /* ------------------------------------------------------------
     1. 位移场（照抄 ShaderDisplacementGenerator 的 fragment 逻辑）
     ------------------------------------------------------------ */
  function clamp01(t) { return t < 0 ? 0 : t > 1 ? 1 : t; }
  function smoothStep(a, b, t) {
    t = clamp01((t - a) / (b - a));
    return t * t * (3 - 2 * t);
  }
  function roundedRectSDF(x, y, w, h, r) {
    var qx = Math.abs(x) - w + r;
    var qy = Math.abs(y) - h + r;
    return Math.min(Math.max(qx, qy), 0) + Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) - r;
  }
  function glassFrag(ux, uy) {
    var ix = ux - 0.5, iy = uy - 0.5;
    var d = roundedRectSDF(ix, iy, 0.3, 0.2, 0.6);
    var displacement = smoothStep(0.8, 0, d - 0.15);
    var scaled = smoothStep(0, 1, displacement);
    return { x: ix * scaled + 0.5, y: iy * scaled + 0.5 };
  }

  var MAP_MAX = 320, MAP_BUCKET = 24;
  var mapCache = {};
  function bucketPx(v) { return Math.max(8, Math.round(v / MAP_BUCKET) * MAP_BUCKET); }

  function displacementMap(w, h) {
    var key = w + 'x' + h;
    if (mapCache[key]) return mapCache[key];
    var canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    var ctx = canvas.getContext('2d');
    var raw = new Float32Array(w * h * 2);
    var maxScale = 0, i = 0, x, y;
    for (y = 0; y < h; y++) {
      for (x = 0; x < w; x++) {
        var p = glassFrag(x / w, y / h);
        var dx = p.x * w - x, dy = p.y * h - y;
        if (Math.abs(dx) > maxScale) maxScale = Math.abs(dx);
        if (Math.abs(dy) > maxScale) maxScale = Math.abs(dy);
        raw[i++] = dx; raw[i++] = dy;
      }
    }
    if (maxScale < 0.001) maxScale = 1;
    var img = ctx.createImageData(w, h);
    var data = img.data, n = 0;
    for (y = 0; y < h; y++) {
      for (x = 0; x < w; x++) {
        var sdx = raw[n++], sdy = raw[n++];
        var edgeFactor = Math.min(1, Math.min(x, y, w - x - 1, h - y - 1) / 2);
        var o = (y * w + x) * 4;
        data[o] = (sdx * edgeFactor / maxScale + 0.5) * 255;
        data[o + 1] = (sdy * edgeFactor / maxScale + 0.5) * 255;
        data[o + 2] = data[o + 1];
        data[o + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    var url = canvas.toDataURL();
    mapCache[key] = url;
    return url;
  }

  /* ------------------------------------------------------------
     2. 滤镜链（照抄 GlassFilter，shader 模式 scale 为正）
     ------------------------------------------------------------ */
  var svgDefs = null, fseq = 0, filterCache = {};

  function ensureDefs() {
    if (svgDefs) return;
    var svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('aria-hidden', 'true');
    svg.style.cssText = 'position:absolute;width:0;height:0;pointer-events:none;';
    svgDefs = document.createElementNS(SVG_NS, 'defs');
    svg.appendChild(svgDefs);
    document.body.appendChild(svg);
  }

  function filterFor(bw, bh, ds) {
    var key = bw + 'x' + bh + '@' + Math.round(ds);
    if (filterCache[key]) return filterCache[key];
    ensureDefs();
    var id = 'lgf' + (++fseq);
    var ab = 2;
    var s1 = ds, s2 = ds * (1 - ab * 0.05), s3 = ds * (1 - ab * 0.1);
    var blur = Math.max(0.1, 0.5 - ab * 0.1);
    var map = displacementMap(bw, bh);
    var f = document.createElementNS(SVG_NS, 'filter');
    f.setAttribute('id', id);
    f.setAttribute('x', '-30%'); f.setAttribute('y', '-30%');
    f.setAttribute('width', '160%'); f.setAttribute('height', '160%');
    f.setAttribute('color-interpolation-filters', 'sRGB');
    f.innerHTML =
      '<feImage x="0" y="0" width="100%" height="100%" result="DISPLACEMENT_MAP" href="' + map + '" preserveAspectRatio="none"/>' +
      '<feColorMatrix in="DISPLACEMENT_MAP" type="matrix" values="0.3 0.3 0.3 0 0  0.3 0.3 0.3 0 0  0.3 0.3 0.3 0 0  0 0 0 1 0" result="EDGE_INTENSITY"/>' +
      '<feComponentTransfer in="EDGE_INTENSITY" result="EDGE_MASK"><feFuncA type="discrete" tableValues="0 ' + (ab * 0.05) + ' 1"/></feComponentTransfer>' +
      '<feOffset in="SourceGraphic" dx="0" dy="0" result="CENTER_ORIGINAL"/>' +
      '<feDisplacementMap in="SourceGraphic" in2="DISPLACEMENT_MAP" scale="' + s1.toFixed(2) + '" xChannelSelector="R" yChannelSelector="B" result="RED_DISPLACED"/>' +
      '<feColorMatrix in="RED_DISPLACED" type="matrix" values="1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0" result="RED_CHANNEL"/>' +
      '<feDisplacementMap in="SourceGraphic" in2="DISPLACEMENT_MAP" scale="' + s2.toFixed(2) + '" xChannelSelector="R" yChannelSelector="B" result="GREEN_DISPLACED"/>' +
      '<feColorMatrix in="GREEN_DISPLACED" type="matrix" values="0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0" result="GREEN_CHANNEL"/>' +
      '<feDisplacementMap in="SourceGraphic" in2="DISPLACEMENT_MAP" scale="' + s3.toFixed(2) + '" xChannelSelector="R" yChannelSelector="B" result="BLUE_DISPLACED"/>' +
      '<feColorMatrix in="BLUE_DISPLACED" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0" result="BLUE_CHANNEL"/>' +
      '<feBlend in="GREEN_CHANNEL" in2="BLUE_CHANNEL" mode="screen" result="GB_COMBINED"/>' +
      '<feBlend in="RED_CHANNEL" in2="GB_COMBINED" mode="screen" result="RGB_COMBINED"/>' +
      '<feGaussianBlur in="RGB_COMBINED" stdDeviation="' + blur.toFixed(2) + '" result="ABERRATED_BLURRED"/>' +
      '<feComposite in="ABERRATED_BLURRED" in2="EDGE_MASK" operator="in" result="EDGE_ABERRATION"/>' +
      '<feComponentTransfer in="EDGE_MASK" result="INVERTED_MASK"><feFuncA type="table" tableValues="1 0"/></feComponentTransfer>' +
      '<feComposite in="CENTER_ORIGINAL" in2="INVERTED_MASK" operator="in" result="CENTER_CLEAN"/>' +
      '<feComposite in="EDGE_ABERRATION" in2="CENTER_CLEAN" operator="over"/>';
    svgDefs.appendChild(f);
    filterCache[key] = id;
    return id;
  }

  /* ------------------------------------------------------------
     3. 注册表
     kind: shell = 大容器（无位移滤镜）| btn = 可交互玻璃
     ------------------------------------------------------------ */
  var SEL = [
    ['.topbar',                 { kind: 'shell', bar: true }],
    ['.hero',                   { kind: 'shell' }],
    ['.roadmap',                { kind: 'shell' }],
    ['.calendar-card',          { kind: 'shell' }],
    ['.day-detail',             { kind: 'shell' }],
    ['.heatmap-card',           { kind: 'shell' }],
    ['.time-plan',              { kind: 'shell' }],
    ['.quote-card',             { kind: 'shell' }],
    ['.modal-content',          { kind: 'shell' }],

    ['#settingsBtn',            { kind: 'btn', drag: true, elastic: true }],
    ['#checkinBtn',             { kind: 'btn', tint: 'checkin', elastic: true }],
    ['.medal-wall-btn',         { kind: 'btn', tint: 'accent', elastic: true }],
    ['.modal-btn.primary',      { kind: 'btn', tint: 'accentDeep', elastic: true }],
    ['.checkin-sub-btn',        { kind: 'btn' }],
    ['.edit-btn',               { kind: 'btn', tint: 'accent' }],
    ['.cal-nav-btn',            { kind: 'btn' }],
    ['.cal-today-btn',          { kind: 'btn', tint: 'accent' }],
    ['.quote-btn',              { kind: 'btn' }],
    ['.back-btn',               { kind: 'btn', tint: 'accent' }],
    ['.upload-btn',             { kind: 'btn', tint: 'accent' }],
    ['.mood-btn',               { kind: 'btn' }],
    ['.diary-mode-btn',         { kind: 'btn' }],
    ['.modal-btn',              { kind: 'btn' }],
    ['.settings-action-btn',    { kind: 'btn' }],
    ['.settings-close',         { kind: 'btn' }],
    ['.icon-btn-sm',            { kind: 'btn' }],
    ['.task-edit-del-btn',      { kind: 'btn', tint: 'danger' }],
    ['.task-edit-add-btn',      { kind: 'btn', tint: 'accent' }]
  ];

  var TINTS = {
    bar:        { l: 'rgba(255,255,255,0.34)', d: 'rgba(14,16,23,0.50)' },
    card:       { l: 'rgba(255,255,255,0.24)', d: 'rgba(18,21,30,0.36)' },
    modal:      { l: 'rgba(255,255,255,0.44)', d: 'rgba(18,21,30,0.54)' },
    btn:        { l: 'rgba(255,255,255,0.10)', d: 'rgba(255,255,255,0.05)' },
    accent:     { l: 'rgba(10,108,255,0.08)',  d: 'rgba(10,108,255,0.16)' },
    /* 品牌色必须半透明：按钮靠 backdrop-filter 折射背后真实内容，
       底色太实就把折射全盖住了（0.55~0.75 是"有色玻璃"的甜区） */
    accentDeep: { l: 'linear-gradient(180deg,rgba(104,172,255,.78) 0%,rgba(26,120,255,.84) 50%,rgba(6,86,214,.90) 100%)',
                  d: 'linear-gradient(180deg,rgba(96,164,255,.52) 0%,rgba(20,100,235,.60) 55%,rgba(6,70,190,.66) 100%)' },
    danger:     { l: 'rgba(255,59,48,0.06)',   d: 'rgba(255,59,48,0.12)' },
    checkin:    { l: 'linear-gradient(180deg,rgba(112,180,255,.80) 0%,rgba(26,120,255,.86) 48%,rgba(6,86,214,.92) 100%)',
                  d: 'linear-gradient(180deg,rgba(100,166,255,.52) 0%,rgba(20,100,235,.60) 55%,rgba(6,70,190,.66) 100%)' },
    checkinDone:{ l: 'linear-gradient(180deg,rgba(72,214,144,.80) 0%,rgba(22,179,100,.86) 50%,rgba(10,138,74,.92) 100%)',
                  d: 'linear-gradient(180deg,rgba(48,190,120,.52) 0%,rgba(16,150,86,.60) 55%,rgba(10,110,64,.66) 100%)' }
  };

  var shapes = [], shapesByEl = new Map(), btnShapes = [];
  var hoverShape = null;
  var mouse = { x: 0, y: 0, on: false };

  function isDark() { return document.body.classList.contains('dark'); }

  function tintOf(s) {
    var key = s.opt.tint || s.opt.kind;
    if (key === 'checkin' && s.el.classList.contains('done')) key = 'checkinDone';
    var t = TINTS[key] || TINTS.btn;
    return isDark() ? t.d : t.l;
  }

  function makeSpan(cls) {
    var sp = document.createElement('span');
    sp.className = cls;
    return sp;
  }

  function makeShape(el, opt) {
    return {
      el: el, opt: opt,
      px: { cur: 0, vel: 0 }, py: { cur: 0, vel: 0 },
      sc: { cur: 1, vel: 0 }, rot: { cur: 0, vel: 0 }, st: { cur: 0, vel: 0 },
      tpx: 0, tpy: 0, tsc: 1, trot: 0, tst: 0, ang: 0,
      k: 420, c: 21, kt: 300, ct: 16,
      pk: 420, pc: 21,                         // 位置弹簧（与缩放弹簧解耦，拖动手感独立）
      esx: 1, esy: 1, etx: 0, ety: 0,
      dragging: false, mounted: false, visible: false,
      rx: 0, ry: 0, rw: 0, rh: 0,
      warp: null, warpI: null, shine: null, o1: null, h: null, prev: null,
      bw: 0, bh: 0, ds: 0, glassMode: 'idle', svg: false
    };
  }

  /* ------------------------------------------------------------
     4. 装配
     ------------------------------------------------------------ */

  /* 按钮玻璃体：天光洗 + 半透明底色。
     真正的折射来自 backdrop-filter 位移滤镜（扭曲按钮背后的真实页面内容），
     这层背景只是给玻璃"上色"——必须足够透，折射才看得见 */
  function glassBg(t) {
    var brand = t.indexOf('gradient') !== -1;
    // 品牌色洗要轻：白洗太重会把底色冲成牛奶片（今天已打卡按钮的教训）
    var wash = brand
      ? (isDark()
        ? 'linear-gradient(180deg,rgba(255,255,255,.14) 0%,rgba(255,255,255,.03) 22%,rgba(255,255,255,0) 46%,rgba(0,0,0,.14) 100%)'
        : 'linear-gradient(180deg,rgba(255,255,255,.22) 0%,rgba(255,255,255,.05) 22%,rgba(255,255,255,0) 46%,rgba(0,0,0,.08) 100%)')
      : (isDark()
        ? 'linear-gradient(180deg,rgba(255,255,255,.22) 0%,rgba(255,255,255,.05) 24%,rgba(255,255,255,0) 48%,rgba(0,0,0,.16) 100%)'
        : 'linear-gradient(180deg,rgba(255,255,255,.38) 0%,rgba(255,255,255,.09) 24%,rgba(255,255,255,0) 48%,rgba(0,0,0,.07) 100%)');
    return wash + ', ' + t;   // 洗叠在底色之上：品牌渐变也必须画，否则按钮洗成白片
  }

  /* 内缘流光纹：细斜纹 + radial mask 让它只存在于边缘带，
     再被位移滤镜扭曲 → 即使按钮底下是纯平卡片，
     静止态也能看到一圈液态流光（折射的"可视化替身"） */
  function stripeBg() {
    return isDark()
      ? 'repeating-linear-gradient(135deg, rgba(255,255,255,.18) 0 2px, rgba(255,255,255,0) 2px 7px)'
      : 'repeating-linear-gradient(135deg, rgba(255,255,255,.45) 0 2px, rgba(255,255,255,0) 2px 7px)';
  }
  function warpUrl(s) { return 'url(#' + filterFor(s.bw, s.bh, s.ds * 0.8) + ')'; }

  function shellShadow() {
    // 冷暖错位的 1px 内环 = 玻璃侧壁色散（不用 mask 层，直接进 inset 阴影，零额外合成）
    return isDark()
      ? '0 18px 44px rgba(0,0,0,.42), inset 0 1px 0 rgba(255,255,255,.12), inset 1px 1px 0 rgba(140,190,255,.12), inset -1px -1px 0 rgba(255,150,215,.08), inset 0 -1px 1px rgba(255,255,255,.04)'
      : '0 18px 44px rgba(16,18,29,.10), inset 0 1px 0 rgba(255,255,255,.44), inset 1px 1px 0 rgba(150,200,255,.30), inset -1px -1px 0 rgba(255,160,220,.17), inset 0 -1px 1px rgba(255,255,255,.12)';
  }

  function btnShadow(s) {
    var minSide = Math.min(s.rw, s.rh);
    var dark = isDark();
    var outer = minSide < 42
      ? (dark ? '0 6px 18px rgba(0,0,0,.44)' : '0 7px 18px rgba(16,18,29,.16)')
      : (dark ? '0 12px 32px rgba(0,0,0,.46)' : '0 14px 34px rgba(16,18,29,.20)');
    return outer +
      ', inset 0 1.5px 0 rgba(255,255,255,' + (dark ? .22 : .68) + ')' +
      ', inset 1px 1px 0 rgba(150,205,255,' + (dark ? .18 : .42) + ')' +
      ', inset -1px -1px 0 rgba(255,155,222,' + (dark ? .11 : .24) + ')' +
      ', inset 0 -1px 1.5px rgba(255,255,255,' + (dark ? .08 : .20) + ')' +
      ', inset 0 4px 14px rgba(255,255,255,' + (dark ? .10 : .26) + ')' +
      ', inset 0 0 12px rgba(140,196,255,' + (dark ? .20 : .34) + ')' +
      ', inset 0 -9px 16px rgba(0,0,0,' + (dark ? .14 : .075) + ')';
  }

  function mountGlass(s) {
    var el = s.el, kind = s.opt.kind, r = el.getBoundingClientRect();
    s.rx = r.left; s.ry = r.top; s.rw = r.width; s.rh = r.height;
    if (r.width < 4 || r.height < 4) return false;

    s.prev = {
      position: el.style.position, zIndex: el.style.zIndex,
      background: el.style.background, boxShadow: el.style.boxShadow,
      backdropFilter: el.style.backdropFilter, webkitBackdropFilter: el.style.webkitBackdropFilter,
      borderColor: el.style.borderColor
    };
    var cs = getComputedStyle(el);
    if (cs.position === 'static') el.style.position = 'relative';
    if (cs.zIndex === 'auto') el.style.zIndex = '0';
    el.style.borderColor = 'transparent';
    el.style.background = tintOf(s);

    if (kind === 'shell') {
      /* —— 大容器：不用 backdrop-filter ——
         页面背景是低频渐变，模糊它没有视觉收益，却是最大的性能开销。
         顶栏例外：它覆盖滚动内容，需要一点模糊。 */
      var bd = s.opt.bar ? 'blur(12px) saturate(140%)' : 'none';
      el.style.backdropFilter = bd;
      el.style.webkitBackdropFilter = bd;
      el.style.boxShadow = shellShadow();
      s.shine = makeSpan('lg-shine');
      el.appendChild(s.shine);
    } else {
      /* —— 按钮：backdrop-filter 位移滤镜，折射背后真实页面内容 ——
         这是 liquid-glass-react 的核心机制；探针已实证本 Chromium
         支持 backdrop-filter: url(#filter)，条纹在边缘明显弯曲 */
      var minSide = Math.min(s.rw, s.rh);
      s.ds = Math.max(14, Math.min(84, minSide * 1.0));
      var k = Math.min(1, MAP_MAX / Math.max(s.rw, s.rh));
      s.bw = bucketPx(s.rw * k);
      s.bh = bucketPx(s.rh * k);
      s.svg = true;

      el.style.background = glassBg(tintOf(s));
      el.style.boxShadow = btnShadow(s);
      s.glassMode = 'idle';
      applyGlass(s);                              // 静止态就挂折射

      // 内缘流光纹层（z-index:-1 → 在底色之上、文字之下）
      var warp = makeSpan('lg-warp');
      var warpI = makeSpan('lg-warp-i');
      warpI.style.background = stripeBg();
      warpI.style.webkitMaskImage = warpI.style.maskImage =
        'radial-gradient(100% 130% at 50% 50%, rgba(0,0,0,0) 58%, rgba(0,0,0,1) 88%)';
      warpI.style.filter = warpUrl(s);
      warp.appendChild(warpI);
      el.insertBefore(warp, el.firstChild);
      s.warp = warp; s.warpI = warpI;

      // 玻璃顶面反光（制造"厚度"）
      s.shine = makeSpan('lg-shine lg-shine-btn');
      el.appendChild(s.shine);

      if (!s.opt.noPress) {
        s.o1 = makeSpan('lg-hov');
        el.appendChild(s.o1);
      }
    }
    s.mounted = true;
    return true;
  }

  function unmountGlass(s) {
    var el = s.el;
    unbindPointer(s);
    if (s.warp && s.warp.parentElement === el) el.removeChild(s.warp);
    ['shine', 'e1', 'e2', 'o1', 'o2', 'o3'].forEach(function (k) {
      var n = s[k];
      if (n && n.parentElement === el) el.removeChild(n);
      s[k] = null;
    });
    s.warpI = null;
    if (s.prev) {
      el.style.position = s.prev.position;
      el.style.zIndex = s.prev.zIndex;
      el.style.background = s.prev.background;
      el.style.boxShadow = s.prev.boxShadow;
      el.style.backdropFilter = s.prev.backdropFilter;
      el.style.webkitBackdropFilter = s.prev.webkitBackdropFilter;
      el.style.borderColor = s.prev.borderColor;
      s.prev = null;
    }
    el.style.transform = '';
    s.mounted = false;
  }

  function refreshVisual(s) {
    if (!s.mounted) return;
    var r = s.el.getBoundingClientRect();
    if (r.width < 4 || r.height < 4) return;
    s.rx = r.left; s.ry = r.top; s.rw = r.width; s.rh = r.height;
    if (s.opt.kind === 'shell') {
      s.el.style.boxShadow = shellShadow();
      return;
    }
    var minSide = Math.min(r.width, r.height);
    var ds = Math.max(14, Math.min(84, minSide * 1.0));
    var k = Math.min(1, MAP_MAX / Math.max(r.width, r.height));
    var bw = bucketPx(r.width * k), bh = bucketPx(r.height * k);
    if (bw !== s.bw || bh !== s.bh || Math.abs(ds - s.ds) > 0.5) {
      s.bw = bw; s.bh = bh; s.ds = ds;
      applyGlass(s);
      if (s.warpI) s.warpI.style.filter = warpUrl(s);
    }
    s.el.style.boxShadow = btnShadow(s);
  }

  function applyTint(s) {
    if (!s.mounted) return;
    if (s.opt.kind === 'shell') {
      s.el.style.background = tintOf(s);
      s.el.style.boxShadow = shellShadow();
    } else {
      s.el.style.background = glassBg(tintOf(s));
      if (s.warpI) s.warpI.style.background = stripeBg();
      s.el.style.boxShadow = btnShadow(s);
    }
  }

  /* ------------------------------------------------------------
     5. 注册表刷新
     ------------------------------------------------------------ */
  function refreshRegistry() {
    var seen = new Set(), list = [];
    for (var i = 0; i < SEL.length; i++) {
      var els = document.querySelectorAll(SEL[i][0]);
      for (var j = 0; j < els.length; j++) {
        if (seen.has(els[j])) continue;
        seen.add(els[j]);
        list.push({ el: els[j], opt: SEL[i][1] });
      }
    }
    var keep = new Set(list.map(function (a) { return a.el; }));
    shapes = shapes.filter(function (s) {
      if (!keep.has(s.el) || !s.el.isConnected) {
        if (s.mounted) unmountGlass(s);
        shapesByEl.delete(s.el);
        return false;
      }
      return true;
    });
    for (var k = 0; k < list.length; k++) {
      var a = list[k];
      var s = shapesByEl.get(a.el);
      if (!s) {
        s = makeShape(a.el, a.opt);
        shapesByEl.set(a.el, s);
        if (!mountGlass(s)) { shapesByEl.delete(a.el); continue; }
        shapes.push(s);
        bindPointer(s);
        observeSize(s);
        a.el.classList.add(s.opt.kind === 'shell' ? 'g-card' : 'g-el');
        s.visible = true;
      } else if (!s.mounted) {
        if (!mountGlass(s)) { continue; }
        bindPointer(s);
        observeSize(s);
        a.el.classList.add(s.opt.kind === 'shell' ? 'g-card' : 'g-el');
        s.visible = true;
      } else if (!s.visible) {
        refreshVisual(s);
        s.visible = true;
      }
    }
    rebuildBtnList();
  }

  function rebuildBtnList() {
    btnShapes.length = 0;
    for (var i = 0; i < shapes.length; i++) {
      if (shapes[i].opt.kind === 'btn' && shapes[i].mounted) btnShapes.push(shapes[i]);
    }
  }

  var sizeRO = null;
  function observeSize(s) {
    if (!sizeRO) {
      sizeRO = new ResizeObserver(function (entries) {
        for (var i = 0; i < entries.length; i++) {
          var sh = shapesByEl.get(entries[i].target);
          if (sh && sh.mounted) refreshVisual(sh);
        }
      });
    }
    sizeRO.observe(s.el);
  }

  /* ------------------------------------------------------------
     6. 弹簧 + 帧循环
     ------------------------------------------------------------ */
  var rafId = 0, lastT = 0;

  function stepSpring(o, target, k, c, dt, eps) {
    o.vel += (-k * (o.cur - target) - c * o.vel) * dt;
    o.cur += o.vel * dt;
    if (Math.abs(o.cur - target) < eps && Math.abs(o.vel) < eps * 70) {
      o.cur = target; o.vel = 0;
      return false;
    }
    return true;
  }

  function elasticTarget(s) {
    if (!mouse.on || s.dragging) return null;
    var cx = s.rx + s.rw / 2, cy = s.ry + s.rh / 2;
    var dx = mouse.x - cx, dy = mouse.y - cy;
    var edx = Math.max(0, Math.abs(dx) - s.rw / 2);
    var edy = Math.max(0, Math.abs(dy) - s.rh / 2);
    var edgeDistance = Math.sqrt(edx * edx + edy * edy);
    if (edgeDistance > 200) return null;
    var fade = 1 - edgeDistance / 200;
    var cd = Math.sqrt(dx * dx + dy * dy);
    if (cd < 1) return null;
    var nx = dx / cd, ny = dy / cd;
    var st = Math.min(cd / 300, 1) * 0.18 * fade;
    return {
      sx: Math.max(0.82, 1 + Math.abs(nx) * st * 0.34 - Math.abs(ny) * st * 0.16),
      sy: Math.max(0.82, 1 + Math.abs(ny) * st * 0.34 - Math.abs(nx) * st * 0.16),
      tx: dx * 0.02 * fade,
      ty: dy * 0.02 * fade
    };
  }

  function writeTransform(s) {
    var ox = s.px.cur + s.etx, oy = s.py.cur + s.ety;
    var sx = s.sc.cur * s.esx, sy = s.sc.cur * s.esy;
    var rot = s.rot.cur, st = s.st.cur;
    if (!s.dragging && Math.abs(ox) < 0.01 && Math.abs(oy) < 0.01 &&
        Math.abs(sx - 1) < 0.0005 && Math.abs(sy - 1) < 0.0005 &&
        Math.abs(rot) < 0.0005 && st < 0.0005) {
      if (s.el.style.transform) s.el.style.transform = '';
      return;
    }
    var t = 'translate(' + ox.toFixed(2) + 'px,' + oy.toFixed(2) + 'px)';
    if (st > 0.0005) {
      t += ' rotate(' + s.ang.toFixed(3) + 'rad) scale(' +
        (sx * (1 + st)).toFixed(4) + ',' + (sy * (1 - 0.6 * st)).toFixed(4) +
        ') rotate(' + (-s.ang).toFixed(3) + 'rad)';
    } else if (Math.abs(sx - 1) > 0.0005 || Math.abs(sy - 1) > 0.0005) {
      t += ' scale(' + sx.toFixed(4) + ',' + sy.toFixed(4) + ')';
    }
    if (Math.abs(rot) > 0.0005) t += ' rotate(' + rot.toFixed(3) + 'rad)';
    s.el.style.transform = t;
  }

  function stepBtn(s, dt) {
    var alive = false;
    // 拖动时直接锁死弹性吸附偏移，不让残留的 etx/ety 干扰位置
    if (s.dragging) { s.etx = s.ety = 0; s.esx = s.esy = 1; }
    if (REDUCED) {
      s.px.cur = s.tpx; s.py.cur = s.tpy; s.sc.cur = s.tsc;
      s.rot.cur = s.trot; s.st.cur = s.tst;
      s.px.vel = s.py.vel = s.sc.vel = s.rot.vel = s.st.vel = 0;
    } else {
      if (stepSpring(s.px, s.tpx, s.pk, s.pc, dt, 0.02)) alive = true;
      if (stepSpring(s.py, s.tpy, s.pk, s.pc, dt, 0.02)) alive = true;
      if (stepSpring(s.sc, s.tsc, s.k, s.c, dt, 0.0008)) alive = true;
      if (stepSpring(s.rot, s.trot, s.kt, s.ct, dt, 0.0004)) alive = true;
      if (stepSpring(s.st, s.tst, s.kt, s.ct, dt, 0.0004)) alive = true;
    }
    // 鼠标弹性吸附（只对白名单，拖动时禁用）
    if (s.opt.elastic && !s.dragging) {
      var et = elasticTarget(s);
      var tsx = et ? et.sx : 1, tsy = et ? et.sy : 1;
      var ttx = et ? et.tx : 0, tty = et ? et.ty : 0;
      var f = Math.min(1, dt * 60 * 0.26);
      if (Math.abs(s.esx - tsx) > 1e-4 || Math.abs(s.esy - tsy) > 1e-4 ||
          Math.abs(s.etx - ttx) > 0.03 || Math.abs(s.ety - tty) > 0.03) {
        s.esx += (tsx - s.esx) * f;
        s.esy += (tsy - s.esy) * f;
        s.etx += (ttx - s.etx) * f;
        s.ety += (tty - s.ety) * f;
        alive = true;
      } else {
        s.esx = tsx; s.esy = tsy; s.etx = ttx; s.ety = tty;
      }
    }
    if (alive) writeTransform(s);
    return alive;
  }

  /* —— 标签滑块：位置/宽度双弹簧 + 速度体积补偿 —— */
  var g = null, glider = null;

  function stepGlider(dt) {
    if (!g) return false;
    var alive = false;
    if (REDUCED) {
      g.cx.cur = g.tcx; g.w.cur = g.tw; g.sc.cur = 1;
      g.cx.vel = g.w.vel = g.sc.vel = 0;
    } else {
      if (stepSpring(g.cx, g.tcx, 180, 9.5, dt, 0.15)) alive = true;
      if (stepSpring(g.w, g.tw, 240, 14, dt, 0.15)) alive = true;
      // 位置飞到位后，再把缩放目标收回 1 → 实现"先放大 → 飞 → 缩回原状"
      if (g.tsc !== 1 && Math.abs(g.cx.cur - g.tcx) < 4 && Math.abs(g.cx.vel) < 30) {
        g.tsc = 1;
      }
      if (stepSpring(g.sc, g.tsc, 230, 10.5, dt, 0.0006)) alive = true;
    }
    var extra = Math.min(Math.abs(g.cx.vel) * 0.014, 32);
    var w = g.w.cur + extra;
    var left = g.cx.cur - w / 2 - g.originLeft;
    glider.style.width = w.toFixed(1) + 'px';
    glider.style.transform = 'translateX(' + left.toFixed(1) + 'px) scale(' +
      g.sc.cur.toFixed(3) + ')';
    return alive;
  }

  function frame(now) {
    rafId = 0;
    var dt = lastT ? Math.min((now - lastT) / 1000, 1 / 30) : 1 / 60;
    if (dt <= 0) dt = 1 / 60;
    lastT = now;
    var alive = false;
    for (var i = 0; i < btnShapes.length; i++) {
      if (btnShapes[i].visible && stepBtn(btnShapes[i], dt)) alive = true;
    }
    if (stepGlider(dt)) alive = true;
    if (alive) rafId = requestAnimationFrame(frame);
    else lastT = 0;
  }

  function kick() { if (!rafId) rafId = requestAnimationFrame(frame); }

  function springTo(s, ts, k, c) { s.tsc = ts; s.k = k; s.c = c; kick(); }

  /* —— 折射三态：idle 常开；hover 加饱和度；press 位移更强、玻璃更"薄" ——
     切换只是换 backdrop-filter 的 url（滤镜已按尺寸缓存），不重排不重建 */
  function applyGlass(s) {
    if (s.opt.kind !== 'btn' || !s.bw || !s.bh) return;
    var mode = s.glassMode || 'idle';
    var ds = s.ds, suffix = '';
    if (mode === 'hover') { ds = s.ds * 1.06; suffix = ' saturate(150%)'; }
    else if (mode === 'press') { ds = s.ds * 1.22; suffix = ' saturate(195%)'; }
    var v = 'url(#' + filterFor(s.bw, s.bh, ds) + ')' + suffix;
    s.el.style.backdropFilter = v;
    s.el.style.webkitBackdropFilter = v;
  }

  function setGlass(s, mode) {
    if (s.opt.kind !== 'btn') return;
    if (s.glassMode === mode) return;
    s.glassMode = mode;
    applyGlass(s);
  }

  // 宽按钮放大收敛，避免撑破容器
  function pressAmt(s, base) {
    if (s.rw > 260) return 1 + (base - 1) * 0.28;
    if (s.rw > 160) return 1 + (base - 1) * 0.66;
    return base;
  }

  function setOverlays(s, hover, active) {
    if (!s.o1) return;
    s.o1.style.opacity = active ? 0.8 : (hover ? 0.36 : 0);
  }

  /* ------------------------------------------------------------
     7. 指针交互
     ------------------------------------------------------------ */
  function unbindPointer(s) {
    var h = s.h, el = s.el;
    if (!h) return;
    el.removeEventListener('mouseenter', h.enter);
    el.removeEventListener('mouseleave', h.leave);
    el.removeEventListener('pointerdown', h.down);
    el.removeEventListener('pointercancel', h.cancel);
    window.removeEventListener('pointerup', h.up);
    s.h = null;
  }

  function bindPointer(s) {
    var el = s.el;
    if (s.h) return;
    var h = s.h = {};

    h.enter = function () {
      hoverShape = s;
      if (s.opt.kind !== 'btn') { kick(); return; }
      setGlass(s, 'hover');                      // 放大那一刻就带折射
      setOverlays(s, true, false);
      if (!s.opt.drag) springTo(s, pressAmt(s, 1.07), 420, 23);
      kick();
    };
    h.leave = function () {
      if (hoverShape === s) hoverShape = null;
      if (s.opt.kind !== 'btn' || s.dragging) return;
      setOverlays(s, false, false);
      setGlass(s, 'idle');
      springTo(s, 1, 470, 17);
    };
    h.down = function (e) {
      if (e.button !== undefined && e.button !== 0) return;
      if (s.opt.kind !== 'btn') return;
      setGlass(s, 'press');
      setOverlays(s, true, true);
      if (s.opt.drag) startDrag(s, e);
      else springTo(s, pressAmt(s, 1.11), 540, 22);
      kick();
    };
    h.up = function () {
      // window 级监听：只对鼠标仍悬停的那个按钮生效，否则会把全部按钮的折射层打开
      if (s.opt.kind !== 'btn' || s.dragging) return;
      if (hoverShape !== s) { setGlass(s, 'idle'); return; }
      setGlass(s, 'hover');
      setOverlays(s, true, false);
      springTo(s, 1, 470, 16);
    };
    h.cancel = function () { h.up(); };

    el.addEventListener('mouseenter', h.enter);
    el.addEventListener('mouseleave', h.leave);
    el.addEventListener('pointerdown', h.down);
    el.addEventListener('pointercancel', h.cancel);
    window.addEventListener('pointerup', h.up);
  }

  /* —— 拖动：目标跟手，位置由弹簧追（有重量感），松手甩回 —— */
  function startDrag(s, e) {
    var el = s.el;
    var startX = e.clientX, startY = e.clientY;
    var moved = false, lastX = e.clientX, lastY = e.clientY, lastT = performance.now();
    s.dragging = true;
    s.pk = 280; s.pc = 33;                 // 位置：ζ≈0.99 近临界阻尼，跟手无振荡（之前 ζ0.46 乱回弹）
    springTo(s, 1.24, 520, 26);             // 缩放：快速放大（独立 k/c）
    el.classList.add('g-drag');

    function onMove(ev) {
      var dx = ev.clientX - startX, dy = ev.clientY - startY;
      if (!moved && Math.abs(dx) + Math.abs(dy) > 5) {
        moved = true;
        el.style.zIndex = '999';
      }
      // 位置目标每帧都更新（不等阈值），弹簧从按下那一刻就开始追，避免松手突变
      s.tpx = dx; s.tpy = dy;
      if (!moved) return;
      var now = performance.now();
      var dt = Math.max(now - lastT, 1);
      var vx = (ev.clientX - lastX) / dt * 1000;
      var vy = (ev.clientY - lastY) / dt * 1000;
      lastX = ev.clientX; lastY = ev.clientY; lastT = now;
      var speed = Math.sqrt(vx * vx + vy * vy);
      s.trot = Math.max(-0.14, Math.min(0.14, vx * 0.00045));
      s.tst = Math.min(speed * 0.00022, 0.2);
      if (speed > 40) s.ang = Math.atan2(vy, vx);
      kick();
    }
    function onUp() {
      window.removeEventListener('pointermove', onMove, true);
      window.removeEventListener('pointerup', onUp, true);
      window.removeEventListener('pointercancel', onUp, true);
      s.dragging = false;
      el.style.zIndex = (s.prev && s.prev.zIndex) ? s.prev.zIndex : '0';
      el.classList.remove('g-drag');
      s.trot = 0; s.tst = 0;
      s.pk = 330; s.pc = 18;                // 位置回弹：ζ≈0.5，柔和过冲（之前 0.33 弹太猛）
      s.tpx = 0; s.tpy = 0;
      springTo(s, 1, 520, 26);              // 缩放快速回正（不跟位置弹簧绑死）
      if (hoverShape === s) { setOverlays(s, true, false); setGlass(s, 'hover'); }
      else { setOverlays(s, false, false); setGlass(s, 'idle'); }
      if (moved) {
        var cleanup = function () {
          el.removeEventListener('click', suppress, true);
          clearTimeout(guard);
        };
        var suppress = function (ce) { ce.stopImmediatePropagation(); ce.preventDefault(); cleanup(); };
        var guard = setTimeout(cleanup, 500);
        el.addEventListener('click', suppress, true);
      }
      kick();
    }
    window.addEventListener('pointermove', onMove, true);
    window.addEventListener('pointerup', onUp, true);
    window.addEventListener('pointercancel', onUp, true);
  }

  /* ------------------------------------------------------------
     8. 标签栏：滑块弹簧飞行 + scrub + 点击脉冲
     ------------------------------------------------------------ */
  function initTabs() {
    var tabs = document.querySelector('.tabs');
    if (!tabs) return;
    var tabEls = Array.prototype.slice.call(tabs.querySelectorAll('.tab'));
    if (!tabEls.length) return;

    glider = document.createElement('span');
    glider.className = 'tab-glider';
    tabs.insertBefore(glider, tabs.firstChild);

    g = {
      cx: { cur: 0, vel: 0 }, w: { cur: 0, vel: 0 }, sc: { cur: 1, vel: 0 },
      tcx: 0, tw: 0, tsc: 1, ready: false, originLeft: 0, lastActive: null
    };

    function activeTab() {
      for (var i = 0; i < tabEls.length; i++) if (tabEls[i].classList.contains('active')) return tabEls[i];
      return tabEls[0];
    }

    function measureOrigin() {
      // glider 绝对定位在 tabs 的 padding box 内，left:0 = border 内侧
      var tr = tabs.getBoundingClientRect();
      g.originLeft = tr.left + (parseFloat(getComputedStyle(tabs).borderLeftWidth) || 0);
    }

    function syncToActive(animate) {
      var t = activeTab();
      if (!t) return;
      var r = t.getBoundingClientRect();
      var changed = g.lastActive && g.lastActive !== t;
      g.tcx = r.left + r.width / 2;
      g.tw = r.width;
      if (!g.ready || !animate) {
        g.cx.cur = g.tcx; g.cx.vel = 0;
        g.w.cur = g.tw; g.w.vel = 0;
        g.sc.cur = 1; g.sc.vel = 0; g.tsc = 1;
        g.ready = true;
        stepGlider(1 / 60);
      } else {
        if (changed) {
          // 先放大：把缩放目标设到 1.38，弹簧把它拉过去（比冲量更可控，时序清晰）
          g.tsc = 1.38; g.sc.cur = 1; g.sc.vel = 0;
          // 长距离跳转也给一记初速度，让它"飞"过去而不是慢慢挪
          var d = g.tcx - g.cx.cur;
          if (Math.abs(d) > 3) {
            g.cx.vel += Math.max(-150, Math.min(150, d * 0.5));
          }
        }
        kick();
      }
      g.lastActive = t;
    }

    var mo = new MutationObserver(function () { syncToActive(true); });
    tabEls.forEach(function (t) { mo.observe(t, { attributes: true, attributeFilter: ['class'] }); });

    // —— scrub ——
    var scrub = null;
    tabs.addEventListener('pointerdown', function (e) {
      if (e.button !== undefined && e.button !== 0) return;
      var tr = tabs.getBoundingClientRect();
      measureOrigin();
      scrub = {
        id: e.pointerId, startX: e.clientX, grabOff: e.clientX - g.cx.cur,
        minCx: tr.left + 16, maxCx: tr.right - 16,
        moved: false, lastX: e.clientX, lastT: performance.now(), vel: 0
      };
      try { tabs.setPointerCapture(e.pointerId); } catch (err) {}
    });
    tabs.addEventListener('pointermove', function (e) {
      if (!scrub || e.pointerId !== scrub.id) return;
      var dx = e.clientX - scrub.startX;
      // 阈值 12px：普通点击的手抖不会被误判为拖动，保证点击切页正常
      if (!scrub.moved && Math.abs(dx) > 12) scrub.moved = true;
      if (!scrub.moved) return;
      var now = performance.now();
      var dt = Math.max(now - scrub.lastT, 1);
      scrub.vel = (e.clientX - scrub.lastX) / dt * 1000;
      scrub.lastX = e.clientX; scrub.lastT = now;
      var cx = Math.min(Math.max(e.clientX - scrub.grabOff, scrub.minCx), scrub.maxCx);
      g.cx.cur = cx; g.cx.vel = 0;
      g.w.cur = g.tw + Math.min(Math.abs(scrub.vel) * 0.018, 22);
      g.w.vel = 0;
      stepGlider(1 / 60);
      e.preventDefault();
    });
    function scrubEnd(e) {
      if (!scrub || (e.pointerId !== undefined && e.pointerId !== scrub.id)) return;
      var wasMoved = scrub.moved;
      scrub = null;
      if (!wasMoved) return;
      var best = null, bestD = 1e9;
      tabEls.forEach(function (t) {
        var r = t.getBoundingClientRect();
        var d = Math.abs(r.left + r.width / 2 - g.cx.cur);
        if (d < bestD) { bestD = d; best = t; }
      });
      if (best) {
        var r = best.getBoundingClientRect();
        g.tcx = r.left + r.width / 2;
        g.tw = r.width;
        g.cx.vel = Math.min(Math.abs(g.cx.vel), 0.0001);
        g.tsc = 1;                                  // scrub 松手后回归常态，不放大
        kick();
        if (!best.classList.contains('active')) best.click();
      }
      var suppress = function (ce) { ce.stopImmediatePropagation(); ce.preventDefault(); cleanup(); };
      var cleanup = function () { tabs.removeEventListener('click', suppress, true); clearTimeout(guard); };
      var guard = setTimeout(cleanup, 500);
      tabs.addEventListener('click', suppress, true);
      e.preventDefault();
    }
    tabs.addEventListener('pointerup', scrubEnd);
    tabs.addEventListener('pointercancel', scrubEnd);

    // —— 点击 tab：缩小蓄力 → 弹大 → 回正（欠阻尼非线性曲线） ——
    tabs.addEventListener('click', function (e) {
      var t = e.target;
      while (t && t !== tabs && !(t.classList && t.classList.contains('tab'))) t = t.parentElement;
      if (!t || !t.classList || !t.classList.contains('tab')) return;
      if (REDUCED) return;
      t.animate([
        { transform: 'scale(1)' },
        { transform: 'scale(0.93)', offset: 0.14 },
        { transform: 'scale(1.13)', offset: 0.42 },
        { transform: 'scale(0.985)', offset: 0.78 },
        { transform: 'scale(1)' }
      ], { duration: 640, easing: 'cubic-bezier(.3,1.25,.42,1)', fill: 'none' });
    });

    window.addEventListener('resize', function () {
      g.ready = false;
      measureOrigin();
      syncToActive(false);
    });
    measureOrigin();
    syncToActive(false);
    setTimeout(function () { measureOrigin(); syncToActive(false); }, 400);
    setTimeout(function () { measureOrigin(); syncToActive(false); }, 1200);
  }

  /* ------------------------------------------------------------
     9. 事件编排
     ------------------------------------------------------------ */
  var lastDark = false;

  function bindEvents() {
    var moT = 0;
    var mo = new MutationObserver(function (muts) {
      var relevant = false;
      for (var i = 0; i < muts.length; i++) {
        var m = muts[i], t = m.target;
        if (t === document.body && m.type === 'attributes') continue;
        if (m.type === 'childList') {
          var nodes = m.addedNodes.length ? m.addedNodes : m.removedNodes;
          var onlyGlass = true;
          for (var n = 0; n < nodes.length; n++) {
            var nd = nodes[n];
            if (nd.nodeType !== 1) { onlyGlass = false; break; }
            var cn = nd.className;
            if (typeof cn !== 'string' ||
                !(cn.indexOf('lg-warp') === 0 || cn.indexOf('lg-edge') === 0 ||
                  cn.indexOf('lg-hov') === 0 || cn.indexOf('lg-shine') === 0 ||
                  nd.tagName === 'svg')) { onlyGlass = false; break; }
          }
          if (onlyGlass && nodes.length) continue;
          relevant = true;
          continue;
        }
        if (m.type === 'attributes') {
          // 引擎自身写入的 style / transform 不触发重注册
          if (m.attributeName === 'style') continue;
          relevant = true;
        }
      }
      if (!relevant) return;
      clearTimeout(moT);
      moT = setTimeout(refreshRegistry, 90);
    });
    mo.observe(document.body, {
      childList: true, subtree: true,
      attributes: true, attributeFilter: ['class', 'open']
    });

    var darkMO = new MutationObserver(function () {
      var d = isDark();
      if (d === lastDark) return;
      lastDark = d;
      for (var i = 0; i < shapes.length; i++) applyTint(shapes[i]);
    });
    darkMO.observe(document.body, { attributes: true, attributeFilter: ['class'] });

    var rsT = 0;
    window.addEventListener('resize', function () {
      clearTimeout(rsT);
      rsT = setTimeout(function () {
        refreshRegistry();
        if (g) { measureOriginPublic(); syncToActivePublic(false); }
      }, 180);
    });
  }

  function measureOriginPublic() {
    var tabs = document.querySelector('.tabs');
    if (!tabs || !g) return;
    var tr = tabs.getBoundingClientRect();
    g.originLeft = tr.left + (parseFloat(getComputedStyle(tabs).borderLeftWidth) || 0);
  }
  function syncToActivePublic(animate) {
    if (!g) return;
    var tabs = document.querySelector('.tabs');
    if (!tabs) return;
    var t = tabs.querySelector('.tab.active');
    if (!t) return;
    var r = t.getBoundingClientRect();
    g.tcx = r.left + r.width / 2;
    g.tw = r.width;
    if (!animate) { g.cx.cur = g.tcx; g.w.cur = g.tw; g.cx.vel = 0; g.w.vel = 0; stepGlider(1 / 60); }
    else kick();
  }

  /* ------------------------------------------------------------
     10. 启动
     ------------------------------------------------------------ */
  function boot() {
    var supported = !!(window.CSS && CSS.supports && CSS.supports('filter', 'url(#lg_probe)'));
    document.body.classList.add('glass-on');
    if (!supported) document.body.classList.add('glass-lite');
    lastDark = isDark();

    initTabs();
    refreshRegistry();
    bindEvents();

    window.addEventListener('mousemove', function (e) {
      mouse.x = e.clientX; mouse.y = e.clientY; mouse.on = true;
      // 只在指针靠近"会吸鼠标"的按钮时才开帧循环，其它地方扫过不耗一帧
      if (hoverShape) { kick(); return; }
      for (var i = 0; i < btnShapes.length; i++) {
        var s = btnShapes[i];
        if (!s.opt.elastic || !s.rw) continue;
        var cx = s.rx + s.rw / 2, cy = s.ry + s.rh / 2;
        if (Math.abs(e.clientX - cx) < s.rw / 2 + 240 &&
            Math.abs(e.clientY - cy) < s.rh / 2 + 240) { kick(); return; }
      }
    }, { passive: true });

    // 预热：把按钮三态的位移滤镜提前生成，避免首次 hover/press 掉帧
    setTimeout(function () {
      for (var i = 0; i < btnShapes.length; i++) {
        var s = btnShapes[i];
        if (s.svg && s.bw && s.bh) {
          filterFor(s.bw, s.bh, s.ds);
          filterFor(s.bw, s.bh, s.ds * 1.06);
          filterFor(s.bw, s.bh, s.ds * 1.22);
        }
      }
    }, 500);

    setTimeout(refreshRegistry, 300);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(refreshRegistry);
    window.addEventListener('load', function () { setTimeout(refreshRegistry, 200); });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

  window.Glass = {
    refresh: refreshRegistry,
    capture: function () {},
    shapes: function () { return shapes; },
    info: function () {
      return {
        count: shapes.length,
        filters: fseq,
        list: shapes.map(function (s) {
          return {
            sel: s.el.id || (typeof s.el.className === 'string' ? s.el.className.split(' ')[0] : '?'),
            kind: s.opt.kind, mounted: s.mounted,
            ds: +s.ds.toFixed(1), bw: s.bw, bh: s.bh
          };
        })
      };
    }
  };
})();
