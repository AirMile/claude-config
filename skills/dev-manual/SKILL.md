---
name: dev-manual
description: Use when a /dev-ship run parked after auto-verify. Use with /dev-manual.
argument-hint: "[feature-name]"
reads:
  [
    feature.requirements,
    feature.tests,
    feature.verificationProfile,
    backlog.status,
    backlog.features,
    project-context.learnings,
    conventions,
  ]
writes:
  [
    feature.tests,
    backlog.status,
    backlog.features,
    project-context.learnings,
    security.shipTriage,
  ]
writes-terminal: [feature.status, feature.refactor, backlog.overview]
metadata:
  author: claude-config
  version: 1.13.0
  category: dev
---

# Manual (dev-ship pipeline tail)

Owns the back half of the dev pipeline for a feature `/dev-ship` already carried through build and
auto-verify: the manual test round (with its fix/debug rounds), refactor, and finalize/merge. **Not
a separate pipeline** — it resumes the same ship checkpoint and reads the same `dev-ship/references/`
files, named per phase below, rather than duplicating them. `/dev-ship {feature}` resumes into the
same place; this skill exists so the parked hand-off has a name that says what happens next.

**Trigger**: `/dev-manual {feature}` (the feature name is required — there is no no-arg pickup; a
ship checkpoint is always feature-scoped).

## Workflow

**Phase tracking** — MANUAL 0 owns when this fires (after the checkpoint is confirmed) and its
`Todo` carries the `ToolSearch`. Call `TaskCreate` with these 4 items (it always creates them
`pending` — no initial-status param exists), then immediately follow with one `TaskUpdate` per item
the checkpoint already shows as done, setting it `completed` directly — never leave all 4 sitting
`pending`:

1. MANUAL 0: Resume + worktree/app
2. MANUAL 1: Manual round (walkthrough + fix/debug)
3. MANUAL 2: Refactor + finalize/merge
4. MANUAL 3: Report

A park (a debug-ladder park, a fix-round "Otherwise" park, or a finalize halt-for-team) leaves its
MANUAL N item `in_progress` — never `completed` — until the parked work actually resolves on a later
resume; a park is a stopping point, not a finished phase.

## MANUAL 0 — Resume + worktree/app

> **Todo**: Resolve `main_root` FIRST and route per the branches below. Only the checkpoint branches
> seed or mark tasks — load their tools at that point with
> `ToolSearch query="select:TaskCreate,TaskUpdate"` (both are deferred), never upfront: the
> VERIFY-card and not-found branches mark nothing, so an eager load is dead weight on two of the
> three branches. If they don't resolve, skip task tracking and continue; each phase below opens
> with its own transition line either way. `main_root` = (`git worktree list --porcelain | head -1 | awk '{print $2}'` — always resolve
> this first, cwd may already be inside a feature worktree where `.project/session/` is not shared).
>
> `test -f "$main_root/.project/session/ship-{feature}.json"` fails → there is no open ship run for
> this feature. Before refusing, check for a live VERIFY pickup card: `node
~/.claude/scripts/backlog-load.js "$main_root" guard-items`, filter `type === "VERIFY"` and
> `status !== "CANCELLED"` and not `shipped`, match against `verify-{feature}` (or `{feature}` is
> itself that card's name — strip the `verify-` prefix to get the underlying feature for the dossier
> lookup below).
>
> - **Found** → Read `.claude/skills/dev-manual/references/deferred-reverify.md` and follow it in
>   full — this is a short standalone round, not a ship resume: do **not** seed the 4-item
>   `TaskCreate` list above, nothing here maps to MANUAL 0-3.
> - **Not found** → Print: _"No open ship run for `{feature}` — start one with `/dev-ship {feature}`,
>   if this is a small change rather than an in-flight ship use `/dev-tweak` instead, or if a
>   `verify-{feature}` VERIFY card exists on the backlog once its blocker ships, re-invoke to run its
>   deferred re-verify round."_ Stop here — do not seed `TaskCreate`, nothing to track.
>
> Checkpoint exists → read it (this routing step is the phase's own work — MANUAL 0 skips
> `in_progress` and marks straight to `completed` once a branch resolves below), confirm
> `pipeline: "dev"` (a design/game checkpoint under the same feature name is a
> different pipeline entirely — refuse with the same message as above if it doesn't match).
>
> **Staleness pre-check** (belt-and-suspenders — independent of whatever `shared/WORKTREE.md § 4.6`
> does later in MANUAL 1's own worktree-switch step): `DEFAULT=$(git -C "$main_root" symbolic-ref
--short HEAD); git -C "$main_root" log --oneline "worktree-{feature}..$DEFAULT" | wc -l`. Zero →
> say nothing.
>
> Non-zero → the commit count alone does not predict cost, so probe for a real overlap before
> wording the note. `git -C "$main_root" merge-tree --write-tree --name-only "$DEFAULT"
"worktree-{feature}"` exits 1 on conflict and lists the conflicting paths from its second line on
> (line 1 is the tree oid); it writes nothing to the working tree.
>
> - **Exit 0** → `"NOTE: worktree-{feature} is {N} commit(s) behind {default branch} — merges
clean; MANUAL 1's worktree switch rebases it automatically, nothing for you to do."`
> - **Exit 1** → not a visibility note, a scheduled cost. Print: `"NOTE: worktree-{feature} is {N}
commit(s) behind {default branch} AND conflicts with it in: {paths}. MANUAL 2's merge WILL stop
on this — budget for dev-ship/references/merge-conflict-resolution.md before finalize. Not a
reason to stop now."`
>
> Two git calls, no working-tree mutation — this surfaces the drift and its real cost even when
> MANUAL 1's switch takes the skip-because-already-in-worktree fast path, and never replaces
> WORKTREE.md's own staleness-rebase.
>
> Run `node ~/.claude/scripts/ship-checkpoint.js route {feature}` and branch — every branch below
> marks MANUAL 0 → `completed` (routing resolved) and seeds the rest of the `TaskCreate` list per
> the stated statuses:
>
> **Cross-check before trusting `"phase3-completion"`**: the router derives this purely from whether
> every entry in `manual.items` is resolved — it never re-reads how many items the round was
> supposed to walk. Compare **both** directions before believing it:
>
> 1. `results.verify.remainingManualItemsCount` (when present) against the length of the
>    `results.verify.remainingManualItems` array — a count larger than the array means the array was
>    truncated.
> 2. The length of `remainingManualItems` against the number of entries in `manual.items` — a ledger
>    covering fewer items than the array means the walkthrough never reached them.
>
> Either side short → the checkpoint is malformed **or the round is simply unfinished**, and the
> router's "nothing to test" verdict is not trustworthy. Direction 2 is the common real case: a
> resume that walked some items, resolved them, and stopped — every ledger entry is resolved, so
> `route` reports completion while items sit unwalked. Do not route to MANUAL 2 on it; go to
> **MANUAL 1** and run the walkthrough for the items not yet present in `manual.items` (the same
> filter `phase-3-manual-finalize.md § Resume entry` bullet 8 uses). Only a genuine array/count
> mismatch (direction 1) needs the user: print it and ask how to proceed (re-run auto-verify to
> regenerate the array, or reconstruct it from `plan.verificationProfile`). Never silently skip the
> manual round on either.
>
> - `"phase12"` → build/auto-verify hasn't completed yet — this skill's job hasn't started. Print:
>   _"Build/auto-verify for `{feature}` hasn't finished — resume with `/dev-ship {feature}` instead."_
>   Stop here (mark MANUAL 0 → `completed` regardless — the routing check itself finished, only the
>   ship run hasn't).
> - `"phase3-manual"` → the common case. Mark MANUAL 0 → `completed`, MANUAL 1 → `in_progress`,
>   leave MANUAL 2/3 `pending`, then go to **MANUAL 1**.
> - `"phase3-completion"` → no manual items were left (or the ledger already fully resolved). Mark
>   MANUAL 0 → `completed`, MANUAL 1 → `completed` (nothing to walk), MANUAL 2 → `in_progress`,
>   leave MANUAL 3 `pending`, then skip straight to **MANUAL 2** (there is no manual round to run).
> - `"phase4"` / `"phase4-finalize-only"` → manual round and completion already ran on a prior
>   resume; only refactor/finalize (or just finalize) remains. Mark MANUAL 0 → `completed`, MANUAL 1
>   → `completed`, MANUAL 2 → `in_progress`, leave MANUAL 3 `pending`, then go straight to
>   **MANUAL 2**.
>
> **Note**: the branch table above already made every mark it names — later sections only mark what
> it didn't cover.

## MANUAL 1 — Manual round (walkthrough + fix/debug)

**Print first**: `MANUAL 0 → MANUAL 1: checkpoint resumed, manual round starting.` Phases run tens
of tool calls long; the task list alone leaves the user without a marker for where the run is.

> **Todo**: mark MANUAL 1 → `in_progress`.
> Read `.claude/skills/dev-ship/references/phase-3-manual-finalize.md` and follow it from
> **§ Resume entry** — it re-enters the worktree (Step 1), relaunches the app (Step 2), then routes
> per open ledger item (debug tiers, fix-plan gate, or the item-by-item walkthrough) exactly as a
> `/dev-ship {feature}` resume would. This section owns the full loop — findings ledger, fix rounds,
> debug-ladder escalation with its difficulty triage and toolbox (`shared/DEBUG-LADDER.md`,
> `shared/DEBUG-TOOLBOX.md`), tweak offload to the backlog — through to the DONE completion write
> (its own Step 3). **Nothing here is dev-manual-specific** — it is the identical reference `/dev-ship`
> itself would read on a resume; this skill just starts here directly instead of routing through
> `/dev-ship`'s own PHASE 0/1/2.
>
> On completion, that file's Step 3 already hands off to `orchestration.md § 5` internally — continue
> there (**MANUAL 2** below) rather than re-deriving the transition.
>
> **App already running** — the norm on desktop/native/terminal projects: the user has it open, and
> that is often why they invoked this skill. `phase-3-manual-finalize.md § Step 2` only covers the
> case where you launch it. Do not relaunch blindly, and do not skip Step 2 either — a process that
> was started before this resume may hold a build older than the branch under test, and on a
> compiled or desktop app replacing the artifact on disk does **not** reload it. Confirm the running
> build from something the app itself renders (a version/build stamp, a visible fingerprint of the
> change) — a file comparison is evidence about the disk, never about the process. Stale → rebuild
> and reload BEFORE handing over item 1, and say which signal you used. Step 2's teardown then kills
> only what you started yourself; leave a pre-existing instance running.
>
> **Checkpoint-only resume note**: unlike a same-session `/dev-ship` run, dev-manual never has
> AGENT 2's structured result in context — `phase-3-manual-finalize.md § Step 3`'s completion-sync
> payload (`requirements[]` verdicts, `checklist{}` statuses) must be reconstructed from
> `feature.json#requirements[]`/`#tests.checklist[]` instead (they already carry `status`/`pass`
> markers from the build/verify agents) — read that file's current state rather than assuming an
> in-session result to draw from.

## MANUAL 2 — Refactor + finalize/merge

**Print first**: `MANUAL 1 → MANUAL 2: manual round done, refactor starting.`

> **Todo**: mark MANUAL 1 → `completed`, MANUAL 2 → `in_progress`.
>
> **STOP — check where the session stands before entering § 5.** MANUAL 1 may have switched the
> session into `worktree-{feature}` (`shared/WORKTREE.md § Switch`), which would make it
> **worktree-isolated** — the harness then refuses every `git -C "$main_root" …`, including
> § 5's own pre-spawn target-clean check (d) and the merge itself. Probe, don't assume: run
> `git -C "$main_root" status --porcelain` — check (d) needs that output anyway, so this costs
> nothing extra.
>
> - **It works** → the session was launched in the worktree rather than switched into it, so
>   `ExitWorktree` has no session to end and returns a no-op error (the same case
>   `finalize.md`'s own ExitWorktree note documents). Do not call it. Stay put and name every
>   target path explicitly from here on.
> - **It is refused** → the session is worktree-isolated. Call `ExitWorktree(action: keep)` now
>   — the worktree stays on disk and AGENT 3 gets its path from the pointer file, so nothing
>   downstream needs the session to sit inside it.
>
> Two traps either way: § 5's `scriptPath` must be absolute, and `finalize.md`'s PR probe must
> be handed the branch literally (`--head worktree-{feature}`) — once off the branch
> `git branch --show-current` answers `main`, so the verbatim command would probe the wrong one.
>
> Read `.claude/skills/dev-ship/references/orchestration.md § 5` and follow it: refactor (AGENT 3) +
> optional security triage (AGENT S), then finalize (solo-merge or halt-for-team, per
> `.claude/skills/dev-ship/references/dev-verify/references/finalize.md`). This is the same reference `/dev-ship`'s
> own PHASE 4 reads — no dev-manual-specific variant.
>
> § 5's **post-merge target-branch verification** (run the suite on the target before cleanup) is
> not optional on a resume — it is the one obligation MANUAL 0's staleness probe cannot cover, since
> that probe is a snapshot taken at resume and commits landing during the run are invisible to it.
> The rule itself lives in § 5; do not restate it here.
>
> **`"phase3-completion"` entry** (from MANUAL 0): first run `orchestration.md § 4` (the no-manual
> completion — Step 1 + Step 3 of `phase-3-manual-finalize.md` only) before § 5, exactly as
> `/dev-ship`'s own no-manual path would.
>
> **`"phase4-finalize-only"` entry**: refactor already ran on a prior resume — skip the refactor
> spawn, but still run § 5's two non-refactor obligations before finalizing:
> (a) the **deferred-items transparency line** (`orchestration.md § 5`) when the checkpoint's
> `manual.items[]` holds any `verdict: "deferred"` entry — reword "refactor + merge" to "merge";
> the disclosure belongs before the merge, not only in the closing report; and (b) the
> **archive-reconcile guard** — never skip the reconcile because the project's `backlog.json`
> looks inconsistent with it; say so to the user instead of silently matching precedent.

## MANUAL 3 — Report

**Print first**: `MANUAL 2 → MANUAL 3: merged, writing the report.` (Or `halted` in place of
`merged` when finalize took the halt-for-team route.)

> **Todo**: mark MANUAL 2 → `completed`, MANUAL 3 → `in_progress`. Read
> `.claude/skills/dev-ship/references/phase-5-report.md` and follow it — shared with `/dev-ship`'s own
> PHASE 5, the only difference being which phase-tracking unit gets marked `in_progress`/`completed`
> (MANUAL 3 here). Mark MANUAL 3 → `completed` per that file's own closing `Todo`.

## Failure recovery

Same as `/dev-ship`: a failed workflow leaves the checkpoint on disk (`status: "failed"`) rather than
completing it — re-run `/dev-manual {feature}` (or `/dev-ship {feature}`, identical result) to retry,
or go straight to `.claude/skills/dev-ship/references/debug-round-heavy.md` (non-ledger entry) for a repeated build/verify
failure. This skill never resumes a `"phase12"` failure itself (see MANUAL 0's refusal above) — that
retry always goes through `/dev-ship`.

**Crash between the merge and the checkpoint deletion.** The checkpoint still says
`phase4-finalize-only` while the branch is already merged and deleted, so a re-run routes to
MANUAL 2 and `finalize.md`'s Branch Resolution dead-ends on "No worktree found". That is the
shape of a _finished_ ship, not a broken one — do not re-merge. Confirm both: the default
branch's tip is the merge commit (`git log --oneline -1`), and the feature sits in
`.project/archive/backlog-archive.json#archived[]` with `shipped: true`. Both hold → run § 5's
post-merge reconcile (re-stamp `shippedSha`, state-push), delete the checkpoint, go to MANUAL 3.
Either fails → the merge never landed; re-enter MANUAL 2 normally.
