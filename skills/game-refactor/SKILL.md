---
name: game-refactor
description: >-
  Batch refactor code quality for Godot projects after testing with parallel
  analysis and GDScript-aware patterns. Use with /game-refactor after /game-verify.
reads: [feature.build, feature.tests, backlog.stage]
writes: [feature.refactor, backlog.stage]
metadata:
  author: mileszeilstra
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
- NOT for: fixing bugs (/game-verify), adding features (/game-define), planning (/project-plan)

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
6. PHASE 5: Batch Completion

### PHASE 0: Batch Context Loading + Refactor Patterns

> **Todo**: call `TaskCreate` with the 6 phase items (see above). Mark PHASE 0 → `in_progress` via `TaskUpdate`.

1. **Read backlog for pipeline status:**

   Read `.project/backlog.html` (if exists), parse JSON from `<script id="backlog-data">` block (see `shared/BACKLOG.md`):
   - Filter DONE features: `data.features.filter(f => f.status === "DONE")`
   - For each DONE feature, check `.project/features/{name}/feature.json` for existing `refactor` section
   - Categorize: `unrefactored` (no refactor section) vs `refactored` (has refactor section)

2. **Determine feature queue:**

   **a) Feature name provided** (`/game-refactor water-ability`):
   - Validate feature exists in `.project/features/`
   - Feature queue = `[water-ability]` (regardless of refactor status)

   **b) No feature name** (`/game-refactor`):
   - Present scope selection via **AskUserQuestion**:
     - header: "Scope"
     - question: "What do you want to refactor?"
     - options:
       - label: "Unrefactored features (Recommended)", description: "{N} features: {feature1}, {feature2}, ..."
       - label: "All DONE features", description: "All {M} DONE features, including previously refactored ones"
       - label: "Entire codebase", description: "Scan all source files, not feature-bound"
     - multiSelect: false
   - If "Unrefactored features" → feature queue = unrefactored DONE features
   - If "All DONE features" → feature queue = all DONE features
   - If "Entire codebase" → **codebase mode** (see below)
   - If 0 unrefactored features: show "All features have already been refactored" in the option description

   **c) "recent"**: find most recently modified `feature.json` with `tests` section, queue = `[that feature]`

   **Codebase mode** ("Entire codebase"):
   - Pipeline files = all GDScript files from project (detect `src/`, `scripts/`, or scene directories from project.json or CLAUDE.md)
   - Exclude: `.godot/`, `.project/`, `addons/gut/`, test files
   - Do not write feature.json — save result to `.project/session/codebase-refactor.json`
   - Commit message: `refactor(codebase): {summary}`
   - Skip PHASE 5 feature.json/backlog updates — only commit + report

3. **Worktree switch** (single-mode only):

   If `feature_queue.length == 1` and not in codebase-mode: execute the procedure in `shared/WORKTREE.md` with the feature-name. Automatically switches to `worktree-{feature-name}` if it exists. On FAIL: stop with the message from WORKTREE.md.

   Batch-mode (queue > 1) or codebase-mode: skip — stay on main, refactor over already-merged code.

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

1. **Launch ALL Explore agents IN PARALLEL** (1 per feature, max 10 concurrent):

   For each feature, launch a Task agent (Explore) with this prompt:

   ```
   Feature: {feature-name}
   Pipeline files:
   {list of all pipeline_files paths for this feature}

   PROJECT CONVENTIONS:
   {PROJECT_CONVENTIONS from PHASE 0 step 5, or "not available"}

   Read ALL of the above pipeline files. Scan for:

   1. UNIVERSAL (always scan):

      SECURITY:
      - Injection: OS.execute, ClassDB abuse
      - Unsafe deserialization: var_to_str/str_to_var with untrusted input
      - Path traversal in file operations

      DRY violations (ONLY within pipeline files):
      - Duplicate code blocks (>5 lines identical)
      - Similar logic patterns (>70% similarity)
      - Repeated conditionals, copy-paste
      - Extract opportunities (same code in 3+ locations)

      OVER-ENGINEERING:
      - Helpers used only once
      - >3 levels of indirection for simple operations
      - Premature optimization (complex caching for non-hot paths)
      - Over-defensive code (try/catch around code that cannot fail)
      - Abstract base classes with only 1 implementation

      CLARITY:
      - Unnecessary nesting (>3 levels deep)
      - Dense one-liners that sacrifice readability for brevity
      - Poor variable/function names (single-letter, misleading, too generic)
      - Redundant comments describing obvious code
      - "Clever" code that is hard to understand
      - Inconsistency with PROJECT CONVENTIONS (above) or CLAUDE.md

   2. GODOT-SPECIFIC (always scan):

      SIGNALS:
      - Unused signals (signal declared but never emitted)
      - Signal spaghetti (signals connected to signals connected to signals)
      - Missing disconnect() for dynamically connected signals
      - Using strings for signal names instead of signal references

      SCENE TREE:
      - Orphaned @onready references (node path doesn't exist in scene)
      - Deep nesting in scene tree (>5 levels)
      - Direct node path references (brittle: $"../../SomeNode")
      - Accessing nodes before _ready()

      MEMORY:
      - Missing queue_free() for dynamically created nodes
      - Resource leaks (preload vs load misuse)
      - Circular references preventing garbage collection
      - Large resources loaded but never freed

      PERFORMANCE:
      - _process() / _physics_process() with heavy calculations
      - Unnecessary per-frame allocations (Array/Dictionary creation in _process)
      - Missing set_process(false) when idle
      - Redundant get_node() calls in loops

      TYPED GDSCRIPT:
      - Missing type hints on function parameters
      - Missing return type declarations
      - Untyped variables where type is obvious
      - Using Variant where concrete type is known

      STATE MACHINES:
      - Giant match statements without state pattern
      - State transitions without exit/enter callbacks
      - Shared mutable state between states

   3. STACK-SPECIFIC (from refactor-patterns):

      {injected patterns from refactor-patterns.md}

   4. BALANCE (do NOT report as finding):

      - Abstractions reused multiple times
      - Explicit signal connections for clarity
      - Named constants even if used only once
      - Typed variables for readability
      - Preference for explicit over compact — more lines is OK if it's clearer

   5. ASSET HEALTH (lightweight check):
      - Textures larger than necessary (e.g. 2048x2048 for a small sprite)
      - Uncompressed audio files (.wav where .ogg would suffice)
      - Scenes with excessive node counts (>50 nodes for simple features)
      - Missing LOD on 3D meshes (if applicable)
      - Unused resources in scene (preload/load without reference)

      Report as ASSET_FINDINGS (or "No asset issues found").
      Only flag as a concrete problem, not as theoretical risk.

   6. ARCHITECTURE overview:
      - Which Godot features/systems are used
      - Key patterns (state machines, signals, autoloads, etc.)
      - Scene composition patterns

   Return as structured overview:
   ANALYSIS_START

   FEATURE: {feature-name}
   STATUS: CLEAN | HAS_FINDINGS

   ARCHITECTURE:
   Godot systems: {list of systems used}
   Patterns: {list of architectural patterns}
   Scene structure: {high-level scene composition}

   SECURITY_FINDINGS:
   - {file:line} {pattern} — {description} — Before: {code snippet}
   (or "No security issues found")

   DRY_FINDINGS:
   - {file:line} ↔ {file:line} {type} — {description} — Code: {snippet}
   (or "No DRY violations found")

   OVERENGINEERING_FINDINGS:
   - {file:line} {type} — {description} — Code: {snippet}
   (or "No over-engineering found")

   GODOT_SPECIFIC_FINDINGS:
   - {file:line} {category} {pattern} — {description} — Code: {snippet}
   (or "No Godot-specific issues found")

   CLARITY_FINDINGS:
   - {file:line} {type} — {description} — Code: {snippet}
   (or "No clarity issues found")

   ASSET_FINDINGS:
   - {file} {type} — {description} (e.g. "texture 2048x2048 for 32px sprite")
   (or "No asset issues found")

   BALANCE_SKIPPED:
   - {file:line} {type} — {reason why this was NOT included as a finding}
   (optional — only if items were deliberately filtered)

   POSITIVE_OBSERVATIONS:
   - {what is already good in the codebase}

   ANALYSIS_END
   ```

   **Parsing agent results:**

   For each completed Explore agent:
   1. If TaskOutput contains `ANALYSIS_START` — parse directly
   2. If truncated (no `ANALYSIS_START` visible):
      - Use **Grep** to find `ANALYSIS_START` in the output file
      - Use **Read** with line offset to extract the structured block
   3. Extract STATUS field: `CLEAN` or `HAS_FINDINGS`

2. **Triage results:**

   Classify each feature:
   - **CLEAN**: STATUS = CLEAN (0 findings across all categories)
   - **HAS_FINDINGS**: STATUS = HAS_FINDINGS (1+ findings)

   CLEAN features — **early-exit**, skip PHASE 2-4 entirely.

3. **If ALL features are CLEAN** — jump directly to PHASE 5 (batch completion, no user approval needed).

**Output:**

```
PARALLEL ANALYSIS COMPLETE

| Feature | Pipeline Files | Status | Findings |
|---------|---------------|--------|----------|
| {name1} | {N} | CLEAN | 0 |
| {name2} | {M} | HAS_FINDINGS | {X} |
| ... | ... | ... | ... |

Summary: {clean_count} clean, {findings_count} with findings

{if all clean:}
→ All features clean! Skipping to completion...

{if has findings:}
→ Proceeding with {findings_count} feature(s) to research decision...
```

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

> **Todo**: mark PHASE 3 → `completed`, PHASE 4 → `in_progress`.

**Goal:** Apply approved improvements and test, with per-feature rollback isolation.

**Priority order for each feature (execute in this sequence):**

1. Security improvements
2. Memory leak fixes
3. Performance optimizations
4. Signal/scene tree improvements
5. DRY/Refactoring improvements
6. Simplification (remove over-engineering)
7. Type hint additions
8. Clarity (readability improvements)

**Steps:**

1. **Initialize change tracking:**

   ```bash
   git rev-parse HEAD  # Store as saved_hash for global rollback
   ```

2. **For each feature with approved improvements:**

   a. **Track files for targeted rollback:**

   Initialize empty lists: `modified_files[feature_name] = []`, `created_files[feature_name] = []`

   b. **Apply improvements using Edit tool:**
   - Follow priority order strictly
   - **Re-read each file immediately before editing** (prevents "File has not been read yet" errors)
   - Group edits by file: read file — apply ALL edits for that file — move to next file
   - **Only modify files in pipeline_files list** — assert before each edit
   - Keep changes non-breaking
   - Track: `modified_files[feature_name] = [list of existing files changed]`
   - Track: `created_files[feature_name] = [list of new files created]`

   c. **Run GUT test suite after this feature's changes:**
   - Run GUT tests: `godot --headless --script addons/gut/gut_cmdln.gd`
   - **All pass** — mark feature as APPLIED, continue to next feature
   - **Any fail — analyze before rollback:**

     | Test failure type                                         | Action                     |
     | --------------------------------------------------------- | -------------------------- |
     | Test expects old behavior that was intentionally improved | Update test, re-run        |
     | Genuine regression (broke unrelated functionality)        | Rollback THIS feature only |
     | Flaky or environment-dependent                            | Re-run once, then decide   |

     **If test update needed:**
     - Update ONLY the specific assertion(s)
     - Re-run FULL GUT test suite
     - If still failing — rollback THIS feature only
     - Max 1 test update attempt per failing test

     **Per-feature rollback (only this feature, not others):**

     ```bash
     git checkout -- {modified_files[feature_name]}
     rm -f {created_files[feature_name]}
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

**Non-breaking rule:**

- No signal signature changes (parameters, types)
- No scene tree structural changes that break external references
- No removal of public methods/functions
- No renaming of exported variables
- Preserve all existing behavior
- If breaking change needed — skip that improvement and note it

**Output:**

```
IMPROVEMENTS APPLIED

| Feature | Status | Improvements | Files Modified |
|---------|--------|-------------|----------------|
| {name1} | APPLIED | {N} | {M} |
| {name2} | APPLIED | {N} | {M} |
| {name3} | ROLLED_BACK | 0 | 0 ({reason}) |

→ Documenting results...
```

---

### PHASE 5: Batch Completion

> **Todo**: mark PHASE 4 → `completed`, PHASE 5 → `in_progress`.

**Goal:** Proportional documentation, single backlog update, single commit.

1. **Write feature.json per feature** (read-modify-write):

   For each feature:
   1. Read `.project/features/{feature-name}/feature.json`
   2. Add `refactor` section:

      **For CLEAN features:**

      ```json
      {
        "refactor": {
          "status": "CLEAN",
          "improvements": {},
          "decisions": [],
          "positiveObservations": ["..."],
          "failureAnalysis": null,
          "pendingImprovements": []
        }
      }
      ```

      **For REFACTORED features:**

      ```json
      {
        "refactor": {
          "status": "REFACTORED",
          "improvements": {
            "security": [{ "file": "...", "issue": "...", "fix": "..." }],
            "performance": [],
            "signals": [],
            "dry": [],
            "clarity": []
          },
          "decisions": [{ "decision": "...", "rationale": "..." }],
          "positiveObservations": ["..."],
          "failureAnalysis": null,
          "pendingImprovements": []
        }
      }
      ```

      **For ROLLED_BACK features:**

      ```json
      {
        "refactor": {
          "status": "ROLLED_BACK",
          "improvements": {},
          "decisions": [],
          "positiveObservations": [],
          "failureAnalysis": "...",
          "pendingImprovements": ["..."]
        }
      }
      ```

   3. Update top-level `status`:
      - CLEAN/REFACTORED: `"DONE"`, `"shipped": true`, `"shippedAt": <ISO-date>`, `"shippedSha": <git-sha after auto-commit>`
      - ROLLED_BACK: keep `"DONE"` (refactor.status documents the rollback), no shipped fields
   4. Write feature.json back (do NOT overwrite other sections)

   If N > 1 features: read all feature.json in parallel, mutate each in memory, write all back in parallel.

2. **Parallel sync** (backlog + dashboard + conditional context sync):

   Read in parallel (skip if not exists):
   - `.project/backlog.html`
   - `.project/project.json`
   - `.project/project-context.json`

   Mutate in memory:

   **Backlog** (see `shared/BACKLOG.md`): status remains `"DONE"` for all features (CLEAN, REFACTORED, and ROLLED_BACK). Set per feature the `refactor` field:
   - CLEAN or REFACTORED → `f.refactor = "REFACTORED"`, `f.shipped = true`, `f.shippedAt = <ISO-date>`, `f.shippedSha = <git-sha>`, remove `transition` (if present) (renders ✓ badge in DONE column)
   - ROLLED_BACK → `f.refactor = "ROLLED_BACK"`, remove `transition` (if present) (renders ⚠ badge)

   Set `data.updated` to current date.

   **Dashboard** (see `shared/DASHBOARD.md`): unchanged — there is no separate dashboard merge in game-refactor other than feature status.

   Learning extraction only happens in `/game-verify`. Refactor insights are recorded here in `feature.json.refactor` — no `learnings[]` append.

   **Context sync (conditional)** — only if REFACTORED features contain structural changes:

   Trigger if ANY: scripts renamed/moved, new scripts via extraction, scene structure fundamentally changed, autoload/singleton patterns changed.
   Skip if: only internal code quality (naming, DRY, type hints, clarity), performance without structural impact.

   When triggered (in `project-context.json` mutation):
   - `context.structure` → overwrite full tree with changed script paths
   - Extracted scripts/scenes → add to structure tree
   - `context.patterns` → merge changed patterns
   - `context.updated` → current date
   - `architecture.components` → update existing components (status, src, test, connects_to), add new ones if scenes/signals were renamed/split. Follow component-first model from `shared/DASHBOARD.md`.
   - Quality: only project-specific, non-obvious, one line per item
   - Log: `context: {N} updates ({keys touched})` or `context: no updates needed`

   Write back in parallel:
   - Edit `backlog.html` (keep `<script>` tags intact)
   - Write `project.json`
   - Write `project-context.json` (if context/architecture/learnings changed)

3. **Scoped auto-commit** (only this skill's changes):

   Compare current git status with baseline from PHASE 0:

   ```bash
   git status --porcelain | sort > /tmp/current-status.txt
   ```

   Categorize files by comparing with `.project/session/pre-skill-status.txt`:
   - **NEW** (only in current, not in baseline) → `git add` automatically
   - **OVERLAP** (in both baseline AND current) → warn user via AskUserQuestion: "These files had pre-existing uncommitted changes and were also modified by this skill: {list}. Include in commit?" Options: "Include (Recommended)" / "Skip"
   - **PRE-EXISTING** (only in baseline) → do NOT stage

   If baseline file doesn't exist, fall back to `git add -A`.

   ```bash
   git commit -m "$(cat <<'EOF'
   refactor(batch): {summary}

   {N} features analyzed, {clean} clean, {refactored} refactored, {rolled_back} rolled back

   {for each REFACTORED feature:}
   - {feature}: {improvement count} improvements ({categories})
   {for each CLEAN feature:}
   - {feature}: clean (no changes needed)
   {for each ROLLED_BACK feature:}
   - {feature}: rolled back ({reason})
   EOF
   )"
   ```

   For single-feature commits, use:

   ```
   refactor({feature}): {summary}
   ```

   Clean up: `rm -f .project/session/pre-skill-status.txt .project/session/active-{feature-name}.json /tmp/current-status.txt`

3b. **Feature archiving** (only features with `feature.json`, not small items without a pipeline):

For each CLEAN or REFACTORED feature where `.project/features/{name}/feature.json` exists:

```bash
mkdir -p .project/features/archive
mv .project/features/{name}/ .project/features/archive/{shippedAt-date}-{name}/
```

- `{shippedAt-date}` = date from the just-written `shippedAt` field (YYYY-MM-DD format)
- Multiple features in one run → each to its own archive dir
- ROLLED_BACK features: do not archive
- Skip if feature dir no longer exists (idempotent)

4. **Show completion:**

   ```
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   REFACTOR COMPLETE

   {N} feature(s) processed:
   {for each CLEAN feature:}
   ✓ {name} — clean (no changes needed)
   {for each REFACTORED feature:}
   ✓ {name} — {improvement-count} improvements applied
   {for each ROLLED_BACK feature:}
   ✗ {name} — rolled back ({reason})

   Refactoring complete. Features remain in DONE status.

   Next steps:
     1. /game-define {next-feature} → next feature from backlog
     2. /project-plan → revisit backlog if scope has changed
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   ```

   **Worktree integration hint** — add one extra line to the completion block if both conditions are true:
   1. Single-mode (queue.length == 1, not codebase-mode)
   2. Current branch matches `worktree-*` pattern (`git branch --show-current`)

   Append:

   ```
   💡 Run /core-merge {feature-name} to integrate into main/develop
   ```

> **Todo**: mark PHASE 5 → `completed`.

---

## Error Handling

### Context Loading Failures

**No features found** — exit: "Run /game-define and /game-build first"
**No test results for any feature** — exit: "Run /game-verify first"
**Some features missing test results** — remove from queue, warn, continue with rest
**Feature.json missing files[]** — skip feature, warn: "No code files found in feature.json for {feature}"

### Refactor Patterns Failures

**Context7 unavailable** — skip refactor-patterns generation, proceed with universal + Godot-specific patterns only
**Partial Context7 results** — generate refactor-patterns.md with available data, note gaps

### Analysis Failures

**Explore agent fails for a feature** — skip that feature, warn, continue with rest
**All Explore agents fail** — exit: "Analysis failed — try again or run on a single feature"
**Agent output truncated** — use Grep/Read to find ANALYSIS_START..ANALYSIS_END block

### Test Failures

**GUT tests fail after refactoring a feature** — per-feature rollback, continue with next feature
**GUT not installed** — ask user which test command to run
**Tests hang** — kill process, rollback current feature

### Rollback Failures

**git checkout fails for feature files** — report manual recovery steps:

1. Show the `saved_hash` from PHASE 4 step 1
2. List all `modified_files[feature_name]` and `created_files[feature_name]`
3. Suggest: "Use `/rewind` in Claude Code to go back to an earlier point"
4. STOP — do not attempt destructive recovery commands

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
