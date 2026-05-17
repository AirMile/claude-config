---
name: project-backlog
description: Transform a seed into a prioritized feature backlog. Use with /project-backlog.
reads: [backlog.status]
writes: [backlog.status, concept.seed]
metadata:
  author: claude-config
  version: 1.4.0
  category: project
---

# Project Backlog

## Overview

This is the **bridge** between the seed document and the dev or game pipeline.
Transforms structured idea markdown into a prioritized feature backlog ready for `/dev-define` (web) or `/game-define` (game).

**Trigger**: `/project-backlog` or `/project-backlog [paste markdown]`

## Input

Accepts markdown from:

- `/project-seed` output
- `/project-brainstorm` output
- Any structured concept markdown (web or game)

## Output

`.project/backlog.html` with:

- Decomposed features
- Dependencies
- P1/P2/P3/P4 priority
- Direct links to `/dev-define {feature}` (web) or `/game-define {feature}` (game)

## Workflow

### Stack Detection (pre-PHASE 0)

**Goal:** Detect whether this is a web or game project so the correct feature types and terminology are used.

**Process:**

1. Try to read `.project/project.json`
2. Check fields in order:
   - `stack.engine === "godot"` → **GAME MODE**
   - `concept.platform === "game"` → **GAME MODE**
   - No match or no project.json → **WEB MODE**
3. Show detected mode:

   ```
   STACK DETECTED: web    (→ /dev-define pipeline)
   STACK DETECTED: game   (→ /game-define pipeline)
   ```

### PHASE 0: Input Detection

**Goal:** Auto-detect concept and existing backlog, determine action.

**Process:**

1. **Check if .project folder exists:**
   - If `.project/` folder does NOT exist → go directly to Scenario D (ask for input)
   - If `.project/` folder exists → continue to step 2

2. **Check for existing files (only if .project exists):**
   - Read `SEED_CONTEXT` per `shared/SEED.md` Reader. Concept present as `SEED_CONTEXT.present`.
   - Check if `.project/backlog.html` exists

3. **Scenario A: Both concept AND backlog exist**
   - Use `SEED_CONTEXT.markdown` as concept content
   - Read `backlog.html`
   - Analyze differences between concept and existing backlog
   - Check `data.features[]` in `backlog.html` to identify INDEPENDENT features: a feature is INDEPENDENT when its `source` field exists AND is not `"/project-backlog"`. Features without a `source` field (or with `"/project-backlog"`) are concept-derived and may be updated or deprecated by this run.
   - Compare `SEED_CONTEXT.markdown` against existing backlog features (semantic match by name/description)
   - Show comparison:

     ```
     EXISTING BACKLOG DETECTED

     Concept: .project/project-seed.md
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
     question: "A backlog already exists. What do you want to do?"
     options:
       - label: "Update backlog (Recommended)", description: "Add new features, keep DOING/DONE features and manual changes"
       - label: "New backlog", description: "Start fresh, ignore old backlog"
       - label: "Cancel", description: "Review differences first, do nothing"
     multiSelect: false
     ```
   - **If "Update backlog":**
     - **Merge rules by feature status:**
       - **DOING/DONE features** (protected): preserve status, stage, priority, date, and notes. Only enrich description if concept provides new insights — never overwrite.
       - **TODO features (modified)**: update description/scope from concept, preserve priority and notes
       - **New features**: add as TODO with auto-assigned priority (user reviews in PHASE 3)
       - **Removed TODO features**: mark as deprecated (don't delete)
       - **Removed DOING/DONE features**: show warning and ask user whether to keep or deprecate — these represent in-progress work that may still be relevant
       - **INDEPENDENT features**: always preserve unchanged — these are not derived from concept. Keep status, stage, priority, date, and description intact. Never deprecate or remove.
     - Continue to PHASE 1 with update mode
   - **If "New backlog":**
     - Use concept as input, ignore existing backlog
     - Continue to PHASE 1 with create mode
   - **If "Cancel":**
     - Show detailed diff and exit

4. **Scenario B: Only concept exists (no backlog)**
   - Use `SEED_CONTEXT.markdown` as concept content (already read in step 2)
   - Show confirmation:

     ```
     CONCEPT DETECTED

     File: .project/project-seed.md
     Title: {extracted title}

     This concept will be used for the backlog.
     ```

   - Use AskUserQuestion:
     ```yaml
     header: "Load Concept"
     question: "Do you want to generate a backlog from this concept?"
     options:
       - label: "Yes, generate backlog (Recommended)", description: "Use project concept"
       - label: "Different concept", description: "I want to use a different concept"
     multiSelect: false
     ```
   - If "Yes": proceed with loaded concept to PHASE 1
   - If "Different concept": go to Scenario D

5. **Scenario C: Only backlog exists (no concept)**
   - Show warning:

     ```
     WARNING: Backlog exists but no concept found

     Backlog: .project/backlog.html
     Concept: Not found — run /project-seed first

     A concept is required to update the backlog.
     ```

   - Use AskUserQuestion:
     ```yaml
     header: "No Concept"
     question: "What do you want to do?"
     options:
       - label: "Paste concept", description: "Paste a new concept to update the backlog"
       - label: "View backlog", description: "Open the existing backlog"
     multiSelect: false
     ```

6. **Scenario D: No .project folder OR neither file exists**
   - Ask user to paste concept:
     ```yaml
     header: "Input"
     question: "Paste the output of /project-seed or /project-brainstorm"
     options:
       - label: "I'll paste it below", description: "Type or paste your idea/brainstorm markdown"
       - label: "Load from file", description: "Load from an existing .md file"
     multiSelect: false
     ```

7. **If markdown provided inline (overrides auto-detection):**
   - Parse the provided markdown
   - Extract core concept and features
   - Continue to PHASE 1

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
question: "Do you want to do research before extracting features?"
options:
  - label: "No, extract directly (Recommended)"
    description: "Proceed to feature extraction"
  - label: "Yes, do research"
    description: "Analyze codebase, framework docs (Context7), and web examples for better feature extraction"
multiSelect: false
```

**Response handling:**

- "No" → skip to PHASE 1
- "Yes" → proceed to PHASE 0.5

### Enter Plan Mode

Follow [shared/PLAN-MODE.md](../shared/PLAN-MODE.md) Entry protocol before PHASE 0.5. PHASE 0.5 → PHASE 3 (research → feature extraction → dependencies → priority) run in plan mode; the final feature plan is written to the plan file for review.

### PHASE 0.5: Research (Optional)

**Goal:** Gather codebase, documentation, and web research to inform feature extraction.

**Triggered when:** User chooses "Yes, do research" at end of PHASE 0.

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

Only the compact summary enters the main context for PHASE 1.

### PHASE 1: Feature Extraction

**Goal:** Identify distinct features from the concept.

**Learnings load** (before analysis) via [shared/LEARNINGS-LOAD.md](../shared/LEARNINGS-LOAD.md):

```
scopes: [architectural]
pitfall-prefix: true
current-feature: none
```

Show the loaded output. Architectural patterns guide feature decomposition. Pitfall-prefix prevents repeating structural bugs in new features.

**[WEB MODE]**

1. **Analyze:**
   - What are the core pages/routes?
   - What components need to be built?
   - What API endpoints are required?
   - What can be split into independent features?

   **If research was performed (PHASE 0.5), also consider:**
   - What already exists in the codebase that can be reused or extended?
   - What framework patterns or conventions should guide the decomposition?
   - What pitfalls or anti-patterns were identified to avoid?

   **Granularity decision:** When a feature could be defined as one large item OR multiple smaller items, apply the right-size rule: each feature should represent **1-3 days of work** and be **testable independently**. If in doubt, prefer smaller features — they're easier to combine than to split later.

   **If in update mode (from PHASE 0 Scenario A):**
   - Start from existing backlog features as baseline — do NOT extract from scratch
   - Apply concept changes on top: add NEW features, update MODIFIED descriptions, mark REMOVED as deprecated
   - INDEPENDENT features: always preserve unchanged — they are not concept-derived
   - DOING/DONE features are protected: keep as-is, only enrich description if concept adds new insights
   - CANCELLED features are protected: preserve as `status: "CANCELLED"`, exclude from planning and build order — treat as unavailable
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
   | PAGE | Frontend page/route (goes through design → convert → check pipeline) |
   | COMPONENT | Reusable UI component (goes through same pipeline as PAGE) |
   | PAGE-GAP | Missing functionality found by /frontend-design |

4. **Score risk:**

   Assign each feature a risk score:

   | Score | Risk (how complex?)                                     |
   | ----- | ------------------------------------------------------- |
   | 1     | Trivial change, no unknowns                             |
   | 2     | Known technique, few dependencies                       |
   | 3     | Average complexity, some unknowns                       |
   | 4     | Complex integration or new technology                   |
   | 5     | High complexity, many unknowns or external dependencies |

   **Per feature, note briefly:**
   - Risk score (1-5) + reason (max 1 sentence)

   **Heuristics:**
   - Features with external API/service dependency → higher risk
   - Features that partially exist in codebase (update mode) → lower risk

   **Extraction quality self-check** (run before review, do NOT show to user):
   - Each feature is 1-3 days of work (too large → split, too small → combine)
   - No overlapping scope between features
   - Dependencies are explicit (feature X requires feature Y → note for PHASE 2)
   - Risk scores are substantiated (score without reason → add reason)
   - Research findings incorporated (if PHASE 0.5 was done: findings reflected in feature descriptions)

   Adjust the feature list based on found gaps.

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

5. **[WEB MODE] Reuse-Discovery (optional — only with ≥2 PAGE/FEATURE features with shared UI patterns):**

   **When to skip:** no frontend project, fewer than 2 PAGE/FEATURE features, or all UI patterns are already in `design.components[]`.

   Follow [Discovery — Reuse-Discovery](../shared/SKILL-PATTERNS.md#reuse-discovery) for the canonical protocol.

   **Trigger:** cross-page UI-pattern matching — group features by descriptions (List/table, Card, Form, Modal/dialog, Navigation). Threshold: 2+ PAGE/FEATURE features share the pattern. Add to the feature list (included in PHASE 4 backlog generation); also append kebab-name to `dependencies[]` of each PAGE/FEATURE that triggered the pattern.

   **Source:** `"/project-backlog"` · **Direction:** `"dev→frontend"` · **Type:** `COMPONENT`

   "Skip" → do not add COMPONENT features to the list.

6. **[WEB MODE] Design & Quality signals (optional — only with explicit mentions in concept):**

   Scan concept text for the following keywords. Only add if the concept **explicitly** mentions them — not on implicit speculation.

   | Keyword triggers                                                     | Type  | Name            | Phase |
   | -------------------------------------------------------------------- | ----- | --------------- | ----- |
   | "design tokens", "colors", "typography", "theme", "branding"         | THEME | `theme-init`    | P3    |
   | "a11y", "accessibility", "WCAG", "screen reader", "toegankelijkheid" | A11Y  | `a11y-baseline` | P3    |
   | "performance", "lighthouse", "core web vitals", "SEO", "speed"       | PERF  | `perf-baseline` | P3    |

   For each found item: add to the feature list as:

   ```json
   {
     "name": "{name from table}",
     "type": "THEME|A11Y|PERF",
     "status": "TODO",
     "phase": "P3",
     "description": "{relevant quote or paraphrase from concept}",
     "source": "/project-backlog"
   }
   ```

   "No matches" → do not add Design & Quality items.

---

**[GAME MODE]**

1. **Analyze:**
   - What are the core mechanics?
   - What systems need to be built?
   - What can be split into independent features?

   **If research was performed (PHASE 0.5), also consider:**
   - What already exists in the codebase that can be reused or extended?
   - What framework patterns or conventions should guide the decomposition?
   - What pitfalls or anti-patterns were identified to avoid?

   **Granularity decision:** When a feature could be defined as one large item OR multiple smaller items, apply the right-size rule: each feature should represent **1-3 days of work** and be **testable independently**. If in doubt, prefer smaller features — they're easier to combine than to split later.

   **If in update mode (from PHASE 0 Scenario A):**
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

4. **[GAME MODE] Feature Review (all modes):**

   Use AskUserQuestion:
   - header: "Feature Review"
   - question: "Are these features correct? You can add, remove, or adjust."
   - options:
     - label: "Yes, this is correct (Recommended)", description: "Features are correct, proceed to dependencies"
     - label: "Adjust features", description: "Add, remove, or change name/type/description"
   - multiSelect: false

   **Response handling:**
   - "Yes, this is correct" → proceed to PHASE 2 (game) or Reuse-Discovery if applicable (web)
   - "Adjust features" → ask what to change, apply changes, show updated table, re-ask
   - "Other" → parse user's freeform input, apply changes, show updated table, re-ask

   **Loop until user confirms features are correct.**

5. **[GAME MODE] Core loop validation (only in create mode or when P1 features changed):**

   Check whether the P1 features together form a playable gameplay loop:

   ```
   LOOP VALIDATION

   Moment-to-moment (0-30s):
   - Action: {what the player does} → Response: {what the system does} → Feedback: {what the player sees/hears}

   Session loop (5-30min):
   - Goal: {what the player is trying to achieve}
   - Attempt: {how the player tries to achieve it}
   - Outcome: {win/loss/progression}

   P1 loop complete? {YES / NO — {missing element}}
   ```

   - If the loop is NOT complete: show which element is missing and suggest adding a feature or promoting one to P1
   - If the loop IS complete: show confirmation and proceed

**[WEB MODE] Feature Review:**

Use AskUserQuestion:

- header: "Feature Review"
- question: "Are these features correct? You can add, remove, or adjust."
- options:
  - label: "Yes, this is correct (Recommended)", description: "Features are correct, proceed to dependencies"
  - label: "Adjust features", description: "Add, remove, or change name/type/description/risk"
- multiSelect: false

**Response handling:**

- "Yes, this is correct" → proceed to PHASE 2
- "Adjust features" → ask what to change (add/remove/edit name/type/description/risk), apply changes, show updated table, re-ask
- "Other" → parse user's freeform input, apply changes, show updated table, re-ask

**Loop until user confirms features are correct.**

### PHASE 2: Dependency Analysis

**Goal:** Determine implementation order based on dependencies.

1. **For each feature, ask:**
   - What other features must exist first?
   - Can this be built standalone?

2. **Build dependency graph** — generate an ASCII decomposition tree with feature → epics → stories structure and dependency edges:

   **[WEB MODE] example:**

   ```
   routing (base)
   └── auth-pages
       └── user-dashboard
           ├── profile-settings
           ├── notifications
           └── api-user-data
   ```

   **[GAME MODE] example:**

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
   - If a feature depends on a feature with `status: "CANCELLED"`, mark as broken:
     ```
     ⚠ BROKEN DEPENDENCY: {feature-A} → {feature-B} (CANCELLED)
     Options: (1) remove this dependency, (2) restore {feature-B} via backlog UI
     ```
   - Present broken dependencies before the dependency table
   - Ask user for resolution before proceeding to PHASE 3

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

   Use AskUserQuestion:
   - header: "Dependency Review"
   - question: "Is this order correct? You can adjust dependencies."
   - options:
     - label: "Yes, this is correct (Recommended)", description: "Dependencies are correct, proceed to priority"
     - label: "Adjust dependencies", description: "Add, remove, or reorder dependencies"
   - multiSelect: false

   **Response handling:**
   - "Yes, this is correct" → proceed to PHASE 3
   - "Adjust dependencies" → ask what to change (add/remove/reorder), update graph, show updated table, re-ask
   - "Other" → parse user's freeform input, apply changes, show updated table, re-ask

   **Loop until user confirms dependencies are correct.**

### PHASE 3: Priority Assignment

**Goal:** Assign priorities (P1–P4).

1. **Show feature list as numbered plain text:**

   ```
   Features ({N} total):

   1. {feature-1}: {description}
   2. {feature-2}: {description}
   ...
   ```

   **[WEB MODE]** Ask: "Which features are P1 (minimum needed for a working prototype)? Give numbers (e.g. `1, 3, 5` or `1-4` or `all except 2, 7`)."
   **[GAME MODE]** Ask: "Which features are P1 (minimum needed for a playable prototype)? Give numbers (e.g. `1, 3, 5` or `1-4` or `all except 2, 7`)."

   Parse free-form input → P1-set. User can also say "all" or "none".

2. **Auto-assign remaining features using heuristics:**
   - P2: Features that directly extend P1 functionality OR are prerequisites for important P3 features
   - P3: Nice-to-have, polish, extra content, integrations without core impact
   - P4: Stretch goals, experimental features, future considerations
   - When unclear: prefer P2 (easier to demote than to promote later)

3. **Review with user:**

   Show proposed prioritization table, then:

   Use AskUserQuestion:
   - header: "Priority Review"
   - question: "Is this prioritization correct? P1 = must-have, P2 = extends P1, P3 = nice-to-have, P4 = later. You can move features."
   - options:
     - label: "Yes, this is correct (Recommended)", description: "Priorities are correct, generate backlog"
     - label: "Move features", description: "Move one or more features to a different priority"
     - label: "Adjust", description: "Other changes to priorities"
   - multiSelect: false

   **Response handling:**
   - "Yes, this is correct" → proceed to PHASE 4
   - "Move features" → ask which features and target priority, update table, re-ask
   - "Adjust" → let user describe changes, apply, show updated prioritization, re-ask
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

**Seed Alignment Check** (last step in PHASE 3, before ExitPlanMode):

Follow [shared/SEED.md](../shared/SEED.md) § Alignment Check. Inputs: new features
added, features marked INDEPENDENT/CANCELLED/DEPRECATED, and significant priority
reshuffles from this run. This skill is in plan mode — drift table and proposed
rewrite go into the plan file alongside the feature plan. On "Yes" → carry
`seedUpdateApproved: true` to PHASE 4. On "Skip" → carry `seedDrift[]` to PHASE 4
(written to `backlog.html#data.seedDrift[]`). `source: "/project-backlog"`,
`ref: "feature:{name}"` where applicable.

**End of thinking phase**: follow [shared/PLAN-MODE.md](../shared/PLAN-MODE.md) Exit protocol — write the feature plan (features table with type/risk/phase/dependencies + ASCII dependency tree + priority breakdown) to the plan file, then `ExitPlanMode`. After approval the skill continues with PHASE 4 (HTML write + `.project/project.json` sync + server start).

### PHASE 4: Generate Backlog

**Goal:** Write the interactive HTML kanban backlog.

**Refer to `shared/BACKLOG.md` for the full data format.**

1. **Template or merge:**
   - **Create mode**: Copy template from `{skills_path}/shared/references/backlog-template.html` → `.project/backlog.html`. Create `.project/` if it does not exist.
   - **Update mode**: Read existing `.project/backlog.html`, parse the current JSON block. Do NOT copy the template again — update in-place.

2. **Build the JSON data object:**

   **[WEB MODE]:**

   ```json
   {
     "project": "{Project Name}",
     "generated": "{YYYY-MM-DD}",
     "updated": "{YYYY-MM-DD}",
     "source": "/project-backlog",
     "overview": "{Brief description from source}",
     "features": [
       {
         "name": "{feature-name}",
         "type": "FEATURE|API|INTEGRATION|UI|REFACTOR|PAGE|COMPONENT|PAGE-GAP",
         "status": "TODO",
         "phase": "P1|P2|P3|P4",
         "description": "{description}",
         "source": "/project-backlog",
         "dependencies": ["{other-feature}"],
         "risk": "{1-5 from PHASE 1 risk-score}"
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
     "source": "/project-backlog",
     "overview": "{Brief description from source}",
     "features": [
       {
         "name": "{feature-name}",
         "type": "CORE|MECHANIC|CONTENT|POLISH|UI",
         "status": "TODO",
         "phase": "P1|P2|P3|P4",
         "description": "{description}",
         "source": "/project-backlog",
         "dependencies": ["{other-feature}"]
       }
     ],
     "notes": "{Any notes or considerations}"
   }
   ```

   **[WEB MODE] Sort `features[]` to match the PHASE 2 suggested order:**
   1. **Group by `phase`** in order: P1 → P2 → P3 → P4
   2. **Within each phase, apply topological sort** based on `dependencies[]`:
      - Features with `dependencies: []` first (within that phase)
      - Then features whose all dependencies appear earlier in the array
      - Cross-phase dependencies (e.g. P2-feature depending on P1-feature) are automatically correct: P1 is already before P2
   3. **Tie-breaker** within the same topological "layer": preserve the order from PHASE 1 (extraction order)

   **[WEB MODE] In update mode, apply merge rules:**
   - For each existing backlog feature: preserve `status`, `stage`, `phase`, `date` from the current backlog
   - For MODIFIED features (TODO status): update `description` and `type` from new extraction
   - For MODIFIED features (DOING/DONE status): only enrich `description` if concept adds new insights — never overwrite
   - For NEW features: add with `status: "TODO"`, `stage: null`, `source: "/project-backlog"`
   - For DEPRECATED features: keep in the array but set `status: "DEPRECATED"`
   - For MODIFIED features: preserve existing `source` field; set `"/project-backlog"` only if missing
   - Set `updated` to current date, keep original `generated` date
   - INDEPENDENT features (added outside project-backlog): always preserve intact

3. **Replace the JSON block** in the template:
   - Find: `<script id="backlog-data" type="application/json">...</script>`
   - Replace the content between the tags with the built JSON object

4. **Start backlog server** (if not already running):

   ```bash
   # Respects $CLAUDE_PROJECTS_ROOT via lib/config.js (fallback: ~/projects)
   curl -s http://localhost:9876/ > /dev/null 2>&1 || nohup node --watch ~/.claude/skills/shared/references/serve-backlog.js > /tmp/backlog-server.log 2>&1 &
   ```

5. **Seed mutations** (parallel with dashboard update):
   - **If `seedUpdateApproved: true`:** Write the rewritten content (from the plan file's `## Proposed seed update` section, reviewed in plan mode) to `.project/project-seed.md` — full file overwrite. Update `project.json#concept.pitch` if the new pitch differs; update `concept.name` only if H1 title changed. Log: `Seed: ✓ updated — N section(s) rewritten`.
   - **If `seedUpdateApproved: false` AND `seedDrift[]` non-empty:** Write drift entries into the backlog JSON data object as `data.seedDrift[]` (merge with existing entries if any). Each entry follows the schema from `shared/SEED.md` § Drift entry schema.
   - **If no drift detected:** skip silently.

6. **Update project dashboard** (see `shared/DASHBOARD.md`):

   If concept info is available from input:
   1. Read `.project/project.json` (or create new with empty schema)
   2. Fill `concept` section with name, description, goals, audience, scope — **OVERWRITE**
   3. **[WEB MODE]** Also fill `stack` section with detected framework, language, DB, etc. — only if fields are empty
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

View backlog:  /project-viewer
Start building: /dev-define {first-P1-feature}
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

View backlog:  /project-viewer
Start building: /game-define {first-P1-feature}
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
