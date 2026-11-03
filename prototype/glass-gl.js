/* ============================================================
   WebGL 液态玻璃渲染器
   ------------------------------------------------------------
   1. 壁纸渲染进离屏纹理（程序化动态光斑 / 图片 cover 铺满），生成 mipmap
   2. 合成：逐像素遍历玻璃形状（圆角矩形 SDF），按边缘深度做
      折射偏移 + 三通道色散 + mipmap 模糊 + 染色 + 方向性高光边
   嵌套（卡片上的按钮）：子形状继承父形状的染色和模糊，
   不会出现“按钮背后看不到卡片”的问题
   ============================================================ */
(function (g) {
  'use strict';

  var MAX = 16;

  var VS = '#version 300 es\nin vec2 aPos;void main(){gl_Position=vec4(aPos,0.,1.);}';

  var WALL_FS = [
    '#version 300 es',
    'precision highp float;',
    'uniform vec2 uRes; uniform float uTime; uniform int uMode;',
    'uniform vec3 uBase; uniform vec3 uC[4];',
    'uniform sampler2D uImg; uniform float uImgAsp;',
    'out vec4 o;',
    'float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}',
    'void main(){',
    '  vec2 uv=gl_FragCoord.xy/uRes;',
    '  if(uMode==1){',
    '    float asp=uRes.x/uRes.y;',
    '    vec2 sc=asp>uImgAsp?vec2(1.,uImgAsp/asp):vec2(asp/uImgAsp,1.);',
    '    vec2 iu=(uv-.5)*sc+.5;',
    '    o=vec4(texture(uImg,vec2(iu.x,1.-iu.y)).rgb,1.);',
    '    return;',
    '  }',
    '  float asp=uRes.x/uRes.y; vec2 q=vec2(uv.x*asp,uv.y);',
    '  vec3 col=uBase;',
    '  for(int i=0;i<4;i++){',
    '    float fi=float(i);',
    '    vec2 c=vec2(.5*asp+.44*asp*sin(uTime*.07*(1.+fi*.31)+fi*1.7),',
    '                .5+.40*cos(uTime*.06*(1.+fi*.23)+fi*2.3));',
    '    float r=.34+.08*sin(uTime*.05+fi*1.3);',
    '    col=mix(col,uC[i],smoothstep(r*1.7,0.,length(q-c))*.85);',
    '  }',
    '  col+=(hash(gl_FragCoord.xy+fract(uTime))-.5)*.012;',
    '  o=vec4(col,1.);',
    '}'
  ].join('\n');

  var COMP_FS = [
    '#version 300 es',
    'precision highp float;',
    'uniform sampler2D uTex; uniform vec2 uRes; uniform int uN; uniform float uDpr;',
    'uniform vec4 uRect[' + MAX + '];',   // cx, cy, 半宽, 半高（设备像素，y 向下）
    'uniform vec4 uMat[' + MAX + '];',    // 逆线性变换 a b c d
    'uniform vec4 uTint[' + MAX + '];',   // rgb + 浓度
    'uniform vec4 uP[' + MAX + '];',      // 圆角, 折射位移, 斜面宽, 模糊 lod
    'uniform vec4 uQ[' + MAX + '];',      // 光晕 x y, 光晕强度, 高光增益
    'uniform vec4 uG;',                   // 色散, 高光, 阴影, 饱和度
    'uniform vec2 uLight;',
    'out vec4 o;',
    'vec3 wall(vec2 px,float lod){vec2 uv=px/uRes;uv.y=1.-uv.y;return textureLod(uTex,uv,lod).rgb;}',
    // 只用高层 mipmap 会出现方块感：在低半级上做 8 点环形采样，等效平滑高斯
    'float hash(vec2 p){return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453);}',
    'vec3 blurW(vec2 px,float lod){',
    '  if(lod<.6)return wall(px,lod);',
    '  float l=max(lod-1.,0.); float r=exp2(lod)*.9;',
    '  float j=hash(floor(px))*6.2832;',
    '  vec3 c=wall(px,l);',
    '  for(int k=0;k<6;k++){float a=float(k)*1.0472+j;vec2 d=vec2(cos(a),sin(a));',
    '    c+=wall(px+d*r*.5,l)+wall(px+d.yx*vec2(-1,1)*r,l);}',
    '  return c/13.;',
    '}',
    'vec3 sdg(vec2 p,vec2 b,float r){',
    '  vec2 w=abs(p)-(b-r);',
    '  vec2 s=vec2(p.x<0.?-1.:1.,p.y<0.?-1.:1.);',
    '  float m=max(w.x,w.y);',
    '  vec2 q=max(w,0.); float l=length(q);',
    '  vec2 gr=s*(m>0.?q/max(l,1e-4):(w.x>w.y?vec2(1,0):vec2(0,1)));',
    '  return vec3((m>0.?l:m)-r,gr);',
    '}',
    'void main(){',
    '  vec2 px=vec2(gl_FragCoord.x,uRes.y-gl_FragCoord.y);',
    '  vec3 col=wall(px,0.);',
    '  vec3 accK=vec3(1.),accB=vec3(0.); float accLod=0.;',
    '  for(int i=0;i<' + MAX + ';i++){',
    '    if(i>=uN)break;',
    '    vec4 R=uRect[i],M=uMat[i],P=uP[i],T=uTint[i],Q=uQ[i];',
    '    vec2 rel=px-R.xy;',
    '    vec2 lp=vec2(M.x*rel.x+M.z*rel.y,M.y*rel.x+M.w*rel.y);',
    '    float rad=min(P.x,min(R.z,R.w));',
    '    float mn=min(R.z,R.w);',
    '    if(uG.z>0.){',
    '      float sd=sdg(lp-vec2(0.,mn*.18+3.*uDpr),R.zw,rad).x;',
    '      float sh=uG.z*exp(-max(sd,0.)/(mn*.35+8.*uDpr));',
    '      col*=1.-sh*.45*smoothstep(-1.,1.,sdg(lp,R.zw,rad).x);',
    '    }',
    '    vec3 sg=sdg(lp,R.zw,rad);',
    '    float d=sg.x;',
    '    if(d>1.)continue;',
    '    vec2 n=normalize(vec2(M.x*sg.y+M.y*sg.z,M.z*sg.y+M.w*sg.z));',
    '    float t=clamp(-d/max(P.z,1.),0.,1.);',
    '    float m=(1.-t)*(1.-t);',
    '    vec2 off=-n*m*P.y;',
    '    float lod=P.w+accLod+m*.8;',
    '    float ch=uG.x*m;',
    '    vec3 c=blurW(px+off,lod);',
    '    if(ch>.002){c.r=blurW(px+off*(1.+ch),lod).r;c.b=blurW(px+off*(1.-ch),lod).b;}',
    '    c=c*accK+accB;',
    '    float L=dot(c,vec3(.299,.587,.114));',
    '    c=max(mix(vec3(L),c,uG.w),0.);',
    '    vec3 K=1.-T.a+1.35*T.a*T.rgb, B=.22*T.a*T.rgb;',
    '    c=c*K+B;',
    '    float lit=pow(max(dot(n,uLight),0.),2.);',
    '    float back=pow(max(dot(n,-uLight),0.),2.)*.45;',
    '    float hl=uG.y*(1.+Q.w);',
    '    float rim=smoothstep(1.4*uDpr+P.z*.06,0.,-d);',
    '    c+=rim*(.22+.78*lit+back)*hl;',
    '    c+=m*m*.07*hl*(.35+lit);',
    '    if(Q.z>0.){float gd=length(lp-Q.xy)/(mn*1.5);c+=Q.z*exp(-gd*gd)*.3;}',
    '    float a=clamp(.5-d,0.,1.);',
    '    col=mix(col,c,a);',
    '    accK=mix(accK,accK*K,a); accB=mix(accB,accB*K+B,a); accLod+=P.w*a*.6;',
    '  }',
    '  o=vec4(col,1.);',
    '}'
  ].join('\n');

  function compile(gl, type, src) {
    var s = gl.createShader(type);
    gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
    return s;
  }
  function program(gl, fs) {
    var p = gl.createProgram();
    gl.attachShader(p, compile(gl, gl.VERTEX_SHADER, VS));
    gl.attachShader(p, compile(gl, gl.FRAGMENT_SHADER, fs));
    gl.bindAttribLocation(p, 0, 'aPos');
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    var u = {}, n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
    for (var i = 0; i < n; i++) {
      var name = gl.getActiveUniform(p, i).name.replace(/\[0\]$/, '');
      u[name] = gl.getUniformLocation(p, name);
    }
    return { p: p, u: u };
  }

  function GLGlass(canvas) {
    var gl = canvas.getContext('webgl2', { antialias: false, alpha: false, preserveDrawingBuffer: false });
    if (!gl) throw new Error('WebGL2 不可用');
    this.gl = gl; this.canvas = canvas;
    this.wallP = program(gl, WALL_FS);
    this.compP = program(gl, COMP_FS);
    var buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    this.tex = gl.createTexture();
    this.fbo = gl.createFramebuffer();
    this.img = gl.createTexture();
    this.imgAsp = 1;
    this.mode = 0; this.preset = null; this.wallDirty = true;
    this.w = 0; this.h = 0;
    this.arr = {
      rect: new Float32Array(MAX * 4), mat: new Float32Array(MAX * 4),
      tint: new Float32Array(MAX * 4), p: new Float32Array(MAX * 4), q: new Float32Array(MAX * 4)
    };
  }

  GLGlass.MAX = MAX;

  GLGlass.prototype.resize = function (w, h) {
    if (w === this.w && h === this.h) return;
    var gl = this.gl;
    this.w = w; this.h = h;
    this.canvas.width = w; this.canvas.height = h;
    gl.bindTexture(gl.TEXTURE_2D, this.tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.tex, 0);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    this.wallDirty = true;
  };

  /* preset：{ base:[r,g,b], colors:[[r,g,b]×4], animated } */
  GLGlass.prototype.setPreset = function (preset) {
    this.mode = 0; this.preset = preset; this.wallDirty = true;
  };

  GLGlass.prototype.setImage = function (source) {
    var gl = this.gl;
    gl.bindTexture(gl.TEXTURE_2D, this.img);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    this.imgAsp = source.width / source.height;
    this.mode = 1; this.wallDirty = true;
  };

  GLGlass.prototype.renderWall = function (time) {
    var gl = this.gl, P = this.wallP;
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbo);
    gl.viewport(0, 0, this.w, this.h);
    gl.useProgram(P.p);
    gl.uniform2f(P.u.uRes, this.w, this.h);
    gl.uniform1f(P.u.uTime, time);
    gl.uniform1i(P.u.uMode, this.mode);
    if (this.mode === 0 && this.preset) {
      gl.uniform3fv(P.u.uBase, this.preset.base);
      gl.uniform3fv(P.u.uC, [].concat.apply([], this.preset.colors));
    } else {
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, this.img);
      gl.uniform1i(P.u.uImg, 1);
      gl.uniform1f(P.u.uImgAsp, this.imgAsp);
    }
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.tex);
    gl.generateMipmap(gl.TEXTURE_2D);
    this.wallDirty = false;
  };

  /* shapes：[{ cx, cy, hw, hh, m:[a,b,c,d], tint:[r,g,b,a], radius, refr, bevel, lod, gx, gy, glow, boost }]
     坐标全部为设备像素；g：{ chroma, rim, shadow, sat, light:[x,y] } */
  GLGlass.prototype.render = function (time, animated, shapes, g) {
    var gl = this.gl;
    if (animated || this.wallDirty) this.renderWall(time);
    var A = this.arr, n = Math.min(shapes.length, MAX);
    for (var i = 0; i < n; i++) {
      var s = shapes[i], o = i * 4;
      A.rect[o] = s.cx; A.rect[o + 1] = s.cy; A.rect[o + 2] = s.hw; A.rect[o + 3] = s.hh;
      A.mat.set(s.m, o);
      A.tint.set(s.tint, o);
      A.p[o] = s.radius; A.p[o + 1] = s.refr; A.p[o + 2] = s.bevel; A.p[o + 3] = s.lod;
      A.q[o] = s.gx; A.q[o + 1] = s.gy; A.q[o + 2] = s.glow; A.q[o + 3] = s.boost;
    }
    var P = this.compP;
    gl.viewport(0, 0, this.w, this.h);
    gl.useProgram(P.p);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.tex);
    gl.uniform1i(P.u.uTex, 0);
    gl.uniform2f(P.u.uRes, this.w, this.h);
    gl.uniform1i(P.u.uN, n);
    gl.uniform1f(P.u.uDpr, g.dpr);
    gl.uniform4fv(P.u.uRect, A.rect);
    gl.uniform4fv(P.u.uMat, A.mat);
    gl.uniform4fv(P.u.uTint, A.tint);
    gl.uniform4fv(P.u.uP, A.p);
    gl.uniform4fv(P.u.uQ, A.q);
    gl.uniform4f(P.u.uG, g.chroma, g.rim, g.shadow, g.sat);
    gl.uniform2f(P.u.uLight, g.light[0], g.light[1]);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  };

  g.GLGlass = GLGlass;
})(window);
