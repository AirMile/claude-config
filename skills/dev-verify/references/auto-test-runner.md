# Auto Test Runner — Inline Execution Spec

Used by dev-verify PHASE 1 (main context, no subagent). Read this file to determine how to write
test files and run them. The PHASE 1 execution model (background Bash / sync Bash / Monitor) is
already described in SKILL.md — this reference covers the test-file path decisions, patterns, and
result format only.

---

## Item-handling rules

Execute these steps for each non-COVERED AUTO item:

1. Execute steps via bash commands, Playwright runner specs, or write an integration test file.
2. For CLI items without running server: write an integration test that tests the service/function directly with mock dependencies and real DB.

   Path decision (check existing builder-test locations first):
   - Builder tests are colocated (e.g. `src/foo/bar.test.ts` next to `bar.ts`) → write `{builder-test-dir}/{feature}.integration.test.{ext}` colocated.
   - Builder tests live in a top-level `test/` or `__tests__/` directory → write `test/integration/{feature}.integration.test.{ext}`.
   - No existing builder tests → default to `test/integration/{feature}.integration.test.js`.

3. For acceptance items (source: "acceptance"): write test as a separate file using the project's test framework (vitest/jest/node:test — check package.json).

   Path decision (check existing builder-test locations first):
   - Builder tests are colocated → write `{builder-test-dir}/{feature}.acceptance.test.{ext}` colocated.
   - Builder tests live in `test/` or `__tests__/` → write `test/acceptance/{feature}.acceptance.test.{ext}`.
   - No existing builder tests → default to `test/acceptance/{feature}.acceptance.test.{ext}`.

   Goal: `npm test` picks up the acceptance file as part of the regression suite.

4. For BROWSER items: write a Playwright runner spec in `src/app/_test/{feature}.spec.ts` (or the project's established Playwright test dir — check `playwright.config.ts`).
   Runner availability check: `npx playwright --version 2>/dev/null`.
   Available → write spec with `expect(page)` assertions. For a11y criteria: use `toMatchAriaSnapshot()`. For visual criteria: use `toHaveScreenshot()`.
   Run via background Bash per SKILL.md PHASE 1 execution rules.
   Runner not available → run `/core-setup playwright` to install, then retry. On persistent failure → mark as TOOL_ERROR.

5. Determine PASS/FAIL with evidence and reasoning.
6. TOOL_ERROR (runner fails or CLI errors) → mark as TOOL_ERROR.

POST-BUILD: baseline already GREEN. Focus on INTEGRATION and ACCEPTANCE, not unit logic.
Do NOT re-run the full baseline test suite. Run only the new test files you wrote.

## Result format

```
AUTOMATED_RESULTS_START
| # | Test | Result | Evidence | Reasoning |
|---|------|--------|----------|-----------|
AUTOMATED_RESULTS_END

FALLBACK_ITEMS: {TOOL_ERROR items, or "none"}
```
