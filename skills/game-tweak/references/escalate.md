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
    description: "Promotes the card out of the tweak lane to a real TODO
      card — pick it up later with /game-ship"
  - label: "Hand off to /game-ship now"
    description: "Runs the full define→build→GUT-verify→playtest→refactor
      pipeline on this change"
  - label: "Continue as tweak (override)"
    description: "Proceed anyway — logged in the report"
```

Tier-3 variant of option (b): label `"Hand off to /game-debug now"`, description `"Evidence-first
root-cause flow: investigation agent, one evidence-backed fix plan, reproduction test"`.

## 3. Execute the choice

**(a) Park as TODO** — **a live card is already in play** (card mode, or a free-text guard match) →
the card already exists as `TODO`, so parking never touches `status`. Do **not** invoke
`project-todo` here — it refuses to modify existing backlog items (`project-todo/SKILL.md § Never`),
so at best it dedups back to the same card, at worst a token-overlap miss creates a stray `-2`
duplicate. This run owns the write.

**Promote the card out of the tweak lane.** The board's dedicated "Tweaks" section renders every
live `type: "POLISH"` card with a `/game-tweak` copy button (`shared/BACKLOG.md § TWEAK cards` §
Game equivalent) — leaving the card typed `POLISH` after this run judged it too big for a tweak just
re-offers the identical dead end on the next click, re-running the same escalation from scratch. One
targeted `Edit` on the card in `backlog.json#features[]`, three fields:

1. **`type`** — overwrite `POLISH` with the type inferred from the card's own description per
   `project-todo/references/inference-rules.md § Type inference — GAME`. The `POLISH` row is
   unreachable by construction — the size gate just ruled the change exceeds it — so the match falls
   through to `SYSTEM`/`MECHANIC`/the GAME table's default, exactly what `game-ship`'s own offload
   flush already does for an over-gate finding. Provisional only — a later `/game-ship` define pass
   classifies fresh and overwrites `type` again regardless. Card already carries some other type (a
   free-text guard match, never `POLISH`) → leave `type` untouched.
2. **`description`** — append one sentence naming the provenance, the same information the
   no-live-card branch below already hands to `project-todo`: `Parked from /game-tweak escalation
({criterion}) — exceeds tweak scope, pick up with /game-ship.`
3. **`transition`** — remove if present. The board sets this the moment its `/game-tweak` copy
   button was clicked (`shared/TWEAK-DISCIPLINE.md` § Escalation gate (a)); nothing else consumes it
   once this run bails instead of finishing the tweak, so skipping this leaves the card stuck
   rendering "tweaking · queued" in the board's IN PROGRESS lane forever.

`status` stays `TODO`; `name`, `phase`, `dependencies[]` untouched. Re-read `backlog.json` and
confirm all three landed before reporting — same board-app revert guard as the completion/
cancellation writes (`shared/TWEAK-DISCIPLINE.md` § Card pickup): a running `serve-backlog.js` can
silently revert an external write from its in-memory store; re-apply on a revert.

Then finish the tweak run with a two-line report: `Card: {name} → promoted POLISH → {TYPE},
un-queued` (drop "un-queued" when no `transition` was present) + `Pick it up with /game-ship
{name}.` Revert or keep mid-run edits per the § 1 decision.

**No live card** (a genuine free-text run with no guard match) — invoke the `project-todo` skill
(Skill tool) with one sentence: the change description + the escalation reason + touched-file hints
(e.g. _"Add a dash ability with cooldown — origin agent via /game-tweak, parked from /game-tweak
escalation (net-new surface: input action + signal); touches player/player.gd"_). The
`origin agent via /game-tweak` token is mandatory (`shared/BACKLOG.md § Card provenance`) — without
it the card is written as if the user asked for it. project-todo owns naming, type/phase inference,
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
