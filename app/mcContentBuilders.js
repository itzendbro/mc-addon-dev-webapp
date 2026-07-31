// ---------------------------------------------------------------------------
// Pure (no DOM) helpers behind the "Add Content" FAB -> item/entity/block/
// sound/splash adder. Kept separate from app/main.js (which owns all the UI
// wiring/DOM building, same as every other feature in this app) so the
// actual file/JSON-shaping logic is easy to read and test on its own.
//
// The overall idea: the user taps the create_icon.png button, picks a
// content type (only "Item" is wired up for now -- the others are listed
// but show a "coming soon" toast), fills in a small form, and this module
// works out *where* the new file(s) should go inside whatever add-on
// project is currently open in the explorer (creating a brand new BP/RP
// project from scratch if the explorer is empty), then writes them.
// ---------------------------------------------------------------------------

// Walks the whole VFS tree and returns every folder's path (not files),
// depth-first. Used to look for an existing Behavior/Resource Pack folder
// by name before falling back to anything else.
function allFolderPaths(vfs) {
  const out = [];
  const walk = (path) => {
    for (const node of vfs.listChildren(path)) {
      if (node.type === "folder") {
        out.push(node.path);
        walk(node.path);
      }
    }
  };
  walk("");
  return out;
}

// Fallback pack-type detector for projects that don't name their BP/RP
// folders in a way `packTypeForFolderName` (see mcCompletions.js) recognises
// -- reads an actual manifest.json's module list instead, which is the one
// part of a pack that unambiguously says what it is regardless of folder
// naming conventions.
function detectPackTypeFromManifestContent(text) {
  try {
    const obj = JSON.parse(text);
    const modules = Array.isArray(obj.modules) ? obj.modules : [];
    for (const m of modules) {
      if (m && (m.type === "data" || m.type === "script")) return "bp";
      if (m && m.type === "resources") return "rp";
    }
  } catch (e) {
    /* not valid/parseable JSON -- ignore, caller just gets null back */
  }
  return null;
}

// Finds the folder that acts as the Behavior Pack (type: "bp") or Resource
// Pack (type: "rp") root of whatever's currently in the explorer. Tries, in
// order:
//   1. The shallowest folder whose *name* matches a known BP/RP convention
//      (MyAddon_BP, behavior pack, RP, ...) -- same detector already used
//      for manifest.json/entity autocomplete scoping.
//   2. Any manifest.json anywhere in the project whose module list says
//      what it is, for projects that don't follow a naming convention at
//      all (e.g. a single folder with `type: "data"` in its manifest).
// Returns null if neither approach finds anything -- the caller decides
// what to do in that case (usually: fall back to the project root).
function findPackRootFolder(vfs, type) {
  const folders = allFolderPaths(vfs)
    .map((path) => ({ path, depth: path.split("/").filter(Boolean).length }))
    .sort((a, b) => a.depth - b.depth || a.path.localeCompare(b.path));
  for (const { path } of folders) {
    if (packTypeForFolderName(vfs.nameOf(path)) === type) return path;
  }
  for (const node of vfs.allFiles()) {
    if (node.name !== "manifest.json" || !node.isText) continue;
    if (detectPackTypeFromManifestContent(node.content ?? "") === type) {
      return vfs.parentPath(node.path);
    }
  }
  return null;
}

// Works out (creating if necessary) the Behavior Pack / Resource Pack
// folders new content should be written into:
//   - Empty project (nothing in the explorer yet) -> creates a brand new
//     "<ProjectName>_BP" + "<ProjectName>_RP" pair with fresh manifest.json
//     files, exactly like picking "New Project" then typing !mbp/!mrp by
//     hand would, and uses those.
//   - Non-empty project -> looks for existing BP/RP folders (see
//     findPackRootFolder above) and keeps adding into *those* rather than
//     ever creating a second, competing pack layout. If no BP folder can be
//     found at all, falls back to the project root itself (so content still
//     gets a sensible home instead of the operation just failing). If no RP
//     folder can be found, `rpRoot` comes back null and the caller skips
//     any resource-pack-only side effects (texture registration, etc).
function ensureAddonScaffold(vfs, projectName) {
  if (vfs.isEmpty()) {
    const safeName = (projectName || "MyAddon").trim() || "MyAddon";
    const bpRoot = `${safeName}_BP`;
    const rpRoot = `${safeName}_RP`;
    vfs.createFile(joinPath(bpRoot, "manifest.json"), buildManifestBP(), { isText: true });
    vfs.createFile(joinPath(rpRoot, "manifest.json"), buildManifestRP(), { isText: true });
    return { bpRoot, rpRoot, createdNew: true };
  }
  const bpRoot = findPackRootFolder(vfs, "bp");
  const rpRoot = findPackRootFolder(vfs, "rp");
  return { bpRoot: bpRoot ?? "", rpRoot: rpRoot ?? null, createdNew: false };
}

// ---------------------------------------------------------------------------
// Identifier / name helpers
// ---------------------------------------------------------------------------

function slugifyIdToken(s) {
  return (s || "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_]/g, "")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
}

// Accepts anything the user typed ("Magic Sword", "magic_sword",
// "custom:magic_sword", "My Addon:Magic Sword") and normalizes it into a
// valid `namespace:name` Bedrock identifier, defaulting the namespace to
// "custom" when none was given. Throws a plain Error with a
// human-readable message on anything that can't be salvaged (e.g. empty
// input, or a name that's nothing but symbols/whitespace) so the UI layer
// can show it directly.
function normalizeItemIdentifier(raw) {
  const trimmed = (raw || "").trim();
  if (!trimmed) throw new Error("Item ID can't be empty.");
  let ns, name;
  const idx = trimmed.indexOf(":");
  if (idx !== -1) {
    ns = slugifyIdToken(trimmed.slice(0, idx));
    name = slugifyIdToken(trimmed.slice(idx + 1));
  } else {
    ns = "custom";
    name = slugifyIdToken(trimmed);
  }
  if (!ns) ns = "custom";
  if (!name) throw new Error("Item ID needs a name, e.g. custom:magic_sword.");
  return `${ns}:${name}`;
}

function numberOr(value, fallback) {
  const n = Number(value);
  return value !== "" && Number.isFinite(n) ? n : fallback;
}

function clampStackSize(value) {
  let n = Math.round(numberOr(value, 64));
  if (!Number.isFinite(n) || n < 1) n = 1;
  if (n > 9999) n = 9999;
  return n;
}

// ---------------------------------------------------------------------------
// Item behavior-file JSON builder.
// ---------------------------------------------------------------------------

// `fields` mirrors the item-adder form 1:1 -- see buildItemAdderForm() in
// app/main.js. Produces a complete, standalone, valid minecraft:item JSON
// file (never a fragment needing an outer wrapper -- see the commit that
// fixed exactly that bug in the JSON_SNIPPETS list for why that matters).
function buildItemFileJSON(fields) {
  const components = {};
  if (fields.iconTexture) components["minecraft:icon"] = { texture: fields.iconTexture };
  // A literal string (rather than a "item.ns:name" localization key) is
  // used deliberately -- per Mojang's own docs, minecraft:display_name's
  // value is shown as-is whenever it can't be resolved as a loc key, so
  // this displays correctly in-game immediately with zero extra files,
  // instead of silently showing a raw, un-translated "item.ns:name.name"
  // string until the user also remembers to hand-edit an en_US.lang file.
  if (fields.displayName) components["minecraft:display_name"] = { value: fields.displayName };
  components["minecraft:max_stack_size"] = clampStackSize(fields.maxStackSize);
  if (fields.handEquipped) components["minecraft:hand_equipped"] = true;
  if (fields.glint) components["minecraft:foil"] = true;
  if (fields.food) {
    components["minecraft:food"] = {
      nutrition: numberOr(fields.foodNutrition, 4),
      saturation_modifier: numberOr(fields.foodSaturation, 0.3),
      can_always_eat: !!fields.foodCanAlwaysEat,
    };
    // A food item needs an eat animation/duration to actually be usable in
    // game, not just declared edible -- easy to forget by hand.
    components["minecraft:use_animation"] = "eat";
    components["minecraft:use_duration"] = 1.6;
  }
  if (fields.durability) {
    components["minecraft:durability"] = { max_durability: Math.max(1, Math.round(numberOr(fields.maxDurability, 250))) };
  }

  const description = { identifier: fields.identifier };
  if (fields.category && fields.category !== "none") {
    description.menu_category = { category: fields.category };
  }

  const root = {
    format_version: "1.21.80",
    "minecraft:item": { description, components },
  };
  return JSON.stringify(root, null, 4) + "\n";
}

// Merges a new item_texture.json entry into whatever's already there
// (parsed with plain JSON.parse -- if the existing file is invalid JSON or
// missing entirely, starts a fresh, minimal, valid file instead of ever
// destroying/corrupting existing content).
function mergeItemTextureJson(existingContent, shortName, rpPackName) {
  let obj = null;
  if (existingContent) {
    try {
      const parsed = JSON.parse(existingContent);
      if (parsed && typeof parsed === "object") obj = parsed;
    } catch (e) {
      obj = null;
    }
  }
  if (!obj) {
    obj = { resource_pack_name: rpPackName || "pack", texture_name: "atlas.items", texture_data: {} };
  }
  if (!obj.texture_data || typeof obj.texture_data !== "object") obj.texture_data = {};
  obj.texture_data[shortName] = { textures: `textures/items/${shortName}` };
  return JSON.stringify(obj, null, 4) + "\n";
}

window.ContentBuilders = {
  allFolderPaths,
  detectPackTypeFromManifestContent,
  findPackRootFolder,
  ensureAddonScaffold,
  slugifyIdToken,
  normalizeItemIdentifier,
  buildItemFileJSON,
  mergeItemTextureJson,
};
