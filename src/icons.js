// ============================================================
//  SVG 图标系统 · PEAN的开发小天地
//  24×24 网格 · 1.8px 圆角描边 · currentColor 继承文字色
//  用法：HTML 里 <svg class="ic"><use href="#i-flame"/></svg>
//        JS 里  iconSvg('flame') / iconSvg('check','big')
//  尺寸由所在语境的 font-size 驱动（1em），无需逐个设宽高
// ============================================================
(function(){
'use strict';

/* 渐变定义：品牌渐变 / 火焰渐变 */
var DEFS=
'<defs>'+
  '<linearGradient id="gradBrand" x1="0" y1="0" x2="1" y2="1">'+
    '<stop offset="0" stop-color="#0A6CFF"/>'+
    '<stop offset=".5" stop-color="#5B5BF0"/>'+
    '<stop offset="1" stop-color="#A855F7"/>'+
  '</linearGradient>'+
  '<linearGradient id="gradFlame" x1="0" y1="1" x2="0" y2="0">'+
    '<stop offset="0" stop-color="#FF3B30"/>'+
    '<stop offset=".55" stop-color="#FF7A00"/>'+
    '<stop offset="1" stop-color="#FFB340"/>'+
  '</linearGradient>'+
'</defs>';

/* 通用描边包裹 */
function s(inner){return '<g fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">'+inner+'</g>';}

var SYMBOLS=
/* —— 品牌 Logo：打开的书 + 渐变描边 —— */
'<symbol id="i-logo" viewBox="0 0 24 24"><g fill="none" stroke="url(#gradBrand)" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">'+
  '<path d="M12 6.4C10 4.9 7.2 4.6 4.5 5.6c-.4.14-.7.5-.7.96v11.3c0 .6.6 1 1.15.8C7.5 17.7 10 18 12 19.3c2-1.3 4.5-1.6 7.05-.66.55.2 1.15-.2 1.15-.8V6.56c0-.45-.3-.82-.7-.96C16.8 4.6 14 4.9 12 6.4Z"/>'+
  '<path d="M12 6.4v12.9"/></g></symbol>'+

/* —— 奖章：绶带 + 圆牌（奖章墙 / 各 tier 通用，底色区分等级） —— */
'<symbol id="i-medal" viewBox="0 0 24 24">'+s(
  '<path d="M8.6 10.8 5.8 3.4h4.4l1.8 3.6 1.8-3.6h4.4l-2.8 7.4"/>'+
  '<circle cx="12" cy="15.4" r="5.4"/>'+
  '<path d="M12 13.2l.85 1.72 1.9.28-1.38 1.34.33 1.9L12 17.55l-1.7.9.33-1.9-1.38-1.35 1.9-.28L12 13.2Z" fill="currentColor" stroke="none"/>')+'</symbol>'+

/* —— 设置齿轮 —— */
'<symbol id="i-settings" viewBox="0 0 24 24">'+s(
  '<circle cx="12" cy="12" r="3.1"/>'+
  '<path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h.01a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51h.01a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v.01a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z"/>')+'</symbol>'+

/* —— 日历 —— */
'<symbol id="i-calendar" viewBox="0 0 24 24">'+s(
  '<rect x="3.5" y="5" width="17" height="16" rx="3"/>'+
  '<path d="M8 3v4M16 3v4M3.5 10h17"/>')+'</symbol>'+

/* —— 完成（圆圈内打勾） —— */
'<symbol id="i-check-circle" viewBox="0 0 24 24">'+s(
  '<circle cx="12" cy="12" r="8.6"/>'+
  '<path d="M8.2 12.4l2.6 2.6 5-5.4"/>')+'</symbol>'+

/* —— 打勾（粗） —— */
'<symbol id="i-check" viewBox="0 0 24 24"><g fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round">'+
  '<path d="M4.5 12.6l5 5 10-11.2"/></g></symbol>'+

/* —— 火焰（渐变填充 + 内核高光） —— */
'<symbol id="i-flame" viewBox="0 0 24 24">'+
  '<path fill="url(#gradFlame)" stroke="none" d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.07-2.14-.22-4.05 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.15.43-2.3 1-3a2.5 2.5 0 0 0 2.5 2.5Z"/>'+
  '<path fill="rgba(255,255,255,.38)" stroke="none" d="M12 21.6a3.6 3.6 0 0 1-3.6-3.6c0-1.5.8-2.7 1.7-3.6.3 1 .9 1.6 1.4 1.6-.3-1.5.2-3 1.5-4.2 1.5 1.4 2.6 3.4 2.6 6.2a3.6 3.6 0 0 1-3.6 3.6Z"/>'+
'</symbol>'+

/* —— 打开的书（打卡按钮） —— */
'<symbol id="i-book" viewBox="0 0 24 24"><g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">'+
  '<path d="M2.5 4.5h6a4 4 0 0 1 4 4v12a3 3 0 0 0-3-3h-7v-13Z"/>'+
  '<path d="M21.5 4.5h-6a4 4 0 0 0-4 4v12a3 3 0 0 1 3-3h7v-13Z"/></g></symbol>'+

/* —— 上箭头（补打） —— */
'<symbol id="i-arrow-up" viewBox="0 0 24 24"><g fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">'+
  '<path d="M12 19.5v-14M5.5 12 12 5.5 18.5 12"/></g></symbol>'+

/* —— 关闭 —— */
'<symbol id="i-close" viewBox="0 0 24 24"><g fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round">'+
  '<path d="M6 6l12 12M18 6 6 18"/></g></symbol>'+

/* —— 灯泡（提示） —— */
'<symbol id="i-info" viewBox="0 0 24 24">'+s('<circle cx="12" cy="12" r="9"/><path d="M12 11v5"/><path d="M12 8h.01"/>')+'</symbol>'+
'<symbol id="i-bulb" viewBox="0 0 24 24">'+s(
  '<path d="M12 3a6.2 6.2 0 0 0-4 10.9c.8.7 1 1.6 1 2.6h6c0-1 .2-1.9 1-2.6A6.2 6.2 0 0 0 12 3Z"/>'+
  '<path d="M9.5 20h5M10.5 22.5h3"/>')+'</symbol>'+

/* —— 铅笔（编辑） —— */
'<symbol id="i-edit" viewBox="0 0 24 24">'+s(
  '<path d="M17 3.2a2.83 2.83 0 1 1 4 4L7.7 20.5 2 22l1.5-5.7L17 3.2Z"/>')+'</symbol>'+

/* —— 眼睛（预览） —— */
'<symbol id="i-eye" viewBox="0 0 24 24">'+s(
  '<path d="M2.5 12S6 5.2 12 5.2 21.5 12 21.5 12 18 18.8 12 18.8 2.5 12 2.5 12Z"/>'+
  '<circle cx="12" cy="12" r="3"/>')+'</symbol>'+

/* —— 相机（截图） —— */
'<symbol id="i-camera" viewBox="0 0 24 24">'+s(
  '<path d="M4 7.5h3l2-2.7h6l2 2.7h3a1.5 1.5 0 0 1 1.5 1.5v10a1.5 1.5 0 0 1-1.5 1.5H4a1.5 1.5 0 0 1-1.5-1.5V9A1.5 1.5 0 0 1 4 7.5Z"/>'+
  '<circle cx="12" cy="13.4" r="3.4"/>')+'</symbol>'+

/* —— 电波（资讯） —— */
'<symbol id="i-radio" viewBox="0 0 24 24">'+s(
  '<circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none"/>'+
  '<path d="M7.8 7.8a6 6 0 0 0 0 8.4M16.2 7.8a6 6 0 0 1 0 8.4"/>'+
  '<path d="M5 5a10.4 10.4 0 0 0 0 14M19 5a10.4 10.4 0 0 1 0 14"/>')+'</symbol>'+

/* —— 刷新 —— */
'<symbol id="i-refresh" viewBox="0 0 24 24"><g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">'+
  '<path d="M21 12a9 9 0 1 1-2.64-6.36"/>'+
  '<path d="M21 3.5v5h-5"/></g></symbol>'+

/* —— 对话气泡（名言） —— */
'<symbol id="i-quote" viewBox="0 0 24 24">'+s(
  '<path d="M20.5 11.5a8.5 8.5 0 0 1-8.5 8.5c-1.5 0-2.9-.4-4.1-1L3 20l1-4.9a8.5 8.5 0 1 1 16.5-3.6Z"/>')+'</symbol>'+

/* —— 加号 —— */
'<symbol id="i-plus" viewBox="0 0 24 24"><g fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round">'+
  '<path d="M12 5.5v13M5.5 12h13"/></g></symbol>'+

/* —— 返回箭头 —— */
'<symbol id="i-back" viewBox="0 0 24 24"><g fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">'+
  '<path d="M19.5 12h-14M11.5 18.5 5 12l6.5-6.5"/></g></symbol>'+

/* —— 导出（保存） —— */
'<symbol id="i-save" viewBox="0 0 24 24">'+s(
  '<path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2Z"/>'+
  '<path d="M17 21v-8H7v8M7 3v5h8"/>')+'</symbol>'+

/* —— 导入（文件夹） —— */
'<symbol id="i-folder" viewBox="0 0 24 24">'+s(
  '<path d="M3 7.5a2 2 0 0 1 2-2h4.2l2 3h7.8a2 2 0 0 1 2 2V18a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7.5Z"/>')+'</symbol>'+

/* —— 奖杯（大满贯 / 金奖章） —— */
'<symbol id="i-trophy" viewBox="0 0 24 24">'+s(
  '<path d="M8 21h8M12 16.8V21"/>'+
  '<path d="M7 3.5h10V10a5 5 0 0 1-10 0V3.5Z"/>'+
  '<path d="M7 5.5H4.2a1 1 0 0 0-1 1c0 2.6 1.8 4.2 3.8 4.2M17 5.5h2.8a1 1 0 0 1 1 1c0 2.6-1.8 4.2-3.8 4.2"/>')+'</symbol>'+

/* —— 火箭（阶段 0） —— */
'<symbol id="i-rocket" viewBox="0 0 24 24">'+s(
  '<path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09Z"/>'+
  '<path d="M12 15l-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2Z"/>'+
  '<path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5"/>')+'</symbol>'+

/* —— 地球（Web 阶段） —— */
'<symbol id="i-globe" viewBox="0 0 24 24">'+s(
  '<circle cx="12" cy="12" r="8.6"/>'+
  '<path d="M3.4 12h17.2"/>'+
  '<path d="M12 3.4c2.5 2.4 3.6 5.3 3.6 8.6s-1.1 6.2-3.6 8.6c-2.5-2.4-3.6-5.3-3.6-8.6s1.1-6.2 3.6-8.6Z"/>')+'</symbol>'+

/* —— 手机（鸿蒙阶段） —— */
'<symbol id="i-phone" viewBox="0 0 24 24">'+s(
  '<rect x="7" y="2.5" width="10" height="19" rx="2.6"/>'+
  '<path d="M10.8 18.6h2.4"/>')+'</symbol>'+

/* —— 扳手（深入阶段） —— */
'<symbol id="i-wrench" viewBox="0 0 24 24">'+s(
  '<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76Z"/>')+'</symbol>'+

/* —— 哑铃（工匠阶段） —— */
'<symbol id="i-dumbbell" viewBox="0 0 24 24"><g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">'+
  '<path d="M6.7 6.7v10.6M17.3 6.7v10.6M3.2 9.3v5.4M20.8 9.3v5.4M6.7 12h10.6"/></g></symbol>'+

/* —— 星星（长线阶段，渐变填充） —— */
'<symbol id="i-star" viewBox="0 0 24 24">'+
  '<path fill="url(#gradBrand)" stroke="none" d="M12 2.8l2.85 5.78 6.38.93-4.62 4.5 1.09 6.36L12 17.45l-5.7 3-1.09-6.36-4.62-4.5 6.38-.93L12 2.8Z"/></symbol>'+

/* —— 太阳 / 月亮（主题开关内嵌背景用） —— */
'<symbol id="i-sun" viewBox="0 0 24 24">'+s(
  '<circle cx="12" cy="12" r="4.4"/>'+
  '<path d="M12 2.5v2.3M12 19.2v2.3M2.5 12h2.3M19.2 12h2.3M5.2 5.2l1.6 1.6M17.2 17.2l1.6 1.6M5.2 18.8l1.6-1.6M17.2 6.8l1.6-1.6"/>')+'</symbol>'+
'<symbol id="i-moon" viewBox="0 0 24 24">'+s(
  '<path d="M20.8 13.2A8.8 8.8 0 1 1 10.8 3.2a7 7 0 0 0 10 10Z"/>')+'</symbol>';

/* —— 注入 sprite —— */
// 注意：不能用 display:none 隐藏 sprite——Chromium 中其内部的渐变 paint server 会整体失效
var sprite='<svg xmlns="http://www.w3.org/2000/svg" width="0" height="0" style="position:absolute;overflow:hidden" aria-hidden="true">'+DEFS+SYMBOLS+'</svg>';
if(document.body){document.body.insertAdjacentHTML('afterbegin',sprite);}
else{document.addEventListener('DOMContentLoaded',function(){document.body.insertAdjacentHTML('afterbegin',sprite);});}

/* —— JS 侧取图标（renderer.js 模板字符串用） —— */
window.iconSvg=function(name,extraClass){
  return '<svg class="ic '+(extraClass||'')+'" aria-hidden="true"><use href="#i-'+name+'"/></svg>';
};
})();
