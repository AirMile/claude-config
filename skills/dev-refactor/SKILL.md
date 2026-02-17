---
name: dev-refactor
description: Batch refactor code quality after testing with parallel analysis, dynamic stack-aware patterns, and early-exit for clean features. Use with /dev-refactor to improve code structure, naming, and patterns.
disable-model-invocation: true
metadata:
  author: mileszeilstra
  version: 2.0.0
  category: dev
---

# Refactor

## Overview

This is **FASE 4** of the dev workflow: define -> build -> test -> **refactor**

Batch-first architecture: analyzes ALL features in parallel via Explore agents, triages clean vs dirty, generates stack-aware refactor patterns via Context7, creates one combined plan with one approval, and applies changes with per-feature rollback.

**Trigger**: `/dev:refactor` or `/dev:refactor {feature-name}`

## Scope Rule: Feature Files Only

**This skill ONLY refactors files that belong to the feature.**

- Extract all code file paths from `02-build-log.md` → these are the **pipeline files**
- ONLY these files may be analyzed, planned, and modified
- **NEVER** touch, scan, plan, or modify files outside this list
- **Exception:** New utility/helper files may be **created** if they exclusively extract code from pipeline files (e.g., extracting shared logic into a new `utils/` file). Existing external files may NEVER be modified.
- If a pattern scan or research finding points to an external file → skip it, do not include in plan
- If a DRY violation spans a pipeline file and an external file → only refactor the pipeline file side

This rule exists because refactoring external files risks breaking other features and creates unpredictable side effects.

## When to Use

- After `/dev:test` completes with all tests passing
- When `.workspace/features/{name}/03-test-results.md` exists
- NOT for: fixing bugs (/dev:test), adding features (/dev:define), planning (/dev:define)

## Input

Reads from `.workspace/features/{feature-name}/`:

- `01-define.md` - Requirements and architecture
- `02-build-log.md` - Implementation details and file list
- `03-test-checklist.md` - Test items
- `03-test-results.md` - Verification results

## Output Structure

```
.workspace/features/{feature-name}/
├── 01-define.md          # Updated: Status: REFACTORED (or CLEAN)
├── 02-build-log.md       # From build phase
├── 03-test-checklist.md  # From build phase
├── 03-test-results.md    # From test phase
└── 04-refactor.md        # NEW: Refactor log (full or compact depending on findings)
```

## Two Research Layers

```
.claude/research/
├── stack-baseline.md          ← EXISTING: library conventions/patterns/pitfalls
│                                 (React hooks, Tailwind v4, GSAP cleanup, etc.)
│                                 Read in FASE 2 for research decision
│
└── refactor-patterns.md       ← NEW: stack-specific code smells & anti-patterns
                                  Generated via Context7 on first refactor
                                  Reused on subsequent refactors
```

**stack-baseline.md** = "how to use these libraries correctly" (conventions)
**refactor-patterns.md** = "what mistakes to look for in code using these libraries" (anti-patterns)

## Workflow

### FASE 0: Batch Context Loading + Refactor Patterns

1. **Read backlog for pipeline status:**

   Read `.workspace/backlog.md` (if exists) to understand current state:
   - Which features are in which phase (TODO, DEF, BLT, TST, DONE)
   - Collect ALL features in `### TST` section — these are tested but not yet refactored

2. **Determine feature queue:**

   **a) Feature name provided** (`/dev:refactor auth`):
   - Validate feature exists in `.workspace/features/`
   - Feature queue = `[auth]`

   **b) No feature name** (`/dev:refactor`):
   - If TST features found in backlog: present them via **AskUserQuestion**:
     - header: "Refactor"
     - question: "Welke features wil je refactoren? ({N} features in TST status)"
     - options:
       - label: "Alle {N} features (Recommended)", description: "{feature1}, {feature2}, ..."
       - label: "Eén feature kiezen", description: "Selecteer een specifieke feature"
     - multiSelect: false
   - If "Alle features" → feature queue = all TST features
   - If "Eén feature kiezen" → show feature list via AskUserQuestion, queue = selected
   - If no TST features in backlog → fall back to listing `.workspace/features/` directories that have `03-test-results.md`

   **c) "recent"**: find most recently modified `03-test-results.md`, queue = `[that feature]`

3. **Load ALL feature docs for every feature in queue:**

   For each feature, read (in parallel where possible):
   - `01-define.md` for requirements and architecture
   - `02-build-log.md` for implementation details and file list
   - `03-test-checklist.md` for test items
   - `03-test-results.md` for verification results

   Validate `03-test-results.md` exists for each feature. If any missing → remove from queue and warn.

4. **Build pipeline files list per feature:**

   For each feature, extract all code file paths from `02-build-log.md`:
   - Primary: parse from `## Files Modified` table (file path column)
   - Fallback: grep for file paths matching `src/`, `app/`, `lib/`, `components/`, etc.
   - Store as `pipeline_files[feature_name]`

5. **Load or generate refactor-patterns.md:**

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

   **Format for refactor-patterns.md:**

   ```markdown
   # Refactor Patterns

   <!-- Generated via Context7 for: {stack list} -->
   <!-- Regenerate: delete this file and run /dev:refactor -->

   ## {Library Name}

   ### Performance Anti-patterns

   - {pattern}: {description} — {what to look for in code}

   ### Security Anti-patterns

   - {pattern}: {description} — {what to look for in code}

   ### Code Organization Anti-patterns

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
      - Injection: exec(, eval(, new Function, os.system
      - XSS: .innerHTML =, dangerouslySetInnerHTML, document.write
      - Deserialization: pickle
      - GitHub Actions: ${{ github.event. in run: commands

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
      - Over-generic types die maar op 1 plek gebruikt worden

      CLARITY:
      - Onnodige nesting (>3 niveaus diep)
      - Nested ternary operators → prefer switch/if-else
      - Dense one-liners die readability opofferen voor beknoptheid
      - Slechte variabele/functienamen (single-letter, misleidend, te generiek)
      - Overbodige comments die obvious code beschrijven
      - "Clever" code die moeilijk te begrijpen is
      - Inconsistentie met project conventions uit CLAUDE.md
      - Violations van `../shared/RULES.md` — Algemeen + TypeScript secties (R007-R008, T001-T203)

      BALANCE (NIET rapporteren als finding):
      - Abstracties die meerdere keren hergebruikt worden
      - Helper functies die code DRY houden
      - Expliciete error handling in externe boundaries (API, user input)
      - Benoemde constanten zelfs als ze maar 1x gebruikt worden (als ze readability verbeteren)
      - Voorkeur voor explicit boven compact — meer regels is OK als het duidelijker is

   2. STACK-SPECIFIEK (uit refactor-patterns):

      {injected patterns per library from refactor-patterns.md}

   3. ARCHITECTUUR overzicht:
      - Welke libraries/frameworks worden gebruikt
      - Belangrijkste patterns (hooks, API routes, components, etc.)
      - Libraries die NIET in refactor-patterns.md staan

   Geef terug als gestructureerd overzicht:
   ANALYSIS_START

   FEATURE: {feature-name}
   STATUS: CLEAN | HAS_FINDINGS

   ARCHITECTURE:
   Libraries: {lijst van libraries/frameworks}
   Patterns: {lijst van architectuurpatronen}
   Uncovered libraries: {libraries niet in refactor-patterns.md}

   SECURITY_FINDINGS:
   - {file:line} {pattern} — {beschrijving} — Before: {code snippet}
   (of "Geen security issues gevonden")

   DRY_FINDINGS:
   - {file:line} ↔ {file:line} {type} — {beschrijving} — Code: {snippet}
   (of "Geen DRY violations gevonden")

   OVERENGINEERING_FINDINGS:
   - {file:line} {type} — {beschrijving} — Code: {snippet}
   (of "Geen over-engineering gevonden")

   STACK_SPECIFIC_FINDINGS:
   - {file:line} {library} {pattern} — {beschrijving} — Code: {snippet}
   (of "Geen stack-specifieke issues gevonden")

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
   1. If TaskOutput contains `ANALYSIS_START` → parse directly
   2. If truncated (no `ANALYSIS_START` visible):
      - Use **Grep** to find `ANALYSIS_START` in the output file
      - Use **Read** with line offset to extract the structured block
   3. Extract STATUS field: `CLEAN` or `HAS_FINDINGS`

2. **Triage results:**

   Classify each feature:
   - **CLEAN**: STATUS = CLEAN (0 findings across all categories)
   - **HAS_FINDINGS**: STATUS = HAS_FINDINGS (1+ findings)

   CLEAN features → **early-exit**, skip FASE 2-4 entirely.

3. **If ALL features are CLEAN** → jump directly to FASE 5 (batch completion, no user approval needed).

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

   **If research NOT needed** → proceed directly to FASE 3.

   **If research needed** → spawn only the relevant research agents:

   | Agent                     | When to spawn                                       |
   | ------------------------- | --------------------------------------------------- |
   | security-researcher       | Security patterns found OR auth/crypto/input flows  |
   | performance-researcher    | N+1 patterns, heavy loops, or caching opportunities |
   | quality-researcher        | Complex abstractions or unclear patterns            |
   | error-handling-researcher | Missing error handling in critical paths            |

   Agent context includes:
   - Tech stack (from CLAUDE.md)
   - **Aggregated analysis** from ALL affected features (ANALYSIS_START..ANALYSIS_END blocks)
   - Stack baseline (if available)
   - Specific questions to answer

   **If uncovered libraries found** → also update refactor-patterns.md:
   - Context7 query for each uncovered library
   - Append new sections to existing refactor-patterns.md

**Output:**

```
RESEARCH DECISION

| Source | Libraries Covered |
|--------|------------------|
| stack-baseline.md | {list} |
| refactor-patterns.md | {list} |
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
   - **Cross-feature deduplication**: same pattern in multiple files → 1 plan item with multiple locations
   - Each improvement gets impact level: 🔴 HIGH / 🟡 MED / 🟢 LOW
   - Sort: HIGH first (security), then MED (performance, DRY), then LOW (clarity, quality, simplification)
   - **Only pipeline files** may be included
   - Group by feature for clarity

2. **Present improvements with before/after code:**

   ```
   REFACTOR PLAN ({N} features, {M} improvements)

   🔴 HIGH: [X] improvements (security)
   🟡 MED: [Y] improvements (performance, DRY, error handling)
   🟢 LOW: [Z] improvements (code quality, simplification)

   ── {feature-1} ──

   1. 🔴 {file}:{line} — {issue} → {fix}
      Before: {code snippet}
      After:  {proposed change}

   2. 🟡 {file}:{line} — {issue} → {fix}
      Before: {code snippet}
      After:  {proposed change}

   ── {feature-2} ──

   3. 🟡 {file}:{line} — {issue} → {fix}
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
     - label: "Alleen HIGH", description: "{X} verbeteringen, alleen security"
     - label: "Per feature kiezen", description: "Selecteer per feature welke verbeteringen je wilt"
   - multiSelect: false

   **If "Per feature kiezen"** → show per-feature AskUserQuestion with multiSelect:
   - header: "Features"
   - question: "Welke features wil je refactoren?"
   - options: one per feature with finding count
   - multiSelect: true

   Only approved features proceed to FASE 4. Non-selected features get CLEAN status.

   The user can also type "Annuleren" via the built-in "Other" option → EXIT with "Refactor geannuleerd door gebruiker"

---

### FASE 4: Apply + Test Per Feature

**Goal:** Apply approved improvements and test, with per-feature rollback isolation.

**Priority order for each feature (execute in this sequence):**

1. Security improvements
2. Performance optimizations
3. DRY/Refactoring improvements
4. Simplification (remove over-engineering)
5. Clarity (readability improvements)
6. Code quality improvements
7. Error handling improvements

**Steps:**

1. **Initialize change tracking:**

   ```bash
   git rev-parse HEAD  # Store as saved_hash for global rollback
   ```

2. **For each feature with approved improvements:**

   a. **Track files for targeted rollback** (no git stash needed — file-level tracking is sufficient):

   Initialize empty lists: `modified_files[feature_name] = []`, `created_files[feature_name] = []`

   b. **Apply improvements using Edit tool:**
   - Follow priority order strictly
   - **Re-read each file immediately before editing** (prevents "File has not been read yet" errors)
   - Group edits by file: read file → apply ALL edits for that file → move to next file
   - **Only modify files in pipeline_files list** — assert before each edit
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

- No API signature changes
- No database schema modifications
- No breaking parameter changes
- No removal of public methods/functions
- Preserve all existing behavior
- If breaking change needed → skip that improvement and note it

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
   | Tests          | {X/X} passing                |

   ## What Was Improved

   - {high-level description}

   ## Key Decisions

   - {decision}: {rationale}

   ## Improvements

   ### Security

   - {file:line} - {issue} → {fix} → {result} (Risk: {L/M})

   ### Performance

   - {file:line} - {issue} → {fix} → {result} (Risk: {L/M})

   ### DRY/Refactoring

   - {file:line} ↔ {file:line} - {extraction} → {result} (Risk: {L/M})

   ### Simplification

   - {file:line} - {removed} → {simplified} (Risk: {L/M})

   ### Clarity

   - {file:line} - {issue} → {fix} → {result} (Risk: {L/M})

   ### Quality

   - {file:line} - {issue} → {fix} → {result} (Risk: {L/M})

   ### Error Handling

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

3. **Sync backlog (single edit for all features):**
   - Read `.workspace/backlog.md`
   - Move CLEAN and REFACTORED features from `### TST` to `### DONE`
   - ROLLED_BACK features stay in `### TST`
   - In DONE: dependency arrow `->` changes to description `-`
   - Update section header counts: `({done}/{total} done)`
   - Update "Updated" timestamp
   - Update "Next" suggestion

4. **CLAUDE.md Auto-Sync (conditional)** — only execute if REFACTORED features include structural changes:

   **Trigger condition** — execute this step if ANY of these apply across REFACTORED features:
   - Files were renamed or moved to different directories
   - New files were created via extraction (e.g., shared utils extracted from components)
   - Patterns fundamentally changed (e.g., state management approach, routing structure)

   **Skip this step if:**
   - All improvements were internal code quality only (naming, DRY, simplification, clarity)
   - Only performance optimizations without structural impact
   - No CLAUDE.md exists in the project root

   **Process (when triggered):**

   a. Read the current `CLAUDE.md`
   b. Compare `modified_files` and `created_files` from FASE 4 against CLAUDE.md content
   c. Update affected sections:
   - File paths that changed → update in `## Project structuur`
   - Extracted components/hooks → add to structure tree
   - Changed patterns → update `## Non-obvious patterns`
     d. **Apply directly** (no user confirmation)
     e. Follow core-md-audit quality rules:
   - Only project-specific, non-obvious information
   - One line per item, concise
   - Each line must earn its place in the context window
     f. Log:

   ```
   CLAUDE.md: {N} updates ({sections touched})
   ```

   Or: `CLAUDE.md: no updates needed (internal changes only)`

5. **Single auto-commit for everything:**

   ```bash
   git add .
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

   For single-feature commits, use the existing format:

   ```
   refactor({feature}): {summary}
   ```

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
   ✓ /dev:define - Definition
   ✓ /dev:build - Implementation
   ✓ /dev:test - Verification
   ✓ /dev:refactor - Refactoring

   Ready for production!

   Next feature from backlog:
   → /dev:define {next-feature}
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   ```

---

## Error Handling

### Context Loading Failures

**No features found** → exit: "Run /dev:define and /dev:build first"
**No test results for any feature** → exit: "Run /dev:test first"
**Some features missing test results** → remove from queue, warn, continue with rest
**Build log empty** → skip feature, warn: "No code files found in 02-build-log.md for {feature}"

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
- Make breaking changes (API, schema, parameter changes)
- Over-simplify code by removing helpful abstractions or combining too many concerns
- Prioritize fewer lines over readability (explicit > compact)
- Create "clever" solutions that are hard to understand or debug
- Skip user approval at FASE 3 (unless 0 findings across all features)
- Skip test verification in FASE 4
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
- Use refactor-patterns.md for stack-aware analysis (generate on first run, cache thereafter)
- Aggregate research decisions across all features (1 decision, not N)
- Present ONE combined plan with ONE user approval for all features
- Deduplicate cross-feature findings (same pattern → 1 plan item)
- Apply per-feature rollback (feature A succeeds, feature B fails → only B rolled back)
- Write proportional documentation (compact for CLEAN, full for REFACTORED)
- Make a single commit for all features
- Re-read each file immediately before editing (prevents "File has not been read yet" errors)
- Group edits by file: read file → apply ALL edits for that file → next file
- Run full test suite after applying changes per feature
- Analyze test failures before rollback (distinguish stale tests from regressions)
- Apply balance filter: skip findings where the "fix" reduces readability
- Check CLAUDE.md for project-specific coding conventions during analysis
