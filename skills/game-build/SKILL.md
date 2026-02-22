---
name: game-build
description: Build features with technique mapping (TDD vs Implementation First) for Godot 4.x. Use with /game-build after /game-define. TDD for logic/calculations, Implementation First for visual/scene setup.
disable-model-invocation: true
metadata:
  author: mileszeilstra
  version: 2.0.0
  category: game
---

# Build

## Overview

FASE 2 of the gamedev workflow: plan -> define -> **build** -> test -> refactor

The build phase implements features from requirements using technique mapping: TDD for logic/calculations, Implementation First for visual/scene setup. It generates tests, iterates through RED-GREEN-REFACTOR cycles, and syncs codebase understanding.

**Trigger**: `/game-build` or `/game-build [feature-name]`

## Input

Reads from `.project/features/{feature-name}/01-define.md`:

- Requirements with IDs (REQ-XXX)
- Architecture design
- Scene/script structure

## Output Structure

```
.project/features/{feature-name}/
├── 01-define.md          # From define phase (input)
├── 02-build-log.md       # TDD cycle log + codebase sync
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

1. **If no feature name provided — check backlog:**
   - Read `.project/backlog.html`, parse JSON uit `<script id="backlog-data">` blok (zie `shared/BACKLOG.md`)
   - Filter DEF features: `data.features.filter(f => f.status === "DEF")`
   - Eerste DEF feature is de suggested next feature
   - Use **AskUserQuestion** with backlog-suggested feature:
     ```
     Backlog suggests: {feature-name}
     DEF features available: {list}
     Build {feature-name}? (or specify another)
     ```

2. **Load architecture baseline:**
   - `Read(".claude/research/architecture-baseline.md")`
   - If not found: warn user but continue
     ```
     WARNING: No architecture-baseline.md found.
     Run /game-plan or create .claude/research/architecture-baseline.md for better context.
     Continuing without baseline...
     ```

3. **Load 01-define.md:**
   - Extract all requirements (REQ-XXX format)
   - Parse architecture design
   - Identify scene/script structure

4. **Read implementation order:**

   Extract the implementation order from the `## Implementation Order` section in 01-define.md.
   This was determined during the define phase.

   ```
   Implementation order (from define phase):
   1. REQ-001 (base)
   2. REQ-002 (after REQ-001)
   3. REQ-003 (after REQ-002)
   ```

5. **Display context:**

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
   2. REQ-002 -> REQ-001
   ...
   ```

**Capture git baseline** (for scoped commit at end of skill):

```bash
mkdir -p .project/session
git status --porcelain | sort > .project/session/pre-skill-status.txt
```

### FASE 1: Technique Mapping

Per requirement, assign a technique: **TDD** or **Implementation First**.

#### Decision Logic

**TDD** (test first, then implement):

- Game logic and calculations
- Physics calculations
- Damage formulas and stat systems
- State transitions and state machines
- Signal flows and event handling
- Data transformations

**Implementation First** (implement, then write verification test):

- Scene tree construction and node configuration
- Resource creation (.tres files)
- Visual configuration (sprites, animations, particles)
- Audio setup (AudioStreamPlayer nodes)
- UI layout and theme configuration

See `techniques/implementation-first.md` for the full Implementation First process.

#### Assignment

```
TECHNIQUE MAPPING:

TDD:
- REQ-001: Water ability deals 20 damage [logic]
- REQ-003: Puddle slows enemies by 30% [calculation]

IMPLEMENTATION FIRST:
- REQ-002: Puddle spawns at impact location [scene setup]
- REQ-004: Water splash particle effect [visual]
```

Use **AskUserQuestion** for confirmation:

```
Technique mapping ready. {n_tdd} TDD, {n_impl} Implementation First.
Confirm or adjust? (show mapping above)
```

### FASE 2: Generate Tests (TDD Requirements)

#### Step 0: GUT Research (Just-in-Time)

Before generating tests, research GUT patterns relevant to this feature:

```
Launching godot-test-researcher...
```

```
Task(subagent_type="godot-test-researcher", prompt="
Feature: {feature-name}

Requirements to test:
{TDD requirements list from technique mapping}

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

For each **TDD** requirement, generate a corresponding test stub:

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

# REQ-003: {requirement description}
func test_req003_{snake_case_description}() -> void:
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
FASE 2 COMPLETE

Tests generated: {count} (TDD requirements only)
Status: All PENDING

Ready for TDD cycle.
```

### FASE 3: Build Cycle

Two tracks run based on technique mapping from FASE 1.

#### Track A: TDD Requirements

##### Sequential TDD Loop

Use the IMPLEMENTATION ORDER determined in FASE 0 (no re-analysis needed).

```
implemented := []
files_created := []

FOR each TDD REQ-XXX in DEPENDENCY ORDER:
    |
    +-- Gather current state:
    |   files_list := list all .gd files in scripts/
    |   classes := extract class names from files
    |
    +-- Build context string:
    |   context := "ALREADY IMPLEMENTED:\n"
    |   FOR each prev_req in implemented:
    |       context += "- {prev_req}: {files created}\n"
    |   context += "\nEXISTING CLASSES:\n"
    |   FOR each class in classes:
    |       context += "- {class} at {path}\n"
    |
    +-- Task(subagent_type="godot-tdd-implementer", prompt="
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
    |
    +-- On SUCCESS:
    |   implemented.append(REQ-XXX)
    |   files_created.extend(result.files)
    |   Log: "[REQ-XXX] PASS"
    |
    +-- On FAIL:
        Log: "[REQ-XXX] FAIL - {reason}"
        Analyze error, fix implementation, re-run test
        Only continue to next requirement when PASS
```

**After all TDD requirements processed:**

All TDD requirements should be PASS before proceeding to Track B.
If any requirement cannot pass, log as BLOCKED in 02-build-log.md.

##### RED-GREEN-REFACTOR per test:

**RED (Test Fails):**

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

**GREEN (Minimal Implementation):**

Before implementing, check if research is needed:

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
  - Already researched      -> no research (use cache)
```

If research IS needed:

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

Then implement:

1. Create the minimal code to make the test pass
2. Create necessary classes, methods, scenes
3. Run test - expect PASS
4. Log: `GREEN: test_req001 - PASS`

**REFACTOR (Clean Up):**

1. Clean up code while keeping tests green
2. Apply typed GDScript conventions
3. Run all tests to verify nothing broke
4. Log: `REFACTOR: complete, all tests still PASS`

**Add Debug Hooks:**

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

**Output per iteration:**

```
[ITERATION {n}]
Test: test_req{xxx}_{description}
RED:      FAIL (class not found)
GREEN:    PASS (implemented WaterAbility.execute())
REFACTOR: PASS (added type hints)
Progress: {passed}/{total} tests passing
```

#### Track B: Implementation First Requirements

For each Implementation First requirement (in dependency order):

1. **Implement directly** based on requirements and architecture from 01-define.md
2. **Add debug hooks** (same rules as TDD track)
3. **Write verification test** afterwards to capture expected behavior:

```gdscript
# Written AFTER implementation to verify behavior
func test_req{xxx}_{description}() -> void:
    var scene := preload("res://scenes/{feature}.tscn").instantiate()
    add_child(scene)
    await get_tree().process_frame

    # Assert scene structure
    assert_not_null(scene.get_node("ExpectedChild"))

    # Assert configuration
    assert_eq(scene.some_property, expected_value)

    scene.queue_free()
```

4. **Run verification test** to confirm it passes
5. Log: `IMPL-FIRST: REQ-{xxx} implemented + verified`

See `techniques/implementation-first.md` for detailed patterns.

**Loop completion:**

```
BUILD CYCLE COMPLETE

TDD: {tdd_passed}/{tdd_total} tests PASS
Impl-First: {impl_passed}/{impl_total} verified

Files created:
- scripts/abilities/water_ability.gd
- resources/abilities/water.tres
...
```

### FASE 3b: Integration Tests + Playtest (PARALLEL)

These two tasks have NO dependencies on each other - run them in parallel.

#### Integration Test Scenes

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

    _all_passed = _results.values().all(func(r): return r)

func _test_req001_damage() -> bool:
    var ability := WaterAbility.new()
    add_child(ability)
    # ... test logic
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
run_project(projectPath=".", scene="res://tests/scenes/test_{feature}_runtime.tscn")
get_debug_output()
# Parse output for FINAL:PASS or FINAL:FAIL
```

#### Playtest Checklist + Scene

Generate `03-playtest.md`:

```markdown
# Playtest Checklist: {Feature}

## Build Summary

**Feature:** {feature-name}
**Build Date:** {date}
**Tests:** {passed}/{total} passing ({tdd} TDD, {impl} impl-first)

## Automated Tests Status

| REQ     | Test                              | Technique  | Status |
| ------- | --------------------------------- | ---------- | ------ |
| REQ-001 | test_req001_water_deals_20_damage | TDD        | PASS   |
| REQ-002 | test_req002_puddle_spawns         | Impl-First | PASS   |

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

| #   | Test                  | Pass | Notes |
| --- | --------------------- | ---- | ----- |
| 1   | {Visual/audio test 1} | [ ]  |       |
| 2   | {Visual/audio test 2} | [ ]  |       |
| 3   | {Edge case test}      | [ ]  |       |

## Feedback Format

Use `/game-test {feature}` with results:
```

1:PASS
2:FAIL {reason}
3:PASS

```

```

**Create playtest scene** at `.project/features/{feature-name}/playtest_scene.tscn`:

```
PlaytestArena (Node2D)
+-- Camera2D (current=true)
+-- PlayerSpawn (Marker2D)
+-- Player (instanced from scenes/player/ if exists)
+-- TestTarget (CharacterBody2D for ability targets)
+-- ArenaBounds (ColorRect, visual boundary)
+-- FeatureUnderTest (instanced based on feature type)
+-- DebugListener (captures debug signals)
```

**DebugListener script** at `.project/features/{feature-name}/debug_listener.gd`:

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

### FASE 4: Codebase Sync

After build is complete, ensure the user understands what was built.

#### Step 1: Architecture Explanation

Claude explains the built architecture in plain, beginner-friendly language. No jargon — explain like talking to a student who is new to game development:

- **Wat doet het?**: wat de feature doet in het spel, in 1-2 simpele zinnen
- **Hoe ziet het eruit?**: 1-2 ASCII diagrammen die de architectuur visueel maken. Kies het meest relevante type:
  - **Scene tree**: node hierarchy met types (voor scene-based features)
  - **Signal flow**: welke nodes signalen uitzenden/ontvangen (voor event-driven features)
  - **State diagram**: state transitions (voor state machines)
  - Hou diagrammen compact (max 15 regels per diagram). Gebruik box-drawing characters (┌─┐│└─┘) en pijlen (→ ← ↓ ↑).

  ```
  Example:
  Player (CharacterBody2D)
  ├── Sprite2D
  ├── CollisionShape2D
  ├── AbilitySystem (Node)
  │   └── WaterAbility ──signal──→ HUD.update_cooldown()
  └── HealthComponent ──signal──→ HUD.update_health()
  ```

- **Hoe werkt het onder de motorkap?**: welke scripts/scenes samenwerken, stap voor stap met concrete voorbeelden ("als de speler X doet, dan roept script A functie B aan, wat Y veroorzaakt")
- **Waar moet je op letten?**: niet-voor-de-hand-liggende keuzes met uitleg _waarom_

#### Step 2: Comprehension Check

Use **AskUserQuestion**:

Vraag: "Snap je hoe de feature werkt?"

Opties:

- "Ja, helder"
- "Leg het uitgebreider uit" — "Geef een stap-voor-stap uitleg met voorbeelden, alsof ik nieuw ben in gamedev"
- "Ik heb een vraag"

**Follow-up loop:** If user has questions or picks "Leg het uitgebreider uit", answer with more detail and examples. Repeat AskUserQuestion until user confirms understanding.

#### Step 3: Write Sync to Build Log

Append the architecture explanation to `02-build-log.md`:

```markdown
## Codebase Sync

**Explained to user:** {date}
**User confirmed understanding:** yes

### Architecture Summary

{plain language explanation from Step 1}

### Key Decisions

- {decision 1}: {why}
- {decision 2}: {why}
```

### FASE 4b: CLAUDE.md Auto-Sync

Update the project's CLAUDE.md with new scenes, scripts, signals, and resources created during this build.

**Process:**

1. Read current project CLAUDE.md
2. Identify new additions from this build:
   - New scenes (.tscn files)
   - New scripts (.gd files) with their class names
   - New signals defined
   - New resources (.tres files)
3. Update relevant CLAUDE.md sections (project structure, conventions, signals)
4. Follow `core-md-audit` quality rules — no stale info, no duplication, concise entries

**Output:**

```
CLAUDE.md SYNCED

Added:
- scripts/abilities/water_ability.gd (WaterAbility class)
- scenes/abilities/water_projectile.tscn
- signal: debug_ability_used
```

### FASE 5: Completion

1. **Update build log:**
   Create/update `02-build-log.md` with full TDD history:

   ```markdown
   # Build Log: {Feature}

   ## Summary

   - Start: {timestamp}
   - Complete: {timestamp}
   - Tests: {count} ({tdd_count} TDD, {impl_count} impl-first)
   - Iterations: {count}

   ## TDD Cycle Log

   ### test_req001_water_deals_20_damage [TDD]

   - RED: FAIL - WaterAbility class not found
   - GREEN: PASS - Created water_ability.gd
   - REFACTOR: Added type hints

   ### test_req002_puddle_spawns [IMPL-FIRST]

   - IMPLEMENTED: Created puddle scene and node config
   - VERIFIED: Verification test passes

   ## Files Created

   - scripts/abilities/water_ability.gd
   - tests/test_water_ability.gd
     ...

   ## Codebase Sync

   (appended in FASE 4)
   ```

2. **Output summary:**

   ```
   BUILD COMPLETE: {feature}
   ========================

   Tests: {passed}/{total} PASS ({tdd} TDD, {impl} impl-first)
   Files created: {count}

   Created files:
   - tests/test_{feature}.gd
   - tests/scenes/test_{feature}_runtime.tscn
   - scripts/...
   - scenes/...

   Documentation:
   - .project/features/{feature}/02-build-log.md
   - .project/features/{feature}/03-playtest.md
   ```

3. **Sync backlog** (zie `shared/BACKLOG.md`):
   - Read `.project/backlog.html`, parse JSON uit `<script id="backlog-data">` blok
   - Zoek feature in `data.features`/`data.adhoc`, zet `.status = "BLT"`
   - Zet `data.updated` naar huidige datum
   - Schrijf JSON terug via Edit tool (keep `<script>` tags intact)

   **Output:**

   ```
   BACKLOG SYNCED

   Feature: {feature-name}
   Status: DEF -> BLT
   ```

3b. **Dashboard sync** (zie `shared/DASHBOARD.md`):

- Read `.project/project.json` (skip als niet bestaat)
- Update `features` array: zoek feature op naam, zet status naar `"BLT"`
- Als feature niet bestaat: push met `{ name, status: "BLT", summary, created }`
- **Write build.json**: schrijf `.project/features/{feature-name}/build.json` met build data (zie `shared/DASHBOARD.md` voor schema)
- Write `.project/project.json`

4. **Scoped auto-commit** (only this skill's changes):

   Compare current git status with baseline from FASE 0:

   ```bash
   git status --porcelain | sort > /tmp/current-status.txt
   ```

   Categorize files by comparing with `.project/session/pre-skill-status.txt`:
   - **NEW** (only in current, not in baseline) → `git add` automatically
   - **OVERLAP** (in both baseline AND current) → warn user via AskUserQuestion: "These files had pre-existing uncommitted changes and were also modified by this skill: {list}. Include in commit?" Options: "Include (Recommended)" / "Skip"
   - **PRE-EXISTING** (only in baseline) → do NOT stage

   If baseline file doesn't exist, fall back to `git add -A`.

   ```bash
   git commit -m "build({feature}): {n} requirements ({tdd} TDD, {impl} impl-first)"
   ```

   Clean up: `rm -f .project/session/pre-skill-status.txt /tmp/current-status.txt`

   No Co-Authored-By line.

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

### Test Failures During TDD

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

## Troubleshooting

### Error: GUT tests not found or not running

**Cause:** GUT (Godot Unit Test) framework not installed or configured.
**Solution:** Verify `addons/gut/` exists in the project. Check `res://tests/` directory structure. Run tests manually with `godot --headless -s addons/gut/gut_cmdln.gd` to verify setup.

### Error: Scene tree errors during test

**Cause:** Node references breaking due to scene structure changes.
**Solution:** Check that `@onready` references match current scene tree. Use `has_node()` before accessing nodes. Review the test scene (`playtest_scene.tscn`) for missing dependencies.

### Error: Signal connections not working in tests

**Cause:** Signals may not be connected in the test scene context.
**Solution:** Ensure signals are connected in `_ready()` or via the editor. The debug_listener.gd captures signals -- check its output for missed connections.

### Error: Implementation First verification test fails

**Cause:** Scene structure doesn't match what the verification test expects.
**Solution:** Check node names and paths in the verification test match the actual scene tree. Use `print_tree_pretty()` to debug scene structure.
