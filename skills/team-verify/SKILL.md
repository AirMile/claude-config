---
name: team-verify
description: Verify teammate code delivery. Checks completeness against task brief (feature.json) or backlog TODO, generates tests inline, maps results to requirements. Use with /team-verify after teammate code delivery.
metadata:
  author: claude-config
  version: 2.0.0
  category: team
---

# Verify — Teammate Verification

## Overview

Verify teammate code delivery. Detects available context (feature.json with requirements, backlog TODO with description, or just a branch diff), checks completeness where possible, generates and runs tests, and produces structured feedback.

**Trigger**: `/team-verify` or `/team-verify {feature-name}` or `/team-verify {feature-name} {feedback}`

## When to Use

- After teammate delivers code on a feature (with or without `/dev-define`)
- When teammate pushes code for a backlog TODO item
- When teammate branch code needs verification before merge

**NOT for:**

- Testing own code (use `/dev-verify`)
- Unit-level test writing during build (use `/dev-build`)

## Input Formats

```
# Auto-detect context (recommended)
/team-verify

# Specific feature
/team-verify user-registration

# Inline feedback (skips automation)
/team-verify user-registration
1:PASS
2:FAIL no validation error
3:PASS
```

## Workflow

**Phase tracking** — first action of the skill: call `TaskCreate` with these 12 items (status `pending`), then use `TaskUpdate` to set each phase `in_progress` at the start and `completed` at the end. During context compaction the task list remains visible — no risk of skipping phases.

1. PHASE 0: Context Detection
2. PHASE 0.5: Completeness Check
3. PHASE 1: Research + Scenario Generation
4. PHASE 2: Test Plan + Classification
5. PHASE 3: Automated Test Execution
6. PHASE 4: Manual Test Execution
7. PHASE 4b: Combined Results
8. PHASE 4c: Coverage Adequacy Analysis
9. PHASE 5: Results Report + Action Choice
10. PHASE 5c: Fix Loop
11. PHASE 5d: Regression Check
12. PHASE 6: Update + Feedback

### PHASE 0: Context Detection

> **Todo**: call `TaskCreate` with the 12 phase items (see above). Mark PHASE 0 → `in_progress` via `TaskUpdate`.

1. **Get branch and project info:**

   ```bash
   git branch --show-current
   ```

2. **Capture git baseline** (for scoped commit in PHASE 6):

   ```bash
   mkdir -p .project/session
   git status --porcelain | sort > .project/session/pre-skill-status.txt
   ```

3. **Find context (in order of richness):**

   a. **feature.json** — if feature name given → `.project/features/{name}/feature.json`. Otherwise → scan `.project/features/*/feature.json` for features with status DOING + stage built, or with `externalRef.assignees` set.

   b. **Backlog TODO** — if no feature.json found, check `.project/backlog.html` for a TODO/DOING item matching the feature name or branch name. Extract the item's description/title.

   c. **Nothing** — no feature.json, no backlog match.

4. **Determine mode:**

   | Condition                                          | Mode           | Description                                      |
   | -------------------------------------------------- | -------------- | ------------------------------------------------ |
   | feature.json exists with `requirements[]`          | `BRIEF_REVIEW` | Full brief available — completeness check + test |
   | No feature.json, but backlog TODO with description | `TODO_REVIEW`  | Backlog description as test basis                |
   | No feature.json, no backlog match                  | `BRANCH_ONLY`  | Git diff only — test what's visible              |

5. **Parse user input:**
   - Feature name only → proceed to PHASE 0.5
   - Feature name + inline feedback → parse into structured results (item number, PASS/FAIL, notes); map to requirements where possible; show summary; skip directly to PHASE 5
   - Feature name + free text → same as inline feedback above

6. **Output:**

   ```
   CONTEXT DETECTION

   Mode:      {BRIEF_REVIEW | TODO_REVIEW | BRANCH_ONLY}
   Feature:   {name or branch name}
   Assignee:  {name or "none"}
   Branch:    {branch}
   Context:   {feature.json | backlog TODO | git diff only}
   Status:    {backlog status: DOING/DONE/etc or "unknown"}
   ```

   Use AskUserQuestion to confirm:
   - header: "Test Mode"
   - question: "Continue with {mode} for {feature}?"
   - options:
     - label: "Yes, continue (Recommended)", description: "{mode description}"
     - label: "Different feature", description: "I want to test a different feature"
     - label: "Cancel", description: "Stop"
   - multiSelect: false

7. **Signal active feature** (after feature name is determined):

   ```bash
   echo '{"feature":"{feature-name}","skill":"team-verify","startedAt":"{ISO timestamp}"}' > .project/session/active-{feature-name}.json
   ```

8. **Load stack & project context** (for agent prompts):

   **Stack detection:**
   - Read CLAUDE.md `### Stack` section
   - Read `.claude/research/stack-baseline.md` (if available)
   - Fallback: detect from package.json / go.mod / etc.

   **Project context:** Read `.project/project.json` (if it exists). Extract only:
   - `stack` (framework, language, testing, packages)
   - `endpoints` (method, path, auth)
   - `data.entities` (names, fields, relations)

   Read `.project/project-context.json` (if it exists). Extract:
   - `context` (structure, routing, patterns)

   If project.json/project-context.json or stack-baseline does not exist → continue without (backwards compatible).

   **Assemble STACK_CONTEXT** (passed to all agents in this skill):

   ```
   STACK CONTEXT:
   Framework: {stack.framework} ({stack.language})
   Testing: {stack testing info or stack-baseline testing conventions}
   Packages: {relevant packages}

   PROJECT CONTEXT:
   Structure: {context.structure or "not available"}
   Routing: {context.routing or "not available"}
   Patterns: {context.patterns or "not available"}
   Endpoints: {endpoints or "not available"}
   Entities: {data.entities or "not available"}
   ```

---

### PHASE 0.5: Completeness Check

> **Todo**: mark PHASE 0 → `completed`, PHASE 0.5 → `in_progress`.

**Skip if:** `BRANCH_ONLY` mode (no context available).

Compare the code diff against the available context to verify completeness.

1. **Load context:**

   **`BRIEF_REVIEW`:** Load `.project/features/{feature-name}/feature.json`. Extract: `requirements[]`, `files[]`, `buildSequence[]`, `testStrategy[]`.

   **`TODO_REVIEW`:** Extract backlog item description/title. Parse into informal requirements (each distinct expectation from the description becomes a check item). No files[] or buildSequence[] available.

2. **Get relevant diff:**

   Filter commits by assignee name if known (read `externalRef.assignees[0]` from feature.json):

   ```bash
   git log --author="{externalRef.assignees[0]}" --oneline --since="2 weeks ago" -- .
   git diff $(git merge-base HEAD main)..HEAD
   ```

   Fallback if on main or no assignee in externalRef: diff last N commits relevant to the feature.

3. **Spawn Explore agent** for completeness analysis:

   **For `BRIEF_REVIEW`:**

   ```
   Analyze the code diff against feature requirements.

   {STACK_CONTEXT}

   Requirements:
   {JSON of requirements[] from feature.json}

   Expected files:
   {JSON of files[] from feature.json}

   Build sequence:
   {JSON of buildSequence[] from feature.json}

   Git diff:
   {full diff output}

   For each requirement:
   - Is it implemented? (search for relevant code in the diff)
   - Are expected files created/modified?
   - Does it meet the acceptance criteria?

   Return structured output:
   COMPLETENESS_START
   | REQ | Description | Status | Evidence | Missing |
   |-----|------------|--------|----------|---------|
   | {id} | {description} | FOUND/MISSING/PARTIAL | {file:line or —} | {what's missing} |
   COMPLETENESS_END

   MISSING_FILES: {files from expected list not found in diff, comma-separated, or "none"}
   EXTRA_FILES: {files in diff not in expected list, comma-separated, or "none"}
   COVERAGE: {N}/{total} requirements found
   ```

   **For `TODO_REVIEW`:**

   ```
   Analyze the code diff against the backlog task description.

   {STACK_CONTEXT}

   Task: {backlog item title}
   Description: {backlog item description}

   Git diff:
   {full diff output}

   Parse the description into distinct expectations. For each:
   - Is it addressed in the code? (search for relevant implementation)
   - Is the implementation complete or partial?

   Return structured output:
   COMPLETENESS_START
   | # | Expectation | Status | Evidence | Missing |
   |---|------------|--------|----------|---------|
   | 1 | {parsed expectation} | FOUND/MISSING/PARTIAL | {file:line or —} | {what's missing} |
   COMPLETENESS_END

   COVERAGE: {N}/{total} expectations found
   ```

4. **Parse and display results:**

   ```
   COMPLETENESS CHECK: {feature-name}

   | #       | Description              | Status    | Evidence              |
   |---------|--------------------------|-----------|---------------------|
   | REQ-001 | User can log in          | ✓ FOUND   | src/auth/login.ts   |
   | REQ-002 | Email validation         | ~ PARTIAL | src/auth/login.ts   |
   | REQ-003 | Rate limiting            | ✗ MISSING | —                   |

   Coverage: {N}/{total} ({percentage}%)
   {BRIEF_REVIEW only:} Missing files: {list or "none"}
   {BRIEF_REVIEW only:} Extra files: {list or "none"}
   ```

5. **If coverage < 100%:**

   Use AskUserQuestion:
   - header: "Incomplete"
   - question: "{N} items not (fully) found. What do you want to do?"
   - options:
     - label: "Continue anyway (Recommended)", description: "Test what IS there, report missing items"
     - label: "Send feedback", description: "Generate feedback for teammate, stop testing"
     - label: "Cancel", description: "Stop"
   - multiSelect: false

   If "Send feedback" → skip to PHASE 6 (generate feedback with completeness results).

---

### PHASE 1: Research + Scenario Generation (Explore agent)

> **Todo**: mark PHASE 0.5 → `completed`, PHASE 1 → `in_progress`.

**Goal:** Research test strategies and generate scenarios. Runs in a single Explore agent to keep Context7 results and scenario details out of the main context.

Spawn one Explore agent (`subagent_type="Explore"`, thoroughness: "very thorough") with the following prompt:

```
{STACK_CONTEXT}

Feature: {feature-name}
Diff: {diff summary — changed files + key changes, NOT full diff}

{BRIEF_REVIEW: "Requirements: {JSON of requirements[]}" + "testStrategy: {JSON of testStrategy[]}"}
{TODO_REVIEW: "Expectations: {parsed expectations from PHASE 0.5}"}

OPERATIONAL STANCE: Failure-seeking. Default: scenarios have been missed.
Expect at least 3 edge cases and 2 integration risks. Fewer requires justification.
Self-check: "Which edge cases has the developer probably not considered?"

TASKS:
1. Check existing test infrastructure: grep for test files, configs, frameworks
2. Research via Context7: resolve-library-id + query-docs for the testing framework
   Focus: test structure conventions, assertion patterns, mocking, integration setup
3. Generate test scenarios in 3 sections:
   - HAPPY PATH: core functionality works as expected
   - EDGE CASES: boundary conditions, validation, error states (MINIMUM 3)
   - INTEGRATION: cross-component interaction, API flows, data persistence (MINIMUM 2)
   {BRIEF_REVIEW: "Map each scenario to a requirement ID (REQ-001, etc). Skip MISSING requirements."}
   {TODO_REVIEW: "Map each scenario to an expectation number (#1, #2, etc)."}

RETURN FORMAT:
RESEARCH_SUMMARY: {2-3 lines: testing framework, key conventions, existing test patterns}

SCENARIOS_START
HAPPY PATH:
{numbered scenarios}

EDGE CASES:
{numbered scenarios}

INTEGRATION:
{numbered scenarios}
SCENARIOS_END

Total: N test scenarios
```

Parse the agent output — only the structured `SCENARIOS_START...END` block and research summary enter the main context.

---

### PHASE 2: Test Plan + Classification

> **Todo**: mark PHASE 1 → `completed`, PHASE 2 → `in_progress`.

**Goal:** Classify scenarios into AUTO/MANUAL, generate test data, set up dev server.

> **Classification criteria:** See `../dev-verify/references/test-classification.md` for AUTO/BROWSER, AUTO/CLI, and MANUAL criteria with pattern tables.

1. **Generate test data** (via Explore agent — zero source file reads in main context):

   ```
   Feature: {feature-name}
   Scenarios from PHASE 1: {list of scenarios with requirement mapping}

   {STACK_CONTEXT}

   Read the source code and look for:
   - Form fields, validation rules, API endpoints relevant to the test items
   - Existing test files that can be reused
   - Test patterns matching the stack (e.g. Vitest for React, PHPUnit for Laravel)

   Return as structured overview:
   FEATURE_CONTEXT_START
   Existing tests: {path to test files, or "none"}
   Per scenario:
   - Item {N}: {title}
     Test data: {concrete values}
     Expected: {expected outcome}
     Recommended method: BROWSER | CLI | MANUAL
     Reason: {why this method}
   FEATURE_CONTEXT_END
   ```

2. **Classify each scenario** using `test-classification.md` criteria:

   ```
   TEST CLASSIFICATION: {feature-name}

   | # | Test                     | Type         | Requirement | Reason                                  |
   |---|--------------------------|--------------|-------------|-----------------------------------------|
   | 1 | Register with valid data | AUTO/BROWSER | REQ-001     | DOM: redirect + welcome message visible |
   | 2 | Without email            | AUTO/BROWSER | REQ-002     | DOM: error message visible              |
   | 3 | Welcome mail sent        | MANUAL       | REQ-004     | Email verification not via DOM          |

   AUTO: {n} (BROWSER: {n}, CLI: {n})  MANUAL: {n}
   ```

3. **User override:**

   Use AskUserQuestion:
   - header: "Test Plan"
   - question: "Continue with test execution?"
   - options:
     - label: "Yes, run tests (Recommended)", description: "Start automated tests, then manual"
     - label: "Automated only", description: "Skip manual tests"
     - label: "All manual", description: "Skip automated tests"
     - label: "Cancel", description: "Stop"
   - multiSelect: false

4. **Dev server + Cloudflare Tunnel:**

   Always start dev server + tunnel — needed for both AUTO and MANUAL items.

   a) Check for existing tunnel:

   ```bash
   grep -oE 'https://[a-z0-9-]+\.trycloudflare\.com' /tmp/cloudflared.log 2>/dev/null | head -1
   ```

   If found, verify it's live: `curl -s -o /dev/null -w "%{http_code}" {tunnel_url}`. If HTTP 200 and serves correct project → use it.

   b) No tunnel running — start dev server + tunnel (same process as `/project-tunnel`):

   ```bash
   # Detect framework from package.json and start
   # Wait for server ready
   for i in $(seq 1 15); do curl -s http://localhost:3000 > /dev/null 2>&1 && break || sleep 1; done

   # Start Cloudflare Tunnel
   cloudflared tunnel --url http://localhost:3000 > /tmp/cloudflared.log 2>&1 &
   sleep 8
   grep -oE 'https://[a-z0-9-]+\.trycloudflare\.com' /tmp/cloudflared.log | head -1
   ```

   c) If server or tunnel fails:

   ```
   ⚠ Dev server + tunnel not started. All items will be MANUAL.
   ```

   Graceful fallback: reclassify ALL items as MANUAL, skip PHASE 3.

---

### PHASE 3: Automated Test Execution (Task Agent)

> **Todo**: mark PHASE 2 → `completed`, PHASE 3 → `in_progress`.

**When:** There are AUTO items after classification and dev server is confirmed running.

**Launch a Task agent** to execute all AUTO items in a separate context window. This prevents snapshot/screenshot data from consuming the main conversation context.

**Task agent prompt template:**

```
Test the following items automatically via browser tools and bash commands.
Dev server: {url}
Feature: {feature-name}

{STACK_CONTEXT}

ITEMS:
{for each AUTO item:}
- Item {N}: {title} [Requirement: {REQ-ID}]
  Steps: {test steps}
  Test data: {test data from PHASE 2}
  Expected: {expected outcome}
  Method: {BROWSER or CLI}
  Pattern: {matching test pattern from test-classification.md}

INSTRUCTIONS:
1. Navigate to the dev server URL and verify it is running
2. For each item:
   a. Execute the steps using MCP browser tools or bash commands
   b. Analyze the result and determine PASS or FAIL with evidence
3. If a browser tool fails for an item, mark as TOOL_ERROR

RESULT FORMAT (strict):
AUTOMATED_RESULTS_START
| # | Test | Requirement | Result | Evidence | Reasoning |
|---|------|-------------|-----------|--------|------------|
| {N} | {title} | {REQ-ID} | PASS/FAIL/TOOL_ERROR | {what was seen} | {why pass/fail} |
AUTOMATED_RESULTS_END

FALLBACK_ITEMS: {items with TOOL_ERROR, comma-separated numbers, or "none"}
```

**Parse agent results:**

1. If TaskOutput contains `AUTOMATED_RESULTS_START` → parse directly
2. If truncated → use Grep to find markers in agent output file, Read with offset
3. TOOL_ERROR items → reclassify as MANUAL for PHASE 4

Display:

```
AUTO TEST RESULTS: {feature-name}

| # | Test              | Requirement | Result | Evidence (short)             |
|---|-------------------|-------------|-----------|----------------------------|
| 1 | Valid registration| REQ-001     | ✓ PASS    | /dashboard + welcome message |
| 2 | Without email     | REQ-002     | ✗ FAIL    | No error message visible     |

AUTO PASS: {n}  AUTO FAIL: {n}  TOOL_ERROR → MANUAL: {n}
```

**If agent fails entirely:** Graceful fallback → reclassify all AUTO as MANUAL, proceed to PHASE 4.

---

### PHASE 4: Manual Test Execution (interactive)

> **Todo**: mark PHASE 3 → `completed`, PHASE 4 → `in_progress`.

**When:** There are MANUAL items (originally classified or reclassified from TOOL_ERROR fallback).

Show setup instructions once, then loop through each MANUAL item:

```
TEST SETUP: {feature-name}
Open {tunnel_url}
```

**For each MANUAL item:**

```
──────────────────────────────────────
MANUAL TEST {n}/{total_manual}: {item title}
──────────────────────────────────────

STEPS:
1. {concrete action, e.g. "Go to /register"}
2. {concrete action with data, e.g. "Enter: Email → test@example.com"}
3. {concrete action, e.g. "Click 'Register'"}

TEST DATA:
┌─────────────┬──────────────────────┐
│ Field       │ Value                │
├─────────────┼──────────────────────┤
│ Name        │ Test User            │
│ Email       │ test@example.com     │
└─────────────┴──────────────────────┘

EXPECTED:
→ {exact expected outcome}

REQUIREMENT: {REQ-ID}: {description}
```

Use AskUserQuestion per item:

- header: "Test {n}/{total_manual}"
- question: "Result for '{item title}'?"
- options:
  - label: "Pass (Recommended)", description: "Works as expected"
  - label: "Fail", description: "Does not work — I will provide details"
  - label: "Skip", description: "Cannot test, skip"
- multiSelect: false

**If Pass** → record PASS, next item.
**If Fail** → ask for brief details (what happened instead?), record FAIL + notes, next item.
**If Skip** → record SKIP, next item.

---

### PHASE 4b: Combined Results

> **Todo**: mark PHASE 4 → `completed`, PHASE 4b → `in_progress`.

Merge automated (PHASE 3) and manual (PHASE 4) results:

```
COMBINED RESULTS: {feature-name}

| # | Test                  | Type   | Requirement | Result              |
|---|-----------------------|--------|-------------|------------------------|
| 1 | Valid registration    | AUTO   | REQ-001     | ✓ PASS                |
| 2 | Without email         | AUTO   | REQ-002     | ✗ FAIL: no error      |
| 3 | Welcome mail          | MANUAL | REQ-004     | ✗ FAIL: no mail       |

AUTO PASS: {n}  AUTO FAIL: {n}
MANUAL PASS: {n}  MANUAL FAIL: {n}  SKIP: {n}
TOTAL PASS: {n}  TOTAL FAIL: {n}
```

---

### PHASE 4c: Coverage Adequacy Analysis

> **Todo**: mark PHASE 4b → `completed`, PHASE 4c → `in_progress`.

**Trigger:** Always after PHASE 4b (regardless of whether everything is PASS or there are FAILs).

**Goal:** Analyze whether the generated test scenarios cover the code _sufficiently_, or whether there are blind spots.

**Spawn Explore agent** (`subagent_type="Explore"`, thoroughness: "very thorough"):

```
Analyze whether the test scenarios fully cover the code.

{STACK_CONTEXT}

Feature: {feature-name}
Code diff: {diff summary}

Executed test scenarios:
{list of all scenarios with results from PHASE 4b}

ANALYZE:
1. Which code paths in the diff are NOT covered by the current scenarios?
2. Which error handling / edge cases have not been tested?
3. Are there security-relevant paths (auth, input validation, permissions) without a test?
4. Are there integration points with other components that have not been tested?

RETURN FORMAT:
ADEQUACY_START
Coverage: SUFFICIENT | INSUFFICIENT
Gaps: {list of missing scenarios, or "none"}
Suggested: {0-3 extra scenario proposals if gaps found}
ADEQUACY_END
```

**If SUFFICIENT + no gaps:**

```
COVERAGE ANALYSIS: ✓ Scenarios adequately cover the code
```

Continue to PHASE 5.

**If INSUFFICIENT or gaps found:**

```
COVERAGE ANALYSIS: {feature-name}

Gaps found:
1. {gap description}
2. {gap description}

Extra scenarios will be added and tested automatically...
```

Classify the proposed scenarios (PHASE 2 logic), execute them (PHASE 3/4 logic), and merge results back into the PHASE 4b table. No user interaction — Claude adds gaps automatically and tests them. Max 1 iteration (no repeat of PHASE 4c after the extra scenarios).

---

### PHASE 5: Results Report + Action Choice

> **Todo**: mark PHASE 4c → `completed`, PHASE 5 → `in_progress`.

**Goal:** Combined report with requirement coverage, then choose: feedback or fix.

```
TEST RESULTS: {feature-name}

REQUIREMENT COVERAGE
| REQ     | Description         | In Code | Tested | Result  |
|---------|---------------------|---------|--------|---------|
| REQ-001 | User can log in     | ✓       | ✓      | PASS    |
| REQ-002 | Email validation    | ✓       | ✓      | FAIL    |
| REQ-003 | Rate limiting       | ✗       | —      | MISSING |
| REQ-004 | Welcome mail        | ✓       | ✓      | PASS    |

Total: {pass}/{total} PASS | {fail} FAIL | {missing} MISSING
```

**If all PASS + no MISSING** → skip action choice, proceed to PHASE 6 (feedback = positive message).

**If any FAIL or MISSING:**

Use AskUserQuestion:

- header: "Action"
- question: "There are {fail} failed and {missing} missing items. What do you want to do?"
- options:
  - label: "Send feedback (Recommended)", description: "Generate feedback for teammate — they fix it themselves"
  - label: "Fix myself", description: "Fix the issues in their code and send back as working"
  - label: "Both", description: "Fix what can be fixed, send back the rest as feedback"
- multiSelect: false

**If "Send feedback"** → proceed to PHASE 6 (feedback).
**If "Fix myself"** → proceed to PHASE 5c (fix loop for ALL failed items).
**If "Both"** → proceed to PHASE 5c (fix loop). After fixes, PHASE 6 generates feedback for remaining MISSING/unfixed items.

---

### PHASE 5c: Fix Loop

> **Todo**: mark PHASE 5 → `completed`, PHASE 5c → `in_progress`.

**When:** User chose "Fix myself" or "Both" in PHASE 5.

For each FAIL item, analyze and fix:

1. **Analyze root cause** — read relevant source files, understand what's wrong
2. **Apply fix** — edit the code directly
3. **Verify** — run the relevant test (AUTO items: re-run via Task agent or CLI, MANUAL items: ask user to re-check)

After each fix:

```
[FIX] Item {N}: {title} [{REQ-ID}]
Root cause: {what was wrong, file:line}
Fix: {what was changed and why}
Impact: {what this affects}
```

**Re-test after all fixes:**

- AUTO items that were fixed → re-run via Task agent (same approach as PHASE 3)
- MANUAL items that were fixed → guided re-test (same approach as PHASE 4)

Display re-test results:

```
RE-TEST RESULTS: {feature-name}

| # | Test              | Type   | Requirement | Result |
|---|-------------------|--------|-------------|-----------|
| 2 | Without email     | AUTO   | REQ-002     | ✓ PASS   |
| 3 | Welcome mail      | MANUAL | REQ-004     | ✓ PASS   |

RE-TEST PASS: {n}  RE-TEST FAIL: {n}
```

**If items still failing after fix attempt:**

Use AskUserQuestion:

- header: "Fix Failed"
- question: "Item {N} still does not work after fix. What do you want to do?"
- options:
  - label: "Try again (Recommended)", description: "Try a different fix strategy"
  - label: "Send feedback", description: "Send as feedback to teammate"
  - label: "Accept", description: "Mark as known issue"
- multiSelect: false

Max 3 fix attempts per item before forcing fallback to feedback.

After fix loop completes → proceed to PHASE 5d.

---

### PHASE 5d: Regression Check

> **Todo**: mark PHASE 5c → `completed`, PHASE 5d → `in_progress`.

**Skip when:**

- No fixes applied in PHASE 5c
- No previously-PASS AUTO items in PHASE 4b
- All fixes were MANUAL-only (config/styling — low chance of side effects)

**Goal:** Verify that fixes have not broken previously working functionality.

Collect all items from PHASE 4b that were PASS and had AUTO classification. Re-run these via Task agent (same approach as PHASE 3).

Display:

```
REGRESSION CHECK: {feature-name}

{n} previously-PASS AUTO items re-tested...

| # | Test               | Was    | Now    |
|---|--------------------|--------|--------|
| 1 | Valid registration | ✓ PASS | ✓ PASS |
| 4 | Email format       | ✓ PASS | ✗ FAIL |

Regressions: {n} | Stable: {n}
```

**No regressions:** Continue to PHASE 6.

**Regressions found:** Add FAIL items to results. Offer the same fix/feedback choice as PHASE 5:

Use AskUserQuestion:

- header: "Regression"
- question: "{n} previously working items are now failing. What do you want to do?"
- options:
  - label: "Fix (Recommended)", description: "Fix the regressions (back to PHASE 5c for these items)"
  - label: "Send feedback", description: "Report regressions in feedback to teammate"
  - label: "Accept", description: "Mark as known issue"
- multiSelect: false

**After regression fix:** Do NOT repeat PHASE 5d (max 1 regression pass to prevent loops).

---

### PHASE 6: Update + Feedback

> **Todo**: mark PHASE 5d → `completed`, PHASE 6 → `in_progress`.

#### Step 1: Parallel Sync (feature.json + backlog + dashboard) — follow `shared/SYNC.md` 3-File Sync Pattern

1. **Update feature.json** (`BRIEF_REVIEW` mode only, skip if it does not exist):
   - `requirements[].status` → `"pass"` / `"fail"` / `"missing"` per requirement
   - Add/update `tests` section with session results
   - Update feature `status` if appropriate
   - Do NOT overwrite other sections

2. **Update backlog** (if `.project/backlog.html` exists, `BRIEF_REVIEW` or `TODO_REVIEW` mode):
   (see `shared/BACKLOG.md` for parse/write pattern)
   - Find feature in `data.features[]` by name
   - All PASS + no MISSING → `.status = "DONE"`, remove `stage`
   - Otherwise → `.status` stays `"DOING"`, `.stage` stays `"built"`
   - `data.updated` → current date
   - Edit `backlog.html` (keep `<script>` tags intact)

3. **Update project.json** (if `.project/project.json` exists, `BRIEF_REVIEW` or `TODO_REVIEW` mode):
   (see `shared/DASHBOARD.md`)
   - `features` array: find feature by name, set status to `"DONE"` (all pass) or `"DOING"` + stage `"built"` (fails remaining)
   - `stack.packages`: merge if packages were installed during fix loop
   - `endpoints`: merge if changed during fixes
   - `data.entities`: merge if changed during fixes
   - `architecture.components` in `.project/project-context.json` — **follow component-first model from `shared/DASHBOARD.md`**:
     - Confirm component status → `"done"`, merge test files from PHASE 3 into component `test[]`, merge source fixes from PHASE 5c into `src[]`
     - Add new components if they were created during fixes
     - Skip if no `architecture.components` exists in project-context.json

4. **Scoped auto-commit** (only this skill's changes):

   Compare current git status with baseline from PHASE 0:

   ```bash
   git status --porcelain | sort > /tmp/current-status.txt
   ```

   Categorize files by comparing with `.project/session/pre-skill-status.txt`:
   - **NEW** (only in current, not in baseline) → `git add` automatically
   - **OVERLAP** (in both baseline AND current) → warn user via AskUserQuestion: "These files had pre-existing uncommitted changes and were also modified by this skill: {list}. Include in commit?" Options: "Include (Recommended)" / "Skip"
   - **PRE-EXISTING** (only in baseline) → do NOT stage

   If baseline file doesn't exist, fall back to staging only known skill output files:

   ```bash
   git add .project/features/{feature-name}/feature.json .project/backlog.html .project/project.json .project/project-context.json
   ```

   ```bash
   git commit -m "test({feature}): {pass}/{total} requirements verified"
   ```

   **Cleanup:**

   ```bash
   rm -f .project/session/pre-skill-status.txt .project/session/active-{feature-name}.json /tmp/current-status.txt
   ```

#### Step 2: Teammate Feedback

**Skip if:** `BRANCH_ONLY` mode (no externalRef.assignees context).
**Runs in:** `BRIEF_REVIEW` and `TODO_REVIEW` modes.

Generate structured feedback based on test results, completeness check, and any fixes applied.

**Feature Readiness Verdict (always include):**

- `READY` — ≥90% requirements/scenarios pass + 0 CRITICAL failures
- `NOT READY` — otherwise (including reason)

**If all PASS (or all fixed):**

```
FEEDBACK FOR {externalRef.assignees[0] ?? "teammate"}

Feature: {feature-name}
Status: ✓ All PASS

✓ What works:
{list of passing requirements/expectations with brief evidence}

{If fixes were applied:}
Fixes applied:
{numbered list of fixes with file:line references}

Ready to merge.
```

**If FAIL or MISSING items remain:**

```
FEEDBACK FOR {externalRef.assignees[0] ?? "teammate"}

Feature: {feature-name}
Status: {pass}/{total} PASS

✓ What works:
{list of passing requirements with brief evidence}

✗ Issues:
{numbered list of failing/missing items with specific details:}
1. {REQ-ID} ({description}): {what's wrong or missing}
   Expected: {acceptance criteria}
   Found: {what was found, or "not implemented"}

{If some items were fixed:}
✓ Already fixed:
{list of fixes applied with file:line references}

Next step: {concrete action items for remaining issues}
```

Use AskUserQuestion:

- header: "Feedback"
- question: "Feedback for {externalRef.assignees[0] ?? 'teammate'} generated. What do you want to do with it?"
- options:
  - label: "Save as file (Recommended)", description: "Save to .project/features/{feature}/feedback.md"
  - label: "Show in chat", description: "Print feedback in conversation (copy manually)"
  - label: "Skip", description: "No action"
- multiSelect: false

---

## Mode Comparison

See PHASE 0 step 4 for the mode definition table (BRIEF_REVIEW / TODO_REVIEW / BRANCH_ONLY). The behavioral differences per phase are documented inline at each phase that specifies a `Skip if:` or mode requirement.

> **Todo**: mark PHASE 6 → `completed`.
