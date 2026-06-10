---
name: core-pull
description: Pull changes, sync context, and extract learnings. Use with /core-pull.
argument-hint: "[remote/branch] [--no-learn]"
reads: [project.stack, project-context.learnings]
writes:
  [
    project.features,
    project.entities,
    project.endpoints,
    project.stack,
    project-context.context,
    project-context.architecture,
    project-context.learnings,
  ]
metadata:
  author: claude-config
  version: 4.0.0
  category: core
---

# Pull

Pull remote changes, analyze the diff, refresh `.project/` context, analyze teammate code for features, entities, endpoints and architecture, and extract synced learnings from teammate commits.

**Trigger**: `/core-pull`, `/core-pull [remote/branch]`, or `/core-pull --no-learn`

**`--no-learn` flag**: Skip PHASE 4j (learning extraction). Use if you only want to sync context/architecture without generating learnings.

**First-time onboarding (replaces old `--full` flag)**: use `/core-setup` for a full codebase scan + LLM learnings extraction when joining a mature repo.

## References

- `shared/SYNC.md` — merge protocol (read-modify-write per section)
- `shared/DASHBOARD.md` — project.json + project-context.json schema
- `shared/LEARNING-EXTRACTION.md` — heuristics for MVP signals and LLM extraction (PHASE 4j)

## Process

### PHASE 0: Pre-flight

0. **Worktree guard** — core-pull resets `.project/` via `git checkout -- .project/`, which destroys symlinks. Run only on the main checkout:

   ```bash
   main_root=$(git worktree list --porcelain | head -1 | awk '{print $2}')
   current_root=$(git rev-parse --show-toplevel)
   ```

   If `current_root != main_root`: **exit** with message:

   > "core-pull only runs on the main checkout. You are in worktree `{current_root}`. Run `ExitWorktree(action: keep)` first, then retry `/core-pull`."

0a. **Open worktree check** — detect feature worktrees that share `.project/` via symlinks:

```bash
# macOS/Linux
open_worktrees=$(git worktree list --porcelain | grep "^branch " | grep "refs/heads/worktree-" | sed 's|^branch refs/heads/||')
```

```powershell
# Windows
$openWorktrees = git worktree list --porcelain |
  Select-String "^branch refs/heads/worktree-" |
  ForEach-Object { ($_ -replace "branch refs/heads/", "").Trim() }
```

If `open_worktrees` is not empty → **AskUserQuestion**:

```yaml
header: "Open worktrees"
question: "Open worktrees found: {list}. core-pull resets `.project/` on main — that wipes the symlinks that write worktree state to main. What do you want to do?"
options:
  - label: "Stop — merge open worktrees first (Recommended)"
    description: "Run /core-finalize per open worktree, then /core-pull again"
  - label: "Continue anyway"
    description: "Pull now; worktree state on main may be lost (the worktree itself stays intact)"
multiSelect: false
```

On "Continue anyway" → log a warning in the output and continue to step 1.

1. **Clean `.project/` files** (prevent local .project/ changes from interfering with stash/pull):

   ```bash
   git ls-files .project/ | xargs git update-index --no-skip-worktree 2>/dev/null
   git checkout -- .project/ 2>/dev/null
   git ls-files .project/ | xargs git update-index --skip-worktree 2>/dev/null
   ```

   This resets `.project/` to HEAD and makes them invisible to git. Safe because PHASE 3/4 always regenerates the content from source code.

2. Check git status (`.project/` no longer appears due to skip-worktree):

   ```bash
   git status --porcelain
   ```

   If dirty → **AskUserQuestion**:
   - header: "Uncommitted"
   - question: "There are uncommitted changes. What would you like to do?"
   - options:
     - "Stash (Recommended)" — "Stash changes, pull, then re-apply"
     - "Commit first" — "Commit current changes before pulling"
     - "Cancel" — "Stop, I'll fix this myself"
   - multiSelect: false

   On "Stash": `git stash push -u -m "core-pull auto-stash"` (`-u` for untracked files). After successful pull in PHASE 1: `git stash apply` (NOT `pop`). On apply success → `git stash drop`. On conflict after apply → report and let user resolve. **NEVER drop the stash on conflict** — the stash remains as a safety net.
   On "Commit first" → exit with instruction to run `/core-commit` and then `/core-pull`.
   On "Cancel" → exit.

3. Check remote:

   ```bash
   git remote -v
   git fetch 2>&1
   ```

   If no remote or fetch fails → exit with error.

4. Check `.project/project-context.json` existence → store as `has_context_json`. Fallback: check `.project/project.json` → store as `has_project_json`.

5. **Onboard nudge** (once per project, for fresh codebases):

   ```bash
   total_commits=$(git rev-list --count HEAD 2>/dev/null || echo 0)
   ```

   Determine `learnings_empty`:
   - If `has_context_json` = false → `learnings_empty = true`
   - Otherwise: read `.project/project-context.json` → `learnings_empty = (learnings.length === 0)`

   Determine `dismissed`: check if `.project/session/onboard-dismissed` exists.

   If `learnings_empty && total_commits > 50 && !dismissed` → **AskUserQuestion**:
   - header: "Onboard?"
   - question: "This looks like a new codebase for you ({N} commits, no learnings). `/core-setup` builds base memory from conventions, patterns and pitfalls in existing code. Run now?"
   - options:
     - "Yes, run /core-setup (Recommended)" — exit core-pull with instruction to start `/core-setup`
     - "No, just pull" — continue with PHASE 1
     - "Don't ask again for this project" — write `.project/session/onboard-dismissed` (empty marker file), continue with PHASE 1
   - multiSelect: false

   On "Yes": exit with message `RUN /core-setup FOR BASE MEMORY (then re-run /core-pull for incremental updates)`. No pull/sync.

### PHASE 1: Pull

Store pre-pull ref:

```bash
PRE_REF=$(git rev-parse HEAD)
```

Pull:

```bash
git pull --rebase
```

If conflicts → show conflicting files, exit with instruction to resolve conflicts and then re-run `/core-pull`.

**Determine whether to continue:**

- Pull had new commits → continue to PHASE 2
- "Already up to date" AND (`has_context_json` OR `has_project_json`) = true → continue to PHASE 2 with `force_full_scan = true` (context may be stale)
- "Already up to date" AND neither exist → exit:
  ```
  ALREADY UP TO DATE (no project-context.json or project.json — run /core-setup to initialize)
  ```

**Restore skip-worktree** after pull (also when already up to date):

```bash
git ls-files .project/ | xargs git update-index --skip-worktree 2>/dev/null
```

If stashed in PHASE 0: `git stash apply`. On success → `git stash drop`. On conflict → report and exit (**do NOT drop stash** — remains as safety net).

### PHASE 2: Diff Analysis

**Goal:** show what changed and determine which context sections need an update.

**2a) Commits overview**

```bash
git log $PRE_REF..HEAD --oneline
```

If no commits (already up to date) → skip 2a/2b/2c, go to 2d.

**2b) Changed files overview**

```bash
git diff $PRE_REF..HEAD --stat
git diff $PRE_REF..HEAD --name-status
```

Show summary to the user:

```
PULL COMPLETE

Branch:  {branch} ← {remote/branch}
Commits: {N} new

  {hash} {message}
  {hash} {message}

Files: {N} changed ({added} added, {modified} modified, {deleted} deleted)
```

**2c) Categorize changed files**

Read the `--name-status` output and categorize each file:

| Category       | Match                                                                                                         | Impact              |
| -------------- | ------------------------------------------------------------------------------------------------------------- | ------------------- |
| **Structural** | Files with status A (added), D (deleted), or R (renamed/moved)                                                | `context.structure` |
| **Route**      | `app/**/page.{tsx,jsx,ts,js}`, `app/**/route.{ts,js}`, `pages/**/*.{tsx,jsx,ts,js}`, `*.tscn`                 | `context.routing`   |
| **Config**     | `tsconfig.json`, `vite.config.*`, `next.config.*`, `.env.example`, `.nvmrc`, `.node-version`, `project.godot` | `context.patterns`  |
| **Code-only**  | Other modified files (status M, no match with the above)                                                      | No context impact   |

Route file patterns are stack-dependent. Read `stack.framework` from `project.json` to determine which patterns are relevant.

**2d) Impact determination**

```
needs_structure = structural_files.length > 0 OR force_full_scan
needs_routing   = route_files.length > 0 OR force_full_scan
needs_patterns  = config_files.length > 0 OR force_full_scan
```

**Fallback:** if `$PRE_REF` is not available (first pull, shallow clone) → `force_full_scan = true`.

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

Store as `has_teammate_commits = true/false`. If zero teammate commits → skip PHASE 4 (no teammate enrichment needed). For a full codebase scan: use `/core-setup`.

### PHASE 3: Context Sync

Skip entirely if neither `has_context_json` nor `has_project_json` = true. Show:

```
SKIP CONTEXT SYNC (no project-context.json or project.json — run /core-setup to initialize)
```

Read `.project/project-context.json`, parse JSON. Update `context` section selectively:

**3a) Structure scan** (only if `needs_structure`)

Scan the project root for the file tree. Build a compact structure string:

- Use Glob tool for directory discovery
- Exclude: node_modules, .git, .project, dist, build, .next, vendor, **pycache**, .godot
- One-line comments per directory describing its purpose
- Format: same as in `DASHBOARD.md` context.structure schema

Overwrite `context.structure` fully.

**3b) Route detection** (only if `needs_routing`)

Detect stack from `project.json.stack.framework`.

| Stack                | Detection method                                            |
| -------------------- | ----------------------------------------------------------- |
| Next.js (App Router) | Scan `app/**/page.{tsx,jsx,ts,js}` → extract route patterns |
| Next.js (Pages)      | Scan `pages/**/*.{tsx,jsx,ts,js}` → extract route patterns  |
| Express/Fastify      | Grep for `router.get\|post\|put\|delete\|app.get\|app.post` |
| Godot                | Scan `*.tscn` scene files → extract scene tree              |
| Other                | Skip routing, set `context.routing = []`                    |

Route format: `"/path" → Description` (arrow notation).

Overwrite `context.routing` fully.

**Important:** if PHASE 4 will also run (`has_teammate_commits`), retain the parsed route file contents in memory. PHASE 4e reuses this data for endpoint extraction instead of re-reading the same files.

**3c) Pattern auto-detect** (only if `needs_patterns`)

Scan for automatically detectable patterns:

| Source                                    | Pattern                                 |
| ----------------------------------------- | --------------------------------------- |
| `tsconfig.json` → `compilerOptions.paths` | Path alias: `@/* → src/*`               |
| `vite.config.*` → `resolve.alias`         | Path alias: `@/ → src/`                 |
| `.env.example` exists                     | Env setup: copy `.env.example` → `.env` |
| `project.godot` → `[autoload]`            | Autoload: `{name} → {path}` per entry   |
| `.nvmrc` / `.node-version` exists         | Node version: `{version}`               |

**Merge** with existing `context.patterns`:

- Auto-detected patterns (prefix: "Path alias:", "Env setup:", "Autoload:", "Node version:"): overwrite
- Manual patterns (without these prefixes): retain

**3d) Update timestamp**

Set `context.updated` to current date (`YYYY-MM-DD`). Do this always, even for code-only changes.

Write `project-context.json` back with `JSON.stringify(data, null, 2)`.

### PHASE 4: Teammate Deep Analysis

Skip entirely if `has_teammate_commits = false`. This phase enriches project.json and project-context.json with context from code you didn't write. For a full codebase scan (first time joining): use `/core-setup`.

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

| Stack             | Detection                                                                                                                                                                                                 |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Mongoose          | `new Schema({...})` or `mongoose.model('Name', ...)` → fields + types                                                                                                                                     |
| Prisma            | `model Name { ... }` blocks → fields + relations                                                                                                                                                          |
| Sequelize         | `define('Name', { ... })` → fields + types                                                                                                                                                                |
| Django            | `class Name(models.Model)` → fields                                                                                                                                                                       |
| GDScript Resource | `class_name` + `@export` vars → properties                                                                                                                                                                |
| Sanity            | `defineType({ name, fields: [...] })` in `**/sanity/schemas/**/*.{ts,js}` → one entity per `defineType`, `defineField({ name, type })` per field, `required` from `validation: (Rule) => Rule.required()` |

Output per entity: `{ name, source: "src/models/Track.js", fields: [{ name, type, required }], relations: [{ target, type }] }`

The `source` field tracks which file defines this entity — used by 4g to detect deletions.

**4e) Extract endpoints from routes**

Reuse route file contents cached in PHASE 3b if available. Only read additional route files that weren't covered by 3b (e.g., new files from teammate commits not yet in the working tree during 3b).

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
4. **Routing**: already handled by PHASE 3 (full overwrite of `context.routing`).

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

Skip entirely if `--no-learn` flag is set. Heuristics: see [shared/LEARNING-EXTRACTION.md](../shared/LEARNING-EXTRACTION.md).

**4j.1) MVP — fix-commit pitfalls**

```bash
git log $PRE_REF..HEAD --grep='^fix\|^bugfix' --format='%H|%an|%s%n%b' --no-merges
```

Per commit: filter author ≠ self. Body ≥10 words OR contains root-cause keyword (`because|waardoor|caused|door|root cause|reason|reden|oorzaak`). Skip bare `fix: typo`. Output `{ type: "pitfall", source: "synced", author, feature: <primary-dir>, summary: <subject without prefix> — <body sample> }`.

**4j.2) MVP — TODO/FIXME comments**

For each teammate-changed file (from PHASE 4a):

```bash
grep -nE '(TODO|FIXME|HACK|XXX|NOTE):' <file>
git blame --porcelain -L <line>,<line> <file>
```

Filter: ≥10 words body, contains verb clue (`breaks|fails|causes|veroorzaakt|kapot|werkt niet|moet|should|hangs|blocks|crashes|leaks`). Skip generic patterns (`TODO: implement`, `FIXME: fix this`). Author from `git blame` ≠ self. Output `{ type: "pitfall", source: "synced", author, feature: <dir-segment>, summary: <comment body, ≤200 chars> }`.

**4j.3) MVP — new abstraction dirs**

Compare component list from PHASE 4f against existing `architecture.components[]`. For new entries: match directory keyword against mapping table in `LEARNING-EXTRACTION.md`. Output `{ type: "pattern", source: "synced", author, feature: <dir>, summary: "<Pattern label> introduced in <path> (<N> files)" }`.

**4j.4) MVP — wrapper deps**

Reuse package.json diff from PHASE 4h. For each new dep: lookup in wrapper mapping table (zod, pino, axios, prisma, etc). No match → skip. Output `{ type: "pattern", source: "synced", author, feature: "stack", summary: "<Pattern label>" }`.

**4j.5) Signal detection + LLM extraction**

Determine signal:

```
1. Group teammate-changed files per top-level component directory (first 2 segments)
2. Trigger if: one directory ≥10 files (status A/M), OR new top-level directory (all status A)
3. No trigger → skip 4j.5
```

On trigger: call `learning-extractor` agent via Agent tool:

- `subagent_type: "learning-extractor"`
- prompt contains: `mode: "pull-signal"`, `files: [<triggered paths>]`, `existing_learnings: <current learnings[]>`, `cap: 5`

Parse JSON output. For each entry: set `source: "synced"`, `author: null` (codebase-wide), `feature: <triggered dir>`. Append to extraction results.

**4j.6) Dedup and sync**

Read `project-context.json` (re-read immediately before write per SYNC.md). For each new entry from 4j.1-4j.5:

- Exact dedup key: `(type, normalize(summary), author ?? null)`. Normalize = lowercase + strip punctuation. Match → skip.
- Jaccard dedup (second layer): tokenize candidate.summary via `shared/LEARNING-EXTRACTION.md` Dedup Tokenizer. For each existing learning in `learnings[]` with the same `type`: `Jaccard(candidate.tokens, existing.tokens) >= 0.55` → skip.
- Intra-run Jaccard: same check but against other entries in this run (same `type`, Jaccard ≥ 0.55) → skip.
- Cap total new entries per run at **20**. On overflow: prefer pitfalls over patterns over observations, then most recent date.

Add surviving entries to `learnings[]`. Write `project-context.json` back.

Track counts for PHASE 5 report: `{ patterns: P, pitfalls: Q, observations: R, by_authors: [...] }`.

### PHASE 5: Report

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

**No project.json:**

```
PULL COMPLETE (no project-context.json or project.json — run /core-setup to initialize)

Commits: {N} new
Files:   {N} changed
```

---

**Team-mode hint** — append one line after any of the above report variants, only if ALL true:

1. `TEAM_MODE === "solo"` or absent — read via `shared/PROJECT-MODE.md` read pattern
2. This pull brought in ≥1 commit from an author other than `git config user.email`

```
💡 Commits van andere contributors gedetecteerd — solo-mode is wellicht uitgegroeid.
   Toggle naar team via backlog ⚙ of run /core-setup --mode=mature.
```

No prompt, no blocking — informational only. Does not appear when `team.mode === "team"`.
