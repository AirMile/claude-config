---
name: dev-test
description: Hybrid testing verification combining automated browser and CLI tests with manual walkthrough, structured feedback, and fix loop. Use with /dev-test after /dev-build.
disable-model-invocation: true
metadata:
  author: mileszeilstra
  version: 1.0.0
  category: dev
---

# Test

## Overview

This is the test phase of the dev workflow: define -> build -> **test**

Handles hybrid verification of implemented features through automated testing and manual walkthrough, issue categorization, and iterative fix loops until all items pass.

**Execution model:** Automated tests run in a **separate Task agent** (isolated context window) to prevent snapshot/screenshot data from flooding the main conversation. The agent uses MCP browser tools for DOM verification and bash commands for running existing test suites. Only structured results (pass/fail + evidence summary) are returned to the main conversation.

**Trigger**: `/dev:test` or `/dev:test {feature-name}` or `/dev:test {feature-name} {feedback}`

## When to Use

- After `/dev:build` completes
- When `.workspace/features/{name}/03-test-checklist.md` exists
- NOT for: planning (/dev:define), implementation (/dev:build)

## Input Formats

```
# Format 1: Inline feedback (recommended — skips automation entirely)
/dev:test user-registration
1:PASS
2:FAIL no validation error
3:PASS
4:FAIL no mail sent

# Format 2: Feature name only (hybrid: auto + manual walkthrough)
/dev:test user-registration

# Format 3: Free text (skips automation entirely)
/dev:test user-registration
Everything works except validation is missing and no welcome mail
```

## Feedback Categorization

| Type           | Example                               | Action                                  |
| -------------- | ------------------------------------- | --------------------------------------- |
| **TESTABLE**   | "returns 500 instead of 422"          | Technique selection (TDD or Impl First) |
| **MEASURABLE** | "response too slow", "font too small" | Direct fix                              |
| **SUBJECTIVE** | "doesn't feel right"                  | Ask for specifics, then re-categorize   |


> **Test classification criteria and automation patterns:**
> See `references/test-classification.md` for AUTO/BROWSER, AUTO/CLI, and MANUAL criteria with pattern tables.

## Workflow

### FASE 0: Load Context and Classify

1. **Parse user input:**
   - Feature name only → proceed to classification and hybrid testing
   - Feature name + inline feedback → skip to FASE 1b (backward compatible, no automation)
   - Feature name + free text → skip to FASE 1b (backward compatible, no automation)
   - "recent" → find most recently modified 03-test-checklist.md

2. **Locate and validate test checklist:**

   ```
   .workspace/features/{feature-name}/03-test-checklist.md
   ```

   If not found → exit with message to run `/dev:build {feature-name}` first.

3. **Read checklist** and parse test items with expected behavior.

4. **Generate Test Data** (via Explore agent — zero source file reads in main context)

   **Always** use a Task agent (Explore) to gather test data. Never read source files directly in the main conversation.

   Launch Explore agent with prompt:

   ```
   Feature: {feature-name}
   Checklist: .workspace/features/{feature-name}/03-test-checklist.md
   Define: .workspace/features/{feature-name}/01-define.md

   Lees de checklist en define doc. Zoek vervolgens in de source code naar:
   - Form fields, validatie regels, API endpoints relevant voor de test items
   - Bestaande test files die hergebruikt kunnen worden
   - De dev server URL (uit CLAUDE.md, package.json scripts, of .env)

   Geef terug als gestructureerd overzicht:
   FEATURE_CONTEXT_START
   Dev server URL: {url}
   Bestaande tests: {pad naar test files, of "geen"}
   Per test item:
   - Item {N}: {title}
     Testdata: {concrete waarden}
     Verwacht: {expected outcome}
     Aanbevolen methode: BROWSER | CLI
     Reden: {waarom deze methode}
   FEATURE_CONTEXT_END
   ```

   Parse the agent's structured output. This gives you test data, classification hints, and dev server URL without consuming any main context on source file reads.

5. **Classify each test item**

   For each checklist item, apply the classification criteria above and assign **AUTO** or **MANUAL**.

   Display the classification:

   ```
   TEST CLASSIFICATIE: {feature-name}

   | # | Test                    | Type       | Reden                                    |
   |---|-------------------------|------------|------------------------------------------|
   | 1 | Register with valid data| AUTO | DOM: redirect + welkomstmelding zichtbaar |
   | 2 | Without email           | AUTO | DOM: foutmelding zichtbaar               |
   | 3 | Welcome mail sent       | MANUAL     | Email verificatie niet via DOM            |
   | 4 | Layout on mobile        | AUTO | Responsive: resize + screenshot          |
   | 5 | Feels intuitive         | MANUAL     | Subjectief UX oordeel                    |

   AUTO: {n}  MANUAL: {n}
   ```

6. **User override**

   Use AskUserQuestion tool:
   - header: "Test Classificatie"
   - question: "Wil je de classificatie aanpassen? Je kunt AUTO items naar MANUAL verplaatsen."
   - options:
     - label: "Classificatie akkoord (Aanbevolen)", description: "Start hybrid testing met deze indeling"
     - label: "Items aanpassen", description: "Ik wil items van AUTO naar MANUAL verplaatsen"
     - label: "Alles handmatig", description: "Sla automatische tests over, test alles handmatig"
   - multiSelect: false

   **If "Items aanpassen"** → ask which items to move to MANUAL, update classification.
   **If "Alles handmatig"** → set all items to MANUAL, skip FASE 1 entirely.

7. **Dev server check** (lightweight — no snapshots in main context)

   If any items are classified as AUTO:

   Run a quick bash check (NOT browser_snapshot — that wastes context):

   ```bash
   curl -s -o /dev/null -w "%{http_code}" {url}
   ```

   **If HTTP 200** → dev server running, proceed to FASE 1.
   **If non-200 or connection refused:**

   ```
   ⚠ Dev server niet bereikbaar op {url} (HTTP {code}).
   Alle items worden MANUAL — start handmatige walkthrough.
   ```

   Graceful fallback: reclassify ALL items as MANUAL, skip FASE 1, proceed to FASE 2.

---

### FASE 1: Automated Testing (Task Agent)

**When:** There are AUTO items after classification and dev server is confirmed running.

**Launch a Task agent** to execute all AUTO items in a separate context window. This prevents snapshot/screenshot data from consuming the main conversation context.

**Task agent prompt template:**

```
Test de volgende items automatisch via browser tools en bash commands.
Dev server: {url}
Feature: {feature-name}

ITEMS:
{for each AUTO item:}
- Item {N}: {title}
  Stappen: {test steps}
  Testdata: {test data}
  Verwacht: {expected outcome}
  Methode: {BROWSER of CLI}
  Patroon: {matching test pattern from reference table}

INSTRUCTIES:
1. Navigeer naar de dev server URL en verifieer dat deze draait
2. Voor elk item:
   a. Voer de stappen uit met browser tools (browser_navigate, browser_snapshot,
      browser_click, browser_fill_form, browser_type, browser_press_key,
      browser_resize, browser_take_screenshot, browser_wait_for, browser_evaluate)
   b. OF run bestaande tests via bash als die er zijn (npm test, npx vitest, npx playwright test)
   c. Analyseer het resultaat (snapshot/screenshot/test output)
   d. Bepaal PASS of FAIL met bewijs en redenering
3. Als een browser tool faalt voor een item, markeer als TOOL_ERROR
4. Geef gestructureerde resultaten terug

RESULTAAT FORMAT (strict):
AUTOMATED_RESULTS_START
| # | Test | Resultaat | Bewijs | Redenering |
|---|------|-----------|--------|------------|
| {N} | {title} | PASS/FAIL/TOOL_ERROR | {wat gezien} | {waarom pass/fail} |
AUTOMATED_RESULTS_END

FALLBACK_ITEMS: {items met TOOL_ERROR, komma-gescheiden nummers, of "geen"}
```

**Parse agent results:**

The Task agent's output will likely be **truncated** because its full conversation log (snapshots, screenshots, tool calls) is very large. This is expected. To extract the structured results:

1. If TaskOutput contains `AUTOMATED_RESULTS_START` → parse directly from the output
2. If TaskOutput is truncated (no `AUTOMATED_RESULTS_START` visible):
   - The output includes a file path (e.g. `C:\...\tasks\{id}.output`)
   - Use **Grep** to find the line containing `AUTOMATED_RESULTS_START` in that file
   - Use **Read** with the line offset to read from `AUTOMATED_RESULTS_START` to `AUTOMATED_RESULTS_END`
3. Extract ONLY the structured block between the markers — ignore the rest of the agent log
4. Any items with `TOOL_ERROR` → reclassify as MANUAL for FASE 2
5. Display automated results in main conversation:

```
AUTO TEST RESULTATEN: {feature-name}

| # | Test              | Resultaat | Bewijs (kort)              |
|---|-------------------|-----------|----------------------------|
| 1 | Valid registration| ✓ PASS    | /dashboard + welkomstmelding |
| 2 | Without email     | ✗ FAIL    | Geen foutmelding zichtbaar |
| 4 | Mobile layout     | ✓ PASS    | Layout correct bij 375px   |

AUTO PASS: {n}  AUTO FAIL: {n}  TOOL_ERROR → MANUAL: {n}
```

**If agent fails entirely (timeout, crash, MCP unavailable):**

```
⚠ Automatische tests niet gelukt — alle items worden MANUAL.
```

Graceful fallback: reclassify all AUTO items as MANUAL, proceed to FASE 2.

---

### FASE 1b: Parse Inline Feedback

**When:** User provided inline feedback via `/dev:test {name} {feedback}` or free text (skipping FASE 1 AND FASE 2 entirely — backward compatible).

Parse user feedback into structured results (item number, PASS/FAIL, notes).
Accept both numbered format (`1:PASS 2:FAIL note`) and free text.

After parsing, show summary table and proceed directly to FASE 3 (categorize issues).

**Note:** When inline feedback is provided, automation is skipped entirely. All items are treated as MANUAL with user-provided results.

**If feedback is ambiguous:**

Use AskUserQuestion tool:

- header: "Feedback Onduidelijk"
- question: "Ik kon de feedback niet goed parsen. Kun je het in dit formaat geven?"
- options:
  - label: "Opnieuw invoeren (Aanbevolen)", description: "Gebruik formaat: 1:PASS 2:FAIL [notes]"
  - label: "Per item doorgaan", description: "Ik vraag per item of het PASS of FAIL is"
  - label: "Uitleg", description: "Leg de feedback formaten uit"
- multiSelect: false

---

### FASE 2: Manual Walkthrough

**When:** There are MANUAL items to test (either originally classified or reclassified from fallback).

Show setup instructions once (stack-appropriate from CLAUDE.md), then loop through each MANUAL item individually:

```
TEST SETUP: {feature-name}
{stack-appropriate setup, e.g. "Open http://localhost:3000"}
```

**For each MANUAL item (1 to N):**

```
──────────────────────────────────────
HANDMATIG TEST {n}/{total_manual}: {item title}
──────────────────────────────────────

STAPPEN:
1. {concrete action, e.g. "Ga naar /register"}
2. {concrete action with data, e.g. "Vul in: Email → test@voorbeeld.nl"}
3. {concrete action, e.g. "Klik op 'Registreren'"}

TESTDATA:
┌─────────────┬──────────────────────┐
│ Veld        │ Waarde               │
├─────────────┼──────────────────────┤
│ Naam        │ Test User            │
│ Email       │ test@voorbeeld.nl    │
│ Wachtwoord  │ Test1234!            │
└─────────────┴──────────────────────┘

VERWACHT:
→ {exact expected outcome, e.g. "Redirect naar /dashboard, welkomstmelding zichtbaar"}
```

Use AskUserQuestion tool per item:

- header: "Test {n}/{total_manual}"
- question: "Resultaat van '{item title}'?"
- options:
  - label: "Pass (Recommended)", description: "Werkt zoals verwacht"
  - label: "Fail", description: "Werkt niet — ik geef details"
  - label: "Skip", description: "Kan niet testen, sla over"
- multiSelect: false

**If Pass** → record PASS, continue to next item
**If Fail** → ask for brief details (what happened instead?), record FAIL + notes, continue to next item
**If Skip** → record SKIP with reason, continue to next item

---

### FASE 2b: Combined Results

Merge automated results (from FASE 1) and manual results (from FASE 2) into one combined summary:

```
GECOMBINEERDE RESULTATEN: {feature-name}

| # | Test                  | Type   | Resultaat              |
|---|-----------------------|--------|------------------------|
| 1 | Valid registration    | AUTO   | ✓ PASS                |
| 2 | Without email         | AUTO   | ✗ FAIL: geen error    |
| 3 | Welcome mail          | MANUAL | ✗ FAIL: geen mail     |
| 4 | Mobile layout         | AUTO   | ✓ PASS                |
| 5 | Feels intuitive       | MANUAL | ✓ PASS                |

AUTO PASS: {n}  AUTO FAIL: {n}
MANUAL PASS: {n}  MANUAL FAIL: {n}  SKIP: {n}
TOTAAL PASS: {n}  TOTAAL FAIL: {n}
```

**User verification of auto-failed items:**

If any AUTO items failed automatically, offer the user the option to manually verify:

Use AskUserQuestion tool:

- header: "Auto-gefaalde Items"
- question: "Er zijn {n} automatisch gefaalde items. Wil je deze handmatig controleren?"
- options:
  - label: "Vertrouw auto resultaten (Aanbevolen)", description: "Ga door met fixen van gefaalde items"
  - label: "Handmatig controleren", description: "Ik wil de auto-gefaalde items zelf checken"
- multiSelect: false

**If "Handmatig controleren"** → run manual walkthrough for those items, update results accordingly.

**If all PASS** → skip to FASE 6
**If any FAIL** → proceed to FASE 3 (categorize issues)

---

### FASE 3: Categorize Issues

For each FAIL item, categorize using the Feedback Categorization table above. Include the test_type tag (AUTO/MANUAL) per issue.

**For SUBJECTIVE issues**, ask for clarification immediately:

Use AskUserQuestion tool:

- header: "Verduidelijking Item {N}"
- question: "'{notes}' is niet specifiek genoeg. Wat is er precies mis?"
- options: (context-dependent, e.g. "Te snel/langzaam", "Functionaliteit", "Anders")
- multiSelect: false

After clarification, re-categorize as TESTABLE or MEASURABLE.

**Technique mapping for TESTABLE issues:**

Analyze each TESTABLE issue individually and assign a technique:

```
For each TESTABLE issue:
  IF issue involves:
    - validation rules, business logic, calculations, edge cases, race conditions
    → TDD

  IF issue involves:
    - CRUD wiring, config, missing imports, straightforward plumbing, routing
    → Implementation First

  DEFAULT → TDD
```

Display technique map:

```
TECHNIQUE MAP (fixes):

| Item | Issue                | Type   | Technique            | Reason              |
|------|----------------------|--------|----------------------|---------------------|
| {N}  | {issue description}  | AUTO   | TDD                  | {reason}            |
| {N}  | {issue description}  | MANUAL | Implementation First | {reason}            |
```

---

### FASE 4: Fix Loop

For each TESTABLE issue, execute the assigned technique. For MEASURABLE issues, apply Direct Fix.

#### TDD Fix

Assess complexity first. For complex issues (race conditions, auth flows, caching):

Use AskUserQuestion tool:

- header: "Research"
- question: "Dit is een complexe fix ({brief description}). Wil je patterns researchen?"
- options:
  - label: "Ja, research (Aanbevolen)", description: "Research beste aanpak via Context7"
  - label: "Nee, direct fixen", description: "Fix zonder research"
- multiSelect: false

Then apply TDD:

1. Write test that captures the reported issue
2. Run test → expect FAIL
3. Implement minimal fix
4. Run test → expect PASS
5. Max 3 attempts before asking user

After each successful fix, output:

```
[FIX] Item {N}: {title}
Technique: TDD
Type: {AUTO|MANUAL}
RED:   FAIL ({what the test captured})
GREEN: PASS
SYNC:  Root cause: {what was actually wrong, file:line}.
       Fix: {what pattern/approach was used and why}.
       Impact: {what this affects — isolated to this file, or touches other parts}.
```

**If test unexpectedly PASSES:**

Use AskUserQuestion tool:

- header: "Test Passed"
- question: "De test slaagt al. Wat wil je doen?"
- options:
  - label: "Overslaan (Aanbevolen)", description: "Item lijkt al gefixt, ga naar volgende"
  - label: "Test aanpassen", description: "De test klopt niet, ik geef nieuwe details"
  - label: "Handmatig checken", description: "Stop en check dit handmatig"
- multiSelect: false

#### Implementation First Fix

For TESTABLE issues assigned Implementation First technique:

1. Analyze the reported issue and locate root cause
2. Implement the fix directly
3. Write test that verifies the fix works
4. Run test → expect PASS
5. If FAIL → adjust implementation, max 3 attempts before asking user

After each successful fix, output:

```
[FIX] Item {N}: {title}
Technique: Implementation First
Type: {AUTO|MANUAL}
IMPLEMENTED: {what was fixed}
TESTED: PASS
SYNC:  Root cause: {what was actually wrong, file:line}.
       Fix: {what was changed and why this approach}.
       Impact: {what this affects in the codebase}.
```

#### MEASURABLE Issues: Direct Fix

Locate code, apply fix directly (config, styling, timing), document the change.
Cannot be auto-verified — needs manual re-test.

After each fix, output:

```
[FIX] Item {N}: {title}
Technique: Direct Fix
Type: {AUTO|MANUAL}
SYNC:  Root cause: {what was actually wrong, file:line}.
       Fix: {what was changed and why this approach}.
       Impact: {what this affects in the codebase}.
```

---

### FASE 5: Re-test (Hybrid)

Re-test ONLY fixed items, using the appropriate method per test_type.

#### Phase A: Auto Re-test (Task Agent)

Re-run all fixed AUTO items via a **Task agent** (same approach as FASE 1).

**Task agent prompt template:**

```
Re-test de volgende gefixte items automatisch via browser tools en bash commands.
Dev server: {url}
Feature: {feature-name}

GEFIXTE ITEMS:
{for each fixed AUTO item:}
- Item {N}: {title}
  Wijziging: {summary of fix + root cause}
  Stappen: {test steps}
  Testdata: {test data}
  Verwacht: {expected outcome after fix}

INSTRUCTIES:
Zelfde als FASE 1 — voer stappen uit, analyseer resultaat, geef gestructureerd terug.

RESULTAAT FORMAT (strict):
RETEST_RESULTS_START
| # | Test | Resultaat | Bewijs | Redenering |
|---|------|-----------|--------|------------|
| {N} | {title} | PASS/FAIL/TOOL_ERROR | {wat gezien} | {waarom pass/fail} |
RETEST_RESULTS_END
```

Parse and display results same as FASE 1 (including truncation handling — grep for `RETEST_RESULTS_START` in output file if truncated). TOOL_ERROR items move to Phase B (manual re-test).

#### Phase B: Manual Re-test

Re-test MANUAL items that failed, using the same guided walkthrough pattern:

**For each fixed MANUAL item:**

```
──────────────────────────────────────
HANDMATIG RE-TEST {n}/{total_manual_retest}: {item title}
──────────────────────────────────────

WIJZIGING:
→ {summary of change + root cause, e.g. "Client-side required validation + inline error
   toegevoegd — form miste frontend validatie terwijl backend (Zod) al correct was"}

STAPPEN:
1. {same concrete steps as original test}
2. {with same or updated test data}

TESTDATA:
{same table format as FASE 2}

VERWACHT:
→ {expected outcome after fix}
```

Use same AskUserQuestion per item (Pass/Fail/Skip).

**After all re-tests, show combined re-test results:**

```
RE-TEST RESULTATEN: {feature-name}

| # | Test              | Type   | Resultaat              |
|---|-------------------|--------|------------------------|
| 2 | Without email     | AUTO   | ✓ PASS                |
| 3 | Welcome mail      | MANUAL | ✓ PASS                |

RE-TEST PASS: {n}  RE-TEST FAIL: {n}
```

---

### FASE 5b: Re-test Loop

Parse re-test results. If all pass → FASE 6.

**If items still failing:**

Use AskUserQuestion tool:

- header: "Item {N} Faalt Nog"
- question: "Item {N} ({AUTO|MANUAL}) werkt nog niet na fix. Wat wil je doen?"
- options:
  - label: "Meer details geven (Aanbevolen)", description: "Ik geef specifiekere feedback"
  - label: "Andere aanpak", description: "Probeer een andere fix strategie"
  - label: "Accepteren zoals het is", description: "Markeer als acceptabel voor nu"
  - label: "Handmatig fixen", description: "Stop en fix het zelf"
- multiSelect: false

Loop back to FASE 3 until all pass or user exits. On loop-back:

- AUTO items that still fail → re-run automatically in FASE 5 Phase A
- MANUAL items that still fail → re-test manually in FASE 5 Phase B

---

### FASE 6: Completion

1. **Update 01-define.md:** Set `Status: VERIFIED` with date.

2. **Create 03-test-results.md:**

   ```markdown
   # Test Results: {feature-name}

   ## Summary

   | Metric | Value       |
   | ------ | ----------- |
   | Status | VERIFIED    |
   | Items  | {N}         |
   | Passed | {N}         |
   | Auto   | {N}         |
   | Manual | {N}         |
   | Date   | {timestamp} |

   ## Test History

   ### Session 1: {date}

   | #   | Test               | Type   | Initial | Final | Fixes Applied     |
   | --- | ------------------ | ------ | ------- | ----- | ----------------- |
   | 1   | Valid registration | AUTO   | PASS    | PASS  | -                 |
   | 2   | Without email      | AUTO   | FAIL    | PASS  | {fix description} |
   | 3   | Welcome mail       | MANUAL | FAIL    | PASS  | {fix description} |

   ## Automated Test Evidence

   | #   | Test               | Bewijs                                     |
   | --- | ------------------ | ------------------------------------------ |
   | 1   | Valid registration | Snapshot: /dashboard + h1 'Welkom'         |
   | 2   | Without email      | Snapshot: foutmelding 'Email is verplicht' |

   ## Tests Added

   - {test files added}

   ## Files Modified

   - {file:line} ({change description})
   ```

3. **Sync backlog:**
   - Read `.workspace/backlog.md`
   - Move feature from `### BLT` to `### DONE` subsection
   - In DONE section: dependency arrow `->` changes to description `-`
   - Update section header counts: `({done}/{total} done)`
   - Update "Updated" timestamp
   - Update "Next" suggestion

4. **Auto-commit:**

   ```bash
   git add .
   git commit -m "$(cat <<'EOF'
   test({feature}): verified - {N} items pass ({auto} auto, {manual} manual)

   Hybrid test verification complete.
   - Automated (browser + CLI): {auto_count} items
   - Manual walkthrough: {manual_count} items
   - Fixed: {list of fixes}
   - Tests added: {count}
   EOF
   )"
   ```

   **IMPORTANT:** Do NOT add Co-Authored-By or Generated with Claude Code footer to pipeline commits.

---

## Output Structure

```
.workspace/features/{feature-name}/
├── 01-define.md          # Updated: Status: VERIFIED
├── 02-build-log.md       # From build phase
├── 03-test-checklist.md  # From build phase
└── 03-test-results.md    # NEW: Hybrid test history and results (auto + manual)
```

## Example Flow (compact)

```
/dev:test user-registration
→ FASE 0: Classify → 3 AUTO (2 browser, 1 CLI) + 1 MANUAL
→ FASE 0: User override → akkoord
→ FASE 0: Dev server check → curl localhost:3000 → 200 OK
→ FASE 1: Task agent runs 3 AUTO items → 2 PASS, 1 FAIL (no error msg)
→ FASE 2: Manual walkthrough 1 item (welcome mail) → FAIL (no mail)
→ FASE 2b: Combined → 2 PASS, 2 FAIL
→ FASE 3: Categorize → item 2: TDD, item 4: Impl First
→ FASE 4: Fix loop → both fixed
→ FASE 5: Re-test → Task agent re-tests item 2 (PASS), manual re-test item 4 (PASS)
→ FASE 6: All 4 pass → commit test(user-registration): verified
```


## Troubleshooting

### Error: Dev server not running
**Cause:** AUTO/BROWSER tests require a running dev server.
**Solution:** Start the dev server first (`npm run dev` or `/dev-server`). The skill checks `curl localhost:{port}` before running tests.

### Error: Task agent timeout on browser tests
**Cause:** Browser MCP tools may be slow or page not loading.
**Solution:** Check that the dev server is responding. Try running the test manually. If persistent, the skill falls back to all-manual testing.

### Error: Classification seems wrong
**Cause:** Some items may be borderline between AUTO and MANUAL.
**Solution:** The skill asks for user override after initial classification. Review the proposed split and adjust before testing starts.

## Restrictions

This skill must NEVER:

- Install Auto npm packages solely for this skill (use MCP browser tools + existing project test suites)
- Run automated tests in the main conversation context (always use a Task agent)
- Read source files directly in the main conversation for test data (always use Explore agent)
- Skip classification (every item must be classified before testing)
- Run auto tests without dev server check
- Silently override user classification choices
- Skip TDD for testable issues (concrete behavior described)
- Guess what subjective feedback means
- Apply fixes without documenting changes
- Mark complete if any items still failing
- Re-test items that already passed

This skill must ALWAYS:

- Classify each test item as AUTO or MANUAL before testing begins
- Allow user override of classification before starting tests
- Run automated tests in a separate Task agent (isolated context window)
- Capture evidence per automated test (what Claude saw in snapshot/screenshot)
- Mention pass/fail reasoning per automated test
- Use bash commands for existing test suites when available (npm test, npx vitest, npx playwright test)
- Graceful fallback to all-manual on any tool/agent failure (dev server down, MCP connection lost, agent timeout)
- Re-test AUTO items automatically via Task agent after fixes (FASE 5 Phase A)
- Merge automated and manual results in one combined summary (FASE 2b)
- Generate realistic, copy-pasteable test data per item before starting
- Show setup instructions once for manual items, then each item individually
- Collect PASS/FAIL/SKIP per manual item via AskUserQuestion
- Parse all feedback formats (numbered, free text) when inline feedback is provided
- Categorize each failure (TESTABLE/MEASURABLE/SUBJECTIVE) with test_type tag
- Use TDD loop for testable issues
- Ask clarifying questions for subjective issues
- Loop until all items pass
- Update documentation on completion with hybrid results format
