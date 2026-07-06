# TDD Cycle Patterns

## Overview

Universal Test-Driven Development patterns applicable to all stacks.

## The RED-GREEN-REFACTOR Cycle

```
┌─────────────────────────────────────────────────────┐
│                    TDD CYCLE                        │
│                                                     │
│   ┌─────┐     ┌───────┐     ┌──────────┐          │
│   │ RED │ ──► │ GREEN │ ──► │ REFACTOR │ ──┐      │
│   └─────┘     └───────┘     └──────────┘   │      │
│      ▲                                      │      │
│      └──────────────────────────────────────┘      │
│                                                     │
└─────────────────────────────────────────────────────┘
```

### RED Phase

**Goal:** Write a failing test that defines expected behavior.

**Rules:**

1. Write the test BEFORE any implementation
2. Test should fail for the RIGHT reason (missing implementation, not syntax error)
3. Test should be specific and focused on ONE requirement
4. If test PASSES immediately → you're testing existing behavior, not new. Fix the test.
5. Use descriptive test names: `should {action} when {condition}`

**Output format:**

```
RED: REQ-XXX - FAIL ({reason})
```

**Good reasons for failure:**

- Component/class not found
- Method not implemented
- Expected value not returned

**Bad reasons for failure:**

- Syntax error in test
- Missing import
- Test setup issue

### GREEN Phase

**Goal:** Write the MINIMAL code to make the test pass.

**Rules:**

1. Write the simplest implementation that passes
2. Don't optimize or add extra features
3. It's OK if the code is ugly - we'll fix it in REFACTOR
4. Focus on making THIS test pass, not future tests

**Output format:**

```
GREEN: REQ-XXX - PASS ({what was implemented})
```

**Minimal means:**

- Hard-coded values are OK if they pass the test
- Single responsibility - only implement what's tested
- No premature abstraction

### REFACTOR Phase

**Goal:** Improve code quality while keeping tests green.

**Rules:**

1. Run tests after EVERY change
2. If tests fail, undo the change immediately
3. Focus on readability and maintainability
4. Extract patterns if same code appears 3+ times
5. Apply stack-specific conventions

**Output format:**

```
REFACTOR: PASS ({what was improved})
```

**Common refactorings:**

- Extract function/method
- Rename for clarity
- Remove duplication
- Improve type annotations
- Add error handling (if tested)

## Test Naming Conventions

### Format

```
should {expected behavior} when {condition/context}
```

### Examples

**Good:**

```
should return error when email is invalid
should redirect to dashboard after successful login
should disable submit button when form is invalid
should increment counter when plus button clicked
```

**Bad:**

```
test email                    // Too vague
testValidation               // Not descriptive
it works                     // Meaningless
emailValidationTest          // Not behavior-focused
```

## Test Structure (AAA Pattern)

### Arrange-Act-Assert

```
// Arrange: Set up test conditions
const user = createTestUser()
const input = { email: 'invalid' }

// Act: Execute the code under test
const result = validateEmail(input.email)

// Assert: Verify the result
expect(result.valid).toBe(false)
expect(result.error).toBe('Invalid email format')
```

**Rules:**

- One Act section per test
- Multiple Asserts OK if testing same action
- Keep Arrange minimal and focused

## When to Write Tests First

### ALWAYS write tests first when:

- Implementing a new feature (REQ-XXX)
- Fixing a bug (write a failing test that reproduces it BEFORE fixing)
- Adding validation logic
- Implementing business rules

### OK to skip test-first when:

- Prototyping/exploring (but add tests after)
- Pure UI styling (no logic)
- Configuration changes

## Sequential vs Parallel Testing

### Sequential (Default)

Use when requirements have dependencies:

```
REQ-001: User can create account     (base)
REQ-002: User can login              (depends on REQ-001)
REQ-003: User can access dashboard   (depends on REQ-002)
```

### Parallel

Use when requirements are independent:

```
REQ-001: Form validates email
REQ-002: Form validates phone
REQ-003: Form validates address
(All independent - can test in parallel)
```

## Test Isolation

**Each test must:**

1. Set up its own state
2. Not depend on other tests
3. Clean up after itself
4. Pass when run alone OR with other tests

**Never:**

- Share mutable state between tests
- Assume test execution order
- Leave side effects (DB records, files, etc.)

## Handling Test Failures

### Expected Failure (RED phase)

- Continue to GREEN phase
- Log: `RED: FAIL (expected)`

### Unexpected Failure (GREEN/REFACTOR phase)

1. STOP immediately
2. Analyze error message
3. Check if implementation is wrong
4. Check if test is wrong
5. Fix the issue
6. Re-run test
7. Only continue when PASS

### Flaky Tests

If test passes sometimes and fails sometimes:

1. Mark as FLAKY
2. Investigate root cause:
   - Timing issues (async)
   - Shared state
   - External dependencies
3. Fix before continuing

## When Stuck

| Problem                | Solution                                                |
| ---------------------- | ------------------------------------------------------- |
| Don't know how to test | Write the desired API call first, then assert on it     |
| Test too complex       | Design too complex — simplify the interface             |
| Must mock everything   | Code too tightly coupled — use dependency injection     |
| Test setup is huge     | Extract test helpers; if still complex, simplify design |

## Context Efficiency

### Minimize Context Per Iteration

**Show:**

- Current test name
- Phase (RED/GREEN/REFACTOR)
- Status (PASS/FAIL)
- Brief reason for failure

**Don't show:**

- Full stack traces (unless debugging)
- All passing tests (just count)
- Verbose framework output

### Example Good Output

```
[ITERATION 3]
Test: should validate email format
RED:      FAIL (validateEmail not defined)
GREEN:    PASS (implemented in useFormValidation.ts)
REFACTOR: PASS (extracted regex to constant)
Progress: 3/5 tests passing
```

### Example Bad Output

```
[ITERATION 3]
Running test suite...
  ✓ should create user (150ms)
  ✓ should validate name (23ms)
  ✗ should validate email
    Expected: false
    Received: undefined
    at Object.<anonymous> (tests/form.test.ts:45:12)
    at processTicksAndRejections (internal/process/task_queues.js:95:5)
    ... 15 more lines of stack trace ...
```
