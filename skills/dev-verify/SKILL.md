---
name: dev-verify
description: Adversarial verification — acceptance tests + fix loops. After verify, the code is good. Use with /dev-verify after /dev-build.
reads: [feature.requirements, feature.build]
writes: [feature.tests, backlog.status]
metadata:
  author: mileszeilstra
  version: 2.2.1
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

> Feedback categorisatie tabel: zie FASE 3.
> Classification criteria: `references/test-classification.md`
> Code quality rules: `../shared/RULES.md` (R007-R009)

## Workflow

**Fase tracking** — eerste actie van de skill: roep `TaskCreate` aan met deze 12 items (status `pending`), daarna gebruik `TaskUpdate` om per fase `in_progress` te zetten aan begin en `completed` aan einde. Bij context compaction blijft de task list zichtbaar — geen risico op vergeten fases.

1. FASE 0: Load Context and Classify
2. FASE 1: Automated Testing
3. FASE 1b: Parse Inline Feedback
4. FASE 2: Manual Walkthrough
5. FASE 2b: Combined Results
6. FASE 3: Categorize Issues
7. FASE 4: Fix Loop
8. FASE 5: Re-test
9. FASE 5b: Re-test Loop
10. FASE 5c: Regression Check
11. FASE 5d: Requirement Verification
12. FASE 6: Completion

### FASE 0: Load Context and Classify

> **Todo**: roep `TaskCreate` aan met de 12 fase-items (zie boven). Markeer FASE 0 → `in_progress` via `TaskUpdate`.

1. **Read backlog** — `.project/backlog.html`, parse JSON uit `<script id="backlog-data">` (zie `shared/BACKLOG.md`). Filter `status === "DOING"`. Geen feature name → suggest via AskUserQuestion.

2. **Parse input:**
   - Feature name only → proceed to classification
   - Feature name + inline feedback → skip to FASE 1b
   - Feature name + free text → skip to FASE 1b

3. **Validate build output** — `.project/features/{feature-name}/feature.json`. Parse `tests.checklist[]`. Geen checklist → exit: run `/dev-build` first.

   **COMPONENT detectie** (na feature.json load): check of `feature.type === "COMPONENT"` of backlog-item type COMPONENT is. Als ja: stel `IS_COMPONENT_VERIFY = true`. Zoek demo-page: check of `app/_dev/components/{name}/page.tsx` bestaat. Niet gevonden → exit: `"Demo-page niet gevonden. Run /dev-build {feature} opnieuw — dit genereert app/_dev/components/{name}/page.tsx."`. Dev server navigeert naar `/_dev/components/{name}` i.p.v. de gewone feature-route.

4. **Worktree switch** — voer de procedure in `shared/WORKTREE.md` uit met de feature-name. Switcht automatisch naar `worktree-{feature-name}` als die bestaat. Bij FAIL (in andere worktree dan de feature): stop met de melding uit WORKTREE.md.

5. **Tag backlog + capture baseline:**
   - Git baseline: `mkdir -p .project/session && git status --porcelain | sort > .project/session/pre-skill-status.txt`
   - Session file: `echo '{"feature":"{name}","skill":"verify","startedAt":"{ISO}"}' > .project/session/active-{name}.json`

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
   - Per requirement (id + acceptance scenarios) — **skip requirements met `deltaOp === "REMOVED"`**: lees de source files die dit REQ implementeren
     (feature.json files[] waar requirements het REQ-ID bevat).
     Bepaal welke acceptance test(s) elk scenario zouden verifiëren.
     Formaat: `acceptance: [{ when, then }]` — elk object = één test scenario.
     (bijv. "201 bij succes, 400 bij >5, 409 bij duplicate" = 3 scenario's).

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
   isComponent = IS_COMPONENT_VERIFY === true
   ```

   **Token scan** (alleen als `hasUI = true` of `isComponent = true`):

   Grep alle files in `feature.json files[]` die `.tsx`, `.jsx`, `.vue`, `.svelte` matchen voor T101 (`#[0-9a-fA-F]{3,8}` in JSX/className) en T102 (`bg-\[#`, `text-\[#`). Gevonden violations → voeg AUTO/CLI test-item toe: `"Token violations: {N} hardcoded waarden (T101/T102)"`, fix direct via `shared/TOKENS.md` mapping. Geen violations → skip (geen output).

   **COMPONENT extra check** (alleen als `isComponent = true`): voeg verplicht test-item toe:

   ```json
   {
     "id": "COMP-MATRIX",
     "title": "Variant matrix zichtbaar op demo-page",
     "steps": [
       "Navigeer naar /_dev/components/{name}",
       "Controleer aanwezigheid van alle variants × sizes × states cards"
     ],
     "expected": "Alle {variants × sizes × states} combinaties zijn zichtbaar zonder errors",
     "type": "AUTO/BROWSER"
   }
   ```

   Display:

   ```
   POST-BUILD DETECTIE: {testsTotal} bestaande tests ({tdd} TDD, {implFirst} impl-first)
   Strategie: {isComponent → "COMPONENT demo-page verificatie (/_dev/components/{name})" | hasUI → "E2E browser verificatie" | isPureAPI → "API integratie" | else → "Integratie verificatie"}
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

   g) Proceed automatically with the recommended classification. No user approval needed — continue directly to step 8h.

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

   Geen gaps → toon `Acceptance mapping: {n}/{n} REQs gedekt` en ga door naar FASE 1.
   CLI gaps gevonden → display: `ACCEPTANCE TESTS: {n} test(s) gepland voor {m} requirements`

9. **Dev server** (conditioneel):

   ```
   Alle non-COVERED items AUTO/CLI (in-process testbaar) → skip dev server entirely
   MANUAL of AUTO/BROWSER items                          → start via /project-tunnel proces (tunnel nodig)
   AUTO/CLI met live server vereist                      → start op localhost (zonder tunnel)
   ```

   Bij falen → graceful fallback: alle items worden MANUAL, skip FASE 1.

---

### FASE 1: Automated Testing

> **Todo**: markeer FASE 0 → `completed`, FASE 1 → `in_progress`.

**Skip** als er geen AUTO items zijn (alle non-COVERED items zijn MANUAL, of alles is COVERED).

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
1. Voer stappen uit via bash commands, Playwright runner specs, of schrijf een integration test file
2. Voor CLI items zonder running server: schrijf een integration test (test/integration/{feature}.integration.test.js) die de service/functie direct test met mock dependencies en echte DB
3. Voor acceptance items (source: "acceptance"): schrijf test in apart bestand (test/acceptance/{feature}.acceptance.test.js).
   MOET het project's test framework gebruiken (vitest/jest/node:test — check package.json).
   Dit zorgt dat `npm test` ze oppikt als regression suite bij toekomstige /dev-build runs.
   Voorbeeld: builder test `expect(countDocuments).toBeCalled` vs acceptance test `POST 6th → expect(res.status).toBe(400)`
4. Voor BROWSER items: schrijf een Playwright runner spec in test/acceptance/{feature}.spec.ts (GEEN MCP browser tools).
   Gebruik het on-the-fly spec pattern: zie shared/PLAYWRIGHT.md → Runner Mode.
   Runner beschikbaar check: `npx playwright --version 2>/dev/null`.
   Beschikbaar → schrijf spec met `expect(page)` assertions. Bij a11y-criteria: gebruik `toMatchAriaSnapshot()`.
   Bij visuele criteria ("voelt snel", "ziet er goed uit"): gebruik `toHaveScreenshot()` — eerste run maakt baseline.
   Draai: `npx playwright test test/acceptance/{feature}.spec.ts --reporter=json`
   Runner niet beschikbaar → draai `/core-setup playwright` om daemon + runner te installeren, dan opnieuw.
   Bij persistente failure → markeer als TOOL_ERROR en noteer: "runner spec gegenereerd maar kon niet draaien"
5. Bepaal PASS/FAIL met bewijs en redenering
6. TOOL_ERROR (runner faalt of CLI errors) → markeer als TOOL_ERROR

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

> **Todo**: markeer FASE 1 → `completed`, FASE 1b → `in_progress`.

**Wanneer:** user gaf feedback mee bij `/dev-verify {name} {feedback}` (skipt FASE 1 + 2).

Parse naar item/PASS/FAIL/notes. Accepteer `1:PASS 2:FAIL note` en vrije tekst.
Toon samenvatting, ga naar FASE 3.

Onduidelijke feedback → AskUserQuestion: Opnieuw invoeren (Aanbevolen) | Per item doorgaan | Uitleg.

---

### FASE 2: Manual Walkthrough

> **Todo**: markeer FASE 1b → `completed`, FASE 2 → `in_progress`.

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

**Codegen-tip voor herhaalbare flows** (toon eenmalig boven eerste MANUAL item als flow ≥3 stappen heeft):

```
💡 Voor flows met ≥3 stappen: run `npx playwright codegen {url}` in een terminal om
   je interacties op te nemen als Playwright spec. Lever die op aan /dev-verify voor
   automatische BROWSER-verificatie bij toekomstige runs.
```

AskUserQuestion per item: Pass (Aanbevolen) | Fail | Skip.

- Fail → vraag kort wat er mis ging
- Skip → noteer reden

---

### FASE 2b: Combined Results

> **Todo**: markeer FASE 2 → `completed`, FASE 2b → `in_progress`.

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

<!-- modal-buffer -->

Print 8 blank lines as whitespace buffer (keeps the results table above visible when the modal panel opens).

Bij AUTO FAILs → AskUserQuestion: Vertrouw auto resultaten (Aanbevolen) | Handmatig controleren.
Bij SKIPs → AskUserQuestion: Accepteren (Aanbevolen) | Later testen.

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

> **Todo**: markeer FASE 2b → `completed`, FASE 3 → `in_progress`.

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

> **Todo**: markeer FASE 3 → `completed`, FASE 4 → `in_progress`.

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

> **Todo**: markeer FASE 4 → `completed`, FASE 5 → `in_progress`.

Re-test ALLEEN gefixte items.

**Phase A: Auto** — fixed AUTO items via Agent (zelfde aanpak als FASE 1, markers `RETEST_RESULTS_START`/`RETEST_RESULTS_END`). TOOL_ERROR → Phase B.

**Phase B: Manual** — fixed MANUAL items via walkthrough. Toon WIJZIGING (fix summary) + originele stappen.

Display re-test resultaten.

### FASE 5b: Re-test Loop

> **Todo**: markeer FASE 5 → `completed`, FASE 5b → `in_progress`.

Alles pass → FASE 5c.

Items falen nog → AskUserQuestion: Meer details (Aanbevolen) | Andere aanpak | Accepteren | Zelf fixen.
Loop terug naar FASE 3. AUTO items → re-run in FASE 5A. MANUAL items → re-test in FASE 5B.

---

### FASE 5c: Regression Check

> **Todo**: markeer FASE 5b → `completed`, FASE 5c → `in_progress`.

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

### FASE 5d: Requirement Verification

> **Todo**: markeer FASE 5c → `completed`, FASE 5d → `in_progress`.

**Skip when:** Alle tests FAIL (coverage check zinloos bij catastrofale failures).

Cross-check `feature.json` requirements tegen test resultaten:

1. **Laad requirement → test mapping:**
   - Per `requirements[]` entry (id, description, status) — **skip entries met `deltaOp === "REMOVED"`**
   - Zoek matching `tests.checklist[]` entries via `requirementId`

2. **Bouw coverage matrix:**

   ```
   REQUIREMENT COVERAGE: {feature-name}

   | REQ       | Beschrijving (kort)        | Tests | Status        |
   |-----------|----------------------------|-------|---------------|
   | REQ-001   | {eerste 40 chars}          | 2     | ✓ COVERED     |
   | REQ-002   | {eerste 40 chars}          | 0     | ✗ GEEN TEST   |
   | REQ-003   | {eerste 40 chars}          | 1     | ⊘ BLOCKED     |
   | REQ-004   | {eerste 40 chars}          | 0     | ? UNCLEAR     |

   Coverage: {covered}/{total} requirements ({percentage}%)
   Non-testable: BLOCKED={n} UNCLEAR={n} (heropenen nodig)
   ```

3. **Classificeer per requirement:**
   - **COVERED**: minstens 1 test met matching `requirementId` EN status `PASS`
   - **FAIL**: minstens 1 test matching maar status `FAIL`
   - **BLOCKED**: test bestaat niet of faalt door externe dependency (service down, ontbrekende API key, missing fixture)
   - **UNCLEAR**: geen test mogelijk omdat acceptance criteria te vaag is (bv. "voelt snel", "werkt goed") — niet-deterministisch
   - **GEEN TEST**: geen test in `checklist[]` met matching `requirementId` (geen legitieme reden)

4. **Alle requirements COVERED:** toon compact samenvatting, door naar FASE 6.

5. **Bij GEEN TEST, FAIL, BLOCKED of UNCLEAR requirements:**

   Per ongedekt requirement, AskUserQuestion:

   ```yaml
   header: "REQ niet gedekt: {REQ-ID}"
   question: "{requirement description} — geen test gevonden. Wat wil je doen?"
   options:
     - label: "Test toevoegen (Recommended)", description: "Schrijf een test — CLI/acceptance, Playwright runner spec voor BROWSER, of visual baseline via toHaveScreenshot"
     - label: "Gedekt door andere test", description: "Impliciet getest via een andere test"
     - label: "Blocked door dependency", description: "Externe service/fixture ontbreekt — niet testbaar nu"
     - label: "Criteria te vaag", description: "Acceptance criteria mist concreetheid — heropen /dev-define of zet om naar visual baseline"
   multiSelect: false
   ```

   - **Test toevoegen** → voeg test item toe aan `tests.checklist[]` met `requirementId`, `status: "pending"`. Loop terug naar FASE 1 (AUTO) of FASE 2 (MANUAL) voor alleen dit item. Kies automatisch de juiste methode:
     - Functioneel criterium → CLI/acceptance test (vitest/jest)
     - Browser-gedrag / user flow → Playwright runner spec in `test/acceptance/{feature}.spec.ts`
     - Visueel criterium ("voelt snel", "ziet er goed uit", "geen layout-shift") → `toHaveScreenshot()` baseline via runner
     - A11y-criterium → `toMatchAriaSnapshot()` via runner
   - **Gedekt door andere test** → vraag welke test het dekt. Markeer requirement met `implicitCoverage: "{REQ-ID} test also validates this via {beschrijving}"`. Status → `"PASS"`.
   - **Blocked door dependency** → vraag welke dependency. Status → `"BLOCKED"`, voeg toe aan `requirements[].evidence = "blocked by: {reason}"`. Niet mergen-blokkerend; signaal voor heropenen na dependency-fix.
   - **Criteria te vaag** → twee paden:
     - Kan worden geconcretiseerd met een visual baseline → schrijf `toHaveScreenshot()` runner spec, status → `"PASS"` na baseline.
     - Kan niet worden geconcretiseerd → vraag wat vaag is. Status → `"UNCLEAR"`, voeg toe aan `requirements[].evidence = "needs clarification: {what's vague}"`. Signaal voor `/dev-define` heropen om concrete acceptance te formuleren.

---

### FASE 6: Completion

> **Todo**: markeer FASE 5d → `completed`, FASE 6 → `in_progress`.

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

**Skip wanneer:** deze sessie geen MANUAL items had (pure automode — user heeft niets zelf gecontroleerd, dus kan niets opgemerkt hebben).

AskUserQuestion: Nee, alles goed (Aanbevolen) | Ja, ik heb iets opgemerkt.
"Ja" → vraag beschrijving, noteer voor feature.json (observations[]).

#### Step 3: 3-File Sync

Skill-specifieke mutaties:

**feature.json:**

- `status` → `"DONE"`
- `requirements[].status` → `"PASS"` / `"FAIL"` / `"BLOCKED"` / `"UNCLEAR"` per REQ (BLOCKED/UNCLEAR includeren `evidence` string)
- `tests.checklist[].status` → `"PASS"` / `"FAIL"` / `"skip"` per item
- `tests.finalStatus` → `"PASSED"` (alle requirements PASS) / `"FAILED"` (≥1 FAIL) / `"PARTIAL"` (≥1 BLOCKED of UNCLEAR, 0 FAIL). PARTIAL signaleert incomplete verificatie; feature `status` blijft `"DONE"`.
- `tests.sessions[]` → append `{ "date": "YYYY-MM-DD", "pass": N, "fail": N, "skip": N }`
- `tests.fixSync` → fix summaries (als fixes toegepast)
- `observations[]` → toevoegen (indien aanwezig)
- `tests.verificationCheckpoint` → `{ "gaps": ["REQ-ID"], "mismatches": ["beschrijving"], "adjustments": "none|added|reworded" }`
- `tests.evaluation` → per-REQ scores `[{ reqId, acceptancePass, acceptanceTotal, builderPass, builderTotal, verdict }]`
- `tests.acceptanceTestFile` → pad naar geschreven acceptance test bestand (persistent in codebase)

**PAGE-seeding (safety net — frontend projects only):**

Voer uit **vóór** de backlog-mutatie. Trigger alleen als **alle** condities waar zijn:

1. `project.json#stack.framework` is een frontend framework (React, Vue, Svelte, Next.js, Nuxt, Astro, Remix, SolidJS)
2. FASE 4 heeft fixes toegepast (er zijn `tests.fixSync` entries deze sessie)
3. Er bestaan nieuwe page-files die niet in `feature.json#files[]` stonden vóór deze sessie — detecteer via diff t.o.v. `pre-skill-status.txt` baseline. Paden die matchen: `app/**/page.tsx`, `src/routes/**`, `pages/**/*.{tsx,vue}`, `routes/**/*.svelte`, of componentnamen die eindigen op `Page`, `Screen`, `View`
4. Na idempotency-filter (`data.features.find(f => f.name === <kebab-naam>)`) blijven ≥1 kandidaten over

Als alle condities waar zijn → AskUserQuestion:

```yaml
header: "Pages tijdens fix gedetecteerd"
question: "FASE 4 heeft {N} nieuwe page-files toegevoegd. Wil je ze als PAGE-todos op de backlog?"
options:
  - label: "Ja, alle (Recommended)"
    description: "Maak voor elke page een PAGE-todo zodat ze design → check doorlopen"
  - label: "Selectie"
    description: "Kies welke pages een aparte todo krijgen"
  - label: "Nee"
    description: "Geen extra todos — pages zijn dekkend in fix-sync"
multiSelect: false
```

Per geselecteerde page → push naar `data.features[]`:

```json
{
  "name": "{kebab-case page name}",
  "type": "PAGE",
  "status": "TODO",
  "phase": "P3",
  "description": "Page introduced via fix in {parentFeature}. Routes: {route-pattern}",
  "source": "/dev-verify",
  "dependencies": ["{parentFeature}"],
  "parentFeature": "{parentFeature}",
  "auto": true
}
```

Update `data.updated`. Edit backlog-JSON terug in `backlog.html`.

**backlog:** parse JSON uit `<script id="backlog-data">` (zie `shared/BACKLOG.md`). Match op `feature.name` (niet `id` — het backlog-formaat gebruikt `name` als unieke key). Set `status = "DONE"`, verwijder `stage` en `transition` (als aanwezig). **Verificatie**: na schrijven, parse opnieuw en controleer dat de status "DONE" is. Bij geen match op name: log een warning en stop — silent no-op is een bug.

**project-context.json**: Bij fixes in FASE 4: update `architecture.components[]` — merge gewijzigde bestanden naar component `src`/`test`, bevestig `status: "done"`, voeg test files toe.

**COMPONENT design sync** (alleen als `IS_COMPONENT_VERIFY = true`):

Update `project.json#design.components[]` — zoek op naam, zet `status: "DONE"`. Niet gevonden → voeg toe met status `"DONE"`. Update `project-context.json#components[]` inventory: voeg test-paden toe aan bestaand inventory-item (merge, niet overschrijven).

**Reuse-Discovery** (frontend projects only — skip als `IS_COMPONENT_VERIFY = true`, skip als geen BROWSER-tests gedraaid):

Na succesvolle verificatie van een PAGE-feature waarbij BROWSER-tests gerund zijn: scan de test-resultaten en screencap-context op visuele patronen die in meerdere pages of features herhalen. Detecteer herhalende layout-blokken (stat cards, listtabellen, hero-sectie, etc.) met vergelijkbare structuur.

**Dedup**: check `project.json#design.components[]` en `project-context.json#components[]`. Check `feature.json#suggestionsLog[]` — eerder rejected van `dev-verify`? → skip.

Gevonden kandidaten (max 2 per run, om verify niet te vertragen) → AskUserQuestion:

```yaml
header: "Herhalende UI-patronen"
question: "Visuele verificatie toont patronen die als gedeeld component herbruikbaar zijn. COMPONENT-todos aanmaken?"
options:
  - label: "{naam} — {korte visuele beschrijving}", description: "Maak COMPONENT-todo"
  - label: "..." (één per kandidaat)
  - label: "Overslaan", description: "Geen COMPONENT-todos toevoegen"
multiSelect: true
```

Per geaccepteerd: append backlog + `design.components[]` (status: IDEA) + `feature.json#suggestionsLog[]` (accepted).
Per afgewezen: log in `suggestionsLog[]` (rejected, skill: "dev-verify").

#### Step 3b: Learning Extraction

Extracteer projectbrede learnings uit de voltooide feature. Lees de zojuist geschreven `feature.json` en evalueer (verplichte source-tag per bron):

- `build.decisions[]` → type `pattern`, source `extracted` (architecturale keuzes die andere features beïnvloeden)
- `tests.fixSync[]` → type `pitfall`, source `extracted` (bugs met root causes)
- `observations[]` → type `observation`, source `inferred` (cross-feature inzichten)

**Filter**: alleen items die relevant zijn buiten deze ene feature. Skip feature-specifieke implementatiedetails.

**Append** naar `project-context.json` → `learnings[]`:

```json
{
  "date": "YYYY-MM-DD",
  "feature": "{feature-name}",
  "type": "pattern|pitfall|observation",
  "source": "extracted|inferred",
  "summary": "Max 200 chars samenvatting"
}
```

**Dedup** voor elke candidate learning:

1. Exact shortcut: zelfde feature + zelfde summary → skip (geen Jaccard nodig)
2. Tokeniseer candidate.summary via `shared/LEARNING-EXTRACTION.md` Dedup Tokenizer
3. Voor elke bestaande learning in `learnings[]` met hetzelfde `type`:
   - `Jaccard(candidate.tokens, existing.tokens) >= 0.55` → skip candidate
4. Overleeft beide checks → append

Geen learnings gevonden → skip stap.

#### Step 4: Scoped commit

**Pre-commit diagnostics** (stack-aware, identiek aan dev-build):

- Lees `package.json` → check `scripts` op keys matching `typecheck|type-check|tsc|lint`
- Python project (geen package.json): check op `mypy.ini` of `[tool.mypy]` in `pyproject.toml`
- Geen match gevonden → skip stilzwijgend

Bij match: run gevonden script(s) (meerdere matches → parallel) via Bash tool met `timeout: 60000`

- **PASS** → toon `DIAGNOSTICS: PASS`, door naar git status compare
- **FAIL** → toon errors (max 30 regels) + AskUserQuestion:
  - `"Fix eerst (Recommended)"` — stop Step 4, geen commit; user fixt en herstart skill
  - `"Toch committen"` — door; voeg `[diagnostics-warnings]` toe aan commit message

Vergelijk `git status --porcelain | sort` met `.project/session/pre-skill-status.txt`:

- **NEW** (alleen in current) → `git add -f` (subdirs als `.project/features/` en `.project/sessions/` zijn gitignored — `-f` vereist voor session-bestanden die hieronder vallen)
- **OVERLAP** (in beide, gewijzigd door deze skill) → `git add -f`
- **PRE-EXISTING** (alleen in baseline, of overlap niet door deze skill gewijzigd) → niet stagen

Baseline niet gevonden → fallback `git add -A`.

**Variabelen** (telling per FASE 0 classificatie):

- `{acceptance}` = aantal acceptance tests geschreven in FASE 1 (source: "acceptance")
- `{auto}` = aantal items met type AUTO (CLI of BROWSER) — exclusief COVERED
- `{manual}` = aantal items met type MANUAL
- `{covered}` = aantal items met type COVERED (build tests dekken het contract)

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

**Worktree integration hint** — voeg één extra regel toe als beide voorwaarden waar zijn:

1. Huidige branch matcht `worktree-*` pattern (`git branch --show-current`)
2. Feature is na deze run op `status: "DONE"` in backlog

Append:

```
💡 Feature klaar — run /core-merge {feature-name} om te integreren naar main/develop
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
→ FASE 0 step 8h: 8 acceptance tests gepland (HTTP contract gaps)
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

> **Todo**: markeer FASE 6 → `completed`.
