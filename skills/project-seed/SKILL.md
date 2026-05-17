---
name: project-seed
description: Transform any idea into a structured seed document. Use with /project-seed.
metadata:
  author: claude-config
  version: 1.2.0
  category: project
---

# Seed

Transform any idea, concept, feature, or task assignment into a structured seed document through targeted questions and synthesis. Works with any type of input — creative concepts (games, stories, art), product ideas (apps, services, businesses), feature requests, or task assignments. Can also sync existing seed documents with the current project state (backlog, codebase).

The output is a structured markdown document that can be used as input for `/project-backlog`, `/project-brainstorm`, or `/project-critique`.

## When to Use

- User starts with `/project-seed` (with or without description)
- User has a vague concept that needs articulation
- User wants to develop a game, story, product, app, service, or creative project concept
- User has a task assignment or large feature that needs scoping before planning

## Process

### Step 1: Initial Intake

> **Todo**: Read `.claude/skills/project-seed/references/initial-intake.md`

### Step 2: Explore and Expand

Develop the idea through rounds of concrete, clickable questions. Rounds are suggestions — the user decides when there's enough context.

**Setup:**

1. Determine idea type (creative concept, product, service, etc)
2. Plan questions for the first round

**Round 1 - Foundation (3-4 questions in parallel):**

Formulate 3-4 fundamental questions about the idea. Present ALL questions in a single message, each as a separate AskUserQuestion:

```yaml
# Question 1
header: "Target Audience"
question: "Who is this intended for?"
options:
  - label: "{specific audience A} (Recommended)", description: "{why this fits}"
  - label: "{specific audience B}", description: "{why this fits}"
  - label: "{specific audience C}", description: "{why this fits}"
multiSelect: false

# Question 2
header: "Scope"
question: "How large do you see this?"
options:
  - label: "{scope option A} (Recommended)", description: "{what this means}"
  - label: "{scope option B}", description: "{what this means}"
multiSelect: false

# Question 3
header: "Core Experience"
question: "What is the most important feeling/result?"
options:
  - label: "{experience A} (Recommended)", description: "{concrete example}"
  - label: "{experience B}", description: "{concrete example}"
  - label: "{experience C}", description: "{concrete example}"
multiSelect: true

# Question 4 (optional)
header: "Session Model"
question: "What does a typical session look like?"
options:
  - label: "{session type A} (Recommended)", description: "{details}"
  - label: "{session type B}", description: "{details}"
multiSelect: false
```

**Note:** The examples above are templates. Every question and option MUST be specific to THIS idea. Derive concrete, relevant options from the idea context.

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

After the question rounds, present a structured overview of all gathered input before synthesis begins:

| Aspect          | Value                                   |
| --------------- | --------------------------------------- |
| Topic           | {idea title/topic}                      |
| Scope           | {concept / feature / page / standalone} |
| Target Audience | {from round 1}                          |
| Core Experience | {from round 1}                          |
| Deeper Dives    | {summary of follow-up rounds}           |

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

Create a structured markdown document adapted to the idea type.

**Required sections:**

- **Title** (H1 format)
- **Short description** (1-2 sentences)
- **Core concept** (detailed explanation)

**Additional sections by type:**

For creative concepts (games, stories, art):

- Characters, Mechanics/Gameplay, Narrative/Plot, Aesthetic/Style, Tone and Atmosphere, Unique Elements

For product ideas (apps, services, businesses):

- Target Audience, Key Features, User Journey/Experience, Value Proposition, Differentiation

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

**AskUserQuestion:**

- NEVER use meta-options ("Answer questions", "Fewer questions")
- Each question = separate AskUserQuestion with concrete options
- Options specific to the idea, not generic
- `multiSelect: true` when multiple answers are valid
- Up to 4 questions parallel per round
- Recommended option = most contextually likely answer

### Terminal Formatting

- NEVER use blockquote syntax (`>`) for displaying content — causes unreadable white background in dark terminals
- NEVER use inline code backticks for emphasis on regular words — use **bold** or plain text
- Backticks only for actual code, file paths, and command references

### Language

Follow the Language Policy in CLAUDE.md.
