---
name: dev-plan
description: Transform idea or brainstorm output into a prioritized web feature plan with optional codebase/Context7/web research. Use with /dev-plan after /thinking-idea or /thinking-brainstorm to create implementation roadmaps.
disable-model-invocation: true
metadata:
  author: mileszeilstra
  version: 1.0.0
  category: dev
---

# Dev Plan

## Overview

This is the **bridge** between `/thinking:*` commands and the dev pipeline.
Transforms structured idea markdown into a prioritized feature backlog ready for `/dev-define`.

**Trigger**: `/dev-plan` or `/dev-plan [paste markdown]`

## Input

Accepts markdown from:

- `/thinking-idea` output
- `/thinking-brainstorm` output
- Any structured web concept markdown

## Output

`.workspace/backlog.md` with:

- Decomposed features
- Dependencies
- MVP vs Phase 2/3 priority
- Direct links to `/dev-define {feature}`

## Workflow

### FASE 0: Input Detection

**Goal:** Auto-detect concept and existing backlog, determine action.

**Process:**

1. **Check if .workspace folder exists:**
   - If `.workspace/` folder does NOT exist → go directly to Scenario D (ask for input)
   - If `.workspace/` folder exists → continue to step 2

2. **Check for existing files (only if .workspace exists):**
   - Check if `.workspace/concept.md` exists
   - Check if `.workspace/backlog.md` exists

3. **Scenario A: Both concept AND backlog exist**
   - Read both files
   - Analyze differences between concept and existing backlog
   - Show comparison:

     ```
     EXISTING BACKLOG DETECTED

     Concept: .workspace/concept.md
     Backlog: .workspace/backlog.md

     Changes detected:
     - NEW: {list of features in concept but not in backlog}
     - REMOVED: {list of features in backlog but not in concept}
     - UNCHANGED: {count} features
     ```

   - Use AskUserQuestion:
     ```yaml
     header: "Backlog Update"
     question: "Er bestaat al een backlog. Wat wil je doen?"
     options:
       - label: "Update backlog (Recommended)", description: "Voeg nieuwe features toe, behoud handmatige wijzigingen"
       - label: "Nieuwe backlog", description: "Begin opnieuw, negeer oude backlog"
       - label: "Annuleren", description: "Bekijk eerst de verschillen, doe niets"
       - label: "Explain question", description: "Leg de opties uit"
     multiSelect: false
     ```
   - **If "Update backlog":**
     - Preserve existing priority assignments and notes
     - Add new features from concept
     - Mark removed features as deprecated (don't delete)
     - Continue to FASE 1 with update mode
   - **If "Nieuwe backlog":**
     - Use concept as input, ignore existing backlog
     - Continue to FASE 1 with create mode
   - **If "Annuleren":**
     - Show detailed diff and exit

4. **Scenario B: Only concept exists (no backlog)**
   - Read concept file
   - Show confirmation:

     ```
     CONCEPT DETECTED

     File: .workspace/concept.md
     Title: {extracted title}

     Dit concept wordt gebruikt voor de backlog.
     ```

   - Use AskUserQuestion:
     ```yaml
     header: "Concept Laden"
     question: "Wil je een backlog genereren van dit concept?"
     options:
       - label: "Ja, genereer backlog (Recommended)", description: "Gebruik .workspace/concept.md"
       - label: "Ander concept", description: "Ik wil een ander concept gebruiken"
       - label: "Explain question", description: "Leg uit wat dit betekent"
     multiSelect: false
     ```
   - If "Ja": proceed with loaded concept to FASE 1
   - If "Ander concept": go to Scenario D

5. **Scenario C: Only backlog exists (no concept)**
   - Show warning:

     ```
     WARNING: Backlog exists but no concept found

     Backlog: .workspace/backlog.md
     Concept: Not found (.workspace/concept.md missing)

     Een concept is nodig om de backlog te updaten.
     ```

   - Use AskUserQuestion:
     ```yaml
     header: "Geen Concept"
     question: "Wat wil je doen?"
     options:
       - label: "Concept plakken", description: "Plak een nieuw concept om backlog te updaten"
       - label: "Backlog bekijken", description: "Open de bestaande backlog"
       - label: "Explain question", description: "Leg uit wat dit betekent"
     multiSelect: false
     ```

6. **Scenario D: No .workspace folder OR neither file exists**
   - Ask user to paste concept:
     ```yaml
     header: "Input"
     question: "Plak de output van /thinking-idea of /thinking-brainstorm"
     options:
       - label: "Ik plak het hieronder", description: "Typ of plak je idea/brainstorm markdown"
       - label: "Uit bestand laden", description: "Laad van een bestaand .md bestand"
     multiSelect: false
     ```

7. **If markdown provided inline (overrides auto-detection):**
   - Parse the provided markdown
   - Extract core concept and features
   - Continue to FASE 1

8. **Validate input:**
   - Check for recognizable structure (title, sections)
   - If unclear, ask clarifying questions

**Output:**

```
INPUT LOADED

Source: [.workspace/concept.md | inline | custom file]
Mode: [CREATE | UPDATE]
Title: {extracted title}
Sections: {count}
```

**Research offer:**

Use AskUserQuestion:

```yaml
header: "Research"
question: "Wil je eerst onderzoek doen voordat features worden geëxtraheerd?"
options:
  - label: "Nee, direct extraheren (Recommended)"
    description: "Ga door naar feature extractie"
  - label: "Ja, research doen"
    description: "Codebase, Context7, en/of web research"
  - label: "Explain question"
    description: "Leg uit wat research toevoegt"
multiSelect: false
```

**Response handling:**

- "Nee" → skip to FASE 1
- "Ja" → proceed to FASE 0.5
- "Explain question" → explain that research can analyze existing codebase, check framework docs, and find web examples to inform better feature extraction. Re-ask.

### FASE 0.5: Research (Optional)

**Goal:** Gather codebase, documentation, and web research to inform feature extraction.

**Triggered when:** User chooses "Ja, research doen" at end of FASE 0.

**Step 1: Analyze Research Needs**

Use sequential thinking (mcp\_\_sequentialthinking\_\_sequentialthinking) to determine what research is needed based on the loaded concept:

```
Research checklist:
├─ User: Are there ambiguities that need clarification?
├─ Codebase: Is there an existing codebase with relevant code to analyze?
├─ Context7: Does the concept reference specific frameworks/libraries?
└─ Web: Is external information needed (patterns, pitfalls, examples)?
```

**Output:** List of research categories to execute.

**Step 2: User Clarification (if needed)**

If sequential thinking identifies ambiguities, use AskUserQuestion to clarify before spawning research agents.

**Step 3: Parallel Research Execution**

Spawn agents based on Step 1 analysis. Only spawn agents for categories identified as needed.

**Codebase research (if existing codebase detected):**

```
Task tool with subagent_type: code-explorer
├─ Focus: similar-features
├─ Focus: architecture
└─ Focus: implementation
```

**Context7 research (if framework/library docs needed):**

```
Task tool with subagent_type:
├─ architecture-researcher
├─ best-practices-researcher
└─ testing-researcher
```

**Web research (if external information needed):**

```
Task tool with subagent_type:
├─ plan-web-patterns (best practices, modern approaches)
├─ plan-web-pitfalls (issues, constraints, anti-patterns)
├─ plan-web-examples (real-world implementations)
├─ plan-web-ecosystem (libraries, tools, packages)
└─ plan-web-architecture (system design, scalability)
```

**Step 4: Research Summary**

After all agents return, display a compact summary:

```
RESEARCH COMPLETE

| Category | Agents | Key Findings |
|----------|--------|--------------|
| Codebase | {N}/3  | {summary of existing patterns/features} |
| Context7 | {N}/3  | {summary of framework guidance} |
| Web      | {N}/5  | {summary of patterns/pitfalls} |

→ Research results will inform feature extraction...
```

Research results remain in conversation context for FASE 1. No files are written.

### FASE 1: Feature Extraction

**Goal:** Identify distinct web features from the concept.

1. **Use sequential thinking to analyze:**
   - What are the core pages/routes?
   - What components need to be built?
   - What API endpoints are required?
   - What can be split into independent features?

   **If research was performed (FASE 0.5), also consider:**
   - What already exists in the codebase that can be reused or extended?
   - What framework patterns or conventions should guide the decomposition?
   - What pitfalls or anti-patterns were identified to avoid?

   **Granularity decision:** When a feature could be defined as one large item OR multiple smaller items, apply the right-size rule: each feature should represent **1-3 days of work** and be **testable independently**. If in doubt, prefer smaller features — they're easier to combine than to split later.

2. **Extract features:**
   - Each feature = one `/dev-define` unit
   - Feature should be implementable independently (with dependencies)
   - Name in kebab-case for CLI use

3. **Categorize by type:**
   | Type | Description |
   |------|-------------|
   | FEATURE | Core functionality (auth, pages, core components) |
   | API | Backend endpoints, data fetching, services |
   | INTEGRATION | Third-party services (analytics, payments, auth providers) |
   | UI | Styling, UX improvements, visual components |
   | REFACTOR | Code quality, performance, architecture improvements |

**Output:**

```
FEATURES EXTRACTED

Found {count} features:

| # | Feature | Type | Description |
|---|---------|------|-------------|
| 1 | {name} | {type} | {one-line description} |
| 2 | {name} | {type} | {one-line description} |
...
```

4. **Review with user:**

   Use AskUserQuestion:
   - header: "Feature Review"
   - question: "Kloppen deze features? Je kunt toevoegen, verwijderen of aanpassen."
   - options:
     - label: "Ja, dit klopt (Recommended)", description: "Features zijn correct, ga door naar dependencies"
     - label: "Features aanpassen", description: "Toevoegen, verwijderen, of naam/type/beschrijving wijzigen"
     - label: "Explain question", description: "Leg de opties uit"
   - multiSelect: false

   **Response handling:**
   - "Ja, dit klopt" → proceed to FASE 2
   - "Features aanpassen" → ask what to change (add/remove/edit), apply changes, show updated table, re-ask
   - "Explain question" → explain feature extraction process and options, re-ask
   - "Other" → parse user's freeform input, apply changes, show updated table, re-ask

   **Loop until user confirms features are correct.**

### FASE 2: Dependency Analysis

**Goal:** Determine implementation order based on dependencies.

1. **For each feature, ask:**
   - What other features must exist first?
   - Can this be built standalone?

2. **Build dependency graph:**

   ```
   routing (base)
   └── auth-pages
       └── user-dashboard
           ├── profile-settings
           ├── notifications
           └── api-user-data
   ```

3. **Detect circular dependencies:**
   - If found, suggest how to break the cycle
   - Ask user for resolution if unclear

**Output:**

```
DEPENDENCIES MAPPED

| Feature | Depends On | Blocks |
|---------|------------|--------|
| routing | - | auth-pages |
| auth-pages | routing | user-dashboard |
| user-dashboard | auth-pages | profile-settings, notifications |
...

Dependency tree:
routing (base)
└── auth-pages
    └── user-dashboard
        ├── profile-settings
        ├── notifications
        └── api-user-data
```

4. **Review with user:**

   Use AskUserQuestion:
   - header: "Dependency Review"
   - question: "Klopt deze volgorde? Je kunt dependencies aanpassen."
   - options:
     - label: "Ja, dit klopt (Recommended)", description: "Dependencies zijn correct, ga door naar prioriteit"
     - label: "Dependencies aanpassen", description: "Toevoegen, verwijderen of volgorde wijzigen"
     - label: "Explain question", description: "Leg de dependency-analyse uit"
   - multiSelect: false

   **Response handling:**
   - "Ja, dit klopt" → proceed to FASE 3
   - "Dependencies aanpassen" → ask what to change (add/remove/reorder), update graph, show updated table, re-ask
   - "Explain question" → explain dependency analysis and implications, re-ask
   - "Other" → parse user's freeform input, apply changes, show updated table, re-ask

   **Loop until user confirms dependencies are correct.**

### FASE 3: Priority Assignment

**Goal:** Determine MVP vs later phases.

1. **Use AskUserQuestion for MVP scope:**
   - header: "MVP Scope"
   - question: "Wat is minimaal nodig voor een werkend prototype?"
   - options: (dynamically generated from features)
     - label: "{feature-1}", description: "{description}"
     - label: "{feature-2}", description: "{description}"
     - ... (all features)
   - multiSelect: true

2. **Auto-assign remaining features using heuristics:**
   - Phase 2: Features that directly extend MVP functionality OR are prerequisites for important Phase 3 features
   - Phase 3: Nice-to-have, polish, extra content, integrations without core impact
   - When unclear: prefer Phase 2 (easier to demote than to promote later)

3. **Review with user:**

   Show proposed prioritization table, then use AskUserQuestion:
   - header: "Priority Review"
   - question: "Klopt deze fase-indeling? Je kunt features verplaatsen tussen fases."
   - options:
     - label: "Ja, dit klopt (Recommended)", description: "Fase-indeling is correct, genereer backlog"
     - label: "Features verplaatsen", description: "Een of meer features naar een andere fase"
     - label: "Explain question", description: "Leg de fase-indeling uit"
   - multiSelect: false

   **Response handling:**
   - "Ja, dit klopt" → proceed to FASE 4
   - "Features verplaatsen" → ask which features and target phase, update table, re-ask
   - "Explain question" → explain MVP/Phase 2/Phase 3 criteria, re-ask
   - "Other" → parse user's freeform input, apply changes, re-ask

   **Loop until user confirms prioritization is correct.**

**Output:**

```
PRIORITY ASSIGNED

MVP (Must Have):
- {feature}: {reason}
- {feature}: {reason}

Phase 2 (Should Have):
- {feature}: {reason}

Phase 3 (Nice to Have):
- {feature}: {reason}
```

### FASE 4: Generate Backlog

**Goal:** Write the backlog file with status tracking.

1. **Generate `.workspace/backlog.md`:**

```markdown
# Web Backlog: {Project Name}

**Generated:** {date}
**Updated:** {date}
**Source:** {/thinking-idea | /thinking-brainstorm}

## Overview

{Brief description from source}

## Status: `TODO` → `DEF` → `BLT` → `DONE`

---

## MVP Features ({done}/{total} done)

### DONE

- **{feature-name}** ({TYPE}) - {short description}

### TODO

- **{feature-name}** ({TYPE}) → {dependency}
  {description}

**Next:** `/dev-define {first-todo-feature}`

---

## Phase 2 Features ({done}/{total} done)

### TODO

- **{feature-name}** ({TYPE}) → {dependency}
  {description}

---

## Phase 3 Features ({done}/{total} done)

### TODO

- **{feature-name}** ({TYPE}) → {dependency}
  {description}

---

## Ad-hoc Features ({done}/{total} done)

Features added outside the original backlog.

### DONE

- **{feature-name}** ({TYPE}) - {date}
  {description}

---

## Feature Map
```

{dependency tree visualization}

```

---

## Notes

{Any extracted notes, open questions, or considerations}
```

2. **Save file:**
   - Create `.workspace/` if not exists
   - Write `.workspace/backlog.md`

**Output:**

```
BACKLOG CREATED

File: .workspace/backlog.md

| Phase | Features |
|-------|----------|
| MVP | {count} |
| Phase 2 | {count} |
| Phase 3 | {count} |
| Total | {count} |

Start development:
/dev-define {first-mvp-feature}
```

## Best Practices

### Feature Granularity

- Too big: Hard to estimate, long feedback loops
- Too small: Overhead, dependency hell
- Right size: 1-3 days of work, testable independently

### Dependencies

- Minimize cross-dependencies
- Prefer vertical slices over horizontal layers
- Base systems first, content last

### MVP Scope

- Functional > Feature-complete
- Core user flow first
- Polish is Phase 3

## Example

**Input:** E-commerce dashboard idea markdown

**Output:**

```
BACKLOG CREATED

File: .workspace/backlog.md

MVP Features:
1. routing (FEATURE)
2. auth-pages (FEATURE)
3. api-auth (API)
4. dashboard-layout (FEATURE)
5. product-list (FEATURE)

Phase 2:
6. api-products (API)
7. product-detail (FEATURE)
8. cart-component (FEATURE)
9. stripe-integration (INTEGRATION)

Phase 3:
10. analytics-dashboard (INTEGRATION)
11. dark-mode (UI)
12. performance-optimization (REFACTOR)

Start: /dev-define routing
```
