# Durable-decisions check (dev-tweak)

Loaded from PHASE 1 step 4, and only once the grep there actually matched a `feature.json` —
the common case (a tweak touching files no pipeline feature ever built) never reaches this file.

This is dev-tweak's only route back to a feature's already-settled design questions:
`durableDecisions[]` has no other reader on the modify path (`shared/FEATURE-LOAD.md`).

## 1. Rank the matches

The projection itself already ran in SKILL.md PHASE 1 step 4 (that step only reaches this file when
at least one projected entry carries a `constraint` or `chosen`) — `feature.json`'s
`rationale`/`finding` narratives run to thousands of words, so never full-Read one here either.

Multiple features matched the grep → rank by how many of the located files each feature's
`files[].path` covers (a feature naming two of your three files outranks one naming a single
monolithic file that every feature touches), then by most recently modified. Project the top
**two**, each labelled separately — never merged, never the whole match set.

A projected decision that plainly concerns a different subsystem than the located change is not a
constraint on this tweak: say so in one clause and move on. Only a `constraint`/`chosen` that
actually touches the code being edited binds PHASE 2 per § 2.

## 2. Hold them as hard boundaries

`durableDecisions[]` present and non-empty → each entry's `constraint`/`chosen` binds PHASE 2 with
the same standing as `clarifications[]` in dev-build. A tweak whose natural edit would contradict
one — re-introducing a rejected option, violating a recorded constraint — must instead follow the
recorded `chosen` approach, or escalate via `references/escalate.md` when it cannot honor it within
1-3 files.

Empty array, or the field is absent → nothing to hold, proceed as normal.
