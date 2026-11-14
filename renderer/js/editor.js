/* ===========================================================
 *  Markdown Studio · CodeMirror 6 适配层
 *  对外暴露与 textarea 一致的 API，让 app.js 几乎不用改；
 *  额外提供语法着色、行号、搜索、折叠、多光标、列表续写
 * =========================================================== */

const EditorAdapter = (() => {
  let view = null;
  let keysCompartment = null;
  const listeners = {};
  const userKeys = [];

  const emit = (type, ev) => {
    (listeners[type] || []).forEach(fn => { try { fn(ev || {}); } catch (e) { console.error(e); } });
  };

  /* ---------------- 自定义命令：回车续写列表 ---------------- */
  function continueList(v) {
    const { state } = v;
    const sel = state.selection.main;
    if (!sel.empty) return false;
    const line = state.doc.lineAt(sel.head);
    if (sel.head !== line.to) return false;
    const m = line.text.match(/^(\s*)([-*+]\s\[[ xX]\]\s|[-*+]\s|\d+\.\s|>\s)/);
    if (!m) return false;

    if (line.text.trim() === m[2].trim()) {
      v.dispatch({
        changes: { from: line.from, to: line.to, insert: '' },
        selection: { anchor: line.from },
        scrollIntoView: true
      });
      return true;
    }

    let marker = m[2];
    if (/^\d+\./.test(marker)) marker = (parseInt(marker, 10) + 1) + '. ';
    else if (/\[[ xX]\]/.test(marker)) marker = marker.replace(/\[[ xX]\]/, '[ ]');

    const insert = '\n' + m[1] + marker;
    v.dispatch({
      changes: { from: sel.head, insert },
      selection: { anchor: sel.head + insert.length },
      scrollIntoView: true
    });
    return true;
  }

  function buildKeys() {
    return CM6.keymap.of([
      ...userKeys,
      { key: 'Enter', run: continueList },
      ...CM6.closeBracketsKeymap,
      ...CM6.defaultKeymap,
      ...CM6.searchKeymap,
      ...CM6.historyKeymap,
      ...CM6.foldKeymap,
      CM6.indentWithTab
    ]);
  }

  /* ---------------- 初始化 ---------------- */
  function init(mountEl, opts = {}) {
    if (!window.CM6) {
      console.error('CodeMirror bundle 未加载（lib/cm6.js）');
      return false;
    }
    keysCompartment = new CM6.Compartment();

    const theme = CM6.EditorView.theme({
      '&': { height: '100%', backgroundColor: 'transparent' },
      '.cm-scroller': {
        fontFamily: 'var(--mono)',
        fontSize: 'var(--editor-fs, 14px)',
        lineHeight: '1.7',
        overflow: 'auto'
      },
      '.cm-content': {
        padding: '12px 0 50vh', caretColor: 'var(--accent)',
        whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', wordBreak: 'break-word'
      },
      '.cm-line': { padding: '0 16px' },
      '.cm-gutters': {
        backgroundColor: 'transparent',
        color: 'var(--cm-gutter, #b9c0c8)',
        border: 'none',
        paddingLeft: '4px'
      },
      '.cm-lineNumbers .cm-gutterElement': { padding: '0 8px 0 4px', minWidth: '24px' },
      '.cm-activeLine': { backgroundColor: 'var(--cm-active-line, rgba(37,99,235,.055))' },
      '.cm-activeLineGutter': { backgroundColor: 'transparent', color: 'var(--accent)' },
      '.cm-selectionBackground, &.cm-focused .cm-selectionBackground': {
        backgroundColor: 'var(--cm-selection, rgba(37,99,235,.20))'
      },
      '.cm-cursor, .cm-dropCursor': { borderLeftColor: 'var(--accent)', borderLeftWidth: '2px' },
      '.cm-matchingBracket': { backgroundColor: 'rgba(37,99,235,.18)', outline: 'none' },
      '.cm-searchMatch': { backgroundColor: 'rgba(255,196,0,.35)', outline: '1px solid rgba(255,196,0,.55)' },
      '.cm-searchMatch.cm-searchMatch-selected': { backgroundColor: 'rgba(255,150,0,.5)' },
      '.cm-panels': { backgroundColor: 'var(--panel)', color: 'var(--text)', borderTop: '1px solid var(--border)' },
      '.cm-panels input, .cm-panels button': { color: 'var(--text)' },
      '.cm-foldGutter .cm-gutterElement': { color: 'var(--muted)', cursor: 'pointer' },
      '.cm-tooltip': { backgroundColor: 'var(--panel)', border: '1px solid var(--border)' }
    });

    const state = CM6.EditorState.create({
      doc: opts.value || '',
      extensions: [
        CM6.lineNumbers(),
        CM6.highlightActiveLineGutter(),
        CM6.highlightSpecialChars(),
        CM6.history(),
        CM6.drawSelection(),
        CM6.dropCursor(),
        CM6.EditorState.allowMultipleSelections.of(true),
        CM6.indentOnInput(),
        CM6.indentUnit.of('  '),
        CM6.EditorState.tabSize.of(2),
        CM6.syntaxHighlighting(CM6.mdHighlight),
        CM6.bracketMatching(),
        CM6.closeBrackets(),
        CM6.highlightActiveLine(),
        CM6.highlightSelectionMatches(),
        CM6.rectangularSelection(),
        CM6.crosshairCursor(),
        CM6.scrollPastEnd(),
        // 长行自动折行：不再需要把编辑栏拉得很宽才能看全内容
        CM6.EditorView.lineWrapping,
        CM6.markdown({ base: CM6.markdownLanguage, addKeymap: true }),
        keysCompartment.of(buildKeys()),
        CM6.EditorView.updateListener.of((u) => {
          if (u.docChanged) emit('input');
          if (u.docChanged || u.selectionSet) {
            // app.js 通过 click/keyup 更新光标位置，这里一并转出
            emit('keyup');
            emit('click');
          }
        }),
        theme
      ]
    });

    view = new CM6.EditorView({ state, parent: mountEl });
    view.scrollDOM.addEventListener('scroll', () => emit('scroll'), { passive: true });
    // 用户刚在这一侧操作时就立刻抢占滚动主控权，避免另一侧上一轮的
    // 时间窗还没过期、把这次滚动当成「回声」吞掉（app.js 会监听这些事件）
    ['wheel', 'touchstart', 'touchmove', 'pointerdown', 'keydown'].forEach(type => {
      view.scrollDOM.addEventListener(type, (e) => emit(type, e), { passive: true });
    });
    return true;
  }

  /* ---------------- 对外 API（尽量与 textarea 一致） ---------------- */
  const api = {
    get value() { return view ? view.state.doc.toString() : ''; },
    set value(v) {
      if (!view) return;
      const text = v == null ? '' : String(v);
      if (text === view.state.doc.toString()) return;
      view.dispatch({
        changes: { from: 0, to: view.state.doc.length, insert: text },
        selection: { anchor: 0 },
        scrollIntoView: false
      });
      view.scrollDOM.scrollTop = 0;
    },

    get selectionStart() { return view ? view.state.selection.main.from : 0; },
    get selectionEnd() { return view ? view.state.selection.main.to : 0; },

    get scrollTop() { return view ? view.scrollDOM.scrollTop : 0; },
    set scrollTop(v) { if (view) view.scrollDOM.scrollTop = v; },
    get scrollHeight() { return view ? view.scrollDOM.scrollHeight : 0; },
    get clientHeight() { return view ? view.scrollDOM.clientHeight : 0; },

    focus() { if (view) view.focus(); },
    blur() { if (view) view.contentDOM.blur(); },

    setSelectionRange(from, to) {
      if (!view) return;
      const len = view.state.doc.length;
      const a = Math.max(0, Math.min(from, len));
      const b = Math.max(0, Math.min(to == null ? a : to, len));
      view.dispatch({ selection: { anchor: a, head: b }, scrollIntoView: true });
    },

    setRangeText(text, from, to, mode) {
      if (!view) return;
      const insert = String(text == null ? '' : text);
      const len = view.state.doc.length;
      const f = Math.max(0, Math.min(from, len));
      const t = Math.max(f, Math.min(to == null ? f : to, len));
      const sel = (mode === 'select')
        ? { anchor: f, head: f + insert.length }
        : { anchor: f + insert.length };
      view.dispatch({
        changes: { from: f, to: t, insert },
        selection: sel,
        scrollIntoView: true
      });
    },

    addEventListener(type, fn) {
      // paste 交给 CM6 原生处理；keydown 仅用于通知外层「用户在这一侧」，
      // 快捷键本身仍走 keymap（见 bindKeys），这里不拦截、不阻止默认行为
      if (type === 'paste') return;
      (listeners[type] || (listeners[type] = [])).push(fn);
    },

    /** 注册快捷键，键位写法同 CodeMirror：'Mod-b' = Ctrl/Cmd + b */
    bindKeys(map) {
      Object.keys(map).forEach(key => {
        userKeys.push({ key, run: () => { map[key](); return true; } });
      });
      if (view && keysCompartment) {
        view.dispatch({ effects: keysCompartment.reconfigure(buildKeys()) });
      }
    },

    getCursor() {
      if (!view) return { line: 1, col: 1 };
      const sel = view.state.selection.main;
      const line = view.state.doc.lineAt(sel.head);
      return { line: line.number, col: sel.head - line.from + 1 };
    },

    /** 打开搜索面板 */
    openSearch() {
      if (view) CM6.openSearchPanel(view);
    },

    /* ---- 精准滚动同步用：以「浮点源码行号」表示视口顶部位置 ---- */
    get lineCount() { return view ? view.state.doc.lines : 0; },

    getViewportLine() {
      if (!view) return 1;
      const st = view.scrollDOM.scrollTop;
      let block;
      try { block = view.lineBlockAtHeight(st); } catch (e) { return 1; }
      if (!block) return 1;
      const line = view.state.doc.lineAt(block.from).number;
      const frac = block.height > 0 ? Math.min(1, Math.max(0, (st - block.top) / block.height)) : 0;
      return line + frac;
    },

    /** 浮点源码行号 → 编辑器 scrollTop（供预览侧反向精确驱动） */
    lineToScrollTop(lineFloat) {
      if (!view) return 0;
      const maxLine = view.state.doc.lines;
      const lf = Math.max(1, Math.min(maxLine, lineFloat || 1));
      if (lf <= 1) return 0;   // 顶部留白不算行，保证两侧都能真正回到 0
      const ln = Math.floor(lf);
      let block;
      try { block = view.lineBlockAt(view.state.doc.line(ln).from); } catch (e) { return 0; }
      return block ? block.top + (lf - ln) * block.height : 0;
    },

    /**
     * 把视口顶部对齐到浮点源码行号。
     * CM6 只对可见行做实测，视口外的行高是估算值（开启自动折行后误差更大），
     * 所以先按估算跳过去，再读回实际行号、按实测行高迭代修正，通常 1~2 次收敛。
     */
    setViewportLine(lineFloat) {
      if (!view) return;
      const target = Math.max(1, lineFloat || 1);
      const sd = view.scrollDOM;
      sd.scrollTop = Math.max(0, api.lineToScrollTop(target));
      let tries = 0;
      const refine = () => {
        if (!view || ++tries > 6) return;
        try { view.requestMeasure(); } catch (e) {}
        const err = target - api.getViewportLine();
        if (!isFinite(err) || Math.abs(err) < 0.1) return;
        const b = view.lineBlockAtHeight(sd.scrollTop);
        const px = b && b.height > 0 ? b.height : 20;
        const max = Math.max(0, sd.scrollHeight - sd.clientHeight);
        const next = Math.min(max, Math.max(0, sd.scrollTop + err * px));
        if (Math.abs(next - sd.scrollTop) < 0.5) return;
        sd.scrollTop = next;
        requestAnimationFrame(refine);
      };
      requestAnimationFrame(refine);
    },

    get view() { return view; }
  };

  return Object.assign(api, { init, continueList });
})();
