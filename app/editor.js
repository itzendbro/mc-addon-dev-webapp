// ---------------------------------------------------------------------------
// CodeMirror 5 powered code editor tuned to look & feel like VS Code, with
// Minecraft Bedrock aware autocompletion and phone friendly defaults.
// Uses the globally loaded CodeMirror (vendored, no build step required).
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Snippet expansion helpers (CodeMirror 6 style ${1:placeholder} / $0 syntax
// re-used from mcCompletions.js, applied manually since CM5 has no built in
// snippet engine). We simply drop the placeholder markers and put the cursor
// at the position of the first placeholder (or $0 if there is no numbered
// placeholder), good enough for quick Minecraft Bedrock authoring on mobile.
// ---------------------------------------------------------------------------
function parseSnippet(raw) {
  // Returns { text, cursorOffset } with all ${n:default}/$0 tokens resolved
  // to their default text, and cursorOffset pointing at the first
  // placeholder's start (falls back to $0, then end of string).
  let firstOffset = -1;
  let finalOffset = -1;
  let out = "";
  let i = 0;
  while (i < raw.length) {
    const ch = raw[i];
    if (ch === "$" && raw[i + 1] === "{") {
      const end = raw.indexOf("}", i);
      const inner = end === -1 ? "" : raw.slice(i + 2, end);
      const colon = inner.indexOf(":");
      const def = colon === -1 ? "" : inner.slice(colon + 1);
      if (firstOffset === -1) firstOffset = out.length;
      out += def;
      i = end === -1 ? raw.length : end + 1;
      continue;
    }
    if (ch === "$" && /[0-9]/.test(raw[i + 1] || "")) {
      let j = i + 1;
      while (/[0-9]/.test(raw[j] || "")) j++;
      const num = raw.slice(i + 1, j);
      if (num === "0") finalOffset = out.length;
      else if (firstOffset === -1) firstOffset = out.length;
      i = j;
      continue;
    }
    out += ch;
    i++;
  }
  const cursorOffset = firstOffset !== -1 ? firstOffset : finalOffset !== -1 ? finalOffset : out.length;
  return { text: out, cursorOffset };
}

// ---------------------------------------------------------------------------
// Magic triggers: !mbp / !mrp / !uuid expand to whole manifest / uuid blocks.
// ---------------------------------------------------------------------------
const MAGIC_HINTS = [
  { trigger: "!mbp", build: () => buildManifestBP(), detail: "Insert Behavior Pack manifest.json" },
  { trigger: "!mrp", build: () => buildManifestRP(), detail: "Insert Resource Pack manifest.json" },
  { trigger: "!uuid", build: () => uuidv4(), detail: "Insert a new random UUID v4" },
];

// ---------------------------------------------------------------------------
// VS Code style suggestion-widget row renderer: a small type icon on the
// left, the label, then a dimmed detail string -- instead of CodeMirror's
// default single line of plain text.
// ---------------------------------------------------------------------------
const HINT_ICONS = {
  magic: "\u2728",
  property: "\u2022",
  keyword: "K",
  function: "\u0192",
  class: "C",
  type: "T",
  enum: "E",
};

function renderHintRow(icon, label, detail) {
  return (elt) => {
    elt.classList.add("pas-hint-row");
    const iconEl = document.createElement("span");
    iconEl.className = `pas-hint-icon pas-hint-icon-${icon in HINT_ICONS ? icon : "property"}`;
    iconEl.textContent = HINT_ICONS[icon] || HINT_ICONS.property;
    const labelEl = document.createElement("span");
    labelEl.className = "pas-hint-label";
    labelEl.textContent = label;
    elt.appendChild(iconEl);
    elt.appendChild(labelEl);
    if (detail) {
      const detailEl = document.createElement("span");
      detailEl.className = "pas-hint-detail";
      detailEl.textContent = detail;
      elt.appendChild(detailEl);
    }
  };
}

function buildHintList(cm, snippets, magicOnly) {
  const cursor = cm.getCursor();
  const line = cm.getLine(cursor.line);
  const before = line.slice(0, cursor.ch);

  // Magic !triggers work regardless of language mode.
  const magicMatch = before.match(/![a-zA-Z]*$/);
  if (magicMatch) {
    const start = cursor.ch - magicMatch[0].length;
    const word = magicMatch[0];
    const list = MAGIC_HINTS.filter((m) => m.trigger.startsWith(word)).map((m) => ({
      text: m.trigger,
      render: renderHintRow("magic", m.trigger, m.detail),
      hint: (editor, self) => {
        const built = m.build();
        editor.replaceRange(built, { line: cursor.line, ch: start }, cursor);
      },
    }));
    if (list.length) {
      return { list, from: { line: cursor.line, ch: start }, to: cursor };
    }
    if (magicOnly) return null;
  }
  if (magicOnly || !snippets || !snippets.length) return null;

  const wordMatch = before.match(/[\w":.$-]*$/);
  const word = wordMatch ? wordMatch[0] : "";
  const start = cursor.ch - word.length;
  const lower = word.toLowerCase().replace(/^"/, "");
  const matches = snippets.filter((s) => s.label.toLowerCase().includes(lower));
  if (!matches.length) return null;
  const list = matches.slice(0, 60).map((s) => ({
    text: s.label,
    render: renderHintRow(s.type || "property", s.label, s.detail),
    hint: (editor) => {
      const { text, cursorOffset } = parseSnippet(s.snippet);
      const from = { line: cursor.line, ch: start };
      editor.replaceRange(text, from, cursor);
      const lines = text.slice(0, cursorOffset).split("\n");
      const newLine = from.line + lines.length - 1;
      const newCh = lines.length === 1 ? from.ch + cursorOffset : lines[lines.length - 1].length;
      editor.setCursor({ line: newLine, ch: newCh });
    },
  }));
  return { list, from: { line: cursor.line, ch: start }, to: cursor };
}

function modeForExt(ext) {
  if (ext === "json") return { name: "javascript", json: true };
  if (ext === "js" || ext === "mjs" || ext === "cjs") return "javascript";
  if (ext === "ts") return { name: "javascript", typescript: true };
  return "text/plain";
}

class EditorManager {
  constructor(container, opts) {
    this.container = container;
    this.opts = opts || {};
    this.docs = new Map(); // path -> { doc, ext }
    this.wrapEnabled = true;
    this.cm = CodeMirror(container, {
      value: "",
      mode: "text/plain",
      theme: "vscode-dark",
      lineNumbers: true,
      lineWrapping: this.wrapEnabled,
      indentUnit: 4,
      tabSize: 4,
      indentWithTabs: false,
      styleActiveLine: true,
      matchBrackets: true,
      autoCloseBrackets: true,
      highlightSelectionMatches: { showToken: false, annotateScrollbar: false },
      // On phones CodeMirror 5 defaults to a "contenteditable" input mode.
      // In that mode, keystrokes typed via the on-screen keyboard only sync
      // to the document once the current IME composition is committed (e.g.
      // once you tap a space or a suggestion), so our live autocomplete
      // never sees the in-progress word and never opens. Forcing the classic
      // hidden-textarea input style fixes this and matches desktop behavior.
      inputStyle: "textarea",
      extraKeys: {
        "Ctrl-Space": "autocomplete",
        Tab: (cm) => {
          if (cm.somethingSelected()) cm.execCommand("indentMore");
          else cm.execCommand("insertSoftTab");
        },
      },
    });
    this.activePath = null;

    this.cm.on("change", (cm, changeObj) => {
      if (changeObj.origin === "setValue") return;
      if (this.activePath && this.opts.onChange) {
        this.opts.onChange(this.activePath, cm.getValue());
      }
      this._maybeAutocomplete(changeObj);
      this._lastChangeOrigin = changeObj.origin;
    });
    // "changes" (the batched/end-of-operation event) fires *after*
    // CodeMirror's own internal logic has already reset the mobile shadow
    // textarea for this edit, so re-syncing it here is what actually
    // sticks -- doing it inside the "change" handler above gets silently
    // overwritten a moment later.
    this.cm.on("changes", () => {
      this._syncMobileShadowInput(this._lastChangeOrigin);
    });
    this.cm.on("cursorActivity", () => {
      if (this.activePath && this.opts.onCursor) {
        this.opts.onCursor(this.activePath, this.getCursorInfo());
      }
    });
  }

  _maybeAutocomplete(changeObj) {
    if (!changeObj) return;
    // Real typing comes in as "+input" on desktop keyboards, but phone
    // on-screen keyboards (Gboard, Samsung Keyboard, iOS predictive text)
    // route ordinary typing through IME composition, which CodeMirror tags
    // as "*compose" instead. We need to react to both so autocomplete works
    // on mobile too.
    if (changeObj.origin !== "+input" && changeObj.origin !== "*compose") return;
    const text = changeObj.text && changeObj.text[changeObj.text.length - 1];
    if (!text) return;
    // Only trigger on word-ish characters / quote / colon / bang so we don't
    // spam a hint popup on every keystroke (e.g. spaces, newlines).
    if (!/[\w":!.$-]/.test(text.slice(-1))) return;
    clearTimeout(this._hintTimer);
    this._hintTimer = setTimeout(() => this.showHints(), 30);
  }

  // ---------------------------------------------------------------------
  // Phone keyboards don't send real key events for backspace/delete --
  // they diff the hidden shadow <textarea> CodeMirror mirrors the document
  // into against its previous value. That mirror is kept in sync
  // automatically while the user types, but whenever *our own code*
  // programmatically edits the document (picking an autocomplete
  // suggestion, inserting a !mbp/!mrp/!uuid snippet, an accessory button,
  // etc.) CodeMirror resets that shadow textarea back to empty, since it
  // doesn't know the edit came from "typing". With nothing left in the
  // textarea, the next real backspace on a phone has nothing to diff
  // against, so the browser has nothing to report and delete/backspace
  // silently stops working until you tap elsewhere to move the cursor.
  // Re-seeding the shadow textarea with the real text right before the
  // cursor after any non-typed change keeps backspace working afterward.
  // ---------------------------------------------------------------------
  _syncMobileShadowInput(origin) {
    if (origin === "+input" || origin === "*compose") return;
    const cm = this.cm;
    if (cm.getOption("inputStyle") !== "textarea") return;
    if (cm.somethingSelected()) return;
    const input = cm.display && cm.display.input;
    const textarea = input && input.textarea;
    if (!textarea) return;
    const cursor = cm.getCursor();
    // Mirror the current line up to the cursor into the shadow textarea,
    // same as CodeMirror does while the user is typing normally. This is
    // deliberately kept to a single line: CodeMirror itself empties the
    // shadow textarea whenever it contains a newline (see poll() in
    // codemirror.js), so including previous lines here would immediately
    // get wiped again on the very next keystroke and defeat the fix.
    const lineText = cm.getLine(cursor.line) || "";
    const before = lineText.slice(Math.max(0, cursor.ch - 300), cursor.ch);
    textarea.value = before;
    input.prevInput = before;
    try {
      textarea.selectionStart = textarea.selectionEnd = before.length;
    } catch (e) {
      /* ignore -- some browsers throw if the textarea isn't focused/visible */
    }
  }

  showHints(force) {
    const doc = this.docs.get(this.activePath);
    const ext = doc ? doc.ext : "";
    const snippets = ext === "json" ? JSON_SNIPPETS : ext === "js" || ext === "ts" || ext === "mjs" || ext === "cjs" ? JS_SNIPPETS : null;
    const cm = this.cm;
    CodeMirror.showHint(cm, () => buildHintList(cm, snippets, false), {
      completeSingle: false,
      alignWithWord: true,
      closeOnUnfocus: true,
    });
  }

  hasState(path) {
    return this.docs.has(path);
  }

  discard(path) {
    this.docs.delete(path);
  }

  openFile(path, content, ext) {
    let entry = this.docs.get(path);
    if (!entry) {
      const doc = CodeMirror.Doc(content ?? "", modeForExt(ext));
      entry = { doc, ext };
      this.docs.set(path, entry);
    }
    this.activePath = path;
    this.cm.swapDoc(entry.doc);
    this.cm.setOption("lineWrapping", this.wrapEnabled);
    this.cm.focus();
  }

  captureActive() {
    // CodeMirror Doc objects keep their own history/state automatically;
    // nothing to snapshot manually here (kept for API compatibility).
  }

  insertText(text) {
    const cm = this.cm;
    const sel = cm.getCursor();
    cm.replaceSelection(text, "end");
    cm.focus();
  }

  toggleWrap() {
    this.wrapEnabled = !this.wrapEnabled;
    this.cm.setOption("lineWrapping", this.wrapEnabled);
    return this.wrapEnabled;
  }

  getCursorInfo() {
    const cm = this.cm;
    const pos = cm.getCursor();
    return { line: pos.line + 1, col: pos.ch + 1, length: cm.getValue().length };
  }

  undo() {
    this.cm.execCommand("undo");
    this.cm.focus();
  }

  redo() {
    this.cm.execCommand("redo");
    this.cm.focus();
  }

  indent(dir) {
    this.cm.execCommand(dir < 0 ? "indentLess" : "indentMore");
    this.cm.focus();
  }

  insertTab() {
    this.cm.execCommand("insertSoftTab");
    this.cm.focus();
  }

  moveCursor(dir) {
    const map = {
      left: "goCharLeft",
      right: "goCharRight",
      up: "goLineUp",
      down: "goLineDown",
      home: "goLineStartSmart",
      end: "goLineEnd",
    };
    const cmd = map[dir];
    if (cmd) this.cm.execCommand(cmd);
    this.cm.focus();
  }

  focus() {
    this.cm.focus();
  }

  openSearch() {
    this.cm.execCommand("find");
  }

  destroy() {
    // CodeMirror 5 has no explicit destroy API; detaching the DOM node is
    // enough to let it get garbage collected.
    if (this.container) this.container.innerHTML = "";
  }
}

window.EditorManager = EditorManager;
