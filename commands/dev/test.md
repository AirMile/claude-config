---
description: Manual testing verification with structured feedback and fix loop
---

# Test

## Overview

This is the test phase of the web development workflow.

The test phase handles human verification of implemented web features through structured test feedback, intelligent issue categorization, and iterative fix loops until all items pass.

**Trigger**: `/dev:test` or `/dev:test {feature-name}` or `/dev:test {feature-name} {feedback}`

## When to Use

This skill activates in these scenarios:

**Primary use:**
- After feature implementation completes
- When `.workspace/features/{name}/03-test-checklist.md` exists
- When human verification is needed for web features

**Context indicators:**
- Feature has been implemented
- Test checklist exists in 03-test-checklist.md
- User wants to verify functionality works correctly

**NOT for:**
- Initial feature planning (use /dev:define)
- Implementation (use /dev:build)
- Automated unit testing only (use /dev:verify)

## Input Formats

### Format 1: Inline feedback (recommended)
```
/dev:test contact-form
1:PASS
2:PASS
3:FAIL validation message missing
4:FAIL button not disabled
```

### Format 2: Feature name only (shows checklist first)
```
/dev:test contact-form
```

### Format 3: Free text feedback
```
/dev:test contact-form
Everything works except validation message is missing and submit button doesn't disable
```

## Feedback Categorization

| Type | Example | Action |
|------|---------|--------|
| **TESTABLE** | "form submits empty when required field missing" | Unit test fix |
| **MEASURABLE** | "animation too slow" | CSS/config fix |
| **SUBJECTIVE** | "doesn't feel right" | Ask for details |

### TESTABLE -> TDD Fix Loop
```
Feedback: "form submits when email is empty"
     |
Generate test: test_form_requires_email()
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
Adjust transition-duration from 300ms to 150ms
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
- Too big/small?
- Wrong color/style?
- Something else?"
     |
User: "button looks too small on mobile"
     |
Now MEASURABLE -> Direct CSS fix
```

## Workflow

### FASE 0: Load Context

**Goal:** Load test checklist and prepare for feedback.

**Steps:**

1. **Parse user input:**
   - If feature name only -> show checklist, wait for feedback
   - If feature name + feedback -> parse feedback immediately
   - If "recent" -> find most recently modified 03-test-checklist.md

2. **Locate test checklist:**
   ```
   .workspace/features/{feature-name}/03-test-checklist.md
   ```

3. **Validate file exists:**

   **If file not found:**
   ```
   NOT FOUND: 03-test-checklist.md

   Feature: {feature-name}
   Searched: .workspace/features/{feature-name}/

   This feature needs a test checklist first.
   Run /dev:build {feature-name} to implement and generate test checklist.
   ```
   -> Exit skill

4. **Read test checklist:**
   - Parse test items with numbers
   - Note expected behavior for each item
   - Count total items

5. **Display test instructions:**

   ```
   TEST CHECKLIST: {feature-name}

   Open de app in je browser: http://localhost:5173
   Navigeer naar: {relevant page/component}

   Voer deze tests uit:
   1. {test description}
   2. {test description}
   3. {test description}
   4. {test description}

   VERWACHT GEDRAG:
   - {expected result 1}
   - {expected result 2}
   - {expected result 3}
   - {expected result 4}

   Test de feature en rapporteer de resultaten.
   ```

6. **Wait for user completion:**

   Use AskUserQuestion tool:
   - header: "Test Resultaat"
   - question: "Hoe ging de test?"
   - options:
     - label: "Alles werkt (Aanbevolen)", description: "Alle tests werken zoals verwacht"
     - label: "Er zijn problemen", description: "Sommige dingen werken niet goed"
     - label: "App crashed/error", description: "De app geeft een error"
   - multiSelect: false

   **Response handling:**

   **If "Alles werkt":**
   -> Skip to FASE 6 (Completion), mark all items PASS

   **If "Er zijn problemen":**
   -> Proceed to FASE 1b (Debug Analysis + User Details)

   **If "App crashed/error":**
   -> Ask for console error details, analyze and offer to fix

7. **Display checklist (if no feedback provided):**
   ```
   TEST CHECKLIST: {feature-name}

   | # | Test | Expected |
   |---|------|----------|
   | 1 | {test description} | {expected behavior} |
   | 2 | {test description} | {expected behavior} |
   | 3 | {test description} | {expected behavior} |
   | 4 | {test description} | {expected behavior} |

   Test de feature in je browser en rapporteer de resultaten.

   Feedback formats:
   - Quick: "1:PASS 2:PASS 3:FAIL missing message 4:FAIL button issue"
   - Detailed: "Items 1-2 work, item 3 validation missing, item 4 button not disabled"
   ```
   -> Wait for user feedback

**Output (if feedback provided):**
```
TEST LOADED

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
       {"item": 3, "status": "FAIL", "notes": "validation message missing"},
       {"item": 4, "status": "FAIL", "notes": "button not disabled"},
   ]
   ```

**Output:**
```
FEEDBACK PARSED

| # | Status | Notes |
|---|--------|-------|
| 1 | PASS | - |
| 2 | PASS | - |
| 3 | FAIL | validation message missing |
| 4 | FAIL | button not disabled |

Passed: 2 items
Failed: 2 items

-> Categorizing issues...
```

---

### FASE 1b: Debug Analysis

**Goal:** Gather browser debug information for accurate issue identification.

**When to use:** This fase runs when user selected "Er zijn problemen" in step 6.

**Steps:**

1. **Request debug information:**

   ```
   DEBUG INFO REQUEST

   Open browser DevTools (F12) en check:
   - Console: Zijn er errors?
   - Network: Faalt een API call?
   - React DevTools: Klopt de state?

   Plak relevante errors hieronder.
   ```

2. **Parse debug info if provided:**
   - Extract console error messages
   - Identify network failures (status codes, URLs)
   - Note React state issues

   ```
   DEBUG ANALYSIS:

   Console errors found:
   - TypeError: Cannot read property 'map' of undefined at ContactForm.jsx:45
   - Warning: Each child in a list should have a unique "key" prop

   Network issues:
   - POST /api/contact - 500 Internal Server Error

   State issues:
   - formData.errors is undefined when expected to be array
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
   Je selecteerde: "Item 3: Form validation"

   Wat was het probleem precies?
   - Geen error message?
   - Verkeerde error message?
   - Error verdwijnt niet?
   - Anders?
   ```

   Wait for user description.

5. **Correlate with debug output (if provided):**

   ```
   ISSUE ANALYSIS: Item 3

   User feedback: "Geen error message"

   Debug log analysis:
   - Console: TypeError at ContactForm.jsx:45
   - formData.errors is undefined

   Conclusion: errors array not initialized
   Likely cause: Missing default state for errors
   ```

6. **Generate enriched feedback for FASE 2:**

   Convert to structured feedback with debug context:

   ```python
   results = [
       {
           "item": 3,
           "status": "FAIL",
           "notes": "no validation message",
           "debug_context": {
               "console_error": "TypeError: Cannot read property 'map' of undefined",
               "file": "ContactForm.jsx:45",
               "root_cause": "errors array not initialized"
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
| 3 | No validation | TypeError at ContactForm.jsx:45 |
| 4 | Button issue | No console error |

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
   - Concrete behavior mentioned (form submits, data missing)
   - Expected vs actual behavior stated
   - Logic error described

   Examples:
   - "form submits when email empty" -> TESTABLE
   - "counter shows 0, expected 5" -> TESTABLE
   - "redirect goes to /home instead of /dashboard" -> TESTABLE

   **Check for MEASURABLE indicators:**
   - Relative terms without values ("too slow", "too small")
   - Visual/styling issues ("color wrong", "alignment off")
   - Animation/transition issues

   Examples:
   - "animation too slow" -> MEASURABLE
   - "button too small on mobile" -> MEASURABLE
   - "hover effect not visible enough" -> MEASURABLE

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
     - label: "Te snel/langzaam", description: "Timing of animatie probleem"
     - label: "Te groot/klein", description: "Sizing of spacing probleem"
     - label: "Verkeerde stijl", description: "Kleur, font, of andere styling"
     - label: "Functionaliteit", description: "Het doet niet wat het moet doen"
     - label: "Responsive issue", description: "Werkt niet goed op mobiel/tablet"
     - label: "Anders", description: "Ik beschrijf het specifiek"
   - multiSelect: false

   After clarification:
   - Re-analyze with new details
   - Update category (TESTABLE or MEASURABLE)

3. **Build categorized issues list:**
   ```python
   issues = [
       {"item": 3, "type": "TESTABLE", "notes": "form submits when email empty", "action": "TDD fix"},
       {"item": 4, "type": "MEASURABLE", "notes": "button too small on mobile", "action": "Direct fix"},
   ]
   ```

**Output:**
```
FEEDBACK ANALYSIS

PASSED: 2 items (1, 2)
FAILED: 2 items (3, 4)

| # | Issue | Type | Action |
|---|-------|------|--------|
| 3 | form submits when empty | TESTABLE | TDD fix loop |
| 4 | button too small | MEASURABLE | Direct CSS fix |

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
| Simple | Change a validation rule | No |
| Medium | Add new component logic | No |
| Complex | Refactor state management, fix race condition | Yes |

**Complexity indicators:**

```
SIMPLE (no research):
- "validation not working"           -> Fix validation logic
- "wrong text displayed"             -> Update text content
- "missing required field"           -> Add required attribute
- "button click does nothing"        -> Fix onClick handler

COMPLEX (offer research):
- "state updates not reflecting"          -> React state issue
- "form data lost on navigation"          -> State persistence issue
- "API calls firing multiple times"       -> useEffect dependency issue
- "component re-renders infinitely"       -> Render loop issue
- "async data not loading correctly"      -> Race condition / suspense issue
```

**If complex fix detected:**

Use AskUserQuestion tool:
- header: "Research"
- question: "Dit is een complexe fix ({brief issue description}). Wil je React/web patterns researchen?"
- options:
  - label: "Ja, research (Aanbevolen)", description: "Research beste aanpak via Context7"
  - label: "Nee, direct fixen", description: "Fix zonder research"
- multiSelect: false

**If research requested:**
Use Context7 MCP tools to research the relevant pattern (React hooks, state management, etc.)

**Step 1-5: TDD Fix** (potentially informed by research)

1. **Generate test based on feedback:**
   ```
   GENERATING TEST for item {N}

   Issue: {description}
   Expected: {concrete behavior from feedback}
   ```

2. **Write test file:**
   ```typescript
   // tests/unit/{feature}.test.ts
   import { describe, it, expect } from 'vitest'
   import { render, screen, fireEvent } from '@testing-library/react'
   import { ContactForm } from '@/components/ContactForm'

   describe('ContactForm', () => {
     it('should not submit when required fields are empty', async () => {
       // Arrange
       render(<ContactForm />)

       // Act
       const submitButton = screen.getByRole('button', { name: /submit/i })
       fireEvent.click(submitButton)

       // Assert
       expect(screen.getByText(/email is required/i)).toBeInTheDocument()
     })
   })
   ```

3. **Run test (expect FAIL):**
   ```bash
   npm run test -- tests/unit/{feature}.test.ts
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
     - label: "Test aanpassen", description: "De test klopt niet, ik geef nieuwe details"
     - label: "Handmatig checken", description: "Stop en check dit handmatig"
   - multiSelect: false

   **If test FAILS (expected):**
   ```
   TEST FAILS (expected)

   Test: should not submit when required fields are empty
   Expected: error message visible
   Actual: form submitted without validation

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
   - Adjust CSS value/property
   - Update Tailwind class
   - Modify config value
   - No test possible (visual/subjective)
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
| 3 | TESTABLE | FIXED (test passes) | Added email validation |
| 4 | MEASURABLE | FIXED (needs re-test) | Increased button padding |

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
   | 3 | Form validation | Added required field check |
   | 4 | Button size | Increased padding for mobile |

   Refresh de pagina en test opnieuw.

   Feedback format:
   3:PASS
   4:PASS

   Or if still failing:
   3:FAIL still not working
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
   | 3 | FAIL | still not validating |
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

   All {N} test items passed.

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

   ## Test History

   ### Session 1: {date}
   | # | Initial | Final | Fixes Applied |
   |---|---------|-------|---------------|
   | 1 | PASS | PASS | - |
   | 2 | PASS | PASS | - |
   | 3 | FAIL | PASS | Added email validation |
   | 4 | FAIL | PASS | Increased button padding |

   ## Tests Added
   - `tests/unit/contact-form.test.ts`

   ## Files Modified
   - `src/components/ContactForm.tsx` (line 23: validation)
   - `src/components/ContactForm.tsx` (line 45: button styles)
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
   - **contact-form** (FEATURE) -> user-auth
   ```
   Moves to:
   ```markdown
   ### DONE
   - **contact-form** (FEATURE) - Contact form with validation
   ```
   Note: In DONE section, dependency arrow `->` changes to description `-`

   **Output:**
   ```
   BACKLOG SYNCED

   Feature: {feature-name}
   Status: BLT -> DONE
   Progress: MVP {done}/{total} done
   ```

5. **Auto-commit changes:**
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

**Output:**
```
VERIFICATION COMPLETE

Feature: {feature-name}
Status: DONE
Items: {N}/{N} passing

Committed: test({feature}): verified

Next steps:
- Continue with next feature: /dev:define {next-feature}
- Or refine this feature: /dev:refine {feature-name}
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
├── 03-test-checklist.md  # Test checklist from build phase
└── 03-test-results.md    # NEW: Test history and results
```

## Example Session

```
User: /dev:test contact-form

Claude: TEST CHECKLIST: contact-form

        Open de app in je browser: http://localhost:5173
        Navigeer naar: /contact

        Voer deze tests uit:
        1. Vul alle velden correct in en submit
        2. Laat email leeg en submit
        3. Vul ongeldig email formaat in
        4. Check submit button state tijdens verzenden

        VERWACHT GEDRAG:
        - 1: Form submit succesvol, success message zichtbaar
        - 2: Error message "Email is required"
        - 3: Error message "Invalid email format"
        - 4: Button disabled + loading spinner

        Test de feature en rapporteer de resultaten.

User: 1:PASS
      2:FAIL no error shown
      3:PASS
      4:FAIL button stays enabled

Claude: FEEDBACK ANALYSIS

        PASSED: 2 items (1, 3)
        FAILED: 2 items (2, 4)

        | # | Issue | Type | Action |
        |---|-------|------|--------|
        | 2 | no error for empty email | TESTABLE | TDD fix loop |
        | 4 | button stays enabled | TESTABLE | TDD fix loop |

        -> Starting fix loop...

        GENERATING TEST for item 2
        Issue: No error message when email is empty

        [Creates contact-form.test.ts]
        [Runs test -> FAILS as expected]
        [Implements fix: adds validation check]
        [Runs test -> PASSES]

        GENERATING TEST for item 4
        Issue: Button not disabled during submit

        [Adds test case]
        [Runs test -> FAILS]
        [Implements fix: adds isSubmitting state]
        [Runs test -> PASSES]

        FIX LOOP COMPLETE

        | # | Type | Status |
        |---|------|--------|
        | 2 | TESTABLE | FIXED (test passes) |
        | 4 | TESTABLE | FIXED (test passes) |

        RE-TEST REQUIRED

        | # | Test | Change Made |
        |---|------|-------------|
        | 2 | Empty email validation | Added required check |
        | 4 | Button disabled state | Added isSubmitting state |

        Refresh de pagina en test opnieuw.

User: 2:PASS
      4:PASS

Claude: CONTACT-FORM COMPLETE!

        All 4 test items passed.

        Feature ready for integration.
        Committed: test(contact-form): verified
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
- Some things can't be unit tested (visual, timing, subjective)
- Make the change, document it
- Rely on human re-test

### Clarification for Subjective Issues
- Never guess what user means
- Ask specific options based on context
- Convert to TESTABLE or MEASURABLE before fixing

### Notifications
- Notify when fixes are ready for re-test
- Notify when verification is complete
- User may be away from terminal

### Minimal Re-test
- Only ask user to re-test fixed items
- Don't re-test items that already passed
- Respect user's time

## Restrictions

This skill must NEVER:
- Skip TDD for testable issues (concrete behavior described)
- Guess what subjective feedback means
- Apply fixes without documenting changes
- Mark complete if any items still failing
- Re-test items that already passed
- Skip clarification questions for vague feedback

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
