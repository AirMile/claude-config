# Fix Round — round-level plan gate + dispatch (dev-ship PHASE 3)

Loaded from `phase-3-manual-finalize.md § Findings ledger + routing` when the ledger has more than a
couple of obvious cosmetic tweaks. Mirrors PHASE 0's define gate: bookkeeping is hoisted before plan
mode, the round's fix **design** runs inside plan mode (Opus, under an `opusplan`-style router),
`ExitPlanMode` is the single go/no-go, and execution (dispatch) runs after, on the execution model
(Sonnet). Unlike PHASE 0, the input here — the findings ledger — is already durable on the
checkpoint before this file is even read, so a cross-session death during the gate loses only the
in-progress plan draft, never the walkthrough's work.

This file owns everything from "the ledger needs a real fix round" through "every finding is
resolved or explicitly deferred," then returns to `phase-3-manual-finalize.md` for the regression
re-check.

## § Hoisted bookkeeping (before plan mode)

The ledger is already persisted (or, on the round-1 path below, still in memory — see the two cases).
Before entering plan mode, check whether a plan-mode session is **already active** (the same check
`§ Round gate`'s `EnterPlanMode` uses — an active plan-mode system-reminder):

- **Not in plan mode yet** (round 2+ re-entry after `§ Re-check`, or a cross-session resume landing
  directly in this gate) → execute both writes now: patch the checkpoint `manual.round` incremented
  (starts at 1 on the first round), and rewrite the live signal **with** `waiting: "fix-plan"` (main
  checkout, per the worktree caveat) — this must happen **now**, not after `EnterPlanMode`, because
  plan mode blocks the write and the board would otherwise show "running" while it is actually
  blocked on the round-gate design work.
- **Already in plan mode** (round 1, arriving straight from the interview walkthrough's own plan-mode
  session — `manual-interview-walkthrough.md § Step A3`) → both writes are blocked (they are disk
  writes; plan mode blocks `.project/` and the live signal alike). Defer them to `§ Accept →
extraction` below. The board keeps showing `waiting: "manual-tests"` for the duration of the gate —
  acceptable, since the gate itself is short and this `ExitPlanMode` is the same one that closes the
  interview's plan mode (`phase-3-manual-finalize.md § Findings ledger + routing`).

## § Round gate (plan mode)

`EnterPlanMode` per `shared/PLAN-MODE.md` Entry — **skip if already in plan mode** (an active
plan-mode system-reminder already exists); note the plan-file path either way.

Inside plan mode, design the **complete round plan** — this is the thinking-block the gate exists to
protect:

1. **Per finding**: read the relevant code (read-only work is fine in plan mode) to form a root-cause
   hypothesis, following `shared/DEBUG-LADDER.md`'s evidence-first discipline; record the fix
   approach, the finding's category (TESTABLE/MEASURABLE, per `shared/FEEDBACK-CATEGORIZATION.md`),
   and how it will be verified (repro test for TESTABLE, live re-check for MEASURABLE).
2. **Group findings into file-disjoint groups** — two findings share a group only if grouping them
   doesn't help; two findings that touch overlapping files **must** be grouped together (a single
   agent/inline session should never race another over the same file).
3. **Order groups into waves** — groups with no file overlap across the whole wave run in the same
   wave (parallel); a group overlapping an earlier group's files goes in a later wave (sequential
   after it).
4. **Per group, decide dispatch**: `inline` (small MEASURABLE finding(s), fixed live in the main chat
   while dispatch runs) or `agent` (everything else — TESTABLE fixes, multi-file groups, or anything
   large enough to benefit from not consuming main-chat context). **Hard rule**: every `inline` group
   must be file-disjoint from **every** `agent` group in the same round — they all run in the same
   worktree concurrently, so this is the parallel-safety contract, not just an optimization.

Write the plan file (path from `EnterPlanMode`):

- **Review surface** — per finding: what/why, the proposed fix, how it'll be verified; then the wave
  table (wave → groups → dispatch → files).
- **`## Appendix — machine contract (skip review)`** — one ```json block:
  ```json
  {
    "round": 1,
    "findings": [
      {
        "id": "f1",
        "title": "…",
        "category": "TESTABLE",
        "rootCause": "…",
        "fix": "…",
        "verify": "…",
        "files": ["src/…"],
        "screenshot": ".project/session/…"
      }
    ],
    "groups": [
      {
        "id": "g1",
        "findingIds": ["f1"],
        "files": ["src/…"],
        "dispatch": "agent"
      }
    ],
    "waves": [["g1"], ["g2"]]
  }
  ```

`ExitPlanMode` to present it. **Reject** → the session stays natively in plan mode (no
re-`EnterPlanMode`) with the user's feedback; revise only what the feedback touches, rewrite the plan
file, `ExitPlanMode` again — loop until accepted (mirrors PHASE 0's gate-reject pattern).

## § Accept → extraction

No extraction script — the appendix JSON was authored this same plan-mode session, so the main chat
parses it directly (a resume that lands back in the gate simply re-plans instead). On accept:

0. **If this gate ran inside the interview's own plan-mode session** (the deferred case from
   `§ Hoisted bookkeeping` above) — do the deferred writes first, in one batch, right after this
   `ExitPlanMode`: the walkthrough's batch persist
   (`manual-interview-walkthrough.md § Step E, Batch persist`) and the deferred `manual.round`
   increment. Skip the `waiting: "fix-plan"` live-signal write — the gate already resolved with this
   same exit, so go straight to step 3 below's `waiting`-clear. (On a round 2+ gate, both writes
   already happened in `§ Hoisted bookkeeping` — skip this step.)
1. Patch the checkpoint: `manual.fixPlan` = the appendix object.
2. For every `agent`-dispatch group, write one rich descriptor file to
   `.project/session/ship-prompts/{feature}-fix-{groupId}.txt` — that group's findings (title, steps,
   observed, expected, screenshot path, element pointer, root cause, fix approach, verification step),
   the worktree path, and pointers (paths, never bodies) to `references/prompts/fix.md`,
   `non-interactive-contract.md`, and `shared/DEBUG-LADDER.md`.
3. Rewrite the live signal **without** `waiting` (the gate is resolved; work resumes).

## § Dispatch

Launch:

```js
Workflow({
  scriptPath: ".claude/skills/dev-ship/references/workflows/ship-fix.js",
  args: { feature, worktreePath, waves /* [[{id, promptPath}], …] */, resume },
});
```

Immediately patch the checkpoint: `activeWorkflow: "phase3fix"`, `workflowRunId` (from the tool
result), `prompts.fixGroupPromptPaths` (write point 2, same as the other workflow launches).

While the workflow runs, fix the `inline`-dispatch groups in the main chat: apply the change in the
worktree, reload, get a live re-check from the user. These groups are file-disjoint from every agent
group (enforced at gate time), so there is no collision running both at once.

On return: merge `ship-fix.js`'s `{groups, allFixed}` into checkpoint `manual.dispatch`; clear
`activeWorkflow`/`workflowRunId`/`prompts`.

**Fallback** (Workflow tool unavailable): spawn one `general-purpose` Task per `agent` group, wave by
wave (respecting the same parallel-within/sequential-across ordering), `model: "sonnet"`, and parse
each `SHIP_FIX_RESULT_START … SHIP_FIX_RESULT_END` block (same schema as the workflow path).

## § Re-check

Rewrite the live signal **with** `waiting: "manual-tests"`. Walk **only the items/findings this
round touched** — Steps B–E of `manual-interview-walkthrough.md` (no new interview close; that only
runs once per full walkthrough).

- **Pass** → update `manual.items[].verdict` to `"pass"`; done with this item.
- **Trivial nitpick** surfaces (cosmetic MEASURABLE, obvious) → an inline **polish loop**: no gate, no
  plan mode, iterate directly in the main chat until the user is satisfied (this is the old
  Tweak/iterate-mode behaviour, now scoped specifically to post-dispatch polish — not a substitute for
  the round gate on anything substantial).
- **Substantial new finding, or still failing** → append it to the ledger now (this write happens
  outside plan mode — we are back in the main-chat re-check step, not the gate) via
  `ship-checkpoint.js item {feature} manual`, then present **one** `AskUserQuestion` rather than
  looping automatically — repeated rounds burn main-chat context fast, and the user should choose how
  to spend the next one:

  1. **"Park — continue in a fresh chat"** (recommended, _except_ after 2 failed rounds on this item
     — see Escalation, where Escalate becomes the recommended option instead). The ledger is already
     persistent: `node ~/.claude/scripts/ship-checkpoint.js signal-clear {feature}`, patch
     `manual.pendingRound: true`, print the park/handoff template from `SKILL.md § PHASE 1–4` with
     `/dev-ship {feature}` as the resume command, **end the turn**. A fresh session resumes via
     `phase-3-manual-finalize.md § Resume entry`'s `manual.pendingRound` bullet, landing directly in
     `§ Hoisted bookkeeping` for the next round (re-check already ran here — it does not re-run).
  2. **"Another round in this chat"** → go back to `§ Hoisted bookkeeping` for a new round (not in
     plan mode now, so its writes execute immediately, per the "not in plan mode yet" case there).
  3. **"Escalate — debug ladder"** → Read `shared/DEBUG-LADDER.md` and pull the item into **tier 2 in
     the main chat** (the app is running; confirming the root cause here is cheap), and only if that
     also fails, tier 3 `/dev-debug {feature}`. Other items in the ledger are unaffected and keep
     progressing normally.
  4. **"Defer to backlog todo"** — offered **only** when every open finding in this round is
     `tweak`-class (never when any is `fail` — see the Fail-never-to-todo policy in
     `phase-3-manual-finalize.md § Findings ledger + routing`): route each remaining finding to
     `/project-todo`, then proceed to the regression re-check and completion on the verified scope.

  **Escalation**: after **2** failed dispatch rounds on the same item, option 1's recommendation flips
  to option 3 — do not keep offering a third identical round as the default.

Once every item is Pass (or explicitly Skip/Defer) and no round is in flight, return to
`phase-3-manual-finalize.md § Regression re-check`.
