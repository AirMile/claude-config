# Team-context

Guidance voor het gebruik van claude-config in team-repos waar collega's geen claude-config gebruiken. De backlog en het dashboard zijn persoonlijke artifacts — het team gebruikt zijn eigen tracker.

## Wanneer ben je in een team-repo?

Drie signalen:

- `git log --format='%an' | sort -u | wc -l` > 1 (meerdere commit-authors)
- `.git/config` heeft een remote
- Anderen hebben recentelijk gecommit (laatste 30 dagen)

`core-setup --mode=mature` detecteert dit automatisch en schrijft `CLAUDE.local.md` (niet `CLAUDE.md`) zodat je configuratie niet in de repo terechtkomt.

## Skills per fase

| Fase                | Wel relevant                                                             | Minder relevant in mature team-repo                     |
| ------------------- | ------------------------------------------------------------------------ | ------------------------------------------------------- |
| Concept / discovery | (niet jouw taak — team heeft al een concept of backlog)                  | `/thinking-concept`, `/project-plan` (greenfield-tools) |
| Item capture        | `/team-issues` (issues van team-tracker), `/project-todo` (eigen ideeën) | —                                                       |
| Verdiepen           | `/thinking-brainstorm`, `/thinking-critique` (op individuele items)      | —                                                       |
| Definiëren          | `/dev-define`, `/frontend-design`                                        | —                                                       |
| Bouwen              | `/dev-build`, `/frontend-design` Build, `/frontend-convert`              | —                                                       |
| Testen              | `/dev-verify`, `/frontend-check`                                         | —                                                       |
| Commit              | `/core-commit` (detecteert team commit-conventie automatisch)            | —                                                       |
| Refactor            | `/dev-refactor`                                                          | —                                                       |
| Review              | `/team-review` (PRs), `/team-verify` (completeness)                      | —                                                       |
| Sync teammate code  | `/project-pull`                                                          | —                                                       |

## Issue-driven flow

Standaard workflow wanneer het team GitHub Issues / Jira / Linear gebruikt:

```
1. /team-issues               → importeer issues, smart-split naar meerdere todos
2. (open backlog, kies item)
3. /dev-define <name>         → definieer requirements + architectuur, bewaart externalRef
   of /frontend-design <name> → design spec + build
4. /dev-build <name>          → bouw de feature
5. /dev-verify <name>         → acceptatietests + smoke
6. /core-commit               → auto-prefix met issue-ID (GitHub #123 of JIRA-456)
7. git push + PR              → /team-review voor self-review voor merge
8. /dev-refactor <name>       → code cleanup, promote naar Dashboard
```

## Outsourcing tasks

Heb je een TODO of DEFINED item dat een teammate beter kan oppakken? Gebruik `/team-outsource <name>`:

1. Skill leest backlog + optioneel `feature.json` (voor DEFINED items)
2. Genereert een issue-brief in jouw gekozen format (Technical brief / User story / Minimal task)
3. Maakt een GitHub/Jira/Linear issue aan met de teammate als assignee
4. Schrijft `externalRef.direction: "outbound"` terug naar backlog → item blijft zichtbaar in jouw dashboard met link naar de externe issue

**Triggers:**

- Backlog dashboard → DEFINED card zonder externalRef → klik **Outsource** knop → kopieer command → plak in chat
- Direct in chat: `/team-outsource <name>`
- Multi-select voor minimal-task batch: `/team-outsource` (zonder argument → interactieve selectie)

**Tracker support:**

| Tracker | Methode                                                       |
| ------- | ------------------------------------------------------------- |
| GitHub  | `gh issue create` (native CLI)                                |
| Jira    | Paste-flow: output in chat → plak in tracker → geef URL terug |
| Linear  | Paste-flow: zelfde als Jira                                   |

Configureer eenmalig je GitHub-project in `project.json#team.githubProject` — de skill vraagt dit bij de eerste run automatisch.

## Multi-fragment issues

Één issue in de team-tracker kan meerdere backlog-items opleveren via `/team-issues` smart-split. Voorbeeld:

```
GitHub Issue #42: "Implement OAuth login"
→ oauth-login           PAGE · Frontend  (login pagina)
→ oauth-callback        API  · Dev       (backend endpoint)
→ oauth-tests           FEATURE · Dev    (test coverage)
```

Alle drie delen dezelfde `externalRef.id: "42"` met verschillende `externalRef.split` waarden. In de PR-description link je naar de issue (`Closes #42`), niet naar individuele backlog-items.

## externalRef in de pipeline

Het `externalRef` veld wordt doorgegeven door de pipeline zodat elke skill de externe ID kent:

```
backlog.html (externalRef) → feature.json (externalRef) → /core-commit (ticket-prefix)
```

Skills die het lezen:

- `/dev-define` — kopieert naar `feature.json` bij definitie
- `/core-commit` — gebruikt `externalRef.id` als commit-prefix suggestie

## Externe trackers zonder native tooling

Voor Jira en Linear is er geen native CLI-integratie in v1. Werkwijze:

- Gebruik `/team-issues --paste` → plak issue URL of body → skill parsed wat mogelijk is
- Of: voeg het item handmatig toe via `/project-todo` en zet het ticket-ID in de description:

```json
{
  "name": "oauth-flow",
  "description": "JIRA-456: OAuth implementation\n\n{rest}",
  "source": "/project-todo"
}
```

`/core-commit` herkent `[A-Z]+-\d+` patronen in `feature.description` en biedt die als commit-prefix aan.

## Wat blijft persoonlijk

`.project/` is gitignored — dit zijn jouw lokale artifacts:

| Artifact                                          | Persoonlijk | Gedeeld in repo             |
| ------------------------------------------------- | ----------- | --------------------------- |
| `.project/backlog.html`                           | ✓           | —                           |
| `.project/project.json`                           | ✓           | —                           |
| `.project/features/*/`                            | ✓           | —                           |
| `CLAUDE.local.md`                                 | ✓           | —                           |
| Code (src/, app/, etc.)                           | —           | ✓                           |
| `project.json#learnings[]` met `source: "synced"` | ✓ (lokaal)  | — (extractie uit team-code) |

`project.json#learnings[]` met `source: "synced"` zijn extracties uit teammate code via `/project-pull` of `/core-setup --mode=mature` — ze zijn van jou, niet van het team.
