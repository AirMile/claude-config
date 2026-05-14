# Greenfield Mode

Interactive wizard for new projects. User answers questions about stack and standards; skill generates all project files.

**CRITICAL: One question per response.** Never combine multiple questions in one message.

**Plain-text question format** — wrap every plain-text question in this visually distinct block so the user immediately sees that input is being requested. Do not apply to AskUserQuestion modals — those have their own UI.

```
---

### ▸ Question — {short title}

{Question text, optionally with numbered options on new lines}

→ Claude recommends: {advice + 1-sentence reason}

{input hint, e.g. "Which would you like to add? (e.g. `1,3` or `none`)"}

---
```

**Rules:**

- `→ Claude recommends:` line is required for selection-style questions (Project name, Tech stack, Suggestions). Skip only for free-form (Project description).
- `→ Tip:` line is optional for free-form questions for scope/context guidance. Not a recommendation, just a guardrail.
- Do not add to AskUserQuestion modals — those have their own "Let Claude decide" option.

Applies to: Project description, Project name, Tech stack, Suggestions (per category).

---

## Process

**Phase tracking** — first action of the skill: call `TaskCreate` with these 12 items (status `pending`), then use `TaskUpdate` to set each phase `in_progress` at the start and `completed` at the end. During context compaction the task list remains visible — no risk of forgotten phases.

1. Phase 1: Detect & Configure
2. Phase 2: Collect Project Info
3. Phase 3: Generate Project
4. Phase 4: Install & Verify
5. Phase 5: Configure Claude
6. Phase 5b: Auto Dev Tools
7. Phase 6: Update CLAUDE.md
8. Phase 7: Stack Research
9. Phase 7b: Dashboard Init
10. Phase 7c: Setup Task Seeding
11. Phase 8: Commit
12. Phase 9: Summary

## Phase 1: Detect & Configure

> **Todo**: call `TaskCreate` with the 12 phase items (see above). Mark Phase 1 → `in_progress` via `TaskUpdate`.

1. **Language selection** — AskUserQuestion (single-select):
   - Options: English, Nederlands, Deutsch, Français, Español
   - Store for Phase 6 (CLAUDE.md `## User Preferences`)

2. **MCP servers** — Check installed via `claude mcp list`. Install missing (user scope):

   ```bash
   # context7 (skip if already listed; ask if user has API key for higher rate limits)
   claude mcp add context7 -- npx -y @upstash/context7-mcp@latest
   ```

---

## Phase 2: Collect Project Info

> **Todo**: mark Phase 1 → `completed`, Phase 2 → `in_progress`.

Ask sequentially, one question per response:

0. **Concept preflight** — check if concept data already exists before asking anything:

   Read `SEED_CONTEXT` per `shared/SEED.md` Reader.

   **If `SEED_CONTEXT.present`:**

   Show AskUserQuestion (single-select):
   - header: "Concept"
   - question: "There is already a concept (from /project-seed or /project-add). How do you want to continue?"
   - options:
     - label: "Use existing concept (Recommended)" — description: "Skip Project description + Project name questions, read pitch/name from the existing files"
     - label: "Supplement with extra context" — description: "Show current concept, ask for a brief additional description to factor in"
     - label: "Start over" — description: "Ignore existing concept, ask both questions anyway (concept-md will not be overwritten later)"
   - multiSelect: false

   **On "Use existing"**: store `concept.name` and `concept.pitch` as `PROJECT_NAME` / `PROJECT_PITCH`. Read `.project/project-seed.md` fully into `SEED_CONTEXT`. Skip steps 1 and 2. Go directly to step 3 (Project type).

   **On "Supplement"**: show the first 200 chars of `project-seed.md` as a context block, ask for an additional description (free-form), append in-memory to `PROJECT_PITCH` and `SEED_CONTEXT`. Skip step 2 (name retained from concept).

   **On "Start over"**: continue normally with steps 1 and 2. `SEED_CONTEXT` remains empty.

   **No concept present**: continue normally with step 1. `SEED_CONTEXT` remains empty.

   **`SEED_CONTEXT` as stack context** — for every selection-style question that follows (Project type, Tech stack, Suggestions per category): actively use `SEED_CONTEXT`:
   - Back up `→ Claude recommends:` with a concept-relevant reason ("Next.js — SSR for the SEO mentioned in the concept").
   - Tailor suggestions to the domain from the concept.
   - No extra disk read needed — `SEED_CONTEXT` is already in context.

1. **Project description** — Show this block to the user and wait for a response:

   ```
   ---

   ### ▸ Question — Project description

   Briefly describe what your project does and who it is for.

   → Tip: 1-3 sentences is enough — you can expand later via /project-seed.

   ---
   ```

2. **Project name** — Suggest 2-3 kebab-case names based on the Phase 2.1 description and show this block:

   ```
   ---

   ### ▸ Question — Project name

   1. {suggestion-1}
   2. {suggestion-2}
   3. {suggestion-3}

   → Claude recommends: 1 — {brief reason}

   Choose a number or type your own.

   ---
   ```

3. **Project type** — AskUserQuestion (single-select):
   - Web Frontend, Web Backend, Fullstack, Game, Mobile, Desktop, CLI
4. **Tech stack** — Plain text numbered list (**single-select**: one primary stack/framework combination). Show relevant complete stacks based on project type in this block:

   ```
   ---

   ### ▸ Question — Tech stack

   1. {stack combination 1, e.g. "Tauri + React + TypeScript"} — {brief description}
   2. {stack combination 2} — {brief description}
   ...

   → Claude recommends: {number} — {1-sentence reason based on project type/description}

   Which would you like to use? (choose a number)

   ---
   ```

   **Important:** Tech stack is a choice between mutually exclusive stacks (you don't use both Tauri and Electron). Therefore single-select. Multi-select libraries come in the next question (Suggestions).

5. **Suggestions** — Plain text numbered list per category (multi-select via free-form parse). Show complementary libraries based on the chosen stack. Split per category if there are more than 7 options:
   - **Styling/UI**: Tailwind, shadcn/ui, CSS Modules, styled-components, etc.
   - **Testing + Utilities**: Vitest, Jest, Cypress, TypeScript, ESLint, Prettier, Zod, Husky, etc. (Do NOT offer Playwright — skills already run `npx playwright` directly; only via `/core-setup playwright` if the user explicitly wants their own E2E suite)
   - **State/Data** (only relevant for the stack): Zustand, Redux, TanStack Query, SWR, etc.
   - **Forms** (only for React/Vue/Svelte stack): react-hook-form + zod (tier-1, recommended), Formik, VeeValidate (Vue), Felte (Svelte)

   One question per category at a time in this format:

   ```
   ---

   ### ▸ Question — Suggestions: {category}

   1. {library 1}
   2. {library 2}
   ...

   → Claude recommends: {numbers} — {1-sentence reason based on stack/project context}

   Which would you like to add? (e.g. `1,3` or `none`)

   ---
   ```

6. **Web standards** (skip for game/CLI/desktop) — Three single-select questions:
   - Data fetching strategy (if React/Vue + external API/backend): plain fetch, SWR, TanStack Query
     **Skip** if the project has no external data sources (e.g. localStorage-only, in-memory state, static content)
   - Accessibility: WCAG 2.1 AA, WCAG 2.1 A, Minimal
   - Responsive: Mobile-first, Desktop-first, Fixed width

7. **Project mode** — AskUserQuestion (single-select):

   ```yaml
   header: "Project mode"
   question: "Is this a solo or team project?"
   options:
     - label: "Solo (Recommended)"
       description: "Only you commit here. Enables local-only flow — no PR offers, no team-* skill gating."
     - label: "Team"
       description: "Multiple contributors. Enables /team-* skills, automatic PR offer after /dev-verify and /dev-refactor, and team settings in backlog/dashboard."
   multiSelect: false
   ```

   Store answer as `TEAM_MODE` (`"solo"` or `"team"`). Used in Phase 7b to write `team.mode`.

---

## CHECKPOINT: Interview Summary

Show an ASCII tree of all choices made — only what the user chose for stack, libraries, state/forms, web standards. **Do not** show future phases (the TaskCreate todo list already does that). Example:

```
streaky (Web Frontend)
├── Stack:        React + Vite · TypeScript · Tailwind
├── Libraries:    shadcn/ui · Vitest · Biome
├── State/Forms:  Zustand · react-hook-form + zod
└── Standards:    WCAG 2.1 AA · Mobile-first · TanStack Query
```

Ask via AskUserQuestion: "Is this overview correct? Would you like to change anything?"

- "Continue with setup (Recommended)" — proceed to Phase 3
- "Adjust" — return to the relevant question

## Phase 3: Generate Project

> **Todo**: mark Phase 2 → `completed`, Phase 3 → `in_progress`.

1. **Fetch latest versions** via `npm view` / `pip show` / `cargo search` or equivalent for the stack's package manager.

2. **Generate project files** appropriate for the chosen stack. Include package manifest, framework config, linting/formatting config, `.env.example` (only relevant vars), and `.gitignore`.

3. **Optional: Git init** — Check if `.git` already exists. If not, AskUserQuestion (single-select):
   - Full (init + .gitignore + commit), Only .gitignore, Skip

4. **Token bootstrap** (only for frontend stacks): execute the Bootstrap Procedure from `shared/TOKENS.md`. Skips automatically if no Tailwind found, `tokens.css` already exists, or no CSS entry detectable.

---

## Phase 4: Install & Verify

> **Todo**: mark Phase 3 → `completed`, Phase 4 → `in_progress`.

Install dependencies and run build to verify setup compiles. Non-blocking: continue setup even if install/build fails.

---

## Phase 5: Configure Claude

> **Todo**: mark Phase 4 → `completed`, Phase 5 → `in_progress`.

### Documentation Generators

Claude picks defaults based on Phase 2.3 project type + Phase 2.4 stack. No user confirmation — write silently into CLAUDE.md. Add stack-specific extras if obvious from chosen stack.

| Project type | Default generators                                                   |
| ------------ | -------------------------------------------------------------------- |
| Web Frontend | components, routes, state, design-tokens                             |
| Web Backend  | api, routes, middleware, auth-flow (auth-flow only if auth in stack) |
| Fullstack    | components, routes, state, api, middleware                           |
| Game         | scenes, game-classes, state-machines                                 |
| Mobile       | components, routes, state                                            |
| Desktop      | components, routes, state                                            |
| CLI          | (none — omit section from CLAUDE.md)                                 |

### Permissions

AskUserQuestion (single-select) — permission preset:

- **Full access (Recommended)**: read + edit + create files, bash (npm/npx/node), git, tests
- **Restrictive**: read-only files, tests only

For custom settings: the user can edit `.claude/settings.local.json` directly after setup (template below).

Then plain text — directory exclusions:

```
---

### ▸ Question — Directory exclusions

Which directories do you want to exclude from Claude's write access?

1. node_modules
2. vendor
3. dist
4. build
5. .env

→ Claude recommends: {numbers} — {1-sentence reason based on stack/project type}

Which would you like to exclude? (e.g. `1,3` or `none`)

---
```

Write `.claude/settings.local.json` with `permissions.allow` and `permissions.deny` arrays:

```json
{
  "permissions": {
    "allow": ["Read *", "Edit *", "Write *", "Bash(npm *)", "Bash(npx *)"],
    "deny": ["Edit node_modules/**", "Write dist/**"]
  }
}
```

### Code Formatter (PostToolUse Hook)

Auto-format after every Write/Edit.

**Step 1 — Check existing hook:**

```bash
ls -la .claude/hooks/format-on-save.cjs 2>/dev/null
```

If the file already exists (via symlink to global claude-config or project-local): read it and check if it supports the project stack (e.g. Biome via `biome.json` detection). If yes, skip creating — only reference in `settings.local.json`.

**Step 2 — Only create if no existing hook:**

Create `.claude/hooks/format-on-save.cjs` with:

- Node.js script that reads stdin JSON, extracts file path, checks extension, calls formatter
- Use `.cjs` to avoid ES Module issues
- IMPORTANT: do NOT write to `.claude/hooks/` if that directory is a symlink to a shared repo (check via `readlink .claude/hooks`)

Formatter selection per stack:

| Stack                                   | Formatter     | Command                   |
| --------------------------------------- | ------------- | ------------------------- |
| JS/TS (React, Vue, Next.js, Node, etc.) | Prettier      | `npx prettier --write`    |
| PHP/Laravel                             | Pint          | `./vendor/bin/pint`       |
| Python                                  | Black         | `black`                   |
| Rust                                    | rustfmt       | `rustfmt`                 |
| Go                                      | gofmt         | `gofmt -w`                |
| C#/.NET                                 | dotnet format | `dotnet format --include` |
| Godot/GDScript                          | gdformat      | `gdformat`                |
| C/C++                                   | clang-format  | `clang-format -i`         |
| Dart/Flutter                            | dart format   | `dart format`             |

Add the hook to `settings.local.json` — in the same file as `permissions` (do not write separately):

```json
{
  "permissions": {
    "allow": ["..."],
    "deny": ["..."]
  },
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Write|Edit",
        "hooks": [
          {
            "type": "command",
            "command": "node .claude/hooks/format-on-save.cjs"
          }
        ]
      }
    ]
  }
}
```

---

## Phase 5b: Auto Dev Tools

> **Todo**: mark Phase 5 → `completed`, Phase 5b → `in_progress`.

Install dev tools that are framework-conditional and require no user input. No modal, no confirmation — auto-install on match, silent skip on mismatch.

### inspect-overlay

**Trigger:** `stack.framework` ∈ `{React+Vite, Next.js}`. Determine this from Phase 2.4 stack choice.

| Stack from Phase 2.4                                                             | Action                                                                 |
| -------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| React + Vite                                                                     | Install via `setup-guide.md#Setup — Vite`                              |
| Next.js                                                                          | Install via `setup-guide.md#Setup — Next.js` (Babel full mode default) |
| All others (incl. Vue, Svelte, Astro, Nuxt, game, CLI, backend, mobile, desktop) | Skip silently — no output                                              |

**Auto-mode assumptions** (no modals shown):

- **Vite path**: pin **`@vitejs/plugin-react@^5`** in `package.json` (NOT v6 — that uses OXC instead of Babel, causing the overlay to fall into degraded mode without file:line refs). Follow setup-guide `## Setup — Vite` → `### Plugin Selection` (auto, no modal) and then `### Install & Configure` steps 1-6.
- **Next.js path**: choose Babel full mode automatically. Follow setup-guide `### Babel Plugin (Full Mode)` accept path and `### Install` steps 1-6.

**Skip the "Restart dev server" step** — in greenfield no dev server is running yet.

**Track for Phase 9 Summary** whether the overlay was installed (yes/no + framework).

**No project.json update needed** — inspect-overlay is dev-only, no `stack.*` key.

---

## Phase 6: Update CLAUDE.md

> **Todo**: mark Phase 5b → `completed`, Phase 6 → `in_progress`.

Update `## User Preferences` with language from Phase 1.

Generate CLAUDE.md following the **canonical structure** from `references/claude-md-sections.md`. This is the single source of truth — all pipeline skills (dev-build auto-sync) expect these section names.

**Section rules:**

- `## User Preferences`: Always. Language from Phase 1.
- `## Frontend Edit Rules`: Only for frontend/fullstack projects (keep the marker block from `CLAUDE.base.md`).
- `## Commands`: Always. Auto-detect from package manifest scripts.
- `## Project` / `### Stack`: Always. Pipeline skills read `### Stack` for stack detection.
- `### Standards`: Only for web projects.
- `### Testing`: Only if testing frameworks configured.
- `## Project Context`: Always. Reference to `.project/project.json` (stack, features, endpoints) and `.project/project-context.json` (structure, routing, patterns, architecture).
- `### Stack` subcategories are flexible — add what's relevant, omit what's not.

**Target size: ~30-50 lines.** No generic skill-runtime sections (Language Policy, Communication Style, Smart Suggestions, Command Execution Rules) — those live in `~/.claude/CLAUDE.md`.

**`.gitignore` check** (idempotent — append only if missing):

```bash
# Ensure Claude-related files are gitignored
grep -qxF 'CLAUDE.md' .gitignore 2>/dev/null || echo 'CLAUDE.md' >> .gitignore
grep -qxF '.claude/' .gitignore 2>/dev/null || echo '.claude/' >> .gitignore
grep -qxF '.project/' .gitignore 2>/dev/null || echo '.project/' >> .gitignore
```

---

## Phase 7: Stack Research

> **Todo**: mark Phase 6 → `completed`, Phase 7 → `in_progress`.

Follow `references/stack-baseline-shared.md`.

**Trigger:** `stack.framework` is filled in and `.claude/research/stack-baseline.md` does not yet exist.

---

## Phase 7b: Dashboard Init

> **Todo**: mark Phase 7 → `completed`, Phase 7b → `in_progress`.

**Goal:** Create `.project/project.json` as the first dashboard file for this project. core-setup is the first skill to run — all later skills build on this.

See `{skills_root}/shared/DASHBOARD.md` for the full schema and merge strategies (found via `find ~/.claude -name DASHBOARD.md` or in the claude-config repo).

**Steps:**

1. First check if `.project/project.json` already exists (e.g. from an initial commit). If yes: read + merge instead of overwriting. If no: create with the full empty schema from `shared/DASHBOARD.md`
2. Fill `concept` section (preferred: markdown file, not inline):
   - `name`: project name — use existing `concept.name` if filled, otherwise from user answers; do NOT overwrite if already filled
   - `pitch`: 1-2 sentence summary — use existing `concept.pitch` if filled, otherwise from user answers; do NOT overwrite if already filled
   - `conceptFile`: `"project-seed.md"` — reference to the markdown file
   - `content`: empty string `""` — NEVER also fill inline alongside `conceptFile`
   - Concept-md handling:
     - **`.project/project-seed.md` exists with > 50 chars**: do NOT overwrite, do NOT append. The supplemental description from Phase 2 step 0 "Supplement" stays in-memory — only `/project-seed` writes to disk.
     - **Does not exist or < 50 chars**: create with `PROJECT_PITCH` (from Phase 2 answers or preflight) as plain markdown (what the project does, who for, core functionality). Does not need to be extensive — thinking/plan skills will expand this later.
3. Fill `team.mode` using the answer from Phase 2 step 7:
   - `"solo"` or `"team"` depending on `TEAM_MODE`.
   - If `.project/project.json` already existed and already has `team.mode` set → keep existing value (do NOT overwrite; user may have toggled via UI).
4. Fill `stack` section fully (OVERWRITE — core-setup is the first skill):
   - `framework`: from user answers (Phase 2 Q3/Q4)
   - `language`: from user answers (Phase 2 Q4)
   - `styling`: from user answers (Phase 2 Q4/Q5)
   - `db`: from user answers (Phase 2 Q4/Q5)
   - `auth`: from user answers (Phase 2 Q4/Q5)
   - `hosting`: from user answers (Phase 2 Q4/Q5)
   - `packages`: from generated package.json / project files
5. Write `.project/project.json`
   5b. Init backlog with concept flag (all project types):
   - If `.project/backlog.html` does not exist: copy `{skills_path}/shared/references/backlog-template.html` → `.project/backlog.html`
   - Read `backlog.html` → parse `<script id="backlog-data">` JSON
   - Set `data.flags = { "hasConcept": true, "conceptPath": ".project/project-seed.md" }`
   - Set `data.source = "/core-setup"` and `data.updated` to current date
   - Edit JSON block back (script tags intact)
   - This makes the `/project-backlog` button appear in the backlog dashboard once there is a concept but no features yet.
6. Create `.project/project-context.json` with `context` section (initial, updated by build/refactor skills):
   - `context.structure`: file tree of project (same format as previously in CLAUDE.md). Generate from actual file tree after Phase 3/4
   - `context.routing`: route patterns with arrow notation (only web projects with routing, otherwise empty array)
   - `context.patterns`: non-obvious patterns discovered during setup (path aliases, env config, etc.)
   - `context.updated`: current date
   - Write `.project/project-context.json`
7. Set skip-worktree on all `.project/` files so local changes do not disturb git status/pull:
   ```bash
   git add --sparse .project/
   git ls-files .project/ | xargs git update-index --skip-worktree
   ```
   Staging first is required — `update-index --skip-worktree` only works on files that are in the index.

**Output:**

```
DASHBOARD CREATED

Project: {name}
Stack: {framework} / {language}
Packages: {N} packages
```

---

## Phase 7c: Setup Task Seeding (frontend projects only)

> **Todo**: mark Phase 7b → `completed`, Phase 7c → `in_progress`.

**Goal:** Seed recommended setup tasks into the backlog so the user has a clear next path.

**Trigger:** Only if `stack.framework` is a frontend framework (React, Vue, Svelte, Next.js, Nuxt, Astro, Remix, SolidJS). Skip entirely for game, CLI, backend-only, or desktop.

**Step 1 — Compute conditions:**

- `needsTheme` = `project.json#theme` has no `colors` or is empty

Skip Phase 7c entirely if `needsTheme = false`.

**Step 2 — Seed features to `.project/backlog.html`:**

1. If `backlog.html` does not exist: copy `{skills_path}/shared/references/backlog-template.html` → `.project/backlog.html`, set `data.source = "/core-setup"`
2. Read `backlog.html` → parse JSON from `<script id="backlog-data">` block
3. Check `data.features.find(f => f.name === "setup-design-tokens")` — skip if already exists
4. Add if `needsTheme = true`:

```json
[
  {
    "name": "setup-design-tokens",
    "type": "THEME",
    "status": "TODO",
    "phase": "P1",
    "description": "Define color palette, typography scale, and spacing tokens via /frontend-tokens before UI work begins.",
    "source": "/core-setup",
    "dependencies": []
  }
]
```

5. Set `data.updated` to current date (`YYYY-MM-DD`)
6. Edit the JSON block back into `backlog.html` (script tags intact)

**Step 3 — Auto-execute:**

No prompt. Skill chaining is silent: after seeding `setup-design-tokens` exit core-setup and run `/frontend-tokens` directly. Report in Phase 9 Summary under "Next skill running".

---

## Phase 8: Commit (optional)

> **Todo**: mark Phase 7c → `completed`, Phase 8 → `in_progress`.

AskUserQuestion (single-select): Commit setup files now, or skip.

If committing: stage relevant files, create commit with conventional commit format (e.g., `build: scaffold [stack] project`).

---

## Phase 9: Summary

> **Todo**: mark Phase 8 → `completed`, Phase 9 → `in_progress`.

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

### Smart Backlog Server Prompt (conditional)

**Step 1 — Detect todos:** Read `.project/backlog.html` (if it exists) and parse `data.features`. Count items with status `TODO` or `DEFINED`.

| Condition                            | Action                                 |
| ------------------------------------ | -------------------------------------- |
| No `backlog.html` or 0 todos         | Skip backlog prompt — no modal         |
| ≥1 todo (e.g. `setup-design-tokens`) | Show AskUserQuestion modal (see below) |

**Step 2 — Modal (only when ≥1 todo):**

AskUserQuestion (single-select):

- "Start backlog server (Recommended)" — `/project-backlog start` on `http://localhost:9876`. Show `{N} todo(s) in backlog: {list of first 3 names}`.
- "Skip" — start manually later with `/project-backlog`

Store result as `backlog_started` (true/false) for smart next steps.

### Smart Next Steps

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
Tip: {N} todo(s) ready in .project/backlog.html.
Start later with /project-backlog to check them off visually.
```

**Additionally for frontend/fullstack** (skip for game/CLI/desktop/backend-only):

- `/core-setup [module]` — add libraries (Tailwind, Vitest, Playwright, Biome, etc.)
- `/frontend-design [feature]` — visual design spec for a feature

**Cleanup:**

```bash
rm -f .project/session/setup-pending.json
```

> **Todo**: mark Phase 9 → `completed`.
