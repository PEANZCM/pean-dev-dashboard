// ============================================================
//  奖章墙
// ============================================================

function medalIcon(tier) { return iconSvg(tier === 'gold' ? 'trophy' : 'medal'); }

function renderMedalWall() {
  var M = S.medals, T = Rules.TIERS;
  var counts = { blue: 0, purple: 0, crimson: 0, gold: 0 };
  M.frozenMedals.forEach(function (m) { if (counts[m.tier] !== undefined) counts[m.tier]++; });
  $('medalStats').innerHTML = ['blue', 'purple', 'crimson', 'gold'].map(function (t) {
    return '<div class="medal-stat-item"><div class="medal-stat-num" style="color:' + T[t].color + '">' + counts[t] + '</div><div class="medal-stat-label">' + T[t].name + '</div></div>';
  }).join('');

  var cur = $('medalCurrent'), streak = currentStreak();
  if (M.liveMedal) {
    var lm = M.liveMedal;
    cur.innerHTML = '<div class="medal-current-title">当前连续打卡</div><div class="medal-current-streak">' + lm.days + ' 天</div>' +
      '<div class="medal-current-tier" style="color:' + T[lm.tier].color + '">' + T[lm.tier].name + ' · ' + escapeHtml(lm.label) + '</div>';
  } else if (streak > 0) {
    cur.innerHTML = '<div class="medal-current-title">当前连续打卡</div><div class="medal-current-streak">' + streak + ' 天</div>' +
      '<div class="medal-current-tier" style="color:var(--muted)">再坚持 ' + (T.blue.min - streak) + ' 天获得首个奖章</div>';
  } else {
    cur.innerHTML = '<div class="medal-current-title">尚未开始连续打卡</div><div class="medal-current-streak" style="font-size:16px;color:var(--muted)">今天打卡开始你的旅程</div>';
  }

  var all = [];
  if (M.liveMedal) all.push(Object.assign({}, M.liveMedal, { live: true }));
  M.frozenMedals.slice().sort(function (a, b) { return a.dateEarned < b.dateEarned ? -1 : 1; }).forEach(function (m) { all.push(m); });
  $('medalGrid').innerHTML = all.length ? all.map(function (m) {
    return '<div class="medal-item medal-tier-' + m.tier + (m.live ? ' live' : '') + '">' +
      (m.live ? '<span class="medal-live-badge">进行中</span>' : '') +
      '<div class="medal-circle">' + medalIcon(m.tier) + '<div class="medal-days">' + m.days + '</div></div>' +
      '<div class="medal-label">' + escapeHtml(m.label) + '</div>' +
      '<div class="medal-date">' + (m.dateEarned ? Dates.cn(m.dateEarned) : '') + '</div></div>';
  }).join('') :
    '<div class="medal-empty"><div class="medal-empty-icon">' + iconSvg('medal') + '</div><div class="medal-empty-text">还没有奖章</div><div class="medal-empty-hint">连续打卡21天获得第一个蓝奖章</div></div>';

  var gs = $('grandSlamSection');
  if (M.grandSlam > 0) {
    gs.style.display = 'block';
    gs.innerHTML = '<div class="grand-slam-title">' + iconSvg('trophy') + ' 大满贯成就</div><div class="grand-slam-medal">' +
      '<div class="grand-slam-hex"><svg viewBox="0 0 72 72"><polygon points="36,4 64,20 64,52 36,68 8,52 8,20" fill="url(#gsGrad)" stroke="#FFD700" stroke-width="2"/><defs><linearGradient id="gsGrad" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FFD700"/><stop offset="1" stop-color="#FF3B30"/></linearGradient></defs></svg></div>' +
      '<div class="grand-slam-label">大满贯' + (M.grandSlam > 1 ? '*' + M.grandSlam : '') + '</div>' +
      '<div class="grand-slam-count">同时拥有世锦赛 + 奥运会奖章</div></div>';
  } else {
    gs.style.display = 'none';
  }
}
