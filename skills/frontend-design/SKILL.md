---
name: frontend-design
description: >-
  Design spec management for pages and components — Claude Design brief generator + in-Claude-Code
  code generator for PAGE and COMPONENT features. Capture mode manages pages, flows, design principles
  and components in project.json — including screenshot-import (single/multi) and checkpoint-restore.
  Brief mode generates markdown briefs for Claude Design (page or component). Build mode generates
  working code for PAGE/COMPONENT features with status DEF without visual reference material.
  Works standalone — no dev-pipeline needed. Use with /frontend-design [name] or /frontend-design.
reads: [devinfo.handoff, backlog.status, feature.requirements, feature.files]
writes: [devinfo.handoff, devinfo.tokenDrift]
metadata:
  author: mileszeilstra
  version: 2.7.0
  category: frontend
---

# Design

Drie modi:

1. **Capture** — beheert de design specificatie van het project (pagina's, user flows, design principes, components) in `.project/project.json` → `design`. Iteratief aan te roepen.
2. **Brief** — genereert een markdown brief op basis van de design spec + block inventory uit de dev-pipeline + tokens + patterns. Output plak je in Claude Design als context. Het visuele werk gebeurt daar; de handoff bundle uit Claude Design gaat terug naar Claude Code (`/frontend-convert`). Ondersteunt page-briefs en component-briefs.
3. **Build** — genereert werkende code voor backlog-features (PAGE of COMPONENT) met `status: DEF` waarvoor geen visueel referentiemateriaal beschikbaar is. Hergebruikt tokens + spec + bestaande components. Voor visuele input (screenshot/Figma/URL): gebruik `/frontend-convert`.

**Verwante skills:** `/frontend-tokens` · `/frontend-convert` · `/core-setup` · `/frontend-check`

**Output locaties:**

- Capture mode: `.project/project.json` → `design` sectie
- Brief mode: `.project/claude-design-brief.md`

## References

- `../shared/DASHBOARD.md` — project.json schema en merge-strategieën
- `../shared/DESIGN.md` — Anti-patterns, color, typography, motion, UX writing
- `../shared/DEVINFO.md` — Session tracking, cross-skill handoff
- `../shared/BACKLOG.md` — Backlog HTML+JSON format, read/write protocol
- `../shared/CODEGEN.md` — Code-gen patronen: block inventory, token mapping, output structure, a11y scaffold (Build route)

---

## Design JSON Schema

De `design` sectie in `project.json` volgt dit schema:

```json
{
  "pages": [
    {
      "name": "dashboard",
      "purpose": "Overzicht met metrics en status",
      "status": "DEF",
      "sections": ["hero", "metrics-grid", "activity-feed"],
      "flows": ["login → dashboard", "dashboard → settings"],
      "uses": [],
      "notes": ""
    }
  ],
  "flows": [
    {
      "name": "onboarding",
      "steps": ["landing", "signup", "verify-email", "dashboard"],
      "notes": ""
    }
  ],
  "principles": [
    {
      "name": "Mobile-first",
      "description": "Design voor mobile viewport eerst, progressive enhancement"
    }
  ],
  "components": [
    {
      "name": "Button",
      "purpose": "Primaire actie-trigger met icon-support",
      "status": "DEF",
      "scope": "atomic",
      "appliesTo": "all",
      "variants": ["primary", "ghost", "destructive"],
      "sizes": ["sm", "md", "lg"],
      "states": ["default", "hover", "disabled", "loading"],
      "props": ["label", "icon?", "onClick", "disabled?"],
      "slots": [],
      "usedIn": [],
      "notes": ""
    }
  ]
}
```

**Status waarden (pages en components):** `IDEA` | `DEF` | `BLT` | `DONE`

**`pages[].uses[]`** — auto-onderhouden door Build/convert post-pass. Lijst van component-namen die deze page importeert. Niet handmatig editen.

**`components[].usedIn[]`** — auto-onderhouden door Build/convert post-pass. Lijst van page-namen die deze component importeren. Niet handmatig editen.

**`components[].scope`:**

| Waarde    | Betekenis                                                   | Voorbeeld               |
| --------- | ----------------------------------------------------------- | ----------------------- |
| `atomic`  | Klein herbruikbaar element                                  | Button, Input, Avatar   |
| `section` | Composiet binnen één page                                   | StatCard, ProductCard   |
| `layout`  | Multi-page wrapper, leeft in `app/layout.tsx` of equivalent | NavBar, Footer, Sidebar |

**`components[].appliesTo`:** `"all"` | `["page1", "page2"]` | `"route-group:groupname"` (alleen relevant voor `scope: layout`)

**Merge-strategie:** `MERGE op name` — pages/flows/principles/components merge op naam, update velden, nooit auto-delete.

---

## Verboden keuzes (anti-slop)

NOOIT gebruiken zonder expliciete reden van de gebruiker. Deze keuzes signaleren AI-gegenereerd werk en convergeren naar generieke output:

- **Fonts**: Inter, Roboto, Arial, system-ui, Space Grotesk
- **Kleurenschema's**: paarse gradiënten op witte achtergrond, tech-startup blauw (#3B82F6 / Tailwind default), generieke "AI purple"
- **Layouts**: 3-kolom features-grid met emoji icons, hero-with-gradient-mesh, centered-narrow-column blog template
- **Component clichés**: floating glass cards, "trusted by" logo bar, gradient text op heading, blur-orb backgrounds, generic "modern SaaS" hero

In plaats daarvan: kies een context-specifieke richting met intentie. Varieer tussen runs — twee opeenvolgende design sessies mogen niet convergeren naar dezelfde fonts/kleuren.

---

## State Machine

```
[*] → PREFLIGHT

PREFLIGHT → ARG_KNOWN (pass + argument matcht bestaand entity)
PREFLIGHT → ARG_UNKNOWN (pass + argument gegeven maar onbekend)
PREFLIGHT → ACTION_SELECT (pass + geen argument)
PREFLIGHT → ERROR (fail)

ARG_KNOWN → BUILD (keuze: Build)
ARG_KNOWN → BRIEF (keuze: Brief)
ARG_KNOWN → PAGINA (keuze: Edit spec, PAGE entity)
ARG_KNOWN → COMPONENT (keuze: Edit spec, COMPONENT entity)
ARG_KNOWN → AANMAKEN (keuze: Capture als nieuw)

ARG_UNKNOWN → PAGINA (keuze: Nieuwe pagina)
ARG_UNKNOWN → COMPONENT (keuze: Nieuwe component)
ARG_UNKNOWN → [*] (keuze: Annuleer)

ACTION_SELECT → AANMAKEN (empty state)
ACTION_SELECT → IMPORTEREN (empty state)
ACTION_SELECT → BUILD (populated + ≥1 PAGE or COMPONENT DEF without visuals)
ACTION_SELECT → BEKIJKEN (populated)
ACTION_SELECT → PAGINA (populated)
ACTION_SELECT → COMPONENT (populated)
ACTION_SELECT → FLOW (populated)
ACTION_SELECT → PRINCIPES (populated)
ACTION_SELECT → VERWIJDEREN (populated)
ACTION_SELECT → HERSTELLEN (populated, history exists)

AANMAKEN → CONFIRM
IMPORTEREN → CONFIRM
BUILD → BUILD_ENTITY (PAGE or COMPONENT kiezen)
BUILD_ENTITY → BUILD_COMPLETE (smoke success)
BUILD_ENTITY → BUILD_REFINE (smoke fail → "Refine")
BUILD_ENTITY → ACTION_SELECT (smoke fail → "Handmatig fixen" of max retries bereikt)
BUILD_REFINE → BUILD_ENTITY (re-run smoke — max 3 rondes)
BUILD_REFINE → ACTION_SELECT ("Handmatig fixen" of "Accepteren as-is")
BEKIJKEN → ACTION_SELECT ("Aanpassen")
BEKIJKEN → [*] ("Klaar")
PAGINA → CONFIRM
COMPONENT → CONFIRM
FLOW → CONFIRM
PRINCIPES → CONFIRM
VERWIJDEREN → CONFIRM
HERSTELLEN → POSTFLIGHT ("Ja" — skip X.0)
HERSTELLEN → [*] ("Annuleren")

CONFIRM → POSTFLIGHT ("Ja")
CONFIRM → ACTION_SELECT ("Aanpassen" — loop back)
CONFIRM → [*] ("Annuleren")

POSTFLIGHT → COMPLETE (pass)
POSTFLIGHT → RECOVER (fail)

BUILD_COMPLETE → [*]
COMPLETE → [*]
```

---

## Read/Write Protocol

### Reading

1. Read `.project/project.json` (detect if missing)
2. Parse as JSON
3. Access `design` section (may be empty `{}`, undefined, or populated)

### Writing

1. Read `.project/project.json` (or create new with EMPTY schema from `shared/DASHBOARD.md` if missing)
2. Parse JSON
3. Mutate ONLY the `design` section (other sections UNTOUCHED)
4. Write back as `JSON.stringify(data, null, 2)`

**Nieuw bestand aanmaken** als `.project/project.json` niet bestaat: gebruik het EMPTY schema uit `shared/DASHBOARD.md`, voeg `design` sectie toe:

```json
"design": {
  "pages": [],
  "flows": [],
  "principles": [],
  "components": []
}
```

### Merge Logic

For each page/flow/principle/component:

1. Find by `name` in existing array
2. If not found: push new item
3. If found: update fields (purpose, status, sections, flows, notes, steps, description, scope, appliesTo, variants, sizes, states, props, slots)
4. Never auto-delete items (only via explicit "Verwijderen" route)
5. `pages[].uses[]` and `components[].usedIn[]` are auto-maintained by Build post-pass — never overwrite during merge

---

## FASE 0: Pre-flight

### 0.1 Directory Check

Check `.project/` exists. If not, create it.

```
Directory: [✓|✗] .project/ — [exists | created | error]
```

### 0.2 Session Check

Read `.project/session/devinfo.json` for handoff from upstream skill.

```
Session: [✓] [New session | Continuing from {skill}]
```

### 0.3 Design State Check

Read `.project/project.json` and check if `design` section has data.

```
Design: [empty — guided setup beschikbaar | {N} pagina's, {M} flows, {P} principes, {C} components]
```

### 0.5 Argument Detection

Detect of een naam als argument is meegegeven (`/frontend-design {naam}`).

```
$SKILL_ARG = argument na /frontend-design (leeg als geen argument)
```

**Als `$SKILL_ARG` niet leeg:**

1. Check `design.pages[]` → entry met `name === $SKILL_ARG`? → `$ARG_MODE = "A"`, `$ARG_TYPE = "PAGE"`
2. Check `design.components[]` → entry met `name === $SKILL_ARG`? → `$ARG_MODE = "A"`, `$ARG_TYPE = "COMPONENT"`
3. Check backlog → PAGE/COMPONENT feature met `name === $SKILL_ARG`? → `$ARG_MODE = "A"`, `$ARG_TYPE = backlog type`
4. Geen match → `$ARG_MODE = "B"`, `$ARG_NAME = $SKILL_ARG`

**Als `$SKILL_ARG` leeg:** `$ARG_MODE = "C"`

Voeg toe aan pre-flight summary:

```
Argument:   [geen | "{naam}" → MODE A ({type} gevonden) | "{naam}" → MODE B (onbekend)]
```

### 0.4 Learnings Load

**Learnings load** via [shared/LEARNINGS-LOAD.md](../shared/LEARNINGS-LOAD.md):

```
scopes: [component]
pitfall-prefix: true
global-memory: true
current-feature: <page-name als capture/iterate-mode op 1 pagina, anders "none">
```

UI/UX patterns en pitfalls uit eerdere designs sturen consistente keuzes (component naming, layout patterns, accessibility gotchas). Skip stilzwijgend als geen learnings beschikbaar.

**On failure:** AskUserQuestion:

```yaml
header: "Pre-flight"
question: "Pre-flight check gefaald. Hoe wil je doorgaan?"
options:
  - label: "Fix en retry (Recommended)", description: "Probeer het probleem op te lossen"
  - label: "Doorgaan anyway", description: "Negeer en ga door"
  - label: "Annuleren", description: "Stop"
multiSelect: false
```

**Show pre-flight summary:**

```
PRE-FLIGHT CHECK
════════════════════════════════════════════════
Directory:  [✓|✗] .project/
Session:    [✓] [status]
Design:     [empty | {N} pages, {M} flows, {P} principles]
════════════════════════════════════════════════
```

---

## FASE 1: Actie Selectie

Branching op basis van `$ARG_MODE` (bepaald in FASE 0.5).

---

### Mode A — Bestaand entity (`$ARG_MODE = "A"`)

Entity gevonden in design[]/backlog. Toon entity-specifieke acties direct:

```yaml
header: "Wat wil je met {naam} doen?"
question: "{$ARG_TYPE} '{naam}' — {status}, {korte spec-samenvatting uit design.*}"
options:
  - label: "Build met Claude Code (Recommended)"
    description: "Genereer code direct naar repo"
  - label: "Brief voor Claude Design"
    description: "Markdown handoff voor Claude Design / Figma"
  - label: "Edit spec"
    description: "Naam, scope, variants of beschrijving aanpassen"
  - label: "Capture als nieuw (andere naam)"
    description: "Ik bedoelde een andere {$ARG_TYPE} — voer nieuwe naam in"
multiSelect: false
```

Routing:

- "Build" → Route: Build (met `$ARG_TYPE` en `$ARG_ENTITY` vooringesteld, skip entity-keuze)
- "Brief" → Route: Brief (met entity vooringesteld)
- "Edit spec" → Route: Pagina of Component (afhankelijk van `$ARG_TYPE`, in edit-modus)
- "Capture als nieuw" → vraag nieuwe naam → Route: Pagina of Component (in create-modus)

---

### Mode B — Onbekende naam (`$ARG_MODE = "B"`)

Naam `$ARG_NAME` staat niet in design[]/backlog.

```yaml
header: "'{$ARG_NAME}' is niet bekend"
question: "Wat wil je aanmaken?"
options:
  - label: "Nieuwe pagina"
    description: "Capture flow voor PAGE met naam {$ARG_NAME}"
  - label: "Nieuwe component"
    description: "Capture flow voor COMPONENT met naam {$ARG_NAME}"
  - label: "Annuleer"
    description: "Verkeerde naam — stop zonder iets aan te maken"
multiSelect: false
```

Routing:

- "Nieuwe pagina" → Route: Pagina (naam vooringevuld)
- "Nieuwe component" → Route: Component (naam vooringevuld)
- "Annuleer" → exit

---

### Mode C — Geen argument (`$ARG_MODE = "C"`)

Gebruik bestaande design-state branching:

#### If design section EMPTY (or project.json missing):

```yaml
header: "Design"
question: "Geen design spec gevonden. Wat wil je doen?"
options:
  - label: "Aanmaken (Recommended)", description: "Nieuwe design spec met guided setup"
  - label: "Importeren", description: "Design extraheren uit bestaande codebase"
multiSelect: false
```

### If design section HAS DATA:

Detecteer eerst:

- `$HAS_BUILD_CANDIDATES` (true/false): zijn er PAGE- of COMPONENT-features met `status: DEF` op de backlog waarvoor géén visuele referentie bestaat in `.project/wireframes/` of `design.pages[]/design.components[].screenshots[]`?
- `$HAS_PAGE_CANDIDATES` (true/false): subset van bovenstaande, alleen PAGE-type.
- `$HAS_COMPONENT_CANDIDATES` (true/false): subset van bovenstaande, alleen COMPONENT-type.

```yaml
header: "Design"
question: "Design spec gevonden ({N} pagina's, {M} flows, {P} principes, {C} components). Wat wil je doen?"
# Als $HAS_BUILD_CANDIDATES = true:
options:
  - label: "Build (Recommended)", description: "Genereer code voor {X} PAGE/COMPONENT(s) met status DEF — geen visueel materiaal nodig"
  - label: "Brief genereren", description: "Markdown brief voor Claude Design (page of component)"
  - label: "Bekijken", description: "Toon huidige design spec"
  - label: "Pagina", description: "Pagina toevoegen of bewerken"
  - label: "Component", description: "Component toevoegen of bewerken"
# Als $HAS_BUILD_CANDIDATES = false:
options:
  - label: "Brief genereren (Recommended)", description: "Markdown brief voor Claude Design (page of component)"
  - label: "Bekijken", description: "Toon huidige design spec"
  - label: "Pagina", description: "Pagina toevoegen of bewerken"
  - label: "Component", description: "Component toevoegen of bewerken"
multiSelect: false
```

"Other" opties: "Flow" (flows beheren), "Principes" (principes beheren), "Verwijderen" (pagina/component/flow/principe verwijderen), "Herstellen" (terug naar eerdere design staat — alleen tonen als `.project/session/design-history.json` bestaat en niet leeg is).

---

## FASE 2: Actie Uitvoering

### Route: Aanmaken (First-Time Setup)

Guided 4-step creation flow.

#### Stap 1: Projectcontext

Check for concept:

1. Primary: check if `.project/project-concept.md` exists → Read als plain markdown
2. Fallback: check if `concept` section exists in project.json met non-empty `concept.content`

**If concept exists (uit project-concept.md of project.json):**

```
PROJECT CONTEXT
════════════════════════════════════════════════
Bron:    {project-concept.md | project.json}
Naam:    {concept.name}
Concept: {concept.content — first 200 chars}
════════════════════════════════════════════════
```

```yaml
header: "Context"
question: "Klopt deze context nog?"
options:
  - label: "Ja, ga door (Recommended)", description: "Context is correct"
  - label: "Ik pas het aan", description: "Beschrijf de context opnieuw"
multiSelect: false
```

**If no concept:**

```yaml
header: "Context"
question: "Beschrijf kort wat je bouwt en voor wie."
options:
  - label: "Ik typ het uit", description: "Vrije beschrijving"
multiSelect: false
```

Store context for generating relevant page suggestions.

#### Stap 2: Pagina's definiëren

```yaml
header: "Pagina's"
question: "Welke pagina's heeft je app nodig? Beschrijf naam + doel per pagina."
options:
  - label: "Ik typ ze uit (Recommended)", description: "Beschrijf elke pagina vrij"
  - label: "Standaard set", description: "Home, Dashboard, Settings, Login/Register"
  - label: "Later", description: "Sla pagina's over, voeg later toe"
multiSelect: false
```

**If "Standaard set":** Generate 4 default pages with generic purposes based on project context. Present for confirmation.

**If "Ik typ ze uit":** User provides free-text list. Parse into structured page objects:

For EACH page, generate:

- `name`: slug-case (e.g., "dashboard", "user-settings")
- `purpose`: 1-2 sentences derived from user description
- `status`: `DEF`
- `sections`: derived from purpose (e.g., dashboard → "metrics-grid", "activity-feed")
- `flows`: initially empty (filled after flow definition)
- `notes`: empty

Show summary table:

```
PAGINA'S
════════════════════════════════════════════════
| Naam      | Doel                          | Secties                      | Status |
|-----------|-------------------------------|------------------------------|--------|
| dashboard | Overzicht met metrics         | hero, metrics-grid, feed     | DEF    |
| settings  | Account instellingen          | profile-form, notifications  | DEF    |
════════════════════════════════════════════════
```

#### Stap 2b: Design Alternatieven (optioneel)

Bij pagina's met ≥3 secties, bied aan:

```yaml
header: "Alternatieven"
question: "Wil je alternatieve layouts vergelijken voor {page-name}?"
options:
  - label: "Nee, ga door (Recommended)", description: "Huidige indeling is goed"
  - label: "Ja, 2 alternatieven", description: "Genereer 2 radicaal andere sectiedelingen"
multiSelect: false
```

**Als "Ja":** spawn 2 agents parallel, elk met een andere constraint:

- Agent 1: "Minimaliseer secties — max 2, combineer waar mogelijk"
- Agent 2: "Maximaliseer focus — elke sectie heeft één doel"

Presenteer de 3 opties (origineel + 2 alternatieven) als ASCII wireframes.
User kiest via AskUserQuestion welke layout, of combineert elementen.

Bij pagina's met <3 secties: skip deze stap.

```yaml
header: "Pagina's"
question: "Kloppen deze pagina's?"
options:
  - label: "Ja, ga door (Recommended)", description: "Ga naar flows"
  - label: "Aanpassen", description: "Ik wil iets wijzigen"
multiSelect: false
```

If "Aanpassen": ask what to change, update, re-confirm.

#### Stap 3: User Flows

```yaml
header: "Flows"
question: "Welke user flows zijn belangrijk? (bijv. onboarding, checkout, account setup)"
options:
  - label: "Ik typ ze uit (Recommended)", description: "Beschrijf elke flow met stappen"
  - label: "Afleiden uit pagina's", description: "Genereer flows op basis van gedefinieerde pagina's"
  - label: "Later", description: "Sla flows over, voeg later toe"
multiSelect: false
```

**If "Afleiden uit pagina's":** Analyze defined pages and generate logical flows:

- Login-flow if login page exists
- Navigation flows between related pages
- CRUD flows if form pages exist

Present for confirmation.

**If "Ik typ ze uit":** User provides descriptions. Parse into structured flow objects:

- `name`: descriptive name
- `steps`: array of page names as flow steps
- `notes`: empty

**Cross-reference:** For each step in a flow, check if the page exists in the defined pages. If not:

```
⚠ Flow "{flow}" refereert naar pagina "{page}" die nog niet gedefinieerd is.
```

Offer to add missing pages.

Show summary:

```
FLOWS
════════════════════════════════════════════════
| Naam        | Stappen                                    |
|-------------|--------------------------------------------|
| onboarding  | landing → signup → verify → dashboard      |
| settings    | dashboard → settings → save → dashboard    |
════════════════════════════════════════════════
```

#### Stap 4: Design Principes

```yaml
header: "Principes"
question: "Welke design principes gelden?"
options:
  - label: "Standaard set (Recommended)", description: "Mobile-first, Consistent spacing, Accessibility (WCAG AA)"
  - label: "Ik definieer zelf", description: "Eigen principes opgeven"
  - label: "Later", description: "Sla principes over, voeg later toe"
multiSelect: false
```

**If "Standaard set":** Generate:

- Mobile-first: "Design voor mobile viewport eerst, progressive enhancement"
- Consistent spacing: "Gebruik een spacing scale voor alle margins en padding"
- Accessibility: "WCAG 2.1 AA compliance, semantische HTML, keyboard navigatie"

**If "Ik definieer zelf":** Free-text input, parse into `{ name, description }` objects.

#### Stap 5: Samenvatting

Show complete summary:

```
DESIGN SPEC SAMENVATTING
════════════════════════════════════════════════

Pagina's ({N}):
| Naam      | Doel                    | Secties                  | Status |
|-----------|-------------------------|--------------------------|--------|
| dashboard | Overzicht met metrics   | hero, metrics-grid, feed | DEF    |
| settings  | Account instellingen    | profile-form, notifs     | DEF    |

Flows ({M}):
| Naam       | Stappen                                 |
|------------|-----------------------------------------|
| onboarding | landing → signup → verify → dashboard   |

Principes ({P}):
| Naam          | Beschrijving                                     |
|---------------|--------------------------------------------------|
| Mobile-first  | Design voor mobile viewport eerst                |
| Accessibility | WCAG 2.1 AA compliance, semantische HTML         |

════════════════════════════════════════════════
```

Proceed to FASE 3 (Confirm).

---

### Route: Importeren (Extract from Codebase or Screenshot)

#### Stap 0: Input Selectie

```yaml
header: "Importeren"
question: "Wat is je input?"
options:
  - label: "Codebase (Recommended)", description: "Scan framework bestanden voor pagina's en flows"
  - label: "Screenshot", description: "Analyseer een screenshot van een bestaand design"
multiSelect: false
```

**Als "Screenshot":** ga naar Stap 0b. **Als "Codebase":** ga naar Stap 1.

#### Stap 0b: Screenshot Analyse

1. **Detecteer input-methode:**
   - Als er **meerdere afbeeldingen** in de conversatie zitten → meld aantal en ga direct naar analyse:
     ```
     ℹ {N} screenshots gedetecteerd — elke afbeelding wordt als aparte pagina geanalyseerd.
     ```
   - Als er **één afbeelding** in de conversatie zit → gebruik die direct.
   - Als er **geen afbeelding** in de conversatie zit:

     ```yaml
     header: "Screenshot"
     question: "Voeg een screenshot toe aan je volgende bericht, of geef een bestandspad op."
     options:
       - label: "Ik voeg hem toe (Recommended)", description: "Sleep of gebruik de bijlage-knop in VSCode"
       - label: "Bestandspad", description: "Geef een absoluut of relatief pad op"
     multiSelect: false
     ```

     - "Ik voeg hem toe": wacht op het volgende bericht en gebruik de meegestuurde afbeelding(en).
     - "Bestandspad": lees de afbeelding via Read tool op het opgegeven pad.

2. **Analyseer visueel (Claude Vision):**

   Per afbeelding afzonderlijk:
   - Detecteer paginatype (landing, dashboard, form, checkout, settings, etc.)
   - Identificeer zichtbare secties (hero, nav, sidebar, content-area, footer, cards, etc.)
   - Leid doel af uit de lay-out en zichtbare content

   Bij meerdere afbeeldingen: spawn N agents parallel (één per afbeelding), merge resultaten, toon voortgang:

   ```
   Afbeelding 1/{N}: [paginatype] — {M} secties gedetecteerd
   Afbeelding 2/{N}: [paginatype] — {M} secties gedetecteerd
   ...
   ```

3. **Genereer page object per afbeelding:**

   ```json
   {
     "name": "{slug van paginatype}",
     "purpose": "{afgeleid uit screenshot — 1-2 zinnen}",
     "status": "IDEA",
     "sections": ["{sectie1}", "{sectie2}"],
     "flows": [],
     "notes": "Geïmporteerd via screenshot"
   }
   ```

   Dedupliceer op `name`: als twee screenshots hetzelfde paginatype detecteren, suffix de tweede met `-2`.

4. Ga naar Stap 4: Present and Confirm (tabel toont alle geïmporteerde page objects als rijen).

---

#### Stap 1: Scan

Glob for page files AND component files in common framework patterns:

**Pages:**

| Framework          | Pattern                     |
| ------------------ | --------------------------- |
| Next.js App Router | `app/**/page.{tsx,jsx}`     |
| Next.js Pages      | `src/pages/**/*.{tsx,jsx}`  |
| Vite + React       | `src/pages/**/*.{tsx,jsx}`  |
| Remix              | `app/routes/**/*.{tsx,jsx}` |
| Astro              | `src/pages/**/*.astro`      |

**Components** (scan naast pages):

- `src/components/**/*.{tsx,jsx,svelte,vue,astro}`
- `app/components/**/*.{tsx,jsx}`
- `src/components/ui/**/*.{tsx,jsx}` (shadcn/ui convention)
- Exclude: `_dev/`, `node_modules/`, `*.test.*`, `*.stories.*`

```
SCAN RESULTAAT
════════════════════════════════════════════════
Framework:   [detected]
Pagina's:    {N} gevonden
Components:  {M} gevonden
════════════════════════════════════════════════
```

#### Stap 2: Parse Pages

For each detected page file:

- Extract page name from file path
- Analyze imports to detect section components → vul `uses[]`
- Infer purpose from component names and composition

#### Stap 2b: Parse Components

For each detected component file (parallell aan Stap 2):

1. Extract component name uit bestandsnaam (PascalCase)
2. Check of naam al in `design.components[]` staat → skip als bestaand
3. Detect scope-heuristiek:
   - Bestand in `layout.tsx` import-tree → `scope: layout`
   - Geïmporteerd door ≥2 pages → `scope: section` of `atomic`
   - Alleen in `ui/` map → `scope: atomic`
   - Standalone in `components/` → `scope: section`
4. Detect cva-variants/sizes via regex: `variants.variant[]`, `variants.size[]`
5. Scan alle page-imports → vul `usedIn[]`
6. Genereer component object met `status: BLT` (al gebouwd)

Toon preview van gedetecteerde components:

```
COMPONENTS GEVONDEN
════════════════════════════════════════════════
| Naam    | Scope   | Variants          | UsedIn      |
|---------|---------|-------------------|-------------|
| Button  | atomic  | primary/ghost/... | dashboard   |
| NavBar  | layout  | —                 | (all pages) |
| StatCard| section | —                 | dashboard   |
════════════════════════════════════════════════
```

```yaml
header: "Components importeren"
question: "Welke components wil je in de design spec opnemen?"
options:
  - label: "Alle ({M} components)", description: "Voeg alle gevonden components toe"
  - label: "Selecteer", description: "Kies handmatig welke"
  - label: "Geen", description: "Sla component-import over"
multiSelect: false
```

Bij "Selecteer": toon als multiSelect met alle component-namen als opties.

#### Stap 3: Infer Flows

From routing structure and navigation components (Link, useRouter, navigate), infer user flows between pages.

#### Stap 4: Present and Confirm

Show extracted design spec in same table format as Aanmaken Stap 5, inclusief components-tabel als er components geïmporteerd worden. Proceed to FASE 3 (Confirm).

---

### Route: Bekijken (View)

Read `project.json` → `design` section. Render as formatted table (same format as Aanmaken Stap 5 summary).

```yaml
header: "Actie"
question: "Wat wil je doen?"
options:
  - label: "Klaar", description: "Terug naar conversation"
  - label: "Aanpassen", description: "Naar actie selectie"
multiSelect: false
```

If "Klaar": end skill, no state change.
If "Aanpassen": loop back to FASE 1 (ACTION_SELECT with populated-state options).

---

### Route: Pagina (Add/Edit Page)

#### Stap 1: Keuze

```yaml
header: "Pagina"
question: "Wat wil je doen?"
options:
  - label: "Nieuwe pagina toevoegen (Recommended)", description: "Voeg een pagina toe aan de design spec"
  - label: "Bestaande bewerken", description: "Pas een bestaande pagina aan"
multiSelect: false
```

#### If "Nieuwe pagina":

```yaml
header: "Nieuwe Pagina"
question: "Beschrijf de pagina: naam, doel, en welke secties/content erop moet."
options:
  - label: "Ik typ het uit", description: "Vrije beschrijving"
multiSelect: false
```

Parse description into structured page object. Show preview, proceed to FASE 3 (Confirm).

#### If "Bestaande bewerken":

Show existing pages as options (dynamically generated):

```yaml
header: "Bewerken"
question: "Welke pagina wil je bewerken?"
options:
  - label: "{page1.name}", description: "{page1.purpose} ({page1.status}) — {N} secties"
  - label: "{page2.name}", description: "{page2.purpose} ({page2.status}) — {N} secties"
  # ... max 4 options, rest via "Other"
multiSelect: false
```

Then ask what to change:

```yaml
header: "Bewerk: {page-name}"
question: "Wat wil je aanpassen?"
options:
  - label: "Doel", description: "Huidige: {purpose}"
  - label: "Secties", description: "Huidige: {sections joined}"
  - label: "Status", description: "Huidige: {status}"
  - label: "Notities", description: "Huidige: {notes or 'leeg'}"
multiSelect: true
```

Process updates, proceed to FASE 3 (Confirm).

---

### Route: Component (Add/Edit)

#### Stap 1: Keuze

```yaml
header: "Component"
question: "Wat wil je doen?"
options:
  - label: "Nieuw component toevoegen (Recommended)", description: "Voeg een component toe aan de design spec"
  - label: "Bestaande bewerken", description: "Pas een bestaand component aan"
multiSelect: false
```

#### If "Nieuw component":

```yaml
header: "Nieuw Component"
question: "Beschrijf het component: naam, doel, en welke varianten/states het heeft."
options:
  - label: "Ik typ het uit", description: "Vrije beschrijving"
multiSelect: false
```

Parse description en vraag aanvullend:

```yaml
header: "Component details"
question: "Wat voor type component is dit?"
options:
  - label: "Atomic (Recommended)", description: "Klein herbruikbaar element — Button, Input, Avatar"
  - label: "Section", description: "Composiet binnen één page — StatCard, ProductCard"
  - label: "Layout", description: "Multi-page wrapper — NavBar, Footer, Sidebar"
multiSelect: false
```

Als `scope: layout`: stel aanvullend `appliesTo` in:

```yaml
header: "Toepassing"
question: "Op welke pages van toepassing?"
options:
  - label: "Alle pages (Recommended)", description: "Elke page — voegt toe aan root layout"
  - label: "Specifieke pages", description: "Selecteer welke pages"
  - label: "Route-groep", description: "Bijv. alle authenticated pages"
multiSelect: false
```

Genereer component object:

```json
{
  "name": "{slug}",
  "purpose": "{afgeleid uit beschrijving}",
  "status": "DEF",
  "scope": "{atomic|section|layout}",
  "appliesTo": "{all | [page-names] | route-group:name}",
  "variants": [],
  "sizes": [],
  "states": ["default"],
  "props": [],
  "slots": [],
  "usedIn": [],
  "notes": ""
}
```

Toon preview-tabel:

```
COMPONENT
════════════════════════════════════════════════
| Naam    | Doel                   | Scope   | Variants          | Status |
|---------|------------------------|---------|-------------------|--------|
| button  | Primaire actie-trigger | atomic  | primary/ghost/... | DEF    |
════════════════════════════════════════════════
```

Proceed to FASE 3 (Confirm).

Bij confirmatie:

1. Append aan `project.json#design.components[]`
2. Append aan `backlog.html` als COMPONENT-feature met `status: TODO`, `phase: P3`, `source: "/frontend-design"`, `scope: {scope}`
3. Update `data.updated`
4. **Gap-discovery** — zie [Protocol: Gap-Discovery](#protocol-gap-discovery) hieronder: scan `props[]` voor handler-patronen en toon AskUserQuestion per gevonden gap.

#### If "Bestaande bewerken":

Show existing components as options:

```yaml
header: "Bewerken"
question: "Welk component wil je bewerken?"
options:
  - label: "{component1.name}", description: "{component1.purpose} ({component1.status}) — {scope}"
  - label: "{component2.name}", description: "..."
  # max 4, rest via Other
multiSelect: false
```

Then:

```yaml
header: "Bewerk: {component-name}"
question: "Wat wil je aanpassen?"
options:
  - label: "Doel", description: "Huidige: {purpose}"
  - label: "Variants/Sizes/States", description: "Huidige: {variants joined}"
  - label: "Props/Slots", description: "Huidige: {props joined}"
  - label: "Status", description: "Huidige: {status}"
  - label: "Scope / appliesTo", description: "Huidige: {scope}"
  - label: "Notities", description: "Huidige: {notes or 'leeg'}"
multiSelect: true
```

Process updates, proceed to FASE 3 (Confirm).

---

### Protocol: Gap-Discovery

Gedeeld protocol voor Capture (Component/Page) en Build. Detecteert handler-props of actie-werkwoorden zonder gekoppeld FEATURE in de backlog en stelt een koppeling of nieuw TODO voor.

**Non-blocking:** het frontend Build/Capture gaat altijd door — gaps zijn metadata.

#### Trigger A — Capture (Component)

Na schrijven van component naar `project.json`:

1. Scan `props[]` voor patronen: `/^on[A-Z]/` (onClick, onSubmit, onChange) of expliciete namen als `action`, `handler`, `onSubmit`, `submit`.
2. Per gevonden handler-prop: check `feature.json#suggestionsLog[]` (as current feature context if available, anders backlog-search) — als al eerder `{ direction: "frontend→dev", name: "{component}.{prop}" }` afgewezen → skip.
3. Fuzzy-match tegen backlog `data.features` van type `FEATURE`/`API`/`INTEGRATION` op naam/beschrijving (kebab-overlap, substring). Threshold: score > 0.5 — anders geen "Link aan bestaand" optie tonen.

#### Trigger B — Capture (Page)

Na schrijven van page naar `project.json`, als `flows[]` of `purpose` werkwoorden bevatten: "submit", "delete", "save", "fetch", "send", "create", "update", "upload", "download":

1. Extraheer actie-kandidaten (max 3, hoogste semantische gewicht eerst).
2. Per kandidaat: check suggestionsLog dedupe + fuzzy-match als boven.

#### Trigger C — Build (post code-gen)

Na generatie van `$GENERATED_FILES`: scan gegenereerde `.tsx`/`.svelte`/`.vue` bestanden voor stub-handlers: `() => {}`, `/* TODO */`, `// implement`, `console.log` als enige body. Per bestand:

1. Extraheer prop-naam + omgeving (function name, line).
2. Check suggestionsLog dedupe + fuzzy-match als boven.

#### Resolution Flow (gemeenschappelijk)

Per gap-kandidaat — AskUserQuestion:

```yaml
header: "Gap: {component|page}.{prop/actie} heeft geen functionaliteit"
question: "Wat moet er gebeuren met dit gedrag?"
options:
  - label: "Link aan bestaand: {best-match}" # alleen als match gevonden
    description: "Voegt {entity} toe aan {feature}.frontend.linkedEntities[]"
  - label: "Maak nieuw FEATURE TODO"
    description: "Backlog krijgt [FEATURE] {suggested-name} TODO"
  - label: "Markeer als decoratief"
    description: "Geen gedrag nodig (visual demo, illustratie). Gap: skipped"
  - label: "Skip voor nu"
    description: "Gap: pending — prompt verschijnt bij volgende Build/Capture"
multiSelect: false
```

**Persisteer keuze:**

- **Link**: append `{ prop, context, status: "linked", featureRef: "{feature-name}", at }` aan `design.{components|pages}[name].gaps[]`; append `{ type: "component"|"page", name, prop }` aan `{feature-name}/feature.json#frontend.linkedEntities[]`
- **Maak nieuw**: append `[FEATURE] {name} TODO` aan backlog; append gap met `status: "created", featureRef: name`; schrijf `feature.json` terug met `frontend.linkedEntities[]` entry
- **Decoratief**: append gap met `status: "skipped"`
- **Skip**: append gap met `status: "pending"`

**Log in suggestionsLog** (huidige feature of project-level context):

```json
{
  "skill": "frontend-design",
  "type": "FEATURE",
  "name": "{component}.{prop}",
  "status": "accepted|rejected",
  "at": "{ISO 8601}",
  "direction": "frontend→dev"
}
```

Als geen gaps gevonden: stap volledig overslaan (geen prompt).

---

### Route: Build (In-Claude-Code Code Generation)

Genereert werkende code voor PAGE- of COMPONENT-features met `status: DEF` en geen visueel referentiemateriaal. Zie `../shared/CODEGEN.md` voor de gedeelde code-gen patronen die ook door `frontend-convert` worden gebruikt.

**Trigger:** alleen bereikbaar als `$HAS_BUILD_CANDIDATES = true` (gedetecteerd in FASE 1).

#### Stap 1: Entity-keuze

Toon alleen type-opties waarvoor kandidaten beschikbaar zijn:

```yaml
header: "Build — wat bouwen?"
question: "Welk type wil je genereren?"
# Als zowel PAGE als COMPONENT kandidaten:
options:
  - label: "PAGE (Recommended)", description: "{X} page(s) met status DEF beschikbaar"
  - label: "COMPONENT", description: "{Y} component(s) met status DEF beschikbaar"
# Als alleen PAGE kandidaten: skip keuze, ga direct door met PAGE
# Als alleen COMPONENT kandidaten: skip keuze, ga direct door met COMPONENT
multiSelect: false
```

Sla gekozen entity-type op als `$TARGET_TYPE` (PAGE of COMPONENT).

#### Stap 2: Kandidaat kiezen

**Als `$TARGET_TYPE = PAGE`:** toon alle PAGE-features met `status: DEF` op de backlog waarvoor geen visuele referentie bestaat:

```yaml
header: "Build — page kiezen"
question: "Welke page wil je bouwen?"
options:
  - label: "{kebab-name}", description: "{description} — {route-pattern}"
  # max 4, rest via Other
multiSelect: false
```

Sla op als `$TARGET_PAGE`.

**Als `$TARGET_TYPE = COMPONENT`:** toon alle COMPONENT-features met `status: DEF`:

```yaml
header: "Build — component kiezen"
question: "Welk component wil je bouwen?"
options:
  - label: "{name}", description: "{purpose} — {scope}"
  # max 4, rest via Other
multiSelect: false
```

Sla op als `$TARGET_COMPONENT`. Sla `$TARGET` = `$TARGET_PAGE` of `$TARGET_COMPONENT`.

#### Stap 3: Spec lookup (entity-agnostic)

**Als `$TARGET_TYPE = PAGE`:**

1. Zoek `.project/features/{$TARGET}/feature.json` → read als spec-bron (primair).
2. Fallback: `design.pages[]` gefilterd op naam gelijkend aan `$TARGET`.
3. Als beide leeg → AskUserQuestion: "Beschrijf kort de page: doel, secties, acties." → sla op als inline spec en schrijf naar `design.pages[]` voor later hergebruik.

Toon spec:

```
SPEC: {$TARGET} (PAGE)
Doel:    {purpose}
Secties: {sections joined}
Routes:  {route-patterns}
```

**Als `$TARGET_TYPE = COMPONENT`:**

1. Zoek `.project/features/{$TARGET}/feature.json` → read als spec-bron (primair).
2. Fallback: `design.components[]` gefilterd op naam gelijkend aan `$TARGET`.
3. Als beide leeg → AskUserQuestion: "Beschrijf kort het component: doel, variants, props." → sla op als inline spec en schrijf naar `design.components[]` voor later hergebruik.

Toon spec:

```
SPEC: {$TARGET} (COMPONENT)
Doel:     {purpose}
Scope:    {scope}
Variants: {variants joined}
Props:    {props joined}
States:   {states joined}
```

AskUserQuestion: "Ga door (Recommended)" | "Spec aanpassen".

#### Stap 4: Genereren (entity-aware)

Raadpleeg `../shared/CODEGEN.md` voor volledige patronen. Output-pad bepaald door entity-type én scope:

| Entity              | Output-pad                                           | Sub-output                          |
| ------------------- | ---------------------------------------------------- | ----------------------------------- |
| PAGE                | `app/{route}/page.tsx` (of framework-equivalent)     | `app/{route}/_components/{Sub}.tsx` |
| COMPONENT (atomic)  | `src/components/ui/{Name}.tsx`                       | —                                   |
| COMPONENT (section) | `src/components/{Name}.tsx`                          | —                                   |
| COMPONENT (layout)  | `src/components/{Name}.tsx` + patch `app/layout.tsx` | Demo-page (zie hieronder)           |

**Auto-patch voor layout-components:** als `scope: layout`, voegt Build een import + render-statement toe aan `app/layout.tsx` (of framework-equivalent). Voor `appliesTo: route-group:X`: patch in `app/(X)/layout.tsx`. Detecteer bestaande imports vóór patch — toon conflict-warning bij duplicate en vraag om bevestiging.

**Demo-page voor COMPONENT:** genereer `app/_dev/components/{name}/page.tsx` (gitignored) die alle variants × sizes × states toont — gebruikt voor smoke-render in Stap 4b.

```tsx
// Auto-gegenereerd — gitignored
export default function {Name}Demo() {
  return (
    <main aria-label="{Name} demo">
      {variants.map((v) =>
        sizes.map((s) =>
          states.map((state) => (
            <{Name} key={`${v}-${s}-${state}`} variant={v} size={s} {...stateProps[state]}>
              {v}/{s}/{state}
            </{Name}>
          )),
        ),
      )}
    </main>
  );
}
```

**Thinking-checkpoint** — presenteer vóór code-generatie, wacht op user-confirmatie:

```
BUILD PLAN: {$TARGET} ({$TARGET_TYPE})
═══════════════════════════════════════════════════════════════
Structure:    {output-paden — één regel per file}
Tokens used:  {token-namen die ingezet worden}
Blocks reused: {imports uit components[] — of "none"}
Images:       {placeholder strategy of "n.v.t."}
A11y plan:    {semantic structure + aria-labels}
Caveats:      {missing deps, ontbrekende tokens, auto-patch layout, etc. — of "none"}
═══════════════════════════════════════════════════════════════
```

```yaml
header: "Build plan"
question: "Klopt dit plan? Dan genereer ik de code."
options:
  - label: "Genereren (Recommended)", description: "Plan klopt, schrijf de bestanden"
  - label: "Plan aanpassen", description: "Ik wil iets wijzigen"
multiSelect: false
```

Na confirmatie — genereer code:

- Semantic HTML layout (PAGE) of cva-component (COMPONENT) op basis van spec
- Hergebruik bestaande components waar matchend (import uit hun paden in `components[]`)
- Tailwind/CSS classes via theme tokens — **geen raw hex** (`#…`) of arbitrary color-values (`bg-[#…]`)
- Afbeeldingen: alleen `/placeholder.svg?w={W}&h={H}` (PAGE only) — nooit externe CDN-URLs
- Accessibility: `<main>`, `<section>`, `aria-label`, skip-nav (PAGE); correcte ARIA-attributes (COMPONENT)

Toon gegenereerde bestanden als diff-preview voor user-confirmatie.

AskUserQuestion: "Schrijf bestanden (Recommended)" | "Aanpassen voor schrijven".

Schrijf bestanden na confirmatie.

#### Stap 4: Post-write checks + smoke render

**4a. Statische checks** (geen dev-server nodig — draai direct na file-write):

**Hex post-pass** — scan elk gegenereerd `.tsx`/`.vue`/`.svelte`/`.css` bestand:

- Verboden: `#[0-9a-fA-F]{3,8}` in `className`-strings of inline-style props (buiten `//` en `/* */` comments)
- Verboden: arbitrary Tailwind color-values `bg-[#`, `text-[#`, `border-[#`
- Verboden: externe placeholder-URLs (`images.unsplash.com`, `picsum.photos`, `placehold.co`, `fakeimg.pl`)

Bij match → toon violation + AskUserQuestion:

```yaml
header: "Code violation"
question: "Gevonden: {violation-type} in {bestand}:{regel}. Hoe verder?"
options:
  - label: "Auto-fix (Recommended)", description: "Map naar dichtstbijzijnde theme-token of /placeholder.svg"
  - label: "Handmatig fixen", description: "Ik pas het zelf aan"
  - label: "Negeer", description: "Bewust afwijken van de token-regel"
multiSelect: false
```

**Unknown-import scan** — scan elk gegenereerd bestand op `from ['"](.+?)['"]`:

- Relatieve imports (`./`, `../`, `@/`): controleer of bestand bestaat via projectstructuur
- Bare imports: controleer aanwezigheid in `package.json`
- Bij unresolved imports → toon lijst, noteer als missing dependency in completion report

**4b. Smoke render** (vereist dev-server):

Check beschikbaarheid: `curl -s http://localhost:{port}` (poort uit `project.json` of CLAUDE.md).

Als dev-server niet beschikbaar: skip 4b volledig met melding `"Dev server niet bereikbaar — open handmatig."`. Ga door naar Stap 5.

Als beschikbaar:

**Route bepaling per entity-type:**

- `$TARGET_TYPE = PAGE` → navigate naar page-route.
- `$TARGET_TYPE = COMPONENT` → navigate naar `/_dev/components/{$TARGET}` (de demo-page).

**Basis smoke-checks (daemon):**

1. **Check 1 — Console errors**: 0 fatale errors (`playwright-cli console error` gefilterd tegen default ignore patterns)
2. **Check 2 — Layout intact**: body height > 100px, breedte > 200px
3. **Check 3 — Tokens geladen**: computed style van `--color-primary` of equivalent is geen lege string
4. **Check 4 — Layout-collapse**: loopt door `<main>` direct-children; faalt als ≥1 element `offsetHeight === 0` of `offsetWidth === 0`
5. **Check 5 — Variant matrix (COMPONENT only)**: controleert of `<main>` ≥ `{variants.length × sizes.length}` child-blokken bevat

**Multi-viewport screenshots (daemon — altijd draaien):**

Capture op 375 (mobile) en 1440 (desktop). Per viewport:

```
playwright-cli open {url}
playwright-cli resize 375 900
playwright-cli run-code "async p => { await p.waitForTimeout(500); }"
playwright-cli screenshot --filename=.project/wireframes/{$TARGET}-375.png
playwright-cli resize 1440 900
playwright-cli run-code "async p => { await p.waitForTimeout(500); }"
playwright-cli screenshot --filename=.project/wireframes/{$TARGET}-1440.png
playwright-cli close
```

**Dark/light screenshots (daemon — als `project.json#theme.modes.dark` bestaat):**

```
playwright-cli run-code "async page => {
  const ctx = await page.context().browser().newContext({ viewport: { width: 1440, height: 900 }, colorScheme: 'dark' });
  const p = await ctx.newPage();
  await p.goto('{url}');
  await p.waitForLoadState('networkidle');
  await p.screenshot({ path: '.project/wireframes/{$TARGET}-dark.png' });
  await ctx.close();
}"
```

**A11y-smoke (mandatory — auto-installeer als missing):**

Check of `@axe-core/playwright` beschikbaar is: `node -e "require('@axe-core/playwright')" 2>/dev/null`.

- **Beschikbaar**: run axe via `playwright-cli run-code`. Faal op `critical`, toon `serious` als warning.
- **Niet beschikbaar**: AskUserQuestion:
  ```yaml
  header: "axe-core"
  question: "@axe-core/playwright is niet geïnstalleerd. A11y-check is verplicht voor Build-smoke."
  options:
    - label: "Nu installeren (Recommended)"
      description: "npm install --save-dev @axe-core/playwright — dan opnieuw draaien"
    - label: "Overslaan (eenmalig)"
      description: "Noteer als missing dep in rapport, ga door"
  ```
  Bij "Nu installeren": `npm install --save-dev @axe-core/playwright`, daarna run de axe-check. Bij "Overslaan": noteer als `MISSING_DEP: @axe-core/playwright` in rapport.

**Aria-snapshot baseline (runner — na daemon-checks):**

Genereer een on-the-fly runner spec voor aria-snapshot assertion. Eerste run maakt baseline aan; volgende runs falen bij structurele regressie. Zie `shared/PLAYWRIGHT.md → Runner Mode` voor het volledige on-the-fly pattern.

```typescript
// .project/playwright-runs/design-{$TARGET}.spec.ts  (tijdelijk)
import { test, expect } from "@playwright/test";
test("aria snapshot — {$TARGET}", async ({ page }) => {
  await page.goto("{url}");
  await page.waitForLoadState("networkidle");
  await expect(page.locator("main")).toMatchAriaSnapshot();
  // baseline: .project/playwright-runs/__screenshots__/design-{$TARGET}-main-aria.yaml
});
```

Draai: `npx playwright test .project/playwright-runs/design-{$TARGET}.spec.ts --config=.project/playwright-runs/playwright.config.ts [--update-snapshots bij eerste run]`

Bij runner niet beschikbaar (`npx playwright --version` faalt): skip aria-snapshot, noteer als `SKIPPED: runner niet beschikbaar`.

```
SMOKE CHECKS: {$TARGET} ({$TARGET_TYPE})
──────────────────────────────────────────────────
✓ Console errors       0 fataal
✓ Layout intact        body 1024×768
✓ Tokens geladen       --color-primary OK
✓ Section collapse     0 collapsed
✓ Multi-viewport       375px OK · 1440px OK
✓ Dark mode            .project/wireframes/{$TARGET}-dark.png  (alleen als dark mode aan)
✓ Variant matrix       6/6 varianten zichtbaar  (COMPONENT only)
✓ axe a11y             0 critical
✓ Aria snapshot        baseline aangemaakt / geen regressie
──────────────────────────────────────────────────
```

**4c. Bij failure:**

```yaml
header: "Smoke check gefaald"
question: "Check gefaald: {beschrijving}. Hoe verder?"
options:
  - label: "Refine (Recommended)", description: "Beschrijf wat moet wijzigen — ik pas alleen die sectie aan"
  - label: "Handmatig fixen", description: "Ik fix het zelf"
  - label: "Open in convert", description: "/frontend-convert patch voor visueel bijwerk (PAGE only)"
  - label: "Skip verificatie", description: "Ga door zonder te verifiëren"
multiSelect: false
```

**Refine-loop** (bij keuze "Refine" — max 3 rondes):

1. AskUserQuestion: "Welke sectie?" — toon `<main>` direct-children als opties
2. AskUserQuestion: "Wat moet er anders?" — vrije tekst
3. Edit op **alleen** die sectie (nooit Write op hele file)
4. Re-run checks 4b
5. Bij aanhoudende failure na 3 rondes → AskUserQuestion: "Handmatig fixen | Open in convert | Accepteren as-is"

**Bij keuze "Open in convert"** (alleen voor PAGE — COMPONENT heeft geen convert-flow):

Schrijf naar `.project/session/devinfo.json`:

```json
{
  "handoff": {
    "source": "build-incomplete",
    "target": "{$TARGET}",
    "files": ["{generated-file-1}", "{generated-file-2}"],
    "failedChecks": ["{check-naam-1}", "{check-naam-2}"],
    "reason": "smoke-fail",
    "buildScreenshot": "{screenshot-pad of null}",
    "timestamp": "{ISO-timestamp}"
  }
}
```

```
BUILD INCOMPLETE: {$TARGET}

Failed checks:    {lijst}
Files written:    {pad-1, pad-2}
Handoff saved:    devinfo.handoff (source: build-incomplete)

Next:  /frontend-convert {$TARGET}   (auto-detected handoff → patch mode)
```

#### Stap 5: Backlog sync + Block inventory + Drift cleanup

**5a. Block inventory** (alleen bij smoke PASS):

Parse alle `$GENERATED_FILES` → filter op component-paden (`_components/`, `src/components/`, `app/components/`). Skip page-files (`page.tsx`, `+page.svelte`, route-level files). Per component-bestand:

1. Extraheer named exports met regex: `export (function|const|default) (\w+)` + `export { … }`
2. Detect cva-variants als `cva(` aanwezig: extraheer `variants.variant[]` en `variants.size[]`
3. Sla op als entry: `{ name, src, exports, variants, sizes }`
4. Conflict-check op `components[].name`:
   - Zelfde naam + andere `src` → skip + noteer als conflict
   - Zelfde naam + zelfde `src` → merge (idempotent re-run)
   - Nieuw → append
5. Read `.project/project-context.json` → update `components[]` → Write terug (alleen als er wijzigingen zijn)

**5b. Bidirectional linking** (alleen bij smoke PASS):

Parse imports uit alle `$GENERATED_FILES`:

- Scan op `from ['"](.+?)['"]` — extraheer component-namen uit import-paden
- Match tegen `design.components[].name` (case-insensitive)

**Als `$TARGET_TYPE = PAGE`:**

- Vul `design.pages[{$TARGET}].uses[]` → lijst van gedetecteerde component-namen (dedupe)
- Voor elke matched component: append `{$TARGET}` naar `design.components[{name}].usedIn[]` (dedupe)

**Als `$TARGET_TYPE = COMPONENT`:**

- Vul `design.components[{$TARGET}].status = "BLT"`
- Als sub-components gegenereerd als `_components/` of inline (complex pattern) → toon promote-prompt:
  ```yaml
  header: "Sub-components gevonden"
  question: "Wil je deze als shared COMPONENT in de backlog plaatsen?"
  options:
    - label: "Ja, als COMPONENT-todo", description: "{sub-component-name} → backlog"
    - label: "Nee, inline laten", description: "Blijft onderdeel van dit component"
  multiSelect: true
  ```

Write `project.json#design` terug na sync.

**5c. TokenDrift cleanup** (bij smoke PASS):

Lees `.project/session/devinfo.json` → check `tokenDrift.affectedFeatures`. Als `{$TARGET}` erin staat: verwijder uit de lijst. Als lijst daarna leeg is: zet `tokenDrift.resolved = true`. Write terug.

**5d. Backlog sync**:

Parse `backlog.html` → match op `name === {$TARGET}`:

- Smoke success → `feature.status = "DOING"` + `feature.audit.buildScreenshot = {pad}` + `feature.audit.buildSmokeStatus = "PASS"`
- Smoke fail → backlog-status **ongewijzigd** (blijft TODO of DEFINED). Zet `feature.audit.buildSmokeStatus = "FAIL"` + `feature.audit.buildSmokeError = {korte reden}`.
- Smoke skip → backlog-status **ongewijzigd**. Zet `feature.audit.buildSmokeStatus = "SKIPPED"`.

Update `data.updated` alleen bij smoke success. Edit terug in `backlog.html`.

Sla block inventory tellers op als `$INV_NEW`, `$INV_UPDATED`, `$INV_CONFLICTS` voor gebruik in Stap 6.

**5e. Gap-discovery** (altijd, ongeacht smoke-status):

Zie [Protocol: Gap-Discovery](#protocol-gap-discovery) — Trigger C (Build post code-gen): scan `$GENERATED_FILES` voor stub-handlers en toon AskUserQuestion per gevonden gap. Als geen gaps: stap overslaan.

#### Stap 6: Completion report

```
BUILD COMPLETE: {$TARGET} ({$TARGET_TYPE})

Files:
  {generated-file-1}
  {generated-file-2}

Tokens used:      {N token references}
Components:       {hergebruikte components}
Block inventory:  +{$INV_NEW} nieuw, ~{$INV_UPDATED} bijgewerkt, !{$INV_CONFLICTS} conflict
Linked:           {uses/usedIn sync — of "n.v.t."}
Missing deps:     {lijst of "none"}
Smoke render:     {PASS | FAIL | SKIPPED}
Screenshot:       {pad of n.v.t.}
Gaps:             {N linked | M created | K pending | "geen"}
```

Vraag na report:

```yaml
header: "Doorgaan met audit?"
question: "/frontend-check {$TARGET} controleert A11Y, tokens en responsive gedrag."
options:
  - label: "Ja, audit nu (Recommended)", description: "frontend-check inline uitvoeren"
  - label: "Later", description: "Status blijft DOING — /frontend-check {$TARGET} staat klaar in de backlog"
multiSelect: false
```

Bij "Ja": lees `frontend-check/SKILL.md` en voer FASE 0–4 inline uit voor `{$TARGET}`.
Bij "Later": eindig — backlog toont DOING-status met next-step `/frontend-check {$TARGET}`.

---

### Route: Flow (Add/Edit Flow)

Same structure as Pagina route.

#### If "Nieuwe flow":

```yaml
header: "Nieuwe Flow"
question: "Beschrijf de flow: naam en stappen als pagina-naar-pagina."
options:
  - label: "Ik typ het uit (Recommended)", description: "Bijv: 'onboarding: landing → signup → verify → dashboard'"
  - label: "Selecteer uit pagina's", description: "Kies pagina's en bouw de flow stap voor stap"
multiSelect: false
```

If "Selecteer uit pagina's": show existing pages as multi-select to build flow sequence.

Cross-reference: for each step, check if page exists in `design.pages`. If not, warn and offer to create it.

#### If "Bestaande bewerken":

Show existing flows as options, then edit name/steps/notes. Same pattern as page edit.

Proceed to FASE 3 (Confirm).

---

### Route: Principes (Add/Edit)

```yaml
header: "Principes"
question: "Wat wil je doen?"
options:
  - label: "Toevoegen (Recommended)", description: "Nieuw principe toevoegen"
  - label: "Bewerken", description: "Bestaand principe aanpassen"
multiSelect: false
```

**Adding:** Free-text input (name + description), parse, proceed to FASE 3 (Confirm).

**Editing:** Show list of current principles as selectable options, then edit description. Proceed to FASE 3 (Confirm).

---

### Route: Verwijderen (Delete Item)

```yaml
header: "Verwijderen"
question: "Wat wil je verwijderen?"
options:
  - label: "Pagina", description: "Een pagina uit de design spec"
  - label: "Component", description: "Een component uit de design spec"
  - label: "Flow", description: "Een user flow"
  - label: "Principe", description: "Een design principe"
multiSelect: false
```

Show items of selected type as options. After selection, confirm with safety pattern:

```yaml
header: "Bevestig Verwijdering"
question: "Weet je zeker dat je '{item-name}' wilt verwijderen?"
options:
  - label: "Nee, annuleren (Recommended)", description: "Behoud item"
  - label: "Ja, verwijderen", description: "Definitief verwijderen"
multiSelect: false
```

**Cross-reference check:** When deleting a page, check if it's referenced in any flows. If so, warn:

```
⚠ Pagina "{page}" wordt gebruikt in flow(s): {flow-names}.
  Deze flow stappen worden orphaned.
```

Proceed to FASE 3 (Confirm).

---

### Route: Herstellen (Restore Checkpoint)

#### Stap 1: Checkpoints laden

Lees `.project/session/design-history.json`.

- Als het bestand niet bestaat of leeg is → toon melding en stop:
  ```
  ℹ Geen checkpoints beschikbaar. Wijzigingen worden pas opgeslagen na de eerste write.
  ```

#### Stap 2: Checkpoint kiezen

Toon de 4 recentste checkpoints als opties:

```yaml
header: "Herstellen"
question: "Naar welk checkpoint wil je terug?"
options:
  - label: "{HH:mm DD-MM}", description: "{trigger} — {N} pagina's, {M} flows"
  # max 4 entries
multiSelect: false
```

#### Stap 3: Diff tonen

```
RESTORE PREVIEW
════════════════════════════════════════════════
Huidig:   {N} pagina's, {M} flows, {P} principes
Restore:  {N} pagina's, {M} flows, {P} principes

Verdwijnen: {pagina/flow namen die weg zijn in checkpoint}
Verschijnen: {pagina/flow namen die nieuw zijn in checkpoint}
════════════════════════════════════════════════
```

#### Stap 4: Confirm + Write

```yaml
header: "Herstellen"
question: "Weet je zeker dat je wilt herstellen naar dit checkpoint?"
options:
  - label: "Nee, annuleren (Recommended)", description: "Behoud huidige staat"
  - label: "Ja, herstellen", description: "Overschrijf huidige design spec"
multiSelect: false
```

Bij "Ja": schrijf `snapshot` uit het gekozen checkpoint terug naar `project.json → design`. Ga direct naar FASE X.1 (Write) + FASE X.2 (Validate) — sla X.0 over.

---

### Route: Brief (Claude Design Handoff)

Genereer een markdown brief die je in Claude Design plakt. De brief bundelt alle context die Claude Design nodig heeft om visuals te genereren die passen bij het project (zodat je geen dubbele componenten of inconsistent tokens krijgt).

#### Stap 1: Scope

```yaml
header: "Brief Scope"
question: "Waarvoor genereer je de brief?"
options:
  - label: "Specifieke pagina (Recommended)", description: "Brief voor één pagina uit design.pages"
  - label: "Component", description: "Brief voor één component uit design.components"
  - label: "Beide", description: "Aparte briefs voor page + component"
  - label: "Flow", description: "Brief voor een user flow (meerdere pagina's als reeks)"
multiSelect: false
```

**If "Specifieke pagina":** toon `design.pages` met status DEF/IDEA als opties (max 4, rest via Other). User kiest pagina. → ga naar Stap 2 (page-flow).

**If "Component":** toon `design.components` als opties (max 4, rest via Other). User kiest component. → ga naar Stap 1b (component-brief).

**If "Beide":** kies pagina én component. Genereer twee aparte bestanden.

**If "Flow":** toon `design.flows` als opties. User kiest flow. Brief bevat alle pagina's in `flow.steps`. → ga naar Stap 2 (page-flow).

**If "Volledige app":** geen extra keuze nodig. → ga naar Stap 2 (page-flow).

#### Stap 1b: Component Brief genereren

Sla op als `$TARGET_COMPONENT` (naam van gekozen component uit `design.components[]`).

Voer Stap 2 (block inventory) en Stap 3 (tokens) parallel uit, dan schrijf component-brief:

Output-pad: `.project/claude-design-brief-{component-name}.md`

```markdown
# Component Brief: {ComponentName}

_Gegenereerd door /frontend-design · {datum}_

## Purpose

{purpose uit design.components[].purpose}

## Scope

{atomic | section | layout} — appliesTo: {appliesTo}

## Variant Matrix

| Variant      | Size      | State    | Visual treatment |
| ------------ | --------- | -------- | ---------------- |
| {variant[0]} | {size[0]} | default  |                  |
| {variant[0]} | {size[0]} | hover    |                  |
| {variant[0]} | {size[0]} | disabled |                  |

{herhaal per variant × size combinatie uit spec}

## Props

{props[] uit spec — bullet list}

## Slots

{slots[] of "geen"}

## States

{states[] met hints — bijv. "disabled: opacity-50, pointer-events-none"}

## Design Tokens

{Primary tokens uit project.json#theme die relevant zijn voor dit component:
colors.primary, colors.foreground, colors.border, etc.}

## Block Inventory (mogelijke baseline)

{components[] uit project-context.json waarbij naam overlapt:}

- `{bestaande-component}` ({path}) — {beschrijving}
  {of "Geen vergelijkbare bestaande components gevonden"}

## Used In (context)

{usedIn[] — pages die dit component al gebruiken, voor visuele consistency:}
{of "Nieuw component — nog niet in gebruik"}

## Patterns & Conventies

- TypeScript strict mode
- `cn()` utility voor className composition
- cva (class-variance-authority) voor variants — controleer aanwezigheid in package.json
- Tailwind scale (geen arbitrary values)
- ARIA: {relevante aria-attributen voor dit component-type}

## Output

shadcn/ui-style cva component met:

- variants: {variants joined}
- sizes: {sizes joined}
- asChild support (Radix UI pattern, indien van toepassing)
- Handoff bundle voor `/frontend-convert` (code → implementatie)
```

Na generatie: ga naar Stap 5 (schrijf bestand + toon samenvatting).

#### Stap 2: Block Inventory

Spawn een Explore agent om de dev-pipeline blocks te inventariseren. Dit isoleert recursieve import tracing uit de main context.

Agent prompt:

```
Inventariseer de bestaande frontend building blocks in dit project.

1. Detect framework via package.json (Next.js App Router, Next.js Pages, Vite + React, Remix, Astro).
2. Scan components directories:
   - src/components/**/*.{tsx,jsx}
   - app/components/**/*.{tsx,jsx}
   - components/**/*.{tsx,jsx}
   Rapporteer per component: naam, bestandslocatie, exported props (interface), en één regel beschrijving van wat het doet (afgeleid uit naam + JSX).
3. Scan hooks:
   - src/hooks/**/*.{ts,tsx}
   Rapporteer per hook: naam, wat het returnt, welke API/service het aanroept (indien zichtbaar).
4. Scan services/API clients:
   - src/services/**/*.{ts,tsx}
   - src/lib/api/**/*.{ts,tsx}
   Rapporteer per service: functienaam, endpoint, return type.

Return als gestructureerde lijst. Focus op REUSABILITY — welke bestaande blocks zijn toepasbaar voor nieuwe pagina's?
```

Agent output wordt de "Block Inventory" sectie in de brief.

**Fallback als framework/dirs niet gevonden:** skip inventory, noteer in brief: `Block inventory: n/a (nog geen componenten gebouwd)`.

#### Stap 3: Tokens + Patterns

1. Read `.project/project.json` → `theme` sectie (als aanwezig). Extract: colors, typography, spacing, cssVars.
   Voor typography: extraheer de semantische type scale namen (`text-display`, `text-title-*`, `text-headline-*`, `text-body-*`, `text-code`) uit `theme.typography.sizes[].token` als aanwezig. Sla op als `$TYPE_SCALE`.
   Voor dark mode: check `theme.modes.dark` in project.json. Sla op als `$HAS_DARK_MODE` (true/false).
   Voor motion: check `theme.motion` in project.json. Sla op als `$MOTION_TOKENS` (true/false).
2. Read `shared/PATTERNS.md` → extract patroonnamen en één-regel beschrijvingen (compound components, render props, etc).
3. Als `theme` ontbreekt: noteer `Tokens: Tailwind defaults (geen theme gedefinieerd)`.

#### Stap 4: Compose Brief

Schrijf `.project/claude-design-brief.md`:

```markdown
# Claude Design Brief — {scope naam}

_Gegenereerd door /frontend-design · {datum}_

## Project Context

{concept-bron in prioriteitsvolgorde:

1. Als `.project/project-concept.md` bestaat → Read het volledige bestand (preferred)
2. Anders als `concept.pitch` gevuld is → gebruik `concept.pitch` (1-2 zinnen samenvatting)
3. Anders als `concept.content` gevuld is → gebruik `concept.content` (legacy inline)
4. Anders → "Geen concept gedefinieerd"
   }

## Design Principes

{design.principles[].name + description, bullet list}

## Scope

{Als pagina: single page spec}
{Als flow: flow + pagina-reeks}
{Als volledig: alle pagina's}

### Pagina: {name}

- **Doel**: {purpose}
- **Secties**: {sections joined}
- **Gerelateerde flows**: {flows joined}
- **Status**: {status}

{herhaal per pagina indien meerdere}

## Design Tokens

{Als theme gevuld:}

- **Kleuren**: {primary, secondary, accent, bg, text}
- **Typography**: {font families}
  {Als $TYPE_SCALE gevuld:}
  Semantische scale: `text-display`, `text-title-l/m/s`, `text-headline-l/m/s`, `text-body-l/m/s`, `text-code`
  {Als $TYPE_SCALE leeg:}
  Geen semantische scale gedefinieerd — gebruik Tailwind text-scale of stel eigen semantische groepen voor in het design.
- **Spacing**: {scale}
- **CSS vars**: {list}

{Als $HAS_DARK_MODE:}

- **Dark mode**: `.dark` class op root element activeert dark mode — ontwerp voor beide varianten. Toon key screens in light én dark naast elkaar.

{Als $MOTION_TOKENS:}

- **Motion**: `duration-instant` (100ms) voor buttons/toggles · `duration-fast` (200ms) voor tooltips/hovers · `duration-normal` (300ms) voor menus/accordions · `duration-slow` (500ms) voor modals/drawers. Easing: `ease-out` (enter), `ease-in` (exit), `ease-in-out` (toggle). Specificeer per interactief element welke token van toepassing is.

{Als geen theme:}
Tailwind defaults — Claude Design mag eigen palet voorstellen (noteer de keuze in de handoff).

## Block Inventory

Bestaande building blocks die hergebruikt moeten worden (GEEN duplicaten genereren):

### Components

- `{ComponentName}` ({path}) — {beschrijving} · props: {interface samenvatting}

### Hooks

- `{useHook}` ({path}) — {wat het returnt} · aanroep: `{API/service}`

### Services

- `{serviceFn}` ({path}) — {endpoint} → {return type}

## Patterns & Conventies

{uit shared/PATTERNS.md, bullet list met pattern naam + eenregel beschrijving}

- TypeScript strict mode
- Semantic HTML + ARIA
- `cn()` utility voor className composition
- Tailwind scale (geen arbitrary values)
- Sizing vocabulary: `fill` (flex: 1 / width: 100%), `hug` (fit-content/auto), `fixed` (expliciete px/rem waarde) — gebruik deze termen in commentaar bij layout-elementen

## Output Verwachting

Genereer in Claude Design:

1. Visuele layout die de bovenstaande sectie-indeling volgt
2. Hergebruik van bestaande components waar mogelijk (zie Block Inventory)
3. Tokens uit de theme sectie (indien gevuld)
4. Handoff bundle die doorgestuurd kan worden naar Claude Code (`/dev-build`)
```

#### Stap 5: Write + Show

Bepaal output-pad per scope:

| Scope         | Bestand                                            |
| ------------- | -------------------------------------------------- |
| Pagina / Flow | `.project/claude-design-brief.md`                  |
| Component     | `.project/claude-design-brief-{component-name}.md` |
| Beide         | beide bestanden hierboven                          |

Write bestand(en).

**Backlog sync** — als `{$TARGET}` een PAGE of COMPONENT is in de backlog:

Parse `backlog.html` → match op `name === {$TARGET}`:

- Zet `feature.status = "DEFINED"` (Path B: brief gegenereerd, wacht op convert)
- Update `data.updated`, edit terug in `backlog.html`.

Print samenvatting:

```
CLAUDE DESIGN BRIEF GEGENEREERD
════════════════════════════════════════════════
Bestand(en):   {pad(en)}
Scope:         {pagina | component | flow | beide | volledige app}
Pagina's:      {N}   (of n.v.t. voor puur component-brief)
Components:    {M} in inventory
Tokens:        [✓ uit theme | ⚠ Tailwind defaults]
════════════════════════════════════════════════

Next steps:
  1. Open {bestand(en)}
  2. Kopieer inhoud → plak in Claude Design (claude.ai/design)
  3. Na generatie → "Handoff to Claude Code" button

  Klaar met extern design?
  /frontend-convert {$TARGET}
```

Geen FASE 3 confirm nodig voor brief-mode. Skip naar Completion.

---

## FASE 3: Confirm + Loop

Reached after any mutating action. Show what will change:

```
WIJZIGINGEN
════════════════════════════════════════════════
+ Pagina "checkout" toegevoegd (3 secties)
~ Flow "purchase" bijgewerkt (stap toegevoegd)
- Principe "Dark theme" verwijderd

Totaal na wijziging: {N} pagina's, {C} components, {M} flows, {P} principes
════════════════════════════════════════════════
```

```yaml
header: "Confirm"
question: "Wijzigingen doorvoeren?"
options:
  - label: "Ja, opslaan (Recommended)", description: "Schrijf naar project.json"
  - label: "Aanpassen", description: "Terug naar actie selectie"
  - label: "Annuleren", description: "Stop zonder wijzigingen"
multiSelect: false
```

If "Ja": proceed to FASE X (write + post-flight).
If "Aanpassen": loop back to FASE 1 (ACTION_SELECT with updated state).
If "Annuleren": exit cleanly, no changes written.

---

## FASE X: Post-flight Validation

### X.0 Checkpoint Save (vóór write)

Sla de huidige `design` sectie op als checkpoint in `.project/session/design-history.json` vóórdat er geschreven wordt. Wordt overgeslagen bij Herstellen-restores (zie Herstellen Stap 4).

1. Gebruik de huidige `design` staat uit FASE 0.3 (al in geheugen — geen nieuwe read nodig). Skip als leeg.
2. Lees `.project/session/design-history.json` (maak aan als niet bestaat: `[]`).
3. Prepend nieuw entry:
   ```json
   {
     "timestamp": "{ISO 8601}",
     "trigger": "{actie-beschrijving, bijv. 'Pagina checkout toegevoegd'}",
     "snapshot": { "pages": [...], "flows": [...], "principles": [...] }
   }
   ```
4. Houd max 10 entries: drop oudste als `length > 10`.
5. Schrijf terug naar `.project/session/design-history.json`.

### X.1 Write to project.json

Follow the Read/Write Protocol defined above. Only mutate the `design` section.

### X.2 Validate

1. **File validation** — project.json exists, is valid JSON
2. **Content validation:**
   - `design.pages` is an array, each page has `name`, `purpose`, `status`, `sections`
   - `design.flows` is an array, each flow has `name` and `steps` (non-empty array)
   - `design.principles` is an array, each principle has `name` and `description`
3. **Integrity check:**
   - Other project.json sections unchanged
   - No duplicate names within pages, flows, or principles
4. **Cross-reference check:**
   - Flow steps reference existing pages (warn if orphaned, don't block)

```
POST-FLIGHT CHECK
════════════════════════════════════════════════
File:       [✓] .project/project.json — valid JSON
Pages:      [✓] {N} pagina's — all valid
Flows:      [✓] {M} flows — all valid
Principles: [✓] {P} principes — all valid
Integrity:  [✓] andere secties ongewijzigd
CrossRef:   [✓|⚠] flow stappen → pagina's
════════════════════════════════════════════════
```

**On failure:**

```yaml
header: "Validatie"
question: "Post-flight validatie gefaald. Hoe wil je doorgaan?"
options:
  - label: "Auto-fix (Recommended)", description: "Los automatisch op"
  - label: "Handmatig fixen", description: "Ik fix het zelf"
  - label: "Negeren", description: "Ga door ondanks fout"
multiSelect: false
```

---

## Completion

### Backlog Sync

After defining pages, sync them to the backlog:

1. Read `project.json` → get `design.pages[]` array
2. Read `.project/backlog.html` (if it exists) → parse JSON from `<script id="backlog-data" type="application/json">...</script>`
   - **If backlog doesn't exist**: create it from template `{skills_path}/shared/references/backlog-template.html` → `.project/backlog.html`. Set `data.source` to `"/frontend-design"`, `data.project` to project directory name.
3. For each page in `design.pages[]`:
   - Generate kebab-case name from page name
   - Check if `data.features.find(f => f.name === name)` exists
   - **Not found**: add to `data.features[]`:
     ```json
     {
       "name": "{kebab-case-name}",
       "type": "PAGE",
       "status": "TODO",
       "phase": "P3",
       "description": "{page.purpose}",
       "dependencies": []
     }
     ```
   - **Found**: skip (don't overwrite existing items)
4. Set `data.updated` to today's date
5. Write back via Edit (keep `<script>` tags intact)

### Update DevInfo

Update `.project/session/devinfo.json`:

```json
{
  "currentSkill": { "name": "frontend-design", "phase": "COMPLETE" },
  "handoff": {
    "from": "frontend-design",
    "to": null,
    "data": {
      "designLocation": ".project/project.json#design",
      "pages": {
        "count": 4,
        "names": ["dashboard", "settings", "login", "checkout"]
      },
      "flows": {
        "count": 2,
        "names": ["onboarding", "purchase"]
      },
      "principles": {
        "count": 3,
        "names": ["Mobile-first", "Accessibility", "Consistent spacing"]
      }
    }
  }
}
```

### Completion Report

```
DESIGN SPEC [AANGEMAAKT|BIJGEWERKT]
═══════════════════════════════════════════════════════════════

Locatie: .project/project.json (design sectie)

[Alleen tonen als design-history.json bestaat en niet leeg is:]
WIJZIGINGEN DEZE SESSIE
─────────────────────────────────────────────────
+ {naam}  (nieuw pagina/flow/principe)
~ {naam}  (gewijzigd — veld: {purpose|sections|steps|...})
- {naam}  (verwijderd)
[Als geen wijzigingen: dit blok weglaten]
─────────────────────────────────────────────────

| Categorie | Aantal | Details                            |
|-----------|--------|------------------------------------|
| Pagina's  | {N}    | {status breakdown: 2 DEF, 1 BLT}  |
| Flows     | {M}    | {flow names joined}                |
| Principes | {P}    | {principle names joined}           |

Backlog: {X} nieuwe PAGE items toegevoegd
  {lijst van toegevoegde pagina namen}

Next steps:
  1. /frontend-design       → voeg meer pagina's/flows toe (iteratief)
  2. /frontend-tokens       → design tokens en kleuren op basis van principes
  3. /frontend-design       → genereer Claude Design brief (brief-mode)
  4. /frontend-convert      → converteer een bestaand design naar code
  5. /frontend-check        → performance/SEO audit (als flows gedefinieerd: ook scope Flow beschikbaar)
  6. /frontend-check --scope=a11y → accessibility audit

═══════════════════════════════════════════════════════════════
```

---

## Restrictions

This skill must **NEVER**:

- Write design spec without user confirmation (FASE 3)
- Auto-delete pages, flows, or principles (only via explicit "Verwijderen" route)
- Overwrite other sections in project.json
- Skip pre-flight or post-flight validation
- Guess page structure without user input or codebase evidence (Importeren route)

This skill must **ALWAYS**:

- Run pre-flight validation (FASE 0) before any operation
- Use AskUserQuestion for all user choices
- Show current values when editing existing items
- Show change preview before confirming (FASE 3)
- Confirm before destructive actions with "Nee" as recommended option
- Save checkpoint (X.0) before every mutating write — except restores
- Run post-flight validation (FASE X) after any write
- Cross-reference flow steps against defined pages
- Update DevInfo at completion
- Show completion report with next steps
