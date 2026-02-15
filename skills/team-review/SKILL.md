---
name: team-review
description: Code review for feature branches with bug detection, CLAUDE.md compliance, git history analysis, confidence scoring, and optional PR integration. Combines code-analysis agents with Context7 best-practice research.
disable-model-invocation: true
metadata:
  author: mileszeilstra
  version: 2.0.0
  category: team
---

# Code Review Skill

## Overview

Code review skill for feature branches. Runs code-analysis agents (compliance, bugs, history) with confidence scoring and filtering, optionally enriched with Context7 best-practice research. Supports PR integration for posting review comments.

**Trigger**: `/team-review`

## When to Use

Activate this skill when code needs quality check before PR/merge request.

Not for:

- Testing or functionality verification
- Main/develop branch (must be on feature branch)
- Single file reviews (use for branch-wide changes)

## Workflow

### Step 1: Detection & Setup

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

Use AskUserQuestion with 2 options:

- **Quick review** — Only code-analysis agents (compliance, bugs, history). Fast, focused on issues.
- **Full review (Recommended)** — Code-analysis + Context7 research agents. More comprehensive, includes best-practice feedback.

### Step 3: Gather Context

1. Read CLAUDE.md (global `~/.claude/CLAUDE.md` + project-level `CLAUDE.md` files)
2. Identify languages/frameworks in the changed files
3. Prepare git blame for changed files: for each changed file, run `git blame <merge-base>..HEAD -- <file>`

### Step 4: Launch Review Agents

**Always launch** (3 parallel agents via Task tool):

- `subagent_type=review-compliance` — CLAUDE.md compliance check
  - Prompt: include full diff + all CLAUDE.md content
- `subagent_type=review-bugs` — Bug detection scan
  - Prompt: include full diff only
- `subagent_type=review-history` — Historical context analysis
  - Prompt: include full diff + git blame output

**Only in Full mode** (3 additional parallel agents via Task tool):

- `subagent_type=review-naming` — Naming conventions research
  - Prompt: include languages/frameworks + project conventions
- `subagent_type=review-patterns` — Code patterns research
  - Prompt: include languages/frameworks + project conventions
- `subagent_type=review-structure` — Structure research
  - Prompt: include languages/frameworks + project conventions

### Step 5: Confidence Scoring & Filtering

Collect all findings from agents and apply filtering:

**Filter threshold: 70+** — only include findings with confidence >= 70.

Discard findings that match false positive criteria:

- Pre-existing issues (not introduced in this branch)
- Issues that linters/type checkers/CI would catch
- Pedantic nitpicks
- Style issues not defined in CLAUDE.md
- Issues with lint-ignore comments
- Intentional functionality changes

### Step 6: Generate Feedback

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

If no issues found above threshold, say so clearly and focus on positives.

### Step 7: Output & PR Integration

- **If open PR exists**: use AskUserQuestion — "Wil je dit als PR comment posten?"
  - Yes: post via `gh pr comment <number> --body "..."`
  - No: show locally only
- **If no PR**: show locally only

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
