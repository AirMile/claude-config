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

   ```
   💡 Analyse Technieken

   Welke technieken wil je toepassen?
   ```

   ```yaml
   header: "Analyse Technieken"
   question: "Welke technieken wil je toepassen?"
   options:
     - label: "[Best Technique] (Aanbevolen)", description: "[1-2 zinnen waarom dit de beste keuze is]"
     - label: "[Technique 2]", description: "[1 zin waarom relevant]"
     - label: "[Technique 3]", description: "[1 zin waarom relevant]"
     - label: "[Technique 4]", description: "[1 zin waarom relevant]"
   multiSelect: true
   ```

6. Process user selection:
   - If technique(s) selected: proceed to Step 3 with selected technique(s)
   - If multiple selected: apply techniques sequentially (Step 3 → Step 4 loop)

**Note:**

- Only show techniques that are actually relevant to this specific idea
- Maximum 4 techniques in the options
- If fewer than 3 relevant techniques available, show all available techniques
- "Reeds toegepast" techniques should NOT appear in the options
- First option is always the recommended technique (add "(Aanbevolen)" to label)

### Step 3: Apply Technique

**Goal:** Use the selected technique through interactive Q&A to identify weaknesses, test assumptions, and find problems.

**Process:**

1. Read the full details of the selected technique from the appropriate reference file

2. Use sequential thinking to:
   - Understand the technique's framework
   - Formulate 4-6 specific questions based on the technique
   - Develop concrete concerns or points to examine tailored to this idea

3. Present technique application (in user's preferred language):

   ```
   🔍 [TECHNIQUE NAME]

   [1-2 sentence explanation of the technique]

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

4. Process user responses
5. Engage in natural dialogue if user has follow-up questions
6. Continue until this technique is sufficiently explored

**Guidelines for technique application:**

- Make questions specific to THIS idea, not generic
- Identify real problems, not just surface-level concerns
- Follow the technique's framework from the reference file
- Use sequential thinking to deeply analyze from that perspective
- Be rigorous - apply technical and practical scrutiny
- Challenge assumptions rather than accepting them
- Push for concrete solutions or decisions

### Step 4: Synthesize & Auto-Proceed

**Goal:** Capture key weaknesses, assumptions, and insights discovered through the technique, then continue.

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

4. Auto-proceed:
   - If more selected techniques remain: proceed immediately to Step 3 for the next technique
   - If all selected techniques are done: proceed to Step 5
   - Note: user can always interrupt if synthesis needs adjustment

### Step 5: Next Action

**Goal:** Present remaining relevant techniques and suggest the best next one. Only shown after ALL techniques selected in Step 2 are complete.

**Important:** This step is only reached after ALL techniques selected in Step 2 have been applied. When the user selected multiple techniques, apply Steps 3-4 in sequence for each without showing Step 5 between them.

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
     - label: "Uitleg", description: "Leg de opties uit"
   multiSelect: true
   ```

4. Process user selection:
   - If only "Genereer verfijnde versie" selected: proceed to Step 6
   - If technique(s) selected: apply them in sequence (Steps 3-4), then return to Step 5

**Note:**

- Only show techniques that are relevant AND haven't been applied yet
- Maximum 2 techniques in the options (+ "Genereer verfijnde versie" + "Uitleg")
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

After generating the refined content, present options for what to do with it.

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

**Response handling:**

**If "Opslaan naar concept":**

1. Update `.workspace/concept.md` with refined content
2. Confirm:

   ```
   CONCEPT UPDATED

   File: .workspace/concept.md
   Applied techniques: {list of techniques used}

   Next steps:
   - /thinking:brainstorm - Creatief uitbreiden en variaties
   - /thinking:critique - Nog een analyseronde
   - /dev:plan - Omzetten naar web feature backlog
   - /game:backlog - Omzetten naar feature backlog (voor games)
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
   - /thinking:brainstorm - Creatief uitbreiden en variaties
   - /thinking:critique - Nog een analyseronde
   - /dev:plan - Omzetten naar web feature backlog
   - /game:backlog - Omzetten naar feature backlog (voor games)
   ```

**If "Alleen tonen":**

1. Wrap output in a code block with `markdown` language tag for copy button
2. Display the content

---

## Best Practices

**Flow Efficiency:**

- No AskUserQuestion between technique presentation and user response - just prompt and wait
- No confirmation gate after synthesis - auto-proceed to next technique
- Apply selected techniques in sequence without returning to Step 5 between them
- Only 2 interaction gates in the whole technique loop: initial selection (Step 2) and final decision (Step 5)

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
- Minimize friction: present and let user respond, no response mode gates
- Keep dialogue natural - let user elaborate or redirect freely

**Final Output:**

- Output ONLY the refined idea document
- NO original idea comparison
- NO technique information
- NO changelog or "what changed"
- Make it look like a fresh, standalone idea document
- Integrate improvements naturally
