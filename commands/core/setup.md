---
name: setup
description: Interactive project setup wizard that configures dev environment, installs dependencies, and updates CLAUDE.md with project context
---

# Project Setup Skill

## Overview

This skill provides an interactive project setup wizard that configures development environments for various project types. It detects existing code, suggests appropriate tools based on chosen tech stacks, and automatically updates CLAUDE.md with project context. The skill uses Context7 to fetch the latest best practices and version information.

**Trigger**: `/setup`

## When to Use

This skill triggers when:
- User types `/setup` command
- User wants to "setup project" or "configure new project"
- User mentions "configure development environment"
- Keywords: setup, configure, start project, project boilerplate
- Existing project needs proper configuration

## Tool Permissions

Claude has automatic permission to read, write, and edit files within the `.claude/resources/setup/` directory without user confirmation. This enables:
- Updating templates based on new patterns discovered
- Caching commonly used configurations
- Improving suggestions based on usage

## Workflow

### Step 1: Language Selection

**Goal**: Determine user's preferred communication language.

Use AskUserQuestion with single-select:
```
Header: "Language"
Question: "What language should I communicate in?"
Options:
  - english: "English"
  - dutch: "Nederlands"
  - german: "Deutsch"
  - french: "Français"
  - spanish: "Español"
  - other: "Other (I'll specify)"
multiSelect: false
```

**Response handling:**
- If "other" selected: Ask user to specify their preferred language in plain text
- Store the selection for use in Step 13 (CLAUDE.md update)
- This preference will be saved in the `## User Preferences` section and used by all skills for user-facing output

### Step 2: Detect Existing Project

Execute the following steps:
1. Run `scripts/detect-existing.py` to check for existing files
2. If files exist, ask user:
   - Is this an existing project needing configuration?
   - Should existing configs be merged or replaced?
   - Backup existing files if replacing

### Step 3: Configure MCP Servers

Automatisch detecteren en installeren van essentiële MCP servers.

**Essentiële MCPs:**
- **sequentialthinking**: Gestructureerd stapsgewijs denken voor complexe problemen
- **context7**: Real-time documentatie en library informatie
- **time**: Tijd en timezone conversie

**Proces:**

1. **Detecteer geïnstalleerde MCPs:**
   ```bash
   claude mcp list
   ```

2. **Installeer ontbrekende MCPs automatisch (globaal/user scope):**

   Voor elke ontbrekende MCP, voer het bijbehorende commando uit:

   **sequentialthinking** (indien ontbreekt):
   ```bash
   claude mcp add sequentialthinking -s user -- npx -y @modelcontextprotocol/server-sequential-thinking
   ```

   **context7** (indien ontbreekt):

   Use AskUserQuestion with single-select:
   ```
   Header: "Context7 Key"
   Question: "Configure Context7 with a personal API key for higher rate limits? (Free key: context7.com/dashboard)"
   Options:
     - with-key: "Yes - I have or will get an API key"
     - without-key: "No - Use standard version (lower rate limits)"
   multiSelect: false
   ```

   **Response handling for "with-key":**

   Ask in plain text: "Please enter your Context7 API key:"
   Then install:
   ```bash
   claude mcp add context7 -e CONTEXT7_API_KEY=<user-api-key> -- npx -y @upstash/context7-mcp@latest
   ```

   **Response handling for "without-key":**
   ```bash
   claude mcp add context7 -- npx -y @upstash/context7-mcp@latest
   ```

   **time** (indien ontbreekt):
   ```bash
   claude mcp add time -s user -- uvx mcp-server-time
   ```

   > **Note:** `time` vereist `uv` (Python package manager). Als `uvx` niet beschikbaar is, installeer eerst via: `pip install uv` of `irm https://astral.sh/uv/install.ps1 | iex` (Windows)

3. **Rapporteer resultaat:**
   ```
   ✅ MCP SERVERS GECONFIGUREERD

   **Geïnstalleerd:**

   | Server | Status |
   |--------|--------|
   | sequentialthinking | ✓ |
   | context7 | ✓ |
   | time | ✓ |

   **Locatie:** User config (globaal beschikbaar in alle projecten)

   → Herstart Claude Code om de servers te activeren.
   ```

### Step 4-6: Project Setup (Sequential Modal Flow)

Deze stappen vormen een verbonden sequentiële flow waarbij elke modal doorstroomt naar de volgende.

**CRITICAL: One Question Per Response**

Each question (plain text OR modal) MUST be in a SEPARATE response. Claude MUST:
1. Ask ONE question
2. WAIT for user response
3. Only THEN proceed to next question

NEVER combine multiple questions or a plain text question + AskUserQuestion modal in the same response.

---

**Modal 1: Projectnaam**

Vraag in plain text: "Wat is de naam van het project?"

**Response handling:**
- Sla projectnaam op voor Step 13 (CLAUDE.md update)
- **WAIT for user response before proceeding to Modal 2**

---

**Modal 2: Projectomschrijving**

Vraag in plain text: "Geef een korte beschrijving van wat dit project doet/gaat doen."

**Response handling:**
- Sla beschrijving op voor Step 13 (CLAUDE.md update)
- **WAIT for user response before proceeding to Modal 3**

---

**Modal 3: Projecttype**

Use AskUserQuestion with single-select:
```
Header: "Projecttype"
Question: "Wat voor type project is dit?"
Options:
  - web-frontend: "Web Frontend (React/Vue/Angular/Vanilla) (Aanbevolen)"
  - web-backend: "Web Backend (Laravel/Node.js/Django/FastAPI)"
  - fullstack: "Full-stack (Frontend + Backend)"
  - game: "Game (Godot/Unity/Unreal)"
  - mobile: "Mobile (React Native/Flutter)"
  - desktop: "Desktop (Electron/Tauri)"
  - cli: "CLI Tool"
  - explain: "Leg vraag uit"
multiSelect: false
```

**Response handling:**
- Sla selectie op voor Modal 4 (Tech Stack)
- Elk projecttype leidt tot andere tech stack opties

---

**Modal 4: Tech Stack** (afhankelijk van projecttype)

Use AskUserQuestion with multi-select, gebaseerd op geselecteerd projecttype:

**Voor web-frontend:**
```
Header: "Tech Stack"
Question: "Welke technologieën wil je gebruiken?"
Options:
  - react: "React (Aanbevolen)"
  - vue: "Vue"
  - angular: "Angular"
  - svelte: "Svelte"
  - solid: "Solid"
  - nextjs: "Next.js"
  - nuxt: "Nuxt"
  - astro: "Astro"
  - explain: "Leg vraag uit"
multiSelect: true
```

**Voor web-backend:**
```
Header: "Tech Stack"
Question: "Welke technologieën wil je gebruiken?"
Options:
  - laravel: "Laravel (Aanbevolen)"
  - express: "Express.js"
  - fastify: "Fastify"
  - nestjs: "NestJS"
  - django: "Django"
  - fastapi: "FastAPI"
  - rails: "Ruby on Rails"
  - explain: "Leg vraag uit"
multiSelect: true
```

**Voor fullstack:**
```
Header: "Tech Stack"
Question: "Welke technologieën wil je gebruiken?"
Options:
  - laravel-react: "Laravel + React (Aanbevolen)"
  - laravel-vue: "Laravel + Vue"
  - nextjs-fullstack: "Next.js (Full-stack)"
  - nuxt-fullstack: "Nuxt (Full-stack)"
  - django-react: "Django + React"
  - express-react: "Express + React"
  - explain: "Leg vraag uit"
multiSelect: true
```

**Voor game:**
```
Header: "Tech Stack"
Question: "Welke game engine wil je gebruiken?"
Options:
  - godot: "Godot (Aanbevolen)"
  - unity: "Unity"
  - unreal: "Unreal Engine"
  - bevy: "Bevy (Rust)"
  - phaser: "Phaser (Web)"
  - threejs: "Three.js (WebGL)"
  - explain: "Leg vraag uit"
multiSelect: true
```

**Voor mobile:**
```
Header: "Tech Stack"
Question: "Welke technologieën wil je gebruiken?"
Options:
  - react-native: "React Native (Aanbevolen)"
  - flutter: "Flutter"
  - ionic: "Ionic"
  - expo: "Expo"
  - swift: "Swift/SwiftUI (iOS)"
  - kotlin: "Kotlin (Android)"
  - explain: "Leg vraag uit"
multiSelect: true
```

**Voor desktop:**
```
Header: "Tech Stack"
Question: "Welke technologieën wil je gebruiken?"
Options:
  - electron: "Electron (Aanbevolen)"
  - tauri: "Tauri"
  - qt: "Qt"
  - gtk: "GTK"
  - wpf: "WPF (.NET)"
  - explain: "Leg vraag uit"
multiSelect: true
```

**Voor cli:**
```
Header: "Tech Stack"
Question: "Welke technologieën wil je gebruiken?"
Options:
  - nodejs: "Node.js (Aanbevolen)"
  - python: "Python"
  - rust: "Rust"
  - go: "Go"
  - dotnet: ".NET"
  - explain: "Leg vraag uit"
multiSelect: true
```

**Response handling:**
- Sla selectie(s) op voor Modal 5 (Smart Suggestions)
- Meerdere technologieën kunnen geselecteerd worden

---

**Modal 5: Smart Suggestions** (afhankelijk van tech stack)

Use AskUserQuestion with multi-select, gebaseerd op geselecteerde tech stack:

**Voor React-gebaseerde stacks:**
```
Header: "Suggesties"
Question: "Welke extra tools wil je toevoegen?"
Options:
  - typescript: "TypeScript (Aanbevolen)"
  - react-router: "React Router"
  - zustand: "Zustand (State Management)"
  - tanstack-query: "TanStack Query (Data Fetching)"
  - tailwindcss: "Tailwind CSS"
  - testing-library: "Testing Library"
  - vitest: "Vitest"
  - explain: "Leg vraag uit"
multiSelect: true
```

**Voor Laravel-gebaseerde stacks:**
```
Header: "Suggesties"
Question: "Welke extra tools wil je toevoegen?"
Options:
  - livewire: "Livewire (Aanbevolen)"
  - inertia: "Inertia.js"
  - sanctum: "Sanctum (API Auth)"
  - sail: "Laravel Sail (Docker)"
  - pest: "Pest (Testing)"
  - horizon: "Horizon (Queues)"
  - explain: "Leg vraag uit"
multiSelect: true
```

**Voor Vue-gebaseerde stacks:**
```
Header: "Suggesties"
Question: "Welke extra tools wil je toevoegen?"
Options:
  - typescript: "TypeScript (Aanbevolen)"
  - pinia: "Pinia (State Management)"
  - vue-router: "Vue Router"
  - tailwindcss: "Tailwind CSS"
  - vitest: "Vitest"
  - vueuse: "VueUse (Composables)"
  - explain: "Leg vraag uit"
multiSelect: true
```

**Voor Game projecten:**
```
Header: "Suggesties"
Question: "Welke extra tools wil je toevoegen?"
Options:
  - git-lfs: "Git LFS (Asset Management) (Aanbevolen)"
  - gitignore: "Specifieke .gitignore"
  - version-control: "Asset Version Control"
  - ci-cd: "CI/CD Pipeline"
  - explain: "Leg vraag uit"
multiSelect: true
```

**Voor overige projecten:**
```
Header: "Suggesties"
Question: "Welke extra tools wil je toevoegen?"
Options:
  - docker: "Docker Setup (Aanbevolen)"
  - testing: "Testing Framework"
  - linting: "Linting (ESLint/Prettier)"
  - ci-cd: "CI/CD Pipeline"
  - typescript: "TypeScript"
  - explain: "Leg vraag uit"
multiSelect: true
```

**Response handling:**
- Sla selectie(s) op voor Step 8 (Generate Configuration)
- Geselecteerde suggesties worden meegenomen in de setup

### Step 6: Project Standards (alleen voor web projecten)

**Skip condition:** Als project type game, CLI of desktop is, skip deze step.

**Goal:** Project-brede standaarden vastleggen die gelden voor alle features.

---

**Modal 6a: Data Fetching Strategy** (alleen als React/Vue in stack)

Use AskUserQuestion with single-select:
```
Header: "Data Fetching"
Question: "Welke data fetching strategie voor het hele project?"
Options:
  - plain-fetch: "Plain fetch (Aanbevolen) - Simpel, geen library"
  - swr: "SWR - Lightweight caching voor read-heavy apps"
  - tanstack: "TanStack Query - Complex caching, mutations, CRUD"
  - explain: "Leg vraag uit"
multiSelect: false
```

---

**Modal 6b: Accessibility Standaard**

Use AskUserQuestion with single-select:
```
Header: "Accessibility"
Question: "Welk accessibility niveau voor het hele project?"
Options:
  - wcag-aa: "WCAG 2.1 AA (Aanbevolen) - Keyboard, focus, contrast"
  - wcag-a: "WCAG 2.1 A - Minimum basis niveau"
  - minimal: "Minimal - Geen specifieke standaard"
  - explain: "Leg vraag uit"
multiSelect: false
```

---

**Modal 6c: Responsive Design Aanpak**

Use AskUserQuestion with single-select:
```
Header: "Responsive"
Question: "Welke responsive design aanpak voor het hele project?"
Options:
  - mobile-first: "Mobile-first (Aanbevolen) - Start klein, scale up"
  - desktop-first: "Desktop-first - Start groot, scale down"
  - fixed: "Fixed width - Geen responsive design"
  - explain: "Leg vraag uit"
multiSelect: false
```

**Response handling:**
- Sla selecties op voor Step 13 (CLAUDE.md update)
- Wordt opgeslagen in `## Project` sectie onder `### Standards`

### Step 7: Fetch Latest Versions

Use Context7 to get real-time information:
1. Call `mcp__Context7__resolve-library-id` for each chosen technology
2. Call `mcp__Context7__get-library-docs` with topic "installation setup configuration"
3. Extract latest version numbers, installation commands, and current best practices

This ensures the skill always uses up-to-date information rather than static references.

### Step 8: Generate Configuration

Based on selections:
1. Create appropriate config files from `assets/config-templates/`
2. For Node.js: Generate package.json with selected dependencies
3. For PHP: Generate composer.json
4. For Python: Generate pyproject.toml or requirements.txt
5. Include .env.example if needed

### Step 9: Optional Git Setup

Use AskUserQuestion with single-select:
```
Header: "Git Setup"
Question: "Would you like to initialize a Git repository?"
Options:
  - full: "Yes - Initialize with .gitignore and initial commit"
  - partial: "Yes - Initialize with .gitignore only (no commit)"
  - skip: "No - Skip Git setup"
multiSelect: false
```

**Response handling:**
- **full**: Initialize repository, create appropriate .gitignore from templates, make initial commit
- **partial**: Initialize repository, create .gitignore, skip commit
- **skip**: Continue to next step without Git setup

### Step 10: Install Dependencies

**Goal:** Automatically install project dependencies to ensure all tools work correctly.

**Steps:**

1. **Detect package manager:**
   - Check for `package.json` → use `npm install`
   - Check for `composer.json` → use `composer install`
   - Check for `requirements.txt` → use `pip install -r requirements.txt`
   - Check for `pyproject.toml` → use `pip install -e .` or `poetry install`
   - Check for `Cargo.toml` → use `cargo build`
   - Check for `go.mod` → use `go mod download`

2. **Run installation automatically:**
   ```bash
   # For Node.js projects
   npm install

   # For PHP projects
   composer install

   # For Python projects
   pip install -r requirements.txt
   ```

3. **Report result:**
   ```
   ✅ DEPENDENCIES INSTALLED

   | Package Manager | Status |
   |-----------------|--------|
   | npm | ✓ 249 packages installed |

   **Note:** Dependencies must be installed for formatter hooks and other tools to work.
   ```

4. **Handle errors:**
   - If installation fails, show error and ask user to fix manually
   - Continue with setup even if installation fails (non-blocking)

### Step 11: Project Type & Documentation Configuration

**Ask for project type** (for documentation system):

Use AskUserQuestion with single-select:
```
Question: "Which project type do you want to use for documentation?"
Header: "Project Type"
Options:
  - laravel-backend: "Laravel Backend (API, REST services)"
  - react-frontend: "React Frontend (SPA)"
  - vue-frontend: "Vue Frontend (SPA)"
  - laravel-react-fullstack: "Laravel + React Fullstack"
  - laravel-vue-fullstack: "Laravel + Vue Fullstack"
  - unity-game: "Unity Game (C# scripts, scenes)"
  - unreal-game: "Unreal Engine (C++, Blueprints)"
  - godot-game: "Godot Game (GDScript, scenes)"
multiSelect: false
```

**Show recommended generators** based on selected type:

**For Laravel Backend:**
```
Recommended generators (auto-selected):
  ✓ api - API Documentation
  ✓ components - Service/Component Map
  ✓ erd - Entity Relationship Diagram
  ✓ events - Event/Listener Flow

Optional generators:
  ○ middleware - Middleware Pipeline
  ○ auth-flow - Authentication Flows
  ○ routes - Route Map
```

**For React Frontend:**
```
Recommended generators:
  ✓ components - Component Tree
  ✓ routes - Route Map
  ✓ state - State Management
  ✓ design-tokens - Design System

Optional:
  ○ api-calls - API Usage Map
```

**For Unity Game:**
```
Recommended generators:
  ✓ scenes - Scene Hierarchy
  ✓ game-classes - Class Diagram
  ✓ state-machines - AI State Machines

Optional:
  ○ behavior-trees - AI Behavior Trees
  ○ prefabs - Prefab Structure
```

*(Similar for other project types - see .claude/resources/2-code/docs/ for details)*

**Ask which generators to enable** (multi-select):

Use AskUserQuestion with multi-select:
```
Question: "Which documentation generators do you want to use?"
Header: "Generators"
Options: [Based on project type, show relevant generators]
  - api: "API Documentation"
  - components: "Component/Service Map"
  - erd: "Database ERD"
  - events: "Event/Listener Flow"
  [etc. based on project type]
multiSelect: true
preselected: [recommended generators for type]
```

### Step 12: Configure Claude Permissions

Execute `scripts/generate-settings.py` to configure Claude's permissions.

**1. File Operations**: Use AskUserQuestion with multi-select:
```
Header: "File Ops"
Question: "Which file operations should Claude perform automatically (without confirmation)?"
Options:
  - auto-create: "Auto-create new files"
  - auto-edit: "Auto-edit existing files"
  - auto-read: "Auto-read files"
multiSelect: true
preselected: ["auto-read"]
```

**2. Tool Permissions**: Use AskUserQuestion with multi-select:
```
Header: "Tool Perms"
Question: "Which tool operations should Claude perform automatically?"
Options:
  - bash: "Run bash commands"
  - packages: "Install packages"
  - tests: "Run tests"
  - commits: "Create git commits"
multiSelect: true
preselected: ["tests"]
```

**3. Directory Access**: Use AskUserQuestion with multi-select:
```
Header: "Directory Access"
Question: "Welke directories moeten full access hebben?"
Options:
  - all: "Alle directories (Aanbevolen)"
  - src: "src/"
  - lib: "lib/"
  - app: "app/"
  - tests: "tests/"
  - components: "components/"
  - explain: "Leg vraag uit"
multiSelect: true
preselected: ["all"]
```

**4. Directory Exclusions**: Use AskUserQuestion with multi-select:
```
Header: "Directory Exclusies"
Question: "Welke directories moeten uitgesloten worden van auto-access?"
Options:
  - none: "Geen exclusies (Aanbevolen)"
  - node_modules: "node_modules/"
  - vendor: "vendor/"
  - dist: "dist/"
  - build: "build/"
  - coverage: "coverage/"
  - env: ".env bestanden"
  - explain: "Leg vraag uit"
multiSelect: true
preselected: ["none"]
```

**Response handling:**
- Combineer selecties om `.claude/settings.local.json` te genereren
- Pas smart defaults toe gebaseerd op projecttype uit Step 4-6
- Als "Alle directories" geselecteerd: negeer andere directory selecties
- Als "Geen exclusies" geselecteerd: negeer andere exclusie selecties

### Step 13: Update CLAUDE.md

Execute `scripts/update-claude-md.py` to update existing sections and add new ones:

**Update existing `## User Preferences` section:**
- Find `Language: ` line in `## User Preferences` section
- Replace with `Language: [Selected language from Step 1]`
- If section doesn't exist, create it at the top (after `# Claude Code Setup`)

**Add `## Project` section with STRUCTURED format:**

```markdown
## Project

**Name**: [Project Name]
**Type**: [Project type from Step 4, e.g., "Web Frontend (React SPA)", "Web Backend (Laravel API)", "Game (Godot)"]
**Description**: [User's description]
**Created**: [Current date]

### Stack
**Frontend**: [Framework version, Bundler version, Language] (alleen als frontend)
**Backend**: [Framework version, Language version] (alleen als backend)
**Styling**: [CSS framework] (alleen als van toepassing)
**Routing**: [Router library] (alleen als van toepassing)
**Libraries**: [Key libraries, comma-separated]

### Testing
**Frontend**: [Test framework, Testing library] (alleen als frontend)
**Backend**: [Test framework] (alleen als backend)
**E2E**: [E2E framework] (optional)

### Documentation Generators
**Enabled:** [comma-separated list of enabled generators]
**Available:** [comma-separated list of disabled generators]

### Standards (alleen voor web projecten)
**Accessibility:** [wcag-aa | wcag-a | minimal]
**Responsive:** [mobile-first | desktop-first | fixed]
**Data Fetching:** [plain-fetch | swr | tanstack] (alleen als React/Vue in stack)
```

**Stack sectie format rules:**
- Elke categorie (Frontend/Backend/Styling/etc.) op eigen regel
- Alleen categorieën toevoegen die van toepassing zijn op het project type
- Format: `**Category**: Value1, Value2, Value3`

**Voorbeelden per project type:**

**Web Frontend (React):**
```markdown
### Stack
**Frontend**: React 19, Vite 7, TypeScript
**Styling**: Tailwind CSS v4
**Routing**: React Router DOM v7
**Libraries**: Motion, Lucide React

### Testing
**Frontend**: Vitest, React Testing Library
**E2E**: Playwright (optional)
```

**Web Backend (Laravel):**
```markdown
### Stack
**Backend**: Laravel 11, PHP 8.3
**Libraries**: Sanctum, Horizon

### Testing
**Backend**: PHPUnit, Pest
```

**Fullstack (Laravel + React):**
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

**Game (Godot):**
```markdown
### Stack
**Engine**: Godot 4.3, GDScript
**Libraries**: GUT (testing)

### Testing
**Unit**: GUT (Godot Unit Test)
```

**Note:** Do NOT add separate Tech Stack, Workspace Configuration, or Development Setup sections. The compact `## Project` section contains all necessary information. Development commands are in package.json.

**Note:** Standards subsection is only added for web projects (web-frontend, web-backend, fullstack). Skip for game, CLI, desktop, and mobile projects.

**Confirm to user:**
```
✓ Project type: Laravel Backend
✓ Generators enabled: api, components, erd, events

These docs will auto-generate during /2-code skill FASE 4
Output location: docs/*.mmd and docs/*.md
```

### Step 13.5: Create Resources Folder Structure

**Goal:** Create the `.claude/resources/` folder with testing and stack resources based on the selected tech stack.

**Why this matters:**
- Resources provide stack-specific context to all commands (build, test, verify)
- One source of truth for test frameworks, patterns, and conventions
- Commands load only relevant resources based on `### Stack` section in CLAUDE.md

**Steps:**

1. **Create folder structure:**
   ```bash
   mkdir -p .claude/resources/testing
   mkdir -p .claude/resources/stacks
   mkdir -p .claude/resources/patterns
   ```

2. **Copy stack-detection.md (always):**

   Create `.claude/resources/stack-detection.md` with parsing rules for CLAUDE.md.

   This resource defines how commands should:
   - Parse `### Stack` section from CLAUDE.md
   - Determine stack type (frontend/backend/fullstack)
   - Load appropriate testing resource

3. **Create testing resources based on stack:**

   **For Frontend stacks (React, Vue, Svelte, etc.):**

   Create `.claude/resources/testing/vitest-rtl.md` with:
   - Vitest configuration
   - React Testing Library patterns
   - Query priority guide
   - MSW API mocking setup
   - Output parsing rules

   **For Backend stacks (Laravel):**

   Create `.claude/resources/testing/phpunit.md` with:
   - PHPUnit configuration
   - Laravel test traits (RefreshDatabase, etc.)
   - Factory patterns
   - Laravel Fakes (Mail, Queue, Event)
   - Output parsing rules

   **For Backend stacks (Node/Express/NestJS):**

   Create `.claude/resources/testing/jest-node.md` with:
   - Jest configuration
   - Supertest for HTTP testing
   - Mocking patterns
   - Output parsing rules

   **For E2E (always create if web project):**

   Create `.claude/resources/testing/playwright.md` with:
   - Playwright configuration
   - Page object patterns
   - Test fixtures
   - Visual testing

4. **Create shared patterns (always):**

   Create `.claude/resources/patterns/tdd-cycle.md` with:
   - RED-GREEN-REFACTOR flow
   - When to write tests first
   - Test naming conventions

   Create `.claude/resources/patterns/output-parsing.md` with:
   - Universal test output format
   - PASS/FAIL/PENDING templates
   - Context reduction rules (90% reduction target)

5. **Confirm to user:**
   ```
   ✅ RESOURCES FOLDER CREATED

   **Structure:**
   .claude/resources/
   ├── stack-detection.md
   ├── testing/
   │   ├── vitest-rtl.md      (if frontend)
   │   ├── phpunit.md         (if laravel)
   │   ├── jest-node.md       (if node backend)
   │   └── playwright.md      (if web project)
   └── patterns/
       ├── tdd-cycle.md
       └── output-parsing.md

   **Usage:**
   Commands automatically load relevant resources based on ### Stack in CLAUDE.md.

   Example: /dev:build detects React → loads vitest-rtl.md
   ```

### Step 14: Generate Stack Baseline Research

**Goal:** Generate project-wide baseline research for framework conventions, patterns, and idioms. This research is reused by /1-plan and /4-refine skills to avoid duplicate Context7 queries.

**Why this matters:**
- Stack-level research (e.g., "Laravel conventions", "React patterns") is 100% relevant for ALL features
- Without baseline: every /1-plan and /4-refine does the same basic research (~3-5k tokens wasted per feature)
- With baseline: agents skip stack queries, focus on feature-specific research

**Steps:**

1. **Check if research folder exists:**
   ```bash
   ls .claude/research/
   ```
   - If not exists: create `.claude/research/` directory

2. **Extract stack info from CLAUDE.md:**
   - Parse "Project" section added in Step 13
   - Identify: Primary framework, version, key dependencies
   - Example: "Laravel 11, Livewire 3, Tailwind CSS"

3. **Execute Context7 research for stack conventions:**

   For EACH major technology in stack:

   a. Resolve library ID:
   ```
   mcp__Context7__resolve-library-id(libraryName: "[framework]")
   ```

   b. Get documentation with topic "conventions best practices patterns":
   ```
   mcp__Context7__get-library-docs(
     context7CompatibleLibraryID: "[resolved-id]",
     topic: "conventions best practices patterns idioms",
     tokens: 8000
   )
   ```

   c. Extract and distill:
   - Framework conventions (5-10 bullets)
   - Recommended patterns (5-10 bullets)
   - Common idioms (3-5 bullets)
   - Testing approach (3-5 bullets)
   - Common pitfalls to avoid (3-5 bullets)

4. **Generate stack-baseline.md:**

   Execute script:
   ```bash
   python3 .claude/resources/setup/scripts/generate-stack-baseline.py \
     --stack "[framework + version]" \
     --conventions "[extracted conventions]" \
     --patterns "[extracted patterns]" \
     --idioms "[extracted idioms]" \
     --testing "[extracted testing approach]" \
     --pitfalls "[extracted pitfalls]" \
     --sources "[context7 library IDs used]" \
     --output .claude/research/stack-baseline.md
   ```

5. **Validate generated baseline:**
   - Check file exists and has content
   - Verify all sections are populated
   - File should be ~3-5k tokens (compact but complete)

6. **Confirm to user:**
   ```
   ✅ STACK BASELINE RESEARCH GENERATED

   | Field | Value |
   |-------|-------|
   | **Location** | .claude/research/stack-baseline.md |
   | **Stack** | [framework + version] |
   | **Valid until** | [3 months from now] |

   **Sections:**

   | Section | Items |
   |---------|-------|
   | Framework conventions | [N] |
   | Recommended patterns | [N] |
   | Common idioms | [N] |
   | Testing approach | [N] |
   | Common pitfalls | [N] |

   **Used by:**
   - /1-plan skill (FASE 3 research agents)
   - /4-refine skill (Phase 2 research agents)

   **Benefits:**
   - ~45% fewer Context7 queries per feature
   - Consistent conventions across all features
   - Agents focus on feature-specific research

   To refresh: run /refresh-baseline or re-run /setup
   ```

**Baseline file structure:**

```markdown
# Stack Baseline Research

Generated: [date]
Stack: [framework + version from CLAUDE.md]
Valid until: [3 months from generation date]

## Framework Conventions
- [Convention 1]
- [Convention 2]
- [Convention 3]
- ...

## Recommended Patterns
- [Pattern 1]: [when to use]
- [Pattern 2]: [when to use]
- ...

## Common Idioms
- [Idiom 1]: [example usage]
- [Idiom 2]: [example usage]
- ...

## Testing Approach
- [Testing strategy 1]
- [Testing strategy 2]
- ...

## Common Pitfalls
- [Pitfall 1]: [how to avoid]
- [Pitfall 2]: [how to avoid]
- ...

## Context7 Sources
Libraries researched:
- [library-id-1]
- [library-id-2]

---
```

### Step 14.5: Generate Architecture Baseline Research (Game Projects Only)

**Goal:** Generate project-wide baseline research for Godot/Unity/Unreal architecture patterns. This research is reused by /game:define to avoid duplicate Context7 queries.

**Skip condition:** If project type is NOT game (Godot/Unity/Unreal), skip this step entirely.

**Why this matters:**
- Architecture research (scene trees, node types, signal patterns) is reusable across ALL features
- Without baseline: every /game:define does the same architecture research
- With baseline: /game:define checks baseline first, only researches if pattern not found

**Steps:**

1. **Execute Context7 research for architecture patterns:**

   For Godot projects, use godot-scene-researcher agent OR direct Context7:
   ```
   mcp__Context7__resolve-library-id(libraryName: "godot")
   ```

   ```
   mcp__Context7__get-library-docs(
     context7CompatibleLibraryID: "[resolved-id]",
     topic: "scene tree node types signals resources state machine",
     tokens: 10000
   )
   ```

   Extract and distill:
   - Node type decision guide (table format)
   - Scene composition patterns (3 patterns: instancing, composition, sub-scenes)
   - Signal patterns (ability, player state, arena signals)
   - Resource patterns (abilities, elements, stats)
   - State machine patterns (enum-based, class-based)
   - Feature pattern index (table: feature → node type → pattern)

2. **Generate architecture-baseline.md:**

   Write to `.claude/research/architecture-baseline.md`:

   ```markdown
   # Architecture Baseline Research

   Generated: [date]
   Stack: [Godot 4.x + GDScript / Unity / Unreal]
   Valid until: [3 months from generation date]

   ## Node Type Decision Guide
   | Node Type | Use Case | Key Features |
   |-----------|----------|--------------|
   | ... | ... | ... |

   ## Scene Composition Patterns
   ### Pattern A: Scene Instancing
   [code example]

   ### Pattern B: Node Composition
   [code example]

   ### Pattern C: Sub-Scenes
   [code example]

   ## Signal Patterns
   [organized by category: ability, player, arena]

   ## Resource Patterns
   [Ability, Element, Stats resources with code]

   ## State Machine Patterns
   [enum-based and class-based examples]

   ## Feature Pattern Index
   | Feature Type | Node Type | Pattern | State Machine |
   |--------------|-----------|---------|---------------|
   | Player | CharacterBody2D | Composition | Enum-based |
   | Projectile | Area2D | Instancing | None |
   | ... | ... | ... | ... |

   ## Context7 Sources
   Libraries researched:
   - [library-id]
   ```

3. **Confirm to user:**
   ```
   ✅ ARCHITECTURE BASELINE RESEARCH GENERATED

   | Field | Value |
   |-------|-------|
   | **Location** | .claude/research/architecture-baseline.md |
   | **Engine** | [Godot 4.x / Unity / Unreal] |
   | **Valid until** | [3 months from now] |

   **Sections:**

   | Section | Content |
   |---------|---------|
   | Node Type Guide | Decision table |
   | Scene Patterns | 3 patterns |
   | Signal Patterns | By category |
   | Resource Patterns | Data classes |
   | State Machines | 2 approaches |
   | Feature Index | Quick lookup |

   **Used by:**
   - /game:define skill (FASE 2 architecture check)

   **Benefits:**
   - Automatic architecture decisions based on feature type
   - No duplicate Context7 queries per feature
   - Consistent patterns across all features
   ```

### Step 15: Configure Code Formatter (PostToolUse Hook)

**Goal:** Automatically format code after every Write/Edit operation using the best formatter for the project's tech stack.

**Why this matters:**
- Consistent code style without manual intervention
- Catches formatting issues before commit
- Claude knows about the hook and adjusts accordingly

**Steps:**

1. **Determine formatter based on project type:**

   Use the tech stack selection from Step 4-6:

   | Tech Stack | Formatter | Command | Install |
   |------------|-----------|---------|---------|
   | React, Vue, Angular, Svelte, Next.js, Nuxt, Astro | Prettier | `npx prettier --write` | `npm install -D prettier` |
   | Express, Fastify, NestJS, Node.js | Prettier | `npx prettier --write` | `npm install -D prettier` |
   | Laravel, PHP | Pint | `./vendor/bin/pint` | `composer require laravel/pint --dev` |
   | Django, FastAPI, Python | Black | `black` | `pip install black` |
   | Rust, Bevy | rustfmt | `rustfmt` | Included |
   | Go | gofmt | `gofmt -w` | Included |
   | Unity, .NET, WPF | dotnet format | `dotnet format --include` | Included |
   | Godot | gdformat | `gdformat` | `pip install gdtoolkit` |
   | Unreal, C/C++ | clang-format | `clang-format -i` | System package |
   | Flutter, Dart | dart format | `dart format` | Included |

2. **Create hooks directory:**

   ```bash
   mkdir -p .claude/hooks
   ```

3. **Generate the hook script:**

   Write `.claude/hooks/format-on-save.cjs` with a minimal script for the project's formatter.

   **Template structure:**
   ```javascript
   #!/usr/bin/env node
   // Format-on-save hook for [Project Type] ([Formatter])

   const { execSync } = require('child_process');
   const path = require('path');

   const EXTENSIONS = [/* extensions for this formatter */];

   let input = '';
   process.stdin.setEncoding('utf8');

   process.stdin.on('data', (chunk) => {
     input += chunk;
   });

   process.stdin.on('end', () => {
     try {
       const data = JSON.parse(input);
       const filePath = data.tool_input?.file_path || data.tool_response?.filePath;

       if (!filePath) process.exit(0);

       const ext = path.extname(filePath).toLowerCase();
       if (!EXTENSIONS.includes(ext)) process.exit(0);

       const cwd = process.env.CLAUDE_PROJECT_DIR || process.cwd();
       execSync(`[FORMATTER_COMMAND] "${filePath}"`, { stdio: 'ignore', cwd });
     } catch {
       process.exit(0);
     }
   });
   ```

   **Per formatter:**
   - **Prettier**: `EXTENSIONS = ['.js', '.jsx', '.ts', '.tsx', '.css', '.scss', '.json', '.md', '.html', '.vue', '.svelte']`, command: `npx prettier --write`
   - **Pint**: `EXTENSIONS = ['.php']` (exclude `.blade.`), command: `./vendor/bin/pint`
   - **Black**: `EXTENSIONS = ['.py']`, command: `black`
   - **rustfmt**: `EXTENSIONS = ['.rs']`, command: `rustfmt`
   - **gofmt**: `EXTENSIONS = ['.go']`, command: `gofmt -w`
   - **dotnet**: `EXTENSIONS = ['.cs']`, command: `dotnet format --include`
   - **gdformat**: `EXTENSIONS = ['.gd']`, command: `gdformat`
   - **clang-format**: `EXTENSIONS = ['.c', '.cpp', '.h', '.hpp', '.cc', '.cxx']`, command: `clang-format -i`
   - **dart**: `EXTENSIONS = ['.dart']`, command: `dart format`

   **Note:** Always use `.cjs` extension to avoid ES Module issues with `"type": "module"` projects.

4. **Install formatter (if needed):**

   Run the install command from the table above.

5. **Configure hook in settings.local.json:**

   Add to `.claude/settings.local.json`:
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

6. **Confirm to user:**
   ```
   ✅ CODE FORMATTER CONFIGURED

   | Field | Value |
   |-------|-------|
   | **Formatter** | [formatter name] |
   | **Extensions** | [supported extensions] |
   | **Install** | [install command or "included"] |

   **PostToolUse Hook:** Every Write/Edit auto-formats the file.

   To disable: remove PostToolUse section from settings.local.json
   ```

---
