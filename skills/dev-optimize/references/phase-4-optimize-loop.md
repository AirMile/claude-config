# PHASE 4: Optimize Loop

Load this file when entering PHASE 4. Contains the full per-round loop: parent selection, subagent spawning, result collection, stall check, and continue prompt.

Initialize `ROUND=1`, `STALL_COUNT=0`, `BEST_SCORE=baseline`, `ORPHAN_LOG=()`.

---

## Per Round

### Step a — Select Parents

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

### Step b — Spawn Subagents (parallel)

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

### Step c — Collect Results

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
- Clean up worktree (batch-mode hardening — no interactive prompts):
  ```bash
  cd "$MAIN_ROOT" 2>/dev/null
  git worktree remove --force "$EXP_PATH"
  git branch -D "$EXP_BRANCH" 2>/dev/null
  if [ -d "$EXP_PATH" ]; then
    if [ -z "$(ls -A "$EXP_PATH" 2>/dev/null)" ]; then
      rmdir "$EXP_PATH" 2>/dev/null || ORPHAN_LOG+=("$EXP_PATH (rmdir failed)")
    else
      ORPHAN_LOG+=("$EXP_PATH (non-empty)")
    fi
  fi
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

### Step d — Stall Check

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

### Step e — Continue Prompt

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
