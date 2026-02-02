---
description: Interactive project setup wizard — configures dev environment, installs dependencies, updates CLAUDE.md
disable-model-invocation: true
---

# Project Setup Skill

**Trigger**: `/core-setup`

Activates when user wants to set up or configure a project. Uses Context7 for real-time version information.

**CRITICAL: One Question Per Response** — each question (plain text OR modal) MUST be in a SEPARATE response. Never combine multiple questions in one response.

## Workflow

### Step 1: Language Selection

AskUserQuestion (single-select):
- Header: "Language"
- Question: "What language should I communicate in?"
- Options: English, Nederlands, Deutsch, Français, Español
- If "other": ask user to specify in plain text

Store selection for Step 13 (CLAUDE.md `## User Preferences` section).

### Step 2: Detect Existing Project

Run `scripts/detect-existing.py` to check for existing files. If files found, ask user:
- Is this an existing project needing configuration?
- Should existing configs be merged or replaced?
- Backup existing files if replacing

### Step 3: Configure MCP Servers

Detect and install essential MCP servers.

**Essentiële MCPs:** sequentialthinking, context7, time

1. **Detect installed MCPs:**
   ```bash
   claude mcp list
   ```

2. **Install missing MCPs (user scope):**

   **sequentialthinking:**
   ```bash
   claude mcp add sequentialthinking -s user -- npx -y @modelcontextprotocol/server-sequential-thinking
   ```

   **context7:** Ask user via AskUserQuestion (single-select) if they want to configure with API key (free at context7.com/dashboard) for higher rate limits.
   ```bash
   # With key:
   claude mcp add context7 -e CONTEXT7_API_KEY=<key> -- npx -y @upstash/context7-mcp@latest
   # Without key:
   claude mcp add context7 -- npx -y @upstash/context7-mcp@latest
   ```

   **time** (requires `uv`):
   ```bash
   claude mcp add time -s user -- uvx mcp-server-time
   ```

3. **Report:** Show table of installed servers, note restart needed.

### Step 4-6: Project Setup (Sequential Modal Flow)

Each modal flows into the next. Wait for user response before proceeding.

---

**Modal 1: Projectnaam** — Vraag in plain text: "Wat is de naam van het project?"

**Modal 2: Projectomschrijving** — Vraag in plain text: "Geef een korte beschrijving van wat dit project doet/gaat doen."

**Modal 3: Projecttype** — AskUserQuestion (single-select):
- Header: "Projecttype"
- Options: Web Frontend (Aanbevolen), Web Backend, Fullstack, Game, Mobile, Desktop, CLI

---

**Modal 4: Tech Stack** — AskUserQuestion (multi-select), Header: "Tech Stack", altijd "Leg vraag uit" als laatste optie.

| Projecttype | Opties |
|-------------|--------|
| web-frontend | React (Aanbevolen), Vue, Angular, Svelte, Solid, Next.js, Nuxt, Astro |
| web-backend | Laravel (Aanbevolen), Express.js, Fastify, NestJS, Django, FastAPI, Rails |
| fullstack | Laravel+React (Aanbevolen), Laravel+Vue, Next.js, Nuxt, Django+React, Express+React |
| game | Godot (Aanbevolen), Unity, Unreal, Bevy, Phaser, Three.js |
| mobile | React Native (Aanbevolen), Flutter, Ionic, Expo, Swift/SwiftUI, Kotlin |
| desktop | Electron (Aanbevolen), Tauri, Qt, GTK, WPF |
| cli | Node.js (Aanbevolen), Python, Rust, Go, .NET |

---

**Modal 5: Smart Suggestions** — AskUserQuestion (multi-select), Header: "Suggesties", gebaseerd op geselecteerde tech stack.

| Stack | Opties |
|-------|--------|
| React | TypeScript (Aanbevolen), React Router, Zustand, TanStack Query, Tailwind CSS, Testing Library, Vitest |
| Laravel | Livewire (Aanbevolen), Inertia.js, Sanctum, Sail, Pest, Horizon |
| Vue | TypeScript (Aanbevolen), Pinia, Vue Router, Tailwind CSS, Vitest, VueUse |
| Angular | TypeScript (Aanbevolen), NgRx, Angular Material, Jasmine/Karma |
| Django | Django REST Framework (Aanbevolen), Celery, pytest-django, Docker |
| FastAPI | Pydantic (Aanbevolen), SQLAlchemy, Alembic, pytest |
| Game | Git LFS (Aanbevolen), Specifieke .gitignore, Asset Version Control, CI/CD |
| Overig | Docker (Aanbevolen), Testing Framework, Linting, CI/CD, TypeScript |

### Step 6: Project Standards (web projects only)

**Skip** als projecttype game, CLI, of desktop is.

**Modal 6a: Data Fetching Strategy** (alleen als React/Vue in stack) — AskUserQuestion (single-select):
- Plain fetch (Aanbevolen), SWR, TanStack Query

**Modal 6b: Accessibility Standaard** — AskUserQuestion (single-select):
- WCAG 2.1 AA (Aanbevolen), WCAG 2.1 A, Minimal

**Modal 6c: Responsive Design** — AskUserQuestion (single-select):
- Mobile-first (Aanbevolen), Desktop-first, Fixed width

Store selections for Step 13 (`### Standards` subsection).

### Step 7: Fetch Latest Versions

Use Context7 for each chosen technology:
1. `resolve-library-id` for each technology
2. `query-docs` with topic "installation setup configuration"
3. Extract latest version numbers and installation commands

### Step 8: Generate Configuration

Based on selections, create config files from `assets/config-templates/`:
- Node.js → package.json | PHP → composer.json | Python → pyproject.toml
- Include .env.example if needed

### Step 9: Optional Git Setup

AskUserQuestion (single-select):
- Full (init + .gitignore + commit), Partial (init + .gitignore), Skip

### Step 10: Install Dependencies

Auto-detect package manager and install:
- `package.json` → `npm install`
- `composer.json` → `composer install`
- `requirements.txt` → `pip install -r requirements.txt`
- `pyproject.toml` → `pip install -e .` or `poetry install`
- `Cargo.toml` → `cargo build`
- `go.mod` → `go mod download`

Report result. Continue setup even if installation fails (non-blocking).

### Step 11: Documentation Configuration

AskUserQuestion (single-select) for project type (documentation system):
- Laravel Backend, React Frontend, Vue Frontend, Laravel+React Fullstack, Laravel+Vue Fullstack, Unity Game, Unreal Game, Godot Game

Show recommended generators based on type, then AskUserQuestion (multi-select) to enable/disable generators.

**Generator categories per type:**
- **Laravel**: api, components, erd, events (recommended) + middleware, auth-flow, routes
- **React**: components, routes, state, design-tokens (recommended) + api-calls
- **Game**: scenes, game-classes, state-machines (recommended) + behavior-trees, prefabs

### Step 12: Configure Claude Permissions

Execute `scripts/generate-settings.py` to configure `.claude/settings.local.json`.

4 modals (all AskUserQuestion multi-select):
1. **File Ops**: auto-create, auto-edit, auto-read (preselected: auto-read)
2. **Tool Perms**: bash, packages, tests, commits (preselected: tests)
3. **Directory Access**: all (Aanbevolen), src, lib, app, tests, components
4. **Directory Exclusies**: none (Aanbevolen), node_modules, vendor, dist, build, coverage, .env

Combine selections to generate settings. Apply smart defaults based on project type.

### Step 13: Update CLAUDE.md

**Update `## User Preferences`:** Replace `Language:` line with selection from Step 1.

**Add `## Project` section with structured format:**

```markdown
## Project

**Name**: [Project Name]
**Type**: [e.g., "Web Frontend (React SPA)", "Game (Godot)"]
**Description**: [User's description]
**Created**: [Current date]

### Stack
**Frontend**: [Framework version, Bundler, Language] (if applicable)
**Backend**: [Framework version, Language version] (if applicable)
**Styling**: [CSS framework] (if applicable)
**Routing**: [Router library] (if applicable)
**Libraries**: [Key libraries, comma-separated]

### Testing
**Frontend**: [Test framework, Testing library] (if applicable)
**Backend**: [Test framework] (if applicable)
**E2E**: [E2E framework] (optional)

### Documentation Generators
**Enabled:** [comma-separated list of enabled generators]
**Available:** [comma-separated list of disabled generators]

### Standards (web projects only)
**Accessibility:** [wcag-aa | wcag-a | minimal]
**Responsive:** [mobile-first | desktop-first | fixed]
**Data Fetching:** [plain-fetch | swr | tanstack] (if React/Vue)
```

**Format rules:**
- Only add categories applicable to the project type
- Format: `**Category**: Value1, Value2, Value3`
- Standards subsection only for web projects
- Do NOT add separate Tech Stack, Workspace Configuration, or Development Setup sections

**Example (Fullstack Laravel + React):**
```markdown
### Stack
**Frontend**: React 19, Vite 7, TypeScript
**Backend**: Laravel 11, PHP 8.3
**Styling**: Tailwind CSS v4
**Libraries**: Inertia.js, Sanctum

### Testing
**Frontend**: Vitest, React Testing Library
**Backend**: PHPUnit
**E2E**: Playwright
```

### Step 13.5: Create Resources Folder

Create `.claude/resources/` with stack-specific testing and pattern resources:

```bash
mkdir -p .claude/resources/testing
mkdir -p .claude/resources/stacks
mkdir -p .claude/resources/patterns
```

**Create based on stack:**
- `stack-detection.md` — parsing rules for `### Stack` section (always)
- `testing/vitest-rtl.md` — Vitest + RTL patterns (if frontend React/Vue/Svelte)
- `testing/phpunit.md` — PHPUnit + Laravel test patterns (if Laravel)
- `testing/jest-node.md` — Jest + Supertest patterns (if Node backend)
- `testing/playwright.md` — Playwright patterns (if web project)
- `patterns/tdd-cycle.md` — RED-GREEN-REFACTOR flow (always)
- `patterns/output-parsing.md` — universal test output format (always)

Commands automatically load relevant resources based on `### Stack` in CLAUDE.md.

### Step 14: Generate Stack Baseline Research

Generate `.claude/research/stack-baseline.md` — reusable research for framework conventions, avoiding duplicate Context7 queries in /dev skills.

**Steps:**
1. Create `.claude/research/` directory
2. Parse stack info from `## Project` section (Step 13)
3. For each major technology, execute Context7 research:
   - `resolve-library-id` for framework
   - `query-docs` with topic "conventions best practices patterns idioms"
4. Extract and distill: conventions (5-10), patterns (5-10), idioms (3-5), testing (3-5), pitfalls (3-5)
5. Generate via script:
   ```bash
   python3 .claude/skills/core-setup/scripts/generate-stack-baseline.py \
     --stack "[framework + version]" \
     --conventions "[extracted]" --patterns "[extracted]" \
     --idioms "[extracted]" --testing "[extracted]" \
     --pitfalls "[extracted]" --sources "[library IDs]" \
     --output .claude/research/stack-baseline.md
   ```
6. Validate: file exists, all sections populated, ~3-5k tokens

### Step 14.5: Architecture Baseline (Game Projects Only)

**Skip** if project type is NOT game.

Generate `.claude/research/architecture-baseline.md` for Godot/Unity/Unreal architecture patterns.

**Steps:**
1. Context7 research: `resolve-library-id` → `query-docs` with topic "scene tree node types signals resources state machine"
2. Extract: node type decision guide, scene composition patterns, signal patterns, resource patterns, state machine patterns, feature pattern index
3. Write to `.claude/research/architecture-baseline.md`

Used by /game:define skill to avoid duplicate research.

### Step 15: Configure Code Formatter (PostToolUse Hook)

Auto-format code after every Write/Edit using the best formatter for the stack.

**Formatter per stack:**

| Tech Stack | Formatter | Command | Install |
|------------|-----------|---------|---------|
| React, Vue, Angular, Svelte, Next.js, Nuxt, Astro, Node.js | Prettier | `npx prettier --write` | `npm install -D prettier` |
| Laravel, PHP | Pint | `./vendor/bin/pint` | `composer require laravel/pint --dev` |
| Django, FastAPI, Python | Black | `black` | `pip install black` |
| Rust, Bevy | rustfmt | `rustfmt` | Included |
| Go | gofmt | `gofmt -w` | Included |
| Unity, .NET, WPF | dotnet format | `dotnet format --include` | Included |
| Godot | gdformat | `gdformat` | `pip install gdtoolkit` |
| Unreal, C/C++ | clang-format | `clang-format -i` | System package |
| Flutter, Dart | dart format | `dart format` | Included |

**Steps:**
1. Create `.claude/hooks/format-on-save.cjs` — Node.js script that reads stdin JSON, extracts file path, checks extension, runs formatter. Use `.cjs` to avoid ES Module issues.
2. Install formatter if needed
3. Add PostToolUse hook to `.claude/settings.local.json`:
   ```json
   {
     "hooks": {
       "PostToolUse": [{
         "matcher": "Write|Edit",
         "hooks": [{ "type": "command", "command": "node .claude/hooks/format-on-save.cjs" }]
       }]
     }
   }
   ```
