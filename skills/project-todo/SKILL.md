---
name: project-todo
description: >-
  Add new backlog items (features, changes, bugs, refactors, pages, components,
  scenes, scripts, a11y, performance) — single or smart-split multi-item for
  cross-domain descriptions. Auto-detects stack (web/game) and initialises
  project.json if missing. Use with /project-todo or /project-todo [description]
  when capturing a new idea for the project backlog.
metadata:
  author: claude-config
  version: 1.0.0
  category: project
---

# Todo

Capture new backlog items, optionally flesh them out through 1-2 quick thinking rounds, and add them to the backlog. The bridge between "I have an idea" and a backlog item ready for `/dev-define` (web) or `/game-define` (game).

**Trigger**: `/project-todo` or `/project-todo [description]`

## When to Use

- User has a new feature, change, bug fix, improvement, mechanic, or content idea for an existing project
- User wants to quickly capture an item without full `/project-plan`
- User wants to think through an idea before adding to backlog

NOT for: concept-level ideation (`/thinking-concept`), iterating on existing items (`/thinking-brainstorm`, `/thinking-critique`).

## Workflow

### Pre-PHASE 0: Project Onboarding

Check whether `.project/project.json` exists.

- **Exists** → proceed directly to Stack Detection.
- **Does not exist** → AskUserQuestion:

  ```yaml
  header: "Project setup"
  question: "No .project/project.json found. How do you want to proceed?"
  options:
    - label: "Run /core-setup first (Recommended)"
      description: "Stop here — run /core-setup for full project initialisation"
    - label: "Quick scaffold + add item"
      description: "Create minimal project.json and continue"
    - label: "Cancel"
  multiSelect: false
  ```

  - **"Run /core-setup first"** → output `Run /core-setup to initialise the project.`, stop.
  - **"Quick scaffold"** → first ask for the project type via AskUserQuestion:

    ```yaml
    header: "Project type"
    question: "What kind of project is this?"
    options:
      - label: "Web (Recommended)"
        description: "Web/CLI/library — backend + frontend"
      - label: "Game (Godot)"
        description: "Godot game project with GDScript"
    multiSelect: false
    ```

    Then write two files and continue:
    1. `.project/project.json` (minimal):

       ```json
       {
         "name": "{directory name of the project}",
         "created": "{YYYY-MM-DD}",
         "stack": {},
         "features": []
       }
       ```

       - "Web" → `"stack": {}`
       - "Game (Godot)" → `"stack": { "engine": "godot" }`

    2. `.project/session/setup-pending.json` (so `/core-setup` can finish the rest later):
       ```json
       {
         "source": "/project-todo",
         "mode": "greenfield",
         "createdAt": "{YYYY-MM-DD}"
       }
       ```

    Show: `PROJECT.JSON CREATED — run /core-setup later for full setup.`

  - **"Cancel"** → stop.

### Stack Detection (pre-PHASE 0)

1. Try to read `.project/project.json`
2. Check fields:
   - `stack.engine === "godot"` OR `concept.platform === "game"` → **GAME MODE**
   - No match or no project.json → **WEB MODE**
3. Show detected mode:
   ```
   STACK: web    (→ /dev-define pipeline)
   STACK: game   (→ /game-define pipeline)
   ```

### PHASE 0: Input + Backlog Check

1. **Determine description:**
   - Argument provided (`/project-todo add-dash-ability`) → use as starting description
   - No argument (`/project-todo`) → ask the user directly: "What do you want to add to the backlog?" Wait for their answer.

2. **Multi-item detection:**

   **[GAME MODE]:** skip this step. Multi-item split is a dev/frontend concept and does not apply to game types (MECHANIC/SYSTEM/CONTENT/POLISH/UI). Add game items one by one.

   **[WEB MODE]:** analyze the description for cross-domain signals:
   - Contains connectors: "including", "with accompanying", "and the page", "and the UI", "plus frontend", "with frontend"
   - Explicitly describes both backend/logic/API and UI/page/component

   **If multi-domain detected → AskUserQuestion:**

   ```yaml
   header: "Multiple items"
   question: "This seems to span multiple domains. Do you want to split it?"
   options:
     - label: "Yes, split it (Recommended)"
       description: "Create separate items (e.g. FEATURE + PAGE), linked via dependencies"
     - label: "No, one item"
       description: "Add everything together as one backlog item"
   multiSelect: false
   ```

   **On "Yes":**
   - Generate a proposal: 2-3 sub-items with `{ name (kebab), type-hint, short description }`. Use your knowledge of dev/frontend splitting:
     - Logic/API/data → FEATURE (Dev swimlane)
     - Page/route → PAGE (Frontend swimlane)
     - Reusable UI piece → COMPONENT (Frontend swimlane)
   - Show as plain-text table, ask confirmation (plain text, no modal): "Does this split look right? Type y to continue, or adjust the names/types."
   - Set internal queue: `items = [{name, description, type-hint}, ...]` (max 3)
   - Process PHASE 1b/1c/1d and PHASE 2 sequentially for each item
   - Link via `dependencies[]`: frontend children get `dependencies: ["dev-item-name"]`

   **On "No" or no detection:** `items = [single item]`, process normally.

3. **Backlog check:**
   - Read `.project/backlog.html`
   - **Not found** → create it:
     1. `mkdir -p .project`
     2. Read `{skills_path}/shared/references/backlog-template.html` → Write to `.project/backlog.html`
     3. Replace placeholder JSON in `<script id="backlog-data">` with minimal data object:
        ```json
        {
          "project": "{project directory name}",
          "generated": "{YYYY-MM-DD}",
          "updated": "{YYYY-MM-DD}",
          "source": "/project-todo",
          "overview": "",
          "features": [],
          "notes": ""
        }
        ```
   - **Found** → parse JSON, check duplicates:

     **Single-item:**
     - Generate kebab-case name from description
     - Look up `data.features.find(f => f.name === name)`
     - Found → AskUserQuestion:

       ```yaml
       header: "Duplicate"
       question: "Item '{name}' already exists (status: {status}). What do you want to do?"
       options:
         - label: "Add anyway (Recommended)"
           description: "Add with a different name"
         - label: "Expand item"
           description: "Use /thinking-brainstorm or /thinking-critique on the existing item"
         - label: "Cancel"
           description: "Stop, add nothing"
       multiSelect: false
       ```

       - "Add anyway" → append suffix (e.g. `dash-ability-2`)
       - "Expand item" → suggest `/thinking-brainstorm {name}` and stop
       - "Cancel" → stop

     **Multi-item (items.length > 1):**
     - Loop over all queue items and generate kebab-case names
     - Check per item: `data.features.find(f => f.name === name)` AND collision with other queue names
     - Conflict → silently append suffix (`-2`, `-3`) without modal
     - After the loop show all final names as plain-text confirmation before continuing:
       `"Items will be added as: {name-1}, {name-2}. Type y to continue."`

### PHASE 1: Elaboration

**Question: Depth**

```yaml
header: "Approach"
question: "How do you want to work out this idea?"
options:
  - label: "Quick add (Recommended)"
    description: "Priority + type, straight to backlog"
  - label: "Think it through briefly"
    description: "2-3 targeted questions to sharpen the idea"
multiSelect: false
```

**"Quick add":** go to PHASE 1b.
**"Think it through briefly":** go to PHASE 1a.

### PHASE 1a: Thinking Rounds (optional)

Formulate 2-3 questions specific to THIS idea. Present all questions in one AskUserQuestion call via the `questions` array:

- Each question = specific to THIS idea, not generic
- Concrete, clickable options (2-4 per question)
- Recommended option = most likely choice
- Maximum 3 questions
- **[WEB MODE]** Focus on scope, goal, and approach — not on implementation details
- **[GAME MODE]** Focus on gameplay feel, balancing, and technical approach (Godot-specific)

**[GAME MODE]** Use these question headers as a guide:

```yaml
# Question 1
header: "Gameplay"
question: "{specific question about how this mechanic feels/works for the player}"

# Question 2
header: "Balancing"
question: "{specific question about balancing, tuning, or interaction with existing mechanics}"

# Question 3 (optional)
header: "Technical"
question: "{specific question about technical approach or Godot-specific choices}"
```

After the answers: incorporate the insights into a sharpened description of the item. Continue to PHASE 1b.

### PHASE 1b: Priority + Category/Type

**Multi-item mode** (items.length > 1): use the batch flow below. Single-item: skip batch flow and use the WEB/GAME MODE blocks directly.

**Batch flow:** one AskUserQuestion call with N+1 questions:

```yaml
# Question 1 — Priority (applies to all items in batch)
header: "Priority"
question: "What priority does this batch of items have?"
options:
  - label: "P1 (Recommended)", description: "Highest priority"
  - label: "P2", description: "Important but not blocking"
  - label: "P3", description: "When there's time"
  - label: "P4", description: "Park for later"
multiSelect: false

# Question 2..N+1 — Type per item (one question per queue item, header = kebab-name)
# Options = same set as the single-item flow (see WEB/GAME MODE below),
# based on type-hint from PHASE 0 multi-split.
```

If you want a different priority per item: choose "No, one item" in PHASE 0 and run `/project-todo` multiple times.

**[WEB MODE]** Single-item — one AskUserQuestion call with two questions:

```yaml
# Question 1
header: "Priority"
question: "What priority does this item have?"
options:
  - label: "P1 (Recommended)", description: "Highest priority"
  - label: "P2", description: "Important but not blocking"
  - label: "P3", description: "When there's time"
  - label: "P4", description: "Park for later"
multiSelect: false

# Question 2
header: "Category"
question: "Which category fits best?"
options:
  - label: "Dev (Recommended)", description: "Backend, API, logic, data, bugs, refactor"
  - label: "Frontend", description: "Pages and components"
  - label: "Design & Quality", description: "Tokens, accessibility, performance, missing page functionality"
multiSelect: false
```

**[GAME MODE]** Single-item — two separate AskUserQuestion calls:

```yaml
# Question 1: Priority
header: "Priority"
question: "What priority does this feature have?"
options:
  - label: "P1 (Recommended)", description: "Highest priority"
  - label: "P2", description: "Important but not blocking"
  - label: "P3", description: "When there's time"
  - label: "P4", description: "Park for later"
multiSelect: false

# Question 2: Type
header: "Type"
question: "What type of item is this?"
options:
  - label: "MECHANIC (Recommended)", description: "New gameplay mechanic (ability, movement, combat)"
  - label: "SYSTEM", description: "Supporting system (spawning, scoring, saving)"
  - label: "CONTENT", description: "Levels, enemies, items, dialogue"
  - label: "POLISH", description: "Juice, particles, screen shake, sound"
  - label: "UI", description: "HUD, menus, feedback indicators"
multiSelect: false
```

### PHASE 1c: Type (WEB MODE only)

One AskUserQuestion call (1 question). Options depend on chosen category:

**If Dev:**

```yaml
header: "Type"
question: "What type of item is this?"
options:
  - label: "FEATURE (Recommended)", description: "New functionality"
  - label: "CHANGE", description: "Modification to existing functionality"
  - label: "BUG", description: "Bug fix or correction"
  - label: "API", description: "Backend endpoint or service"
multiSelect: false
```

**If Frontend:**

```yaml
header: "Type"
question: "Which frontend entity?"
options:
  - label: "PAGE (Recommended)", description: "New page/route — lands on Frontend track ('To design')"
  - label: "COMPONENT", description: "Reusable UI component — lands on Frontend track"
  - label: "PAGE-GAP", description: "Missing functionality on existing page — lands on Dev track"
multiSelect: false
```

All three types fall through to **PHASE 1d → PHASE 2 Backlog write**. PAGE and COMPONENT land on the Frontend swimlane ("To design"); PAGE-GAP on the Dev swimlane ("To define").

**If Design & Quality:**

```yaml
header: "Type"
question: "What type of design/quality item is this?"
options:
  - label: "THEME (Recommended)", description: "Design tokens — colors, typography, spacing via /frontend-tokens"
  - label: "A11Y", description: "Accessibility improvement via /frontend-check --scope=a11y"
  - label: "PERF", description: "Performance or SEO optimization via /frontend-check"
multiSelect: false
```

### PHASE 1d: Dependencies

**Multi-item:** skip this question — dependencies were already determined in PHASE 0 step 2 (frontend children automatically get `dependencies: ["dev-item-name"]`).

```yaml
header: "Dependencies"
question: "Are there features that need to be done first?"
options:
  - label: "No (Recommended)"
    description: "No dependencies"
  - label: "Yes, I'll name them"
    description: "Provide the names as a comma-separated list"
multiSelect: false
```

**"No"** → `dependencies: []`

**"Yes"** → AskUserQuestion (free text): "Which features? (comma-separated)" → parse to array → `dependencies: ["name1", "name2"]`

### PHASE 2: Write to Backlog + Thinking

**Loop:** all steps below run per item in the queue (PHASE 0 step 2). For a single item, `items = [single item]`. For multi-item, the skill runs steps 1-7 sequentially per item, where `dependencies[]` refers to previously processed items in the batch.

1. Read `.project/backlog.html` → parse JSON from `<script id="backlog-data" type="application/json">...</script>`

2. **Generate name:** kebab-case from description (e.g. "Dash ability with cooldown" → `dash-ability`)

3. **Insert into `data.features[]`** — add the new object after the last item with `status: "DOING"` or `status: "TODO"`, or at the start if there are no active items:

   ```json
   {
     "name": "{kebab-case-name}",
     "type": "{chosen type}",
     "status": "TODO",
     "phase": "{chosen priority}",
     "description": "{description — sharpened if thinking rounds were done}",
     "source": "/project-todo",
     "dependencies": []
   }
   ```

   The `source: "/project-todo"` field signals to `/project-plan` that this feature was added manually (INDEPENDENT) and must never be overwritten during a backlog rebuild.

4. **Update metadata:** set `data.updated` to current date (`YYYY-MM-DD`)

5. **Write back:** Edit the JSON block in `backlog.html`. Find a unique anchor in the existing features array and use Edit to insert the new object before it. Keep the `<script>` tags intact.

6. **Write thinking output** (only if PHASE 1a was completed):

   Path: `.project/thinking/feature-idea-{name}.md` — `mkdir -p .project/thinking`
   - **[WEB MODE]:**

     ```markdown
     # {Item Name}

     ## Description

     {sharpened description}

     ## Scope

     {answer to scope question}

     ## Goal

     {answer to goal question}

     ## Approach

     {answer to approach question, if asked}
     ```

   - **[GAME MODE]:**

     ```markdown
     # {Feature Name}

     ## Description

     {sharpened description}

     ## Gameplay

     {answer to gameplay question}

     ## Balancing

     {answer to balancing question}

     ## Technical

     {answer to technical question, if asked}
     ```

   No mutation to `project.json` for thinking — output goes in separate md files per DASHBOARD.md.

7. **Sync to `project.json.features[]`** (concept sync):
   - Read `.project/project.json` (already read in Pre-PHASE 0)
   - Initialize `features = []` if missing
   - Check duplicate on `name` — if found and status > TODO: MERGE (update `summary`, preserve status). Otherwise push:
     ```json
     {
       "name": "{kebab-name}",
       "type": "{type}",
       "status": "TODO",
       "phase": "{P1-P4}",
       "summary": "{description, max 200 chars}",
       "dependencies": [],
       "source": "/project-todo",
       "created": "{YYYY-MM-DD}"
     }
     ```
   - Write `.project/project.json`

   Do NOT write to `concept.content` or `project-concept.md` — those are owned by `/thinking-concept`.

### PHASE 3: Output

**[MULTI-ITEM — when items queue > 1]:**

```
TODOS ADDED ({n} items)

  1. {name-1}    {phase} · {type}
     {description-1}

  2. {name-2}    {phase} · {type}     ← depends on: {name-1}
     {description-2}

  Backlog: .project/backlog.html
  Next steps:
  [Per item, appropriate next step from the WEB/GAME MODE output below]
```

**[WEB MODE — single item]:**

```
TODO ADDED

  {name}                {phase} · {type}
  {description}
  Thinking: .project/thinking/feature-idea-{name}.md    ← only if thinking rounds were done

  Backlog: .project/backlog.html
  Next steps:
  - /thinking-brainstorm {name} - Deepen the idea with variations
  - /thinking-critique {name} - Test the idea critically
  [If type is FEATURE, CHANGE, BUG, or API:]
  - /dev-define {name} - Start with requirements and building
  - /team-outsource {name} - Outsource to a teammate via GitHub/Jira/Linear
  [If type is PAGE or COMPONENT:]
  - /frontend-design {name} - Build the page/component
  - /frontend-design - Define multiple pages at once
  [If type is THEME:]
  - /frontend-tokens - Set up design tokens (color, typography, spacing)
  [If type is A11Y:]
  - /frontend-check --scope=a11y {name} - Run accessibility audit
  [If type is PERF:]
  - /frontend-check {name} - Run performance and SEO audit
  [If type is PAGE-GAP:]
  - /dev-define {name} - Define the missing functionality
```

**[GAME MODE]:**

```
FEATURE ADDED

  {name}                {phase} · {type}
  {description}
  Thinking: .project/thinking/feature-idea-{name}.md    ← only if thinking rounds were done

  Backlog: .project/backlog.html
  Next steps:
  - /thinking-brainstorm {name} - Deepen the idea with variations
  - /thinking-critique {name} - Test the idea critically
  - /game-define {name} - Start with requirements and architecture
```

## Restrictions

- Do NOT write implementation code
- Do NOT modify existing items in the backlog
- Do NOT skip the priority and type questions
- Max 3 items per batch during smart split
- Thinking rounds: max 3 questions, no more
- Do NOT write to `project-concept.md` or `concept.content` — only `/thinking-concept` may do that

### Terminal Formatting

- NEVER use blockquote syntax (`>`) for displaying content — causes unreadable white background in dark terminals
- NEVER use inline code backticks for emphasis on regular words — use **bold** or plain text
- Backticks only for actual code, file paths, and command references

### Language

Follow the Language Policy in CLAUDE.md.
