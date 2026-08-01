// ---------------------------------------------------------------------------
// Pure (no DOM) helpers behind the "Add Content" FAB -> item/entity/block/
// sound/splash adder. Kept separate from app/main.js (which owns all the UI
// wiring/DOM building, same as every other feature in this app) so the
// actual file/JSON-shaping logic is easy to read and test on its own.
//
// The overall idea: the user taps the create_icon.png button, picks a
// content type (only "Item" is wired up for now -- the others are listed
// but show a "coming soon" toast), fills in a form built from
// ITEM_COMPONENT_SCHEMA below, and this module works out *where* the new
// file(s) should go inside whatever add-on project is currently open in the
// explorer (creating a brand new BP/RP project from scratch if the
// explorer is empty), then writes them.
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

// Sound/music "event name" identifiers (sound_definitions.json /
// music_definitions.json keys) conventionally use dot-separated segments
// instead of a colon-separated namespace:name pair (e.g. "music.game",
// "mob.enderman.stare", "myaddon.magic_chime") -- this keeps each
// dot-separated segment individually valid (lowercase, underscores) while
// preserving the segment structure, instead of collapsing the whole string
// down like slugifyIdToken would (which would turn "myaddon.magic_chime"
// into a single "myaddon_magic_chime" run and lose the dots entirely).
function slugifyEventName(s) {
  return (s || "")
    .split(".")
    .map((segment) => slugifyIdToken(segment))
    .filter(Boolean)
    .join(".");
}

// Accepts anything the user typed ("Magic Sword", "magic_sword",
// "custom:magic_sword", "My Addon:Magic Sword") and normalizes it into a
// valid `namespace:name` Bedrock identifier, defaulting the namespace to
// "custom" when none was given. Throws a plain Error with a
// human-readable message on anything that can't be salvaged (e.g. empty
// input, or a name that's nothing but symbols/whitespace) so the UI layer
// can show it directly.
// Accepts anything the user typed ("Magic Sword", "magic_sword",
// "custom:magic_sword", "My Addon:Magic Sword") and normalizes it into a
// valid `namespace:name` Bedrock identifier, defaulting the namespace to
// "custom" when none was given. Throws a plain Error with a
// human-readable message on anything that can't be salvaged (e.g. empty
// input, or a name that's nothing but symbols/whitespace) so the UI layer
// can show it directly. `kind` (e.g. "Item ID", "Block ID") only affects
// the wording of that error message -- shared by every content adder that
// needs a namespace:name identifier (Item, Block, and eventually Entity).
function normalizeNamespacedIdentifier(raw, kind) {
  const label = kind || "Identifier";
  const trimmed = (raw || "").trim();
  if (!trimmed) throw new Error(`${label} can't be empty.`);
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
  if (!name) throw new Error(`${label} needs a name, e.g. custom:${kind === "Block ID" ? "magic_block" : "magic_sword"}.`);
  return `${ns}:${name}`;
}

// Kept as a thin wrapper (rather than renaming every existing call site) --
// identical behavior to normalizeNamespacedIdentifier(raw, "Item ID").
function normalizeItemIdentifier(raw) {
  return normalizeNamespacedIdentifier(raw, "Item ID");
}

function numberOr(value, fallback) {
  const n = Number(value);
  return value !== "" && value !== undefined && value !== null && Number.isFinite(n) ? n : fallback;
}

function clampInt(value, fallback, min, max) {
  let n = Math.round(numberOr(value, fallback));
  if (!Number.isFinite(n)) n = fallback;
  if (min !== undefined && n < min) n = min;
  if (max !== undefined && n > max) n = max;
  return n;
}

function clampStackSize(value) {
  return clampInt(value, 64, 1, 9999);
}

function csvToArray(s) {
  return (s || "")
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
}

// ---------------------------------------------------------------------------
// Full official item component schema -- drives both the generic form UI
// (app/main.js's renderItemAdderForm()) and buildItemFileJSON() below, so
// adding/adjusting a component only ever needs a change in ONE place. Every
// entry here corresponds 1:1 with an entry in Mojang's own "Item Components"
// reference (https://learn.microsoft.com/minecraft/creator/.../itemcomponentlist)
// and wiki.bedrock.dev/items/item-components, current as of format_version
// 1.21.80-ish. `minecraft:icon`, `minecraft:display_name` and
// `minecraft:max_stack_size` are handled separately (in the "Identity"/
// "Basics" section of the form) since almost every item wants them --
// everything else lives in this list under "Components".
//
// Each entry:
//   key          -- unique id, also the checkbox's field name in the form
//   component    -- the "minecraft:xxx" JSON key written out
//   label        -- shown next to the on/off checkbox
//   detail       -- one-line description shown under the label
//   fields       -- sub-fields shown (indented) only once the checkbox is
//                   ticked; empty array for boolean/no-config components
//                   that are just `true` when enabled.
//   build(values)-- given the sub-fields' raw string/bool values (already
//                   read out of the form inputs), returns the JSON value to
//                   assign to `components[component]`.
//
// Field types supported by the generic form renderer (app/main.js):
//   "text" | "number" | "select" | "checkbox" | "textarea" (comma list)
// ---------------------------------------------------------------------------
const ITEM_COMPONENT_SCHEMA = [
  {
    key: "handEquipped",
    component: "minecraft:hand_equipped",
    label: "Hand equipped",
    detail: "Shows as a held tool/weapon model instead of a flat icon.",
    fields: [],
    build: () => true,
  },
  {
    key: "glint",
    component: "minecraft:glint",
    label: "Enchanted glint",
    detail: "Renders the shimmering enchant effect (renamed from minecraft:foil in 1.20.20).",
    fields: [],
    build: () => true,
  },
  {
    key: "foodEnabled",
    component: "minecraft:food",
    label: "Edible (food)",
    detail: "Allows the item to be eaten. Also sets use_animation/use_duration automatically.",
    fields: [
      { name: "foodNutrition", type: "number", label: "Nutrition", def: "4" },
      { name: "foodSaturation", type: "number", label: "Saturation modifier", def: "0.6", step: "0.1" },
      { name: "foodCanAlwaysEat", type: "checkbox", label: "Can always eat (even when full)" },
      { name: "foodConvertsTo", type: "text", label: "Converts to item on use (optional)", placeholder: "minecraft:bowl" },
    ],
    build: (v) => ({
      nutrition: clampInt(v.foodNutrition, 4),
      saturation_modifier: numberOr(v.foodSaturation, 0.6),
      can_always_eat: !!v.foodCanAlwaysEat,
      ...(v.foodConvertsTo ? { using_converts_to: v.foodConvertsTo.trim() } : {}),
    }),
    // Food items need a use animation/duration to actually be eaten in
    // game, not just declared edible -- so this component also injects
    // those two extra top-level components alongside itself.
    extraComponents: (v) => ({
      "minecraft:use_animation": "eat",
      "minecraft:use_duration": numberOr(v.foodUseDuration, 1.6),
    }),
  },
  {
    key: "durabilityEnabled",
    component: "minecraft:durability",
    label: "Has durability (can be damaged)",
    detail: "Lets the item take damage and eventually break; enables repairing.",
    fields: [{ name: "maxDurability", type: "number", label: "Max durability", def: "250" }],
    build: (v) => ({ max_durability: clampInt(v.maxDurability, 250, 1) }),
  },
  {
    key: "wearableEnabled",
    component: "minecraft:wearable",
    label: "Wearable",
    detail: "Lets the item be worn/equipped in a specific slot (armor, offhand, ...).",
    fields: [
      {
        name: "wearableSlot",
        type: "select",
        label: "Equipment slot",
        def: "slot.armor.chest",
        options: [
          ["slot.armor.head", "Head"],
          ["slot.armor.chest", "Chest"],
          ["slot.armor.legs", "Legs"],
          ["slot.armor.feet", "Feet"],
          ["slot.armor.body", "Body (e.g. horse/wolf armor)"],
          ["slot.weapon.offhand", "Offhand"],
        ],
      },
      { name: "wearableProtection", type: "number", label: "Protection (armor value)", def: "0" },
    ],
    build: (v) => ({ slot: v.wearableSlot || "slot.armor.chest", protection: clampInt(v.wearableProtection, 0, 0) }),
  },
  {
    key: "enchantableEnabled",
    component: "minecraft:enchantable",
    label: "Enchantable",
    detail: "Allows the item to be enchanted (enchanting table, anvil, loot tables).",
    fields: [
      {
        name: "enchantSlot",
        type: "select",
        label: "Enchantment slot type",
        def: "sword",
        options: [
          "all", "armor_feet", "armor_torso", "armor_head", "armor_legs", "axe", "bow", "carrot_stick",
          "cosmetic_head", "crossbow", "elytra", "fishing_rod", "flintsteel", "g_armor", "g_digging",
          "g_tool", "hoe", "melee_spear", "none", "pickaxe", "shears", "shield", "shovel", "spear", "sword",
        ].map((v) => [v, v]),
      },
      { name: "enchantValue", type: "number", label: "Enchantability value (0-255)", def: "10" },
    ],
    build: (v) => ({ slot: v.enchantSlot || "sword", value: clampInt(v.enchantValue, 10, 0, 255) }),
  },
  {
    key: "diggerEnabled",
    component: "minecraft:digger",
    label: "Digger (mining tool)",
    detail: "Digs specific blocks faster than bare hands (pickaxe/axe/shovel-style items).",
    fields: [
      { name: "diggerEfficiency", type: "checkbox", label: "Use efficiency enchantment", def: true },
      { name: "diggerBlocks", type: "text", label: "Fast-mined block IDs (comma separated)", placeholder: "minecraft:stone, minecraft:coal_ore" },
      { name: "diggerSpeed", type: "number", label: "Destroy speed for those blocks", def: "4" },
    ],
    build: (v) => {
      const blocks = csvToArray(v.diggerBlocks);
      return {
        use_efficiency: !!v.diggerEfficiency,
        destroy_speeds: blocks.length ? blocks.map((block) => ({ block, speed: numberOr(v.diggerSpeed, 4) })) : [],
      };
    },
  },
  {
    key: "damageEnabled",
    component: "minecraft:damage",
    label: "Attack damage",
    detail: "Extra melee damage this item deals on attack.",
    fields: [{ name: "damageValue", type: "number", label: "Damage", def: "3" }],
    build: (v) => clampInt(v.damageValue, 3, 0),
  },
  {
    key: "repairableEnabled",
    component: "minecraft:repairable",
    label: "Repairable",
    detail: "Lets specific items restore this item's durability (anvil/grindstone/crafting).",
    fields: [
      { name: "repairItems", type: "text", label: "Repair item IDs (comma separated)", placeholder: "minecraft:iron_ingot" },
      { name: "repairAmount", type: "number", label: "Durability restored per repair", def: "" },
    ],
    build: (v) => {
      const items = csvToArray(v.repairItems);
      if (!items.length) return { repair_items: [] };
      const entry = { items };
      if (v.repairAmount !== "" && v.repairAmount !== undefined) entry.repair_amount = numberOr(v.repairAmount, undefined);
      return { repair_items: [entry] };
    },
  },
  {
    key: "cooldownEnabled",
    component: "minecraft:cooldown",
    label: "Cooldown after use",
    detail: "Item (and anything sharing its cooldown category) becomes unusable for a bit after use.",
    fields: [
      { name: "cooldownCategory", type: "text", label: "Cooldown category", def: "custom_cooldown" },
      { name: "cooldownDuration", type: "number", label: "Duration (seconds)", def: "1.5" },
    ],
    build: (v) => ({ category: v.cooldownCategory || "custom_cooldown", duration: numberOr(v.cooldownDuration, 1.5) }),
  },
  {
    key: "fuelEnabled",
    component: "minecraft:fuel",
    label: "Furnace fuel",
    detail: "Lets this item be burned as furnace fuel.",
    fields: [{ name: "fuelDuration", type: "number", label: "Burn duration (seconds)", def: "10" }],
    build: (v) => ({ duration: numberOr(v.fuelDuration, 10) }),
  },
  {
    key: "blockPlacerEnabled",
    component: "minecraft:block_placer",
    label: "Places a block",
    detail: "Turns this into a block-placing item, like a bucket of blocks.",
    fields: [{ name: "blockPlacerBlock", type: "text", label: "Block ID to place", placeholder: "namespace:block_name" }],
    build: (v) => ({ block: (v.blockPlacerBlock || "").trim() || "minecraft:stone" }),
  },
  {
    key: "entityPlacerEnabled",
    component: "minecraft:entity_placer",
    label: "Places an entity",
    detail: "Like a spawn egg -- places an entity into the world when used.",
    fields: [{ name: "entityPlacerEntity", type: "text", label: "Entity ID to place", placeholder: "namespace:entity_name" }],
    build: (v) => ({ entity: (v.entityPlacerEntity || "").trim() || "minecraft:pig" }),
  },
  {
    key: "projectileEnabled",
    component: "minecraft:projectile",
    label: "Is a projectile",
    detail: "Can be shot from dispensers or used as ammo with a Shooter item (like an arrow).",
    fields: [
      { name: "projectileEntity", type: "text", label: "Projectile entity ID", placeholder: "minecraft:arrow" },
      { name: "projectileMinCritPower", type: "number", label: "Minimum critical power", def: "1.25" },
    ],
    build: (v) => ({
      projectile_entity: (v.projectileEntity || "").trim() || "minecraft:arrow",
      minimum_critical_power: numberOr(v.projectileMinCritPower, 1.25),
    }),
  },
  {
    key: "shooterEnabled",
    component: "minecraft:shooter",
    label: "Shoots projectiles",
    detail: "Fires ammunition, like a bow or crossbow.",
    fields: [
      { name: "shooterAmmo", type: "text", label: "Ammunition item ID", placeholder: "minecraft:arrow" },
      { name: "shooterMaxDraw", type: "number", label: "Max draw duration (seconds)", def: "1" },
    ],
    build: (v) => ({
      ammunition: [{ item: (v.shooterAmmo || "").trim() || "minecraft:arrow", use_offhand: true, search_inventory: true, use_in_creative: true }],
      max_draw_duration: numberOr(v.shooterMaxDraw, 1),
      scale_power_by_draw_duration: true,
    }),
  },
  {
    key: "throwableEnabled",
    component: "minecraft:throwable",
    label: "Throwable",
    detail: "Can be thrown by the player, like a snowball or ender pearl.",
    fields: [{ name: "throwableSwingAnim", type: "checkbox", label: "Play swing animation when thrown", def: true }],
    build: (v) => ({ do_swing_animation: !!v.throwableSwingAnim, launch_power_scale: 1, max_launch_power: 1 }),
  },
  {
    key: "compostableEnabled",
    component: "minecraft:compostable",
    label: "Compostable",
    detail: "Can be placed in a composter to make bone meal.",
    fields: [{ name: "compostChance", type: "number", label: "Chance to raise the compost level (%)", def: "65" }],
    build: (v) => ({ composting_chance: clampInt(v.compostChance, 65, 0, 100) }),
  },
  {
    key: "rarityEnabled",
    component: "minecraft:rarity",
    label: "Rarity",
    detail: "Colors the item's hover name based on how rare it is.",
    fields: [
      {
        name: "rarityValue",
        type: "select",
        label: "Rarity",
        def: "common",
        options: [
          ["common", "Common (white)"],
          ["uncommon", "Uncommon (yellow)"],
          ["rare", "Rare (aqua)"],
          ["epic", "Epic (light purple)"],
        ],
      },
    ],
    build: (v) => v.rarityValue || "common",
  },
  {
    key: "hoverTextColorEnabled",
    component: "minecraft:hover_text_color",
    label: "Hover text color",
    detail: "Overrides the hover name color directly (takes priority over Rarity).",
    fields: [
      {
        name: "hoverTextColorValue",
        type: "select",
        label: "Color",
        def: "gold",
        options: [
          "black", "dark_blue", "dark_green", "dark_aqua", "dark_red", "dark_purple", "gold", "gray",
          "dark_gray", "blue", "green", "aqua", "red", "light_purple", "yellow", "white", "minecoin_gold",
        ].map((v) => [v, v.replace(/_/g, " ")]),
      },
    ],
    build: (v) => v.hoverTextColorValue || "gold",
  },
  {
    key: "allowOffHand",
    component: "minecraft:allow_off_hand",
    label: "Allow off-hand",
    detail: "Can be placed into the off-hand inventory slot.",
    fields: [],
    build: () => true,
  },
  {
    key: "canDestroyInCreative",
    component: "minecraft:can_destroy_in_creative",
    label: "Can destroy blocks in Creative",
    detail: "Left-click breaks blocks instantly in Creative mode (default off for non-sword items).",
    fields: [],
    build: () => true,
  },
  {
    key: "fireResistant",
    component: "minecraft:fire_resistant",
    label: "Fire resistant",
    detail: "Doesn't burn up when dropped in fire/lava.",
    fields: [],
    build: () => true,
  },
  {
    key: "preventDespawn",
    component: "minecraft:should_despawn",
    label: "Never despawns on the ground",
    detail: "Prevents this item from disappearing over time when dropped (vanilla default: despawns).",
    fields: [],
    build: () => false,
  },
  {
    key: "stackedByData",
    component: "minecraft:stacked_by_data",
    label: "Stack only with identical data",
    detail: "Items with different aux/data values won't stack together.",
    fields: [],
    build: () => true,
  },
  {
    key: "liquidClipped",
    component: "minecraft:liquid_clipped",
    label: "Interacts with liquids on use",
    detail: "Item's \"use\" raycast can hit water/lava instead of passing through.",
    fields: [],
    build: () => true,
  },
  {
    key: "interactButtonEnabled",
    component: "minecraft:interact_button",
    label: "Show touch \"interact\" button",
    detail: "Shows an on-screen button on touch controls for using this item.",
    fields: [{ name: "interactButtonText", type: "text", label: "Button text (optional, blank = default \"Use Item\")", placeholder: "" }],
    build: (v) => (v.interactButtonText ? v.interactButtonText.trim() : true),
  },
  {
    key: "dyeableEnabled",
    component: "minecraft:dyeable",
    label: "Dyeable",
    detail: "Can be dyed via cauldron water, like leather armor.",
    fields: [{ name: "dyeableDefaultColor", type: "text", label: "Default color (hex)", def: "#a06540" }],
    build: (v) => ({ default_color: v.dyeableDefaultColor || "#a06540" }),
  },
  {
    key: "damageAbsorptionEnabled",
    component: "minecraft:damage_absorption",
    label: "Damage absorption",
    detail: "Absorbs damage that would otherwise hit the wearer (requires Durability + Wearable).",
    fields: [{ name: "damageAbsorptionCauses", type: "text", label: "Absorbable damage causes (comma separated)", placeholder: "fall, magma" }],
    build: (v) => ({ absorbable_causes: csvToArray(v.damageAbsorptionCauses).length ? csvToArray(v.damageAbsorptionCauses) : ["fall"] }),
  },
  {
    key: "storageItemEnabled",
    component: "minecraft:storage_item",
    label: "Storage item (holds other items)",
    detail: "Lets the item hold its own inventory of other items, like a shulker box.",
    fields: [
      { name: "storageMaxSlots", type: "number", label: "Max slots", def: "64" },
      { name: "storageAllowNested", type: "checkbox", label: "Allow nested storage items inside" },
      { name: "storageBannedItems", type: "text", label: "Banned item IDs (comma separated)", placeholder: "minecraft:shulker_box" },
    ],
    build: (v) => ({
      max_slots: clampInt(v.storageMaxSlots, 64, 1),
      allow_nested_storage_items: !!v.storageAllowNested,
      banned_items: csvToArray(v.storageBannedItems),
    }),
  },
  {
    key: "bundleInteractionEnabled",
    component: "minecraft:bundle_interaction",
    label: "Bundle interaction UI",
    detail: "Adds the bundle-style tooltip/interactions (requires Storage Item above).",
    fields: [{ name: "bundleViewableSlots", type: "number", label: "Viewable slots", def: "12" }],
    build: (v) => ({ num_viewable_slots: clampInt(v.bundleViewableSlots, 12, 1, 64) }),
  },
  {
    key: "tagsEnabled",
    component: "minecraft:tags",
    label: "Custom tags",
    detail: "Attaches arbitrary tags to the item, usable in loot tables/recipes/scripts.",
    fields: [{ name: "tagsList", type: "text", label: "Tags (comma separated)", placeholder: "minecraft:is_food" }],
    build: (v) => ({ tags: csvToArray(v.tagsList) }),
  },
];

// ---------------------------------------------------------------------------
// Item behavior-file JSON builder.
// ---------------------------------------------------------------------------

// `fields` mirrors the item-adder form. `fields.components` is a map of
// { [schemaEntry.key]: { enabled: bool, ...subFieldValues } } for every
// entry in ITEM_COMPONENT_SCHEMA the user actually ticked on. Produces a
// complete, standalone, valid minecraft:item JSON file (never a fragment
// needing an outer wrapper -- see the commit that fixed exactly that bug in
// the JSON_SNIPPETS list for why that matters).
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

  const chosen = fields.components || {};
  for (const entry of ITEM_COMPONENT_SCHEMA) {
    const values = chosen[entry.key];
    if (!values || !values.enabled) continue;
    components[entry.component] = entry.build(values);
    if (entry.extraComponents) Object.assign(components, entry.extraComponents(values));
  }

  const description = { identifier: fields.identifier };
  if (fields.category) {
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

// ---------------------------------------------------------------------------
// Full official block component schema -- same shape/purpose as
// ITEM_COMPONENT_SCHEMA above, drives both the generic form UI
// (app/main.js's renderBlockAdderForm()) and buildBlockFileJSON() below.
// Every entry corresponds 1:1 with an entry in
// https://wiki.bedrock.dev/blocks/block-components, current as of format
// version ~1.21.80-1.26 (a couple of the newest 1.26.x-only components,
// e.g. Chest Obstruction/Connection Rule/Flammable's newest object shape,
// are included too since they degrade harmlessly to "unknown property,
// ignored" on older game versions rather than breaking anything).
// minecraft:geometry + minecraft:material_instances (the two every custom
// block needs to actually render as something other than a purple/black
// missing-texture cube) are handled in the "Appearance" section of the
// form directly, same as an item's icon/display_name -- everything else
// lives in this list under "Components".
// ---------------------------------------------------------------------------
const BLOCK_COMPONENT_SCHEMA = [
  {
    key: "destructibleByMiningEnabled",
    component: "minecraft:destructible_by_mining",
    label: "Destructible by mining",
    detail: "How long it takes to mine (higher = slower). Uncheck the box below to make it unminable.",
    fields: [
      { name: "canBeMined", type: "checkbox", label: "Can be mined", def: true },
      { name: "secondsToDestroy", type: "number", label: "Hardness (seconds_to_destroy)", def: "1" },
    ],
    build: (v) => (v.canBeMined === false ? false : { seconds_to_destroy: numberOr(v.secondsToDestroy, 1) }),
  },
  {
    key: "destructibleByExplosionEnabled",
    component: "minecraft:destructible_by_explosion",
    label: "Destructible by explosion",
    detail: "Whether TNT/creepers/etc can blow this block up.",
    fields: [
      { name: "canBeExploded", type: "checkbox", label: "Can be destroyed by explosions", def: true },
      { name: "explosionResistance", type: "number", label: "Explosion resistance", def: "5" },
    ],
    build: (v) => (v.canBeExploded === false ? false : { explosion_resistance: numberOr(v.explosionResistance, 5) }),
  },
  {
    key: "frictionEnabled",
    component: "minecraft:friction",
    label: "Friction (slipperiness)",
    detail: "0.0-0.9. Lower values are more slippery, like ice.",
    fields: [{ name: "frictionValue", type: "number", label: "Friction", def: "0.4", step: "0.05" }],
    build: (v) => Math.min(0.9, Math.max(0, numberOr(v.frictionValue, 0.4))),
  },
  {
    key: "lightEmissionEnabled",
    component: "minecraft:light_emission",
    label: "Emits light",
    detail: "Light level 0-15, like a torch or glowstone.",
    fields: [{ name: "lightLevel", type: "number", label: "Light level (0-15)", def: "15" }],
    build: (v) => clampInt(v.lightLevel, 15, 0, 15),
  },
  {
    key: "lightDampeningEnabled",
    component: "minecraft:light_dampening",
    label: "Light dampening",
    detail: "How many light levels are blocked passing through this block (0 = fully see-through like glass).",
    fields: [{ name: "dampeningLevel", type: "number", label: "Dampening (0-15)", def: "15" }],
    build: (v) => clampInt(v.dampeningLevel, 15, 0, 15),
  },
  {
    key: "flammableEnabled",
    component: "minecraft:flammable",
    label: "Flammable",
    detail: "Can catch fire from neighboring flames and burn away, like planks or leaves.",
    fields: [
      { name: "catchChance", type: "number", label: "Catch chance modifier", def: "5" },
      { name: "destroyChance", type: "number", label: "Destroy chance modifier", def: "20" },
      { name: "lavaFlammable", type: "checkbox", label: "Can also catch fire from lava" },
    ],
    build: (v) => ({
      catch_chance_modifier: clampInt(v.catchChance, 5, 0),
      destroy_chance_modifier: clampInt(v.destroyChance, 20, 0),
      lava_flammable: v.lavaFlammable ? "always" : "never",
    }),
  },
  {
    key: "mapColorEnabled",
    component: "minecraft:map_color",
    label: "Map color",
    detail: "The color this block shows as on maps.",
    fields: [{ name: "mapColorHex", type: "text", label: "Color (hex)", def: "#a52a2a" }],
    build: (v) => v.mapColorHex || "#a52a2a",
  },
  {
    key: "collisionBoxEnabled",
    component: "minecraft:collision_box",
    label: "Custom collision box",
    detail: "The box entities/particles physically bump into. Leave unchecked for a normal full-size block.",
    fields: [
      { name: "collisionOriginX", type: "number", label: "Origin X", def: "-8" },
      { name: "collisionOriginY", type: "number", label: "Origin Y", def: "0" },
      { name: "collisionOriginZ", type: "number", label: "Origin Z", def: "-8" },
      { name: "collisionSizeX", type: "number", label: "Size X", def: "16" },
      { name: "collisionSizeY", type: "number", label: "Size Y", def: "16" },
      { name: "collisionSizeZ", type: "number", label: "Size Z", def: "16" },
    ],
    build: (v) => ({
      origin: [numberOr(v.collisionOriginX, -8), numberOr(v.collisionOriginY, 0), numberOr(v.collisionOriginZ, -8)],
      size: [numberOr(v.collisionSizeX, 16), numberOr(v.collisionSizeY, 16), numberOr(v.collisionSizeZ, 16)],
    }),
  },
  {
    key: "selectionBoxEnabled",
    component: "minecraft:selection_box",
    label: "Custom selection box",
    detail: "The box highlighted/clicked when aiming at the block. Leave unchecked for a normal full-size block.",
    fields: [
      { name: "selectionOriginX", type: "number", label: "Origin X", def: "-8" },
      { name: "selectionOriginY", type: "number", label: "Origin Y", def: "0" },
      { name: "selectionOriginZ", type: "number", label: "Origin Z", def: "-8" },
      { name: "selectionSizeX", type: "number", label: "Size X", def: "16" },
      { name: "selectionSizeY", type: "number", label: "Size Y", def: "16" },
      { name: "selectionSizeZ", type: "number", label: "Size Z", def: "16" },
    ],
    build: (v) => ({
      origin: [numberOr(v.selectionOriginX, -8), numberOr(v.selectionOriginY, 0), numberOr(v.selectionOriginZ, -8)],
      size: [numberOr(v.selectionSizeX, 16), numberOr(v.selectionSizeY, 16), numberOr(v.selectionSizeZ, 16)],
    }),
  },
  {
    key: "lootEnabled",
    component: "minecraft:loot",
    label: "Custom loot table",
    detail: "What drops when this block is destroyed (ignored with Silk Touch). Leave unchecked to just drop itself.",
    fields: [{ name: "lootTablePath", type: "text", label: "Loot table path", placeholder: "loot_tables/blocks/my_block.json" }],
    build: (v) => (v.lootTablePath || "").trim() || "loot_tables/blocks/custom_block.json",
  },
  {
    key: "displayNameEnabled",
    component: "minecraft:display_name",
    label: "Display name (lang key)",
    detail: "The .lang translation key shown when hovering over the block -- add the matching line to en_US.lang yourself.",
    fields: [{ name: "displayNameKey", type: "text", label: "Lang key", placeholder: "tile.namespace:block_name.name" }],
    build: (v) => (v.displayNameKey || "").trim() || "tile.custom:block.name",
  },
  {
    key: "flowerPottableEnabled",
    component: "minecraft:flower_pottable",
    label: "Can be placed in a Flower Pot",
    detail: "Root-only component -- lets this block be potted like a sapling or fern.",
    fields: [],
    build: () => ({}),
  },
  {
    key: "craftingTableEnabled",
    component: "minecraft:crafting_table",
    label: "Acts as a crafting table",
    detail: "Opens a crafting grid when interacted with.",
    fields: [
      { name: "craftingTableName", type: "text", label: "Table name shown in the UI", placeholder: "My Crafting Table" },
      { name: "craftingTags", type: "text", label: "Crafting tags (comma separated)", def: "crafting_table" },
    ],
    build: (v) => {
      const tags = csvToArray(v.craftingTags);
      const out = { crafting_tags: tags.length ? tags : ["crafting_table"] };
      if (v.craftingTableName && v.craftingTableName.trim()) out.table_name = v.craftingTableName.trim();
      return out;
    },
  },
  {
    key: "tickEnabled",
    component: "minecraft:tick",
    label: "Ticks periodically",
    detail: "Fires an onTick() event after a random delay -- used to build custom scripted block behavior.",
    fields: [
      { name: "tickMin", type: "number", label: "Min interval (ticks)", def: "10" },
      { name: "tickMax", type: "number", label: "Max interval (ticks)", def: "20" },
      { name: "tickLooping", type: "checkbox", label: "Keep ticking repeatedly", def: true },
    ],
    build: (v) => ({
      interval_range: [clampInt(v.tickMin, 10, 1), clampInt(v.tickMax, 20, 1)],
      looping: v.tickLooping !== false,
    }),
  },
  {
    key: "redstoneConductivityEnabled",
    component: "minecraft:redstone_conductivity",
    label: "Redstone conductivity",
    detail: "Whether this block conducts direct redstone power, like a solid block does.",
    fields: [
      { name: "redstoneConductor", type: "checkbox", label: "Conducts direct power", def: true },
      { name: "redstoneStepDown", type: "checkbox", label: "Redstone wire can travel down its side" },
    ],
    build: (v) => ({ redstone_conductor: !!v.redstoneConductor, allows_wire_to_step_down: !!v.redstoneStepDown }),
  },
  {
    key: "redstoneProducerEnabled",
    component: "minecraft:redstone_producer",
    label: "Produces redstone power",
    detail: "Acts as a redstone power source, like a lever or button.",
    fields: [
      { name: "redstonePower", type: "number", label: "Power level (0-15)", def: "15" },
      {
        name: "redstoneStrongFace",
        type: "select",
        label: "Strongly powered face",
        def: "up",
        options: ["up", "down", "north", "south", "east", "west"].map((v) => [v, v]),
      },
    ],
    build: (v) => ({ power: clampInt(v.redstonePower, 15, 0, 15), strongly_powered_face: v.redstoneStrongFace || "up" }),
  },
  {
    key: "replaceableEnabled",
    component: "minecraft:replaceable",
    label: "Replaceable",
    detail: "Can be replaced by placing another block on top of it, like grass or a flower.",
    fields: [],
    build: () => ({}),
  },
  {
    key: "liquidDetectionEnabled",
    component: "minecraft:liquid_detection",
    label: "Interacts with water",
    detail: "Controls waterlogging and what happens when water flows into this block.",
    fields: [
      { name: "canContainLiquid", type: "checkbox", label: "Can be waterlogged", def: true },
      {
        name: "onLiquidTouches",
        type: "select",
        label: "When water touches this block",
        def: "blocking",
        options: [
          ["blocking", "Blocks the water"],
          ["broken", "Block breaks"],
          ["no_reaction", "Water flows through"],
          ["popped", "Block pops off"],
        ],
      },
    ],
    build: (v) => ({
      detection_rules: [{ liquid_type: "water", can_contain_liquid: v.canContainLiquid !== false, on_liquid_touches: v.onLiquidTouches || "blocking" }],
    }),
  },
  {
    key: "movableEnabled",
    component: "minecraft:movable",
    label: "Piston interaction",
    detail: "How this block reacts when a piston tries to push/pull it.",
    fields: [
      {
        name: "movementType",
        type: "select",
        label: "Movement type",
        def: "push_pull",
        options: [
          ["push_pull", "Can be pushed and pulled"],
          ["push", "Can only be pushed"],
          ["popped", "Pops off as an item"],
          ["immovable", "Cannot be moved"],
        ],
      },
      { name: "movableSticky", type: "checkbox", label: "Sticky (like slime/honey blocks)" },
    ],
    build: (v) => {
      const out = { movement_type: v.movementType || "push_pull" };
      if (v.movableSticky) out.sticky = "same";
      return out;
    },
  },
  {
    key: "tagsEnabled",
    component: "minecraft:tags",
    label: "Custom tags",
    detail: "Attaches arbitrary tags to the block, usable in recipes/loot tables/scripts.",
    fields: [{ name: "tagsList", type: "text", label: "Tags (comma separated)", placeholder: "namespace:custom_tag" }],
    build: (v) => csvToArray(v.tagsList),
  },
];

// ---------------------------------------------------------------------------
// Block behavior-file JSON builder.
// ---------------------------------------------------------------------------

// `fields` mirrors the block-adder form, same shape as buildItemFileJSON's
// `fields.components` map ({ [schemaEntry.key]: { enabled, ...values } }).
// Produces a complete, standalone, valid minecraft:block JSON file --
// always with a minecraft:material_instances entry (texture) since a
// block with no texture at all renders as an untextured checkerboard,
// which is never what anyone actually wants.
function buildBlockFileJSON(fields) {
  const components = {};
  const textureName = fields.blockTexture || "custom:missing";
  components["minecraft:material_instances"] = { "*": { texture: textureName, render_method: fields.renderMethod || "opaque" } };
  if (fields.geometry) components["minecraft:geometry"] = fields.geometry;

  const chosen = fields.components || {};
  for (const entry of BLOCK_COMPONENT_SCHEMA) {
    if (entry.hidden) continue;
    const values = chosen[entry.key];
    if (!values || !values.enabled) continue;
    const result = entry.build(values);
    // A couple of block components (destructible_by_mining/_by_explosion)
    // legitimately build to boolean `false` on purpose (see their own
    // comments above) rather than "not present at all" -- `false` is a
    // valid, meaningful JSON value here so it must still be written out,
    // unlike the general "skip if falsy" checks used elsewhere.
    if (result === undefined) continue;
    components[entry.component] = result;
  }

  const description = { identifier: fields.identifier };
  if (fields.category) {
    description.menu_category = { category: fields.category };
  }

  const root = {
    format_version: "1.21.80",
    "minecraft:block": { description, components },
  };
  return JSON.stringify(root, null, 4) + "\n";
}

// Merges a new terrain_texture.json entry into whatever's already there --
// mirrors mergeItemTextureJson exactly, just pointed at the block texture
// atlas/folder instead of the item one (see
// https://wiki.bedrock.dev/blocks/block-visuals-intro#terrain-textures).
function mergeTerrainTextureJson(existingContent, shortName, rpPackName) {
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
    obj = { resource_pack_name: rpPackName || "pack", texture_name: "atlas.terrain", padding: 8, num_mip_levels: 4, texture_data: {} };
  }
  if (!obj.texture_data || typeof obj.texture_data !== "object") obj.texture_data = {};
  obj.texture_data[shortName] = { textures: `textures/blocks/${shortName}` };
  return JSON.stringify(obj, null, 4) + "\n";
}

// ---------------------------------------------------------------------------
// Full official entity BEHAVIOR component schema -- same shape/purpose as
// ITEM_COMPONENT_SCHEMA/BLOCK_COMPONENT_SCHEMA above. Every entry
// corresponds to a documented behavior-pack entity component (see
// https://learn.microsoft.com/minecraft/creator/.../entityreference and
// https://wiki.bedrock.dev/entities/vanilla-usage-components). Covers the
// components a hand-authored custom mob most commonly needs -- health,
// movement/navigation/AI goals, collision, physics, taming/breeding,
// combat, despawning, knockback, and the loot/equipment tables -- rather
// than literally all 200+ vanilla-usage components (many of which only
// make sense wired up to a specific existing vanilla behavior and would
// just be dead weight in a generic form). minecraft:type_family is always
// written automatically (see buildEntityBehaviorJSON) since practically
// every custom mob needs at least "mob" in its family list for other
// vanilla systems (targeting, spawn eggs, etc) to treat it correctly, so
// it isn't a toggle here.
// ---------------------------------------------------------------------------
const ENTITY_COMPONENT_SCHEMA = [
  {
    key: "healthEnabled",
    component: "minecraft:health",
    label: "Health",
    detail: "Max/starting hit points.",
    fields: [{ name: "healthValue", type: "number", label: "Health", def: "20" }],
    build: (v) => ({ value: clampInt(v.healthValue, 20, 1), max: clampInt(v.healthValue, 20, 1) }),
  },
  {
    key: "collisionBoxEnabled",
    component: "minecraft:collision_box",
    label: "Collision box size",
    detail: "The entity's physical width/height for collision purposes.",
    fields: [
      { name: "collisionWidth", type: "number", label: "Width", def: "0.6", step: "0.1" },
      { name: "collisionHeight", type: "number", label: "Height", def: "1.8", step: "0.1" },
    ],
    build: (v) => ({ width: numberOr(v.collisionWidth, 0.6), height: numberOr(v.collisionHeight, 1.8) }),
  },
  {
    key: "physicsEnabled",
    component: "minecraft:physics",
    label: "Physics (gravity + collision)",
    detail: "Gives the entity gravity and lets it collide with blocks -- almost always wanted.",
    fields: [],
    build: () => ({}),
  },
  {
    key: "nameableEnabled",
    component: "minecraft:nameable",
    label: "Nameable",
    detail: "Can be renamed with a name tag.",
    fields: [],
    build: () => ({}),
  },
  {
    key: "movementSpeedEnabled",
    component: "minecraft:movement",
    label: "Movement speed",
    detail: "How fast the entity walks.",
    fields: [{ name: "movementSpeed", type: "number", label: "Speed", def: "0.25", step: "0.05" }],
    build: (v) => ({ value: numberOr(v.movementSpeed, 0.25) }),
  },
  {
    key: "basicMovementEnabled",
    component: "minecraft:movement.basic",
    label: "Basic ground movement",
    detail: "Standard walking movement, like most land mobs.",
    fields: [],
    build: () => ({}),
  },
  {
    key: "walkNavigationEnabled",
    component: "minecraft:navigation.walk",
    label: "Walking navigation/pathfinding",
    detail: "Lets the entity path around obstacles on the ground.",
    fields: [
      { name: "canPathOverWater", type: "checkbox", label: "Can path over water" },
      { name: "avoidWater", type: "checkbox", label: "Avoid water", def: true },
    ],
    build: (v) => ({ can_path_over_water: !!v.canPathOverWater, avoid_water: v.avoidWater !== false }),
  },
  {
    key: "jumpStaticEnabled",
    component: "minecraft:jump.static",
    label: "Can jump",
    detail: "Standard jump height, needed to hop over 1-block obstacles.",
    fields: [],
    build: () => ({}),
  },
  {
    key: "canFlyEnabled",
    component: "minecraft:can_fly",
    label: "Can fly",
    detail: "Pathfinder won't require solid ground underneath.",
    fields: [],
    build: () => true,
  },
  {
    key: "floatsInLiquidEnabled",
    component: "minecraft:floats_in_liquid",
    label: "Floats in liquid",
    detail: "Bobs on the surface of water/lava instead of sinking.",
    fields: [],
    build: () => ({}),
  },
  {
    key: "attackEnabled",
    component: "minecraft:attack",
    label: "Melee attack damage",
    detail: "How much damage this entity deals when it attacks.",
    fields: [{ name: "attackDamage", type: "number", label: "Damage", def: "2" }],
    build: (v) => ({ damage: clampInt(v.attackDamage, 2, 0) }),
  },
  {
    key: "meleeAttackBehaviorEnabled",
    component: "minecraft:behavior.melee_attack",
    label: "AI: Melee attack goal",
    detail: "Actually chases and attacks its target -- pair with Attack Damage and a target-selection goal below.",
    fields: [
      { name: "meleePriority", type: "number", label: "Priority (lower = more important)", def: "2" },
      { name: "meleeSpeed", type: "number", label: "Speed multiplier", def: "1.0", step: "0.1" },
    ],
    build: (v) => ({ priority: clampInt(v.meleePriority, 2, 0), speed_multiplier: numberOr(v.meleeSpeed, 1.0), track_target: true }),
  },
  {
    key: "nearestAttackableTargetEnabled",
    component: "minecraft:behavior.nearest_attackable_target",
    label: "AI: Target nearest player",
    detail: "Picks the closest player to attack -- pairs with Melee Attack goal above for a hostile mob.",
    fields: [
      { name: "targetPriority", type: "number", label: "Priority", def: "2" },
      { name: "targetMaxDist", type: "number", label: "Max detection distance", def: "16" },
    ],
    build: (v) => ({
      priority: clampInt(v.targetPriority, 2, 0),
      reselect_targets: true,
      entity_types: [{ filters: { test: "is_family", subject: "other", value: "player" }, max_dist: clampInt(v.targetMaxDist, 16, 1) }],
    }),
  },
  {
    key: "hurtByTargetEnabled",
    component: "minecraft:behavior.hurt_by_target",
    label: "AI: Retaliate when hurt",
    detail: "Starts targeting whatever just attacked it.",
    fields: [{ name: "hurtByPriority", type: "number", label: "Priority", def: "1" }],
    build: (v) => ({ priority: clampInt(v.hurtByPriority, 1, 0) }),
  },
  {
    key: "randomStrollEnabled",
    component: "minecraft:behavior.random_stroll",
    label: "AI: Wander around randomly",
    detail: "Idle wandering behavior, like passive mobs grazing around.",
    fields: [
      { name: "strollPriority", type: "number", label: "Priority", def: "6" },
      { name: "strollSpeed", type: "number", label: "Speed multiplier", def: "1.0", step: "0.1" },
    ],
    build: (v) => ({ priority: clampInt(v.strollPriority, 6, 0), speed_multiplier: numberOr(v.strollSpeed, 1.0) }),
  },
  {
    key: "lookAtPlayerEnabled",
    component: "minecraft:behavior.look_at_player",
    label: "AI: Look at nearby players",
    detail: "Turns its head to face a nearby player, purely cosmetic.",
    fields: [
      { name: "lookPriority", type: "number", label: "Priority", def: "7" },
      { name: "lookDistance", type: "number", label: "Look distance", def: "6" },
    ],
    build: (v) => ({ priority: clampInt(v.lookPriority, 7, 0), look_distance: numberOr(v.lookDistance, 6) }),
  },
  {
    key: "breathableEnabled",
    component: "minecraft:breathable",
    label: "Breathable (needs air)",
    detail: "Can drown if submerged too long -- omit for fish/aquatic mobs.",
    fields: [{ name: "airSupply", type: "number", label: "Total air supply (ticks)", def: "15" }],
    build: (v) => ({ total_supply: clampInt(v.airSupply, 15, 1), suffocate_time: 0 }),
  },
  {
    key: "scaleEnabled",
    component: "minecraft:scale",
    label: "Scale (size multiplier)",
    detail: "Makes the whole model bigger/smaller.",
    fields: [{ name: "scaleValue", type: "number", label: "Scale", def: "1.0", step: "0.1" }],
    build: (v) => ({ value: numberOr(v.scaleValue, 1.0) }),
  },
  {
    key: "despawnEnabled",
    component: "minecraft:despawn",
    label: "Despawns when far from players",
    detail: "Standard despawn rules for unnamed, non-persistent mobs.",
    fields: [],
    build: () => ({ despawn_from_distance: {} }),
  },
  {
    key: "rideableEnabled",
    component: "minecraft:rideable",
    label: "Rideable",
    detail: "Lets a player sit on/ride this entity.",
    fields: [{ name: "rideableSeatCount", type: "number", label: "Seat count", def: "1" }],
    build: (v) => ({
      seat_count: clampInt(v.rideableSeatCount, 1, 1),
      family_types: ["player"],
      seats: { position: [0, 0.5, 0] },
    }),
  },
  {
    key: "tameableEnabled",
    component: "minecraft:tameable",
    label: "Tameable",
    detail: "Can be tamed with a specific item, like wolves with bones.",
    fields: [
      { name: "tameProbability", type: "number", label: "Tame chance per attempt (0-1)", def: "0.3", step: "0.05" },
      { name: "tameItems", type: "text", label: "Tame item(s), comma separated", def: "minecraft:bone" },
    ],
    build: (v) => {
      const items = csvToArray(v.tameItems);
      return { probability: numberOr(v.tameProbability, 0.3), tame_items: items.length > 1 ? items : items[0] || "minecraft:bone" };
    },
  },
  {
    key: "breedableEnabled",
    component: "minecraft:breedable",
    label: "Breedable",
    detail: "Two of this entity can breed to make a baby when fed the right item.",
    fields: [
      { name: "breedItems", type: "text", label: "Breed item(s), comma separated", def: "minecraft:wheat" },
      { name: "requireTame", type: "checkbox", label: "Must be tamed first" },
    ],
    build: (v) => {
      const items = csvToArray(v.breedItems);
      return {
        require_tame: !!v.requireTame,
        breeds_with: { mate_type: "SELF_IDENTIFIER", baby_type: "SELF_IDENTIFIER", breed_event: { event: "minecraft:entity_born", target: "baby" } },
        breed_items: items.length > 1 ? items : items[0] || "minecraft:wheat",
      };
    },
  },
  {
    key: "ageableEnabled",
    component: "minecraft:ageable",
    label: "Ageable (baby/adult)",
    detail: "Spawns as a baby that grows into an adult over time -- pairs well with Breedable.",
    fields: [
      { name: "ageDuration", type: "number", label: "Grow-up duration (seconds)", def: "1200" },
      { name: "ageFeedItems", type: "text", label: "Feed items to speed growth (comma separated)", def: "minecraft:wheat" },
    ],
    build: (v) => ({
      duration: clampInt(v.ageDuration, 1200, 1),
      feed_items: csvToArray(v.ageFeedItems).length ? csvToArray(v.ageFeedItems) : ["minecraft:wheat"],
      grow_up: { event: "minecraft:ageable_grow_up", target: "self" },
    }),
  },
  {
    key: "followRangeEnabled",
    component: "minecraft:follow_range",
    label: "Follow/aggro range",
    detail: "Max distance a mob will pursue its target.",
    fields: [{ name: "followRangeValue", type: "number", label: "Range (blocks)", def: "32" }],
    build: (v) => ({ value: numberOr(v.followRangeValue, 32) }),
  },
  {
    key: "knockbackResistanceEnabled",
    component: "minecraft:knockback_resistance",
    label: "Knockback resistance",
    detail: "0 = normal knockback, 1 = completely immune.",
    fields: [{ name: "knockbackValue", type: "number", label: "Resistance (0-1)", def: "0", step: "0.1" }],
    build: (v) => ({ value: Math.min(1, Math.max(0, numberOr(v.knockbackValue, 0))) }),
  },
  {
    key: "fireImmuneEnabled",
    component: "minecraft:fire_immune",
    label: "Fire immune",
    detail: "Never takes damage from fire or lava.",
    fields: [],
    build: () => true,
  },
  {
    key: "burnsInDaylightEnabled",
    component: "minecraft:burns_in_daylight",
    label: "Burns in daylight",
    detail: "Takes fire damage in direct sunlight, like zombies/skeletons.",
    fields: [],
    build: () => ({}),
  },
  {
    key: "leashableEnabled",
    component: "minecraft:leashable",
    label: "Leashable",
    detail: "Can be attached to a lead.",
    fields: [{ name: "leashMaxDistance", type: "number", label: "Max lead distance before it snaps", def: "10" }],
    build: (v) => ({ soft_distance: 4.0, hard_distance: 6.0, max_distance: numberOr(v.leashMaxDistance, 10) }),
  },
  {
    key: "experienceRewardEnabled",
    component: "minecraft:experience_reward",
    label: "Grants XP on death",
    detail: "How much experience the player gets for killing this entity.",
    fields: [{ name: "xpOnDeath", type: "number", label: "XP amount", def: "5" }],
    build: (v) => ({ on_death: String(clampInt(v.xpOnDeath, 5, 0)) }),
  },
  {
    key: "equipmentEnabled",
    component: "minecraft:equipment",
    label: "Uses an equipment loot table",
    detail: "Randomly equips items (armor/weapons) on spawn from a loot table.",
    fields: [{ name: "equipmentTablePath", type: "text", label: "Equipment table path", placeholder: "loot_tables/entities/my_mob_equipment.json" }],
    build: (v) => ({ table: (v.equipmentTablePath || "").trim() || "loot_tables/entities/equipment.json" }),
  },
  {
    key: "isHiddenWhenInvisibleEnabled",
    component: "minecraft:is_hidden_when_invisible",
    label: "Fully invisible with Invisibility",
    detail: "Hides armor/name tag too when affected by an invisibility effect.",
    fields: [],
    build: () => ({}),
  },
];

// ---------------------------------------------------------------------------
// Entity behavior-file (BP) JSON builder.
// ---------------------------------------------------------------------------

// `fields.components` is the same { [schemaEntry.key]: { enabled, ...values } }
// shape used by the Item/Block adders. Always writes minecraft:type_family
// (["mob", <own short name>]) since that's needed by other vanilla systems
// (targeting filters, spawn eggs, /summon family selectors) even on a
// minimal mob, and always sets is_spawnable/is_summonable so the entity
// actually shows up as usable immediately (matching the official "Creating
// New Entity Types" tutorial's own minimal example).
function buildEntityBehaviorJSON(fields) {
  const shortName = fields.identifier.split(":")[1];
  const components = {};
  components["minecraft:type_family"] = { family: ["mob", shortName] };

  const chosen = fields.components || {};
  for (const entry of ENTITY_COMPONENT_SCHEMA) {
    const values = chosen[entry.key];
    if (!values || !values.enabled) continue;
    let result = entry.build(values);
    // minecraft:breedable's breeds_with needs to reference this entity's
    // OWN identifier for mate_type/baby_type (a same-species breed) --
    // filled in here (once the real identifier is known) rather than
    // inside the schema entry itself, which has no way to know it.
    if (entry.key === "breedableEnabled" && result && result.breeds_with) {
      result = {
        ...result,
        breeds_with: { ...result.breeds_with, mate_type: fields.identifier, baby_type: fields.identifier },
      };
    }
    components[entry.component] = result;
  }

  if (fields.lootTablePath) {
    components["minecraft:loot"] = { table: fields.lootTablePath };
  }

  const description = {
    identifier: fields.identifier,
    is_spawnable: true,
    is_summonable: true,
    is_experimental: false,
  };

  const root = {
    format_version: "1.21.80",
    "minecraft:entity": { description, components },
  };
  return JSON.stringify(root, null, 4) + "\n";
}

// ---------------------------------------------------------------------------
// Entity client (RP) JSON builder -- see
// https://wiki.bedrock.dev/entities/entity-intro-rp. Defines the visual
// side: a texture/geometry/material shortname triple plus (optionally) a
// spawn egg color pair, wired into a single default render controller so
// the entity actually renders as *something* immediately (a textured cube
// via the built-in "geometry.humanoid" fallback when no real custom model
// exists yet) rather than being invisible.
// ---------------------------------------------------------------------------
function buildEntityClientJSON(fields) {
  const shortName = fields.identifier.split(":")[1];
  const description = {
    identifier: fields.identifier,
    materials: { default: "entity_alphatest" },
    textures: { default: fields.entityTexture ? `textures/entity/${shortName}` : "textures/entity/steve" },
    geometry: { default: fields.geometryId || "geometry.humanoid.custom" },
    render_controllers: ["controller.render.default"],
  };
  if (fields.spawnEggBaseColor) {
    description.spawn_egg = { base_color: fields.spawnEggBaseColor, overlay_color: fields.spawnEggOverlayColor || fields.spawnEggBaseColor };
  }
  const root = {
    format_version: "1.10.0",
    "minecraft:client_entity": { description },
  };
  return JSON.stringify(root, null, 4) + "\n";
}

// ---------------------------------------------------------------------------
// Loot table builder -- see https://wiki.bedrock.dev/loot/loot-tables and
// https://learn.microsoft.com/minecraft/creator/documents/createloottable.
// `drops` is an array of { item, weight, minCount, maxCount } -- rendered
// as a single pool with `rolls: 1` and one entry per drop, each optionally
// wrapped in a minecraft:set_count function when a count range was given
// (matching the exact function shape used in every official example).
// Deliberately supports only this one common shape (a flat list of
// possible single-roll drops) rather than the full recursive
// pools/conditions/functions grammar loot tables can express -- covers the
// overwhelming majority of "what does this custom mob drop" use cases
// without needing a mini rules-editor UI for the long tail of advanced
// cases (nested pools, kill-conditions, loot_table-type sub-entries, ...).
function buildLootTableJSON(drops) {
  const entries = (drops || [])
    .filter((d) => d.item && d.item.trim())
    .map((d) => {
      const entry = { type: "item", name: d.item.trim(), weight: clampInt(d.weight, 1, 1) };
      const min = clampInt(d.minCount, 1, 0);
      const max = clampInt(d.maxCount, 1, 0);
      if (min !== 1 || max !== 1) {
        entry.functions = [{ function: "set_count", count: min === max ? min : { min: Math.min(min, max), max: Math.max(min, max) } }];
      }
      return entry;
    });
  const root = { pools: entries.length ? [{ rolls: 1, entries }] : [] };
  return JSON.stringify(root, null, 4) + "\n";
}

// ---------------------------------------------------------------------------
// Trade table builder -- see
// https://learn.microsoft.com/minecraft/creator/documents/createtradetable
// and https://wiki.bedrock.dev/loot/trade-tables. A trade table is an
// un-versioned, un-namespaced JSON object of "tiers" (villager XP levels --
// tier 1 is always unlocked regardless of total_exp_required), each
// containing "trades" (a flat list here -- this app deliberately always
// emits the simpler flat `trades` array per tier rather than nesting a
// `groups` layer of randomized alternatives, since a hand-authored custom
// trader almost always wants every listed trade to actually be offered,
// not have some of them randomly hidden -- the full groups/num_to_select
// grammar is still perfectly valid Bedrock JSON that a user can hand-edit
// in on top of what this generates, same "cover the common case, not
// the entire grammar" tradeoff as buildLootTableJSON above).
//
// `tiers` is an array of { xpRequired, trades: [...] }, where each trade
// is { wants: [{item, quantity, priceMultiplier}, ...], gives: [{item,
// quantity}, ...], maxUses, rewardExp }. A trade's `wants`/`gives` accept
// more than one item (Bedrock supports multi-item trades, e.g. book +
// emeralds for an enchanted item) so each is an array here, not a single
// object.
function buildTradeTableJSON(tiers) {
  function buildTradeItem(item) {
    const out = { item: item.item.trim() };
    const min = clampInt(item.minCount, 1, 1);
    const max = clampInt(item.maxCount, 1, 1);
    out.quantity = min === max ? min : { min: Math.min(min, max), max: Math.max(min, max) };
    if (item.priceMultiplier !== undefined && item.priceMultiplier !== "") {
      out.price_multiplier = numberOr(item.priceMultiplier, 0.05);
    }
    return out;
  }

  const builtTiers = (tiers || [])
    .map((tier) => {
      const trades = (tier.trades || [])
        .filter((t) => t.wants.some((w) => w.item && w.item.trim()) && t.gives.some((g) => g.item && g.item.trim()))
        .map((t) => {
          const trade = {
            wants: t.wants.filter((w) => w.item && w.item.trim()).map(buildTradeItem),
            gives: t.gives.filter((g) => g.item && g.item.trim()).map(buildTradeItem),
          };
          trade.max_uses = clampInt(t.maxUses, 12, 1);
          trade.trader_exp = clampInt(t.traderExp, 1, 0);
          trade.reward_exp = t.rewardExp !== false;
          return trade;
        });
      return { trades, xpRequired: clampInt(tier.xpRequired, 0, 0) };
    })
    .filter((tier) => tier.trades.length > 0);

  const root = {
    tiers: builtTiers.map((tier, i) => {
      const out = { trades: tier.trades };
      // Even though the very first tier is always unlocked regardless of
      // this value (per Mojang's own docs), still write total_exp_required
      // explicitly for every tier including the first -- an explicit "0"
      // is clearer to read/edit by hand afterwards than an implicit
      // default, and matches every official example file (see
      // butcher_trades.json/farmer_trades.json samples).
      out.total_exp_required = i === 0 ? 0 : tier.xpRequired;
      return out;
    }),
  };
  return JSON.stringify(root, null, 4) + "\n";
}

// Builds a small, ready-to-use trading entity's BEHAVIOR file (BP) that
// actually uses a trade table -- see
// https://wiki.bedrock.dev/loot/trading-behavior. Bedrock has a real,
// documented footgun here: putting minecraft:trade_table (or
// minecraft:economy_trade_table) + minecraft:behavior.trade_with_player
// directly in the root `components` object causes blank trading UIs for
// EVERY entity of that type in the world (a known engine bug, not a typo
// in the docs) -- they must instead live inside a `component_groups` entry
// that's added via an event (conventionally minecraft:entity_spawned, so
// it's applied the moment the entity exists). This mirrors that exact
// structure rather than the naive "just put it in components" version a
// lot of outdated tutorials still show.
function buildTradingEntityBehaviorJSON(fields) {
  const shortName = fields.identifier.split(":")[1];
  const traderGroupName = `${fields.identifier.split(":")[0]}:trader`;

  const components = {
    "minecraft:type_family": { family: ["mob", shortName] },
    "minecraft:health": { value: 20, max: 20 },
    "minecraft:collision_box": { width: 0.6, height: 1.9 },
    "minecraft:physics": {},
    "minecraft:nameable": {},
    "minecraft:movement": { value: 0.25 },
    "minecraft:movement.basic": {},
    "minecraft:navigation.walk": { can_path_over_water: true, avoid_water: false },
    "minecraft:jump.static": {},
    "minecraft:behavior.random_stroll": { priority: 6, speed_multiplier: 1.0 },
    "minecraft:behavior.look_at_player": { priority: 7, look_distance: 6 },
  };

  const root = {
    format_version: "1.21.80",
    "minecraft:entity": {
      description: {
        identifier: fields.identifier,
        is_spawnable: true,
        is_summonable: true,
        is_experimental: false,
      },
      component_groups: {
        [traderGroupName]: {
          "minecraft:trade_table": {
            display_name: fields.displayName || "Trading",
            table: fields.tradeTablePath,
            new_screen: true,
          },
          "minecraft:behavior.trade_with_player": { priority: 1 },
        },
      },
      components,
      events: {
        "minecraft:entity_spawned": { add: { component_groups: [traderGroupName] } },
      },
    },
  };
  return JSON.stringify(root, null, 4) + "\n";
}

// Derives the behavior pack root folder an entity file lives under, purely
// from its own path -- every Bedrock entity behavior file lives at
// "<bpRoot>/entities/<...>.json" (possibly nested further under
// entities/), so this just returns everything before the "entities"
// segment. Used so trading can be attached to an existing entity file
// using ITS OWN pack's root (and therefore write a correctly-relative
// minecraft:trade_table "table" path into ITS OWN pack), rather than
// assuming it's necessarily the same BP folder `ensureAddonScaffold`
// would separately detect by naming convention -- those normally agree in
// a typical single-BP project, but deriving it directly from the actual
// file being edited is strictly more correct and costs nothing extra.
// Returns null if the path doesn't contain an "entities" segment at all
// (not a standard entity file location), in which case the caller should
// fall back to whatever `ensureAddonScaffold` already found.
function bpRootFromEntityFilePath(path) {
  const segments = path.split("/");
  const idx = segments.indexOf("entities");
  if (idx === -1) return null;
  return segments.slice(0, idx).join("/");
}

// Looks for an existing behavior-pack entity FILE (a "minecraft:entity"
// JSON, not a client_entity/resource-pack one) whose own
// description.identifier exactly matches `identifier`, anywhere in the
// project. Used by the Trade adder to decide whether an Entity ID the user
// typed refers to something that already exists (in which case trading
// should be attached to THAT file) versus something brand new (in which
// case a whole new trading mob is created, same as before). Returns the
// VFS file node, or null if nothing matches.
function findEntityFileByIdentifier(vfs, identifier) {
  for (const node of vfs.allFiles()) {
    if (node.ext !== "json" || !node.isText) continue;
    let obj;
    try {
      obj = JSON.parse(node.content ?? "");
    } catch (e) {
      continue; // not valid JSON right now -- skip rather than error out
    }
    const entity = obj && obj["minecraft:entity"];
    if (entity && entity.description && entity.description.identifier === identifier) {
      return node;
    }
  }
  return null;
}

// Merges trading behavior into an EXISTING entity's behavior-file JSON
// (rather than building a brand new file from scratch, the way
// buildTradingEntityBehaviorJSON does for a new entity) -- adds a new
// component_group carrying minecraft:trade_table +
// minecraft:behavior.trade_with_player, and wires it in via the
// minecraft:entity_spawned event, WITHOUT touching any of the entity's
// other existing components/component_groups/events. Same documented
// "component_groups + event, never directly in components" safety
// requirement as buildTradingEntityBehaviorJSON above -- see
// https://wiki.bedrock.dev/loot/trading-behavior.
//
// If minecraft:entity_spawned already has some other "add" logic (e.g. the
// entity already spawns with a different component group, or uses
// "sequence"/"randomize" instead of a plain "add"), this deliberately
// still ONLY appends to an existing plain `add.component_groups` array --
// it never overwrites/replaces a more complex existing event structure it
// doesn't fully understand, since guessing wrong there could silently
// break the entity's existing spawn behavior. In that case the trader
// group is still created and available, it just needs to be added to
// the event manually (the returned `needsManualEventWiring` flag tells
// the caller to say so).
function mergeTradeIntoEntityBehaviorJSON(existingContent, fields) {
  let obj;
  try {
    obj = JSON.parse(existingContent);
  } catch (e) {
    throw new Error("That entity's behavior file isn't valid JSON right now, so trading can't be safely added to it.");
  }
  const entity = obj && obj["minecraft:entity"];
  if (!entity) throw new Error("That file doesn't look like a behavior-pack entity (no \"minecraft:entity\" root key).");

  const namespace = fields.identifier.split(":")[0];
  const baseGroupName = `${namespace}:trader`;
  if (!entity.component_groups || typeof entity.component_groups !== "object") entity.component_groups = {};
  // Avoid clobbering a same-named component group the entity might already
  // have defined for something unrelated -- pick a fresh name the same way
  // VFS.uniquePath avoids clobbering files.
  let groupName = baseGroupName;
  let i = 1;
  while (entity.component_groups[groupName]) {
    groupName = `${baseGroupName}_${i}`;
    i++;
  }
  entity.component_groups[groupName] = {
    "minecraft:trade_table": {
      display_name: fields.displayName || "Trading",
      table: fields.tradeTablePath,
      new_screen: true,
    },
    "minecraft:behavior.trade_with_player": { priority: 1 },
  };

  if (!entity.events || typeof entity.events !== "object") entity.events = {};
  const spawnedEvent = entity.events["minecraft:entity_spawned"];
  let needsManualEventWiring = false;
  if (!spawnedEvent) {
    entity.events["minecraft:entity_spawned"] = { add: { component_groups: [groupName] } };
  } else if (spawnedEvent.add && Array.isArray(spawnedEvent.add.component_groups)) {
    spawnedEvent.add.component_groups.push(groupName);
  } else {
    // Something more complex already lives on this event (sequence/
    // randomize/filters/...) -- don't guess, leave it untouched.
    needsManualEventWiring = true;
  }

  return { content: JSON.stringify(obj, null, 4) + "\n", groupName, needsManualEventWiring };
}

// ---------------------------------------------------------------------------
// Splash text builder -- see https://wiki.bedrock.dev/text/splashes.
// splashes.json lives directly at the resource pack root (not inside a
// subfolder) and has just two fields: `canMerge` (whether vanilla's own
// splash texts are also shown alongside the custom ones) and `splashes` (an
// ordered array of plain strings, each optionally using "§" formatting
// codes exactly like any other in-game text).
// ---------------------------------------------------------------------------

// Merges one or more new splash lines into whatever's already in
// splashes.json (parsed with plain JSON.parse -- same "never destroy
// existing content on a parse failure" rule as mergeItemTextureJson above:
// an invalid/missing existing file just starts a fresh, minimal, valid one
// instead of throwing content away). Skips exact-duplicate lines so
// re-adding the same splash twice doesn't pad the list with repeats.
function mergeSplashesJson(existingContent, newLines, canMerge) {
  let obj = null;
  if (existingContent) {
    try {
      const parsed = JSON.parse(existingContent);
      if (parsed && typeof parsed === "object") obj = parsed;
    } catch (e) {
      obj = null;
    }
  }
  if (!obj) obj = { canMerge: !!canMerge, splashes: [] };
  if (!Array.isArray(obj.splashes)) obj.splashes = [];
  // Only touch canMerge when the caller actually passed a value for it --
  // editing an already-existing splashes.json to add one more line
  // shouldn't silently flip a setting the user (or a previous session)
  // deliberately chose, unless they're explicitly changing it this time.
  if (canMerge !== undefined) obj.canMerge = !!canMerge;
  for (const line of newLines) {
    if (!obj.splashes.includes(line)) obj.splashes.push(line);
  }
  return JSON.stringify(obj, null, 4) + "\n";
}

// ---------------------------------------------------------------------------
// Sound / music builder -- see https://wiki.bedrock.dev/concepts/sounds.
//
// Every custom sound (a one-shot effect OR a music track) needs an entry in
// sound_definitions.json mapping a short "sound event" identifier to one or
// more actual audio file paths (no extension -- Bedrock tries whatever
// format is actually present next to that path at runtime). A *music*
// track additionally needs an entry in music_definitions.json mapping a
// biome/menu/game "trigger name" to the `music.xxx`-style event name that
// sound_definitions.json just defined, plus how long to wait between plays.
// Only mp3/ogg/wav are ever accepted as uploads here -- matching this app's
// existing AUDIO_EXTENSIONS set (app/utils.js) used everywhere else
// (import, preview player, ...), since those are the only formats a plain
// <audio> element (and this app's own preview player) can play back for a
// sanity-check before export; Bedrock itself only actually ships/plays
// .ogg in its own vanilla packs, but community tooling and Minecraft's
// resource pack loader both still accept .mp3/.wav additions in practice,
// and it's not this editor's job to transcode audio.
// ---------------------------------------------------------------------------

// Merges a new sound_definitions.json entry (bare category + one-or-more
// paths). `soundPaths` is an array of "sounds/xxx" style paths (no file
// extension) as accepted by Bedrock. Same "never destroy existing content
// on a parse failure" fallback as the other merge* helpers above.
function mergeSoundDefinitionsJson(existingContent, eventName, category, soundPaths) {
  let obj = null;
  if (existingContent) {
    try {
      const parsed = JSON.parse(existingContent);
      if (parsed && typeof parsed === "object") obj = parsed;
    } catch (e) {
      obj = null;
    }
  }
  if (!obj) obj = { format_version: "1.14.0", sound_definitions: {} };
  if (!obj.sound_definitions || typeof obj.sound_definitions !== "object") obj.sound_definitions = {};
  obj.sound_definitions[eventName] = { category: category || "neutral", sounds: soundPaths };
  return JSON.stringify(obj, null, 4) + "\n";
}

// Merges a new music_definitions.json entry (trigger name -> event name +
// min/max replay delay in seconds). Trigger names are free-form (Mojang's
// own file uses biome names like "desert"/"nether"/"menu"/"creative" --
// nothing enforces that list, any custom trigger name also works as long
// as something actually references it, e.g. a custom biome).
function mergeMusicDefinitionsJson(existingContent, triggerName, eventName, minDelay, maxDelay) {
  let obj = null;
  if (existingContent) {
    try {
      const parsed = JSON.parse(existingContent);
      if (parsed && typeof parsed === "object") obj = parsed;
    } catch (e) {
      obj = null;
    }
  }
  if (!obj) obj = {};
  obj[triggerName] = { event_name: eventName, min_delay: clampInt(minDelay, 60, 0), max_delay: clampInt(maxDelay, 180, 0) };
  return JSON.stringify(obj, null, 4) + "\n";
}

// ---------------------------------------------------------------------------
// Function (.mcfunction) builder -- see
// https://minecraft.wiki/w/Function_(Bedrock_Edition). Unlike every other
// content type this app adds, a Bedrock function has no JSON identifier at
// all: it's a plain-text file of one command per line (no leading "/"),
// referenced purely by its file PATH relative to BP/functions/ (with the
// ".mcfunction" extension dropped), e.g. a file at
// BP/functions/combat/heal.mcfunction is run as `/function combat/heal`.
// So "identifier" handling here is just a filesystem-safe relative path,
// not a namespace:name pair -- deliberately NOT reusing
// normalizeNamespacedIdentifier for that reason.
// ---------------------------------------------------------------------------

// Turns free-typed text into a safe relative function path: lowercase,
// spaces/backslashes become "/", each path segment is slugified
// individually (same per-segment approach as slugifyEventName, so
// "Combat/Heal Player!" -> "combat/heal_player" keeps its folder
// structure instead of collapsing into one run), leading/trailing/
// duplicate slashes trimmed. Never returns a leading "/" (functions are
// always relative to BP/functions/, there's no "root" to escape to above
// that).
function slugifyFunctionPath(raw) {
  const trimmed = (raw || "").trim().replace(/\\/g, "/");
  return trimmed
    .split("/")
    .map((segment) => slugifyIdToken(segment))
    .filter(Boolean)
    .join("/");
}

// Builds the actual .mcfunction file content: one command per line, each
// with any leading "/" stripped (Bedrock functions never use the slash --
// see the wiki page above), blank lines and "#comment" lines passed
// through untouched. Ends with a single trailing newline (same convention
// as every other builder in this file).
function buildFunctionFileContent(lines) {
  const cleaned = (lines || []).map((rawLine) => {
    const line = rawLine.replace(/\s+$/, "");
    const trimmedStart = line.replace(/^\s*/, "");
    if (trimmedStart.startsWith("#") || !trimmedStart.startsWith("/")) return line;
    // Strip exactly one leading "/" (right after any indentation), never
    // touching the rest of the line -- Bedrock functions never use the
    // slash prefix real chat commands use, but people habitually type it
    // out of muscle memory.
    const indentLen = line.length - trimmedStart.length;
    return line.slice(0, indentLen) + trimmedStart.slice(1);
  });
  const text = cleaned.join("\n").replace(/\n+$/, "");
  return text ? `${text}\n` : "";
}

// Merges a function path into BP/functions/tick.json's `values` array (the
// one and only function tag file Bedrock actually supports -- there is no
// load.json/other tags/functions folder like Java's data packs, per
// https://minecraft.wiki/w/Function_(Bedrock_Edition)#tick.json). Values
// here are bare function paths -- no namespace, no ".mcfunction"
// extension, matching every official/community example (e.g. {"values":
// ["combat/heal"]}, not {"values": ["mypack:combat/heal"]}). Same "never
// destroy existing content on a parse failure" fallback and
// skip-exact-duplicates behavior as mergeSplashesJson.
function mergeTickJson(existingContent, functionPath) {
  let obj = null;
  if (existingContent) {
    try {
      const parsed = JSON.parse(existingContent);
      if (parsed && typeof parsed === "object") obj = parsed;
    } catch (e) {
      obj = null;
    }
  }
  if (!obj) obj = { values: [] };
  if (!Array.isArray(obj.values)) obj.values = [];
  if (!obj.values.includes(functionPath)) obj.values.push(functionPath);
  return JSON.stringify(obj, null, 4) + "\n";
}

// A small library of common command snippets shown as tappable chips in
// the Function adder, since typing full Bedrock command syntax from
// scratch on a phone keyboard is slow and error-prone. Each inserts its
// `command` at the textarea's current cursor position, same interaction
// as the Splash adder's "\u00A7 formatting code" chips. Deliberately a
// short, curated list of the most commonly used commands in hand-written
// functions rather than the full command reference (100+ commands) --
// covers the overwhelming majority of "give me a starting point" cases
// without turning this into an unusable wall of buttons on a small screen.
const FUNCTION_COMMAND_SNIPPETS = [
  ["say Hello!", "say"],
  ["tell @p Hello!", "tell"],
  ["give @p minecraft:apple 1", "give"],
  ["effect @p speed 10 1", "effect"],
  ["summon minecraft:cow ~ ~ ~", "summon"],
  ["execute as @a at @s run say Hi", "execute as/at"],
  ["execute if entity @p run say Found a player", "execute if entity"],
  ["fill ~-1 ~-1 ~-1 ~1 ~1 ~1 minecraft:air", "fill"],
  ["setblock ~ ~ ~ minecraft:stone", "setblock"],
  ["playsound random.orb @p", "playsound"],
  ["particle minecraft:heart ~ ~1 ~", "particle"],
  ["scoreboard objectives add my_objective dummy", "scoreboard add"],
  ["scoreboard players set @p my_objective 1", "scoreboard set"],
  ["tag @p add my_tag", "tag add"],
  ["title @p title Hello!", "title"],
  ["function another_function", "function"],
];

window.ContentBuilders = {
  allFolderPaths,
  detectPackTypeFromManifestContent,
  findPackRootFolder,
  ensureAddonScaffold,
  slugifyIdToken,
  slugifyEventName,
  normalizeItemIdentifier,
  normalizeNamespacedIdentifier,
  buildItemFileJSON,
  mergeItemTextureJson,
  mergeSplashesJson,
  mergeSoundDefinitionsJson,
  mergeMusicDefinitionsJson,
  buildBlockFileJSON,
  mergeTerrainTextureJson,
  buildEntityBehaviorJSON,
  buildEntityClientJSON,
  buildLootTableJSON,
  buildTradeTableJSON,
  buildTradingEntityBehaviorJSON,
  bpRootFromEntityFilePath,
  findEntityFileByIdentifier,
  mergeTradeIntoEntityBehaviorJSON,
  slugifyFunctionPath,
  buildFunctionFileContent,
  mergeTickJson,
  FUNCTION_COMMAND_SNIPPETS,
  ITEM_COMPONENT_SCHEMA,
  BLOCK_COMPONENT_SCHEMA,
  ENTITY_COMPONENT_SCHEMA,
};



