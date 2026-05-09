# Mature Mode

Eenmalige scan van een bestaande codebase met vroege Module Gap-modal en optionele auto dev-tool installs. Bouwt base memory op door volledige codebase scan + LLM-extractie van conventies en patterns. Aangevuld met CLAUDE.md-completeness check en Claude-config init.

**`--no-llm` flag**: Skip FASE 4 (LLM extractie). Alleen MVP signalen (TODO/FIXME, fix-commits, abstraction-dirs, wrapper-deps). Sneller maar mist naming/error/response-shape patterns.

Zie `shared/SYNC.md`, `shared/DASHBOARD.md`, en `shared/LEARNING-EXTRACTION.md` voor protocollen.

---

## Process

**Fase tracking** — eerste actie van de skill: roep `TaskCreate` aan met deze 15 items (status `pending`), daarna gebruik `TaskUpdate` om per fase `in_progress` te zetten aan begin en `completed` aan einde. Bij context compaction blijft de task list zichtbaar — geen risico op vergeten fases.

1. FASE 0: Pre-flight
2. FASE 0.5: Project Status Snapshot
3. FASE 0.6: Module Gap Ask
4. FASE 1: Full structure scan
5. FASE 2: Full route/entity/endpoint/component scan
6. FASE 3: MVP learnings
7. FASE 4: LLM learnings via subagent
8. FASE 4.5: Context fabricate + confirm
9. FASE 5: Sync
10. FASE 5.5: CLAUDE.md compleetheids-check
11. FASE 5.6: Claude-config init
12. FASE 5.65: Auto Dev Tools
13. FASE 5.7: Setup Task Seeding
14. FASE 5.75: Legacy github-project.json migratie
15. FASE 5.8: Module Gap Install
16. FASE 6: Report

## FASE 0: Pre-flight

> **Todo**: roep `TaskCreate` aan met de 15 fase-items (zie boven). Markeer FASE 0 → `in_progress` via `TaskUpdate`.

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
     - "Annuleren" — "Liever incrementele pull via `/project-pull`"
   - multiSelect: false

   Bij annuleren → exit.

4. **Read `git config user.name`** → `GIT_USER` (voor author filter en self-skip).

### FASE 0.4: .gitignore bootstrap

Alle Claude-gerelateerde files zijn per-developer lokaal (niet gecommit). Check idempotent:

```bash
grep -qxF 'CLAUDE.md' .gitignore 2>/dev/null || echo 'CLAUDE.md' >> .gitignore
grep -qxF '.claude/' .gitignore 2>/dev/null || echo '.claude/' >> .gitignore
grep -qxF '.project/' .gitignore 2>/dev/null || echo '.project/' >> .gitignore
```

**Als per-developer files al gecommit zijn** (check via `git ls-files`):

```bash
TRACKED=$(git ls-files | grep -E '^(\.claude/|\.project/|CLAUDE\.md$)' | head -20)
```

Als `TRACKED` niet leeg is, toon AskUserQuestion (single-select):

```yaml
header: "Per-developer files in git"
question: "De volgende files staan in git maar horen per-developer lokaal te zijn:\n{TRACKED}\nVerwijderen uit git (bestanden blijven lokaal)?"
options:
  - label: "Ja, verwijder uit git (Recommended)"
    description: "git rm --cached -- <files> — bestanden blijven lokaal, teammates krijgen eigen versie via core-setup"
  - label: "Nee, laat staan"
    description: "Files blijven gecommit — niet aanbevolen bij team-repos"
multiSelect: false
```

Bij "Ja": `git rm --cached -- $(echo "$TRACKED" | tr '\n' ' ')`

### FASE 0.5: Project Status Snapshot

> **Todo**: markeer FASE 0 → `completed`, FASE 0.5 → `in_progress`.

Lees `.project/project.json` als die bestaat, anders skip volledig.

Bouw een compacte status-tabel uit `stack.framework`, `stack.styling`, `stack.testing`, `stack.linting`, `stack.state`, `stack.forms`, en `stack.componentLibrary`. Per slot:

- Gevuld → "✓ {waarde}"
- Leeg → "— (leeg)"
- Niet relevant voor stack → niet tonen (forms voor backend overslaan etc.)

Output format:

```
PROJECT STATUS

Framework:    {framework}
Language:     {language}

Stack slots:
  Styling           ✓ {waarde} | — (leeg)
  UI components     ✓ {waarde} | — (leeg)
  Testing (unit)    ✓ {waarde} | — (leeg)
  Testing (e2e)     ✓ {waarde} | — (leeg)
  Linting           ✓ {waarde} | — (leeg)
  State (client)    ✓ {waarde} | — (leeg)
  State (server)    ✓ {waarde} | — (leeg)
  Forms             ✓ {waarde} | — (leeg)

Learnings:    {existing_learning_count}
Last sync:    {sync-state.json#lastSync of "nooit"}
```

Geen modal hier — alleen visibility. FASE 0.6 hieronder gebruikt deze snapshot direct voor de Module Gap-modal.

Onthoud de lege slots als `gap_slots[]` voor gebruik in FASE 0.6.

Markeer FASE 0.5 → `completed`.

### FASE 0.6: Module Gap Ask

> **Todo**: markeer FASE 0.5 → `completed`, FASE 0.6 → `in_progress`.

**Trigger:** ten minste één relevant slot in `gap_slots[]` (uit FASE 0.5) is leeg. Anders: sla `gap_choices = []` op en markeer FASE 0.6 → `completed` zonder modal.

**Slot-relevantie** per framework:

| Framework                        | Relevante slots                                                                                  |
| -------------------------------- | ------------------------------------------------------------------------------------------------ |
| React/Vue/Svelte (frontend SPA)  | styling, componentLibrary, testing.unit, testing.e2e, linting, state.client, state.server, forms |
| Next.js/Nuxt/Astro/Remix         | als boven                                                                                        |
| Backend (Express/Fastify/Django) | testing.unit, linting                                                                            |
| Game/CLI/Desktop/Mobile          | testing.unit, linting                                                                            |

Filter `gap_slots[]`:

- Slot al gevuld in `project.json#stack` → skip
- Slot niet-relevant voor framework → skip
- Tier-1 module al geïnstalleerd in `package.json` maar niet in stack-slot → skip stilletjes (FASE 5 sync vult dit alsnog op)

**Multi-select modal** (volg Modal Option Cap uit SKILL.md; ≤7 slots = één modal, >7 = split per categorie-groep):

```yaml
header: "Module gaps"
question: "Deze tier-1 categorieën zijn nog niet ingevuld. Wat wil je toevoegen? (leeg laten = niets installeren)"
options:
  # Per leeg relevant slot één optie met de Recommended tier-1 module:
  - label: "Styling: Tailwind (Recommended)"
    description: "Utility-first CSS framework"
  - label: "UI components: shadcn-ui (Recommended)"
    description: "Copy-paste componenten op Tailwind + Radix"
  - label: "Testing (unit): Vitest (Recommended)"
    description: "Fast Vite-native unit tester"
  - label: "Testing (e2e): Playwright (Recommended)"
    description: "End-to-end browser testing"
  - label: "Linting: Biome (Recommended)"
    description: "Lint + format in één tool"
  - label: "State (client): Zustand (Recommended)"
    description: "Minimale client state"
  - label: "State (server): TanStack Query (Recommended)"
    description: "Server state + caching"
  - label: "Forms: react-hook-form + zod (Recommended)"
    description: "Form validatie met schema"
multiSelect: true
```

Toon alleen de opties voor lege relevante slots — niet alle 8 altijd.

Sla user-keuze op in `gap_choices[]` (lijst van module-namen). **Geen install hier** — alleen capture.

**Persisteer naar disk** (overleven context compaction):

```bash
mkdir -p .project/session
echo '{"gapChoices":<JSON-array>}' > .project/session/onboard-state.json
```

Toon mini-confirm:

```
Module Gap keuze opgeslagen: {gap_choices.join(", ") | "geen"}
Install volgt op FASE 5.8 (na sync + learnings).
```

Markeer FASE 0.6 → `completed`.

### FASE 1: Full structure scan

> **Todo**: markeer FASE 0.6 → `completed`, FASE 1 → `in_progress`.

Glob de project root voor file tree. Bouw een compacte structure string:

- Exclude: `node_modules`, `.git`, `.project`, `dist`, `build`, `.next`, `vendor`, `__pycache__`, `.godot`
- Eén-regel comment per directory die het doel beschrijft (genereer uit dir naam + readme indien aanwezig)
- Format: identiek aan `project-pull` FASE 3a / `DASHBOARD.md` `context.structure` schema

Overwrite `context.structure` volledig.

### FASE 2: Full route/entity/endpoint/component scan

> **Todo**: markeer FASE 1 → `completed`, FASE 2 → `in_progress`.

Hergebruik logica uit `project-pull` FASE 4d/e/f, maar op ALLE source files (niet alleen teammate-changed):

**2a) Stack detectie** uit bestaande `project.json.stack.framework` of, als ontbreekt, uit `package.json` dependencies / `requirements.txt` / `project.godot`. Schrijf naar `stack.framework`.

**2b) Routes** — Glob alle route files volgens stack mapping (`project-pull` FASE 3b tabel). Extract route patterns. Overwrite `context.routing`.

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

Als `.project/backlog.html` al bestaat (non-frontend projecten die FASE 5.7 overslaan): read backlog.html → parse `<script id="backlog-data">` JSON → zet `data.flags.hasConcept = true` + `data.flags.conceptPath = ".project/project-concept.md"` → edit terug (script-tags intact). Dit laat de `/project-plan` knop verschijnen in het backlog dashboard.

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

Skip-worktree herstel zoals in `project-pull` FASE 0.

**5c) Save sync state**

```bash
echo '{"lastSync":"<ISO timestamp>"}' > .project/session/sync-state.json
```

Maakt latere `/project-pull` runs incremental vanaf nu.

### FASE 5.5: CLAUDE.md compleetheids-check + migratie

> **Todo**: markeer FASE 5 → `completed`, FASE 5.5 → `in_progress`.

**Stap 1 — Standaard sync:**

Volg `references/claude-md-sync.md` met deze parameters:

- `mode: "mature"`
- `generate-if-missing: true`
- `stack-overwrite: "ask"`
- `inferred-stack:` stack-object uit FASE 2 (framework, language, packages)

FASE D produceert een compacte samenvatting voor het FASE 6 rapport.

**Stap 2 — Legacy marker migratie (éénmalig):**

Scan de huidige `CLAUDE.md` op verouderde marker-blokken die niet meer in `CLAUDE.base.md` horen:

- `<!-- claude-config:section:language-policy start/end -->`
- `<!-- claude-config:section:communication-style start/end -->`
- `<!-- claude-config:section:smart-suggestions start/end -->`
- `<!-- claude-config:section:command-execution-rules start/end -->`

Bij aanwezigheid: AskUserQuestion (multi-select):

```yaml
header: "Legacy CLAUDE.md secties gevonden"
question: "Deze secties zijn verplaatst naar ~/.claude/CLAUDE.md en hoeven niet meer per project. Wat wil je doen?"
options:
  - label: "Verwijder uit project CLAUDE.md (Recommended)"
    description: "Secties horen in ~/.claude/CLAUDE.md (al aanwezig via bootstrap). Project CLAUDE.md wordt ~30 regels korter."
  - label: "Laat staan"
    description: "Secties blijven lokaal aanwezig — geen effect op werking"
multiSelect: false
```

Bij "Verwijder": strip de marker-blokken (content tussen start/end markers inclusief de markers zelf).

Bij "Laat staan": skip.

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

### FASE 5.65: Auto Dev Tools

> **Todo**: markeer FASE 5.6 → `completed`, FASE 5.65 → `in_progress`.

Mirror van greenfield Phase 5b — detect dev-tools die auto-install krijgen op een nieuw project, maar nu opt-in op mature.

**Detect:**

- `stack.framework` bevat "React" + "Vite" of is "Next.js"
- `@anthropic-ai/inspect-overlay` ontbreekt in zowel `dependencies` als `devDependencies` van `package.json`

Beide condities waar → toon AskUserQuestion (single-select, met "Let Claude decide"):

```yaml
header: "Inspect overlay"
question: "Een nieuw {framework}-project krijgt @anthropic-ai/inspect-overlay automatisch. Dit project heeft het niet. Installeren?"
options:
  - label: "Installeer (Recommended)"
    description: "Mirror van greenfield default — zelfde DX als nieuw project"
  - label: "Skip"
    description: "Niet installeren"
multiSelect: false
```

**Bij "Installeer" of "Let Claude decide":**

```
Read("references/modules/inspect-overlay/setup-guide.md")
```

Volg setup-guide volledig. Voor Vite: Babel-mode. Voor Next.js: full Babel mode (waarschuw user dat Turbopack uitgeschakeld wordt).

**Sync naar project.json:**

- Lees nieuwe `package.json#devDependencies["@anthropic-ai/inspect-overlay"]` versie
- Append aan `project.json#stack.packages[]`: `{ name: "@anthropic-ai/inspect-overlay", version: "<gelezen>", purpose: "Dev overlay (inspect mode)" }`
- Skip als entry met dezelfde `name` al bestaat (idempotent bij retry)

Voeg `inspect-overlay` toe aan `installed_in_session[]`.

**Conditie niet getriggerd of "Skip":** geen actie.

Niet uitbreiden naar andere libraries — tier-1 modules met stack-slot lopen via FASE 0.6/5.8. FASE 5.65 is uitsluitend voor dev-tools zonder stack-slot.

Markeer FASE 5.65 → `completed`.

### FASE 5.7: Setup Task Seeding (frontend projects only)

> **Todo**: markeer FASE 5.65 → `completed`, FASE 5.7 → `in_progress`.

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
  "dependencies": []
}
```

Maak backlog aan uit template `{skills_path}/shared/references/backlog-template.html` als die ontbreekt. Skip als feature met naam `setup-design-tokens` al bestaat (idempotent).

Zet altijd `data.flags.hasConcept = true` en `data.flags.conceptPath = ".project/project-concept.md"` in het backlog JSON-blok (ook als het design-tokens item al bestond). Dit laat de `/project-plan` knop verschijnen.

Geen interactieve modal — toon alleen `Setup-task toegevoegd aan backlog` in stdout. De FASE 6 rapport "Next steps" sectie toont vervolgens automatisch de `/frontend-tokens` bullet.

Markeer FASE 5.7 → `completed`.

### FASE 5.75: Legacy github-project.json migratie

> **Todo**: markeer FASE 5.7 → `completed`, FASE 5.75 → `in_progress`.

**Trigger**: `.project/github-project.json` bestaat. Anders skip volledig.

```bash
test -f .project/github-project.json && echo "found"
```

**Bij aanwezig:**

1. Read `.project/github-project.json` als JSON.
2. Read `.project/project.json` → `data.team` sectie.
3. Schrijf velden naar `data.team.githubProject`:

   ```json
   "githubProject": {
     "owner": "<github_project.json owner>",
     "repo": "<github_project.json repo>",
     "projectNumber": "<github_project.json projectNumber of null>",
     "defaultAssignee": "<github_project.json defaultAssignee of null>"
   }
   ```

4. Write `project.json` terug.
5. Verplaats het bestand naar archief:

   ```bash
   mkdir -p .project/.archive
   mv .project/github-project.json .project/.archive/github-project.json
   ```

Geen prompt — silent migration. Toon alleen `Legacy github-project.json gemigreerd naar project.json#team.githubProject` in stdout.

Markeer FASE 5.75 → `completed`.

### FASE 5.8: Module Gap Install

> **Todo**: markeer FASE 5.7 → `completed`, FASE 5.8 → `in_progress`.

**Lees `gap_choices[]` terug:** open `.project/session/onboard-state.json`, parse `gapChoices`. Bestand niet aanwezig of leeg array → behandel als `gap_choices = []`.

**Trigger:** `gap_choices[]` is niet leeg. Anders skip volledig naar FASE 6.

**Eén keer:**

```
Read("references/mode-install.md")
```

**Per module in `gap_choices[]`:** volg uitsluitend `mode-install.md` **FASE 5** stap 0-5 (state check → install → configure → verify → sync project context). **Skip de TaskCreate van 7 items bovenaan mode-install.md** — die hoort bij standalone install mode. Werk de stappen inline binnen dit mature TaskCreate-item; voeg geen nieuwe TaskList toe en muteer geen mature todos.

Mocht mode-install.md verwijzen naar zijn eigen FASE 0/1/2/3/4/6/7 — overslaan. Die zijn voor standalone install runs.

Onthoud geïnstalleerde modules als `installed_in_session[]` voor gebruik in FASE 6 rapport. Eén pass — geen automatische herhaling.

**Cleanup:**

```bash
rm -f .project/session/onboard-state.json
```

**Niet in scope:**

- Research-mode libraries (Pad B) — user die niet-tier-1 wil moet `/core-setup [free-text]` gebruiken
- Categorieën zonder stack-slot (Routing, Animation, Icons, Auth, i18n, Analytics)

Markeer FASE 5.8 → `completed`.

---

### FASE 6: Report

> **Todo**: markeer FASE 5.8 → `completed`, FASE 6 → `in_progress`.

**Render-regels** voor het rapport hieronder:

- Bullets met `{if <conditie>}` prefix: skill evalueert conditie, rendert bullet alleen bij `true`. De `{if X}`-prefix wordt **niet** letterlijk in de output getoond.
- Bullets zonder prefix: altijd renderen.

**Conditie-syntax:**

- `<path> leeg` — true als value `null`, `undefined`, lege string `""`, lege array `[]`, of object zonder eigen keys `{}`
- `<path> = <waarde>` — strikte equality check
- `&&` / `||` — logische operatoren met short-circuit evaluatie
- Undefined operand bij `&&` → `false`; bij `||` → wordt overgeslagen
- `<naam>` zonder operator → boolean variabele berekend in eerder FASE (bijv. `needsTheme` uit FASE 5.7)

| Conditie                              | Bullet                                          |
| ------------------------------------- | ----------------------------------------------- |
| (geen — altijd)                       | `/project-pull`                                 |
| `concept.pitch` leeg                  | `/thinking-concept`                             |
| `features[]` leeg                     | `/dev-define`                                   |
| frontend stack && `needsTheme = true` | `/frontend-tokens`                              |
| `installed_in_session[]` niet leeg    | toon "Modules toegevoegd: {list}" onder Updated |

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
{if installed_in_session[] niet leeg}  Modules toegevoegd: {installed_in_session[]}

Next steps:
  • /project-pull              — incremental updates (sync state staat aan)
{if concept.pitch leeg}  • /thinking-concept   — vul concept pitch aan
{if features[] leeg}     • /dev-define         — definieer de eerste feature
{if frontend && needsTheme}  • /frontend-tokens — design tokens (color, typography, spacing)
```

Markeer FASE 6 → `completed`.

> **Todo**: markeer FASE 6 → `completed`.

---

## Edge cases

- **Geen `.project/project.json`**: maak aan met leeg schema (zie `shared/DASHBOARD.md`) vóór FASE 1.
- **Geen git repo**: exit met error.
- **Hele kleine codebase (<10 files)**: skill draait door, FASE 4 LLM extraction geeft 0-2 entries. Geen probleem.
- **Geen package.json / requirements.txt**: skip wrapper-deps detectie (FASE 3d).
- **Subagent failure**: log warning, ga door zonder LLM learnings. MVP signalen blijven.
- **Cap overschreden** (>50 nieuwe learnings): rapport vermeldt expliciet, user kan FASE 4 herhalen na review/cleanup.

## Notes

- Bewust eenmalig: na een succesvolle mature run worden incrementele changes door `/project-pull` opgepakt.
- LLM extraction kost ~25-50K tokens via Sonnet subagent. Zonder `--no-llm` flag is dit default-on.
- Geen author voor LLM-inferred learnings: pattern is codebase-wide observatie.
- Author === git user → skip (eigen werk in eigen project — geen "synced" learning).
