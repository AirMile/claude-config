# PHASE 3: Automated Test Execution — Task Agent

Load this file when entering PHASE 3. Contains the Task agent prompt template and result parsing instructions.

---

**Launch a Task agent** to execute all AUTO items in a separate context window. This prevents snapshot/screenshot data from consuming the main conversation context.

**Task agent prompt template:**

```
Test the following items automatically via playwright-cli daemon, bash commands, or integration tests.
Dev server: {url}
Feature: {feature-name}

{STACK_CONTEXT}

ITEMS:
{for each AUTO item:}
- Item {N}: {title} [Requirement: {REQ-ID}]
  Steps: {test steps}
  Test data: {test data from PHASE 2}
  Expected: {expected outcome}
  Method: {BROWSER or CLI}
  Pattern: {matching test pattern from test-classification.md}

INSTRUCTIONS:
1. Navigate to the dev server URL and verify it is running
2. For each item:
   a. Execute the steps using browser tools (`playwright-cli` daemon — see `shared/PLAYWRIGHT.md`) or bash commands. For runtime-state assertions beyond DOM-snapshot (computed values, store contents, framework-internals), use `playwright-cli eval "() => ({ ... })"`.
   b. Analyze the result and determine PASS or FAIL with evidence
3. If a browser tool fails for an item, mark as TOOL_ERROR

RESULT FORMAT (strict):
AUTOMATED_RESULTS_START
| # | Test | Requirement | Result | Evidence | Reasoning |
|---|------|-------------|-----------|--------|------------|
| {N} | {title} | {REQ-ID} | PASS/FAIL/TOOL_ERROR | {what was seen} | {why pass/fail} |
AUTOMATED_RESULTS_END

FALLBACK_ITEMS: {items with TOOL_ERROR, comma-separated numbers, or "none"}
```

**Parse agent results:**

1. If TaskOutput contains `AUTOMATED_RESULTS_START` → parse directly
2. If truncated → use Grep to find markers in agent output file, Read with offset
3. TOOL_ERROR items → reclassify as MANUAL for PHASE 4

Display:

```
AUTO TEST RESULTS: {feature-name}

| # | Test              | Requirement | Result | Evidence (short)             |
|---|-------------------|-------------|-----------|----------------------------|
| 1 | Valid registration| REQ-001     | ✓ PASS    | /dashboard + welcome message |
| 2 | Without email     | REQ-002     | ✗ FAIL    | No error message visible     |

AUTO PASS: {n}  AUTO FAIL: {n}  TOOL_ERROR → MANUAL: {n}
```

**If agent fails entirely:** Graceful fallback → reclassify all AUTO as MANUAL, proceed to PHASE 4.
