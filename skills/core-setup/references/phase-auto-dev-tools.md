# Auto Dev Tools (shared: greenfield Phase 5b / mature PHASE 5.65)

Install dev-tools that are framework-conditional and have no `stack.*` slot: inspect-overlay, playwright-toolchain, and tauri-mcp. Tier-1 modules with a stack slot go through Module Gap (mature PHASE 0.6/5.8) or `/core-setup [module]` — never through this phase.

## Parameters

The caller's transition marker supplies:

- `variant`: `greenfield-auto` | `mature-ask`
- `stack-source`: where to read framework/type from (greenfield: Phase 2.3 project type + Phase 2.4 stack choice; mature: `project.json#stack` + file probes)
- `track-to`: session list to append installed tool IDs to (greenfield: `dev_tools_installed[]`; mature: `installed_in_session[]`)

## Variant differences

| Aspect            | `greenfield-auto`                                       | `mature-ask`                               |
| ----------------- | ------------------------------------------------------- | ------------------------------------------ |
| Gate              | None — auto-install on match, silent skip on mismatch   | AskUserQuestion per tool                   |
| Already-installed | Not probed (fresh project)                              | File probes decide whether to offer at all |
| Dev server note   | Skip "Restart dev server" steps (no server running yet) | Follow setup-guide fully                   |

---

## Tool 1: inspect-overlay

**Detect** — trigger only when `stack.framework` ∈ {React+Vite, Next.js} (from `stack-source`):

| Variant           | Extra condition                                                                                                                |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `greenfield-auto` | None — fresh project never has the overlay                                                                                     |
| `mature-ask`      | Overlay not yet installed: Next.js → `public/_inspect/client.js` absent; Vite → `vite.config.*` has no `inspectOverlay` import |

All other stacks (Vue, Svelte, Astro, Nuxt, game, CLI, backend, mobile, desktop): skip silently — no output.

**Gate** (`mature-ask` only):

```yaml
header: "Inspect overlay"
question: "A new {framework} project gets the inspect overlay automatically. This project doesn't have it. Install?"
options:
  - label: "Install (Recommended)"
    description: "Mirror of greenfield default — same DX as a new project"
  - label: "Skip"
    description: "Do not install"
multiSelect: false
```

On "Skip": no action. On "Install": proceed.

**Install:**

```
Read("references/modules/inspect-overlay/setup-guide.md")
```

- **Vite path**: pin **`@vitejs/plugin-react@^5`** in `package.json` (NOT v6 — that uses OXC instead of Babel, causing the overlay to fall into degraded mode without file:line refs). Follow setup-guide `## Setup — Vite` → `### Plugin Selection` and `### Install & Configure` steps 1-6. `greenfield-auto`: no plugin modal, choose automatically.
- **Next.js path**: Babel full mode (warn the user that Turbopack will be disabled). Follow setup-guide `### Babel Plugin (Full Mode)` accept path and `### Install` steps 1-6.

**Track**: append `inspect-overlay` to `{track-to}` (+ framework, for the summary). No project.json update — inspect-overlay is dev-only, no `stack.*` key.

---

## Tool 2: playwright-toolchain

**Detect** — trigger only when `stack.type` is `Web Frontend` or `Fullstack` (from `stack-source`):

| Variant           | Extra condition                                                     |
| ----------------- | ------------------------------------------------------------------- |
| `greenfield-auto` | None                                                                |
| `mature-ask`      | `@playwright/test` missing from `devDependencies` in `package.json` |

Game / CLI / backend-only / mobile / desktop: skip — no output.

Skills such as `/design-convert Build` and `/design-ship`'s check phase need `playwright-cli` (daemon) and `@axe-core/playwright` (a11y) for smoke checks.

**Gate** (`mature-ask` only):

```yaml
header: "Playwright toolchain"
question: "Design skills expect playwright-cli + @axe-core/playwright for smoke checks. This project does not have it yet. Install?"
options:
  - label: "Install (Recommended)"
    description: "playwright-cli (global) + @playwright/test + @axe-core/playwright (devDeps)"
  - label: "Skip"
    description: "Do not install — smoke checks in design-convert will report failure"
multiSelect: false
```

On "Skip": no action. On "Install": proceed.

**Install:**

```bash
# Daemon (global)
npm install -g @playwright/cli@latest
npx @playwright/cli install chromium

# Runner + a11y helper (devDeps)
{pkgmgr} install --save-dev @playwright/test @axe-core/playwright
```

**Track**: append `playwright-toolchain` to `{track-to}`. No project.json update — playwright is dev-only, no `stack.*` key.

---

## Tool 3: tauri-mcp

**Detect** — trigger only when the project is a Tauri app (a **positive** detect, unlike Tools 1-2's
Web-Frontend/Fullstack gate — this is the one tool in this phase that applies to Desktop):

| Variant           | Extra condition                                                                                                                                                                                               |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `greenfield-auto` | Phase 2.4 tech stack choice contains "Tauri" (case-insensitive)                                                                                                                                               |
| `mature-ask`      | `stack.framework == "Tauri"` (from `stack-source`) **OR** `src-tauri/Cargo.toml` exists with a `tauri` dependency (file probe fallback, e.g. a dashboard not yet re-synced since the `populate.js` Tauri fix) |

All other stacks: skip silently — no output.

**Gate** (`mature-ask` only):

```yaml
header: "Tauri MCP"
question: >
  This is a Tauri app. tauri-mcp lets Claude drive the real app window (WKWebView/WebView2) for
  interactive verification — no CDP needed, works where Chrome-based tooling can't reach. Debug-only,
  refuses release builds. Install?
options:
  - label: "Install (Recommended)"
    description: "Debug-gated Rust plugin + dev-only frontend init + project .mcp.json"
  - label: "Skip"
    description: "Do not install"
multiSelect: false
```

On "Skip": no action. On "Install": proceed.

**Install:**

```
Read("references/modules/tauri-mcp/setup-guide.md")
```

Follow the guide's Install section. `greenfield-auto`: no modal, install automatically (mirrors
inspect-overlay's greenfield-auto pattern).

**Track**: append `tauri-mcp` to `{track-to}`. No project.json update — dev-only, no `stack.*` key.

---

When done: return to the caller's next phase.
