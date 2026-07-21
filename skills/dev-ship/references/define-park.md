# Define park — mid-interview escape + smart park outcomes

Loaded only when PARK-ESCAPE fires: during dev-ship's define (Steps 2c→4, inside plan mode) the
user signalled that this feature should not be built now — "park", "not now", "wrong order",
"another feature first", or any equivalent intent, in an open question, an `AskUserQuestion`
"Other" answer, or plain chat. A feature does not have to be built just because define started —
building in a different order is a legitimate outcome, not a failed run.

Terminology: this "park" returns the card to plain `TODO` (+ a `note`). It is NOT the board's
"parked run" state (an open ship checkpoint) — the cleanup below removes the checkpoint precisely
so no parked-run row lingers. And the Split outcome below is NOT dev-define's PHASE 1c split
(`00-split.md`, sub-features built within this ship run): a park-split creates separate backlog
cards and builds nothing now.

## 1 — Outcome question (still in plan mode)

Stop the interview immediately (do not finish the current question round). Before asking, scan
the backlog in memory (loaded in PHASE 0 §4) for swap candidates per § 3 so the first option can
name the best one. AskUserQuestion:

- header: "Park define"
- question: "Park {feature} — how do you want to continue?"
- options:
  1. "Swap to {best-candidate} (Recommended)" — park {feature} with a note; continue define with
     {best-candidate} in this session. (Only when § 3 finds ≥1 candidate; otherwise "Park + note"
     is the first/Recommended option.)
  2. "Split into smaller cards" — break {feature} into 2+ smaller cards; the parent is cancelled
     as superseded.
  3. "Park + note, stop" — plain park; end the run.
  4. "Never mind — continue define" — resume the interview exactly where it stopped.

"Continue define" → return to the interrupted question; nothing else in this file applies.

## 2 — Exit plan mode (terminal gate for this run)

Write a short `## Park — {feature}` section to the plan file (path from Step 2b): the chosen
outcome, the 1–2-line reason, the draft `note` text (park reason + any context the interview
already established), and — for Split — the child-card table (name, type, description, phase,
dependencies) plus the dependent-repoint list; for Swap — the chosen next card. Then
`ExitPlanMode`.

- **Approve** → writes are allowed; run § 4 cleanup, then the outcome branch (§ 5).
- **Reject** → session stays in plan mode; either resume the interview (user changed their mind)
  or revise the park section (e.g. adjust the split cards) and exit again.
- **User-owned plan mode** (the skip-case in `shared/PLAN-MODE.md`): do not exit — show the park
  summary and ask the user to exit plan mode themselves before you perform the cleanup writes.

## 3 — Swap candidate heuristic (used by § 1)

From `backlog.json#features[]`, dev-track cards only (`type` not PAGE/COMPONENT/THEME), pick the
top 1–3 in this order:

1. **Blockers first** — TODO cards that {feature} lists in its `dependencies[]` (unshipped).
   Building these makes the parked card cheaper later.
2. **Ready same-or-earlier-phase cards** — TODO cards in the same or an earlier `phase` whose
   `dependencies[]` are all shipped/absent; earliest array position first.
3. **Ready TWEAK/VERIFY batch** — ≥2 TWEAK/VERIFY cards whose dependencies have shipped. These
   never swap into dev-ship — offer them as "stop and run /dev-tweak (or /dev-manual for VERIFY
   cards)" instead.

No candidate at all → omit the Swap option in § 1.

## 4 — Cleanup (after plan-mode exit — all outcomes except "continue")

Run the four gate-Abort cleanup steps from `phase-0-fresh-define.md § Step 4b Abort` verbatim
(signal-clear, `rm -f` the ship checkpoint, `rmdir` the empty feature dir, strip
`transition: "shipping"` in backlog.json), with one addition to step 4: **always** write the
`note` field on the card (the text approved in § 2) in the same backlog edit.

## 5 — Outcome branches

**Plain park** — after § 4, show `Parked: {feature} — note saved.` If the park reason was about
ordering, add one line: `Tip: /project-plan reorg can re-order the whole backlog (proposal +
confirm).` Do not run it. Then stop — do not continue to Step 5 of phase-0-define-classify.md.

**Swap** — after § 4, continue this session at `phase-0-define-classify.md` **Step 1** with the
chosen card as the resolved arg. Step 2a redoes the bookkeeping for the new card (feature dir,
live signal, `transition: "shipping"`, fresh checkpoint), Step 2b re-enters plan mode, and the
define interview runs for the new card. Nothing from the parked card's draft carries over.

**Split** — after § 4, apply `shared/BACKLOG.md § Define-time split` in one backlog write-batch:
parent → CANCELLED (`cancelledReason: "split into: ..."`, `cancelledAt`; the § 4 edit already
stripped `transition` and wrote the `note` — keep the note, it documents the split context),
children pushed (dedup check first), dependents repointed. Then AskUserQuestion: "Continue define
with {first-child} (Recommended)" → jump to Step 1 with that child as the arg (as in Swap) /
"Stop here" → show the created cards + the reorg tip from Plain park, and stop.
