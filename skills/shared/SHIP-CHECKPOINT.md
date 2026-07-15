# Ship checkpoint & resume (shared)

Canonical checkpoint mechanism for the auto-mode ship pipelines (`dev-ship`, `design-ship`,
`game-ship`) — resumable pause on interruption (credits/crash/kill) plus the deliberate PHASE 2→3
handoff pause. Single writer: the main chat, throughout the whole run. Does not store
`SHIP_CONTEXT` — that's cheap to re-derive on resume. Full background: `references/SHIP-CHECKPOINT-RATIONALE.md`.

---

## File

`.project/session/ship-{name}.json` — one per active ship run (`{name}` = feature or target name,
same key as `active-{name}.json`). Parallel to the live-signal, but with a different lifecycle:
`active-{name}.json` is removed on **every** exit; the checkpoint is removed **only on
`status: "complete"`** — on failure/interruption it stays, so a re-invoke can resume.

Because the checkpoint survives a full session end (unlike `active-{name}.json`), the backlog board
reads it too: a checkpoint with `status != "complete"` and no live signal renders as a **parked**
row (amber ⏸ `{label} · parked`, with a copy-button carrying the `/{pipeline}-ship {name}` resume
command). See `BACKLOG.md § Board rendering`.

### Schema

```json
{
  "schemaVersion": 1,
  "pipeline": "dev", // "dev" | "design" | "game"
  "feature": "auth-login",
  "startedAt": "<ISO>",
  "updatedAt": "<ISO>",
  "status": "running", // "running" | "failed" | "complete"
  "phase": "PHASE 2", // current phase pointer (label matches the skill's phase list); may also be
  //                     the pre-approval value "PHASE 0 · define" (dev/game minimal checkpoint —
  //                     written before EnterPlanMode; completedPhases:[], plan:{} — the draft is
  //                     authored inside plan mode and is NOT checkpointed; see plan field below)
  "completedPhases": ["PHASE 0", "PHASE 1"],
  "baselineSha": "<git rev-parse HEAD before ship>", // rollback anchor
  "preRefactorSha": "<worktree HEAD at PHASE 4 start>", // optional; revert anchor if refactor fails (dev/game)
  "plan": {
    /* dev/game: SHIP_PLAN (auto-derived refactorLenses, securityLight, securityDeep,
                verificationProfile), set at write point 1 (post gate-accept). At the pre-accept
                "PHASE 0 · define" checkpoint the dev/game plan is EMPTY (`{}`): define authors the
                feature.json draft INSIDE plan mode, which blocks the `.project/` write that would
                store it, so the draft lives only in memory + the plan file until accept. A
                cross-session death before accept therefore re-runs define (the draft is not
                recoverable) — the accepted cost of running the thinking on the planning model.
                feature.json is written only at gate-accept (extracted from the plan-file appendix);
                Step 5 (post-accept) sets the formalized SHIP_PLAN here. design: the FULL PHASE 0
                objects — direction (incl. its token decisions + chosen layout), archetype, brief,
                checkScope, composition (PAGE only), and the inline spec when captured (its disk
                write is deferred to the build sync, so until the build completes the checkpoint is
                its only durable home). Store the objects the agent prompts are assembled from —
                never display-abbreviated names. */
  },
  "results": {
    /* structured agent returns, filled per phase.
                  dev: { build, verify, refactor, triage }.
                  design: { build, content, check }.
                  The worktree path + branch live in results.build — no separate top-level copy. */
  },
  "prompts": {
    /* the prompt-file PATHS for the workflow in flight, written at launch (write point 2)
                  and cleared with activeWorkflow on return. The ship skill writes small
                  pointer + SHIP_CONTEXT-slice files under .project/session/ship-prompts/ (the
                  static bodies live in references/prompts/*, read by the agents), and those
                  files persist on disk — so store PATHS, never prompt bodies.
                  dev: { buildPromptPath, verifyPromptPath } or
                       { refactorPromptPath, scanners, triagePromptPath } or
                       { fixGroupPromptPaths } (PHASE 3 fix dispatch — one path per fix group).
                  game: same shape minus scanners/triagePromptPath (no security phase); PHASE 3 fix
                       dispatch is also { fixGroupPromptPaths } — same key, game-ship's own paths.
                  design: { buildPromptPath, contentPromptPath, checkPromptPath }.
                  Lets a resume relaunch with the exact original prompt files; reassemble
                  from plan + disk only if a file is missing. */
  },
  "activeWorkflow": null, // "phase12" | "phase4" | "phase3fix" | "design123" | null
  "workflowRunId": null, // "wf_..." from the Workflow tool result, for resumeFromRunId
  "manual": {
    /* dev-ship PHASE 3 only: the findings ledger + fix-round state (round-state, not an agent
                return — sibling of `results`, not nested under it). Written incrementally through
                the walkthrough, the fix-plan gate, and dispatch — see phase-3-manual-finalize.md,
                manual-interview-walkthrough.md, fix-round.md.
                round: 1-based counter, bumped before each fix-plan gate entry.
                items: [{ id, title, verdict: "pass"|"fail"|"tweak"|"skip"|"defer"|"accepted", category,
                          observed, expected, screenshot, source: "checklist"|"interview",
                          debugTier: "light"|"heavy" (absent = not in the debug ladder),
                          heavyRoundFailed: bool (absent otherwise),
                          lightRoundNotes: string (absent unless debugTier reached "heavy"),
                          offload: string (backlog card name — set when this "tweak"-verdict item
                          was offloaded via phase-3-manual-finalize.md § Offload flush; absent for
                          fail/pass/skip/defer items and for the narrow inline-fixed tweak exception,
                          which flips straight to "pass" instead — see that section's verdict-flip
                          rule) }] —
                        written one item at a time via `ship-checkpoint.js item {name} manual`,
                        which upserts by `id` (append if new, replace in place if the id already
                        exists) — never re-send the full array yourself. `debugTier` is dev-ship's
                        park-first debug ladder progress marker (absent → "light" → "heavy" →
                        resolved) — see `dev-ship/references/fix-round.md § Re-check`,
                        `debug-round.md`, `debug-round-heavy.md`. It replaces a per-round
                        repeat-count gate; each tier owns its own park/escalate, so there is no
                        top-level `pendingRound` flag on this object (contrast `playtest` below,
                        which still uses one — game-ship's ladder is unchanged). `lightRoundNotes`
                        is written by `debug-round.md § 8` right before it parks to the heavy tier —
                        the light round's investigation digest, hypothesis, fix attempted, and
                        re-check observations, condensed to a string. A park ends the session, so
                        this field (not in-context carryover) is the only thing `debug-round-heavy.md`
                        has to reuse the light round's evidence rather than re-investigating from
                        scratch.
                interviewDone: bool — the "now that you see it" close has run.
                `"accepted"` vs `"defer"`: `"defer"` is the walkthrough's own verdict choice, strictly
                for external blockers (missing account, CORS origin, API token, addon —
                `manual-interview-walkthrough.md`); `"accepted"` is set only by the user's explicit
                "Accept anyway"/"Accept as-is" choice at a debug-ladder ceiling or a non-converging
                tweak loop (`fix-round.md`, `debug-round-heavy.md § 8`) — a known limitation, not a
                blocker. Both, plus deferred items from `/dev-verify`'s own walkthrough, are folded
                into `payload.knownIssues` at completion-sync time and surface as a dashboard badge
                (`shared/BACKLOG.md § Known-issue badges`) — this ledger itself does not survive past
                checkpoint deletion.
                fixPlan: the accepted round-gate appendix object (findings/groups/waves), or absent.
                dispatch: { groups: { [groupId]: { status, itemsFixed, testsGreen, notes,
                           autoDecisions } }, allFixed: bool } — merged in from ship-fix.js's return. */
  },
  "playtest": {
    /* game-ship PHASE 3 only: the base shape of `manual` above (round, items[], interviewDone,
                fixPlan, dispatch), scoped separately because game-ship's ledger vocabulary differs
                (playtest, not manual-test) — see phase-3-playtest.md, playtest-interview-walkthrough.md,
                game-ship's fix-round.md. `dispatch.groups[id]`'s `itemsFixed`/`notes` describe GUT-test
                results where the finding was TESTABLE. Unlike `manual`, `playtest` still uses a
                top-level `pendingRound: bool` + a per-item `failedRounds` counter instead of
                `debugTier`: game-ship's debug ladder still hands off to the standalone `/game-debug`
                skill, so it keeps its original round-repeat-count shape (dev-ship's ladder was
                folded inline, which is what motivated `debugTier` there). Never present together
                with `manual` — a checkpoint is one pipeline at a time
                (`pipeline: "dev" | "design" | "game"`). */
  }
}
```

---

## Writing the checkpoint — via `ship-checkpoint.js`

All checkpoint writes go through `~/.claude/scripts/ship-checkpoint.js`. The script **resolves the
main checkout root itself** (first line of `git worktree list --porcelain`) and always writes to
`<main_root>/.project/session/ship-{name}.json`. This is the crux: the main chat runs with
cwd **inside the feature worktree** during PHASE 3/4 (manual tests / refactor+finalize), where
`.project/session/` is worktree-local — deliberately **not** symlinked — so a relative path would
silently write the wrong (worktree-local) location. Because the script resolves main_root, callers
may invoke it from **any cwd**. It does the atomic tmp+rename, deep-merges patches, and stamps
`updatedAt` on every write. JSON travels on **stdin** (not argv), which avoids node/argv escaping
issues — but the payload still has to survive the shell's own quoting to reach that stdin. The
`echo '<json>' | node ...` form below wraps the payload in single quotes: any apostrophe inside a
free-text field (an observation, a note, ordinary English/Dutch prose) breaks that wrapping and
the command fails before node ever runs. When a payload carries free text, write it to a temp
file first (Write tool) and pipe via `cat file | node ...` instead of inlining it after `echo`.

| Write kind                              | Command                                                                                      | Notes                                                                                                                                                                                                            |
| --------------------------------------- | -------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Create** (write point 0/1)            | `echo '<full object>' \| node ~/.claude/scripts/ship-checkpoint.js init {name}`              | full checkpoint object; overwrites if present                                                                                                                                                                    |
| **Patch delta** (write points 1–4)      | `echo '<delta>' \| node ~/.claude/scripts/ship-checkpoint.js patch {name}`                   | deep-merge; pass `"key": null` to clear it (e.g. `"activeWorkflow": null`)                                                                                                                                       |
| **Complete** (write point 5)            | `node ~/.claude/scripts/ship-checkpoint.js complete {name}`                                  | sets `status:"complete"`, then removes the file                                                                                                                                                                  |
| resolve path (debug)                    | `node ~/.claude/scripts/ship-checkpoint.js path {name}`                                      | prints the absolute checkpoint path, no write                                                                                                                                                                    |
| **Live signal** (skill start)           | `echo '{"skill":"..."}' \| node ~/.claude/scripts/ship-checkpoint.js signal {name}`          | writes `active-{name}.json` wholesale; script stamps `feature`/`startedAt`                                                                                                                                       |
| **Live signal clear** (skill end)       | `node ~/.claude/scripts/ship-checkpoint.js signal-clear {name}`                              | removes `active-{name}.json`; exit 0 whether or not it existed                                                                                                                                                   |
| **Ledger item upsert** (write point 3b) | `echo '<item(s)>' \| node ~/.claude/scripts/ship-checkpoint.js item {name} manual\|playtest` | **full-object replace-by-`id`**, not a field-merge — send the item's complete object (every field you want kept), one item (or a JSON array, batch) at a time; a partial patch silently wipes any field you omit |
| **Route** (dev/game orchestration)      | `node ~/.claude/scripts/ship-checkpoint.js route {name}`                                     | prints `{"route": "...", "resume": {...}\|null}` — no write; see the script header for the logic                                                                                                                 |

- The merge is a **deep merge for nested objects** (`results`, `plan`) and a **replace for arrays
  and scalars** — so `results.build` from an earlier write survives when a later write adds
  `results.verify`, while `completedPhases` is replaced wholesale. Passing `"activeWorkflow": null`
  (or `"prompts": null`) clears that key on a workflow return.
- Emit **only** the keys that changed in a `patch` — never re-send `plan` after the first write.
- `init` overwrites an existing file; `patch`/`complete` exit non-zero if the checkpoint does not
  exist yet (run `init` first). The script is cross-platform (Node) — no separate Windows form.

### When the checkpoint is written

0. **Minimal checkpoint before plan mode (dev/game only)** — the object's first write. Written in the
   pipeline's PHASE 0 bookkeeping step (dev-ship Step 2a) **before** `EnterPlanMode` — plan mode
   blocks `.project/` writes, so this is the last write slot before the whole define thinking-block.
   Create via `init`. Set `pipeline`, `feature`, `startedAt`/`updatedAt`, `status: "running"`,
   `phase: "PHASE 0 · define"`, `completedPhases: []`, `baselineSha`, empty `results`/`prompts`,
   `activeWorkflow: null`, and `plan: {}`. It marks the run started (board shows it **parked** if the
   session dies) and durably anchors the rollback SHA. It deliberately holds **no** feature draft:
   define authors the draft inside plan mode, which cannot write to disk, so the draft is not
   checkpointed and a cross-session death before accept re-runs the interview. `SHIP_PLAN` is not
   formalized until after the gate (Step 5). Design has no minimal checkpoint (its PHASE 0 selections
   are irreproducible user choices written post-gate), so for design write point 1 is the first write.
1. **End of PHASE 0 (post-accept)** — for dev/game this **patches** the minimal checkpoint: set the
   formalized `plan` (SHIP_PLAN + verification/playtest profile — the pre-accept `plan` was `{}`, so
   there is nothing to drop), advance `phase` = the first agent phase, `completedPhases: ["PHASE 0"]`.
   For design it is the **first** write (`init`); set `plan` (the PHASE 0 selections), `baselineSha`
   (`git rev-parse HEAD` captured before any ship work), `phase` = the first agent phase,
   `completedPhases: ["PHASE 0"]`, `status: "running"`.
2. **Immediately after launching a Workflow** (always the main chat — it launches every Workflow
   itself, dev/game and design alike) — the tool result returns a `runId` even while the workflow
   runs in the background; store it as `workflowRunId`, set `activeWorkflow`, and store the
   assembled Workflow prompt args as `prompts`. This is what makes a mid-workflow crash resumable —
   with the exact original prompts.
3. **On each workflow/agent return** (the task-notification wakes the main chat, which does this
   write) — merge the returned structured object(s) into `results`, advance `phase`, append the
   just-finished phase(s) to `completedPhases`, clear `activeWorkflow`/`workflowRunId`/`prompts`. The
   dev/game `route` subcommand (table above) reads exactly these fields to decide where to go next.
   3b. **PHASE 3 mid-phase writes (dev-ship manual round / game-ship playtest round)** — always
   executed by the main chat (PHASE 3's interactive round runs in the main chat). Finer-grained than
   the phase boundaries above, because the interactive round has its own resumable sub-state: upsert
   `manual.items` (dev) / `playtest.items` (game) — one item at a time, or batched as a JSON array —
   via `ship-checkpoint.js item {name} manual|playtest` (see manual-interview-walkthrough.md § Batch
   persist for the plan-mode-deferred batch case); patch `.interviewDone` after the interview close;
   patch `.round` (+1) before entering the fix-plan gate's plan mode; patch `.fixPlan` at gate-accept;
   set `activeWorkflow: "phase3fix"` + `workflowRunId` + `prompts.fixGroupPromptPaths` at dispatch
   launch (write point 2 applies here too); patch `.dispatch` and clear
   `activeWorkflow`/`workflowRunId`/`prompts` on dispatch return.
4. **On a failure-jump to the report phase** (the main chat) — set `status: "failed"` (keep
   everything else so the user can resume or inspect).
5. **On successful completion (report phase)** — the main chat runs `complete` (sets
   `status: "complete"`, then removes the file). Do **not** run it on a failure exit — a failed run
   keeps its checkpoint.

Write the checkpoint at the **same boundaries** where the skill already rewrites
`active-{name}.json` — that rewrite is the natural hook.

---

## Resume detection & resume/restart flows → `SHIP-RESUME.md`

Resume detection (the `test -f` + pipeline check), the **direct-resume fast path**, the
Resume/Restart/Inspect question, the **On "Resume"** / **On "Restart fresh"** / **On "Inspect
first"** flows, and **orphan/leak cleanup** live in `shared/SHIP-RESUME.md` — the resume path reads
only that file, not this whole spec. This file stays the source of truth for the checkpoint
**schema**, the **write points** (above), fresh-run **preflight** (below), and **rollback** (below).

---

## Preflight checks (fresh runs, after resume detection finds no open checkpoint)

Before starting a fresh pipeline, surface conditions that would make the run start on a messy base.
Report each as a one-line notice; only block when genuinely unsafe.

- **Dirty working tree** — `git status --porcelain` non-empty on the base branch. Note it (the
  scoped-commit baseline handles isolation, but uncommitted changes may confuse the later merge).
- **Colliding worktree/branch** — `git worktree list` or `git branch --list worktree-{name}` shows
  a leftover from a prior aborted run **without** a checkpoint (an orphan). Offer to reuse or remove
  it via `AskUserQuestion` before AGENT 1 tries to create the worktree.
- **Stale checkpoint** — handled by resume detection (the >24h notice — see `SHIP-RESUME.md`).

> **Orphan / leak cleanup** (run on Resume and on Restart) lives in `shared/SHIP-RESUME.md` — the
> resume flows are its only callers.

---

## Rollback (surfaced in the failure report)

`baselineSha` is the pre-ship `HEAD`. On a ship that failed and will not be resumed, the user can
return the base branch to a clean state with `git reset --hard {baselineSha}` (after removing the
worktree). The report phase surfaces `baselineSha` in the failure summary so the escape hatch is
always visible — never run a destructive reset automatically.

**Pre-merge refactor caveat**: for the dev/game pipelines, refactor/security now run **pre-merge**
inside the worktree (PHASE 4), and the finalize/merge is PHASE 4's last step. So a PHASE 4 refactor
failure is recovered by resetting the worktree branch to `preRefactorSha` (the HEAD captured at
PHASE 4 start) — **not** `baselineSha` — after which finalize still merges the verified feature. Only
**after** PHASE 4's finalize has merged does `baselineSha` become the post-merge escape hatch: a hard
reset to it would also remove the already-merged, already-verified feature, so prefer reverting only
the offending commits. The failure report notes which anchor applies.
