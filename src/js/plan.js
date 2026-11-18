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
  var ICONS = ['rocket', 'book', 'wrench', 'flame', 'trophy', 'phone'];

  // 各阶段的核心产出指标
  var OUTPUTS = {
    s0: '环境就绪 + 杭师大联考摸底',
    s1: '联考75+分 + 独立AC满100题',
    s2: '期末全科90+ + 掌握C++ STL',
    s3: '提前达省一水平 + 累计AC满300题',
    s4: '蓝桥杯省一 + 进校集训队',
    s5: '冲击国赛奖牌 + 鸿蒙原生精品App'
  };

  var DEFAULT_STAGES = [
    { id: 's0', title: '阶段 0 · 破冰入局', sub: '11.18-11.22 · 联考摸底与环境就绪', tasks: [
      { id: 't001', t: '配置 VS Code C/C++ 编译调试环境（必关所有 AI 代码补全插件），并用 Dev-C++ 跑通一次 F11 编译与 F5 单步调试保命' },
      { id: 't002', t: '确认加入学院竞赛通知 QQ 群，查看第 50 号全校联考成绩排名表，锁定追赶标杆' },
      { id: 't003', t: '在 PTA 突击分支与循环基础题（独立手敲至少 15 题），熟悉多组输入与格式控制' },
      { id: 't004', t: '★ 11月22日打满《2026年杭州师范大学程序设计基础课程多校联考》第 2 场（哪怕低分也绝不提前交卷）' },
      { id: 't005', t: '赛后 48 小时内把联考第 2 场未过题目全部补题 AC，并去三楼左边顶头寝室认识 266 班前排同学' }
    ] },
    { id: 's1', title: '阶段 1 · 21天速通C语言', sub: '11.23-12.15 · 每天2.5h手敲代码，联考翻盘', tasks: [
      { week: 'Week 1（11.23-11.29）· 循环进阶 + 数组与字符串（第5-6章）' },
      { id: 't101', t: '倍速看完翁恺/鹏哥 C 语言循环进阶，掌握最大公约数、素数筛与图形打印' },
      { id: 't102', t: '独立刷完洛谷【入门3 · 循环结构】官方题单核心 15 题（卡壳超20分钟才准问AI思路，严禁看完整代码）' },
      { id: 't103', t: '学完第 6 章一维数组与二维矩阵，手写冒泡/选择排序、数组翻转与矩阵遍历' },
      { id: 't104', t: '独立刷完洛谷【入门4 · 数组】官方题单 15 题' },
      { id: 't105', t: '学完字符数组与 string.h 常用函数（strlen/strcmp/strcpy/strcat），刷完洛谷【入门5 · 字符串】12 题' },
      { week: 'Week 2（11.30-12.06）· 函数、递归与指针基础（第7-8章）' },
      { id: 't106', t: '学完第 7 章函数定义、参数传递、数组传参及全局变量与局部变量作用域' },
      { id: 't107', t: '攻克递归核心思维（阶乘、斐波那契、汉诺塔、辗转相除），为后续 DFS 搜索打底' },
      { id: 't108', t: '学完第 8 章指针基础（地址概念、指针与数组关系、指针传参交换变量），刷完洛谷【入门6 · 函数与结构体】前 10 题' },
      { id: 't109', t: '★ 参加《杭州师范大学多校联考》第 3 场，目标冲上 60-75 分，赛后完成全部补题' },
      { week: 'Week 3（12.07-12.15）· 结构体与PTA综合收官（第9章）' },
      { id: 't110', t: '学完第 9 章结构体（struct 定义、结构体数组、按多条件排序），彻底走完 C 语言核心语法' },
      { id: 't111', t: '在 PTA《基础编程题目集》与《团体程序设计天梯赛-练习集 L1》刷满 30 道综合模拟题' },
      { id: 't112', t: '★ 参加《杭州师范大学多校联考》第 4 场收官战，目标冲进 75-90 分（杀入全校第50号表格前排）' },
      { id: 't113', t: '★ 阶段硬指标：12月中旬前 C 语言全书通关，PTA + 洛谷累计独立 AC 满 100 题' }
    ] },
    { id: 's2', title: '阶段 2 · 期末保绩点+STL', sub: '12.16-1.15 · 死守保研90+红线，换装C++竞赛武器', tasks: [
      { week: '保研红线保卫战（白天+晚自习前段全力复习课内必修）' },
      { id: 't201', t: 'C 语言课程实验报告与平时作业全部满分提交，期末试卷刷透冲 95+' },
      { id: 't202', t: '微积分 I 历年期末卷与课后核心题刷透，确保期末总评 90+' },
      { id: 't203', t: '大学物理完成课堂讲题/提问高分表现，期末复习冲 90+' },
      { id: 't204', t: '大学英语 I 与思政课期末复习到位，确保大一上综测排名稳居保研圈' },
      { week: '每晚 21:30-23:00 编程不断火（C 平滑升级 C++ STL）' },
      { id: 't205', t: '花 3 天掌握 C++ 竞赛基础（iostream、cin/cout 加速、引用传参、algorithm 头文件）' },
      { id: 't206', t: '熟练掌握蓝桥第一神器 sort() 自定义排序（配合结构体与 cmp 函数秒杀排序题）' },
      { id: 't207', t: '掌握 STL 高频容器：string、vector 动态数组、map 映射、set 集合、queue 队列与 stack 栈' },
      { id: 't208', t: '★ 期末月每天刷 1-2 道 PTA 天梯赛 L1 题保持手感，累计独立 AC 达 140 题' }
    ] },
    { id: 's3', title: '阶段 3 · 寒假蓝桥魔鬼集训', sub: '1.16-2.28 · 每天4-5h，提前1个月锁死省一实力', tasks: [
      { week: '模块 A（1.16-1.31）· 基础算法必拿分四大金刚' },
      { id: 't301', t: '暴力枚举与复杂模拟专项（重点攻克蓝桥必考：日期推算、进制转换、数位拆解、矩阵模拟）— 刷满 25 题' },
      { id: 't302', t: '前缀和与差分专项（一维前缀和、二维子矩阵求和、区间快速修改，防超时利器）— 刷满 20 题' },
      { id: 't303', t: '二分算法专项（整数二分查找、lower_bound、二分答案法——蓝桥省赛每年必考）— 刷满 20 题' },
      { id: 't304', t: '贪心算法与双指针专项（区间调度、排序贪心、尺取法/滑动窗口）— 刷满 20 题' },
      { week: '模块 B（2.01-2.20）· 搜索、基础DP与竞赛数论' },
      { id: 't305', t: '深度优先搜索 DFS（全排列、组合枚举、棋盘回溯、连通块——既是正解也是压轴题万能暴力骗分工具）— 刷满 25 题' },
      { id: 't306', t: '广度优先搜索 BFS（迷宫最短步数、层序状态转移）— 刷满 15 题' },
      { id: 't307', t: '基础动态规划 DP（递推思维、0-1背包、完全背包、线性DP、最长上升子序列）— 刷满 25 题' },
      { id: 't308', t: '竞赛基础数论（质数埃氏筛/欧拉筛、最大公约数 gcd、快速幂取模、同余定理）— 刷满 15 题' },
      { week: '模块 C（2.21-2.28）· 历年真题提前验收' },
      { id: 't309', t: '★ 刷穿 2021-2026 年蓝桥杯 C/C++ 大学 B 组省赛真题前 6 题（共 30+ 题），在 2 月底提前具备省一水平（累计破 300 题）' }
    ] },
    { id: 's4', title: '阶段 4 · 省赛与天梯收割', sub: '3.1-4月中旬 · 全真断网套卷冲刺，拿下省一', tasks: [
      { id: 't401', t: '每周六上午 9:00-13:00 进行 4 小时断网全真模拟（练熟“前5题稳AC + 后5题暴力骗分”时间分配策略，共 6 套）' },
      { id: 't402', t: '参加学校团体程序设计天梯赛选拔赛 / 传智杯，凭高积分杀入学院重点培养梯队' },
      { id: 't403', t: '整理个人默写级代码模板库（快速幂、二分、DFS回溯、BFS、前缀和、闰年日期数组）并熟练使用 Dev-C++ 考场环境' },
      { id: 't404', t: '★ 4月出战蓝桥杯 C/C++ 大学 B 组省赛：稳拿省一等奖，挺进全国总决赛！' }
    ] },
    { id: 's5', title: '阶段 5 · 国赛与鸿蒙回归', sub: '4月中旬起 · 冲刺国赛奖牌，带着硬核内功重回鸿蒙', tasks: [
      { id: 't501', t: '备战 6 月蓝桥杯全国总决赛（补充图论最短路 Dijkstra/Floyd、最小生成树、并查集与树状数组）' },
      { id: 't502', t: '出战 6 月蓝桥杯 C/C++ 大学 B 组全国总决赛，冲击国家级奖项' },
      { id: 't503', t: '★ 带着 350+ 题锤炼出的扎实算法与数据结构内功，满血重启鸿蒙 ArkTS 原生开发，独立打造真正有技术深度的产品' }
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
