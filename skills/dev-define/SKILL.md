---
name: dev-define
description: Define web feature requirements and architecture with structured output. Use with /dev-define to create detailed feature specifications before building.
disable-model-invocation: true
metadata:
  author: mileszeilstra
  version: 1.0.0
  category: dev
---

# Web Feature Definition

## Overview

This skill defines web feature requirements and architecture for React/web projects. It is FASE 1 of a 3-step dev workflow: define -> build -> test.

The skill gathers requirements through targeted questions, optionally researches stack patterns, and designs the implementation. Output is a consolidated documentation file ready for the build phase.

**Trigger**: `/dev:define` or `/dev:define [feature-name]`

## When to Use

**Triggers:**

- `/dev:define` - Start with feature name prompt
- `/dev:define auth` - Define authentication system
- `/dev:define product-list` - Define product list component

**Works best with:**

- React projects (JavaScript or TypeScript)
- Full-stack apps with Laravel backend
- Web apps needing components, hooks, state management

## Workflow

### FASE 0: Feature Name

1. **If name provided** (`/dev:define auth`):
   - Use provided name as feature name
   - Continue to step 3

2. **If no name** (`/dev:define`):

   **a) Check backlog for next feature:**

   ```
   Read(".workspace/backlog.md")
   ```

   - If backlog exists: parse the `**Next:**` line (e.g. `**Next:** /dev:define page-layout`)
   - Extract feature name from that line

   **b) If backlog has a next feature:**

   Use **AskUserQuestion** tool:
   - header: "Feature Name"
   - question: "Volgende feature uit backlog: **{feature-name}**. Hiermee doorgaan?"
   - options:
     - label: "{feature-name} (Recommended)", description: "{description from backlog TODO list}"
     - label: "Andere feature", description: "Ik wil een andere feature definiëren"
   - multiSelect: false

   - If user picks the backlog feature → use that name, continue to step 3
   - If user picks "Andere feature" → fall through to option (c)

   **c) If no backlog found OR user wants a different feature:**

   Use **AskUserQuestion** tool:
   - header: "Feature Name"
   - question: "Welke web feature wil je definiëren?"
   - options:
     - label: "Component System", description: "Herbruikbare UI componenten en design system"
     - label: "Page/Route", description: "Pagina, navigatie, routing"
     - label: "API Integration", description: "Data fetching, API calls, backend integratie"
     - label: "State Management", description: "Global state, context, stores"
   - multiSelect: false

3. **Create workspace folder:**

   ```bash
   mkdir -p .workspace/features/{feature-name}
   ```

4. **Load stack-baseline as context:**

   ```
   Read(".claude/research/stack-baseline.md")
   ```

   - If found: store as context for all subsequent phases (requirements, design, architecture)
   - If not found: note absence, continue without (research may be triggered in FASE 2)

   ```
   ℹ Stack baseline loaded — context available for all phases.
   ```

   Or if not found:

   ```
   ⚠ Stack baseline not found — run /core-setup to generate.
   ```

### FASE 1: Requirements Gathering

Ask 5 targeted questions using AskUserQuestion:

**Question 1: Core Function**

- header: "Core Function"
- question: "Wat moet deze feature doen vanuit gebruikersperspectief?"

**Question 2: Patterns**

- header: "Patterns"
- question: "Welke patterns zijn betrokken?"
- options: Component-based, Hook-based, Context/State, Server-side

**Question 3: User Interactions**

- header: "Interactions"
- question: "Welke user interacties moet deze feature ondersteunen?"
- options: Form inputs, Click handlers, Navigation, Real-time updates

**Question 4: Visual Feedback**

- header: "Visuals"
- question: "Welke visuele feedback is nodig?"
- options: Loading states, Animations, Toast/alerts, Form validation

**Question 5: Data Flow**

- header: "Data Flow"
- question: "Waar komt de data vandaan?"
- options:
  - label: "API calls", description: "Data van Laravel backend"
  - label: "Local state only", description: "Alleen client-side state"
  - label: "Persisted storage", description: "LocalStorage, IndexedDB"
  - label: "Real-time", description: "WebSocket, Server-Sent Events"
- multiSelect: true

#### Requirement Extraction

After questions, extract testable requirements:

- Each requirement gets an ID (REQ-001, REQ-002, etc.)
- Categorize by type (core, component, hook, state)
- Determine test type for each
- Define acceptance criteria per requirement (concrete, verifiable conditions informed by stack-baseline context when available)

Show requirements table with acceptance criteria and confirm with user:

| ID      | Requirement   | Category   | Test Type | Acceptance Criteria    |
| ------- | ------------- | ---------- | --------- | ---------------------- |
| REQ-001 | {description} | {category} | {type}    | {verifiable condition} |

### FASE 1b: Scope Analysis & Feature Splitting

**Goal:** Analyze gathered requirements and decide whether to keep as a single feature or split into multiple sub-features for optimal build execution.

**Steps:**

1. **Analyze requirement scope:**

   Count requirements and map dependency graph from FASE 1 output.

   ```
   SCOPE ANALYSIS:

   Total requirements: {count}
   Categories: {list of unique categories}
   Dependency depth: {max chain length}
   ```

2. **Identify dependency clusters:**

   Group requirements that depend on each other into clusters:
   - Requirements with direct dependencies → same cluster
   - Requirements with no cross-dependencies → separate clusters
   - Single isolated requirements → own cluster or attach to nearest related cluster

3. **Apply decision logic:**

   ```
   IF requirements ≤ 6 AND single category/concern:
     → SINGLE feature (continue normally)

   IF requirements 7-10:
     → EVALUATE: check if ≥2 natural clusters exist with ≤2 cross-dependencies
     → If clusters found: RECOMMEND SPLIT
     → If tightly coupled: SINGLE feature

   IF requirements > 10:
     → RECOMMEND SPLIT (unless linear dependency chain with single concern)
   ```

4. **If SINGLE feature:**

   ```
   ✓ Scope analysis: SINGLE FEATURE

   Requirements: {count}
   Reason: {e.g., "tightly coupled, single concern", "≤6 requirements"}

   → Continuing to architecture design.
   ```

   Proceed to FASE 2.

5. **If SPLIT recommended:**

   Show proposed split:

   ```
   SPLIT RECOMMENDATION:

   Requirements: {count} → {n} sub-features

   1. {feature-name}-{sub1} (REQ-001, REQ-002, REQ-003)
      Focus: {description of this group's concern}

   2. {feature-name}-{sub2} (REQ-004, REQ-005)
      Focus: {description of this group's concern}

   Build order: {sub1} → {sub2}
   Cross-dependencies: {list or "none"}
   ```

   Use **AskUserQuestion** for confirmation:
   - header: "Feature Split"
   - question: "Akkoord met deze opsplitsing?"
   - options:
     - label: "Akkoord (Recommended)", description: "Opsplitsen in {n} sub-features"
     - label: "Aanpassen", description: "Ik wil de groepering wijzigen"
     - label: "Eén feature houden", description: "Niet splitsen, alles in één feature"
     - label: "Vraag uitleggen", description: "Leg uit wat dit betekent"
   - multiSelect: false

   **Response Handling:**
   - Akkoord → proceed with split
   - Aanpassen → ask which requirements should move where, regenerate split
   - Eén feature houden → proceed as SINGLE feature to FASE 2

6. **Execute split (if approved):**

   a. Create parent documentation:

   Write `.workspace/features/{feature-name}/00-split.md`:

   ````markdown
   # Feature Split: {Feature Name}

   **Created:** {date}
   **Status:** split
   **Original requirements:** {count}
   **Sub-features:** {count}

   ## Split Decision

   Reason: {why split was recommended}

   ## Sub-features

   | #   | Sub-feature   | Requirements              | Focus   |
   | --- | ------------- | ------------------------- | ------- |
   | 1   | {name}-{sub1} | REQ-001, REQ-002, REQ-003 | {focus} |
   | 2   | {name}-{sub2} | REQ-004, REQ-005          | {focus} |

   ## Build Order

   1. {name}-{sub1} (base, no dependencies)
   2. {name}-{sub2} (after {sub1})

   ## Commands

   ```
   /dev:build {name}-{sub1}
   /dev:build {name}-{sub2}
   ```
   ````

   b. Create sub-feature workspace folders:

   ```bash
   mkdir -p .workspace/features/{feature-name}-{sub1}
   mkdir -p .workspace/features/{feature-name}-{sub2}
   ```

   c. Continue FASE 2-5 for EACH sub-feature sequentially:
   - Re-number requirements per sub-feature (REQ-001, REQ-002, etc.)
   - Each sub-feature gets its own architecture, wireframe, and 01-define.md
   - Use build order: complete all FASEs for sub-feature 1 before starting sub-feature 2

7. **Update backlog (split only):**

   If `.workspace/backlog.md` exists:
   - Replace original feature entry with sub-feature entries
   - Each sub-feature gets its own line in the backlog
   - Add `(split from {original-name})` annotation

### FASE 2: Architecture Check (Automatisch)

**Goal:** Automatisch bepalen of research nodig is op basis van stack-baseline.

**Steps:**

1. **Use pre-loaded stack-baseline:**
   - Use the baseline context loaded in FASE 0
   - If baseline was not found in FASE 0, skip to step 5 (baseline not found fallback)

2. **Extract feature type from requirements:**
   Map the feature to a category:
   - "component" / "ui" → Component
   - "page" / "route" → Page/Route
   - "api" / "fetch" / "data" → API Integration
   - "state" / "context" / "store" → State Management
   - "form" / "input" → Form Handling
   - "auth" / "login" → Authentication

3. **Check Feature Pattern Index in baseline:**

   Look for matching row in `## Feature Pattern Index` table:

   ```
   | Feature Type | Component Type | Pattern | State Approach |
   |--------------|----------------|---------|----------------|
   | Component | Functional | Composition | Props |
   | Page/Route | Page Component | File-based routing | Local state |
   | API Integration | Hook | Custom hook | React Query/SWR |
   | State Management | Context/Store | Provider pattern | Context API |
   | Form Handling | Form Component | Controlled | Form state |
   | Authentication | HOC/Hook | Protected routes | Auth context |
   ```

4. **Decision:**

   **A) Pattern FOUND in baseline:**

   ```
   ✓ Architecture pattern gevonden in baseline

   | Field | Value |
   |-------|-------|
   | Feature Type | {type} |
   | Component Type | {from baseline} |
   | Pattern | {from baseline} |
   | State Approach | {from baseline} |

   → Baseline gebruiken, research overgeslagen.
   ```

   - Use patterns from baseline for FASE 3
   - Skip web-stack-researcher agent

   **B) Pattern NOT FOUND in baseline:**

   ```
   ⚠ Geen architecture pattern gevonden voor "{feature-type}"

   → Research wordt uitgevoerd en baseline wordt bijgewerkt.
   ```

   - Launch web-stack-researcher agent:

   ```
   Task(subagent_type="web-stack-researcher", prompt="
   Feature: {feature-name}
   Type: {feature-type}

   Requirements:
   {list of requirements}

   Patterns: {selected}
   Interactions: {selected}

   Research React/web architecture patterns for this feature.
   Return: Component type, pattern approach, state management, hooks needed.
   ")
   ```

   - **Update stack-baseline.md** with new pattern:
     - Add row to Feature Pattern Index table
     - Add relevant hook patterns if new
     - Add component patterns if new

5. **Baseline not found fallback:**

   If `.claude/research/stack-baseline.md` does not exist:

   ```
   ⚠ Stack baseline niet gevonden.

   → Volledige research wordt uitgevoerd.
   Tip: Run /core-setup om baseline te genereren.
   ```

   - Always launch web-stack-researcher agent
   - Do NOT create baseline (that's /setup's job)

### FASE 2b: Design & Wireframe

**Goal:** Define visual layout and component placement before architecture design.

**Steps:**

1. **Describe layout in ASCII wireframe:**

   ```
   ┌─────────────────────────────────┐
   │ {Header/Nav}                    │
   ├─────────┬───────────────────────┤
   │ {Side}  │ {Main Content}        │
   │         │ ┌───────────────────┐ │
   │         │ │ {Component}       │ │
   │         │ └───────────────────┘ │
   └─────────┴───────────────────────┘
   ```

2. **Define responsive behavior:**
   | Breakpoint | Layout Change |
   |------------|---------------|
   | Mobile (<640px) | {description} |
   | Tablet (640-1024px) | {description} |
   | Desktop (>1024px) | {description} |

3. **Map components to wireframe:**
   - Label each wireframe section with the component name
   - Note key interactive elements (buttons, inputs, toggles)
   - Identify state-dependent visual changes (loading, empty, error)

4. **Confirm wireframe with user:**
   Use **AskUserQuestion**:
   - header: "Wireframe"
   - question: "Klopt dit visuele ontwerp?"
   - options:
     - label: "Ja (Recommended)", description: "Wireframe is correct, ga door"
     - label: "Aanpassen", description: "Ik wil het ontwerp wijzigen"
   - multiSelect: false

### FASE 3: Architecture Design

Design based on requirements (and research if done):

**Component Tree:**

```
{RootComponent} ({feature-name})
├── {ChildComponent} ({ComponentType})
└── {ChildComponent} ({ComponentType})
```

**Files:**
| File | Type | Purpose |
|------|------|---------|
| {path}.tsx | Component | {purpose} |
| {path}.ts | Hook | {purpose} |
| {path}.css | Styles | {purpose} |

**Hooks:**
| Hook | Purpose | Returns |
|------|---------|---------|
| use{Name} | {purpose} | {return type} |

**Types/Interfaces:**
| File | Export | Purpose |
|------|--------|---------|
| {path}.ts | {TypeName} | {purpose} |

**Test Strategy:**
| REQ ID | Test File | Test Function | Type |
|--------|-----------|---------------|------|

### Dependency Analysis

Determine implementation order based on requirement dependencies:

**Analysis process:**

1. For each requirement, identify dependencies on other requirements
2. Base requirements (no dependencies) come first
3. Dependent requirements follow their dependencies

**Output format:**

```
DEPENDENCY ANALYSIS:

REQ-001: {description}
  └── Dependencies: None (BASE)

REQ-002: {description}
  └── Dependencies: REQ-001 (needs {reason})

REQ-003: {description}
  └── Dependencies: REQ-002 (needs {reason})

IMPLEMENTATION ORDER:
1. REQ-001 (base)
2. REQ-002 (after REQ-001)
3. REQ-003 (after REQ-002)
```

### FASE 4: Generate Output

Write to `.workspace/features/{feature-name}/01-define.md`:

```markdown
# Feature Definition: {Feature Name}

**Created:** {date}
**Status:** defined

## Summary

{description}

## Requirements

| ID      | Requirement   | Category   | Test Type | Acceptance Criteria   |
| ------- | ------------- | ---------- | --------- | --------------------- |
| REQ-001 | {description} | {category} | {type}    | {acceptance criteria} |

## User Answers

{answers from FASE 1}

## API Contract (alleen als stack Laravel bevat)

### Endpoints

| Method | Endpoint        | Request                 | Response             | Auth    |
| ------ | --------------- | ----------------------- | -------------------- | ------- |
| GET    | /api/{resource} | -                       | {Resource}Collection | Sanctum |
| POST   | /api/{resource} | Create{Resource}Request | {Resource}Resource   | Sanctum |

### Request Types

| Type                    | Field   | Validation |
| ----------------------- | ------- | ---------- |
| Create{Resource}Request | {field} | {rules}    |

### Response Types

| Type               | Field   | Type   |
| ------------------ | ------- | ------ |
| {Resource}Resource | id      | number |
| {Resource}Resource | {field} | {type} |

### Laravel Files

| File                                               | Type       | Purpose             |
| -------------------------------------------------- | ---------- | ------------------- |
| app/Models/{Resource}.php                          | Model      | Eloquent model      |
| app/Http/Controllers/Api/{Resource}Controller.php  | Controller | API handlers        |
| app/Http/Resources/{Resource}Resource.php          | Resource   | JSON transformation |
| database/migrations/xxxx*create*{table}\_table.php | Migration  | Schema              |

## Stack Research

{if research was done}

## Design & Wireframe

### Layout

{ASCII wireframe}

### Responsive Behavior

{responsive table}

### Component Map

{component-to-wireframe mapping}

## Architecture

### Component Tree

{component tree}

### Files to Create

{components, hooks, types, styles}

### Hooks

{hooks table}

## Implementation Order

### Dependency Analysis

{dependency analysis from FASE 3}

### Build Sequence

1. REQ-XXX - {description} (base)
2. REQ-XXX - {description} (after REQ-XXX)
   ...

## Test Strategy

{test table}

## Next Steps

Run `/dev:build {feature-name}` to start implementation.

UI-heavy feature? Overweeg eerst:
- `/frontend:theme` - Design tokens en kleurenpalet opzetten
- `/frontend:compose` - Wireframes genereren voor visueel ontwerp
```

### FASE 5: Sync Backlog

**Goal:** Update `.workspace/backlog.md` with new status.

**Backlog uses list-based format (not tables) for better readability.**

**Steps:**

1. **Check if backlog exists:**

   ```
   Read(".workspace/backlog.md")
   ```

   - If file not found: skip sync (no backlog to update)

2. **Find feature in backlog:**
   - Search MVP Features, Phase 2, Phase 3 sections for feature name
   - If found: move from `### TODO` to `### DEF` subsection
   - If NOT found: add to "Ad-hoc Features" section

3. **Update feature status (if found in planned features):**

   Move the line from TODO section:

   ```markdown
   ### TODO

   - **contact-form** (FEATURE) → forms
     Contact formulier met validatie
   ```

   To DEF section:

   ```markdown
   ### DEF

   - **contact-form** (FEATURE) → forms
     Contact formulier met validatie
   ```

4. **Add to Ad-hoc Features (if NOT found in planned features):**

   Add to Ad-hoc section under `### DEF`:

   ```markdown
   ### DEF

   - **dark-mode** (FEATURE) - {date}
     {description from 01-define.md}
   ```

   **Note:** If feature was split in FASE 1b, sync each sub-feature individually.
   Each sub-feature entry should include `(split from {parent})` annotation.

5. **Update section header counts:**
   - `## MVP Features ({done}/{total} done)`
   - Recalculate done count

6. **Update "Updated" timestamp:**

   ```
   **Updated:** {current date}
   ```

7. **Update "Next" suggestion:**
   - Find first feature in `### TODO` section
   - Update: `**Next:** /dev:define {first-todo-feature}`

**Output:**

```
BACKLOG SYNCED

Feature: {feature-name}
Status: TODO → DEF
Location: {MVP Features | Phase 2 | Ad-hoc}
```

## Best Practices

- Use AskUserQuestion for all structured choices
- Extract testable requirements with REQ-IDs
- Stack research is optional but recommended for complex features
- Keep architecture focused on what's needed

## Restrictions

This skill must NEVER:

- Write actual implementation code (that's /dev:build's job)
- Skip the requirements extraction step
- Proceed without user confirmation at checkpoints

This skill must ALWAYS:

- Use business-like, direct tone
- Extract testable requirements with REQ-IDs
- Include all sections in 01-define.md output
- Show copyable next command at the end
