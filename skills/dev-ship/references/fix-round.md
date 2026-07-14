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
   and how it will be verified (repro test for TESTABLE, live re-check for MEASURABLE). Finding
   implicates an external library API? Research it per `shared/CONTEXT7.md` now — both tools work
   inside plan mode — and fold the results into the fix approach. Skip for purely internal logic.

   A finding whose root cause is still unclear after reviewing the ledger evidence does **not** get a
   guessed fix: run `references/debug-round.md` Steps 4–5 (Explore investigation + research) for that
   finding inside this same plan-mode session, then design its fix from that evidence. This is the
   same machinery the § Re-check ladder escalates to on a first batch-fix failure — here it runs
   proactively, before a first guess is even attempted.

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
- **`## Appendix — machine contract (skip review)`** — one ```json block, authored as **compact
  single-line JSON (no indentation)** — halves the token cost of the plan-file echo. Shape (shown
  pretty-printed here for readability only):
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
   same exit, so go straight to step 3 below's plain `signal` rewrite (drop only the `waiting` key —
   this is NOT the `signal-clear` subcommand, which would wrongly park the board mid-dispatch). (On a
   round 2+ gate, both writes already happened in `§ Hoisted bookkeeping` — skip this step.)
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

This re-check covers the **first-ever** fix attempt for each item (the batch dispatch above, which
can cover several findings from the same walkthrough in one gate — that batching is the reason a
plain fix-round exists at all: don't park once per finding). What happens next is a **deterministic
park-first ladder**, not a menu — the item's `debugTier` field (`manual.items[].debugTier`,
upserted the same way as the rest of the ledger) is the single progress marker; there is no
`failedRounds`-style repeat-count gate on this side of the ladder (dev-ship). `debugTier` moves
strictly forward: absent → `"light"` → `"heavy"` → resolved (accepted or parked-open) — see
`shared/DEBUG-LADDER.md` for the full tier table (dev vs. game — game-ship keeps its own
`failedRounds`-based ladder unchanged).

**Before judging Pass/Cosmetic/Otherwise below**, apply `shared/FEEDBACK-CATEGORIZATION.md § Scope
check` — split off anything not about this item's own `expected` text into its own ledger item first
(dev-ship mechanics: `manual-interview-walkthrough.md § Step D`).

- **Pass** → update `manual.items[].verdict` to `"pass"`; done with this item.
- **Cosmetic tweak, and it's the only finding still open this round** (MEASURABLE, obvious, ≤1-2
  files — the same skip-condition `dev-verify/references/fix-loop.md § Plan-mode gate` uses, plus
  "no other open finding this round is `fail`-class": a tweak riding along with a real bug does
  **not** get the free-standing loop below — it falls through to the Otherwise bullet like any other
  fail-adjacent item) → an inline **polish loop**, capped at 3 attempts (mirrors
  `dev-verify/references/fix-loop.md § PHASE 5b`'s own "max 3, then ask" precedent, and
  `shared/DEBUG-LADDER.md`'s hard rule that a failed round is proof the working hypothesis was
  wrong — don't keep retrying blind past the cap): no gate, no plan mode. Per attempt: apply the
  change live in the worktree, reload, ask the user to confirm. After each attempt, patch the
  ledger item's `tweakAttempts` (increment, starts at 1) via `ship-checkpoint.js item` — this is
  **not** a park (`debugTier` stays unset, the live signal keeps `waiting: "manual-tests"`), but it
  durably records a tweak is in progress, so a crash mid-loop leaves a marker instead of losing all
  trace of it. **On a resume landing back on this item** (`phase-3-manual-finalize.md § Resume
entry` bullet 5 — no verdict, no `debugTier` set, dispatch already complete), read the existing
  `tweakAttempts` first and continue counting from there — never reset to 1, or a crash/`/clear`
  becomes a way to dodge the cap.
  - Satisfied at attempt ≤3 → clear `tweakAttempts`, `verdict: "pass"`, done.
  - Still not right after 3 attempts → stop looping — this is now evidence the MEASURABLE/≤1-2-file
    classification was wrong, not a reason to keep guessing. `AskUserQuestion` — header: "Tweak not
    converging", question: "This hasn't landed after 3 tries — {title}. What next?":
    1. **"Escalate to root-cause analysis (Recommended)"** → clear `tweakAttempts`, then handle
       exactly as the Otherwise bullet below (fail-class park) — treat it as evidence this belongs
       in the debug ladder after all.
    2. **"Accept anyway"** → clear `tweakAttempts`, `verdict: "accepted"`, done — same semantics as
       the debug ladder's own terminal accept (`debug-round-heavy.md § 8`), reachable directly here
       since forcing two more tiers on something the user is already fine leaving as-is would be
       wasted effort.
- **Anything else that's tweak-class AND every other open finding this round is also tweak-class**
  (never when any open finding is `fail`-class — see the Fail-never-to-todo policy in
  `phase-3-manual-finalize.md § Findings ledger + routing`) → one `AskUserQuestion`, the only choice
  point on this path:
  1. **"Park — debug in a fresh chat"** (recommended) → same park mechanics as below.
  2. **"Defer to backlog todo"** → route each remaining finding to `/project-todo`, then proceed to
     the regression re-check and completion on the verified scope.
- **Otherwise (any `fail`-class finding, or any tweak — substantial or cosmetic — with a `fail`
  sibling this round)** → always park, no question asked:
  1. Patch the ledger item: `debugTier: "light"`, and clear `tweakAttempts` if it was set from an
     escalated tweak loop above (via `ship-checkpoint.js item {feature} manual` — this write happens
     outside plan mode, we're back in the main-chat re-check step, not the gate).
  2. `node ~/.claude/scripts/ship-checkpoint.js signal-clear {feature}`.
  3. Print a park/handoff message (own wording — do NOT reuse `SKILL.md § PHASE 1–4`'s
     manual-items-remain template; its "you land directly in the item-by-item manual round" line is
     wrong here): state which item(s) parked and why (fail / tweak-with-fail-sibling), that
     `/dev-ship {feature}` resumes straight into the debug round for those items (not the manual
     walkthrough), and that the board shows this run as parked (⏸). **End the turn.**
  4. A fresh session resumes via `phase-3-manual-finalize.md § Resume entry`'s `debugTier: "light"`
     branch, landing directly in `references/debug-round.md` for this item. Other items in the ledger
     are unaffected and keep progressing normally (a later resume walks each open item to wherever its
     own `debugTier` says it is).

`debug-round.md` (light) and `debug-round-heavy.md` own their **own** re-check + escalation from
here — a light-round failure parks itself straight to `debugTier: "heavy"` (no return trip through
this section), and a heavy-round failure is the hard ceiling (accept-or-park, no further tier). This
section only ever fires once per item, for the initial batch attempt.

Once every item is Pass (or explicitly Skip/Defer/Accepted) and no round is in flight, return to
`phase-3-manual-finalize.md § Regression re-check`. If the scope check split off a new item that
hasn't been through a round-gate pass yet, that item is not yet resolved — return to `§ Round gate`
for it instead.
