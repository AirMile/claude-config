---
name: dev-build
description: Build features with automatic stack detection and TDD or implementation-first technique selection. Use with /dev-build after /dev-define. Reads requirements from workspace and builds sequentially.
disable-model-invocation: true
metadata:
  author: mileszeilstra
  version: 1.0.0
  category: dev
---

# Build

## Overview

This is **FASE 2** of the dev workflow: define -> **build** -> test

Auto-detects stack from CLAUDE.md, selects technique per requirement (TDD or Implementation First), then builds sequentially.

**Trigger**: `/dev-build` or `/dev-build [feature-name]`

## Input

Reads from `.workspace/features/{feature-name}/01-define.md`:

- Requirements with IDs (REQ-XXX)
- Architecture design
- Implementation order

## Output Structure

```
.workspace/features/{feature-name}/
├── 01-define.md
├── 02-build-log.md
└── 03-test-checklist.md
```

## Process

### FASE 0: Stack Detection & Context Loading

**Step 1: Detect Stack**

1. Read `.claude/CLAUDE.md`
2. Find `### Stack` section under `## Project`
3. Parse stack type and testing framework

**Step 2: Load Context**

Optionally load stack-baseline for project-specific patterns:

- `.claude/research/stack-baseline.md` (if exists)

**Step 3: Load Feature Context**

1. If no feature name provided:

   **a) Check backlog for context:**

   Read `.workspace/backlog.md` (if exists) to understand pipeline status:
   - Which features are in which phase (TODO, DEF, BLT, TST, DONE)
   - Parse the `**Next:**` line for the suggested next feature
   - Use this to pre-select the most logical feature to build (status: DEF = defined, ready for build)

   **b) Select feature:**
   - If backlog suggests a DEF feature → propose it via **AskUserQuestion**
   - Otherwise → list available features in `.workspace/features/`
   - Use **AskUserQuestion** to let user select

2. Load `01-define.md`:
   - Extract all requirements (REQ-XXX format)
   - Parse architecture design
   - Extract implementation order

3. Display:

   ```
   FEATURE: {feature-name}

   REQUIREMENTS:
   - REQ-001: [description]
   - REQ-002: [description]

   IMPLEMENTATION ORDER:
   (from 01-define.md)
   ```

**Capture git baseline** (for scoped commit at end of skill):

```bash
mkdir -p .workspace/session
git status --porcelain | sort > .workspace/session/pre-skill-status.txt
```

### FASE 1: Technique Mapping (Per Requirement)

Analyze EACH requirement individually and assign a technique:

```
For each REQ-XXX:
  IF requirement involves:
    - validation rules, business logic, calculations, complex conditions
    → TDD

  IF requirement involves:
    - CRUD, middleware, config, straightforward wiring
    → Implementation First

  DEFAULT → Implementation First
```

Display technique map:

```
TECHNIQUE MAP:

| REQ     | Technique            | Reason               |
|---------|----------------------|----------------------|
| REQ-001 | TDD                  | validation logic     |
| REQ-002 | Implementation First | CRUD endpoint        |
| REQ-003 | TDD                  | business rules       |
```

Use **AskUserQuestion** tool:

- header: "Technique Map"
- question: "Akkoord met deze technique-toewijzing?"
- options:
  - label: "Akkoord (Recommended)", description: "Start build met deze TDD/Implementation First verdeling"
  - label: "Aanpassen", description: "Ik wil de technique-toewijzing wijzigen"
- multiSelect: false

**If "Aanpassen"** → ask which requirements should change technique, update map, re-display.

### FASE 2: Execute Build (Per Requirement)

For each requirement in IMPLEMENTATION ORDER:

1. Load technique resource:
   ```
   Read(".claude/skills/dev-build/techniques/{assigned-technique}.md")
   ```
2. Execute the technique workflow for THIS requirement
3. Output per requirement:
   ```
   [REQ-XXX] {description}
   Technique: {TDD | Implementation First}
   {technique-specific output}
   SYNC: {pattern/concept} in {file(s)} — {1-2 sentences: what, why, what depends on it}
   Progress: {done}/{total}
   ```

After all requirements complete: run integration tests across requirements.

**Shared rules:**

- `../shared/RULES.md` — Algemeen (R007-R008) en TypeScript rules (T001-T103) voor code quality
- Requirements implemented SEQUENTIALLY (dependency order from 01-define.md)
- Context7 research if unfamiliar pattern needed
- All requirements must have tests before completion

### FASE 3: Generate Test Checklist

Create `03-test-checklist.md`:

```markdown
# Test Checklist: {Feature}

## Build Summary

**Feature:** {feature-name}
**Build Date:** {date}
**Techniques:** TDD ({n}), Implementation First ({n})
**Tests:** {passed}/{total} passing

## Automated Tests Status

| REQ     | Technique | Test               | Status |
| ------- | --------- | ------------------ | ------ |
| REQ-001 | TDD       | {test description} | PASS   |

## Files Created

{list of created/modified files}

## Manual Testing Required

### Checklist

| #   | Test               | Pass | Notes |
| --- | ------------------ | ---- | ----- |
| 1   | {test description} | [ ]  |       |

## Feedback Format

Use `/dev-test {feature}` with results:
```

1:PASS
2:FAIL {reason}

```

```

### FASE 4: Completion

**Step 1: Update build log**

Create/update `02-build-log.md` with this template:

```markdown
# Build Log: {feature-name}

## Summary

| Metric     | Value                                 |
| ---------- | ------------------------------------- |
| Feature    | {feature-name}                        |
| Build Date | {date}                                |
| Techniques | TDD ({n}), Implementation First ({n}) |
| Tests      | {passed}/{total} passing              |

## Requirements Built

{for each requirement in implementation order:}

### REQ-XXX: {description}

- **Technique:** {TDD | Implementation First}
- **Files:** {files created/modified}
- **Tests:** {test file(s)}
- **SYNC:** {pattern/concept} in {file(s)} — {what, why, what depends on it}

## Integration Tests

{integration test results}

## Blockers

{blockers encountered, or "Geen"}

## Codebase Sync

{filled in after step 3}
```

**Step 2: Build summary**

```
BUILD COMPLETE: {feature}
========================

Techniques: TDD ({n}), Implementation First ({n})
Tests: {passed}/{total} PASS
Files created: {count}

Documentation:
- .workspace/features/{feature}/02-build-log.md
- .workspace/features/{feature}/03-test-checklist.md
```

**Step 3: Codebase Sync — interactief gesprek**

De Codebase Sync is het belangrijkste onderdeel van de build. Het doel: de gebruiker begrijpt hoe de gebouwde feature werkt, zodat hij goede beslissingen kan nemen in test- en refactor-fases.

**3a) Claude legt uit** — alsof je het aan een student uitlegt. Geen jargon, geen aannames over voorkennis. Drie onderdelen:

- **Wat doet het?**: wat de feature doet in 1-2 simpele zinnen, alsof je het aan iemand uitlegt die de code niet kent
- **Hoe ziet het eruit?**: 1-2 ASCII diagrammen die de architectuur visueel maken. Kies het meest relevante type:
  - **Data flow**: request → handler → service → database (voor API/backend features)
  - **Component diagram**: welke modules/files met elkaar praten (voor multi-file features)
  - **State diagram**: state transitions (voor features met state management)
  - Hou diagrammen compact (max 15 regels per diagram). Gebruik box-drawing characters (┌─┐│└─┘) en pijlen (→ ← ↓ ↑).

  ```
  Example:
  ┌──────────┐    ┌───────────┐    ┌──────────┐
  │  Route   │───→│  Service  │───→│ Database │
  │ POST /api│    │ validate  │    │  users   │
  └──────────┘    │ transform │    └──────────┘
                  └───────────┘
  ```

- **Hoe werkt het onder de motorkap?**: de data flow stap voor stap, met concrete voorbeelden ("als een gebruiker X doet, dan gebeurt Y")
- **Waar moet je op letten?**: alleen niet-voor-de-hand-liggende keuzes — leg uit _waarom_, niet alleen _wat_

**3b) Begripscheck** — via **AskUserQuestion**:

Vraag: "Snap je hoe de feature werkt?"

Opties:

- "Ja, helder"
- "Leg het uitgebreider uit" — "Geef een stap-voor-stap uitleg met voorbeelden, alsof ik nieuw ben in programmeren"
- "Ik heb een vraag"

**3c) Follow-up loop** — als de gebruiker iets niet snapt:

1. Beantwoord de vraag of leg dieper uit
2. Stel opnieuw de begripscheck (herhaal 3b)
3. Herhaal tot de gebruiker "Ja, helder" bevestigt

**Step 4: Na bevestiging**

1. Schrijf de sync naar `02-build-log.md` onder `## Codebase Sync` — schrijf de uitleg zoals gegeven in het gesprek (geen template, gewone taal)

2. **CLAUDE.md Auto-Sync** — update project documentation with build changes:

   a. Read the current `CLAUDE.md` in the project root. If no CLAUDE.md exists, skip this step.

   b. Compare the build output (`02-build-log.md` files list + Codebase Sync conversation) against CLAUDE.md content. Identify gaps:

   | Change Type                                      | CLAUDE.md Section to Update            |
   | ------------------------------------------------ | -------------------------------------- |
   | New components/hooks/pages added                 | `## Project structuur` (add to tree)   |
   | New routes created                               | `## Routing` (add route)               |
   | New non-obvious patterns discovered during build | `## Non-obvious patterns` (add bullet) |
   | New environment variables or config required     | Relevant config section                |

   c. **Apply updates directly** (no user confirmation — this is part of the build flow).

   d. **Quality rules** — follow core-md-audit guidelines strictly:
   - Only add project-specific, non-obvious information
   - One line per item, concise
   - No generic best practices or obvious info
   - No additions if the change is already covered in CLAUDE.md
   - No additions for purely internal implementation details (private helpers, local state)
   - Each line must earn its place in the context window

   e. **Skip entirely if:**
   - All changes are already reflected in CLAUDE.md
   - The feature only adds internal logic without structural impact
   - No CLAUDE.md exists in the project root

   f. Log what was updated:

   ```
   CLAUDE.md: {N} updates ({list of sections touched})
   ```

   Or if nothing changed:

   ```
   CLAUDE.md: no updates needed
   ```

3. Move feature from `### DEF` to `### BLT` in `.workspace/backlog.md`
4. **Scoped auto-commit** (only this skill's changes):

   Compare current git status with baseline from FASE 0:

   ```bash
   git status --porcelain | sort > /tmp/current-status.txt
   ```

   Categorize files by comparing with `.workspace/session/pre-skill-status.txt`:
   - **NEW** (only in current, not in baseline) → `git add` automatically
   - **OVERLAP** (in both baseline AND current) → warn user via AskUserQuestion: "These files had pre-existing uncommitted changes and were also modified by this skill: {list}. Include in commit?" Options: "Include (Recommended)" / "Skip"
   - **PRE-EXISTING** (only in baseline) → do NOT stage

   If baseline file doesn't exist, fall back to `git add -A`.

   ```bash
   git commit -m "$(cat <<'EOF'
   build({feature}): {n} requirements ({tdd} TDD, {impl} impl-first)
   EOF
   )"
   ```

   Clean up: `rm -f .workspace/session/pre-skill-status.txt /tmp/current-status.txt`

   **IMPORTANT:** Do NOT add Co-Authored-By or Generated with Claude Code footer to pipeline commits.

5. Toon: **Next step:** `/dev-test {feature}`
6. Build is officieel compleet

## Test Output Parsing (CRITICAL)

Condense all test output to this format. Omit stack traces, framework banners, and verbose output.

**PASS:** `TESTS: {n}/{n} PASS ({time})`

**FAIL:**

```
TESTS: {passed}/{total} PASS ({time})
FAILED:
- {file}:{line} - {reason <50 chars}
```

## Stack-Specific Behavior

Determine test commands, file extensions, mocking approach, and async patterns from:

1. `### Testing` section in CLAUDE.md
2. Stack-baseline patterns (`.claude/research/stack-baseline.md`)
3. Claude's own knowledge of the detected framework

## Error Handling

### Test Failures

If a test fails unexpectedly:

1. Log the failure
2. Analyze the error
3. Fix the implementation
4. Re-run test
5. Continue only when PASS

### Build Blockers

If implementation is blocked:

1. Log the blocker in 02-build-log.md
2. Mark affected requirements as BLOCKED
3. Continue with other requirements
4. Report blockers at completion

## Troubleshooting

### Error: Stack not detected

**Cause:** No `### Stack` section found in CLAUDE.md.
**Solution:** Run `/core-setup` first, or manually add a `### Stack` section under `## Project` in CLAUDE.md.

### Error: No define file found

**Cause:** Missing `.workspace/features/{name}/01-define.md`.
**Solution:** Run `/dev-define {name}` first to create the feature definition.

### Error: Tests fail after implementation

**Cause:** TDD cycle not completing — test expectations may not match implementation.
**Solution:** Check the test output carefully. If the test itself is wrong, fix the test first, then re-run. The RED-GREEN-REFACTOR cycle should catch this.

### Error: Technique detection picks wrong approach

**Cause:** Requirement type misidentified (TDD vs Implementation First).
**Solution:** You can override technique selection. If a requirement has clear testable behavior, use TDD. If it's UI/visual, use Implementation First.
