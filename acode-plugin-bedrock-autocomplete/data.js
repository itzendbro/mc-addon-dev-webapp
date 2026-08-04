// ---------------------------------------------------------------------------
// Minecraft Bedrock Autocomplete -- Acode plugin
//
// This is a direct port of the exact same autocomplete data used by the
// "Pocket Addon Studio" webapp (app/mcCompletions.js and app/mcTemplates.js
// in this repo) -- hand-written completion dictionaries covering every
// Bedrock JSON tag (manifest, entity, block, item, particle, recipe,
// animation/render controllers, sounds, texture list files, ...) plus a
// small set of @minecraft/server scripting API snippets, the same
// !mbp / !mrp / !uuid "magic trigger" whole-file inserts, and the same
// folder-name-based Behavior/Resource Pack detection used to narrow
// manifest.json suggestions down to the right pack type.
//
// See data.js's own comment further down for exactly how it's wired into
// Acode's CodeMirror 6 editor via a real @codemirror/autocomplete
// CompletionSource (snippet() calls, not plain text inserts) -- this file
// only holds the *data*.
// ---------------------------------------------------------------------------

const JSON_SNIPPETS = [
  // ---- manifest -----------------------------------------------------------
  { label: "format_version", snippet: '"format_version": ${1:2}', detail: "manifest field", type: "property", context: "manifest" },
  { label: "header", snippet: '"header": {\n\t"name": "${1:pack.name}",\n\t"description": "${2:pack.description}",\n\t"uuid": "${3:uuid}",\n\t"version": [${4:1}, ${5:0}, ${6:0}],\n\t"min_engine_version": [${7:1}, ${8:21}, ${9:70}]\n}$0', detail: "manifest header block", type: "property", context: "manifest" },
  { label: "modules", snippet: '"modules": [\n\t{\n\t\t"type": "${1:data}",\n\t\t"uuid": "${2:uuid}",\n\t\t"version": [${3:1}, ${4:0}, ${5:0}]\n\t}\n]$0', detail: "manifest modules block", type: "property", context: "manifest" },
  { label: "module: data", snippet: '{\n\t"description": "${1:pack.description}",\n\t"type": "data",\n\t"uuid": "${2:uuid}",\n\t"version": [${3:1}, ${4:0}, ${5:0}]\n}$0', detail: "behavior module", type: "keyword", context: "manifest", packType: "bp" },
  { label: "module: script", snippet: '{\n\t"type": "script",\n\t"language": "javascript",\n\t"uuid": "${1:uuid}",\n\t"entry": "${2:scripts/main.js}",\n\t"version": [${3:1}, ${4:0}, ${5:0}]\n}$0', detail: "script module", type: "keyword", context: "manifest", packType: "bp" },
  { label: "module: resources", snippet: '{\n\t"type": "resources",\n\t"uuid": "${1:uuid}",\n\t"version": [${2:1}, ${3:0}, ${4:0}]\n}$0', detail: "resource module", type: "keyword", context: "manifest", packType: "rp" },
  { label: "module: client_data", snippet: '{\n\t"type": "client_data",\n\t"uuid": "${1:uuid}",\n\t"version": [${2:1}, ${3:0}, ${4:0}]\n}$0', detail: "client data module", type: "keyword", context: "manifest", packType: "bp" },
  { label: "dependencies", snippet: '"dependencies": [\n\t{\n\t\t"uuid": "${1:uuid}",\n\t\t"version": [${2:1}, ${3:0}, ${4:0}]\n\t}\n]$0', detail: "manifest dependencies", type: "property", context: "manifest" },
  { label: "dependency: @minecraft/server", snippet: '{\n\t"module_name": "@minecraft/server",\n\t"version": "${1:1.19.0}"\n}$0', detail: "script API dependency", type: "keyword", context: "manifest", packType: "bp" },
  { label: "dependency: @minecraft/server-ui", snippet: '{\n\t"module_name": "@minecraft/server-ui",\n\t"version": "${1:1.3.0}"\n}$0', detail: "script API dependency", type: "keyword", context: "manifest", packType: "bp" },
  { label: "dependency: @minecraft/server-net", snippet: '{\n\t"module_name": "@minecraft/server-net",\n\t"version": "${1:1.0.0}"\n}$0', detail: "script API dependency", type: "keyword", context: "manifest", packType: "bp" },
  { label: "capabilities", snippet: '"capabilities": ["${1:script_eval}"]$0', detail: "manifest capabilities", type: "property", context: "manifest" },
  { label: "capability: script_eval", snippet: '"script_eval"', detail: "capability", type: "keyword", context: "manifest", packType: "bp" },
  { label: "capability: chemistry", snippet: '"chemistry"', detail: "capability", type: "keyword", context: "manifest" },
  { label: "capability: raytraced", snippet: '"raytraced"', detail: "capability", type: "keyword", context: "manifest", packType: "rp" },
  { label: "capability: editorExtension", snippet: '"editorExtension"', detail: "capability", type: "keyword", context: "manifest" },
  { label: "metadata", snippet: '"metadata": {\n\t"authors": ["${1:your name}"]\n}$0', detail: "manifest metadata", type: "property", context: "manifest" },
  { label: "subpacks", snippet: '"subpacks": [\n\t{\n\t\t"folder_name": "${1:folder A}",\n\t\t"name": "${2:sub pack name}",\n\t\t"memory_tier": ${3:1}\n\t}\n]$0', detail: "resource pack subpacks", type: "property", context: "manifest", packType: "rp" },
  // ---- entity ---------------------------------------------------------------
  { label: "minecraft:entity", snippet: '{\n\t"format_version": "${1:1.21.80}",\n\t"minecraft:entity": {\n\t\t"description": {\n\t\t\t"identifier": "${2:namespace}:${3:entity_name}",\n\t\t\t"is_spawnable": true,\n\t\t\t"is_summonable": true,\n\t\t\t"is_experimental": false\n\t\t},\n\t\t"component_groups": {},\n\t\t"components": { $0 },\n\t\t"events": {}\n\t}\n}', detail: "behavior entity root (with format_version)", type: "type", context: "entity" },
  { label: "minecraft:client_entity", snippet: '{\n\t"format_version": "${1:1.10.0}",\n\t"minecraft:client_entity": {\n\t\t"description": {\n\t\t\t"identifier": "${2:namespace}:${3:entity_name}",\n\t\t\t"materials": { "default": "entity_alphatest" },\n\t\t\t"textures": { "default": "textures/entity/${3:entity_name}" },\n\t\t\t"geometry": { "default": "geometry.${3:entity_name}" },\n\t\t\t"render_controllers": ["controller.render.default"],\n\t\t\t"spawn_egg": { "texture": "${3:entity_name}" }\n\t\t}\n\t}\n}', detail: "resource client entity root (with format_version)", type: "type", context: "client_entity" },
  { label: "format_version (entity)", snippet: '"format_version": "${1:1.21.80}"', detail: "top-level format_version field for this entity file", type: "property", context: "entity" },
  { label: "format_version (client entity)", snippet: '"format_version": "${1:1.10.0}"', detail: "top-level format_version field for this client entity file", type: "property", context: "client_entity" },
  { label: "materials", snippet: '"materials": { "${1:default}": "${2:entity_alphatest}" }$0', detail: "client entity description field", type: "property", context: "client_entity" },
  { label: "textures", snippet: '"textures": { "${1:default}": "textures/entity/${2:texture_name}" }$0', detail: "client entity description field", type: "property", context: "client_entity" },
  { label: "geometry", snippet: '"geometry": { "${1:default}": "geometry.${2:name}" }$0', detail: "client entity description field", type: "property", context: "client_entity" },
  { label: "animations (client entity)", snippet: '"animations": {\n\t"${1:short_name}": "animation.${2:entity}.${3:name}"\n}$0', detail: "client entity description field", type: "property", context: "client_entity" },
  { label: "animation_controllers (client entity)", snippet: '"animation_controllers": [\n\t{ "${1:short_name}": "controller.animation.${2:entity}.${3:name}" }\n]$0', detail: "client entity description field", type: "property", context: "client_entity" },
  { label: "render_controllers (client entity)", snippet: '"render_controllers": ["controller.render.${1:name}"]$0', detail: "client entity description field", type: "property", context: "client_entity" },
  { label: "locators", snippet: '"locators": {\n\t"${1:lead}": { "${2:head}": [${3:0.0}, ${4:14.0}, ${5:-6.0}] }\n}$0', detail: "client entity description field", type: "property", context: "client_entity" },
  { label: "scripts (client entity)", snippet: '"scripts": {\n\t"pre_animation": ["${1:variable.example = 0;}"],\n\t"scale": "${2:1.0}"\n}$0', detail: "client entity description field", type: "property", context: "client_entity" },
  { label: "particle_effects (client entity)", snippet: '"particle_effects": {\n\t"${1:short_name}": "${2:namespace}:${3:particle_name}"\n}$0', detail: "client entity description field", type: "property", context: "client_entity" },
  { label: "sound_effects (client entity)", snippet: '"sound_effects": {\n\t"${1:short_name}": "${2:mob.entity.sound}"\n}$0', detail: "client entity description field", type: "property", context: "client_entity" },
  { label: "spawn_egg (colors)", snippet: '"spawn_egg": {\n\t"base_color": "${1:#505152}",\n\t"overlay_color": "${2:#3b9dff}"\n}$0', detail: "client entity description field", type: "property", context: "client_entity" },
  { label: "spawn_egg (texture)", snippet: '"spawn_egg": {\n\t"texture": "${1:spawn_egg}",\n\t"texture_index": ${2:0}\n}$0', detail: "client entity description field", type: "property", context: "client_entity" },
  { label: "enable_attachables", snippet: '"enable_attachables": ${1:true}', detail: "client entity description field", type: "property", context: "client_entity" },
  { label: "hide_armor", snippet: '"hide_armor": ${1:true}', detail: "client entity description field", type: "property", context: "client_entity" },
  { label: "held_item_ignores_lighting", snippet: '"held_item_ignores_lighting": ${1:true}', detail: "client entity description field", type: "property", context: "client_entity" },
  { label: "min_engine_version (client entity)", snippet: '"min_engine_version": "${1:1.8.0}"', detail: "client entity description field", type: "property", context: "client_entity" },
  { label: "minecraft:health", snippet: '"minecraft:health": {\n\t"value": ${1:20},\n\t"max": ${2:20}\n}$0', detail: "entity component", type: "property", context: "entity" },
  { label: "minecraft:collision_box", snippet: '"minecraft:collision_box": {\n\t"width": ${1:0.6},\n\t"height": ${2:1.8}\n}$0', detail: "entity/block component", type: "property", context: "entity" },
  { label: "minecraft:physics", snippet: '"minecraft:physics": {}$0', detail: "entity component", type: "property", context: "entity" },
  { label: "minecraft:pushable", snippet: '"minecraft:pushable": {\n\t"is_pushable": true,\n\t"is_pushable_by_piston": true\n}$0', detail: "entity component", type: "property", context: "entity" },
  { label: "minecraft:nameable", snippet: '"minecraft:nameable": {}$0', detail: "entity component", type: "property", context: "entity" },
  { label: "minecraft:type_family", snippet: '"minecraft:type_family": {\n\t"family": ["${1:mob}"]\n}$0', detail: "entity component", type: "property", context: "entity" },
  { label: "minecraft:movement", snippet: '"minecraft:movement": {\n\t"value": ${1:0.25}\n}$0', detail: "entity component", type: "property", context: "entity" },
  { label: "minecraft:movement.basic", snippet: '"minecraft:movement.basic": {}$0', detail: "entity component", type: "property", context: "entity" },
  { label: "minecraft:navigation.walk", snippet: '"minecraft:navigation.walk": {\n\t"can_path_over_water": true,\n\t"avoid_water": true\n}$0', detail: "entity component", type: "property", context: "entity" },
  { label: "minecraft:jump.static", snippet: '"minecraft:jump.static": {}$0', detail: "entity component", type: "property", context: "entity" },
  { label: "minecraft:behavior.random_stroll", snippet: '"minecraft:behavior.random_stroll": {\n\t"priority": ${1:6},\n\t"speed_multiplier": ${2:1.0}\n}$0', detail: "entity AI goal", type: "property", context: "entity" },
  { label: "minecraft:behavior.melee_attack", snippet: '"minecraft:behavior.melee_attack": {\n\t"priority": ${1:2},\n\t"speed_multiplier": ${2:1.0},\n\t"track_target": true\n}$0', detail: "entity AI goal", type: "property", context: "entity" },
  { label: "minecraft:behavior.look_at_player", snippet: '"minecraft:behavior.look_at_player": {\n\t"priority": ${1:7},\n\t"look_distance": ${2:6.0}\n}$0', detail: "entity AI goal", type: "property", context: "entity" },
  { label: "minecraft:behavior.hurt_by_target", snippet: '"minecraft:behavior.hurt_by_target": {\n\t"priority": ${1:1}\n}$0', detail: "entity AI goal", type: "property", context: "entity" },
  { label: "minecraft:behavior.nearest_attackable_target", snippet: '"minecraft:behavior.nearest_attackable_target": {\n\t"priority": ${1:2},\n\t"reselect_targets": true,\n\t"entity_types": [\n\t\t{ "filters": { "test": "is_family", "subject": "other", "value": "${2:player}" }, "max_dist": ${3:16} }\n\t]\n}$0', detail: "entity AI goal", type: "property", context: "entity" },
  { label: "minecraft:attack", snippet: '"minecraft:attack": {\n\t"damage": ${1:2}\n}$0', detail: "entity component", type: "property", context: "entity" },
  { label: "minecraft:breathable", snippet: '"minecraft:breathable": {\n\t"total_supply": ${1:15},\n\t"suffocate_time": ${2:0}\n}$0', detail: "entity component", type: "property", context: "entity" },
  { label: "minecraft:scale", snippet: '"minecraft:scale": {\n\t"value": ${1:1.0}\n}$0', detail: "entity component", type: "property", context: "entity" },
  { label: "minecraft:despawn", snippet: '"minecraft:despawn": {\n\t"despawn_from_distance": {}\n}$0', detail: "entity component", type: "property", context: "entity" },
  { label: "minecraft:loot", snippet: '"minecraft:loot": {\n\t"table": "loot_tables/entities/${1:name}.json"\n}$0', detail: "entity/block component", type: "property", context: "entity" },
  { label: "minecraft:rideable", snippet: '"minecraft:rideable": {\n\t"seat_count": ${1:1},\n\t"family_types": ["${2:player}"],\n\t"seats": { "position": [${3:0}, ${4:0.5}, ${5:0}] }\n}$0', detail: "entity component", type: "property", context: "entity" },
  { label: "minecraft:tameable", snippet: '"minecraft:tameable": {\n\t"probability": ${1:0.3},\n\t"tame_items": "${2:minecraft:bone}"\n}$0', detail: "entity component", type: "property", context: "entity" },
  { label: "minecraft:is_baby", snippet: '"minecraft:is_baby": {}$0', detail: "entity component group flag", type: "property", context: "entity" },
  { label: "component_groups", snippet: '"component_groups": {\n\t"${1:group_name}": { $0 }\n}', detail: "entity component groups", type: "property", context: "entity" },
  { label: "events (entity)", snippet: '"events": {\n\t"${1:minecraft:entity_spawned}": {\n\t\t"add": { "component_groups": ["${2:group_name}"] }\n\t}\n}$0', detail: "entity events", type: "property", context: "entity" },
  // ---- entity (additional official components, from the Microsoft Learn
  // "Entity Components Documentation" reference) --------------------------
  { label: "minecraft:addrider", snippet: '"minecraft:addrider": {\n\t"entity_type": "${1:namespace}:${2:rider_entity}",\n\t"spawn_event": "${3:minecraft:entity_spawned}"\n}$0', detail: "Adds a rider to the entity.", type: "property", context: "entity" },
  { label: "minecraft:admire_item", snippet: '"minecraft:admire_item": {\n\t"duration": ${1:15}\n}$0', detail: "Allows an entity to ignore attackable targets for a given duration.", type: "property", context: "entity" },
  { label: "minecraft:ageable", snippet: '"minecraft:ageable": {\n\t"duration": ${1:1200},\n\t"feed_items": ["${2:wheat}"],\n\t"grow_up": { "event": "${3:minecraft:ageable_grow_up}", "target": "self" }\n}$0', detail: "Adds a timer for the entity to grow up.", type: "property", context: "entity" },
  { label: "minecraft:ambient_sound_interval", snippet: '"minecraft:ambient_sound_interval": {\n\t"value": ${1:8},\n\t"range": ${2:4}\n}$0', detail: "Delay for an entity playing its ambient sound.", type: "property", context: "entity" },
  { label: "minecraft:anger_level", snippet: '"minecraft:anger_level": {\n\t"anger_decrement_per_tick": ${1:1},\n\t"max_anger": ${2:25}\n}$0', detail: "Compels the entity to track anger towards a set of nuisances.", type: "property", context: "entity" },
  { label: "minecraft:angry", snippet: '"minecraft:angry": {\n\t"duration": ${1:25},\n\t"broadcast_anger": ${2:true}\n}$0', detail: "Defines an entity's 'angry' state using a timer.", type: "property", context: "entity" },
  { label: "minecraft:annotation.break_door", snippet: '"minecraft:annotation.break_door": {\n\t"break_time": ${1:12},\n\t"min_difficulty": "${2:normal}"\n}$0', detail: "Allows an entity to break doors, assuming navigation flags allow it.", type: "property", context: "entity" },
  { label: "minecraft:annotation.open_door", snippet: '"minecraft:annotation.open_door": {}$0', detail: "Allows the entity to open doors.", type: "property", context: "entity" },
  { label: "minecraft:apply_knockback_rules", snippet: '"minecraft:apply_knockback_rules": {\n\t"knockback_rules": []\n}$0', detail: "Defines how an entity applies knockback.", type: "property", context: "entity" },
  { label: "minecraft:area_attack", snippet: '"minecraft:area_attack": {\n\t"damage_per_tick": ${1:2},\n\t"damage_range": ${2:0.2},\n\t"cause": "${3:entity_attack}"\n}$0', detail: "Does damage to entities that get within range.", type: "property", context: "entity" },
  { label: "minecraft:attack_cooldown", snippet: '"minecraft:attack_cooldown": {\n\t"attack_types": "${1:player}",\n\t"cooldown_time": ${2:1}\n}$0', detail: "Adds a cooldown to an entity's attack.", type: "property", context: "entity" },
  { label: "minecraft:attack_damage", snippet: '"minecraft:attack_damage": {\n\t"value": ${1:3}\n}$0', detail: "Specifies how much damage is dealt by the entity when it attacks.", type: "property", context: "entity" },
  { label: "minecraft:balloonable", snippet: '"minecraft:balloonable": {\n\t"mass": ${1:1.0},\n\t"distance_to_ceiling": ${2:3.0}\n}$0', detail: "Allows this entity to have a balloon attached.", type: "property", context: "entity" },
  { label: "minecraft:barter", snippet: '"minecraft:barter": {\n\t"barter_table": "${1:loot_tables/gameplay/barter.json}"\n}$0', detail: "Enables the component to drop an item as a barter exchange.", type: "property", context: "entity" },
  { label: "minecraft:block_climber", snippet: '"minecraft:block_climber": {}$0', detail: "Allows the entity to detect and maneuver on scaffolding blocks.", type: "property", context: "entity" },
  { label: "minecraft:block_sensor", snippet: '"minecraft:block_sensor": {\n\t"sensor_range": ${1:5},\n\t"on_block_detected": { "event": "${2:minecraft:on_block_detected}", "target": "self" },\n\t"block_list": [\n\t\t{ "name": "${3:minecraft:tnt}" }\n\t]\n}$0', detail: "Fires an event when a listed block is broken within range.", type: "property", context: "entity" },
  { label: "minecraft:body_rotation_always_follows_head", snippet: '"minecraft:body_rotation_always_follows_head": {}$0', detail: "Causes the entity's body rotation to match its head rotation.", type: "property", context: "entity" },
  { label: "minecraft:body_rotation_axis_aligned", snippet: '"minecraft:body_rotation_axis_aligned": {}$0', detail: "Causes the entity's body to align to the nearest cardinal direction.", type: "property", context: "entity" },
  { label: "minecraft:body_rotation_blocked", snippet: '"minecraft:body_rotation_blocked": {}$0', detail: "Stops the entity from visually rotating its body to match its facing direction.", type: "property", context: "entity" },
  { label: "minecraft:body_rotation_locked_to_vehicle", snippet: '"minecraft:body_rotation_locked_to_vehicle": {}$0', detail: "Causes the entity's body rotation to match its vehicle's facing direction.", type: "property", context: "entity" },
  { label: "minecraft:boostable", snippet: '"minecraft:boostable": {\n\t"speed_multiplier": ${1:1.5},\n\t"duration": ${2:3},\n\t"boost_items": [\n\t\t{ "item": "${3:minecraft:carrot_on_a_stick}", "durability": ${4:1} }\n\t]\n}$0', detail: "Defines the conditions and behavior of a rideable entity's boost.", type: "property", context: "entity" },
  { label: "minecraft:boss", snippet: '"minecraft:boss": {\n\t"should_darken_sky": ${1:true},\n\t"hud_range": ${2:55},\n\t"name": "${3:Boss}"\n}$0', detail: "Defines the current state of the boss for updating the boss HUD.", type: "property", context: "entity" },
  { label: "minecraft:break_blocks", snippet: '"minecraft:break_blocks": {\n\t"breakable_blocks": ["${1:minecraft:leaves}"]\n}$0', detail: "Specifies the blocks that the entity can break as it moves around.", type: "property", context: "entity" },
  { label: "minecraft:breedable", snippet: '"minecraft:breedable": {\n\t"require_tame": ${1:true},\n\t"breeds_with": {\n\t\t"mate_type": "${2:namespace}:${3:entity_name}",\n\t\t"baby_type": "${2:namespace}:${3:entity_name}",\n\t\t"breed_event": { "event": "${4:minecraft:entity_born}", "target": "baby" }\n\t},\n\t"breed_items": "${5:wheat}"\n}$0', detail: "Allows an entity to enter the love state used for breeding.", type: "property", context: "entity" },
  { label: "minecraft:bribeable", snippet: '"minecraft:bribeable": {\n\t"bribe_cooldown": ${1:10},\n\t"bribe_items": ["${2:gold_nugget}"]\n}$0', detail: "Defines the way an entity can get into the 'bribed' state.", type: "property", context: "entity" },
  { label: "minecraft:buoyant", snippet: '"minecraft:buoyant": {\n\t"apply_gravity": ${1:true},\n\t"base_buoyancy": ${2:1.0},\n\t"liquid_blocks": ["${3:water}"],\n\t"simulate_waves": ${4:true}\n}$0', detail: "Enables an entity to float on the specified liquid blocks.", type: "property", context: "entity" },
  { label: "minecraft:burns_in_daylight", snippet: '"minecraft:burns_in_daylight": {}$0', detail: "Specifies that this entity takes fire damage when exposed to direct sunlight.", type: "property", context: "entity" },
  { label: "minecraft:cannot_be_attacked", snippet: '"minecraft:cannot_be_attacked": {}$0', detail: "Blocks entities from attacking the owner entity.", type: "property", context: "entity" },
  { label: "minecraft:can_climb", snippet: '"minecraft:can_climb": {}$0', detail: "Allows an entity to climb ladders.", type: "property", context: "entity" },
  { label: "minecraft:can_fly", snippet: '"minecraft:can_fly": {}$0', detail: "Marks the entity as being able to fly; the pathfinder won't require solid ground underneath it.", type: "property", context: "entity" },
  { label: "minecraft:can_join_raid", snippet: '"minecraft:can_join_raid": {}$0', detail: "Specifies if an entity can join a raid.", type: "property", context: "entity" },
  { label: "minecraft:can_power_jump", snippet: '"minecraft:can_power_jump": {}$0', detail: "Allows the entity to power jump like the Horse does in Vanilla.", type: "property", context: "entity" },
  { label: "minecraft:celebrate_hunt", snippet: '"minecraft:celebrate_hunt": {\n\t"duration": ${1:3},\n\t"celebration_targets": {\n\t\t"filters": { "test": "is_family", "subject": "other", "value": "${2:player}" }\n\t},\n\t"broadcast": ${3:true}\n}$0', detail: "Specifies hunt celebration behavior.", type: "property", context: "entity" },
  { label: "minecraft:color", snippet: '"minecraft:color": {\n\t"value": ${1:0}\n}$0', detail: "Defines the entity's main color.", type: "property", context: "entity" },
  { label: "minecraft:color2", snippet: '"minecraft:color2": {\n\t"value": ${1:0}\n}$0', detail: "Defines the entity's second texture color.", type: "property", context: "entity" },
  { label: "minecraft:combat_regeneration", snippet: '"minecraft:combat_regeneration": {}$0', detail: "Gives Regeneration I and removes Mining Fatigue from the mob that kills the entity's attack target.", type: "property", context: "entity" },
  { label: "minecraft:custom_hit_test", snippet: '"minecraft:custom_hit_test": {\n\t"hitboxes": [\n\t\t{ "pivot": [${1:0}, ${2:0}, ${3:0}], "width": ${4:1}, "height": ${5:1} }\n\t]\n}$0', detail: "List of hitboxes for melee and ranged hits against the entity.", type: "property", context: "entity" },
  { label: "minecraft:damage_over_time", snippet: '"minecraft:damage_over_time": {\n\t"damage_per_hurt": ${1:1},\n\t"time_between_hurt": ${2:1}\n}$0', detail: "Applies a defined amount of damage to the entity at specified intervals.", type: "property", context: "entity" },
  { label: "minecraft:damage_sensor", snippet: '"minecraft:damage_sensor": {\n\t"triggers": {\n\t\t"on_damage": { "filters": { "test": "is_family", "subject": "other", "value": "${1:player}" } },\n\t\t"deals_damage": ${2:true}\n\t}\n}$0', detail: "Defines what events to call when this entity is damaged.", type: "property", context: "entity" },
  { label: "minecraft:dash", snippet: '"minecraft:dash": {\n\t"cooldown_time": ${1:1},\n\t"horizontal_momentum": ${2:1},\n\t"vertical_momentum": ${3:1}\n}$0', detail: "Ability for a rideable entity to dash.", type: "property", context: "entity" },
  { label: "minecraft:default_look_angle", snippet: '"minecraft:default_look_angle": {\n\t"default_angle": ${1:0}\n}$0', detail: "Sets this entity's default head rotation angle.", type: "property", context: "entity" },
  { label: "minecraft:dimension_bound", snippet: '"minecraft:dimension_bound": {}$0', detail: "Prevents the entity from changing dimension through portals.", type: "property", context: "entity" },
  { label: "minecraft:drying_out_timer", snippet: '"minecraft:drying_out_timer": {\n\t"total_time": ${1:300},\n\t"water_bottle_refill_time": ${2:300},\n\t"dried_out_event": { "event": "${3:minecraft:on_dried_out}", "target": "self" },\n\t"stopped_drying_out_event": { "event": "${4:minecraft:on_stopped_drying_out}", "target": "self" }\n}$0', detail: "Timer for drying out; fires an event when dried or when it gets wet again.", type: "property", context: "entity" },
  { label: "minecraft:economy_trade_table", snippet: '"minecraft:economy_trade_table": {\n\t"table": "${1:trading/economy_trades.json}",\n\t"convert_trades_economy": ${2:true}\n}$0', detail: "Defines this entity's ability to trade with players using an economy trade table.", type: "property", context: "entity" },
  { label: "minecraft:environment_sensor", snippet: '"minecraft:environment_sensor": {\n\t"triggers": {\n\t\t"filters": { "test": "is_daytime", "value": ${1:true} },\n\t\t"event": "${2:minecraft:on_daytime}"\n\t}\n}$0', detail: "Creates a trigger based on environment conditions.", type: "property", context: "entity" },
  { label: "minecraft:equipment", snippet: '"minecraft:equipment": {\n\t"table": "${1:loot_tables/entities/equipment.json}"\n}$0', detail: "Sets the equipment table to use for this entity.", type: "property", context: "entity" },
  { label: "minecraft:equippable", snippet: '"minecraft:equippable": {\n\t"slots": [\n\t\t{ "slot": ${1:0}, "accepted_items": ["${2:minecraft:saddle}"] }\n\t]\n}$0', detail: "Defines an entity's behavior for having items equipped to it.", type: "property", context: "entity" },
  { label: "minecraft:equip_item", snippet: '"minecraft:equip_item": {}$0', detail: "The entity puts on the desired equipment.", type: "property", context: "entity" },
  { label: "minecraft:experience_reward", snippet: '"minecraft:experience_reward": {\n\t"on_death": "${1:query.last_hit_by_player ? Math.random(1,3) : 0}",\n\t"on_bred": ${2:1}\n}$0', detail: "Sets the amount of experience rewarded on death/breeding.", type: "property", context: "entity" },
  { label: "minecraft:explode", snippet: '"minecraft:explode": {\n\t"fuse_length": ${1:1.5},\n\t"fuse_lit": ${2:false},\n\t"power": ${3:3},\n\t"causes_fire": ${4:false}\n}$0', detail: "Defines how the entity explodes.", type: "property", context: "entity" },
  { label: "minecraft:fire_immune", snippet: '"minecraft:fire_immune": {}$0', detail: "Sets that this entity doesn't take damage from fire.", type: "property", context: "entity" },
  { label: "minecraft:floats_in_liquid", snippet: '"minecraft:floats_in_liquid": {}$0', detail: "Sets that this entity can float in liquid blocks.", type: "property", context: "entity" },
  { label: "minecraft:flying_speed", snippet: '"minecraft:flying_speed": {\n\t"value": ${1:0.15}\n}$0', detail: "Speed in blocks that this entity flies at.", type: "property", context: "entity" },
  { label: "minecraft:follow_range", snippet: '"minecraft:follow_range": {\n\t"value": ${1:32}\n}$0', detail: "Defines the maximum range, in blocks, that a mob will pursue a target.", type: "property", context: "entity" },
  { label: "minecraft:free_camera_controlled", snippet: '"minecraft:free_camera_controlled": {}$0', detail: "When rideable, the entity is controlled with WASD + mouse to move in 3D.", type: "property", context: "entity" },
  { label: "minecraft:friction_modifier", snippet: '"minecraft:friction_modifier": {\n\t"value": ${1:1.0}\n}$0', detail: "Defines how much friction affects this entity.", type: "property", context: "entity" },
  { label: "minecraft:game_event_movement_tracking", snippet: '"minecraft:game_event_movement_tracking": {\n\t"emit_flap": ${1:true},\n\t"emit_move": ${2:true},\n\t"emit_swim": ${3:true}\n}$0', detail: "Allows an entity to emit entityMove, swim and flap game events.", type: "property", context: "entity" },
  { label: "minecraft:ground_offset", snippet: '"minecraft:ground_offset": {\n\t"value": ${1:0}\n}$0', detail: "Sets the offset from the ground that the entity is actually at.", type: "property", context: "entity" },
  { label: "minecraft:group_size", snippet: '"minecraft:group_size": {\n\t"radius": ${1:8}\n}$0', detail: "Keeps track of entity group size in the given radius.", type: "property", context: "entity" },
  { label: "minecraft:grows_crop", snippet: '"minecraft:grows_crop": {\n\t"chance": ${1:0.3},\n\t"charges": ${2:1}\n}$0', detail: "Increases crop growth when the entity walks over crops.", type: "property", context: "entity" },
  { label: "minecraft:healable", snippet: '"minecraft:healable": {\n\t"items": [\n\t\t{ "item": "${1:golden_apple}", "heal_amount": ${2:4} }\n\t]\n}$0', detail: "Defines how an entity can be healed by the player.", type: "property", context: "entity" },
  { label: "minecraft:hide", snippet: '"minecraft:hide": {\n\t"duration": ${1:5},\n\t"hide_sound": "${2:cant_see}"\n}$0', detail: "Moves to and hides at the entity's owned POI or the closest nearby one.", type: "property", context: "entity" },
  { label: "minecraft:home", snippet: '"minecraft:home": {}$0', detail: "Saves a home position for when the entity is spawned.", type: "property", context: "entity" },
  { label: "minecraft:horse.jump_strength", snippet: '"minecraft:horse.jump_strength": {\n\t"value": ${1:0.7}\n}$0', detail: "Determines the jump height for a horse or similar entity.", type: "property", context: "entity" },
  { label: "minecraft:hurt_on_condition", snippet: '"minecraft:hurt_on_condition": {\n\t"damage_conditions": [\n\t\t{ "filters": { "test": "in_lava", "value": true }, "cause": "${1:lava}", "damage_per_tick": ${2:4} }\n\t]\n}$0', detail: "Defines a set of conditions under which an entity should take damage.", type: "property", context: "entity" },
  { label: "minecraft:ignore_cannot_be_attacked", snippet: '"minecraft:ignore_cannot_be_attacked": {}$0', detail: "Allows this entity to attack owners of 'minecraft:cannot_be_attacked'.", type: "property", context: "entity" },
  { label: "minecraft:input_air_controlled", snippet: '"minecraft:input_air_controlled": {}$0', detail: "When rideable, the entity is controlled with WASD + mouse to move in 3D.", type: "property", context: "entity" },
  { label: "minecraft:input_ground_controlled", snippet: '"minecraft:input_ground_controlled": {}$0', detail: "When rideable, the entity is controlled using WASD controls.", type: "property", context: "entity" },
  { label: "minecraft:inside_block_notifier", snippet: '"minecraft:inside_block_notifier": {\n\t"block_list": [\n\t\t{\n\t\t\t"block": { "name": "${1:minecraft:water}" },\n\t\t\t"entered_block_event": { "event": "${2:minecraft:on_enter_water}" },\n\t\t\t"exited_block_event": { "event": "${3:minecraft:on_exit_water}" }\n\t\t}\n\t]\n}$0', detail: "Verifies whether the entity is inside any of the listed blocks.", type: "property", context: "entity" },
  { label: "minecraft:insomnia", snippet: '"minecraft:insomnia": {\n\t"days_until_insomnia": ${1:3}\n}$0', detail: "Adds a timer since last rested to see if phantoms should spawn.", type: "property", context: "entity" },
  { label: "minecraft:instant_despawn", snippet: '"minecraft:instant_despawn": {}$0', detail: "Despawns the Actor immediately.", type: "property", context: "entity" },
  { label: "minecraft:interact", snippet: '"minecraft:interact": {\n\t"interactions": [\n\t\t{\n\t\t\t"on_interact": { "filters": { "test": "is_family", "subject": "other", "value": "${1:player}" } },\n\t\t\t"use_item": ${2:true},\n\t\t\t"spawn_items": { "table": "${3:loot_tables/entities/interact.json}" }\n\t\t}\n\t]\n}$0', detail: "Defines interactions with this entity.", type: "property", context: "entity" },
  { label: "minecraft:inventory", snippet: '"minecraft:inventory": {\n\t"container_type": "${1:horse}",\n\t"inventory_size": ${2:15},\n\t"private": ${3:true},\n\t"restrict_to_owner": ${4:false}\n}$0', detail: "Defines this entity's inventory properties.", type: "property", context: "entity" },
  { label: "minecraft:is_charged", snippet: '"minecraft:is_charged": {}$0', detail: "Sets that this entity is charged.", type: "property", context: "entity" },
  { label: "minecraft:is_chested", snippet: '"minecraft:is_chested": {}$0', detail: "Sets that this entity is currently carrying a chest.", type: "property", context: "entity" },
  { label: "minecraft:is_collidable", snippet: '"minecraft:is_collidable": {}$0', detail: "Allows other mobs to have vertical and horizontal collisions with this mob.", type: "property", context: "entity" },
  { label: "minecraft:is_dyeable", snippet: '"minecraft:is_dyeable": {\n\t"interact_text": "${1:action.interact.dye}"\n}$0', detail: "Allows dyes to be used on this entity to change its color.", type: "property", context: "entity" },
  { label: "minecraft:is_hidden_when_invisible", snippet: '"minecraft:is_hidden_when_invisible": {}$0', detail: "The entity can hide from hostile mobs while invisible.", type: "property", context: "entity" },
  { label: "minecraft:is_ignited", snippet: '"minecraft:is_ignited": {}$0', detail: "Sets that this entity is currently on fire.", type: "property", context: "entity" },
  { label: "minecraft:is_illager_captain", snippet: '"minecraft:is_illager_captain": {}$0', detail: "Sets that this entity is an Illager Captain.", type: "property", context: "entity" },
  { label: "minecraft:is_pregnant", snippet: '"minecraft:is_pregnant": {}$0', detail: "Sets that this entity is currently pregnant.", type: "property", context: "entity" },
  { label: "minecraft:is_saddled", snippet: '"minecraft:is_saddled": {}$0', detail: "Sets that this entity is currently saddled.", type: "property", context: "entity" },
  { label: "minecraft:is_shaking", snippet: '"minecraft:is_shaking": {}$0', detail: "Sets that this entity is currently shaking.", type: "property", context: "entity" },
  { label: "minecraft:is_sheared", snippet: '"minecraft:is_sheared": {}$0', detail: "Sets that this entity is currently sheared.", type: "property", context: "entity" },
  { label: "minecraft:is_stackable", snippet: '"minecraft:is_stackable": {}$0', detail: "Allows instances of this entity to collide with each other.", type: "property", context: "entity" },
  { label: "minecraft:is_stunned", snippet: '"minecraft:is_stunned": {}$0', detail: "Sets that this entity is currently stunned.", type: "property", context: "entity" },
  { label: "minecraft:is_tamed", snippet: '"minecraft:is_tamed": {}$0', detail: "Sets that this entity is currently tamed.", type: "property", context: "entity" },
  { label: "minecraft:item_controllable", snippet: '"minecraft:item_controllable": {\n\t"control_items": ["${1:minecraft:carrot_on_a_stick}"]\n}$0', detail: "Defines what items can be used to control this entity while ridden.", type: "property", context: "entity" },
  { label: "minecraft:item_hopper", snippet: '"minecraft:item_hopper": {}$0', detail: "Determines that this entity is an item hopper.", type: "property", context: "entity" },
  { label: "minecraft:jump.dynamic", snippet: '"minecraft:jump.dynamic": {}$0', detail: "Dynamic jump control that changes jump properties based on speed modifier. Requires minecraft:movement.skip.", type: "property", context: "entity" },
  { label: "minecraft:knockback_resistance", snippet: '"minecraft:knockback_resistance": {\n\t"value": ${1:0}\n}$0', detail: "Determines an entity's resistance to knockback from melee attacks.", type: "property", context: "entity" },
  { label: "minecraft:lava_movement", snippet: '"minecraft:lava_movement": {\n\t"value": ${1:0.5}\n}$0', detail: "Allows a custom movement speed across lava blocks.", type: "property", context: "entity" },
  { label: "minecraft:leashable", snippet: '"minecraft:leashable": {\n\t"soft_distance": ${1:4.0},\n\t"hard_distance": ${2:6.0},\n\t"max_distance": ${3:10.0}\n}$0', detail: "Describes how this mob can be leashed to other items.", type: "property", context: "entity" },
  { label: "minecraft:mark_variant", snippet: '"minecraft:mark_variant": {\n\t"value": ${1:0}\n}$0', detail: "An additional per-type way (besides variant) to express a different visual form of the same mob.", type: "property", context: "entity" },
  { label: "minecraft:mob_effect", snippet: '"minecraft:mob_effect": {\n\t"effect_range": ${1:2.0},\n\t"effect_type": "${2:poison}",\n\t"cooldown_time": ${3:0.5},\n\t"effect_duration": ${4:10}\n}$0', detail: "Applies a mob effect to entities that get within range.", type: "property", context: "entity" },
  { label: "minecraft:mob_effect_immunity", snippet: '"minecraft:mob_effect_immunity": {\n\t"mob_effects": ["${1:poison}"]\n}$0', detail: "Entities with this component have an immunity to the provided mob effects.", type: "property", context: "entity" },
  { label: "minecraft:movement.amphibious", snippet: '"minecraft:movement.amphibious": {}$0', detail: "Allows the mob to swim in water and walk on land.", type: "property", context: "entity" },
  { label: "minecraft:movement.dolphin", snippet: '"minecraft:movement.dolphin": {}$0', detail: "Controls how dolphins move, in a dolphin-esque style.", type: "property", context: "entity" },
  { label: "minecraft:movement.fly", snippet: '"minecraft:movement.fly": {}$0', detail: "Move control that causes the mob to fly.", type: "property", context: "entity" },
  { label: "minecraft:movement.generic", snippet: '"minecraft:movement.generic": {}$0', detail: "Move control that allows a mob to fly, swim, climb, etc.", type: "property", context: "entity" },
  { label: "minecraft:movement.glide", snippet: '"minecraft:movement.glide": {\n\t"start_speed": ${1:0.1},\n\t"speed_when_turning": ${2:0.2}\n}$0', detail: "Move control that causes the mob to glide.", type: "property", context: "entity" },
  { label: "minecraft:movement.hover", snippet: '"minecraft:movement.hover": {}$0', detail: "Move control that causes the mob to hover.", type: "property", context: "entity" },
  { label: "minecraft:movement.jump", snippet: '"minecraft:movement.jump": {\n\t"jump_delay": [${1:1.0}, ${2:3.0}]\n}$0', detail: "Move control that causes the mob to jump as it moves, with a delay between jumps.", type: "property", context: "entity" },
  { label: "minecraft:movement.skip", snippet: '"minecraft:movement.skip": {}$0', detail: "Move control that causes the mob to hop as it moves.", type: "property", context: "entity" },
  { label: "minecraft:movement.sound_distance_offset", snippet: '"minecraft:movement.sound_distance_offset": {\n\t"value": ${1:0}\n}$0', detail: "Sets the offset used to determine the next step distance for playing a movement sound.", type: "property", context: "entity" },
  { label: "minecraft:movement.sway", snippet: '"minecraft:movement.sway": {\n\t"sway_amplitude": ${1:0.05},\n\t"sway_frequency": ${2:0.5}\n}$0', detail: "Causes the mob to sway side to side, as if swimming.", type: "property", context: "entity" },
  { label: "minecraft:navigation.climb", snippet: '"minecraft:navigation.climb": {\n\t"can_path_over_water": ${1:true},\n\t"avoid_water": ${2:true}\n}$0', detail: "Allows paths that include vertical walls, like vanilla Spiders.", type: "property", context: "entity" },
  { label: "minecraft:navigation.float", snippet: '"minecraft:navigation.float": {\n\t"can_path_over_water": ${1:true}\n}$0', detail: "Allows this entity to generate paths by flying around like the regular Ghast.", type: "property", context: "entity" },
  { label: "minecraft:navigation.fly", snippet: '"minecraft:navigation.fly": {\n\t"can_path_over_water": ${1:true},\n\t"avoid_water": ${2:true}\n}$0', detail: "Allows this entity to generate paths in the air like vanilla Parrots.", type: "property", context: "entity" },
  { label: "minecraft:navigation.generic", snippet: '"minecraft:navigation.generic": {\n\t"can_path_over_water": ${1:true},\n\t"can_swim": ${2:true},\n\t"can_walk": ${3:true},\n\t"avoid_water": ${4:false}\n}$0', detail: "Allows walking, swimming, flying and/or climbing paths.", type: "property", context: "entity" },
  { label: "minecraft:navigation.hover", snippet: '"minecraft:navigation.hover": {\n\t"can_path_over_water": ${1:true},\n\t"avoid_water": ${2:true}\n}$0', detail: "Allows this entity to generate paths in the air like vanilla Bees.", type: "property", context: "entity" },
  { label: "minecraft:navigation.swim", snippet: '"minecraft:navigation.swim": {\n\t"can_breach": ${1:true},\n\t"avoid_water": ${2:false}\n}$0', detail: "Allows this entity to generate paths that include water.", type: "property", context: "entity" },
  { label: "minecraft:out_of_control", snippet: '"minecraft:out_of_control": {}$0', detail: "Defines the entity's 'out of control' state.", type: "property", context: "entity" },
  { label: "minecraft:persistent", snippet: '"minecraft:persistent": {}$0', detail: "Defines whether an entity should persist in the game world.", type: "property", context: "entity" },
  { label: "minecraft:preferred_path", snippet: '"minecraft:preferred_path": {\n\t"cost": ${1:0},\n\t"preferred_path_blocks": [\n\t\t[${2:1}, ["${3:minecraft:grass_path}"]]\n\t]\n}$0', detail: "Costing info for mobs that prefer to walk on preferred path blocks.", type: "property", context: "entity" },
  { label: "minecraft:projectile", snippet: '"minecraft:projectile": {\n\t"on_hit": { "impact_damage": { "damage": ${1:5} } },\n\t"power": ${2:1.3},\n\t"gravity": ${3:0.05}\n}$0', detail: "Turns the entity into a projectile that flies along a ballistic arc.", type: "property", context: "entity" },
  { label: "minecraft:pushable_by_block", snippet: '"minecraft:pushable_by_block": {}$0', detail: "Allows the entity to be pushed by certain blocks, like Shulker Boxes and Pistons.", type: "property", context: "entity" },
  { label: "minecraft:pushable_by_entity", snippet: '"minecraft:pushable_by_entity": {}$0', detail: "Allows an entity to be pushed by other entities.", type: "property", context: "entity" },
  { label: "minecraft:push_through", snippet: '"minecraft:push_through": {\n\t"value": ${1:0}\n}$0', detail: "Sets the distance through which the entity can push through.", type: "property", context: "entity" },
  { label: "minecraft:raid_trigger", snippet: '"minecraft:raid_trigger": {\n\t"within_radius": ${1:64.0}\n}$0', detail: "Attempts to trigger a raid at the entity's location.", type: "property", context: "entity" },
  { label: "minecraft:rail_movement", snippet: '"minecraft:rail_movement": {\n\t"max_speed": ${1:0.4}\n}$0', detail: "Defines the entity's movement on rails.", type: "property", context: "entity" },
  { label: "minecraft:remove_in_peaceful", snippet: '"minecraft:remove_in_peaceful": {}$0', detail: "Denotes entities that are not allowed to exist in 'Peaceful' difficulty.", type: "property", context: "entity" },
  { label: "minecraft:renders_when_invisible", snippet: '"minecraft:renders_when_invisible": {}$0', detail: "When set, the entity renders even when invisible.", type: "property", context: "entity" },
  { label: "minecraft:rotation_axis_aligned", snippet: '"minecraft:rotation_axis_aligned": {}$0', detail: "Causes the entity to automatically rotate to align with the nearest cardinal direction.", type: "property", context: "entity" },
  { label: "minecraft:rotation_locked_to_vehicle", snippet: '"minecraft:rotation_locked_to_vehicle": {}$0', detail: "Causes the entity's rotation to match its vehicle's facing direction.", type: "property", context: "entity" },
  { label: "minecraft:scale_by_age", snippet: '"minecraft:scale_by_age": {\n\t"start_scale": ${1:0.5},\n\t"end_scale": ${2:1.0}\n}$0', detail: "Defines the entity's size interpolation based on the entity's age.", type: "property", context: "entity" },
  { label: "minecraft:shooter", snippet: '"minecraft:shooter": {\n\t"def": "${1:minecraft:arrow}"\n}$0', detail: "Defines the entity's ranged attack behavior.", type: "property", context: "entity" },
  { label: "minecraft:sittable", snippet: '"minecraft:sittable": {}$0', detail: "Defines the entity's 'sit' state.", type: "property", context: "entity" },
  { label: "minecraft:skin_id", snippet: '"minecraft:skin_id": {\n\t"value": ${1:0}\n}$0', detail: "Skin ID value, used to differentiate skins (e.g. villager professions).", type: "property", context: "entity" },
  { label: "minecraft:sound_volume", snippet: '"minecraft:sound_volume": {\n\t"value": ${1:1.0}\n}$0', detail: "Sets the entity's base volume for sound effects.", type: "property", context: "entity" },
  { label: "minecraft:spawn_entity", snippet: '"minecraft:spawn_entity": {\n\t"min_wait_time": ${1:300},\n\t"max_wait_time": ${2:600},\n\t"spawn_entity": "${3:namespace}:${4:entity_name}",\n\t"spawn_method": "${5:born}",\n\t"spawn_sound": "${6:plop}"\n}$0', detail: "Adds a timer after which this entity spawns another entity or item.", type: "property", context: "entity" },
  { label: "minecraft:strength", snippet: '"minecraft:strength": {\n\t"value": ${1:1},\n\t"max": ${2:5}\n}$0', detail: "Defines the entity's strength to carry items (e.g. llamas).", type: "property", context: "entity" },
  { label: "minecraft:tamemount", snippet: '"minecraft:tamemount": {\n\t"attempt_temper_mod": ${1:25},\n\t"auto_reject_items": ${2:false}\n}$0', detail: "Allows the entity to be tamed by mounting it.", type: "property", context: "entity" },
  { label: "minecraft:target_nearby_sensor", snippet: '"minecraft:target_nearby_sensor": {\n\t"inside_range": ${1:4.0},\n\t"outside_range": ${2:8.0}\n}$0', detail: "Defines the range within which the entity can see/sense other entities to target.", type: "property", context: "entity" },
  { label: "minecraft:teleport", snippet: '"minecraft:teleport": {\n\t"random_teleports": ${1:true},\n\t"min_random_teleport_time": ${2:12},\n\t"max_random_teleport_time": ${3:30}\n}$0', detail: "Defines an entity's teleporting behavior.", type: "property", context: "entity" },
  { label: "minecraft:timer", snippet: '"minecraft:timer": {\n\t"looping": ${1:false},\n\t"time": ${2:1},\n\t"time_down_event": { "event": "${3:minecraft:on_timer_done}", "target": "self" }\n}$0', detail: "Adds a timer after which an event will fire.", type: "property", context: "entity" },
  { label: "minecraft:trade_table", snippet: '"minecraft:trade_table": {\n\t"table": "${1:trading/trades.json}",\n\t"convert_trades_economy": ${2:false}\n}$0', detail: "Defines this entity's ability to trade with players.", type: "property", context: "entity" },
  { label: "minecraft:transformation", snippet: '"minecraft:transformation": {\n\t"into": "${1:namespace}:${2:entity_name}",\n\t"delay": ${3:0}\n}$0', detail: "Defines an entity's transformation into another entity.", type: "property", context: "entity" },
  { label: "minecraft:transient", snippet: '"minecraft:transient": {}$0', detail: "An entity with this component will never persist, and disappears when unloaded.", type: "property", context: "entity" },
  { label: "minecraft:trusting", snippet: '"minecraft:trusting": {\n\t"probability": ${1:0.5},\n\t"trust_items": ["${2:minecraft:bone}"]\n}$0', detail: "Defines the rules for a mob to trust players.", type: "property", context: "entity" },
  { label: "minecraft:underwater_mount_breathing", snippet: '"minecraft:underwater_mount_breathing": {}$0', detail: "Pauses this entity's breathing under water (for mounts).", type: "property", context: "entity" },
  { label: "minecraft:underwater_movement", snippet: '"minecraft:underwater_movement": {\n\t"value": ${1:0.25}\n}$0', detail: "Defines the speed with which an entity can move through water.", type: "property", context: "entity" },
  { label: "minecraft:uses_legacy_friction", snippet: '"minecraft:uses_legacy_friction": {}$0', detail: "When set, legacy calculations are used for minecraft:friction_modifier.", type: "property", context: "entity" },
  { label: "minecraft:variable_max_auto_step", snippet: '"minecraft:variable_max_auto_step": {\n\t"base_value": ${1:0.5625},\n\t"controlled_value": ${2:1.0625}\n}$0', detail: "Sets a different max auto step height depending on whether jumping is prevented.", type: "property", context: "entity" },
  { label: "minecraft:variant", snippet: '"minecraft:variant": {\n\t"value": ${1:0}\n}$0', detail: "A per-type way to express a different visual form of the same mob.", type: "property", context: "entity" },
  { label: "minecraft:vertical_movement_action", snippet: '"minecraft:vertical_movement_action": {}$0', detail: "When rideable, the entity moves up/down when the player uses the jump action.", type: "property", context: "entity" },
  { label: "minecraft:vibration_damper", snippet: '"minecraft:vibration_damper": {}$0', detail: "Vibrations emitted by an entity with this component are ignored.", type: "property", context: "entity" },
  { label: "minecraft:walk_animation_speed", snippet: '"minecraft:walk_animation_speed": {\n\t"value": ${1:1.0}\n}$0', detail: "Sets the speed multiplier for this entity's walk animation.", type: "property", context: "entity" },
  { label: "minecraft:wants_jockey", snippet: '"minecraft:wants_jockey": {}$0', detail: "Sets that this entity wants to become a jockey.", type: "property", context: "entity" },
  { label: "minecraft:water_movement", snippet: '"minecraft:water_movement": {\n\t"drag_factor": ${1:0.8}\n}$0', detail: "Customizes how the entity moves through water by adjusting drag coefficient.", type: "property", context: "entity" },
  { label: "minecraft:wither_target_highest_damage", snippet: '"minecraft:wither_target_highest_damage": {}$0', detail: "Allows the wither to focus attacks on whichever mob dealt it the most damage.", type: "property", context: "entity" },
  { label: "minecraft:apply_knockback_rules_instance", snippet: '"minecraft:apply_knockback_rules_instance": {\n\t"knockback_resistance_before": "${1:full_resistance}",\n\t"knockback_resistance_after": "${2:no_resistance}",\n\t"lateral_enchant": "${3:no_enchant}",\n\t"lateral_resistance_enchanted": ${4:0},\n\t"lateral_resistance": ${5:0}\n}$0', detail: "Instance of the apply_knockback_rules definition.", type: "property", context: "entity" },
  { label: "minecraft:conditional_bandwidth_optimization", snippet: '"minecraft:conditional_bandwidth_optimization": {\n\t"default_values": { "max_optimized_distance": ${1:80.0}, "max_dropped_ticks": ${2:7}, "use_motion_prediction_hints": ${3:true} }\n}$0', detail: "Defines the Conditional Spatial Update Bandwidth Optimizations of this entity.", type: "property", context: "entity" },
  { label: "minecraft:dash_action", snippet: '"minecraft:dash_action": {\n\t"cooldown_time": ${1:1},\n\t"horizontal_momentum": ${2:1},\n\t"vertical_momentum": ${3:1}\n}$0', detail: "Ability for a rideable entity to dash.", type: "property", context: "entity" },
  { label: "minecraft:dweller", snippet: '"minecraft:dweller": {\n\t"dwelling_type": "${1:village}",\n\t"can_find_poi": ${2:true},\n\t"first_founding_reward": ${3:5},\n\t"update_interval_base": ${4:60},\n\t"update_interval_variant": ${5:40}\n}$0', detail: "Compels an entity to join and migrate between villages and other dwellings.", type: "property", context: "entity" },
  { label: "minecraft:entity_armor_equipment_slot_mapping", snippet: '"minecraft:entity_armor_equipment_slot_mapping": {\n\t"body_slot_mapping": "${1:torso}"\n}$0', detail: "Defines which arm/slot an item equipped to minecraft:equippable's second slot should use.", type: "property", context: "entity" },
  { label: "minecraft:entity_sensor", snippet: '"minecraft:entity_sensor": {\n\t"relative_range": ${1:true},\n\t"subsensors": [\n\t\t{\n\t\t\t"event": "${2:minecraft:on_sensed}",\n\t\t\t"range": [${3:10}, ${4:10}]\n\t\t}\n\t]\n}$0', detail: "Owns multiple subsensors, each firing an event when conditions are met by nearby entities.", type: "property", context: "entity" },
  { label: "minecraft:exhaustion_values", snippet: '"minecraft:exhaustion_values": {\n\t"heal": ${1:6.0},\n\t"jump": ${2:0.05},\n\t"sprint_jump": ${3:0.2},\n\t"mine": ${4:0.005},\n\t"attack": ${5:0.1},\n\t"damage": ${6:0.1},\n\t"sprint": ${7:0.1},\n\t"walk": ${8:0}\n}$0', detail: "Defines how much exhaustion each player action should take.", type: "property", context: "entity" },
  { label: "minecraft:flocking", snippet: '"minecraft:flocking": {\n\t"in_water": ${1:true},\n\t"match_variants": ${2:true},\n\t"use_center_of_mass": ${3:true},\n\t"low_flock_limit": ${4:1},\n\t"high_flock_limit": ${5:32},\n\t"goal_weight": ${6:1.0},\n\t"loner_chance": ${7:0.02}\n}$0', detail: "Allows entities to flock in groups in water or not.", type: "property", context: "entity" },
  { label: "minecraft:genetics", snippet: '"minecraft:genetics": {\n\t"mutation_rate": ${1:0.03},\n\t"genes": [\n\t\t{\n\t\t\t"name": "${2:size}",\n\t\t\t"linked_variant": "${3:variant}",\n\t\t\t"main_allele_range": [${4:0}, ${5:15}],\n\t\t\t"hidden_allele_range": [${4:0}, ${5:15}]\n\t\t}\n\t]\n}$0', detail: "Defines the way a mob's genes and alleles are passed on to its offspring.", type: "property", context: "entity" },
  { label: "minecraft:giveable", snippet: '"minecraft:giveable": {\n\t"items": ["${1:minecraft:apple}"],\n\t"cooldown": ${2:0},\n\t"on_give": { "event": "${3:minecraft:on_given_item}", "target": "self" }\n}$0', detail: "Defines sets of items that can be used to trigger events when used on this entity.", type: "property", context: "entity" },
  { label: "minecraft:heartbeat", snippet: '"minecraft:heartbeat": {\n\t"interval": ${1:1.0}\n}$0', detail: "Defines the entity's heartbeat, used for sound/particle timing (e.g. Warden).", type: "property", context: "entity" },
  { label: "minecraft:leashable_to", snippet: '"minecraft:leashable_to": {}$0', detail: "Allows players to leash entities to this one, retrieve leashed entities, or free them with shears.", type: "property", context: "entity" },
  { label: "minecraft:looked_at", snippet: '"minecraft:looked_at": {\n\t"search_radius": ${1:10},\n\t"field_of_view": ${2:26},\n\t"looked_at_event": { "event": "${3:minecraft:on_looked_at}", "target": "self" }\n}$0', detail: "Defines the behavior when another entity looks at the owner entity.", type: "property", context: "entity" },
  { label: "minecraft:managed_wandering_trader", snippet: '"minecraft:managed_wandering_trader": {}$0', detail: "Manages the entity's ability to trade like the vanilla Wandering Trader.", type: "property", context: "entity" },
  { label: "minecraft:offspring", snippet: '"minecraft:offspring": {\n\t"spawn_method": "${1:born}",\n\t"spawn_event": "${2:minecraft:entity_born}"\n}$0', detail: "Defines the way an entity can create a born offspring.", type: "property", context: "entity" },
  { label: "minecraft:peek", snippet: '"minecraft:peek": {\n\t"on_open": { "event": "${1:minecraft:on_peek_open}", "target": "self" },\n\t"on_close": { "event": "${2:minecraft:on_peek_close}", "target": "self" },\n\t"on_target_open": { "event": "${3:minecraft:on_target_peek_open}", "target": "self" }\n}$0', detail: "Defines the entity's 'peek' behavior and the events fired during it.", type: "property", context: "entity" },
  { label: "minecraft:player.exhaustion", snippet: '"minecraft:player.exhaustion": {\n\t"value": ${1:0},\n\t"max": ${2:20}\n}$0', detail: "Defines the player's exhaustion level.", type: "property", context: "entity" },
  { label: "minecraft:player.experience", snippet: '"minecraft:player.experience": {\n\t"value": ${1:0},\n\t"max": ${2:1}\n}$0', detail: "Defines how much experience each player action should take.", type: "property", context: "entity" },
  { label: "minecraft:player.level", snippet: '"minecraft:player.level": {\n\t"value": ${1:0},\n\t"max": ${2:24791}\n}$0', detail: "Defines the player's level.", type: "property", context: "entity" },
  { label: "minecraft:player.saturation", snippet: '"minecraft:player.saturation": {\n\t"value": ${1:20},\n\t"max": ${2:20}\n}$0', detail: "Defines the player's need for food.", type: "property", context: "entity" },
  { label: "minecraft:rail_sensor", snippet: '"minecraft:rail_sensor": {\n\t"check_block_types": ${1:false},\n\t"eject_on_activate": ${2:false},\n\t"eject_on_deactivate": ${3:false},\n\t"tick_command_block_on_activate": ${4:true},\n\t"tick_command_block_on_deactivate": ${5:true},\n\t"on_activate": { "event": "${6:minecraft:on_rail_activate}", "target": "self" },\n\t"on_deactivate": { "event": "${7:minecraft:on_rail_deactivate}", "target": "self" }\n}$0', detail: "Enables minecart-type entities to detect powered rails and respond to activation state changes.", type: "property", context: "entity" },
  { label: "minecraft:ravager_blocked", snippet: '"minecraft:ravager_blocked": {\n\t"reaction_choices": [\n\t\t[${1:1}, { "event": "${2:minecraft:on_blocked}", "target": "self" }]\n\t]\n}$0', detail: "Defines the ravager's response to their melee attack being blocked.", type: "property", context: "entity" },
  { label: "minecraft:reflect_projectiles", snippet: '"minecraft:reflect_projectiles": {\n\t"projectiles": ["${1:minecraft:arrow}"],\n\t"reflect_direction": "${2:away_from_owner}",\n\t"reflect_chance": ${3:1.0}\n}$0', detail: "[EXPERIMENTAL] Allows an entity to reflect projectiles.", type: "property", context: "entity" },
  { label: "minecraft:scheduler", snippet: '"minecraft:scheduler": {\n\t"min_delay_secs": ${1:0},\n\t"max_delay_secs": ${2:10},\n\t"scheduled_events": [\n\t\t{ "filters": { "test": "is_daytime", "value": true }, "event": "${3:minecraft:on_daytime}" }\n\t]\n}$0', detail: "Fires off scheduled mob events at time-of-day events.", type: "property", context: "entity" },
  { label: "minecraft:shareables", snippet: '"minecraft:shareables": {\n\t"items": [\n\t\t{ "item": "${1:wheat_seeds}", "want_amount": ${2:1}, "surplus_amount": ${3:2} }\n\t]\n}$0', detail: "Defines a list of items the mob wants to share or pick up.", type: "property", context: "entity" },
  { label: "minecraft:spawn_egg_interaction", snippet: '"minecraft:spawn_egg_interaction": {}$0', detail: "Enables interacting with this entity using its own spawn egg to spawn a born child.", type: "property", context: "entity" },
  { label: "minecraft:spawn_on_death", snippet: '"minecraft:spawn_on_death": {\n\t"spawn_entity": "${1:namespace}:${2:entity_name}",\n\t"num_to_spawn": ${3:1},\n\t"spawn_method": "${4:born}"\n}$0', detail: "Spawns entities when this entity perishes.", type: "property", context: "entity" },
  { label: "minecraft:spell_effects", snippet: '"minecraft:spell_effects": {\n\t"add_effects": [\n\t\t{ "effect": "${1:speed}", "duration": ${2:200}, "amplifier": ${3:0} }\n\t]\n}$0', detail: "Allows an entity to add or remove status effects from itself.", type: "property", context: "entity" },
  { label: "minecraft:suspect_tracking", snippet: '"minecraft:suspect_tracking": {}$0', detail: "Allows this entity to remember suspicious locations (e.g. Warden).", type: "property", context: "entity" },
  { label: "minecraft:tick_world", snippet: '"minecraft:tick_world": {\n\t"radius": ${1:2},\n\t"distance_to_players": ${2:16},\n\t"never_despawn": ${3:true}\n}$0', detail: "Defines if the entity ticks the world and the radius around it to tick.", type: "property", context: "entity" },
  { label: "minecraft:trade_resupply", snippet: '"minecraft:trade_resupply": {}$0', detail: "Resupplies an entity's trade.", type: "property", context: "entity" },
  { label: "minecraft:trail", snippet: '"minecraft:trail": {\n\t"block_type": "${1:minecraft:snow_layer}",\n\t"spawn_filter": { "test": "is_snow_covered", "value": true }\n}$0', detail: "Causes an entity to leave a trail of blocks as it moves about the world.", type: "property", context: "entity" },
  { label: "minecraft:trust", snippet: '"minecraft:trust": {\n\t"trust_items": ["${1:minecraft:bone}"],\n\t"probability": ${2:0.5}\n}$0', detail: "Allows this entity to trust multiple players.", type: "property", context: "entity" },
  { label: "minecraft:vibration_listener", snippet: '"minecraft:vibration_listener": {\n\t"range": ${1:16},\n\t"event_mappings": {\n\t\t"event_filter": { "test": "is_family", "subject": "other", "value": "${2:player}" },\n\t\t"vibration_types": [\n\t\t\t{ "vibration_type": "${3:entity_move}", "listener_event": "${4:minecraft:on_vibration_detected}" }\n\t\t]\n\t}\n}$0', detail: "Allows the entity to listen to vibration events (e.g. Warden).", type: "property", context: "entity" },
  // ---- block ------------------------------------------------------------
  { label: "minecraft:block", snippet: '{\n\t"format_version": "${1:1.21.80}",\n\t"minecraft:block": {\n\t\t"description": {\n\t\t\t"identifier": "${2:namespace}:${3:block_name}",\n\t\t\t"menu_category": { "category": "construction" }\n\t\t},\n\t\t"components": { $0 }\n\t}\n}', detail: "block root (with format_version)", type: "type", context: "block" },
  { label: "format_version (block)", snippet: '"format_version": "${1:1.21.80}"', detail: "top-level format_version field for this block file", type: "property", context: "block" },
  { label: "minecraft:destructible_by_mining", snippet: '"minecraft:destructible_by_mining": {\n\t"seconds_to_destroy": ${1:1.0}\n}$0', detail: "block component", type: "property", context: "block" },
  { label: "minecraft:destructible_by_explosion", snippet: '"minecraft:destructible_by_explosion": {\n\t"explosion_resistance": ${1:5.0}\n}$0', detail: "block component", type: "property", context: "block" },
  { label: "minecraft:friction", snippet: '"minecraft:friction": ${1:0.4}', detail: "block component", type: "property", context: "block" },
  { label: "minecraft:map_color", snippet: '"minecraft:map_color": "${1:#a52a2a}"', detail: "block component", type: "property", context: "block" },
  { label: "minecraft:geometry (block)", snippet: '"minecraft:geometry": "geometry.${1:name}"', detail: "block component", type: "property", context: "block" },
  { label: "minecraft:material_instances", snippet: '"minecraft:material_instances": {\n\t"*": {\n\t\t"texture": "${1:texture_name}",\n\t\t"render_method": "${2:opaque}"\n\t}\n}$0', detail: "block component", type: "property", context: "block" },
  { label: "minecraft:selection_box", snippet: '"minecraft:selection_box": {\n\t"origin": [${1:-8}, ${2:0}, ${3:-8}],\n\t"size": [${4:16}, ${5:16}, ${6:16}]\n}$0', detail: "block component", type: "property", context: "block" },
  { label: "minecraft:collision_box (block)", snippet: '"minecraft:collision_box": {\n\t"origin": [${1:-8}, ${2:0}, ${3:-8}],\n\t"size": [${4:16}, ${5:16}, ${6:16}]\n}$0', detail: "block component", type: "property", context: "block" },
  { label: "minecraft:light_emission", snippet: '"minecraft:light_emission": ${1:15}', detail: "block component", type: "property", context: "block" },
  { label: "minecraft:light_dampening", snippet: '"minecraft:light_dampening": ${1:15}', detail: "block component", type: "property", context: "block" },
  { label: "minecraft:on_interact", snippet: '"minecraft:on_interact": {\n\t"event": "${1:on_interact_event}"\n}$0', detail: "block trigger component", type: "property", context: "block" },
  { label: "traits (block)", snippet: '"traits": {\n\t"minecraft:placement_direction": {\n\t\t"enabled_states": ["minecraft:cardinal_direction"]\n\t}\n}$0', detail: "block states/traits", type: "property", context: "block" },
  { label: "permutations (block)", snippet: '"permutations": [\n\t{\n\t\t"condition": "${1:query.block_state(\'my_state\')}",\n\t\t"components": {}\n\t}\n]$0', detail: "block permutations", type: "property", context: "block" },
  { label: "minecraft:block_entity", snippet: '"minecraft:block_entity": {\n\t"dynamic_properties": ${1:true}\n}$0', detail: "block component (requires Upcoming Creator Features)", type: "property", context: "block" },
  { label: "minecraft:chest_obstruction", snippet: '"minecraft:chest_obstruction": {\n\t"obstruction_rule": "${1:shape}"\n}$0', detail: "block component", type: "property", context: "block" },
  { label: "minecraft:connection_rule", snippet: '"minecraft:connection_rule": {\n\t"accepts_connections_from": "${1:all}",\n\t"enabled_directions": ["${2:south}", "${3:north}", "${4:east}", "${5:west}"]\n}$0', detail: "block component", type: "property", context: "block" },
  { label: "minecraft:crafting_table", snippet: '"minecraft:crafting_table": {\n\t"crafting_tags": ["${1:crafting_table}"],\n\t"table_name": "${2:My Crafting Table}"\n}$0', detail: "block component", type: "property", context: "block" },
  { label: "minecraft:destruction_particles", snippet: '"minecraft:destruction_particles": {\n\t"texture": "${1:texture_name}",\n\t"tint_method": "${2:none}"\n}$0', detail: "block component", type: "property", context: "block" },
  { label: "minecraft:display_name", snippet: '"minecraft:display_name": "${1:tile.namespace_block_name.name}"', detail: "block component", type: "property", context: "block" },
  { label: "minecraft:embedded_visual", snippet: '"minecraft:embedded_visual": {\n\t"geometry": { "identifier": "geometry.${1:name}" },\n\t"material_instances": {\n\t\t"*": { "texture": "${2:texture_name}", "render_method": "${3:opaque}" }\n\t}\n}$0', detail: "block component", type: "property", context: "block" },
  { label: "minecraft:entity_fall_on", snippet: '"minecraft:entity_fall_on": {\n\t"min_fall_distance": ${1:0}\n}$0', detail: "block component", type: "property", context: "block" },
  { label: "minecraft:flammable", snippet: '"minecraft:flammable": {\n\t"catch_chance_modifier": ${1:5},\n\t"destroy_chance_modifier": ${2:20},\n\t"lava_flammable": ${3:false}\n}$0', detail: "block component", type: "property", context: "block" },
  { label: "minecraft:flower_pottable", snippet: '"minecraft:flower_pottable": {}$0', detail: "block component", type: "property", context: "block" },
  { label: "minecraft:instrument_sound", snippet: '"minecraft:instrument_sound": {\n\t"up": "${1:note.harp}",\n\t"down": "${2:note.none}"\n}$0', detail: "block component", type: "property", context: "block" },
  { label: "minecraft:item_visual", snippet: '"minecraft:item_visual": {\n\t"geometry": { "identifier": "geometry.${1:name}" },\n\t"material_instances": {\n\t\t"*": { "texture": "${2:texture_name}", "render_method": "${3:opaque}" }\n\t}\n}$0', detail: "block component", type: "property", context: "block" },
  { label: "minecraft:liquid_detection", snippet: '"minecraft:liquid_detection": {\n\t"detection_rules": [\n\t\t{\n\t\t\t"can_contain_liquid": ${1:true},\n\t\t\t"liquid_type": "${2:water}",\n\t\t\t"on_liquid_touches": "${3:blocking}"\n\t\t}\n\t]\n}$0', detail: "block component", type: "property", context: "block" },
  { label: "minecraft:loot", snippet: '"minecraft:loot": "${1:loot_tables/blocks/block_name.json}"', detail: "block component", type: "property", context: "block" },
  { label: "minecraft:movable", snippet: '"minecraft:movable": {\n\t"movement_type": "${1:push_pull}",\n\t"sticky": "${2:none}"\n}$0', detail: "block component", type: "property", context: "block" },
  { label: "minecraft:placement_filter", snippet: '"minecraft:placement_filter": {\n\t"conditions": [\n\t\t{\n\t\t\t"allowed_faces": ["${1:up}"],\n\t\t\t"block_filter": ["${2:minecraft:dirt}"]\n\t\t}\n\t]\n}$0', detail: "block component", type: "property", context: "block" },
  { label: "minecraft:precipitation_interactions", snippet: '"minecraft:precipitation_interactions": {\n\t"precipitation_behavior": "${1:obstruct_rain_accumulate_snow}"\n}$0', detail: "block component", type: "property", context: "block" },
  { label: "minecraft:random_offset", snippet: '"minecraft:random_offset": {\n\t"x": { "range": { "min": ${1:-0.1}, "max": ${2:0.1} }, "steps": ${3:0} },\n\t"y": { "range": { "min": ${4:0}, "max": ${5:0} }, "steps": ${6:0} },\n\t"z": { "range": { "min": ${7:-0.1}, "max": ${8:0.1} }, "steps": ${9:0} }\n}$0', detail: "block component", type: "property", context: "block" },
  { label: "minecraft:redstone_conductivity", snippet: '"minecraft:redstone_conductivity": {\n\t"redstone_conductor": ${1:true},\n\t"allows_wire_to_step_down": ${2:true}\n}$0', detail: "block component", type: "property", context: "block" },
  { label: "minecraft:redstone_consumer", snippet: '"minecraft:redstone_consumer": {\n\t"propagates_power": ${1:true},\n\t"min_power": ${2:0}\n}$0', detail: "block component", type: "property", context: "block" },
  { label: "minecraft:redstone_producer", snippet: '"minecraft:redstone_producer": {\n\t"power": ${1:15},\n\t"connected_faces": ["${2:up}"],\n\t"strongly_powered_face": "${3:up}"\n}$0', detail: "block component", type: "property", context: "block" },
  { label: "minecraft:replaceable", snippet: '"minecraft:replaceable": {}$0', detail: "block component", type: "property", context: "block" },
  { label: "minecraft:support", snippet: '"minecraft:support": {\n\t"shape": "${1:fence}"\n}$0', detail: "block component", type: "property", context: "block" },
  { label: "minecraft:tick", snippet: '"minecraft:tick": {\n\t"interval_range": [${1:20}, ${2:60}],\n\t"looping": ${3:true}\n}$0', detail: "block component", type: "property", context: "block" },
  { label: "minecraft:transformation", snippet: '"minecraft:transformation": {\n\t"rotation": [${1:0}, ${2:0}, ${3:0}],\n\t"translation": [${4:0}, ${5:0}, ${6:0}],\n\t"scale": [${7:1}, ${8:1}, ${9:1}]\n}$0', detail: "block component", type: "property", context: "block" },
  // ---- item ---------------------------------------------------------------
  { label: "minecraft:item", snippet: '{\n\t"format_version": "${1:1.21.80}",\n\t"minecraft:item": {\n\t\t"description": {\n\t\t\t"identifier": "${2:namespace}:${3:item_name}",\n\t\t\t"category": "items"\n\t\t},\n\t\t"components": { $0 }\n\t}\n}', detail: "item root (with format_version)", type: "type", context: "item" },
  { label: "format_version (item)", snippet: '"format_version": "${1:1.21.80}"', detail: "top-level format_version field for this item file", type: "property", context: "item" },
  { label: "minecraft:icon", snippet: '"minecraft:icon": {\n\t"texture": "${1:item_name}"\n}$0', detail: "item component", type: "property", context: "item" },
  { label: "minecraft:display_name", snippet: '"minecraft:display_name": {\n\t"value": "${1:Item Name}"\n}$0', detail: "item component", type: "property", context: "item" },
  { label: "minecraft:max_stack_size", snippet: '"minecraft:max_stack_size": ${1:64}', detail: "item component", type: "property", context: "item" },
  { label: "minecraft:food", snippet: '"minecraft:food": {\n\t"nutrition": ${1:4},\n\t"saturation_modifier": ${2:0.3},\n\t"can_always_eat": false\n}$0', detail: "item component", type: "property", context: "item" },
  { label: "minecraft:use_duration", snippet: '"minecraft:use_duration": ${1:1.6}', detail: "item component", type: "property", context: "item" },
  { label: "minecraft:use_animation", snippet: '"minecraft:use_animation": "${1:eat}"', detail: "item component", type: "property", context: "item" },
  { label: "minecraft:hand_equipped", snippet: '"minecraft:hand_equipped": ${1:true}', detail: "item component", type: "property", context: "item" },
  { label: "minecraft:foil", snippet: '"minecraft:foil": ${1:true}', detail: "item component", type: "property", context: "item" },
  { label: "minecraft:durability", snippet: '"minecraft:durability": {\n\t"max_durability": ${1:250}\n}$0', detail: "item component", type: "property", context: "item" },
  { label: "minecraft:wearable", snippet: '"minecraft:wearable": {\n\t"slot": "${1:slot.armor.chest}"\n}$0', detail: "item component", type: "property", context: "item" },
  { label: "minecraft:cooldown", snippet: '"minecraft:cooldown": {\n\t"category": "${1:category}",\n\t"duration": ${2:1.5}\n}$0', detail: "item component", type: "property", context: "item" },
  { label: "minecraft:damage", snippet: '"minecraft:damage": ${1:3}', detail: "item component", type: "property", context: "item" },
  { label: "minecraft:block_placer", snippet: '"minecraft:block_placer": {\n\t"block": "${1:namespace:block_name}"\n}$0', detail: "item component", type: "property", context: "item" },
  { label: "minecraft:fuel", snippet: '"minecraft:fuel": {\n\t"duration": ${1:10.0}\n}$0', detail: "item component", type: "property", context: "item" },
  { label: "minecraft:repairable", snippet: '"minecraft:repairable": {\n\t"repair_items": []\n}$0', detail: "item component", type: "property", context: "item" },
  { label: "minecraft:allow_off_hand", snippet: '"minecraft:allow_off_hand": ${1:true}', detail: "item component", type: "property", context: "item" },
  { label: "minecraft:can_destroy_in_creative", snippet: '"minecraft:can_destroy_in_creative": ${1:true}', detail: "item component", type: "property", context: "item" },
  { label: "minecraft:fire_resistant", snippet: '"minecraft:fire_resistant": ${1:true}', detail: "item component", type: "property", context: "item" },
  { label: "minecraft:glint", snippet: '"minecraft:glint": ${1:true}', detail: "item component", type: "property", context: "item" },
  { label: "minecraft:liquid_clipped", snippet: '"minecraft:liquid_clipped": ${1:true}', detail: "item component", type: "property", context: "item" },
  { label: "minecraft:should_despawn", snippet: '"minecraft:should_despawn": ${1:true}', detail: "item component", type: "property", context: "item" },
  { label: "minecraft:stacked_by_data", snippet: '"minecraft:stacked_by_data": ${1:true}', detail: "item component", type: "property", context: "item" },
  { label: "minecraft:swing_duration", snippet: '"minecraft:swing_duration": ${1:0.3}', detail: "item component", type: "property", context: "item" },
  { label: "minecraft:rarity", snippet: '"minecraft:rarity": "${1:common}"', detail: "item component", type: "property", context: "item" },
  { label: "minecraft:hover_text_color", snippet: '"minecraft:hover_text_color": "${1:§e}"', detail: "item component", type: "property", context: "item" },
  { label: "minecraft:interact_button", snippet: '"minecraft:interact_button": ${1:true}', detail: "item component", type: "property", context: "item" },
  { label: "minecraft:compostable", snippet: '"minecraft:compostable": {\n\t"composting_chance": ${1:65}\n}$0', detail: "item component", type: "property", context: "item" },
  { label: "minecraft:damage_absorption", snippet: '"minecraft:damage_absorption": {\n\t"absorbable_causes": ["${1:fall}"]\n}$0', detail: "item component", type: "property", context: "item" },
  { label: "minecraft:dyeable", snippet: '"minecraft:dyeable": {\n\t"default_color": "${1:#a06540}"\n}$0', detail: "item component", type: "property", context: "item" },
  { label: "minecraft:enchantable", snippet: '"minecraft:enchantable": {\n\t"slot": "${1:sword}",\n\t"value": ${2:15}\n}$0', detail: "item component", type: "property", context: "item" },
  { label: "minecraft:entity_placer", snippet: '"minecraft:entity_placer": {\n\t"entity": "${1:namespace:entity_name}",\n\t"dispense_on": ["${2:minecraft:water}"],\n\t"use_on": ["${3:minecraft:water}"]\n}$0', detail: "item component", type: "property", context: "item" },
  { label: "minecraft:digger", snippet: '"minecraft:digger": {\n\t"use_efficiency": ${1:true},\n\t"destroy_speeds": [\n\t\t{\n\t\t\t"block": "${2:minecraft:coal_ore}",\n\t\t\t"speed": ${3:2}\n\t\t}\n\t]\n}$0', detail: "item component", type: "property", context: "item" },
  { label: "minecraft:durability_sensor", snippet: '"minecraft:durability_sensor": {\n\t"durability_thresholds": [\n\t\t{\n\t\t\t"durability": ${1:0},\n\t\t\t"particle_type": "${2:crit}",\n\t\t\t"sound_event": "${3:item.break}"\n\t\t}\n\t]\n}$0', detail: "item component", type: "property", context: "item" },
  { label: "minecraft:bundle_interaction", snippet: '"minecraft:bundle_interaction": {\n\t"num_viewable_slots": ${1:12}\n}$0', detail: "item component (requires minecraft:storage_item)", type: "property", context: "item" },
  { label: "minecraft:storage_item", snippet: '"minecraft:storage_item": {\n\t"max_slots": ${1:64},\n\t"allow_nested_storage_items": ${2:true},\n\t"banned_items": ["${3:minecraft:shulker_box}"]\n}$0', detail: "item component", type: "property", context: "item" },
  { label: "minecraft:storage_weight_limit", snippet: '"minecraft:storage_weight_limit": {\n\t"max_weight_limit": ${1:64}\n}$0', detail: "item component", type: "property", context: "item" },
  { label: "minecraft:storage_weight_modifier", snippet: '"minecraft:storage_weight_modifier": {\n\t"weight_in_storage_item": ${1:4}\n}$0', detail: "item component", type: "property", context: "item" },
  { label: "minecraft:kinetic_weapon", snippet: '"minecraft:kinetic_weapon": {\n\t"reach": { "min": ${1:0}, "max": ${2:3} },\n\t"damage_multiplier": ${3:1},\n\t"damage_modifier": ${4:0},\n\t"damage_conditions": { "min_speed": ${5:0.1} }\n}$0', detail: "item component", type: "property", context: "item" },
  { label: "minecraft:piercing_weapon", snippet: '"minecraft:piercing_weapon": {\n\t"reach": { "min": ${1:0}, "max": ${2:3} }\n}$0', detail: "item component", type: "property", context: "item" },
  { label: "minecraft:projectile", snippet: '"minecraft:projectile": {\n\t"projectile_entity": "${1:arrow}",\n\t"minimum_critical_power": ${2:1.25}\n}$0', detail: "item component", type: "property", context: "item" },
  { label: "minecraft:record", snippet: '"minecraft:record": {\n\t"sound_event": "${1:13}",\n\t"duration": ${2:180},\n\t"comparator_signal": ${3:13}\n}$0', detail: "item component", type: "property", context: "item" },
  { label: "minecraft:seed", snippet: '"minecraft:seed": {\n\t"crop_result": "${1:beetroot}",\n\t"plant_at": ["${2:minecraft:farmland}"]\n}$0', detail: "item component", type: "property", context: "item" },
  { label: "minecraft:shooter", snippet: '"minecraft:shooter": {\n\t"ammunition": [\n\t\t{\n\t\t\t"item": "${1:namespace:arrow_item}",\n\t\t\t"use_offhand": ${2:true},\n\t\t\t"search_inventory": ${3:true},\n\t\t\t"use_in_creative": ${4:true}\n\t\t}\n\t],\n\t"max_draw_duration": ${5:1},\n\t"scale_power_by_draw_duration": ${6:true}\n}$0', detail: "item component", type: "property", context: "item" },
  { label: "minecraft:swing_sounds", snippet: '"minecraft:swing_sounds": {\n\t"attack_hit": "${1:attack}",\n\t"attack_miss": "${2:attack.nodamage}",\n\t"attack_critical_hit": "${3:attack.critical}"\n}$0', detail: "item component", type: "property", context: "item" },
  { label: "minecraft:tags", snippet: '"minecraft:tags": {\n\t"tags": ["${1:minecraft:is_food}"]\n}$0', detail: "item component", type: "property", context: "item" },
  { label: "minecraft:throwable", snippet: '"minecraft:throwable": {\n\t"do_swing_animation": ${1:true},\n\t"launch_power_scale": ${2:1},\n\t"max_launch_power": ${3:1}\n}$0', detail: "item component", type: "property", context: "item" },
  { label: "minecraft:use_modifiers", snippet: '"minecraft:use_modifiers": {\n\t"use_duration": ${1:1.6},\n\t"movement_modifier": ${2:0.35}\n}$0', detail: "item component", type: "property", context: "item" },
  // ---- attachables (resource pack) -----------------------------------------
  { label: "minecraft:attachable", snippet: '{\n\t"format_version": "${1:1.10.0}",\n\t"minecraft:attachable": {\n\t\t"description": {\n\t\t\t"identifier": "${2:namespace}:${3:item_name}",\n\t\t\t"materials": { "default": "entity_alphatest" },\n\t\t\t"textures": { "default": "textures/attachables/${3:item_name}" },\n\t\t\t"geometry": { "default": "geometry.${3:item_name}" },\n\t\t\t"render_controllers": ["controller.render.item_default"]\n\t\t}\n\t}\n}', detail: "attachable root (with format_version)", type: "type", context: "attachable" },
  { label: "format_version (attachable)", snippet: '"format_version": "${1:1.10.0}"', detail: "top-level format_version field for this attachable file", type: "property", context: "attachable" },
  { label: "materials (attachable)", snippet: '"materials": { "${1:default}": "${2:entity_alphatest}" }$0', detail: "attachable description field", type: "property", context: "attachable" },
  { label: "textures (attachable)", snippet: '"textures": { "${1:default}": "textures/attachables/${2:texture_name}" }$0', detail: "attachable description field", type: "property", context: "attachable" },
  { label: "geometry (attachable)", snippet: '"geometry": { "${1:default}": "geometry.${2:name}" }$0', detail: "attachable description field", type: "property", context: "attachable" },
  { label: "animations (attachable)", snippet: '"animations": {\n\t"${1:short_name}": "animation.${2:name}"\n}$0', detail: "attachable description field", type: "property", context: "attachable" },
  { label: "render_controllers (attachable)", snippet: '"render_controllers": ["controller.render.${1:name}"]$0', detail: "attachable description field", type: "property", context: "attachable" },
  { label: "scripts (attachable)", snippet: '"scripts": {\n\t"parent_setup": "${1:variable.helmet_layer_visible = 0.0;}"\n}$0', detail: "attachable description field", type: "property", context: "attachable" },
  { label: "particle_effects (attachable)", snippet: '"particle_effects": {\n\t"${1:short_name}": "${2:namespace}:${3:particle_name}"\n}$0', detail: "attachable description field", type: "property", context: "attachable" },
  { label: "sound_effects (attachable)", snippet: '"sound_effects": {\n\t"${1:short_name}": "${2:item.sound}"\n}$0', detail: "attachable description field", type: "property", context: "attachable" },
  { label: "enable_attachables (attachable)", snippet: '"enable_attachables": ${1:true}', detail: "attachable description field", type: "property", context: "attachable" },
  { label: "item (attachable)", snippet: '"item": "${1:namespace:item_name}"', detail: "attachable description field - item identifier this attachable is for", type: "property", context: "attachable" },
  { label: "min_engine_version (attachable)", snippet: '"min_engine_version": ${1:1}', detail: "attachable description field", type: "property", context: "attachable" },
  // ---- recipes ------------------------------------------------------------
  { label: "minecraft:recipe_shaped", snippet: '{\n\t"format_version": "${1:1.21.80}",\n\t"minecraft:recipe_shaped": {\n\t\t"description": { "identifier": "${2:namespace}:${3:recipe_id}" },\n\t\t"tags": ["crafting_table"],\n\t\t"pattern": ["${4:AAA}", "${5:ABA}", "${6:AAA}"],\n\t\t"key": { "A": { "item": "${7:minecraft:stick}" } },\n\t\t"result": { "item": "${8:namespace:item_name}" }\n\t}\n}', detail: "shaped crafting recipe (with format_version)", type: "type", context: "recipe" },
  { label: "minecraft:recipe_shapeless", snippet: '{\n\t"format_version": "${1:1.21.80}",\n\t"minecraft:recipe_shapeless": {\n\t\t"description": { "identifier": "${2:namespace}:${3:recipe_id}" },\n\t\t"tags": ["crafting_table"],\n\t\t"ingredients": [{ "item": "${4:minecraft:stick}" }],\n\t\t"result": { "item": "${5:namespace:item_name}" }\n\t}\n}', detail: "shapeless crafting recipe (with format_version)", type: "type", context: "recipe" },
  { label: "minecraft:recipe_furnace", snippet: '{\n\t"format_version": "${1:1.21.80}",\n\t"minecraft:recipe_furnace": {\n\t\t"description": { "identifier": "${2:namespace}:${3:recipe_id}" },\n\t\t"tags": ["furnace"],\n\t\t"input": "${4:minecraft:cobblestone}",\n\t\t"output": "${5:minecraft:stone}"\n\t}\n}', detail: "furnace smelting recipe (with format_version)", type: "type", context: "recipe" },
  { label: "minecraft:recipe_brewing_mix", snippet: '{\n\t"format_version": "${1:1.21.80}",\n\t"minecraft:recipe_brewing_mix": {\n\t\t"description": { "identifier": "${2:namespace}:${3:recipe_id}" },\n\t\t"tags": ["brewing_stand"],\n\t\t"input": "${4:minecraft:potion_type_awkward}",\n\t\t"reagent": "${5:minecraft:nether_wart}",\n\t\t"output": "${6:minecraft:potion_type_thick}"\n\t}\n}', detail: "brewing recipe (with format_version)", type: "type", context: "recipe" },
  { label: "format_version (recipe)", snippet: '"format_version": "${1:1.21.80}"', detail: "top-level format_version field for this recipe file", type: "property", context: "recipe" },
  // ---- animation / render controllers -------------------------------------
  { label: "animations (root)", snippet: '{\n\t"format_version": "1.10.0",\n\t"animations": {\n\t\t"animation.${1:entity}.${2:name}": {\n\t\t\t"loop": true,\n\t\t\t"bones": {}\n\t\t}\n\t}\n}', detail: ".animation.json root", type: "type", context: "animation" },
  { label: "loop", snippet: '"loop": ${1:true}', detail: "animation field - true, false, or 'hold_on_last_frame'", type: "property", context: "animation" },
  { label: "anim_time_update", snippet: '"anim_time_update": "${1:query.anim_time + query.delta_time}"', detail: "animation field - controls how time advances", type: "property", context: "animation" },
  { label: "loop_delay", snippet: '"loop_delay": "${1:1.0}"', detail: "animation field - seconds to wait before looping", type: "property", context: "animation" },
  { label: "start_delay", snippet: '"start_delay": "${1:0.0}"', detail: "animation field - seconds to wait before playing", type: "property", context: "animation" },
  { label: "blend_weight", snippet: '"blend_weight": "${1:1.0}"', detail: "animation field", type: "property", context: "animation" },
  { label: "override_previous_animation", snippet: '"override_previous_animation": ${1:true}', detail: "animation field - reset bones to default pose first", type: "property", context: "animation" },
  { label: "animation_length", snippet: '"animation_length": ${1:1.0}', detail: "animation field - override calculated animation length in seconds", type: "property", context: "animation" },
  { label: "bones", snippet: '"bones": {\n\t"${1:bone_name}": {\n\t\t"rotation": ["${2:0}", "${3:0}", "${4:0}"]\n\t}\n}$0', detail: "animation bones block", type: "property", context: "animation" },
  { label: "bone rotation/position/scale", snippet: '"${1:bone_name}": {\n\t"rotation": ["${2:0}", "${3:0}", "${4:0}"],\n\t"position": ["${5:0}", "${6:0}", "${7:0}"]\n}$0', detail: "single bone keyframe entry", type: "property", context: "animation" },
  { label: "particle_effects (animation)", snippet: '"particle_effects": {\n\t"${1:0.0}": {\n\t\t"effect": "${2:short_name}",\n\t\t"locator": "${3:locator_name}"\n\t}\n}$0', detail: "animation timed particle effects, keyed by time", type: "property", context: "animation" },
  { label: "sound_effects (animation)", snippet: '"sound_effects": {\n\t"${1:0.0}": {\n\t\t"effect": "${2:short_name}"\n\t}\n}$0', detail: "animation timed sound effects, keyed by time", type: "property", context: "animation" },
  { label: "timeline", snippet: '"timeline": {\n\t"${1:0.0}": ["${2:@s query.event_name}"]\n}$0', detail: "animation timeline events, keyed by time", type: "property", context: "animation" },
  { label: "animation_controllers (root)", snippet: '{\n\t"format_version": "1.10.0",\n\t"animation_controllers": {\n\t\t"controller.animation.${1:entity}.${2:name}": {\n\t\t\t"initial_state": "${3:default}",\n\t\t\t"states": {\n\t\t\t\t"${3:default}": {\n\t\t\t\t\t"animations": [],\n\t\t\t\t\t"transitions": []\n\t\t\t\t}\n\t\t\t}\n\t\t}\n\t}\n}', detail: "animation controller root", type: "type", context: "animation_controller" },
  { label: "render_controllers (root)", snippet: '{\n\t"format_version": "1.10.0",\n\t"render_controllers": {\n\t\t"controller.render.${1:name}": {\n\t\t\t"geometry": "Geometry.default",\n\t\t\t"materials": [{ "*": "Material.default" }],\n\t\t\t"textures": ["Texture.default"]\n\t\t}\n\t}\n}', detail: "render controller root", type: "type", context: "render_controller" },
  { label: "geometry (render controller)", snippet: '"geometry": "${1:Geometry.default}"', detail: "render controller field", type: "property", context: "render_controller" },
  { label: "materials (render controller)", snippet: '"materials": [{ "${1:*}": "${2:Material.default}" }]$0', detail: "render controller field", type: "property", context: "render_controller" },
  { label: "textures (render controller)", snippet: '"textures": ["${1:Texture.default}"]$0', detail: "render controller field", type: "property", context: "render_controller" },
  { label: "arrays", snippet: '"arrays": {\n\t"textures": {\n\t\t"array.${1:name}": ["${2:Texture.a}", "${3:Texture.b}"]\n\t}\n}$0', detail: "render controller field - reusable material/texture/geometry arrays", type: "property", context: "render_controller" },
  { label: "part_visibility", snippet: '"part_visibility": [\n\t{ "${1:bone_name}": "${2:query.condition}" }\n]$0', detail: "render controller field - toggle bone visibility", type: "property", context: "render_controller" },
  { label: "color (render controller)", snippet: '"color": {\n\t"r": "${1:1.0}",\n\t"g": "${2:1.0}",\n\t"b": "${3:1.0}",\n\t"a": "${4:1.0}"\n}$0', detail: "render controller field - color tint", type: "property", context: "render_controller" },
  { label: "overlay_color", snippet: '"overlay_color": {\n\t"r": "${1:1.0}",\n\t"g": "${2:1.0}",\n\t"b": "${3:1.0}",\n\t"a": "${4:1.0}"\n}$0', detail: "render controller field - overlay tint (e.g. wither invulnerability)", type: "property", context: "render_controller" },
  { label: "is_hurt_color", snippet: '"is_hurt_color": {\n\t"r": ${1:1.0},\n\t"g": ${2:0.0},\n\t"b": ${3:0.0},\n\t"a": ${4:0.3}\n}$0', detail: "render controller field - tint applied briefly when hurt", type: "property", context: "render_controller" },
  { label: "on_fire_color", snippet: '"on_fire_color": {\n\t"r": ${1:1.0},\n\t"g": ${2:0.5},\n\t"b": ${3:0.0},\n\t"a": ${4:1.0}\n}$0', detail: "render controller field - tint applied while on fire", type: "property", context: "render_controller" },
  { label: "ignore_lighting", snippet: '"ignore_lighting": ${1:true}', detail: "render controller field", type: "property", context: "render_controller" },
  { label: "filter_lighting", snippet: '"filter_lighting": ${1:true}', detail: "render controller field", type: "property", context: "render_controller" },
  { label: "light_color_multiplier", snippet: '"light_color_multiplier": "${1:1.0}"', detail: "render controller field", type: "property", context: "render_controller" },
  { label: "rebuild_animation_matrices", snippet: '"rebuild_animation_matrices": ${1:true}', detail: "render controller field", type: "property", context: "render_controller" },
  { label: "uv_anim", snippet: '"uv_anim": {\n\t"offset": ["${1:0}", "${2:0}"],\n\t"scale": ["${3:1}", "${4:1}"]\n}$0', detail: "render controller field - UV animation", type: "property", context: "render_controller" },
  { label: "on_entry / on_exit", snippet: '"on_entry": ["${1:@s query.reset_variable}"],\n"on_exit": []$0', detail: "animation controller state hooks", type: "property", context: "animation_controller" },
  { label: "transitions", snippet: '"transitions": [\n\t{ "${1:next_state}": "${2:query.condition}" }\n]$0', detail: "animation controller transitions", type: "property", context: "animation_controller" },
  { label: "states", snippet: '"states": {\n\t"${1:default}": {\n\t\t"animations": ["${2:animation_name}"],\n\t\t"transitions": [\n\t\t\t{ "${3:next_state}": "${4:query.condition}" }\n\t\t]\n\t}\n}$0', detail: "animation controller states block", type: "property", context: "animation_controller" },
  { label: "initial_state", snippet: '"initial_state": "${1:default}"', detail: "animation controller field - starting state name", type: "property", context: "animation_controller" },
  { label: "animations (animation_controller)", snippet: '"animations": ["${1:animation_name}"]$0', detail: "animation controller state field - list of animation short names to play", type: "property", context: "animation_controller" },
  { label: "blend_transition", snippet: '"blend_transition": ${1:0.2}', detail: "animation controller state field - cross-fade seconds when leaving this state", type: "property", context: "animation_controller" },
  { label: "blend_via_shortest_path", snippet: '"blend_via_shortest_path": ${1:true}', detail: "animation controller state field", type: "property", context: "animation_controller" },
  { label: "particle_effects (animation_controller)", snippet: '"particle_effects": [\n\t{ "effect": "${1:short_name}" }\n]$0', detail: "animation controller state field - particles to start on state entry", type: "property", context: "animation_controller" },
  { label: "sound_effects (animation_controller)", snippet: '"sound_effects": [\n\t{ "effect": "${1:short_name}" }\n]$0', detail: "animation controller state field - sounds to trigger on state entry", type: "property", context: "animation_controller" },
  { label: "variables", snippet: '"variables": {\n\t"${1:variable_name}": { "input": "${2:query.modified_move_speed}" }\n}$0', detail: "animation controller state field", type: "property", context: "animation_controller" },
  // ---- particles ------------------------------------------------------------
  { label: "particle_effect (root)", snippet: '{\n\t"format_version": "${1:1.10.0}",\n\t"particle_effect": {\n\t\t"description": {\n\t\t\t"identifier": "${2:namespace}:${3:particle_name}",\n\t\t\t"basic_render_parameters": {\n\t\t\t\t"material": "particles_alpha",\n\t\t\t\t"texture": "textures/particle/${3:particle_name}"\n\t\t\t}\n\t\t},\n\t\t"components": { $0 }\n\t}\n}', detail: "particle root", type: "type", context: "particle" },
  { label: "format_version (particle)", snippet: '"format_version": "${1:1.10.0}"', detail: "top-level format_version field for this particle file", type: "property", context: "particle" },
  { label: "minecraft:emitter_local_space", snippet: '"minecraft:emitter_local_space": {\n\t"position": ${1:false},\n\t"rotation": ${2:false},\n\t"velocity": ${3:false}\n}$0', detail: "emitter component - simulation reference frame", type: "property", context: "particle" },
  { label: "minecraft:emitter_initialization", snippet: '"minecraft:emitter_initialization": {\n\t"creation_expression": "${1:variable.example = 0;}",\n\t"per_update_expression": "${2:variable.example2 = 1;}"\n}$0', detail: "emitter component - runs Molang on creation/update", type: "property", context: "particle" },
  { label: "minecraft:emitter_rate_instant", snippet: '"minecraft:emitter_rate_instant": {\n\t"num_particles": ${1:10}\n}$0', detail: "emitter component - all particles emitted at once", type: "property", context: "particle" },
  { label: "minecraft:emitter_rate_steady", snippet: '"minecraft:emitter_rate_steady": {\n\t"spawn_rate": ${1:1},\n\t"max_particles": ${2:50}\n}$0', detail: "emitter component - steady particle emission rate", type: "property", context: "particle" },
  { label: "minecraft:emitter_rate_manual", snippet: '"minecraft:emitter_rate_manual": {\n\t"max_particles": ${1:50}\n}$0', detail: "emitter component - manually triggered emission", type: "property", context: "particle" },
  { label: "minecraft:emitter_lifetime_looping", snippet: '"minecraft:emitter_lifetime_looping": {\n\t"active_time": ${1:10},\n\t"sleep_time": ${2:0}\n}$0', detail: "emitter component - loops until removed", type: "property", context: "particle" },
  { label: "minecraft:emitter_lifetime_once", snippet: '"minecraft:emitter_lifetime_once": {\n\t"active_time": ${1:10}\n}$0', detail: "emitter component - runs once then expires", type: "property", context: "particle" },
  { label: "minecraft:emitter_lifetime_expression", snippet: '"minecraft:emitter_lifetime_expression": {\n\t"activation_expression": ${1:1},\n\t"expiration_expression": ${2:0}\n}$0', detail: "emitter component - Molang-driven on/off", type: "property", context: "particle" },
  { label: "minecraft:emitter_lifetime_events", snippet: '"minecraft:emitter_lifetime_events": {\n\t"creation_event": "${1:event_name}",\n\t"expiration_event": "${2:event_name}"\n}$0', detail: "emitter component - trigger events on creation/expiration", type: "property", context: "particle" },
  { label: "minecraft:emitter_shape_point", snippet: '"minecraft:emitter_shape_point": {\n\t"offset": [${1:0}, ${2:0}, ${3:0}],\n\t"direction": [${4:0}, ${5:1}, ${6:0}]\n}$0', detail: "emitter shape component - point emitter", type: "property", context: "particle" },
  { label: "minecraft:emitter_shape_sphere", snippet: '"minecraft:emitter_shape_sphere": {\n\t"offset": [${1:0}, ${2:0}, ${3:0}],\n\t"radius": ${4:1},\n\t"surface_only": ${5:false},\n\t"direction": "${6:outwards}"\n}$0', detail: "emitter shape component - sphere emitter", type: "property", context: "particle" },
  { label: "minecraft:emitter_shape_box", snippet: '"minecraft:emitter_shape_box": {\n\t"offset": [${1:0}, ${2:0}, ${3:0}],\n\t"half_dimensions": [${4:1}, ${5:1}, ${6:1}],\n\t"surface_only": ${7:false},\n\t"direction": "${8:outwards}"\n}$0', detail: "emitter shape component - box emitter", type: "property", context: "particle" },
  { label: "minecraft:emitter_shape_custom", snippet: '"minecraft:emitter_shape_custom": {\n\t"offset": [${1:0}, ${2:0}, ${3:0}],\n\t"direction": [${4:0}, ${5:0}, ${6:0}]\n}$0', detail: "emitter shape component - custom Molang-driven emitter", type: "property", context: "particle" },
  { label: "minecraft:emitter_shape_entity_aabb", snippet: '"minecraft:emitter_shape_entity_aabb": {\n\t"surface_only": ${1:false},\n\t"direction": "${2:outwards}"\n}$0', detail: "emitter shape component - emits from entity's bounding box", type: "property", context: "particle" },
  { label: "minecraft:emitter_shape_disc", snippet: '"minecraft:emitter_shape_disc": {\n\t"plane_normal": "${1:y}",\n\t"offset": [${2:0}, ${3:0}, ${4:0}],\n\t"radius": ${5:1},\n\t"surface_only": ${6:false},\n\t"direction": "${7:outwards}"\n}$0', detail: "emitter shape component - disc emitter", type: "property", context: "particle" },
  { label: "minecraft:particle_initial_speed", snippet: '"minecraft:particle_initial_speed": ${1:1}', detail: "particle component - initial launch speed", type: "property", context: "particle" },
  { label: "minecraft:particle_initial_spin", snippet: '"minecraft:particle_initial_spin": {\n\t"rotation": ${1:0},\n\t"rotation_rate": ${2:0}\n}$0', detail: "particle component - initial rotation/spin rate", type: "property", context: "particle" },
  { label: "minecraft:particle_motion_dynamic", snippet: '"minecraft:particle_motion_dynamic": {\n\t"linear_acceleration": [${1:0}, ${2:-9.8}, ${3:0}],\n\t"linear_drag_coefficient": ${4:0},\n\t"rotation_acceleration": ${5:0},\n\t"rotation_drag_coefficient": ${6:0}\n}$0', detail: "particle component - forces acting on the particle", type: "property", context: "particle" },
  { label: "minecraft:particle_motion_parametric", snippet: '"minecraft:particle_motion_parametric": {\n\t"relative_position": ["${1:Math.cos(variable.particle_age)}", "${2:1.0}", "${3:Math.sin(variable.particle_age)}"],\n\t"rotation": ${4:0}\n}$0', detail: "particle component - directly drive particle position/rotation", type: "property", context: "particle" },
  { label: "minecraft:particle_motion_collision", snippet: '"minecraft:particle_motion_collision": {\n\t"enabled": ${1:true},\n\t"collision_drag": ${2:0},\n\t"coefficient_of_restitution": ${3:0},\n\t"collision_radius": ${4:0.1},\n\t"expire_on_contact": ${5:false}\n}$0', detail: "particle component - terrain collision behavior", type: "property", context: "particle" },
  { label: "minecraft:particle_appearance_billboard", snippet: '"minecraft:particle_appearance_billboard": {\n\t"size": [${1:0.2}, ${2:0.2}],\n\t"face_camera_mode": "${3:lookat_xyz}",\n\t"uv": {\n\t\t"uv": [${4:0}, ${5:0}],\n\t\t"uv_size": [${6:1}, ${7:1}]\n\t}\n}$0', detail: "particle component - renders as a camera-facing billboard", type: "property", context: "particle" },
  { label: "minecraft:particle_appearance_tinting", snippet: '"minecraft:particle_appearance_tinting": {\n\t"color": "${1:#ffffff}"\n}$0', detail: "particle component - color tint", type: "property", context: "particle" },
  { label: "minecraft:particle_appearance_lighting", snippet: '"minecraft:particle_appearance_lighting": {}$0', detail: "particle component - tint particle by local lighting", type: "property", context: "particle" },
  { label: "minecraft:particle_lifetime_expression", snippet: '"minecraft:particle_lifetime_expression": {\n\t"expiration_expression": ${1:0},\n\t"max_lifetime": ${2:4}\n}$0', detail: "particle component - controls particle lifetime", type: "property", context: "particle" },
  { label: "minecraft:particle_lifetime_events", snippet: '"minecraft:particle_lifetime_events": {\n\t"creation_event": "${1:event_name}",\n\t"expiration_event": "${2:event_name}"\n}$0', detail: "particle component - trigger events on creation/expiration", type: "property", context: "particle" },
  { label: "minecraft:particle_expire_if_in_blocks", snippet: '"minecraft:particle_expire_if_in_blocks": ["${1:minecraft:water}"]$0', detail: "particle component - expire when inside listed blocks", type: "property", context: "particle" },
  { label: "minecraft:particle_expire_if_not_in_blocks", snippet: '"minecraft:particle_expire_if_not_in_blocks": ["${1:minecraft:air}"]$0', detail: "particle component - expire when NOT inside listed blocks", type: "property", context: "particle" },
  { label: "minecraft:particle_kill_plane", snippet: '"minecraft:particle_kill_plane": [${1:0}, ${2:1}, ${3:0}, ${4:0}]', detail: "particle component - expire when crossing a plane (A,B,C,D)", type: "property", context: "particle" },
  { label: "basic_render_parameters", snippet: '"basic_render_parameters": {\n\t"material": "${1:particles_alpha}",\n\t"texture": "textures/particle/${2:particle_name}"\n}$0', detail: "particle description field - material and texture", type: "property", context: "particle" },
  { label: "curves", snippet: '"curves": {\n\t"variable.${1:my_curve}": {\n\t\t"type": "${2:linear}",\n\t\t"input": "${3:variable.particle_age}",\n\t\t"horizontal_range": ${4:1},\n\t\t"nodes": [${5:0}, ${6:1}]\n\t}\n}$0', detail: "particle description field - reusable value curves", type: "property", context: "particle" },
  { label: "events (particle)", snippet: '"events": {\n\t"${1:event_name}": {\n\t\t"particle_effect": { "effect": "${2:effect_name}" }\n\t}\n}$0', detail: "particle description field - custom events", type: "property", context: "particle" },
  // ---- loot / trading -------------------------------------------------------
  { label: "loot table pool", snippet: '"pools": [\n\t{\n\t\t"rolls": ${1:1},\n\t\t"entries": [\n\t\t\t{ "type": "item", "name": "${2:minecraft:apple}", "weight": ${3:1} }\n\t\t]\n\t}\n]$0', detail: "loot_table.json pool", type: "property", context: "loot" },
  { label: "trade table", snippet: '"tiers": [\n\t{\n\t\t"total_exp_required": ${1:0},\n\t\t"groups": [],\n\t\t"trades": [\n\t\t\t{\n\t\t\t\t"wants": [{ "item": "${2:minecraft:emerald}", "quantity": ${3:1} }],\n\t\t\t\t"gives": [{ "item": "${4:minecraft:bread}", "quantity": ${5:1} }]\n\t\t\t}\n\t\t]\n\t}\n]$0', detail: "trading.json tier", type: "property", context: "trade" },
  { label: "format_version (trade table)", snippet: '"format_version": "${1:1.21.80}"', detail: "optional top-level format_version field for this trade table", type: "property", context: "trade" },
  // ---- sounds -----------------------------------------------------------
  { label: "sound_definitions (root)", snippet: '{\n\t"format_version": "${1:1.14.0}",\n\t"sound_definitions": {\n\t\t"${2:namespace}:${3:sound_name}": {\n\t\t\t"category": "${4:neutral}",\n\t\t\t"sounds": ["sounds/${3:sound_name}"]\n\t\t}\n\t}\n}', detail: "sound_definitions.json root", type: "type", context: "sound" },
  { label: "format_version (sound_definitions)", snippet: '"format_version": "${1:1.14.0}"', detail: "top-level format_version field for sound_definitions.json", type: "property", context: "sound" },
  { label: "sound event", snippet: '"${1:namespace}:${2:sound_name}": {\n\t"category": "${3:neutral}",\n\t"sounds": ["sounds/${2:sound_name}"]\n}$0', detail: "sound_definitions.json event entry", type: "property", context: "sound" },
  { label: "sound entry (detailed)", snippet: '{\n\t"name": "sounds/${1:sound_name}",\n\t"volume": ${2:1.0},\n\t"pitch": ${3:1.0},\n\t"is3D": ${4:true},\n\t"weight": ${5:1},\n\t"stream": ${6:false},\n\t"load_on_low_memory": ${7:false}\n}$0', detail: "sound_definitions.json sound object (as opposed to a bare path string)", type: "property", context: "sound" },
  { label: "min_distance / max_distance", snippet: '"min_distance": ${1:1.0},\n"max_distance": ${2:10000.0}$0', detail: "sound event attenuation range", type: "property", context: "sound" },
  { label: "category", snippet: '"category": "${1:neutral}"', detail: "sound event category (ambient, block, bottle, bucket, hostile, music, neutral, player, record, weather, ui)", type: "property", context: "sound" },
  // ---- resource pack texture list files ------------------------------------
  { label: "item_texture (root)", snippet: '{\n\t"resource_pack_name": "${1:pack_name}",\n\t"texture_name": "atlas.items",\n\t"texture_data": {\n\t\t"${2:item_name}": {\n\t\t\t"textures": "textures/items/${2:item_name}"\n\t\t}\n\t}$0\n}', detail: "item_texture.json root", type: "type", context: "item_texture" },
  { label: "texture_data entry (item)", snippet: '"${1:item_name}": {\n\t"textures": "textures/items/${1:item_name}"\n}$0', detail: "item_texture.json texture_data entry", type: "property", context: "item_texture" },
  { label: "texture_data entry (multi-frame item)", snippet: '"${1:item_name}": {\n\t"textures": ["${2:textures/items/item_v1}", "${3:textures/items/item_v2}"]\n}$0', detail: "item_texture.json texture_data entry with multiple textures (indexed by aux value)", type: "property", context: "item_texture" },
  { label: "terrain_texture (root)", snippet: '{\n\t"resource_pack_name": "${1:pack_name}",\n\t"texture_name": "atlas.terrain",\n\t"padding": ${2:8},\n\t"num_mip_levels": ${3:4},\n\t"texture_data": {\n\t\t"${4:block_name}": {\n\t\t\t"textures": "textures/blocks/${4:block_name}"\n\t\t}\n\t}$0\n}', detail: "terrain_texture.json root", type: "type", context: "terrain_texture" },
  { label: "texture_data entry (block)", snippet: '"${1:block_name}": {\n\t"textures": "textures/blocks/${1:block_name}"\n}$0', detail: "terrain_texture.json texture_data entry", type: "property", context: "terrain_texture" },
  { label: "texture_data entry (variations)", snippet: '"${1:block_name}": {\n\t"textures": {\n\t\t"variations": [\n\t\t\t{ "path": "textures/blocks/${1:block_name}_0", "weight": ${2:1} },\n\t\t\t{ "path": "textures/blocks/${1:block_name}_1", "weight": ${3:1} }\n\t\t]\n\t}\n}$0', detail: "terrain_texture.json texture_data entry with randomized variations", type: "property", context: "terrain_texture" },
  { label: "texture_data entry (overlay color)", snippet: '"${1:block_name}": {\n\t"textures": [\n\t\t{ "path": "textures/blocks/${1:block_name}", "overlay_color": "${2:#79c05a}" }\n\t]\n}$0', detail: "terrain_texture.json texture_data entry with a biome-style overlay color", type: "property", context: "terrain_texture" },
  { label: "padding", snippet: '"padding": ${1:8}', detail: "terrain_texture.json field - buffer space between textures", type: "property", context: "terrain_texture" },
  { label: "num_mip_levels", snippet: '"num_mip_levels": ${1:4}', detail: "terrain_texture.json field - mipmap levels (0-4)", type: "property", context: "terrain_texture" },
  { label: "textures_list entry", snippet: '"textures/${1:items}/${2:texture_name}"$0', detail: "textures_list.json array entry (texture path without extension)", type: "property", context: "texture_list" },
  { label: "flipbook entry", snippet: '{\n\t"flipbook_texture": "textures/blocks/${1:texture_name}",\n\t"atlas_tile": "${2:atlas_tile_name}",\n\t"ticks_per_frame": ${3:10},\n\t"frames": [${4:0}, ${5:1}, ${6:2}, ${7:3}]\n}$0', detail: "flipbook_textures.json array entry - animated block texture", type: "property", context: "flipbook_textures" },
  { label: "flipbook entry (blend)", snippet: '{\n\t"flipbook_texture": "textures/blocks/${1:texture_name}",\n\t"atlas_tile": "${2:atlas_tile_name}",\n\t"ticks_per_frame": ${3:10},\n\t"frames": [${4:0}, ${5:1}, ${6:2}, ${7:3}],\n\t"blend_frames": ${8:true}\n}$0', detail: "flipbook_textures.json array entry with smooth frame blending", type: "property", context: "flipbook_textures" },
  // ---- generic value helpers ----------------------------------------------
  { label: "min_engine_version", snippet: '"min_engine_version": [${1:1}, ${2:21}, ${3:70}]', detail: "engine version array", type: "property", context: "manifest" },
  { label: "version [1,0,0]", snippet: '"version": [${1:1}, ${2:0}, ${3:0}]', detail: "semantic version array", type: "property", context: "manifest" },
];
const JS_SNIPPETS = [
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

// ---------------------------------------------------------------------------
// Manifest templates for the !mbp / !mrp magic triggers -- ported verbatim
// from app/mcTemplates.js in the Pocket Addon Studio webapp repo. UUidN
// tokens are replaced with freshly generated UUID v4s at insert time (see
// fillUuidTokens below), reusing the same generated value for repeated
// occurrences of the same token within one template.
// ---------------------------------------------------------------------------
function uuidv4() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    try {
      return crypto.randomUUID();
    } catch (e) {
      /* fall through to manual implementation */
    }
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function fillUuidTokens(text) {
  const map = new Map();
  return text.replace(/UUid\d+/g, (token) => {
    if (!map.has(token)) map.set(token, uuidv4());
    return map.get(token);
  });
}

const MANIFEST_BP_TEMPLATE = `{
    "format_version": 2,
    "header": {
        "name": "pack.name",
        "description": "pack.description",
        "uuid": "UUid1",
        "version": [ 1, 0, 0 ],
        "min_engine_version": [ 1, 21, 70 ]
    },
    "modules": [
        {
            "description": "pack.description",
            "type": "data",
            "uuid": "UUid2",
            "version": [1, 0, 0]
        },
        {
            "type": "script",
            "language": "javascript",
            "uuid": "UUid3",
            "entry": "scripts/main.js",
            "version": [
                1,
                0,
                0
            ]
        }
    ],
    "capabilities": ["script_eval"],
    "dependencies": [
        {
            "uuid": "UUid4",
            "version": [1, 0, 0]
        },
        {
            "module_name": "@minecraft/server",
            "version": "1.19.0"
        },
        {
            "module_name": "@minecraft/server-ui",
            "version": "1.3.0"
        }
    ]
}`;

const MANIFEST_RP_TEMPLATE = `{
    "format_version": 2,
    "header": {
        "name": "pack.name",
        "description": "pack.description",
        "uuid": "UUid1",
        "version": [1,0,0],
        "min_engine_version": [1,21,100]
    },
    "modules": [
        {
            "type": "resources",
            "uuid": "UUid2",
            "version": [1,0,0]
        }
    ],
    "metadata": {
        "authors": ["Wonders studios"]
    },
    "subpacks": [
        {
            "folder_name": "folder A",
            "name": "sub pack name",
            "memory_tier": 1
        },
        {
            "folder_name": "folder B",
            "name": "sub pack name",
            "memory_tier": 2
        }
    ]
}`;

function buildManifestBP() {
  return fillUuidTokens(MANIFEST_BP_TEMPLATE);
}

function buildManifestRP() {
  return fillUuidTokens(MANIFEST_RP_TEMPLATE);
}

const MAGIC_TRIGGERS = ["!mbp", "!mrp", "!uuid"];

// ---------------------------------------------------------------------------
// Behavior Pack / Resource Pack folder detection.
//
// Add-on projects almost never agree on a single folder layout -- the BP/RP
// folder can sit right at the project root, or a level or two deeper
// (folder1/BP, folder1/folder2/BP, ...), and its *name* is usually either
// exactly "bp"/"rp" (or a full word like "behavior"/"resource"), or a longer
// project-specific name with the pack type tacked on the end, separated by
// a space or underscore -- e.g. "MyAddon_BP", "MyAddon behavior pack",
// "my_addon_resource_pack", "CoolAddonRP". We only ever treat the pack-type
// token as a match when it is the *whole* folder name or is clearly
// separated from the rest of the name (never a bare substring), so folders
// like "warp" or "harpoon" don't get misdetected as an RP folder just for
// containing "rp"/"harp" characters.
//
// This is used to (a) tell a behavior-pack entities/ file apart from a
// resource-pack entities/ file, and (b) narrow manifest.json suggestions
// down to only the module/dependency/capability tags relevant to whichever
// side of the add-on the manifest actually lives in.
// ---------------------------------------------------------------------------
const BP_FOLDER_SUFFIXES = ["bp", "behavior", "behaviour", "behavior pack", "behaviour pack"];
const RP_FOLDER_SUFFIXES = ["rp", "resource", "resources", "resource pack", "resources pack"];

function folderNameMatchesSuffix(lowerFolderName, suffix) {
  // Underscores and spaces are treated as the same separator, so
  // "resource_pack", "resource pack" and even a mixed "my_addon resource_pack"
  // all normalize to the same thing before comparing.
  const normalized = lowerFolderName.replace(/_/g, " ").replace(/\s+/g, " ").trim();
  if (normalized === suffix) return true;
  return normalized.endsWith(" " + suffix);
}

function packTypeForFolderName(folderName) {
  const lower = (folderName || "").toLowerCase();
  if (BP_FOLDER_SUFFIXES.some((s) => folderNameMatchesSuffix(lower, s))) return "bp";
  if (RP_FOLDER_SUFFIXES.some((s) => folderNameMatchesSuffix(lower, s))) return "rp";
  return null;
}

// Walks every ancestor folder of `path`, from the one closest to the file up
// to the project root, and returns "bp"/"rp" for the nearest one whose name
// matches a known Behavior/Resource Pack naming convention -- or null if the
// project doesn't name its pack folders in a way we recognise.
function packTypeForPath(path) {
  if (!path) return null;
  const segments = path.split("/").filter(Boolean);
  const folders = segments.slice(0, -1); // exclude the file name itself
  for (let i = folders.length - 1; i >= 0; i--) {
    const type = packTypeForFolderName(folders[i]);
    if (type) return type;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Works out which `context` bucket (see the `context:` tags on JSON_SNIPPETS
// above) a given file path belongs to, purely from its name/folder -- so the
// autocomplete list only shows manifest tags in manifest.json, entity
// component tags in an entities/ file, block component tags in a blocks/
// file, etc, instead of dumping every Bedrock JSON tag into every file.
// Returns null when the path doesn't match any known convention, in which
// case the caller falls back to showing every JSON snippet (better to show
// too much than nothing at all for an unrecognised file).
// ---------------------------------------------------------------------------
function contextForPath(path) {
  if (!path) return null;
  const lower = path.toLowerCase();
  const segments = lower.split("/").filter(Boolean);
  const name = segments[segments.length - 1] || "";
  const has = (folder) => segments.slice(0, -1).includes(folder);

  if (name === "manifest.json") return "manifest";
  if (name === "sound_definitions.json") return "sound";
  if (name === "textures_list.json") return "texture_list";
  if (name === "item_texture.json") return "item_texture";
  if (name === "terrain_texture.json") return "terrain_texture";
  if (name === "flipbook_textures.json") return "flipbook_textures";

  if (has("render_controllers") || name.includes("render_controller")) return "render_controller";
  if (has("animation_controllers") || name.includes("animation_controller")) return "animation_controller";
  if (has("animations") || name.includes(".animation.")) return "animation";
  if (has("loot_tables")) return "loot";
  if (has("trading")) return "trade";
  if (has("recipes")) return "recipe";
  if (has("particles") || has("particle") || name.includes(".particle.")) return "particle";
  if (has("attachables") || has("attachable") || name.includes(".attachable.")) return "attachable";
  if (has("blocks")) return "block";
  if (has("items")) return "item";
  if (has("entities") || has("entity") || name.includes(".entity.")) {
    // Behavior pack entity files ("minecraft:entity") conventionally live in
    // a plural "entities" folder, while resource pack client entity files
    // ("minecraft:client_entity") conventionally live in a singular
    // "entity" folder (and/or use a ".entity.json" file suffix) -- so
    // accept either folder name/suffix here and use the BP/RP folder-name
    // detector below to tell the two apart. This also correctly handles
    // the entities/entity folder being nested a level or two below the
    // actual BP/RP folder.
    return packTypeForPath(path) === "rp" ? "client_entity" : "entity";
  }
  return null;
}

// ---------------------------------------------------------------------------
// Magic triggers: !mbp / !mrp / !uuid expand to whole manifest / uuid blocks,
// same as in the webapp -- these need special handling (fresh UUIDs per
// insert) rather than being expressible as a static snippet template.
// ---------------------------------------------------------------------------
const MAGIC_HINTS = [
  { trigger: "!mbp", build: () => buildManifestBP(), detail: "Insert Behavior Pack manifest.json" },
  { trigger: "!mrp", build: () => buildManifestRP(), detail: "Insert Resource Pack manifest.json" },
  { trigger: "!uuid", build: () => uuidv4(), detail: "Insert a new random UUID v4" },
];

// Exported as a plain global object (this app has no module bundler, same
// constraint as the webapp it's ported from) so main.js can read it without
// any build step.
window.PocketAddonBedrockData = {
  JSON_SNIPPETS,
  JS_SNIPPETS,
  MAGIC_HINTS,
  packTypeForFolderName,
  packTypeForPath,
  contextForPath,
  buildManifestBP,
  buildManifestRP,
  uuidv4,
};
