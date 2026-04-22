---
name: thinking-decide
description: >-
  Structured decision-making framework. Invoke when user needs help weighing
  trade-offs between options, comparing pros and cons, or making a strategic
  choice between approaches. Ideal for architecture decisions, technology
  choices, and any significant afweging where multiple valid options exist.
  Surfaces assumptions, generates alternatives, steelmans the strongest
  counterargument, and delivers a confidence-rated recommendation. Not for
  trivial choices like naming or formatting.
metadata:
  author: mileszeilstra
  version: 1.0.0
  category: thinking
---

# Decide

Structured decision-making for important choices. Forces explicit reasoning through 4 steps: surface assumptions, generate alternatives, steelman the counterargument, then recommend.

**Trigger:** `/thinking-decide` or `/thinking-decide [question or decision]`

## When to Use

- Architecture or technology choices
- Trade-off decisions with multiple valid options
- When you notice yourself defaulting to the first reasonable answer
- Strategic decisions (scope, approach, priorities)
- Any decision where getting it wrong is costly

NOT for: trivial choices, code formatting, simple bug fixes.

## Workflow

### Step 1: Capture the Decision

**If argument provided** (`/thinking-decide which database for this project?`):

- Use the argument as the decision to analyze.

**If no argument** (`/thinking-decide`):

- Analyze the conversation history:
  - What decision or question is being discussed?
  - What context has been established?
  - What constraints exist?
- Synthesize into a concise decision statement.
- Present to user:

  ```
  DECISION DETECTED

  [concise decision statement from conversation]
  ```

- Use AskUserQuestion to confirm:

  ```yaml
  header: "Decision"
  question: "Klopt deze beslissing?"
  options:
    - label: "Ja, klopt (Recommended)", description: "Analyseer deze beslissing"
    - label: "Aanpassen", description: "Ik wil de vraag anders formuleren"
  multiSelect: false
  ```

- If "Aanpassen": ask user for revised decision statement, then proceed.

### Step 1a: Scope Detection (if .project exists)

Na de beslissing vastgesteld, check voor project-context:

1. Check of `.project/project-concept.md` bestaat (primary) of `.project/project.json` een non-empty `concept.content` heeft (legacy fallback)
2. Check of `.project/backlog.html` bestaat
3. Check of `.project/features/` mappen bevat

Als scope-context gevonden:

```yaml
header: "Scope"
question: "Waar gaat deze beslissing over?"
options:
  - label: "Project-breed (Recommended)", description: "Architectuur, tech stack, of strategie beslissing"
  - label: "Feature-specifiek", description: "Beslissing over een specifieke feature"
  - label: "Losse beslissing", description: "Niet gekoppeld aan het project"
multiSelect: false
```

**If "Feature-specifiek":**

- Lees `.project/backlog.html`, parse JSON uit `<script id="backlog-data">` blok (zie `shared/BACKLOG.md`), toon features met status TODO of DOING
- AskUserQuestion om feature te kiezen
- Laad feature context: `01-define.md`, `thinking.md` (als ze bestaan)
- Feature context meegeven als achtergrond bij de beslissing

**If "Project-breed":**

- Laad concept uit `.project/project-concept.md` als achtergrond
- Beslissing gaat over het hele project

**If "Losse beslissing":**

- Geen extra context laden

**Output-pad volgt automatisch de scope:**

- Scope = feature → schrijf naar `.project/features/{naam}/decisions.md` (append)
- Scope = project → schrijf naar `.project/thinking/{today}-decision-{slug}.md`
- Scope = los → schrijf naar `.project/thinking/{today}-decision-{slug}.md`

### CHECKPOINT: Decision Samenvatting

Na het vaststellen van de beslissing en scope, presenteer een overzicht:

| Aspect     | Waarde                                    |
| ---------- | ----------------------------------------- |
| Beslissing | {decision statement}                      |
| Scope      | {project-breed / feature-specifiek / los} |
| Context    | {relevante project/feature context}       |

Vraag via AskUserQuestion: "Klopt dit voordat we de analyse starten?"

- "Ga door (Recommended)" — door naar gestructureerde analyse
- "Aanpassen" — herformuleer de beslissing

### Step 2: Structured Analysis — 4 Steps

Analyze the decision through exactly 4 steps. Each step has a specific purpose. Do NOT skip steps or combine them.

---

**Step 2a: ASSUMPTIONS**

Analyze:

- What assumptions am I making about what the user actually wants (vs what they said)?
- What assumptions about the context and constraints?
- What assumptions about feasible solutions and priorities?
- What information do I have vs what am I filling in?

List at least 3 explicit assumptions. For each, note whether it's validated or unvalidated.

**Quality check:** If fewer than 3 assumptions, the decision may be too narrow — reconsider the framing.

---

**Step 2b: ALTERNATIVES**

Generate genuinely different approaches:

- Minimum 3 alternatives
- Must include "do nothing / status quo" as an option
- Alternatives must be DIFFERENT directions, not variations of the same approach
- For each: 1 sentence description + key trade-off

**Quality check:** If all alternatives are variations of the same approach (e.g., "use library A" vs "use library B" vs "use library C"), push for a structurally different option (e.g., "build custom" or "avoid the problem entirely").

Identify which alternative seems strongest at first glance — this becomes the target for Step 2c.

---

**Step 2c: STEELMAN**

Construct the strongest possible case AGAINST the preferred alternative from step 2b.

This is NOT a weak objection to dismiss. This is the strongest possible argument someone smart and informed could make against this choice. Include concrete scenarios where it fails, hidden costs, second-order effects, or fundamental flaws in the reasoning.

Rate the severity:

- Dealbreaker: fundamentally undermines the approach
- Significant: real concern that needs mitigation
- Manageable: valid but addressable

If dealbreaker: reconsider which alternative is actually best.

**Quality check:** If the steelman is weak or easily dismissed, it's not a real steelman. Push harder. A good steelman makes you genuinely uncomfortable with the preferred option.

---

**Step 2d: RECOMMENDATION**

Based on assumptions (step 2a), alternatives (step 2b), and the steelman (step 2c), determine:

- Recommended approach and why this over alternatives (reference specific trade-offs)
- Honest trade-offs we accept
- Unvalidated assumptions that could change the recommendation
- Confidence: High/Medium/Low with 1-sentence rationale

---

### Step 3: Present Output

After completing all 4 analysis steps, present a visual decision flow as ASCII diagram (options → assumptions → steelman → recommendation), followed by a compact summary:

```
THINK: [decision statement]

AANNAMES
- [assumption 1] (validated/unvalidated)
- [assumption 2] (validated/unvalidated)
- [assumption 3] (validated/unvalidated)

ALTERNATIEVEN
1. [approach] — [key trade-off]
2. [approach] — [key trade-off]
3. [approach] — [key trade-off]
4. Status quo — [key trade-off]

STAALMAN (tegen [preferred option])
[2-3 sentence strongest counterargument]
Severity: [Dealbreaker/Significant/Manageable]

AANBEVELING: [choice]
- [1-2 sentence rationale]
- Trade-offs: [what we accept]
- Confidence: [High/Medium/Low]
- Check: [unvalidated assumption that matters most]
```

Use AskUserQuestion:

```yaml
header: "Beslissing"
question: "Hoe wil je verder?"
options:
  - label: "Akkoord (Recommended)", description: "Ga verder met de aanbeveling"
  - label: "Ander alternatief", description: "Kies een van de andere alternatieven"
  - label: "Dieper graven", description: "Onderzoek een specifiek punt verder"
multiSelect: false
```

**Response handling:**

- "Akkoord" → proceed with recommendation, continue conversation
- "Ander alternatief" → ask which one, briefly explain implications, proceed
- "Dieper graven" → ask which point, analyze further in depth

**Dashboard sync — thinking log** (zie `shared/DASHBOARD.md`):

**If scope = feature (uit Step 1a):**

1. Schrijf volledige analyse naar `.project/features/{naam}/decisions.md` (append als bestand al bestaat)

De feature-koppeling wordt vastgelegd in `feature.json` → `durableDecisions[]` (zie `Feature scope koppeling` verderop). Geen `project.json` `thinking[]` append nodig.

**If scope = project of los (of geen scope gekozen):**

1. Schrijf volledige analyse naar `.project/thinking/{today}-decision-{slug}.md`

De markdown in `.project/thinking/` is de bron van waarheid. Geen `project.json` `thinking[]` append voor deze scope — skills die thinking-output consumeren (zoals `/dev-define`) lezen rechtstreeks uit `.project/thinking/*.md`.

**Feature scope koppeling:** als de beslissing in de context van een actieve feature valt (via Step 1a scope of via `.project/session/active-*.json`), push ook naar `feature.json` → `durableDecisions[]`:

```json
{
  "decision": "{beslissing titel}",
  "chosen": "{gekozen optie}",
  "rationale": "{waarom, 1-2 zinnen}",
  "date": "{today}"
}
```

Lees `.project/features/{feature-name}/feature.json`, initialiseer `durableDecisions` als `[]` indien nodig, push entry, schrijf terug.

## Best Practices

### Quality Over Speed

- Each analysis step should contain real analysis, not template-filling
- If a step produces shallow output, the skill is not adding value — be rigorous
- The steelman step is the most important — if it's weak, the whole exercise is theater

### When to Revise

- If step 2c reveals the preferred option from step 2b is fundamentally flawed — go back and reconsider alternatives
- If step 2d's confidence is "Low" — revisit step 2b to find better alternatives

### Keep It Lean

- Total execution: 4 analysis steps + 1 summary
- No file generation — output stays in the conversation
- No parallel agents — this is a single-model reasoning exercise

### Terminal Formatting

- NEVER use blockquote syntax (`>`) for displaying content — causes unreadable white background in dark terminals
- NEVER use inline code backticks for emphasis on regular words — use **bold** or plain text
- Backticks only for actual code, file paths, and command references

### Language

Follow the Language Policy in CLAUDE.md.
