---
description: TDD implementation with Ralph loop for autonomous building
---

# Build

## Overview

This is **FASE 2** of the 3-step gamedev workflow: define -> **build** -> test

The build phase uses Test-Driven Development with autonomous looping (Ralph Wiggum pattern) to implement features from requirements. It generates all tests first, then iterates through RED-GREEN-REFACTOR cycles until all tests pass.

**Trigger**: `/game:build` or `/game:build [feature-name]`

## Input

Reads from `.workspace/features/{feature-name}/01-define.md`:
- Requirements with IDs (REQ-XXX)
- Architecture design
- Scene/script structure

## Output Structure

```
.workspace/features/{feature-name}/
├── 01-define.md          # From define phase (input)
├── 02-build-log.md       # TDD cycle log
├── 03-playtest.md        # Checklist for test phase
├── playtest_scene.tscn   # Auto-generated test scene
└── debug_listener.gd     # Debug signal capture script

scenes/                    # Created .tscn files
scripts/                   # Created .gd files
resources/                 # Created .tres files
tests/
├── test_{feature}.gd     # Unit tests (GUT)
└── scenes/               # Integration test scenes
    └── test_{feature}_runtime.tscn
```

## Test Output Parsing (CRITICAL)

**ALL test runs must have their output PARSED before showing in context.**

Raw GUT output is ~500 lines per run. With 15 runs per build = 7500 lines of context bloat.

**Parsing rules:**

After running any GUT test command, parse the output to this format:

**PASS scenario (1 line):**
```
TESTS: 141/141 PASS (10.2s)
```

**FAIL scenario (max 10 lines):**
```
TESTS: 139/141 PASS (10.2s)
FAILED:
- test_health_system.test_req001: expected 100, got 0
- test_player.test_knockback: signal not emitted
```

**PENDING scenario (max 5 lines):**
```
TESTS: 4/15 PASS, 11 PENDING (2.1s)
```

**Parse logic:**
1. Find "Tests X" and "Passing X" in output
2. Find all "[Failed]:" lines with error details
3. Find all "[Pending]:" lines
4. Format as compact summary
5. ONLY show full output when debugging with -glog=3

**This reduces context by ~99% per test run.**

## Process

### FASE 0: Load Context

1. **If no feature name provided:**
   - List available features in `.workspace/features/`
   - Use **AskUserQuestion** to let user select

2. **Load 01-define.md:**
   - Extract all requirements (REQ-XXX format)
   - Parse architecture design
   - Identify scene/script structure

3. **Read implementation order:**

   Extract the implementation order from the `## Implementation Order` section in 01-define.md.
   This was determined during the define phase.

   ```
   Implementation order (from define phase):
   1. REQ-001 (base)
   2. REQ-002 (after REQ-001)
   3. REQ-003 (after REQ-002)
   ```

4. **Display context:**
   ```
   FEATURE: {feature-name}

   REQUIREMENTS:
   - REQ-001: [description]
   - REQ-002: [description]
   ...

   ARCHITECTURE:
   - Scenes: [list]
   - Scripts: [list]
   - Resources: [list]

   IMPLEMENTATION ORDER:
   1. REQ-001 (base)
   2. REQ-002 → REQ-001
   ...
   ```

### FASE 1: Generate All Tests First

#### Step 0: GUT Research (Just-in-Time)

Before generating tests, research GUT patterns relevant to this feature:

```
Launching godot-test-researcher...
```

```
Task(subagent_type="godot-test-researcher", prompt="
Feature: {feature-name}

Requirements to test:
{list from 01-define.md}

Classes being tested:
{from architecture section}

Research GUT patterns. Return COMPACT summary (max 50 lines):
- Key assertions (1 line each)
- 1 code pattern example (max 10 lines)
- Gotchas/warnings (1 line each)

DO NOT return full documentation.
")
```

**Expected output: ~30-50 lines of actionable patterns.**

Use research findings to inform test generation below.

#### Step 1: Generate Test Stubs

For EACH requirement, generate a corresponding test stub:

```gdscript
extends GutTest
## Tests for {Feature}
## Generated from 01-define.md requirements

var _sut: ClassName  # System Under Test


func before_each() -> void:
    pass  # Setup


func after_each() -> void:
    pass  # Cleanup


# REQ-001: {requirement description}
func test_req001_{snake_case_description}() -> void:
    pending("Not implemented")


# REQ-002: {requirement description}
func test_req002_{snake_case_description}() -> void:
    pending("Not implemented")
```

#### Step 2: Verify Test Structure

**Actions:**
1. Create `tests/test_{feature}.gd` with all test stubs
2. Run GUT tests to verify structure:
   ```bash
   "/c/Godot/Godot_v4.4.1-stable_win64.exe" --headless --path . -s addons/gut/gut_cmdln.gd -gexit -gtest=res://tests/test_{feature}.gd
   ```
3. All tests should be PENDING (yellow)

**Output:**
```
FASE 1 COMPLETE

Tests generated: {count}
Status: All PENDING

Ready for TDD cycle.
```

### FASE 2: TDD Cycle (Sequential with Context)

**IMPORTANT: Sequential Execution with Context Passing**

Requirements must be implemented SEQUENTIALLY (not parallel) because later requirements may depend on earlier ones.

#### Step 0: Initialize Ralph Loop

Ralph loop starts HERE (after successful test generation in FASE 1), not in FASE 0.
This ensures we only loop on actual implementation failures, not setup issues.

```bash
powershell -ExecutionPolicy Bypass -File .claude/scripts/ralph/setup-ralph-loop.ps1 `
  -Prompt @"
Feature: {feature-name}
Requirements:
{list from 01-define.md}

Implementation order (from FASE 0):
{dependency order}

Build this feature using TDD.
Output <promise>TDD_COMPLETE</promise> when ALL tests pass.
"@ `
  -MaxIterations 30 `
  -CompletionPromise "TDD_COMPLETE"
```

#### Step 1: Sequential TDD Loop

Use the IMPLEMENTATION ORDER determined in FASE 0 (no re-analysis needed).

```
implemented := []
files_created := []

FOR each REQ-XXX in DEPENDENCY ORDER:
    │
    ├── Gather current state:
    │   files_list := list all .gd files in scripts/
    │   classes := extract class names from files
    │
    ├── Build context string:
    │   context := "ALREADY IMPLEMENTED:
"
    │   FOR each prev_req in implemented:
    │       context += "- {prev_req}: {files created}
"
    │   context += "
EXISTING CLASSES:
"
    │   FOR each class in classes:
    │       context += "- {class} at {path}
"
    │
    └── Task(subagent_type="godot-tdd-implementer", prompt="
        Feature: {feature-name}

        {context}

        YOUR TASK:
        Requirement: {REQ-XXX}: {description}

        Test file: tests/test_{feature}.gd
        Test function: test_req{xxx}_{description}

        RULES:
        - DO NOT recreate existing classes
        - EXTEND existing code if needed
        - READ existing files before modifying

        Implement this requirement using TDD.
        ")
    │
    ├── On SUCCESS:
    │   implemented.append(REQ-XXX)
    │   files_created.extend(result.files)
    │   Log: "[REQ-XXX] PASS"
    │
    └── On FAIL:
        Log: "[REQ-XXX] FAIL - {reason}"
        (Continue to next, will retry in Ralph iteration)
```

**After all requirements processed:**
- If all PASS: Output `<promise>TDD_COMPLETE</promise>`
- If any FAIL: Output "{count} failed, continuing..."

```
RALPH LOOP START
================

Current test: test_req001_{description}
Status: PENDING

[ITERATION 1]
```

**For each pending test:**

#### Step 1: RED (Test Fails)
1. Implement the test assertion (replace `pending()` with actual test)
2. Run test - expect FAIL (class/method doesn't exist yet)
3. Log: `RED: test_req001 - FAIL (expected)`

```gdscript
# REQ-001: Water ability deals 20 damage
func test_req001_water_deals_20_damage() -> void:
    # Arrange
    var ability := WaterAbility.new()
    var target := MockTarget.new()
    add_child(ability)
    add_child(target)

    # Act
    ability.execute(target)

    # Assert
    assert_eq(target.damage_taken, 20, "Water should deal 20 damage")
```

#### Step 2: GREEN (Minimal Implementation)

**Before implementing, check if research is needed:**

```
Research Decision Logic:

IF implementation involves:
  - State machines          -> research needed
  - Custom signals          -> research needed
  - Custom Resources        -> research needed
  - Complex node hierarchy  -> research needed
  - Physics/collision       -> research needed
  - Animation integration   -> research needed
ELSE:
  - Basic property changes  -> no research
  - Simple methods          -> no research
  - Already researched pattern -> no research (use cache)
```

**If research IS needed:**

```
Launching godot-code-researcher...
```

```
Task(subagent_type="godot-code-researcher", prompt="
Feature: {feature-name}
Requirement: {REQ-XXX}: {description}
Pattern needed: {state machine / signals / resources / etc.}

Return COMPACT summary (max 50 lines):
- Key signals if needed (1 line each)
- 1 code pattern example (max 15 lines)
- Gotchas (1 line each)

DO NOT return full documentation.
")
```

**Expected output: ~30-50 lines of actionable code.**

**Then implement** (with or without research):
1. Create the minimal code to make the test pass
2. Create necessary classes, methods, scenes
3. Run test - expect PASS
4. Log: `GREEN: test_req001 - PASS`

#### Step 3: REFACTOR (Clean Up)
1. Clean up code while keeping tests green
2. Apply typed GDScript conventions
3. Run all tests to verify nothing broke
4. Log: `REFACTOR: complete, all tests still PASS`

#### Step 3b: Add Debug Hooks

After each requirement is implemented and refactored, add debug tracking for playtest:

```gdscript
# Debug hooks pattern - add to key methods
func execute(target: Node) -> void:
    print("[DEBUG] %s.execute() called - target: %s" % [name, target.name])
    # ... implementation
    print("[DEBUG] %s.execute() complete - damage: %d" % [name, _damage_dealt])

# For key events, emit debug signals
signal debug_ability_used(ability_name: String, data: Dictionary)

func _on_ability_complete() -> void:
    debug_ability_used.emit(name, {"damage": _damage_dealt, "target": _target.name})
    print("[DEBUG] Signal emitted: debug_ability_used")
```

**Debug hook rules:**
- Add print statements for method entry/exit with key data
- Use consistent format: `[DEBUG] ClassName.method() - key: value`
- Emit `debug_*` signals for key events (captured by DebugListener in playtest)
- Include relevant state in signal data dictionaries

**When to add hooks:**
- Method that implements a requirement
- State changes (health, position, status)
- Event triggers (ability used, collision, timer complete)

#### Step 4: Next Test
1. Move to next pending test
2. Repeat RED-GREEN-REFACTOR

**Loop until:**
- All tests PASS
- No PENDING tests remain

**Output per iteration:**
```
[ITERATION {n}]
Test: test_req{xxx}_{description}
RED:      FAIL (class not found)
GREEN:    PASS (implemented WaterAbility.execute())
REFACTOR: PASS (added type hints)
Progress: {passed}/{total} tests passing
```

**Loop completion:**
```
RALPH LOOP COMPLETE

All {count} tests PASS

Files created:
- scripts/abilities/water_ability.gd
- resources/abilities/water.tres
...
```

### FASE 3 & 4: Integration Tests + Playtest Checklist (PARALLEL)

These two tasks have NO dependencies on each other - run them in parallel for efficiency.

```
Task(parallel=true):
  ├── Agent 1: Create integration test scenes (FASE 3)
  └── Agent 2: Generate playtest checklist (FASE 4)
```

#### FASE 3: Integration Test Scenes

Create runtime test scenes for MCP verification:

**File:** `tests/scenes/test_{feature}_runtime.tscn`
**Script:** `tests/scenes/test_{feature}_runtime.gd`

```gdscript
extends Node2D
## Integration test scene for {Feature}
## Run via MCP to verify runtime behavior

var _results: Dictionary = {}
var _all_passed: bool = false


func _ready() -> void:
    await _run_all_tests()
    _report_and_quit()


func _run_all_tests() -> void:
    print("INTEGRATION TEST START: {feature}")

    _results["req001_damage"] = await _test_req001_damage()
    _results["req002_spawn"] = await _test_req002_spawn()
    # Add more tests as needed

    _all_passed = _results.values().all(func(r): return r)


func _test_req001_damage() -> bool:
    # Test implementation
    var ability := WaterAbility.new()
    add_child(ability)
    # ... test logic
    return true  # or false


func _test_req002_spawn() -> bool:
    # Test implementation
    return true


func _report_and_quit() -> void:
    print("")
    print("INTEGRATION TEST RESULTS:")
    for test_name in _results:
        var status := "PASS" if _results[test_name] else "FAIL"
        print("TEST:%s:%s" % [test_name, status])

    print("")
    var final_status := "PASS" if _all_passed else "FAIL"
    print("FINAL:%s" % final_status)

    get_tree().quit(0 if _all_passed else 1)
```

**Run via MCP:**
```python
# Launch test scene
run_project(projectPath=".", scene="res://tests/scenes/test_{feature}_runtime.tscn")

# Wait for completion, then get output
get_debug_output()

# Parse output for FINAL:PASS or FINAL:FAIL
```

**Output:**
```
FASE 3 COMPLETE

Integration test scene created:
- tests/scenes/test_{feature}_runtime.tscn
- tests/scenes/test_{feature}_runtime.gd

MCP verification command:
run_project(scene="res://tests/scenes/test_{feature}_runtime.tscn")
```

#### FASE 4: Generate Playtest Checklist

Create `03-playtest.md` for the test phase:

```markdown
# Playtest Checklist: {Feature}

## Build Summary

**Feature:** {feature-name}
**Build Date:** {date}
**Tests:** {passed}/{total} passing

## Automated Tests Status

| REQ | Test | Status |
|-----|------|--------|
| REQ-001 | test_req001_water_deals_20_damage | PASS |
| REQ-002 | test_req002_puddle_spawns | PASS |

## Files Created

### Scenes
- `scenes/{feature}.tscn`

### Scripts
- `scripts/{category}/{script}.gd`

### Resources
- `resources/{category}/{resource}.tres`

## Manual Playtest Required

### Setup
1. Run scene: `res://scenes/{test_scene}.tscn`
2. Controls: {describe controls}

### Checklist

| # | Test | Pass | Notes |
|---|------|------|-------|
| 1 | {Visual/audio test 1} | [ ] | |
| 2 | {Visual/audio test 2} | [ ] | |
| 3 | {Edge case test} | [ ] | |

## Feedback Format

Use `/game:test {feature}` with results:
```
1:PASS
2:FAIL {reason}
3:PASS
```
```

#### FASE 4b: Create Playtest Scene

Create the test environment scene for `/game:test`:

**Scene path:** `.workspace/features/{feature-name}/playtest_scene.tscn`

```python
# 1. Create base scene
mcp__godot-mcp__create_scene(
    projectPath=".",
    scenePath=".workspace/features/{feature-name}/playtest_scene.tscn",
    rootNodeType="Node2D"
)

# 2. Add standard playtest components
mcp__godot-mcp__add_node(..., nodeType="Camera2D", nodeName="Camera2D", properties={"current": true})
mcp__godot-mcp__add_node(..., nodeType="Marker2D", nodeName="PlayerSpawn")
mcp__godot-mcp__add_node(..., nodeType="CharacterBody2D", nodeName="TestTarget")
mcp__godot-mcp__add_node(..., nodeType="ColorRect", nodeName="ArenaBounds")
mcp__godot-mcp__add_node(..., nodeType="Node", nodeName="DebugListener")
```

**Scene structure:**
```
PlaytestArena (Node2D)
├── Camera2D (current=true)
├── PlayerSpawn (Marker2D)
├── Player (instanced from scenes/player/ if exists)
├── TestTarget (CharacterBody2D for ability targets)
├── ArenaBounds (ColorRect, visual boundary)
├── FeatureUnderTest (instanced based on feature type)
└── DebugListener (captures debug signals)
```

**DebugListener script** - create `.workspace/features/{feature-name}/debug_listener.gd`:

```gdscript
extends Node
## Auto-generated debug listener for playtest
## Captures all debug_* signals and logs them for analysis

var _debug_log: Array[Dictionary] = []


func _ready() -> void:
    _connect_debug_signals(get_parent())
    print("[PLAYTEST] Debug listener active - tracking %d signals" % _debug_log.size())


func _connect_debug_signals(node: Node) -> void:
    for signal_info in node.get_signal_list():
        if signal_info.name.begins_with("debug_"):
            node.connect(signal_info.name, _on_debug_signal.bind(node.name, signal_info.name))
    for child in node.get_children():
        _connect_debug_signals(child)


func _on_debug_signal(data: Variant, node_name: String, signal_name: String) -> void:
    var entry := {
        "time": Time.get_ticks_msec(),
        "node": node_name,
        "signal": signal_name,
        "data": data
    }
    _debug_log.append(entry)
    print("[PLAYTEST] %s.%s: %s" % [node_name, signal_name, str(data)])


func get_log() -> Array[Dictionary]:
    return _debug_log


func get_log_summary() -> String:
    var summary := "Debug Log (%d entries):\n" % _debug_log.size()
    for entry in _debug_log:
        summary += "  %dms: %s.%s\n" % [entry.time, entry.node, entry.signal]
    return summary
```

**Determine feature components:**
- Read `01-define.md` architecture section
- If ability: add ability scene/script to player
- If mechanic: add relevant nodes
- If UI: add UI scene

**Output:**
```
FASE 4b COMPLETE

Playtest scene created:
- .workspace/features/{feature-name}/playtest_scene.tscn
- .workspace/features/{feature-name}/debug_listener.gd

Components: Camera2D, PlayerSpawn, TestTarget, ArenaBounds, DebugListener
Ready for /game:test
```

### FASE 5: Completion

**Step 0: Ralph Completion Check**If Ralph loop is active (`.claude/ralph-loop.local.md` exists):```IF all tests PASS:    Output: <promise>TDD_COMPLETE</promise>    → Ralph hook detects, allows exit, cleans up state fileELSE:    Output: "{failed_count} tests failed"    → Ralph hook blocks exit, re-feeds prompt for next iteration```
1. **Update build log:**
   Create/update `02-build-log.md` with full TDD history:

   ```markdown
   # Build Log: {Feature}

   ## Summary
   - Start: {timestamp}
   - Complete: {timestamp}
   - Tests: {count}
   - Iterations: {count}

   ## TDD Cycle Log

   ### test_req001_water_deals_20_damage
   - RED: FAIL - WaterAbility class not found
   - GREEN: PASS - Created water_ability.gd
   - REFACTOR: Added type hints

   ### test_req002_puddle_spawns
   ...

   ## Files Created
   - scripts/abilities/water_ability.gd
   - tests/test_water_ability.gd
   ...
   ```

2. **Output summary:**
   ```
   BUILD COMPLETE: {feature}
   ========================

   Tests: {passed}/{total} PASS
   Files created: {count}

   Created files:
   - tests/test_{feature}.gd
   - tests/scenes/test_{feature}_runtime.tscn
   - scripts/...
   - scenes/...

   Documentation:
   - .workspace/features/{feature}/02-build-log.md
   - .workspace/features/{feature}/03-playtest.md
   ```

   Then show the next step as a separate copyable block:
   ```
   **Next Step**

   `/game:test {feature}`
   ```

3. **Sync backlog:**

   **Backlog uses list-based format (not tables).**

   - Read `.workspace/backlog.md`
   - Find feature in MVP/Phase 2/Phase 3/Ad-hoc sections
   - Move feature from `### DEF` to `### BLT` subsection
   - Update section header counts: `({done}/{total} done)`
   - Update "Updated" timestamp

   **Example:**
   ```markdown
   ### DEF
   - **element-water** (CONTENT) → ability-system
   ```
   Moves to:
   ```markdown
   ### BLT
   - **element-water** (CONTENT) → ability-system
   ```

   **Output:**
   ```
   BACKLOG SYNCED

   Feature: {feature-name}
   Status: DEF → BLT
   ```

4. **Send notification:**
   ```bash
   powershell -ExecutionPolicy Bypass -File .claude/scripts/notify.ps1 -Title "Claude Code" -Message "Build complete: {feature}"
   ```

## GUT Test Conventions

### Test File Structure

```gdscript
extends GutTest
## Tests for {ClassName}
## Requirements: REQ-001, REQ-002, ...

var _sut: ClassName  # System Under Test


func before_each() -> void:
    _sut = ClassName.new()
    add_child(_sut) if _sut is Node else null
    await get_tree().process_frame


func after_each() -> void:
    if _sut and is_instance_valid(_sut):
        _sut.queue_free() if _sut is Node else _sut.free()


# REQ-001: {requirement}
func test_req001_{description}() -> void:
    # Arrange
    var expected := 20

    # Act
    var result := _sut.calculate_damage()

    # Assert
    assert_eq(result, expected, "Damage should be 20")
```

### Assertion Methods

```gdscript
assert_eq(got, expected, message)      # Equality
assert_ne(got, expected, message)      # Not equal
assert_true(condition, message)        # Boolean true
assert_false(condition, message)       # Boolean false
assert_null(value, message)            # Is null
assert_not_null(value, message)        # Not null
assert_has(array, value, message)      # Contains
assert_signal_emitted(obj, signal)     # Signal was emitted
pending(message)                       # Mark as pending
```

### Mock Objects

```gdscript
# Simple mock
var mock_target := double(Target).new()
stub(mock_target, "take_damage").to_do_nothing()

# Verify calls
assert_called(mock_target, "take_damage")
assert_call_count(mock_target, "take_damage", 1)
```

## GUT Commands Reference

```bash
# Run all tests
"/c/Godot/Godot_v4.4.1-stable_win64.exe" --headless --path . -s addons/gut/gut_cmdln.gd -gexit

# Run with verbose output
"/c/Godot/Godot_v4.4.1-stable_win64.exe" --headless --path . -s addons/gut/gut_cmdln.gd -gexit -glog=3

# Run specific test file
"/c/Godot/Godot_v4.4.1-stable_win64.exe" --headless --path . -s addons/gut/gut_cmdln.gd -gexit -gtest=res://tests/test_{feature}.gd

# Run tests matching name pattern
"/c/Godot/Godot_v4.4.1-stable_win64.exe" --headless --path . -s addons/gut/gut_cmdln.gd -gexit -gunit_test_name={pattern}
```

## Error Handling

### Test Failures During Ralph Loop

If a test fails unexpectedly during GREEN phase:
1. Log the failure with full error message
2. Analyze the error
3. Fix the implementation
4. Re-run test
5. Continue only when PASS

### Build Blockers

If implementation is blocked:
1. Log the blocker in 02-build-log.md
2. Mark affected tests as BLOCKED
3. Continue with other tests
4. Report blockers at completion

### Recovery

If Ralph loop needs to restart:
1. Read 02-build-log.md for progress
2. Skip completed tests
3. Resume from last incomplete test

## Examples

### Example: Water Ability Build

**Input:** `.workspace/features/water-ability/01-define.md`

```
FASE 0: Load Context
====================

FEATURE: water-ability

REQUIREMENTS:
- REQ-001: Water ability deals 20 damage
- REQ-002: Puddle spawns at impact location
- REQ-003: Puddle slows enemies by 30%

ARCHITECTURE:
- Scripts: scripts/abilities/water_ability.gd
- Resources: resources/abilities/water.tres
- Scenes: scenes/abilities/water_projectile.tscn

FASE 1: Generate Tests
======================

[GUT Research]
Launching godot-test-researcher...
Research complete: Using assert_eq for damage, assert_not_null for spawning, mock targets

Created: tests/test_water_ability.gd
Tests: 3 (all PENDING)

FASE 2: Sequential TDD
======================

[IMPLEMENTATION ORDER - from define phase]
REQ-001: None (base)
REQ-002: REQ-001 (needs WaterAbility)
REQ-003: REQ-002 (needs Puddle)

[ITERATION 1]
Test: test_req001_water_deals_20_damage
Context: (no previous implementations)
RED:      FAIL (WaterAbility not found)
[Research: Not needed - simple class creation]
GREEN:    PASS (created water_ability.gd)
REFACTOR: PASS (added type hints)
Progress: 1/3 tests passing

[ITERATION 2]
Test: test_req002_puddle_spawns_at_impact
Context: WaterAbility exists at scripts/abilities/water_ability.gd
RED:      FAIL (spawn_puddle method missing)
[Research: Needed - signal pattern for spawn events]
Launching godot-code-researcher...
GREEN:    PASS (implemented spawn_puddle with signal)
REFACTOR: PASS (extracted constant)
Progress: 2/3 tests passing

[ITERATION 3]
Test: test_req003_puddle_slows_enemies
Context: WaterAbility, Puddle exist
RED:      FAIL (slow_effect method missing)
[Research: Needed - Area2D slow effect pattern]
Launching godot-code-researcher...
GREEN:    PASS (added slow_effect to puddle.gd)
REFACTOR: PASS (used signal for decoupling)
Progress: 3/3 tests passing

RALPH LOOP COMPLETE - All 3 tests PASS

FASE 3: Integration Tests
=========================

Created: tests/scenes/test_water_ability_runtime.tscn

FASE 4: Playtest Checklist
==========================

Created: .workspace/features/water-ability/03-playtest.md

FASE 5: Complete
================

BUILD COMPLETE: water-ability

Tests: 3/3 PASS
Files created: 5

Next step: /game:test water-ability
```
