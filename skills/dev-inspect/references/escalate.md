# Escalation flow (dev-inspect)

Loaded when the size gate fires (`shared/TWEAK-DISCIPLINE.md § Escalation gate`) — at intake
(PHASE 0), after resolution (PHASE 1), or mid-implement (PHASE 2). Semantics live in
TWEAK-DISCIPLINE; this file is the mechanics. dev-inspect never commits, so there is no baseline
file — take stock from `git status` plus this run's own edit list.

## 1. Freeze and take stock

- Name the criterion that fired (net-new surface / file span / new test surface / architecture /
  tier-3 signals) — it goes in the question and, on override, in the report.
- **Mid-run edits**: list files already modified this run. Default: keep them uncommitted (nothing
  was committed anyway) unless half-applied edits would break the build — then offer a revert.
- **Multi-select nuance**: N cosmetic one-liners across > 3 files fires the file-span criterion by
  letter, not spirit — for a batch of trivially independent one-line styling edits, override (d)
  or splitting the batch into two runs are both legitimate answers; say so in the question.

## 2. Ask

One AskUserQuestion (`multiSelect: false`). When the trigger is a tier-3 debug signal
(TWEAK-DISCIPLINE size-gate criterion 6), swap option (b)'s label/description for the debug target
(`/dev-ship {feature}` debug round, or the inline DEBUG-LADDER tier-3 discipline outside a feature
context).

```yaml
header: "Inspect escalation"
question: "This exceeds pinpoint-edit scope ({criterion}). How to proceed?"
options:
  - label: "Park as TODO (Recommended)"
    description: "One backlog card via /project-todo — pick it up later with /dev-ship"
  - label: "Hand off to /dev-ship now"
    description: "Runs the full define→build→verify→refactor pipeline on this change"
  - label: "Continue in /dev-tweak"
    description: "Still 1-3 files but needs the tweak machinery (commit, guards, learnings)"
  - label: "Continue here (override)"
    description: "Proceed as a pinpoint edit — logged in the report"
```

## 3. Execute the choice

- **(a) Park as TODO** — invoke the `project-todo` skill with one sentence: change description +
  escalation reason + the resolved `file:line` hints + the mandatory provenance token
  (_"origin agent via /dev-inspect, parked from /dev-inspect escalation"_ —
  `shared/BACKLOG.md § Card provenance`). project-todo owns naming, dedup, and the backlog/project dual sync — this skill
  performs zero backlog writes. Finish with two lines: the card name + `Pick it up with /dev-ship {name}.`
- **(b) Hand off to /dev-ship** — resolve mid-run edits first (§ 1), then invoke the `dev-ship`
  skill with the change description as args. Do not pre-create a card: define owns registration.
- **(c) Continue in /dev-tweak** — invoke the `dev-tweak` skill with the change description **and
  the already-resolved `file:line` refs** so its locate step is pre-seeded. dev-tweak re-runs its
  own gate/guard and owns the commit.
- **(d) Override** — return to the interrupted phase and continue. The PHASE 4 report must carry
  `Escalation overridden: {criterion}`. One override covers one criterion — a different criterion
  firing later re-opens this flow.
