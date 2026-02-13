---
name: dev-refactor
description: Refactor code quality after testing with autonomous analysis and parallel planning agents. Use with /dev-refactor to improve code structure, naming, and patterns in feature files.
disable-model-invocation: true
metadata:
  author: mileszeilstra
  version: 1.0.0
  category: dev
---

# Refactor

## Overview

This is **FASE 4** of the dev workflow: define -> build -> test -> **refactor**

Analyzes code quality via Explore agent (zero source reads in main context), uses Context7 research only when needed, creates improvement plans with ranked strategies, and applies non-breaking changes with smart test failure analysis before rollback.

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

1. **Read backlog for pipeline status:**

   Read `.workspace/backlog.md` (if exists) to understand current state:
   - Which features are in which phase (TODO, DEF, BLT, TST, DONE)
   - Collect ALL features in `### TST` section — these are tested but not yet refactored

2. **Determine feature queue:**

   **a) Feature name provided** (`/dev:refactor auth`):
   - Validate feature exists in `.workspace/features/`
   - Feature queue = `[auth]`

   **b) No feature name** (`/dev:refactor`):
   - If TST features found in backlog: present them via **AskUserQuestion**:
     - header: "Refactor"
     - question: "Welke features wil je refactoren? ({N} features in TST status)"
     - options:
       - label: "Alle {N} features (Recommended)", description: "{feature1}, {feature2}, ..."
       - label: "Eén feature kiezen", description: "Selecteer een specifieke feature"
     - multiSelect: false
   - If "Alle features" → feature queue = all TST features
   - If "Eén feature kiezen" → show feature list via AskUserQuestion, queue = selected
   - If no TST features in backlog → fall back to listing `.workspace/features/` directories that have `03-test-results.md`

   **c) "recent"**: find most recently modified `03-test-results.md`, queue = `[that feature]`

3. **Loop: Process each feature in queue**

   For each feature in the queue, execute steps 4-8 (the rest of FASE 0) and then FASE 1-5.
   Track overall progress: `Feature {current}/{total}: {name}`

4. **Validate test results exist:**

   ```
   .workspace/features/{feature-name}/03-test-results.md
   ```

   If not found → exit with message to run `/dev:test {feature-name}` first.

5. **Load all feature documentation:**
   - Read `01-define.md` for requirements (REQ-XXX) and architecture
   - Read `02-build-log.md` for implementation details and created files
   - Read `03-test-checklist.md` for test items
   - Read `03-test-results.md` for verification results

6. **Build pipeline files list (scope boundary):**
   - Extract all code file paths from `02-build-log.md`
   - Store as `pipeline_files` — these are the ONLY files this skill may touch
   - Log the list explicitly for transparency

7. **Analyze pipeline code** (via Explore agent — zero source file reads in main context)

   **Always** use a Task agent (Explore) to read and analyze pipeline files. Never read source files directly in the main conversation.

   Launch Explore agent with prompt:

   ```
   Feature: {feature-name}
   Pipeline files:
   {list of all pipeline_files paths}

   Lees ALLE bovenstaande pipeline files. Scan voor:

   1. SECURITY patterns:
      - Injection: exec(, eval(, new Function, os.system
      - XSS: .innerHTML =, dangerouslySetInnerHTML, document.write
      - Deserialization: pickle
      - GitHub Actions: ${{ github.event. in run: commands

   2. DRY violations (ALLEEN binnen pipeline files):
      - Duplicate code blocks (>5 lines identiek)
      - Vergelijkbare logica patronen (>70% gelijkheid)
      - Herhaalde conditionals, copy-paste
      - Extract opportunities (zelfde code in 3+ locaties)

   3. OVER-ENGINEERING:
      - Helpers die maar 1x gebruikt worden
      - >3 indirectie-niveaus voor simpele operaties
      - Premature optimization (complexe caching voor non-hot paths)
      - Over-defensive code (try/catch rond code die niet kan falen)
      - Over-generic types die maar op 1 plek gebruikt worden

   4. ARCHITECTUUR overzicht:
      - Welke libraries/frameworks worden gebruikt
      - Belangrijkste patterns (hooks, API routes, components, etc.)
      - Stack info relevant voor Context7 research beslissing

   Geef terug als gestructureerd overzicht:
   ANALYSIS_START

   ARCHITECTURE:
   Libraries: {lijst van libraries/frameworks}
   Patterns: {lijst van architectuurpatronen}
   Stack baseline needed: {ja/nee + welke libraries niet in baseline}

   SECURITY_FINDINGS:
   - {file:line} {pattern} — {beschrijving} — Before: {code snippet}
   (of "Geen security issues gevonden")

   DRY_FINDINGS:
   - {file:line} ↔ {file:line} {type} — {beschrijving} — Code: {snippet}
   (of "Geen DRY violations gevonden")

   OVERENGINEERING_FINDINGS:
   - {file:line} {type} — {beschrijving} — Code: {snippet}
   (of "Geen over-engineering gevonden")

   POSITIVE_OBSERVATIONS:
   - {wat al goed is in de codebase}

   ANALYSIS_END
   ```

   **Parsing the agent result:**

   The Explore agent's TaskOutput will likely be **truncated** because its full conversation log (all file reads) is very large. This is expected. To extract the structured analysis:
   1. If TaskOutput contains `ANALYSIS_START` → parse directly from the output
   2. If TaskOutput is truncated (no `ANALYSIS_START` visible):
      - The output includes a file path (e.g. `C:\...\tasks\{id}.output`)
      - Use **Grep** to find the line containing `ANALYSIS_START` in that file
      - Use **Read** with the line offset to read from `ANALYSIS_START` to `ANALYSIS_END`
   3. Extract ONLY the structured block between the markers — ignore the rest of the agent log

**Output:**

```
CONTEXT LOADED: {feature-name}

| Metric | Value |
|--------|-------|
| Requirements | {N} (from 01-define.md) |
| Pipeline files | {N} files |
| Test status | VERIFIED ({date}) |
| Analysis | Via Explore agent |

Scope: Only these files will be analyzed and refactored:
- {file1}
- {file2}
- ...

→ Ready for research decision.
```

---

### FASE 1: Research Decision

**Goal:** Determine if Context7 research adds value based on the Explore agent's analysis from FASE 0.

Pattern scanning is already done by the Explore agent. FASE 1 only handles the research decision.

**Steps:**

1. **Read stack baseline:**
   - Read `.claude/research/stack-baseline.md` (if exists)
   - Note which technologies and patterns are already documented
   - If expired → treat as partial knowledge (still usable, may need supplementing)

2. **Decide: is Context7 research needed?**

   Use the Explore agent's ARCHITECTURE section to assess:

   | Signal                                                            | Research needed?                        |
   | ----------------------------------------------------------------- | --------------------------------------- |
   | Stack baseline covers all libraries used in pipeline files        | NO                                      |
   | Explore agent findings are concrete, well-understood issues       | NO — these are directly actionable      |
   | Code uses libraries/patterns NOT in baseline                      | YES — research those specific libraries |
   | Complex security concerns (auth flows, crypto, injection vectors) | YES — research security best practices  |
   | No stack baseline exists at all                                   | YES — research the core stack patterns  |

   **If research NOT needed** → proceed directly to FASE 2 with Explore agent findings.

   **If research needed** → spawn only the relevant research agents:

   | Agent                     | When to spawn                                       |
   | ------------------------- | --------------------------------------------------- |
   | security-researcher       | Security patterns found OR auth/crypto/input flows  |
   | performance-researcher    | N+1 patterns, heavy loops, or caching opportunities |
   | quality-researcher        | Complex abstractions or unclear patterns            |
   | error-handling-researcher | Missing error handling in critical paths            |

   Agent context includes:
   - Feature name and tech stack (from CLAUDE.md)
   - **Structured analysis from Explore agent** (NOT full file contents — pass the ANALYSIS_START..ANALYSIS_END block)
   - Stack baseline (if available)
   - Specific questions to answer (not open-ended research)

3. **Report findings:**

**Output (without research):**

```
ANALYSIS COMPLETE

| Explore Agent Findings | Count |
|------------------------|-------|
| Security patterns | [X] matches |
| DRY violations | [Y] matches |
| Over-engineering | [Z] matches |

Research: Skipped (stack baseline sufficient)

→ Ready for planning.
```

**Output (with research):**

```
ANALYSIS COMPLETE

| Explore Agent Findings | Count |
|------------------------|-------|
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

   Based on Explore agent analysis (FASE 0) and optional research findings (FASE 1), compile all improvements ranked by impact:
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

3. **Ask for scope:**

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
   - **Re-read each file immediately before editing** (prevents "File has not been read yet" errors)
   - Group edits by file: read file → apply ALL edits for that file → move to next file
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

3. **Any fail → analyze before rollback:**

   Before rolling back, analyze each failing test to determine the correct action:

   | Test failure type                                                              | Action                   |
   | ------------------------------------------------------------------------------ | ------------------------ |
   | Test expects old (insecure/incorrect) behavior that was intentionally improved | Update the test, re-run  |
   | Test catches genuine regression (refactoring broke unrelated functionality)    | Rollback all changes     |
   | Test is flaky or environment-dependent                                         | Re-run once, then decide |

   **If test update needed (improvement is correct, test is stale):**
   - Update ONLY the specific assertion(s) that test the improved behavior
   - Do NOT change the test's overall structure or coverage
   - Re-run the FULL test suite after updating
   - If still failing after update → rollback all changes
   - Max 1 test update attempt per failing test — bij twijfel rollback

   **If genuine regression or unclear:**

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
   - Whether any tests were updated (and why the old assertion was incorrect)
   - Suggest smaller scope refactor (Conservative plan)
   - **STOP** — do not proceed to FASE 5

**Output (pass):**

```
TESTS PASSED

| Metric | Value |
|--------|-------|
| Tests | [X/X] passing |
| Tests updated | [N] (stale assertions corrected) |

→ Documenting results...
```

**Output (fail — rolled back):**

```
TESTS FAILED — ROLLED BACK

| Field | Value |
|-------|-------|
| Failed tests | [list] |
| Failure type | [regression / stale test / unclear] |
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
   - Move feature from `### TST` to `### DONE`
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

6. **Show completion** (parse `{next-feature}` from the `**Next:**` line in `.workspace/backlog.md`):

   **Per feature:**

   ```
   ✓ {feature-name} refactored ({N} improvements)
   ```

   **Na laatste feature (of bij single feature):**

   ```
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   PIPELINE COMPLETE

   {N} feature(s) refactored:
   {for each feature:}
   ✓ {feature-name} - {improvement-count} improvements

   All phases completed:
   ✓ /dev:define - Definition
   ✓ /dev:build - Implementation
   ✓ /dev:test - Verification
   ✓ /dev:refactor - Refactoring

   Ready for production!

   Next feature from backlog:
   → /dev:define {next-feature}
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   ```

---

## Error Handling

### Context Loading Failures

**No features found** → exit: "Run /dev:define and /dev:build first"
**No test results** → exit: "Run /dev:test {feature} first"
**Build log empty** → exit: "No code files found in 02-build-log.md"

### Analysis Failures

**Context7 unavailable** → skip research, proceed with stack baseline and direct analysis only
**Stack baseline missing** → proceed with direct analysis and Context7 research

### Test Failures

**Tests fail after refactoring** → analyze failure type first (stale test vs regression), then rollback or update test
**Test framework not detected** → ask user which command to run
**Tests hang** → kill process, rollback

### Rollback Failures

**git checkout fails** → try `git reset --hard {saved_hash}`
**Both fail** → report manual recovery steps with git hash and file list, STOP

## Restrictions

This skill must NEVER:

- Read pipeline source files directly in the main conversation (always use Explore agent)
- Pass full file contents to research agents (pass structured analysis from Explore agent)
- Analyze, plan, or modify files outside pipeline_files (extracted from 02-build-log.md)
- Include external file findings in any plan
- Proceed without existing 03-test-results.md
- Make breaking changes (API, schema, parameter changes)
- Skip user approval at FASE 2
- Skip test verification in FASE 4
- Proceed if tests fail without analyzing failure type first (stale test vs regression)
- Apply improvements without user scope selection
- Add Co-Authored-By or Generated with Claude Code footer to commits

This skill must ALWAYS:

- Enforce the pipeline_files scope boundary at every phase
- Use Explore agent to read and analyze pipeline files (zero source reads in main context)
- Re-read each file immediately before editing (prevents "File has not been read yet" errors)
- Group edits by file: read file → apply ALL edits for that file → next file
- Load feature documentation (01-define, 02-build-log, 03-test-\*) before analysis
- Autonomously decide whether Context7 research adds value before spawning agents
- Use stack baseline as primary knowledge source when valid
- Present ranked improvements with before/after code snippets
- Wait for user scope selection before applying changes
- Run full test suite after applying changes
- Analyze test failures before rollback (distinguish stale tests from regressions)
- Create 04-refactor.md with structured results
