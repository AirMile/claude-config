---
name: dev-debug
description: Systematic debugging with reproduction-test-first workflow, root cause analysis, and 3 fix strategies. Use for runtime errors, build failures, unexpected behavior, or test failures.
reads: [project-context.learnings, feature.requirements]
writes: [project-context.learnings]
metadata:
  author: mileszeilstra
  version: 3.0.0
  category: dev
---

# Debug

Structured 11-phase debugging: context → intake → investigate → analyze → research → fix plans → select → reproduction test → implement → verify → completion.

## Process

**Fase tracking** — eerste actie van de skill: roep `TaskCreate` aan met deze 11 items (status `pending`), daarna gebruik `TaskUpdate` om per fase `in_progress` te zetten aan begin en `completed` aan einde. Bij context compaction blijft de task list zichtbaar — geen risico op vergeten fases.

1. FASE 0: Context Loading
2. FASE 1: Problem Intake
3. FASE 2: Codebase Investigation
4. FASE 3: Root Cause Analysis
5. FASE 4: Context7 Research
6. FASE 5: Fix Plan Generation
7. FASE 6: Plan Selection
8. FASE 7: Reproduction Test
9. FASE 8: Implementatie
10. FASE 9: Verificatie
11. FASE 10: Completion

## FASE 0: Context Loading

> **Todo**: roep `TaskCreate` aan met de 11 fase-items (zie boven). Markeer FASE 0 → `in_progress` via `TaskUpdate`.

**Stack context** (optioneel, skip wat niet bestaat):

- Lees CLAUDE.md `### Stack` sectie
- Lees `.claude/research/stack-baseline.md`

**Project context** (optioneel, skip als niet bestaat):

- Lees `.project/project.json` → extract:
  - `stack` (framework, language, packages)
  - `endpoints` (method, path, auth)
  - `data.entities` (names, fields, relations)
- Lees `.project/project-context.json` (als bestaat) → extract:
  - `context` (structure, routing, patterns)

**Active feature detectie** (optioneel):

- Check `.project/session/active-*.json` files
- Fallback: lees `.project/backlog.html` → zoek meest recente feature met `status === "DOING"`
- Als actieve feature gevonden:
  - Noteer als context hint voor investigation agents
  - Lees `.project/features/{feature-name}/feature.json` (als bestaat) → extract `requirements[]` (id + description + status)
  - Noteer als FEATURE_REQUIREMENTS voor gebruik in FASE 3 (spec-vs-impl onderscheid)

**Worktree switch** (alleen als active feature gedetecteerd):

Als active feature gevonden in vorige stap, voer steps 1-3 uit `shared/WORKTREE.md` (compute expected_path, check registered).

- Worktree bestaat én pwd == main_root → AskUserQuestion:
  - header: "Worktree"
  - question: "Active feature '{name}' heeft worktree {short_path}. Hoe debuggen?"
  - options:
    - "Switch naar worktree (Recommended)" → `EnterWorktree(path: expected_path)`
    - "Standalone op huidige branch" → skip switch
- Worktree bestaat én pwd in andere worktree dan expected → AskUserQuestion (debug is ad-hoc, geen hard fail):
  - header: "Worktree"
  - question: "Je zit in worktree {pwd_short}, active feature is '{name}' (worktree {expected_short}). Hoe verder?"
  - options:
    - "Hier blijven debuggen (Recommended)" → skip switch, debug op huidige worktree
    - "Switch naar feature-worktree" → `ExitWorktree(action: "keep")` + `EnterWorktree(path: expected_path)`
    - "Switch naar main" → `ExitWorktree(action: "keep")` (alleen als pwd in een door deze session aangemaakte worktree zit; anders skip)
- pwd == expected_path → already there, skip switch
- Geen active feature of geen worktree → skip switch, debug draait standalone

**Git baseline** (voor scoped commit in FASE 10):

```bash
mkdir -p .project/session && git status --porcelain | sort > .project/session/pre-debug-status.txt
```

**Load learnings via shared/LEARNINGS-LOAD.md:**

- scopes: [component]
- pitfall-prefix: true
- global-memory: true
- current-feature: {active feature naam, of "none"}

Render LEARNINGS_CONTEXT block. Skip stilletjes als geen `project-context.json` of geen `~/.claude/memory/MEMORY.md`.

**Stel DEBUG_CONTEXT samen** (alle info beschikbaar voor inline investigation):

```
STACK: {framework} ({language}) — {packages}
PATTERNS: {context.patterns of "niet beschikbaar"}
STRUCTURE: {context.structure of "niet beschikbaar"}
ACTIVE FEATURE: {feature naam + status of "geen"}
REQUIREMENTS: {requirements ids + descriptions, of "niet beschikbaar"}
ENDPOINTS: {endpoints of "niet beschikbaar"}
ENTITIES: {data.entities of "niet beschikbaar"}
KNOWN PITFALLS: {LEARNINGS_CONTEXT output, of "geen"}
```

Als niets beschikbaar → ga door zonder context (backwards compatible).

---

## FASE 1: Problem Intake

> **Todo**: markeer FASE 0 → `completed`, FASE 1 → `in_progress`.

### Step 1: Classify

AskUserQuestion:

- header: "Probleem Type"
- question: "Wat voor type probleem is dit?"
- options:
  - "Runtime Error" — Crashes, exceptions, error messages in console of UI
  - "Logic Bug" — Verkeerde output, unexpected behavior
  - "Performance Issue" — Traag, memory leaks, timeouts
  - "Integration Issue" — API failures, data sync, externe systemen

### Step 2: Details (per type)

**Runtime Error:**
AskUserQuestion:

- header: "Error Details"
- question: "Welke informatie heb je over de error?"
- options:
  - "Ik heb een error message" — Exacte foutmelding beschikbaar
  - "Ik heb een stack trace" — Volledige stack trace beschikbaar
  - "Ik heb beide" — Error message en stack trace
  - "Ik heb alleen een screenshot" — Visuele weergave

Then: ask user to share the details.

**Logic Bug:**
AskUserQuestion:

- header: "Gedrag Details"
- question: "Beschrijf het verschil tussen verwacht en werkelijk gedrag:"
- options:
  - "Ik weet exact wat er fout gaat" — Expected vs actual beschrijfbaar
  - "Output is verkeerd" — Verkeerde waarde of weergave
  - "Actie werkt niet" — Button, form, interactie faalt
  - "Data klopt niet" — Verkeerde data getoond of opgeslagen

Then: ask for specific expected vs actual behavior.

**Performance Issue:**
AskUserQuestion:

- header: "Performance Details"
- question: "Wanneer treedt het performance probleem op?"
- options:
  - "Bij specifieke actie" — Bepaalde pagina, button click, of data load
  - "Altijd traag" — Consistent trage applicatie
  - "Na verloop van tijd" — Start snel, wordt langzamer (memory leak)
  - "Bij veel data" — Alleen traag met grote datasets

Then: ask about scale/context details.

**Integration Issue:**
AskUserQuestion:

- header: "Integratie Details"
- question: "Welk extern systeem is betrokken?"
- options:
  - "REST API" — HTTP endpoints, fetch calls
  - "Database" — Supabase, Firebase, andere DB
  - "Third-party service" — Auth, payment, analytics
  - "File system / Storage" — Uploads, downloads, cloud storage

Then: ask for API/service details and error responses.

### Step 3: Bevestig samenvatting

Show summary of type + symptom + context + details gathered.

AskUserQuestion:

- header: "Bevestiging"
- question: "Klopt deze probleem samenvatting?"
- options:
  - "Ja, start onderzoek (Aanbevolen)" — Start inline investigation
  - "Nee, correctie nodig" — Meer details of correcties geven

If "Nee" → ask for corrections, update summary, re-confirm.

---

## FASE 2: Codebase Investigation (Explore agent)

> **Todo**: markeer FASE 1 → `completed`, FASE 2 → `in_progress`.

Spawn one Explore agent (`subagent_type="Explore"`) to investigate in an isolated context. This keeps source file reads and git output out of the main session — critical because FASE 3-8 still need context space for root cause analysis, fix planning, and implementation.

**Thoroughness op basis van problem type (FASE 1):**

- Runtime Error met stack trace → `"medium"` (locatie al bekend, focus op call stack en context)
- Runtime Error zonder stack trace → `"very thorough"`
- Logic Bug / Performance Issue / Integration Issue → `"very thorough"` (oorzaak onduidelijk, brede scan)

Agent prompt:

```
Investigate this bug. Perform 3 passes that build on each other.

DEBUG_CONTEXT:
{DEBUG_CONTEXT from FASE 0}

PROBLEM:
{problem summary from FASE 1}
{error message / stack trace / details}

PASS 1 — ERROR TRACE:
- Parse stack trace / error message → identify root location
- Read the source file at the error location
- Trace the call stack: what called this code? What data flows in?
- Map the exception/error flow: where is it caught (or not)?

PASS 2 — CONTEXT MAP (use locations from Pass 1):
- Read imports and dependents of the affected file(s)
- Trace data flow: where does input come from? Where does output go?
- Check endpoints and entities from DEBUG_CONTEXT for relevant connections
- Identify external factors (APIs, DB, file system, environment)

PASS 3 — CHANGE ANALYSIS (use files from Pass 1+2):
- git log --oneline -10 -- {affected files}
- git blame {error location}
- Was this working before? What changed?
- Check KNOWN PITFALLS in DEBUG_CONTEXT: als een pitfall matcht op symptoom of locatie,
  vermeld dit als sterke hypothese — voeg toe als "Pitfall match: {summary}" in return format

RETURN FORMAT:
INVESTIGATION_START
Error location: {file:line}
Call stack: {caller → callee chain}
Root code: {the problematic code snippet, max 20 lines}
Dependencies: {key imports and dependents}
Data flow: {input source → processing → output}
External factors: {APIs, DB, env vars involved}
Recent changes: {relevant commits with dates}
Regression risk: {yes/no — was this area recently modified?}
Pitfall match: {matching pitfall summary, of "geen"}
INVESTIGATION_END
```

Parse the agent's `INVESTIGATION_START...END` block — only the compact findings enter the main context.

---

## FASE 3: Root Cause Analysis

> **Todo**: markeer FASE 2 → `completed`, FASE 3 → `in_progress`.

Analyze:

**Pitfall match shortcut**: als `Pitfall match` in INVESTIGATION_END aanwezig en niet "geen" → voeg die hypothese bovenaan toe met confidence "high" als startpunt. Evalueer alsnog tegen evidence — als evidence tegenspreekt, degradeer naar "medium" en ga door met stap 2.

1. Combine findings from all 3 investigation passes
2. Identify patterns and correlations
3. Form hypotheses about root cause
4. Evaluate each hypothesis against evidence
5. Test one hypothesis at a time — never combine multiple fixes in a single verification step
6. Determine most likely root cause
7. Check FEATURE_REQUIREMENTS (uit FASE 0): matcht de root cause aan een requirement die verkeerd geïmplementeerd is? Zo ja, markeer als **spec-issue** — in FASE 6 is fix-thorough aanbevolen (minimal lost het symptoom, niet de spec-afwijking).
8. Identify knowledge gaps for FASE 4

Present findings + hypothesis + confidence (high/medium/low) + spec-issue markering (ja/nee) + research topics needed.

---

## FASE 4: Context7 Research

> **Todo**: markeer FASE 3 → `completed`, FASE 4 → `in_progress`.

**Skip als**: root cause is puur interne logica (geen externe library API's of third-party dependencies betrokken in affected files) → ga direct naar FASE 5.

1. `mcp__context7__resolve-library-id` for relevant libraries
2. `mcp__context7__query-docs` for:
   - Known bugs/issues related to root cause
   - Best practices for this scenario
   - Recommended patterns/solutions

Focus: dependency issues → version docs/migration guides, pattern misuse → correct usage, edge cases → error handling patterns.

---

## FASE 5: Fix Plan Generation

> **Todo**: markeer FASE 4 → `completed`, FASE 5 → `in_progress`.

Launch 3 agents in parallel (zie `shared/SKILL-PATTERNS.md#parallel-dispatch` voor dispatch-criteria en prompt-template):

| Agent         | Philosophy           | Focus                                      |
| ------------- | -------------------- | ------------------------------------------ |
| fix-minimal   | "Kleinste wijziging" | Hotfix, minimal risk, fewest changes       |
| fix-thorough  | "Volledige fix"      | Root cause, add tests, clean up            |
| fix-defensive | "Preventief"         | Safeguards, validation, prevent recurrence |

Each receives: root cause analysis + research findings + affected files.
Each returns: specific changes with file:line refs, risk (low/medium/high), scope, trade-offs,
AND: `Reproduction test assertion: {wat moet de test asserten om de bug te bewijzen}`

---

## FASE 6: Plan Selection

> **Todo**: markeer FASE 5 → `completed`, FASE 6 → `in_progress`.

Present all 3 options with approach, changes count, risk level, and trade-offs.
Include recommendation based on context.

### Step 1: Strategy

AskUserQuestion:

- header: "Fix Strategie"
- question: "Welke fix aanpak wil je gebruiken?"
- options:
  - "Minimal (Aanbevolen voor productie)" — Kleinste wijziging, laag risico
  - "Thorough" — Volledige fix met root cause + tests
  - "Defensive" — Safeguards en validatie tegen herhaling

### Step 2: Fixes selecteren

**Fixes Selecteren:**

```
Voorgestelde fixes ({M} totaal):

1. {file:line} — {description}
2. {file:line} — {description}
...
```

Vraag: "Welke fixes wil je toepassen? Geef nummers (bv. `1, 3` of `alle`)."

Parse → fix-set.

---

## FASE 7: Reproduction Test

> **Todo**: markeer FASE 6 → `completed`, FASE 7 → `in_progress`.

**Doel**: bewijs de bug met een falende test voor de fix. Maakt root cause concreet, voorkomt regressies, geeft objectief bewijs dat fix werkt.

### Step 1: Testbaarheid bepalen

Default voor Runtime Error / Logic Bug: skip de vraag, ga direct naar Step 2.

Voor Performance Issue / Integration Issue / niet-runtime bugs, AskUserQuestion:

- header: "Reproduction Test"
- question: "Is deze bug testbaar in een geautomatiseerde test?"
- options:
  - "Ja, schrijf reproduction test (Aanbevolen)" — Standaard pad voor assertable bugs
  - "Playwright visual baseline — UI visual / CSS" — toHaveScreenshot() baseline als reproduction test (runner vereist)
  - "Nee, skip — Performance zonder threshold" — Geen concrete meetwaarde definieerbaar
  - "Nee, skip — Productie-only data" — Niet reproduceerbaar in test omgeving

**"Playwright visual baseline" gekozen:**

Check runner beschikbaar: `npx playwright --version 2>/dev/null`.

- **Beschikbaar**: ga door naar Step 2b (Playwright UI reproduction).
- **Niet beschikbaar**: draai `/core-setup playwright` om daemon + runner te installeren. Daarna Step 2b.
- **Installatie mislukt**: val terug op skip, noteer `reproductionTest: { skipped: true, reason: "runner niet beschikbaar" }`, ga naar FASE 8.

**"Skip" gekozen (performance of productie-data):** noteer `reproductionTest: { skipped: true, reason: "{reden}" }` en ga naar FASE 8.

### Step 2b: Playwright UI reproduction (alleen bij "visual baseline" keuze in Step 1)

Locatie: `test/regression/{slug}.spec.ts`
Framework: `@playwright/test` — on-the-fly spec (zie `shared/PLAYWRIGHT.md → Runner Mode`).

```typescript
// test/regression/{slug}.spec.ts
import { test, expect } from "@playwright/test";

test("{issue slug} — visual regression", async ({ page }) => {
  await page.goto("{url-waar-bug-optreedt}");
  await page.waitForLoadState("networkidle");
  // Eerste run: legt buggy staat vast als baseline
  // Na fix: --update-snapshots om nieuwe correcte staat als baseline in te stellen
  await expect(page).toHaveScreenshot("{slug}-regression.png", {
    maxDiffPixelRatio: 0.02,
  });
  // Optioneel: aria-snapshot voor structurele UI-regressies
  await expect(
    page.locator("{selector-van-gebroken-component}"),
  ).toMatchAriaSnapshot();
});
```

Draai met `--update-snapshots` om buggy staat als baseline vast te leggen:
`npx playwright test test/regression/{slug}.spec.ts --config=.project/playwright-runs/playwright.config.ts --update-snapshots`

Na fix (FASE 8): draai zonder `--update-snapshots` → PASS als fix de render niet verslechtert t.o.v. het correcte beeld. Update baseline expliciet na gewenste visuele verbetering.

Noteer: `reproductionTest: { file: "test/regression/{slug}.spec.ts", type: "visual-baseline", tool: "playwright-runner" }`

Sla het step-3 run-commando op als: `npx playwright test test/regression/{slug}.spec.ts --config=.project/playwright-runs/playwright.config.ts`

### Step 2: Schrijf falende test

- Locatie: `test/regression/{slug}.test.{ext}` of voeg toe aan bestaand test bestand met `// REGRESSION: {issue}` marker
- Framework: detecteer uit package.json (vitest/jest/node:test) of project conventie
- Assert: het **verwachte** gedrag (niet het buggy gedrag)
- Bevat de input/setup die de bug triggerde (uit FASE 1 details + FASE 2 investigation)

### Step 3: Run de test

```bash
{npm test command} -- {test file pattern}
```

**Verwacht: FAIL voor de juiste reden** — match tegen FASE 3 root cause:

| Resultaat                                    | Reden                                                    | Actie                    |
| -------------------------------------------- | -------------------------------------------------------- | ------------------------ |
| FAIL met assert mismatch matching root cause | Bug correct gereproduceerd                               | ✓ Door naar FASE 8       |
| FAIL door compile/setup error                | Test zelf is kapot                                       | Fix de test, run opnieuw |
| PASS onverwacht                              | Bug niet correct gereproduceerd of root cause klopt niet | Terug naar FASE 3        |

### Step 4: Bevestig

```
REPRODUCTION TEST: {bestand}:{lijn}
Expected fail reason: {root cause uit FASE 3}
Actual fail: {error output, max 5 regels}
Status: ✓ Bug reproduced
```

---

## FASE 8: Implementatie

> **Todo**: markeer FASE 7 → `completed`, FASE 8 → `in_progress`.

Apply selected fixes from chosen strategy. Document each change with file:line references.

**Bij reproduction test geschreven (FASE 7)**: implementatie heeft als concrete success-criterium dat de reproduction test moet slagen. Niet meer code wijzigen dan nodig om die test groen te krijgen + de oorspronkelijke fix-plan scope.

---

## FASE 9: Verificatie

> **Todo**: markeer FASE 8 → `completed`, FASE 9 → `in_progress`.

### Step 1: Reproduction test (skip als FASE 7 geskipt)

```bash
{npm test command} -- {reproduction test file}
```

- PASS → fix bewijsbaar werkt voor de gereproduceerde bug
- FAIL → fix incompleet, terug naar FASE 8 (max 3 iteraties, daarna AskUserQuestion: Andere strategie | Meer research | Accepteren als incompleet)

### Step 2: Regression suite

**Skip als**: geen test suite aanwezig (geen `test` script in package.json, geen `vitest.config.*` of `jest.config.*`) → ga naar Step 3.

Run de full test suite (of minimaal: alle tests in directories die geraakte files importeren).

```bash
{npm test command}
```

- Nieuwe failures → AskUserQuestion: Fix regressie (Aanbevolen) | Accepteren (markeer als known) | Rollback fix
- Geen failures → door naar Step 3

### Step 3: Manual verification (alleen bij FASE 7 skip)

Suggest manual verification steps gebaseerd op het problem type uit FASE 1.
Vraag user te bevestigen dat de fix het oorspronkelijke probleem oplost.

---

## FASE 10: Completion

> **Todo**: markeer FASE 9 → `completed`, FASE 10 → `in_progress`.

### Step 1: Learning Extraction

Per resolved bug, evalueer of root cause + fix cross-feature waarde heeft. Filter:

- **Wel extracten**: race conditions, validation gaps, API contract mismatches, dep-version bugs, framework gotchas, async/timing issues
- **Niet extracten**: typo fixes, eenmalige config waardes, project-specifieke wiring, merge conflicts

**Append** naar `project-context.json` → `learnings[]`:

```json
{
  "date": "YYYY-MM-DD",
  "feature": "{active feature uit FASE 0, of directory primary segment van fix locatie}",
  "type": "pitfall",
  "source": "extracted",
  "summary": "{root cause + waar de fix zat, max 200 chars}"
}
```

**Dedup** (per `shared/LEARNING-EXTRACTION.md`): tokenize summary → check tegen bestaande `learnings[]` met zelfde `(type, normalize(summary), author)` tuple. Match → skip.

Geen relevante pitfall → skip step zonder waarschuwing.

### Step 2: Scoped Commit

Vergelijk `git status --porcelain | sort` met `.project/session/pre-debug-status.txt`:

- **NEW** (alleen in current) → `git add -f` (`.project/` is gitignored, `-f` vereist)
- **OVERLAP** (in beide, gewijzigd door deze debug-run) → `git add`
- **PRE-EXISTING** (alleen in baseline) → niet stagen

Baseline niet gevonden → fallback: vraag user welke files gerelateerd zijn aan de fix.

```bash
git commit -m "fix({feature}): {issue summary uit FASE 1}

Root cause: {samenvatting uit FASE 3}
Reproduction test: {pad, of 'skipped: {reden}'}
Learning: {pitfall summary, of 'geen'}"
```

`{feature}` = active feature naam uit FASE 0, of weglaten als standalone debug.

Clean up: `rm -f .project/session/pre-debug-status.txt`

### Step 3: Output

```
DEBUG COMPLETE: {issue}
========================
Root cause: {samenvatting uit FASE 3}
Fix: {wat er gewijzigd is, file:line refs}
Reproduction test: {pad, of "skipped: {reden}"}
Regression: {N tests, X PASS, Y FAIL}
Learning: {pitfall summary toegevoegd, of "geen extractie"}

Next steps:
  1. /dev-verify {feature} → herverificatie als feature actief
  2. /dev-build {feature} → als rebuild nodig is
```

> **Todo**: markeer FASE 10 → `completed`.
