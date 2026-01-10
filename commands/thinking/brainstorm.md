---
description: Creatively expand ideas through interactive technique application. Generates variations, explores alternatives, pushes boundaries. Outputs refined idea as structured markdown
---

## Overview

This skill helps creatively expand and explore ideas through interactive application of brainstorming techniques. It works with any type of concept input - whether from `/idea`, existing documents, or other sources - and guides you through technique-by-technique exploration with questions and suggestions.

The process is interactive: apply one technique at a time through Q&A, then choose to explore another technique or generate your final refined idea. The output is a clean markdown document of the refined idea, ready to use.

## When to Use

Trigger this skill when:
- User wants to explore variations and alternatives of an idea
- User wants to push boundaries and discover new possibilities
- User has an idea and wants creative expansion
- User starts with `/brainstorm` command

Example triggers:
- "/brainstorm" (followed by pasting idea)
- "/brainstorm [paste /idea output]"
- "Let's brainstorm alternatives for this concept"
- "Help me explore creative variations"

## Workflow

### Step 1: Parse Input

**Goal:** Understand what we're working with and extract the core idea.

**Process:**

**Auto-detect concept file:**
1. Check if `.workspace/` folder exists
   - If folder does NOT exist → skip to "If no concept file" section below
2. Check if `.workspace/concept.md` exists
3. If exists AND no inline input provided:
   - Read the concept file
   - Show confirmation:
     ```
     CONCEPT DETECTED

     File: .workspace/concept.md
     Title: {extracted title}

     Dit concept wordt gebruikt voor brainstorming.
     ```
   - Use AskUserQuestion:
     ```yaml
     header: "Concept Laden"
     question: "Wil je dit concept uitbreiden?"
     options:
       - label: "Ja, brainstorm hierop (Recommended)", description: "Gebruik .workspace/concept.md"
       - label: "Ander concept", description: "Ik wil een ander concept plakken"
       - label: "Explain question", description: "Leg uit wat dit betekent"
     multiSelect: false
     ```
   - If "Ja": proceed with loaded concept
   - If "Ander concept": ask user to paste input

**If no concept file OR user wants different input:**
1. Examine the input provided by user
2. Determine input type:
   - Output from `/idea` (structured markdown) → extract directly
   - Concept document (PRD, design doc, project brief) → extract core idea
   - Raw idea description → use as-is
   - Unclear/vague input → ask clarifying questions

3. Use sequential thinking to analyze:
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
     - label: "Uitleg", description: "Leg uit wat deze stap betekent"
   multiSelect: false
   ```

   Present:
   ```
   [Confirmation message that we'll brainstorm about:]

   > [concise idea summary]
   ```

**Note:** This step should be quick for `/idea` output, more thorough for other inputs.

### Step 2: Suggest Technique

**Goal:** Identify and rank the most relevant brainstorm techniques for this specific idea and current exploration state.

**Process:**
1. Use sequential thinking to analyze:
   - What has been explored so far? (track applied techniques)
   - What aspects of the idea need creative expansion?
   - Which unexplored directions could be valuable?
   - What type of variations would be most interesting?

2. Read `resources/brainstorm-techniques.md` to review available techniques

3. Select 3-5 most relevant techniques and rank them:
   - Choose between 3-5 techniques based on relevance
   - Rank from most to least relevant
   - Most relevant = 1 (lowest number, at the top)
   - Least relevant = highest number (3-5)

4. Present ranked techniques (in user's preferred language):
   ```
   💡 [RELEVANT TECHNIQUES header]

   1. [Technique Name] ← [suggestion]: [1-2 sentences why most relevant]
   2. [Technique Name]
   3. [Technique Name]
   4. [Technique Name]
   5. [Technique Name]

   [Select 1-3 techniques to apply in sequence]
   ```

5. Use AskUserQuestion with technique options:
   ```yaml
   header: "Technieken"
   question: "Welke technieken wil je toepassen? (max 3)"
   options:
     - label: "1. [Top Technique] (Recommended)", description: "[rationale]"
     - label: "2. [Technique 2]", description: "[brief description]"
     - label: "3. [Technique 3]", description: "[brief description]"
     - label: "4. [Technique 4]", description: "[brief description]"
     - label: "5. [Technique 5]", description: "[brief description]"
     - label: "Uitleg", description: "Leg de technieken uit"
   multiSelect: true
   ```
   - If user selects multiple techniques: apply them in sequence (Steps 3-4 for each)
   - After all selected techniques are applied: proceed to Step 5

### Step 3: Apply Technique

**Goal:** Use the selected technique through interactive Q&A to generate creative variations and insights.

**Process:**
1. Read the full details of the selected technique from `resources/brainstorm-techniques.md`

2. Use sequential thinking to:
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

   [Answer the questions and/or respond to suggestions]
   ```

4. Use AskUserQuestion to gather input:
   ```yaml
   options:
     - label: "Beantwoord vragen (Recommended)", description: "Typ je antwoorden op de vragen"
     - label: "Suggesties bespreken", description: "Reageer op de concrete suggesties"
     - label: "Beide", description: "Beantwoord vragen en bespreek suggesties"
     - label: "Uitleg", description: "Leg deze techniek verder uit"
   multiSelect: false
   ```
5. Engage in natural dialogue if user has follow-up questions
6. Continue until this technique is sufficiently explored

**Guidelines for technique application:**
- Make questions specific to THIS idea, not generic
- Generate concrete suggestions, not vague "what ifs"
- Follow the technique's framework from the reference file
- Use sequential thinking to explore deeply
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

4. Use AskUserQuestion to confirm synthesis:
   ```yaml
   header: "Samenvatting"
   question: "Klopt deze samenvatting?"
   options:
     - label: "Ja, klopt (Recommended)", description: "Ga door naar de volgende stap"
     - label: "Aanpassen", description: "Ik wil iets toevoegen of wijzigen"
     - label: "Uitleg", description: "Leg uit wat er samengevat is"
   multiSelect: false
   ```
5. Adjust if needed based on user feedback

### Step 5: Next Action

**Goal:** Decide whether to explore another technique or generate the final refined idea.

**Process:**
1. Use sequential thinking to determine:
   - Which techniques have been applied already
   - Which unexplored techniques are most valuable now
   - How many more techniques would be beneficial

2. Re-rank 3-5 most relevant techniques based on:
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
     - label: "[Technique 3]", description: "[brief description]"
     - label: "Uitleg", description: "Leg de opties uit"
   multiSelect: true
   ```
   - If only "Genereer verfijnde versie" selected: proceed to Step 6 (Generate Final Output)
   - If technique(s) selected: apply them in sequence (Steps 3-4), then return to Step 5

### Step 6: Generate Final Output

**Goal:** Create the refined idea as a clean, structured markdown document.

**Process:**
1. Review all insights and variations from all applied techniques

2. Use sequential thinking to:
   - Integrate the most valuable variations and insights
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

After generating the refined content, present options for what to do with it.

Use AskUserQuestion:
```yaml
header: "Output"
question: "Wat wil je met het uitgebreide concept doen?"
options:
  - label: "Opslaan naar concept (Recommended)", description: "Update .workspace/concept.md met uitgebreide versie"
  - label: "Alleen tonen", description: "Toon als markdown code block (niet opslaan)"
  - label: "Explain question", description: "Leg uit wat deze opties betekenen"
multiSelect: false
```

**Response handling:**

**If "Opslaan naar concept":**
1. Update `.workspace/concept.md` with refined content
2. Confirm:
   ```
   CONCEPT UPDATED

   File: .workspace/concept.md
   Applied techniques: {list of techniques used}

   Next steps:
   - /thinking:critique - Kritisch analyseren en versterken
   - /thinking:brainstorm - Nog een brainstormronde
   - /game:backlog - Omzetten naar feature backlog (voor games)
   ```
3. Send notification:
   ```bash
   powershell -ExecutionPolicy Bypass -File .claude/scripts/notify.ps1 -Title "Claude Code" -Message "Concept updated"
   ```

**If "Alleen tonen":**
1. Wrap output in a code block with `markdown` language tag for copy button
2. Display the content
3. Send notification:
   ```bash
   powershell -ExecutionPolicy Bypass -File .claude/scripts/notify.ps1 -Title "Claude Code" -Message "Brainstorm complete"
   ```

---

## Best Practices

**Input Parsing:**
- Be flexible - accept various input formats
- Quick for `/idea` output, thorough for unclear input
- Don't make assumptions - ask when unclear

**Technique Selection:**
- Always use sequential thinking to choose most relevant techniques
- Show 3-5 most relevant techniques (between 3-5 based on how many are truly relevant)
- Rank techniques with numbers: 1 = most relevant (at the top), higher numbers = less relevant
- Consider what's been explored already (especially in Step 5)
- Personalize suggestions to the specific idea
- Make the number 1 suggestion compelling with clear rationale

**Technique Application:**
- Make questions specific, not generic
- Generate concrete suggestions tailored to this idea
- Follow the technique's framework from reference file
- Use sequential thinking to explore deeply
- Push for unexpected directions and variations
- Make variations actionable, not vague

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
- Keep dialogue natural and flowing
- Track progress through techniques
- Enable quick flow with numbered choices (user just types a number)
- Respect user's choice even if different from suggestion

## Technical Notes

**Reference file usage:**
- Read `resources/brainstorm-techniques.md` when suggesting techniques
- Read specific technique details when applying that technique
- Use technique frameworks as guidance, not rigid templates

**State tracking:**
- Track which techniques have been applied
- Remember key insights from each technique
- Build cumulative understanding through the session

**Sequential thinking usage:**
- Use for input analysis (Step 1)
- Use for technique selection (Step 2)
- Use for technique application (Step 3)
- Use for final output generation (Step 6)

### Language
Follow the Language Policy in CLAUDE.md.