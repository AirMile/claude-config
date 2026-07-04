---
name: team-issues
description: Import GitHub/Jira/Linear issues into the local backlog. Use with /team-issues.
argument-hint: "[number] [--mine] [--paste] [--label <label>]"
reads: [project.team, backlog.status, backlog.externalRef]
writes: [backlog.status, backlog.externalRef, project.team]
metadata:
  author: claude-config
  version: 1.0.0
  category: team
---

# Team Issues

Import issues from a team tracker into your local backlog. Smart-splits multi-area issues into separate frontend/dev todos so each item maps cleanly to one skill pipeline.

**Trigger**: `/team-issues`, `/team-issues <number>`, `/team-issues --mine`, `/team-issues --paste`

## Process

> **Seed task list at start:**
>
> TaskCreate with phases:
>
> - PHASE 0: Pre-flight + tracker detection
> - PHASE 1: Issue intake
> - PHASE 2: Dedup + selection
> - PHASE 3: Smart split analysis
> - PHASE 4: User confirmation
> - PHASE 5: Fragment confirm + checkpoint
> - PHASE 6: Write to backlog
> - PHASE 7: Output

### PHASE 0: Pre-flight + tracker detection

> **Todo**: mark PHASE 0 → `in_progress`.

0. **Team-mode gate.** Read `.project/project.json#team.mode` (see `shared/PROJECT-MODE.md`). If `"solo"` or absent → show AskUserQuestion (warn-only):

   ```yaml
   header: "Solo project"
   question: "This project is marked solo (team.mode). /team-issues is meant for projects with multiple contributors. Continue anyway?"
   options:
     - label: "Cancel (Recommended)"
       description: "Exit. Toggle to team via the ⚙ button in the backlog or run /core-setup to mark this as a team project."
     - label: "Yes, continue once"
       description: "Proceed with issue import for this single invocation."
   multiSelect: false
   ```

   Cancel → exit. Continue → proceed with PHASE 0 step 1.

1. Read `.project/project.json`:
   - Check `team.tracker` — if set, use that.
   - If not set: try `gh repo view --json nameWithOwner` (success → `tracker = "github"`).
   - If that also fails, or if `--paste` flag is present → `tracker = "paste"`.
   - Save tracker to `project.json#team.tracker` if it was missing.

2. Read `.project/backlog.json` → parse JSON → `data`.

3. If argument is a number (e.g. `/team-issues 42`) → store as `directIssueId`, skip PHASE 1 and 2.

> **Todo**: mark PHASE 0 → `completed`, PHASE 1 → `in_progress`.

### PHASE 1: Issue intake

> **Todo**: mark PHASE 1 → `in_progress`.

**GitHub:**

```bash
gh issue list --state open --json number,title,body,labels,assignees,url,updatedAt --limit 50
```

Extra filters:

- `--mine` flag → add `--assignee @me`
- `--label <label>` arg → add `--label <label>`

**Jira / Linear / paste:**

AskUserQuestion:

```yaml
header: "Issue intake"
question: "Paste the issue URL or description below."
options:
  - label: "Paste URL"
    description: "E.g. https://company.atlassian.net/browse/JIRA-456"
  - label: "Paste text"
    description: "Title + body — first line becomes the title"
multiSelect: false
```

Then ask for the content via free text. Parse:

- URL → extract `id` via regex (`/([A-Z]+-\d+)/` or `/(\d+)$/`), `type` from domain
- Body → first line = title, rest = body

> **Todo**: mark PHASE 1 → `completed`, PHASE 2 → `in_progress`.

### PHASE 2: Dedup + selection

> **Todo**: mark PHASE 2 → `in_progress`.

Filter already-imported issues — an issue is considered imported as soon as **one** backlog item has `externalRef.id === issue.id && externalRef.type === tracker`. Do not show those again in the selection.

If `directIssueId` is set → select that issue directly and skip the multi-select.

Otherwise: show AskUserQuestion (multiSelect=true) with per issue:

```
#42  Implement OAuth login        [enhancement, P1]  — @teammate
#38  Fix signup validation error  [bug, P2]
#35  Add dashboard export         [feature, P2]
```

> **Todo**: mark PHASE 2 → `completed`, PHASE 3 → `in_progress`.

### PHASE 3: Smart split analysis

> **Todo**: mark PHASE 3 → `in_progress`.

Per selected issue: analyze body inline for split signals.

**Detection signals (in order of reliability):**

1. Headings (`## Frontend`, `## Backend`, `## Database`, `## API`, `## Tests`, `## Mobile`)
2. Labeled lists (`- [ ] API endpoint`, `- [ ] UI component`)
3. Keyword clusters in bullet points (`page`, `endpoint`, `migration`, `schema`, `component`, `test`)
4. Length: body > 500 chars with ≥3 paragraph breaks → possibly splittable

**Type mapping per fragment:**

| Signal                             | Suggested type    | Track  |
| ---------------------------------- | ----------------- | ------ |
| Frontend / UI / page / component   | PAGE or COMPONENT | Design |
| Backend / API / endpoint / service | API or FEATURE    | Dev    |
| Database / migration / schema      | FEATURE           | Dev    |
| Tests / test coverage              | FEATURE           | Dev    |
| Bug fix                            | BUG               | Dev    |
| Unknown / mixed                    | FEATURE           | Dev    |

**ASCII diagram:** generate a visual split tree for the user so they can see at a glance what is proposed:

```
Issue #42: Implement OAuth login
├── oauth-login       PAGE  · Design  · P1
├── oauth-callback    API   · Dev       · P1
└── oauth-tests       FEATURE · Dev    · P2
```

For a single fragment → skip the tree, go directly to PHASE 4 single-todo path.

> **Todo**: mark PHASE 3 → `completed`, PHASE 4 → `in_progress`.

### PHASE 4: User confirmation per issue

> **Todo**: mark PHASE 4 → `in_progress`.

AskUserQuestion (single select):

```yaml
header: "Import approach"
question: "How do you want to import this issue?"
options:
  - label: "Smart split (Recommended)"
    description: "Multiple todos based on the analysis"
  - label: "Single todo"
    description: "One backlog item for the entire issue"
  - label: "Skip"
    description: "Do not import this issue"
multiSelect: false
```

**Smart split:** go to PHASE 5.

**Single todo:** ask via combined AskUserQuestion:

```yaml
# Question 1
header: "Priority"
question: "Which priority?"
options:
  - label: "P1 (Recommended)", description: "Highest priority"
  - label: "P2", description: "Important, not blocking"
  - label: "P3", description: "When there's time"
  - label: "P4", description: "Park for later"
multiSelect: false

# Question 2
header: "Type"
question: "Item type?"
options:
  - label: "FEATURE (Recommended)"
  - label: "BUG"
  - label: "API"
  - label: "PAGE"
  - label: "CHANGE"
multiSelect: false
```

Then go directly to PHASE 6 (write).

**Skip:** go to next selected issue (loop back to PHASE 3 if more issues are waiting).

> **Todo**: mark PHASE 4 → `completed`, PHASE 5 → `in_progress`.

### PHASE 5: Fragment confirm + checkpoint

> **Todo**: mark PHASE 5 → `in_progress`.

Show the split proposals as multi-select (default: all checked):

```yaml
header: "Fragments"
question: "Which fragments do you want to import?"
options:
  - label: "oauth-login · PAGE · Design · P1"
  - label: "oauth-callback · API · Dev · P1"
  - label: "oauth-tests · FEATURE · Dev · P2"
multiSelect: true
```

Per selected fragment: show combined confirm for `type` + `phase` (pre-filled with proposal, user can override).

**Interview checkpoint** (before PHASE 6 writes):

Show summary table of everything being imported:

```
IMPORT OVERVIEW
════════════════════════════════════════════════════
Issue  #42 · Implement OAuth login (github)
  oauth-login       PAGE    · Design · P1
  oauth-callback    API     · Dev      · P1
  oauth-tests       FEATURE · Dev      · P2

Issue  #38 · Fix signup validation error (github)
  signup-validation BUG     · Dev      · P2
════════════════════════════════════════════════════
```

AskUserQuestion:

```yaml
header: "Confirm import"
question: "Does this overview look correct? Items will be written to the backlog."
options:
  - label: "Yes, import (Recommended)"
  - label: "Adjust"
    description: "Go back to selection"
multiSelect: false
```

> **Todo**: mark PHASE 5 → `completed`, PHASE 6 → `in_progress`.

### PHASE 6: Write to backlog

> **Todo**: mark PHASE 6 → `in_progress`.

Per accepted todo: insert into `data.features[]` (after dedup check on `name`):

```json
{
  "name": "{kebab-case of title or fragment label}",
  "type": "{type}",
  "status": "TODO",
  "phase": "{phase}",
  "description": "{issue title}\n\n{fragment excerpt, max 500 chars}",
  "source": "/team-issues",
  "externalRef": {
    "type": "{github|jira|linear}",
    "id": "{issue id}",
    "url": "{url or null for paste without URL}",
    "labels": ["{label.name}"],
    "split": "{frontend|backend|tests|null}"
  },
  "dependencies": []
}
```

Write `data.updated` to today (`YYYY-MM-DD`).

Write `project.json#team.tracker` if it was not yet set.

Edit the JSON in `.project/backlog.json` (see `shared/BACKLOG.md § Writing`).

> **Todo**: mark PHASE 6 → `completed`, PHASE 7 → `in_progress`.

### PHASE 7: Output

> **Todo**: mark PHASE 7 → `in_progress`.

```
IMPORTED

  Issue #42: Implement OAuth login (github)
    oauth-login       P1 · PAGE    · Design track
    oauth-callback    P1 · API     · Dev track
    oauth-tests       P2 · FEATURE · Dev track

  Issue #38: Fix signup validation error (github)
    signup-validation P2 · BUG     · Dev track

  Backlog: .project/backlog.json

  Next steps:
  - /dev-ship oauth-callback     (start dev pipeline)
  - /dev-ship signup-validation  (start dev pipeline)
  - /design-convert oauth-login   (start design pipeline)
```

> **Todo**: mark PHASE 7 → `completed`.

## Restrictions

- Smart split is a **suggestion** — the user decides which fragments are ultimately imported
- No bidirectional sync — issue updates in the tracker are not automatically reflected in the backlog
- Smart-split one issue at a time — no bulk-split of multiple issues at once
- Dedup on `externalRef.id` + tracker — an issue that is already (partially) imported does not appear again in the selection
- Do NOT write code, do NOT run git commands

## Tracker-support matrix

| Tracker | Method     | ID format  |
| ------- | ---------- | ---------- |
| GitHub  | `gh` CLI   | `#123`     |
| Jira    | paste-flow | `PROJ-456` |
| Linear  | paste-flow | `ABC-789`  |

Native Jira/Linear integration (API/MCP) is out of scope for v1. See `shared/TEAM.md` for Jira/Linear manual workflow.

### Terminal Formatting

- NEVER use blockquote syntax (`>`) for displaying content in user-facing output
- Backticks only for actual code, file paths, and command references

### Language

Follow `skills/shared/LANGUAGE.md` for output language rules.
