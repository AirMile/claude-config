---
name: thinking-explore
description: Free-form exploration of a codebase, domain, or problem space before committing to requirements. Use with /thinking-explore when you need to investigate before defining.
disable-model-invocation: true
metadata:
  author: mileszeilstra
  version: 1.0.0
  category: thinking
---

# Explore

Open-ended investigation before committing to structure. Produces findings, questions, and potential directions — not formatted artifacts.

Use before `/thinking-idea` when requirements are unclear, or independently to investigate a domain.

## When to Use

- Requirements are vague or unknown
- Need to understand existing code before planning changes
- Investigating a new domain, technology, or pattern
- Want to know what's possible before deciding what to build
- Starting from scratch with no concept

## Trigger

`/thinking-explore` or `/thinking-explore [topic or question]`

## Workflow

### Step 1: Scope the Exploration

**If argument provided** (`/thinking-explore how does the auth system work`):

- Use as exploration topic, proceed to Step 2.

**If no argument** (`/thinking-explore`):

1. Check for project context:
   - `.project/project-concept.md` — existing concept
   - `.project/project.json` — project metadata
   - `.project/backlog.html` — existing features
   - `CLAUDE.md` — stack info

2. AskUserQuestion:

   ```yaml
   header: "Verkenning"
   question: "Wat wil je verkennen?"
   options:
     - label: "Codebase verkennen (Recommended)", description: "Onderzoek structuur, patronen, en mogelijkheden in de huidige code"
     - label: "Domein verkennen", description: "Onderzoek een technisch domein, framework, of patroon"
     - label: "Probleem verkennen", description: "Onderzoek een vaag probleem of behoefte"
   multiSelect: false
   ```

3. Follow-up based on choice:
   - **Codebase**: "Welk deel van de codebase, of een specifieke vraag?"
   - **Domein**: "Welk domein of technologie?"
   - **Probleem**: "Beschrijf het probleem of de behoefte in een paar zinnen"

### Step 2: Investigate

Explore freely using available tools. No forced technique or order.

**Codebase exploration** (primary tools):

- Glob to discover file structure and patterns
- Grep to find implementations, usage patterns, imports
- Read to examine specific code sections
- Follow import chains and cross-references

**Domain exploration** (when applicable):

- WebSearch for patterns, approaches, prior art
- WebFetch for specific documentation pages
- Context7 (resolve-library-id + query-docs) for framework-specific patterns

**Problem space exploration**:

- Combine codebase + domain research
- Look for similar solutions in the project
- Investigate constraints and boundaries

**During investigation, track:**

- Concrete findings (what exists, what patterns are used)
- Surprises (unexpected structures, missing pieces, inconsistencies)
- Questions that emerge (things that need answers before proceeding)
- Potential directions (ideas that surface during exploration)

There is no fixed number of investigation steps. Continue until a coherent picture forms or the user redirects.

### Step 3: Check In

After initial investigation (or when a natural pause occurs):

AskUserQuestion:

```yaml
header: "Tussenstand"
question: "Ik heb wat gevonden. Hoe wil je verder?"
options:
  - label: "Toon bevindingen (Recommended)", description: "Bekijk wat er tot nu toe is gevonden"
  - label: "Dieper graven", description: "Verken een specifieke richting verder"
  - label: "Andere richting", description: "Shift de focus naar een ander aspect"
multiSelect: false
```

- **Toon bevindingen**: proceed to Step 4
- **Dieper graven**: ask what direction, continue Step 2
- **Andere richting**: ask new focus, continue Step 2

### Step 4: Present Findings

Present what was found in a natural, conversational style. No forced H1/H2 document structure. The output adapts to what was actually discovered.

**Required elements** (in any order, any format):

1. **Wat er is gevonden** — concrete findings from the investigation
2. **Vragen die opkwamen** — questions that emerged and remain unanswered
3. **Mogelijke richtingen** — potential next steps or approaches

```
EXPLORATION: {topic}

{findings — adapt freely to what was discovered}

OPEN QUESTIONS:
- {question 1}
- {question 2}

POSSIBLE DIRECTIONS:
- {direction 1} — {why}
- {direction 2} — {why}
```

### Step 5: Save & Next

AskUserQuestion:

```yaml
header: "Opslaan"
question: "Wat wil je met de bevindingen doen?"
options:
  - label: "Opslaan en door (Recommended)", description: "Sla op en ga naar /thinking-idea of /dev-define"
  - label: "Verder verkennen", description: "Terug naar Step 2 voor meer onderzoek"
  - label: "Alleen opslaan", description: "Sla op zonder volgende stap"
multiSelect: false
```

**Save location:**

1. Write findings to `.project/thinking/{today}-explore-{slug}.md` (slug = kebab-case topic, max 30 chars)
2. Dashboard sync: push to `thinking` array in `project.json`:
   ```json
   {
     "type": "explore",
     "date": "{today}",
     "title": "Explore: {topic}",
     "summary": "{key finding, max 200 chars}",
     "file": ".project/thinking/{today}-explore-{slug}.md",
     "source": "/thinking-explore"
   }
   ```

**Next steps** (conditional):

```
Next steps:
  - /thinking-idea — Vorm de bevindingen om tot een gestructureerd concept
  - /thinking-research — Verdiep een specifieke richting met gerichte research
  - /dev-define — Direct naar requirements als het duidelijk genoeg is
```

**Verder verkennen** → terug naar Step 2 met huidige context intact.

## Guidelines

- NO forced output structure — adapt to what's found
- NO technique selection or method framework — just investigate
- Codebase investigation: use Glob/Grep/Read heavily, follow chains
- Domain investigation: use WebSearch/Context7 as needed
- Be thorough but not exhaustive — stop when a coherent picture forms
- Track questions as first-class output, not afterthoughts
- Lighter than /thinking-research — no multi-source synthesis protocol

## Terminal Formatting

- NEVER use blockquote syntax (`>`) — unreadable in dark terminals
- NEVER use backticks for emphasis on regular words — use **bold**
- Backticks only for code, file paths, and command references

## Language

Follow the Language Policy in CLAUDE.md.
