# Install mode

Incrementele installer voor frontend tooling en libraries in **bestaande** projecten. Begint altijd met de inspect overlay vraag, daarna needs-driven met optionele research-fallback.

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

## Process

**Fase tracking** — eerste actie van de skill: roep `TaskCreate` aan met deze 7 items (status `pending`), daarna gebruik `TaskUpdate` om per fase `in_progress` te zetten aan begin en `completed` aan einde. Bij context compaction blijft de task list zichtbaar — geen risico op vergeten fases.

1. FASE 0: Pre-flight
2. FASE 1: Inspect Overlay
3. FASE 2: Verdere Installs
4. FASE 3: Categorie-keuze
5. FASE 4: Optie-keuze
6. FASE 5: Install + Verify
7. FASE 6: Rapport

## FASE 0: Pre-flight

> **Todo**: roep `TaskCreate` aan met de 7 fase-items (zie boven). Markeer FASE 0 → `in_progress` via `TaskUpdate`.

### 0.0 Argument Detection

Als de skill is aangeroepen met een argument (bv. `/core-setup tailwind`):

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

Genereer een ASCII flowchart die het pad door deze mode toont op basis van het gedetecteerde framework. Toon FASE 1 → FASE 2 → loop tot FASE 6.

### 0.4 Stack-keys mapping

Bij elke succesvolle install schrijft FASE 5 stap 5b de module-keuze naar `project.json`:

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
| inspect-overlay     | (geen — dev-only tool)                  |

`stack.packages[]` wordt **afgeleid uit `package.json`** na de install — niet uit een hardcoded lijst (zie FASE 5 stap 5a). Dit werkt automatisch correct voor elke library, inclusief research-mode en multi-package installs (shadcn-ui, eslint+prettier).

---

## FASE 1: Inspect Overlay (altijd)

> **Todo**: markeer FASE 0 → `completed`, FASE 1 → `in_progress`.

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

> **Todo**: markeer FASE 1 → `completed`, FASE 2 → `in_progress`.

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

## Pre-FASE 3: Stack snapshot

Lees `.project/project.json#stack` (als het bestand bestaat). Cache het object voor gebruik in FASE 3 categorie-prompts.

Skip silent als `project.json` ontbreekt — render dan de standaard categorie-prompt zonder slot-status.

---

## FASE 3: Categorie-keuze

> **Todo**: markeer FASE 2 → `completed`, FASE 3 → `in_progress`.

Render de prompt op basis van de gecachte stack-snapshot:

| Situatie            | Label-formaat                              |
| ------------------- | ------------------------------------------ |
| Slot gevuld         | `"{Categorie}: {waarde} ✓ — wijzig?"`      |
| Slot leeg           | `"{Categorie}: (leeg) — kies optie"`       |
| Geen `project.json` | `"{Categorie} — {standaard omschrijving}"` |

Categorie ↔ stack-key mapping:

| Categorie            | stack-key(s)                                             |
| -------------------- | -------------------------------------------------------- |
| Styling              | `stack.styling`                                          |
| UI components        | `stack.componentLibrary`                                 |
| Testing              | `stack.testing.unit` + `stack.testing.e2e` (toon beide)  |
| Linting & formatting | `stack.linting`                                          |
| State management     | `stack.state.client` + `stack.state.server` (toon beide) |
| Forms & validation   | `stack.forms`                                            |

Categorieën zonder mapping (Routing, Animation, Icons, Auth, i18n, Analytics, Dev tools, Other) tonen altijd de standaard omschrijving, ongeacht snapshot.

```yaml
header: "Categorie"
question: "Wat wil je toevoegen?"
options:
  - label: "Styling [context-aware]", description: "Tailwind, CSS-in-JS, etc."
  - label: "UI components [context-aware]", description: "shadcn-ui, Radix, headless libs"
  - label: "Testing [context-aware]", description: "Unit (Vitest), e2e (Playwright)"
  - label: "Linting & formatting [context-aware]", description: "Biome of ESLint+Prettier"
  - label: "State management [context-aware]", description: "Client state, server state"
  - label: "Forms & validation [context-aware]", description: "Form libs + schema validators"
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

`[context-aware]` labels worden vervangen door het juiste formaat uit bovenstaande tabel. Geen hardcoded YAML-permutaties — de instructie boven de YAML beschrijft het renderingsgedrag.

---

## FASE 4: Optie-keuze

> **Todo**: markeer FASE 3 → `completed`, FASE 4 → `in_progress`.

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

> **Todo**: markeer FASE 4 → `completed`, FASE 5 → `in_progress`.

0. **State check** — raadpleeg de "Detection" sectie van de setup-guide (al geladen in FASE 4 Pad A). Bepaal tri-state:

   | State                          | Actie                              |
   | ------------------------------ | ---------------------------------- |
   | `already-installed-configured` | skip stap 1+2, ga door naar stap 3 |
   | `installed-not-configured`     | skip stap 1, begin bij stap 2      |
   | `not-installed`                | normale flow (stap 1+2+3+...)      |

   Research-mode (Pad B): altijd `not-installed` aannemen (geen setup-guide beschikbaar).

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

5. **Sync project context** — skip silent als `.project/project.json` ontbreekt.

   Volg `shared/SYNC.md` protocol (re-read project.json direct vóór write):

   a. Lees `package.json#dependencies` + `package.json#devDependencies` na de install.
   Voor elke entry: append `{ name, version, purpose }` naar `stack.packages[]`
   (`purpose: "devDependency"` voor devDeps, `"dependency"` voor deps).
   Skip als entry met dezelfde `name` al bestaat (idempotent).
   Modules zonder NPM-install (inspect-overlay) voegen niets toe aan package.json →
   diff is leeg → no-op, geen speciale uitzondering nodig.

   b. Voor tier-1 modules: schrijf de specifieke `stack.{key}` uit de FASE 0.4 mapping-tabel.
   - Waarde al gelijk → skip (idempotent).
   - Andere waarde aanwezig:

     ```yaml
     header: "Stack conflict"
     question: "stack.{key} is al ingesteld op '{bestaande waarde}'. Overschrijven?"
     options:
       - label: "Ja, overschrijf naar '{nieuwe waarde}'"
         description: "Update stack context naar nieuwe keuze"
       - label: "Nee, behoud '{bestaande waarde}'"
         description: "Packages geïnstalleerd, key ongewijzigd"
     multiSelect: false
     ```

   c. Voor research-mode (Pad B): vraag of de library in een bekende stack-slot hoort.

   ```yaml
   header: "Stack slot"
   question: >
     '{library}' geïnstalleerd. In welke stack-categorie hoort dit?
     (overslaan = alleen in stack.packages[])
   options:
     - label: "Skip (Recommended)"
       description: "Geen stack.{key} update — packages[] is genoeg"
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

   Bij gekozen slot: hergebruik conflict-detectie uit stap 5b (waarde gelijk → skip; andere waarde aanwezig → AskUserQuestion overschrijven).

   d. Als `CLAUDE.md` bestaat én een `### Stack` sectie heeft:
   - Call `references/claude-md-sync.md` met:
     - `mode: "mature"`
     - `generate-if-missing: false`
     - `stack-overwrite: "ask"`
     - `inferred-stack:` stack-object na stap a+b

6. **Loop** — terug naar FASE 2.

---

## FASE 6: Rapport

> **Todo**: markeer FASE 5 → `completed`, FASE 6 → `in_progress`.

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

Project context: {N} velden bijgewerkt in project.json / n.v.t.
CLAUDE.md:       {M} secties bijgewerkt / al compleet / n.v.t.
```

**Next steps:**

1. `/frontend-tokens` → design tokens setup als styling toegevoegd is
2. `/frontend-design` → mock-driven UI design met nieuwe stack
3. `/frontend-check` → kwaliteitscheck na meerdere installs

> **Todo**: markeer FASE 6 → `completed`.

---

## Restrictions

This mode must **NEVER**:

- Edit project source code beyond install configuration
- Skip the inspect overlay question in FASE 1 **tenzij** een argument meegegeven is (FASE 0.0)
- Continue to FASE 5 zonder duidelijke user keuze
- Install dependencies zonder package manager match (bv. `npm install` in een pnpm project)

This mode must **ALWAYS**:

- Detect framework + package manager in FASE 0 (altijd, ook bij argument shortcut)
- Check argument in FASE 0.0 voor inspect overlay vraag
- Loop terug naar FASE 2 na elke install (incrementeel model)
- Detecteer tri-state per module in FASE 5 stap 0 (already-configured / installed-not-configured / not-installed)
- Derive `stack.packages[]` uit `package.json` na install — nooit uit hardcoded lijsten
- Gebruik research-flow voor alles buiten tier-1 set
