---
name: core-refine
description: >-
  Analyze and refactor skills to be leaner and Claude-native. Detects redundancy,
  dead paths, over-explanation, and poor structure. Optional test simulation for
  deeper insights. Use with /core-refine or /core-refine [skill-name].
argument-hint: "[skill-name]"
disable-model-invocation: true
metadata:
  author: mileszeilstra
  version: 1.0.0
  category: core
---

# Refine

Analyze and refactor skills. Two modes: quick (analysis only) or extended (test simulation + analysis).

**Trigger**: `/core-refine` or `/core-refine [skill-name]`

## Step 1: Load Skill

**If name provided** (`/core-refine dev-build`):

1. Load `.claude/skills/[name]/SKILL.md`
2. If not found → show error with available skills

**If no name** (`/core-refine`):

1. List all skills:

   ```bash
   find -L .claude/skills -name "SKILL.md" -type f 2>/dev/null | sed 's|^\.claude/skills/||' | sed 's|/SKILL\.md$||' | sort
   ```

2. Display numbered list, ask user to pick

**After loading, show:**

```
LOADED: [name]
[one-line summary from description]
Lines: [count] | Sections: [count] | Has resources: [yes/no]
```

## Step 2: Choose Mode

Use **AskUserQuestion**:

- header: "Modus"
- question: "Hoe wil je de skill analyseren?"
- options:
  - label: "Quick analyse (Recommended)", description: "Directe analyse zonder test — snel, geschikt voor kleine skills"
  - label: "Uitgebreid met test", description: "Eerst een dry-run simulatie doorlopen, dan analyse met testdata"
- multiSelect: false

## Step 3: Test Simulation (only if "Uitgebreid met test")

**Skip to Step 4 if quick mode selected.**

### 3.1 Generate Scenario

Analyze the skill and generate a realistic test scenario:

- Pick a use case that exercises the skill's main workflow
- Include at least one edge case or decision point
- Write a brief scenario description

**Present to user:**

```
TEST SCENARIO

Scenario: [description]
Context: [what project/situation we're simulating]

I'll simulate executing this skill. You respond as you normally would.
Ready? Type anything to start.
```

### 3.2 Run Simulation

Execute the skill as written, following its instructions literally:

- At each AskUserQuestion → present it to the user
- At each output block → show it
- Follow branching logic exactly
- Do NOT improvise — if instructions are unclear, note it and make your best guess

### 3.3 Collect Observations

After simulation completes, document:

```
TEST OBSERVATIONS

Flow issues:
- [where instructions were ambiguous or missing]
- [where Claude had to improvise beyond what was written]

UX issues:
- [awkward phrasing, too many modals, unclear options]

Worked well:
- [parts that flowed naturally]
```

## Step 4: Analysis

Use **sequential thinking** to analyze the skill across these dimensions. Score each 1-5.

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

### 4.7 Test Findings (only if test was run)

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
| Test Findings | X/5 | [one-line] (only if test ran)

Overall: [X/30 or X/35] — [Grade: A/B/C/D/F]

TOP FINDINGS:
1. [most impactful finding with location]
2. [second finding]
3. [third finding]
```

## Step 5: Refactor Plan

Based on analysis, propose concrete changes.

**Refactor principles:**

- Remove what Claude already knows — don't explain the obvious
- Shorten verbose instructions to imperative one-liners where possible
- Kill dead paths entirely — don't comment them out
- Restructure for top-to-bottom readability
- Preserve all unique, project-specific knowledge
- Keep AskUserQuestion integrations (UX, not noise)
- Don't sacrifice clarity for brevity — if a longer explanation prevents mistakes, keep it

**Enter plan mode:**

1. Use **EnterPlanMode**
2. Write the refactored SKILL.md to the plan file — full updated content
3. Include a diff summary at the top:

   ```
   REFACTOR SUMMARY: [skill-name]

   Lines: [before] → [after] ([change%])
   Sections: [before] → [after]

   Changes:
   - [change 1: what and why]
   - [change 2: what and why]

   Preserved:
   - [important things intentionally kept]
   ```

4. Use **ExitPlanMode** for user approval

After approval, apply changes with Edit tool.

## Step 6: Verify

1. Re-read the modified SKILL.md
2. Validate frontmatter (required fields, description pattern, security)
3. Check referenced files still exist (if skill has resources)
4. Show summary:

```
REFINED: [skill-name]

Lines: [before] → [after] ([change%])
Score: [before]/[max] → estimated [after]/[max]
Changes applied: [count]
```
