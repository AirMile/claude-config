# Inspect Overlay — Setup Guide

## Detection

| State                          | Conditie                                                                                  |
| ------------------------------ | ----------------------------------------------------------------------------------------- |
| `already-installed-configured` | Vite: `inspectOverlay` in `vite.config.*` · Next.js: `public/_inspect/client.js` aanwezig |
| `not-installed`                | Geen van bovenstaande                                                                     |

Geen `installed-not-configured` toestand: inspect-overlay is een dev-only inject zonder NPM package. `installed` impliceert `configured`.

## Pre-flight (continued)

### Dev Server Status

Bepaal de dev server poort framework-aware:

- **Vite**: lees `vite.config.*` voor `server.port`; fallback `5173`
- **Next.js**: lees `package.json` scripts voor `--port` flag; fallback `3000`

Check of die poort in use is. Track voor restart na setup.

### Pre-flight Output

Report framework, plugin mode (Vite), overlay status, dev server status, en de gedetecteerde poort.

## Setup — Vite

### Plugin Selection (kritiek voor full mode)

`@react-dev-inspector/babel-plugin` werkt alleen via Babel. Moderne `@vitejs/plugin-react` (v6+) gebruikt standaard **OXC** als transformer en negeert Babel-plugins → automatisch degraded mode. Daarom: voor full mode pin je op een Babel-compatibele versie.

| Gevonden in `package.json`            | Actie (auto, geen modal)                                                            |
| ------------------------------------- | ----------------------------------------------------------------------------------- |
| `@vitejs/plugin-react-swc`            | Uninstall, install `@vitejs/plugin-react@^5`, update `vite.config` import           |
| `@vitejs/plugin-react@^6` (of hoger)  | Downgrade naar `@vitejs/plugin-react@^5` (laatste Babel-versie) om OXC te vermijden |
| `@vitejs/plugin-react@^5` of geen v6+ | Houden zoals het is — al Babel-compatible                                           |
| Geen react plugin                     | Install `@vitejs/plugin-react@^5`                                                   |

In greenfield: forceer altijd `@vitejs/plugin-react@^5` als pin. Geen modal — degraded mode is geen acceptabele default.

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

Na install: check dat `package.json` toont `"@vitejs/plugin-react": "^5.x.x"` (geen v6+) en dat `vite.config` de babel plugin doorgeeft. Bij twijfel: start dev server, open een component in de overlay en bevestig dat file:line refs worden getoond. Geen file:line → ergens nog OXC actief, check plugin-versie.

## Setup — Next.js

Next.js CAN run in full mode using a custom Babel plugin that injects `data-inspector-*` attributes. This disables Turbopack (falls back to Webpack), which makes dev builds slower but gives exact file:line references in the overlay.

If the user declines Babel, the overlay runs in degraded mode (no file:line refs, element-picking via CSS classes/text).

> **Important:** Next.js server components strip `<script>` tags from JSX. The overlay must be loaded via a `"use client"` component that injects the script with `document.createElement`.

### Babel Plugin (Full Mode)

Ask user:

```yaml
header: "Plugin"
question: "De inspect overlay kan Babel gebruiken voor exacte file:line referenties. Dit schakelt Turbopack uit (langzamere dev builds). Wil je full mode?"
options:
  - label: "Ja, met Babel (Recommended)"
    description: "Exacte file:line refs. Schakelt Turbopack uit, dev builds trager, geen impact op production."
  - label: "Nee, zonder Babel"
    description: "Overlay werkt zonder exacte bestandsreferenties. Claude zoekt via tekst/classes. Turbopack blijft actief."
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

## Post-Setup Report

Report overlay status:

- Mode: Full (Babel) or Degraded
- Controls: Ctrl+Shift+X (Win/Linux) or Cmd+Shift+X (Mac) to toggle
- Server URL: tunnel URL if cloudflared running, else `localhost:<detected-port>` (5173 voor Vite default, 3000 voor Next.js default)

Setup voltooid. Overlay is actief — gebruiker kan elementen inspecteren en referenties plakken in chat.

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
