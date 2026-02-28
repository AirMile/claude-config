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

**Trigger**: `/dev-test` or `/dev-test {feature-name}` or `/dev-test {feature-name} {feedback}`

## When to Use

- After `/dev-build` completes
- When `.project/features/{name}/feature.json` exists (with `tests.checklist[]`)
- NOT for: planning (/dev-define), implementation (/dev-build)

## Input Formats

```
# Format 1: Inline feedback (recommended — skips automation entirely)
/dev-test user-registration
1:PASS
2:FAIL no validation error
3:PASS
4:FAIL no mail sent

# Format 2: Feature name only (hybrid: auto + manual walkthrough)
/dev-test user-registration

# Format 3: Free text (skips automation entirely)
/dev-test user-registration
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
>
> **Code quality rules:** `../shared/RULES.md` — Algemeen (R007-R008) en TypeScript rules (T001-T103) bij fix loops.

## Workflow

### FASE 0: Load Context and Classify

1. **Read backlog for pipeline status:**

   Read `.project/backlog.html` (if exists), parse JSON uit `<script id="backlog-data">` blok (zie `shared/BACKLOG.md`):
   - Filter BLT features: `data.features.filter(f => f.status === "BLT")`
   - BLT features zijn klaar voor testing
   - If no feature name provided: suggest the next BLT feature via **AskUserQuestion**

2. **Parse user input:**
   - Feature name only → proceed to classification and hybrid testing
   - Feature name + inline feedback → skip to FASE 1b (backward compatible, no automation)
   - Feature name + free text → skip to FASE 1b (backward compatible, no automation)
   - "recent" → find most recently modified feature.json with `build` section

3. **Locate and validate build output:**

   ```
   .project/features/{feature-name}/feature.json
   ```

   Parse `tests.checklist[]` array. Each item has: `id`, `title`, `requirementId`, `steps[]`, `expected`, `status`.

   If `feature.json` not found or has no `tests.checklist` → exit with message to run `/dev-build {feature-name}` first.

4. **Read checklist** from `feature.json` → `tests.checklist` and use structured test items.

5. **Generate Test Data** (via Explore agent — zero source file reads in main context)

   **Always** use a Task agent (Explore) to gather test data. Never read source files directly in the main conversation.

   Launch Explore agent with prompt:

   ```
   Feature: {feature-name}
   Feature file: .project/features/{feature-name}/feature.json (tests.checklist[] + requirements[])

   Lees de feature.json (checklist + requirements). Zoek vervolgens in de source code naar:
   - Form fields, validatie regels, API endpoints relevant voor de test items
   - Bestaande test files die hergebruikt kunnen worden

   Geef terug als gestructureerd overzicht:
   FEATURE_CONTEXT_START
   Bestaande tests: {pad naar test files, of "geen"}
   Per test item:
   - Item {N}: {title}
     Testdata: {concrete waarden}
     Verwacht: {expected outcome}
     Aanbevolen methode: BROWSER | CLI
     Reden: {waarom deze methode}
   FEATURE_CONTEXT_END
   ```

   Parse the agent's structured output. This gives you test data and classification hints without consuming any main context on source file reads.

6. **Classify each test item**

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

7. **User override**

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

8. **Dev server + Cloudflare Tunnel** (uses same setup as `/dev-server`)

   Always start dev server + tunnel — needed for both AUTO and MANUAL items.

   **a) Check for existing tunnel:**

   ```bash
   grep -oE 'https://[a-z0-9-]+\.trycloudflare\.com' /tmp/cloudflared.log 2>/dev/null | head -1
   ```

   If a URL is found, verify it's live:

   ```bash
   curl -s -o /dev/null -w "%{http_code}" {tunnel_url}
   ```

   **If HTTP 200** → verify it serves the correct project: `curl -s {tunnel_url} | grep -i "{project-name}"`. If mismatch (e.g. tunnel serves a different project) → kill and restart tunnel for this project.

   **If verified** → tunnel running, use this URL, proceed to FASE 1.

   **b) No tunnel running — start dev server + tunnel:**

   **Vite projects:** Check if `server.allowedHosts` is set in vite.config. If not, temporarily add `allowedHosts: true` before starting (Vite 7+ blocks tunnel hostnames with 403). Revert after testing.

   Follow the same process as `/dev-server`:

   ```bash
   # Kill stale processes
   fuser -k 3000/tcp 2>/dev/null; pkill -f cloudflared 2>/dev/null
   sleep 1

   # Detect framework from package.json and start
   # Next.js: npx next dev --port 3000 &
   # Vite: npx vite --port 3000 --host &

   # Wait for server ready
   for i in $(seq 1 15); do curl -s http://localhost:3000 > /dev/null 2>&1 && break || sleep 1; done

   # Start Cloudflare Tunnel
   cloudflared tunnel --url http://localhost:3000 > /tmp/cloudflared.log 2>&1 &
   sleep 8
   grep -oE 'https://[a-z0-9-]+\.trycloudflare\.com' /tmp/cloudflared.log | head -1
   ```

   **c) If server or tunnel fails to start:**

   ```
   ⚠ Dev server + tunnel niet gestart. Alle items worden MANUAL.
   ```

   Graceful fallback: reclassify ALL items as MANUAL, skip FASE 1, proceed to FASE 2.

---

**Capture git baseline** (for scoped commit at end of skill):

```bash
mkdir -p .project/session
git status --porcelain | sort > .project/session/pre-skill-status.txt
```

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
   a. Voer de stappen uit met MCP browser tools of bestaande test suites via bash
   b. Analyseer het resultaat en bepaal PASS of FAIL met bewijs en redenering
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
   - Use **Grep** to find `AUTOMATED_RESULTS_START` in the agent's output file
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

**When:** User provided inline feedback via `/dev-test {name} {feedback}` or free text (skipping FASE 1 AND FASE 2 entirely — backward compatible).

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
{e.g. "Open {tunnel_url}" — use the Cloudflare tunnel URL from step 8}
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

**If 1+ SKIP items**, ask user to acknowledge:

Use **AskUserQuestion** tool:

- header: "Skipped Items"
- question: "Er zijn {n} overgeslagen items. Accepteer je dit?"
- options:
  - label: "Accepteren (Recommended)", description: "Overgeslagen items worden niet getest in deze sessie"
  - label: "Later testen", description: "Noteer als TODO voor een volgende test sessie"
- multiSelect: false

**If "Later testen"** → mark SKIP items with `TODO_RETEST` tag for FASE 6 summary.

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

Then apply TDD: test → red → fix → green. Max 3 attempts before asking user.

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

Use same Task agent approach as FASE 1. Include per item: title, fix summary, test steps, expected outcome. Use result markers `RETEST_RESULTS_START` / `RETEST_RESULTS_END`. Parse same as FASE 1 (including truncation handling). TOOL_ERROR items move to Phase B (manual re-test).

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

#### Step 1: Fix Sync (only when fixes were applied in FASE 4)

**Skip this step if all items passed on first attempt (no fixes needed).**

**1a) Claude summarizes** — per fix, in plain language:

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

Fix 1: Email validation missing
- Problem: Form submitted without validating email format
- Change: Added Zod email validation to registration schema (lib/validations/auth.ts:23)
- Approach: Used Zod's built-in .email() instead of regex — already used elsewhere in the project

Fix 2: Welcome mail not sent
- Problem: sendWelcomeMail() was called before user was saved to DB
- Change: Moved mail call to after successful DB insert (app/api/register/route.ts:45)
- Watch out: Mail sending is async — if it fails, the user IS registered but won't get the mail
```

**1b) Comprehension check** via AskUserQuestion:

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

**1c) Save fix sync** — store the summary for inclusion in `feature.json` (tests.fixSync field).

---

#### Step 2: Out-of-scope Observations (always — even without fixes)

The user was actively testing the feature and may have noticed issues outside the current scope. Capture these before closing out.

Use AskUserQuestion tool:

- header: "Observaties"
- question: "Is je tijdens het testen nog iets anders opgevallen buiten de scope van deze feature?"
- options:
  - label: "Nee, alles goed (Aanbevolen)", description: "Geen verdere opmerkingen"
  - label: "Ja, ik heb iets opgemerkt", description: "Ik wil iets noteren voor later"
- multiSelect: false

**If "Ja"** → ask the user to describe what they noticed (plain text, no modal). Record the observations for inclusion in `feature.json` (observations field). Do NOT attempt to fix these — they are out of scope.

After documenting, show confirmation:

```
OBSERVATIE GENOTEERD

Opgenomen in test results.
```

---

3. **Write feature.json** (read-modify-write):
   - Read `.project/features/{feature-name}/feature.json`
   - Update `status` → `"TST"` (of `"VERIFIED"` als alle items PASS)
   - Update `requirements[].status` → `"PASS"` / `"FAIL"` per REQ
   - Update `tests.checklist[].status` → `"PASS"` / `"FAIL"` / `"skip"` per item
   - Voeg/update `tests` sectie: `finalStatus`, `coverage`, `sessions[]`, `fixSync`
   - Voeg `observations[]` toe (indien aanwezig)
   - Write `feature.json` terug (NIET andere secties overschrijven)

4. **Sync backlog** (zie `shared/BACKLOG.md`):
   - Read `.project/backlog.html`, parse JSON uit `<script id="backlog-data">` blok
   - Zoek feature in `data.features`/`data.adhoc`, zet `.status = "TST"`
   - Zet `data.updated` naar huidige datum
   - Schrijf JSON terug via Edit tool (keep `<script>` tags intact)

5. **Dashboard sync** (zie `shared/DASHBOARD.md`):
   - Read `.project/project.json` (skip als niet bestaat)
   - Als packages geïnstalleerd tijdens fix loop: merge naar `stack.packages`
   - Als endpoints gewijzigd/toegevoegd: merge naar `endpoints`
   - Als data entities gewijzigd: merge naar `data.entities`
   - Update `features` array: zoek feature op naam, zet status naar `"TST"`
   - Write `.project/project.json`

6. **Scoped auto-commit** (only this skill's changes):

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
   test({feature}): verified - {N} items pass ({auto} auto, {manual} manual)

   Hybrid test verification complete.
   - Automated (browser + CLI): {auto_count} items
   - Manual walkthrough: {manual_count} items
   - Fixed: {list of fixes}
   - Tests added: {count}
   EOF
   )"
   ```

   Clean up: `rm -f .project/session/pre-skill-status.txt /tmp/current-status.txt`

   **IMPORTANT:** Do NOT add Co-Authored-By or Generated with Claude Code footer to pipeline commits.

---

## Output Structure

```
.project/features/{feature-name}/
└── feature.json           # Enriched: tests section, requirements[].status, observations
```

## Example Flow (compact)

```
/dev-test user-registration
→ FASE 0: Classify → 3 AUTO (2 browser, 1 CLI) + 1 MANUAL
→ FASE 0: User override → akkoord
→ FASE 0: Dev server check → tunnel running → https://xxx.trycloudflare.com → 200 OK
→ FASE 1: Task agent runs 3 AUTO items → 2 PASS, 1 FAIL (no error msg)
→ FASE 2: Manual walkthrough 1 item (welcome mail) → FAIL (no mail)
→ FASE 2b: Combined → 2 PASS, 2 FAIL
→ FASE 3: Categorize → item 2: TDD, item 4: Impl First
→ FASE 4: Fix loop → both fixed
→ FASE 5: Re-test → Task agent re-tests item 2 (PASS), manual re-test item 4 (PASS)
→ FASE 6: All 4 pass → commit test(user-registration): verified
```
