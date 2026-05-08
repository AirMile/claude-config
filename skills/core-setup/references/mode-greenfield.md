# Greenfield Mode

Interactieve wizard voor nieuwe projecten. User beantwoordt vragen over stack en standards; skill genereert alle project files.

**CRITICAL: One question per response.** Never combine multiple questions in one message.

---

## Process

**Fase tracking** — eerste actie van de skill: roep `TaskCreate` aan met deze 12 items (status `pending`), daarna gebruik `TaskUpdate` om per fase `in_progress` te zetten aan begin en `completed` aan einde. Bij context compaction blijft de task list zichtbaar — geen risico op vergeten fases.

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

> **Todo**: roep `TaskCreate` aan met de 12 fase-items (zie boven). Markeer Phase 1 → `in_progress` via `TaskUpdate`.

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

> **Todo**: markeer Phase 1 → `completed`, Phase 2 → `in_progress`.

Ask sequentially, one question per response:

1. **Project description** — Ask in plain text: "Beschrijf kort wat je project doet en voor wie het bedoeld is."
2. **Project name** — AskUserQuestion (single-select):
   - "Generate name (Recommended)" — suggest 2-3 short, kebab-case names based on the description
   - "I'll type my own" — user provides via "Other"
3. **Project type** — AskUserQuestion (single-select):
   - Web Frontend, Web Backend, Fullstack, Game, Mobile, Desktop, CLI
4. **Tech stack** — AskUserQuestion (multi-select):
   - Offer relevant frameworks/tools based on project type
5. **Suggestions** — AskUserQuestion (multi-select):
   - Offer complementary libraries based on chosen stack
   - If more than 7 options (see "Modal Option Cap" in main SKILL.md), split per category.
     Combineer korte categorieën in één AskUserQuestion call (1-4 questions ondersteund):
     - **Call 1 — Styling/UI** (eigen call): Tailwind, shadcn/ui, CSS Modules, styled-components, etc.
     - **Call 2 — Testing + Utilities** (gecombineerd):
       - Testing: Vitest, Jest, Playwright, Cypress, etc.
       - Utilities: TypeScript, ESLint, Prettier, Zod, Husky, etc.
     - **Call 3 — State/Data** (alleen tonen als relevant voor de stack): Zustand, Redux, TanStack Query, SWR, etc.
     - **Call 4 — Forms** (alleen tonen voor React/Vue/Svelte stack): react-hook-form + zod (tier-1, recommended), Formik, VeeValidate (Vue), Felte (Svelte)
6. **Web standards** (skip for game/CLI/desktop) — Three single-select questions:
   - Data fetching strategy (if React/Vue + externe API/backend): plain fetch, SWR, TanStack Query
     **Skip** als het project geen externe data sources heeft (bijv. localStorage-only, in-memory state, static content)
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

> **Todo**: markeer Phase 2 → `completed`, Phase 3 → `in_progress`.

1. **Fetch latest versions** via `npm view` / `pip show` / `cargo search` or equivalent for the stack's package manager.

2. **Generate project files** appropriate for the chosen stack. Include package manifest, framework config, linting/formatting config, `.env.example` (only relevant vars), and `.gitignore`.

3. **Optional: Git init** — Check if `.git` already exists. If not, AskUserQuestion (single-select):
   - Full (init + .gitignore + commit), Only .gitignore, Skip

---

## Phase 4: Install & Verify

> **Todo**: markeer Phase 3 → `completed`, Phase 4 → `in_progress`.

Install dependencies and run build to verify setup compiles. Non-blocking: continue setup even if install/build fails.

---

## Phase 5: Configure Claude

> **Todo**: markeer Phase 4 → `completed`, Phase 5 → `in_progress`.

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

Auto-format after every Write/Edit.

**Step 1 — Check bestaande hook:**

```bash
ls -la .claude/hooks/format-on-save.cjs 2>/dev/null
```

Als het bestand al bestaat (via symlink naar globale claude-config of project-lokaal): lees het en check of het de project-stack ondersteunt (bijv. Biome via `biome.json` detectie). Zo ja, skip aanmaken — referenceer alleen in `settings.local.json`.

**Step 2 — Alleen aanmaken als geen bestaande hook:**

Maak `.claude/hooks/format-on-save.cjs` aan met:

- Node.js script dat stdin JSON leest, file path extraheert, extension checkt, formatter aanroept
- Gebruik `.cjs` om ES Module issues te vermijden
- BELANGRIJK: schrijf NIET naar `.claude/hooks/` als die map een symlink is naar een gedeelde repo (check via `readlink .claude/hooks`)

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

Voeg de hook toe aan `settings.local.json` — in dezelfde file als `permissions` (niet apart schrijven):

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

> **Todo**: markeer Phase 5 → `completed`, Phase 5b → `in_progress`.

Installeer dev-tools die framework-conditional zijn en geen user-input nodig hebben. Geen modal, geen confirmation — auto-install bij match, silent skip bij mismatch.

### inspect-overlay

**Trigger:** `stack.framework` ∈ `{React+Vite, Next.js}`. Bepaal dit uit Phase 2.4 stack-keuze.

| Stack uit Phase 2.4                                                               | Actie                                                                  |
| --------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| React + Vite                                                                      | Install via `setup-guide.md#Setup — Vite`                              |
| Next.js                                                                           | Install via `setup-guide.md#Setup — Next.js` (Babel full mode default) |
| Alle andere (incl. Vue, Svelte, Astro, Nuxt, game, CLI, backend, mobile, desktop) | Skip silent — geen output                                              |

**Auto-mode aannames** (geen modals tonen):

- **Vite-pad**: greenfield gebruikt `@vitejs/plugin-react` (Babel) — geen SWC-switch nodig. Volg setup-guide stappen 1-6 onder `## Setup — Vite` → `### Install & Configure`.
- **Next.js-pad**: kies Babel full mode automatisch. Volg setup-guide `### Babel Plugin (Full Mode)` accept-pad én `### Install` stappen 1-6.

**Skip de "Restart dev server" stap** — in greenfield draait er nog geen dev server.

**Track voor Phase 9 Summary** of de overlay is geïnstalleerd (ja/nee + framework).

**Geen project.json update nodig** — inspect-overlay is dev-only, geen `stack.*` key.

---

## Phase 6: Update CLAUDE.md

> **Todo**: markeer Phase 5b → `completed`, Phase 6 → `in_progress`.

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

> **Todo**: markeer Phase 6 → `completed`, Phase 7 → `in_progress`.

Generate `.claude/research/stack-baseline.md` — reusable framework conventions that avoid duplicate Context7 queries in other skills.

**Run as general-purpose agent** (`subagent_type="general-purpose"`) for context isolation — Context7 queries for multiple stack technologies produce substantial output that shouldn't stay in the main session. The agent needs Write access; Explore is read-only and won't work.

1. Maak eerst de map aan: `mkdir -p .claude/research`
2. Voor elke major technologie in de stack, query Context7 (`resolve-library-id` → `query-docs`)
3. Distilleer per technologie: conventions (5-10), patterns (5-10), idioms (3-5), testing (3-5), pitfalls (3-5)
4. Schrijf het resultaat direct naar `.claude/research/stack-baseline.md`
5. Voeg een Context7 library IDs tabel onderaan toe voor follow-up queries

**Game projects:** Also generate `.claude/research/architecture-baseline.md` with scene tree patterns, node types, signals, state machines.

---

## Phase 7b: Dashboard Init

> **Todo**: markeer Phase 7 → `completed`, Phase 7b → `in_progress`.

**Goal:** Maak `.project/project.json` aan als het eerste dashboard bestand voor dit project. core-setup is de eerste skill die draait — alle latere skills bouwen hierop voort.

Zie `{skills_root}/shared/DASHBOARD.md` voor het volledige schema en merge-strategieën (te vinden via `find ~/.claude -name DASHBOARD.md` of in de claude-config repo).

**Steps:**

1. Check eerst of `.project/project.json` al bestaat (bijv. uit een initiële commit). Zo ja: lees + merge i.p.v. overschrijven. Zo nee: maak aan met het volledige lege schema uit `shared/DASHBOARD.md`
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
   git add --sparse .project/
   git ls-files .project/ | xargs git update-index --skip-worktree
   ```
   Eerst staging is verplicht — `update-index --skip-worktree` werkt alleen op bestanden die in de index staan.

**Output:**

```
DASHBOARD CREATED

Project: {name}
Stack: {framework} / {language}
Packages: {N} packages
```

---

## Phase 7c: Setup Task Seeding (frontend projects only)

> **Todo**: markeer Phase 7b → `completed`, Phase 7c → `in_progress`.

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

> **Todo**: markeer Phase 7c → `completed`, Phase 8 → `in_progress`.

AskUserQuestion (single-select): Commit setup files now, or skip.

If committing: stage relevant files, create commit with conventional commit format (e.g., `build: scaffold [stack] project`).

---

## Phase 9: Summary

> **Todo**: markeer Phase 8 → `completed`, Phase 9 → `in_progress`.

Show a concise summary of what was set up:

```
SETUP COMPLETE: {project name}

Start developing:
  {dev command}           → {what it starts, e.g. "frontend op :5173 + backend op :3001"}

Useful commands:
  {test command}          → run tests
  {build command}         → production build
```

**Als Phase 5b inspect-overlay heeft geïnstalleerd**, voeg toe na het code block:

```
Dev tools:
  Inspect overlay         → Cmd+Shift+X (Mac) / Ctrl+Shift+X (Win/Linux) om te togglen
```

Voor Next.js Babel full mode, voeg ook toe: `Note: Turbopack uitgeschakeld (Babel full mode voor exacte file:line refs).`

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

> **Todo**: markeer Phase 9 → `completed`.
