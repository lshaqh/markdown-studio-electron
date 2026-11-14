/* ===========================================================
 *  Markdown Studio · 主题系统
 *  所有主题 CSS 均以 .md-body 为根作用域：
 *    - 预览时替换为 "#preview .md-body" 注入 <style>
 *    - 导出时由 CSS 内联器写入元素 style（微信只认 inline style）
 *  只使用微信兼容属性：不用 flex/grid/position/伪元素/CSS 变量输出
 * =========================================================== */

/* ---------- 基础排版（所有主题共享，微信安全值） ---------- */
const BASE_CSS = `
.md-body {
  font-size: 16px; line-height: 1.75; color: #333333; letter-spacing: .3px;
  font-family: -apple-system, BlinkMacSystemFont, "PingFang SC", "Helvetica Neue", "Microsoft YaHei", sans-serif;
  word-break: break-word; text-align: left;
}
.md-body p { margin: 0 0 1em; }
.md-body h1, .md-body h2, .md-body h3, .md-body h4, .md-body h5, .md-body h6 {
  font-weight: 700; margin: 1.6em 0 .7em; line-height: 1.4; word-break: break-word;
}
.md-body h1 { font-size: 1.5em; }
.md-body h2 { font-size: 1.28em; }
.md-body h3 { font-size: 1.12em; }
.md-body h4 { font-size: 1em; }
.md-body h5 { font-size: .95em; }
.md-body h6 { font-size: .9em; }
.md-body strong { font-weight: 700; }
.md-body em { font-style: italic; }
.md-body del { text-decoration: line-through; }
.md-body a { color: #576b95; text-decoration: none; word-break: break-all; }
.md-body ul, .md-body ol { margin: 0 0 1em; padding-left: 1.5em; }
.md-body li { margin: .35em 0; }
.md-body li > p { margin: 0; }
.md-body ul ul, .md-body ol ol, .md-body ul ol, .md-body ol ul { margin: .3em 0; }
.md-body blockquote { margin: 1.2em 0; padding: .7em 1em; border-left: 4px solid #dfe2e5; background: #f7f7f7; color: #666666; }
.md-body blockquote > p:last-child { margin-bottom: 0; }
.md-body blockquote > p { margin: 0 0 .5em; }
.md-body hr { border: 0; height: 1px; background: #e6e6e6; margin: 2em 0; }
.md-body img { max-width: 100%; height: auto; display: block; margin: 1.2em auto; border-radius: 4px; }
.md-body table { width: 100%; border-collapse: collapse; margin: 1.2em 0; font-size: .9em; }
.md-body th, .md-body td { border: 1px solid #e0e0e0; padding: .5em .7em; text-align: left; vertical-align: top; }
.md-body th { background: #f4f4f4; font-weight: 600; }
.md-body code {
  font-family: Consolas, Monaco, "Courier New", monospace; font-size: .88em;
  background: #f5f5f5; color: #c7254e; padding: 2px 5px; border-radius: 3px; word-break: break-all;
}
.md-body .code-block { margin: 1.3em 0; border-radius: 6px; overflow: hidden; background: #f6f8fa; border: 1px solid #e5e7eb; }
.md-body .code-head { padding: 7px 12px; font-size: 12px; color: #8a8f98; letter-spacing: .5px; background: #eef1f4; border-bottom: 1px solid #e5e7eb; font-family: Consolas, Monaco, monospace; }
.md-body .code-body { padding: 12px; }
.md-body .cl {
  display: block; white-space: pre-wrap; word-break: break-all; min-height: 1.6em;
  font-family: Consolas, Monaco, "Courier New", monospace; font-size: 13px; line-height: 1.65; color: #24292e;
}
.md-body .math-block { margin: 1.3em 0; text-align: center; overflow-x: auto; }
.md-body .math-inline { display: inline-block; }
.md-body .math-error { color: #d93025; background: #fdecea; padding: 2px 6px; border-radius: 3px; font-family: monospace; font-size: .85em; }
.md-body .math-pending { color: #576b95; background: #f2f4f8; padding: 2px 6px; border-radius: 3px; font-family: Consolas, Monaco, monospace; font-size: .85em; }
.md-body .task-item { list-style: none; margin-left: -1.1em; }
.md-body .task-box { color: #576b95; font-weight: 700; margin-right: 6px; }
.md-body .footnote-ref { font-size: .78em; vertical-align: super; color: #576b95; }
.md-body .table-wrap { margin: 1.2em 0; }
.md-body .mermaid-block { margin: 1.4em 0; text-align: center; }
.md-body .mermaid-block > svg { max-width: 100%; height: auto; display: inline-block; }
.md-body .mermaid-raw {
  text-align: left; font-family: Consolas, Monaco, monospace; font-size: 12.5px; line-height: 1.6;
  background: #f6f8fa; border: 1px solid #e5e7eb; border-radius: 6px; padding: 10px 12px;
  margin: 0; white-space: pre-wrap; color: #57606a;
}
.md-body .diagram-error {
  text-align: left; color: #b42318; background: #fdecea; border-radius: 6px;
  padding: 8px 12px; font-size: 13px; margin-bottom: 8px;
}
.md-body .math-inline svg { display: inline-block; }
.md-body .math-block svg { display: inline-block; max-width: 100%; }
`;

/* ---------- 代码高亮配色（highlight.js token） ---------- */
const CODE_THEMES = {
  'github-light': {
    name: 'GitHub 浅色',
    bg: '#f6f8fa', head: '#eef1f4', headColor: '#8a8f98', fg: '#24292e', border: '#e5e7eb',
    css: `
.md-body .code-block { background: #f6f8fa; border: 1px solid #e5e7eb; }
.md-body .code-head { background: #eef1f4; color: #8a8f98; border-bottom: 1px solid #e5e7eb; }
.md-body .cl { color: #24292e; }
.md-body .hljs-comment, .md-body .hljs-quote { color: #6a737d; font-style: italic; }
.md-body .hljs-keyword, .md-body .hljs-selector-tag, .md-body .hljs-literal, .md-body .hljs-type { color: #d73a49; }
.md-body .hljs-string, .md-body .hljs-doctag, .md-body .hljs-regexp, .md-body .hljs-addition { color: #032f62; }
.md-body .hljs-number, .md-body .hljs-symbol, .md-body .hljs-bullet, .md-body .hljs-variable, .md-body .hljs-template-variable { color: #005cc5; }
.md-body .hljs-title, .md-body .hljs-section, .md-body .hljs-name, .md-body .hljs-selector-id, .md-body .hljs-selector-class { color: #6f42c1; }
.md-body .hljs-attr, .md-body .hljs-attribute, .md-body .hljs-built_in, .md-body .hljs-class .hljs-title { color: #e36209; }
.md-body .hljs-meta, .md-body .hljs-meta-keyword { color: #005cc5; font-weight: 700; }
.md-body .hljs-deletion { color: #b31d28; background: #ffeef0; }
.md-body .hljs-emphasis { font-style: italic; }
.md-body .hljs-strong { font-weight: 700; }
`
  },
  'one-dark': {
    name: 'One Dark',
    bg: '#282c34', head: '#21252b', headColor: '#7f848e', fg: '#abb2bf', border: '#1c1f24',
    css: `
.md-body .code-block { background: #282c34; border: 1px solid #1c1f24; }
.md-body .code-head { background: #21252b; color: #7f848e; border-bottom: 1px solid #1c1f24; }
.md-body .code-body { background: #282c34; }
.md-body .cl { color: #abb2bf; }
.md-body .hljs-comment, .md-body .hljs-quote { color: #5c6370; font-style: italic; }
.md-body .hljs-keyword, .md-body .hljs-selector-tag, .md-body .hljs-literal, .md-body .hljs-type { color: #c678dd; }
.md-body .hljs-string, .md-body .hljs-regexp, .md-body .hljs-addition, .md-body .hljs-doctag { color: #98c379; }
.md-body .hljs-number, .md-body .hljs-symbol, .md-body .hljs-bullet, .md-body .hljs-variable, .md-body .hljs-template-variable { color: #d19a66; }
.md-body .hljs-title, .md-body .hljs-section, .md-body .hljs-name, .md-body .hljs-selector-id, .md-body .hljs-selector-class { color: #61afef; }
.md-body .hljs-attr, .md-body .hljs-attribute, .md-body .hljs-built_in { color: #e5c07b; }
.md-body .hljs-meta { color: #56b6c2; }
.md-body .hljs-deletion { color: #e06c75; }
.md-body .hljs-emphasis { font-style: italic; }
.md-body .hljs-strong { font-weight: 700; }
`
  },
  'monokai': {
    name: 'Monokai',
    bg: '#272822', head: '#1e1f1c', headColor: '#8f908a', fg: '#f8f8f2', border: '#1a1b18',
    css: `
.md-body .code-block { background: #272822; border: 1px solid #1a1b18; }
.md-body .code-head { background: #1e1f1c; color: #8f908a; border-bottom: 1px solid #1a1b18; }
.md-body .code-body { background: #272822; }
.md-body .cl { color: #f8f8f2; }
.md-body .hljs-comment, .md-body .hljs-quote { color: #75715e; font-style: italic; }
.md-body .hljs-keyword, .md-body .hljs-selector-tag, .md-body .hljs-literal, .md-body .hljs-type { color: #f92672; }
.md-body .hljs-string, .md-body .hljs-regexp, .md-body .hljs-addition, .md-body .hljs-doctag { color: #e6db74; }
.md-body .hljs-number, .md-body .hljs-symbol, .md-body .hljs-bullet, .md-body .hljs-variable, .md-body .hljs-template-variable { color: #ae81ff; }
.md-body .hljs-title, .md-body .hljs-section, .md-body .hljs-name, .md-body .hljs-selector-id, .md-body .hljs-selector-class { color: #a6e22e; }
.md-body .hljs-attr, .md-body .hljs-attribute, .md-body .hljs-built_in { color: #66d9ef; }
.md-body .hljs-meta { color: #f8f8f2; }
.md-body .hljs-deletion { color: #f92672; }
.md-body .hljs-emphasis { font-style: italic; }
.md-body .hljs-strong { font-weight: 700; }
`
  },
  /* 以下配色借鉴 highlight.js / GitHub / Solarized / Dracula / Nord 开源主题 */
  'github-dark': {
    name: 'GitHub Dark',
    bg: '#0d1117', head: '#161b22', headColor: '#8b949e', fg: '#c9d1d9', border: '#30363d',
    css: `
.md-body .code-block { background: #0d1117; border: 1px solid #30363d; }
.md-body .code-head { background: #161b22; color: #8b949e; border-bottom: 1px solid #30363d; }
.md-body .code-body { background: #0d1117; }
.md-body .cl { color: #c9d1d9; }
.md-body .hljs-comment, .md-body .hljs-quote { color: #8b949e; font-style: italic; }
.md-body .hljs-keyword, .md-body .hljs-selector-tag, .md-body .hljs-literal, .md-body .hljs-type { color: #ff7b72; }
.md-body .hljs-string, .md-body .hljs-regexp, .md-body .hljs-addition, .md-body .hljs-doctag { color: #a5d6ff; }
.md-body .hljs-number, .md-body .hljs-symbol, .md-body .hljs-bullet, .md-body .hljs-variable, .md-body .hljs-template-variable { color: #79c0ff; }
.md-body .hljs-title, .md-body .hljs-section, .md-body .hljs-name, .md-body .hljs-selector-id, .md-body .hljs-selector-class { color: #d2a8ff; }
.md-body .hljs-attr, .md-body .hljs-attribute, .md-body .hljs-built_in { color: #ffa657; }
.md-body .hljs-meta { color: #79c0ff; }
.md-body .hljs-deletion { color: #ffdcd7; background: #67060c; }
.md-body .hljs-emphasis { font-style: italic; }
.md-body .hljs-strong { font-weight: 700; }
`
  },
  'solarized-light': {
    name: 'Solarized Light',
    bg: '#fdf6e3', head: '#eee8d5', headColor: '#93a1a1', fg: '#657b83', border: '#e3d9bf',
    css: `
.md-body .code-block { background: #fdf6e3; border: 1px solid #e3d9bf; }
.md-body .code-head { background: #eee8d5; color: #93a1a1; border-bottom: 1px solid #e3d9bf; }
.md-body .code-body { background: #fdf6e3; }
.md-body .cl { color: #657b83; }
.md-body .hljs-comment, .md-body .hljs-quote { color: #93a1a1; font-style: italic; }
.md-body .hljs-keyword, .md-body .hljs-selector-tag, .md-body .hljs-literal, .md-body .hljs-type { color: #859900; }
.md-body .hljs-string, .md-body .hljs-regexp, .md-body .hljs-addition, .md-body .hljs-doctag { color: #2aa198; }
.md-body .hljs-number, .md-body .hljs-symbol, .md-body .hljs-bullet, .md-body .hljs-variable, .md-body .hljs-template-variable { color: #d33682; }
.md-body .hljs-title, .md-body .hljs-section, .md-body .hljs-name, .md-body .hljs-selector-id, .md-body .hljs-selector-class { color: #268bd2; }
.md-body .hljs-attr, .md-body .hljs-attribute, .md-body .hljs-built_in { color: #b58900; }
.md-body .hljs-meta { color: #6c71c4; }
.md-body .hljs-deletion { color: #dc322f; }
.md-body .hljs-emphasis { font-style: italic; }
.md-body .hljs-strong { font-weight: 700; }
`
  },
  dracula: {
    name: 'Dracula',
    bg: '#282a36', head: '#21222c', headColor: '#6272a4', fg: '#f8f8f2', border: '#191a21',
    css: `
.md-body .code-block { background: #282a36; border: 1px solid #191a21; }
.md-body .code-head { background: #21222c; color: #6272a4; border-bottom: 1px solid #191a21; }
.md-body .code-body { background: #282a36; }
.md-body .cl { color: #f8f8f2; }
.md-body .hljs-comment, .md-body .hljs-quote { color: #6272a4; font-style: italic; }
.md-body .hljs-keyword, .md-body .hljs-selector-tag, .md-body .hljs-literal, .md-body .hljs-type { color: #ff79c6; }
.md-body .hljs-string, .md-body .hljs-regexp, .md-body .hljs-addition, .md-body .hljs-doctag { color: #f1fa8c; }
.md-body .hljs-number, .md-body .hljs-symbol, .md-body .hljs-bullet, .md-body .hljs-variable, .md-body .hljs-template-variable { color: #bd93f9; }
.md-body .hljs-title, .md-body .hljs-section, .md-body .hljs-name, .md-body .hljs-selector-id, .md-body .hljs-selector-class { color: #50fa7b; }
.md-body .hljs-attr, .md-body .hljs-attribute, .md-body .hljs-built_in { color: #8be9fd; }
.md-body .hljs-meta { color: #ffb86c; }
.md-body .hljs-deletion { color: #ff5555; }
.md-body .hljs-emphasis { font-style: italic; }
.md-body .hljs-strong { font-weight: 700; }
`
  },
  nord: {
    name: 'Nord',
    bg: '#2e3440', head: '#3b4252', headColor: '#8f9bb3', fg: '#d8dee9', border: '#242933',
    css: `
.md-body .code-block { background: #2e3440; border: 1px solid #242933; }
.md-body .code-head { background: #3b4252; color: #8f9bb3; border-bottom: 1px solid #242933; }
.md-body .code-body { background: #2e3440; }
.md-body .cl { color: #d8dee9; }
.md-body .hljs-comment, .md-body .hljs-quote { color: #616e88; font-style: italic; }
.md-body .hljs-keyword, .md-body .hljs-selector-tag, .md-body .hljs-literal, .md-body .hljs-type { color: #81a1c1; }
.md-body .hljs-string, .md-body .hljs-regexp, .md-body .hljs-addition, .md-body .hljs-doctag { color: #a3be8c; }
.md-body .hljs-number, .md-body .hljs-symbol, .md-body .hljs-bullet, .md-body .hljs-variable, .md-body .hljs-template-variable { color: #b48ead; }
.md-body .hljs-title, .md-body .hljs-section, .md-body .hljs-name, .md-body .hljs-selector-id, .md-body .hljs-selector-class { color: #88c0d0; }
.md-body .hljs-attr, .md-body .hljs-attribute, .md-body .hljs-built_in { color: #d8dee9; }
.md-body .hljs-meta { color: #5e81ac; }
.md-body .hljs-deletion { color: #bf616a; }
.md-body .hljs-emphasis { font-style: italic; }
.md-body .hljs-strong { font-weight: 700; }
`
  }
};

/* ---------- 主题定义 ---------- */
const THEMES = [
  {
    id: 'classic', name: '微信经典', desc: '清爽绿，最安全', swatch: ['#07c160', '#ffffff', '#333333'], code: 'github-light',
    css: `
.md-body { color: #3f3f3f; }
.md-body h1 { font-size: 1.5em; color: #1a1a1a; }
.md-body h2 { color: #07c160; padding-left: 10px; border-left: 4px solid #07c160; }
.md-body h3 { color: #1a1a1a; }
.md-body h4 { color: #1a1a1a; }
.md-body blockquote { border-left: 4px solid #07c160; background: #f2fbf5; color: #5c6b60; }
.md-body a { color: #07c160; }
.md-body strong { color: #1a1a1a; }
.md-body code { background: #f2f7f4; color: #07734b; }
.md-body th { background: #f2fbf5; }
.md-body hr { background: #e2f0e7; }
`
  },
  {
    id: 'minimal', name: '极简黑白', desc: '黑白灰，克制', swatch: ['#111111', '#ffffff', '#666666'], code: 'github-light',
    css: `
.md-body { color: #2b2b2b; font-size: 16px; }
.md-body h1 { font-size: 1.45em; color: #111111; letter-spacing: -.3px; }
.md-body h2 { color: #111111; padding-bottom: 6px; border-bottom: 1px solid #111111; }
.md-body h3 { color: #111111; padding-left: 8px; border-left: 3px solid #111111; }
.md-body blockquote { border-left: 2px solid #111111; background: transparent; color: #555555; padding-left: 14px; }
.md-body a { color: #111111; border-bottom: 1px solid #c9c9c9; }
.md-body code { background: #f2f2f2; color: #111111; border: 1px solid #e8e8e8; }
.md-body th { background: #f5f5f5; }
.md-body hr { background: #dcdcdc; }
.md-body .code-block { border: 1px solid #e5e7eb; }
`
  },
  {
    id: 'orange', name: '橙心', desc: '暖橙，活泼', swatch: ['#ff7a45', '#fff7f3', '#3f3f3f'], code: 'github-light',
    css: `
.md-body { color: #3f3f3f; }
.md-body h1 { color: #ff7a45; text-align: center; }
.md-body h2 { color: #ff7a45; padding-bottom: 8px; border-bottom: 2px solid #ffe1d6; }
.md-body h3 { color: #e8590c; }
.md-body h4 { color: #e8590c; }
.md-body blockquote { border-left: 4px solid #ff7a45; background: #fff7f3; color: #7a5b4d; border-radius: 0 6px 6px 0; }
.md-body a { color: #ff7a45; border-bottom: 1px solid #ffd8c9; }
.md-body strong { color: #e8590c; }
.md-body code { background: #fff1eb; color: #d9480f; }
.md-body th { background: #fff7f3; }
.md-body th, .md-body td { border-color: #ffe1d6; }
.md-body hr { background: #ffe1d6; }
`
  },
  {
    id: 'blue', name: '静谧蓝', desc: '蓝调，理性', swatch: ['#1e6fd9', '#eef4fd', '#333333'], code: 'github-light',
    css: `
.md-body { color: #37383a; }
.md-body h1 { color: #0f4c9c; text-align: center; border-bottom: 1px solid #dbe7f7; padding-bottom: 10px; }
.md-body h2 { color: #1e6fd9; background: #eef4fd; padding: 8px 12px; border-radius: 4px; border-left: 4px solid #1e6fd9; }
.md-body h3 { color: #1e6fd9; }
.md-body h4 { color: #0f4c9c; }
.md-body blockquote { border-left: 4px solid #1e6fd9; background: #eef4fd; color: #3d5a80; border-radius: 0 6px 6px 0; }
.md-body a { color: #1e6fd9; }
.md-body code { background: #eef4fd; color: #1a4f9c; }
.md-body th { background: #eef4fd; color: #0f4c9c; }
.md-body th, .md-body td { border-color: #d7e3f5; }
.md-body hr { background: #dbe7f7; }
`
  },
  {
    id: 'techcard', name: '科技卡片', desc: '深蓝卡片 + 深色代码', swatch: ['#16324f', '#2b7de9', '#f4f7fb'], code: 'one-dark',
    css: `
.md-body { color: #2f3b48; }
.md-body h1 { color: #16324f; background: #eaf1fb; text-align: center; padding: 14px 10px; border-radius: 8px; border-bottom: 3px solid #2b7de9; }
.md-body h2 { color: #ffffff; background: #16324f; padding: 7px 14px; border-radius: 6px; font-size: 1.16em; }
.md-body h3 { color: #16324f; padding-left: 10px; border-left: 4px solid #2b7de9; }
.md-body h4 { color: #2b7de9; }
.md-body blockquote { border: 1px solid #d7e4f5; border-left: 4px solid #2b7de9; background: #f4f8fe; color: #44576d; border-radius: 6px; padding: 12px 14px; }
.md-body a { color: #2b7de9; }
.md-body strong { color: #16324f; }
.md-body code { background: #eaf1fb; color: #1a5bb8; border: 1px solid #d7e4f5; }
.md-body th { background: #eaf1fb; color: #16324f; }
.md-body th, .md-body td { border: 1px solid #d7e4f5; }
.md-body hr { background: #d7e4f5; }
`
  },
  {
    id: 'sakura', name: '樱花', desc: '粉调，柔和圆角', swatch: ['#ff6b9d', '#fff0f5', '#4a3b41'], code: 'github-light',
    css: `
.md-body { color: #4a3b41; }
.md-body h1 { color: #ff6b9d; text-align: center; letter-spacing: 1px; }
.md-body h2 { color: #e0457b; text-align: center; }
.md-body h2 { border-bottom: 1px dashed #ffc2d6; padding-bottom: 8px; }
.md-body h3 { color: #e0457b; }
.md-body blockquote { border: 1px solid #ffd6e5; border-left: 4px solid #ff8fb3; background: #fff5f9; color: #7a5f68; border-radius: 8px; }
.md-body a { color: #e0457b; border-bottom: 1px dashed #ffb3cd; }
.md-body code { background: #fff0f5; color: #d6336c; }
.md-body th { background: #fff5f9; color: #e0457b; }
.md-body th, .md-body td { border-color: #ffd6e5; }
.md-body hr { background: #ffd6e5; }
.md-body img { border-radius: 10px; }
`
  },
  {
    id: 'forest', name: '森野', desc: '墨绿衬线，安静', swatch: ['#2f6b4f', '#f1f6f2', '#33403a'], code: 'github-light',
    css: `
.md-body { color: #33403a; font-family: Georgia, "Songti SC", "Noto Serif SC", serif; font-size: 16.5px; }
.md-body h1 { color: #2f6b4f; text-align: center; font-family: Georgia, "Songti SC", serif; }
.md-body h2 { color: #2f6b4f; border-bottom: 2px solid #d8e8dd; padding-bottom: 6px; }
.md-body h3 { color: #3d7a5c; }
.md-body blockquote { border-left: 4px solid #7fae91; background: #f1f6f2; color: #4a5d52; border-radius: 0 6px 6px 0; }
.md-body a { color: #2f6b4f; border-bottom: 1px solid #b9d7c4; }
.md-body code { background: #eef4ef; color: #2a6b4a; font-family: Consolas, Monaco, monospace; }
.md-body th { background: #f1f6f2; color: #2f6b4f; }
.md-body th, .md-body td { border-color: #d8e8dd; }
.md-body hr { background: #d8e8dd; }
`
  },
  {
    id: 'newspaper', name: '报纸', desc: '宋体分栏感，端庄', swatch: ['#8c1c13', '#fdfaf4', '#222222'], code: 'github-light',
    css: `
.md-body { color: #24211d; font-family: "Songti SC", "Noto Serif SC", Georgia, serif; font-size: 16.5px; line-height: 1.85; text-align: justify; }
.md-body p { text-indent: 0; }
.md-body h1 { font-size: 1.6em; text-align: center; color: #111111; border-top: 3px solid #8c1c13; border-bottom: 1px solid #d8d2c5; padding: 14px 0; letter-spacing: 1px; }
.md-body h2 { text-align: center; color: #8c1c13; border-bottom: 1px solid #d8d2c5; padding-bottom: 8px; }
.md-body h3 { color: #8c1c13; }
.md-body blockquote { border: 0; border-left: 3px solid #8c1c13; background: #f7f3ea; color: #5a544a; font-style: italic; }
.md-body a { color: #8c1c13; border-bottom: 1px solid #d9c7b8; }
.md-body code { background: #f2ede1; color: #8c1c13; }
.md-body th { background: #f7f3ea; color: #8c1c13; }
.md-body th, .md-body td { border: 1px solid #d8d2c5; }
.md-body hr { background: #d8d2c5; border-top: 3px double #d8d2c5; height: 3px; }
`
  },
  {
    id: 'warm', name: '暖纸', desc: '米黄纸感，护眼', swatch: ['#b8834a', '#fdf8f0', '#4a4038'], code: 'github-light',
    css: `
.md-body { color: #4a4038; background: #fdf8f0; padding: 18px; border-radius: 8px; }
.md-body h1 { color: #8a5a2b; text-align: center; }
.md-body h2 { color: #b8834a; border-bottom: 1px solid #e8d9c3; padding-bottom: 8px; }
.md-body h3 { color: #8a5a2b; }
.md-body blockquote { border-left: 4px solid #d9b382; background: #f7ecdb; color: #6b5a47; border-radius: 0 6px 6px 0; }
.md-body a { color: #a9702f; border-bottom: 1px solid #e0c9a8; }
.md-body code { background: #f7ecd9; color: #9a5a1f; border: 1px solid #eadfc9; }
.md-body th { background: #f7ecd9; color: #8a5a2b; }
.md-body th, .md-body td { border-color: #e8d9c3; }
.md-body hr { background: #e8d9c3; }
.md-body .code-block { background: #f7f4ee; border: 1px solid #e8d9c3; }
.md-body .code-head { background: #efe9dd; color: #a08a70; border-bottom: 1px solid #e8d9c3; }
`
  },
  {
    id: 'geek', name: '极客', desc: '等宽标题，终端感', swatch: ['#00b96b', '#0f1419', '#c9d1d9'], code: 'one-dark',
    css: `
.md-body { color: #24292f; }
.md-body h1 { font-family: Consolas, Monaco, "Courier New", monospace; color: #0f1419; border-left: 5px solid #00b96b; padding-left: 12px; }
.md-body h2 { font-family: Consolas, Monaco, monospace; color: #0f1419; background: #f0fdf6; padding: 6px 12px; border-left: 3px solid #00b96b; border-radius: 0 4px 4px 0; }
.md-body h3, .md-body h4 { font-family: Consolas, Monaco, monospace; color: #0b7a4b; }
.md-body blockquote { border-left: 3px solid #00b96b; background: #f5fbf7; color: #4a5a52; font-family: Consolas, Monaco, monospace; font-size: .92em; }
.md-body a { color: #0b7a4b; font-family: Consolas, Monaco, monospace; border-bottom: 1px dotted #00b96b; }
.md-body strong { color: #0f1419; background: #e6fbf0; padding: 0 3px; border-radius: 2px; }
.md-body code { background: #eef7f2; color: #0b7a4b; border: 1px solid #d3ecdf; }
.md-body th { background: #f0fdf6; color: #0b7a4b; font-family: Consolas, Monaco, monospace; }
.md-body th, .md-body td { border: 1px solid #d3ecdf; }
.md-body hr { background: #d3ecdf; }
`
  },
  {
    id: 'red', name: '中国红', desc: '庄重，红黑配色', swatch: ['#c62f2f', '#ffffff', '#2b2b2b'], code: 'github-light',
    css: `
.md-body { color: #2b2b2b; }
.md-body h1 { color: #c62f2f; text-align: center; letter-spacing: 2px; }
.md-body h2 { color: #c62f2f; border-bottom: 2px solid #f0d6d6; padding-bottom: 8px; }
.md-body h2 { background: none; }
.md-body h3 { color: #a82626; padding-left: 10px; border-left: 4px solid #c62f2f; }
.md-body h4 { color: #a82626; }
.md-body blockquote { border-left: 4px solid #c62f2f; background: #fdf3f3; color: #6b4a4a; }
.md-body a { color: #c62f2f; border-bottom: 1px solid #f0d6d6; }
.md-body strong { color: #c62f2f; }
.md-body code { background: #fdf3f3; color: #a82626; }
.md-body th { background: #fdf3f3; color: #a82626; }
.md-body th, .md-body td { border-color: #f0d6d6; }
.md-body hr { background: #f0d6d6; }
`
  },
  {
    id: 'night', name: '暗夜', desc: '深色阅读，夜间友好', swatch: ['#d4d4d4', '#1e1e1e', '#4ec9b0'], code: 'one-dark',
    css: `
.md-body { color: #d4d4d4; background: #1e1e1e; padding: 18px; border-radius: 8px; }
.md-body h1 { color: #ffffff; text-align: center; }
.md-body h2 { color: #4ec9b0; border-bottom: 1px solid #333333; padding-bottom: 8px; }
.md-body h3 { color: #4fc1ff; }
.md-body h4 { color: #dcdcaa; }
.md-body blockquote { border-left: 4px solid #4ec9b0; background: #252526; color: #a8a8a8; }
.md-body a { color: #4fc1ff; }
.md-body strong { color: #ffffff; }
.md-body code { background: #2d2d2d; color: #ce9178; border: 1px solid #3a3a3a; }
.md-body th { background: #2d2d30; color: #4ec9b0; }
.md-body th, .md-body td { border: 1px solid #3a3a3c; }
.md-body hr { background: #3a3a3c; }
.md-body .code-block { border: 1px solid #3a3a3c; }
`
  },

  /* ---------- 扩充主题：借鉴 doocs/md、Typora、GitHub、掘金、
     Solarized、Nord、Dracula 等开源项目的经典排版与配色 ---------- */
  {
    id: 'github', name: 'GitHub', desc: '开发者最熟悉的浅色', swatch: ['#0969da', '#f6f8fa', '#24292e'], code: 'github-light', tone: 'light',
    css: `
.md-body { color: #24292f; }
.md-body h1 { color: #1f2328; border-bottom: 1px solid #d0d7de; padding-bottom: 10px; }
.md-body h2 { color: #1f2328; border-bottom: 1px solid #d0d7de; padding-bottom: 8px; }
.md-body h3 { color: #1f2328; }
.md-body h4 { color: #1f2328; }
.md-body blockquote { border-left: 4px solid #d0d7de; background: #ffffff; color: #57606a; }
.md-body a { color: #0969da; }
.md-body strong { color: #1f2328; }
.md-body code { background: #f6f8fa; color: #cf222e; border: 1px solid #d0d7de; }
.md-body th { background: #f6f8fa; color: #1f2328; }
.md-body th, .md-body td { border: 1px solid #d0d7de; }
.md-body hr { background: #d0d7de; }
.md-body .code-block { border: 1px solid #d0d7de; }
`
  },
  {
    id: 'github-dark', name: 'GitHub 深色', desc: '暗底 + 亮蓝链接', swatch: ['#58a6ff', '#0d1117', '#c9d1d9'], code: 'github-dark', tone: 'dark',
    css: `
.md-body { color: #c9d1d9; background: #0d1117; padding: 18px; border-radius: 8px; }
.md-body h1 { color: #ffffff; border-bottom: 1px solid #30363d; padding-bottom: 10px; }
.md-body h2 { color: #ffffff; border-bottom: 1px solid #30363d; padding-bottom: 8px; }
.md-body h3 { color: #79c0ff; }
.md-body h4 { color: #79c0ff; }
.md-body blockquote { border-left: 4px solid #30363d; background: #161b22; color: #8b949e; }
.md-body a { color: #58a6ff; }
.md-body strong { color: #ffffff; }
.md-body code { background: #161b22; color: #ff7b72; border: 1px solid #30363d; }
.md-body th { background: #161b22; color: #ffffff; }
.md-body th, .md-body td { border: 1px solid #30363d; }
.md-body hr { background: #30363d; }
.md-body .code-block { border: 1px solid #30363d; }
`
  },
  {
    id: 'violet', name: '姹紫', desc: '紫色胶囊标题，柔雅', swatch: ['#8b5cf6', '#f5f0ff', '#3b3350'], code: 'github-light', tone: 'light',
    css: `
.md-body { color: #3b3350; }
.md-body h1 { color: #ffffff; background: #8b5cf6; text-align: center; padding: 12px 10px; border-radius: 8px; }
.md-body h2 { color: #7c3aed; background: #f5f0ff; padding: 7px 12px; border-radius: 6px; border-left: 4px solid #8b5cf6; }
.md-body h3 { color: #7c3aed; padding-left: 9px; border-left: 3px solid #c4b5fd; }
.md-body h4 { color: #6d28d9; }
.md-body blockquote { border-left: 4px solid #a78bfa; background: #faf7ff; color: #6b5b84; border-radius: 0 6px 6px 0; }
.md-body a { color: #7c3aed; border-bottom: 1px solid #ddd6fe; }
.md-body strong { color: #6d28d9; }
.md-body code { background: #f5f0ff; color: #6d28d9; border: 1px solid #ede9fe; }
.md-body th { background: #f5f0ff; color: #6d28d9; }
.md-body th, .md-body td { border: 1px solid #ddd6fe; }
.md-body hr { background: #ddd6fe; }
`
  },
  {
    id: 'lapis', name: '藏青', desc: '深蓝标题条 + 金线', swatch: ['#1d3557', '#c9a227', '#f4f6fa'], code: 'github-light', tone: 'light',
    css: `
.md-body { color: #2c3a4b; }
.md-body h1 { color: #ffffff; background: #1d3557; text-align: center; padding: 13px 10px; border-radius: 6px; letter-spacing: 1px; }
.md-body h2 { color: #1d3557; border-bottom: 3px solid #c9a227; padding-bottom: 7px; }
.md-body h3 { color: #1d3557; padding-left: 10px; border-left: 4px solid #c9a227; }
.md-body h4 { color: #2b4b73; }
.md-body blockquote { border: 1px solid #d8e0ea; border-left: 4px solid #1d3557; background: #f4f6fa; color: #4a5b70; border-radius: 5px; }
.md-body a { color: #1d3557; border-bottom: 1px solid #c9a227; }
.md-body strong { color: #1d3557; }
.md-body code { background: #f4f6fa; color: #1d3557; border: 1px solid #d8e0ea; }
.md-body th { background: #1d3557; color: #ffffff; }
.md-body th, .md-body td { border: 1px solid #d8e0ea; }
.md-body hr { background: #c9a227; }
`
  },
  {
    id: 'mint', name: '薄荷', desc: '青绿清爽，护眼', swatch: ['#10a37f', '#effcf7', '#2f4f47'], code: 'github-light', tone: 'light',
    css: `
.md-body { color: #2f4f47; }
.md-body h1 { color: #0b7a5f; text-align: center; letter-spacing: .5px; }
.md-body h2 { color: #0b7a5f; background: #effcf7; padding: 7px 12px; border-radius: 6px; border-left: 4px solid #10a37f; }
.md-body h3 { color: #10a37f; padding-left: 9px; border-left: 3px solid #9ae6c8; }
.md-body h4 { color: #0b7a5f; }
.md-body blockquote { border-left: 4px solid #6fd3b2; background: #f2fcf8; color: #4a6a60; border-radius: 0 6px 6px 0; }
.md-body a { color: #0b7a5f; border-bottom: 1px solid #a7e8d0; }
.md-body strong { color: #0b7a5f; }
.md-body code { background: #effcf7; color: #0b7a5f; border: 1px solid #cdeee1; }
.md-body th { background: #effcf7; color: #0b7a5f; }
.md-body th, .md-body td { border: 1px solid #cdeee1; }
.md-body hr { background: #cdeee1; }
`
  },
  {
    id: 'juejin', name: '掘金蓝', desc: '技术博客常见蓝', swatch: ['#1e80ff', '#eaf2ff', '#252933'], code: 'github-light', tone: 'light',
    css: `
.md-body { color: #252933; }
.md-body h1 { color: #1f2328; font-size: 1.55em; }
.md-body h2 { color: #1f2328; padding-left: 11px; border-left: 4px solid #1e80ff; }
.md-body h3 { color: #1e80ff; }
.md-body h4 { color: #1e80ff; }
.md-body blockquote { border-left: 4px solid #1e80ff; background: #eaf2ff; color: #4a5b73; border-radius: 0 5px 5px 0; }
.md-body a { color: #1e80ff; }
.md-body strong { color: #1e80ff; }
.md-body code { background: #f2f6fc; color: #d1423b; }
.md-body th { background: #eaf2ff; color: #1f2328; }
.md-body th, .md-body td { border: 1px solid #d9e6fb; }
.md-body hr { background: #d9e6fb; }
.md-body .code-block { border: 1px solid #d9e6fb; }
`
  },
  {
    id: 'rose', name: '玫瑰', desc: '低饱和粉，细腻', swatch: ['#c2185b', '#fff5f7', '#4a3540'], code: 'github-light', tone: 'light',
    css: `
.md-body { color: #4a3540; }
.md-body h1 { color: #c2185b; text-align: center; letter-spacing: 1px; }
.md-body h2 { color: #c2185b; border-bottom: 2px solid #f8d7e2; padding-bottom: 8px; }
.md-body h3 { color: #ad1457; padding-left: 10px; border-left: 3px solid #f0a8c0; }
.md-body h4 { color: #ad1457; }
.md-body blockquote { border: 1px solid #f8d7e2; border-left: 4px solid #e085a5; background: #fff5f7; color: #7a5a67; border-radius: 8px; }
.md-body a { color: #c2185b; border-bottom: 1px solid #f0b8cc; }
.md-body strong { color: #ad1457; }
.md-body code { background: #fff0f4; color: #ad1457; border: 1px solid #f8d7e2; }
.md-body th { background: #fff5f7; color: #ad1457; }
.md-body th, .md-body td { border: 1px solid #f8d7e2; }
.md-body hr { background: #f8d7e2; }
.md-body img { border-radius: 8px; }
`
  },
  {
    id: 'solarized', name: 'Solarized', desc: '经典低对比米黄', swatch: ['#268bd2', '#fdf6e3', '#657b83'], code: 'solarized-light', tone: 'light',
    css: `
.md-body { color: #657b83; background: #fdf6e3; padding: 18px; border-radius: 8px; }
.md-body h1 { color: #073642; border-bottom: 2px solid #eee8d5; padding-bottom: 10px; }
.md-body h2 { color: #b58900; border-bottom: 1px solid #eee8d5; padding-bottom: 7px; }
.md-body h3 { color: #268bd2; }
.md-body h4 { color: #2aa198; }
.md-body blockquote { border-left: 4px solid #93a1a1; background: #f5efdc; color: #586e75; }
.md-body a { color: #268bd2; border-bottom: 1px solid #c7d9e8; }
.md-body strong { color: #073642; }
.md-body code { background: #eee8d5; color: #b58900; border: 1px solid #e3d9bf; }
.md-body th { background: #eee8d5; color: #073642; }
.md-body th, .md-body td { border: 1px solid #e3d9bf; }
.md-body hr { background: #e3d9bf; }
.md-body .code-block { border: 1px solid #e3d9bf; }
.md-body .code-head { background: #eee8d5; color: #93a1a1; border-bottom: 1px solid #e3d9bf; }
`
  },
  {
    id: 'ink', name: '水墨', desc: '黑白留白，衬线', swatch: ['#1a1a1a', '#fbfbf9', '#555555'], code: 'github-light', tone: 'paper',
    css: `
.md-body { color: #2a2a2a; font-family: "Songti SC", "Noto Serif SC", Georgia, serif; font-size: 16.5px; line-height: 1.9; }
.md-body h1 { color: #1a1a1a; text-align: center; letter-spacing: 3px; border-bottom: 1px solid #d9d9d9; padding-bottom: 14px; }
.md-body h2 { color: #1a1a1a; text-align: center; letter-spacing: 1px; }
.md-body h3 { color: #333333; }
.md-body h4 { color: #333333; }
.md-body blockquote { border: 0; border-left: 2px solid #1a1a1a; background: #f7f7f5; color: #555555; font-style: italic; padding-left: 16px; }
.md-body a { color: #1a1a1a; border-bottom: 1px solid #bdbdbd; }
.md-body strong { color: #1a1a1a; }
.md-body code { background: #f3f3f1; color: #333333; border: 1px solid #e5e5e2; }
.md-body th { background: #f3f3f1; color: #1a1a1a; }
.md-body th, .md-body td { border: 1px solid #d9d9d9; }
.md-body hr { background: #d9d9d9; }
`
  },
  {
    id: 'coffee', name: '咖啡', desc: '棕调纸感，沉稳', swatch: ['#7b4b2a', '#f7f1e8', '#4a3b30'], code: 'github-light', tone: 'paper',
    css: `
.md-body { color: #4a3b30; background: #f7f1e8; padding: 18px; border-radius: 8px; }
.md-body h1 { color: #5c3618; text-align: center; border-bottom: 3px double #c9b49a; padding-bottom: 12px; }
.md-body h2 { color: #7b4b2a; border-bottom: 1px solid #d8c6af; padding-bottom: 7px; }
.md-body h3 { color: #7b4b2a; padding-left: 10px; border-left: 3px solid #b08a62; }
.md-body h4 { color: #7b4b2a; }
.md-body blockquote { border-left: 4px solid #b08a62; background: #efe6d8; color: #6a5644; border-radius: 0 6px 6px 0; }
.md-body a { color: #8a5a2b; border-bottom: 1px solid #d8c6af; }
.md-body strong { color: #5c3618; }
.md-body code { background: #efe6d8; color: #7b4b2a; border: 1px solid #e0d2bf; }
.md-body th { background: #efe6d8; color: #5c3618; }
.md-body th, .md-body td { border: 1px solid #d8c6af; }
.md-body hr { background: #d8c6af; }
.md-body .code-block { border: 1px solid #d8c6af; }
.md-body .code-head { background: #efe6d8; color: #8a7358; border-bottom: 1px solid #d8c6af; }
`
  },
  {
    id: 'sunset', name: '落日', desc: '橘红暖调，轻快', swatch: ['#e8590c', '#fff3e8', '#5a3a2a'], code: 'github-light', tone: 'paper',
    css: `
.md-body { color: #5a3a2a; }
.md-body h1 { color: #ffffff; background: #f07c3c; text-align: center; padding: 12px 10px; border-radius: 8px; }
.md-body h2 { color: #e8590c; border-bottom: 2px solid #ffd8b8; padding-bottom: 8px; }
.md-body h3 { color: #d9480f; padding-left: 10px; border-left: 4px solid #ffa94d; }
.md-body h4 { color: #d9480f; }
.md-body blockquote { border-left: 4px solid #ffa94d; background: #fff3e8; color: #7a5540; border-radius: 0 6px 6px 0; }
.md-body a { color: #e8590c; border-bottom: 1px solid #ffd8b8; }
.md-body strong { color: #d9480f; }
.md-body code { background: #fff3e8; color: #d9480f; border: 1px solid #ffe2c9; }
.md-body th { background: #fff3e8; color: #d9480f; }
.md-body th, .md-body td { border: 1px solid #ffd8b8; }
.md-body hr { background: #ffd8b8; }
`
  },
  {
    id: 'dracula', name: 'Dracula', desc: '深紫底 + 霓虹紫粉', swatch: ['#bd93f9', '#282a36', '#f8f8f2'], code: 'dracula', tone: 'dark',
    css: `
.md-body { color: #f8f8f2; background: #282a36; padding: 18px; border-radius: 8px; }
.md-body h1 { color: #ff79c6; text-align: center; }
.md-body h2 { color: #bd93f9; border-bottom: 1px solid #44475a; padding-bottom: 8px; }
.md-body h3 { color: #8be9fd; }
.md-body h4 { color: #50fa7b; }
.md-body blockquote { border-left: 4px solid #bd93f9; background: #21222c; color: #c5c9d6; }
.md-body a { color: #8be9fd; }
.md-body strong { color: #ffb86c; }
.md-body code { background: #21222c; color: #f1fa8c; border: 1px solid #44475a; }
.md-body th { background: #21222c; color: #bd93f9; }
.md-body th, .md-body td { border: 1px solid #44475a; }
.md-body hr { background: #44475a; }
.md-body .code-block { border: 1px solid #44475a; }
`
  },
  {
    id: 'nord', name: 'Nord', desc: '冷蓝灰，极简克制', swatch: ['#88c0d0', '#2e3440', '#d8dee9'], code: 'nord', tone: 'dark',
    css: `
.md-body { color: #d8dee9; background: #2e3440; padding: 18px; border-radius: 8px; }
.md-body h1 { color: #eceff4; border-bottom: 1px solid #4c566a; padding-bottom: 10px; }
.md-body h2 { color: #88c0d0; }
.md-body h3 { color: #81a1c1; }
.md-body h4 { color: #a3be8c; }
.md-body blockquote { border-left: 4px solid #5e81ac; background: #3b4252; color: #b8c4d6; }
.md-body a { color: #88c0d0; }
.md-body strong { color: #eceff4; }
.md-body code { background: #3b4252; color: #ebcb8b; border: 1px solid #4c566a; }
.md-body th { background: #3b4252; color: #eceff4; }
.md-body th, .md-body td { border: 1px solid #4c566a; }
.md-body hr { background: #4c566a; }
.md-body .code-block { border: 1px solid #4c566a; }
`
  },
  {
    id: 'ocean', name: '深海', desc: '深蓝底浅字，夜读', swatch: ['#4fc1ff', '#0d2137', '#cfe3f5'], code: 'one-dark', tone: 'dark',
    css: `
.md-body { color: #cfe3f5; background: #0d2137; padding: 18px; border-radius: 8px; }
.md-body h1 { color: #ffffff; text-align: center; border-bottom: 2px solid #1d4e7a; padding-bottom: 12px; }
.md-body h2 { color: #4fc1ff; padding-left: 11px; border-left: 4px solid #2b7fb8; }
.md-body h3 { color: #7dd3fc; }
.md-body h4 { color: #7dd3fc; }
.md-body blockquote { border-left: 4px solid #2b7fb8; background: #12304d; color: #a9c8e2; }
.md-body a { color: #4fc1ff; }
.md-body strong { color: #ffffff; }
.md-body code { background: #12304d; color: #9cd6ff; border: 1px solid #1d4e7a; }
.md-body th { background: #12304d; color: #ffffff; }
.md-body th, .md-body td { border: 1px solid #1d4e7a; }
.md-body hr { background: #1d4e7a; }
.md-body .code-block { border: 1px solid #1d4e7a; }
`
  }
];

/* 主题分组：老主题在这里补齐分类，新主题在定义里直接带 tone */
const THEME_GROUPS = [
  { id: 'all', name: '全部' },
  { id: 'light', name: '浅色' },
  { id: 'paper', name: '纸质 / 衬线' },
  { id: 'dark', name: '深色' }
];
const LEGACY_TONES = {
  newspaper: 'paper', warm: 'paper', night: 'dark'
};
THEMES.forEach(t => { if (!t.tone) t.tone = LEGACY_TONES[t.id] || 'light'; });

/* ---------- 对外工具函数 ---------- */
function getTheme(id) { return THEMES.find(t => t.id === id) || THEMES[0]; }

/** 预览用：base + 主题 + 代码配色，并加上预览作用域前缀 */
function buildPreviewCSS(themeId) {
  const th = getTheme(themeId);
  const raw = BASE_CSS + '\n' + th.css + '\n' + (CODE_THEMES[th.code]?.css || '');
  return raw.replace(/\.md-body/g, '#preview .md-body');
}

/** 导出用：返回未加作用域前缀的 CSS 片段列表（顺序即层叠顺序） */
function buildExportCSS(themeId) {
  const th = getTheme(themeId);
  return [BASE_CSS, th.css, (CODE_THEMES[th.code]?.css || '')].join('\n');
}
