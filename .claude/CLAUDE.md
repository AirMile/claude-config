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
skills/           44 skills in 8 categories
  shared/         RULES.md, PATTERNS.md, PLAYWRIGHT.md, VALIDATION.md, DEVINFO.md
  {cat}-{verb}/   Skill directories (each with SKILL.md)
agents/           23 sub-agent definitions (.md with YAML frontmatter)
hooks/            format-on-save.cjs, prompt-timer.cjs, security-reminder.py
local/            Portable configs for ~/.claude/ (templates, not linked)
CLAUDE.base.md    Template for per-project CLAUDE.md generation
```

## Skill Conventions

- **Naming**: `{category}-{verb}` — lowercase, hyphen. Categories: core, content, dev, design, game, marketing, project, team
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
- Only use where agents provide real value: scale-parallelism (OWASP scanners), independent reasoning (fix strategies), context-isolation for large volumes (refactor Explore), context-inheritance with output-isolation (forks — `shared/SKILL-PATTERNS.md § Fork Delegation`)
- Most skills do analysis inline — agents only for the exceptions above

## Pipelines

**Dev**: `project-seed` → [`project-brainstorm`] → [`project-critique`] → `project-plan` → `dev-ship` (define→build→auto-verify as one auto-mode flow) hands off to `dev-manual` (manual verify→debug→refactor→ship) when manual items remain — both read the same in-ship park-first debug rounds (no standalone debug skill); small 1-3-file changes skip the pipeline via `dev-tweak` (gate/guard: `shared/TWEAK-DISCIPLINE.md`; can also pick up a `TWEAK` backlog card a ship's verify/manual round offloaded); element-pinned frontend edits from a pasted inspect-overlay ref via `dev-inspect` (theme-aware edit + screenshot-verify, no commit — offers `/core-commit`)
**Game**: `project-seed` → `project-plan` → `game-ship` (runs define→build→GUT-verify→playtest→refactor as one auto-mode flow) (+ `game-debug` everywhere, Godot 4.x / GUT); small changes via `game-tweak` (same TWEAK-DISCIPLINE fast path)
**Design**: `design-convert` (spec management, visual→code convert — sketch/wireframe/Figma/Canva/URL → high-fi code — and game `.tscn` codegen) & `design-content` (fill copy) feed `design-ship` — auto-mode build→content→check as one flow (Build lane / web); `design-tokens` for tokens/motion packs; dev-track counterpart: `dev-ship`
**Marketing**: `marketing-research` → `marketing-content` → `marketing-screenshots`

State handoff between skills via `.project/session/devinfo.json` (schema: `shared/DEVINFO.md`).

## Key Patterns

- **`.project/`**: all runtime artifacts (gitignored) — wireframes, config, session, screenshots, previews (`.project/previews/` = auto-opening HTML previews from dev-ship's define phase/design-tokens/design-convert via `shared/HTML-PRESENT.md`)
- **`.project/project.json`**: central project dashboard (seed, design, theme, stack, endpoints, entities — `schemaVersion: 2`). Runtime context (architecture, context, learnings) lives in `project-context.json`; features in `backlog.json`. Schema: `shared/DASHBOARD.md`. Per-project CLAUDE.md references this for runtime context.
- **Format-on-save**: hook runs Prettier (web) or gdformat (GDScript) after every Write/Edit
- **Backlog**: `.project/backlog.json` (data store; board UI rendered by the server) with status TODO (To define) → DEFINED (To build) → DOING (To verify) → DONE (To refactor) → shipped (archived to `.project/archive/backlog-archive.json`)
- **Installable board**: `/project-app` opens the board as a chromeless app window by default (no browser tab, no install step). `serve-backlog.js` also serves a PWA manifest + service worker (`/manifest.webmanifest`, `/sw.js`, scope `/`) so the whole origin (index, dashboards, backlogs, reviews) can additionally be installed from the browser for a permanent Dock/Launchpad/Start icon. `/project-app install-app` (macOS + Windows) installs a background process (LaunchAgent / Scheduled Task) that keeps the server always warm, so the installed PWA is the single app icon — no separate on-demand-launcher `.app` (that model needed two icons on macOS; superseded, see `skills/project-app/references/install-app-{macos,windows}.md`). Windows variant unverified on real hardware. This is about the _app window/icon_, not `.project/` content sync — that's the state branch below.
- **Build skills**: auto-commit, auto-sync `project.json` context after completion
- **State branch**: the durable `.project/` subset (backlog, dashboard, seed, learnings, archive, feature dossiers) syncs across your own devices via the orphan branch `claude/state` (`shared/STATE-SYNC.md`, skill `/project-sync`) — working branches never track `.project/`. Auto-pushes after ship/finalize; pull-check in `/core-pull`; restored on `/project-add` clone.
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
- Dev/game pipeline sync: for structural changes to `dev-ship`/`dev-manual` (their define/build/verify/refactor phases, including the shared in-ship debug rounds `debug-round.md`/`debug-round-heavy.md`), check whether the game-pipeline counterpart (`game-ship`, `game-debug`) needs the same change. Note the asymmetry: dev's debug ladder is folded into dev-ship/dev-manual (both read the same reference files — no separately-maintained debug skill), while game's remains the standalone `game-debug` skill — don't force parity there, only sync the shared debug _discipline_ (DEBUG-LADDER.md, DEBUG-TOOLBOX.md). Domain-specific content (Godot vs web, GUT vs browser) does not need to be synced.
- Before tagging a release: run `python3 scripts/check-handoff.py`, `python3 scripts/check-dashboard-writers.py`, `python3 scripts/check-no-project-commit.py`, `python3 scripts/check-backlog-reads.py`, `python3 scripts/check-task-markers.py`, `node scripts/check-context-load.js`, and `bash scripts/tests/run.sh` — all must exit 0. (`run.sh` is bash; on Windows run via WSL.)
- New skills forecasted >500 lines: apply lazy-reference-loading before committing — see `skills/shared/SKILL-PATTERNS.md § Lazy Reference Loading`.
