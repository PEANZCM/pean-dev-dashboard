const test = require('node:test');
const assert = require('node:assert/strict');
const Plan = require('../src/js/plan.js');

test('迁移默认规划：6 个阶段、42 个任务、周标签保留', () => {
  const { plan, progress } = Plan.migrate({ tasks: { t001: true, t101: true, t999: false }, customStages: null });
  assert.equal(plan.stages.length, 6);
  assert.equal(Plan.allTasks(plan).length, 42);
  assert.equal(plan.stages[1].items.filter((x) => x.type === 'week').length, 3);
  assert.deepEqual(Object.keys(progress.done).sort(), ['t001', 't101']);
  assert.equal(progress.done.t001.legacy, true);
});

test('迁移拆分标题、时间、简介，并补上核心产出', () => {
  const s = Plan.migrate(null).plan.stages[1];
  assert.equal(s.title, '21天速通C语言');
  assert.equal(s.time, '11.23-12.15');
  assert.equal(s.desc, '每天2.5h手敲代码，联考翻盘');
  assert.equal(s.output, '联考75+分 + 独立AC满100题');
  assert.equal(s.icon, 'book');
});

test('★ 重点任务拆成 star 标记', () => {
  const t = Plan.allTasks(Plan.migrate(null).plan).find((x) => x.id === 't109');
  assert.equal(t.star, true);
  assert.equal(t.text.indexOf('★'), -1);
});

test('迁移自定义阶段（旧编辑器保存过的）', () => {
  const custom = [{ id: 's0', title: '阶段 0 · 新起点', sub: '明天 · 试试', tasks: [{ id: 't_0_1', t: '新任务' }, { week: 'W1' }] }];
  const { plan } = Plan.migrate({ tasks: {}, customStages: custom });
  assert.equal(plan.stages.length, 1);
  assert.equal(plan.stages[0].title, '新起点');
  assert.equal(plan.stages[0].items[0].id, 't_0_1');
});

test('改任务文字不丢完成状态（旧版按文字匹配会丢）', () => {
  const { plan, progress } = Plan.migrate({ tasks: { t001: true } });
  const t = Plan.allTasks(plan).find((x) => x.id === 't001');
  t.text = '安装 Node.js（改过文字）';
  assert.equal(Plan.isDone(progress, t.id), true);
});

test('勾选记录完成时间，再点取消', () => {
  const progress = { done: {} };
  assert.equal(Plan.toggle(progress, 'a', '2026-11-04T10:00:00.000Z'), true);
  assert.equal(progress.done.a.at, '2026-11-04T10:00:00.000Z');
  assert.equal(Plan.toggle(progress, 'a'), false);
});

test('当前阶段 = 第一个未完成阶段；统计与旧版一致', () => {
  const ids = Plan.migrate(null).plan.stages[0].items.map((x) => x.id);
  const tasks = {};
  ids.forEach((id) => { tasks[id] = true; });
  const { plan, progress } = Plan.migrate({ tasks });
  assert.equal(Plan.currentStage(plan, progress).id, 's1');
  assert.deepEqual(Plan.totals(plan, progress), { done: 5, total: 42, pct: 12 });
});

test('删除有完成记录的阶段会归档，没有的直接删', () => {
  const { plan, progress } = Plan.migrate({ tasks: { t001: true } });
  Plan.removeStage(plan, progress, 's0');
  Plan.removeStage(plan, progress, 's5');
  assert.equal(plan.stages.length, 4);
  assert.equal(plan.archived.length, 1);
  assert.equal(plan.archived[0].id, 's0');
  assert.equal(Plan.isDone(progress, 't001'), true);
});
