---
description: Code review for feature branches before PR
---

# Code Review Skill

## Overview

Code review skill for feature branches. Analyzes all commits since branch creation, researches best practices via Context7 agents, and generates constructive feedback for teammates. Focuses on naming conventions, code patterns, and structure - not testing or functionality.

**Trigger**: `/review-other`

## When to Use

Activate this skill when code needs quality check before PR/merge request.

Not for:
- Testing or functionality verification
- Main/develop branch (must be on feature branch)
- Single file reviews (use for branch-wide changes)

## Workflow

### Step 1: Branch Detection & Validation

1. Get current branch: `git branch --show-current`
2. Validate not on main/master/develop - if so, stop with error message
3. Find parent branch via merge-base: `git merge-base HEAD develop` (fallback to main/master)
4. Get all commits since branch creation: `git log <merge-base>..HEAD --oneline`
5. Get full diff: `git diff <merge-base>..HEAD`

### Step 2: Gather Context

1. Read CLAUDE.md for project-specific conventions
2. Identify languages/frameworks in the changed files

### Step 3: Research Best Practices

Spawn 3 parallel agents via Task tool:

- `subagent_type=review-naming` - Naming conventions research
- `subagent_type=review-patterns` - Code patterns research
- `subagent_type=review-structure` - Structure & organization research

Each agent uses Context7 to research best practices for detected languages/frameworks.

**Send notification (after Step 3 parallel agents):**
```bash
powershell -ExecutionPolicy Bypass -File .claude/scripts/notify.ps1 -Title "Claude Code" -Message "Research complete"
```

### Step 4: Review Code

Analyze the diff against:
- Project conventions (from CLAUDE.md)
- Best practices (from Context7 research)
- General code quality principles

Focus areas:
- Naming conventions (variables, functions, files)
- Code patterns and anti-patterns
- Structure and organization
- Consistency with existing codebase

### Step 5: Generate Feedback

Format output as constructive feedback for teammate:

```
## Code Review: [branch-name]

### Summary
[Brief overview of changes and overall impression]

### Feedback

#### 🔴 Critical (must fix)
- [item]

#### 🟡 Suggestions (should consider)
- [item]

#### 🟢 Minor (nice to have)
- [item]

### Positives
- [what's done well]
```

**Send notification (workflow complete):**
```bash
powershell -ExecutionPolicy Bypass -File .claude/scripts/notify.ps1 -Title "Claude Code" -Message "Code review complete"
```

---

## Best Practices

### Language
Follow the Language Policy in CLAUDE.md.

### Notifications
- **Notify when Claude waits for user input AFTER a long-running phase**
- Notification moments:
  - After Step 3 (parallel research agents): "Research complete"
  - After Step 5 (workflow complete): "Code review complete"
- Use the shared script: `.claude/scripts/notify.ps1` with `-Title` and `-Message` parameters
- Never skip notifications - user may be away from screen during agent execution

### Do
- Always check CLAUDE.md first for project-specific rules
- Provide actionable feedback with specific file/line references
- Balance criticism with positives
- Prioritize feedback (critical > suggestions > minor)
- Be constructive - suggest solutions, not just problems

### Don't
- Review testing or functionality (out of scope)
- Nitpick on style if not in project conventions
- Overwhelm with too many minor issues
- Be vague - always reference specific code