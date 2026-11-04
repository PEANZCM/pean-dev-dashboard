const test = require('node:test');
const assert = require('node:assert/strict');
const Plan = require('../src/js/plan.js');
const Coach = require('../src/js/coach.js');
const Ai = require('../ai.js');

const NOW = new Date(2026, 10, 4, 15, 32).getTime();
function state() {
  const { plan, progress } = Plan.migrate({ tasks: { t001: true } });
  return {
    plan, progress,
    checkin: { dates: ['2026-11-03', '2026-11-04'] }, flame: { total: 19 },
    mood: { moods: { '2026-11-03': '😀' } },
    diary: { entries: { '2026-11-03': '今天的私密日记内容' } }
  };
}

test('隐私开关：默认不发日记和心情', () => {
  const c = Coach.context(state(), {}, NOW);
  assert.equal(c.includes('私密日记'), false);
  assert.equal(c.includes('😀'), false);
  assert.ok(c.includes('连续 2 天'));
});

test('隐私开关：只开心情不带日记，只开日记不带心情', () => {
  const m = Coach.context(state(), { mood: true }, NOW);
  assert.ok(m.includes('😀'));
  assert.equal(m.includes('私密日记'), false);
  const d = Coach.context(state(), { diary: true }, NOW);
  assert.ok(d.includes('私密日记'));
  assert.equal(d.includes('😀'), false);
});

test('周标识是这周一', () => {
  assert.equal(Coach.weekKey(NOW), '2026-11-02');
  assert.equal(Coach.weekKey(new Date(2026, 10, 1, 12).getTime()), '2026-10-26');   // 周日算上一周
});

test('草稿：保留已有 id，完成状态不丢，算出改动', () => {
  const s = state();
  const draft = {
    summary: '调整',
    stages: [{ id: 's0', title: '起步', time: '今晚', output: '开发环境就绪', items: [{ id: 't001', text: '安装 Node（改写）' }, { text: '新任务' }] }]
  };
  const r = Coach.applyDraft(s.plan.stages, draft, s.progress);
  assert.equal(r.stages[0].id, 's0');
  assert.equal(r.stages[0].items[0].id, 't001');
  assert.equal(Plan.isDone(s.progress, r.stages[0].items[0].id), true);
  assert.deepEqual(r.diff.tasksAdded, ['新任务']);
  assert.equal(r.diff.tasksChanged.length, 1);
  assert.equal(r.diff.stagesRemoved.length, 5);
  assert.ok(r.diff.tasksRemoved.length > 40);
});

test('草稿：AI 编的 id 不能冒充已完成任务，重复 id 会换新', () => {
  const s = state();
  const draft = { stages: [{ title: '新', items: [{ id: 'fake', text: 'A' }, { id: 't001', text: 'B' }, { id: 't001', text: 'C' }] }] };
  const r = Coach.applyDraft(s.plan.stages, draft, s.progress);
  const ids = r.stages[0].items.map((x) => x.id);
  assert.notEqual(ids[0], 'fake');
  assert.equal(ids[1], 't001');
  assert.notEqual(ids[2], 't001');
});

test('草稿：不合格的直接报错，不产生结果', () => {
  const s = state();
  assert.throws(() => Coach.applyDraft(s.plan.stages, {}, s.progress));
  assert.throws(() => Coach.applyDraft(s.plan.stages, { stages: [] }, s.progress));
  assert.throws(() => Coach.applyDraft(s.plan.stages, { stages: [{ title: '' }] }, s.progress));
});

test('模型设置：自动按任务选，具体模型原样使用，乱填的值退回自动', () => {
  assert.equal(Ai.pickModel('auto', true), 'deepseek-v4-pro');
  assert.equal(Ai.pickModel('flash', true), 'deepseek-flash');
  assert.equal(Ai.pickModel('deepseek-v5-pro', false), 'deepseek-v5-pro');
  assert.equal(Ai.pickModel('a b', false), 'deepseek-flash');
});

test('模型列表来自接口，失败时不抛异常', async () => {
  const fetch = async () => ({ ok: true, json: async () => ({ data: [{ id: 'deepseek-flash' }, { id: 'deepseek-v5-pro' }, { id: '<x>' }, {}] }) });
  assert.deepEqual(await Ai.listModels('k', { fetch }), { ok: true, models: ['deepseek-flash', 'deepseek-v5-pro'] });
  assert.equal((await Ai.listModels('k', { fetch: async () => { throw new Error('x'); } })).ok, false);
});

test('任务拆解结果校验', () => {
  assert.deepEqual(Coach.subtasks({ subtasks: [' a ', '', 'b'] }), ['a', 'b']);
  assert.throws(() => Coach.subtasks({}));
});

test('每次请求都带本机时间，模型按官方当前名称', () => {
  const b = Ai.buildBody({ system: 'X', messages: [{ role: 'user', content: 'hi' }] }, new Date(2026, 10, 4, 15, 32));
  assert.ok(b.messages[0].content.includes('2026年11月4日 星期三 15:32'));
  assert.equal(b.model, 'deepseek-flash');
  assert.deepEqual(b.thinking, { type: 'disabled' });
  const d = Ai.buildBody({ deep: true, json: true }, new Date());
  assert.equal(d.model, 'deepseek-v4-pro');
  assert.deepEqual(d.response_format, { type: 'json_object' });
});

function fakeFetch(status, body) { return async () => ({ ok: status < 400, status, text: async () => JSON.stringify(body) }); }

test('错误都转成中文，不抛异常', async () => {
  assert.equal((await Ai.chat('k', {}, { fetch: fakeFetch(401, {}) })).error, 'API Key 无效，请到设置里检查');
  assert.equal((await Ai.chat('k', {}, { fetch: fakeFetch(402, {}) })).error, 'DeepSeek 账户余额不足');
  const off = await Ai.chat('k', {}, { fetch: async () => { throw new Error('net'); } });
  assert.equal(off.ok, false);
  assert.equal(off.offline, true);
});

test('空内容和被截断都算失败', async () => {
  const empty = { choices: [{ finish_reason: 'stop', message: { content: '   ' } }] };
  assert.equal((await Ai.chat('k', {}, { fetch: fakeFetch(200, empty) })).ok, false);
  const cut = { choices: [{ finish_reason: 'length', message: { content: '{"a":' } }] };
  assert.equal((await Ai.chat('k', {}, { fetch: fakeFetch(200, cut) })).ok, false);
  const good = { choices: [{ finish_reason: 'stop', message: { content: '你好' } }] };
  assert.deepEqual(await Ai.chat('k', {}, { fetch: fakeFetch(200, good) }), { ok: true, text: '你好' });
});
