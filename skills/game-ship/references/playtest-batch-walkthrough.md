# Playtest Walkthrough — batched (game-ship)

**When:** game-ship PHASE 3 has `remainingManualItems` (from AGENT 2). This is the **token-lean**
live playtest used by the auto-mode ship: one game window, the whole MANUAL checklist presented
**once**, judged in **one** `AskUserQuestion` round, with DebugListener output captured on demand —
instead of the standalone per-item loop. MANUAL = gameplay feel, visual/particle/animation quality,
audio, or cross-requirement gameplay scenarios experienced live — not anything a GUT test already
COVERED.

## Step A — Board signal (amber: waiting on the user)

Before launching, flag the board amber (see `shared/DEVINFO.md § Active Feature Signal`):

```bash
echo '{"feature":"{feature}","skill":"test","startedAt":"{ISO}","waiting":"playtest"}' > .project/session/active-{feature}.json
```

After the round is answered, rewrite it **without** `waiting` — verification work resumes.

## Step B — Launch ONE live game window + present the whole checklist ONCE

Launch the playtest scene once (the main chat has a display — this is the one interactive game launch
in the pipeline; contract rule 8's "no game window" applies only to the subagents):

```python
mcp__godot-mcp__run_project(
    projectPath=".",
    scene=".project/features/{feature-name}/playtest_scene.tscn"
)
```

(If godot-mcp is unavailable → the `phase-3-playtest.md` § Fallback applies: print the scene path and
ask the user to launch it themselves.) The game runs in the background; DebugListener captures all
`debug_*` signals. Then print the **entire** MANUAL checklist in one message — the game window at the
top, then every item:

```
GAME LAUNCHED — {feature-name}
Play the window, then run these {M} checks:

PLAYTEST 1 — {title}
  steps:    1. {concrete action / input}  2. …
  expected: {observable gameplay outcome}

PLAYTEST 2 — {title}
  …

Debug tracking is active — your actions are being logged. Close the game when done.
```

## Step C — One judgement round (batched `AskUserQuestion`)

Ask the user to mark only what did **not** pass. Batch by item count (AskUserQuestion allows ≤ 4
questions per call, ≤ 4 options per question, `multiSelect: true`):

- **M ≤ 3** → one question, `multiSelect: true`, options = `"FAILED / needs follow-up: {title}"`
  for each item + `"All passed"`. Selecting nothing but "All passed" ⇒ every item Pass.
- **4 ≤ M ≤ 12** → chunk into groups of 3 items → one question per chunk (≤ 4 questions in the
  single call), each `multiSelect: true`, options = the 3 items + `"None of these failed"`.
- **M > 12** (rare) → two calls of the above.

"All passed" / "None of these failed" is the recommended (first) option in each question.

## Step D — Follow-up only for flagged items

For the items the user flagged (if any), ask **one** follow-up round (a single `AskUserQuestion`,
≤ 4 flagged items per call) to classify each and capture one line of detail — this maps directly onto
game-verify's TESTABLE / MEASURABLE / SUBJECTIVE categorization used by the `phase-3-playtest.md`
FAIL-routing:

- **Fail** → "what went wrong?" (one line — observed vs expected). Offer to capture DebugListener
  output (`get_debug_output`, or the scene's debug log under `.project/features/{feature}/` when
  godot-mcp is unavailable) as diagnosis. A concrete value ("radius 50, should be 100") makes it
  TESTABLE; a relative complaint ("too slow") MEASURABLE; a vague one ("feels off") SUBJECTIVE →
  clarify.
- **Skip** → note reason ("not testing, accept as-is"). Does **not** block finalize.
- **Defer** → which external prereq blocks it (missing asset, addon, export preset). Stays open for
  re-test; does **not** block finalize.

Record all outcomes. Nothing flagged ⇒ all Pass → return to `phase-3-playtest.md` Step 3 (completion

- finalize). Any **Fail** ⇒ the FAIL-routing block in `phase-3-playtest.md` Step 2 decides what
  happens next (categorize → bounded fix loop via background agent / interactive `/game-debug` / stop).
