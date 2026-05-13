---
name: project-research
description: Multi-source research on concepts and ideas. Combines web search, documentation lookup, and codebase analysis into structured findings. Use with /project-research after /project-seed, /project-brainstorm, or /project-critique.
metadata:
  author: claude-config
  version: 1.3.0
  category: thinking
---

## Overview

Researches concepts and ideas through multiple external sources: web search for market/competitor/trend data, Context7 for technical documentation, and optionally codebase analysis. Works with any concept input — from thinking pipeline output, existing documents, or direct input.

Flow: extract research questions → auto-select technique → execute multi-source research → synthesize → loop or generate report.

## Workflow

### Step 1: Parse Input

**Auto-detect concept file:**

1. Check if `.project/project-seed.md` exists (primary) or `.project/project.json` has non-empty `concept.content` (legacy fallback)
2. If found AND no inline input provided:
   - Show concept name and ask confirmation:
     ```yaml
     header: "Load Concept"
     question: "Do you want to research this concept?"
     options:
       - label: "Yes, research this (Recommended)", description: "Use concept from project.json"
       - label: "Different concept", description: "I want to paste a different concept"
     multiSelect: false
     ```

**Scope check** — only if scope context exists (backlog, features, or page files):

Check `.project/backlog.html`, `.project/features/`, and `app/**/page.tsx` / `src/pages/**/*.tsx`. If at least one found:

```yaml
header: "Scope"
question: "What do you want to research?"
options:
  - label: "Concept (Recommended)", description: "Work with concept from project.json"
  - label: "Feature from backlog", description: "Focus on a specific feature"
  - label: "Page / UX flow", description: "Focus on layout, UX or user flow"
  - label: "Standalone idea", description: "Standalone idea, not linked to the project"
multiSelect: false
```

Scope-specific input:

- **Feature**: Read backlog (see `shared/BACKLOG.md`), show features TODO/DEF, load `01-define.md` or feature description
- **Page/UX**: Glob for page files, load as context
- **Standalone idea**: Ignore loaded concept, ask user for description

Output path follows scope:

- concept → `.project/project-seed.md` + update project.json metadata (name, pitch)
- feature → `.project/features/{name}/research.md`
- page/UX or standalone idea → `.project/thinking/{topic}-research.md`

**Other input** — if no concept found or user wants different input:

Accept input from user (thinking output, document, description, or chat context). If unclear: ask 2-3 targeted questions. Confirm the concept summarized before proceeding.

### Enter Plan Mode

Follow [shared/PLAN-MODE.md](../shared/PLAN-MODE.md) Entry protocol before Step 2. Steps 2-7 run in plan mode; the final report (Step 7) is written to the plan file for review. WebSearch, Context7 and Grep/Glob continue to work in plan mode.

---

### Step 2: Extract Research Foundation

First extract four categories from the concept, then distill research questions.

**2a. Extract foundation (4 categories, brief, one line per item):**

- **Assumptions** — what are we taking for granted that we may need to validate?
- **Knowledge gaps** — what do we simply not know? (market, competitors, pricing, user behavior)
- **Decisions** — what choices do we need to make and what info do we need for them? (tech stack, pricing, target audience)
- **Risks** — what could cause this concept to fail? (technical, legal, scalability, adoption)

**2b. Distill 3-5 research questions** with the highest impact on feasibility. Questions can come from any category — usually a mix. Each question must be answerable via web search, documentation, or codebase analysis and be specific to THIS concept.

**2c. Store assumptions** separately (including those that don't make it into research questions) — these will be marked as Validated / Invalidated / Still Open in Step 5/7.

Present:

```
RESEARCH FOUNDATION

Concept: {concept title}

Assumptions:
- {assumption 1}
- {assumption 2}

Knowledge Gaps:
- {gap 1}
- {gap 2}

Decisions Needed:
- {decision 1}

Risks:
- {risk 1}
- {risk 2}

RESEARCH QUESTIONS (distilled from the above)

1. {specific research question — highest priority}
2. {specific research question}
3. {specific research question}
4. {specific research question} (optional)
5. {specific research question} (optional)
```

Confirm via AskUserQuestion (Yes/Adjust).

### Step 3: Select Research Technique

Read `references/research-techniques.md`. Automatically select the most relevant technique based on:

- Which technique addresses the highest-priority unanswered questions?
- Which techniques have already been applied? (exclude)

Show the choice briefly:

```
RESEARCH TECHNIQUE: {Technique Name}

{1-2 sentences explaining why this technique was chosen}
```

Proceed directly to Step 4.

### Step 4: Execute Research

Read the selected technique from `references/research-techniques.md`.

**Execute research sources in parallel where possible:**

- **WebSearch**: 2-4 targeted queries derived from the technique
- **Context7**: `resolve-library-id` → `query-docs` for technical questions
- **Codebase**: `Grep`/`Glob` if the concept involves an existing project

Present findings per source:

```
WEB|DOCS|CODE — {SOURCE NAME}

Query: "{search query}"

Findings:
- {key finding 1}
- {key finding 2}

Sources: {URLs or file paths}
```

Offer to go deeper if findings reveal unexpected angles.

**Guidelines:**

- Cross-reference between sources
- Flag contradictions and challenged assumptions
- Quantitative data where available
- Always cite sources

**For Trend Analysis technique:** Use the mental models from the technique as an operational lens during execution, not as post-analysis. Explicitly note temperature differences per source and label each signal with trajectory vocabulary (acute_rise / plateau / zombie / comeback).

### Step 5: Synthesize Findings

Map findings to the research questions from Step 2:

```
SYNTHESIS — {Technique Name}

### Q1: {research question}
**Status:** {Answered / Partially answered / Needs more research}
- {key finding with source reference}
**Implication:** {what this means for the concept}

### Q2: {research question}
...

### Assumption Tracking
- {assumption}: **Validated** — {evidence + source}
- {assumption}: **Invalidated** — {evidence + source}
- {assumption}: **Still Open** — {what's needed to validate}

### Decision Tracking
- {decision}: **Ready** — {recommended option + rationale}
- {decision}: **Blocked** — {what's still needed}

### Risk Tracking
- {risk}: **Severity High/Med/Low** — {mitigation OR "still open"}

### New Insights
- {unexpected finding or new angle discovered}
```

Proceed to Step 6.

### Step 6: Next Action

First build an open-items overview based on Step 5 tracking:

```
Open items overview:
- Unanswered questions: {n}
- Still-Open assumptions: {n}
- Blocked decisions: {n}
- Unaddressed High/Med risks: {n}

Total open items: {sum}
```

**Decision logic:**

- **Total = 0** or no relevant techniques remaining → go directly to Step 7
- **Total > 0** → show AskUserQuestion. Determine the recommended technique by:
  1. Select the most urgent type of open item in order: **High-severity risks > Blocked decisions > Still-Open assumptions > Unanswered questions**
  2. Match the type with the `Addresses:` mapping from `references/research-techniques.md`
  3. First option remains "Generate report (Recommended)" so the user can always close out

Show the reasoning briefly before the question:

```
Recommendation: {Technique} — addresses {N} open {item type}(s)
```

Ask via AskUserQuestion:

```yaml
header: "Next Step"
question: "How do you want to continue?"
options:
  - label: "Generate report (Recommended)", description: "Create the final result with all findings"
  - label: "{Technique}", description: "{rationale — addresses {N} open {item type}}"
multiSelect: false
```

### Step 7: Generate Final Report

Generate a structured markdown report:

```markdown
# Research: {concept title}

## Summary

{2-3 sentence executive summary}

## Key Findings

### {Finding Category}

{findings with evidence and source references}
**Implication:** {what this means for the concept}

## Assumptions

**Validated:**

- {assumption} — {evidence}

**Invalidated:**

- {assumption} — {evidence, what to reconsider}

**Still Open:**

- {assumption} — {what's needed to validate}

## Decisions

**Ready to decide:**

- {decision} — {info gathered, recommended option, rationale}

**Still blocked:**

- {decision} — {what's still needed before you can choose}

## Risk Assessment

| Risk   | Severity     | Likelihood   | Mitigation                     |
| ------ | ------------ | ------------ | ------------------------------ |
| {risk} | High/Med/Low | High/Med/Low | {strategy or "needs research"} |

## Recommendations

Recommendations are always actor-specific (e.g. "for a B2B SaaS brand", "for a solo creator"). No generic "keep monitoring" advice — every recommendation contains a concrete action or decision.

1. {actionable recommendation}

## Open Questions

- {unanswered or emerged question}

## Sources

- [{source title}]({url})
```

Include Competitive Landscape table and/or Technical Feasibility assessment where relevant.

**End of analysis phase**: follow [shared/PLAN-MODE.md](../shared/PLAN-MODE.md) Exit protocol — write the research report to the plan file, then `ExitPlanMode`. After approval the skill continues with Step 8 (Save & Sync, `.project/` writes).

### Step 8: Save & Sync

**Scope = concept (default):**

Auto-save without extra questions:

1. Write report to `.project/thinking/{concept-name}-research.md` (full report as user archive)
2. Add `## Research Findings` section to `.project/project-seed.md` (this is what project-backlog/dev-define see as context)
3. Confirm:

```
RESEARCH SAVED

Report: .project/thinking/{concept-name}-research.md
Concept: project-seed.md updated with key findings
Applied techniques: {list}

Next steps:
- /project-critique - Critically analyze with research context
- /project-brainstorm - Creatively expand with new insights
- /project-decide - Make a decision based on research
- /project-backlog - Convert to feature backlog
```

**Scope = feature or page:**

1. Write to scope path (`.project/features/{name}/research.md` or `.project/thinking/{topic}-research.md`)
2. Optionally ask if key findings should also be added to `project-seed.md`

The markdown is the source of truth — no `project.json` `thinking[]` append. Skills that want to consume research (like `/dev-define`) read directly from `.project/thinking/*.md` or `.project/features/{name}/research.md`.

**Scope = standalone idea:**

1. Write to `.project/thinking/{topic}-research.md`
2. Offer "Copy to clipboard" per [`shared/CLIPBOARD.md`](../shared/CLIPBOARD.md)

The markdown is the source of truth — no `project.json` `thinking[]` append.

---

## Guidelines

**Flow:**

- No AskUserQuestion between research execution steps — just execute and present
- After synthesis always go to Step 6 for next action
- One technique at a time: select → execute → synthesize → decide

**Flexibility:**

- User can adjust research focus at any time
- With unexpected findings: offer to explore that path

**Formatting:**

- NEVER use blockquote syntax (`>`) — unreadable background in dark terminals
- NEVER use backticks for emphasis on regular words — use **bold**
- Backticks only for code, file paths, and command references

**Language:** Follow the Language Policy in CLAUDE.md.
