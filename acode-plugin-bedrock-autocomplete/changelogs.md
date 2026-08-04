# Changelog

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
