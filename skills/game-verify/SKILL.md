---
name: game-verify
description: Human playtest verification with structured feedback. Use with /game-verify.
reads: [feature.requirements, feature.build, backlog.stage]
writes: [feature.tests, backlog.stage]
metadata:
  author: claude-config
  version: 2.3.0
  category: game
---

# Verify

## Overview

This is **PHASE 3** of the gamedev workflow: plan -> define -> build -> **verify** -> refactor

The verify phase handles human playtest verification of implemented game features through structured feedback, intelligent issue categorization, and iterative fix loops until all items pass.

**Trigger**: `/game-verify` or `/game-verify {feature-name}` or `/game-verify {feature-name} {feedback}`

## When to Use

This skill activates in these scenarios:

**Primary use:**

- After `/game-build` completes implementation
- When `.project/features/{name}/feature.json` exists with `tests.checklist[]`
- When human verification is needed for game mechanics

**Context indicators:**

- Feature has been implemented with build phase
- Playtest checklist exists in feature.json `tests.checklist[]`
- User wants to verify gameplay feels correct

**NOT for:**

- Initial feature planning (use /game-define)
- Implementation (use /game-build)
- Automated unit testing (use /dev-verify)

## Input Formats

### Format 1: Inline feedback (recommended)

```
/game-verify water-ability
1:PASS
2:PASS
3:FAIL puddle too small
4:FAIL no sound
```

### Format 2: Feature name only (shows checklist first)

```
/game-verify water-ability
```

### Format 3: Free text feedback

```
/game-verify water-ability
Everything works except puddle is too small and there's no sound
```

> Code quality rules: `../shared/CODING-RULES.md` (R009)

## Feedback Categorization

| Type           | Example                           | Action               |
| -------------- | --------------------------------- | -------------------- |
| **TESTABLE**   | "puddle radius=50, should be 100" | TDD fix loop         |
| **MEASURABLE** | "animation too slow"              | Direct fix + re-test |
| **SUBJECTIVE** | "doesn't feel right"              | Ask for details      |

### TESTABLE -> TDD Fix Loop

```
Feedback: "puddle radius 50, should be 100"
     |
Generate test: test_puddle_radius_is_100()
     |
Run test -> FAIL
     |
Fix code
     |
Run test -> PASS
     |
"Fixed. Re-test item 3."
```

### MEASURABLE -> Direct Fix

```
Feedback: "animation too slow"
     |
Adjust animation_speed from 1.0 to 1.5
     |
"Fixed. Re-test item 4."
(No automated test possible)
```

### SUBJECTIVE -> Ask Details

```
Feedback: "doesn't feel right"
     |
"Can you be more specific?
- Too fast/slow?
- Too strong/weak?
- Wrong timing?
- Something else?"
     |
User: "damage feels too low, expected 30 not 20"
     |
Now TESTABLE -> TDD fix loop
```

## Workflow

**Phase tracking** — first action of the skill: call `TaskCreate` with these 10 items (status `pending`), then use `TaskUpdate` to set each phase `in_progress` at the start and `completed` at the end. When context compacts, the task list stays visible — no risk of forgotten phases.

1. PHASE 0: Load Context
2. PHASE 1: Parse Feedback
3. PHASE 1b: Debug Analysis
4. PHASE 2: Categorize Issues
5. PHASE 3: Fix Loop
6. PHASE 4: Generate Re-test Checklist
7. PHASE 5: Re-test Loop
8. PHASE 5c: Regression Check
9. PHASE 5d: Requirement Verification
10. PHASE 6: Completion

Add conditionally via `TaskCreate`:

- All PASS + worktree branch detected → add PHASE Finalize at end

### PHASE 0: Load Context

> **Todo**: call `TaskCreate` with the 10 phase items (see above). Mark PHASE 0 → `in_progress` via `TaskUpdate`.

**Goal:** Load playtest checklist from build phase and prepare for feedback.

**Steps:**

1. **Check backlog for built features (if no feature name provided):**

   ```
   Read(".project/backlog.html")
   ```

   - If backlog exists: parse JSON from `<script id="backlog-data">` block (see `shared/BACKLOG.md`)
   - See `shared/BACKLOG.md → Lifecycle Protocol → Read`. Filter: `type === "FEATURE" && transition === "verifying"` — if found, auto-select (no modal needed).
   - Fallback: Filter built features: `data.features.filter(f => f.status === "DOING" && f.stage === "built")`

   Use **AskUserQuestion** if built features found:
   - header: "Feature"
   - question: "Which feature do you want to test? ({N} features in built stage)"
   - options:
     - label: "{feature-name} (Recommended)", description: "Next from backlog"
     - label: "Other feature", description: "I want to test a different feature"
   - multiSelect: false

2. **Parse user input:**
   - If feature name only -> show checklist, wait for feedback
   - If feature name + feedback -> parse feedback immediately
   - If "recent" -> find most recently modified feature.json with `tests.checklist`

3. **Worktree switch** — execute the procedure in `shared/WORKTREE.md` with the feature-name. Automatically switches to `worktree-{feature-name}` if it exists. On FAIL (in a different worktree than the feature): stop with the message from WORKTREE.md.

4. **Locate playtest checklist:**

   ```
   .project/features/{feature-name}/feature.json → tests.checklist[]
   ```

5. **Validate feature.json exists with tests.checklist:**

   **If not found:**

   ```
   NOT FOUND: feature.json with tests.checklist

   Feature: {feature-name}
   Searched: .project/features/{feature-name}/

   This feature needs to be built first.
   Run /game-build {feature-name} to implement and generate playtest checklist.
   ```

   -> Exit skill

6. **Read playtest checklist + classify items:**
   - Parse `tests.checklist[]` from feature.json
   - Note expected behavior for each item (from `title` field)
   - Count total items
   - **Classify each item:**
     - **COVERED**: GUT unit tests from `/game-build` already verify this requirement. Check `tests/test_{feature}.gd` for matching test functions. COVERED items are already verified — skip in playtest.
     - **MANUAL**: Requires human verification (gameplay feel, visuals, audio, game launch). Everything that is not COVERED.
   - Display classification:

   ```
   CHECKLIST CLASSIFICATION:

   COVERED ({N} items — skip, already verified by GUT tests):
   - Item {X}: {description} → test_{function}()

   MANUAL ({M} items — playtest required):
   - Item {Y}: {description}
   ```

   If all items are COVERED → skip playtest, go to PHASE 6 completion.

   **Goal-backward verification** — map tests back to acceptance criteria:

   Filter: skip requirements with `deltaOp === "REMOVED"` — do not include in the mapping.

   Build mapping from feature.json `requirements[].acceptance` (`[{ when, then }]` objects) and classified items. Each `{ when, then }` scenario = one row:

   | REQ   | When                    | Then (expected)      | Test Items | Coverage |
   | ----- | ----------------------- | -------------------- | ---------- | -------- |
   | REQ-1 | enemy hit by attack     | enemy takes damage   | Item 1, 3  | ✓        |
   | REQ-2 | critical hit registered | knockback is applied | —          | GAP      |

   **GAP**: requirement without test items (COVERED or MANUAL).
   **MISMATCH**: test items that verify implementation details instead of observable gameplay (test title references internal functions instead of player-visible behavior).

   No gaps, no mismatches → show `Acceptance mapping: {n}/{n} REQs covered` and continue.

   Gaps or mismatches → AskUserQuestion:
   - "Accept and continue (Recommended)" — note it, proceed
   - "Adjust test items" — add items for gaps, reformulate mismatches

7. **Verify playtest scene exists:**

   Scene path: `.project/features/{feature-name}/playtest_scene.tscn`

   **If scene exists:**

   ```
   PLAYTEST SCENE FOUND
   Path: .project/features/{feature-name}/playtest_scene.tscn
   Debug listener: Active
   ```

   **If scene NOT found:**

   ```
   ERROR: Playtest scene not found

   Expected: .project/features/{feature-name}/playtest_scene.tscn

   The /game-build phase should have created this scene.
   Run /game-build {feature-name} first, or check if build completed successfully.
   ```

   -> Exit skill

6b. **Post-Build Baseline Check** (if `build` section exists in feature.json)

Two checks before playtest:

**Check 1: Full GUT Regression Suite**

Run the full GUT test suite to verify all features still work:

```bash
"{godot_executable}" --headless --path . -s addons/gut/gut_cmdln.gd -gexit
```

Parse output (same rules as game-build: PASS 1 line, FAIL max 10 lines).

```
BASELINE: full suite → {passed}/{total} PASS
```

On failures:

- Distinguish failures from the CURRENT feature vs OTHER features
- Current feature fails → warn, continue with playtest (this is what we're going to test)
- Other feature fails → warn:

  ```
  ⚠ REGRESSION: {N} tests from other features failing
  - test_{other}.test_xxx: {reason}
  ```

  Use AskUserQuestion:
  - "Continue with playtest (Recommended)" — "Regressions are reported but don't block the test"
  - "Stop — fix regressions first" — "Fix the other features before testing this one"

If GUT is not available or no test files found → skip with: `BASELINE: skipped (no GUT tests found)`

**Check 2: Integration Test Scene**

Re-run the integration test scene as an additional check:

```bash
"{godot_executable}" --headless --path . -s res://tests/scenes/test_{feature}_runtime.tscn
```

Parse output for `FINAL:PASS` or `FINAL:FAIL`.

Display: `BASELINE: integration tests → {PASS|FAIL}`
On FAIL: warn ("Integration tests failing — possible regression since build"), show failed tests, continue with playtest.

If integration test scene does not exist → skip, no output.

6c. **Cross-Requirement Gameplay Scenarios** (if `build` section exists and 2+ requirements)

Analyze `requirements[]` from feature.json. Identify combinations where gameplay interactions touch multiple requirements.

Generate at most 3 gameplay scenarios:

```
GAMEPLAY SCENARIOS: {feature}

| # | Scenario                                           | Requirements      |
|---|----------------------------------------------------|-------------------|
| G1| Use ability → observe effect → check cooldown      | REQ-001 + REQ-003 |
| G2| Ability on multiple enemies → effects stack?       | REQ-001 + REQ-002 |
| G3| Ability while moving → position correct?           | REQ-001 + REQ-004 |
```

Add these to the checklist as extra items with `"integration": true, "type": "MANUAL"`.
They are included in the playtest instructions.

If there are no logical cross-requirement combinations → skip, no output.

7. **Launch game with test scenario:**

   ```python
   mcp__godot-mcp__run_project(
       projectPath=".",
       scene=".project/features/{feature-name}/playtest_scene.tscn"
   )
   ```

   **Display test scenario from feature.json tests.checklist:**

   ```
   GAME LAUNCHED - {feature-name}
   ==============================

   TEST SCENARIO:

   Step 1: {first action from checklist}
   Step 2: {second action}
   Step 3: {third action}
   ...

   EXPECTED BEHAVIOR:
   - {expected result 1}
   - {expected result 2}
   - {expected result 3}

   Debug tracking is active - your actions are being logged.

   Perform these actions in the game.
   Close the game when you are done.
   ```

   **Note:** Game runs in background. DebugListener captures all debug\_\* signals.

8. **Wait for user completion:**

   When user closes game or indicates ready, use AskUserQuestion tool:
   - header: "Test Result"
   - question: "How did the test go?"
   - options:
     - label: "Everything works (Recommended)", description: "All steps work as expected"
     - label: "There are issues", description: "Some things don't work correctly"
     - label: "Game crashed", description: "The game stopped unexpectedly"
   - multiSelect: false

   **Response handling:**

   **If "Everything works":**
   -> Skip to PHASE 6 (Completion), mark all items PASS

   **If "There are issues":**
   -> Proceed to PHASE 1b (Debug Analysis + User Details)

   **If "Game crashed":**

   ```python
   crash_output = mcp__godot-mcp__get_debug_output()
   ```

   -> Analyze crash, show error, offer to fix via TDD loop

9. **Display checklist (if no feedback provided):**

   ```
   PLAYTEST CHECKLIST: {feature-name}

   | # | Test | Expected |
   |---|------|----------|
   | 1 | {test description} | {expected behavior} |
   | 2 | {test description} | {expected behavior} |
   | 3 | {test description} | {expected behavior} |
   | 4 | {test description} | {expected behavior} |

   Play the game and report results.

   Feedback formats:
   - Quick: "1:PASS 2:PASS 3:FAIL too small 4:FAIL no sound"
   - Detailed: "Items 1-2 work, item 3 puddle too small, item 4 missing sound"
   ```

   -> Wait for user feedback

**Output (if feedback provided):**

```
PLAYTEST LOADED

Feature: {feature-name}
Items: {count}
Feedback: received

-> Parsing feedback...
```

---

**Tag backlog + capture baseline:**

- Backlog: read `.project/backlog.html` (if it exists), parse JSON (see `shared/BACKLOG.md`). Find feature by name → set `"stage": "testing"`, `data.updated` → now (Edit, keep `<script>` tags intact)
- Git baseline + session file:

```bash
mkdir -p .project/session
git status --porcelain | sort > .project/session/pre-skill-status.txt
echo '{"feature":"{feature-name}","skill":"test","startedAt":"{ISO timestamp}"}' > .project/session/active-{feature-name}.json
```

### PHASE 1: Parse Feedback

> **Todo**: mark PHASE 0 → `completed`, PHASE 1 → `in_progress`.

**Goal:** Extract PASS/FAIL status and notes from user feedback.

**Steps:**

1. **Detect feedback format:**
   - Numbered format: `1:PASS 2:FAIL note`
   - Free text: Parse natural language

2. **Parse numbered format:**

   ```python
   # Pattern: {number}:{PASS|FAIL} [optional notes]
   for match in feedback:
       item_number = match.number
       status = match.status  # PASS or FAIL
       notes = match.notes    # optional description
   ```

3. **Parse free text format:**
   - Identify positive words: "works", "good", "correct", "fine"
   - Identify negative words: "fails", "broken", "wrong", "missing"
   - Map descriptions to checklist items
   - Extract issue details

4. **Handle ambiguous input:**

   **If cannot parse:**

   Use AskUserQuestion tool:
   - header: "Feedback Unclear"
   - question: "I could not parse the feedback correctly. Can you provide it in this format?"
   - options:
     - label: "Re-enter (Recommended)", description: "Use format: 1:PASS 2:FAIL [notes]"
     - label: "Go through item by item", description: "I will ask per item whether it is PASS or FAIL"
     - label: "Explanation", description: "Explain the feedback formats"
   - multiSelect: false

5. **Build results array:**
   ```python
   results = [
       {"item": 1, "status": "PASS", "notes": None},
       {"item": 2, "status": "PASS", "notes": None},
       {"item": 3, "status": "FAIL", "notes": "puddle too small"},
       {"item": 4, "status": "FAIL", "notes": "no sound"},
   ]
   ```

**Output:**

```
FEEDBACK PARSED

| # | Status | Notes |
|---|--------|-------|
| 1 | PASS | - |
| 2 | PASS | - |
| 3 | FAIL | puddle too small |
| 4 | FAIL | no sound |

Passed: 2 items
Failed: 2 items

-> Categorizing issues...
```

---

### PHASE 1b: Debug Analysis

> **Todo**: mark PHASE 1 → `completed`, PHASE 1b → `in_progress`.

**Goal:** Combine debug output with user feedback for accurate issue identification.

**When to use:** This phase runs when user selected "There are issues" in step 7.

**Steps:**

1. **Capture debug output:**

   ```python
   debug_output = mcp__godot-mcp__get_debug_output()
   ```

2. **Parse debug log:**
   - Extract all `[DEBUG]` and `[PLAYTEST]` lines
   - Build timeline of events
   - Identify signal emissions and method calls

   ```
   DEBUG TIMELINE:

   00:01.234 [DEBUG] WaterAbility.execute() called - target: TestTarget
   00:01.235 [DEBUG] WaterAbility.execute() complete - damage: 20
   00:01.456 [PLAYTEST] debug_ability_used: {damage: 20, target: "TestTarget"}
   00:02.100 [DEBUG] Puddle.spawn() called - position: (100, 200)
   00:02.789 [PLAYTEST] debug_puddle_spawned: {position: (100, 200)}
   ...
   ```

3. **Show checklist and ask which items did not work:**

   ```
   Checklist items ({N} total):

   1. [Visuals] {item-1}
   2. [Controls] {item-2}
   3. [Audio] {item-3}
   ...
   ```

   Question: "Which items did not work? Give numbers (e.g. `1, 3, 5`) or `none` if everything worked."

   Parse → failure-set, continue to Step 4 for specifics per selected item.

4. **For each selected problem, ask specifics:**

   ```
   You selected: "Item 3: Puddle spawns on impact"

   What was the exact problem?
   - Puddle did not appear?
   - Wrong position?
   - Wrong size?
   - Something else?
   ```

   Wait for user description.

5. **Correlate with debug output:**

   ```
   ISSUE ANALYSIS: Item 3

   User feedback: "Puddle did not appear"

   Debug log analysis:
   ✓ debug_ability_used signal: FOUND at 00:01.456
   ✗ debug_puddle_spawned signal: NOT FOUND

   Expected sequence:
   1. ability.execute() -> ✓
   2. puddle.spawn() -> ✗ NOT CALLED

   Conclusion: spawn_puddle() method was never invoked
   Likely cause: Missing call in execute() after damage calculation
   ```

6. **Generate enriched feedback for PHASE 2:**

   Convert to structured feedback with debug context:

   ```python
   results = [
       {
           "item": 3,
           "status": "FAIL",
           "notes": "puddle not spawning",
           "debug_context": {
               "missing_signals": ["debug_puddle_spawned"],
               "last_signal": "debug_ability_used",
               "root_cause": "spawn_puddle() not called"
           }
       },
   ]
   ```

**Output:**

```
DEBUG ANALYSIS COMPLETE

Issues identified: {count}
Debug correlation: {matched}/{total} items have debug evidence

| # | Issue | Debug Evidence |
|---|-------|----------------|
| 3 | No puddle | debug_puddle_spawned missing |
| 4 | No sound | debug_sound_played missing |

Root causes identified: {count}

-> Proceeding to categorize issues with debug context...
```

-> Continue to PHASE 2 (Categorize Issues) with enriched feedback

---

### PHASE 2: Categorize Issues

> **Todo**: mark PHASE 1b → `completed`, PHASE 2 → `in_progress`.

**Goal:** Determine fix approach for each failed item.

**Steps:**

1. **For each FAIL item, analyze notes:**

   **Check for TESTABLE indicators:**
   - Concrete values mentioned (numbers, sizes, durations)
   - Comparison stated ("should be X not Y")
   - Measurable property with expected value

   Examples:
   - "radius 50, should be 100" -> TESTABLE
   - "damage 20, expected 30" -> TESTABLE
   - "speed 5.0, needs to be 10.0" -> TESTABLE

   **Check for MEASURABLE indicators:**
   - Relative terms without values ("too slow", "too fast")
   - Observable properties ("animation", "movement", "timing")
   - Can be adjusted but not unit-tested

   Examples:
   - "animation too slow" -> MEASURABLE
   - "projectile too fast" -> MEASURABLE
   - "knockback too weak" -> MEASURABLE

   **Default to SUBJECTIVE:**
   - Vague feedback ("doesn't feel right", "weird")
   - No specific property mentioned
   - Requires clarification

   Examples:
   - "feels off" -> SUBJECTIVE
   - "not right" -> SUBJECTIVE
   - "something wrong" -> SUBJECTIVE

2. **Handle SUBJECTIVE issues immediately:**

   For each SUBJECTIVE item, use AskUserQuestion tool:
   - header: "Clarification Item {N}"
   - question: "'{notes}' is not specific enough. What exactly is wrong?"
   - options: (context-dependent, examples below)
     - label: "Too fast/slow", description: "Timing or speed problem"
     - label: "Too strong/weak", description: "Damage, force, or effect problem"
     - label: "Wrong timing", description: "When something happens is incorrect"
     - label: "Visual problem", description: "How it looks is incorrect"
     - label: "Audio problem", description: "Sound is missing or incorrect"
     - label: "Other", description: "I will describe it specifically"
   - multiSelect: false

   After clarification:
   - Re-analyze with new details
   - Update category (TESTABLE or MEASURABLE)

3. **Build categorized issues list:**
   ```python
   issues = [
       {"item": 3, "type": "TESTABLE", "notes": "puddle radius 50, should be 100", "action": "TDD fix"},
       {"item": 4, "type": "MEASURABLE", "notes": "no sound on cast", "action": "Direct fix"},
   ]
   ```

**Output:**

```
FEEDBACK ANALYSIS

PASSED: 2 items (1, 2)
FAILED: 2 items (3, 4)

| # | Issue | Type | Action |
|---|-------|------|--------|
| 3 | puddle radius 50->100 | TESTABLE | TDD fix loop |
| 4 | no sound on cast | MEASURABLE | Direct fix |

-> Starting fix loop...
```

---

### PHASE 3: Fix Loop

> **Todo**: mark PHASE 2 → `completed`, PHASE 3 → `in_progress`.

**Goal:** Fix all issues using appropriate method for each type.

**Process for each issue (in order):**

#### For TESTABLE Issues: TDD Fix Loop

**Step 0: Assess Fix Complexity**

Before fixing, determine if research is needed:

| Complexity | Example                         | Research? |
| ---------- | ------------------------------- | --------- |
| Simple     | Change a number value           | No        |
| Medium     | Add new property/method         | No        |
| Complex    | Refactor signal flow, add state | Yes       |

**Complexity indicators:**

```
SIMPLE (no research):
- "puddle radius 50 -> 100"       -> Just change the value
- "damage too low"                -> Just increase the value
- "missing sound"                 -> Just add AudioStreamPlayer
- "animation speed wrong"         -> Just adjust the speed

COMPLEX (offer research):
- "ability doesn't chain correctly"    -> Signal flow issue
- "state machine not transitioning"    -> State logic issue
- "cooldown resets unexpectedly"       -> Timer/state interaction
- "collision not detecting properly"   -> Physics layer issue
- "node references breaking"           -> Scene tree / lifecycle issue
```

**If complex fix detected:**

Use AskUserQuestion tool:

- header: "Research"
- question: "This is a complex fix ({brief issue description}). Do you want to research Godot patterns?"
- options:
  - label: "Yes, research (Recommended)", description: "Research best approach"
  - label: "No, fix directly", description: "Fix without research"
- multiSelect: false

**If research requested:**

```
Task(subagent_type="godot-code-researcher", prompt="
Feature: {feature-name}
Fix needed: {description of issue}

Current code:
{relevant code snippet}

Problem: {what's wrong}
Goal: {what should happen}

Research GDScript patterns for this fix.
")
```

Use research findings to inform the fix implementation below.

**Step 1-5: TDD Fix** (potentially informed by research)

1. **Generate test based on feedback:**

   ```
   GENERATING TEST for item {N}

   Issue: {description}
   Expected: {concrete value from feedback}
   ```

2. **Write test file:**

   ```gdscript
   # tests/test_{feature}_{item}.gd
   extends GutTest

   func test_{specific_behavior}() -> void:
       # Arrange
       var {object} = {setup}

       # Act
       var result = {action}

       # Assert
       assert_eq(result, {expected_value}, "{description}")
   ```

3. **Run test (expect FAIL):**

   ```bash
   "{godot_executable}" --headless --path . -s addons/gut/gut_cmdln.gd -gexit -gtest=res://tests/test_{feature}_{item}.gd
   ```

   **If test PASSES (unexpected):**

   ```
   UNEXPECTED: Test already passes

   The test passes with current code.
   Possible causes:
   - Issue was already fixed
   - Test doesn't capture the real problem
   - Feedback was based on old version
   ```

   Use AskUserQuestion tool:
   - header: "Test Passed"
   - question: "The test already passes. What do you want to do?"
   - options:
     - label: "Skip (Recommended)", description: "Item appears already fixed, move to next"
     - label: "Adjust test", description: "The test is incorrect, I will provide new values"
     - label: "Check manually", description: "Stop and check this manually"
   - multiSelect: false

   **If test FAILS (expected):**

   ```
   TEST FAILS (expected)

   Test: test_{specific_behavior}
   Expected: {expected_value}
   Actual: {actual_value}

   -> Implementing fix...
   ```

4. **Implement fix:**
   - Locate relevant code
   - Make minimal change to satisfy test
   - Document what was changed

5. **Run test again (expect PASS):**

   ```
   TEST PASSES

   Item {N} fixed via TDD.
   Change: {description of fix}
   File: {file:line}
   ```

6. **If test still fails after fix:**
   - Analyze why
   - Try alternative approach
   - Max 3 attempts before asking user

#### For MEASURABLE Issues: Direct Fix

1. **Identify code location:**

   ```
   DIRECT FIX for item {N}

   Issue: {description}
   Location: {file:line}
   Current value: {current}
   ```

2. **Apply fix directly:**
   - Adjust value/property
   - No test possible (subjective/feel)
   - Document the change

3. **Result:**

   ```
   FIXED (cannot auto-verify)

   Change: {what was changed}
   From: {old value}
   To: {new value}
   File: {file:line}

   Needs manual re-test.
   ```

**After all issues processed:**

```
FIX LOOP COMPLETE

| # | Type | Status | Change |
|---|------|--------|--------|
| 3 | TESTABLE | FIXED (test passes) | Puddle radius 50->100 |
| 4 | MEASURABLE | FIXED (needs re-test) | Added cast sound |

New tests added: 1
Files modified: 2

-> Generating re-test checklist...
```

---

### PHASE 4: Generate Re-test Checklist

> **Todo**: mark PHASE 3 → `completed`, PHASE 4 → `in_progress`.

**Goal:** Create minimal checklist for only the fixed items.

**Steps:**

1. **Filter to fixed items only:**
   - Skip items that passed in original feedback
   - Include only items that were fixed

2. **Generate re-test checklist:**

   ```
   RE-TEST REQUIRED

   The following items were fixed and need verification:

   | # | Test | Change Made |
   |---|------|-------------|
   | 3 | Puddle size | Now 100px (was 50px) |
   | 4 | Sound on cast | Added AudioStreamPlayer |

   Play the game and verify these specific items.

   Feedback format:
   3:PASS
   4:PASS

   Or if still failing:
   3:FAIL still too small
   4:PASS
   ```

3. **Wait for re-test feedback**

**Output:**

```
AWAITING RE-TEST

Fixed items: {count}
Provide feedback when ready.
```

---

### PHASE 5: Re-test Loop

> **Todo**: mark PHASE 4 → `completed`, PHASE 5 → `in_progress`.

**Goal:** Process re-test feedback and loop until all pass.

**Steps:**

1. **Parse re-test feedback:**
   - Same parsing as PHASE 1
   - Only expect results for fixed items

2. **Evaluate results:**

   **If all re-tests PASS:**
   -> Continue to PHASE 6 (Completion)

   **If any re-tests FAIL:**

   ```
   RE-TEST RESULTS

   | # | Status | Notes |
   |---|--------|-------|
   | 3 | FAIL | still too small |
   | 4 | PASS | - |

   1 item still failing.
   ```

3. **Handle persistent failures:**

   Use AskUserQuestion tool:
   - header: "Item {N} Still Failing"
   - question: "Item {N} still does not work after the fix. What do you want to do?"
   - options:
     - label: "Provide more details (Recommended)", description: "I will give more specific feedback"
     - label: "Different approach", description: "Try a different fix strategy"
     - label: "Accept as-is", description: "Mark as acceptable for now"
     - label: "Fix manually", description: "Stop and fix it yourself"
   - multiSelect: false

4. **Loop back to PHASE 2:**
   - Re-categorize new feedback
   - Apply new fixes
   - Generate new re-test checklist
   - Continue until all pass or user exits

---

### PHASE 5c: Regression Check

> **Todo**: mark PHASE 5 → `completed`, PHASE 5c → `in_progress`.

**Skip when:**

- No TDD fixes applied in PHASE 3 (only MEASURABLE fixes → low chance of side effects)
- No existing test files to run

**Goal:** Verify that fixes have not broken previously-passing tests.

Re-run `gut_cmdln.gd` for ALL existing test files (not just the fixed ones). Compare output with the PHASE 0.6b baseline.

```
REGRESSION CHECK: {feature-name}

GUT test suite re-run...

Baseline: {n} pass / {n} fail
Now:      {n} pass / {n} fail

New failures:
- test_{x}.gd::test_{method}: {assertion error}

Regressions: {n} | Stable: {n}
```

**No regressions:** Continue to PHASE 6.

**Regressions:** Show and offer choice via AskUserQuestion: Fix (Recommended) | Accept. If fixing → back to PHASE 3 for the regression items only. Do NOT repeat PHASE 5c after a regression fix (max 1 pass).

---

### PHASE 5d: Requirement Verification

> **Todo**: mark PHASE 5c → `completed`, PHASE 5d → `in_progress`.

**Skip when:** All tests FAIL (coverage check is pointless with catastrophic failures).

Cross-check `feature.json` requirements against test results:

1. **Load requirement → test mapping:**
   - Per `requirements[]` entry (id, description, status) — **skip entries with `deltaOp === "REMOVED"`**
   - Find matching `tests.checklist[]` entries via `requirementId`

2. **Build coverage matrix:**

   ```
   REQUIREMENT COVERAGE: {feature-name}

   | REQ       | Description (short)        | Tests | Status        |
   |-----------|----------------------------|-------|---------------|
   | REQ-001   | {first 40 chars}           | 2     | ✓ COVERED     |
   | REQ-002   | {first 40 chars}           | 0     | ✗ NO TEST     |
   | REQ-003   | {first 40 chars}           | 1     | ⊘ BLOCKED     |
   | REQ-004   | {first 40 chars}           | 0     | ? UNCLEAR     |

   Coverage: {covered}/{total} requirements ({percentage}%)
   Non-testable: BLOCKED={n} UNCLEAR={n} (needs reopening)
   ```

3. **Classify per requirement:**
   - **COVERED**: at least 1 test with matching `requirementId` AND status `PASS`
   - **FAIL**: at least 1 test matching but status `FAIL`
   - **BLOCKED**: test does not exist or fails due to external dependency (missing asset, addon not loaded, export preset missing)
   - **UNCLEAR**: no test possible because acceptance criteria is too vague (e.g. "feels juicy", "is fun") — non-deterministic
   - **NO TEST**: no test in `checklist[]` with matching `requirementId` (no legitimate reason)

4. **All requirements COVERED:** show compact summary, continue to PHASE 6.

5. **On NO TEST, FAIL, BLOCKED or UNCLEAR requirements:**

   Per uncovered requirement, AskUserQuestion:

   ```yaml
   header: "REQ not covered: {REQ-ID}"
   question: "{requirement description} — no test found. What do you want to do?"
   options:
     - label: "Add test (Recommended)", description: "Write a test for this requirement"
     - label: "Covered by other test", description: "Implicitly tested via another test"
     - label: "Blocked by dependency", description: "Missing asset/addon/preset — not testable now"
     - label: "Criteria too vague", description: "Acceptance criteria lacks concreteness — reopen /game-define"
   multiSelect: false
   ```

   - **Add test** → add test item to `tests.checklist[]` with `requirementId`, `status: "pending"`. Loop back to PHASE 1 for GUT test or PHASE 2 (MANUAL) for this item only.
   - **Covered by other test** → ask which test covers it. Mark requirement with `implicitCoverage: "{REQ-ID} test also validates this via {description}"`. Status → `"PASS"`.
   - **Blocked by dependency** → ask which dependency. Status → `"BLOCKED"`, add to `requirements[].evidence = "blocked by: {reason}"`. Not merge-blocking; signal to reopen after dependency fix.
   - **Criteria too vague** → ask what is vague. Status → `"UNCLEAR"`, add to `requirements[].evidence = "needs clarification: {what's vague}"`. Signal for `/game-define` reopen to formulate concrete acceptance.

---

### PHASE 6: Completion

> **Todo**: mark PHASE 5d → `completed`, PHASE 6 → `in_progress`.

**Goal:** Sync user on fixes, capture observations, mark feature as verified and update documentation.

#### Step 0: Fix Sync (only when fixes were applied in PHASE 3)

**Skip this step if all items passed on first attempt (no fixes needed).**

The Fix Sync ensures the user understands what changed in the codebase during the test-fix cycle.

**0a) Claude summarizes** — per fix, in plain language:

```
FIX SYNC: {feature-name}
=========================

{For each fix applied:}

Fix {N}: {item title}
- Problem: {what was wrong, in plain language}
- Change: {what was modified} ({file:line})
- Approach: {why this fix, not an alternative — only if non-obvious}
- Watch out: {anything the user should know — only if relevant}

{Example:}

Fix 1: Puddle too small
- Problem: Puddle radius was 50px, user expected 100px
- Change: Doubled PUDDLE_RADIUS constant (scripts/abilities/water_ability.gd:12)

Fix 2: No sound on cast
- Problem: AudioStreamPlayer was missing from the ability scene
- Change: Added AudioStreamPlayer2D with cast_sound.ogg (scenes/abilities/water_ability.tscn)
- Watch out: Sound uses AudioBus "SFX" — make sure this bus exists in project audio settings
```

**0b) Comprehension check** via AskUserQuestion:

- header: "Fix Sync"
- question: "Do you understand the fixes that were applied?"
- options:
  - label: "Yes, clear (Recommended)", description: "I understand what changed and why"
  - label: "Explain more", description: "Give a more detailed explanation with examples"
  - label: "I have a question", description: "I want to ask about something specific"
- multiSelect: false

**If "Explain more"** → explain each fix in more detail with before/after examples, then re-ask.
**If "I have a question"** → answer the question, then re-ask.
**Loop until "Yes, clear".**

**0c) Save fix sync** — store the summary for inclusion in feature.json `tests.sessions[]`.

---

#### Step 0b: Out-of-scope Observations (always — even without fixes)

The user was actively playtesting and may have noticed issues outside the current feature scope. Capture these before closing out.

Use AskUserQuestion tool:

- header: "Observations"
- question: "Did you notice anything else during playtesting that is outside the scope of this feature?"
- options:
  - label: "No, all good (Recommended)", description: "No further remarks"
  - label: "Yes, I noticed something", description: "I want to note something for later"
- multiSelect: false

**If "Yes"** → ask the user to describe what they noticed (plain text, no modal). Record the observations for inclusion in feature.json `observations[]`. Do NOT attempt to fix these — they are out of scope.

After documenting, show confirmation:

```
OBSERVATION NOTED

Recorded in test results.
```

---

**Steps:**

1. **Confirm all items pass:**

   ```
   {FEATURE-NAME} COMPLETE!

   All {N} playtest items passed.

   | # | Test | Status |
   |---|------|--------|
   | 1 | {description} | PASS |
   | 2 | {description} | PASS |
   | 3 | {description} | PASS |
   | 4 | {description} | PASS |

   Feature ready for integration.
   ```

2. **Parallel sync** (feature.json + backlog + project.json + project-context.json):

   Read in parallel (skip if not exists):
   - `.project/features/{feature-name}/feature.json`
   - `.project/backlog.html`
   - `.project/project.json`
   - `.project/project-context.json`

   Mutate in memory:

   **feature.json**: `status` → `"DONE"`, `requirements[].status` → `"PASS"` / `"FAIL"` / `"BLOCKED"` / `"UNCLEAR"` per item (BLOCKED/UNCLEAR include `evidence` string), `tests.checklist[].status` → update per item with evidence. Add/update `tests` section: `finalStatus` (`"PASSED"` all PASS / `"FAILED"` ≥1 FAIL / `"PARTIAL"` ≥1 BLOCKED or UNCLEAR, 0 FAIL), `sessions[]` (push `{ date, pass, fail, fixes }`), `fixSync`, `verificationCheckpoint` (gaps, mismatches, adjustments). Add `observations[]` if user reported out-of-scope issues. Do NOT overwrite other sections.

   **Backlog** (see `shared/BACKLOG.md → Lifecycle Protocol → Write`): set `.status = "DONE"`, remove `transition`, `data.updated` → current date.

   **project.json**: Feature status → `"DONE"`. Merge new packages if relevant.

   **project-context.json**: On fixes in PHASE 3: update `architecture.components[]` — merge modified files to component `src`/`test`, confirm `status: "done"`.

   **Learning Extraction** — extract project-wide learnings from the completed feature:

   Read the just-written `feature.json` and evaluate (mandatory source tag per source):
   - `build.decisions[]` → type `pattern`, source `extracted` (architectural choices that affect other features)
   - `tests.fixSync[]` and `tests.sessions[].fixes` → type `pitfall`, source `extracted` (bugs with root causes)
   - `observations[]` → type `observation`, source `inferred` (cross-feature insights)

   **Filter**: only items relevant outside this single feature. Skip feature-specific implementation details.

   **Append** to `project-context.json` → `learnings[]`:

   ```json
   {
     "date": "YYYY-MM-DD",
     "feature": "{feature-name}",
     "type": "pattern|pitfall|observation",
     "source": "extracted|inferred",
     "summary": "Max 200 char summary"
   }
   ```

   **Dedup** for each candidate learning:
   1. Exact shortcut: same feature + same summary → skip (no Jaccard needed)
   2. Tokenize candidate.summary via `shared/LEARNING-EXTRACTION.md` Dedup Tokenizer
   3. For each existing learning in `learnings[]` with the same `type`:
      - `Jaccard(candidate.tokens, existing.tokens) >= 0.55` → skip candidate
   4. Survives both checks → append

   No learnings found → skip.

   Write in parallel:
   - Write `feature.json`
   - Edit `backlog.html` (keep `<script>` tags intact)
   - Write `project.json`
   - Write `project-context.json` (if context/architecture/learnings changed)

3. **Scoped auto-commit** (only this skill's changes):

   Compare current git status with baseline from PHASE 0:

   ```bash
   git status --porcelain | sort > /tmp/current-status.txt
   ```

   Categorize files by comparing with `.project/session/pre-skill-status.txt`:
   - **NEW** (only in current, not in baseline) → `git add` automatically
   - **OVERLAP** (in both baseline AND current) → warn user via AskUserQuestion: "These files had pre-existing uncommitted changes and were also modified by this skill: {list}. Include in commit?" Options: "Include (Recommended)" / "Skip"
   - **PRE-EXISTING** (only in baseline) → do NOT stage

   If baseline file doesn't exist, fall back to `git add -A`.

   ```bash
   git commit -m "$(cat <<'EOF'
   test({feature}): verified - all {N} items pass

   Playtest verification complete.
   - Fixed: {list of fixes}
   - Tests added: {count}
   EOF
   )"
   ```

   Clean up: `rm -f .project/session/pre-skill-status.txt .project/session/active-{feature-name}.json /tmp/current-status.txt`

**Output:**

```
VERIFICATION COMPLETE

Feature: {feature-name}
Status: DONE
Items: {N}/{N} passing

Committed: test({feature}): verified

Next steps:
  1. /game-refactor → code quality check + learning extraction
  2. /game-define {next-feature} → pick up next feature
```

---

## Output Structure

```
.project/features/{feature-name}/
└── feature.json    # Enriched with tests section (finalStatus, sessions, checklist updates, observations)
```

## Example Session

```
User: /game-verify water-ability

Claude: PLAYTEST CHECKLIST: water-ability

        | # | Test | Expected |
        |---|------|----------|
        | 1 | Water damage visible | Enemy shows damage effect |
        | 2 | Heal effect on player | Health increases, visual feedback |
        | 3 | Puddle on ground | Circular puddle appears at impact |
        | 4 | Sound on cast | Whoosh sound plays |

        Play the game and report results.
        Format: 1:PASS/FAIL [notes]

User: 1:PASS
      2:PASS
      3:FAIL too small
      4:FAIL no sound

Claude: FEEDBACK ANALYSIS

        PASSED: 2 items (1, 2)
        FAILED: 2 items (3, 4)

        | # | Issue | Type | Action |
        |---|-------|------|--------|
        | 3 | "too small" | SUBJECTIVE | Need details |
        | 4 | "no sound" | MEASURABLE | Direct fix |

        [AskUserQuestion: "Clarification Item 3"
         question: "'too small' is not specific enough. What do you mean?"
         options: "2x bigger", "3x bigger", "Specific radius (px)", "Other"]

User: 2x bigger

Claude: Now testable! Starting TDD fix loop...

        GENERATING TEST for item 3
        Issue: Puddle size should be 2x current

        [Creates test_water_ability_puddle_size.gd]
        [Runs test -> FAILS as expected]
        [Implements fix: radius * 2]
        [Runs test -> PASSES]

        DIRECT FIX for item 4
        Issue: No sound on cast
        [Adds AudioStreamPlayer to scene]

        FIX LOOP COMPLETE

        | # | Type | Status |
        |---|------|--------|
        | 3 | TESTABLE | FIXED (test passes) |
        | 4 | MEASURABLE | FIXED (needs re-test) |

        RE-TEST REQUIRED

        | # | Test | Change Made |
        |---|------|-------------|
        | 3 | Puddle size | Now 2x original |
        | 4 | Sound on cast | Added AudioStreamPlayer |

User: 3:PASS
      4:PASS

Claude: WATER-ABILITY COMPLETE!

        All 4 playtest items passed.

        Feature ready for integration.
        Committed: test(water-ability): verified
```

## Best Practices

### Language

Follow the Language Policy in `skills/shared/LANGUAGE.md`. AskUserQuestion labels in user's preferred language.

### TDD for Testable Issues

- Always write test FIRST
- Run test to confirm it fails
- Make minimal fix to pass test
- Tests prevent regression

### Direct Fixes for Measurable Issues

- Some things can't be unit tested (feel, timing, subjective)
- Make the change, document it
- Rely on human re-test

### Clarification for Subjective Issues

- Never guess what user means
- Ask specific options based on context
- Convert to TESTABLE or MEASURABLE before fixing

### Minimal Re-test

- Only ask user to re-test fixed items
- Don't re-test items that already passed
- Respect user's time

## Restrictions

This skill must NEVER:

- Skip TDD for testable issues (concrete values given)
- Guess what subjective feedback means
- Apply fixes without documenting changes
- Mark complete if any items still failing
- Re-test items that already passed
- Skip clarification questions for vague feedback

This skill must ALWAYS:

- Show playtest checklist before asking for feedback
- Parse all feedback formats (numbered, free text)
- Categorize each failure (TESTABLE/MEASURABLE/SUBJECTIVE)
- Use TDD loop for testable issues
- Ask clarifying questions for subjective issues
- Generate re-test checklist with only fixed items
- Loop until all items pass
- Update documentation on completion

## Path Resolution

`{godot_executable}` in commands is resolved via `paths.yaml`:

- macOS: `/Applications/Godot.app/Contents/MacOS/Godot`
- Windows: `C:\Godot\Godot_v4.4.1-stable_win64.exe`

Override: env var `CLAUDE_GODOT_EXECUTABLE` or `.claude/paths.local.yaml`. Canonical defaults are in [skills/project-add/paths.yaml](skills/project-add/paths.yaml).

> **Todo**: mark PHASE 6 → `completed`.

---

### PHASE Finalize

> **Todo**: mark PHASE 6 → `completed`, PHASE Finalize → `in_progress`.

**Run only if BOTH true:**

1. All test items PASS (no open fix-loop items)
2. Current branch matches `worktree-*` pattern (`git branch --show-current`)

**PR offer (team-mode only)** — show first, only if ALL true:

1. `TEAM_MODE === "team"` — read via `shared/PROJECT-MODE.md` read pattern (absent → skip)
2. `gh` on PATH AND `gh auth status` exit 0
3. Clean tree (`git status --porcelain` empty)

If all true → AskUserQuestion:

```yaml
header: "PR openen"
question: "Push + PR openen voor worktree-{feature-name}?"
options:
  - label: "Ja, push + PR (Recommended)"
    description: "Push the branch and open a PR via gh. Worktree stays until merged."
  - label: "Nee, skip PR"
    description: "Skip the PR; show finalize prompt instead."
multiSelect: false
```

On "Ja" → follow `{skills_path}/shared/PR.md`. Print PR URL. Suppress finalize prompt below.
On "Nee" or any precondition fail → fall through to finalize prompt.

**Finalize prompt** — follow `shared/FINALIZE.md → Finalize Offer Decision`. AskUserQuestion-modals voor MERGED en empty/CLOSED state (solo mode, of MERGED ongeacht mode):

```yaml
# For MERGED state:
header: "PR merged — cleanup"
question: "PR #{PR_NUMBER} is gemerged ({PR_URL}). Cleanup nu? Worktree + lokale branch worden verwijderd."
options:
  - label: "Yes, cleanup nu (Recommended)"
    description: "Follow shared/FINALIZE.md cleanup-only — verwijder worktree + branch"
  - label: "Keep open"
    description: "Worktree blijft staan voor follow-up commits"
multiSelect: false
```

```yaml
# For solo / empty/CLOSED state:
header: "Finalize"
question: "Feature '{feature-name}' afgerond (status: DONE). Finalize nu (merge naar main + cleanup)?"
options:
  - label: "Yes, finalize nu (Recommended)"
    description: "Follow shared/FINALIZE.md solo-mode — merge worktree naar main + cleanup"
  - label: "Keep open"
    description: "Worktree blijft open, finalize later via /game-refactor"
multiSelect: false
```

On MERGED "Yes" → follow `shared/FINALIZE.md` with `mode: cleanup-only`.
On empty/CLOSED "Yes" → follow `shared/FINALIZE.md` with `mode: solo`.
On any "Keep open" → print `💡 Run /game-refactor {feature-name} on this worktree when ready`.

> **Todo**: mark PHASE Finalize → `completed`.
