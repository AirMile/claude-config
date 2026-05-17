---
name: dev-verify
description: Run adversarial acceptance tests and fix loops. Use with /dev-verify.
reads: [feature.requirements, feature.build, learnings]
writes: [feature.tests, backlog.status]
metadata:
  author: claude-config
  version: "2.5.0"
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
> Code quality rules: `../shared/CODING-RULES.md` (R007-R009, T001-T203). Frontend projects: also `../shared/FRONTEND-RULES.md`.

## Workflow

**Phase tracking** — first action of the skill: call `TaskCreate` with the 5 mandatory phases (status `pending`):

1. PHASE 0: Load Context and Classify
2. PHASE 1: Automated Testing (skip if no AUTO items — mark completed without work)
3. PHASE 2b: Combined Results
4. PHASE 5d: Requirement Verification
5. PHASE 6: Completion

**Worktree check** — after resolving `feature-name` in PHASE 0 Step 1, detect whether a worktree exists for this feature:

```bash
git worktree list --porcelain | grep -q "branch refs/heads/worktree-{feature-name}$"
```

Match → add PHASE Finalize at end via `TaskCreate`. (PHASE Finalize itself decides whether to act based on test outcome — always add it when a worktree exists, regardless of which checkout currently runs the skill.)

Add fix-loop phases via `TaskCreate` ONLY when they will fire:

- Inline feedback provided → add PHASE 1b before PHASE 2b
- MANUAL items in classification → add PHASE 2 before PHASE 2b
- FAILs in PHASE 2b → add PHASE 3, PHASE 4, PHASE 5, PHASE 5b
- Any PHASE 4 fixes touched previously-PASS AUTO items → add PHASE 5c

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

3. **Validate build output** — `.project/features/{feature-name}/feature.json`. Parse `tests.checklist[]`.

   File missing or no `tests.checklist[]` field → check whether `/dev-build` committed it to the worktree-branch but main doesn't have it yet:

   ```bash
   git -C {worktree-path} show HEAD:.project/features/{feature-name}/feature.json 2>/dev/null
   ```

   Output with valid JSON containing `tests.checklist[]` → write it to main's `.project/features/{feature-name}/feature.json` (creates the file from the committed worktree state) and proceed. No worktree, or `git show` empty/invalid → exit: run `/dev-build` first.

   **COMPONENT detection** (after feature.json load): check whether `feature.type === "COMPONENT"` or backlog-item type is COMPONENT. If yes: set `IS_COMPONENT_VERIFY = true`. Look up demo-page: check whether `app/_dev/components/{name}/page.tsx` exists. Not found → exit: `"Demo-page not found. Run /dev-build {feature} again — this generates app/_dev/components/{name}/page.tsx."`. Dev server navigates to `/_dev/components/{name}` instead of the regular feature route.

4. **Worktree switch** — execute the procedure in `shared/WORKTREE.md` with `feature-name` and `feature.status` (from Step 1). Switches automatically to `worktree-{feature-name}` if it exists. If no worktree exists but `feature.status === "DOING"`: WARN + AskUserQuestion (see WORKTREE.md → Step 4a: DOING-without-worktree warning). On FAIL (in a different worktree than the feature): stop with the message from WORKTREE.md.

4b. **Symlink integrity gate** — follow `shared/WORKTREE.md → Symlink Integrity Gate (post-switch auto-repair)`. Guards the DOING → DONE backlog write in `references/completion-sync.md`.

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

6b. **Learnings load** (via [shared/LEARNINGS-LOAD.md](../shared/LEARNINGS-LOAD.md)):

    Configuration:

    ```
    scopes: [component]
    pitfall-prefix: true
    current-feature: <feature-name>
    ```

    Display the loaded output. Store pitfall-prefix block as `KNOWN_PITFALLS` for step 7. Pitfalls inform regression-class test cases — tests that explicitly guard against anti-patterns fixed in earlier features. If no pitfalls: `KNOWN_PITFALLS = ""` (graceful degradation — omit block from step 7 prompt).

7. **Gather test data** via Explore agent on **Sonnet** (`model: "sonnet"`) — zero source file reads in main context:

   ```
   Feature: {feature-name}
   Feature file: .project/features/{feature-name}/feature.json

   {STACK_CONTEXT}

   {KNOWN_PITFALLS}

   Read feature.json (checklist + requirements + build section). Search in source code for:
   - Validation rules, API endpoints relevant to test items
   - Existing test files and test patterns
   - Per requirement (id + acceptance scenarios) — **skip requirements with `deltaOp === "REMOVED"`**: read the source files that implement this REQ
     (feature.json files[] where requirements contain the REQ-ID).
     Determine which acceptance test(s) would verify each scenario.
     Format: `acceptance: [{ when, then }]` — each object = one test scenario.
     (e.g. "201 on success, 400 on >5, 409 on duplicate" = 3 scenarios).
     If the REQ has `errorScenarios[]`: use those directly as adversarial test scenarios — do NOT re-infer fail-paths from acceptance prose.

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
   BROWSER and MANUAL gaps → add items via existing classification (step 8d).

   Display:
   - No gaps → single line: `Acceptance mapping: {n}/{n} REQs covered`
   - Gaps found → single line: `ACCEPTANCE TESTS: {n} test(s) planned for {m} requirement(s) — gaps: {REQ-ID list}`
   - Show full GAP-only table ONLY if {m} >= 3 (helps user scan multiple gaps).

9. **Dev server** (conditional + actively launched):

   Decide modus based on classification:

   ```
   All non-COVERED items AUTO/CLI (in-process testable)  → skip dev server entirely (no launch)
   MANUAL or AUTO/BROWSER items                          → launch dev server + tunnel (user needs externally reachable URL)
   AUTO/CLI with live server required                    → launch dev server on localhost (no tunnel)
   ```

   Launch procedure (when launch is required):
   1. Resolve the dev command in this precedence:
      - `feature.json` → `build.runCommand` (per-feature override)
      - `.project/project.json` → `scripts.dev` (project default)
      - Fallback: `npm run dev`
   2. Probe whether the default port is already serving the project (e.g. `curl -sf http://localhost:3000 -o /dev/null`). Hit → reuse: capture URL, skip launch.
   3. Otherwise start via `Bash` with `run_in_background: true`. Poll the background output via `BashOutput` until a `Local:` / `ready` / `listening on` line appears, then extract the URL. Timeout 30s → graceful fallback.
   4. For MANUAL / AUTO/BROWSER: chain `/project-tunnel` against the captured URL (when the project exposes the tunnel skill). Tunnel-URL replaces localhost in PHASE 2 setup.
   5. Store `{devServerUrl, devServerPid, tunnelUrl}` in `.project/session/active-{name}.json` so PHASE 6 / PHASE Finalize can stop the process.
   6. Display once: `DEV SERVER: {url}` (or `DEV SERVER: {tunnel_url} (tunnel)`).

   On failure (port in use by another project, command not found, ready-line never reached) → graceful fallback:
   - All non-COVERED items become MANUAL, skip PHASE 1.
   - Show: `DEV SERVER: failed to start ({reason}). MANUAL items require the user to start the server themselves — run \`{resolved-command}\` in another terminal, then continue.`

   Cleanup hook: PHASE 6 (Completion) and PHASE Finalize must kill `devServerPid` if the skill launched it (not when reused). Skipped when launch was skipped or reused.

---

### PHASE 1: Automated Testing

> **Todo**: mark PHASE 0 → `completed`, PHASE 1 → `in_progress`.

**Skip** if there are no AUTO items (all non-COVERED items are MANUAL, or everything is COVERED).

Launch Agent to execute non-COVERED AUTO items in a separate context window.

**AUTO/CLI approach selection** (agent decides based on feature type):

- **Pure API / service feature**: write integration test file (node:test / vitest) with mock dependencies and real DB (mongodb-memory-server). Test via service layer, not HTTP.
- **Feature requiring running server**: curl commands against dev server.
- **Build/lint verification**: direct bash commands.

Agent prompt: read `references/auto-test-runner.md` and substitute `{feature-name}`, `{STACK_CONTEXT}`, dev server URL (if running), and the AUTO items list.

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

| Category   | Trigger                                                         | Examples                                     |
| ---------- | --------------------------------------------------------------- | -------------------------------------------- |
| SPEC       | Acceptance test fails — criterion not covered by implementation | Missing validation, wrong format, off-by-one |
| TESTABLE   | Builder test fails — implementation is wrong                    | Logic bug, wrong return value, race          |
| MEASURABLE | Failure has a numeric/visual threshold (timing, CSS, layout)    | Slow render, wrong color, layout-shift       |
| SUBJECTIVE | Criterion is vague ("feels fast", "looks good") — ask user      | UX impressions, taste-level disagreements    |

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

**Skip when:** All tests FAIL. Read `references/requirement-coverage.md` for full classification logic, coverage matrix, and per-REQ AskUserQuestion flow.

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

Skip silently when this session had no MANUAL items AND no PHASE 4 fixes (pure automode, all pass — nothing for user to have noticed).

AskUserQuestion: No, all good (Recommended) | Yes, I noticed something.
"Yes" → ask description, note for feature.json (observations[]).

#### Step 3: 3-File Sync + Learning Extraction + Scoped Commit

Read `references/completion-sync.md` for full logic: feature.json mutation (all fields in one Write), PAGE-seeding, backlog update, project-context.json sync, COMPONENT design sync, Reuse-Discovery, learning extraction (Jaccard dedup), pre-commit diagnostics, worktree split-commit pattern, commit message format, and output block.

---

> **Todo**: mark PHASE 6 → `completed`.

---

### PHASE Finalize

> **Todo**: mark PHASE 6 → `completed`, PHASE Finalize → `in_progress`.

**Run only if BOTH true:**

1. All test items PASS (no open fix-loop items)
2. Current branch matches `worktree-*` pattern (`git branch --show-current`)

**PR offer (team-mode only)** — show first, only if ALL true:

1. `TEAM_MODE === "team"` — read via `shared/PROJECT-MODE.md` read pattern (absent → skip)
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

**Finalize behavior** — follow `shared/FINALIZE.md → Finalize Offer Decision`. Exception: `solo + empty/CLOSED/no-gh` → auto-finalize without prompt (dev-verify owns worktree cleanup at this stage, no modal needed).

```yaml
# MERGED state only:
header: "PR merged — cleanup"
question: "PR #{PR_NUMBER} is gemerged ({PR_URL}). Cleanup nu? Worktree + lokale branch worden verwijderd."
options:
  - label: "Yes, cleanup nu (Recommended)"
    description: "Follow shared/FINALIZE.md cleanup-only — verwijder worktree + branch"
  - label: "Keep open"
    description: "Worktree blijft staan voor follow-up commits"
multiSelect: false
```

On MERGED "Yes" → follow `shared/FINALIZE.md` with `mode: cleanup-only`.
On MERGED "Keep open" → print `💡 Run /dev-refactor {feature-name} on this worktree when ready`.

> **Todo**: mark PHASE Finalize → `completed`.
