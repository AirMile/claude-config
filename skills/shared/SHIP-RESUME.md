# Ship resume & orphan cleanup (shared)

Resume detection and the resume/restart flows for the auto-mode ship pipelines (`dev-ship`,
`design-ship`, `game-ship`). Split out from `SHIP-CHECKPOINT.md` so the **resume path stays cheap**:
a fresh session re-invoking `/{pipeline}-ship {name}` to continue a parked run reads only this file
(+ the pipeline's interactive-phase file), never the full checkpoint spec or the fresh-run PHASE 0
machinery. The checkpoint **schema**, the **write points**, fresh-run **preflight**, and **rollback**
stay in `SHIP-CHECKPOINT.md` — read those only when writing the checkpoint or starting fresh.

The checkpoint file is `.project/session/ship-{name}.json` (schema in `SHIP-CHECKPOINT.md`).

---

## Resume detection (run at the start of PHASE 0, before resolving the feature)

Resolve the main checkout root first — a resumed session's cwd is commonly already inside a
feature worktree (the normal PHASE 3/4 resume case), where `.project/session/` is **not**
symlinked (`shared/WORKTREE.md § What to share`), so a plain relative path silently misses an
existing checkpoint:

```bash
main_root=$(git worktree list --porcelain | head -1 | sed 's/^worktree //')
test -f "$main_root/.project/session/ship-{name}.json" && echo EXISTS
```

If a checkpoint exists with `status != "complete"`, an earlier run was interrupted. **First check
`pipeline`** — if it names another pipeline, do not resume here: stop and point the user to the
matching skill (`pipeline: "dev"` → `/dev-ship {name}`, `pipeline: "design"` → `/design-ship
{name}`, `pipeline: "game"` → `/game-ship {name}`).

### Direct resume (fast path)

When **all four** hold, skip the Resume/Restart/Inspect question entirely and resume in place — the
common case (a fresh chat re-invoking to continue exactly where the last one stopped):

1. the skill was invoked with an **explicit** feature/target arg (not a bare `/{pipeline}-ship`),
2. the checkpoint's `pipeline` matches this skill,
3. `status == "running"` (not `"failed"`),
4. `updatedAt` is **≤ 24h** old.

Print a one-line notice (`Resuming {name} at {phase} — checkpoint {age} old`) and execute the
**§On "Resume"** steps below directly. The fast path applies to **any** recorded `phase`: workflow
phases relaunch per On-Resume step 4's existing bullets; an interactive phase re-enters per its
bullet there; `"PHASE 0 · define"` (dev/game) re-runs define from the top (the draft was in plan
mode, not checkpointed).

Fall through to the `AskUserQuestion` below **only** when a fast-path condition fails: no explicit
arg, `status: "failed"`, or `updatedAt` > 24h (staleness). Otherwise, do **not** silently continue
and do **not** blindly restart — ask:

- Compute staleness: if `updatedAt` is **older than 24h**, prefix the resume option with a
  staleness notice (the worktree/`.project` may have drifted).
- Present via `AskUserQuestion` (single-select; first option recommended):

```yaml
header: "Ship resume"
question: "An interrupted ship run for {name} was found (stopped at {phase}). Resume it?"
options:
  - label: "Resume from {phase} (Recommended)"
    description:
      "Reload the PHASE 0 selections + completed-phase results from disk and continue.
      Nothing already done is rebuilt. {staleness notice if >24h}"
  - label: "Restart fresh"
    description: "Archive this checkpoint, clean the old worktree, and run the pipeline from PHASE 0."
  - label: "Inspect first"
    description: "Print the checkpoint + worktree git status, then ask again."
```

### On "Resume"

**Git-operation check first (before step 1).** Run
`ls .git/rebase-merge .git/rebase-apply .git/MERGE_HEAD .git/CHERRY_PICK_HEAD 2>/dev/null` in the
main repo root, and — when the checkpoint records a worktree (`results.build.worktreePath`) — inside
that worktree too. Non-empty means a merge/rebase/cherry-pick is mid-flight (possibly being resolved
in another session) → **stop before touching anything**: report the in-progress operation with the
resolve/abort instructions from `SHIP-CHECKPOINT.md § Preflight` (first bullet) and end the turn.
The checkpoint stays parked; the same resume command works after resolution.

1. Run **orphan/leak cleanup** (below) to reconcile stray worktrees/processes/signals.
2. Load `plan` + `results` from the checkpoint into memory (these replace the in-context
   `SHIP_PLAN` / results; the worktree path + branch live in `results.build`). **Re-derive
   `SHIP_CONTEXT`** fresh from disk — it is not stored: Read `shared/PROJECT-CONTEXT-LOAD.md`
   (build profile) + `shared/LEARNINGS-LOAD.md` (scoped), the same context-load the pipeline's
   PHASE 0 runs. (Only needed before a workflow phase that spawns agents; the interactive PHASE 3
   manual round needs no agent slice, and PHASE 4 rebuilds its refactor-slice from disk itself.)
3. Re-seed the skill's `TaskCreate` phase list with every phase in `completedPhases` marked
   `completed` and the rest `pending`; set the checkpoint's `phase` to `in_progress`.
4. Jump to the recorded `phase`. When relaunching a workflow, `args.resume` carries **only the
   green/completed results** from the checkpoint (`status: "green"`; refactor: `applied`/`clean`) —
   the scripts also enforce this, so a resumed failed result re-runs its agent instead of replaying
   the failure:
   - **dev/game, agent phases** (PHASE 1/2/4, and PHASE 3 when no open manual/playtest work
     remains) → run `node ~/.claude/scripts/ship-checkpoint.js route {name}` and follow the returned
     `route` per the pipeline's `references/orchestration.md § 2`. The main chat performs all
     relaunch mechanics itself: the stored `prompts` **paths** (reassembling from `plan` + disk only
     if a file is missing), `args.resume` = the `route` command's returned `resume` object, and —
     same-session only — `TaskStop` + `resumeFromRunId: "{workflowRunId}"` when `activeWorkflow` was
     still set. This also covers **PHASE 4 with `results.refactor` already present**
     (`route` → `"phase4-finalize-only"`) — skip the workflow relaunch and resume at the finalize
     step (the refactor ran; only merge/cleanup remains).
   - **design** (has no `route` subcommand — these bullets are design-only):
     - **If `activeWorkflow` + `workflowRunId` are set** (a workflow was in flight) and this is the
       **same session** → stop the in-flight run first (`TaskStop` — `resumeFromRunId` requires the
       prior run stopped), then relaunch with `resumeFromRunId: "{workflowRunId}"` and the same
       `args` (add `args.resume` too, as a cross-session fallback). Cached agent calls return
       instantly.
     - **Otherwise (cross-session / no runId)** → relaunch the phase's workflow with the stored
       `prompts` **paths** as the prompt-path args. The pointer + slice files persist on disk, so this
       needs no reassembly; only if a file is missing (e.g. `.project/session/` was cleaned) rewrite
       it from `plan` + disk per the phase's `agent-*.md` § Spawn. Add `args.resume` as above. The
       workflow short-circuits the already-completed agents
       (`const build = resumedBuild ?? await agent(...)`) and only runs what remains. The worktree +
       `.project/` on disk supply the rest.
   - **If the recorded phase is an interactive main-chat phase** (dev/game PHASE 3 manual
     tests/playtest, design PHASE 4 review) → **first physically re-enter the run**, then restart the
     walkthrough from the stored `results`. For dev/game this is not only crash recovery — it is the
     **normal** route into PHASE 3 when manual items remain, because the green branch deliberately
     hands off here (parks the run, ends the turn) so this phase runs on a fresh session. The re-entry steps live in the pipeline's own
     interactive-phase file, not here (this spec stays pipeline-generic): dev/game run that file's
     worktree-entry step (via `shared/WORKTREE.md`) + app/game-launch step before presenting the
     checklist (dev: `phase-3-manual-finalize.md § Resume entry`; game: `phase-3-playtest.md §
Resume entry`); design re-enters its PHASE 4 review. Then the walkthrough replays from
     `results.verify.remainingManualItems` (dev/game) / the stored check results (design) — for
     dev/game, filtered against the checkpoint's `manual`/`playtest` items verdicts respectively
     (already-verdicted items are not re-asked), and a stored `fixPlan` /
     `activeWorkflow: "phase3fix"` resumes at the fix-round gate/dispatch instead of the walkthrough
     (routing detail: each pipeline's own `§ Resume entry` — `phase-3-manual-finalize.md` /
     `phase-3-playtest.md`). (dev/game PHASE 4 relaunch, including the `results.refactor`-already-present
     finalize-only case, is handled by the dev/game bullet above via the `route` subcommand.)
   - **If the recorded phase is `"PHASE 0 · define"`** (dev/game minimal checkpoint) → **re-run define
     from the top** (the pipeline's `phase-0-*.md` from Step 1). The feature draft was authored inside
     plan mode, which blocks the `.project/` write that would checkpoint it, and the plan file's
     harness-generated name is not linked to the feature — so the draft is **not** recoverable
     cross-session and the interview re-runs. (A **same-session** interruption keeps the draft: plan
     mode + the plan file persist in the session, so just continue there instead of resuming.) The
     minimal checkpoint's `baselineSha` + bookkeeping are reused; `feature.json` does not exist yet, so
     there is nothing to reconstruct from disk.

### On "Restart fresh"

Archive the old checkpoint (`mv "$main_root/.project/session/ship-{name}.json" "$main_root/.project/archive/ship-{name}-{ISO}.json"`,
`mkdir -p "$main_root/.project/archive"` first — reuse `$main_root` from Resume detection above, or
re-resolve it if this is a fresh Bash call), run orphan/leak cleanup, then proceed with a normal
fresh PHASE 0 (read the pipeline's `phase-0-*.md` and run it from the top).

### On "Inspect first"

Print the checkpoint JSON and `git worktree list` + `git -C {results.build.worktreePath} status --short`
(if the worktree exists), then re-present the resume question.

---

## Orphan / leak cleanup (run on Resume and on Restart)

A backstop for state the normal exit paths would have cleaned but a hard crash bypassed. **Scope it
to truly orphaned state** — another ship run may be legitimately live in a parallel session, so
"not the run being resumed" is NOT sufficient reason to remove something. Treat state for a name
`{other}` as orphaned only when it has **no open checkpoint** (`ship-{other}.json` with
`status != "complete"`) **and** its live-signal (`active-{other}.json`) is absent or older than the
24h staleness window:

- **Orphan worktrees** — `git worktree prune`, then `git worktree list`; remove a leftover
  `worktree-{other}` (`git worktree remove --force <path>` + `git branch -D worktree-{other}`)
  only when orphaned per the rule above — never the worktree of the run being resumed, never one
  with an open checkpoint or a fresh live-signal.
- **Leaked dev servers** — the contract says the subagent kills its own PID file
  (`.project/session/*-devserver.pid`); as a backstop, for a PID file belonging to the resumed run
  or orphaned per the rule above: if the PID is still alive (`kill -0 <pid>`), kill it and remove
  the PID file. Leave PID files of live parallel runs alone.
- **Stale live-signals** — remove `active-{other}.json` files only when orphaned per the rule
  above. The resumed run's own `active-{name}.json` is rewritten by the next phase anyway.
