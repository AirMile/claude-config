# Technique: TDD (Test-Driven Development)

## When to use

- Business logic, validation rules, complex calculations
- Features where correctness is critical
- Code with many edge cases

## Single Requirement Workflow

### Step 1: Write Test (RED)

Generate test for THIS requirement. Follow project test conventions.
Run test — expect FAIL. If test passes immediately — you're testing existing behavior. Adjust the test.

### Step 2: Implement (GREEN)

Write minimal code to make the test pass. Context7 research if needed.
Run test — expect PASS.

### Step 3: Refactor

Clean up implementation. Apply project conventions.
Run test — confirm still PASS.

### Output

```
REQ-XXX: {description}
RED:      FAIL ({reason})
GREEN:    PASS
REFACTOR: PASS
SYNC:    {pattern/concept} in {main file(s)} — {what it does and why this approach. What depends on it.}
```
