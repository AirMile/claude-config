---
name: core-setup
description: Interactive project setup wizard — configures environment, generates project files, CLAUDE.md, dashboard init, and stack research. Audit mode for existing projects. Use with /core-setup.
disable-model-invocation: true
metadata:
  author: mileszeilstra
  version: 1.3.0
  category: core
---

# Project Setup Skill

**Trigger**: `/core-setup`

Interactive wizard that sets up a new or existing project. Collects user decisions, generates project files, configures Claude Code.

**CRITICAL: One question per response.** Never combine multiple questions in one message.

### "Let Claude decide" Option

For every AskUserQuestion where the choice involves **technical decisions** (not personal preferences), add a final option:

- **Label**: "Let Claude decide"
- **Description**: "Claude picks the best option based on your project context and best practices"

**Exclude from**: language selection (Phase 1.1), project description (Phase 2.1), project name (Phase 2.2), project type (Phase 2.3) — these require user input or personal preference.

**Include in**: all other modals (tech stack, suggestions, web standards, git init, doc generators, permissions, directory exclusions, commit, merge/replace/audit).

**When selected**: Choose the best option based on project context, industry best practices, and earlier answers. Show a one-liner explaining the choice:

```
CLAUDE'S PICK: {chosen option} — {brief reason}
```

Then continue the flow without additional confirmation.

For multi-select questions: select the combination Claude considers most appropriate for the project.

---

## Phase 1: Detect & Configure

1. **Language selection** — AskUserQuestion (single-select):
   - Options: English, Nederlands, Deutsch, Français, Español
   - Store for Phase 6 (CLAUDE.md `## User Preferences`)

2. **Detect existing project** — Run detection script:

   ```bash
   python3 .claude/skills/core-setup/scripts/detect-existing.py --path .
   ```

   If files found, AskUserQuestion (single-select):
   - **Merge**: behoud bestaande bestanden, voeg ontbrekende config toe
   - **Replace**: overschrijf bestaande configs met verse setup
   - **Audit**: scan het project en stel verbeteringen voor zonder volledige setup
   - **Resync**: vergelijk CLAUDE.md getemplate secties met laatste `CLAUDE.base.md` en update alleen die secties

   **Audit mode** (skip Phase 2-4, ga direct naar audit):
   1. Scan voor ontbrekende essentials: formatter config, `.env.example`, `.gitignore`, type checking, testing framework
   2. Check Claude config: `settings.local.json` aanwezig? format-on-save hook? permissions?
   3. Check CLAUDE.md: bestaat? heeft canonical sections? is `### Stack` up-to-date?
   4. Presenteer bevindingen als checklist met AskUserQuestion (multi-select): welke fixes toepassen?
   5. Voer geselecteerde fixes uit, dan door naar Phase 5+ (Claude config, CLAUDE.md, research)

   **Resync mode** (skip Phase 2-7, focus alleen op CLAUDE.md template-secties):
   1. **Detect**: lees project `CLAUDE.md` en root `CLAUDE.base.md`. Parse alle sectie-blokken gemarkeerd door `<!-- claude-config:section:<id> start --> ... <!-- claude-config:section:<id> end -->`.
   2. **Diff per sectie**:
      - **Missing**: marker bestaat in base, niet in project → kandidaat om toe te voegen
      - **Drift**: marker bestaat in beide maar inhoud verschilt → kandidaat om te updaten
      - **Match**: identiek → skip
      - **Local-only**: marker in project niet in base → laat staan, behandel als project-customization
      - **Buiten markers**: alle inhoud zonder marker (User Preferences, Project, Project Context, custom edits) blijft ongewijzigd
   3. **Strategy per sectie** — AskUserQuestion (multi-select) met de drift/missing secties als opties:
      - Default checked: **alleen missing secties** (veilig — voegt toe, overschrijft niets)
      - Default unchecked: **alle drift secties** (vereist expliciete opt-in — drift kan bewuste user-edit zijn)
      - Per drift-sectie: toon inline diff (project ↔ base) zodat user geïnformeerd kan kiezen
      - Per gekozen sectie: vervang inhoud tussen markers met base-versie
   4. **Apply**: schrijf alleen geselecteerde wijzigingen. Placeholder-substituties (`{{PROJECT_NAME}}` etc.) zitten buiten markers en blijven onaangeroerd.
   5. **Rapport**: ASCII tabel sectie | status (added/updated/kept-local/skipped) | bron-versie. Daarna stop — geen Phase 2-9.

3. **MCP servers** — Check installed via `claude mcp list`. Install missing (user scope):

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
   - Offer complementary libraries based on chosen stack (TypeScript, testing, state management, styling, etc.)
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

## Phase 7c: Design Tokens (optional, frontend projects only)

**Goal:** Vraag of user design tokens nu wil instellen, zodat `theme` sectie in project.json niet leeg blijft.

**Trigger:** Alleen als `stack.framework` een frontend framework is (React, Vue, Svelte, Next.js, Nuxt, Astro, Remix, SolidJS). Skip anders.

**AskUserQuestion (single-select):**

1. **Later** (Recommended) — theme blijft leeg, user draait `/frontend-tokens` zelf wanneer nodig
2. **Nu `/frontend-tokens` starten** — exit core-setup, draai tokens skill direct

Geen blocker: default is "Later". Theme-sectie wordt pas gevuld wanneer user expliciet kiest.

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
