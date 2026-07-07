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

The ledger is already persisted (`manual-interview-walkthrough.md § Step E/F`). Before entering plan
mode:

1. Patch the checkpoint: `manual.round` incremented (starts at 1 on the first round).
2. Rewrite the live signal **with** `waiting: "fix-plan"` (main checkout, per the worktree caveat) —
   this must happen **now**, not after `EnterPlanMode`, because plan mode blocks the write and the
   board would otherwise show "running" while it is actually blocked on the round-gate design work.

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

No extraction script — the appendix JSON was authored this same plan-mode session, so the
orchestrator parses it directly (a resume that lands back in the gate simply re-plans instead).
On accept:

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
- **Substantial new finding, or still failing** → append to the ledger and go back to
  `§ Hoisted bookkeeping` for a new round.
- **Escalation**: after **2** failed dispatch rounds on the same item, do not start a third identical
  round — Read `shared/DEBUG-LADDER.md` and pull that item into **tier 2 in the main chat** (the app
  is running; confirming the root cause here is cheap), and only if that also fails, tier 3
  `/dev-debug {feature}`. Other items in the ledger are unaffected and keep progressing normally.

Once every item is Pass (or explicitly Skip/Defer) and no round is in flight, return to
`phase-3-manual-finalize.md § Regression re-check`.
