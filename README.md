# claude-config

> **改善 (Kaizen)** — _Good enough today, better tomorrow._

A personal, versioned Claude Code setup — skills, agents, hooks, and project scaffolding linked into `~/.claude/` via junctions (Windows) or symlinks (macOS). Skills run as `/skill-name`; agents run isolated for parallelism or context isolation.

```
~/.claude/skills/   →  junction/symlink to this repo's skills/
~/.claude/agents/   →  junction/symlink to this repo's agents/
~/.claude/hooks/    →  junction/symlink to this repo's hooks/
~/.claude/scripts/  →  junction/symlink to this repo's scripts/
```

## Quickstart

```bash
git clone https://github.com/<your-username>/claude-config.git
cd claude-config
# then inside Claude Code:
/core-bootstrap        # one-time per machine — deploys CLAUDE.md, settings.json, keybindings, statusline + 4 global symlinks
/project-add           # once per project — creates .claude/ and .project/
/core-setup            # auto-detects greenfield/mature/audit/resync; re-invokable with `install <module>`
```

Run `/core-update` periodically to pull the latest version and rebuild composed global files. For manual setup without Claude Code, see [`local/README.md`](local/README.md).

**Recommended Claude Code settings** — `/model opusplan` (runtime) and `"effortLevel": "high"` in `~/.claude/settings.json`. Multiple skills (`dev-define`, `shared/PLAN-MODE.md`) lean on `opusplan` for their thinking phases. `/core-bootstrap` asks for your Claude plan and tailors the advice — the defaults above are tuned for **Max 5x**; Pro / Max 10x get different guidance.

`/core-setup` modes: `greenfield` (stack + CLAUDE.md + dashboard), `mature` (codebase scan + LLM learnings), `audit` (checklist, no mutations), `resync` (re-sync CLAUDE.md template), `install <module>` (incremental tooling — `tailwind`, `vitest`, `playwright`, `shadcn-ui`, `biome`, …).

## Skills & pipelines

Skills follow a `{category}-{verb}` naming convention. See [`skills/shared/SKILL-PATTERNS.md`](skills/shared/SKILL-PATTERNS.md) for conventions and [`skills/shared/PIPELINE.md`](skills/shared/PIPELINE.md) for canonical pipeline diagrams.

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

**Dev pipeline** — `project-seed` → [`project-brainstorm`] → [`project-critique`] → `project-backlog` → `define` → `build` → `verify` → [`refactor`] (+ `debug` anywhere). Optional `/project-research` enriches the seed with market/tech/codebase context.
**Frontend** — `design` → [`convert`] → `check`.
**Marketing** — `research` → `content` → `screenshots`.

State handoff between skills lives in `.project/session/devinfo.json` (schema: [`shared/DEVINFO.md`](skills/shared/DEVINFO.md)).

## Agents & hooks

Sub-agents run in isolated context for parallelism, independent reasoning, or large-context isolation.

| Cluster              | Purpose                                             |
| -------------------- | --------------------------------------------------- |
| `fix-*` (3)          | Fix strategies — minimal, thorough, defensive       |
| `owasp-*` (13)       | OWASP Top 10 scanners + remediation strategies      |
| `godot-*` (4)        | Godot/GDScript researchers + TDD implementer        |
| `learning-extractor` | Extract atomic patterns/pitfalls for project memory |

| Hook                   | Trigger                | What it does                                  |
| ---------------------- | ---------------------- | --------------------------------------------- |
| `format-on-save.cjs`   | PostToolUse Write/Edit | Runs Prettier (web) or gdformat (GDScript)    |
| `prompt-timer.cjs`     | UserPromptSubmit       | Tracks prompt duration                        |
| `security-reminder.py` | PreToolUse Write/Edit  | Surfaces security reminders on relevant edits |

`local/statusline-command.cjs` provides a Claude Code statusline integration (copied by `/core-bootstrap`, not symlinked).

## Personal overlay

Keep personal customisations (language preference, writing styles, opinionated defaults) separate from the public repo:

```
personal/                    ← gitignored, never committed
  CLAUDE.md.overlay          ← appended to ~/.claude/CLAUDE.md after base
  settings.overlay.json      ← deep-merged into settings.json (your values win)
  styles/                    ← writing styles for core-write / core-rewrite
```

`/core-bootstrap` auto-detects `personal/` and applies overlays. Survives `git pull` safely. See [`personal/README.md.template`](personal/README.md.template) for setup.

Multi-device sync: iCloud / OneDrive / Dropbox folder + symlink, private GitHub repo cloned into `personal/`, or manual copy.

## Cross-platform & prerequisites

Works on **Windows** (primary) and **macOS**. Skills use `{projects_root}` instead of hardcoded paths; `paths.yaml` holds per-platform defaults, overrideable via env vars or `paths.local.yaml`.

| Tool                               | Version | Required for                                                  |
| ---------------------------------- | ------- | ------------------------------------------------------------- |
| [Node.js](https://nodejs.org)      | 18+     | Hooks (format-on-save, prompt-timer), backlog server          |
| Python 3                           | 3.8+    | Security-reminder hook                                        |
| [git](https://git-scm.com)         | any     | Version control                                               |
| [gh CLI](https://cli.github.com)   | any     | Team skills (team-review, team-issues, core-merge) — optional |
| [jq](https://jqlang.github.io/jq/) | any     | Personal overlay settings merge — optional                    |

<details>
<summary>Repo layout</summary>

```
skills/           Slash commands, organized by category
  shared/         Shared references and patterns — read-only single source of truth
  {cat}-{verb}/   Each skill: SKILL.md + optional references/, scripts/, techniques/
agents/           Sub-agent definitions (markdown with YAML frontmatter)
hooks/            PostToolUse / PreToolUse / UserPromptSubmit hooks
local/            Portable configs for ~/.claude/ — copied by bootstrap, not symlinked
personal/         Personal overlay — gitignored, never committed
CLAUDE.base.md    Template for per-project CLAUDE.md generation
```

</details>

## License

MIT — see [LICENSE](LICENSE).
