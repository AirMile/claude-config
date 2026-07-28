---
name: game-optimize
description: Optimize Godot metrics via parallel worktree experiments. Use with /game-optimize.
reads: [project.stack, project.optimizationRuns]
writes: [project.optimizationRuns]
metadata:
  author: claude-config
  version: 0.1.0
  category: game
---

# Optimize

Autonomous improvement loop for Godot 4.x: define metric → spawn parallel subagents in worktrees → keep improvements, discard regressions → loop until stall.

**Trigger**: `/game-optimize` or `/game-optimize [auto]`

Inspired by the `evo-hq/evo` autoresearch pattern, integrated with `.project/` and GUT testing. No external dependency.

## Input

No required input. Config interactively in PHASE 1 or via resume.

## Output

```
.project/optimize/{run-id}/
├── spec.json          # metric, gate, scope, baseline, parameters
├── tree.json          # nodes (id, parent, branch, score, status, hypotheses)
├── runs/{NNNN}.json   # per-round result
├── benchmark.tscn     # Godot benchmark scene (generated from template)
├── benchmark.gd       # Godot benchmark script (parses SCORE= line)
├── gate.sh            # default: GUT testsuite headless
└── branches.txt       # cleanup list for abort
```

Update on completion: `.project/project.json` → push to `optimization_runs[]`.

## Process

**Phase tracking** — first action of the skill: call `TaskCreate` with these 7 items (status `pending`), then use `TaskUpdate` to set `in_progress` at the start and `completed` at the end of each phase. During context compaction the task list stays visible — no risk of forgotten phases.

1. PHASE 0: Pre-flight
2. PHASE 1: Define Metric
3. PHASE 2: Instrument Benchmark
4. PHASE 3: Baseline Run
5. PHASE 4: Optimize Loop
6. PHASE 5: Pick Winner
7. PHASE 6: Sync + Report

### PHASE 0: Pre-flight

> **Todo**: call `ToolSearch query="select:TaskCreate,TaskUpdate"` first — both tools are deferred and unusable without their schemas. Then call `TaskCreate` with the 7 phase items (see above). Mark PHASE 0 → `in_progress` via `TaskUpdate`. If the tools didn't resolve, skip seeding and continue.

**Capture git baseline:**

```bash
mkdir -p .project/session .project/optimize
find .project/session -maxdepth 1 -name "active-optimize-*.json" -mtime +1 -delete 2>/dev/null
git rev-parse HEAD > .project/session/pre-skill-sha.txt
```

**Ensure .gitignore covers optimize artifacts** (idempotent):

```bash
GITIGNORE=".project/.gitignore"
touch "$GITIGNORE"
ensure_pattern() {
  grep -qxF "$1" "$GITIGNORE" || echo "$1" >> "$GITIGNORE"
}
ensure_pattern "optimize/*/worktrees/"
ensure_pattern "session/active-optimize-*.json"
ensure_pattern "session/pre-skill-sha.txt"
```

Prevents full repo-checkouts (worktrees) or local session state from accidentally ending up in a commit.

**Git safety:**

1. `git status --porcelain` empty? Otherwise **AskUserQuestion** (Auto-mode: stash):
   - "Stash changes (Recommended)" / "Abort"
2. Detect default branch (see shared/SKILL-PATTERNS.md Git Safety Gates).
3. `BASE_SHA=$(git rev-parse HEAD)`.

**Detect Godot:**

Cross-platform path detection via `paths.yaml`:

```bash
# Windows: /c/Godot/Godot_v4.4.1-stable_win64.exe
# macOS:   /Applications/Godot.app/Contents/MacOS/Godot
# Linux:   godot4 (assume in PATH)
GODOT_BIN="${GODOT_BIN:-$(command -v godot4 || command -v godot)}"
"$GODOT_BIN" --version 2>/dev/null
```

No Godot → exit with "game-optimize requires Godot 4.x. Set GODOT_BIN env var or add to PATH."

**Detect GUT:**

```bash
test -d addons/gut && echo "GUT installed" || echo "GUT not found, gate disabled"
```

No GUT → warn that default gate does not work; user must define their own gate or accept that tests will not catch subagent regressions.

**Resume detection** + **Auto-mode** + **active signal**: see identical to `dev-optimize` PHASE 0.

**Auto-mode defaults** (game-specific):

| Decision point      | Default                      |
| ------------------- | ---------------------------- |
| Metric choice       | **FPS** (default)            |
| Subagents per round | **3**                        |
| Budget per subagent | **5 iterations**             |
| Stall threshold     | **5 rounds**                 |
| Winner-merge        | **Top branch automatically** |

**Project context** (skip if not exists):

Read `.project/project.json` for stack info and previous `optimization_runs[]`.

### PHASE 1: Define Metric

> **Todo**: mark PHASE 0 → `completed`, PHASE 1 → `in_progress`.

On resume: skip.

**AskUserQuestion 1 — what to optimize?** (Auto-mode: FPS)

```yaml
header: "Metric"
question: "What do you want to optimize?"
options:
  - label: "FPS in stress scene (Recommended)"
    description: "Average FPS at N entities/sprites. Higher is better."
  - label: "Frame time"
    description: "ms per frame in a fixed benchmark scene. Lower is better."
  - label: "Memory footprint"
    description: "MB peak (Performance.MEMORY_STATIC). Lower is better."
  - label: "AI win-rate"
    description: "% wins of AI in M simulated matches. Higher is better."
  - label: "Pathfinding speed"
    description: "ms for N paths on a fixed map. Lower is better."
multiSelect: false
```

(Custom option via "Other" → ask follow-up: scene path + score extraction line.)

**AskUserQuestion 2 — direction** (Auto-mode: minimize for frame-time/memory/pathfinding, maximize for FPS/winrate):

```yaml
header: "Direction"
options:
  - label: "Lower is better (minimize)"
  - label: "Higher is better (maximize)"
multiSelect: false
```

**AskUserQuestion 3 — scope** (Auto-mode: entire `scripts/`):

```yaml
header: "Scope"
question: "Which directories may subagents modify?"
options:
  - label: "scripts/ (Recommended)"
    description: "GDScript only, scenes intact"
  - label: "scripts/ + scenes/"
    description: "Allow scene edits (riskier)"
  - label: "scripts/ + addons/{name}"
    description: "Custom subset"
  - label: "Custom paths"
multiSelect: false
```

**AskUserQuestion 4 — loop parameters** (Auto-mode: defaults). The choice also determines which subagent model is used:

```yaml
header: "Parameters"
options:
  - label: "Conservative: 3 agents × 5 iter, stall 5, 60min cap, sonnet (Recommended)"
    description: "Cheap and fast."
  - label: "Standard: 5 agents × 5 iter, stall 5, 90min cap, sonnet"
  - label: "Aggressive: 8 agents × 8 iter, stall 8, 180min cap, opus"
    description: "Much more compute and more expensive model — only for long, difficult runs."
multiSelect: false
```

Mapping (same as dev-optimize):

| Choice       | subagents | budget | stall | wallclock | model    |
| ------------ | --------- | ------ | ----- | --------- | -------- |
| Conservative | 3         | 5      | 5     | 60 min    | `sonnet` |
| Standard     | 5         | 5      | 5     | 90 min    | `sonnet` |
| Aggressive   | 8         | 8      | 8     | 180 min   | `opus`   |

For Godot, benchmark time is often higher (Godot import cache, scene load) — wallclock cap is therefore relatively more important than with dev-optimize.

**AskUserQuestion 5 — benchmark parameters (per metric):**

| Metric      | Question                                        | Default          |
| ----------- | ----------------------------------------------- | ---------------- |
| FPS         | Number of entities in stress scene?             | 1000             |
| frame_time  | Run duration (seconds)?                         | 10               |
| memory      | Run duration (seconds) for peak measurement?    | 30               |
| ai_winrate  | Number of simulated matches?                    | 100              |
| pathfinding | Number of paths + map name (from scenes/maps/)? | 1000 + selection |

**Write `.project/optimize/{run-id}/spec.json`** (see dev-optimize for full schema, including `max_wallclock_minutes`, `subagent_model`, `run_started_at`). Replace `benchmark_cmd` with:

```bash
"benchmark_cmd": "$GODOT_BIN --headless --path . res://.project/optimize/{run-id}/benchmark.tscn --quit-after 120"
```

`gate_cmd`:

```bash
"gate_cmd": "bash .project/optimize/{run-id}/gate.sh"
```

### PHASE 2: Instrument Benchmark

> **Todo**: mark PHASE 1 → `completed`, PHASE 2 → `in_progress`.

**Step 1 — copy benchmark template (Godot scene + script):**

One universal scene `references/benchmarks/benchmark.tscn` (Node with script-ref) + per-metric GDScript:

| Metric      | Script template                        |
| ----------- | -------------------------------------- |
| fps         | `references/benchmarks/fps-stress.gd`  |
| frame_time  | `references/benchmarks/frame-time.gd`  |
| memory      | `references/benchmarks/memory.gd`      |
| ai_winrate  | `references/benchmarks/ai-winrate.gd`  |
| pathfinding | `references/benchmarks/pathfinding.gd` |

Workflow:

1. Copy `benchmark.tscn` → `.project/optimize/{run-id}/benchmark.tscn`. Substitute `{RUN_ID}` in the `path` of the ExtResource so the script path is correct.
2. Copy chosen `<metric>.gd` → `.project/optimize/{run-id}/benchmark.gd`. Substitute placeholders (`{ENTITY_COUNT}`, `{DURATION_FRAMES}`, `{SCENE_TO_LOAD}`, etc.) with user-chosen values from AskUserQuestion 5.

Templates print one line `SCORE=<float>` to stdout via `print()` before `get_tree().quit()`. Skill parses the last `SCORE=` line from Godot stdout.

**Step 2 — gate script:**

Default `references/gates/gut-green.sh` → copies script that runs GUT headless:

```bash
#!/bin/bash
"$GODOT_BIN" --headless --path . -s addons/gut/gut_cmdln.gd -gtest_dirs=test/ -gexit
```

No GUT → copies no-op gate with warning.

**Step 3 — review + edit:**

**AskUserQuestion** (Auto-mode: Run as-is):

```yaml
header: "Scripts"
question: "Is benchmark.gd and gate.sh correct?"
options:
  - label: "Run as-is (Recommended)"
  - label: "Edit first"
  - label: "Abort"
multiSelect: false
```

`chmod +x` on gate.sh.

### PHASE 3: Baseline Run

> **Todo**: mark PHASE 2 → `completed`, PHASE 3 → `in_progress`.

```bash
cd "$(git rev-parse --show-toplevel)"

# Gate first
if ! bash .project/optimize/{run-id}/gate.sh; then
  echo "BASELINE GATE FAIL: fix GUT tests first"
  exit 1
fi

# Benchmark — capture stdout, parse SCORE
RAW=$("$GODOT_BIN" --headless --path . res://.project/optimize/{run-id}/benchmark.tscn --quit-after 120 2>&1)
BASELINE=$(echo "$RAW" | grep -E '^SCORE=' | tail -1 | cut -d= -f2)
```

Write `runs/0000.json` and initialize `tree.json` (see dev-optimize PHASE 3).

**Display + cost estimate** (same calculation as dev-optimize PHASE 3 — see there for the formulas). Godot benchmark times are often higher (first run per worktree has import-cache overhead of 30-60s), take that into account in the estimate.

```
BASELINE: {metric} = {score} ({direction})
GUT: {pass}/{total} tests green.

COST ESTIMATE (worst-case):
- {subagents} agents × {budget} iter × {stall} rounds = {TOTAL_ITERS} agent-iterations
- ~{PER_ITER_SECONDS}s per iteration ({BENCHMARK_SECONDS}s benchmark + {GATE_SECONDS}s gate + 30s import)
- Estimated time: ~{TOTAL_MINUTES} min (capped at {max_wallclock_minutes} min)
- Estimated cost: ~${TOTAL_DOLLARS} ({subagent_model})
```

**AskUserQuestion** (Auto-mode: if `TOTAL_DOLLARS > 10` OR `TOTAL_MINUTES > 120` → abort):

Identical option set as dev-optimize: Continue / Reduce budget / Abort.

**Mark run-start**: write `run_started_at = now_iso` to `spec.json` (for wallclock cap in PHASE 4).

### PHASE 4: Optimize Loop

> **Todo**: mark PHASE 3 → `completed`, PHASE 4 → `in_progress`.

Identical loop mechanics as `dev-optimize` PHASE 4 (select parents → spawn subagents in worktrees → collect → stall check → continue prompt).

**Difference — subagent brief:**

Read `references/subagent-brief.md` template (game version). Extra context:

- Godot binary path (from `GODOT_BIN`)
- GUT tests must stay green (gate)
- GDScript-specific pitfalls (see `references/gdscript-pitfalls.md`)

**Brief extra clause:**

```
Work in worktree {EXP_PATH}.
GDScript-only changes unless scope also includes scenes/.
Performance hypotheses (FPS/frame-time):
  - Object pooling
  - Signal-vs-poll patterns
  - PackedArray instead of Array
  - Add static typing
  - LOD via visibility/process_mode
  - Batch draw calls
AI hypotheses (winrate):
  - Heuristic weight tuning
  - Decision tree pruning
  - Lookahead depth
Run benchmark per iteration:
  $GODOT_BIN --headless --path . {benchmark.tscn} --quit-after 120
Parse SCORE= line.
```

**Worktree-naming:** `optimize/{run-id}/exp_{short-id}` (identical to dev-optimize).

**Result aggregation:** identical to dev-optimize.

### PHASE 5: Pick Winner

> **Todo**: mark PHASE 4 → `completed`, PHASE 5 → `in_progress`.

Identical to `dev-optimize` PHASE 5: show top-3, AskUserQuestion, keep branch, clean up losers.

### PHASE 6: Sync + Report

> **Todo**: mark PHASE 5 → `completed`, PHASE 6 → `in_progress`.

Append to `.project/project.json → optimization_runs[]` (schema in [shared/DASHBOARD.md](../shared/DASHBOARD.md) section `optimization_runs`):

```json
{
  "run_id": "{run-id}",
  "skill": "game-optimize",
  "metric": "{metric}",
  "direction": "{direction}",
  "baseline": {baseline},
  "final": {best_score},
  "improvement_pct": {pct},
  "rounds": {N},
  "experiments_kept": {total_kept},
  "experiments_discarded": {total_discarded},
  "winner_branch": "optimize/{run-id}/winner",
  "stopped_reason": "{reason}",
  "date": "{ISO}"
}
```

`stopped_reason` values: `stall` | `wallclock` | `user` | `no_improvement`. Append-only — dedup on `run_id`.

Clean up session files (`pre-skill-sha.txt`, `active-optimize-{run-id}.json`).

**Display report:**

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
GAME-OPTIMIZE COMPLETE: {run-id}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Metric:        {metric} ({direction})
Baseline:      {baseline}
Final:         {best_score}
Improvement:   {improvement_pct}%
Rounds:        {N}
Experiments:   {kept} kept / {discarded} discarded
Winner:        {winner_branch}

TOP 3 HYPOTHESES (kept):
  1. "..." (Δ {x})
  2. "..." (Δ {y})
  3. "..." (Δ {z})

Next steps:
  1. git checkout {winner_branch} → inspect changes in Godot editor
  2. Open project in editor to validate visually (no visual regression)
  3. /core-commit → on approval merge branch via PR
  4. /game-optimize → another run with a different metric
```

> **Todo**: Apply the Next-Step Clipboard Offer (binary Ja/Nee) —
> read '.claude/skills/shared/NEXT-STEP-OFFER.md'.
> Recommended command: /game-ship {feature} → re-verify after optimizations.

> **Todo**: mark PHASE 6 → `completed`.

## Edge Cases

- **No GUT installed**: gate is no-op. Subagents can introduce broken logic without detection. Strictly limit scope or skip game-optimize until GUT is set up.
- **Headless rendering does not work** (some hosts): add `--audio-driver Dummy --rendering-driver opengl3`. For vello-based shaders: use `forward_plus` with lower resolution.
- **Benchmark timeout**: Godot sometimes hangs. Skill wraps command in `timeout 180s`.
- **Worktree + Godot import cache**: each worktree gets its own `.godot/` cache. First run of a worktree is slower (import). Acceptable: amortizes over budget iterations.
- **AI winrate determinism**: ensure the seed in the benchmark is fixed, otherwise score noise is too large for meaningful comparison. Subagent brief must emphasize this.
- **Cross-platform path issues**: `res://` paths work cross-platform, OS paths in shell scripts must go through `paths.yaml` or env var.

## Rationale

Same as `dev-optimize`: no external `evo-hq-cli` dep, full control, seamless integration with `.project/` and GUT. Domain differences (Godot CLI instead of npm, scenes instead of bundle, GUT instead of vitest) are only in benchmark/gate templates and subagent brief — the loop mechanics are identical.

Why standalone? Game optimization is measurement-driven, not feature-build. Works on existing scenes/scripts, not on a feature in DOING status.
