# claude-config

> **改善 (Kaizen)** — _Good enough today, better tomorrow._

A personal, versioned Claude Code setup. Skills, agents, hooks, and project scaffolding linked to `~/.claude/` via junctions (Windows) or symlinks (macOS) for global availability across all projects.

## What this is

A central repo that extends Claude Code with reusable slash commands (skills), specialized sub-agents, auto-formatting hooks, and project scaffolding. Instead of repeating prompts or instructions per project, everything lives here and is shared globally via junctions/symlinks.

## How it works

```
~/.claude/skills/  →  junction/symlink to this repo's skills/
~/.claude/agents/  →  junction/symlink to this repo's agents/
~/.claude/hooks/   →  junction/symlink to this repo's hooks/
```

Skills are invoked as `/skill-name` in Claude Code. Agents run as isolated sub-processes for tasks that benefit from parallelism or separate context.

## Entry points

### 1. First-time bootstrap

Clone the repo and create the global junctions/symlinks once:

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

See [`local/README.md`](local/README.md) for portable configs (settings, keybindings, statusline, CLAUDE.md base).

### 2. Register a project — `/project-add`

Registers a project in the multi-project setup: creates project-level junctions/symlinks pointing back to this repo, optionally clones a GitHub repo. Run once per project.

### 3. Set up a project — `/core-setup`

The entry point for project-internal setup. Auto-detects project state and routes to the right flow. **Re-invokable** — call it again anytime to audit, resync, or add tools:

| Mode               | When                                                                                           |
| ------------------ | ---------------------------------------------------------------------------------------------- |
| `greenfield`       | New project — stack selection, CLAUDE.md generation, dashboard init                            |
| `mature`           | Joining an existing project — full codebase scan + LLM learnings                               |
| `audit`            | Checklist scan, no mutations without opt-in                                                    |
| `resync`           | Re-sync CLAUDE.md template sections after drift                                                |
| `install [module]` | Add tools/libraries incrementally: `tailwind`, `vitest`, `playwright`, `shadcn-ui`, `biome`, … |

Example: `/core-setup install tailwind` adds Tailwind to an existing project without re-running full setup.

## Structure

```
skills/           Slash commands, organized by category (see below)
  shared/         Shared references and patterns — read-only single source of truth
  {cat}-{verb}/   Each skill: SKILL.md + optional references/, scripts/, techniques/
agents/           Sub-agent definitions (markdown with YAML frontmatter)
hooks/            PostToolUse hooks (see Hooks section)
local/            Portable configs for ~/.claude/ — copy, don't junction
CLAUDE.base.md    Template for per-project CLAUDE.md generation
```

## Skills

Skills follow a `{category}-{verb}` naming convention. See [`skills/shared/SKILL-PATTERNS.md`](skills/shared/SKILL-PATTERNS.md) for conventions.

| Category    | Skills                                                                      |
| ----------- | --------------------------------------------------------------------------- |
| `core`      | setup, create, edit, delete, audit, commit, export, merge, profile, rewrite |
| `dev`       | define, build, verify, debug, refactor, optimize, owasp                     |
| `frontend`  | design, convert, check, tokens                                              |
| `game`      | define, build, verify, debug, refactor, optimize                            |
| `marketing` | research, content, screenshots                                              |
| `project`   | add, remove, pull, tunnel, backlog, plan, todo                              |
| `school`    | learn                                                                       |
| `team`      | review, verify                                                              |
| `thinking`  | brainstorm, concept, critique, decide, research                             |
| `shared`    | Shared refs: RULES, PATTERNS, PIPELINE, DASHBOARD, DEVINFO, PLAYWRIGHT, …   |

## Pipelines

Skills chain together in pipelines, handing off state via `.project/project.json`. See [`skills/shared/PIPELINE.md`](skills/shared/PIPELINE.md) for canonical diagrams.

- **Dev/Game**: `project-todo`/`project-plan` → `define` → `build` → `verify` → [`refactor`] (+ `debug` anywhere)
- **Frontend**: `design` → (`convert` / `check` / `tokens`) → handoff → `dev-build` (+ `core-setup install` for new tools)
- **Marketing**: `research` → `content` → `screenshots`

## Agents

Sub-agents run in isolated context — used for parallelism, independent reasoning, or large-context isolation. See `agents/` for definitions.

| Cluster              | Purpose                                             |
| -------------------- | --------------------------------------------------- |
| `fix-*` (3)          | Fix strategies — minimal, thorough, defensive       |
| `owasp-*` (13)       | OWASP Top 10 scanners + remediation strategies      |
| `godot-*` (4)        | Godot/GDScript researchers + TDD implementer        |
| `learning-extractor` | Extract atomic patterns/pitfalls for project memory |

## Profiles

`/core-profile` toggles skill visibility by profile (e.g. hide game skills when doing web work). Managed via `skills/core-profile/profiles.yaml`.

## Hooks

| Hook                   | Trigger                | What it does                                  |
| ---------------------- | ---------------------- | --------------------------------------------- |
| `format-on-save.cjs`   | PostToolUse Write/Edit | Runs Prettier (web) or gdformat (GDScript)    |
| `prompt-timer.cjs`     | PostToolUse            | Tracks prompt duration                        |
| `security-reminder.py` | PostToolUse            | Surfaces security reminders on relevant edits |

`local/statusline-command.cjs` provides a Claude Code statusline integration (copy to `~/.claude/`, don't junction).

## Cross-platform

Works on both **Windows** (primary) and **macOS**. Skills use `{projects_root}` instead of hardcoded paths. `paths.yaml` holds per-platform defaults, overrideable via env vars or `paths.local.yaml`.

## License

Personal configuration — not intended for distribution.
