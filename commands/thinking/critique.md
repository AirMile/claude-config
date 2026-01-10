---
description: Critically analyze ideas through structured techniques
---

## Overview

This skill helps critically analyze and strengthen ideas through interactive application of analysis techniques. It works with any type of concept input - whether from `/idea`, existing documents, or other sources - and guides you through technique-by-technique analysis with questions and suggestions.

The process is interactive: apply one technique at a time through Q&A, then choose to explore another technique or generate your final refined idea. The output is a clean markdown document of the refined idea, ready to use.

## When to Use

Trigger this skill when:
- User wants to identify weaknesses or problems in an idea
- User wants to test assumptions and find failure modes
- User has an idea and wants critical analysis
- User starts with `/critique` command

Example triggers:
- "/critique" (followed by pasting idea)
- "/critique [paste /idea output]"
- "Let's critically analyze this concept"
- "Help me find weaknesses in this idea"
- "Test the assumptions in this proposal"

## Workflow

### Step 1: Parse Input

**Goal:** Understand what we're analyzing and extract the core idea.

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

     Dit concept wordt gebruikt voor analyse.
     ```
   - Use AskUserQuestion:
     ```yaml
     header: "Concept Laden"
     question: "Wil je dit concept analyseren?"
     options:
       - label: "Ja, analyseer dit (Recommended)", description: "Gebruik .workspace/concept.md"
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

**Note:** This step should be quick for `/idea` output, more thorough for other inputs.

### Step 2: Determine Idea Type & Load Relevant Techniques

**Goal:** Analyze the idea type and identify which technique categories are relevant.

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

4. Use sequential thinking to filter techniques:
   - For each technique, determine if it's actually relevant to THIS specific idea
   - Remove techniques that don't apply (e.g., Narrative for non-narrative games)
   - Only keep techniques that will provide meaningful analysis
   - If more than 5 relevant techniques, select only the top 5 for Step 3

5. Proceed directly to Step 3

### Step 3: Suggest Technique

**Goal:** Present only relevant techniques in ranked order and suggest the best one.

**Process:**
1. Use sequential thinking to rank ONLY relevant techniques (filtered in Step 2):
   - Which technique will reveal the most critical weaknesses?
   - What aspects are most important to examine for THIS specific idea?
   - Which techniques have been applied already? (exclude those)
   - Rank from most relevant (1) to least relevant
   - If more than 5 relevant techniques available, select only the top 5

2. Present technique selection using AskUserQuestion (in user's preferred language):
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
     - label: "[Technique 5]", description: "[1 zin waarom relevant]"
     - label: "Leg uit", description: "Uitleg over de technieken"
   multiSelect: true
   ```

3. Process user selection:
   - If technique(s) selected: proceed to Step 4 with selected technique(s)
   - If multiple selected: apply techniques sequentially (Step 4 → Step 5 → repeat)
   - If "Leg uit" selected: explain the techniques and present selection again

**Note:**
- Only show techniques that are actually relevant to this specific idea
- Maximum 5 techniques in the options (if more available, show only top 5)
- If fewer than 3 relevant techniques available, show all available techniques
- "Reeds toegepast" techniques should NOT appear in the options
- First option is always the recommended technique (add "(Aanbevolen)" to label)

### Step 4: Apply Technique

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

   ```
   Use AskUserQuestion to guide response:
   ```yaml
   options:
     - label: "Answer all questions (Recommended)", description: "Provide responses to the technique questions"
     - label: "Focus on specific question", description: "Address one question in depth"
     - label: "Discuss points of attention", description: "Respond to the identified concerns"
     - label: "Explain question", description: "Explain what this means"
   multiSelect: false
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

### Step 5: Synthesize User Input

**Goal:** Capture key weaknesses, assumptions, and insights discovered through the technique.

**Process:**
1. Review the user's responses and dialogue from Step 4

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

4. Ask for confirmation using AskUserQuestion (in user's preferred language):
   ```yaml
   header: "Samenvatting Bevestigen"
   question: "Klopt deze samenvatting?"
   options:
     - label: "Ja, klopt (Aanbevolen)", description: "Ga door naar de volgende stap"
     - label: "Aanpassing nodig", description: "Geef aan welk item moet worden aangepast (bijv. 1.2 of 2.1)"
     - label: "Leg uit", description: "Uitleg over de samenvatting structuur"
   multiSelect: false
   ```

5. If "Aanpassing nodig" selected:
   - User can specify item number (e.g., "1.2 klopt niet" or "2.1 moet anders")
   - Adjust specific items based on user feedback
   - Present updated summary and confirm again

### Step 6: Next Action

**Goal:** Present remaining relevant techniques and suggest the best next one.

**Process:**
1. Use sequential thinking to rank remaining relevant techniques:
   - Which techniques haven't been applied yet AND are relevant?
   - What weaknesses still need examination?
   - Which technique would add most value now?
   - Rank from most relevant (1) to least relevant
   - If more than 4 relevant techniques available, select only the top 4

2. Present next action selection using AskUserQuestion (in user's preferred language):
   ```
   💡 Volgende Stap

   Reeds toegepast: [list of techniques used]

   Wat wil je nu doen?
   ```
   ```yaml
   header: "Volgende Stap"
   question: "Wat wil je nu doen?"
   options:
     - label: "[Best Technique] (Aanbevolen)", description: "[1-2 zinnen waarom dit de beste volgende stap is]"
     - label: "[Technique 2]", description: "[1 zin waarom relevant]"
     - label: "[Technique 3]", description: "[1 zin waarom relevant]"
     - label: "[Technique 4]", description: "[1 zin waarom relevant]"
     - label: "Eindresultaat genereren", description: "Sluit analyse af en genereer de verfijnde versie"
     - label: "Leg uit", description: "Uitleg over de beschikbare opties"
   multiSelect: true
   ```

3. If no relevant techniques remain (all applied or none relevant):
   - Skip presenting technique options
   - Proceed directly to Step 7 (Generate Final Output)
   - Announce (in user's preferred language): "Alle relevante technieken zijn toegepast. Verfijnde versie wordt nu gegenereerd."

4. Process user selection:
   - If technique(s) selected: return to Step 4 with selected technique(s)
   - If multiple selected: apply techniques sequentially (Step 4 → Step 5 → repeat)
   - If "Eindresultaat genereren" selected: proceed to Step 7
   - If "Leg uit" selected: explain options and present selection again

**Note:**
- Only show techniques that are relevant AND haven't been applied yet
- Maximum 4 techniques in the options (+ "Eindresultaat genereren" + "Leg uit")
- If fewer than 3 relevant techniques available, show all available techniques
- First technique option is always the recommended one (add "(Aanbevolen)" to label)

### Step 7: Generate Final Output

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

### Step 8: Output Destination

After generating the refined content, present options for what to do with it.

Use AskUserQuestion:
```yaml
header: "Output"
question: "Wat wil je met het verfijnde concept doen?"
options:
  - label: "Opslaan naar concept (Recommended)", description: "Update .workspace/concept.md met verfijnde versie"
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
   - /thinking:brainstorm - Creatief uitbreiden en variaties
   - /thinking:critique - Nog een analyseronde
   - /game:backlog - Omzetten naar feature backlog (voor games)
   ```

**If "Alleen tonen":**
1. Wrap output in a code block with `markdown` language tag for copy button
2. Display the content
