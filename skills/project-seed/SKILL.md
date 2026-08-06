---
name: project-seed
description: Use when scoping, expanding, or stress-testing an idea. Use with /project-seed.
reads:
  [
    concept.seed,
    backlog.status,
    backlog.features,
    feature.seedDrift,
    backlog.seedDrift,
    project.thinking,
    project.entities,
    project.endpoints,
    project-context.architecture,
    project-context.learnings,
  ]
writes: [concept.seed, project.thinking, feature.seedDrift, backlog.seedDrift]
metadata:
  author: claude-config
  version: 2.3.0
  category: project
---

# Seed

Transform any idea, concept, feature, or task assignment into a structured seed document — and optionally expand (brainstorm) or stress-test (critique) it. Three modes share one output pipeline into `/project-plan`:

- **seed** (default): scope an idea, design, or task into a seed document through targeted questions and synthesis; also syncs an existing seed with project state
- **brainstorm**: creatively expand an idea via brainstorm techniques, one technique at a time through dialogue
- **critique**: stress-test an idea via multi-perspective analysis techniques

## When to Use

- User starts with `/project-seed` (with or without arguments) — mode dispatch below decides the route
- New or vague idea, design, or task needs scoping → seed mode
- User wants variations, alternatives, or creative expansion → brainstorm mode
- User wants weaknesses identified, assumptions tested, failure modes found → critique mode

## PHASE 0: Mode Dispatch

1. **Keyword routing** — first whitespace-delimited token of the invocation args, case-insensitive:
   - `brainstorm` → brainstorm mode; remaining args = topic input
   - `critique` → critique mode; remaining args = topic input
   - anything else (including no args) → seed mode; full args = topic input (the `sync` route is handled inside seed-mode intake, as before)

   This parser covers both slash invocation (`/project-seed brainstorm dark-mode toggle`) and Skill-tool invocation (`args: "critique <topic>"`).

2. **Intent routing** (no mode keyword, natural-language trigger):
   - weaknesses / assumptions / risks / "poke holes" / "stress-test" → critique
   - variations / alternatives / "wild ideas" / expand → brainstorm
   - new idea / scope / task intake, or no clear signal → seed (default)
   - Two modes equally signalled → one AskUserQuestion (header `"Mode"`, options Seed / Brainstorm / Critique) — never guess between brainstorm and critique.

3. Dispatch:

> **Todo**: Read `.claude/skills/project-seed/references/mode-{seed|brainstorm|critique}.md` — follow it to completion, passing along the parsed topic input (if any).

## Continue Step

Every mode ends via `shared/THINKING-OUTPUT.md`; for concept-scope output that file closes with its § Continue step (chain another mode in this session, hand off to `/project-plan`, or stop). The dispatcher itself does nothing after dispatch.

---

## Best Practices

### Terminal Formatting

- NEVER use blockquote syntax (`>`) for displaying content — causes unreadable white background in dark terminals
- NEVER use inline code backticks for emphasis on regular words — use **bold** or plain text
- Backticks only for actual code, file paths, and command references

### Language

Follow the Language Policy in CLAUDE.md.
