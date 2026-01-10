---
description: Articulate and develop ideas through guided questions into structured markdown
---

# Idea

Develop ideas from initial concept to structured output through targeted questions and synthesis. Works with any type of idea—creative concepts (games, stories, art), product ideas (apps, services, businesses), or other conceptual work.

The output is a structured markdown document that can be used as input for `/brainstorm` or `/critique`.

## When to Use

- User starts with `/idea` (with or without description)
- User has a vague concept that needs articulation
- User wants to develop a game, story, product, app, service, or creative project concept

## Process

### Step 1: Initial Intake

**Auto-detect existing concept:**
1. Check if `.workspace/` folder exists
   - If folder does NOT exist → skip to "If no concept file" section below
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

**If no concept file OR user wants new concept:**

**If no description provided:**
Ask (in user's preferred language): "What is your idea? Describe it in 1-2 sentences."

**If description provided:**
Acknowledge briefly and proceed to Step 2.

### Step 2: Explore and Expand

1. Determine idea type (creative concept, product, service, etc)
2. Use sequential thinking to formulate 3-5 targeted questions
3. Number each question (1., 2., 3., etc) for easy reference
4. Present all questions at once using AskUserQuestion:
   ```yaml
   options:
     - label: "Beantwoord vragen (Recommended)", description: "Typ je antwoorden in het tekstveld"
     - label: "Minder vragen", description: "Stel minder vragen tegelijk"
     - label: "Explain question", description: "Leg uit waarom deze vragen relevant zijn"
   multiSelect: false
   ```
5. Based on answers, formulate follow-up questions if needed (restart numbering from 1 for each new batch)
6. Continue until the core idea is sufficiently developed

**Focus areas:**
- Core concept and unique elements
- Target audience or intended experience
- Key features, mechanics, or narrative elements
- Tone, style, or atmosphere
- What makes this idea distinctive
- Context and constraints

**Question guidelines:**
- Ask for concrete details, not abstract concepts
- Adapt style to idea type (game vs product vs story)
- Help articulate what's in the user's head
- Save criticism or expansion for later—this phase is pure idea capture

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
  - label: "Alleen tonen", description: "Toon als markdown code block (niet opslaan)"
  - label: "Explain question", description: "Leg uit wat deze opties betekenen"
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
   - /game:backlog - Omzetten naar feature backlog (voor games)
   ```

**If "Alleen tonen":**
1. Wrap output in a code block with `markdown` language tag for copy button
2. Display the content

---

## Best Practices

**Questions:** Be conversational, adapt dynamically, dig deeper where user shows excitement, extract vision without imposing constraints.

**Synthesis:** Be accurate to what user said, don't add assumptions, confirm before proceeding.

**Output:** Structure clearly, make scannable, adapt sections to idea type, output ONLY the markdown document.

### Language
Follow the Language Policy in CLAUDE.md.