# Test Output Parsing

## Overview

Universal rules for parsing and displaying test output across all frameworks.
Goal: **90% context reduction** while preserving actionable information.

## Why Parse Output?

Raw test output problems:
- Vitest: 50-100 lines per run
- PHPUnit: 30-80 lines per run
- Jest: 40-100 lines per run
- Multiple runs per build = context bloat

Parsed output:
- PASS: 1 line
- FAIL: 5-10 lines max
- **90% reduction per test run**

## Universal Output Format

### PASS Scenario (1 line)

```
TESTS: {passed}/{total} PASS ({time})
```

**Examples:**
```
TESTS: 15/15 PASS (2.3s)
TESTS: 42/42 PASS (5.1s)
TESTS: 8/8 PASS (0.8s)
```

### FAIL Scenario (max 10 lines)

```
TESTS: {passed}/{total} PASS ({time})
FAILED:
- {file}:{line} - {reason}
- {file}:{line} - {reason}
```

**Examples:**
```
TESTS: 13/15 PASS (2.3s)
FAILED:
- Button.test.tsx:23 - expected 'Submit' but got 'Loading'
- useAuth.test.ts:45 - hook returned undefined
```

```
TESTS: 40/42 PASS (5.1s)
FAILED:
- UserTest.php:67 - Expected status 200, got 401
- LoginTest.php:34 - Missing required field 'email'
```

### PENDING/SKIPPED Scenario (max 5 lines)

```
TESTS: {passed}/{total} PASS, {skipped} SKIPPED ({time})
```

**Examples:**
```
TESTS: 4/15 PASS, 11 SKIPPED (1.2s)
TESTS: 0/8 PASS, 8 TODO (0.3s)
```

### ERROR Scenario (max 10 lines)

For test runner errors (not test failures):

```
ERROR: {type}
{brief description}
```

**Examples:**
```
ERROR: Configuration
vitest.config.ts not found

ERROR: Syntax
SyntaxError in Button.test.tsx:12
Unexpected token '}'

ERROR: Timeout
Test exceeded 5000ms timeout
```

## Parsing Rules Per Framework

### Vitest Output

**Raw input:**
```
 ✓ src/components/Button.test.tsx (3 tests) 150ms
   ✓ Button > should render
   ✓ Button > should handle click
   ✓ Button > should be disabled when loading
 ✗ src/hooks/useAuth.test.ts (2 tests) 89ms
   ✓ useAuth > should initialize
   ✗ useAuth > should authenticate
     → expected 'authenticated' but got 'loading'

 Test Files  1 passed | 1 failed (2)
 Tests       4 passed | 1 failed (5)
 Duration    1.23s
```

**Parsed output:**
```
TESTS: 4/5 PASS (1.2s)
FAILED:
- useAuth.test.ts: expected 'authenticated' but got 'loading'
```

### PHPUnit Output

**Raw input:**
```
PHPUnit 11.0.0 by Sebastian Bergmann and contributors.

..F.                                                                4 / 4 (100%)

Time: 00:02.456, Memory: 24.00 MB

There was 1 failure:

1) Tests\Feature\LoginTest::test_user_can_login
Failed asserting that 401 matches expected 200.

/var/www/tests/Feature/LoginTest.php:34

FAILURES!
Tests: 4, Assertions: 8, Failures: 1.
```

**Parsed output:**
```
TESTS: 3/4 PASS (2.5s)
FAILED:
- LoginTest.php:34 - Expected 200, got 401
```

### Jest Output

**Raw input:**
```
 PASS  src/utils/format.test.ts
 FAIL  src/services/api.test.ts
  ● API Service › should fetch data
    expect(received).toEqual(expected)
    Expected: {"data": "test"}
    Received: undefined

      at Object.<anonymous> (src/services/api.test.ts:23:18)

Test Suites: 1 failed, 1 passed, 2 total
Tests:       1 failed, 5 passed, 6 total
Time:        3.456 s
```

**Parsed output:**
```
TESTS: 5/6 PASS (3.5s)
FAILED:
- api.test.ts:23 - expected {"data": "test"}, got undefined
```

### Playwright Output

**Raw input:**
```
Running 5 tests using 2 workers

  ✓ 1 login.spec.ts:12 › should login with valid credentials (2.3s)
  ✓ 2 login.spec.ts:25 › should show error for invalid password (1.8s)
  ✗ 3 login.spec.ts:38 › should redirect after login (3.1s)
  ✓ 4 dashboard.spec.ts:10 › should load dashboard (1.2s)
  ✓ 5 dashboard.spec.ts:22 › should show user name (0.9s)

  1) login.spec.ts:38 › should redirect after login
     Timeout waiting for navigation

  4 passed (9.3s)
  1 failed
```

**Parsed output:**
```
TESTS: 4/5 PASS (9.3s)
FAILED:
- login.spec.ts:38 - Timeout waiting for navigation
```

## Extraction Patterns

### What to Extract

| Element | Include | Example |
|---------|---------|---------|
| Pass count | ✓ | 4 |
| Total count | ✓ | 5 |
| Duration | ✓ | 2.3s |
| Failed file | ✓ | Button.test.tsx |
| Failed line | ✓ | :23 |
| Failure reason | ✓ (brief) | expected X, got Y |
| Stack trace | ✗ | (omit) |
| Passing test names | ✗ | (omit) |
| Memory usage | ✗ | (omit) |
| Worker info | ✗ | (omit) |

### Failure Reason Condensing

**Long reason → Short reason:**

```
"Failed asserting that two arrays are equal. Expected Array(...) Actual Array(...)"
→ "arrays not equal"

"Expected element to be visible but it was hidden"
→ "element not visible"

"Timeout of 5000ms exceeded waiting for element [data-testid='submit']"
→ "timeout waiting for submit button"

"Cannot read property 'map' of undefined"
→ "undefined.map() error"
```

## Implementation

### After Every Test Run

```
1. Capture raw output
2. Extract counts: passed, failed, total
3. Extract duration
4. For each failure:
   a. Extract file:line
   b. Condense reason to <50 chars
5. Format using template
6. Show ONLY parsed output
```

### Context Budget

Per TDD iteration:
- RED phase: ~3 lines
- GREEN phase: ~3 lines
- REFACTOR phase: ~2 lines
- **Total: ~8 lines per requirement**

For 10 requirements:
- Without parsing: ~500-1000 lines
- With parsing: ~80 lines
- **Savings: 90%+**

## Special Cases

### All Tests Pass (Common Case)

Show minimal output:
```
TESTS: 15/15 PASS (2.3s)
```

### First Run (All TODO)

```
TESTS: 0/15 PASS, 15 TODO (0.5s)
```

### Watch Mode

Don't show repeated passes. Only show:
- Status changes (PASS → FAIL or FAIL → PASS)
- New test results

### Coverage Report

If requested, add one line:
```
TESTS: 15/15 PASS (2.3s)
COVERAGE: 87% statements, 72% branches
```

## Do NOT Show

- Full stack traces
- Framework banners/headers
- Configuration output
- Watch mode prompts
- Debug logs
- Memory statistics
- Detailed timing per test
- Snapshot diffs (just say "snapshot mismatch")
