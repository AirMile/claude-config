---
name: dev-test
description: Hybrid test verification (automated + manual + fix loops) for built features. Use with /dev-test after /dev-build.
disable-model-invocation: true
metadata:
  author: mileszeilstra
  version: 1.3.0
  category: dev
---

# Test

Test phase: define → build → **test**

Hybrid verification: automated (browser/CLI) + manual walkthrough + issue categorization + fix loops.

**Trigger**: `/dev-test {feature-name}` or `/dev-test {feature-name} {feedback}`

## Input Formats

```
/dev-test user-registration                              # hybrid: auto + manual
/dev-test user-registration 1:PASS 2:FAIL no validation  # inline feedback (skips automation)
/dev-test user-registration Everything works except...    # free text (skips automation)
```

## Feedback Categorization

| Type           | Example                      | Action                           |
| -------------- | ---------------------------- | -------------------------------- |
| **TESTABLE**   | "returns 500 instead of 422" | TDD or Implementation First      |
| **MEASURABLE** | "response too slow"          | Direct fix                       |
| **SUBJECTIVE** | "doesn't feel right"         | Ask for specifics, re-categorize |

> Classification criteria: `references/test-classification.md`
> Code quality rules: `../shared/RULES.md` (R007-R008)

## Workflow

### FASE 0: Load Context and Classify

1. **Read backlog** — `.project/backlog.html`, parse JSON uit `<script id="backlog-data">` (zie `shared/BACKLOG.md`). Filter `status === "DOING" && stage === "built"`. Geen feature name → suggest via AskUserQuestion.

2. **Parse input:**
   - Feature name only → proceed to classification
   - Feature name + inline feedback → skip to FASE 1b
   - Feature name + free text → skip to FASE 1b

3. **Validate build output** — `.project/features/{feature-name}/feature.json`. Parse `tests.checklist[]`. Geen checklist → exit: run `/dev-build` first.

4. **Tag backlog + capture baseline:**
   - Backlog: zet `stage: "testing"`, feature `updated` → nu (Edit, keep `<script>` tags intact)
   - Git baseline: `mkdir -p .project/session && git status --porcelain | sort > .project/session/pre-skill-status.txt`
   - Session file: `echo '{"feature":"{name}","skill":"test","startedAt":"{ISO}"}' > .project/session/active-{name}.json`

5. **Load stack & project context** — CLAUDE.md stack sectie + `.project/project.json` (stack, endpoints, data) + `.project/project-context.json` (context, architecture). Stel STACK_CONTEXT samen:

   ```
   STACK CONTEXT:
   Framework: {framework} ({language})
   Testing: {testing info}
   Packages: {relevante packages}

   PROJECT CONTEXT:
   Structure: {context.structure of "niet beschikbaar"}
   Routing: {context.routing of "niet beschikbaar"}
   Patterns: {context.patterns of "niet beschikbaar"}
   Endpoints: {endpoints of "niet beschikbaar"}
   Entities: {data.entities of "niet beschikbaar"}
   ```

6. **Gather test data** via Explore agent (zero source file reads in main context):

   ```
   Feature: {feature-name}
   Feature file: .project/features/{feature-name}/feature.json

   {STACK_CONTEXT}

   Lees feature.json (checklist + requirements + build sectie). Zoek in source code naar:
   - Validatie regels, API endpoints relevant voor test items
   - Bestaande test files en test patterns

   Geef terug als:
   FEATURE_CONTEXT_START
   Bestaande tests: {paden, of "geen"}
   Per test item:
   - Item {N}: {title}
     Testdata: {concrete waarden}
     Verwacht: {expected outcome}
     Aanbevolen methode: BROWSER | CLI
     Reden: {waarom}
     Al gedekt: {wat build tests verifiëren}
     httpContractTested: true/false (test de build test het HTTP/functie contract?)
     delta: {extra verificatie nodig bovenop build tests, of "geen"}
   FEATURE_CONTEXT_END
   ```

7. **Classify and plan test execution:**

   a) Baseline check: `npm test 2>&1 | tail -20` (of project-specifiek command).
   Display: `BASELINE: npm test → {PASS|FAIL} ({n}/{n})`

   b) Detect post-build mode:

   ```
   postBuildMode = true
   hasUI = feature.json heeft "design" veld OF files[] bevat frontend bestanden (.tsx, .vue, .svelte)
   isPureAPI = feature.json heeft "apiContract" EN NIET hasUI
   ```

   Display:

   ```
   POST-BUILD DETECTIE: {testsTotal} bestaande tests ({tdd} TDD, {implFirst} impl-first)
   Strategie: {hasUI → "E2E browser verificatie" | isPureAPI → "API integratie" | else → "Integratie verificatie"}
   Baseline: bestaande test suite als pre-check
   ```

   c) Cross-requirement integratie — Analyseer `requirements[]`, identificeer combinaties waar output van één requirement input is voor een andere. Max 3 scenario's, voeg toe als extra test items (niet gepersisteerd naar feature.json checklist). Geen logische combinaties → skip.

   d) Per item, gebruik Explore agent output:
   - `httpContractTested: true` + `delta: "geen"` → **COVERED**
   - `httpContractTested: true` + delta → **AUTO/CLI** of **AUTO/BROWSER** (alleen delta)
   - `httpContractTested: false` → classificeer op steps/hasUI/isPureAPI per `references/test-classification.md`
   - Integratie-scenario's → altijd **AUTO** (nooit COVERED)

   e) Display classificatie tabel met Type kolom (COVERED/AUTO/MANUAL) + reden.
   Samenvattingsregel: `COVERED: {n}  AUTO: {n} (BROWSER: {n}, CLI: {n})  MANUAL: {n}`

   f) Bij gemixte types (COVERED + AUTO + MANUAL): toon ASCII flowchart van de test executie flow. Bij alleen COVERED + AUTO/CLI: skip flowchart.

   g) Proceed automatically with the recommended classification. No user approval needed — continue directly to step 8 (dev server) or FASE 1.

8. **Dev server** (conditioneel):

   ```
   Alle non-COVERED items AUTO/CLI (in-process testbaar) → skip dev server entirely
   MANUAL of AUTO/BROWSER items                          → start via /dev-server proces (tunnel nodig)
   AUTO/CLI met live server vereist                      → start op localhost (zonder tunnel)
   ```

   Bij falen → graceful fallback: alle items worden MANUAL, skip FASE 1.

---

### FASE 1: Automated Testing

**Skip** als alle AUTO items COVERED zijn.

Launch Agent om non-COVERED AUTO items uit te voeren in apart context window.

**AUTO/CLI aanpak keuze** (agent bepaalt op basis van feature type):

- **Pure API / service feature**: schrijf integration test file (node:test / vitest) met mock dependencies en echte DB (mongodb-memory-server). Test via service layer, niet HTTP.
- **Feature met running server vereist**: curl commands tegen dev server.
- **Build/lint verificatie**: directe bash commands.

Agent prompt:

```
Test de volgende items automatisch via browser tools, bash commands, of integration tests.
Feature: {feature-name}
{IF dev server draait: Dev server: {url}}

{STACK_CONTEXT}

ITEMS:
{per AUTO item:}
- Item {N}: {title}
  Stappen: {test steps}
  Testdata: {test data}
  Verwacht: {expected outcome}
  Methode: {BROWSER of CLI}

INSTRUCTIES:
1. Voer stappen uit met MCP browser tools, bash commands, of schrijf een integration test file
2. Voor CLI items zonder running server: schrijf een integration test (test/integration/{feature}.integration.test.js) die de service/functie direct test met mock dependencies en echte DB
3. Bepaal PASS/FAIL met bewijs en redenering
4. Browser tool faalt → markeer als TOOL_ERROR

POST-BUILD: baseline al GREEN. Focus op INTEGRATIE, niet unit logica.
Draai NIET opnieuw npm test.

RESULTAAT FORMAT:
AUTOMATED_RESULTS_START
| # | Test | Resultaat | Bewijs | Redenering |
|---|------|-----------|--------|------------|
AUTOMATED_RESULTS_END

FALLBACK_ITEMS: {TOOL_ERROR items, of "geen"}
```

**Parse resultaten:** als output truncated is (geen markers zichtbaar), gebruik Grep om `AUTOMATED_RESULTS_START` te vinden in agent output. TOOL_ERROR items → reclassify als MANUAL.

**Agent faalt volledig:** graceful fallback → alle AUTO items worden MANUAL.

Display: `AUTO PASS: {n}  AUTO FAIL: {n}  TOOL_ERROR → MANUAL: {n}`

---

### FASE 1b: Parse Inline Feedback

**Wanneer:** user gaf feedback mee bij `/dev-test {name} {feedback}` (skipt FASE 1 + 2).

Parse naar item/PASS/FAIL/notes. Accepteer `1:PASS 2:FAIL note` en vrije tekst.
Toon samenvatting, ga naar FASE 3.

Onduidelijke feedback → AskUserQuestion: Opnieuw invoeren (Aanbevolen) | Per item doorgaan | Uitleg.

---

### FASE 2: Manual Walkthrough

**Wanneer:** er zijn MANUAL items.

Toon setup eenmalig (bijv. "Open {tunnel_url}"). Per MANUAL item:

```
──────────────────────────────────────
HANDMATIG TEST {n}/{total}: {title}
──────────────────────────────────────

STAPPEN:
1. {concrete actie met data}

TESTDATA:
{tabel met velden + waarden}

VERWACHT:
→ {expected outcome}
```

AskUserQuestion per item: Pass (Aanbevolen) | Fail | Skip.

- Fail → vraag kort wat er mis ging
- Skip → noteer reden

---

### FASE 2b: Combined Results

Merge COVERED + automated + manual resultaten.

**Compact** (postBuildMode + alle PASS + COVERED items):

```
TEST RESULTAAT: {feature-name} (POST-BUILD)

BASELINE: npm test → PASS ({n}/{n})
COVERED: {n} items (build tests dekken contract)
INTEGRATIE: {n} scenario's → {n} PASS
TOTAAL: {n}/{n} PASS

Geen fixes nodig.
```

**Volledige tabel** (bij FAILs of geen COVERED):

```
GECOMBINEERDE RESULTATEN: {feature-name}

| # | Test | Type | Resultaat |
|---|----- |------|-----------|
```

Bij AUTO FAILs → AskUserQuestion: Vertrouw auto resultaten (Aanbevolen) | Handmatig controleren.
Bij SKIPs → AskUserQuestion: Accepteren (Aanbevolen) | Later testen.

Alle PASS → FASE 6. FAILs → FASE 3.

---

### FASE 3: Categorize Issues

Per FAIL: categoriseer als TESTABLE/MEASURABLE/SUBJECTIVE (zie tabel hierboven).
SUBJECTIVE → AskUserQuestion voor verduidelijking, dan re-categoriseer.

Technique mapping voor TESTABLE:

- Validatie, business logic, edge cases, race conditions → **TDD**
- CRUD wiring, config, imports, routing → **Implementation First**
- Default → TDD

Display technique map:

```
| Item | Issue | Type | Technique | Reason |
```

---

### FASE 4: Fix Loop

#### TDD Fix

Complexe issues → AskUserQuestion: Research via Context7 (Aanbevolen) | Direct fixen.

TDD: test → red → fix → green. Max 3 pogingen, daarna vraag user.

```
[FIX] Item {N}: {title}
Technique: TDD | Type: {AUTO|MANUAL}
RED: FAIL ({wat})  GREEN: PASS
SYNC: Root cause: {file:line}. Fix: {aanpak}. Impact: {scope}.
```

Test slaagt al → AskUserQuestion: Overslaan (Aanbevolen) | Test aanpassen | Handmatig checken.

#### Implementation First Fix

Fix → schrijf test → verify PASS. Max 3 pogingen.

```
[FIX] Item {N}: {title}
Technique: Implementation First | Type: {AUTO|MANUAL}
IMPLEMENTED: {wat}  TESTED: PASS
SYNC: Root cause: {file:line}. Fix: {aanpak}. Impact: {scope}.
```

#### MEASURABLE: Direct Fix

Fix direct (config, styling, timing). Needs manual re-test.

```
[FIX] Item {N}: {title}
Technique: Direct Fix | Type: {AUTO|MANUAL}
SYNC: Root cause: {file:line}. Fix: {aanpak}. Impact: {scope}.
```

---

### FASE 5: Re-test

Re-test ALLEEN gefixte items.

**Phase A: Auto** — fixed AUTO items via Agent (zelfde aanpak als FASE 1, markers `RETEST_RESULTS_START`/`RETEST_RESULTS_END`). TOOL_ERROR → Phase B.

**Phase B: Manual** — fixed MANUAL items via walkthrough. Toon WIJZIGING (fix summary) + originele stappen.

Display re-test resultaten.

### FASE 5b: Re-test Loop

Alles pass → FASE 5c.

Items falen nog → AskUserQuestion: Meer details (Aanbevolen) | Andere aanpak | Accepteren | Zelf fixen.
Loop terug naar FASE 3. AUTO items → re-run in FASE 5A. MANUAL items → re-test in FASE 5B.

---

### FASE 5c: Regression Check

**Skip when:**

- Geen fixes toegepast in FASE 4
- Geen eerder-PASS AUTO items in FASE 2b
- Alle fixes waren MANUAL-only (config/styling)

Draai alle eerder-PASS AUTO items opnieuw via Agent (zelfde aanpak als FASE 1).

```
REGRESSION CHECK: {feature-name}

| # | Test               | Was    | Nu     |
|---|--------------------|--------|--------|
| 1 | Route rendering    | ✓ PASS | ✓ PASS |
| 3 | Form validation    | ✓ PASS | ✗ FAIL |

Regressies: {n} | Stabiel: {n}
```

**Geen regressies:** Door naar FASE 6.

**Regressies:** Toon en bied keuze via AskUserQuestion: Fixen (Aanbevolen) | Accepteren. Bij fixen → terug naar FASE 4 voor alleen de regressie-items. Herhaal FASE 5c NIET na regressie-fix (max 1 pass).

---

### FASE 6: Completion

#### Step 1: Fix Sync (skip als geen fixes)

Per fix in plain language:

```
Fix {N}: {title}
- Problem: {wat}
- Change: {file:line}
- Watch out: {alleen als relevant}
```

AskUserQuestion: Ja, helder (Aanbevolen) | Leg meer uit | Ik heb een vraag. Loop tot helder.

Sla fix sync op voor `feature.json` (tests.fixSync).

#### Step 2: Observaties

AskUserQuestion: Nee, alles goed (Aanbevolen) | Ja, ik heb iets opgemerkt.
"Ja" → vraag beschrijving, noteer voor feature.json (observations[]).

#### Step 3: 3-File Sync

Skill-specifieke mutaties:

**feature.json:**

- `status` → `"DONE"`
- `requirements[].status` → `"PASS"` / `"FAIL"` per REQ
- `tests.checklist[].status` → `"PASS"` / `"FAIL"` / `"skip"` per item
- `tests.finalStatus` → `"PASSED"` of `"FAILED"`
- `tests.sessions[]` → append `{ "date": "YYYY-MM-DD", "pass": N, "fail": N, "skip": N }`
- `tests.fixSync` → fix summaries (als fixes toegepast)
- `observations[]` → toevoegen (indien aanwezig)

**backlog:** `status = "DONE"`, verwijder `stage`.

**project-context.json**: Bij fixes in FASE 4: update `architecture.components[]` — merge gewijzigde bestanden naar component `src`/`test`, bevestig `status: "done"`, voeg test files toe.

#### Step 3b: Learning Extraction

Extracteer projectbrede learnings uit de voltooide feature. Lees de zojuist geschreven `feature.json` en evalueer:

- `build.decisions[]` → type `pattern` (architecturale keuzes die andere features beïnvloeden)
- `tests.fixSync[]` → type `pitfall` (bugs met root causes)
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

Check op duplicaten (zelfde feature + zelfde summary → skip). Geen learnings gevonden → skip stap.

#### Step 4: Scoped commit

Vergelijk `git status --porcelain | sort` met `.project/session/pre-skill-status.txt`:

- **NEW** (alleen in current) → `git add -f` (`.project/` is gitignored, `-f` vereist)
- **OVERLAP** (in beide, gewijzigd door deze skill) → `git add -f`
- **PRE-EXISTING** (alleen in baseline, of overlap niet door deze skill gewijzigd) → niet stagen

Baseline niet gevonden → fallback `git add -A`.

```bash
git commit -m "test({feature}): {N} requirements verified ({auto} auto, {manual} manual)

Hybrid test verification complete.
- Covered: {covered} | Auto: {auto} | Manual: {manual}
- Fixed: {list} | Tests added: {count}"
```

Clean up: `rm -f .project/session/pre-skill-status.txt .project/session/active-{name}.json`

---

## Example Flows

```
# Pure API (fast path)
/dev-test api-routes
→ FASE 0: 6 COVERED + 3 integratie AUTO/CLI → dev server skip
→ FASE 1: 3 integratie → 3 PASS (integration test file geschreven)
→ FASE 2b: Compact → 9/9 PASS
→ FASE 6: commit

# UI feature met fixes
/dev-test user-registration
→ FASE 0: 2 COVERED + 1 AUTO/BROWSER + 1 MANUAL → tunnel
→ FASE 1: AUTO/BROWSER → FAIL
→ FASE 2: Manual → FAIL
→ FASE 3-4: TDD + Impl First fixes
→ FASE 5: Re-test → all PASS
→ FASE 6: Fix sync + commit
```
