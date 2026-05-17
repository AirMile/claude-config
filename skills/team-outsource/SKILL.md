---
name: team-outsource
description: Outsource a feature to a teammate via issue tracker. Use with /team-outsource.
argument-hint: "[name] [--paste] [--tracker github|jira|linear]"
metadata:
  author: claude-config
  version: 1.0.0
  category: team
---

# Team Outsource

Create an external issue for a teammate based on a local backlog item or feature.json brief. Writes `externalRef.direction: "outbound"` back so the item stays linked to the external issue in the local dashboard.

**Trigger**: `/team-outsource`, `/team-outsource <name>`, `/team-outsource --paste`

## Process

> **Seed task list at start:**
>
> TaskCreate with phases:
>
> - PHASE 0: Pre-flight + tracker detection
> - PHASE 1: Item selection + brief composition
> - PHASE 2: Format selection
> - PHASE 3: Assignee + tracker target
> - PHASE 4: Confirm preview
> - PHASE 5: Create issue
> - PHASE 6: Write externalRef back
> - PHASE 7: Output

### PHASE 0: Pre-flight + tracker detection

> **Todo**: mark PHASE 0 → `in_progress`.

0. **Team-mode gate.** Read `TEAM_MODE` via `shared/PROJECT-MODE.md` read pattern. If `"solo"` or absent → show AskUserQuestion (warn-only):

   ```yaml
   header: "Solo project"
   question: "This project is marked solo (team.mode). /team-outsource is meant for projects with multiple contributors. Continue anyway?"
   options:
     - label: "Cancel (Recommended)"
       description: "Exit. Toggle to team via the ⚙ button in the backlog or run /core-setup to mark this as a team project."
     - label: "Yes, continue once"
       description: "Proceed with outsourcing for this single invocation."
   multiSelect: false
   ```

   Cancel → exit. Continue → proceed with PHASE 0 step 1.

1. Read `.project/project.json` → check `team.tracker`. Unknown → run `gh repo view --json nameWithOwner` (success → `tracker = "github"`). `--paste` flag present or `gh` fails → `tracker = "paste"`.
2. Read `.project/backlog.html` → parse `<script id="backlog-data">` JSON → `data`.
3. If argument `<name>` is set → search in `data.features` by exact name. No match → show "No item found with name `{name}`" + list of top-3 similar names and exit.
4. Check if found item already has `externalRef` → show "Already outsourced to {externalRef.type} #{externalRef.id}" and exit (no duplicate issues).

> **Todo**: mark PHASE 0 → `completed`, PHASE 1 → `in_progress`.

### PHASE 1: Item selection + brief composition

> **Todo**: mark PHASE 1 → `in_progress`.

**If no argument given:** show AskUserQuestion (multiSelect=true) of all backlog items with `status ∈ {TODO, DEFINED}` and without `externalRef.direction === "outbound"`:

```
#  oauth-callback    DEFINED · API · P1
#  signup-form       TODO · PAGE · P2
#  user-profile      DEFINED · FEATURE · P2
```

**Per selected item — brief composition:**

Read `.project/features/<name>/feature.json` if it exists.

| Source                      | Content                                                  |
| --------------------------- | -------------------------------------------------------- |
| `feature.json#summary`      | Issue-body lead paragraph                                |
| `feature.json#requirements` | Acceptance criteria as numbered list                     |
| `feature.json#architecture` | Implementation hints (file paths, components, endpoints) |
| `feature.json#technique`    | Suggested approach (TDD / Implementation First)          |
| backlog-item `description`  | Fallback if feature.json is missing (TODO items)         |

For DEFINED items with feature.json → store `briefSource = "feature"`. For TODO without feature.json → `briefSource = "backlog"`.

> **Todo**: mark PHASE 1 → `completed`, PHASE 2 → `in_progress`.

### PHASE 2: Format selection

> **Todo**: mark PHASE 2 → `in_progress`.

AskUserQuestion (single select):

```yaml
header: "Brief format"
question: "In what form do you want to create the issue?"
options:
  - label: "Technical brief (Recommended)"
    description: "Requirements, architecture, acceptance criteria, file paths. Optimal for DEFINED items with feature.json."
  - label: "User story"
    description: "As <role>, I want <goal>, so that <why>. Plus acceptance criteria. Shorter."
  - label: "Minimal task"
    description: "Title + 1-2 sentence description. Use this for simple TODO items."
multiSelect: false
```

Set default based on `briefSource`:

- `briefSource === "feature"` → default Technical brief
- `briefSource === "backlog"` → default Minimal task

**Compose issue body** based on chosen format:

**Technical brief:**

```markdown
## Summary

{feature.json#summary or backlog description}

## Acceptance criteria

1. {criterion 1}
2. {criterion 2}
   ...

## Architecture

- {file/component/endpoint hint}
- {additional hints}

## Approach

{technique: TDD / Implementation First / etc.}
```

**User story:**

```markdown
As {role from summary}, I want {goal}, so that {why}.

## Acceptance criteria

1. {criterion 1}
2. {criterion 2}
```

**Minimal task:**

```markdown
{backlog description or summary — max 2 sentences}
```

> **Todo**: mark PHASE 2 → `completed`, PHASE 3 → `in_progress`.

### PHASE 3: Assignee + tracker target

> **Todo**: mark PHASE 3 → `in_progress`.

**GitHub config check:**

Read `project.json#team.githubProject`. If missing or incomplete: ask once via AskUserQuestion:

```yaml
header: "GitHub project"
question: "Enter your GitHub project details. This will be cached in project.json."
```

Requested fields (free text each):

1. Owner + repo (default: `gh repo view --json nameWithOwner`)
2. Default assignee GitHub username (can be empty)
3. Project board number (optional — for ProjectV2 linking, fill in if working on a GitHub Project)

Write filled-in fields to `project.json#team.githubProject`.

**Assignee selection:**

```yaml
header: "Assignee"
question: "Who do you want to assign this to?"
options:
  - label: "{defaultAssignee} (Recommended)"
    description: "Cached default — change via project.json#team.githubProject.defaultAssignee"
  - label: "Other username"
    description: "Type a GitHub username"
  - label: "No assignee"
    description: "Create issue without assignment"
multiSelect: false
```

If `defaultAssignee` is empty → skip "cached default" option, show "Other username" + "No assignee" directly.

> **Todo**: mark PHASE 3 → `completed`, PHASE 4 → `in_progress`.

### PHASE 4: Confirm preview

> **Todo**: mark PHASE 4 → `in_progress`.

Show issue preview:

```
ISSUE PREVIEW
══════════════════════════════════════════════════
Tracker:    github (owner/repo)
Title:      {feature name or backlog name}
Assignee:   @{username}
Labels:     {phase as label, e.g. P1}

Body:
  ## Summary
  {first 3 lines of body}
  ...
══════════════════════════════════════════════════
```

AskUserQuestion (single select):

```yaml
header: "Confirm"
question: "Create issue with the above content?"
options:
  - label: "Create (Recommended)"
  - label: "Cancel"
multiSelect: false
```

> **Todo**: mark PHASE 4 → `completed`, PHASE 5 → `in_progress`.

### PHASE 5: Create issue

> **Todo**: mark PHASE 5 → `in_progress`.

**GitHub:**

Write body to temporary file:

```bash
cat > /tmp/team-outsource-body-{name}.md << 'EOF'
{composed body}
EOF
```

Create issue:

```bash
gh issue create \
  -R {owner}/{repo} \
  --title "{title}" \
  --body-file /tmp/team-outsource-body-{name}.md \
  --assignee {username} \
  --label "{phase}"
```

Skip `--assignee` flag if no assignee chosen. Capture stdout for issue URL + number.

**Jira/Linear/paste:**

Show body in terminal:

```
ISSUE BODY — copy the text below to {tracker}

────────────────────────────────────────────────────
{title}

{body}
────────────────────────────────────────────────────

After creating: paste the issue URL below.
```

AskUserQuestion free text: paste URL → parse `id` via:

- GitHub: `/(\d+)$/`
- Jira: `/([A-Z]+-\d+)/`
- Linear: `/([A-Z]+-\d+)/`

On parse error: show "Could not extract ID from URL — enter manually?" and ask again.

> **Todo**: mark PHASE 5 → `completed`, PHASE 6 → `in_progress`.

### PHASE 6: Write externalRef back

> **Todo**: mark PHASE 6 → `in_progress`.

Re-read `.project/backlog.html` directly before writing (Prettier/linters may have modified the file in the meantime).

Find feature by name → update `externalRef` field:

```json
{
  "type": "github",
  "id": "456",
  "url": "https://github.com/owner/repo/issues/456",
  "itemId": null,
  "assignees": ["alice"],
  "labels": ["P1"],
  "direction": "outbound",
  "syncedStatus": "open",
  "syncedAt": "YYYY-MM-DD",
  "split": null
}
```

Set `data.updated` to today. Edit JSON block back into `backlog.html` (script tags intact).

If `.project/features/<name>/feature.json` exists: also add `externalRef` there (1:1 copy).

> **Todo**: mark PHASE 6 → `completed`, PHASE 7 → `in_progress`.

### PHASE 7: Output

> **Todo**: mark PHASE 7 → `in_progress`.

```
OUTSOURCED

  {name}  →  {tracker} #{id}
  {url}

  Assignee:  @{username}
  Status:    {backlog status} · marked as outbound

  Next: monitor via /team-verify once there are commits on this branch
```

> **Todo**: mark PHASE 7 → `completed`.

## Restrictions

- No bidirectional sync — external status updates do not automatically come back to the backlog
- Skip items that already have an `externalRef` (both inbound and outbound) — no duplicate issues
- One item at a time for technical brief / user story formats. Multi-select OK for minimal-task batch
- Backlog status does not change on outsourcing — `externalRef.direction` is the signal, not the status column
- `paste` flow: minimal URL validation — user is responsible for correct paste

## Tracker-support matrix

| Tracker | Method     | Assignee support |
| ------- | ---------- | ---------------- |
| GitHub  | `gh` CLI   | GitHub username  |
| Jira    | paste-flow | Manual in UI     |
| Linear  | paste-flow | Manual in UI     |

## Terminal Formatting

- NEVER use blockquote syntax (`>`) for displaying content in user-facing output
- Backticks only for actual code, file paths, and command references

## Language

Follow `skills/shared/LANGUAGE.md` for output language rules.
