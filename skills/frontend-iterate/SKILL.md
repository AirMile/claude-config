---
name: frontend-iterate
description: Iterative browser-based development with inspect overlay. Injects element inspector into dev server (Vite or Next.js) for visual element-picking. Paste reference in chat for targeted edits with live HMR. Use with /frontend:iterate.
disable-model-invocation: true
metadata:
  author: mileszeilstra
  version: 2.0.0
  category: frontend
---

# Frontend Iterate

User clicks elements in browser, copies a reference, pastes in chat. Claude makes targeted edits with live HMR feedback.

## References

- `references/inspect-overlay-plugin.ts` — Vite plugin with embedded overlay script
- `references/inspect-overlay-component.tsx` — Next.js client component overlay

## FASE 0: Pre-flight

### 0.1 Framework Detection

Check `package.json` dependencies:

- `next` present → **Next.js** → skip to 0.3
- `vite` present → **Vite** → continue to 0.2
- Neither → abort: "Only Vite and Next.js projects are supported."

### 0.2 React Plugin Detection (Vite only)

Check `vite.config.ts` (or `.js`, `.mjs`) imports:

- `@vitejs/plugin-react-swc` → SWC mode (needs switch for full mode)
- `@vitejs/plugin-react` → Babel mode (ready)
- Neither → abort: "No React plugin found in vite.config"

### 0.3 Existing Setup Check

- **Vite**: Grep `vite.config` for `inspectOverlay` → found = skip to FASE 2
- **Next.js**: Check for `InspectOverlay` component import in root layout → found = skip to FASE 2

### 0.4 Dev Server Status

Check if port 3000 is in use. Track for restart after setup.

### Pre-flight Output

Report framework, plugin mode (Vite), overlay status, and dev server status.

## FASE 1A: Setup — Vite

Skip if pre-flight detected existing configuration.

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
3. Update `vite.config.ts`:
   - Add `inspectOverlay()` to plugins array
   - Add babel plugin to `react()` config (Babel mode only)
4. Restart dev server if running

## FASE 1B: Setup — Next.js

Skip if pre-flight detected existing configuration.

Next.js with Turbopack has no Babel plugin support → always degraded mode (no file:line refs, element-picking via CSS classes/text).

### Install

1. Copy `references/inspect-overlay-component.tsx` → `src/components/dev/InspectOverlay.tsx`
2. Add to root `layout.tsx`:
   - Import `InspectOverlay` from `@/components/dev/InspectOverlay`
   - Render `{process.env.NODE_ENV === "development" && <InspectOverlay />}` in `<body>`
3. HMR picks up the change automatically — no server restart needed

## FASE 2: Ready

Report overlay status including:

- Mode: Full (Babel) or Degraded
- Controls: Alt+I toggle (desktop), button bottom-right (mobile)
- Server URL: tunnel URL if cloudflared running, else localhost:3000

Then wait for user input.

## FASE 3: Iterate

Respond to user input in two patterns.

### Pattern A: File Reference Pasted

User pastes `src/components/Header.tsx:10` (or with column).

1. Read file, focus on referenced line ±30 lines context
2. Wait for instruction
3. Make targeted edit
4. Report: filepath, line, what changed

### Pattern B: Description Without Reference

User describes an element (e.g., "make the header background darker").

1. Grep for the element across components. Fallback: `browser_snapshot` to map visual description to DOM.
2. Confirm match — if ambiguous, ask.
3. Continue as Pattern A from step 2.

### Guidelines

- Minimal, targeted edits. No surrounding refactors.
- One change at a time. Multiple requests → sequential.
- No screenshots/validation after edit unless asked. Trust HMR.
- New reference pasted → new iteration immediately.
- "done" or "klaar" → acknowledge and stop.

## Teardown

Only on explicit request ("remove the overlay", "cleanup iterate").

**Vite:**

1. Delete `inspect-overlay.vite.ts`
2. Remove `inspectOverlay` import + plugin from `vite.config.ts`
3. Remove babel plugin from react() config
4. Optionally uninstall `@react-dev-inspector/babel-plugin`
5. Restart dev server

**Next.js:**

1. Delete `src/components/dev/InspectOverlay.tsx`
2. Remove `InspectOverlay` import + render from root `layout.tsx`
3. HMR removes overlay automatically
