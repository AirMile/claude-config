# Flakiness Detection — dev-verify PHASE 5d

Cross-run non-determinism detection via JUnit-XML aggregator. Backed by Vitest issue #9498 (no built-in cross-run flaky aggregation). PFR < 1.0 on an identical SHA = flaky by definition.

---

## Prerequisite: JUnit reporter enabled

The aggregator reads `.project/test-junit.xml` by default. The project must have the JUnit reporter configured. Detect in PHASE 0 whether the config is present — otherwise skip the flakiness step with log "JUnit reporter not configured, skipping flakiness aggregator".

**Vitest config (`vitest.config.ts`):**

```ts
export default defineConfig({
  test: {
    reporters: [
      "default",
      [
        "junit",
        { outputFile: ".project/test-junit.xml", addFileAttribute: true },
      ],
    ],
  },
});
```

**Jest config (`jest.config.js`):**

```js
module.exports = {
  reporters: [
    "default",
    [
      "jest-junit",
      { outputDirectory: ".project", outputName: "test-junit.xml" },
    ],
  ],
};
```

**Playwright config (`playwright.config.ts`):**

```ts
export default defineConfig({
  reporter: [["junit", { outputFile: ".project/test-junit.xml" }]],
});
```

When the config is missing: AskUserQuestion in PHASE 0 to add it. Do not auto-install.

---

## Steps in PHASE 5d

### 1. Run aggregator

```bash
CURRENT_SHA=$(git rev-parse HEAD)
node scripts/junit-flakiness.js .project/test-junit.xml "$CURRENT_SHA"
```

The script:

- Parses `.project/test-junit.xml` (Jest/Vitest/Playwright subset)
- Appends-only to `.project/flakiness-history.jsonl` (one line per run with `{sha, ranAt, results}`)
- Computes over the last N=20 runs: PFR per test, retry total, first flip SHA
- Output: `{ lastRun, totalRunsInWindow, flakyTests: [{name, file, pfr, retries, firstFlipSha}] }`

### 2. Write to feature.json

`feature.json#tests.flakiness ← {lastRun, flakyTests}`. When `flakyTests.length === 0`: one line in the verify report: `Flakiness: clean ({totalRunsInWindow} runs in window)`. Otherwise: render table (see SKILL.md PHASE 5d).

### 3. Threshold + AUTO-item

For each flaky test:

- **PFR < 0.5**: critical. AUTO-item "Stabilize test {name}" with priority `required`.
- **PFR < 1.0 without firstFlipSha**: moderate — could be coincidence. AUTO-item priority `suggested`.
- **firstFlipSha != null** (deterministically impossible): critical, regardless of PFR. AUTO-item priority `required`.

The AUTO-item observation contains fix suggestions from the catalog below.

---

## Fix suggestions (catalog)

Embed these in the observation of each AUTO-item, filtered via heuristics over the test-file content:

| Symptom in test                                              | Suggestion                                                                         |
| ------------------------------------------------------------ | ---------------------------------------------------------------------------------- |
| `Date.now()` / `new Date()` without fake timer               | `beforeEach(() => vi.useFakeTimers().setSystemTime(...))` + restore in `afterEach` |
| `Math.random()` / `uuid.v4()` without seed                   | `seedrandom('fixed-seed')` or stub `Math.random` with a deterministic sequence     |
| Real HTTP call (`fetch`, `axios`)                            | MSW: `server.use(http.get(...))` per test                                          |
| `setTimeout` / `setInterval` without fake timer              | `vi.useFakeTimers()` + `vi.advanceTimersByTime`                                    |
| Test shares state with other tests (`let` at describe level) | `isolate: true` in vitest config + reset state in `beforeEach`                     |
| Async race between multiple `await`s                         | Verify order with `vi.waitFor` or explicit `await Promise.all`                     |
| File-system writes without cleanup                           | `tmpdir()` per test + `rm` in `afterEach`                                          |

---

## Anti-patterns

- **Retry flag as a permanent fix.** A test that passes on attempt 2 is still broken. Quarantine with `@flaky` tag + ticket + deadline, or fix the root cause.
- **Deleting flaky tests instead of quarantining.** Loss of regression coverage. Mark with `test.skip` + `@flaky` + reason + owner.
- **Reruns in the same runtime without state reset.** Side-effect flakes do not reproduce within the same process. `--isolate` or `--no-isolate=false` depending on the runner.
- **Enabling the JUnit reporter only in CI.** Local runs also provide valuable history points. Always enable it.

---

## Caveats

- The aggregator only detects flakiness that passes through the JUnit output. Tests that hang or crash the entire runner are not recorded.
- The window of N=20 runs is a fixed choice; with very frequent runs, flakiness history can fall out of the window quickly. Adjust `WINDOW_SIZE` in `scripts/junit-flakiness.js` for projects with >5 runs/day.
- `firstFlipSha` detection requires the same SHA to have been run multiple times. This happens implicitly with CI reruns and local iterating; to force it explicitly, use `git rev-parse HEAD` consistently in the invocation.
