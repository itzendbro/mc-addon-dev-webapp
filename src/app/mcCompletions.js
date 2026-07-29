// ---------------------------------------------------------------------------
// Hand written completion dictionaries that make editing Minecraft Bedrock
// (MCPE/MCBE) add-on JSON and JavaScript feel closer to VS Code + the
// bedrock-samples IntelliSense extensions. These are intentionally static
// (no schema fetching) so the app works fully offline on a phone.
// ---------------------------------------------------------------------------

// Each entry: { label, snippet, detail, type }
// `snippet` uses CodeMirror snippet syntax: ${1:placeholder}, ${2:other}, $0 for final cursor.

export const JSON_SNIPPETS = [
  // ---- manifest -----------------------------------------------------------
  { label: "format_version", snippet: '"format_version": ${1:2}', detail: "manifest field", type: "property" },
  { label: "header", snippet: '"header": {\n\t"name": "${1:pack.name}",\n\t"description": "${2:pack.description}",\n\t"uuid": "${3:uuid}",\n\t"version": [${4:1}, ${5:0}, ${6:0}],\n\t"min_engine_version": [${7:1}, ${8:21}, ${9:70}]\n}$0', detail: "manifest header block", type: "property" },
  { label: "modules", snippet: '"modules": [\n\t{\n\t\t"type": "${1:data}",\n\t\t"uuid": "${2:uuid}",\n\t\t"version": [${3:1}, ${4:0}, ${5:0}]\n\t}\n]$0', detail: "manifest modules block", type: "property" },
  { label: "module: data", snippet: '{\n\t"description": "${1:pack.description}",\n\t"type": "data",\n\t"uuid": "${2:uuid}",\n\t"version": [${3:1}, ${4:0}, ${5:0}]\n}$0', detail: "behavior module", type: "keyword" },
  { label: "module: script", snippet: '{\n\t"type": "script",\n\t"language": "javascript",\n\t"uuid": "${1:uuid}",\n\t"entry": "${2:scripts/main.js}",\n\t"version": [${3:1}, ${4:0}, ${5:0}]\n}$0', detail: "script module", type: "keyword" },
  { label: "module: resources", snippet: '{\n\t"type": "resources",\n\t"uuid": "${1:uuid}",\n\t"version": [${2:1}, ${3:0}, ${4:0}]\n}$0', detail: "resource module", type: "keyword" },
  { label: "module: client_data", snippet: '{\n\t"type": "client_data",\n\t"uuid": "${1:uuid}",\n\t"version": [${2:1}, ${3:0}, ${4:0}]\n}$0', detail: "client data module", type: "keyword" },
  { label: "dependencies", snippet: '"dependencies": [\n\t{\n\t\t"uuid": "${1:uuid}",\n\t\t"version": [${2:1}, ${3:0}, ${4:0}]\n\t}\n]$0', detail: "manifest dependencies", type: "property" },
  { label: "dependency: @minecraft/server", snippet: '{\n\t"module_name": "@minecraft/server",\n\t"version": "${1:1.19.0}"\n}$0', detail: "script API dependency", type: "keyword" },
  { label: "dependency: @minecraft/server-ui", snippet: '{\n\t"module_name": "@minecraft/server-ui",\n\t"version": "${1:1.3.0}"\n}$0', detail: "script API dependency", type: "keyword" },
  { label: "dependency: @minecraft/server-net", snippet: '{\n\t"module_name": "@minecraft/server-net",\n\t"version": "${1:1.0.0}"\n}$0', detail: "script API dependency", type: "keyword" },
  { label: "capabilities", snippet: '"capabilities": ["${1:script_eval}"]$0', detail: "manifest capabilities", type: "property" },
  { label: "capability: script_eval", snippet: '"script_eval"', detail: "capability", type: "keyword" },
  { label: "capability: chemistry", snippet: '"chemistry"', detail: "capability", type: "keyword" },
  { label: "capability: raytraced", snippet: '"raytraced"', detail: "capability", type: "keyword" },
  { label: "capability: editorExtension", snippet: '"editorExtension"', detail: "capability", type: "keyword" },
  { label: "metadata", snippet: '"metadata": {\n\t"authors": ["${1:your name}"]\n}$0', detail: "manifest metadata", type: "property" },
  { label: "subpacks", snippet: '"subpacks": [\n\t{\n\t\t"folder_name": "${1:folder A}",\n\t\t"name": "${2:sub pack name}",\n\t\t"memory_tier": ${3:1}\n\t}\n]$0', detail: "resource pack subpacks", type: "property" },

  // ---- entity ---------------------------------------------------------------
  { label: "minecraft:entity", snippet: '"minecraft:entity": {\n\t"description": {\n\t\t"identifier": "${1:namespace}:${2:entity_name}",\n\t\t"is_spawnable": true,\n\t\t"is_summonable": true,\n\t\t"is_experimental": false\n\t},\n\t"component_groups": {},\n\t"components": {\n\t\t$0\n\t},\n\t"events": {}\n}', detail: "behavior entity root", type: "type" },
  { label: "minecraft:client_entity", snippet: '"minecraft:client_entity": {\n\t"description": {\n\t\t"identifier": "${1:namespace}:${2:entity_name}",\n\t\t"materials": { "default": "entity_alphatest" },\n\t\t"textures": { "default": "textures/entity/${2:entity_name}" },\n\t\t"geometry": { "default": "geometry.${2:entity_name}" },\n\t\t"render_controllers": ["controller.render.default"],\n\t\t"spawn_egg": { "texture": "${2:entity_name}" }\n\t}\n}', detail: "resource client entity root", type: "type" },
  { label: "minecraft:health", snippet: '"minecraft:health": {\n\t"value": ${1:20},\n\t"max": ${2:20}\n}$0', detail: "entity component", type: "property" },
  { label: "minecraft:collision_box", snippet: '"minecraft:collision_box": {\n\t"width": ${1:0.6},\n\t"height": ${2:1.8}\n}$0', detail: "entity/block component", type: "property" },
  { label: "minecraft:physics", snippet: '"minecraft:physics": {}$0', detail: "entity component", type: "property" },
  { label: "minecraft:pushable", snippet: '"minecraft:pushable": {\n\t"is_pushable": true,\n\t"is_pushable_by_piston": true\n}$0', detail: "entity component", type: "property" },
  { label: "minecraft:nameable", snippet: '"minecraft:nameable": {}$0', detail: "entity component", type: "property" },
  { label: "minecraft:type_family", snippet: '"minecraft:type_family": {\n\t"family": ["${1:mob}"]\n}$0', detail: "entity component", type: "property" },
  { label: "minecraft:movement", snippet: '"minecraft:movement": {\n\t"value": ${1:0.25}\n}$0', detail: "entity component", type: "property" },
  { label: "minecraft:movement.basic", snippet: '"minecraft:movement.basic": {}$0', detail: "entity component", type: "property" },
  { label: "minecraft:navigation.walk", snippet: '"minecraft:navigation.walk": {\n\t"can_path_over_water": true,\n\t"avoid_water": true\n}$0', detail: "entity component", type: "property" },
  { label: "minecraft:jump.static", snippet: '"minecraft:jump.static": {}$0', detail: "entity component", type: "property" },
  { label: "minecraft:behavior.random_stroll", snippet: '"minecraft:behavior.random_stroll": {\n\t"priority": ${1:6},\n\t"speed_multiplier": ${2:1.0}\n}$0', detail: "entity AI goal", type: "property" },
  { label: "minecraft:behavior.melee_attack", snippet: '"minecraft:behavior.melee_attack": {\n\t"priority": ${1:2},\n\t"speed_multiplier": ${2:1.0},\n\t"track_target": true\n}$0', detail: "entity AI goal", type: "property" },
  { label: "minecraft:behavior.look_at_player", snippet: '"minecraft:behavior.look_at_player": {\n\t"priority": ${1:7},\n\t"look_distance": ${2:6.0}\n}$0', detail: "entity AI goal", type: "property" },
  { label: "minecraft:behavior.hurt_by_target", snippet: '"minecraft:behavior.hurt_by_target": {\n\t"priority": ${1:1}\n}$0', detail: "entity AI goal", type: "property" },
  { label: "minecraft:behavior.nearest_attackable_target", snippet: '"minecraft:behavior.nearest_attackable_target": {\n\t"priority": ${1:2},\n\t"reselect_targets": true,\n\t"entity_types": [\n\t\t{ "filters": { "test": "is_family", "subject": "other", "value": "${2:player}" }, "max_dist": ${3:16} }\n\t]\n}$0', detail: "entity AI goal", type: "property" },
  { label: "minecraft:attack", snippet: '"minecraft:attack": {\n\t"damage": ${1:2}\n}$0', detail: "entity component", type: "property" },
  { label: "minecraft:breathable", snippet: '"minecraft:breathable": {\n\t"total_supply": ${1:15},\n\t"suffocate_time": ${2:0}\n}$0', detail: "entity component", type: "property" },
  { label: "minecraft:scale", snippet: '"minecraft:scale": {\n\t"value": ${1:1.0}\n}$0', detail: "entity component", type: "property" },
  { label: "minecraft:despawn", snippet: '"minecraft:despawn": {\n\t"despawn_from_distance": {}\n}$0', detail: "entity component", type: "property" },
  { label: "minecraft:loot", snippet: '"minecraft:loot": {\n\t"table": "loot_tables/entities/${1:name}.json"\n}$0', detail: "entity/block component", type: "property" },
  { label: "minecraft:rideable", snippet: '"minecraft:rideable": {\n\t"seat_count": ${1:1},\n\t"family_types": ["${2:player}"],\n\t"seats": { "position": [${3:0}, ${4:0.5}, ${5:0}] }\n}$0', detail: "entity component", type: "property" },
  { label: "minecraft:tameable", snippet: '"minecraft:tameable": {\n\t"probability": ${1:0.3},\n\t"tame_items": "${2:minecraft:bone}"\n}$0', detail: "entity component", type: "property" },
  { label: "minecraft:is_baby", snippet: '"minecraft:is_baby": {}$0', detail: "entity component group flag", type: "property" },
  { label: "component_groups", snippet: '"component_groups": {\n\t"${1:group_name}": {\n\t\t$0\n\t}\n}', detail: "entity component groups", type: "property" },
  { label: "events (entity)", snippet: '"events": {\n\t"${1:minecraft:entity_spawned}": {\n\t\t"add": { "component_groups": ["${2:group_name}"] }\n\t}\n}$0', detail: "entity events", type: "property" },

  // ---- block ------------------------------------------------------------
  { label: "minecraft:block", snippet: '"minecraft:block": {\n\t"description": {\n\t\t"identifier": "${1:namespace}:${2:block_name}",\n\t\t"menu_category": { "category": "construction" }\n\t},\n\t"components": {\n\t\t$0\n\t}\n}', detail: "block root", type: "type" },
  { label: "minecraft:destructible_by_mining", snippet: '"minecraft:destructible_by_mining": {\n\t"seconds_to_destroy": ${1:1.0}\n}$0', detail: "block component", type: "property" },
  { label: "minecraft:destructible_by_explosion", snippet: '"minecraft:destructible_by_explosion": {\n\t"explosion_resistance": ${1:5.0}\n}$0', detail: "block component", type: "property" },
  { label: "minecraft:friction", snippet: '"minecraft:friction": ${1:0.4}', detail: "block component", type: "property" },
  { label: "minecraft:map_color", snippet: '"minecraft:map_color": "${1:#a52a2a}"', detail: "block component", type: "property" },
  { label: "minecraft:geometry (block)", snippet: '"minecraft:geometry": "geometry.${1:name}"', detail: "block component", type: "property" },
  { label: "minecraft:material_instances", snippet: '"minecraft:material_instances": {\n\t"*": {\n\t\t"texture": "${1:texture_name}",\n\t\t"render_method": "${2:opaque}"\n\t}\n}$0', detail: "block component", type: "property" },
  { label: "minecraft:selection_box", snippet: '"minecraft:selection_box": {\n\t"origin": [${1:-8}, ${2:0}, ${3:-8}],\n\t"size": [${4:16}, ${5:16}, ${6:16}]\n}$0', detail: "block component", type: "property" },
  { label: "minecraft:collision_box (block)", snippet: '"minecraft:collision_box": {\n\t"origin": [${1:-8}, ${2:0}, ${3:-8}],\n\t"size": [${4:16}, ${5:16}, ${6:16}]\n}$0', detail: "block component", type: "property" },
  { label: "minecraft:light_emission", snippet: '"minecraft:light_emission": ${1:15}', detail: "block component", type: "property" },
  { label: "minecraft:light_dampening", snippet: '"minecraft:light_dampening": ${1:15}', detail: "block component", type: "property" },
  { label: "minecraft:on_interact", snippet: '"minecraft:on_interact": {\n\t"event": "${1:on_interact_event}"\n}$0', detail: "block trigger component", type: "property" },
  { label: "traits (block)", snippet: '"traits": {\n\t"minecraft:placement_direction": {\n\t\t"enabled_states": ["minecraft:cardinal_direction"]\n\t}\n}$0', detail: "block states/traits", type: "property" },
  { label: "permutations (block)", snippet: '"permutations": [\n\t{\n\t\t"condition": "${1:query.block_state(\'my_state\')}",\n\t\t"components": {}\n\t}\n]$0', detail: "block permutations", type: "property" },

  // ---- item ---------------------------------------------------------------
  { label: "minecraft:item", snippet: '"minecraft:item": {\n\t"description": {\n\t\t"identifier": "${1:namespace}:${2:item_name}",\n\t\t"category": "items"\n\t},\n\t"components": {\n\t\t$0\n\t}\n}', detail: "item root", type: "type" },
  { label: "minecraft:icon", snippet: '"minecraft:icon": {\n\t"texture": "${1:item_name}"\n}$0', detail: "item component", type: "property" },
  { label: "minecraft:display_name", snippet: '"minecraft:display_name": {\n\t"value": "${1:Item Name}"\n}$0', detail: "item component", type: "property" },
  { label: "minecraft:max_stack_size", snippet: '"minecraft:max_stack_size": ${1:64}', detail: "item component", type: "property" },
  { label: "minecraft:food", snippet: '"minecraft:food": {\n\t"nutrition": ${1:4},\n\t"saturation_modifier": ${2:0.3},\n\t"can_always_eat": false\n}$0', detail: "item component", type: "property" },
  { label: "minecraft:use_duration", snippet: '"minecraft:use_duration": ${1:1.6}', detail: "item component", type: "property" },
  { label: "minecraft:use_animation", snippet: '"minecraft:use_animation": "${1:eat}"', detail: "item component", type: "property" },
  { label: "minecraft:hand_equipped", snippet: '"minecraft:hand_equipped": ${1:true}', detail: "item component", type: "property" },
  { label: "minecraft:foil", snippet: '"minecraft:foil": ${1:true}', detail: "item component", type: "property" },
  { label: "minecraft:durability", snippet: '"minecraft:durability": {\n\t"max_durability": ${1:250}\n}$0', detail: "item component", type: "property" },
  { label: "minecraft:wearable", snippet: '"minecraft:wearable": {\n\t"slot": "${1:slot.armor.chest}"\n}$0', detail: "item component", type: "property" },
  { label: "minecraft:cooldown", snippet: '"minecraft:cooldown": {\n\t"category": "${1:category}",\n\t"duration": ${2:1.5}\n}$0', detail: "item component", type: "property" },
  { label: "minecraft:damage", snippet: '"minecraft:damage": ${1:3}', detail: "item component", type: "property" },
  { label: "minecraft:block_placer", snippet: '"minecraft:block_placer": {\n\t"block": "${1:namespace:block_name}"\n}$0', detail: "item component", type: "property" },
  { label: "minecraft:fuel", snippet: '"minecraft:fuel": {\n\t"duration": ${1:10.0}\n}$0', detail: "item component", type: "property" },
  { label: "minecraft:repairable", snippet: '"minecraft:repairable": {\n\t"repair_items": []\n}$0', detail: "item component", type: "property" },

  // ---- recipes ------------------------------------------------------------
  { label: "minecraft:recipe_shaped", snippet: '"minecraft:recipe_shaped": {\n\t"description": { "identifier": "${1:namespace}:${2:recipe_id}" },\n\t"tags": ["crafting_table"],\n\t"pattern": ["${3:AAA}", "${4:ABA}", "${5:AAA}"],\n\t"key": { "A": { "item": "${6:minecraft:stick}" } },\n\t"result": { "item": "${7:namespace:item_name}" }\n}', detail: "shaped crafting recipe", type: "type" },
  { label: "minecraft:recipe_shapeless", snippet: '"minecraft:recipe_shapeless": {\n\t"description": { "identifier": "${1:namespace}:${2:recipe_id}" },\n\t"tags": ["crafting_table"],\n\t"ingredients": [{ "item": "${3:minecraft:stick}" }],\n\t"result": { "item": "${4:namespace:item_name}" }\n}', detail: "shapeless crafting recipe", type: "type" },
  { label: "minecraft:recipe_furnace", snippet: '"minecraft:recipe_furnace": {\n\t"description": { "identifier": "${1:namespace}:${2:recipe_id}" },\n\t"tags": ["furnace"],\n\t"input": "${3:minecraft:cobblestone}",\n\t"output": "${4:minecraft:stone}"\n}', detail: "furnace smelting recipe", type: "type" },
  { label: "minecraft:recipe_brewing_mix", snippet: '"minecraft:recipe_brewing_mix": {\n\t"description": { "identifier": "${1:namespace}:${2:recipe_id}" },\n\t"tags": ["brewing_stand"],\n\t"input": "${3:minecraft:potion_type_awkward}",\n\t"reagent": "${4:minecraft:nether_wart}",\n\t"output": "${5:minecraft:potion_type_thick}"\n}', detail: "brewing recipe", type: "type" },

  // ---- animation / render controllers -------------------------------------
  { label: "animations (root)", snippet: '"format_version": "1.10.0",\n"animations": {\n\t"animation.${1:entity}.${2:name}": {\n\t\t"loop": true,\n\t\t"bones": {}\n\t}\n}', detail: ".animation.json root", type: "type" },
  { label: "animation_controllers (root)", snippet: '"format_version": "1.10.0",\n"animation_controllers": {\n\t"controller.animation.${1:entity}.${2:name}": {\n\t\t"initial_state": "${3:default}",\n\t\t"states": {\n\t\t\t"${3:default}": {\n\t\t\t\t"animations": [],\n\t\t\t\t"transitions": []\n\t\t\t}\n\t\t}\n\t}\n}', detail: "animation controller root", type: "type" },
  { label: "render_controllers (root)", snippet: '"format_version": "1.10.0",\n"render_controllers": {\n\t"controller.render.${1:name}": {\n\t\t"geometry": "Geometry.default",\n\t\t"materials": [{ "*": "Material.default" }],\n\t\t"textures": ["Texture.default"]\n\t}\n}', detail: "render controller root", type: "type" },
  { label: "on_entry / on_exit", snippet: '"on_entry": ["${1:@s query.reset_variable}"],\n"on_exit": []$0', detail: "animation controller state hooks", type: "property" },
  { label: "transitions", snippet: '"transitions": [\n\t{ "${1:next_state}": "${2:query.condition}" }\n]$0', detail: "animation controller transitions", type: "property" },

  // ---- particles ------------------------------------------------------------
  { label: "particle_effect (root)", snippet: '"format_version": "1.10.0",\n"particle_effect": {\n\t"description": {\n\t\t"identifier": "${1:namespace}:${2:particle_name}",\n\t\t"basic_render_parameters": {\n\t\t\t"material": "particles_alpha",\n\t\t\t"texture": "textures/particle/${2:particle_name}"\n\t\t}\n\t},\n\t"components": {}\n}', detail: "particle root", type: "type" },

  // ---- loot / trading -------------------------------------------------------
  { label: "loot table pool", snippet: '"pools": [\n\t{\n\t\t"rolls": ${1:1},\n\t\t"entries": [\n\t\t\t{ "type": "item", "name": "${2:minecraft:apple}", "weight": ${3:1} }\n\t\t]\n\t}\n]$0', detail: "loot_table.json pool", type: "property" },
  { label: "trade table", snippet: '"tiers": [\n\t{\n\t\t"total_exp_required": ${1:0},\n\t\t"groups": [],\n\t\t"trades": [\n\t\t\t{\n\t\t\t\t"wants": [{ "item": "${2:minecraft:emerald}", "quantity": ${3:1} }],\n\t\t\t\t"gives": [{ "item": "${4:minecraft:bread}", "quantity": ${5:1} }]\n\t\t\t}\n\t\t]\n\t}\n]$0', detail: "trading.json tier", type: "property" },

  // ---- sounds -----------------------------------------------------------
  { label: "sound_definitions (root)", snippet: '"format_version": "1.14.0",\n"sound_definitions": {\n\t"${1:namespace}:${2:sound_name}": {\n\t\t"category": "${3:neutral}",\n\t\t"sounds": ["sounds/${2:sound_name}"]\n\t}\n}', detail: "sound_definitions.json root", type: "type" },

  // ---- generic value helpers ----------------------------------------------
  { label: "min_engine_version", snippet: '"min_engine_version": [${1:1}, ${2:21}, ${3:70}]', detail: "engine version array", type: "property" },
  { label: "version [1,0,0]", snippet: '"version": [${1:1}, ${2:0}, ${3:0}]', detail: "semantic version array", type: "property" },
];

export const JS_SNIPPETS = [
  { label: "import @minecraft/server", snippet: 'import { world, system } from "@minecraft/server";$0', detail: "import core script API", type: "keyword" },
  { label: "import @minecraft/server-ui", snippet: 'import { ActionFormData, ModalFormData, MessageFormData } from "@minecraft/server-ui";$0', detail: "import UI forms API", type: "keyword" },
  { label: "world.afterEvents.entityHurt", snippet: 'world.afterEvents.entityHurt.subscribe((event) => {\n\t${1:// event.hurtEntity, event.damageSource}\n});$0', detail: "subscribe to entity hurt", type: "function" },
  { label: "world.afterEvents.playerSpawn", snippet: 'world.afterEvents.playerSpawn.subscribe((event) => {\n\tconst player = event.player;\n\t${1:// ...}\n});$0', detail: "subscribe to player spawn", type: "function" },
  { label: "world.afterEvents.playerLeave", snippet: 'world.afterEvents.playerLeave.subscribe((event) => {\n\t${1:// event.playerId, event.playerName}\n});$0', detail: "subscribe to player leave", type: "function" },
  { label: "world.beforeEvents.chatSend", snippet: 'world.beforeEvents.chatSend.subscribe((event) => {\n\tconst { message, sender } = event;\n\t${1:// event.cancel = true;}\n});$0', detail: "subscribe to chat send", type: "function" },
  { label: "world.afterEvents.itemUse", snippet: 'world.afterEvents.itemUse.subscribe((event) => {\n\tconst { source, itemStack } = event;\n\t${1:// ...}\n});$0', detail: "subscribe to item use", type: "function" },
  { label: "world.afterEvents.blockPlace", snippet: 'world.afterEvents.blockPlace.subscribe((event) => {\n\tconst { block, player } = event;\n\t${1:// ...}\n});$0', detail: "subscribe to block place", type: "function" },
  { label: "world.afterEvents.playerBreakBlock", snippet: 'world.afterEvents.playerBreakBlock.subscribe((event) => {\n\tconst { block, player } = event;\n\t${1:// ...}\n});$0', detail: "subscribe to block break", type: "function" },
  { label: "world.afterEvents.worldInitialize", snippet: 'world.afterEvents.worldInitialize.subscribe((event) => {\n\t${1:// register custom components here}\n});$0', detail: "subscribe to world init", type: "function" },
  { label: "world.sendMessage", snippet: 'world.sendMessage("${1:Hello world}");$0', detail: "broadcast chat message", type: "function" },
  { label: "world.getDimension", snippet: 'const dimension = world.getDimension("${1:overworld}");$0', detail: "get a dimension", type: "function" },
  { label: "system.run", snippet: "system.run(() => {\n\t${1:// runs on next tick}\n});$0", detail: "schedule single run", type: "function" },
  { label: "system.runInterval", snippet: "const runId = system.runInterval(() => {\n\t${1:// repeats every N ticks}\n}, ${2:20});$0", detail: "schedule repeating run", type: "function" },
  { label: "system.runTimeout", snippet: "system.runTimeout(() => {\n\t${1:// runs after N ticks}\n}, ${2:20});$0", detail: "schedule delayed run", type: "function" },
  { label: "system.clearRun", snippet: "system.clearRun(${1:runId});$0", detail: "cancel scheduled run", type: "function" },
  { label: "class CustomComponent", snippet: 'class ${1:MyComponent} {\n\tonPlayerInteract(e) {\n\t\tconst { source: player, block } = e;\n\t\t${2:// ...}\n\t}\n}\n\nworld.afterEvents.worldInitialize.subscribe(({ blockComponentRegistry }) => {\n\tblockComponentRegistry.registerCustomComponent("${3:namespace}:${1:my_component}", new ${1:MyComponent}());\n});$0', detail: "custom block/item component skeleton", type: "class" },
  { label: "player.sendMessage", snippet: 'player.sendMessage("${1:Hello!}");$0', detail: "send chat message to player", type: "function" },
  { label: "player.runCommand", snippet: 'player.runCommand("${1:say hi}");$0', detail: "run a slash command", type: "function" },
  { label: "player.teleport", snippet: "player.teleport({ x: ${1:0}, y: ${2:64}, z: ${3:0} }, { dimension: ${4:player.dimension} });$0", detail: "teleport a player", type: "function" },
  { label: "player.addEffect", snippet: 'player.addEffect("${1:speed}", ${2:200}, { amplifier: ${3:1} });$0', detail: "apply a status effect", type: "function" },
  { label: "player.getComponent(health)", snippet: 'const health = player.getComponent("minecraft:health");$0', detail: "get entity health component", type: "function" },
  { label: "player.getComponent(inventory)", snippet: 'const inventory = player.getComponent("minecraft:inventory").container;$0', detail: "get inventory container", type: "function" },
  { label: "new ItemStack", snippet: 'const item = new ItemStack("${1:minecraft:apple}", ${2:1});$0', detail: "create an item stack", type: "class" },
  { label: "BlockPermutation.resolve", snippet: 'const permutation = BlockPermutation.resolve("${1:minecraft:stone}");$0', detail: "resolve a block permutation", type: "function" },
  { label: "entity.dimension.spawnEntity", snippet: 'dimension.spawnEntity("${1:namespace:entity_name}", { x: ${2:0}, y: ${3:64}, z: ${4:0} });$0', detail: "spawn an entity", type: "function" },
  { label: "ActionFormData form", snippet: 'new ActionFormData()\n\t.title("${1:Title}")\n\t.body("${2:Body text}")\n\t.button("${3:Option A}")\n\t.button("${4:Option B}")\n\t.show(player)\n\t.then((response) => {\n\t\tif (response.canceled) return;\n\t\t${5:// response.selection}\n\t});$0', detail: "@minecraft/server-ui action form", type: "class" },
  { label: "ModalFormData form", snippet: 'new ModalFormData()\n\t.title("${1:Title}")\n\t.textField("${2:Label}", "${3:placeholder}")\n\t.toggle("${4:Toggle label}", false)\n\t.slider("${5:Slider label}", 0, 10, 1)\n\t.show(player)\n\t.then((response) => {\n\t\tif (response.canceled) return;\n\t\tconst [text, toggle, slider] = response.formValues;\n\t});$0', detail: "@minecraft/server-ui modal form", type: "class" },
  { label: "MessageFormData form", snippet: 'new MessageFormData()\n\t.title("${1:Title}")\n\t.body("${2:Are you sure?}")\n\t.button1("${3:Yes}")\n\t.button2("${4:No}")\n\t.show(player)\n\t.then((response) => {\n\t\tif (response.canceled) return;\n\t});$0', detail: "@minecraft/server-ui message form", type: "class" },
  { label: "EquipmentSlot enum", snippet: "EquipmentSlot.${1:Mainhand}$0", detail: "equipment slot enum (Chest, Feet, Head, Legs, Mainhand, Offhand)", type: "enum" },
  { label: "GameMode enum", snippet: "GameMode.${1:survival}$0", detail: "game mode enum (survival, creative, adventure, spectator)", type: "enum" },
  { label: "Direction enum", snippet: "Direction.${1:Up}$0", detail: "direction enum (Down, Up, North, South, West, East)", type: "enum" },
  { label: "world.scoreboard.getObjective", snippet: 'const objective = world.scoreboard.getObjective("${1:my_objective}");$0', detail: "scoreboard access", type: "function" },
  { label: "try/catch", snippet: "try {\n\t${1:// ...}\n} catch (error) {\n\tconsole.warn(${2:error});\n}$0", detail: "error handling", type: "keyword" },
  { label: "console.warn", snippet: 'console.warn(${1:"message"});$0', detail: "log to content log", type: "function" },
];

// Snippet-style macros triggered by typing `!token` anywhere in the file,
// regardless of the language mode. Handled specially because they need to
// generate fresh UUIDs / whole-document-independent content.
export const MAGIC_TRIGGERS = ["!mbp", "!mrp", "!uuid"];
