# Reorg mode — smart backlog re-order (proposal + confirmation)

`/project-plan reorg`. Re-orders the open backlog without touching card content: dependencies
first, phase grouping restored, and the TWEAK/VERIFY/SECURITY cards (which sit outside the phase
pipeline — lifecycle TODO → shipped) clustered sensibly. Nothing is written until the user
confirms. See `shared/BACKLOG.md § Reordering` for the ownership rules.

## 1 — Load + scope

Read `.project/backlog.json` (missing → `No backlog found — run /project-plan first.`, stop).
The **movable set** is: cards with `status === "TODO"` and dev-track `type` (not
PAGE/COMPONENT/THEME — design-track order is owned by the design flow and left untouched).
Everything else (DEFINED/DOING/DONE/CANCELLED, design-track) is **fixed**: it keeps its exact
array index. The reorder fills the array slots the movable set currently occupies — same
mechanic as the board's drag-reorder (`backlog-template.html` `reorderFeature()`), batch form.

## 2 — Compute the proposed order (in memory)

For the movable set:

1. **Phase-order + dependency invariant.** No card may sit in a later phase than a card that
   depends on it (transitively) — promote dependencies up a phase where violated (record as a
   `phase` reassign with reason). Mirrors SKILL.md PHASE 3 step 2.
2. **Sort** — the generate-backlog.md rules, re-applied: group P1→P2→P3→P4; within a phase,
   topological sort on `dependencies[]` (deps earlier); tie-break higher `risk` first, then
   current array order (stable — no gratuitous moves).
3. **Cluster TWEAK/VERIFY/SECURITY** (phase ordering means little to them):
   - parent dependency still open (TODO/DEFINED in the array) → place the card directly after
     that parent ("do the tweak right after its feature").
   - all dependencies shipped/absent → the card is **ready now**: hoist it to the front of its
     phase group as a ready-batch, ordered SECURITY → VERIFY → TWEAK (audit findings first),
     grouped by type so a batch run (/dev-tweak, /dev-manual) is one contiguous block.
4. **Ready detection** — any other TODO card whose `dependencies[]` are all shipped gets the
   reason tag `ready — all deps shipped` (visibility, may move it up within its layer).

## 3 — Proposal (compact before/after)

Show only moved or phase-changed cards plus a summary line ("N cards re-ordered, M phase
reassigns, K unchanged"):

| #   | card      | phase | pos | reason                                  |
| --- | --------- | ----- | --- | --------------------------------------- |
| 1   | {name}    | P2→P1 | 7→2 | dependency of {x}, promoted (invariant) |
| 2   | tweak-{y} | P1    | 9→3 | ready batch — parent shipped            |

Then AskUserQuestion — header "Backlog reorg", question "Apply this order?":

- "Apply (Recommended)" → § 4
- "Adjust" → free-text (names/positions/phrases); re-derive, re-show, re-ask (loop)
- "Cancel" → no writes, stop.

## 4 — Write (single batch)

One edit of `.project/backlog.json`: re-fill the movable slots with the confirmed order, apply
the recorded `phase` reassigns, set `updated` to today. Change **nothing else** — never
`status`, `transition`, `source`, descriptions, or any design-track/fixed card. INDEPENDENT
cards may move (order is not ownership — `shared/BACKLOG.md § Source field convention`).
Output: `REORG APPLIED — {N} moved, {M} phase reassigns. Board: /project-app`.
