# Mode: Critique

Loaded by the project-seed PHASE 0 dispatcher. Topic input (if any) was parsed there.

**Chained entry**: when entered via THINKING-OUTPUT § Continue from another mode in this session, skip PHASE 1 — the just-saved document is the input; scope carries over, along with the applied-techniques list — and start at Enter Plan Mode.

## Overview

Critically analyze and strengthen ideas through interactive application of analysis techniques. Works with any concept input (from the seed mode, existing documents, or pasted text). One technique at a time through dialogue, then choose: another technique or generate the refined idea as a clean markdown document.

## Workflow

### PHASE 1: Parse Input

> **Todo**: Read `.claude/skills/shared/INPUT-PARSING.md` — use **critique variant** (action = "analyze", includes applied-techniques check and 3-option confirm). Follow all sections in order, **including § Project Memory Load** (built-state, backlog summary, learnings, prior thinking).

### Enter Plan Mode

**Enter Plan Mode** — call `EnterPlanMode` NOW, after PHASE 1 input parsing and before any PHASE 2 analysis. Read only [shared/PLAN-MODE.md](../../shared/PLAN-MODE.md) § Entry now (§ Exit later, before PHASE 7) — skip § Conditional entry, § Administrative exit, and § Used by, which document other skills' plan-mode usage, not this one. PHASES 2-6 run in plan mode because the refined output (PHASE 6) is a reviewable artefact whose rejection sends the critique back for revision — a genuine approval gate. It is written to the plan file for review; all `.project/` writes wait until after `ExitPlanMode` (PHASE 7).

---

### PHASE 2: Determine Type & Select Techniques

**Goal:** Classify the idea, then rank the most relevant analysis techniques.

1. Determine idea type: **creative** (game, story, art, interactive experience), **product** (app, service, business, SaaS), or **hybrid** (both).
2. Read `.claude/skills/project-seed/references/critique/technique-index.md` — the index only. Do NOT load detail files here. Candidates: universal techniques always; creative techniques for creative/hybrid; product techniques for product/hybrid.
3. Filter and rank: keep only techniques genuinely relevant to THIS idea (e.g. drop Narrative for non-narrative games), exclude already-applied ones, rank by which reveals the most critical weaknesses. More than 5 relevant → top 5 only. With a `PROJECT MEMORY` block loaded: rank by which technique reveals weaknesses **in the not-yet-built remainder** — built components are facts to critique against, not assumptions to challenge; pitfall learnings point at weakness categories this project actually hit.
4. Present 2-4 techniques via AskUserQuestion (in user's preferred language) — fewer than 3 relevant → show all available:

   ```yaml
   header: "Analysis Technique"
   question: "Which technique do you want to apply?"
   options:
     - label: "[Best Technique] (Recommended)", description: "[1-2 sentences why this is the best choice for THIS idea]"
     - label: "[Technique 2]", description: "[1 sentence why relevant]"
     - label: "[Technique 3]", description: "[1 sentence why relevant]"
   multiSelect: false
   ```

5. Proceed to PHASE 3 with the selected technique.

### PHASE 3: Apply Technique

**Goal:** Use the selected technique through interactive dialogue to identify weaknesses, test assumptions, and find problems.

1. Read the **detail file of the selected technique** (the index names it) — only that file.

2. **Context7 research (when technical questions arise):** if the technique raises feasibility, implementation, constraint, or performance questions, research first — `mcp__context7__resolve-library-id` + `mcp__context7__query-docs` — and fold findings into your questions. Instead of "Is this technically feasible?", ask "Library X supports Y but has limitation Z — how do you want to handle that?". Also research before answering when the user asks a technical question mid-dialogue.

3. **Question protocol** — follow [shared/QUESTIONING.md](../../shared/QUESTIONING.md) for form choice, anchoring, and escalation:
   - Formulate 4-6 **anchored** questions from the technique's framework — each references something concrete from the idea/seed/research findings, narrowed to a genuine unknown. Present them as a numbered menu (the documented exception to one-per-turn) plus 3 concrete points of attention.
   - **Enumerable-fork rule**: the moment a question you're about to ask has ≤3 plausible concrete answers (which risk to mitigate first, trade-off A vs B, accept/cut a weak element) — ask it as AskUserQuestion with your recommended hypothesis first, never as open prose, even mid-dialogue. Only genuinely open questions (no enumerable answer set) go through free text.

4. Presentation template (in user's preferred language):

   ```
   🔍 [TECHNIQUE NAME]

   [1-2 sentence explanation of the technique]
   [If Context7 research was done: brief summary of key findings]

   [Questions header]:
   1. [anchored question]
   2. [etc, 4-6 total]

   [Points of attention header]:
   1. [concrete point tailored to this idea, 3 total]

   Respond by number or in your own words.
   ```

5. Engage in natural dialogue — the user may answer, counter-ask, go deeper, redirect, or skip. Be rigorous: identify real problems, challenge assumptions rather than accepting them, push for concrete solutions or decisions. No AskUserQuestion between menu presentation and the user's response — just prompt and wait. Continue until the technique is sufficiently explored.

### PHASE 4: Synthesize

Review the PHASE 3 dialogue and present (in user's preferred language):

```
📋 [SUMMARY header] - [Technique Name]

### [Identified problems]
### [Weak assumptions]
### [Possible improvements]
### [Key insights]
```

Be specific about problems and improvements — don't lose insights in the synthesis. Then proceed to PHASE 5.

### PHASE 5: Next Action

1. Rank the remaining relevant techniques (exclude applied ones; which weaknesses still need examination?).
2. If no relevant techniques remain: announce "All relevant techniques have been applied. Generating refined version now." and skip to PHASE 6.
3. Otherwise AskUserQuestion (in user's preferred language) — max 2 techniques + the generate option:

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

Integrate all findings from all applied techniques into one refined idea document: address identified problems, strengthen weak assumptions, incorporate improvements — while keeping the idea coherent.

- Same structure as the original input (or improved), standalone document
- **DO NOT include:** original idea, technique names, comparison to old version, changelog, list of problems found
- **Exception for concept-scope saves into an existing `project-seed.md`:** when the output is being spliced into a persistent, cumulative document (not generated standalone), a brief "why this changed" callout is allowed where the project's own established convention already keeps this kind of history (e.g. a "Correctie" pattern already present in the document) — match the existing document's own style rather than stripping it.
- Pure markdown, no framing text; proper heading formatting (`#` title, `##` sections)
- Optional YAML frontmatter recording the analysis:

  ```yaml
  ---
  applied_techniques:
    - Devil's Advocate Analysis
    - Assumption Testing
  ---
  ```

**Second-opinion hook** (after writing the plan file, before `ExitPlanMode`) — only if ≥3
high-impact problems whose fixes conflict or force a pivot remain after all applied techniques:

> **Todo**: Read `.claude/skills/shared/SECOND-OPINION.md` and follow it — the trigger auto-fires
> the consult (no confirm step) with INPUT = the plan file / refined-idea document (project-seed
> row of § Brief contents). Fold the digest into the refined document before exiting, print the
> one-line log (§ Logging — no report table here), set `secondOpinionUsed`.

**End of thinking phase**: follow [shared/PLAN-MODE.md](../../shared/PLAN-MODE.md) Exit protocol — write the refined idea document to the plan file, then `ExitPlanMode`. After approval the skill continues with PHASE 7.

### PHASE 7: Output Destination

> **Todo**: Read `.claude/skills/shared/THINKING-OUTPUT.md` — mode `critique`, `{kind}` = `critique`. Add `Applied techniques: {list}` to each confirmation block.

---

## Best Practices

- Make every question specific to THIS idea — identify real problems, not surface-level concerns; apply technical and practical scrutiny
- One technique at a time: select → apply → synthesize → decide; track applied techniques and cumulative findings through the session
- Respect the user's technique choice even if it differs from your recommendation
