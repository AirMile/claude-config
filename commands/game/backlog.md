---
description: Transform idea/brainstorm output into prioritized game feature backlog
---

# Backlog

## Overview

This is the **bridge** between `/thinking:*` commands and the game pipeline.
Transforms structured idea markdown into a prioritized feature backlog ready for `/game:define`.

**Trigger**: `/game:backlog` or `/game:backlog [paste markdown]`

## Input

Accepts markdown from:
- `/thinking:idea` output
- `/thinking:brainstorm` output
- Any structured game concept markdown

## Output

`.workspace/backlog.md` with:
- Decomposed features
- Dependencies
- MVP vs Phase 2/3 priority
- Direct links to `/game:define {feature}`

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
     question: "Plak de output van /thinking:idea of /thinking:brainstorm"
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

→ Analyzing for features...
```

### FASE 1: Feature Extraction

**Goal:** Identify distinct game features from the concept.

1. **Use sequential thinking to analyze:**
   - What are the core mechanics?
   - What systems need to be built?
   - What can be split into independent features?

2. **Extract features:**
   - Each feature = one `/game:define` unit
   - Feature should be implementable independently (with dependencies)
   - Name in kebab-case for CLI use

3. **Categorize by type:**
   | Type | Description |
   |------|-------------|
   | CORE | Foundation systems (player, arena, input) |
   | MECHANIC | Gameplay mechanics (combat, abilities) |
   | CONTENT | Game content (specific abilities, elements) |
   | POLISH | Juice, effects, feel |
   | UI | User interface elements |

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
     - label: "Feature toevoegen", description: "Ik mis een feature"
     - label: "Feature verwijderen", description: "Een feature hoort hier niet"
     - label: "Feature aanpassen", description: "Naam, type of beschrijving wijzigen"
     - label: "Meerdere wijzigingen", description: "Ik wil meerdere dingen aanpassen"
   - multiSelect: false

   **Response handling:**
   - "Ja, dit klopt" → proceed to FASE 2
   - "Feature toevoegen" → ask for details, add to list, show updated table, re-ask
   - "Feature verwijderen" → ask which one (by number), remove, show updated table, re-ask
   - "Feature aanpassen" → ask which one and what to change, update, show updated table, re-ask
   - "Meerdere wijzigingen" → let user describe all changes, apply, show updated table, re-ask

   **Loop until user confirms features are correct.**

### FASE 2: Dependency Analysis

**Goal:** Determine implementation order based on dependencies.

1. **For each feature, ask:**
   - What other features must exist first?
   - Can this be built standalone?

2. **Build dependency graph:**
   ```
   player-movement (base)
   └── basic-combat
       └── ability-system
           ├── element-water
           ├── element-fire
           └── ability-draft
   ```

3. **Detect circular dependencies:**
   - If found, suggest how to break the cycle
   - Ask user for resolution if unclear

**Output:**
```
DEPENDENCIES MAPPED

| Feature | Depends On | Blocks |
|---------|------------|--------|
| player-movement | - | basic-combat |
| basic-combat | player-movement | ability-system |
| ability-system | basic-combat | element-*, ability-draft |
...

Dependency tree:
player-movement (base)
└── basic-combat
    └── ability-system
        ├── element-water
        ├── element-fire
        └── ability-draft
```

4. **Review with user:**

   Use AskUserQuestion:
   - header: "Dependency Review"
   - question: "Klopt deze volgorde? Je kunt dependencies aanpassen."
   - options:
     - label: "Ja, dit klopt (Recommended)", description: "Dependencies zijn correct, ga door naar prioriteit"
     - label: "Dependency toevoegen", description: "Feature X moet na Y komen"
     - label: "Dependency verwijderen", description: "Feature X hoeft niet op Y te wachten"
     - label: "Volgorde aanpassen", description: "Andere implementatievolgorde gewenst"
   - multiSelect: false

   **Response handling:**
   - "Ja, dit klopt" → proceed to FASE 3
   - "Dependency toevoegen" → ask which feature depends on which, update graph, show updated table, re-ask
   - "Dependency verwijderen" → ask which dependency to remove, update graph, show updated table, re-ask
   - "Volgorde aanpassen" → let user describe desired order, recalculate dependencies, show updated table, re-ask

   **Loop until user confirms dependencies are correct.**

### FASE 3: Priority Assignment

**Goal:** Determine MVP vs later phases.

1. **Use AskUserQuestion for MVP scope:**
   - header: "MVP Scope"
   - question: "Wat is minimaal nodig voor een speelbaar prototype?"
   - options: (dynamically generated from features)
     - label: "{feature-1}", description: "{description}"
     - label: "{feature-2}", description: "{description}"
     - ... (all features)
   - multiSelect: true

2. **Auto-assign remaining features:**
   - Phase 2: Direct dependencies of MVP features
   - Phase 3: Nice-to-have, polish, extra content

3. **Validate with user:**
   Show proposed prioritization, allow adjustments.

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
# Game Backlog: {Project Name}

**Generated:** {date}
**Updated:** {date}
**Source:** {/thinking:idea | /thinking:brainstorm}

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

**Next:** `/game:define {first-todo-feature}`

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
/game:define {first-mvp-feature}
```

**Send notification:**
```bash
powershell -ExecutionPolicy Bypass -File .claude/scripts/notify.ps1 -Title "Claude Code" -Message "Backlog ready: {count} features"
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
- Playable > Feature-complete
- Core loop first
- Polish is Phase 3

## Example

**Input:** Elemental Clash idea markdown

**Output:**
```
BACKLOG CREATED

File: .workspace/backlog.md

MVP Features:
1. player-movement (CORE)
2. basic-combat (MECHANIC)
3. health-system (MECHANIC)
4. ability-system (MECHANIC)
5. element-water (CONTENT)

Phase 2:
6. element-fire (CONTENT)
7. element-earth (CONTENT)
8. element-air (CONTENT)
9. ability-draft (MECHANIC)

Phase 3:
10. round-system (MECHANIC)
11. ui-hud (UI)
12. screen-shake (POLISH)

Start: /game:define player-movement
```
