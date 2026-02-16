---
name: thinking-decide
description: >-
  Structured decision-making through Sequential Thinking MCP. Use when user
  needs to decide, choose, or pick between options — surfaces assumptions,
  generates alternatives, steelmans counterarguments, and recommends.
metadata:
  author: mileszeilstra
  version: 1.0.0
  category: thinking
---

# Decide

Structured decision-making for important choices. Forces explicit reasoning through 4 steps via Sequential Thinking MCP: surface assumptions, generate alternatives, steelman the counterargument, then recommend.

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

- Analyze the conversation history using sequential thinking:
  - What decision or question is being discussed?
  - What context has been established?
  - What constraints exist?
- Synthesize into a concise decision statement.
- Present to user:

  ```
  DECISION DETECTED

  > [concise decision statement from conversation]
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

### Step 2: Sequential Thinking — 4 Steps

Execute exactly 4 Sequential Thinking calls. Each step has a specific purpose and constraints.

**CRITICAL:** Use the `mcp__sequentialthinking__sequentialthinking` tool for each step. Do NOT skip steps or combine them.

---

**Step 2a: ASSUMPTIONS (thoughtNumber=1, totalThoughts=4)**

Call Sequential Thinking with:

```
thought: "AANNAMES — Decision: [decision statement]

What assumptions am I making about:
- What the user actually wants (vs what they said)
- The context and constraints
- What solutions are feasible
- What the priorities are
- What information I have vs what I'm filling in

Explicit assumptions:
1. [assumption 1]
2. [assumption 2]
3. [assumption 3]
...

Which of these are validated vs unvalidated?"

thoughtNumber: 1
totalThoughts: 4
nextThoughtNeeded: true
```

**Quality check:** The output must contain at least 3 explicit assumptions. If fewer, the decision may be too narrow — reconsider the framing.

---

**Step 2b: ALTERNATIVES (thoughtNumber=2, totalThoughts=4)**

Call Sequential Thinking with:

```
thought: "ALTERNATIEVEN — Generate genuinely different approaches.

Rules:
- Minimum 3 alternatives
- Must include 'do nothing / status quo' as an option
- Alternatives must be DIFFERENT directions, not variations of the same approach
- For each: 1 sentence description + key trade-off

Alternatives:
1. [approach] — Trade-off: [what you gain vs lose]
2. [approach] — Trade-off: [what you gain vs lose]
3. [approach] — Trade-off: [what you gain vs lose]
4. Do nothing / status quo — Trade-off: [what you gain vs lose]

Which alternative seems strongest at first glance? (This becomes the target for Step 3)"

thoughtNumber: 2
totalThoughts: 4
nextThoughtNeeded: true
```

**Quality check:** If all alternatives are variations of the same approach (e.g., "use library A" vs "use library B" vs "use library C"), push for a structurally different option (e.g., "build custom" or "avoid the problem entirely").

---

**Step 2c: STEELMAN (thoughtNumber=3, totalThoughts=4)**

Call Sequential Thinking with:

```
thought: "STAALMAN — The strongest case AGAINST [preferred alternative from step 2].

This is NOT a weak objection to dismiss. This is the strongest possible argument someone smart and informed could make against this choice.

The steelman argument:
[Construct the most compelling case against the preferred option. Include concrete scenarios where it fails, hidden costs, second-order effects, or fundamental flaws in the reasoning.]

How serious is this counterargument?
- Dealbreaker: fundamentally undermines the approach
- Significant: real concern that needs mitigation
- Manageable: valid but addressable

If dealbreaker: reconsider which alternative is actually best."

thoughtNumber: 3
totalThoughts: 4
nextThoughtNeeded: true
```

**Quality check:** If the steelman is weak or easily dismissed, it's not a real steelman. Push harder. A good steelman makes you genuinely uncomfortable with the preferred option.

---

**Step 2d: RECOMMENDATION (thoughtNumber=4, totalThoughts=4)**

Call Sequential Thinking with:

```
thought: "AANBEVELING — Based on assumptions (step 1), alternatives (step 2), and the steelman (step 3):

Recommended approach: [choice]

Why this over alternatives:
- [reason 1, referencing specific trade-offs]
- [reason 2]

Honest trade-offs:
- We accept: [downside 1]
- We accept: [downside 2]

Unvalidated assumptions to check:
- [assumption from step 1 that could change the recommendation]

Confidence: [High/Medium/Low] — [1 sentence why]"

thoughtNumber: 4
totalThoughts: 4
nextThoughtNeeded: false
```

---

### Step 3: Present Output

After all 4 Sequential Thinking steps complete, present a compact summary:

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
- "Dieper graven" → ask which point, use additional Sequential Thinking steps (thoughtNumber=5+, set needsMoreThoughts=true) to explore

## Best Practices

### Quality Over Speed

- Each Sequential Thinking step should contain real analysis, not template-filling
- If a step produces shallow output, the skill is not adding value — be rigorous
- The steelman step is the most important — if it's weak, the whole exercise is theater

### When to Use Branching

- If step 2 produces 2+ equally strong alternatives, use `branchFromThought: 2` to explore each
- If the steelman (step 3) is a dealbreaker, use `isRevision: true, revisesThought: 2` to reconsider alternatives

### When to Use Revision

- If step 3 reveals the preferred option from step 2 is fundamentally flawed
- If step 4's confidence is "Low" — revise step 2 to find better alternatives

### Keep It Lean

- Total execution: 4 Sequential Thinking calls + 1 summary
- No file generation — output stays in the conversation
- No parallel agents — this is a single-model reasoning exercise

### Language

Follow the Language Policy in CLAUDE.md.
