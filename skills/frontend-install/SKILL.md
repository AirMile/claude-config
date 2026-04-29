---
name: frontend-install
description: >-
  Incremental installer for frontend tools and libraries in existing projects.
  Needs-driven flow with curated tier-1 modules and Context7 + WebSearch
  research fallback for the long tail. Always asks about the inspect overlay
  unless a specific module is passed as argument. Use with /frontend-install
  or /frontend-install [module] to jump directly to a tier-1 module.
disable-model-invocation: true
argument-hint: "[module]"
metadata:
  author: mileszeilstra
  version: 2.1.0
  category: frontend
---

# Install

Incrementele installer voor frontend tooling en libraries in **bestaande** projecten. Begint altijd met de inspect overlay vraag, daarna needs-driven met optionele research-fallback.

**Verwante skills:** `/core-setup` (one-shot project init) · `/frontend-tokens` · `/frontend-design` · `/frontend-convert` · `/frontend-audit` · `/frontend-wcag`

## References

- `references/research-flow.md` — Context7 + WebSearch protocol voor long-tail libraries
- `references/modules/{module}/setup-guide.md` — Per-module install/teardown instructies

**Tier-1 modules** (curated guides):

| Categorie | Modules                 |
| --------- | ----------------------- |
| Dev tools | inspect-overlay         |
| Styling   | tailwind, shadcn-ui     |
| Testing   | vitest, playwright      |
| Linting   | biome, eslint-prettier  |
| State     | zustand, tanstack-query |
| Forms     | react-hook-form-zod     |

Alles buiten deze set wordt afgehandeld via `references/research-flow.md`.

---

## FASE 0: Pre-flight

### 0.0 Argument Detection

Als de skill is aangeroepen met een argument (bv. `/frontend-install tailwind`):

1. Match argument (case-insensitive) tegen tier-1 module namen:
   `inspect-overlay`, `tailwind`, `shadcn-ui`, `vitest`, `playwright`, `biome`, `eslint-prettier`, `zustand`, `tanstack-query`, `react-hook-form-zod`

2. **Match gevonden** → sla module op als `direct_module`, skip FASE 1-3, ga direct naar FASE 4 Pad A na FASE 0.1-0.2.

3. **Geen match** → behandel als vrije tekst voor research mode: sla op als `direct_research`, skip FASE 1-3, ga direct naar FASE 4 Pad B na FASE 0.1-0.2.

4. **Geen argument** → normale flow (FASE 1-3 doorlopen).

### 0.1 Framework Detection

Check `package.json` dependencies:

- `next` present → **Next.js**
- `vite` present → **Vite**
- `astro` present → **Astro** (research mode only)
- `nuxt` present → **Nuxt** (research mode only)
- Geen match → abort: "No supported frontend framework detected."

### 0.2 Package Manager Detection

Check in volgorde (eerste match wint):

1. `package.json` → `"packageManager"` field (corepack): `"pnpm@x"` / `"yarn@x"` / `"bun@x"` / `"npm@x"`
2. Lockfile: `pnpm-lock.yaml` → pnpm · `yarn.lock` → yarn · `bun.lockb` → bun · `package-lock.json` → npm
3. Geen → default npm

Sla framework + package manager op voor latere fases.

### 0.3 Flow Diagram

Genereer een ASCII flowchart die het pad door deze skill toont op basis van het gedetecteerde framework. Toon FASE 1 → FASE 2 → loop tot FASE 6.

---

## FASE 1: Inspect Overlay (altijd)

### 1.1 Overlay Status

Check of overlay al geïnstalleerd is:

- **Vite**: Grep `vite.config` voor `inspectOverlay`
- **Next.js**: Check voor `client.js` in `public/_inspect/`

### 1.2 Vraag (single-select)

```yaml
header: "Inspect overlay"
question: >
  Visuele inspector voor element-picking in de browser — handig bij iteratief
  UI-werk (Ctrl+Shift+X om te activeren, klik element → kopieert referentie naar chat).
  Wil je dit instellen?
options:
  # Bij niet geïnstalleerd:
  - label: "Skip (Recommended)", description: "Sla over, ga door naar volgende stap"
  - label: "Installeer", description: "Inject overlay in dit project"
  # Bij wel geïnstalleerd:
  - label: "Skip (Recommended)", description: "Overlay is al actief, behoud"
  - label: "Teardown", description: "Verwijder overlay uit project"
multiSelect: false
```

### 1.3 Uitvoeren

Bij **Installeer** of **Teardown**:

```
Read("references/modules/inspect-overlay/setup-guide.md")
```

Volg de guide voor het gedetecteerde framework. Na voltooiing toon controls:

```
✓ Inspect overlay {geïnstalleerd | verwijderd}.

Controls (alleen bij install):
  Ctrl+Shift+X / Cmd+Shift+X    toggle aan/uit
  Click                          selecteer element → kopieer ref
  Shift+Click                    pin meerdere elementen
  Drag                           selecteer regio
  Ctrl+Z                         unpin laatste
  Escape                         wis pins / uit
```

Bij **Skip** → direct door naar FASE 2.

---

## FASE 2: Verdere Installs?

```yaml
header: "Doorgaan?"
question: "Wil je nog iets anders toevoegen aan dit project?"
options:
  - label: "Ja (Recommended)", description: "Kies een categorie"
  - label: "Nee, klaar", description: "Naar rapport"
multiSelect: false
```

Bij **Nee** → FASE 6.

---

## FASE 3: Categorie-keuze

```yaml
header: "Categorie"
question: "Wat wil je toevoegen?"
options:
  - label: "Styling", description: "Tailwind, CSS-in-JS, etc."
  - label: "UI components", description: "shadcn-ui, Radix, headless libs"
  - label: "Testing", description: "Unit (Vitest), e2e (Playwright)"
  - label: "Linting & formatting", description: "Biome of ESLint+Prettier"
  - label: "State management", description: "Client state, server state"
  - label: "Forms & validation", description: "Form libs + schema validators"
  - label: "Routing", description: "File-based of declarative routers"
  - label: "Animation", description: "Motion libraries"
  - label: "Icons", description: "Icon packs"
  - label: "Auth", description: "Auth providers en libraries"
  - label: "i18n", description: "Translation en routing"
  - label: "Analytics", description: "Privacy-first of full-stack"
  - label: "Dev tools", description: "Storybook, devtools profiling"
  - label: "Other (research)", description: "Free-form library naam → research"
multiSelect: false
```

---

## FASE 4: Optie-keuze

### Pad A — Tier-1 module beschikbaar voor categorie

Toon de tier-1 modules voor deze categorie + "Andere library (research)":

**Voorbeeld voor Styling:**

```yaml
options:
  - label: "Tailwind (Recommended)", description: "Utility-first CSS framework"
  - label: "shadcn-ui", description: "Copy-paste componenten op Tailwind + Radix"
  - label: "Andere library (research)", description: "Andere CSS oplossing zoeken"
```

Bij gekozen tier-1 module:

```
Read("references/modules/{module}/setup-guide.md")
```

Volg install/teardown stappen. Detect of al geïnstalleerd → bied install / teardown / skip aan.

### Pad B — Research mode

Bij **"Other (research)"** in FASE 3 of **"Andere library (research)"** in FASE 4:

```
Read("references/research-flow.md")
```

Volg het research-protocol:

1. Vraag de user wat ze zoeken (vrije tekst)
2. Context7: `resolve-library-id` + `query-docs` voor top-3 kandidaten
3. WebSearch: `best {category} library for {framework} 2026` voor sentiment
4. Presenteer 3 opties met trade-off matrix
5. User kiest → genereer install steps via Context7 query

---

## FASE 5: Install + Verify

1. **Install** — voer install command uit met gedetecteerde package manager:
   - npm: `npm install {pkg}`
   - pnpm: `pnpm add {pkg}`
   - yarn: `yarn add {pkg}`
   - bun: `bun add {pkg}`

2. **Configure** — bewerk configfiles per setup-guide of research-output (vite.config, tsconfig, postcss.config, etc.)

3. **Update .gitignore** — indien guide dat voorschrijft

4. **Verify** — niet-blokkerend:
   - Run `tsc --noEmit` of build command
   - Bij failure: rapporteer maar continue

5. **Loop** — terug naar FASE 2.

---

## FASE 6: Rapport

ASCII tabel met sessie-resultaat:

```
INSTALL COMPLETE

| Module          | Action     | Status    |
| --------------- | ---------- | --------- |
| inspect-overlay | install    | OK        |
| tailwind        | install    | OK        |
| {module}        | teardown   | OK        |
| {module}        | skip       | -         |

Verify:
  {build/typecheck output samenvatting}
```

**Next steps:**

1. `/frontend-tokens` → design tokens setup als styling toegevoegd is
2. `/frontend-design` → mock-driven UI design met nieuwe stack
3. `/frontend-audit` → kwaliteitscheck na meerdere installs

---

## Restrictions

This skill must **NEVER**:

- Edit project source code beyond install configuration
- Skip the inspect overlay question in FASE 1 **tenzij** een argument meegegeven is (FASE 0.0)
- Continue to FASE 5 zonder duidelijke user keuze
- Install dependencies zonder package manager match (bv. `npm install` in een pnpm project)

This skill must **ALWAYS**:

- Detect framework + package manager in FASE 0 (altijd, ook bij argument shortcut)
- Check argument in FASE 0.0 voor inspect overlay vraag
- Loop terug naar FASE 2 na elke install (incrementeel model)
- Detecteer al-geïnstalleerd state per module voor idempotentie
- Gebruik research-flow voor alles buiten tier-1 set
