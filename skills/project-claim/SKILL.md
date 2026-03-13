---
name: project-claim
description: >-
  Claim an unassigned GitHub Project todo for your local backlog. Pulls items
  from a GitHub Projects board, lets you pick one, adds it to the local
  backlog, and marks it as In Progress with you as assignee on GitHub.
  Use with /project-claim.
disable-model-invocation: true
metadata:
  author: mileszeilstra
  version: 1.2.0
  category: project
---

# Claim

Pull unassigned TODO items from a GitHub Projects board, pick one, add it to the local backlog, and claim it on GitHub. Pushing DONE items back to GitHub is handled via the backlog UI button (server route `POST /{project}/github/push-done`).

**Trigger**: `/project-claim`

## Prerequisites

- `gh` CLI authenticated with `read:project` + `project` scopes
- `.project/backlog.html` exists (created by `/dev-plan` or `/dev-feature`)
- GitHub Project board URL configured in `.project/github-project.json`

## Workflow

### FASE 0: Config laden

1. Check of `.project/github-project.json` bestaat:

   ```json
   {
     "owner": "AirMile",
     "repo": "claude-config",
     "project_number": 7,
     "username": "AirMile"
   }
   ```

   - **Niet gevonden** → print in chat: "Geen GitHub Project config gevonden. Geef de volgende gegevens:" en vraag achtereenvolgens (gewone chat, geen AskUserQuestion): owner (GitHub username van de project-eigenaar), repo naam, project nummer, en je eigen GitHub username. Schrijf naar `.project/github-project.json`.

   - **Gevonden** → parse en gebruik.

2. Check of `.project/backlog.html` bestaat:
   - **Niet gevonden** → meld: "Geen lokale backlog gevonden. Run eerst `/dev-plan` of `/dev-feature` om een backlog aan te maken." Stop.
   - **Gevonden** → ga door.

### FASE 1: GitHub items ophalen

Run GraphQL query om het project op te halen:

```bash
gh api graphql -f query='
{
  user(login: "{owner}") {
    projectV2(number: {project_number}) {
      id
      fields(first: 20) {
        nodes {
          ... on ProjectV2SingleSelectField {
            name
            id
            options { name id }
          }
          ... on ProjectV2Field {
            name
            id
            dataType
          }
        }
      }
      items(first: 100) {
        nodes {
          id
          fieldValues(first: 10) {
            nodes {
              ... on ProjectV2ItemFieldTextValue {
                text
                field { ... on ProjectV2Field { name } }
              }
              ... on ProjectV2ItemFieldSingleSelectValue {
                name
                optionId
                field { ... on ProjectV2SingleSelectField { name } }
              }
              ... on ProjectV2ItemFieldNumberValue {
                number
                field { ... on ProjectV2Field { name } }
              }
            }
          }
          content {
            ... on Issue {
              title
              number
              state
              body
              assignees(first: 5) { nodes { login } }
              url
              labels(first: 5) { nodes { name } }
            }
            ... on DraftIssue {
              title
              body
            }
          }
        }
      }
    }
  }
}'
```

Parse the response. Extract:

- `projectId` — needed for mutations
- `statusFieldId` — the Status field ID
- `inProgressOptionId` — the "In Progress" option ID
- `doneOptionId` — the "Done" option ID
- All items with their item ID, title, status, assignees, story points, issue URL, issue number

### FASE 2: Filter en presenteer

Filter items: **status = "Todo"** AND **no assignees** (empty assignees array).

**Geen unassigned todos** → meld: "Geen unassigned TODO items gevonden op het GitHub board." Stop.

**Items gevonden** → print a numbered markdown table. The user replies with a number.

```
GITHUB TODO's (unassigned)

| #  | Issue | Title                              | SP |
|----|-------|------------------------------------|----|
| 1  | #10   | Skill dependency graph             | —  |
| 2  | #11   | Skill usage analytics dashboard    | —  |
| ...| ...   | ...                                | .. |

Typ een nummer om te claimen, of 0 om te annuleren.
```

**CRITICAL: Do NOT use AskUserQuestion here. Never. Print the table as plain text output and stop. The user types a number in the chat.** Validate:

- `0` → stop
- Valid number → proceed with that item
- Invalid → ask again

### FASE 3: Toevoegen aan lokale backlog

1. Read `.project/backlog.html` → parse JSON from `<script id="backlog-data" type="application/json">`.

2. Generate kebab-case name from the chosen item's title (e.g. "Feature: Vrienden & Connecties API" → `vrienden-connecties-api`). Strip common prefixes like "Feature:", "Bug:", etc.

3. Check for duplicates: `data.features.find(f => f.name === name)`.
   - **Duplicate found** → meld: "Dit item staat al in je lokale backlog als '{name}' (status: {status})." Stop.

4. Push to `data.features[]`:

   ```json
   {
     "name": "{kebab-case-name}",
     "type": "FEATURE",
     "status": "TODO",
     "stage": null,
     "phase": "P1",
     "description": "{original title from GitHub}",
     "dependency": null,
     "assignee": null,
     "date": null,
     "github_issue": "{issue_url}",
     "github_item_id": "{project item id}",
     "story_points": "{story_points or null}"
   }
   ```

   Type inference from title/labels:
   - Title contains "API" → type `API`
   - Title contains "Dashboard" or "UI" or "Page" → type `UI`
   - Title contains "Refactor" → type `REFACTOR`
   - Labels contain "bug" → type `REFACTOR`
   - Otherwise → `FEATURE`

5. **Store GitHub project metadata** in the backlog data (needed by the UI's "Push to Done" button):

   ```json
   data.github_project = {
     "projectId": "{projectId from FASE 1}",
     "statusFieldId": "{Status field ID from FASE 1}",
     "doneOptionId": "{Done option ID from FASE 1}"
   }
   ```

   Only set this once — if `data.github_project` already exists, skip.

6. Update `data.updated` to today's date (`YYYY-MM-DD`).

7. Write back: Edit `backlog.html` — replace JSON between `<script id="backlog-data" type="application/json">` and `</script>` tags.

### FASE 4: Claim op GitHub

Two mutations to run:

**1. Update project item status to "In Progress":**

```bash
gh api graphql -f query='
mutation {
  updateProjectV2ItemFieldValue(input: {
    projectId: "{projectId}"
    itemId: "{itemId}"
    fieldId: "{statusFieldId}"
    value: { singleSelectOptionId: "{inProgressOptionId}" }
  }) {
    projectV2Item { id }
  }
}'
```

**2. Add yourself as assignee on the issue** (only for real issues, not draft issues):

```bash
gh api repos/{owner}/{repo}/issues/{issue_number}/assignees -f "assignees[]={username}"
```

Extract `{owner}` and `{repo}` from the issue URL (e.g. `https://github.com/Shav0nne/sonarpoppy/issues/5` → owner=`Shav0nne`, repo=`sonarpoppy`).

If either mutation fails, show the error but do NOT roll back the local backlog addition. The user can manually fix GitHub.

### FASE 5: Output

```
CLAIMED

  {name}                {type} · {story_points} SP
  {description}
  GitHub: {issue_url}

  Lokale backlog: .project/backlog.html
  GitHub status:  In Progress ✓
  GitHub assignee: {username} ✓

  Next step: /dev-define {name}
```

---

## Backlog UI: "Done → GitHub" knop

DONE items worden naar GitHub gepusht via de backlog UI, niet via deze skill. De server route `POST /{project}/github/push-done` in `serve-backlog.js` handelt dit af. De knop wordt getoond door `backlog-github.js` op alle DONE cards.

## Config Reference

`.project/github-project.json`:

```json
{
  "owner": "string — GitHub username owning the project board",
  "repo": "string — repository name for creating issues",
  "project_number": "number — project number (from URL)",
  "username": "string — your GitHub username for assignee"
}
```

## Restrictions

- **NEVER use AskUserQuestion in this skill.** All user input via plain chat: print options/tables as text, user types a number or answer
- Do NOT modify existing backlog items
- Do NOT push status changes automatically — only on explicit user action (DONE button)
- Do NOT remove items from local backlog if they're removed from GitHub
- Draft issues (no URL/number) are included in the list but cannot be assigned — skip the assignee mutation for drafts
- If `gh` CLI is not authenticated or missing scopes, show a clear error with instructions

### Terminal Formatting

- NEVER use blockquote syntax (`>`) for displaying content
- NEVER use inline code backticks for emphasis on regular words — use **bold** or plain text
- Backticks only for actual code, file paths, and command references

### Language

Follow the Language Policy in CLAUDE.md.
