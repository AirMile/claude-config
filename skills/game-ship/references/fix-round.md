# Fix Round — round-level plan gate + dispatch (game-ship PHASE 3)

Loaded from `phase-3-playtest.md § Findings ledger + routing` when the ledger has more than a couple
of obvious cosmetic tweaks. Mirrors PHASE 0's define gate: bookkeeping is hoisted before plan mode,
the round's fix **design** runs inside plan mode (Opus, under an `opusplan`-style router),
`ExitPlanMode` is the single go/no-go, and execution (dispatch) runs after, on the execution model
(Sonnet). Unlike PHASE 0, the input here — the findings ledger — is already durable on the checkpoint
before this file is even read, so a cross-session death during the gate loses only the in-progress
plan draft, never the walkthrough's work.

This file owns everything from "the ledger needs a real fix round" through "every finding is resolved
or explicitly deferred," then returns to `phase-3-playtest.md` for the regression re-check.

## § Hoisted bookkeeping (before plan mode)

The ledger is already persisted (or, on the round-1 path below, still in memory — see the two cases).
Before entering plan mode, check whether a plan-mode session is **already active** (the same check
`§ Round gate`'s `EnterPlanMode` uses — an active plan-mode system-reminder):

- **Not in plan mode yet** (round 2+ re-entry after `§ Re-check`, or a cross-session resume landing
  directly in this gate) → execute both writes now: patch the checkpoint `playtest.round` incremented
  (starts at 1 on the first round), and rewrite the live signal **with** `waiting: "fix-plan"` (main
  checkout, per the worktree caveat) — this must happen **now**, not after `EnterPlanMode`, because
  plan mode blocks the write and the board would otherwise show "running" while it is actually
  blocked on the round-gate design work.
- **Already in plan mode** (round 1, arriving straight from the playtest walkthrough's own plan-mode
  session — `playtest-interview-walkthrough.md § Step A2`) → both writes are blocked (they are disk
  writes; plan mode blocks `.project/` and the live signal alike). Defer them to `§ Accept →
extraction` below. The board keeps showing `waiting: "playtest"` for the duration of the gate —
  acceptable, since the gate itself is short and this `ExitPlanMode` is the same one that closes the
  walkthrough's plan mode (`phase-3-playtest.md § Findings ledger + routing`).

## § Round gate (plan mode)

`EnterPlanMode` per `shared/PLAN-MODE.md` Entry — **skip if already in plan mode** (an active
plan-mode system-reminder already exists); note the plan-file path either way.

Inside plan mode, design the **complete round plan** — this is the thinking-block the gate exists to
protect:

1. **Per finding**: read the relevant scripts/scenes (read-only work is fine in plan mode) to form a
   root-cause hypothesis, following `shared/DEBUG-LADDER.md`'s evidence-first discipline; record the
   fix approach, the finding's category (TESTABLE/MEASURABLE, per
   `shared/FEEDBACK-CATEGORIZATION.md`), and how it will be verified — for TESTABLE, a GUT
   reproduction test; for MEASURABLE, a live re-check against the running game. Finding implicates an
   external library/addon API? Research it per `shared/CONTEXT7.md` now — both tools work inside plan
   mode — and fold the results into the fix approach. Skip for purely internal logic.

   A finding whose root cause is still unclear after reviewing the ledger evidence does **not** get a
   guessed fix: run `references/debug-round.md` Steps 4–5 (Explore investigation + research) for that
   finding inside this same plan-mode session, then design its fix from that evidence. This is the
   same machinery the § Re-check ladder forces after 2 failed rounds — here it runs proactively,
   before a first guess is even attempted.

2. **Group findings into file-disjoint groups** (scripts/scenes/resources/tests) — two findings share
   a group only if grouping them doesn't help; two findings that touch overlapping files **must** be
   grouped together (a single agent/inline session should never race another over the same file).
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
        "files": ["scripts/…"],
        "debugLog": ".project/features/{feature}/…"
      }
    ],
    "groups": [
      {
        "id": "g1",
        "findingIds": ["f1"],
        "files": ["scripts/…"],
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

0. **If this gate ran inside the walkthrough's own plan-mode session** (the deferred case from
   `§ Hoisted bookkeeping` above) — do the deferred writes first, in one batch, right after this
   `ExitPlanMode`: the walkthrough's batch persist
   (`playtest-interview-walkthrough.md § Step E, Batch persist`) and the deferred `playtest.round`
   increment. Skip the `waiting: "fix-plan"` live-signal write — the gate already resolved with this
   same exit, so go straight to step 3 below's `waiting`-clear. (On a round 2+ gate, both writes
   already happened in `§ Hoisted bookkeeping` — skip this step.)
1. Patch the checkpoint: `playtest.fixPlan` = the appendix object.
2. For every `agent`-dispatch group, write one rich descriptor file to
   `.project/session/ship-prompts/{feature}-fix-{groupId}.txt` — that group's findings (title, steps,
   observed, expected, debug-log path, root cause, fix approach, verification step), the worktree
   path, and pointers (paths, never bodies) to `references/prompts/fix.md`,
   `non-interactive-contract.md`, and `shared/DEBUG-LADDER.md`.
3. Rewrite the live signal **without** `waiting` (the gate is resolved; work resumes).

## § Dispatch

Launch:

```js
Workflow({
  scriptPath: ".claude/skills/game-ship/references/workflows/ship-game-fix.js",
  args: { feature, worktreePath, waves /* [[{id, promptPath}], …] */, resume },
});
```

Immediately patch the checkpoint: `activeWorkflow: "phase3fix"`, `workflowRunId` (from the tool
result), `prompts.fixGroupPromptPaths` (write point 2, same as the other workflow launches).

While the workflow runs, fix the `inline`-dispatch groups in the main chat: apply the change in the
worktree, re-run the affected GUT tests headless, get a live re-check from the user. These groups are
file-disjoint from every agent group (enforced at gate time), so there is no collision running both
at once. **No game window in a subagent** applies here too (contract rule 8) — the dispatched agents
verify headless (GUT), never launching `mcp__godot-mcp__run_project`.

On return: merge `ship-game-fix.js`'s `{groups, allFixed}` into checkpoint `playtest.dispatch`; clear
`activeWorkflow`/`workflowRunId`/`prompts`.

**Fallback** (Workflow tool unavailable): spawn one `general-purpose` Task per `agent` group, wave by
wave (respecting the same parallel-within/sequential-across ordering), `model: "sonnet"`, and parse
each `SHIP_FIX_RESULT_START … SHIP_FIX_RESULT_END` block (same schema as the workflow path).

## § Re-check

Rewrite the live signal **with** `waiting: "playtest"`. Re-launch the game window once and walk
**only the items/findings this round touched** — Steps B–E of `playtest-interview-walkthrough.md` (no
new interview close; that only runs once per full walkthrough).

- **Pass** → update `playtest.items[].verdict` to `"pass"`; done with this item.
- **Trivial nitpick surfaces, and no other open finding this round is failing** (cosmetic
  MEASURABLE, obvious — a nitpick riding along with another nitpick now shares this loop, one
  instance per finding — a nitpick riding along with a real failing item does **not** get the
  free-standing loop, it falls through to the Still-failing bullet below like any other finding this
  round) → an inline **polish loop**, capped at 3 attempts (mirrors `dev-verify/references/fix-loop.md`'s own max-3
  precedent, and `shared/DEBUG-LADDER.md`'s hard rule that a failed round is proof the working
  hypothesis was wrong — don't keep retrying blind past the cap): no gate, no plan mode, apply live,
  reload, ask the user to confirm. After each attempt, patch the item's `tweakAttempts` (increment,
  starts at 1) via `ship-checkpoint.js item {feature} playtest` — not a park, but it durably records a
  nitpick is in progress so a crash mid-loop leaves a marker instead of losing all trace of it. On a
  resume landing back on this item, read the existing `tweakAttempts` first and continue counting —
  never reset to 1.
  - Satisfied at attempt ≤3 → clear `tweakAttempts`, `verdict: "pass"`, done.
  - Still not right after 3 attempts → this is now evidence it wasn't actually trivial. Clear
    `tweakAttempts`, then handle exactly as the Still-failing bullet below — append to the ledger,
    increment `failedRounds`, and present that same `AskUserQuestion` ladder. Reusing the existing
    escalation ladder here (rather than a separate ask) means a nitpick that turns out to be a real
    bug gets the same park/retry/escalate/defer choices any other stuck item gets.
- **Still failing on its own `expected` text** (the scope check in
  `playtest-interview-walkthrough.md § Step D` already split off anything unrelated as its own
  ledger item) → append it to the ledger now (this write happens outside plan mode — we are back in
  the main-chat re-check step, not the gate) via `ship-checkpoint.js item {feature} playtest`,
  incrementing that item's `failedRounds` (starts at 0;
  the same upsert call — no script change) — this counter, not self-estimated confidence, drives the
  mechanical ladder below (`shared/DEBUG-LADDER.md`'s "every failed round escalates one tier" made
  literal). Then present **one** `AskUserQuestion` rather than looping automatically — repeated rounds
  burn main-chat context fast, and the user should choose how to spend the next one:

  **`failedRounds == 1`:**

  1. **"Park — continue in a fresh chat"** (recommended). The ledger is already persistent:
     `node ~/.claude/scripts/ship-checkpoint.js signal-clear {feature}`, patch
     `playtest.pendingRound: true`, print the park/handoff template from `SKILL.md § PHASE 1–4` with
     `/game-ship {feature}` as the resume command, **end the turn**. A fresh session resumes via
     `phase-3-playtest.md § Resume entry`'s `playtest.pendingRound` bullet, landing directly in
     `§ Hoisted bookkeeping` for the next round (re-check already ran here — it does not re-run).
  2. **"Another round in this chat"** → go back to `§ Hoisted bookkeeping` for a new round (not in
     plan mode now, so its writes execute immediately, per the "not in plan mode yet" case there).
  3. **"Escalate — debug round"** → Read `references/debug-round.md` and run it in full for this item
     (Explore investigation + Context7 research in plan mode + a single evidence-backed fix plan). Other
     items in the ledger are unaffected and keep progressing normally.
  4. **"Defer to backlog todo"** — offered **only** when every open finding in this round is
     `tweak`-class (never when any is `fail` — see the Fail-never-to-todo policy in
     `phase-3-playtest.md § Findings ledger + routing`): for each remaining finding, first judge its
     projected scope against `shared/TWEAK-DISCIPLINE.md § Size gate` criteria 1-4 (same judgment,
     same default-to-fastpath-on-a-close-call rule as
     `dev-ship/references/phase-3-manual-finalize.md § Offload flush` — criteria 5-6 don't apply
     pre-offload). **Within the gate** → route to `/project-todo` with no explicit type hint (plain
     inference lands on `POLISH`, same as a hand-typed "polish/juice/feel" description), patch
     `offload: "{card-name}"`, verdict stays `"tweak"`. **Exceeding the gate** → route to
     `/project-todo` naming the reason
     (`"{observed} → {expected}, parked from /game-ship playtest round (exceeds tweak size gate: {criterion})"`;
     inference then lands on `SYSTEM`/`MECHANIC`/`CONTENT` instead of `POLISH`),
     patch `offload: "{card-name}"`, verdict `"offloaded"` — a different card type and terminal
     verdict from the in-gate case (an out-of-scope-defect split-off is the third case that also
     lands on `"offloaded"`, per `shared/FEEDBACK-CATEGORIZATION.md § Scope check`). Either way,
     proceed to the regression re-check and completion on the verified scope.

  **`failedRounds == 2`:** same four options, but option 3 ("Escalate — debug round") is now the
  **recommended** one — do not keep offering a plain repeat round as the default once a round has
  already failed twice with no new evidence.

  **`failedRounds >= 3`** (hard ceiling, mirrors `dev-verify/references/fix-loop.md`'s max-3):
  option 2 ("Another round in this chat") is **no longer offered** for this item — repeating the same
  tier a third time burns a round without new information. Options collapse to:

  1. **"Debug round"** (recommended) — as above, but if `references/debug-round.md` has already run
     once for this item and failed again, its own park step (Step 8) is tier 3: it hands off to
     `/game-debug {feature}` directly, with the ledger's evidence pre-filled.
  2. **"Park — continue in a fresh chat"** — same mechanics as `failedRounds == 1` option 1.

  (`"Defer to backlog todo"` stays available under the same tweak-only condition at every
  `failedRounds` level.)

Once every item is Pass (or explicitly Skip/Defer) and no round is in flight, return to
`phase-3-playtest.md § Findings ledger + routing` for the regression re-check. If the scope check
split off a new item that hasn't been through a round-gate pass yet, that item is not yet resolved —
return to `§ Round gate` for it instead.
