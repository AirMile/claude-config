# PHASE 0.5: Research (Optional)

**Goal:** Gather codebase, documentation, and web research to inform feature extraction.

**Triggered when:** User chooses "Yes, do research" at end of PHASE 0.

**Step 1: Analyze Research Needs**

Determine what research is needed based on the loaded concept:

```
Research checklist:
├─ User: Are there ambiguities that need clarification?
├─ Codebase: Is there an existing codebase with relevant code to analyze?
├─ Context7: Does the concept reference specific frameworks/libraries?
└─ Web: Is external information needed (patterns, pitfalls, examples)?
```

**Output:** List of research categories to execute.

**Step 2: User Clarification (if needed)**

If ambiguities are identified, use AskUserQuestion to clarify before starting research.

**Step 3: Research (Explore agent)**

Spawn one Explore agent (`subagent_type: Explore`, thoroughness: "very thorough") to do all research in an isolated context. This keeps Context7 results, web search output, and source file reads out of the main session.

**[WEB MODE]** Agent prompt:

```
Research the following for a web project feature plan.

{If codebase research needed:}
CODEBASE ANALYSIS:
- Find similar features, existing patterns, architecture conventions
- Check existing implementations that can be reused
- Note file structure conventions

{If Context7 research needed:}
FRAMEWORK RESEARCH:
- resolve-library-id + query-docs for: {frameworks/libraries}
- Focus: architecture patterns, best practices, common pitfalls, testing setup

{If web research needed:}
WEB RESEARCH (use WebSearch):
- "{framework} {feature-type} best practices"
- "{framework} {feature-type} common pitfalls"
- "{feature-type} production examples"

RETURN FORMAT:
RESEARCH_START
Codebase: {3-5 bullet points: existing patterns, reusable code, conventions}
Framework: {3-5 bullet points: architecture patterns, best practices, pitfalls}
Web: {3-5 bullet points: real-world patterns, warnings, recommendations}
RESEARCH_END
```

**[GAME MODE]** Agent prompt:

```
Research the following for a Godot 4.x game feature plan.

{If codebase research needed:}
CODEBASE ANALYSIS:
- Find similar features, existing patterns, scene tree conventions
- Check existing implementations that can be reused
- Note file structure and autoload conventions

{If Context7 research needed:}
GODOT RESEARCH:
- resolve-library-id + query-docs for: Godot 4.x, GUT
- Focus: scene composition, node types, GDScript patterns, signal usage, testing setup

{If web research needed:}
WEB RESEARCH (use WebSearch):
- "Godot 4.x {mechanic} implementation patterns"
- "Godot {feature-type} common pitfalls"

RETURN FORMAT:
RESEARCH_START
Codebase: {3-5 bullet points: existing patterns, reusable scenes/scripts, conventions}
Godot: {3-5 bullet points: scene architecture, GDScript patterns, pitfalls}
Web: {3-5 bullet points: real-world patterns, warnings, recommendations}
RESEARCH_END
```

**Step 4: Research Summary**

Parse the agent's `RESEARCH_START...END` block. Display:

```
RESEARCH COMPLETE

| Category | Key Findings |
|----------|--------------|
| Codebase | {summary of existing patterns/features} |
| Context7 | {summary of framework guidance} |
| Web      | {summary of patterns/pitfalls} |

→ Research results will inform feature extraction...
```

Only the compact summary enters the main context for PHASE 1.
