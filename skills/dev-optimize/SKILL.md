---
name: dev-optimize
description: Optimize a measurable metric via parallel worktree experiments. Use with /dev-optimize.
metadata:
  author: claude-config
  version: 0.1.0
  category: dev
---

# Optimize

Autonomous improvement loop: define metric → spawn parallel subagents in worktrees → keep improvements, discard regressions → loop until stall.

**Trigger**: `/dev-optimize` or `/dev-optimize [auto]`

Inspired by the `evo-hq/evo` autoresearch pattern, integrated with the `.project/` convention. No external dependency.

## Input

No required input. All config is collected interactively in PHASE 1 or carried over from a previous run (resume).

## Output

```
.project/optimize/{run-id}/
├── spec.json          # metric, gate, scope, baseline, parameters
├── tree.json          # nodes (id, parent, branch, score, status, hypotheses)
├── runs/{NNNN}.json   # per-round result
└── branches.txt       # cleanup list for abort
```

Update on completion: `.project/project.json` → push to `optimization_runs[]` (see `shared/DASHBOARD.md`).

## Process

**Phase tracking** — first action of the skill: call `TaskCreate` with these 7 items (status `pending`), then use `TaskUpdate` to set each phase `in_progress` at the start and `completed` at the end. During context compaction the task list remains visible — no risk of forgotten phases.

1. PHASE 0: Pre-flight
2. PHASE 1: Define Metric
3. PHASE 2: Instrument Benchmark
4. PHASE 3: Baseline Run
5. PHASE 4: Optimize Loop
6. PHASE 5: Pick Winner
7. PHASE 6: Sync + Report

### PHASE 0: Pre-flight

> **Todo**: call `TaskCreate` with the 7 phase items (see above). Mark PHASE 0 → `in_progress` via `TaskUpdate`.

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

Prevents full repo-checkouts (worktrees) or local session-state from accidentally ending up in a commit.

**Git safety:**

1. `git status --porcelain` — must be empty. If dirty:
   - **AskUserQuestion** (Auto-mode: stash):
     - "Stash changes (Recommended)" — `git stash push -u -m "dev-optimize pre-run"`
     - "Abort" — exit, user commits first
2. Detect default branch:
   ```bash
   DEFAULT_BRANCH=$(git symbolic-ref refs/remotes/origin/HEAD 2>/dev/null | sed 's@^refs/remotes/origin/@@' || echo "main")
   ```
3. Store `BASE_SHA=$(git rev-parse HEAD)` — all worktrees fork from here (or from a parent-node further in the loop).

**Detect tools:**

```bash
node --version 2>/dev/null
npm --version 2>/dev/null
git worktree list --porcelain 2>/dev/null
```

No node/npm → exit with "dev-optimize requires Node + npm in PATH."

**Resume detection:**

Scan `.project/optimize/` for existing run-dirs without `runs/final.json`:

- No open run → new run, generate `RUN_ID=$(date +%Y%m%d-%H%M%S)`.
- ≥1 open run → **AskUserQuestion** (Auto-mode: new run):
  - "Resume {oldest-open-run-id}" — load `spec.json` + `tree.json`, go to PHASE 4
  - "Start new run (Recommended)" — archive old (rename → `{run-id}.aborted/`), create new
  - "View first" — show `git worktree list` + summary per open run, ask again

**Auto-mode** (active with argument `auto`):

| Decision point       | Default                      | Reason                                   |
| -------------------- | ---------------------------- | ---------------------------------------- |
| Dirty working tree   | **Stash**                    | Don't lose the user's changes            |
| Open run detected    | **New run**                  | Previous may have crashed halfway        |
| Metric choice        | **Bundle size** (default)    | Most universal measurement               |
| Subagents per round  | **3**                        | Conservative, prevents resource overload |
| Budget per subagent  | **5 iterations**             | Same as evo default                      |
| Stall threshold      | **5 rounds**                 | Same as evo default                      |
| Continue/Stop prompt | **Continue until stall**     | No user present                          |
| Winner-merge         | **Top branch automatically** | On new branch, not on base               |

Write at start: `.project/session/active-optimize-{run-id}.json`:

```json
{
  "run_id": "{run-id}",
  "skill": "optimize",
  "startedAt": "{ISO}"
}
```

**Project context** (skip if not exists):

Read `.project/project.json` for stack info and previous `optimization_runs[]` (show last 3 as context).

### PHASE 1: Define Metric

> **Todo**: mark PHASE 0 → `completed`, PHASE 1 → `in_progress`.

On resume: skip this phase, `spec.json` is already populated.

**AskUserQuestion 1 — what to optimize?** (Auto-mode: bundle size)

```yaml
header: "Metric"
question: "What do you want to optimize?"
options:
  - label: "Bundle size (Recommended)"
    description: "kB of production build (npm run build → dist/)"
  - label: "Lighthouse score"
    description: "Performance/A11y/Best-Practices/SEO via Lighthouse CLI"
  - label: "Test coverage"
    description: "% covered lines/branches via vitest --coverage or jest --coverage"
  - label: "API latency"
    description: "p95 ms via ab/wrk against local server"
multiSelect: false
```

(Custom option via "Other" → follow-up question: benchmark command + score-extraction regex.)

**AskUserQuestion 2 — direction** (Auto-mode: minimize for size/latency, maximize for coverage/lighthouse):

```yaml
header: "Direction"
question: "Lower or higher is better?"
options:
  - label: "Lower is better (minimize)"
  - label: "Higher is better (maximize)"
multiSelect: false
```

**AskUserQuestion 3 — scope** (Auto-mode: entire `src/`):

```yaml
header: "Scope"
question: "Which directories may subagents modify?"
options:
  - label: "src/ (Recommended)"
  - label: "src/ + package.json"
    description: "Allow dependency swaps (caution: can break tests)"
  - label: "Entire project (incl. config)"
  - label: "Custom paths"
multiSelect: false
```

**AskUserQuestion 4 — loop parameters** (Auto-mode: defaults). The choice also determines which subagent model is used:

```yaml
header: "Parameters"
question: "How aggressively may the loop run?"
options:
  - label: "Conservative: 3 agents × 5 iter, stall 5, 60min cap, sonnet (Recommended)"
    description: "Cheap and fast. Suitable for most use cases."
  - label: "Standard: 5 agents × 5 iter, stall 5, 90min cap, sonnet"
  - label: "Aggressive: 8 agents × 8 iter, stall 8, 180min cap, opus"
    description: "Much more compute and more expensive model — only for long, difficult problems."
multiSelect: false
```

Mapping:

| Choice       | subagents | budget | stall | wallclock | model    |
| ------------ | --------- | ------ | ----- | --------- | -------- |
| Conservative | 3         | 5      | 5     | 60 min    | `sonnet` |
| Standard     | 5         | 5      | 5     | 90 min    | `sonnet` |
| Aggressive   | 8         | 8      | 8     | 180 min   | `opus`   |

**Write `.project/optimize/{run-id}/spec.json`:**

```json
{
  "run_id": "{run-id}",
  "metric": "bundle_size_kb",
  "direction": "minimize",
  "scope_paths": ["src/"],
  "subagents_per_round": 3,
  "budget_per_subagent": 5,
  "stall_threshold": 5,
  "max_wallclock_minutes": 60,
  "subagent_model": "sonnet",
  "run_started_at": null,
  "benchmark_cmd": "bash .project/optimize/{run-id}/benchmark.sh",
  "gate_cmd": "bash .project/optimize/{run-id}/gate.sh",
  "baseline": null,
  "base_sha": "{BASE_SHA}",
  "default_branch": "{DEFAULT_BRANCH}"
}
```

### PHASE 2: Instrument Benchmark

> **Todo**: mark PHASE 1 → `completed`, PHASE 2 → `in_progress`.

**Step 1 — copy template:**

Copy benchmark template to `.project/optimize/{run-id}/benchmark.sh`. Templates per metric:

| Metric      | Template path                             |
| ----------- | ----------------------------------------- |
| bundle_size | `references/benchmarks/bundle-size.sh`    |
| lighthouse  | `references/benchmarks/lighthouse.sh`     |
| coverage    | `references/benchmarks/coverage.sh`       |
| latency     | `references/benchmarks/latency.sh`        |
| custom      | minimal stub that prints `echo SCORE=<n>` |

Templates print one line `SCORE=<float>` on stdout. Skill parses last `SCORE=` line.

**Step 2 — gate script:**

Default `references/gates/tests-green.sh` → copy to `.project/optimize/{run-id}/gate.sh`. Detect test command via `package.json scripts.test`. No `test` script → show warning and use `:` (no-op gate).

**Step 3 — review + edit:**

Show both scripts, ask via **AskUserQuestion** (Auto-mode: Run as-is):

```yaml
header: "Scripts"
question: "Are benchmark.sh and gate.sh correct?"
options:
  - label: "Run as-is (Recommended)"
  - label: "Edit first"
    description: "Open in editor, then continue"
  - label: "Abort"
multiSelect: false
```

"Edit first" → show paths, wait for user to return, then re-prompt.

`chmod +x` on both scripts.

### PHASE 3: Baseline Run

> **Todo**: mark PHASE 2 → `completed`, PHASE 3 → `in_progress`.

```bash
cd "$(git rev-parse --show-toplevel)"

# Gate first (fails → abort, repo is not healthy)
if ! bash .project/optimize/{run-id}/gate.sh; then
  echo "BASELINE GATE FAIL: fix tests first"
  exit 1
fi

# Benchmark
BASELINE=$(bash .project/optimize/{run-id}/benchmark.sh | grep -E '^SCORE=' | tail -1 | cut -d= -f2)
```

Write `runs/0000.json`:

```json
{
  "round": 0,
  "type": "baseline",
  "score": 1234.5,
  "branch": "{DEFAULT_BRANCH}",
  "sha": "{BASE_SHA}",
  "timestamp": "{ISO}"
}
```

Update `spec.json.baseline = <score>`.

Initialize `tree.json`:

```json
{
  "nodes": [
    {
      "id": "root",
      "parent": null,
      "branch": "{DEFAULT_BRANCH}",
      "sha": "{BASE_SHA}",
      "score": 1234.5,
      "status": "baseline",
      "hypotheses_tried": []
    }
  ],
  "rounds": []
}
```

**Display + cost estimate** (after baseline, before the loop starts):

Calculate based on the actually measured baseline time:

```
BENCHMARK_SECONDS = actual duration of baseline benchmark.sh
GATE_SECONDS      = actual duration of baseline gate.sh
PER_ITER_SECONDS  = BENCHMARK_SECONDS + GATE_SECONDS + 10  # 10s overhead for edit
TOTAL_ITERS       = subagents_per_round × budget_per_subagent × stall_threshold  # worst-case
TOTAL_MINUTES     = (TOTAL_ITERS × PER_ITER_SECONDS) / 60

# Token cost rough estimate (Claude pricing April 2026):
# sonnet: ~$0.15 per iteration (50k input + 5k output)
# opus:   ~$0.75 per iteration
TOKEN_COST_PER_ITER  = 0.15 if spec.subagent_model == "sonnet" else 0.75
TOTAL_DOLLARS        = TOTAL_ITERS × TOKEN_COST_PER_ITER
```

Display:

```
BASELINE: {metric} = {score} ({direction})
Repo healthy, gate green.

COST ESTIMATE (worst-case):
- {subagents} agents × {budget} iter × {stall} rounds = {TOTAL_ITERS} agent-iterations
- ~{PER_ITER_SECONDS}s per iteration ({BENCHMARK_SECONDS}s benchmark + {GATE_SECONDS}s gate)
- Estimated time: ~{TOTAL_MINUTES} min (capped at {max_wallclock_minutes} min)
- Estimated cost: ~${TOTAL_DOLLARS} ({subagent_model})
```

**AskUserQuestion** (Auto-mode: if `TOTAL_DOLLARS > 10` OR `TOTAL_MINUTES > 120` → abort, otherwise continue):

```yaml
header: "Continue?"
question: "Does this estimate look right? Continue with the loop?"
options:
  - label: "Continue (Recommended)"
  - label: "Lower budget"
    description: "Back to PHASE 1 for lower subagents/budget/stall"
  - label: "Abort"
multiSelect: false
```

"Lower budget" → PHASE 1 AskUserQuestion 4 again, recompute spec.json + estimate, back to PHASE 3 display.

**Mark run-start**:

```bash
# Write timestamp for wallclock-cap
NOW_ISO=$(date -u +%Y-%m-%dT%H:%M:%SZ)
# Update spec.json: run_started_at = NOW_ISO
```

### PHASE 4: Optimize Loop

> **Todo**: mark PHASE 3 → `completed`, PHASE 4 → `in_progress`.

Initialize `ROUND=1`, `STALL_COUNT=0`, `BEST_SCORE=baseline`.

**Per round:**

#### Step a — Select parents

Read `tree.json`. Filter nodes with `status in ["baseline", "kept"]`. Sort by score (direction). Goal: take K = `subagents_per_round` parents.

**Selection rule** (mechanical, no file-overlap calculation):

```
candidates = nodes with status in ["baseline", "kept"], sorted by score
parent_ids_in_last_2_rounds = set of node-ids that were parent in runs[N-1] or runs[N-2]

parents = []
for c in candidates:
  if len(parents) >= K: break
  if c.id in parent_ids_in_last_2_rounds: continue   # enforce diversity
  parents.append(c)

# Fallback: if <K candidates satisfy the filter (early rounds or small tree),
# fill up with the best-scoring available candidates without filter
while len(parents) < K and remaining_candidates:
  parents.append(next_best_candidate)
```

Result: the same node cannot be parent 2× in a row — the tree stays broad instead of converging to one path. No string- or file-overlap analysis needed.

**Wallclock cap check** (see Fix 1 in v0.1.1): calculate `elapsed_minutes = (now - run_started_at) / 60`. If `elapsed_minutes >= max_wallclock_minutes` → break to PHASE 5 with `stopped_reason = "wallclock"`.

#### Step b — Spawn subagents (parallel)

For each parent: build brief and spawn agent.

**Build brief** (per subagent):

Read `references/subagent-brief.md` template. Fill placeholders:

- `{run_id}`, `{metric}`, `{direction}`, `{scope_paths}`
- `{parent_sha}`, `{parent_score}`
- `{budget}` = `budget_per_subagent`
- `{benchmark_cmd}`, `{gate_cmd}`
- `{failed_hypotheses}` = union of all `hypotheses_tried[]` from tree, dedup on string-equality (case-insensitive, trim whitespace). No cap — pass everything. One hypothesis per line in the brief.
- `{best_score_so_far}` for context
- `{branch_name}` = `optimize/{run-id}/exp_{short-id}` where short-id = `printf "r%02d_p%02d_$(openssl rand -hex 2)" $ROUND $PARENT_IDX`

**Create worktree** (orchestrator-side, not in agent):

```bash
EXP_BRANCH="optimize/{run-id}/exp_{short-id}"
EXP_PATH=".project/optimize/{run-id}/worktrees/exp_{short-id}"
git worktree add -b "$EXP_BRANCH" "$EXP_PATH" "$PARENT_SHA"
echo "$EXP_BRANCH" >> .project/optimize/{run-id}/branches.txt
```

**Spawn Agent** with `subagent_type: general-purpose`, `run_in_background: true`, `model: <spec.subagent_model>` (default `sonnet`, `opus` only for Aggressive), prompt = brief + extra:

```
Work exclusively within worktree: {EXP_PATH}
Branch: {EXP_BRANCH}
Cd there first. Only commit your own changes on this branch.

Max iterations: {budget}.

Per iteration:
1. Come up with a hypothesis that can improve {metric} within scope: {scope_paths}.
   Not from this list (already tried or failed): {failed_hypotheses}
2. Modify code.
3. Run: {gate_cmd}. Fails? Revert your changes, try something else.
4. Run: {benchmark_cmd}. Parse SCORE=.
5. Score improved compared to {parent_score} ({direction})?
   Yes → git commit -am "exp: <hypothesis>". May do more iterations on this branch.
   No → revert, next iteration. Don't count as commit.

Stop when: budget exhausted, or 3 iterations in a row with no improvement, or out of ideas.

Return as line-based key=value between markers (see subagent-brief.md for full format):
EXPERIMENT_RESULT_START
RESULT_BRANCH={EXP_BRANCH}
RESULT_BEST_SCORE=<float or empty>
RESULT_BEST_SHA=<sha or empty>
RESULT_ITERATIONS_USED=<int>
RESULT_WINNING_HYPOTHESIS=<one-liner or empty>
RESULT_NOTES=<max 200 chars>
RESULT_TRIED_1=<hypothesis>
RESULT_TRIED_2=<hypothesis>
EXPERIMENT_RESULT_END
```

**Spawn all K agents in one message** (run_in_background: true) so they run in parallel.

#### Step c — Collect results

Per agent: parse `EXPERIMENT_RESULT_*` block. Robust line-parser:

```bash
# Extract block between markers, then grep per key
BLOCK=$(echo "$AGENT_OUTPUT" | sed -n '/EXPERIMENT_RESULT_START/,/EXPERIMENT_RESULT_END/p')
BRANCH=$(echo "$BLOCK" | grep -E '^RESULT_BRANCH=' | head -1 | cut -d= -f2-)
BEST_SCORE=$(echo "$BLOCK" | grep -E '^RESULT_BEST_SCORE=' | head -1 | cut -d= -f2-)
BEST_SHA=$(echo "$BLOCK" | grep -E '^RESULT_BEST_SHA=' | head -1 | cut -d= -f2-)
WINNING=$(echo "$BLOCK" | grep -E '^RESULT_WINNING_HYPOTHESIS=' | head -1 | cut -d= -f2-)
# Hypotheses list: all RESULT_TRIED_N lines, in order
TRIED=$(echo "$BLOCK" | grep -E '^RESULT_TRIED_[0-9]+=' | cut -d= -f2-)
```

Empty `RESULT_BEST_SCORE` or missing marker block → treat as `discarded`, log `notes: "agent returned no result"`.

For each result:

**Improvement relative to parent:**

```
improved = (direction == "minimize" && best_score < parent_score) ||
           (direction == "maximize" && best_score > parent_score)
```

**Improved:**

- Status `kept`. Append node to `tree.json`:
  ```json
  {
    "id": "exp_{short-id}",
    "parent": "{parent-id}",
    "branch": "{EXP_BRANCH}",
    "sha": "{best_sha}",
    "score": {best_score},
    "status": "kept",
    "hypotheses_tried": [...]
  }
  ```
- Keep worktree (possibly parent in next round).

**Not improved or gate failed:**

- Status `discarded`. Append node with `status: "discarded"`.
- Clean up worktree:
  ```bash
  git worktree remove --force "$EXP_PATH"
  git branch -D "$EXP_BRANCH" 2>/dev/null
  ```

**Append `hypotheses_tried` from ALL agents** (winners + losers) to global list — prevents repetition in next rounds.

**Write `runs/{NNNN}.json`** (NNNN = round, zero-padded):

```json
{
  "round": 1,
  "parents": ["root"],
  "experiments": [
    { "id": "exp_r01_p00_abcd", "score": 230.1, "status": "kept", "hypothesis": "..." },
    ...
  ],
  "best_score_after": 230.1,
  "stall_count": 0,
  "timestamp": "{ISO}"
}
```

#### Step d — Stall check

```
NEW_BEST = best score across all "kept" nodes in tree
if NEW_BEST improved compared to BEST_SCORE_PRE_ROUND:
  BEST_SCORE = NEW_BEST
  STALL_COUNT = 0
else:
  STALL_COUNT += 1
  if STALL_COUNT >= stall_threshold:
    break # to PHASE 5
```

#### Step e — Continue prompt

After each round, **AskUserQuestion** (Auto-mode: skip = continue):

```yaml
header: "Next round?"
question: "Round {N} done. Best score: {best}. Continue?"
options:
  - label: "Continue (Recommended)"
  - label: "Stop now, pick winner"
  - label: "Adjust budget"
    description: "Increase/decrease agents or iterations"
multiSelect: false
```

"Adjust budget" → follow-up questions, update spec.json, continue.

`ROUND++`, go to Step a.

### PHASE 5: Pick Winner

> **Todo**: mark PHASE 4 → `completed`, PHASE 5 → `in_progress`.

Read `tree.json`, sort all `kept` nodes by score (direction). Show top-3:

```
TOP BRANCHES:
  1. exp_r03_p01_a1b2 — score {x} (Δ {improvement}, {commits} commits, {files} files)
     Hypothesis: "..."
  2. ...
  3. ...
```

**AskUserQuestion** (Auto-mode: top branch):

```yaml
header: "Winner"
question: "Which branch do you want to keep?"
options:
  - label: "Top branch (Recommended)"
  - label: "Second branch"
  - label: "Third branch"
  - label: "None — clean up losers, don't merge anything"
multiSelect: false
```

**For the chosen winner:**

```bash
WINNER_BRANCH="optimize/{run-id}/exp_{id}"
TARGET_BRANCH="optimize/{run-id}/winner"
git branch "$TARGET_BRANCH" "$WINNER_BRANCH"
```

Do NOT merge to default branch — user reviews themselves via PR/merge.

**Cleanup losers:**

```bash
while read -r BR; do
  if [ "$BR" != "$WINNER_BRANCH" ]; then
    WT_PATH=".project/optimize/{run-id}/worktrees/$(basename "$BR" | sed 's@.*/@@')"
    git worktree remove --force "$WT_PATH" 2>/dev/null
    git branch -D "$BR" 2>/dev/null
  fi
done < .project/optimize/{run-id}/branches.txt
```

Keep the winner-worktree so user can inspect directly.

### PHASE 6: Sync + Report

> **Todo**: mark PHASE 5 → `completed`, PHASE 6 → `in_progress`.

**Append to `.project/project.json`** under `optimization_runs[]` (schema in [shared/DASHBOARD.md](../shared/DASHBOARD.md) section `optimization_runs`):

```json
{
  "run_id": "{run-id}",
  "skill": "dev-optimize",
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

`stopped_reason` values: `stall` | `wallclock` | `user` | `no_improvement`.

If `optimization_runs[]` field does not yet exist: create with this as the only entry. Append-only — dedup on `run_id` so re-runs of the same skill don't produce duplicates.

**Write `runs/final.json`** (signals: this run is done):

```json
{
  "run_id": "{run-id}",
  "completed_at": "{ISO}",
  "winner_branch": "...",
  "stats": { ... }
}
```

**Cleanup session:**

```bash
rm -f .project/session/active-optimize-{run-id}.json
rm -f .project/session/pre-skill-sha.txt
```

If work was stashed: show stash list → user chooses pop.

**Display report (ASCII table):**

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
DEV-OPTIMIZE COMPLETE: {run-id}
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
  1. git checkout {winner_branch} → inspect changes
  2. git diff {default_branch}..{winner_branch}
  3. /core-commit → merge branch via PR when approved
  4. /dev-optimize → another run with different metric
```

> **Todo**: mark PHASE 6 → `completed`. All 7 phases must now be `completed`.

## Edge Cases

- **No test suite (no `npm test`)**: gate is no-op. Warn that subagents can break tests without detection. Use strict scope to limit risk.
- **Worktree disk-full**: detect ENOSPC at `git worktree add` → abort, clean up losers, lower `subagents_per_round`.
- **Subagent timeout / crash**: treat as `discarded`, log `notes: "agent timeout"`.
- **Cyclic improvement** (score oscillates): the diversity filter in Step a prevents trying the same edits repeatedly via different parents.
- **Pre-existing failing tests**: gate fails on baseline → abort before the loop. User must fix tests first.
- **Auto-mode without user available**: all prompts use defaults, run operates autonomously until stall.

## Rationale

Why no external `evo-hq-cli` dep? Per plan: full control, no Python tool-install required, seamless integration with `.project/` and existing pipeline conventions. The trade-off: tree search v1 = greedy with diversity (no full backtrack-search). Sufficient for all intended use cases (bundle/coverage/latency).

Why standalone (not in pipeline)? Optimize is not a feature-build but a metric-driven improvement cycle. Works on existing code, not on a feature in DOING-status.
