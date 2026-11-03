// ============================================================
//  人生规划数据模型（纯逻辑）
//  plan.json     { schema:2, stages:[阶段], archived:[已删除但有完成记录的阶段] }
//    阶段        { id, title, time, desc, output, icon, items:[条目] }
//    条目        { type:'task', id, text, star } | { type:'week', id, text }
//  progress.json { done: { 任务id: { at: ISO 时间 | null, legacy?: true } } }
//  任务 id 一经生成永不改变：改文字、挪阶段、重排都不会丢完成状态
// ============================================================
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Plan = factory();
})(this, function () {
  'use strict';

  var SCHEMA = 2;
  var ICONS = ['rocket', 'globe', 'phone', 'wrench', 'dumbbell', 'star'];

  // 旧版写死在 HTML 时间规划表里的“核心产出”，迁移时补进对应阶段
  var OUTPUTS = {
    s0: '开发环境就绪', s1: '3个网页作品 + GitHub仓库', s2: '第一个鸿蒙原生App',
    s3: '开源项目', s4: '实习+作品集', s5: '独立App + 攒钱买Mac学iOS'
  };

  var DEFAULT_STAGES = [
    { id: 's0', title: '阶段 0 · 起步', sub: '今晚 · 环境搭建', tasks: [
      { id: 't001', t: '安装 Node.js LTS 版（nodejs.org 下载，一路Next）' },
      { id: 't002', t: '确认 VS Code 已安装，装插件：Live Server、Chinese Language Pack' },
      { id: 't003', t: '创建第一个 index.html，浏览器打开看到 Hello World' },
      { id: 't004', t: '注册 GitHub 账号 + 安装 Git，配置用户名邮箱' }
    ] },
    { id: 's1', title: '阶段 1 · Web 基础', sub: '暑假3周 · 能跑能看能交互', tasks: [
      { week: 'Week 1 · HTML + CSS（做出好看页面）' },
      { id: 't101', t: '写一个自我介绍页面（HTML：div/p/h1/img/span/a 标签）' },
      { id: 't102', t: '给页面加颜色、字体、背景、边距（CSS 基础样式）' },
      { id: 't103', t: '用 Flexbox 把内容居中排列（display:flex/justify-content/align-items）' },
      { id: 't104', t: '加圆角、阴影、渐变背景（border-radius/box-shadow/linear-gradient）' },
      { id: 't105', t: '加 hover 效果：鼠标悬停变色放大（transition 过渡）' },
      { id: 't106', t: '加入场动画：页面加载淡入、图标旋转（@keyframes + animation）' },
      { id: 't107', t: '★ 做一个鸿蒙/iOS 风格启动器页面（圆角卡片 + 图标 + 动画）' },
      { week: 'Week 2 · JavaScript（让页面动起来）' },
      { id: 't108', t: '加一个按钮，点击弹出消息（JS 基础 + 事件监听）' },
      { id: 't109', t: '做一个计数器：点击 +1（变量 + 函数 + DOM 操作）' },
      { id: 't110', t: '做一个待办清单：输入框 + 添加按钮 + 列表显示' },
      { id: 't111', t: '给待办项加完成/删除功能（数组操作 + 事件）' },
      { id: 't112', t: '刷新页面不丢数据（localStorage 本地存储）' },
      { id: 't113', t: '加键盘支持：回车键添加待办（keydown 事件）' },
      { id: 't114', t: '★ 完善待办清单：好看 UI + 动画 + 本地存储' },
      { week: 'Week 3 · 第一个项目（能跑能看能交互）' },
      { id: 't115', t: 'CSS 动画进阶：卡片翻转、弹窗过渡' },
      { id: 't116', t: '调用免费 API 获取天气数据（fetch 请求 + JSON 解析）' },
      { id: 't117', t: '★ 做一个天气卡片应用（API + 动画 + 美观 UI）' },
      { id: 't118', t: '响应式适配：手机上也能看（@media 媒体查询）' },
      { id: 't119', t: '打磨 UI：圆角、阴影、毛玻璃效果，追求鸿蒙级质感' },
      { id: 't120', t: '部署到 GitHub Pages，发链接给朋友看 + 代码推上 GitHub' }
    ] },
    { id: 's2', title: '阶段 2 · 鸿蒙 ArkTS 起步', sub: '大一上 9月-1月 · 原生开发入门', tasks: [
      { id: 't201', t: 'DevEco Studio 环境更新，创建第一个鸿蒙项目跑通 Hello World' },
      { id: 't202', t: 'ArkTS 语言基础：变量、类型、函数（类 TypeScript，上手快）' },
      { id: 't203', t: 'ArkTS 面向对象：class、interface、泛型' },
      { id: 't204', t: 'ArkUI 基础组件：Text / Image / Button / TextInput' },
      { id: 't205', t: 'ArkUI 布局：Column / Row / Stack（和 CSS Flexbox 思维相通）' },
      { id: 't206', t: 'ArkUI 状态管理：@State / @Prop / @Link 状态驱动 UI' },
      { id: 't207', t: 'ArkUI 事件交互：onClick / onChange / 手势' },
      { id: 't208', t: 'ArkUI 动画：animateTo / transition（追求流畅动画）' },
      { id: 't209', t: '★ 用 ArkTS 复刻你的 Web 待办清单（原生鸿蒙版）' },
      { id: 't210', t: '跟学校 C 语言课，用 K&R 同步学习（学校课为主）' },
      { id: 't211', t: '数据结构基础：数组、链表（跟学校课同步）' }
    ] },
    { id: 's3', title: '阶段 3 · 鸿蒙深入 + 安卓副线', sub: '大一下 2月-7月 · 原生能力提升', tasks: [
      { id: 't301', t: 'ArkUI 进阶：自定义组件、@Builder / @Extend' },
      { id: 't302', t: 'ArkUI 导航：Navigation 路由管理' },
      { id: 't303', t: '鸿蒙数据存储：Preferences、关系型数据库' },
      { id: 't304', t: '鸿蒙网络请求：HTTP 请求、JSON 解析' },
      { id: 't305', t: '鸿蒙动画精通：属性动画、转场动画、共享元素' },
      { id: 't306', t: '鸿蒙分布式能力：跨端流转入门' },
      { id: 't307', t: '安卓 Kotlin 入门（副线）：语法基础' },
      { id: 't308', t: '安卓 Compose 入门：声明式 UI（思维迁移自 ArkUI）' },
      { id: 't309', t: '★ 开源第一个项目到 GitHub' }
    ] },
    { id: 's4', title: '阶段 4 · 多平台工匠 + 实习', sub: '大二 · 真刀真枪', tasks: [
      { id: 't401', t: '鸿蒙 ArkUI 精通：复杂动画、性能优化' },
      { id: 't402', t: '安卓 Compose 进阶：与鸿蒙对比学习' },
      { id: 't403', t: '架构模式：MVVM 在鸿蒙和安卓中的实现' },
      { id: 't404', t: '参与鸿蒙开源社区贡献，提交第一个 PR' },
      { id: 't405', t: '大二暑假实习：鸿蒙 / 安卓开发岗' },
      { id: 't406', t: '★ 作品集打磨：鸿蒙 + 安卓各一个精品作品' }
    ] },
    { id: 's5', title: '阶段 5 · 少年骇客', sub: '长线 · 你的生态', tasks: [
      { id: 't501', t: '独立做一个精品 App（鸿蒙原生）' },
      { id: 't502', t: '写技术博客 / 建立个人影响力' },
      { id: 't503', t: '攒钱买 Mac → 学 iOS SwiftUI' },
      { id: 't504', t: '带小团队做出惊艳世人的项目' }
    ] }
  ];

  var seq = 0;
  function newId(prefix) {
    return (prefix || 'x') + '_' + Date.now().toString(36) + (seq++).toString(36) + Math.random().toString(36).slice(2, 6);
  }

  function splitStar(text) {
    var t = String(text || '').trim();
    var star = t.indexOf('★') === 0;
    return { text: star ? t.replace(/^★\s*/, '') : t, star: star };
  }

  /* 旧格式阶段 → 新格式：“阶段 1 · Web 基础” 取后半，“暑假3周 · 能跑能看” 拆成时间 + 简介 */
  function convertStage(s, idx) {
    var title = String(s.title || '').split('·');
    var sub = String(s.sub || '').split('·');
    var weekN = 0;
    return {
      id: s.id || newId('s'),
      title: (title.length > 1 ? title.slice(1).join('·') : title[0]).trim() || '未命名阶段',
      time: (sub[0] || '').trim(),
      desc: sub.slice(1).join('·').trim(),
      output: OUTPUTS[s.id] || '',
      icon: ICONS[idx] || 'star',
      items: (s.tasks || []).map(function (t) {
        if (t.week !== undefined) return { type: 'week', id: (s.id || 's') + '_w' + (++weekN), text: String(t.week) };
        var st = splitStar(t.t);
        return { type: 'task', id: t.id || newId('t'), text: st.text, star: st.star };
      })
    };
  }

  /* 从旧 tasks.json 迁移；旧文件本身不改动 */
  function migrate(tasksJson) {
    var old = tasksJson || {};
    var src = Array.isArray(old.customStages) && old.customStages.length ? old.customStages : DEFAULT_STAGES;
    var plan = { schema: SCHEMA, stages: src.map(convertStage), archived: [] };
    var done = {};
    Object.keys(old.tasks || {}).forEach(function (id) { if (old.tasks[id]) done[id] = { at: null, legacy: true }; });
    return { plan: plan, progress: { done: done } };
  }

  function defaultPlan() { return migrate(null); }

  function tasks(stage) { return stage.items.filter(function (x) { return x.type === 'task'; }); }
  function allTasks(plan) {
    var out = [];
    plan.stages.forEach(function (s) { out = out.concat(tasks(s)); });
    return out;
  }
  function isDone(progress, id) { return !!progress.done[id]; }

  function toggle(progress, id, nowIso) {
    if (progress.done[id]) delete progress.done[id];
    else progress.done[id] = { at: nowIso || new Date().toISOString() };
    return !!progress.done[id];
  }

  function stageStats(stage, progress) {
    var t = tasks(stage);
    return { done: t.filter(function (x) { return isDone(progress, x.id); }).length, total: t.length };
  }
  function isStageDone(stage, progress) {
    var st = stageStats(stage, progress);
    return st.total > 0 && st.done === st.total;
  }
  // 当前阶段 = 第一个还没完成的阶段
  function currentStage(plan, progress) {
    for (var i = 0; i < plan.stages.length; i++) if (!isStageDone(plan.stages[i], progress)) return plan.stages[i];
    return null;
  }
  function totals(plan, progress) {
    var t = allTasks(plan);
    var d = t.filter(function (x) { return isDone(progress, x.id); }).length;
    return { done: d, total: t.length, pct: t.length ? Math.round(d / t.length * 100) : 0 };
  }

  /* 删除阶段：有完成记录的放进 archived，记录不丢 */
  function removeStage(plan, progress, stageId, nowIso) {
    var i = plan.stages.findIndex(function (s) { return s.id === stageId; });
    if (i === -1) return null;
    var s = plan.stages.splice(i, 1)[0];
    if (stageStats(s, progress).done > 0) {
      s.archivedAt = nowIso || new Date().toISOString();
      plan.archived.push(s);
    }
    return s;
  }

  return {
    SCHEMA: SCHEMA, ICONS: ICONS, DEFAULT_STAGES: DEFAULT_STAGES,
    newId: newId, splitStar: splitStar, migrate: migrate, defaultPlan: defaultPlan,
    tasks: tasks, allTasks: allTasks, isDone: isDone, toggle: toggle,
    stageStats: stageStats, isStageDone: isStageDone, currentStage: currentStage,
    totals: totals, removeStage: removeStage
  };
});
