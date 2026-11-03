/* ============================================================
   液态玻璃引擎 v3 —— liquid-glass-react (rdev) 1:1 vanilla 移植
   ------------------------------------------------------------
   光学方案完全照抄开源项目（shader 模式）：
   1. ShaderDisplacementGenerator：按元素尺寸逐像素跑
      fragmentShaders.liquidGlass（roundedRectSDF(0.3,0.2,0.6)
      + smoothStep(0.8,0,d-0.15) 位移场，R=dx、G/B=dy 归一化）
   2. GlassFilter：feImage 载图 → 灰度+feFuncA 边缘掩码 →
      三次 feDisplacementMap 分通道位移（色差 aberration）→
      feBlend screen 合成 → 高斯微糊 → 边缘/中心掩码合成
   3. warp 层：filter:url(#id) 扭曲真实 backdrop
      + backdrop-filter blur/saturate 磨砂
   4. 双高光描边：mix-blend screen/overlay + mask-composite
      exclude 的 1.5px 边缘渐变（随鼠标偏移转角）
   5. hover/active 径向提亮（仅可点击元素）
   6. 200px 弹性吸附：DirectionalScale + ElasticTranslation
   文字永远是真实 DOM —— 绝对锐利；无截图、无纹理陈化。
   交互（弹簧按压/拖动回位/标签 scrub）沿用自有体系。
   ============================================================ */
(function () {
  'use strict';

  var REDUCED = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var SVG_NS = 'http://www.w3.org/2000/svg';

  /* ------------------------------------------------------------
     1. shader 位移贴图生成器（照抄 ShaderDisplacementGenerator）
     ------------------------------------------------------------ */
  function smoothStep(a, b, t) {
    t = Math.max(0, Math.min(1, (t - a) / (b - a)));
    return t * t * (3 - 2 * t);
  }
  function roundedRectSDF(x, y, w, h, r) {
    var qx = Math.abs(x) - w + r;
    var qy = Math.abs(y) - h + r;
    return Math.min(Math.max(qx, qy), 0) + Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) - r;
  }
  // fragmentShaders.liquidGlass
  function liquidGlassFrag(ux, uy) {
    var ix = ux - 0.5, iy = uy - 0.5;
    var d = roundedRectSDF(ix, iy, 0.3, 0.2, 0.6);
    var displacement = smoothStep(0.8, 0, d - 0.15);
    var scaled = smoothStep(0, 1, displacement);
    return { x: ix * scaled + 0.5, y: iy * scaled + 0.5 };
  }

  var mapCache = {};
  function displacementMapURL(w, h) {
    var key = w + 'x' + h;
    if (mapCache[key]) return mapCache[key];
    var canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    var ctx = canvas.getContext('2d');
    var raw = new Float32Array(w * h * 2);
    var maxScale = 0, ri = 0, x, y;
    for (y = 0; y < h; y++) {
      for (x = 0; x < w; x++) {
        var pos = liquidGlassFrag(x / w, y / h);
        var dx = pos.x * w - x, dy = pos.y * h - y;
        maxScale = Math.max(maxScale, Math.abs(dx), Math.abs(dy));
        raw[ri++] = dx; raw[ri++] = dy;
      }
    }
    maxScale = Math.max(maxScale, 1);
    var img = ctx.createImageData(w, h);
    var data = img.data;
    ri = 0;
    for (y = 0; y < h; y++) {
      for (x = 0; x < w; x++) {
        var sDx = raw[ri++], sDy = raw[ri++];
        var edgeDistance = Math.min(x, y, w - x - 1, h - y - 1);
        var edgeFactor = Math.min(1, edgeDistance / 2);
        var r = (sDx * edgeFactor) / maxScale + 0.5;
        var g = (sDy * edgeFactor) / maxScale + 0.5;
        var p = (y * w + x) * 4;
        data[p]     = Math.max(0, Math.min(255, r * 255));
        data[p + 1] = Math.max(0, Math.min(255, g * 255));
        data[p + 2] = Math.max(0, Math.min(255, g * 255));
        data[p + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    var url = canvas.toDataURL();
    mapCache[key] = url;
    return url;
  }

  /* ------------------------------------------------------------
     2. GlassFilter（照抄：SVG 滤镜链，shader 模式 scale 为正）
     ------------------------------------------------------------ */
  var svgDefs = null, filterSeq = 0;
  var filterCache = {};
  var ABERRATION = 2;

  function ensureSvg() {
    if (svgDefs) return;
    var svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('width', '0');
    svg.setAttribute('height', '0');
    svg.setAttribute('aria-hidden', 'true');
    svg.style.position = 'absolute';
    svgDefs = document.createElementNS(SVG_NS, 'defs');
    svg.appendChild(svgDefs);
    document.body.appendChild(svg);
  }

  function filterIdFor(bw, bh, ds) {
    var key = bw + 'x' + bh + '_' + ds.toFixed(1);
    var hit = filterCache[key];
    if (hit) return hit;
    ensureSvg();
    var id = 'lgf_' + (++filterSeq);
    var ab = ABERRATION;
    var map = displacementMapURL(bw, bh);
    var s1 = ds;                                   // red
    var s2 = ds * (1 - ab * 0.05);                 // green
    var s3 = ds * (1 - ab * 0.1);                  // blue
    var blur = Math.max(0.1, 0.5 - ab * 0.1);
    var f = document.createElementNS(SVG_NS, 'filter');
    f.setAttribute('id', id);
    f.setAttribute('x', '-35%'); f.setAttribute('y', '-35%');
    f.setAttribute('width', '170%'); f.setAttribute('height', '170%');
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
     3. 注册表（元素 → 玻璃参数）
     ------------------------------------------------------------ */
  // kind: bar/card/modal（容器）| btn（可交互）| glider（滑块）
  var SEL = [
    ['.topbar',              { kind: 'bar' }],
    ['.hero',                { kind: 'card' }],
    ['.stage',               { kind: 'card' }],
    ['.roadmap',             { kind: 'card' }],
    ['.calendar-card',       { kind: 'card' }],
    ['.day-detail',          { kind: 'card' }],
    ['.heatmap-card',        { kind: 'card' }],
    ['.time-plan',           { kind: 'card' }],
    ['.news-card',           { kind: 'card' }],
    ['.quote-card',          { kind: 'card' }],
    ['.modal-content',       { kind: 'modal' }],
    ['#settingsBtn',         { kind: 'btn', drag: true }],
    ['.medal-wall-btn',      { kind: 'btn', tint: 'accent' }],
    ['#checkinBtn',          { kind: 'btn', tint: 'checkin' }],
    ['.checkin-sub-btn',     { kind: 'btn' }],
    ['.edit-btn',            { kind: 'btn', tint: 'accent' }],
    ['.cal-nav-btn',         { kind: 'btn' }],
    ['.cal-today-btn',       { kind: 'btn', tint: 'accent' }],
    ['.news-refresh-btn',    { kind: 'btn' }],
    ['.quote-btn',           { kind: 'btn' }],
    ['.back-btn',            { kind: 'btn', tint: 'accent' }],
    ['.upload-btn',          { kind: 'btn', tint: 'accent' }],
    ['.mood-btn',            { kind: 'btn' }],
    ['.diary-mode-btn',      { kind: 'btn' }],
    ['.modal-btn.primary',   { kind: 'btn', tint: 'accentDeep' }],
    ['.modal-btn',           { kind: 'btn' }],
    ['.settings-action-btn', { kind: 'btn' }],
    ['.settings-close',      { kind: 'btn' }],
    ['.icon-btn-sm',         { kind: 'btn' }],
    ['.task-edit-del-btn',   { kind: 'btn', tint: 'danger' }],
    ['.task-edit-add-btn',   { kind: 'btn', tint: 'accent' }],
    ['#tabGlider',           { kind: 'glider', noPress: true }]
  ];

  // 元素背景奶洗（tint）：位移玻璃 + 淡色罩 = 品牌质感
  var TINTS = {
    bar:        { l: 'rgba(255,255,255,0.46)', d: 'rgba(12,14,20,0.55)' },
    card:       { l: 'rgba(255,255,255,0.34)', d: 'rgba(16,19,27,0.42)' },
    modal:      { l: 'rgba(255,255,255,0.55)', d: 'rgba(16,19,27,0.62)' },
    btn:        { l: 'rgba(255,255,255,0.30)', d: 'rgba(255,255,255,0.10)' },
    glider:     { l: 'rgba(255,255,255,0.55)', d: 'rgba(255,255,255,0.12)' },
    accent:     { l: 'rgba(10,108,255,0.12)',  d: 'rgba(10,108,255,0.22)' },
    accentDeep: { l: 'rgba(10,108,255,0.55)',  d: 'rgba(10,108,255,0.60)' },
    danger:     { l: 'rgba(255,59,48,0.10)',   d: 'rgba(255,59,48,0.18)' },
    checkin:    { l: 'rgba(10,108,255,0.55)',  d: 'rgba(10,108,255,0.60)' },
    checkinDone:{ l: 'rgba(22,179,100,0.55)',  d: 'rgba(22,179,100,0.60)' }
  };

  var shapes = [];
  var shapesByEl = new Map();

  function isDark() { return document.body.classList.contains('dark'); }

  function tintOf(s) {
    var key = s.opt.tint || s.opt.kind;
    if (key === 'checkin' && s.el.classList.contains('done')) key = 'checkinDone';
    var t = TINTS[key] || TINTS.btn;
    return isDark() ? t.d : t.l;
  }

  function makeShape(el, opt) {
    return {
      el: el, opt: opt,
      clickable: opt.kind === 'btn' && !opt.noPress,
      // 弹簧状态
      ox: 0, oy: 0, sc: 1, rot: 0, st: 0, ang: 0,
      tx: 0, ty: 0, ts: 1, rotT: 0, stT: 0,
      vx: 0, vy: 0, vs: 0, vrot: 0, vst: 0,
      // 弹性吸附状态（DirectionalScale / ElasticTranslation）
      esx: 1, esy: 1, etx: 0, ety: 0,
      dragging: false, visible: false, mounted: false,
      warp: null, warpI: null, e1: null, e2: null, o1: null, o2: null, o3: null,
      prev: null, bw: 0, bh: 0, ds: 0
    };
  }

  /* ------------------------------------------------------------
     4. 装配：warp 层 + 双高光描边 + hover/active 提亮（照抄结构）
     ------------------------------------------------------------ */
  function edgeGradient(mx, my, a1, a2) {
    // 照抄 LiquidGlass 高光渐变（角度/停止点/透明度全随鼠标偏移）
    return 'linear-gradient(' + (135 + mx * 1.2).toFixed(1) + 'deg,' +
      'rgba(255,255,255,0) 0%,' +
      'rgba(255,255,255,' + (a1 + Math.abs(mx) * 8e-3).toFixed(3) + ') ' + Math.max(10, 33 + my * 0.3).toFixed(1) + '%,' +
      'rgba(255,255,255,' + (a2 + Math.abs(mx) * 0.012).toFixed(3) + ') ' + Math.min(90, 66 + my * 0.4).toFixed(1) + '%,' +
      'rgba(255,255,255,0) 100%)';
  }

  function makeSpan(cls) {
    var sp = document.createElement('span');
    sp.className = cls;
    return sp;
  }

  function mountGlass(s) {
    var el = s.el;
    var r = el.getBoundingClientRect();
    var kind = s.opt.kind;
    var container = kind === 'bar' || kind === 'card' || kind === 'modal';
    // 位移强度：容器 25（GlassContainer 默认）；按钮按尺寸 ∝ LiquidGlass 默认 70
    var minSide = Math.min(r.width, r.height);
    s.ds = container ? 25 : Math.max(20, Math.min(70, minSide * 0.7));
    // 贴图分辨率：长边封 480，按 24px 分桶（场是平滑的，肉眼无差）
    var scale = Math.min(1, 480 / Math.max(r.width, r.height));
    s.bw = Math.max(8, Math.round(r.width * scale / 24) * 24);
    s.bh = Math.max(8, Math.round(r.height * scale / 24) * 24);

    // 保存并接管内联样式
    s.prev = {
      position: el.style.position, zIndex: el.style.zIndex,
      background: el.style.background, boxShadow: el.style.boxShadow,
      backdropFilter: el.style.backdropFilter || '',
      webkitBackdropFilter: el.style.webkitBackdropFilter || ''
    };
    var cs = getComputedStyle(el);
    if (cs.position === 'static') el.style.position = 'relative';
    if (getComputedStyle(el).zIndex === 'auto') el.style.zIndex = '0';   // 叠层上下文（warp z:-1 不逃逸）
    el.style.backdropFilter = 'none';
    el.style.webkitBackdropFilter = 'none';
    el.style.background = tintOf(s);
    if (kind === 'btn' || kind === 'glider') {
      // 照抄 GlassContainer 外阴影（小按钮等比收敛）
      el.style.boxShadow = minSide < 40
        ? (isDark() ? '0px 6px 18px rgba(0,0,0,0.45)' : '0px 6px 18px rgba(0,0,0,0.20)')
        : (isDark() ? '0px 12px 40px rgba(0,0,0,0.50)' : '0px 12px 40px rgba(0,0,0,0.25)');
    }

    // warp：外层裁剪（overflow hidden + 继承圆角），内层 filter+backdrop-filter
    var warp = makeSpan('lg-warp');
    var warpI = makeSpan('lg-warp-i');
    var fid = filterIdFor(s.bw, s.bh, s.ds);
    warpI.style.filter = 'url(#' + fid + ')';
    // 照抄 backdropStyle：blur((overLight?12:4) + blurAmount*32) saturate(saturation)
    warpI.style.backdropFilter = container
      ? 'blur(16px) saturate(180%)'
      : 'blur(6px) saturate(140%)';
    warpI.style.webkitBackdropFilter = warpI.style.backdropFilter;
    warp.appendChild(warpI);
    el.insertBefore(warp, el.firstChild);
    s.warp = warp;
    s.warpI = warpI;

    // 双高光描边（screen 0.2 / overlay，mask-composite 1.5px 环）
    s.e1 = makeSpan('lg-edge lg-edge1');
    s.e2 = makeSpan('lg-edge lg-edge2');
    s.e1.style.background = edgeGradient(0, 0, 0.12, 0.4);
    s.e2.style.background = edgeGradient(0, 0, 0.32, 0.6);
    el.appendChild(s.e1);
    el.appendChild(s.e2);

    // hover/active 径向提亮（仅可点击）
    if (s.clickable) {
      s.o1 = makeSpan('lg-hov lg-hov1');
      s.o2 = makeSpan('lg-hov lg-hov2');
      s.o3 = makeSpan('lg-hov lg-hov3');
      el.appendChild(s.o1); el.appendChild(s.o2); el.appendChild(s.o3);
      bindEdgeOffset(s);
    }
    s.mounted = true;
  }

  function unmountGlass(s) {
    var el = s.el;
    ['warp', 'e1', 'e2', 'o1', 'o2', 'o3'].forEach(function (k) {
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
      s.prev = null;
    }
    el.style.transform = '';
    s.mounted = false;
  }

  function refreshGlassVisual(s) {
    // 尺寸变化 → 重新分桶生成贴图与滤镜
    var r = s.el.getBoundingClientRect();
    if (r.width < 4 || r.height < 4) return;
    var kind = s.opt.kind;
    var container = kind === 'bar' || kind === 'card' || kind === 'modal';
    var minSide = Math.min(r.width, r.height);
    var ds = container ? 25 : Math.max(20, Math.min(70, minSide * 0.7));
    var scale = Math.min(1, 480 / Math.max(r.width, r.height));
    var bw = Math.max(8, Math.round(r.width * scale / 24) * 24);
    var bh = Math.max(8, Math.round(r.height * scale / 24) * 24);
    if (bw === s.bw && bh === s.bh && Math.abs(ds - s.ds) < 0.5) return;
    s.bw = bw; s.bh = bh; s.ds = ds;
    s.warpI.style.filter = 'url(#' + filterIdFor(bw, bh, ds) + ')';
  }

  function applyTint(s) {
    if (!s.mounted) return;
    s.el.style.background = tintOf(s);
    var kind = s.opt.kind;
    if (kind === 'btn' || kind === 'glider') {
      var r = s.el.getBoundingClientRect();
      var minSide = Math.min(r.width, r.height);
      s.el.style.boxShadow = minSide < 40
        ? (isDark() ? '0px 6px 18px rgba(0,0,0,0.45)' : '0px 6px 18px rgba(0,0,0,0.20)')
        : (isDark() ? '0px 12px 40px rgba(0,0,0,0.50)' : '0px 12px 40px rgba(0,0,0,0.25)');
    }
  }

  /* ------------------------------------------------------------
     5. 注册表刷新
     ------------------------------------------------------------ */
  function refreshRegistry() {
    var seen = new Set();
    var list = [];
    for (var i = 0; i < SEL.length; i++) {
      var els = document.querySelectorAll(SEL[i][0]);
      for (var j = 0; j < els.length; j++) {
        var el = els[j];
        if (seen.has(el)) continue;
        seen.add(el);
        var r = el.getBoundingClientRect();
        if (r.width < 4 || r.height < 4) continue;
        list.push({ el: el, opt: SEL[i][1] });
      }
    }
    var activeSet = new Set(list.map(function (a) { return a.el; }));
    shapes = shapes.filter(function (s) {
      if (!activeSet.has(s.el) || !s.el.isConnected) {
        if (s.mounted) unmountGlass(s);
        s.el.classList.remove(s.opt.kind === 'btn' || s.opt.kind === 'glider' ? 'g-el' : 'g-card');
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
        shapes.push(s);
        shapesByEl.set(a.el, s);
        mountGlass(s);
        bindPointer(s);
        observeSize(s);
      } else if (!s.mounted) {
        mountGlass(s);
        observeSize(s);
      }
      a.el.classList.add(a.opt.kind === 'btn' || a.opt.kind === 'glider' ? 'g-el' : 'g-card');
      s.visible = true;
    }
  }

  var sizeRO = null;
  function observeSize(s) {
    if (!sizeRO) {
      sizeRO = new ResizeObserver(function (entries) {
        for (var i = 0; i < entries.length; i++) {
          var sh = shapesByEl.get(entries[i].target);
          if (sh && sh.mounted) refreshGlassVisual(sh);
        }
      });
    }
    sizeRO.observe(s.el);
  }

  /* ------------------------------------------------------------
     6. 弹簧系统 + 弹性吸附（统一帧循环写 transform）
     ------------------------------------------------------------ */
  var frameRAF = 0;
  var mouse = { x: 0, y: 0, t: 0 };

  function springAlive(s) {
    if (s.dragging) return true;
    return Math.abs(s.ox - s.tx) > 0.1 || Math.abs(s.vx) > 0.1 ||
           Math.abs(s.oy - s.ty) > 0.1 || Math.abs(s.vy) > 0.1 ||
           Math.abs(s.sc - s.ts) > 0.001 || Math.abs(s.vs) > 0.001 ||
           Math.abs(s.rot - s.rotT) > 0.002 || Math.abs(s.vrot) > 0.002 ||
           Math.abs(s.st - s.stT) > 0.002 || Math.abs(s.vst) > 0.002;
  }

  // 照抄 calculateDirectionalScale + calculateElasticTranslation（200px 激活区）
  function elasticTarget(s) {
    if (!mouse.x || !mouse.y || s.dragging) return null;
    var r = s.el.getBoundingClientRect();
    var cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    var dx = mouse.x - cx, dy = mouse.y - cy;
    var edx = Math.max(0, Math.abs(dx) - r.width / 2);
    var edy = Math.max(0, Math.abs(dy) - r.height / 2);
    var edgeDistance = Math.sqrt(edx * edx + edy * edy);
    var activationZone = 200;
    if (edgeDistance > activationZone) return null;
    var fadeInFactor = 1 - edgeDistance / activationZone;
    var centerDistance = Math.sqrt(dx * dx + dy * dy);
    if (centerDistance === 0) return null;
    var nx = dx / centerDistance, ny = dy / centerDistance;
    var elasticity = 0.15;
    var st = Math.min(centerDistance / 300, 1) * elasticity * fadeInFactor;
    return {
      sx: Math.max(0.8, 1 + Math.abs(nx) * st * 0.3 - Math.abs(ny) * st * 0.15),
      sy: Math.max(0.8, 1 + Math.abs(ny) * st * 0.3 - Math.abs(nx) * st * 0.15),
      tx: dx * elasticity * 0.1 * fadeInFactor,
      ty: dy * elasticity * 0.1 * fadeInFactor
    };
  }

  function writeTransform(s) {
    if (s.opt.kind !== 'btn') return;   // 容器/滑块不做 transform
    if (!s.dragging && s.ox === 0 && s.oy === 0 && s.sc === 1 &&
        s.esx === 1 && s.esy === 1 && s.etx === 0 && s.ety === 0 &&
        s.rot === 0 && s.st === 0) { s.el.style.transform = ''; return; }
    var sx = s.sc * s.esx, sy = s.sc * s.esy;
    var t = 'translate(' + (s.ox + s.etx).toFixed(2) + 'px,' + (s.oy + s.ety).toFixed(2) + 'px)';
    if (Math.abs(s.rot) > 1e-4) t += ' rotate(' + s.rot.toFixed(3) + 'rad)';
    if (s.st > 1e-3) {
      t += ' rotate(' + s.ang.toFixed(3) + 'rad) scale(' +
           (sx * (1 + s.st)).toFixed(4) + ',' + (sy * (1 - 0.55 * s.st)).toFixed(4) + ') rotate(' +
           (-s.ang).toFixed(3) + 'rad)';
    } else if (Math.abs(sx - 1) > 1e-4 || Math.abs(sy - 1) > 1e-4) {
      t += ' scale(' + sx.toFixed(4) + ',' + sy.toFixed(4) + ')';
    }
    s.el.style.transform = t;
  }

  function frame() {
    frameRAF = 0;
    var any = false;
    var mouseHot = performance.now() - mouse.t < 140;
    for (var i = 0; i < shapes.length; i++) {
      var s = shapes[i];
      if (!s.visible || !s.mounted || s.opt.kind !== 'btn') continue;
      var moved = false;
      // —— 弹簧步进 ——
      if (springAlive(s)) {
        any = true; moved = true;
        if (REDUCED) {
          s.ox = s.tx; s.oy = s.ty; s.sc = s.ts; s.rot = s.rotT; s.st = s.stT;
        } else {
          var K = 300, C = 22, KR = 240, CR = 18, dt = 1 / 60;
          s.vx += (-K * (s.ox - s.tx) - C * s.vx) * dt; s.ox += s.vx * dt;
          s.vy += (-K * (s.oy - s.ty) - C * s.vy) * dt; s.oy += s.vy * dt;
          s.vs += (-K * (s.sc - s.ts) - C * s.vs) * dt; s.sc += s.vs * dt;
          s.vrot += (-KR * (s.rot - s.rotT) - CR * s.vrot) * dt; s.rot += s.vrot * dt;
          s.vst += (-KR * (s.st - s.stT) - CR * s.vst) * dt; s.st += s.vst * dt;
        }
      }
      // —— 弹性吸附步进（lerp 向目标）——
      var et = s.clickable || s.opt.drag ? elasticTarget(s) : null;
      var tx2 = et ? et.sx : 1, ty2 = et ? et.sy : 1;
      var txx = et ? et.tx : 0, tyy = et ? et.ty : 0;
      if (Math.abs(s.esx - tx2) > 1e-4 || Math.abs(s.esy - ty2) > 1e-4 ||
          Math.abs(s.etx - txx) > 0.05 || Math.abs(s.ety - tyy) > 0.05) {
        any = true; moved = true;
        s.esx += (tx2 - s.esx) * 0.22;
        s.esy += (ty2 - s.esy) * 0.22;
        s.etx += (txx - s.etx) * 0.22;
        s.ety += (tyy - s.ety) * 0.22;
      } else if (s.esx !== 1 || s.esy !== 1 || s.etx !== 0 || s.ety !== 0) {
        s.esx = tx2; s.esy = ty2; s.etx = txx; s.ety = tyy; moved = true;
      }
      if (moved) writeTransform(s);
    }
    if (any || mouseHot) frameRAF = requestAnimationFrame(frame);
  }

  function kick() { if (!frameRAF) frameRAF = requestAnimationFrame(frame); }
  function springTo(s, x, y, sc) { s.tx = x; s.ty = y; s.ts = sc; kick(); }

  /* ------------------------------------------------------------
     7. 指针交互（按压放大 / 拖动回位 + 高光随动 + 提亮层）
     ------------------------------------------------------------ */
  function setOverlays(s, hover, active) {
    if (!s.o1) return;
    s.o1.style.opacity = (hover || active) ? 0.5 : 0;
    s.o2.style.opacity = active ? 0.5 : 0;
    s.o3.style.opacity = active ? 0.8 : (hover ? 0.4 : 0);
  }

  // 照抄：mouseOffset 驱动两条边缘高光的角度与透明度
  function bindEdgeOffset(s) {
    var el = s.el;
    el.addEventListener('mousemove', function (e) {
      var r = el.getBoundingClientRect();
      var mx = (e.clientX - (r.left + r.width / 2)) / r.width * 100;
      var my = (e.clientY - (r.top + r.height / 2)) / r.height * 100;
      if (s.e1) s.e1.style.background = edgeGradient(mx, my, 0.12, 0.4);
      if (s.e2) s.e2.style.background = edgeGradient(mx, my, 0.32, 0.6);
    });
  }

  function bindPointer(s) {
    var el = s.el;
    if (el.__glassBound) return;
    el.__glassBound = true;

    el.addEventListener('mouseenter', function () {
      if (s.opt.noPress || s.dragging) return;
      setOverlays(s, true, false);
      if (!s.opt.drag) springTo(s, s.tx, s.ty, 1.05);
      else kick();
    });
    el.addEventListener('mouseleave', function () {
      setOverlays(s, false, false);
      if (!s.dragging) springTo(s, s.tx, s.ty, 1);
      else kick();
    });

    if (s.opt.noPress) return;

    el.addEventListener('pointerdown', function (e) {
      if (e.button !== undefined && e.button !== 0) return;
      setOverlays(s, true, true);
      if (s.opt.drag) startDrag(s, e);
      else springTo(s, 0, 0, 1.10);
      kick();
    });
    window.addEventListener('pointerup', function () {
      if (s.dragging) return;
      setOverlays(s, false, false);
      springTo(s, 0, 0, 1);
    });
    el.addEventListener('pointercancel', function () {
      setOverlays(s, false, false);
      if (!s.dragging) springTo(s, 0, 0, 1);
    });
  }

  /* —— 可拖动按钮：按住放大 1.26 + 速度倾斜 + 果冻拉伸，松手弹簧回位 —— */
  function startDrag(s, e) {
    var el = s.el;
    var startX = e.clientX, startY = e.clientY;
    var moved = false;
    var lastX = e.clientX, lastY = e.clientY, lastT = performance.now();
    s.dragging = true;
    springTo(s, 0, 0, 1.26);

    function onMove(ev) {
      var dx = ev.clientX - startX, dy = ev.clientY - startY;
      if (!moved && Math.abs(dx) + Math.abs(dy) > 5) { moved = true; el.style.zIndex = '999'; }
      if (!moved) return;
      var now = performance.now();
      var dt = Math.max(now - lastT, 1);
      var vx = (ev.clientX - lastX) / dt * 1000;
      var vy = (ev.clientY - lastY) / dt * 1000;
      lastX = ev.clientX; lastY = ev.clientY; lastT = now;
      s.ox = dx; s.oy = dy; s.tx = dx; s.ty = dy;
      s.vx = s.vy = 0;
      var speed = Math.sqrt(vx * vx + vy * vy);
      s.rotT = Math.max(-0.14, Math.min(0.14, vx * 0.00045));
      s.stT = Math.min(speed * 0.00013, 0.14);
      if (speed > 60) s.ang = Math.atan2(vy, vx);
      writeTransform(s);
      kick();
    }
    function onUp() {
      window.removeEventListener('pointermove', onMove, true);
      window.removeEventListener('pointerup', onUp, true);
      window.removeEventListener('pointercancel', onUp, true);
      s.dragging = false;
      el.style.zIndex = '';
      s.rotT = 0; s.stT = 0;
      setOverlays(s, false, false);
      if (moved) {
        s.tx = 0; s.ty = 0; s.ts = 1;
        kick();
        var suppress = function (ce) { ce.stopImmediatePropagation(); ce.preventDefault(); cleanup(); };
        var cleanup = function () { el.removeEventListener('click', suppress, true); clearTimeout(suppressT); };
        var suppressT = setTimeout(cleanup, 500);
        el.addEventListener('click', suppress, true);
      } else {
        springTo(s, 0, 0, 1);
      }
    }
    window.addEventListener('pointermove', onMove, true);
    window.addEventListener('pointerup', onUp, true);
    window.addEventListener('pointercancel', onUp, true);
  }

  /* ------------------------------------------------------------
     8. 标签栏滑块 + scrub 手势
     ------------------------------------------------------------ */
  function initTabs() {
    var tabs = document.querySelector('.tabs');
    if (!tabs) return;
    var tabEls = Array.prototype.slice.call(tabs.querySelectorAll('.tab'));
    if (!tabEls.length) return;

    var glider = document.createElement('span');
    glider.className = 'tab-glider';
    glider.id = 'tabGlider';
    tabs.insertBefore(glider, tabs.firstChild);

    var g = { cx: 0, w: 0, vx: 0, tCx: 0, tW: 0, raf: 0, ready: false };

    function activeTab() {
      for (var i = 0; i < tabEls.length; i++) if (tabEls[i].classList.contains('active')) return tabEls[i];
      return tabEls[0];
    }
    function tabsRect() { return tabs.getBoundingClientRect(); }
    function tabRect(t) { return t.getBoundingClientRect(); }

    function setGlider(cx, w) {
      var tr = tabsRect();
      g.cx = cx; g.w = w;
      glider.style.left = (cx - w / 2 - tr.left) + 'px';
      glider.style.width = w + 'px';
    }

    function springGlider() {
      if (g.raf) return;
      g.raf = requestAnimationFrame(function step() {
        g.raf = 0;
        var K = 260, C = 24, dt = 1 / 60;
        var dx = g.tCx - g.cx, dw = g.tW - g.w;
        if (REDUCED || (Math.abs(dx) < 0.3 && Math.abs(g.vx) < 0.3 && Math.abs(dw) < 0.3)) {
          setGlider(g.tCx, g.tW);
          return;
        }
        g.vx += (K * dx - C * g.vx) * dt;
        setGlider(g.cx + g.vx * dt, g.w + dw * 0.22);
        g.raf = requestAnimationFrame(step);
      });
    }

    function syncToActive(animate) {
      var t = activeTab();
      if (!t) return;
      var r = tabRect(t);
      g.tCx = r.left + r.width / 2; g.tW = r.width;
      if (!g.ready || !animate) { g.cx = g.tCx; g.w = g.tW; g.vx = 0; setGlider(g.cx, g.w); g.ready = true; }
      else springGlider();
    }

    var mo = new MutationObserver(function () { syncToActive(true); });
    tabEls.forEach(function (t) { mo.observe(t, { attributes: true, attributeFilter: ['class'] }); });

    var scrub = null;
    tabs.addEventListener('pointerdown', function (e) {
      if (e.button !== undefined && e.button !== 0) return;
      var tr = tabsRect();
      scrub = {
        id: e.pointerId, startX: e.clientX, grabOff: e.clientX - g.cx,
        minCx: tr.left + 14, maxCx: tr.right - 14,
        moved: false, lastX: e.clientX, lastT: performance.now(), vel: 0
      };
      try { tabs.setPointerCapture(e.pointerId); } catch (err) {}
    });
    tabs.addEventListener('pointermove', function (e) {
      if (!scrub || e.pointerId !== scrub.id) return;
      var dx = e.clientX - scrub.startX;
      if (!scrub.moved && Math.abs(dx) > 4) {
        scrub.moved = true;
        if (g.raf) { cancelAnimationFrame(g.raf); g.raf = 0; }
      }
      if (!scrub.moved) return;
      var now = performance.now();
      var dt = Math.max(now - scrub.lastT, 1);
      scrub.vel = (e.clientX - scrub.lastX) / dt * 1000;
      scrub.lastX = e.clientX; scrub.lastT = now;
      var cx = Math.min(Math.max(e.clientX - scrub.grabOff, scrub.minCx), scrub.maxCx);
      var stretch = Math.min(Math.abs(scrub.vel) * 0.012, 14);
      setGlider(cx, g.tW + stretch);
      e.preventDefault();
    });
    function scrubEnd(e) {
      if (!scrub || (e.pointerId !== undefined && e.pointerId !== scrub.id)) return;
      var wasMoved = scrub.moved;
      scrub = null;
      if (!wasMoved) return;
      var best = null, bestD = 1e9;
      tabEls.forEach(function (t) {
        var r = tabRect(t);
        var d = Math.abs(r.left + r.width / 2 - g.cx);
        if (d < bestD) { bestD = d; best = t; }
      });
      if (best) {
        var r = tabRect(best);
        g.tCx = r.left + r.width / 2; g.tW = r.width;
        springGlider();
        if (!best.classList.contains('active')) best.click();
      }
      var suppress = function (ce) { ce.stopImmediatePropagation(); ce.preventDefault(); cleanup(); };
      var cleanup = function () { tabs.removeEventListener('click', suppress, true); clearTimeout(suppressT); };
      var suppressT = setTimeout(cleanup, 500);
      tabs.addEventListener('click', suppress, true);
      e.preventDefault();
    }
    tabs.addEventListener('pointerup', scrubEnd);
    tabs.addEventListener('pointercancel', scrubEnd);

    window.addEventListener('resize', function () { g.ready = false; syncToActive(false); });
    syncToActive(false);
    setTimeout(function () { syncToActive(false); }, 400);
  }

  /* ------------------------------------------------------------
     9. 事件编排（结构变化 → 重注册；深色切换 → 重刷奶洗）
     ------------------------------------------------------------ */
  var lastDark = false;

  function bindEvents() {
    var moT = 0;
    var mo = new MutationObserver(function (muts) {
      var relevant = false;
      for (var i = 0; i < muts.length; i++) {
        var m = muts[i], t = m.target;
        // —— 忽略引擎自身造成的变化（玻璃层插入/弹簧 transform/提亮层显隐）——
        if (t === document.body && m.type === 'attributes') continue;
        if (m.type === 'childList') {
          var onlyGlass = true;
          var nodes = m.addedNodes.length ? m.addedNodes : m.removedNodes;
          for (var n = 0; n < nodes.length; n++) {
            var nd = nodes[n];
            if (nd.nodeType !== 1) { onlyGlass = false; break; }
            var cn = nd.className;
            if (typeof cn !== 'string' ||
                !(cn.indexOf('lg-warp') === 0 || cn.indexOf('lg-edge') === 0 ||
                  cn.indexOf('lg-hov') === 0 || nd.tagName === 'svg')) { onlyGlass = false; break; }
          }
          if (onlyGlass && nodes.length) continue;
        }
        if (m.type === 'attributes' && m.attributeName === 'style' &&
            t.classList && (t.classList.contains('g-el') || t.id === 'tabGlider')) continue;
        relevant = true;
      }
      if (!relevant) return;
      clearTimeout(moT);
      moT = setTimeout(refreshRegistry, 100);
    });
    mo.observe(document.body, {
      childList: true, subtree: true,
      attributes: true, attributeFilter: ['class', 'style', 'open']
    });

    // 深色模式切换 → 重刷奶洗与外阴影
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
      rsT = setTimeout(refreshRegistry, 200);
    });
  }

  /* ------------------------------------------------------------
     10. 启动
     ------------------------------------------------------------ */
  function boot() {
    // filter:url(#svg) 支持性探测（Electron/Chromium 恒真；失败则保留原 CSS 设计）
    var ok = !!(window.CSS && CSS.supports && CSS.supports('filter', 'url(#lg_probe)'));
    if (!ok) { console.warn('[glass] SVG 滤镜不可用，玻璃效果停用'); return; }

    document.body.classList.add('glass-on');
    lastDark = isDark();

    initTabs();
    refreshRegistry();
    bindEvents();

    window.addEventListener('mousemove', function (e) {
      mouse.x = e.clientX; mouse.y = e.clientY; mouse.t = performance.now();
      kick();
    }, { passive: true });

    // 字体/视图就绪后兜底重注册（布局稳定）
    setTimeout(refreshRegistry, 300);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(refreshRegistry);
    window.addEventListener('load', function () { setTimeout(refreshRegistry, 200); });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

  // 调试钩子（capture 保留为 no-op，兼容 harness）
  window.Glass = {
    refresh: refreshRegistry,
    capture: function () {},
    shapes: function () { return shapes; },
    info: function () {
      return {
        count: shapes.length,
        filters: filterSeq,
        list: shapes.map(function (s) {
          return {
            sel: s.el.id || (typeof s.el.className === 'string' ? s.el.className.split(' ')[0] : '?'),
            kind: s.opt.kind, mounted: s.mounted, ds: +s.ds.toFixed(1), bw: s.bw, bh: s.bh
          };
        })
      };
    }
  };
})();
