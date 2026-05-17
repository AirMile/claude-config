---
name: dev-refactor
description: Batch refactor code quality across DONE features after testing — improves DRY, efficiency, and clarity without changing behavior. Use when the user runs /dev-refactor, asks to "clean up", "refactor", or "tidy" finished features, or when backlog features have transition=refactoring.
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

```
.project/features/{feature-name}/
└── feature.json           # Enriched: refactor section, status updated
```

## Workflow

**Phase tracking** — first action of the skill: call `TaskCreate` with these 6 items (status `pending`), then use `TaskUpdate` to set each phase `in_progress` at the start and `completed` at the end. During context compaction the task list remains visible — no risk of forgotten phases.

1. PHASE 0: Batch Context Loading + Refactor Patterns
2. PHASE 1: Parallel Three-Lens Analysis + Triage
3. PHASE 2: Aggregated Research Decision
4. PHASE 3: Combined Plan + Single Approval
5. PHASE 4: Apply + Test Per Feature
6. PHASE 5: Batch Completion (feature.json writes → learnings → sync → commit → archive)

### PHASE 0: Batch Context Loading + Refactor Patterns

> **Todo**: call `TaskCreate` with the 6 phase items (see above). Mark PHASE 0 → `in_progress` via `TaskUpdate`.

**Pre-flight: detect `.project/` tracking mode** — determines whether `shippedSha` is meaningful.

Check whether any `.project/` files are actually tracked by git (the directory may be in `.gitignore` while individual files remain tracked from before the rule):

```bash
if git ls-files .project/ --error-unmatch 2>/dev/null | head -1 | grep -q .; then
  TRACKING_MODE="tracked"
else
  echo "tracking: no .project/ files are tracked — shippedSha will be skipped"
  TRACKING_MODE="untracked"
fi
```

Implication for PHASE 5 step 4: files under `.project/` may need `git add -f` even when `TRACKING_MODE=tracked` (see step 4 for handling).

If `TRACKING_MODE=untracked`:

- PHASE 5 step 3: omit `shippedSha` field entirely (do not write `""`)
- PHASE 5 step 5: skip the entire backfill + commit step
- Log once: `tracking: .project/ is gitignored — shippedSha skipped`

**Step 0: Capture git baseline** — must run BEFORE worktree switch so subsequent comparison uses the same working tree:

```bash
mkdir -p .project/session
git status --porcelain | sort > .project/session/pre-skill-status.txt
echo '{"feature":"{feature-name}","skill":"refactor","startedAt":"{ISO timestamp}"}' > .project/session/active-{feature-name}.json
# Batch mode (queue > 1): use active-batch-{date}.json instead — single active file per run is best-effort tracking only
```

After worktree switch in step 3: re-capture baseline in the worktree:

```bash
git status --porcelain | sort > .project/session/pre-skill-status-worktree.txt
```

PHASE 5.4 compares against `pre-skill-status-worktree.txt` if worktree-switch happened, otherwise against `pre-skill-status.txt`.

1. **Read backlog for pipeline status:**

   Read `.project/backlog.html` (if exists), parse JSON from `<script id="backlog-data">` block (see `shared/BACKLOG.md`):
   - Filter DONE features: `data.features.filter(f => f.status === "DONE" && !f.shipped)`
   - For each DONE feature, check `.project/features/{name}/feature.json` for existing `refactor` section
   - Categorize: `unrefactored` (no refactor section) vs `refactored` (has refactor section)
   - Filter small-items: features with `status === "DONE" && !shipped` where `[ -f .project/features/{name}/feature.json ]` is false — items without pipeline (CHANGE/BUG/PAGE/COMPONENT/etc)

2. **Determine feature queue:**

   **a) Feature name provided** (`/dev-refactor auth`):
   - Validate feature exists in `.project/features/`
   - Feature queue = `[auth]` (regardless of refactor status)

   **b) No feature name** (`/dev-refactor`):

   **b0) UI-queue detection (check first):**
   - `queued = data.features.filter(f => f.transition === "refactoring" && f.status === "DONE" && !f.shipped)` (see `shared/BACKLOG.md → Lifecycle Protocol`)
   - If `queued.length > 0`:
     - Show: `Backlog: ✓ Task picked up — {names}`
     - **Auto-select if `queued.length <= 3`**: set `feature_queue = queued`, `mode = "feature"`, log `Queue: auto-selected {names}`, jump to **step 3** (worktree-switch). No prompt needed — small queue is always the right choice.
     - **AskUserQuestion only if `queued.length > 3`**:
       - header: "Queue"
       - question: "{N} features marked for refactor: {names}. Use as queue?"
       - options:
         - label: "Yes, use queue (Recommended)", description: "{names}" → `feature_queue = queued`, `mode = "feature"`, jump to **step 3**
         - label: "No, choose different scope" → continue to b1 below
       - multiSelect: false
   - If `queued.length == 0` → continue directly to b1 below.

   **b1) Scope selection** (if no UI-queue or user chose "different scope"):
   - Present scope selection via **AskUserQuestion**:
     - header: "Scope"
     - question: "What do you want to refactor?"
     - options:
       - label: "Not yet refactored features (Recommended)", description: "{N} features: {feature1}, {feature2}, ..."
       - label: "Small items check (CHANGE/BUG/etc)", description: "{K} small items without pipeline: {item1}, {item2}, ... — light convention check, mark as shipped after approval"
       - label: "All DONE features", description: "All {M} DONE features, including previously refactored"
       - label: "Entire codebase", description: "Scan all source files, not feature-bound"
     - multiSelect: false
   - If "Not yet refactored features" → feature queue = unrefactored DONE features, mode = `feature`
   - If "Small items check" → **small-items mode** (see below), mode = `small-items`
   - If "All DONE features" → feature queue = all DONE features, mode = `feature`
   - If "Entire codebase" → **codebase mode** (see below)
   - If 0 unrefactored features: show "All features have already been refactored" in the option description
   - If 0 small-items: show "No small items waiting for check" in the option description

   **c) "recent"**: find most recently modified `feature.json` with `tests` section, queue = `[that feature]`, mode = `feature`

   **Small-items mode** (`--small-items` or via choice):
   - Item queue = all `data.features` with `status === "DONE" && !shipped && !feature.json`
   - For each item: determine scope via git log — find commits with item name in commit message: `git log --oneline --grep="{item.name}" -- {src/}`
   - If no commits found: log warning "No commits found for {name} — skip or check manually", skip the item
   - Scope files = all files changed in those commits: `git diff {first_hash}^..{last_hash} --name-only`
   - Scope rule for small-items: **only files from the commit-scope may be inspected** (no pipeline files list, but commit-diff scope)

   **Small-items PHASE-routing** (skip PHASE 0 steps 3-5, jump directly to PHASE 1):
   - PHASE 1: one light Quality-lens Explore agent per item (not Reuse/Efficiency — those are feature-pipeline specific). Input: commit-diff + `shared/CODING-RULES.md` + (frontend files) `shared/FRONTEND-RULES.md` + `shared/PATTERNS.md` + stack-baseline
   - PHASE 2: skip
   - PHASE 3: combined approval for all items that pass the check: "X items: CLEAN. Mark as shipped?" (one AskUserQuestion, default = Yes)
   - PHASE 4: skip — no code edits for light check (only code edits if Quality-lens has HIGH findings, then normal apply flow)
   - PHASE 5: write `shipped = true`, `shippedAt`, append to `project.json.recentChanges[]`

   **Codebase mode** ("Entire codebase"):
   - Pipeline files = all source files from project (detect `src/` or equivalent from `project-context.json` `context.structure`, or CLAUDE.md)
   - Exclude: `node_modules/`, `.project/`, test files, config files
   - No feature.json writing — save result in `.project/session/codebase-refactor.json`
   - Commit message: `refactor(codebase): {summary}`
   - Skip PHASE 5 feature.json/backlog updates — only commit + report

3. **Worktree switch** (single-mode only):

   If `feature_queue.length == 1` and not in codebase-mode: execute the procedure in `shared/WORKTREE.md` with the feature-name. Automatically switches to `worktree-{feature-name}` if it exists. On FAIL: stop with the message from WORKTREE.md.

   **Symlink integrity gate** (hard check — only when inside a worktree after the switch):

   ```bash
   MAIN_ROOT="$(git worktree list --porcelain | head -1 | awk '{print $2}')"
   if [ "$(git rev-parse --show-toplevel)" != "$MAIN_ROOT" ]; then
     WT_PROJ="$(pwd)/.project"
     FAILED=()
     for f in backlog.html features project.json project-context.json; do
       if ! { [ -L "$WT_PROJ/$f" ] && [ -e "$WT_PROJ/$f" ]; }; then
         FAILED+=("$f")
       fi
     done
     if [ ${#FAILED[@]} -ne 0 ]; then
       echo "ABORT: worktree .project/ symlinks broken/missing: ${FAILED[*]}"
       echo "Re-run shared/WORKTREE.md → ## Shared .project/ via symlink to repair, then resume."
       exit 1
     fi
     echo "GATE: ok — .project/ symlinks intact"
   fi
   ```

   Batch-mode (queue > 1) or codebase-mode: check for open feature worktrees first:

   ```bash
   git worktree list --porcelain | grep "^branch " | grep "refs/heads/worktree-"
   ```

   If any `worktree-*` branches appear → **AskUserQuestion**:

   ```yaml
   header: "Open worktrees"
   question: "Open worktrees found: {list}. Normally /dev-verify closes these — these are leftovers (verify skipped, or 'Keep open' chosen). Batch refactor on main may cause merge conflicts when they're integrated later. What do you want to do?"
   options:
     - label: "Stop — finalize open worktrees first (Recommended)"
       description: "Run /core-finalize for each leftover worktree, then re-run refactor"
     - label: "Continue anyway"
       description: "Refactor on main now — you accept potential merge conflicts later"
   multiSelect: false
   ```

   No open worktrees → proceed on main.

4. **Load ALL feature docs for every feature in queue:**

   For each feature, read `feature.json` — contains requirements, architecture, files, build, tests sections.

   Validate `tests` section exists in `feature.json` for each feature. If missing → remove from queue and warn.

5. **Build pipeline files list per feature:**

   For each feature, extract all code file paths from `feature.json`:
   - Parse `files[]` array (each entry has `path`, `type`, `action`)
   - Store as `pipeline_files[feature_name]`

6. **Load project conventions + learnings** (optional):

Read `.project/project-context.json` (if exists). Extract `context.patterns`.

**Learnings load** via [shared/LEARNINGS-LOAD.md](../shared/LEARNINGS-LOAD.md):

```
scopes: [feature]
pitfall-prefix: true
current-feature: <feature-name if feature-mode, otherwise "none">
```

If available: add to Explore agent prompt in PHASE 1 under
`PROJECT CONVENTIONS:` section (patterns) and `KNOWN PITFALLS:` section (pitfall-prefix + component-scoped). Helps agents distinguish between
"intentional project pattern" and "code smell", and prevents re-introduction of known bugs. One of the patterns may be a
`Code maturity: ...` string (see `shared/DASHBOARD.md` examples) that
steers refactor aggressiveness — it is automatically included because it is part
of `patterns`.

7. **Build pipeline diff per feature** (optional, skip for codebase-mode):

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

8. **Load or generate refactor-patterns.md:**

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

**Output:** Log feature count, file count, refactor-patterns source (cached/generated), then → Starting parallel analysis...

---

### PHASE 1: Parallel Three-Lens Analysis + Triage

> **Todo**: mark PHASE 0 → `completed`, PHASE 1 → `in_progress`.

**Goal:** Per feature three focused Explore agents in parallel (reuse / quality / efficiency), then merge + triage into CLEAN vs HAS_FINDINGS. Security findings stay in the Quality lens; for deep security review use `/dev-owasp`.

**Lens definitions** (see also `shared/PATTERNS.md` if present):

- **Reuse lens**: DRY within pipeline files, duplication with existing helpers/utilities in the codebase, inline logic that existing lib/stdlib can replace, extract-opportunities
- **Quality lens**: security (injection/XSS/deserialization), cold-reader readability (locality, abstraction-levels, unit-naming, cognitive load, silent errors), control-flow smells (nesting/ternary/dense), over-engineering, stringly-typed, dead code, redundant state, leaky abstractions, `CODING-RULES.md` violations (+ `FRONTEND-RULES.md` for frontend files), stack-specific anti-patterns, Design Token violations (T101–T105 from `shared/TOKENS.md` — frontend files only: `.tsx`/`.jsx`/`.vue`/`.svelte`)
- **Efficiency lens**: missed concurrency (Promise.all), N+1, hot-path bloat, memory leaks, unbounded maps, TOCTOU, overly broad ops, no-op recurring updates

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

2. **Read stack baseline:**
   - Read `.claude/research/stack-baseline.md` (if exists)
   - Note which technologies are already documented

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

   **Trigger:**
   - Explicit: `/dev-refactor --quick {feature}` in user input
   - Auto-detect: ALL of these conditions true at the same time:
     - Queue contains exactly 1 feature
     - 0 HIGH-findings (no SEC, no breaking-risk)
     - ≤ 5 total findings (after dedup)
     - No uncovered libraries in ARCHITECTURE block
     - No `Code maturity: library` pattern in `context.patterns` — library projects always get approval

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

> **Todo**: mark PHASE 3 → `completed`, PHASE 4 → `in_progress`.

**Goal:** Apply approved improvements and test, with per-feature rollback isolation.

**Priority order for each feature (execute in this sequence):**

1. Security improvements
2. Performance optimizations
3. Efficiency improvements
4. DRY/Refactoring improvements
5. Simplification (remove over-engineering)
6. Clarity (readability improvements)
7. Code quality improvements
8. Error handling improvements

**Steps:**

1. **Initialize change tracking:**

   ```bash
   git rev-parse HEAD  # Store as saved_hash for global rollback
   ```

2. **For each feature with approved improvements:**

   a. **Track files for targeted rollback** (no git stash needed — file-level tracking is sufficient):

   Initialize empty lists: `modified_files[feature_name] = []`, `created_files[feature_name] = []`

   **Shared files**: detect files that appear in multiple features' pipelines (`shared_files = intersection(pipeline_files[this_feature], pipeline_files[already_applied_features])`). Snapshot each shared file BEFORE editing:

   ```bash
   for file in {shared_files_for_this_feature}; do
     cp "$file" "/tmp/refactor-snapshot-{feature_name}-$(basename $file)"
   done
   ```

   Rollback for shared files uses the snapshot, not `git checkout` (which would also undo preceding features' accepted changes to that file).

   b. **Apply improvements using Edit tool:**
   - Follow priority order strictly
   - **Re-read each file immediately before editing** (prevents "File has not been read yet" errors)
   - Group edits by file: read file → apply ALL edits for that file → move to next file
   - **Pipeline scope only** (see "Scope Rule" top of skill) — assert before each edit
   - Keep changes non-breaking
   - Track: `modified_files[feature_name] = [list of existing files changed]`
   - Track: `created_files[feature_name] = [list of new files created]`

   c. **Run test suite after this feature's changes:**
   - Detect test command from CLAUDE.md `### Testing` section
   - **All pass** → mark feature as APPLIED, continue to next feature
   - **Any fail → analyze before rollback:**

     | Test failure type                                         | Action                     |
     | --------------------------------------------------------- | -------------------------- |
     | Test expects old behavior that was intentionally improved | Update test, re-run        |
     | Genuine regression (broke unrelated functionality)        | Rollback THIS feature only |
     | Flaky or environment-dependent                            | Re-run once, then decide   |

     **If test update needed:**
     - Update ONLY the specific assertion(s)
     - Re-run FULL test suite
     - If still failing → rollback THIS feature only
     - Max 1 test update attempt per failing test

     **Per-feature rollback (only this feature, not others):**

     ```bash
     # Files unique to this feature — restore via git:
     git checkout -- {unique_files_for_this_feature}
     rm -f {created_files[feature_name]}

     # Files shared with already-applied features — restore from snapshot (not git, to preserve prior feature's edits):
     for file in {shared_files_for_this_feature}; do
       cp "/tmp/refactor-snapshot-{feature_name}-$(basename $file)" "$file"
     done
     ```

     Mark feature as ROLLED_BACK with reason. Continue to next feature.

   d. **Report per feature:**

   ```
   ✓ {feature-name}: {N} improvements applied
   ```

   or:

   ```
   ✗ {feature-name}: rolled back ({reason})
   ```

**Non-breaking rule:** Skip improvements that change public signatures, schemas, or remove public APIs. If a breaking change is needed → note it and skip.

**Output:** Table per feature (name, APPLIED/ROLLED_BACK, improvement count, files modified). → Documenting results...

---

### PHASE 5: Batch Completion

> **Todo**: mark PHASE 4 → `completed`, PHASE 5 → `in_progress`.

**Goal:** Proportional documentation, single backlog update, single commit.

1. **Write feature.json per feature** (read-modify-write):

   If N > 1 features: read all `.project/features/{name}/feature.json` in parallel, mutate each in memory, write all back in parallel.

   Add `refactor` section per feature:

   **Always present in refactor:** `status`, `improvements` (object with categories), `decisions[]`, `positiveObservations[]`, `failureAnalysis`, `pendingImprovements[]`.

   **Per status variant:**
   - CLEAN: `refactor.status = "CLEAN"`, empty `improvements`, only `positiveObservations`
   - REFACTORED: `refactor.status = "REFACTORED"`, populated `improvements` per category, `decisions` with rationale
   - ROLLED_BACK: `refactor.status = "ROLLED_BACK"`, `failureAnalysis` (markdown string), `pendingImprovements[]`

   **Decision entry format** — one per balance-filter SKIP or applied improvement:

   `{file:line} — {finding-summary} — {SKIP|APPLY} — {why}`

   Examples:
   - `src/stores/bankroll-store.ts:115 — redundant inner round2() — SKIP — intentional belt-and-suspenders against floating-point drift, see REQ-004`
   - `src/utils/format.ts:23 — duplicate currency formatter — APPLY — extracted to shared/format.ts, 3 callers consolidated`

   SKIP entries MUST be recorded so future refactor runs can dedup against them (agents see existing decisions in PROJECT CONVENTIONS and skip re-reporting).

   **Update top-level feature status:**
   - CLEAN: `status: "DONE"` (unchanged)
   - REFACTORED: `status: "DONE"` (unchanged)
   - ROLLED_BACK: `status: "DONE"` (unchanged — refactor.status documents the rollback)

   Do NOT overwrite existing sections.

2. **Learning extraction** [checkpoint] — REFACTORED/CLEAN only (skip ROLLED_BACK):
   - REFACTORED: `decisions[]` → `pattern/extracted`; `positiveObservations[]` → `observation/inferred`
   - CLEAN: `positiveObservations[]` → `observation/inferred`
   - Filter: cross-feature relevance only. No `pitfall` type — refactor does not discover bugs.
   - Schema/dedup: same as dev-verify completion-sync.md § Step 3b (Jaccard 0.55).
   - Append to `project-context.json → learnings[]` (written in step 3). Log confirmation or "no learnings — skip".

3. **Parallel sync** — follow `shared/SYNC.md` 3-File Sync Pattern. Read backlog.html + project.json + project-context.json in parallel.

   **Backlog**: per feature → CLEAN/REFACTORED: `f.refactor="REFACTORED"`, `f.shipped=true`, `f.shippedAt`, `f.shippedSha=""` (omit if untracked), remove `transition`. ROLLED_BACK: `f.refactor="ROLLED_BACK"`, remove `transition`. Set `data.updated`.

   **Dashboard**: merge changed packages/endpoints/entities. Features: set `refactor`/`shipped`/`shippedAt`/`shippedSha` analogous. Small-items mode: add to `recentChanges[]`.

   **Context sync** (only if structural changes: files renamed/moved/extracted, patterns fundamentally changed): update `context.structure`, `context.patterns`, `context.updated`, `architecture.components` (see `shared/DASHBOARD.md` for edge types). Log `context: {N} updates` or `context: no updates needed`.

   Write back in parallel: Edit backlog.html (keep `<script>` tags), Write project.json, Write project-context.json.

4. **Scoped auto-commit** (only this skill's changes):

   Compare `git status --porcelain | sort` with baseline from PHASE 0 (`pre-skill-status-worktree.txt` if worktree-switch, else `pre-skill-status.txt`). Guard: skip commit if diff is empty + no new staged files.

   Stage: NEW → `git add`, OVERLAP → AskUserQuestion (Include/Skip), PRE-EXISTING → skip. `.project/` files: use `git add -f` (may be gitignored-but-tracked). Fallback: `git add -A` if no baseline.

   Batch commit: `refactor(batch): {summary}` with per-feature lines (REFACTORED/CLEAN/ROLLED_BACK). Single-feature: `refactor({feature}): {summary}`.

   Clean up session files after commit.

5. **Backfill shippedSha** — skip entirely if `TRACKING_MODE=untracked`. Otherwise:

   ```bash
   SHA=$(git rev-parse HEAD)
   ```

   a. Read `backlog.html` + `project.json` again
   b. Replace empty `shippedSha: ""` for CLEAN/REFACTORED features with `SHA`
   c. Write back
   d. Stage and commit:

   ```bash
   git add .project/backlog.html .project/project.json
   git commit -m "chore(refactor): backfill shippedSha for {feature-list}"
   ```

   If the PHASE 5 step-4 commit was skipped (nothing to commit), use the pre-skill HEAD as `SHA` — still create the backfill commit.

6. **Feature archiving** (only features with `feature.json`, not small items without pipeline):

For each CLEAN or REFACTORED feature where `.project/features/{name}/feature.json` exists:

```bash
mkdir -p .project/features/archive
mv .project/features/{name}/ .project/features/archive/{shippedAt-date}-{name}/
```

- `{shippedAt-date}` = the date from the just-written `shippedAt` field (YYYY-MM-DD format)
- Multiple features in one run → each to its own archive-dir
- ROLLED_BACK features: do not archive (stay in `.project/features/`)
- Skip if feature-dir no longer exists (idempotent)

7. **Show completion:** Print `REFACTOR COMPLETE` with per-feature ✓/✗ lines (name, status, improvement count). Next steps: /dev-define → next feature, /project-backlog → revise scope.

   **PHASE Finalize** (single-mode only — skip if `feature_queue.length > 1`): follow `shared/FINALIZE.md → Finalize Offer Decision` (TEAM_MODE + PR-state dispatch). Team mode never auto-solo-merges.

> **Todo**: mark PHASE 5 → `completed`.

---

## Error Handling

### Context Loading Failures

**No features found** → exit: "Run /dev-define and /dev-build first"
**No test results for any feature** → exit: "Run /dev-verify first"
**Some features missing test results** → remove from queue, warn, continue with rest
**No files in feature** → skip feature, warn: "No code files found in feature.json for {feature}"

### Refactor Patterns Failures

**Context7 unavailable** → skip refactor-patterns generation, proceed with universal patterns only
**Partial Context7 results** → generate refactor-patterns.md with available data, note gaps
**CLAUDE.md has no ### Stack section** → skip stack-specific patterns, use universal only

### Analysis Failures

**Explore agent fails for a feature** → skip that feature, warn, continue with rest
**All Explore agents fail** → exit: "Analysis failed — try again or run on a single feature"
**Agent output truncated** → use Grep/Read to find ANALYSIS_START..ANALYSIS_END block

### Test Failures

**Tests fail after refactoring a feature** → per-feature rollback, continue with next feature
**Test framework not detected** → ask user which command to run
**Tests hang** → kill process, rollback current feature

### Rollback Failures

**git checkout fails for feature files** → report manual recovery steps:

1. Show the `saved_hash` from PHASE 4 step 1
2. List all `modified_files[feature_name]` and `created_files[feature_name]`
3. Suggest: `git reset --hard <saved_hash>` to restore to the pre-refactor state
4. STOP — do not attempt destructive recovery commands
