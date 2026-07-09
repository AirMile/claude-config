# Fix Loop (PHASE 3 → 5c)

Loaded from PHASE 2b when ≥1 FAIL (SPEC or TESTABLE) was found. These phases were added to the task list via `TaskCreate` at that point (see workflow.md Workflow). After PHASE 5c completes, continue at PHASE 5d in workflow.md.

## PHASE 3: Categorize Issues

> **Todo**: mark PHASE 2b → `completed`, PHASE 3 → `in_progress`.

Per FAIL: pick exactly one category. Category semantics + the SUBJECTIVE-clarify rule are the shared
definition — see `shared/FEEDBACK-CATEGORIZATION.md` (this fix-loop uses all four, including the
dev-verify-specific **SPEC** = acceptance-criterion miss):

| Category   | Trigger                                                         | Examples                                     |
| ---------- | --------------------------------------------------------------- | -------------------------------------------- |
| SPEC       | Acceptance test fails — criterion not covered by implementation | Missing validation, wrong format, off-by-one |
| TESTABLE   | Builder test fails — implementation is wrong                    | Logic bug, wrong return value, race          |
| MEASURABLE | Failure has a numeric/visual threshold (timing, CSS, layout)    | Slow render, wrong color, layout-shift       |
| SUBJECTIVE | Criterion is vague ("feels fast", "looks good") — ask user      | UX impressions, taste-level disagreements    |

SUBJECTIVE → AskUserQuestion for clarification, then re-categorize as one of the other three (per the shared file).

Technique mapping:

- **SPEC / TESTABLE** → **Fix** — reproduce the failure with a failing test (RED), then fix (GREEN). For SPEC items the failing test is the acceptance test (write/update it).
- **MEASURABLE** → **Direct Fix** — config/styling/timing tweak, no test loop.
- Default → Fix

Display technique map:

```
| Item | Issue | Type | Technique | Reason |
```

---

## PHASE 4: Fix Loop

> **Todo**: mark PHASE 3 → `completed`, PHASE 4 → `in_progress`.

### Plan-mode gate (OpusPlan-friendly)

Before starting fixes, decide whether to enter plan mode first.

Auto-enter plan mode (no question) when ANY:

- ≥1 SPEC bug (acceptance criterion not met — needs design)
- ≥2 TESTABLE bugs that touch the same file or module (likely shared root cause)
- A bug whose root cause is unclear after PHASE 3 categorization

Skip plan mode silently when ALL:

- Only MEASURABLE bugs (direct config/styling/timing tweaks)
- ≤1 TESTABLE bug with an obvious root cause from the failing test

When entering plan mode: call `EnterPlanMode`, write the fix plan to the plan file (one section per bug: problem → root cause → research → proposed fix → verification), then `ExitPlanMode` for approval. After approval, continue with the Fix step below. Rejected plan → re-categorize or ask user.

Show before entering: `PLAN MODE: {n} bug(s) need design — entering plan mode (OpusPlan-aware).`

### Fix

**Research (conditional, no question)** — when the failing API or error signature implicates an
external library (skip for purely internal logic): follow
[shared/CONTEXT7.md](.claude/skills/shared/CONTEXT7.md) — query = failing API + error signature. If
the plan-mode gate fired, run this inside plan mode and add a `research:` line to each affected bug's
plan section.

Reproduce the failure with a test (RED), then fix (GREEN). Max 3 attempts, then ask user. For SPEC items the reproducing test is the acceptance test.

```
[FIX] Item {N}: {title}
Technique: Fix | Type: {AUTO|MANUAL}
RED: FAIL ({what})  GREEN: PASS
SYNC: Root cause: {file:line}. Fix: {approach}. Impact: {scope}.
```

Test already passes → AskUserQuestion: Skip (Recommended) | Adjust test | Check manually.

### MEASURABLE: Direct Fix

Fix direct (config, styling, timing). Needs manual re-test.

```
[FIX] Item {N}: {title}
Technique: Direct Fix | Type: {AUTO|MANUAL}
SYNC: Root cause: {file:line}. Fix: {approach}. Impact: {scope}.
```

---

## PHASE 5: Re-test

> **Todo**: mark PHASE 4 → `completed`, PHASE 5 → `in_progress`.

Re-test ONLY fixed items.

**Phase A: Auto** — re-run fixed AUTO items inline (same approach as PHASE 1: background Bash for server/browser runs, sync Bash for fast checks). TOOL_ERROR → Phase B.

**Phase B: Manual** — fixed MANUAL items via walkthrough. Show CHANGE (fix summary) + original steps.

Display re-test results.

## PHASE 5b: Re-test Loop

> **Todo**: mark PHASE 5 → `completed`, PHASE 5b → `in_progress`.

All pass → PHASE 5c.

Items still failing → AskUserQuestion: More details (Recommended) | Different approach | Accept | Fix yourself.
Loop back to PHASE 3. AUTO items → re-run in PHASE 5A. MANUAL items → re-test in PHASE 5B.

**Max 3 fix attempts per item.** Each failed re-test escalates one tier per `shared/DEBUG-LADDER.md` (don't retry the same tier with the same information). After the 3rd failed re-test of the same item, stop looping for that item and AskUserQuestion: "Accept anyway" | "Escalate to root-cause analysis (`dev-ship/references/debug-round-heavy.md`, non-ledger entry — this loop already covered the light tier's ground with its 3 attempts)". This prevents an unbounded PHASE 3 → 5 → 5b cycle.

---

## PHASE 5c: Regression Check

> **Todo**: mark PHASE 5b → `completed`, PHASE 5c → `in_progress`.

**Skip silently (no user output) when ALL of:**

- No fixes applied in PHASE 4
- No previously-PASS AUTO items in PHASE 2b
- All fixes were MANUAL-only (config/styling)
- No new test files added in PHASE 4

Re-run all previously-PASS AUTO items **plus any new test files added in PHASE 4** inline (same approach as PHASE 1). Including new test files is essential — they can surface config gaps (e.g. missing `setupFilesAfterEnv`, `moduleNameMapper`, or `testEnvironment`) that only become visible when a new test exercises a setup path. Catching these here keeps the fix inside the verify-commit rather than requiring a separate post-verify commit.

```
REGRESSION CHECK: {feature-name}

| # | Test               | Was    | Now    |
|---|--------------------|--------|--------|
| 1 | Route rendering    | ✓ PASS | ✓ PASS |
| 3 | Form validation    | ✓ PASS | ✗ FAIL |

Regressions: {n} | Stable: {n}
```

**No regressions:** Proceed to PHASE 5d (workflow.md).

**Regressions:** Show and offer choice via AskUserQuestion: Fix (Recommended) | Accept. If fixing → back to PHASE 4 for regression items only. Do NOT repeat PHASE 5c after regression fix (max 1 pass).
