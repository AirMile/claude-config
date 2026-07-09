# Debug Round — Heavy (dev-ship PHASE 3, tier 2)

Loaded from `debug-round.md § 8` when the light round's single evidence-backed fix still failed
re-check. This is the ship's own full root-cause machinery for **exactly one ledger item**: a
3-strategy fix fan-out (mirrors `fix-minimal`/`fix-thorough`/`fix-defensive`) plus reproduction-test
discipline. It is the hard ceiling of the in-ship debug ladder — see `shared/DEBUG-LADDER.md` tier 3
— there is no tier beyond this one; if it also fails, control returns to the user for an explicit
accept-or-park decision (§ 8 below), not a further automated escalation.

Always entered via a **parked resume** (`fix-round.md § Re-check` → light round parks again on its
own failed re-check, setting the item's `debugTier: "heavy"` before parking) — never inline in the
same session that ran the light round. Runs in the main chat so `AskUserQuestion`/`ExitPlanMode`
reach the real user.

## 1. Entry

One failing ledger item. Read `manual.items[].lightRoundNotes` — the string `debug-round.md § 8`
wrote before parking here: the investigation digest, root-cause hypothesis and why it didn't hold,
the fix attempted, and the re-check observations that followed. This is a **fresh session**, so
nothing from the light round's own reasoning survives except what that string actually contains —
do not assume more context than it holds, and do not re-ask the user anything it already covers.
The ledger item itself still carries the original Step-D evidence (console errors, network
responses, screenshots).

**Non-ledger entry** (build/verify-failure recovery, `SKILL.md § PHASE 1–4`'s failure branch): a
repeated build or auto-verify failure on `/dev-ship {feature}` re-run has no `manual.items` ledger
entry (PHASE 1/2 are autonomous, pre-manual-round) — treat the build/test failure output itself as
the "one failing item": its stack trace / failing assertion is the evidence, `{build|verify}.failedAt`
is the title, and there is no light-tier history to carry (go straight to § 4's re-investigation, not
"reuse the light round's evidence").

## 2. Bookkeeping before plan mode

Reuse the existing `waiting: "fix-plan"` signal — `debug-round.md § 2` already wrote it before this
round's park; on resume (`phase-3-manual-finalize.md § Resume entry`, `debugTier: "heavy"` branch)
re-arm it the same way if it isn't already active.

## 3. Enter plan mode

`EnterPlanMode` per `shared/PLAN-MODE.md § Entry` — this is a fresh resume session, so plan mode is
essentially never already active here (unlike the light round, which is sometimes invoked from an
already-open plan-mode session).

## 4. Re-investigate only if `lightRoundNotes` is insufficient

The common case: `lightRoundNotes`' investigation digest + root-cause hypothesis is still valid
evidence, just not enough to fix on its own (e.g. the hypothesis was right but the fix was
incomplete). Reuse it directly — do not re-run Explore.

Only if `lightRoundNotes` shows the light round's hypothesis was **refuted** by its own re-check
(the fix based on it did nothing, or made it worse), **or** this is a non-ledger entry (§ 1) with no
`lightRoundNotes` at all: run one Explore agent via
`.claude/skills/dev-ship/references/debug-explore-agent-prompt.md`, explicitly noting any refuted
hypothesis from `lightRoundNotes` in `PROBLEM` so this pass doesn't repeat it.

## 5. Triage gate — skip the fan-out for trivial fixes

Skip the 3-agent dispatch when ALL of:

- Root-cause confidence is **high** from Step 4's evidence
- Fix scope is small: ≤2 files, no API/schema/contract change
- Not a **spec-issue** (an acceptance criterion was implemented wrong — that needs the
  fix-thorough perspective)

→ Write ONE inline fix plan (minimal-style: smallest change that addresses the root cause) with the
same fields the agents below return — changes with file:line refs, risk, scope, trade-offs, and the
reproduction test assertion. Show: `TRIAGE: trivial fix — inline plan, fan-out skipped`. Skip to
§ 7 Step 2 with this inline plan (§ 6's strategy question doesn't apply — inline is minimal by
definition).

**Otherwise**, launch 3 agents in parallel (see `shared/SKILL-PATTERNS.md#parallel-dispatch` for
dispatch criteria and prompt template):

| Agent         | Philosophy        | Focus                                      |
| ------------- | ----------------- | ------------------------------------------ |
| fix-minimal   | "Smallest change" | Hotfix, minimal risk, fewest changes       |
| fix-thorough  | "Full fix"        | Root cause, add tests, clean up            |
| fix-defensive | "Preventive"      | Safeguards, validation, prevent recurrence |

Each receives: root-cause analysis + Step 4 evidence + affected files.
Each returns: specific changes with file:line refs, risk (low/medium/high), scope, trade-offs, AND:
`Reproduction test assertion: {what the test must assert to prove the bug}`

## 6. Plan selection

**Skip this step when the § 5 triage gate fired** — continue at § 7 Step 2 with the inline plan.

AskUserQuestion — header: "Fix Strategy", question: "Which fix approach do you want to use?":

- "Minimal (Recommended for production)" — Smallest change, low risk
- "Thorough" — Full fix with root cause + tests
- "Defensive" — Safeguards and validation to prevent recurrence

Then select fixes:

```
Proposed fixes ({M} total):

1. {file:line} — {description}
2. {file:line} — {description}
...
```

Ask: "Which fixes do you want to apply? Provide numbers (e.g. `1, 3` or `all`)." Parse → fix-set.

`ExitPlanMode` once the fix-set is chosen — present the chosen strategy and selected fixes as the
plan output. Rejected → stay in plan mode, revise, re-present, loop until accepted.

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

- Location: `test/regression/{slug}.test.{ext}` or add to an existing file with a
  `// REGRESSION: {issue}` marker.
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

```
REPRODUCTION TEST: {file}:{line}
Expected fail reason: {root cause}
Actual fail: {error output, max 5 lines}
Status: ✓ Bug reproduced
```

## 8. Implementation, verification, re-check

**Implementation**: apply the selected fixes. With a reproduction test written, the concrete success
criterion is that test going green — do not change more than that test + the fix-plan scope needs.

**Verification**: re-run the reproduction test (skip if § 7 was skipped — go straight to live
re-check). Full-suite regression is **not** re-run here — `phase-3-manual-finalize.md § Regression
re-check` already covers the whole PHASE 3 scope once, right before completion.

**Re-check**: `manual-interview-walkthrough.md` Steps B–E for this one item (no new interview close).

- **Pass** → clear the item's `debugTier`, set `verdict: "pass"`. Return to
  `fix-round.md § Re-check` for any remaining items already mid-round, back to
  `phase-3-manual-finalize.md § Findings ledger + routing` if the scope check in
  `manual-interview-walkthrough.md § Step D` split off a new item that hasn't been through a
  round-gate pass yet, or straight to the regression re-check if this was the last open item.
- **Cosmetic tweak surfaces** → inline polish loop in this same chat (app is already running,
  plan mode already closed) — no new round, no park.
- **Still failing** → this is the hard ceiling; no further automated tier exists. Patch the item
  (`heavyRoundFailed: true`, keep `debugTier: "heavy"`), `signal-clear`, then a single
  `AskUserQuestion` — no "another round" option, nothing left to escalate to:
  1. **"Accept anyway"** — mark the item `verdict: "accepted"` with the failure noted as a known
     limitation (never silently DONE — this requires the explicit choice). Proceed to the regression
     re-check with this item excluded from the pass/fail count.
  2. **"Park — leave this item open"** — checkpoint stays as-is (`debugTier: "heavy"`,
     `heavyRoundFailed: true`), print the park/handoff template (`SKILL.md § PHASE 1–4`) with
     `/dev-ship {feature}` as the resume command. A later resume re-enters this same § 8 re-check
     directly (nothing to redesign — the plan already exists) rather than restarting § 4–7.
