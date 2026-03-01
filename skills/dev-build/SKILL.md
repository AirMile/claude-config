---
name: dev-build
description: Build features with TDD or implementation-first per requirement. Use with /dev-build or /dev-build [feature-name] after /dev-define.
disable-model-invocation: true
metadata:
  author: mileszeilstra
  version: 1.3.0
  category: dev
---

# Build

**FASE 2** of the dev workflow: define -> **build** -> test

Auto-detects stack from CLAUDE.md, selects technique per requirement (TDD or Implementation First), builds sequentially.

**Trigger**: `/dev-build` or `/dev-build [feature-name]`

## Input

Reads `.project/features/{feature-name}/feature.json`: requirements (REQ-XXX), architecture, implementation order.

## Output

```
.project/features/{feature-name}/
└── feature.json    # Enriched with build, packages, tests.checklist sections
```

## Process

### FASE 0: Context Loading

**Capture git baseline** (eerste actie):

```bash
mkdir -p .project/session
git rev-parse HEAD > .project/session/pre-skill-sha.txt
```

**Detect stack:** lees CLAUDE.md `### Stack` sectie + `.claude/research/stack-baseline.md` (als beschikbaar).

**Load feature:**

If no feature name provided:

1. Parse `.project/backlog.html` (zie `shared/BACKLOG.md`). Filter `status === "DEF"` → suggest via **AskUserQuestion**
2. Fallback: list `.project/features/` met `feature.json`, let user select

Load `feature.json`. Extract: `requirements[]`, `buildSequence[]`, `files[]`, `testStrategy[]`.

Niet gevonden → exit: "Run `/dev-define` eerst."

**Dependency check:**

Skip als geen `depends[]` of leeg.

1. Parse `.project/backlog.html`. Niet gevonden → skip.
2. Per dependency: status moet `"TST"` of `"DONE"` zijn.
3. Blockers gevonden → **AskUserQuestion**:
   - "Stop — werk eerst {dep} af (Recommended)" / "Toch doorgaan"
   - Stop → exit. Doorgaan → continue.

**Display** feature overview:

```
FEATURE: {feature-name}

REQUIREMENTS:
- REQ-001: {description}
  ...

IMPLEMENTATION ORDER:
(from buildSequence, sorted by step)
```

### FASE 1: Technique Mapping

Assign per requirement:

- **TDD**: validation rules, business logic, calculations, complex conditions, testable math
- **Implementation First**: CRUD, middleware, config, wiring, visual/particle effects

Display technique map table. Confirm via **AskUserQuestion** (Akkoord / Aanpassen).

Bij "Aanpassen": vraag per requirement welke technique.

### FASE 2: Execute Build

For each requirement in IMPLEMENTATION ORDER:

1. Load technique: `Read(".claude/skills/dev-build/techniques/{technique}.md")`
2. Execute technique workflow
3. Enforce: strict TS (geen any, null checks), async error handling, geen secrets in client code
4. **Update feature.json** na elke REQ: zet `requirements[].status` → `"built"` en voeg `technique` + `syncNote` toe. Dit bewaart voortgang bij context compaction.
5. Output per requirement:
   ```
   [REQ-XXX] {description}
   Technique: {TDD | Implementation First}
   {technique-specific output}
   SYNC: {pattern/concept} in {file(s)} — {what, why, what depends on it}
   Progress: {done}/{total}
   ```

**Edge cases:**

- **Combined steps** (e.g. "REQ-002 + REQ-003"): build als één unit. Technique = die van het eerste REQ in de combinatie.
- **Already covered**: als een REQ al (deels) werkt door een eerder REQ → schrijf alleen tests, verify GREEN. Output: `RED: N/A (covered by REQ-XXX)`

**After all requirements:** run volledige test suite. Verify geen regressies.

**On test failure:** fix, re-run. Continue alleen op PASS.

**On blocker:** log in feature.json `build.blockers[]`, mark BLOCKED, ga door met andere requirements. Suggest `/thinking-decide` voor architecturele blockers.

### FASE 3A: Documentation

**Build summary** — display:

```
BUILD COMPLETE: {feature}
========================
Techniques: TDD ({n}), Implementation First ({n})
Tests: {passed}/{total} PASS
Files created: {count}
```

### FASE 3B: Codebase Sync

De gebruiker moet begrijpen hoe de feature werkt voor goede beslissingen in test- en refactor-fases.

**Uitleg** — alsof je het aan een student uitlegt:

- **Wat doet het?**: 1-2 zinnen, geen jargon
- **Hoe ziet het eruit?**: 1-2 ASCII diagrammen (max 15 regels). Box-drawing chars (┌─┐│└─┘) en pijlen (→ ← ↓ ↑).
- **Hoe werkt het onder de motorkap?**: data flow stap voor stap, concrete voorbeelden
- **Waar moet je op letten?**: alleen niet-voor-de-hand-liggende keuzes — _waarom_, niet _wat_

**Begripscheck** via **AskUserQuestion**:

Vraag: "Snap je hoe de feature werkt?"
Opties: "Ja, helder" / "Leg het uitgebreider uit" / "Ik heb een vraag"

Follow-up loop tot "Ja, helder". Sla uitleg op als `build.explanation` in feature.json.

### FASE 3C: Project Sync

**Context sync** (zie `shared/DASHBOARD.md` → `context`):

Vergelijk build output met `.project/project.json`. Update direct (geen confirmatie):

- Files/directories → `context.structure` (overwrite)
- Routes → `context.routing` (overwrite)
- Non-obvious patterns → `context.patterns` (merge)
- `context.updated` → huidige datum

Skip als geen structurele impact of geen `project.json`. Log: `context: {N} updates ({keys})`.

**Backlog sync** (zie `shared/BACKLOG.md`): status → `"BLT"`, `data.updated` → nu.

**Dashboard sync** (zie `shared/DASHBOARD.md`):

- Feature status → `"BLT"`
- Endpoints → `"done"` als geïmplementeerd
- Stack packages → push nieuwe dependencies

**Architecture sync:**

- Diagram bestaat → update met werkelijke implementatie
- Geen diagram EN meerdere modules → genereer Mermaid `graph TD`
- Geen structurele impact → skip
- Log: `architecture: updated` of `architecture: no updates needed`

**Write feature.json** (read-modify-write):

1. Read huidige `feature.json`
2. Update: `status → "BLT"`, `files[]` → merge met actuele bestanden
3. Add: `build {}` (started, completed, techniques, testsPass, testsTotal, decisions, explanation), `packages[]`, `tests.checklist[]` (status: "pending")
4. Write terug — bestaande secties NIET overschrijven

Note: `requirements[]` hoeft hier niet meer enriched — dat is al per-REQ gedaan in FASE 2 stap 4.

### FASE 3D: Scoped Commit

**Strategie**: stage alleen files die door deze build zijn aangemaakt of gewijzigd. Laat pre-existing dirty files met rust.

```bash
git status --porcelain
```

Categoriseer elke file:

1. **Check baseline**: vergelijk met de SHA uit `.project/session/pre-skill-sha.txt`:
   ```bash
   git diff --name-only $(cat .project/session/pre-skill-sha.txt) HEAD 2>/dev/null
   ```
   Bestanden die NIET in deze diff staan EN al dirty waren → PRE-EXISTING, niet stagen.
2. **Nieuwe/gewijzigde bestanden van deze feature** (bestanden uit `feature.json files[]`, test files, project config) → `git add`.
3. **Untracked bestanden** die niet bij de feature horen → niet stagen.

Als baseline SHA niet bestaat → fallback: vergelijk met `feature.json files[]` lijst.

```bash
git commit -m "build({feature}): {n} requirements ({tdd} TDD, {impl} impl-first)"
```

Clean up: `rm -f .project/session/pre-skill-sha.txt`

**No Co-Authored-By footer on pipeline commits.**

## Test Output Parsing

Condense test output:

**PASS:** `TESTS: {n}/{n} PASS ({time})`

**FAIL:**

```
TESTS: {passed}/{total} PASS ({time})
FAILED:
- {file}:{line} - {reason <50 chars}
```
