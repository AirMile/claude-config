---
name: team-test
description: Verify teammate code delivery. Checks completeness against task brief (feature.json) or backlog TODO, generates tests, maps results to requirements. Use with /team-test after teammate code delivery.
disable-model-invocation: true
metadata:
  author: mileszeilstra
  version: 2.0.0
  category: team
---

# Test — Teammate Verification

## Overview

Verify teammate code delivery. Detects available context (feature.json with requirements, backlog TODO with description, or just a branch diff), checks completeness where possible, generates and runs tests, and produces structured feedback.

**Trigger**: `/team-test` or `/team-test {feature-name}` or `/team-test {feature-name} {feedback}`

## When to Use

- After teammate delivers code on a feature (with or without `/dev-define`)
- When teammate pushes code for a backlog TODO item
- When teammate branch code needs verification before merge

**NOT for:**

- Testing own code (use `/dev-test`)
- Unit-level test writing during build (use `/dev-build`)

## Input Formats

```
# Auto-detect context (recommended)
/team-test

# Specific feature
/team-test user-registration

# Inline feedback (skips automation)
/team-test user-registration
1:PASS
2:FAIL no validation error
3:PASS
```

## Workflow

### FASE 0: Context Detection

1. **Get branch and project info:**

   ```bash
   git branch --show-current
   ```

2. **Capture git baseline** (voor scoped commit in FASE 7):

   ```bash
   mkdir -p .project/session
   git status --porcelain | sort > .project/session/pre-skill-status.txt
   ```

3. **Find context (in order of richness):**

   a. **feature.json** — if feature name given → `.project/features/{name}/feature.json`. Otherwise → scan `.project/features/*/feature.json` for features with status BLT, or with an assignee.

   b. **Backlog TODO** — if no feature.json found, check `.project/backlog.html` for a TODO/BLT item matching the feature name or branch name. Extract the item's description/title.

   c. **Nothing** — no feature.json, no backlog match.

4. **Determine mode:**

   | Condition                                          | Mode           | Description                                      |
   | -------------------------------------------------- | -------------- | ------------------------------------------------ |
   | feature.json exists with `requirements[]`          | `BRIEF_REVIEW` | Full brief available — completeness check + test |
   | No feature.json, but backlog TODO with description | `TODO_REVIEW`  | Backlog description as test basis                |
   | No feature.json, no backlog match                  | `BRANCH_ONLY`  | Git diff only — test what's visible              |

5. **Parse user input:**
   - Feature name only → proceed to FASE 0.5
   - Feature name + inline feedback → skip to FASE 4b (direct feedback, no automation)
   - Feature name + free text → skip to FASE 4b

6. **Output:**

   ```
   CONTEXT DETECTIE

   Modus:     {BRIEF_REVIEW | TODO_REVIEW | BRANCH_ONLY}
   Feature:   {name or branch name}
   Assignee:  {name or "geen"}
   Branch:    {branch}
   Context:   {feature.json | backlog TODO | git diff only}
   Status:    {backlog status: BLT/DONE/etc or "onbekend"}
   ```

   Use AskUserQuestion to confirm:
   - header: "Test Modus"
   - question: "Doorgaan met {mode} voor {feature}?"
   - options:
     - label: "Ja, doorgaan (Recommended)", description: "{mode description}"
     - label: "Andere feature", description: "Ik wil een andere feature testen"
     - label: "Annuleren", description: "Stop"
   - multiSelect: false

7. **Signal active feature** (na feature naam bepaald):

   ```bash
   echo '{"feature":"{feature-name}","skill":"team-test","startedAt":"{ISO timestamp}"}' > .project/session/active-{feature-name}.json
   ```

8. **Load stack & project context** (voor agent prompts):

   **Stack detectie:**
   - Lees CLAUDE.md `### Stack` sectie
   - Lees `.claude/research/stack-baseline.md` (als beschikbaar)
   - Fallback: detecteer uit package.json / go.mod / etc.

   **Project context:** Lees `.project/project.json` (als bestaat). Extract alleen:
   - `stack` (framework, language, testing, packages)
   - `context` (structure, routing, patterns)
   - `endpoints` (method, path, auth)
   - `data.entities` (names, fields, relations)

   Als project.json of stack-baseline niet bestaat → ga door zonder (backwards compatible).

   **Stel STACK_CONTEXT samen** (wordt meegegeven aan alle agents in deze skill):

   ```
   STACK CONTEXT:
   Framework: {stack.framework} ({stack.language})
   Testing: {stack testing info of stack-baseline testing conventions}
   Packages: {relevante packages}

   PROJECT CONTEXT:
   Structure: {context.structure of "niet beschikbaar"}
   Routing: {context.routing of "niet beschikbaar"}
   Patterns: {context.patterns of "niet beschikbaar"}
   Endpoints: {endpoints of "niet beschikbaar"}
   Entities: {data.entities of "niet beschikbaar"}
   ```

---

### FASE 0.5: Completeness Check

**Skip if:** `BRANCH_ONLY` mode (no context available).

Compare the code diff against the available context to verify completeness.

1. **Load context:**

   **`BRIEF_REVIEW`:** Load `.project/features/{feature-name}/feature.json`. Extract: `requirements[]`, `files[]`, `buildSequence[]`, `testStrategy[]`.

   **`TODO_REVIEW`:** Extract backlog item description/title. Parse into informal requirements (each distinct expectation from the description becomes a check item). No files[] or buildSequence[] available.

2. **Get relevant diff:**

   Filter commits by assignee name if known:

   ```bash
   git log --author="{assignee}" --oneline --since="2 weeks ago" -- .
   git diff $(git merge-base HEAD main)..HEAD
   ```

   Fallback if on main or no assignee: diff last N commits relevant to the feature.

3. **Spawn Explore agent** for completeness analysis:

   **For `BRIEF_REVIEW`:**

   ```
   Analyze the code diff against feature requirements.

   {STACK_CONTEXT}

   Requirements:
   {JSON of requirements[] from feature.json}

   Expected files:
   {JSON of files[] from feature.json}

   Build sequence:
   {JSON of buildSequence[] from feature.json}

   Git diff:
   {full diff output}

   For each requirement:
   - Is it implemented? (search for relevant code in the diff)
   - Are expected files created/modified?
   - Does it meet the acceptance criteria?

   Return structured output:
   COMPLETENESS_START
   | REQ | Description | Status | Evidence | Missing |
   |-----|------------|--------|----------|---------|
   | {id} | {description} | FOUND/MISSING/PARTIAL | {file:line or —} | {what's missing} |
   COMPLETENESS_END

   MISSING_FILES: {files from expected list not found in diff, comma-separated, or "none"}
   EXTRA_FILES: {files in diff not in expected list, comma-separated, or "none"}
   COVERAGE: {N}/{total} requirements found
   ```

   **For `TODO_REVIEW`:**

   ```
   Analyze the code diff against the backlog task description.

   {STACK_CONTEXT}

   Task: {backlog item title}
   Description: {backlog item description}

   Git diff:
   {full diff output}

   Parse the description into distinct expectations. For each:
   - Is it addressed in the code? (search for relevant implementation)
   - Is the implementation complete or partial?

   Return structured output:
   COMPLETENESS_START
   | # | Expectation | Status | Evidence | Missing |
   |---|------------|--------|----------|---------|
   | 1 | {parsed expectation} | FOUND/MISSING/PARTIAL | {file:line or —} | {what's missing} |
   COMPLETENESS_END

   COVERAGE: {N}/{total} expectations found
   ```

4. **Parse and display results:**

   ```
   COMPLETENESS CHECK: {feature-name}

   | #       | Beschrijving              | Status    | Bewijs              |
   |---------|--------------------------|-----------|---------------------|
   | REQ-001 | User kan inloggen        | ✓ FOUND   | src/auth/login.ts   |
   | REQ-002 | Validatie op email       | ~ PARTIAL | src/auth/login.ts   |
   | REQ-003 | Rate limiting            | ✗ MISSING | —                   |

   Dekking: {N}/{total} ({percentage}%)
   {BRIEF_REVIEW only:} Ontbrekende bestanden: {list or "geen"}
   {BRIEF_REVIEW only:} Extra bestanden: {list or "geen"}
   ```

5. **If coverage < 100%:**

   Use AskUserQuestion:
   - header: "Incomplete"
   - question: "{N} items niet (volledig) gevonden. Wat wil je doen?"
   - options:
     - label: "Toch doorgaan (Recommended)", description: "Test wat er WEL is, rapporteer ontbrekende items"
     - label: "Terugkoppelen", description: "Genereer feedback voor teammate, stop testing"
     - label: "Annuleren", description: "Stop"
   - multiSelect: false

   If "Terugkoppelen" → skip to FASE 7 (generate feedback with completeness results).

---

### FASE 1: Research via Agents (parallel)

**Goal:** Research test strategies. Unchanged from current skill, with additions.

1. Check if project has existing test infrastructure and patterns.
2. Spawn 3 parallel research agents. Include `{STACK_CONTEXT}` in all agent prompts:

   ```
   Agent(subagent_type="test-research-unit", prompt="{STACK_CONTEXT}\n...")
   Agent(subagent_type="test-research-integration", prompt="{STACK_CONTEXT}\n...")
   Agent(subagent_type="test-research-manual", prompt="{STACK_CONTEXT}\n...")
   ```

   **Addition for `BRIEF_REVIEW`:** Include `testStrategy[]` and `requirements[]` from feature.json in agent prompts. This gives agents concrete test targets instead of just raw diff analysis.

   **Addition for `TODO_REVIEW`:** Include backlog description and parsed expectations from FASE 0.5 in agent prompts.

3. Collect results.

   ```
   RESEARCH COMPLETE

   Unit strategies: {summary}
   Integration strategies: {summary}
   Manual strategies: {summary}
   ```

---

### FASE 2: Scenario Generation (parallel)

**Goal:** Generate test scenarios based on diff + research + requirements.

Spawn 3 parallel generation agents. Include `{STACK_CONTEXT}` in all agent prompts:

```
Agent(subagent_type="test-generate-happy-path", prompt="{STACK_CONTEXT}\n...")
Agent(subagent_type="test-generate-edge-cases", prompt="{STACK_CONTEXT}\n...")
Agent(subagent_type="test-generate-integration", prompt="{STACK_CONTEXT}\n...")
```

**Addition for `BRIEF_REVIEW`:** Each agent receives requirements[] and completeness results. Agent prompts include:

```
Requirements to cover:
{list of FOUND requirements with acceptance criteria}

Do NOT generate scenarios for MISSING requirements (they are not implemented).
Map each scenario to a requirement ID (REQ-001, REQ-002, etc).
```

**Addition for `TODO_REVIEW`:** Each agent receives parsed expectations and completeness results. Agent prompts include:

```
Expectations to cover:
{list of FOUND expectations from FASE 0.5}

Map each scenario to an expectation number (#1, #2, etc).
```

Output:

```
SCENARIOS GENERATED

Happy path: X scenarios
Edge cases: Y scenarios
Integration: Z scenarios

Total: N test scenarios
```

---

### FASE 3: Test Plan + Classification

**Goal:** Classify scenarios into AUTO/MANUAL, generate test data, set up dev server.

> **Classification criteria:** See `../dev-test/references/test-classification.md` for AUTO/BROWSER, AUTO/CLI, and MANUAL criteria with pattern tables.

1. **Generate test data** (via Explore agent — zero source file reads in main context):

   ```
   Feature: {feature-name}
   Scenarios from FASE 2: {list of scenarios with requirement mapping}

   {STACK_CONTEXT}

   Lees de source code en zoek naar:
   - Form fields, validatie regels, API endpoints relevant voor de test items
   - Bestaande test files die hergebruikt kunnen worden
   - Test patterns passend bij de stack (bijv. Vitest voor React, PHPUnit voor Laravel)

   Geef terug als gestructureerd overzicht:
   FEATURE_CONTEXT_START
   Bestaande tests: {pad naar test files, of "geen"}
   Per scenario:
   - Item {N}: {title}
     Testdata: {concrete waarden}
     Verwacht: {expected outcome}
     Aanbevolen methode: BROWSER | CLI | MANUAL
     Reden: {waarom deze methode}
   FEATURE_CONTEXT_END
   ```

2. **Classify each scenario** using `test-classification.md` criteria:

   ```
   TEST CLASSIFICATIE: {feature-name}

   | # | Test                     | Type         | Requirement | Reden                              |
   |---|--------------------------|--------------|-------------|------------------------------------|
   | 1 | Register with valid data | AUTO/BROWSER | REQ-001     | DOM: redirect + welkomst zichtbaar |
   | 2 | Without email            | AUTO/BROWSER | REQ-002     | DOM: foutmelding zichtbaar         |
   | 3 | Welcome mail sent        | MANUAL       | REQ-004     | Email verificatie niet via DOM     |

   AUTO: {n} (BROWSER: {n}, CLI: {n})  MANUAL: {n}
   ```

3. **User override:**

   Use AskUserQuestion:
   - header: "Test Plan"
   - question: "Doorgaan met test uitvoering?"
   - options:
     - label: "Ja, voer tests uit (Recommended)", description: "Start automated tests, daarna manual"
     - label: "Alleen automated", description: "Skip manual tests"
     - label: "Alles handmatig", description: "Sla automatische tests over"
     - label: "Annuleren", description: "Stop"
   - multiSelect: false

4. **Dev server + Cloudflare Tunnel:**

   Always start dev server + tunnel — needed for both AUTO and MANUAL items.

   a) Check for existing tunnel:

   ```bash
   grep -oE 'https://[a-z0-9-]+\.trycloudflare\.com' /tmp/cloudflared.log 2>/dev/null | head -1
   ```

   If found, verify it's live: `curl -s -o /dev/null -w "%{http_code}" {tunnel_url}`. If HTTP 200 and serves correct project → use it.

   b) No tunnel running — start dev server + tunnel (same process as `/dev-server`):

   ```bash
   # Detect framework from package.json and start
   # Wait for server ready
   for i in $(seq 1 15); do curl -s http://localhost:3000 > /dev/null 2>&1 && break || sleep 1; done

   # Start Cloudflare Tunnel
   cloudflared tunnel --url http://localhost:3000 > /tmp/cloudflared.log 2>&1 &
   sleep 8
   grep -oE 'https://[a-z0-9-]+\.trycloudflare\.com' /tmp/cloudflared.log | head -1
   ```

   c) If server or tunnel fails:

   ```
   ⚠ Dev server + tunnel niet gestart. Alle items worden MANUAL.
   ```

   Graceful fallback: reclassify ALL items as MANUAL, skip FASE 4.

---

### FASE 4: Automated Test Execution (Task Agent)

**When:** There are AUTO items after classification and dev server is confirmed running.

**Launch a Task agent** to execute all AUTO items in a separate context window. This prevents snapshot/screenshot data from consuming the main conversation context.

**Task agent prompt template:**

```
Test de volgende items automatisch via browser tools en bash commands.
Dev server: {url}
Feature: {feature-name}

{STACK_CONTEXT}

ITEMS:
{for each AUTO item:}
- Item {N}: {title} [Requirement: {REQ-ID}]
  Stappen: {test steps}
  Testdata: {test data from FASE 3}
  Verwacht: {expected outcome}
  Methode: {BROWSER of CLI}
  Patroon: {matching test pattern from test-classification.md}

INSTRUCTIES:
1. Navigeer naar de dev server URL en verifieer dat deze draait
2. Voor elk item:
   a. Voer de stappen uit met MCP browser tools of bash commands
   b. Analyseer het resultaat en bepaal PASS of FAIL met bewijs
3. Als een browser tool faalt voor een item, markeer als TOOL_ERROR

RESULTAAT FORMAT (strict):
AUTOMATED_RESULTS_START
| # | Test | Requirement | Resultaat | Bewijs | Redenering |
|---|------|-------------|-----------|--------|------------|
| {N} | {title} | {REQ-ID} | PASS/FAIL/TOOL_ERROR | {wat gezien} | {waarom pass/fail} |
AUTOMATED_RESULTS_END

FALLBACK_ITEMS: {items met TOOL_ERROR, komma-gescheiden nummers, of "geen"}
```

**Parse agent results:**

1. If TaskOutput contains `AUTOMATED_RESULTS_START` → parse directly
2. If truncated → use Grep to find markers in agent output file, Read with offset
3. TOOL_ERROR items → reclassify as MANUAL for FASE 5

Display:

```
AUTO TEST RESULTATEN: {feature-name}

| # | Test              | Requirement | Resultaat | Bewijs (kort)              |
|---|-------------------|-------------|-----------|----------------------------|
| 1 | Valid registration| REQ-001     | ✓ PASS    | /dashboard + welkomstmelding |
| 2 | Without email     | REQ-002     | ✗ FAIL    | Geen foutmelding zichtbaar |

AUTO PASS: {n}  AUTO FAIL: {n}  TOOL_ERROR → MANUAL: {n}
```

**If agent fails entirely:** Graceful fallback → reclassify all AUTO as MANUAL, proceed to FASE 5.

---

### FASE 4b: Parse Inline Feedback

**When:** User provided inline feedback via `/team-test {name} {feedback}` or free text.

Parse user feedback into structured results (item number, PASS/FAIL, notes). Accept both numbered format and free text. Map to requirements where possible.

After parsing, show summary and proceed to FASE 6 (skip FASE 4 + 5).

---

### FASE 5: Manual Test Execution (interactive)

**When:** There are MANUAL items (originally classified or reclassified from TOOL_ERROR fallback).

Show setup instructions once, then loop through each MANUAL item:

```
TEST SETUP: {feature-name}
Open {tunnel_url}
```

**For each MANUAL item:**

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
└─────────────┴──────────────────────┘

VERWACHT:
→ {exact expected outcome}

REQUIREMENT: {REQ-ID}: {description}
```

Use AskUserQuestion per item:

- header: "Test {n}/{total_manual}"
- question: "Resultaat van '{item title}'?"
- options:
  - label: "Pass (Recommended)", description: "Werkt zoals verwacht"
  - label: "Fail", description: "Werkt niet — ik geef details"
  - label: "Skip", description: "Kan niet testen, sla over"
- multiSelect: false

**If Pass** → record PASS, next item.
**If Fail** → ask for brief details (what happened instead?), record FAIL + notes, next item.
**If Skip** → record SKIP, next item.

---

### FASE 5b: Combined Results

Merge automated (FASE 4) and manual (FASE 5) results:

```
GECOMBINEERDE RESULTATEN: {feature-name}

| # | Test                  | Type   | Requirement | Resultaat              |
|---|-----------------------|--------|-------------|------------------------|
| 1 | Valid registration    | AUTO   | REQ-001     | ✓ PASS                |
| 2 | Without email         | AUTO   | REQ-002     | ✗ FAIL: geen error    |
| 3 | Welcome mail          | MANUAL | REQ-004     | ✗ FAIL: geen mail     |

AUTO PASS: {n}  AUTO FAIL: {n}
MANUAL PASS: {n}  MANUAL FAIL: {n}  SKIP: {n}
TOTAAL PASS: {n}  TOTAAL FAIL: {n}
```

---

### FASE 6: Results Report + Action Choice

**Goal:** Combined report with requirement coverage, then choose: feedback or fix.

```
TEST RESULTATEN: {feature-name}

REQUIREMENT DEKKING
| REQ     | Beschrijving         | In Code | Getest | Resultaat |
|---------|---------------------|---------|--------|-----------|
| REQ-001 | User kan inloggen   | ✓       | ✓      | PASS      |
| REQ-002 | Email validatie     | ✓       | ✓      | FAIL      |
| REQ-003 | Rate limiting       | ✗       | —      | MISSING   |
| REQ-004 | Welcome mail        | ✓       | ✓      | PASS      |

Totaal: {pass}/{total} PASS | {fail} FAIL | {missing} MISSING
```

**If all PASS + no MISSING** → skip action choice, proceed to FASE 7 (feedback = positief bericht).

**If any FAIL or MISSING:**

Use AskUserQuestion:

- header: "Actie"
- question: "Er zijn {fail} gefaalde en {missing} ontbrekende items. Wat wil je doen?"
- options:
  - label: "Terugkoppelen (Recommended)", description: "Genereer feedback voor teammate — zij fixen het zelf"
  - label: "Zelf fixen", description: "Fix de issues in hun code en stuur als werkend terug"
  - label: "Beide", description: "Fix wat kan, koppel de rest terug"
- multiSelect: false

**If "Terugkoppelen"** → proceed to FASE 7 (feedback).
**If "Zelf fixen"** → proceed to FASE 6c (fix loop for ALL failed items).
**If "Beide"** → proceed to FASE 6c (fix loop). After fixes, FASE 7 generates feedback for remaining MISSING/unfixed items.

---

### FASE 6c: Fix Loop

**When:** User chose "Zelf fixen" or "Beide" in FASE 6.

For each FAIL item, analyze and fix:

1. **Analyze root cause** — read relevant source files, understand what's wrong
2. **Apply fix** — edit the code directly
3. **Verify** — run the relevant test (AUTO items: re-run via Task agent or CLI, MANUAL items: ask user to re-check)

After each fix:

```
[FIX] Item {N}: {title} [{REQ-ID}]
Root cause: {what was wrong, file:line}
Fix: {what was changed and why}
Impact: {what this affects}
```

**Re-test after all fixes:**

- AUTO items that were fixed → re-run via Task agent (same approach as FASE 4)
- MANUAL items that were fixed → guided re-test (same approach as FASE 5)

Display re-test results:

```
RE-TEST RESULTATEN: {feature-name}

| # | Test              | Type   | Requirement | Resultaat |
|---|-------------------|--------|-------------|-----------|
| 2 | Without email     | AUTO   | REQ-002     | ✓ PASS   |
| 3 | Welcome mail      | MANUAL | REQ-004     | ✓ PASS   |

RE-TEST PASS: {n}  RE-TEST FAIL: {n}
```

**If items still failing after fix attempt:**

Use AskUserQuestion:

- header: "Fix Mislukt"
- question: "Item {N} werkt nog niet na fix. Wat wil je doen?"
- options:
  - label: "Nog een poging (Recommended)", description: "Probeer een andere fix strategie"
  - label: "Terugkoppelen", description: "Stuur als feedback naar teammate"
  - label: "Accepteren", description: "Markeer als bekend issue"
- multiSelect: false

Max 3 fix attempts per item before forcing fallback to feedback.

After fix loop completes → proceed to FASE 7.

---

### FASE 7: Update + Feedback

#### Step 1: Parallel Sync (feature.json + backlog + dashboard)

1. **Update feature.json** (`BRIEF_REVIEW` mode only, skip als niet bestaat):
   - `requirements[].status` → `"pass"` / `"fail"` / `"missing"` per requirement
   - Add/update `tests` section with session results
   - Update feature `status` if appropriate
   - NIET andere secties overschrijven

2. **Update backlog** (als `.project/backlog.html` bestaat, `BRIEF_REVIEW` of `TODO_REVIEW` mode):
   (zie `shared/BACKLOG.md` voor parse/write patroon)
   - Zoek feature in `data.features[]` op naam
   - All PASS + no MISSING → `.status = "DONE"`
   - Otherwise → `.status` blijft `"BLT"`
   - `data.updated` → huidige datum
   - Edit `backlog.html` (keep `<script>` tags intact)

3. **Update project.json** (als `.project/project.json` bestaat, `BRIEF_REVIEW` of `TODO_REVIEW` mode):
   (zie `shared/DASHBOARD.md`)
   - `features` array: zoek feature op naam, zet status naar `"DONE"` (all pass) of `"BLT"` (fails remaining)
   - `stack.packages`: merge als packages geïnstalleerd tijdens fix loop
   - `endpoints`: merge als gewijzigd tijdens fixes
   - `data.entities`: merge als gewijzigd tijdens fixes

   Schrijf parallel terug:
   - Write `feature.json` (als gewijzigd)
   - Edit `backlog.html` (keep `<script>` tags intact)
   - Write `project.json` (als gewijzigd)

4. **Scoped auto-commit** (only this skill's changes):

   Compare current git status with baseline from FASE 0:

   ```bash
   git status --porcelain | sort > /tmp/current-status.txt
   ```

   Categorize files by comparing with `.project/session/pre-skill-status.txt`:
   - **NEW** (only in current, not in baseline) → `git add` automatically
   - **OVERLAP** (in both baseline AND current) → warn user via AskUserQuestion: "These files had pre-existing uncommitted changes and were also modified by this skill: {list}. Include in commit?" Options: "Include (Recommended)" / "Skip"
   - **PRE-EXISTING** (only in baseline) → do NOT stage

   If baseline file doesn't exist, fall back to staging only known skill output files:

   ```bash
   git add .project/features/{feature-name}/feature.json .project/backlog.html .project/project.json
   ```

   ```bash
   git commit -m "test({feature}): {pass}/{total} requirements verified"
   ```

   **Cleanup:**

   ```bash
   rm -f .project/session/pre-skill-status.txt .project/session/active-{feature-name}.json /tmp/current-status.txt
   ```

   **IMPORTANT:** Do NOT add Co-Authored-By footer to pipeline commits.

#### Step 2: Teammate Feedback

**Skip if:** `BRANCH_ONLY` mode (no assignee context).
**Runs in:** `BRIEF_REVIEW` and `TODO_REVIEW` modes.

Generate structured feedback based on test results, completeness check, and any fixes applied.

**If all PASS (or all fixed):**

```
FEEDBACK VOOR {assignee}

Feature: {feature-name}
Status: ✓ Alles PASS

✓ Wat werkt:
{list of passing requirements/expectations with brief evidence}

{If fixes were applied:}
Fixes toegepast:
{numbered list of fixes with file:line references}

Klaar voor merge.
```

**If FAIL or MISSING items remain:**

```
FEEDBACK VOOR {assignee}

Feature: {feature-name}
Status: {pass}/{total} PASS

✓ Wat werkt:
{list of passing requirements with brief evidence}

✗ Issues:
{numbered list of failing/missing items with specific details:}
1. {REQ-ID} ({description}): {what's wrong or missing}
   Verwacht: {acceptance criteria}
   Gevonden: {what was found, or "niet geïmplementeerd"}

{If some items were fixed:}
✓ Al gefixt:
{list of fixes applied with file:line references}

Volgende stap: {concrete action items for remaining issues}
```

Use AskUserQuestion:

- header: "Feedback"
- question: "Feedback voor {assignee} gegenereerd. Wat wil je ermee doen?"
- options:
  - label: "Opslaan als bestand (Recommended)", description: "Sla op in .project/features/{feature}/feedback.md"
  - label: "Toon in chat", description: "Print feedback in conversatie (handmatig kopiëren)"
  - label: "Overslaan", description: "Geen actie"
- multiSelect: false

---

## Mode Comparison

| Aspect              | BRIEF_REVIEW     | TODO_REVIEW            | BRANCH_ONLY     |
| ------------------- | ---------------- | ---------------------- | --------------- |
| Context source      | feature.json     | backlog description    | git diff only   |
| Completeness check  | ✓ (requirements) | ✓ (parsed expects)     | ✗               |
| Research agents     | ✓                | ✓                      | ✓               |
| Scenario generation | ✓ (req-mapped)   | ✓ (expectation-mapped) | ✓ (diff-only)   |
| Classification      | ✓ (AUTO/MANUAL)  | ✓ (AUTO/MANUAL)        | ✓ (AUTO/MANUAL) |
| Task agent testing  | ✓                | ✓                      | ✓               |
| Manual walkthrough  | ✓ (guided)       | ✓ (guided)             | ✓ (guided)      |
| Coverage tracking   | ✓ (requirements) | ✓ (expectations)       | ✗               |
| Fix or feedback     | ✓ (keuze)        | ✓ (keuze)              | ✓ (keuze)       |
| Feature.json update | ✓                | ✗                      | ✗               |
| Teammate feedback   | ✓                | ✓                      | ✗               |
