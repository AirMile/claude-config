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
  Inspect overlay         → Cmd+. (Mac) / Ctrl+. (Win/Linux) to toggle; paste a ref → /dev-inspect
```

For Next.js Babel full mode, also add: `Note: Turbopack disabled (Babel full mode for exact file:line refs).`

## Concept Prompt (conditional)

core-setup captures only a one-line `seed.pitch` — it never authors the concept
document. `/project-seed` is the sole author. Prompt for it before backlog work.

**Detect:** does `.project/project-seed.md` exist with > 50 chars?

| Condition                                     | Action                          |
| --------------------------------------------- | ------------------------------- |
| Seed file exists (>50 chars)                  | Skip — concept already captured |
| No seed file (only a one-line pitch captured) | Show AskUserQuestion below      |

AskUserQuestion (single-select):

- header: "Concept"
- question: "core-setup captured a one-line pitch but not a full concept yet. Build it now?"
- "Build concept now (Recommended)" — runs `/project-seed` to develop the concept via guided questions, before backlog/feature work.
- "Skip" — start later with `/project-seed`.

On "Build concept now": after the summary, chain to `/project-seed` and report under
"Next skill running". Store `concept_started` (true/false) — when true, Smart Next
Steps leads with the backlog/define flow instead of repeating `/project-seed`.

## Smart Backlog Server Prompt (conditional)

**Step 1 — Detect todos:** Read `.project/backlog.json` (if it exists) and parse `data.features`. Count items with status `TODO` or `DEFINED`.

| Condition                            | Action                                 |
| ------------------------------------ | -------------------------------------- |
| No `backlog.json` or 0 todos         | Skip backlog prompt — no modal         |
| ≥1 todo (e.g. `setup-design-tokens`) | Show AskUserQuestion modal (see below) |

**Step 2 — Modal (only when ≥1 todo):**

AskUserQuestion (single-select):

- "Start backlog server (Recommended)" — `/project-plan start` on `http://localhost:9876`. Show `{N} todo(s) in backlog: {list of first 3 names}`.
- "Skip" — start manually later with `/project-plan`

Store result as `backlog_started` (true/false) for smart next steps.

## Smart Next Steps

Tailor suggestions based on project type (Phase 2.3) **and** `backlog_started`. Order:

**If `backlog_started = true`:**

```
View your backlog:         http://localhost:9876/{name}
Work on first todo:        {top todo name} → {corresponding skill}
```

Then only relevant follow-up skills (no repetition of todos already in the backlog):

- Web/Backend/Fullstack/Mobile/Desktop/CLI: `/dev-ship [new feature]`
- Game: `/game-ship [feature]`
- Expand concept: `/project-seed`, `/project-seed brainstorm`

**If `backlog_started = false` or no todos in backlog:**

**1. Explore concept (optional, recommended for greenfield):**

- `/project-seed` — build out project concept with guided questions
- `/project-seed brainstorm` — expand ideas via creative techniques
- `/project-research` — research stack/market/competitors as input for planning

**2. Plan — set up feature backlog:**

- All stacks (web, game, CLI, etc.): `/project-plan` — convert ideas into a prioritized feature backlog (auto-detects stack)

**3. Define + build first feature:**

- Web/Backend/etc: `/dev-ship [feature]`
- Game: `/game-ship [feature]`

**If there are todos but backlog not started:** add at the top:

```
Tip: {N} todo(s) ready in .project/backlog.json.
Start later with /project-plan to check them off visually.
```

**Additionally for frontend/fullstack** (skip for game/CLI/desktop/backend-only):

- `/core-setup [module]` — add libraries (Tailwind, Vitest, Playwright, Biome, etc.)
- `/design-convert [feature]` — visual design spec for a feature

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
