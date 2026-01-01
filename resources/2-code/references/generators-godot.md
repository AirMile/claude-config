# Godot Game Documentation Generators

## Overview
Documentation generators specifically for Godot Engine projects (GDScript, C#, scenes).

---

## Generators for Godot Projects

### 1. **update_scenes.py** (Godot Version)
**Output:** `docs/scenes.mmd`

**Scans:**
- `*.tscn` scene files (text format)
- Node hierarchy
- Script attachments
- Scene instances

**Implementation Notes:**
- Parse `.tscn` files (Godot text format)
- Extract node hierarchy (`[node name="..." type="..."]`)
- Show script attachments (`script = ExtResource(...)`)
- Identify instanced scenes (`instance = ExtResource(...)`)
- Show node path relationships
- Color-code: Player, Enemies, UI, Level, Managers

---

### 2. **update_game_classes.py** (GDScript)
**Output:** `docs/game-classes.mmd`

**Scans:**
- `*.gd` GDScript files
- `*.cs` C# files (if using C#)
- Class definitions (`class_name`)
- Inheritance (`extends`)

**Implementation Notes:**
- Parse GDScript files
- Extract: `class_name`, `extends`, `var`, `func`
- Detect inheritance chain
- Show exported variables (`@export`)
- Map node references (`@onready var ...`)
- Support both GDScript and C#

---

### 3. **update_signals.py** (Godot Specific)
**Output:** `docs/signals.mmd`

**Scans:**
- Signal definitions (`signal signal_name`)
- Signal connections in scenes
- Signal emissions (`emit_signal()`)

**Implementation Notes:**
- Parse `.gd` files for `signal` definitions
- Parse `.tscn` files for signal connections
- Extract `connect()` calls in scripts
- Map signal → connected methods
- Show cross-node communication
- Identify autoload (singleton) signals

---

## Priority Implementation

1. **HIGH:** `update_scenes.py` (Godot) - Scene hierarchy
2. **HIGH:** `update_game_classes.py` (GDScript) - Class diagram
3. **MEDIUM:** `update_signals.py` - Signal connections (Godot-specific!)
4. **MEDIUM:** `update_state_machines.py` - AI + Animation states

---

## Godot Project Detection

**Markers:**
- `project.godot` file exists
- `*.tscn` scene files exist
- `*.gd` GDScript files exist

**Version Detection:**
- Parse `project.godot` → `config_version=5` (Godot 4.x)
- Parse `project.godot` → `config_version=4` (Godot 3.x)

---

## Godot 3.x vs 4.x Differences

### Nodes:
- **Godot 3:** `Sprite`, `KinematicBody2D`
- **Godot 4:** `Sprite2D`, `CharacterBody2D`

### Exports:
- **Godot 3:** `export var speed = 10`
- **Godot 4:** `@export var speed: float = 10.0`

**Generators must support both versions!**

---

*Planning document - Not yet implemented*
