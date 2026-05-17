---
name: game-refactor
description: Batch refactor Godot code quality after testing. Use with /game-refactor.
reads: [feature.build, feature.tests, backlog.stage]
writes: [feature.refactor, backlog.stage, learnings]
metadata:
  author: claude-config
  version: 1.3.0
  category: game
---

# Refactor

## Overview

Optional quality step on completed features. Not a status-gate — features are DONE after `/game-verify`. This skill improves code structure, naming, and patterns on already-finished features.

Batch-first architecture: analyzes ALL features in parallel via Explore agents, triages clean vs dirty, generates GDScript-aware refactor patterns via Context7, creates one combined plan with one approval, and applies changes with per-feature rollback.

**Trigger**: `/game-refactor` or `/game-refactor {feature-name}`

## Scope Rule: Feature Files Only

**This skill ONLY refactors files that belong to the feature.**

- Extract all code file paths from `feature.json` → `files[]` — these are the **pipeline files**
- ONLY these files may be analyzed, planned, and modified
- **NEVER** touch, scan, plan, or modify files outside this list
- Valid path patterns: `scripts/`, `scenes/`, `resources/`, `tests/`
- **Exception:** New utility/helper scripts may be **created** if they exclusively extract code from pipeline files (e.g., extracting shared logic into a new `utils/` script). Existing external files may NEVER be modified.
- If a pattern scan or research finding points to an external file — skip it, do not include in plan
- If a DRY violation spans a pipeline file and an external file — only refactor the pipeline file side

This rule exists because refactoring external files risks breaking other features and creates unpredictable side effects.

## When to Use

- After `/game-verify` completes (features in DONE status)
- When `.project/features/{name}/feature.json` exists with `tests` section
- NOT for: fixing bugs (/game-verify), adding features (/game-define), planning (/project-backlog)

## Input

Reads `.project/features/{feature-name}/feature.json`: requirements, files, build, tests sections.

## Output Structure

```
.project/features/{feature-name}/
└── feature.json    # Enriched with refactor section (status, improvements, decisions)
```

## Two Research Layers

```
.claude/research/
├── architecture-baseline.md  ← EXISTING: Godot patterns, scene architecture, conventions
│                                Read in PHASE 2 for research decision
│
└── refactor-patterns.md      ← NEW: GDScript-specific code smells & anti-patterns
                                 Generated via Context7 on first refactor
                                 Reused on subsequent refactors
```

**architecture-baseline.md** = "how to use Godot/GDScript correctly" (conventions)
**refactor-patterns.md** = "what mistakes to look for in GDScript code" (anti-patterns)

## Workflow

**Phase tracking** — first action of the skill: call `TaskCreate` with these 6 items (status `pending`), then use `TaskUpdate` to set each phase `in_progress` at start and `completed` at end. During context compaction the task list remains visible — no risk of forgotten phases.

1. PHASE 0: Batch Context Loading + Refactor Patterns
2. PHASE 1: Parallel Batch Analysis + Triage
3. PHASE 2: Aggregated Research Decision
4. PHASE 3: Combined Plan + Single Approval
5. PHASE 4: Apply + Test Per Feature
6. PHASE 5: Batch Completion (feature.json writes → learnings (patterns + pitfalls) → sync → commit → archive)

### PHASE 0: Batch Context Loading + Refactor Patterns

> **Todo**: call `TaskCreate` with the 6 phase items (see above). Mark PHASE 0 → `in_progress` via `TaskUpdate`.

1. **Read backlog for pipeline status:**

   Read `.project/backlog.html` (if exists), parse JSON from `<script id="backlog-data">` block (see `shared/BACKLOG.md`):
   - See `shared/BACKLOG.md → Lifecycle Protocol → Read`. Priority filter: `transition === "refactoring"` — if found, pre-select. Fallback: `data.features.filter(f => f.status === "DONE")`
   - For each DONE feature, check `.project/features/{name}/feature.json` for existing `refactor` section
   - Categorize: `unrefactored` (no refactor section) vs `refactored` (has refactor section)

2. **Determine feature queue:**

   > **Todo**: Read `.claude/skills/game-refactor/references/queue-selection.md` for scope selection logic (a/b/c paths + codebase mode).

3. **Worktree switch** (single-mode only):

   If `feature_queue.length == 1` and not in codebase-mode: execute the procedure in `shared/WORKTREE.md` with the feature-name. Automatically switches to `worktree-{feature-name}` if it exists. On FAIL: stop with the message from WORKTREE.md.

   > **Todo**: follow `shared/WORKTREE.md → Symlink Integrity Gate (post-switch auto-repair)`.

4. **Load feature.json for every feature in queue:**

   For each feature, read `feature.json`. Extract:
   - `requirements[]` for requirements and architecture
   - `files[]` for implementation details and file list
   - `tests.checklist[]` for playtest items
   - `tests` section for verification results

   Validate feature.json exists with `tests` section for each feature. If any missing — remove from queue and warn.

5. **Build pipeline files list per feature:**

   For each feature, extract all code file paths from `feature.json` → `files[]`:
   - Primary: parse `files[].path` from feature.json
   - Fallback: grep for file paths matching `scripts/`, `scenes/`, `resources/`, `tests/`
   - Store as `pipeline_files[feature_name]`

6. **Load project conventions + learnings** (for Explore agent context):

   Read `.project/project-context.json` (if exists) → extract `context.patterns`.
   Store as `PROJECT_CONVENTIONS` for injection into Explore agent prompts (PHASE 1).

   **Learnings load** via [shared/LEARNINGS-LOAD.md](../shared/LEARNINGS-LOAD.md):

   ```
   scopes: [component]
   pitfall-prefix: true
   current-feature: <feature-name if feature-mode, otherwise "none">
   ```

   Store as `KNOWN_PITFALLS` for injection into Explore agent prompts (PHASE 1) — prevents reintroduction of known Godot/GDScript bugs and helps agents distinguish between "intentional project pattern" and "code smell".

7. **Load or generate refactor-patterns.md:**

   ```
   IF .claude/research/refactor-patterns.md exists:
     → Load cached patterns, skip Context7
     → Log: "Refactor patterns loaded (cached)"

   IF NOT exists:
     → Context7 resolve-library-id for Godot/GDScript
     → Context7 query-docs:
       "Common code smells, anti-patterns, and refactoring opportunities
        in GDScript/Godot 4 projects. Focus on: performance pitfalls,
        signal misuse, scene tree anti-patterns, memory leaks, and
        code organization issues."
     → Compile results into .claude/research/refactor-patterns.md
     → Log: "Refactor patterns generated via Context7 (Godot/GDScript)"
   ```

   **Format for refactor-patterns.md:**

   ```markdown
   # Refactor Patterns

   <!-- Generated via Context7 for: Godot 4.x / GDScript -->
   <!-- Regenerate: delete this file and run /game-refactor -->

   ## Performance Anti-patterns

   - {pattern}: {description} — {what to look for in code}

   ## Signal Anti-patterns

   - {pattern}: {description} — {what to look for in code}

   ## Scene Tree Anti-patterns

   - {pattern}: {description} — {what to look for in code}

   ## Memory Management Anti-patterns

   - {pattern}: {description} — {what to look for in code}

   ## Code Organization Anti-patterns

   - {pattern}: {description} — {what to look for in code}
   ```

**Output:**

```
BATCH CONTEXT LOADED

| Metric | Value |
|--------|-------|
| Features in queue | {N} |
| Total pipeline files | {sum across all features} |
| Refactor patterns | {cached / generated via Context7} |

Features:
{for each feature:}
- {name}: {M} pipeline files

→ Starting parallel analysis...
```

---

**Capture git baseline** (for scoped commit at end of skill):

```bash
mkdir -p .project/session
git status --porcelain | sort > .project/session/pre-skill-status.txt
echo '{"feature":"{feature-name}","skill":"refactor","startedAt":"{ISO timestamp}"}' > .project/session/active-{feature-name}.json
```

### PHASE 1: Parallel Batch Analysis + Triage

> **Todo**: mark PHASE 0 → `completed`, PHASE 1 → `in_progress`.

**Goal:** Analyze ALL features in parallel, then triage into CLEAN vs HAS_FINDINGS.

> **Todo**: Read `.claude/skills/game-refactor/references/analysis-prompt.md` for the full Godot scan template, agent prompt, parsing instructions, triage logic, and output format.

---

### PHASE 2: Aggregated Research Decision

> **Todo**: mark PHASE 1 → `completed`, PHASE 2 → `in_progress`.

**Goal:** One research decision for all affected features combined (not per-feature).

**Steps:**

1. **Aggregate architecture info from all HAS_FINDINGS features:**
   - Collect all Godot systems mentioned in ARCHITECTURE sections
   - Collect patterns and scene structures
   - Identify areas not covered by architecture-baseline.md or refactor-patterns.md

2. **Read architecture baseline:**
   - Read `.claude/research/architecture-baseline.md` (if exists)
   - Note which Godot patterns/systems are already documented

3. **Decide: is Context7 research needed?**

   | Signal                                                                 | Research needed?                   |
   | ---------------------------------------------------------------------- | ---------------------------------- |
   | Architecture baseline + refactor-patterns cover all systems            | NO                                 |
   | Findings are concrete, directly actionable                             | NO                                 |
   | Complex Godot system usage not in baseline (shaders, networking, etc.) | YES — research those systems       |
   | Advanced signal/scene patterns                                         | YES — research Godot patterns      |
   | No architecture baseline exists at all                                 | YES — research core Godot patterns |

   **If research NOT needed** — proceed directly to PHASE 3.

   **If research needed** — spawn one Explore agent (`subagent_type: Explore`, thoroughness: "very thorough") to research Godot patterns in an isolated context. This keeps Context7 results out of the main session.

   Determine which research domains to include based on findings:

   | Domain              | Include when                                              |
   | ------------------- | --------------------------------------------------------- |
   | Godot patterns      | Complex scene architecture, signal design, state machines |
   | Performance         | \_process bottlenecks, physics optimization, draw calls   |
   | Resource management | Memory management, resource loading strategies            |

   Agent prompt — include only domains identified as needed:

   ```
   Research Godot 4.x best practices for a refactoring task.

   Architecture baseline: {from architecture-baseline.md, or "none"}

   Aggregated analysis:
   {ANALYSIS_START..ANALYSIS_END blocks from all HAS_FINDINGS features}

   {If godot patterns domain needed:}
   GODOT PATTERNS:
   - resolve-library-id for Godot → query-docs
   - Focus: scene composition, signal patterns (signals up, methods down), state machines, component pattern, typed GDScript

   {If performance domain needed:}
   PERFORMANCE:
   - Focus: _process vs _physics_process optimization, draw call reduction, physics layer usage, object pooling

   {If resource management domain needed:}
   RESOURCE MANAGEMENT:
   - Focus: ResourceLoader, preload vs load, custom Resources, memory management, scene instancing

   Also read: skills/game-build/techniques/architecture-decisions.md for decision tree context.

   RETURN FORMAT:
   RESEARCH_START
   Godot patterns: {3-5 bullet points: scene architecture, signals, state machines}
   Performance: {3-5 bullet points: optimization patterns, bottleneck fixes}
   Resource management: {3-5 bullet points: loading strategies, memory patterns}
   RESEARCH_END

   Only include sections for domains you were asked to research.
   ```

   **If uncovered patterns found** — also update refactor-patterns.md:
   - Context7 query for each uncovered Godot system
   - Append new sections to existing refactor-patterns.md

**Output:**

Parse the agent's `RESEARCH_START...END` block. Display:

```
RESEARCH DECISION

| Source | Coverage |
|--------|----------|
| architecture-baseline.md | {list of documented patterns} |
| refactor-patterns.md | {list of covered anti-patterns} |
| Uncovered | {list or "none"} |

{if no research:}
Research: Skipped (existing knowledge sufficient)

{if research:}
Research: Explore agent ({domains researched})
Refactor patterns updated: {yes/no}

→ Ready for combined plan.
```

---

### PHASE 3: Combined Plan + Single Approval

> **Todo**: mark PHASE 2 → `completed`, PHASE 3 → `in_progress`.

**Goal:** One plan combining ALL findings from ALL affected features, one user approval.

**Steps:**

1. **Create ranked improvements list:**

   Combine all findings from all HAS_FINDINGS features:
   - **Cross-feature deduplication**: same pattern in multiple files — 1 plan item with multiple locations
   - Each improvement gets impact level: HIGH / MED / LOW
   - Sort: HIGH first (security, memory leaks), then MED (performance, DRY, signals), then LOW (clarity, typing)
   - **Only pipeline files** may be included
   - Group by feature for clarity

2. **Present improvements with before/after code:**

   ```
   REFACTOR PLAN ({N} features, {M} improvements)

   HIGH: [X] improvements (security, memory leaks)
   MED:  [Y] improvements (performance, DRY, signals, scene tree)
   LOW:  [Z] improvements (clarity, typing, code quality)

   -- {feature-1} --

   1. HIGH {file}:{line} — {issue} → {fix}
      Before: {code snippet}
      After:  {proposed change}

   2. MED {file}:{line} — {issue} → {fix}
      Before: {code snippet}
      After:  {proposed change}

   -- {feature-2} --

   3. MED {file}:{line} — {issue} → {fix}
      ...

   ──────────────────

   Files to be modified: [count]
   - {file1} ([N] changes) — {feature}
   - {file2} ([M] changes) — {feature}

   Per-feature rollback: YES (feature A succeeds, B fails → only B rolled back)
   ```

3. **Ask for scope (1 AskUserQuestion for all features):**

   Use **AskUserQuestion** tool:
   - header: "Scope"
   - question: "Which improvements do you want to apply? ({M} total across {N} features)"
   - options:
     - label: "Apply everything (Recommended)", description: "All {M} improvements in {N} features"
     - label: "HIGH + MED only", description: "{X+Y} improvements, skip LOW"
     - label: "HIGH only", description: "{X} improvements, security/memory only"
     - label: "Choose per feature", description: "Select which improvements to apply per feature"
   - multiSelect: false

   **If "Choose per feature"** — show per-feature AskUserQuestion with multiSelect:
   - header: "Features"
   - question: "Which features do you want to refactor?"
   - options: one per feature with finding count
   - multiSelect: true

   Only approved features proceed to PHASE 4. Non-selected features get CLEAN status.

   The user can also type "Cancel" via the built-in "Other" option — EXIT with "Refactor cancelled by user"

---

### PHASE 4: Apply + Test Per Feature

> **Todo**: mark PHASE 3 → `completed`, PHASE 4 → `in_progress`. Read `.claude/skills/game-refactor/references/apply-rollback.md` for priority order, per-feature apply + GUT test + rollback steps.

---

### PHASE 5: Batch Completion

> **Todo**: mark PHASE 4 → `completed`, PHASE 5 → `in_progress`. Read `.claude/skills/game-refactor/references/completion-batch.md` for full batch completion steps.

> **Todo**: mark PHASE 5 → `completed`.

---

## Error Handling

> **Todo**: Read `.claude/skills/game-refactor/references/error-handling.md` for all error scenarios and recovery steps.

## Restrictions

This skill must NEVER:

- Read pipeline source files directly in the main conversation (always use Explore agent)
- Pass full file contents to research agents (pass structured analysis from Explore agent)
- Analyze, plan, or modify files outside pipeline_files (extracted from feature.json files[])
- Include external file findings in any plan
- Proceed without existing feature.json with tests section
- Make breaking changes (signal signatures, exported variables, public methods)
- Over-simplify code by removing helpful abstractions or combining too many concerns
- Prioritize fewer lines over readability (explicit > compact)
- Create "clever" solutions that are hard to understand or debug
- Skip user approval at PHASE 3 (unless 0 findings across all features)
- Skip GUT test verification in PHASE 4
- Proceed if tests fail without analyzing failure type first (stale test vs regression)
- Apply improvements without user scope selection
- Run Explore agents sequentially when multiple features are in the queue (use parallel)
- Create disproportionate documentation for clean features

This skill must ALWAYS:

- Enforce the pipeline_files scope boundary at every phase
- Launch Explore agents in parallel for batch analysis (max 10 concurrent)
- Triage features into CLEAN vs HAS_FINDINGS after analysis
- Early-exit CLEAN features (skip PHASE 2-4)
- Use refactor-patterns.md for GDScript-aware analysis (generate on first run, cache thereafter)
- Aggregate research decisions across all features (1 decision, not N)
- Present ONE combined plan with ONE user approval for all features
- Deduplicate cross-feature findings (same pattern — 1 plan item)
- Apply per-feature rollback (feature A succeeds, feature B fails — only B rolled back)
- Write proportional documentation (compact for CLEAN, full for REFACTORED)
- Make a single commit for all features
- Re-read each file immediately before editing (prevents "File has not been read yet" errors)
- Group edits by file: read file — apply ALL edits for that file — next file
- Run full GUT test suite after applying changes per feature
- Analyze test failures before rollback (distinguish stale tests from regressions)
- Apply balance filter: skip findings where the "fix" reduces readability
- Check CLAUDE.md, `.project/project.json`, and `.project/project-context.json` for project-specific conventions during analysis
