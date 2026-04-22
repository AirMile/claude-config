---
name: core-audit
description: >-
  Analyze and refine skills for clarity, correctness, and effectiveness. Detects
  redundancy, dead paths, ambiguity, and poor structure. Optional internal
  walkthrough for deeper insights. Use with /core-audit or /core-audit [skill-name].
argument-hint: "[skill-name]"
disable-model-invocation: true
metadata:
  author: mileszeilstra
  version: 1.0.0
  category: core
---

# Audit

Analyze skills for quality. Two modes: quick (analysis only) or extended (internal walkthrough + analysis).

**Trigger**: `/core-audit` or `/core-audit [skill-name]`

## Step 1: Load Skill

**If name provided** (`/core-audit dev-build`):

1. Load `.claude/skills/[name]/SKILL.md`
2. If not found → show error with available skills

**If no name** (`/core-audit`):

1. Scan the conversation above for skill invocations (slash commands like `/dev-build`, `/core-edit`, etc.).
2. If **exactly one** unique skill was invoked → auto-select that skill and show:

   ```
   AUTO-DETECTED: [name] (from conversation)
   ```

3. If zero or multiple distinct skills were invoked → list all skills:

   ```bash
   find -L .claude/skills -name "SKILL.md" -type f 2>/dev/null | sed 's|^\.claude/skills/||' | sed 's|/SKILL\.md$||' | sort
   ```

   Display numbered list, ask user to pick.

**After loading, show:**

```
LOADED: [name]
[one-line summary from description]
Sections: [count] | Has resources: [yes/no]
```

## Step 1.5: Context Detection

Scan for prior skill execution that can inform testing:

1. **Conversation context** — check if the target skill (or a skill from the same pipeline) was invoked earlier in this conversation (e.g., a `/dev-build` invocation when refining `dev-build`)
2. **devinfo.json** — read `.project/session/devinfo.json` if it exists; check `executionPlan` for completed skills matching the target or its pipeline

**Detection signals:**

- Target skill name appears in conversation as a slash command invocation
- devinfo.json `executionPlan` contains the target skill with status "completed"
- devinfo.json `executionPlan` contains a skill from the same pipeline (e.g., `dev-define` when refining `dev-build`)

**If context detected, show:**

```
CONTEXT DETECTED

Source: [conversation | devinfo.json | both]
Skill(s) found: [list of detected skills with status]
Artifacts: [relevant files/outputs if available from devinfo]

This context will be used for the walkthrough if extended mode is selected.
```

**If no context detected:** proceed silently to Step 2.

## Step 2: Choose Mode

Use **AskUserQuestion**:

**If context was detected in Step 1.5:**

- header: "Modus"
- question: "Er is context beschikbaar uit een eerdere skill-uitvoering. Hoe wil je de skill analyseren?"
- options:
  - label: "Uitgebreid met walkthrough (Recommended)", description: "Interne walkthrough met de gedetecteerde context als basis — levert de meest bruikbare observaties op"
  - label: "Quick analyse", description: "Directe analyse zonder walkthrough — snel, geschikt voor kleine skills"
- multiSelect: false

**If no context detected:**

- header: "Modus"
- question: "Hoe wil je de skill analyseren?"
- options:
  - label: "Quick analyse (Recommended)", description: "Directe analyse zonder walkthrough — snel, geschikt voor kleine skills"
  - label: "Uitgebreid met walkthrough", description: "Eerst een interne walkthrough, dan analyse met bevindingen"
- multiSelect: false

## Step 3: Internal Walkthrough (only if "Uitgebreid met walkthrough")

**Skip to Step 4 if quick mode selected.**

### 3.1 Define Scenario

**If context was detected in Step 1.5** — use the real execution as basis:

- Build scenario from the actual skill invocation and its outcomes
- Reference real artifacts (files created, decisions made, errors encountered)
- If devinfo.json has handoff data or file tracking, incorporate those specifics

**If no context detected** — fabricate a realistic scenario:

- Pick a use case that exercises the skill's main workflow
- Include at least one edge case or decision point

**Show scenario:**

```
WALKTHROUGH SCENARIO

Scenario: [description]
Context: [real: based on prior execution | simulated: fabricated]
[If real: list key artifacts/decisions from the detected context]
```

### 3.2 Trace Through Skill

Mentally execute the skill step by step against the scenario. For each step:

- Follow branching logic exactly as written
- At each AskUserQuestion → assume a realistic user choice, note the options
- At each output block → verify it can be populated with available data
- Flag where instructions are ambiguous, missing, or require improvisation
- Flag where the flow breaks or produces unexpected results

Do NOT interact with the user during the walkthrough — this is an internal analysis.

### 3.3 Report Observations

```
WALKTHROUGH OBSERVATIONS

Flow issues:
- [where instructions were ambiguous or missing]
- [where Claude would need to improvise beyond what was written]

UX issues:
- [awkward phrasing, too many modals, unclear options]

Worked well:
- [parts that flowed naturally]
```

## Step 4: Analysis

Analyze the skill across these dimensions. Score each 1-5.

### 4.1 Redundancy

Instructions that tell Claude what it already knows.

**Redundant (remove):**

- "Parse the JSON response" — Claude knows JSON
- "Use conventional commit format" — Claude knows conventional commits
- "Create a new file using the Write tool" — Claude knows its tools
- Generic best practices ("write clean code", "handle errors")

**NOT redundant (keep):**

- Project-specific conventions ("use BEM with `--` modifier")
- Non-obvious tool behaviors ("Glob doesn't follow Windows junctions")
- Workflow sequences that define THIS skill's unique process
- Constraints that override Claude's defaults

### 4.2 Signal-to-Noise

Ratio of actionable, unique instructions to filler.

**Noise indicators:**

- Explaining concepts Claude already understands
- Verbose templates where a compact format works
- Repeated information across sections
- Excessive examples when one suffices

### 4.3 Dead Paths

- Conditions that can never be true in practice
- Platform-specific code on a single-platform setup
- Error handling for impossible states
- Options nobody would select
- References to files/tools that don't exist

### 4.4 Structure & Flow

- Steps in logical order, top-to-bottom readable
- Related concerns grouped
- Decision points appear before the paths they gate
- No forward references to undefined concepts

### 4.5 Claude-Native Phrasing

- Imperative, direct ("Scan for X" not "You should scan for X")
- Skip explaining WHY for obvious decisions
- Trust Claude to format output unless specific format is critical
- Use domain terminology without defining it

### 4.6 Frontmatter Health

- description: has WHAT + WHEN pattern with trigger phrases?
- name: matches folder, kebab-case?
- metadata: present and complete?
- No security violations (XML brackets, reserved words)?

### 4.7 Walkthrough Findings (only if walkthrough was run)

Integrate observations from Step 3.3:

- Map flow issues to specific lines/sections
- Map UX issues to AskUserQuestion configurations
- Identify instructions that caused improvisation

**Present analysis:**

```
ANALYSIS: [skill-name]

| Dimension | Score | Key Finding |
|-----------|-------|-------------|
| Redundancy | X/5 | [one-line] |
| Signal-to-Noise | X/5 | [one-line] |
| Dead Paths | X/5 | [one-line] |
| Structure | X/5 | [one-line] |
| Claude-Native | X/5 | [one-line] |
| Frontmatter | X/5 | [one-line] |
| Walkthrough | X/5 | [one-line] (only if walkthrough ran)

Overall: [X/30 or X/35] — [Grade: A/B/C/D/F]

TOP FINDINGS:
1. [most impactful finding with location]
2. [second finding]
3. [third finding]
```

### 4.8 Early Exit

If TOP FINDINGS is empty or all dimensions score 4+, the skill needs no refactoring. Show the analysis and stop:

```
ANALYSIS COMPLETE: [skill-name]

No significant findings — skill is in good shape. No changes proposed.
```

Skip Steps 5 and 6.

## Step 5: Iterative Refactor Review

Based on analysis, propose concrete changes — presented **one at a time** for individual approval.

**Refactor principles:**

- Remove what Claude already knows — redundancy reduces signal
- Improve clarity — rephrase confusing or ambiguous instructions
- Remove dead paths — unreachable logic adds noise
- Restructure for top-to-bottom readability
- Preserve all unique, project-specific knowledge
- Keep AskUserQuestion integrations (UX, not noise)
- Don't sacrifice clarity for brevity — if a longer explanation prevents mistakes, keep it

### 5.1 Collect and Classify Changes

Internally compile all proposed changes. Classify each as:

- **Significant** — structural changes, content rewrites, logic modifications, section additions/removals
- **Minor** — formatting, whitespace, phrasing tweaks, typo fixes, small wording improvements

Order significant changes by impact (highest first). Each change should be self-contained — can be accepted or rejected independently. Flag dependencies between changes: if change B requires change A, note this. If a prerequisite change is skipped, auto-skip dependent changes with explanation.

### 5.2 Present Changes

**Significant changes — one by one.** For each, show:

```
CHANGE [n/total]: [short title]

What: [what changes]
Why: [reason — reference analysis dimension/finding]

--- Before ---
[relevant section as-is]

--- After ---
[proposed replacement]
```

Then use **AskUserQuestion**:

- header: "Change [n]/[total]"
- question: "[short title]"
- options:
  - label: "Accept", description: "Apply this change"
  - label: "Skip", description: "Keep the current version"
  - label: "Modify", description: "Adjust this change before applying"
- multiSelect: false

**If "Modify":** ask in plain text what the user wants differently, revise the change, show the updated preview, and re-ask with the same AskUserQuestion.

**Minor changes — batched.** After all significant changes are reviewed, present minor changes as a group:

```
MINOR CHANGES ([count]):

1. [short description of minor change]
2. [short description of minor change]
...
```

Use **AskUserQuestion**:

- header: "Minor changes"
- question: "[count] kleine aanpassingen (formatting, phrasing)"
- options:
  - label: "Accept all", description: "Apply all minor changes"
  - label: "Skip all", description: "Keep current versions"
  - label: "Review individually", description: "Go through them one by one"
- multiSelect: false

If "Review individually" → present each minor change using the same significant change flow above.

### 5.3 Summary and Apply

After all changes have been reviewed, show:

```
REFACTOR SUMMARY: [skill-name]

Accepted: [n]/[total]
- [change title 1]
- [change title 2]

Skipped: [n]/[total]
- [change title 3]
```

Apply only the accepted changes using the Edit tool.

## Step 6: Verify

1. Re-read the modified SKILL.md
2. Validate frontmatter (required fields, description pattern, security)
3. Check referenced files still exist (if skill has resources)
4. Show summary:

```
REFINED: [skill-name]

Changes applied: [accepted]/[total proposed]
- [change title 1]
- [change title 2]

Frontmatter: [valid/issues found]
Resources: [ok/missing files]
```
