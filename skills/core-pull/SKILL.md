---
name: core-pull
description: >-
  Pull git changes, analyze diff, sync .project context, and deep-analyze
  teammate code (features, entities, endpoints, architecture). Detects deleted
  code and cleans stale context. Use with /core-pull or /core-pull --full.
disable-model-invocation: true
argument-hint: "[remote/branch] [--full]"
metadata:
  author: mileszeilstra
  version: 3.0.0
  category: core
---

# Pull

Pull remote changes, analyseer de diff, ververs `.project/` context, en analyseer teammate code voor features, entities, endpoints en architectuur.

**Trigger**: `/core-pull`, `/core-pull [remote/branch]`, of `/core-pull --full`

**`--full` flag**: Analyze ALL code in the project, not just recent teammate commits. Use when joining an existing project (e.g., internship) or when context is severely outdated. Ignores lastSync and author filter — treats every file as in-scope.

## References

- `shared/SYNC.md` — merge protocol (read-modify-write per section)
- `shared/DASHBOARD.md` — project.json + project-context.json schema

## Process

### FASE 0: Pre-flight

1. Check git status:

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

   Bij "Stash": `git stash push -m "core-pull auto-stash"`. Na succesvolle pull in FASE 1: `git stash pop`. Bij conflict na pop → meld en laat user resolven.
   Bij "Commit eerst" → exit met instructie om `/core-commit` te runnen en daarna `/core-pull`.
   Bij "Annuleren" → exit.

2. Check remote:

   ```bash
   git remote -v
   git fetch 2>&1
   ```

   Als geen remote of fetch faalt → exit met error.

3. Check `.project/project-context.json` existence → onthoud als `has_context_json`. Fallback: check `.project/project.json` → onthoud als `has_project_json`.

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

Als gestasht in FASE 0: `git stash pop`. Bij conflict → meld en exit.

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

Determine if teammate analysis is needed. Skip this step if `--full` flag is set (FASE 4 handles full scan).

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

Store as `has_teammate_commits = true/false`. If zero teammate commits and no `--full` flag → skip FASE 4.

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

**Important:** if FASE 4 will also run (`has_teammate_commits` or `--full`), retain the parsed route file contents in memory. FASE 4e reuses this data for endpoint extraction instead of re-reading the same files.

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

Skip entirely if `has_teammate_commits = false` AND no `--full` flag. This fase enriches project.json and project-context.json with context from code you didn't write.

**4a) Determine scope**

- **Normal mode** (`has_teammate_commits = true`): analyze only files changed by teammate commits.
  For each teammate commit, get changed files:
  ```bash
  git diff-tree --no-commit-id -r --name-status $COMMIT_HASH
  ```
- **Full mode** (`--full` flag): analyze ALL source files in the project via Glob. Ignore author filter and lastSync. Use this when joining an existing project.

**4b) Group commits into candidate features**

Skip in `--full` mode (no commit grouping needed — scan everything).

In normal mode, group teammate commits into features using these heuristics (priority order):

1. **Merge commit message** — if matches `Merge.*feature/(.+)` or `Merge.*branch '(.+)'` → feature name from branch. Associate all commits between this merge and the previous merge with this feature.
2. **Fallback** — group remaining (unmatched) commits by primary affected directory (e.g., commits touching `src/services/auth/` → component `auth`)

For each candidate feature, collect: name (kebab-case), author (git name), files (path + A/M/D status), summary (from commit messages).

**4c) Categorize files for deep analysis**

Across all in-scope files, categorize:

| Category     | Match pattern                                                          | Extracts             |
| ------------ | ---------------------------------------------------------------------- | -------------------- |
| **Models**   | `**/models/*.{js,ts,py}`, `**/schema*.{js,ts}`, `*.prisma`             | `data.entities`      |
| **Routes**   | `**/routes/*.{js,ts}`, `app/**/page.*`, `app/**/route.*`, `pages/**/*` | `endpoints`          |
| **Services** | `**/services/**/*`, `**/lib/**/*`, `**/utils/**/*`                     | `architecture.files` |
| **Tests**    | `**/test/**/*`, `**/tests/**/*`, `**/*.test.*`, `**/*.spec.*`          | `architecture.files` |

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

For files with status `D` (deleted) in teammate commits, or in `--full` mode for files referenced in context but no longer existing:

1. **Entities**: if a model file was deleted, check `data.entities[]` — match on `source` field and remove entries whose source file no longer exists.
2. **Endpoints**: if a route file was deleted, check `endpoints[]` — remove entries from that route file. In `--full` mode, verify each endpoint's route file still exists.
3. **Architecture files**: if a source file was deleted, remove it from `architecture.files[].src` or `.test` arrays. Remove component entries with empty `src` arrays.
4. **Routing**: already handled by FASE 3 (full overwrite of `context.routing`).

**4h) Sync to project files**

Follow `shared/SYNC.md` protocol. Re-read both files immediately before writing.

**project.json mutations:**

- **Features** — for each candidate feature (normal mode only):
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

- **Architecture files** — merge new components: check on component name → new: push → existing: merge src/test arrays (dedup). Clean stale entries (4g).

- **Architecture diagram** — if new components were added, update the Mermaid diagram following conventions from `shared/DASHBOARD.md` (:::done, :::planned, :::external, subgraphs per layer). Preserve existing structure, add new nodes/edges.

- **Architecture description** — append descriptions for new components in same format as existing entries.

**4i) Save sync state**

Write `.project/session/sync-state.json`:

```json
{ "lastSync": "2026-03-13T00:00:00Z" }
```

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

Updated: {date}
```

**Full scan (`--full`):**

```
FULL SYNC COMPLETE

Branch: {branch}
Mode:   full project scan

Context:
  Structure:    refreshed ({N} dirs)
  Routing:      {N} routes
  Patterns:     {N} auto, {M} manual

Deep analysis:
  Entities:     {N} total
  Endpoints:    {N} total
  Architecture: {N} components
  Packages:     {N} total

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
