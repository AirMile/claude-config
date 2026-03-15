---
name: game-test
description: Human playtest verification with structured feedback and fix loop. Use with /game-test after /game-build for manual testing of game features.
disable-model-invocation: true
metadata:
  author: mileszeilstra
  version: 2.1.0
  category: game
---

# Test

## Overview

This is **FASE 3** of the gamedev workflow: plan -> define -> build -> **test** -> refactor

The test phase handles human verification of implemented game features through structured playtest feedback, intelligent issue categorization, and iterative fix loops until all items pass.

**Trigger**: `/game-test` or `/game-test {feature-name}` or `/game-test {feature-name} {feedback}`

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
/game-test water-ability
1:PASS
2:PASS
3:FAIL puddle too small
4:FAIL no sound
```

### Format 2: Feature name only (shows checklist first)

```
/game-test water-ability
```

### Format 3: Free text feedback

```
/game-test water-ability
Everything works except puddle is too small and there's no sound
```

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

### FASE 0: Load Context

**Goal:** Load playtest checklist from build phase and prepare for feedback.

**Steps:**

1. **Check backlog for BLT features (if no feature name provided):**

   ```
   Read(".project/backlog.html")
   ```

   - If backlog exists: parse JSON uit `<script id="backlog-data">` blok (zie `shared/BACKLOG.md`)
   - Filter built features: `data.features.filter(f => f.status === "DOING" && f.stage === "built")`

   Use **AskUserQuestion** if built features found:
   - header: "Feature"
   - question: "Welke feature wil je testen? ({N} features in built stage)"
   - options:
     - label: "{feature-name} (Recommended)", description: "Volgende uit backlog"
     - label: "Andere feature", description: "Ik wil een andere feature testen"
   - multiSelect: false

2. **Parse user input:**
   - If feature name only -> show checklist, wait for feedback
   - If feature name + feedback -> parse feedback immediately
   - If "recent" -> find most recently modified feature.json with `tests.checklist`

3. **Locate playtest checklist:**

   ```
   .project/features/{feature-name}/feature.json → tests.checklist[]
   ```

4. **Validate feature.json exists with tests.checklist:**

   **If not found:**

   ```
   NOT FOUND: feature.json with tests.checklist

   Feature: {feature-name}
   Searched: .project/features/{feature-name}/

   This feature needs to be built first.
   Run /game-build {feature-name} to implement and generate playtest checklist.
   ```

   -> Exit skill

5. **Read playtest checklist + classify items:**
   - Parse `tests.checklist[]` from feature.json
   - Note expected behavior for each item (from `title` field)
   - Count total items
   - **Classify each item:**
     - **COVERED**: GUT unit tests from `/game-build` already verify this requirement. Check `tests/test_{feature}.gd` for matching test functions. COVERED items zijn al geverifieerd — skip in playtest.
     - **MANUAL**: Requires human verification (gameplay feel, visuals, audio, game launch). Alles dat niet COVERED is.
   - Display classificatie:

   ```
   CHECKLIST CLASSIFICATIE:

   COVERED ({N} items — skip, al geverifieerd door GUT tests):
   - Item {X}: {description} → test_{function}()

   MANUAL ({M} items — playtest nodig):
   - Item {Y}: {description}
   ```

   Als alle items COVERED → skip playtest, ga naar FASE 6 completion.

6. **Verify playtest scene exists:**

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

6b. **Post-Build Baseline Check** (als `build` sectie bestaat in feature.json)

Twee checks vóór playtest:

**Check 1: Full GUT Regression Suite**

Run de volledige GUT test suite om te verifiëren dat alle features nog werken:

```bash
"/c/Godot/Godot_v4.4.1-stable_win64.exe" --headless --path . -s addons/gut/gut_cmdln.gd -gexit
```

Parse output (zelfde regels als game-build: PASS 1 regel, FAIL max 10 regels).

```
BASELINE: full suite → {passed}/{total} PASS
```

Bij failures:

- Onderscheid failures van de HUIDIGE feature vs ANDERE features
- Huidige feature fails → waarschuw, ga door met playtest (dit is wat we gaan testen)
- Andere feature fails → waarschuw:

  ```
  ⚠ REGRESSIE: {N} tests van andere features falen
  - test_{other}.test_xxx: {reason}
  ```

  Use AskUserQuestion:
  - "Doorgaan met playtest (Recommended)" — "Regressies worden gerapporteerd maar blokkeren de test niet"
  - "Stop — eerst regressies fixen" — "Fix de andere features voordat je deze test"

Als GUT niet beschikbaar of geen test bestanden → skip met: `BASELINE: overgeslagen (geen GUT tests gevonden)`

**Check 2: Integration Test Scene**

Herrun de integration test scene als aanvullende check:

```bash
"/c/Godot/Godot_v4.4.1-stable_win64.exe" --headless --path . -s res://tests/scenes/test_{feature}_runtime.tscn
```

Parse output voor `FINAL:PASS` of `FINAL:FAIL`.

Display: `BASELINE: integration tests → {PASS|FAIL}`
Bij FAIL: waarschuw ("Integration tests falen — mogelijke regressie sinds build"), toon gefaalde tests, ga door met playtest.

Als integration test scene niet bestaat → skip, geen output.

6c. **Cross-Requirement Gameplay Scenario's** (als `build` sectie bestaat en 2+ requirements)

Analyseer `requirements[]` uit feature.json. Identificeer combinaties waar gameplay-interacties meerdere requirements raken.

Genereer maximaal 3 gameplay scenario's:

```
GAMEPLAY SCENARIO'S: {feature}

| # | Scenario                                      | Requirements     |
|---|-----------------------------------------------|------------------|
| G1| Gebruik ability → observeer effect → check cooldown | REQ-001 + REQ-003 |
| G2| Ability op meerdere vijanden → effects stapelen?    | REQ-001 + REQ-002 |
| G3| Ability tijdens beweging → positie correct?         | REQ-001 + REQ-004 |
```

Voeg deze toe aan de checklist als extra items met `"integration": true, "type": "MANUAL"`.
Ze worden meegenomen in de playtest instructies.

Als er geen logische cross-requirement combinaties zijn → skip, geen output.

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

   **Note:** Game runs in background. DebugListener captures all debug\_\* signals.

8. **Wait for user completion:**

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

- Backlog: lees `.project/backlog.html` (als bestaat), parse JSON (zie `shared/BACKLOG.md`). Zoek feature op naam → zet `"stage": "testing"`, `data.updated` → nu (Edit, keep `<script>` tags intact)
- Git baseline + session file:

```bash
mkdir -p .project/session
git status --porcelain | sort > .project/session/pre-skill-status.txt
echo '{"feature":"{feature-name}","skill":"test","startedAt":"{ISO timestamp}"}' > .project/session/active-{feature-name}.json
```

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

### FASE 5c: Regression Check

**Skip when:**

- Geen TDD fixes toegepast in FASE 3 (alleen MEASURABLE fixes → lage kans op side effects)
- Geen bestaande test files om te draaien

**Doel:** Verifieer dat fixes geen eerder-werkende tests hebben gebroken.

Draai `gut_cmdln.gd` opnieuw voor ALLE bestaande test files (niet alleen de gefixte). Vergelijk output met de FASE 0.6b baseline.

```
REGRESSION CHECK: {feature-name}

GUT test suite opnieuw gedraaid...

Baseline: {n} pass / {n} fail
Nu:       {n} pass / {n} fail

Nieuwe failures:
- test_{x}.gd::test_{method}: {assertion error}

Regressies: {n} | Stabiel: {n}
```

**Geen regressies:** Door naar FASE 6.

**Regressies:** Toon en bied keuze via AskUserQuestion: Fixen (Aanbevolen) | Accepteren. Bij fixen → terug naar FASE 3 voor alleen de regressie-items. Herhaal FASE 5c NIET na regressie-fix (max 1 pass).

---

### FASE 6: Completion

**Goal:** Sync user on fixes, capture observations, mark feature as verified and update documentation.

#### Step 0: Fix Sync (only when fixes were applied in FASE 3)

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
- question: "Snap je de fixes die zijn toegepast?"
- options:
  - label: "Ja, helder (Aanbevolen)", description: "Ik begrijp wat er is veranderd en waarom"
  - label: "Leg meer uit", description: "Geef een uitgebreidere uitleg met voorbeelden"
  - label: "Ik heb een vraag", description: "Ik wil iets specifieks vragen"
- multiSelect: false

**If "Leg meer uit"** → explain each fix in more detail with before/after examples, then re-ask.
**If "Ik heb een vraag"** → answer the question, then re-ask.
**Loop until "Ja, helder".**

**0c) Save fix sync** — store the summary for inclusion in feature.json `tests.sessions[]`.

---

#### Step 0b: Out-of-scope Observations (always — even without fixes)

The user was actively playtesting and may have noticed issues outside the current feature scope. Capture these before closing out.

Use AskUserQuestion tool:

- header: "Observaties"
- question: "Is je tijdens het playtesten nog iets anders opgevallen buiten de scope van deze feature?"
- options:
  - label: "Nee, alles goed (Aanbevolen)", description: "Geen verdere opmerkingen"
  - label: "Ja, ik heb iets opgemerkt", description: "Ik wil iets noteren voor later"
- multiSelect: false

**If "Ja"** → ask the user to describe what they noticed (plain text, no modal). Record the observations for inclusion in feature.json `observations[]`. Do NOT attempt to fix these — they are out of scope.

After documenting, show confirmation:

```
OBSERVATIE GENOTEERD

Opgenomen in test results.
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

   Lees parallel (skip als niet bestaat):
   - `.project/features/{feature-name}/feature.json`
   - `.project/backlog.html`
   - `.project/project.json`
   - `.project/project-context.json`

   Muteer in memory:

   **feature.json**: `status` → `"DONE"`, `requirements[].status` → `"PASS"` / `"FAIL"` per item, `tests.checklist[].status` → update per item with evidence. Add/update `tests` sectie: `finalStatus`, `sessions[]` (push `{ date, pass, fail, fixes }`), `fixSync`. Add `observations[]` if user reported out-of-scope issues. NIET andere secties overschrijven.

   **Backlog** (zie `shared/BACKLOG.md`): zet `.status = "DONE"`, `data.updated` → huidige datum.

   **project.json**: Feature status → `"DONE"`. Merge nieuwe packages als relevant.

   **project-context.json**: Bij fixes in FASE 3: merge gewijzigde bestanden naar `architecture.files`, update diagram nodes naar `:::done`.

   **Learning Extraction** — extracteer projectbrede learnings uit de voltooide feature:

   Lees de zojuist geschreven `feature.json` en evalueer:
   - `build.decisions[]` → type `pattern` (architecturale keuzes die andere features beïnvloeden)
   - `tests.fixSync[]` en `tests.sessions[].fixes` → type `pitfall` (bugs met root causes)
   - `observations[]` → type `observation` (cross-feature inzichten)

   **Filter**: alleen items die relevant zijn buiten deze ene feature. Skip feature-specifieke implementatiedetails.

   **Append** naar `project-context.json` → `learnings[]`:

   ```json
   {
     "date": "YYYY-MM-DD",
     "feature": "{feature-name}",
     "type": "pattern|pitfall|observation",
     "summary": "Max 200 chars samenvatting"
   }
   ```

   Check op duplicaten (zelfde feature + zelfde summary → skip). Geen learnings gevonden → skip.

   Schrijf parallel terug:
   - Write `feature.json`
   - Edit `backlog.html` (keep `<script>` tags intact)
   - Write `project.json`
   - Write `project-context.json` (als context/architecture/learnings gewijzigd)

3. **Scoped auto-commit** (only this skill's changes):

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
   git commit -m "$(cat <<'EOF'
   test({feature}): verified - all {N} items pass

   Playtest verification complete.
   - Fixed: {list of fixes}
   - Tests added: {count}
   EOF
   )"
   ```

   Clean up: `rm -f .project/session/pre-skill-status.txt .project/session/active-{feature-name}.json /tmp/current-status.txt`

   **IMPORTANT:** Do NOT add Co-Authored-By or Generated with Claude Code footer to pipeline commits.

**Output:**

```
VERIFICATION COMPLETE

Feature: {feature-name}
Status: DONE
Items: {N}/{N} passing

Committed: test({feature}): verified
```

---

## Output Structure

```
.project/features/{feature-name}/
└── feature.json    # Enriched with tests section (finalStatus, sessions, checklist updates, observations)
```

## Example Session

```
User: /game-test water-ability

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
