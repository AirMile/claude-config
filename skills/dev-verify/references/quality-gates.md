# Test-Quality Gates — dev-verify PHASE 5d

Lazy-loaded body for the assertion-strength, property-based, smell, flakiness, correlation, and aggregate-verdict steps that run during PHASE 5d. SKILL.md keeps only the PHASE 5d header + the read-marker that points here.

Execution order in PHASE 5d after the requirement-coverage check:

1. Assertion-strength measurement (mutation)
2. Property-based gap-check (boundary REQs)
3. Counterexample-capture (per property-test run)
4. Test-smell review (over-mocking detection)
5. Flakiness-check (cross-run non-determinism)
6. Survivor × flaky correlation (UNVERIFIABLE detection)
7. Aggregate verdict (headline line)

---

## 1. Assertion-strength measurement

Read `../shared/MUTATION-TESTING.md` § dev-verify PHASE 5d. Detect Stryker runner, run incremental diff-scoped, write `feature.json#tests.mutationScore`, render ASSERTION STRENGTH table. Survivors on happy-only REQs → AUTO-items via the existing fix-loop (back to PHASE 1 for `source: "mutation-survivor"` items). No blocking — informational signal.

---

## 2. Property-based gap-check (boundary REQs)

For each `requirements[]` with `≥1 acceptance[].category === "boundary"`: check whether `tests.checklist[]` has a matching item with `kind: "property"`. Missing → AskUserQuestion per REQ:

```yaml
header: "Boundary REQ has only an example-test: {REQ-ID}"
question: "{requirement} has category=boundary but no property-test. Add one?"
options:
  - label: "Add property-test (Recommended)", description: "Generate @fast-check/vitest test.prop with seed, back to PHASE 1"
  - label: "Keep example", description: "Deliberate choice — the example covers this boundary sufficiently. Mark requirement with evidence='example-covers-boundary'."
```

Add choice → push checklist item with `kind: "property"` + new `seed`, loop back to PHASE 1.

---

## 3. Counterexample-capture (per property-test run)

For each `tests.checklist[]` with `kind: "property"`:

- **PASS** → write `counterexample: null` (clear any earlier counterexample after a successful fix).
- **FAIL** → parse fast-check's output (stderr regex: `Counterexample: (.*)\nShrunk (\d+) time\(s\)\nGot error: (.*)\nseed=(\d+)\npath=([\d:]+)`) and write:

```json
"counterexample": {
  "seed": <seed>,
  "path": "<shrink-path>",
  "input": <parsed input>,
  "foundAt": "<ISO-8601>",
  "errorMessage": "<got error>"
}
```

The next run can reproduce the bug exactly with `fc.assert(..., { seed, path })` or by adding `examples: [input]` to the property → regression safety net. After a successful fix, the next PASS run clears the field again.

---

## 4. Test-smell review (over-mocking detection)

Read `test-smell-review.md`. Run `scripts/check-test-smells.js` over all test files in `tests.checklist[].testFile`, write `tests.checklist[].smellScore` and aggregate `tests.smellSummary`. Threshold `mockRatio > 0.6` or `overMocking: true` → AUTO-item "review mocks for {file}" via fix-loop. Render extra table:

```
TEST SMELLS: {feature-name}
| File                  | MockRatio | Snapshot | OverMock | Behavior-vs-Impl |
|-----------------------|-----------|----------|----------|------------------|
| usePinMode.test.ts    | 0.18      | 12       | no       | behavior         |
| useAuth.test.ts       | 0.75      | 4        | YES      | implementation   |
```

---

## 5. Flakiness-check (cross-run non-determinism)

Read `flakiness-detection.md`. Aggregate `.project/test-junit.xml` runs into `.project/flakiness-history.jsonl` via `scripts/junit-flakiness.js`, write `tests.flakiness` with the top-N flaky tests (PFR < 1.0 on identical SHA). Render third table when ≥1 flaky test:

```
FLAKINESS: {feature-name}
| Test                    | PFR  | Retries | First flip |
|-------------------------|------|---------|------------|
| should X when Y         | 0.85 | 3       | abc1234    |
```

Threshold: PFR < 1.0 on the same SHA → AUTO-item "stabilize test {name}" with fix suggestions (`vi.useFakeTimers`, MSW, seeded RNG, `isolate: true`). No retry flag as a permanent solution.

---

## 6. Survivor × flaky correlation (UNVERIFIABLE detection)

After mutation + flakiness: compute the intersection between `tests.mutationScore.survivedDetails[]` and `tests.flakiness.flakyTests[]`. A test that is BOTH flaky AND lets mutants survive is almost certainly a do-nothing test (or a test that only passes by chance without actually checking anything). Per intersection match:

- Store in `tests.qualityVerdict.breakdown.unverifiable[] = [{ name, file, reason: "flaky + survived-mutant" }]`.
- Render at the top of the PHASE 5d output: `CRITICAL: {N} tests are both flaky AND miss mutants — likely no-op tests`. List per test: `{file}:{name}`.
- Force AUTO-item priority `required` regardless of other thresholds.

---

## 7. Aggregate verdict (headline line of PHASE 5d output)

Compute a single line that summarizes all four signals. Write to `tests.qualityVerdict`:

| Verdict        | Condition                                                                                                                                                              |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `STRONG`       | `mutationScore.score ≥ 0.80` AND `flakiness.flakyTests.length == 0` AND `smellSummary.anyOverMocking == false` AND `qualityVerdict.breakdown.unverifiable.length == 0` |
| `MIXED`        | One signal in the middle zone (mutation 0.60–0.79, ≤2 flaky tests with PFR ≥ 0.5, or mockRatio drift without over-mocking)                                             |
| `SHALLOW`      | `mutationScore.score < 0.60` OR `smellSummary.anyOverMocking == true`                                                                                                  |
| `UNVERIFIABLE` | `qualityVerdict.breakdown.unverifiable.length > 0` — overrules all other verdicts (the intersection is a stronger signal than the individual scores)                   |

Render as the very first line above the tables:

```
TEST-QUALITY VERDICT: {STRONG | MIXED | SHALLOW | UNVERIFIABLE}
  mutation: {score} | flakiness: {n} flaky | smells: {n} | unverifiable: {n}
```

For `UNVERIFIABLE`: render the CRITICAL line directly below it. For `STRONG`: skip the three detail tables, one line suffices.
