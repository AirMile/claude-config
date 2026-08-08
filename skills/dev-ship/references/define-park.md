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

Stop the interview immediately (do not finish the current question round).

**Skip this question entirely when the answer is already on screen.** PARK-ESCAPE often fires
*from* an `AskUserQuestion` whose own options already named the outcome (park / close / split /
swap) — re-asking is a double confirmation, and § 2's plan file is the real gate. Skip only on an
explicit match to one of the four outcomes below; a bare "not now" with no outcome named still
asks. Record which option the prior answer resolved to and continue at § 2.

Otherwise, before asking, scan the backlog in memory (loaded in PHASE 0 §4) for swap candidates
per § 3 so the first option can name the best one. AskUserQuestion:

- header: "Park define"
- question: "Park {feature} — how do you want to continue?"
- options (the tool caps at 4 — slot 1 is conditional, so the set is never larger):
  1. "Swap to {best-candidate} (Recommended)" — park {feature} with a note; continue define with
     {best-candidate} in this session. (Only when § 3 finds ≥1 candidate; with none, "Split"
     takes slot 1 and the set is 3 long.)
  2. "Split into smaller cards" — break {feature} into 2+ smaller cards; the parent is cancelled
     as superseded.
  3. "Park + note, stop" — plain park; the card stays `TODO`; end the run.
  4. "Close the card — decided not to build this" — the card goes to `CANCELLED`; end the run.

**"Continue define" is deliberately not a listed option** — a 5th entry makes the call fail
(`SKILL-PATTERNS.md § Modal Option Cap`), and it is the one outcome that needs no option:
PARK-ESCAPE fired from the user's own words, so reverting is one sentence away and the
built-in Other reaches it. On any "never mind" answer → return to the interrupted question;
nothing else in this file applies.

**Park vs. Close** — park is "not now" (the card stays `TODO`, the work is still wanted);
close is "not at all" (`CANCELLED`). Don't infer one from the other: if the user's wording
leaves it genuinely open, the modal above is where they pick.

## 2 — Exit plan mode (terminal gate for this run)

Write a short `## Park — {feature}` section to the plan file (path from Step 2b): the chosen
outcome, the 1–2-line reason, the draft `note` text (park reason + any context the interview
already established), and — for Split — the child-card table (name, type, description, phase,
dependencies) plus the dependent-repoint list; for Swap — the chosen next card; for Close — the
one-line `cancelledReason` plus § 6's dependent list, so the user approves the repoint too and
not just the closure. Then `ExitPlanMode`.

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

Two mechanics those steps assume but never state:

- **The card array is `backlog.features[]`, top-level** — *not* `backlog.data.features[]`
  (`data` holds only `updated`). There is no write helper: `backlog-load.js` is read-only, so
  every backlog **read** in this skill routes through it while the **write** here is hand-rolled.
  Read the file, edit that array, write it back. The `note` is free prose, so the
  `echo '<json>' | node …` form breaks on the first apostrophe — write the note to a temp file
  and read it in, same rule as `shared/SHIP-CHECKPOINT.md § Writing the checkpoint`.
- **Step 3's `rmdir` asserts an empty feature dir** — true on every park (no `feature.json` is
  written before the gate), but verify instead of assuming: a non-empty dir means a write escaped
  plan mode, which is a bug worth surfacing rather than silently working around. Guard it:

  ```bash
  d=".project/features/{feature}"
  [ -z "$(ls -A "$d")" ] && rmdir "$d" || echo "KEPT $d — unexpected files: $(ls -A "$d")"
  ```

**One backlog write, not two.** On Close and Split the § 5 status change (`CANCELLED` +
`cancelledReason` + `cancelledAt`) and § 6's dependent repoint belong in **this same edit** —
step 4 leaves `status` at its prior value only on Plain park and Swap. A concurrent session may
be writing `backlog.json` too, so every extra full-file rewrite is another chance to clobber it.

## 5 — Outcome branches

**Plain park** — after § 4, show `Parked: {feature} — note saved.` If the park reason was about
ordering, add one line: `Tip: /project-plan reorg can re-order the whole backlog (proposal +
confirm).` Do not run it. Then stop — do not continue to Step 5 of phase-0-define-classify.md.

**Close the card** — after § 4 (which already stripped `transition` and wrote the `note`), one
backlog write-batch: `status: "CANCELLED"`, `cancelledReason` (one line, the user's own reason),
`cancelledAt: <YYYY-MM-DD>`. **Keep the `note`** — it carries what the interview established, and
a closed card is exactly where that context would otherwise be lost. Then run § 6 (mandatory).
Show `Closed: {feature} — cancelled, note saved.` plus § 6's `Dependents:` line. Then stop — do
not continue to Step 5 of phase-0-define-classify.md.

**Swap** — after § 4, continue this session at `phase-0-define-classify.md` **Step 1** with the
chosen card as the resolved arg. Step 2a redoes the bookkeeping for the new card (feature dir,
live signal, `transition: "shipping"`, fresh checkpoint), Step 2b re-enters plan mode, and the
define interview runs for the new card. Nothing from the parked card's draft carries over.

**Split** — after § 4, apply `shared/BACKLOG.md § Define-time split` in one backlog write-batch:
parent → CANCELLED (`cancelledReason: "split into: ..."`, `cancelledAt`; the § 4 edit already
stripped `transition` and wrote the `note` — keep the note, it documents the split context),
children pushed (dedup check first), dependents repointed per § 6. Then AskUserQuestion: "Continue
define with {first-child} (Recommended)" → jump to Step 1 with that child as the arg (as in Swap) /
"Stop here" → show the created cards + the reorg tip from Plain park, and stop.

## 6 — Dependent scan (mandatory on every CANCELLED write — Close and Split)

A cancelled card never becomes `shipped`, and `dev-build/references/context-loading.md`
§ Dependency check accepts nothing else (`shipped === true`, or `type === "THEME" && status ===
"DONE"`). So a card still listing this feature in its `dependencies[]` hits a blocker modal on its
next build whose Next-step reads `Run /dev-ship {dep}` — naming a card that will never ship. Run
this in the **same write-batch** as the cancel:

1. Scan `backlog.json#features[]` for entries whose `dependencies[]` contains `{feature}`.
2. **Split** → repoint each to the child that replaces it. **Close** → remove `{feature}` from
   that entry's `dependencies[]`.
3. Log one line: `Dependents: {N} repointed` — or `Dependents: none`.

**Plain park does NOT run this**: the card stays `TODO`, so the dependency is still real and
removing it would hide a genuine blocker.
