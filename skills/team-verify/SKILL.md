---
name: team-verify
description: Verify teammate code delivery against task brief. Use with /team-verify.
reads:
  [
    feature.requirements,
    feature.files,
    feature.externalRef,
    backlog.status,
    project.stack,
    project.endpoints,
    project.entities,
    project-context.context,
  ]
writes:
  [
    feature.requirements,
    feature.tests,
    backlog.status,
    backlog.features,
    project.stack,
    project.endpoints,
    project.entities,
    project-context.architecture,
  ]
metadata:
  author: claude-config
  version: 2.1.0
  category: team
---

# Verify — Teammate Verification

## Overview

Verify teammate code delivery. Detects available context (feature.json with requirements, backlog TODO with description, or just a branch diff), checks completeness where possible, generates and runs tests, and produces structured feedback.

**Trigger**: `/team-verify` or `/team-verify {feature-name}` or `/team-verify {feature-name} {feedback}`

## When to Use

- After teammate delivers code on a feature (with or without `/dev-ship (define phase)`)
- When teammate pushes code for a backlog TODO item
- When teammate branch code needs verification before merge

**NOT for:**

- Testing own code (use `/dev-ship (verify phase)`)
- Unit-level test writing during build (use `/dev-ship (build phase)`)

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

0. **Team-mode gate.** Read `TEAM_MODE` via `shared/PROJECT-MODE.md` read pattern. If `"solo"` or absent → show AskUserQuestion (warn-only):

   ```yaml
   header: "Solo project"
   question: "This project is marked solo (team.mode). /team-verify is meant for verifying teammate deliveries. Continue anyway?"
   options:
     - label: "Cancel (Recommended)"
       description: "Exit. Toggle to team via the ⚙ button in the backlog or run /core-setup to mark this as a team project."
     - label: "Yes, continue once"
       description: "Proceed with verification for this single invocation."
   multiSelect: false
   ```

   Cancel → exit. Continue → proceed with step 1.

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

   b. **Backlog TODO** — if no feature.json found, check `.project/backlog.json` for a TODO/DOING item matching the feature name or branch name. Extract the item's description/title.

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

> **Todo**: mark PHASE 0 → `completed`, PHASE 0.5 → `in_progress`. Skip if `BRANCH_ONLY` mode. Otherwise read `.claude/skills/team-verify/references/phase-0-5-completeness.md` and follow the agent prompts for the detected mode.

---

### PHASE 1: Research + Scenario Generation (Explore agent)

> **Todo**: mark PHASE 0.5 → `completed`, PHASE 1 → `in_progress`. Read `.claude/skills/team-verify/references/phase-1-scenario-agent.md` and spawn the Explore agent with the prompt template.

**Goal:** Research test strategies and generate scenarios. Runs in a single Explore agent to keep Context7 results and scenario details out of the main context.

---

### PHASE 2: Test Plan + Classification

> **Todo**: mark PHASE 1 → `completed`, PHASE 2 → `in_progress`.

**Goal:** Classify scenarios into AUTO/MANUAL, generate test data, set up dev server.

> **Classification criteria:** See `../shared/test-classification.md` for AUTO/BROWSER, AUTO/CLI, and MANUAL criteria with pattern tables.

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

> **Todo**: mark PHASE 2 → `completed`, PHASE 3 → `in_progress`. Skip if no AUTO items or dev server unavailable. Otherwise read `.claude/skills/team-verify/references/phase-3-task-agent.md` and spawn the Task agent.

---

### PHASE 4: Manual Test Execution (interactive)

> **Todo**: mark PHASE 3 → `completed`, PHASE 4 → `in_progress`. Skip if no MANUAL items. Otherwise read `.claude/skills/team-verify/references/phase-4-manual.md` and follow the interactive loop.

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

> **Todo**: mark PHASE 5 → `completed`, PHASE 5c → `in_progress`. Skip if user chose "Send feedback". Read `.claude/skills/team-verify/references/phase-5c-fix-loop.md` and follow the fix-iterate-retest flow.

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

2. **Update backlog** (if `.project/backlog.json` exists, `BRIEF_REVIEW` or `TODO_REVIEW` mode):
   (see `shared/BACKLOG.md` for parse/write pattern)
   - Find feature in `data.features[]` by name
   - All PASS + no MISSING → `.status = "DONE"`, remove `stage`
   - Otherwise → `.status` stays `"DOING"`, `.stage` stays `"built"`
   - `data.updated` → current date
   - Edit `.project/backlog.json`

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

4. **Scoped auto-commit** — follow [shared/SCOPED-COMMIT.md](../shared/SCOPED-COMMIT.md). team-verify deltas:
   - **Baseline**: status form — `.project/session/pre-skill-status.txt`.
   - **OVERLAP policy**: interactive.
   - **Fallback**: stage known codebase skill-output files only (acceptance test files, source files modified during verification). `.project/` is local-only — never stage it.
   - **Commit**: `git commit -m "test({feature}): {pass}/{total} requirements verified"`
   - **Cleanup**: `rm -f .project/session/pre-skill-status.txt .project/session/active-{feature-name}.json /tmp/current-status.txt`

#### Step 2: Teammate Feedback

> **Todo**: if not `BRANCH_ONLY` mode → read `.claude/skills/team-verify/references/phase-6-feedback.md` and generate feedback using the appropriate template.

---

## Mode Comparison

See PHASE 0 step 4 for the mode definition table (BRIEF_REVIEW / TODO_REVIEW / BRANCH_ONLY). The behavioral differences per phase are documented inline at each phase that specifies a `Skip if:` or mode requirement.

## References

Read these Just-In-Time during specific phases — do not load upfront.

| File                                   | When to load                                                               |
| -------------------------------------- | -------------------------------------------------------------------------- |
| `references/phase-0-5-completeness.md` | PHASE 0.5 — completeness agent prompts for BRIEF_REVIEW and TODO_REVIEW    |
| `references/phase-1-scenario-agent.md` | PHASE 1 — Explore agent prompt for scenario research                       |
| `references/phase-3-task-agent.md`     | PHASE 3 — Task agent prompt + result parsing for AUTO test execution       |
| `references/phase-4-manual.md`         | PHASE 4 — interactive manual test loop                                     |
| `references/phase-5c-fix-loop.md`      | PHASE 5c — fix-iterate-retest flow (only when user chose Fix myself/Both)  |
| `references/phase-6-feedback.md`       | PHASE 6 Step 2 — feedback templates for BRIEF_REVIEW and TODO_REVIEW       |
| `references/completeness-patterns.md`  | PHASE 0.5 — matching patterns for Explore agent (load alongside phase-0-5) |

> **Todo**: mark PHASE 6 → `completed`.
