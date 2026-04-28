---
name: core-onboard
description: >-
  First-time onboarding to a mature codebase. Full project scan voor structure,
  entities, endpoints, components én diepe LLM-extractie van learnings (naming
  conventions, error handling, response shapes, architectuur patterns). Use
  with /core-onboard. Voor incrementele pulls: gebruik /core-pull.
disable-model-invocation: true
argument-hint: "[--no-llm]"
metadata:
  author: mileszeilstra
  version: 1.0.0
  category: core
---

# Onboard

Eenmalige skill voor het binnenstappen van een mature codebase. Bouwt base memory op door volledige codebase scan + LLM-extractie van conventies en patterns die niet uit incrementele pulls te halen zijn.

**Trigger**: `/core-onboard` of `/core-onboard --no-llm`

**`--no-llm` flag**: Skip FASE 4 (LLM extractie). Alleen MVP signalen (TODO/FIXME, fix-commits, abstraction-dirs, wrapper-deps). Sneller en gratis maar mist naming/error/response-shape patterns.

**Wanneer gebruiken:**

- Eerste keer dat je een bestaand project binnenstapt (internship, nieuwe baan, open source contribution)
- Project zonder bestaande `.project/project-context.json`
- Context is zo stale dat incrementele pull niet helpt

**Verschil met `/core-pull`:**

| Aspect      | `/core-pull` (incremental)  | `/core-onboard` (eenmalig) |
| ----------- | --------------------------- | -------------------------- |
| Frequentie  | Dagelijks                   | 1× per project             |
| Scope       | Diff sinds laatste pull     | Hele codebase              |
| LLM-tokens  | 0 of ~5K (signal-triggered) | ~25-50K (eenmalig)         |
| Cap         | 20 nieuwe learnings         | 50 nieuwe learnings        |
| Output bias | Updates op bestaand         | Bootstrap from scratch     |

## References

- `shared/SYNC.md` — merge protocol (read-modify-write per section)
- `shared/DASHBOARD.md` — project.json + project-context.json schema
- `shared/LEARNING-EXTRACTION.md` — heuristieken voor MVP signalen + LLM extractie

## Process

### FASE 0: Pre-flight

> **Todo**: roep `TodoWrite` aan met de 6 fase-items. Markeer FASE 0 → `in_progress`.

1. **Detect git repo**:

   ```bash
   git rev-parse --show-toplevel
   ```

   Geen git repo → exit met error: `core-onboard requires a git repository`.

2. **Check `.project/` state**:
   - Bestaat `.project/project.json`? → onthoud als `has_project_json`. Niet bestaat → run `/core-setup` advies.
   - Bestaat `.project/project-context.json`? → onthoud als `has_context_json`.
   - Bestaande `learnings[]` count → onthoud als `existing_learning_count`.

3. **Confirm intent** (als `existing_learning_count > 0`):

   AskUserQuestion:
   - header: "Onboard"
   - question: "`.project/project-context.json` heeft al {N} learnings. Onboard zal ALLEEN nieuwe entries toevoegen (dedup op summary), maar dit is bedoeld als first-time scan. Doorgaan?"
   - options:
     - "Doorgaan (Recommended)" — "Volledige scan, dedup tegen bestaande learnings"
     - "Annuleren" — "Liever incrementele pull via `/core-pull`"
   - multiSelect: false

   Bij annuleren → exit.

4. **Read `git config user.name`** → `GIT_USER` (voor author filter en self-skip).

### FASE 1: Full structure scan

> **Todo**: markeer FASE 0 → `completed`, FASE 1 → `in_progress`.

Glob de project root voor file tree. Bouw een compacte structure string:

- Exclude: `node_modules`, `.git`, `.project`, `dist`, `build`, `.next`, `vendor`, `__pycache__`, `.godot`
- Eén-regel comment per directory die het doel beschrijft (genereer uit dir naam + readme indien aanwezig)
- Format: identiek aan `core-pull` FASE 3a / `DASHBOARD.md` `context.structure` schema

Overwrite `context.structure` volledig.

### FASE 2: Full route/entity/endpoint/component scan

> **Todo**: markeer FASE 1 → `completed`, FASE 2 → `in_progress`.

Hergebruik logica uit `core-pull` FASE 4d/e/f, maar op ALLE source files (niet alleen teammate-changed):

**2a) Stack detectie** uit bestaande `project.json.stack.framework` of, als ontbreekt, uit `package.json` dependencies / `requirements.txt` / `project.godot`. Schrijf naar `stack.framework`.

**2b) Routes** — Glob alle route files volgens stack mapping (`core-pull` FASE 3b tabel). Extract route patterns. Overwrite `context.routing`.

**2c) Entities** — Glob model files (Mongoose/Prisma/Sequelize/Django/GDScript). Extract entities met source field. Merge naar `data.entities[]`.

**2d) Endpoints** — Per stack: extract method+path. Hergebruik route file content uit 2b. Merge naar `endpoints[]`.

**2e) Components** — Glob `**/services/**`, `**/lib/**`, `**/utils/**`, `**/repositories/**`, etc. Group per directory naam. Extract sources + matching test files. Merge naar `architecture.components[]` met `connects_to[]` waar afleidbaar.

**2f) Packages** — Lees `package.json` / `requirements.txt` volledig. Voor elke entry niet in `stack.packages[]`: push `{ name, version, purpose: "dependency" }`.

### FASE 3: MVP learnings (regex/AST)

> **Todo**: markeer FASE 2 → `completed`, FASE 3 → `in_progress`.

Heuristieken: zie [shared/LEARNING-EXTRACTION.md](../shared/LEARNING-EXTRACTION.md).

**3a) Fix-commit pitfalls** (laatste 6 maanden):

```bash
git log --since="6 months ago" --grep='^fix\|^bugfix' --format='%H|%an|%s%n%b' --no-merges
```

Per commit: filter author ≠ `GIT_USER`. Filter body ≥10 woorden OF root-cause keyword. Output `{ type: "pitfall", source: "synced", author, feature: <primary-dir>, summary }`.

**3b) TODO/FIXME comments** (alle source files):

```bash
grep -rn -E '(TODO|FIXME|HACK|XXX|NOTE):' <source-tree>
```

Voor elke match: `git blame --porcelain -L <line>,<line> <file>` om author te bepalen. Filter ≠ `GIT_USER`, filter ≥10 woorden + werkwoord-clue. Output pitfalls.

**3c) Abstraction-dirs**:

Vergelijk component lijst uit FASE 2e tegen mapping table in `LEARNING-EXTRACTION.md`. Voor elke gematchte directory keyword: emit `{ type: "pattern", source: "synced", author: <eerste commit author>, feature: <dir>, summary: "<Pattern label> in <path> (<N> files)" }`.

**3d) Wrapper-deps**:

Voor elke entry in `package.json` dependencies: lookup in wrapper mapping table. Match → emit pattern (author = `null` want deps zijn historisch).

### FASE 4: LLM learnings via subagent

> **Todo**: markeer FASE 3 → `completed`, FASE 4 → `in_progress`.

Skip volledig als `--no-llm` flag gezet.

**4a) Selecteer representative files**

Per component uit FASE 2e: kies 5-10 representative files. Criteria:

- File size > 50 LOC (skip stubs)
- Niet test-files (`*.test.*`, `*.spec.*`, `__tests__/**`)
- Niet generated code (look for `// generated` comments, `*.d.ts` als ge-importeerd uit deps)
- Bias naar core/services/routes/models directories

Cap totaal: max 50 files over alle components.

**4b) Roep `learning-extractor` agent aan**

Via Agent tool:

- `subagent_type: "learning-extractor"`
- prompt:
  ```
  mode: "onboard"
  files: [<absolute paden>]
  existing_learnings: <huidige learnings[]>
  cap: 50
  ```

Subagent draait op Sonnet (zie `agents/learning-extractor.md`), output JSON `[{type, summary, evidence}]`.

**4c) Parse en verrijk**

Voor elke entry uit subagent output:

- Zet `source: "synced"`, `author: null` (codebase-wide), `date: <today>`, `feature: <eerste-segment-uit-evidence>`
- Append aan extractie-resultaten

Bij subagent failure (timeout, geen JSON) → log waarschuwing, ga door zonder LLM learnings.

### FASE 5: Sync

> **Todo**: markeer FASE 4 → `completed`, FASE 5 → `in_progress`.

Volg `shared/SYNC.md` protocol. Re-read `project.json` en `project-context.json` direct vóór write.

**5a) Dedup en cap**

Voor elke nieuwe entry uit FASE 3 + FASE 4:

- Compute dedup-key: `(type, normalize(summary), author ?? null)`
- Check tegen bestaande `learnings[]` → match → skip
- Intra-run dedup → skip
- Cap totaal nieuwe entries op **50**. Bij overschrijding: prioriteer pitfalls > LLM patterns > MVP patterns > observations.

**5b) Write project files**

- `project.json`: update `stack`, `data.entities`, `endpoints` (uit FASE 2)
- `project-context.json`: update `context.structure`, `context.routing`, `context.patterns`, `architecture.components`, append `learnings[]`
- `context.updated` → vandaag

Skip-worktree herstel zoals in `core-pull` FASE 0.

**5c) Save sync state**

```bash
echo '{"lastSync":"<ISO timestamp>"}' > .project/session/sync-state.json
```

Maakt latere `/core-pull` runs incremental vanaf nu.

### FASE 6: Report

> **Todo**: markeer FASE 5 → `completed`, FASE 6 → `in_progress`.

```
ONBOARD COMPLETE

Project: {project-name}
Mode:    full project scan {+ LLM extraction | --no-llm}

Context:
  Structure:    refreshed ({N} dirs)
  Routing:      {N} routes
  Patterns:     {N} auto, {M} manual

Deep analysis:
  Entities:     {N} total
  Endpoints:    {N} total
  Architecture: {N} components
  Packages:     {N} total

Learnings:
  Pitfalls:     {N} ({A} from fix-commits, {B} from TODO/FIXME)
  Patterns:     {N} ({C} abstraction-dirs, {D} wrapper-deps, {E} LLM)
  Observations: {N}
  Total new:    {N} (capped at 50)
  Authors:      {list, of "codebase-wide" voor LLM-inferred}

Updated: {date}
```

**Suggestie aan user**:

> Base memory is opgebouwd. Run `/core-promote-learnings` om patterns die ook in andere projecten voorkomen te promoten naar globale memory (`~/.claude/memory/MEMORY.md`).

Markeer FASE 6 → `completed`.

## Edge cases

- **Geen `.project/project.json`**: exit met advies om eerst `/core-setup` te runnen.
- **Geen git repo**: exit met error.
- **Hele kleine codebase (<10 files)**: skill draait door, FASE 4 LLM extraction zal weinig output geven (verwacht 0-2 entries). Geen probleem.
- **Geen package.json / requirements.txt**: skip wrapper-deps detectie (FASE 3d).
- **Subagent failure**: log warning, ga door zonder LLM learnings. MVP signalen blijven.
- **Cap overschreden** (>50 nieuwe learnings): rapport vermeldt expliciet, user kan FASE 4 herhalen na review/cleanup.

## Notes

- Bewust eenmalig: na een succesvolle onboard worden incrementele changes door `/core-pull` opgepakt.
- LLM extraction kost ~25-50K tokens via Sonnet subagent. Zonder `--no-llm` flag is dit default-on want het is de belangrijkste reden om onboard te runnen.
- Geen author voor LLM-inferred learnings: pattern is codebase-wide observatie, niet aan één persoon toe te schrijven.
- Author === git user → skip (eigen werk in eigen project — geen "synced" learning).
