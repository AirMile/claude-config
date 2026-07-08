# Mutation Testing — Stryker integration

Shared reference for dev-ship's verify phase PHASE 5d (measurement) and dev-ship's refactor phase PHASE 4 step 0 (pre-flight gate).

**Purpose:** measure assertion strength. PASS tests prove that tests exist; mutation score proves that tests would catch a subtly wrong implementation. Nothing else in the pipeline measures this.

---

## Runner detection

Detect package manager + test framework from `package.json`:

```bash
node -e "const p=require('./package.json'); const d={...p.dependencies,...p.devDependencies}; const t=p.scripts&&p.scripts.test||''; console.log(d.vitest?'vitest':d.jest?'jest':d.mocha?'mocha':t.includes('node --test')?'node:test':'unknown')"
```

| Framework | Stryker runner-package           | Config                                       |
| --------- | -------------------------------- | -------------------------------------------- |
| vitest    | `@stryker-mutator/vitest-runner` |                                              |
| jest      | `@stryker-mutator/jest-runner`   |                                              |
| mocha     | `@stryker-mutator/mocha-runner`  |                                              |
| node:test | `@stryker-mutator/tap-runner`    | `testRunner: "tap"`, `tap.testFiles: [glob]` |
| unknown   | skip mutation step + log reason  |                                              |

**node:test caveat:** on Node ≥23 `node --test` defaults to the human-readable `spec` reporter, not
TAP — plain `node --test` in `scripts.test` does **not** emit TAP on its own. tap-runner works anyway
because it invokes tests with its own default `nodeArgs`, which force the tap reporter regardless of
what `scripts.test` says.

**No package install in this step.** If the runner is missing: log `mutationScore: { skipped: true, reason: "stryker not installed" }` and continue. Installation belongs in `/core-setup` or a separate user action.

---

## Invocation (diff-scoped, incremental)

```bash
npx stryker run \
  --incremental \
  --mutate "{feature.json#files[].path comma-separated}" \
  --reporters json,clear-text \
  --jsonReporter.fileName .project/features/{feature-name}/stryker-report.json \
  --concurrency 2 \
  --timeoutMS 10000 \
  --ignoreStatic \
  --coverageAnalysis perTest
```

- `--incremental` keeps previous results cached in `reports/stryker-incremental.json` — repeated runs are fast (<30s on small features).
- `--mutate` limits the scope to the feature files. No full-codebase scan.
- `--concurrency 2` keeps it within the agentic CPU/token budget.
- `--ignoreStatic` skips mutants only executed at module load (never exercised by a test anyway).
  `--coverageAnalysis perTest` is already Stryker's own default — passed explicitly as a guard against
  a project config that overrides it, since `ignoreStatic` requires per-test coverage analysis to
  work. No-op on the vitest runner (it ignores `coverageAnalysis` and always uses its own value) —
  harmless there, active on jest/mocha/tap.
- Wall-clock target: <2 min on ≤10 files. If exceeded: log timeout and skip this step.

---

## Output parsing

Read `.project/features/{feature-name}/stryker-report.json`. Write to `feature.json#tests.mutationScore`:

```json
{
  "score": 0.78,
  "killed": 39,
  "survived": 11,
  "timedOut": 0,
  "ranAt": "ISO-8601",
  "survivedDetails": [
    {
      "file": "src/foo.ts",
      "line": 23,
      "mutator": "ConditionalExpression",
      "requirementId": "REQ-001"
    }
  ]
}
```

**`score`** = `killed / (killed + survived + timedOut)`. Range 0..1.

**Deriving `requirementId` per survivor — via deterministic helper:**

```bash
node ~/.claude/scripts/stryker-map-survivors.js \
  .project/features/{feature-name}/stryker-report.json \
  .project/features/{feature-name}/feature.json \
  > .project/features/{feature-name}/survivors.json
```

The script implements the mapping via Stryker's mutation-testing-report-schema v2 (`@stryker-mutator/core` v6+):

- `mutant.coveredBy: string[]` — test IDs that execute the mutant (for survived: tests that should have caught it but didn't).
- `report.tests: Record<id, {id, name, location?}>` — lookup table from test ID to test name.

Per survivor:

1. Resolve `mutant.coveredBy[]` IDs via `report.tests[id].name` → set of test names.
2. Match each name against `tests.checklist[].name` (exact or substring — handles `describe > it` concatenation).
3. Collect unique `requirementId` values from matching checklist entries.
4. Exactly 1 unique `requirementId` → assign to survivor. Multiple or no matches → field omitted (no guessing); zero-match goes into `unmapped[]` for manual inspection.

Write `survivors.json#survivedDetails` directly to `feature.json#tests.mutationScore.survivedDetails`. `unmapped[]` items render as a warning in PHASE 5d output.

**Why this beats import-reverse-mapping:** Stryker knows exactly which tests hit a mutant; no inference from import relations needed. Co-located tests (`foo.ts` + `foo.test.ts` in the same directory) and barrel imports work correctly.

**Fallback for Stryker pre-v6 (no `coveredBy`):** the script emits empty `survivedDetails[]` with all mutants in `unmapped[]`. Log warning `mutation-mapping: stryker schema lacks coveredBy field`. No heuristic fallback — that produces systematically wrong attributions.

Smoke-test fixture: `scripts/fixtures/test-quality/stryker-report.json` + `feature-stryker.json` + `expected/stryker-survivors.json`. A change in the mapping logic breaks immediately via `bash scripts/tests/run.sh`.

---

## Interpretation

| Score     | Verdict | Action                                                                 |
| --------- | ------- | ---------------------------------------------------------------------- |
| ≥ 0.80    | STRONG  | No action. Tests catch subtle bugs.                                    |
| 0.60–0.79 | MIXED   | Report survivors per REQ. Recommended: AUTO items for happy-only REQs. |
| < 0.60    | SHALLOW | Mandatory AUTO items for all REQs with survivors. Ask user-confirm.    |
| skipped   | n/a     | No runner. Document in observation. No blocking.                       |

**Prioritize happy-only REQs:** filter `requirements[]` on `acceptance[].category === "happy"` without edge/boundary. Survivors on these REQs take priority — that's where the complementary blind spot of category-gap-fill sits.

---

## dev-ship's verify phase PHASE 5d — measurement

Run after the existing requirement-coverage check:

1. Detect runner. Skipped → log, done.
2. Run Stryker (command above).
3. Parse + write `tests.mutationScore` to `feature.json`.
4. Render extra table after the coverage matrix:

   ```
   ASSERTION STRENGTH: {feature-name}

   | REQ     | Mutants | Killed | Survived | Score | Verdict   |
   |---------|---------|--------|----------|-------|-----------|
   | REQ-001 | 12      | 9      | 3        | 0.75  | MIXED     |
   | REQ-002 | 8       | 8      | 0        | 1.00  | STRONG    |

   Overall: {score} ({verdict})
   ```

5. On verdict MIXED or SHALLOW: add an AUTO item per survived REQ to `tests.checklist[]` with:

   ```json
   {
     "title": "Strengthen assertion for {REQ-ID} ({mutator} at {file}:{line})",
     "type": "AUTO",
     "requirementId": "REQ-XXX",
     "source": "mutation-survivor",
     "status": "pending"
   }
   ```

   Loop back to PHASE 1 (Auto Testing) for these items only. Reuses the existing fix-loop — no new phase needed.

6. Verdict STRONG → one line: `Assertion strength: STRONG ({score} score, no survivors)`.

**No hard fail.** Mutation score is informative; it does not block PHASE 6.

---

## dev-ship's refactor phase PHASE 4 step 0 — pre-flight gate

Run before "Initialize change tracking" in `apply-rollback.md`:

1. Read `feature.json#tests.mutationScore.score` as baseline. Missing → flag baseline = null.
2. Detect runner. Skipped → log warning, continue without the gate.
3. Run Stryker incremental **with `--force`** to ignore the stale cache from the pre-refactor code state: `npx stryker run --incremental --force --mutate "{files}" --reporters json --jsonReporter.fileName .project/features/{feature-name}/stryker-preflight.json --concurrency 2 --ignoreStatic --coverageAnalysis perTest`. The `--force` ensures the baseline comparison happens against the current code state, not against a snapshot from verify. Write to a separate report file (`stryker-preflight.json`) so verify's `stryker-report.json` stays intact.
4. Parse `score`. Compare:

   | Condition                                      | Action                                                                                                                    |
   | ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
   | baseline != null AND current ≥ baseline - 0.05 | OK. Continue with the refactor.                                                                                           |
   | baseline != null AND current < baseline - 0.05 | WARN. AskUserQuestion: "Test suite has weakened since verify (was {baseline}, now {current}). Continue with refactor?"    |
   | baseline == null AND current ≥ 0.60            | OK. Log warning that the baseline is missing. Continue.                                                                   |
   | baseline == null AND current < 0.60            | WARN. AskUserQuestion: "No baseline found and current score is low ({current}). Refactor relies on weak tests. Continue?" |
   | runner skipped                                 | OK. Log that the gate could not run. Continue.                                                                            |

5. **No auto-rollback on this gate.** It is an informative signal; the user decides.

---

## What NOT to do

- **No full-codebase mutations.** Diff scope (`--mutate {files[].path}`) is mandatory.
- **No mutation runs in dev-ship's build phase.** Degrades the TDD red→green flow.
- **No automatic package install.** Skip gracefully if the runner is missing.
- **No blocking on MIXED/SHALLOW.** Only report + create AUTO items.
- **No mapping guesses.** With multiple matching checklist entries: omit `requirementId`.
