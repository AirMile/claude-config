# Mature Mode

One-time scan of an existing codebase with an early Module Gap modal and optional auto dev-tool installs. Builds base memory via full codebase scan + LLM extraction of conventions and patterns. Supplemented with a CLAUDE.md completeness check and Claude-config init.

**`--no-llm` flag**: Skip PHASE 4 (LLM extraction). Only MVP signals (TODO/FIXME, fix-commits, abstraction-dirs, wrapper-deps). Faster but misses naming/error/response-shape patterns.

**`--scope=<dir>` flag**: Limit PHASE 1–4 to one directory (e.g. `--scope=packages/api` in a monorepo). All file lists, greps, and globs are prefixed with the scope dir; `stack`/`packages` detection still reads the repo-root manifest. Re-run with another scope to extend memory incrementally — all syncs merge, never overwrite other scopes' entries (except `context.structure`, which always covers the scoped subtree under its own key path).

## Scan budget (all phases)

The scan must stay bounded on large repos. Before PHASE 1:

```bash
git ls-files -- "${SCOPE:-.}" | grep -vE '\.(png|jpg|jpeg|gif|svg|ico|woff2?|ttf|lock|min\.js|map)$' > /tmp/scan-files.txt
wc -l < /tmp/scan-files.txt
```

- **File source**: `git ls-files` (respects `.gitignore` — replaces the hard-coded exclude list; keep the excludes only as a fallback glob for non-git dirs).
- **≤ 2000 files**: full scan, no further limits.
- **> 2000 files and no `--scope`**: show the top-level directory sizes (`cut -d/ -f1 | sort | uniq -c | sort -rn | head -15`, plus detected workspaces from `package.json#workspaces` / `pnpm-workspace.yaml`) and AskUserQuestion: scan everything anyway (slow), or pick a scope (recommended; one option per major package/dir, multiSelect true). Chosen scopes become `$SCOPE` for PHASE 1–4; re-runs can add more later.
- **Hard caps regardless of choice** (apply per phase): structure ≤ 60 directories listed (append `… +N more` line); routes/entities/components globs filter `/tmp/scan-files.txt` instead of re-globbing the tree; TODO/FIXME grep output ≤ 200 matches; `git blame` only on the first 50 matches that survive the word-count filter (blame is the expensive step); LLM sampling keeps its existing 50-file cap.

See `../shared/SYNC.md`, `../shared/DASHBOARD.md`, and `../shared/LEARNING-EXTRACTION.md` for protocols.

---

## Process

**Phase tracking** — first action of the skill: call `TaskCreate` with these 18 items (status `pending`), then use `TaskUpdate` to set each phase `in_progress` at start and `completed` at end. During context compaction the task list remains visible — no risk of forgotten phases.

1. PHASE 0: Pre-flight
2. PHASE 0.5: Project Status Snapshot
3. PHASE 0.55: Team Mode Detection
4. PHASE 0.6: Module Gap Ask
5. PHASE 1: Full structure scan
6. PHASE 2: Full route/entity/endpoint/component scan
7. PHASE 3: MVP learnings
8. PHASE 4: LLM learnings via subagent
9. PHASE 4.5: Context fabricate + confirm
10. PHASE 4.6: Code Conventions
11. PHASE 5: Sync
12. PHASE 5.5: CLAUDE.md completeness check
13. PHASE 5.6: Claude-config init
14. PHASE 5.65: Auto Dev Tools
15. PHASE 5.7: Setup Task Seeding
16. PHASE 5.8: Module Gap Install
17. PHASE 5.85: Stack Baseline Research
18. PHASE 6: Report

## PHASE 0: Pre-flight

> **Todo**: call `TaskCreate` with the 18 phase items (see above). Mark PHASE 0 → `in_progress` via `TaskUpdate`.

1. **Detect git repo**:

   ```bash
   git rev-parse --show-toplevel
   ```

   No git repo → exit with error: `core-setup mature mode requires a git repository`.

2. **Check `.project/` state**:
   - Does `.project/project.json` exist? → remember as `has_project_json`.
   - Does `.project/project-context.json` exist? → remember as `has_context_json`.
   - Existing `learnings[]` count → remember as `existing_learning_count`.

3. **Confirm intent** (if `existing_learning_count > 0`):

   AskUserQuestion:
   - header: "Onboard"
   - question: "`.project/project-context.json` already has {N} learnings. Mature mode ONLY adds new entries (dedup on summary), but is intended as a first-time scan. Continue?"
   - options:
     - "Continue (Recommended)" — "Full scan, dedup against existing learnings"
     - "Cancel" — "Prefer incremental pull via `/core-pull`"
   - multiSelect: false

   On cancel → exit.

4. **Read `git config user.name`** → `GIT_USER` (for author filter and self-skip).

5. **Empty-project check** — determine `is_empty_project` (all four true):
   - `stack.framework` empty in `project.json`
   - `existing_learning_count == 0`
   - No `package.json`, `requirements.txt`, `Cargo.toml`, `go.mod`, or `project.godot` present
   - No source code files in root (skip `node_modules`, `.git`, `.project`, `.claude`, `dist`, `build`)

   If `is_empty_project` → AskUserQuestion (single-select):

   ```yaml
   header: "Empty scan"
   question: "This project has no framework, learnings, or source code yet — only the project-add scaffold. A mature scan yields little here. Switch to the greenfield wizard?"
   options:
     - label: "Switch to greenfield wizard (Recommended)"
       description: "Set stack/concept/standards before writing code"
     - label: "Continue with mature scan"
       description: "Edge case: I explicitly want the mature flow"
   multiSelect: false
   ```

   On "Switch to greenfield wizard":
   - No separate data handoff needed — greenfield's Phase 2 step 0 (Concept preflight) reads `.project/project-seed.md` and `project.json#concept` from disk itself and shows the "Use existing / Supplement / Redo" modal.
   - Load `references/mode-greenfield.md` and exit this mature run.

### PHASE 0.4: .gitignore bootstrap

All Claude-related files are per-developer local (not committed). Check idempotently:

```bash
grep -qxF 'CLAUDE.md' .gitignore 2>/dev/null || echo 'CLAUDE.md' >> .gitignore
grep -qxF '.claude/' .gitignore 2>/dev/null || echo '.claude/' >> .gitignore
grep -qxF '.project/' .gitignore 2>/dev/null || echo '.project/' >> .gitignore
```

**If per-developer files are already committed** (check via `git ls-files`):

```bash
TRACKED=$(git ls-files | grep -E '^(\.claude/|\.project/|CLAUDE\.md$)' | head -20)
```

If `TRACKED` is not empty, show AskUserQuestion (single-select):

```yaml
header: "Per-developer files in git"
question: "The following files are in git but should be per-developer local:\n{TRACKED}\nRemove from git (files remain local)?"
options:
  - label: "Yes, remove from git (Recommended)"
    description: "git rm --cached -- <files> — files remain local, teammates get their own version via core-setup"
  - label: "No, leave as is"
    description: "Files remain committed — not recommended for team repos"
multiSelect: false
```

On "Yes": `git rm --cached -- $(echo "$TRACKED" | tr '\n' ' ')`

**Session state init:** initialize `installed_in_session = []` (empty list). Subsequent phases (5.6 inspect-overlay, 5.65 playwright-toolchain, 5.8 Module Gap installs) append module IDs to this list. PHASE 6 report reads it to render "Modules added".

### PHASE 0.5: Project Status Snapshot

> **Todo**: mark PHASE 0 → `completed`, PHASE 0.5 → `in_progress`.

Read `.project/project.json` if it exists, otherwise skip entirely.

Build a compact status table from `stack.framework`, `stack.styling`, `stack.testing`, `stack.linting`, `stack.state`, `stack.forms`, and `stack.componentLibrary`. Per slot:

- Filled → "✓ {value}"
- Empty → "— (empty)"
- Not relevant for stack → don't show (skip forms for backend etc.)

Output format:

```
PROJECT STATUS

Framework:    {framework}
Language:     {language}

Stack slots:
  Styling           ✓ {value} | — (empty)
  UI components     ✓ {value} | — (empty)
  Testing (unit)    ✓ {value} | — (empty)
  Testing (e2e)     ✓ {value} | — (empty)
  Linting           ✓ {value} | — (empty)
  State (client)    ✓ {value} | — (empty)
  State (server)    ✓ {value} | — (empty)
  Forms             ✓ {value} | — (empty)

Learnings:    {existing_learning_count}
Last sync:    {sync-state.json#lastSync or "never"}
```

Read `SEED_CONTEXT` per `../shared/SEED.md` Reader. Use this in PHASE 0.6 (Module Gap modal) and any follow-up suggestions: weigh the concept domain into defaults and recommendations.

No modal here — visibility only. PHASE 0.6 below uses this snapshot directly for the Module Gap modal.

Remember the empty slots as `gap_slots[]` for use in PHASE 0.6.

Mark PHASE 0.5 → `completed`.

### PHASE 0.55: Team Mode Detection

> **Todo**: mark PHASE 0.5 → `completed`, PHASE 0.55 → `in_progress`.

> Parallel met greenfield step 0.5 (`mode-greenfield.md` regel 101). Schrijfdoel + leespatroon voor skills: zie `../shared/PROJECT-MODE.md`.

**Goal:** detect whether this is a team repo and let the user confirm, then persist `team.mode` to `.project/project.json`.

**Skip if** `.project/project.json` already has `team.mode` set (user made a deliberate choice before; do not overwrite).

**Heuristics** (run all three; suggest `"team"` if all three are true, otherwise `"solo"`):

```bash
# 1. Multiple distinct commit authors?
AUTHOR_COUNT=$(git log --format='%ae' | sort -u | wc -l | tr -d ' ')

# 2. Remote configured?
REMOTE=$(git remote | head -1)

# 3. Recent commits by others (last 30 days)?
GIT_USER=$(git config user.email)
OTHERS=$(git log --since="30 days ago" --format='%ae' | grep -v "^${GIT_USER}$" | wc -l | tr -d ' ')
```

Suggest `"team"` if: `AUTHOR_COUNT > 1` AND `REMOTE != ""` AND `OTHERS > 0`. Otherwise suggest `"solo"`.

**AskUserQuestion** (with detected value pre-selected as Recommended):

```yaml
header: "Project mode"
question: "Is this a solo or team project? (detected: {detected_mode})"
options:
  - label: "{detected_mode == 'team' ? 'Team (Recommended)' : 'Team'}"
    description: "Multiple contributors — enables /team-* skills, PR offer after verify/refactor, ⚙ toggle in backlog/dashboard."
  - label: "{detected_mode == 'solo' ? 'Solo (Recommended)' : 'Solo'}"
    description: "Only you commit here — no PR prompts, no team-* gating."
multiSelect: false
```

Write confirmed value to `project.json#team.mode` (`"team"` or `"solo"`).

Mark PHASE 0.55 → `completed`.

### PHASE 0.6: Module Gap Ask

> **Todo**: mark PHASE 0.55 → `completed`, PHASE 0.6 → `in_progress`.

**Framework-guard:** if `stack.framework` from `project.json` is empty, skip entirely. Store `gap_choices = []`, show `Module Gap Ask skipped — no framework detected. Add modules later via /core-setup [module].`, and mark PHASE 0.6 → `completed`. Without a framework, slot relevance cannot be determined and the modal would show incorrect options.

**Trigger:** at least one relevant slot in `gap_slots[]` (from PHASE 0.5) is empty. Otherwise: store `gap_choices = []` and mark PHASE 0.6 → `completed` without modal.

> **Todo**: if the trigger fires → Read `references/phase-module-gap-ask.md` and follow it (slot filtering, multi-select modal, persist `gap_choices` to onboard-state.json); otherwise continue.

Mark PHASE 0.6 → `completed`.

### PHASE 1: Full structure scan

> **Todo**: mark PHASE 0.6 → `completed`, PHASE 1 → `in_progress`.

Derive the file tree from `/tmp/scan-files.txt` (see § Scan budget — `git ls-files`, scope-aware). Build a compact structure string:

- Fallback for non-git dirs: Glob with excludes `node_modules`, `.git`, `.project`, `dist`, `build`, `.next`, `vendor`, `__pycache__`, `.godot`
- Depth ≤ 3; max 60 directories listed, then one `… +N more directories` line
- One-line comment per directory describing its purpose (generate from dir name + readme if available)
- Format: identical to `core-pull` PHASE 3a / `DASHBOARD.md` `context.structure` schema

Overwrite `context.structure` completely (scoped runs: only the scoped subtree).

### PHASE 2: Full route/entity/endpoint/component scan

> **Todo**: mark PHASE 1 → `completed`, PHASE 2 → `in_progress`.

Reuse logic from `core-pull/references/teammate-analysis.md` § 4d/4e/4f, but on all files in `/tmp/scan-files.txt` (scope-aware; filter that list per pattern instead of re-globbing the tree — see § Scan budget):

**2a) Stack detection** from existing `project.json.stack.framework` or, if missing, from `package.json` dependencies / `requirements.txt` / `project.godot`. Write to `stack.framework`.

**2b) Routes** — Glob all route files according to stack mapping (`core-pull` PHASE 3b table). Extract route patterns. Overwrite `context.routing`.

**2c) Entities** — Glob model files (Mongoose/Prisma/Sequelize/Django/GDScript/Sanity). Extract entities with source field. Merge to `data.entities[]`. See `core-pull/references/teammate-analysis.md` § 4d table for detection patterns per stack.

**2d) Endpoints** — Per stack: extract method+path. Reuse route file content from 2b. Merge to `endpoints[]`.

**2e) Components** — Glob `**/services/**`, `**/lib/**`, `**/utils/**`, `**/repositories/**`, etc. Group per directory name. Extract sources + matching test files. Merge to `architecture.components[]` with `connects_to[]` where derivable.

**2f) Packages** — Read `package.json` / `requirements.txt` in full. For every entry not in `stack.packages[]`: push `{ name, version, purpose: "dependency" }`.

### PHASE 3: MVP learnings (regex/AST)

> **Todo**: mark PHASE 2 → `completed`, PHASE 3 → `in_progress`.

Heuristics: see [shared/LEARNING-EXTRACTION.md](../shared/LEARNING-EXTRACTION.md).

**3a) Fix-commit pitfalls** (last 6 months):

```bash
git log --since="6 months ago" --grep='^fix\|^bugfix' --format='%H|%an|%s%n%b' --no-merges
```

Per commit: filter author ≠ `GIT_USER`. Filter body ≥10 words OR root-cause keyword. Output `{ type: "pitfall", source: "synced", author, feature: <primary-dir>, summary }`.

**3b) TODO/FIXME comments** (scoped, bounded — see § Scan budget):

```bash
git grep -nE '(TODO|FIXME|HACK|XXX|NOTE):' -- "${SCOPE:-.}" | head -200
```

(`git grep` respects `.gitignore` and is scope-aware; non-git fallback: `grep -rn` on the PHASE 1 file list.) Apply the ≥10 words + verb-clue filter FIRST, then `git blame --porcelain -L <line>,<line> <file>` on at most the first 50 survivors to determine author (blame is the expensive step). Filter author ≠ `GIT_USER`. Output pitfalls.

**3c) Abstraction-dirs**:

Compare component list from PHASE 2e against mapping table in `LEARNING-EXTRACTION.md`. For each matched directory keyword: emit `{ type: "pattern", source: "synced", author: <first commit author>, feature: <dir>, summary: "<Pattern label> in <path> (<N> files)" }`.

**3d) Wrapper-deps**:

For each entry in `package.json` dependencies: look up in wrapper mapping table. Match → emit pattern (author = `null` since deps are historical).

### PHASE 4: LLM learnings via subagent

> **Todo**: mark PHASE 3 → `completed`, PHASE 4 → `in_progress`.

Skip entirely if `--no-llm` flag is set (do not Read the reference).

> **Todo**: if not `--no-llm` → Read `references/phase-llm-learnings.md` and follow it (representative-file selection, `learning-extractor` agent call, parse + enrich).

### PHASE 4.5: Context fabricate + confirm

> **Todo**: mark PHASE 4 → `completed`, PHASE 4.5 → `in_progress`. Read `references/phase-context-fabricate.md` and follow it (infer seed/stack from README + package.json, confirm-modal over empty fields only, write project-seed.md, backlog hasSeed flag).

### PHASE 4.6: Code Conventions

> **Todo**: mark PHASE 4.5 → `completed`, PHASE 4.6 → `in_progress`. Read `references/phase-conventions.md` and follow it with `variant: mature` (skip-guard on existing `.project/conventions.md`, discovery scan, distill + confirm, write file or sentinel).

### PHASE 5: Sync

> **Todo**: mark PHASE 4.6 → `completed`, PHASE 5 → `in_progress`.

Follow `../shared/SYNC.md` protocol. Re-read `project.json` and `project-context.json` immediately before write.

**5a) Dedup and cap**

For each new entry from PHASE 3 + PHASE 4:

- Compute dedup-key: `(type, normalize(summary), author ?? null)`
- Check against existing `learnings[]` → match → skip
- Intra-run dedup → skip
- Cap total new entries at **50**. If exceeded: prioritize pitfalls > LLM patterns > MVP patterns > observations.

**5b-pre) Package version reconciliation**

For each entry in `project.json#stack.packages[]`:

1. Look up the same package name in `package.json` (`dependencies` ∪ `devDependencies`).
2. If found and the version string differs from the stored value → update the entry to the actual `package.json` version (actual installed wins over planning-state value).
3. If not found in `package.json` → leave as-is (may be a planned dependency that wasn't installed yet); log `Tracked but not installed: {name}@{version}`.

For each `package.json` entry not yet in `project.json#stack.packages[]`: skip (these are typically transitive/peer/dev-tools captured elsewhere). Adding new packages happens via `/core-setup install` or PHASE 5.8.

Log: `Reconciled N package versions: {list of name@old → name@new}`.

**5b) Write project files**

- `project.json`: update `seed`, `stack`, `data.entities`, `endpoints` (from PHASE 2 + 4.5)
- `project-context.json`: update `context.structure`, `context.routing`, `context.patterns`, `architecture.components`, append `learnings[]`
- `context.updated` → today

Skip-worktree recovery as in `core-pull` PHASE 0.

**5c) Save sync state**

```bash
echo '{"lastSync":"<ISO timestamp>"}' > .project/session/sync-state.json
touch .project/session/onboarded
```

Makes subsequent `/core-pull` runs incremental from now on. The `onboarded` marker tells `/core-pull` this developer already onboarded — suppresses its onboard nudge permanently for this checkout (`.project/session/` is local and survives `git checkout -- .project/`).

### PHASE 5.5: CLAUDE.md completeness check + migration

> **Todo**: mark PHASE 5 → `completed`, PHASE 5.5 → `in_progress`.

**Step 1 — Standard sync:**

Follow `references/claude-md-sync.md` with these parameters:

- `mode: "mature"`
- `generate-if-missing: true`
- `stack-overwrite: "ask"`
- `inferred-stack:` stack object from PHASE 2 (framework, language, packages)

PHASE D produces a compact summary for the PHASE 6 report.

**Step 1b — `## Commands` check:**

After sync: check whether the `## Commands` block is present in the resulting `CLAUDE.md`.

Missing → generate it per `references/claude-md-sections.md` template:

- Detect `package.json#scripts`, `Makefile`, or equivalent in repo root
- One line per command with inline comment (short — what it does)
- Add directly before `## Project` section (or as second section if `## Project` is missing)

Already present → skip.

**Step 2 — Legacy marker migration (one-time):**

Scan the current `CLAUDE.md` for outdated marker blocks that no longer belong in `CLAUDE.base.md`:

- `<!-- claude-config:section:language-policy start/end -->`
- `<!-- claude-config:section:communication-style start/end -->`
- `<!-- claude-config:section:smart-suggestions start/end -->`
- `<!-- claude-config:section:command-execution-rules start/end -->`

If present: AskUserQuestion (multi-select):

```yaml
header: "Legacy CLAUDE.md sections found"
question: "These sections have been moved to ~/.claude/CLAUDE.md and no longer need to be per-project. What do you want to do?"
options:
  - label: "Remove from project CLAUDE.md (Recommended)"
    description: "Sections belong in ~/.claude/CLAUDE.md (already present via bootstrap). Project CLAUDE.md becomes ~30 lines shorter."
  - label: "Leave as is"
    description: "Sections remain locally — no effect on functionality"
multiSelect: false
```

On "Remove": strip the marker blocks (content between start/end markers including the markers themselves).

On "Leave as is": skip.

### PHASE 5.6: Claude-config init

> **Todo**: mark PHASE 5.5 → `completed`, PHASE 5.6 → `in_progress`.

If `.claude/settings.local.json` AND `.claude/hooks/format-on-save.cjs` both exist: skip this phase entirely, show "Claude config: already present — skipped".

> **Todo**: if either file is missing → Read `references/phase-claude-config-init.md` and follow it (Full Access defaults + stack-specific formatter hook).

### PHASE 5.65: Auto Dev Tools

> **Todo**: mark PHASE 5.6 → `completed`, PHASE 5.65 → `in_progress`.
> Read `references/phase-auto-dev-tools.md` and follow it with:
>
> - variant: mature-ask
> - stack-source: project.json#stack (PHASE 2a) + file probes
> - track-to: installed_in_session[]

Mark PHASE 5.65 → `completed`.

### PHASE 5.7: Setup Task Seeding (frontend projects only)

> **Todo**: mark PHASE 5.65 → `completed`, PHASE 5.7 → `in_progress`.
> Only if `stack.framework` from PHASE 2a is a frontend framework (React, Vue, Svelte, Next.js, Nuxt, Astro, Remix, SolidJS) → Read `references/phase-setup-task-seeding.md` and follow it with:
>
> - variant: mature
> - auto-execute: false (stdout line only; the PHASE 6 report renders the /frontend-tokens bullet)
>
> Otherwise skip.

Mark PHASE 5.7 → `completed`.

### PHASE 5.8: Module Gap Install

> **Todo**: mark PHASE 5.7 → `completed`, PHASE 5.8 → `in_progress`.

**Read `gap_choices[]` back:** open `.project/session/onboard-state.json`, parse `gapChoices`. File not present or empty array → treat as `gap_choices = []`.

**Trigger:** `gap_choices[]` is not empty. Otherwise skip entirely to PHASE 5.85.

> **Todo**: if the trigger fires → Read `references/phase-module-gap-install.md` and follow it (mode-install PHASE 5 steps per module, track `installed_in_session[]`, cleanup onboard-state.json).

Mark PHASE 5.8 → `completed`.

---

### PHASE 5.85: Stack Baseline Research

> **Todo**: mark PHASE 5.8 → `completed`, PHASE 5.85 → `in_progress`.

Follow `references/stack-baseline-shared.md`.

**Trigger:** only when `stack.framework` is filled and `.claude/research/stack-baseline.md` does not yet exist (idempotent — safe to restart). Otherwise skip.

Mark PHASE 5.85 → `completed`.

---

### PHASE 6: Report

> **Todo**: mark PHASE 5.85 → `completed`, PHASE 6 → `in_progress`. Read `references/phase-mature-report.md` and follow it (render rules, branch/PR context fetch, ONBOARD COMPLETE report).

> **Todo**: mark PHASE 6 → `completed`.

---

## Edge cases

- **No `.project/project.json`**: create with empty schema (see `../shared/DASHBOARD.md`) before PHASE 1.
- **No git repo**: exit with error.
- **Very small codebase (<10 files)**: skill runs through, PHASE 4 LLM extraction yields 0-2 entries. No problem.
- **No package.json / requirements.txt**: skip wrapper-deps detection (PHASE 3d).
- **Subagent failure**: log warning, continue without LLM learnings. MVP signals remain.
- **Cap exceeded** (>50 new learnings): report mentions it explicitly, user can repeat PHASE 4 after review/cleanup.

## Notes

- Deliberately one-time: after a successful mature run, incremental changes are picked up by `/core-pull`.
- LLM extraction costs ~25-50K tokens via Sonnet subagent. Without `--no-llm` flag this is default-on.
- No author for LLM-inferred learnings: pattern is a codebase-wide observation.
- Author === git user → skip (own work in own project — not a "synced" learning).
