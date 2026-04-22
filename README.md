# claude-config

> **改善 (Kaizen)** — _Good enough today, better tomorrow._

Personal Claude Code configuration: skills, agents, hooks, and project scaffolding. Linked to `~/.claude/` via junctions (Windows) or symlinks (macOS) for global availability across all projects.

## What this is

A central repo that extends Claude Code with reusable slash commands (skills), specialized sub-agents, and auto-formatting hooks. Instead of repeating prompts or instructions per project, everything lives here and is shared globally.

## How it works

```
~/.claude/skills/  →  junction/symlink to this repo's skills/
~/.claude/agents/  →  junction/symlink to this repo's agents/
~/.claude/hooks/   →  junction/symlink to this repo's hooks/
```

Skills are invoked as `/skill-name` in Claude Code. Agents run as isolated sub-processes for tasks that benefit from parallelism or separate context.

**Per-project setup** is handled by the `/project-add` skill, which creates junctions/symlinks and configures the project's `.claude/` directory.

## Structure

```
skills/           Slash commands, organized by category
  shared/         Shared references and patterns (read-only)
  {category}-{verb}/  Each skill has a SKILL.md + optional references/
agents/           Sub-agent definitions (markdown with YAML frontmatter)
hooks/            PostToolUse hooks (format-on-save, prompt-timer)
local/            Portable configs for ~/.claude/ (copy, don't junction)
CLAUDE.base.md    Template for per-project CLAUDE.md generation
```

### Skill categories

Skills follow a `{category}-{verb}` naming convention. Browse `skills/` for the current set — categories include core workflows, dev pipeline, frontend pipeline, game dev (Godot), and more.

### Pipelines

Skills chain together in pipelines where each step hands off state to the next:

- **Frontend**: plan → theme → compose/convert → iterate → audit/wcag
- **Dev**: define → plan → build → test → debug → refactor
- **Game**: define → plan → build → test → debug → refactor (Godot 4.x)

## Setup

### 1. Clone and link

```powershell
# Windows
git clone <repo-url> C:\Projects\claude-config
cmd /c mklink /J "%USERPROFILE%\.claude\skills" "C:\Projects\claude-config\skills"
cmd /c mklink /J "%USERPROFILE%\.claude\agents" "C:\Projects\claude-config\agents"
cmd /c mklink /J "%USERPROFILE%\.claude\hooks" "C:\Projects\claude-config\hooks"
```

```bash
# macOS
git clone <repo-url> ~/projects/claude-config
ln -sfn ~/projects/claude-config/skills ~/.claude/skills
ln -sfn ~/projects/claude-config/agents ~/.claude/agents
ln -sfn ~/projects/claude-config/hooks ~/.claude/hooks
```

### 2. Copy local configs

See [`local/README.md`](local/README.md) for portable configs (settings, keybindings, statusline, CLAUDE.md base).

## Cross-platform

Works on both **Windows** (primary) and **macOS**. Skills use `{projects_root}` instead of hardcoded paths. Platform-specific commands are documented for both OS's.

## License

Personal configuration — not intended for distribution.
