---
name: project-seed
description: Transform any idea, design, or task into a structured seed document. Handles new concepts (game/app/idea), implementation projects (Figma/spec → code scope), and feature/assignment scoping. Use with /project-seed.
metadata:
  author: claude-config
  version: 1.3.0
  category: project
---

# Seed

Transform any idea, concept, feature, or task assignment into a structured seed document through targeted questions and synthesis. Works with any type of input — creative concepts (games, stories, art), product ideas (apps, services, businesses), feature requests, or task assignments. Can also sync existing seed documents with the current project state (backlog, codebase).

The output is a structured markdown document that can be used as input for `/project-backlog`, `/project-brainstorm`, or `/project-critique`.

## When to Use

- User starts with `/project-seed` (with or without description)
- **Concept**: vague idea (game, story, product, app, service) that needs articulation
- **Implementation project**: existing design/Figma/spec needs to be scoped for build
- **Feature/Assignment**: task or large feature needs scoping before planning

## Process

### Step 1: Initial Intake

> **Todo**: Read `.claude/skills/project-seed/references/initial-intake.md`

### Step 2: Explore and Expand

Develop the idea through rounds of concrete, clickable questions. Question content depends on **scope** (set in Step 1a). Rounds are suggestions — the user decides when there's enough context.

**Setup:**

1. Determine scope from Step 1a: `concept` | `implementation` | `feature` | `page` | `standalone`
2. Pick the matching Round 1 template below
3. All questions go in a single message as parallel AskUserQuestion calls

**Round 1 templates (pick by scope):**

**Scope = concept** (new idea/product/game/story):

```yaml
header: "Target Audience"    # who is this for?
header: "Scope"              # how large/ambitious?
header: "Core Experience"    # most important feeling/outcome? (multiSelect: true)
header: "Session Model"      # typical use/session? (optional 4th question)
```

**Scope = implementation** (Figma/design/spec → code):

```yaml
header: "Source of Truth"    # what defines the design? (Figma, screenshots, existing site, spec doc)
header: "Pages/Screens"      # what's in scope? (list from design or "unknown — investigate")
header: "Tech Stack"         # confirm framework/CMS/integrations (or "use repo defaults")
header: "Open Decisions"     # known open questions from the design? (annotations, TBDs)
```

**Scope = feature** (feature from backlog or assignment):

```yaml
header: "Goal"               # what must this feature achieve?
header: "Existing Context"   # what's already in the codebase?
header: "Out of Scope"       # explicit exclusions?
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
- **If "Proceed to summary":** proceed to Step 3

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

**Question rules:**

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

### CHECKPOINT: Idea Summary

After the question rounds, present a structured overview of all gathered input before synthesis begins. Use the scope-matching table:

**Scope = concept / standalone / page:**

| Aspect          | Value                                   |
| --------------- | --------------------------------------- |
| Topic           | {idea title/topic}                      |
| Scope           | {concept / page / standalone}           |
| Target Audience | {from round 1}                          |
| Core Experience | {from round 1}                          |
| Deeper Dives    | {summary of follow-up rounds}           |

**Scope = implementation:**

| Aspect           | Value                                    |
| ---------------- | ---------------------------------------- |
| Topic            | {project / product name}                 |
| Scope            | implementation                           |
| Source of Truth  | {Figma / spec / screenshots / existing}  |
| Pages in Scope   | {list from round 1}                      |
| Tech Stack       | {confirmed stack}                        |
| Open Decisions   | {TBDs / annotation gaps}                 |

**Scope = feature / assignment:**

| Aspect              | Value                              |
| ------------------- | ---------------------------------- |
| Topic               | {feature / assignment name}        |
| Scope               | feature                            |
| Goal                | {from round 1}                     |
| Existing Context    | {from round 1}                     |
| Out of Scope        | {from round 1}                     |
| Definition of Done  | {from round 1}                     |

Ask via AskUserQuestion: "Does this overview look right before we summarize?"

- "Proceed to summary (Recommended)" — proceed to synthesis
- "Another round" — back to Step 2 for extra questions
- "Adjust" — correct a specific point

### Enter Plan Mode

Follow [shared/PLAN-MODE.md](../shared/PLAN-MODE.md) Entry protocol before Step 3. Steps 3-4 (synthesis + output generation) run in plan mode; the concept document (Step 4) is written to the plan file for review.

---

### Step 3: Synthesize and Confirm

1. Create a concise summary based on all input
2. Present summary to user
3. Use AskUserQuestion for confirmation:
   ```yaml
   options:
     - label: "Correct, generate output (Recommended)", description: "Summary is correct, proceed to markdown output"
     - label: "Adjust", description: "I want to change or add something"
     - label: "Re-summarize", description: "Create a new summary"
   multiSelect: false
   ```
4. Incorporate feedback if needed
5. Repeat until user confirms
6. **Depth guard:** If the confirmed summary covers fewer than 3 distinct content aspects (e.g. only has title + vague description), suggest returning to Step 2 for an additional round:
   ```yaml
   header: "More depth needed"
   question: "The summary is still quite thin. Do you want another question round for more depth?"
   options:
     - label: "Yes, extra round (Recommended)", description: "Back to Step 2 for more details"
     - label: "No, continue", description: "Generate output with current content"
   multiSelect: false
   ```

### Step 4: Generate Output

Create a structured markdown document adapted to the scope/type.

**Required sections:**

- **Title** (H1 format)
- **Short description** (1-2 sentences)
- **Core concept** (detailed explanation)

**Additional sections by scope/type:**

For creative concepts (games, stories, art):

- Characters, Mechanics/Gameplay, Narrative/Plot, Aesthetic/Style, Tone and Atmosphere, Unique Elements

For product ideas (apps, services, businesses):

- Target Audience, Key Features, User Journey/Experience, Value Proposition, Differentiation

For implementation projects (design → code, spec → build):

- Source of Truth, Page/Screen Structure, Tech Stack, Implementation Approach, Open Decisions

For features/assignments (scoped work within an existing project):

- Goal, Existing Context, Out of Scope, Constraints/Dependencies, Definition of Done

**Output format:**

- Pure markdown without introductory text or preambles
- No "Here's your document:" framing
- Proper markdown formatting (# for title, ## for sections)

**End of thinking phase**: follow [shared/PLAN-MODE.md](../shared/PLAN-MODE.md) Exit protocol — write the concept document to the plan file, then `ExitPlanMode`. After approval the skill continues with Step 5 (output destination and `.project/` writes).

### Step 5: Output Destination

> **Todo**: Read `.claude/skills/project-seed/references/output-destination.md`

---

## Best Practices

**Questions:** Be conversational, adapt dynamically, dig deeper where user shows excitement, extract vision without imposing constraints.

**Synthesis:** Be accurate to what user said, don't add assumptions, confirm before proceeding.

**Output:** Structure clearly, make scannable, adapt sections to idea type, output ONLY the markdown document.

### Terminal Formatting

- NEVER use blockquote syntax (`>`) for displaying content — causes unreadable white background in dark terminals
- NEVER use inline code backticks for emphasis on regular words — use **bold** or plain text
- Backticks only for actual code, file paths, and command references

### Language

Follow the Language Policy in CLAUDE.md.
