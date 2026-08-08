# Debug Round — Heavy (dev-ship PHASE 3, tier 2)

Loaded from `debug-round.md § 8` when the light round's single evidence-backed fix still failed
re-check. This is the ship's own full root-cause machinery for **exactly one ledger item**: heavier
investigation techniques (`shared/DEBUG-TOOLBOX.md § Heavy techniques`), one evidence-backed fix plan
with an explicit scope note, and reproduction-test discipline. It is the hard ceiling of the in-ship
debug ladder — see `shared/DEBUG-LADDER.md` tier 3 — there is no tier beyond this one; if it also
fails, control returns to the user for an explicit accept-or-park decision (§ 8 below), not a further
automated escalation.

Entered one of two ways: a **parked resume** (the light round's own re-check failed in a prior
session, `debug-round.md § 8`'s park path) or a **same-session escalation** (the user chose
"Escalate now" at `debug-round.md § 8`'s choice point, immediately after the light round's own
plan-mode session). Runs in the main chat so `AskUserQuestion`/`ExitPlanMode` reach the real user.

## 1. Entry

One failing ledger item. Read `manual.items[].lightRoundNotes` — the string `debug-round.md § 8`
wrote before parking here: the investigation digest, root-cause hypothesis and why it didn't hold,
the fix attempted, and the re-check observations that followed. This is a **fresh session**, so
nothing from the light round's own reasoning survives except what that string actually contains —
do not assume more context than it holds, and do not re-ask the user anything it already covers.
The ledger item itself still carries the original Step-D evidence (console errors, network
responses, screenshots).

**Same-session entry** (`debug-round.md § 8`'s "Escalate now" choice): `lightRoundNotes` was just
written this same turn — read it from memory, no need to re-fetch from disk. Plan mode is already
active (inherited from the light round's own session) and the live signal is already `waiting:
"fix-plan"` — § 2 and § 3 below are no-ops on this path.

**Non-ledger entry** (build/verify-failure recovery, `SKILL.md § PHASE 1–4`'s failure branch): a
repeated build or auto-verify failure on `/dev-ship {feature}` re-run has no `manual.items` ledger
entry (PHASE 1/2 are autonomous, pre-manual-round) — treat the build/test failure output itself as
the "one failing item": its stack trace / failing assertion is the evidence, `{build|verify}.failedAt`
is the title, and there is no light-tier history to carry (go straight to § 4's re-investigation, not
"reuse the light round's evidence").

## 2. Bookkeeping before plan mode

Reuse the existing `waiting: "fix-plan"` signal — `debug-round.md § 2` already wrote it before this
round's park; on a **parked** resume (`phase-3-manual-finalize.md § Resume entry`, `debugTier:
"heavy"` branch) re-arm it the same way if it isn't already active. On a **same-session entry**, it
is already active — nothing to do here.

## 3. Enter plan mode

`EnterPlanMode` per `shared/PLAN-MODE.md § Entry` — **skip on a same-session entry** (plan mode is
already active, inherited from the light round). On a parked resume, plan mode is essentially never
already active here (unlike the light round, which is sometimes invoked from an already-open
plan-mode session). If the investigation needs a **mutating** repro command (state
reset, migration, destructive fixture), use `shared/PLAN-MODE.md § Administrative exit` — exit with
an administrative note, run it, **re-enter immediately** — never continue the round outside plan
mode silently.

## 4. Re-investigate only if `lightRoundNotes` is insufficient

The common case: `lightRoundNotes`' investigation digest + root-cause hypothesis is still valid
evidence, just not enough to fix on its own (e.g. the hypothesis was right but the fix was
incomplete). Reuse it directly — do not re-run Explore.

Only if `lightRoundNotes` shows the light round's hypothesis was **refuted** by its own re-check
(the fix based on it did nothing, or made it worse), **or** this is a non-ledger entry (§ 1) with no
`lightRoundNotes` at all: run one Explore agent (`model: "sonnet"`) — **read
`.claude/skills/dev-ship/references/debug-explore-agent-prompt.md` first** and use it verbatim as
the prompt template (do not write an ad hoc prompt) — explicitly noting any refuted hypothesis from
`lightRoundNotes` in `PROBLEM` so this pass doesn't repeat it.

**L-tier evidence sources.** By construction, an item that reached this file already carries an
L-tier difficulty score (a light round already failed once — `shared/DEBUG-LADDER.md § Difficulty
triage`'s escalation rule). Read `shared/DEBUG-TOOLBOX.md § Heavy techniques` before re-investigating:
a confirmed regression feeds `git bisect run` instead of another Explore pass; a value mystery feeds
a scripted CDP breakpoint dump; state corruption feeds a state-checkpoint diff. Whichever technique
runs, its output becomes the evidence § 5's fix plan works from — record which one via the
`technique` field on the ledger item.

## 5. Fix plan — one, evidence-backed

> **Todo** (BEFORE drafting the plan below — not after): is the diagnosis still contested?
> `lightRoundNotes` shows the light-tier hypothesis was **refuted** (the same condition § 4 uses to
> re-investigate), or this is a **non-ledger entry** (§ 1) with no prior-tier history to lean on, or
> § 4's own re-investigation came back without a cause. Any of those → Read
> `.claude/skills/shared/SECOND-OPINION.md` and follow it. INPUT = the evidence dossier + the paths
> behind it from Step 4 (debug fix-plan row of § Brief contents). Counterpart: **Fable**.
> **Attended**: show the digest. **Unattended**: Opus weighs it. Set `secondOpinionUsed`
> (round-scoped).
>
> The digest must inform the plan you are about to write. Drafting first and folding the consult in
> afterwards is the failure mode this marker exists to prevent — by then the plan is anchored and
> the consult reads as a review of a decision already made. Skip only when the light round's
> hypothesis survived and § 4 reused it directly.
>
> Firing this consumes the round's one consult slot — § 8's dead-end consult will then log
> `unavailable (budget)` if this round also fails; that is an accepted trade, not a bug (a confirmed
> diagnosis rarely needs a second consult at the ceiling too).

Write ONE fix plan from Step 4's evidence — no agent fan-out; this tier already spent its
evidence-gathering budget getting here, and three agents speculating on identical input adds no new
information. **Spec-issue** items (an acceptance criterion was implemented wrong, not just its
symptom) get the same single plan — write it to fix the deviation itself, not only the visible
symptom.

```
Root cause: {claim} — evidence: {file:line / log / failing assertion}
Fix: {change}
Scope note — deliberately NOT done:
  - narrower hotfix: {…} → rejected because {…}
  - broader hardening: {…} → deferred because {…}
Risk / blast radius: {files, contracts, migrations}
Reproduction test assertion: {what the test must assert to prove the bug}
```

The scope note is the point of writing this out explicitly: it's the same judgment call a
minimal-vs-thorough-vs-defensive choice used to force, now made once, in the open, as part of the
plan itself rather than as three competing drafts.

## 6. Plan approval

`ExitPlanMode` once the fix plan is written — present it as the plan output. **Reject** → stay in
plan mode, revise from the feedback, re-present, loop until accepted.

## 7. Reproduction test

**Goal**: prove the bug with a failing test before the fix — objective proof the fix works, not a
guess.

### Step 1: Determine testability

Default for Runtime Error / Logic Bug: skip the question, go directly to Step 2.

For Visual/UI / Performance / Integration / non-runtime bugs, AskUserQuestion — header:
"Reproduction Test", question: "Is this bug testable in an automated test?":

- "Yes, write reproduction test (Recommended)" — standard path for assertable bugs
- "Playwright visual baseline — UI visual / CSS" — `toHaveScreenshot()` baseline (runner required)
- "DOM assertion — Visual/UI structural" — assert computed style/position/class, no screenshot runner
- "No, skip — direct fix + live re-check" — MEASURABLE visual/timing tweak, no test

**"Playwright visual baseline" chosen**: Read
`.claude/skills/dev-ship/references/debug-playwright-visual-baseline.md` — runner check + spec.
Skips Step 2; continue at Step 4.

**"DOM assertion" chosen**: write a test asserting the element's computed style/position/class,
failing before the fix — continue at Step 2's run/verify.

**"Skip" chosen**: note `reproductionTest: { skipped: true, reason: "{reason}" }`, go to § 8. For a
MEASURABLE skip, apply the direct fix and confirm live (per `shared/DEBUG-LADDER.md` tier 1).

### Step 2: Write failing test

- Location: **default** — add to the existing test file covering the buggy code, with a
  `// REGRESSION: {issue}` marker comment on the new test. Use a new
  `test/regression/{slug}.test.{ext}` file only when the project already has an established
  `test/regression/` convention (check for the directory first) — do not create one ad hoc, and do
  not skip the marker comment on the default path.
- Framework: detect from `package.json` (vitest/jest/node:test) or project convention.
- Assert the **expected** behavior (not the buggy one). Include the input/setup that triggered the
  bug (from the ledger + § 4 investigation).

### Step 3: Run the test

```bash
{npm test command} -- {test file pattern}
```

| Result                                    | Reason                                | Action                  |
| ----------------------------------------- | ------------------------------------- | ----------------------- |
| FAIL, assert mismatch matching root cause | Bug correctly reproduced              | ✓ Continue to § 8       |
| FAIL, compile/setup error                 | Test itself is broken                 | Fix the test, run again |
| PASS unexpectedly                         | Bug not reproduced / root cause wrong | Back to § 4/5           |

### Step 4: Confirm

Print this block verbatim — a prose description of the same facts does not satisfy this step:

```
REPRODUCTION TEST: {file}:{line}
Expected fail reason: {root cause}
Actual fail: {error output, max 5 lines}
Status: ✓ Bug reproduced
```

## 8. Implementation, verification, re-check

**Implementation**: apply the fix from § 5's plan. With a reproduction test written, the concrete
success criterion is that test going green — do not change more than that test + the fix-plan scope
needs.

**Verification**: re-run the reproduction test (skip if § 7 was skipped — go straight to live
re-check). Full-suite regression is **not** re-run here — `phase-3-manual-finalize.md § Regression
re-check` already covers the whole PHASE 3 scope once, right before completion.

**Re-check**: Read `manual-interview-walkthrough.md` Steps B–E and follow their item-presentation
format for this one item (no new interview close).

- **Pass** → clear the item's `debugTier`, set `verdict: "pass"`. Return to
  `fix-round.md § Re-check` for any remaining items already mid-round, back to
  `phase-3-manual-finalize.md § Findings ledger + routing` if the scope check in
  `manual-interview-walkthrough.md § Step D` split off a new item that hasn't been through a
  round-gate pass yet, straight to the regression re-check if this was the last open item, or — if
  another open item carries its own `debugTier` — route it per `phase-3-manual-finalize.md § Resume
entry`'s per-item precedence.
- **Cosmetic tweak surfaces, and it's the only thing still open** → inline polish loop in this same
  chat (app is already running, plan mode already closed) — no new round, no park. Same skip-condition
  **and** capped mechanics as `fix-round.md § Re-check`'s cosmetic branch (3 attempts, `tweakAttempts`
  tracked on the item). If it doesn't converge after 3 tries, **"Escalate" folds into this section's
  own "Still failing" branch below** (Accept anyway / Park) — heavy has no further tier to escalate
  to, so escalating here means the same accept-or-park choice as any other still-failing item at the
  ceiling.
- **Still failing** → this is the hard ceiling; no further automated tier exists. **Re-score
  first** — re-run `shared/DEBUG-LADDER.md § Difficulty triage` (a failed heavy round is new
  evidence too, even with nowhere further to escalate; the updated score is still worth recording
  for whoever reviews the accept/park outcome). Patch the item (`heavyRoundFailed: true`, keep
  `debugTier: "heavy"`, the re-scored `difficulty`/`difficultySignals`), `signal-clear`.

  > **Todo** (BEFORE the modal below — the dead-end itself is always a valid trigger; skip only if
  > `secondOpinionUsed` is already set this round): Read
  > `.claude/skills/shared/SECOND-OPINION.md § Spawn` and consult with INPUT = the reproduction
  > test path, this round's plan file, the failed-fix file paths (`git diff --stat`), and ≤10 lines
  > of failing output (debug-ceiling row of § Brief contents). Show the digest, set
  > `secondOpinionUsed`. **Attended**: the digest's RECOMMENDATION informs the modal below but never
  > picks for the user. **Unattended**: Opus weighs the digest itself before choosing an option below
  > and logs `→ revised`/`→ confirmed` accordingly. Carry the outcome to the report's `Consult:` row.
  >
  > A ceiling consult routinely disagrees with the accept-or-park framing itself — it may show that
  > a measurement the round treated as proof was an inference, and name a cheaper probe than either
  > option offers. Present the modal only after the digest is on screen.

  Then a single `AskUserQuestion` — no "another round" option; the only escalation left is
  accept-or-park, with the digest (if any) visible above it:
  1. **"Accept anyway (Recommended)"** — mark the item `verdict: "accepted"` with the failure noted as a known
     limitation (never silently DONE — this requires the explicit choice). Also **clear the ladder
     markers**: the `item` subcommand upserts by id and replaces the whole object, so re-send the
     full item with `debugTier`, `heavyRoundFailed`, and `tweakAttempts` (if set) omitted (not set
     to `null` — omit them entirely) rather than a partial patch. Without this, a later resume's
     per-item precedence (`phase-3-manual-finalize.md § Resume entry`, bullets 1–2) would route this
     already-accepted item straight back into the heavy round. Proceed to the regression re-check
     with this item excluded from the pass/fail count.
  2. **"Park — leave this item open"** — checkpoint stays as-is (`debugTier: "heavy"`,
     `heavyRoundFailed: true`). Print a park/handoff message in **own wording** — do NOT reuse
     `SKILL.md § PHASE 1–4`'s manual-items-remain template; its "you land directly in the
     item-by-item manual round" line is wrong here (mirrors `fix-round.md § Re-check`'s Otherwise
     bullet) — state which item parked and why, with `/dev-manual {feature}` as the resume command
     (`/dev-ship {feature}` still resumes to the same place). A
     later resume re-enters this same § 8 re-check directly (nothing to redesign — the plan already
     exists) rather than restarting § 4–7. If other ledger items are still open at a different stage
     (different `debugTier`/no attempt yet) and are file-disjoint from this one, they may be finished
     in the same session before the turn actually ends — see
     `phase-3-manual-finalize.md § Resume entry`'s "handle each via its own highest-matching bullet."
