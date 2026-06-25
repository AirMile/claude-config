# Contributing

## Adding a new skill

1. Create a directory: `skills/{category}-{verb}/`
2. Add `SKILL.md` with frontmatter (copy from an existing skill in the same category)
3. Follow conventions in [`skills/shared/SKILL-PATTERNS.md`](skills/shared/SKILL-PATTERNS.md)
4. Skill files must be written in **English** — see [`skills/shared/LANGUAGE.md`](skills/shared/LANGUAGE.md)

## Naming conventions

- Directory: `{category}-{verb}` — lowercase, hyphen-separated
- Categories: `core`, `dev`, `frontend`, `game`, `marketing`, `project`, `team`

## Commit style

Conventional commits: `feat(skill-name):`, `fix(skill-name):`, `docs:`, `refactor:`, `chore:`

## Dev/game pipeline sync

For structural changes to dev-pipeline skills (`dev-define`, `dev-build`, `dev-verify`,
`dev-debug`, `dev-refactor`): check whether the game-pipeline counterpart (`game-*`) needs
the same change. Domain-specific content (Godot vs web, GUT vs browser) does not need to sync.

## Shared infra

Files in `skills/shared/` are a read-only single source of truth. Reference them,
don't duplicate. Propose changes with a clear rationale — modifications affect all skills.

## Frontmatter

```yaml
---
name: category-verb
description: >-
  One-sentence description for the skill picker.
argument-hint: "[optional-arg]"
metadata:
  author: claude-config
  version: 1.0.0
  category: category
---
```

Update `author` to your own handle when publishing a fork.

## Releases

Skill-level versions (`metadata.version` in frontmatter) are per-skill. Repo releases are tagged `vX.Y.Z` when an `[Unreleased]` block is substantial:

- **minor** (`X.Y+1.0`) — new skills, pipeline changes, new shared infra
- **patch** (`X.Y.Z+1`) — fixes, small refinements, documentation

To cut a release:

1. Run `python3 scripts/check-handoff.py`, `python3 scripts/check-dashboard-writers.py`, and `python3 scripts/check-no-project-commit.py` — all must exit 0.
2. Update `CHANGELOG.md` (`[Unreleased]` → `[X.Y.Z] - YYYY-MM-DD`), commit.
3. `git tag -a vX.Y.Z -m "claude-config vX.Y.Z"`

## Personal customisations

Personal content (language preference, writing styles, opinionated defaults) belongs
in `personal/` — never commit it to the public repo. See [`personal/README.md.template`](personal/README.md.template).
