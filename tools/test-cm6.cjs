const puppeteer = require('/sandbox/workspace/.devtools/node_modules/puppeteer-core');
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const b = await puppeteer.launch({ executablePath:'/sandbox/workspace/.devtools/chrome-headless-shell-linux64/chrome-headless-shell', headless:true, args:['--no-sandbox','--allow-file-access-from-files'] });
  const p = await b.newPage();
  await p.setViewport({ width: 1500, height: 920, deviceScaleFactor: 2 });
  const errs = [];
  p.on('pageerror', e => errs.push('PAGEERROR ' + e.message));
  p.on('console', m => { if (m.type() === 'error') errs.push('CONSOLE ' + m.text()); });
  await p.goto('file:///sandbox/workspace/md-studio-electron/renderer/index.html', { waitUntil:'load' });
  await p.evaluate(() => localStorage.clear());
  await p.reload({ waitUntil:'load' });
  await sleep(4500);

  const base = await p.evaluate(() => ({
    cm6: typeof window.CM6,
    hasEditor: !!document.querySelector('.cm-editor'),
    lines: document.querySelectorAll('.cm-line').length,
    gutter: document.querySelectorAll('.cm-lineNumbers .cm-gutterElement').length,
    highlighted: {
      heading: document.querySelectorAll('.cm-line .tok-heading, .cm-line span[class*="ͼ"]').length,
      anySpans: document.querySelectorAll('.cm-line span').length
    },
    valueLen: EditorAdapter.value.length,
    previewH1: document.querySelectorAll('#preview .md-body h1').length,
    previewMath: document.querySelectorAll('#preview .math-inline > svg, #preview .math-block > svg').length,
    previewDiagram: document.querySelectorAll('#preview .mermaid-block > svg').length
  }));
  console.log('基础:', JSON.stringify(base));

  // 输入 → 预览联动
  await p.evaluate(() => {
    const v = EditorAdapter.view;
    v.dispatch({ changes: { from: 0, to: v.state.doc.length, insert: '# 新标题\n\n段落 **加粗** 与 $x^2$\n\n- 项目一\n' } });
  });
  await sleep(900);
  const afterInput = await p.evaluate(() => ({
    h1: document.querySelector('#preview .md-body h1')?.textContent,
    strong: document.querySelectorAll('#preview .md-body strong').length,
    math: document.querySelectorAll('#preview .math-inline > svg').length,
    stat: document.getElementById('statWord').textContent
  }));
  console.log('输入后:', JSON.stringify(afterInput));

  // 快捷键 Mod-B
  await p.click('.cm-content');
  await p.evaluate(() => EditorAdapter.setSelectionRange(8, 10)); // "段落" 两字
  await p.keyboard.down('Control'); await p.keyboard.press('b'); await p.keyboard.up('Control');
  await sleep(400);
  const bold = await p.evaluate(() => EditorAdapter.value.slice(0, 30));
  console.log('Ctrl+B:', JSON.stringify(bold));

  // Enter 续列表
  await p.evaluate(() => {
    const v = EditorAdapter.view;
    const len = v.state.doc.length;
    v.dispatch({ changes: { from: 0, to: len, insert: '- 第一项\n' }, selection: { anchor: 5 } });
    v.focus();
  });
  await p.keyboard.press('Enter');
  await sleep(300);
  console.log('Enter 续列表:', JSON.stringify(await p.evaluate(() => EditorAdapter.value)));

  // Tab 缩进
  await p.evaluate(() => { const v = EditorAdapter.view; v.dispatch({ changes: { from: 0, to: v.state.doc.length, insert: 'abc' }, selection: { anchor: 0 } }); v.focus(); });
  await p.keyboard.press('Tab');
  await sleep(250);
  console.log('Tab 缩进:', JSON.stringify(await p.evaluate(() => EditorAdapter.value)));

  // 光标状态栏
  console.log('光标:', JSON.stringify(await p.evaluate(() => document.getElementById('statCursor').textContent)));

  // 滚动同步（CM6 滚动容器）
  const sc = await p.evaluate(async () => {
    const v = EditorAdapter.view;
    v.dispatch({ changes: { from: 0, to: v.state.doc.length, insert: Array.from({length: 200}, (_, i) => `第 ${i} 行内容`).join('\n\n') } });
    await new Promise(r => setTimeout(r, 1200));
    const before = { e: Math.round(EditorAdapter.scrollTop), p: Math.round(previewScroll.scrollTop) };
    EditorAdapter.scrollTop = 800;
    await new Promise(r => setTimeout(r, 400));
    return { before, after: { e: Math.round(EditorAdapter.scrollTop), p: Math.round(previewScroll.scrollTop) } };
  });
  console.log('滚动同步:', JSON.stringify(sc));

  await p.screenshot({ path: '/sandbox/workspace/md-studio-electron/tools/shot-cm6.png' });
  console.log('ERRORS:', errs.length ? errs.slice(0,5).join('\n') : 'none');
  await b.close();
})();
