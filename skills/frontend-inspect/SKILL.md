---
name: frontend-inspect
description: >-
  One-time inspect overlay setup for Vite and Next.js projects. Injects element
  inspector for visual element-picking in browser. Run once per project to
  install, invoke again to remove. Use with /frontend-inspect.
disable-model-invocation: true
metadata:
  author: mileszeilstra
  version: 1.0.0
  category: frontend
---

# Inspect

Eenmalige setup van de inspect overlay voor visueel element-picking in de browser. Na installatie werkt de overlay onafhankelijk — geen skill nodig voor iteratie.

**Verwante skills:** `/frontend-tokens` · `/frontend-plan` · `/frontend-compose` · `/frontend-convert` · `/frontend-audit` · `/frontend-wcag`

## References

- `references/setup-guide.md` — Installatie-instructies (Vite + Next.js)
- `references/inspect-overlay-plugin.ts` — Vite plugin
- `references/babel-plugin-inspector.js` — Babel plugin voor Next.js full mode
- `references/inspect-overlay-client.js` — Universele vanilla JS overlay
- `references/inspect-overlay-component.tsx` — React component wrapper

---

## FASE 1: Setup

### 1.1 Framework Detection

Check `package.json` dependencies:

- `next` present → **Next.js**
- `vite` present → **Vite**
- Neither → abort: "Only Vite and Next.js projects are supported."

### 1.2 Overlay Status

Check if overlay already installed:

- **Vite**: Grep `vite.config` for `inspectOverlay`
- **Next.js**: Check for `client.js` in `public/_inspect/`

**Already installed:**

```yaml
header: "Overlay"
question: "Inspect overlay is al geïnstalleerd. Wat wil je doen?"
options:
  - label: "Teardown", description: "Overlay verwijderen uit het project"
  - label: "Annuleren (Recommended)", description: "Niets doen"
multiSelect: false
```

If "Teardown" → ga naar FASE 2.
If "Annuleren" → exit.

**Not installed → installeer:**

```
Read("references/setup-guide.md")
```

Volg de setup guide voor het gedetecteerde framework. De guide bevat:

- SWC→Babel switch vraag (Vite) of Babel mode vraag (Next.js)
- Bestanden kopiëren en configureren
- `.gitignore` entries toevoegen
- Dev server herstarten

### 1.3 Post-Setup Report

```
✓ Inspect overlay geïnstalleerd.
  Framework: {Next.js | Vite}
  Mode:      {Full (Babel) | Degraded}

  Controls:
  Ctrl+Shift+X            toggle inspect aan/uit (Win/Linux)
  Cmd+Shift+X             toggle inspect aan/uit (Mac)
  Click                   selecteer element → kopieer referentie
  Shift+Click             pin meerdere elementen
  Drag                    selecteer regio
  Ctrl+Z                  unpin laatste element
  Escape                  wis pins / uit als geen pins

  Plak een referentie in chat om gerichte edits te maken.
```

Skill eindigt hier. Geen iterate loop — de gebruiker itereert direct in chat.

---

## FASE 2: Teardown

Alleen bereikbaar als overlay al geïnstalleerd is (via 1.2).

Volg de Teardown sectie in `references/setup-guide.md`. Bevat:

- Vite: verwijder plugin bestanden, config entries, optioneel packages
- Next.js: verwijder `public/_inspect/`, component, layout import, optioneel Babel config

```yaml
header: "Bevestig"
question: "Overlay en alle gerelateerde bestanden verwijderen?"
options:
  - label: "Ja, verwijder", description: "Alle overlay bestanden en config verwijderen"
  - label: "Nee, annuleren (Recommended)", description: "Behoud overlay"
multiSelect: false
```

Na teardown: herstart dev server indien nodig.

```
✓ Inspect overlay verwijderd.
```

---

## Restrictions

This skill must **NEVER**:

- Enter an iterate loop (setup/teardown only)
- Make edits to project code beyond overlay configuration
- Skip the user confirmation before teardown

This skill must **ALWAYS**:

- Detect framework before any setup action
- Follow `references/setup-guide.md` for installation steps
- Report overlay status and controls after setup
- Confirm before teardown
