---
description: Manual testing verification with structured feedback and fix loop
disable-model-invocation: true
---

# Test

## Overview

This is the test phase of the dev workflow: define -> build -> **test**

Handles human verification of implemented features through structured feedback, issue categorization, and iterative fix loops until all items pass.

**Trigger**: `/dev:test` or `/dev:test {feature-name}` or `/dev:test {feature-name} {feedback}`

## When to Use

- After `/dev:build` completes
- When `.workspace/features/{name}/03-test-checklist.md` exists
- NOT for: planning (/dev:define), implementation (/dev:build)

## Input Formats

```
# Format 1: Inline feedback (recommended)
/dev:test user-registration
1:PASS
2:FAIL no validation error
3:PASS
4:FAIL no mail sent

# Format 2: Feature name only (shows checklist first)
/dev:test user-registration

# Format 3: Free text
/dev:test user-registration
Everything works except validation is missing and no welcome mail
```

## Feedback Categorization

| Type           | Example                               | Action                                |
| -------------- | ------------------------------------- | ------------------------------------- |
| **TESTABLE**   | "returns 500 instead of 422"          | TDD fix loop (test FIRST)             |
| **MEASURABLE** | "response too slow", "font too small" | Direct fix                            |
| **SUBJECTIVE** | "doesn't feel right"                  | Ask for specifics, then re-categorize |

## Workflow

### FASE 0: Load Context

1. **Parse user input:**
   - Feature name only → show checklist, wait for feedback
   - Feature name + feedback → parse feedback immediately
   - "recent" → find most recently modified 03-test-checklist.md

2. **Locate and validate test checklist:**

   ```
   .workspace/features/{feature-name}/03-test-checklist.md
   ```

   If not found → exit with message to run `/dev:build {feature-name}` first.

3. **Read checklist** and parse test items with expected behavior.

4. **Generate Test Data**

   Before starting the walkthrough, analyze the feature to prepare concrete test data:
   - Read `01-define.md` for requirements and acceptance criteria
   - Read relevant source files for form fields, API endpoints, validation rules
   - Generate realistic test values per item (names, emails, passwords, URLs, etc.)
   - Include both valid and invalid data depending on the test scenario

   This data is used in step 5 to pre-fill the instructions so the user can copy-paste.

5. **Guided Walkthrough (1-by-1)**

   Show setup instructions once (stack-appropriate from CLAUDE.md), then loop through each test item individually:

   ```
   TEST SETUP: {feature-name}
   {stack-appropriate setup, e.g. "Open http://localhost:3000"}
   ```

   **For each item (1 to N):**

   ```
   ──────────────────────────────────────
   TEST {n}/{total}: {item title}
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
   - header: "Test {n}/{total}"
   - question: "Resultaat van '{item title}'?"
   - options:
     - label: "Pass (Recommended)", description: "Werkt zoals verwacht"
     - label: "Fail", description: "Werkt niet — ik geef details"
     - label: "Skip", description: "Kan niet testen, sla over"
   - multiSelect: false

   **If Pass** → record PASS, continue to next item
   **If Fail** → ask for brief details (what happened instead?), record FAIL + notes, continue to next item
   **If Skip** → record SKIP with reason, continue to next item

   After all items are walked through, show summary:

   ```
   TEST RESULTATEN: {feature-name}

   | # | Test | Resultaat |
   |---|------|-----------|
   | 1 | {title} | ✓ PASS |
   | 2 | {title} | ✗ FAIL: {notes} |
   | 3 | {title} | ⊘ SKIP |

   PASS: {n}  FAIL: {n}  SKIP: {n}
   ```

   **If all PASS** → skip to FASE 6
   **If any FAIL** → proceed to FASE 2 (categorize issues)

---

### FASE 1: Parse Feedback

**When:** User provided inline feedback via `/dev:test {name} {feedback}` (skipping the guided walkthrough).

Parse user feedback into structured results (item number, PASS/FAIL, notes).
Accept both numbered format (`1:PASS 2:FAIL note`) and free text.

After parsing, show the same summary table as the guided walkthrough and proceed to FASE 2.

**Note:** When the guided walkthrough (FASE 0 step 5) was used, skip FASE 1 entirely — results are already structured.

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

### FASE 1b: Debug Analysis

**When:** User selected "Er zijn problemen" without specific feedback.

1. **Request debug info** appropriate for the stack:
   - Frontend: browser console, network tab
   - Backend: server logs, API responses, database state
   - Fullstack: both

2. **Ask which items failed:**

   Use AskUserQuestion tool:
   - header: "Probleem Details"
   - question: "Welke items werkten niet? (selecteer alles dat van toepassing is)"
   - options: (dynamically generated from checklist items)
   - multiSelect: true

3. For each failed item, ask for specifics. Correlate with any debug output provided.

4. Generate structured feedback for FASE 2 with debug context.

---

### FASE 2: Categorize Issues

For each FAIL item, categorize using the Feedback Categorization table above.

**For SUBJECTIVE issues**, ask for clarification immediately:

Use AskUserQuestion tool:

- header: "Verduidelijking Item {N}"
- question: "'{notes}' is niet specifiek genoeg. Wat is er precies mis?"
- options: (context-dependent, e.g. "Te snel/langzaam", "Functionaliteit", "Anders")
- multiSelect: false

After clarification, re-categorize as TESTABLE or MEASURABLE.

---

### FASE 3: Fix Loop

#### TESTABLE Issues: TDD Fix

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

**If test unexpectedly PASSES:**

Use AskUserQuestion tool:

- header: "Test Passed"
- question: "De test slaagt al. Wat wil je doen?"
- options:
  - label: "Overslaan (Aanbevolen)", description: "Item lijkt al gefixt, ga naar volgende"
  - label: "Test aanpassen", description: "De test klopt niet, ik geef nieuwe details"
  - label: "Handmatig checken", description: "Stop en check dit handmatig"
- multiSelect: false

#### MEASURABLE Issues: Direct Fix

Locate code, apply fix directly (config, styling, timing), document the change.
Cannot be auto-verified — needs manual re-test.

**After all fixes:**

```bash
powershell -ExecutionPolicy Bypass -File .claude/scripts/notify.ps1 -Title "Claude Code" -Message "Fixes ready for re-test"
```

---

### FASE 4: Re-test Checklist

Re-test ONLY fixed items using the same guided walkthrough pattern from FASE 0 step 5.

**For each fixed item:**

```
──────────────────────────────────────
RE-TEST {n}/{total}: {item title}
──────────────────────────────────────

WIJZIGING:
→ {what was changed and why, e.g. "Validation rule toegevoegd voor email veld"}

STAPPEN:
1. {same concrete steps as original test}
2. {with same or updated test data}

TESTDATA:
{same table format as FASE 0}

VERWACHT:
→ {expected outcome after fix}
```

Use same AskUserQuestion per item (Pass/Fail/Skip).
After all re-test items, show summary table.

---

### FASE 5: Re-test Loop

Parse re-test feedback (same as FASE 1). If all pass → FASE 6.

**If items still failing:**

Use AskUserQuestion tool:

- header: "Item {N} Faalt Nog"
- question: "Item {N} werkt nog niet na fix. Wat wil je doen?"
- options:
  - label: "Meer details geven (Aanbevolen)", description: "Ik geef specifiekere feedback"
  - label: "Andere aanpak", description: "Probeer een andere fix strategie"
  - label: "Accepteren zoals het is", description: "Markeer als acceptabel voor nu"
  - label: "Handmatig fixen", description: "Stop en fix het zelf"
- multiSelect: false

Loop back to FASE 2 until all pass or user exits.

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
   | Date   | {timestamp} |

   ## Test History

   ### Session 1: {date}

   | #   | Initial | Final | Fixes Applied     |
   | --- | ------- | ----- | ----------------- |
   | 1   | PASS    | PASS  | -                 |
   | 2   | FAIL    | PASS  | {fix description} |

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
   test({feature}): verified - all {N} items pass

   Manual test verification complete.
   - Fixed: {list of fixes}
   - Tests added: {count}
   EOF
   )"
   ```

   **IMPORTANT:** Do NOT add Co-Authored-By or Generated with Claude Code footer to pipeline commits.

5. **Notify:**
   ```bash
   powershell -ExecutionPolicy Bypass -File .claude/scripts/notify.ps1 -Title "Claude Code" -Message "{feature} verified"
   ```

---

## Output Structure

```
.workspace/features/{feature-name}/
├── 01-define.md          # Updated: Status: VERIFIED
├── 02-build-log.md       # From build phase
├── 03-test-checklist.md  # From build phase
└── 03-test-results.md    # NEW: Test history and results
```

## Example Session

```
User: /dev:test user-registration

Claude: TEST SETUP: user-registration
        Open http://localhost:3000

        ──────────────────────────────────────
        TEST 1/4: Register with valid data
        ──────────────────────────────────────

        STAPPEN:
        1. Ga naar /register
        2. Vul de testdata in
        3. Klik op 'Registreren'

        TESTDATA:
        ┌─────────────┬──────────────────────┐
        │ Naam        │ Test User            │
        │ Email       │ test@voorbeeld.nl    │
        │ Wachtwoord  │ Test1234!            │
        └─────────────┴──────────────────────┘

        VERWACHT:
        → Redirect naar /dashboard, welkomstmelding zichtbaar

        Resultaat van 'Register with valid data'? → PASS

        ──────────────────────────────────────
        TEST 2/4: Register without email
        ──────────────────────────────────────

        STAPPEN:
        1. Ga naar /register
        2. Vul de testdata in (let op: email is LEEG)
        3. Klik op 'Registreren'

        TESTDATA:
        ┌─────────────┬──────────────────────┐
        │ Naam        │ Test User            │
        │ Email       │ (leeg laten)         │
        │ Wachtwoord  │ Test1234!            │
        └─────────────┴──────────────────────┘

        VERWACHT:
        → Rode foutmelding: "Email is verplicht"

        Resultaat van 'Register without email'? → FAIL
        Wat ging er mis? → "Geen error, form submit gewoon"

        [continues 3/4, 4/4...]

Claude: TEST RESULTATEN: user-registration

        | # | Test                  | Resultaat              |
        |---|-----------------------|------------------------|
        | 1 | Valid registration     | ✓ PASS                |
        | 2 | Without email          | ✗ FAIL: geen error    |
        | 3 | Duplicate email        | ✓ PASS                |
        | 4 | Welcome mail           | ✗ FAIL: geen mail     |

        PASS: 2  FAIL: 2  SKIP: 0

        [TDD fix loop for items 2 and 4...]

        ──────────────────────────────────────
        RE-TEST 1/2: Register without email
        ──────────────────────────────────────

        WIJZIGING:
        → Validation rule 'required' toegevoegd aan email veld

        STAPPEN:
        1. Ga naar /register
        2. Laat email leeg, vul rest in
        3. Klik op 'Registreren'

        VERWACHT:
        → Rode foutmelding: "Email is verplicht"

        Resultaat? → PASS

        [RE-TEST 2/2: Welcome mail → PASS]

Claude: USER-REGISTRATION COMPLETE!

        All 4 test items passed.
        Committed: test(user-registration): verified
```

## Restrictions

This skill must NEVER:

- Skip TDD for testable issues (concrete behavior described)
- Guess what subjective feedback means
- Apply fixes without documenting changes
- Mark complete if any items still failing
- Re-test items that already passed

This skill must ALWAYS:

- Walk through tests one-by-one with concrete steps and pre-generated test data
- Generate realistic, copy-pasteable test data per item before starting
- Show setup instructions once, then each item individually
- Collect PASS/FAIL/SKIP per item via AskUserQuestion
- Parse all feedback formats (numbered, free text) when inline feedback is provided
- Categorize each failure (TESTABLE/MEASURABLE/SUBJECTIVE)
- Use TDD loop for testable issues
- Ask clarifying questions for subjective issues
- Re-test only fixed items using same 1-by-1 walkthrough pattern
- Loop until all items pass
- Update documentation on completion
- Send notifications at key points
