# PHASE 5c: Regression Check

**Skip when:**

- No TDD fixes applied in PHASE 3 (only MEASURABLE fixes → low chance of side effects)
- No existing test files to run

**Goal:** Verify that fixes have not broken previously-passing tests.

Re-run `gut_cmdln.gd` for ALL existing test files (not just the fixed ones). Compare output with the PHASE 0.6b baseline.

```
REGRESSION CHECK: {feature-name}

GUT test suite re-run...

Baseline: {n} pass / {n} fail
Now:      {n} pass / {n} fail

New failures:
- test_{x}.gd::test_{method}: {assertion error}

Regressions: {n} | Stable: {n}
```

**No regressions:** Continue to PHASE 5d.

**Regressions:** Show and offer choice via AskUserQuestion: Fix (Recommended) | Accept. If fixing → back to PHASE 3 for the regression items only. Do NOT repeat PHASE 5c after a regression fix (max 1 pass).

---

# PHASE 5d: Requirement Verification

**Skip when:** All tests FAIL (coverage check is pointless with catastrophic failures).

Cross-check `feature.json` requirements against test results:

1. **Load requirement → test mapping:**
   - Per `requirements[]` entry (id, description, status) — **skip entries with `deltaOp === "REMOVED"`**
   - Find matching `tests.checklist[]` entries via `requirementId`

2. **Build coverage matrix:**

   ```
   REQUIREMENT COVERAGE: {feature-name}

   | REQ       | Description (short)        | Tests | Status        |
   |-----------|----------------------------|-------|---------------|
   | REQ-001   | {first 40 chars}           | 2     | ✓ COVERED     |
   | REQ-002   | {first 40 chars}           | 0     | ✗ NO TEST     |
   | REQ-003   | {first 40 chars}           | 1     | ⊘ BLOCKED     |
   | REQ-004   | {first 40 chars}           | 0     | ? UNCLEAR     |

   Coverage: {covered}/{total} requirements ({percentage}%)
   Non-testable: BLOCKED={n} UNCLEAR={n} (needs reopening)
   ```

3. **Classify per requirement:**
   - **COVERED**: at least 1 test with matching `requirementId` AND status `PASS`
   - **FAIL**: at least 1 test matching but status `FAIL`
   - **BLOCKED**: test does not exist or fails due to external dependency (missing asset, addon not loaded, export preset missing)
   - **UNCLEAR**: no test possible because acceptance criteria is too vague (e.g. "feels juicy", "is fun") — non-deterministic
   - **NO TEST**: no test in `checklist[]` with matching `requirementId` (no legitimate reason)

4. **All requirements COVERED:** show compact summary, continue to PHASE 6.

5. **On NO TEST, FAIL, BLOCKED or UNCLEAR requirements:**

   Per uncovered requirement, AskUserQuestion:

   ```yaml
   header: "REQ not covered: {REQ-ID}"
   question: "{requirement description} — no test found. What do you want to do?"
   options:
     - label: "Add test (Recommended)", description: "Write a test for this requirement"
     - label: "Covered by other test", description: "Implicitly tested via another test"
     - label: "Blocked by dependency", description: "Missing asset/addon/preset — not testable now"
     - label: "Criteria too vague", description: "Acceptance criteria lacks concreteness — reopen /game-define"
   multiSelect: false
   ```

   - **Add test** → add test item to `tests.checklist[]` with `requirementId`, `status: "pending"`. Loop back to PHASE 1 for GUT test or PHASE 2 (MANUAL) for this item only.
   - **Covered by other test** → ask which test covers it. Mark requirement with `implicitCoverage: "{REQ-ID} test also validates this via {description}"`. Status → `"PASS"`.
   - **Blocked by dependency** → ask which dependency. Status → `"BLOCKED"`, add to `requirements[].evidence = "blocked by: {reason}"`. Not merge-blocking; signal to reopen after dependency fix.
   - **Criteria too vague** → ask what is vague. Status → `"UNCLEAR"`, add to `requirements[].evidence = "needs clarification: {what's vague}"`. Signal for `/game-define` reopen to formulate concrete acceptance.
