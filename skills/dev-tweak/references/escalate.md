# Escalation flow (dev-tweak)

Loaded when the size gate or backlog guard fires (`shared/TWEAK-DISCIPLINE.md § Escalation gate`) —
at intake (PHASE 0) or mid-implement (PHASE 2/3). Semantics live in TWEAK-DISCIPLINE; this file is
the mechanics.

## 1. Freeze and take stock

- Name the criterion that fired (net-new surface / file span / new test surface / architecture /
  guard hit / tier-3 signals) — it goes in the question and, on override, in the report.
- **Mid-run edits**: list files already modified since `pre-tweak-status.txt`. Decide the default:
  keep them uncommitted (the ship's own baseline will categorize them OVERLAP/PRE-EXISTING) unless
  they are half-applied and would break the build — then offer revert to baseline.

## 2. Ask

One AskUserQuestion (`multiSelect: false`). When the trigger is a tier-3 debug signal
(TWEAK-DISCIPLINE size-gate criterion 6), swap option (b)'s label/description for the debug target.

**Park-as-TODO is the default, and stays the default even when a plan already exists in this chat.**
The reason is context, not effort: `/dev-ship`'s define phase runs cleaner on a fresh chat than
continued inside this tweak+planning-loaded session — no compaction pressure, no carried-over intake
history. "Hand off now" only wins when the user explicitly wants to keep going this instant. Do not
promote (b) to Recommended because a design already got approved.

```yaml
header: "Tweak escalation"
question: "This exceeds tweak scope ({criterion}). How to proceed?"
options:
  - label: "Park as TODO (Recommended)"
    description: "One backlog card via /project-todo — pick it up with a
      fresh /dev-ship in a NEW chat (clean context, no tweak-run history
      carried in)"
  - label: "Hand off to /dev-ship now"
    description: "Runs the full pipeline in THIS chat — only if the user
      wants to continue immediately; carries this run's context forward"
  - label: "Continue as tweak (override)"
    description: "Proceed anyway — logged in the report"
```

Tier-3 variant of option (b): label `"Run a debug round now"`, description `"Evidence-first
root-cause flow — /dev-ship {feature} debug round, or the inline DEBUG-LADDER tier-3 discipline
when no feature/worktree is active"`.

## 3. Execute the choice

**(a) Park as TODO** — **a live card is already in play** (card mode, or a free-text guard match) →
the card already exists as `TODO`, so parking touches no status/type field. Do **not** invoke
`project-todo` here — at best it dedups back to the same card, at worst a token-overlap miss creates
a stray `-2` duplicate.

**Un-queue the board marker first.** If this card carries `transition: "tweaking"` — the board sets
that the moment its `/dev-tweak` copy button was clicked (`shared/TWEAK-DISCIPLINE.md` § Escalation
gate (a)) — remove that one field from `backlog.json#features[]` via a targeted `Edit` before
reporting. Nothing else consumes it once this run bails instead of finishing the tweak, so skipping
this leaves the card stuck rendering "tweaking · queued" in the board's IN PROGRESS lane forever.
Re-read `backlog.json` and confirm the field is gone before reporting — same board-app revert guard
as the completion/cancellation writes (`shared/TWEAK-DISCIPLINE.md` § Card pickup): a running
`serve-backlog.js` can silently revert an external write from its in-memory store; re-apply on a
revert. No `transition` present → nothing to do here. Either way, `status` stays `TODO` — never
touched.

Then finish the tweak run with a two-line report:

- the card name and `Pick it up with /dev-ship {name}.` (add `Card: {name} → un-queued` when the
  marker was cleared)
- revert or keep mid-run edits per the § 1 decision

**No live card** (a genuine free-text run with no guard match) — invoke the `project-todo` skill
(Skill tool) with one sentence: the change description + the escalation reason + touched-file hints
(e.g. _"Add bulk-select to the file navigator — parked from /dev-tweak escalation (net-new surface);
touches src/components/navigator"_). project-todo owns naming, type/phase inference, dedup, and the
backlog/project dual sync — this skill performs zero backlog writes. Then finish with the same
two-line report using the name project-todo returns.

**(b) Hand off to the pipeline** — resolve mid-run edits first (§ 1), then invoke the `dev-ship`
skill (Skill tool). **A live card is already in play** (card mode, or a free-text guard match) →
always pass that card's exact `name` as args, never a re-derived description — its define phase
resumes the card in place (and promotes it out of `type: "TWEAK"`, see
`dev-ship/references/dev-define/references/phase4-sync.md` § TWEAK promotion) instead of
creating a duplicate. **No live card** → pass the change description as args; define registers a
fresh feature as it always does. Do **not** pre-create a card: define owns registration. For tier-3
debug signals, follow DEBUG-LADDER's dev route instead: an active feature → `/dev-ship {feature}`
(its debug round); no feature context → apply the tier-3 discipline inline per `DEBUG-LADDER.md`. If
the user prefers a fresh session, fall back to (a) and print the `/dev-ship {name}` command.

**(c) Override** — return to the phase that was interrupted and continue as a tweak. The PHASE 4
report must carry `Escalation overridden: {criterion}`. One override covers one criterion — a
_different_ criterion firing later re-opens this flow.
