# Escalation flow (game-tweak)

Loaded when the size gate or backlog guard fires (`shared/TWEAK-DISCIPLINE.md § Escalation gate`) —
at intake (PHASE 0) or mid-implement (PHASE 2/3). Semantics live in TWEAK-DISCIPLINE; this file is
the mechanics.

## 1. Freeze and take stock

- Name the criterion that fired (net-new surface / file span / new test surface / architecture /
  guard hit / tier-3 signals) — it goes in the question and, on override, in the report.
- **Mid-run edits**: list files already modified since `pre-tweak-status.txt`. Decide the default:
  keep them uncommitted (the ship's own baseline will categorize them OVERLAP/PRE-EXISTING) unless
  they are half-applied and would break the project — then offer revert to baseline.

## 2. Ask

One AskUserQuestion (`multiSelect: false`). When the trigger is a tier-3 debug signal
(TWEAK-DISCIPLINE size-gate criterion 6), swap option (b) for the debug variant below.

```yaml
header: "Tweak escalation"
question: "This exceeds tweak scope ({criterion}). How to proceed?"
options:
  - label: "Park as TODO (Recommended)"
    description: "One backlog card via /project-todo — pick it up later with /game-ship"
  - label: "Hand off to /game-ship now"
    description: "Runs the full define→build→GUT-verify→playtest→refactor pipeline on this change"
  - label: "Continue as tweak (override)"
    description: "Proceed anyway — logged in the report"
```

Tier-3 variant of option (b): label `"Hand off to /game-debug now"`, description `"Evidence-first
root-cause flow: reproduction test, investigation agent, fix-strategy fan-out"`.

## 3. Execute the choice

**(a) Park as TODO** — **a live card is already in play** (card mode, or a free-text guard match) →
this skill performs **zero** backlog writes: the card already exists as `TODO`, so parking is a
no-op on the backlog. Do **not** invoke `project-todo` here — at best it dedups back to the same
card, at worst a token-overlap miss creates a stray `-2` duplicate. Just finish the tweak run with a
two-line report: the card name + `Pick it up with /game-ship {name}.` Revert or keep mid-run edits
per the § 1 decision.

**No live card** (a genuine free-text run with no guard match) — invoke the `project-todo` skill
(Skill tool) with one sentence: the change description + the escalation reason + touched-file hints
(e.g. _"Add a dash ability with cooldown — parked from /game-tweak escalation (net-new surface:
input action + signal); touches player/player.gd"_). project-todo owns naming, type/phase inference,
dedup, and the backlog/project dual sync — this skill performs zero backlog writes. Then finish with
the same two-line report using the name project-todo returns.

**(b) Hand off to the pipeline** — resolve mid-run edits first (§ 1), then invoke the `game-ship`
skill (Skill tool). **A live card is already in play** (card mode, or a free-text guard match) →
always pass that card's exact `name` as args, never a re-derived description — its define phase
resumes the card in place (and promotes it out of `type: "POLISH"`, see
`game-ship/references/game-define/references/phase5-sync.md` § POLISH promotion) instead of creating
a duplicate. **No live card** → pass the change description as args; define registers a fresh feature
as it always does. Do **not** pre-create a card: define owns registration. For tier-3 debug signals,
invoke the standalone `game-debug` skill instead (per DEBUG-LADDER's game route). If the user prefers
a fresh session, fall back to (a) and print the `/game-ship {name}` command.

**(c) Override** — return to the phase that was interrupted and continue as a tweak. The PHASE 4
report must carry `Escalation overridden: {criterion}`. One override covers one criterion — a
_different_ criterion firing later re-opens this flow.
