---
name: dev-refactor
description: Batch refactor DONE features for DRY and clarity. Use with /dev-refactor. Auto-triggers on transition=refactoring.
reads: [feature.build, feature.tests, feature.files, backlog.status, learnings]
writes: [feature.refactor, backlog.status, learnings]
metadata:
  author: claude-config
  version: 2.4.0
  category: dev
---

# Refactor

## Overview

Optional quality step on completed features. Not a status-gate — features are DONE after `/dev-verify`. This skill improves code structure, naming, and patterns on already-finished features.

Batch-first architecture: analyzes ALL features in parallel via Explore agents, triages clean vs dirty, generates stack-aware refactor patterns via Context7, creates one combined plan with one approval, and applies changes with per-feature rollback.

**Trigger**: `/dev-refactor`, `/dev-refactor {feature-name}`, or `/dev-refactor recent` (picks most recently modified feature.json with tests section)

## Scope Rule: Feature Files Only

**This skill ONLY refactors files that belong to the feature.**

- Extract all code file paths from `feature.json` → `files[]` — these are the **pipeline files**
- ONLY these files may be analyzed, planned, and modified
- **NEVER** touch, scan, plan, or modify files outside this list
- **Exception:** New utility/helper files may be **created** if they exclusively extract code from pipeline files (e.g., extracting shared logic into a new `utils/` file). Existing external files may NEVER be modified.
- If a pattern scan or research finding points to an external file → skip it, do not include in plan
- If a DRY violation spans a pipeline file and an external file → only refactor the pipeline file side

## When to Use

- After `/dev-verify` completes (features in DONE status)
- When `.project/features/{name}/feature.json` exists with `tests` section
- NOT for: fixing bugs (/dev-verify), adding features (/dev-define), planning (/dev-define)

## Input

Reads `.project/features/{feature-name}/feature.json` — unified feature file with requirements, architecture, files, build, tests sections.

## Output Structure

Writes only to `.project/features/{name}/feature.json` (enriched: refactor section, status updated).

## Workflow

**Phase tracking** — before pre-flight, call `TaskCreate` with these 6 items (status `pending`), then use `TaskUpdate` to set each phase `in_progress` at the start and `completed` at the end. During context compaction the task list remains visible — no risk of forgotten phases.

1. PHASE 0: Batch Context Loading + Refactor Patterns
2. PHASE 1: Parallel Three-Lens Analysis + Triage
3. PHASE 2: Aggregated Research Decision
4. PHASE 3: Combined Plan + Single Approval
5. PHASE 4: Apply + Test Per Feature
6. PHASE 5: Batch Completion (feature.json writes → learnings (patterns + pitfalls) → sync → commit → archive)

### PHASE 0: Batch Context Loading + Refactor Patterns

> **Todo**: call `TaskCreate` with the 6 phase items (see above). Mark PHASE 0 → `in_progress` via `TaskUpdate`.

**Pre-flight (setup, before numbered steps):**

A. Detect `.project/` tracking mode → cache result in `.project/session/tracking-mode.txt`.

Check whether any `.project/` files are actually tracked by git. Result is cached in `.project/session/tracking-mode.txt` and invalidated when `.gitignore` mtime changes, so repeated runs within the same project skip the `git ls-files` call.

```bash
CACHE_FILE=".project/session/tracking-mode.txt"
GITIGNORE_MTIME=$(stat -f %m .gitignore 2>/dev/null || stat -c %Y .gitignore 2>/dev/null || echo 0)

if [ -f "$CACHE_FILE" ]; then
  CACHED_MTIME=$(head -1 "$CACHE_FILE")
  CACHED_MODE=$(sed -n 2p "$CACHE_FILE")
  if [ "$CACHED_MTIME" = "$GITIGNORE_MTIME" ] && [ -n "$CACHED_MODE" ]; then
    TRACKING_MODE="$CACHED_MODE"
  fi
fi

if [ -z "$TRACKING_MODE" ]; then
  if git ls-files .project/ --error-unmatch 2>/dev/null | head -1 | grep -q .; then
    TRACKING_MODE="tracked"
  else
    echo "tracking: no .project/ files are tracked — shippedSha will be skipped"
    TRACKING_MODE="untracked"
  fi
  mkdir -p .project/session
  printf "%s\n%s\n" "$GITIGNORE_MTIME" "$TRACKING_MODE" > "$CACHE_FILE"
fi
```

If `TRACKING_MODE=untracked`: PHASE 5 omits `shippedSha` and skips the backfill commit (see also completion-batch.md).

- PHASE 5 step 3: omit `shippedSha` field entirely (do not write `""`)
- PHASE 5 step 5: skip the entire backfill + commit step
- Log once: `tracking: .project/ is gitignored — shippedSha skipped`

B. Capture git baseline → `pre-skill-status.txt` (or deferred to after worktree switch if `WT_WILL_SWITCH=1`).

```bash
mkdir -p .project/session
if git show-ref --verify --quiet "refs/heads/worktree-{feature-name}"; then
  WT_WILL_SWITCH=1
  # Defer baseline-write to after worktree-switch — Step 3 writes pre-skill-status-worktree.txt
else
  WT_WILL_SWITCH=0
  git status --porcelain | sort > .project/session/pre-skill-status.txt
fi
echo '{"feature":"{feature-name}","skill":"refactor","startedAt":"{ISO timestamp}"}' > .project/session/active-{feature-name}.json
# Batch mode (queue > 1): use active-batch-{date}.json instead — single active file per run is best-effort tracking only
```

After worktree switch in step 3 (only when `WT_WILL_SWITCH=1`): capture baseline in the worktree:

```bash
git status --porcelain | sort > .project/session/pre-skill-status-worktree.txt
```

PHASE 5.4 compares against `pre-skill-status-worktree.txt` if worktree-switch happened, otherwise against `pre-skill-status.txt`. Exactly one baseline file is written per run.

---

1. **Step 1: Read backlog for pipeline status:**

   Read `.project/backlog.html` (if exists), parse JSON from `<script id="backlog-data">` block (see `shared/BACKLOG.md`):
   - Filter DONE features: `data.features.filter(f => f.status === "DONE" && !f.shipped)`
   - For each DONE feature, check `.project/features/{name}/feature.json` for existing `refactor` section
   - Categorize: `unrefactored` (no refactor section) vs `refactored` (has refactor section)
   - Filter small-items: features with `status === "DONE" && !shipped` where `[ -f .project/features/{name}/feature.json ]` is false — items without pipeline (CHANGE/BUG/PAGE/COMPONENT/etc)

2. **Step 2: Determine feature queue:**

   > **Todo**: Read `.claude/skills/dev-refactor/references/queue-selection.md` to determine mode (feature / small-items / codebase / recent) and build the feature queue, then continue to step 3.

3. **Step 3: Worktree switch** (single-mode only):

   If `feature_queue.length == 1` and not in codebase-mode: execute the procedure in `shared/WORKTREE.md` with the feature-name. Automatically switches to `worktree-{feature-name}` if it exists. On FAIL: stop with the message from WORKTREE.md.

   > **Todo**: follow `shared/WORKTREE.md → Symlink Integrity Gate (post-switch auto-repair)`.

> Steps 4–7 run as a parallel batch — all read-only, no shared data dependency.
> Step 5 (in-memory) runs after step 4 returns.
> Note: refactor-patterns generation is lazy — it runs in PHASE 1 step 0, not here, so patterns aren't generated when all features turn out to be CLEAN.

4. **Step 4: Load ALL feature docs for every feature in queue:**

   For each feature, read `feature.json` — contains requirements, architecture, files, build, tests sections.

   Validate `tests` section exists in `feature.json` for each feature. If missing → remove from queue and warn.

5. **Step 5: Build pipeline files list per feature** (in-memory, after step 4 returns):

   For each feature, extract all code file paths from `feature.json`:
   - Parse `files[]` array (each entry has `path`, `type`, `action`)
   - Store as `pipeline_files[feature_name]`

6. **Step 6: Load project conventions, stack baseline + learnings** (optional, parallel with steps 4 and 7):

   Read `.project/project-context.json` (if exists) and `.claude/research/stack-baseline.md` (if exists) in the same parallel batch. Extract `context.patterns` from project-context.json; store `stack-baseline.md` content as `stack_baseline` for reuse in PHASE 2 step 2 (no re-read needed there).

   **Learnings load** via [shared/LEARNINGS-LOAD.md](../shared/LEARNINGS-LOAD.md):

   ```
   scopes: [feature]
   pitfall-prefix: true
   current-feature: <feature-name if feature-mode, otherwise "none">
   ```

   If available:
   - Add patterns to `PROJECT CONVENTIONS:` section in each Explore agent prompt (PHASE 1)
   - Add pitfall-prefix entries to `KNOWN PITFALLS:` section in each Explore agent prompt (PHASE 1)
   - A `Code maturity: ...` pattern (see `shared/DASHBOARD.md`) automatically steers refactor aggressiveness — included because it is part of `patterns`

7. **Step 7: Build pipeline diff per feature** (optional, parallel with steps 4 and 6, skip for codebase-mode):

For each feature with a known build start time: build a diff string to give agents as a focus hint.

```bash
# Determine start of feature work — widen by one day because --since=YYYY-MM-DD
# excludes commits from that exact date (same-day builds return empty diff otherwise)
start_date=$(date -d "{feature.build.startedAt} -1 day" +%Y-%m-%d 2>/dev/null || \
             date -v-1d -j -f "%Y-%m-%d" "{feature.build.startedAt}" +%Y-%m-%d)
first_hash=$(git log --since="$start_date" --pretty=format:"%H" -- {pipeline_files} | tail -1)

# Diff from that commit to now, scoped to pipeline files
[ -n "$first_hash" ] && git diff ${first_hash}^..HEAD -- {pipeline_files} > /tmp/diff-{feature}.patch
```

**Fallback if diff is empty** (same-day build+refactor, or no startedAt): grep commits by feature name in subject line:

```bash
first_hash=$(git log --oneline --grep="{feature-name}" --pretty=format:"%H" -- {pipeline_files} | tail -1)
```

Store as `pipeline_diff[feature_name]`. If still empty or `startedAt` is missing: skip — agent then only sees the full files.

**Output:** Log feature count, file count, then → Starting parallel analysis...

---

### PHASE 1: Parallel Three-Lens Analysis + Triage

> **Todo**: mark PHASE 0 → `completed`, PHASE 1 → `in_progress`.

**Goal:** Per feature three focused Explore agents in parallel (reuse / quality / efficiency), then merge + triage into CLEAN vs HAS_FINDINGS. Security findings stay in the Quality lens; for deep security review use `/dev-owasp`.

**Lens definitions** (see also `shared/PATTERNS.md` if present):

- **Reuse lens**: DRY within pipeline files, duplication with existing helpers/utilities in the codebase, inline logic that existing lib/stdlib can replace, extract-opportunities
- **Quality lens**: security (injection/XSS/deserialization), cold-reader readability (locality, abstraction-levels, unit-naming, cognitive load, silent errors), control-flow smells (nesting/ternary/dense), over-engineering, stringly-typed, dead code, redundant state, leaky abstractions, `CODING-RULES.md` violations (R007–R009, T001–T203, TST001–TST203) (+ `FRONTEND-RULES.md` for frontend files), stack-specific anti-patterns, Design Token violations (T101–T111 from `shared/TOKENS.md` — frontend files only: `.tsx`/`.jsx`/`.vue`/`.svelte`)
- **Efficiency lens**: missed concurrency (Promise.all), N+1, hot-path bloat, memory leaks, unbounded maps, TOCTOU, overly broad ops, no-op recurring updates

0. **Load or generate refactor-patterns.md** (lazy — deferred from PHASE 0 so patterns are not generated when all features turn out to be CLEAN):

   ```
   IF .claude/research/refactor-patterns.md exists:
     → Load cached patterns, skip Context7
     → Log: "Refactor patterns loaded (cached)"

   IF NOT exists:
     → Detect stack from CLAUDE.md ### Stack section
     → For each library/framework in stack:
        Context7 resolve-library-id → query-docs:
        "Common code smells, anti-patterns, and refactoring opportunities
         in {library} projects. Focus on: performance pitfalls, security
         anti-patterns, common mistakes, and code organization issues."
     → Compile results into .claude/research/refactor-patterns.md
     → Log: "Refactor patterns generated via Context7 ({N} libraries)"
   ```

   **Format for refactor-patterns.md:** sections per library → `## {Library}` → `### Performance/Security/Code Organization Anti-patterns` → `- {pattern}: {description} — {what to look for}`. Header: `<!-- Generated via Context7 for: {stack list} -->`.

   **Timing:** complete this step before launching any lens agents — Explore agents read `refactor-patterns.md` via their own file tools during analysis.

1. **Determine lens strategy per feature:**
   - `pipeline_files[feature].length < 4` → **single-lens mode**: one combined agent with all three lenses in the prompt (splitting yields too little signal for too much token overhead)
   - `length >= 4` → **three-lens mode**: three agents in parallel per feature

   **Concurrency budget:** max 10 concurrent agents total. If `sum(lens_count_per_feature) > 10`: batch features in groups. E.g. 5 features × 3 lenses = 15 → batch 3 features first (9 agents), then the rest.

   **Model default:** all lens-agents run on Sonnet.

2. **Launch agents IN PARALLEL** according to lens strategy (see `shared/SKILL-PATTERNS.md#parallel-dispatch` for dispatch criteria and integration steps).

   **Universal prompt header** (every lens, every mode receives this):

   ````
   Feature: {feature-name}
   Pipeline files:
   {list of pipeline_files paths}

   {if pipeline_diff[feature] exists:}
   FOCUS HINT — these lines are new/changed in this feature; scan
   with priority (but also report issues in other lines):
   ```diff
   {pipeline_diff[feature]}
   ```

   {/if}

   PROJECT CONVENTIONS:
   {context.patterns or "not available — use CLAUDE.md as fallback"}
   If a pattern is consistent with project conventions → do NOT report.
   Note: a pattern with prefix "Code maturity:" indicates how aggressively to refactor — respect the attitude described there (e.g. no over-abstractions for student/prototype projects).

   KNOWN DECISIONS (skip findings that match these — already evaluated in a previous run):
   {feature.json#refactor.decisions[] where action=SKIP, formatted as bullet list, or "none" if empty}

   SCOPE:
   - Analyze ONLY files in the pipeline files list above. Skip findings that involve
     external files or cross-cutting utilities outside that list — even if the fix
     seems obvious. Exception: a NEW utility file may be proposed if it exclusively
     extracts code from pipeline files.

   DISCIPLINE:
   - Max 500 words output. Short, sharp, direct.
   - No nitpicks. Only issues with a clear, concrete fix.
   - Skip false positives explicitly (don't even mention them).
   - Format per finding: `[IMPACT|CATEGORY] file:line — problem description — concrete fix in 1 sentence`

   ```

   **Lens-specific body**: read `references/lens-prompts.md` → section `## REUSE`, `## QUALITY`, or `## EFFICIENCY` for this lens and insert the full section content after the universal header. In single-lens mode (feature <4 files): include all three sections combined under one agent.

   ````

3. **Output format** (each lens-agent returns):

   ```
   ANALYSIS_START
   FEATURE: {name}
   LENS: reuse|quality|efficiency|combined
   STATUS: CLEAN|HAS_FINDINGS
   ARCHITECTURE: libs={list} | patterns={list} | uncovered={list or "-"}
   FINDINGS:
   - [HIGH|SEC] path/file.js:42 — problem — fix
   - [MED|DRY] a.js:10 ↔ b.js:55 — problem — fix
   SKIPPED (balance):
   - path:line — rationale
   POSITIVES:
   - observation
   ANALYSIS_END
   ```

   Impact: `HIGH` (security/breaking/memleak), `MED` (DRY/efficiency/clarity-hotpath), `LOW` (cosmetic). Category: `SEC|DRY|EFF|CLARITY|OVERENG|STACK`.

4. **Merge lens-outputs per feature:**

   For three-lens features: combine the three FINDINGS-lists into one list. Dedup on `file:line + fix` (same issue spotted by multiple lenses → 1 entry, category-tags merged).

   STATUS per feature is derived from the **merged FINDINGS list**, not from the agent's self-reported STATUS:
   - 0 merged findings → `CLEAN`
   - ≥1 merged findings → `HAS_FINDINGS`

   If an agent reports `STATUS: CLEAN` but lists findings, the findings count wins (treat as HAS_FINDINGS). This prevents agents from suppressing legitimate findings via inconsistent self-rating.

5. **Parsing agent results:**

   Per agent:
   1. Find `ANALYSIS_START..ANALYSIS_END` in TaskOutput
   2. If truncated: Grep in output-file, Read with offset
   3. Extract STATUS + FINDINGS + SKIPPED

6. **Triage:**
   - **CLEAN**: STATUS = CLEAN (0 findings merged)
   - **HAS_FINDINGS**: 1+ findings merged

   CLEAN features → **early-exit**, skip PHASE 2-4.

7. **If ALL features CLEAN** → jump directly to PHASE 5 (no approval).

**Output:** Table per feature (name, files, CLEAN/HAS_FINDINGS, finding count) + summary. If all clean → jump to PHASE 5.

---

### PHASE 2: Aggregated Research Decision

> **Todo**: mark PHASE 1 → `completed`, PHASE 2 → `in_progress`.

**Goal:** One research decision for all affected features combined (not per-feature).

**Steps:**

1. **Aggregate architecture info from all HAS_FINDINGS features:**
   - Collect all libraries mentioned in ARCHITECTURE sections
   - Collect all "Uncovered libraries" (not in refactor-patterns.md or stack-baseline.md)
   - Compute: `uncovered = used_libraries - baseline_libraries - refactor_pattern_libraries`

2. **Reuse stack baseline loaded in PHASE 0 step 6** (`stack_baseline` in session memory — no re-read). Note which technologies are already documented.

3. **Decide: is Context7 research needed?**

   | Signal                                                 | Research needed?                        |
   | ------------------------------------------------------ | --------------------------------------- |
   | Stack baseline + refactor-patterns cover all libraries | NO                                      |
   | Findings are concrete, directly actionable             | NO                                      |
   | Uncovered libraries found in analysis                  | YES — research those specific libraries |
   | Complex security concerns (auth, crypto, injection)    | YES — research security best practices  |
   | No stack baseline exists at all                        | YES — research core stack patterns      |

   **If research NOT needed** → proceed directly to PHASE 3.

   **If research needed** → spawn one Explore agent (`subagent_type: Explore`, thoroughness: "very thorough") to do all research in an isolated context. This keeps Context7 results out of the main session.

   Determine which research domains to include based on findings:

   | Domain         | Include when                                        |
   | -------------- | --------------------------------------------------- |
   | Security       | Security patterns found OR auth/crypto/input flows  |
   | Performance    | N+1 patterns, heavy loops, or caching opportunities |
   | Quality        | Complex abstractions or unclear patterns            |
   | Error handling | Missing error handling in critical paths            |

   Agent prompt structure: "Research best practices for a refactoring task. Tech stack: {CLAUDE.md}. Stack baseline: {stack-baseline.md or 'none'}. Aggregated analysis: {ANALYSIS_START..ANALYSIS_END blocks}. Per domain needed — Security/Performance/Quality/Error handling: use resolve-library-id + query-docs, focus on relevant anti-patterns. Return: RESEARCH_START / {domain}: {3-5 bullets} / RESEARCH_END (only included domains)."

   **If uncovered libraries found** → also update refactor-patterns.md:
   - Context7 query for each uncovered library
   - Append new sections to existing refactor-patterns.md

**Output:** Parse `RESEARCH_START...RESEARCH_END`. Log libraries covered (baseline/patterns/uncovered) + research domains used. → Ready for combined plan.

---

### PHASE 3: Combined Plan + Single Approval

> **Todo**: mark PHASE 2 → `completed`, PHASE 3 → `in_progress`.

**Goal:** One plan combining ALL findings from ALL affected features, one user approval (unless `--quick` path).

**Steps:**

1. **Create ranked improvements list:**

   Combine all findings from all HAS_FINDINGS features:
   - **Cross-feature deduplication**: same pattern in multiple files → 1 plan item with multiple locations
   - Each improvement gets impact level: 🔴 HIGH / 🟡 MED / 🟢 LOW (mapped from `[IMPACT|CATEGORY]` tags from PHASE 1 findings)
   - Sort: HIGH first (security, breaking bug, memory leak), then MED (performance, DRY, efficiency), then LOW (clarity, quality, simplification)
   - **Only pipeline files** may be included
   - Group by feature for clarity

2. **Aggregate SKIPPED (balance) entries** from all lens-agents per feature.

   Dedup on `file:line + rationale`. This list shows the user what the skill deliberately **does not** want to fix — so they can override ("fix that one anyway").

3. **Evaluate `--quick` auto-apply path:**

   `--quick` only applies to single-feature runs. Batch invocations
   (queue >1) always go through normal approval — skip to step 4.

   **Trigger (single-feature only):**
   - Explicit: `/dev-refactor --quick {feature}` in user input
   - Auto-detect: ALL conditions true:
     - 0 HIGH-findings (no SEC, no breaking-risk)
     - ≤ 5 total findings (after dedup)
     - No uncovered libraries in ARCHITECTURE block
     - No `Code maturity: library` pattern in `context.patterns`
       (library projects always get approval)

   **Behavior on quick path:**
   - Skip the AskUserQuestion in step 5
   - Show the plan + SKIPPED-list as informational output
   - Jump directly to PHASE 4 with scope = "Apply all"
   - PHASE 5 commit message prefixes `refactor(quick)` instead of `refactor(batch)`/`refactor({feature})`
   - Show "revert" hint in the completion output: `Revert: git reset --hard <hash>` with saved_hash from PHASE 4

   For every explicit `--quick` that does not meet auto-conditions: **fall back** to normal approval-flow + warn in output why (e.g. "--quick ignored: 2 HIGH findings found").

4. **Present improvements with before/after code:**

   Show `REFACTOR PLAN ({N} features, {M} improvements)` — group by feature, each improvement as `🔴/🟡/🟢 {file}:{line} — {issue} → {fix}` with before/after snippet (extract via `sed -n '{start},{end}p'`, max 20 lines). Include "Deliberately not fixed" section for SKIPPED entries. Footer: files to be modified + "Per-feature rollback: YES".

5. **Ask for scope** (skip this step in quick-mode):

   Use **AskUserQuestion** tool (max 4 options — tool limit):
   - header: "Scope"
   - question: "Which improvements do you want to apply? ({M} total across {N} features)"
   - options:
     - label: "Apply all (Recommended)", description: "All {M} improvements in {N} features"
     - label: "Only HIGH + MED", description: "{X+Y} improvements, skip LOW"
     - label: "Only HIGH", description: "{X} improvements, security/breaking only"
     - label: "Choose per feature", description: "Select which improvements you want per feature"
   - multiSelect: false

   The built-in "Other" option handles: (a) cancel — exit with "Refactor cancelled by user"; (b) SKIPPED items — if user requests inclusion of SKIPPED items via Other, run a second AskUserQuestion (multiSelect) with the SKIPPED list and promote selected entries to improvements.

   **If "Choose per feature":** List numbered features with finding counts. Ask for numbers via text input (e.g. `1, 3` or `all`). Non-selected → CLEAN status.

---

### PHASE 4: Apply + Test Per Feature

> **Todo**: mark PHASE 3 → `completed`, PHASE 4 → `in_progress`. Read `.claude/skills/dev-refactor/references/apply-rollback.md` for the full apply + rollback procedure.

**Step 0 — Safety-net pre-flight (per feature, before changes):** Read `.claude/skills/shared/MUTATION-TESTING.md` § dev-refactor PHASE 4 step 0. Run Stryker incremental **with `--force`** (bypasses the stale cache from verify's code state) and compare the current score against `feature.json#tests.mutationScore.score` as baseline. On a drop >0.05, or (no baseline AND score <0.60) → AskUserQuestion whether the refactor may proceed. No auto-rollback here — informative gate. Runner skipped → log and continue without the gate.

Follow `references/apply-rollback.md` — priority order, file tracking, per-feature rollback, and test-failure decision table.

**Output:** Table per feature (name, APPLIED/ROLLED_BACK, improvement count, files modified). → Documenting results...

---

### PHASE 5: Batch Completion

> **Todo**: mark PHASE 4 → `completed`, PHASE 5 → `in_progress`. Read `.claude/skills/dev-refactor/references/completion-batch.md` for the full completion procedure.

Follow `references/completion-batch.md` — feature.json writes, learning extraction, parallel sync, scoped commit, shippedSha backfill, and feature archiving.

> **Todo**: mark PHASE 5 → `completed`.

---

## Error Handling

See `.claude/skills/dev-refactor/references/error-handling.md` for error scenarios per category (context loading, refactor patterns, analysis, test failures, rollback failures).
