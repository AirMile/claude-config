# Test-Smell Review — dev-verify PHASE 5d

AI test review for over-mocking and test-implementation-not-behavior. Empirically grounded via MSR 2026 (Hora & Robbes): coding agents add mocks in 36% of test commits vs 26% for humans (χ²=505.5, p<0.001) and use mono-type `mock` in 95% of cases.

---

## Steps

### 1. Run heuristic check

Collect test-file paths from `tests.checklist[].testFile` (when present) + new acceptance-test files (`tests.acceptanceTestFile`). Dedup.

**Read project baseline** (prevents false positives on heavy-boundary projects): read `.project/project.json#testSmellBaseline = { avgMockRatio, p90MockRatio, sampleCount }`. Does not exist → run without baseline (static 0.6 threshold).

```bash
# With baseline:
node scripts/check-test-smells.js --baseline-p90=<p90> {file1} {file2} ...
# Without baseline (first run on project):
node scripts/check-test-smells.js {file1} {file2} ...
```

Output: `{ summary: {...}, results: [{file, mockRatio, overMocking, behaviorVsImpl, threshold, ...}] }`. The `threshold` field shows which level was used (`baselineP90 + 0.1` or the `0.6` fallback).

Write:

- `feature.json#tests.smellSummary` ← `summary` (also contains this feature's `p90MockRatio` for the baseline update).
- `feature.json#tests.checklist[i].smellScore` ← merge per-file result where `testFile` matches. Format: `{ mockRatio, snapshotLines, overMocking, behaviorVsImpl, threshold }`.

**Baseline update happens in PHASE 6** — see `completion-sync.md` § testSmellBaseline update (running average over `smellSummary.avgMockRatio` / `p90MockRatio`). This file only reads the baseline; it never writes it.

### 2. LLM layer (only on heuristic flag)

For each file with `overMocking: true` OR `mockRatio > 0.6`: read the first 100 lines of the file + the existing `smellScore` and send to Claude inline:

```
Test-file review on anti-patterns from skills/dev-build/techniques/tdd.md
and Testing Rules (TST001-TST203) in skills/shared/CODING-RULES.md.

Heuristic flagged this file: {smellScore JSON}.

File ({path}, first 100 lines):
{file content}

Score the test file on:
1. Over-mocking (TST001): are mocks used outside external boundaries (third-party APIs, FS, network, env, time)?
2. Behavior vs implementation (TST002): do assertions check observable outcomes or implementation calls?
3. Fake/spy diversity (TST101): is every test-double a mock, or is fake/spy used where appropriate?
4. Determinism (TST102): are non-deterministic sources (timers, RNG, network) pinned or stubbed?
5. Snapshot-only smell (TST202): are snapshot blocks the only assertion without a behavior `toBe`/`toEqual`?
6. Weak assertion (TST203): are `toBeDefined`/`toBeTruthy` used where a specific-value `toBe` would catch more?
7. Retry-flag mitigation (TST201): are flaky tests papered over with retries instead of root-cause fix?

For each: VERDICT (clean | concern | smell) + 1-sentence rationale + concrete fix + TST-rule ID if violated.

End with: refactor priority (skip | suggested | required), 1 sentence.
```

Store the LLM verdict in `feature.json#tests.checklist[i].smellScore.review = { verdict, rationale, priority }`.

### 3. Render table

When `tests.smellSummary.anyOverMocking === true`:

```
TEST SMELLS: {feature-name}
| File                  | MockRatio | Snapshot | OverMock | Behavior-vs-Impl | Priority   |
|-----------------------|-----------|----------|----------|------------------|------------|
| usePinMode.test.ts    | 0.18      | 12       | no       | behavior         | —          |
| useAuth.test.ts       | 0.75      | 4        | YES      | implementation   | required   |

Avg mockRatio: {avg} ({n}/{total} files flagged)
```

When `anyOverMocking === false`: one line: `Test smells: clean ({n} files checked, avg mockRatio {x})`.

### 4. Threshold + AUTO-item

- `priority: required` (LLM) or `overMocking: true` (heuristic) → push AUTO-item: `{ id, title: "Refactor mocks in {basename}", source: "test-smell", file, status: "pending" }`. Loop back to PHASE 1 (Auto Testing) for these items only.
- `priority: suggested` → log as observation, not blocking. User confirm in PHASE 6.
- Otherwise: clean, no action.

---

## Anti-patterns (also refer to `dev-build/techniques/tdd.md`)

- **Mock everything except subject** — if 80% of a test file is `vi.mock`, you are testing your mocks, not your code.
- **Snapshot-only test** — `toMatchSnapshot()` as the only assertion catches no behavioral regression. Combine with a behavior assertion.
- **`expect(x).toBeDefined()` as happy path** — counts toward `weakCount` in the heuristic script. Replace with `toBe(specific)`.
- **`toHaveBeenCalledWith` as the only assertion** — counts toward `implCount`. Verify the _result_ of the call, not just that it was invoked.

---

## Anti-patterns the script does NOT catch (LLM layer only)

- Tests that explicitly follow the implementation (whitebox against the public-API rule)
- Subtle oracle errors in property-based assertions
- Tests that slipped through TDD's red→green step without a real business-value claim

That is why the LLM layer remains mandatory for all heuristically flagged files.
