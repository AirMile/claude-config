# claude-config

> **改善 (Kaizen)** — _Good enough today, better tomorrow._

A personal, versioned Claude Code setup — skills, hooks, and project scaffolding linked into `~/.claude/` via symlinks (macOS) or junctions (Windows). Skills run as `/skill-name`; a few delegate to isolated sub-agents under the hood.

```
~/.claude/skills/   →  junction/symlink to this repo's skills/
~/.claude/agents/   →  junction/symlink to this repo's agents/
~/.claude/hooks/    →  junction/symlink to this repo's hooks/
~/.claude/scripts/  →  junction/symlink to this repo's scripts/
```

## Quickstart

**1. Clone the repo:**

```bash
git clone https://github.com/<your-username>/claude-config.git
cd claude-config
```

**2. Bootstrap once per machine** (inside Claude Code):

```
/core-bootstrap
```

Deploys `CLAUDE.md`, `settings.json`, `keybindings.json`, statusline + 4 global symlinks (`~/.claude/{skills,agents,hooks,scripts}`).

**3. Per project, pick one entry point:**

| Situation                                    | Run                                                            |
| -------------------------------------------- | -------------------------------------------------------------- |
| Already inside an existing project directory | `/core-setup` — auto-detects greenfield vs. mature             |
| Creating or cloning a fresh project          | `/project-add` from anywhere — then hands off to `/core-setup` |

`/core-setup` is re-invokable: `audit` (checklist), `resync` (refresh CLAUDE.md), `install <module>` (tailwind / vitest / playwright / shadcn-ui / biome / …).

**4. Stay up to date:**

```
/core-update
```

Pulls the latest claude-config and rebuilds composed global files. For setup without Claude Code, see [`local/README.md`](local/README.md). Release notes per version: [`CHANGELOG.md`](CHANGELOG.md).

### Recommended Claude Code settings

`/model opusplan` + `"effortLevel": "high"` in `~/.claude/settings.json`. claude-config is built around this setup for token efficiency — Opus plans, Sonnet executes — not full-Opus runs. `/core-bootstrap` asks for your Claude plan and tunes the advice: the defaults are calibrated for **Max 5x**; Pro / Max 10x get different guidance.

## Skills & pipelines

Skills follow a `{category}-{verb}` naming convention. See [`skills/shared/SKILL-PATTERNS.md`](skills/shared/SKILL-PATTERNS.md) for conventions and [`skills/shared/PIPELINE.md`](skills/shared/PIPELINE.md) for canonical pipeline diagrams.

| Category    | Skills                                                                                     |
| ----------- | ------------------------------------------------------------------------------------------ |
| `core`      | audit, bootstrap, commit, create, delete, edit, merge, pull, rewrite, setup, update, write |
| `dev`       | build, debug, define, learn, optimize, owasp, refactor, verify                             |
| `design`    | check, content, create, tokens                                                             |
| `game`      | build, debug, define, optimize, refactor, verify                                           |
| `marketing` | content, research, screenshots                                                             |
| `project`   | add, backlog, brainstorm, critique, remove, research, seed, switch, todo, tunnel, viewer   |
| `team`      | issues, outsource, review, verify                                                          |

| Pipeline    | Flow                                                                                                                                                   |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `dev`       | `project-seed` → [`project-brainstorm`] → [`project-critique`] → `project-plan` → `define` → `build` → `verify` → [`refactor`] (+ `debug` anywhere) |
| `game`      | `project-seed` → `project-plan` → `define` → `build` → `verify` → [`refactor`] (+ `debug` anywhere, Godot 4.x / GUT)                                |
| `design`    | [`/design-tokens`] (incl. motion packs) → `design-create` (design/build/convert) → `design-content` (fill copy) → `design-check`                       |
| `marketing` | `marketing-research` → `marketing-content` → `marketing-screenshots`                                                                                   |

Optional `/project-research` enriches the dev seed with market/tech/codebase context before backlog.

State handoff between skills lives in `.project/session/devinfo.json` (schema: [`shared/DEVINFO.md`](skills/shared/DEVINFO.md)). A handful of skills delegate parallel work to sub-agents in [`agents/`](agents/) (OWASP scanners, Godot researchers, fix-strategies, learning-extractor) — invisible to the user.

### Runtime state — backlog, dashboard, learnings

All runtime artifacts live in a gitignored `.project/` directory per project:

| Artifact  | Path                                        | Purpose                                                                                                                                                                                                                                                  |
| --------- | ------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Backlog   | `.project/backlog.html`                     | Status flow: TODO → DEFINED → DOING → DONE → shipped                                                                                                                                                                                                     |
| Dashboard | `.project/project.json`                     | Context, features, stack, endpoints, entities (schema: [`shared/DASHBOARD.md`](skills/shared/DASHBOARD.md))                                                                                                                                              |
| Learnings | `.project/project-context.json#learnings[]` | Pull-based memory — Auto Memory deliberately disabled for token efficiency. Build/refactor skills append; consumers load via [`shared/LEARNINGS-LOAD.md`](skills/shared/LEARNINGS-LOAD.md) with scope (`component` / `architectural` / `pitfall-prefix`) |

Run `/project-viewer` to serve all project backlogs and dashboards on `http://localhost:9876` — one local board across every project under `{projects_root}`. Stop with `/project-viewer stop`.

## Inspect overlay

A dev-only visual element-picker: click any element in the browser to copy a bracketed reference like `[src/components/Button.tsx:42]`, then paste it into Claude. Cuts the "find this component" round-trip out of frontend iteration. Works on **Vite + React**, **Next.js**, and **plain JS / static HTML** (any DOM).

**Install** (per project):

```
/core-setup install inspect-overlay
```

Adds the overlay files to your project root and `.gitignore`, wires up the plugin, and restarts the dev server.

**Use** — keyboard-driven, no on-screen toggle:

| Action                                     | Result                                               |
| ------------------------------------------ | ---------------------------------------------------- |
| **Cmd+Shift+X** (macOS) / **Ctrl+Shift+X** | Toggle inspect mode on/off                           |
| Hover                                      | Highlights the element under your cursor             |
| Click                                      | Copies `[src/components/Button.tsx:42]` to clipboard |
| Shift+Click                                | Pin multiple elements (copies all refs together)     |
| Drag                                       | Select a region — copies refs for everything inside  |
| Ctrl+Z                                     | Unpin the last selected element                      |
| Escape                                     | Clear pins / exit inspect mode                       |

Paste the ref into Claude as context — no more "where is that button defined?"

**Modes** — Full = Babel injects `data-inspector-*` attrs → exact `file:line` refs; Degraded = no attrs → DOM-based refs (tag + class + visible text):

| Stack                             | Mode available  | Sample clipboard output                   |
| --------------------------------- | --------------- | ----------------------------------------- |
| Vite + React                      | Full / Degraded | `[src/components/Button.tsx:42:3]`        |
| Next.js + React                   | Full / Degraded | `[src/components/Button.tsx:42]`          |
| Plain JS / static HTML / no React | Degraded only   | `[button.btn.btn-primary "Save changes"]` |

Full mode trades faster builds (Turbopack on Next.js, OXC on Vite v6) for exact refs — `/core-setup install inspect-overlay` defaults to Full on Vite (pins `plugin-react@^5`) and asks on Next.js. Plain JS gets a one-shot script-tag install, always degraded. Details: [`skills/core-setup/references/modules/inspect-overlay/setup-guide.md`](skills/core-setup/references/modules/inspect-overlay/setup-guide.md).

**Teardown**: `/core-setup` does not remove modules automatically — ask explicitly ("remove the inspect overlay") and it walks back the install steps.

## Personal overlay

Keep personal customisations (language preference, writing styles, opinionated defaults) separate from the public repo:

```
personal/                    ← gitignored, never committed
  CLAUDE.md.overlay          ← appended to ~/.claude/CLAUDE.md after base
  settings.overlay.json      ← deep-merged into settings.json (your values win)
  styles/                    ← writing styles for core-write / core-rewrite
```

**Setup is manual** — `/core-bootstrap` only _applies_ overlays, it doesn't create them. Bootstrap your `personal/` folder once:

```bash
mkdir -p personal/styles
touch personal/CLAUDE.md.overlay personal/settings.overlay.json
# Then edit the two files with your additions, or copy from the template:
cp personal/README.md.template personal/README.md
```

The next `/core-bootstrap` (or `/core-update`) auto-detects the folder and merges it in. Survives `git pull` safely.

Multi-device sync: iCloud / OneDrive / Dropbox folder + symlink into `personal/`, a private GitHub repo cloned into `personal/`, or manual copy.

## Cross-platform & prerequisites

Cross-platform: **macOS** and **Windows**. Skills use `{projects_root}` instead of hardcoded paths; `paths.yaml` holds per-platform defaults, overrideable via env vars or `paths.local.yaml`.

| Tool                               | Version | Required for                                         |
| ---------------------------------- | ------- | ---------------------------------------------------- |
| [Node.js](https://nodejs.org)      | 18+     | Hooks (format-on-save, prompt-timer), backlog server |
| Python 3                           | 3.8+    | Security-reminder hook                               |
| [git](https://git-scm.com)         | any     | Version control                                      |
| [gh CLI](https://cli.github.com)   | any     | Team skills (team-review, team-issues) — optional    |
| [jq](https://jqlang.github.io/jq/) | any     | Personal overlay settings merge — optional           |

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
