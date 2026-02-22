---
name: thinking-critique
description: Critically analyze ideas through structured techniques from multiple perspectives. Use with /thinking-critique to stress-test concepts before committing to implementation.
disable-model-invocation: true
metadata:
  author: mileszeilstra
  version: 1.0.0
  category: thinking
---

## Overview

This skill helps critically analyze and strengthen ideas through interactive application of analysis techniques. It works with any type of concept input - whether from `/thinking-idea`, existing documents, or other sources - and guides you through technique-by-technique analysis with questions and suggestions.

The process is interactive: apply one technique at a time through Q&A, then choose to explore another technique or generate your final refined idea. The output is a clean markdown document of the refined idea, ready to use.

## When to Use

Trigger this skill when:

- User wants to identify weaknesses or problems in an idea
- User wants to test assumptions and find failure modes
- User has an idea and wants critical analysis
- User starts with `/thinking-critique` command

Example triggers:

- "/critique" (followed by pasting idea)
- "/thinking-critique [paste /thinking-idea output]"
- "Let's critically analyze this concept"
- "Help me find weaknesses in this idea"
- "Test the assumptions in this proposal"

## Workflow

### Step 1: Parse Input

**Goal:** Understand what we're analyzing and extract the core idea.

**Process:**

**Auto-detect concept file:**

1. Check if `.workspace/` folder exists
   - If folder does NOT exist → check Obsidian (step 1b below)
2. Check if `.workspace/concept.md` exists
3. If exists AND no inline input provided:
   - Read the concept file
   - Show confirmation:

     ```
     CONCEPT DETECTED

     File: .workspace/concept.md
     Title: {extracted title}

     Dit concept wordt gebruikt voor analyse.
     ```

   - Use AskUserQuestion:
     ```yaml
     header: "Concept Laden"
     question: "Wil je dit concept analyseren?"
     options:
       - label: "Ja, analyseer dit (Recommended)", description: "Gebruik .workspace/concept.md"
       - label: "Ander concept", description: "Ik wil een ander concept plakken"
       - label: "Chat context", description: "Analyseer wat er in dit gesprek is besproken"
       - label: "Explain question", description: "Leg uit wat dit betekent"
     multiSelect: false
     ```
   - If "Ja": proceed with loaded concept
   - If "Ander concept": ask user to paste input
   - If "Chat context": process using Chat Context flow (see below)

**Step 1a: Scope Check**

Na de concept-detectie, check ook voor bredere scope:

1. Check of `.workspace/backlog.html` bestaat
2. Check of `.workspace/features/` mappen bevat
3. Glob voor pagina-bestanden (`app/**/page.tsx`, `src/pages/**/*.tsx`)

Als scope-context gevonden EN concept.md al geladen:

```yaml
header: "Scope"
question: "Waarover wil je analyseren?"
options:
  - label: "Concept (Recommended)", description: "Werk met .workspace/concept.md"
  - label: "Feature uit backlog", description: "Focus op een specifieke feature"
  - label: "Pagina / UX flow", description: "Focus op layout, UX of user flow"
  - label: "Chat context", description: "Gebruik het gesprek als input"
multiSelect: false
```

**If "Feature uit backlog":**

- Lees `.workspace/backlog.html`, parse JSON uit `<script id="backlog-data">` blok (zie `shared/BACKLOG.md`), toon features met status TODO of DEF
- AskUserQuestion om feature te kiezen
- Laad `01-define.md` (als die bestaat) als input-context
- Laad bestaande `thinking.md` (als die bestaat) als vorige thinking output
- Geen define? Gebruik feature-beschrijving uit backlog

**If "Pagina / UX flow":**

- Glob voor pagina-bestanden in het project
- AskUserQuestion om pagina te kiezen, of laat gebruiker een UX flow beschrijven
- Laad pagina-bestand als input-context
- Check `.workspace/thinking/{naam}.md` voor eerdere thinking output

**Output-pad volgt automatisch de scope:**

- Scope = concept → schrijf naar `.workspace/concept.md`
- Scope = feature → schrijf naar `.workspace/features/{naam}/thinking.md`
- Scope = pagina/UX → maak `.workspace/thinking/` aan indien nodig, schrijf naar `.workspace/thinking/{onderwerp}.md`

**Step 1b: Check Obsidian vault (if no .workspace/concept.md found)**

If the user provided an inline description/argument:

1. Search Obsidian: `mcp__obsidian__search_notes(query={argument}, limit=3)`
2. If relevant match found in `Ideas/`:
   - Show: "Er is een bestaand idee in Obsidian: **{title}** (`{path}`)"
   - Use AskUserQuestion:
     ```yaml
     header: "Obsidian Match"
     question: "Wil je dit bestaande idee als startpunt gebruiken?"
     options:
       - label: "Ja, gebruik als basis (Recommended)", description: "Laad het Obsidian idee en analyseer het"
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
     question: "Wat wil je analyseren?"
     options:
       - label: "Chat context gebruiken (Recommended)", description: "Gebruik wat er in dit gesprek is besproken"
       - label: "Concept plakken", description: "Plak of typ een idee/concept"
     multiSelect: false
     ```
   - If "Chat context gebruiken": process using Chat Context flow (see below)
   - If "Concept plakken": proceed to manual input below

**If no concept file OR user wants different input:**

1. Examine the input provided by user
2. Determine input type:
   - Output from `/thinking-idea` (structured markdown) → extract directly
   - Concept document (PRD, design doc, project brief) → extract core idea
   - Raw idea description → use as-is
   - Unclear/vague input → ask clarifying questions

3. Check for previously applied techniques:
   - Look for YAML frontmatter at the start of the input
   - If `applied_techniques:` found, extract the list
   - Store these techniques to filter them out in Steps 3 and 6
   - Example frontmatter to detect:
     ```yaml
     ---
     applied_techniques:
       - Devil's Advocate Analysis
       - Assumption Testing
     ---
     ```
   - If no frontmatter found: start with empty list

4. Use sequential thinking to analyze:
   - What is the core idea?
   - What type of idea is this? (creative concept, product, service, etc)
   - Is there enough information to start analysis?
   - What aspects could be analyzed?
   - What assumptions are visible?

5. If insufficient information:
   - Ask 2-3 targeted questions to understand the idea better using AskUserQuestion:
     ```yaml
     options:
       - label: "[Most likely interpretation] (Recommended)", description: "Based on context clues"
       - label: "[Alternative interpretation]", description: "If the idea is about..."
       - label: "Explain question", description: "Explain what this means"
     multiSelect: false
     ```
   - Synthesize responses into clear idea description

6. Confirm understanding with user using AskUserQuestion (in user's preferred language):

   ```
   [Confirmation message that we'll analyze:]

   > [concise idea summary]

   Type: [creative concept / product / service / etc]
   ```

   ```yaml
   options:
     - label: "Correct, start analysis (Recommended)", description: "Begin with technique selection"
     - label: "Adjust summary", description: "Let me refine the idea description"
     - label: "Add more context", description: "I have additional details to share"
     - label: "Explain question", description: "Explain what this means"
   multiSelect: false
   ```

7. Process user selection before proceeding

**Note:** This step should be quick for `/thinking-idea` output, more thorough for other inputs.

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

### Step 2: Determine Type & Select Techniques

**Goal:** Analyze the idea type, load relevant techniques, and let the user select which to apply.

**Process:**

1. Use sequential thinking to determine:
   - Is this a creative concept? (game, story, art, music, interactive experience)
   - Is this a product idea? (app, service, business, SaaS, platform)
   - Is this hybrid? (both creative and product aspects)

2. Based on idea type, determine relevant technique files:
   - Always relevant: `references/universal-techniques.md` (4 techniques)
   - If creative or hybrid: also `references/creative-techniques.md` (5 techniques)
   - If product or hybrid: also `references/product-techniques.md` (7 techniques)

3. Read the relevant reference files

4. Use sequential thinking to filter and rank techniques:
   - For each technique, determine if it's actually relevant to THIS specific idea
   - Remove techniques that don't apply (e.g., Narrative for non-narrative games)
   - Which technique will reveal the most critical weaknesses?
   - Which techniques have been applied already? (exclude those)
   - Rank from most relevant (1) to least relevant
   - If more than 5 relevant techniques, select only the top 5

5. Present technique selection using AskUserQuestion (in user's preferred language):

   ```yaml
   header: "Analyse Techniek"
   question: "Welke techniek wil je toepassen?"
   options:
     - label: "[Best Technique] (Aanbevolen)", description: "[1-2 zinnen waarom dit de beste keuze is]"
     - label: "[Technique 2]", description: "[1 zin waarom relevant]"
     - label: "[Technique 3]", description: "[1 zin waarom relevant]"
     - label: "[Technique 4]", description: "[1 zin waarom relevant]"
   multiSelect: false
   ```

6. Process user selection: proceed to Step 3 with the selected technique

**Note:**

- Only show techniques that are actually relevant to this specific idea
- Maximum 4 techniques in the options
- If fewer than 3 relevant techniques available, show all available techniques
- "Reeds toegepast" techniques should NOT appear in the options
- First option is always the recommended technique (add "(Aanbevolen)" to label)
- Single select: user picks 1 technique, applies it, then decides whether to continue (Step 5)

### Step 3: Apply Technique

**Goal:** Use the selected technique through interactive Q&A to identify weaknesses, test assumptions, and find problems.

**Process:**

1. Read the full details of the selected technique from the appropriate reference file

2. **Context7 Research (when technical questions arise):**
   - If the technique raises technical questions (feasibility, implementation, constraints, performance), research first before asking the user
   - Use `mcp__context7__resolve-library-id` to find relevant libraries/frameworks mentioned in the idea
   - Use `mcp__context7__query-docs` to look up specific technical details, constraints, or best practices
   - Use the research findings to make your questions more concrete, informed, and targeted
   - Example: instead of "Is this technically feasible?", ask "Library X supports Y but has limitation Z — how do you want to handle that?"

3. Use sequential thinking to:
   - Understand the technique's framework
   - Incorporate Context7 research findings into your analysis
   - Formulate 4-6 specific questions based on the technique
   - Develop concrete concerns or points to examine tailored to this idea

4. Present technique application (in user's preferred language):

   ```
   🔍 [TECHNIQUE NAME]

   [1-2 sentence explanation of the technique]

   [If Context7 research was done: brief summary of key findings]

   [Questions header]:
   1. [specific question based on technique approach]
   2. [specific question]
   3. [specific question]
   4. [etc, 4-6 questions total]

   [Points of attention header]:
   1. [concrete point 1 based on technique]
   2. [concrete point 2]
   3. [concrete point 3]

   Reageer per nummer of in je eigen woorden.
   ```

5. Process user responses
6. Engage in natural dialogue — the user may:
   - Answer questions directly
   - Ask their own questions back
   - Want to go deeper on a specific point
   - Redirect the conversation to a related topic
   - Skip questions they find irrelevant
     All of this is fine. Follow the conversation naturally.
7. If the user asks a technical question during dialogue, use Context7 to research it before responding
8. Continue until this technique is sufficiently explored

**Guidelines for technique application:**

- Make questions specific to THIS idea, not generic
- Identify real problems, not just surface-level concerns
- Follow the technique's framework from the reference file
- Use sequential thinking to deeply analyze from that perspective
- Be rigorous - apply technical and practical scrutiny
- Challenge assumptions rather than accepting them
- Push for concrete solutions or decisions
- If the user asks a technical question you can't answer well, use Context7 to research it before responding

### Step 4: Synthesize

**Goal:** Capture key weaknesses, assumptions, and insights discovered through the technique.

**Process:**

1. Review the user's responses and dialogue from Step 3

2. Synthesize:
   - Key weaknesses or problems identified
   - Assumptions that need attention
   - Risks discovered
   - Potential improvements or solutions discussed

3. Present synthesis (in user's preferred language):

   ```
   📋 [SUMMARY header] - [Technique Name]

   ### [Identified problems]
   1.1 [problem 1]
   1.2 [problem 2]

   ### [Weak assumptions]
   2.1 [assumption 1]
   2.2 [assumption 2]

   ### [Possible improvements]
   3.1 [improvement 1]
   3.2 [improvement 2]

   ### [Key insights]
   4.1 [insight 1]
   4.2 [insight 2]
   ```

4. After presenting synthesis, proceed to Step 5

### Step 5: Next Action

**Goal:** After each technique, let the user decide: apply another technique or generate the refined output.

**Process:**

1. Use sequential thinking to rank remaining relevant techniques:
   - Which techniques haven't been applied yet AND are relevant?
   - What weaknesses still need examination?
   - Which technique would add most value now?
   - Rank from most relevant (1) to least relevant

2. If no relevant techniques remain (all applied or none relevant):
   - Skip presenting options
   - Proceed directly to Step 6 (Generate Final Output)
   - Announce (in user's preferred language): "Alle relevante technieken zijn toegepast. Verfijnde versie wordt nu gegenereerd."

3. Present next action selection using AskUserQuestion (in user's preferred language):

   ```
   💡 Volgende Stap

   Reeds toegepast: [list of techniques used]
   ```

   ```yaml
   header: "Volgende Stap"
   question: "Hoe wil je verder?"
   options:
     - label: "Genereer verfijnde versie (Recommended)", description: "Creëer het eindresultaat met alle inzichten"
     - label: "[Technique 1]", description: "[rationale - most relevant remaining technique]"
     - label: "[Technique 2]", description: "[brief description]"
   multiSelect: false
   ```

4. Process user selection:
   - If "Genereer verfijnde versie": proceed to Step 6
   - If a technique selected: go to Step 3 for that technique, then back to Step 5 after

**Note:**

- Only show techniques that are relevant AND haven't been applied yet
- Maximum 2 techniques in the options (+ "Genereer verfijnde versie")
- First option is always "Genereer verfijnde versie (Recommended)"

### Step 6: Generate Final Output

**Goal:** Create the refined idea as a clean, structured markdown document.

**Process:**

1. Review all weaknesses, assumptions, and improvements from all applied techniques

2. Use sequential thinking to:
   - Address identified problems
   - Strengthen weak assumptions
   - Incorporate improvements and solutions
   - Maintain coherence while making idea more robust
   - Structure the refined idea clearly
   - Decide which changes to integrate based on what strengthens the idea

3. Generate refined idea document:
   - Use same structure as original input (or improve if needed)
   - Incorporate fixes for identified problems
   - Address weak assumptions
   - Strengthen weak areas
   - Keep it as a standalone idea document
   - **DO NOT include:** original idea, technique names, comparison to old version, changelog, list of problems found
   - **ONLY output:** the refined idea itself

4. Output format:
   - Pure markdown, no framing text
   - No "Here's your refined idea:" or similar
   - Proper markdown formatting (# for title, ## for sections)

**Example output structure:**

```yaml
---
applied_techniques:
  - Devil's Advocate Analysis
  - Assumption Testing
---
```

### Step 7: Output Destination

After generating the refined content, determine output destination based on scope.

**If scope = feature of pagina (uit Step 1a):**

Sla automatisch op bij de scope-locatie:

- Scope = feature → schrijf naar `.workspace/features/{naam}/thinking.md`
- Scope = pagina/UX → maak `.workspace/thinking/` aan indien nodig, schrijf naar `.workspace/thinking/{onderwerp}.md`

```
THINKING OUTPUT SAVED

File: {output-pad}
Scope: {feature:{naam} | pagina:{onderwerp}}
Applied techniques: {list of techniques used}
```

Vraag daarna optioneel:

```yaml
header: "Concept"
question: "Wil je dit ook toevoegen aan concept.md?"
options:
  - label: "Nee (Recommended)", description: "Output is opgeslagen bij de scope"
  - label: "Ja, ook naar concept", description: "Update ook .workspace/concept.md"
multiSelect: false
```

If "Ja": schrijf ook naar `.workspace/concept.md`.

**If scope = concept (default) of geen scope gekozen:**

Use AskUserQuestion:

```yaml
header: "Output"
question: "Wat wil je met het verfijnde concept doen?"
options:
  - label: "Opslaan naar concept (Recommended)", description: "Update .workspace/concept.md met verfijnde versie"
  - label: "Opslaan naar Obsidian", description: "Opslaan als permanente Idea note in je Obsidian vault"
  - label: "Alleen tonen", description: "Toon als markdown code block (niet opslaan)"
multiSelect: false
```

**If "Opslaan naar concept":**

1. Update `.workspace/concept.md` with refined content
2. Confirm:

   ```
   CONCEPT UPDATED

   File: .workspace/concept.md
   Applied techniques: {list of techniques used}

   Next steps:
   - /thinking-brainstorm - Creatief uitbreiden en variaties
   - /thinking-critique - Nog een analyseronde
   - /dev-plan - Omzetten naar web feature backlog
   - /game-backlog - Omzetten naar feature backlog (voor games)
   ```

**If "Opslaan naar Obsidian":**

1. Also update `.workspace/concept.md` (so other skills can pick it up)
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
   - /thinking-brainstorm - Creatief uitbreiden en variaties
   - /thinking-critique - Nog een analyseronde
   - /dev-plan - Omzetten naar web feature backlog
   - /game-backlog - Omzetten naar feature backlog (voor games)
   ```

**If "Alleen tonen":**

1. Wrap output in a code block with `markdown` language tag for copy button
2. Display the content

---

## Best Practices

**Flow Efficiency:**

- No AskUserQuestion between technique presentation and user response — just prompt and wait
- After each technique's synthesis, always go to Step 5 for the user to decide next action
- One technique at a time: select → apply → synthesize → decide to continue or not

**Conversational Flexibility:**

- The user can ask questions, go deeper, or redirect at any point during technique application
- Don't force rigid question-answer structure — follow the natural conversation
- If the user asks a technical question, research it via Context7 before answering
- Let the user skip questions they don't find relevant

**Technique Application:**

- Make questions specific to THIS idea, not generic
- Identify real problems, not just surface-level concerns
- Follow the technique's framework from the reference file
- Use sequential thinking to deeply analyze from that perspective
- Be rigorous - apply technical and practical scrutiny
- Challenge assumptions rather than accepting them
- Push for concrete solutions or decisions

**Synthesis:**

- Capture key weaknesses, assumptions, and insights
- Be specific about problems and improvements
- Don't lose valuable insights in the synthesis

**Conversational Approach:**

- Enable quick flow with numbered responses
- Minimize friction: present and let user respond naturally
- Keep dialogue natural — let user elaborate, redirect, or ask questions freely
- The technique provides structure, not a straitjacket

**Final Output:**

- Output ONLY the refined idea document
- NO original idea comparison
- NO technique information
- NO changelog or "what changed"
- Make it look like a fresh, standalone idea document
- Integrate improvements naturally
