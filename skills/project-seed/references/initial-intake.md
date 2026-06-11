# Step 1: Initial Intake

**Auto-detect existing concept:**

1. Check if `.project/` folder exists
   - If folder does NOT exist → proceed to Step 1b (source selection)
2. Check if `.project/project-seed.md` exists
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
     - Load existing concept from `.project/project-seed.md`
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

**If "Feature from backlog" / "Page / UX flow" / "Standalone idea":** follow the matching scope handler in [shared/INPUT-PARSING.md § PHASE 1a](../../shared/INPUT-PARSING.md) (seed variant — "proceed" = Step 2).

**If "Assignment / Large Feature":**

Free-text intake — these are open questions, not multiple-choice. Ask in one message for: assignment goal, relevant existing context, explicit out-of-scope items, constraints/dependencies, and definition of done (each may be "none yet"). Synthesize the answers into a seed document. Output path: `.project/features/{slug}/thinking.md` or user can choose `.project/project-seed.md` directly.

**If "Implementation project":**

- Ask the user to share the source: Figma URL, design file, spec document, or screenshot
- If a Figma URL is provided: check the available tools for any `mcp__*figma*` tool and use it to query the design (pages, components, frames). No Figma MCP detected → suggest `claude mcp add --transport sse figma https://mcp.figma.com/mcp` (re-run `/project-seed` after loading), or fall back to WebFetch on a public Figma URL / screenshots / a page list from the user.
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

> **Todo**: Read `.claude/skills/project-seed/references/project-sync.md` and execute the sync flow: gather project state → detect gaps (incl. deferred `seedDrift[]`) → select → integrate → write + drift cleanup.

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

**Chat Context flow:** follow [shared/INPUT-PARSING.md § Chat Context flow](../../shared/INPUT-PARSING.md) (seed variant — confirmed summary → Step 2).
