# Mature Mode

Eenmalige scan van een bestaande codebase. Bouwt base memory op door volledige codebase scan + LLM-extractie van conventies en patterns. Aangevuld met CLAUDE.md-completeness check en Claude-config init.

**`--no-llm` flag**: Skip FASE 4 (LLM extractie). Alleen MVP signalen (TODO/FIXME, fix-commits, abstraction-dirs, wrapper-deps). Sneller maar mist naming/error/response-shape patterns.

Zie `shared/SYNC.md`, `shared/DASHBOARD.md`, en `shared/LEARNING-EXTRACTION.md` voor protocollen.

---

## FASE 0: Pre-flight

> **Todo**: roep `TodoWrite` aan met de fase-items. Markeer FASE 0 → `in_progress`.

1. **Detect git repo**:

   ```bash
   git rev-parse --show-toplevel
   ```

   Geen git repo → exit met error: `core-setup mature mode requires a git repository`.

2. **Check `.project/` state**:
   - Bestaat `.project/project.json`? → onthoud als `has_project_json`.
   - Bestaat `.project/project-context.json`? → onthoud als `has_context_json`.
   - Bestaande `learnings[]` count → onthoud als `existing_learning_count`.

3. **Confirm intent** (als `existing_learning_count > 0`):

   AskUserQuestion:
   - header: "Onboard"
   - question: "`.project/project-context.json` heeft al {N} learnings. Mature mode voegt ALLEEN nieuwe entries toe (dedup op summary), maar is bedoeld als first-time scan. Doorgaan?"
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

### FASE 4.5: Context fabricate + confirm

> **Todo**: markeer FASE 4 → `completed`, FASE 4.5 → `in_progress`.

Infer project metadata uit beschikbare bronnen zodat user geen wizard hoeft te doorlopen. Lees:

- `README.md`: eerste H1 als naam-kandidaat, eerste alinea na de titel als pitch-kandidaat
- `package.json`: `name` als naam-fallback, `description` als pitch-fallback
- FASE 1 scan-resultaat: dir naam als naam-fallback-fallback
- FASE 2a: gedetecteerd `stack.framework` / `stack.language`
- FASE 2f: gedetecteerde `stack.packages`

Stel samen:

```
concept.name       ← README H1 | package.json#name | dir naam
concept.pitch      ← README eerste alinea | package.json#description | ""
concept.conceptFile← "project-concept.md"
stack.framework    ← FASE 2a
stack.language     ← FASE 2a (afgeleid van framework + package.json engines)
stack.packages     ← FASE 2f
```

Toon één AskUserQuestion (multi-select) met elk geïnfereerd veld als checkbox:

- header: "Context"
- question: "Dit heb ik afgeleid uit de bestaande code en README. Welke velden wil je accepteren?"
- opties: per veld één checkbox met `label: "{veld}: {waarde}"`, default allemaal aan
- multiSelect: true

Voor geselecteerde velden: schrijf naar `project.json`. Gedeselecteerde velden blijven leeg (user vult later in via `/thinking-concept`).

Maak `.project/project-concept.md` aan met de geaccepteerde pitch-tekst als startpunt (gewone markdown, geen sjabloon).

### FASE 5: Sync

> **Todo**: markeer FASE 4.5 → `completed`, FASE 5 → `in_progress`.

Volg `shared/SYNC.md` protocol. Re-read `project.json` en `project-context.json` direct vóór write.

**5a) Dedup en cap**

Voor elke nieuwe entry uit FASE 3 + FASE 4:

- Compute dedup-key: `(type, normalize(summary), author ?? null)`
- Check tegen bestaande `learnings[]` → match → skip
- Intra-run dedup → skip
- Cap totaal nieuwe entries op **50**. Bij overschrijding: prioriteer pitfalls > LLM patterns > MVP patterns > observations.

**5b) Write project files**

- `project.json`: update `concept`, `stack`, `data.entities`, `endpoints` (uit FASE 2 + 4.5)
- `project-context.json`: update `context.structure`, `context.routing`, `context.patterns`, `architecture.components`, append `learnings[]`
- `context.updated` → vandaag

Skip-worktree herstel zoals in `core-pull` FASE 0.

**5c) Save sync state**

```bash
echo '{"lastSync":"<ISO timestamp>"}' > .project/session/sync-state.json
```

Maakt latere `/core-pull` runs incremental vanaf nu.

### FASE 5.5: CLAUDE.md compleetheids-check

> **Todo**: markeer FASE 5 → `completed`, FASE 5.5 → `in_progress`.

Volg `references/claude-md-sync.md` met deze parameters:

- `mode: "mature"`
- `generate-if-missing: true`
- `stack-overwrite: "ask"`
- `inferred-stack:` stack-object uit FASE 2 (framework, language, packages)

FASE D produceert een compacte samenvatting voor het FASE 6 rapport.

### FASE 5.6: Claude-config init

> **Todo**: markeer FASE 5.5 → `completed`, FASE 5.6 → `in_progress`.

Geen interactieve permission-wizard in mature mode — defaults zijn veilig, user past achteraf aan.

**Check en schrijf alleen als ontbrekend:**

- `.claude/settings.local.json` niet aanwezig → schrijf met Full Access defaults:

  ```json
  {
    "permissions": {
      "allow": [
        "Read *",
        "Edit *",
        "Write *",
        "Bash(npm *)",
        "Bash(npx *)",
        "Bash(git *)"
      ],
      "deny": ["Edit node_modules/**", "Write dist/**", "Write build/**"]
    }
  }
  ```

  Stack-specifieke aanpassingen: Python → voeg `Bash(python *)`, `Bash(pip *)` toe; Go → `Bash(go *)`.

- `.claude/hooks/format-on-save.cjs` niet aanwezig → schrijf hook op basis van gedetecteerde stack. Formatter mapping: zie `mode-greenfield.md` Phase 5 tabel.

Als beide al bestaan: skip deze fase volledig, toon "Claude config: al aanwezig — overgeslagen".

### FASE 5.7: Setup Task Seeding (frontend projects only)

> **Todo**: markeer FASE 5.6 → `completed`, FASE 5.7 → `in_progress`.

**Trigger**: `stack.framework` uit FASE 2a is een frontend framework (React, Vue, Svelte, Next.js, Nuxt, Astro, Remix, SolidJS). Anders skip volledig.

**Compute**: `needsTheme` = `project.json#theme` heeft geen `colors` of is leeg. Skip als `needsTheme = false`.

**Seed** `setup-design-tokens` feature naar `.project/backlog.html` — zelfde JSON-blok als greenfield Phase 7c stap 2:

```json
{
  "name": "setup-design-tokens",
  "type": "THEME",
  "status": "TODO",
  "phase": "P1",
  "description": "Define color palette, typography scale, and spacing tokens via /frontend-tokens before UI work begins.",
  "source": "/core-setup",
  "dependencies": [],
  "auto": true
}
```

Maak backlog aan uit template `{skills_path}/shared/references/backlog-template.html` als die ontbreekt. Skip als feature met naam `setup-design-tokens` al bestaat (idempotent).

Geen interactieve modal — toon alleen `Setup-task toegevoegd aan backlog` in stdout. De FASE 6 rapport "Next steps" sectie toont vervolgens automatisch de `/frontend-tokens` bullet.

Markeer FASE 5.7 → `completed`.

---

### FASE 6: Report

> **Todo**: markeer FASE 5.7 → `completed`, FASE 6 → `in_progress`.

**Render-regels** voor het rapport hieronder:

- Bullets met `{if <conditie>}` prefix: skill evalueert conditie, rendert bullet alleen bij `true`. De `{if X}`-prefix wordt **niet** letterlijk in de output getoond.
- Bullets zonder prefix: altijd renderen.

**Conditie-syntax:**

- `<path> leeg` — true als value `null`, `undefined`, lege string `""`, lege array `[]`, of object zonder eigen keys `{}`
- `<path> = <waarde>` — strikte equality check
- `&&` / `||` — logische operatoren met short-circuit evaluatie
- Undefined operand bij `&&` → `false`; bij `||` → wordt overgeslagen
- `<naam>` zonder operator → boolean variabele berekend in eerder FASE (bijv. `needsTheme` uit FASE 5.7)

| Conditie                              | Bullet              |
| ------------------------------------- | ------------------- |
| (geen — altijd)                       | `/core-pull`        |
| `concept.pitch` leeg                  | `/thinking-concept` |
| `features[]` leeg                     | `/dev-define`       |
| frontend stack && `needsTheme = true` | `/frontend-tokens`  |

```
ONBOARD COMPLETE

Project: {project-name}
Mode:    mature (full scan {+ LLM extraction | --no-llm})

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

CLAUDE.md:     {gegenereerd | {N} secties toegevoegd | al compleet}
Claude config: {settings.local.json + hook aangemaakt | al aanwezig}

Updated: {date}

Next steps:
  • /core-pull              — incremental updates (sync state staat aan)
{if concept.pitch leeg}  • /thinking-concept   — vul concept pitch aan
{if features[] leeg}     • /dev-define         — definieer de eerste feature
{if frontend && needsTheme}  • /frontend-tokens — design tokens (color, typography, spacing)
```

Markeer FASE 6 → `completed`.

---

## Edge cases

- **Geen `.project/project.json`**: maak aan met leeg schema (zie `shared/DASHBOARD.md`) vóór FASE 1.
- **Geen git repo**: exit met error.
- **Hele kleine codebase (<10 files)**: skill draait door, FASE 4 LLM extraction geeft 0-2 entries. Geen probleem.
- **Geen package.json / requirements.txt**: skip wrapper-deps detectie (FASE 3d).
- **Subagent failure**: log warning, ga door zonder LLM learnings. MVP signalen blijven.
- **Cap overschreden** (>50 nieuwe learnings): rapport vermeldt expliciet, user kan FASE 4 herhalen na review/cleanup.

## Notes

- Bewust eenmalig: na een succesvolle mature run worden incrementele changes door `/core-pull` opgepakt.
- LLM extraction kost ~25-50K tokens via Sonnet subagent. Zonder `--no-llm` flag is dit default-on.
- Geen author voor LLM-inferred learnings: pattern is codebase-wide observatie.
- Author === git user → skip (eigen werk in eigen project — geen "synced" learning).
