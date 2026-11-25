/* CodeMirror 6 bundle 入口：只导出本项目需要的部分，控制体积 */
import { EditorState, EditorSelection, Compartment, StateField, StateEffect, RangeSetBuilder } from '@codemirror/state';
import {
  EditorView, keymap, lineNumbers, highlightActiveLine, highlightActiveLineGutter,
  drawSelection, dropCursor, rectangularSelection, crosshairCursor,
  highlightSpecialChars, placeholder, scrollPastEnd,
  Decoration, WidgetType, ViewPlugin
} from '@codemirror/view';
import {
  defaultKeymap, history, historyKeymap, indentWithTab, undo, redo, selectAll,
  undoDepth, redoDepth
} from '@codemirror/commands';
import {
  syntaxHighlighting, HighlightStyle, bracketMatching, indentOnInput, indentUnit,
  foldGutter, foldKeymap
} from '@codemirror/language';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { searchKeymap, highlightSelectionMatches, openSearchPanel } from '@codemirror/search';
import { closeBrackets, closeBracketsKeymap } from '@codemirror/autocomplete';
import { tags } from '@lezer/highlight';

/* Markdown 语法着色：颜色全部走 CSS 变量，跟着界面深浅色走 */
const mdHighlight = HighlightStyle.define([
  { tag: tags.heading1, color: 'var(--cm-h1, #0550ae)', fontWeight: '700', fontSize: '1.15em' },
  { tag: tags.heading2, color: 'var(--cm-h2, #0969da)', fontWeight: '700', fontSize: '1.08em' },
  { tag: tags.heading3, color: 'var(--cm-h3, #1f6feb)', fontWeight: '700' },
  { tag: [tags.heading4, tags.heading5, tags.heading6], color: 'var(--cm-h3, #1f6feb)', fontWeight: '600' },
  { tag: tags.strong, fontWeight: '700', color: 'var(--cm-strong, #1f2328)' },
  { tag: tags.emphasis, fontStyle: 'italic', color: 'var(--cm-em, #3d444d)' },
  { tag: tags.strikethrough, textDecoration: 'line-through', opacity: '.7' },
  { tag: tags.link, color: 'var(--cm-link, #0969da)', textDecoration: 'underline' },
  { tag: tags.url, color: 'var(--cm-url, #6a737d)' },
  { tag: tags.monospace, color: 'var(--cm-code, #953800)', background: 'var(--cm-code-bg, rgba(175,184,193,.16))' },
  { tag: tags.quote, color: 'var(--cm-quote, #6a737d)', fontStyle: 'italic' },
  { tag: tags.list, color: 'var(--cm-mark, #6a737d)' },
  { tag: tags.meta, color: 'var(--cm-meta, #6a737d)' },
  { tag: tags.keyword, color: 'var(--cm-keyword, #cf222e)' },
  { tag: tags.string, color: 'var(--cm-string, #0a3069)' },
  { tag: tags.number, color: 'var(--cm-number, #0550ae)' },
  { tag: tags.comment, color: 'var(--cm-comment, #6a737d)', fontStyle: 'italic' },
  { tag: tags.typeName, color: 'var(--cm-type, #8250df)' },
  { tag: tags.function(tags.variableName), color: 'var(--cm-func, #8250df)' },
  { tag: tags.processingInstruction, color: 'var(--cm-mark, #6a737d)' },
  { tag: tags.contentSeparator, color: 'var(--cm-mark, #89929b)' }
]);

export {
  EditorState, EditorSelection, Compartment, StateField, StateEffect, RangeSetBuilder,
  EditorView, keymap, lineNumbers, highlightActiveLine, highlightActiveLineGutter,
  drawSelection, dropCursor, rectangularSelection, crosshairCursor,
  highlightSpecialChars, placeholder, scrollPastEnd,
  Decoration, WidgetType, ViewPlugin,
  defaultKeymap, history, historyKeymap, indentWithTab, undo, redo, selectAll,
  undoDepth, redoDepth,
  syntaxHighlighting, HighlightStyle, bracketMatching, indentOnInput, indentUnit,
  foldGutter, foldKeymap,
  markdown, markdownLanguage,
  searchKeymap, highlightSelectionMatches, openSearchPanel,
  closeBrackets, closeBracketsKeymap,
  tags, mdHighlight
};
