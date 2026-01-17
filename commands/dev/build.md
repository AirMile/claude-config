---
description: TDD implementation with automatic stack detection and resource loading
---

# Build

## Overview

This is **FASE 2** of the dev workflow: define -> **build** -> test

Universal command that auto-detects stack from CLAUDE.md and loads appropriate testing resources.

**Trigger**: `/dev:build` or `/dev:build [feature-name]`

## Input

Reads from `.workspace/features/{feature-name}/01-define.md`:
- Requirements with IDs (REQ-XXX)
- Architecture design
- Component/hook structure

## Output Structure

```
.workspace/features/{feature-name}/
├── 01-define.md
├── 02-build-log.md
├── 03-test-checklist.md
└── test-scenarios.md

src/
├── components/     # React components
├── hooks/          # Custom hooks
├── pages/          # Page components
├── services/       # API services
└── types/          # TypeScript types

tests/
├── unit/           # Vitest unit tests
├── integration/    # Integration tests
└── e2e/            # Playwright E2E (optional)
```

## Process

### FASE 0: Stack Detection & Resource Loading

**Step 1: Detect Stack**

1. Read `.claude/CLAUDE.md`
2. Find `### Stack` section under `## Project`
3. Parse stack type:

   ```
   IF **Frontend**: exists → has_frontend = true
   IF **Backend**: exists → has_backend = true
   IF **Engine**: exists → is_game = true

   stack_type =
     is_game ? "game" :
     has_frontend && has_backend ? "fullstack" :
     has_frontend ? "frontend" :
     has_backend ? "backend" : "unknown"
   ```

4. Parse testing framework from `### Testing` section:
   ```
   **Frontend**: Vitest, RTL → testing_frontend = "vitest-rtl"
   **Backend**: PHPUnit → testing_backend = "phpunit"
   **Backend**: Jest → testing_backend = "jest-node"
   **Unit**: GUT → testing_game = "gut"
   ```

**Step 2: Load Resources**

Based on detected stack, read the appropriate resources:

| Stack Type | Resources to Load |
|------------|-------------------|
| frontend | `.claude/resources/testing/vitest-rtl.md` |
| backend (Laravel) | `.claude/resources/testing/phpunit.md` |
| backend (Node) | `.claude/resources/testing/jest-node.md` |
| fullstack | Both frontend + backend resources |
| game | `.claude/resources/testing/gut.md` |

Also always load:
- `.claude/resources/patterns/tdd-cycle.md`
- `.claude/resources/patterns/output-parsing.md`

**Step 3: Display Context**

```
STACK DETECTED
==============

Type: {stack_type}
Frontend: {frontend_framework} (if applicable)
Backend: {backend_framework} (if applicable)

Testing:
- {testing_framework}: {resource_loaded}

Resources loaded: {count}
```

**Step 4: Load Feature Context**

1. If no feature name provided:
   - List available features in `.workspace/features/`
   - Use **AskUserQuestion** to let user select

2. Load `01-define.md`:
   - Extract all requirements (REQ-XXX format)
   - Parse architecture design
   - Extract implementation order

3. Display:
   ```
   FEATURE: {feature-name}

   REQUIREMENTS:
   - REQ-001: [description]
   - REQ-002: [description]

   ARCHITECTURE:
   (from 01-define.md)

   IMPLEMENTATION ORDER:
   (from 01-define.md)
   ```

### FASE 1: Generate All Tests First

**Use patterns from loaded testing resource.**

The testing resource defines:
- Test file structure
- Import statements
- Query patterns (for frontend)
- Assertion methods
- Mocking approach

#### Step 0: Testing Research (Just-in-Time)

Before generating tests, check if research is needed:

```
IF patterns exist in loaded resource → skip research
ELSE → research via Context7
```

#### Step 1: Generate Test Stubs

For EACH requirement, generate a corresponding test stub using the template from the loaded testing resource.

**Frontend example (from vitest-rtl.md):**
```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

describe('FeatureName', () => {
  beforeEach(() => {
    // Setup
  })

  // REQ-001: {requirement description}
  it.todo('should {description}')

  // REQ-002: {requirement description}
  it.todo('should {description}')
})
```

**Backend example (from phpunit.md):**
```php
<?php

namespace Tests\Feature;

use Tests\TestCase;
use Illuminate\Foundation\Testing\RefreshDatabase;

class FeatureNameTest extends TestCase
{
    use RefreshDatabase;

    // REQ-001: {requirement description}
    public function test_should_description(): void
    {
        $this->markTestIncomplete('TODO');
    }
}
```

#### Step 2: Verify Test Structure

1. Create test file based on resource template
2. Run test command from resource:
   - Frontend: `npm run test -- tests/unit/{feature}.test.ts`
   - Backend: `php artisan test --filter={Feature}`
3. All tests should be SKIPPED (todo)

**Output:**
```
FASE 1 COMPLETE

Tests generated: {count}
Status: All TODO/SKIPPED
Framework: {from loaded resource}

Ready for TDD cycle.
```

### FASE 2: TDD Cycle (Sequential)

**Use TDD patterns from `.claude/resources/patterns/tdd-cycle.md`**

**IMPORTANT: Sequential Execution with Context Passing**

Requirements must be implemented SEQUENTIALLY because later requirements may depend on earlier ones.

#### Step 0: Initialize Ralph Loop

```bash
powershell -ExecutionPolicy Bypass -File .claude/scripts/ralph/setup-ralph-loop.ps1 `
  -Prompt @"
Feature: {feature-name}
Requirements:
{list from 01-define.md}

Implementation order (from FASE 0):
{dependency order}

Build this feature using TDD.
Output <promise>TDD_COMPLETE</promise> when ALL tests pass.
"@ `
  -MaxIterations 30 `
  -CompletionPromise "TDD_COMPLETE"
```

#### Step 1: Sequential TDD Loop

For each requirement in IMPLEMENTATION ORDER:

**RED Phase:**
1. Implement test assertion (replace `.todo()` with actual test)
2. Run test - expect FAIL
3. Log: `RED: REQ-XXX - FAIL (expected)`

**GREEN Phase:**

Research decision (from resource):
- If pattern is in testing resource → no research needed
- If new pattern required → Context7 research

Implement minimal code to make test pass.

**REFACTOR Phase:**
1. Clean up while keeping tests green
2. Apply conventions from loaded stack resource
3. Re-run tests to verify

**Output per iteration (use output-parsing.md format):**
```
[ITERATION {n}]
Test: should {description}
RED:      FAIL (component not found)
GREEN:    PASS (implemented)
REFACTOR: PASS
Progress: {passed}/{total}
```

**Loop completion:**
```
RALPH LOOP COMPLETE

All {count} tests PASS

Files created:
- src/components/{Component}.tsx
- src/hooks/{useHook}.ts
...
```

### FASE 3 & 4: Integration Tests + Checklist (PARALLEL)

Run in parallel - no dependencies.

#### FASE 3: Integration Tests

Use MSW/Fakes patterns from testing resource.

**Frontend:** Create `tests/integration/{feature}.integration.test.tsx`
**Backend:** Create `tests/Feature/{Feature}IntegrationTest.php`

#### FASE 4: Generate Test Checklist

Create `03-test-checklist.md`:

```markdown
# Test Checklist: {Feature}

## Build Summary

**Feature:** {feature-name}
**Build Date:** {date}
**Tests:** {passed}/{total} passing

## Automated Tests Status

| REQ | Test | Status |
|-----|------|--------|
| REQ-001 | should validate email format | PASS |
| REQ-002 | should submit form data | PASS |

## Files Created

### Components
- `src/components/{Component}.tsx`

### Hooks
- `src/hooks/{useHook}.ts`

## Manual Browser Testing Required

### Setup
1. Run dev server: `npm run dev`
2. Navigate to: `http://localhost:5173/{route}`

### Checklist

| # | Test | Pass | Notes |
|---|------|------|-------|
| 1 | {Visual test 1} | [ ] | |
| 2 | {Interaction test 2} | [ ] | |

## Feedback Format

Use `/dev:test {feature}` with results:
```
1:PASS
2:FAIL {reason}
```
```

### FASE 5: Completion

**Step 0: Ralph Completion Check**

```
IF all tests PASS:
    Output: <promise>TDD_COMPLETE</promise>
ELSE:
    Output: "{failed_count} tests failed"
```

**Step 1: Update build log**

Create/update `02-build-log.md` with full TDD history.

**Step 2: Output summary**

```
BUILD COMPLETE: {feature}
========================

Stack: {detected stack}
Tests: {passed}/{total} PASS
Files created: {count}

Created files:
- tests/unit/{feature}.test.tsx
- src/components/...
- src/hooks/...

Documentation:
- .workspace/features/{feature}/02-build-log.md
- .workspace/features/{feature}/03-test-checklist.md
```

**Next Step**

`/dev:test {feature}`

**Step 3: Sync backlog**

Move feature from `### DEF` to `### BLT` in `.workspace/backlog.md`

**Step 4: Send notification**

```bash
powershell -ExecutionPolicy Bypass -File .claude/scripts/notify.ps1 -Title "Claude Code" -Message "Build complete: {feature}"
```

## Test Output Parsing (CRITICAL)

**ALL test runs use format from `.claude/resources/patterns/output-parsing.md`**

This ensures consistent, compact output regardless of stack:

**PASS:** `TESTS: {n}/{n} PASS ({time})`

**FAIL:**
```
TESTS: {passed}/{total} PASS ({time})
FAILED:
- {file}: {reason}
```

**This reduces context by ~90% per test run.**

## Stack-Specific Behavior

The loaded resource determines:

| Aspect | Frontend (Vitest) | Backend (PHPUnit) | Backend (Jest) |
|--------|-------------------|-------------------|----------------|
| Test command | `npm run test` | `php artisan test` | `npm run test` |
| Test file ext | `.test.tsx` | `Test.php` | `.test.ts` |
| Mocking | MSW, vi.mock | Laravel Fakes | Jest mocks |
| Async | await, findBy | assertDatabaseHas | await, expect |

## Resource Fallback

If resources don't exist:

1. Check `.claude/research/stack-baseline.md` for patterns
2. If still missing: Use Context7 to research stack
3. Warn user: "Resources not found. Run /setup to generate."

## Error Handling

### Test Failures During Ralph Loop

If a test fails unexpectedly during GREEN phase:
1. Log the failure with full error message
2. Analyze the error
3. Fix the implementation
4. Re-run test
5. Continue only when PASS

### Build Blockers

If implementation is blocked:
1. Log the blocker in 02-build-log.md
2. Mark affected tests as BLOCKED
3. Continue with other tests
4. Report blockers at completion

## Examples

### Frontend (React) Build

```
STACK DETECTED: frontend
Framework: React 19, Vite 7
Testing: Vitest, RTL

Resource loaded: .claude/resources/testing/vitest-rtl.md

[Using RTL query patterns from resource]
[Using MSW mocking from resource]
[Using Vitest assertions from resource]
```

### Backend (Laravel) Build

```
STACK DETECTED: backend
Framework: Laravel 11, PHP 8.3
Testing: PHPUnit

Resource loaded: .claude/resources/testing/phpunit.md

[Using RefreshDatabase trait from resource]
[Using Factory patterns from resource]
[Using Laravel Fakes from resource]
```

### Fullstack Build

```
STACK DETECTED: fullstack
Frontend: React 19
Backend: Laravel 11
Testing: Vitest + PHPUnit

Resources loaded:
- .claude/resources/testing/vitest-rtl.md
- .claude/resources/testing/phpunit.md

[Running frontend tests first]
[Then backend tests]
[Then integration tests spanning both]
```
