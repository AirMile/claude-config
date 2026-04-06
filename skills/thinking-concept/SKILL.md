---
name: thinking-concept
description: Develop and maintain project concepts through guided questions, structured synthesis, and project sync. Use with /thinking-concept for new ideas or to enrich existing concepts from backlog/codebase.
disable-model-invocation: true
metadata:
  author: mileszeilstra
  version: 1.1.0
  category: thinking
---

# Concept

Develop ideas from initial concept to structured output through targeted questions and synthesis. Works with any type of idea--creative concepts (games, stories, art), product ideas (apps, services, businesses), or other conceptual work. Can also sync existing concepts with the current project state (backlog, codebase).

The output is a structured markdown document that can be used as input for `/thinking-brainstorm` or `/thinking-critique`.

## When to Use

- User starts with `/thinking-concept` (with or without description)
- User has a vague concept that needs articulation
- User wants to develop a game, story, product, app, service, or creative project concept

## Process

### Step 1: Initial Intake

**Auto-detect existing concept:**

1. Check if `.project/` folder exists
   - If folder does NOT exist → proceed to Step 1b (source selection)
2. Check if `.project/project-concept.md` exists (primary) or `.project/project.json` has non-empty `concept.content` (legacy fallback)
3. If concept exists AND no inline description provided:
   - Read `.project/project-concept.md` for the full concept document. Extract title from first H1 heading.
   - Show confirmation:

     ```
     EXISTING CONCEPT DETECTED

     Source: .project/project-concept.md
     Title: {concept title from H1}

     Er bestaat al een concept.
     ```

   - Use AskUserQuestion:
     ```yaml
     header: "Bestaand Concept"
     question: "Wat wil je doen?"
     options:
       - label: "Bewerken (Recommended)", description: "Pas het bestaande concept aan"
       - label: "Sync met project", description: "Verrijk concept met wat er al gebouwd/gepland is"
       - label: "Nieuw concept", description: "Begin opnieuw met een nieuw idee"
       - label: "Explain question", description: "Leg uit wat dit betekent"
     multiSelect: false
     ```
   - **If "Bewerken":**
     - Load existing concept
     - Ask: "Wat wil je aanpassen aan dit concept?"
     - Proceed to Step 2 with existing content as context
   - **If "Sync met project":**
     - Proceed to Step 1c (Project Sync)
   - **If "Nieuw concept":**
     - Ignore existing file (will be overwritten on save)
     - Proceed with normal flow below

**Step 1a: Scope Check**

Na de concept-detectie, check ook voor bredere scope:

1. Check of `.project/backlog.html` bestaat
2. Check of `.project/features/` mappen bevat
3. Glob voor pagina-bestanden (`app/**/page.tsx`, `src/pages/**/*.tsx`)

Als scope-context gevonden EN project.json concept al geladen:

```yaml
header: "Scope"
question: "Waarover wil je nadenken?"
options:
  - label: "Concept (Recommended)", description: "Werk met project.json concept"
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

- Scope = concept → schrijf naar `.project/project-concept.md` + update project.json metadata (name, pitch)
- Scope = feature → schrijf naar `.project/features/{naam}/thinking.md`
- Scope = pagina/UX → schrijf naar `.project/thinking/{onderwerp}.md`
- Scope = los idee → schrijf naar `.project/thinking/{onderwerp}.md`

**Step 1c: Project Sync (if "Sync met project" chosen)**

Enrich the existing concept with features/functionality that exist in the project but are not yet described in the concept document.

**1. Gather project state:**

- Read existing concept from `.project/project-concept.md`
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
question: "Welke items wil je aan het concept toevoegen?"
options:
  - label: "Alle gaps (Recommended)", description: "Voeg alle {count} ontbrekende items toe"
  - label: "Selecteer items", description: "Kies per item wat je wil toevoegen"
  - label: "Geen, alleen bekijken", description: "Sluit sync af zonder wijzigingen"
multiSelect: false
```

**If "Selecteer items":** show each gap as a separate AskUserQuestion with multiSelect: true.

**If "Geen":** show the analysis as informational output and end.

**4. Integrate into concept:**

- For each selected gap, draft a section or bullet point that fits naturally into the existing concept structure
- Show the updated concept as a diff preview (new sections marked)
- Ask for confirmation before writing:

```yaml
header: "Concept Update"
question: "Concept bijwerken met de geselecteerde items?"
options:
  - label: "Ja, update concept (Recommended)", description: "Schrijf het bijgewerkte concept"
  - label: "Aanpassen", description: "Pas de integratie aan voordat je schrijft"
multiSelect: false
```

**5. Write updated concept:**

- Write to `.project/project-concept.md`
- Update project.json metadata (concept.name, concept.pitch) if changed
- Log to `concept.thinking` array:
  ```json
  {
    "type": "sync",
    "date": "{today}",
    "title": "Project sync",
    "summary": "Added {count} items from backlog/codebase to concept",
    "file": ".project/thinking/{today}-sync-{slug}.md",
    "source": "/thinking-concept"
  }
  ```
- Write sync summary to `.project/thinking/{today}-sync-{slug}.md`

```
CONCEPT SYNCED

Added: {count} items
Source: {backlog: X, codebase: Y}
File: .project/project-concept.md

Next steps:
- /thinking-critique - Analyseer het bijgewerkte concept
- /thinking-brainstorm - Brainstorm over de nieuwe onderdelen
```

**Step 1b: Source selection (if no concept found)**

**If no description provided:**

Use AskUserQuestion:

```yaml
header: "Bron"
question: "Waar wil je beginnen?"
options:
  - label: "Chat context gebruiken (Recommended)", description: "Gebruik wat er in dit gesprek is besproken als startpunt"
  - label: "Nieuw idee typen", description: "Beschrijf een nieuw idee"
  - label: "Obsidian zoeken", description: "Zoek een bestaand idee in je Obsidian vault"
multiSelect: false
```

**If "Chat context gebruiken":**

Process using Chat Context flow (see below).

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
3. If no matches anywhere: acknowledge briefly and proceed to Step 2.

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

### Step 2: Explore and Expand

Develop the idea through rounds of concrete, clickable questions. Rounds are suggestions — the user decides when there's enough context.

**Setup:**

1. Determine idea type (creative concept, product, service, etc)
2. Plan questions for the first round

**Ronde 1 - Fundament (3-4 vragen parallel):**

Formulate 3-4 fundamental questions about the idea. Present ALL questions in a single message, each as a separate AskUserQuestion:

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

**Note:** The examples above are templates. Every question and option MUST be specific to THIS idea. Derive concrete, relevant options from the idea context.

**After each round**, use AskUserQuestion:

```yaml
header: "Verdieping"
question: "Wil je nog meer aspecten uitwerken?"
options:
  - label: "Nog een ronde (Recommended)", description: "Verdiep nog meer aspecten van het idee"
  - label: "Door naar samenvatting", description: "Er is genoeg context voor een goed concept"
multiSelect: false
```

- **If "Nog een ronde":** formulate 2-4 targeted follow-up questions based on gaps from previous rounds
- **If "Door naar samenvatting":** proceed to Step 3

**Follow-up round focus areas:**

- Features/mechanics specifics
- Differentiatie (what makes it unique)
- Style/atmosphere/tone
- Motivation system or engagement model
- Any direction the user showed interest in

**Conversational flexibility:**

The user may respond to questions in unexpected ways — asking their own questions, going deeper on one specific topic, or skipping questions entirely. Follow the conversation naturally. The rounds provide structure, not a rigid script.

**Further rounds:**

Same pattern: present the "Verdieping" AskUserQuestion after each round. As rounds progress, switch the recommended option to "Door naar samenvatting" when enough context has been gathered (typically after 2-3 rounds).

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

### CHECKPOINT: Idee Samenvatting

Na de vraagrondes, presenteer een gestructureerd overzicht van alle verzamelde input voordat de synthese begint:

| Aspect       | Waarde                                  |
| ------------ | --------------------------------------- |
| Onderwerp    | {idee titel/onderwerp}                  |
| Scope        | {concept / feature / pagina / los idee} |
| Doelgroep    | {uit ronde 1}                           |
| Kernervaring | {uit ronde 1}                           |
| Verdiepingen | {samenvatting van follow-up rondes}     |

Vraag via AskUserQuestion: "Klopt dit overzicht voordat we samenvatten?"

- "Ga door naar samenvatting (Recommended)" — door naar synthese
- "Nog een ronde" — terug naar Step 2 voor extra vragen
- "Aanpassen" — corrigeer specifiek punt

### Step 3: Synthesize and Confirm

1. Create a concise summary based on all input
2. Present summary to user
3. Use AskUserQuestion for confirmation:
   ```yaml
   options:
     - label: "Klopt, genereer output (Recommended)", description: "Samenvatting is correct, ga door naar markdown output"
     - label: "Aanpassen", description: "Ik wil iets wijzigen of toevoegen"
     - label: "Opnieuw samenvatten", description: "Maak een nieuwe samenvatting"
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

After generating the markdown content, determine output destination based on scope.

**If scope = feature of pagina (uit Step 1a):**

Sla automatisch op bij de scope-locatie:

- Scope = feature → schrijf naar `.project/features/{naam}/thinking.md`
- Scope = pagina/UX → maak `.project/thinking/` aan indien nodig, schrijf naar `.project/thinking/{onderwerp}.md`

```
THINKING OUTPUT SAVED

File: {output-pad}
Scope: {feature:{naam} | pagina:{onderwerp}}
```

**Dashboard sync — thinking log** (zie `shared/DASHBOARD.md`):

1. Read `.project/project.json` (skip als niet bestaat)
2. Schrijf volledige markdown naar `.project/thinking/{today}-idea-{slug}.md`
3. Push naar `thinking` array:
   ```json
   {
     "type": "idea",
     "date": "{today}",
     "title": "{concept titel}",
     "summary": "{key insight, max 200 chars}",
     "file": ".project/thinking/{today}-idea-{slug}.md",
     "source": "/thinking-concept"
   }
   ```
4. Write `.project/project.json`

Vraag daarna optioneel:

```yaml
header: "Concept"
question: "Wil je dit ook opslaan als project concept?"
options:
  - label: "Nee (Recommended)", description: "Output is opgeslagen bij de scope"
  - label: "Ja, ook naar concept", description: "Update ook project-concept.md"
multiSelect: false
```

If "Ja": Write het volledige concept document als plain markdown naar `.project/project-concept.md`. Update ook project.json: Read `.project/project.json` (of maak aan met {}), set `concept.name` (H1 titel), `concept.pitch` (eerste alinea, 1-2 zinnen), `concept.conceptFile = "project-concept.md"`. Verwijder `concept.content` als die bestaat (gemigreerd naar .md). Write terug.

**If scope = los idee (uit Step 1a):**

Sla op naar `.project/thinking/{today}-idea-{slug}.md`:

1. Maak `.project/thinking/` aan indien nodig
2. Schrijf naar `.project/thinking/{today}-idea-{slug}.md`

```
THINKING OUTPUT SAVED

File: .project/thinking/{today}-idea-{slug}.md
Scope: los idee
```

**Dashboard sync — thinking log** (zie `shared/DASHBOARD.md`):

1. Read `.project/project.json` (skip als niet bestaat)
2. Push naar `thinking` array (file is al geschreven hierboven):
   ```json
   {
     "type": "idea",
     "date": "{today}",
     "title": "{concept titel}",
     "summary": "{key insight, max 200 chars}",
     "file": ".project/thinking/{today}-idea-{slug}.md",
     "source": "/thinking-concept"
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
question: "Wat wil je met het concept doen?"
options:
  - label: "Opslaan naar concept (Recommended)", description: "Opslaan naar project-concept.md voor verder gebruik"
  - label: "Opslaan naar Obsidian", description: "Opslaan als permanente Idea note in je Obsidian vault"
  - label: "Kopieer naar clipboard", description: "Kopieer markdown naar clipboard (niet opslaan)"
multiSelect: false
```

**If "Opslaan naar concept":**

1. Create `.project/` folder if it doesn't exist
2. Write het volledige concept document als plain markdown naar `.project/project-concept.md`
3. Update ook project.json: Read `.project/project.json` (of maak aan met `{}`), set `concept.name` (H1 titel), `concept.pitch` (eerste alinea, 1-2 zinnen), `concept.conceptFile = "project-concept.md"`. Verwijder `concept.content` als die bestaat (gemigreerd naar .md). Write terug.
4. Confirm:

   ```
   CONCEPT SAVED

   File: .project/project-concept.md
   Name: {concept.name}

   Next steps:
   - /thinking-critique - Kritisch analyseren en versterken
   - /thinking-brainstorm - Creatief uitbreiden en variaties
   - /dev-plan - Omzetten naar web feature backlog
   - /game-backlog - Omzetten naar feature backlog (voor games)
   ```

**Dashboard sync — concept thinking** (zie `shared/DASHBOARD.md`):

1. Read `.project/project.json` (skip als niet bestaat)
2. Schrijf volledige markdown naar `.project/thinking/{today}-idea-{slug}.md`
3. Push naar `concept.thinking` array (initialiseer als `[]` indien nodig):
   ```json
   {
     "type": "idea",
     "date": "{today}",
     "title": "{concept titel}",
     "summary": "{key insight, max 200 chars}",
     "file": ".project/thinking/{today}-idea-{slug}.md",
     "source": "/thinking-concept"
   }
   ```
4. Write `.project/project.json`

**If "Opslaan naar Obsidian":**

1. Also save concept: Write het volledige concept document naar `.project/project-concept.md`. Update `.project/project.json` (of maak aan met `{}`): set `concept.name`, `concept.pitch` (eerste alinea), `concept.conceptFile = "project-concept.md"`. Verwijder `concept.content` als die bestaat.
2. Detect category from content:
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
   - /thinking-critique - Kritisch analyseren en versterken
   - /thinking-brainstorm - Creatief uitbreiden en variaties
   - /dev-plan - Omzetten naar web feature backlog
   - /game-backlog - Omzetten naar feature backlog (voor games)
   ```

**If "Kopieer naar clipboard":**

1. Wrap output in a code block with `markdown` language tag for copy button
2. Display the content — user copies via the code block's copy button

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

### Terminal Formatting

- NEVER use blockquote syntax (`>`) for displaying content — causes unreadable white background in dark terminals
- NEVER use inline code backticks for emphasis on regular words — use **bold** or plain text
- Backticks only for actual code, file paths, and command references

### Language

Follow the Language Policy in CLAUDE.md.
