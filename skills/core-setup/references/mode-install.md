# Install mode

Incremental installer for frontend tooling and libraries in **existing** projects. Always starts with the inspect overlay question, then needs-driven with optional research-fallback.

## References

- `references/research-flow.md` — Context7 + WebSearch protocol for long-tail libraries
- `references/modules/{module}/setup-guide.md` — Per-module install/teardown instructions

**Tier-1 modules** (curated guides):

| Category  | Modules                    |
| --------- | -------------------------- |
| Dev tools | inspect-overlay, tauri-mcp |
| Styling   | tailwind, shadcn-ui        |
| Testing   | vitest, playwright         |
| Linting   | biome, eslint-prettier     |
| State     | zustand, tanstack-query    |
| Forms     | react-hook-form-zod        |

Everything outside this set is handled via `references/research-flow.md`.

---

## Process

**Phase tracking** — first action of the skill: call `TaskCreate` with these 7 items (status `pending`), then use `TaskUpdate` to set each phase to `in_progress` at the start and `completed` at the end. On context compaction the task list stays visible — no risk of forgetting phases.

1. PHASE 0: Pre-flight
2. PHASE 1: Inspect Overlay
3. PHASE 2: Further Installs
4. PHASE 3: Category Choice
5. PHASE 4: Option Choice
6. PHASE 5: Install + Verify
7. PHASE 6: Report

## PHASE 0: Pre-flight

> **Todo**: call `TaskCreate` with the 7 phase items (see above). Mark PHASE 0 → `in_progress` via `TaskUpdate`.

### 0.0 Argument Detection

If the skill was invoked with an argument (e.g. `/core-setup tailwind`):

1. Match argument (case-insensitive) against tier-1 module names:
   `inspect-overlay`, `tauri-mcp`, `tailwind`, `shadcn-ui`, `vitest`, `playwright`, `biome`, `eslint-prettier`, `zustand`, `tanstack-query`, `react-hook-form-zod`

2. **Match found** → save module as `direct_module`, skip PHASE 1-3, go directly to PHASE 4 Path A after PHASE 0.1-0.2.

3. **No match** → treat as free text for research mode: save as `direct_research`, skip PHASE 1-3, go directly to PHASE 4 Path B after PHASE 0.1-0.2.

4. **No argument** → normal flow (run through PHASE 1-3).

### 0.1 Framework Detection

Check `package.json` dependencies:

- `next` present → **Next.js**
- `vite` present → **Vite** (further check: `@vitejs/plugin-react` → React-Vite, else → non-React Vite)
- `astro` present → **Astro** (research mode only)
- `nuxt` present → **Nuxt** (research mode only)
- No `package.json` framework match **but** an `index.html` exists at root → **Plain** (inspect-overlay only — other tier-1 modules skip)
- No match and no `index.html` → abort: "No supported frontend framework detected."

When framework is **Plain** or **non-React Vite**: only `inspect-overlay` is offered in PHASE 1, all other tier-1 modules are skipped (they assume React or a build toolchain that exists). Research-flow remains available for free-text input.

**Tauri detection (independent flag)** — regardless of the frontend `framework` value above (a
Tauri app's root `package.json` is its frontend, e.g. React+Vite, and stays classified as such for
category-gating purposes): check `src-tauri/Cargo.toml` for a `tauri` dependency. If found, set
`$IS_TAURI = true`. This only gates whether `## Pre-PHASE 2: Tauri MCP` (below) offers the
`tauri-mcp` module — it does not change `framework` or the PHASE 3 category flow.

### 0.2 Package Manager Detection

Check in order (first match wins):

1. `package.json` → `"packageManager"` field (corepack): `"pnpm@x"` / `"yarn@x"` / `"bun@x"` / `"npm@x"`
2. Lockfile: `pnpm-lock.yaml` → pnpm · `yarn.lock` → yarn · `bun.lockb` → bun · `package-lock.json` → npm
3. None → default npm

Save framework + package manager for later phases.

### 0.3 Flow Diagram

Generate an ASCII flowchart showing the path through this mode based on the detected framework. Show PHASE 1 → PHASE 2 → loop to PHASE 6.

### 0.4 Stack-keys mapping

On every successful install, PHASE 5 step 5b writes the module choice to `project.json`:

| Module              | project.json key                        |
| ------------------- | --------------------------------------- |
| tailwind            | `stack.styling = "tailwind"`            |
| shadcn-ui           | `stack.componentLibrary = "shadcn-ui"`  |
| vitest              | `stack.testing.unit = "vitest"`         |
| playwright          | `stack.testing.e2e = "playwright"`      |
| biome               | `stack.linting = "biome"`               |
| eslint-prettier     | `stack.linting = "eslint-prettier"`     |
| zustand             | `stack.state.client = "zustand"`        |
| tanstack-query      | `stack.state.server = "tanstack-query"` |
| react-hook-form-zod | `stack.forms = "react-hook-form-zod"`   |
| inspect-overlay     | (none — dev-only tool)                  |
| tauri-mcp           | (none — dev-only tool)                  |

`stack.packages[]` is **derived from `package.json`** after the install — not from a hardcoded list (see PHASE 5 step 5a). This works automatically and correctly for every library, including research-mode and multi-package installs (shadcn-ui, eslint+prettier).

---

## PHASE 1: Inspect Overlay (always)

> **Todo**: mark PHASE 0 → `completed`, PHASE 1 → `in_progress`.

### 1.1 Overlay Status

Check whether the overlay is already installed:

- **Vite**: Grep `vite.config` for `inspectOverlay`
- **Next.js**: Check for `client.js` in `public/_inspect/`

### 1.2 Question (single-select)

```yaml
header: "Inspect overlay"
question: >
  Visual inspector for element-picking in the browser — useful during iterative
  UI work (Ctrl+. to activate, click element → copies a reference that /dev-inspect
  picks up in chat). Do you want to set this up?
options:
  # When not installed:
  - label: "Skip (Recommended)", description: "Skip, continue to next step"
  - label: "Install", description: "Inject overlay into this project"
  # When already installed:
  - label: "Skip (Recommended)", description: "Overlay is already active, keep it"
  - label: "Teardown", description: "Remove overlay from project"
multiSelect: false
```

### 1.3 Execute

When **Install** or **Teardown**:

```
Read("references/modules/inspect-overlay/setup-guide.md")
```

Follow the guide for the detected framework. After completion show controls:

```
✓ Inspect overlay {installed | removed}.

Controls (on install only):
  Ctrl+. / Cmd+.                 toggle on/off
  Click                          select element → copy ref
  Shift+Click                    pin multiple elements
  Drag                           select region
  Ctrl+Z                         unpin last
  Escape                         clear pins / exit
```

When **Skip** → go directly to PHASE 2.

### 1.4 Framework Guard (Plain)

When `framework === "plain"` (detected in PHASE 0.1), inspect-overlay is the only meaningful module — other tier-1 modules assume `npm install` and a React-or-bundler toolchain. After PHASE 1.3 completes (install or skip), jump directly to PHASE 6 (Report). Skip PHASE 2-5.

---

## Pre-PHASE 2: Tauri MCP (conditional)

Only runs when `$IS_TAURI` is `true` (set in PHASE 0.1). Otherwise skip straight to PHASE 2 — no
output, this section doesn't exist for non-Tauri projects.

### Status

Check whether `tauri-mcp` is already installed: `src-tauri/Cargo.toml` has a `tauri-plugin-mcp`
dependency AND a project `.mcp.json` registers a `tauri-mcp` server entry.

### Question

```yaml
header: "Tauri MCP"
question: >
  This is a Tauri app. tauri-mcp lets Claude drive the real app window (WKWebView/WebView2) for
  interactive verification — no CDP needed, works where Chrome-based tooling can't reach. Debug-only,
  refuses release builds. Set this up?
options:
  # When not installed:
  - label: "Install (Recommended)", description: "Debug-gated Rust plugin + dev-only frontend init + project .mcp.json"
  - label: "Skip", description: "Skip, continue to next step"
  # When already installed:
  - label: "Skip (Recommended)", description: "Already installed, keep it"
  - label: "Teardown", description: "Remove tauri-mcp from project"
multiSelect: false
```

### Execute

When **Install** or **Teardown**:

```
Read("references/modules/tauri-mcp/setup-guide.md")
```

Follow the guide's Install or Teardown section. After completion, continue to PHASE 2.

When **Skip** → go directly to PHASE 2.

---

## PHASE 2: Further Installs?

> **Todo**: mark PHASE 1 → `completed`, PHASE 2 → `in_progress`.

**Skip this phase entirely when `framework === "plain"`** — go directly to PHASE 6. The remaining tier-1 modules require a build toolchain that plain HTML lacks; offering them would lead to broken installs.

```yaml
header: "Continue?"
question: "Do you want to add anything else to this project?"
options:
  - label: "Yes (Recommended)", description: "Choose a category"
  - label: "No, done", description: "Go to report"
multiSelect: false
```

When **No** → PHASE 6.

---

## Pre-PHASE 3: Stack snapshot

Read `.project/project.json#stack` (if the file exists). Cache the object for use in PHASE 3 category prompts.

Skip silent if `project.json` is missing — then render the default category prompt without slot status.

---

## PHASE 3: Category Choice

> **Todo**: mark PHASE 2 → `completed`, PHASE 3 → `in_progress`.

Render the prompt based on the cached stack snapshot:

| Situation         | Label format                            |
| ----------------- | --------------------------------------- |
| Slot filled       | `"{Category}: {value} ✓ — change?"`     |
| Slot empty        | `"{Category}: (empty) — choose option"` |
| No `project.json` | `"{Category} — {default description}"`  |

Category ↔ stack-key mapping:

| Category             | stack-key(s)                                            |
| -------------------- | ------------------------------------------------------- |
| Styling              | `stack.styling`                                         |
| UI components        | `stack.componentLibrary`                                |
| Testing              | `stack.testing.unit` + `stack.testing.e2e` (show both)  |
| Linting & formatting | `stack.linting`                                         |
| State management     | `stack.state.client` + `stack.state.server` (show both) |
| Forms & validation   | `stack.forms`                                           |

Categories without mapping (Routing, Animation, Icons, Auth, i18n, Analytics, Dev tools) always show the default description, regardless of snapshot.

Two sequential modals (7-option cap per `shared/SKILL-PATTERNS.md § Modal Option Cap`). Show Modal 1 first; show Modal 2 only when the user picks "More categories →".

**Modal 1 — core stack categories:**

```yaml
header: "Category"
question: "What do you want to add?"
options:
  - label: "Styling [context-aware]", description: "Tailwind, CSS-in-JS, etc."
  - label: "UI components [context-aware]", description: "shadcn-ui, Radix, headless libs"
  - label: "Testing [context-aware]", description: "Unit (Vitest), e2e (Playwright)"
  - label: "Linting & formatting [context-aware]", description: "Biome or ESLint+Prettier"
  - label: "State management [context-aware]", description: "Client state, server state"
  - label: "Forms & validation [context-aware]", description: "Form libs + schema validators"
  - label: "More categories →", description: "Routing, animation, icons, auth, i18n, analytics, dev tools"
multiSelect: false
```

**Modal 2 — more categories** (only after "More categories →"):

```yaml
header: "Category"
question: "Which category?"
options:
  - label: "Routing", description: "File-based or declarative routers"
  - label: "Animation", description: "Motion libraries"
  - label: "Icons", description: "Icon packs"
  - label: "Auth", description: "Auth providers and libraries"
  - label: "i18n", description: "Translation and routing"
  - label: "Analytics", description: "Privacy-first or full-stack"
  - label: "Dev tools", description: "Storybook, devtools profiling"
multiSelect: false
```

`[context-aware]` labels are replaced by the appropriate format from the table above. No hardcoded YAML permutations — the instruction above the YAML describes the rendering behavior.

Free-text input via the built-in "Other" field (either modal) → treat as `direct_research` and follow PHASE 4 Path B.

---

## PHASE 4: Option Choice

> **Todo**: mark PHASE 3 → `completed`, PHASE 4 → `in_progress`.

### Path A — Tier-1 module available for category

Show the tier-1 modules for this category + "Other library (research)":

**Example for Styling:**

```yaml
options:
  - label: "Tailwind (Recommended)", description: "Utility-first CSS framework"
  - label: "shadcn-ui", description: "Copy-paste components on Tailwind + Radix"
  - label: "Other library (research)", description: "Search for another CSS solution"
```

When a tier-1 module is chosen:

```
Read("references/modules/{module}/setup-guide.md")
```

Follow the install/teardown steps. Detect if already installed → offer install / teardown / skip.

### Path B — Research mode

When the user typed a free-text "Other" answer in PHASE 3, or chose **"Other library (research)"** in PHASE 4:

```
Read("references/research-flow.md")
```

Follow the research protocol:

1. Ask the user what they are looking for (free text)
2. Context7: `resolve-library-id` + `query-docs` for top-3 candidates
3. WebSearch: `best {category} library for {framework} 2026` for sentiment
4. Present 3 options with trade-off matrix
5. User chooses → generate install steps via Context7 query

---

## PHASE 5: Install + Verify

> **Todo**: mark PHASE 4 → `completed`, PHASE 5 → `in_progress`.

0. **State check** — consult the "Detection" section of the setup-guide (already loaded in PHASE 4 Path A). Determine tri-state:

   | State                          | Action                            |
   | ------------------------------ | --------------------------------- |
   | `already-installed-configured` | skip step 1+2, continue to step 3 |
   | `installed-not-configured`     | skip step 1, start at step 2      |
   | `not-installed`                | normal flow (step 1+2+3+...)      |

   Research-mode (Path B): always assume `not-installed` (no setup-guide available).

1. **Install** — run install command with the detected package manager:
   - npm: `npm install {pkg}`
   - pnpm: `pnpm add {pkg}`
   - yarn: `yarn add {pkg}`
   - bun: `bun add {pkg}`

2. **Configure** — edit configfiles per setup-guide or research-output (vite.config, tsconfig, postcss.config, etc.)

3. **Update .gitignore** — if the guide prescribes it

4. **Verify** — non-blocking:
   - Run `tsc --noEmit` or build command
   - On failure: report but continue

5. **Sync project context** — skip silent if `.project/project.json` is missing.

   Follow `shared/SYNC.md` protocol (re-read project.json directly before write):

   a. Read `package.json#dependencies` + `package.json#devDependencies` after the install.
   For each entry: append `{ name, version, purpose }` to `stack.packages[]`
   (`purpose: "devDependency"` for devDeps, `"dependency"` for deps).
   Skip if an entry with the same `name` already exists (idempotent).
   Modules without NPM-install (inspect-overlay) add nothing to package.json →
   diff is empty → no-op, no special exception needed.

   b. For tier-1 modules: write the specific `stack.{key}` from the PHASE 0.4 mapping table.
   - Value already equal → skip (idempotent).
   - Different value present:

     ```yaml
     header: "Stack conflict"
     question: "stack.{key} is already set to '{existing value}'. Overwrite?"
     options:
       - label: "Yes, overwrite with '{new value}'"
         description: "Update stack context to new choice"
       - label: "No, keep '{existing value}'"
         description: "Packages installed, key unchanged"
     multiSelect: false
     ```

   c. For research-mode (Path B): ask whether the library belongs in a known stack slot.

   ```yaml
   header: "Stack slot"
   question: >
     '{library}' installed. Which stack category does it belong to?
     (skip = only in stack.packages[])
   options:
     - label: "Skip (Recommended)"
       description: "No stack.{key} update — packages[] is enough"
     - label: "Styling"
       description: "stack.styling = '{library}'"
     - label: "UI components"
       description: "stack.componentLibrary = '{library}'"
     - label: "State (client)"
       description: "stack.state.client = '{library}'"
     - label: "State (server)"
       description: "stack.state.server = '{library}'"
     - label: "Forms"
       description: "stack.forms = '{library}'"
     - label: "Linting"
       description: "stack.linting = '{library}'"
     - label: "Testing (unit)"
       description: "stack.testing.unit = '{library}'"
     - label: "Testing (e2e)"
       description: "stack.testing.e2e = '{library}'"
   multiSelect: false
   ```

   When a slot is chosen: reuse conflict-detection from step 5b (value equal → skip; different value present → AskUserQuestion overwrite).

   d. If `CLAUDE.md` exists and has a `### Stack` section:
   - Call `references/claude-md-sync.md` with:
     - `mode: "mature"`
     - `generate-if-missing: false`
     - `stack-overwrite: "ask"`
     - `inferred-stack:` stack object after step a+b

6. **Loop** — back to PHASE 2.

---

## PHASE 6: Report

> **Todo**: mark PHASE 5 → `completed`, PHASE 6 → `in_progress`.

ASCII table with session result:

```
INSTALL COMPLETE

| Module          | Action     | Status    |
| --------------- | ---------- | --------- |
| inspect-overlay | install    | OK        |
| tailwind        | install    | OK        |
| {module}        | teardown   | OK        |
| {module}        | skip       | -         |

Verify:
  {build/typecheck output summary}

Project context: {N} fields updated in project.json / n/a
CLAUDE.md:       {M} sections updated / already complete / n/a
```

**Next steps:**

1. `/design-tokens` → design tokens setup if styling was added
2. `/design-convert` → mock-driven UI design with new stack
3. `/design-ship` → build + quality check after multiple installs

> **Todo**: mark PHASE 6 → `completed`.

---

## Restrictions

This mode must **NEVER**:

- Edit project source code beyond install configuration
- Skip the inspect overlay question in PHASE 1 **unless** an argument was passed (PHASE 0.0)
- Continue to PHASE 5 without a clear user choice
- Install dependencies without a package manager match (e.g. `npm install` in a pnpm project)

This mode must **ALWAYS**:

- Detect framework + package manager in PHASE 0 (always, even with argument shortcut)
- Check argument in PHASE 0.0 before the inspect overlay question
- Loop back to PHASE 2 after every install (incremental model)
- Detect tri-state per module in PHASE 5 step 0 (already-configured / installed-not-configured / not-installed)
- Derive `stack.packages[]` from `package.json` after install — never from hardcoded lists
- Use research-flow for everything outside the tier-1 set
