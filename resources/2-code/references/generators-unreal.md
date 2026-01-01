# Unreal Engine Documentation Generators

## Overview
Documentation generators specifically for Unreal Engine projects (C++, Blueprints, levels).

---

## Generators for Unreal Projects

### 1. **update_scenes.py** (Unreal Version)
**Output:** `docs/scenes.mmd`

**Scans:**
- `Content/Maps/*.umap` level files
- Actor hierarchy in levels
- Blueprint instances
- Static mesh placements

**Implementation Notes:**
- Parse `.umap` files (Unreal binary/text format)
- Extract Actor placements
- Show Blueprint instances vs C++ actors
- Component hierarchy per actor
- Group by actor type (Player, NPCs, Environment, Lighting)
- Color-code: Blueprints vs C++ actors

---

### 2. **update_blueprints.py**
**Output:** `docs/blueprints.mmd`

**Scans:**
- `Content/**/*.uasset` Blueprint files
- Blueprint graph structure
- Functions, events, variables
- Parent Blueprint inheritance

**Implementation Notes:**
- Parse Blueprint asset files
- Extract Event Graph nodes
- Show node connections (execution flow)
- Identify: Events, Functions, Macros, Variables
- Map Blueprint inheritance (Parent → Child)
- Detect Interface implementations

---

### 3. **update_game_classes.py** (C++)
**Output:** `docs/game-classes.mmd`

**Scans:**
- `Source/**/*.h` and `*.cpp` files
- C++ class definitions
- UObject/AActor inheritance
- Component relationships

**Implementation Notes:**
- Parse C++ header files
- Extract: classes, structs, enums
- Detect inheritance (`class X : public AActor`)
- Show component composition (`UPROPERTY` components)
- Extract functions (public, protected, private)
- Map Blueprint-exposed functions (`UFUNCTION(BlueprintCallable)`)

---

## Priority Implementation

1. **HIGH:** `update_scenes.py` (Unreal) - Level/map hierarchy
2. **HIGH:** `update_blueprints.py` - Blueprint graphs
3. **MEDIUM:** `update_game_classes.py` (C++) - Class diagram
4. **MEDIUM:** `update_state_machines.py` (Unreal) - Animation + AI

---

## Unreal Project Detection

**Markers:**
- `*.uproject` file exists
- `Content/` folder exists
- `Source/` folder exists (C++ project)
- `Config/` folder exists

---

*Planning document - Not yet implemented*
