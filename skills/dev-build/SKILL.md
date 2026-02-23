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

Reads `.project/features/{feature-name}/01-define.md`: requirements (REQ-XXX), architecture, implementation order.

## Output

```
.project/features/{feature-name}/
├── 01-define.md
├── 02-build-log.md
└── 03-test-checklist.md
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
2. Otherwise → list features in `.project/features/`, let user select

Load `01-define.md`. Extract requirements, architecture, implementation order. Display:

```
FEATURE: {feature-name}

REQUIREMENTS:
- REQ-001: [description]
  ...

IMPLEMENTATION ORDER:
(from 01-define.md)
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

**On blocker:** log in build-log, mark BLOCKED, continue with other requirements. Suggest `/thinking-decide` for architectural blockers.

### FASE 3: Generate Test Checklist

Create `03-test-checklist.md` met:

- Build summary (feature, date, techniques, test count)
- Automated tests status table (REQ | Technique | Test | Status)
- Files created/modified
- Manual testing checklist
- Feedback format: `/dev-test {feature}` met `1:PASS` / `2:FAIL {reason}`

### FASE 4A: Documentation

**Build log** — create `02-build-log.md`:

- Summary table (feature, date, techniques, tests)
- Per requirement: technique, files, tests, SYNC
- Integration test results
- Blockers (of "Geen")
- Codebase Sync section (placeholder, filled in 4B)

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

**Na bevestiging:** schrijf sync naar `02-build-log.md` onder `## Codebase Sync` in gewone taal.

### FASE 4C: Project Sync

**CLAUDE.md Auto-Sync:**

Compare build output against CLAUDE.md. Update directly (no confirmation):

- New files → `## Project structuur`
- New routes → `## Routing`
- New non-obvious patterns → `## Non-obvious patterns`
- New env vars/config → relevant section

Quality rules (core-md-audit): project-specific only, one line per item, concise. Skip if no structural impact or no CLAUDE.md exists.

Log: `CLAUDE.md: {N} updates ({sections})` of `CLAUDE.md: no updates needed`

**Backlog sync** (zie `shared/BACKLOG.md`): parse JSON uit `.project/backlog.html`, zet feature `.status = "BLT"`, update `data.updated`.

**Dashboard sync** (zie `shared/DASHBOARD.md`): read `.project/project.json` (skip als niet bestaat).

- Features: zet status naar `"BLT"`
- Endpoints: update status naar `"done"` als endpoints geïmplementeerd (skip als geen endpoints)
- Stack packages: push nieuwe dependencies
- Write `.project/features/{feature-name}/build.json` met build data

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
