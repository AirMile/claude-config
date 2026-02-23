---
name: game-refactor
description: >-
  Batch refactor code quality for Godot projects after testing with parallel
  analysis and GDScript-aware patterns. Use with /game-refactor after /game-test.
disable-model-invocation: true
metadata:
  author: mileszeilstra
  version: 1.0.0
  category: game
---

# Refactor

## Overview

This is **FASE 4** of the gamedev workflow: plan -> define -> build -> test -> **refactor**

Batch-first architecture: analyzes ALL features in parallel via Explore agents, triages clean vs dirty, generates GDScript-aware refactor patterns via Context7, creates one combined plan with one approval, and applies changes with per-feature rollback.

**Trigger**: `/game-refactor` or `/game-refactor {feature-name}`

## Scope Rule: Feature Files Only

**This skill ONLY refactors files that belong to the feature.**

- Extract all code file paths from `02-build-log.md` — these are the **pipeline files**
- ONLY these files may be analyzed, planned, and modified
- **NEVER** touch, scan, plan, or modify files outside this list
- Valid path patterns: `scripts/`, `scenes/`, `resources/`, `tests/`
- **Exception:** New utility/helper scripts may be **created** if they exclusively extract code from pipeline files (e.g., extracting shared logic into a new `utils/` script). Existing external files may NEVER be modified.
- If a pattern scan or research finding points to an external file — skip it, do not include in plan
- If a DRY violation spans a pipeline file and an external file — only refactor the pipeline file side

This rule exists because refactoring external files risks breaking other features and creates unpredictable side effects.

## When to Use

- After `/game-test` completes with all playtest items passing
- When `.project/features/{name}/03-test-results.md` exists
- NOT for: fixing bugs (/game-test), adding features (/game-define), planning (/game-plan)

## Input

Reads from `.project/features/{feature-name}/`:

- `01-define.md` - Requirements and architecture
- `02-build-log.md` - Implementation details and file list
- `03-playtest.md` - Playtest checklist
- `03-test-results.md` - Verification results

## Output Structure

```
.project/features/{feature-name}/
├── 01-define.md          # Updated: Status: REFACTORED (or CLEAN)
├── 02-build-log.md       # From build phase
├── 03-playtest.md        # From build phase
├── 03-test-results.md    # From test phase
└── 04-refactor.md        # NEW: Refactor log (full or compact depending on findings)
```

## Two Research Layers

```
.claude/research/
├── architecture-baseline.md  ← EXISTING: Godot patterns, scene architecture, conventions
│                                Read in FASE 2 for research decision
│
└── refactor-patterns.md      ← NEW: GDScript-specific code smells & anti-patterns
                                 Generated via Context7 on first refactor
                                 Reused on subsequent refactors
```

**architecture-baseline.md** = "how to use Godot/GDScript correctly" (conventions)
**refactor-patterns.md** = "what mistakes to look for in GDScript code" (anti-patterns)

## Workflow

### FASE 0: Batch Context Loading + Refactor Patterns

1. **Read backlog for pipeline status:**

   Read `.project/backlog.html` (if exists), parse JSON uit `<script id="backlog-data">` blok (zie `shared/BACKLOG.md`):
   - Filter TST features: `data.features.filter(f => f.status === "TST")`
   - TST features zijn getest maar nog niet gerefactord

2. **Determine feature queue:**

   **a) Feature name provided** (`/game-refactor water-ability`):
   - Validate feature exists in `.project/features/`
   - Feature queue = `[water-ability]`

   **b) No feature name** (`/game-refactor`):
   - If TST features found in backlog: present them via **AskUserQuestion**:
     - header: "Refactor"
     - question: "Welke features wil je refactoren? ({N} features in TST status)"
     - options:
       - label: "Alle {N} features (Recommended)", description: "{feature1}, {feature2}, ..."
       - label: "Eén feature kiezen", description: "Selecteer een specifieke feature"
     - multiSelect: false
   - If "Alle features" — feature queue = all TST features
   - If "Eén feature kiezen" — show feature list via AskUserQuestion, queue = selected
   - If no TST features in backlog — fall back to listing `.project/features/` directories that have `03-test-results.md`

   **c) "recent"**: find most recently modified `03-test-results.md`, queue = `[that feature]`

3. **Load ALL feature docs for every feature in queue:**

   For each feature, read (in parallel where possible):
   - `01-define.md` for requirements and architecture
   - `02-build-log.md` for implementation details and file list
   - `03-playtest.md` for playtest items
   - `03-test-results.md` for verification results

   Validate `03-test-results.md` exists for each feature. If any missing — remove from queue and warn.

4. **Build pipeline files list per feature:**

   For each feature, extract all code file paths from `02-build-log.md`:
   - Primary: parse from `## Files Modified` table (file path column)
   - Fallback: grep for file paths matching `scripts/`, `scenes/`, `resources/`, `tests/`
   - Store as `pipeline_files[feature_name]`

5. **Load or generate refactor-patterns.md:**

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
```

### FASE 1: Parallel Batch Analysis + Triage

**Goal:** Analyze ALL features in parallel, then triage into CLEAN vs HAS_FINDINGS.

1. **Launch ALL Explore agents IN PARALLEL** (1 per feature, max 10 concurrent):

   For each feature, launch a Task agent (Explore) with this prompt:

   ```
   Feature: {feature-name}
   Pipeline files:
   {list of all pipeline_files paths for this feature}

   Lees ALLE bovenstaande pipeline files. Scan voor:

   1. UNIVERSEEL (altijd scannen):

      SECURITY:
      - Injection: OS.execute, ClassDB abuse
      - Unsafe deserialization: var_to_str/str_to_var with untrusted input
      - Path traversal in file operations

      DRY violations (ALLEEN binnen pipeline files):
      - Duplicate code blocks (>5 lines identiek)
      - Vergelijkbare logica patronen (>70% gelijkheid)
      - Herhaalde conditionals, copy-paste
      - Extract opportunities (zelfde code in 3+ locaties)

      OVER-ENGINEERING:
      - Helpers die maar 1x gebruikt worden
      - >3 indirectie-niveaus voor simpele operaties
      - Premature optimization (complexe caching voor non-hot paths)
      - Over-defensive code (try/catch rond code die niet kan falen)
      - Abstract base classes met maar 1 implementatie

      CLARITY:
      - Onnodige nesting (>3 niveaus diep)
      - Dense one-liners die readability opofferen voor beknoptheid
      - Slechte variabele/functienamen (single-letter, misleidend, te generiek)
      - Overbodige comments die obvious code beschrijven
      - "Clever" code die moeilijk te begrijpen is
      - Inconsistentie met project conventions uit CLAUDE.md

   2. GODOT-SPECIFIEK (altijd scannen):

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

   3. STACK-SPECIFIEK (uit refactor-patterns):

      {injected patterns from refactor-patterns.md}

   4. BALANCE (NIET rapporteren als finding):

      - Abstracties die meerdere keren hergebruikt worden
      - Expliciete signal connections voor clarity
      - Benoemde constanten zelfs als ze maar 1x gebruikt worden
      - Typed variables voor readability
      - Voorkeur voor explicit boven compact — meer regels is OK als het duidelijker is

   5. ARCHITECTUUR overzicht:
      - Welke Godot features/systems worden gebruikt
      - Belangrijkste patterns (state machines, signals, autoloads, etc.)
      - Scene composition patterns

   Geef terug als gestructureerd overzicht:
   ANALYSIS_START

   FEATURE: {feature-name}
   STATUS: CLEAN | HAS_FINDINGS

   ARCHITECTURE:
   Godot systems: {lijst van gebruikte systems}
   Patterns: {lijst van architectuurpatronen}
   Scene structure: {high-level scene composition}

   SECURITY_FINDINGS:
   - {file:line} {pattern} — {beschrijving} — Before: {code snippet}
   (of "Geen security issues gevonden")

   DRY_FINDINGS:
   - {file:line} ↔ {file:line} {type} — {beschrijving} — Code: {snippet}
   (of "Geen DRY violations gevonden")

   OVERENGINEERING_FINDINGS:
   - {file:line} {type} — {beschrijving} — Code: {snippet}
   (of "Geen over-engineering gevonden")

   GODOT_SPECIFIC_FINDINGS:
   - {file:line} {category} {pattern} — {beschrijving} — Code: {snippet}
   (of "Geen Godot-specifieke issues gevonden")

   CLARITY_FINDINGS:
   - {file:line} {type} — {beschrijving} — Code: {snippet}
   (of "Geen clarity issues gevonden")

   BALANCE_SKIPPED:
   - {file:line} {type} — {reden waarom dit NIET als finding is opgenomen}
   (optioneel — alleen als er items bewust gefilterd zijn)

   POSITIVE_OBSERVATIONS:
   - {wat al goed is in de codebase}

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

   CLEAN features — **early-exit**, skip FASE 2-4 entirely.

3. **If ALL features are CLEAN** — jump directly to FASE 5 (batch completion, no user approval needed).

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

### FASE 2: Aggregated Research Decision

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

   **If research NOT needed** — proceed directly to FASE 3.

   **If research needed** — spawn godot-code-researcher agent(s):

   | Agent                  | When to spawn                                             |
   | ---------------------- | --------------------------------------------------------- |
   | godot-code-researcher  | Complex Godot patterns, scene architecture, signal design |
   | performance-researcher | \_process bottlenecks, physics optimization, draw calls   |
   | resource-researcher    | Memory management, resource loading strategies            |

   Agent context includes:
   - **Aggregated analysis** from ALL affected features (ANALYSIS_START..ANALYSIS_END blocks)
   - Architecture baseline (if available)
   - Specific questions to answer
   - Context7 for Godot documentation

   **If uncovered patterns found** — also update refactor-patterns.md:
   - Context7 query for each uncovered Godot system
   - Append new sections to existing refactor-patterns.md

**Output:**

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
Research: {N} agents spawned ({list})
Reason: {why research was needed}
Refactor patterns updated: {yes/no}

→ Ready for combined plan.
```

---

### FASE 3: Combined Plan + Single Approval

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
   - question: "Welke verbeteringen wil je toepassen? ({M} totaal across {N} features)"
   - options:
     - label: "Alles toepassen (Recommended)", description: "Alle {M} verbeteringen in {N} features"
     - label: "Alleen HIGH + MED", description: "{X+Y} verbeteringen, skip LOW"
     - label: "Alleen HIGH", description: "{X} verbeteringen, alleen security/memory"
     - label: "Per feature kiezen", description: "Selecteer per feature welke verbeteringen je wilt"
   - multiSelect: false

   **If "Per feature kiezen"** — show per-feature AskUserQuestion with multiSelect:
   - header: "Features"
   - question: "Welke features wil je refactoren?"
   - options: one per feature with finding count
   - multiSelect: true

   Only approved features proceed to FASE 4. Non-selected features get CLEAN status.

   The user can also type "Annuleren" via the built-in "Other" option — EXIT with "Refactor geannuleerd door gebruiker"

---

### FASE 4: Apply + Test Per Feature

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

### FASE 5: Batch Completion

**Goal:** Proportional documentation, single backlog update, single commit.

1. **Create `04-refactor.md` per feature (proportional to findings):**

   **For CLEAN features (0 findings, early-exited at FASE 1):**

   ```markdown
   # Refactor Log: {feature-name}

   Generated: {timestamp}

   ## Summary

   | Metric   | Value                  |
   | -------- | ---------------------- |
   | Status   | CLEAN                  |
   | Findings | 0                      |
   | Analysis | Parallel Explore agent |

   ## Positive Observations

   - {observations from Explore agent's POSITIVE_OBSERVATIONS}

   No refactoring needed — code quality is good.
   ```

   **For REFACTORED features (had findings, successfully applied):**

   ```markdown
   # Refactor Log: {feature-name}

   Generated: {timestamp}

   ## Summary

   | Metric         | Value                        |
   | -------------- | ---------------------------- |
   | Status         | REFACTORED                   |
   | Scope          | {ALL / HIGH+MED / HIGH only} |
   | Improvements   | {count}                      |
   | Files modified | {count}                      |
   | GUT tests      | {X/X} passing                |

   ## What Was Improved

   - {high-level description}

   ## Key Decisions

   - {decision}: {rationale}

   ## Improvements

   ### Security

   - {file:line} - {issue} → {fix} → {result} (Risk: {L/M})

   ### Memory Management

   - {file:line} - {issue} → {fix} → {result} (Risk: {L/M})

   ### Performance

   - {file:line} - {issue} → {fix} → {result} (Risk: {L/M})

   ### Signals & Scene Tree

   - {file:line} - {issue} → {fix} → {result} (Risk: {L/M})

   ### DRY/Refactoring

   - {file:line} ↔ {file:line} - {extraction} → {result} (Risk: {L/M})

   ### Type Safety

   - {file:line} - {issue} → {fix} → {result} (Risk: {L/M})

   ### Clarity

   - {file:line} - {issue} → {fix} → {result} (Risk: {L/M})

   ## Positive Observations

   - {what was already done well}

   ## Modified Files

   - {file} - {description of changes}
   ```

   **For ROLLED_BACK features (had findings, apply/test failed):**

   ```markdown
   # Refactor Log: {feature-name}

   Generated: {timestamp}

   ## Summary

   | Metric               | Value                      |
   | -------------------- | -------------------------- |
   | Status               | ROLLED_BACK                |
   | Reason               | {test failure description} |
   | Planned improvements | {count}                    |

   ## What Was Attempted

   - {description of planned improvements}

   ## Failure Analysis

   - {which tests failed and why}
   - {whether it was a regression vs stale test}

   ## Pending Improvements

   - {improvements that could be retried with a more conservative approach}
   ```

2. **Update `01-define.md` for each feature:**
   - CLEAN: Set `Status: CLEAN` with date
   - REFACTORED: Set `Status: REFACTORED` with date
   - ROLLED_BACK: Set `Status: TST` (keep in TST, don't advance)

3. **Sync backlog** (zie `shared/BACKLOG.md`, single edit for all features):
   - Read `.project/backlog.html`, parse JSON uit `<script id="backlog-data">` blok
   - CLEAN en REFACTORED features: zet `.status = "DONE"`
   - ROLLED_BACK features: laat `.status = "TST"`
   - Zet `data.updated` naar huidige datum
   - Schrijf JSON terug via Edit tool (keep `<script>` tags intact)

4. **Context sync (conditional)** — only execute if REFACTORED features include structural changes:

   **Trigger condition** — execute this step if ANY of these apply across REFACTORED features:
   - Scripts were renamed or moved to different directories
   - New scripts were created via extraction (e.g., shared utils extracted from components)
   - Scene structure fundamentally changed
   - Autoload/singleton patterns changed

   **Skip this step if:**
   - All improvements were internal code quality only (naming, DRY, type hints, clarity)
   - Only performance optimizations without structural impact
   - No `.project/project.json` exists

   **Process (when triggered)** (zie `shared/DASHBOARD.md` → `context` sectie):

   a. Read `.project/project.json`
   b. Compare `modified_files` and `created_files` from FASE 4 against `context`
   c. Update affected keys:
   - Script paths that changed → update `context.structure` (overwrite full tree)
   - Extracted scripts/scenes → add to structure tree
   - Changed patterns → update `context.patterns` (merge)
   - Set `context.updated` to current date
     d. **Apply directly** (no user confirmation)
     e. Quality rules:
   - Only project-specific, non-obvious information
   - One line per item, concise
   - Each item must earn its place
     f. Log:

   ```
   context: {N} updates ({keys touched})
   ```

   Or: `context: no updates needed (internal changes only)`

5. **Scoped auto-commit** (only this skill's changes):

   Compare current git status with baseline from FASE 0:

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

   Clean up: `rm -f .project/session/pre-skill-status.txt /tmp/current-status.txt`

   **IMPORTANT:** Do NOT add Co-Authored-By or Generated with Claude Code footer to pipeline commits.

6. **Show completion:**

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

   All phases completed:
   ✓ /game-plan - Planning
   ✓ /game-define - Definition
   ✓ /game-build - Implementation
   ✓ /game-test - Verification
   ✓ /game-refactor - Refactoring

   Ready for next feature!
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   ```

---

## Error Handling

### Context Loading Failures

**No features found** — exit: "Run /game-define and /game-build first"
**No test results for any feature** — exit: "Run /game-test first"
**Some features missing test results** — remove from queue, warn, continue with rest
**Build log empty** — skip feature, warn: "No code files found in 02-build-log.md for {feature}"

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

1. Show the `saved_hash` from FASE 4 step 1
2. List all `modified_files[feature_name]` and `created_files[feature_name]`
3. Suggest: "Gebruik `/rewind` in Claude Code om terug te gaan naar een eerder punt"
4. STOP — do not attempt destructive recovery commands

## Restrictions

This skill must NEVER:

- Read pipeline source files directly in the main conversation (always use Explore agent)
- Pass full file contents to research agents (pass structured analysis from Explore agent)
- Analyze, plan, or modify files outside pipeline_files (extracted from 02-build-log.md)
- Include external file findings in any plan
- Proceed without existing 03-test-results.md
- Make breaking changes (signal signatures, exported variables, public methods)
- Over-simplify code by removing helpful abstractions or combining too many concerns
- Prioritize fewer lines over readability (explicit > compact)
- Create "clever" solutions that are hard to understand or debug
- Skip user approval at FASE 3 (unless 0 findings across all features)
- Skip GUT test verification in FASE 4
- Proceed if tests fail without analyzing failure type first (stale test vs regression)
- Apply improvements without user scope selection
- Add Co-Authored-By or Generated with Claude Code footer to commits
- Run Explore agents sequentially when multiple features are in the queue (use parallel)
- Create disproportionate documentation for clean features

This skill must ALWAYS:

- Enforce the pipeline_files scope boundary at every phase
- Launch Explore agents in parallel for batch analysis (max 10 concurrent)
- Triage features into CLEAN vs HAS_FINDINGS after analysis
- Early-exit CLEAN features (skip FASE 2-4)
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
- Check CLAUDE.md and `.project/project.json` context for project-specific conventions during analysis
