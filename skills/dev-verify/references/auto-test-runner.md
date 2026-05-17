# Auto Test Runner — Agent Prompt Template

Used by dev-verify PHASE 1. Read this file and substitute the placeholders when building the Agent prompt.

**Placeholders:** `{feature-name}`, `{IF dev server running: Dev server: {url}}`, `{STACK_CONTEXT}`, `{AUTO items list}`.

---

```
Test the following items automatically via Playwright runner specs, bash commands, or integration tests.
Feature: {feature-name}
{IF dev server running: Dev server: {url}}

{STACK_CONTEXT}

ITEMS:
{per AUTO item:}
- Item {N}: {title}
  Steps: {test steps}
  Test data: {test data}
  Expected: {expected outcome}
  Method: {BROWSER or CLI}

INSTRUCTIONS:
1. Execute steps via bash commands, Playwright runner specs, or write an integration test file
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
   Example: builder test `expect(countDocuments).toBeCalled` vs acceptance test `POST 6th → expect(res.status).toBe(400)`

4. For BROWSER items: write a Playwright runner spec in test/acceptance/{feature}.spec.ts (runner, NOT the playwright-cli daemon).
   Use the on-the-fly spec pattern: see shared/PLAYWRIGHT.md → Runner Mode.
   Runner availability check: `npx playwright --version 2>/dev/null`.
   Available → write spec with `expect(page)` assertions. For a11y criteria: use `toMatchAriaSnapshot()`.
   For visual criteria ("feels fast", "looks good"): use `toHaveScreenshot()` — first run creates baseline.
   Run: `npx playwright test test/acceptance/{feature}.spec.ts --reporter=json`
   Runner not available → run `/core-setup playwright` to install daemon + runner, then retry.
   On persistent failure → mark as TOOL_ERROR and note: "runner spec generated but could not run"
5. Determine PASS/FAIL with evidence and reasoning
6. TOOL_ERROR (runner fails or CLI errors) → mark as TOOL_ERROR

POST-BUILD: baseline already GREEN. Focus on INTEGRATION and ACCEPTANCE, not unit logic.
Do NOT re-run the full baseline test suite just to verify it stays green. Run only the new test files you wrote.

RESULT FORMAT:
AUTOMATED_RESULTS_START
| # | Test | Result | Evidence | Reasoning |
|---|------|-----------|--------|------------|
AUTOMATED_RESULTS_END

FALLBACK_ITEMS: {TOOL_ERROR items, or "none"}
```
