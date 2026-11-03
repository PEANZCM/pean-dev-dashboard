// ============================================================
//  日期工具（本地时区，YYYY-MM-DD 字符串）
//  浏览器里挂到 window.Dates，Node 测试里 require
// ============================================================
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Dates = factory();
})(this, function () {
  'use strict';

  var MONTHS = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];
  var WEEKS = ['日', '一', '二', '三', '四', '五', '六'];

  function fmt(d) {
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  function parse(s) {
    var p = s.split('-');
    return new Date(parseInt(p[0], 10), parseInt(p[1], 10) - 1, parseInt(p[2], 10));
  }
  // now 可注入，方便测试
  function offset(days, now) {
    var d = now ? new Date(now) : new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + days);
    return fmt(d);
  }
  function today(now) { return offset(0, now); }
  function yesterday(now) { return offset(-1, now); }
  function dayBefore(now) { return offset(-2, now); }
  function cn(dateStr) {
    var d = parse(dateStr);
    return MONTHS[d.getMonth()] + d.getDate() + '日 周' + WEEKS[d.getDay()];
  }

  return { MONTHS: MONTHS, WEEKS: WEEKS, fmt: fmt, parse: parse, offset: offset, today: today, yesterday: yesterday, dayBefore: dayBefore, cn: cn };
});
