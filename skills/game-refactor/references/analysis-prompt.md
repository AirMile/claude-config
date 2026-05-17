# PHASE 1: Parallel Batch Analysis + Triage

**Goal:** Analyze ALL features in parallel, then triage into CLEAN vs HAS_FINDINGS.

## Step 1 — Launch Explore agents (1 per feature, max 10 concurrent)

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

## Step 1 — Parsing agent results

For each completed Explore agent:

1. If TaskOutput contains `ANALYSIS_START` — parse directly
2. If truncated (no `ANALYSIS_START` visible):
   - Use **Grep** to find `ANALYSIS_START` in the output file
   - Use **Read** with line offset to extract the structured block
3. Extract STATUS field: `CLEAN` or `HAS_FINDINGS`

## Step 2 — Triage results

Classify each feature:

- **CLEAN**: STATUS = CLEAN (0 findings across all categories)
- **HAS_FINDINGS**: STATUS = HAS_FINDINGS (1+ findings)

CLEAN features — **early-exit**, skip PHASE 2-4 entirely.

If ALL features are CLEAN — jump directly to PHASE 5 (batch completion, no user approval needed).

## Output

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
