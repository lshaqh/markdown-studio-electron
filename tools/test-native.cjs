const puppeteer = require('/sandbox/workspace/.devtools/node_modules/puppeteer-core');
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const b = await puppeteer.launch({ executablePath:'/sandbox/workspace/.devtools/chrome-headless-shell-linux64/chrome-headless-shell', headless:true, args:['--no-sandbox','--allow-file-access-from-files'] });
  const p = await b.newPage();
  await p.setViewport({ width: 1500, height: 920 });
  const errs = [];
  p.on('pageerror', e => errs.push('PAGEERROR ' + e.message));
  p.on('console', m => { if (m.type() === 'error') errs.push('CONSOLE ' + m.text()); });

  // 注入 mock native（模拟 Electron preload 暴露的 API）
  await p.evaluateOnNewDocument(() => {
    window.__calls = [];
    window.native = {
      isElectron: true, platform: 'win32',
      openFileDialog: async () => ({ path: 'D:\\docs\\a.md', name: 'a.md', content: '# 来自原生 API\n\n正文内容 $E=mc^2$\n' }),
      saveAsDialog: async (n, c) => { window.__calls.push(['saveAs', n]); return { path: 'D:\\docs\\' + n, name: n }; },
      openFolderDialog: async () => ({ dir: 'D:\\docs', name: 'docs', entries: [
        { path: 'a.md', abs: 'D:\\docs\\a.md' },
        { path: 'sub/b.md', abs: 'D:\\docs\\sub\\b.md' }
      ]}),
      readFile: async (f) => { window.__calls.push(['read', f]); return { ok: true, content: '# 内容来自 ' + f.split('\\').pop() + '\n\n正文\n' }; },
      writeFile: async (f, c) => { window.__calls.push(['write', f, c.length]); return { ok: true }; },
      setTitle: (t) => { window.__title = t; },
      setDirty: (d) => { window.__dirty = d; },
      getInfo: async () => ({ version: '1.0.0', platform: 'win32' }),
      getRecent: async () => [], addRecent: async (x) => window.__calls.push(['recent', x]),
      onOpenFile: (cb) => { window.__openFile = cb; },
      onMenuCommand: (cb) => { window.__menu = cb; },
      close: () => {}, showInFolder: () => {}, openExternal: () => {}, toggleDevTools: () => {}
    };
  });

  await p.goto('file:///sandbox/workspace/md-studio-electron/renderer/index.html', { waitUntil:'load' });
  await sleep(4500);

  console.log('Desktop 初始化:', await p.evaluate(() => ({
    desktop: typeof window.Desktop,
    hasApp: typeof window.App,
    menuBound: typeof window.__menu === 'function',
    openBound: typeof window.__openFile === 'function',
    title: window.__title
  })));

  // 菜单：打开文件
  await p.evaluate(() => window.__menu('open'));
  await sleep(900);
  console.log('菜单-打开文件:', await p.evaluate(() => ({
    editorHead: EditorAdapter.value.split('\n')[0],
    file: document.getElementById('statFile').textContent,
    math: document.querySelectorAll('#preview .math-inline > svg').length,
    title: window.__title, dirty: window.__dirty
  })));

  // 菜单：打开文件夹
  await p.evaluate(() => window.__menu('open-folder'));
  await sleep(1600);
  console.log('菜单-打开文件夹:', await p.evaluate(() => ({
    rows: [...document.querySelectorAll('#fileTree .tree-row')].map(x => x.dataset.path),
    file: document.getElementById('statFile').textContent
  })));

  // 点树里的第二个文件
  await p.evaluate(() => { [...document.querySelectorAll('#fileTree .tree-row')].forEach(r => { if (r.dataset.path === 'sub/b.md') r.click(); }); });
  await sleep(900);
  console.log('点树文件:', await p.evaluate(() => ({
    head: EditorAdapter.value.split('\n')[0],
    calls: window.__calls.filter(c => c[0] === 'read').map(c => c[1])
  })));

  // 编辑 → 脏 → Ctrl+S 写盘
  await p.evaluate(() => { EditorAdapter.view.dispatch({ changes: { from: 0, insert: '改一下\n' } }); });
  await sleep(700);
  const beforeSave = await p.evaluate(() => ({ dirty: window.__dirty, title: window.__title }));
  await p.evaluate(() => window.__menu('save'));
  await sleep(700);
  console.log('编辑后保存:', JSON.stringify(beforeSave), '→', JSON.stringify(await p.evaluate(() => ({
    dirty: window.__dirty,
    writes: window.__calls.filter(c => c[0] === 'write')
  }))));

  // 双击打开（文件关联）
  await p.evaluate(() => window.__openFile('D:\\other\\x.md'));
  await sleep(800);
  console.log('双击打开:', await p.evaluate(() => ({
    head: EditorAdapter.value.split('\n')[0],
    file: document.getElementById('statFile').textContent
  })));

  // 菜单：视图切换 / 主题 / 侧栏
  await p.evaluate(() => { window.__menu('view', 'read'); });
  await sleep(400);
  const view = await p.evaluate(() => getComputedStyle(document.querySelector('.editor-pane')).display);
  await p.evaluate(() => { window.__menu('view', 'split'); window.__menu('toggle-sidebar'); });
  await sleep(500);
  console.log('视图/侧栏:', JSON.stringify({ readMode: view, sidebarCollapsed: await p.evaluate(() => document.getElementById('sidebar').classList.contains('collapsed')) }));

  // 导出 HTML（走 saveAsDialog）
  await p.evaluate(() => window.__menu('export-html'));
  await sleep(1500);
  console.log('导出 HTML:', await p.evaluate(() => window.__calls.filter(c => c[0] === 'saveAs').map(c => c[1])));

  await p.screenshot({ path: '/sandbox/workspace/md-studio-electron/tools/shot-native.png' });
  console.log('ERRORS:', errs.length ? errs.slice(0,6).join('\n') : 'none');
  await b.close();
})();
