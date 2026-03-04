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

`.project/backlog.html` with:

- Decomposed features
- Dependencies
- P1/P2/P3/P4 priority
- Direct links to `/dev-define {feature}`

## Workflow

### FASE 0: Input Detection

**Goal:** Auto-detect concept and existing backlog, determine action.

**Process:**

1. **Check if .project folder exists:**
   - If `.project/` folder does NOT exist → go directly to Scenario D (ask for input)
   - If `.project/` folder exists → continue to step 2

2. **Check for existing files (only if .project exists):**
   - Check if `.project/project.json` exists and `concept.content` is non-empty
   - Check if `.project/backlog.html` exists

3. **Scenario A: Both concept AND backlog exist**
   - Read `project.json` (`concept.content`) and `backlog.html`
   - Analyze differences between concept and existing backlog
   - Show comparison:

     ```
     EXISTING BACKLOG DETECTED

     Concept: .project/project.json (concept.content)
     Backlog: .project/backlog.html

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
   - Read `project.json` (`concept.content`)
   - Show confirmation:

     ```
     CONCEPT DETECTED

     File: .project/project.json
     Title: {extracted title}

     Dit concept wordt gebruikt voor de backlog.
     ```

   - Use AskUserQuestion:
     ```yaml
     header: "Concept Laden"
     question: "Wil je een backlog genereren van dit concept?"
     options:
       - label: "Ja, genereer backlog (Recommended)", description: "Gebruik project.json concept"
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

     Backlog: .project/backlog.html
     Concept: Not found (project.json concept.content empty)

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

6. **Scenario D: No .project folder OR neither file exists**
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

Source: [project.json concept | inline | custom file]
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

Determine what research is needed based on the loaded concept:

```
Research checklist:
├─ User: Are there ambiguities that need clarification?
├─ Codebase: Is there an existing codebase with relevant code to analyze?
├─ Context7: Does the concept reference specific frameworks/libraries?
└─ Web: Is external information needed (patterns, pitfalls, examples)?
```

**Output:** List of research categories to execute.

**Step 2: User Clarification (if needed)**

If ambiguities are identified, use AskUserQuestion to clarify before spawning research agents.

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

1. **Analyze:**
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
   | PAGE-GAP | Ontbrekende functionaliteit gevonden door /frontend-page |

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

**Goal:** Prioriteiten toekennen (P1–P3).

1. **Use AskUserQuestion for P1 scope:**
   - header: "P1"
   - question: "Wat is minimaal nodig voor een werkend prototype?"
   - options: (dynamically generated from features)
     - label: "{feature-1}", description: "{description}"
     - label: "{feature-2}", description: "{description}"
     - ... (all features)
   - multiSelect: true

2. **Auto-assign remaining features using heuristics:**
   - P2: Features that directly extend P1 functionality OR are prerequisites for important P3 features
   - P3: Nice-to-have, polish, extra content, integrations without core impact
   - When unclear: prefer P2 (easier to demote than to promote later)

3. **Review with user:**

   Show proposed prioritization table, then use AskUserQuestion:
   - header: "Priority Review"
   - question: "Klopt deze prioritering? Je kunt features verplaatsen tussen P1/P2/P3/P4."
   - options:
     - label: "Ja, dit klopt (Recommended)", description: "Prioriteiten zijn correct, genereer backlog"
     - label: "Features verplaatsen", description: "Een of meer features naar een andere prioriteit"
     - label: "Explain question", description: "Leg P1/P2/P3/P4 uit"
   - multiSelect: false

   **Response handling:**
   - "Ja, dit klopt" → proceed to FASE 4
   - "Features verplaatsen" → ask which features and target priority, update table, re-ask
   - "Explain question" → explain P1 / P2 / P3 / P4 criteria, re-ask
   - "Other" → parse user's freeform input, apply changes, re-ask

   **Loop until user confirms prioritization is correct.**

**Output:**

```
PRIORITY ASSIGNED

P1:
- {feature}: {reason}
- {feature}: {reason}

P2:
- {feature}: {reason}

P3:
- {feature}: {reason}

P4:
- {feature}: {reason}
```

### FASE 4: Generate Backlog

**Goal:** Write de interactieve HTML kanban backlog.

**Refereer naar `shared/BACKLOG.md` voor het volledige data-formaat.**

1. **Kopieer template:**
   - Bron: `{skills_path}/shared/references/backlog-template.html`
   - Doel: `.project/backlog.html`
   - Maak `.project/` aan als die niet bestaat

2. **Bouw het JSON data-object:**

   ```json
   {
     "project": "{Project Name}",
     "generated": "{YYYY-MM-DD}",
     "updated": "{YYYY-MM-DD}",
     "source": "/dev-plan",
     "overview": "{Brief description from source}",
     "features": [
       {
         "name": "{feature-name}",
         "type": "FEATURE|API|INTEGRATION|UI|REFACTOR",
         "status": "TODO",
         "phase": "P1|P2|P3|P4",
         "description": "{description}",
         "dependency": "{other-feature}|null"
       }
     ],
     "notes": "{Any notes or considerations}"
   }
   ```

3. **Vervang het JSON-blok** in het gekopieerde template:
   - Zoek: `<script id="backlog-data" type="application/json">...</script>`
   - Vervang de inhoud tussen de tags met het gebouwde JSON object

4. **Start backlog server** (als niet al draaiend):

   ```bash
   curl -s http://localhost:9876/ > /dev/null 2>&1 || nohup node ~/.claude/skills/shared/references/serve-backlog.js > /tmp/backlog-server.log 2>&1 &
   ```

5. **Update project dashboard** (zie `shared/DASHBOARD.md`):

   Als concept info beschikbaar uit input:
   1. Read `.project/project.json` (of maak nieuw met leeg schema)
   2. Vul `concept` sectie met name, description, goals, audience, scope — **OVERWRITE**
   3. Vul `stack` sectie met gedetecteerde framework, taal, DB, etc. — alleen als velden leeg zijn
   4. Write `.project/project.json`

**Output:**

```
BACKLOG CREATED

File: .project/backlog.html
Dashboard: .project/project.json (concept + stack)
Server: http://localhost:9876/{project-dir}

| Priority | Features |
|----------|----------|
| P1 | {count} |
| P2       | {count} |
| P3       | {count} |
| Total    | {count} |

Start development:
/dev-define {first-P1-feature}
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

### P1 Scope

- Functional > Feature-complete
- Core user flow first
- Polish is P3

## Example

**Input:** E-commerce dashboard idea markdown

**Output:**

```
BACKLOG CREATED

File: .project/backlog.html

P1:
1. routing (FEATURE)
2. auth-pages (FEATURE)
3. api-auth (API)
4. dashboard-layout (FEATURE)
5. product-list (FEATURE)

P2:
6. api-products (API)
7. product-detail (FEATURE)
8. cart-component (FEATURE)
9. stripe-integration (INTEGRATION)

P3:
10. analytics-dashboard (INTEGRATION)
11. dark-mode (UI)
12. performance-optimization (REFACTOR)

Start: /dev-define routing
```
