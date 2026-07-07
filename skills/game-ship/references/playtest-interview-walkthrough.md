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

## Step A — Board signal (amber: waiting on the user)

Before presenting the first item, flag the board amber (see `shared/DEVINFO.md § Active Feature
Signal`):

```bash
echo '{"feature":"{feature}","skill":"test","startedAt":"{ISO}","waiting":"playtest"}' > .project/session/active-{feature}.json
```

After Step F closes, rewrite it **without** `waiting` — verification work (routing to the ledger)
resumes.

## Step B — Launch the game window, present ONE item

Launch the playtest scene **once** — the user plays a single window across every item, not a
per-item relaunch (the main chat has a display — this is the one interactive game launch in the
pipeline; contract rule 8's "no game window" applies only to the subagents):

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
  external prereq for Defer — missing asset, addon, export preset).

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

Record the category (TESTABLE / MEASURABLE) alongside the finding. Then move to the next item — the
fix routing lives in `phase-3-playtest.md § Findings ledger + routing`, not here.

## Step E — Persist this item's verdict

After every single item, patch the checkpoint so a killed session resumes mid-walkthrough rather than
from the top:

```bash
echo '{"playtest":{"items":[ /* the FULL items array so far */ ]}}' | node ~/.claude/scripts/ship-checkpoint.js patch {feature}
```

`ship-checkpoint.js` deep-merges objects but **replaces arrays wholesale** (`shared/SHIP-CHECKPOINT.md`)
— always send the complete `playtest.items` array, not just the new entry, or earlier verdicts are
lost.

Repeat Steps B–E for every remaining item (the game window itself stays open the whole time).

## Step F — "Now that you've played it" interview close

After the last item, ask **one** open question (English source text, emit in the runtime language
per `shared/LANGUAGE.md`):

> "Now that you've played it: what should be different or better?"

Follow up on whatever the user raises — one clarifying question at a time. SUBJECTIVE answers get
the same mandatory clarify-then-recategorize as Step D. Stop the moment the user has nothing more to
add; tell them to close the game once this closes.

- **In-theme tuning** (a value, timing, feel, or feedback of something already built) → a new ledger
  finding, `verdict: "tweak"` (or `"fail"` if it turns out a criterion was genuinely not met),
  `source: "interview"`. Persist per Step E.
- **Net-new mechanic/scope** (not in `remainingManualItems`) → keep it out of the ledger entirely.
  Either fold it into the fix round only if it is small and clearly in-theme (the round-gate
  decides), or route it to `/project-todo` and finish the ship on the verified scope.

Patch `playtest.interviewDone: true` once this closes.

## Step G — Return

Rewrite the live signal without `waiting` (Step A). Hand back to
`phase-3-playtest.md § Findings ledger + routing` with the full ledger (`playtest.items` + any
interview-close findings) for routing: empty ledger → regression-skip → completion; small
cosmetic-only ledger → inline fix; otherwise → the round-level fix-plan gate (`fix-round.md`).
