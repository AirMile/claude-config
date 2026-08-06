# Step 1: Initial Intake

**Auto-detect existing concept:**

1. Check if `.project/` folder exists
   - If folder does NOT exist → proceed to Step 1b (source selection)
2. Check if `.project/project-seed.md` exists
   - If it does NOT exist → proceed directly to **Step 1b** (source + scope selection). If `project.json#seed.pitch`/`seed.name` is already set (e.g. a `/core-setup` stub), pass it into Step 1b as prefill context for "Type new idea" — still ask the Source + Scope questions, don't skip them.
3. If concept exists AND no inline description provided:
   - Read `.project/project-seed.md` for the full concept document. Read `seed.scope` from `.project/project.json`.
   - **Core-setup stub shortcut**: if the seed has NO `#` H1 heading AND `seed.scope` is absent, it is a starter pitch written by `/core-setup`, not a developed concept. Skip the confirmation block and BOTH the "Existing Concept" and scope-confirmation modals below: set scope = `concept`, treat the action as edit/expand, announce one line (e.g. "Starter concept from /core-setup detected — expanding it directly."), and proceed to Step 2 with the stub text as context. In Step 2, derive Round 1 options from the stub and skip aspects it already answers.
   - **Developed concept** (has an H1 + sections): extract the title from the first H1 heading, then continue with the confirmation below.
   - Show confirmation:

     ```
     EXISTING SEED DETECTED

     Source: .project/project-seed.md
     Title: {concept title from H1}

     An existing concept was found.
     ```

   - **Pending drift count:** `N` = `backlog.json#data.seedDrift[].length` + sum of all `.project/features/*/feature.json#seedDrift[].length` (skip missing files/arrays).
   - Use AskUserQuestion. With `N > 0`, Sync moves to the top as the recommended option:

     ```yaml
     # N > 0
     header: "Existing Concept"
     question: "What do you want to do?"
     options:
       - label: "Sync with project (Recommended)", description: "Integrate {N} deferred drift item(s) + built/planned gaps"
       - label: "Edit", description: "Modify the existing concept"
       - label: "New concept", description: "Start fresh with a new idea"
     multiSelect: false
     ```

     ```yaml
     # N = 0 (unchanged)
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
     - Run Step 1d, then proceed to Step 2 with existing content as context AND the confirmed scope

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

Two sequential modals (4-option cap per `shared/SKILL-PATTERNS.md § Modal Option Cap`; show modal 2 only if "More →" is picked):

```yaml
header: "Scope"
question: "What do you want to think about?"
options:
  - label: "Concept (Recommended)", description: "Work with project.json concept"
  - label: "Implementation project", description: "Existing design/spec/Figma → scope document for build"
  - label: "Feature from backlog", description: "Focus on a specific feature"
  - label: "More →", description: "Page / UX flow, Assignment / Large Feature, Standalone idea"
multiSelect: false
```

```yaml
header: "Scope"
question: "What do you want to think about?"
options:
  - label: "Page / UX flow", description: "Focus on layout, UX or user flow"
  - label: "Assignment / Large Feature", description: "Scope a task assignment, large feature, or cross-cutting concern"
  - label: "Standalone idea", description: "Standalone idea, not linked to the project"
multiSelect: false
```

**If "Feature from backlog" / "Page / UX flow" / "Standalone idea":** follow the matching scope handler in [shared/INPUT-PARSING.md § PHASE 1a](../../shared/INPUT-PARSING.md) (seed variant — "proceed" = Step 2).

**If "Assignment / Large Feature":**

Free-text intake — these are open questions, not multiple-choice. Ask in one message for: assignment goal, relevant existing context, explicit out-of-scope items, constraints/dependencies, and definition of done (each may be "none yet"). Run Step 1d, then synthesize the answers into a seed document. Output path: `.project/features/{slug}/thinking.md` or user can choose `.project/project-seed.md` directly.

**If "Implementation project":**

- Ask the user to share the source: Figma URL, design file, spec document, or screenshot
- If a Figma URL is provided: check the available tools for any `mcp__*figma*` tool and use it to query the design (pages, components, frames). No Figma MCP detected → suggest `claude mcp add --transport sse figma https://mcp.figma.com/mcp` (re-run `/project-seed` after loading), or fall back to WebFetch on a public Figma URL / screenshots / a page list from the user.
- Read `package.json` if a repo exists to extract `dependencies` keys (framework, CMS, animation libs) for the Tech Stack question — pre-fill the answer instead of asking blind
- Probe for: pages/screens in scope, stack confirmation, and known open design questions (annotations, TBDs from the design)
- Run Step 1d, then proceed to Step 2 with `scope=implementation` (uses the implementation Round 1 template)
- Output path: `.project/project-seed.md` — treat the implementation scope as the project concept, update `project.json` `seed.name` and `seed.pitch` accordingly

**Output path follows scope** — routing is canonical in [shared/THINKING-OUTPUT.md](../../shared/THINKING-OUTPUT.md) (loaded in PHASE 5); do not decide paths here. Two seed-only mappings THINKING-OUTPUT does not list: **assignment** behaves as feature scope (`.project/features/{slug}/thinking.md`, or `.project/project-seed.md` on user choice); **implementation** behaves as concept scope (`.project/project-seed.md` + project.json metadata).

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

**If Scope = "Implementation project" but Source ≠ "Have a design/spec"** (i.e. "Use chat context" or "Type new idea"): the Scope answer is leading — proceed as Implementation project (Step 1a handler) regardless of Source; use the Source answer only to decide the opening question (share an external source vs. use what's already in chat/typed).

**If description provided (inline argument):**

Run Step 1d (once scope is set), then proceed to Step 2 with the argument as starting concept.

**Step 1c: Project Sync (if "Sync with project" chosen)**

> **Todo**: Read `.claude/skills/project-seed/references/project-sync.md` and execute the sync flow: gather project state → detect gaps (incl. deferred `seedDrift[]`) → select → integrate → write + drift cleanup.

**Step 1d: Project Memory Load (mandatory — runs right after Step 1a or Step 1b resolves scope, before PHASE 2)**

> **Todo**: Once the active scope is known, read [shared/INPUT-PARSING.md § Project Memory Load](../../shared/INPUT-PARSING.md) and run it (seed variant: implementation and assignment scopes use the concept-scope learnings config). Step 2 question rounds must derive Round-1 options from what is actually built, and PHASE 4 output must not silently contradict `status: done` components.

Skip only for: the Sync route (Step 1c — `project-sync.md` gathers richer state itself), standalone scope, and projects without `.project/`.

**Chat Context flow:** follow [shared/INPUT-PARSING.md § Chat Context flow](../../shared/INPUT-PARSING.md) (seed variant — confirmed summary → Step 2).
