/* ============================================================
   弹簧物理（SwiftUI 式参数）
   response：一次振荡的周期（秒），越小越快
   damping ：阻尼比，1 = 不过冲，0.7 ≈ 一次轻微回弹
   固定 240Hz 子步积分，掉帧时也不会发散
   ============================================================ */
(function (g) {
  'use strict';

  var SUB = 1 / 240;

  function Spring(value, response, damping) {
    this.x = value; this.v = 0; this.target = value;
    this.response = response || 0.35;
    this.damping = damping == null ? 0.8 : damping;
  }

  Spring.prototype.tune = function (response, damping) {
    this.response = response; this.damping = damping;
    return this;
  };

  Spring.prototype.step = function (dt) {
    var w = 2 * Math.PI / Math.max(this.response, 0.02);
    var k = w * w, c = 2 * this.damping * w;
    var n = Math.max(1, Math.ceil(dt / SUB)), h = dt / n;
    for (var i = 0; i < n; i++) {
      this.v += (-k * (this.x - this.target) - c * this.v) * h;
      this.x += this.v * h;
    }
  };

  Spring.prototype.jump = function (x, v) {
    this.x = this.target = x; this.v = v || 0;
  };

  g.Spring = Spring;
})(window);
