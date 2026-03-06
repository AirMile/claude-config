---
name: thinking-brainstorm
description: Creatively expand ideas through interactive technique application. Generates variations, explores alternatives, pushes boundaries. Use with /thinking-brainstorm after /thinking-idea.
disable-model-invocation: true
metadata:
  author: mileszeilstra
  version: 1.0.0
  category: thinking
---

## Overview

This skill helps creatively expand and explore ideas through interactive application of brainstorming techniques. It works with any type of concept input - whether from `/thinking-idea`, existing documents, or other sources - and guides you through technique-by-technique exploration with questions and suggestions.

The process is interactive: apply one technique at a time through Q&A, then choose to explore another technique or generate your final refined idea. The output is a clean markdown document of the refined idea, ready to use.

## When to Use

Trigger this skill when:

- User wants to explore variations and alternatives of an idea
- User wants to push boundaries and discover new possibilities
- User has an idea and wants creative expansion
- User starts with `/thinking-brainstorm` command

Example triggers:

- "/brainstorm" (followed by pasting idea)
- "/thinking-brainstorm [paste /thinking-idea output]"
- "Let's brainstorm alternatives for this concept"
- "Help me explore creative variations"

## Workflow

### Step 1: Parse Input

**Goal:** Understand what we're working with and extract the core idea.

**Process:**

**Auto-detect concept file:**

1. Check if `.project/` folder exists
   - If folder does NOT exist → check Obsidian (step 1b below)
2. Check if `.project/project.json` exists and contains a `concept` key with non-empty `content`
3. If exists AND no inline input provided:
   - Read `.project/project.json`, parse JSON, extract `concept.name` and `concept.content`
   - Show confirmation:

     ```
     CONCEPT DETECTED

     Source: .project/project.json → concept
     Title: {concept.name}

     Dit concept wordt gebruikt voor brainstorming.
     ```

   - Use AskUserQuestion:
     ```yaml
     header: "Concept Laden"
     question: "Wil je dit concept uitbreiden?"
     options:
       - label: "Ja, brainstorm hierop (Recommended)", description: "Gebruik concept uit project.json"
       - label: "Ander concept", description: "Ik wil een ander concept plakken"
       - label: "Explain question", description: "Leg uit wat dit betekent"
     multiSelect: false
     ```
   - If "Ja": proceed with loaded concept
   - If "Ander concept": ask user to paste input

**Step 1a: Scope Check**

Na de concept-detectie, check ook voor bredere scope:

1. Check of `.project/backlog.html` bestaat
2. Check of `.project/features/` mappen bevat
3. Glob voor pagina-bestanden (`app/**/page.tsx`, `src/pages/**/*.tsx`)

Als scope-context gevonden EN concept al geladen uit project.json:

```yaml
header: "Scope"
question: "Waarover wil je brainstormen?"
options:
  - label: "Concept (Recommended)", description: "Werk met concept uit project.json"
  - label: "Feature uit backlog", description: "Focus op een specifieke feature"
  - label: "Pagina / UX flow", description: "Focus op layout, UX of user flow"
  - label: "Los idee", description: "Standalone idee, niet gekoppeld aan het project"
multiSelect: false
```

**If "Feature uit backlog":**

- Lees `.project/backlog.html`, parse JSON uit `<script id="backlog-data">` blok (zie `shared/BACKLOG.md`), toon features met status TODO of DEF
- AskUserQuestion om feature te kiezen
- Laad `01-define.md` (als die bestaat) als input-context
- Laad bestaande `thinking.md` (als die bestaat) als vorige thinking output
- Geen define? Gebruik feature-beschrijving uit backlog

**If "Pagina / UX flow":**

- Glob voor pagina-bestanden in het project
- AskUserQuestion om pagina te kiezen, of laat gebruiker een UX flow beschrijven
- Laad pagina-bestand als input-context
- Check `.project/thinking/{naam}.md` voor eerdere thinking output

**If "Los idee":**

- Negeer het geladen concept — dit idee staat los van het project
- Vraag: "Beschrijf je idee in een paar zinnen"
- Check `.project/thinking/` voor eerdere losse ideeën
- Proceed to Step 2 with user's input

**Output-pad volgt automatisch de scope:**

- Scope = concept → update `concept` key in `.project/project.json`
- Scope = feature → schrijf naar `.project/features/{naam}/thinking.md`
- Scope = pagina/UX → schrijf naar `.project/thinking/{onderwerp}.md`
- Scope = los idee → schrijf naar `.project/thinking/{onderwerp}.md`

**Step 1b: Check Obsidian vault (if no concept found in project.json)**

If the user provided an inline description/argument:

1. Search Obsidian: `mcp__obsidian__search_notes(query={argument}, limit=3)`
2. If relevant match found in `Ideas/`:
   - Show: "Er is een bestaand idee in Obsidian: **{title}** (`{path}`)"
   - Use AskUserQuestion:
     ```yaml
     header: "Obsidian Match"
     question: "Wil je dit bestaande idee als startpunt gebruiken?"
     options:
       - label: "Ja, gebruik als basis (Recommended)", description: "Laad het Obsidian idee en brainstorm hierop"
       - label: "Nee, ander concept", description: "Ik wil een ander concept gebruiken"
       - label: "Chat context", description: "Gebruik het gesprek als startpunt"
     multiSelect: false
     ```
   - **If "Ja":** Read the note with `mcp__obsidian__read_note()`, load as starting concept, track `obsidian_source_path` for later save-back
   - **If "Chat context":** Process using Chat Context flow (see below)
3. If no match found:
   - Use AskUserQuestion:
     ```yaml
     header: "Input"
     question: "Waar wil je mee brainstormen?"
     options:
       - label: "Chat context gebruiken (Recommended)", description: "Gebruik wat er in dit gesprek is besproken"
       - label: "Concept plakken", description: "Plak of typ een idee/concept"
     multiSelect: false
     ```
   - If "Chat context gebruiken": process using Chat Context flow (see below)
   - If "Concept plakken": proceed to manual input below

**If no concept in project.json OR user wants different input:**

1. Examine the input provided by user
2. Determine input type:
   - Output from `/thinking-idea` (structured markdown) → extract directly
   - Concept document (PRD, design doc, project brief) → extract core idea
   - Raw idea description → use as-is
   - Unclear/vague input → ask clarifying questions

3. Analyze:
   - What is the core idea?
   - What type of idea is this? (creative concept, product, service, etc)
   - Is there enough information to start brainstorming?
   - What aspects could be explored?

4. If insufficient information:
   - Ask 2-3 targeted questions to understand the idea better
   - Use AskUserQuestion with multiSelect: true to gather responses
   - Synthesize into clear idea description

5. Confirm understanding with user via AskUserQuestion:

   ```yaml
   options:
     - label: "Ja, dit klopt (Recommended)", description: "Start met brainstormen over dit idee"
     - label: "Aanpassen", description: "Ik wil de samenvatting bijwerken"
   multiSelect: false
   ```

   Present:

   ```
   [Confirmation message that we'll brainstorm about:]

   [concise idea summary]
   ```

**Note:** This step should be quick for `/thinking-idea` output, more thorough for other inputs.

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
   question: "Klopt deze samenvatting van het gesprek?"
   options:
     - label: "Ja, klopt (Recommended)", description: "Gebruik dit als input"
     - label: "Aanpassen", description: "Ik wil de samenvatting bijwerken"
   multiSelect: false
   ```
5. If confirmed: use as input concept and proceed to Step 2
6. If "Aanpassen": ask what to change, update summary, confirm again
7. If insufficient context in conversation: inform user and fall back to manual input

### Step 2: Suggest Technique

**Goal:** Identify and rank the most relevant brainstorm techniques for this specific idea and current exploration state.

**Process:**

1. Analyze:
   - What has been explored so far? (track applied techniques)
   - What aspects of the idea need creative expansion?
   - Which unexplored directions could be valuable?
   - What type of variations would be most interesting?

2. Read `references/brainstorm-techniques.md` to review available techniques

3. Select 2-3 most relevant techniques and rank them:
   - Choose between 2-3 techniques based on relevance
   - Recommend 1-2 (after 2 techniques diminishing returns are likely)
   - Rank from most to least relevant
   - Most relevant = 1 (lowest number, at the top)
   - Least relevant = highest number (2-3)

4. Present ranked techniques (in user's preferred language):

   ```
   💡 [RELEVANT TECHNIQUES header]

   1. [Technique Name] ← [suggestion]: [1-2 sentences why most relevant]
   2. [Technique Name]
   3. [Technique Name]

   [Recommendation: 1-2 technieken is optimaal]
   ```

5. Use AskUserQuestion with technique options:

   ```yaml
   header: "Techniek"
   question: "Welke techniek wil je toepassen?"
   options:
     - label: "1. [Top Technique] (Recommended)", description: "[rationale]"
     - label: "2. [Technique 2]", description: "[brief description]"
     - label: "3. [Technique 3]", description: "[brief description]"
   multiSelect: false
   ```

   - Proceed to Step 3 with the selected technique

### Step 3: Apply Technique

**Goal:** Use the selected technique through interactive Q&A to generate creative variations and insights.

**Process:**

1. Read the full details of the selected technique from `references/brainstorm-techniques.md`

2. Analyze:
   - Understand the technique's framework
   - Formulate 4-6 specific questions based on the technique
   - Develop concrete suggestions tailored to this idea

3. Present technique application (in user's preferred language):

   ```
   🎨 [TECHNIQUE NAME]

   [1-2 sentence explanation of the technique]

   [Questions header]:
   1. [specific question based on technique approach]
   2. [specific question]
   3. [specific question]
   4. [etc, 4-6 questions total]

   [Suggestions to consider header]:
   - [concrete suggestion 1 based on technique]
   - [concrete suggestion 2]
   - [concrete suggestion 3]

   Reageer per nummer of in je eigen woorden.
   ```

4. Engage in natural dialogue — the user may:
   - Answer questions directly
   - Ask their own questions back
   - Want to go deeper on a specific point
   - Redirect the conversation to a related topic
   - Skip questions they find irrelevant
     All of this is fine. Follow the conversation naturally.
5. Continue until this technique is sufficiently explored

**Guidelines for technique application:**

- Make questions specific to THIS idea, not generic
- Generate concrete suggestions, not vague "what ifs"
- Follow the technique's framework from the reference file
- Focus on generating variations, alternatives, and new possibilities
- Push boundaries and explore unexpected directions

### Step 4: Synthesize User Input

**Goal:** Capture key insights and variations discovered through the technique.

**Process:**

1. Review the user's responses and dialogue from Step 3

2. Synthesize:
   - Key variations or alternatives generated
   - Interesting directions discovered
   - Specific elements that could be incorporated
   - Insights about the idea

3. Present synthesis (in user's preferred language):

   ```
   📋 [SUMMARY header] - [Technique Name]

   ### [Key variations discovered]
   - [variation 1]
   - [variation 2]
   - [etc]

   ### [Interesting directions]
   - [direction 1]
   - [direction 2]

   ### [Key insights]
   - [insight 1]
   - [insight 2]
   ```

4. After presenting synthesis, proceed to Step 5

### Step 5: Next Action

**Goal:** After each technique, let the user decide: apply another technique or generate the refined output.

**Process:**

1. Determine:
   - Which techniques have been applied already
   - Which unexplored techniques are most valuable now
   - How many more techniques would be beneficial

2. Re-rank 2-3 most relevant techniques based on:
   - Current exploration state
   - Applied techniques (exclude these)
   - Gaps in exploration
   - Diminishing returns consideration

3. Present options with final output at the top (in user's preferred language):

   ```
   💡 [NEXT STEP header]:

   [Already applied]: [list of techniques already used]

   Beschikbare opties:
   - Genereer verfijnde versie (eindresultaat)
   - Pas nog 1-3 extra technieken toe
   ```

4. If no relevant techniques remain (all applied or none relevant):
   - Skip presenting options
   - Proceed directly to Step 6 (Generate Final Output)
   - Announce (in user's preferred language): "[All relevant techniques applied. Generating refined version now.]"

5. Use AskUserQuestion with next action options:

   ```yaml
   header: "Volgende Stap"
   question: "Hoe wil je verder?"
   options:
     - label: "Genereer verfijnde versie (Recommended)", description: "Creëer het eindresultaat met alle inzichten"
     - label: "[Technique 1]", description: "[rationale - most relevant remaining technique]"
     - label: "[Technique 2]", description: "[brief description]"
   multiSelect: false
   ```

   - If "Genereer verfijnde versie": proceed to Step 6
   - If a technique selected: go to Step 3 for that technique, then back to Step 5 after

### Step 6: Generate Final Output

**Goal:** Create the refined idea as a clean, structured markdown document.

**Process:**

1. Review all insights and variations from all applied techniques

2. Integrate:
   - The most valuable variations and insights
   - Maintain coherence while incorporating improvements
   - Structure the refined idea clearly
   - Decide which elements to include based on what strengthens the idea

3. Generate refined idea document:
   - Use same structure as original input (or improve if needed)
   - Incorporate valuable variations and insights
   - Keep it as a standalone idea document
   - **DO NOT include:** original idea, technique names, comparison to old version, changelog
   - **ONLY output:** the refined idea itself

4. Output format:
   - Pure markdown, no framing text
   - No "Here's your refined idea:" or similar
   - Wrap output in a code block with `markdown` language tag for copy button
   - Clean, consistent formatting

**Example output structure:**

```
# [Title - possibly evolved]

[Short description - refined]

## Core Concept

[Enhanced concept incorporating insights...]

## [Section 1]

[Refined content...]

## [Section 2]

[Content with integrated variations...]
```

### Step 7: Output Destination

After generating the refined content, determine output destination based on scope.

**If scope = feature of pagina (uit Step 1a):**

Sla automatisch op bij de scope-locatie:

- Scope = feature → schrijf naar `.project/features/{naam}/thinking.md`
- Scope = pagina/UX → maak `.project/thinking/` aan indien nodig, schrijf naar `.project/thinking/{onderwerp}.md`

```
THINKING OUTPUT SAVED

File: {output-pad}
Scope: {feature:{naam} | pagina:{onderwerp}}
Applied techniques: {list of techniques used}
```

**Dashboard sync — thinking log** (zie `shared/DASHBOARD.md`):

1. Read `.project/project.json` (skip als niet bestaat)
2. Schrijf volledige markdown naar `.project/thinking/{today}-brainstorm-{slug}.md`
3. Push naar `thinking` array:
   ```json
   {
     "type": "brainstorm",
     "date": "{today}",
     "title": "{onderwerp van de brainstorm}",
     "summary": "{key insight, max 200 chars}",
     "file": ".project/thinking/{today}-brainstorm-{slug}.md",
     "variants": ["{variant 1}", "{variant 2}", "..."],
     "chosen": "{gekozen variant}",
     "source": "/thinking-brainstorm"
   }
   ```
4. Write `.project/project.json`

Vraag daarna optioneel:

```yaml
header: "Concept"
question: "Wil je dit ook toevoegen aan project.json concept?"
options:
  - label: "Nee (Recommended)", description: "Output is opgeslagen bij de scope"
  - label: "Ja, ook naar concept", description: "Update ook concept in project.json"
multiSelect: false
```

If "Ja": lees `.project/project.json` (of maak aan), update `concept.name`, `concept.pitch` (eerste alinea, 1-2 zinnen) en `concept.content` met de refined content, schrijf terug.

**If scope = los idee (uit Step 1a):**

Sla op naar `.project/thinking/{today}-brainstorm-{slug}.md`:

1. Maak `.project/thinking/` aan indien nodig
2. Schrijf naar `.project/thinking/{today}-brainstorm-{slug}.md`

```
THINKING OUTPUT SAVED

File: .project/thinking/{today}-brainstorm-{slug}.md
Scope: los idee
Applied techniques: {list of techniques used}
```

**Dashboard sync — thinking log** (zie `shared/DASHBOARD.md`):

1. Read `.project/project.json` (skip als niet bestaat)
2. Push naar `thinking` array (file is al geschreven hierboven):
   ```json
   {
     "type": "brainstorm",
     "date": "{today}",
     "title": "{onderwerp van de brainstorm}",
     "summary": "{key insight, max 200 chars}",
     "file": ".project/thinking/{today}-brainstorm-{slug}.md",
     "variants": ["{variant 1}", "{variant 2}", "..."],
     "chosen": "{gekozen variant}",
     "source": "/thinking-brainstorm"
   }
   ```
3. Write `.project/project.json`

Vraag daarna:

```yaml
header: "Obsidian"
question: "Wil je dit idee ook opslaan naar Obsidian?"
options:
  - label: "Nee (Recommended)", description: "Output is opgeslagen in .project/thinking/"
  - label: "Ja, naar Obsidian", description: "Sla ook op als Idea note in Obsidian vault"
multiSelect: false
```

If "Ja, naar Obsidian": volg de Obsidian save flow (zie hieronder bij "Opslaan naar Obsidian").

**If scope = concept (default) of geen scope gekozen:**

Use AskUserQuestion:

```yaml
header: "Output"
question: "Wat wil je met het uitgebreide concept doen?"
options:
  - label: "Opslaan naar concept (Recommended)", description: "Update concept in project.json met uitgebreide versie"
  - label: "Opslaan naar Obsidian", description: "Opslaan als permanente Idea note in je Obsidian vault"
  - label: "Kopieer naar clipboard", description: "Kopieer markdown naar clipboard (niet opslaan)"
multiSelect: false
```

**If "Opslaan naar concept":**

1. Read `.project/project.json` (or create `{}` if not exists), parse JSON
2. Set `concept.name` to the title of the refined idea, `concept.pitch` to de eerste alinea (1-2 zinnen), `concept.content` to the full refined markdown content
3. Write updated JSON back to `.project/project.json`
4. Confirm:

   ```
   CONCEPT UPDATED

   File: .project/project.json → concept
   Applied techniques: {list of techniques used}

   Next steps:
   - /thinking-critique - Kritisch analyseren en versterken
   - /thinking-brainstorm - Nog een brainstormronde
   - /dev-plan - Omzetten naar web feature backlog
   - /game-backlog - Omzetten naar feature backlog (voor games)
   ```

**Dashboard sync — concept thinking** (zie `shared/DASHBOARD.md`):

1. Read `.project/project.json` (skip als niet bestaat)
2. Schrijf volledige markdown naar `.project/thinking/{today}-brainstorm-{slug}.md`
3. Push naar `concept.thinking` array (initialiseer als `[]` indien nodig):
   ```json
   {
     "type": "brainstorm",
     "date": "{today}",
     "title": "{onderwerp van de brainstorm}",
     "summary": "{key insight, max 200 chars}",
     "file": ".project/thinking/{today}-brainstorm-{slug}.md",
     "variants": ["{variant 1}", "{variant 2}", "..."],
     "chosen": "{gekozen variant}",
     "source": "/thinking-brainstorm"
   }
   ```
4. Write `.project/project.json`

**If "Opslaan naar Obsidian":**

1. Also update `concept` in `.project/project.json` (so other skills can pick it up) — set `concept.name`, `concept.pitch` (eerste alinea) en `concept.content`
2. If concept was loaded from Obsidian (tracked via `obsidian_source_path`):
   - Overwrite: `mcp__obsidian__write_note(path=obsidian_source_path, content=..., mode="overwrite")`
   - Update frontmatter status to `developing` via `mcp__obsidian__update_frontmatter()`
3. If new concept (no Obsidian source):
   - Detect category from content (game/app/story/website/other)
   - Map to path: `Ideas/Games/`, `Ideas/Apps/`, `Ideas/Stories/`, `Ideas/Websites/`, `Ideas/Other/`
   - Add frontmatter: `type: idea, category: {cat}, status: developing, created: {date}`
   - Write: `mcp__obsidian__write_note(path="Ideas/{subfolder}/{title}.md")`
4. Update Home.md: `mcp__obsidian__patch_note(path="Home.md", oldString="## Recent Ideas\n", newString="## Recent Ideas\n- [[{title}]]\n")`
5. Confirm:

   ```
   CONCEPT SAVED TO OBSIDIAN

   File: Ideas/{subfolder}/{title}.md
   Status: developing
   Applied techniques: {list}

   Next steps:
   - /thinking-critique - Kritisch analyseren en versterken
   - /thinking-brainstorm - Nog een brainstormronde
   - /dev-plan - Omzetten naar web feature backlog
   - /game-backlog - Omzetten naar feature backlog (voor games)
   ```

**If "Kopieer naar clipboard":**

1. Wrap output in a code block with `markdown` language tag for copy button
2. Display the content — user copies via the code block's copy button

---

## Best Practices

**Input Parsing:**

- Be flexible - accept various input formats
- Quick for `/thinking-idea` output, thorough for unclear input
- Don't make assumptions - ask when unclear

**Technique Selection:**

- Show 2-3 most relevant techniques (between 2-3 based on how many are truly relevant)
- Recommend 1-2; after 2 techniques diminishing returns are likely
- Rank techniques with numbers: 1 = most relevant (at the top), higher numbers = less relevant
- Consider what's been explored already (especially in Step 5)
- Personalize suggestions to the specific idea
- Make the number 1 suggestion compelling with clear rationale

**Technique Application:**

- Make questions specific, not generic
- Generate concrete suggestions tailored to this idea
- Follow the technique's framework from reference file
- Push for unexpected directions and variations
- Make variations actionable, not vague

**Flow Efficiency:**

- No AskUserQuestion between technique presentation and user response — just prompt and wait
- After each technique's synthesis, always go to Step 5 for the user to decide next action
- One technique at a time: select → apply → synthesize → decide to continue or not

**Conversational Flexibility:**

- The user can ask questions, go deeper, or redirect at any point during technique application
- Don't force rigid question-answer structure — follow the natural conversation
- Let the user skip questions they don't find relevant

**Synthesis:**

- Capture the essence of what was discovered
- Be specific about variations and insights
- Don't lose valuable ideas in the synthesis

**Final Output:**

- Output ONLY the refined idea document
- NO original idea comparison
- NO technique information
- NO changelog or "what changed"
- Make it look like a fresh, standalone idea document
- Integrate improvements naturally

**Conversational Approach:**

- Be exploratory and curious
- Encourage wild ideas and boundary pushing
- Build on user's creative energy
- Keep dialogue natural and flowing — let user elaborate, redirect, or ask questions freely
- Track progress through techniques
- Enable quick flow with numbered choices (user just types a number)
- Respect user's choice even if different from suggestion
- The technique provides structure, not a straitjacket

## Technical Notes

**Reference file usage:**

- Read `references/brainstorm-techniques.md` when suggesting techniques
- Read specific technique details when applying that technique
- Use technique frameworks as guidance, not rigid templates

**State tracking:**

- Track which techniques have been applied
- Remember key insights from each technique
- Build cumulative understanding through the session

**Flow control:**

- One technique at a time: Step 2 → Step 3 → Step 4 → Step 5 → repeat or finish
- Track: techniques_applied (list of completed techniques)

### Terminal Formatting

- NEVER use blockquote syntax (`>`) for displaying content — causes unreadable white background in dark terminals
- NEVER use inline code backticks for emphasis on regular words — use **bold** or plain text
- Backticks only for actual code, file paths, and command references

### Language

Follow the Language Policy in CLAUDE.md.
