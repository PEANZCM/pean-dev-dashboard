// ============================================================
//  DeepSeek 请求（主进程，Key 永远不进渲染进程）
//  接口按官方文档 2026-11：POST https://api.deepseek.com/chat/completions
//  模型：deepseek-flash（快）、deepseek-v4-pro（深度）
//  每次请求都在 system 最前面写入本机实时时间，AI 不用猜现在几点
// ============================================================
const BASE = 'https://api.deepseek.com';
const MODELS = { flash: 'deepseek-flash', pro: 'deepseek-v4-pro' };
const MODEL_ID = /^[a-z0-9][a-z0-9._-]*-[a-z0-9._-]+$/i;
const WEEK = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];

function localTime(now) {
  const d = now || new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const off = -d.getTimezoneOffset();
  const zone = 'UTC' + (off >= 0 ? '+' : '-') + Math.floor(Math.abs(off) / 60) + (off % 60 ? ':' + pad(Math.abs(off) % 60) : '');
  const name = Intl.DateTimeFormat().resolvedOptions().timeZone;
  return d.getFullYear() + '年' + (d.getMonth() + 1) + '月' + d.getDate() + '日 ' + WEEK[d.getDay()] + ' ' +
    pad(d.getHours()) + ':' + pad(d.getMinutes()) + '（' + name + '，' + zone + '）';
}

// 深度任务默认用 pro + 思考；短文案用 flash 且关掉思考，秒回
function pickModel(setting, deep) {
  if (setting === 'flash' || setting === 'pro') return MODELS[setting];
  if (MODEL_ID.test(setting || '')) return setting;   // 设置里选的是接口列出的具体模型
  return deep ? MODELS.pro : MODELS.flash;
}

function buildBody(o, now) {
  const body = {
    model: pickModel(o.model, o.deep),
    messages: [{ role: 'system', content: '当前本地时间：' + localTime(now) + '\n' + (o.system || '') }].concat(o.messages || []),
    thinking: { type: o.deep ? 'enabled' : 'disabled' },
    stream: false
  };
  if (o.maxTokens) body.max_tokens = o.maxTokens;
  if (o.json) body.response_format = { type: 'json_object' };
  return body;
}

function httpError(status, detail) {
  if (status === 401) return 'API Key 无效，请到设置里检查';
  if (status === 402) return 'DeepSeek 账户余额不足';
  if (status === 429) return '请求太频繁，稍后再试';
  if (status === 400 || status === 422) return '请求被拒绝：' + (detail || status);
  if (status >= 500) return 'DeepSeek 服务繁忙，稍后再试';
  return '请求失败（' + status + '）';
}

// 返回 { ok:true, text } 或 { ok:false, error }，不抛异常
async function chat(key, o, opts) {
  const options = opts || {};
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), options.timeoutMs || (o.deep ? 180000 : 45000));
  try {
    const res = await (options.fetch || fetch)((options.base || BASE) + '/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + key },
      body: JSON.stringify(buildBody(o)),
      signal: ctrl.signal
    });
    const raw = await res.text();
    let data = null;
    try { data = JSON.parse(raw); } catch (e) {}
    if (!res.ok) return { ok: false, error: httpError(res.status, data && data.error && data.error.message) };
    const choice = data && data.choices && data.choices[0];
    const text = choice && choice.message && (choice.message.content || '').trim();
    // JSON 模式下输出不合法时，官方会把内容换成空白；被截断时 finish_reason 是 length
    if (choice && choice.finish_reason === 'length') return { ok: false, error: '回复太长被截断了，再试一次' };
    if (!text) return { ok: false, error: 'AI 没有返回内容，再试一次' };
    return { ok: true, text };
  } catch (e) {
    return { ok: false, offline: true, error: e.name === 'AbortError' ? '请求超时' : '连不上 DeepSeek，检查一下网络' };
  } finally {
    clearTimeout(timer);
  }
}

// 账号当前能用的模型，直接问接口，DeepSeek 上新模型时设置里自动出现
async function listModels(key, opts) {
  const options = opts || {};
  try {
    const res = await (options.fetch || fetch)((options.base || BASE) + '/models', {
      headers: { Authorization: 'Bearer ' + key }, signal: AbortSignal.timeout(15000)
    });
    if (!res.ok) return { ok: false, error: httpError(res.status) };
    const data = await res.json();
    const ids = (data && Array.isArray(data.data) ? data.data : []).map((m) => m && m.id).filter((id) => MODEL_ID.test(id || ''));
    return { ok: true, models: ids };
  } catch (e) {
    return { ok: false, offline: true, error: '连不上 DeepSeek，检查一下网络' };
  }
}

module.exports = { MODELS, localTime, pickModel, buildBody, httpError, chat, listModels };
