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
    feature.status,
    feature.tests,
    backlog.status,
    backlog.features,
    project-context.learnings,
    security.shipTriage,
  ]
writes-terminal: [feature.refactor, backlog.overview]
metadata:
  author: claude-config
  version: 1.4.4
  category: dev
---

# Manual (dev-ship pipeline tail)

Owns the back half of the dev pipeline for a feature `/dev-ship` already carried through build and
auto-verify: the manual test round (with its fix/debug rounds), refactor, and finalize/merge. This is
**not a separate pipeline** — it resumes the exact same ship checkpoint `/dev-ship` writes, reading
the same reference files under `dev-ship/references/` (`phase-3-manual-finalize.md`,
`manual-interview-walkthrough.md`, `fix-round.md`, `debug-round.md`, `debug-round-heavy.md`,
`orchestration.md`, `phase-5-report.md`) rather than duplicating them. `/dev-ship {feature}` still
resumes into the same place — this skill exists so the parked hand-off after auto-verify has a name
that says what actually happens next, and so a feature's manual round can be picked back up without
re-reading the whole `/dev-ship` skill.

**Trigger**: `/dev-manual {feature}` (the feature name is required — there is no no-arg pickup; a
ship checkpoint is always feature-scoped).

## Workflow

**Phase tracking** — first action of the skill, once a checkpoint is confirmed to exist (see MANUAL
0 below): call `TaskCreate` with these 4 items (it always creates them `pending` — no initial-status
param exists), then immediately follow with one `TaskUpdate` per item the checkpoint already shows
as done, setting it `completed` directly — never leave all 4 sitting `pending`:

1. MANUAL 0: Resume + worktree/app
2. MANUAL 1: Manual round (walkthrough + fix/debug)
3. MANUAL 2: Refactor + finalize/merge
4. MANUAL 3: Report

## MANUAL 0 — Resume + worktree/app

> **Todo**: `ToolSearch query="select:TaskCreate,TaskUpdate"` first — both tools are deferred (unused
> on the VERIFY-card branch below, but MANUAL 0's own routing needs them regardless of which branch
> it resolves to). If they don't resolve, skip task tracking and continue — but still print one
> line at every MANUAL N → MANUAL N+1 transition below (e.g. "MANUAL 1 → MANUAL 2: manual round
> done, refactor starting") so a run without the tool still carries a visible progress signal
> instead of silence between phases. Resolve `main_root` (`git worktree list --porcelain | head -1 | awk '{print $2}'` — always resolve
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
> different pipeline entirely — refuse with the same message as above if it doesn't match). Run
> `node ~/.claude/scripts/ship-checkpoint.js route {feature}` and branch — every branch below marks
> MANUAL 0 → `completed` (routing resolved) and seeds the rest of the `TaskCreate` list per the
> stated statuses:
>
> **Cross-check before trusting `"phase3-completion"`**: the router derives this purely from
> `results.verify.remainingManualItems` (the array). If the checkpoint instead carries a
> `remainingManualItemsCount > 0` with no (or a shorter) `remainingManualItems` array, and
> `manual.items` doesn't already cover that many items, the checkpoint is malformed — the
> router's "nothing to test" verdict is not trustworthy. Print the mismatch and ask the user how
> to proceed (re-run auto-verify to regenerate the array, or reconstruct it from
> `plan.verificationProfile`) before routing to MANUAL 2 — never silently skip the manual round
> on a malformed checkpoint.
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
> **Note**: the branch table above already sets every MANUAL N mark it names on entry — the
> `Todo` in each section below only marks what that branch table didn't already cover; skip
> a mark silently wherever MANUAL 0 already made it.

## MANUAL 1 — Manual round (walkthrough + fix/debug)

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
> **Checkpoint-only resume note**: unlike a same-session `/dev-ship` run, dev-manual never has
> AGENT 2's structured result in context — `phase-3-manual-finalize.md § Step 3`'s completion-sync
> payload (`requirements[]` verdicts, `checklist{}` statuses) must be reconstructed from
> `feature.json#requirements[]`/`#tests.checklist[]` instead (they already carry `status`/`pass`
> markers from the build/verify agents) — read that file's current state rather than assuming an
> in-session result to draw from.

## MANUAL 2 — Refactor + finalize/merge

> **Todo**: mark MANUAL 1 → `completed`, MANUAL 2 → `in_progress`. Read
> `.claude/skills/dev-ship/references/orchestration.md § 5` and follow it: refactor (AGENT 3) +
> optional security triage (AGENT S), then finalize (solo-merge or halt-for-team, per
> `dev-ship/references/dev-verify/references/finalize.md`). This is the same reference `/dev-ship`'s
> own PHASE 4 reads — no dev-manual-specific variant.
>
> **`"phase3-completion"` entry** (from MANUAL 0): first run `orchestration.md § 4` (the no-manual
> completion — Step 1 + Step 3 of `phase-3-manual-finalize.md` only) before § 5, exactly as
> `/dev-ship`'s own no-manual path would.
>
> **`"phase4-finalize-only"` entry**: skip straight to § 5's finalize step — refactor already ran on
> a prior resume.

## MANUAL 3 — Report

> **Todo**: mark MANUAL 2 → `completed`, MANUAL 3 → `in_progress`. Read
> `.claude/skills/dev-ship/references/phase-5-report.md` and follow it — shared with `/dev-ship`'s own
> PHASE 5, the only difference being which phase-tracking unit gets marked `in_progress`/`completed`
> (MANUAL 3 here). Mark MANUAL 3 → `completed` per that file's own closing `Todo`.

## Failure recovery

Same as `/dev-ship`: a failed workflow leaves the checkpoint on disk (`status: "failed"`) rather than
completing it — re-run `/dev-manual {feature}` (or `/dev-ship {feature}`, identical result) to retry,
or go straight to `dev-ship/references/debug-round-heavy.md` (non-ledger entry) for a repeated build/verify
failure. This skill never resumes a `"phase12"` failure itself (see MANUAL 0's refusal above) — that
retry always goes through `/dev-ship`.
