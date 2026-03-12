---
name: game-plan
description: Transform idea or brainstorm output into a prioritized game feature backlog. Use with /game-plan after /thinking-idea or /thinking-brainstorm for game project planning.
disable-model-invocation: true
metadata:
  author: mileszeilstra
  version: 1.1.0
  category: game
---

# Plan

## Overview

This is the **bridge** between `/thinking:*` commands and the game pipeline.
Transforms structured idea markdown into a prioritized feature backlog ready for `/game-define`.

**Trigger**: `/game-plan` or `/game-plan [paste markdown]`

## Input

Accepts markdown from:

- `/thinking-idea` output
- `/thinking-brainstorm` output
- Any structured game concept markdown

## Output

`.project/backlog.html` with:

- Decomposed features
- Dependencies
- P1/P2/P3/P4 priority
- Direct links to `/game-define {feature}`

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
   - Check `concept.thinking` entries with date AFTER `backlog.updated` to understand concept evolution
   - Check `thinking[]` array in `project.json` for entries with `newFeature` field to identify independently-added features (via `/dev-feature`)
   - Compare current `concept.content` against existing backlog features (semantic match by name/description)
   - Show comparison:

     ```
     EXISTING BACKLOG DETECTED

     Concept: .project/project.json (concept.content)
     Backlog: .project/backlog.html

     Concept evolution since last backlog update ({backlog.updated}):
     {for each concept.thinking entry after backlog.updated:}
     - [{type}] {date}: {summary} (via {source})

     Feature changes detected:
     - NEW: {list of features in concept but not in backlog}
     - MODIFIED: {list of features in both but with changed description/scope}
     - INDEPENDENT: {list of features in backlog added via /dev-feature, not from concept}
     - REMOVED: {list of features in backlog, not in concept, AND not independently added}
     - UNCHANGED: {count} features

     Protected features (not affected by update):
     - DOING: {list with current stage}
     - DONE: {list}
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
     - **Merge rules by feature status:**
       - **DOING/DONE features** (protected): preserve status, stage, priority, assignee, date, and notes. Only enrich description if concept provides new insights — never overwrite.
       - **TODO features (modified)**: update description/scope from concept, preserve priority and notes
       - **New features**: add as TODO with auto-assigned priority (user reviews in FASE 3)
       - **Removed TODO features**: mark as deprecated (don't delete)
       - **Removed DOING/DONE features**: show warning and ask user whether to keep or deprecate — these represent in-progress work that may still be relevant
       - **INDEPENDENT features** (added via `/dev-feature`): always preserve unchanged — these are not derived from concept. Keep status, stage, priority, assignee, date, and description intact. Never deprecate or remove.
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

If ambiguities are identified, use AskUserQuestion to clarify before starting research.

**Step 3: Research (Explore agent)**

Spawn one Explore agent (`subagent_type: Explore`, thoroughness: "very thorough") to do all research in an isolated context. This keeps Context7 results, web search output, and source file reads out of the main session.

Agent prompt — include only research categories identified as needed in Step 1:

```
Research the following for a Godot 4.x game feature plan.

{If codebase research needed:}
CODEBASE ANALYSIS:
- Find similar features, existing patterns, scene tree conventions
- Check existing implementations that can be reused
- Note file structure and autoload conventions

{If Context7 research needed:}
GODOT RESEARCH:
- resolve-library-id + query-docs for: Godot 4.x, GUT
- Focus: scene composition, node types, GDScript patterns, signal usage, testing setup

{If web research needed:}
WEB RESEARCH (use WebSearch):
- "Godot 4.x {mechanic} implementation patterns"
- "Godot {feature-type} common pitfalls"

RETURN FORMAT:
RESEARCH_START
Codebase: {3-5 bullet points: existing patterns, reusable scenes/scripts, conventions}
Godot: {3-5 bullet points: scene architecture, GDScript patterns, pitfalls}
Web: {3-5 bullet points: real-world patterns, warnings, recommendations}
RESEARCH_END
```

**Step 4: Research Summary**

Parse the agent's `RESEARCH_START...END` block. Display:

```
RESEARCH COMPLETE

| Category | Key Findings |
|----------|--------------|
| Codebase | {summary of existing patterns/features} |
| Context7 | {summary of Godot guidance} |
| Web      | {summary of patterns/pitfalls} |

→ Research results will inform feature extraction...
```

Only the compact summary enters the main context for FASE 1.

Research results remain in conversation context for FASE 1. No files are written.

### FASE 1: Feature Extraction

**Goal:** Identify distinct game features from the concept.

1. **Analyze:**
   - What are the core mechanics?
   - What systems need to be built?
   - What can be split into independent features?

   **If research was performed (FASE 0.5), also consider:**
   - What already exists in the codebase that can be reused or extended?
   - What framework patterns or conventions should guide the decomposition?
   - What pitfalls or anti-patterns were identified to avoid?

   **Granularity decision:** When a feature could be defined as one large item OR multiple smaller items, apply the right-size rule: each feature should represent **1-3 days of work** and be **testable independently**. If in doubt, prefer smaller features — they're easier to combine than to split later.

   **If in update mode (from FASE 0 Scenario A):**
   - Start from existing backlog features as baseline — do NOT extract from scratch
   - Apply concept changes on top: add NEW features, update MODIFIED descriptions, mark REMOVED as deprecated
   - INDEPENDENT features (added via `/dev-feature`): always preserve unchanged — they are not concept-derived
   - DOING/DONE features are protected: keep as-is, only enrich description if concept adds new insights
   - Present the merged feature list with change markers for clarity

2. **Extract features:**
   - Each feature = one `/game-define` unit
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

| # | Feature | Type | Description | Change |
|---|---------|------|-------------|--------|
| 1 | {name} | {type} | {one-line description} | {NEW/MODIFIED/PROTECTED/INDEPENDENT/DEPRECATED/ —} |
| 2 | {name} | {type} | {one-line description} | {marker or — if unchanged} |
...

In update mode, the Change column shows what happened to each feature.
In create mode, the Change column is omitted.
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

5. **Core loop validatie (alleen in create mode of bij gewijzigde P1 features):**

   Controleer of de P1 features samen een speelbare gameplay loop vormen:

   ```
   LOOP VALIDATIE

   Moment-to-moment (0-30s):
   - Actie: {wat doet de speler} → Reactie: {wat doet het systeem} → Feedback: {wat ziet/hoort de speler}

   Session loop (5-30min):
   - Doel: {wat probeert de speler te bereiken}
   - Poging: {hoe probeert de speler dat}
   - Uitkomst: {win/verlies/progressie}

   P1 loop compleet? {JA / NEE — {ontbrekend element}}
   ```

   - Als de loop NIET compleet is: toon welk element mist en stel voor om een feature toe te voegen of te promoten naar P1
   - Als de loop WEL compleet is: toon bevestiging en ga door

   **Voorbeeld van een incompleet P1:**
   - Features: `player-movement`, `health-system`, `basic-combat` → Actie en reactie aanwezig, maar geen win/verlies conditie → suggest: `round-system` naar P1

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

**Goal:** Prioriteiten toekennen (P1–P4).

1. **Use AskUserQuestion for P1 scope:**
   - header: "P1"
   - question: "Wat is minimaal nodig voor een speelbaar prototype?"
   - options: (dynamically generated from features)
     - label: "{feature-1}", description: "{description}"
     - label: "{feature-2}", description: "{description}"
     - ... (all features)
   - multiSelect: true

2. **Auto-assign remaining features using heuristics:**
   - P2: Features that directly extend P1 functionality OR are prerequisites for important P3 features
   - P3: Nice-to-have, polish, extra content, integrations without core impact
   - P4: Stretch goals, experimental features, future considerations
   - When unclear: prefer P2 (easier to demote than to promote later)

3. **Validate with user:**
   Show proposed prioritization.

   Use AskUserQuestion:
   - header: "Priority Review"
   - question: "Klopt deze prioritering?"
   - options:
     - label: "Ja, dit klopt (Recommended)", description: "Prioriteiten zijn correct"
     - label: "Features verplaatsen", description: "Ik wil features tussen P1/P2/P3/P4 verplaatsen"
     - label: "Aanpassen", description: "Andere wijzigingen aan prioriteiten"
   - multiSelect: false

   **Response handling:**
   - "Ja, dit klopt" → proceed to FASE 4
   - "Features verplaatsen" → ask which features to move between P1/P2/P3/P4, update, re-ask
   - "Aanpassen" → let user describe changes, apply, show updated prioritization, re-ask

   **Loop until user confirms priorities are correct.**

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
     "source": "/game-plan",
     "overview": "{Brief description from source}",
     "features": [
       {
         "name": "{feature-name}",
         "type": "CORE|MECHANIC|CONTENT|POLISH|UI",
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
   3. Write `.project/project.json`

**Output:**

```
BACKLOG CREATED

File: .project/backlog.html
Dashboard: .project/project.json (concept)
Server: http://localhost:9876/{project-dir}

| Priority | Features |
|----------|----------|
| P1 | {count} |
| P2       | {count} |
| P3       | {count} |
| P4       | {count} |
| Total    | {count} |

Start development:
/game-define {first-P1-feature}
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

- Playable > Feature-complete
- Core loop first
- Polish is P3

## Example

**Input:** Elemental Clash idea markdown

**Output:**

```
BACKLOG CREATED

File: .project/backlog.html

P1:
1. player-movement (CORE)
2. basic-combat (MECHANIC)
3. health-system (MECHANIC)
4. ability-system (MECHANIC)
5. element-water (CONTENT)

P2:
6. element-fire (CONTENT)
7. element-earth (CONTENT)
8. element-air (CONTENT)
9. ability-draft (MECHANIC)

P3:
10. round-system (MECHANIC)
11. ui-hud (UI)
12. screen-shake (POLISH)

Start: /game-define player-movement
```
