---
name: dev-refactor
description: Batch refactor DONE features for DRY and clarity. Use with /dev-refactor. Auto-triggers on transition=refactoring.
reads:
  [
    feature.build,
    feature.tests,
    feature.files,
    backlog.status,
    project-context.learnings,
    conventions,
  ]
writes: [backlog.status, project-context.learnings, conventions]
writes-terminal: [feature.refactor]
metadata:
  author: claude-config
  version: 2.7.0
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
2. PHASE 1: Parallel Lens Analysis + Triage
3. PHASE 2: Aggregated Research Decision
4. PHASE 3: Combined Plan + Single Approval
5. PHASE 4: Apply + Test Per Feature
6. PHASE 5: Batch Completion (feature.json writes → learnings (patterns + pitfalls) → sync → commit → archive)

### PHASE 0: Batch Context Loading + Refactor Patterns

> **Todo**: call `ToolSearch query="select:TaskCreate,TaskUpdate"` first — both tools are deferred and unusable without their schemas. Then call `TaskCreate` with the 6 phase items (see above). Mark PHASE 0 → `in_progress` via `TaskUpdate`.

**Pre-flight (setup, before numbered steps):**

```bash
mkdir -p .project/session
```

The active-feature signal file is written in step 3 — in no-arg mode the feature name (or queue) is only known after step 2. The git baseline (`pre-skill-status.txt`) is also captured in step 3, **after** the potential worktree switch, so the baseline always describes the tree the skill actually mutates.

---

1. **Step 1: Read backlog for pipeline status:**

   Read `.project/backlog.json` (if exists), parse JSON (see `shared/BACKLOG.md`):
   - Filter DONE features: `data.features.filter(f => f.status === "DONE" && !f.shipped)`
   - For each DONE feature, check `.project/features/{name}/feature.json` for existing `refactor` section
   - Categorize: `unrefactored` (no refactor section) vs `refactored` (has refactor section)
   - Filter small-items: features with `status === "DONE" && !shipped` where `[ -f .project/features/{name}/feature.json ]` is false — items without pipeline (CHANGE/BUG/PAGE/COMPONENT/etc)

2. **Step 2: Determine feature queue:**

   - **Name provided** (`/dev-refactor auth`): validate the feature exists in `.project/features/`; queue = `[auth]` (regardless of refactor status), mode = `feature` → step 3.
   - **"recent"**: most recently modified `feature.json` with a `tests` section; queue = that feature, mode = `feature` → step 3.
   - **No argument**:
     > **Todo**: Read `.claude/skills/dev-refactor/references/queue-selection.md` (UI-queue detection → scope selection → small-items mode), build the queue, then continue to step 3.

3. **Step 3: Worktree switch + git baseline:**

   If `feature_queue.length == 1`: execute the procedure in `shared/WORKTREE.md` with the feature-name. Automatically switches to `worktree-{feature-name}` if it exists. On FAIL: stop with the message from WORKTREE.md.

   > **Todo**: follow `shared/WORKTREE.md → Symlink Integrity Gate (post-switch auto-repair)`.

   Then (all modes) capture the git baseline in the tree the skill will mutate, and signal the active feature:

   ```bash
   git status --porcelain | sort > .project/session/pre-skill-status.txt
   echo '{"feature":"{feature-name}","skill":"refactor","startedAt":"{ISO timestamp}"}' > .project/session/active-{feature-name}.json
   # Batch mode (queue > 1): use active-batch-{date}.json instead — single active file per run is best-effort tracking only
   ```

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

6. **Step 6: Load project conventions file, patterns, stack baseline + learnings** (optional, parallel with steps 4 and 7):

   Read `.project/project-context.json` (if exists) and `.claude/research/stack-baseline.md` (if exists) in the same parallel batch. Extract `context.patterns` from project-context.json; store `stack-baseline.md` content as `stack_baseline` for reuse in PHASE 2 step 2 (no re-read needed there).

   **Conventions status check** (same parallel batch — see [shared/CONVENTIONS.md](../shared/CONVENTIONS.md)):

   ```bash
   CONV_STATUS=$(head -1 .project/conventions.md 2>/dev/null | sed -n 's/.*conventions-status: \([a-z]*\).*/\1/p')
   ```

   - `set` → store `conventions_set = true` for PHASE 1 header substitution (agents read the file themselves — do not Read it here)
   - `none` → skip silently, never re-ask
   - Absent (`""`) → **one-time lightweight fallback** per CONVENTIONS.md § Elicitation: single AskUserQuestion — "No project conventions (Recommended)" writes the sentinel file; "Set up conventions now" lets the user paste/point to a style guide, distilled to ≤120 lines and written as `set`. This runs here in PHASE 0, before plan-mode entry (PHASE 1 step 8), so the write is allowed.

   Log: `CONVENTIONS: loaded | none | not set up`.

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

7. **Step 7: Build pipeline diff per feature** (optional, parallel with steps 4 and 6):

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

### PHASE 1: Parallel Lens Analysis + Triage

> **Todo**: mark PHASE 0 → `completed`, PHASE 1 → `in_progress`.

**Goal:** Per feature focused Explore agents in parallel (reuse / quality / efficiency, plus a conditional security lens), then merge + triage into CLEAN vs HAS_FINDINGS. Basic security patterns stay in the Quality lens as a baseline; security-relevant features additionally get the Security lens. For a deep full-codebase audit use `/dev-security`.

**Lens definitions** (one-liners — the full scan lists live in `references/lens-prompts.md`, the text agents actually receive):

- **Reuse**: DRY, duplication with existing helpers, lib/stdlib replacements, extract-opportunities
- **Quality**: security, cold-reader readability, control-flow smells, dead code, rule violations (CODING-RULES + FRONTEND-RULES + TOKENS.md design tokens + `.project/conventions.md` when set)
- **Efficiency**: missed concurrency, N+1, hot-path bloat, memory leaks, overly broad ops
- **Security** _(conditional)_: authn/authz gaps, secrets, input-flow tracing, weak crypto, SSRF, data exposure — only when the feature touches security-relevant surface (step 1)

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

   **Security relevance** — mark a feature `security_relevant` when `pipeline_files` or `pipeline_diff` touch any of:
   - routes/endpoints/API handlers/middleware (paths or diff: `routes/`, `api/`, `controllers/`, `middleware/`, server entry)
   - auth/session/crypto (auth, session, login, token, jwt, password, crypto)
   - user-input parsing/upload (upload, multipart, form/body parsing, deserialization)
   - exec/file-ops on dynamic input (exec, spawn, fs/path ops with variables in diff)
   - config/secrets (.env, secret/key/credential in diff)

   In doubt → mark relevant (one extra agent is cheap vs. a missed vuln).

   **Mode:**
   - `pipeline_files[feature].length < 4` → **single-lens mode**: one combined agent with all applicable lens sections in the prompt — three, or four when `security_relevant` (splitting yields too little signal for too much token overhead)
   - `length >= 4` → **multi-lens mode**: three agents in parallel per feature, plus a fourth Security agent when `security_relevant`

   **Concurrency budget:** max 10 concurrent agents total (`lens_count_per_feature` ∈ {1, 3, 4}). If `sum(lens_count_per_feature) > 10`: batch features in groups. E.g. 2 features × 4 lenses + 1 feature × 3 lenses = 11 → batch the two 4-lens features first (8 agents), then the rest.

   **Model default:** all lens-agents run on Sonnet.

2. **Launch agents IN PARALLEL** according to lens strategy (see `shared/SKILL-PATTERNS.md#parallel-dispatch` for dispatch criteria and integration steps).

   > **Todo**: Read '.claude/skills/dev-refactor/references/lens-prompts.md' — compose each agent prompt as `## Universal Prompt Header` (substituted) + the lens-specific section (`## REUSE` / `## QUALITY` / `## EFFICIENCY` / `## SECURITY`). Single-lens mode (feature <4 files): all applicable lens sections combined under one agent, after the universal header — three, or four when `security_relevant`.

3. **Output format** (each lens-agent returns):

   ```
   ANALYSIS_START
   FEATURE: {name}
   LENS: reuse|quality|efficiency|security|combined
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

   Impact: `HIGH` (security/breaking/memleak), `MED` (DRY/efficiency/clarity-hotpath), `LOW` (cosmetic). Category: `SEC|DRY|EFF|CLARITY|OVERENG|STACK|CONV`.

4. **Merge lens-outputs per feature:**

   For multi-lens features: combine the per-lens FINDINGS-lists into one list. Dedup on `file:line + fix` (same issue spotted by multiple lenses — e.g. Quality's baseline SECURITY block and the Security lens → 1 entry, category-tags merged).

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

7. **If ALL features CLEAN** → jump directly to PHASE 5 (no approval, no plan mode).

8. **Enter Plan Mode (conditional)** — only when ≥1 feature is HAS_FINDINGS: follow [shared/PLAN-MODE.md](../shared/PLAN-MODE.md) Entry protocol now. PHASE 2 + PHASE 3 run in plan mode so model routers (e.g. `opusplan`) route the research decision and plan synthesis through the planning model. All-CLEAN runs never enter plan mode — zero approval friction. Skip the call if plan mode is already active (see PLAN-MODE.md skip-check). All file writes (refactor-patterns.md appends, source changes, `.project/` mutations) wait until after `ExitPlanMode` at the end of PHASE 3.

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

   **If uncovered libraries found** → also gather material for refactor-patterns.md:
   - Context7 query for each uncovered library
   - Collect the new sections in memory as `pendingPatternAppends` — plan mode blocks the refactor-patterns.md write; PHASE 5 appends them during completion (see `references/completion-batch.md`)

**Output:** Parse `RESEARCH_START...RESEARCH_END`. Log libraries covered (baseline/patterns/uncovered) + research domains used. → Ready for combined plan.

---

### PHASE 3: Combined Plan + Single Approval

> **Todo**: mark PHASE 2 → `completed`, PHASE 3 → `in_progress`.

**Goal:** One plan combining ALL findings from ALL affected features, one user approval.

**Steps:**

1. **Create ranked improvements list:**

   Combine all findings from all HAS_FINDINGS features:
   - **Cross-feature deduplication**: same pattern in multiple files → 1 plan item with multiple locations
   - Each improvement gets impact level: 🔴 HIGH / 🟡 MED / 🟢 LOW (mapped from `[IMPACT|CATEGORY]` tags from PHASE 1 findings). `CONV` findings map to MED/LOW like clarity — unless the convention encodes a safety rule, then keep the agent's impact tag.
   - Sort: HIGH first (security, breaking bug, memory leak), then MED (performance, DRY, efficiency), then LOW (clarity, quality, simplification)
   - **Only pipeline files** may be included
   - Group by feature for clarity

2. **Aggregate SKIPPED (balance) entries** from all lens-agents per feature.

   Dedup on `file:line + rationale`. This list shows the user what the skill deliberately **does not** want to fix — so they can override ("fix that one anyway").

3. **Write the plan to the plan file** (path from the plan-mode system-reminder received at PHASE 1 step 8):

   Write `REFACTOR PLAN ({N} features, {M} improvements)` to the plan file — group by feature, each improvement as `🔴/🟡/🟢 {file}:{line} — {issue} → {fix}` with before/after snippet (extract via `sed -n '{start},{end}p'`, max 20 lines). Include "Deliberately not fixed" section for SKIPPED entries. Footer: files to be modified + "Per-feature rollback: YES". If the Security lens produced ≥2 `HIGH|SEC` findings, add one footer line: `Consider a full audit: /dev-security`. In chat show only a short progress marker (e.g. `Plan written: {M} improvements across {N} features. Plan file updated.`) — no chat dump.

4. **Ask for scope:**

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

5. **Exit plan mode:** record the chosen scope in the plan file (one line under the plan, e.g. `Scope chosen: HIGH + MED ({X+Y} improvements)`), then follow [shared/PLAN-MODE.md](../shared/PLAN-MODE.md) Exit protocol — `ExitPlanMode` presents the plan for approval. After approval the skill continues with PHASE 4. Rejected plan → re-ask scope (back to step 4) or exit with "Refactor cancelled by user".

---

### PHASE 4: Apply + Test Per Feature

> **Todo**: mark PHASE 3 → `completed`, PHASE 4 → `in_progress`. Read `.claude/skills/dev-refactor/references/apply-rollback.md` for the full apply + rollback procedure.

**Step 0 — Safety-net pre-flight (per feature, before changes):** follow `shared/MUTATION-TESTING.md` § dev-refactor PHASE 4 step 0 (Stryker incremental `--force` vs the `tests.mutationScore` baseline; informative gate — user decides on a drop; runner skipped → log and continue).

Follow `references/apply-rollback.md` — priority order, file tracking, per-feature rollback, and test-failure decision table.

**Output:** Table per feature (name, APPLIED/ROLLED_BACK, improvement count, files modified). → Documenting results...

---

### PHASE 5: Batch Completion

> **Todo**: mark PHASE 4 → `completed`, PHASE 5 → `in_progress`. Read `.claude/skills/dev-refactor/references/completion-batch.md` for the full completion procedure.

Follow `references/completion-batch.md` — feature.json writes, learning extraction, parallel sync, scoped commit, and feature archiving.

> **Todo**: mark PHASE 5 → `completed`.

---

## Error Handling

See `.claude/skills/dev-refactor/references/error-handling.md` for error scenarios per category (context loading, refactor patterns, analysis, test failures, rollback failures).
