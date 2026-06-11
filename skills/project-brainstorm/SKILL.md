---
name: project-brainstorm
description: Explore ideas using brainstorm techniques. Use with /project-brainstorm.
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

This skill helps creatively expand and explore ideas through interactive application of brainstorming techniques. It works with any type of concept input - whether from `/project-seed`, existing documents, or other sources - and guides you through technique-by-technique exploration with questions and suggestions.

The process is interactive: apply one technique at a time through Q&A, then choose to explore another technique or generate your final refined idea. The output is a clean markdown document of the refined idea, ready to use.

## When to Use

Trigger this skill when:

- User wants to explore variations and alternatives of an idea
- User wants to push boundaries and discover new possibilities
- User has an idea and wants creative expansion
- User starts with `/project-brainstorm` command

Example triggers:

- "/brainstorm" (followed by pasting idea)
- "/project-brainstorm [paste /project-seed output]"
- "Let's brainstorm alternatives for this concept"
- "Help me explore creative variations"

## Workflow

### PHASE 1: Parse Input

**Goal:** Understand what we're working with and extract the core idea.

> **Todo**: Read `.claude/skills/shared/INPUT-PARSING.md` — use **brainstorm variant** (action = "brainstorm"). Follow all sections in order.

### Enter Plan Mode

Follow [shared/PLAN-MODE.md](../shared/PLAN-MODE.md) Entry protocol before PHASE 2. PHASES 2-6 run in plan mode; the refined idea document (PHASE 6) is written to the plan file for review.

---

### PHASE 2: Suggest Technique

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

   [Recommendation: 1-2 techniques is optimal]
   ```

5. Use AskUserQuestion with technique options:

   ```yaml
   header: "Technique"
   question: "Which technique do you want to apply?"
   options:
     - label: "1. [Top Technique] (Recommended)", description: "[rationale]"
     - label: "2. [Technique 2]", description: "[brief description]"
     - label: "3. [Technique 3]", description: "[brief description]"
   multiSelect: false
   ```

   - Proceed to PHASE 3 with the selected technique

### PHASE 3: Apply Technique

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

   Respond by number or in your own words.
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

### PHASE 4: Synthesize User Input

**Goal:** Capture key insights and variations discovered through the technique.

**Process:**

1. Review the user's responses and dialogue from PHASE 3

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

4. After presenting synthesis, proceed to PHASE 5

### PHASE 5: Next Action

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

   Available options:
   - Generate refined version (final result)
   - Apply 1-3 more techniques
   ```

4. If no relevant techniques remain (all applied or none relevant):
   - Skip presenting options
   - Proceed directly to PHASE 6 (Generate Final Output)
   - Announce (in user's preferred language): "[All relevant techniques applied. Generating refined version now.]"

5. Use AskUserQuestion with next action options:

   ```yaml
   header: "Next Step"
   question: "How do you want to continue?"
   options:
     - label: "Generate refined version (Recommended)", description: "Create the final result with all insights"
     - label: "[Technique 1]", description: "[rationale - most relevant remaining technique]"
     - label: "[Technique 2]", description: "[brief description]"
   multiSelect: false
   ```

   - If "Generate refined version": proceed to PHASE 6
   - If a technique selected: go to PHASE 3 for that technique, then back to PHASE 5 after

### PHASE 6: Generate Final Output

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

**End of thinking phase**: follow [shared/PLAN-MODE.md](../shared/PLAN-MODE.md) Exit protocol — write the refined idea document to the plan file, then `ExitPlanMode`. After approval the skill continues with PHASE 7 (output destination and `.project/` writes).

### PHASE 7: Output Destination

After generating the refined content, determine output destination based on scope.

**If scope = feature or page (from PHASE 1a):**

Save automatically to the scope location:

- Scope = feature → write to `.project/features/{name}/thinking.md`
- Scope = page/UX → create `.project/thinking/` if needed, write to `.project/thinking/{topic}.md`

```
THINKING OUTPUT SAVED

File: {output-path}
Scope: {feature:{name} | page:{topic}}
Applied techniques: {list of techniques used}
```

**Thinking log** (`shared/DASHBOARD-CONTEXT.md § thinking-output`): also write the full markdown to `.project/thinking/{today}-brainstorm-{slug}.md` so name-matching consumers (e.g. `/dev-define`) can discover it via Grep. No `project.json` write — the `.md` files are the only source of truth.

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

Then reconcile drift: if `accumulatedDrift[]` is non-empty, remove those entries from their source arrays (from each `feature.json#seedDrift[]` and from `backlog.json#seedDrift[]`). Log: `Reconciled {N} drift item(s) from {sources}.`

**If scope = standalone idea (from PHASE 1a):**

Save to `.project/thinking/{today}-brainstorm-{slug}.md`:

1. Create `.project/thinking/` if needed
2. Write to `.project/thinking/{today}-brainstorm-{slug}.md`

```
THINKING OUTPUT SAVED

File: .project/thinking/{today}-brainstorm-{slug}.md
Scope: standalone idea
Applied techniques: {list of techniques used}
```

No `project.json` write — `.project/thinking/*.md` is the only source of truth (`shared/DASHBOARD-CONTEXT.md § thinking-output`).

**If scope = concept (default) or no scope chosen:**

Use AskUserQuestion:

```yaml
header: "Output"
question: "What do you want to do with the expanded concept?"
options:
  - label: "Save to concept (Recommended)", description: "Update project-seed.md with expanded version"
  - label: "Copy to clipboard", description: "Copy markdown to clipboard (don't save)"
multiSelect: false
```

**If "Save to concept":**

1. Write the full refined concept document as plain markdown to `.project/project-seed.md`
2. Also update project.json: Read `.project/project.json` (or create with `{}`), set `seed.name` (title of refined idea), `seed.pitch` (first paragraph, 1-2 sentences), `seed.seedFile = "project-seed.md"`. Remove `seed.content` if it exists (migrated to .md). Write back.
3. Reconcile drift: if `accumulatedDrift[]` is non-empty, remove those entries from their source arrays (from each `feature.json#seedDrift[]` and from `backlog.json#seedDrift[]`). Log: `Reconciled {N} drift item(s) from {sources}.`
4. Confirm:

   ```
   CONCEPT UPDATED

   File: .project/project-seed.md
   Applied techniques: {list of techniques used}

   Next steps:
   - /project-critique - Critically analyze and strengthen
   - /project-brainstorm - Another brainstorm round
   - /project-backlog - Convert to feature backlog
   ```

**Concept-scope output is integrated into `project-seed.md`.** The chosen variant is processed into the living document — no separate `.project/thinking/*.md` for concept-scope, no `seed.thinking[]` append. Update `seed.name` and `seed.pitch` in `project.json` if metadata changes.

**If "Copy to clipboard":**

Follow [`shared/CLIPBOARD.md`](../shared/CLIPBOARD.md).

---

## Best Practices

**Input Parsing:**

- Be flexible - accept various input formats
- Quick for `/project-seed` output, thorough for unclear input
- Don't make assumptions - ask when unclear

**Technique Selection:**

- Show 2-3 most relevant techniques (between 2-3 based on how many are truly relevant)
- Recommend 1-2; after 2 techniques diminishing returns are likely
- Rank techniques with numbers: 1 = most relevant (at the top), higher numbers = less relevant
- Consider what's been explored already (especially in PHASE 5)
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
- After each technique's synthesis, always go to PHASE 5 for the user to decide next action
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

- One technique at a time: PHASE 2 → PHASE 3 → PHASE 4 → PHASE 5 → repeat or finish
- Track: techniques_applied (list of completed techniques)

### Terminal Formatting

- NEVER use blockquote syntax (`>`) for displaying content — causes unreadable white background in dark terminals
- NEVER use inline code backticks for emphasis on regular words — use **bold** or plain text
- Backticks only for actual code, file paths, and command references

### Language

Follow the Language Policy in CLAUDE.md.
