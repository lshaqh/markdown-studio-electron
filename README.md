# Markdown Studio（Electron 桌面版）

离线 Markdown 编辑器 / 阅读器，Windows 桌面应用。支持公式、代码高亮、mermaid 图表、多主题、**一键导出微信公众号 HTML**，并且可以把 `.md` 设为默认打开程序。

> 与 Web 单文件版功能一致，另加：原生文件读写、文件夹树、系统菜单、双击打开、最近文件、未保存提醒。

---

## 一、构建（在 Windows 上）

需要 **Node.js 18+**（[nodejs.org](https://nodejs.org) 下 LTS 版即可），不需要 Rust / Visual Studio。

```bash
# 1. 安装依赖（约 2-3 分钟，会下载 Electron）
npm install

# 2. 试跑
npm start

# 3. 打包成安装包 + 免安装版
npm run dist
```

产物在 `release/`：

| 文件 | 说明 |
|---|---|
| `MarkdownStudio-1.0.0-x64.exe` | NSIS 安装包，**安装时自动注册 .md 文件关联** |
| `MarkdownStudio-1.0.0-portable.exe` | 免安装单文件，双击即用（不写注册表，不抢关联） |

> 首次 `npm install` 会从 GitHub 下载 Electron 二进制（约 100MB）。国内网络慢的话先设镜像：
> ```bash
> set ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/
> npm install
> ```

## 二、文件关联

安装包（NSIS）会自动把 `.md` / `.markdown` / `.mdown` 注册到本应用，并在资源管理器右键菜单里出现「打开方式」。验证：

1. 装完后双击任意 `.md` → 直接打开并载入内容
2. 若之前关联给了别的编辑器：右键 md → 打开方式 → 选择其他应用 → 勾选「始终使用此应用」

免安装版不写注册表，需要关联时手动选一次。

想彻底取消：设置 → 应用 → 默认应用 → 按文件类型指定 → `.md` 改回其他程序。

## 三、桌面版特有的功能

| 功能 | 说明 |
|---|---|
| **双击 / 命令行打开** | `MarkdownStudio.exe D:\docs\a.md` 也能打开；已开窗口时是「第二实例转发」，不会开两个窗口 |
| **原生文件夹树** | Ctrl+Shift+O 或顶栏「文件夹」，递归读任意目录（跳过 `.` 开头、`node_modules`、`dist`） |
| **直接保存** | Ctrl+S 写回原文件，不再弹下载框；未命名文档才弹「另存为」 |
| **未保存提醒** | 关窗口或退出时若有改动，弹「保存 / 不保存 / 取消」 |
| **关闭后后台驻留** | 点 × 只隐藏窗口、进程与渲染状态全部保留；点托盘图标、再次双击图标或打开 `.md` 文件都直接恢复，无需重新加载 |
| **托盘菜单** | 右键托盘图标：显示主界面、关闭时最小化到托盘（开关）、开机自动启动（开关）、退出 |
| **最近文件** | 文件 → 最近打开（存在 `%APPDATA%\markdown-studio\recent.json`） |
| **窗口状态记忆** | 隐藏 / 关闭时的位置、大小、是否最大化会记住 |
| **系统菜单 + 快捷键** | 见下表，全部走原生菜单，可在菜单里看到对应快捷键 |
| **导出 HTML** | 文件 → 导出公众号 HTML，直接存成 `.html` 文件 |

### 快捷键

| 键 | 动作 |
|---|---|
| `Ctrl+N` / `Ctrl+O` / `Ctrl+Shift+O` | 新建 / 打开文件 / 打开文件夹 |
| `Ctrl+S` / `Ctrl+Shift+S` | 保存 / 另存为 |
| `Ctrl+B` `Ctrl+I` `Ctrl+K` | 加粗 / 斜体 / 链接 |
| `Ctrl+F` | 编辑器内查找替换 |
| `Ctrl+1` `Ctrl+2` `Ctrl+3` | 分栏 / 仅编辑 / 仅阅读 |
| `Ctrl+Shift+E` | 收起或展开文件栏 |
| `Ctrl+Q` | 真正退出（结束后台驻留） |
| `Ctrl+滚轮` | 缩放界面 |

### 后台驻留与秒开

点窗口右上角 × 时，默认不结束进程，只把窗口隐藏到系统托盘：CodeMirror 编辑器状态、预览 DOM、已加载的公式与图表引擎都留在内存里。之后从托盘图标、桌面快捷方式、开始菜单或 `.md` 文件关联唤起，都是直接 `show()` 现有窗口，不再走建窗 / 解析脚本 / 渲染文档这一整套冷启动流程。

首次隐藏会弹一次气泡提示。要完全退出，用托盘右键菜单的「退出 Markdown Studio」、菜单「文件 → 退出」或 `Ctrl+Q`。若文档有未保存改动，无论隐藏还是退出都会先询问保存。

「设置」面板和托盘右键菜单里都能切换：

- **关闭时最小化到托盘**（默认开）：关掉后点 × 就是正常退出。
- **开机自动启动（后台）**（默认关）：登录时以 `--background` 启动，只驻留托盘不弹窗口。注意便携版移动过位置后需要重新开关一次，让系统记录到新路径。

偏好存在 `%APPDATA%\markdown-studio\prefs.json`，与窗口状态、最近文件分开。托盘图标取自 `build/tray.png`（16×16，由 `build/icon.ico` 生成）。

## 四、编辑器（CodeMirror 6）

源码区换成了 CodeMirror 6，相比 Web 版的 textarea：

- Markdown 语法着色（标题、粗体、链接、行内代码、列表符号分色）
- 行号、当前行高亮、括号匹配、代码折叠
- `Ctrl+F` 搜索替换、多光标（`Alt+点击`）、矩形选择
- 列表自动续写：回车自动补 `- ` / `1. `，空项回车退出列表
- 大文档虚拟化渲染，10 万字也不卡

着色走 CSS 变量（`--cm-h1` 等），深色界面自动换配色。

## 五、目录结构

```
md-studio-electron/
├─ electron/
│  ├─ main.js        主进程：窗口、菜单、IPC、文件关联、最近文件、单实例
│  └─ preload.js     contextBridge 白名单 API（渲染端拿不到 Node）
├─ renderer/         渲染端（与 Web 版同一套代码）
│  ├─ index.html
│  ├─ css/app.css
│  ├─ js/
│  │  ├─ editor.js   CodeMirror 6 适配层（暴露 textarea 兼容 API）
│  │  ├─ app.js      应用主逻辑
│  │  ├─ vault.js    文件夹树（handle / files / native 三种后端）
│  │  ├─ native.js   Electron 增强层（菜单命令、原生对话框）
│  │  ├─ render.js   渲染管线
│  │  ├─ inline.js   CSS 内联引擎（公众号导出）
│  │  └─ themes.js   26 套主题（浅色 / 纸质·衬线 / 深色分组）
│  └─ lib/           marked / highlight.js / MathJax / mermaid / cm6
├─ build/            图标（icon.ico / icon.png）
├─ tools/            CM6 打包工程（esbuild）
└─ package.json      含 electron-builder 配置（fileAssociations 就在这里）
```

## 六、常见问题

**Q：安全吗？会不会有网络请求？**
A：完全离线。主进程没有引入任何网络模块；渲染端 `contextIsolation: true` + `nodeIntegration: false`，只能访问 preload 白名单里的文件读写和对话框。点击正文里的外链会用系统浏览器打开。

**Q：能装到没有管理员权限的电脑吗？**
A：可以。NSIS 包默认「仅为当前用户安装」（`perMachine: false`），装到 `%LOCALAPPDATA%`，不需要 UAC 提权。也可以直接用 portable 版。

**Q：改代码后怎么重新打 CM6 包？**
A：`npm run build:cm6`（需要先在 `tools/` 下 `npm install`）。

**Q：文件关联失效了？**
A：Windows 有时会被其他编辑器抢回关联。重新运行安装包选「修复」，或右键 md → 打开方式 → 始终使用。

## 七、交互修复与性能优化

- **侧栏「选择文件夹」**：📁 按钮已接入原生目录对话框，与顶栏「文件夹」、菜单「文件 → 打开文件夹」统一走同一条路径；同时去掉顶栏按钮被重复绑定造成的双弹窗。
- **编辑栏长行自动折行**：CodeMirror 6 开启 `lineWrapping`，内容随窗口宽度自适应，不必再拉宽分栏。
- **主题扩充到 26 套**：借鉴 doocs/md、Typora、GitHub、掘金、Solarized、Nord、Dracula 等开源项目的配色，按「浅色 / 纸质·衬线 / 深色」分组筛选；代码高亮配色同步增加到 7 套。
- **精准滚动同步**：渲染时给每个顶层块标注源码行号（`data-md-line`），按相邻锚点局部插值换算两侧位置，公式、图片、代码块造成的高度差不再累积成整页偏移。
- **滚动同步二次加固**（针对长文档偶发「左右相差一屏」）：
  - 行号统计修正：marked 的 `space` token 已包含段末换行，旧逻辑又给段末 `+1`，每遇普通段落就多算一行，到 170 行附近累计漂出约 35 行。现改为严格按 `token.raw` 累计换行，所有标题标注误差为 0。
  - 预览顶部留白改为在开头一小段内容里线性淡出，正文中后段使用纯内容坐标，同一块在左右两栏处于同一高度（实测标题偏差 0–2px）。
  - 主控权改为**事件驱动**：只由 `wheel / touch / pointerdown / keydown` 切换，不再用 220ms 时间窗。公式或图表渲染把 scroll 事件延迟数秒时，程序化设置的回声不会伪装成用户滚动抢走主控、把编辑器拽回旧行。
  - 预览滚动容器关闭浏览器滚动锚定（`overflow-anchor: none`），重渲染时不再被浏览器自作主张补偿 scrollTop；回声同时用「值匹配 + 短时抑制」双重判定。
  - 异步高度变化（公式 / mermaid / 图片 / 字体 / 换主题 / 改宽度 / 拖分栏 / 窗口缩放）由 `ResizeObserver` 触发重建锚点并重新对齐；驱动编辑器改用闭环迭代，修正 CodeMirror 对视口外折行行高的估算误差。
- **冷启动优化**：MathJax（约 2 MB）与 mermaid（约 2.5 MB）改为按需加载，只有文档含公式 / 图表时才在界面空闲后载入；窗口创建后立即显示背景色，不再等整页脚本执行完；桌面桥接层提前到 DOMContentLoaded 注册，双击 `.md` 打开更可靠。
- **后台驻留 / 再次打开秒开**：`close` 事件改为 `preventDefault() + hide()`，保留渲染进程与编辑器状态；系统托盘提供显示、开关、退出，单实例转发改为唤起现有窗口；`backgroundThrottling: false` 避免后台被限流。退出路径与未保存确认分开处理，取消退出不会误把窗口隐藏。

> 导出前会自动等待公式与图表引擎就绪，导出内容不受懒加载影响。

## 八、协议

MIT。依赖：CodeMirror 6（MIT）、marked（MIT）、highlight.js（BSD）、MathJax（Apache-2.0）、mermaid（MIT）。
