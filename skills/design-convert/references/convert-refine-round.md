# PHASE 3.5: Refine With the User

The first time the user sees the generated page. Everything before this point is
Claude checking its own work against the source; this is the only phase that
checks it against what the user actually wanted.

Runs after PHASE 3 exits and before any PHASE 4 bookkeeping. Nothing here writes
to the backlog, the handoff, or git — a run that ends in this loop leaves no
half-finished "built" state behind.

## 3.5a Show the result

Do not describe the page. Show it.

1. `SendUserFile` the last round's full-page screenshot with `display: "render"`
   and `status: "normal"`. Desktop always; add the mobile capture when PHASE 2
   emitted responsive prefixes. Caption names the route and the round.
2. `$SCOPE = patch` or `audit`: send the before/after pair instead of one image
   when a before-screenshot exists (`$BEFORE_SCREENSHOT`, or the audit's
   pre-patch render) — the change is the point, not the page.
3. If the dev server is still up, also print the page URL as a plain `http://`
   URL on its own line so the user can click through to the live page. The
   screenshot is the artifact; the URL is the follow-up, not a replacement.

A run that reports "match quality High" without having sent an image has not
executed this phase.

## 3.5b Ask

```yaml
header: "Refine"
question: "Round {n} — is this right, or does something need to change?"
options:
  - label: "Looks right (Recommended)", description: "Move on to completion: backlog, commit, report"
  - label: "Something needs to change", description: "Describe what — I'll adjust it and show you again"
multiSelect: false
```

The `(Recommended)` marker moves to "Something needs to change" from round 2
onward only if the previous round's answer was free text — a user who is
correcting is not finished by default.

## 3.5c Iterate

**There is no round cap.** The loop ends when the user says it is right, not when
a counter runs out. A pixel-diff loop can be capped because it converges on a
fixed target; this one cannot, because each answer can introduce a new target.

Per round:

1. Apply the requested edits. Corrections arrive as prose, often several at once
   — restate them as a numbered list before editing, so none of the tail gets
   dropped, and so the user can see one was misread before the code changes.
2. Re-render and re-capture with the vehicle already resolved at 3.0
   (`$BROWSER_VEHICLE`) — do not re-resolve it, and do not re-run the whole §3.2
   checklist. Run only §3.2c against the values this round touched, plus the seam
   eval when a section's block-start margin or padding changed.
3. Go back to 3.5a. Increment `{n}`.

**Preserved files stay preserved.** A correction that can only be satisfied by
restyling a file in `$PRESERVE` (0.6b) is blocked, not silently applied: say
which file, which correction, and offer to lift it out of `$PRESERVE` for this
run. The user removing it is a decision; you removing it is the bug 0.6b exists
to prevent.

**Soft checkpoint from round 3.** Do not stop, do not cap — offer a fork:

```yaml
header: "Continue"
question: "Round {n}. {k} item(s) still open. Finish them now, or park the rest?"
options:
  - label: "Keep refining (Recommended)", description: "Carry on in this run"
  - label: "Park the rest", description: "Commit what stands now; the open items become backlog cards via PHASE 4.3"
multiSelect: false
```

On "Park the rest": carry the open items into PHASE 4.3's gap-discovery as
`FEATURE` entries with `source: "/design-convert"`, then continue to PHASE 4.

## 3.5d Record

Before leaving the phase, hold these for the completion report — `convert-completion.md`
§4.4 reads them and §4.4b's two buckets are built from them:

```
REFINE ROUNDS
════════════════════════════════════════════════
Rounds:     [n]
Applied:    [one line per accepted correction, file:line]
Preserved:  [$PRESERVE paths, or none]
Parked:     [items handed to 4.3, or none]
════════════════════════════════════════════════
```

`Rounds: 1` (accepted immediately) is a normal, good outcome — report it, don't
treat it as a phase that was skipped.

**This block is the artifact PHASE 4 reads.** `convert-completion.md § 4.4`
takes `refineRounds` and 4.4b's Applied/Preserved/Parked buckets from it, and is
forbidden to source them anywhere else. A run that reaches PHASE 4 without this
block having been printed did not execute this phase — the honest report line is
`Refine: NOT RUN — convert-refine-round.md was skipped`, not a count recalled
from the conversation. Print the block.

<!-- Rationale: a real run refined six times across four user messages, marked
its PHASE 3.5 task completed, and never opened this file. The path was named in
three places (route-convert.md task seed, plan block, Todo marker) and none of
them forced the Read. What was missing is a printed artifact whose absence is
detectable downstream — §3.2's ROUND ASSESSMENT has exactly that anchoring and
survived the same run; this phase had none, and shipped refineRounds: 5 in
devinfo next to "Refine: 6 rounds" in the report. -->

**Do not clean up `.project/tmp/verify-round-*.png` here.** That happens in
`convert-completion.md` §4.5, after this loop is closed — deleting them mid-loop
destroys the comparison evidence for the next round.

Then continue to PHASE 4. §4.4b no longer loops back to collect changes: this
phase is where changes are collected, and 4.4b reports what was decided.
