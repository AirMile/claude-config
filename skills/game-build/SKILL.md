---
name: game-build
description: Build Godot features test-first with TDD. Use with /game-build.
reads: [feature.requirements, backlog.stage]
writes: [feature.requirements, feature.build, backlog.stage, learnings]
metadata:
  author: claude-config
  version: 2.9.0
  category: game
---

# Build

## Overview

PHASE 2 of the gamedev workflow: plan -> define -> **build** -> test -> refactor

The build phase implements features test-first using TDD for all requirements with testable behavior; Implementation Only only for pure visual/config without testable logic. It generates tests, iterates through RED-GREEN-REFACTOR cycles, and syncs codebase understanding.

**Trigger**: `/game-build` or `/game-build [feature-name]`

## Input

Reads `.project/features/{feature-name}/feature.json`: requirements (REQ-XXX), architecture, files, buildSequence.

## Output Structure

```
.project/features/{feature-name}/
├── feature.json           # Enriched with build, packages, tests.checklist sections
├── playtest_scene.tscn    # Auto-generated test scene
└── debug_listener.gd      # Debug signal capture script

scenes/                    # Created .tscn files
scripts/                   # Created .gd files
resources/                 # Created .tres files
tests/
├── test_{feature}.gd     # Unit tests (GUT)
└── scenes/               # Integration test scenes
    └── test_{feature}_runtime.tscn
```

## Test Output Parsing (CRITICAL)

**ALL test runs must have their output PARSED before showing in context.**

Raw GUT output is ~500 lines per run. With 15 runs per build = 7500 lines of context bloat.

**Parsing rules:**

After running any GUT test command, parse the output to this format:

**PASS scenario (1 line):**

```
TESTS: 141/141 PASS (10.2s)
```

**FAIL scenario (max 10 lines):**

```
TESTS: 139/141 PASS (10.2s)
FAILED:
- test_health_system.test_req001: expected 100, got 0
- test_player.test_knockback: signal not emitted
```

**PENDING scenario (max 5 lines):**

```
TESTS: 4/15 PASS, 11 PENDING (2.1s)
```

**Parse logic:**

1. Find "Tests X" and "Passing X" in output
2. Find all "[Failed]:" lines with error details
3. Find all "[Pending]:" lines
4. Format as compact summary
5. ONLY show full output when debugging with -glog=3

**This reduces context by ~99% per test run.**

## Process

**Phase tracking** — first action of the skill: call `TaskCreate` with these 10 items (status `pending`), then use `TaskUpdate` to set each phase `in_progress` at the start and `completed` at the end. If context compaction occurs, the task list remains visible — no risk of forgetting phases.

1. PHASE 0: Load Context
2. PHASE 1: Technique Mapping
3. PHASE 2: Generate Tests (TDD Requirements)
4. PHASE 3: Build Cycle
5. PHASE 3a: Full Regression Gate
6. PHASE 3b: Integration Tests + Playtest
7. PHASE 4: What Did We Build?
8. PHASE 4b: Project Sync
9. PHASE 5: Completion
10. PHASE 6: Scoped Commit

### PHASE 0: Load Context

> **Todo**: call `TaskCreate` with the 10 phase items (see above). Mark PHASE 0 → `in_progress` via `TaskUpdate`.

1. **If no feature name provided — check backlog:**
   - Read `.project/backlog.html`, parse JSON from `<script id="backlog-data">` block (see `shared/BACKLOG.md`)
   - See `shared/BACKLOG.md → Lifecycle Protocol → Read`. Filter: `type === "FEATURE" && transition === "building"` — if found, auto-select (no modal needed).
   - Fallback: Filter defined features: `data.features.filter(f => f.status === "DEFINED")`
   - First defined feature is the suggested next feature
   - Use **AskUserQuestion** with backlog-suggested feature:
     ```
     Backlog suggests: {feature-name}
     Defined features available: {list}
     Build {feature-name}? (or specify another)
     ```

2. **Load architecture baseline:**
   - `Read(".claude/research/architecture-baseline.md")`
   - If not found: warn user but continue
     ```
     WARNING: No architecture-baseline.md found.
     Run /project-backlog or create .claude/research/architecture-baseline.md for better context.
     Continuing without baseline...
     ```

3. **Project context** (optional, skip if not present):

   Read `.project/project.json`. Extract:
   - `stack` — framework, language, packages (fallback for architecture-baseline)
   - `data.entities` — existing data model (prevents conflicts)

   Read `.project/project-context.json` (if present). Extract:
   - `context.structure` — where files belong (directory structure)
   - `context.patterns` — existing code patterns to follow
   - `architecture` — current architecture diagram and description

   **Learnings load** (via [shared/LEARNINGS-LOAD.md](../shared/LEARNINGS-LOAD.md)):

   Configuration:

   ```
   scopes: [component]
   pitfall-prefix: true
   current-feature: <feature-name>
   ```

   Display the loaded output. The pitfall-prefix section and component-scoped patterns provide context for the build (not a constraint — when in doubt, assume root cause, don't pattern-match).

   Store the loaded learnings for PHASE 1 (Technique Mapping).

   If project.json does not exist → continue without it (backwards compatible).

   **Compose PROJECT_CONTEXT** (passed to technique execution in PHASE 2/3):

   Build selectively based on `feature.json` → `files[]` paths:
   - `Structure` and `Patterns` → always include (compact)
   - `Entities` → only if the feature touches scenes/resources with data

   ```
   PROJECT CONTEXT:
   Structure: {context.structure or "not available"}
   Patterns: {context.patterns or "not available"}
   Entities: {data.entities or "not available" — skip if feature has no data impact}
   ```

4. **Load feature.json:**

   **Ready queue** (only if no feature name provided via CLI):

   Parse `.project/backlog.html`. Calculate per DEFINED feature whether all `dependencies[]` have `status === "DONE"` (or the dependency list is empty). Display before feature selection:

   ```
   Ready to build:
     ✓ jump-mechanic     P1  (no deps)
     ✓ enemy-ai          P2  deps: [pathfinding ✓]

   Blocked:
     ✗ boss-fight        P1  waiting on: [enemy-ai — DOING]
   ```

   - Show "Blocked" section only if there are blocked features
   - If no DEFINED features exist → "No features ready to build." → exit

   If no feature name provided:
   1. Parse `.project/backlog.html` (see `shared/BACKLOG.md`). Filter `status === "DEFINED"` → suggest via **AskUserQuestion** (ready features at top)
   2. Fallback: list `.project/features/` with `feature.json`, let user select

   Load `feature.json`. Extract: `requirements[]`, `buildSequence[]`, `files[]`, `testStrategy[]`. If `clarifications[]` is present: treat as hard constraints during implementation (gray-area decisions made by the user).

   Not found → exit: "Run `/game-define` first."

   **Dependency check:**

   Skip if no `depends[]` or empty.
   1. Parse `.project/backlog.html`. Not found → skip.
   2. Per dependency: status must be `"DONE"`.
   3. Blockers found → **AskUserQuestion**:
      - "Stop — finish {dep} first (Recommended)" / "Continue anyway"
      - Stop → exit. Continue → continue.

   **Workspace setup:**

   Follow `shared/WORKTREE.md → Auto-create worktree` with `feature-name = "{feature-name}"`. The procedure auto-creates an isolated worktree and wires `.project/` symlinks. No AskUserQuestion needed — creation is automatic when no worktree exists for the feature yet. Skip if already in a worktree (procedure detects).

   **Mandatory output** (always log, never silent):

   ```
   WORKTREE: {absolute-path} ({created | reused | skipped: already-in-worktree})
   ```

   If the procedure did not run (e.g. no git repo, error), log `WORKTREE: not-applied ({reason})` instead. This line is non-negotiable — without it, the auditor cannot verify whether isolation was achieved.

   **Pre-PHASE-1 gate** (hard check — shell-state verification):

   ```bash
   CURRENT="$(pwd)"
   EXPECTED_SUFFIX="/.claude/worktrees/{feature-name}"
   if [[ "$CURRENT" == *"$EXPECTED_SUFFIX" ]]; then
     echo "GATE: ok — inside worktree"
   elif grep -q "^WORKTREE: not-applied" <<< "$WORKTREE_LOG"; then
     echo "GATE: ok — worktree explicitly skipped"
   else
     echo "ABORT: PHASE 0 incomplete — not inside expected worktree and no 'WORKTREE: not-applied' marker found."
     echo "Re-run /game-build from the start; follow shared/WORKTREE.md → Auto-create worktree literally."
     exit 1
   fi
   ```

   | Condition                                           | Result                                                     |
   | --------------------------------------------------- | ---------------------------------------------------------- |
   | `pwd` ends with `/.claude/worktrees/{feature-name}` | Pass — worktree created and switched into                  |
   | `WORKTREE: not-applied (...)` was logged            | Pass — worktree intentionally skipped (no git repo / etc.) |
   | Otherwise                                           | ABORT — silent skip detected                               |

   **Symlink integrity gate** — follow `shared/WORKTREE.md → Symlink Integrity Gate (post-switch auto-repair)`. Skip if `WORKTREE: not-applied` was logged.

   This gate is falsifiable from shell state; it cannot be bypassed by skipping the prose log.

   **Clear backlog transition flag** (immediately after loading feature):

   Read `.project/backlog.html` (if present), parse JSON (see `shared/BACKLOG.md`).
   Find feature by name → remove `transition` field if present (auto-pickup signal consumed), `data.updated` to now. **Keep status as `"DEFINED"`** — the DEFINED → DOING transition happens in PHASE 3A on successful completion.
   Write back via Edit (keep `<script>` tags intact).

5. **Read implementation order:**

   Extract the `buildSequence[]` from feature.json (sorted by step).
   This was determined during the define phase.

   ```
   Implementation order (from define phase):
   1. REQ-001 (base)
   2. REQ-002 (after REQ-001)
   3. REQ-003 (after REQ-002)
   ```

6. **Display context:**

   ```
   FEATURE: {feature-name}

   REQUIREMENTS:
   - REQ-001: [description]
   - REQ-002: [description]
   ...

   ARCHITECTURE:
   - Scenes: [list]
   - Scripts: [list]
   - Resources: [list]

   IMPLEMENTATION ORDER:
   1. REQ-001 (base)
   2. REQ-002 -> REQ-001
   ...
   ```

**Capture git baseline** (for scoped commit at end of skill):

```bash
mkdir -p .project/session
# Cleanup stale session state from previous crashed runs (>1 day old)
find .project/session -maxdepth 1 \( -name "active-*.json" -o -name "pre-skill-*.txt" \) -mtime +1 -delete 2>/dev/null
git status --porcelain | sort > .project/session/pre-skill-status.txt
echo '{"feature":"{feature-name}","skill":"build","startedAt":"{ISO timestamp}"}' > .project/session/active-{feature-name}.json
```

**Risk check (only if backlog feature `risk >= 4`):**

If the loaded backlog feature has a `risk` score of 4 or 5, show this warning before PHASE 1:

```
⚠ HIGH RISK — Complexity {risk}/5

Consider before building:
- Are all dependencies available (status DONE)?
- Is the feature definition complete (all REQs clear)?
- Build in small steps — commit after each working REQ
```

### PHASE 1: Technique Mapping

> **Todo**: mark PHASE 0 → `completed`, PHASE 1 → `in_progress`.

**REMOVED filter**: Requirements with `deltaOp === "REMOVED"` are skipped — do not assign a technique, do not show in technique map table.

Per requirement, assign a technique: **TDD** (default) or **Implementation Only**.

#### Decision Logic

**TDD** (test first, then implement) — default for all testable requirements:

- Game logic and calculations
- Physics calculations
- Damage formulas and stat systems
- State transitions and state machines
- Signal flows and event handling
- Data transformations
- Scene tree construction and node configuration
- Resource creation (.tres files)
- Visual configuration (sprites, animations, particles) with testable properties
- Audio setup (AudioStreamPlayer nodes)
- UI layout and theme configuration

For scene/resource requirements: write the verification test first (RED: `preload().instantiate()` fails or node missing), then build (GREEN).

**Implementation Only** (no tests — only when automated tests add no value):

- Pure visual/particle effects without logic (e.g. screen shake, particle colors)
- Audio configuration (volume, bus assignment)
- Static scene configuration (camera, lighting, environment setup)
- Prototype code (explicit marking)
- Mandatory reason: `visual-only`, `config-only`, or `prototype`

**Pitfall overlap check**: for each requirement, compare against the pitfall list from PHASE 0. On clear thematic overlap (same domain, same type of bug risk) → explicitly log which pitfall is triggered and how this build prevents it. No forcing — only mark where relevant.

#### Assignment

```
TECHNIQUE MAPPING:

TDD:
- REQ-001: Water ability deals 20 damage [logic]
- REQ-002: Puddle spawns at impact location [scene setup]
- REQ-003: Puddle slows enemies by 30% [calculation]

IMPLEMENTATION ONLY:
- REQ-004: Water splash particle effect [visual-only]
```

Proceed automatically — do NOT confirm with the user. The decision logic above is deterministic enough to auto-assign. Display the mapping for visibility, then continue to the next phase.

### PHASE 2: Generate Tests (TDD Requirements)

> **Todo**: mark PHASE 1 → `completed`, PHASE 2 → `in_progress`.

#### Step 0: Load GUT patterns

Read `references/gut-conventions.md` for test file structure, assertions and mock patterns. No sub-agent needed — patterns are available locally.

#### Step 1: Generate Test Stubs

For each **TDD** requirement, generate a corresponding test stub:

```gdscript
extends GutTest
## Tests for {Feature}
## Generated from feature.json requirements

var _sut: ClassName  # System Under Test

func before_each() -> void:
    pass  # Setup

func after_each() -> void:
    pass  # Cleanup

# REQ-001: {requirement description}
func test_req001_{snake_case_description}() -> void:
    pending("Not implemented")

# REQ-003: {requirement description}
func test_req003_{snake_case_description}() -> void:
    pending("Not implemented")
```

#### Step 2: Verify Test Structure

**Actions:**

1. Create `tests/test_{feature}.gd` with all test stubs
2. Run GUT tests to verify structure:
   ```bash
   "{godot_executable}" --headless --path . -s addons/gut/gut_cmdln.gd -gexit -gtest=res://tests/test_{feature}.gd
   ```
3. All tests should be PENDING (yellow)

**Output:**

```
PHASE 2 COMPLETE

Tests generated: {count} (TDD requirements only)
Status: All PENDING

Ready for TDD cycle.
```

### PHASE 3: Build Cycle

> **Todo**: mark PHASE 2 → `completed`, PHASE 3 → `in_progress`. Read `.claude/skills/game-build/references/phase-3-tracks.md` and follow both tracks (TDD, Implementation Only) in order.

### PHASE 3a: Full Regression Gate

> **Todo**: mark PHASE 3 → `completed`, PHASE 3a → `in_progress`.

**Goal:** Verify that the new feature hasn't broken existing features.

After successful completion of all tracks, run the **full GUT test suite** (not just the current feature):

```bash
"{godot_executable}" --headless --path . -s addons/gut/gut_cmdln.gd -gexit
```

Parse output with the same rules as all test runs (see Test Output Parsing).

**PASS:** All tests pass — continue to PHASE 3b.

```
REGRESSION CHECK: {total}/{total} PASS — no regressions
```

**FAIL:** Other feature tests fail — this is a gate.

```
REGRESSION CHECK: {passed}/{total} PASS
REGRESSIONS FOUND:
- test_{other_feature}.test_xxx: {reason}
- test_{other_feature}.test_yyy: {reason}

File overlap: {list of files used by both this feature and the failing feature}
```

On regression:

1. Analyze whether the current feature caused the regression (check shared files/signals)
2. If YES: fix the regression before continuing. Re-run full suite after fix.
3. If NO (pre-existing failure): warn user, let them choose via AskUserQuestion:
   - "Fix regression first (Recommended)" / "Continue anyway (regression existed before this build)"
4. Max 2 fix attempts. After that: report as blocker and let user decide.

**Skip condition:** If no other test files exist (first feature), skip with:

```
REGRESSION CHECK: skipped (no prior features with tests)
```

### PHASE 3b: Integration Tests + Playtest (PARALLEL)

> **Todo**: mark PHASE 3a → `completed`, PHASE 3b → `in_progress`. Read `.claude/skills/game-build/references/phase-3b-integration.md` for integration test scene template and DebugListener script.

These two tasks have NO dependencies on each other - run them in parallel.

### PHASE 4: What Did We Build?

> **Todo**: mark PHASE 3b → `completed`, PHASE 4 → `in_progress`.

**STOP — do NOT proceed to sync without completing this phase fully.**

Display a visual separator:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
WHAT DID WE BUILD?
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

**Step 1 — Display explanation (mandatory, do not skip)**

The user needs to understand how the feature works to make good decisions in the test and refactor phases. Display the following explanation as if you are explaining it to a student:

- **What does it do?**: 1-2 sentences as you would explain to a friend. Describe what the player sees and can do — no technical terms.
- **Example**: 1 concrete gameplay scenario in 2-3 sentences. "Imagine: you press X, your character does Y, you see Z on screen."
- **How does it work?**: 1 ASCII diagram that tells the whole story. Choose the most relevant type (scene tree, signal flow, or state diagram). Use box-drawing characters (┌─┐│└─┘) and arrows (→ ← ↓ ↑). Max 15 lines. The user should be able to read the diagram without additional explanation.

**Step 2 — Comprehension check (mandatory, do not skip)**

**AskUserQuestion** directly after the explanation:

Question: "Do you understand how the feature works?"
Options: "Yes, clear" / "Explain in more detail" / "I have a question"

Follow-up loop until "Yes, clear". Save explanation as `build.explanation` in feature.json (targeted Edit).

### PHASE 4b: Project Sync

> **Todo**: mark PHASE 4 → `completed`, PHASE 4b → `in_progress`.

Follow `shared/SYNC.md` 3-File Sync Pattern. Skill-specific mutations below.

Read in parallel (skip if not present):

- `.project/features/{feature-name}/feature.json`
- `.project/backlog.html`
- `.project/project.json`
- `.project/project-context.json`

Mutate in memory:

**feature.json**: `status → "DOING"`, `stage → "built"`, `requirements[]` → enrich with `technique`, `syncNote`, `status: "built"`, `files[]` → merge with actual files. Add: `build {}` (started, completed, techniques, testsPass, testsTotal, decisions), `packages[]`, `tests.checklist[]` (status: "pending"). Do NOT overwrite existing sections.

**Backlog** (see `shared/BACKLOG.md`): find feature by name → set `"status": "DOING"` (transition DEFINED → DOING at successful build completion), `stage → "built"`, `data.updated` → now. This is the only place where DOING is written.

**Context** (in `project-context.json`, see `shared/DASHBOARD.md` → `context`): identify new scenes (.tscn), scripts (.gd) with class names, signals, resources (.tres). Update `context.structure` (overwrite), `context.patterns` (merge signals, autoloads, conventions), `context.updated`. Skip if no structural impact.

**Dashboard** (see `shared/DASHBOARD.md`): feature status → `"DOING"`, stage → `"built"`. If feature does not exist: push with `{ name, status: "DOING", stage: "built", summary, created }`.

**Architecture** (in `project-context.json`, **follow component-first model from `shared/DASHBOARD.md`**): update `architecture.components[]` — built components `status: "planned"` → `"done"`, fill `description` (short functional description, max 200 chars — what does this component do?), `src`, `test`, `connects_to` (typed edges `{ to, type }` — `calls` for signal emits/method calls, `reads`/`writes` for autoload/state IO, `depends_on` for scene-tree parent or resource references), `feature` (current feature name). New components: push with all fields including `feature`. If `layers`/`components` do not exist AND multiple scenes/signals → generate initial architecture with layers + components. Skip if no structural impact. Log: `architecture: updated` or `architecture: no updates needed`.

**Learning extraction** (after feature.json sync): write to `project-context.json learnings[]` (append-only, identical format to `game-verify`/`game-refactor`):

- `build.decisions[]` → `type: "pattern"` (architectural choice made)
- `build.blockers[]` where the blocker was resolved (no longer BLOCKED at end of build) → `type: "pitfall"`

```json
{
  "date": "...",
  "feature": "{name}",
  "type": "pattern|pitfall",
  "source": "extracted",
  "summary": "..."
}
```

Only write if decisions or resolved blockers are present — no empty entries.

Write in parallel:

- Write `feature.json`
- Edit `backlog.html` (keep `<script>` tags intact)
- Write `project.json`
- Write `project-context.json` (if context/architecture changed)

### PHASE 5: Completion

> **Todo**: mark PHASE 4b → `completed`, PHASE 5 → `in_progress`.

#### Output summary

```
BUILD COMPLETE: {feature}
========================

Techniques: TDD ({n}), Implementation Only ({n})
Tests: {passed}/{total} PASS
Files created: {count}

Created files:
- tests/test_{feature}.gd
- tests/scenes/test_{feature}_runtime.tscn
- scripts/...
- scenes/...
```

### PHASE 6: Scoped Commit

> **Todo**: mark PHASE 5 → `completed`, PHASE 6 → `in_progress`. Read `.claude/skills/game-build/references/phase-6-commit.md` for the full scoped auto-commit flow.

## References

Read these Just-In-Time during specific phases — do not load upfront.

| File                                 | When to load                                                                    |
| ------------------------------------ | ------------------------------------------------------------------------------- |
| `references/gut-conventions.md`      | PHASE 2 — when generating test files (file structure, assertions, mocks)        |
| `references/gut-commands.md`         | PHASE 3, 3a, 3b — when running GUT tests                                        |
| `references/troubleshooting.md`      | PHASE 3 — on test failures or build blockers                                    |
| `references/phase-3-tracks.md`       | PHASE 3 — full TDD and Implementation Only track instructions                   |
| `references/phase-3b-integration.md` | PHASE 3b — integration test scene template and DebugListener script             |
| `references/phase-6-commit.md`       | PHASE 6 — scoped auto-commit flow with gdlint check and git baseline comparison |

> Completion claims require fresh output (R009 — see `../shared/CODING-RULES.md`)

## Path Resolution

`{godot_executable}` in commands is resolved via `paths.yaml`:

- macOS: `/Applications/Godot.app/Contents/MacOS/Godot`
- Windows: `C:\Godot\Godot_v4.4.1-stable_win64.exe`

Override: env var `CLAUDE_GODOT_EXECUTABLE` or `.claude/paths.local.yaml`. Canonical defaults are in [skills/project-add/paths.yaml](skills/project-add/paths.yaml).
