/* ===========================================================
 *  Markdown Studio · 文件夹侧栏（批量管理本地 md）
 *  浏览器不能直接扫描磁盘目录，所以走两条路：
 *   1) File System Access API（Chrome/Edge）：可读可写，Ctrl+S 直接存回原文件
 *   2) <input webkitdirectory> / 拖入文件夹：只读，保存需另存
 * =========================================================== */

const Vault = (() => {
  const MD_EXT = /\.(md|markdown|mdown|mkd|mdx|txt)$/i;
  const MAX_FILES = 4000;

  const state = {
    name: '',
    mode: null,          // 'handle' | 'files'
    rootHandle: null,
    entries: [],         // [{ path, file?, handle? }]
    expanded: new Set(),
    current: null,
    filter: ''
  };

  const cache = new Map();   // path -> 未保存的编辑内容
  let ui = {};
  let hooks = {};

  /* ---------------- 工具 ---------------- */
  const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  function sortEntries(a, b) {
    return a.localeCompare(b, 'zh-Hans-CN', { numeric: true, sensitivity: 'base' });
  }

  /* ---------------- 目录读取 ---------------- */
  async function walkDirectoryHandle(dir, prefix, out) {
    for await (const [name, handle] of dir.entries()) {
      if (out.length > MAX_FILES) return;
      if (name.startsWith('.')) continue;
      if (handle.kind === 'file') {
        if (MD_EXT.test(name)) out.push({ path: prefix + name, handle });
      } else {
        await walkDirectoryHandle(handle, prefix + name + '/', out);
      }
    }
  }

  function readAllEntries(dirEntry) {
    return new Promise((resolve, reject) => {
      const reader = dirEntry.createReader();
      const all = [];
      const next = () => reader.readEntries((batch) => {
        if (!batch.length) return resolve(all);
        all.push(...batch);
        next();
      }, reject);
      next();
    });
  }

  async function walkEntry(entry, prefix, out) {
    if (out.length > MAX_FILES) return;
    if (entry.name.startsWith('.')) return;
    if (entry.isFile) {
      if (!MD_EXT.test(entry.name)) return;
      const file = await new Promise((res, rej) => entry.file(res, rej));
      out.push({ path: prefix + entry.name, file });
    } else if (entry.isDirectory) {
      const children = await readAllEntries(entry);
      for (const c of children) await walkEntry(c, prefix + entry.name + '/', out);
    }
  }

  /* ---------------- 载入 ---------------- */
  async function loadFromHandle(dirHandle) {
    const out = [];
    await walkDirectoryHandle(dirHandle, '', out);
    state.mode = 'handle';
    state.rootHandle = dirHandle;
    state.name = dirHandle.name;
    state.entries = out;
    state.expanded = new Set();
    state.current = null;
    cache.clear();
    afterLoad();
    return out.length;
  }

  /** Electron：由主进程递归读好的目录树（entries: [{path, abs}]） */
  function loadFromNative(dir, name, entries) {
    state.mode = 'native';
    state.rootDir = dir;
    state.rootHandle = null;
    state.name = name || '文件夹';
    state.entries = (entries || []).filter(e => MD_EXT.test(e.path)).slice(0, MAX_FILES);
    state.expanded = new Set();
    state.current = null;
    cache.clear();
    afterLoad();
    return state.entries.length;
  }

  function loadFromList(list, name) {
    state.mode = 'files';
    state.rootHandle = null;
    state.name = name || '已选文件夹';
    state.entries = list.filter(e => MD_EXT.test(e.path)).slice(0, MAX_FILES);
    state.expanded = new Set();
    state.current = null;
    cache.clear();
    afterLoad();
    return state.entries.length;
  }

  function afterLoad() {
    // 默认展开所有一级目录
    state.entries.forEach(e => {
      const parts = e.path.split('/');
      if (parts.length > 1) state.expanded.add(parts[0]);
    });
    render();
    if (hooks.onVaultChange) hooks.onVaultChange(stats());
  }

  function stats() {
    return {
      name: state.name,
      count: state.entries.length,
      mode: state.mode,
      canWrite: state.mode === 'handle' || state.mode === 'native'
    };
  }

  /* ---------------- 选择 ---------------- */
  async function pickFolder() {
    // Electron：走主进程的原生目录对话框，递归扫描后可直接写回磁盘。
    // 这条分支是所有入口（顶栏「文件夹」、侧栏 📁、系统菜单）的统一实现。
    if (window.native && typeof window.native.openFolderDialog === 'function') {
      try {
        const r = await window.native.openFolderDialog();
        if (!r) return;   // 用户取消
        const n = loadFromNative(r.dir, r.name, r.entries);
        if (hooks.toast) hooks.toast(n ? `已载入 ${n} 个文档` : '这个文件夹里没有 md 文件');
        return;
      } catch (err) {
        if (hooks.toast) hooks.toast('打开文件夹失败：' + (err.message || err), true);
        return;
      }
    }
    if (typeof window.showDirectoryPicker === 'function') {
      try {
        const handle = await window.showDirectoryPicker({ id: 'md-studio', mode: 'readwrite' });
        const n = await loadFromHandle(handle);
        if (hooks.toast) hooks.toast(n ? `已载入 ${n} 个文档` : '这个文件夹里没有 md 文件');
        return;
      } catch (err) {
        if (err && err.name === 'AbortError') return;   // 用户取消
        // 环境不支持（file:// 或权限策略）→ 回退到 input
      }
    }
    // 回退：个别浏览器不支持 webkitdirectory，用多选文件
    const supportsDir = 'webkitdirectory' in document.createElement('input');
    if (supportsDir && ui.dirInput) ui.dirInput.click();
    else if (ui.filesInput) ui.filesInput.click();
    else if (ui.dirInput) ui.dirInput.click();
  }

  async function loadFromFileList(fileList) {
    const files = [...fileList];
    if (!files.length) return 0;
    const list = [];
    let root = '';
    files.forEach(f => {
      const rel = f.webkitRelativePath || f.name;
      if (!root && f.webkitRelativePath) root = rel.split('/')[0];
      if (!MD_EXT.test(f.name)) return;
      // 去掉最外层目录名，树从文件夹内部开始
      const path = f.webkitRelativePath ? rel.split('/').slice(1).join('/') || rel : rel;
      list.push({ path, file: f });
    });
    return loadFromList(list, root || '已选文件夹');
  }

  async function loadFromDroppedItems(items) {
    const out = [];
    let rootName = '已拖入文件夹';
    const entries = [];
    for (const item of items) {
      const entry = item.webkitGetAsEntry && item.webkitGetAsEntry();
      if (entry) entries.push(entry);
    }
    if (!entries.length) return false;
    for (const entry of entries) {
      if (entry.isDirectory) {
        rootName = entry.name;
        const children = await readAllEntries(entry);
        for (const c of children) await walkEntry(c, '', out);
      } else {
        await walkEntry(entry, '', out);
      }
    }
    if (!out.length) return false;
    loadFromList(out, rootName);
    return out.length;
  }

  /* ---------------- 打开 / 保存 ---------------- */
  async function openPath(path) {
    const entry = state.entries.find(e => e.path === path);
    if (!entry) return null;
    let text = cache.has(path) ? cache.get(path) : null;
    if (text == null) {
      try {
        if (entry.abs && window.native) {
          const r = await window.native.readFile(entry.abs);
          if (!r.ok) throw new Error(r.error);
          text = r.content;
        } else if (entry.handle) {
          text = await (await entry.handle.getFile()).text();
        } else {
          text = await entry.file.text();
        }
      } catch (err) {
        if (hooks.toast) hooks.toast('读取失败：' + (err.message || err), true);
        return null;
      }
    }
    state.current = path;
    render();
    return {
      path,
      abs: entry.abs || null,
      name: entry.path.split('/').pop(),
      text,
      writable: !!(entry.handle || (entry.abs && window.native))
    };
  }

  function stash(path, text) {
    if (path && text != null) cache.set(path, text);
  }

  function hasDirty(path) { return cache.has(path); }

  function clearDirty(path) {
    cache.delete(path);
    render();
  }

  async function savePath(path, text) {
    const entry = state.entries.find(e => e.path === path);
    if (!entry) return { ok: false, reason: 'not-found' };
    if (entry.abs && window.native) {
      const r = await window.native.writeFile(entry.abs, text);
      if (!r.ok) return { ok: false, reason: r.error };
      cache.delete(path);
      render();
      return { ok: true };
    }
    if (!entry.handle) return { ok: false, reason: 'readonly' };
    try {
      if (entry.handle.queryPermission) {
        const perm = await entry.handle.queryPermission({ mode: 'readwrite' });
        if (perm !== 'granted') {
          const req = await entry.handle.requestPermission({ mode: 'readwrite' });
          if (req !== 'granted') return { ok: false, reason: 'denied' };
        }
      }
      const writable = await entry.handle.createWritable();
      await writable.write(text);
      await writable.close();
      cache.delete(path);
      render();
      return { ok: true };
    } catch (err) {
      return { ok: false, reason: err.message || String(err) };
    }
  }

  /* ---------------- 树渲染 ---------------- */
  function buildTree() {
    const root = { children: new Map() };
    state.entries.forEach(e => {
      const parts = e.path.split('/');
      let node = root;
      parts.forEach((p, i) => {
        const leaf = i === parts.length - 1;
        if (!node.children.has(p)) {
          node.children.set(p, {
            name: p, dir: !leaf,
            path: parts.slice(0, i + 1).join('/'),
            children: new Map()
          });
        }
        node = node.children.get(p);
      });
    });
    return root;
  }

  function matchesFilter(path) {
    if (!state.filter) return true;
    return path.toLowerCase().includes(state.filter);
  }

  function renderRows(node, depth, out) {
    const kids = [...node.children.values()].sort((a, b) => {
      if (a.dir !== b.dir) return a.dir ? -1 : 1;
      return sortEntries(a.name, b.name);
    });
    kids.forEach(k => {
      if (k.dir) {
        const visible = state.entries.some(e => e.path.startsWith(k.path + '/') && matchesFilter(e.path));
        if (!visible) return;
        const isOpen = state.filter ? true : state.expanded.has(k.path);
        out.push(`<div class="tree-row ${isOpen ? 'open' : ''}" data-kind="dir" data-path="${esc(k.path)}" style="padding-left:${6 + depth * 12}px">
          <span class="caret">▶</span><span class="ico">📁</span><span class="nm">${esc(k.name)}</span>
        </div>`);
        if (isOpen) renderRows(k, depth + 1, out);
      } else {
        if (!matchesFilter(k.path)) return;
        const active = state.current === k.path ? ' active' : '';
        const dot = cache.has(k.path) ? '<span class="dirty-dot" title="有未保存修改"></span>' : '';
        out.push(`<div class="tree-row${active}" data-kind="file" data-path="${esc(k.path)}" style="padding-left:${6 + depth * 12}px">
          <span class="caret"></span><span class="ico">📄</span><span class="nm">${esc(k.name)}</span>${dot}
        </div>`);
      }
    });
  }

  function render() {
    if (!ui.tree) return;
    if (!state.entries.length) {
      ui.tree.innerHTML = `<div class="sidebar-empty">还没有选择文件夹<br><br>
        点右上角 📁 选择一本文件夹，<br>里面的 md 会全部列在这里</div>`;
      if (ui.foot) ui.foot.textContent = '还没有选择文件夹';
      if (ui.title) ui.title.textContent = '文件夹';
      return;
    }
    const out = [];
    renderRows(buildTree(), 0, out);
    ui.tree.innerHTML = out.join('') || `<div class="sidebar-empty">没有匹配的文档</div>`;
    if (ui.title) ui.title.textContent = state.name;
    if (ui.foot) {
      const total = state.entries.length;
      const shown = state.filter ? state.entries.filter(e => matchesFilter(e.path)).length : total;
      ui.foot.textContent = state.filter ? `${shown} / ${total} 个文档` : `${total} 个文档${state.mode === 'handle' ? ' · 可直接保存' : ''}`;
    }
  }

  /* ---------------- 交互 ---------------- */
  function bind() {
    // 侧栏标题栏的 📁 按钮（原来完全没有绑定事件，点击无反应）
    if (ui.btnPickFolder) {
      ui.btnPickFolder.addEventListener('click', (e) => {
        e.stopPropagation();
        pickFolder();
      });
    }

    ui.tree.addEventListener('click', async (e) => {
      const row = e.target.closest('.tree-row');
      if (!row) return;
      const path = row.dataset.path;
      if (row.dataset.kind === 'dir') {
        if (state.expanded.has(path)) state.expanded.delete(path);
        else state.expanded.add(path);
        render();
        return;
      }
      if (path === state.current) return;
      const doc = await openPath(path);
      if (doc && hooks.onOpenDoc) hooks.onOpenDoc(doc);
    });

    if (ui.search) {
      ui.search.addEventListener('input', () => {
        state.filter = ui.search.value.trim().toLowerCase();
        render();
      });
    }

    if (ui.filesInput) {
      ui.filesInput.addEventListener('change', async (e) => {
        const n = await loadFromFileList(e.target.files);
        e.target.value = '';
        if (hooks.toast) hooks.toast(n ? `已载入 ${n} 个文档` : '选中的文件里没有 md');
      });
    }

    if (ui.dirInput) {
      ui.dirInput.addEventListener('change', async (e) => {
        const n = await loadFromFileList(e.target.files);
        e.target.value = '';
        if (hooks.toast) hooks.toast(n ? `已载入 ${n} 个文档` : '这个文件夹里没有 md 文件');
      });
    }

    const toggle = () => {
      const sb = ui.sidebar;
      sb.classList.toggle('collapsed');
      if (ui.mask) ui.mask.classList.toggle('show', !sb.classList.contains('collapsed') && window.innerWidth <= 860);
      if (hooks.onToggle) hooks.onToggle(!sb.classList.contains('collapsed'));
    };
    if (ui.btnSidebar) ui.btnSidebar.addEventListener('click', toggle);
    if (ui.btnCollapse) ui.btnCollapse.addEventListener('click', toggle);
    if (ui.mask) ui.mask.addEventListener('click', () => {
      ui.sidebar.classList.add('collapsed');
      ui.mask.classList.remove('show');
    });
  }

  /* ---------------- 对外 ---------------- */
  return {
    init(opts) {
      hooks = opts.hooks || {};
      ui = opts.dom;
      bind();
      render();
    },
    pickFolder,
    loadFromHandle,
    loadFromNative,
    loadFromList,
    loadFromFileList,
    loadFromDroppedItems,
    openPath,
    stash,
    hasDirty,
    clearDirty,
    savePath,
    render,
    stats,
    getCurrent: () => state.current,
    getEntries: () => state.entries.slice(),
    toggleSidebar() {
      ui.sidebar.classList.toggle('collapsed');
      if (ui.mask) ui.mask.classList.toggle('show', !ui.sidebar.classList.contains('collapsed') && window.innerWidth <= 860);
    }
  };
})();
