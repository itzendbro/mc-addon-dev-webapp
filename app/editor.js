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
      // Line numbers removed entirely (not just hidden). CodeMirror renders
      // the gutter as a non-editable div interleaved between every line
      // inside the same editable surface, which is what made mobile
      // backspace-at-start-of-line and native text selection unreliable
      // (the OS/keyboard's caret & selection logic gets confused crossing
      // those non-editable boundaries) -- broadening the upstream
      // Android-only workaround for this wasn't enough to fix it on every
      // device, so removing the gutter altogether is the reliable fix.
      lineNumbers: false,
      lineWrapping: this.wrapEnabled,
      indentUnit: 4,
      tabSize: 4,
      indentWithTabs: false,
      styleActiveLine: true,
      matchBrackets: true,
      autoCloseBrackets: true,
      highlightSelectionMatches: { showToken: false, annotateScrollbar: false },
      // Deliberately NOT overriding inputStyle here. CodeMirror already
      // auto-selects "contenteditable" on touch devices and "textarea" on
      // desktop, and that default is the right choice: contenteditable
      // mode edits the real, visible, selectable text directly, which is
      // what gives proper native long-press "select word", drag-to-select
      // and reliable OS-level backspace/delete on phones. Forcing
      // "textarea" mode (an earlier attempt at this) hides the real text
      // behind an invisible synthetic <textarea> and disables native
      // selection entirely to implement its own mouse-based selection --
      // which broke long-press selection and made backspace unreliable on
      // real devices, even though it looked fine in a desktop simulation.
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
      this._scheduleLint();
    });
    this.cm.on("cursorActivity", () => {
      if (this.activePath && this.opts.onCursor) {
        this.opts.onCursor(this.activePath, this.getCursorInfo());
      }
    });

    // ---- Syntax-error highlighting ("red squiggly", tap for message) -----
    // See app/lint.js for the actual JSON/JS syntax checking. There's no
    // mouse hover on a phone, so instead of a hover tooltip (the desktop
    // convention this is modeled after -- VS Code's built-in diagnostics /
    // the Error Lens extension) tapping directly on a squiggly shows a
    // small popup with the message; tapping anywhere else dismisses it.
    // Marks are plain CodeMirror TextMarkers tagged with a `pas-lint`
    // property so they're easy to find-and-clear without touching markers
    // from other features (search highlighting, matching brackets, ...).
    this._lintTimer = null;
    this._lintTooltip = null;
    this.cm.getWrapperElement().addEventListener("click", (e) => this._onEditorTap(e));
  }

  _onEditorTap(e) {
    this._hideLintTooltip();
    const target = e.target;
    if (!target || !target.classList || !target.classList.contains("cm-lint-squiggly")) return;
    const cm = this.cm;
    const pos = cm.coordsChar({ left: e.clientX, top: e.clientY }, "window");
    const marks = cm.findMarksAt(pos).filter((m) => m.pasLint);
    // findMarksAt can miss a mark when the tap lands exactly on its right
    // edge (a one-past-the-end position isn't "at" the mark in CodeMirror's
    // definition) -- which happens a lot on a touch target that's often
    // only a character or two wide. Falling back to marks touching either
    // side of the tapped column covers that without ever picking up an
    // unrelated mark on a different line.
    const all = marks.length ? marks : cm.findMarks({ line: pos.line, ch: Math.max(0, pos.ch - 1) }, { line: pos.line, ch: pos.ch + 1 }).filter((m) => m.pasLint);
    if (!all.length) return;
    e.stopPropagation();
    this._showLintTooltip(target, all[0].pasLintMessage);
  }

  _showLintTooltip(anchorEl, message) {
    this._hideLintTooltip();
    const tip = document.createElement("div");
    tip.className = "cm-lint-tooltip";
    tip.textContent = message;
    document.body.appendChild(tip);
    const rect = anchorEl.getBoundingClientRect();
    const wrapperRect = this.container.getBoundingClientRect();
    // Clamp horizontally so the tooltip never spills off the left/right
    // edge of the editor on a narrow phone screen.
    let left = rect.left;
    const maxLeft = wrapperRect.right - tip.offsetWidth - 8;
    left = Math.max(wrapperRect.left + 8, Math.min(left, Math.max(maxLeft, wrapperRect.left + 8)));
    tip.style.left = `${left}px`;
    tip.style.top = `${rect.bottom + 4}px`;
    requestAnimationFrame(() => tip.classList.add("is-visible"));
    this._lintTooltip = tip;
  }

  _hideLintTooltip() {
    if (!this._lintTooltip) return;
    const tip = this._lintTooltip;
    this._lintTooltip = null;
    tip.remove();
  }

  _scheduleLint() {
    clearTimeout(this._lintTimer);
    // A deliberately short debounce -- unlike the autocomplete hint list
    // (which does real DOM work per keystroke and was the actual root
    // cause of a past mobile composition bug, see the comment on
    // _maybeAutocomplete below), re-linting is cheap (a single parse
    // attempt over the whole doc, no popup/DOM churn until something is
    // actually tapped) so there's no need for the same caution here -- but
    // it's still debounced rather than run synchronously on every
    // keystroke so a fast typist doesn't re-parse the whole file after
    // every single character.
    this._lintTimer = setTimeout(() => this._relint(), 250);
  }

  _relint() {
    const cm = this.cm;
    const doc = this.docs.get(this.activePath);
    const ext = doc ? doc.ext : "";
    const linter = typeof lintForExt === "function" ? lintForExt(ext) : null;
    // Always clear old marks first, even if there's no linter for this file
    // type (or the doc is now empty) -- otherwise switching from a .json
    // tab with an error straight to a .txt tab would leave stale squigglies
    // rendered against the wrong document.
    this._clearLintMarks();
    this._hideLintTooltip();
    if (!linter) return;
    let issues;
    try {
      issues = linter(cm.getValue()) || [];
    } catch (e) {
      // A bug in the linter itself (or an input it can't handle) should
      // never take down the editor -- silently skip highlighting for this
      // pass rather than throwing out of a CodeMirror event handler.
      issues = [];
    }
    for (const issue of issues) {
      if (!issue || !issue.from || !issue.to) continue;
      const marker = cm.markText(issue.from, issue.to, {
        className: `cm-lint-squiggly cm-lint-squiggly-${issue.severity || "error"}`,
      });
      marker.pasLint = true;
      marker.pasLintMessage = issue.message;
    }
  }

  _clearLintMarks() {
    for (const marker of this.cm.getAllMarks()) {
      if (marker.pasLint) marker.clear();
    }
  }

  _maybeAutocomplete(changeObj) {
    if (!changeObj) return;
    // Real typing comes in as "+input" on desktop keyboards. Phone
    // on-screen keyboards commit each edit (a whole composed word, or a
    // single character on simple keyboards) through the same "+input"
    // origin once CodeMirror reads it back out of the editable DOM -- the
    // difference is it happens once per committed IME composition instead
    // of on every physical keystroke, since that's how on-screen
    // keyboards/autocorrect fundamentally work. "*compose" is also
    // handled here for keyboards/browsers that tag in-progress edits that
    // way, so the hint list refreshes as soon as CodeMirror sees them.
    if (changeObj.origin !== "+input" && changeObj.origin !== "*compose") return;
    const text = changeObj.text && changeObj.text[changeObj.text.length - 1];
    if (!text) return;
    // Only trigger on word-ish characters / quote / colon / bang so we don't
    // spam a hint popup on every keystroke (e.g. spaces, newlines).
    if (!/[\w":!.$-]/.test(text.slice(-1))) return;
    clearTimeout(this._hintTimer);
    this._hintTimer = setTimeout(() => this.showHints(), 30);
  }

  showHints(force) {
    const doc = this.docs.get(this.activePath);
    const ext = doc ? doc.ext : "";
    const snippets = this._snippetsForActiveFile(ext);
    const cm = this.cm;
    CodeMirror.showHint(cm, () => buildHintList(cm, snippets, false), {
      completeSingle: false,
      alignWithWord: true,
      closeOnUnfocus: true,
    });
  }

  // Picks the autocomplete list for the currently open file: JS/TS files
  // only ever see the scripting API snippets, and JSON files are further
  // narrowed down by the file's path/name (manifest.json only gets manifest
  // tags, an entities/*.json file only gets entity component tags, etc, via
  // `contextForPath` in mcCompletions.js) so unrelated Bedrock JSON tags
  // don't clutter every file. A JSON file whose path/name doesn't match any
  // recognised convention gets NO Bedrock-specific suggestions (same as a
  // plain .txt file) rather than falling back to the full, unfiltered
  // ~90-entry JSON_SNIPPETS list -- that fallback used to dump all 90 tags
  // into every unrecognised file (e.g. the literal default "new_file.json"
  // name the New File dialog pre-fills), which meant every matching
  // keystroke rebuilt and re-rendered up to 60 popup rows while the phone's
  // on-screen keyboard was still actively composing that same keystroke.
  // That's exactly the kind of extra synchronous DOM work that can jostle
  // an in-flight Android IME composition and produce the "backspace/typing
  // stops registering, old text reappears/sticks" symptoms -- and it only
  // ever affected non-manifest.json files, since manifest.json's small
  // filtered list never triggered that heavier path. Within manifest.json
  // specifically, entries additionally tagged with `packType: "bp"`/`"rp"`
  // (e.g. the script module/dependency tags, which only make sense in a
  // Behavior Pack manifest, or `raytraced`/`subpacks`, which are Resource
  // Pack only) are further filtered using `packTypeForPath` -- the nearest
  // ancestor folder named like a BP/RP folder (see mcCompletions.js) -- so
  // a manifest inside a "MyAddon_RP" folder no longer suggests
  // behavior-pack-only script module snippets, and vice versa. Untagged
  // manifest entries (header, uuid, version, ...) are shared by both pack
  // types and always shown.
  _snippetsForActiveFile(ext) {
    if (ext === "js" || ext === "ts" || ext === "mjs" || ext === "cjs") return JS_SNIPPETS;
    if (ext !== "json") return null;
    const ctx = contextForPath(this.activePath);
    if (!ctx) return null;
    let list = JSON_SNIPPETS.filter((s) => !s.context || s.context === ctx);
    if (ctx === "manifest") {
      const packType = packTypeForPath(this.activePath);
      if (packType) list = list.filter((s) => !s.packType || s.packType === packType);
    }
    return list;
  }

  hasState(path) {
    return this.docs.has(path);
  }

  discard(path) {
    this.docs.delete(path);
  }

  // Overwrites the content of a (possibly not currently active/open) doc,
  // e.g. after running the "Format JSON" action from the file explorer's
  // "..." menu on a file that isn't the one currently open in the editor.
  // If the file has never been opened this session there's no CodeMirror
  // Doc for it yet -- the caller is expected to have already written the
  // new content straight into the VFS in that case, so this is a no-op.
  setContent(path, content) {
    const entry = this.docs.get(path);
    if (!entry) return;
    entry.doc.setValue(content);
    // Doc.setValue() always tags its change with origin "setValue", which
    // the "change" handler above deliberately ignores (same as a doc's
    // very first load) -- so it never reaches _scheduleLint() on its own.
    // Only bother re-linting here if this doc is the one currently showing
    // in the editor; a background tab's stale marks will get cleared and
    // recomputed for free the next time it's switched to, via openFile().
    if (path === this.activePath) this._scheduleLint();
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
    this._refreshWhenVisible();
    this.cm.focus();
    this._hideLintTooltip();
    this._relint();
  }

  // The editor's container starts out `display: none` (the empty-state
  // screen is shown first, before any file is open). CodeMirror measures
  // character/line dimensions from the live DOM, and a `display: none`
  // element reports zero width/height for all of those measurements. If we
  // never re-measure after the container becomes visible, CodeMirror's
  // internal view stays stuck exactly where it was at construction time
  // (an empty, zero-size view), which is why the very first file you open
  // looks populated but silently can't be typed in or backspaced at all --
  // every edit gets computed against that stale zero-size layout and
  // dropped. Calling refresh() re-measures against the now-visible
  // container, but that only works once the browser has actually finished
  // laying out the display:block change, so we retry across a couple of
  // animation frames rather than assuming a single frame is always enough
  // (timing here can vary across phones/browsers).
  _refreshWhenVisible(attempt) {
    this.cm.refresh();
    const n = attempt || 0;
    if (n >= 4) return;
    requestAnimationFrame(() => this._refreshWhenVisible(n + 1));
  }

  // Called by the app shell right after it flips the editor container from
  // display:none to display:block (or resizes it), so CodeMirror can
  // re-measure its layout against the now-visible/resized DOM.
  refresh() {
    this._refreshWhenVisible();
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
    clearTimeout(this._lintTimer);
    this._hideLintTooltip();
    // CodeMirror 5 has no explicit destroy API; detaching the DOM node is
    // enough to let it get garbage collected.
    if (this.container) this.container.innerHTML = "";
  }
}

window.EditorManager = EditorManager;
