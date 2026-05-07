# Greenfield Mode

Interactieve wizard voor nieuwe projecten. User beantwoordt vragen over stack en standards; skill genereert alle project files.

**CRITICAL: One question per response.** Never combine multiple questions in one message.

---

## Phase 1: Detect & Configure

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

Ask sequentially, one question per response:

1. **Project description** — AskUserQuestion with 2-3 example categories as options. User types their own via "Other".
2. **Project name** — AskUserQuestion (single-select):
   - "Generate name (Recommended)" — suggest 2-3 short, kebab-case names based on the description
   - "I'll type my own" — user provides via "Other"
3. **Project type** — AskUserQuestion (single-select):
   - Web Frontend, Web Backend, Fullstack, Game, Mobile, Desktop, CLI
4. **Tech stack** — AskUserQuestion (multi-select):
   - Offer relevant frameworks/tools based on project type
5. **Suggestions** — AskUserQuestion (multi-select):
   - Offer complementary libraries based on chosen stack
   - If more than 7 options (see "Modal Option Cap" in main SKILL.md), split per category:
     - **Styling/UI** — Tailwind, shadcn/ui, CSS Modules, styled-components, etc.
     - **Testing** — Vitest, Jest, Playwright, Cypress, etc.
     - **State/Data** — Zustand, Redux, TanStack Query, SWR, etc.
     - **Utilities** — TypeScript, ESLint, Prettier, Zod, Husky, etc.
6. **Web standards** (skip for game/CLI/desktop) — Three single-select questions:
   - Data fetching strategy (if React/Vue): plain fetch, SWR, TanStack Query
   - Accessibility: WCAG 2.1 AA, WCAG 2.1 A, Minimal
   - Responsive: Mobile-first, Desktop-first, Fixed width

---

## CHECKPOINT: Interview Samenvatting

Presenteer alle verzamelde informatie uit Phase 1-2 als gestructureerde tabel:

| Aspect        | Waarde                            |
| ------------- | --------------------------------- |
| Taal          | {gekozen taal}                    |
| Projectnaam   | {naam}                            |
| Type          | {project type}                    |
| Stack         | {gekozen frameworks/tools}        |
| Suggesties    | {complementaire libraries}        |
| Web standards | {data fetching, a11y, responsive} |

Vraag via AskUserQuestion: "Klopt dit overzicht? Wil je iets aanpassen?"

- "Ga door met setup (Recommended)" — door naar Phase 3
- "Aanpassen" — terug naar relevante vraag

Na bevestiging: toon een ASCII flowchart van de initialisatiepaden op basis van de gekozen stack (welke configs, welke pipeline skills, welke hooks worden geconfigureerd).

## Phase 3: Generate Project

1. **Fetch latest versions** via `npm view` / `pip show` / `cargo search` or equivalent for the stack's package manager.

2. **Generate project files** appropriate for the chosen stack. Include package manifest, framework config, linting/formatting config, `.env.example` (only relevant vars), and `.gitignore`.

3. **Optional: Git init** — Check if `.git` already exists. If not, AskUserQuestion (single-select):
   - Full (init + .gitignore + commit), Only .gitignore, Skip

---

## Phase 4: Install & Verify

Install dependencies and run build to verify setup compiles. Non-blocking: continue setup even if install/build fails.

---

## Phase 5: Configure Claude

### Documentation Generators

AskUserQuestion (multi-select) — show generators relevant to project type:

- **Web**: components, routes, state, design-tokens, api-calls
- **Backend**: api, components, erd, events, middleware, auth-flow, routes
- **Game**: scenes, game-classes, state-machines, behavior-trees, prefabs

### Permissions

AskUserQuestion (single-select) — permission preset:

- **Full access (Recommended)**: read + edit + create files, bash (npm/npx/node), git, tests
- **Restrictive**: read-only files, tests only
- **Custom**: follow-up questions per category

Then AskUserQuestion (multi-select) — directory exclusions:

- none, node_modules, vendor, dist, build, .env

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

Auto-format after every Write/Edit. Create `.claude/hooks/format-on-save.cjs`:

- Node.js script that reads stdin JSON, extracts file path, checks extension, runs formatter
- Use `.cjs` to avoid ES Module issues

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

Add hook to `settings.local.json`:

```json
{
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

## Phase 6: Update CLAUDE.md

Update `## User Preferences` with language from Phase 1.

Generate CLAUDE.md following the **canonical structure** from `references/claude-md-sections.md`. This is the single source of truth — all pipeline skills (dev-build auto-sync) expect these section names.

**Section rules:**

- `## Commands`: Always. Auto-detect from package manifest scripts
- `## Project` / `### Stack`: Always. Pipeline skills read `### Stack` for stack detection
- `### Standards`: Only for web projects
- `### Testing`: Only if testing frameworks configured
- `## Project Context`: Always. Reference to `.project/project.json` (stack, features, endpoints) and `.project/project-context.json` (structure, routing, patterns, architecture)
- `### Stack` subcategories are flexible — add what's relevant, omit what's not

---

## Phase 7: Stack Research

Generate `.claude/research/stack-baseline.md` — reusable framework conventions that avoid duplicate Context7 queries in other skills.

**Run as Explore agent** (`subagent_type="Explore"`) for context isolation — Context7 queries for multiple stack technologies produce substantial output that shouldn't stay in the main session.

1. For each major technology in the stack, query Context7 (`resolve-library-id` → `query-docs`)
2. Distill per technology: conventions (5-10), patterns (5-10), idioms (3-5), testing (3-5), pitfalls (3-5)
3. Write directly to `.claude/research/stack-baseline.md` — no script needed
4. Include Context7 library IDs table at the bottom for follow-up queries

**Game projects:** Also generate `.claude/research/architecture-baseline.md` with scene tree patterns, node types, signals, state machines.

---

## Phase 7b: Dashboard Init

**Goal:** Maak `.project/project.json` aan als het eerste dashboard bestand voor dit project. core-setup is de eerste skill die draait — alle latere skills bouwen hierop voort.

Zie `shared/DASHBOARD.md` voor het volledige schema en merge-strategieën.

**Steps:**

1. Maak `.project/project.json` aan met het volledige lege schema uit `shared/DASHBOARD.md`
2. Vul `concept` sectie (preferred: markdown-file, niet inline):
   - `name`: projectnaam (uit Phase 1/2 user answers)
   - `pitch`: 1-2 zinnen samenvatting (uit user answers)
   - `conceptFile`: `"project-concept.md"` — verwijzing naar het markdown-bestand
   - `content`: lege string `""` — NOOIT ook inline invullen naast `conceptFile`
   - Maak `.project/project-concept.md` aan met de korte projectbeschrijving als plain markdown (wat het project doet, voor wie, kernfunctionaliteit). Hoeft niet uitgebreid — thinking/plan skills vullen dit later aan.
3. Vul `stack` sectie volledig (OVERWRITE — core-setup is de eerste skill):
   - `framework`: uit user answers (Phase 2 Q3/Q4)
   - `language`: uit user answers (Phase 2 Q4)
   - `styling`: uit user answers (Phase 2 Q4/Q5)
   - `db`: uit user answers (Phase 2 Q4/Q5)
   - `auth`: uit user answers (Phase 2 Q4/Q5)
   - `hosting`: uit user answers (Phase 2 Q4/Q5)
   - `packages`: uit gegenereerde package.json / project files
4. Write `.project/project.json`
5. Maak `.project/project-context.json` aan met `context` sectie (initieel, wordt bijgewerkt door build/refactor skills):
   - `context.structure`: file tree van project (zelfde formaat als voorheen in CLAUDE.md). Generate from actual file tree after Phase 3/4
   - `context.routing`: route patterns met arrow notation (alleen web projects met routing, anders lege array)
   - `context.patterns`: non-obvious patterns ontdekt tijdens setup (path aliases, env config, etc.)
   - `context.updated`: huidige datum
   - Write `.project/project-context.json`
6. Set skip-worktree op alle `.project/` bestanden zodat lokale wijzigingen git status/pull niet verstoren:
   ```bash
   git ls-files .project/ | xargs git update-index --skip-worktree
   ```

**Output:**

```
DASHBOARD CREATED

Project: {name}
Stack: {framework} / {language}
Packages: {N} packages
```

---

## Phase 7c: Setup Task Seeding (frontend projects only)

**Goal:** Seed aanbevolen setup-tasks naar de backlog zodat de user een duidelijk vervolgpad heeft.

**Trigger:** Alleen als `stack.framework` een frontend framework is (React, Vue, Svelte, Next.js, Nuxt, Astro, Remix, SolidJS). Skip volledig voor game, CLI, backend-only of desktop.

**Stap 1 — Compute conditions:**

- `needsTheme` = `project.json#theme` heeft geen `colors` of is leeg

Skip Phase 7c volledig als `needsTheme = false`.

**Stap 2 — Seed features naar `.project/backlog.html`:**

1. Als `backlog.html` niet bestaat: kopieer `{skills_path}/shared/references/backlog-template.html` → `.project/backlog.html`, zet `data.source = "/core-setup"`
2. Read `backlog.html` → parse JSON uit `<script id="backlog-data">` blok
3. Check `data.features.find(f => f.name === "setup-design-tokens")` — sla over als al bestaat
4. Voeg toe als `needsTheme = true`:

```json
[
  {
    "name": "setup-design-tokens",
    "type": "THEME",
    "status": "TODO",
    "phase": "P1",
    "description": "Define color palette, typography scale, and spacing tokens via /frontend-tokens before UI work begins.",
    "source": "/core-setup",
    "dependencies": [],
    "auto": true
  }
]
```

5. Zet `data.updated` naar huidige datum (`YYYY-MM-DD`)
6. Edit het JSON-blok terug in `backlog.html` (script-tags intact)

**Stap 3 — Vraag user:**

```yaml
header: "Setup task"
question: "Setup-task toegevoegd aan backlog. Wil je nu starten?"
options:
  - label: "Later (Recommended)", description: "Ga verder met /dev-plan of /thinking-concept"
  - label: "Nu /frontend-tokens", description: "Stel design tokens in — kleur, typografie, spacing"
multiSelect: false
```

Als "Nu /frontend-tokens" → exit core-setup, draai `/frontend-tokens` direct.

---

## Phase 8: Commit (optional)

AskUserQuestion (single-select): Commit setup files now, or skip.

If committing: stage relevant files, create commit with conventional commit format (e.g., `build: scaffold [stack] project`).

---

## Phase 9: Summary

Show a concise summary of what was set up:

```
SETUP COMPLETE: {project name}

Start developing:
  {dev command}           → {what it starts, e.g. "frontend op :5173 + backend op :3001"}

Useful commands:
  {test command}          → run tests
  {build command}         → production build
```

**Next steps** — pas suggesties aan op basis van project type uit Phase 2.3 (Web/Backend/Fullstack/Game/Mobile/Desktop/CLI). Toon in deze volgorde:

**1. Concept verkennen (optioneel, aanbevolen voor greenfield):**

- `/thinking-concept` — bouw projectconcept uit met begeleidende vragen
- `/thinking-brainstorm` — expandeer ideeën via creatieve technieken
- `/thinking-research` — research stack/markt/concurrenten als input voor planning

**2. Plannen — feature backlog opzetten:**

- Web/Backend/Fullstack/Mobile/Desktop/CLI: `/dev-plan` — zet ideeën om in geprioriteerde web feature backlog
- Game: `/game-plan` — zet ideeën om in geprioriteerde game feature backlog

**3. Eerste feature definiëren + bouwen:**

- Web/Backend/etc: `/dev-define [feature]` → `/dev-build [feature]`
- Game: `/game-define [feature]` → `/game-build [feature]`

**Aanvullend voor frontend/fullstack** (skip voor game/CLI/desktop/backend-only):

- `/core-setup [module]` — voeg libraries toe (Tailwind, Vitest, Playwright, Biome, etc.)
- `/frontend-tokens` — design tokens instellen (alleen tonen als Phase 7c "Later" koos en `theme` sectie in `project.json` nog leeg is)
- `/frontend-design [feature]` — visuele design spec voor een feature
