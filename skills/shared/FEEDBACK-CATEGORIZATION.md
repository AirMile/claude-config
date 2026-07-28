# Feedback categorization (shared)

The canonical semantics for classifying a failed/flagged verification or playtest item before fixing
it. Used by the dev and game fix loops (`dev-verify` fix-loop, `dev-ship`'s manual round,
`game-ship`'s playtest round, `game-verify`). Centralized so the category meanings and the
SUBJECTIVE-clarify rule live in one place; each caller keeps its own domain examples and fix-routing
mechanics.

## The three core categories

| Category   | Meaning                                                                                                                  | Fix route                                                                                    |
| ---------- | ------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------- |
| TESTABLE   | Wrong behaviour with a **concrete expected value/output** you can assert                                                 | Reproduce with a failing test (RED), fix (GREEN) — test-guarded                              |
| MEASURABLE | A **relative threshold** with no clean unit test — timing, styling, layout, feel, a value that's "too much / too little" | **Direct fix** + re-check (live re-check where an app/game is running); no reproduction test |
| SUBJECTIVE | **Vague** — "feels off", "looks wrong", "doesn't feel right" — not actionable as stated                                  | Cannot fix as-is → clarify first (below)                                                     |

**SUBJECTIVE → clarify → re-categorize (mandatory).** Never hand a SUBJECTIVE item to a fix — ask
**one** clarifying `AskUserQuestion` to make it concrete (which element/target, expected vs seen, too
much/too little, wrong position/timing/behaviour, visual/audio/other), then re-categorize the answer
as TESTABLE or MEASURABLE and route accordingly.

**How to fix, once categorized:** follow `shared/DEBUG-LADDER.md` — MEASURABLE is a tier-1 direct fix;
TESTABLE is tier-2 (confirm the cause with evidence before editing). A failed round escalates a tier.

## Scope check — before categorizing, is this even about the item under test?

Applies whenever live feedback is captured mid-item (`manual-interview-walkthrough.md § Step D` /
`playtest-interview-walkthrough.md § Step D`, reused verbatim by every re-check:
`fix-round.md § Re-check`, `debug-round.md § 8`, `debug-round-heavy.md § 8`, and their game-ship
equivalents). A re-check after a fix commonly finds the fixed part now working, but surfaces
something else adjacent while the app/game happens to be open. Before folding a Fail/Tweak
observation into the current item's evidence, check whether it is actually about that item's own
`expected` text.

- **On-topic** (the observation is about the same expected behaviour, even if only partially
  resolved) → capture as this item's own evidence as usual; the tier-escalation ladder in
  `shared/DEBUG-LADDER.md` applies to it normally — a failed fix round for THIS defect escalates
  one tier.
- **Off-topic** (a distinct capability or defect — same triage as the closing interview's
  net-new-capability branch, just discovered mid-item instead of at the end of the walkthrough) →
  split it off instead of folding it into this item's verdict:
  1. Judge the CURRENT item purely on the on-topic remainder of what was reported.
  2. File the off-topic observation as its **own** new ledger item (fresh id, own
     verdict/category/observed/expected, no `debugTier`/`failedRounds` yet — it starts its own
     escalation lifecycle from scratch; it does not inherit or consume the current item's tier/round
     count).
  3. Classify the new item: **in-scope** (this feature's diff plausibly causes or should cover it) →
     it now blocks completion like any other fail, and gets picked up by the next round-gate pass.
     **Out-of-scope** (pre-existing/tangential — this feature didn't cause it) → route to
     `/project-todo` instead (same policy as the closing-interview's net-new-capability branch;
     write conventions: `shared/BACKLOG.md § Writing the backlog`); it does not block completion. An
     improvement-class observation (works, but could be better) passes `type TWEAK` explicitly to
     `/project-todo`, same as any other tweak offload — a defect-class observation (it's actually
     broken) keeps normal type inference, which lands on `BUG`. **Either way, after the card is
     created, patch the split-off ledger item's own verdict** (`ship-checkpoint.js item {feature}
manual|playtest`, same upsert used to create it) **to `verdict: "offloaded"`, `offload:
"{card-name}"`** — this is what makes "it does not block completion" true (`shared/
SHIP-CHECKPOINT.md`'s `route`/`pendingRound` reader counts `"offloaded"` as resolved same as
     `"tweak"`/`"accepted"`); leaving it at a bare `"fail"` verdict would otherwise dead-lock the
     ledger on an item nothing is going to fix here. `dev-ship`'s exact write sequence:
     `phase-3-manual-finalize.md § Offload flush`.

Default to your own judgement (same as the round gate already does for closing-interview findings);
ask one `AskUserQuestion` only if genuinely ambiguous whether something is in- or out-of-scope.

## Dev-verify's fourth category: SPEC

`dev-verify`'s fix-loop adds a **SPEC** category — an acceptance criterion the implementation does not
meet (the acceptance test fails, not a builder test). It is routed like TESTABLE, except the failing
test **is** the acceptance test (write/update it), and a SPEC miss often needs design thought (plan
mode) rather than a one-line fix. Flows that only judge human-observed items (dev-ship's manual
round, game-ship's playtest round) use the core three; SPEC is specific to `dev-verify`'s
test-driven fix-loop.
