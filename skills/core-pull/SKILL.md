---
name: core-pull
description: Pull changes, sync context, and extract learnings. Use with /core-pull.
argument-hint: "[remote/branch] [--no-learn]"
reads: [project.stack, project-context.learnings]
writes:
  [
    backlog.features,
    project.entities,
    project.endpoints,
    project.stack,
    project-context.context,
    project-context.architecture,
    project-context.learnings,
  ]
metadata:
  author: claude-config
  version: 4.2.1
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
- `shared/LEARNING-EXTRACTION.md` — heuristics for MVP signals and LLM extraction (PHASE 4j); write-side schema/dedup/tags/consolidation: `shared/LEARNING-WRITE.md`

## Process

### PHASE 0: Pre-flight

1. **Run the pre-flight script** — one call replaces all individual checks (worktree guard, open worktrees, dirty status, remote + fetch, context staleness, onboard condition, team mode):

   ```bash
   python3 .claude/skills/core-pull/scripts/preflight.py --path .
   ```

   Parse the JSON output and keep it for all later phases. Then match rows top-down — this table is the only routing authority:

   | Condition                                          | Action                                                                                                                                                       |
   | -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
   | `is_main_checkout` = false                         | **Exit**: "core-pull only runs on the main checkout. You are in worktree `{current_root}`. Run `ExitWorktree(action: keep)` first, then retry `/core-pull`." |
   | `has_remote` = false                               | **Exit** with error: no remote configured.                                                                                                                   |
   | `fetch_ok` = false                                 | **Exit** with error: fetch failed (check network/auth).                                                                                                      |
   | `open_worktrees` non-empty OR `onboard.nudge` true | Gates fire — see Todo below, then continue with step 2.                                                                                                      |
   | otherwise                                          | Continue with step 2.                                                                                                                                        |

   > **Todo**: if `open_worktrees` is non-empty or `onboard.nudge` is true → Read '.claude/skills/core-pull/references/preflight-gates.md' and follow the matching gate(s); otherwise continue inline.

2. **Untrack legacy `.project/` files** (migration guard for repos set up before Model A):

   ```bash
   git ls-files .project/ | xargs git rm --cached 2>/dev/null || true
   ```

   No-op on fully-migrated repos (gitignored `.project/` → `git ls-files` returns empty). Cleans up any residual index entries from old setups without disturbing untracked/gitignored files.

3. **Dirty check** — if `dirty` = true in the preflight JSON → **AskUserQuestion**:
   - header: "Uncommitted"
   - question: "There are uncommitted changes ({dirty_file_count} files). What would you like to do?"
   - options:
     - "Stash (Recommended)" — "Stash changes, pull, then re-apply"
     - "Commit first" — "Commit current changes before pulling"
     - "Cancel" — "Stop, I'll fix this myself"
   - multiSelect: false

   On "Stash": `git stash push -u -m "core-pull auto-stash"` (`-u` for untracked files). After successful pull in PHASE 1: `git stash apply` (NOT `pop`). On apply success → `git stash drop`. On conflict after apply → report and let user resolve. **NEVER drop the stash on conflict** — the stash remains as a safety net.
   On "Commit first" → exit with instruction to run `/core-commit` and then `/core-pull`.
   On "Cancel" → exit.

4. **State-branch staleness check** — the preflight already fetched, so this is cheap. Resolve the state branch per `shared/STATE-SYNC.md § 2`; `git rev-parse "refs/remotes/origin/{branch}"` — absent → skip silently. Compare against `.project/session/state-sync.json#lastSyncedSha`:
   - Equal → skip.
   - Remote ahead (or no `state-sync.json` yet) → **AskUserQuestion** (header "Project state"):
     - "Pull project state (Recommended)" — "Bring newer `.project/` state from your other device — follow `shared/STATE-SYNC.md § 7` now"
     - "Skip" — "Leave it — run `/project-sync pull` later"
   - On "Pull": follow `shared/STATE-SYNC.md § 7` before continuing to PHASE 1. On "Skip": continue.

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

If stashed in PHASE 0: `git stash apply`. On success → `git stash drop`. On conflict → report and exit (**do NOT drop stash** — remains as safety net).

**Determine whether to continue** (after restore + stash handling — match exactly one row):

| Result                                                                 | Action                                                                                                                                                          |
| ---------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Pull brought new commits                                               | Continue to PHASE 2                                                                                                                                             |
| "Already up to date" + context file(s) exist + `context_stale` = false | **Exit**: `ALREADY UP TO DATE (context fresh: {context_updated})`                                                                                               |
| "Already up to date" + context file(s) exist + `context_stale` = true  | **Exit**: `ALREADY UP TO DATE — context is stale ({context_updated}, last commit {last_commit_date}). Run /core-setup --mode=mature to refresh project memory.` |
| "Already up to date" + neither file exists                             | **Exit**: `ALREADY UP TO DATE (no project-context.json or project.json — run /core-setup to initialize)`                                                        |

`context_stale`, `context_updated`, `has_context_json` and `has_project_json` come from the preflight JSON (PHASE 0). No context rescan happens on an up-to-date repo — refreshing stale context is `/core-setup --mode=mature`'s job.

### PHASE 2: Diff Analysis

**Goal:** show what changed and determine which context sections need an update.

**2a) Commits overview**

```bash
git log $PRE_REF..HEAD --oneline
```

If `$PRE_REF` is unavailable (first pull, shallow clone) → skip 2a/2b/2c, go to 2d with `force_full_scan = true`.

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

`force_full_scan` is only true in the `$PRE_REF`-unavailable fallback (2a) — never for an up-to-date pull (that path exits in PHASE 1).

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

Store as `has_teammate_commits = true/false`. For a full codebase scan: use `/core-setup`.

(`GIT_USER` is also available as `git_user_name` in the preflight JSON.)

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

**Important:** if PHASE 4 will also run (`has_teammate_commits`), retain the parsed route file contents in memory. PHASE 4e (see `references/teammate-analysis.md § 4e`) reuses this data for endpoint extraction instead of re-reading the same files.

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

Runs only when `has_teammate_commits = true` (PHASE 2e). Enriches project.json and project-context.json with entities, endpoints, architecture components and learnings from teammate commits.

> **Todo**: if `has_teammate_commits` → Read '.claude/skills/core-pull/references/teammate-analysis.md' and follow PHASE 4 fully (4a-4j; pass the `--no-learn` flag state); otherwise skip to PHASE 5.

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

**No project.json:**

```
PULL COMPLETE (no project-context.json or project.json — run /core-setup to initialize)

Commits: {N} new
Files:   {N} changed
```

---

**Team-mode hint** — append one line after any of the above report variants, only if ALL true:

1. `team_mode === "solo"` in the preflight JSON (PHASE 0)
2. This pull brought in ≥1 commit from an author other than `git config user.email`

```
💡 Commits van andere contributors gedetecteerd — solo-mode is wellicht uitgegroeid.
   Toggle naar team via backlog ⚙ of run /core-setup --mode=mature.
```

No prompt, no blocking — informational only. Does not appear when `team.mode === "team"`.
