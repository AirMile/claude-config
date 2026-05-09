---
name: game-debug
description: >-
  Systematic debugging for Godot projects with reproduction-test-first workflow,
  root cause analysis, and 3 fix strategies. Use for runtime errors, physics
  bugs, signal issues, or scene tree problems.
reads: [project-context.learnings, feature.requirements]
writes: [project-context.learnings]
metadata:
  author: mileszeilstra
  version: 3.0.0
  category: game
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
- Lees `.claude/research/architecture-baseline.md`

**Project context** (optioneel, skip als niet bestaat):

- Lees `.project/project.json` → extract:
  - `stack` (engine, language, packages)
  - `data.entities` (names, fields, relations)
- Lees `.project/project-context.json` (als bestaat) → extract:
  - `context` (structure, patterns)
  - `architecture` (diagram, files)

**Active feature detectie** (optioneel):

- Check `.project/session/active-*.json` files
- Fallback: lees `.project/backlog.html` → zoek meest recente `"DOING"` feature (features met `-ing` stage suffix zijn actief)
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
- current-feature: {active feature naam, of "none"}

Render LEARNINGS_CONTEXT block. Skip stilletjes als geen `project-context.json`.

**Stel DEBUG_CONTEXT samen** (alle info beschikbaar voor inline investigation):

```
STACK: {engine} ({language}) — {packages}
ARCHITECTURE: {baseline patterns of "niet beschikbaar"}
PATTERNS: {context.patterns of "niet beschikbaar"}
STRUCTURE: {context.structure of "niet beschikbaar"}
ACTIVE FEATURE: {feature naam + status of "geen"}
REQUIREMENTS: {requirements ids + descriptions, of "niet beschikbaar"}
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
  - "Runtime Error" — Crashes, GDScript errors, null references
  - "Logic Bug" — Verkeerde game behavior, state issues
  - "Performance Issue" — FPS drops, memory leaks, physics lag
  - "Scene/Signal Issue" — Node connections, signal flow, scene tree problemen

### Step 2: Details (per type)

**Runtime Error:**
AskUserQuestion:

- header: "Error Details"
- question: "Welke informatie heb je over de error?"
- options:
  - "Ik heb een error message" — Exacte foutmelding uit Godot console
  - "Ik heb een stack trace" — Volledige stack trace beschikbaar
  - "Ik heb beide" — Error message en stack trace
  - "Ik heb alleen een screenshot" — Visuele weergave van de error

Then: ask user to share the details.

**Logic Bug:**
AskUserQuestion:

- header: "Gedrag Details"
- question: "Beschrijf het verschil tussen verwacht en werkelijk gedrag:"
- options:
  - "Ik weet exact wat er fout gaat" — Expected vs actual beschrijfbaar
  - "Game state klopt niet" — Verkeerde waarden, verkeerde state
  - "Actie werkt niet" — Input, collision, ability faalt
  - "Timing/volgorde fout" — Dingen gebeuren op verkeerd moment

Then: ask for specific expected vs actual behavior.

**Performance Issue:**
AskUserQuestion:

- header: "Performance Details"
- question: "Wanneer treedt het performance probleem op?"
- options:
  - "Bij specifieke actie" — Bepaalde ability, collision, of scene load
  - "Altijd traag" — Consistent lage FPS
  - "Na verloop van tijd" — Start soepel, wordt langzamer (memory leak)
  - "Bij veel nodes" — Alleen traag met veel instanties

Then: ask about scale/context details.

**Scene/Signal Issue:**
AskUserQuestion:

- header: "Scene/Signal Details"
- question: "Welk type verbindingsprobleem is dit?"
- options:
  - "Signal niet ontvangen" — Signal emitted maar receiver reageert niet
  - "Node niet gevonden" — get_node() of @onready faalt
  - "Scene tree corrupt" — Nodes verdwijnen, verkeerde parent, orphans
  - "Connect/disconnect" — Signals connecten of disconnecten niet correct

Then: ask for node paths, signal names, scene structure.

### Step 3: Bevestig samenvatting

Show summary of type + symptom + context + details gathered.

<!-- modal-buffer -->

Print 8 blank lines as whitespace buffer (keeps the summary above visible when the modal panel opens).

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

Spawn one Explore agent (`subagent_type="Explore"`) to investigate in an isolated context. This keeps source file reads and git output out of the main session.

**Thoroughness op basis van problem type (FASE 1):**

- Runtime Error met stack trace → `"medium"` (locatie al bekend via Godot console)
- Runtime Error zonder stack trace → `"very thorough"`
- Logic Bug / Performance Issue / Scene-Signal Issue → `"very thorough"` (oorzaak onduidelijk, brede scan)

Agent prompt:

```
Investigate this Godot bug. Perform 3 passes that build on each other.

DEBUG_CONTEXT:
{DEBUG_CONTEXT from FASE 0}

PROBLEM:
{problem summary from FASE 1}
{error message / stack trace / details}

PASS 1 — ERROR TRACE:
- Parse stack trace / error message → identify root location
- Read the source file at the error location (GDScript .gd files)
- Trace the call stack: what called this code? What signals trigger it?
- Map the exception/error flow: where is it caught (or not)?

PASS 2 — CONTEXT MAP (use locations from Pass 1):
- Read the scene tree: which nodes reference each other? Parent/child?
- Check signal connections: connect() calls, @onready vars, $NodePath references
- Trace data flow: exports, autoloads, Resources passed between scripts
- Identify external factors (physics layers, input actions, scene transitions)

PASS 3 — CHANGE ANALYSIS (use files from Pass 1+2):
- git log --oneline -10 -- {affected files}
- git blame {error location}
- Was this working before? What changed?
- Check KNOWN PITFALLS in DEBUG_CONTEXT: als een pitfall matcht op symptoom of locatie,
  vermeld dit als sterke hypothese — voeg toe als "Pitfall match: {summary}" in return format

RETURN FORMAT:
INVESTIGATION_START
Error location: {file:line}
Call stack: {caller → callee chain, including signals}
Root code: {the problematic code snippet, max 20 lines}
Scene tree: {relevant node hierarchy}
Signal flow: {signal chain involved}
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

**Skip als**: root cause is puur interne GDScript logica (geen Godot engine API's of add-on libraries betrokken) → ga direct naar FASE 5.

1. `mcp__context7__resolve-library-id` for Godot-related libraries
2. `mcp__context7__query-docs` for:
   - Known bugs/issues related to root cause
   - Best practices for Godot patterns
   - Recommended solutions

Focus: signal patterns → correct usage, scene tree lifecycle → proper node management, physics → collision layers/masks, state machines → proper implementation.

---

## FASE 5: Fix Plan Generation

> **Todo**: markeer FASE 4 → `completed`, FASE 5 → `in_progress`.

Launch 3 agents in parallel:

| Agent         | Philosophy           | Focus                                      |
| ------------- | -------------------- | ------------------------------------------ |
| fix-minimal   | "Kleinste wijziging" | Hotfix, minimal risk, fewest changes       |
| fix-thorough  | "Volledige fix"      | Root cause, add GUT tests, clean up        |
| fix-defensive | "Preventief"         | Safeguards, null checks, signal validation |

Each receives: root cause analysis + research findings + affected files.
Each returns: specific changes with file:line refs, risk (low/medium/high), scope, trade-offs,
AND: `Reproduction test assertion: {wat moet de GUT test asserten om de bug te bewijzen}`

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
  - "Thorough" — Volledige fix met root cause + GUT tests
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

**Doel**: bewijs de bug met een falende GUT test voor de fix. Maakt root cause concreet, voorkomt regressies, geeft objectief bewijs dat fix werkt.

### Step 1: Testbaarheid bepalen

Default voor Runtime Error / Logic Bug: skip de vraag, ga direct naar Step 2.

Voor Performance Issue / Scene-Signal Issue, AskUserQuestion:

- header: "Reproduction Test"
- question: "Is deze bug testbaar in een geautomatiseerde GUT test?"
- options:
  - "Ja, schrijf reproduction test (Aanbevolen)" — Standaard pad voor assertable bugs
  - "Nee, skip — Visueel / Rendering" — Geen assertion op game output mogelijk
  - "Nee, skip — Performance zonder FPS threshold" — Geen concrete meetwaarde definieerbaar
  - "Nee, skip — Productie-only state" — Niet reproduceerbaar in test omgeving

"Skip" gekozen → noteer `reproductionTest: { skipped: true, reason: "{reden}" }` en ga naar FASE 8.

### Step 2: Schrijf falende GUT test

- Locatie: `tests/regression/test_{slug}.gd`
- Class: `extends GutTest`
- Functienaam: `func test_{slug}_regression():`
- Assert: het **verwachte** gedrag (niet het buggy gedrag), gebruik assertion suggestie uit FASE 5
- Setup: reproduceer de minimale scene/node state die de bug triggerde

### Step 3: Run de test

```bash
godot --headless --path . -s addons/gut/gut_cmdln.gd -gtest=tests/regression/test_{slug}.gd
```

**Verwacht: FAIL voor de juiste reden** — match tegen FASE 3 root cause:

| Resultaat                                    | Reden                                                    | Actie                    |
| -------------------------------------------- | -------------------------------------------------------- | ------------------------ |
| FAIL met assert mismatch matching root cause | Bug correct gereproduceerd                               | ✓ Door naar FASE 8       |
| FAIL door parse/setup error                  | Test zelf is kapot                                       | Fix de test, run opnieuw |
| PASS onverwacht                              | Bug niet correct gereproduceerd of root cause klopt niet | Terug naar FASE 3        |

### Step 4: Bevestig

```
REPRODUCTION TEST: {bestand}:{functie}
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
godot --headless --path . -s addons/gut/gut_cmdln.gd -gtest=tests/regression/test_{slug}.gd
```

- PASS → fix bewijsbaar werkt voor de gereproduceerde bug
- FAIL → fix incompleet, terug naar FASE 8 (max 3 iteraties, daarna AskUserQuestion: Andere strategie | Meer research | Accepteren als incompleet)

### Step 2: Full GUT suite

**Skip als**: GUT add-on niet aanwezig (`addons/gut/` bestaat niet) → ga naar Step 3.

```bash
godot --headless --path . -s addons/gut/gut_cmdln.gd
```

- Nieuwe failures → AskUserQuestion: Fix regressie (Aanbevolen) | Accepteren (markeer als known) | Rollback fix
- Geen failures → door naar Step 3

### Step 3: Manual verification (alleen bij FASE 7 skip)

Suggest Godot-specifieke verificatiestappen gebaseerd op problem type (play scene, inspector check, Profiler snapshot, etc.).
Vraag user te bevestigen dat de fix het oorspronkelijke probleem oplost.

---

## FASE 10: Completion

> **Todo**: markeer FASE 9 → `completed`, FASE 10 → `in_progress`.

### Step 1: Learning Extraction

Per resolved bug, evalueer of root cause + fix cross-feature waarde heeft. Filter:

- **Wel extracten**: race conditions, signal timing issues, physics layer mismatches, null reference patterns, scene lifecycle bugs, GDScript gotchas
- **Niet extracten**: typo fixes, eenmalige config waardes, project-specifieke node paden, merge conflicts

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
  1. /game-verify {feature} → herverificatie als feature actief
  2. /game-build {feature} → als rebuild nodig is
```

> **Todo**: markeer FASE 10 → `completed`.
