// ---------------------------------------------------------------------------
// Hand written completion dictionaries that make editing Minecraft Bedrock
// (MCPE/MCBE) add-on JSON and JavaScript feel closer to VS Code + the
// bedrock-samples IntelliSense extensions. These are intentionally static
// (no schema fetching) so the app works fully offline on a phone.
// ---------------------------------------------------------------------------
// Each entry: { label, snippet, detail, type }
// `snippet` uses CodeMirror snippet syntax: ${1:placeholder}, ${2:other}, $0 for final cursor.
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
  { label: "minecraft:entity", snippet: '"format_version": "${1:1.21.80}",\n"minecraft:entity": {\n\t"description": {\n\t\t"identifier": "${2:namespace}:${3:entity_name}",\n\t\t"is_spawnable": true,\n\t\t"is_summonable": true,\n\t\t"is_experimental": false\n\t},\n\t"component_groups": {},\n\t"components": {\n\t\t$0\n\t},\n\t"events": {}\n}', detail: "behavior entity root (with format_version)", type: "type", context: "entity" },
  { label: "minecraft:client_entity", snippet: '"format_version": "${1:1.10.0}",\n"minecraft:client_entity": {\n\t"description": {\n\t\t"identifier": "${2:namespace}:${3:entity_name}",\n\t\t"materials": { "default": "entity_alphatest" },\n\t\t"textures": { "default": "textures/entity/${3:entity_name}" },\n\t\t"geometry": { "default": "geometry.${3:entity_name}" },\n\t\t"render_controllers": ["controller.render.default"],\n\t\t"spawn_egg": { "texture": "${3:entity_name}" }\n\t}\n}', detail: "resource client entity root (with format_version)", type: "type", context: "client_entity" },
  { label: "format_version (entity)", snippet: '"format_version": "${1:1.21.80}"', detail: "top-level format_version field for this entity file", type: "property", context: "entity" },
  { label: "format_version (client entity)", snippet: '"format_version": "${1:1.10.0}"', detail: "top-level format_version field for this client entity file", type: "property", context: "client_entity" },
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
  { label: "component_groups", snippet: '"component_groups": {\n\t"${1:group_name}": {\n\t\t$0\n\t}\n}', detail: "entity component groups", type: "property", context: "entity" },
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
  { label: "minecraft:block", snippet: '"format_version": "${1:1.21.80}",\n"minecraft:block": {\n\t"description": {\n\t\t"identifier": "${2:namespace}:${3:block_name}",\n\t\t"menu_category": { "category": "construction" }\n\t},\n\t"components": {\n\t\t$0\n\t}\n}', detail: "block root (with format_version)", type: "type", context: "block" },
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
  // ---- item ---------------------------------------------------------------
  { label: "minecraft:item", snippet: '"format_version": "${1:1.21.80}",\n"minecraft:item": {\n\t"description": {\n\t\t"identifier": "${2:namespace}:${3:item_name}",\n\t\t"category": "items"\n\t},\n\t"components": {\n\t\t$0\n\t}\n}', detail: "item root (with format_version)", type: "type", context: "item" },
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
  // ---- recipes ------------------------------------------------------------
  { label: "minecraft:recipe_shaped", snippet: '"format_version": "${1:1.21.80}",\n"minecraft:recipe_shaped": {\n\t"description": { "identifier": "${2:namespace}:${3:recipe_id}" },\n\t"tags": ["crafting_table"],\n\t"pattern": ["${4:AAA}", "${5:ABA}", "${6:AAA}"],\n\t"key": { "A": { "item": "${7:minecraft:stick}" } },\n\t"result": { "item": "${8:namespace:item_name}" }\n}', detail: "shaped crafting recipe (with format_version)", type: "type", context: "recipe" },
  { label: "minecraft:recipe_shapeless", snippet: '"format_version": "${1:1.21.80}",\n"minecraft:recipe_shapeless": {\n\t"description": { "identifier": "${2:namespace}:${3:recipe_id}" },\n\t"tags": ["crafting_table"],\n\t"ingredients": [{ "item": "${4:minecraft:stick}" }],\n\t"result": { "item": "${5:namespace:item_name}" }\n}', detail: "shapeless crafting recipe (with format_version)", type: "type", context: "recipe" },
  { label: "minecraft:recipe_furnace", snippet: '"format_version": "${1:1.21.80}",\n"minecraft:recipe_furnace": {\n\t"description": { "identifier": "${2:namespace}:${3:recipe_id}" },\n\t"tags": ["furnace"],\n\t"input": "${4:minecraft:cobblestone}",\n\t"output": "${5:minecraft:stone}"\n}', detail: "furnace smelting recipe (with format_version)", type: "type", context: "recipe" },
  { label: "minecraft:recipe_brewing_mix", snippet: '"format_version": "${1:1.21.80}",\n"minecraft:recipe_brewing_mix": {\n\t"description": { "identifier": "${2:namespace}:${3:recipe_id}" },\n\t"tags": ["brewing_stand"],\n\t"input": "${4:minecraft:potion_type_awkward}",\n\t"reagent": "${5:minecraft:nether_wart}",\n\t"output": "${6:minecraft:potion_type_thick}"\n}', detail: "brewing recipe (with format_version)", type: "type", context: "recipe" },
  { label: "format_version (recipe)", snippet: '"format_version": "${1:1.21.80}"', detail: "top-level format_version field for this recipe file", type: "property", context: "recipe" },
  // ---- animation / render controllers -------------------------------------
  { label: "animations (root)", snippet: '"format_version": "1.10.0",\n"animations": {\n\t"animation.${1:entity}.${2:name}": {\n\t\t"loop": true,\n\t\t"bones": {}\n\t}\n}', detail: ".animation.json root", type: "type", context: "animation" },
  { label: "animation_controllers (root)", snippet: '"format_version": "1.10.0",\n"animation_controllers": {\n\t"controller.animation.${1:entity}.${2:name}": {\n\t\t"initial_state": "${3:default}",\n\t\t"states": {\n\t\t\t"${3:default}": {\n\t\t\t\t"animations": [],\n\t\t\t\t"transitions": []\n\t\t\t}\n\t\t}\n\t}\n}', detail: "animation controller root", type: "type", context: "animation_controller" },
  { label: "render_controllers (root)", snippet: '"format_version": "1.10.0",\n"render_controllers": {\n\t"controller.render.${1:name}": {\n\t\t"geometry": "Geometry.default",\n\t\t"materials": [{ "*": "Material.default" }],\n\t\t"textures": ["Texture.default"]\n\t}\n}', detail: "render controller root", type: "type", context: "render_controller" },
  { label: "on_entry / on_exit", snippet: '"on_entry": ["${1:@s query.reset_variable}"],\n"on_exit": []$0', detail: "animation controller state hooks", type: "property", context: "animation_controller" },
  { label: "transitions", snippet: '"transitions": [\n\t{ "${1:next_state}": "${2:query.condition}" }\n]$0', detail: "animation controller transitions", type: "property", context: "animation_controller" },
  // ---- particles ------------------------------------------------------------
  { label: "particle_effect (root)", snippet: '"format_version": "1.10.0",\n"particle_effect": {\n\t"description": {\n\t\t"identifier": "${1:namespace}:${2:particle_name}",\n\t\t"basic_render_parameters": {\n\t\t\t"material": "particles_alpha",\n\t\t\t"texture": "textures/particle/${2:particle_name}"\n\t\t}\n\t},\n\t"components": {}\n}', detail: "particle root", type: "type", context: "particle" },
  // ---- loot / trading -------------------------------------------------------
  { label: "loot table pool", snippet: '"pools": [\n\t{\n\t\t"rolls": ${1:1},\n\t\t"entries": [\n\t\t\t{ "type": "item", "name": "${2:minecraft:apple}", "weight": ${3:1} }\n\t\t]\n\t}\n]$0', detail: "loot_table.json pool", type: "property", context: "loot" },
  { label: "trade table", snippet: '"tiers": [\n\t{\n\t\t"total_exp_required": ${1:0},\n\t\t"groups": [],\n\t\t"trades": [\n\t\t\t{\n\t\t\t\t"wants": [{ "item": "${2:minecraft:emerald}", "quantity": ${3:1} }],\n\t\t\t\t"gives": [{ "item": "${4:minecraft:bread}", "quantity": ${5:1} }]\n\t\t\t}\n\t\t]\n\t}\n]$0', detail: "trading.json tier", type: "property", context: "trade" },
  { label: "format_version (trade table)", snippet: '"format_version": "${1:1.21.80}"', detail: "optional top-level format_version field for this trade table", type: "property", context: "trade" },
  // ---- sounds -----------------------------------------------------------
  { label: "sound_definitions (root)", snippet: '"format_version": "1.14.0",\n"sound_definitions": {\n\t"${1:namespace}:${2:sound_name}": {\n\t\t"category": "${3:neutral}",\n\t\t"sounds": ["sounds/${2:sound_name}"]\n\t}\n}', detail: "sound_definitions.json root", type: "type", context: "sound" },
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

  if (has("render_controllers") || name.includes("render_controller")) return "render_controller";
  if (has("animation_controllers") || name.includes("animation_controller")) return "animation_controller";
  if (has("animations") || name.includes(".animation.")) return "animation";
  if (has("loot_tables")) return "loot";
  if (has("trading")) return "trade";
  if (has("recipes")) return "recipe";
  if (has("particles")) return "particle";
  if (has("blocks")) return "block";
  if (has("items")) return "item";
  if (has("entities")) {
    // Behavior pack entity files ("minecraft:entity") and resource pack
    // client entity files ("minecraft:client_entity") both conventionally
    // live in an "entities" folder, so use the BP/RP folder-name detector
    // above (rather than a narrow one-off check) to tell them apart -- it
    // also correctly handles the entities/ folder being nested a level or
    // two below the actual BP/RP folder.
    return packTypeForPath(path) === "rp" ? "client_entity" : "entity";
  }
  return null;
}
