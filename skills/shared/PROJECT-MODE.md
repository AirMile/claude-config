# Project Mode — Team / Solo Contract

Single source of truth for how Claude Code skills determine whether a project is solo or team-based.

## Source of Truth

`.project/project.json#team.mode` — values: `"solo"` | `"team"`. Absent or unrecognized → treat as `"solo"` (backwards compat).

Only two things may **write** this field:

- `/core-setup` (initial value, set during setup)
- Backlog/dashboard ⚙ toggle → `serve-backlog.js:766-816` (runtime toggle, patches file atomically)

All skills **read only**. Never set `team.mode` from a skill.

## Read Pattern

Use in PHASE 0 of any mode-aware skill:

```bash
TEAM_MODE=$(jq -r '.team.mode // "solo"' .project/project.json 2>/dev/null || echo "solo")
```

Always read fresh per invoke — never cache across phases or skill-runs. The backlog toggle may have flipped the value since the last run.

## Skill Categories

### Mode-agnostic (no read needed)

dev-build, dev-define, dev-debug, dev-learn, dev-security, core-commit (reads `commitConvention`, not `mode`), core-audit, core-edit, core-create, core-delete, core-rewrite, core-write, core-update, core-bootstrap.

### Mode-aware (branches on TEAM_MODE)

dev-verify (PHASE Finalize), dev-refactor (PHASE Finalize), core-finalize, core-pull (info hint), shared/FINALIZE.md, shared/PR.md.

### Team-only (warn-gate when solo)

team-review, team-verify, team-outsource, team-issues.

## Gate Templates

### Team-only warn-gate (for team-\* skills)

```yaml
header: "Solo project"
question: "This project is marked solo (team.mode). /team-{skill} is meant for projects with multiple contributors. Continue anyway?"
options:
  - label: "Cancel (Recommended)"
    description: "Exit. Toggle to team via the ⚙ button in the backlog or run /core-setup to mark this as a team project."
  - label: "Yes, continue once"
    description: "Proceed with this single invocation."
multiSelect: false
```

Cancel → exit. Continue → proceed with step 1.

### Mode-aware finalize (for FINALIZE.md and PHASE Finalize)

Decision matrix (TEAM_MODE × PR_STATE):

| TEAM_MODE | PR_STATE         | Action                                                                                        |
| --------- | ---------------- | --------------------------------------------------------------------------------------------- |
| solo      | `MERGED`         | cleanup-only                                                                                  |
| solo      | `OPEN`           | Print PR URL + halt                                                                           |
| solo      | empty / `CLOSED` | Solo-merge to main                                                                            |
| solo      | `gh` unavailable | Solo-merge to main (fall-through)                                                             |
| team      | `MERGED`         | cleanup-only                                                                                  |
| team      | `OPEN`           | Print PR URL + halt                                                                           |
| team      | empty / `CLOSED` | Prompt: "Push + open PR via /team-review?" — no auto solo-merge                               |
| team      | `gh` unavailable | Warn: "team mode but `gh` unavailable — run `gh auth login` or toggle solo in backlog." Halt. |

## Backlog Toggle

The backlog UI exposes an ⚙ icon-button (not a slider) that opens a "Project settings" modal with a solo/team toggle. Change is immediately POSTed to the local serve-backlog server which patches `project.json#team.mode` atomically.

**Important for strike-edge and other projects:** the board is rendered by the viewer server from the current template + `.project/backlog.json`, so re-opening the board via the viewer (or `/project-backlog`) always shows the ⚙ button. Skills always read `project.json` — not the board UI — so the file is the correct source of truth regardless.

## Migration Checklist

When adding team/solo branching to a new skill, check:

- [ ] Read `TEAM_MODE` in PHASE 0 (after loading project.json, before any mode-specific action)
- [ ] Handle `gh` unavailable gracefully — never fall through to solo-merge in team mode
- [ ] Reference this document in the skill's mode-branching section
