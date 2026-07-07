# Debug Round — in-ship root-cause investigation (game-ship PHASE 3)

Loaded from `fix-round.md`, either proactively (§ Round gate, a finding whose root cause is still
unclear after reviewing the ledger evidence) or as the ladder's tier-2 escalation (§ Re-check,
`failedRounds >= 2`). This is `game-debug` PHASES 2–6 inlined lightweight for **exactly one ledger
item**: an Explore investigation, Context7 research, and a single evidence-backed fix plan — no
3-strategy fan-out (this item's scope and evidence are already narrow by construction; `game-debug`'s
own PHASE 5 triage gate skips the fan-out under the same condition). It runs inside the same
plan-mode session as its caller — no separate `EnterPlanMode` unless one hasn't started yet.

## 1. Entry

Exactly one failing ledger item, plus its round history: prior fix attempts from
`playtest.fixPlan`/`playtest.dispatch` notes, the re-check observations that followed each attempt,
and the Step-D evidence captured during the playtest interview walkthrough (DebugListener output,
editor Output-log lines, `push_error` messages). This is the input a fresh hypothesis needs — do not
re-ask the user anything already in the ledger.

## 2. Bookkeeping before plan mode

Reuse the existing `waiting: "fix-plan"` signal — no new signal vocabulary. Apply the same hoisted-write
rule as `fix-round.md § Hoisted bookkeeping`: if plan mode is not yet active for this session, write
the live signal now, before `EnterPlanMode`; if already in plan mode (arriving from the § Round gate
proactive path), the write is deferred to this file's own completion step (7/8) alongside the other
deferred writes.

## 3. Enter plan mode

`EnterPlanMode` per `shared/PLAN-MODE.md § Entry` — skip if a plan-mode session is already active (the
common case: this file is loaded from inside `fix-round.md`'s own plan-mode session).

## 4. Investigation

Spawn one Explore agent (`subagent_type="Explore"`, `thoroughness="very thorough"`) to investigate in
an isolated context — keeps script/scene reads and git output out of the main session. Use
`.claude/skills/game-debug/references/explore-agent-prompt.md` as the prompt template, but fill its
placeholders from the ledger instead of a fresh PHASE 0/1 intake:

- `DEBUG_CONTEXT` → the STACK_CONTEXT/PROJECT_CONTEXT already loaded this verify session, plus this
  item's category (TESTABLE/MEASURABLE) and the scenes/scripts it touches.
- `PROBLEM` → the item's title, steps, observed vs expected, and the round history from Step 1 above
  (prior attempts + why they didn't hold).

Parse only the `INVESTIGATION_START…END` block — the compact findings, not the raw reads.

## 5. Root cause + Context7

Form the root-cause hypothesis from the investigation digest, following `shared/DEBUG-LADDER.md`'s
evidence-first discipline (state the hypothesis, name the confirming evidence, don't guess-and-check).

Finding implicates an external library/addon API? Research it per `shared/CONTEXT7.md` now — both
tools work inside plan mode. Skip when the root cause is purely internal logic (same condition as
`game-debug` PHASE 4).

## 6. Single evidence-backed fix plan

Write one fix plan for this item — no 3-agent fan-out. Append it to the same plan file `fix-round.md`
(or its caller) is already using, as its own section: problem → root cause → research → proposed fix →
verification. `ExitPlanMode` is the go/no-go for this plan (the same exit that closes whichever
plan-mode session this file was loaded inside — do not open a second one).

**Reject** → stay in plan mode, revise from the feedback, re-present, loop until accepted (same pattern
as `fix-round.md § Round gate`).

## 7. Execute

- **TESTABLE** → write a GUT reproduction test (RED), apply the fix, get it green — inline in the main
  chat for a small, single-file fix; dispatch one `ship-game-fix.js` single-group wave
  (`fix-round.md § Dispatch`) if the fix spans multiple files or is large enough to warrant an isolated
  context. Dispatched agents verify headless (GUT) — never launch `mcp__godot-mcp__run_project`
  (contract rule 8).
- **MEASURABLE** → apply the fix directly; no reproduction test, live re-check covers it.

Re-check via `playtest-interview-walkthrough.md` Steps B–E for this one item (no new interview close).

## 8. Still failing → tier 3 handoff

The debug round's own investigation-and-fix attempt failed too — this is the signal that the issue
needs `/game-debug`'s full machinery (reproduction test discipline, 3-strategy fan-out) rather than
another in-ship attempt. Patch the ledger item: `escalatedTo: "game-debug"`,
`playtest.pendingRound: true` (same `ship-checkpoint.js item {feature} playtest` upsert used
throughout this ledger), then `node ~/.claude/scripts/ship-checkpoint.js signal-clear {feature}`.
Print the park/handoff template from `SKILL.md § PHASE 1–4` with two resume commands, in order:
`/game-debug {feature}` first (to resolve this item), then `/game-ship {feature}` to resume the ship.
**End the turn.**

`game-debug` PHASE 0 reads the `escalatedTo` flag and pre-fills its intake from this item's evidence
(`game-debug/SKILL.md § PHASE 0`) — the user is not re-asked what they already reported here. On
completion, `game-debug` writes nothing to the ship checkpoint; the `/game-ship {feature}` resume
re-checks this item via `phase-3-playtest.md § Resume entry`'s `escalatedTo` handling instead of
designing a new fix.
