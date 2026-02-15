---
name: thinking-idea
description: Articulate and develop ideas through guided questions into structured markdown. Use with /thinking-idea when starting with a vague concept that needs development.
disable-model-invocation: true
metadata:
  author: mileszeilstra
  version: 1.1.0
  category: thinking
---

# Idea

Develop ideas from initial concept to structured output through targeted questions and synthesis. Works with any type of idea--creative concepts (games, stories, art), product ideas (apps, services, businesses), or other conceptual work.

The output is a structured markdown document that can be used as input for `/thinking-brainstorm` or `/thinking-critique`.

## When to Use

- User starts with `/thinking-idea` (with or without description)
- User has a vague concept that needs articulation
- User wants to develop a game, story, product, app, service, or creative project concept

## Process

### Step 1: Initial Intake

**Auto-detect existing concept:**

1. Check if `.workspace/` folder exists
   - If folder does NOT exist → proceed to Step 1b (source selection)
2. Check if `.workspace/concept.md` exists
3. If exists AND no inline description provided:
   - Read the concept file
   - Show confirmation:

     ```
     EXISTING CONCEPT DETECTED

     File: .workspace/concept.md
     Title: {extracted title}

     Er bestaat al een concept.
     ```

   - Use AskUserQuestion:
     ```yaml
     header: "Bestaand Concept"
     question: "Wat wil je doen?"
     options:
       - label: "Bewerken (Recommended)", description: "Pas het bestaande concept aan"
       - label: "Nieuw concept", description: "Begin opnieuw met een nieuw idee"
       - label: "Chat context", description: "Gebruik wat er in dit gesprek is besproken"
       - label: "Explain question", description: "Leg uit wat dit betekent"
     multiSelect: false
     ```
   - **If "Bewerken":**
     - Load existing concept
     - Ask: "Wat wil je aanpassen aan dit concept?"
     - Proceed to Step 2 with existing content as context
   - **If "Nieuw concept":**
     - Ignore existing file (will be overwritten on save)
     - Proceed with normal flow below
   - **If "Chat context":**
     - Process using Chat Context flow (see below)

**Step 1b: Source selection (if no concept found)**

**If no description provided:**

Use AskUserQuestion:

```yaml
header: "Bron"
question: "Waar wil je beginnen?"
options:
  - label: "Todoist Ideas laden (Recommended)", description: "Kies een idee uit je Todoist Ideas project"
  - label: "Chat context gebruiken", description: "Gebruik wat er in dit gesprek is besproken als startpunt"
  - label: "Nieuw idee typen", description: "Beschrijf een nieuw idee"
  - label: "Obsidian zoeken", description: "Zoek een bestaand idee in je Obsidian vault"
multiSelect: false
```

**If "Chat context gebruiken":**

Process using Chat Context flow (see below).

**If "Todoist Ideas laden":**

1. Fetch tasks: `mcp__todoist__get_tasks_list(project_id="2362341183")`
2. Present tasks using AskUserQuestion:

   ```yaml
   header: "Todoist Idee"
   question: "Welk idee wil je uitwerken?"
   options:
     - label: "{task 1 name}", description: "{description preview or label}"
     - label: "{task 2 name}", description: "{description preview or label}"
     - label: "{task 3 name}", description: "{description preview or label}"
     - label: "{task 4 name}", description: "{description preview or label}"
   multiSelect: false
   ```

   - Show max 4 tasks at a time. If more exist, pick the 4 most recent tasks.
   - If user selects "Other", show next batch or let them type a search term.

3. Load selected task: use task name as idea title, task description as initial context
4. Track `todoist_source_task_id` for later closing the task after completion
5. Proceed to Step 2 with loaded context

**If "Nieuw idee typen":**
Ask: "Wat is je idee? Beschrijf het in 1-2 zinnen."

**If "Obsidian zoeken":**

1. Ask: "Waar zoek je naar?" (or use inline argument if provided)
2. Search Obsidian: `mcp__obsidian__search_notes(query={search term}, limit=3)`
3. If relevant match found in `Ideas/`:
   - Present matches using AskUserQuestion:
     ```yaml
     header: "Obsidian Idee"
     question: "Welk idee wil je gebruiken?"
     options:
       - label: "{match 1 title}", description: "{path}"
       - label: "{match 2 title}", description: "{path}"
       - label: "{match 3 title}", description: "{path}"
     multiSelect: false
     ```
   - Read selected note with `mcp__obsidian__read_note()`, load as starting context
   - Track `obsidian_source_path` for later save-back
4. If no match found: inform user and offer to type a new idea instead

**If description provided (inline argument):**

1. Search Obsidian: `mcp__obsidian__search_notes(query={argument}, limit=3)`
2. If relevant match found in `Ideas/`:
   - Show: "Er is een bestaand idee in Obsidian: **{title}** (`{path}`)"
   - Use AskUserQuestion:
     ```yaml
     header: "Obsidian Match"
     question: "Wil je dit bestaande idee als startpunt gebruiken?"
     options:
       - label: "Ja, gebruik als basis (Recommended)", description: "Laad het Obsidian idee en werk er verder aan"
       - label: "Nee, nieuw concept", description: "Begin opnieuw met het getypte idee"
     multiSelect: false
     ```
   - **If "Ja":** Read the note with `mcp__obsidian__read_note()`, load as starting context, track `obsidian_source_path` for later save-back
3. Also search Todoist for matching tasks: `mcp__todoist__get_tasks_list(filter="search: {argument}", project_id="2362341183")`
   - If match found: show "Er staat een vergelijkbaar idee in Todoist: **{task name}**" and offer to load it (with description as extra context)
4. If no matches anywhere: acknowledge briefly and proceed to Step 2.

**Chat Context flow:**

1. Use sequential thinking to analyze the conversation history:
   - What idea, concept, or topic has been discussed?
   - What are the key details, requirements, or characteristics mentioned?
   - Is there enough substance to work with?
2. Synthesize into a concise concept summary
3. Present to user:

   ```
   CHAT CONTEXT

   > [concise summary of what was discussed in the conversation]
   ```

4. Use AskUserQuestion to confirm:
   ```yaml
   header: "Context Check"
   question: "Klopt deze samenvatting van het gesprek?"
   options:
     - label: "Ja, klopt (Recommended)", description: "Gebruik dit als input"
     - label: "Aanpassen", description: "Ik wil de samenvatting bijwerken"
   multiSelect: false
   ```
5. If confirmed: use as input concept and proceed to Step 2
6. If "Aanpassen": ask what to change, update summary, confirm again
7. If insufficient context in conversation: inform user and fall back to manual input

### Step 2: Explore and Expand

Develop the idea through multiple rounds of concrete, clickable questions. Minimum 2 rounds before proceeding to Step 3.

**Setup:**

1. Determine idea type (creative concept, product, service, etc)
2. Use sequential thinking to plan questions for the first round

**Ronde 1 - Fundament (3-4 vragen parallel):**

Use sequential thinking to formulate 3-4 fundamental questions about the idea. Present ALL questions in a single message, each as a separate AskUserQuestion:

```yaml
# Question 1
header: "Doelgroep"
question: "Voor wie is dit bedoeld?"
options:
  - label: "{specific audience A} (Recommended)", description: "{why this fits}"
  - label: "{specific audience B}", description: "{why this fits}"
  - label: "{specific audience C}", description: "{why this fits}"
multiSelect: false

# Question 2
header: "Scope"
question: "Hoe groot zie je dit?"
options:
  - label: "{scope option A} (Recommended)", description: "{what this means}"
  - label: "{scope option B}", description: "{what this means}"
multiSelect: false

# Question 3
header: "Kernervaring"
question: "Wat is het belangrijkste gevoel/resultaat?"
options:
  - label: "{experience A} (Recommended)", description: "{concrete example}"
  - label: "{experience B}", description: "{concrete example}"
  - label: "{experience C}", description: "{concrete example}"
multiSelect: true

# Question 4 (optional)
header: "Sessiemodel"
question: "Hoe ziet een typische sessie eruit?"
options:
  - label: "{session type A} (Recommended)", description: "{details}"
  - label: "{session type B}", description: "{details}"
multiSelect: false
```

**Note:** The examples above are templates. Every question and option MUST be specific to THIS idea. Use sequential thinking to derive concrete, relevant options from the idea context.

**Ronde 2 - Diepte (3-4 vragen parallel):**

Build on Round 1 answers. Use sequential thinking to formulate follow-up questions. Same format: each question = separate AskUserQuestion with concrete options.

Focus areas for Round 2:

- Features/mechanics specifics
- Differentiatie (what makes it unique)
- Style/atmosphere/tone
- Motivation system or engagement model

**Ronde 3+ - Optioneel:**

After Round 2, use AskUserQuestion:

```yaml
header: "Verdieping"
question: "Wil je nog meer aspecten uitwerken?"
options:
  - label: "Door naar samenvatting (Recommended)", description: "Er is genoeg context voor een goed concept"
  - label: "Nog een ronde", description: "Ik wil nog meer aspecten uitdiepen"
  - label: "Explain question", description: "Leg uit wat de volgende stap inhoudt"
multiSelect: false
```

- **If "Nog een ronde":** formulate 2-3 targeted follow-up questions based on gaps from previous rounds
- **If "Door naar samenvatting":** proceed to Step 3

**Question rules:**

- NEVER use meta-options ("Beantwoord vragen", "Minder vragen")
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

### Step 3: Synthesize and Confirm

1. Create a concise summary based on all input
2. Present summary to user
3. Use AskUserQuestion for confirmation:
   ```yaml
   options:
     - label: "Klopt, genereer output (Recommended)", description: "Samenvatting is correct, ga door naar markdown output"
     - label: "Aanpassen", description: "Ik wil iets wijzigen of toevoegen"
     - label: "Opnieuw samenvatten", description: "Maak een nieuwe samenvatting"
     - label: "Explain question", description: "Leg uit wat er met de samenvatting gebeurt"
   multiSelect: false
   ```
4. Incorporate feedback if needed
5. Repeat until user confirms
6. **Depth guard:** If the confirmed summary covers fewer than 3 distinct content aspects (e.g. only has title + vague description), suggest returning to Step 2 for an additional round:
   ```yaml
   header: "Verdieping nodig"
   question: "De samenvatting is nog vrij dun. Wil je nog een ronde vragen doen voor meer diepgang?"
   options:
     - label: "Ja, extra ronde (Recommended)", description: "Terug naar Step 2 voor meer details"
     - label: "Nee, ga door", description: "Genereer output met huidige inhoud"
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

### Step 5: Output Destination

After generating the markdown content, present options for what to do with it.

Use AskUserQuestion:

```yaml
header: "Output"
question: "Wat wil je met het concept doen?"
options:
  - label: "Opslaan naar concept (Recommended)", description: "Opslaan naar .workspace/concept.md voor verder gebruik"
  - label: "Opslaan naar Obsidian", description: "Opslaan als permanente Idea note in je Obsidian vault"
  - label: "Alleen tonen", description: "Toon als markdown code block (niet opslaan)"
multiSelect: false
```

**Response handling:**

**If "Opslaan naar concept":**

1. Create `.workspace/` folder if it doesn't exist
2. Write content to `.workspace/concept.md`
3. Confirm:

   ```
   CONCEPT SAVED

   File: .workspace/concept.md

   Next steps:
   - /thinking:critique - Kritisch analyseren en versterken
   - /thinking:brainstorm - Creatief uitbreiden en variaties
   - /dev:plan - Omzetten naar web feature backlog
   - /game:backlog - Omzetten naar feature backlog (voor games)
   ```

**If "Opslaan naar Obsidian":**

1. Also save to `.workspace/concept.md` (so brainstorm/critique can pick it up)
2. Detect category from content using sequential thinking:
   - Game-related → `game`
   - App/service/tool → `app`
   - Story/narrative/writing → `story`
   - Website/platform → `website`
   - Otherwise → `other`
3. Map category to Obsidian path:
   - `game` → `Ideas/Games/`
   - `app` → `Ideas/Apps/`
   - `story` → `Ideas/Stories/`
   - `website` → `Ideas/Websites/`
   - otherwise → `Ideas/Other/`
4. If the concept was loaded from Obsidian (tracked via `obsidian_source_path` from Step 1b):
   - Overwrite the original note: `mcp__obsidian__write_note(path=obsidian_source_path, content=..., mode="overwrite")`
   - Update frontmatter status to `developing`
5. If new concept:
   - Derive filename from the H1 title (spaces allowed, no special chars)
   - Add frontmatter:
     ```yaml
     ---
     type: idea
     category: { detected_category }
     status: seed
     created: { YYYY-MM-DD }
     ---
     ```
   - Write: `mcp__obsidian__write_note(path="Ideas/{subfolder}/{title}.md", content=frontmatter + body)`
6. Search for related notes: `mcp__obsidian__search_notes(query={title}, limit=3)`
   - If matches found, suggest adding `[[links]]` and mention them to the user
7. Update Home.md Recent Ideas: `mcp__obsidian__patch_note(path="Home.md", oldString="## Recent Ideas\n", newString="## Recent Ideas\n- [[{title}]]\n")`
   - If patch fails (string not found), skip silently
8. Confirm:

   ```
   CONCEPT SAVED TO OBSIDIAN

   File: Ideas/{subfolder}/{title}.md
   Category: {category}
   Status: seed

   Next steps:
   - /thinking:critique - Kritisch analyseren en versterken
   - /thinking:brainstorm - Creatief uitbreiden en variaties
   - /dev:plan - Omzetten naar web feature backlog
   - /game:backlog - Omzetten naar feature backlog (voor games)
   ```

**If "Alleen tonen":**

1. Wrap output in a code block with `markdown` language tag for copy button
2. Display the content

### Step 6: Todoist Close Loop

**Only if `todoist_source_task_id` was tracked (idea loaded from Todoist in Step 1b):**

After saving/showing the output, ask:

Use AskUserQuestion:

```yaml
header: "Todoist"
question: "Het idee is uitgewerkt. Wat wil je met de Todoist taak doen?"
options:
  - label: "Afsluiten (Recommended)", description: "Markeer de Todoist taak als voltooid"
  - label: "Open laten", description: "Laat de taak open in Todoist"
multiSelect: false
```

- **If "Afsluiten":** `mcp__todoist__close_tasks(task_id=todoist_source_task_id)`
- **If "Open laten":** no action

---

## Best Practices

**Questions:** Be conversational, adapt dynamically, dig deeper where user shows excitement, extract vision without imposing constraints.

**Synthesis:** Be accurate to what user said, don't add assumptions, confirm before proceeding.

**Output:** Structure clearly, make scannable, adapt sections to idea type, output ONLY the markdown document.

**AskUserQuestion:**

- NEVER use meta-options ("Beantwoord vragen", "Minder vragen")
- Each question = separate AskUserQuestion with concrete options
- Options specific to the idea, not generic
- `multiSelect: true` when multiple answers are valid
- Up to 4 questions parallel per round
- Recommended option = most contextually likely answer

### Language

Follow the Language Policy in CLAUDE.md.
