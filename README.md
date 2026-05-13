# claude-config

> **改善 (Kaizen)** — _Good enough today, better tomorrow._

A personal, versioned Claude Code setup. Skills, agents, hooks, and project scaffolding linked to `~/.claude/` via junctions (Windows) or symlinks (macOS) for global availability across all projects.

## What this is

A central repo that extends Claude Code with reusable slash commands (skills), specialized sub-agents, auto-formatting hooks, and project scaffolding. Instead of repeating prompts or instructions per project, everything lives here and is shared globally via junctions/symlinks.

## How it works

```
~/.claude/skills/   →  junction/symlink to this repo's skills/
~/.claude/agents/   →  junction/symlink to this repo's agents/
~/.claude/hooks/    →  junction/symlink to this repo's hooks/
~/.claude/scripts/  →  junction/symlink to this repo's scripts/
```

Skills are invoked as `/skill-name` in Claude Code. Agents run as isolated sub-processes for tasks that benefit from parallelism or separate context.

## Entry points

### 1. First-time bootstrap

Clone the repo, then run `/core-bootstrap` to bootstrap `~/.claude/` — deploys CLAUDE.md, settings.json (incl. hooks), keybindings, statusline-command.cjs, and all four global symlinks. One-time per machine, idempotent. See [`local/README.md`](local/README.md) for the manual fallback.

To keep claude-config up to date after the initial bootstrap, run `/core-update` periodically — it pulls the latest version and rebuilds your composed global files.

### 2. Register a project — `/project-add`

Creates project structure (`.claude/`, `.project/`) and optionally clones a GitHub repo. Run once per project.

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
personal/         Personal overlay — gitignored, never committed (see Personal overlay)
CLAUDE.base.md    Template for per-project CLAUDE.md generation
```

## Skills

Skills follow a `{category}-{verb}` naming convention. See [`skills/shared/SKILL-PATTERNS.md`](skills/shared/SKILL-PATTERNS.md) for conventions.

| Category    | Skills                                                                                 |
| ----------- | -------------------------------------------------------------------------------------- |
| `core`      | bootstrap, setup, create, edit, delete, audit, commit, export, merge, rewrite, write   |
| `dev`       | define, build, verify, debug, refactor, optimize, owasp                                |
| `frontend`  | design, convert, check, tokens                                                         |
| `game`      | define, build, verify, debug, refactor, optimize                                       |
| `marketing` | research, content, screenshots                                                         |
| `project`   | add, backlog, brainstorm, critique, pull, research, seed, switch, todo, tunnel, viewer |
| `school`    | learn                                                                                  |
| `team`      | issues, outsource, review, verify                                                      |

## Pipelines

Skills chain together via `.project/project-seed.md` and `.project/project.json`. See [`skills/shared/PIPELINE.md`](skills/shared/PIPELINE.md) for canonical diagrams.

**Planning entry point** (greenfield or mature project):
`project-seed` → [`project-brainstorm`] → [`project-critique`] → `project-backlog` → `define` → `build` → `verify` → [`refactor`] (+ `debug` anywhere)

- **Thin** (mature project / task assignment): `/project-seed` asks 3-5 focused questions → thin seed document
- **Rich** (new product / game): `/project-seed` runs full intake → rich seed document
- `project-backlog` adapts backlog output to the richness of the seed — same flow, variable input depth

**Frontend**: `design` → [`convert`] → `check`
**Marketing**: `research` → `content` → `screenshots`

## Agents

Sub-agents run in isolated context — used for parallelism, independent reasoning, or large-context isolation. See `agents/` for definitions.

| Cluster              | Purpose                                             |
| -------------------- | --------------------------------------------------- |
| `fix-*` (3)          | Fix strategies — minimal, thorough, defensive       |
| `owasp-*` (13)       | OWASP Top 10 scanners + remediation strategies      |
| `godot-*` (4)        | Godot/GDScript researchers + TDD implementer        |
| `learning-extractor` | Extract atomic patterns/pitfalls for project memory |

## Hooks

| Hook                   | Trigger                | What it does                                  |
| ---------------------- | ---------------------- | --------------------------------------------- |
| `format-on-save.cjs`   | PostToolUse Write/Edit | Runs Prettier (web) or gdformat (GDScript)    |
| `prompt-timer.cjs`     | PostToolUse            | Tracks prompt duration                        |
| `security-reminder.py` | PostToolUse            | Surfaces security reminders on relevant edits |

`local/statusline-command.cjs` provides a Claude Code statusline integration (copy to `~/.claude/`, don't junction).

## Cross-platform

Works on both **Windows** (primary) and **macOS**. Skills use `{projects_root}` instead of hardcoded paths. `paths.yaml` holds per-platform defaults, overrideable via env vars or `paths.local.yaml`.

## Prerequisites

| Tool                               | Version | Required for                                                  |
| ---------------------------------- | ------- | ------------------------------------------------------------- |
| [Node.js](https://nodejs.org)      | 18+     | Hooks (format-on-save, prompt-timer), backlog server          |
| Python 3                           | 3.8+    | Security-reminder hook                                        |
| [git](https://git-scm.com)         | any     | Version control                                               |
| [gh CLI](https://cli.github.com)   | any     | Team skills (team-review, team-issues, core-merge) — optional |
| [jq](https://jqlang.github.io/jq/) | any     | Personal overlay settings merge — optional                    |

## Install

```bash
# 1. Clone
git clone https://github.com/<your-username>/claude-config.git
cd claude-config

# 2. Bootstrap — deploys CLAUDE.md, settings.json, keybindings, statusline + global symlinks
# Run this inside Claude Code: /core-bootstrap
```

For manual setup without Claude Code, see [`local/README.md`](local/README.md).

## Personal overlay

Keep your personal customisations (language preference, writing styles, opinionated
defaults) separate from the public repo in a `personal/` directory:

```
personal/                    ← gitignored, never committed
  CLAUDE.md.overlay          ← appended to ~/.claude/CLAUDE.md after base
  settings.overlay.json      ← deep-merged into settings.json (your values win)
  styles/                    ← writing styles for core-write / core-rewrite
```

Bootstrap (`/core-bootstrap`) auto-detects `personal/` and applies overlays. Your
`personal/` directory survives `git pull` safely — it is gitignored.

See [`personal/README.md.template`](personal/README.md.template) for setup instructions.

**Multi-device sync options:**

- iCloud / OneDrive / Dropbox: place `personal/` in a cloud folder, symlink from the repo
- Private git repo: host as a private GitHub repo, clone into `personal/`
- Manual: copy across devices when needed

## License

MIT — see [LICENSE](LICENSE).
