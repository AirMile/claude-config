---
description: Build features with automatic stack detection and technique selection
disable-model-invocation: true
---

# Build

## Overview

This is **FASE 2** of the dev workflow: define -> **build** -> test

Auto-detects stack from CLAUDE.md, lets user choose implementation technique, then follows the technique workflow.

**Trigger**: `/dev:build` or `/dev:build [feature-name]`

## Input

Reads from `.workspace/features/{feature-name}/01-define.md`:
- Requirements with IDs (REQ-XXX)
- Architecture design
- Implementation order

## Output Structure

```
.workspace/features/{feature-name}/
├── 01-define.md
├── 02-build-log.md
└── 03-test-checklist.md
```

## Process

### FASE 0: Stack Detection & Context Loading

**Step 1: Detect Stack**

1. Read `.claude/CLAUDE.md`
2. Find `### Stack` section under `## Project`
3. Parse stack type and testing framework

**Step 2: Load Context**

Optionally load stack-baseline for project-specific patterns:
- `.claude/research/stack-baseline.md` (if exists)

**Step 3: Load Feature Context**

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

   IMPLEMENTATION ORDER:
   (from 01-define.md)
   ```

### FASE 1: Technique Selection (Automatic)

Analyze requirements from 01-define.md and select technique:

```
IF requirements contain:
  - validation rules, business logic, calculations, complex conditions
  → TDD

IF requirements contain:
  - CRUD, middleware, config, straightforward wiring
  → Implementation First

DEFAULT → Implementation First
```

Load technique resource:
```
Read(".claude/skills/dev-build/techniques/{selected-technique}.md")
```

Display:
```
TECHNIQUE: {name}
Reason: {why this technique fits these requirements}
```

### FASE 2: Execute Technique

Follow the workflow defined in the loaded technique resource.
The technique defines its own steps, Ralph Loop config, and output formats.

**Shared rules across all techniques:**
- Requirements implemented SEQUENTIALLY (dependency order from 01-define.md)
- Context7 research if unfamiliar pattern needed
- All requirements must have tests before completion

### FASE 3: Generate Test Checklist

Create `03-test-checklist.md`:

```markdown
# Test Checklist: {Feature}

## Build Summary

**Feature:** {feature-name}
**Build Date:** {date}
**Technique:** {selected technique}
**Tests:** {passed}/{total} passing

## Automated Tests Status

| REQ | Test | Status |
|-----|------|--------|
| REQ-001 | {test description} | PASS |

## Files Created

{list of created/modified files}

## Manual Testing Required

### Checklist

| # | Test | Pass | Notes |
|---|------|------|-------|
| 1 | {test description} | [ ] | |

## Feedback Format

Use `/dev:test {feature}` with results:
```
1:PASS
2:FAIL {reason}
```
```

### FASE 4: Completion

**Step 1: Update build log**

Create/update `02-build-log.md` with implementation history.

**Step 2: Output summary**

```
BUILD COMPLETE: {feature}
========================

Technique: {selected technique}
Tests: {passed}/{total} PASS
Files created: {count}

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

Condense all test output to this format. Omit stack traces, framework banners, and verbose output.

**PASS:** `TESTS: {n}/{n} PASS ({time})`

**FAIL:**
```
TESTS: {passed}/{total} PASS ({time})
FAILED:
- {file}:{line} - {reason <50 chars}
```

## Stack-Specific Behavior

Determine test commands, file extensions, mocking approach, and async patterns from:
1. `### Testing` section in CLAUDE.md
2. Stack-baseline patterns (`.claude/research/stack-baseline.md`)
3. Claude's own knowledge of the detected framework

## Error Handling

### Test Failures

If a test fails unexpectedly:
1. Log the failure
2. Analyze the error
3. Fix the implementation
4. Re-run test
5. Continue only when PASS

### Build Blockers

If implementation is blocked:
1. Log the blocker in 02-build-log.md
2. Mark affected requirements as BLOCKED
3. Continue with other requirements
4. Report blockers at completion
