---
name: team-review
description: Code review for feature branches with bug detection, CLAUDE.md compliance, git history analysis, confidence scoring, and optional PR integration. Inline analysis with optional Context7 best-practice research.
metadata:
  author: claude-config
  version: 3.0.0
  category: team
---

# Code Review Skill

## Overview

Code review skill for feature branches. Performs inline code analysis (compliance, bugs, history) with confidence scoring and filtering, optionally enriched with Context7 best-practice research. Supports PR integration for posting review comments.

**Trigger**: `/team-review`

## When to Use

Activate this skill when code needs quality check before PR/merge request.

Not for:

- Testing or functionality verification
- Main/develop branch (must be on feature branch)
- Single file reviews (use for branch-wide changes)

## Workflow

**Phase tracking** — first action of the skill: call `TaskCreate` with these 7 items (status `pending`), then use `TaskUpdate` to set each phase `in_progress` at start and `completed` at end. On context compaction the task list remains visible — no risk of forgotten phases.

1. Step 1: Detection & Setup
2. Step 2: Mode Selection
3. Step 3: Gather Context
4. Step 4: Inline Review Analysis
5. Step 5: Confidence Scoring & Filtering
6. Step 6: Generate Feedback
7. Step 7: Output & PR Integration

### Step 1: Detection & Setup

> **Todo**: call `TaskCreate` with the 7 phase items (see above). Mark Step 1 → `in_progress` via `TaskUpdate`.

0. **Team-mode gate.** Read `.project/project.json#team.mode`. If `"solo"` or absent → show AskUserQuestion (warn-only):

   ```yaml
   header: "Solo project"
   question: "This project is marked solo (team.mode). /team-review is meant for projects with multiple contributors. Continue anyway?"
   options:
     - label: "Cancel (Recommended)"
       description: "Exit. Toggle to team via the ⚙ button in the backlog or run /core-setup to mark this as a team project."
     - label: "Yes, continue once"
       description: "Proceed with the review for this single invocation."
   multiSelect: false
   ```

   Cancel → exit. Continue → proceed with step 1.

1. Get current branch: `git branch --show-current`
2. Validate not on main/master/develop — if so, stop with error message
3. Find parent branch via merge-base: `git merge-base HEAD develop` (fallback to main/master)
4. Get all commits since branch creation: `git log <merge-base>..HEAD --oneline`
5. Get full diff: `git diff <merge-base>..HEAD`
6. PR detection: `gh pr list --head $(git branch --show-current) --json number,state,isDraft`
7. Eligibility checks (if PR exists):
   - Skip if PR is closed → tell user and stop
   - Skip if PR is draft → tell user and stop
   - Skip if already reviewed by Claude (check PR comments) → tell user and stop
8. If no PR exists: always proceed

### Step 2: Mode Selection

> **Todo**: mark Step 1 → `completed`, Step 2 → `in_progress`.

Use AskUserQuestion with 2 options:

- **Quick review** — Inline analysis (compliance, bugs, history). Fast, focused on issues.
- **Full review (Recommended)** — Inline analysis + Context7 best-practice research. More comprehensive, includes naming/pattern/structure feedback.

### Step 3: Gather Context

> **Todo**: mark Step 2 → `completed`, Step 3 → `in_progress`.

1. Read CLAUDE.md (global `~/.claude/CLAUDE.md` + project-level `CLAUDE.md` files)
2. Identify languages/frameworks in the changed files
3. Prepare git blame for changed files: for each changed file, run `git blame <merge-base>..HEAD -- <file>`

### Step 4: Inline Review Analysis

> **Todo**: mark Step 3 → `completed`, Step 4 → `in_progress`.

Perform 3 analysis passes on the diff. All passes use the same diff and context — no agents needed. Show an ASCII diagram of the parallel review architecture (3 passes → merge → filter → output).

**Operational stance:** Skeptical. Default: there are problems until proven otherwise.

**Anti-fantasy check per pass:** Expect at least 1-2 findings per pass for diffs >50 lines. Zero findings requires an explicit explanation why (e.g. "diff contains only styling/config").

**Grounding requirement:** Every finding must include an evidence pair:

- **Line/Source:** "[exact quote from CLAUDE.md / best practice / git history]"
- **Code:** "[exact code that violates it, with file:line]"
- **Impact:** "[what can go wrong]"

#### Pass 1: CLAUDE.md Compliance

Extract actionable rules from CLAUDE.md (skip tool usage rules, workflow rules). For each rule about code style, naming, architecture, language policy, file organization, or technology choices:

- Scan diff for violations **introduced in this diff only**
- Cite the exact CLAUDE.md rule for each violation
- Score confidence per finding (0-100)

Skip: pre-existing issues, moved-only code, pedantic interpretations, rules not applicable to code review.

#### Pass 2: Bug Scan

Scan changed code for these categories:

- **Logical errors** — wrong comparison, inverted conditions, incorrect operator
- **Null/undefined handling** — missing null checks, unsafe access chains
- **Race conditions** — shared state mutation, async ordering issues
- **Resource leaks** — unclosed handles, missing cleanup, event listener leaks
- **Off-by-one errors** — loop bounds, array indexing, slice ranges
- **Type mismatches** — wrong argument types, implicit coercion bugs
- **Error handling gaps** — swallowed errors, missing catch, unchecked return values
- **Copy-paste errors** — duplicated code with wrong variable names

Before reporting, verify: is it actually a bug (not intentional)? Would a linter catch it? Is there a guard earlier? Score confidence per finding.

#### Pass 3: History Analysis

Using git blame output, analyze:

- **Broken patterns** — file consistently uses approach A, change introduces approach B
- **Regression risk** — diff modifies code that was part of a bug fix
- **Churn detection** — files with high recent churn being modified again
- **Convention breaks** — file establishes a convention the change doesn't follow

Skip: intentional refactors, ongoing migrations, new files with no history.

#### Pass 4 (Full mode only): Best Practice Research

Call Context7 inline for the detected languages/frameworks:

- **Naming conventions** — are names idiomatic for the framework?
- **Code patterns** — are there anti-patterns or better alternatives?
- **Structure** — does the organization follow framework conventions?

### Step 5: Confidence Scoring & Filtering

> **Todo**: mark Step 4 → `completed`, Step 5 → `in_progress`.

Apply filtering across all passes:

**Filter threshold: 70+** — only include findings with confidence >= 70.

**Confidence rubric:**

| Score | Meaning                                        |
| ----- | ---------------------------------------------- |
| 0     | False positive, does not hold up on inspection |
| 25    | Possibly real, but not verified                |
| 50    | Real issue, but minor/nitpick                  |
| 75    | Verified issue, important                      |
| 100   | Absolutely certain, evidence confirms it       |

Discard findings that match false positive criteria:

- Pre-existing issues (not introduced in this branch)
- Issues that linters/type checkers/CI would catch
- Pedantic nitpicks
- Style issues not defined in CLAUDE.md
- Issues with lint-ignore comments
- Intentional functionality changes

**Zero-findings self-check:** If all passes together report 0 findings for diffs >50 lines → reconsider: "Am I being optimistic? Would a critical reviewer let this pass?" Go through the diff once more with focus on missed issues.

### Step 6: Generate Feedback

> **Todo**: mark Step 5 → `completed`, Step 6 → `in_progress`.

Format output as:

```markdown
## Code Review: [branch-name]

[Optional: PR #N link if PR exists]

### Summary

[Brief summary of changes and overall impression]

### Issues Found

#### Critical (confidence 85+)

1. [description] (source: compliance/bug/history)
   `path/to/file.ext#L10-L15` — confidence: [X]

#### Important (confidence 70-84)

1. [description] (source: compliance/bug/history)
   `path/to/file.ext#L20-L25` — confidence: [X]

### Best Practice Insights (Full mode only)

- [naming/pattern/structure feedback from Context7 research]

### Positives

- [what was done well]
```

**Verdict (always include):**

```
### Verdict

APPROVE — 0 critical findings + ≤2 important findings
REQUEST CHANGES — any critical OR >2 important findings
```

If no issues found above threshold, say so clearly and focus on positives.

### Step 7: Output & PR Integration

> **Todo**: mark Step 6 → `completed`, Step 7 → `in_progress`.

- **If open PR exists**: use AskUserQuestion — "Do you want to post this as a PR comment?"
  - Yes: post via `gh pr comment <number> --body "..."`
  - No: show locally only
- **If no PR**: show locally only

> **Todo**: mark Step 7 → `completed`.

---

## Best Practices

### Language

Follow the Language Policy in CLAUDE.md.

### Do

- Always check CLAUDE.md first for project-specific rules
- Provide actionable feedback with specific file/line references
- Balance criticism with positives
- Prioritize feedback (critical > important)
- Be constructive — suggest solutions, not just problems
- Respect the confidence threshold — don't include low-confidence noise

### Don't

- Review testing or functionality (out of scope)
- Include findings below confidence 70
- Overwhelm with too many minor issues
- Be vague — always reference specific code
- Flag pre-existing issues not introduced in this branch
