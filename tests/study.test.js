const test = require('node:test');
const assert = require('node:assert');
const Review = require('../src/js/review.js');
const Evidence = require('../evidence.js');

const start = new Date('2026-11-04T10:00:00').getTime();
const study = () => ({ running: { start, beat: start, task: '写组件', away: 120 }, sessions: {} });

test('结束陪学：记到开始那天，累计时长正确', () => {
  const s = study();
  const r = Review.finishSession(s, start + 30 * 60 * 1000);
  assert.equal(r.sec, 1800);
  assert.equal(r.away, 120);
  assert.equal(s.running, null);
  assert.equal(Review.studyTotal(s, '2026-11-04'), 1800);
  assert.equal(Review.studyTotal(s, '2026-11-05'), 0);
});

test('不到 1 分钟不记录', () => {
  const s = study();
  assert.equal(Review.finishSession(s, start + 59 * 1000), null);
  assert.equal(s.running, null);
  assert.deepEqual(s.sessions, {});
});

test('软件关过：按最后一次心跳结束，心跳新鲜就继续', () => {
  const s = study();
  s.running.beat = start + 20 * 60 * 1000;
  assert.equal(Review.closeStale(s, start + 25 * 60 * 1000), null);
  assert.ok(s.running);
  const r = Review.closeStale(s, start + 5 * 3600 * 1000);
  assert.equal(r.sec, 1200);
  assert.equal(s.running, null);
});

test('分心：连续 5 分钟才提醒，回到开发软件清零，10 分钟内不重复', () => {
  const a = { sec: 0, lastNudge: 0 };
  const away = { dev: false, self: false, idle: false, sec: 150 };
  assert.equal(Review.awayStep(a, away, start), false);
  assert.equal(Review.awayStep(a, { dev: true, self: false, idle: false, sec: 15 }, start), false);
  assert.equal(a.sec, 0);
  Review.awayStep(a, away, start);
  assert.equal(Review.awayStep(a, away, start), true);
  assert.equal(Review.awayStep(a, away, start + 60000), false);
  assert.equal(Review.awayStep(a, away, start + 11 * 60000), true);
});

test('分心：看这个软件本身不算离开也不算回来；人走了就算开着开发软件也算离开', () => {
  const a = { sec: 200, lastNudge: 0 };
  assert.equal(Review.awayStep(a, { dev: false, self: true, idle: false, sec: 300 }, start), false);
  assert.equal(a.sec, 200);
  assert.equal(Review.awayStep(a, { dev: true, self: false, idle: true, sec: 100 }, start), true);
});

test('软件分类', () => {
  assert.equal(Evidence.isDev('Code'), true);
  assert.equal(Evidence.isDev('chrome'), false);
  assert.equal(Evidence.isSelf('PEAN的开发小天地'), true);
  assert.equal(Evidence.isSelf('electron'), true);
  assert.equal(Evidence.isSelf('Code'), false);
});

test('证据：陪学时长写给 AI', () => {
  const base = { folderCount: 0, folders: [], repos: [], tracking: false, usage: {}, diary: { chars: 0 }, shots: 0 };
  assert.match(Review.evidenceText(Object.assign({}, base, { study: { sec: 3600, count: 2 } })), /陪学计时】1 小时 0 分，共 2 段/);
  assert.match(Review.evidenceText(Object.assign({}, base, { study: { sec: 0, count: 0 } })), /当天没有计时/);
});
