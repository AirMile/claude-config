---
name: dev-verify
description: Adversarial verification — acceptance tests + fix loops. After verify, the code is good. Use with /dev-verify after /dev-build.
disable-model-invocation: true
metadata:
  author: mileszeilstra
  version: 2.0.0
  category: dev
---

# Verify

Verify phase: define → build → **verify**

Adversarial evaluator: schrijft acceptance tests vanuit spec, runt ze, fixt issues. Na verify is de feature klaar.

**Trigger**: `/dev-verify {feature-name}` or `/dev-verify {feature-name} {feedback}`

## Input Formats

```
/dev-verify user-registration                              # hybrid: auto + manual
/dev-verify user-registration 1:PASS 2:FAIL no validation  # inline feedback (skips automation)
/dev-verify user-registration Everything works except...    # free text (skips automation)
```

## Feedback Categorization

| Type           | Example                         | Action                           |
| -------------- | ------------------------------- | -------------------------------- |
| **SPEC**       | "toont max 3, spec zegt 'alle'" | Implementation First + test      |
| **TESTABLE**   | "returns 500 instead of 422"    | TDD or Implementation First      |
| **MEASURABLE** | "response too slow"             | Direct fix                       |
| **SUBJECTIVE** | "doesn't feel right"            | Ask for specifics, re-categorize |

> Classification criteria: `references/test-classification.md`
> Code quality rules: `../shared/RULES.md` (R007-R008)

## Workflow

### FASE 0: Load Context and Classify

1. **Read backlog** — `.project/backlog.html`, parse JSON uit `<script id="backlog-data">` (zie `shared/BACKLOG.md`). Filter `status === "DOING" && stage === "built"`. Geen feature name → suggest via AskUserQuestion.

2. **Timing** (na feature laden):

   AskUserQuestion:

   ```yaml
   header: "Timing"
   question: "Wanneer wil je deze verify uitvoeren?"
   options:
     - label: "Nu (Recommended)"
     - label: "Over 1 uur"
     - label: "Over 3 uur"
     - label: "Over 6 uur"
     - label: "Specifieke tijd"
       description: "Bijv. 01:00, 14:30"
   multiSelect: false
   ```

   "Specifieke tijd" → follow-up AskUserQuestion: "Hoe laat? (HH:MM, CET)"

   Bij elke "later" keuze:
   1. Bereken sleep seconds:
      ```bash
      # "Over X uur":
      SLEEP_SECONDS=$((X * 3600))
      # "Specifieke tijd":
      TARGET=$(TZ="Europe/Amsterdam" date -d "{HH:MM}" +%s)
      NOW=$(date +%s)
      SLEEP_SECONDS=$((TARGET - NOW))
      if [ $SLEEP_SECONDS -lt 0 ]; then
        TARGET=$(TZ="Europe/Amsterdam" date -d "tomorrow {HH:MM}" +%s)
        SLEEP_SECONDS=$((TARGET - NOW))
      fi
      ```
   2. Display: `INGEPLAND: verify {feature} om {tijd CET}. Sleep tot dan...`
   3. `Bash: sleep {SLEEP_SECONDS}`
   4. Na wake-up: **AUTO_MODE actief** voor de rest van de skill.

   **Auto-mode** (actief bij "later" timing keuze):

   Alle AskUserQuestions worden overgeslagen met deze defaults:

   | Beslispunt              | Default                             | Reden                     |
   | ----------------------- | ----------------------------------- | ------------------------- |
   | MANUAL test items       | **Skip, markeer MANUAL_PENDING**    | Geen mens achter browser  |
   | AUTO FAILs vertrouwen   | **Ja**                              | Evidence-based resultaten |
   | SKIPs accepteren        | **Accepteren**                      | Al geclassificeerd        |
   | Fix research (Context7) | **Direct fixen**                    | Sneller, adequaat         |
   | Test slaagt al          | **Overslaan**                       | Al groen                  |
   | Re-test loop fails      | **Max 3 pogingen, dan stoppen**     | Voorkom oneindige loop    |
   | Regression fixes        | **Fixen**                           | Standaard aanbeveling     |
   | Ongedekte requirements  | **Test toevoegen**                  | Maximaliseer coverage     |
   | Fix sync helder?        | **Skip, schrijf naar feature.json** | Geen gebruiker            |
   | Observaties             | **Nee**                             | Geen user input mogelijk  |

   **MANUAL_PENDING afhandeling:**
   - MANUAL items krijgen status `MANUAL_PENDING` in `tests.checklist[]`
   - Feature gaat NIET naar DONE — blijft op `stage: "built"`
   - `tests.manualPending: ["Item N: {title}", ...]` in feature.json
   - Backlog status blijft DOING

   Auto-result naar `.project/session/auto-result-{feature}.json`:
   - Volledige PASS: `{"feature": "{name}", "status": "VERIFIED", "pass": N, "total": N, "timestamp": "{ISO}"}`
   - Met MANUAL_PENDING: `{"feature": "{name}", "status": "PARTIAL", "autoPass": N, "manualPending": N, "timestamp": "{ISO}"}`
   - Blocker: `{"feature": "{name}", "status": "BLOCKED", "reason": "...", "timestamp": "{ISO}"}`

3. **Parse input:**
   - Feature name only → proceed to classification
   - Feature name + inline feedback → skip to FASE 1b
   - Feature name + free text → skip to FASE 1b

4. **Validate build output** — `.project/features/{feature-name}/feature.json`. Parse `tests.checklist[]`. Geen checklist → exit: run `/dev-build` first.

5. **Tag backlog + capture baseline:**
   - Backlog: zet `stage: "verifying"`, feature `updated` → nu (Edit, keep `<script>` tags intact)
   - Git baseline: `mkdir -p .project/session && git status --porcelain | sort > .project/session/pre-skill-status.txt`
   - Session file: `echo '{"feature":"{name}","skill":"test","startedAt":"{ISO}"}' > .project/session/active-{name}.json`

6. **Load stack & project context** — CLAUDE.md stack sectie + `.project/project.json` (stack, endpoints, data) + `.project/project-context.json` (context, architecture). Stel STACK_CONTEXT samen:

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

7. **Gather test data** via Explore agent op **Sonnet** (`model: "sonnet"`) — zero source file reads in main context:

   ```
   Feature: {feature-name}
   Feature file: .project/features/{feature-name}/feature.json

   {STACK_CONTEXT}

   Lees feature.json (checklist + requirements + build sectie). Zoek in source code naar:
   - Validatie regels, API endpoints relevant voor test items
   - Bestaande test files en test patterns
   - Per requirement (id + acceptance criteria): lees de source files die dit REQ implementeren
     (feature.json files[] waar requirements het REQ-ID bevat).
     Bepaal welke acceptance test(s) dit criterium zouden verifiëren.
     Let op: acceptance criteria bevatten vaak meerdere condities in één zin
     (bijv. "201 bij succes, 400 bij >5, 409 bij duplicate" = 3 tests).

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
     acceptanceTests: [
       { scenario: "{test beschrijving}", method: "CLI", expected: "{verwacht}" }
     ]
   FEATURE_CONTEXT_END
   ```

8. **Classify and plan test execution:**

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

   g) Proceed automatically with the recommended classification. No user approval needed — continue directly to step 7h.

   h) **Goal-backward verificatie + acceptance test planning:**

   Map tests terug naar acceptance criteria en plan acceptance tests voor gaps in één stap:

   | REQ   | Acceptance Criterion                    | Test Items  | Dekking | Acceptance Tests |
   | ----- | --------------------------------------- | ----------- | ------- | ---------------- |
   | REQ-1 | POST 201, 400 bij >5, 409 bij duplicate | unit: model | GAP     | 3 CLI tests      |
   | REQ-2 | GET retourneert array, seeded defaults  | unit: seed  | GAP     | 2 CLI tests      |
   | REQ-3 | Modal sluit bij klik buiten             | Item 2      | ✓       | —                |

   **GAP**: requirement waar builder's tests het acceptance criterium niet dekken (test verifieert interne methods/data structures i.p.v. het criterium zelf).

   Per GAP met CLI-testbare acceptance tests (uit Explore agent `acceptanceTests[]`): voeg toe aan AUTO/CLI queue (FASE 1) met `source: "acceptance"` markering.
   BROWSER en MANUAL gaps → voeg items toe via bestaande classificatie (step 7d).

   Geen gaps → toon `Acceptance mapping: {n}/{n} REQs gedekt` en ga door naar step 8.
   CLI gaps gevonden → display: `ACCEPTANCE TESTS: {n} test(s) gepland voor {m} requirements`

9. **Dev server** (conditioneel):

   ```
   Alle non-COVERED items AUTO/CLI (in-process testbaar) → skip dev server entirely
   MANUAL of AUTO/BROWSER items                          → start via /dev-tunnel proces (tunnel nodig)
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
3. Voor acceptance items (source: "acceptance"): schrijf test in apart bestand (test/acceptance/{feature}.acceptance.test.js).
   MOET het project's test framework gebruiken (vitest/jest/node:test — check package.json).
   Dit zorgt dat `npm test` ze oppikt als regression suite bij toekomstige /dev-build runs.
   Voorbeeld: builder test `expect(countDocuments).toBeCalled` vs acceptance test `POST 6th → expect(res.status).toBe(400)`
4. Bepaal PASS/FAIL met bewijs en redenering
5. Browser tool faalt → markeer als TOOL_ERROR

POST-BUILD: baseline al GREEN. Focus op INTEGRATIE en ACCEPTANCE, niet unit logica.
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

**Wanneer:** user gaf feedback mee bij `/dev-verify {name} {feedback}` (skipt FASE 1 + 2).

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

AskUserQuestion per item (Auto-mode: skip MANUAL items, markeer als MANUAL_PENDING): Pass (Aanbevolen) | Fail | Skip.

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

Bij AUTO FAILs → AskUserQuestion (Auto-mode: vertrouwen): Vertrouw auto resultaten (Aanbevolen) | Handmatig controleren.
Bij SKIPs → AskUserQuestion (Auto-mode: accepteren): Accepteren (Aanbevolen) | Later testen.

**Evaluation Score** (alleen tonen als acceptance tests zijn uitgevoerd):

```
EVALUATION: {feature-name}

| REQ   | Acceptance Tests | Builder Tests | Verdict |
| ----- | ---------------- | ------------- | ------- |
| REQ-1 | 3/3 PASS         | 2/2 PASS      | PASS    |
| REQ-2 | 1/2 PASS         | 1/1 PASS      | FAIL    |
```

Acceptance test FAIL → issue type **SPEC**. Builder test FAIL → issue type **TESTABLE**.
Geen acceptance tests uitgevoerd → skip tabel, categoriseer alleen op builder test FAILs.

Alle PASS → FASE 6. FAILs (SPEC of TESTABLE) → FASE 3.

---

### FASE 3: Categorize Issues

Per FAIL: categoriseer als SPEC/TESTABLE/MEASURABLE/SUBJECTIVE (zie tabel hierboven).
SPEC → uit acceptance test failures (criterium niet gedekt door implementatie).
SUBJECTIVE → AskUserQuestion voor verduidelijking, dan re-categoriseer.

Technique mapping:

- **SPEC** (acceptance criterium niet gedekt) → **Implementation First** (criterium is duidelijk, fix is concreet) + schrijf/update acceptance test
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

Complexe issues → AskUserQuestion (Auto-mode: direct fixen): Research via Context7 (Aanbevolen) | Direct fixen.

TDD: test → red → fix → green. Max 3 pogingen, daarna vraag user.

```
[FIX] Item {N}: {title}
Technique: TDD | Type: {AUTO|MANUAL}
RED: FAIL ({wat})  GREEN: PASS
SYNC: Root cause: {file:line}. Fix: {aanpak}. Impact: {scope}.
```

Test slaagt al → AskUserQuestion (Auto-mode: overslaan): Overslaan (Aanbevolen) | Test aanpassen | Handmatig checken.

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

Items falen nog → AskUserQuestion (Auto-mode: max 3 pogingen, dan stoppen): Meer details (Aanbevolen) | Andere aanpak | Accepteren | Zelf fixen.
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

**Regressies:** Toon en bied keuze via AskUserQuestion (Auto-mode: fixen): Fixen (Aanbevolen) | Accepteren. Bij fixen → terug naar FASE 4 voor alleen de regressie-items. Herhaal FASE 5c NIET na regressie-fix (max 1 pass).

---

### FASE 5d: Requirement Verification

**Skip when:** Alle tests FAIL (coverage check zinloos bij catastrofale failures).

Cross-check `feature.json` requirements tegen test resultaten:

1. **Laad requirement → test mapping:**
   - Per `requirements[]` entry (id, description, status)
   - Zoek matching `tests.checklist[]` entries via `requirementId`

2. **Bouw coverage matrix:**

   ```
   REQUIREMENT COVERAGE: {feature-name}

   | REQ       | Beschrijving (kort)        | Tests | Status      |
   |-----------|----------------------------|-------|-------------|
   | REQ-001   | {eerste 40 chars}          | 2     | ✓ COVERED   |
   | REQ-002   | {eerste 40 chars}          | 0     | ✗ GEEN TEST |

   Coverage: {covered}/{total} requirements ({percentage}%)
   ```

3. **Classificeer per requirement:**
   - **COVERED**: minstens 1 test met matching `requirementId` EN status `PASS`
   - **FAIL**: minstens 1 test matching maar status `FAIL`
   - **GEEN TEST**: geen test in `checklist[]` met matching `requirementId`

4. **Alle requirements COVERED:** toon compact samenvatting, door naar FASE 6.

5. **Bij GEEN TEST of FAIL requirements:**

   Per ongedekt requirement, AskUserQuestion (Auto-mode: test toevoegen):

   ```yaml
   header: "REQ niet gedekt: {REQ-ID}"
   question: "{requirement description} — geen test gevonden. Wat wil je doen?"
   options:
     - label: "Test toevoegen (Recommended)", description: "Schrijf een test voor dit requirement"
     - label: "Gedekt door andere test", description: "Impliciet getest via een andere test"
     - label: "Accepteren zonder test", description: "Bewust overslaan"
   multiSelect: false
   ```

   - **Test toevoegen** → voeg test item toe aan `tests.checklist[]` met `requirementId`, `status: "pending"`. Loop terug naar FASE 1 (AUTO) of FASE 2 (MANUAL) voor alleen dit item.
   - **Gedekt door andere test** → vraag welke test het dekt. Markeer requirement met `implicitCoverage: "{REQ-ID} test also validates this via {beschrijving}"`. Status → `"PASS"`.
   - **Accepteren** → markeer als `"skip"` met reden in `observations[]`.

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

AskUserQuestion (Auto-mode: skip, schrijf naar feature.json): Ja, helder (Aanbevolen) | Leg meer uit | Ik heb een vraag. Loop tot helder.

Sla fix sync op voor `feature.json` (tests.fixSync).

#### Step 2: Observaties

AskUserQuestion (Auto-mode: nee): Nee, alles goed (Aanbevolen) | Ja, ik heb iets opgemerkt.
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
- `tests.verificationCheckpoint` → `{ "gaps": ["REQ-ID"], "mismatches": ["beschrijving"], "adjustments": "none|added|reworded" }`
- `tests.evaluation` → per-REQ scores `[{ reqId, acceptancePass, acceptanceTotal, builderPass, builderTotal, verdict }]`
- `tests.acceptanceTestFile` → pad naar geschreven acceptance test bestand (persistent in codebase)

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
git commit -m "verify({feature}): {N} requirements verified ({acceptance} acceptance, {auto} auto, {manual} manual)

Adversarial verification complete.
- Acceptance: {acceptance} | Covered: {covered} | Auto: {auto} | Manual: {manual}
- Spec fixes: {specFixes} | Other fixes: {otherFixes} | Tests added: {count}"
```

Clean up: `rm -f .project/session/pre-skill-status.txt .project/session/active-{name}.json`

**Output:**

```
VERIFY COMPLETE: {feature-name}

| Dimensie          | Score               |
| ----------------- | ------------------- |
| Acceptance Tests  | {pass}/{total} PASS |
| Builder Tests     | {pass}/{total} PASS |
| Spec Issues Fixed | {n}                 |

Next steps:
  1. /dev-refactor {feature} → optionele code quality polish
  2. /dev-define {next-feature} → volgende feature oppakken
```

---

## Example Flows

```
# Pure API (fast path, geen gaps)
/dev-verify api-routes
→ FASE 0: 6 COVERED + 3 integratie AUTO/CLI, acceptance: 0 gaps
→ FASE 1: 3 integratie → 3 PASS
→ FASE 2b: Compact → 9/9 PASS, evaluation: alle REQs PASS
→ FASE 6: commit

# API feature met acceptance test gaps
/dev-verify slider-presets
→ FASE 0: 6 REQs, builder tests dekken unit logic
→ FASE 0 step 7i: 8 acceptance tests gepland (HTTP contract gaps)
→ FASE 1: schrijf acceptance tests + run → 6 PASS, 2 FAIL
→ FASE 2b: REQ-002, REQ-005 FAIL op acceptance
→ FASE 3-4: 2 SPEC issues → Implementation First fixes
→ FASE 5: re-test → all PASS
→ FASE 6: evaluation + commit (acceptance tests persistent)

# UI feature met fixes
/dev-verify user-registration
→ FASE 0: 2 COVERED + 1 AUTO/BROWSER + 1 MANUAL + 2 acceptance → tunnel
→ FASE 1: AUTO/BROWSER → FAIL, acceptance → 1 FAIL
→ FASE 2: Manual → PASS
→ FASE 3-4: 1 SPEC + 1 TESTABLE → fixes
→ FASE 5: Re-test → all PASS
→ FASE 6: Fix sync + evaluation + commit
```
