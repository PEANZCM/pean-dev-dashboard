const test = require('node:test');
const assert = require('node:assert/strict');
const Rules = require('../src/js/rules.js');
const Dates = require('../src/js/dates.js');

const DAY = 86400000;
const NOW = new Date(2026, 10, 4, 12, 0, 0).getTime();   // 2026-11-04 中午
const at = (d) => NOW + d * DAY;                          // 相对今天第 d 天
const rand = () => 0;

function fresh(dates) {
  return {
    checkin: { dates: dates || [] },
    streak: { current: 0, startDate: null, lastUpdate: null },
    flame: { total: 0 },
    medals: { liveMedal: null, frozenMedals: [], labelMemory: { blue: [], purple: [], crimson: [], gold: [] }, grandSlam: 0 }
  };
}
function daysBack(n, endOffset) {
  const out = [];
  for (let i = n - 1; i >= 0; i--) out.push(Dates.today(at(endOffset - i)));
  return out;
}

test('打卡：连续天数 +1，火焰 +1，重复打卡无效', () => {
  const s = fresh(daysBack(3, -1));
  s.streak.current = 3;
  assert.equal(Rules.checkin(s, NOW, rand).ok, true);
  assert.equal(s.streak.current, 4);
  assert.equal(s.flame.total, 1);
  assert.equal(Rules.checkin(s, NOW, rand).ok, false);
  assert.equal(s.flame.total, 1);
});

test('反复打卡再取消刷不出火焰', () => {
  const s = fresh();
  for (let i = 0; i < 5; i++) { Rules.checkin(s, NOW, rand); Rules.cancel(s, NOW, rand); }
  assert.equal(s.flame.total, 0);
  assert.equal(s.streak.current, 0);
});

test('第 21 天拿到蓝奖章；取消当天打卡后收回；重打用回同一名号', () => {
  const s = fresh(daysBack(20, -1));
  Rules.checkin(s, NOW, rand);
  assert.equal(s.streak.current, 21);
  assert.equal(s.medals.liveMedal.tier, 'blue');
  const label = s.medals.liveMedal.label;
  Rules.cancel(s, NOW, rand);
  assert.equal(s.medals.liveMedal, null, '跌破 21 天应收回奖章（旧版会残留）');
  Rules.checkin(s, NOW, rand);
  assert.equal(s.medals.liveMedal.label, label);
  assert.equal(s.medals.labelMemory.blue.length, 1, '不应消耗新名号');
});

test('撤销打卡导致降级：紫 → 蓝，恢复原来的蓝名号', () => {
  const s = fresh(daysBack(52, -2));         // 截止前天连续 52 天
  Rules.makeup(s, NOW, rand);                 // 补打昨天 → 53 天，拿到蓝奖章
  assert.equal(s.medals.liveMedal.tier, 'blue');
  Rules.checkin(s, NOW, rand);                // 今天 → 54 天，升紫
  assert.equal(s.streak.current, 54);
  assert.equal(s.medals.liveMedal.tier, 'purple');
  const blue = s.medals.liveMedal.labels.blue;
  Rules.cancel(s, NOW, rand);
  assert.equal(s.medals.liveMedal.tier, 'blue');
  assert.equal(s.medals.liveMedal.label, blue);
});

test('补打昨天把断开的两段连起来', () => {
  const s = fresh(daysBack(5, -2));          // 截止前天的 5 天
  Rules.checkin(s, NOW, rand);               // 今天打卡，昨天空着 → 只算 1 天
  assert.equal(s.streak.current, 1);
  assert.equal(Rules.makeup(s, NOW, rand).ok, true);
  assert.equal(s.streak.current, 7);
  assert.equal(s.streak.startDate, Dates.today(at(-6)));
});

test('断签：前天打过不算断（还能补打）；连续 3 天没打才断', () => {
  const s = fresh(daysBack(4, -2));
  s.streak.current = 4;
  assert.equal(Rules.detectBreak(s, NOW), false);
  const s2 = fresh(daysBack(4, -3));
  s2.streak.current = 4; s2.flame.total = 5;
  assert.equal(Rules.detectBreak(s2, NOW), true);
  assert.equal(s2.streak.current, 0);
  assert.equal(s2.flame.total, 3);
});

test('断签时冻结进行中的奖章并计算大满贯', () => {
  const s = fresh();
  s.streak.current = 30;
  s.medals.liveMedal = { tier: 'blue', label: '日本公开赛', days: 30, startDate: '2026-09-01', maxTier: 'blue' };
  Rules.detectBreak(s, NOW);
  assert.equal(s.medals.frozenMedals.length, 1);
  assert.equal(s.medals.frozenMedals[0].days, 30);
  assert.equal(s.medals.liveMedal, null);
});

test('你的真实数据：11-01 后连续 3 天未打卡，今天零点被判断签是正确的', () => {
  const s = fresh(['2026-10-29', '2026-10-30', '2026-10-31', '2026-11-01']);
  s.streak.current = 4;
  assert.equal(Rules.detectBreak(s, NOW), true);
});

test('火焰换算与超级火焰', () => {
  assert.deepEqual(Rules.flameBreakdown(17), { large: 1, medium: 2, small: 2 });
  assert.equal(Rules.superFlames(49).length, 0);
  assert.equal(Rules.superFlames(70).length, 3);
  assert.equal(Rules.superFlames(100)[0], 'super');
});
