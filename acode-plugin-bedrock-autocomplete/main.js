// ---------------------------------------------------------------------------
// Minecraft Bedrock Autocomplete -- Acode plugin entry point.
//
// This is the "engine" half of the port (data.js is the "data" half, see
// its own header comment) -- it turns the ported JSON_SNIPPETS/JS_SNIPPETS
// dictionaries into a real @codemirror/autocomplete CompletionSource and a
// real @codemirror/lint JSON diagnostics source, and keeps BOTH attached to
// every editor state Acode ever creates, via EditorState.languageData / a
// linter() extension -- the same mechanism Acode's own built-in
// `localWordCompletions`/Emmet completions and LSP diagnostics use
// internally (see acode.require("codemirror") below) -- so this plugin's
// suggestions and error/warning squiggles show up in Acode's normal
// completion popup and gutter, right alongside Acode's other sources,
// rather than needing a separate/competing UI.
//
// Snippet placeholders (the exact ${1:default}/$0 syntax already used by
// every entry in data.js -- see mcCompletions.js in the parent webapp repo
// for why that syntax was chosen) are converted at call time into real
// CodeMirror 6 `snippet()` completions, so Tab/Shift-Tab actually walks
// through each placeholder in order and the whole thing behaves exactly
// like a native VS Code snippet, not just a static text insert.
//
// -----------------------------------------------------------------------
// IMPORTANT lesson learned from v1.0.0/v1.0.1 (root cause of "no
// suggestions" reports -- fixed here in v1.1.0):
//
// Acode's editor does NOT keep one long-lived CodeMirror state that
// extensions get permanently folded into. Every time a file is opened or
// switched (see Acode's own src/lib/editorManager.js --
// applyFileToEditor() -> `const state = EditorState.create({ doc, extensions
// : exts }); editor.setState(state);`), Acode builds a *brand new*
// EditorState from scratch via `EditorState.create(...)` and swaps it in
// wholesale, every single time -- there is no compartment or facet a
// plugin can reconfigure once and have it survive that. v1.0.0 registered
// via `editorLanguages.register(..., [], ...)` with an empty extensions
// list, which can never match any real file (see Acode's src/cm/modelist.ts
// -- an empty `extensions` means `extRe` is `null` and `supportsFile()`
// never returns true). v1.0.1 fixed that but only ever re-*appended* the
// extension to whatever the *already existing* active view's state was, on
// a timer/event -- which works, but has an unavoidable window (up to the
// poll interval, or however long it takes an event to fire) on every
// single file switch/open where the freshly-created state does NOT have
// the extension yet, and depended on Acode's event names not changing.
//
// v1.1.0's fix: monkey-patch `EditorState.create` itself (a plain, mutable,
// non-frozen static method shared by reference across the entire app --
// confirmed by reading and testing against the actual bundled
// @codemirror/state package Acode ships) so that literally every state
// Acode ever builds, from the very first `EditorState.create(...)` call
// onward -- including ones created before this plugin's own init() even
// finishes loading data.js, and ones created by future Acode versions that
// rename/remove the "switch-file"/"file-loaded" events entirely -- already
// has both extensions baked in from birth. This removes the race entirely
// instead of racing to patch it after the fact. The old
// event-listener/poll-based re-attachment from v1.0.1 is kept as a defense
// -in-depth fallback (in case some future Acode version stops calling
// `EditorState.create` directly, e.g. by subclassing), but the monkey-patch
// is now the primary, always-on mechanism.
// -----------------------------------------------------------------------
//
// New in v1.1.0 (see changelogs.md):
//   - The actual fix above (autocomplete now reliably works on every file,
//     not just whichever one happened to be open when the plugin loaded).
//   - Live JSON error/warning highlighting (a real `@codemirror/lint`
//     linter): flags invalid JSON syntax, and a handful of common Bedrock
//     add-on mistakes -- placeholder UUIDs left over from a snippet,
//     duplicate top-level manifest module entries, and (with low severity)
//     a manifest missing a `min_engine_version`.
//   - Context-aware is unchanged/inherent to this plugin's design (it
//     already only shows manifest/entity/block/item/... tags relevant to
//     the file you're actually in -- see bedrockCompletionSource() below)
//     but is now also reflected in the plugin's name/description.
//   - Still under 20KB total across main.js + data.js combined (well under
//     Acode's plugin size norms) and adds zero new editor lag: completions
//     are computed only when CodeMirror asks for them, and linting only
//     re-runs after Acode's own idle debounce on a real doc change.
// ---------------------------------------------------------------------------
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
var cmLint = null; // @codemirror/lint namespace (may stay null on old Acode builds; linting is optional)

// The extension(s) kept attached to every editor state -- see the big
// comment above for why this has to be baked into EditorState.create
// itself rather than registered once against a single existing state.
var registeredExtensions = null; // Extension[] -- combined completion + lint (+ nothing else)
var originalEditorStateCreate = null; // for clean unmount()
var patchedEditorStateCreateRef = null; // identity check so unmount() never removes someone else's patch

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
// Resolves the *active* file's best-effort "path" -- used only to feed
// contextForPath()/packTypeForPath() (see data.js), which only ever look
// at filename + ancestor folder *names*, never anything more specific, so
// this doesn't need to be a real absolute filesystem path -- it just needs
// to preserve the filename and however many ancestor folder names Acode
// can tell us about, in order.
//
// Acode's `EditorFile` (see its own src/lib/editorFile.js) exposes:
//   - `filename`: always just the basename (e.g. "cow.json"), never a path.
//   - `uri`: the file's on-device/SAF uri, when the file was opened from
//     disk (a brand new unsaved file has no uri yet).
//   - `location`: `Url.dirname(uri)` when available (null for a single
//     SAF "document" opened without a folder tree, or an unsaved file).
// A `location` is exactly what we need -- append the filename back onto it
// so contextForPath()'s own path-splitting logic (which expects
// ".../folder/folder/file.json") keeps working unmodified. Content:// SAF
// uris are still slash-delimited internally (see Acode's Uri.dirname()),
// so this works whether the project was opened via a real filesystem path
// or via Android's Storage Access Framework.
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
  if (!location) {
    // No known folder -- fall back to whatever uri/name we do have so a
    // manifest.json (matched purely by filename, no folder needed) still
    // works even for a file opened with no folder context at all.
    return file.uri || name || "";
  }
  return location.replace(/\/+$/, "") + "/" + name;
}

function extOf(name) {
  const clean = String(name || "").split("/").pop() || "";
  const idx = clean.lastIndexOf(".");
  if (idx <= 0) return "";
  return clean.slice(idx + 1).toLowerCase();
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
    } else {
      // No recognisable folder/filename context at all (e.g. Acode opened
      // the file with no folder info, so getActiveFilePath() only has a
      // bare filename) -- better to offer every JSON snippet than none,
      // same fallback the webapp itself documents for this exact case.
      snippets = data.JSON_SNIPPETS;
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
// New in v1.1.0: live error/warning highlighting for JSON add-on files.
//
// Two layers, both cheap (plain string/JSON.parse work, no schema
// validation library, kept intentionally lightweight):
//
//   1. Real JSON syntax errors -- delegated straight to the JS engine's
//      own JSON.parse(), which is exactly what CodeMirror's own JSON
//      language package does NOT do out of the box (it only highlights
//      syntax via a grammar, it doesn't validate). `JSON.parse`'s thrown
//      SyntaxError messages include a "position N" (V8/Android
//      WebView's JS engine) which is used to place the squiggle;
//      unrecognised message shapes still surface as a whole-document
//      warning rather than silently doing nothing.
//   2. A few extremely common, extremely easy to check for Bedrock add-on
//      mistakes that are still syntactically valid JSON so JSON.parse()
//      alone would never catch them: a UUID field left as the exact
//      literal placeholder text a couple of the JSON_SNIPPETS insert
//      ("uuid") instead of a real generated UUID, and a manifest.json
//      whose "modules" array has two entries with the exact same "type"
//      (a common copy/paste mistake when adding a second data module).
//
// Only runs on files JSON_SNIPPETS itself would apply to (any .json file
// under a recognised context, or any .json file at all as a fallback --
// mirrors bedrockCompletionSource()'s own reasoning) so this never lights
// up unrelated JSON files (like a package.json for an unrelated project)
// with Bedrock-specific warnings.
// ---------------------------------------------------------------------------
function findLineColForOffset(text, offset) {
  let line = 0;
  let col = 0;
  for (let i = 0; i < offset && i < text.length; i++) {
    if (text[i] === "\n") {
      line++;
      col = 0;
    } else {
      col++;
    }
  }
  return { line, col };
}

function jsonSyntaxDiagnostics(text) {
  try {
    JSON.parse(text);
    return [];
  } catch (error) {
    const message = String((error && error.message) || "Invalid JSON");
    // V8 (Chrome/Android WebView): "... at position N (line L column C)"
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

function findAllIndices(text, needle) {
  const indices = [];
  let idx = text.indexOf(needle);
  while (idx !== -1) {
    indices.push(idx);
    idx = text.indexOf(needle, idx + 1);
  }
  return indices;
}

function bedrockHeuristicDiagnostics(text) {
  const diagnostics = [];

  // Leftover placeholder UUID -- a couple of JSON_SNIPPETS entries in
  // data.js use the literal token "uuid" as their placeholder default
  // (e.g. `"uuid": "${1:uuid}"`) so Tab-selecting it is obvious, but it's
  // easy to accept the snippet and forget to actually replace it (or to
  // run !uuid) before saving. Flag the exact placeholder text, not any
  // real (correctly-formatted) UUID.
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

  // Duplicate manifest module types -- a very common copy/paste mistake:
  // pasting a second "data" (or "script"/"resources") module block into
  // "modules" without changing its "type". Only checked when this text
  // actually looks like it has a top-level "modules" array at all, kept
  // as a plain regex scan (not a real parse) to stay cheap and to still
  // work on documents that are mid-edit and not currently valid JSON.
  const modulesMatch = /"modules"\s*:\s*\[/.exec(text);
  if (modulesMatch) {
    const seenTypeAt = Object.create(null);
    const typeRe = /"type"\s*:\s*"(data|script|resources|client_data)"/g;
    let m;
    while ((m = typeRe.exec(text))) {
      const type = m[1];
      if (seenTypeAt[type] !== undefined) {
        const valueStart = m.index + m[0].lastIndexOf('"' + type + '"') ;
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
    if (syntaxIssues.length) {
      // A syntax error makes offsets from a "real parse" heuristic
      // unreliable/misleading (e.g. reporting a duplicate module type
      // inside what's actually unparsable JSON) -- just report the
      // syntax error itself until the document is valid JSON again.
      return syntaxIssues;
    }

    return bedrockHeuristicDiagnostics(text);
  } catch (error) {
    // A linter that throws breaks Acode's whole lint pass for every
    // other linter active on the same document (LSP, other plugins) --
    // never let an unexpected error here escape.
    return [];
  }
}

function safeRequire(name) {
  try {
    return window.acode ? window.acode.require(name) : null;
  } catch (error) {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Core fix for v1.1.0: monkey-patch EditorState.create so every state
// Acode (or any other plugin) ever builds already includes our
// completion+lint extensions, from the very first one onward. See the
// top-of-file comment for the full "why" -- in short, appending to an
// already-existing view's state (what v1.0.1 did) can never close the gap
// between "a fresh state was just created" and "our re-attach code got a
// chance to run"; patching the one shared factory function everything
// (including Acode itself) goes through removes that gap entirely.
//
// `EditorState.create` is a plain static method (not frozen, not
// read-only) on the exact same `@codemirror/state` module object Acode's
// own editorManager.js imports and calls -- acode.require("codemirror")
// hands plugins a reference to that very same module namespace object, so
// patching the method here mutates the one and only copy in memory that
// Acode's own code calls too. Confirmed via a real installed
// @codemirror/state package in a jsdom harness during development that
// `Object.getOwnPropertyDescriptor(EditorState, "create")` reports
// `{writable: true, configurable: true}`.
// ---------------------------------------------------------------------------
function patchEditorStateCreate(EditorState, extensions) {
  if (EditorState.create === patchedEditorStateCreateRef) {
    // Already patched (e.g. init() ran twice without an intervening
    // unmount) -- don't wrap our own wrapper a second time.
    return;
  }
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

// ---------------------------------------------------------------------------
// Defense-in-depth fallback (kept from v1.0.1): also directly append the
// extensions to whatever editor view(s) already exist right now, and keep
// re-checking on file events + a periodic timer. This covers the (should
// no longer happen, but costs nothing to also guard against) case of a
// state that was constructed some other way than `EditorState.create`
// -- e.g. a plugin-provided pane implementation building an EditorState
// via `new EditorState(...)`-style internals CodeMirror doesn't publicly
// expose but a future Acode version could theoretically add.
// ---------------------------------------------------------------------------
function appendToViewIfMissing(view) {
  if (!view || typeof view.dispatch !== "function" || !view.state || !registeredExtensions) return;
  try {
    const already = view.state.languageDataAt("autocomplete", 0).indexOf(bedrockCompletionSource) !== -1;
    if (already) return;
    view.dispatch({ effects: cmState.StateEffect.appendConfig.of(registeredExtensions) });
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
  cmLint = (cm && cm.lint) || safeRequire("@codemirror/lint");

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

  const extensions = [
    cmState.EditorState.languageData.of(() => [{ autocomplete: bedrockCompletionSource }]),
  ];

  if (cmLint && typeof cmLint.linter === "function") {
    extensions.push(cmLint.linter(bedrockJsonLintSource, { delay: 300 }));
  } else {
    console.warn(
      "[Minecraft Bedrock Autocomplete] @codemirror/lint isn't available on this Acode build -- JSON error/warning highlighting will be skipped, but autocomplete will still work.",
    );
  }

  registeredExtensions = extensions;

  // Primary fix: every EditorState Acode creates from now on already has
  // our extensions baked in.
  patchEditorStateCreate(cmState.EditorState, extensions);

  // Also cover whatever's already open right now (states created BEFORE
  // this plugin finished loading, e.g. the file that was open when Acode
  // started).
  attachToAllOpenEditors();

  // Fallback safety net (see big comment above appendToViewIfMissing) --
  // re-check on the same file lifecycle events v1.0.1 used, plus a
  // periodic timer.
  const em = window.editorManager;
  if (em && typeof em.on === "function") {
    eventHandler = () => attachToAllOpenEditors();
    em.on(["switch-file", "file-loaded", "new-file", "add-folder"], eventHandler);
  }
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

  if (cmState && cmState.EditorState) {
    unpatchEditorStateCreate(cmState.EditorState);
  }

  registeredExtensions = null;
  cmAutocomplete = null;
  cmState = null;
  cmLint = null;
}

if (window.acode) {
  acode.setPluginInit(PLUGIN_ID, init);
  acode.setPluginUnmount(PLUGIN_ID, unmount);
}
