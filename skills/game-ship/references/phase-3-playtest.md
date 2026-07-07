# PHASE 3 — Human playtest + Completion (MAIN CHAT)

Runs in the main chat so `AskUserQuestion` and the interactive game window reach the real user.
Resumes the half of `game-verify` that AGENT 2 deliberately skipped: the live playtest (if any) and
the DONE completion. Finalize/merge has moved to the end of PHASE 4 (after refactor) so refactor
commits land on the feature branch first. AGENT 2's `remainingManualItems` is authoritative here.

**Dual reader**: this file is read by the main chat (playtest-items path, below) and by AGENT O
(`references/prompts/orchestrator.md § Phase 3 completion`, the no-playtest path) — AGENT O runs
only **Step 1** + **Step 3**, never Step 2 (no game window launch, no walkthrough, no human to show
anything to) and never the routing sections below (those assume playtest items).

## Resume entry (fresh session)

When PHASE 3 is entered via a direct resume (a fresh chat re-invoking `/game-ship {feature}` after the
last session handed off here — the deliberate token break after auto-verify leaves playtest items, the
common case — or was interrupted), `results.verify` comes from
the checkpoint (`ship-{feature}.json`), not from an in-context AGENT 2 return. Run **Step 1** (enter
the worktree, tag `stage: "testing"`) and **Step 2** (launch the live game window) exactly as on the
normal path, then route on the checkpoint's `playtest` block:

- **No `playtest` block, or `playtest.items` shorter than `results.verify.remainingManualItems`** →
  run the walkthrough (`playtest-interview-walkthrough.md`), filtering `remainingManualItems` down to
  the items **not yet present** in `playtest.items` (already-verdicted items are not re-asked). The
  walkthrough's Step A re-arms `active-{feature}.json` with `waiting: "playtest"`, so the board flips
  the row from **parked** back to **waiting**.
- **Ledger complete (`playtest.items` covers every item, `playtest.interviewDone: true`) but no
  `playtest.fixPlan`** → go straight to `§ Findings ledger + routing` below and re-enter the fix-plan
  gate (the ledger is durable, so the walkthrough never re-runs — only the round's fix-plan draft was
  lost, same as a rejected-and-abandoned plan would be).
- **`playtest.fixPlan` present and `activeWorkflow: "phase3fix"`** (a dispatch was in flight) → go to
  `fix-round.md § Dispatch` and relaunch `ship-game-fix.js` with `resume` built from
  `playtest.dispatch` (cross-session) or `resumeFromRunId` (same session, per `shared/SHIP-RESUME.md`).
- **`playtest.fixPlan` present and dispatch complete (`playtest.dispatch.allFixed` or all groups
  terminal)** → go to `fix-round.md § Re-check`.

Keep the checkpoint `phase: "PHASE 3"` throughout.

## Step 1 — Enter the worktree

The agents ran in isolated contexts; the main-chat shell is **not** in the worktree. Switch in
before anything else: execute `.claude/skills/shared/WORKTREE.md` with `feature-name = {feature}`
and `feature.status = DOING`. This switches to `worktree-{feature}` (needed for the godot-mcp
project launch and the warm `.godot` import cache) and runs the symlink-integrity gate. Then tag the
board card `stage: "testing"` (Edit `.project/backlog.json` → find feature → `stage: "testing"`,
`data.updated` → now).

## Step 2 — Live playtest walkthrough (only if `remainingManualItems` non-empty)

Skip this step entirely when AGENT 2 returned `remainingManualItems: none` (the GUT-covered case) —
go straight to Step 3.

**Launch one live game window + hand off.** The user plays a single window (not a per-item relaunch)
and reports back:

```python
mcp__godot-mcp__run_project(
    projectPath=".",
    scene=".project/features/{feature-name}/playtest_scene.tscn"
)
```

(If godot-mcp is unavailable → the `§ Fallback` below applies: print the scene path and ask the user
to launch it themselves.) The game runs in the background; DebugListener captures all `debug_*`
signals for the whole session.

Then run the **item-by-item interview walkthrough**: Read
`.claude/skills/game-ship/references/playtest-interview-walkthrough.md` and execute it for the
`remainingManualItems` from AGENT 2 — items are presented one at a time against the single running
game window, each judged live, non-pass verdicts get their detail captured immediately, and a closing
interview asks what else should feel or behave differently. **Nothing is fixed during this
walkthrough** — it only builds the findings ledger (persisted to the checkpoint after every item, so
a killed session resumes mid-walkthrough).

## Findings ledger + routing

Once the walkthrough (`playtest-interview-walkthrough.md`) returns, route on the accumulated ledger
(`playtest.items` + any interview-close findings):

| Ledger state                                                                      | Route                                                           |
| --------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| No Fail/Tweak findings (all Pass, or only Skip/Defer)                             | Skip to Regression re-check → Step 3                            |
| ≤2 findings, all MEASURABLE, cosmetic, obvious fix (a value/timing/feel tweak)    | **Inline fix now** (below) — no gate — then Regression → Step 3 |
| Anything else (any TESTABLE finding, >2 findings, or an unclear/multi-script fix) | Read `fix-round.md` and run the round loop                      |

**Inline-fix path (skip-gate case)** — mirrors dev-ship's equivalent skip-silently condition: fix
each finding directly in the main chat, Read `shared/DEBUG-LADDER.md` and apply tier 1 (symptom +
cause both visible, ≤1-2 scripts/scenes), re-launch the game window, let the user confirm live. No
plan mode, no round bookkeeping — this is the common trivial case and should stay friction-free.

**Otherwise** → Read `.claude/skills/game-ship/references/fix-round.md` and follow it: the
hoisted-bookkeeping + round-level plan-mode fix-plan gate (Opus designs the fix, groups findings into
file-disjoint waves, decides inline-vs-agent dispatch per group), the `ship-game-fix.js` dispatch
(Sonnet), and the post-dispatch re-check. That file owns everything from here through "all findings
resolved or explicitly deferred" — it returns control here only when ready for the regression
re-check below.

`Skip` / `Defer` outcomes never block completion — they are recorded (deferred items stay open for a
later re-test), and the flow continues regardless of how many are open.

**Regression re-check after fixes/tweaks** — if any PHASE 3 fix **or tweak** touched code, re-run the
FULL GUT suite headless (`"{godot_executable}" --headless --path . -s addons/gut/gut_cmdln.gd -gexit`)
once before Step 3. New failures → back into the fix routing above (ladder escalation applies); clean
→ continue. Skip only when nothing was changed in this phase.

## Step 3 — Completion (DONE)

All COVERED passed (AGENT 2) and no open playtest FAIL → complete (but do **not** integrate yet):

1. Run `game-verify`'s completion-sync to flip the feature to **DONE** (backlog + feature.json
   `tests` section: `finalStatus`, `sessions[]`, `requirements[].status`, `stage → "done"` + learning
   extraction) — Read
   `.claude/skills/game-ship/references/game-verify/references/completion-finalize.md` and run its
   Steps 0-2 (Fix Sync only if fixes were applied; Out-of-scope Observations; the parallel sync). This
   is the DONE write AGENT 2 was told to skip. **Skip completion-finalize's tail handoff**: its
   output ends with a `Next steps` / Next-Step Clipboard Offer (`NEXT-STEP-OFFER.md`) — do **not**
   emit it. game-ship drives PHASE 4 refactor itself; keep only the DONE writes + learning extraction,
   drop the terminal handoff (adapter rule 4, applied here in the main chat).

Do **not** finalize/merge here — stay in the worktree. Finalize runs at the end of PHASE 4
(SKILL.md § PHASE 1–4) so refactor commits land on the feature branch first. **Return to SKILL.md
§ PHASE 1–4**: spawn AGENT O per `references/agent-orchestrator.md § Spawn` (the checkpoint routes
it to PHASE 4) and handle its wake there.

## Guard

Never merge in this phase, even on all-green. The merge belongs to AGENT O's finalize. (On a
playtest FAIL the routing above already blocks PHASE 4.)

## Fallback — godot-mcp unavailable

If `mcp__godot-mcp__run_project` is not available (MCP server not connected), do not block the
pipeline: print the scene path and ask the user to launch it themselves —
`"godot-mcp is unavailable. Open the scene yourself in Godot: .project/features/{feature}/playtest_scene.tscn, then report results."` — and proceed with the same
item-by-item walkthrough (the readiness signal is the human at the window, not an MCP call).
DebugListener output can then be read from `.project/features/{feature}/` logs instead of
`get_debug_output`.
