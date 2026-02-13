---
name: core-setup
description: Interactive project setup wizard that configures dev environment, installs dependencies, and updates CLAUDE.md. Use with /core-setup for new project initialization.
disable-model-invocation: true
metadata:
  author: mileszeilstra
  version: 1.0.0
  category: core
---

# Project Setup Skill

**Trigger**: `/core-setup`

Interactive wizard that sets up a new or existing project. Collects user decisions, generates project files, configures Claude Code.

**CRITICAL: One question per response.** Never combine multiple questions in one message.

---

## Phase 1: Detect & Configure

1. **Language selection** — AskUserQuestion (single-select):
   - Options: English, Nederlands, Deutsch, Français, Español
   - Store for Phase 6 (CLAUDE.md `## User Preferences`)

2. **Detect existing project** — Run detection script:
   ```bash
   python .claude/skills/core-setup/scripts/detect-existing.py --path .
   ```
   If files found: ask whether to merge or replace existing configs.

3. **MCP servers** — Check and install essentials:
   ```bash
   claude mcp list
   ```

   Install missing (user scope):
   ```bash
   # sequentialthinking
   claude mcp add sequentialthinking -s user -- npx -y @modelcontextprotocol/server-sequential-thinking

   # context7 (ask if user has API key for higher rate limits)
   claude mcp add context7 -- npx -y @upstash/context7-mcp@latest
   # or with key:
   claude mcp add context7 -e CONTEXT7_API_KEY=<key> -- npx -y @upstash/context7-mcp@latest

   # time (requires uv)
   claude mcp add time -s user -- uvx mcp-server-time
   ```

---

## Phase 2: Collect Project Info

Ask sequentially, one question per response:

1. **Project description** — plain text question
2. **Project name** — AskUserQuestion (single-select):
   - "Generate name (Recommended)" — Claude suggests 2-3 short, kebab-case names based on the description
   - "I'll type my own" — follow up with plain text question
3. **Project type** — AskUserQuestion (single-select):
   - Web Frontend, Web Backend, Fullstack, Game, Mobile, Desktop, CLI
4. **Tech stack** — AskUserQuestion (multi-select):
   - Offer relevant frameworks/tools based on project type
   - Claude determines the best options per type
5. **Suggestions** — AskUserQuestion (multi-select):
   - Offer complementary libraries based on chosen stack (TypeScript, testing, state management, styling, etc.)
6. **Web standards** (skip for game/CLI/desktop) — Three single-select questions:
   - Data fetching strategy (if React/Vue): plain fetch, SWR, TanStack Query
   - Accessibility: WCAG 2.1 AA, WCAG 2.1 A, Minimal
   - Responsive: Mobile-first, Desktop-first, Fixed width

---

## Phase 3: Generate Project

1. **Fetch latest versions** via Context7:
   - `resolve-library-id` + `query-docs` for each major technology
   - Extract current version numbers and install commands

2. **Generate project files** — Claude decides which files based on the stack. Common examples:
   - Package manifest (package.json, composer.json, pyproject.toml, Cargo.toml, etc.)
   - Language/framework config (tsconfig.json, next.config.ts, vite.config.ts, etc.)
   - Linting/formatting config (.prettierrc, .eslintrc, biome.json, etc.)
   - CSS config if applicable (postcss.config.mjs, tailwind.config.ts, etc.)
   - `.env.example` with ONLY variables relevant to the chosen stack
   - `.gitignore` appropriate for the stack

3. **Optional: Git init** — AskUserQuestion (single-select):
   - Full (init + .gitignore + commit), Only .gitignore, Skip

---

## Phase 4: Install & Verify

1. **Auto-detect package manager** from lockfile or manifest
2. **Install dependencies** — Run the appropriate install command
3. **Run build** to verify setup compiles cleanly
4. Continue setup even if install/build fails (non-blocking)

---

## Phase 5: Configure Claude

### Documentation Generators

AskUserQuestion (multi-select) — show generators relevant to project type:
- **Web**: components, routes, state, design-tokens, api-calls
- **Backend**: api, components, erd, events, middleware, auth-flow, routes
- **Game**: scenes, game-classes, state-machines, behavior-trees, prefabs

### Permissions

4 sequential AskUserQuestion modals:

1. **File Operations** (multi-select): auto-read, auto-edit, auto-create
2. **Tool Permissions** (multi-select): tests, packages, bash, commits
3. **Directory Access** (single-select): all directories, or select specific
4. **Directory Exclusions** (multi-select): none, node_modules, vendor, dist, build, .env

Write `.claude/settings.local.json` with the `permissions.allow` array format:
```json
{
  "permissions": {
    "allow": [
      "Read *",
      "Edit *",
      "Write *",
      "Bash(npm *)",
      "Bash(npx *)"
    ]
  }
}
```

### Code Formatter (PostToolUse Hook)

Auto-format after every Write/Edit. Create `.claude/hooks/format-on-save.cjs`:
- Node.js script that reads stdin JSON, extracts file path, checks extension, runs formatter
- Use `.cjs` to avoid ES Module issues

Formatter selection per stack:

| Stack | Formatter | Command |
|-------|-----------|---------|
| JS/TS (React, Vue, Next.js, Node, etc.) | Prettier | `npx prettier --write` |
| PHP/Laravel | Pint | `./vendor/bin/pint` |
| Python | Black | `black` |
| Rust | rustfmt | `rustfmt` |
| Go | gofmt | `gofmt -w` |
| C#/.NET | dotnet format | `dotnet format --include` |
| Godot/GDScript | gdformat | `gdformat` |
| C/C++ | clang-format | `clang-format -i` |
| Dart/Flutter | dart format | `dart format` |

Add hook to `settings.local.json`:
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

---

## Phase 6: Update CLAUDE.md

Update `## User Preferences` with language from Phase 1.

Add `## Project` section using this format:

```markdown
## Project

<!-- GENERATED BY /setup - DO NOT EDIT MANUALLY -->

**Name**: [Project Name]
**Type**: [Type (Framework)]
**Description**: [Description]
**Created**: [Date]

### Stack
**Frontend**: [Framework, bundler, language] (if applicable)
**Backend**: [Framework, language] (if applicable)
**Styling**: [CSS framework] (if applicable)
**CMS**: [CMS name] (if applicable)
**Animations**: [Libraries] (if applicable)
**Forms**: [Libraries] (if applicable)
**Email**: [Service] (if applicable)
**Icons**: [Library] (if applicable)
**Fonts**: [Strategy] (if applicable)
**Analytics**: [Services] (if applicable)
**Images**: [Strategy] (if applicable)
**Hosting**: [Platform] (if applicable)

### Testing
**Unit/Component**: [Framework, library]
**E2E**: [Framework]

### Documentation Generators
**Enabled:** [comma-separated]
**Available:** [comma-separated]

### Standards
**Accessibility:** [wcag-aa | wcag-a | minimal]
**Responsive:** [mobile-first | desktop-first | fixed]
**Data Fetching:** [plain-fetch | swr | tanstack]
```

**Rules:**
- Only include categories that apply to the project
- `### Standards` only for web projects
- `### Stack` subcategories are flexible — add what's relevant, omit what's not

---

## Phase 7: Stack Research (optional)

Generate `.claude/research/stack-baseline.md` — reusable framework conventions that avoid duplicate Context7 queries in other skills.

1. For each major technology in the stack, query Context7:
   - `resolve-library-id` → `query-docs` with "conventions best practices patterns idioms"
2. Distill: conventions (5-10), patterns (5-10), idioms (3-5), testing (3-5), pitfalls (3-5)
3. Generate via script:
   ```bash
   python .claude/skills/core-setup/scripts/generate-stack-baseline.py \
     --stack "[framework + version]" \
     --conventions "[extracted]" --patterns "[extracted]" \
     --idioms "[extracted]" --testing "[extracted]" \
     --pitfalls "[extracted]" --sources "[library IDs]" \
     --output .claude/research/stack-baseline.md
   ```

**Game projects:** Also generate `.claude/research/architecture-baseline.md` with scene tree patterns, node types, signals, state machines.

---

## Phase 8: Commit (optional)

AskUserQuestion (single-select): Commit setup files now, or skip.

If committing: stage relevant files, create commit with conventional commit format (e.g., `build: scaffold [stack] project`).

**IMPORTANT:** Do NOT add Co-Authored-By, Generated with Claude Code footer, or any other AI attribution to commits.

## Troubleshooting

### Error: Stack detection fails
**Cause:** No recognizable framework files found (package.json, Cargo.toml, etc.).
**Solution:** Make sure you're in the project root directory. If using a monorepo, navigate to the specific package. You can manually specify the stack during setup.

### Error: Dependencies won't install
**Cause:** Package manager not found or network issues.
**Solution:** Check that npm/yarn/pnpm is installed (`which npm`). Check network connectivity. If behind a proxy, configure npm proxy settings.

### Error: CLAUDE.md not generated correctly
**Cause:** Template variables not resolved or stack not recognized.
**Solution:** The setup wizard generates CLAUDE.md from templates. If the output looks wrong, edit it manually — CLAUDE.md is just a markdown file. Run `/core-setup` again to regenerate.

