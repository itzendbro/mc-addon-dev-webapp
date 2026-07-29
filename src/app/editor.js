// ---------------------------------------------------------------------------
// CodeMirror 6 powered code editor tuned to look & feel like VS Code, with
// Minecraft Bedrock aware autocompletion and phone friendly defaults.
// ---------------------------------------------------------------------------
import { EditorState, Compartment } from "@codemirror/state";
import { EditorView, keymap, lineNumbers, highlightActiveLine, highlightActiveLineGutter, highlightSpecialChars, drawSelection, dropCursor, rectangularSelection, crosshairCursor } from "@codemirror/view";
import {
  defaultKeymap,
  history,
  historyKeymap,
  indentWithTab,
  undo,
  redo,
  indentMore,
  indentLess,
  insertTab,
  cursorCharLeft,
  cursorCharRight,
  cursorLineUp,
  cursorLineDown,
  cursorLineBoundaryBackward,
  cursorLineBoundaryForward,
} from "@codemirror/commands";
import { indentOnInput, bracketMatching, foldGutter, foldKeymap, syntaxHighlighting, HighlightStyle, indentUnit } from "@codemirror/language";
import { searchKeymap, highlightSelectionMatches, openSearchPanel } from "@codemirror/search";
import { autocompletion, completionKeymap, closeBrackets, closeBracketsKeymap, snippetCompletion } from "@codemirror/autocomplete";
import { javascript, javascriptLanguage } from "@codemirror/lang-javascript";
import { json, jsonLanguage } from "@codemirror/lang-json";
import { tags as t } from "@lezer/highlight";
import { JSON_SNIPPETS, JS_SNIPPETS } from "./mcCompletions.js";
import { buildManifestBP, buildManifestRP } from "./mcTemplates.js";
import { uuidv4 } from "./utils.js";

// ---------------------------------------------------------------------------
// VS Code Dark+ inspired theme
// ---------------------------------------------------------------------------
const vscodeTheme = EditorView.theme(
  {
    "&": {
      color: "#d4d4d4",
      backgroundColor: "#1e1e1e",
      fontSize: "14px",
      height: "100%",
    },
    ".cm-content": {
      fontFamily: "'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace",
      caretColor: "#aeafad",
      paddingBottom: "40vh",
    },
    ".cm-scroller": { overflow: "auto", lineHeight: "1.55" },
    "&.cm-focused .cm-cursor": { borderLeftColor: "#aeafad" },
    "&.cm-focused .cm-selectionBackground, .cm-selectionBackground, ::selection": {
      backgroundColor: "#264f78 !important",
    },
    ".cm-activeLine": { backgroundColor: "#2a2d2e" },
    ".cm-activeLineGutter": { backgroundColor: "#2a2d2e", color: "#c6c6c6" },
    ".cm-gutters": {
      backgroundColor: "#1e1e1e",
      color: "#5a5a5a",
      border: "none",
      borderRight: "1px solid #2b2b2b",
    },
    ".cm-lineNumbers .cm-gutterElement": { padding: "0 8px 0 10px" },
    ".cm-foldGutter .cm-gutterElement": { padding: "0 2px" },
    ".cm-matchingBracket": { backgroundColor: "#3a3d41", outline: "1px solid #515151" },
    ".cm-nonmatchingBracket": { backgroundColor: "#763939" },
    ".cm-tooltip": {
      backgroundColor: "#252526",
      border: "1px solid #454545",
      color: "#d4d4d4",
      borderRadius: "6px",
      overflow: "hidden",
    },
    ".cm-tooltip.cm-tooltip-autocomplete > ul": {
      fontFamily: "'JetBrains Mono', ui-monospace, monospace",
      fontSize: "13px",
      maxHeight: "40vh",
    },
    ".cm-tooltip-autocomplete ul li[aria-selected]": {
      backgroundColor: "#04395e",
      color: "#ffffff",
    },
    ".cm-tooltip-autocomplete ul li": { padding: "6px 8px" },
    ".cm-completionLabel": { color: "inherit" },
    ".cm-completionDetail": { color: "#9d9d9d", fontStyle: "normal", marginLeft: "8px" },
    ".cm-completionIcon": { marginRight: "6px", opacity: 0.9 },
    ".cm-panels": { backgroundColor: "#252526", color: "#d4d4d4" },
    ".cm-searchMatch": { backgroundColor: "#613214", outline: "1px solid #927104" },
    ".cm-searchMatch-selected": { backgroundColor: "#515c6a" },
    "&.cm-editor": { outline: "none" },
    "&.cm-focused": { outline: "none" },
  },
  { dark: true }
);

const vscodeHighlight = HighlightStyle.define([
  { tag: t.comment, color: "#6a9955", fontStyle: "italic" },
  { tag: t.string, color: "#ce9178" },
  { tag: t.regexp, color: "#d16969" },
  { tag: [t.number, t.bool, t.null], color: "#b5cea8" },
  { tag: [t.keyword, t.controlKeyword, t.moduleKeyword], color: "#569cd6" },
  { tag: [t.operator, t.punctuation], color: "#d4d4d4" },
  { tag: [t.bracket], color: "#ffd700" },
  { tag: t.propertyName, color: "#9cdcfe" },
  { tag: t.definition(t.propertyName), color: "#9cdcfe" },
  { tag: [t.variableName, t.definition(t.variableName)], color: "#9cdcfe" },
  { tag: t.function(t.variableName), color: "#dcdcaa" },
  { tag: [t.className, t.typeName], color: "#4ec9b0" },
  { tag: t.atom, color: "#569cd6" },
  { tag: t.invalid, color: "#f44747" },
  { tag: t.meta, color: "#c586c0" },
]);

// ---------------------------------------------------------------------------
// Autocomplete sources
// ---------------------------------------------------------------------------
const jsonOptions = JSON_SNIPPETS.map((s) =>
  snippetCompletion(s.snippet, { label: s.label, type: s.type || "property", detail: s.detail })
);
const jsOptions = JS_SNIPPETS.map((s) =>
  snippetCompletion(s.snippet, { label: s.label, type: s.type || "function", detail: s.detail })
);

function jsonCompletionSource(context) {
  const word = context.matchBefore(/["\w:.$-]*/);
  if (!word || (word.from === word.to && !context.explicit)) return null;
  return { from: word.from, options: jsonOptions, validFor: /^["\w:.$-]*$/ };
}

function jsCompletionSource(context) {
  const word = context.matchBefore(/[\w.$]*/);
  if (!word || (word.from === word.to && !context.explicit)) return null;
  return { from: word.from, options: jsOptions, validFor: /^[\w.$]*$/ };
}

function applyMagic(kind) {
  return (view, completion, from, to) => {
    let text = "";
    if (kind === "mbp") text = buildManifestBP();
    else if (kind === "mrp") text = buildManifestRP();
    else if (kind === "uuid") text = uuidv4();
    view.dispatch({
      changes: { from, to, insert: text },
      selection: { anchor: from + text.length },
      userEvent: "input.complete",
    });
  };
}

const magicOptions = [
  {
    label: "!mbp",
    type: "keyword",
    detail: "Insert Behavior Pack manifest.json",
    boost: 99,
    apply: applyMagic("mbp"),
  },
  {
    label: "!mrp",
    type: "keyword",
    detail: "Insert Resource Pack manifest.json",
    boost: 99,
    apply: applyMagic("mrp"),
  },
  {
    label: "!uuid",
    type: "keyword",
    detail: "Insert a new random UUID v4",
    boost: 99,
    apply: applyMagic("uuid"),
  },
];

function magicCompletionSource(context) {
  const word = context.matchBefore(/![a-zA-Z]*/);
  if (!word) return null;
  if (word.from === word.to && !context.explicit) return null;
  return { from: word.from, options: magicOptions, validFor: /^![a-zA-Z]*$/ };
}

// Always-available trigger regardless of language mode.
const magicLanguageData = EditorState.languageData.of(() => [{ autocomplete: magicCompletionSource }]);

// ---------------------------------------------------------------------------
// Language selection per file extension
// ---------------------------------------------------------------------------
function languageExtensionsFor(ext) {
  if (ext === "json") {
    return [json(), jsonLanguage.data.of({ autocomplete: jsonCompletionSource })];
  }
  if (ext === "js" || ext === "mjs" || ext === "cjs") {
    return [javascript(), javascriptLanguage.data.of({ autocomplete: jsCompletionSource })];
  }
  if (ext === "ts") {
    return [javascript({ typescript: true }), javascriptLanguage.data.of({ autocomplete: jsCompletionSource })];
  }
  return [];
}

const wrapCompartment = new Compartment();
let wrapEnabled = true;

function baseExtensions(ext, onUpdate, onCursor) {
  return [
    lineNumbers(),
    highlightActiveLineGutter(),
    highlightSpecialChars(),
    history(),
    foldGutter({ openText: "\u25BE", closedText: "\u25B8" }),
    drawSelection(),
    dropCursor(),
    indentOnInput(),
    indentUnit.of("    "),
    syntaxHighlighting(vscodeHighlight, { fallback: true }),
    bracketMatching(),
    closeBrackets(),
    autocompletion({ activateOnTyping: true, icons: true }),
    rectangularSelection(),
    crosshairCursor(),
    highlightActiveLine(),
    highlightSelectionMatches(),
    wrapCompartment.of(wrapEnabled ? EditorView.lineWrapping : []),
    vscodeTheme,
    magicLanguageData,
    keymap.of([...closeBracketsKeymap, ...defaultKeymap, ...searchKeymap, ...historyKeymap, ...foldKeymap, ...completionKeymap, indentWithTab]),
    ...languageExtensionsFor(ext),
    EditorView.updateListener.of((update) => {
      if (update.docChanged && onUpdate) onUpdate(update.state.doc.toString());
      if ((update.docChanged || update.selectionSet) && onCursor) {
        const pos = update.state.selection.main.head;
        const line = update.state.doc.lineAt(pos);
        onCursor({ line: line.number, col: pos - line.from + 1, length: update.state.doc.length });
      }
    }),
  ];
}

export class EditorManager {
  constructor(container, opts) {
    this.container = container;
    this.opts = opts || {};
    this.states = new Map(); // path -> EditorState
    this.view = new EditorView({
      state: EditorState.create({ doc: "", extensions: [vscodeTheme] }),
      parent: container,
    });
    this.activePath = null;
  }

  hasState(path) {
    return this.states.has(path);
  }

  discard(path) {
    this.states.delete(path);
  }

  openFile(path, content, ext) {
    let state = this.states.get(path);
    if (!state) {
      state = EditorState.create({
        doc: content ?? "",
        extensions: baseExtensions(
          ext,
          (doc) => {
            if (this.opts.onChange) this.opts.onChange(path, doc);
          },
          (info) => {
            if (this.opts.onCursor) this.opts.onCursor(path, info);
          }
        ),
      });
      this.states.set(path, state);
    }
    this.activePath = path;
    this.view.setState(state);
    // keep the map reference synced to whatever the view produces from now on
    this._syncTimer && clearInterval(this._syncTimer);
    this.view.focus();
  }

  // Called right before switching away so we keep the latest EditorState
  // (cursor position, undo history, folds) cached for this path.
  captureActive() {
    if (this.activePath) this.states.set(this.activePath, this.view.state);
  }

  insertText(text) {
    const view = this.view;
    const { from, to } = view.state.selection.main;
    view.dispatch({ changes: { from, to, insert: text }, selection: { anchor: from + text.length } });
    view.focus();
  }

  toggleWrap() {
    wrapEnabled = !wrapEnabled;
    this.view.dispatch({ effects: wrapCompartment.reconfigure(wrapEnabled ? EditorView.lineWrapping : []) });
    return wrapEnabled;
  }

  getCursorInfo() {
    const state = this.view.state;
    const pos = state.selection.main.head;
    const line = state.doc.lineAt(pos);
    return { line: line.number, col: pos - line.from + 1, length: state.doc.length };
  }

  undo() {
    undo(this.view);
    this.view.focus();
  }

  redo() {
    redo(this.view);
    this.view.focus();
  }

  indent(dir) {
    (dir < 0 ? indentLess : indentMore)(this.view);
    this.view.focus();
  }

  insertTab() {
    insertTab(this.view);
    this.view.focus();
  }

  moveCursor(dir) {
    const map = {
      left: cursorCharLeft,
      right: cursorCharRight,
      up: cursorLineUp,
      down: cursorLineDown,
      home: cursorLineBoundaryBackward,
      end: cursorLineBoundaryForward,
    };
    const cmd = map[dir];
    if (cmd) cmd(this.view);
    this.view.focus();
  }

  focus() {
    this.view.focus();
  }

  openSearch() {
    openSearchPanel(this.view);
  }

  destroy() {
    this.view.destroy();
  }
}
