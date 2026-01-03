---
description: Refines implemented features with small functional changes
---

# Refine Skill

## Overview

This skill enables quick functional adjustments to existing implemented features. It provides a streamlined workflow combining research, implementation, and verification specifically designed for design choice modifications - when users want different functionality rather than code quality improvements.

The skill is for small, non-breaking functional changes that don't require full planning cycles. Examples include changing image upload to file upload, converting single-select to multi-select, or switching from modal to inline form.

**Trigger**: `/4-refine` command after a feature has been implemented via /2-code

## When to Use

This skill activates in the following scenarios:

**Primary use:**
- User wants to change HOW a feature works (design choice)
- Small functional modifications to existing implementation
- Feature has existing `02-implementation.md` file

**Example scenarios:**
- Image upload → File upload (different file types)
- Single select → Multi select (different behavior)
- Modal form → Inline form (different presentation)
- Pagination → Infinite scroll (different loading)
- Add extra field to existing form
- Change API response format

**NOT for:**
- New features from scratch (use /1-plan + /2-code)
- Code quality improvements (use /5-refactor)
- Security hardening (use /5-refactor)
- Performance optimization (use /5-refactor)
- Architecture changes (use /1-plan with change mode)
- Database migrations (use /1-plan with extend/change mode)

**Scope criteria (must ALL be true):**
- Max 3-5 files substantially modified
- No database migrations required
- No new dependencies (minor updates OK)
- No new routes/endpoints (only modify existing)
- Existing component structure preserved

**If scope too large:**
```
⚠️ SCOPE TOO LARGE FOR /4-refine

This modification requires:
- [reason: new migrations / new dependencies / architecture change]

Use /1-plan with 'change' mode instead:
/1-plan change {feature-name}
```

## Workflow

The skill operates through six phases. Execute each phase sequentially with user approval at FASE 3.

### FASE 0: FEATURE SELECTION

**Goal:** Let user select which feature to refine from available features.

**Steps:**

1. **Check if feature name provided with command:**

   **If user ran `/4-refine {feature-name}`:**
   - Skip numbered list
   - Use provided feature name directly
   - Validate it exists in `.workspace/{feature-name}/02-implementation.md`
   - If valid: proceed to step 5 (ask for modification)
   - If invalid: show error, then fall back to numbered list (step 2)

   **If user ran `/4-refine` without arguments:**
   - Proceed to step 2 (show numbered list)

2. **List available features (only if no feature name provided):**
   - Scan `.workspace/` for all folders with `02-implementation.md`
   - **If no features found:**
     ```
     ❌ NO IMPLEMENTED FEATURES

     No features found in .workspace/ with 02-implementation.md

     Run /1-plan + /2-code first to implement a feature.
     ```
     → EXIT skill gracefully
   - **If features found:** Show numbered list with feature status

   - For each feature, check if `.worktree` file exists and read worktree path
   - Show numbered list with feature status AND worktree info

   ```
   📋 AVAILABLE FEATURES FOR REFINEMENT:

   | # | Feature | Worktree | Status | Parts/Extends/Changes |
   |---|---------|----------|--------|----------------------|
   | 1 | checkout | ../project--checkout | ✓ Implemented | 2 (guest-checkout, paypal) |
   | 2 | user-profile | ../project--user-profile | ✓ Implemented | - |
   | 3 | notifications | (no worktree) | ✗ Not implemented | Run /2-code first |

   **Worktree column logic:**
   - If `.workspace/features/{name}/.worktree` exists → show worktree path
   - If no `.worktree` file → show "(no worktree)"

   Which feature do you want to refine?

   Options:
   - Enter number (e.g., "1")
   - Enter name (e.g., "checkout")
   ```

3. **Handle user selection:**
   - If number: map to feature name → proceed to step 4
   - If name only: validate exists → proceed to step 4
   - If invalid: show error and re-prompt

4. **Auto-detect part/extend/change (always runs after feature selection):**

   **If feature has NO parts/extends/changes:** Skip to step 5

   **If feature HAS parts/extends/changes:**
   - Read `01-intent.md` to find all sections (`## Part: {name}`, `## Extend: {name}` or `## Change: {name}`)
   - For each section, check if implemented (has code files listed in `02-implementation.md`)
   - **Auto-select** the most recently implemented part/extend/change (likely what user wants to refine)

   ```
   📋 AUTO-DETECTED SECTION

   Feature: checkout
   Sections: 2 total (all implemented)

   | # | Name | Type | Status |
   |---|------|------|--------|
   | 1 | 01-cart-models | Part | ✓ Implemented |
   | 2 | 02-payment-backend | Part | ✓ Implemented ← MOST RECENT |

   Auto-selected: 02-payment-backend (most recently implemented)
   ```

   Use AskUserQuestion tool:
   ```
   header: "Sectie Verfijnen"
   question: "Wil je deze sectie verfijnen?"
   options:
     - label: "Ja (Recommended)"
       description: "Verfijn deze sectie"
     - label: "Nee"
       description: "Ga door naar volgende"
     - label: "Andere sectie"
       description: "Kies een andere sectie om te verfijnen"
     - label: "Uitleg"
       description: "Leg uit wat verfijnen inhoudt"
   multiSelect: false
   ```

   **If no parts/extends/changes implemented:**
   ```
   ❌ NO SECTIONS IMPLEMENTED

   Feature: checkout has parts/extends/changes but none are implemented yet.
   Run /2-code {feature-name} first.
   ```
   → EXIT skill gracefully

5. **Validate feature exists:**
   - Check `.workspace/{name}/02-implementation.md` exists
   - If not found:
     ```
     ❌ FEATURE NOT IMPLEMENTED

     No 02-implementation.md found for: {name}

     Available implemented features:
     {list features with 02-implementation.md}
     ```

     Use AskUserQuestion tool:
     ```
     header: "Feature Not Found"
     question: "Feature '{name}' is niet geimplementeerd. Wat wil je doen?"
     options:
       - label: "Andere feature kiezen (Recommended)"
         description: "Selecteer een feature uit de lijst hierboven"
       - label: "Eerst implementeren"
         description: "Sluit af en run /2-code {name} eerst"
       - label: "Afsluiten"
         description: "Sluit /4-refine af"
       - label: "Explain question"
         description: "Leg uit wat deze opties betekenen"
     multiSelect: false
     ```

     **If "Andere feature kiezen":** Return to step 2 (show numbered list)
     **If "Eerst implementeren":** EXIT skill with message to run /2-code first
     **If "Afsluiten":** EXIT skill gracefully

6. **Verify correct worktree (if .worktree file exists):**

   **Skip if:** task_type is EXTEND or CHANGE (these use parent feature's worktree)

   **Steps:**

   a. **Check for .worktree file:**
      ```bash
      cat .workspace/features/{feature-name}/.worktree
      ```
      - If file exists → read worktree path
      - If file doesn't exist → continue without worktree (legacy mode)

   b. **Compare current directory with worktree path:**
      ```bash
      # Get current directory (absolute path)
      pwd
      ```
      - If current directory matches worktree path → continue to step 7
      - If current directory does NOT match → prompt user to switch

   c. **If NOT in correct worktree:**
      ```
      ⚠️ WRONG WORKTREE

      Feature "{feature-name}" has a dedicated worktree:
      {worktree-path}

      You are currently in:
      {current-directory}
      ```

      Use AskUserQuestion tool:
      - header: "Worktree"
      - question: "Je zit niet in de juiste worktree. Wat wil je doen?"
      - options:
        - label: "Open worktree (Recommended)"
          description: "Open {worktree-path} in nieuw VSCode venster"
        - label: "Toch hier doorgaan"
          description: "Werk in huidige directory (niet aanbevolen)"
        - label: "Annuleren"
          description: "Stop en switch handmatig"
        - label: "Uitleg"
          description: "Leg uit wat worktrees zijn"
      - multiSelect: false

      **If "Open worktree":**
      ```bash
      code "{worktree-path}"
      ```
      Report:
      ```
      📂 WORKTREE OPENED

      VSCode venster geopend voor: {worktree-path}

      Switch naar dat venster en run /4-refine {feature-name} opnieuw.
      ```
      → EXIT skill (user continues in other window)

      **If "Toch hier doorgaan":**
      Report:
      ```
      ⚠️ Continuing in current directory (worktree ignored)
      ```
      → Continue to step 7 (with warning logged)

      **If "Annuleren":**
      → EXIT skill gracefully

   d. **If IN correct worktree (or no worktree defined):**
      ```
      ✅ WORKTREE VERIFIED

      Working in: {current-directory}
      Feature: {feature-name}

      → Ready for refinement...
      ```

7. **Ask for modification:**
   ```
   What do you want to change?

   Describe the functional change you want.
   Example: "Change image upload to support all file types"
   ```

8. **Confirm understanding:**
   ```
   📋 REFINE REQUEST:

   Feature: {name}
   Current: {brief description from 02-implementation.md}
   Requested change: {user's description}
   ```

   Use AskUserQuestion tool:
   ```
   header: "Bevestig Verzoek"
   question: "Klopt dit refine verzoek?"
   options:
     - label: "Ja, dit klopt (Recommended)"
       description: "Start met het analyseren van de scope"
     - label: "Nee, opnieuw beschrijven"
       description: "Beschrijf de gewenste wijziging opnieuw"
     - label: "Afsluiten"
       description: "Sluit /4-refine af"
     - label: "Explain question"
       description: "Leg uit wat deze opties betekenen"
   multiSelect: false
   ```

   **If "Ja, dit klopt":** Proceed to FASE 1
   **If "Nee, opnieuw beschrijven":** Return to step 7 (Ask for modification)
   **If "Afsluiten":** EXIT skill gracefully

**Output:**
```
✅ REFINE INITIATED

Feature: {name}
Modification: {description}
Worktree: {worktree-path} (verified)

→ Loading context and analyzing scope...
```

---

### FASE 1: CONTEXT LOADING & SCOPE CHECK

**Goal:** Load existing implementation and verify scope is appropriate for /4-refine.

**Steps:**

1. **Load ALL files in feature folder:**

   Scan target folder and read ALL existing files for full context:

   | File | Purpose | When Present |
   |------|---------|--------------|
   | `01-intent.md` | Requirements (REQUIRED) | Always |
   | `01-research.md` | Patterns (REQUIRED) | Always |
   | `01-architecture.md` | Architecture blueprint | If FASE 3.5 ran |
   | `00-overview.md` | Feature documentation | If previously implemented |
   | `02-implementation.md` | Implementation log (REQUIRED) | If /2-code ran |
   | `02-tests.md` | Test plan | If /2-code ran |
   | `04-refine-*.md` | Previous refinement logs | If /4-refine ran before |
   | `05-refactor-*.md` | Previous refactor logs | If /5-refactor ran |

   **Why load all files:**
   - Full context of what was built and how
   - Previous refinements inform current change
   - Avoid conflicts with existing modifications
   - Part/extend/change context in parent files

   **Detect mode from 01-intent.md content:**
   - Has "## Part:" sections → Feature with parts (user specifies which part)
   - Has "## Extend:" section → Extend mode (context in appended sections)
   - Has "## Change:" section → Change mode (context in appended sections)
   - None of above → Normal feature mode

   **Extract from 02-implementation.md:**
   - Files created, files modified, architectural decisions
   - Identify current implementation approach

2. **Use sequential thinking for scope analysis:**
   ```
   [Sequential thinking]
   - Analyzing requested modification
   - Identifying affected files
   - Checking scope criteria
   - Determining if /4-refine appropriate
   ```

3. **Scope validation:**

   **Definition of "substantial change":**
   - Adding/removing functions or methods (not just modifying existing)
   - Adding/removing components or classes
   - Changing file structure or imports significantly
   - Adding >20 lines or modifying >50% of a file

   **Minor changes (don't count toward limit):**
   - Modifying existing function logic (<20 lines)
   - Changing parameters or return values
   - Adjusting styling or UI elements
   - Fixing bugs within existing structure

   **Check each criterion:**
   - Files affected: Count substantial changes needed (max 3-5)
   - Database: Any schema changes required?
   - Dependencies: New packages needed?
   - Routes: New endpoints or only modifications?
   - Architecture: Structure changes required?

   **If ANY criterion fails:**
   ```
   ❌ SCOPE VIOLATION

   Issue: {specific criterion that failed}
   - {explanation}

   Risks of proceeding:
   - More complex rollback if issues occur
   - Higher chance of unintended side effects
   - May require /1-plan later anyway

   Recommendation: Use /1-plan with 'change' mode
   Command: /1-plan change {feature-name}
   ```

   Use AskUserQuestion tool:
   ```
   header: "Scope Overschrijding"
   question: "Scope is te groot voor /4-refine. Wat wil je doen?"
   options:
     - label: "Gebruik /1-plan (Recommended)"
       description: "Sluit af en gebruik /1-plan change {feature-name}"
     - label: "Toch doorgaan"
       description: "Override scope check en ga door (niet aanbevolen)"
     - label: "Afsluiten"
       description: "Sluit /4-refine af"
     - label: "Explain question"
       description: "Leg uit wat scope overschrijding betekent"
   multiSelect: false
   ```
   - If "Gebruik /1-plan": Exit skill with command suggestion
   - If "Toch doorgaan": Proceed with warning, document scope override in 04-refine.md entry
   - If "Afsluiten": Exit skill

4. **Cross-part impact analysis (for multi-part features):**
   - If feature has multiple parts (detected in step 1):
     - Parse all parts from `01-intent.md`
     - Check if modified files are imported/used by other parts
     - If cross-part impact detected:
       ```
       ⚠️ CROSS-PART IMPACT DETECTED

       Your modification to part {current-part} may affect:
       - Part {other-part}: uses {shared-file}
       ```

       Use AskUserQuestion tool:
       ```
       header: "Gerelateerde Delen"
       question: "Welke gerelateerde delen wil je meenemen in deze refinement?"
       options:
         - label: "{affected-part-1}"
           description: "Gebruikt {shared-file}"
         - label: "{affected-part-2}"
           description: "Gebruikt {shared-file}"
         [... dynamically list all affected parts ...]
         - label: "Geen (alleen huidige deel)"
           description: "Ga door met alleen {current-part}"
         - label: "Annuleren"
           description: "Annuleer en heroverweeg de scope"
         - label: "Explain question"
           description: "Leg uit wat cross-part impact betekent"
       multiSelect: true
       ```
   - If parts selected: include selected parts in scope
   - If "Geen (alleen huidige deel)": proceed with current part, will need to test all affected parts
   - If "Annuleren": cancel and reconsider approach
   - If no cross-part impact or single-part feature: proceed

5. **Optional clarification (max 2 questions):**
   - Only ask if modification is ambiguous
   - Example: "Should file upload accept all types or specific extensions?"
   - If modification still unclear after 2 questions:
     ```
     ⚠️ REQUIREMENTS UNCLEAR

     Unable to determine specific changes needed after clarification.

     Use AskUserQuestion tool:
     - header: "Unclear Req"
     - question: "Requirements are unclear. What do you want to do?"
     - options:
       - label: "Start Over"
         description: "Re-describe what you want to change"
       - label: "Use /1-plan"
         description: "Switch to planning skill for better scoping"
       - label: "Exit"
         description: "Cancel this refinement"
     - multiSelect: false
     ```
     - If "Start Over": Return to FASE 0 step 3 (ask for modification)
     - If "Use /1-plan": Exit and suggest /1-plan
     - If "Exit": Exit skill

**Output:**
```
🔍 CONTEXT LOADED

| Field | Value |
|-------|-------|
| **Mode** | [FEATURE / PART / EXTEND / CHANGE] |
| **Feature** | {name} |
| **Part** | {NN}-{name} (if applicable) |
| **Type** | {Extend/Change}: {name} (if applicable) |

**Context loaded:**

| File | Status | Purpose |
|------|--------|---------|
| 01-intent.md | ✓ | requirements |
| 01-research.md | ✓ | patterns |
| 02-implementation.md | ✓ | implementation |
| 00-overview.md | ✓ | feature docs (if exists) |
| 02-tests.md | ✓ | tests (if exists) |
| 04-refine-*.md | ✓ | {count} previous refinements (if exists) |
| 05-refactor-*.md | ✓ | {count} refactors (if exists) |

| Metric | Value |
|--------|-------|
| **Files involved** | {count} |
| **Scope** | ✓ Within /4-refine limits |

**Affected files:**

| File | Changes |
|------|---------|
| {file1} | {what changes} |
| {file2} | {what changes} |

**Output:** .workspace/{name}/04-refine.md (single file, newest entries first)
[If part:] Will append "## Part: {NN}-{name}" section

→ Proceeding to research...
```

---

### FASE 2: RESEARCH (Parallel Agents)

**Goal:** Research best practices for the specific functional modification using Context7.

**IMPORTANT:** Launch all research agents in parallel using single message with multiple Task tool calls.

**Steps:**

1. **Prepare research context:**
   ```
   Feature: {name}
   Current implementation: {summary from 02-implementation.md}
   Requested modification: {user's description}
   Affected files: {list}
   Tech stack: {from CLAUDE.md}
   ```

2. **Launch 3 research agents in parallel:**

   ```
   🔍 Researching best practices...

   3 agents analyzing:
   - Best practices for {modification type}
   - Architecture fit in existing code
   - Testing approach for changes
   ```

   **Prompt for each agent:**
   ```
   Research for /4-refine skill - functional modification.

   Feature: {name}
   Current implementation summary:
   {from 02-implementation.md}

   Requested modification:
   {user's description}

   Affected files:
   {list with brief description}

   Focus your research on:
   - How to implement this modification correctly
   - Best practices for {specific change}
   - Patterns that fit existing implementation

   This is a REFINEMENT, not new feature. Keep scope minimal.
   ```

   Launch:
   - Task(subagent_type="best-practices-researcher", prompt="[above]")
   - Task(subagent_type="architecture-researcher", prompt="[above]")
   - Task(subagent_type="testing-researcher", prompt="[above]")

3. **Wait for all agents to complete (5 minute timeout per agent):**
   - If agent completes successfully: proceed
   - If agent times out or fails:
     - Go to "Agent Timeout" error handler
     - **Max 2 retries per agent**
     - After 2 failed retries: force "Continue with partial results" or "Exit"

4. **Synthesize research findings:**
   - Combine outputs from all 3 agents
   - Extract actionable recommendations
   - Identify implementation approach

**Output:**
```
🔍 RESEARCH COMPLETE

| Metric | Value |
|--------|-------|
| **Agents** | 3/3 returned |
| **Coverage** | {average}% |

**Key findings:**

| Area | Summary |
|------|---------|
| Best practices | {summary} |
| Architecture fit | {summary} |
| Testing approach | {summary} |

→ Creating implementation plan...
```

**Send notification:**
```bash
powershell -ExecutionPolicy Bypass -File .claude/scripts/notify.ps1 -Title "Claude Code" -Message "Refine research complete"
```

---

### FASE 3: IMPLEMENTATION PLAN (User Approval Required)

**Goal:** Present clear implementation plan and get user approval before making changes.

**CHECKPOINT** - User must approve before proceeding.

**Steps:**

1. **Use sequential thinking to create plan:**
   ```
   [Sequential thinking]
   - Synthesizing research findings
   - Determining file modification order
   - Planning specific changes per file
   - Identifying rollback points
   ```

2. **Generate implementation plan:**
   ```
   📋 IMPLEMENTATION PLAN

   Modification: {description}

   ## Changes

   1. {file1}
      - Current: {what exists}
      - Change: {what will be modified}
      - Reason: {research-based rationale}

   2. {file2}
      - Current: {what exists}
      - Change: {what will be modified}
      - Reason: {research-based rationale}

   ## Approach
   {Brief description of implementation strategy}

   ## Rollback
   If tests fail, changes will be reverted automatically.

   ## Not Changed
   - {file/component that stays the same}
   ```

   Use AskUserQuestion tool:
   ```
   header: "Plan Goedkeuring"
   question: "Wil je dit implementatieplan uitvoeren?"
   options:
     - label: "Ja, uitvoeren (Recommended)"
       description: "Start met de implementatie volgens dit plan"
     - label: "Aanpassen"
       description: "Pas onderdelen van het plan aan"
     - label: "Annuleren"
       description: "Annuleer dit plan"
     - label: "Explain question"
       description: "Leg uit wat dit plan inhoudt"
   multiSelect: false
   ```

3. **Handle user response:**

   **If "Ja, uitvoeren":**
   - Proceed to FASE 4

   **If "Annuleren":**
   Use AskUserQuestion tool:
   ```
   header: "Geannuleerd"
   question: "Plan geannuleerd. Wat wil je doen?"
   options:
     - label: "Andere aanpak (Recommended)"
       description: "Beschrijf een alternatieve aanpak"
     - label: "Afsluiten"
       description: "Sluit /4-refine af"
     - label: "Explain question"
       description: "Leg de opties uit"
   multiSelect: false
   ```
   - If "Andere aanpak": Ask for alternative approach → Return to step 1
   - If "Afsluiten": Exit skill

   **If "Aanpassen":** (max 3 adjustment iterations)

   Use AskUserQuestion tool:
   ```
   header: "Plan Aanpassen"
   question: "Welk onderdeel wil je aanpassen? (poging {N}/3)"
   options:
     - label: "{file1} wijziging"
       description: "Pas de wijziging voor {file1} aan"
     - label: "{file2} wijziging"
       description: "Pas de wijziging voor {file2} aan"
     [... dynamically list all file changes ...]
     - label: "Algemene aanpak"
       description: "Pas de overall implementatiestrategie aan"
     - label: "Explain question"
       description: "Leg uit wat aanpassen betekent"
   multiSelect: true
   ```
   - Incorporate adjustment
   - Show updated plan
   - Return to approval prompt
   - **After 3 adjustments:**
     Use AskUserQuestion tool:
     ```
     header: "Meerdere Aanpassingen"
     question: "Meerdere aanpassingen suggereren onduidelijke requirements. Wat wil je doen?"
     options:
       - label: "Plan goedkeuren (Recommended)"
         description: "Keur het huidige plan goed"
       - label: "Opnieuw beginnen"
         description: "Annuleer en start opnieuw met duidelijkere beschrijving"
       - label: "Gebruik /1-plan"
         description: "Schakel over naar /1-plan voor gedetailleerde planning"
       - label: "Explain question"
         description: "Leg uit waarom dit een probleem is"
     multiSelect: false
     ```

**Output:**
```
✅ PLAN APPROVED

Proceeding with implementation...
```

---

### FASE 4: IMPLEMENTATION (Parallel Agents)

**Goal:** Generate 3 implementation approaches for user choice, then execute the selected approach.

**Steps:**

1. **Prepare agent context:**

   Compile the following for all implementation agents:
   ```
   Feature: {name}
   Modification: {description}

   Implementation Plan (approved in FASE 3):
   {approved_plan}

   Research Context:
   {research_findings}

   Current Files (from 02-implementation.md):
   {file_list_with_paths}

   Tech stack: [from CLAUDE.md]
   ```

2. **Launch 3 implementation agents in parallel (single message with 3 Task tool calls):**

   ```
   - Task(subagent_type="refine-surgical", prompt="[context above]
     Your mission: Implement this modification with MINIMAL changes.")

   - Task(subagent_type="refine-clean", prompt="[context above]
     Your mission: Implement this modification with CLEAN architecture.")

   - Task(subagent_type="refine-safe", prompt="[context above]
     Your mission: Implement this modification with MAXIMUM safety.")
   ```

3. **Wait for all 3 agents to complete (5 minute timeout per agent):**
   - Each agent returns a structured implementation approach
   - **Report progress as agents complete:**
     - Format: `Implementation agents: {completed}/3 complete`
     - Show which agent just finished: `✓ refine-surgical complete (2 files, 8 lines)`
   - **If agent times out:** Go to "Agent Timeout" error handler (max 2 retries)

4. **Present approach comparison:**

   ```
   📝 3 IMPLEMENTATION APPROACHES READY

   ┌─────────────────────────────────────────────────────────────────────────────┐
   │ 📊 COMPARE APPROACHES                                                       │
   ├─────────────────────────────────────────────────────────────────────────────┤
   │                                                                             │
   │  Approach          │ Files   │ Lines   │ Safety     │ Rollback   │ Best For │
   │ ───────────────────┼─────────┼─────────┼────────────┼────────────┼──────────│
   │ 1. SURGICAL        │ [N]     │ [N]     │ Minimal    │ Trivial    │ Quick    │
   │    "Minimal touch" │         │         │            │            │ fix      │
   │                    │         │         │            │            │          │
   │ 2. CLEAN           │ [N]     │ [N]     │ Moderate   │ Moderate   │ Quality  │
   │    "Proper refactor"│        │         │            │            │ focus    │
   │                    │         │         │            │            │          │
   │ 3. SAFE            │ [N]     │ [N]     │ Maximum    │ Moderate   │ Critical │
   │    "Maximum safety"│         │         │            │            │ systems  │
   │                    │         │         │            │            │          │
   └─────────────────────────────────────────────────────────────────────────────┘

   💡 RECOMMENDATION: [Surgical/Clean/Safe] - [brief reason]
   ```

   **Send notification:**
   ```bash
   powershell -ExecutionPolicy Bypass -File .claude/scripts/notify.ps1 -Title "Claude Code" -Message "Refine approaches ready"
   ```

   **Step A: Offer to compare approaches first (optional)**

   Use AskUserQuestion tool:
   ```
   header: "Approach Details"
   question: "Welke approaches wil je vergelijken voordat je kiest?"
   options:
     - label: "Direct kiezen (Recommended)"
       description: "Kies direct een approach zonder details te bekijken"
     - label: "Surgical"
       description: "Bekijk details van minimale aanpak"
     - label: "Clean"
       description: "Bekijk details van nette aanpak"
     - label: "Safe"
       description: "Bekijk details van veilige aanpak"
     - label: "Explain question"
       description: "Leg uit wat de approaches betekenen"
   multiSelect: true
   ```

   - If "Direct kiezen" only: Proceed to Step B (final selection)
   - If approaches selected: Show full details for all selected approaches side by side, then proceed to Step B
   - Max 2 comparison iterations before forcing Step B

   **Step B: Final approach selection**

   Use AskUserQuestion tool:
   ```
   header: "Kies Approach"
   question: "Welke approach wil je toepassen?"
   options:
     - label: "Surgical (Recommended)"
       description: "Minimale wijzigingen, makkelijkste rollback"
     - label: "Clean"
       description: "Nette implementatie, betere onderhoudbaarheid"
     - label: "Safe"
       description: "Maximum validatie en error handling"
     - label: "Annuleren"
       description: "Annuleer deze refinement"
     - label: "Explain question"
       description: "Leg de verschillen uit"
   multiSelect: false
   ```

5. **Process user choice:**

   - **If "Surgical"** → use refine-surgical output, proceed to step 6
   - **If "Clean"** → use refine-clean output, proceed to step 6
   - **If "Safe"** → use refine-safe output, proceed to step 6
   - **If "Annuleren"** → EXIT skill gracefully with message "Refine geannuleerd door gebruiker"

6. **Execute selected implementation:**
   - Apply the changes from the selected approach
   - Use Edit tool to modify code files
   - Verify all planned changes made
   - Check for unexpected deviations
   - Prepare for testing

7. **Update refine history file:**

   **Output path depends on mode:**
   - Normal feature: `.workspace/{name}/04-refine.md`
   - Part: `.workspace/{feature}/04-refine.md` with "## Part: {NN}-{name} ({date})" section
   - Extend/Change: `.workspace/{parent}/04-refine.md` with "## Extend: {name} ({date})" section

   **Parent resolution for Extend/Change modes:**
   - Read first lines of `01-intent.md` to find "Extends: {parent}" or "Changes: {parent}"
   - Validate `.workspace/{parent}/` exists
   - If parent not found: show error and list available features

   **File update strategy:**
   - If file exists: prepend new entry (newest first)
   - If file doesn't exist: create with header

   **File structure:**
   ```markdown
   # Refine History - {feature name}

   ## Refinement {timestamp}

   **Mode:** [FEATURE / PART / EXTEND / CHANGE]
   [If part:] **Part:** {NN}-{name}
   [If extend/change:] **Type:** {Extend/Change}: {name}

   **Modification:** {description}

   **Scope:** {Within limits / ⚠️ Override - {criterion that failed}}

   **Research Applied:**
   - {key finding 1}
   - {key finding 2}

   **Changes Made:**
   - {file1}: {change description}
   - {file2}: {change description}

   **Tests:** {passed}/{total} passed

   ---

   ## Refinement {older timestamp}
   ...
   ```

8. **Update feature overview (00-overview.md) if functionality changed:**
   - Read `.workspace/{name}/00-overview.md` (if exists)
   - **Only update if the modification affects user-facing functionality**

   **A. Update Status table:**

   ```markdown
   ## Status

   | Pipeline | Requirements | Updated |
   |----------|--------------|---------|
   | `REFINED` | {X}/{Y} | {date} |
   ```

   **B. Update Files table (if new files created):**
   - Add new files with clickable links

   **C. Append to History:**

   ```markdown
   ## History

   | Date | Phase | Summary |
   |------|-------|---------|
   | {date} | Refine | {summary} |
   ```

**Output:**
```
✅ IMPLEMENTATION COMPLETE

**Modified files:**

| File | Change |
|------|--------|
| {file1} | {change} |
| {file2} | {change} |

| Document | Path |
|----------|------|
| Refine history | .workspace/{name}/04-refine.md |
| Feature overview | .workspace/{name}/00-overview.md [Updated/No changes needed] |

→ Generating tests...
```

**Send notification (after FASE 4 implementation agent):**
```bash
powershell -ExecutionPolicy Bypass -File .claude/scripts/notify.ps1 -Title "Claude Code" -Message "Ready for testing"
```

---

### FASE 5: TEST & VERIFY

**Goal:** Test the modification and provide rollback option if tests fail.

**Steps:**

1. **Generate focused test plan:**
   - Tests ONLY for the modification
   - Not full feature regression
   - Based on testing-researcher findings

   ```markdown
   # Test Plan - Refine: {modification}
   Generated: {timestamp}

   ## Automated Tests

   ### Unit Tests
   - Test {modified function/method}
   - Test {edge case from research}

   ### Integration Tests
   - Test {modified component interaction}

   ## Manual Tests

   ### Verification Steps
   1. {Step to verify modification works}
   2. {Step to verify existing functionality preserved}
   3. {Edge case to check}
   ```

2. **Execute automated tests:**
   - **Detect test framework** from package.json or project structure:
     - Jest: `npm test -- --testPathPattern="{modified-files}"`
     - Vitest: `npm run test -- {modified-files}`
     - Pytest: `pytest {modified-files}`
     - Go: `go test ./...`
   - **If no test framework detected:**
     Use AskUserQuestion tool:
     ```
     header: "No Tests"
     question: "No test framework detected. How would you like to proceed?"
     options:
       - label: "Skip tests"
         description: "Proceed to manual verification without automated tests"
       - label: "Specify command"
         description: "Manually enter a test command to run"
       - label: "Cancel"
         description: "Cancel the refinement"
     ```
   - Run tests for modified files only (not full test suite)
   - Report results with pass/fail counts

3. **Offer verification options:**
   Display test results, then use AskUserQuestion tool:
   ```
   🧪 AUTOMATED TESTS: {passed}/{total}
   ```

   Use AskUserQuestion tool:
   ```
   header: "Verify"
   question: "Automated tests complete. How would you like to verify the changes?"
   options:
     - label: "Manual verification"
       description: "Execute manual test steps yourself"
     - label: "Skip verification"
       description: "Trust automated tests and proceed"
   ```

4. **Execute chosen verification:**

   **If "Manual verification":**
   - Show test steps one by one
   - User reports pass/fail
   - Log results

   **If "Skip verification":**
   - Proceed to completion
   - Note that manual verification skipped

5. **Handle test failures:**
   ```
   ❌ TESTS FAILED

   Failed tests:
   - {test1}: {reason}
   - {test2}: {reason}
   ```

   Use AskUserQuestion tool:
   - header: "Test Failed"
   - question: "Tests failed after implementation. What do you want to do?"
   - options:
     - label: "Rollback"
       description: "Revert all changes and restore original state"
     - label: "Fix"
       description: "Attempt to fix the failing tests"
     - label: "Accept"
       description: "Accept current state despite test failures"
   - multiSelect: false

   **If "Rollback":**
   - Execute rollback procedure:
     1. Get list of modified files from implementation step
     2. Revert using: `git checkout HEAD -- {file1} {file2} ...`
     3. Delete any newly created files (if applicable)
     4. Verify rollback with `git status`
   - Update 04-refine.md with "❌ Rolled back" entry
   - Show summary:
     ```
     ✅ ROLLBACK COMPLETE

     Reverted files:
     - {file1}
     - {file2}

     Your code is restored to pre-refine state.
     ```
   - EXIT skill

   **If "Fix":** (max 2 fix attempts)
   - Analyze failure reasons
   - Apply targeted fixes using Edit tool
   - Return to step 2 (Execute automated tests)
   - **After 2 failed fix attempts:**
     Use AskUserQuestion tool:
     ```
     header: "Fix Failed"
     question: "Unable to fix after 2 attempts. How would you like to proceed?"
     options:
       - label: "Rollback"
         description: "Revert all changes to pre-refine state"
       - label: "Accept anyway"
         description: "Keep changes despite test failures"
     ```

   **If "Accept":**
   - Document failures in 04-refine.md:
     ```markdown
     **Tests:** ⚠️ {passed}/{total} passed (accepted with failures)
     **Known issues:**
     - {test1}: {reason}
     ```
   - Proceed to FASE 6 with warning in summary

**Output:**
```
✅ VERIFICATION COMPLETE

| Test Type | Result |
|-----------|--------|
| Automated | {X}/{Y} passed |
| Manual | {status} |

→ Finalizing...
```

---

### FASE 6: COMPLETION

**Goal:** Finalize changes and provide summary.

**Steps:**

1. **Update documentation:**
   - Refine history already updated in FASE 4 (04-refine.md)

2. **Generate completion summary:**
   ```
   ✅ REFINE COMPLETE

   | Field | Value |
   |-------|-------|
   | **Feature** | {name} |
   | **Modification** | {description} |

   **Changes Made:**

   | File | Change |
   |------|--------|
   | {file1} | {change} |
   | {file2} | {change} |

   **Tests:**

   | Type | Result |
   |------|--------|
   | Automated | {X}/{Y} passed |
   | Manual | {status} |

   **Documentation:**

   | Document | Status |
   |----------|--------|
   | Refine history | 04-refine.md ✓ |
   ```

3. **Send notification:**
   ```bash
   powershell -ExecutionPolicy Bypass -File .claude/scripts/notify.ps1 -Title "Claude Code" -Message "Refine complete"
   ```

4. **Present combined completion menu:**
   Use AskUserQuestion tool:
   ```
   header: "Next Steps"
   question: "Wat wil je nu doen?"
   options:
     - label: "Commit & refine same"
       description: "Commit changes and do another refinement on {feature-name}"
     - label: "Commit & refine other"
       description: "Commit changes and refine a different feature"
     - label: "Commit & done"
       description: "Commit changes and finish"
     - label: "Skip commit"
       description: "Don't commit, I'll do this myself later"
   ```

   **If "Commit & refine same":**
   - Execute commit (see step 5)
   - Return to FASE 0 Step 6 (Ask for modification) for same feature

   **If "Commit & refine other":**
   - Execute commit (see step 5)
   - Return to FASE 0 Step 2 (List available features)

   **If "Commit & done":**
   - Execute commit (see step 5)
   - Show next command suggestion (see step 6)
   - EXIT skill

   **If "Skip commit":**
   - Skip commit
   - Show next command suggestion (see step 6)
   - EXIT skill

5. **Execute commit (if user chose "Commit & refine same", "Commit & refine other", or "Commit & done"):**
   ```bash
   git add {modified-files}
   git commit -m "$(cat <<'EOF'
refine({name}): {summary}

{description}
EOF
)"
   ```

   **Commit message format:**
   - `{name}`: Feature name
   - `{summary}`: One-line summary (e.g., "Change image upload to file upload")
   - `{description}`: 2-3 lines describing what was refined

   **Note:** Only add modified files from this refinement, not `git add .`

   **IMPORTANT:** Do NOT add Co-Authored-By, 🤖 Generated with Claude Code, or any other footer to pipeline commits.

6. **Show next command suggestion (for options 3 and 4):**

   ```text
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   📋 NEXT COMMAND (copy after /clear):

   /5-refactor {feature-name}

   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

   💡 Use /5-refactor for: code quality, performance, security improvements
   💡 Skip if: no further improvements needed
   ```

---

## Best Practices

### Language
Follow the Language Policy in CLAUDE.md.

### Notifications
- **Notify when Claude waits for user input AFTER a long-running phase**
- Notification moments:
  - FASE 3 start (after FASE 2 research agents): "Refine research complete"
  - FASE 4 step 4 (after 3 implementation agents): "Refine approaches ready"
  - FASE 5 start (after implementation execution): "Ready for testing"
  - After FASE 6 (workflow complete): "Refine complete"
- Use shared script: `.claude/scripts/notify.ps1` with `-Title` and `-Message` parameters
- Never skip notifications - user may be away during agent execution

### Scope Discipline
- Strictly enforce scope criteria
- Better to redirect to /1-plan than attempt too-large modification
- When in doubt, ask user if scope seems large

### Research Efficiency
- 3 agents run in parallel for speed
- Each agent focuses on their domain
- Research is targeted to the specific modification

### Implementation Safety
- Always create rollback capability
- Preserve existing functionality
- Make minimal changes needed
- Document all changes in 04-refine.md

### Testing Focus
- Test the modification, not entire feature
- Include edge cases from research
- Offer multiple verification methods
- Automatic rollback on failure

### Sequential Thinking Usage
- **FASE 1**: Scope analysis and validation
- **FASE 3**: Implementation plan creation
- Use for complex decision-making throughout

## Agents

The skill uses these specialized agents (same as /1-plan):

### Research Agents (Parallel in FASE 2)

**best-practices-researcher**
- Focus: Best practices for the specific modification
- Context7 queries: Framework patterns for the change type
- Returns: Conventions, idioms, API usage

**architecture-researcher**
- Focus: How modification fits existing architecture
- Context7 queries: Integration patterns, structure
- Returns: Architecture fit, file organization

**testing-researcher**
- Focus: How to test the modification
- Context7 queries: Test patterns for change type
- Returns: Test strategy, edge cases, pitfalls

### Implementation Agents (Parallel in FASE 4)

**refine-surgical**
- Philosophy: "Minimal touch"
- Focus: Change only what's absolutely necessary
- Returns: Minimum files/lines implementation approach
- Best for: Quick fixes, easy rollback, time pressure

**refine-clean**
- Philosophy: "Proper refactor"
- Focus: Clean implementation even if more changes
- Returns: Well-structured implementation approach
- Best for: Quality focus, maintainability, future changes

**refine-safe**
- Philosophy: "Maximum safety"
- Focus: Most defensive implementation with validation
- Returns: Implementation with error handling and edge cases
- Best for: Critical systems, production stability

## Error Handling

### Feature Not Found
```
❌ FEATURE NOT FOUND

Feature "{name}" not found in .workspace/
Or no 02-implementation.md exists.

Available features:
{list}
```

Use AskUserQuestion tool:
```
header: "Feature Niet Gevonden"
question: "Feature '{name}' is niet gevonden. Wat wil je doen?"
options:
  - label: "Andere feature kiezen (Recommended)"
    description: "Selecteer een feature uit de lijst hierboven"
  - label: "Eerst implementeren"
    description: "Sluit af en run /2-code {name} eerst"
  - label: "Afsluiten"
    description: "Sluit /4-refine af"
  - label: "Uitleg"
    description: "Leg uit wat deze opties betekenen"
multiSelect: false
```

### Scope Too Large
```
⚠️ SCOPE EXCEEDS /4-refine LIMITS

This modification requires:
- {specific issue}

Recommendation: /1-plan change {feature}
```

Use AskUserQuestion tool:
```
header: "Scope Te Groot"
question: "De scope is te groot. Toch doorgaan?"
options:
  - label: "Nee, verkleinen (Recommended)"
    description: "Verklein de scope eerst"
  - label: "Ja, doorgaan"
    description: "Ga door ondanks de grote scope"
  - label: "Uitleg"
    description: "Leg uit waarom scope belangrijk is"
multiSelect: false
```

### Agent Timeout
```
⏱️ AGENT TIMEOUT

Agent: {agent-name}
Phase: {FASE number}
Timeout: 5 minutes exceeded
Retry: attempt {N}/2
```

Use AskUserQuestion tool:
```
header: "Agent Timeout"
question: "Agent {agent-name} is niet op tijd klaar. Wat wil je doen?"
options:
  - label: "Opnieuw proberen (Recommended)"
    description: "Retry agent ({remaining} pogingen over)"
  - label: "Doorgaan met deelresultaten"
    description: "Ga verder met wat de andere agents hebben opgeleverd"
  - label: "Afsluiten en herstarten"
    description: "Sluit af en herstart de skill"
  - label: "Uitleg"
    description: "Leg uit wat een agent timeout betekent"
multiSelect: false
```

**After 2 failed retries:**
Use AskUserQuestion tool:
```
header: "Max Retries"
question: "Agent {agent-name} failed after 2 retry attempts. How would you like to proceed?"
options:
  - label: "Continue partial"
    description: "Continue with partial results (other agents succeeded)"
  - label: "Exit & restart"
    description: "Exit and restart the skill"
```

## Restrictions

This skill must NEVER:
- Proceed without existing 02-implementation.md
- Make database migrations (scope violation)
- Add new dependencies without explicit approval
- Create new routes/endpoints (only modify existing)
- Change architecture fundamentally
- Skip user approval at FASE 3
- Skip scope validation in FASE 1
- Make changes beyond approved plan
- Skip rollback option on test failure

This skill must ALWAYS:
- Load ALL files in feature folder
- Verify feature has 02-implementation.md before proceeding
- Check all scope criteria in FASE 1
- Launch 3 research agents in parallel
- Present implementation plan for user approval
- Provide rollback capability
- Update 00-overview.md when functionality changes (if file exists)
- Offer multiple verification methods (manual/skip)
- Send notifications after research and completion
- Use sequential thinking for scope analysis and plan creation
- Preserve existing functionality
- Keep modifications minimal and focused