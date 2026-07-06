# PHASE 3: Build Tracks

Load this file when entering PHASE 3. It contains the full Track A (TDD) and Track B (Implementation Only) instructions.

---

## Track A: TDD Requirements

### Sequential TDD Loop

Use the IMPLEMENTATION ORDER determined in PHASE 0 (no re-analysis needed).

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
If any requirement cannot pass, log as BLOCKED in feature.json build.blockers.

**On unexpected runtime/environment error** (Godot crashes, GUT runner fails to start, missing autoloads, broken APIs that should exist): do NOT immediately patch — root-cause first.

1. **Identify the actual provider**: which Godot version / GUT version / autoload owns the failing API? Check `project.godot` for `config/features`, check GUT version in `addons/gut/`, search the error string in Godot's output verbatim.
2. **Confirm the cause before mitigating**: state in one sentence which component is responsible (e.g. `GUT 9.x removed assert_called_on_obj — use assert_called`) — not which one you assume is responsible.
3. **Then patch**, and record the confirmed cause in the learning (PHASE 3A → learnings). A learning that names the wrong layer will misdirect future builds.

If root-cause cannot be confirmed within 2 attempts: log as blocker with `"cause": "unknown"` rather than guessing.

### RED-GREEN-REFACTOR per test:

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

---

## Track B: Implementation Only Requirements

For each Implementation Only requirement (in dependency order):

1. **Implement directly** based on requirements and architecture from feature.json
2. **Add debug hooks** (same rules as TDD track)
3. **NO tests** — skip test generation entirely
4. **Update feature.json**: set `requirements[].status` → `"built"`, add `technique: "implementation-only"` and `skipTestReason` (`visual-only`, `config-only`, or `prototype`)
5. Log: `IMPL-ONLY: REQ-{xxx} implemented (reason: {skipTestReason})`

---

## Loop Completion

```
BUILD CYCLE COMPLETE

TDD: {tdd_passed}/{tdd_total} tests PASS
Impl-Only: {only_count} implemented (no tests)

Files created:
- scripts/abilities/water_ability.gd
- resources/abilities/water.tres
...
```
