// ============================================================
//  资料视图：时间规划（读规划数据）、励志名言
// ============================================================

var BUILTIN_QUOTES = [
  { text: '代码是写给人看的，顺便能让机器执行。', author: 'Harold Abelson' },
  { text: '先让它工作，再让它正确，最后让它快速。', author: 'Kent Beck' },
  { text: '任何傻瓜都能写出计算机能理解的代码。好的程序员能写出人能理解的代码。', author: 'Martin Fowler' },
  { text: 'Talk is cheap. Show me the code.', author: 'Linus Torvalds' },
  { text: '调试代码比写代码难一倍。所以如果你写代码时用尽了全部聪明，调试时就需要两倍的聪明。', author: 'Brian Kernighan' },
  { text: '我不是一个伟大的程序员，我只是一个有良好习惯的优秀程序员。', author: 'Kent Beck' },
  { text: '完美不是无可增加，而是无可删减。', author: '圣埃克苏佩里' },
  { text: '简洁是可靠的前提。', author: 'Dijkstra' },
  { text: '好的程序员关心代码，伟大的程序员关心数据结构。', author: 'Linus Torvalds' },
  { text: '编程不是关于你知道什么，而是关于你能弄清楚什么。', author: 'Chris Pine' },
  { text: '不要重复自己（DRY）。', author: 'Andy Hunt' },
  { text: '保持简单，傻瓜（KISS）。', author: 'Kelly Johnson' },
  { text: '重构不是奢侈品，而是必需品。', author: 'Martin Fowler' },
  { text: '不要优化你还没测量的东西。', author: '匿名' },
  { text: '阅读他人的代码，是提高编程能力最快的方式。', author: '匿名' },
  { text: '每个bug都是一次学习的机会。', author: '匿名' },
  { text: '编程是20%的编码和80%的调试。', author: '匿名' },
  { text: '你的代码就是你的作品集。', author: '匿名' },
  { text: '技术更新很快，但原理长存。学好原理。', author: '匿名' },
  { text: '你今天觉得难的代码，明天就会觉得简单。', author: '匿名' },
  { text: '千里之行，始于足下。', author: '老子' },
  { text: '不积跬步，无以至千里。', author: '荀子' },
  { text: '宝剑锋从磨砺出，梅花香自苦寒来。', author: '古诗' },
  { text: '天行健，君子以自强不息。', author: '《周易》' },
  { text: '种一棵树最好的时间是十年前，其次是现在。', author: '谚语' },
  { text: '不要害怕慢慢前行，要害怕停滞不前。', author: '中国谚语' },
  { text: '失败是成功之母。', author: '中国谚语' },
  { text: '今天的你，是昨天的你所决定的。', author: '匿名' },
  { text: '所有伟大的事情都需要时间。', author: '匿名' },
  { text: '每一次你写的代码比昨天好，你就是在进步。', author: '匿名' },
  { text: '每一个 expert 都曾是 beginner。', author: 'Helen Hayes' },
  { text: '一万小时定律：任何人做一件事一万小时，都能成为专家。', author: '格拉德威尔' },
  { text: '经验告诉你如何做，热情告诉你为什么做。', author: '匿名' },
  { text: '走得快，独自走；走得远，一起走。', author: '非洲谚语' },
  { text: '模仿、理解、创造——学习的三步曲。', author: '匿名' },
  { text: '最好的学习方式就是做一个项目。', author: '匿名' },
  { text: '你今天看的每一行代码，都在塑造你明天的能力。', author: '匿名' },
  { text: '学会读错误信息，它比你想的有用。', author: '匿名' },
  { text: '每天写一点代码，比一周写一次更有效。', author: '匿名' },
  { text: '当你觉得一个功能很难实现时，说明你的设计可能有问题。', author: '匿名' },
  { text: '编程是一种思维方式，不只是写代码。', author: '匿名' },
  { text: '少即是多。', author: 'Mies van der Rohe' },
  { text: '纸上谈兵终觉浅，绝知此事要躬行。', author: '陆游' },
  { text: '先完成，再完美。', author: 'Sheryl Sandberg' },
  { text: '如果你觉得太晚，其实正是最早的时候。', author: '匿名' },
  { text: '没有最好的语言，只有最适合的语言。', author: '匿名' },
  { text: '好的代码自己会说话。', author: '匿名' },
  { text: '你不需要一次写完所有功能。先写能用的。', author: '匿名' },
  { text: '最好的错误信息是那些根本不会出现的错误。', author: 'Thomas Fuchs' },
  { text: '代码就像幽默。当你不得不解释它的时候，它就很差。', author: 'Cory House' }
];

// ===== 时间规划：和路线图同一份数据 =====
function renderTimePlan() {
  $('timePlanBody').innerHTML = S.plan.stages.map(function (s) {
    return '<tr><td>' + escapeHtml(s.time || '—') + '</td><td>' + escapeHtml(s.title) + '</td><td>' + escapeHtml(s.output || '—') + '</td></tr>';
  }).join('');
}

// ===== 名言 =====
function pickRandomQuote() {
  var pool = BUILTIN_QUOTES.concat(S.quotes.custom || []);
  return pool[Math.floor(Math.random() * pool.length)];
}

function showDailyQuote() {
  var today = Dates.today();
  if (S.quotes.lastShownDate !== today) {
    S.quotes.lastShownDate = today;
    S.quotes.currentQuote = pickRandomQuote();
    Store.save('quotes.json', S.quotes);
  }
  displayQuote();
}

function displayQuote() {
  var q = S.quotes.currentQuote || (S.quotes.currentQuote = pickRandomQuote());
  $('quoteText').textContent = q.text;
  $('quoteAuthor').textContent = '— ' + (q.author || '匿名');
}

function refreshQuote() {
  S.quotes.currentQuote = pickRandomQuote();
  Store.save('quotes.json', S.quotes);
  displayQuote();
  var el = $('quoteText');
  el.style.opacity = '0';
  setTimeout(function () { el.style.transition = 'opacity .4s'; el.style.opacity = '1'; }, 50);
}

function addCustomQuote() {
  $('quoteModal').style.display = 'flex';
  $('quoteInput').value = '';
  $('quoteAuthorInput').value = '';
}

function saveCustomQuote() {
  var text = $('quoteInput').value.trim();
  if (!text) { showToast('请输入名言内容'); return; }
  (S.quotes.custom = S.quotes.custom || []).push({ text: text, author: $('quoteAuthorInput').value.trim() });
  Store.save('quotes.json', S.quotes);
  $('quoteModal').style.display = 'none';
  renderCustomQuotes();
  showToast('名言已添加');
}

function renderCustomQuotes() {
  var box = $('customQuotes'), list = S.quotes.custom || [];
  if (!list.length) { box.style.display = 'none'; return; }
  box.style.display = 'block';
  $('customQuotesList').innerHTML = '<div class="custom-quotes-title">我的收藏 (' + list.length + ')</div>' +
    list.map(function (q, i) {
      return '<div class="custom-quote-item"><div class="cq-text">' + escapeHtml(q.text) + '</div>' +
        (q.author ? '<div class="cq-author">— ' + escapeHtml(q.author) + '</div>' : '') +
        '<div class="cq-delete" data-idx="' + i + '">✕</div></div>';
    }).join('');
  document.querySelectorAll('.cq-delete').forEach(function (btn) {
    btn.addEventListener('click', function () {
      S.quotes.custom.splice(parseInt(btn.dataset.idx, 10), 1);
      Store.save('quotes.json', S.quotes);
      renderCustomQuotes();
      showToast('已删除');
    });
  });
}
