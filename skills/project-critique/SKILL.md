---
name: project-critique
description: Stress-test concepts via multi-perspective analysis. Use with /project-critique.
reads:
  [
    concept.seed,
    backlog.status,
    feature.seedDrift,
    backlog.seedDrift,
    project.thinking,
  ]
writes: [concept.seed, project.thinking, feature.seedDrift, backlog.seedDrift]
metadata:
  author: claude-config
  version: 1.1.0
  category: project
---

## Overview

This skill helps critically analyze and strengthen ideas through interactive application of analysis techniques. It works with any type of concept input - whether from `/project-seed`, existing documents, or other sources - and guides you through technique-by-technique analysis with questions and suggestions.

The process is interactive: apply one technique at a time through Q&A, then choose to explore another technique or generate your final refined idea. The output is a clean markdown document of the refined idea, ready to use.

## When to Use

Trigger this skill when:

- User wants to identify weaknesses or problems in an idea
- User wants to test assumptions and find failure modes
- User has an idea and wants critical analysis
- User starts with `/project-critique` command

Example triggers:

- "/critique" (followed by pasting idea)
- "/project-critique [paste /project-seed output]"
- "Let's critically analyze this concept"
- "Help me find weaknesses in this idea"
- "Test the assumptions in this proposal"

## Workflow

### Step 1: Parse Input

**Goal:** Understand what we're analyzing and extract the core idea.

> **Todo**: Read `.claude/skills/shared/INPUT-PARSING.md` — use **critique variant** (action = "analyze", includes applied-techniques check and 3-option confirm). Follow all sections in order.

### Enter Plan Mode

Follow [shared/PLAN-MODE.md](../shared/PLAN-MODE.md) Entry protocol before Step 2. Steps 2-6 run in plan mode; the refined output (Step 6) is written to the plan file for review. Context7 research works normally in plan mode.

---

### Step 2: Determine Type & Select Techniques

**Goal:** Analyze the idea type, load relevant techniques, and let the user select which to apply.

**Process:**

1. Determine:
   - Is this a creative concept? (game, story, art, music, interactive experience)
   - Is this a product idea? (app, service, business, SaaS, platform)
   - Is this hybrid? (both creative and product aspects)

2. Based on idea type, determine relevant technique files:
   - Always relevant: `references/universal-techniques.md` (4 techniques)
   - If creative or hybrid: also `references/creative-techniques.md` (5 techniques)
   - If product or hybrid: also `references/product-techniques.md` (7 techniques)

3. Read the relevant reference files

4. Filter and rank techniques:
   - For each technique, determine if it's actually relevant to THIS specific idea
   - Remove techniques that don't apply (e.g., Narrative for non-narrative games)
   - Which technique will reveal the most critical weaknesses?
   - Which techniques have been applied already? (exclude those)
   - Rank from most relevant (1) to least relevant
   - If more than 5 relevant techniques, select only the top 5

5. Present technique selection using AskUserQuestion (in user's preferred language):

   ```yaml
   header: "Analysis Technique"
   question: "Which technique do you want to apply?"
   options:
     - label: "[Best Technique] (Recommended)", description: "[1-2 sentences why this is the best choice]"
     - label: "[Technique 2]", description: "[1 sentence why relevant]"
     - label: "[Technique 3]", description: "[1 sentence why relevant]"
     - label: "[Technique 4]", description: "[1 sentence why relevant]"
   multiSelect: false
   ```

6. Process user selection: proceed to Step 3 with the selected technique

**Note:**

- Only show techniques that are actually relevant to this specific idea
- Maximum 4 techniques in the options
- If fewer than 3 relevant techniques available, show all available techniques
- Already applied techniques should NOT appear in the options
- First option is always the recommended technique (add "(Recommended)" to label)
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

3. Analyze:
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

   Respond by number or in your own words.
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

1. Rank remaining relevant techniques:
   - Which techniques haven't been applied yet AND are relevant?
   - What weaknesses still need examination?
   - Which technique would add most value now?
   - Rank from most relevant (1) to least relevant

2. If no relevant techniques remain (all applied or none relevant):
   - Skip presenting options
   - Proceed directly to Step 6 (Generate Final Output)
   - Announce (in user's preferred language): "All relevant techniques have been applied. Generating refined version now."

3. Present next action selection using AskUserQuestion (in user's preferred language):

   ```
   💡 Next Step

   Already applied: [list of techniques used]
   ```

   ```yaml
   header: "Next Step"
   question: "How do you want to continue?"
   options:
     - label: "Generate refined version (Recommended)", description: "Create the final result with all insights"
     - label: "[Technique 1]", description: "[rationale - most relevant remaining technique]"
     - label: "[Technique 2]", description: "[brief description]"
   multiSelect: false
   ```

4. Process user selection:
   - If "Generate refined version": proceed to Step 6
   - If a technique selected: go to Step 3 for that technique, then back to Step 5 after

**Note:**

- Only show techniques that are relevant AND haven't been applied yet
- Maximum 2 techniques in the options (+ "Generate refined version")
- First option is always "Generate refined version (Recommended)"

### Step 6: Generate Final Output

**Goal:** Create the refined idea as a clean, structured markdown document.

**Process:**

1. Review all weaknesses, assumptions, and improvements from all applied techniques

2. Analyze and integrate:
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

**End of thinking phase**: follow [shared/PLAN-MODE.md](../shared/PLAN-MODE.md) Exit protocol — write the refined idea document to the plan file, then `ExitPlanMode`. After approval the skill continues with Step 7 (output destination and `.project/` writes).

### Step 7: Output Destination

After generating the refined content, determine output destination based on scope.

**If scope = feature or page (from Step 1a):**

Save automatically to the scope location:

- Scope = feature → write to `.project/features/{name}/thinking.md`
- Scope = page/UX → create `.project/thinking/` if needed, write to `.project/thinking/{topic}.md`

```
THINKING OUTPUT SAVED

File: {output-path}
Scope: {feature:{name} | page:{topic}}
Applied techniques: {list of techniques used}
```

**Dashboard sync — thinking log** (see `shared/DASHBOARD.md`):

1. Read `.project/project.json` (skip if not present)
2. Write full markdown to `.project/thinking/{today}-critique-{slug}.md`
3. Push to `thinking` array:
   ```json
   {
     "type": "critique",
     "date": "{today}",
     "title": "Critique: {topic}",
     "summary": "{key insight, max 200 chars}",
     "file": ".project/thinking/{today}-critique-{slug}.md",
     "source": "/project-critique"
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

If "Yes": Write the full concept document as plain markdown to `.project/project-seed.md`. Also update project.json: Read `.project/project.json` (or create with {}), set `seed.name` (H1 title), `seed.pitch` (first paragraph, 1-2 sentences), `seed.seedFile = "project-seed.md"`. Remove `seed.content` if it exists (migrated to .md). Write back.

Then reconcile drift: if `accumulatedDrift[]` is non-empty, remove those entries from their source arrays (from each `feature.json#seedDrift[]` and from `backlog.html#data.seedDrift[]`). Log: `Reconciled {N} drift item(s) from {sources}.`

**If scope = standalone idea (from Step 1a):**

Save to `.project/thinking/{today}-critique-{slug}.md`:

1. Create `.project/thinking/` if needed
2. Write to `.project/thinking/{today}-critique-{slug}.md`

```
THINKING OUTPUT SAVED

File: .project/thinking/{today}-critique-{slug}.md
Scope: standalone idea
Applied techniques: {list of techniques used}
```

**Dashboard sync — thinking log** (see `shared/DASHBOARD.md`):

1. Read `.project/project.json` (skip if not present)
2. Push to `thinking` array (file already written above):
   ```json
   {
     "type": "critique",
     "date": "{today}",
     "title": "Critique: {topic}",
     "summary": "{key insight, max 200 chars}",
     "file": ".project/thinking/{today}-critique-{slug}.md",
     "source": "/project-critique"
   }
   ```
3. Write `.project/project.json`

**If scope = concept (default) or no scope chosen:**

Use AskUserQuestion:

```yaml
header: "Output"
question: "What do you want to do with the refined concept?"
options:
  - label: "Save to concept (Recommended)", description: "Update project-seed.md with refined version"
  - label: "Copy to clipboard", description: "Copy markdown to clipboard (don't save)"
multiSelect: false
```

**If "Save to concept":**

1. Write the full refined concept document as plain markdown to `.project/project-seed.md`
2. Also update project.json: Read `.project/project.json` (or create with `{}`), set `seed.name` (title from refined content), `seed.pitch` (first paragraph, 1-2 sentences), `seed.seedFile = "project-seed.md"`. Remove `seed.content` if it exists (migrated to .md). Write back.
3. Reconcile drift: if `accumulatedDrift[]` is non-empty, remove those entries from their source arrays (from each `feature.json#seedDrift[]` and from `backlog.html#data.seedDrift[]`). Log: `Reconciled {N} drift item(s) from {sources}.`
4. Confirm:

   ```
   CONCEPT UPDATED

   Source: .project/project-seed.md
   Applied techniques: {list of techniques used}

   Next steps:
   - /project-brainstorm - Creatively expand and create variations
   - /project-critique - Another analysis round
   - /project-backlog - Convert to feature backlog
   ```

**Concept-scope output is integrated into `project-seed.md`.** Critique adjustments are processed into the living document — no separate `.project/thinking/*.md` for concept-scope, no `seed.thinking[]` append. Update `seed.name` and `seed.pitch` in `project.json` if metadata changes.

**If "Copy to clipboard":**

Follow [`shared/CLIPBOARD.md`](../shared/CLIPBOARD.md).

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

### Terminal Formatting

- NEVER use blockquote syntax (`>`) for displaying content — causes unreadable white background in dark terminals
- NEVER use inline code backticks for emphasis on regular words — use **bold** or plain text
- Backticks only for actual code, file paths, and command references
