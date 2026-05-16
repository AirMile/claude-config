---
name: core-audit
description: Analyze and refine a skill invoked in this conversation. Use with /core-audit.
metadata:
  author: claude-config
  version: 2.0.0
  category: core
---

# Audit

Analyze a skill from the current conversation for quality. Two modes: quick (analysis only) or extended (internal walkthrough + analysis). Refactor proposals are presented as a plan via plan mode for single-shot approval.

**Trigger**: `/core-audit`

## Step 1: Load Skill from Chat

Scan the conversation above for unique skill invocations (slash commands like `/dev-build`, `/core-edit`, etc., or skill names referenced in `<command-name>` tags).

**Resolution rules:**

- **Zero skills detected** → HARD BLOCK. Show:

  ```
  ERROR: no skill invocations found in this conversation.

  /core-audit only audits skills that were used earlier in the chat.
  Invoke a skill first, then run /core-audit.
  ```

  Stop here. Do not prompt the user, do not list available skills, do not ask for a name.

- **Exactly one unique skill** → auto-select. Show:

  ```
  AUTO-SELECTED: [name] (only skill in conversation)
  ```

  Proceed to load.

- **Two or more unique skills** → use **AskUserQuestion**:
  - header: "Skill"
  - question: "Which skill from this conversation do you want to audit?"
  - options: one per detected skill, in order of most-recent invocation first; the first option gets "(Recommended)" appended to its label
  - multiSelect: false

  Do NOT add a "list all skills" or "other" option — only the skills used in this chat are eligible.

**After resolution, load** `.claude/skills/[name]/SKILL.md` and show:

```
LOADED: [name]
[one-line summary from description]
Sections: [count] | Has resources: [yes/no]
```

## Step 1.5: Context Detection

Scan for prior skill execution that can inform testing:

1. **Conversation context** — the invocation that triggered the auto-select / modal already qualifies as conversation context; capture decisions, files mentioned, and outputs from that invocation
2. **devinfo.json** — read `.project/session/devinfo.json` if it exists; check `executionPlan` for completed skills matching the target or its pipeline

**Detection signals:**

- Target skill appears in conversation as a slash command invocation (always true for this skill now)
- devinfo.json `executionPlan` contains the target skill with status "completed"
- devinfo.json `executionPlan` contains a skill from the same pipeline (e.g., `dev-define` when refining `dev-build`)

**If devinfo adds context, show:**

```
CONTEXT DETECTED

Source: [conversation | devinfo.json | both]
Skill(s) found: [list of detected skills with status]
Artifacts: [relevant files/outputs if available from devinfo]

This context will be used for the walkthrough if extended mode is selected.
```

**If only conversation context (no devinfo):** proceed silently to Step 2.

## Step 2: Choose Mode

Use **AskUserQuestion**:

**If devinfo context was detected in Step 1.5:**

- header: "Mode"
- question: "Context is available from a previous skill run. How do you want to analyze the skill?"
- options:
  - label: "Extended with walkthrough (Recommended)", description: "Internal walkthrough using the detected context as a base — produces the most actionable observations"
  - label: "Quick analysis", description: "Direct analysis without walkthrough — fast, suitable for small skills"
- multiSelect: false

**If only conversation context:**

- header: "Mode"
- question: "How do you want to analyze the skill?"
- options:
  - label: "Quick analysis (Recommended)", description: "Direct analysis without walkthrough — fast, suitable for small skills"
  - label: "Extended with walkthrough", description: "Internal walkthrough first, then analysis with findings"
- multiSelect: false

## Step 3: Internal Walkthrough (only if "Extended with walkthrough")

**Skip to Step 4 if quick mode selected.**

### 3.1 Define Scenario

**If devinfo context was detected** — use the real execution as basis:

- Build scenario from the actual skill invocation and its outcomes
- Reference real artifacts (files created, decisions made, errors encountered)
- If devinfo.json has handoff data or file tracking, incorporate those specifics

**Otherwise** — use the conversation invocation that triggered the audit as the scenario, supplementing with realistic edge cases where the conversation lacks detail.

**Show scenario:**

```
WALKTHROUGH SCENARIO

Scenario: [description]
Context: [real: based on prior execution | conversation: derived from chat | mixed]
[List key artifacts/decisions from the detected context]
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

## Step 5: Plan Mode Refactor

Compile all proposed changes into a single plan and present it via plan mode. Model routers like `opusplan` upgrade plan-mode phases to Opus, which produces stronger refactor plans than inline Sonnet — but plan mode works under any model.

**Refactor principles:**

- Remove what Claude already knows — redundancy reduces signal
- Improve clarity — rephrase confusing or ambiguous instructions
- Remove dead paths — unreachable logic adds noise
- Restructure for top-to-bottom readability
- Preserve all unique, project-specific knowledge
- Keep AskUserQuestion integrations (UX, not noise)
- Don't sacrifice clarity for brevity — if a longer explanation prevents mistakes, keep it

### 5.1 Compile Changes

Internally collect every proposed change. Classify each as:

- **Significant** — structural changes, content rewrites, logic modifications, section additions/removals
- **Minor** — formatting, whitespace, phrasing tweaks, typo fixes, small wording improvements

Order significant changes by impact (highest first). Note dependencies (B requires A).

### 5.2 Build Plan

Use the **EnterPlanMode** tool to switch to plan mode, then write the plan to the plan file with this structure:

1. **Context** — short paragraph: what was audited, key findings that drive the changes, why the refactor matters
2. **Significant changes** — for each, in order of impact:
   - Title
   - What changes
   - Why (reference analysis dimension/finding)
   - `--- Before ---` block with the relevant section
   - `--- After ---` block with the proposed replacement
3. **Minor changes** — flat numbered list with one-line description per change
4. **Verification** — list the checks from Step 6 (re-read SKILL.md, frontmatter validation, resource references)

Then use **ExitPlanMode** to request approval.

### 5.3 Apply

After plan approval, apply all changes from the plan using the Edit tool. Skip any change the user rejected during plan review.

If the user rejects the entire plan, stop without modifying the skill.

## Step 6: Verify

1. Re-read the modified SKILL.md
2. Validate frontmatter (required fields, description pattern, security)
3. Check referenced files still exist (if skill has resources)
4. Show summary:

```
REFINED: [skill-name]

Changes applied: [n]
- [change title 1]
- [change title 2]

Frontmatter: [valid/issues found]
Resources: [ok/missing files]
```
