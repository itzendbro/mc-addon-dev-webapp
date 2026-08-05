# Minecraft Bedrock Autocomplete

Adds the same Minecraft Bedrock (MCPE/MCBE) add-on aware autocomplete used
by [Pocket Addon Studio](../) to the [Acode](https://acode.app) code
editor -- hundreds of official Bedrock JSON tags (manifest, entity, block,
item, particle, recipe, animation/render controllers, sounds, texture list
files, and more) plus a set of `@minecraft/server` scripting API snippets,
as real snippet completions (Tab/Shift-Tab walks through each placeholder,
just like VS Code) on **both** of Acode's editor engines -- the newer
CodeMirror 6 engine and the older Ace engine (still very commonly the one
actually running on real installs, including Play Store/F-Droid builds
that haven't picked up Acode's CodeMirror migration yet).

## What you get

- **Context-aware JSON suggestions.** Open a file inside a `manifest.json`,
  an `entities/`, `blocks/`, `items/`, `particles/`, `recipes/`,
  `loot_tables/`, `trading/`, `animations/`, `animation_controllers/`,
  `render_controllers/`, `sound_definitions.json`, `item_texture.json`,
  `terrain_texture.json`, `textures_list.json`, or `flipbook_textures.json`
  file (anywhere in a folder that's part of your project, not just files
  literally named that) and the suggestion list is narrowed down to only
  the tags relevant to that file -- not the entire Bedrock schema dumped
  into every JSON file.
- **Behavior Pack / Resource Pack aware manifests.** Inside a
  `manifest.json`, suggestions like the `script` module or
  `@minecraft/server` dependency are hidden unless your project names its
  folder in a way that's recognizably a Behavior Pack (`BP`, `_BP`,
  `behavior`, `behavior pack`, ...) -- and Resource-Pack-only tags like
  `raytraced` or `subpacks` are hidden the same way for Resource Pack
  folders.
- **Scripting API snippets.** Open a `.js`/`.ts`/`.mjs`/`.cjs` file and get
  snippets for common `@minecraft/server` and `@minecraft/server-ui`
  patterns -- event subscriptions, custom components, UI forms, and more.
- **Magic triggers.** Type `!mbp` or `!mrp` anywhere to insert a complete,
  ready-to-edit Behavior/Resource Pack `manifest.json` (with fresh random
  UUIDs already filled in), or `!uuid` to insert a single fresh UUID v4.
- **Live error & warning highlighting (new in 1.1.0).** JSON files get real
  syntax-error squiggles the moment your JSON becomes invalid (missing
  comma, trailing comma, unmatched brace, ...), plus a couple of Bedrock
  -specific sanity checks: a `"uuid"` field still left as the literal
  placeholder text `"uuid"` from a snippet, and a `manifest.json` with two
  `"modules"` entries that accidentally share the same `"type"`.
- **Fast and lightweight.** No language server, no network calls, no
  schema-validation library -- completions and diagnostics are plain,
  synchronous JavaScript over a small in-memory dictionary, so there's no
  extra editor lag on a phone.

## How it works

Type as normal -- Acode's completion popup opens automatically (or press
Ctrl+Space / your configured "start completion" key to force it open), and
matching suggestions show up alongside any of Acode's other active
completion sources. Picking one inserts a real snippet: placeholders are
already selected/highlighted so you can just start typing to replace them,
and Tab moves to the next one.

## Requirements

Works on both of Acode's editor engines -- the older Ace engine (via
`ace/ext/language_tools`) and the newer CodeMirror 6 engine (via
`@codemirror/autocomplete`/`@codemirror/lint`). The plugin detects which
one your installed Acode build is actually running
(`editorManager.isCodeMirror`) and wires up the matching native completion
source automatically -- no configuration needed. Live JSON error/warning
highlighting is only available on the CodeMirror engine (Ace doesn't
expose an equivalent API this plugin can hook into); autocomplete works
identically on both.

## Where the data comes from

This plugin is a direct, unmodified port of the exact completion
dictionaries used by the accompanying **Pocket Addon Studio** webapp in
this same repository (`app/mcCompletions.js` and `app/mcTemplates.js`) --
every Bedrock JSON tag here was cross-referenced against the official
Microsoft Learn "Bedrock creator" documentation and
[wiki.bedrock.dev](https://wiki.bedrock.dev) while that webapp's own
autocomplete feature was originally built.

## Troubleshooting: suggestions feel slow/delayed on some phones

This plugin's own completion lookup is a plain synchronous filter over an
in-memory list (well under 1ms per keystroke even on a slow phone -- this
isn't where the delay comes from). What actually causes a noticeable delay
on some devices is Android's own on-screen keyboard fighting with the
editor for control of what you just typed, which is a phone/OS-level
thing, not something a plugin can fix from inside the editor. If
suggestions feel late (a full second or more after you stop typing) on a
specific device, try these in order:

1. **Acode &rarr; Settings &rarr; Keyboard mode &rarr; "No suggestions" (or
   "No suggestions aggressive" if "No suggestions" doesn't help).** This
   tells Android's keyboard to stop running its own word-suggestion/
   autocorrect engine on top of the editor, which is the single biggest
   source of input lag with keyboards like Gboard on a code editor --
   every keystroke otherwise gets processed twice (once by the phone
   keyboard's own suggestion engine, once by Acode). This is an Acode
   setting, not an Android setting, and Acode's own developers added it
   for exactly this class of complaint.
2. **In Gboard's own settings** (long-press the comma key &rarr; Settings,
   or Android Settings &rarr; System &rarr; Languages & input &rarr; Gboard):
   turn off **Text correction &rarr; Personalization** (or "Personalized
   suggestions") and **Show suggestion strip**. Fewer languages enabled
   under **Languages** also helps -- each additional active language adds
   its own suggestion/dictionary lookup on every keystroke.
3. **If you use a third-party keyboard app** (the report that led to this
   section was on an "Emoji Keyboard" app, not Gboard) and suggestions are
   still slow after step 1: try switching to Gboard (or another
   mainstream keyboard) for code editing specifically. Smaller/less
   actively maintained keyboard apps are the most common source of this
   kind of input lag in text editors generally, independent of Acode or
   this plugin.
4. **Acode &rarr; Settings &rarr; Editor &rarr; Live autocompletion** --
   if left on, Acode tries to open the suggestion popup automatically
   after every few keystrokes, which is convenient but is one more thing
   competing for CPU time right as you're typing on a slow device. Turning
   it off means suggestions only appear when you explicitly ask for them
   (Ctrl+Space, or your configured "start autocomplete" key/quick-tools
   button) -- which some users find both faster AND less distracting.
5. Close other apps / free up RAM if the device is generally low on
   memory -- Android will throttle background/foreground work more
   aggressively under memory pressure, which affects every app's input
   latency, not just Acode's.

None of the above are things this plugin can configure on your behalf --
they're phone/OS and Acode app settings, not something a plugin's `main.js`
can reach into and change for you.
