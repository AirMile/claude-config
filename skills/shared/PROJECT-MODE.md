# Project Mode — Team / Solo Contract

Single source of truth for how Claude Code skills determine whether a project is solo or team-based.

## Source of Truth

`.project/project.json#team.mode` — values: `"solo"` | `"team"`. Absent or unrecognized → treat as `"solo"` (backwards compat).

Only two things may **write** this field:

- `/core-setup` (initial value, set during setup)
- Backlog/dashboard ⚙ toggle → `serve-backlog.js` → `POST /{project}/settings/team-mode` handler (runtime toggle, patches file atomically)

All skills **read only**. Never set `team.mode` from a skill.

## Read Pattern

Use in PHASE 0 of any mode-aware skill:

```bash
TEAM_MODE=$(jq -r '.team.mode // "solo"' .project/project.json 2>/dev/null || echo "solo")
```

Always read fresh per invoke — never cache across phases or skill-runs. The backlog toggle may have flipped the value since the last run.

## Skill Categories

### Mode-agnostic (no read needed)

dev-ship, dev-debug, dev-learn, dev-security, core-commit (reads `commitConvention`, not `mode`), core-audit, content-rewrite, content-write, core-update, core-bootstrap.

### Mode-aware (branches on TEAM_MODE)

- **PHASE Finalize (inline auto-dispatch, no modal):** dev-ship (verify phase), game-verify
- **PHASE Finalize (3-way modal via FINALIZE.md):** dev-ship (refactor phase), game-refactor, design-check
- **PHASE 0 entry-guard (team-mode batch guard, see below):** dev-ship (refactor phase), game-refactor, design-check
- **Other:** core-finalize, core-pull (info hint), shared/FINALIZE.md, shared/PR.md

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

### Team-mode batch guard (for dev-ship (refactor phase), game-refactor, design-check)

Fire when `TEAM_MODE == "team"` AND the skill is about to enter batch/codebase mode (queue > 1 or
no-arg). Single-feature invoke → guard does NOT fire.

```yaml
header: "Team project — batch"
question: "This project is team mode. Batch {refactor|check} produces cross-feature changes that can't be split into per-feature PRs. In team mode each feature ships via its own PR. Continue with batch anyway?"
options:
  - label: "Cancel — go per feature (Recommended)"
    description: "Exit. Run /{skill} {feature-name} per feature so each gets its own PR/finalize."
  - label: "Yes, batch anyway"
    description: "Proceed with one combined cross-feature pass (no per-feature PRs; finalize stays skipped)."
multiSelect: false
```

Cancel → exit. Continue → proceed with batch flow as-is (finalize stays skipped, behaviour unchanged).

### Mode-aware finalize (for FINALIZE.md and PHASE Finalize)

See `shared/FINALIZE.md → Finalize Offer Decision` (single source of truth). That matrix covers all
TEAM_MODE × PR_STATE combinations including the 3-way choice (Open PR / Merge directly / Keep open)
for team + empty/CLOSED.

## Backlog Toggle

The backlog UI exposes an ⚙ icon-button (not a slider) that opens a "Project settings" modal with a solo/team toggle. Change is immediately POSTed to the local serve-backlog server which patches `project.json#team.mode` atomically.

**Important for strike-edge and other projects:** the board is rendered by the viewer server from the current template + `.project/backlog.json`, so re-opening the board via the viewer (or `/project-plan`) always shows the ⚙ button. Skills always read `project.json` — not the board UI — so the file is the correct source of truth regardless.

**Batch buttons:** the board hides the per-column batch buttons (`batchSkill`) when `team.mode === "team"` — batch is a solo concept; team ships per feature via individual PRs. See `backlog-template.html` `renderSection` gate (`batchSkill && items.length > 0 && data.team?.mode !== "team"`). The skill-side guard (§ Team-mode batch guard above) backs this up for manual invokes.

## Migration Checklist

When adding team/solo branching to a new skill, check:

- [ ] Read `TEAM_MODE` in PHASE 0 (after loading project.json, before any mode-specific action)
- [ ] If skill has a batch/codebase mode: add team-mode batch guard (§ Team-mode batch guard) after the mode-detection step, before worktree switch / batch execution
- [ ] Handle `gh` unavailable gracefully — never fall through to solo-merge in team mode
- [ ] Reference this document in the skill's mode-branching section
