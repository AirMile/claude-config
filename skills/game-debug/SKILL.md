---
name: game-debug
description: Debug Godot projects with root cause analysis. Use with /game-debug.
reads: [project-context.learnings, feature.requirements]
writes: [project-context.learnings]
metadata:
  author: claude-config
  version: 3.1.0
  category: game
---

# Debug

Structured 11-phase debugging: context → intake → investigate → analyze → research → fix plans → select → reproduction test → implement → verify → completion.

## Process

**Phase tracking** — first action of the skill: call `TaskCreate` with these 11 items (status `pending`), then use `TaskUpdate` to set each phase `in_progress` at start and `completed` at end. On context compaction the task list remains visible — no risk of forgotten phases.

1. PHASE 0: Context Loading
2. PHASE 1: Problem Intake
3. PHASE 2: Codebase Investigation
4. PHASE 3: Root Cause Analysis
5. PHASE 4: Context7 Research
6. PHASE 5: Fix Plan Generation
7. PHASE 6: Plan Selection
8. PHASE 7: Reproduction Test
9. PHASE 8: Implementation
10. PHASE 9: Verification
11. PHASE 10: Completion

## PHASE 0: Context Loading

> **Todo**: call `ToolSearch query="select:TaskCreate,TaskUpdate"` first — both tools are deferred and unusable without their schemas. Then call `TaskCreate` with the 11 phase items (see above). Mark PHASE 0 → `in_progress` via `TaskUpdate`.

**Stack context** (optional, skip what does not exist):

- Read CLAUDE.md `### Stack` section
- Read `.claude/research/architecture-baseline.md`

**Project context** (optional, skip if not present):

Project context load (via [shared/GAME-CONTEXT-LOAD.md](../shared/GAME-CONTEXT-LOAD.md)):

```
profile: verify
```

Run the two `node -e` snippets for the `verify` profile. Extracts: `stack`, `entities[]` from `project.json`; `structure`, `routing`, `patterns` (max 15), full `architecture` (componentTree, scenes, signals, resources) from `project-context.json`.

**Active feature detection** (optional):

- Check `.project/session/active-*.json` files
- Fallback: Backlog load (via [shared/GAME-BACKLOG-LOAD.md](../shared/GAME-BACKLOG-LOAD.md)):

  ```
  profile: queue
  status: DOING
  ```

  Run the `queue` snippet (no transition filter). Pick the most recently updated entry as the active feature.

- If active feature found:
  - Note as context hint for investigation agents
  - Feature load (via [shared/GAME-FEATURE-LOAD.md](../shared/GAME-FEATURE-LOAD.md)):

    ```
    profile: verify
    feature-name: {feature-name}
    ```

    Run the `verify` snippet. Use `requirements[]` (id + description) as FEATURE_REQUIREMENTS for use in PHASE 3 (spec-vs-impl distinction). `FEATURE_JSON: not present` → skip silently.

**Worktree switch** (only when active feature detected):

If active feature found in previous step, follow `shared/WORKTREE.md → Switch into existing worktree` (Steps 0-4). Debug-mode replaces two of the hard Step 4 outcomes with AskUserQuestion (debug is ad-hoc, not a hard pipeline step):

- `main_root + registered` → AskUserQuestion instead of auto-switch:
  - header: "Worktree"
  - question: "Active feature '{name}' has worktree {short_path}. How to debug?"
  - options:
    - "Switch to worktree (Recommended)" → `EnterWorktree(path: expected_path)`
    - "Standalone on current branch" → skip switch
- `other worktree + registered` → AskUserQuestion instead of hard-fail:
  - header: "Worktree"
  - question: "You are in worktree {pwd_short}, active feature is '{name}' (worktree {expected_short}). How to proceed?"
  - options:
    - "Stay here to debug (Recommended)" → skip switch, debug on current worktree
    - "Switch to feature worktree" → `ExitWorktree(action: "keep")` + `EnterWorktree(path: expected_path)`
    - "Switch to main" → `ExitWorktree(action: "keep")` (only if currently in a worktree; otherwise skip)
- `expected_path + registered` or `main_root + not registered` → follow WORKTREE.md as-is (already there / continue)
- No active feature or no worktree → skip switch, debug runs standalone

**Git baseline** (for scoped commit in PHASE 10):

```bash
mkdir -p .project/session && git status --porcelain | sort > .project/session/pre-debug-status.txt
```

**Load learnings via shared/LEARNINGS-LOAD.md:**

- scopes: [component]
- pitfall-prefix: true
- current-feature: {active feature name, or "none"}

Render LEARNINGS_CONTEXT block. Skip silently if no `project-context.json`.

**Assemble DEBUG_CONTEXT** (all info available for inline investigation):

```
STACK: {engine} ({language}) — {packages}
ARCHITECTURE: {baseline patterns or "not available"}
PATTERNS: {context.patterns or "not available"}
STRUCTURE: {context.structure or "not available"}
ACTIVE FEATURE: {feature name + status or "none"}
REQUIREMENTS: {requirements ids + descriptions, or "not available"}
ENTITIES: {data.entities or "not available"}
KNOWN PITFALLS: {LEARNINGS_CONTEXT output, or "none"}
```

If nothing available → continue without context (backwards compatible).

### Enter Plan Mode

> **Todo**: Use the `EnterPlanMode` tool now — PHASEs 1–6 (problem intake, codebase investigation, root cause analysis, research, fix plan generation, plan selection) benefit from Opus-level reasoning under the `opusplan` router. `AskUserQuestion`, `Read`, `Glob`, `Grep`, `WebSearch`, Context7 MCP, and Agent tools keep working in plan mode; only file writes are blocked — which is fine until PHASE 7 (reproduction test write). Skip `EnterPlanMode` if plan mode is already active (see `shared/PLAN-MODE.md § Entry`).

---

## PHASE 1: Problem Intake

> **Todo**: mark PHASE 0 → `completed`, PHASE 1 → `in_progress`. Read '.claude/skills/game-debug/references/problem-intake.md' for the full intake protocol — classify (Step 1) → per-type detail questions (Step 2) → confirm summary (Step 3).

Outcome: confirmed problem summary (type + symptom + context + details) — input for PHASE 2 investigation. Do not start investigating before the user confirms the summary.

---

## PHASE 2: Codebase Investigation (Explore agent)

> **Todo**: mark PHASE 1 → `completed`, PHASE 2 → `in_progress`.

Spawn one Explore agent (`subagent_type="Explore"`) to investigate in an isolated context. This keeps source file reads and git output out of the main session.

**Thoroughness based on problem type (PHASE 1):**

- Runtime Error with stack trace → `"medium"` (location already known via Godot console)
- Runtime Error without stack trace → `"very thorough"`
- Logic Bug / Performance Issue / Scene-Signal Issue → `"very thorough"` (cause unclear, broad scan)

Agent prompt: Read '.claude/skills/game-debug/references/explore-agent-prompt.md' and fill the `{...}` placeholders from PHASE 0 (DEBUG_CONTEXT) and PHASE 1 (problem summary).

Parse the agent's `INVESTIGATION_START...END` block — only the compact findings enter the main context.

---

## PHASE 3: Root Cause Analysis

> **Todo**: mark PHASE 2 → `completed`, PHASE 3 → `in_progress`.

Analyze:

**Pitfall match shortcut**: if `Pitfall match` in INVESTIGATION_END is present and not "none" → add that hypothesis at the top with confidence "high" as starting point. Still evaluate against evidence — if evidence contradicts, downgrade to "medium" and continue with step 2.

1. Combine findings from all 3 investigation passes
2. Identify patterns and correlations
3. Form hypotheses about root cause
4. Evaluate each hypothesis against evidence
5. Test one hypothesis at a time — never combine multiple fixes in a single verification step
6. Determine most likely root cause
7. Check FEATURE_REQUIREMENTS (from PHASE 0): does the root cause match a requirement that was incorrectly implemented? If so, mark as **spec-issue** — in PHASE 6 fix-thorough is recommended (minimal only resolves the symptom, not the spec deviation).
8. Identify knowledge gaps for PHASE 4

Present findings + hypothesis + confidence (high/medium/low) + spec-issue flag (yes/no) + research topics needed.

---

## PHASE 4: Context7 Research

> **Todo**: mark PHASE 3 → `completed`, PHASE 4 → `in_progress`.

**Skip if**: root cause is purely internal GDScript logic (no Godot engine APIs or add-on libraries involved) → go directly to PHASE 5.

1. `mcp__context7__resolve-library-id` for Godot-related libraries
2. `mcp__context7__query-docs` for:
   - Known bugs/issues related to root cause
   - Best practices for Godot patterns
   - Recommended solutions

Focus: signal patterns → correct usage, scene tree lifecycle → proper node management, physics → collision layers/masks, state machines → proper implementation.

---

## PHASE 5: Fix Plan Generation

> **Todo**: mark PHASE 4 → `completed`, PHASE 5 → `in_progress`.

**Triage gate — skip the fan-out for trivial fixes.** Skip the 3-agent dispatch when ALL of:

- PHASE 3 confidence is **high**
- Fix scope is small: ≤2 files, no signal/scene-contract or autoload API change
- Not marked **spec-issue** (spec deviations need the fix-thorough perspective)

→ Write ONE inline fix plan (minimal-style: smallest change that addresses the root cause) with the same fields the agents return — changes with file:line refs, risk, scope, trade-offs, and the reproduction test assertion. Show: `TRIAGE: trivial fix — inline plan, fan-out skipped`. In PHASE 6: skip Step 1 (strategy question — inline plan is by definition minimal), go directly to Step 2 with the inline plan.

Otherwise, launch 3 agents in parallel:

| Agent         | Philosophy        | Focus                                      |
| ------------- | ----------------- | ------------------------------------------ |
| fix-minimal   | "Smallest change" | Hotfix, minimal risk, fewest changes       |
| fix-thorough  | "Complete fix"    | Root cause, add GUT tests, clean up        |
| fix-defensive | "Preventive"      | Safeguards, null checks, signal validation |

Each receives: root cause analysis + research findings + affected files.
Each returns: specific changes with file:line refs, risk (low/medium/high), scope, trade-offs,
AND: `Reproduction test assertion: {what the GUT test must assert to prove the bug}`

---

## PHASE 6: Plan Selection

> **Todo**: mark PHASE 5 → `completed`, PHASE 6 → `in_progress`.

Present all 3 options with approach, changes count, risk level, and trade-offs.
Include recommendation based on context.

### Step 1: Strategy

**Skip this step when the PHASE 5 triage gate fired** (inline plan is minimal-style by definition) — continue at Step 2 with the inline plan.

AskUserQuestion:

- header: "Fix Strategy"
- question: "Which fix approach do you want to use?"
- options:
  - "Minimal (Recommended for production)" — Smallest change, low risk
  - "Thorough" — Complete fix with root cause + GUT tests
  - "Defensive" — Safeguards and validation against recurrence

### Step 2: Select fixes

**Select Fixes:**

```
Proposed fixes ({M} total):

1. {file:line} — {description}
2. {file:line} — {description}
...
```

Ask: "Which fixes do you want to apply? Give numbers (e.g. `1, 3` or `all`)."

Parse → fix-set.

> **Todo**: Use the `ExitPlanMode` tool once the fix-set is selected — present the chosen strategy and selected fixes (file:line refs) as the plan output. Plan rejection lets the user revise the fix selection. After approval, PHASEs 7–10 (reproduction test, implementation, verification, completion) run in Sonnet. Skip this exit if plan mode is no longer active or the skill was started in plan mode by the user (see `shared/PLAN-MODE.md § Exit`).

---

## PHASE 7: Reproduction Test

> **Todo**: mark PHASE 6 → `completed`, PHASE 7 → `in_progress`.

**Goal**: prove the bug with a failing GUT test before the fix. Makes root cause concrete, prevents regressions, gives objective proof the fix works.

### Step 1: Determine testability

Default for Runtime Error / Logic Bug: skip the question, go directly to Step 2.

For Performance Issue / Scene-Signal Issue, AskUserQuestion:

- header: "Reproduction Test"
- question: "Is this bug testable in an automated GUT test?"
- options:
  - "Yes, write reproduction test (Recommended)" — Standard path for assertable bugs
  - "No, skip — Visual / Rendering" — No assertion on game output possible
  - "No, skip — Performance without FPS threshold" — No concrete measurement definable
  - "No, skip — Production-only state" — Not reproducible in test environment

"Skip" chosen → note `reproductionTest: { skipped: true, reason: "{reason}" }` and go to PHASE 8.

### Step 2: Write failing GUT test

- Location: `tests/regression/test_{slug}.gd`
- Class: `extends GutTest`
- Function name: `func test_{slug}_regression():`
- Assert: the **expected** behavior (not the buggy behavior), use assertion suggestion from PHASE 5
- Setup: reproduce the minimal scene/node state that triggered the bug

### Step 3: Run the test

```bash
godot --headless --path . -s addons/gut/gut_cmdln.gd -gtest=tests/regression/test_{slug}.gd
```

**Expected: FAIL for the right reason** — match against PHASE 3 root cause:

| Result                                        | Reason                                              | Action                  |
| --------------------------------------------- | --------------------------------------------------- | ----------------------- |
| FAIL with assert mismatch matching root cause | Bug correctly reproduced                            | ✓ Continue to PHASE 8   |
| FAIL due to parse/setup error                 | Test itself is broken                               | Fix the test, run again |
| PASS unexpectedly                             | Bug not correctly reproduced or root cause is wrong | Back to PHASE 3         |

### Step 4: Confirm

```
REPRODUCTION TEST: {file}:{function}
Expected fail reason: {root cause from PHASE 3}
Actual fail: {error output, max 5 lines}
Status: ✓ Bug reproduced
```

---

## PHASE 8: Implementation

> **Todo**: mark PHASE 7 → `completed`, PHASE 8 → `in_progress`.

Apply selected fixes from chosen strategy. Document each change with file:line references.

**When reproduction test was written (PHASE 7)**: the concrete success criterion for implementation is that the reproduction test must pass. Do not change more code than needed to make that test green + the original fix-plan scope.

---

## PHASE 9: Verification

> **Todo**: mark PHASE 8 → `completed`, PHASE 9 → `in_progress`.

### Step 1: Reproduction test (skip if PHASE 7 was skipped)

```bash
godot --headless --path . -s addons/gut/gut_cmdln.gd -gtest=tests/regression/test_{slug}.gd
```

- PASS → fix provably works for the reproduced bug
- FAIL → fix incomplete, back to PHASE 8 (max 3 iterations, then AskUserQuestion: Other strategy | More research | Accept as incomplete)

### Step 2: Full GUT suite

**Skip if**: GUT add-on not present (`addons/gut/` does not exist) → go to Step 3.

```bash
godot --headless --path . -s addons/gut/gut_cmdln.gd
```

- New failures → AskUserQuestion: Fix regression (Recommended) | Accept (mark as known) | Rollback fix
- No failures → continue to Step 3

### Step 3: Manual verification (only when PHASE 7 was skipped)

Suggest Godot-specific verification steps based on problem type (play scene, inspector check, Profiler snapshot, etc.).
Ask user to confirm that the fix resolves the original problem.

---

## PHASE 10: Completion

> **Todo**: mark PHASE 9 → `completed`, PHASE 10 → `in_progress`.

### Step 1: Learning Extraction

Per resolved bug, evaluate whether root cause + fix has cross-feature value. Filter:

- **Do extract**: race conditions, signal timing issues, physics layer mismatches, null reference patterns, scene lifecycle bugs, GDScript gotchas
- **Don't extract**: typo fixes, one-off config values, project-specific node paths, merge conflicts

**Append** to `project-context.json` → `learnings[]`:

```json
{
  "date": "YYYY-MM-DD",
  "feature": "{active feature from PHASE 0, or directory primary segment of fix location}",
  "type": "pitfall",
  "source": "extracted",
  "summary": "{root cause + where the fix was, max 200 chars}"
}
```

**Dedup** (per `shared/LEARNING-EXTRACTION.md`): tokenize summary → check against existing `learnings[]` with same `(type, normalize(summary), author)` tuple. Match → skip.

No relevant pitfall → skip step without warning.

### Step 2: Scoped Commit

Follow [shared/SCOPED-COMMIT.md](../shared/SCOPED-COMMIT.md). game-debug deltas:

- **Baseline**: status form — `.project/session/pre-debug-status.txt`.
- **OVERLAP policy**: auto-include (the fix is the point of this run).
- **Fallback**: ask the user which files are related to the fix.
- **Commit**: `fix({feature}): {issue summary from PHASE 1}` with body `Root cause: {summary from PHASE 3}` / `Reproduction test: {path, or 'skipped: {reason}'}` / `Learning: {pitfall summary, or 'none'}`. `{feature}` = active feature from PHASE 0, or omit if standalone debug.
- **Cleanup**: `rm -f .project/session/pre-debug-status.txt`

### Step 3: Output

```
DEBUG COMPLETE: {issue}
========================
Root cause: {summary from PHASE 3}
Fix: {what was changed, file:line refs}
Reproduction test: {path, or "skipped: {reason}"}
Regression: {N tests, X PASS, Y FAIL}
Learning: {pitfall summary added, or "no extraction"}

Next steps:
  1. /game-verify {feature} → re-verify if feature is active
  2. /game-build {feature} → if rebuild is needed
```

> **Todo**: mark PHASE 10 → `completed`.
