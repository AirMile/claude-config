# Dev Verify — Requirement Coverage Reference

Full logic for PHASE 5d. Loaded inline when executing requirement coverage check.

---

## PHASE 5d: Requirement Verification

**Skip when:** All tests FAIL (coverage check pointless on catastrophic failures).

Cross-check `feature.json` requirements against test results.

1. **Load requirement → test mapping:**
   - Per `requirements[]` entry (id, description, status) — **skip entries with `deltaOp === "REMOVED"`**
   - Look up matching `tests.checklist[]` entries via `requirementId`

2. **Classify per requirement** (before rendering anything):
   - **COVERED**: at least 1 test with matching `requirementId` AND status `PASS`
   - **FAIL**: at least 1 test matching but status `FAIL`
   - **BLOCKED**: test does not exist or fails due to external dependency (service down, missing API key, missing fixture)
   - **UNCLEAR**: no test possible because acceptance criteria is too vague — non-deterministic
   - **NO TEST**: no test in `checklist[]` with matching `requirementId` (no legitimate reason)

3. **All requirements COVERED** (no FAIL/BLOCKED/UNCLEAR/NO TEST) — STOP HERE:
   - Output one line only: `Requirement coverage: {n}/{n} REQs PASS`.
   - Do NOT render the matrix below.
   - Proceed to PHASE 6.

4. **Any uncovered requirement** — render the matrix:

   ```
   REQUIREMENT COVERAGE: {feature-name}

   | REQ       | Description (short)       | Tests | Status        |
   |-----------|----------------------------|-------|---------------|
   | REQ-001   | {first 40 chars}           | 2     | ✓ COVERED     |
   | REQ-002   | {first 40 chars}           | 0     | ✗ NO TEST     |
   | REQ-003   | {first 40 chars}           | 1     | ⊘ BLOCKED     |
   | REQ-004   | {first 40 chars}           | 0     | ? UNCLEAR     |

   Coverage: {covered}/{total} requirements ({percentage}%)
   Non-testable: BLOCKED={n} UNCLEAR={n} (needs re-opening)
   ```

5. **With NO TEST, FAIL, BLOCKED or UNCLEAR requirements:**

   Per uncovered requirement, AskUserQuestion:

   ```yaml
   header: "REQ not covered: {REQ-ID}"
   question: "{requirement description} — no test found. What do you want to do?"
   options:
     - label: "Add test (Recommended)", description: "Write a test — CLI/acceptance, Playwright runner spec for BROWSER, or visual baseline via toHaveScreenshot"
     - label: "Covered by other test", description: "Implicitly tested via another test"
     - label: "Blocked by dependency", description: "External service/fixture missing — not testable now"
     - label: "Criteria too vague", description: "Acceptance criteria lacks concreteness — re-open /dev-define or convert to visual baseline"
   multiSelect: false
   ```

   - **Add test** → add test item to `tests.checklist[]` with `requirementId`, `status: "pending"`. Loop back to PHASE 1 (AUTO) or PHASE 2 (MANUAL) for this item only. Automatically choose the right method:
     - Functional criterion → CLI/acceptance test (vitest/jest)
     - Browser behavior / user flow → Playwright runner spec in `test/acceptance/{feature}.spec.ts`
     - Visual criterion ("feels fast", "looks good", "no layout-shift") → `toHaveScreenshot()` baseline via runner
     - A11y criterion → `toMatchAriaSnapshot()` via runner
   - **Covered by other test** → ask which test covers it. Mark requirement with `implicitCoverage: "{REQ-ID} test also validates this via {description}"`. Status → `"PASS"`.
   - **Blocked by dependency** → ask which dependency. Status → `"BLOCKED"`, add to `requirements[].evidence = "blocked by: {reason}"`. Not merge-blocking; signal to re-open after dependency fix.
   - **Criteria too vague** → two paths:
     - Can be concretized with a visual baseline → write `toHaveScreenshot()` runner spec, status → `"PASS"` after baseline.
     - Cannot be concretized → ask what is vague. Status → `"UNCLEAR"`, add to `requirements[].evidence = "needs clarification: {what's vague}"`. Signal for `/dev-define` re-open to formulate concrete acceptance.

---

## 6. After existence-coverage: assertion-strength measurement

The coverage above measures **test existence** per REQ. It does not measure whether those tests would catch a subtly wrong implementation — a test with `expect(x).toBeDefined()` where `expect(x).toBe(5)` should have been used still counts as COVERED here.

Therefore run Stryker mutation measurement as a complementary check: see `../../shared/MUTATION-TESTING.md` § dev-verify PHASE 5d for the runner detection, invocation, and mapping of survivors to `requirementId`. Output goes to `feature.json#tests.mutationScore`. Survivors on happy-only REQs (filter `requirements[]` where no `acceptance[].category` of `edge` or `boundary` is present) become the same kind of AUTO-items as above — back to PHASE 1 for sharper assertions. No blocking on MIXED/SHALLOW — informational signal alongside the PASS count.
