# Playtest Walkthrough — item-by-item interview (game-ship)

**When:** game-ship PHASE 3 has `remainingManualItems` (from AGENT 2). This is the **collect-only**
walkthrough: against the single running game window, each item is presented on its own, the user
plays it live, and any non-pass verdict gets its detail captured immediately — but nothing is fixed
here. MANUAL = gameplay feel, visual/particle/animation quality, audio, or cross-requirement gameplay
scenarios experienced live — not anything a GUT test already COVERED. This round also accepts a
**Tweak** outcome ("works, but I want it to feel different"), and a closing interview surfaces
anything else the user noticed. None of that gets fixed during this walkthrough — see
`phase-3-playtest.md § Findings ledger + routing` for what happens after.

**Philosophy.** This round is not only "do the requirements pass" — it is "now that you've played
it: is it right, and does it also feel good?" The interview close (Step F) exists specifically to
catch the second question, which a pass/fail checklist alone cannot ask.

**Plan mode.** Step A (signal) and Step B (game-window launch) run **before** plan mode — both touch
disk/the game window, which plan mode blocks. Step A2 enters plan mode; everything from Step B's
first item through the routing handoff at the end runs inside it. Unlike dev-ship's browser-based
pre-check sweep, there is no automated pre-check here — a playtest is inherently a human-perception
round, so every item is genuinely live. See Step A2 and Step E for what plan mode changes about
persistence.

## Step A — Board signal (amber: waiting on the user)

Before presenting the first item, flag the board amber (see `shared/DEVINFO.md § Active Feature
Signal`):

```bash
echo '{"skill":"test","waiting":"playtest"}' | node ~/.claude/scripts/ship-checkpoint.js signal {feature}
```

After Step F closes, rewrite it **without** `waiting` — verification work (routing to the ledger)
resumes.

## Step A2 — Enter plan mode

`EnterPlanMode` per `shared/PLAN-MODE.md` Entry (skip if already in plan mode) — after the game
window is launched (Step B below) but before the first item is presented. From here through the end
of this walkthrough — and into the round gate if the ledger routes there — all `.project/` writes are
blocked. Verdicts and ledger items are collected **in memory** (Step E) and written in one batch
immediately after the matching `ExitPlanMode` (`phase-3-playtest.md § Findings ledger + routing`
names the exact exit point per path). **Trade-off, accepted**: a session death mid-interview loses
that session's in-memory verdicts — the resume filters `remainingManualItems` down to items not yet
present in the persisted `playtest.items` (`phase-3-playtest.md § Resume entry`), so nothing is lost
except having to re-ask those specific items.

## Step B — Launch the game window, present ONE item

Launch the playtest scene **once** — the user plays a single window across every item, not a
per-item relaunch (the main chat has a display — this is the one interactive game launch in the
pipeline; contract rule 8's "no game window" applies only to the subagents). Do this **before**
`EnterPlanMode` (Step A2) — the MCP call is a live-window action, unaffected by plan mode, but
launching it after entry would be an unnecessary risk:

```python
mcp__godot-mcp__run_project(
    projectPath=".",
    scene=".project/features/{feature-name}/playtest_scene.tscn"
)
```

(If godot-mcp is unavailable → `phase-3-playtest.md § Fallback` applies: print the scene path and ask
the user to launch it themselves.) The game runs in the background; DebugListener captures all
`debug_*` signals for the whole session. On the **first** item only, lead with the launch note; then,
one item at a time:

```
PLAYTEST {i}/{M} — {title}
  steps:    1. {concrete action / input}  2. …
  expected: {observable gameplay outcome}
```

Wait for the user to actually play it before asking for a verdict — this is a live check, not a
read-through.

## Step C — Verdict for this item

One `AskUserQuestion` per item (not batched):

- `Pass` (recommended)
- `Fail — doesn't work as specified`
- `Tweak — works, but I want it to feel/behave different`
- `Skip / Defer` — one immediate follow-up: which of the two, and why (reason for Skip; blocking
  external prereq for Defer — missing asset, addon, export preset). **Defer is for external blockers
  only** — "it is broken" is by definition a **Fail**, never a Defer.

## Step D — Immediate detail capture on Fail/Tweak (do NOT fix)

While the game is still running, capture what the fix round will need — but stop there, do not start
fixing:

- **Observed vs expected** — what happened vs what should have happened. A concrete value ("radius
  50, should be 100") makes it TESTABLE; a relative complaint ("too slow") MEASURABLE.
- **SUBJECTIVE → clarify first (mandatory)** — "feels off" is not actionable. Ask **one** clarifying
  `AskUserQuestion` (too fast/slow, too strong/weak, wrong timing, visual, audio, other), then
  re-categorize the answer as TESTABLE or MEASURABLE per `shared/FEEDBACK-CATEGORIZATION.md`. Never
  leave a finding as SUBJECTIVE in the ledger.
- **Diagnostic capture** — offer to pull DebugListener output (`get_debug_output`, or the scene's
  debug log under `.project/features/{feature}/` when godot-mcp is unavailable) as evidence for the
  fix round.
- **On Fail** — capture objective failure evidence now, while it still reproduces: the DebugListener
  output above, editor Output-log lines, any `push_error` messages. The fix round consumes it, and
  after repeated failed rounds the debug round does (`fix-round.md § Re-check` ladder →
  `references/debug-round.md`). Still collect-only — do not fix anything here.

Record the category (TESTABLE / MEASURABLE) alongside the finding. Then move to the next item — the
fix routing lives in `phase-3-playtest.md § Findings ledger + routing`, not here.

## Step E — Collect (in memory)

Keep each item's full record (id, title, verdict, category, observed, expected, debug-log path,
source) in memory as you go — do **not** write to the checkpoint yet; plan mode blocks it. Repeat
Steps B–E for every remaining item (the game window itself stays open the whole time).

**Batch persist (after plan-mode exit).** The exact `ExitPlanMode` you follow is named in
`phase-3-playtest.md § Findings ledger + routing` (it differs by which path the ledger takes).
Immediately after that exit, in one call:

```bash
echo '[{"id":"PT-1","title":"...","verdict":"pass","category":"...","observed":"...","expected":"...","source":"checklist"}, {"id":"PT-2", ...}]' \
  | node ~/.claude/scripts/ship-checkpoint.js item {feature} playtest
```

Send the full in-memory array — the script upserts each element into `playtest.items` by `id` in one
atomic write. Then patch `playtest.interviewDone: true`.

## Step F — "Now that you've played it" interview close

After the last item (still inside plan mode), ask **one** open question (English source text, emit in
the runtime language per `shared/LANGUAGE.md`):

> "Now that you've played it: what should be different or better?"

Follow up on whatever the user raises — one clarifying question at a time. SUBJECTIVE answers get
the same mandatory clarify-then-recategorize as Step D. Stop the moment the user has nothing more to
add; tell them to close the game once this closes.

- **In-theme tuning** (a value, timing, feel, or feedback of something already built) → a new ledger
  finding, `verdict: "tweak"` (or `"fail"` if it turns out a criterion was genuinely not met),
  `source: "interview"`. Add it to the in-memory collection (Step E) — it persists in the same batch
  write.
- **Net-new mechanic/scope** (not in `remainingManualItems`) → keep it out of the ledger entirely.
  Either fold it into the fix round only if it is small and clearly in-theme (the round-gate
  decides), or route it to `/project-todo` and finish the ship on the verified scope.

## Step G — Return

Hand back to `phase-3-playtest.md § Findings ledger + routing` with the full in-memory ledger
(`playtest.items` + any interview-close findings) for routing — it names the `ExitPlanMode` for each
path (all-pass, inline-fix, or the round-level fix-plan gate in `fix-round.md`) and the batch-persist
that follows it. After the batch persist, rewrite the live signal without `waiting` (Step A) —
verification work resumes.
