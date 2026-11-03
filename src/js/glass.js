// ============================================================
//  液态玻璃（v1.1 原型定稿的 CSS / SVG 方案）
//  ------------------------------------------------------------
//  backdrop-filter: url(#位移滤镜) blur() saturate()
//  · 位移贴图按元素真实尺寸生成，斜面公式和原型一致
//  · 朝内采样：backdrop 只有元素自身范围，朝外会采到透明黑边
//  · 三通道分别位移 = 色散
//  用法：HTML 上写 data-glass="种类"
//    按钮类（自身就是玻璃）：clear / tint / blue / green / red / glider
//    容器类（里面还有玻璃按钮）：card / bar / tabs / sheet
//      容器不能自己挂 backdrop-filter —— 那样它会成为里面按钮的「背景根」，
//      按钮只能看到容器自己、看不到壁纸。所以给容器塞一个 .glass-bg 底层来挂滤镜
// ============================================================
var Glass = (function () {
  'use strict';

  var NS = 'http://www.w3.org/2000/svg';
  var CONTAINERS = { card: 1, bar: 1, tabs: 1, sheet: 1 };

  // 原型定稿参数
  var P = { refr: 0.6, edge: 0.6, chroma: 0.18, sat: 1.3 };

  // 每种玻璃：模糊(px)、折射倍率、斜面上限(px)、浅色/深色底色 [r,g,b,不透明度]
  var KIND = {
    clear:  { blur: 1.5, k: 1,   max: 36, l: [255, 255, 255, 0.09], d: [26, 28, 36, 0.28] },
    tint:   { blur: 1.5, k: 1,   max: 36, l: [10, 108, 255, 0.12], d: [77, 148, 255, 0.16] },
    blue:   { blur: 1.5, k: 1,   max: 36, l: [13, 115, 255, 0.72], d: [13, 107, 255, 0.66] },
    green:  { blur: 1.5, k: 1,   max: 36, l: [22, 186, 106, 0.74], d: [22, 170, 98, 0.66] },
    red:    { blur: 1.5, k: 1,   max: 36, l: [255, 69, 59, 0.68],  d: [255, 69, 59, 0.62] },
    glider: { blur: 1,   k: 1.3, max: 36, l: [255, 255, 255, 0.62], d: [255, 255, 255, 0.14] },
    tabs:   { blur: 12,  k: 0.5, max: 18, l: [255, 255, 255, 0.28], d: [22, 24, 32, 0.42] },
    card:   { blur: 18,  k: 0.5, max: 24, l: [255, 255, 255, 0.42], d: [22, 24, 32, 0.50] },
    bar:    { blur: 22,  k: 0.4, max: 18, l: [255, 255, 255, 0.46], d: [14, 15, 21, 0.55] },
    sheet:  { blur: 30,  k: 0.3, max: 24, l: [255, 255, 255, 0.74], d: [24, 26, 34, 0.80] }
  };

  var defs = null, seq = 0, items = [], quality = 'high', dark = false, ro = null;

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

  /* 贴图编码：R/G = 0.5 + 0.5·(朝内位移方向)·斜面强度 */
  function buildMap(w, h, radius, bevel) {
    var k = Math.min(1, 320 / Math.max(w, h));
    var mw = Math.max(8, Math.round(w * k)), mh = Math.max(8, Math.round(h * k));
    var cv = document.createElement('canvas');
    cv.width = mw; cv.height = mh;
    var ctx = cv.getContext('2d');
    var img = ctx.createImageData(mw, mh), D = img.data;
    var hw = w / 2, hh = h / 2, r = Math.min(radius, hw, hh);
    bevel = Math.max(1, bevel);
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
        var o = (y * mw + x) * 4;
        D[o] = Math.round((0.5 - 0.5 * nx * m) * 255);
        D[o + 1] = Math.round((0.5 - 0.5 * ny * m) * 255);
        D[o + 2] = 128;
        D[o + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    return cv.toDataURL();
  }

  function channel(i) {
    var v = ['0 0 0 0 0', '0 0 0 0 0', '0 0 0 0 0'];
    v[i] = ['1 0 0 0 0', '0 1 0 0 0', '0 0 1 0 0'][i];
    return v.join(' ') + ' 0 0 0 1 0';
  }

  function makeFilter(it, w, h, radius, bevel, amt) {
    var key = w + 'x' + h + '|' + radius.toFixed(1) + '|' + bevel.toFixed(1);
    var f = it.filter;
    if (!f) {
      f = it.filter = document.createElementNS(NS, 'filter');
      f.setAttribute('id', it.id);
      f.setAttribute('color-interpolation-filters', 'sRGB');
      f.setAttribute('filterUnits', 'userSpaceOnUse');
      f.setAttribute('primitiveUnits', 'userSpaceOnUse');
      ensureDefs().appendChild(f);
    }
    if (key !== it.key) {
      it.key = key;
      f.setAttribute('x', 0); f.setAttribute('y', 0);
      f.setAttribute('width', w); f.setAttribute('height', h);
      f.innerHTML =
        '<feImage href="' + buildMap(w, h, radius, bevel) + '" x="0" y="0" width="' + w + '" height="' + h + '" preserveAspectRatio="none" result="M"/>' +
        [0, 1, 2].map(function (i) {
          return '<feDisplacementMap in="SourceGraphic" in2="M" xChannelSelector="R" yChannelSelector="G" data-c="' + i + '" result="D' + i + '"/>' +
            '<feColorMatrix in="D' + i + '" type="matrix" values="' + channel(i) + '" result="C' + i + '"/>';
        }).join('') +
        '<feComposite in="C0" in2="C1" operator="arithmetic" k2="1" k3="1" result="RG"/>' +
        '<feComposite in="RG" in2="C2" operator="arithmetic" k2="1" k3="1"/>';
    }
    var maps = f.querySelectorAll('feDisplacementMap');
    for (var i = 0; i < maps.length; i++) {
      var c = +maps[i].getAttribute('data-c');
      maps[i].setAttribute('scale', (2 * amt * (c === 0 ? 1 + P.chroma : c === 2 ? 1 - P.chroma : 1)).toFixed(2));
    }
  }

  function update(it) {
    var kind = it.el.getAttribute('data-glass'), K = KIND[kind] || KIND.clear;
    var t = it.target, w = Math.round(t.offsetWidth), h = Math.round(t.offsetHeight);
    var c = dark ? K.d : K.l;
    it.el.classList.toggle('glass-colored', kind === 'blue' || kind === 'green' || kind === 'red');
    t.style.setProperty('--g-rgb', c[0] + ',' + c[1] + ',' + c[2]);
    t.style.setProperty('--g-a', c[3]);
    if (w < 4 || h < 4) return;          // 隐藏中的视图：等它显示出来 ResizeObserver 会再叫一次
    var radius = parseFloat(getComputedStyle(t).borderTopLeftRadius) || 0;
    var bevel = Math.min(P.edge * Math.min(w, h) / 2, K.max);
    var amt = P.refr * bevel * K.k;
    var refract = quality === 'high' || (quality === 'balanced' && !CONTAINERS[kind]);
    var v = '';
    if (refract && amt > 0.3) { makeFilter(it, w, h, radius, bevel, amt); v = 'url(#' + it.id + ') '; }
    v += 'blur(' + K.blur + 'px) saturate(' + Math.round(P.sat * 100) + '%)';
    t.style.backdropFilter = v;
    t.style.webkitBackdropFilter = v;
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
    var it = { el: el, target: target, id: 'lg' + (++seq), key: '', filter: null };
    el._glass = it;
    items.push(it);
    ro.observe(target);
    update(it);
    return it;
  }

  function init() {
    ro = new ResizeObserver(function (entries) {
      entries.forEach(function (e) {
        var it = items.find(function (x) { return x.target === e.target; });
        if (it) update(it);
      });
    });
    document.querySelectorAll('[data-glass]').forEach(register);
    document.body.classList.add('glass-on');
  }

  return {
    init: init,
    register: register,
    // 种类变了（打卡按钮 蓝 → 绿）或主题切换后调用
    refresh: function (el) { if (el) { if (el._glass) update(el._glass); } else items.forEach(update); },
    setDark: function (v) { dark = !!v; items.forEach(update); },
    setQuality: function (q) {
      quality = q;
      document.body.classList.toggle('glass-off', q === 'off');
      items.forEach(update);
    }
  };
})();
