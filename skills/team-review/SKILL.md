---
name: team-review
description: Code review for feature branches with bug detection, CLAUDE.md compliance, git history analysis, confidence scoring, and optional PR integration. Inline analysis with optional Context7 best-practice research.
disable-model-invocation: true
metadata:
  author: mileszeilstra
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

- **Quick review** — Inline analysis (compliance, bugs, history). Fast, focused on issues.
- **Full review (Recommended)** — Inline analysis + Context7 best-practice research. More comprehensive, includes naming/pattern/structure feedback.

### Step 3: Gather Context

1. Read CLAUDE.md (global `~/.claude/CLAUDE.md` + project-level `CLAUDE.md` files)
2. Identify languages/frameworks in the changed files
3. Prepare git blame for changed files: for each changed file, run `git blame <merge-base>..HEAD -- <file>`

### Step 4: Inline Review Analysis

Perform 3 analysis passes on the diff. All passes use the same diff and context — no agents needed. Toon een ASCII diagram van de parallelle review architectuur (3 passes → merge → filter → output).

**Operational stance:** Skeptisch. Default: er zijn problemen tot het tegendeel bewezen is.

**Anti-fantasy check per pass:** Verwacht minimaal 1-2 findings per pass bij diff >50 regels. Zero findings vereist een expliciete verklaring waarom (bijv. "diff bevat alleen styling/config").

**Grounding vereiste:** Elke finding moet een evidence pair bevatten:

- **Regel/Bron:** "[exacte quote uit CLAUDE.md / best practice / git history]"
- **Code:** "[exacte code die het schendt, met file:line]"
- **Impact:** "[wat er mis kan gaan]"

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

**Zero-findings self-check:** Als alle passes samen 0 findings rapporteren bij diff >50 regels → heroverweeg: "Ben ik optimistisch? Zou een kritische reviewer dit laten passeren?" Doorloop de diff nogmaals met focus op gemiste issues.

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

**Verdict (altijd opnemen):**

```
### Verdict

APPROVE — 0 critical findings + ≤2 important findings
REQUEST CHANGES — any critical OR >2 important findings
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
