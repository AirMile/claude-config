# Inspect Overlay — Setup Guide

Read this file only when the overlay is not yet installed in the project.

## Pre-flight (continued)

### Dev Server Status

Check if port 3000 is in use. Track for restart after setup.

### Pre-flight Output

Report framework, plugin mode (Vite), overlay status, and dev server status.

## Setup — Vite

### SWC to Babel Switch (conditional)

Only if `@vitejs/plugin-react-swc` detected.

Ask user:

```yaml
header: "Plugin"
question: "De inspect overlay vereist Babel voor data-attributen. Wil je switchen van SWC naar Babel?"
options:
  - label: "Ja, switch (Recommended)"
    description: "Vervangt plugin-react-swc met plugin-react. Dev builds iets trager, geen impact op production."
  - label: "Nee, zonder data-attributen"
    description: "Overlay werkt zonder exacte bestandsreferenties. Claude zoekt via tekst/classes."
multiSelect: false
```

If accepted: uninstall `@vitejs/plugin-react-swc`, install `@vitejs/plugin-react`, update vite.config import.

If declined: degraded mode — skip babel plugin, overlay works without file:line refs.

### Install & Configure

1. Install `@react-dev-inspector/babel-plugin` (Babel mode only)
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
   - Add babel plugin to `react()` config (Babel mode only)
6. Restart dev server if running

## Setup — Next.js

Next.js with Turbopack has no Babel plugin support → always degraded mode (no file:line refs, element-picking via CSS classes/text).

> **Important:** Next.js server components strip `<script>` tags from JSX. The overlay must be loaded via a `"use client"` component that injects the script with `document.createElement`.

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
6. HMR picks up the change automatically — no server restart needed

## Post-Setup Report

Report overlay status:

- Mode: Full (Babel) or Degraded
- Controls: Ctrl+Shift+X or Alt+I to toggle
- Server URL: tunnel URL if cloudflared running, else localhost:3000

Then return to SKILL.md FASE 2 (iterate loop).

## Teardown

Only on explicit request ("remove the overlay", "cleanup iterate").

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
4. HMR removes overlay automatically
