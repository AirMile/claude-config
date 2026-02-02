# Technique: TDD (Test-Driven Development)

## When to use

- Business logic, validation rules, complex calculations
- Features where correctness is critical
- Code with many edge cases

## Workflow

### Step 1: Generate Test Stubs

For EACH requirement, generate a test stub with TODO/skip markers.
Follow project test conventions and file structure.

Run tests — all should be SKIPPED (todo).

```
STEP 1 COMPLETE

Tests generated: {count}
Status: All TODO/SKIPPED
```

### Step 2: TDD Cycle (Sequential)

Initialize Ralph Loop:

```bash
powershell -ExecutionPolicy Bypass -File .claude/scripts/ralph/setup-ralph-loop.ps1 `
  -Prompt @"
Feature: {feature-name}
Requirements:
{list from 01-define.md}

Implementation order:
{dependency order}

Build this feature using TDD.
Output <promise>TDD_COMPLETE</promise> when ALL tests pass.
"@ `
  -MaxIterations 30 `
  -CompletionPromise "TDD_COMPLETE"
```

For each requirement in IMPLEMENTATION ORDER:

**RED:** Implement test assertion (replace todo). Run test — expect FAIL.
**GREEN:** Implement minimal code to pass. Context7 research if needed.
**REFACTOR:** Clean up, apply project conventions. Re-run tests.

**Output per iteration:**
```
[ITERATION {n}]
REQ-XXX: {description}
RED:      FAIL ({reason})
GREEN:    PASS
REFACTOR: PASS
Progress: {passed}/{total}
```

**Loop completion:**
```
<promise>TDD_COMPLETE</promise>

All {count} tests PASS
```

### Step 3: Integration Tests

Create integration tests for cross-requirement behavior.

### Step 4: Verify All

Run full test suite. All tests must PASS before completion.
