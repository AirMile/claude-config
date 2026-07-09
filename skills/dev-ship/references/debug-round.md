# Debug Round — Light (dev-ship PHASE 3, tier 1)

Two entry points:

- **Primary** — loaded from `fix-round.md § Re-check` when an item's first batch fix attempt still
  fails (any `fail`-class finding, or a `fail`-sibling tweak) — always via a **parked resume**
  (`debugTier: "light"` set before the park, read by `phase-3-manual-finalize.md § Resume entry`).
  This is the common path.
- **Proactive** — loaded from `fix-round.md § Round gate` point 1, **Steps 4–5 only**, when a
  finding's root cause is still unclear before a first fix is even designed. This runs **inline**,
  inside the round gate's own already-open plan-mode session — no park, because there's no failed
  attempt yet to escalate from; it's evidence-gathering for the _first_ fix design.

This file is the ship's lightweight version of full root-cause investigation for **exactly one
ledger item**: an Explore investigation, Context7 research, and a single evidence-backed fix plan —
no 3-strategy fan-out (this item's scope and evidence are already narrow by construction; the fan-out
is reserved for the heavy tier, `debug-round-heavy.md`, if this round's fix doesn't hold).

## 1. Entry

Exactly one failing ledger item, plus its round history: the first fix attempt's notes
(`manual.fixPlan`/`manual.dispatch`), the re-check observations that followed, and the Step-D
evidence captured during the interview walkthrough (console errors, network responses, screenshots).
This is the input a fresh hypothesis needs — do not re-ask the user anything already in the ledger.

## 2. Bookkeeping before plan mode

Reuse the existing `waiting: "fix-plan"` signal — no new signal vocabulary.

- **Primary entry** (parked resume, plan mode not active yet in this fresh session): write the live
  signal now, before `EnterPlanMode`.
- **Proactive entry** (already inside the round gate's plan-mode session): the write is deferred to
  this file's own completion step (§ 7/8) alongside the other deferred writes, same as
  `fix-round.md § Hoisted bookkeeping`'s "already in plan mode" case.

## 3. Enter plan mode

`EnterPlanMode` per `shared/PLAN-MODE.md § Entry` — skip if a plan-mode session is already active
(the proactive-entry case, arriving from inside `fix-round.md`'s own plan-mode session). On a
primary (parked-resume) entry this is essentially always a fresh `EnterPlanMode` call.

## 4. Investigation

Spawn one Explore agent (`subagent_type="Explore"`, `thoroughness="very thorough"`) to investigate in
an isolated context — keeps source reads and git output out of the main session. Use
`.claude/skills/dev-ship/references/debug-explore-agent-prompt.md` as the prompt template, filling
its placeholders from the ledger:

- `DEBUG_CONTEXT` → the STACK_CONTEXT/PROJECT_CONTEXT already loaded this verify session, plus this
  item's `manualReason` and category (TESTABLE/MEASURABLE).
- `PROBLEM` → the item's title, steps, observed vs expected, and the round history from § 1 above
  (prior attempts + why they didn't hold).

Parse only the `INVESTIGATION_START…END` block — the compact findings, not the raw reads.

## 5. Root cause + Context7

Form the root-cause hypothesis from the investigation digest, following `shared/DEBUG-LADDER.md`'s
evidence-first discipline (state the hypothesis, name the confirming evidence, don't guess-and-check).

Finding implicates an external library API? Research it per `shared/CONTEXT7.md` now — both tools work
inside plan mode. Skip when the root cause is purely internal logic.

**Proactive-entry callers stop here** — `fix-round.md § Round gate` continues designing the fix from
this evidence itself; §§ 6–8 below apply only to the primary (parked) entry.

## 6. Single evidence-backed fix plan

Write one fix plan for this item — no 3-agent fan-out. `ExitPlanMode` is the go/no-go.

**Reject** → stay in plan mode, revise from the feedback, re-present, loop until accepted.

## 7. Execute

- **TESTABLE** → write a reproduction test (RED), apply the fix, get it green — inline in the main
  chat for a small, single-file fix; dispatch one `ship-fix.js` single-group wave
  (`fix-round.md § Dispatch`) if the fix spans multiple files or is large enough to warrant an
  isolated context.
- **MEASURABLE** → apply the fix directly; no reproduction test, live re-check covers it.

## 8. Re-check → 3-path verdict

Re-check via `manual-interview-walkthrough.md` Steps B–E for this one item (no new interview close).

- **Pass** → clear the item's `debugTier`, set `verdict: "pass"`. Return to
  `fix-round.md § Re-check` for any remaining items, or straight to the regression re-check if this
  was the last open item.
- **Cosmetic tweak surfaces** (MEASURABLE, obvious, ≤1-2 files) → inline polish loop right here —
  no park, no new tier. Same skip-condition as `fix-round.md § Re-check`'s cosmetic branch.
- **Still failing, or a substantial new finding** → this light round's one evidence-backed attempt
  didn't hold — escalate to the heavy tier:
  1. **Before parking**, write this round's evidence to the ledger item — a park ends the session, so
     nothing held only in-context survives it. Patch the item: `debugTier: "heavy"`, and
     `lightRoundNotes` (a compact string): the § 4 investigation digest's key lines (error location,
     root code, pitfall match), the § 5 hypothesis and its confirming/refuting evidence, the fix
     applied, and what the § 8 re-check actually observed. This is the only thing the heavy round has
     to go on — write it as if handing the case to someone who wasn't in this session.
  2. `node ~/.claude/scripts/ship-checkpoint.js signal-clear {feature}`.
  3. Print the park/handoff template (`SKILL.md § PHASE 1–4`) with `/dev-ship {feature}` as the
     resume command. **End the turn.**
  4. A fresh session resumes via `phase-3-manual-finalize.md § Resume entry`'s `debugTier: "heavy"`
     branch, landing directly in `references/debug-round-heavy.md`, which reads `lightRoundNotes`
     instead of re-running Explore (`debug-round-heavy.md § 4`).
