---
name: project-retire
description: Safely retire a built feature — code, backlog, and memory. Use with /project-retire.
reads:
  [
    backlog.status,
    backlog.features,
    feature.files,
    feature.build,
    project-context.architecture,
    project-context.learnings,
    concept.seed,
  ]
writes:
  [
    backlog.status,
    backlog.features,
    project-context.architecture,
    project-context.learnings,
    backlog.seedDrift,
  ]
metadata:
  author: claude-config
  version: 1.0.0
  category: project
---

# Retire

Safely decommission a **built** feature: remove its code, fix or flag every caller, pass the test suite, and clean up backlog + architecture + learnings — with history preserved (archive, never silent deletion). Modeled on the `core-delete` safety pattern: scan → impact report → confirm → execute → verify.

**Trigger**: `/project-retire` or `/project-retire {feature-name}`

## When to Use

- A DONE/DOING (or already shipped) feature is no longer needed and its code should leave the codebase
- NOT for: un-built TODO/DEFINED items (cancel those via `/project-backlog` update mode or the board UI), removing a skill (`/core-delete`), or removing a project from the multi-project setup (`/project-remove`)

## Workflow

**Phase tracking** — before pre-flight, call `ToolSearch query="select:TaskCreate,TaskUpdate"`, then `TaskCreate` with these 7 items (status `pending`); use `TaskUpdate` to mark each phase `in_progress`/`completed`:

1. PHASE 0: Feature Selection + Pre-flight
2. PHASE 1: Impact Analysis
3. PHASE 2: Impact Report + Confirm
4. PHASE 3: Execute Removal
5. PHASE 4: Test Gate
6. PHASE 5: Memory Sync
7. PHASE 6: Verify Scan + Report

### Stack Detection (pre-PHASE 0)

1. Try to read `.project/project.json`
2. `stack.engine === "godot"` OR `concept.platform === "game"` → **GAME MODE** (GUT test runner, Godot terminology); otherwise **WEB MODE**
3. Show: `STACK: web | game`

### PHASE 0: Feature Selection + Pre-flight

1. **Candidate set**: read `.project/backlog.json` → features with `status` DONE or DOING, **plus** `.project/archive/backlog-archive.json#archived[]` (shipped dev-track features). Mark each candidate's origin (`backlog` | `archive`).
2. **Selection**: argument provided → validate against the candidate set. No argument → numbered-list selection (`shared/SKILL-PATTERNS.md § Numbered List Selection`) over the candidates with status/origin columns.
   - Selected item has status TODO/DEFINED → stop: `Not built yet — cancel it via /project-backlog update mode or the board UI instead.`
3. **Load the feature's footprint** (parallel reads):
   - `.project/features/{name}/feature.json` → `files[]` (may be absent for small items — then components are the only file source)
   - `.project/project-context.json` → components where `feature === "{name}"` (owned components), plus the full `components[]` for the graph scan
   - `.project/backlog.json` → other features with `"{name}"` in their `dependencies[]`
4. **Git safety gates** (`shared/SKILL-PATTERNS.md § Git Safety Gates`): working tree must be clean (abort with instructions if dirty); record `BASELINE_SHA=$(git rev-parse HEAD)` and the current branch.

### PHASE 1: Impact Analysis

> **Todo**: Read `.claude/skills/project-retire/references/impact-analysis.md` — removal set, connects_to graph scan, grep scan, shared-file detection, CRITICAL/WARNING/INFO classification.

### PHASE 2: Impact Report + Confirm

1. Show the report (core-delete template):

   ```
   IMPACT REPORT: {feature}

   Removal set: {N} files ({M} shared — surgical edit only)

   CRITICAL (runtime breakage):
     - {file:line} — {component} ← {edge type} from {caller component}
   WARNING (needs update):
     - {file:line} — {description}
   INFO (cosmetic / memory):
     - {N} learnings to archive, {M} components to remove, backlog → CANCELLED, 1 seedDrift entry
   ```

2. AskUserQuestion — header "Retire":
   - "Retire + update references (Recommended)" — remove code and fix all references
   - "Retire code only" — skip reference fixes (may break callers; survivors listed in PHASE 6)
   - "Cancel" — stop, no changes
3. AskUserQuestion — header "Isolation":
   - "Branch retire/{feature} (Recommended)" — create and switch; merge later via `/core-finalize`. Branch, not worktree: `.project/` memory writes must land in the main checkout.
   - "Current branch" — execute directly here

### PHASE 3: Execute Removal

> **Todo**: Read `.claude/skills/project-retire/references/execute-removal.md` — memory snapshot, per-reference handling (CRITICAL via AskUserQuestion, WARNING/INFO auto-fix), file deletion, route/endpoint deregistration.

### PHASE 4: Test Gate

1. Detect the test command from CLAUDE.md `### Testing` ([GAME MODE]: GUT runner). Run the **full suite** — no test-impact-analysis; deletions break couplings that import graphs miss.
2. **FAIL** → max 2 fix attempts, only on failures plausibly caused by the removal (dangling references, dead fixtures, removed routes). Still failing → **full rollback**:
   - `git reset --hard $BASELINE_SHA` (on `retire/{feature}`: also delete the branch and switch back)
   - Restore `.project/` memory snapshots (gitignored — immune to git reset)
   - Report `ROLLED_BACK` with the failing output. No partial states.
3. **PASS** → continue. Snapshots are cleaned in PHASE 6, not here.
4. No test runner configured → warn explicitly (`No test suite — removal is unverified`) and require a plain-text `y` confirmation to continue.

### PHASE 5: Memory Sync

> **Todo**: Read `.claude/skills/project-retire/references/memory-sync.md` — backlog → CANCELLED, architecture cleanup, learnings archive + tombstone, seedDrift entry, feature-dir archive.

### PHASE 6: Verify Scan + Report

1. **Post-removal scan**: Grep the feature name + removed exported symbols across the codebase (exclude `.project/archive/`). Survivors = sites the user chose to skip — list them.
2. **Scoped commit** per `shared/SCOPED-COMMIT.md` (message: `chore({name}): retire feature — {reason}`); then delete the memory snapshots.
3. Final report:

   ```
   RETIRED: {feature}

   | Step             | Result                                  |
   |------------------|------------------------------------------|
   | Files removed    | {N} ({M} shared files edited)            |
   | References fixed | {X} fixed, {Y} skipped                   |
   | Tests            | PASS ({suite})                           |
   | Backlog          | CANCELLED + cancelledReason              |
   | Architecture     | {N} components removed, edges stripped   |
   | Learnings        | {N} archived + 1 tombstone               |
   | Seed drift       | 1 entry (/project-retire)                |

   Next steps:
   - /core-finalize — merge retire/{feature}   ← only when on a branch
   - /project-seed — sync the concept (drift entry pending)
   ```

## Safety Rules

- **NEVER** run with a dirty working tree — baseline must be restorable
- **NEVER** delete shared files (in another feature's `files[]` or another component's `src[]`) — surgical edits only
- **NEVER** silently delete learnings — archive + tombstone, history stays recoverable
- **ALWAYS** show the impact report and get explicit confirmation before any mutation
- **ALWAYS** roll back completely on a failed test gate — no partial retirements

### Terminal Formatting

- NEVER use blockquote syntax (`>`) for displaying content — causes unreadable white background in dark terminals
- Backticks only for actual code, file paths, and command references

### Language

Follow the Language Policy in CLAUDE.md.
