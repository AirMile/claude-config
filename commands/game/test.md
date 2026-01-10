---
description: Human playtest verification with structured feedback and fix loop
---

# Test

## Overview

This is FASE 3 of the 3-step gamedev workflow: define -> build -> test

The test phase handles human verification of implemented game features through structured playtest feedback, intelligent issue categorization, and iterative fix loops until all items pass.

**Trigger**: `/game:test` or `/game:test {feature-name}` or `/game:test {feature-name} {feedback}`

## When to Use

This skill activates in these scenarios:

**Primary use:**
- After `/game:build` completes implementation
- When `.workspace/features/{name}/03-playtest.md` exists
- When human verification is needed for game mechanics

**Context indicators:**
- Feature has been implemented with build phase
- Playtest checklist exists in 03-playtest.md
- User wants to verify gameplay feels correct

**NOT for:**
- Initial feature planning (use /game:define)
- Implementation (use /game:build)
- Automated unit testing (use /dev:verify)

## Input Formats

### Format 1: Inline feedback (recommended)
```
/game:test water-ability
1:PASS
2:PASS
3:FAIL puddle too small
4:FAIL no sound
```

### Format 2: Feature name only (shows checklist first)
```
/game:test water-ability
```

### Format 3: Free text feedback
```
/game:test water-ability
Everything works except puddle is too small and there's no sound
```

## Feedback Categorization

| Type | Example | Action |
|------|---------|--------|
| **TESTABLE** | "puddle radius=50, should be 100" | TDD fix loop |
| **MEASURABLE** | "animation too slow" | Direct fix + re-test |
| **SUBJECTIVE** | "doesn't feel right" | Ask for details |

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

### FASE 0: Load Context

**Goal:** Load playtest checklist from build phase and prepare for feedback.

**Steps:**

1. **Parse user input:**
   - If feature name only -> show checklist, wait for feedback
   - If feature name + feedback -> parse feedback immediately
   - If "recent" -> find most recently modified 03-playtest.md

2. **Locate playtest checklist:**
   ```
   .workspace/features/{feature-name}/03-playtest.md
   ```

3. **Validate file exists:**

   **If file not found:**
   ```
   NOT FOUND: 03-playtest.md

   Feature: {feature-name}
   Searched: .workspace/features/{feature-name}/

   This feature needs to be built first.
   Run /game:build {feature-name} to implement and generate playtest checklist.
   ```
   -> Exit skill

4. **Read playtest checklist:**
   - Parse test items with numbers
   - Note expected behavior for each item
   - Count total items

5. **Verify playtest scene exists:**

   Scene path: `.workspace/features/{feature-name}/playtest_scene.tscn`

   **If scene exists:**
   ```
   PLAYTEST SCENE FOUND
   Path: .workspace/features/{feature-name}/playtest_scene.tscn
   Debug listener: Active
   ```

   **If scene NOT found:**
   ```
   ERROR: Playtest scene not found

   Expected: .workspace/features/{feature-name}/playtest_scene.tscn

   The /game:build phase should have created this scene.
   Run /game:build {feature-name} first, or check if build completed successfully.
   ```
   -> Exit skill

6. **Launch game with test scenario:**

   ```python
   mcp__godot-mcp__run_project(
       projectPath=".",
       scene=".workspace/features/{feature-name}/playtest_scene.tscn"
   )
   ```

   **Display test scenario from 03-playtest.md:**
   ```
   GAME LAUNCHED - {feature-name}
   ==============================

   TEST SCENARIO:

   Stap 1: {first action from checklist}
   Stap 2: {second action}
   Stap 3: {third action}
   ...

   VERWACHT GEDRAG:
   - {expected result 1}
   - {expected result 2}
   - {expected result 3}

   Debug tracking is actief - je acties worden gelogd.

   Voer deze acties uit in de game.
   Sluit de game als je klaar bent.
   ```

   **Note:** Game runs in background. DebugListener captures all debug_* signals.

7. **Wait for user completion:**

   When user closes game or indicates ready, use AskUserQuestion tool:
   - header: "Test Resultaat"
   - question: "Hoe ging de test?"
   - options:
     - label: "Alles werkt (Aanbevolen)", description: "Alle stappen werken zoals verwacht"
     - label: "Er zijn problemen", description: "Sommige dingen werken niet goed"
     - label: "Game crashte", description: "De game stopte onverwacht"
   - multiSelect: false

   **Response handling:**

   **If "Alles werkt":**
   -> Skip to FASE 6 (Completion), mark all items PASS

   **If "Er zijn problemen":**
   -> Proceed to FASE 1b (Debug Analysis + User Details)

   **If "Game crashte":**
   ```python
   crash_output = mcp__godot-mcp__get_debug_output()
   ```
   -> Analyze crash, show error, offer to fix via TDD loop

8. **Display checklist (if no feedback provided):**
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

### FASE 1: Parse Feedback

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
   - header: "Feedback Onduidelijk"
   - question: "Ik kon de feedback niet goed parsen. Kun je het in dit formaat geven?"
   - options:
     - label: "Opnieuw invoeren (Aanbevolen)", description: "Gebruik formaat: 1:PASS 2:FAIL [notes]"
     - label: "Per item doorgaan", description: "Ik vraag per item of het PASS of FAIL is"
     - label: "Uitleg", description: "Leg de feedback formaten uit"
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

### FASE 1b: Debug Analysis

**Goal:** Combine debug output with user feedback for accurate issue identification.

**When to use:** This fase runs when user selected "Er zijn problemen" in step 7.

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

3. **Ask user for problem details:**

   Use AskUserQuestion tool:
   - header: "Probleem Details"
   - question: "Welke items werkten niet? (selecteer alles dat van toepassing is)"
   - options: (dynamically generated from checklist items)
     - label: "Item 1: {description}", description: "Dit werkte niet"
     - label: "Item 2: {description}", description: "Dit werkte niet"
     - label: "Item 3: {description}", description: "Dit werkte niet"
     - label: "Anders", description: "Ik beschrijf het probleem zelf"
   - multiSelect: true

4. **For each selected problem, ask specifics:**

   ```
   Je selecteerde: "Item 3: Puddle spawnt op impact"

   Wat was het probleem precies?
   - Puddle verscheen niet?
   - Verkeerde positie?
   - Verkeerde grootte?
   - Anders?
   ```

   Wait for user description.

5. **Correlate with debug output:**

   ```
   ISSUE ANALYSIS: Item 3

   User feedback: "Puddle verscheen niet"

   Debug log analysis:
   ✓ debug_ability_used signal: FOUND at 00:01.456
   ✗ debug_puddle_spawned signal: NOT FOUND

   Expected sequence:
   1. ability.execute() -> ✓
   2. puddle.spawn() -> ✗ NOT CALLED

   Conclusion: spawn_puddle() method was never invoked
   Likely cause: Missing call in execute() after damage calculation
   ```

6. **Generate enriched feedback for FASE 2:**

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

-> Continue to FASE 2 (Categorize Issues) with enriched feedback

---

### FASE 2: Categorize Issues

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
   - header: "Verduidelijking Item {N}"
   - question: "'{notes}' is niet specifiek genoeg. Wat is er precies mis?"
   - options: (context-dependent, examples below)
     - label: "Te snel/langzaam", description: "Timing of snelheid probleem"
     - label: "Te sterk/zwak", description: "Damage, kracht, of effect probleem"
     - label: "Verkeerde timing", description: "Wanneer iets gebeurt klopt niet"
     - label: "Visueel probleem", description: "Hoe het eruit ziet klopt niet"
     - label: "Audio probleem", description: "Geluid mist of klopt niet"
     - label: "Anders", description: "Ik beschrijf het specifiek"
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

### FASE 3: Fix Loop

**Goal:** Fix all issues using appropriate method for each type.

**Process for each issue (in order):**

#### For TESTABLE Issues: TDD Fix Loop

**Step 0: Assess Fix Complexity**

Before fixing, determine if research is needed:

| Complexity | Example | Research? |
|------------|---------|-----------|
| Simple | Change a number value | No |
| Medium | Add new property/method | No |
| Complex | Refactor signal flow, add state | Yes |

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
- question: "Dit is een complexe fix ({brief issue description}). Wil je Godot patterns researchen?"
- options:
  - label: "Ja, research (Aanbevolen)", description: "Research beste aanpak"
  - label: "Nee, direct fixen", description: "Fix zonder research"
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
   "/c/Godot/Godot_v4.4.1-stable_win64.exe" --headless --path . -s addons/gut/gut_cmdln.gd -gexit -gtest=res://tests/test_{feature}_{item}.gd
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
   - question: "De test slaagt al. Wat wil je doen?"
   - options:
     - label: "Overslaan (Aanbevolen)", description: "Item lijkt al gefixt, ga naar volgende"
     - label: "Test aanpassen", description: "De test klopt niet, ik geef nieuwe waarden"
     - label: "Handmatig checken", description: "Stop en check dit handmatig"
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

3. **Report fix:**
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

**Send notification:**
```bash
powershell -ExecutionPolicy Bypass -File .claude/scripts/notify.ps1 -Title "Claude Code" -Message "Fixes ready for re-test"
```

---

### FASE 4: Generate Re-test Checklist

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

### FASE 5: Re-test Loop

**Goal:** Process re-test feedback and loop until all pass.

**Steps:**

1. **Parse re-test feedback:**
   - Same parsing as FASE 1
   - Only expect results for fixed items

2. **Evaluate results:**

   **If all re-tests PASS:**
   -> Continue to FASE 6 (Completion)

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
   - header: "Item {N} Faalt Nog"
   - question: "Item {N} werkt nog niet na fix. Wat wil je doen?"
   - options:
     - label: "Meer details geven (Aanbevolen)", description: "Ik geef specifiekere feedback"
     - label: "Andere aanpak", description: "Probeer een andere fix strategie"
     - label: "Accepteren zoals het is", description: "Markeer als acceptabel voor nu"
     - label: "Handmatig fixen", description: "Stop en fix het zelf"
   - multiSelect: false

4. **Loop back to FASE 2:**
   - Re-categorize new feedback
   - Apply new fixes
   - Generate new re-test checklist
   - Continue until all pass or user exits

---

### FASE 6: Completion

**Goal:** Mark feature as verified and update documentation.

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

2. **Update 01-define.md:**
   - Add `Status: VERIFIED` to frontmatter or summary
   - Record verification date

3. **Create/Update 03-test-results.md:**
   ```markdown
   # Test Results: {feature-name}

   ## Summary
   | Metric | Value |
   |--------|-------|
   | Status | VERIFIED |
   | Items | {N} |
   | Passed | {N} |
   | Date | {timestamp} |

   ## Playtest History

   ### Session 1: {date}
   | # | Initial | Final | Fixes Applied |
   |---|---------|-------|---------------|
   | 1 | PASS | PASS | - |
   | 2 | PASS | PASS | - |
   | 3 | FAIL | PASS | Puddle radius 50->100 |
   | 4 | FAIL | PASS | Added cast sound |

   ## Tests Added
   - `tests/test_{feature}_puddle_radius.gd`

   ## Files Modified
   - `scripts/abilities/water_ability.gd` (line 45: radius)
   - `scenes/abilities/water_ability.tscn` (added AudioStreamPlayer)
   ```

4. **Sync backlog:**

   **Backlog uses list-based format (not tables).**

   - Read `.workspace/backlog.md`
   - Find feature in MVP/Phase 2/Phase 3/Ad-hoc sections
   - Move feature from `### BLT` to `### DONE` subsection
   - Update section header counts: `({done}/{total} done)`
   - Update "Updated" timestamp
   - Update "Next" suggestion to next TODO or DEF feature

   **Example:**
   ```markdown
   ### BLT
   - **element-water** (CONTENT) → ability-system
   ```
   Moves to:
   ```markdown
   ### DONE
   - **element-water** (CONTENT) - Water abilities (projectile, shield)
   ```
   Note: In DONE section, dependency arrow `→` changes to description `-`

   **Output:**
   ```
   BACKLOG SYNCED

   Feature: {feature-name}
   Status: BLT → DONE
   Progress: MVP {done}/{total} done
   ```

5. **Auto-commit changes:**
   ```bash
   git add .
   git commit -m "$(cat <<'EOF'
   test({feature}): verified - all {N} items pass

   Playtest verification complete.
   - Fixed: {list of fixes}
   - Tests added: {count}
   EOF
   )"
   ```

   **IMPORTANT:** Do NOT add Co-Authored-By or Generated with Claude Code footer to pipeline commits.

**Output:**
```
VERIFICATION COMPLETE

Feature: {feature-name}
Status: DONE
Items: {N}/{N} passing

Committed: test({feature}): verified

Next steps:
- Continue with next feature: /game:define {next-feature}
- Or refine this feature: /4-refine {feature-name}
```

**Send notification:**
```bash
powershell -ExecutionPolicy Bypass -File .claude/scripts/notify.ps1 -Title "Claude Code" -Message "{feature} verified"
```

---

## Output Structure

```
.workspace/features/{feature-name}/
├── 01-define.md          # Updated: Status: VERIFIED
├── 02-build-log.md       # Implementation log from build phase
├── 03-playtest.md        # Playtest checklist from build phase
└── 03-test-results.md    # NEW: Playtest history and results
```

## Example Session

```
User: /game:test water-ability

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

        [AskUserQuestion: "Verduidelijking Item 3"
         question: "'too small' is niet specifiek genoeg. Wat bedoel je?"
         options: "2x groter", "3x groter", "Specifieke radius (px)", "Anders"]

User: 2x groter

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
Follow the Language Policy in CLAUDE.md. AskUserQuestion labels in user's preferred language.

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

### Notifications
- Notify when fixes are ready for re-test
- Notify when verification is complete
- User may be playing the game, not watching terminal

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
- Send notifications at key points
