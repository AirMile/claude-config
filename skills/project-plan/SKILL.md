---
name: project-plan
description: Transform idea or brainstorm output into a prioritized feature backlog. Auto-detects stack (web/game) from project.json. Use with /project-plan after /thinking-concept or /thinking-brainstorm to create implementation roadmaps.
metadata:
  author: mileszeilstra
  version: 1.0.0
  category: project
---

# Project Plan

## Overview

This is the **bridge** between `/thinking:*` commands and the dev or game pipeline.
Transforms structured idea markdown into a prioritized feature backlog ready for `/dev-define` (web) or `/game-define` (game).

**Trigger**: `/project-plan` or `/project-plan [paste markdown]`

## Input

Accepts markdown from:

- `/thinking-concept` output
- `/thinking-brainstorm` output
- Any structured concept markdown (web or game)

## Output

`.project/backlog.html` with:

- Decomposed features
- Dependencies
- P1/P2/P3/P4 priority
- Direct links to `/dev-define {feature}` (web) or `/game-define {feature}` (game)

## Workflow

### Stack Detection (pre-FASE 0)

**Goal:** Detect of het een web- of game-project is zodat de juiste feature-types en terminologie gebruikt worden.

**Process:**

1. Probeer `.project/project.json` te lezen
2. Check velden in volgorde:
   - `stack.engine === "godot"` → **GAME MODE**
   - `concept.platform === "game"` → **GAME MODE**
   - Geen match of geen project.json → **WEB MODE**
3. Toon gedetecteerde mode:

   ```
   STACK DETECTED: web    (→ /dev-define pipeline)
   STACK DETECTED: game   (→ /game-define pipeline)
   ```

### FASE 0: Input Detection

**Goal:** Auto-detect concept and existing backlog, determine action.

**Process:**

1. **Check if .project folder exists:**
   - If `.project/` folder does NOT exist → go directly to Scenario D (ask for input)
   - If `.project/` folder exists → continue to step 2

2. **Check for existing files (only if .project exists):**
   - Check if `.project/project-concept.md` exists (primary concept source)
   - Fallback: check if `.project/project.json` exists and `concept.content` is non-empty (legacy)
   - Check if `.project/backlog.html` exists

3. **Scenario A: Both concept AND backlog exist**
   - Read concept: `.project/project-concept.md` als plain markdown, of fallback `project.json` (`concept.content`)
   - Read `backlog.html`
   - Analyze differences between concept and existing backlog
   - Check `data.features[]` in `backlog.html` for entries with `source: "project-todo"` or `source: "dev-todo"` or `source: "/core-setup"` or `source: "/dev-define"` or `source: "/dev-build"` or `source: "/dev-verify"` or `source: "/game-define"` or `source: "/game-build"` to identify independently-added features
   - Compare current `concept.content` against existing backlog features (semantic match by name/description)
   - Show comparison:

     ```
     EXISTING BACKLOG DETECTED

     Concept: .project/project-concept.md (of fallback: project.json concept.content)
     Backlog: .project/backlog.html

     Feature changes detected:
     - NEW: {list of features in concept but not in backlog}
     - MODIFIED: {list of features in both but with changed description/scope}
     - INDEPENDENT: {list of features in backlog added independently — not from concept}
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
       - label: "Update backlog (Recommended)", description: "Voeg nieuwe features toe, behoud DOING/DONE features en handmatige wijzigingen"
       - label: "Nieuwe backlog", description: "Begin opnieuw, negeer oude backlog"
       - label: "Annuleren", description: "Bekijk eerst de verschillen, doe niets"
     multiSelect: false
     ```
   - **If "Update backlog":**
     - **Merge rules by feature status:**
       - **DOING/DONE features** (protected): preserve status, stage, priority, date, and notes. Only enrich description if concept provides new insights — never overwrite.
       - **TODO features (modified)**: update description/scope from concept, preserve priority and notes
       - **New features**: add as TODO with auto-assigned priority (user reviews in FASE 3)
       - **Removed TODO features**: mark as deprecated (don't delete)
       - **Removed DOING/DONE features**: show warning and ask user whether to keep or deprecate — these represent in-progress work that may still be relevant
       - **INDEPENDENT features**: always preserve unchanged — these are not derived from concept. Keep status, stage, priority, date, and description intact. Never deprecate or remove.
     - Continue to FASE 1 with update mode
   - **If "Nieuwe backlog":**
     - Use concept as input, ignore existing backlog
     - Continue to FASE 1 with create mode
   - **If "Annuleren":**
     - Show detailed diff and exit

4. **Scenario B: Only concept exists (no backlog)**
   - Read concept: `.project/project-concept.md` als plain markdown, of fallback `project.json` (`concept.content`)
   - Show confirmation:

     ```
     CONCEPT DETECTED

     File: .project/project-concept.md (of project.json)
     Title: {extracted title}

     Dit concept wordt gebruikt voor de backlog.
     ```

   - Use AskUserQuestion:
     ```yaml
     header: "Concept Laden"
     question: "Wil je een backlog genereren van dit concept?"
     options:
       - label: "Ja, genereer backlog (Recommended)", description: "Gebruik project concept"
       - label: "Ander concept", description: "Ik wil een ander concept gebruiken"
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
     multiSelect: false
     ```

6. **Scenario D: No .project folder OR neither file exists**
   - Ask user to paste concept:
     ```yaml
     header: "Input"
     question: "Plak de output van /thinking-concept of /thinking-brainstorm"
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
    description: "Analyseer codebase, framework docs (Context7), en web examples voor betere feature extractie"
multiSelect: false
```

**Response handling:**

- "Nee" → skip to FASE 1
- "Ja" → proceed to FASE 0.5

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

**[WEB MODE]** Agent prompt:

```
Research the following for a web project feature plan.

{If codebase research needed:}
CODEBASE ANALYSIS:
- Find similar features, existing patterns, architecture conventions
- Check existing implementations that can be reused
- Note file structure conventions

{If Context7 research needed:}
FRAMEWORK RESEARCH:
- resolve-library-id + query-docs for: {frameworks/libraries}
- Focus: architecture patterns, best practices, common pitfalls, testing setup

{If web research needed:}
WEB RESEARCH (use WebSearch):
- "{framework} {feature-type} best practices"
- "{framework} {feature-type} common pitfalls"
- "{feature-type} production examples"

RETURN FORMAT:
RESEARCH_START
Codebase: {3-5 bullet points: existing patterns, reusable code, conventions}
Framework: {3-5 bullet points: architecture patterns, best practices, pitfalls}
Web: {3-5 bullet points: real-world patterns, warnings, recommendations}
RESEARCH_END
```

**[GAME MODE]** Agent prompt:

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
| Context7 | {summary of framework guidance} |
| Web      | {summary of patterns/pitfalls} |

→ Research results will inform feature extraction...
```

Only the compact summary enters the main context for FASE 1.

### FASE 1: Feature Extraction

**Goal:** Identify distinct features from the concept.

**Learnings load** (vóór analyse) via [shared/LEARNINGS-LOAD.md](../shared/LEARNINGS-LOAD.md):

```
scopes: [architectural]
pitfall-prefix: true
current-feature: none
```

Toon de geladen output. Architectural patterns sturen de feature decomposition. Pitfall-prefix voorkomt herhaling van structurele bugs in nieuwe features.

**[WEB MODE]**

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

   **If in update mode (from FASE 0 Scenario A):**
   - Start from existing backlog features as baseline — do NOT extract from scratch
   - Apply concept changes on top: add NEW features, update MODIFIED descriptions, mark REMOVED as deprecated
   - INDEPENDENT features: always preserve unchanged — they are not concept-derived
   - DOING/DONE features are protected: keep as-is, only enrich description if concept adds new insights
   - CANCELLED features zijn protected: behoud als `status: "CANCELLED"`, sluit uit van planning en build-order — behandel als niet-beschikbaar
   - Present the merged feature list with change markers for clarity

2. **Extract features:**
   - Each feature = one `/dev-define` unit
   - Feature should be implementable independently (with dependencies)
   - Name in kebab-case for CLI use

3. **Categorize by type:**
   | Type | Description |
   |------|-------------|
   | FEATURE | Core functionality (auth, data processing, core behavior) |
   | API | Backend endpoints, data fetching, services |
   | INTEGRATION | Third-party services (analytics, payments, auth providers) |
   | UI | Styling, UX improvements, visual components |
   | REFACTOR | Code quality, performance, architecture improvements |
   | PAGE | Frontend page/route (doorloopt design → convert → check pipeline) |
   | COMPONENT | Herbruikbaar UI-component (doorloopt zelfde pipeline als PAGE) |
   | PAGE-GAP | Ontbrekende functionaliteit gevonden door /frontend-design |

4. **Score risk:**

   Ken elke feature een risk-score toe:

   | Score | Risk (hoe complex?)                                            |
   | ----- | -------------------------------------------------------------- |
   | 1     | Triviale wijziging, geen onbekenden                            |
   | 2     | Bekende techniek, weinig afhankelijkheden                      |
   | 3     | Gemiddelde complexiteit, enkele onbekenden                     |
   | 4     | Complexe integratie of nieuwe technologie                      |
   | 5     | Hoge complexiteit, veel onbekenden of externe afhankelijkheden |

   **Per feature, noteer kort:**
   - Risk score (1-5) + reden (max 1 zin)

   **Heuristieken:**
   - Features met externe API/service dependency → hogere risk
   - Features die al deels bestaan in codebase (update mode) → lagere risk

   **Extraction quality self-check** (voer uit voor de review, NIET aan user tonen):
   - Elke feature is 1-3 dagen werk (te groot → splits, te klein → combineer)
   - Geen overlappende scope tussen features
   - Dependencies zijn expliciet (feature X heeft feature Y nodig → noteer voor FASE 2)
   - Risk scores zijn onderbouwd (score zonder reden → voeg reden toe)
   - Research findings verwerkt (als FASE 0.5 gedaan: bevindingen in feature beschrijvingen)

   Pas de feature lijst aan op basis van gevonden gaps.

**[WEB MODE] Output:**

```
FEATURES EXTRACTED

Found {count} features:

| # | Feature | Type | Risk | Description | Change |
|---|---------|------|------|-------------|--------|
| 1 | {name} | {type} | {1-5} | {one-line description} | {NEW/MODIFIED/PROTECTED/INDEPENDENT/DEPRECATED/ —} |
| 2 | {name} | {type} | {1-5} | {one-line description} | {marker or — if unchanged} |
...

In update mode, the Change column shows what happened to each feature.
In create mode, the Change column is omitted.
```

5. **[WEB MODE] Reuse-Discovery (optioneel — alleen bij ≥2 PAGE/FEATURE features met gedeelde UI-patterns):**

   **Wanneer overslaan:** geen frontend-project, minder dan 2 PAGE/FEATURE features, of alle UI patterns zijn al in `design.components[]`.

   Volg [Discovery — Reuse-Discovery](../shared/SKILL-PATTERNS.md#reuse-discovery) voor het canonieke protocol.

   **Trigger:** cross-page UI-patroon-matching — groepeer features op beschrijvingen (Lijst/tabel, Card, Form, Modal/dialog, Navigation). Threshold: 2+ PAGE/FEATURE features delen het pattern. Voeg toe aan de feature-lijst (wordt meegenomen naar FASE 4 backlog generatie); append kebab-naam ook aan `dependencies[]` van elke PAGE/FEATURE die het pattern triggerde.

   **Source:** `"/project-plan"` · **Direction:** `"dev→frontend"` · **Type:** `COMPONENT`

   "Overslaan" → geen COMPONENT-features aan lijst toevoegen.

6. **[WEB MODE] Design & Quality signals (optioneel — alleen bij expliciete mentions in concept):**

   Scan concept tekst op de volgende keywords. Voeg alleen toe als het concept het **expliciet** noemt — niet bij impliciete speculatie.

   | Keyword triggers                                                     | Type  | Naam            | Phase |
   | -------------------------------------------------------------------- | ----- | --------------- | ----- |
   | "design tokens", "kleuren", "typografie", "theme", "branding"        | THEME | `theme-init`    | P3    |
   | "a11y", "accessibility", "WCAG", "screen reader", "toegankelijkheid" | A11Y  | `a11y-baseline` | P3    |
   | "performance", "lighthouse", "core web vitals", "SEO", "snelheid"    | PERF  | `perf-baseline` | P3    |

   Elk gevonden item: voeg toe aan de feature-lijst als:

   ```json
   {
     "name": "{naam uit tabel}",
     "type": "THEME|A11Y|PERF",
     "status": "TODO",
     "phase": "P3",
     "description": "{relevante quote of parafrase uit concept}",
     "source": "/project-plan"
   }
   ```

   "Geen matches" → geen Design & Quality items toevoegen.

---

**[GAME MODE]**

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
   - INDEPENDENT features: always preserve unchanged — they are not concept-derived
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

**[GAME MODE] Output:**

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

4. **[GAME MODE] Feature Review (alle modes):**

   <!-- modal-buffer -->

   Print 8 blank lines as whitespace buffer (keeps the feature table above visible when the modal panel opens).

   Use AskUserQuestion:
   - header: "Feature Review"
   - question: "Kloppen deze features? Je kunt toevoegen, verwijderen of aanpassen."
   - options:
     - label: "Ja, dit klopt (Recommended)", description: "Features zijn correct, ga door naar dependencies"
     - label: "Features aanpassen", description: "Toevoegen, verwijderen, of naam/type/beschrijving wijzigen"
   - multiSelect: false

   **Response handling:**
   - "Ja, dit klopt" → proceed to FASE 2 (game) or Reuse-Discovery if applicable (web)
   - "Features aanpassen" → ask what to change, apply changes, show updated table, re-ask
   - "Other" → parse user's freeform input, apply changes, show updated table, re-ask

   **Loop until user confirms features are correct.**

5. **[GAME MODE] Core loop validatie (alleen in create mode of bij gewijzigde P1 features):**

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

**[WEB MODE] Feature Review:**

   <!-- modal-buffer -->

Print 8 blank lines as whitespace buffer (keeps the feature table above visible when the modal panel opens).

Use AskUserQuestion:

- header: "Feature Review"
- question: "Kloppen deze features? Je kunt toevoegen, verwijderen of aanpassen."
- options:
  - label: "Ja, dit klopt (Recommended)", description: "Features zijn correct, ga door naar dependencies"
  - label: "Features aanpassen", description: "Toevoegen, verwijderen, of naam/type/beschrijving wijzigen"
- multiSelect: false

**Response handling:**

- "Ja, dit klopt" → proceed to FASE 2
- "Features aanpassen" → ask what to change (add/remove/edit name/type/description/risk), apply changes, show updated table, re-ask
- "Other" → parse user's freeform input, apply changes, show updated table, re-ask

**Loop until user confirms features are correct.**

### FASE 2: Dependency Analysis

**Goal:** Determine implementation order based on dependencies.

1. **For each feature, ask:**
   - What other features must exist first?
   - Can this be built standalone?

2. **Build dependency graph** — genereer een ASCII decomposition tree met feature → epics → stories structuur en dependency edges:

   **[WEB MODE] voorbeeld:**

   ```
   routing (base)
   └── auth-pages
       └── user-dashboard
           ├── profile-settings
           ├── notifications
           └── api-user-data
   ```

   **[GAME MODE] voorbeeld:**

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

4. **[WEB MODE] Detect broken dependencies (CANCELLED):**
   - Als een feature afhankelijk is van een feature met `status: "CANCELLED"`, markeer als gebroken:
     ```
     ⚠ GEBROKEN DEPENDENCY: {feature-A} → {feature-B} (CANCELLED)
     Opties: (1) verwijder deze dependency, (2) herstel {feature-B} via backlog UI
     ```
   - Presenteer gebroken dependencies vóór de dependency-tabel
   - Vraag gebruiker om resolutie voordat je verder gaat met FASE 3

**Output:**

```
DEPENDENCIES MAPPED

| Feature | Depends On | Blocks |
|---------|------------|--------|
| {feature-1} | - | {feature-2} |
| {feature-2} | {feature-1} | {feature-3} |
...

Dependency tree:
{ascii tree}
```

5. **Review with user:**

   <!-- modal-buffer -->

   Print 8 blank lines as whitespace buffer (keeps the dependency tree above visible when the modal panel opens).

   Use AskUserQuestion:
   - header: "Dependency Review"
   - question: "Klopt deze volgorde? Je kunt dependencies aanpassen."
   - options:
     - label: "Ja, dit klopt (Recommended)", description: "Dependencies zijn correct, ga door naar prioriteit"
     - label: "Dependencies aanpassen", description: "Toevoegen, verwijderen of volgorde wijzigen"
   - multiSelect: false

   **Response handling:**
   - "Ja, dit klopt" → proceed to FASE 3
   - "Dependencies aanpassen" → ask what to change (add/remove/reorder), update graph, show updated table, re-ask
   - "Other" → parse user's freeform input, apply changes, show updated table, re-ask

   **Loop until user confirms dependencies are correct.**

### FASE 3: Priority Assignment

**Goal:** Prioriteiten toekennen (P1–P4).

1. **Show feature list as numbered plain text:**

   ```
   Features ({N} totaal):

   1. {feature-1}: {description}
   2. {feature-2}: {description}
   ...
   ```

   **[WEB MODE]** Vraag: "Welke features zijn P1 (minimaal nodig voor een werkend prototype)? Geef nummers (bv. `1, 3, 5` of `1-4` of `alles behalve 2, 7`)."
   **[GAME MODE]** Vraag: "Welke features zijn P1 (minimaal nodig voor een speelbaar prototype)? Geef nummers (bv. `1, 3, 5` of `1-4` of `alles behalve 2, 7`)."

   Parse free-form input → P1-set. Gebruiker kan ook "alles" of "geen" zeggen.

2. **Auto-assign remaining features using heuristics:**
   - P2: Features that directly extend P1 functionality OR are prerequisites for important P3 features
   - P3: Nice-to-have, polish, extra content, integrations without core impact
   - P4: Stretch goals, experimental features, future considerations
   - When unclear: prefer P2 (easier to demote than to promote later)

3. **Review with user:**

   Show proposed prioritization table, then:

   <!-- modal-buffer -->

   Print 8 blank lines as whitespace buffer (keeps the priority table above visible when the modal panel opens).

   Use AskUserQuestion:
   - header: "Priority Review"
   - question: "Klopt deze prioritering? P1 = must-have, P2 = extends P1, P3 = nice-to-have, P4 = later. Je kunt features verplaatsen."
   - options:
     - label: "Ja, dit klopt (Recommended)", description: "Prioriteiten zijn correct, genereer backlog"
     - label: "Features verplaatsen", description: "Een of meer features naar een andere prioriteit"
     - label: "Aanpassen", description: "Andere wijzigingen aan prioriteiten"
   - multiSelect: false

   **Response handling:**
   - "Ja, dit klopt" → proceed to FASE 4
   - "Features verplaatsen" → ask which features and target priority, update table, re-ask
   - "Aanpassen" → let user describe changes, apply, show updated prioritization, re-ask
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

1. **Template or merge:**
   - **Create mode**: Kopieer template van `{skills_path}/shared/references/backlog-template.html` → `.project/backlog.html`. Maak `.project/` aan als die niet bestaat.
   - **Update mode**: Lees bestaande `.project/backlog.html`, parse het huidige JSON-blok. Kopieer NIET opnieuw het template — update in-place.

2. **Bouw het JSON data-object:**

   **[WEB MODE]:**

   ```json
   {
     "project": "{Project Name}",
     "generated": "{YYYY-MM-DD}",
     "updated": "{YYYY-MM-DD}",
     "source": "/project-plan",
     "overview": "{Brief description from source}",
     "features": [
       {
         "name": "{feature-name}",
         "type": "FEATURE|API|INTEGRATION|UI|REFACTOR|PAGE|COMPONENT|PAGE-GAP",
         "status": "TODO",
         "phase": "P1|P2|P3|P4",
         "description": "{description}",
         "dependencies": ["{other-feature}"],
         "risk": "{1-5 uit FASE 1 risk-score}"
       }
     ],
     "notes": "{Any notes or considerations}"
   }
   ```

   **[GAME MODE]:**

   ```json
   {
     "project": "{Project Name}",
     "generated": "{YYYY-MM-DD}",
     "updated": "{YYYY-MM-DD}",
     "source": "/project-plan",
     "overview": "{Brief description from source}",
     "features": [
       {
         "name": "{feature-name}",
         "type": "CORE|MECHANIC|CONTENT|POLISH|UI",
         "status": "TODO",
         "phase": "P1|P2|P3|P4",
         "description": "{description}",
         "dependencies": ["{other-feature}"]
       }
     ],
     "notes": "{Any notes or considerations}"
   }
   ```

   **[WEB MODE] Sort `features[]` to match the FASE 2 suggested order:**
   1. **Group by `phase`** in order: P1 → P2 → P3 → P4
   2. **Within each phase, apply topological sort** based on `dependencies[]`:
      - Features met `dependencies: []` eerst (binnen die fase)
      - Vervolgens features waarvan alle dependencies eerder in de array staan
      - Cross-phase dependencies (bv. P2-feature die afhangt van P1-feature) worden automatisch correct: P1 staat al vóór P2
   3. **Tie-breaker** binnen dezelfde topologische "laag": behoud de volgorde uit FASE 1 (extractie-volgorde)

   **[WEB MODE] In update mode, apply merge rules:**
   - For each existing backlog feature: preserve `status`, `stage`, `phase`, `date` from the current backlog
   - For MODIFIED features (TODO status): update `description` and `type` from new extraction
   - For MODIFIED features (DOING/DONE status): only enrich `description` if concept adds new insights — never overwrite
   - For NEW features: add with `status: "TODO"`, `stage: null`
   - For DEPRECATED features: keep in the array but set `status: "DEPRECATED"`
   - Set `updated` to current date, keep original `generated` date
   - INDEPENDENT features (added outside project-plan): always preserve intact

3. **Vervang het JSON-blok** in het template:
   - Zoek: `<script id="backlog-data" type="application/json">...</script>`
   - Vervang de inhoud tussen de tags met het gebouwde JSON object

4. **Start backlog server** (als niet al draaiend):

   ```bash
   # Respecteert $CLAUDE_PROJECTS_ROOT via lib/config.js (fallback: ~/projects)
   curl -s http://localhost:9876/ > /dev/null 2>&1 || nohup node ~/.claude/skills/shared/references/serve-backlog.js > /tmp/backlog-server.log 2>&1 &
   ```

5. **Update project dashboard** (zie `shared/DASHBOARD.md`):

   Als concept info beschikbaar uit input:
   1. Read `.project/project.json` (of maak nieuw met leeg schema)
   2. Vul `concept` sectie met name, description, goals, audience, scope — **OVERWRITE**
   3. **[WEB MODE]** Vul ook `stack` sectie met gedetecteerde framework, taal, DB, etc. — alleen als velden leeg zijn
   4. Write `.project/project.json`

**Output:**

**[WEB MODE]:**

```
BACKLOG CREATED

File: .project/backlog.html
Dashboard: .project/project.json (concept + stack)
Server: http://localhost:9876/{project-dir}

| Priority | Features |
|----------|----------|
| P1       | {count}  |
| P2       | {count}  |
| P3       | {count}  |
| P4       | {count}  |
| Total    | {count}  |

Start development:
/dev-define {first-P1-feature}
```

**[GAME MODE]:**

```
BACKLOG CREATED

File: .project/backlog.html
Dashboard: .project/project.json (concept)
Server: http://localhost:9876/{project-dir}

| Priority | Features |
|----------|----------|
| P1       | {count}  |
| P2       | {count}  |
| P3       | {count}  |
| P4       | {count}  |
| Total    | {count}  |

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

**[WEB MODE]:**

- Functional > Feature-complete
- Core user flow first
- Polish is P3

**[GAME MODE]:**

- Playable > Feature-complete
- Core loop first
- Polish is P3

## Example

**[WEB MODE] Input:** E-commerce dashboard idea markdown

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

**[GAME MODE] Input:** Elemental Clash idea markdown

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
