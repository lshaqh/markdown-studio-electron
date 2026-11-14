/* ===========================================================
 *  Markdown Studio · Electron 桌面增强层
 *  只在 Electron 里生效；浏览器版本会直接跳过
 *  接：原生文件对话框、菜单命令、文件夹树、标题/脏标记、导出
 * =========================================================== */

const Desktop = (() => {
  const N = window.native;
  if (!N) return null;

  let ready = false;

  /* ---------------- 打开 ---------------- */
  async function openFileDialog() {
    const r = await N.openFileDialog();
    if (!r) return;
    window.App.loadDocument({ name: r.name, text: r.content, abs: r.path });
    window.App.toast('已打开 ' + r.name);
  }

  /** 统一交给 Vault：Electron 下走原生目录对话框，浏览器下走目录选择 API */
  async function openFolderDialog() {
    return Vault.pickFolder();
  }

  /** 双击 .md 打开（命令行参数 / 文件关联） */
  async function openPath(filePath) {
    const r = await N.readFile(filePath);
    if (!r.ok) { window.App.toast('打开失败：' + r.error, true); return; }
    const name = filePath.split(/[\\/]/).pop();
    window.App.loadDocument({ name, text: r.content, abs: filePath });
    N.addRecent(filePath);
  }

  /* ---------------- 保存 ---------------- */
  async function saveAs() {
    const d = window.App.getDoc();
    const r = await N.saveAsDialog(d.name || 'untitled.md', d.text);
    if (!r) return false;
    window.App.setAbs(r.path);
    window.App.setDirtyFlag(false);
    window.App.toast('已保存到 ' + r.name);
    return true;
  }

  /* ---------------- 导出 ---------------- */
  async function exportHTML() {
    const html = await window.App.buildExportHTML();
    const full = window.App.fullDocument(html);
    const base = (window.App.getDoc().name || 'article').replace(/\.md$/i, '');
    const r = await N.saveAsDialog(base + '-wechat.html', full);
    if (r) window.App.toast('已导出 ' + r.name);
  }

  /* ---------------- 菜单命令 ---------------- */
  function bindMenu() {
    N.onMenuCommand(async (cmd, payload) => {
      switch (cmd) {
        case 'new':
          document.getElementById('btnNewDoc')?.click();
          break;
        case 'open': openFileDialog(); break;
        case 'open-folder': openFolderDialog(); break;
        case 'save': window.App.saveDocument(); break;
        case 'save-as': saveAs(); break;
        case 'save-then-close':
          await window.App.saveDocument();
          window.App.setDirtyFlag(false);
          N.close();
          break;
        case 'export-html': exportHTML(); break;
        case 'find':
          window.App.toast('在编辑区按 Ctrl+F 打开搜索');
          EditorAdapter.openSearch && EditorAdapter.openSearch();
          break;
        case 'view': window.App.setView(payload); break;
        case 'theme':
          document.getElementById('themeMask').classList.add('show');
          break;
        case 'toggle-sidebar':
          Vault.toggleSidebar();
          break;
        case 'toggle-ui-dark': {
          const el = document.getElementById('btnUi');
          if (el) el.click();
          break;
        }
        case 'act': {
          const fn = window.App.actions && window.App.actions[payload];
          if (fn) fn();
          break;
        }
        case 'shortcuts':
          showShortcuts();
          break;
      }
    });

    N.onOpenFile((filePath) => openPath(filePath));
  }

  function showShortcuts() {
    window.App.toast('Ctrl+N 新建 · Ctrl+O 打开 · Ctrl+S 保存 · Ctrl+F 查找 · Ctrl+1/2/3 视图 · 点 × 最小化到托盘，Ctrl+Q 真正退出');
  }

  /* ---------------- 初始化 ---------------- */
  async function init() {
    if (ready) return;
    ready = true;
    bindMenu();

    // 顶栏「文件夹 / 打开」与侧栏 📁 全部由 app.js + Vault 统一绑定。
    // 这里不再用 onclick 覆盖，否则一次点击会同时触发浏览器目录选择和原生对话框。

    // 启动参数里带的文件（双击 .md）；IPC 偶尔晚于渲染端就绪，容错不影响菜单
    try {
      const info = await N.getInfo();
      document.documentElement.setAttribute('data-platform', info.platform);
    } catch (e) { /* 忽略 */ }

    // 让状态栏显示文件绝对路径的提示
    const statFile = document.getElementById('statFile');
    if (statFile) statFile.title = '双击 .md 文件可直接用本应用打开';
  }

  return { init, openFileDialog, openFolderDialog, openPath, saveAs, exportHTML };
})();

/* DOM 就绪即初始化：不等 window.load（大体积公式/图表引擎已改为按需加载）。
   双击 .md 打开时 IPC 消息来得很早，晚注册会丢消息。 */
if (window.native) {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => Desktop.init(), { once: true });
  } else {
    Desktop.init();
  }
}

/* 便于在开发者工具里调试 */
window.Desktop = Desktop;
