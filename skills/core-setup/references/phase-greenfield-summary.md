# Summary (greenfield Phase 9)

**Inputs**: project name + dev/test/build commands (Phase 2-4), `dev_tools_installed[]` (Phase 5b), Phase 2.3 project type, `.project/backlog.json` state (Phase 7b/7c).

Show a concise summary of what was set up:

```
SETUP COMPLETE: {project name}

Start developing:
  {dev command}           → {what it starts, e.g. "frontend on :5173 + backend on :3001"}

Useful commands:
  {test command}          → run tests
  {build command}         → production build
```

**If Phase 5b installed inspect-overlay**, add after the code block:

```
Dev tools:
  Inspect overlay         → Cmd+Shift+X (Mac) / Ctrl+Shift+X (Win/Linux) to toggle
```

For Next.js Babel full mode, also add: `Note: Turbopack disabled (Babel full mode for exact file:line refs).`

## Smart Backlog Server Prompt (conditional)

**Step 1 — Detect todos:** Read `.project/backlog.json` (if it exists) and parse `data.features`. Count items with status `TODO` or `DEFINED`.

| Condition                            | Action                                 |
| ------------------------------------ | -------------------------------------- |
| No `backlog.json` or 0 todos         | Skip backlog prompt — no modal         |
| ≥1 todo (e.g. `setup-design-tokens`) | Show AskUserQuestion modal (see below) |

**Step 2 — Modal (only when ≥1 todo):**

AskUserQuestion (single-select):

- "Start backlog server (Recommended)" — `/project-backlog start` on `http://localhost:9876`. Show `{N} todo(s) in backlog: {list of first 3 names}`.
- "Skip" — start manually later with `/project-backlog`

Store result as `backlog_started` (true/false) for smart next steps.

## Smart Next Steps

Tailor suggestions based on project type (Phase 2.3) **and** `backlog_started`. Order:

**If `backlog_started = true`:**

```
View your backlog:         http://localhost:9876
Work on first todo:        {top todo name} → {corresponding skill}
```

Then only relevant follow-up skills (no repetition of todos already in the backlog):

- Web/Backend/Fullstack/Mobile/Desktop/CLI: `/dev-define [new feature]` → `/dev-build [feature]`
- Game: `/game-define [feature]` → `/game-build [feature]`
- Expand concept: `/project-seed`, `/project-brainstorm`

**If `backlog_started = false` or no todos in backlog:**

**1. Explore concept (optional, recommended for greenfield):**

- `/project-seed` — build out project concept with guided questions
- `/project-brainstorm` — expand ideas via creative techniques
- `/project-research` — research stack/market/competitors as input for planning

**2. Plan — set up feature backlog:**

- All stacks (web, game, CLI, etc.): `/project-backlog` — convert ideas into a prioritized feature backlog (auto-detects stack)

**3. Define + build first feature:**

- Web/Backend/etc: `/dev-define [feature]` → `/dev-build [feature]`
- Game: `/game-define [feature]` → `/game-build [feature]`

**If there are todos but backlog not started:** add at the top:

```
Tip: {N} todo(s) ready in .project/backlog.json.
Start later with /project-backlog to check them off visually.
```

**Additionally for frontend/fullstack** (skip for game/CLI/desktop/backend-only):

- `/core-setup [module]` — add libraries (Tailwind, Vitest, Playwright, Biome, etc.)
- `/frontend-design [feature]` — visual design spec for a feature

## Open the project

End with one line (no modal):

```
Open: code {projects_root}/{name}  (or the shell alias if project-add created one)
```

Never emit a hardcoded absolute path — always use the `{projects_root}` variable.
Read `{projects_root}` from `.claude/paths.local.yaml` (key: `paths.projects_root`) or fall back to `$HOME/projects` (macOS/Linux) / `C:\Projects` (Windows).

## Cleanup

```bash
rm -f .project/session/setup-pending.json
```
