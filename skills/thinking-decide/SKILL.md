---
name: thinking-decide
description: >-
  Structured decision-making framework. Invoke when user needs help weighing
  trade-offs between options, comparing pros and cons, or making a strategic
  choice between approaches. Ideal for architecture decisions, technology
  choices, and any significant trade-off where multiple valid options exist.
  Surfaces assumptions, generates alternatives, steelmans the strongest
  counterargument, and delivers a confidence-rated recommendation. Not for
  trivial choices like naming or formatting.
metadata:
  author: claude-config
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
  question: "Does this decision look right?"
  options:
    - label: "Yes, correct (Recommended)", description: "Analyze this decision"
    - label: "Adjust", description: "I want to phrase the question differently"
  multiSelect: false
  ```

- If "Adjust": ask user for revised decision statement, then proceed.

### Step 1.5: Past Decision Check (if .project exists)

Prevents a previously rejected or already-made decision from being re-analyzed without the prior context being visible.

1. Glob `.project/features/*/feature.json` — flatten all `durableDecisions[]` arrays.
2. Glob `.project/thinking/*-decision-*.md` — extract `THINK:` line + chosen option + constraint from each file (first ~30 lines are sufficient).
3. Fuzzy match against current decision statement: keyword-overlap on decision title, chosen option, or constraint (≥2 substantive terms overlap).
4. If ≥1 match, AskUserQuestion:

   ```yaml
   header: "Previously decided?"
   question: "Previously decided: {decision title} → chose {chosen} (constraint: {constraint}). Is this the same context?"
   options:
     - label: "Same context (Recommended)", description: "Reuse previous decision, skip new analysis"
     - label: "Constraint is different", description: "Note new constraint, continue with analysis"
     - label: "Not relevant", description: "Different decision, continue with analysis"
   multiSelect: false
   ```

   - **Same context** → show previous analysis (markdown content or durableDecisions entry). Ask "anything to add?" If no: stop skill with reference to source file.
   - **Constraint is different** → ask for new constraint, note as starting point for Step 2. Continue to Step 1a.
   - **Not relevant** → continue to Step 1a.

5. If 0 matches: silent no-op, continue to Step 1a.

If ≥2 matches: show only the top 2 most relevant (highest keyword-overlap), not all.

### Step 1a: Scope Detection (if .project exists)

After the decision is established, check for project context:

1. Check if `.project/project-seed.md` exists (primary) or `.project/project.json` has non-empty `concept.content` (legacy fallback)
2. Check if `.project/backlog.html` exists
3. Check if `.project/features/` contains folders

**Learnings load** via [shared/LEARNINGS-LOAD.md](../shared/LEARNINGS-LOAD.md):

```
scopes: [architectural]
pitfall-prefix: true
current-feature: <feature-name if feature-specific scope, otherwise "none">
```

Architectural patterns (own project) guide the trade-off — decisions that conflict with proven patterns receive a lower confidence rating. Pitfall-prefix makes previous bugs visible so options that repeat them are rejected.

If scope context found:

```yaml
header: "Scope"
question: "What is this decision about?"
options:
  - label: "Project-wide (Recommended)", description: "Architecture, tech stack, or strategy decision"
  - label: "Feature-specific", description: "Decision about a specific feature"
  - label: "Standalone decision", description: "Not linked to the project"
multiSelect: false
```

**If "Feature-specific":**

- Read `.project/backlog.html`, parse JSON from `<script id="backlog-data">` block (see `shared/BACKLOG.md`), show features with status TODO or DOING
- AskUserQuestion to choose feature
- Load feature context: `01-define.md`, `thinking.md` (if they exist)
- Pass feature context as background for the decision

**If "Project-wide":**

- Load concept from `.project/project-seed.md` as background
- Decision is about the entire project

**If "Standalone decision":**

- No extra context to load

**Output path follows scope automatically:**

- Scope = feature → write to `.project/features/{name}/decisions.md` (append)
- Scope = project → write to `.project/thinking/{today}-decision-{slug}.md`
- Scope = standalone → write to `.project/thinking/{today}-decision-{slug}.md`

### CHECKPOINT: Decision Summary

After establishing the decision and scope, present an overview:

| Aspect   | Value                                          |
| -------- | ---------------------------------------------- |
| Decision | {decision statement}                           |
| Scope    | {project-wide / feature-specific / standalone} |
| Context  | {relevant project/feature context}             |

Ask via AskUserQuestion: "Does this look right before we start the analysis?"

- "Continue (Recommended)" — proceed to structured analysis
- "Adjust" — reformulate the decision

### Enter Plan Mode

Follow [shared/PLAN-MODE.md](../shared/PLAN-MODE.md) Entry protocol before Step 2. Steps 2-3 (assumptions → alternatives → steelman → recommendation → presentation) run in plan mode; the full analysis (Step 3) is written to the plan file for review.

---

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

ASSUMPTIONS
- [assumption 1] (validated/unvalidated)
- [assumption 2] (validated/unvalidated)
- [assumption 3] (validated/unvalidated)

CONSTRAINT
[The forcing constraint that triggers this choice — not opinion, not preference.
 E.g. "external API has max 10 req/s", "mobile bundle must be <200KB", "team
 has no Rust experience". If there is no real constraint, this probably isn't
 a decision that warrants analysis.]

ALTERNATIVES
1. [approach] — [key trade-off]
2. [approach] — [key trade-off]
3. [approach] — [key trade-off]
4. Status quo — [key trade-off]

STEELMAN (against [preferred option])
[2-3 sentence strongest counterargument]
Severity: [Dealbreaker/Significant/Manageable]

RECOMMENDATION: [choice]
- [1-2 sentence rationale]
- Trade-offs: [what we accept]
- Confidence: [High/Medium/Low]
- Check: [unvalidated assumption that matters most]

REJECTED ALTERNATIVES
- [Option X] — Rejected because [concrete reason, linked to constraint].
- [Option Y] — Rejected because [reason].
[Prevents rejected options from resurfacing as zombie proposals later.
 Skip "status quo" here if it's already explained in the constraint section.]
```

Use AskUserQuestion:

```yaml
header: "Decision"
question: "How do you want to continue?"
options:
  - label: "Agreed (Recommended)", description: "Proceed with the recommendation"
  - label: "Different alternative", description: "Choose one of the other alternatives"
  - label: "Dig deeper", description: "Investigate a specific point further"
multiSelect: false
```

**Response handling:**

- "Agreed" → proceed with recommendation, continue conversation
- "Different alternative" → ask which one, briefly explain implications, proceed
- "Dig deeper" → ask which point, analyze further in depth

**End of analysis phase**: follow [shared/PLAN-MODE.md](../shared/PLAN-MODE.md) Exit protocol — write the full analysis (THINK + ASSUMPTIONS + CONSTRAINT + ALTERNATIVES + STEELMAN + RECOMMENDATION + REJECTED) to the plan file, then `ExitPlanMode`. After approval the skill continues with the dashboard sync and `.project/` writes.

**Dashboard sync — thinking log** (see `shared/DASHBOARD.md`):

**If scope = feature (from Step 1a):**

1. Write full analysis to `.project/features/{name}/decisions.md` (append if file already exists)

The feature link is recorded in `feature.json` → `durableDecisions[]` (see Feature scope link below). No `project.json` `thinking[]` append needed.

**If scope = project or standalone (or no scope chosen):**

1. Write full analysis to `.project/thinking/{today}-decision-{slug}.md`

The markdown in `.project/thinking/` is the source of truth. No `project.json` `thinking[]` append for this scope — skills that consume thinking output (like `/dev-define`) read directly from `.project/thinking/*.md`.

**Feature scope link:** if the decision is in the context of an active feature (via Step 1a scope or via `.project/session/active-*.json`), also push to `feature.json` → `durableDecisions[]`:

```json
{
  "decision": "{decision title}",
  "chosen": "{chosen option}",
  "constraint": "{forcing constraint, 1 sentence}",
  "rationale": "{why, 1-2 sentences}",
  "rejected": [{ "option": "{option name}", "reason": "{brief reason}" }],
  "date": "{today}"
}
```

Read `.project/features/{feature-name}/feature.json`, initialize `durableDecisions` as `[]` if needed, push entry, write back.

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
