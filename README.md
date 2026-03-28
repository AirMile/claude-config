# claude-config

Personal Claude Code configuration: skills, agents, hooks, and project scaffolding. Symlinked to `~/.claude/` for global availability across all projects.

## What this is

A central repo that extends Claude Code with reusable slash commands (skills), specialized sub-agents, and auto-formatting hooks. Instead of repeating prompts or instructions per project, everything lives here and is shared globally.

## How it works

```
~/.claude/skills/  →  symlink to this repo's skills/
~/.claude/agents/  →  symlink to this repo's agents/
```

Skills are invoked as `/skill-name` in Claude Code. Agents run as isolated sub-processes for tasks that benefit from parallelism or separate context.

**Per-project setup** links project-specific config (like `CLAUDE.base.md`) into a project's `.claude/` directory:

```bash
./setup-project.sh <project-name>
```

## Structure

```
skills/           Slash commands, organized by category
  shared/         Shared references and patterns (read-only)
  {category}-{verb}/  Each skill has a SKILL.md + optional references/
agents/           Sub-agent definitions (markdown with YAML frontmatter)
hooks/            PostToolUse hooks (e.g. auto-format on save)
CLAUDE.base.md    Template for per-project CLAUDE.md generation
setup-project.sh  Links config into a project's .claude/
```

### Skill categories

Skills follow a `{category}-{verb}` naming convention. Browse `skills/` for the current set — categories include core workflows, dev pipeline, frontend pipeline, game dev (Godot), and more.

### Pipelines

Skills chain together in pipelines where each step hands off state to the next:

- **Frontend**: plan → theme → compose/convert → iterate → audit/wcag
- **Dev**: define → plan → build → test → debug → refactor
- **Game**: define → plan → build → test → debug → refactor (Godot 4.x)

## Cross-platform

Works on both **Linux** (VPS) and **Windows** (local dev). Skills use `{projects_root}` instead of hardcoded paths. Platform-specific commands are documented for both OS's.

## License

Personal configuration — not intended for distribution.
