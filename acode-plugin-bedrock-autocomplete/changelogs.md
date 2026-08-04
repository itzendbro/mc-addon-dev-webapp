# Changelog

## 1.2.0

- **Real fix: autocomplete actually works now, including on the Acode
  build most real users are on.** Every previous version (1.0.0 through
  1.1.0) only ever tried CodeMirror 6 APIs. That's correct for Acode's
  newest engine, but a large number of real Acode installs -- Play Store,
  F-Droid, or any APK that hasn't auto-updated -- are still running
  Acode's OLDER Ace editor engine, where those CodeMirror APIs simply
  don't exist. Every previous version correctly detected that and quietly
  disabled itself rather than crashing (by design, per Acode's own plugin
  guidelines) -- but from the user's side that's indistinguishable from
  "the plugin does nothing at all", which is exactly what every "not
  working" report was actually hitting.
- This release detects which engine your Acode build is actually running
  (`editorManager.isCodeMirror`) and wires up a fully native completion
  source for whichever one it is: a real Ace `ace/ext/language_tools`
  completer (verified against a real installed `ace-builds` package) on
  the Ace engine, or the same CodeMirror 6 extension from 1.1.0 on the
  CodeMirror engine. Both use the exact same underlying Bedrock data and
  context detection, so suggestions are identical either way.
- Lowered `minVersionCode` back down to 292 (from 970) since the plugin no
  longer requires the CodeMirror-only Acode release to function.
- Live JSON error/warning highlighting (introduced in 1.1.0) remains
  CodeMirror-only, since Ace doesn't expose an equivalent hookable
  diagnostics API this plugin can use -- autocomplete works identically on
  both engines regardless.

## 1.1.0

- **Fix: autocomplete could still fail to show up in some situations even
  after 1.0.1.** 1.0.1's fix re-attached the completion extension to the
  active editor on every file-switch/file-load event plus a periodic
  safety check, which works but still has a brief window, right after a
  file is opened/switched, where the freshly built editor state doesn't
  have the extension yet. This release instead patches the one shared
  function Acode itself uses to build every single editor state
  (`EditorState.create`), so the extension is present from the very
  first moment any file's editor state is created -- there's no window at
  all anymore. (The old event/timer-based re-attachment from 1.0.1 is kept
  as an extra safety net underneath this.)
- **New: live error & warning highlighting for JSON files.** Real JSON
  syntax errors (missing comma, trailing comma, unmatched brace, ...) are
  now underlined immediately as you type, using the exact same gutter/
  squiggle UI Acode's own language-server diagnostics use. Also flags two
  common Bedrock-specific mistakes: a `"uuid"` field still left as the
  literal placeholder text `"uuid"`, and a `manifest.json` with two
  `"modules"` entries that accidentally share the same `"type"`.
- Bumped `minVersionCode` to 970 (Acode v1.12.0, the release that added
  CodeMirror 6 support) so Acode itself can warn about installing this
  plugin on an incompatible, too-old Acode build instead of installing it
  silently inactive.

## 1.0.1

- **Fix: suggestions never actually appeared.** v1.0.0 attached its
  completion extension to the editor exactly once, at plugin-load time.
  Acode rebuilds its CodeMirror editor state completely from scratch every
  time a file is opened or switched, which silently wiped the extension
  the moment you touched any file after the plugin loaded -- so
  suggestions never showed up in practice. Also removed the
  `editorLanguages.register()` registration path from v1.0.0, which
  registered an (empty-file-extension) language mode that could never
  actually be selected for any real file, so it never did anything.
  Fixed by re-attaching the extension to the active editor on every
  file-switch/file-load/new-file event, plus a lightweight periodic
  safety-net check, so suggestions now keep working across every file you
  open, not just whichever one happened to be open when the plugin
  started.

## 1.0.0

- Initial release. Ports the full Minecraft Bedrock JSON/JS autocomplete
  dictionary from the Pocket Addon Studio webapp (this same repository) to
  Acode, as a native CodeMirror 6 completion source with real snippet
  placeholder support and the same `!mbp`/`!mrp`/`!uuid` magic triggers.
