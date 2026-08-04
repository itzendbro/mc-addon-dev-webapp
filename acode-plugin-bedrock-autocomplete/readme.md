# Minecraft Bedrock Autocomplete

Adds the same Minecraft Bedrock (MCPE/MCBE) add-on aware autocomplete used
by [Pocket Addon Studio](../) to the [Acode](https://acode.app) code
editor -- hundreds of official Bedrock JSON tags (manifest, entity, block,
item, particle, recipe, animation/render controllers, sounds, texture list
files, and more) plus a set of `@minecraft/server` scripting API snippets,
all as real CodeMirror snippet completions (Tab/Shift-Tab walks through
each placeholder, just like VS Code).

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

## How it works

Type as normal -- Acode's completion popup opens automatically (or press
Ctrl+Space / your configured "start completion" key to force it open), and
matching suggestions show up alongside any of Acode's other active
completion sources. Picking one inserts a real snippet: placeholders are
already selected/highlighted so you can just start typing to replace them,
and Tab moves to the next one.

## Requirements

Acode version 292+ with the CodeMirror 6 editor engine (Acode migrated
from Ace to CodeMirror in v1.12; on an older Ace-based Acode build this
plugin installs cleanly but stays inactive rather than throwing an error,
since Ace and CodeMirror 6 completion APIs aren't compatible with each
other).

## Where the data comes from

This plugin is a direct, unmodified port of the exact completion
dictionaries used by the accompanying **Pocket Addon Studio** webapp in
this same repository (`app/mcCompletions.js` and `app/mcTemplates.js`) --
every Bedrock JSON tag here was cross-referenced against the official
Microsoft Learn "Bedrock creator" documentation and
[wiki.bedrock.dev](https://wiki.bedrock.dev) while that webapp's own
autocomplete feature was originally built.
