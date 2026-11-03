// ============================================================
//  通用工具：数据读写、HTML 转义、Markdown、Toast
// ============================================================

// ===== 数据存储（Electron userData/data/ 目录，主进程原子写入） =====
// 文件末尾残留了旧内容时（JSON 后面多出一截），取出第一个完整的对象。
// 旧版遇到这种文件会当成空数据，下次保存就把原内容整个覆盖掉
function salvageJson(raw) {
  var depth = 0, inStr = false, esc = false;
  for (var i = 0; i < raw.length; i++) {
    var c = raw[i];
    if (inStr) { if (esc) esc = false; else if (c === '\\') esc = true; else if (c === '"') inStr = false; continue; }
    if (c === '"') inStr = true;
    else if (c === '{' || c === '[') depth++;
    else if ((c === '}' || c === ']') && --depth === 0) return JSON.parse(raw.slice(0, i + 1));
  }
  throw new Error('无法修复');
}

var Store = {
  cache: {},
  async load(name, def) {
    if (name in this.cache) return this.cache[name];
    var raw = null;
    try { raw = await dashboardAPI.readFile(name); } catch (e) { console.error('read failed:', name, e); }
    if (raw) {
      try { return (this.cache[name] = JSON.parse(raw)); }
      catch (e) {
        try {
          var d = salvageJson(raw);
          console.warn('repaired corrupted file:', name);
          await this.save(name, d);   // 立即写回干净的版本
          return d;
        } catch (e2) { console.error('load failed:', name, e); }
      }
    }
    this.cache[name] = def;
    return def;
  },
  async save(name, data) {
    this.cache[name] = data;
    try { await dashboardAPI.writeFile(name, JSON.stringify(data)); } catch (e) { console.error('save failed:', name, e); }
  }
};

function escapeHtml(s) {
  if (s == null) return '';
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// 只放行 http(s) 链接，其余（javascript: 等）一律当纯文本
function safeUrl(u) {
  u = String(u).trim();
  return /^https?:\/\//i.test(u) ? u : '';
}

// ===== Markdown（日记预览；以后 AI 生成的内容也走这里，所以必须转义 + 过滤链接） =====
function inlineMd(text) {
  text = text.replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, function (m, alt, src) {
    var u = safeUrl(src.replace(/&amp;/g, '&'));
    return u ? '<img src="' + escapeHtml(u) + '" alt="' + alt + '">' : m;
  });
  text = text.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, function (m, t, href) {
    var u = safeUrl(href.replace(/&amp;/g, '&'));
    return u ? '<a href="' + escapeHtml(u) + '" data-external>' + t + '</a>' : m;
  });
  text = text.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  text = text.replace(/\*(.+?)\*/g, '<em>$1</em>');
  text = text.replace(/~~(.+?)~~/g, '<del>$1</del>');
  text = text.replace(/`([^`]+)`/g, '<code>$1</code>');
  return text;
}

function parseMarkdown(text) {
  if (!text) return '';
  text = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  var lines = text.split('\n'), html = [];
  var inList = false, inOl = false, inCode = false, inQuote = false;
  function closeLists() {
    if (inList) { html.push('</ul>'); inList = false; }
    if (inOl) { html.push('</ol>'); inOl = false; }
  }
  for (var i = 0; i < lines.length; i++) {
    var line = lines[i];
    if (line.trim().indexOf('```') === 0) { inCode = !inCode; html.push(inCode ? '<pre><code>' : '</code></pre>'); continue; }
    if (inCode) { html.push(line); continue; }
    var h = line.match(/^(#{1,3})\s+(.+)/);
    if (h) { closeLists(); html.push('<h' + h[1].length + '>' + inlineMd(h[2]) + '</h' + h[1].length + '>'); continue; }
    if (line.trim().indexOf('&gt;') === 0) {
      if (!inQuote) { html.push('<blockquote>'); inQuote = true; }
      html.push(inlineMd(line.replace(/^\s*&gt;\s?/, '')));
      continue;
    } else if (inQuote) { html.push('</blockquote>'); inQuote = false; }
    var ol = line.match(/^\d+\.\s+(.+)/);
    if (ol) { if (inList) { html.push('</ul>'); inList = false; } if (!inOl) { html.push('<ol>'); inOl = true; } html.push('<li>' + inlineMd(ol[1]) + '</li>'); continue; }
    var ul = line.match(/^[-*]\s+(.+)/);
    if (ul) { if (inOl) { html.push('</ol>'); inOl = false; } if (!inList) { html.push('<ul>'); inList = true; } html.push('<li>' + inlineMd(ul[1]) + '</li>'); continue; }
    closeLists();
    if (!line.trim()) { html.push(''); continue; }
    html.push('<p>' + inlineMd(line) + '</p>');
  }
  closeLists();
  if (inQuote) html.push('</blockquote>');
  if (inCode) html.push('</code></pre>');
  return html.join('\n');
}

// 日记预览里的链接交给系统浏览器打开
document.addEventListener('click', function (e) {
  var a = e.target.closest && e.target.closest('a[data-external]');
  if (!a) return;
  e.preventDefault();
  if (window.dashboardAPI && dashboardAPI.openExternal) dashboardAPI.openExternal(a.getAttribute('href'));
});

// ===== Toast =====
var toastTimer = null;
function showToast(msg) {
  var el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(function () { el.classList.remove('show'); }, 2500);
}

function $(id) { return document.getElementById(id); }
