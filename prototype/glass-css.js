/* ============================================================
   CSS / SVG 液态玻璃
   ------------------------------------------------------------
   backdrop-filter: url(#位移滤镜) blur() saturate()
   · 位移贴图按元素真实尺寸生成（不分桶），和 WebGL 版同一套斜面公式
   · 位移方向朝内采样：backdrop 只有元素自身范围，朝外采样会采到透明黑边
   · 三通道分别位移 = 色散
   能折射它背后的一切 DOM（包括文字），这是 WebGL 版做不到的
   ============================================================ */
(function (g) {
  'use strict';

  var NS = 'http://www.w3.org/2000/svg';
  var defs = null, seq = 0;

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
    v[i] = i === 0 ? '1 0 0 0 0' : i === 1 ? '0 1 0 0 0' : '0 0 1 0 0';
    return v.join(' ') + ' 0 0 0 1 0';
  }

  function CSSGlass(el) {
    this.el = el;
    this.id = 'lgc' + (++seq);
    this.key = '';
    this.filter = null;
  }

  /* o：{ w, h, radius, bevel, amt, chroma, blur, sat }（像素）—— 尺寸/斜面变化才重建贴图 */
  CSSGlass.prototype.update = function (o) {
    var w = Math.round(o.w), h = Math.round(o.h);
    var key = w + 'x' + h + '|' + o.radius.toFixed(1) + '|' + o.bevel.toFixed(1);
    var s = 2 * o.amt;
    if (key !== this.key) {
      this.key = key;
      var map = buildMap(w, h, o.radius, o.bevel);
      var f = this.filter;
      if (!f) {
        f = this.filter = document.createElementNS(NS, 'filter');
        f.setAttribute('id', this.id);
        f.setAttribute('color-interpolation-filters', 'sRGB');
        f.setAttribute('filterUnits', 'userSpaceOnUse');
        f.setAttribute('primitiveUnits', 'userSpaceOnUse');
        ensureDefs().appendChild(f);
      }
      f.setAttribute('x', 0); f.setAttribute('y', 0);
      f.setAttribute('width', w); f.setAttribute('height', h);
      f.innerHTML =
        '<feImage href="' + map + '" x="0" y="0" width="' + w + '" height="' + h + '" preserveAspectRatio="none" result="M"/>' +
        [0, 1, 2].map(function (i) {
          return '<feDisplacementMap in="SourceGraphic" in2="M" xChannelSelector="R" yChannelSelector="G" data-c="' + i + '" result="D' + i + '"/>' +
            '<feColorMatrix in="D' + i + '" type="matrix" values="' + channel(i) + '" result="C' + i + '"/>';
        }).join('') +
        '<feComposite in="C0" in2="C1" operator="arithmetic" k2="1" k3="1" result="RG"/>' +
        '<feComposite in="RG" in2="C2" operator="arithmetic" k2="1" k3="1"/>';
    }
    var maps = this.filter.querySelectorAll('feDisplacementMap');
    for (var i = 0; i < maps.length; i++) {
      var c = +maps[i].getAttribute('data-c');
      var mul = c === 0 ? 1 + o.chroma : c === 2 ? 1 - o.chroma : 1;
      maps[i].setAttribute('scale', (s * mul).toFixed(2));
    }
    var v = 'url(#' + this.id + ') blur(' + o.blur.toFixed(1) + 'px) saturate(' + Math.round(o.sat * 100) + '%)';
    this.el.style.backdropFilter = v;
    this.el.style.webkitBackdropFilter = v;
  };

  g.CSSGlass = CSSGlass;
})(window);
