// ============================================================
//  打卡规则：连续天数 · 火焰 · 奖章（纯逻辑，不碰 DOM）
//  state = { checkin:{dates}, streak, flame, medals }
//  所有函数直接修改传入的 state，返回值只用于提示文案
// ============================================================
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./dates.js'));
  else root.Rules = factory(root.Dates);
})(this, function (Dates) {
  'use strict';

  var TIERS = {
    none:    { min: 0,   name: '无',       color: '#999',    labels: [] },
    blue:    { min: 21,  name: '蓝奖章',   color: '#4A90D9', labels: ['印度公开赛', '新加坡公开赛', '中国大师赛', '丹麦公开赛', '法国公开赛', '日本公开赛'] },
    purple:  { min: 54,  name: '淡紫奖章', color: '#9B8ADC', labels: ['BWF总决赛', '中国公开赛', '印尼公开赛', '全英公开赛', '马来西亚公开赛'] },
    crimson: { min: 128, name: '大红奖章', color: '#E53935', labels: ['世锦赛'] },
    gold:    { min: 512, name: '金光奖章', color: '#FFD700', labels: ['奥运会'] }
  };
  var ORDER = ['none', 'blue', 'purple', 'crimson', 'gold'];

  function getTier(days) {
    for (var i = ORDER.length - 1; i > 0; i--) if (days >= TIERS[ORDER[i]].min) return ORDER[i];
    return 'none';
  }
  function higher(a, b) { return ORDER.indexOf(a) > ORDER.indexOf(b); }

  function dateSet(state) { return new Set(state.checkin.dates); }

  /* 从今天（没打则从昨天）往回数连续打卡天数，并给出这一段的起始日 */
  function computeStreak(set, now) {
    var t = Dates.today(now), y = Dates.yesterday(now), start;
    if (set.has(t)) start = t;
    else if (set.has(y)) start = y;
    else return { n: 0, start: null };
    var d = Dates.parse(start), n = 0, first = start;
    while (set.has(Dates.fmt(d))) { first = Dates.fmt(d); n++; d.setDate(d.getDate() - 1); }
    return { n: n, start: first };
  }

  /* ---------- 火焰 ---------- */
  // 三进制：3 小 = 1 中，9 小 = 1 大
  function flameBreakdown(total) {
    return { large: Math.floor(total / 9), medium: Math.floor(total % 9 / 3), small: total % 3 };
  }
  // 50 / 100 / 365 天里程碑后每 10 天一个超级火焰
  function superFlames(streak) {
    if (streak < 50) return [];
    var level = streak >= 365 ? 'mega' : streak >= 100 ? 'super' : 'big';
    var base = streak >= 365 ? 365 : streak >= 100 ? 100 : 50;
    var out = [], n = Math.floor((streak - base) / 10) + 1;
    for (var i = 0; i < n; i++) out.push(level);
    return out;
  }
  function superFlameLabel(streak) {
    if (streak >= 365) return '365天里程碑 · 每10天一个究极火焰';
    if (streak >= 100) return '100天里程碑 · 每10天一个超级火焰';
    if (streak >= 50) return '50天里程碑 · 每10天一个大火焰';
    return '';
  }

  /* ---------- 奖章 ---------- */
  function assignLabel(medals, tier, rand) {
    var labels = TIERS[tier].labels;
    if (!labels.length) return '';
    var mem = medals.labelMemory[tier] || (medals.labelMemory[tier] = []);
    var pool = labels.filter(function (l) { return mem.indexOf(l) === -1; });
    if (!pool.length) { mem.length = 0; pool = labels; }
    var label = pool[Math.floor((rand || Math.random)() * pool.length)];
    mem.push(label);
    return label;
  }

  /* 奖章跟随连续天数：升级、撤销打卡导致的降级、跌破 21 天时收回。
     每个等级的名号记在 labels 里，反复撤销/重打不会消耗新名号 */
  function updateMedal(state, streak, startDate, rand) {
    var m = state.medals, tier = getTier(streak), live = m.liveMedal;
    if (live && !live.labels) { live.labels = {}; live.labels[live.tier] = live.label; }
    if (tier === 'none') {
      if (live) { m.revoked = { startDate: live.startDate, labels: live.labels }; m.liveMedal = null; }
      return;
    }
    if (!live) {
      var labels = m.revoked && m.revoked.startDate === startDate ? m.revoked.labels : {};
      m.revoked = null;
      live = m.liveMedal = { tier: tier, label: '', days: streak, startDate: startDate, maxTier: tier, labels: labels };
      live.label = labels[tier] || (labels[tier] = assignLabel(m, tier, rand));
      return;
    }
    live.days = streak;
    if (tier !== live.tier) {
      live.tier = live.maxTier = tier;
      live.label = live.labels[tier] || (live.labels[tier] = assignLabel(m, tier, rand));
    }
  }

  function freezeMedal(state, days, now) {
    var m = state.medals;
    if (!m.liveMedal) return;
    var l = m.liveMedal;
    m.frozenMedals.push({ tier: l.tier, label: l.label, days: days, dateEarned: Dates.today(now), startDate: l.startDate, frozen: true });
    m.liveMedal = null;
    var count = function (t) { return m.frozenMedals.filter(function (x) { return x.tier === t; }).length; };
    m.grandSlam = Math.min(count('crimson'), count('gold'));
  }

  /* ---------- 打卡动作 ---------- */
  function refresh(state, now, rand) {
    var s = computeStreak(dateSet(state), now);
    state.streak.current = s.n;
    state.streak.startDate = s.start;
    updateMedal(state, s.n, s.start, rand);
    return s.n;
  }

  function checkin(state, now, rand) {
    var t = Dates.today(now);
    if (state.checkin.dates.indexOf(t) !== -1) return { ok: false, msg: '今天已经打卡了' };
    state.checkin.dates.push(t);
    state.streak.lastUpdate = t;
    state.flame.total++;
    refresh(state, now, rand);
    return { ok: true, msg: '打卡成功，火焰 +1' };
  }

  function makeup(state, now, rand) {
    var y = Dates.yesterday(now);
    if (state.checkin.dates.indexOf(y) !== -1) return { ok: false, msg: '昨天已经打卡了' };
    state.checkin.dates.push(y);
    state.flame.total++;
    refresh(state, now, rand);
    return { ok: true, msg: '补打成功！连续天数已恢复' };
  }

  function cancel(state, now, rand) {
    var t = Dates.today(now), i = state.checkin.dates.indexOf(t);
    if (i === -1) return { ok: false, msg: '今天还没打卡' };
    state.checkin.dates.splice(i, 1);
    state.flame.total = Math.max(0, state.flame.total - 1);
    refresh(state, now, rand);
    return { ok: true, msg: '已取消今日打卡' };
  }

  /* 断签：今天、昨天、前天都没打卡（前天打过还能靠补打昨天救回来）
     → 冻结奖章、扣 2 个火焰、连续天数清零 */
  function detectBreak(state, now) {
    if (!state.streak.current) return false;
    var set = dateSet(state);
    if (set.has(Dates.today(now)) || set.has(Dates.yesterday(now)) || set.has(Dates.dayBefore(now))) return false;
    freezeMedal(state, state.streak.current, now);
    state.flame.total = Math.max(0, state.flame.total - 2);
    state.streak.current = 0;
    state.streak.startDate = null;
    return true;
  }

  return {
    TIERS: TIERS, ORDER: ORDER, getTier: getTier, higher: higher,
    computeStreak: computeStreak, flameBreakdown: flameBreakdown,
    superFlames: superFlames, superFlameLabel: superFlameLabel,
    updateMedal: updateMedal, freezeMedal: freezeMedal,
    checkin: checkin, makeup: makeup, cancel: cancel, detectBreak: detectBreak
  };
});
