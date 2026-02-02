# Technique: Implementation First

## When to use

- CRUD operations, middleware, straightforward features
- Clear requirements where architecture is obvious
- Features where the shape is well-understood upfront

## Workflow

### Step 1: Implement (Sequential)

Initialize Ralph Loop:

```bash
powershell -ExecutionPolicy Bypass -File .claude/scripts/ralph/setup-ralph-loop.ps1 `
  -Prompt @"
Feature: {feature-name}
Requirements:
{list from 01-define.md}

Implementation order:
{dependency order}

Build this feature implementation-first.
Output <promise>BUILD_COMPLETE</promise> when all requirements are implemented.
"@ `
  -MaxIterations 30 `
  -CompletionPromise "BUILD_COMPLETE"
```

For each requirement in IMPLEMENTATION ORDER:

1. Implement the requirement fully
2. Verify it works (manual check or quick run)
3. Move to next requirement

**Output per iteration:**
```
[ITERATION {n}]
REQ-XXX: {description}
IMPLEMENTED: {what was built}
Files: {files created/modified}
Progress: {done}/{total}
```

**Loop completion:**
```
<promise>BUILD_COMPLETE</promise>

All {count} requirements implemented.
```

### Step 2: Write Tests

Generate tests for ALL implemented requirements.
Run tests — fix any failures before continuing.

```
TESTS: {passed}/{total} PASS ({time})
```

If tests fail, fix implementation until all pass.

### Step 3: Integration Tests

Create integration tests for cross-requirement behavior.

### Step 4: Verify All

Run full test suite. All tests must PASS before completion.
