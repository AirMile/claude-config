---
description: Refactor code quality after testing with autonomous analysis and parallel planning agents. Feature files only
disable-model-invocation: true
---

# Refactor

## Overview

This is **FASE 4** of the dev workflow: define -> build -> test -> **refactor**

Analyzes code quality autonomously, uses Context7 research only when needed, creates improvement plans with 3 strategies, and applies non-breaking changes with automatic rollback on test failure.

**Trigger**: `/dev:refactor` or `/dev:refactor {feature-name}`

## Scope Rule: Feature Files Only

**This skill ONLY refactors files that belong to the feature.**

- Extract all code file paths from `02-build-log.md` → these are the **pipeline files**
- ONLY these files may be analyzed, planned, and modified
- **NEVER** touch, scan, plan, or modify files outside this list
- If a pattern scan or research finding points to an external file → skip it, do not include in plan
- If a DRY violation spans a pipeline file and an external file → only refactor the pipeline file side
- Plan comparison tables do not need PIPELINE/EXTERNAL columns (everything is pipeline)

This rule exists because refactoring external files risks breaking other features and creates unpredictable side effects.

## When to Use

- After `/dev:test` completes with all tests passing
- When `.workspace/features/{name}/03-test-results.md` exists
- NOT for: fixing bugs (/dev:test), adding features (/dev:define), planning (/dev:define)

## Input

Reads from `.workspace/features/{feature-name}/`:

- `01-define.md` - Requirements and architecture
- `02-build-log.md` - Implementation details and file list
- `03-test-checklist.md` - Test items
- `03-test-results.md` - Verification results

## Output Structure

```
.workspace/features/{feature-name}/
├── 01-define.md          # Updated: Status: REFACTORED
├── 02-build-log.md       # From build phase
├── 03-test-checklist.md  # From build phase
├── 03-test-results.md    # From test phase
└── 04-refactor.md        # NEW: Refactor log and results
```

## Workflow

### FASE 0: Context Loading

1. **Parse user input:**
   - Feature name provided → validate it exists
   - No feature name → list available features, use AskUserQuestion to select
   - "recent" → find most recently modified 03-test-results.md

2. **Validate test results exist:**

   ```
   .workspace/features/{feature-name}/03-test-results.md
   ```

   If not found → exit with message to run `/dev:test {feature-name}` first.

3. **Load all feature documentation:**
   - Read `01-define.md` for requirements (REQ-XXX) and architecture
   - Read `02-build-log.md` for implementation details and created files
   - Read `03-test-checklist.md` for test items
   - Read `03-test-results.md` for verification results

4. **Build pipeline files list (scope boundary):**
   - Extract all code file paths from `02-build-log.md`
   - Store as `pipeline_files` — these are the ONLY files this skill may touch
   - Log the list explicitly for transparency

5. **Read all pipeline code files:**
   - Read each file in `pipeline_files` to understand current implementation
   - If > 5 files: show progress every 5 files (`Reading code files... ({current}/{total})`)
   - Note architectural patterns and improvement areas
   - Do NOT read files outside `pipeline_files`

**Output:**

```
CONTEXT LOADED: {feature-name}

| Metric | Value |
|--------|-------|
| Requirements | {N} (from 01-define.md) |
| Pipeline files | {N} files |
| Test status | VERIFIED ({date}) |

Scope: Only these files will be analyzed and refactored:
- {file1}
- {file2}
- ...

→ Ready for analysis.
```

---

### FASE 1: Analyze

**Goal:** Analyze pipeline code quality and determine if Context7 research adds value.

**Steps:**

1. **Read stack baseline:**
   - Read `.claude/research/stack-baseline.md` (if exists)
   - Note which technologies and patterns are already documented
   - If expired → treat as partial knowledge (still usable, may need supplementing)

2. **Scan pipeline files for patterns:**

   Scan **only pipeline files** for known patterns:

   **Security patterns:**
   - Injection: `exec(`, `eval(`, `new Function`, `os.system`
   - XSS: `.innerHTML =`, `dangerouslySetInnerHTML`, `document.write`
   - Deserialization: `pickle`
   - GitHub Actions: `${{ github.event.` in `run:` commands

   **DRY violations:**
   - Duplicate code blocks (>5 lines identical) within pipeline files
   - Similar logic patterns (>70% similarity) within pipeline files
   - Repeated conditionals, copy-paste across pipeline files
   - Extract opportunities (same code in 3+ locations within pipeline files)

   **Over-engineering:**
   - Unnecessary abstractions (helpers used only once)
   - Too many layers (>3 indirection levels for simple operations)
   - Premature optimization (complex caching for non-hot paths)
   - Over-defensive code (try/catch around code that can't fail)
   - Over-generic types used in only 1 place

   **Important:** If a pattern finding references a file outside `pipeline_files` → discard it.

   Log all findings with file:line references.

3. **Decide: is Context7 research needed?**

   Assess autonomously based on:

   | Signal                                                            | Research needed?                        |
   | ----------------------------------------------------------------- | --------------------------------------- |
   | Stack baseline covers all libraries used in pipeline files        | NO                                      |
   | Pattern scan found concrete, well-understood issues               | NO — these are directly actionable      |
   | Code uses libraries/patterns NOT in baseline                      | YES — research those specific libraries |
   | Complex security concerns (auth flows, crypto, injection vectors) | YES — research security best practices  |
   | No stack baseline exists at all                                   | YES — research the core stack patterns  |

   **If research NOT needed** → proceed directly to FASE 2 with pattern scan findings.

   **If research needed** → spawn only the relevant research agents:

   | Agent                     | When to spawn                                       |
   | ------------------------- | --------------------------------------------------- |
   | security-researcher       | Security patterns found OR auth/crypto/input flows  |
   | performance-researcher    | N+1 patterns, heavy loops, or caching opportunities |
   | quality-researcher        | Complex abstractions or unclear patterns            |
   | error-handling-researcher | Missing error handling in critical paths            |

   Agent context includes:
   - Feature name and tech stack (from CLAUDE.md)
   - **Only pipeline files** and their contents
   - Stack baseline (if available)
   - Specific questions to answer (not open-ended research)

4. **Report findings:**

**Output (without research):**

```
ANALYSIS COMPLETE

| Pattern Scan | Count |
|-------------|-------|
| Security patterns | [X] matches |
| DRY violations | [Y] matches |
| Over-engineering | [Z] matches |

Research: Skipped (stack baseline sufficient)

→ Ready for planning.
```

**Output (with research):**

```
ANALYSIS COMPLETE

| Pattern Scan | Count |
|-------------|-------|
| Security patterns | [X] matches |
| DRY violations | [Y] matches |
| Over-engineering | [Z] matches |

Research: [N] agents spawned ({list})
Reason: {why research was needed}

→ Ready for planning.
```

---

### FASE 2: Plan

**Goal:** Create a ranked improvement list and get user approval before modifying code.

**Steps:**

1. **Create ranked improvements list:**

   Based on FASE 1 findings, compile all improvements ranked by impact:
   - **Only pipeline files** may be included
   - Each improvement gets an impact level: 🔴 HIGH / 🟡 MED / 🟢 LOW
   - Sort: HIGH first (security vulnerabilities), then MED, then LOW

2. **Present improvements with before/after code:**

   ```
   REFACTOR PLAN

   🔴 HIGH: [X] improvements (security)
   🟡 MED: [Y] improvements (performance, DRY, error handling)
   🟢 LOW: [Z] improvements (code quality, simplification)
   ```

   For each improvement show:
   - `{file}:{line}` — file from pipeline_files
   - Issue → Fix
   - **Before** code snippet (current code)
   - **After** code snippet (proposed change)

   End with:

   ```
   Files to be modified: [count]
   - {file1} ([N] changes)
   - {file2} ([M] changes)

   Rollback available: YES (automatic on test failure)
   ```

3. **Notify and ask for scope:**

   ```bash
   powershell -ExecutionPolicy Bypass -File .claude/scripts/notify.ps1 -Title "Claude Code" -Message "Refactor plan ready"
   ```

   Use **AskUserQuestion** tool:
   - header: "Scope"
   - question: "Welke verbeteringen wil je toepassen? ([N] totaal)"
   - options:
     - label: "Alles toepassen (Recommended)", description: "Alle [N] verbeteringen"
     - label: "Alleen HIGH + MED", description: "[X+Y] verbeteringen, skip LOW"
     - label: "Alleen HIGH", description: "[X] verbeteringen, alleen security"
     - label: "Annuleren", description: "Stop refactor proces"
   - multiSelect: false

   **If "Annuleren"** → EXIT with "Refactor geannuleerd door gebruiker"

---

### FASE 3: Apply Improvements

**Priority order (execute in this sequence):**

1. Security improvements
2. Performance optimizations
3. DRY/Refactoring improvements
4. Simplification (remove over-engineering)
5. Code quality improvements
6. Error handling improvements

**Steps:**

1. **Initialize change tracking:**

   ```bash
   git rev-parse HEAD  # Store as saved_hash for rollback
   ```

2. **Apply each improvement using Edit tool:**
   - Follow priority order strictly
   - **Only modify files in pipeline_files list** — assert before each edit
   - Keep changes non-breaking
   - Track modified files and changes per category
   - Report progress: `✓ Applied {count} {category} improvements ({current}/6 categories)`

**Non-breaking rule:**

- No API signature changes
- No database schema modifications
- No breaking parameter changes
- No removal of public methods/functions
- Preserve all existing behavior
- If breaking change needed → exit and suggest new /dev:define cycle

**Output:**

```
IMPROVEMENTS APPLIED

| Category | Count |
|----------|-------|
| Security | [N] |
| Performance | [N] |
| DRY/Refactoring | [N] |
| Simplification | [N] |
| Quality | [N] |
| Error Handling | [N] |

Modified files: [list]

→ Running tests...
```

---

### FASE 4: Test Verification

1. **Run test suite** (detect command from CLAUDE.md `### Testing` section)

2. **All pass** → proceed to FASE 5

3. **Any fail → immediate rollback:**

   Primary:

   ```bash
   git checkout -- [modified files]
   ```

   Fallback (if checkout fails):

   ```bash
   git reset --hard {saved_hash}
   ```

   If both fail → report manual recovery steps and **STOP**.

   Report:
   - Which tests failed and why
   - Suggest smaller scope refactor (Conservative plan)
   - **STOP** — do not proceed to FASE 5

**Output (pass):**

```
TESTS PASSED

| Metric | Value |
|--------|-------|
| Tests | [X/X] passing |

→ Documenting results...
```

**Output (fail):**

```
TESTS FAILED — ROLLED BACK

| Field | Value |
|-------|-------|
| Failed tests | [list] |
| Rollback | ✓ Changes reverted |

Options:
1. Try Conservative plan (fewer, safer changes)
2. Accept current code quality
3. Investigate failures manually
```

---

### FASE 5: Completion

1. **Get timestamp:**

   ```
   Use mcp__time__get_current_time with timezone "Europe/Amsterdam"
   ```

2. **Create `04-refactor.md`:**

   ```markdown
   # Refactor Log: {feature-name}

   Generated: [timestamp]

   ## Summary

   | Metric         | Value                        |
   | -------------- | ---------------------------- |
   | Scope          | [ALL / HIGH+MED / HIGH only] |
   | Improvements   | [count]                      |
   | Files modified | [count]                      |
   | Tests          | [X/X] passing                |

   ## What Was Improved

   - [High-level description of improvements]

   ## Key Decisions

   - [Decision 1]: [rationale]
   - [Decision 2]: [rationale]

   ## Improvements

   ### Security

   - [file:line] - [issue] → [fix] → [result] (Risk: [L/M])

   ### Performance

   - [file:line] - [issue] → [fix] → [result] (Risk: [L/M])

   ### DRY/Refactoring

   - [file:line] ↔ [file:line] - [extraction] → [result] (Risk: [L/M])

   ### Simplification

   - [file:line] - [removed] → [simplified] (Risk: [L/M])

   ### Quality

   - [file:line] - [issue] → [fix] → [result] (Risk: [L/M])

   ### Error Handling

   - [file:line] - [issue] → [fix] → [result] (Risk: [L/M])

   ## Positive Observations

   - [What was already done well in the codebase]

   ## Modified Files

   - [file] - [description of changes]
   ```

3. **Update `01-define.md`:** Set `Status: REFACTORED` with date.

4. **Sync backlog:**
   - Read `.workspace/backlog.md`
   - Move feature from `### BLT` to `### DONE`
   - In DONE: dependency arrow `->` changes to description `-`
   - Update section header counts: `({done}/{total} done)`
   - Update "Updated" timestamp
   - Update "Next" suggestion

5. **Auto-commit:**

   ```bash
   git add .
   git commit -m "$(cat <<'EOF'
   refactor({feature}): {summary}

   {description of improvements by category and counts}
   EOF
   )"
   ```

   **IMPORTANT:** Do NOT add Co-Authored-By or Generated with Claude Code footer to pipeline commits.

6. **Notify:**

   ```bash
   powershell -ExecutionPolicy Bypass -File .claude/scripts/notify.ps1 -Title "Claude Code" -Message "{feature} refactored"
   ```

7. **Show completion:**

   ```
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   PIPELINE COMPLETE

   Feature {feature-name} has completed all phases:
   ✓ /dev:define - Definition
   ✓ /dev:build - Implementation
   ✓ /dev:test - Verification
   ✓ /dev:refactor - Refactoring

   Ready for production!
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   ```

---

## Notifications

| Moment                    | Message                |
| ------------------------- | ---------------------- |
| After FASE 2 (plan ready) | "Refactor plan ready"  |
| After FASE 5 (complete)   | "{feature} refactored" |

## Error Handling

### Context Loading Failures

**No features found** → exit: "Run /dev:define and /dev:build first"
**No test results** → exit: "Run /dev:test {feature} first"
**Build log empty** → exit: "No code files found in 02-build-log.md"

### Analysis Failures

**Context7 unavailable** → skip research, proceed with stack baseline and direct analysis only
**Stack baseline missing** → proceed with direct analysis and Context7 research

### Test Failures

**Tests fail after refactoring** → immediate rollback, report failures, suggest Conservative plan
**Test framework not detected** → ask user which command to run
**Tests hang** → kill process, rollback

### Rollback Failures

**git checkout fails** → try `git reset --hard {saved_hash}`
**Both fail** → report manual recovery steps with git hash and file list, STOP

## Restrictions

This skill must NEVER:

- Analyze, plan, or modify files outside pipeline_files (extracted from 02-build-log.md)
- Include external file findings in any plan
- Proceed without existing 03-test-results.md
- Make breaking changes (API, schema, parameter changes)
- Skip user approval at FASE 2
- Skip test verification in FASE 4
- Proceed if tests fail (must rollback)
- Apply improvements without user scope selection
- Add Co-Authored-By or Generated with Claude Code footer to commits

This skill must ALWAYS:

- Enforce the pipeline_files scope boundary at every phase
- Load all feature documentation before analysis
- Autonomously decide whether Context7 research adds value before spawning agents
- Use stack baseline as primary knowledge source when valid
- Present ranked improvements with before/after code snippets
- Wait for user scope selection before applying changes
- Run full test suite after applying changes
- Rollback immediately on any test failure
- Create 04-refactor.md with structured results
- Send notifications at key points (plan ready, complete)
