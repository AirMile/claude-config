# Mode: Brainstorm

Loaded by the project-seed PHASE 0 dispatcher. Topic input (if any) was parsed there.

**Chained entry**: when entered via THINKING-OUTPUT § Continue from another mode in this session, skip PHASE 1 — the just-saved document is the input; scope carries over — and start at Enter Plan Mode.

## Overview

Creatively expand and explore ideas through interactive application of brainstorm techniques. Works with any concept input (from the seed mode, existing documents, or pasted text). One technique at a time through dialogue, then choose: another technique or generate the refined idea as a clean markdown document.

## Workflow

### PHASE 1: Parse Input

> **Todo**: Read `.claude/skills/shared/INPUT-PARSING.md` — use **brainstorm variant** (action = "brainstorm"). Follow all sections in order, **including § Project Memory Load** (built-state, backlog summary, learnings, prior thinking).

### Enter Plan Mode

**Enter Plan Mode** — call `EnterPlanMode` NOW, after PHASE 1 input parsing and before any PHASE 2 analysis. Follow [shared/PLAN-MODE.md](../../shared/PLAN-MODE.md) Entry protocol. PHASES 2-6 run in plan mode because the refined idea (PHASE 6) is a reviewable artefact whose rejection sends the brainstorm back for revision — a genuine approval gate. It is written to the plan file for review; all `.project/` writes wait until after `ExitPlanMode` (PHASE 7).

---

### PHASE 2: Suggest Technique

**Goal:** Rank the most relevant techniques for this idea and current exploration state.

1. Analyze: what has been explored (track applied techniques), which aspects need creative expansion, which unexplored directions could be valuable. Weigh the `PROJECT MEMORY` block (if loaded): prefer techniques that explore gaps relative to what is already built — `status: done` components and DOING/DONE backlog items are existing reality, not open design space.
2. Read `.claude/skills/project-seed/references/brainstorm/technique-index.md` — the index only. Do NOT load detail files here.
3. Select 2-3 most relevant techniques, ranked (1 = most relevant). Recommend 1-2 — after 2 techniques diminishing returns are likely. Already-applied techniques never reappear.
4. Present via AskUserQuestion (in user's preferred language):

   ```yaml
   header: "Technique"
   question: "Which technique do you want to apply?"
   options:
     - label: "[Top Technique] (Recommended)", description: "[1-2 sentences why most relevant for THIS idea]"
     - label: "[Technique 2]", description: "[brief description]"
     - label: "[Technique 3]", description: "[brief description]"
   multiSelect: false
   ```

5. Proceed to PHASE 3 with the selected technique.

### PHASE 3: Apply Technique

**Goal:** Use the selected technique through interactive dialogue to generate variations and insights.

1. Read the **detail file of the selected technique** (the index names it) — only that category file.

2. **Question protocol** — follow [shared/QUESTIONING.md](../../shared/QUESTIONING.md) for form choice, anchoring, and escalation:
   - Formulate 4-6 **anchored** questions from the technique's framework — each references something concrete from the idea/seed/dialogue so far, narrowed to a genuine unknown, with example directions where natural. Present them as a numbered menu (the documented exception to one-per-turn) plus 2-3 concrete suggestions.
   - When the technique surfaces an **enumerable fork** (pick between generated variants, prioritize directions), present it as an AskUserQuestion — typically at the end of a dialogue round ("which of these variants do you want to deepen?") — instead of burying it in the menu.
   - **Comparison forks**: when the fork compares designs or directions rather than a plain preference, put a compact trade-off table (one criterion per row, options side by side) *before* the modal. Options that each need three lines of description are a comparison in disguise and get answered with "just give me the table" (`mode-seed.md` PHASE 2 comparison rule).

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
- **Exception for concept-scope saves into an existing `project-seed.md`:** when the output is being spliced into a persistent, cumulative document (not generated standalone), a brief "why this changed" callout is allowed where the project's own established convention already keeps this kind of history (e.g. a "Correctie" pattern already present in the document) — match the existing document's own style rather than stripping it.
- Pure markdown, no framing text ("Here's your refined idea:"); proper heading formatting (`#` title, `##` sections)
- Preserve any YAML frontmatter already at the top of an existing seed (e.g. `applied_techniques` from a prior critique/brainstorm run)

**End of thinking phase**: follow [shared/PLAN-MODE.md](../../shared/PLAN-MODE.md) Exit protocol — write the refined idea document to the plan file, then `ExitPlanMode`. After approval the skill continues with PHASE 7.

### PHASE 7: Output Destination

> **Todo**: Read `.claude/skills/shared/THINKING-OUTPUT.md` — mode `brainstorm`, `{kind}` = `brainstorm`. Add `Applied techniques: {list}` to each confirmation block.

---

## Best Practices

- Make every question and suggestion specific to THIS idea — push for unexpected directions, concrete variations over vague "what ifs"
- Be exploratory and curious; encourage wild ideas and boundary pushing
- One technique at a time: select → apply → synthesize → decide; track applied techniques and cumulative insights through the session
- Respect the user's technique choice even if it differs from your recommendation
