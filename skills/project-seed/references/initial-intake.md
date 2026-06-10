# Step 1: Initial Intake

**Auto-detect existing concept:**

1. Check if `.project/` folder exists
   - If folder does NOT exist → proceed to Step 1b (source selection)
2. Check if `.project/project-seed.md` exists (primary) or `.project/project.json` has non-empty `seed.content` (legacy fallback)
3. If concept exists AND no inline description provided:
   - Read `.project/project-seed.md` for the full concept document. Extract title from first H1 heading.
   - Show confirmation:

     ```
     EXISTING SEED DETECTED

     Source: .project/project-seed.md
     Title: {concept title from H1}

     An existing concept was found.
     ```

   - Use AskUserQuestion:
     ```yaml
     header: "Existing Concept"
     question: "What do you want to do?"
     options:
       - label: "Edit (Recommended)", description: "Modify the existing concept"
       - label: "Sync with project", description: "Enrich concept with what has already been built/planned"
       - label: "New concept", description: "Start fresh with a new idea"
     multiSelect: false
     ```
   - **If "Edit":**
     - Load existing concept from `.project/project-seed.md` (or `seed.content` legacy)
     - If `seed.scope` is already set in project.json, use it as default for the question below
     - Ask scope confirmation via AskUserQuestion:

       ```yaml
       header: "Scope"
       question: "Is this still a concept document, or has the work shifted?"
       options:
         - label: "Still a concept (Recommended)", description: "Edit/expand the existing concept"
         - label: "Implementation project", description: "Now driven by a design/Figma/spec — switch to implementation scope"
         - label: "Feature scoping", description: "Now scoping a specific feature instead of the whole concept"
       multiSelect: false
       ```

     - Set active scope from the answer; write to `seed.scope` on save
     - Ask: "What do you want to change about this {scope} document?"
     - Proceed to Step 2 with existing content as context AND the confirmed scope

   - **If "Sync with project":**
     - Proceed to Step 1c (Project Sync)
   - **If "New concept":**
     - Ignore existing file (will be overwritten on save)
     - Proceed with normal flow below

**Step 1a: Scope Check**

After concept detection, also check for broader scope:

1. Check if `.project/backlog.json` exists
2. Check if `.project/features/` contains folders
3. Glob for page files (`app/**/page.tsx`, `src/pages/**/*.tsx`)

If scope context found AND project.json concept already loaded:

```yaml
header: "Scope"
question: "What do you want to think about?"
options:
  - label: "Concept (Recommended)", description: "Work with project.json concept"
  - label: "Implementation project", description: "Existing design/spec/Figma → scope document for build"
  - label: "Feature from backlog", description: "Focus on a specific feature"
  - label: "Page / UX flow", description: "Focus on layout, UX or user flow"
  - label: "Assignment / Large Feature", description: "Scope a task assignment, large feature, or cross-cutting concern"
  - label: "Standalone idea", description: "Standalone idea, not linked to the project"
multiSelect: false
```

**If "Feature from backlog":**

- Read `.project/backlog.json`, parse JSON (see `shared/BACKLOG.md`), show features with status TODO or DEF
- AskUserQuestion to choose feature
- Load `01-define.md` (if it exists) as input context
- Load existing `thinking.md` (if it exists) as previous thinking output
- No define? Use feature description from backlog

**If "Page / UX flow":**

- Glob for page files in the project
- AskUserQuestion to choose page, or let user describe a UX flow
- Load page file as input context
- Check `.project/thinking/{name}.md` for previous thinking output

**If "Standalone idea":**

- Ignore the loaded concept — this idea is independent of the project
- Ask: "Describe your idea in a few sentences"
- Check `.project/thinking/` for previous standalone ideas
- Proceed to Step 2 with user's input

**If "Assignment / Large Feature":**

Ask the following intake questions (present all in one message as separate AskUserQuestion calls):

```yaml
# Question 1
header: "Assignment Goal"
question: "What is the goal of this assignment?"
options:
  - label: "Type your goal", description: "Describe what needs to be achieved"
multiSelect: false

# Question 2
header: "Existing Context"
question: "What already exists in the codebase that's relevant?"
options:
  - label: "Nothing relevant yet", description: "This is greenfield within the project"
  - label: "I'll describe it", description: "There are relevant existing parts"
multiSelect: false

# Question 3
header: "Out of Scope"
question: "What is explicitly out of scope for this assignment?"
options:
  - label: "Nothing specific yet", description: "No known exclusions"
  - label: "I'll describe exclusions", description: "There are explicit out-of-scope items"
multiSelect: false

# Question 4
header: "Constraints"
question: "What are the constraints or dependencies?"
options:
  - label: "None known", description: "No blockers or hard constraints"
  - label: "I'll describe them", description: "There are specific constraints or dependencies"
multiSelect: false

# Question 5
header: "Definition of Done"
question: "What does done look like for this assignment?"
options:
  - label: "I'll describe it", description: "What is the acceptance criterion?"
multiSelect: false
```

After gathering answers, synthesize into a seed document. Output path: `.project/features/{slug}/thinking.md` or user can choose `.project/project-seed.md` directly.

**If "Implementation project":**

- Ask the user to share the source: Figma URL, design file, spec document, or screenshot
- If a Figma URL is provided:
  - Check the available tools list for any `mcp__figma__*` or `mcp__*figma*` tool — if present, use it to query the design (pages, components, frames)
  - If no Figma MCP tool is detected, offer installation via AskUserQuestion:

    ```yaml
    header: "Figma MCP"
    question: "Figma URL detected but no Figma MCP available. Install it now?"
    options:
      - label: "Yes, install Figma MCP (Recommended)", description: "Adds Figma MCP server — design data becomes queryable"
      - label: "Skip — use screenshots", description: "Continue without MCP; ask user for screenshots or page list"
    multiSelect: false
    ```

    If "Yes": print install instructions and pause the flow:

    ```
    To install Figma MCP, run:
      claude mcp add --transport sse figma https://mcp.figma.com/mcp

    Then re-run /project-seed after the MCP is loaded.
    ```

    If "Skip": fall back to WebFetch on the public Figma URL (authenticated URLs will fail), or ask the user for screenshots or a page list

- Read `package.json` if a repo exists to extract `dependencies` keys (framework, CMS, animation libs) for the Tech Stack question — pre-fill the answer instead of asking blind
- Probe for: pages/screens in scope, stack confirmation, and known open design questions (annotations, TBDs from the design)
- Proceed to Step 2 with `scope=implementation` (uses the implementation Round 1 template)
- Output path: `.project/project-seed.md` — treat the implementation scope as the project concept, update `project.json` `seed.name` and `seed.pitch` accordingly

**Output path follows scope automatically:**

- Scope = concept → write to `.project/project-seed.md` + update project.json metadata (name, pitch)
- Scope = implementation → write to `.project/project-seed.md` + update project.json metadata (name, pitch)
- Scope = feature → write to `.project/features/{name}/thinking.md`
- Scope = page/UX → write to `.project/thinking/{topic}.md`
- Scope = standalone idea → write to `.project/thinking/{topic}.md`
- Scope = assignment → write to `.project/features/{slug}/thinking.md` (or `.project/project-seed.md` on user choice)

**Step 1c: Project Sync (if "Sync with project" chosen)**

Enrich the existing concept with features/functionality that exist in the project but are not yet described in the concept document.

**1. Gather project state:**

- Read existing concept from `.project/project-seed.md`
- Read `.project/backlog.json` → parse JSON (see `shared/BACKLOG.md`)
- Collect all feature names, descriptions, and types from backlog
- Read `.project/project.json` → extract `entities` (names, descriptions) and `endpoints` (paths, methods) if present
- Scan codebase for routes/pages:
  - Glob `app/**/page.tsx`, `src/pages/**/*.tsx`, `src/routes/**/*.tsx`
  - Glob `app/**/route.ts`, `src/api/**/*.ts` (API routes)
- **Accumulated drift from prior skill runs:**
  - Glob `.project/features/*/feature.json` → collect all `seedDrift[]` entries (skip features where array is absent or empty)
  - Check `backlog.json#seedDrift[]` if present
  - Carry as `driftEntries[]` in memory for the gap-detection step

**2. Detect gaps:**

Compare all sources (backlog features, codebase routes, project.json entities/endpoints) against concept content.

**Match detection:**

- **No** — item name/description has no mention anywhere in the concept document
- **Partial** — item name appears in the concept but with significantly less detail than the backlog/codebase version (e.g. mentioned in a list but not explained, or described in one sentence while backlog has full requirements)
- **Yes** (covered) — item is meaningfully described in the concept

Present findings:

```
PROJECT SYNC ANALYSIS

Concept: {title}
Backlog features: {count}
Codebase routes: {count found}
Entities: {count from project.json}
Endpoints: {count from project.json}
Deferred drift: {count from driftEntries[]}

GAPS DETECTED:

| #  | Source            | Name              | Type    | In Concept                    |
| -- | ----------------- | ----------------- | ------- | ----------------------------- |
| 1  | Backlog           | {feature-name}    | FEATURE | No                            |
| 2  | Backlog           | {feature-name}    | PAGE    | No                            |
| 3  | Codebase          | /api/webhooks     | API     | No                            |
| 4  | Backlog           | {feature-name}    | UI      | Partial                       |
| 5  | Entity            | User              | DATA    | No                            |
| 6  | Endpoint          | POST /api/auth    | API     | Partial                       |
| 7  | /dev-define drift | {featureDecides}  | drift   | drift — {category}            |
| 8  | /project-backlog drift | {featureDecides} | drift | drift — {category}          |
| .. | ...               | ...               | ...     | ...                           |

ALREADY COVERED:
- {feature described in both concept and backlog}
- {feature described in both concept and backlog}
```

Drift rows (source = `/dev-define drift`, `/game-define drift`, `/project-backlog drift`) originate from deferred `seedDrift[]` entries — decisions that already happened in earlier skill runs and were explicitly skipped. Show `seedSays` in the `Name` column and `featureDecides` as context so the user understands what changed.

**3. Select gaps to integrate:**

Use AskUserQuestion:

```yaml
header: "Gaps"
question: "Which items do you want to add to the concept?"
options:
  - label: "All gaps (Recommended)", description: "Add all {count} missing items"
  - label: "Select items", description: "Choose per item what to add"
  - label: "None, just view", description: "Close sync without changes"
multiSelect: false
```

**If "Select items":** show the gaps as a numbered list:

```
Gaps ({N} total):

1. {gap-1}: {context}
2. {gap-2}: {context}
...
```

Ask: "Which gaps do you want to add? Give numbers (e.g. `1, 3, 5`) or `all`."

Parse → selected-set, integrate only those items.

**If "None":** show the analysis as informational output and end.

**4. Integrate into concept:**

- For each selected gap, draft a section or bullet point that fits naturally into the existing concept structure
- Show the updated concept as a diff preview (new sections marked)
- Ask for confirmation before writing:

```yaml
header: "Concept Update"
question: "Update concept with the selected items?"
options:
  - label: "Yes, update concept (Recommended)", description: "Write the updated concept"
  - label: "Adjust", description: "Adjust the integration before writing"
multiSelect: false
```

**5. Write updated seed:**

- Write to `.project/project-seed.md`
- Update project.json metadata (seed.name, seed.pitch) if changed
- **Drift cleanup** — for each `driftEntries[]` item that was selected and integrated:
  - If from `feature.json#seedDrift[]`: remove the entry from the array (rewrite `feature.json`). If the array is empty after cleanup, omit the field.
  - If from `backlog.json#seedDrift[]`: remove the entry from the array (rewrite `.project/backlog.json`).
  - Not integrated (user skipped): leave intact for a future sync.

```
SEED SYNCED

Added: {count} items
Source: {backlog: X, codebase: Y, drift: Z}
File: .project/project-seed.md

Next steps:
- /project-critique - Analyze the updated seed
- /project-brainstorm - Brainstorm on the new components
```

**Step 1b: Source + scope selection (if no concept found)**

**If no description provided:**

Use two AskUserQuestion calls in a single message:

```yaml
# Question 1: source
header: "Source"
question: "Where do you want to start?"
options:
  - label: "Use chat context (Recommended)", description: "Use what has been discussed in this conversation"
  - label: "Type new idea", description: "Describe a new idea from scratch"
  - label: "Have a design/spec", description: "Figma, screenshots, or specification document to implement"
multiSelect: false

# Question 2: scope
header: "Scope"
question: "What type of project is this?"
options:
  - label: "New concept (Recommended)", description: "An idea or product to articulate"
  - label: "Implementation project", description: "Existing design → code scope document"
  - label: "Feature scoping", description: "Scope a feature or assignment"
multiSelect: false
```

Set active scope from the answer for use in Step 2 question selection and the `seed.scope` field on save.

**If "Use chat context" or source = chat:**

Process using Chat Context flow (see below).

**If "Type new idea":**
Ask: "What is your idea? Describe it in 1-2 sentences."

**If "Have a design/spec":** Proceed as Implementation project (see Step 1a handler for "Implementation project").

**If description provided (inline argument):**

Proceed to Step 2 with the argument as starting concept.

**Chat Context flow:**

1. Analyze the conversation history:
   - What idea, concept, or topic has been discussed?
   - What are the key details, requirements, or characteristics mentioned?
   - Is there enough substance to work with?
2. Synthesize into a concise concept summary
3. Present to user:

   ```
   CHAT CONTEXT

   [concise summary of what was discussed in the conversation]
   ```

4. Use AskUserQuestion to confirm:
   ```yaml
   header: "Context Check"
   question: "Does this summary of the conversation look right?"
   options:
     - label: "Yes, correct (Recommended)", description: "Use this as input"
     - label: "Adjust", description: "I want to update the summary"
   multiSelect: false
   ```
5. If confirmed: use as input concept and proceed to Step 2
6. If "Adjust": ask what to change, update summary, confirm again
7. If insufficient context in conversation: inform user and fall back to manual input
