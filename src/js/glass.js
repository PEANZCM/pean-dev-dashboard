// ============================================================
//  液态玻璃（v1.1 原型定稿的 CSS / SVG 方案）
//  ------------------------------------------------------------
//  backdrop-filter: url(#位移滤镜) blur() saturate()
//  · 位移贴图按元素真实尺寸生成，斜面公式和原型一致；同尺寸的按钮共用一个滤镜
//  · 朝内采样：backdrop 只有元素自身范围，朝外会采到透明黑边
//  · 三通道分别位移 = 色散
//  用法：HTML 上写 data-glass="种类"
//    按钮类（自身就是玻璃）：clear / tint / blue / green / red / glider / lens
//    容器类（里面还有玻璃按钮）：card / bar / tabs / sheet
//  容器玻璃的两个关键点：
//  1. 容器不能自己挂 backdrop-filter（会成为里面按钮的「背景根」，按钮只能看到容器、看不到壁纸），
//     所以给容器塞一个 .glass-bg 底层来挂滤镜
//  2. 底层的磨砂会挡在按钮和壁纸之间，按钮只能折射到一片模糊的白。
//     所以在底层上按每个按钮的形状挖洞（遮罩），洞跟着按钮的弹簧位移 / 拉伸一起动，
//     按钮就能透过卡片直接折射壁纸
// ============================================================
var Glass = (function () {
  'use strict';

  var NS = 'http://www.w3.org/2000/svg';
  var CONTAINERS = { card: 1, bar: 1, tabs: 1, sheet: 1 };

  // 原型定稿参数
  var P = { refr: 0.6, edge: 0.6, chroma: 0.18, sat: 1.3 };

  // 每种玻璃：模糊(px)、折射倍率、斜面上限(px)、浅色/深色底色 [r,g,b,不透明度]
  // 有色按钮不能太实：颜色是「染进玻璃里」的，背后的画面和折射要透得出来
  var KIND = {
    clear:  { blur: 2.5, k: 1,   max: 36, l: [255, 255, 255, 0.2], d: [26, 28, 36, 0.44] },
    tint:   { blur: 2.5, k: 1,   max: 36, l: [10, 108, 255, 0.2], d: [40, 90, 190, 0.42] },
    blue:   { blur: 1.5, k: 1.1, max: 36, l: [13, 115, 255, 0.50], d: [13, 107, 255, 0.48] },
    green:  { blur: 1.5, k: 1.1, max: 36, l: [22, 186, 106, 0.52], d: [22, 170, 98, 0.48] },
    red:    { blur: 1.5, k: 1.1, max: 36, l: [255, 69, 59, 0.50],  d: [255, 69, 59, 0.46] },
    glider: { blur: 1,   k: 1.3, max: 36, l: [255, 255, 255, 0.62], d: [255, 255, 255, 0.14] },
    lens:   { blur: 0.3, k: 1.2, max: 40, mag: 0.2, chroma: 0.08, l: [255, 255, 255, 0.05], d: [255, 255, 255, 0.04] },  // 滑块被拖起时：透明放大镜
    tabs:   { blur: 12,  k: 0.5, max: 18, l: [255, 255, 255, 0.28], d: [22, 24, 32, 0.42] },
    card:   { blur: 24,  k: 0.5, max: 24, l: [255, 255, 255, 0.48], d: [22, 24, 32, 0.56] },
    bar:    { blur: 22,  k: 0.4, max: 18, l: [255, 255, 255, 0.46], d: [14, 15, 21, 0.55] },
    sheet:  { blur: 30,  k: 0.3, max: 24, l: [255, 255, 255, 0.74], d: [24, 26, 34, 0.80] }
  };

  var defs = null, filters = {}, fseq = 0, items = [], quality = 'high', dark = false, ro = null;
  var dirtyHosts = new Set(), maskRaf = 0;

  function ensureDefs() {
    if (defs) return defs;
    var svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('aria-hidden', 'true');
    svg.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden;pointer-events:none';
    defs = document.createElementNS(NS, 'defs');
    svg.appendChild(defs);
    document.body.appendChild(svg);
    return defs;
  }

  /* 贴图编码：R/G = 0.5 + 0.5·(朝内位移方向)·强度
     普通玻璃只在边缘斜面折射；透镜（mag>0）再叠加从中心向外的线性位移 = 整体放大 1/(1-mag) 倍
     返回贴图和最大位移（像素），滤镜的 scale 按它换算 */
  function buildMap(w, h, radius, bevel, edgeAmt, mag) {
    var k = Math.min(1, 320 / Math.max(w, h));
    var mw = Math.max(8, Math.round(w * k)), mh = Math.max(8, Math.round(h * k));
    var cv = document.createElement('canvas');
    cv.width = mw; cv.height = mh;
    var ctx = cv.getContext('2d');
    var img = ctx.createImageData(mw, mh), D = img.data;
    var hw = w / 2, hh = h / 2, r = Math.min(radius, hw, hh);
    bevel = Math.max(1, bevel);
    var dx = new Float32Array(mw * mh), dy = new Float32Array(mw * mh), maxD = 0.001;
    for (var y = 0; y < mh; y++) {
      for (var x = 0; x < mw; x++) {
        var px = (x + 0.5) / mw * w - hw, py = (y + 0.5) / mh * h - hh;
        var wx = Math.abs(px) - (hw - r), wy = Math.abs(py) - (hh - r);
        var sx = px < 0 ? -1 : 1, sy = py < 0 ? -1 : 1;
        var mx = Math.max(wx, wy), d, nx, ny;
        if (mx > 0) {
          var qx = Math.max(wx, 0), qy = Math.max(wy, 0), l = Math.hypot(qx, qy) || 1;
          d = l - r; nx = sx * qx / l; ny = sy * qy / l;
        } else {
          d = mx - r;
          if (wx > wy) { nx = sx; ny = 0; } else { nx = 0; ny = sy; }
        }
        var t = Math.min(1, Math.max(0, -d / bevel));
        var m = d > 0 ? 0 : (1 - t) * (1 - t);
        var i = y * mw + x;
        dx[i] = -nx * m * edgeAmt - px * mag;
        dy[i] = -ny * m * edgeAmt - py * mag;
        maxD = Math.max(maxD, Math.abs(dx[i]), Math.abs(dy[i]));
      }
    }
    for (var j = 0; j < mw * mh; j++) {
      D[j * 4] = Math.round((0.5 + 0.5 * dx[j] / maxD) * 255);
      D[j * 4 + 1] = Math.round((0.5 + 0.5 * dy[j] / maxD) * 255);
      D[j * 4 + 2] = 128;
      D[j * 4 + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    return { url: cv.toDataURL(), maxD: maxD };
  }

  function channel(i) {
    var v = ['0 0 0 0 0', '0 0 0 0 0', '0 0 0 0 0'];
    v[i] = ['1 0 0 0 0', '0 1 0 0 0', '0 0 1 0 0'][i];
    return v.join(' ') + ' 0 0 0 1 0';
  }

  // 同样尺寸 / 圆角 / 强度的玻璃共用一个滤镜（编辑器里几十个同尺寸按钮不会生成几十份贴图）
  function filterFor(w, h, radius, bevel, amt, mag, chroma) {
    var key = w + 'x' + h + '|' + radius.toFixed(1) + '|' + bevel.toFixed(1) + '|' + amt.toFixed(1) + '|' + mag + '|' + chroma;
    if (filters[key]) return filters[key];
    var id = 'lg' + (++fseq);
    var f = document.createElementNS(NS, 'filter');
    f.setAttribute('id', id);
    f.setAttribute('color-interpolation-filters', 'sRGB');
    f.setAttribute('filterUnits', 'userSpaceOnUse');
    f.setAttribute('primitiveUnits', 'userSpaceOnUse');
    f.setAttribute('x', 0); f.setAttribute('y', 0);
    f.setAttribute('width', w); f.setAttribute('height', h);
    var map = buildMap(w, h, radius, bevel, amt, mag);
    f.innerHTML =
      '<feImage href="' + map.url + '" x="0" y="0" width="' + w + '" height="' + h + '" preserveAspectRatio="none" result="M"/>' +
      [0, 1, 2].map(function (i) {
        var s = 2 * map.maxD * (i === 0 ? 1 + chroma : i === 2 ? 1 - chroma : 1);
        return '<feDisplacementMap in="SourceGraphic" in2="M" scale="' + s.toFixed(2) + '" xChannelSelector="R" yChannelSelector="G" result="D' + i + '"/>' +
          '<feColorMatrix in="D' + i + '" type="matrix" values="' + channel(i) + '" result="C' + i + '"/>';
      }).join('') +
      '<feComposite in="C0" in2="C1" operator="arithmetic" k2="1" k3="1" result="RG"/>' +
      '<feComposite in="RG" in2="C2" operator="arithmetic" k2="1" k3="1"/>';
    ensureDefs().appendChild(f);
    return (filters[key] = id);
  }

  function update(it) {
    var kind = it.el.getAttribute('data-glass'), K = KIND[kind] || KIND.clear;
    var t = it.target, w = Math.round(t.offsetWidth), h = Math.round(t.offsetHeight);
    var c = dark ? K.d : K.l;
    it.el.classList.toggle('glass-colored', kind === 'blue' || kind === 'green' || kind === 'red');
    t.style.setProperty('--g-rgb', c[0] + ',' + c[1] + ',' + c[2]);
    t.style.setProperty('--g-a', c[3]);
    if (it.host) markHost(it.host);
    if (CONTAINERS[kind]) markHost(it);
    if (w < 4 || h < 4) return;          // 隐藏中的视图：等它显示出来 ResizeObserver 会再叫一次
    var radius = parseFloat(getComputedStyle(t).borderTopLeftRadius) || 0;
    var bevel = Math.min(P.edge * Math.min(w, h) / 2, K.max);
    var amt = P.refr * bevel * K.k;
    var refract = quality === 'high' || (quality === 'balanced' && !CONTAINERS[kind]);
    var v = refract && amt > 0.3 ? 'url(#' + filterFor(w, h, radius, bevel, amt, K.mag || 0, K.chroma != null ? K.chroma : P.chroma) + ') ' : '';
    v += 'blur(' + K.blur + 'px) saturate(' + Math.round(P.sat * 100) + '%)';
    if (v !== it.bf) { it.bf = v; t.style.backdropFilter = v; t.style.webkitBackdropFilter = v; }
  }

  /* ---------- 挖洞遮罩 ---------- */
  // 元素在宿主里的布局位置（不含 transform），并扣掉中间滚动容器的滚动量
  function layoutIn(el, host) {
    var x = 0, y = 0, n = el;
    while (n && n !== host) { x += n.offsetLeft; y += n.offsetTop; n = n.offsetParent; }
    for (var p = el.parentElement; p && p !== host; p = p.parentElement) { x -= p.scrollLeft; y -= p.scrollTop; }
    return { x: x, y: y, w: el.offsetWidth, h: el.offsetHeight };
  }

  function markHost(hostIt) {
    dirtyHosts.add(hostIt);
    if (!maskRaf) maskRaf = requestAnimationFrame(flushMasks);
  }

  function flushMasks() {
    maskRaf = 0;
    dirtyHosts.forEach(updateMask);
    dirtyHosts.clear();
  }

  function updateMask(hostIt) {
    var bg = hostIt.target, W = bg.offsetWidth, H = bg.offsetHeight;
    if (W < 4 || H < 4) return;
    // 滑块不挖洞：它变成透镜时要折射的正是下面的标签栏和文字，而不是最底下的壁纸
    var holes = items.filter(function (x) { return x.host === hostIt && x.el.offsetParent && !x.el.disabled && !x.el.classList.contains('tab-glider'); });
    if (!holes.length) { bg.style.webkitMaskImage = bg.style.maskImage = ''; return; }
    var shapes = holes.map(function (it) {
      var r = layoutIn(it.el, hostIt.el), xf = it.el._xf;
      var rad = Math.min(parseFloat(getComputedStyle(it.el).borderTopLeftRadius) || 0, r.w / 2, r.h / 2);
      var cx = r.x + r.w / 2, cy = r.y + r.h / 2;
      // 和元素自身的 transform 完全一致：以中心为原点的线性变换 + 平移
      var m = xf ? [xf.a, xf.b, xf.c, xf.d, cx + xf.tx - (xf.a * cx + xf.c * cy), cy + xf.ty - (xf.b * cx + xf.d * cy)] : null;
      return '<rect x="' + r.x.toFixed(1) + '" y="' + r.y.toFixed(1) + '" width="' + r.w + '" height="' + r.h + '" rx="' + rad.toFixed(1) + '"' +
        (m ? ' transform="matrix(' + m.map(function (v) { return v.toFixed(4); }).join(' ') + ')"' : '') + '/>';
    }).join('');
    var svg = '<svg xmlns="http://www.w3.org/2000/svg" width="' + W + '" height="' + H + '"><defs><mask id="m">' +
      '<rect width="' + W + '" height="' + H + '" fill="#fff"/><g fill="#000">' + shapes + '</g></mask></defs>' +
      '<rect width="' + W + '" height="' + H + '" fill="#fff" mask="url(#m)"/></svg>';
    var url = 'url("data:image/svg+xml,' + encodeURIComponent(svg) + '")';
    bg.style.webkitMaskImage = bg.style.maskImage = url;
    bg.style.webkitMaskSize = bg.style.maskSize = W + 'px ' + H + 'px';
    bg.style.webkitMaskRepeat = bg.style.maskRepeat = 'no-repeat';
  }

  function hostOf(el) {
    for (var p = el.parentElement; p; p = p.parentElement) if (p._glass && CONTAINERS[p.getAttribute('data-glass')]) return p._glass;
    return null;
  }

  function register(el) {
    if (el._glass) return el._glass;
    var kind = el.getAttribute('data-glass'), target = el;
    if (CONTAINERS[kind]) {
      target = document.createElement('div');
      target.className = 'glass-bg';
      el.insertBefore(target, el.firstChild);
      el.classList.add('glass-host');
    } else {
      el.classList.add('glass');
    }
    var it = { el: el, target: target, bf: '', host: null };
    el._glass = it;
    items.push(it);
    it.host = hostOf(el);
    ro.observe(target);
    if (it.host) ro.observe(el);
    update(it);
    return it;
  }

  function init() {
    ro = new ResizeObserver(function (entries) {
      entries.forEach(function (e) {
        var it = e.target._glass || (e.target.parentElement && e.target.parentElement._glass);
        if (it) update(it);
      });
    });
    // 先注册容器，再注册按钮，按钮才能找到自己所在的容器
    var all = Array.prototype.slice.call(document.querySelectorAll('[data-glass]'));
    all.filter(function (e) { return CONTAINERS[e.getAttribute('data-glass')]; }).forEach(register);
    all.filter(function (e) { return !CONTAINERS[e.getAttribute('data-glass')]; }).forEach(register);
    document.querySelectorAll('.sheet-body').forEach(function (b) {
      b.addEventListener('scroll', function () { var s = b.closest('.sheet'); if (s && s._glass) markHost(s._glass); }, { passive: true });
    });
    window.addEventListener('resize', function () { items.forEach(function (it) { if (CONTAINERS[it.el.getAttribute('data-glass')]) markHost(it); }); });
    document.body.classList.add('glass-on');
  }

  return {
    init: init,
    register: register,
    // 种类变了（打卡按钮 蓝 → 绿、滑块 → 透镜）或主题切换后调用
    refresh: function (el) { if (el) { if (el._glass) update(el._glass); } else items.forEach(update); },
    // 按钮的弹簧 transform 变了：它所在容器的洞跟着动
    moved: function (el) { var it = el._glass; if (it && it.host) markHost(it.host); },
    // 容器里的内容变了（重新渲染、编辑器加了按钮）
    relayout: function () {
      items = items.filter(function (it) { if (it.el.isConnected) return true; ro.unobserve(it.target); return false; });
      items.forEach(function (it) { if (CONTAINERS[it.el.getAttribute('data-glass')]) markHost(it); });
    },
    setDark: function (v) { dark = !!v; items.forEach(update); },
    setQuality: function (q) {
      quality = q;
      document.body.classList.toggle('glass-off', q === 'off');
      items.forEach(update);
    }
  };
})();
