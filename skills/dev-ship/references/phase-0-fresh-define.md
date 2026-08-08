# PHASE 0 — Fresh define + plan-approval gate (only when `defineNeeded`)

Loaded from `phase-0-define-classify.md` Step 1 only on the fresh-define branch (feature missing or
not yet DEFINED). The already-DEFINED resume branch never reads this file — Step 1 skips straight to
Step 5 there, so this content never enters context on the far more common resume path.

## Step 2b — Enter plan mode (only when `defineNeeded`)

`EnterPlanMode` (per `shared/PLAN-MODE.md` Entry). **Skip if already in plan mode** — if an active
plan-mode system-reminder already exists (the user started `/plan-mode` or another plan-mode skill
first), do not call it; read the existing plan-file path from that reminder instead. Note the
plan-file path from the system-reminder — the gate (Step 4b) writes the plan there.

Everything from here to the gate runs in plan mode: `Read`/`Glob`/`Grep`, read-only Bash, `WebSearch`

- Context7, `AskUserQuestion`, and the read-only `context-aggregator`/`define-scout` subagents all
  keep working; only `.project/`/source writes are blocked (and define defers all of those to accept
  anyway).

## Step 2c — Run `dev-define` inline (PHASE 0→2) in plan mode

> **STOP — Read `.claude/skills/dev-ship/references/dev-define/workflow.md` now and execute it.**
> Do not improvise the interview/requirements/architecture from context alone, even when the
> feature seems simple — that file's PHASE 1b/2 checks (Frontend Discovery, Seed Alignment, Backlog
> Impact) and the machine-contract appendix authored _before_ the gate are not optional shortcuts.

That copy is **already adapted** for dev-ship — it carries no plan-mode machinery of its own
(dev-ship owns the enclosing plan mode) and no phase tracking. Notes for this enclosing context:

- It runs **PHASE 0→2 only** now (interview, requirements, architecture, and the **complete
  feature.json draft** held **in memory** — no `feature.json` write, no plan-file write yet). This is
  dev-ship's one interactive touchpoint: define keeps its genuine-decision `AskUserQuestion`s
  (feature resolution, design-choice forks, split proposal), and they reach the real user. **Pure
  confirmations are gone** — no interview summary-confirm, no ">6 REQs scope confirm", no design-sketch
  confirm, no seed/backlog-impact prompts; those are presented in the gate plan file instead (Step 4b),
  where the user reviews everything at once and the reject-loop revises.
- **Skip its PHASE 0 §3 initial-setup writes** (the `mkdir` + `active-{feature}.json` write) — Step 2a
  already did them.
- Its **PHASE 3+4 (write + sync) run at gate-accept** (Step 4b): the draft becomes the plan-file
  appendix, `feature-from-plan.js` writes `feature.json`, and the sync runs. All
  `.project/{backlog,project,project-context}.json` writes — including the backlog `DEFINED` flip with
  `auto: true` — are deferred to that accept, so a rejected-and-abandoned define leaves no orphan card.
  Any conditional define writes (`00-split.md` + sub-feature `mkdir`s on a split) defer to accept too.
- **Standing park escape** — every interview/decision question from here to the gate implicitly
  allows "park this" (wrong moment, wrong order, or a premise the loaded context contradicts).
  On any park intent, stop and Read
  `.claude/skills/dev-ship/references/define-park.md` (the rule itself lives in the workflow's
  Constraints). At the gate itself, Step 4b's Abort covers the same decision.

PHASE 1b/2 of `dev-define/workflow.md` contain three checks that must run whenever their stated
condition is met — Frontend Discovery (frontend features outside the type skip-list), Seed
Alignment Check, and Backlog Impact Check. Do not read past them on the way to PHASE 2's machine
contract; each either produces a section in the gate plan file or is silently skipped for a stated
reason.

> **Todo — before writing the plan file (Step 4b):** for each of the three checks, confirm you can
> cite a concrete outcome — a real finding (e.g. "found existing SettingsPanel.tsx pattern"), a real
> "no drift"/"no impact" comparison against the actual seed/backlog content you read, or an explicit
> skip reason tied to the feature's type/fields. **Name the file path you actually read this turn**
> for each non-skip outcome (`frontend-discovery.md` Reuse-Discovery, `shared/SEED.md` § Alignment
> Check, `shared/BACKLOG.md` § Impact Check) — a process-trail value of "run" with nothing citable
> behind it, or citing a file not opened this turn, is not permitted — write "n/a: {reason}" instead
> of fabricating a pass.
>
> **Hard check**: before writing "run" for any of the three, confirm a `Read` (or the matching script
> call) on that exact file already appears earlier in this turn's transcript. If it doesn't, the
> citation MUST read `n/a: skipped this run` — never write "run" from memory of what the check usually
> finds. **Before writing "n/a" for Frontend Discovery or the Seed Alignment Check specifically**,
> confirm the objective skip condition actually holds — Frontend Discovery: current feature `type` is
> in `COMPONENT/INTEGRATION/THEME/A11Y/PERF/INFRA/DOCS`; Seed Alignment: `requirements.length < 4 AND
durableDecisions == 0 AND clarifications == 0`. If the condition does NOT hold, the check is
> mandatory — go back and run it; a self-authored reason ("bugfix, no drift") is not a valid n/a.

Then continue **in plan mode** to Step 3 (classify) and Step 4 (technique plan), back in
`phase-0-define-classify.md`, then Step 4b below (the gate). Do not end the skill.

## Step 4b — Plan-approval gate — the go/no-go before build (only when `defineNeeded`)

The single human go/no-go for the whole run, and the point where `feature.json` is **written** — not
before. We are **already in plan mode** (entered at Step 2b), so there is no `EnterPlanMode` here.
Define authored the complete draft in memory, Step 3 added `verificationProfile`, Step 4 derived the
technique plan. Now the draft becomes the plan-file appendix, the user **accepts**, and only then does
the extract write `feature.json` + run the sync. This is dev-ship's own consolidated gate — one review
surface for the whole plan. It always runs (no env-var opt-out).

> **`defineNeeded == false`** (Step 1 DEFINED branch) → **skip this whole step**: `feature.json`
> already exists (a prior run accepted the gate), no plan mode was entered, nothing to re-approve.
> Go straight to Step 5.

**De-escalation check** (before writing the plan file) — evaluate the completed in-memory draft
against `shared/TWEAK-DISCIPLINE.md § Size gate` criteria 1-4: file span from `files[]` (> 3 →
fires), net-new surface from `type`/`architecture` (adds capability vs adjusts existing → fires), new
test surface from `tests` (a new test file/harness → fires), architecture from `architecture` (a
shared layer/interface/config consumed by > 2 modules, or a cross-cutting rename → fires). Criteria 5
and 6 don't apply here (5 needs a live backlog scan; 6 is fail-class and never reaches define). None
of the four fires → the feature is **tweak-sized**; the plan file's closing line below gains a fourth
outcome, and `ExitPlanMode`'s Accept becomes a conscious override rather than the default path. This
is a fresh read of the draft each time Step 4b runs (including on a Reject revise-loop pass) — cheap
and deterministic, never cached across passes.

> **Hard check** (same pattern as the Discovery/Seed/Backlog citations below): before writing the
> plan file, confirm the REQ-checklist (`dev-define/workflow.md` PHASE 1b), the "Architecture
> designed: N files, K build steps." line, and the Baseline/Seed/Backlog close-out block (both
> PHASE 2) each already appear as their own chat message earlier this turn. Folding any of them
> only into the plan-file draft does not satisfy that gate — missing one → stop, emit it now as
> its own message, then continue.

**Steps:**

1. **Write the plan file** (path from Step 2b) — two parts, per `dev-define/workflow.md` PHASE 2:
   - **Review surface** — a concise, readable summary: feature name + type + one-line intent;
     `requirements[]` with their `acceptance[]` scenarios (`when → then`); architecture /
     `buildSequence` + key interfaces; **for visual features the ASCII wireframe + states** (this is
     the design review — it replaces the removed inline sketch-confirm); the Step 3 "Verification
     profile" line (~N auto, ~N manual); the auto-derived technique plan (`refactorLenses`,
     `securityDeep` scanners, or "security off"); a **process-trail line** — `Discovery: run ({file}) → {1-line
finding or "no reuse candidates"} | n/a: {reason} · Seed check: run ({file}) → {1-line drift result or "no
drift"} | n/a: {reason} · Backlog impact: run ({file}) → {1-line impact result or "no impact"} | n/a:
{reason}` — the `({file})` slot echoes the exact path the Hard check above just verified was Read
     this turn (`frontend-discovery.md` / `shared/SEED.md` / `shared/BACKLOG.md`) — never blank, never
     a file not opened this turn. Each check cites its actual outcome, not just the word "run", so a
     skipped-with-reason check is visible at the gate and a fabricated pass is structurally harder to
     write. Then any
     **proposal sections** the draft carries,
     each with its default action stated (accept applies it; reject-feedback can drop just that one):
     `## Proposed seed update` (from the Seed Alignment Check), `## Backlog impact` (obsoleted/adjusted
     cards from the Backlog Impact Check), `## Pages to seed` (frontend PAGE-seeding candidates), and
     on a split `## Feature split` (clusters + build order). **When the de-escalation check above found
     the draft tweak-sized**, add one line naming it: `Tweak-sized: {N} files, no net-new surface — a
/dev-tweak handoff is available below.` Close with:
     "Accept → build starts (PHASE 1); the proposals above are applied. Reject → back into the define
     interview to revise (tell me what to change)." — and, **only on a tweak-sized draft**, a third
     line: "De-escalate → hand off to `/dev-tweak` instead (recommended)."
   - **`## Appendix — machine contract (skip review)`** — the complete `featureDraft` (incl.
     `verificationProfile`) as a single ```json block, **compact single-line JSON (no indentation)** —
     halves the token cost of the plan-file echo. This is what the extract reads on Accept.
     **Second-opinion hook (between the plan-file write and `ExitPlanMode`)**:
     - **PHASE 1b already spawned a consult in the background** (`secondOpinionSpawned` set,
       `dev-define/workflow.md § PHASE 1b`) — collect its digest here (it has had the whole PHASE
       1c/PHASE 2 stretch to complete). Show it, fold DISAGREE items into the review surface
       (attended: re-present the choice; unattended: Opus weighs it against the pre-registered
       position and revises or confirms), and carry the outcome to the PHASE 5 report's `Consult:`
       row. If a cited factual error survives, spawn round 2 per `shared/SECOND-OPINION.md § Mode`
       before finalizing.
     - **Otherwise**, only when `secondOpinionSignal` was noted (PHASE 2's cross-cutting-
       architecture bookkeeping) and the per-run backstop isn't exhausted:

       > **Todo**: Read `.claude/skills/shared/SECOND-OPINION.md` and follow it — the trigger
       > auto-fires the consult agent (no confirm step) with INPUT = the plan file just written +
       > dependency `feature.json` paths (define-gate row of § Brief contents). Show the digest,
       > fold DISAGREE items into the review surface before exiting (attended: re-present the
       > choice; unattended: Opus weighs it and revises or confirms), and carry the outcome to the
       > PHASE 5 report's `Consult:` row.

2. **`ExitPlanMode`** to present it for approval (this exits plan mode; the session returns to its
   prior permission mode).
   - **Accept** — **on a tweak-sized draft, this is the conscious override** (§ De-escalation gate
     (b) in `shared/TWEAK-DISCIPLINE.md`): carry `De-escalation overridden: tweak-sized ({N} files, no
net-new surface)` into the PHASE 5 report. On a non-tweak-sized draft this note doesn't apply —
     proceed as below unchanged. → writes are allowed again; run define's hoisted PHASE 3+4 now:
     (a) `node ~/.claude/scripts/feature-from-plan.js <plan-file> .project/features/{feature}/feature.json`
     writes `feature.json` from the appendix;
     (b) run define's PHASE 4 sync (backlog `status: "DEFINED"` with `auto: true`, plus project.json
     and project-context.json — per `dev-define/references/phase4-sync.md`; for Tauri/desktop projects
     the project.json **endpoint** sync no-ops), **applying the plan-file proposals** the user did not
     reject: seed update, backlog-impact mutations, PAGE-seeding, and — on a split — the `00-split.md`
     write + sub-feature `mkdir`s (all deferred out of plan mode to here);
     (c) re-set `transition: "shipping"` (Step 2a) and rewrite the live signal **without** the
     `waiting` field (`echo '{"skill":"define"}' | node ~/.claude/scripts/ship-checkpoint.js signal {feature}`).
     Then continue to Step 5 → Step 6 → build (back in `phase-0-define-classify.md`).
   - **Reject** → the session **stays in plan mode** with the user's feedback (native plan-mode
     behaviour — no re-`EnterPlanMode`). Revise the in-memory draft, **re-asking only what the
     feedback touches** (e.g. reopen one design fork, adjust one requirement) — do not re-run the whole
     interview. Re-run Step 3 (reclassify) + Step 4 (re-derive) if the change affected them, rewrite
     the plan file, and `ExitPlanMode` again. Loop until accepted (mirrors the same
     plan-rejection-revises pattern used throughout the debug rounds — `debug-round.md`,
     `debug-round-heavy.md`). If the feedback disputes the architecture itself (not wording) and
     no consult ran this run, the "plan rejected at gate" trigger fires — run the Second-opinion
     hook above before the next `ExitPlanMode`.
   - **Abort (park the whole feature — a decision _not to build_, distinct from Reject)** → the
     interview or the gate can legitimately end in "don't build this now" (scope grew, priorities
     changed). This is a terminal outcome, **not** a revise-loop. If the user's reason is about
     _ordering_ rather than "don't build" ("wrong order", "another feature first", "split this"),
     Read `.claude/skills/dev-ship/references/define-park.md § 1` and offer the Swap/Split outcomes
     instead of the plain park below — its § 4 cleanup is these same four steps. Otherwise,
     `ExitPlanMode` to leave plan mode, then revert Step 2a's bookkeeping (nothing was built and no
     `feature.json` was written, but the pre-plan-mode writes orphan otherwise — a stale board badge
     and a spurious resume into `PHASE 0 · define` on the next `/dev-ship {feature}`):
     1. `node ~/.claude/scripts/ship-checkpoint.js signal-clear {feature}` — clears the board badge.
     2. `rm -f .project/session/ship-{feature}.json` — removes the init checkpoint (no green
        completion, no resume intended).
     3. `rmdir .project/features/{feature}` — the dir is empty (no `feature.json`).
     4. In `backlog.json`, strip `transition: "shipping"` from the card, leaving `status` at its
        prior value (normally `TODO`); add a `note` recording why it was parked (and any context
        the interview established) so a later pickup keeps the context — see `shared/BACKLOG.md
§ Park notes`.

     Then **stop** — do not continue to Step 5.

   - **De-escalate (hand off to `/dev-tweak` — only offered when the de-escalation check above found
     the draft tweak-sized)** → § De-escalation gate (a) in `shared/TWEAK-DISCIPLINE.md`. `ExitPlanMode`
     to leave plan mode, then revert Step 2a's bookkeeping using **the same four steps as Abort above**
     (signal-clear, remove the init checkpoint, `rmdir` the empty feature dir, strip `transition:
"shipping"` from the backlog card) — no `note` this time (this isn't a park; the tweak run picks
     the card up next, not a later `/dev-ship` re-invoke). No `feature.json` was written — the draft
     itself dies here, exactly as on Abort, but not its content: carry the in-memory draft's
     `files[]` and `acceptance[]` into the handoff message, not just the card name — this is the
     only copy of them that will ever exist; losing them here means the tweak run re-locates from
     scratch and re-verifies with no requirement contract, which can leave it worse off than
     Accept would have. Then invoke `/dev-tweak {feature-name}`, passing the card's **exact
     name** plus that `files[]`/`acceptance[]` pair (per `shared/TWEAK-DISCIPLINE.md
§ De-escalation gate` (a)). Then **stop** — do not continue to Step 5; the tweak run reports its
     own outcome.

**Resume note.** Same-session interruption between Step 2b and Accept: just continue (plan mode + the
plan file persist in the session). Cross-session death re-runs the interview — see Step 0's
`PHASE 0 · define` case above for why. Once Accept writes `feature.json`, that file is the durable
home and Step 5's checkpoint patch makes the rest resumable normally.
