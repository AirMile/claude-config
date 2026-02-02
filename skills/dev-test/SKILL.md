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

| Type | Example | Action |
|------|---------|--------|
| **TESTABLE** | "returns 500 instead of 422" | TDD fix loop (test FIRST) |
| **MEASURABLE** | "response too slow", "font too small" | Direct fix |
| **SUBJECTIVE** | "doesn't feel right" | Ask for specifics, then re-categorize |

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

4. **Display test instructions** appropriate for the stack (from CLAUDE.md):

   ```
   TEST CHECKLIST: {feature-name}

   {stack-appropriate setup instructions}

   Voer deze tests uit:
   1. {test description}
   2. {test description}

   VERWACHT GEDRAG:
   - {expected result 1}
   - {expected result 2}

   Test de feature en rapporteer de resultaten.
   ```

5. **Ask for results:**

   Use AskUserQuestion tool:
   - header: "Test Resultaat"
   - question: "Hoe ging de test?"
   - options:
     - label: "Alles werkt (Aanbevolen)", description: "Alle tests werken zoals verwacht"
     - label: "Er zijn problemen", description: "Sommige dingen werken niet goed"
     - label: "App crashed/error", description: "De app geeft een error"
   - multiSelect: false

   **If "Alles werkt"** → skip to FASE 6, mark all PASS
   **If "Er zijn problemen"** → proceed to FASE 1b
   **If "App crashed/error"** → ask for error details, analyze and fix

---

### FASE 1: Parse Feedback

Parse user feedback into structured results (item number, PASS/FAIL, notes).
Accept both numbered format (`1:PASS 2:FAIL note`) and free text.

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

Generate minimal re-test checklist containing ONLY fixed items.
Show what was changed per item. Wait for re-test feedback.

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
   | Metric | Value |
   |--------|-------|
   | Status | VERIFIED |
   | Items | {N} |
   | Passed | {N} |
   | Date | {timestamp} |

   ## Test History

   ### Session 1: {date}
   | # | Initial | Final | Fixes Applied |
   |---|---------|-------|---------------|
   | 1 | PASS | PASS | - |
   | 2 | FAIL | PASS | {fix description} |

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

Claude: TEST CHECKLIST: user-registration

        Voer deze tests uit:
        1. Registreer met geldige gegevens
        2. Registreer zonder email
        3. Registreer met bestaand email
        4. Check of welkomstmail verstuurd wordt

        VERWACHT GEDRAG:
        - 1: Account aangemaakt, redirect naar dashboard
        - 2: Validation error "Email is required"
        - 3: Validation error "Email already taken"
        - 4: Welkomstmail in mailbox/log

        Test de feature en rapporteer de resultaten.

User: 1:PASS
      2:FAIL no error shown
      3:PASS
      4:FAIL no mail sent

Claude: FEEDBACK ANALYSIS

        PASSED: 2 items (1, 3)
        FAILED: 2 items (2, 4)

        | # | Issue | Type | Action |
        |---|-------|------|--------|
        | 2 | no validation error | TESTABLE | TDD fix loop |
        | 4 | no mail sent | TESTABLE | TDD fix loop |

        -> Starting fix loop...

        [Writes test for item 2 -> FAILS as expected]
        [Fix: adds required validation rule]
        [Runs test -> PASSES]

        [Writes test for item 4 -> FAILS]
        [Fix: dispatches welcome mail in registration service]
        [Runs test -> PASSES]

        FIX LOOP COMPLETE

        RE-TEST REQUIRED

        | # | Test | Change Made |
        |---|------|-------------|
        | 2 | Email validation | Added required rule |
        | 4 | Welcome mail | Added mail dispatch |

        Test opnieuw.

User: 2:PASS
      4:PASS

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
- Show test checklist before asking for feedback
- Parse all feedback formats (numbered, free text)
- Categorize each failure (TESTABLE/MEASURABLE/SUBJECTIVE)
- Use TDD loop for testable issues
- Ask clarifying questions for subjective issues
- Generate re-test checklist with only fixed items
- Loop until all items pass
- Update documentation on completion
- Send notifications at key points
