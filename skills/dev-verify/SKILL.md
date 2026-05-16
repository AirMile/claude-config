---
name: dev-verify
description: Run adversarial acceptance tests and fix loops. Use with /dev-verify.
reads: [feature.requirements, feature.build]
writes: [feature.tests, backlog.status]
metadata:
  author: claude-config
  version: "2.3.0"
  category: dev
---

# Verify

Verify phase: define → build → **verify**

**Trigger**: `/dev-verify {feature-name}` or `/dev-verify {feature-name} {feedback}`

## Input Formats

```
/dev-verify user-registration                              # hybrid: auto + manual
/dev-verify user-registration 1:PASS 2:FAIL no validation  # inline feedback (skips automation)
/dev-verify user-registration Everything works except...    # free text (skips automation)
```

> Classification criteria: `references/test-classification.md`
> Code quality rules: `../shared/RULES.md` (R007-R009)

## Workflow

**Phase tracking** — first action of the skill: call `TaskCreate` with the 5 mandatory phases (status `pending`):

1. PHASE 0: Load Context and Classify
2. PHASE 1: Automated Testing (skip if no AUTO items — mark completed without work)
3. PHASE 2b: Combined Results
4. PHASE 5d: Requirement Verification
5. PHASE 6: Completion

Add fix-loop phases via `TaskCreate` ONLY when they will fire:
- Inline feedback provided → add PHASE 1b before PHASE 2b
- MANUAL items in classification → add PHASE 2 before PHASE 2b
- FAILs in PHASE 2b → add PHASE 3, PHASE 4, PHASE 5, PHASE 5b
- Any PHASE 4 fixes touched previously-PASS AUTO items → add PHASE 5c
- All PASS + worktree branch detected → add PHASE Finalize at end

Use `TaskUpdate` to set `in_progress` per phase at start and `completed` at end. During context compaction the task list remains visible — no risk of missed phases.

### PHASE 0: Load Context and Classify

> **Todo**: call `TaskCreate` with the 5 mandatory phases (see Workflow above). Mark PHASE 0 → `in_progress` via `TaskUpdate`.

1. **Read backlog** — `.project/backlog.html`, parse JSON from `<script id="backlog-data">` (see `shared/BACKLOG.md → Lifecycle Protocol → Read`).

   Resolve the active feature in this precedence order:
   - **Arg provided + matches a verifying feature** → use the arg. Show: `Backlog: ✓ Task picked up — {name}`.
   - **Arg provided + no match** → use the arg name verbatim (legacy / out-of-band feature).
   - **No arg + exactly one feature has `transition === "verifying"`** → auto-select that feature. Show: `Backlog: ✓ Task picked up — {name}`.
   - **No arg + multiple verifying features** → AskUserQuestion to choose; recommend the most-recently-updated one.
   - **No arg + no verifying feature** → fallback to `status === "DOING"`; still none → suggest via AskUserQuestion.

2. **Parse input:**
   - Feature name only → proceed to classification (continue at Step 3).
   - Feature name + inline feedback → skip to PHASE 1b.
   - Feature name + free text → skip to PHASE 1b.

3. **Validate build output** — `.project/features/{feature-name}/feature.json`. Parse `tests.checklist[]`. No checklist → exit: run `/dev-build` first.

   **COMPONENT detection** (after feature.json load): check whether `feature.type === "COMPONENT"` or backlog-item type is COMPONENT. If yes: set `IS_COMPONENT_VERIFY = true`. Look up demo-page: check whether `app/_dev/components/{name}/page.tsx` exists. Not found → exit: `"Demo-page not found. Run /dev-build {feature} again — this generates app/_dev/components/{name}/page.tsx."`. Dev server navigates to `/_dev/components/{name}` instead of the regular feature route.

4. **Worktree switch** — execute the procedure in `shared/WORKTREE.md` with `feature-name` and `feature.status` (from Step 1). Switches automatically to `worktree-{feature-name}` if it exists. If no worktree exists but `feature.status === "DOING"`: WARN + AskUserQuestion (see WORKTREE.md → Step 4a: DOING-without-worktree warning). On FAIL (in a different worktree than the feature): stop with the message from WORKTREE.md.

5. **Tag backlog + capture baseline:**
   - Git baseline: `mkdir -p .project/session && git status --porcelain | sort > .project/session/pre-skill-status.txt`
   - Lint baseline (silent, for later delta): run project lint command (from `package.json` scripts: `lint` / `check` / `typecheck`), capture full output (file:line:rule keys) to `.project/session/pre-skill-lint.txt`. Failed lint at baseline → write output, do NOT block. Display nothing.
   - Session file: `echo '{"feature":"{name}","skill":"verify","startedAt":"{ISO}"}' > .project/session/active-{name}.json`

6. **Load stack & project context** — CLAUDE.md stack section + `.project/project.json` (stack, endpoints, data) + `.project/project-context.json` (context, architecture). Compose STACK_CONTEXT:

   ```
   STACK CONTEXT:
   Framework: {framework} ({language})
   Testing: {testing info}
   Packages: {relevant packages}

   PROJECT CONTEXT:
   Structure: {context.structure or "not available"}
   Routing: {context.routing or "not available"}
   Patterns: {context.patterns or "not available"}
   Endpoints: {endpoints or "not available"}
   Entities: {data.entities or "not available"}
   ```

7. **Gather test data** via Explore agent on **Sonnet** (`model: "sonnet"`) — zero source file reads in main context:

   ```
   Feature: {feature-name}
   Feature file: .project/features/{feature-name}/feature.json

   {STACK_CONTEXT}

   Read feature.json (checklist + requirements + build section). Search in source code for:
   - Validation rules, API endpoints relevant to test items
   - Existing test files and test patterns
   - Per requirement (id + acceptance scenarios) — **skip requirements with `deltaOp === "REMOVED"`**: read the source files that implement this REQ
     (feature.json files[] where requirements contain the REQ-ID).
     Determine which acceptance test(s) would verify each scenario.
     Format: `acceptance: [{ when, then }]` — each object = one test scenario.
     (e.g. "201 on success, 400 on >5, 409 on duplicate" = 3 scenarios).

   Prefer short form. Full form costs main-context tokens.

   Return as:
   FEATURE_CONTEXT_START
   Existing tests: {paths, or "none"}

   Per test item, choose ONE of two formats:

   A) COVERED short form (when build test fully verifies the contract — httpContractTested: true AND delta === "none"):
   - Item {N}: {title} — COVERED by {test-file:test-name}

   B) FULL form (when httpContractTested: false OR delta !== "none" OR acceptance gap):
   - Item {N}: {title}
     Test data: {concrete values}
     Expected: {expected outcome}
     Recommended method: BROWSER | CLI
     Already covered: {what build tests verify, or "none"}
     httpContractTested: true/false
     delta: {extra verification needed, or "none"}
     acceptanceTests: [
       { scenario: "{test description}", method: "CLI", expected: "{expected}" }
     ]

   Full form is only needed when the classifier (step 8d) must branch on per-item detail.
   FEATURE_CONTEXT_END
   ```

8. **Classify and plan test execution:**

   a) Baseline check: `npm test 2>&1 | tail -20` (or project-specific command). (can run in parallel with the Explore agent in Step 7 to save time)
   Display: `BASELINE: npm test → {PASS|FAIL} ({n}/{n})`

   b) Detect post-build mode:

   ```
   postBuildMode = true
   hasUI = feature.json has "design" field OR files[] contains frontend files (.tsx, .vue, .svelte)
   isPureAPI = feature.json has "apiContract" AND NOT hasUI
   isComponent = IS_COMPONENT_VERIFY === true
   ```

   **Token scan** (only if `hasUI = true` or `isComponent = true`):

   Grep all files in `feature.json files[]` matching `.tsx`, `.jsx`, `.vue`, `.svelte` for T101 (`#[0-9a-fA-F]{3,8}` in JSX/className) and T102 (`bg-\[#`, `text-\[#`). Violations found → add AUTO/CLI test item: `"Token violations: {N} hardcoded values (T101/T102)"`, fix directly via `shared/TOKENS.md` mapping. No violations → skip (no output).

   **COMPONENT extra check** (only if `isComponent = true`): add mandatory test item:

   ```json
   {
     "id": "COMP-MATRIX",
     "title": "Variant matrix visible on demo-page",
     "steps": [
       "Navigate to /_dev/components/{name}",
       "Verify presence of all variants × sizes × states cards"
     ],
     "expected": "All {variants × sizes × states} combinations are visible without errors",
     "type": "AUTO/BROWSER"
   }
   ```

   c) Cross-requirement integration — Analyze `requirements[]`, identify combinations where output of one requirement is input for another. Max 3 scenarios, add as extra test items (not persisted to feature.json checklist). No logical combinations → skip.

   d) Per item, use Explore agent output:
   - `httpContractTested: true` + `delta: "none"` → **COVERED**
   - `httpContractTested: true` + delta → **AUTO/CLI** or **AUTO/BROWSER** (delta only)
   - `httpContractTested: false` → classify based on steps/hasUI/isPureAPI per `references/test-classification.md`
   - Integration scenarios → always **AUTO** (never COVERED)

   e) Display:
   - One-line summary: `COVERED: {n}  AUTO: {n} (BROWSER: {n}, CLI: {n})  MANUAL: {n}`
   - If `AUTO + MANUAL > 0`: show table with ONLY non-COVERED items (Type column + reason).
   - If `AUTO + MANUAL == 0` AND `COVERED > 0`: skip table entirely.
   - If ALL items are non-COVERED (no build tests cover any contract): show full table.

   f) With mixed types (COVERED + AUTO + MANUAL): show ASCII flowchart of the test execution flow. With only COVERED + AUTO/CLI: skip flowchart.

   g) Proceed automatically with the recommended classification. No user approval needed — continue directly to step 8h.

   h) **Goal-backward verification + acceptance test planning:**

   Internally map tests back to acceptance criteria. **GAP**: requirement where builder's tests verify internal methods/data structures instead of the acceptance criterion itself.

   Per GAP with CLI-testable acceptance tests (from Explore agent `acceptanceTests[]`): add to AUTO/CLI queue (PHASE 1) with `source: "acceptance"` marker.
   BROWSER and MANUAL gaps → add items via existing classification (step 7d).

   Display:
   - No gaps → single line: `Acceptance mapping: {n}/{n} REQs covered`
   - Gaps found → single line: `ACCEPTANCE TESTS: {n} test(s) planned for {m} requirement(s) — gaps: {REQ-ID list}`
   - Show full GAP-only table ONLY if {m} >= 3 (helps user scan multiple gaps).

9. **Dev server** (conditional):

   ```
   All non-COVERED items AUTO/CLI (in-process testable)  → skip dev server entirely
   MANUAL or AUTO/BROWSER items                          → start via /project-tunnel process (tunnel needed)
   AUTO/CLI with live server required                    → start on localhost (without tunnel)
   ```

   On failure → graceful fallback: all items become MANUAL, skip PHASE 1.

---

### PHASE 1: Automated Testing

> **Todo**: mark PHASE 0 → `completed`, PHASE 1 → `in_progress`.

**Skip** if there are no AUTO items (all non-COVERED items are MANUAL, or everything is COVERED).

Launch Agent to execute non-COVERED AUTO items in a separate context window.

**AUTO/CLI approach selection** (agent decides based on feature type):

- **Pure API / service feature**: write integration test file (node:test / vitest) with mock dependencies and real DB (mongodb-memory-server). Test via service layer, not HTTP.
- **Feature requiring running server**: curl commands against dev server.
- **Build/lint verification**: direct bash commands.

Agent prompt:

```
Test the following items automatically via Playwright runner specs, bash commands, or integration tests.
Feature: {feature-name}
{IF dev server running: Dev server: {url}}

{STACK_CONTEXT}

ITEMS:
{per AUTO item:}
- Item {N}: {title}
  Steps: {test steps}
  Test data: {test data}
  Expected: {expected outcome}
  Method: {BROWSER or CLI}

INSTRUCTIONS:
1. Execute steps via bash commands, Playwright runner specs, or write an integration test file
2. For CLI items without running server: write an integration test that tests the service/function directly with mock dependencies and real DB.

   Path decision (check existing builder-test locations first):
   - Builder tests are colocated (e.g. `src/foo/bar.test.ts` next to `bar.ts`) → write `{builder-test-dir}/{feature}.integration.test.{ext}` colocated.
   - Builder tests live in a top-level `test/` or `__tests__/` directory → write `test/integration/{feature}.integration.test.{ext}`.
   - No existing builder tests → default to `test/integration/{feature}.integration.test.js`.

3. For acceptance items (source: "acceptance"): write test as a separate file using the project's test framework (vitest/jest/node:test — check package.json).

   Path decision (check existing builder-test locations first):
   - Builder tests are colocated (e.g. `src/foo/bar.test.ts` next to `bar.ts`) → write `{builder-test-dir}/{feature}.acceptance.test.{ext}` colocated alongside the builder test.
   - Builder tests live in a top-level `test/` or `__tests__/` directory → write `test/acceptance/{feature}.acceptance.test.{ext}` (or `__tests__/acceptance/...`).
   - No existing builder tests → default to `test/acceptance/{feature}.acceptance.test.{ext}`.

   Goal: `npm test` picks up the acceptance file as part of the regression suite. Whichever path achieves that for THIS project is correct.
   Example: builder test `expect(countDocuments).toBeCalled` vs acceptance test `POST 6th → expect(res.status).toBe(400)`

4. For BROWSER items: write a Playwright runner spec in test/acceptance/{feature}.spec.ts (runner, NOT the playwright-cli daemon).
   Use the on-the-fly spec pattern: see shared/PLAYWRIGHT.md → Runner Mode.
   Runner availability check: `npx playwright --version 2>/dev/null`.
   Available → write spec with `expect(page)` assertions. For a11y criteria: use `toMatchAriaSnapshot()`.
   For visual criteria ("feels fast", "looks good"): use `toHaveScreenshot()` — first run creates baseline.
   Run: `npx playwright test test/acceptance/{feature}.spec.ts --reporter=json`
   Runner not available → run `/core-setup playwright` to install daemon + runner, then retry.
   On persistent failure → mark as TOOL_ERROR and note: "runner spec generated but could not run"
5. Determine PASS/FAIL with evidence and reasoning
6. TOOL_ERROR (runner fails or CLI errors) → mark as TOOL_ERROR

POST-BUILD: baseline already GREEN. Focus on INTEGRATION and ACCEPTANCE, not unit logic.
Do NOT re-run the full baseline test suite just to verify it stays green. Run only the new test files you wrote.

RESULT FORMAT:
AUTOMATED_RESULTS_START
| # | Test | Result | Evidence | Reasoning |
|---|------|-----------|--------|------------|
AUTOMATED_RESULTS_END

FALLBACK_ITEMS: {TOOL_ERROR items, or "none"}
```

**Parse results:** if output is truncated (no markers visible), use Grep to find `AUTOMATED_RESULTS_START` in agent output. TOOL_ERROR items → reclassify as MANUAL.

**Agent fails completely:** graceful fallback → all AUTO items become MANUAL.

Display: `AUTO PASS: {n}  AUTO FAIL: {n}  TOOL_ERROR → MANUAL: {n}`

---

### PHASE 1b: Parse Inline Feedback

> **Todo**: mark PHASE 1 → `completed`, PHASE 1b → `in_progress`.

**When:** user provided feedback with `/dev-verify {name} {feedback}` (skips PHASE 1 + 2).

Parse into item/PASS/FAIL/notes. Accept `1:PASS 2:FAIL note` and free text.
Show summary, go to PHASE 3.

Unclear feedback → AskUserQuestion: Re-enter (Recommended) | Continue per item | Explain.

---

### PHASE 2: Manual Walkthrough

> **Todo**: mark PHASE 1b → `completed`, PHASE 2 → `in_progress`.

**When:** there are MANUAL items.

Show setup once (e.g. "Open {tunnel_url}"). Per MANUAL item:

```
──────────────────────────────────────
MANUAL TEST {n}/{total}: {title}
──────────────────────────────────────

STEPS:
1. {concrete action with data}

TEST DATA:
{table with fields + values}

EXPECTED:
→ {expected outcome}
```

**Codegen tip for repeatable flows** (show once above first MANUAL item if flow has ≥3 steps):

```
💡 For flows with ≥3 steps: run `npx playwright codegen {url}` in a terminal to
   record your interactions as a Playwright spec. Submit it to /dev-verify for
   automatic BROWSER-verification on future runs.
```

AskUserQuestion per item: Pass (Recommended) | Fail | Skip.

- Fail → ask briefly what went wrong
- Skip → note reason

---

### PHASE 2b: Combined Results

> **Todo**: mark PHASE 2 → `completed`, PHASE 2b → `in_progress`.

Merge COVERED + automated + manual results.

**Compact** (postBuildMode + all PASS + COVERED items):

```
TEST RESULT: {feature-name} (POST-BUILD)

BASELINE: npm test → PASS ({n}/{n})
COVERED: {n} items (build tests cover contract)
ACCEPTANCE + INTEGRATION: {n} scenarios → {n} PASS
TOTAL: {n}/{n} PASS
{IF acceptance tests ran: Evaluation: {n}/{n} REQs PASS}
```

**Full table** (with FAILs or no COVERED):

```
COMBINED RESULTS: {feature-name}

| # | Test | Type | Result |
|---|----- |------|-----------|
```

With AUTO FAILs → AskUserQuestion: Trust auto results (Recommended) | Check manually.
With SKIPs → AskUserQuestion: Accept (Recommended) | Test later.

**Evaluation Score** (only show if acceptance tests were run AND ≥1 FAIL):

```
EVALUATION: {feature-name}

| REQ   | Acceptance Tests | Builder Tests | Verdict |
| ----- | ---------------- | ------------- | ------- |
| REQ-2 | 1/2 PASS         | 1/1 PASS      | FAIL    |
```

Show ONLY rows with verdict FAIL (or BLOCKED/UNCLEAR). All-PASS → already folded into compact block as `Evaluation: {n}/{n} REQs PASS` — no separate table.

Acceptance test FAIL → issue type **SPEC**. Builder test FAIL → issue type **TESTABLE**.
No acceptance tests run → skip entirely, categorize only on builder test FAILs.

All PASS → PHASE 6. FAILs (SPEC or TESTABLE) → PHASE 3.

---

### PHASE 3: Categorize Issues

> **Todo**: mark PHASE 2b → `completed`, PHASE 3 → `in_progress`.

Per FAIL: pick exactly one category.

| Category    | Trigger                                                           | Examples                                     |
| ----------- | ----------------------------------------------------------------- | -------------------------------------------- |
| SPEC        | Acceptance test fails — criterion not covered by implementation   | Missing validation, wrong format, off-by-one |
| TESTABLE    | Builder test fails — implementation is wrong                      | Logic bug, wrong return value, race          |
| MEASURABLE  | Failure has a numeric/visual threshold (timing, CSS, layout)      | Slow render, wrong color, layout-shift       |
| SUBJECTIVE  | Criterion is vague ("feels fast", "looks good") — ask user        | UX impressions, taste-level disagreements    |

SUBJECTIVE → AskUserQuestion for clarification, then re-categorize as one of the other three.

Technique mapping:

- **SPEC** (acceptance criterion not covered) → **Implementation First** (criterion is clear, fix is concrete) + write/update acceptance test
- **TESTABLE** validatie, business logic, edge cases, race conditions → **TDD**
- **TESTABLE** CRUD wiring, config, imports, routing → **Implementation First**
- **MEASURABLE** → **Direct Fix** (config tweak, no test loop)
- Default → TDD

Display technique map:

```
| Item | Issue | Type | Technique | Reason |
```

---

### PHASE 4: Fix Loop

> **Todo**: mark PHASE 3 → `completed`, PHASE 4 → `in_progress`.

#### TDD Fix

Complex issues → AskUserQuestion: Research via Context7 (Recommended) | Fix directly.

TDD: test → red → fix → green. Max 3 attempts, then ask user.

```
[FIX] Item {N}: {title}
Technique: TDD | Type: {AUTO|MANUAL}
RED: FAIL ({what})  GREEN: PASS
SYNC: Root cause: {file:line}. Fix: {approach}. Impact: {scope}.
```

Test already passes → AskUserQuestion: Skip (Recommended) | Adjust test | Check manually.

#### Implementation First Fix

Fix → write test → verify PASS. Max 3 attempts.

```
[FIX] Item {N}: {title}
Technique: Implementation First | Type: {AUTO|MANUAL}
IMPLEMENTED: {what}  TESTED: PASS
SYNC: Root cause: {file:line}. Fix: {approach}. Impact: {scope}.
```

#### MEASURABLE: Direct Fix

Fix direct (config, styling, timing). Needs manual re-test.

```
[FIX] Item {N}: {title}
Technique: Direct Fix | Type: {AUTO|MANUAL}
SYNC: Root cause: {file:line}. Fix: {approach}. Impact: {scope}.
```

---

### PHASE 5: Re-test

> **Todo**: mark PHASE 4 → `completed`, PHASE 5 → `in_progress`.

Re-test ONLY fixed items.

**Phase A: Auto** — fixed AUTO items via Agent (same approach as PHASE 1, markers `RETEST_RESULTS_START`/`RETEST_RESULTS_END`). TOOL_ERROR → Phase B.

**Phase B: Manual** — fixed MANUAL items via walkthrough. Show CHANGE (fix summary) + original steps.

Display re-test results.

### PHASE 5b: Re-test Loop

> **Todo**: mark PHASE 5 → `completed`, PHASE 5b → `in_progress`.

All pass → PHASE 5c.

Items still failing → AskUserQuestion: More details (Recommended) | Different approach | Accept | Fix yourself.
Loop back to PHASE 3. AUTO items → re-run in PHASE 5A. MANUAL items → re-test in PHASE 5B.

---

### PHASE 5c: Regression Check

> **Todo**: mark PHASE 5b → `completed`, PHASE 5c → `in_progress`.

**Skip silently (no user output) when:**

- No fixes applied in PHASE 4
- No previously-PASS AUTO items in PHASE 2b
- All fixes were MANUAL-only (config/styling)

Re-run all previously-PASS AUTO items via Agent (same approach as PHASE 1).

```
REGRESSION CHECK: {feature-name}

| # | Test               | Was    | Now    |
|---|--------------------|--------|--------|
| 1 | Route rendering    | ✓ PASS | ✓ PASS |
| 3 | Form validation    | ✓ PASS | ✗ FAIL |

Regressions: {n} | Stable: {n}
```

**No regressions:** Proceed to PHASE 6.

**Regressions:** Show and offer choice via AskUserQuestion: Fix (Recommended) | Accept. If fixing → back to PHASE 4 for regression items only. Do NOT repeat PHASE 5c after regression fix (max 1 pass).

---

### PHASE 5d: Requirement Verification

> **Todo**: mark the previously-active phase → `completed` and PHASE 5d → `in_progress`. (Previously-active is PHASE 2b for the all-PASS happy path, or PHASE 5c if fixes ran.)

**Skip when:** All tests FAIL (coverage check pointless on catastrophic failures).

Cross-check `feature.json` requirements against test results.

1. **Load requirement → test mapping:**
   - Per `requirements[]` entry (id, description, status) — **skip entries with `deltaOp === "REMOVED"`**
   - Look up matching `tests.checklist[]` entries via `requirementId`

2. **Classify per requirement** (before rendering anything):
   - **COVERED**: at least 1 test with matching `requirementId` AND status `PASS`
   - **FAIL**: at least 1 test matching but status `FAIL`
   - **BLOCKED**: test does not exist or fails due to external dependency (service down, missing API key, missing fixture)
   - **UNCLEAR**: no test possible because acceptance criteria is too vague — non-deterministic
   - **NO TEST**: no test in `checklist[]` with matching `requirementId` (no legitimate reason)

3. **All requirements COVERED** (no FAIL/BLOCKED/UNCLEAR/NO TEST) — STOP HERE:
   - Output one line only: `Requirement coverage: {n}/{n} REQs PASS`.
   - Do NOT render the matrix below.
   - Proceed to PHASE 6.

4. **Any uncovered requirement** — render the matrix:

   ```
   REQUIREMENT COVERAGE: {feature-name}

   | REQ       | Description (short)       | Tests | Status        |
   |-----------|----------------------------|-------|---------------|
   | REQ-001   | {first 40 chars}           | 2     | ✓ COVERED     |
   | REQ-002   | {first 40 chars}           | 0     | ✗ NO TEST     |
   | REQ-003   | {first 40 chars}           | 1     | ⊘ BLOCKED     |
   | REQ-004   | {first 40 chars}           | 0     | ? UNCLEAR     |

   Coverage: {covered}/{total} requirements ({percentage}%)
   Non-testable: BLOCKED={n} UNCLEAR={n} (needs re-opening)
   ```

5. **With NO TEST, FAIL, BLOCKED or UNCLEAR requirements:**

   Per uncovered requirement, AskUserQuestion:

   ```yaml
   header: "REQ not covered: {REQ-ID}"
   question: "{requirement description} — no test found. What do you want to do?"
   options:
     - label: "Add test (Recommended)", description: "Write a test — CLI/acceptance, Playwright runner spec for BROWSER, or visual baseline via toHaveScreenshot"
     - label: "Covered by other test", description: "Implicitly tested via another test"
     - label: "Blocked by dependency", description: "External service/fixture missing — not testable now"
     - label: "Criteria too vague", description: "Acceptance criteria lacks concreteness — re-open /dev-define or convert to visual baseline"
   multiSelect: false
   ```

   - **Add test** → add test item to `tests.checklist[]` with `requirementId`, `status: "pending"`. Loop back to PHASE 1 (AUTO) or PHASE 2 (MANUAL) for this item only. Automatically choose the right method:
     - Functional criterion → CLI/acceptance test (vitest/jest)
     - Browser behavior / user flow → Playwright runner spec in `test/acceptance/{feature}.spec.ts`
     - Visual criterion ("feels fast", "looks good", "no layout-shift") → `toHaveScreenshot()` baseline via runner
     - A11y criterion → `toMatchAriaSnapshot()` via runner
   - **Covered by other test** → ask which test covers it. Mark requirement with `implicitCoverage: "{REQ-ID} test also validates this via {description}"`. Status → `"PASS"`.
   - **Blocked by dependency** → ask which dependency. Status → `"BLOCKED"`, add to `requirements[].evidence = "blocked by: {reason}"`. Not merge-blocking; signal to re-open after dependency fix.
   - **Criteria too vague** → two paths:
     - Can be concretized with a visual baseline → write `toHaveScreenshot()` runner spec, status → `"PASS"` after baseline.
     - Cannot be concretized → ask what is vague. Status → `"UNCLEAR"`, add to `requirements[].evidence = "needs clarification: {what's vague}"`. Signal for `/dev-define` re-open to formulate concrete acceptance.

---

### PHASE 6: Completion

> **Todo**: mark PHASE 5d → `completed`, PHASE 6 → `in_progress`.

#### Step 1: Fix Sync

Skip silently if no fixes in PHASE 4.

Per fix in plain language:

```
Fix {N}: {title}
- Problem: {what}
- Change: {file:line}
- Watch out: {only if relevant}
```

AskUserQuestion: Yes, clear (Recommended) | Explain more | I have a question. Loop until clear.

Save fix sync to `feature.json` (tests.fixSync).

#### Step 2: Observations

Skip silently when this session had no MANUAL items (pure automode — user checked nothing themselves, so nothing can have been noticed).

AskUserQuestion: No, all good (Recommended) | Yes, I noticed something.
"Yes" → ask description, note for feature.json (observations[]).

#### Step 3: 3-File Sync

Update three files so the project state matches the verify result. **For feature.json: use a single Read → mutate-in-memory → Write cycle**, not per-field Edit calls.

**feature.json** — Read once, parse JSON, apply all mutations in memory, Write once:

- `status` → `"DONE"`
- Per `requirements[]` (skip `deltaOp === "REMOVED"`): `status` → `"PASS"` / `"FAIL"` / `"BLOCKED"` / `"UNCLEAR"` per REQ (BLOCKED/UNCLEAR include `evidence` string)
- Per `tests.checklist[]`: `status` → `"PASS"` / `"FAIL"` / `"skip"` per item
- `tests.finalStatus` → `"PASSED"` (all requirements PASS) / `"FAILED"` (≥1 FAIL) / `"PARTIAL"` (≥1 BLOCKED or UNCLEAR, 0 FAIL). PARTIAL signals incomplete verification; feature `status` remains `"DONE"`.
- `tests.sessions[]` → append `{ "date": "YYYY-MM-DD", "pass": N, "fail": N, "skip": N }`
- `tests.fixSync` → fix summaries (if fixes applied)
- `observations[]` → add (if present)
- `tests.verificationCheckpoint` → `{ "gaps": ["REQ-ID"], "mismatches": ["description"], "adjustments": "none|added|reworded" }`
- `tests.evaluation` → per-REQ scores `[{ reqId, acceptancePass, acceptanceTotal, builderPass, builderTotal, verdict }]`
- `tests.acceptanceTestFile` → path to written acceptance test file (persistent in codebase)

Single Write replaces the entire file. Prevents drift across ~10 sequential Edits.

**Verification**: parse feature.json once after writing — verify `status === "DONE"` + `tests.finalStatus` set. Display verification result ONLY if it fails.

**PAGE-seeding (safety net — frontend projects only):**

Execute **before** the backlog mutation. Trigger only if **all** conditions are true:

1. `project.json#stack.framework` is a frontend framework (React, Vue, Svelte, Next.js, Nuxt, Astro, Remix, SolidJS)
2. PHASE 4 applied fixes (there are `tests.fixSync` entries this session)
3. New page-files exist that were not in `feature.json#files[]` before this session — detect via diff against `pre-skill-status.txt` baseline. Paths matching: `app/**/page.tsx`, `src/routes/**`, `pages/**/*.{tsx,vue}`, `routes/**/*.svelte`, or component names ending in `Page`, `Screen`, `View`
4. After idempotency-filter (`data.features.find(f => f.name === <kebab-name>)`) ≥1 candidates remain

If all conditions are true → AskUserQuestion:

```yaml
header: "Pages detected during fix"
question: "PHASE 4 added {N} new page-files. Do you want to add them as PAGE-todos on the backlog?"
options:
  - label: "Yes, all (Recommended)"
    description: "Create a PAGE-todo for each page so they go through design → check"
  - label: "Selection"
    description: "Choose which pages get a separate todo"
  - label: "No"
    description: "No extra todos — pages are covered in fix-sync"
multiSelect: false
```

Per selected page → push to `data.features[]`:

```json
{
  "name": "{kebab-case page name}",
  "type": "PAGE",
  "status": "TODO",
  "phase": "P3",
  "description": "Page introduced via fix in {parentFeature}. Routes: {route-pattern}",
  "source": "/dev-verify",
  "dependencies": ["{parentFeature}"],
  "parentFeature": "{parentFeature}",
  "auto": true
}
```

Update `data.updated`. Write backlog JSON back to `backlog.html`.

**backlog:** parse JSON from `<script id="backlog-data">` (see `shared/BACKLOG.md`). Match on `feature.name` (not `id` — the backlog format uses `name` as the unique key). Set `status = "DONE"`, remove `stage` and `transition` (if present). **Verification**: after writing, parse again and verify that status is "DONE". If no match on name: log a warning and stop — silent no-op is a bug.

**project-context.json**: When fixes in PHASE 4: update `architecture.components[]` — merge changed files into component `src`/`test`, confirm `status: "done"`, add test files.

**COMPONENT design sync** (only if `IS_COMPONENT_VERIFY = true`):

Update `project.json#design.components[]` — look up by name, set `status: "DONE"`. Not found → add with status `"DONE"`. Update `project-context.json#components[]` inventory: add test paths to existing inventory item (merge, do not overwrite).

**Reuse-Discovery** (frontend projects only — skip if `IS_COMPONENT_VERIFY = true`, skip if no BROWSER tests were run):

After successful verification of a PAGE-feature where BROWSER-tests were run: scan the test-results and screencap-context for visual patterns that repeat across multiple pages or features. Detect repeating layout blocks (stat cards, list tables, hero section, etc.) with similar structure.

**Dedup**: check `project.json#design.components[]` and `project-context.json#components[]`. Check `feature.json#suggestionsLog[]` — previously rejected from `dev-verify`? → skip.

Candidates found (max 2 per run, to not slow down verify) → AskUserQuestion:

```yaml
header: "Repeating UI patterns"
question: "Visual verification shows patterns reusable as shared components. Create COMPONENT-todos?"
options:
  - label: "{name} — {short visual description}", description: "Create COMPONENT-todo"
  - label: "..." (one per candidate)
  - label: "Skip", description: "No COMPONENT-todos to add"
multiSelect: true
```

Per accepted: append backlog + `design.components[]` (status: IDEA) + `feature.json#suggestionsLog[]` (accepted).
Per rejected: log in `suggestionsLog[]` (rejected, skill: "dev-verify").

#### Step 3b: Learning Extraction

Extract project-wide learnings from the completed feature. Read the just-written `feature.json` and evaluate (mandatory source-tag per source):

- `build.decisions[]` → type `pattern`, source `extracted` (architectural decisions that affect other features)
- `tests.fixSync[]` → type `pitfall`, source `extracted` (bugs with root causes)
- `observations[]` → type `observation`, source `inferred` (cross-feature insights)

**Filter**: only items that are relevant beyond this one feature. Skip feature-specific implementation details.

**Append** to `project-context.json` → `learnings[]`:

```json
{
  "date": "YYYY-MM-DD",
  "feature": "{feature-name}",
  "type": "pattern|pitfall|observation",
  "source": "extracted|inferred",
  "summary": "Max 200 chars summary"
}
```

**Dedup** for each candidate learning:

1. Exact shortcut: same feature + same summary → skip (no Jaccard needed)
2. Tokenize candidate.summary via `shared/LEARNING-EXTRACTION.md` Dedup Tokenizer
3. For each existing learning in `learnings[]` with the same `type`:
   - `Jaccard(candidate.tokens, existing.tokens) >= 0.55` → skip candidate
4. Passes both checks → append

No learnings found → skip step.

#### Step 4: Scoped commit

**Pre-commit diagnostics** (stack-aware, identical to dev-build):

- Read `package.json` → check `scripts` for keys matching `typecheck|type-check|tsc|lint`
- Python project (no package.json): check for `mypy.ini` or `[tool.mypy]` in `pyproject.toml`
- No match found → skip silently

On match: run found script(s) (multiple matches → parallel) via Bash tool with `timeout: 60000`. Compute:
- baseline = set of error-keys (file:line:rule) from `.project/session/pre-skill-lint.txt` (written in PHASE 0 step 5)
- current = set of error-keys from this run
- new_errors = current \ baseline

If new_errors is empty → show `DIAGNOSTICS: PASS`, proceed to git status compare.
If new_errors not empty → show `DIAGNOSTICS: {len(new_errors)} new error(s) introduced` + file:line for each new error. AskUserQuestion:
  - `"Fix now (Recommended)"` — stop Step 4, no commit; user fixes and restarts skill
  - `"Commit anyway"` — proceed; add `[diagnostics-warnings]` to commit message
  - `"Abort"` — cancel commit entirely

(Use set-diff of error-keys, not numeric delta — numeric delta produces false positives when errors shift line numbers due to surrounding edits.)

Compare `git status --porcelain | sort` with `.project/session/pre-skill-status.txt`:

- **NEW** (only in current) → `git add -f` (subdirs like `.project/features/` and `.project/sessions/` are gitignored — `-f` required for session files that fall under them)
- **OVERLAP** (in both, changed by this skill) → `git add -f`
- **PRE-EXISTING** (only in baseline, or overlap not changed by this skill) → do not stage

Baseline not found → fallback `git add -A`.

**Worktree split-commit** — when running inside a worktree (`current_root != main_root`),
`.project/` is a set of symlinks back to the main repo. Staging via the worktree
fails with `pathspec is beyond a symbolic link`. Resolve by splitting the commit:

1. App-code changes (tests, source files in the worktree branch) → stage + commit
   inside the worktree as normal.
2. `.project/` changes (feature.json, backlog.html, project-context.json) → stage
   and commit on main via `git -C {main_root} add -f .project/...` and
   `git -C {main_root} commit -m "..."`.

Use the same commit message body for both, but a distinct subject:
- Worktree: `verify({feature}): {N} requirements verified (...)`
- Main:     `verify({feature}): sync backlog + feature.json + project-context`

**Variables** (count per PHASE 0 classification):

- `{acceptance}` = number of acceptance tests written in PHASE 1 (source: "acceptance")
- `{auto}` = number of items with type AUTO (CLI or BROWSER) — excluding COVERED
- `{manual}` = number of items with type MANUAL
- `{covered}` = number of items with type COVERED (build tests cover the contract)

```bash
git commit -m "verify({feature}): {N} requirements verified ({acceptance} acceptance, {auto} auto, {manual} manual)

Adversarial verification complete.
- Acceptance: {acceptance} | Covered: {covered} | Auto: {auto} | Manual: {manual}
- Spec fixes: {specFixes} | Other fixes: {otherFixes} | Tests added: {count}"
```

Clean up: `rm -f .project/session/pre-skill-status.txt .project/session/pre-skill-lint.txt .project/session/active-{name}.json`

**Output:**

```
VERIFY COMPLETE: {feature-name}

| Dimension         | Score               |
| ----------------- | ------------------- |
| Acceptance Tests  | {pass}/{total} PASS |
| Builder Tests     | {pass}/{total} PASS |
| Spec Issues Fixed | {n}                 |
```

Append a single Next step line (pick the most relevant — do NOT list multiple):
- Worktree finalized in PHASE Finalize → `Next: /dev-refactor {feature-name}` (optional polish on main)
- User chose "Keep open" → omit Next line (finalize prompt already explained the path)
- No worktree + more items in backlog → `Next: /dev-define {next-feature}`
- All else → omit Next line.

Refactor is optional. Skip if scope was small and the feature is clean.

---

## Example Flows

```
# Pure API (fast path, no gaps, no worktree)
/dev-verify api-routes
→ PHASE 0: 6 COVERED + 3 integration AUTO/CLI, acceptance: 0 gaps
→ PHASE 1: 3 integration → 3 PASS
→ PHASE 2b: Compact → 9/9 PASS, evaluation: all REQs PASS
→ PHASE 6: commit
→ Next: /dev-define {next-feature}

# API feature with acceptance test gaps (in worktree)
/dev-verify slider-presets
→ PHASE 0: 6 REQs, builder tests cover unit logic
→ PHASE 0 step 8h: 8 acceptance tests planned (HTTP contract gaps)
→ PHASE 1: write acceptance tests + run → 6 PASS, 2 FAIL
→ PHASE 2b: REQ-002, REQ-005 FAIL on acceptance
→ PHASE 3-4: 2 SPEC issues → Implementation First fixes
→ PHASE 5: re-test → all PASS
→ PHASE 6: evaluation + commit (acceptance tests persistent)
→ PHASE Finalize: solo-merge → worktree removed
→ Next: /dev-refactor slider-presets

# UI feature with fixes (in worktree, keep open for PR)
/dev-verify user-registration
→ PHASE 0: 2 COVERED + 1 AUTO/BROWSER + 1 MANUAL + 2 acceptance → tunnel
→ PHASE 1: AUTO/BROWSER → FAIL, acceptance → 1 FAIL
→ PHASE 2: Manual → PASS
→ PHASE 3-4: 1 SPEC + 1 TESTABLE → fixes
→ PHASE 5: Re-test → all PASS
→ PHASE 6: Fix sync + evaluation + commit
→ PHASE Finalize: PR open → Keep open (PR merges on GitHub)
```

> **Todo**: mark PHASE 6 → `completed`.

---

### PHASE Finalize

> **Todo**: mark PHASE 6 → `completed`, PHASE Finalize → `in_progress`.

**Run only if BOTH true:**
1. All test items PASS (no open fix-loop items)
2. Current branch matches `worktree-*` pattern (`git branch --show-current`)

**PR offer (team-mode only)** — show first, only if ALL true:
1. `.project/project.json#team.mode === "team"` (absent → skip)
2. `gh` on PATH AND `gh auth status` exit 0
3. Clean tree (`git status --porcelain` empty)

If all true → AskUserQuestion:

```yaml
header: "PR openen"
question: "Push + PR openen voor worktree-{feature-name}?"
options:
  - label: "Ja, push + PR (Recommended)"
    description: "Push the branch and open a PR via gh. Worktree stays until merged."
  - label: "Nee, skip PR"
    description: "Skip the PR; show finalize prompt instead."
multiSelect: false
```

On "Ja" → follow `{skills_path}/shared/PR.md`. Print PR URL. Suppress finalize prompt below.
On "Nee" or any precondition fail → fall through to finalize prompt.

**Finalize prompt** — detect PR state first:

```bash
PR_INFO=$(gh pr list --head "$(git branch --show-current)" --state all --json number,url,state --limit 1 2>/dev/null)
PR_STATE=$(echo "$PR_INFO" | jq -r '.[0].state // empty' 2>/dev/null || echo "")
PR_NUMBER=$(echo "$PR_INFO" | jq -r '.[0].number // empty' 2>/dev/null || echo "")
PR_URL=$(echo "$PR_INFO" | jq -r '.[0].url // empty' 2>/dev/null || echo "")
```

| PR_STATE                            | Action                                                                                                                                         |
| ----------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `OPEN`                              | Print: `"PR #{PR_NUMBER} is open: {PR_URL}. Run \`/core-finalize {feature-name}\` zodra gemerged."` No prompt.                                 |
| `MERGED`                            | AskUserQuestion: "PR #{PR_NUMBER} is gemerged ({PR_URL}). Cleanup nu? Worktree + lokale branch worden verwijderd." — Yes/Keep open (see below) |
| empty / `CLOSED` / `gh` unavailable | AskUserQuestion: "Feature '{feature-name}' afgerond. Finalize nu (merge naar main + cleanup)?" — Yes/Keep open (see below)                     |

```yaml
# For MERGED state:
header: "PR merged — cleanup"
question: "PR #{PR_NUMBER} is gemerged ({PR_URL}). Cleanup nu? Worktree + lokale branch worden verwijderd."
options:
  - label: "Yes, cleanup nu (Recommended)"
    description: "Follow shared/FINALIZE.md cleanup-only — verwijder worktree + branch"
  - label: "Keep open"
    description: "Worktree blijft staan (bv. voor follow-up commits); cleanup later via /core-finalize"
multiSelect: false
```

```yaml
# For empty/CLOSED state:
header: "Finalize"
question: "Feature '{feature-name}' afgerond (status: DONE). Finalize nu (merge naar main + cleanup)?"
options:
  - label: "Yes, finalize nu (Recommended)"
    description: "Follow shared/FINALIZE.md solo-mode — merge worktree naar main + cleanup"
  - label: "Keep open"
    description: "Worktree blijft open, finalize later via /core-finalize"
multiSelect: false
```

On MERGED "Yes" → follow `shared/FINALIZE.md` with `mode: cleanup-only`.
On empty/CLOSED "Yes" → follow `shared/FINALIZE.md` with `mode: solo`.
On any "Keep open" → print `💡 Run /core-finalize {feature-name} when ready`.

> **Todo**: mark PHASE Finalize → `completed`.
