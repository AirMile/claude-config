---
name: project-seed
description: "Transform any idea, concept, feature, or task assignment into a structured seed document. Use with /project-seed to feed /project-backlog. Works for greenfield products, games, mature project features, and task assignments."
metadata:
  author: claude-config
  version: 1.2.0
  category: project
---

# Seed

Transform any idea, concept, feature, or task assignment into a structured seed document through targeted questions and synthesis. Works with any type of input — creative concepts (games, stories, art), product ideas (apps, services, businesses), feature requests, or task assignments. Can also sync existing seed documents with the current project state (backlog, codebase).

The output is a structured markdown document that can be used as input for `/project-backlog`, `/project-brainstorm`, or `/project-critique`.

## When to Use

- User starts with `/project-seed` (with or without description)
- User has a vague concept that needs articulation
- User wants to develop a game, story, product, app, service, or creative project concept
- User has a task assignment or large feature that needs scoping before planning

## Process

### Step 1: Initial Intake

**Auto-detect existing concept:**

1. Check if `.project/` folder exists
   - If folder does NOT exist → proceed to Step 1b (source selection)
2. Check if `.project/project-seed.md` exists (primary) or `.project/project.json` has non-empty `concept.content` (legacy fallback)
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
     - Load existing concept
     - Ask: "What do you want to change about this concept?"
     - Proceed to Step 2 with existing content as context
   - **If "Sync with project":**
     - Proceed to Step 1c (Project Sync)
   - **If "New concept":**
     - Ignore existing file (will be overwritten on save)
     - Proceed with normal flow below

**Step 1a: Scope Check**

After concept detection, also check for broader scope:

1. Check if `.project/backlog.html` exists
2. Check if `.project/features/` contains folders
3. Glob for page files (`app/**/page.tsx`, `src/pages/**/*.tsx`)

If scope context found AND project.json concept already loaded:

```yaml
header: "Scope"
question: "What do you want to think about?"
options:
  - label: "Concept (Recommended)", description: "Work with project.json concept"
  - label: "Feature from backlog", description: "Focus on a specific feature"
  - label: "Page / UX flow", description: "Focus on layout, UX or user flow"
  - label: "Assignment / Large Feature", description: "Scope a task assignment, large feature, or cross-cutting concern"
  - label: "Standalone idea", description: "Standalone idea, not linked to the project"
multiSelect: false
```

**If "Feature from backlog":**

- Read `.project/backlog.html`, parse JSON from `<script id="backlog-data">` block (see `shared/BACKLOG.md`), show features with status TODO or DEF
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

**Output path follows scope automatically:**

- Scope = concept → write to `.project/project-seed.md` + update project.json metadata (name, pitch)
- Scope = feature → write to `.project/features/{name}/thinking.md`
- Scope = page/UX → write to `.project/thinking/{topic}.md`
- Scope = standalone idea → write to `.project/thinking/{topic}.md`
- Scope = assignment → write to `.project/features/{slug}/thinking.md` (or `.project/project-seed.md` on user choice)

**Step 1c: Project Sync (if "Sync with project" chosen)**

Enrich the existing concept with features/functionality that exist in the project but are not yet described in the concept document.

**1. Gather project state:**

- Read existing concept from `.project/project-seed.md`
- Read `.project/backlog.html` → parse JSON from `<script id="backlog-data">` (see `shared/BACKLOG.md`)
- Collect all feature names, descriptions, and types from backlog
- Read `.project/project.json` → extract `entities` (names, descriptions) and `endpoints` (paths, methods) if present
- Scan codebase for routes/pages:
  - Glob `app/**/page.tsx`, `src/pages/**/*.tsx`, `src/routes/**/*.tsx`
  - Glob `app/**/route.ts`, `src/api/**/*.ts` (API routes)

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

GAPS DETECTED:

| #  | Source   | Name              | Type    | In Concept |
| -- | -------- | ----------------- | ------- | ---------- |
| 1  | Backlog  | {feature-name}    | FEATURE | No         |
| 2  | Backlog  | {feature-name}    | PAGE    | No         |
| 3  | Codebase | /api/webhooks     | API     | No         |
| 4  | Backlog  | {feature-name}    | UI      | Partial    |
| 5  | Entity   | User              | DATA    | No         |
| 6  | Endpoint | POST /api/auth    | API     | Partial    |
| .. | ...      | ...               | ...     | ...        |

ALREADY COVERED:
- {feature described in both concept and backlog}
- {feature described in both concept and backlog}
```

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
- Update project.json metadata (concept.name, concept.pitch) if changed

```
SEED SYNCED

Added: {count} items
Source: {backlog: X, codebase: Y}
File: .project/project-seed.md

Next steps:
- /project-critique - Analyze the updated seed
- /project-brainstorm - Brainstorm on the new components
```

**Step 1b: Source selection (if no concept found)**

**If no description provided:**

Use AskUserQuestion:

```yaml
header: "Source"
question: "Where do you want to start?"
options:
  - label: "Use chat context (Recommended)", description: "Use what has been discussed in this conversation as starting point"
  - label: "Type new idea", description: "Describe a new idea"
multiSelect: false
```

**If "Use chat context":**

Process using Chat Context flow (see below).

**If "Type new idea":**
Ask: "What is your idea? Describe it in 1-2 sentences."

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

### Step 2: Explore and Expand

Develop the idea through rounds of concrete, clickable questions. Rounds are suggestions — the user decides when there's enough context.

**Setup:**

1. Determine idea type (creative concept, product, service, etc)
2. Plan questions for the first round

**Round 1 - Foundation (3-4 questions in parallel):**

Formulate 3-4 fundamental questions about the idea. Present ALL questions in a single message, each as a separate AskUserQuestion:

```yaml
# Question 1
header: "Target Audience"
question: "Who is this intended for?"
options:
  - label: "{specific audience A} (Recommended)", description: "{why this fits}"
  - label: "{specific audience B}", description: "{why this fits}"
  - label: "{specific audience C}", description: "{why this fits}"
multiSelect: false

# Question 2
header: "Scope"
question: "How large do you see this?"
options:
  - label: "{scope option A} (Recommended)", description: "{what this means}"
  - label: "{scope option B}", description: "{what this means}"
multiSelect: false

# Question 3
header: "Core Experience"
question: "What is the most important feeling/result?"
options:
  - label: "{experience A} (Recommended)", description: "{concrete example}"
  - label: "{experience B}", description: "{concrete example}"
  - label: "{experience C}", description: "{concrete example}"
multiSelect: true

# Question 4 (optional)
header: "Session Model"
question: "What does a typical session look like?"
options:
  - label: "{session type A} (Recommended)", description: "{details}"
  - label: "{session type B}", description: "{details}"
multiSelect: false
```

**Note:** The examples above are templates. Every question and option MUST be specific to THIS idea. Derive concrete, relevant options from the idea context.

**After each round**, use AskUserQuestion:

```yaml
header: "Deeper Dive"
question: "Do you want to explore more aspects?"
options:
  - label: "Another round (Recommended)", description: "Explore more aspects of the idea"
  - label: "Proceed to summary", description: "There is enough context for a good concept"
multiSelect: false
```

- **If "Another round":** formulate 2-4 targeted follow-up questions based on gaps from previous rounds
- **If "Proceed to summary":** proceed to Step 3

**Follow-up round focus areas:**

- Features/mechanics specifics
- Differentiation (what makes it unique)
- Style/atmosphere/tone
- Motivation system or engagement model
- Any direction the user showed interest in

**Conversational flexibility:**

The user may respond to questions in unexpected ways — asking their own questions, going deeper on one specific topic, or skipping questions entirely. Follow the conversation naturally. The rounds provide structure, not a rigid script.

**Further rounds:**

Same pattern: present the "Deeper Dive" AskUserQuestion after each round. As rounds progress, switch the recommended option to "Proceed to summary" when enough context has been gathered (typically after 2-3 rounds).

**Question rules:**

- NEVER use meta-options ("Answer questions", "Fewer questions")
- Each question = separate AskUserQuestion with concrete, clickable options
- Options are specific to THIS idea, not generic
- Recommended option = most likely answer based on context so far
- "Other" is built-in — user can always type custom input
- `multiSelect: true` where multiple answers make sense
- Maximum 4 questions per round (parallel in one message)
- Ask for concrete details, not abstract concepts
- Adapt question style to idea type (game vs product vs story)
- Help articulate what's in the user's head
- Save criticism or expansion for later--this phase is pure idea capture

### CHECKPOINT: Idea Summary

After the question rounds, present a structured overview of all gathered input before synthesis begins:

| Aspect          | Value                                   |
| --------------- | --------------------------------------- |
| Topic           | {idea title/topic}                      |
| Scope           | {concept / feature / page / standalone} |
| Target Audience | {from round 1}                          |
| Core Experience | {from round 1}                          |
| Deeper Dives    | {summary of follow-up rounds}           |

Ask via AskUserQuestion: "Does this overview look right before we summarize?"

- "Proceed to summary (Recommended)" — proceed to synthesis
- "Another round" — back to Step 2 for extra questions
- "Adjust" — correct a specific point

### Enter Plan Mode

Follow [shared/PLAN-MODE.md](../shared/PLAN-MODE.md) Entry protocol before Step 3. Steps 3-4 (synthesis + output generation) run in plan mode; the concept document (Step 4) is written to the plan file for review.

---

### Step 3: Synthesize and Confirm

1. Create a concise summary based on all input
2. Present summary to user
3. Use AskUserQuestion for confirmation:
   ```yaml
   options:
     - label: "Correct, generate output (Recommended)", description: "Summary is correct, proceed to markdown output"
     - label: "Adjust", description: "I want to change or add something"
     - label: "Re-summarize", description: "Create a new summary"
   multiSelect: false
   ```
4. Incorporate feedback if needed
5. Repeat until user confirms
6. **Depth guard:** If the confirmed summary covers fewer than 3 distinct content aspects (e.g. only has title + vague description), suggest returning to Step 2 for an additional round:
   ```yaml
   header: "More depth needed"
   question: "The summary is still quite thin. Do you want another question round for more depth?"
   options:
     - label: "Yes, extra round (Recommended)", description: "Back to Step 2 for more details"
     - label: "No, continue", description: "Generate output with current content"
   multiSelect: false
   ```

### Step 4: Generate Output

Create a structured markdown document adapted to the idea type.

**Required sections:**

- **Title** (H1 format)
- **Short description** (1-2 sentences)
- **Core concept** (detailed explanation)

**Additional sections by type:**

For creative concepts (games, stories, art):

- Characters, Mechanics/Gameplay, Narrative/Plot, Aesthetic/Style, Tone and Atmosphere, Unique Elements

For product ideas (apps, services, businesses):

- Target Audience, Key Features, User Journey/Experience, Value Proposition, Differentiation

**Output format:**

- Pure markdown without introductory text or preambles
- No "Here's your document:" framing
- Proper markdown formatting (# for title, ## for sections)

**End of thinking phase**: follow [shared/PLAN-MODE.md](../shared/PLAN-MODE.md) Exit protocol — write the concept document to the plan file, then `ExitPlanMode`. After approval the skill continues with Step 5 (output destination and `.project/` writes).

### Step 5: Output Destination

After generating the markdown content, determine output destination based on scope.

**If scope = feature or page (from Step 1a):**

Save automatically to the scope location:

- Scope = feature → write to `.project/features/{name}/thinking.md`
- Scope = page/UX → create `.project/thinking/` if needed, write to `.project/thinking/{topic}.md`

```
THINKING OUTPUT SAVED

File: {output-path}
Scope: {feature:{name} | page:{topic}}
```

**Dashboard sync — thinking log** (see `shared/DASHBOARD.md`):

1. Read `.project/project.json` (skip if not present)
2. Write full markdown to `.project/thinking/{today}-idea-{slug}.md`
3. Push to `thinking` array:
   ```json
   {
     "type": "idea",
     "date": "{today}",
     "title": "{concept title}",
     "summary": "{key insight, max 200 chars}",
     "file": ".project/thinking/{today}-idea-{slug}.md",
     "source": "/project-seed"
   }
   ```
4. Write `.project/project.json`

Then optionally ask:

```yaml
header: "Concept"
question: "Do you also want to save this as the project concept?"
options:
  - label: "No (Recommended)", description: "Output is saved at the scope location"
  - label: "Yes, also to concept", description: "Also update project-seed.md"
multiSelect: false
```

If "Yes": Write the full concept document as plain markdown to `.project/project-seed.md`. Also update project.json: Read `.project/project.json` (or create with {}), set `concept.name` (H1 title), `concept.pitch` (first paragraph, 1-2 sentences), `seed.seedFile = "project-seed.md"`. Remove `concept.content` if it exists (migrated to .md). Write back.

**If scope = standalone idea (from Step 1a):**

Save to `.project/thinking/{today}-idea-{slug}.md`:

1. Create `.project/thinking/` if needed
2. Write to `.project/thinking/{today}-idea-{slug}.md`

```
THINKING OUTPUT SAVED

File: .project/thinking/{today}-idea-{slug}.md
Scope: standalone idea
```

**Dashboard sync — thinking log** (see `shared/DASHBOARD.md`):

1. Read `.project/project.json` (skip if not present)
2. Push to `thinking` array (file already written above):
   ```json
   {
     "type": "idea",
     "date": "{today}",
     "title": "{concept title}",
     "summary": "{key insight, max 200 chars}",
     "file": ".project/thinking/{today}-idea-{slug}.md",
     "source": "/project-seed"
   }
   ```
3. Write `.project/project.json`

**If scope = concept (default) or no scope chosen:**

Use AskUserQuestion:

```yaml
header: "Output"
question: "What do you want to do with the concept?"
options:
  - label: "Save to concept (Recommended)", description: "Save to project-seed.md for further use"
  - label: "Copy to clipboard", description: "Copy markdown to clipboard (don't save)"
multiSelect: false
```

**If "Save to concept":**

1. Create `.project/` folder if it doesn't exist
2. Write the full concept document as plain markdown to `.project/project-seed.md`
3. Also update project.json: Read `.project/project.json` (or create with `{}`), set `concept.name` (H1 title), `concept.pitch` (first paragraph, 1-2 sentences), `seed.seedFile = "project-seed.md"`. Remove `concept.content` if it exists (migrated to .md). Write back.
4. Confirm:

   ```
   SEED SAVED

   File: .project/project-seed.md
   Name: {concept.name}

   Next steps:
   - /project-critique - Critically analyze and strengthen
   - /project-brainstorm - Creatively expand and create variations
   - /project-backlog - Convert to feature backlog
   ```

**Seed-scope output is integrated into `project-seed.md`.** No separate `.project/thinking/*.md` for concept-scope and no `concept.thinking[]` append — the living document is the source. Update `concept.name` and `concept.pitch` in `project.json` if metadata changes.

**If "Copy to clipboard":**

Follow [`shared/CLIPBOARD.md`](../shared/CLIPBOARD.md) — wrap output in a `markdown` code block so the user can copy via the UI's code-block copy button, or execute the platform `pbcopy` / `Set-Clipboard` command to send it directly to the system clipboard.

---

## Best Practices

**Questions:** Be conversational, adapt dynamically, dig deeper where user shows excitement, extract vision without imposing constraints.

**Synthesis:** Be accurate to what user said, don't add assumptions, confirm before proceeding.

**Output:** Structure clearly, make scannable, adapt sections to idea type, output ONLY the markdown document.

**AskUserQuestion:**

- NEVER use meta-options ("Answer questions", "Fewer questions")
- Each question = separate AskUserQuestion with concrete options
- Options specific to the idea, not generic
- `multiSelect: true` when multiple answers are valid
- Up to 4 questions parallel per round
- Recommended option = most contextually likely answer

### Terminal Formatting

- NEVER use blockquote syntax (`>`) for displaying content — causes unreadable white background in dark terminals
- NEVER use inline code backticks for emphasis on regular words — use **bold** or plain text
- Backticks only for actual code, file paths, and command references

### Language

Follow the Language Policy in CLAUDE.md.
