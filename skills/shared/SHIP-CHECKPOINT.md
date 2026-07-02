# Ship checkpoint & resume (shared)

Canonical checkpoint mechanism for the auto-mode ship pipelines (`dev-ship`, `design-ship`). It
makes any interruption — **credits exhausted, crash, killed process, or a mid-run stop** — a
resumable pause: the run's coarse state (`backlog.status`, worktree, `.project/`) already survives
on disk, and this checkpoint adds the **fine-grained run state** (which phase completed, the PHASE 0
selections, the structured agent results) that otherwise lives only in the main-chat context and is
lost on a full session end.

**Single writer.** Only the ship **orchestrator (main chat)** reads/writes the checkpoint — the
spawned subagents never touch it (non-interactive-contract rule 1: dev/design-ship owns phase
tracking). The pipeline is sequential, so there is one writer at a time — no write-races.

**Not `SHIP_CONTEXT`.** The checkpoint stores only the **irreproducible** state: the user's PHASE 0
choices (`plan`) and the agent results. `SHIP_CONTEXT` is deliberately **not** stored — it is cheap
to re-derive from disk (`PROJECT-CONTEXT-LOAD` + `LEARNINGS-LOAD`) on resume.

---

## File

`.project/session/ship-{name}.json` — one per active ship run (`{name}` = feature or target name,
same key as `active-{name}.json`). Parallel to the live-signal, but with a different lifecycle:
`active-{name}.json` is removed on **every** exit; the checkpoint is removed **only on
`status: "complete"`** — on failure/interruption it stays, so a re-invoke can resume.

### Schema

```json
{
  "schemaVersion": 1,
  "pipeline": "dev", // "dev" | "design"
  "feature": "auth-login",
  "startedAt": "<ISO>",
  "updatedAt": "<ISO>",
  "status": "running", // "running" | "failed" | "complete"
  "phase": "PHASE 2", // current phase pointer (label matches the skill's phase list)
  "completedPhases": ["PHASE 0", "PHASE 1"],
  "baselineSha": "<git rev-parse HEAD before ship>", // rollback anchor
  "plan": {
    /* dev: SHIP_PLAN (refactorLenses, refactorPolicy, securityLight, securityDeep,
                verificationProfile). design: the FULL PHASE 0 objects — direction (incl. its
                token decisions + chosen layout), archetype, brief, checkScope, composition
                (PAGE only), and the inline spec when captured (its disk write is deferred to
                the build sync, so until the build completes the checkpoint is its only durable
                home). Store the objects the agent prompts are assembled from — never
                display-abbreviated names. */
  },
  "results": {
    /* structured agent returns, filled per phase.
                  dev: { build, verify, refactor, triage }.
                  design: { build, content, check }.
                  The worktree path + branch live in results.build — no separate top-level copy. */
  },
  "prompts": {
    /* the assembled Workflow prompt args for the workflow in flight, written at launch
                  (write point 2) and cleared with activeWorkflow on return.
                  dev: { buildPrompt, verifyPromptTemplate } or
                       { refactorPrompt, scanners, triagePromptTemplate }.
                  design: { buildPrompt, contentPromptTemplate, checkPromptTemplate }.
                  Lets a resume relaunch with the exact original prompts instead of
                  reassembling them from plan + disk. */
  },
  "activeWorkflow": null, // "phase12" | "phase4" | "design123" | null
  "workflowRunId": null // "wf_..." from the Workflow tool result, for resumeFromRunId
}
```

---

## Atomic write

Never write the checkpoint in place — a crash mid-write would corrupt it. Write to a temp file and
`mv` (rename is atomic on POSIX):

```bash
mkdir -p .project/session
cat > .project/session/ship-{name}.json.tmp <<'JSON'
{ ...checkpoint object... }
JSON
mv -f .project/session/ship-{name}.json.tmp .project/session/ship-{name}.json
```

```powershell
# Windows (PowerShell)
New-Item -ItemType Directory -Force .project/session | Out-Null
Set-Content -Path .project/session/ship-{name}.json.tmp -Value $checkpointJson -Encoding utf8
Move-Item -Force .project/session/ship-{name}.json.tmp .project/session/ship-{name}.json
```

Always set `updatedAt` to the current ISO time on every write. Use this helper at each write point
below.

### When the orchestrator writes

1. **End of PHASE 0** — first write. Set `plan` (the PHASE 0 selections), `baselineSha`
   (`git rev-parse HEAD` captured before any ship work), `phase` = the first agent phase,
   `completedPhases: ["PHASE 0"]`, `status: "running"`.
2. **Immediately after launching a Workflow** — the tool result returns a `runId` even while the
   workflow runs in the background; store it as `workflowRunId`, set `activeWorkflow`, and store
   the assembled Workflow prompt args as `prompts`. This is what makes a mid-workflow crash
   resumable — with the exact original prompts.
3. **On each workflow/agent return** — merge the returned structured object(s) into `results`,
   advance `phase`, append the just-finished phase(s) to `completedPhases`, clear
   `activeWorkflow`/`workflowRunId`/`prompts`.
4. **On a failure-jump to the report phase** — set `status: "failed"` (keep everything else so the
   user can resume or inspect).
5. **On successful completion (report phase)** — set `status: "complete"`, then remove the file
   (`rm -f .project/session/ship-{name}.json`). Do **not** remove it on a failure exit.

Write the checkpoint at the **same boundaries** where the skill already rewrites
`active-{name}.json` — that rewrite is the natural hook.

---

## Resume detection (run at the start of PHASE 0, before resolving the feature)

```bash
test -f .project/session/ship-{name}.json && echo EXISTS
```

If a checkpoint exists with `status != "complete"`, an earlier run was interrupted. **First check
`pipeline`** — if it names the other pipeline, do not resume here: stop and point the user to the
matching skill (`pipeline: "dev"` → `/dev-ship {name}`, `pipeline: "design"` → `/design-ship
{name}`). Otherwise, do **not** silently continue and do **not** blindly restart — ask:

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

1. Run **orphan/leak cleanup** (below) to reconcile stray worktrees/processes/signals.
2. Load `plan` + `results` from the checkpoint into memory (these replace the in-context
   `SHIP_PLAN` / results; the worktree path + branch live in `results.build`). **Re-derive
   `SHIP_CONTEXT`** fresh from disk per the skill's PHASE 0 context-load step — it is not stored.
3. Re-seed the skill's `TaskCreate` phase list with every phase in `completedPhases` marked
   `completed` and the rest `pending`; set the checkpoint's `phase` to `in_progress`.
4. Jump to the recorded `phase`. When relaunching a workflow, `args.resume` carries **only the
   green/completed results** from the checkpoint (`status: "green"`; refactor: `applied`/`clean`) —
   the scripts also enforce this, so a resumed failed result re-runs its agent instead of replaying
   the failure:
   - **If `activeWorkflow` + `workflowRunId` are set** (a workflow was in flight) and this is the
     **same session** → stop the in-flight run first (`TaskStop` — `resumeFromRunId` requires the
     prior run stopped), then relaunch with `resumeFromRunId: "{workflowRunId}"` and the same
     `args` (add `args.resume` too, as a cross-session fallback). Cached agent calls return
     instantly.
   - **Otherwise (cross-session / no runId)** → relaunch the phase's workflow with the stored
     `prompts` as the prompt args (fall back to reassembling them from `plan` + disk only when
     `prompts` is absent) plus `args.resume` as above. The workflow short-circuits the
     already-completed agents (`const build = resumedBuild ?? await agent(...)`) and only runs what
     remains. The worktree + `.project/` on disk supply the rest.
   - **If the recorded phase is an interactive main-chat phase** (dev PHASE 3 finalize, design
     PHASE 4 review) → resume it directly from the stored `results` (e.g. dev's
     `results.verify.remainingManualItems` drives the manual walkthrough).

### On "Restart fresh"

Archive the old checkpoint (`mv .project/session/ship-{name}.json .project/archive/ship-{name}-{ISO}.json`,
`mkdir -p .project/archive` first), run orphan/leak cleanup, then proceed with a normal fresh PHASE 0.

### On "Inspect first"

Print the checkpoint JSON and `git worktree list` + `git -C {results.build.worktreePath} status --short`
(if the worktree exists), then re-present the resume question.

---

## Preflight checks (fresh runs, after resume detection finds no open checkpoint)

Before starting a fresh pipeline, surface conditions that would make the run start on a messy base.
Report each as a one-line notice; only block when genuinely unsafe.

- **Dirty working tree** — `git status --porcelain` non-empty on the base branch. Note it (the
  scoped-commit baseline handles isolation, but uncommitted changes may confuse the later merge).
- **Colliding worktree/branch** — `git worktree list` or `git branch --list worktree-{name}` shows
  a leftover from a prior aborted run **without** a checkpoint (an orphan). Offer to reuse or remove
  it via `AskUserQuestion` before AGENT 1 tries to create the worktree.
- **Stale checkpoint** — handled by resume detection above (the >24h notice).

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

---

## Rollback (surfaced in the failure report)

`baselineSha` is the pre-ship `HEAD`. On a ship that failed and will not be resumed, the user can
return the base branch to a clean state with `git reset --hard {baselineSha}` (after removing the
worktree). The report phase surfaces `baselineSha` in the failure summary so the escape hatch is
always visible — never run a destructive reset automatically.

**Post-merge caveat**: `baselineSha` predates the finalize/merge. After a **post-merge** failure
(e.g. dev PHASE 4 refactor/security), a hard reset to `baselineSha` also removes the
already-merged, already-verified feature — in that case prefer reverting only the offending
post-merge commits. The failure report should note this when the merge already happened.
