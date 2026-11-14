const { app, BrowserWindow, ipcMain, dialog, shell, Menu, nativeTheme, Tray, nativeImage } = require('electron');
const path = require('node:path');
const fs = require('node:fs/promises');
const fsSync = require('node:fs');

const isDev = !app.isPackaged;
const MD_EXT = /\.(md|markdown|mdown|mkd|mdx|txt)$/i;
const MAX_TREE_FILES = 5000;

let mainWindow = null;
let tray = null;
let forceQuit = false;            // 已走完退出流程，close 不再拦截
let quitRequested = false;        // 用户/系统请求真正退出（此时 × 不再隐藏）
let pendingCloseAction = 'tray'; // 保存完成后是隐藏还是退出
let closePromptOpen = false;
let pendingOpenPath = null;       // 启动参数里的文件，等窗口就绪后再发
let docDirty = false;

/* ---------------- 应用偏好（主进程持有，托盘菜单与设置面板共享） ---------------- */
const DEFAULT_PREFS = { closeToTray: true, autoLaunch: false, tipShown: false };
let prefs = { ...DEFAULT_PREFS };
const prefsFile = () => path.join(app.getPath('userData'), 'prefs.json');

function loadPrefs() {
  try {
    const p = JSON.parse(fsSync.readFileSync(prefsFile(), 'utf-8'));
    if (p && typeof p === 'object') prefs = { ...DEFAULT_PREFS, ...p };
  } catch { /* 首次运行用默认值 */ }
  applyLoginItem();
}

function publicPrefs() {
  return { closeToTray: !!prefs.closeToTray, autoLaunch: !!prefs.autoLaunch };
}

function savePrefs(patch) {
  prefs = { ...prefs, ...patch };
  try { fsSync.writeFileSync(prefsFile(), JSON.stringify(prefs, null, 2), 'utf-8'); } catch { /* ignore */ }
  applyLoginItem();
  updateTrayMenu();
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('prefs-changed', publicPrefs());
  }
  return publicPrefs();
}

function applyLoginItem() {
  // 开机自启只驻留托盘、不弹窗口（--background），首次手动打开即可秒开
  if (process.platform !== 'win32' && process.platform !== 'darwin') return;
  try {
    app.setLoginItemSettings({
      openAtLogin: !!prefs.autoLaunch,
      path: process.execPath,
      args: prefs.autoLaunch ? ['--background'] : []
    });
  } catch { /* 便携版路径变化等情况忽略 */ }
}

/* ---------------- 托盘与后台驻留 ---------------- */
function loadTrayIcon() {
  // 16×16 专用 PNG：asar 内的文件走 Electron 打了补丁的 fs，读取最可靠
  try {
    const png = path.join(__dirname, '..', 'build', 'tray.png');
    if (fsSync.existsSync(png)) {
      const img = nativeImage.createFromBuffer(fsSync.readFileSync(png));
      if (!img.isEmpty()) return img;
    }
  } catch { /* ignore */ }
  try {
    const ico = path.join(__dirname, '..', 'build', 'icon.ico');
    const img = nativeImage.createFromPath(ico);   // ICO 只能按路径解析
    if (!img.isEmpty()) return img.resize({ width: 16, height: 16 });
  } catch { /* ignore */ }
  return null;
}

function createTray() {
  const icon = loadTrayIcon();
  if (!icon) { tray = null; return; }   // 图标不可用时回退为「关闭即退出」
  try {
    tray = new Tray(icon);
    tray.setToolTip('Markdown Studio · 点击显示，右键更多');
    updateTrayMenu();
    tray.on('click', () => showMainWindow());
    tray.on('double-click', () => showMainWindow());
  } catch (e) {
    console.error('托盘创建失败：', e);
    tray = null;
  }
}

function updateTrayMenu() {
  if (!tray) return;
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: '显示主界面', click: () => showMainWindow() },
    { type: 'separator' },
    {
      label: '关闭时最小化到托盘', type: 'checkbox', checked: !!prefs.closeToTray,
      click: (item) => savePrefs({ closeToTray: item.checked })
    },
    {
      label: '开机自动启动（后台）', type: 'checkbox', checked: !!prefs.autoLaunch,
      click: (item) => savePrefs({ autoLaunch: item.checked })
    },
    { type: 'separator' },
    { label: '退出 Markdown Studio', click: () => quitApp() }
  ]));
}

function showMainWindow() {
  if (!mainWindow || mainWindow.isDestroyed()) { createWindow(null); return; }
  if (mainWindow.isMinimized()) mainWindow.restore();
  if (!mainWindow.isVisible()) mainWindow.show();
  mainWindow.focus();
}

function hideToTray() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  mainWindow.hide();
  saveWindowState();
  if (!prefs.tipShown) {
    savePrefs({ tipShown: true });
    try {
      tray && tray.displayBalloon({
        title: 'Markdown Studio 已在后台运行',
        content: '点 × 不会退出程序。点击托盘图标或再次打开即可立即恢复；右键托盘图标可完全退出。'
      });
    } catch { /* 部分系统不支持气泡提示 */ }
  }
}

/** 关闭动作的最终落点：隐藏到托盘，或真正结束进程 */
function finishClose(mode) {
  saveWindowState();
  if (mode === 'quit' || !tray) {
    forceQuit = true;
    if (mainWindow && !mainWindow.isDestroyed()) mainWindow.destroy();
    app.quit();
  } else {
    hideToTray();
  }
}

function quitApp() {
  quitRequested = true;
  app.quit();
}

/* ---------------- 最近文件 ---------------- */
const recentFile = () => path.join(app.getPath('userData'), 'recent.json');

async function readRecent() {
  try {
    const raw = await fs.readFile(recentFile(), 'utf-8');
    const list = JSON.parse(raw);
    return Array.isArray(list) ? list.filter(p => fsSync.existsSync(p)).slice(0, 12) : [];
  } catch { return []; }
}

async function addRecent(filePath) {
  try {
    const list = await readRecent();
    const next = [filePath, ...list.filter(p => p !== filePath)].slice(0, 12);
    await fs.writeFile(recentFile(), JSON.stringify(next, null, 2), 'utf-8');
    buildAppMenu();
    return next;
  } catch { return []; }
}

/* ---------------- 目录树 ---------------- */
async function listTree(rootDir) {
  const out = [];
  async function walk(dir, prefix) {
    let entries;
    try { entries = await fs.readdir(dir, { withFileTypes: true }); } catch { return; }
    for (const ent of entries) {
      if (out.length > MAX_TREE_FILES) return;
      if (ent.name.startsWith('.')) continue;
      const abs = path.join(dir, ent.name);
      if (ent.isDirectory()) {
        // 跳过 node_modules / .git 这类重目录
        if (['node_modules', 'dist', 'build'].includes(ent.name)) continue;
        await walk(abs, prefix + ent.name + '/');
      } else if (MD_EXT.test(ent.name)) {
        out.push({ path: prefix + ent.name, abs });
      }
    }
  }
  await walk(rootDir, '');
  out.sort((a, b) => a.path.localeCompare(b.path, 'zh-Hans-CN', { numeric: true }));
  return out;
}

/* ---------------- 窗口 ---------------- */
function createWindow(fileToOpen, startHidden = false) {
  const state = loadWindowState();

  mainWindow = new BrowserWindow({
    width: state.width, height: state.height,
    x: state.x, y: state.y,
    minWidth: 860, minHeight: 560,
    show: !startHidden,   // 正常启动先露背景色；开机自启只驻留托盘
    backgroundColor: state.dark ? '#14171a' : '#f4f5f7',
    title: 'Markdown Studio',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      spellcheck: false,
      backgroundThrottling: false   // 后台常驻时不被 Chromium 限流，恢复即满速
    }
  });

  if (state.maximized) mainWindow.maximize();
  mainWindow.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));

  // 双击 .md / 命令行打开的文件等 DOM 就绪后再发，
  // 否则渲染端的 IPC 监听还没注册，消息会丢。
  mainWindow.webContents.once('did-finish-load', () => {
    if (fileToOpen) mainWindow.webContents.send('open-file', fileToOpen);
  });

  // 点 × 默认只隐藏窗口：渲染进程、编辑器状态、预览 DOM 全部留在内存里，
  // 下次从托盘 / 快捷方式 / .md 文件关联唤起时无需重新初始化，直接秒开。
  mainWindow.on('close', async (e) => {
    if (forceQuit) { saveWindowState(); return; }
    const quitting = quitRequested || !prefs.closeToTray || !tray;
    pendingCloseAction = quitting ? 'quit' : 'tray';

    if (docDirty && !closePromptOpen) {
      e.preventDefault();
      closePromptOpen = true;
      let response = 2;
      try {
        ({ response } = await dialog.showMessageBox(mainWindow, {
          type: 'warning',
          buttons: ['保存', '不保存', '取消'],
          defaultId: 0,
          cancelId: 2,
          title: '还有未保存的修改',
          message: '当前文档有未保存的修改，要保存吗？',
          detail: quitting ? '' : '完成后窗口会最小化到托盘，程序继续在后台运行。'
        }));
      } finally { closePromptOpen = false; }
      if (response === 2) { quitRequested = false; return; }   // 取消，连退出一起取消
      if (response === 0) {
        mainWindow.webContents.send('menu-command', 'save-then-close');
        return;   // 渲染端保存完会调 app:close，由它决定隐藏还是退出
      }
      docDirty = false;
      finishClose(pendingCloseAction);
      return;
    }

    if (quitting) { saveWindowState(); return; }   // 真正退出：不拦截 close
    e.preventDefault();
    hideToTray();
  });

  mainWindow.on('closed', () => { mainWindow = null; });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/i.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });

  // 窗口大小记忆
  const saveStateDebounced = debounce(() => saveWindowState(), 600);
  mainWindow.on('resize', saveStateDebounced);
  mainWindow.on('move', saveStateDebounced);
  return mainWindow;
}

function loadWindowState() {
  try {
    const raw = fsSync.readFileSync(path.join(app.getPath('userData'), 'window.json'), 'utf-8');
    const s = JSON.parse(raw);
    return {
      width: s.width || 1440, height: s.height || 900,
      x: typeof s.x === 'number' ? s.x : undefined,
      y: typeof s.y === 'number' ? s.y : undefined,
      maximized: !!s.maximized,
      dark: !!s.dark
    };
  } catch {
    return { width: 1440, height: 900, dark: false };
  }
}

function saveWindowState() {
  if (!mainWindow) return;
  const b = mainWindow.getNormalBounds ? mainWindow.getNormalBounds() : mainWindow.getBounds();
  const data = { ...b, maximized: mainWindow.isMaximized(), dark: nativeTheme.shouldUseDarkColors };
  try {
    fsSync.writeFileSync(path.join(app.getPath('userData'), 'window.json'), JSON.stringify(data), 'utf-8');
  } catch { /* ignore */ }
}

function debounce(fn, ms) {
  let t;
  return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
}

/* ---------------- 菜单 ---------------- */
async function buildAppMenu() {
  const recent = await readRecent();
  const send = (cmd, payload) => mainWindow && mainWindow.webContents.send('menu-command', cmd, payload);

  const recentItems = recent.length
    ? recent.map(p => ({
        label: path.basename(p),
        toolTip: p,
        click: () => mainWindow && mainWindow.webContents.send('open-file', p)
      }))
    : [{ label: '（暂无）', enabled: false }];

  const template = [
    {
      label: '文件',
      submenu: [
        { label: '新建', accelerator: 'CmdOrCtrl+N', click: () => send('new') },
        { label: '打开文件…', accelerator: 'CmdOrCtrl+O', click: () => send('open') },
        { label: '打开文件夹…', accelerator: 'CmdOrCtrl+Shift+O', click: () => send('open-folder') },
        { type: 'separator' },
        { label: '最近打开', submenu: recentItems },
        { type: 'separator' },
        { label: '保存', accelerator: 'CmdOrCtrl+S', click: () => send('save') },
        { label: '另存为…', accelerator: 'CmdOrCtrl+Shift+S', click: () => send('save-as') },
        { label: '导出公众号 HTML…', click: () => send('export-html') },
        { type: 'separator' },
        { label: '隐藏到托盘', click: () => hideToTray() },
        { label: '退出（结束后台驻留）', accelerator: 'CmdOrCtrl+Q', click: () => quitApp() }
      ]
    },
    {
      label: '编辑',
      submenu: [
        { role: 'undo', label: '撤销' },
        { role: 'redo', label: '重做' },
        { type: 'separator' },
        { role: 'cut', label: '剪切' },
        { role: 'copy', label: '复制' },
        { role: 'paste', label: '粘贴' },
        { role: 'selectAll', label: '全选' },
        { type: 'separator' },
        { label: '查找替换', accelerator: 'CmdOrCtrl+F', click: () => send('find') }
      ]
    },
    {
      label: '插入',
      submenu: [
        { label: '加粗', accelerator: 'CmdOrCtrl+B', click: () => send('act', 'bold') },
        { label: '斜体', accelerator: 'CmdOrCtrl+I', click: () => send('act', 'italic') },
        { label: '链接', accelerator: 'CmdOrCtrl+K', click: () => send('act', 'link') },
        { type: 'separator' },
        { label: '行内代码', click: () => send('act', 'code') },
        { label: '代码块', click: () => send('act', 'codeblock') },
        { label: '块级公式', click: () => send('act', 'math') },
        { label: '表格', click: () => send('act', 'table') },
        { label: '流程图', click: () => send('act', 'diagram') },
        { label: '图片…', click: () => send('act', 'image') }
      ]
    },
    {
      label: '视图',
      submenu: [
        { label: '分栏', accelerator: 'CmdOrCtrl+1', click: () => send('view', 'split') },
        { label: '仅编辑', accelerator: 'CmdOrCtrl+2', click: () => send('view', 'write') },
        { label: '仅阅读', accelerator: 'CmdOrCtrl+3', click: () => send('view', 'read') },
        { type: 'separator' },
        { label: '主题面板…', click: () => send('theme') },
        { label: '文件栏', accelerator: 'CmdOrCtrl+Shift+E', click: () => send('toggle-sidebar') },
        { label: '深色界面', type: 'checkbox', checked: nativeTheme.shouldUseDarkColors, click: () => send('toggle-ui-dark') },
        { type: 'separator' },
        { role: 'resetZoom', label: '实际大小' },
        { role: 'zoomIn', label: '放大' },
        { role: 'zoomOut', label: '缩小' },
        { type: 'separator' },
        { role: 'togglefullscreen', label: '全屏' },
        { role: 'toggleDevTools', label: '开发者工具' }
      ]
    },
    {
      label: '帮助',
      submenu: [
        { label: '快捷键说明', click: () => send('shortcuts') },
        { label: '关于 Markdown Studio', click: () => {
          dialog.showMessageBox(mainWindow, {
            type: 'info',
            title: '关于',
            message: 'Markdown Studio ' + app.getVersion(),
            detail: '离线 Markdown 编辑器 / 阅读器\n公式（MathJax）、代码高亮、mermaid 图表、公众号一键导出\n\n基于 CodeMirror 6 + marked + MathJax + mermaid'
          });
        } }
      ]
    }
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

/* ---------------- IPC ---------------- */
function registerIPC() {
  ipcMain.handle('dialog:openFile', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
      properties: ['openFile'],
      filters: [{ name: 'Markdown', extensions: ['md', 'markdown', 'mdown', 'mkd', 'txt'] }, { name: '所有文件', extensions: ['*'] }]
    });
    if (canceled || !filePaths[0]) return null;
    const filePath = filePaths[0];
    const content = await fs.readFile(filePath, 'utf-8');
    await addRecent(filePath);
    return { path: filePath, name: path.basename(filePath), content };
  });

  ipcMain.handle('dialog:saveAs', async (_e, defaultName, content) => {
    const ext = String(defaultName || '').split('.').pop().toLowerCase();
    const filters = ext === 'html'
      ? [{ name: 'HTML 网页', extensions: ['html'] }, { name: '所有文件', extensions: ['*'] }]
      : ext === 'txt'
        ? [{ name: '纯文本', extensions: ['txt'] }, { name: '所有文件', extensions: ['*'] }]
        : [{ name: 'Markdown', extensions: ['md'] }, { name: '所有文件', extensions: ['*'] }];
    const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
      defaultPath: defaultName || 'untitled.md',
      filters
    });
    if (canceled || !filePath) return null;
    await fs.writeFile(filePath, content ?? '', 'utf-8');
    await addRecent(filePath);
    return { path: filePath, name: path.basename(filePath) };
  });

  ipcMain.handle('dialog:openFolder', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
      properties: ['openDirectory']
    });
    if (canceled || !filePaths[0]) return null;
    const dir = filePaths[0];
    const entries = await listTree(dir);
    return { dir, name: path.basename(dir), entries };
  });

  ipcMain.handle('fs:read', async (_e, filePath) => {
    try { return { ok: true, content: await fs.readFile(filePath, 'utf-8') }; }
    catch (err) { return { ok: false, error: String(err.message || err) }; }
  });

  ipcMain.handle('fs:write', async (_e, filePath, content) => {
    try { await fs.writeFile(filePath, content ?? '', 'utf-8'); return { ok: true }; }
    catch (err) { return { ok: false, error: String(err.message || err) }; }
  });

  ipcMain.handle('fs:listTree', async (_e, dir) => {
    try { return { ok: true, entries: await listTree(dir) }; }
    catch (err) { return { ok: false, error: String(err.message || err) }; }
  });

  ipcMain.handle('app:getInfo', () => ({
    version: app.getVersion(),
    platform: process.platform,
    home: app.getPath('home'),
    pictures: (() => { try { return app.getPath('pictures'); } catch { return ''; } })()
  }));

  ipcMain.handle('app:setTitle', (_e, title) => {
    if (mainWindow) mainWindow.setTitle(title || 'Markdown Studio');
  });

  ipcMain.handle('app:setDirty', (_e, dirty) => { docDirty = !!dirty; });

  ipcMain.handle('app:recent', async () => await readRecent());

  ipcMain.handle('app:addRecent', async (_e, p) => await addRecent(p));

  ipcMain.handle('app:showInFolder', (_e, p) => { if (p) shell.showItemInFolder(p); });

  ipcMain.handle('shell:openExternal', (_e, url) => {
    if (/^https?:/i.test(url)) shell.openExternal(url);
  });

  // 渲染端「保存并关闭」的收尾：根据这次关闭原本是隐藏还是退出来决定去向
  ipcMain.handle('app:close', () => {
    docDirty = false;
    finishClose(pendingCloseAction || 'tray');
  });

  ipcMain.handle('app:getPrefs', () => publicPrefs());
  ipcMain.handle('app:setPrefs', (_e, patch) => savePrefs(patch || {}));

  ipcMain.handle('app:toggleDevTools', () => {
    if (mainWindow) mainWindow.webContents.toggleDevTools();
  });
}

/* ---------------- 启动 ---------------- */
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('before-quit', () => { quitRequested = true; });

  // 已有实例在后台时，再次双击图标 / 打开 .md 都直接唤起现有窗口（不重建渲染进程）
  app.on('second-instance', async (_e, argv) => {
    if (!argv.includes('--background')) showMainWindow();
    const file = pickFileFromArgv(argv);
    if (file && mainWindow) mainWindow.webContents.send('open-file', file);
  });

  app.whenReady().then(async () => {
    loadPrefs();
    registerIPC();
    createTray();
    const startHidden = process.argv.includes('--background');
    const file = pickFileFromArgv(process.argv);
    createWindow(file && fsSync.existsSync(file) ? file : null, startHidden);
    await buildAppMenu();

    app.on('activate', () => showMainWindow());
  });

  app.on('window-all-closed', () => {
    // 隐藏到托盘时窗口仍在，不会走到这里；能走到说明是显式销毁/退出
    if (process.platform !== 'darwin' || quitRequested || !tray) app.quit();
  });
}

/** 从命令行参数里挑出要打开的文件（双击 .md 时 Windows 会把它作为 argv 传进来） */
function pickFileFromArgv(argv) {
  for (const a of argv.slice(1)) {
    if (a.startsWith('-') || a.includes('electron')) continue;
    if (MD_EXT.test(a) && fsSync.existsSync(a)) return path.resolve(a);
  }
  return null;
}

// 首次启动前若已有待打开文件
app.on('open-file', (event, filePath) => {
  event.preventDefault();
  pendingOpenPath = filePath;
  if (mainWindow) {
    showMainWindow();
    mainWindow.webContents.send('open-file', filePath);
  }
});
