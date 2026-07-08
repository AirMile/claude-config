# Auto Test Runner — Inline Execution Spec

Used by dev-verify PHASE 1 (main context, no subagent). Read this file to determine how to write
test files and run them. The PHASE 1 execution model (background Bash / sync Bash / Monitor) is
already described in workflow.md — this reference covers the test-file path decisions, patterns, and
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

3. For acceptance items (source: "acceptance") **or category-coverage items** (source:
   "category-coverage", title `"{category} coverage missing for {REQ.id}"`): write tests using the
   project's test framework (vitest/jest/node:test — check package.json).

   Category branch (category-coverage items only — acceptance items skip this and always use the
   example-based path below): `edge`/`boundary` → write a property-based test instead of a single
   example — `test.prop()`/`it.prop()` from `@fast-check/vitest`, with the same mandatory pinned
   seed as `tdd.md` § Property-based testing (`{ seed: 4242, numRuns: ... }`); this backfills the
   property-testing rule onto category-gap items the same way it already applies during build.
   `happy` category (and all acceptance items) keep the example-based path below.

   Path decision (check existing builder-test locations first):
   - A colocated builder test already covers the same unit AND owns heavy shared mocks (fake timers, navigation containers, native-module mocks) → append the acceptance `describe` block to that existing file and reuse its mocks. A new sibling file can change the runner's scheduling and leak shared timers across files (e.g. React Navigation animation timers), breaking unrelated tests.
   - Otherwise, builder tests are colocated → write `{builder-test-dir}/{feature}.acceptance.test.{ext}` colocated.
   - Builder tests live in `test/` or `__tests__/` → write `test/acceptance/{feature}.acceptance.test.{ext}`.
   - No existing builder tests → default to `test/acceptance/{feature}.acceptance.test.{ext}`.

   Goal: `npm test` picks up the acceptance file as part of the regression suite.

4. For BROWSER items: write a Playwright runner spec in `src/app/_test/{feature}.spec.ts` (or the project's established Playwright test dir — check `playwright.config.ts`).
   Runner availability check: `npx playwright --version 2>/dev/null`.
   Available → write spec with `expect(page)` assertions. For a11y criteria: use `toMatchAriaSnapshot()`. For visual criteria: use `toHaveScreenshot()`.

   Failure-artifact config (once per project): if `playwright.config.ts` has no `use.trace`/
   `use.screenshot` set, add `use: { trace: 'retain-on-failure', screenshot: 'only-on-failure' }` —
   never overwrite an existing choice. `retain-on-failure` (not `on-first-retry`) is the right
   default here since this config has no `retries` set, so `on-first-retry` would never fire.

   Named steps: wrap each checklist `steps[]` entry in `await test.step('{step text}', async () => {
... })` so a FAIL cites the specific failing step by name, and its trace (default under
   `test-results/`) can be attached in the fix-loop report.

   Auth reuse: if the spec's steps start from an authenticated state, check for/create a captured
   session at `playwright/.auth/{role}.json` — log in once, `await context.storageState({ path:
'playwright/.auth/{role}.json' })` — then load it via `test.use({ storageState:
'playwright/.auth/{role}.json' })` instead of repeating the login UI steps in this spec.

   Run via background Bash per workflow.md PHASE 1 execution rules.
   Runner not available → run `/core-setup playwright` to install, then retry. On persistent failure → mark as TOOL_ERROR.

5. Determine PASS/FAIL with evidence and reasoning.
6. TOOL_ERROR (runner fails or CLI errors) → mark as TOOL_ERROR.

POST-BUILD: baseline already GREEN. Focus on INTEGRATION and ACCEPTANCE, not unit logic.
Run only the new test files while iterating. Exception: when you ADD a new test file (vs. appending to an existing one), do ONE full-suite run after it goes green — a new file can change scheduling and leak shared state (timers, native mocks) across files, a regression that an isolated run cannot surface.

## Result format

```
AUTOMATED_RESULTS_START
| # | Test | Result | Evidence | Reasoning |
|---|------|--------|----------|-----------|
AUTOMATED_RESULTS_END

FALLBACK_ITEMS: {TOOL_ERROR items, or "none"}
```
