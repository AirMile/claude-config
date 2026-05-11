# Greenfield Mode

Interactieve wizard voor nieuwe projecten. User beantwoordt vragen over stack en standards; skill genereert alle project files.

**CRITICAL: One question per response.** Never combine multiple questions in one message.

**Plain-text question format** — wrap elke plain-text vraag in dit visueel-distinct blok zodat de user direct ziet dat input gevraagd wordt. Niet toepassen op AskUserQuestion modals — die hebben hun eigen UI.

```
---

### ▸ Vraag — {korte titel}

{Vraag tekst, eventueel met genummerde opties op nieuwe regels}

→ Claude raadt aan: {advies + 1 zin reden}

{input-hint, bijv. "Welke wil je toevoegen? (bijv. `1,3` of `geen`)"}

---
```

**Regels:**

- `→ Claude raadt aan:` regel is verplicht bij selection-style vragen (Project name, Tech stack, Suggestions). Skip alleen bij free-form (Project description).
- `→ Tip:` regel is optioneel bij free-form vragen voor scope/context-sturing. Geen aanbeveling, alleen guardrail.
- Niet toevoegen aan AskUserQuestion modals — die hebben hun eigen "Let Claude decide" optie.

Toepasbaar op: Project description, Project name, Tech stack, Suggestions (per categorie).

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

0. **Concept preflight** — check of er al concept-data ligt vóór je iets vraagt:

   Lees `CONCEPT_CONTEXT` per `shared/CONCEPT.md` Reader.

   **Als `CONCEPT_CONTEXT.present`:**

   Toon AskUserQuestion (single-select):
   - header: "Concept"
   - question: "Er ligt al een concept (van /thinking-concept of /project-add). Hoe wil je verder?"
   - options:
     - label: "Gebruik bestaand concept (Recommended)" — description: "Skip Project description + Project name vragen, lees pitch/name uit de bestaande bestanden"
     - label: "Aanvullen met extra context" — description: "Toon huidig concept, vraag korte aanvullende beschrijving die ik mee laat wegen"
     - label: "Opnieuw beginnen" — description: "Negeer bestaand concept, stel beide vragen alsnog (concept-md wordt later niet overschreven)"
   - multiSelect: false

   **Bij "Gebruik bestaand"**: sla `concept.name` en `concept.pitch` op als `PROJECT_NAME` / `PROJECT_PITCH`. Lees `.project/project-concept.md` volledig in als `CONCEPT_CONTEXT`. Skip stap 1 en 2. Ga direct naar stap 3 (Project type).

   **Bij "Aanvullen"**: toon de eerste 200 chars van `project-concept.md` als context-blok, vraag om aanvullende beschrijving (free-form), append in-memory aan `PROJECT_PITCH` en `CONCEPT_CONTEXT`. Skip stap 2 (name behouden uit concept).

   **Bij "Opnieuw"**: ga normaal door met stap 1 en 2. `CONCEPT_CONTEXT` blijft leeg.

   **Geen concept aanwezig**: ga normaal door met stap 1. `CONCEPT_CONTEXT` blijft leeg.

   **`CONCEPT_CONTEXT` als stack-context** — bij elke selection-style vraag hierna (Project type, Tech stack, Suggestions per categorie): gebruik `CONCEPT_CONTEXT` actief:
   - Onderbouw `→ Claude raadt aan:` met concept-relevante reden ("Next.js — SSR voor de SEO die je in het concept noemt").
   - Stem suggesties af op het domein uit het concept.
   - Geen extra disk-read nodig — `CONCEPT_CONTEXT` zit al in context.

1. **Project description** — Toon dit blok aan de user en wacht op antwoord:

   ```
   ---

   ### ▸ Vraag — Project description

   Beschrijf kort wat je project doet en voor wie het bedoeld is.

   → Tip: 1-3 zinnen is genoeg — uitbreiden kan later via /thinking-concept.

   ---
   ```

2. **Project name** — Stel 2-3 kebab-case namen voor op basis van Phase 2.1 beschrijving en toon dit blok:

   ```
   ---

   ### ▸ Vraag — Project name

   1. {suggestie-1}
   2. {suggestie-2}
   3. {suggestie-3}

   → Claude raadt aan: 1 — {korte reden}

   Kies een nummer of typ je eigen.

   ---
   ```

3. **Project type** — AskUserQuestion (single-select):
   - Web Frontend, Web Backend, Fullstack, Game, Mobile, Desktop, CLI
4. **Tech stack** — Plain text genummerde lijst (**single-select**: één primaire stack/framework combinatie). Toon relevante volledige stacks op basis van project type in dit blok:

   ```
   ---

   ### ▸ Vraag — Tech stack

   1. {stack-combinatie 1, bijv. "Tauri + React + TypeScript"} — {korte beschrijving}
   2. {stack-combinatie 2} — {korte beschrijving}
   ...

   → Claude raadt aan: {nummer} — {1 zin reden op basis van project type/beschrijving}

   Welke wil je gebruiken? (kies een nummer)

   ---
   ```

   **Belangrijk:** Tech stack is een keuze tussen mutually-exclusive stacks (je gebruikt niet Tauri én Electron). Daarom single-select. Multi-select libraries komen in de volgende vraag (Suggestions).

5. **Suggestions** — Plain text genummerde lijst per categorie (multi-select via free-form parse). Toon complementaire libraries op basis van gekozen stack. Splits per categorie als er meer dan 7 opties zijn:
   - **Styling/UI**: Tailwind, shadcn/ui, CSS Modules, styled-components, etc.
   - **Testing + Utilities**: Vitest, Jest, Cypress, TypeScript, ESLint, Prettier, Zod, Husky, etc. (Playwright NIET aanbieden — skills draaien al `npx playwright` direct; alleen via `/core-setup playwright` als de user expliciet een eigen E2E suite wil)
   - **State/Data** (alleen relevant voor de stack): Zustand, Redux, TanStack Query, SWR, etc.
   - **Forms** (alleen voor React/Vue/Svelte stack): react-hook-form + zod (tier-1, recommended), Formik, VeeValidate (Vue), Felte (Svelte)

   Per categorie één vraag tegelijk in dit format:

   ```
   ---

   ### ▸ Vraag — Suggestions: {categorie}

   1. {library 1}
   2. {library 2}
   ...

   → Claude raadt aan: {nummers} — {1 zin reden op basis van stack/project context}

   Welke wil je toevoegen? (bijv. `1,3` of `geen`)

   ---
   ```

6. **Web standards** (skip for game/CLI/desktop) — Three single-select questions:
   - Data fetching strategy (if React/Vue + externe API/backend): plain fetch, SWR, TanStack Query
     **Skip** als het project geen externe data sources heeft (bijv. localStorage-only, in-memory state, static content)
   - Accessibility: WCAG 2.1 AA, WCAG 2.1 A, Minimal
   - Responsive: Mobile-first, Desktop-first, Fixed width

---

## CHECKPOINT: Interview Samenvatting

Toon een ASCII tree van alle gemaakte keuzes — alleen wat de user heeft gekozen voor stack, libraries, state/forms, web standards. **Niet** de toekomstige fases tonen (de TaskCreate todo-lijst doet dat al). Voorbeeld:

```
streaky (Web Frontend)
├── Stack:        React + Vite · TypeScript · Tailwind
├── Libraries:    shadcn/ui · Vitest · Biome
├── State/Forms:  Zustand · react-hook-form + zod
└── Standards:    WCAG 2.1 AA · Mobile-first · TanStack Query
```

Vraag via AskUserQuestion: "Klopt dit overzicht? Wil je iets aanpassen?"

- "Ga door met setup (Recommended)" — door naar Phase 3
- "Aanpassen" — terug naar relevante vraag

## Phase 3: Generate Project

> **Todo**: markeer Phase 2 → `completed`, Phase 3 → `in_progress`.

1. **Fetch latest versions** via `npm view` / `pip show` / `cargo search` or equivalent for the stack's package manager.

2. **Generate project files** appropriate for the chosen stack. Include package manifest, framework config, linting/formatting config, `.env.example` (only relevant vars), and `.gitignore`.

3. **Optional: Git init** — Check if `.git` already exists. If not, AskUserQuestion (single-select):
   - Full (init + .gitignore + commit), Only .gitignore, Skip

4. **Token bootstrap** (alleen voor frontend stacks): voer de Bootstrap Procedure uit `shared/TOKENS.md` uit. Skipt automatisch als geen Tailwind gevonden, `tokens.css` al bestaat, of geen CSS entry detecteerbaar is.

---

## Phase 4: Install & Verify

> **Todo**: markeer Phase 3 → `completed`, Phase 4 → `in_progress`.

Install dependencies and run build to verify setup compiles. Non-blocking: continue setup even if install/build fails.

---

## Phase 5: Configure Claude

> **Todo**: markeer Phase 4 → `completed`, Phase 5 → `in_progress`.

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

Voor maatwerk: de user kan `.claude/settings.local.json` direct bewerken na de setup (template hieronder).

Daarna plain text — directory exclusions:

```
---

### ▸ Vraag — Directory exclusions

Welke mappen wil je uitsluiten van Claude's schrijftoegang?

1. node_modules
2. vendor
3. dist
4. build
5. .env

→ Claude raadt aan: {nummers} — {1 zin reden op basis van stack/project type}

Welke wil je uitsluiten? (bijv. `1,3` of `geen`)

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

- **Vite-pad**: pin **`@vitejs/plugin-react@^5`** in `package.json` (NIET v6 — die gebruikt OXC i.p.v. Babel waardoor de overlay in degraded mode valt zonder file:line refs). Volg setup-guide `## Setup — Vite` → `### Plugin Selection` (auto, geen modal) en daarna `### Install & Configure` stappen 1-6.
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

> **Todo**: markeer Phase 6 → `completed`, Phase 7 → `in_progress`.

Volg `references/stack-baseline-shared.md`.

**Trigger:** `stack.framework` is gevuld én `.claude/research/stack-baseline.md` bestaat nog niet.

---

## Phase 7b: Dashboard Init

> **Todo**: markeer Phase 7 → `completed`, Phase 7b → `in_progress`.

**Goal:** Maak `.project/project.json` aan als het eerste dashboard bestand voor dit project. core-setup is de eerste skill die draait — alle latere skills bouwen hierop voort.

Zie `{skills_root}/shared/DASHBOARD.md` voor het volledige schema en merge-strategieën (te vinden via `find ~/.claude -name DASHBOARD.md` of in de claude-config repo).

**Steps:**

1. Check eerst of `.project/project.json` al bestaat (bijv. uit een initiële commit). Zo ja: lees + merge i.p.v. overschrijven. Zo nee: maak aan met het volledige lege schema uit `shared/DASHBOARD.md`
2. Vul `concept` sectie (preferred: markdown-file, niet inline):
   - `name`: projectnaam — gebruik bestaande `concept.name` als gevuld, anders uit user answers; NIET overschrijven als al ingevuld
   - `pitch`: 1-2 zinnen samenvatting — gebruik bestaande `concept.pitch` als gevuld, anders uit user answers; NIET overschrijven als al ingevuld
   - `conceptFile`: `"project-concept.md"` — verwijzing naar het markdown-bestand
   - `content`: lege string `""` — NOOIT ook inline invullen naast `conceptFile`
   - Concept-md handling:
     - **Bestaat `.project/project-concept.md` met > 50 chars**: NIET overschrijven, NIET appenden. De aanvullende beschrijving uit Phase 2 stap 0 "Aanvullen" blijft in-memory — alleen `/thinking-concept` schrijft naar disk.
     - **Bestaat niet of < 50 chars**: aanmaken met `PROJECT_PITCH` (uit Phase 2 answers of preflight) als plain markdown (wat het project doet, voor wie, kernfunctionaliteit). Hoeft niet uitgebreid — thinking/plan skills vullen dit later aan.
3. Vul `stack` sectie volledig (OVERWRITE — core-setup is de eerste skill):
   - `framework`: uit user answers (Phase 2 Q3/Q4)
   - `language`: uit user answers (Phase 2 Q4)
   - `styling`: uit user answers (Phase 2 Q4/Q5)
   - `db`: uit user answers (Phase 2 Q4/Q5)
   - `auth`: uit user answers (Phase 2 Q4/Q5)
   - `hosting`: uit user answers (Phase 2 Q4/Q5)
   - `packages`: uit gegenereerde package.json / project files
4. Write `.project/project.json`
   4b. Init backlog met concept-flag (alle projecttypen):
   - Als `.project/backlog.html` niet bestaat: kopieer `{skills_path}/shared/references/backlog-template.html` → `.project/backlog.html`
   - Read `backlog.html` → parse `<script id="backlog-data">` JSON
   - Zet `data.flags = { "hasConcept": true, "conceptPath": ".project/project-concept.md" }`
   - Zet `data.source = "/core-setup"` en `data.updated` naar huidige datum
   - Edit JSON-blok terug (script-tags intact)
   - Dit laat de `/project-plan` knop verschijnen in het backlog dashboard zodra er een concept is maar nog geen features zijn.
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
    "dependencies": []
  }
]
```

5. Zet `data.updated` naar huidige datum (`YYYY-MM-DD`)
6. Edit het JSON-blok terug in `backlog.html` (script-tags intact)

**Stap 3 — Auto-execute:**

Geen prompt. Skill chaining is silent: na het seeden van `setup-design-tokens` exit core-setup en draai `/frontend-tokens` direct. Meld het in Phase 9 Summary onder "Volgende skill draaiend".

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

### Smart Backlog Server Prompt (conditional)

**Stap 1 — Detect todos:** Lees `.project/backlog.html` (als die bestaat) en parse `data.features`. Tel items met status `TODO` of `DEFINED`.

| Conditie                              | Actie                                      |
| ------------------------------------- | ------------------------------------------ |
| Geen `backlog.html` of 0 todos        | Skip backlog prompt — geen modal           |
| ≥1 todo (bijv. `setup-design-tokens`) | Toon AskUserQuestion modal (zie hieronder) |

**Stap 2 — Modal (alleen bij ≥1 todo):**

AskUserQuestion (single-select):

- "Start backlog server (Recommended)" — `/project-backlog start` op `http://localhost:9876`. Toon `{N} todo(s) in backlog: {lijst van eerste 3 names}`.
- "Skip" — later handmatig starten met `/project-backlog`

Bewaar het resultaat als `backlog_started` (true/false) voor smart next steps.

### Smart Next Steps

Pas suggesties aan op basis van project type (Phase 2.3) **én** `backlog_started`. Volgorde:

**Als `backlog_started = true`:**

```
Bekijk je backlog:        http://localhost:9876
Eerste todo aanpakken:    {top todo name} → {bijbehorende skill}
```

Daarna alleen relevante vervolgskills (geen herhaling van todos die al in de backlog staan):

- Web/Backend/Fullstack/Mobile/Desktop/CLI: `/dev-define [nieuwe feature]` → `/dev-build [feature]`
- Game: `/game-define [feature]` → `/game-build [feature]`
- Concept uitbouwen: `/thinking-concept`, `/thinking-brainstorm`

**Als `backlog_started = false` of geen todos in backlog:**

**1. Concept verkennen (optioneel, aanbevolen voor greenfield):**

- `/thinking-concept` — bouw projectconcept uit met begeleidende vragen
- `/thinking-brainstorm` — expandeer ideeën via creatieve technieken
- `/thinking-research` — research stack/markt/concurrenten als input voor planning

**2. Plannen — feature backlog opzetten:**

- Alle stacks (web, game, CLI, etc.): `/project-plan` — zet ideeën om in geprioriteerde feature backlog (auto-detecteert stack)

**3. Eerste feature definiëren + bouwen:**

- Web/Backend/etc: `/dev-define [feature]` → `/dev-build [feature]`
- Game: `/game-define [feature]` → `/game-build [feature]`

**Als er todos zijn maar backlog niet gestart:** voeg bovenaan toe:

```
Tip: er staan {N} todo(s) klaar in .project/backlog.html.
Start later met /project-backlog om ze visueel af te vinken.
```

**Aanvullend voor frontend/fullstack** (skip voor game/CLI/desktop/backend-only):

- `/core-setup [module]` — voeg libraries toe (Tailwind, Vitest, Playwright, Biome, etc.)
- `/frontend-design [feature]` — visuele design spec voor een feature

**Cleanup:**

```bash
rm -f .project/session/setup-pending.json
```

> **Todo**: markeer Phase 9 → `completed`.
