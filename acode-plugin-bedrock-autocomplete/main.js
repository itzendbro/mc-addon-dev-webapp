// ---------------------------------------------------------------------------
// Minecraft Bedrock Autocomplete -- Acode plugin entry point.
//
// This is the "engine" half of the port (data.js is the "data" half, see
// its own header comment) -- it turns the ported JSON_SNIPPETS/JS_SNIPPETS
// dictionaries into a real @codemirror/autocomplete CompletionSource and
// keeps it attached to whatever editor view is currently active, via
// EditorState.languageData -- the same technique Acode's own built-in
// `localWordCompletions`/Emmet completions use internally (see
// acode.require("codemirror") below) -- so this plugin's Bedrock-aware
// suggestions show up in Acode's normal completion popup (arrow keys to
// navigate, Tab/Enter to accept, Ctrl-Space to force-open) right alongside
// Acode's other completion sources, rather than needing a separate/
// competing popup UI.
//
// Snippet placeholders (the exact ${1:default}/$0 syntax already used by
// every entry in data.js -- see mcCompletions.js in the parent webapp repo
// for why that syntax was chosen) are converted at call time into real
// CodeMirror 6 `snippet()` completions, so Tab/Shift-Tab actually walks
// through each placeholder in order and the whole thing behaves exactly
// like a native VS Code snippet, not just a static text insert.
//
// -----------------------------------------------------------------------
// IMPORTANT lesson learned from v1.0.0 (didn't work at all -- fixed here):
//
// Acode's editor does NOT keep one long-lived CodeMirror state that
// extensions get permanently folded into. Every time a file is opened or
// switched (see Acode's own src/lib/editorManager.js -- applyFileToEditor()
// -> editor.setState(...)), Acode builds a *brand new* EditorState from
// scratch and swaps it in wholesale. Any extension appended via
// StateEffect.appendConfig against the CURRENT state (which is what
// v1.0.0 did, once, at plugin-init time) is silently gone the instant the
// user opens or switches to any file afterwards -- there was never a
// moment where suggestions could have worked beyond whatever single file
// happened to already be open when the plugin loaded.
//
// v1.0.0 also tried registering via acode.require("editorLanguages"), but
// that API's register() adds a *language mode* (matched against a file's
// extension to decide which single mode "owns" a file) -- registering one
// with an empty extensions list, as v1.0.0 did to sneak an extension in
// without actually being a real language, means it can never be selected
// as any file's mode, so its extension is never actually applied to
// anything, ever.
//
// The fix: re-append the extension to whatever the *current* active
// editor view is, every time a file is loaded/switched/created (via
// editorManager's own documented event list -- see
// https://docs.acode.app/docs/global-apis/editor-manager), AND on a
// cheap periodic safety-net interval, since not every way Acode can swap
// in a fresh state necessarily fires one of those events (e.g. a pane
// being split, or an Acode version emitting slightly different event
// names than expected). appendIfMissing() below is a no-op (just one
// cheap languageDataAt() lookup) whenever the extension is already
// present, so the interval costs effectively nothing in the common case.
// -----------------------------------------------------------------------
//
// Deliberately plain global-scope JS (no `import`/`export`, no bundler) --
// same "no build tooling" constraint as the parent Pocket Addon Studio
// webapp this plugin's data was ported from. Acode loads plugin main.js
// files as-is; the official templates use ES module syntax only because
// they run everything through webpack/rollup first, which this project
// intentionally has none of.
// ---------------------------------------------------------------------------

// Must exactly match the "id" field in plugin.json -- kept as a plain
// hardcoded constant (rather than importing plugin.json, which would need
// a bundler/loader) since this plugin has exactly one file that ever
// needs to know it.
var PLUGIN_ID = "com.pocketaddonstudio.bedrock-autocomplete";

// Populated during init() once acode.require("codemirror") is available.
var cmAutocomplete = null; // @codemirror/autocomplete namespace
var cmState = null; // @codemirror/state namespace

// The single extension instance kept attached to whatever editor view is
// currently active -- see the big comment above for why this has to be
// actively re-attached rather than registered once.
var registeredExtension = null;

// Bookkeeping so unmount() can cleanly undo everything this plugin set up.
var eventHandler = null;
var pollIntervalId = null;

// ---------------------------------------------------------------------------
// Loads data.js (the ported snippet dictionaries) as a plain <script> tag
// from this plugin's own directory. `baseUrl` is handed to init() by
// Acode itself (see https://docs.acode.app/docs/plugin-essentials/core-file)
// and always ends with a trailing slash per Acode's own docs/examples, but
// this defensively normalizes it just in case.
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
// Snippet field syntax -> CodeMirror 6 `snippet()` template syntax.
//
// data.js's snippets use the exact `${1:default}` / `${2:other}` / `$0`
// convention already used by the parent webapp (see mcCompletions.js's own
// header comment there) -- CodeMirror 6's own `snippet()` helper
// (@codemirror/autocomplete) expects near-identical syntax
// (`${1:default}` / `${}` for the final cursor), so the only translation
// needed is turning a *bare* trailing `$0` into `${}` (CodeMirror has no
// bare `$0` shorthand -- every field, including the final one, needs an
// explicit `${...}`). This only ever touches a `$0` NOT already preceded
// by `{` (i.e. never touches an already well-formed `${0:...}`, which none
// of these snippets use, but is harmless to guard against anyway).
// ---------------------------------------------------------------------------
function toCodeMirrorSnippetTemplate(raw) {
  return raw.replace(/([^{]|^)\$0(?!\d)/, "$1${}");
}

// Builds a single CodeMirror `Completion` object (see
// https://codemirror.net/docs/ref/#autocomplete.Completion) for one
// data.js snippet entry -- `apply` is the actual snippet-insertion
// function (from cmAutocomplete.snippet()), everything else is display
// metadata. `type` maps our own small set of type strings (property,
// keyword, function, class, type, enum) onto whatever CodeMirror ships an
// icon for already (property/keyword/function/class/type/enum are all
// real CodeMirror completion types) so no custom icon CSS is needed.
function buildCompletion(entry) {
  return {
    label: entry.label,
    type: entry.type || "property",
    detail: entry.detail,
    apply: cmAutocomplete.snippet(toCodeMirrorSnippetTemplate(entry.snippet)),
    boost: 1,
  };
}

// Same idea for the three magic triggers (!mbp/!mrp/!uuid) -- these can't
// be static snippet templates since they need to generate fresh
// UUIDs/pick a fresh manifest at insertion time, so `apply` is a plain
// function that replaces the matched `!token` range with freshly built
// text (mirroring exactly what app/editor.js's buildHintList() does for
// these same triggers in the webapp).
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

// ---------------------------------------------------------------------------
// The actual CompletionSource. Mirrors app/editor.js's buildHintList()
// logic step for step:
//   1. Magic `!token` triggers match first, regardless of language mode.
//   2. Otherwise, JSON files are narrowed to whatever `context` bucket
//      contextForPath() resolves the active file's path to (manifest,
//      entity, block, item, ...), with manifest.json further filtered by
//      packType (bp/rp) via packTypeForPath() -- exactly like the webapp.
//   3. JS/TS files always see the full scripting-API snippet list.
//   4. Anything else (an unrecognised JSON file, or a non-JSON/JS file)
//      gets no Bedrock-specific suggestions at all, same "better to show
//      nothing than the wrong 90 tags" reasoning as the webapp's own
//      comment on this exact decision.
//
// `filter: false` is set on every returned result and matching against the
// typed text is done manually (a plain case-insensitive substring test,
// same as the webapp's own buildHintList()) rather than relying on
// CodeMirror's built-in fuzzy matcher -- CodeMirror's matcher scores a
// completion's `label` against the exact text it replaces, and none of
// these labels contain the literal `"`/`:` characters that are very
// commonly part of the token being completed in JSON (e.g. typing
// `"minecraft:hea` to reach `minecraft:health`), which made the built-in
// matcher discard every real match in testing. Manual filtering sidesteps
// that mismatch entirely.
// ---------------------------------------------------------------------------
function bedrockCompletionSource(context) {
  const data = window.PocketAddonBedrockData;
  if (!data) return null;

  const line = context.state.doc.lineAt(context.pos);
  const before = line.text.slice(0, context.pos - line.from);

  // Magic !triggers work regardless of file type, same as the webapp.
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

  const filePath = getActiveFilePath();
  const ext = extOf(filePath);
  let snippets = null;
  if (ext === "js" || ext === "ts" || ext === "mjs" || ext === "cjs") {
    snippets = data.JS_SNIPPETS;
  } else if (ext === "json") {
    const ctx = data.contextForPath(filePath);
    if (ctx) {
      snippets = data.JSON_SNIPPETS.filter((s) => !s.context || s.context === ctx);
      if (ctx === "manifest") {
        const packType = data.packTypeForPath(filePath);
        if (packType) snippets = snippets.filter((s) => !s.packType || s.packType === packType);
      }
    }
  }
  if (!snippets || !snippets.length) return null;

  // Match on a fairly permissive word-ish token (letters, digits, quote,
  // colon, dot, dollar, dash) so labels like `minecraft:health` or
  // `"format_version"` still match as the user types through the quote/
  // colon characters -- same character class the webapp's own
  // buildHintList() uses for this.
  const word = context.matchBefore(/[\w":.$-]*/);
  if (!word) return null;
  if (word.from === word.to && !context.explicit) return null;

  const lowerWord = word.text.toLowerCase().replace(/^"/, "");
  const matches = snippets.filter((s) => s.label.toLowerCase().includes(lowerWord));
  if (!matches.length) return null;

  return {
    from: word.from,
    options: matches.map(buildCompletion),
    // Keep offering the same list (re-filtered manually on the next call,
    // see above) as long as the user is still typing/deleting within a
    // plain word-ish token -- avoids recomputing contextForPath() on every
    // single keystroke.
    validFor: /^[\w":.$-]*$/,
    filter: false,
  };
}

// ---------------------------------------------------------------------------
// Resolves the *active* file's path/name in a way that's resilient across
// Acode's Ace-era and CodeMirror-era plugin APIs (see
// https://docs.acode.app/docs/global-apis/editor-manager) -- prefers the
// modern `editorManager.activeFile` object's `filename`, falling back to
// `uri`/`name` for older Acode builds, and finally an empty string (which
// safely resolves to no suggestions at all via extOf()/contextForPath()
// both being empty/null-safe).
// ---------------------------------------------------------------------------
function getActiveFilePath() {
  const file = window.editorManager && window.editorManager.activeFile;
  if (!file) return "";
  return file.filename || file.name || file.uri || "";
}

function extOf(name) {
  const clean = String(name || "").split("/").pop() || "";
  const idx = clean.lastIndexOf(".");
  if (idx <= 0) return "";
  return clean.slice(idx + 1).toLowerCase();
}

function safeRequire(name) {
  try {
    return window.acode ? window.acode.require(name) : null;
  } catch (error) {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Keeps registeredExtension attached to every editor pane's CURRENT state.
// Cheap to call repeatedly: languageDataAt() is a plain lookup, and
// dispatch() is skipped entirely once the extension is already present, so
// calling this from several different triggers (events + a timer) is safe
// and never does redundant work in the common case where nothing changed.
// ---------------------------------------------------------------------------
function appendToViewIfMissing(view) {
  if (!view || typeof view.dispatch !== "function" || !view.state || !registeredExtension) return;
  try {
    const already = view.state.languageDataAt("autocomplete", 0).indexOf(bedrockCompletionSource) !== -1;
    if (already) return;
    view.dispatch({ effects: cmState.StateEffect.appendConfig.of(registeredExtension) });
  } catch (error) {
    // Never let a bad view/state (e.g. one mid-teardown) throw out of an
    // event handler or timer tick.
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

// ---------------------------------------------------------------------------
// Plugin lifecycle.
// ---------------------------------------------------------------------------
async function init(baseUrl) {
  try {
    await loadDataScript(baseUrl);
  } catch (error) {
    console.warn("[Minecraft Bedrock Autocomplete] Failed to load data.js -- suggestions will not be available.", error);
    return;
  }

  // Acode exposes the CodeMirror packages it bundles under a single
  // "codemirror" convenience module (acode.require("codemirror")) as well
  // as individually scoped names (acode.require("@codemirror/autocomplete"))
  // -- see https://docs.acode.app/docs/global-apis/acode and the PR that
  // added this (Acode-Foundation/Acode#1924). Try both so this plugin
  // keeps working across whichever naming an installed Acode build uses.
  const cm = safeRequire("codemirror");
  cmAutocomplete = (cm && cm.autocomplete) || safeRequire("@codemirror/autocomplete");
  cmState = (cm && cm.state) || safeRequire("@codemirror/state");

  if (!cmAutocomplete || !cmState) {
    // Acode's CodeMirror packages aren't exposed on this build (an old
    // Acode version, or one still on the legacy Ace engine) -- fail soft
    // rather than throwing during init, since a broken/throwing init
    // marks the whole plugin "broken" for the session (see
    // https://docs.acode.app/docs/getting-started/understanding-plugin).
    console.warn(
      "[Minecraft Bedrock Autocomplete] Could not access Acode's bundled CodeMirror packages -- this Acode build may be too old, or on the legacy Ace engine. The plugin will stay installed but inactive.",
    );
    return;
  }

  registeredExtension = cmState.EditorState.languageData.of(() => [
    { autocomplete: bedrockCompletionSource },
  ]);

  // Attach immediately to whatever's already open right now.
  attachToAllOpenEditors();

  // Re-attach every time a file is opened/switched/created -- these are
  // exactly the situations where Acode swaps in a brand new EditorState
  // that doesn't know about our extension yet (see the big comment at the
  // top of this file for why that happens).
  const em = window.editorManager;
  if (em && typeof em.on === "function") {
    eventHandler = () => attachToAllOpenEditors();
    em.on(["switch-file", "file-loaded", "new-file", "add-folder"], eventHandler);
  }

  // Safety net: some state-swap paths might not fire any of the events
  // above (a pane split, a future Acode version renaming/adding events,
  // ...), so also just check periodically. appendToViewIfMissing() is a
  // no-op whenever the extension is already attached, so this costs
  // effectively nothing.
  pollIntervalId = setInterval(attachToAllOpenEditors, 1500);
}

function unmount() {
  const em = window.editorManager;
  if (em && eventHandler && typeof em.off === "function") {
    em.off(["switch-file", "file-loaded", "new-file", "add-folder"], eventHandler);
  }
  eventHandler = null;

  if (pollIntervalId) {
    clearInterval(pollIntervalId);
    pollIntervalId = null;
  }

  registeredExtension = null;
  cmAutocomplete = null;
  cmState = null;
}

if (window.acode) {
  acode.setPluginInit(PLUGIN_ID, init);
  acode.setPluginUnmount(PLUGIN_ID, unmount);
}
