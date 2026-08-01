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

window.ContentBuilders = {
  allFolderPaths,
  detectPackTypeFromManifestContent,
  findPackRootFolder,
  ensureAddonScaffold,
  slugifyIdToken,
  normalizeItemIdentifier,
  buildItemFileJSON,
  mergeItemTextureJson,
  mergeSplashesJson,
  ITEM_COMPONENT_SCHEMA,
};

