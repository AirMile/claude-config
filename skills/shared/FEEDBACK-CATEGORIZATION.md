# Feedback categorization (shared)

The canonical semantics for classifying a failed/flagged verification or playtest item before fixing
it. Used by the dev and game fix loops (`dev-verify` fix-loop, `dev-ship` / `game-ship` manual
round, `game-verify`). Centralized so the category meanings and the SUBJECTIVE-clarify rule live in
one place; each caller keeps its own domain examples and fix-routing mechanics.

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

## Dev-verify's fourth category: SPEC

`dev-verify`'s fix-loop adds a **SPEC** category — an acceptance criterion the implementation does not
meet (the acceptance test fails, not a builder test). It is routed like TESTABLE, except the failing
test **is** the acceptance test (write/update it), and a SPEC miss often needs design thought (plan
mode) rather than a one-line fix. Flows that only judge human-observed items (the ship manual round,
playtest) use the core three; SPEC is specific to `dev-verify`'s test-driven fix-loop.
