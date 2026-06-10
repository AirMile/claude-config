---
name: dev-verify
description: Run adversarial acceptance tests and fix loops on a built feature — classifies test items (COVERED/AUTO/MANUAL), runs auto-tests, walks user through manual ones, fixes failures, and finalizes the worktree. Use with /dev-verify, or auto-triggers when a feature has transition=verifying after /dev-build completes.
reads: [feature.requirements, feature.build, project-context.learnings]
writes: [feature.tests, backlog.status, project-context.learnings]
metadata:
  author: claude-config
  version: "2.10.0"
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
> Code quality rules: `../shared/CODING-RULES.md` (R007-R009, T001-T203, TST001-TST203). Frontend projects: also `../shared/FRONTEND-RULES.md`.

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

1. **Read backlog** — read `.project/backlog.json` → parse JSON (see `shared/BACKLOG.md → Lifecycle Protocol → Read`).

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

3. **Validate build output** — Feature load (via [shared/FEATURE-LOAD.md](../shared/FEATURE-LOAD.md)):

   ```
   profile: verify
   feature-name: {feature-name}
   ```

   Run the `verify` snippet. Parse `checklist[]` from the output.

   `FEATURE_JSON: not present` or `checklist` empty → check whether `/dev-build` committed it to the worktree-branch but main doesn't have it yet:

   ```bash
   git -C {worktree-path} show HEAD:.project/features/{feature-name}/feature.json 2>/dev/null
   ```

   Output with valid JSON containing `tests.checklist[]` → write it to main's `.project/features/{feature-name}/feature.json` (creates the file from the committed worktree state), then **re-run the FEATURE-LOAD `verify` snippet** so `type` / `checklist` / `requirements` / `files` are loaded into context, and proceed. No worktree, or `git show` empty/invalid → exit: run `/dev-build` first.

   **COMPONENT detection** (after feature.json load): check whether `feature.type === "COMPONENT"` or backlog-item type is COMPONENT. If yes: set `IS_COMPONENT_VERIFY = true`. Resolve render context in this order:
   1. Grep `app/**/page.tsx` for an import matching `{PascalName}` — first match → navigate to that route.
   2. Demo-page fallback: check whether `app/_dev/components/{name}/page.tsx` exists → navigate to `/_dev/components/{name}`.
   3. Neither found → exit: `"No render context for {name}. Options: (a) run /dev-build {feature} to generate a demo-page, or (b) run /frontend-design {pageHint} to design a page that uses this component."`

4. **Worktree switch** — execute the procedure in `shared/WORKTREE.md` with `feature-name` and `feature.status` (from Step 1). Switches automatically to `worktree-{feature-name}` if it exists. Includes staleness check (Step 4.6): worktree N commits behind main → offer rebase before proceeding. If no worktree exists but `feature.status === "DOING"`: WARN + AskUserQuestion (see WORKTREE.md → Step 4a: DOING-without-worktree warning). On FAIL (in a different worktree than the feature): stop with the message from WORKTREE.md.

4b. **Symlink integrity gate** — follow `shared/WORKTREE.md → Symlink Integrity Gate (post-switch auto-repair)`. Guards the DOING → DONE backlog write in `references/completion-sync.md`.

5. **Capture baseline** — **MUST** execute all three writes before continuing. PHASE 6 step 3 (scoped commit) reads these files to compute precise diagnostics-deltas and stage only skill-introduced changes. Skipping forces a less-accurate `git add -A` fallback.

   Run as a single bash block:

   ```bash
   mkdir -p .project/session
   git status --porcelain | sort > .project/session/pre-skill-status.txt
   # Lint baseline (failed lint at baseline → write output, do NOT block, display nothing)
   npm run lint 2>&1 > .project/session/pre-skill-lint.txt || true
   echo '{"feature":"{name}","skill":"verify","startedAt":"{ISO}"}' > .project/session/active-{name}.json
   ```

   Substitute `npm run lint` with the project's lint script (resolve from `package.json` scripts: `lint` / `check` / `typecheck`; no match → write empty file).

6. **Load stack & project context** — CLAUDE.md stack section + project context via [shared/PROJECT-CONTEXT-LOAD.md](../shared/PROJECT-CONTEXT-LOAD.md):

   ```
   profile: verify
   ```

   Run the two `node -e` snippets for the `verify` profile. Compose STACK_CONTEXT from the extracted output:

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

6b. **Learnings load** (via [shared/LEARNINGS-LOAD.md](../shared/LEARNINGS-LOAD.md)):

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

   > **Todo**: Read '.claude/skills/dev-verify/references/explore-agent-prompt.md' for the agent prompt template. Substitute `{feature-name}`, `{STACK_CONTEXT}`, `{KNOWN_PITFALLS}`, `{CATEGORY_GAPS}`, then dispatch. The agent returns a `FEATURE_CONTEXT_START..END` block with per-item COVERED short form or FULL form.

8. **Classify and plan test execution** — baseline run, mode flags (hasUI/isPureAPI/isComponent), token scan, COMPONENT matrix item, cross-requirement integration scenarios, per-item COVERED/AUTO/MANUAL classification, display rules, and goal-backward verification + acceptance test planning.

   > **Todo**: Read '.claude/skills/dev-verify/references/classify-and-plan.md' and execute steps a-h. (The baseline `npm test` in step a may run in parallel with the Step 7 Explore agent.)

9. **Dev server** (conditional + actively launched):

   Decide mode based on classification:

   ```
   All non-COVERED items AUTO/CLI (in-process testable)  → skip dev server entirely
   MANUAL, AUTO/BROWSER, or AUTO/CLI with live server    → launch dev server on localhost
   ```

   Launch procedure (when launch is required): 0. **Pre-launch staleness gate** — `git -C {worktree-path} rev-list --count HEAD..main`. If > 0: the worktree is N commits behind main; deps/assets that landed on main since branch-off (fonts, packages, public/) will be missing and the server may crash on first request. AskUserQuestion: "Rebase worktree op main eerst? (Recommended) | Launch zonder rebase (kan crashen) | Stop". On "Rebase" → invoke `shared/WORKTREE.md → Staleness rebase` and re-run this check. On "Launch zonder rebase" → continue but tag the eventual output line: `DEV SERVER (stale, {n} commits behind): {url}`. On "Stop" → abort with a clear message; user resolves manually.
   1. Resolve the dev command in this precedence:
      - `feature.json` → `build.runCommand` (per-feature override)
      - `.project/project.json` → `scripts.dev` (project default)
      - Fallback: `npm run dev`
   2. Probe the default port (e.g. `curl -sf http://localhost:3000 -o /dev/null`):
      - **Miss** → proceed to item 3 (launch).
      - **Hit** → do NOT silently reuse. Verify the running server is the worktree project: check the process's cwd (`lsof -p <pid> | grep cwd` or `pwdx <pid>`) or compare its git HEAD to the worktree branch. If confirmed worktree → reuse the URL, skip launch. If main or another project is serving → kill that process or pick a free port (e.g. 3001) and launch from the worktree. Never proceed to MANUAL tests against a server whose branch identity is unverified — that produces valid-looking PASSes on the wrong codebase.
   3. Otherwise start via `Bash` with `run_in_background: true`. Use the `Monitor` tool to stream the background process's output until a `Local:` / `ready` / `listening on` line appears, then extract the URL. Timeout 30s → graceful fallback.
   4. Store `{devServerUrl, devServerPid}` in `.project/session/active-{name}.json` so PHASE 6 / PHASE Finalize can stop the process.
   5. Display once: `DEV SERVER: {url}`.

   **Tunnel (team-mode only):** when `TEAM_MODE === "team"` AND there are MANUAL items, append a one-liner after the launch: `💡 Stakeholder review? Run /project-tunnel {url} to expose this.` Do NOT auto-launch — the user decides.

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

**When:** there are MANUAL items. By definition MANUAL = human perception/judgment, auth with real credentials, physical-device tests, or audio/screen-reader checks. Visual polish, motion smoothness, and design feel are NOT verified here — those belong to frontend-design / frontend-build.

**Playwright smoke pre-check** — for each MANUAL item: if the item is DOM-observable (navigate + check load / element-present / no-console-error / screenshot), Claude runs it first via the playwright-cli daemon (see `references/test-classification.md → AUTO/BROWSER`):

- Pass + clear screenshot → present screenshot as evidence, AskUserQuestion: Confirm Pass (Recommended) | Mark Fail | Inspect manually
- Fail / error → skip to the per-item walkthrough below with the failure as context

Only items that need real human judgment (auth flows requiring real credentials, perception, audio, physical-device) skip the smoke pre-check entirely.

Show setup once (e.g. "Open {devServerUrl}"). Per MANUAL item (if smoke skipped or smoke failed):

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

AskUserQuestion per item: Pass (Recommended) | Fail | Skip | Defer.

- Fail → ask briefly what went wrong
- Skip → note reason ("not testing, accept as-is")
- Defer → ask which external prereq blocks it (account, CORS-origin, API-token, third-party config); item stays open for re-test when prereq landed

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

All PASS or PASS+DEFERRED → PHASE 6. FAILs (SPEC or TESTABLE) → PHASE 3. DEFERRED items skip PHASE 3/4 (not failures, just blocked).

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

- **SPEC / TESTABLE** → **Fix** — reproduce the failure with a failing test (RED), then fix (GREEN). For SPEC items the failing test is the acceptance test (write/update it).
- **MEASURABLE** → **Direct Fix** — config/styling/timing tweak, no test loop.
- Default → Fix

Display technique map:

```
| Item | Issue | Type | Technique | Reason |
```

---

### PHASE 4: Fix Loop

> **Todo**: mark PHASE 3 → `completed`, PHASE 4 → `in_progress`.

#### Plan-mode gate (OpusPlan-friendly)

Before starting fixes, decide whether to enter plan mode first.

Auto-enter plan mode (no question) when ANY:

- ≥1 SPEC bug (acceptance criterion not met — needs design)
- ≥2 TESTABLE bugs that touch the same file or module (likely shared root cause)
- A bug whose root cause is unclear after PHASE 3 categorization

Skip plan mode silently when ALL:

- Only MEASURABLE bugs (direct config/styling/timing tweaks)
- ≤1 TESTABLE bug with an obvious root cause from the failing test

When entering plan mode: call `EnterPlanMode`, write the fix plan to the plan file (one section per bug: problem → root cause → proposed fix → verification), then `ExitPlanMode` for approval. After approval, continue with the Fix step below. Rejected plan → re-categorize or ask user.

Show before entering: `PLAN MODE: {n} bug(s) need design — entering plan mode (OpusPlan-aware).`

#### Fix

Complex issues → AskUserQuestion: Research via Context7 (Recommended) | Fix directly.

Reproduce the failure with a test (RED), then fix (GREEN). Max 3 attempts, then ask user. For SPEC items the reproducing test is the acceptance test.

```
[FIX] Item {N}: {title}
Technique: Fix | Type: {AUTO|MANUAL}
RED: FAIL ({what})  GREEN: PASS
SYNC: Root cause: {file:line}. Fix: {approach}. Impact: {scope}.
```

Test already passes → AskUserQuestion: Skip (Recommended) | Adjust test | Check manually.

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

**Max 3 fix attempts per item.** After the 3rd failed re-test of the same item, stop looping for that item and AskUserQuestion: "Accept anyway" | "Escalate to manual root-cause analysis (/dev-debug)". This prevents an unbounded PHASE 3 → 5 → 5b cycle.

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

> **Todo**: Read `.claude/skills/dev-verify/references/quality-gates.md` for the full PHASE 5d quality-gate workflow (mutation-strength measurement, PBT gap-check, counterexample-capture, test-smell review, flakiness-check, survivor×flaky correlation, aggregate verdict).

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

DEFERRED items: write per-item `tests.checklist[i] = { status: "deferred", deferredReason: "<reason>" }`. Set feature.json `tests.hasDeferred = true`. In backlog set feature `status: "DONE"` with `hasDeferred: true` so a future `/dev-verify` run can re-test deferred-only items without reopening the whole feature.

---

> **Todo**: mark PHASE 6 → `completed`.

---

### PHASE Finalize

> **Todo**: mark PHASE 6 → `completed`, PHASE Finalize → `in_progress`.

**Run only if BOTH true:**

1. All test items PASS (no open fix-loop items)
2. Current branch matches `worktree-*` pattern (`git branch --show-current`)

> **Note on ExitWorktree:** FINALIZE.md instructs `ExitWorktree(action: keep)` before merging. This is a no-op when the worktree is the primary CWD (i.e. dev-verify was invoked directly in the worktree, not via EnterWorktree this session) — the tool reports "no worktree session active" and returns. Skip the ToolSearch round-trip in that case and proceed directly to the merge via `git -C {main_root}`.

**PR offer (team-mode only)** — show first, only if ALL true:

1. `TEAM_MODE === "team"` — read via `shared/PROJECT-MODE.md` read pattern (absent → skip)
2. `gh` on PATH AND `gh auth status` exit 0
3. Clean tree (`git status --porcelain` empty)

If all true → AskUserQuestion:

```yaml
header: "Open PR"
question: "Push + open PR for worktree-{feature-name}?"
options:
  - label: "Yes, push + PR (Recommended)"
    description: "Push the branch and open a PR via gh. Worktree stays until merged."
  - label: "No, skip PR"
    description: "Skip the PR; show finalize prompt instead."
multiSelect: false
```

On "Yes" → follow `{skills_path}/shared/PR.md`. Print PR URL. Suppress finalize prompt below.
On "No" or any precondition fail → fall through to finalize prompt.

**Finalize behavior** — follow `shared/FINALIZE.md → Finalize Offer Decision`.

**Session-reorientation guard (cleanup-path only)** — When the cleanup procedure is about to remove the worktree directory:

1. **Pre-cleanup cd** — if `pwd` is inside `{worktree-path}`, run `cd {main-repo-path}` via Bash before `git worktree remove`. Prevents "working directory was deleted; shell cwd recovered" warnings and ensures subsequent Bash commands operate on main.
2. **Post-cleanup banner** — after successful cleanup, print:

   ```
   🏠 Worktree removed. Working directory: {main-repo-path}
      Branch: main. Next /dev-* commands run on main.
      (Terminal tab may still show the old worktree name — that is cosmetic.)
   ```

3. Skip both steps when cleanup doesn't fire (PR-path without cleanup, or "Keep open" chosen).

```yaml
# MERGED state only:
header: "PR merged — cleanup"
question: "PR #{PR_NUMBER} has been merged ({PR_URL}). Clean up now? Worktree + local branch will be removed."
options:
  - label: "Yes, cleanup now (Recommended)"
    description: "Follow shared/FINALIZE.md cleanup-only — remove worktree + branch"
  - label: "Keep open"
    description: "Worktree stays for follow-up commits"
multiSelect: false
```

On MERGED "Yes" → follow `shared/FINALIZE.md` with `mode: cleanup-only`.
On MERGED "Keep open" → print `💡 Run /dev-refactor {feature-name} on this worktree when ready`.

> **Todo**: mark PHASE Finalize → `completed`.
