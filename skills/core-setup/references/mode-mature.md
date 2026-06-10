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

**Phase tracking** — first action of the skill: call `TaskCreate` with these 17 items (status `pending`), then use `TaskUpdate` to set each phase `in_progress` at start and `completed` at end. During context compaction the task list remains visible — no risk of forgotten phases.

1. PHASE 0: Pre-flight
2. PHASE 0.5: Project Status Snapshot
3. PHASE 0.6: Module Gap Ask
4. PHASE 1: Full structure scan
5. PHASE 2: Full route/entity/endpoint/component scan
6. PHASE 3: MVP learnings
7. PHASE 4: LLM learnings via subagent
8. PHASE 4.5: Context fabricate + confirm
9. PHASE 5: Sync
10. PHASE 5.5: CLAUDE.md completeness check
11. PHASE 5.6: Claude-config init
12. PHASE 5.65: Auto Dev Tools
13. PHASE 5.7: Setup Task Seeding
14. PHASE 5.75: Legacy github-project.json migration
15. PHASE 5.8: Module Gap Install
16. PHASE 5.85: Stack Baseline Research
17. PHASE 6: Report

## PHASE 0: Pre-flight

> **Todo**: call `TaskCreate` with the 17 phase items (see above). Mark PHASE 0 → `in_progress` via `TaskUpdate`.

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

> **Todo**: mark PHASE 0.5 → `completed`, PHASE 0.6 → `in_progress`.

**Framework-guard:** if `stack.framework` from `project.json` is empty, skip the modal entirely. Store `gap_choices = []`, show `Module Gap Ask skipped — no framework detected. Add modules later via /core-setup [module].`, and mark PHASE 0.6 → `completed`. Without a framework, slot relevance cannot be determined and the modal would show incorrect options.

**Trigger:** at least one relevant slot in `gap_slots[]` (from PHASE 0.5) is empty. Otherwise: store `gap_choices = []` and mark PHASE 0.6 → `completed` without modal.

**Slot relevance** per framework:

| Framework                        | Relevant slots                                                                                   |
| -------------------------------- | ------------------------------------------------------------------------------------------------ |
| React/Vue/Svelte (frontend SPA)  | styling, componentLibrary, testing.unit, testing.e2e, linting, state.client, state.server, forms |
| Next.js/Nuxt/Astro/Remix         | same as above                                                                                    |
| Backend (Express/Fastify/Django) | testing.unit, linting                                                                            |
| Game/CLI/Desktop/Mobile          | testing.unit, linting                                                                            |

Filter `gap_slots[]`:

- Slot already filled in `project.json#stack` → skip
- Slot not relevant for framework → skip
- Tier-1 module already installed in `package.json` but not in stack-slot → skip silently (PHASE 5 sync will fill it in)

**Multi-select modal** (follow Modal Option Cap from SKILL.md; ≤7 slots = one modal, >7 = split per category group):

```yaml
header: "Module gaps"
question: "These tier-1 categories are not yet filled in. What do you want to add? (leave empty = install nothing)"
options:
  # One option per empty relevant slot with the Recommended tier-1 module:
  - label: "Styling: Tailwind (Recommended)"
    description: "Utility-first CSS framework"
  - label: "UI components: shadcn-ui (Recommended)"
    description: "Copy-paste components on Tailwind + Radix"
  - label: "Testing (unit): Vitest (Recommended)"
    description: "Fast Vite-native unit tester"
  - label: "Testing (e2e): Playwright (Recommended)"
    description: "End-to-end browser testing"
  - label: "Linting: Biome (Recommended)"
    description: "Lint + format in one tool"
  - label: "State (client): Zustand (Recommended)"
    description: "Minimal client state"
  - label: "State (server): TanStack Query (Recommended)"
    description: "Server state + caching"
  - label: "Forms: react-hook-form + zod (Recommended)"
    description: "Form validation with schema"
multiSelect: true
```

Only show options for empty relevant slots — not all 8 always.

Store user choice in `gap_choices[]` (list of module names). **No install here** — capture only.

**Persist to disk** (survive context compaction):

```bash
mkdir -p .project/session
echo '{"gapChoices":<JSON-array>}' > .project/session/onboard-state.json
```

Show mini-confirm:

```
Module Gap choice saved: {gap_choices.join(", ") | "none"}
Install follows in PHASE 5.8 (after sync + learnings).
```

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

Reuse logic from `core-pull` PHASE 4d/e/f, but on all files in `/tmp/scan-files.txt` (scope-aware; filter that list per pattern instead of re-globbing the tree — see § Scan budget):

**2a) Stack detection** from existing `project.json.stack.framework` or, if missing, from `package.json` dependencies / `requirements.txt` / `project.godot`. Write to `stack.framework`.

**2b) Routes** — Glob all route files according to stack mapping (`core-pull` PHASE 3b table). Extract route patterns. Overwrite `context.routing`.

**2c) Entities** — Glob model files (Mongoose/Prisma/Sequelize/Django/GDScript/Sanity). Extract entities with source field. Merge to `data.entities[]`. See `core-pull` PHASE 4d table for detection patterns per stack.

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

Skip entirely if `--no-llm` flag is set.

**4a) Select representative files**

Per component from PHASE 2e: choose 5-10 representative files. Criteria:

- File size > 50 LOC (skip stubs)
- Not test files (`*.test.*`, `*.spec.*`, `__tests__/**`)
- Not generated code (look for `// generated` comments, `*.d.ts` if imported from deps)
- Bias toward core/services/routes/models directories

Cap total: max 50 files across all components.

**4b) Call `learning-extractor` agent**

Via Agent tool:

- `subagent_type: "learning-extractor"`
- prompt:
  ```
  mode: "onboard"
  files: [<absolute paths>]
  existing_learnings: <current learnings[]>
  cap: 50
  ```

Subagent runs on Sonnet (see `agents/learning-extractor.md`), output JSON `[{type, summary, evidence}]`.

**4c) Parse and enrich**

For each entry from subagent output:

- Set `source: "synced"`, `author: null` (codebase-wide), `date: <today>`, `feature: <first-segment-from-evidence>`
- Append to extraction results

On subagent failure (timeout, no JSON) → log warning, continue without LLM learnings.

### PHASE 4.5: Context fabricate + confirm

> **Todo**: mark PHASE 4 → `completed`, PHASE 4.5 → `in_progress`.

Infer project metadata from available sources so the user doesn't have to go through a wizard. Read:

- `README.md`: first H1 as name candidate, first paragraph after the title as pitch candidate
- `package.json`: `name` as name fallback, `description` as pitch fallback
- PHASE 1 scan result: dir name as name fallback-fallback
- PHASE 2a: detected `stack.framework` / `stack.language`
- PHASE 2f: detected `stack.packages`

Assemble:

```
seed.name          ← README H1 | package.json#name | dir name
seed.pitch         ← README first paragraph | package.json#description | ""
seed.seedFile      ← "project-seed.md"
stack.framework    ← PHASE 2a
stack.language     ← PHASE 2a (derived from framework + package.json engines)
stack.packages     ← PHASE 2f
```

**Pre-filter against existing values.** For each inferred field, read the current value from `project.json`:

- If the existing value is **empty/null/missing** → include in modal, default checked.
- If the existing value is **non-empty** → exclude from modal (already set, do not overwrite). Log inline: `Kept existing {field}: {current value}`.

Then show one AskUserQuestion (multi-select) over the remaining (empty) fields only:

- header: "Context"
- question: "I inferred this from the existing code and README. Which fields do you want to accept?"
- options: one checkbox per field with `label: "{field}: {value}"`, all checked by default
- multiSelect: true

If all fields are pre-filled and the modal would be empty: skip the modal entirely, log `All seed/stack fields already present — no inference needed.`

For selected fields: write to `project.json`. Deselected fields remain empty (user fills in later via `/project-seed`).

Create `.project/project-seed.md` with the accepted pitch text as a starting point (plain markdown, no template).

If `.project/backlog.json` already exists (non-frontend projects that skip PHASE 5.7): read backlog.json → parse JSON → set `data.flags.hasSeed = true` + `data.flags.seedPath = ".project/project-seed.md"` → write the JSON back. This makes the `/project-backlog` button appear in the backlog dashboard.

### PHASE 5: Sync

> **Todo**: mark PHASE 4.5 → `completed`, PHASE 5 → `in_progress`.

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
```

Makes subsequent `/core-pull` runs incremental from now on.

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

No interactive permission wizard in mature mode — defaults are safe, user can adjust afterwards.

**Check and write only if missing:**

- `.claude/settings.local.json` not present → write with Full Access defaults:

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

  Stack-specific additions: Python → add `Bash(python *)`, `Bash(pip *)`; Go → `Bash(go *)`.

- `.claude/hooks/format-on-save.cjs` not present → write hook based on detected stack. Formatter mapping: see `mode-greenfield.md` Phase 5 table.

If both already exist: skip this phase entirely, show "Claude config: already present — skipped".

### PHASE 5.65: Auto Dev Tools

> **Todo**: mark PHASE 5.6 → `completed`, PHASE 5.65 → `in_progress`.

Mirror of greenfield Phase 5b — detect dev-tools that get auto-install on a new project, but now opt-in on mature.

**Detect:**

- `stack.framework` contains "React" + "Vite" or is "Next.js"
- Overlay not yet installed:
  - **Next.js**: `public/_inspect/client.js` does not exist
  - **Vite**: `vite.config.*` does not import `inspectOverlay`

Both conditions true → show AskUserQuestion (single-select, with "Let Claude decide"):

```yaml
header: "Inspect overlay"
question: "A new {framework} project gets the inspect overlay automatically. This project doesn't have it. Install?"
options:
  - label: "Install (Recommended)"
    description: "Mirror of greenfield default — same DX as a new project"
  - label: "Skip"
    description: "Do not install"
multiSelect: false
```

**On "Install" or "Let Claude decide":**

```
Read("references/modules/inspect-overlay/setup-guide.md")
```

Follow setup-guide fully. For Vite: Babel-mode. For Next.js: full Babel mode (warn user that Turbopack will be disabled).

**Sync to project.json:**

No project.json update needed — inspect-overlay is dev-only, no NPM package, no `stack.*` key. Matches greenfield Phase 5b.

Add `inspect-overlay` to `installed_in_session[]`.

**Condition not triggered or "Skip":** no action.

### playwright-toolchain (mature opt-in)

**Detect:**

- `stack.type` is `Web Frontend` or `Fullstack` (from project.json)
- `@playwright/test` is missing from `devDependencies` in `package.json`

Both conditions true → show AskUserQuestion:

```yaml
header: "Playwright toolchain"
question: "Frontend skills expect playwright-cli + @axe-core/playwright for smoke checks. This project does not have it yet. Install?"
options:
  - label: "Install (Recommended)"
    description: "playwright-cli (global) + @playwright/test + @axe-core/playwright (devDeps)"
  - label: "Skip"
    description: "Do not install — smoke checks in frontend-design will report failure"
multiSelect: false
```

**On "Install" or "Let Claude decide":**

```bash
npm install -g @playwright/cli@latest
npx @playwright/cli install chromium
{pkgmgr} install --save-dev @playwright/test @axe-core/playwright
```

Add `playwright-toolchain` to `installed_in_session[]`.

**Condition not triggered or "Skip":** no action.

Do not expand to other libraries — tier-1 modules with a stack slot go through PHASE 0.6/5.8. PHASE 5.65 is exclusively for dev-tools without a stack slot.

Mark PHASE 5.65 → `completed`.

### PHASE 5.7: Setup Task Seeding (frontend projects only)

> **Todo**: mark PHASE 5.65 → `completed`, PHASE 5.7 → `in_progress`.

**Trigger**: `stack.framework` from PHASE 2a is a frontend framework (React, Vue, Svelte, Next.js, Nuxt, Astro, Remix, SolidJS). Otherwise skip entirely.

**Compute**: `needsTheme` = `project.json#theme` has no `colors` or is empty. Skip if `needsTheme = false`.

**Seed** `setup-design-tokens` feature to `.project/backlog.json` — same JSON block as greenfield Phase 7c step 2:

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

Create `.project/backlog.json` with the schemaVersion-2 scaffold (see `shared/BACKLOG.md`) if missing. Skip if feature with name `setup-design-tokens` already exists (idempotent).

Always set `data.flags.hasSeed = true` and `data.flags.seedPath = ".project/project-seed.md"` in the backlog JSON (even if the design-tokens item already existed). This makes the `/project-backlog` button appear.

No interactive modal — only show `Setup task added to backlog` in stdout. The PHASE 6 report "Next steps" section then automatically shows the `/frontend-tokens` bullet.

Mark PHASE 5.7 → `completed`.

### PHASE 5.75: Legacy github-project.json migration

> **Todo**: mark PHASE 5.7 → `completed`, PHASE 5.75 → `in_progress`.

**Trigger**: `.project/github-project.json` exists. Otherwise skip entirely.

```bash
test -f .project/github-project.json && echo "found"
```

**If present:**

1. Read `.project/github-project.json` as JSON.
2. Read `.project/project.json` → `data.team` section.
3. Write fields to `data.team.githubProject`:

   ```json
   "githubProject": {
     "owner": "<github_project.json owner>",
     "repo": "<github_project.json repo>",
     "projectNumber": "<github_project.json projectNumber or null>",
     "defaultAssignee": "<github_project.json defaultAssignee or null>"
   }
   ```

4. Write `project.json` back.
5. Move the file to archive:

   ```bash
   mkdir -p .project/.archive
   mv .project/github-project.json .project/.archive/github-project.json
   ```

No prompt — silent migration. Only show `Legacy github-project.json migrated to project.json#team.githubProject` in stdout.

Mark PHASE 5.75 → `completed`.

### PHASE 5.8: Module Gap Install

> **Todo**: mark PHASE 5.7 → `completed`, PHASE 5.8 → `in_progress`.

**Read `gap_choices[]` back:** open `.project/session/onboard-state.json`, parse `gapChoices`. File not present or empty array → treat as `gap_choices = []`.

**Trigger:** `gap_choices[]` is not empty. Otherwise skip entirely to PHASE 6.

**Once:**

```
Read("references/mode-install.md")
```

**Per module in `gap_choices[]`:** follow only `mode-install.md` **PHASE 5** steps 0-5 (state check → install → configure → verify → sync project context). **Skip the TaskCreate of 7 items at the top of mode-install.md** — that belongs to standalone install mode. Work the steps inline within this mature TaskCreate item; do not add a new TaskList and do not mutate mature todos.

If mode-install.md refers to its own PHASE 0/1/2/3/4/6/7 — skip those. Those are for standalone install runs.

Remember installed modules as `installed_in_session[]` for use in PHASE 6 report. One pass — no automatic repeat.

**Cleanup:**

```bash
rm -f .project/session/onboard-state.json
```

**Not in scope:**

- Research-mode libraries (Path B) — users who want non-tier-1 must use `/core-setup [free-text]`
- Categories without a stack slot (Routing, Animation, Icons, Auth, i18n, Analytics)

Mark PHASE 5.8 → `completed`.

---

### PHASE 5.85: Stack Baseline Research

> **Todo**: mark PHASE 5.8 → `completed`, PHASE 5.85 → `in_progress`.

Follow `references/stack-baseline-shared.md`.

**Trigger:** only when `stack.framework` is filled and `.claude/research/stack-baseline.md` does not yet exist (idempotent — safe to restart). Otherwise skip.

Mark PHASE 5.85 → `completed`.

---

### PHASE 6: Report

> **Todo**: mark PHASE 5.85 → `completed`, PHASE 6 → `in_progress`.

**Render rules** for the report below:

- Bullets with `{if <condition>}` prefix: skill evaluates condition, renders bullet only if `true`. The `{if X}` prefix is **not** shown literally in the output.
- Bullets without prefix: always render.

**Condition syntax:**

- `<path> empty` — true if value is `null`, `undefined`, empty string `""`, empty array `[]`, or object with no own keys `{}`
- `<path> = <value>` — strict equality check
- `&&` / `||` — logical operators with short-circuit evaluation
- Undefined operand with `&&` → `false`; with `||` → skipped
- `<name>` without operator → boolean variable computed in earlier PHASE (e.g. `needsTheme` from PHASE 5.7)

| Condition                             | Bullet                                     |
| ------------------------------------- | ------------------------------------------ |
| (none — always)                       | `/core-pull`                               |
| `seed.pitch` empty                    | `/project-seed`                            |
| `features[]` empty                    | `/dev-define`                              |
| frontend stack && `needsTheme = true` | `/frontend-tokens`                         |
| `installed_in_session[]` not empty    | show "Modules added: {list}" under Updated |

**Branch/PR context fetch (before render):**

```bash
git rev-parse --abbrev-ref HEAD                                          # current branch
git rev-list --left-right --count origin/main...HEAD 2>/dev/null         # behind/ahead of main
gh pr list --json number,title,headRefName,isDraft --limit 5 2>/dev/null # open PRs (skip if gh not available)
```

```
ONBOARD COMPLETE

Project: {project-name}
Mode:    mature (full scan {+ LLM extraction | --no-llm})

Repository:
  Branch:  {current branch}
  vs main: ↓{N} behind  ↑{M} ahead  {if no remote: "(no remote)"}
{if open PRs present}  Open PRs: {#number title (draft?), ...}

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
  Authors:      {list, or "codebase-wide" for LLM-inferred}

CLAUDE.md:     {generated | {N} sections added | already complete}
Stack baseline: {.claude/research/stack-baseline.md created | already present | skipped (no framework)}
Claude config: {settings.local.json + hook created | already present}

Updated: {date}
{if installed_in_session[] not empty}  Modules added: {installed_in_session[]}

Next steps:
  • /core-pull              — incremental updates (sync state is on)
{if seed.pitch empty}     • /project-seed   — fill in seed pitch
{if features[] empty}     • /dev-define         — define the first feature
{if frontend && needsTheme}  • /frontend-tokens — design tokens (color, typography, spacing)
```

Mark PHASE 6 → `completed`.

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
