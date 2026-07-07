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
> Code quality rules: `.claude/skills/shared/CODING-RULES.md` (R007-R009, T001-T203, TST001-TST203). Frontend projects: also `.claude/skills/shared/FRONTEND-RULES.md`.

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

> **Todo**: call `ToolSearch query="select:TaskCreate,TaskUpdate"` first — both tools are deferred and unusable without their schemas. Then call `TaskCreate` with the 5 mandatory phases (see Workflow above). Mark PHASE 0 → `in_progress` via `TaskUpdate`.

1. **Read backlog**: `node ~/.claude/scripts/backlog-load.js "$REPO" queue DOING verifying` → `{ backlogPresent, items }` (see [shared/BACKLOG-LOAD.md](.claude/skills/shared/BACKLOG-LOAD.md)). Empty `items` → re-run with no transition arg (`queue DOING`) to list all DOING features.

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

3. **Validate build output** — Feature load: `node ~/.claude/scripts/context-load.js "$REPO" feature-verify "{feature-name}"` (see [shared/FEATURE-LOAD.md](.claude/skills/shared/FEATURE-LOAD.md)). Parse `checklist[]` from the output.

   `present: false` or `checklist` empty → check whether `/dev-build` committed it to the worktree-branch but main doesn't have it yet:

   ```bash
   git -C {worktree-path} show HEAD:.project/features/{feature-name}/feature.json 2>/dev/null
   ```

   Output with valid JSON containing `tests.checklist[]` → write it to main's `.project/features/{feature-name}/feature.json` (creates the file from the committed worktree state), then **re-run the `feature-verify` load** so `type` / `checklist` / `requirements` / `files` are loaded into context, and proceed. No worktree, or `git show` empty/invalid → exit: run `/dev-build` first.

   **COMPONENT detection** (after feature.json load): check whether `feature.type === "COMPONENT"` or backlog-item type is COMPONENT. If yes: set `IS_COMPONENT_VERIFY = true`. Resolve render context in this order:
   1. Grep `app/**/page.tsx` for an import matching `{PascalName}` — first match → navigate to that route.
   2. Demo-page fallback: check whether `app/_dev/components/{name}/page.tsx` exists → navigate to `/_dev/components/{name}`.
   3. Neither found → exit: `"No render context for {name}. Options: (a) run /dev-build {feature} to generate a demo-page, or (b) run /design-convert {pageHint} to design a page that uses this component."`

4. **Worktree switch** — execute the procedure in `shared/WORKTREE.md` with `feature-name` and `feature.status` (from Step 1). Switches automatically to `worktree-{feature-name}` if it exists. Includes staleness check (Step 4.6): worktree N commits behind main → offer rebase before proceeding. If no worktree exists but `feature.status === "DOING"`: WARN + AskUserQuestion (see WORKTREE.md → Step 4a: DOING-without-worktree warning). On FAIL (in a different worktree than the feature): stop with the message from WORKTREE.md.

4b. **Symlink integrity gate** — follow `shared/WORKTREE.md → Symlink Integrity Gate (post-switch auto-repair)`. Guards the DOING → DONE backlog write in `references/completion-sync.md`.

5. **Capture baseline** — **MUST** execute all three writes before continuing (PHASE 6's scoped commit and diagnostics-delta read them).

   Run as a single bash block:

   ```bash
   mkdir -p .project/session
   git status --porcelain | sort > .project/session/pre-skill-status.txt
   # Lint baseline (failed lint at baseline → write output, do NOT block, display nothing)
   npm run lint 2>&1 > .project/session/pre-skill-lint.txt || true
   echo '{"skill":"verify"}' | node ~/.claude/scripts/ship-checkpoint.js signal {name}
   ```

   Substitute `npm run lint` with the project's lint script (resolve from `package.json` scripts: `lint` / `check` / `typecheck`; no match → write empty file).

6. **Load stack & project context** — CLAUDE.md stack section + `node ~/.claude/scripts/context-load.js "$REPO" verify` → `{ project, projectContext }` (see [shared/PROJECT-CONTEXT-LOAD.md](.claude/skills/shared/PROJECT-CONTEXT-LOAD.md)). Compose STACK_CONTEXT from the extracted output:

   ```
   STACK CONTEXT:
   Framework: {stack.framework} ({stack.language})
   Testing: {stack.testing}
   Packages: {stack.packages}

   PROJECT CONTEXT:
   Structure: {structure or "not available"}
   Routing: {routing or "not available"}
   Patterns: {patterns or "not available"}
   Endpoints: {endpoints or "not available"}
   Entities: {entities or "not available"}
   ```

   **Conventions** (per [shared/CONVENTIONS.md](.claude/skills/shared/CONVENTIONS.md)): run the status check (`head -1 .project/conventions.md`). When `set`, append to STACK_CONTEXT:

   ```
   Conventions: .project/conventions.md — read it; generated fixes must follow it.
   ```

   `none` or absent → skip silently, no elicitation here.

6b. **Learnings load** (via [shared/LEARNINGS-LOAD.md](.claude/skills/shared/LEARNINGS-LOAD.md)):

    Configuration:

    ```
    scopes: [component]
    pitfall-prefix: true
    current-feature: <feature-name>
    ```

    Display the loaded output. Store pitfall-prefix block as `KNOWN_PITFALLS` for step 7. Pitfalls inform regression-class test cases — tests that explicitly guard against anti-patterns fixed in earlier features. If no pitfalls: `KNOWN_PITFALLS = ""` (graceful degradation — omit block from step 7 prompt).

6c. **CATEGORY-GAP precompute** (mechanically determined from feature.json):

- Set A = `{ (REQ.id, entry.category ?? "happy") | for each REQ (non-REMOVED), for each entry in REQ.acceptance[] }`
- Set B = `{ (item.requirementId, item.category ?? "happy") | for each item in tests.checklist[] }`
- CATEGORY-GAPs = A \ B (combinations defined by dev-define but not written by dev-build)

No gaps → `CATEGORY_GAPS = ""` (omit from step 7 prompt).
Gaps found → format as inline block for step 7:

```
CATEGORY_GAPS:
- {REQ-ID} / {category}: {acceptance.when} → {acceptance.then}
```

7. **Gather test data** via Explore agent on **Sonnet** (`model: "sonnet"`) — zero source file reads in main context.

   > **Todo**: Read '.claude/skills/dev-ship/references/dev-verify/references/explore-agent-prompt.md' for the agent prompt template. Substitute `{feature-name}`, `{STACK_CONTEXT}`, `{KNOWN_PITFALLS}`, `{CATEGORY_GAPS}`, then dispatch. The agent returns a `FEATURE_CONTEXT_START..END` block with per-item COVERED short form or FULL form.

8. **Classify and plan test execution** — baseline run, mode flags (hasUI/isPureAPI/isComponent), token scan, COMPONENT matrix item, cross-requirement integration scenarios, per-item COVERED/AUTO/MANUAL classification, display rules, and goal-backward verification + acceptance test planning.

   > **Todo**: Read '.claude/skills/dev-ship/references/dev-verify/references/test-classification.md' and execute steps a-h. (The baseline `npm test` in step a may run in parallel with the Step 7 Explore agent.)

9. **Dev server** (conditional + actively launched):

   Decide mode based on classification:

   ```
   All non-COVERED items AUTO/CLI (in-process testable)  → skip dev server entirely
   MANUAL, AUTO/BROWSER, or AUTO/CLI with live server    → launch dev server on localhost
   ```

   > **Todo** (only when launch is required): Read '.claude/skills/dev-ship/references/dev-verify/references/dev-server.md' — staleness gate, command resolution, port-identity probe, background launch via Monitor, tunnel note, failure fallback (all non-COVERED → MANUAL), and the PHASE 6 / Finalize cleanup hook for `devServerPid`.

---

### PHASE 1: Automated Testing

> **Todo**: mark PHASE 0 → `completed`, PHASE 1 → `in_progress`.

**Skip** if there are no AUTO items (all non-COVERED items are MANUAL, or everything is COVERED).

Run non-COVERED AUTO items **in the main context** — no subagent. This keeps execution visible and prevents the opaque-hang failure mode of delegating a blocking browser/server test to an agent.

**AUTO/CLI approach selection** (decide per feature type):

- **Pure API / service feature**: write integration test file (node:test / vitest) with mock dependencies and real DB (mongodb-memory-server). Test via service layer, not HTTP.
- **Feature requiring running server**: curl commands against dev server.
- **Build/lint verification**: direct bash commands.

**Execution** — read `references/auto-test-runner.md` for the item-handling spec (test-file path decisions, BROWSER/CLI/acceptance patterns, result format). Then:

1. Write any needed test/spec files per the path decisions in the reference.
2. Run the test command and capture structured output:
   - **Long-running or server-dependent** (Playwright/e2e, anything hitting the dev server) → `Bash` with `run_in_background: true`, writing `--reporter=json` (or equivalent) to `.project/session/auto-test-results.json`. Use `Monitor` to stream progress until the run exits or a timeout fires. The harness re-invokes on exit — a stuck run never hangs silently.
   - **Fast & deterministic** (build, lint, `tsc --noEmit`, in-process unit suite) → a plain synchronous `Bash` with a timeout is enough.
3. Read the result file / output, parse PASS/FAIL per item. A command that errors or never completes → mark the item TOOL_ERROR.

**TOOL_ERROR items** → reclassify as MANUAL.

Display: `AUTO PASS: {n}  AUTO FAIL: {n}  TOOL_ERROR → MANUAL: {n}`

---

### PHASE 1b: Parse Inline Feedback

> **Todo**: mark PHASE 1 → `completed`, PHASE 1b → `in_progress`.

**When:** user provided feedback with `/dev-verify {name} {feedback}` (skips PHASE 1 + 2).

Parse into item/PASS/FAIL/notes. Accept `1:PASS 2:FAIL note` and free text.
Show summary, go to the fix loop (PHASE 3 — read `references/fix-loop.md`).

Unclear feedback → AskUserQuestion: Re-enter (Recommended) | Continue per item | Explain.

---

### PHASE 2: Manual Walkthrough

> **Todo**: mark PHASE 1b → `completed`, PHASE 2 → `in_progress`.

**When:** there are MANUAL items.

> **Todo**: Read '.claude/skills/dev-ship/references/dev-verify/references/manual-walkthrough.md' and execute it (smoke pre-check, per-item walkthrough, Pass/Fail/Skip/Defer). Then continue at PHASE 2b.

---

### PHASE 2b: Combined Results

> **Todo**: mark PHASE 2 → `completed`, PHASE 2b → `in_progress`.

Merge COVERED + automated + manual results.

**Compact** (all PASS or PASS+DEFERRED + COVERED items):

```
TEST RESULT: {feature-name}

BASELINE: npm test → PASS ({n}/{n})
COVERED: {n} items (build tests cover contract)
ACCEPTANCE + INTEGRATION: {n} scenarios → {n} PASS
TOTAL: {n}/{n} PASS ({n} deferred)
{IF acceptance tests ran: Evaluation: {n}/{n} REQs PASS}
```

**Full table** (with FAILs or no COVERED):

```
COMBINED RESULTS: {feature-name}

| # | Test | Type | Result                    |
|---|----- |------|---------------------------|
| 1 | ...  | ...  | ✓ PASS                   |
| 2 | ...  | ...  | ⏸ DEFERRED — {reason}   |
```

With AUTO FAILs → AskUserQuestion: Trust auto results (Recommended) | Check manually.
With SKIPs → AskUserQuestion: Accept (Recommended) | Test later.
With DEFERREDs → no question; auto-include in completion (feature stays DONE with `hasDeferred: true`).

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

All PASS or PASS+DEFERRED → PHASE 5d. FAILs (SPEC or TESTABLE) → fix loop. DEFERRED items skip the fix loop (not failures, just blocked).

---

### PHASE 3 → 5c: Fix Loop (only on FAILs from PHASE 2b)

> **Todo**: Read '.claude/skills/dev-ship/references/dev-verify/references/fix-loop.md' and execute all five phases — PHASE 3 (Categorize Issues), PHASE 4 (Fix Loop with plan-mode gate), PHASE 5 (Re-test), PHASE 5b (Re-test Loop, max 3 attempts per item), PHASE 5c (Regression Check). Then continue at PHASE 5d below.

---

### PHASE 5d: Requirement Verification

> **Todo**: mark the previously-active phase → `completed` and PHASE 5d → `in_progress`. (Previously-active is PHASE 2b for the all-PASS happy path, or PHASE 5c if fixes ran.)

**Skip when:** All tests FAIL. Read `references/requirement-coverage.md` for full classification logic, coverage matrix, per-REQ AskUserQuestion flow, and the complementary mutation-strength measurement.

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

Read `references/completion-sync.md` for full logic: feature.json mutation (all fields in one Write), PAGE-seeding, backlog update, project-context.json sync, COMPONENT design sync, learning extraction (Jaccard dedup), pre-commit diagnostics, commit message format, and output block.

DEFERRED items: write per-item `tests.checklist[i] = { status: "deferred", deferredReason: "<reason>" }`. Set feature.json `tests.hasDeferred = true`. In backlog set feature `status: "DONE"` with `hasDeferred: true` so a future `/dev-verify` run can re-test deferred-only items without reopening the whole feature.

---

### PHASE Finalize

> **Todo**: mark PHASE 6 → `completed`, PHASE Finalize → `in_progress`.

**Run only if BOTH true:**

1. All test items PASS (no open fix-loop items)
2. Current branch matches `worktree-*` pattern (`git branch --show-current`)

> **Todo**: Read '.claude/skills/dev-ship/references/dev-verify/references/finalize.md' for the full flow (ExitWorktree note, auto-dispatch by TEAM_MODE + PR state, session-reorientation guard).

> **Todo**: mark PHASE Finalize → `completed`.
