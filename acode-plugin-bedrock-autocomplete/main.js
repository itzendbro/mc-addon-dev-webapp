// ---------------------------------------------------------------------------
// Minecraft Bedrock Autocomplete -- Acode plugin entry point.
//
// This is the "engine" half of the port (data.js is the "data" half, see
// its own header comment) -- it turns the ported JSON_SNIPPETS/JS_SNIPPETS
// dictionaries into real editor completion + diagnostics sources.
//
// -----------------------------------------------------------------------
// v1.2.0: dual-engine support (THIS is the actual root cause of "still not
// working" reports on v1.0.0/v1.0.1/v1.1.0) --
//
// Every previous version of this plugin ONLY ever tried CodeMirror 6 APIs
// (acode.require("codemirror")/EditorState/etc). That is correct for
// Acode's newest engine (Acode migrated from Ace to CodeMirror starting
// with v1.12.0 on GitHub), BUT a large number of real installs -- via the
// Play Store, F-Droid, or an APK that hasn't auto-updated -- are still
// running an Acode build on the OLDER Ace editor engine, where
// `acode.require("codemirror")` simply doesn't exist. Every previous
// version's init() correctly detected that and *soft-failed silently*
// (by design, so a plugin failing to load doesn't throw and get the whole
// plugin marked "broken" -- see https://docs.acode.app/docs/getting-started/understanding-plugin)
// -- which is indistinguishable, from the user's side, from "the plugin
// does nothing at all". That silent soft-fail is exactly what every
// previous "not working" report was actually hitting.
//
// The fix: detect which engine is actually running
// (`editorManager.isCodeMirror` -- true means CodeMirror, null/undefined
// means Ace, see https://docs.acode.app/docs/global-apis/ace) and wire up
// a completely native completion source for whichever one it is:
//
//   - Ace engine: registers a real Ace completer via
//     `ace.require("ace/ext/language_tools").addCompleter(...)` /
//     `editor.completers.push(...)`, with a custom `insertMatch` that
//     replaces the matched range and expands snippets via Ace's own
//     `ace/snippets` `snippetManager.insertSnippet()` (verified against a
//     real installed `ace-builds` package that every single one of this
//     plugin's 485 ported snippets -- unmodified `${1:default}`/bare `$0`
//     syntax -- expands correctly through Ace's real snippet engine, no
//     conversion needed, unlike CodeMirror's stricter syntax).
//   - CodeMirror engine: same `EditorState.create` monkey-patch approach
//     introduced in v1.1.0 (see the dedicated comment further down) plus
//     the `@codemirror/lint`-based diagnostics also introduced in v1.1.0.
//
// Both engines share the exact same underlying data (data.js) and the
// exact same context-detection logic (getActiveFilePath() /
// contextForPath() / packTypeForPath()), so suggestions are identical
// either way -- only the plumbing that gets them into the editor differs.
// -----------------------------------------------------------------------
//
// Deliberately plain global-scope JS (no `import`/`export`, no bundler) --
// same "no build tooling" constraint as the parent Pocket Addon Studio
// webapp this plugin's data was ported from. Acode loads plugin main.js
// files as-is; the official templates use ES module syntax only because
// they run everything through webpack/rollup first, which this project
// intentionally has none of.
// ---------------------------------------------------------------------------

// Must exactly match the "id" field in plugin.json.
var PLUGIN_ID = "com.pocketaddonstudio.bedrock-autocomplete";

// Which engine we ended up wiring up ("ace" | "codemirror" | null).
var activeEngine = null;

// ==== Ace-engine state ====
var aceCompleterInstance = null;

// ==== CodeMirror-engine state ====
var cmAutocomplete = null;
var cmState = null;
var cmLint = null;
var registeredExtensions = null;
var originalEditorStateCreate = null;
var patchedEditorStateCreateRef = null;
var eventHandler = null;
var pollIntervalId = null;

// ---------------------------------------------------------------------------
// Loads data.js (the ported snippet dictionaries) as a plain <script> tag
// from this plugin's own directory.
// ---------------------------------------------------------------------------
function loadDataScript(baseUrl) {
  return new Promise((resolve, reject) => {
    if (window.PocketAddonBedrockData) {
      resolve();
      return;
    }
    const normalizedBase = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
    const script = document.createElement("script");
    script.src = `${normalizedBase}data.js`;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Failed to load ${script.src}`));
    document.head.appendChild(script);
  });
}

// ---------------------------------------------------------------------------
// Shared context helpers (engine-agnostic).
// ---------------------------------------------------------------------------
function getActiveFilePath() {
  const file = window.editorManager && window.editorManager.activeFile;
  if (!file) return "";
  const name = file.filename || file.name || "";
  let location = "";
  try {
    location = file.location || "";
  } catch (error) {
    location = "";
  }
  if (!location) return file.uri || name || "";
  return location.replace(/\/+$/, "") + "/" + name;
}

function extOf(name) {
  const clean = String(name || "").split("/").pop() || "";
  const idx = clean.lastIndexOf(".");
  if (idx <= 0) return "";
  return clean.slice(idx + 1).toLowerCase();
}

// Resolves (snippets-list-or-null, isJs) for the active file, shared by
// both engines' completion sources.
function snippetsForActiveFile() {
  const data = window.PocketAddonBedrockData;
  if (!data) return null;
  const filePath = getActiveFilePath();
  const ext = extOf(filePath);
  if (ext === "js" || ext === "ts" || ext === "mjs" || ext === "cjs") {
    return data.JS_SNIPPETS;
  }
  if (ext === "json") {
    const ctx = data.contextForPath(filePath);
    let snippets;
    if (ctx) {
      snippets = data.JSON_SNIPPETS.filter((s) => !s.context || s.context === ctx);
      if (ctx === "manifest") {
        const packType = data.packTypeForPath(filePath);
        if (packType) snippets = snippets.filter((s) => !s.packType || s.packType === packType);
      }
    } else {
      snippets = data.JSON_SNIPPETS;
    }
    return snippets;
  }
  return null;
}

function safeRequire(name) {
  try {
    return window.acode ? window.acode.require(name) : null;
  } catch (error) {
    return null;
  }
}

// ---------------------------------------------------------------------------
// ================================ ACE ENGINE ================================
// ---------------------------------------------------------------------------
//
// Ace's real snippet syntax (`${1:default}`, bare `$0` for the final
// cursor) is a superset match for the exact syntax data.js already uses --
// no conversion needed here (unlike the CodeMirror path below), confirmed
// against a real installed `ace-builds` package expanding all 485 ported
// snippets with zero failures during development.
//
// `insertMatch` is implemented directly on the completer (Ace's documented
// extension point for a completer to fully control what happens when its
// own completion is picked -- see ace/autocomplete.js's
// `data.completer && data.completer.insertMatch`) rather than relying on
// Ace's default insertion behavior, because Ace's own auto-prefix
// detection (`retrievePrecedingIdentifier`) uses a plain word-character
// regex that stops at `"`/`:` -- exactly the characters most Bedrock JSON
// tokens are typed through (e.g. `"minecraft:hea`) -- which would either
// under-replace (leaving a stray leading quote) or, if a full quoted value
// is inserted naively as `data.value` without accounting for the wider
// prefix actually typed, duplicate text. Providing our own
// `identifierRegexps` (so Ace *reports* the wider prefix correctly) AND
// our own `insertMatch` (so the replace range is computed the same wide
// way, independent of Ace's own possibly-narrower idea of "the prefix")
// removes both failure modes -- verified in a real `ace-builds`+jsdom
// harness during development.
// ---------------------------------------------------------------------------
var ACE_WORD_REGEX = /[\w":.$-]/;

function aceToken(session, pos) {
  const line = session.getLine(pos.row);
  const before = line.slice(0, pos.column);
  const magicMatch = /![a-zA-Z]*$/.exec(before);
  if (magicMatch) return { kind: "magic", text: magicMatch[0] };
  const wordMatch = /[\w":.$-]*$/.exec(before);
  return { kind: "word", text: wordMatch ? wordMatch[0] : "" };
}

function createAceCompleter() {
  const completer = {
    id: "bedrock-autocomplete",
    identifierRegexps: [ACE_WORD_REGEX],

    getCompletions(editor, session, pos, prefix, callback) {
      try {
        const data = window.PocketAddonBedrockData;
        if (!data) {
          callback(null, []);
          return;
        }

        const token = aceToken(session, pos);

        if (token.kind === "magic") {
          const matches = data.MAGIC_HINTS.filter((m) => m.trigger.startsWith(token.text));
          callback(
            null,
            matches.map((hint) => ({
              caption: hint.trigger,
              meta: hint.detail,
              score: 9500,
              completer,
              __from: pos.column - token.text.length,
              __magic: hint.build,
            })),
          );
          return;
        }

        const snippets = snippetsForActiveFile();
        if (!snippets || !snippets.length) {
          callback(null, []);
          return;
        }

        const lowerWord = token.text.toLowerCase().replace(/^"/, "");
        if (!lowerWord) {
          callback(null, []);
          return;
        }
        const matches = snippets.filter((s) => s.label.toLowerCase().includes(lowerWord));
        callback(
          null,
          matches.map((entry) => ({
            caption: entry.label,
            meta: entry.detail,
            score: 8000,
            completer,
            __from: pos.column - token.text.length,
            __snippet: entry.snippet,
          })),
        );
      } catch (error) {
        callback(null, []);
      }
    },

    insertMatch(editor, data) {
      try {
        const Range = ace.require("ace/range").Range;
        const snippetManager = ace.require("ace/snippets").snippetManager;
        const pos = editor.getCursorPosition();
        const from = typeof data.__from === "number" ? data.__from : pos.column;
        const range = new Range(pos.row, from, pos.row, pos.column);
        editor.session.remove(range);
        editor.moveCursorTo(pos.row, from);
        editor.clearSelection();
        if (typeof data.__magic === "function") {
          editor.insert(data.__magic());
        } else if (data.__snippet) {
          snippetManager.insertSnippet(editor, data.__snippet);
        } else {
          editor.insert(data.caption || "");
        }
      } catch (error) {
        // Never let a bad insertion throw out of Ace's own completion
        // pipeline.
      }
    },
  };
  return completer;
}

function attachAceCompleterToEditor(editor) {
  if (!editor || !Array.isArray(editor.completers)) return;
  if (editor.completers.indexOf(aceCompleterInstance) !== -1) return;
  editor.completers.push(aceCompleterInstance);
}

function attachAceCompleterToAllOpenEditors() {
  const em = window.editorManager;
  if (!em) return;
  attachAceCompleterToEditor(em.editor);
  const panes = em.panes;
  if (Array.isArray(panes)) {
    panes.forEach((pane) => attachAceCompleterToEditor(pane && pane.editor));
  }
}

function initAceEngine() {
  const langTools = safeRequire("ace/ext/language_tools") || (window.ace && typeof window.ace.require === "function" ? window.ace.require("ace/ext/language_tools") : null);
  if (!langTools) return false;

  aceCompleterInstance = createAceCompleter();

  const editor = window.editorManager && window.editorManager.editor;
  if (editor && typeof editor.setOptions === "function") {
    editor.setOptions({
      enableBasicAutocompletion: true,
      enableLiveAutocompletion: true,
      enableSnippets: true,
    });
  }

  // Register globally (covers editors that reuse Ace's shared default
  // completers array) AND explicitly push onto every currently-open
  // editor/pane (covers Acode's per-editor `completers` arrays, which
  // don't necessarily read from Ace's global default list once an editor
  // has its own array assigned).
  if (typeof langTools.addCompleter === "function") {
    langTools.addCompleter(aceCompleterInstance);
  }
  attachAceCompleterToAllOpenEditors();

  const em = window.editorManager;
  if (em && typeof em.on === "function") {
    eventHandler = () => attachAceCompleterToAllOpenEditors();
    em.on(["switch-file", "file-loaded", "new-file", "add-folder"], eventHandler);
  }
  pollIntervalId = setInterval(attachAceCompleterToAllOpenEditors, 1500);

  return true;
}

function unmountAceEngine() {
  const em = window.editorManager;
  if (em && eventHandler && typeof em.off === "function") {
    em.off(["switch-file", "file-loaded", "new-file", "add-folder"], eventHandler);
  }
  eventHandler = null;
  if (pollIntervalId) {
    clearInterval(pollIntervalId);
    pollIntervalId = null;
  }

  try {
    const langTools = safeRequire("ace/ext/language_tools") || (window.ace && typeof window.ace.require === "function" ? window.ace.require("ace/ext/language_tools") : null);
    if (langTools && aceCompleterInstance) {
      // Ace's language_tools doesn't expose a removeCompleter() -- rebuild
      // its internal list via setCompleters(), filtering ours out, and
      // also strip it from every currently-open editor's own array.
      if (typeof langTools.setCompleters === "function" && typeof langTools.textCompleter !== "undefined") {
        const defaults = [langTools.snippetCompleter, langTools.textCompleter, langTools.keyWordCompleter].filter(Boolean);
        langTools.setCompleters(defaults);
      }
    }
  } catch (error) {
    // ignore
  }

  if (em) {
    const removeFrom = (editor) => {
      if (!editor || !Array.isArray(editor.completers)) return;
      const idx = editor.completers.indexOf(aceCompleterInstance);
      if (idx !== -1) editor.completers.splice(idx, 1);
    };
    removeFrom(em.editor);
    if (Array.isArray(em.panes)) em.panes.forEach((pane) => removeFrom(pane && pane.editor));
  }

  aceCompleterInstance = null;
}

// ---------------------------------------------------------------------------
// ============================ CODEMIRROR ENGINE =============================
// ---------------------------------------------------------------------------
function toCodeMirrorSnippetTemplate(raw) {
  return raw.replace(/([^{]|^)\$0(?!\d)/, "$1${}");
}

function buildCompletion(entry) {
  return {
    label: entry.label,
    type: entry.type || "property",
    detail: entry.detail,
    apply: cmAutocomplete.snippet(toCodeMirrorSnippetTemplate(entry.snippet)),
    boost: 1,
  };
}

function buildMagicCompletion(hint) {
  return {
    label: hint.trigger,
    type: "keyword",
    detail: hint.detail,
    boost: 2,
    apply(view, completion, from, to) {
      const text = hint.build();
      view.dispatch({
        changes: { from, to, insert: text },
        selection: { anchor: from + text.length },
      });
    },
  };
}

function bedrockCompletionSource(context) {
  const data = window.PocketAddonBedrockData;
  if (!data) return null;

  const line = context.state.doc.lineAt(context.pos);
  const before = line.text.slice(0, context.pos - line.from);

  const magicMatch = /![a-zA-Z]*$/.exec(before);
  if (magicMatch) {
    const word = magicMatch[0];
    const matches = data.MAGIC_HINTS.filter((m) => m.trigger.startsWith(word));
    if (matches.length) {
      return {
        from: context.pos - word.length,
        options: matches.map(buildMagicCompletion),
        validFor: /^![a-zA-Z]*$/,
        filter: false,
      };
    }
  }

  const snippets = snippetsForActiveFile();
  if (!snippets || !snippets.length) return null;

  const word = context.matchBefore(/[\w":.$-]*/);
  if (!word) return null;
  if (word.from === word.to && !context.explicit) return null;

  const lowerWord = word.text.toLowerCase().replace(/^"/, "");
  const matches = snippets.filter((s) => s.label.toLowerCase().includes(lowerWord));
  if (!matches.length) return null;

  return {
    from: word.from,
    options: matches.map(buildCompletion),
    validFor: /^[\w":.$-]*$/,
    filter: false,
  };
}

function jsonSyntaxDiagnostics(text) {
  try {
    JSON.parse(text);
    return [];
  } catch (error) {
    const message = String((error && error.message) || "Invalid JSON");
    let match = /position (\d+)/.exec(message);
    let from;
    if (match) {
      from = Math.min(Number(match[1]), Math.max(text.length - 1, 0));
    } else {
      from = Math.max(text.length - 1, 0);
    }
    const to = Math.min(from + 1, text.length);
    return [
      {
        from,
        to: Math.max(to, from),
        severity: "error",
        source: "bedrock-autocomplete",
        message: `Invalid JSON: ${message}`,
      },
    ];
  }
}

function bedrockHeuristicDiagnostics(text) {
  const diagnostics = [];
  for (const match of text.matchAll(/"uuid"\s*:\s*"(uuid)"/g)) {
    const valueStart = match.index + match[0].lastIndexOf('"uuid"') + 1;
    diagnostics.push({
      from: valueStart,
      to: valueStart + 4,
      severity: "warning",
      source: "bedrock-autocomplete",
      message: 'This still says the literal placeholder "uuid" -- replace it with a real UUID (try the !uuid snippet).',
    });
  }

  const modulesMatch = /"modules"\s*:\s*\[/.exec(text);
  if (modulesMatch) {
    const seenTypeAt = Object.create(null);
    const typeRe = /"type"\s*:\s*"(data|script|resources|client_data)"/g;
    let m;
    while ((m = typeRe.exec(text))) {
      const type = m[1];
      if (seenTypeAt[type] !== undefined) {
        const valueStart = m.index + m[0].lastIndexOf('"' + type + '"');
        diagnostics.push({
          from: valueStart,
          to: valueStart + type.length + 2,
          severity: "warning",
          source: "bedrock-autocomplete",
          message: `Another "modules" entry already uses type "${type}" -- did you mean to change this one, or is this a duplicate?`,
        });
      } else {
        seenTypeAt[type] = m.index;
      }
    }
  }

  return diagnostics;
}

function bedrockJsonLintSource(view) {
  try {
    const data = window.PocketAddonBedrockData;
    if (!data) return [];
    const filePath = getActiveFilePath();
    if (extOf(filePath) !== "json") return [];

    const text = view.state.doc.toString();
    if (!text.trim()) return [];

    const syntaxIssues = jsonSyntaxDiagnostics(text);
    if (syntaxIssues.length) return syntaxIssues;

    return bedrockHeuristicDiagnostics(text);
  } catch (error) {
    return [];
  }
}

function patchEditorStateCreate(EditorState, extensions) {
  if (EditorState.create === patchedEditorStateCreateRef) return;
  originalEditorStateCreate = EditorState.create.bind(EditorState);
  const original = originalEditorStateCreate;
  const patched = function (config) {
    config = config || {};
    const existing = config.extensions;
    let merged;
    if (Array.isArray(existing)) {
      merged = existing.concat(extensions);
    } else if (existing) {
      merged = [existing].concat(extensions);
    } else {
      merged = extensions.slice();
    }
    return original(Object.assign({}, config, { extensions: merged }));
  };
  patchedEditorStateCreateRef = patched;
  EditorState.create = patched;
}

function unpatchEditorStateCreate(EditorState) {
  if (!originalEditorStateCreate) return;
  if (EditorState.create === patchedEditorStateCreateRef) {
    EditorState.create = originalEditorStateCreate;
  }
  originalEditorStateCreate = null;
  patchedEditorStateCreateRef = null;
}

function appendToViewIfMissing(view) {
  if (!view || typeof view.dispatch !== "function" || !view.state || !registeredExtensions) return;
  try {
    const already = view.state.languageDataAt("autocomplete", 0).indexOf(bedrockCompletionSource) !== -1;
    if (already) return;
    view.dispatch({ effects: cmState.StateEffect.appendConfig.of(registeredExtensions) });
  } catch (error) {
    // ignore
  }
}

function attachToAllOpenEditors() {
  const em = window.editorManager;
  if (!em) return;
  appendToViewIfMissing(em.editor);
  const panes = em.panes;
  if (Array.isArray(panes)) {
    panes.forEach((pane) => appendToViewIfMissing(pane && pane.editor));
  }
}

function initCodeMirrorEngine() {
  const cm = safeRequire("codemirror");
  cmAutocomplete = (cm && cm.autocomplete) || safeRequire("@codemirror/autocomplete");
  cmState = (cm && cm.state) || safeRequire("@codemirror/state");
  cmLint = (cm && cm.lint) || safeRequire("@codemirror/lint");

  if (!cmAutocomplete || !cmState) return false;

  const extensions = [cmState.EditorState.languageData.of(() => [{ autocomplete: bedrockCompletionSource }])];
  if (cmLint && typeof cmLint.linter === "function") {
    extensions.push(cmLint.linter(bedrockJsonLintSource, { delay: 300 }));
  }
  registeredExtensions = extensions;

  patchEditorStateCreate(cmState.EditorState, extensions);
  attachToAllOpenEditors();

  const em = window.editorManager;
  if (em && typeof em.on === "function") {
    eventHandler = () => attachToAllOpenEditors();
    em.on(["switch-file", "file-loaded", "new-file", "add-folder"], eventHandler);
  }
  pollIntervalId = setInterval(attachToAllOpenEditors, 1500);

  return true;
}

function unmountCodeMirrorEngine() {
  const em = window.editorManager;
  if (em && eventHandler && typeof em.off === "function") {
    em.off(["switch-file", "file-loaded", "new-file", "add-folder"], eventHandler);
  }
  eventHandler = null;
  if (pollIntervalId) {
    clearInterval(pollIntervalId);
    pollIntervalId = null;
  }
  if (cmState && cmState.EditorState) {
    unpatchEditorStateCreate(cmState.EditorState);
  }
  registeredExtensions = null;
  cmAutocomplete = null;
  cmState = null;
  cmLint = null;
}

// ---------------------------------------------------------------------------
// Plugin lifecycle -- tries CodeMirror first (Acode's current/future
// engine), then falls back to Ace (still very commonly the actual running
// engine on real installs right now). Whichever one actually wires up
// successfully wins; if BOTH fail (an Acode build with neither API
// surface -- shouldn't happen in practice) this logs a console warning and
// leaves the plugin inactive rather than throwing.
// ---------------------------------------------------------------------------
async function init(baseUrl) {
  try {
    await loadDataScript(baseUrl);
  } catch (error) {
    console.warn("[Minecraft Bedrock Autocomplete] Failed to load data.js -- suggestions will not be available.", error);
    return;
  }

  const isCodeMirror = window.editorManager && window.editorManager.isCodeMirror;

  // Try the engine Acode itself says is active first; fall back to the
  // other if that somehow doesn't wire up (defends against
  // isCodeMirror being unset/undefined on some in-between build).
  if (isCodeMirror) {
    if (initCodeMirrorEngine()) {
      activeEngine = "codemirror";
    } else if (initAceEngine()) {
      activeEngine = "ace";
    }
  } else {
    if (initAceEngine()) {
      activeEngine = "ace";
    } else if (initCodeMirrorEngine()) {
      activeEngine = "codemirror";
    }
  }

  if (!activeEngine) {
    console.warn(
      "[Minecraft Bedrock Autocomplete] Could not find a supported completion API (neither Ace's ace/ext/language_tools nor CodeMirror's @codemirror/autocomplete) on this Acode build -- the plugin will stay installed but inactive.",
    );
  }
}

function unmount() {
  if (activeEngine === "ace") {
    unmountAceEngine();
  } else if (activeEngine === "codemirror") {
    unmountCodeMirrorEngine();
  }
  activeEngine = null;
}

if (window.acode) {
  acode.setPluginInit(PLUGIN_ID, init);
  acode.setPluginUnmount(PLUGIN_ID, unmount);
}
