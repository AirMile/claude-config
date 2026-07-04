---
name: game-verify
description: Human playtest verification with structured feedback. Use with /game-verify.
reads: [feature.requirements, feature.build, backlog.stage]
writes: [feature.tests, backlog.stage, project-context.learnings]
metadata:
  author: claude-config
  version: 2.4.0
  category: game
---

# Verify

## Overview

This is **PHASE 3** of the gamedev workflow: plan -> define -> build -> **verify** -> refactor

The verify phase handles human playtest verification of implemented game features through structured feedback, intelligent issue categorization, and iterative fix loops until all items pass.

**Trigger**: `/game-verify` or `/game-verify {feature-name}` or `/game-verify {feature-name} {feedback}`

> **Copied & pre-adapted for game-ship.** When run by game-ship PHASE 2 (AGENT 2), this tree executes
> as a **non-interactive subagent** under `references/non-interactive-contract.md` — that adapter
> **blanket-overrides** the machinery below: no `TaskCreate`/`TaskUpdate`, no `AskUserQuestion`, no
> terminal handoff, and critically **no game-window launch** (the PHASE 0 step 7 launch + playtest are
> skipped — run only the COVERED GUT items headless and RETURN the MANUAL items; the main chat runs the
> playtest). Leave status DOING / stage "built"; **never merge**. Do not blind-sync.

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
- Automated unit testing (use /dev-ship (verify phase))

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

> Code quality rules: `../shared/CODING-RULES.md` (R009, TST001–TST203). TST-rules apply to GDScript/GUT test code (mock boundaries only, behavior > implementation, pin seeds, no retry-flag as flake fix).

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

**Phase tracking** — first action of the skill: call `TaskCreate` with the 4 mandatory phases (status `pending`):

1. PHASE 0: Load Context
2. PHASE 1: Parse Feedback
3. PHASE 5d: Requirement Verification
4. PHASE 6: Completion

**Worktree check** — after resolving `feature-name` in PHASE 0 step 1, detect whether a worktree exists for this feature:

```bash
git worktree list --porcelain | grep -q "branch refs/heads/worktree-{feature-name}$"
```

Match → add PHASE Finalize at end via `TaskCreate`. (PHASE Finalize itself decides whether to act based on playtest outcome — always add it when a worktree exists, regardless of which checkout currently runs the skill.)

Add fix-loop phases via `TaskCreate` ONLY when they will fire:

- FAILs in PHASE 1 feedback → add PHASE 1b (Debug Analysis), PHASE 2 (Categorize Issues), PHASE 3 (Fix Loop), PHASE 4 (Generate Re-test Checklist), PHASE 5 (Re-test Loop) before PHASE 5d
- Any PHASE 3 fixes applied → add PHASE 5c (Regression Check) before PHASE 5d

Use `TaskUpdate` to set each phase `in_progress` at the start and `completed` at the end. When context compacts, the task list stays visible — no risk of forgotten phases.

### PHASE 0: Load Context

> **Todo**: call `ToolSearch query="select:TaskCreate,TaskUpdate"` first — both tools are deferred and unusable without their schemas. Then call `TaskCreate` with the 4 mandatory phases (see Workflow above). Mark PHASE 0 → `in_progress` via `TaskUpdate`.

**Goal:** Load playtest checklist from build phase and prepare for feedback.

**Steps:**

1. **Check backlog for built features (if no feature name provided):**

   Backlog load (via [shared/GAME-BACKLOG-LOAD.md](../shared/GAME-BACKLOG-LOAD.md)):

   ```
   profile: queue
   status: DOING
   transition: verifying
   ```

   Run the `queue` snippet. Auto-select the first entry with `transition === "verifying"` (no modal needed). Fallback: re-run without transition filter (`$TRANSITION = ""`) to list all DOING features, then filter client-side on `stage === "built"`.

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

   Feature load (via [shared/GAME-FEATURE-LOAD.md](../shared/GAME-FEATURE-LOAD.md)):

   ```
   profile: verify
   feature-name: {feature-name}
   ```

   Run the `verify` snippet. Parse `checklist[]`, `requirements[]` (with `tuningLevers[]`), `design`, and `build` from the output.

5. **Validate feature.json exists with tests.checklist:**

   `FEATURE_JSON: not present` or `checklist` empty:

   ```
   NOT FOUND: feature.json with tests.checklist

   Feature: {feature-name}
   Searched: .project/features/{feature-name}/

   This feature needs to be built first.
   Run /game-build {feature-name} to implement and generate playtest checklist.
   ```

   → Exit skill

6. **Read playtest checklist + classify items:**

   > **Todo**: Read '.claude/skills/game-ship/references/game-verify/references/checklist-classification.md' and execute steps a-d: classify items (COVERED/MANUAL), CATEGORY-GAP check, acceptance mapping, gap resolution.

   Outcome: classified checklist + acceptance-mapping table. All items COVERED → skip playtest, go to PHASE 6 completion.

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

6b. **Post-Build Baseline Check** — only if `build` section exists in feature.json.

> **Todo**: if `feature.json` has a `build` section → read `.claude/skills/game-ship/references/game-verify/references/phase-0b-baseline-check.md` and run both baseline checks before continuing.

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

   **Board signal — waiting for playtest.** The user is now playing; flag the feature amber on
   the backlog board (see `shared/DEVINFO.md § Active Feature Signal`):

   ```bash
   mkdir -p .project/session
   echo '{"feature":"{feature-name}","skill":"test","startedAt":"{ISO timestamp}","waiting":"playtest"}' > .project/session/active-{feature-name}.json
   ```

   (The end-of-PHASE-0 baseline write below rewrites this file **without** `waiting` once
   feedback is in — no separate clear step needed.)

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

- Backlog: read `.project/backlog.json` (if it exists), parse JSON (see `shared/BACKLOG.md`). Find feature by name → set `"stage": "testing"`, `data.updated` → now (Edit)
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

> **Todo**: mark PHASE 1 → `completed`, PHASE 1b → `in_progress`. Read `.claude/skills/game-ship/references/game-verify/references/debug-analysis.md` for debug output capture, issue correlation, and enriched feedback generation.

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

> **Todo**: mark PHASE 2 → `completed`, PHASE 3 → `in_progress`. Skip if all items PASS. Otherwise read `.claude/skills/game-ship/references/game-verify/references/phase-3-fix-loop.md` for the full TESTABLE and MEASURABLE fix instructions.

---

### PHASE 4: Generate Re-test Checklist

> **Todo**: mark PHASE 3 → `completed`, PHASE 4 → `in_progress`. Read `.claude/skills/game-ship/references/game-verify/references/retest-loop.md` for re-test checklist generation and re-test loop steps.

---

### PHASE 5: Re-test Loop

> **Todo**: mark PHASE 4 → `completed`, PHASE 5 → `in_progress`. (Re-test loop — see `references/retest-loop.md` loaded above.)

---

### PHASE 5c: Regression Check

> **Todo**: mark PHASE 5 → `completed`, PHASE 5c → `in_progress`. Read `.claude/skills/game-ship/references/game-verify/references/regression-requirements.md` for GUT regression check and requirement coverage matrix.

---

### PHASE 5d: Requirement Verification

> **Todo**: mark PHASE 5c → `completed`, PHASE 5d → `in_progress`. (Requirement verification — see `references/regression-requirements.md` loaded above.)

**Test-quality verdict (simplified, GUT context).** Unlike dev-ship's verify phase (Stryker + mutation score), GUT has no mutation runner; the verdict is therefore based on PASS ratio + feedback FAILs. Write `feature.json#tests.qualityVerdict`:

| Verdict | Condition                                                                                                                     |
| ------- | ----------------------------------------------------------------------------------------------------------------------------- |
| STRONG  | `tests.finalStatus === "PASSED"` AND `tests.checklist[].status` all PASS AND no `observations[]` with `category: "test-gap"`. |
| WEAK    | Anything else (FAIL/BLOCKED/PARTIAL, or a test-gap observation, or <100% PASS ratio).                                         |

Schema: `{ verdict: "STRONG"|"WEAK", ranAt: ISO-8601, passRatio: number, testGapCount: number }`. Render at the top of the PHASE 5d output: `TEST-QUALITY VERDICT: {verdict} (passRatio: X, testGaps: N)`. Not blocking — informative signal alongside the PASS count.

---

### PHASE 6: Completion

> **Todo**: mark PHASE 5d → `completed`, PHASE 6 → `in_progress`. Read `.claude/skills/game-ship/references/game-verify/references/completion-finalize.md` for fix sync, parallel sync, learning extraction, commit, and PHASE Finalize.

## References

Read these Just-In-Time during specific phases — do not load upfront.

| File                                     | When to load                                                                     |
| ---------------------------------------- | -------------------------------------------------------------------------------- |
| `references/checklist-classification.md` | PHASE 0 step 6 — classification, CATEGORY-GAP check, acceptance mapping          |
| `references/phase-0b-baseline-check.md`  | PHASE 0 step 6b — only if feature.json has a `build` section                     |
| `references/debug-analysis.md`           | PHASE 1b — debug output capture and issue correlation                            |
| `references/phase-3-fix-loop.md`         | PHASE 3 — TESTABLE TDD fix loop and MEASURABLE direct fix (only when FAIL items) |
| `references/retest-loop.md`              | PHASE 4 + 5 — re-test checklist generation and re-test loop                      |
| `references/regression-requirements.md`  | PHASE 5c + 5d — GUT regression check and requirement coverage matrix             |
| `references/completion-finalize.md`      | PHASE 6 — fix sync, parallel sync, learning extraction, commit, finalize         |
