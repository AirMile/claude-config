# Inspect Overlay — Setup Guide

## Detection

| State                          | Condition                                                                                                                                                |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `already-installed-configured` | Vite: `inspectOverlay` in `vite.config.*` · Next.js: `public/_inspect/client.js` present · Plain: `inspect-overlay-client.js` referenced in `index.html` |
| `not-installed`                | None of the above                                                                                                                                        |

No `installed-not-configured` state: inspect-overlay is a dev-only inject without an NPM package. `installed` implies `configured`.

## Pre-flight (continued)

### Mode Selection (Full vs Degraded)

The overlay always runs the same vanilla-JS client. The difference is whether each element carries `data-inspector-*` attrs (Babel-injected) for **exact `file:line` refs** (Full), or whether refs fall back to **`tag.class "text"`** (Degraded).

| Framework                         | Available modes | Default                       |
| --------------------------------- | --------------- | ----------------------------- |
| Vite + React                      | Full / Degraded | Full (pin plugin-react@^5)    |
| Next.js + React                   | Full / Degraded | Ask (Full disables Turbopack) |
| Plain JS / static HTML / no React | Degraded only   | Degraded                      |

Degraded refs look like `[button.btn.btn-primary "Save"]` — Claude grep's once on the classes/text to find source. Full refs look like `[src/components/Button.tsx:42:3]` — Claude reads the file directly. Both are wrapped in `[…]` for paste-context clarity.

### Dev Server Status

Determine the dev server port framework-aware:

- **Vite**: read `vite.config.*` for `server.port`; fallback `5173`
- **Next.js**: read `package.json` scripts for `--port` flag; fallback `3000`
- **Plain**: no dev server detection — user picks any static server (`npx serve`, Live Server VS Code extension, `python -m http.server`)

Check if that port is in use. Track for restart after setup.

### Pre-flight Output

Report framework, plugin mode (Vite), overlay status, dev server status, and the detected port.

## Setup — Vite + React

### Plugin Selection (critical for full mode)

`@react-dev-inspector/babel-plugin` only works via Babel. Modern `@vitejs/plugin-react` (v6+) uses **OXC** as its default transformer and ignores Babel plugins → automatically degraded mode. Therefore: for full mode, pin to a Babel-compatible version.

| Found in `package.json`               | Action (auto, no modal)                                                   |
| ------------------------------------- | ------------------------------------------------------------------------- |
| `@vitejs/plugin-react-swc`            | Uninstall, install `@vitejs/plugin-react@^5`, update `vite.config` import |
| `@vitejs/plugin-react@^6` (or higher) | Downgrade to `@vitejs/plugin-react@^5` (last Babel version) to avoid OXC  |
| `@vitejs/plugin-react@^5` or no v6+   | Keep as is — already Babel-compatible                                     |
| No react plugin                       | Install `@vitejs/plugin-react@^5`                                         |

In greenfield: always force `@vitejs/plugin-react@^5` as a pin. No modal — degraded mode is not an acceptable default.

### Install & Configure

1. Install `@react-dev-inspector/babel-plugin`
2. Copy `references/inspect-overlay-plugin.ts` → project root as `inspect-overlay.vite.ts`
3. Copy `references/inspect-overlay-client.js` → project root
4. Add to `.gitignore` (if not already present):
   ```
   # Inspect overlay (synced from claude-config)
   inspect-overlay-client.js
   inspect-overlay.vite.ts
   ```
5. Update `vite.config.ts`:
   - Add `inspectOverlay()` to plugins array
   - Add babel plugin to `react()` config: `react({ babel: { plugins: ['@react-dev-inspector/babel-plugin'] } })`
6. Restart dev server if running

### Verify Full Mode

After install: verify that `package.json` shows `"@vitejs/plugin-react": "^5.x.x"` (no v6+) and that `vite.config` passes through the babel plugin. If in doubt: start the dev server, open a component in the overlay and confirm that file:line refs are shown. No file:line → OXC still active somewhere, check plugin version.

## Setup — Next.js

Next.js CAN run in full mode using a custom Babel plugin that injects `data-inspector-*` attributes. This disables Turbopack (falls back to Webpack), which makes dev builds slower but gives exact file:line references in the overlay.

If the user declines Babel, the overlay runs in degraded mode (no file:line refs, element-picking via CSS classes/text).

> **Important:** Next.js server components strip `<script>` tags from JSX. The overlay must be loaded via a `"use client"` component that injects the script with `document.createElement`.

### Babel Plugin (Full Mode)

Ask user:

```yaml
header: "Plugin"
question: "The inspect overlay can use Babel for exact file:line references. This disables Turbopack (slower dev builds). Do you want full mode?"
options:
  - label: "Yes, with Babel (Recommended)"
    description: "Exact file:line refs. Disables Turbopack, slower dev builds, no impact on production."
  - label: "No, without Babel"
    description: "Overlay works without exact file references. Claude searches via text/classes. Turbopack remains active."
multiSelect: false
```

If accepted (Full Mode):

1. Copy `references/babel-plugin-inspector.js` → project root as `babel-plugin-inspector.js`
2. Create `.babelrc` in project root:
   ```json
   {
     "presets": ["next/babel"],
     "env": {
       "development": {
         "plugins": ["./babel-plugin-inspector"]
       }
     }
   }
   ```
3. Add to `.gitignore` (if not already present):
   ```
   # Inspect overlay (synced from claude-config)
   babel-plugin-inspector.js
   .babelrc
   ```
4. Restart dev server (Babel disables Turbopack, Webpack takes over)

If declined: degraded mode — skip Babel plugin, overlay works without file:line refs.

### Install

1. Create `public/_inspect/` directory
2. Copy `references/inspect-overlay-client.js` → `public/_inspect/client.js`
3. Create `app/inspect-overlay.tsx`:

   ```tsx
   "use client";

   import { useEffect } from "react";

   export function InspectOverlay() {
     useEffect(() => {
       const script = document.createElement("script");
       script.type = "module";
       script.src = "/_inspect/client.js";
       document.body.appendChild(script);
       return () => {
         script.remove();
       };
     }, []);

     return null;
   }
   ```

4. Add to root `layout.tsx`:

   ```tsx
   import { InspectOverlay } from "./inspect-overlay";

   // inside <body>:
   {
     process.env.NODE_ENV === "development" && <InspectOverlay />;
   }
   ```

5. Add to `.gitignore` (if not already present):
   ```
   # Inspect overlay (synced from claude-config)
   public/_inspect/
   app/inspect-overlay.tsx
   ```
6. Full mode: restart dev server after setup. Degraded mode: HMR picks up the change automatically

## Setup — Plain JS / Static HTML

Applies to: static HTML pages, vanilla-TS Vite templates, Vite/SvelteKit/Nuxt/Solid/Qwik projects without React, and anything else where you control an `index.html` (or root layout) and don't have a Babel/JSX pipeline. For Vite-without-React (Vue, Svelte, Solid, vanilla TS, etc.), use this path instead of the Vite + React path above.

Always **Degraded mode** — refs look like `[button.btn.primary "Save"]` (tag + max 3 classes + 30 chars text), wrapped in `[…]`.

Detection: `package.json` lacks `next`, `vite` may or may not be present, no `@vitejs/plugin-react`. An `index.html` exists at project root (or in `public/`, `src/`, depending on bundler).

> **Note for Astro projects**: Astro ships with its own DevToolbar that overlaps this functionality. Ask the user before installing — if they already use the DevToolbar, skip inspect-overlay.

### Install

1. Copy `references/inspect-overlay-client.js` → project root (or `public/` for bundlers that serve from there)
2. Add a script tag to `index.html` inside `<body>` — wrap in a dev-environment guard:

   **Static HTML / no bundler:**

   ```html
   <script type="module" src="/inspect-overlay-client.js"></script>
   ```

   Place at the end of `<body>` so the DOM exists when the script runs. Remove before production deploy, or guard via a build-step that strips it.

   **Vite (any template, including non-React):**

   ```html
   <script type="module">
     if (import.meta.env.DEV) {
       import("/inspect-overlay-client.js");
     }
   </script>
   ```

   Vite tree-shakes this in production builds automatically.

   **Other bundlers (Parcel, Webpack, esbuild):** use the bundler's dev/prod env check or conditionally include via the dev server's HTML transformer.

3. Add to `.gitignore` (if not already present):
   ```
   # Inspect overlay (synced from claude-config)
   inspect-overlay-client.js
   ```
4. Reload the page (or restart dev server if running)

### Verify Degraded Mode

Open the page, press Ctrl+Shift+X / Cmd+Shift+X, click any element. Toast should appear with `Copied: <tag>.<class> "<text>"`. If no toast → check the browser console for the script-load (404 means the path is wrong, CORS means it's served from the wrong origin).

## Post-Setup Report

Report overlay status:

- Mode: Full (Babel) or Degraded
- Controls: Ctrl+Shift+X (Win/Linux) or Cmd+Shift+X (Mac) to toggle
- Server URL: tunnel URL if cloudflared running, else `localhost:<detected-port>` (5173 for Vite default, 3000 for Next.js default, user-chosen for plain JS)
- Clipboard format: refs are wrapped in `[…]` — single click copies `[src/Button.tsx:42]` (Full) or `[button.btn "Save"]` (Degraded); multi-pin wraps each ref in its own brackets within the `--- 1/N ---` block

Setup complete. Overlay is active — user can inspect elements and paste references into chat.

## Teardown

Only on explicit request ("remove the overlay", "cleanup inspect").

**Vite:**

1. Delete `inspect-overlay.vite.ts` and `inspect-overlay-client.js`
2. Remove `inspectOverlay` import + plugin from `vite.config.ts`
3. Remove babel plugin from react() config
4. Optionally uninstall `@react-dev-inspector/babel-plugin`
5. Restart dev server

**Next.js:**

1. Delete `public/_inspect/` directory
2. Delete `app/inspect-overlay.tsx`
3. Remove `<InspectOverlay />` and its import from root `layout.tsx`
4. If full mode: delete `babel-plugin-inspector.js` and `.babelrc`, restart dev server (Turbopack resumes)
5. If degraded mode: HMR removes overlay automatically

**Plain JS / Static HTML:**

1. Delete `inspect-overlay-client.js` from project root (or `public/`)
2. Remove the `<script>` tag (or `import.meta.env.DEV` guard block) from `index.html`
3. Reload the page
