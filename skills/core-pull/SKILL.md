---
name: core-pull
description: >-
  Pull git changes, analyze diff, sync .project context, deep-analyze teammate
  code (features, entities, endpoints, architecture), and extract synced
  learnings (pitfalls/patterns) from teammate commits. Use with /core-pull
  or /core-pull --no-learn. For first-time onboarding to a mature repo:
  use /core-onboard instead.
disable-model-invocation: true
argument-hint: "[remote/branch] [--no-learn]"
metadata:
  author: mileszeilstra
  version: 4.0.0
  category: core
---

# Pull

Pull remote changes, analyseer de diff, ververs `.project/` context, analyseer teammate code voor features, entities, endpoints en architectuur, en extract synced learnings uit teammate commits.

**Trigger**: `/core-pull`, `/core-pull [remote/branch]`, of `/core-pull --no-learn`

**`--no-learn` flag**: Skip FASE 4j (learning extraction). Gebruik als je alleen context/architecture wilt syncen zonder learnings te genereren.

**First-time onboarding (vervangt oude `--full` flag)**: gebruik `/core-onboard` voor volledig codebase scan + LLM learnings extractie wanneer je een mature repo binnenstapt.

## References

- `shared/SYNC.md` — merge protocol (read-modify-write per section)
- `shared/DASHBOARD.md` — project.json + project-context.json schema
- `shared/LEARNING-EXTRACTION.md` — heuristieken voor MVP signalen en LLM extractie (FASE 4j)

## Process

### FASE 0: Pre-flight

1. **Clean `.project/` files** (voorkom dat lokale .project/ wijzigingen stash/pull verstoren):

   ```bash
   git ls-files .project/ | xargs git update-index --no-skip-worktree 2>/dev/null
   git checkout -- .project/ 2>/dev/null
   git ls-files .project/ | xargs git update-index --skip-worktree 2>/dev/null
   ```

   Dit reset `.project/` naar HEAD en maakt ze onzichtbaar voor git. Veilig omdat FASE 3/4 de content altijd regenereert vanuit de broncode.

2. Check git status (`.project/` verschijnt niet meer door skip-worktree):

   ```bash
   git status --porcelain
   ```

   Als dirty → **AskUserQuestion**:
   - header: "Uncommitted"
   - question: "Er zijn uncommitted changes. Wat wil je doen?"
   - options:
     - "Stash (Recommended)" — "Stash changes, pull, dan re-apply"
     - "Commit eerst" — "Commit huidige changes voordat je pullt"
     - "Annuleren" — "Stop, ik fix dit zelf"
   - multiSelect: false

   Bij "Stash": `git stash push -u -m "core-pull auto-stash"` (`-u` voor untracked files). Na succesvolle pull in FASE 1: `git stash apply` (NIET `pop`). Bij apply success → `git stash drop`. Bij conflict na apply → meld en laat user resolven. **NOOIT de stash droppen bij conflict** — de stash blijft als vangnet.
   Bij "Commit eerst" → exit met instructie om `/core-commit` te runnen en daarna `/core-pull`.
   Bij "Annuleren" → exit.

3. Check remote:

   ```bash
   git remote -v
   git fetch 2>&1
   ```

   Als geen remote of fetch faalt → exit met error.

4. Check `.project/project-context.json` existence → onthoud als `has_context_json`. Fallback: check `.project/project.json` → onthoud als `has_project_json`.

5. **Onboard-nudge** (eenmalig per project, voor fresh codebases):

   ```bash
   total_commits=$(git rev-list --count HEAD 2>/dev/null || echo 0)
   ```

   Bepaal `learnings_empty`:
   - Als `has_context_json` = false → `learnings_empty = true`
   - Anders: lees `.project/project-context.json` → `learnings_empty = (learnings.length === 0)`

   Bepaal `dismissed`: check `.project/session/onboard-dismissed` bestaat.

   Bij `learnings_empty && total_commits > 50 && !dismissed` → **AskUserQuestion**:
   - header: "Onboard?"
   - question: "Dit lijkt een nieuwe codebase voor je ({N} commits, geen learnings). `/core-onboard` bouwt base memory uit conventies, patterns en pitfalls van bestaande code. Nu runnen?"
   - options:
     - "Ja, run /core-onboard nu (Recommended)" — exit core-pull met instructie aan user om `/core-onboard` te starten
     - "Nee, alleen pull" — ga door met FASE 1
     - "Niet meer vragen voor dit project" — schrijf `.project/session/onboard-dismissed` (lege marker file), ga door met FASE 1
   - multiSelect: false

   Bij "Ja": exit met message `RUN /core-onboard FOR BASE MEMORY (then re-run /core-pull for incremental updates)`. Geen pull/sync.

### FASE 1: Pull

Bewaar pre-pull ref:

```bash
PRE_REF=$(git rev-parse HEAD)
```

Pull:

```bash
git pull --rebase
```

Als conflicts → toon conflicting files, exit met instructie om conflicts te resolven en daarna `/core-pull` opnieuw te runnen.

**Bepaal of we doorgaan:**

- Pull had nieuwe commits → door naar FASE 2
- "Already up to date" EN (`has_context_json` OF `has_project_json`) = true → door naar FASE 2 met `force_full_scan = true` (context kan stale zijn)
- "Already up to date" EN geen van beide bestaan → exit:
  ```
  ALREADY UP TO DATE (no project-context.json or project.json — run /core-setup to initialize)
  ```

**Restore skip-worktree** na pull (ook als already up to date):

```bash
git ls-files .project/ | xargs git update-index --skip-worktree 2>/dev/null
```

Als gestasht in FASE 0: `git stash apply`. Bij success → `git stash drop`. Bij conflict → meld en exit (**stash NIET droppen** — blijft als vangnet).

### FASE 2: Diff Analysis

**Doel:** toon wat er veranderd is en bepaal welke context-secties een update nodig hebben.

**2a) Commits overzicht**

```bash
git log $PRE_REF..HEAD --oneline
```

Als geen commits (already up to date) → sla 2a/2b/2c over, ga naar 2d.

**2b) Changed files overzicht**

```bash
git diff $PRE_REF..HEAD --stat
git diff $PRE_REF..HEAD --name-status
```

Toon samenvatting aan de user:

```
PULL COMPLETE

Branch:  {branch} ← {remote/branch}
Commits: {N} new

  {hash} {message}
  {hash} {message}

Files: {N} changed ({added} added, {modified} modified, {deleted} deleted)
```

**2c) Categoriseer changed files**

Lees de `--name-status` output en categoriseer elk bestand:

| Categorie      | Match                                                                                                         | Impact              |
| -------------- | ------------------------------------------------------------------------------------------------------------- | ------------------- |
| **Structural** | Files met status A (added), D (deleted), of R (renamed/moved)                                                 | `context.structure` |
| **Route**      | `app/**/page.{tsx,jsx,ts,js}`, `app/**/route.{ts,js}`, `pages/**/*.{tsx,jsx,ts,js}`, `*.tscn`                 | `context.routing`   |
| **Config**     | `tsconfig.json`, `vite.config.*`, `next.config.*`, `.env.example`, `.nvmrc`, `.node-version`, `project.godot` | `context.patterns`  |
| **Code-only**  | Overige modified files (status M, geen match met bovenstaande)                                                | Geen context impact |

Route file patterns zijn stack-afhankelijk. Lees `stack.framework` uit `project.json` om te bepalen welke patterns relevant zijn.

**2d) Impact bepaling**

```
needs_structure = structural_files.length > 0 OF force_full_scan
needs_routing   = route_files.length > 0 OF force_full_scan
needs_patterns  = config_files.length > 0 OF force_full_scan
```

**Fallback:** als `$PRE_REF` niet beschikbaar is (eerste pull, shallow clone) → `force_full_scan = true`.

**2e) Detect teammate commits**

Determine if teammate analysis is needed.

```bash
GIT_USER=$(git config user.name)
```

Read `.project/session/sync-state.json` if exists → extract `lastSync`. If not exists → first run, set `SINCE` to 4 weeks ago.

Get teammate commits since last sync on the current branch:

```bash
git log HEAD --not --author="$GIT_USER" --since="$SINCE" --format="%H|%an|%s" --no-merges
```

Also get merge commits to detect feature branches:

```bash
git log HEAD --merges --since="$SINCE" --format="%H|%an|%s"
```

Store as `has_teammate_commits = true/false`. If zero teammate commits → skip FASE 4 (geen teammate enrichment nodig). Voor volledige codebase scan: gebruik `/core-onboard`.

### FASE 3: Context Sync

Skip volledig als noch `has_context_json` noch `has_project_json` = true. Toon:

```
SKIP CONTEXT SYNC (no project-context.json or project.json — run /core-setup to initialize)
```

Lees `.project/project-context.json`, parse JSON. Update `context` sectie gericht:

**3a) Structure scan** (alleen als `needs_structure`)

Scan de project root voor de file tree. Bouw een compacte structure string:

- Gebruik Glob tool voor directory discovery
- Exclude: node_modules, .git, .project, dist, build, .next, vendor, **pycache**, .godot
- Eén-regel comments per directory die het doel beschrijft
- Formaat: zelfde als in `DASHBOARD.md` context.structure schema

Overwrite `context.structure` volledig.

**3b) Route detection** (alleen als `needs_routing`)

Detect stack uit `project.json.stack.framework`.

| Stack                | Detectie methode                                             |
| -------------------- | ------------------------------------------------------------ |
| Next.js (App Router) | Scan `app/**/page.{tsx,jsx,ts,js}` → extract route patterns  |
| Next.js (Pages)      | Scan `pages/**/*.{tsx,jsx,ts,js}` → extract route patterns   |
| Express/Fastify      | Grep voor `router.get\|post\|put\|delete\|app.get\|app.post` |
| Godot                | Scan `*.tscn` scene files → extract scene tree               |
| Overig               | Skip routing, set `context.routing = []`                     |

Route formaat: `"/path" → Description` (arrow notation).

Overwrite `context.routing` volledig.

**Important:** if FASE 4 will also run (`has_teammate_commits`), retain the parsed route file contents in memory. FASE 4e reuses this data for endpoint extraction instead of re-reading the same files.

**3c) Pattern auto-detect** (alleen als `needs_patterns`)

Scan voor automatisch detecteerbare patterns:

| Bron                                      | Pattern                                 |
| ----------------------------------------- | --------------------------------------- |
| `tsconfig.json` → `compilerOptions.paths` | Path alias: `@/* → src/*`               |
| `vite.config.*` → `resolve.alias`         | Path alias: `@/ → src/`                 |
| `.env.example` exists                     | Env setup: copy `.env.example` → `.env` |
| `project.godot` → `[autoload]`            | Autoload: `{name} → {path}` per entry   |
| `.nvmrc` / `.node-version` exists         | Node version: `{version}`               |

**Merge** met bestaande `context.patterns`:

- Auto-detected patterns (prefix: "Path alias:", "Env setup:", "Autoload:", "Node version:"): overwrite
- Handmatige patterns (zonder deze prefixes): behouden

**3d) Update timestamp**

Set `context.updated` naar huidige datum (`YYYY-MM-DD`). Doe dit altijd, ook als alleen code-only changes.

Write `project-context.json` terug met `JSON.stringify(data, null, 2)`.

### FASE 4: Teammate Deep Analysis

Skip entirely if `has_teammate_commits = false`. This fase enriches project.json and project-context.json with context from code you didn't write. Voor een volledige codebase scan (eerste keer joinen): gebruik `/core-onboard`.

**4a) Determine scope**

Analyze only files changed by teammate commits. For each teammate commit, get changed files:

```bash
git diff-tree --no-commit-id -r --name-status $COMMIT_HASH
```

**4b) Group commits into candidate features**

Group teammate commits into features using these heuristics (priority order):

1. **Merge commit message** — if matches `Merge.*feature/(.+)` or `Merge.*branch '(.+)'` → feature name from branch. Associate all commits between this merge and the previous merge with this feature.
2. **Fallback** — group remaining (unmatched) commits by primary affected directory (e.g., commits touching `src/services/auth/` → component `auth`)

For each candidate feature, collect: name (kebab-case), author (git name), files (path + A/M/D status), summary (from commit messages).

**4c) Categorize files for deep analysis**

Across all in-scope files, categorize:

| Category     | Match pattern                                                          | Extracts                  |
| ------------ | ---------------------------------------------------------------------- | ------------------------- |
| **Models**   | `**/models/*.{js,ts,py}`, `**/schema*.{js,ts}`, `*.prisma`             | `data.entities`           |
| **Routes**   | `**/routes/*.{js,ts}`, `app/**/page.*`, `app/**/route.*`, `pages/**/*` | `endpoints`               |
| **Services** | `**/services/**/*`, `**/lib/**/*`, `**/utils/**/*`                     | `architecture.components` |
| **Tests**    | `**/test/**/*`, `**/tests/**/*`, `**/*.test.*`, `**/*.spec.*`          | `architecture.components` |

**4d) Extract entities from models**

For each model file (added or modified), read source and extract:

| Stack             | Detection                                                             |
| ----------------- | --------------------------------------------------------------------- |
| Mongoose          | `new Schema({...})` or `mongoose.model('Name', ...)` → fields + types |
| Prisma            | `model Name { ... }` blocks → fields + relations                      |
| Sequelize         | `define('Name', { ... })` → fields + types                            |
| Django            | `class Name(models.Model)` → fields                                   |
| GDScript Resource | `class_name` + `@export` vars → properties                            |

Output per entity: `{ name, source: "src/models/Track.js", fields: [{ name, type, required }], relations: [{ target, type }] }`

The `source` field tracks which file defines this entity — used by 4g to detect deletions.

**4e) Extract endpoints from routes**

Reuse route file contents cached in FASE 3b if available. Only read additional route files that weren't covered by 3b (e.g., new files from teammate commits not yet in the working tree during 3b).

Detect stack from `project.json.stack.framework`:

| Stack                | Detection method                                                  |
| -------------------- | ----------------------------------------------------------------- |
| Express/Fastify      | Grep for `router.get\|post\|put\|delete\|patch` → method + path   |
| Next.js (App Router) | File path `app/**/page.*` → GET route, `app/**/route.*` → methods |
| Next.js (Pages)      | File path `pages/**/*` → GET route                                |
| Django               | `urlpatterns` + `path()` entries                                  |
| Godot                | Skip (no HTTP endpoints)                                          |

Output per endpoint: `{ method, path, description, status: "active" }`

**4f) Extract architecture components**

For each service/lib file, determine component name from directory structure (e.g., `src/services/auth/` → "Auth Service"). Map source files and corresponding test files.

Output: `{ component, src: [...], test: [...] }`

**4g) Detect deleted code → clean stale context**

For files with status `D` (deleted) in teammate commits:

1. **Entities**: if a model file was deleted, check `data.entities[]` — match on `source` field and remove entries whose source file no longer exists.
2. **Endpoints**: if a route file was deleted, check `endpoints[]` — remove entries from that route file.
3. **Architecture components**: if a source file was deleted, remove it from `architecture.components[].src` or `.test` arrays. Remove component entries with empty `src` arrays.
4. **Routing**: already handled by FASE 3 (full overwrite of `context.routing`).

**4h) Sync to project files**

Follow `shared/SYNC.md` protocol. Re-read both files immediately before writing.

**project.json mutations:**

- **Features** — for each candidate feature:
  Check if exists by name. If new → push:

  ```json
  {
    "name": "feature-name",
    "status": "DONE",
    "summary": "...",
    "source": "sync",
    "author": "Teammate Name",
    "created": "2026-03-10"
  }
  ```

  If exists with `source` NOT `"sync"` → skip (user's own feature).
  If exists with `source: "sync"` → update summary if richer info available.

- **Entities** — merge per SYNC.md: check on name → new: push → existing: merge fields/relations. Remove entities from deleted model files (4g).

- **Endpoints** — merge per SYNC.md: check on method+path → new: push → existing: update. Remove endpoints from deleted route files (4g).

- **Packages** — if `package.json` was changed by teammates, diff for new dependencies:
  ```bash
  git diff $OLDEST_TEAMMATE_COMMIT..HEAD -- package.json
  ```
  Check on name → new: push `{ name, version, purpose: "dependency" }`.

**project-context.json mutations:**

- **Architecture components** — update `architecture.components[]` following component-first model from `shared/DASHBOARD.md`: check on component name → new: push with layer/status/src/test and `connects_to[]` as typed edges `{ to, type }` (`calls` | `reads` | `writes` | `depends_on`) → existing: merge src/test arrays (dedup), merge `connects_to[]` on `to+type` combination. Clean stale entries (4g).

**4i) Save sync state**

Write `.project/session/sync-state.json`:

```json
{ "lastSync": "2026-03-13T00:00:00Z" }
```

**4j) Learning extraction**

Skip volledig als `--no-learn` flag gezet. Heuristieken: zie [shared/LEARNING-EXTRACTION.md](../shared/LEARNING-EXTRACTION.md).

**4j.1) MVP — fix-commit pitfalls**

```bash
git log $PRE_REF..HEAD --grep='^fix\|^bugfix' --format='%H|%an|%s%n%b' --no-merges
```

Per commit: filter author ≠ self. Body ≥10 woorden OF bevat root-cause keyword (`because|waardoor|caused|door|root cause|reason|reden|oorzaak`). Skip kale `fix: typo`. Output `{ type: "pitfall", source: "synced", author, feature: <primary-dir>, summary: <subject zonder prefix> — <body sample> }`.

**4j.2) MVP — TODO/FIXME comments**

Voor elke teammate-changed file (uit FASE 4a):

```bash
grep -nE '(TODO|FIXME|HACK|XXX|NOTE):' <file>
git blame --porcelain -L <line>,<line> <file>
```

Filter: ≥10 woorden body, bevat werkwoord-clue (`breaks|fails|causes|veroorzaakt|kapot|werkt niet|moet|should|hangs|blocks|crashes|leaks`). Skip generic patterns (`TODO: implement`, `FIXME: fix this`). Author uit `git blame` ≠ self. Output `{ type: "pitfall", source: "synced", author, feature: <dir-segment>, summary: <comment body, ≤200 chars> }`.

**4j.3) MVP — nieuwe abstraction-dirs**

Vergelijk component lijst uit FASE 4f tegen bestaande `architecture.components[]`. Voor nieuwe entries: match directory keyword tegen mapping table in `LEARNING-EXTRACTION.md`. Output `{ type: "pattern", source: "synced", author, feature: <dir>, summary: "<Pattern label> geïntroduceerd in <path> (<N> files)" }`.

**4j.4) MVP — wrapper-deps**

Hergebruik package.json diff uit FASE 4h. Voor elke nieuwe dep: lookup in wrapper mapping table (zod, pino, axios, prisma, etc). Geen match → skip. Output `{ type: "pattern", source: "synced", author, feature: "stack", summary: "<Pattern label>" }`.

**4j.5) Signal-detectie + LLM-extractie**

Bepaal signal:

```
1. Group teammate-changed files per top-level component-directory (eerste 2 segmenten)
2. Trigger als: één directory ≥10 files (status A/M), OF nieuwe top-level directory (alle status A)
3. Geen trigger → skip 4j.5
```

Bij trigger: roep `learning-extractor` agent aan via Agent tool:

- `subagent_type: "learning-extractor"`
- prompt bevat: `mode: "pull-signal"`, `files: [<getriggerde paden>]`, `existing_learnings: <huidige learnings[]>`, `cap: 5`

Parse JSON output. Voor elke entry: zet `source: "synced"`, `author: null` (codebase-wide), `feature: <triggered dir>`. Append aan extractie-resultaten.

**4j.6) Dedup en sync**

Lees `project-context.json` (re-read direct vóór write per SYNC.md). Voor elke nieuwe entry uit 4j.1-4j.5:

- Compute dedup-key: `(type, normalize(summary), author ?? null)`. Normalize = lowercase + strip leestekens.
- Check tegen bestaande `learnings[]`: match → skip.
- Match tegen andere entries in deze run: match → skip (intra-run dedup).
- Cap totaal nieuwe entries per run op **20**. Bij overschrijding: prefereer pitfalls boven patterns boven observations, daarna meest recente datum.

Voeg overlevende entries toe aan `learnings[]`. Schrijf `project-context.json` terug.

Track counts voor FASE 5 rapport: `{ patterns: P, pitfalls: Q, observations: R, by_authors: [...] }`.

### FASE 5: Report

**Normal pull with context sync (no teammate analysis):**

```
PULL & SYNC COMPLETE

Branch:  {branch} ← {remote/branch}
Commits: {N} new
Files:   {N} changed

Context:
  Structure: refreshed | skipped (no structural changes)
  Routing:   {N} routes | skipped (no route changes)
  Patterns:  {N} auto, {M} manual | skipped (no config changes)
  Updated:   {date}
```

**Pull with teammate analysis:**

```
PULL & SYNC COMPLETE

Branch:  {branch} ← {remote/branch}
Commits: {N} new ({M} by teammates)
Files:   {N} changed

Context:
  Structure:    refreshed
  Routing:      {N} routes
  Patterns:     {N} auto, {M} manual

Teammate sync:
  Features:     {N} synced ({X} new) by {authors}
  Entities:     {N} total ({X} new, {Y} removed)
  Endpoints:    {N} total ({X} new, {Y} removed)
  Architecture: {N} components ({X} new)
  Packages:     {N} total ({X} new)
  Learnings:    {N} synced ({P} patterns, {Q} pitfalls) by {authors} | skipped (--no-learn)

Updated: {date}
```

**Already up to date, context was stale:**

```
CONTEXT REFRESHED (no new commits, stale context updated)

  Structure: refreshed | up to date
  Routing:   {N} routes | up to date
  Patterns:  {N} auto, {M} manual | up to date
  Updated:   {date}
```

**Geen project.json:**

```
PULL COMPLETE (no project-context.json or project.json — run /core-setup to initialize)

Commits: {N} new
Files:   {N} changed
```
