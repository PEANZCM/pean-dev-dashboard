// ============================================================
//  壁纸：玻璃需要背后有东西可以折射
//  · 预设：WebGL 绘制缓慢流动的彩色光斑（半分辨率、30 帧，几乎不占性能）
//  · 自选图片：主进程复制一份到数据目录，铺满窗口
//  · 跟随主题：浅色用「晨雾」，深色用「极光」
// ============================================================
var Wallpaper = (function () {
  'use strict';

  var PRESETS = {
    dawn:   { name: '晨雾', base: [0.93, 0.92, 0.96], colors: [[1, 0.74, 0.58], [0.98, 0.6, 0.74], [0.58, 0.7, 1], [0.62, 0.9, 0.82]] },
    aurora: { name: '极光', base: [0.04, 0.05, 0.11], colors: [[0.16, 0.36, 0.96], [0.56, 0.26, 0.92], [0.08, 0.72, 0.68], [0.92, 0.34, 0.6]] },
    sunset: { name: '日落', base: [0.18, 0.07, 0.16], colors: [[1, 0.48, 0.2], [0.94, 0.26, 0.46], [0.48, 0.2, 0.72], [1, 0.76, 0.32]] },
    ocean:  { name: '深海', base: [0.02, 0.07, 0.14], colors: [[0, 0.44, 0.72], [0.08, 0.7, 0.8], [0.2, 0.3, 0.9], [0.04, 0.2, 0.42]] },
    mint:   { name: '薄荷', base: [0.9, 0.96, 0.94], colors: [[0.55, 0.88, 0.78], [0.62, 0.8, 1], [0.98, 0.86, 0.6], [0.78, 0.7, 0.98]] }
  };

  var VS = '#version 300 es\nin vec2 aPos;void main(){gl_Position=vec4(aPos,0.,1.);}';
  var FS = [
    '#version 300 es',
    'precision highp float;',
    'uniform vec2 uRes; uniform float uTime; uniform vec3 uBase; uniform vec3 uC[4];',
    'out vec4 o;',
    'float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}',
    'void main(){',
    '  vec2 uv=gl_FragCoord.xy/uRes; float asp=uRes.x/uRes.y; vec2 q=vec2(uv.x*asp,uv.y);',
    '  vec3 col=uBase;',
    '  for(int i=0;i<4;i++){',
    '    float fi=float(i);',
    '    vec2 c=vec2(.5*asp+.44*asp*sin(uTime*.07*(1.+fi*.31)+fi*1.7),.5+.40*cos(uTime*.06*(1.+fi*.23)+fi*2.3));',
    '    float r=.34+.08*sin(uTime*.05+fi*1.3);',
    '    col=mix(col,uC[i],smoothstep(r*1.7,0.,length(q-c))*.85);',
    '  }',
    '  col+=(hash(gl_FragCoord.xy+fract(uTime))-.5)*.012;',
    '  o=vec4(col,1.);',
    '}'
  ].join('\n');

  var canvas, imgEl, gl = null, prog, u = {}, preset = null, animated = true, raf = 0, t0 = performance.now(), lastDraw = 0;

  function setupGL() {
    gl = canvas.getContext('webgl2', { antialias: false, alpha: false, powerPreference: 'low-power' });
    if (!gl) return false;
    function sh(type, src) {
      var s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
      return s;
    }
    prog = gl.createProgram();
    gl.attachShader(prog, sh(gl.VERTEX_SHADER, VS));
    gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FS));
    gl.bindAttribLocation(prog, 0, 'aPos');
    gl.linkProgram(prog);
    ['uRes', 'uTime', 'uBase', 'uC'].forEach(function (n) { u[n] = gl.getUniformLocation(prog, n); });
    var buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    return true;
  }

  function resize() {
    // 光斑本身就很糊，半分辨率看不出区别
    var w = Math.max(2, Math.round(innerWidth * 0.5)), h = Math.max(2, Math.round(innerHeight * 0.5));
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
    draw(performance.now());
  }

  function draw(now) {
    if (!gl || !preset) return;
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.useProgram(prog);
    gl.uniform2f(u.uRes, canvas.width, canvas.height);
    gl.uniform1f(u.uTime, (now - t0) / 1000 + 40);
    gl.uniform3fv(u.uBase, preset.base);
    gl.uniform3fv(u.uC, [].concat.apply([], preset.colors));
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  function loop(now) {
    raf = 0;
    if (!animated || !preset || document.hidden) return;
    if (now - lastDraw > 33) { lastDraw = now; draw(now); }
    raf = requestAnimationFrame(loop);
  }
  function restart() { if (!raf && animated && preset) raf = requestAnimationFrame(loop); }

  return {
    PRESETS: PRESETS,
    init: function () {
      canvas = document.getElementById('wallCanvas');
      imgEl = document.getElementById('wallImage');
      try { setupGL(); } catch (e) { console.error('wallpaper gl', e); gl = null; }
      window.addEventListener('resize', resize);
      document.addEventListener('visibilitychange', restart);
      resize();
    },
    /* name：auto | 预设名 | image | plain；image 时 src 为图片 dataURL */
    set: function (name, dark, src) {
      var key = name === 'auto' ? (dark ? 'aurora' : 'dawn') : name;
      document.body.classList.toggle('wall-on', key !== 'plain');
      if (key === 'image' && src) {
        preset = null;
        canvas.style.display = 'none';
        imgEl.style.backgroundImage = 'url("' + src + '")';
        imgEl.style.display = 'block';
        return;
      }
      imgEl.style.display = 'none';
      preset = PRESETS[key] || null;
      canvas.style.display = preset && gl ? 'block' : 'none';
      if (!preset || !gl) document.body.classList.remove('wall-on');
      draw(performance.now());
      restart();
    },
    setAnimated: function (v) { animated = !!v; restart(); }
  };
})();
