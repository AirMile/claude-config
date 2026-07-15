# Debug ladder (shared)

A signal-driven escalation ladder for fixing a reported issue. Loaded on demand by the fix paths
that hand the model something to fix — ship manual-fail routing (`phase-3-manual-finalize.md`,
`phase-3-playtest.md`), `dev-ship`'s in-ship debug rounds (`debug-round.md`/`debug-round-heavy.md`),
`game-debug` after intake, `dev-verify`'s fix-loop. The point is to spend effort **in proportion to
how well the cause is understood**, and to stop the failure mode where the model guesses a fix, it
doesn't work, and it guesses again with the same information.

## Tier the work by what you can observe (not by a self-estimated "chance of success")

Do **not** self-rate confidence — LLM confidence is poorly calibrated and tends to run high. Pick
the entry tier from **observable signals** about the issue, and let a **failed fix round** — the one
reliable signal — force escalation.

| Tier                         | When (observable signals)                                                                                                                                                    | What you do                                                                                                                                                                                        |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **1 — Direct fix**           | Symptom **and** cause are both visible; the change is a known value: styling/CSS, timing, config, copy, a MEASURABLE threshold; **≤ 1–2 files**.                             | Make the change, re-check live (reload the running app / re-run the one check). No test, no agent, no investigation.                                                                               |
| **2 — Hypothesis first**     | The symptom is clear but the cause is **not** yet proven: a TESTABLE logic bug, a wrong value with an unclear source, behaviour that depends on state.                       | Write the hypothesis down **before editing**, gather evidence to confirm it, fix, verify, clean up (see below).                                                                                    |
| **3 — Full root-cause flow** | Cause spans **multiple modules**, the failure is **intermittent**, it involves concurrency/integration/data you can't see, **or a prior tier already failed** on this issue. | **dev**: the ship's own `debug-round.md` → `debug-round-heavy.md` (in-ship, no standalone command). **game**: hand to `/game-debug`: reproduction test, investigation agent, fix-strategy fan-out. |

**Entry rule:** MEASURABLE + localized → tier 1. TESTABLE or cause-unclear → tier 2. Cross-module /
intermittent / a previous session already tried and failed → tier 3.

**dev and game diverge at tier 3.** Inside `dev-ship` PHASE 3, tier 2→3 is fully in-ship and
park-first: a failed batch fix parks to `debug-round.md` (Explore investigation + research + one
evidence-backed fix, via a fresh `/dev-manual {feature}` resume — or `/dev-ship {feature}`, same
result — never inline in the same session that produced the failed attempt); if that also fails it
parks again to `debug-round-heavy.md`
(3-strategy fan-out + reproduction-test discipline) — the hard ceiling, see `fix-round.md § Re-check`
for the full ladder (progress tracked via the ledger item's `debugTier`, not a `failedRounds` menu).
Inside `game-ship` PHASE 3, tier 2→3 still runs the ship's own `references/debug-round.md` first
(same Explore + research + single fix, inline in the same session's plan mode) and only a failed
debug round hands off to the standalone `/game-debug` skill — see `game-ship/references/fix-round.md
§ Re-check` for its `failedRounds` ladder. **Outside any ship pipeline** (a one-off fix request with
no active feature/worktree), there is no standalone tier-3 command anymore — apply the same
discipline inline: an Explore investigation, a single evidence-backed fix plan, then escalate to a
fan-out only if that fails, following `debug-round.md`/`debug-round-heavy.md`'s structure by hand.
Outside a ship pipeline, a **tier-1/2-sized** fix request is `/dev-tweak` · `/game-tweak` territory
(`TWEAK-DISCIPLINE.md`) — tier-3 signals are an escalation criterion there, routing to `/game-debug`
(game) or a `/dev-ship` debug round / the inline discipline above (dev).

## Tier 2 — the hypothesis loop (the discipline that prevents guess-and-check)

1. **State the hypothesis before touching code**: "I think the cause is X; if so I expect to see Y
   (a log value, a DOM node, a network response, a failing assertion)."
2. **Instrument to get Y** — the cheapest evidence that confirms or kills the hypothesis: a targeted
   `console.log` + read the browser console, the network tab, one Playwright screenshot, a temporary
   assertion, a breakpoint-style log. The app is usually already running here — this is cheap.
3. **Read the evidence.** Hypothesis **confirmed** → fix the proven cause. Hypothesis **refuted** →
   go back to step 1 with a _new_ hypothesis from what you just saw. **Never** skip to a different
   fix without new evidence — an untested second guess is the same mistake as the first.
4. **Verify** the fix reproduces green (the check that failed now passes; re-check live for visual).
5. **Remove the instrumentation** you added (logs, temp assertions) before completing.

If the hypothesis (tier 2) or the fix-strategy fan-out (tier 3) implicates an external library API,
research it per `shared/CONTEXT7.md` before fixing — both tools work inside plan mode.

## Escalation rule (hard)

**Every failed fix round escalates exactly one tier.** A failed attempt is proof the working
hypothesis was wrong, so retrying at the same tier with the same information just burns rounds — the
exact loop the user feels as "I keep saying what's wrong and it still doesn't get fixed." Tier 1 miss
→ tier 2 (stop tweaking blind, get evidence). Tier 2 miss (hypothesis confirmed-and-fixed but symptom
persists, or two hypotheses refuted) → tier 3 (`debug-round.md` → `debug-round-heavy.md` for dev,
`/game-debug` for game). Never repeat a tier on the same issue without new evidence in hand.

## Difficulty triage (before tier entry, re-scored every failed round)

Tier (1/2/3) decides **how much process** a fix gets — this triage decides **which technique**
within that process actually produces the evidence a hypothesis needs. Score five observable
signals, each 0 or 1, before the first debug round for an issue and again after **every** failed
round (new evidence changes the score — never reuse a stale one):

| Signal          | 0                                         | 1                                                     |
| --------------- | ----------------------------------------- | ----------------------------------------------------- |
| Error evidence  | A stack trace/error points at a location  | No error, or the error is misleading/swallowed        |
| Reproducibility | Deterministic, known repro steps          | Intermittent, timing-dependent, "sometimes"           |
| Origin          | New code from this round                  | Regression in previously-working code                 |
| Boundary        | Confined to one tier (pure FE or pure BE) | Crosses frontend↔backend (payload/contract/auth/CORS) |
| Mechanism       | Logic/syntax/wrong value                  | Async/race/ordering/state-dependent/cache             |

Sum the score: **S** (0–1) — the tier-1 direct fix or a quick console check already suffices, no
extra technique needed. **M** (2–3) — gather evidence with a technique before hypothesizing (don't
skip straight to a guess just because the tier feels light). **L** (4–5, or any intermittent
symptom / confirmed regression) — reach for the heavier techniques; the fix is expensive, cheap
guessing wastes more than it saves.

Record the score (`difficulty: "S"|"M"|"L"` + a compact `difficultySignals` note, e.g.
`"no-trace,cross-boundary (2)"`) on the ledger item alongside `debugTier`. Read
[DEBUG-TOOLBOX.md](DEBUG-TOOLBOX.md) for the technique menu the score selects from, and record which
technique ran (`technique` field) when one did.

**This triage never substitutes for the escalation rule above** — a failed round still escalates
exactly one tier regardless of difficulty score; the score only ever picks the technique used
_within_ whatever tier the ladder already put you on.

## Anti-patterns (what this file exists to stop)

- **Guess-and-check** — editing before you can name the cause and the evidence for it.
- **Shotgun edits** — changing several things at once so you can't tell which mattered.
- **Re-sending the same fix** reworded, or a sibling of it, after it failed once.
- **Fixing without confirming the diagnosis** — treating a plausible cause as the proven one.
- **Claiming "fixed" without a green check or a user/live confirmation** — "should work now" is not
  verification. A fix is done when the failing check passes or the user confirms it live.
