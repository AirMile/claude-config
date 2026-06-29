---
name: project-todo
description: Add new backlog items to the project. Use with /project-todo.
reads: [project.stack, backlog.status, concept.seed]
writes:
  [
    backlog.status,
    backlog.features,
    backlog.seedDrift,
    project.stack,
    project.thinking,
  ]
metadata:
  author: claude-config
  version: 1.1.0
  category: project
---

# Todo

Capture new backlog items, optionally flesh them out through 1-2 quick thinking rounds, and add them to the backlog. The bridge between "I have an idea" and a backlog item ready for `/dev-define` (web) or `/game-define` (game).

**Trigger**: `/project-todo` or `/project-todo [description]`

## When to Use

- User has a new feature, change, bug fix, improvement, mechanic, or content idea for an existing project
- User wants to quickly capture an item without full `/project-backlog`
- User wants to think through an idea before adding to backlog

NOT for: concept-level ideation (`/project-seed`), iterating on existing items (`/project-brainstorm`, `/project-critique`).

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

2. **Size check:**

   Analyze the description for indicators of a large feature:
   - Multiple components or layers involved
   - Cross-cutting concern (affects multiple parts of the codebase)
   - Unclear or unbounded scope
   - Multiple phases mentioned
   - Keywords: "redesign", "overhaul", "full", "entire", "system"

   **If ≥2 indicators detected → show warning (plain text, no modal):**

   ```
   ⚠ This looks like a large feature that might benefit from planning first.
   Consider running /project-seed to structure it before adding to the backlog.
   ```

   Then ask via AskUserQuestion:

   ```yaml
   header: "Large feature"
   question: "How do you want to proceed?"
   options:
     - label: "Run /project-seed first (Recommended)"
       description: "Structure the feature before adding it — produces a seed document for /project-backlog"
     - label: "Add as todo anyway"
       description: "Add to backlog without extra planning"
   multiSelect: false
   ```

   - **"Run /project-seed first"** → output `Run /project-seed to scope this feature first.`, stop.
   - **"Add as todo anyway"** → continue normally.

   **If fewer than 2 indicators:** skip this check entirely, no output.

3. **Multi-item detection:**

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
     - Page/route → PAGE (Design swimlane)
     - Reusable UI piece → COMPONENT (Design swimlane)
   - Show as plain-text table, ask confirmation (plain text, no modal): "Does this split look right? Type y to continue, or adjust the names/types."
   - Set internal queue: `items = [{name, description, type-hint}, ...]` (max 3)
   - Process PHASE 1b/1c/1d and PHASE 2 sequentially for each item
   - Link via `dependencies[]`: frontend children get `dependencies: ["dev-item-name"]`

   **On "No" or no detection:** `items = [single item]`, process normally.

4. **Backlog check:**
   - Read `.project/backlog.json`
   - **Not found** → create it (see `shared/BACKLOG.md § Writing` for the legacy backlog.html migration rule):
     1. `mkdir -p .project`
     2. Write minimal data object to `.project/backlog.json`:
        ```json
        {
          "schemaVersion": 2,
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
           description: "Use /project-brainstorm or /project-critique on the existing item"
         - label: "Cancel"
           description: "Stop, add nothing"
       multiSelect: false
       ```

       - "Add anyway" → append suffix (e.g. `dash-ability-2`)
       - "Expand item" → suggest `/project-brainstorm {name}` and stop
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

> **Todo**: Read '.claude/skills/project-todo/references/modal-options.md' — static AskUserQuestion option templates for PHASE 1b and 1c.

**Multi-item mode** (items.length > 1) — batch flow: one AskUserQuestion call with N+1 questions. Question 1 = Priority (template § Priority, batch wording, applies to all items). Questions 2..N+1 = type per queue item (header = kebab-name, options from the § Type template matching the type-hint from the PHASE 0 multi-split). Want a different priority per item? Choose "No, one item" in PHASE 0 and run `/project-todo` multiple times.

**[WEB MODE]** Single-item — one AskUserQuestion call with two questions: § Priority + § Category — WEB.

**[GAME MODE]** Single-item — two separate AskUserQuestion calls: § Priority, then § Type — GAME.

### PHASE 1c: Type (WEB MODE only)

One AskUserQuestion call (1 question). Options depend on the category chosen in PHASE 1b — use the matching template from `references/modal-options.md`:

- **Dev** → § Type — WEB · Dev category
- **Design** → § Type — WEB · Design category
- **Design & Quality** → § Type — WEB · Design & Quality category

All three Design types fall through to **PHASE 1d → PHASE 2 Backlog write**. PAGE and COMPONENT land on the Design swimlane ("To design"); PAGE-GAP on the Dev swimlane ("To define").

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

**Loop:** all steps below run per item in the queue (PHASE 0 step 2). For a single item, `items = [single item]`. For multi-item, the skill runs steps 1-8 sequentially per item, where `dependencies[]` refers to previously processed items in the batch.

1. Read `.project/backlog.json` → parse JSON

2. **Generate name:** kebab-case from description (e.g. "Dash ability with cooldown" → `dash-ability`)

3. **Insert into `data.features[]`** — add the new object after the last item with `status: "DOING"` or `status: "TODO"`, or at the start if there are no active items:

   ```json
   {
     "name": "{kebab-case-name}",
     "type": "{chosen type}",
     "status": "TODO",
     "transition": "designing",
     "phase": "{chosen priority}",
     "description": "{description — sharpened if thinking rounds were done}",
     "source": "/project-todo",
     "dependencies": []
   }
   ```

   **`transition` rule:** only include `"transition": "designing"` when `type === "PAGE"` or `type === "COMPONENT"`. Omit the field entirely for all other types (FEATURE, API, THEME, etc.).

   The `source: "/project-todo"` field signals to `/project-backlog` that this feature was added manually (INDEPENDENT) and must never be overwritten during a backlog rebuild.

4. **Update metadata:** set `data.updated` to current date (`YYYY-MM-DD`)

5. **Seed drift check** (per item, no LLM round, no modal):
   - Run the Reader from `shared/SEED.md` once per run (first loop iteration only, cache `SEED_CONTEXT` across the queue). `SEED_CONTEXT.present === false` → skip silently.
   - Representation check: tokenize the kebab name (tokens ≥ 3 chars) plus the key nouns of the description; the item counts as represented when the name or ≥ 1 token appears in `SEED_CONTEXT.markdown`.
   - Not represented → prepare a `seedDrift[]` entry per the `shared/SEED.md § Drift entry schema`:

     ```json
     {
       "category": "scope-expansion",
       "seedSays": "(no mention of {name})",
       "featureDecides": "{description, max 120 chars}",
       "source": "/project-todo",
       "ref": "feature:{name}",
       "detectedAt": "{ISO timestamp}"
     }
     ```

   - This is the SEED.md "Skip"-branch behavior: drift is recorded for later `/project-seed § Sync` pickup — never rewrite the seed, never ask. Log one line: `Seed: ⚠ drift recorded — {name} not in seed` or `Seed: ✓ aligned`.

6. **Write back:** Edit the JSON in `.project/backlog.json`. Find a unique anchor in the existing features array and use Edit to insert the new object before it. Prepared drift entries from step 5 are appended to `data.seedDrift[]` in this same write pass (initialize the array if absent) — no separate write roundtrip.

7. **Write thinking output** (only if PHASE 1a was completed):

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

8. **Sync to `project.json.features[]`** (concept sync):
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

   Do NOT write to `seed.content` or `project-seed.md` — those are owned by `/project-seed`.

### PHASE 3: Output

**[MULTI-ITEM — when items queue > 1]:**

```
TODOS ADDED ({n} items)

  1. {name-1}    {phase} · {type}
     {description-1}

  2. {name-2}    {phase} · {type}     ← depends on: {name-1}
     {description-2}

  Seed drift: {n} item(s) recorded    ← only if step 5 recorded drift
  Backlog: .project/backlog.json
  Next steps:
  [Per item, appropriate next step from the WEB/GAME MODE output below]
```

**[WEB MODE — single item]:**

```
TODO ADDED

  {name}                {phase} · {type}
  {description}
  Thinking: .project/thinking/feature-idea-{name}.md    ← only if thinking rounds were done
  Seed drift: {n} item(s) recorded                      ← only if step 5 recorded drift

  Backlog: .project/backlog.json
  Next steps:
  - /project-brainstorm {name} - Deepen the idea with variations
  - /project-critique {name} - Test the idea critically
  [If type is FEATURE, CHANGE, BUG, or API:]
  - /dev-define {name} - Start with requirements and building
  - /team-outsource {name} - Outsource to a teammate via GitHub/Jira/Linear
  [If type is PAGE or COMPONENT:]
  - /design-create {name} - Build the page/component
  - /design-create - Define multiple pages at once
  [If type is THEME:]
  - /design-tokens - Set up design tokens (color, typography, spacing)
  [If type is A11Y:]
  - /design-check --scope=a11y {name} - Run accessibility audit
  [If type is PERF:]
  - /design-check {name} - Run performance and SEO audit
  [If type is PAGE-GAP:]
  - /dev-define {name} - Define the missing functionality
```

**[GAME MODE]:**

```
FEATURE ADDED

  {name}                {phase} · {type}
  {description}
  Thinking: .project/thinking/feature-idea-{name}.md    ← only if thinking rounds were done
  Seed drift: {n} item(s) recorded                      ← only if step 5 recorded drift

  Backlog: .project/backlog.json
  Next steps:
  - /project-brainstorm {name} - Deepen the idea with variations
  - /project-critique {name} - Test the idea critically
  - /game-define {name} - Start with requirements and architecture
```

## Restrictions

- Do NOT write implementation code
- Do NOT modify existing items in the backlog
- Do NOT skip the priority and type questions
- Max 3 items per batch during smart split
- Thinking rounds: max 3 questions, no more
- Do NOT write to `project-seed.md` or `seed.content` — only `/project-seed` may do that

### Terminal Formatting

- NEVER use blockquote syntax (`>`) for displaying content — causes unreadable white background in dark terminals
- NEVER use inline code backticks for emphasis on regular words — use **bold** or plain text
- Backticks only for actual code, file paths, and command references

### Language

Follow the Language Policy in CLAUDE.md.
