# PHASE 0.5: Completeness Check — Agent Prompts

Load this file when entering PHASE 0.5. Contains the Explore agent prompts for BRIEF_REVIEW and TODO_REVIEW modes, and the parse/display instructions.

---

## Step 1: Load Context

**`BRIEF_REVIEW`:** Load `.project/features/{feature-name}/feature.json`. Extract: `requirements[]`, `files[]`, `buildSequence[]`, `testStrategy[]`.

**`TODO_REVIEW`:** Extract backlog item description/title. Parse into informal requirements (each distinct expectation from the description becomes a check item). No files[] or buildSequence[] available.

## Step 2: Get Relevant Diff

Filter commits by assignee name if known (read `externalRef.assignees[0]` from feature.json):

```bash
git log --author="{externalRef.assignees[0]}" --oneline --since="2 weeks ago" -- .
git diff $(git merge-base HEAD main)..HEAD
```

Fallback if on main or no assignee in externalRef: diff last N commits relevant to the feature.

## Step 3: Spawn Explore Agent

**For `BRIEF_REVIEW`:**

```
Analyze the code diff against feature requirements.

{STACK_CONTEXT}

Requirements:
{JSON of requirements[] from feature.json}

Expected files:
{JSON of files[] from feature.json}

Build sequence:
{JSON of buildSequence[] from feature.json}

Git diff:
{full diff output}

For each requirement:
- Is it implemented? (search for relevant code in the diff)
- Are expected files created/modified?
- Does it meet the acceptance criteria?

Return structured output:
COMPLETENESS_START
| REQ | Description | Status | Evidence | Missing |
|-----|------------|--------|----------|---------|
| {id} | {description} | FOUND/MISSING/PARTIAL | {file:line or —} | {what's missing} |
COMPLETENESS_END

MISSING_FILES: {files from expected list not found in diff, comma-separated, or "none"}
EXTRA_FILES: {files in diff not in expected list, comma-separated, or "none"}
COVERAGE: {N}/{total} requirements found
```

**For `TODO_REVIEW`:**

```
Analyze the code diff against the backlog task description.

{STACK_CONTEXT}

Task: {backlog item title}
Description: {backlog item description}

Git diff:
{full diff output}

Parse the description into distinct expectations. For each:
- Is it addressed in the code? (search for relevant implementation)
- Is the implementation complete or partial?

Return structured output:
COMPLETENESS_START
| # | Expectation | Status | Evidence | Missing |
|---|------------|--------|----------|---------|
| 1 | {parsed expectation} | FOUND/MISSING/PARTIAL | {file:line or —} | {what's missing} |
COMPLETENESS_END

COVERAGE: {N}/{total} expectations found
```

## Step 4: Parse and Display Results

```
COMPLETENESS CHECK: {feature-name}

| #       | Description              | Status    | Evidence              |
|---------|--------------------------|-----------|---------------------|
| REQ-001 | User can log in          | ✓ FOUND   | src/auth/login.ts   |
| REQ-002 | Email validation         | ~ PARTIAL | src/auth/login.ts   |
| REQ-003 | Rate limiting            | ✗ MISSING | —                   |

Coverage: {N}/{total} ({percentage}%)
{BRIEF_REVIEW only:} Missing files: {list or "none"}
{BRIEF_REVIEW only:} Extra files: {list or "none"}
```

## Step 5: Handle Incomplete Coverage

If coverage < 100%:

Use AskUserQuestion:

- header: "Incomplete"
- question: "{N} items not (fully) found. What do you want to do?"
- options:
  - label: "Continue anyway (Recommended)", description: "Test what IS there, report missing items"
  - label: "Send feedback", description: "Generate feedback for teammate, stop testing"
  - label: "Cancel", description: "Stop"
- multiSelect: false

If "Send feedback" → skip to PHASE 6 (generate feedback with completeness results).
