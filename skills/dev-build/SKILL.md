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

**Signal active feature** (na feature naam bepaling):

```bash
echo '{"feature":"{feature-name}","skill":"build","startedAt":"{ISO timestamp}"}' > .project/session/active-{feature-name}.json
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
2. Per dependency: status moet `"DONE"` zijn.
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

### FASE 3B: Project Sync

Lees parallel (skip als niet bestaat):

- `.project/features/{feature-name}/feature.json`
- `.project/backlog.html`
- `.project/project.json`

Muteer alle drie in memory:

**feature.json**: `status → "BLT"`, `files[]` → merge met actuele bestanden. Add: `build {}` (started, completed, techniques, testsPass, testsTotal, decisions), `packages[]`, `tests.checklist[]`. Bestaande secties NIET overschrijven. Note: `requirements[]` is al enriched in FASE 2 stap 4.

**tests.checklist[]** — per requirement minimaal 1 test item:

```json
{
  "id": 1,
  "title": "beschrijving van wat te verifiëren",
  "requirementId": "REQ-XXX",
  "steps": ["navigeer naar /pad", "vul X in", "klik op Y"],
  "expected": "verwacht zichtbaar resultaat (redirect, melding, data in UI)",
  "status": "pending"
}
```

Richtlijnen:

- Schrijf steps als USER ACTIES (navigeer, klik, vul in), niet als code (assert, expect)
- Expected = wat de gebruiker ZOU ZIEN, niet wat een unit test checkt
- UI features: beschrijf browser-interacties
- API features: beschrijf curl/HTTP stappen met concrete endpoints
- Voeg GEEN item toe dat "run npm test" is — unit tests zijn al gedekt door de build

**Backlog** (zie `shared/BACKLOG.md`): status → `"BLT"`, `data.updated` → nu.

**Context** (zie `shared/DASHBOARD.md` → `context`): vergelijk build output met project.json. Update `context.structure` (overwrite), `context.routing` (overwrite), `context.patterns` (merge), `context.updated`. Skip als geen structurele impact. Log: `context: {N} updates ({keys})`.

**Dashboard** (zie `shared/DASHBOARD.md`): feature status → `"BLT"`, endpoints → `"done"` als geïmplementeerd, stack packages → push nieuwe dependencies.

**Architecture** (**volg diagram conventies uit `shared/DASHBOARD.md`**): diagram bestaat → update: gebouwde feature nodes `:::planned` → `:::done`, voeg file reference toe aan node label (`Naam<br/>file.js`), update `architecture.files` met `{ component, src, test }`, update `description` met functionele tekst. Geen diagram EN meerdere modules → genereer nieuw diagram met classDef + subgraphs. Geen structurele impact → skip. Log: `architecture: updated` of `architecture: no updates needed`.

Schrijf parallel terug:

- Write `feature.json`
- Edit `backlog.html` (keep `<script>` tags intact)
- Write `project.json`

### FASE 3C: Begripscheck

**STOP — ga NIET door naar de commit zonder deze fase volledig af te ronden.**

Display een visuele separator:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
BEGRIPSCHECK
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

**Stap 1 — Uitleg displayen (verplicht, niet overslaan)**

De gebruiker moet begrijpen hoe de feature werkt voor goede beslissingen in test- en refactor-fases. Display de volgende uitleg alsof je het aan een student uitlegt:

- **Wat doet het?**: 1-2 zinnen, geen jargon
- **Hoe ziet het eruit?**: 1-2 ASCII diagrammen (max 15 regels). Box-drawing chars (┌─┐│└─┘) en pijlen (→ ← ↓ ↑).
- **Hoe werkt het onder de motorkap?**: data flow stap voor stap, concrete voorbeelden
- **Waar moet je op letten?**: alleen niet-voor-de-hand-liggende keuzes — _waarom_, niet _wat_

**Stap 2 — Begripscheck (verplicht, niet overslaan)**

**AskUserQuestion** direct na de uitleg:

Vraag: "Snap je hoe de feature werkt?"
Opties: "Ja, helder" / "Leg het uitgebreider uit" / "Ik heb een vraag"

Follow-up loop tot "Ja, helder". Sla uitleg op als `build.explanation` in feature.json (targeted Edit).

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

Clean up: `rm -f .project/session/pre-skill-sha.txt .project/session/active-{feature-name}.json`

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
