/* ===========================================================
 *  Markdown Studio · 应用主逻辑
 * =========================================================== */

const SAMPLE_MD = [
  '# Markdown Studio 使用指南',
  '',
  '这是一个**完全离线**的 Markdown 编辑器与阅读器：公式、代码高亮、多套主题，一键导出可直接粘贴到微信公众号的 HTML。',
  '',
  '## 三步上手',
  '',
  '1. 左侧写 Markdown，右侧实时预览',
  '2. 顶部「主题」挑一套排版风格（预览即所得）',
  '3. 点「导出微信」→「复制到公众号」，到公众号后台 `Ctrl+V`',
  '',
  '> 导出时主题 CSS 会被内联进每个元素的 `style` 属性——微信编辑器会丢弃 `<style>` 标签和 class 规则，这是这类工具能用的根本原因。',
  '',
  '## 公式渲染',
  '',
  '行内：质能方程 $E = mc^2$，欧拉恒等式 $e^{i\\pi} + 1 = 0$，希腊字母 $\\alpha, \\beta, \\zeta$。',
  '',
  '块级：',
  '',
  '$$',
  '\\int_{-\\infty}^{\\infty} e^{-x^2}\\,dx = \\sqrt{\\pi}',
  '$$',
  '',
  '矩阵：',
  '',
  '$$',
  '\\mathbf{K}\\mathbf{u} = \\lambda\\mathbf{M}\\mathbf{u},\\quad',
  '\\mathbf{K} = \\begin{bmatrix} k_{11} & k_{12} \\\\ k_{21} & k_{22} \\end{bmatrix}',
  '$$',
  '',
  '## 代码高亮',
  '',
  '```python',
  'import numpy as np',
  '',
  'def grms(psd, freq):',
  '    """由加速度 PSD 计算总均方根加速度"""',
  '    return float(np.sqrt(np.trapz(psd, freq)))',
  '```',
  '',
  '```javascript',
  'const themes = ["classic", "minimal", "orange", "techcard"];',
  'console.log(`已加载 ${themes.length} 套主题`);',
  '```',
  '',
  '## 图表（mermaid）',
  '',
  '```mermaid',
  'flowchart TB',
  '  A[试验 PSD] --> B[响应数据]',
  '  B --> C{Grms 对标}',
  '  C -->|±15% 内| D[PASS]',
  '  C -->|超差| E[修正有限元模型]',
  '  E --> B',
  '```',
  '',
  '时序图：',
  '',
  '```mermaid',
  'sequenceDiagram',
  '  participant T as 振动台',
  '  participant S as 试件',
  '  participant A as 采集系统',
  '  T->>S: 基础激励 (PSD)',
  '  S->>A: 加速度响应',
  '  A->>A: 计算 Grms / 3σ',
  '```',
  '',
  '## 表格',
  '',
  '| 参数 | 符号 | 典型值 | 单位 |',
  '| --- | :--: | --: | --- |',
  '| 总均方根加速度 | Grms | 7.2 | g |',
  '| 频率范围 | f | 10–2000 | Hz |',
  '| 模态阻尼比 | ζ | 0.03 | — |',
  '',
  '## 任务清单',
  '',
  '- [x] 主题系统与内联导出',
  '- [x] 公式与代码渲染',
  '- [ ] 接入你自己的工作流',
  '',
  '支持 `行内代码`、~~删除线~~、[外链](https://github.com/doocs/md) 等常规语法。图片可拖入或点工具栏 🖼 插入（转 base64，随 HTML 一起走）。',
  '',
  '---',
  '',
  '> 快捷键：Ctrl+B 粗体 / Ctrl+I 斜体 / Ctrl+K 链接 / Ctrl+S 保存 / Ctrl+\\\\ 目录'
].join('\n');

const $ = (s) => document.querySelector(s);
const LS_DOC = 'mdstudio:doc.v1';
const LS_CFG = 'mdstudio:cfg.v1';

const DEFAULT_CFG = {
  theme: 'classic', view: 'split', width: 680, fontSize: 0, editorFont: 14,
  uiDark: false, autoSave: true, sync: true,
  mathPng: false, linkText: false, stripClass: false, split: 0.5,
  sidebarWidth: 236,
  stripImgOnSave: false,
  diagramDir: 'TB'
};

let cfg = Object.assign({}, DEFAULT_CFG);
let doc = { name: '未命名.md', text: SAMPLE_MD };

const editorHost = $('#editor');
const editor = EditorAdapter;   // CodeMirror 6 适配层，API 与原 textarea 兼容
const previewScroll = $('#previewScroll');
const previewBody = document.querySelector('#preview .md-body');
const editorPane = $('#editorPane');
const previewPane = document.querySelector('.preview-pane');
const splitter = $('#splitter');
const themeStyle = $('#themeStyle');
const tocPanel = $('#tocPanel');

let tocItems = [];
let renderTimer = null;
let dirty = false;

/* 预览顶层元素（带 data-md-line）的位置锚点，用于按内容块精准同步滚动 */
let scrollAnchors = [];
let anchorsDirty = true;

/* ---------------- 存储 ---------------- */
function loadJSON(k) { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (e) { return null; } }
function saveJSON(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }

/* ---------------- 提示 ---------------- */
let toastTimer = null;
function toast(msg, isErr) {
  const t = $('#toast');
  t.textContent = msg;
  t.className = 'toast show' + (isErr ? ' err' : '');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.className = 'toast'; }, 2200);
}

/* ---------------- 主题 ---------------- */
function applyTheme() {
  let css = buildPreviewCSS(cfg.theme);
  if (cfg.fontSize > 0) css += `\n#preview .md-body{font-size:${cfg.fontSize}px}`;
  themeStyle.textContent = css;
  previewBody.setAttribute('data-theme', cfg.theme);
  $('#themeSelect').value = cfg.theme;
  document.querySelectorAll('.theme-card').forEach(c => {
    c.classList.toggle('active', c.dataset.id === cfg.theme);
  });
  // mermaid 的配色固化在 SVG 内部，换主题要按新配色重绘
  if (Renderer.configureMermaid(cfg.theme)) {
    if (previewBody.querySelector('.mermaid-block')) {
      Renderer.renderDiagrams(previewBody, true);
      Renderer.waitDiagrams().then(markAnchorsDirty);
    }
  }
  markAnchorsDirty();   // 主题换了，元素高度会变
}

function buildThemeUI() {
  const sel = $('#themeSelect');
  // 顶栏下拉按风格分组，26 套主题不至于挤成一长条
  sel.innerHTML = THEME_GROUPS.filter(g => g.id !== 'all').map(g => {
    const opts = THEMES.filter(t => t.tone === g.id)
      .map(t => `<option value="${t.id}">${t.name}</option>`).join('');
    return `<optgroup label="${g.name}">${opts}</optgroup>`;
  }).join('');

  const grid = $('#themeGrid');
  grid.innerHTML = THEMES.map(t => `
    <div class="theme-card${t.id === cfg.theme ? ' active' : ''}" data-id="${t.id}" data-tone="${t.tone}">
      <div class="tick">✓</div>
      <div class="sw">${t.swatch.map(c => `<i style="background:${c}"></i>`).join('')}</div>
      <div class="nm">${t.name}</div>
      <div class="ds">${t.desc}</div>
    </div>`).join('');

  // 主题面板里的分组筛选
  let bar = document.getElementById('themeFilters');
  if (!bar) {
    bar = document.createElement('div');
    bar.id = 'themeFilters';
    bar.className = 'theme-filters';
    grid.parentNode.insertBefore(bar, grid);
  }
  bar.innerHTML = THEME_GROUPS.map((g, i) =>
    `<button class="chip${i === 0 ? ' on' : ''}" data-tone="${g.id}">${g.name}</button>`
  ).join('') + `<span class="theme-count">共 ${THEMES.length} 套</span>`;
  bar.querySelectorAll('.chip').forEach(btn => {
    btn.addEventListener('click', () => {
      bar.querySelectorAll('.chip').forEach(b => b.classList.remove('on'));
      btn.classList.add('on');
      const tone = btn.dataset.tone;
      grid.querySelectorAll('.theme-card').forEach(c => {
        c.style.display = (tone === 'all' || c.dataset.tone === tone) ? '' : 'none';
      });
    });
  });

  grid.querySelectorAll('.theme-card').forEach(card => {
    card.addEventListener('click', () => {
      cfg.theme = card.dataset.id;
      applyTheme();
      saveCfg();
    });
  });
}

/* ---------------- 滚动主控权 ----------------
 * 主控权只由真实输入事件（wheel / touch / pointer / keydown）决定，不用时间窗。
 * 大文档里公式、图表渲染可能把 scroll 事件延迟好几秒，任何「N 毫秒后解锁」
 * 的方案都会让回声伪装成用户滚动，把另一侧拽到错误位置。 */
let scrollOwner = null;

let jumpLock = false;   // 目录跳转（平滑滚动）期间不反向驱动编辑器
let jumpTimer = null;

/** 跳转滚动会连续触发 scroll；每次触发都续期，滚动静默后才解除锁定 */
function extendJumpLock() {
  clearTimeout(jumpTimer);
  jumpTimer = setTimeout(() => { jumpLock = false; }, 260);
}

function claimScroll(side) { scrollOwner = side; }

/* ---------------- 锚点式滚动同步 ----------------
 * 整页百分比同步在公式、图片、代码块较多的文档里会严重错位：
 * 源码 1 行可能渲染成 200px 的公式。这里把每个渲染块标注回源码行号，
 * 再按「相邻锚点之间局部插值」换算两侧位置，误差被限制在一个块内。
 * 锚点统一用「滚动内容坐标」存放，正反两个方向互为逆运算。 */
function markAnchorsDirty() {
  anchorsDirty = true;
  // 换主题 / 改宽度 / 拖动分栏后不只重算表，还要把当前阅读位置重新对齐
  scheduleRealign();
}

let echoGuardUntil = 0;      // 程序化设置预览 scrollTop 后，短暂屏蔽其回声
let programmaticPreviewTop = NaN;  // 最近一次程序化设置的 scrollTop（值匹配法，不受事件延迟影响）
let realignTimer = 0;

/** 预览滚动内容坐标系的原点（窗口坐标 → 内容坐标） */
function scrollContentBase() {
  return previewScroll.getBoundingClientRect().top - previewScroll.scrollTop;
}

function buildScrollAnchors() {
  const nodes = [...previewBody.querySelectorAll('[data-md-line]')];
  if (nodes.length < 2) { scrollAnchors = []; anchorsDirty = false; return; }
  const base = scrollContentBase();
  const list = nodes.map(el => {
    const r = el.getBoundingClientRect();
    return { line: +el.dataset.mdLine || 1, top: r.top - base };
  }).sort((a, b) => a.top - b.top);
  // 行号与位置都必须单调，否则插值会来回跳
  for (let i = 1; i < list.length; i++) {
    if (list[i].line < list[i - 1].line) list[i].line = list[i - 1].line;
    if (list[i].top < list[i - 1].top) list[i].top = list[i - 1].top;
  }
  // 预览卡片有顶部留白（.preview-scroll + #preview 的 padding、首块 margin），
  // 编辑区只有 12px。若把这段留白整体扣掉，正文里每个块都会比左栏低几十像素；
  // 让它在开头一小段内容里线性淡出：第一块仍对齐 scrollTop=0（保留卡片留白），
  // 淡出之后锚点就是纯粹的内容坐标，同一个块在左右两栏处于同一高度。
  const first = list[0].top;
  const fade = Math.max(first * 2, 320);   // 保证修正后的位置仍严格单调
  list.forEach(a => {
    const k = Math.max(0, 1 - (a.top - first) / fade);
    a.top -= first * k;
  });
  const maxScroll = Math.max(0, previewScroll.scrollHeight - previewScroll.clientHeight);
  const lastLine = Math.max(list[list.length - 1].line, editor.lineCount || 1);
  // 末尾锚点：预览滚到底 ↔ 源码末行，保证两端都能走到尽头
  list.push({ line: lastLine + 1, top: maxScroll + 1 });
  scrollAnchors = list;
  anchorsDirty = false;
}

/** 预览 scrollTop → 浮点源码行号 */
function previewTopToLine(top) {
  const A = scrollAnchors;
  if (!A.length) return 1;
  const st = top;
  if (st <= A[0].top) return A[0].line;
  const last = A[A.length - 1];
  if (st >= last.top) return last.line;
  for (let i = 0; i < A.length - 1; i++) {
    const a = A[i], b = A[i + 1];
    if (st <= b.top) {
      const f = Math.min(1, Math.max(0, (st - a.top) / Math.max(1, b.top - a.top)));
      return a.line + (b.line - a.line) * f;
    }
  }
  return last.line;
}

/** 浮点源码行号 → 预览 scrollTop */
function lineToPreviewTop(lineFloat) {
  const A = scrollAnchors;
  if (A.length < 2) return null;
  if (lineFloat <= A[0].line) return 0;
  const last = A[A.length - 1];
  if (lineFloat >= last.line) return Math.max(0, last.top);
  for (let i = 0; i < A.length - 1; i++) {
    const a = A[i], b = A[i + 1];
    if (lineFloat <= b.line) {
      const f = (lineFloat - a.line) / Math.max(1, b.line - a.line);
      return Math.max(0, a.top + (b.top - a.top) * f);
    }
  }
  return Math.max(0, last.top);
}

/** 设置滚动位置；guardEcho 用于 renderNow 的主动复位，避免被当成用户滚动 */
function setScrollTop(el, v, guardEcho) {
  const max = Math.max(0, el.scrollHeight - el.clientHeight);
  const t = Math.min(max, Math.max(0, v));
  if (Math.abs(el.scrollTop - t) < 0.5) return;
  if (el === previewScroll) programmaticPreviewTop = t;
  if (guardEcho) echoGuardUntil = performance.now() + 140;
  el.scrollTop = t;
}

/**
 * 内容高度变化（公式/图表/图片异步渲染、换主题、改宽度、缩放窗口）后，
 * 按当前主控侧重新对齐。以前只重算锚点、不重新定位，偏差会一直挂着。
 */
function scheduleRealign() {
  clearTimeout(realignTimer);
  realignTimer = setTimeout(() => {
    realignTimer = 0;
    if (!cfg.sync || cfg.view !== 'split') return;
    buildScrollAnchors();
    if (scrollAnchors.length < 2) return;
    // 校准只从编辑器侧推预览：异步布局变化期间预览的位置可能来自上一次
    // 程序化设置，反向驱动会把编辑器整个拽到别处（这正是偶发大幅偏差的来源）。
    // 同步正常时这个换算结果≈预览当前位置，因此不会和用户滚动打架。
    const t = lineToPreviewTop(editor.getViewportLine());
    if (t != null && isFinite(t)) setScrollTop(previewScroll, t, true);
  }, 60);
}

/* ---------------- 渲染 ---------------- */
function updateStats() {
  const text = editor.value;
  const chars = text.replace(/\s/g, '').length;
  const lines = text.split('\n').length;
  $('#statWord').textContent = chars + ' 字';
  $('#statLine').textContent = lines + ' 行';
  $('#statFile').textContent = doc.name;
}

function renderNow() {
  Renderer.setDiagramDir(cfg.diagramDir || 'TB');
  // innerHTML 被清空的瞬间预览高度会塌缩，浏览器会甩出一些临时 scroll 事件；
  // 提前屏蔽这段回声，避免它们被当成用户滚动去反向驱动编辑器
  echoGuardUntil = performance.now() + 260;
  // 重渲染会改变预览高度，用整页百分比保留位置会越漂越远；
  // 改成记住当前主控侧对应的「源码行」，渲染完按新布局换算回来。
  let keepLine = null;
  try {
    if (!anchorsDirty && scrollAnchors.length >= 2 && scrollOwner === 'preview') {
      keepLine = previewTopToLine(previewScroll.scrollTop);
    } else {
      keepLine = editor.getViewportLine();
    }
  } catch (e) { keepLine = null; }

  tocItems = Renderer.renderInto(doc.text, previewBody);
  buildTOC(tocItems);

  buildScrollAnchors();
  if (keepLine != null && scrollAnchors.length >= 2) {
    const t = lineToPreviewTop(keepLine);
    if (t != null && isFinite(t)) setScrollTop(previewScroll, t, true);
  }
  updateStats();
  // 公式 / 图表 / 图片异步撑高元素后再校准一次，避免留下半屏偏差
  scheduleRealign();
  Renderer.waitDiagrams().then(scheduleRealign);
}

function scheduleRender() {
  clearTimeout(renderTimer);
  const big = doc.text.length > 30000;
  renderTimer = setTimeout(() => {
    ensureEnginesFor(doc.text);   // 新写入公式/图表时才去拉对应引擎
    renderNow();
  }, big ? 520 : 180);
}

/* ---------------- 目录 ---------------- */
function buildTOC(items) {
  if (!items.length) { tocPanel.innerHTML = '<div class="toc-title">无标题</div>'; return; }
  tocPanel.innerHTML = '<div class="toc-title">目录</div>' + items.map(it =>
    `<a class="lv${it.level}" data-id="${it.id}" title="${it.text.replace(/"/g, '&quot;')}">${it.text}</a>`
  ).join('');
  tocPanel.querySelectorAll('a').forEach(a => {
    a.addEventListener('click', () => {
      const el = previewBody.querySelector('#' + CSS.escape(a.dataset.id));
      if (!el) return;
      const top = el.offsetTop - previewBody.offsetTop;
      jumpLock = true;
      claimScroll('preview');
      extendJumpLock();
      previewScroll.scrollTo({ top: top - 20, behavior: 'smooth' });
      el.animate([{ background: 'rgba(37,99,235,.14)' }, { background: 'transparent' }], { duration: 900 });
    });
  });
}

/* ---------------- 编辑器命令 ---------------- */
function surround(before, after, placeholder) {
  const ta = editor;
  ta.focus();
  const s = ta.selectionStart, e = ta.selectionEnd;
  const wasEmpty = s === e;
  const sel = ta.value.slice(s, e) || placeholder || '';
  ta.setRangeText(before + sel + after, s, e, 'end');
  if (wasEmpty) ta.setSelectionRange(s + before.length, s + before.length + sel.length);
  onInput();
}

/* 统一的图片插入入口：工具栏选择、拖拽、剪贴板粘贴都走这里 */
function insertImageFile(file) {
  if (!file || !/^image\//i.test(file.type || '')) return;
  if (file.size > 2.5 * 1024 * 1024) toast('图片较大（>2.5MB），公众号可能拒绝', true);
  const reader = new FileReader();
  reader.onload = () => {
    const alt = (file.name || 'image').replace(/\.[^.]+$/, '');
    surround('![', `](${reader.result})`, alt);
    toast('图片已插入（base64 内嵌，编辑区折叠显示）');
  };
  reader.onerror = () => toast('图片读取失败', true);
  reader.readAsDataURL(file);
}

function insertBlock(text, cursorOffset) {
  const ta = editor;
  ta.focus();
  const s = ta.selectionStart, e = ta.selectionEnd;
  const before = ta.value.slice(0, s);
  const needNL = before && !before.endsWith('\n') ? '\n' : '';
  const payload = needNL + text + '\n';
  ta.setRangeText(payload, s, e, 'end');
  const base = s + needNL.length;
  if (cursorOffset != null) ta.setSelectionRange(base + cursorOffset, base + cursorOffset);
  onInput();
}

function toggleLinePrefix(prefix, ordered) {
  const ta = editor;
  ta.focus();
  const s = ta.selectionStart, e = ta.selectionEnd;
  const start = ta.value.lastIndexOf('\n', s - 1) + 1;
  let end = ta.value.indexOf('\n', e);
  if (end < 0) end = ta.value.length;
  const lines = ta.value.slice(start, end).split('\n');
  const re = ordered ? /^\d+\.\s/ : null;
  const nonEmpty = lines.filter(l => l.trim());
  const has = nonEmpty.length > 0 && nonEmpty.every(l => (re ? re.test(l) : l.startsWith(prefix)));
  const out = lines.map((l, i) => {
    if (has) {
      if (re) return l.replace(/^\d+\.\s/, '');
      return l.startsWith(prefix) ? l.slice(prefix.length) : l;
    }
    if (re) return (i + 1) + '. ' + l;
    return prefix + l;
  }).join('\n');
  ta.setRangeText(out, start, end, 'end');
  ta.setSelectionRange(start, start + out.length);
  onInput();
}

function toggleDiagramMenu() {
  const menu = $('#diagramMenu');
  if (menu.classList.contains('show')) { menu.classList.remove('show'); return; }
  const btn = document.querySelector('#toolbar .tb[data-act="diagram"]');
  const r = btn.getBoundingClientRect();
  const w = 214;
  menu.style.top = Math.round(r.bottom + 6) + 'px';
  menu.style.left = Math.round(Math.max(8, Math.min(r.left, window.innerWidth - w - 8))) + 'px';
  menu.classList.add('show');
}

const ACTIONS = {
  bold: () => surround('**', '**', '粗体文字'),
  italic: () => surround('*', '*', '斜体文字'),
  strike: () => surround('~~', '~~', '删除文字'),
  code: () => surround('`', '`', 'code'),
  h1: () => toggleLinePrefix('# '),
  h2: () => toggleLinePrefix('## '),
  h3: () => toggleLinePrefix('### '),
  quote: () => toggleLinePrefix('> '),
  ul: () => toggleLinePrefix('- '),
  ol: () => toggleLinePrefix('', true),
  task: () => toggleLinePrefix('- [ ] '),
  codeblock: () => insertBlock('```python\n\n```', 11),
  math: () => insertBlock('$$\n\n$$', 3),
  inlineMath: () => surround('$', '$', 'x^2'),
  table: () => insertBlock('| 列 1 | 列 2 | 列 3 |\n| --- | --- | --- |\n| 内容 | 内容 | 内容 |'),
  diagram: () => toggleDiagramMenu(),
  link: () => surround('[', '](https://)', '链接文字'),
  image: () => $('#imgInput').click(),
  hr: () => insertBlock('---')
};

/* ---------------- 输入事件 ---------------- */
/** 撤销 / 重做按钮的可用状态：直接问 CodeMirror 的历史栈深度 */
function syncHistoryButtons() {
  const u = $('#btnUndo'), r = $('#btnRedo');
  if (!u || !r) return;
  u.disabled = !editor.canUndo();
  r.disabled = !editor.canRedo();
}

function onInput() {
  doc.text = editor.value;
  if (loadingDoc) return;   // 正在切换文档，不算修改
  dirty = true;
  if (currentPath) Vault.stash(currentPath, doc.text);
  if (window.native) syncWindowTitle();
  $('#statDot').className = 'dot saving';
  $('#statSave').textContent = '未保存';
  scheduleRender();
  saveDraft();
}

function saveDraft() {
  if (!cfg.autoSave) return;
  clearTimeout(saveDraft._t);
  saveDraft._t = setTimeout(() => {
    saveJSON(LS_DOC, doc);
    if (currentPath) Vault.render();
    dirty = false;
    $('#statDot').className = 'dot';
    $('#statSave').textContent = '草稿已保存';
  }, 700);
}

function saveCfg() { saveJSON(LS_CFG, cfg); }

/* ---------------- 视图 ---------------- */
/**
 * 切到阅读视图后，预览容器要等排版稳定才有真实滚动高度。
 * 此时 setScrollTop 会因 max=0 静默早退，所以这里按 50ms 重试几次直到真正落位。
 */
function syncPreviewToLine(lineFloat, tries) {
  const left = tries == null ? 30 : tries;
  // 刚从 display:none 切过来时，浏览器还没算过这个容器的高度；
  // 读一次 offsetHeight 强制同步布局，否则 scrollHeight 会是 0
  void previewScroll.offsetHeight;
  buildScrollAnchors();
  const top = lineToPreviewTop(lineFloat);
  const max = Math.max(0, previewScroll.scrollHeight - previewScroll.clientHeight);
  if (top != null && max > 1) {
    const target = Math.min(max, Math.max(0, top));
    setScrollTop(previewScroll, target, true);
    if (Math.abs(previewScroll.scrollTop - target) <= 2) return;
  }
  if (left > 0) setTimeout(() => syncPreviewToLine(lineFloat, left - 1), 40);
}

function setView(v) {
  const prev = cfg.view;
  /* 切换视图时保持阅读位置：以「源码行号」为唯一锚点，
     阅读区 → 编辑区、编辑区 → 阅读区都换算过去，不再各自回到顶部 */
  let keepLine = null;
  if (prev && prev !== v) {
    if (prev === 'read' && v !== 'read') {
      if (previewScroll.scrollTop > 0) {
        if (anchorsDirty) buildScrollAnchors();
        keepLine = previewTopToLine(previewScroll.scrollTop);
      }
    } else if (prev !== 'read' && v === 'read') {
      keepLine = editor.getViewportLine();
    }
  }
  cfg.view = v;
  document.querySelectorAll('#viewTabs button').forEach(b => b.classList.toggle('active', b.dataset.view === v));
  document.body.classList.toggle('reading', v === 'read');
  document.body.classList.toggle('mode-preview', v === 'read');
  if (window.innerWidth > 860) {
    if (v === 'write') {
      editorPane.style.display = 'flex';
      editorPane.style.width = '100%';
      previewPane.style.display = 'none';
      splitter.style.display = 'none';
    } else if (v === 'read') {
      editorPane.style.display = 'none';
      previewPane.style.display = 'flex';
      splitter.style.display = 'none';
    } else {
      editorPane.style.display = 'flex';
      previewPane.style.display = 'flex';
      splitter.style.display = 'block';
      applySplit();
    }
  }
  saveCfg();
  markAnchorsDirty();
  if (keepLine != null && isFinite(keepLine)) {
    // 切完 display 后布局要一两帧才稳定（预览宽度、折行位置都会变）
    requestAnimationFrame(() => {
      if (v === 'read') syncPreviewToLine(keepLine);
      else editor.setViewportLine(keepLine);
    });
  }
}

function applySplit() {
  const ratio = Math.min(0.8, Math.max(0.2, cfg.split || 0.5));
  editorPane.style.width = (ratio * 100) + '%';
  markAnchorsDirty();
}

/* ---------------- 导出 ---------------- */
function fullDocument(bodyHtml) {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${Renderer.esc(doc.name.replace(/\.md$/i, ''))}</title>
<style>
body{margin:0;padding:28px 14px;background:#f2f3f5;font-family:-apple-system,BlinkMacSystemFont,"PingFang SC","Microsoft YaHei",sans-serif;}
.wrap{max-width:677px;margin:0 auto;background:#fff;border-radius:10px;overflow:hidden;}
@media(max-width:720px){body{padding:0;}.wrap{border-radius:0;}}
</style>
</head>
<body><div class="wrap">${bodyHtml}</div></body>
</html>`;
}

async function buildExportHTML() {
  // 引擎可能是按需加载的，导出前必须等公式与图表都真正渲染完
  await ensureEnginesForExport();
  Renderer.setDiagramDir(cfg.diagramDir || 'TB');
  await Renderer.renderDiagrams(previewBody, false);
  if (previewBody.querySelector('.mermaid-block:not([data-rendered="1"])')) {
    await Renderer.renderDiagrams(previewBody, false);
  }
  const clone = previewBody.cloneNode(true);
  normalizeMathSvg(clone);
  await convertDiagramsToPng(clone);
  if (cfg.mathPng) await convertMathToPng(clone);

  let css = buildExportCSS(cfg.theme);
  if (cfg.fontSize > 0) css += `\n.md-body{font-size:${cfg.fontSize}px}`;

  const inlined = inlineStyles(clone.outerHTML, [css]);
  return wechatClean(inlined, { linkToText: cfg.linkText, stripClass: cfg.stripClass });
}

const MATH_SVG_SEL = '.math-inline > svg, .math-block > svg';

/** SVG → PNG（data URI）。wechat/clipboard 对内联 SVG 的支持不一，转图最保险 */
async function svgToPng(svgEl, w, h, bgColor, scale) {
  const svg = svgEl.cloneNode(true);
  svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  svg.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');
  svg.setAttribute('width', w);
  svg.setAttribute('height', h);
  if (bgColor) {
    const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    const vb = (svg.getAttribute('viewBox') || '').split(/[\s,]+/).map(Number);
    if (vb.length === 4 && !Number.isNaN(vb[0]) && vb[2] > 0) {
      rect.setAttribute('x', vb[0]);
      rect.setAttribute('y', vb[1]);
      rect.setAttribute('width', vb[2]);
      rect.setAttribute('height', vb[3]);
    } else {
      rect.setAttribute('width', '100%');
      rect.setAttribute('height', '100%');
    }
    rect.setAttribute('fill', bgColor);
    svg.insertBefore(rect, svg.firstChild);
  }
  const str = new XMLSerializer().serializeToString(svg);
  const url = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(str);
  const img = new Image();
  await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = url; });

  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(w * scale));
  canvas.height = Math.max(1, Math.round(h * scale));
  const ctx = canvas.getContext('2d');
  if (bgColor) { ctx.fillStyle = bgColor; ctx.fillRect(0, 0, canvas.width, canvas.height); }
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/png');
}

/** mermaid 图表 → PNG 图片（微信里流程图的 SVG 样式常被剥离，转图最稳） */
async function convertDiagramsToPng(root) {
  convertDiagramsToPng.wide = [];
  const srcBlocks = [...previewBody.querySelectorAll('.mermaid-block')];
  const dstBlocks = [...root.querySelectorAll('.mermaid-block')];
  for (let i = 0; i < dstBlocks.length; i++) {
    const dst = dstBlocks[i];
    const srcBlock = srcBlocks[i];
    const srcSvg = srcBlock && srcBlock.querySelector(':scope > svg');
    if (!srcSvg) {
      const raw = dst.querySelector('.mermaid-raw');
      dst.innerHTML = '<div class="diagram-error">图表未渲染完成，未包含在导出内容中</div>'
        + (raw ? raw.outerHTML : '');
      continue;
    }
    try {
      const rect = srcSvg.getBoundingClientRect();
      const w = Math.max(120, Math.round(rect.width));
      const h = Math.max(60, Math.round(rect.height));
      if (w / h > 2.6) convertDiagramsToPng.wide.push(i + 1);
      const bg = cfg.theme === 'night' ? '#1e1e1e' : '#ffffff';
      const png = await svgToPng(srcSvg, w, h, bg, 2);
      const img = document.createElement('img');
      img.setAttribute('src', png);
      img.setAttribute('width', w);
      img.setAttribute('height', h);
      img.setAttribute('style', `display:block;width:100%;max-width:${w}px;height:auto;margin:0 auto;`);
      dst.innerHTML = '';
      dst.appendChild(img);
    } catch (e) {
      const raw = dst.querySelector('.mermaid-raw');
      dst.innerHTML = '<div class="diagram-error">图表导出失败</div>' + (raw ? raw.outerHTML : '');
    }
  }
}

/** 公式 svg 的宽高由 MathJax 用 ex 单位给出；导出时按当前渲染尺寸换算成 px，避免不同环境字号不一致 */
function normalizeMathSvg(root) {
  const src = [...previewBody.querySelectorAll(MATH_SVG_SEL)];
  const dst = [...root.querySelectorAll(MATH_SVG_SEL)];
  dst.forEach((svg, i) => {
    const s = src[i];
    if (!s) return;
    const r = s.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) return;
    svg.setAttribute('width', Math.round(r.width * 10) / 10);
    svg.setAttribute('height', Math.round(r.height * 10) / 10);
  });
}

/** 把预览里的 MathJax SVG 公式换成 PNG 图片（部分环境对内联 SVG 支持不好） */
async function convertMathToPng(root) {
  const srcSvgs = [...previewBody.querySelectorAll(MATH_SVG_SEL)];
  const dstSvgs = [...root.querySelectorAll(MATH_SVG_SEL)];
  if (!srcSvgs.length) return;

  for (let i = 0; i < dstSvgs.length; i++) {
    const src = srcSvgs[i], dst = dstSvgs[i];
    try {
      const rect = src.getBoundingClientRect();
      const w = Math.max(8, Math.round(rect.width));
      const h = Math.max(8, Math.round(rect.height));
      const color = getComputedStyle(src).color || '#333333';

      const svg = dst.cloneNode(true);
      svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
      svg.setAttribute('width', w);
      svg.setAttribute('height', h);
      svg.setAttribute('style', `color:${color}`);
      const str = new XMLSerializer().serializeToString(svg);
      const url = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(str);

      const img = new Image();
      await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = url; });

      const scale = 3;
      const canvas = document.createElement('canvas');
      canvas.width = w * scale;
      canvas.height = h * scale;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      const out = document.createElement('img');
      out.setAttribute('src', canvas.toDataURL('image/png'));
      out.setAttribute('width', w);
      out.setAttribute('height', h);
      out.setAttribute('class', 'math-img');
      // 用 !important 防止被正文 img 规则（display:block）覆盖，行内公式必须 inline-block
      out.setAttribute('style', `display:inline-block !important;width:${w}px;height:${h}px;vertical-align:middle;margin:0 1px;border-radius:0;`);
      dst.replaceWith(out);
    } catch (e) {
      // 转换失败就保留原 SVG
    }
  }
}

async function refreshExportPanel() {
  const html = await buildExportHTML();
  $('#exportPreview').innerHTML = html;
  $('#exportCode').value = html;
  $('#exportSize').textContent = (new Blob([html]).size / 1024).toFixed(1) + ' KB';
  refreshExportPanel._html = html;
  // 太宽的流程图在手机上字会很小，提示改竖排或拆分
  const wide = convertDiagramsToPng.wide || [];
  const warnEl = $('#exportWarn');
  if (wide.length) {
    warnEl.style.display = 'block';
    warnEl.textContent = `第 ${wide.join('、')} 张流程图偏宽（宽高比 > 2.6），手机上看字会偏小：可在设置里切成竖排，或把它拆成「主干 + 分支」两张图。`;
  } else {
    warnEl.style.display = 'none';
  }
  return html;
}

function download(name, content, type) {
  // Electron：走系统「另存为」对话框
  if (window.native && window.native.saveAsDialog) {
    window.native.saveAsDialog(name, content).then(r => {
      if (r) toast('已保存 ' + r.name);
    });
    return;
  }
  const blob = new Blob([content], { type: type || 'text/plain;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}

/* ---------------- 文件 ---------------- */
let currentPath = null;       // 来自文件夹侧栏的相对路径
let currentWritable = false;  // 该文件能否直接写回磁盘
let currentAbs = null;        // Electron 模式下的绝对路径
let loadingDoc = false;       // 载入文档期间忽略 change 事件，避免误判为"已修改"

/** 统一入口：单文件打开、侧栏点击、拖入都走这里 */
function loadDocument({ name, path, text, writable, abs }) {
  // 切换前把当前未保存内容留在内存缓存里，切回来能看到
  if (currentPath && doc && dirty) Vault.stash(currentPath, doc.text);
  loadingDoc = true;
  doc = { name: name || '未命名.md', text: text || '' };
  currentPath = path || null;
  currentWritable = !!writable;
  currentAbs = abs || null;
  editor.value = doc.text;
  if (editor.resetHistory) editor.resetHistory();   // 换文件后清空撤销栈
  dirty = false;
  renderNow();
  loadingDoc = false;
  syncHistoryButtons();
  syncWindowTitle();
  previewScroll.scrollTop = 0;
  editor.scrollTop = 0;
  $('#statFile').textContent = doc.name;
  $('#statDot').className = 'dot';
  $('#statSave').textContent = currentPath ? (currentWritable ? '可直接保存' : '只读') : '就绪';
}

/** Electron 模式：同步窗口标题与未保存状态给主进程 */
function syncWindowTitle() {
  if (!window.native) return;
  const mark = dirty ? '• ' : '';
  window.native.setTitle(`${mark}${doc.name || '未命名.md'} — Markdown Studio`);
  window.native.setDirty(!!dirty);
}

function openFile(file) {
  if (!file) return;
  if (file.size > 8 * 1024 * 1024) { toast('文件过大（>8MB）', true); return; }
  const reader = new FileReader();
  reader.onload = () => {
    loadDocument({ name: file.name, text: String(reader.result || '') });
    toast('已打开 ' + file.name);
  };
  reader.readAsText(file, 'utf-8');
}

function newDocument() {
  if (dirty && !confirm('当前内容尚未保存为文件，确定新建？')) return;
  loadingDoc = true;
  doc = { name: '未命名.md', text: '' };
  currentPath = null;
  currentWritable = false;
  currentAbs = null;
  editor.value = '';
  if (editor.resetHistory) editor.resetHistory();
  dirty = false;
  renderNow();
  loadingDoc = false;
  syncHistoryButtons();
  syncWindowTitle();
  $('#exportMask').classList.remove('show');
  toast('已新建空文档');
}

async function openFirstVaultDoc() {
  const entries = Vault.getEntries();
  if (!entries.length) return;
  const d = await Vault.openPath(entries[0].path);
  if (d) loadDocument(d);
}

/* ---------------- 保存时移除内嵌图片 ----------------
 *  base64 图片会让 md 文件膨胀到几百 KB 甚至几 MB。
 *  开启该选项后，只在「写盘这一刻」把 data URI 图片剔除，
 *  并把剔除后的内容同步回编辑器，避免出现「文件里没有、界面上还有」的假象。
 *  逐行处理：图片独占一行时连空行一起去掉，行内图片只删图片本身。
 * ------------------------------------------------------ */
const SAVE_IMG_RE = /!\[([^\]\n]{0,200})\]\((data:image\/[a-z0-9.+-]+;base64,[A-Za-z0-9+/=]+)\)/gi;

function stripImagesForSave(text) {
  let removed = 0;
  let dropNextBlank = false;   // 整行删图后，紧跟着的空白行也一并收掉，避免留下 \n\n\n
  const keep = [];
  for (const line of String(text == null ? '' : text).split('\n')) {
    if (dropNextBlank) {
      dropNextBlank = false;
      if (line.trim() === '') continue;
    }
    if (line.indexOf('data:image') < 0) { keep.push(line); continue; }
    let hit = false;
    let replaced = line.replace(SAVE_IMG_RE, () => { hit = true; removed++; return ''; });
    if (!hit) { keep.push(line); continue; }
    if (replaced.trim() === '') { dropNextBlank = true; continue; }   // 整行只有图片 → 整行删掉
    // 行内图被删后常留下连续空格，收一下再写
    replaced = replaced.replace(/[ \t]{2,}/g, ' ').replace(/[ \t]+$/, '');
    keep.push(replaced);
  }
  return { text: removed ? keep.join('\n') : text, removed };
}

/** 保存后把剔除过图片的内容同步回编辑器（保留滚动位置，不算新的修改） */
function applyStrippedDoc(text) {
  const sc = editor.view ? editor.view.scrollDOM.scrollTop : 0;
  loadingDoc = true;
  editor.value = text;
  doc.text = text;
  if (editor.view) editor.view.scrollDOM.scrollTop = sc;
  loadingDoc = false;
  dirty = false;
  renderNow();
  syncWindowTitle();
  $('#statDot').className = 'dot';
  $('#statSave').textContent = '已保存';
}

async function saveDocument() {
  const prep = cfg.stripImgOnSave ? stripImagesForSave(doc.text) : { text: doc.text, removed: 0 };
  const text = prep.text;

  const done = () => {
    if (prep.removed > 0) {
      applyStrippedDoc(text);
      toast(`已保存，并移除 ${prep.removed} 张内嵌图片`);
      return;
    }
    dirty = false;
    $('#statDot').className = 'dot';
    $('#statSave').textContent = '已保存';
    syncWindowTitle();
    toast('已保存到 ' + doc.name);
  };

  // Electron：直接写回绝对路径
  if (window.native && currentAbs) {
    const r = await window.native.writeFile(currentAbs, text);
    if (r && r.ok) {
      done();
    } else {
      toast('保存失败：' + (r && r.error || '未知错误'), true);
    }
    return;
  }
  if (currentPath) {
    const r = await Vault.savePath(currentPath, text);
    if (r.ok) {
      Vault.clearDirty(currentPath);
      done();
      return;
    }
    if (r.reason === 'denied') { toast('没有写入权限，改为下载', true); }
  }
  download(doc.name || 'untitled.md', text, 'text/markdown;charset=utf-8');
  toast('已下载 ' + (doc.name || 'untitled.md'));
}

/* ---------------- 初始化 ---------------- */
function initSettingsUI() {
  const w = $('#optWidth'), f = $('#optFont');
  w.value = cfg.width; f.value = cfg.fontSize;
  $('#optEditorFont').value = cfg.editorFont || 14;
  $('#optDiagramDir').value = cfg.diagramDir || 'TB';
  $('#optUiDark').checked = cfg.uiDark;
  $('#optAutoSave').checked = cfg.autoSave;
  $('#optSync').checked = cfg.sync;
  $('#optStripImg').checked = cfg.stripImgOnSave;
  $('#optMathPng').checked = cfg.mathPng;
  $('#optLinkText').checked = cfg.linkText;
  $('#optStripClass').checked = cfg.stripClass;

  w.addEventListener('input', () => { cfg.width = +w.value; applyWidth(); saveCfg(); });
  $('#optEditorFont').addEventListener('input', (e) => {
    cfg.editorFont = Math.min(20, Math.max(12, +e.target.value || 14));
    applyEditorFont();
    saveCfg();
  });
  f.addEventListener('input', () => { cfg.fontSize = +f.value || 0; applyTheme(); saveCfg(); });
  $('#optDiagramDir').addEventListener('change', e => {
    cfg.diagramDir = e.target.value;
    Renderer.setDiagramDir(cfg.diagramDir);
    if (previewBody.querySelector('.mermaid-block')) Renderer.renderDiagrams(previewBody, true);
    saveCfg();
    toast('流程图方向：' + ({ TB: '竖排', LR: '横排', auto: '跟随源码' })[cfg.diagramDir]);
  });
  $('#optUiDark').addEventListener('change', e => { cfg.uiDark = e.target.checked; applyUi(); saveCfg(); });
  $('#optAutoSave').addEventListener('change', e => { cfg.autoSave = e.target.checked; saveCfg(); });
  $('#optSync').addEventListener('change', e => { cfg.sync = e.target.checked; saveCfg(); });
  $('#optStripImg').addEventListener('change', e => {
    cfg.stripImgOnSave = e.target.checked;
    saveCfg();
    if (cfg.stripImgOnSave) toast('已开启：按 Ctrl+S 保存时会移除文档内的 base64 图片');
  });
  $('#optMathPng').addEventListener('change', e => { cfg.mathPng = e.target.checked; saveCfg(); refreshExportPanel(); });
  $('#optLinkText').addEventListener('change', e => { cfg.linkText = e.target.checked; saveCfg(); refreshExportPanel(); });
  $('#optStripClass').addEventListener('change', e => { cfg.stripClass = e.target.checked; saveCfg(); refreshExportPanel(); });

  $('#btnReset').addEventListener('click', () => {
    cfg = Object.assign({}, DEFAULT_CFG, { theme: cfg.theme });
    initSettingsUI(); applyWidth(); applyEditorFont(); applySidebarWidth(); applyTheme(); applyUi(); applySplit(); saveCfg();
    toast('已恢复默认设置');
  });
}

/* 后台驻留偏好放在主进程，托盘右键菜单与设置面板共用一份状态。
   浏览器版没有这些能力，直接隐藏对应设置项。 */
function initAppPrefs() {
  const fields = ['#fieldCloseToTray', '#fieldAutoLaunch'].map(s => $(s)).filter(Boolean);
  const N = window.native;
  if (!N || typeof N.getAppPrefs !== 'function') {
    fields.forEach(el => { el.style.display = 'none'; });
    return;
  }
  const a = $('#optCloseToTray'), b = $('#optAutoLaunch');
  const paint = (p) => {
    if (!p) return;
    if (a) a.checked = !!p.closeToTray;
    if (b) b.checked = !!p.autoLaunch;
  };
  Promise.resolve(N.getAppPrefs()).then(paint).catch(() => {});
  if (typeof N.onPrefsChanged === 'function') N.onPrefsChanged(paint);
  if (a) a.addEventListener('change', e => N.setAppPrefs({ closeToTray: e.target.checked }));
  if (b) b.addEventListener('change', e => N.setAppPrefs({ autoLaunch: e.target.checked }));
}

function applyEditorFont() {
  document.documentElement.style.setProperty('--editor-fs', (cfg.editorFont || 14) + 'px');
}

function applyWidth() {
  document.documentElement.style.setProperty('--preview-w', cfg.width + 'px');
  markAnchorsDirty();
}

const SIDEBAR_MIN = 180;
const SIDEBAR_MAX = 520;
function clampSidebarWidth(v) {
  const n = Number(v);
  return Math.min(SIDEBAR_MAX, Math.max(SIDEBAR_MIN, isFinite(n) && n > 0 ? Math.round(n) : 236));
}
function applySidebarWidth() {
  cfg.sidebarWidth = clampSidebarWidth(cfg.sidebarWidth);
  document.documentElement.style.setProperty('--sidebar-w', cfg.sidebarWidth + 'px');
}

function applyUi() {
  document.documentElement.setAttribute('data-ui', cfg.uiDark ? 'dark' : 'light');
}

function bindEvents() {
  // 编辑器
  editor.addEventListener('input', onInput);

  // 撤销 / 重做按钮：状态跟随历史栈，没得撤销时置灰
  const btnUndo = $('#btnUndo'), btnRedo = $('#btnRedo');
  if (btnUndo && btnRedo) {
    btnUndo.addEventListener('click', () => { editor.undo(); syncHistoryButtons(); });
    btnRedo.addEventListener('click', () => { editor.redo(); syncHistoryButtons(); });
  }
  ['input', 'keyup', 'click'].forEach(t => editor.addEventListener(t, syncHistoryButtons));
  syncHistoryButtons();

  /* 图片源码弹窗：点击编辑区里的图片块打开。
     不把 base64 直接摊在编辑区，是因为十几万字符会把那一行撑到几万像素高，
     既没法看，收回图片块后行高也不会自动恢复。 */
  let imgSrcRange = null;
  let imgSrcOrig = '';
  editor.addEventListener('editimage', (d) => {
    if (!d) return;
    imgSrcRange = { from: d.from, to: d.to };
    imgSrcOrig = d.source || '';
    const ta = $('#imgSrcText');
    ta.value = d.source || '';
    $('#imgSrcHint').textContent =
      '整段 Markdown 源码，共 ' + (d.source || '').length.toLocaleString() + ' 个字符。' +
      '可直接修改；点「应用到文档」会替换编辑区里的这一块。';
    $('#imgSrcMask').classList.add('show');
    setTimeout(() => {
      const el = $('#imgSrcText');
      el.focus();
      el.setSelectionRange(0, 0);
      el.scrollTop = 0;
    }, 40);
  });
  $('#btnImgSrcApply').addEventListener('click', () => {
    if (!imgSrcRange) { $('#imgSrcMask').classList.remove('show'); return; }
    // 弹窗开着时文档若被别处改动，记录的位置就已失效，宁可拒绝也不要写坏内容
    const now = editor.value.slice(imgSrcRange.from, imgSrcRange.to);
    if (now !== imgSrcOrig) {
      $('#imgSrcMask').classList.remove('show');
      imgSrcRange = null;
      toast('文档在弹窗期间发生了变化，源码未写入，请重新点击图片', true);
      return;
    }
    editor.replaceRange(imgSrcRange.from, imgSrcRange.to, $('#imgSrcText').value);
    $('#imgSrcMask').classList.remove('show');
    imgSrcRange = null;
    toast('图片源码已更新');
  });
  $('#btnImgSrcCopy').addEventListener('click', async () => {
    const el = $('#imgSrcText');
    try {
      await navigator.clipboard.writeText(el.value);
    } catch (e) {
      el.select();
      document.execCommand('copy');
    }
    toast('已复制图片源码');
  });

  /* ---- 滚动同步：谁在被用户滚，谁就是主控，另一侧跟随 ---- */
  const progressEl = $('#progress');
  let editorRAF = 0, previewRAF = 0;   // 两侧独立合并，避免互相吞掉

  function syncScroll(from, to) {
    const fm = from.scrollHeight - from.clientHeight;
    const tm = to.scrollHeight - to.clientHeight;
    if (fm <= 0 || tm <= 0) return;
    if (anchorsDirty) buildScrollAnchors();

    // 锚点不足（极短文档）才退回整页比例
    if (scrollAnchors.length < 2) {
      setScrollTop(to, Math.min(1, Math.max(0, from.scrollTop / fm)) * tm);
      return;
    }

    if (from === editor) {
      let next = lineToPreviewTop(editor.getViewportLine());
      if (from.scrollTop <= 0) next = 0;
      // 编辑器有 scrollPastEnd 的底部留白，滚到尽头时把预览也带到底；
      // fm 要够大才算「到底」，否则重渲染瞬间内容塌缩会被误判
      else if (fm > 24 && from.scrollTop >= fm - 2) next = tm;
      if (next == null || !isFinite(next)) {
        next = Math.min(1, Math.max(0, from.scrollTop / fm)) * tm;
      }
      setScrollTop(to, next);
    } else {
      // 驱动编辑器时一律按行号闭环对齐。不要在这里写 editor.scrollTop = max：
      // 重渲染瞬间预览可滚动范围会塌缩成几像素，旧逻辑会把它当成「滚到底」
      // 并把编辑器整个拽到文末，这正是偶发大幅偏差的另一个来源。
      editor.setViewportLine(previewTopToLine(from.scrollTop));
    }
  }

  function paintProgress() {
    const max = previewScroll.scrollHeight - previewScroll.clientHeight;
    progressEl.style.width = (max > 0 ? (previewScroll.scrollTop / max) * 100 : 0) + '%';
  }

  editor.addEventListener('scroll', () => {
    if (!cfg.sync || cfg.view !== 'split') return;
    if (scrollOwner === 'preview') return;   // 预览侧的跟随回声
    if (editorRAF) return;                   // 同一帧内多次滚动只同步一次
    editorRAF = requestAnimationFrame(() => {
      editorRAF = 0;
      if (scrollOwner === 'preview') return;
      syncScroll(editor, previewScroll);
    });
  }, { passive: true });

  previewScroll.addEventListener('scroll', () => {
    paintProgress();
    // 程序化设置 / 浏览器滚动锚定造成的位置变化都是回声，绝不能让它反过来
    // 抢占主控、把编辑器拽到别处。主控权只由真实的输入事件（wheel/touch/pointer）
    // 决定，scroll 事件自己不抢——否则延迟到达的回声会伪装成用户滚动。
    if (Math.abs(previewScroll.scrollTop - programmaticPreviewTop) <= 1) return;
    if (performance.now() < echoGuardUntil) return;
    if (jumpLock) { extendJumpLock(); return; }
    if (!cfg.sync || cfg.view !== 'split') return;
    if (scrollOwner !== 'preview') return;
    if (previewRAF) return;
    previewRAF = requestAnimationFrame(() => {
      previewRAF = 0;
      if (scrollOwner !== 'preview') return;
      syncScroll(previewScroll, editor);
    });
  }, { passive: true });

  // 只有真实输入才切换主控权；主控权会一直保持到另一侧被操作，不受渲染耗时影响
  ['wheel', 'touchstart', 'touchmove', 'pointerdown', 'keydown'].forEach(ev =>
    previewScroll.addEventListener(ev, () => {
      programmaticPreviewTop = NaN;   // 用户一动手，旧的回声标记立即失效
      echoGuardUntil = 0;
      claimScroll('preview');
    }, { passive: true }));
  ['wheel', 'touchstart', 'touchmove', 'pointerdown', 'keydown'].forEach(ev =>
    editor.addEventListener(ev, () => claimScroll('editor'), { passive: true }));

  // 公式 SVG、mermaid、图片、字体都是异步改变高度的，光在 renderNow 里
  // 建一次锚点不够；尺寸一变就重建并按当前主控侧重新对齐
  if (typeof ResizeObserver === 'function') {
    const ro = new ResizeObserver(() => scheduleRealign());
    [previewBody, previewScroll, editorPane].forEach(el => { if (el) ro.observe(el); });
  }
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(scheduleRealign);
  previewBody.addEventListener('load', (e) => {
    if (e.target && e.target.tagName === 'IMG') scheduleRealign();
  }, true);

  // 光标位置
  const cursor = () => {
    const pos = editor.selectionStart;
    const before = editor.value.slice(0, pos);
    const line = before.split('\n').length;
    const col = pos - before.lastIndexOf('\n');
    $('#statCursor').textContent = line + ':' + col;
  };
  ['click', 'keyup', 'input'].forEach(ev => editor.addEventListener(ev, cursor));

  // 快捷键：交给 CodeMirror keymap（Tab 缩进、回车续列表由 editor.js 内置）
  if (editor.bindKeys) {
    editor.bindKeys({
      'Mod-b': () => ACTIONS.bold(),
      'Mod-i': () => ACTIONS.italic(),
      'Mod-k': () => ACTIONS.link(),
      'Mod-s': () => saveDocument(),
      'Ctrl-\\': () => toggleToc()
    });
  }

  // 工具栏
  $('#toolbar').addEventListener('click', (e) => {
    const btn = e.target.closest('.tb');
    if (!btn) return;
    const act = ACTIONS[btn.dataset.act];
    if (act) act();
  });

  // 图表模板菜单
  const DIAGRAM_TPL = {
    TB: () => 'flowchart TB\n  A[开始] --> B{判断}\n  B -->|是| C[结束]\n  B -->|否| A',
    LR: () => 'flowchart LR\n  A[开始] --> B{判断}\n  B -->|是| C[结束]\n  B -->|否| A',
    seq: () => 'sequenceDiagram\n  participant A as 甲方\n  participant B as 乙方\n  A->>B: 请求\n  B-->>A: 响应',
    split: () => 'flowchart TB\n  A[试验 PSD] --> B[响应数据] --> C{Grms 对标}\n```\n\n```mermaid\nflowchart TB\n  C{Grms 对标} -->|±15% 内| D[PASS]\n  C -->|超差| E[修正有限元模型]\n  E --> F[重新提交]'
  };
  $('#diagramMenu').addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-diagram]');
    if (!btn) return;
    const key = btn.dataset.diagram;
    const body = DIAGRAM_TPL[key] ? DIAGRAM_TPL[key]() : DIAGRAM_TPL.TB();
    $('#diagramMenu').classList.remove('show');
    insertBlock('```mermaid\n' + body + '\n```', 11);
  });
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.tb-wrap')) $('#diagramMenu').classList.remove('show');
  });

  // 顶部
  document.querySelectorAll('#viewTabs button').forEach(b => {
    b.addEventListener('click', () => setView(b.dataset.view));
  });
  $('#themeSelect').addEventListener('change', e => { cfg.theme = e.target.value; applyTheme(); saveCfg(); });
  $('#btnThemes').addEventListener('click', () => $('#themeMask').classList.add('show'));
  const openSettings = () => $('#settingsMask').classList.add('show');
  $('#btnSettings').addEventListener('click', openSettings);
  $('#btnSettings2').addEventListener('click', openSettings);
  $('#btnToc').addEventListener('click', toggleToc);
  $('#btnUi').addEventListener('click', () => { cfg.uiDark = !cfg.uiDark; applyUi(); $('#optUiDark').checked = cfg.uiDark; saveCfg(); });
  $('#btnOpen').addEventListener('click', () => {
    if (window.native && window.Desktop) window.Desktop.openFileDialog();
    else $('#fileInput').click();
  });
  $('#fileInput').addEventListener('change', e => { openFile(e.target.files[0]); e.target.value = ''; });
  $('#btnFolder').addEventListener('click', () => Vault.pickFolder());
  $('#btnSave').addEventListener('click', () => saveDocument());

  // 导出面板
  $('#btnExport').addEventListener('click', async () => {
    $('#exportMask').classList.add('show');
    $('#exportPreview').innerHTML = '<div style="color:#888;font-size:12px">正在生成…</div>';
    await refreshExportPanel();
  });
  $('#btnCopyWx').addEventListener('click', async () => {
    const html = refreshExportPanel._html || await buildExportHTML();
    if (copyRichHTML(html)) toast('已复制，去公众号后台 Ctrl+V 粘贴');
    else toast('复制失败，请用「下载 HTML」', true);
  });
  $('#btnDownloadHtml').addEventListener('click', async () => {
    const html = refreshExportPanel._html || await buildExportHTML();
    download((doc.name || 'article').replace(/\.md$/i, '') + '-wechat.html', fullDocument(html), 'text/html;charset=utf-8');
    toast('已下载 HTML');
  });
  $('#btnDownloadMd').addEventListener('click', () => {
    download(doc.name || 'untitled.md', doc.text, 'text/markdown;charset=utf-8');
  });
  $('#btnNewDoc').addEventListener('click', () => newDocument());

  // 关闭浮层
  document.querySelectorAll('[data-close]').forEach(btn => {
    btn.addEventListener('click', () => $('#' + btn.dataset.close).classList.remove('show'));
  });
  document.querySelectorAll('.mask').forEach(m => {
    m.addEventListener('click', e => { if (e.target === m) m.classList.remove('show'); });
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') document.querySelectorAll('.mask.show').forEach(m => m.classList.remove('show'));
  });

  // 分栏拖动
  splitter.addEventListener('mousedown', (e) => {
    e.preventDefault();
    const rect = document.querySelector('.panes').getBoundingClientRect();
    const move = (ev) => {
      const ratio = (ev.clientX - rect.left) / rect.width;
      cfg.split = Math.min(0.8, Math.max(0.2, ratio));
      editorPane.style.width = (cfg.split * 100) + '%';
    };
    const up = () => {
      document.removeEventListener('mousemove', move);
      document.removeEventListener('mouseup', up);
      document.body.style.cursor = '';
      markAnchorsDirty();
      saveCfg();
    };
    document.body.style.cursor = 'col-resize';
    document.addEventListener('mousemove', move);
    document.addEventListener('mouseup', up);
  });

  // 文件栏宽度拖动（移动端是抽屉，禁用）
  const sbResizer = $('#sidebarResizer');
  if (sbResizer) {
    sbResizer.addEventListener('mousedown', (e) => {
      if (window.innerWidth <= 860) return;
      e.preventDefault();
      const sb = $('#sidebar');
      const left = sb.getBoundingClientRect().left;
      document.body.classList.add('sidebar-resizing');
      const move = (ev) => {
        cfg.sidebarWidth = clampSidebarWidth(ev.clientX - left);
        applySidebarWidth();
      };
      const up = () => {
        document.removeEventListener('mousemove', move);
        document.removeEventListener('mouseup', up);
        document.body.classList.remove('sidebar-resizing');
        saveCfg();
      };
      document.addEventListener('mousemove', move);
      document.addEventListener('mouseup', up);
    });
    sbResizer.addEventListener('dblclick', (e) => {
      if (window.innerWidth <= 860) return;
      e.preventDefault();
      cfg.sidebarWidth = 236;
      applySidebarWidth(); saveCfg();
      toast('文件栏宽度已恢复默认');
    });
  }

  // 图片插入（工具栏）
  $('#imgInput').addEventListener('change', (e) => {
    const file = e.target.files[0];
    e.target.value = '';
    insertImageFile(file);
  });

  // 编辑区直接粘贴图片（截图 / 复制的图片）；文本粘贴不受影响，仍走原生逻辑
  editor.addEventListener('pasteimage', (ev) => insertImageFile(ev.file));

  // 拖拽打开
  const dz = $('#dropzone');
  let dragDepth = 0;
  window.addEventListener('dragenter', e => {
    if (![...(e.dataTransfer?.types || [])].includes('Files')) return;
    dragDepth++;
    dz.classList.add('show');
  });
  window.addEventListener('dragover', e => e.preventDefault());
  window.addEventListener('dragleave', () => { if (--dragDepth <= 0) dz.classList.remove('show'); });
  window.addEventListener('drop', async e => {
    e.preventDefault();
    dragDepth = 0;
    dz.classList.remove('show');
    const items = e.dataTransfer?.items;
    // 拖入文件夹 → 整目录载入侧栏
    if (items && items.length && items[0].webkitGetAsEntry) {
      const first = items[0].webkitGetAsEntry();
      if (first && first.isDirectory) {
        const n = await Vault.loadFromDroppedItems(items);
        toast(n ? `已载入 ${n} 个文档` : '这个文件夹里没有 md 文件');
        if (n) openFirstVaultDoc();
        return;
      }
    }
    const file = e.dataTransfer?.files?.[0];
    if (file) openFile(file);
  });

  window.addEventListener('resize', () => {
    if (cfg.view === 'split') applySplit();
    markAnchorsDirty();
    scheduleRealign();
  });
}

function toggleToc() {
  tocPanel.classList.toggle('show');
}

/* ---------------- 大体积引擎按需加载 ----------------
 * MathJax(2MB) 与 mermaid(2.5MB) 不再随首屏同步解析：
 * 只有文档真的含公式 / 图表才加载，且放到首屏绘制之后，
 * 让窗口先出来、编辑区立即可用，公式与图表随后补齐。 */
const lazyLibs = {};
const HAS_MATH_RE = /\$\$|\\\[|\\\(|\$(?=[^$\n]*[a-zA-Z\\])[^$\n]+\$/;
const HAS_DIAGRAM_RE = /```mermaid/i;
let mathRequested = false;
let diagramRequested = false;

function loadScriptOnce(key, src) {
  if (lazyLibs[key]) return lazyLibs[key];
  lazyLibs[key] = new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src;
    s.async = true;
    s.onload = resolve;
    s.onerror = () => reject(new Error('加载失败：' + src));
    document.head.appendChild(s);
  }).catch(err => { delete lazyLibs[key]; throw err; });
  return lazyLibs[key];
}

async function ensureMathJax() {
  if (Renderer.isMathReady()) return true;
  if (mathRequested) {
    if (lazyLibs.math) await lazyLibs.math;
    return Renderer.isMathReady();
  }
  mathRequested = true;
  try {
    await loadScriptOnce('math', 'lib/tex-svg.js');
    if (window.MathJax && window.MathJax.startup && window.MathJax.startup.promise) {
      await window.MathJax.startup.promise;
    }
    for (let i = 0; i < 60; i++) {
      if (window.MathJax && typeof window.MathJax.tex2svg === 'function') break;
      await new Promise(r => setTimeout(r, 50));
    }
    if (!window.MathJax || typeof window.MathJax.tex2svg !== 'function') {
      throw new Error('公式引擎未就绪');
    }
    Renderer.setMathReady(true);
    renderNow();               // 占位公式换成真正的 SVG
    return true;
  } catch (e) {
    Renderer.setMathFailed(true);
    renderNow();
    toast('公式引擎加载失败，公式将以原文显示', true);
    return false;
  }
}

async function ensureMermaid() {
  if (window.mermaid) return true;
  if (diagramRequested) {
    if (lazyLibs.diagram) await lazyLibs.diagram;
    return !!window.mermaid;
  }
  diagramRequested = true;
  Renderer.setDiagramEnginePending(true);
  try {
    await loadScriptOnce('diagram', 'lib/mermaid.min.js');
    Renderer.setDiagramEnginePending(false);
    Renderer.configureMermaid(cfg.theme);
    if (previewBody.querySelector('.mermaid-block')) {
      await Renderer.renderDiagrams(previewBody, true);
    }
    markAnchorsDirty();
    return true;
  } catch (e) {
    Renderer.setDiagramEnginePending(false);
    if (previewBody.querySelector('.mermaid-block')) {
      await Renderer.renderDiagrams(previewBody, true);
    }
    toast('图表引擎加载失败', true);
    return false;
  }
}

/** 文档内容变化后按需唤醒对应引擎（幂等） */
function ensureEnginesFor(text) {
  const t = text || '';
  if (HAS_MATH_RE.test(t)) ensureMathJax();
  if (HAS_DIAGRAM_RE.test(t)) ensureMermaid();
}

/** 导出前必须等引擎就绪，否则公式和图表会缺在导出内容里 */
async function ensureEnginesForExport() {
  const t = doc.text || '';
  if (HAS_MATH_RE.test(t)) await ensureMathJax();
  if (HAS_DIAGRAM_RE.test(t)) await ensureMermaid();
  await Renderer.waitDiagrams();
}

/* ---------------- 启动 ---------------- */
function boot() {
  const savedCfg = loadJSON(LS_CFG);
  if (savedCfg) cfg = Object.assign(cfg, savedCfg);
  const savedDoc = loadJSON(LS_DOC);
  if (savedDoc && typeof savedDoc.text === 'string' && savedDoc.text.trim()) doc = savedDoc;

  Vault.init({
    dom: {
      sidebar: $('#sidebar'),
      tree: $('#fileTree'),
      foot: $('#sidebarFoot'),
      title: $('#sidebarTitle'),
      search: $('#fileSearch'),
      dirInput: $('#dirInput'),
      filesInput: $('#filesInput'),
      mask: $('#sidebarMask'),
      btnSidebar: $('#btnSidebar'),
      btnCollapse: $('#btnCollapse'),
      btnPickFolder: $('#btnPickFolder'),
      btnRefresh: $('#btnRefresh')
    },
    hooks: {
      toast,
      onOpenDoc: (d) => {
        loadDocument(d);
        toast('已打开 ' + d.name);
        if (window.innerWidth <= 860) $('#sidebar').classList.add('collapsed');
      },
      onVaultChange: (st) => {
        if (st.count && !currentPath) openFirstVaultDoc();
      }
    }
  });

  if (!EditorAdapter.init(editorHost, { value: doc.text })) {
    console.error('编辑器初始化失败');
  }

  Renderer.init();
  Renderer.setDiagramDir(cfg.diagramDir || 'TB');
  Renderer.configureMermaid(cfg.theme);
  buildThemeUI();
  applyTheme();
  applyWidth();
  applyEditorFont();
  applySidebarWidth();
  applyUi();
  initSettingsUI();
  initAppPrefs();
  bindEvents();

  if (window.innerWidth <= 860) $('#sidebar').classList.add('collapsed');

  editor.value = doc.text;
  const isMobile = window.innerWidth <= 860;
  setView(isMobile && (cfg.view === 'split') ? 'write' : (cfg.view || 'split'));
  applySplit();
  // 首屏有图表时先保留占位源码，别在引擎加载前误报「图表引擎未加载」
  if (HAS_DIAGRAM_RE.test(doc.text)) Renderer.setDiagramEnginePending(true);
  renderNow();

  // 首屏只渲染文本与代码，界面立即可用。
  // 引擎解析会占用主线程：用户一开始操作就立刻补，否则等界面空闲后再补，
  // 避免冷启动后紧接着卡住 1~2 秒。
  let enginesKicked = false;
  const kickOnce = () => {
    if (enginesKicked) return;
    enginesKicked = true;
    ensureEnginesFor(doc.text);
  };
  ['pointerdown', 'keydown', 'wheel'].forEach(ev => {
    window.addEventListener(ev, kickOnce, { once: true, passive: true, capture: true });
  });
  if (typeof window.requestIdleCallback === 'function') {
    requestIdleCallback(kickOnce, { timeout: 1600 });
  } else {
    setTimeout(kickOnce, 1200);
  }
}

/* Electron 桥接层需要的入口 */
window.App = {
  loadDocument, saveDocument, newDocument, setView, toggleToc, download, toast,
  getDoc: () => doc,
  getAbs: () => currentAbs,
  setAbs: (p) => { currentAbs = p; },
  getCurrentPath: () => currentPath,
  setDirtyFlag: (d) => { dirty = !!d; syncWindowTitle(); },
  ACTIONS,
  actions: ACTIONS,
  refreshExportPanel,
  buildExportHTML,
  fullDocument,
  get cfg() { return cfg; },
  saveCfg,
  applyTheme
};

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
else boot();
