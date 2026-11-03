// 在一份数据副本上核对迁移前后的关键数字：node tests/verify-migration.js <data 目录>
// 旧版统计按旧 renderer.js 的口径重新计算，和新数据模型逐项比对
const fs = require('fs');
const path = require('path');
const Plan = require('../src/js/plan.js');
const Rules = require('../src/js/rules.js');

const dir = process.argv[2];
if (!dir) { console.error('用法：node tests/verify-migration.js <data 目录>'); process.exit(2); }
const read = (f, def) => { try { return JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')); } catch (e) { return def; } };

const tasks = read('tasks.json', { tasks: {}, customStages: null });
const checkin = read('checkin.json', { dates: [] });
const streak = read('streak.json', {});
const flame = read('flame.json', { total: 0 });
const medals = read('medals.json', {});
const plan = read('plan.json', null);
const progress = read('progress.json', null);

// —— 旧口径 ——
const oldStages = tasks.customStages || Plan.DEFAULT_STAGES;
const oldIds = [].concat(...oldStages.map((s) => s.tasks.filter((t) => t.id).map((t) => t.id)));
const oldDone = oldIds.filter((id) => tasks.tasks[id]).length;
const oldCurrent = oldStages.find((s) => { const t = s.tasks.filter((x) => x.id); return !(t.length && t.every((x) => tasks.tasks[x.id])); });

// —— 新口径（软件生成的 plan.json；还没生成就现场迁移一份） ——
const m = plan ? { plan, progress } : Plan.migrate(tasks);
const tot = Plan.totals(m.plan, m.progress);
const cur = Plan.currentStage(m.plan, m.progress);

const rows = [
  ['阶段数', oldStages.length, m.plan.stages.length],
  ['任务总数', oldIds.length, tot.total],
  ['已完成任务', oldDone, tot.done],
  ['总进度 %', oldIds.length ? Math.round(oldDone / oldIds.length * 100) : 0, tot.pct],
  ['当前阶段', oldCurrent ? oldCurrent.id : '-', cur ? cur.id : '-'],
  ['完成记录 id 一致', oldIds.filter((id) => tasks.tasks[id]).sort().join(','), Object.keys(m.progress.done).filter((id) => oldIds.includes(id)).sort().join(',')],
  ['打卡天数', checkin.dates.length, checkin.dates.length],
  ['连续天数（存储 / 重算）', streak.current, Rules.computeStreak(new Set(checkin.dates)).n],
  ['火焰', flame.total, flame.total],
  ['冻结奖章', (medals.frozenMedals || []).length, (medals.frozenMedals || []).length]
];
let bad = 0;
console.log('项目'.padEnd(18) + '旧'.padEnd(14) + '新');
rows.forEach(([k, a, b]) => {
  const same = String(a) === String(b);
  if (!same) bad++;
  const show = (v) => (String(v).length > 12 ? String(v).slice(0, 10) + '…' : String(v));
  console.log((same ? '✔ ' : '✖ ') + k.padEnd(16) + show(a).padEnd(14) + show(b));
});
['diary.json', 'mood.json', 'quotes.json', 'screenshots.json', 'settings.json'].forEach((f) => {
  console.log('  ' + f.padEnd(16) + (fs.existsSync(path.join(dir, f)) ? '保留未改动' : '（无此文件）'));
});
console.log(bad ? '\n有 ' + bad + ' 项不一致' : '\n全部一致');
process.exit(bad ? 1 : 0);
