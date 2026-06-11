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
  version: 2.0.0
  category: project
---

## Overview

Creatively expand and explore ideas through interactive application of brainstorm techniques. Works with any concept input (from `/project-seed`, existing documents, or pasted text). One technique at a time through dialogue, then choose: another technique or generate the refined idea as a clean markdown document.

## When to Use

- User wants to explore variations, alternatives, or creative expansion of an idea
- User starts with `/project-brainstorm` (optionally followed by an idea or `/project-seed` output)

## Workflow

### PHASE 1: Parse Input

> **Todo**: Read `.claude/skills/shared/INPUT-PARSING.md` — use **brainstorm variant** (action = "brainstorm"). Follow all sections in order.

### Enter Plan Mode

**Enter Plan Mode** — call `EnterPlanMode` NOW, after PHASE 1 input parsing and before any PHASE 2 analysis. Follow [shared/PLAN-MODE.md](../shared/PLAN-MODE.md) Entry protocol. PHASES 2-6 run in plan mode — technique selection and the technique dialogues must run inside plan mode so model routers (e.g. `opusplan`) route them through the planning model. The refined idea (PHASE 6) is written to the plan file for review; all `.project/` writes wait until after `ExitPlanMode` (PHASE 7).

- **Note on user consent**: `EnterPlanMode` may prompt the user for plan-mode confirmation in some Claude Code UIs. This is intentional — model routers use plan mode as the trigger for upgrading to the planning model. Do not skip the call to avoid the prompt.
- **Skip-check**: if plan mode is already active (existing system-reminder), skip the call and read the plan-file path from the active reminder.
- Context7 research (PHASE 3) works normally in plan mode.

---

### PHASE 2: Suggest Technique

**Goal:** Rank the most relevant techniques for this idea and current exploration state.

1. Analyze: what has been explored (track applied techniques), which aspects need creative expansion, which unexplored directions could be valuable.
2. Read `references/technique-index.md` — the index only. Do NOT load detail files here.
3. Select 2-3 most relevant techniques, ranked (1 = most relevant). Recommend 1-2 — after 2 techniques diminishing returns are likely. Already-applied techniques never reappear.
4. Present via AskUserQuestion (in user's preferred language):

   ```yaml
   header: "Technique"
   question: "Which technique do you want to apply?"
   options:
     - label: "1. [Top Technique] (Recommended)", description: "[1-2 sentences why most relevant for THIS idea]"
     - label: "2. [Technique 2]", description: "[brief description]"
     - label: "3. [Technique 3]", description: "[brief description]"
   multiSelect: false
   ```

5. Proceed to PHASE 3 with the selected technique.

### PHASE 3: Apply Technique

**Goal:** Use the selected technique through interactive dialogue to generate variations and insights.

1. Read the **detail file of the selected technique** (the index names it) — only that category file.

2. **Question protocol** — follow [shared/QUESTIONING.md](../shared/QUESTIONING.md) for form choice, anchoring, and escalation:
   - Formulate 4-6 **anchored** questions from the technique's framework — each references something concrete from the idea/seed/dialogue so far, narrowed to a genuine unknown, with example directions where natural. Present them as a numbered menu (the documented exception to one-per-turn) plus 2-3 concrete suggestions.
   - When the technique surfaces an **enumerable fork** (pick between generated variants, prioritize directions), present it as an AskUserQuestion — typically at the end of a dialogue round ("which of these variants do you want to deepen?") — instead of burying it in the menu.

3. **Context7 research (when technical questions arise):** if the idea touches concrete libraries/frameworks and the technique raises feasibility or constraint questions, research first — `mcp__context7__resolve-library-id` + `mcp__context7__query-docs` — and fold findings into your questions and suggestions. Also research before answering when the user asks a technical question mid-dialogue.

4. Presentation template (in user's preferred language):

   ```
   🎨 [TECHNIQUE NAME]

   [1-2 sentence explanation of the technique]
   [If Context7 research was done: brief summary of key findings]

   [Questions header]:
   1. [anchored question]
   2. [etc, 4-6 total]

   [Suggestions to consider header]:
   - [concrete suggestion tailored to this idea, 2-3 total]

   Respond by number or in your own words.
   ```

5. Engage in natural dialogue — the user may answer, counter-ask, go deeper, redirect, or skip. Follow the conversation; the technique provides structure, not a straitjacket. No AskUserQuestion between menu presentation and the user's response — just prompt and wait. Continue until the technique is sufficiently explored.

### PHASE 4: Synthesize

Review the PHASE 3 dialogue and present (in user's preferred language):

```
📋 [SUMMARY header] - [Technique Name]

### [Key variations discovered]
### [Interesting directions]
### [Key insights]
```

Be specific — don't lose valuable ideas in the synthesis. Then proceed to PHASE 5.

### PHASE 5: Next Action

1. Re-rank the remaining relevant techniques (exclude applied ones, consider gaps and diminishing returns).
2. If no relevant techniques remain: announce "All relevant techniques applied — generating refined version now." and skip to PHASE 6.
3. Otherwise AskUserQuestion (in user's preferred language):

   ```yaml
   header: "Next Step"
   question: "How do you want to continue?"
   options:
     - label: "Generate refined version (Recommended)", description: "Create the final result with all insights"
     - label: "[Technique 1]", description: "[rationale - most relevant remaining]"
     - label: "[Technique 2]", description: "[brief description]"
   multiSelect: false
   ```

   Technique selected → PHASE 3 for that technique, then back here. Otherwise → PHASE 6.

### PHASE 6: Generate Final Output

Integrate the most valuable variations and insights from all applied techniques into one refined idea document:

- Same structure as the original input (or improved), standalone document
- **DO NOT include:** original idea, technique names, comparison to old version, changelog
- Pure markdown, no framing text ("Here's your refined idea:"), wrapped in a code block with `markdown` language tag

**End of thinking phase**: follow [shared/PLAN-MODE.md](../shared/PLAN-MODE.md) Exit protocol — write the refined idea document to the plan file, then `ExitPlanMode`. After approval the skill continues with PHASE 7.

### PHASE 7: Output Destination

> **Todo**: Read `.claude/skills/shared/THINKING-OUTPUT.md` — caller `project-brainstorm`, `{kind}` = `brainstorm`. Add `Applied techniques: {list}` to each confirmation block. Next steps: `/project-critique`, `/project-seed`, `/project-backlog`.

---

## Best Practices

- Make every question and suggestion specific to THIS idea — push for unexpected directions, concrete variations over vague "what ifs"
- Be exploratory and curious; encourage wild ideas and boundary pushing
- One technique at a time: select → apply → synthesize → decide; track applied techniques and cumulative insights through the session
- Respect the user's technique choice even if it differs from your recommendation

### Terminal Formatting

- NEVER use blockquote syntax (`>`) for displaying content — causes unreadable white background in dark terminals
- NEVER use inline code backticks for emphasis on regular words — use **bold** or plain text
- Backticks only for actual code, file paths, and command references

### Language

Follow the Language Policy in CLAUDE.md.
