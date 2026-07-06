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

**Phase tracking** — first action of the skill: call `TaskCreate` with these 13 items (status `pending`), then use `TaskUpdate` to set each phase `in_progress` at the start and `completed` at the end. During context compaction the task list remains visible — no risk of forgotten phases.

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
11. Phase 7d: Code Conventions
12. Phase 8: Commit
13. Phase 9: Summary

## Phase 1: Detect & Configure

> **Todo**: call `TaskCreate` with the 12 phase items (see above). Mark Phase 1 → `in_progress` via `TaskUpdate`.

1. **Language selection** — AskUserQuestion (single-select):
   - Options: English, Nederlands, Deutsch, Français, Español
   - Store as `LANG_CHOICE` for Phase 6 (CLAUDE.md `## User Preferences`)

1b. **Explanation Level** — AskUserQuestion (single-select):

```yaml
header: "Explanation Level"
question: "How should Claude calibrate jargon and explanation depth for this project?"
options:
  - label: "Same as global (Recommended)"
    description: "Inherit from ~/.claude/CLAUDE.md — no project override written."
  - label: "Intermediate"
    description: "Standard. Jargon ok, no extra scaffolding."
  - label: "Beginner"
    description: "Every non-trivial term explained. Analogies always used. Good for stacks you're learning."
  - label: "Novice"
    description: "Framework-specific jargon explained. Analogies when helpful."
  - label: "Expert"
    description: "Compact. Assumes full stack familiarity."
multiSelect: false
```

Store as `EXPLANATION_CHOICE`. If "Same as global" → `EXPLANATION_CHOICE=skip` (nothing written to project CLAUDE.md; global default inherited).

2. **MCP servers** — Check installed via `claude mcp list`. Install missing (user scope):

   ```bash
   # context7 (skip if already listed; ask if user has API key for higher rate limits)
   claude mcp add context7 -- npx -y @upstash/context7-mcp@latest
   ```

   **Figma MCP (optional)** — defaults to "No"; only worth asking when Figma involvement is already evident (the project type isn't known yet at Phase 1, so don't force it). Ask via AskUserQuestion if the project involves Figma designs:

   ```yaml
   header: "Figma MCP"
   question: "Will this project use Figma designs (e.g. Figma → code work)?"
   options:
     - label: "No (Recommended)", description: "Skip Figma MCP — keep context window lean"
     - label: "Yes, add Figma MCP", description: "Install Figma MCP server for design data queries"
   multiSelect: false
   ```

   If "Yes": print install instructions:

   ```
   To install Figma MCP, run:
     claude mcp add --transport sse figma https://mcp.figma.com/mcp

   After installation, re-open this session so the MCP tools load.
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

   **On "Use existing"**: store `seed.name` and `seed.pitch` as `PROJECT_NAME` / `PROJECT_PITCH`. Read `.project/project-seed.md` fully into `SEED_CONTEXT`. Skip steps 1 and 2. Go directly to step 3 (Project type).

   **On "Supplement"**: show the first 200 chars of `project-seed.md` as a context block, ask for an additional description (free-form), append in-memory to `PROJECT_PITCH` and `SEED_CONTEXT`. Skip step 2 (name retained from seed).

   **On "Start over"**: continue normally with steps 1 and 2. `SEED_CONTEXT` remains empty.

   **No concept present**: continue normally with step 1. `SEED_CONTEXT` remains empty.

   **`SEED_CONTEXT` as stack context** — for every selection-style question that follows (Project type, Tech stack, Suggestions per category): actively use `SEED_CONTEXT`:
   - Back up `→ Claude recommends:` with a concept-relevant reason ("Next.js — SSR for the SEO mentioned in the concept").
   - Tailor suggestions to the domain from the concept.
   - No extra disk read needed — `SEED_CONTEXT` is already in context.

0.5. **Project mode** — If `project.json#team.mode` is already set (e.g. project-add created the project directory), use it and skip this question — show `Project mode: {mode} (from project-add)`. Otherwise AskUserQuestion (single-select). Ask this early so downstream questions (tech stack suggestions, tracker prompts, commit convention defaults) can use the answer:

```yaml
header: "Project mode"
question: "Is this a solo or team project?"
options:
  - label: "Solo (Recommended)"
    description: "Only you commit here. Enables local-only flow — no PR offers, no team-* skill gating."
  - label: "Team"
    description: "Multiple contributors. Enables /team-* skills, automatic PR offer after dev-ship's verify and refactor phases, and team settings in backlog/dashboard."
multiSelect: false
```

Store answer as `TEAM_MODE` (`"solo"` or `"team"`). Written to `project.json#team.mode` in Phase 7b.

1. **Project description** — Show this block to the user and wait for a response:

   ```
   ---

   ### ▸ Question — Project description

   Briefly describe what your project does and who it is for.

   → Tip: 1-3 sentences is enough — you can expand later via /project-seed.

   ---
   ```

2. **Project name** — If `project.json#seed.name` is already set (e.g. project-add created the project directory), use it and skip this question — show `Project name: {seed.name} (from project-add)`. Otherwise suggest 2-3 kebab-case names based on the Phase 2.1 description and show this block:

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

6. **Web standards** — single-select questions. **Ask each as a separate AskUserQuestion call — never combined in one message.**
   - Data fetching strategy (any stack with an external API/backend — incl. Mobile): plain fetch, SWR, TanStack Query
     **Skip** if the project has no external data sources (e.g. localStorage-only, in-memory state, static content)
   - Accessibility (web only — skip for game/CLI/desktop/mobile): WCAG 2.1 AA, WCAG 2.1 A, Minimal
   - Responsive (web only — skip for game/CLI/desktop/mobile): Mobile-first, Desktop-first, Fixed width

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

> **Todo**: mark Phase 4 → `completed`, Phase 5 → `in_progress`. Read `references/phase-configure-claude.md` and follow it (documentation generators, permissions, directory exclusions, formatter hook).

---

## Phase 5b: Auto Dev Tools

> **Todo**: mark Phase 5 → `completed`, Phase 5b → `in_progress`.
>
> **Skip-guard**: both auto-dev-tools (inspect-overlay, playwright) require Phase 2.3 project type ∈ {Web Frontend, Fullstack}. If the project type is anything else (Mobile, Game, Desktop, CLI, Web Backend), skip this phase entirely — do NOT load the reference — and mark Phase 5b `completed`. `dev_tools_installed[]` stays empty.
>
> Otherwise Read `references/phase-auto-dev-tools.md` and follow it with:
>
> - variant: greenfield-auto
> - stack-source: Phase 2.3 project type + Phase 2.4 stack choice
> - track-to: dev_tools_installed[] (consumed by Phase 9 Summary)

---

## Phase 6: Update CLAUDE.md

> **Todo**: mark Phase 5b → `completed`, Phase 6 → `in_progress`.

Update `## User Preferences` with language and explanation level from Phase 1.

Generate CLAUDE.md following the **canonical structure** from `references/claude-md-sections.md`. This is the single source of truth — all pipeline skills (dev-ship's build-phase auto-sync) expect these section names.

**Section rules:**

- `## User Preferences`: Always. Language from Phase 1. Explanation Level from Phase 1b — omit the line if `EXPLANATION_CHOICE=skip`.
- `## Frontend Edit Rules`: Only for frontend/fullstack projects (keep the marker block from `CLAUDE.base.md`).
- `## Commands`: Always. Auto-detect from package manifest scripts.
- `## Project` / `### Stack`: Always. Pipeline skills read `### Stack` for stack detection.
- `### Standards`: Only for web projects.
- `### Testing`: Only if testing frameworks configured.
- `## Project Context`: Always. Reference to `.project/project.json` (stack, features, endpoints) and `.project/project-context.json` (structure, routing, patterns, architecture).
- `### Stack` subcategories are flexible — add what's relevant, omit what's not.

**Target size: ~30-50 lines.** No generic skill-runtime sections (Language Policy, Communication Style, Smart Suggestions, Command Execution Rules) — those live in `~/.claude/CLAUDE.md`.

**`.gitignore` check** (idempotent — append only if missing):

If the run arrived via the project-add handoff (Phase 0 setup-pending marker), project-add has already written wholesale Claude ignores (`.claude/`, `.project/`, `CLAUDE.md`, `AGENTS.md`) — the `grep` guards below will find them and skip. The appends matter for the standalone path (core-setup run without project-add), where these entries are genuinely absent.

```bash
# Ensure Claude tooling & local project data are gitignored (never committed to the project repo)
grep -qxF 'CLAUDE.md' .gitignore 2>/dev/null || echo 'CLAUDE.md' >> .gitignore
grep -qxF 'AGENTS.md' .gitignore 2>/dev/null || echo 'AGENTS.md' >> .gitignore
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

> **Todo**: mark Phase 7 → `completed`, Phase 7b → `in_progress`. Read `references/phase-dashboard-init.md` and follow it (creates project.json, backlog scaffold, project-context.json; ensures `.project/` is gitignored and untracked).

---

## Phase 7c: Setup Task Seeding (web or game projects)

> **Todo**: mark Phase 7b → `completed`, Phase 7c → `in_progress`.
> Only if `stack.framework` is a frontend framework (React, Vue, Svelte, Next.js, Nuxt, Astro, Remix, SolidJS) **or** a game framework (Godot / `project.godot` present) → Read `references/phase-setup-task-seeding.md` and follow it with:
>
> - variant: greenfield
> - auto-execute: true (chain to /design-tokens, report under "Next skill running")
>
> Otherwise skip to Phase 8.

---

## Phase 7d: Code Conventions

> **Todo**: mark Phase 7c → `completed`, Phase 7d → `in_progress`. Read `references/phase-conventions.md` and follow it with `variant: greenfield` (skip-guard on existing `.project/conventions.md`, single AskUserQuestion: none / paste guide / mini-interview).

---

## Phase 8: Commit (optional)

> **Todo**: mark Phase 7d → `completed`, Phase 8 → `in_progress`.

AskUserQuestion (single-select): Commit setup files now, or skip.

If committing: stage relevant files, create commit with conventional commit format (e.g., `build: scaffold [stack] project`).

---

## Phase 9: Summary

> **Todo**: mark Phase 8 → `completed`, Phase 9 → `in_progress`. Read `references/phase-greenfield-summary.md` and follow it (summary, dev-tools note, smart backlog prompt, next steps, setup-pending cleanup).

> **Todo**: mark Phase 9 → `completed`.
