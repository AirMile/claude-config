# Team context

Guidance for using claude-config in team repos where colleagues do not use claude-config. The backlog and dashboard are personal artifacts — the team uses its own tracker.

> **Read pattern for skills** — see `shared/PROJECT-MODE.md` for the canonical `TEAM_MODE` read, gate templates, and the full skill-category list.

## When are you in a team repo?

Three signals:

- `git log --format='%an' | sort -u | wc -l` > 1 (multiple commit authors)
- `.git/config` has a remote
- Others have committed recently (last 30 days)

`core-setup --mode=mature` detects this automatically and writes `CLAUDE.local.md` (not `CLAUDE.md`) so your configuration does not end up in the repo.

> **Second consumer of this heuristic:** `core-setup/references/mode-mature.md` PHASE 0.55 uses the same three signals to propose `team.mode` in `project.json`. If you adjust the threshold values, also check PHASE 0.55.

## Skills per phase

| Phase               | Relevant                                                               | Less relevant in mature team repo                      |
| ------------------- | ---------------------------------------------------------------------- | ------------------------------------------------------ |
| Concept / discovery | (not your task — team already has a concept or backlog)                | `/project-seed`, `/project-plan` (greenfield tools) |
| Item capture        | `/team-issues` (issues from team tracker), `/project-todo` (own ideas) | —                                                      |
| Deep-dive           | `/project-brainstorm`, `/project-critique` (on individual items)       | —                                                      |
| Define              | `/dev-define`, `/design-create`                                      | —                                                      |
| Build               | `/dev-build`, `/design-create` Build, `/design-create` Convert     | —                                                      |
| Test                | `/dev-verify`, `/design-check`                                       | —                                                      |
| Commit              | `/core-commit` (detects team commit convention automatically)          | —                                                      |
| Refactor            | `/dev-refactor`                                                        | —                                                      |
| Review              | `/team-review` (PRs), `/team-verify` (completeness)                    | —                                                      |
| Sync teammate code  | `/core-pull`                                                           | —                                                      |

## Issue-driven flow

Default workflow when the team uses GitHub Issues / Jira / Linear:

```
1. /team-issues               → import issues, smart-split into multiple todos
2. (open backlog, choose item)
3. /dev-define <name>         → define requirements + architecture, stores externalRef
   or /design-create <name> → design spec + build
4. /dev-build <name>          → build the feature
5. /dev-verify <name>         → acceptance tests + smoke
6. /core-commit               → auto-prefix with issue-ID (GitHub #123 or JIRA-456)
7. git push + PR              → /team-review for self-review before merge
8. /dev-refactor <name>       → code cleanup, promote to Dashboard
```

## Outsourcing tasks

Have a TODO or DEFINED item that a teammate is better placed to handle? Use `/team-outsource <name>`:

1. Skill reads backlog + optional `feature.json` (for DEFINED items)
2. Generates an issue brief in your chosen format (Technical brief / User story / Minimal task)
3. Creates a GitHub/Jira/Linear issue with the teammate as assignee
4. Writes `externalRef.direction: "outbound"` back to backlog → item stays visible in your dashboard with a link to the external issue

**Triggers:**

- Backlog dashboard → DEFINED card without externalRef → click **Outsource** button → copy command → paste in chat
- Directly in chat: `/team-outsource <name>`
- Multi-select for minimal-task batch: `/team-outsource` (without argument → interactive selection)

**Tracker support:**

| Tracker | Method                                                     |
| ------- | ---------------------------------------------------------- |
| GitHub  | `gh issue create` (native CLI)                             |
| Jira    | Paste-flow: output in chat → paste in tracker → return URL |
| Linear  | Paste-flow: same as Jira                                   |

Configure your GitHub project once in `project.json#team.githubProject` — the skill asks for this automatically on first run.

## Multi-fragment issues

One issue in the team tracker can produce multiple backlog items via `/team-issues` smart-split. Example:

```
GitHub Issue #42: "Implement OAuth login"
→ oauth-login           PAGE · Design  (login page)
→ oauth-callback        API  · Dev       (backend endpoint)
→ oauth-tests           FEATURE · Dev    (test coverage)
```

All three share the same `externalRef.id: "42"` with different `externalRef.split` values. In the PR description link to the issue (`Closes #42`), not to individual backlog items.

## externalRef in the pipeline

The `externalRef` field is passed through the pipeline so every skill knows the external ID:

```
backlog.json (externalRef) → feature.json (externalRef) → /core-commit (ticket-prefix)
```

Skills that read it:

- `/dev-define` — copies to `feature.json` at definition time
- `/core-commit` — uses `externalRef.id` as commit-prefix suggestion

## External trackers without native tooling

For Jira and Linear there is no native CLI integration in v1. Approach:

- Use `/team-issues --paste` → paste issue URL or body → skill parses what it can
- Or: add the item manually via `/project-todo` and put the ticket ID in the description:

```json
{
  "name": "oauth-flow",
  "description": "JIRA-456: OAuth implementation\n\n{rest}",
  "source": "/project-todo"
}
```

`/core-commit` recognizes `[A-Z]+-\d+` patterns in `feature.description` and offers them as commit-prefix suggestions.

## What stays personal

`.project/` is gitignored — these are your local artifacts:

| Artifact                                                   | Personal  | Shared in repo               |
| ---------------------------------------------------------- | --------- | ---------------------------- |
| `.project/backlog.json`                                    | ✓         | —                            |
| `.project/project.json`                                    | ✓         | —                            |
| `.project/features/*/`                                     | ✓         | —                            |
| `CLAUDE.local.md`                                          | ✓         | —                            |
| Code (src/, app/, etc.)                                    | —         | ✓                            |
| `project-context.json#learnings[]` with `source: "synced"` | ✓ (local) | — (extracted from team code) |

`project-context.json#learnings[]` with `source: "synced"` are extractions from teammate code via `/core-pull` or `/core-setup --mode=mature` — they belong to you, not the team.
