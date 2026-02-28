---
name: dev-build
description: Build features with TDD or implementation-first per requirement. Use with /dev-build after /dev-define.
disable-model-invocation: true
metadata:
  author: mileszeilstra
  version: 1.1.0
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

**Capture git baseline** (eerste actie — voor context loading):

```bash
mkdir -p .project/session
git status --porcelain | sort > .project/session/pre-skill-status.txt
```

**Step 1: Detect Stack**

Read CLAUDE.md. Parse `### Stack` under `## Project` for engine/framework, language, and test runner.

**Step 2: Load Context**

Load `.claude/research/stack-baseline.md` if exists.

**Step 3: Load Feature**

If no feature name provided:

1. Read `.project/backlog.html` (if exists), parse JSON uit `<script id="backlog-data">` blok (zie `shared/BACKLOG.md`). Filter `status === "DEF"` features → suggest first via **AskUserQuestion**
2. Otherwise → list features in `.project/features/` die `feature.json` hebben, let user select

Load `feature.json`. Extract:

- `requirements[]` → requirement lijst
- `buildSequence[]` → implementatievolgorde (gesorteerd op step)
- `files[]` → bestanden om te maken/wijzigen
- `testStrategy[]` → test mapping

If `feature.json` not found → exit met bericht om `/dev-define` eerst te runnen.

Display:

```
FEATURE: {feature-name}

REQUIREMENTS:
- REQ-001: [requirements[0].description]
  ...

IMPLEMENTATION ORDER:
(from feature.json buildSequence, sorted by step)
```

**Step 4: Frontend Scan** (web projects only)

Skip als geen `app/**/page.tsx` of `src/pages/**/*.tsx` bestaan.

Als bestanden uit "Files to Create" al geïmporteerd worden door pagina's: toon impact, vraag via AskUserQuestion of user bewust wil bouwen (respecteer bestaande styling) of eerst pagina's wil reviewen.

### FASE 1: Technique Mapping

Assign per requirement:

- **TDD**: validation rules, business logic, calculations, complex conditions, testable math
- **Implementation First**: CRUD, middleware, config, wiring, visual/particle effects

Display technique map table. Confirm via **AskUserQuestion** (Akkoord / Aanpassen).

Bij "Aanpassen": toon requirements opnieuw, vraag per requirement welke technique met **AskUserQuestion**.

### FASE 2: Execute Build

For each requirement in IMPLEMENTATION ORDER:

1. Load technique: `Read(".claude/skills/dev-build/techniques/{technique}.md")`
2. Execute technique workflow
3. If build sequence combines requirements (e.g., "REQ-002 + REQ-003"), build as single unit — apply the technique of the primary requirement
4. If a requirement's behavior is already (partly) implemented by an earlier REQ: write tests only (skip RED, verify GREEN). Output: `RED: N/A (covered by REQ-XXX)`
5. Apply `.claude/skills/shared/RULES.md` Algemeen (R007-R008) + TypeScript (T001-T103) rules
6. Output per requirement:
   ```
   [REQ-XXX] {description}
   Technique: {TDD | Implementation First}
   {technique-specific output}
   SYNC: {pattern/concept} in {file(s)} — {what, why, what depends on it}
   Progress: {done}/{total}
   ```

After all requirements: run integration tests across requirements.

**On test failure:** fix implementation, re-run. Continue only on PASS.

**On blocker:** log in feature.json build.blockers array, mark BLOCKED, continue with other requirements. Suggest `/thinking-decide` for architectural blockers.

### FASE 3: Build Summary

Collect build data for `feature.json` (written in FASE 4C):

- `tests.checklist[]`: per test item — `id`, `title`, `requirementId`, `steps`, `expected`, `status: "pending"`
- `requirements[]`: per REQ — enrich met `technique`, `syncNote`, `status: "built"`
- `files[]`: update met actuele bestanden (merge met bestaande files uit define)
- `build.integrationTests`: results
- `build.blockers`: lijst (of lege array)
- `packages[]`: nieuwe dependencies (`name`, `version`, `purpose`)
- `build.decisions`: niet-voor-de-hand-liggende keuzes

### FASE 4A: Documentation

**Build summary** — display to user:

```
BUILD COMPLETE: {feature}
========================
Techniques: TDD ({n}), Implementation First ({n})
Tests: {passed}/{total} PASS
Files created: {count}
```

### FASE 4B: Codebase Sync

Het doel: de gebruiker begrijpt hoe de feature werkt voor goede beslissingen in test- en refactor-fases.

**4B-1) Uitleg** — alsof je het aan een student uitlegt. Vier onderdelen:

- **Wat doet het?**: 1-2 zinnen, geen jargon
- **Hoe ziet het eruit?**: 1-2 ASCII diagrammen (max 15 regels per diagram). Kies meest relevant type: data flow, component diagram, of state diagram. Gebruik box-drawing characters (┌─┐│└─┘) en pijlen (→ ← ↓ ↑).
- **Hoe werkt het onder de motorkap?**: data flow stap voor stap, met concrete voorbeelden
- **Waar moet je op letten?**: alleen niet-voor-de-hand-liggende keuzes — _waarom_, niet _wat_

**4B-2) Begripscheck** via **AskUserQuestion**:

Vraag: "Snap je hoe de feature werkt?"
Opties: "Ja, helder" / "Leg het uitgebreider uit" / "Ik heb een vraag"

**4B-3) Follow-up loop** — beantwoord vragen, herhaal begripscheck tot "Ja, helder".

**Na bevestiging:** sla de sync uitleg op als `build.explanation` veld in feature.json (plain markdown string met ASCII diagrammen).

### FASE 4C: Project Sync

**Context sync** (zie `shared/DASHBOARD.md` → `context` sectie):

Compare build output against `.project/project.json` context. Update directly (no confirmation):

- New files/directories → `context.structure` (overwrite full tree)
- New routes → `context.routing` (overwrite full array)
- New non-obvious patterns → `context.patterns` (merge: add new, update existing)
- Set `context.updated` to current date

Quality rules: project-specific only, one line per item, concise. Skip if no structural impact or no `.project/project.json` exists.

Log: `context: {N} updates ({keys})` of `context: no updates needed`

**Backlog sync** (zie `shared/BACKLOG.md`): parse JSON uit `.project/backlog.html`, zet feature `.status = "BLT"`, update `data.updated`.

**Dashboard sync** (zie `shared/DASHBOARD.md`): read `.project/project.json` (skip als niet bestaat).

- Features: zet status naar `"BLT"`
- Endpoints: update status naar `"done"` als endpoints geïmplementeerd (skip als geen endpoints)
- Stack packages: push nieuwe dependencies

**Architecture sync** (na dashboard sync):

- Lees huidige `architecture.diagram` uit project.json
- Als diagram bestaat: update met werkelijke implementatie (nieuwe routes, services, file structure)
- Als diagram niet bestaat EN project heeft meerdere modules/services: genereer nieuw Mermaid `graph TD`
- Input: `context.structure` + `context.routing` + geïmplementeerde bestanden
- Output: bijgewerkt `architecture.diagram` + `architecture.description` (OVERWRITE)
- Skip als geen structurele impact (bijv. alleen een utility functie toegevoegd)
- Log: `architecture: updated` of `architecture: no updates needed`

**Write feature.json** (read-modify-write):

1. Read `.project/features/{feature-name}/feature.json`
2. Update bestaande secties:
   - `status` → `"BLT"`
   - `requirements[]` → enrich elke REQ met `technique`, `syncNote`, `status: "built"`
   - `files[]` → merge met actuele bestanden (nieuwe files toevoegen, bestaande updaten)
3. Voeg nieuwe secties toe:
   - `build`: `{ started, completed, techniques: { tdd, implementationFirst }, testsPass, testsTotal, decisions, explanation }` (`explanation` = de codeSyncExplanation markdown)
   - `packages[]`: nieuwe dependencies
   - `tests.checklist[]`: test items met `status: "pending"`
4. Write `feature.json` terug (NIET andere secties overschrijven)

### FASE 4D: Scoped Commit

Compare current git status with baseline:

```bash
git status --porcelain | sort > /tmp/current-status.txt
```

Categorize files vs `.project/session/pre-skill-status.txt`:

- **NEW** (only in current, not in baseline) → `git add`
- **OVERLAP** (same filename in both, regardless of status) → warn user via AskUserQuestion, ask if own changes may be staged
- **PRE-EXISTING** (only in baseline) → do NOT stage
- **Gitignored** (in .gitignore) → skip, do not stage

If baseline file doesn't exist, fall back to `git add -A`.

```bash
git commit -m "build({feature}): {n} requirements ({tdd} TDD, {impl} impl-first)"
```

Clean up: `rm -f .project/session/pre-skill-status.txt /tmp/current-status.txt`

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

## Stack-Specific Behavior

Determine test commands, file extensions, mocking approach from:

1. `### Testing` section in CLAUDE.md
2. Stack-baseline (`.claude/research/stack-baseline.md`)
3. Claude's own knowledge
