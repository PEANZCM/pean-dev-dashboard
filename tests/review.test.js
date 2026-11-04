const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const Review = require('../src/js/review.js');
const Rules = require('../src/js/rules.js');
const Dates = require('../src/js/dates.js');
const Evidence = require('../evidence.js');

const at = (s) => new Date(s);
const noEv = { folderCount: 0, folders: [], repos: [], tracking: false, usage: {}, diary: { chars: 0 }, shots: 0 };

test('晚上商量明天，白天和凌晨商量今天', () => {
  assert.equal(Review.planTarget(at('2026-11-04T21:00:00')), '2026-11-05');
  assert.equal(Review.planTarget(at('2026-11-04T10:00:00')), '2026-11-04');
  assert.equal(Review.planTarget(at('2026-11-05T01:30:00')), '2026-11-05');
});

test('计划：编造的任务 id 不保留，超过上限截断，plan 为 null 表示还在讨论', () => {
  const r = Review.parsePlan({ reply: '好', plan: [{ text: '写组件', taskId: 'real' }, { text: '看文档', taskId: 'fake' }, { text: '' }] }, { real: true });
  assert.deepEqual(r.items, [{ text: '写组件', done: false, taskId: 'real' }, { text: '看文档', done: false }]);
  assert.equal(Review.parsePlan({ reply: '你想学什么', plan: null }, {}).items, null);
  const many = Array.from({ length: 20 }, (_, i) => ({ text: 't' + i }));
  assert.equal(Review.parsePlan({ reply: 'x', plan: many }, {}).items.length, Review.MAX_ITEMS);
  assert.throws(() => Review.parsePlan({ plan: [] }, {}));
  assert.throws(() => Review.parsePlan({ reply: 'x', plan: 'abc' }, {}));
});

test('审核结果：met / accept 不是布尔值就算格式错误，不能算通过', () => {
  assert.throws(() => Review.parseVerdict({ met: 'true' }));
  assert.throws(() => Review.parseVerdict(null));
  assert.throws(() => Review.parseReason({ accept: 1 }));
  assert.equal(Review.parseVerdict({ met: false, missing: ['a', ''] }).missing.length, 1);
});

test('重新商量不丢已勾选的项', () => {
  const merged = Review.mergeDone([{ text: 'a', done: false }, { text: 'b', done: false }], [{ text: 'a', done: true }]);
  assert.deepEqual(merged.map((x) => x.done), [true, false]);
});

test('证据：没开日记发送时不含正文，没有证据的项目明确写出来', () => {
  const t = Review.evidenceText(Object.assign({}, noEv, { diary: { chars: 12 } }));
  assert.match(t, /没有设置监控文件夹/);
  assert.match(t, /没有开启统计/);
  assert.match(t, /看不到正文/);
  const t2 = Review.evidenceText(Object.assign({}, noEv, {
    folderCount: 1, tracking: true, usage: { 'VS Code': 5400 }, shots: 2, diary: { chars: 3, text: '学了' },
    folders: [{ name: 'app', files: 3, exts: { '.js': 2, '.md': 1 }, recent: ['a.js'] }],
    repos: [{ name: 'app', commits: ['修复'], insertions: 10, deletions: 2 }]
  }));
  assert.match(t2, /app：3 个文件（\.js 2、\.md 1）/);
  assert.match(t2, /\+10 \/ -2/);
  assert.match(t2, /VS Code 1 小时 30 分/);
  assert.match(t2, /学了/);
});

test('补审期限：过了 deadline 当天才算逾期', () => {
  const daily = { reviews: { '2026-11-03': { status: 'owed', deadline: '2026-11-04' }, '2026-11-02': { status: 'passed' }, '2026-11-01': { status: 'pending' } } };
  assert.deepEqual(Review.overdue(daily, at('2026-11-04T23:00:00')), []);
  assert.deepEqual(Review.overdue(daily, at('2026-11-05T00:10:00')), ['2026-11-03']);
  assert.deepEqual(Review.pending(daily), ['2026-11-01']);
  assert.equal(Review.deadline(at('2026-11-04T09:00:00')), '2026-11-05');
});

function state(dates) {
  return {
    checkin: { dates }, streak: { current: dates.length, startDate: dates[0], lastUpdate: null }, flame: { total: dates.length },
    medals: { liveMedal: null, frozenMedals: [], labelMemory: {}, grandSlam: 0 }
  };
}

test('撤销某天：退火焰、连续天数从断点重算、奖章起始日跟着变', () => {
  const now = at('2026-11-04T12:00:00');
  const dates = [];
  for (let i = 25; i >= 0; i--) dates.push(Dates.offset(-i, now));
  const s = state(dates);
  Rules.revoke(s, Dates.offset(0, now), now);          // 先让奖章状态刷新
  Rules.checkin(s, now);
  assert.equal(s.streak.current, 26);
  assert.equal(s.medals.liveMedal.tier, 'blue');
  assert.equal(Rules.revoke(s, Dates.offset(-2, now), now), true);
  assert.equal(s.streak.current, 2);
  assert.equal(s.flame.total, 25);
  assert.equal(s.medals.liveMedal, null);
  assert.equal(Rules.revoke(s, '2020-01-01', now), false);
  assert.equal(s.flame.total, 25);
});

test('撤销后还在奖章线以上：奖章保留，起始日更新', () => {
  const now = at('2026-11-04T12:00:00');
  const dates = [];
  for (let i = 30; i >= 0; i--) dates.push(Dates.offset(-i, now));
  const s = state(dates);
  Rules.revoke(s, Dates.today(now), now);
  Rules.checkin(s, now);
  Rules.revoke(s, Dates.offset(-27, now), now);
  assert.equal(s.streak.current, 27);
  assert.equal(s.medals.liveMedal.startDate, Dates.offset(-26, now));
});

test('使用时长：只记开发软件，30 天前的自动清理', () => {
  const u = { days: { '2026-09-01': { 终端: 5 } } };
  assert.equal(Evidence.addSample(u, '2026-11-04', 'chrome', 15), false);
  assert.deepEqual(Object.keys(u.days), ['2026-09-01']);
  Evidence.addSample(u, '2026-11-04', 'Code', 15);
  Evidence.addSample(u, '2026-11-04', 'code', 15);
  assert.deepEqual(u.days, { '2026-11-04': { 'VS Code': 30 } });
});

test('git 日志解析：只算自己的提交', () => {
  const out = '\x01me@x.com\x02修复\n\n 2 files changed, 10 insertions(+), 3 deletions(-)\n\x01me@x.com\x02文档\n\n 1 file changed, 1 insertion(+)\n\x01other@x.com\x02别人的\n\n 9 files changed, 99 insertions(+)\n';
  assert.deepEqual(Evidence.parseGitLog(out, 'me@x.com'), { commits: ['修复', '文档'], insertions: 11, deletions: 3 });
});

test('扫描文件夹：只算当天改动，跳过 node_modules，真实 git 仓库能取到提交', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pean-ev-'));
  try {
    fs.mkdirSync(path.join(dir, 'src'));
    fs.mkdirSync(path.join(dir, 'node_modules'));
    fs.writeFileSync(path.join(dir, 'src', 'a.js'), '1');
    fs.writeFileSync(path.join(dir, 'node_modules', 'b.js'), '1');
    fs.writeFileSync(path.join(dir, 'old.md'), '1');
    fs.utimesSync(path.join(dir, 'old.md'), at('2026-01-01T00:00:00'), at('2026-01-01T00:00:00'));
    const today = Dates.today();
    const r = await Evidence.scanFolder(dir, today);
    assert.equal(r.files, 1);
    assert.deepEqual(r.recent, ['src/a.js']);

    const g = (...a) => execFileSync('git', ['-C', dir, ...a], { stdio: 'ignore' });
    g('init'); g('config', 'user.email', 'me@x.com'); g('config', 'user.name', 'me');
    g('add', 'src'); g('commit', '-m', '第一次提交');
    const ev = await Evidence.collect([dir, path.join(dir, '不存在')], today, { days: {} }, false);
    assert.equal(ev.repos[0].commits[0], '第一次提交');
    assert.equal(ev.missing.length, 1);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
