/* ===========================================================
 *  Markdown Studio · CSS 内联引擎（微信公众号导出核心）
 *  微信编辑器只保留 inline style，会剥离 <style>/class 规则，
 *  因此必须把主题 CSS 逐元素写入 style 属性（类似 juice 的浏览器实现）。
 * =========================================================== */

/* ---------- 1. CSS 解析 ---------- */
function parseCSS(cssText) {
  const css = String(cssText).replace(/\/\*[\s\S]*?\*\//g, '');
  const rules = [];
  let i = 0, guard = 0;
  while (i < css.length && guard++ < 20000) {
    const lb = css.indexOf('{', i);
    if (lb < 0) break;
    const selectorText = css.slice(i, lb).trim();
    let depth = 1, j = lb + 1;
    while (j < css.length && depth > 0) {
      const ch = css[j];
      if (ch === '{') depth++;
      else if (ch === '}') depth--;
      j++;
    }
    const body = css.slice(lb + 1, j - 1);
    if (selectorText.startsWith('@')) {
      // 只递归纯 screen 媒体查询，其余（@font-face/@keyframes）忽略
      if (/^@media[^{]*screen[^{]*$/i.test(selectorText) && !/max-width|min-width/i.test(selectorText)) {
        parseCSS(body).forEach(r => rules.push(r));
      }
    } else {
      const selectors = selectorText.split(',').map(s => s.trim()).filter(Boolean);
      if (selectors.length) rules.push({ selectors, body });
    }
    i = j;
  }
  return rules;
}

/* ---------- 2. 声明拆分（忽略括号/引号内的分号） ---------- */
function splitDecls(body) {
  const out = [];
  let buf = '', depth = 0, quote = null;
  for (const ch of body) {
    if (quote) { buf += ch; if (ch === quote) quote = null; continue; }
    if (ch === '"' || ch === "'") { quote = ch; buf += ch; continue; }
    if (ch === '(') depth++;
    if (ch === ')') depth--;
    if (ch === ';' && depth === 0) { if (buf.trim()) out.push(buf.trim()); buf = ''; continue; }
    buf += ch;
  }
  if (buf.trim()) out.push(buf.trim());
  return out.filter(d => d.includes(':'));
}

/* ---------- 3. 选择器特异性 ---------- */
function specificity(sel) {
  let s = sel;
  let a = 0, b = 0, c = 0;
  s = s.replace(/#[\w-]+/g, () => { a++; return ' '; });
  s = s.replace(/\.[\w-]+/g, () => { b++; return ' '; });
  s = s.replace(/\[[^\]]*\]/g, () => { b++; return ' '; });
  s = s.replace(/::[\w-]+/g, () => { c++; return ' '; });
  s = s.replace(/(?<!:):(?!:)[\w-]+(\([^)]*\))?/g, () => { b++; return ' '; });
  const tags = s.match(/[a-zA-Z][\w-]*/g);
  if (tags) c += tags.length;
  return a * 10000 + b * 100 + c;
}

/* ---------- 4. CSS 变量解析 ---------- */
function collectVars(rules) {
  const map = {};
  rules.forEach(r => splitDecls(r.body).forEach(d => {
    const m = d.match(/^(--[\w-]+)\s*:\s*([\s\S]+)$/);
    if (m) map[m[1]] = m[2].trim();
  }));
  return map;
}
function resolveVars(text, vars, depth = 0) {
  if (depth > 6 || !text.includes('var(')) return text;
  return text.replace(/var\(\s*(--[\w-]+)\s*(?:,\s*([^()]*))?\)/g, (full, name, fallback) => {
    if (vars[name] != null) return vars[name];
    if (fallback != null) return fallback.trim();
    return full;
  });
}

/* ---------- 5. 内联主流程 ---------- */
const SKIP_PSEUDO = /:(hover|active|focus|focus-within|focus-visible|visited|target|checked|disabled|before|after|first-line|first-letter|selection|placeholder|marker|backdrop)\b/;

function inlineStyles(html, cssTextList) {
  const doc = document.implementation.createHTMLDocument('md-studio');
  const host = doc.createElement('div');
  host.innerHTML = html;

  const rules = [];
  cssTextList.forEach(t => { if (t) parseCSS(t).forEach(r => rules.push(r)); });
  const vars = collectVars(rules);

  const buckets = new Map();
  rules.forEach((rule, idx) => {
    rule.selectors.forEach(sel => {
      if (SKIP_PSEUDO.test(sel)) return;
      let nodes;
      try { nodes = host.querySelectorAll(sel); } catch (e) { return; }
      const spec = specificity(sel);
      nodes.forEach(node => {
        let arr = buckets.get(node);
        if (!arr) { arr = []; buckets.set(node, arr); }
        arr.push({ spec, order: idx, body: rule.body });
      });
    });
  });

  buckets.forEach((list, el) => {
    list.sort((x, y) => (x.spec - y.spec) || (x.order - y.order));
    const normal = [], important = [];
    list.forEach(it => {
      splitDecls(resolveVars(it.body, vars)).forEach(d => {
        (/!important/i.test(d) ? important : normal).push(d);
      });
    });
    const merged = dedupeDecls([...normal, ...important]);
    if (!merged.length) return;
    const origin = (el.getAttribute('style') || '').trim().replace(/;\s*$/, '');
    el.setAttribute('style', merged.join('; ') + ';' + (origin ? ' ' + origin + ';' : ''));
  });

  // 保留原有内联样式（渲染阶段已有的 img 宽度等）在最后生效
  return host.innerHTML;
}

function dedupeDecls(decls) {
  const order = [], map = new Map();
  decls.forEach(d => {
    const key = d.split(':')[0].trim().toLowerCase();
    if (!key) return;
    if (!map.has(key)) order.push(key);
    map.set(key, d.trim());
  });
  return order.map(k => map.get(k));
}

/* ---------- 6. 微信兼容清理 ---------- */
function wechatClean(html, opts = {}) {
  const doc = document.implementation.createHTMLDocument('md-studio-wx');
  const host = doc.createElement('div');
  host.innerHTML = html;

  // 移除危险/无效标签
  ['script', 'style', 'link', 'meta', 'iframe', 'object', 'embed', 'form', 'input', 'button', 'noscript', 'textarea'].forEach(tag => {
    host.querySelectorAll(tag).forEach(n => n.remove());
  });
  // MathJax 的无障碍 MathML 副本微信不认，去掉可显著减小体积
  host.querySelectorAll('mjx-assistive-mml, mjx-container, annotation, annotation-xml').forEach(n => n.remove());
  // 事件属性 & data-* 清理
  host.querySelectorAll('*').forEach(el => {
    [...el.attributes].forEach(attr => {
      const n = attr.name.toLowerCase();
      if (n.startsWith('on') || n.startsWith('data-')) el.removeAttribute(attr.name);
    });
    if (opts.stripClass) el.removeAttribute('class');
  });
  // 图片：保证自适应；公式图已有确定宽高，不再追加
  host.querySelectorAll('img').forEach(img => {
    const isMath = img.getAttribute('width') && img.getAttribute('height');
    if (!isMath) img.setAttribute('style', (img.getAttribute('style') || '') + ';max-width:100%;height:auto;');
    else img.setAttribute('style', (img.getAttribute('style') || '') + ';max-width:100%;');
    if (!img.getAttribute('alt')) img.setAttribute('alt', '');
  });
  // 表格：微信里 table 需要显式宽度
  host.querySelectorAll('table').forEach(t => {
    t.setAttribute('style', (t.getAttribute('style') || '') + ';width:100%;border-collapse:collapse;');
  });
  // 外链：公众号正文不解析普通外链，可选转为「文字(链接)」
  if (opts.linkToText) {
    host.querySelectorAll('a').forEach(a => {
      const href = a.getAttribute('href') || '';
      if (!href || href.startsWith('#')) return;
      if (/^https?:\/\/mp\.weixin\.qq\.com/.test(href)) return;
      const t = doc.createElement('span');
      t.textContent = a.textContent;
      const u = doc.createElement('span');
      u.setAttribute('style', 'color:#a0a0a0;font-size:.82em;word-break:break-all;');
      u.textContent = ' (' + href + ')';
      a.replaceWith(t, u);
    });
  }
  return host.innerHTML.trim();
}

/* ---------- 7. 一键导出：渲染结果 → 微信可用 HTML ---------- */
function buildWechatHTML(previewEl, themeId, opts = {}) {
  const src = previewEl.querySelector('.md-body');
  if (!src) return '';
  const raw = src.innerHTML;
  const css = buildExportCSS(themeId);
  const inlined = inlineStyles(raw, [css]);
  return wechatClean(inlined, opts);
}

/* ---------- 8. 富文本复制（file:// 下无 Clipboard API 权限，用 execCommand） ---------- */
function copyRichHTML(html) {
  const box = document.createElement('div');
  box.contentEditable = 'true';
  box.style.cssText = 'position:fixed;left:-99999px;top:0;width:600px;background:#fff;';
  box.innerHTML = html;
  document.body.appendChild(box);

  const range = document.createRange();
  range.selectNodeContents(box);
  const sel = window.getSelection();
  sel.removeAllRanges();
  sel.addRange(range);

  let ok = false;
  try { ok = document.execCommand('copy'); } catch (e) { ok = false; }

  // 优先尝试写入 text/html（现代浏览器、https 环境）
  if (!ok && navigator.clipboard && window.ClipboardItem) {
    try {
      const item = new ClipboardItem({
        'text/html': new Blob([html], { type: 'text/html' }),
        'text/plain': new Blob([box.innerText], { type: 'text/plain' })
      });
      navigator.clipboard.write([item]);
      ok = true;
    } catch (e) { /* ignore */ }
  }

  sel.removeAllRanges();
  box.remove();
  return ok;
}
