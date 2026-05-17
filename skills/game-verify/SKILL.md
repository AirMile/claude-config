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

3b. **Symlink integrity gate** — follow `shared/WORKTREE.md → Symlink Integrity Gate (post-switch auto-repair)`.

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

> **Todo**: mark PHASE 1 → `completed`, PHASE 1b → `in_progress`. Read `.claude/skills/game-verify/references/debug-analysis.md` for debug output capture, issue correlation, and enriched feedback generation.

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

> **Todo**: mark PHASE 3 → `completed`, PHASE 4 → `in_progress`. Read `.claude/skills/game-verify/references/retest-loop.md` for re-test checklist generation and re-test loop steps.

---

### PHASE 5: Re-test Loop

> **Todo**: mark PHASE 4 → `completed`, PHASE 5 → `in_progress`. (Re-test loop — see `references/retest-loop.md` loaded above.)

---

### PHASE 5c: Regression Check

> **Todo**: mark PHASE 5 → `completed`, PHASE 5c → `in_progress`. Read `.claude/skills/game-verify/references/regression-requirements.md` for GUT regression check and requirement coverage matrix.

---

### PHASE 5d: Requirement Verification

> **Todo**: mark PHASE 5c → `completed`, PHASE 5d → `in_progress`. (Requirement verification — see `references/regression-requirements.md` loaded above.)

---

### PHASE 6: Completion

> **Todo**: mark PHASE 5d → `completed`, PHASE 6 → `in_progress`. Read `.claude/skills/game-verify/references/completion-finalize.md` for fix sync, parallel sync, learning extraction, commit, and PHASE Finalize.
