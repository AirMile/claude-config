# claude-config

Personal Claude Code configuration: skills, agents, hooks, and scripts. Linked to `~/.claude/` via junctions (Windows) or symlinks (macOS) so everything is globally available.

**Paths are identical** — `~/.claude/skills/` and the repo's `skills/` point to the same files. Always commit in this repo.

## Platform

Cross-platform: **macOS** and **Windows**.

|               | macOS/Linux         | Windows                |
| ------------- | ------------------- | ---------------------- |
| Repo          | configurable        | configurable           |
| Projects root | configurable        | configurable           |
| Link          | `ln -sfn` (symlink) | `mklink /J` (junction) |
| Godot         | n/a                 | configurable           |
| Shell         | bash/zsh            | PowerShell             |

**Rules:**

- Run `/core-bootstrap` once per machine — it writes `.claude/paths.local.yaml` with your local paths
- Use `{projects_root}` in skills, not hardcoded paths
- `paths.yaml` contains per-platform defaults (override via env vars or `paths.local.yaml`)
- **Path resolution:** env var (`CLAUDE_PROJECTS_ROOT`, `CLAUDE_CONFIG_REPO`, `CLAUDE_GODOT_EXECUTABLE`) → `.claude/paths.local.yaml` (per project, not in git) → `skills/project-add/paths.yaml` (canonical defaults)
- Git on Windows: avoid `git -C <path>` with backslashes → `cd "<path>" && git <cmd>`
- Platform-specific commands always document both OSes

## Structure

```
skills/           48 skills in 9 categories
  shared/         RULES.md, PATTERNS.md, PLAYWRIGHT.md, VALIDATION.md, DEVINFO.md
  {cat}-{verb}/   Skill directories (each with SKILL.md)
agents/           21 sub-agent definitions (.md with YAML frontmatter)
hooks/            format-on-save.cjs, prompt-timer.cjs, security-reminder.py
local/            Portable configs for ~/.claude/ (templates, not linked)
CLAUDE.base.md    Template for per-project CLAUDE.md generation
```

## Skill Conventions

- **Naming**: `{category}-{verb}` — lowercase, hyphen. Categories: core, dev, design, game, marketing, project, team
- **Directory**: each skill = folder with `SKILL.md`, optionally `references/`, `scripts/`, `techniques/`
- **Frontmatter**: metadata with author/version/category — use `disable-model-invocation: true` only if the skill must never be invokable via the Skill tool (also blocks user-triggered `/skill-name`)
- **Description**: one short sentence — `<Verb-phrase>. Use with /<skill-name>.` (target 40-80 chars). Descriptions count against `skillListingBudgetFraction` (~1% context budget) and get truncated if too long, breaking auto-routing. Only use a richer description when the skill genuinely auto-triggers from context (e.g. `design-tokens` on THEME backlog status).
- **Pipeline handoff**: skills that touch shared state declare `reads:` / `writes:` in frontmatter — see `shared/DEVINFO.md` for namespaces. Validate with `python3 scripts/check-handoff.py`.
- **Language**: skill/agent files in English (hard rule). Runtime output: from `CLAUDE.md § User Preferences → Language:`. See `skills/shared/LANGUAGE.md`.
- **Phases**: PHASE 0 = pre-flight validation → execution → last phase = report (ASCII table)
- **Lazy reference loading**: SKILL.md is a workflow skeleton. Blocks ≥30 lines that are conditionally executed (branch fires only-when-X), static templates/agent-prompts, or end-of-flow phases go into `references/{descriptive-name}.md`. Replace inline with a `> **Todo**: Read '.claude/skills/{skill}/references/{file}.md'` transition marker. Token efficiency: the reference file is only loaded in sessions where that phase actually fires. Canonical pattern: `skills/shared/SKILL-PATTERNS.md § Lazy Reference Loading`.
- **AskUserQuestion**: first option = recommended, multiSelect default true
- **Shared infra** (`skills/shared/*`): read-only single source of truth — reference, don't duplicate

## Task Tracking

Multi-phase skills with 5+ phases use the `TaskCreate`/`TaskUpdate` pattern for compaction-resilience. **Do apply to**: build, verify, refactor, debug, optimize, multi-stage setup. **Don't apply to**: short CLI utilities, thinking skills, CRUD skills.

Full pattern: see `skills/shared/SKILL-PATTERNS.md` § Task Tracking.

## Agent Conventions

- Frontmatter: name, description, model (`sonnet` default), color
- Run via `Task` tool in isolated context — keep output compact
- Only use where agents provide real value: scale-parallelism (OWASP scanners), independent reasoning (fix strategies), context-isolation for large volumes (refactor Explore)
- Most skills do analysis inline — agents only for the exceptions above

## Pipelines

**Dev**: `project-seed` → [`project-brainstorm`] → [`project-critique`] → `project-backlog` → `define` → `build` → `verify` → [`refactor`] (+ `debug` everywhere)
**Game**: `project-seed` → `project-backlog` → `define` → `build` → `verify` → [`refactor`] (+ `debug` everywhere, Godot 4.x / GUT)
**Design**: `design-create` (design/build/convert — incl. sketch/wireframe/Figma/Canva → high-fi code) → `design-content` (fill copy) → `design-check` — or all-in-one via `design-ship` (auto-mode: build→content→check, Build lane / web only; dev-track counterpart: `dev-ship`)
**Marketing**: `marketing-research` → `marketing-content` → `marketing-screenshots`

State handoff between skills via `.project/session/devinfo.json` (schema: `shared/DEVINFO.md`).

## Key Patterns

- **`.project/`**: all runtime artifacts (gitignored) — wireframes, config, session, screenshots, previews (`.project/previews/` = auto-opening HTML previews from dev-define/design-tokens/design-create via `shared/HTML-PRESENT.md`)
- **`.project/project.json`**: central project dashboard (seed, design, theme, stack, endpoints, entities — `schemaVersion: 2`). Runtime context (architecture, context, learnings) lives in `project-context.json`; features in `backlog.json`. Schema: `shared/DASHBOARD.md`. Per-project CLAUDE.md references this for runtime context.
- **Format-on-save**: hook runs Prettier (web) or gdformat (GDScript) after every Write/Edit
- **Backlog**: `.project/backlog.json` (data store; board UI rendered by the server) with status TODO (To define) → DEFINED (To build) → DOING (To verify) → DONE (To refactor) → shipped (archived to `.project/archive/backlog-archive.json`)
- **Build skills**: auto-commit, auto-sync `project.json` context after completion
- **Global vs local**: `~/.claude/{agents,hooks,skills,scripts}/` are whole-directory symlinks to the claude-config repo. Claude Code merges this global set with `<project>/.claude/`, where global is always visible. Per-project filtering of skills/agents therefore doesn't work — that's why there are no profiles; everything is always available.

## Bootstrap + .gitignore Philosophy

**Per-developer, not per-project**: `CLAUDE.md`, `.claude/`, and `.project/` are always gitignored. They belong to the developer, not the repo.

**Bootstrap** (once per machine, via `/core-bootstrap`):

- `~/.claude/CLAUDE.md` ← `local/CLAUDE.md.base` (behaviour, communication, language policy, command rules, project setup, context fallback, skill routing)
- `~/.claude/settings.json` ← `local/settings.json.template` (hooks, autoMemoryEnabled, statusLine, …)
- `~/.claude/keybindings.json` ← `local/keybindings.json`
- `~/.claude/statusline-command.cjs` ← `local/statusline-command.cjs`

Idempotent — skip if file already exists. No junction needed: `~/.claude/CLAUDE.md` is user-owned.

**Auto Memory**: deliberately disabled (`autoMemoryEnabled: false`). The existing pull-based learnings system (`.project/project-context.json#learnings[]` via `LEARNINGS-LOAD.md`) has better token efficiency through explicit scope selection (`component` / `architectural` / `pitfall-prefix`).

**Cross-project memory** (`~/.claude/memory/MEMORY.md`) has been removed — overlap with learnings without added value.

**Bootstrap skill**: use `/core-bootstrap` for first machine init (once). Use `/core-setup` for project-internal setup — never `/init` (built-in skips thin-template + gitignore flow).

## Rules for Changes

- Follow existing conventions — check a comparable skill before creating a new one
- Don't modify shared files without considering the impact on all skills
- New skills: copy frontmatter structure from an existing skill in the same category
- Test by actually running the skill
- Dev/game pipeline sync: for structural changes to dev-pipeline skills (dev-define, dev-build, dev-verify, dev-debug, dev-refactor), check whether the game-pipeline counterpart (game-\*) needs the same change. Domain-specific content (Godot vs web, GUT vs browser) does not need to be synced.
- Before tagging a release: run `python3 scripts/check-handoff.py`, `python3 scripts/check-dashboard-writers.py`, `python3 scripts/check-no-project-commit.py`, and `bash scripts/tests/run.sh` — all must exit 0. (`run.sh` is bash; on Windows run via WSL.)
- New skills forecasted >500 lines: apply lazy-reference-loading before committing — see `skills/shared/SKILL-PATTERNS.md § Lazy Reference Loading`.
