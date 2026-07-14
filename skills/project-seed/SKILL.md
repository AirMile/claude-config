---
name: project-seed
description: Use with /project-seed to turn an idea, design, or task into a structured seed document — new concepts, design/spec implementation, or feature scoping.
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
  version: 1.9.0
  category: project
---

# Seed

Transform any idea, concept, feature, or task assignment into a structured seed document through targeted questions and synthesis. Works with any type of input — creative concepts (games, stories, art), product ideas (apps, services, businesses), feature requests, or task assignments. Can also sync existing seed documents with the current project state (backlog, codebase).

The output is a structured markdown document that can be used as input for `/project-plan`, `/project-brainstorm`, or `/project-critique`.

## When to Use

- User starts with `/project-seed` (with or without description)
- **Concept**: vague idea (game, story, product, app, service) that needs articulation
- **Implementation project**: existing design/Figma/spec needs to be scoped for build
- **Feature/Assignment**: task or large feature needs scoping before planning

## Process

### PHASE 1: Initial Intake

> **Todo**: Read `.claude/skills/project-seed/references/initial-intake.md`

### Enter Plan Mode

Follow [shared/PLAN-MODE.md](../shared/PLAN-MODE.md) Entry protocol before PHASE 2 (explore route only — the PHASE 1 "Sync with project" route ends in its own writes and stays outside plan mode). PHASES 2-4 run in plan mode: the question rounds must run inside plan mode so model routers (e.g. `opusplan`) route them through the planning model; the concept document (PHASE 4) is written to the plan file for review. Skip the call if plan mode is already active (see PLAN-MODE.md skip-check).

### PHASE 2: Explore and Expand

Develop the idea through rounds of concrete, clickable questions. Question content depends on **scope** (set in PHASE 1a). Rounds are suggestions — the user decides when there's enough context.

**Setup:**

1. Determine scope from PHASE 1a: `concept` | `implementation` | `feature` | `page` | `standalone`
2. Pick the matching Round 1 template below
3. All questions go in a single message as parallel AskUserQuestion calls

**Round 1 templates (pick by scope):**

**Scope = concept** (new idea/product/game/story):

```yaml
header: "Target Audience" # who is this for?
header: "Scope" # how large/ambitious?
header: "Core Experience" # most important feeling/outcome? (multiSelect: true)
header: "Session Model" # typical use/session? (optional 4th question)
```

**Scope = implementation** (Figma/design/spec → code):

```yaml
header: "Source of Truth" # what defines the design? (Figma, screenshots, existing site, spec doc)
header: "Pages/Screens" # what's in scope? (list from design or "unknown — investigate")
header: "Tech Stack" # confirm framework/CMS/integrations (or "use repo defaults")
header: "Open Decisions" # known open questions from the design? (annotations, TBDs)
```

**Scope = feature** (feature from backlog or assignment):

```yaml
header: "Goal" # what must this feature achieve?
header: "Existing Context" # what's already in the codebase?
header: "Out of Scope" # explicit exclusions?
header: "Definition of Done" # acceptance criteria?
```

**Scope = page / standalone:** use concept template, skip "Session Model".

**Note:** The templates above are guides — headers only. Every question and option MUST be specific to THIS scope instance. Derive concrete, relevant options from the available context (design file, backlog item, conversation).

**After each round**, use AskUserQuestion:

```yaml
header: "Deeper Dive"
question: "Do you want to explore more aspects?"
options:
  - label: "Another round (Recommended)", description: "Explore more aspects of the idea"
  - label: "Proceed to summary", description: "There is enough context for a good concept"
multiSelect: false
```

- **If "Another round":** formulate 2-4 targeted follow-up questions based on gaps from previous rounds
- **If "Proceed to summary":** proceed to PHASE 3

**Follow-up round focus areas:**

- Features/mechanics specifics
- Differentiation (what makes it unique)
- Style/atmosphere/tone
- Motivation system or engagement model
- Any direction the user showed interest in

**Conversational flexibility:**

The user may respond to questions in unexpected ways — asking their own questions, going deeper on one specific topic, or skipping questions entirely. Follow the conversation naturally. The rounds provide structure, not a rigid script.

**Further rounds:**

Same pattern: present the "Deeper Dive" AskUserQuestion after each round. As rounds progress, switch the recommended option to "Proceed to summary" when enough context has been gathered (typically after 2-3 rounds).

**Question rules** (form choice, anchoring, and escalation: [shared/QUESTIONING.md](../shared/QUESTIONING.md) — clickable rounds are the default here; switch to a single anchored open question for generative aspects like vision, tone, story, or naming/title per that protocol):

- NEVER use meta-options ("Answer questions", "Fewer questions")
- Each question = separate AskUserQuestion with concrete, clickable options
- Options are specific to THIS idea, not generic
- Recommended option = most likely answer based on context so far
- "Other" is built-in — user can always type custom input
- `multiSelect: true` where multiple answers make sense
- Maximum 4 questions per round (parallel in one message)
- Ask for concrete details, not abstract concepts
- Adapt question style to idea type (game vs product vs story)
- Help articulate what's in the user's head
- Save criticism or expansion for later--this phase is pure idea capture

---

### PHASE 3: Synthesize and Confirm

1. Present ONE structured overview of all gathered input: a scope-matching aspect table (concept/standalone/page: Topic, Scope, Target Audience, Core Experience, Deeper Dives · implementation: Topic, Source of Truth, Pages in Scope, Tech Stack, Open Decisions · feature: Topic, Goal, Existing Context, Out of Scope, Definition of Done) followed by a concise summary.
2. AskUserQuestion: "Correct, generate output (Recommended)" / "Another round" (back to PHASE 2) / "Adjust" (correct a specific point). Loop until confirmed.
3. **Depth guard:** if the confirmed summary covers fewer than 3 distinct content aspects (e.g. only title + vague description), recommend one extra PHASE 2 round before generating output.

### PHASE 4: Generate Output

Create a structured markdown document (pure markdown, no preamble or "Here's your document:" framing; `#` title, `##` sections). Required: **Title** (H1), **Short description** (1-2 sentences), **Core concept**. Additional sections by type:

- Creative concepts (games, stories, art): Characters, Mechanics/Gameplay, Narrative/Plot, Aesthetic/Style, Tone and Atmosphere, Unique Elements
- Product ideas (apps, services, businesses): Target Audience, Key Features, User Journey/Experience, Value Proposition, Differentiation
- Implementation projects (design → code): Source of Truth, Page/Screen Structure, Tech Stack, Implementation Approach, Open Decisions
- Features/assignments (scoped work in an existing project): Goal, Existing Context, Out of Scope, Constraints/Dependencies, Definition of Done

**End of thinking phase**: follow [shared/PLAN-MODE.md](../shared/PLAN-MODE.md) Exit protocol — write the concept document to the plan file, then `ExitPlanMode`. After approval the skill continues with PHASE 5 (output destination and `.project/` writes).

### PHASE 5: Output Destination

> **Todo**: Read `.claude/skills/shared/THINKING-OUTPUT.md` — caller `project-seed`, `{kind}` = `idea`. Follow the scope routing and seed save procedure there.

---

## Best Practices

### Terminal Formatting

- NEVER use blockquote syntax (`>`) for displaying content — causes unreadable white background in dark terminals
- NEVER use inline code backticks for emphasis on regular words — use **bold** or plain text
- Backticks only for actual code, file paths, and command references

### Language

Follow the Language Policy in CLAUDE.md.
