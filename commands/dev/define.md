---
description: Define web feature requirements and architecture
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
   - Continue to FASE 1

2. **If no name** (`/dev:define`):
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

Show requirements table and confirm with user.

### FASE 2: Architecture Check (Automatisch)

**Goal:** Automatisch bepalen of research nodig is op basis van stack-baseline.

**Steps:**

1. **Read stack-baseline.md:**
   ```
   Read(".claude/research/stack-baseline.md")
   ```

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
   Tip: Run /setup om baseline te genereren.
   ```
   - Always launch web-stack-researcher agent
   - Do NOT create baseline (that's /setup's job)

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

| ID | Requirement | Category | Test Type |
|----|-------------|----------|-----------|
| REQ-001 | {description} | {category} | {type} |

## User Answers
{answers from FASE 1}

## API Contract (alleen als stack Laravel bevat)

### Endpoints
| Method | Endpoint | Request | Response | Auth |
|--------|----------|---------|----------|------|
| GET | /api/{resource} | - | {Resource}Collection | Sanctum |
| POST | /api/{resource} | Create{Resource}Request | {Resource}Resource | Sanctum |

### Request Types
| Type | Field | Validation |
|------|-------|------------|
| Create{Resource}Request | {field} | {rules} |

### Response Types
| Type | Field | Type |
|------|-------|------|
| {Resource}Resource | id | number |
| {Resource}Resource | {field} | {type} |

### Laravel Files
| File | Type | Purpose |
|------|------|---------|
| app/Models/{Resource}.php | Model | Eloquent model |
| app/Http/Controllers/Api/{Resource}Controller.php | Controller | API handlers |
| app/Http/Resources/{Resource}Resource.php | Resource | JSON transformation |
| database/migrations/xxxx_create_{table}_table.php | Migration | Schema |

## Stack Research
{if research was done}

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

**Completion notification:**
```bash
powershell -ExecutionPolicy Bypass -File .claude/scripts/notify.ps1 -Title "Claude Code" -Message "Definition complete"
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
