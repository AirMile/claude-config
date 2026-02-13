---
name: dev-build
description: Build features with automatic stack detection and TDD or implementation-first technique selection. Use with /dev-build after /dev-define. Reads requirements from workspace and builds sequentially.
disable-model-invocation: true
metadata:
  author: mileszeilstra
  version: 1.0.0
  category: dev
---

# Build

## Overview

This is **FASE 2** of the dev workflow: define -> **build** -> test

Auto-detects stack from CLAUDE.md, selects technique per requirement (TDD or Implementation First), then builds sequentially.

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

### FASE 1: Technique Mapping (Per Requirement)

Analyze EACH requirement individually and assign a technique:

```
For each REQ-XXX:
  IF requirement involves:
    - validation rules, business logic, calculations, complex conditions
    → TDD

  IF requirement involves:
    - CRUD, middleware, config, straightforward wiring
    → Implementation First

  DEFAULT → Implementation First
```

Display technique map:

```
TECHNIQUE MAP:

| REQ     | Technique            | Reason               |
|---------|----------------------|----------------------|
| REQ-001 | TDD                  | validation logic     |
| REQ-002 | Implementation First | CRUD endpoint        |
| REQ-003 | TDD                  | business rules       |
```

### FASE 2: Execute Build (Per Requirement)

Initialize Ralph Loop for entire build:

```bash
powershell -ExecutionPolicy Bypass -File .claude/scripts/ralph/setup-ralph-loop.ps1 `
  -Prompt @"
Feature: {feature-name}
Requirements:
{list from 01-define.md with technique per requirement}

Implementation order:
{dependency order}

Build this feature. Per requirement, use the assigned technique (TDD or Implementation First).
Output <promise>BUILD_COMPLETE</promise> when ALL requirements are implemented and tested.
"@ `
  -MaxIterations 30 `
  -CompletionPromise "BUILD_COMPLETE"
```

For each requirement in IMPLEMENTATION ORDER:

1. Load technique resource:
   ```
   Read(".claude/skills/dev-build/techniques/{assigned-technique}.md")
   ```
2. Execute the technique workflow for THIS requirement
3. Output per requirement:
   ```
   [REQ-XXX] {description}
   Technique: {TDD | Implementation First}
   {technique-specific output}
   SYNC: {pattern/concept} in {file(s)} — {1-2 sentences: what, why, what depends on it}
   Progress: {done}/{total}
   ```

After all requirements complete: run integration tests across requirements.

**Shared rules:**

- Requirements implemented SEQUENTIALLY (dependency order from 01-define.md)
- Context7 research if unfamiliar pattern needed
- All requirements must have tests before completion

**Loop completion:**

```
<promise>BUILD_COMPLETE</promise>

All {count} requirements implemented and tested.
Techniques used: TDD ({n}), Implementation First ({n})
```

### FASE 3: Generate Test Checklist

Create `03-test-checklist.md`:

```markdown
# Test Checklist: {Feature}

## Build Summary

**Feature:** {feature-name}
**Build Date:** {date}
**Techniques:** TDD ({n}), Implementation First ({n})
**Tests:** {passed}/{total} passing

## Automated Tests Status

| REQ     | Technique | Test               | Status |
| ------- | --------- | ------------------ | ------ |
| REQ-001 | TDD       | {test description} | PASS   |

## Files Created

{list of created/modified files}

## Manual Testing Required

### Checklist

| #   | Test               | Pass | Notes |
| --- | ------------------ | ---- | ----- |
| 1   | {test description} | [ ]  |       |

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

**Step 1b: Codebase Sync**

Generate an architectural overview that connects all built requirements. Display in conversation AND write to `02-build-log.md` under a `## Codebase Sync` heading.

Purpose: Keep the user in sync with the codebase — explain how everything fits together, which patterns were used and why, and how data flows through the system.

Format:

```
## Codebase Sync

### Architecture

{dependency flow diagram showing how layers connect}
Example: Types → Schemas → API Routes → Hooks → Components → Pages

### Key Patterns

| Pattern | Where | Why |
|---------|-------|-----|
| {pattern name} | {file(s)} | {why this pattern was chosen over alternatives} |

### Data Flow

{Numbered flows for main user journeys through the system}

1. **{Journey name}**: {Step → Step → Step}
2. **{Journey name}**: {Step → Step → Step}

### Key Decisions

{Decisions that deviate from obvious/default approaches — only non-obvious choices with reasoning}

- **{Decision}** — {reasoning}
```

Guidelines:

- Key Patterns: only include patterns that aren't obvious from the stack (e.g., don't list "React components" — do list "discriminated unions for exhaustive type checking")
- Data Flow: trace the 2-3 most important user journeys end-to-end
- Key Decisions: only decisions where an alternative was considered and rejected — explain the trade-off

**Step 2: Output summary**

```
BUILD COMPLETE: {feature}
========================

Techniques: TDD ({n}), Implementation First ({n})
Tests: {passed}/{total} PASS
Files created: {count}

Documentation:
- .workspace/features/{feature}/02-build-log.md
- .workspace/features/{feature}/03-test-checklist.md

Codebase Sync: See architectural overview above or in 02-build-log.md
```

**Next Step**

`/dev:test {feature}`

**Step 3: Sync backlog**

Move feature from `### DEF` to `### BLT` in `.workspace/backlog.md`

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

## Troubleshooting

### Error: Stack not detected
**Cause:** No `### Stack` section found in CLAUDE.md.
**Solution:** Run `/core-setup` first, or manually add a `### Stack` section under `## Project` in CLAUDE.md.

### Error: No define file found
**Cause:** Missing `.workspace/features/{name}/01-define.md`.
**Solution:** Run `/dev-define {name}` first to create the feature definition.

### Error: Tests fail after implementation
**Cause:** TDD cycle not completing — test expectations may not match implementation.
**Solution:** Check the test output carefully. If the test itself is wrong, fix the test first, then re-run. The RED-GREEN-REFACTOR cycle should catch this.

### Error: Technique detection picks wrong approach
**Cause:** Requirement type misidentified (TDD vs Implementation First).
**Solution:** You can override technique selection. If a requirement has clear testable behavior, use TDD. If it's UI/visual, use Implementation First.

