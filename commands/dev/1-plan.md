---
description: Classifies tasks, clarifies requirements and researches.
---

# Feature Planning Skill

## Overview

This skill guides the feature planning workflow by classifying tasks, gathering detailed requirements, researching framework-specific best practices, optionally validating plan quality, automatically analyzing complexity, and intelligently deciding whether to generate a single context or multiple part contexts. It bridges the gap between a feature idea and actionable instructions for Claude Code by asking targeted questions, researching via Context7, optionally running quality checks, analyzing complexity, and generating structured context blocks.

The skill operates in six phases: context file selection, task classification, intent clarification through iterative questioning, Context7 research for best practices, optional plan analysis (Devil's Advocate, Assumption Testing, Alternatives, Simplification), automatic decomposition analysis, and context generation. The output is one or more ready-to-use context files that Claude Code can immediately work with, with optional quality validation before decomposition.

**Trigger**: `/1-plan` or `/1-plan [task-type]` or `/1-plan [description]`

## When to Use

This skill activates when:

**Triggers:**
- `/1-plan` - Start workflow with task type selection
- `/1-plan feature` - Start with FEATURE classification
- `/1-plan extend` - Start with EXTEND classification
- `/1-plan [description]` - Start with task description
  - Example: `/1-plan add email notifications to orders`
  - Example: `/1-plan create new authentication system`
  - Example: `/1-plan modify user profile to include bio field`

**Works best with:**
- Claude Projects with Project Instructions (for stack-specific research)

**NOT for:**
- General programming questions (use base Claude)

## Workflow

The skill operates through six phases with checkpoints after FASE 1, FASE 2, and FASE 4. FASE 3 runs automatically after FASE 2 confirmation. FASE 4 is optional (user chooses). FASE 5-6 run automatically after FASE 4.

### FASE 0: Context File Selection

**Goal:** Determine if creating new feature or updating existing context file.

1. **Ask user for context mode:**

   Use **AskUserQuestion** tool:
   - header: "Planning Mode"
   - question: "Wat voor type planning wil je doen?"
   - options:
     - label: "Nieuwe Feature (Aanbevolen)", description: "Start volledig nieuwe functionaliteit vanaf scratch"
     - label: "Extend/Change", description: "Bestaande functionaliteit uitbreiden of wijzigen"
     - label: "Plan Updaten", description: "Bestaand plan updaten (na debug of voor aanpassingen)"
     - label: "Leg uit", description: "Uitleg over de verschillende opties"
   - multiSelect: false

   **Response Handling:**
   - "Nieuwe Feature" → Set mode: NEW, task_type: FEATURE → Continue to FASE 1
   - "Extend/Change" → Set mode: NEW → Continue to step 4 (sequential modal flow)
   - "Plan Updaten" → Continue to step 2 (feature selection)
   - "Leg uit" → Explain options, then repeat question

   **If "Leg uit" selected:**
   ```
   **Planning Modes**

   - **Nieuwe Feature**: Maak een volledig nieuwe feature aan. Gebruikt voor nieuwe
     functionaliteit die nog niet bestaat in de codebase.

   - **Extend/Change**: Breid een bestaande feature uit of wijzig het gedrag.
     Wordt als sectie toegevoegd aan bestaande feature files.

   - **Plan Updaten**: Update een bestaand plan (na debug sessie of voor aanpassingen).
     Laadt het bestaande plan en past wijzigingen toe.
   ```
   Then repeat question.

2. **If "Update existing context" selected:**

   **Step 2a: Feature/Extend/Change Selection**
   - List available items in `.workspace/features/` (recursively find all 01-intent.md files)
   - Show hierarchy:
     ```
     Features:
     - checkout (has extends: guest-checkout, paypal)
     - user-profile
     ```
   - Note: Extends/changes are sections within parent feature files, not separate folders
   - Ask: "Which feature do you want to update? (provide folder name)"
   - Load corresponding `01-intent.md` file
   - If file doesn't exist: report error, ask user to select different item

   **Step 2b: Scenario Detection**
   - Parse loaded `01-intent.md`
   - Check for "## Debug History - Failed Implementation Attempt" section

   **If debug history found:**
   - Extract:
     - Scratch type (ARCHITECTURAL or IMPLEMENTATION)
     - Total attempts made
     - Summary of attempts
     - Why implementation failed
     - Lessons learned
     - Recommendations
   - **Set mode: UPDATE_AFTER_DEBUG**
   - Show debug summary:
     ```
     🔍 DETECTED: Debug ARCHITECTURAL Scratch

     Debug Summary:
     - Attempts: {N}
     - Reason: {failure reason}
     - Key learning: {main insight}
     ```

   Then use **AskUserQuestion** tool:
   - header: "Debug History Detected"
   - question: "Reconsider architecture with these debug insights?"
   - options:
     - label: "Yes, continue (Recommended)", description: "Use debug learnings to improve the plan"
     - label: "Cancel", description: "Stop the planning workflow"
   - multiSelect: false

   **If no debug history:**
   - **Set mode: UPDATE_PLAN**
   - Ask: "What do you want to change about the plan?"
   - Wait for user to describe changes
   - Show update summary:
     ```
     🔍 PLAN UPDATE MODE

     Existing plan loaded: {feature name}
     Changes requested:
     - {change 1}
     - {change 2}
     ```

   Then use **AskUserQuestion** tool:
   - header: "Update Plan"
   - question: "Proceed with these changes?"
   - options:
     - label: "Yes, update (Recommended)", description: "Apply these changes to the existing plan"
     - label: "Modify changes", description: "I want to add or adjust the requested changes"
     - label: "Cancel", description: "Stop the planning workflow"
   - multiSelect: false

3. **If "Create new feature":**
   - **Set mode: NEW**
   - **Set task type: FEATURE**
   - Continue to FASE 1

4. **If "Create new extend/change":**
   - **Set mode: NEW**

   **Modal 1: Task Type** (sequential modal flow)

   Use **AskUserQuestion** tool:
   - header: "Type Wijziging"
   - question: "Wat voor type wijziging wil je maken?"
   - options:
     - label: "Extend (Aanbevolen)", description: "Nieuwe functionaliteit toevoegen aan bestaande feature"
     - label: "Change", description: "Gedrag van bestaande feature aanpassen"
     - label: "Leg uit", description: "Uitleg over het verschil tussen Extend en Change"
   - multiSelect: false

   **Response Handling:**
   - "Extend" → Set task_type: EXTEND, continue to Modal 2
   - "Change" → Set task_type: CHANGE, continue to Modal 2
   - "Leg uit" → Explain difference, then repeat Modal 1

   **If "Leg uit" selected:**
   ```
   **Extend vs Change**

   - **Extend**: Voegt NIEUWE functionaliteit toe aan een bestaande feature.
     Voorbeeld: Guest checkout toevoegen aan checkout feature.

   - **Change**: Past BESTAAND gedrag aan van een feature.
     Voorbeeld: Validatieregels wijzigen, UI flow aanpassen.
   ```
   Then repeat Modal 1.

   **Modal 2: Parent Feature Selection**

   First, scan available features:
   ```bash
   ls .workspace/features/
   ```

   Then use **AskUserQuestion** tool:
   - header: "Parent Feature"
   - question: "Welke bestaande feature wil je uitbreiden/wijzigen?"
   - options: (dynamically generated from .workspace/features/)
     - label: "{feature-1} (Aanbevolen)", description: "Feature folder: .workspace/features/{feature-1}/"
     - label: "{feature-2}", description: "Feature folder: .workspace/features/{feature-2}/"
     - label: "{feature-N}", description: "Feature folder: .workspace/features/{feature-N}/"
     - label: "Leg uit", description: "Uitleg over parent features"
   - multiSelect: false

   **Response Handling:**
   - Feature selected → Set parent_feature: {name}, continue to Modal 3
   - "Leg uit" → Explain parent features, then repeat Modal 2

   **If "Leg uit" selected:**
   ```
   **Parent Features**

   Een parent feature is de hoofdfeature waaraan je een extend/change toevoegt.
   De extend/change wordt als sectie toegevoegd aan de bestaande feature files.

   Voorbeeld:
   - Parent: checkout
   - Extend: guest-checkout (wordt sectie in checkout/01-intent.md)
   ```
   Then repeat Modal 2.

   **If no features found:**
   ```
   ⚠️ GEEN FEATURES GEVONDEN

   Er zijn nog geen features in .workspace/features/.
   Je moet eerst een feature aanmaken voordat je kunt extenden/changen.
   ```
   Then use **AskUserQuestion** tool:
   - header: "Geen Features"
   - question: "Er zijn geen bestaande features. Wat wil je doen?"
   - options:
     - label: "Nieuwe feature maken (Aanbevolen)", description: "Start met het maken van een nieuwe feature"
     - label: "Annuleren", description: "Stop de planning workflow"
   - multiSelect: false

   **Response Handling:**
   - "Nieuwe feature maken" → Set mode: NEW, task_type: FEATURE, continue to FASE 1
   - "Annuleren" → Exit workflow gracefully

   **Modal 3: Confirm Understanding**

   Show summary of selected configuration:
   ```
   📋 BEVESTIGING

   | Veld | Waarde |
   |------|--------|
   | **Type** | {EXTEND / CHANGE} |
   | **Parent Feature** | {parent_feature} |
   | **Actie** | {extend-beschrijving / change-beschrijving} |

   De wijziging wordt als sectie toegevoegd aan:
   - .workspace/features/{parent_feature}/01-intent.md
   - .workspace/features/{parent_feature}/01-research.md
   ```

   Then use **AskUserQuestion** tool:
   - header: "Bevestiging"
   - question: "Klopt dit overzicht?"
   - options:
     - label: "Ja, correct (Aanbevolen)", description: "Ga door naar intent clarification"
     - label: "Nee, aanpassen", description: "Ik wil het type of de parent feature wijzigen"
   - multiSelect: false

   **Response Handling:**
   - "Ja, correct" → Continue to FASE 1
   - "Nee, aanpassen" → Ask what to change, loop back to relevant modal

   **If "Nee, aanpassen" selected:**
   Use **AskUserQuestion** tool:
   - header: "Wat Aanpassen"
   - question: "Wat wil je aanpassen?"
   - options:
     - label: "Type wijziging (Extend/Change)", description: "Terug naar Modal 1"
     - label: "Parent feature", description: "Terug naar Modal 2"
   - multiSelect: false

   **Response Handling:**
   - "Type wijziging" → Go back to Modal 1
   - "Parent feature" → Go back to Modal 2

   - Note: Extend/change will **append to existing files** (no subfolders)
   - Continue to FASE 1

5. **Set context for remaining phases:**
   - Mode: NEW / UPDATE_AFTER_DEBUG / UPDATE_PLAN
   - If UPDATE mode: Original context loaded and available
   - If UPDATE_AFTER_DEBUG: Debug insights extracted and available
   - If UPDATE_PLAN: User changes noted

**Output:**
```
📋 CONTEXT MODE: [NEW / UPDATE_AFTER_DEBUG / UPDATE_PLAN]

[If UPDATE_AFTER_DEBUG:]
Feature: {name}
✓ Original context loaded
✓ Debug history detected
  - Total attempts: {N}
  - Scratch type: ARCHITECTURAL
  - Key learnings: {summary}

→ Proceeding to reconsider architecture with debug insights

[If UPDATE_PLAN:]
Feature: {name}
✓ Original context loaded
✓ User requested changes:
  - {change 1}
  - {change 2}

→ Proceeding to update plan

[If NEW:]
Task type: {FEATURE / EXTEND}

→ Creating new feature/extend from scratch
```

---

### FASE 1: Task Classification

**Goal:** Understand the feature at a high level before codebase exploration.

**If mode is UPDATE_AFTER_DEBUG or UPDATE_PLAN:**
- Skip this fase - inherit task type from existing context
- Continue to FASE 1.5 with loaded context

**If mode is NEW:**

1. **Ask initial question (open chat):**

   **FASE 1: Task Classification**

   Welke feature wil je toevoegen? Beschrijf wat gebruikers zullen zien en doen.

2. **If unclear or too vague:**

   Ask ONE follow-up question (max 3 total) using **AskUserQuestion** tool:
   - header: "Clarification"
   - question: "[Specific clarification question]"
   - options: 2-4 concrete suggestions + "Explain question"
   - multiSelect: true

3. **Summarize and confirm:**

   Show summary in chat:
   ```
   📋 FEATURE SUMMARY:

   [Claude's understanding in own words - 2-3 sentences max]
   ```

   Then use **AskUserQuestion** tool:
   - header: "Confirm"
   - question: "Is this summary correct?"
   - options:
     - label: "Yes, correct", description: "Proceed to codebase exploration"
     - label: "No, adjust", description: "I want to add or change details"
   - multiSelect: false

4. **Handle user response:**
   - If "Yes, correct" → Proceed to FASE 1.5
   - If "No, adjust" → Ask what to change, incorporate, re-summarize
   - Repeat until user confirms

5. **Confirm task type:**
   ```
   🎯 TASK TYPE: [FEATURE / EXTEND]

   → Proceeding to codebase exploration...
   ```

---

### FASE 1.5: Codebase Exploration

**Goal:** Understand existing codebase patterns and similar features before asking clarifying questions.

**Trigger:** Automatic after FASE 1 completes (for NEW mode only)

**Auto-skip conditions (no modal shown):**
- Mode is UPDATE_AFTER_DEBUG (codebase already understood from debug attempts)
- Mode is UPDATE_PLAN (minimal exploration needed - plan already exists)

**Step 0: Skip decision**

Use **AskUserQuestion** tool:
- header: "Exploration"
- question: "Run codebase exploration? (3 code-explorer agents)"
- options:
  - label: "Yes (Recommended)", description: "Analyze existing patterns, similar features, conventions"
  - label: "Skip", description: "Proceed directly to intent questions"
- multiSelect: false

**Response Handling:**
- "Yes" → Continue to Step 1
- "Skip" → Skip to FASE 2

**If skipped:**
```
📋 EXPLORATION: Skipped

→ Proceeding to intent clarification...
```

**Steps:**

1. **Determine exploration targets:**

   Based on task type and initial description, identify 3 exploration focuses:
   - **similar-features**: Existing functionality that resembles the request
   - **architecture**: How the codebase structures similar concerns
   - **implementation**: Specific coding patterns and conventions

2. **Launch 3 code-explorer agents in parallel:**

   **CRITICAL:** Use single message with 3 Task tool calls for parallel execution.

   ```
   🔍 Launching codebase exploration...

   3 code-explorer agents scanning:
   - Agent 1: Similar existing features
   - Agent 2: Architectural patterns
   - Agent 3: Implementation conventions
   ```

   **Prompt template for each agent:**
   ```
   Explore the codebase for: [EXPLORATION FOCUS]

   Context:
   - Task type: [FEATURE/EXTEND from FASE 1]
   - Description: [user's initial description]
   - Tech stack: [from CLAUDE.md if available]

   Your assigned focus: [similar-features / architecture / implementation]

   Focus your exploration on finding patterns relevant to the requested feature.

   Return structured exploration report following your output format.
   ```

   Launch all 3 agents:
   - Task(subagent_type="code-explorer", prompt="[above with focus=similar-features]")
   - Task(subagent_type="code-explorer", prompt="[above with focus=architecture]")
   - Task(subagent_type="code-explorer", prompt="[above with focus=implementation]")

3. **Wait for all agents to complete**

4. **Synthesize exploration findings:**

   Combine 3 agent reports into unified exploration summary:

   ```
   ## EXPLORATION SUMMARY

   ### Similar Features Found
   [From similar-features agent]
   - [Feature]: [location] - [relevance to new feature]

   ### Architectural Patterns
   [From architecture agent]
   - [Pattern]: [where used] - [recommendation for new feature]

   ### Implementation Conventions
   [From implementation agent]
   - [Convention]: [examples] - [apply to new feature]

   ### Key Files to Reference
   [Combined from all agents]
   1. [file] - [why]

   ### Design Recommendations
   [Synthesized insights]
   - [Recommendation 1]
   - [Recommendation 2]
   ```

5. **Present exploration results (informational only, no confirmation needed):**

   ```
   🔍 CODEBASE EXPLORATION COMPLETE

   Similar features found: [X]
   - [Feature 1]: [brief description]
   - [Feature 2]: [brief description]

   Patterns identified: [Y]
   - [Pattern 1]: Used in [location]
   - [Pattern 2]: Used in [location]

   Key insights:
   - [Insight 1]
   - [Insight 2]

   → These findings will inform the clarifying questions.

   Proceeding to intent clarification...
   ```

6. **Store exploration context for FASE 2:**

   - Save exploration summary for reference during questioning
   - Use patterns found to skip redundant questions
   - Reference similar features when asking about edge cases

**Output:**
```
🔍 EXPLORATION COMPLETE

Agents: 3/3 returned
Similar features: [X] found
Patterns identified: [Y]
Key files: [Z]

→ Proceeding to intent clarification with codebase context
```

---

### FASE 2: Intent Clarification

**Goal:** Get crystal clear understanding of what needs to happen.

**Use sequential-thinking NOT required in this phase** - conversational questioning is sufficient.

**Context from Exploration (if available from FASE 1.5):**
- Reference similar features when asking about behavior
- Skip questions answerable from existing patterns
- Use architectural patterns to suggest approaches
- Reference implementation conventions in suggestions

**Strategy depends on mode:**

#### Mode: UPDATE_AFTER_DEBUG

**Context available:**
- Original plan from 01-intent.md + 01-research.md
- Debug history with failures and learnings
- Recommendations for new approach

**Questions to ask:**

1. **Confirm understanding of debug insights:**
   ```
   Based on debug attempts, the implementation failed because:
   {reason from debug history}

   Key learnings:
   - {learning 1}
   - {learning 2}

   Is this summary correct? Do you want to add anything?
   ```

2. **Focus on architectural changes:**

   Use **AskUserQuestion** tool:
   - header: "Architecture"
   - question: "The original plan used {pattern/approach}. Which alternative approaches do you want to explore?"
   - options:
     - label: "Event-driven", description: "Event-driven instead of request-response"
     - label: "Async/Queue", description: "Async processing instead of synchronous calls"
     - label: "Microservices", description: "Microservices instead of monolith"
     - label: "Caching", description: "Add caching layer"
   - multiSelect: true

3. **Only ask NEW questions if requirements changed:**
   - If requirements are same: skip to FASE 3 with debug-informed focus
   - If requirements changed: ask clarifying questions about changes

#### Mode: UPDATE_PLAN

**Context available:**
- Original plan from 01-intent.md + 01-research.md
- User-requested changes

**Questions to ask:**

1. **Confirm scope of changes:**
   ```
   You want to modify:
   {user's requested changes}
   ```

   Then use **AskUserQuestion** tool:
   - header: "Scope Confirmation"
   - question: "Does the rest of the plan stay the same?"
   - options:
     - label: "Yes, keep rest (Recommended)", description: "Only modify the listed parts"
     - label: "No, more changes", description: "I have additional changes to make"
   - multiSelect: false

2. **Ask targeted questions only about changed parts:**
   - Focus only on what's being modified
   - Reference original plan for unchanged parts
   - Keep questioning minimal - user knows what they want

3. **Confirm unchanged sections:**
   ```
   Kept from original plan:
   - {section 1}: {summary}
   - {section 2}: {summary}
   ```

   Then use **AskUserQuestion** tool:
   - header: "Unchanged Sections"
   - question: "Are these unchanged sections correct?"
   - options:
     - label: "Yes, correct (Recommended)", description: "Keep these sections as-is"
     - label: "No, adjust", description: "I want to change some of these sections too"
   - multiSelect: false

#### Mode: NEW

**No prior context - ask full clarification questions as normal.**

**Send notification (after FASE 1.5):**
```bash
powershell -ExecutionPolicy Bypass -File .claude/scripts/notify.ps1 -Title "Claude Code" -Message "Ready for your input"
```

**QUESTION FLOW:**

For every question, use **AskUserQuestion** tool directly with suggestions:
- header: "[Question topic]"
- question: "[The actual question]"
- options:
  - 2-4 concrete suggestions (first = recommended)
  - label: "Explain question", description: "Explain what Claude means"
- multiSelect: true (user can select multiple suggestions)
- User can always choose "Other" for custom input

**If "Explain question" selected:** Give explanation, then ask same question again.

**BATCH LOGIC:**
- One question at a time
- After answer, proceed to next question

#### Question Strategy for FEATURE (NEW mode only):

**Question order:**
1. Open question: Feature description (chat)
2. Data models (2-step)
3. Interactions (2-step)
4. UI components (2-step)
5. Authentication (2-step)
6. Edge cases (2-step)
7. Validation rules (2-step)
8. Adaptive follow-up questions

---

**Step 1: Feature description (already collected in FASE 1)**

Skip - feature description was already collected in FASE 1. Proceed directly to Step 2.

---

**Step 2: Data models**

Use **AskUserQuestion** tool:
- header: "Data Models"
- question: "What data/models are involved in this feature?"
- options:
  - label: "User/Account (Recommended)", description: "User data, profiles, accounts"
  - label: "Content/Items", description: "Articles, products, posts, recipes"
  - label: "Transactions", description: "Orders, payments, bookings"
  - label: "Explain question", description: "Explain what data models means"
- multiSelect: true

**If "Explain question":** Data models are the "things" your application stores (Recipe, User, Order, etc.). Then repeat question.

---

**Step 3: Interactions**

Use **AskUserQuestion** tool:
- header: "Interactions"
- question: "What interactions should this feature support?"
- options:
  - label: "Read/View (Recommended)", description: "View and retrieve items"
  - label: "Create", description: "Create new items"
  - label: "Update/Edit", description: "Modify existing items"
  - label: "Explain question", description: "Explain what interactions means"
- multiSelect: true

**If "Explain question":** Interactions are actions users can perform (CRUD: Create, Read, Update, Delete). Then repeat question.

---

**Step 4: UI components**

Use **AskUserQuestion** tool:
- header: "UI Components"
- question: "What UI components are needed?"
- options:
  - label: "Detail View (Recommended)", description: "Display of a single item"
  - label: "List/Table", description: "Overview of multiple items"
  - label: "Form", description: "Input form for data entry"
  - label: "Explain question", description: "Explain what UI components means"
- multiSelect: true

**If "Explain question":** UI components are visual building blocks (Form, List, Detail View, Modal). Then repeat question.

---

**Step 5: Authentication**

Use **AskUserQuestion** tool:
- header: "Auth"
- question: "What authentication is required for this feature?"
- options:
  - label: "Public (Recommended)", description: "No login required, accessible to everyone"
  - label: "Authenticated", description: "Only for logged-in users"
  - label: "Role-based", description: "Specific roles/permissions required"
  - label: "Explain question", description: "Explain what authentication means"
- multiSelect: true

**If "Explain question":** Authentication determines access level (Public, Authenticated, Role-based). Then repeat question.

---

**Step 6: Edge cases**

Use **AskUserQuestion** tool:
- header: "Edge Cases"
- question: "What edge cases are important to consider?"
- options:
  - label: "Empty states (Recommended)", description: "What if there's no data?"
  - label: "Loading states", description: "What during loading/waiting?"
  - label: "Error handling", description: "What if something goes wrong?"
  - label: "Explain question", description: "Explain what edge cases means"
- multiSelect: true

**If "Explain question":** Edge cases are non-normal situations (empty data, loading, errors). Then repeat question.

---

**Step 7: Validation rules**

Use **AskUserQuestion** tool:
- header: "Validation"
- question: "What validation rules are important?"
- options:
  - label: "Required fields (Recommended)", description: "Fields that must be filled in"
  - label: "Format checks", description: "Format validation (email, phone, URL)"
  - label: "Length limits", description: "Min/max lengths for text fields"
  - label: "Explain question", description: "Explain what validation means"
- multiSelect: true

**If "Explain question":** Validation ensures data is correct (required, unique, format, length). Then repeat question.

---

**Adaptive follow-up questions:**

Based on answers, use 2-step flow for relevant follow-ups:

**If Content/Items selected:** Follow-up with content type question (2-step)
- Suggestions: Text-based, Media-rich, Structured data

**If Relations selected:** Follow-up with relation type question (2-step)
- Suggestions: One-to-many, Many-to-many, Self-referential

**Stop asking when:**
- You have complete picture of the feature
- All major aspects (data, UI, interactions, auth) are covered
- Edge cases and constraints are identified

#### Question Strategy for EXTEND:

**Follow the same 2-step flow as FEATURE.**

**Question order:**
1. Open question: What functionality + what changes (chat)
2. Breaking changes (2-step)
3. Existing functionality (2-step)
4. Affected parts (2-step)
5. Data migration (2-step)
6. Users (2-step)
7. Edge cases (2-step)

---

**Step 1: Extend description (OPEN CHAT)**

```
What existing functionality needs to be modified or extended?

Describe the feature/component and what exactly needs to change.
```

---

**Step 2-7: Use AskUserQuestion directly with suggestions**

| Question | Suggestions (first = recommended) |
|----------|-----------------------------------|
| Breaking changes | No (Recommended) / Yes + "Explain question" |
| Existing functionality | Keep (Recommended) / Modify / Extend + "Explain question" |
| Affected parts | Views (Recommended) / Models / Services + "Explain question" |
| Data migration | None (Recommended) / Default values / Transform + "Explain question" |
| Users | End users (Recommended) / Internal / External API + "Explain question" |
| Edge cases | Backwards compat (Recommended) / Migration / Rollback + "Explain question" |

**Stop asking when:**
- You understand what currently exists
- You know exactly what needs to change
- Impact on existing functionality is clear
- Migration/compatibility strategy is defined

#### Requirement Extraction (after all questions, before summary)

**Goal:** Extract testable requirements from user answers for traceability through implementation and verification.

**Why:** Requirements are the source of truth for verification. Without explicit requirements, tests become disconnected from user intent.

**Steps:**

1. **Analyze answers with sequential-thinking:**
   ```
   [Sequential thinking]
   - Identify distinct user-facing functionalities from answers
   - Break down each functionality into testable requirements
   - Categorize requirements by type (core, api, ui, integration, edge_case)
   - Identify edge cases and error scenarios mentioned
   - Determine appropriate test type for each requirement
   ```

2. **Generate requirements list:**
   ```
   📋 EXTRACTED REQUIREMENTS

   Based on your answers, I've identified {N} testable requirements:

   ## Core Requirements ({X})
   | ID | Description | Test Type |
   |----|-------------|-----------|
   | REQ-001 | {description} | {manual/automated_ui/automated_api} |
   | REQ-002 | {description} | {type} |

   ## API Requirements ({Y}) - if applicable
   | ID | Description | Test Type |
   |----|-------------|-----------|
   | REQ-003 | {description} | automated_api |

   ## UI Requirements ({Z}) - if applicable
   | ID | Description | Test Type |
   |----|-------------|-----------|
   | REQ-004 | {description} | manual/automated_ui |

   ## Edge Cases ({W})
   | ID | Description | Test Type |
   |----|-------------|-----------|
   | REQ-005 | {description} | automated_unit |

   ```

3. **Ask for review with AskUserQuestion:**

   Use **AskUserQuestion** tool:
   - header: "Requirements Review"
   - question: "Are these requirements correct and complete?"
   - options:
     - label: "Yes, proceed (Recommended)", description: "Requirements are complete, continue to summary"
     - label: "Add requirement", description: "I want to add a requirement"
     - label: "Edit requirement", description: "I want to change a requirement"
     - label: "Remove requirement", description: "I want to remove a requirement"
   - multiSelect: false

4. **Handle user response:**
   - If "Yes, proceed" → proceed to summary
   - If "Add/Edit/Remove" → ask for details, update list, show again, repeat step 3
   - Max 10 modifications before auto-proceeding

4. **Store requirements for output:**
   - Requirements will be included in 01-intent.md
   - Each requirement starts with `passes: false`
   - /3-verify will test against these requirements

**Requirement ID Format:**
```
REQ-{NNN}   (e.g., REQ-001, REQ-002, ...)

Sequential within the feature, starting at 001.
```

**Requirement Categories:**
| Category | Description | Default Test Type |
|----------|-------------|-------------------|
| `core` | Essential user-facing functionality | manual or automated_ui |
| `api` | Backend API endpoints | automated_api |
| `ui` | Visual/UX requirements | manual or automated_ui |
| `integration` | External service connections | automated_api |
| `edge_case` | Boundary conditions, error scenarios | automated_unit |

**Test Type Options:**
| Type | When to Use |
|------|-------------|
| `manual` | Requires human judgment, visual verification |
| `automated_ui` | Browser/UI automation testing (clicks, forms, DOM) |
| `automated_api` | API endpoint testing |
| `automated_unit` | Unit test for logic/validation |

---

#### After All Questions:

**Create summary:**

**IMPORTANT: Formatting requirements for summary:**
- Use a markdown table for all fields (not plain text lines)
- Tables render cleanly in terminal output
- Keep descriptions concise (1 line per field)

```
📋 SUMMARY OF YOUR REQUEST

| Field | Value |
|-------|-------|
| **Task Type** | [TYPE] |
| **Functionality** | [what needs to happen] |
| **Components** | [models/controllers/etc] |
| **Interactions** | [list] |
| **UI** | [list] |
| **Authentication** | [level] |

## Requirements ({N} total)

| ID | Description | Category | Test Type |
|----|-------------|----------|-----------|
| REQ-001 | {description} | core | {type} |
| REQ-002 | {description} | api | {type} |
| ... | ... | ... | ... |
```

**CHECKPOINT 1** - Use AskUserQuestion:

Use **AskUserQuestion** tool:
- header: "Checkpoint 1"
- question: "Is this summary correct? Ready to proceed to research?"
- options:
  - label: "Yes, proceed (Recommended)", description: "Continue to Context7 research"
  - label: "No, adjust", description: "I want to change something"
  - label: "Cancel", description: "Stop the planning workflow"
- multiSelect: false

**Handle response:**
- "Yes, proceed" → Proceed to FASE 3
- "No, adjust" → Ask what to change, loop back
- "Cancel" → Exit workflow gracefully

---

### FASE 3: Research Best Practices

**Goal:** Research framework-specific best practices and patterns relevant to the task using 3 specialized agents running in parallel.

**IMPORTANT:** This phase uses 3 specialized research agents that work in parallel for maximum efficiency:
- `best-practices-researcher` - Framework conventions, idioms, patterns
- `architecture-researcher` - Architecture patterns, database design, project setup
- `testing-researcher` - Testing strategies, edge cases, common pitfalls

Each agent autonomously plans their research using sequential thinking and executes Context7 searches for their domain.

---

**Step 0: Load Baseline & Skip Decision**

**First: Always check and load baseline if exists (regardless of skip choice)**

```bash
ls .claude/research/stack-baseline.md
```
- If exists: Load baseline content into context
- If expired (> 3 months): Show warning but still load

**Then: Ask skip question**

Use **AskUserQuestion** tool:
- header: "Research"
- question: "Run Context7 research? (3 specialized agents)"
- options:
  - label: "Yes (Recommended)", description: "Research feature-specific patterns beyond baseline"
  - label: "Skip", description: "Use baseline only, skip feature-specific research"
- multiSelect: false

**Response Handling:**
- "Yes" → Continue to Step 1 (agents research feature-specific topics)
- "Skip" → Skip to FASE 3.5 with baseline data only

**If skipped:**
```
📋 RESEARCH: Using baseline only

✓ Stack baseline loaded: .claude/research/stack-baseline.md
✗ Feature-specific research: Skipped

→ Proceeding to architecture design...
```

**If skipped AND no baseline:**
```
⚠️ RESEARCH: Skipped (no baseline)

No stack baseline available.
Proceeding without research data.

→ Proceeding to architecture design...
```

---

**Step 1: Check Stack Baseline**

Before launching research agents, check if stack baseline exists:

1. **Check for baseline file:**
   ```bash
   ls .claude/research/stack-baseline.md
   ```

2. **If baseline EXISTS:**
   - Read `.claude/research/stack-baseline.md`
   - Check "Valid until" date
   - **If expired (> 3 months old):**
     ```
     ⚠️ STACK BASELINE EXPIRED

     Baseline generated on: [date]
     Expired on: [valid until date]
     ```

     Then use **AskUserQuestion** tool:
     - header: "Baseline Expired"
     - question: "Stack baseline is expired. How do you want to proceed?"
     - options:
       - label: "Continue with old baseline", description: "Use outdated baseline (not recommended)"
       - label: "Refresh baseline (Recommended)", description: "Run /refresh-baseline to update"
       - label: "Skip baseline", description: "Do full Context7 research without baseline"
     - multiSelect: false
   - **If valid:** Extract baseline content for agent prompts (Step 1)

3. **If baseline DOES NOT EXIST:**

   Show informational message:
   ```
   ℹ️ NO STACK BASELINE FOUND

   .claude/research/stack-baseline.md does not exist.
   Research agents will perform full Context7 research.

   Tip: Run /setup to generate stack baseline for future features.
   This saves ~45% tokens per feature.
   ```

   Then use **AskUserQuestion** tool:
   - header: "No Baseline"
   - question: "Continue with full Context7 research?"
   - options:
     - label: "Yes", description: "Proceed with full research (more thorough)"
     - label: "No", description: "Exit and run /setup first (recommended for new projects)"
   - multiSelect: false

   **Response Handling:**
   - "Yes" → Continue to Step 1 without baseline
   - "No" → Exit and suggest running /setup first

4. **Store baseline status for Step 1:**
   ```
   baseline_available: true/false
   baseline_content: [content if available]
   baseline_stack: [stack from baseline]
   ```

---

**Step 1: Prepare Research Parameters**

Extract from FASE 0-2 and prepare standardized prompt for all agents:

```
Task type: [FEATURE/EXTEND]
Mode: [NEW/UPDATE_AFTER_DEBUG/UPDATE_PLAN]

Intent Summary:
[Complete summary from FASE 2 - all questions, answers, requirements]

[If UPDATE_AFTER_DEBUG mode - include:]
Debug History:
- Failed approach: [what didn't work architecturally]
- Failure reason: [why it failed]
- Key learnings: [insights from debug attempts]
- Recommended alternatives: [patterns to explore]

[If UPDATE_PLAN mode - include:]
Changed sections:
- [Section 1]: [what's being modified]
- [Section 2]: [what's being added/removed]
```

---

**Step 2: Launch 3 Agents in Parallel**

**CRITICAL:** You MUST send a single message with 3 Task tool calls to run agents in parallel.

Example structure:
```
I'm launching 3 specialized research agents in parallel:
- best-practices-researcher: Framework conventions and idioms
- architecture-researcher: Architecture patterns and project setup
- testing-researcher: Testing strategies and edge cases

[Then use 3 Task tools in single message]
```

**Prompt for each agent** (same content, different agent):

**If baseline_available = true:**
```
Perform autonomous Context7 research for /1-plan skill FASE 3.

[Insert prepared research parameters from Step 1]

STACK BASELINE AVAILABLE:
The following conventions/patterns are ALREADY RESEARCHED and documented in .claude/research/stack-baseline.md:

[Insert baseline_content from Step 0]

IMPORTANT INSTRUCTIONS:
1. Read .claude/CLAUDE.md for technology stack (for reference)
2. DO NOT research topics already covered in baseline above
3. SKIP Context7 queries for:
   - General framework conventions (see baseline)
   - Basic framework patterns (see baseline)
   - Framework idioms (see baseline)
   - Framework testing basics (see baseline)
4. FOCUS your Context7 research on:
   - Feature-specific patterns NOT in baseline
   - Domain-specific requirements for THIS feature
   - Advanced/specialized topics beyond basics
5. Use sequential thinking to plan ONLY feature-specific research
6. Execute Context7 searches until >= 75% coverage for feature-specific topics
7. Return structured output in your specified format

Your domain focus: [will differ per agent - they know their own focus]
Expected queries: 1-3 (feature-specific only, baseline covers basics)
```

**If baseline_available = false:**
```
Perform autonomous Context7 research for /1-plan skill FASE 3.

[Insert prepared research parameters from Step 1]

NO STACK BASELINE AVAILABLE - perform full research.

Instructions:
1. Read .claude/CLAUDE.md for technology stack
2. Use sequential thinking to plan your research for YOUR domain
3. Execute Context7 searches until >= 75% coverage
4. Return structured output in your specified format

Your domain focus: [will differ per agent - they know their own focus]
```

Launch all 3 agents:
- Task(subagent_type="best-practices-researcher", prompt="[above]")
- Task(subagent_type="architecture-researcher", prompt="[above]")
- Task(subagent_type="testing-researcher", prompt="[above]")

---

**Step 3: Wait for All Agents to Complete**

All 3 agents work in parallel. Wait until all return their outputs.

---

**Step 4: Receive and Validate 3 Outputs**

**Agent 1: best-practices-researcher returns:**
```
## FRAMEWORK BEST PRACTICES
### Conventions
[...]
### Idioms & Patterns
[...]
### API Usage
[...]

## CONTEXT7 SOURCES
Coverage: X%
Relevance: Y%
[...]
```

**Agent 2: architecture-researcher returns:**
```
## ARCHITECTURE PATTERNS
### Recommended Approach
[...]
### Pattern Details
[...]

## SETUP PATTERNS
### Database Schema
[...]
### Models
[...]
### Routes & Controllers
[...]

## CONTEXT7 SOURCES
Coverage: X%
Relevance: Y%
[...]
```

**Agent 3: testing-researcher returns:**
```
## TESTING STRATEGY
### Test Types Needed
[...]
### What to Test
[...]
### How to Test
[...]

## COMMON PITFALLS & EDGE CASES
### Edge Cases to Test
[...]
### Common Pitfalls
[...]

## CONTEXT7 SOURCES
Coverage: X%
Relevance: Y%
[...]
```

---

**Step 5: Validate Combined Coverage**

Calculate overall coverage:
```
Overall Coverage = (Agent1_Coverage + Agent2_Coverage + Agent3_Coverage) / 3
```

**Decision logic:**
- **>= 75% coverage AND >= 80% confidence**: Proceed to FASE 4 ✅
- **>= 75% coverage but < 80% confidence**: Warning, findings less certain - proceed with caution
- **< 75% coverage**: Identify which agent(s) have low coverage
  - Example: "architecture-researcher returned 65% coverage for architecture domain"
  - Re-launch ONLY the low-coverage agent(s) with refined focus
  - Max 1 retry per agent

---

**Step 6: Combine Research Outputs for FASE 4**

Merge the 3 agent outputs into unified research structure:

```
RESEARCH RESULTS (from 3 parallel agents):

## FRAMEWORK BEST PRACTICES
[From best-practices-researcher]

## ARCHITECTURE & SETUP
[From architecture-researcher]

## TESTING STRATEGY
[From testing-researcher]

## COMMON PITFALLS & EDGE CASES
[From testing-researcher]

## COMBINED CONTEXT7 SOURCES
Overall Coverage: [average]%
Overall Confidence: [average]%
- best-practices: [X]% coverage, [Y]% confidence ([N] queries)
- architecture: [X]% coverage, [Y]% confidence ([N] queries)
- testing: [X]% coverage, [Y]% confidence ([N] queries)

Cache Paths: [combined from all 3 agents]
```

---

**Mode-Specific Notes:**

**Mode: NEW**
- All 3 agents perform full research
- Complete coverage across all domains
- No sections skipped

**Mode: UPDATE_AFTER_DEBUG**
- architecture-researcher: Critical - finds alternative patterns
- testing-researcher: Adapts strategy for new approach
- best-practices-researcher: Minimal (conventions rarely change)

**Mode: UPDATE_PLAN**
- All 3 agents: Research only changed sections
- Much faster (fewer queries needed)
- Reference original context for unchanged parts

---

**Key Principles:**

✅ **Parallel execution**: 3 agents run simultaneously = 3x faster
✅ **Specialization**: Each agent is expert in their domain
✅ **Autonomy**: Agents plan their own research with sequential thinking
✅ **Trust but verify**: Validate coverage, but trust agent analysis
✅ **Selective retry**: Only re-run agents with < 75% coverage

**Your role:** Orchestrate the 3 agents, validate coverage, combine outputs → FASE 3.5

---

### FASE 3.5: Architecture Design

**Goal:** Present 2-3 different architectural approaches for user to choose from.

**Trigger:** Automatic after FASE 3 (Research) completes

**Auto-skip conditions (no modal shown):**
- Mode is UPDATE_PLAN (architecture already established)

**Step 0: Skip decision**

Use **AskUserQuestion** tool:
- header: "Architecture"
- question: "Run architecture design? (3 code-architect agents)"
- options:
  - label: "Yes (Recommended)", description: "Get 3 architecture options: Minimal, Clean, Pragmatic"
  - label: "Skip (use Pragmatic)", description: "Auto-select pragmatic approach, skip comparison"
- multiSelect: false

**Response Handling:**
- "Yes" → Continue to Step 1 (launch 3 agents)
- "Skip" → Auto-select pragmatic approach, skip to FASE 4

**If skipped:**
```
📐 ARCHITECTURE: Auto-selected Pragmatic

Skipped: 3 architecture agents
Using: Pragmatic Balance approach (default)

→ Proceeding to decomposition analysis...
```

**Steps:**

1. **Prepare architecture context:**

   Compile information for architect agents:
   ```
   Feature/Task: [from FASE 2]
   Tech Stack: [from CLAUDE.md]

   Research Findings:
   - Best Practices: [from FASE 3 agent 1]
   - Architecture Patterns: [from FASE 3 agent 2]
   - Testing Strategy: [from FASE 3 agent 3]

   Codebase Exploration: [from FASE 1.5 if available]

   Constraints:
   - [Any constraints from user]
   - [Breaking change restrictions]
   ```

2. **Launch 3 code-architect agents in parallel:**

   **CRITICAL:** Use single message with 3 Task tool calls.

   ```
   Designing architecture options...

   3 code-architect agents creating blueprints:
   - Agent 1: Minimal Changes approach
   - Agent 2: Clean Architecture approach
   - Agent 3: Pragmatic Balance approach
   ```

   **Prompt for Agent 1 (Minimal Changes):**
   ```
   Design a MINIMAL CHANGES architecture for this feature.

   [Include architecture context from step 1]

   Your approach philosophy: Smallest possible change set, maximum reuse.
   Focus on: Speed, low risk, leveraging existing code.

   Return structured output with:
   1. Logic location: WHERE does business logic live (component/service/model/etc)
   2. Key files: List of new/modified files with brief purpose
   3. Code example: ONE code snippet showing how the MAIN feature works in this approach
   4. Trade-off: Single line with pro and con
   ```

   **Prompt for Agent 2 (Clean Architecture):**
   ```
   Design a CLEAN ARCHITECTURE approach for this feature.

   [Include architecture context from step 1]

   Your approach philosophy: Proper separation, future-proof, testable.
   Focus on: Maintainability, scalability, best practices.

   Return structured output with:
   1. Logic location: WHERE does business logic live (component/service/model/etc)
   2. Key files: List of new/modified files with brief purpose
   3. Code example: ONE code snippet showing how the MAIN feature works in this approach
   4. Trade-off: Single line with pro and con
   ```

   **Prompt for Agent 3 (Pragmatic Balance):**
   ```
   Design a PRAGMATIC BALANCE architecture for this feature.

   [Include architecture context from step 1]

   Your approach philosophy: Balance between speed and quality.
   Focus on: Reasonable trade-offs, practical implementation.

   Return structured output with:
   1. Logic location: WHERE does business logic live (component/service/model/etc)
   2. Key files: List of new/modified files with brief purpose
   3. Code example: ONE code snippet showing how the MAIN feature works in this approach
   4. Trade-off: Single line with pro and con
   ```

3. **Wait for all agents to complete**

4. **Present comparison to user:**

   **IMPORTANT:** Keep output compact. Show concrete differences, not abstract advantages.

   ```
   📐 ARCHITECTURE OPTIONS: [Feature Name]

   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

   ## Option 1: MINIMAL - Logic in [location]

   Files: [X] new, [Y] modified
   - `[MainFile.php]` - [purpose, e.g. "alle logica hier (~200 regels)"]
   - `[OtherFile.php]` - [purpose]

   ```[language]
   // [What this code shows - e.g. "Main feature check IN component"]
   [concrete code example - 3-6 lines max]
   ```

   ✓ [Pro] · ✗ [Con]

   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

   ## Option 2: CLEAN - Logic in [location]

   Files: [X] new, [Y] modified
   - `[ServiceFile.php]` - [purpose]
   - `[MainFile.php]` - [purpose, e.g. "thin, delegeert alleen"]

   ```[language]
   // [What this code shows - e.g. "Main feature in SERVICE (unit testbaar)"]
   [concrete code example - 3-6 lines max]
   ```

   ✓ [Pro] · ✗ [Con]

   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

   ## Option 3: PRAGMATIC - Logic in [location]

   Files: [X] new, [Y] modified
   - `[ModelFile.php]` - [purpose, e.g. "met scopeX()"]
   - `[MainFile.php]` - [purpose]

   ```[language]
   // [What this code shows - e.g. "Main feature via MODEL SCOPE (testbaar)"]
   [concrete code example - 3-6 lines max]
   ```

   ✓ [Pro] · ✗ [Con]

   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

   ## Comparison

   | | Minimal | Clean | Pragmatic |
   |--|---------|-------|-----------|
   | Logic in | [location] | [location] | [location] |
   | Unit testbaar | [ja/nee] | [ja/nee] | [ja/nee] |
   | Files | [X] | [Y] | [Z] |
   | Later uitbreiden | [easy/medium/hard] | [easy/medium/hard] | [easy/medium/hard] |

   **→ Recommendation: Option [X]** - [one-line rationale]

   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

   ```

5. **Handle user selection:**

   Use **AskUserQuestion** tool:
   - header: "Architecture Selection"
   - question: "Which architecture approach do you want to use?"
   - options:
     - label: "Option 3: Pragmatic (Recommended)", description: "Balanced approach - quick but structured"
     - label: "Option 1: Minimal", description: "Fastest, fewest files, higher risk"
     - label: "Option 2: Clean", description: "Most structured, more files, lowest risk"
     - label: "Show details", description: "See full blueprint for a specific option"
   - multiSelect: false

   **Response Handling:**
   - "Option 1/2/3" → Store selected approach as `selected_architecture`, proceed to FASE 4
   - "Show details" → Ask which option via follow-up modal, show blueprint, then repeat selection

6. **Confirm selection:**

   ```
   ✅ ARCHITECTURE SELECTED: [Option Name]

   Summary:
   - [Key decision 1]
   - [Key decision 2]
   - [Key decision 3]

   Files to create: [X]
   Files to modify: [Y]

   → Proceeding to plan analysis...
   ```

7. **Pass to subsequent phases:**

   - FASE 4 (Plan Analysis): Uses selected architecture as input
   - FASE 5 (Decomposition): Uses selected architecture for complexity scoring
   - FASE 6 (Output): Includes selected architecture blueprint in context

**Output:**
```
📐 ARCHITECTURE DESIGN COMPLETE

Selected: [Approach Name]
Files planned: [X] new, [Y] modified

→ Proceeding to plan analysis/decomposition
```

**CHECKPOINT 2** - Use AskUserQuestion:

**Send notification (before presenting options):**
```bash
powershell -ExecutionPolicy Bypass -File .claude/scripts/notify.ps1 -Title "Claude Code" -Message "Architecture options ready"
```

Use **AskUserQuestion** tool:
- header: "Architecture Selection"
- question: "Which architecture approach do you want to use?"
- options:
  - label: "Option 3: Pragmatic (Recommended)", description: "Balanced approach - quick but structured"
  - label: "Option 1: Minimal", description: "Fastest, fewest files, higher risk"
  - label: "Option 2: Clean", description: "Most structured, more files, lowest risk"
  - label: "Show details", description: "See full blueprint for an option"
  - label: "Cancel", description: "Stop the planning workflow"
- multiSelect: false

**Handle response:**
- Option selected → Store as selected_architecture, proceed to FASE 4
- "Show details" → Ask which option, show blueprint, then repeat question
- "Cancel" → Exit workflow gracefully

---

### FASE 4: Optional Plan Analysis (User Choice)

**Goal:** Optionally validate plan quality and identify improvements BEFORE decomposition.

**Trigger:** Automatic after FASE 3.5 (Architecture Design) completes

**Why here:** Quality checks should happen BEFORE decomposition decision. If /analyze suggests simplifications, complexity score will be lower.

1. **Generate intermediate context:**

   After FASE 3 research completes, generate temporary context file:
   ```bash
   # Use research data to generate intermediate context
   python3 scripts/generate_context_block.py \
     --input /tmp/research_data.json \
     --save /tmp/intermediate-context.md
   ```

   This gives /analyze something to work with.

2. **Ask user for analysis preference:**

   Show completion message:
   ```
   ✅ Research complete!
   ```

   Then use **AskUserQuestion** tool:
   - header: "Plan Check"
   - question: "Analyze plan for quality, risks, and alternatives before decomposition?"
   - options:
     - label: "Yes, Analyze", description: "Run Devil's Advocate, Assumption Testing, Alternatives, Simplification"
     - label: "No, Continue", description: "Skip analysis and proceed to complexity assessment"
   - multiSelect: false

   **Response Handling:**
   - "Yes, Analyze" → Continue to step 3 (run /analyze)
   - "No, Continue" → Skip to FASE 5 with original research data

3. **If user chooses "Yes, Analyze":**

   a. **Run /analyze skill:**
   ```
   🔍 Running /analyze skill...
   ```

   b. **Execute /analyze workflow:**
   - Load intermediate context from /tmp/
   - /analyze runs full analysis:
     - FASE 1: Plan Selection (auto-detected)
     - FASE 2: Multi-Technique Analysis (Devil's Advocate, Assumptions, Alternatives, Simplification)
     - FASE 3: Synthesis & Recommendations
     - FASE 4: Report Generation
     - FASE 5: Interactive Plan Improvement (optional)

   c. **After /analyze completes:**
   ```
   ✅ Analysis complete

   Confidence: {score}/10

   Key findings:
   - {Top Devil's Advocate concern}
   - {Critical assumption to validate}
   - {Best simplification opportunity}

   [If improvements made via FASE 5:]
   ✅ Plan improved based on analysis

   Proceeding to complexity analysis with [improved/original] plan...
   ```

   d. **Use improved research data for FASE 5:**
   - If /analyze made improvements, research data is updated
   - FASE 5 complexity analysis works on improved plan
   - This may change decomposition decision (e.g., simplified plan → single task instead of parts)

4. **If user chooses "No, Continue":**
   ```
   Skipping analysis phase.

   Proceeding to complexity analysis...
   ```

   Continue to FASE 5 with original research data.

5. **Key benefit:**

   **Scenario 1 - Simplification:**
   ```
   Without /analyze: Complexity 78 → PARTS (3 parts)
   With /analyze: Removed feature X, deferred Y → Complexity 55 → SINGLE_TASK
   ```

   **Scenario 2 - Risk identified:**
   ```
   /analyze: "Assumption about external API is unvalidated"
   → User adds validation part
   → Complexity increases but plan is better
   ```

**Continue to FASE 5** with validated/improved research data (if /analyze ran) or original data (if skipped)

---

### FASE 5: Automatic Decomposition Analysis

**Goal:** Analyze complexity and automatically decide: single task or parts.

**IMPORTANT:** Use `sequential-thinking` tool to systematically analyze complexity and make informed decomposition decisions.

**Strategy depends on mode:**

#### All Modes: Complexity Analysis

**Use sequential-thinking to:**
1. Extract complexity indicators from FASE 3 research AND selected architecture (FASE 3.5)
2. Calculate 5 complexity metrics (0-100 each)
3. Identify distinct concerns and natural boundaries
4. Analyze coupling between concerns
5. Make decomposition decision

**Note:** If FASE 3.5 was executed, use the selected architecture's file counts and implementation phases as primary input for complexity scoring.

**Complexity Metrics:**

1. **Architecture Complexity** (from FASE 3 + FASE 3.5):
   - Count distinct patterns mentioned
   - Layering complexity (single/multi-tier)
   - If selected_architecture available: use file counts from blueprint
   - Score calculation: min(100, patterns × 15 + layers × 10)

2. **Setup Complexity** (from FASE 3 + FASE 3.5):
   - Migrations count × 10
   - Models count × 8
   - Relationships count × 5
   - Routes/controllers count × 3
   - If selected_architecture available: use "Files to Create/Modify" counts
   - Score: min(100, sum)

3. **Testing Scope** (from FASE 3):
   - Test categories count × 20
   - Integration points × 15
   - Score: min(100, sum)

4. **Intent Scope** (from FASE 2):
   - CRUD operations × 8
   - UI components × 10
   - Data models × 12
   - Score: min(100, sum)

5. **Research Breadth** (from FASE 3):
   - Distinct topics in searches × 15
   - Pattern diversity × 10
   - Score: min(100, sum)

**Overall Complexity Score:** Average of 5 metrics

**Concern Identification:**

Analyze research and intent to identify distinct concerns:
- **Models layer**: Database schema, migrations, model classes, relationships
- **Backend layer**: Controllers, services, business logic, API endpoints
- **Frontend layer**: Views, components, forms, client-side logic
- **Integration layer**: External APIs, third-party services, webhooks
- **Infrastructure layer**: Queues, caching, background jobs

**Coupling Analysis:**

For each pair of concerns, determine coupling level:
- **LOW**: Concerns communicate via clean interfaces only
- **MEDIUM**: Some shared dependencies but mostly independent
- **HIGH**: Tightly coupled, changes in one affect the other

**Dynamic Decision Logic:**

```
if overall_score < 50:
    → SINGLE_TASK (too simple to split)

if overall_score >= 70 AND concerns >= 2 AND coupling == LOW:
    → PARTS (clear case for splitting)

if overall_score >= 80:
    → PARTS (very complex, always split)

if overall_score 50-70:
    if concerns >= 3 AND coupling in [LOW, MEDIUM]:
        → PARTS (multiple concerns justify split)
    else:
        → SINGLE_TASK (manageable as single task)

default:
    → SINGLE_TASK
```

**If PARTS decision:**

Generate part breakdown:
1. Name each part using pattern: `{NN}-{concern-name}`
   - 01 for foundational layers (usually models)
   - 02+ for dependent layers
   - Example: `01-cart-models`, `02-payment-backend`, `03-checkout-ui`

2. Assign scope to each part:
   - Which models/migrations
   - Which controllers/services
   - Which views/components
   - Which patterns from FASE 3 research

3. Determine dependencies:
   - Models usually have no dependencies
   - Backend depends on models
   - Frontend depends on backend
   - Clear dependency order for implementation

**Present decision (informational only, no confirmation needed):**

```
📊 COMPLEXITY ANALYSIS

| Metric | Value |
|--------|-------|
| **Overall Score** | {score}/100 |
| **Coupling** | {LOW/MEDIUM/HIGH} |
| **Decision** | {SINGLE_TASK / PARTS} |

**Breakdown:**

| Category | Score |
|----------|-------|
| Architecture | {score}% |
| Setup | {score}% |
| Testing | {score}% |
| Intent Scope | {score}% |
| Research Breadth | {score}% |

**Identified concerns:** {N}

| Concern | Description |
|---------|-------------|
| {concern 1} | {brief description} |
| {concern 2} | {brief description} |

[If PARTS:]

**Will create {N} parts as sections in single file:**

| Part | Scope |
|------|-------|
| ○ 01-{name} | {scope summary} |
| ○ 02-{name} | {scope summary} |
| ○ 03-{name} | {scope summary} |

Note: All parts will be sections in 01-intent.md and 01-research.md (no subfolders)

→ Proceeding to generate contexts...
```

**Continue to FASE 6** with decomposition decision and part data (if applicable)

---

### FASE 6: Output Generation

**Goal:** Generate clean, structured context block(s) for Claude Code using automated script.

**Strategy:** Use Python script to handle all folder creation and file generation based on FASE 5 decomposition decision.

---

#### Step 1: Prepare Output Data

Collect all data needed for output generation:

```json
{
  "mode": "NEW|UPDATE_AFTER_DEBUG|UPDATE_PLAN",
  "task_type": "FEATURE|EXTEND",
  "decision": "SINGLE_TASK|PARTS",
  "feature_name": "{name}",
  "parent_feature": "{parent if extend/change}",
  "complexity": {score},
  "intent_summary": "{from FASE 2}",
  "intent": {
    "requirements": ["{functional requirements}"],
    "testable_requirements": [
      {
        "id": "REQ-001",
        "description": "{requirement description}",
        "category": "core|api|ui|integration|edge_case",
        "test_type": "manual|automated_ui|automated_api|automated_unit",
        "passes": false
      }
    ],
    "data_models": "{models description}",
    "ui_components": "{UI components}",
    "interactions": "{CRUD + custom actions}",
    "auth": "{authentication requirements}",
    "edge_cases": ["{edge cases}"],
    "constraints": "{constraints}",
    "validation": ["{validation rules}"],
    "success_criteria": ["{success criteria}"]
  },
  "research": {
    "conventions": "{from best-practices-researcher}",
    "patterns": "{framework idioms}",
    "api_usage": "{API recommendations}",
    "architecture": "{from architecture-researcher}",
    "pattern_details": "{detailed patterns}",
    "schema": "{database schema}",
    "models": "{model structure}",
    "routes": "{routes/controllers}",
    "setup": "{setup patterns}",
    "testing": "{from testing-researcher}",
    "test_scenarios": "{what to test}",
    "test_approach": "{how to test}",
    "pitfalls": "{common pitfalls}",
    "coverage": {scores}
  },
  "parts": [
    {
      "number": "01",
      "name": "{concern-name}",
      "scope": "{what this part covers}",
      "intent": {
        "requirements": [],
        "testable_requirements": [
          {
            "id": "REQ-001",
            "description": "{requirement description}",
            "category": "core|api|ui|integration|edge_case",
            "test_type": "manual|automated_ui|automated_api|automated_unit",
            "passes": false
          }
        ],
        "data_models": "",
        "ui_components": "",
        "edge_cases": [],
        "constraints": "",
        "success_criteria": []
      },
      "research": {
        "conventions": "",
        "patterns": "",
        "schema": "",
        "models": "",
        "test_scenarios": "",
        "test_approach": ""
      },
      "architecture": "{relevant patterns}",
      "setup": "{specific migrations/models}",
      "testing": "{test approach}",
      "dependencies": []
    }
  ],
  "selected_architecture": {
    "approach": "MINIMAL_CHANGES|CLEAN_ARCHITECTURE|PRAGMATIC_BALANCE",
    "philosophy": "{approach philosophy}",
    "design_overview": "{architecture overview}",
    "files_to_create": [
      {"file": "{path}", "purpose": "{purpose}", "dependencies": "{deps}"}
    ],
    "files_to_modify": [
      {"file": "{path}", "change": "{change}", "reason": "{reason}"}
    ],
    "implementation_sequence": [
      {"phase": "Foundation", "steps": ["{step 1}", "{step 2}"]},
      {"phase": "Core Logic", "steps": ["{step 1}", "{step 2}"]},
      {"phase": "Integration", "steps": ["{step 1}", "{step 2}"]}
    ],
    "critical_considerations": {
      "error_handling": "{approach}",
      "state_management": "{approach}",
      "testing_strategy": "{approach}",
      "performance": "{considerations}",
      "security": "{considerations}"
    },
    "estimated_complexity": {
      "files_to_create": "{X}",
      "files_to_modify": "{Y}",
      "testing_effort": "Low|Medium|High"
    }
  },
  "debug_history": "{if UPDATE_AFTER_DEBUG mode}",
  "changes_requested": "{if UPDATE_PLAN mode}"
}
```

**Note:** The data is now split into `intent` (user requirements) and `research` (Context7 findings). This enables separate output files.

Save to temporary file: `/tmp/1-plan_output_data.json`

---

#### Step 2: Execute Output Generation Script

**For NEW features/extends:**

```bash
python3 .claude/resources/scripts/1-plan/generate_output.py \
  --input /tmp/1-plan_output_data.json \
  --output-summary /tmp/1-plan_output_summary.json
```

**For UPDATE modes:**

```bash
python3 .claude/resources/scripts/1-plan/generate_output.py \
  --input /tmp/1-plan_output_data.json \
  --mode update \
  --existing-context .workspace/features/{name}/01-intent.md \
  --output-summary /tmp/1-plan_output_summary.json
```

**Script responsibilities:**
- Parse input data
- Determine folder structure (flat for all - no subfolders for parts or extend/change)
- Create folder structure using FEATURE_FOLDER_STRUCTURE.md rules
- Generate split context files with sections:
  - `01-intent.md`: User requirements, scope, constraints, **testable requirements (REQ-IDs)**, **part sections**
  - `01-research.md`: Context7 research, patterns, best practices, **part research sections**
  - `01-architecture.md`: Selected architecture blueprint (if FASE 3.5 was executed)
- Parts: Generate as sections with status markers (○ pending, ● in_progress, ✓ completed, ✗ blocked)
- Extend/change: Append sections to existing files
- Write files to disk
- Return summary JSON

---

#### Step 3: Parse and Present Results

Read output summary from `/tmp/1-plan_output_summary.json`:

**For FEATURE (new, single task):**
```json
{
  "success": true,
  "mode": "NEW",
  "decision": "SINGLE_TASK",
  "feature_path": ".workspace/features/checkout/",
  "created_folders": [".workspace/features/checkout/"],
  "created_files": [
    ".workspace/features/checkout/01-intent.md",
    ".workspace/features/checkout/01-research.md",
    ".workspace/features/checkout/01-architecture.md"
  ],
  "modified_files": [],
  "implementation_order": []
}
```

**For FEATURE (new, parts):**
```json
{
  "success": true,
  "mode": "NEW",
  "decision": "PARTS",
  "feature_path": ".workspace/features/checkout/",
  "created_folders": [".workspace/features/checkout/"],
  "created_files": [
    ".workspace/features/checkout/01-intent.md",
    ".workspace/features/checkout/01-research.md",
    ".workspace/features/checkout/01-architecture.md"
  ],
  "modified_files": [],
  "implementation_order": ["01-cart-models", "02-payment-backend", "03-checkout-ui"]
}
```

Note: Parts are now sections within the single intent/research files, not separate folders.

**For EXTEND/CHANGE (append):**
```json
{
  "success": true,
  "mode": "NEW",
  "decision": "APPEND",
  "task_type": "EXTEND",
  "feature_path": ".workspace/features/checkout/",
  "feature_name": "guest-checkout",
  "parent_feature": "checkout",
  "created_folders": [],
  "created_files": [],
  "modified_files": [
    ".workspace/features/checkout/01-intent.md",
    ".workspace/features/checkout/01-research.md",
    ".workspace/features/checkout/01-architecture.md"
  ],
  "implementation_order": []
}
```

**Present results based on decision:**

**If SINGLE_TASK:**
```
✅ CONTEXT GENERATED

Feature: {name}
Complexity: {score}/100
Architecture: {selected approach name} (if FASE 3.5 executed)

Context saved:
- .workspace/features/{name}/01-intent.md       (requirements)
- .workspace/features/{name}/01-research.md     (patterns)
- .workspace/features/{name}/01-architecture.md (blueprint - if FASE 3.5 executed)

Ready for implementation via /2-code

Next: Run /2-code {name}
```

**If PARTS:**
```
✅ CONTEXT GENERATED

Feature: {name}
Complexity: {score}/100
Architecture: {selected approach name} (if FASE 3.5 executed)
Parts: {N} (all sections in single files)

Part progress:
- ○ 01-{name} (pending)
- ○ 02-{name} (pending)
- ○ 03-{name} (pending)

Context saved:
- .workspace/features/{name}/01-intent.md       (requirements + part sections)
- .workspace/features/{name}/01-research.md     (patterns + part sections)
- .workspace/features/{name}/01-architecture.md (blueprint - if FASE 3.5 executed)

Implementation order:
1. 01-{name} (no dependencies)
2. 02-{name} (requires 01-{name})
3. 03-{name} (requires 02-{name})

Ready for implementation via /2-code

Next: Run /2-code {name}
```

**If EXTEND/CHANGE:**

**Update 00-overview.md Pending section (if exists):**
- Read `.workspace/features/{parent}/00-overview.md`
- If file exists, append row to `## Pending` table:
  ```markdown
  | {Extend/Change} | {name} | [→](01-intent.md#{type}-{name}) |
  ```
- If `## Pending` section doesn't exist, create it after `## Status`

```
✅ CONTEXT APPENDED

{Extend/Change}: {name}
Parent feature: {parent}
Complexity: {score}/100
Architecture: {selected approach name} (if FASE 3.5 executed)

Modified files:
- .workspace/features/{parent}/01-intent.md      (section appended)
- .workspace/features/{parent}/01-research.md    (section appended)
- .workspace/features/{parent}/01-architecture.md (section appended - if exists)
- .workspace/features/{parent}/00-overview.md    (Pending entry added - if exists)

New sections added:
- ## Extend: {name} ({date}) in 01-intent.md
- ## Extend: {name} ({date}) in 01-research.md

Pending entry added to 00-overview.md:
| {Extend/Change} | {name} | [→](01-intent.md#{type}-{name}) |

Ready for implementation via /2-code

Next: Run /2-code {parent}
```

---

#### Step 4: Cleanup

Remove temporary files:
```bash
rm /tmp/1-plan_output_data.json
rm /tmp/1-plan_output_summary.json
```

---

#### Step 5: Create Feature Branch & Worktree (NEW mode only)

**Skip if:** Mode is UPDATE_AFTER_DEBUG, UPDATE_PLAN, or task_type is EXTEND/CHANGE

**Goal:** Create a feature branch AND worktree for this feature. This enables parallel work on multiple features - each in its own isolated directory.

**Steps:**

1. **Detect base branch (main vs develop):**
   ```bash
   # Check if develop branch exists
   git branch --list "develop"
   ```
   - If develop exists → `base_branch = "develop"`
   - If develop doesn't exist → `base_branch = "main"` (fallback to "master" if no main)

   ```bash
   # Verify base branch exists
   git branch --list "{base_branch}"
   ```

2. **Generate names:**
   ```
   branch_name = "feature/{feature-name}"
   worktree_path = "../{project-name}--{feature-name}"
   ```

   **Note:** `{project-name}` is the current directory name (basename of pwd).

3. **Check if branch/worktree already exists:**
   ```bash
   git branch --list "feature/{feature-name}"
   git worktree list | grep "{feature-name}"
   ```

4. **If branch/worktree does NOT exist:**
   ```bash
   # Create branch AND worktree in one command
   git worktree add "{worktree_path}" -b feature/{feature-name} {base_branch}
   ```

   **If worktree add fails:** Report error and suggest manual resolution.

5. **Copy .claude folder to worktree (if symlinks don't work):**
   ```bash
   # Check if .claude exists in worktree
   if [ ! -d "{worktree_path}/.claude" ]; then
     # Copy or create symlink
     cp -r .claude "{worktree_path}/.claude"
   fi
   ```

   **Note:** On Windows with junctions, the .claude folder should already be available via the junction in the main repo.

6. **Save worktree info in feature folder:**
   ```bash
   # Save worktree path (absolute path)
   echo "{absolute_worktree_path}" > .workspace/features/{feature-name}/.worktree

   # Save base branch for reference
   echo "{base_branch}" > .workspace/features/{feature-name}/.base-branch
   ```

   **Note:** The `.branch` file is replaced by `.worktree` file.

7. **Report worktree creation:**
   ```
   🌿 FEATURE WORKTREE CREATED

   Worktree: {absolute_worktree_path}
   Branch: feature/{feature-name}
   Base: {base_branch}
   Status: Ready for parallel work

   📂 To work on this feature, open in a new VSCode window:
      code "{worktree_path}"

   Or use: /worktree {feature-name}
   ```

**If worktree ALREADY exists:**
```
ℹ️ FEATURE WORKTREE EXISTS

Worktree: {worktree_path}
Branch: feature/{feature-name}
Status: Already exists

Saving reference to .workspace/features/{feature-name}/.worktree
```

Still save the `.worktree` and `.base-branch` files to ensure the link is documented.

---

**CHECKPOINT 3** - Final output delivered

**Send notification:**
```bash
powershell -ExecutionPolicy Bypass -File .claude/scripts/notify.ps1 -Title "Claude Code" -Message "Planning complete"
```

**Auto-commit changes:**
```bash
git add .workspace/features/{name}/
git commit -m "$(cat <<'EOF'
plan({name}): {summary}

{description}
EOF
)"
```

**Commit message format:**
- `{name}`: Feature/extend/change name
- `{summary}`: One-line summary (e.g., "Add checkout feature context")
- `{description}`: 2-3 lines describing what was planned:
  - Task type (FEATURE/EXTEND/CHANGE)
  - Key requirements identified
  - Architecture approach selected (if FASE 3.5 ran)

**IMPORTANT:** Do NOT add Co-Authored-By, 🤖 Generated with Claude Code, or any other footer to pipeline commits.

**Show copyable next command:**

After completion, always display:

```text
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 NEXT COMMAND (copy after /clear):

/2-code {feature-name}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

**Note:** All mode-specific logic (NEW, UPDATE_AFTER_DEBUG, UPDATE_PLAN) is handled by the generate_output.py script. The script reads the mode from input JSON and applies appropriate logic internally.

---

## Error Handling

### No Project Instructions

- Ask user for tech stack directly
- Continue with user-provided information
- Note in output that stack info is user-provided

### Context7 Search Fails

- Try alternative search terms (broader/narrower)
- Try different library naming
- If persistent: inform user and offer to continue without research
- Proceed with intent-only output if user agrees

### Unclear Task Type

- Give examples of each type
- Ask for clarification
- Do NOT guess

### Incomplete Intent

- Show what's missing
- Ask specific follow-up questions
- Do NOT proceed to Phase 2

### Error Output Templates

**Invalid Input:**
```
❌ INVALID INPUT

Problem: {specific validation error}
Allowed: {valid format/options}

Examples of valid input:
- {example 1}
- {example 2}

Try again.
```

**Context7 Research Failure:**
```
❌ RESEARCH FAILED

Problem: Could not connect to Context7
All 3 research agents failed to retrieve documentation
```

Then use **AskUserQuestion** tool:
- header: "Research Failed"
- question: "Context7 research failed. How do you want to proceed?"
- options:
  - label: "Retry (Recommended)", description: "Try again - Context7 may be temporarily down"
  - label: "Continue without research", description: "Generate intent-only context without research data"
  - label: "Cancel", description: "Stop the planning workflow"
- multiSelect: false

**Response Handling:**
- "Retry" → Restart FASE 3 research agents
- "Continue without research" → Skip to FASE 3.5 with intent data only
- "Cancel" → Exit workflow gracefully

**Agent Execution Failure:**
```
❌ AGENT ERROR

Problem: {agent-name} agent crashed during execution
Error: {error message}

This is likely a system problem. Please:
1. Report this error to the skill maintainer
2. Retry /1-plan to try again

The skill cannot continue without agent completion.
```

**File Generation Failure:**
```
❌ OUTPUT GENERATION FAILED

Problem: Could not create context files
Path: {path}
Error: {error message}

Possible causes:
- Folder permission issue
- Disk full
- Invalid path characters

Check folder permissions and try again.
```

**Feature Not Found (UPDATE mode):**
```
❌ FEATURE NOT FOUND

Problem: Feature "{name}" does not exist in .workspace/features/
Available features: {list of features}
```

Then use **AskUserQuestion** tool:
- header: "Feature Not Found"
- question: "The specified feature does not exist. What do you want to do?"
- options:
  - label: "Select different feature (Recommended)", description: "Choose from available features listed above"
  - label: "Create new feature", description: "Start creating a new feature instead"
  - label: "Cancel", description: "Stop the planning workflow"
- multiSelect: false

**Response Handling:**
- "Select different feature" → Ask user to specify feature name from list
- "Create new feature" → Switch to NEW mode, proceed to FASE 1
- "Cancel" → Exit workflow gracefully

---

## Best Practices

### Notifications
- **Notify when Claude waits for user input AFTER a long-running phase**
- Notification moments:
  - Start FASE 2 (after FASE 1.5 exploration): "Ready for your input"
  - CHECKPOINT 2 (after FASE 3 + 3.5 research/architecture): "Architecture options ready"
  - After FASE 6 (workflow complete): "Planning complete"
- Use the shared script: `.claude/scripts/notify.ps1` with `-Title` and `-Message` parameters
- Never skip notifications - user may be away from screen during agent execution

### Skip Modals (Just-in-Time)

Each agent phase offers a skip option via modal:

| Phase | Modal Question | Skip Effect |
|-------|---------------|-------------|
| FASE 1.5 | "Run codebase exploration?" | Skip directly to FASE 2 |
| FASE 3 | "Run Context7 research?" | Use baseline only (if available) |
| FASE 3.5 | "Run architecture design?" | Auto-select Pragmatic approach |

**Guidelines:**
- Always show skip modal unless auto-skip conditions apply
- Baseline is ALWAYS loaded if exists (regardless of FASE 3 skip choice)
- Skipping all 3 phases = "Quick mode" (~2 min faster, no agents)
- Recommend "Yes" for complex/unfamiliar features
- Recommend "Skip" for simple/well-known patterns

**Auto-skip conditions (no modal shown):**
- FASE 1.5: UPDATE_AFTER_DEBUG or UPDATE_PLAN mode
- FASE 3: None (always ask, baseline always loaded)
- FASE 3.5: UPDATE_PLAN mode

### Language
Follow the Language Policy in CLAUDE.md.

### Tone & Communication Style
- **BUSINESS-LIKE** - no fluff, no compliments, no "great question!", no "interesting!"
- **DIRECT** - straight to the point, no unnecessary context
- **FUNCTIONAL** - only ask what's needed, answer what's asked
- When providing suggestions: state options directly without praise
- When user asks opinion: give direct answer without "I would suggest" - just state the option

### Task Classification
- Always determine task type before proceeding
- If user provides type in command, validate it matches intent
- Never guess - ask for clarification if ambiguous
- Present clear examples when user is uncertain

### Intent Clarification
- **Use AskUserQuestion directly** with concrete suggestions + "Explain question" option
- **Open chat only for** initial feature description (truly free)
- **User always has "Other" option** - for custom input beyond given suggestions
- **Wait for all answers** before asking next batch
- **Analyze previous answers** to determine next most relevant batch
- Build on previous answers progressively - each batch should be informed by previous answers
- Challenge assumptions - ask critical "why" questions when appropriate
- Focus on concrete details, not abstract descriptions
- Identify edge cases through targeted follow-up questions
- Stop asking when you have complete picture (don't over-ask)
- Always create summary and wait for explicit "yes" confirmation

### Codebase Exploration (FASE 1.5)
- Launch 3 code-explorer agents in parallel for NEW mode only
- Each agent has different focus: similar-features, architecture, implementation
- Skip exploration for UPDATE modes (codebase already understood)
- Use exploration findings to inform FASE 2 questions
- Reference discovered patterns when providing suggestions
- Skip questions that can be answered by existing patterns

### Context7 Research (via 3 parallel specialized agents)
- FASE 3 research uses 3 specialized agents running in parallel for efficiency
- **best-practices-researcher**: Framework conventions, idioms, design patterns
- **architecture-researcher**: Architecture patterns, database design, project setup
- **testing-researcher**: Testing strategies, edge cases, common pitfalls
- Each agent autonomously plans research using sequential thinking
- Each agent reads .claude/CLAUDE.md to extract technology stack
- Each agent achieves >= 75% coverage for their specialized domain
- Launch all 3 agents in single message with 3 Task tool calls (parallel execution)
- Combine 3 outputs into unified research result for FASE 3.5
- If any agent < 75% coverage, selectively retry that agent only

### Architecture Design (FASE 3.5)
- Launch 3 code-architect agents in parallel after FASE 3 completes
- Each agent designs ONE approach: Minimal Changes, Clean Architecture, Pragmatic Balance
- Agents use FASE 3 research + codebase exploration as input
- Present all 3 options with trade-offs comparison to user
- Always provide recommendation with rationale
- Use AskUserQuestion modal for architecture selection
- Wait for explicit user selection at CHECKPOINT 2
- Skip if: UPDATE_PLAN mode, complexity < 30, user requests skip
- Selected architecture flows to FASE 5 (complexity) and FASE 6 (output)

### Sequential Thinking Usage
- NOT needed for FASE 2 (Intent Clarification) - conversational flow is better
- NOT needed for FASE 3 (Research) - 3 specialized agents handle this autonomously
- Use for FASE 4 (Output Generation) if needed for structuring complex outputs

### Output Quality
- Keep context block clean and actionable
- Only include relevant insights from research
- Clearly separate INTENT from BEST PRACTICES
- Always use stack-specific information from Project Instructions
- Emphasize that Claude Code applies principles to specific codebase
- Use code fence for easy copying

### CHECKPOINT Discipline
- CHECKPOINT 1 (after FASE 2): ALWAYS use AskUserQuestion modal for confirmation
- CHECKPOINT 2 (after FASE 3.5): ALWAYS use AskUserQuestion modal for architecture selection
- FASE 3 runs automatically after CHECKPOINT 1
- FASE 3.5 runs automatically after FASE 3 (unless skip conditions met)
- Never proceed to FASE 3 without CHECKPOINT 1 confirmation
- Never proceed to FASE 4 without CHECKPOINT 2 selection
- Reconfirm if user provides unclear response at checkpoints

---

## Restrictions

This skill must NEVER:
- Use phrases like "Great question!", "Interesting!", "I would suggest", or other fluff
- Give compliments or praise to user input
- Add unnecessary context or explanations
- Ask more than 3 questions in single batch
- Skip CHECKPOINT 1 or proceed to FASE 3 without explicit user confirmation
- Skip CHECKPOINT 2 or proceed to FASE 4 without architecture selection (unless skip conditions met)
- Write or generate actual code (that's Claude Code's job)
- Make concrete implementation decisions (Claude Code determines this)
- Execute commands or run code
- Make assumptions about requirements when unclear
- Guess task type when ambiguous
- Proceed to FASE 3 without complete FASE 2 confirmation
- Proceed to FASE 4 without FASE 3.5 architecture selection (unless skipped)
- Proceed to FASE 4 without executing research
- Specify which files to modify/create (Claude Code determines this)
- Dump entire documentation pages (distill to principles)

This skill must ALWAYS:
- Use business-like, direct tone - no fluff, no compliments
- State information/suggestions directly without "I would suggest" or praise
- When providing suggestions: use AskUserQuestion for confirmation
- **Use AskUserQuestion directly** with concrete suggestions + "Explain question"
- **Open chat only for** initial feature description (truly free)
- Classify task type first (FASE 0)
- **Launch codebase exploration (FASE 1.5) before FASE 2** for NEW mode
- **Use exploration context to enhance questions** in FASE 2
- **Reference discovered patterns in suggestions** during FASE 2
- **Extract testable requirements** after intent questions using sequential thinking
- **Present requirements for user review** before summary (ok/add/remove/edit)
- **Include requirements in summary** with REQ-IDs, categories, and test types
- Wait for explicit user confirmation at CHECKPOINT 1 after FASE 2 ("yes")
- **Launch 3 research agents in parallel** using single message with 3 Task tool calls in FASE 3
- Validate combined coverage from all 3 agents (>= 75%) before proceeding to FASE 3.5
- Selectively retry only low-coverage agents if needed (< 75%)
- Combine outputs from 3 agents into unified research structure
- **Launch 3 code-architect agents in parallel** for FASE 3.5 (unless skip conditions)
- **Present all 3 architecture options** with trade-offs and recommendation
- **Wait for user architecture selection** at CHECKPOINT 2 via AskUserQuestion modal
- **Include selected architecture** in FASE 6 output (01-architecture.md)
- Use exact output template format in FASE 6
- Keep output compact and principle-based
- Handle missing Project Instructions gracefully (agents will handle this)
- Ask clarifying questions when user intent is unclear