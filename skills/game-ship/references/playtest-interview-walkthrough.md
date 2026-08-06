# Playtest Walkthrough — item-by-item interview (game-ship)

**When:** game-ship PHASE 3 has `remainingManualItems` (from AGENT 2). This is the **collect-only**
walkthrough: against the single running game window, each item gets an overview then is played live,
and any non-pass verdict gets its detail captured immediately — but nothing is fixed here. MANUAL =
gameplay feel, visual/particle/animation quality, audio, or cross-requirement gameplay scenarios
experienced live — not anything a GUT test already COVERED. This round also accepts a **Tweak**
outcome ("works, but I want it to feel different"), and a closing interview surfaces anything else
the user noticed. None of that gets fixed during this walkthrough — see
`phase-3-playtest.md § Findings ledger + routing` for what happens after.

**Philosophy.** This round is not only "do the requirements pass" — it is "now that you've played
it: is it right, and does it also feel good?" The interview close (Step F) exists specifically to
catch the second question, which a pass/fail checklist alone cannot ask.

**Plan mode is not used here.** This walkthrough is an interactive collection round, not a thinking
phase that produces a plan (`shared/PLAN-MODE.md § Wanneer plan mode`) — there is no reviewable
artefact and no rejection path, so it never calls `EnterPlanMode`. Every write below lands the
moment it's known; nothing is held in memory. This is also why the fix-round gate
(`fix-round.md § Round gate`) now always does its own fresh `EnterPlanMode` instead of continuing a
session opened here — see `shared/PLAN-MODE.md § Conditional entry`. **No step-by-step guided walk
here, deliberately** — unlike dev-ship's manual round, a playtest input sequence ("move left, then
jump") has no class of silent, later-invalidating preconditions the way a UI setup step does; the
window either runs correctly or it doesn't, and breaking a continuous play sequence into
checkpoints would destroy exactly the experience being measured. See
`manual-interview-walkthrough.md § Step B2` for why dev-ship's round does the opposite.

## Step A — Board signal (amber: waiting on the user)

Before presenting the first item, flag the board amber (see `shared/DEVINFO.md § Active Feature
Signal`):

```bash
echo '{"skill":"test","waiting":"playtest"}' | node ~/.claude/scripts/ship-checkpoint.js signal {feature}
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
one item at a time, an overview followed immediately by the steps (no guided per-step wait — see
above):

```
PLAYTEST {i}/{M} — {title}
expected: {observable gameplay outcome}
steps:
  1. {concrete action / input}
  2. …
```

Wait for the user to actually play it before asking for a verdict — this is a live check, not a
read-through. Steps ship one per line with a blank line between them, and the item block is always
the last thing in the message (§ Checklist file below covers the same content in a durable form).

## Step C — Verdict for this item

One `AskUserQuestion` per item (not batched):

- `Pass (Recommended)`
- `Fail — doesn't work as specified`
- `Tweak — works, but I want it to feel/behave different`
- `Kom er niet uit / kan dit niet testen` — fires one immediate follow-up `AskUserQuestion`:
  - `Help me (Recommended)` — **not a verdict.** Grep the worktree/scene for the input, node, or
    control the item's steps named, report where it actually surfaces, correct the item's
    `steps`/`expected` on the ledger item, then re-present the corrected item. **Capped at 2
    durable `helpAttempts`** (increment, start at 1, never reset on resume — mirrors
    `phase-3-playtest.md`'s own `tweakAttempts` pattern) — the 3rd time this item reaches Step C,
    the modal drops the 4th option entirely (Pass / Fail / Skip-Defer only).
  - `Skip` / `Defer` — same follow-up question as before: which of the two, and why (reason for
    Skip; blocking external prereq for Defer — missing asset, addon, export preset). **Defer is
    for external blockers only** — "it is broken" is by definition a **Fail**, never a Defer.

> **STOP — Claude never produces a verdict; Claude always produces the route.** A verdict is a claim
> about the world the user is looking at — does it work, is it right, does this blocker also hit the
> other items. Only the user can settle one here (there is no A2 evidence sweep in this round to
> verify against — every item is genuinely live). A route — which round, which tier, park vs.
> offload — is Claude's own call and never needs this modal; `phase-3-playtest.md` and `fix-round.md`
> name exactly which routes those are.

**Systemic blocker discovered mid-item** — same fold-in rule as dev-ship's round
(`manual-interview-walkthrough.md § Step C`): name the still-untested items in the same modal that
resolves the current one, so the user's one answer is an informed batch decision.

## Step D — Immediate detail capture on Fail/Tweak (do NOT fix)

While the game is still running, capture what the fix round will need — but stop there, do not start
fixing:

- **Observed vs expected** — what happened vs what should have happened. A concrete value ("radius
  50, should be 100") makes it TESTABLE; a relative complaint ("too slow") MEASURABLE.
- **SUBJECTIVE → clarify first (mandatory)** — "feels off" is not actionable. Unlike dev-ship's
  round, there is no `stepLog` here to check a subjective remark against (no guided walk), so this
  bypass never applies in this file — ask **one** clarifying `AskUserQuestion` (too fast/slow, too
  strong/weak, wrong timing, visual, audio, other), then re-categorize the answer as TESTABLE or
  MEASURABLE per `shared/FEEDBACK-CATEGORIZATION.md`. Never leave a finding as SUBJECTIVE in the
  ledger.
- **Diagnostic capture** — offer to pull DebugListener output (`get_debug_output`, or the scene's
  debug log under `.project/features/{feature}/` when godot-mcp is unavailable) as evidence for the
  fix round.
- **On Fail** — capture objective failure evidence now, while it still reproduces: the DebugListener
  output above, editor Output-log lines, any `push_error` messages. The fix round consumes it, and
  after repeated failed rounds the debug round does (`fix-round.md § Re-check` ladder →
  `references/debug-round.md`). Still collect-only — do not fix anything here.
- **Split off out-of-item findings** — apply `shared/FEEDBACK-CATEGORIZATION.md § Scope check`. If
  what's reported goes beyond this item's own `expected` text, don't fold it into this item's
  evidence: judge this item on the on-topic remainder, and record the off-topic part as a new ledger
  item now (next sequential `PT-N` id) via the same `ship-checkpoint.js item {feature} playtest`
  upsert Step E already uses — in-scope stays a blocking fail, out-of-scope routes to
  `/project-todo` per the Fail-never-to-todo policy's net-new-capability carve-out
  (`phase-3-playtest.md § Findings ledger + routing`), then the same upsert patches that item's own
  verdict to `"offloaded"` + `offload: "{card-name}"` (same vocabulary as `dev-ship`'s ledger,
  `shared/SHIP-CHECKPOINT.md`) so Step 3's "no open playtest FAIL" check doesn't read it as still
  blocking.

Record the category (TESTABLE / MEASURABLE) alongside the finding. Then move to the next item — the
fix routing lives in `phase-3-playtest.md § Findings ledger + routing`, not here.

## Step E — Persist immediately

There is no write restriction in this round, so nothing waits: the moment a verdict is known, write
it. **The upsert is a full replace by `id`, not a merge** (`ship-checkpoint.js item` sets
`items[existingIndex] = item` outright) — if this item already had a `Help me` round bump
`helpAttempts`, that field must be included again on the verdict write or it is silently lost. Keep
the running record in your own working state (id, title, verdict, category, observed, expected,
debug-log path, source, `helpAttempts`) and send the whole object:

```bash
echo '[{"id":"PT-1","title":"...","verdict":"pass","category":"...","observed":"...","expected":"...","source":"checklist"}]' \
  | node ~/.claude/scripts/ship-checkpoint.js item {feature} playtest
```

Repeat Steps B–E for every remaining item (the game window itself stays open the whole time). Update
the checklist file (§ below) in the same step. A session death mid-interview loses only the fields
accrued since the last write for the item in flight — the resume path
(`phase-3-playtest.md § Resume entry`) filters `remainingManualItems` down to items not yet present
in `playtest.items`.

## Checklist file — a second, durable reading surface

At the start of the round (before item 1), write all M items as a markdown checklist to
`.project/session/playtest-{feature}.md`: one section per item, steps one per line, `expected`
called out, and a status line updated in place as each verdict lands (`- [x] PT-1 — pass`). Mention
the path once, at the first item. No HTML preview — same reasoning as
`manual-interview-walkthrough.md § Checklist file`.

## Step F — "Now that you've played it" interview close

After the last item, ask **one** open question (English source text, emit in the runtime language per
`shared/LANGUAGE.md`):

> "Now that you've played it: what should be different or better?"

Follow up on whatever the user raises — one clarifying question at a time. SUBJECTIVE answers get
the same mandatory clarify-then-recategorize as Step D. Stop the moment the user has nothing more to
add; tell them to close the game once this closes.

- **In-theme tuning** (a value, timing, feel, or feedback of something already built) → a new ledger
  finding, `verdict: "tweak"` (or `"fail"` if it turns out a criterion was genuinely not met),
  `source: "interview"`. Persist it via the same Step E upsert. The offload's own size-gate judgment
  (`fix-round.md`'s "Defer to backlog todo" option) still applies once this reaches offload — a
  "tweak" that turns out to exceed the gate flips to `"offloaded"` there, not here.
- **Net-new mechanic/scope** (not in `remainingManualItems`) → keep it out of the ledger entirely.
  Either fold it into the fix round only if it is small and clearly in-theme (the round-gate
  decides), or route it to `/project-todo` and finish the ship on the verified scope. Net-new scope
  **is** `shared/TWEAK-DISCIPLINE.md § Size gate` criterion 1 by definition, so it never carries a
  `type POLISH` hint — plain inference applies.

## Step G — Return

Hand back to `phase-3-playtest.md § Findings ledger + routing` for routing — the ledger is already
fully persisted (Step E), so there is nothing left to batch-write. It names the round path (all-pass,
inline-fix, or the round-level fix-plan gate in `fix-round.md`, which now always does its own fresh
`EnterPlanMode`). After routing resolves, rewrite the live signal without `waiting` (Step A) —
verification work resumes.
