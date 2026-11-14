/* ===========================================================
 *  Markdown Studio · 渲染管线
 *  Markdown → marked → HTML（公式走 MathJax SVG、代码走 highlight.js）
 *  输出结构针对微信做预处理：代码逐行 span、任务列表用符号、图片自适应
 * =========================================================== */

const Renderer = (() => {
  let mathReady = false;
  let mathFailed = false;
  let diagramEnginePending = false;
  let blockLinesExact = true;   // lexer 的 raw 是否完整拼回原文

  /* ---------------- 工具 ---------------- */
  const esc = (s) => String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

  /* ---------------- 公式渲染（MathJax SVG，同步） ---------------- */
  function renderTeX(latex, display) {
    const MJ = window.MathJax;
    if (!MJ || !MJ.tex2svg) {
      // 公式引擎按需加载中：先显示中性占位，不弹红色错误，加载完自动重渲染
      if (mathFailed) return `<span class="math-error">${esc(latex)}</span>`;
      const raw = display ? '$$' + latex + '$$' : '$' + latex + '$';
      return `<span class="math-pending">${esc(raw)}</span>`;
    }
    try {
      const node = MJ.tex2svg(latex, { display });
      // 只保留自包含的 <svg>：丢掉 mjx-container 这层壳，
      // 微信、剪贴板、其他渲染器对原生 svg 的兼容性都更好
      const svg = node.querySelector('svg');
      if (!svg) return `<span class="math-error">${esc(latex)}</span>`;
      const st = svg.getAttribute('style') || '';
      const keep = st.split(';').filter(s => /vertical-align/i.test(s)).join(';');
      svg.setAttribute('style', keep + (keep ? ';' : '') + 'max-width:100%;');
      return svg.outerHTML;
    } catch (e) {
      return `<span class="math-error">${esc(latex)}</span>`;
    }
  }

  /* ---------------- 代码高亮：按行拆分并修复 span ---------------- */
  function splitHighlightedLines(html) {
    const lines = [], stack = [];
    const re = /<span\b[^>]*>|<\/span>|\n|[^<\n]+|</g;
    let cur = '', m;
    while ((m = re.exec(html)) !== null) {
      const t = m[0];
      if (t === '\n') {
        lines.push(cur + '</span>'.repeat(stack.length));
        cur = stack.join('');
      } else if (t === '</span>') {
        stack.pop();
        cur += t;
      } else if (t.startsWith('<span')) {
        stack.push(t);
        cur += t;
      } else {
        cur += t;
      }
    }
    lines.push(cur + '</span>'.repeat(stack.length));
    return lines;
  }

  function renderCode(code, lang) {
    let body;
    const language = (lang || '').trim().split(/\s+/)[0].toLowerCase();

    // mermaid 图表：先占位，异步渲染成 SVG（源码存在 data-src，便于切主题后重绘）
    if (language === 'mermaid') {
      return `<div class="mermaid-block" data-src="${esc(code)}"><pre class="mermaid-raw">${esc(code)}</pre></div>\n`;
    }
    try {
      if (language && window.hljs && hljs.getLanguage(language)) {
        body = hljs.highlight(code, { language, ignoreIllegals: true }).value;
      } else if (!language && window.hljs) {
        const auto = hljs.highlightAuto(code);
        body = (auto.relevance >= 6) ? auto.value : esc(code);
      } else {
        body = esc(code);
      }
    } catch (e) { body = esc(code); }

    const lines = splitHighlightedLines(body.replace(/\n$/, ''));
    const rows = lines.map(l => `<span class="cl">${l || '<br>'}</span>`).join('');
    const head = language ? `<div class="code-head">${esc(language)}</div>` : '';
    return `<div class="code-block">${head}<div class="code-body">${rows}</div></div>`;
  }

  /* ---------------- marked 扩展：数学 ---------------- */
  const mathBlockExt = {
    name: 'mathBlock',
    level: 'block',
    start(src) {
      const i = src.search(/^[ \t]*(\$\$|\\\[)/m);
      return i < 0 ? undefined : i;
    },
    tokenizer(src) {
      let m = /^[ \t]*\$\$([\s\S]+?)\$\$[ \t]*(?:\n+|$)/.exec(src);
      if (!m) m = /^[ \t]*\\\[([\s\S]+?)\\\][ \t]*(?:\n+|$)/.exec(src);
      if (m) return { type: 'mathBlock', raw: m[0], text: m[1].trim() };
    },
    renderer(token) {
      return `<div class="math-block">${renderTeX(token.text, true)}</div>`;
    }
  };

  const mathInlineExt = {
    name: 'mathInline',
    level: 'inline',
    start(src) {
      // 不使用 lookbehind，兼容较旧的 Safari（iOS 微信内置浏览器）
      const i = src.search(/[$\\]/);
      return i < 0 ? undefined : i;
    },
    tokenizer(src) {
      if (src[0] === '\\') {
        const m = /^\\\(([\s\S]+?)\\\)/.exec(src);
        if (m) return { type: 'mathInline', raw: m[0], text: m[1].trim() };
        return;
      }
      if (src[0] !== '$' || src[1] === '$') return;
      const m = /^\$([^$\n]+)\$/.exec(src);
      if (!m) return;
      const inner = m[1];
      if (!inner.trim()) return;
      // 货币写法（$100、$5.00）不当作公式
      if (/^\d+(\.\d+)?$/.test(inner.trim())) return;
      return { type: 'mathInline', raw: m[0], text: inner.trim() };
    },
    renderer(token) {
      return `<span class="math-inline">${renderTeX(token.text, false)}</span>`;
    }
  };

  /* ---------------- marked 渲染覆盖 ---------------- */
  function setupMarked() {
    const renderer = {
      code(codeOrToken, infostring) {
        const code = typeof codeOrToken === 'object' ? codeOrToken.text : codeOrToken;
        const info = typeof codeOrToken === 'object' ? codeOrToken.lang : infostring;
        return renderCode(code, info) + '\n';
      },
      heading(text, level) {
        const id = 'h-' + Math.random().toString(36).slice(2, 9);
        return `<h${level} id="${id}">${text}</h${level}>\n`;
      },
      image(hrefOrToken, title, text) {
        const href = typeof hrefOrToken === 'object' ? hrefOrToken.href : hrefOrToken;
        const t = typeof hrefOrToken === 'object' ? hrefOrToken.title : title;
        const alt = typeof hrefOrToken === 'object' ? hrefOrToken.text : text;
        return `<img src="${esc(href)}" alt="${esc(alt || '')}"${t ? ` title="${esc(t)}"` : ''}>`;
      },
      checkbox(checked) {
        return `<span class="task-box">${checked ? '☑' : '☐'}</span>`;
      },
      listitem(text, task) {
        if (task) return `<li class="task-item">${text}</li>\n`;
        return `<li>${text}</li>\n`;
      }
    };

    marked.use({ gfm: true, breaks: false, pedantic: false, async: false, renderer,
      extensions: [mathBlockExt, mathInlineExt] });
  }

  /* ---------------- 后处理：结构改造 ---------------- */
  function postProcess(html) {
    const host = document.createElement('div');
    host.innerHTML = html;
    host.querySelectorAll('table').forEach(t => {
      if (t.parentElement && t.parentElement.classList.contains('table-wrap')) return;
      const wrap = document.createElement('div');
      wrap.className = 'table-wrap';
      t.replaceWith(wrap);
      wrap.appendChild(t);
    });
    host.querySelectorAll('input[type="checkbox"]').forEach(i => i.remove());
    return host.innerHTML;
  }

  /* ---------------- 源码行 ↔ 预览块映射 ---------------- */
  /**
   * marked 的顶层 token.raw 依次拼接恰好等于原文，所以累计 token.raw 里的
   * 换行数就是每个块的精确起始行号，space 块不产生 DOM 元素、跳过。
   *
   * 注意：绝不能给「不以 \n 结尾的 raw」额外 +1 —— 那个换行属于后面的
   * space token，重复计数会逐块累积，滚到文档后段能偏出一整屏。
   */
  function computeBlockLines(md) {
    let tokens;
    try { tokens = marked.lexer(md || ''); } catch (e) { return []; }
    const src = md || '';
    const lines = [];
    let line = 1, joined = '';
    for (const t of tokens) {
      const raw = t.raw || '';
      if (t.type !== 'space') lines.push(line);
      line += (raw.match(/\n/g) || []).length;
      joined += raw;
    }
    // lexer 丢字符时行号只是近似值，交给下面的文本对齐兜底
    blockLinesExact = (joined === src && line <= src.split('\n').length + 1);
    return lines;
  }

  /** token 数与 DOM 块数不一致时，用块首文本在源码里做单调对齐，
   *  比「按块数均匀分行号」精确得多（后者遇到大表格/代码块会整体错位）。 */
  function alignByText(kids, blockLines, md) {
    const src = (md || '').split('\n');
    const norm = s => String(s)
      .replace(/[\s`*_~#>|:\-—–·()（）\[\]☆★⭐💡✅❌]/g, '').toLowerCase();
    const out = [];
    let cursor = 1;
    for (let i = 0; i < kids.length; i++) {
      const sig = norm(kids[i].textContent || '').slice(0, 12);
      let hit = 0;
      if (sig.length >= 4) {
        const probe = sig.slice(0, 8);
        for (let l = cursor; l <= Math.min(src.length, cursor + 80); l++) {
          const nl = norm(src[l - 1]);
          if (nl.startsWith(probe) || (probe.length >= 6 && nl.includes(probe))) { hit = l; break; }
        }
      }
      if (hit) { out.push(hit); cursor = hit + 1; continue; }
      // 匹配不上（代码块、表格、公式等）：用 token 行号按比例给一个单调估计
      const idx = Math.min(blockLines.length - 1,
        Math.round(i * blockLines.length / Math.max(1, kids.length)));
      const est = blockLines.length ? blockLines[Math.max(0, idx)] : 1;
      out.push(Math.max(out.length ? out[out.length - 1] : 1, est));
    }
    return out;
  }

  /** 把行号写到顶层元素上，供滚动同步采样锚点 */
  function annotateSourceLines(html, blockLines, md) {
    const host = document.createElement('div');
    host.innerHTML = html;
    const kids = [...host.children];
    if (!kids.length) return html;

    const rawLines = (blockLinesExact && blockLines.length === kids.length)
      ? blockLines : alignByText(kids, blockLines, md);
    // 行号单调不减且不超过总行数：任何异常数据都不能把锚点撑出文档范围
    const total = Math.max(1, (md || '').split('\n').length);
    let prev = 1;
    const lines = kids.map((el, i) => {
      const v = Math.max(prev, Math.min(total, Math.round(rawLines[i]) || 1));
      prev = v;
      return v;
    });
    kids.forEach((el, i) => el.setAttribute('data-md-line', lines[i]));
    return host.innerHTML;
  }

  /* ---------------- 目录 ---------------- */
  function extractTOC(container) {
    const items = [];
    container.querySelectorAll('h1, h2, h3, h4').forEach((h, i) => {
      if (!h.id) h.id = 'h-toc-' + i;
      items.push({ id: h.id, level: +h.tagName[1], text: h.textContent.trim() });
    });
    return items;
  }

  /* ---------------- mermaid 图表 ---------------- */
  let diagramDir = 'TB';   // 'TB' 竖排 | 'LR' 横排 | 'auto' 跟随源码
  let mmdSeq = 0;
  let mmdToken = 0;
  let mmdQueue = Promise.resolve();

  function setDiagramDir(d) { diagramDir = d || 'TB'; }

  /**
   * 按设置改写流程图方向：只改首行的 flowchart/graph 方向关键字，
   * 不改动节点与连线，所以「横排」也能随时切回「竖排」。
   * 时序图/甘特图等不受影响。
   */
  function applyDiagramDirection(code) {
    if (diagramDir === 'auto') return code;
    return code.replace(/^(\s*)(flowchart|graph)(\s+)(TB|TD|BT|LR|RL)\b/m,
      (m, sp, kw, ws) => sp + kw + ws + diagramDir);
  }

  function configureMermaid(themeId) {
    if (!window.mermaid) return false;
    const dark = themeId === 'night';
    const vars = dark ? {
      primaryColor: '#2b3644', primaryBorderColor: '#4fc1ff', primaryTextColor: '#dcdcdc',
      secondaryColor: '#252a31', tertiaryColor: '#1e1e1e', lineColor: '#8b949e',
      textColor: '#dcdcdc', nodeBorder: '#4fc1ff', clusterBkg: '#252a31',
      clusterBorder: '#3a3a3c', edgeLabelBackground: '#1e1e1e', fontSize: '14px'
    } : {
      primaryColor: '#eef4ff', primaryBorderColor: '#2563eb', primaryTextColor: '#1f2328',
      secondaryColor: '#f4f7fb', tertiaryColor: '#ffffff', lineColor: '#7a8798',
      textColor: '#1f2328', nodeBorder: '#2563eb', clusterBkg: '#f7f9fc',
      clusterBorder: '#c9d6e8', edgeLabelBackground: '#ffffff', fontSize: '14px'
    };
    try {
      window.mermaid.initialize({
        startOnLoad: false,
        securityLevel: 'strict',
        theme: 'base',
        themeVariables: vars,
        // 顶层 htmlLabels 必须一起关：只设 flowchart.htmlLabels 时节点仍用 <foreignObject>，
        // 这类 SVG 在 Safari / 微信里转图会丢失文字
        htmlLabels: false,
        fontFamily: '-apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", sans-serif',
        flowchart: { htmlLabels: false, useMaxWidth: true, padding: 14, curve: 'basis' },
        class: { htmlLabels: false, useMaxWidth: true },
        state: { useMaxWidth: true },
        sequence: { useMaxWidth: true, mirrorActors: false, diagramMarginX: 12, diagramMarginY: 12, actorMargin: 44, messageMargin: 28, boxMargin: 8, noteMargin: 8, wrap: true },
        gantt: { useMaxWidth: true },
        pie: { useMaxWidth: true },
        er: { useMaxWidth: true },
        journey: { useMaxWidth: true },
        mindmap: { useMaxWidth: true }
      });
      return true;
    } catch (e) { return false; }
  }

  async function doRenderDiagrams(root, force) {
    const blocks = [...root.querySelectorAll('.mermaid-block')];
    if (!blocks.length) return;
    if (!window.mermaid) {
      // 引擎按需加载中：保留占位源码，加载完成后由 app.js 强制重绘
      if (diagramEnginePending) return;
      blocks.forEach(b => {
        b.classList.add('failed');
        b.innerHTML = `<div class="diagram-error">图表引擎未加载（lib/mermaid.min.js）</div><pre class="mermaid-raw">${esc(b.dataset.src || '')}</pre>`;
      });
      return;
    }
    const token = ++mmdToken;
    for (const block of blocks) {
      if (token !== mmdToken) return;
      if (!force && block.dataset.rendered === '1') continue;
      const src = block.dataset.src || '';
      if (!src.trim()) continue;
      try {
        const { svg } = await window.mermaid.render('mmd-' + (++mmdSeq), applyDiagramDirection(src));
        if (token !== mmdToken) return;
        block.innerHTML = svg;
        const svgEl = block.querySelector(':scope > svg');
        if (svgEl) {
          // 按 viewBox 的自然尺寸显示：竖排图不放大占满整屏，宽图在窄容器里等比缩小
          const vb = (svgEl.getAttribute('viewBox') || '').split(/[\s,]+/).map(Number);
          const nw = vb.length === 4 && vb[2] > 0 ? Math.round(vb[2]) : 0;
          const nh = vb.length === 4 && vb[3] > 0 ? Math.round(vb[3]) : 0;
          svgEl.removeAttribute('style');
          if (nw && nh) {
            svgEl.setAttribute('width', nw);
            svgEl.setAttribute('height', nh);
          }
          svgEl.style.maxWidth = '100%';
          svgEl.style.height = 'auto';
        }
        block.dataset.rendered = '1';
        block.classList.remove('failed');
      } catch (err) {
        if (token !== mmdToken) return;
        const msg = String((err && err.message) || err).split('\n')[0].slice(0, 160);
        block.innerHTML = `<div class="diagram-error">图表语法错误：${esc(msg)}</div><pre class="mermaid-raw">${esc(src)}</pre>`;
        block.dataset.rendered = '1';
        block.classList.add('failed');
      }
    }
  }

  function renderDiagrams(root, force) {
    mmdQueue = doRenderDiagrams(root, force);
    return mmdQueue;
  }

  /* ---------------- 对外 ---------------- */
  return {
    init() { setupMarked(); },
    setMathReady(v) { mathReady = v; },
    setMathFailed(v) { mathFailed = !!v; },
    setDiagramEnginePending(v) { diagramEnginePending = !!v; },
    isMathReady() { return mathReady; },
    esc,
    configureMermaid,
    setDiagramDir,
    applyDiagramDirection,
    renderDiagrams,
    waitDiagrams() { return mmdQueue; },
    parse(md) {
      if (!window.marked) return '<p>渲染引擎未加载</p>';
      let html = '';
      try { html = marked.parse(md || '', { async: false }); }
      catch (e) { html = `<p class="math-error">渲染错误：${esc(e.message)}</p>`; }
      const processed = postProcess(html);
      return annotateSourceLines(processed, computeBlockLines(md), md);
    },
    renderInto(md, previewEl) {
      previewEl.innerHTML = this.parse(md);
      renderDiagrams(previewEl, false);
      return extractTOC(previewEl);
    },
    renderCode
  };
})();
