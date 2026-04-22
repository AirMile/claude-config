# Dashboard: project.json Format

Het project dashboard is een interactieve UI die project metadata toont en bewerkt. Alle skills die het dashboard lezen of schrijven gebruiken dezelfde aanpak.

**Bestand:** `.project/project.json`
**Template:** `{skills_path}/shared/references/dashboard-template.html`
**Server:** `{skills_path}/shared/references/serve-backlog.js` (poort 9876)

**UI tabs:** Concept | Architecture | Design | Theme | Stack | Thinking
`stack`, `data`, `endpoints` en `theme` zijn subtabs in de UI, maar blijven aparte secties in project.json.
`features` heeft geen eigen tab — feature detail is zichtbaar via de backlog detail modal (fetcht `feature.json`).

## Dashboard lezen

1. Read `.project/project.json`
2. Parse als JSON
3. Gebruik de relevante sectie

**Secties:**

| Sectie         | Beschrijving                                           |
| -------------- | ------------------------------------------------------ |
| `concept`      | Project naam + volledige concept (markdown)            |
| `architecture` | Mermaid diagram + beschrijving van de architectuur     |
| `design`       | Pagina's, user flows, design principes                 |
| `theme`        | Kleuren, fonts, spacing, CSS vars                      |
| `stack`        | Framework, taal, DB, hosting, packages                 |
| `data`         | Entities, velden, relaties                             |
| `endpoints`    | Method, path, auth, status, beschrijving               |
| `features`     | Naam, status, summary, depends, created                |
| `thinking`     | Chronologisch log van ideeën en beslissingen           |
| `context`      | Project structuur, routing, patterns (runtime context) |

## Dashboard schrijven

1. Read `.project/project.json` (of maak nieuw als niet bestaat)
2. Parse JSON
3. Muteer de relevante sectie (NIET andere secties overschrijven)
4. Write terug als `JSON.stringify(data, null, 2)`

**Nieuw bestand aanmaken** als `.project/project.json` niet bestaat:

```json
{
  "concept": {
    "name": "",
    "pitch": "",
    "content": ""
  },
  "architecture": {
    "diagram": "",
    "description": ""
  },
  "design": {
    "pages": [],
    "flows": [],
    "principles": []
  },
  "theme": {
    "colors": [],
    "fonts": { "headings": "", "body": "", "mono": "" },
    "spacing": "",
    "motion": { "durations": [], "easings": [] },
    "interactions": { "focusRing": {}, "hover": {}, "active": {} },
    "modes": [],
    "cssVars": ""
  },
  "stack": {
    "framework": "",
    "language": "",
    "styling": "",
    "db": "",
    "auth": "",
    "hosting": "",
    "packages": []
  },
  "data": { "entities": [] },
  "endpoints": [],
  "features": [],
  "thinking": [],
  "context": {
    "structure": "",
    "routing": [],
    "patterns": [],
    "updated": ""
  }
}
```

## Merge-strategie per sectie

| Sectie         | Strategie           | Toelichting                                                  |
| -------------- | ------------------- | ------------------------------------------------------------ |
| `concept`      | **OVERWRITE**       | `name`+`pitch`+`content` overschrijven, `thinking` is APPEND |
| `architecture` | **OVERWRITE**       | Diagram + beschrijving volledig overschrijven                |
| `design`       | **MERGE op `name`** | Pages/flows/principles merge op naam, nooit auto-delete      |
| `theme`        | **OVERWRITE**       | Volledig overschrijven bij `/frontend-tokens`                |
| `stack`        | **MERGE**           | Voeg packages toe, overschrijf geen bestaande                |
| `data`         | **MERGE**           | Voeg entities/velden/relaties toe per entity                 |
| `endpoints`    | **MERGE**           | Voeg toe of update status, verwijder niet                    |
| `features`     | **MERGE op `name`** | Update status, voeg nieuwe toe, verwijder niet               |
| `thinking`     | **APPEND**          | Altijd toevoegen, nooit overschrijven of verwijderen         |
| `context`      | **MERGE per key**   | Update structure/routing/patterns individueel                |

### Stack merge

```
1. Read project.json
2. Voor elk nieuw package:
   - Check of package.name al bestaat in stack.packages
   - Zo nee: push naar stack.packages
   - Zo ja: update version als nieuwe versie nieuwer is
3. Overschrijf top-level stack velden (framework, language, etc.) alleen als ze leeg zijn OF bij initieel vullen
4. Write project.json
```

### Data merge

```
1. Read project.json
2. Voor elke entity:
   - Check of entity.name al bestaat in data.entities
   - Zo nee: push hele entity
   - Zo ja: merge velden (voeg nieuwe toe, overschrijf niet bestaande) en relaties
3. Write project.json
```

### Endpoints merge

```
1. Read project.json
2. Voor elk endpoint:
   - Check of combinatie method+path al bestaat
   - Zo nee: push nieuw endpoint
   - Zo ja: update status (bijv. "planned" -> "done"), behoud rest
3. Write project.json
```

### Design merge

```
1. Read project.json
2. Voor elke page:
   - Check of page.name al bestaat in design.pages
   - Zo nee: push nieuwe page
   - Zo ja: update purpose, status, sections, flows, notes
3. Idem voor flows (merge op name, update steps/notes)
4. Idem voor principles (merge op name, update description)
5. Nooit auto-delete — alleen via expliciete verwijder-actie
6. Write project.json
```

### Features merge

```
1. Read project.json
2. Voor elke feature:
   - Check of feature.name al bestaat in features array
   - Zo nee: push nieuwe feature
   - Zo ja: update status/stage (bijv. "DOING" stage "defined" -> "built"), update summary als gewijzigd
3. Write project.json
```

### Thinking append

```
1. Read project.json
2. Push nieuw thinking entry naar thinking array
3. Write project.json
```

Nooit bestaande entries wijzigen of verwijderen — append-only log.

### Context merge

```
1. Read project.json
2. Voor elk veld in context:
   - structure: OVERWRITE (volledige file tree)
   - routing: OVERWRITE (volledige routing array)
   - patterns: MERGE (voeg nieuwe toe, update bestaande op key)
   - updated: zet naar huidige datum
3. Write project.json
```

Skills schrijven naar `context` na elke build/refactor. CLAUDE.md verwijst naar `project.json` voor deze runtime context.

## Sectie schema's

### concept

```json
{
  "name": "Project Naam",
  "pitch": "Korte samenvatting van het concept in 1-2 zinnen.",
  "conceptFile": "project-concept.md",
  "content": "",
  "thinking": [
    {
      "type": "idea",
      "date": "2026-02-20",
      "title": "Initieel idee",
      "summary": "Key insight van de thinking output (max 200 chars)",
      "file": ".project/thinking/2026-02-20-idea-initieel-idee.md",
      "source": "/thinking-concept"
    }
  ]
}
```

`name` = korte project naam (voor dashboard header)
`pitch` = 1-2 zinnen samenvatting van het concept (voor lichte context loading door dev skills). Moet altijd gevuld zijn — niet afhankelijk van fallback naar `content`.
`conceptFile` = verwijzing naar `.project/project-concept.md` (preferred formaat voor nieuwe projecten)
`content` = legacy inline concept content. Voor nieuwe projecten leeg — volledige content staat in `project-concept.md`.
`thinking` = concept progressie log (append-only) — toont de stappen van idea → brainstorm → critique voor het concept. Zelfde entry-formaat als main `thinking`, maar specifiek voor concept-scope.

### Eén bron van waarheid

**NOOIT beide** `content` en `project-concept.md` tegelijk invullen. Regels bij write:

1. **Nieuw project** (preferred): maak `.project/project-concept.md` aan, zet `concept.conceptFile = "project-concept.md"`, houd `concept.content = ""`.
2. **Legacy project** (bestaande inline `content`): laat zoals is of migreer eenmalig (verplaats `content` → `.md`, zet `content = ""`).
3. **Bij concept write**: eerst check of `project-concept.md` bestaat. Zo ja → schrijf naar .md, zet `content = ""`. Zo nee + legacy content → blijf inline schrijven.

### project-concept.md

Volledig concept document als plain markdown (niet JSON-escaped).

**Read:** `Read .project/project-concept.md`
**Write:** Direct markdown schrijven. Update ook `concept.name` en `concept.pitch` in project.json (zodat lichte readers actuele metadata hebben).

Dashboard server's `populateFromProject()` handelt beide formaten af — bestaande legacy projecten blijven werken.

## project-context.json

Nieuw bestand `.project/project-context.json` bevat runtime context die alleen door build/test/refactor skills gelezen wordt. Schema:

```json
{
  "architecture": {},
  "context": {},
  "learnings": []
}
```

De dashboard server's `populateFromProject()` mergt dit bestand in de unified response. Backward compatible: als velden nog in project.json staan (legacy), worden die gebruikt.

### architecture

```json
{
  "dataFlow": "Request → API Gateway → Auth check → Service → Database",
  "layers": [
    { "name": "API Laag", "order": 1 },
    { "name": "Services", "order": 2 },
    { "name": "Data Laag", "order": 3 }
  ],
  "components": [
    {
      "name": "API Gateway",
      "layer": "API Laag",
      "description": "Routing en rate limiting voor alle endpoints",
      "status": "done",
      "src": ["src/gateway.js", "src/middleware/rateLimit.js"],
      "test": ["test/gateway.test.js"],
      "connects_to": ["Auth Service", "App Service"],
      "endpoints": ["/api/auth/*", "/api/users/*"],
      "entities": ["User"]
    },
    {
      "name": "Auth Service",
      "layer": "Services",
      "description": "JWT authenticatie en sessie management",
      "status": "planned",
      "connects_to": ["PostgreSQL"]
    },
    {
      "name": "PostgreSQL",
      "layer": "Data Laag",
      "status": "external"
    }
  ]
}
```

#### Component-first model

Het component is de atomaire eenheid. Alle data per component zit in één object — geen fuzzy matching nodig.

**Component velden:**

| Veld          | Type     | Verplicht | Beschrijving                                            |
| ------------- | -------- | --------- | ------------------------------------------------------- |
| `name`        | string   | ja        | Unieke functionele naam                                 |
| `layer`       | string   | ja        | Laag naam (moet matchen met `layers[].name`)            |
| `description` | string   | nee       | Korte functionele beschrijving (max 200 chars)          |
| `status`      | string   | ja        | `done` \| `planned` \| `external`                       |
| `src`         | string[] | nee       | Source bestanden (relatief aan project root)            |
| `test`        | string[] | nee       | Test bestanden                                          |
| `connects_to` | string[] | nee       | Component namen waar dit component naar communiceert    |
| `endpoints`   | string[] | nee       | Endpoint paths die bij dit component horen              |
| `entities`    | string[] | nee       | Entity namen die dit component gebruikt                 |
| `feature`     | string   | nee       | Feature naam die dit component heeft aangemaakt/gebouwd |

**Layer velden:**

| Veld    | Type   | Beschrijving                   |
| ------- | ------ | ------------------------------ |
| `name`  | string | Unieke laag naam               |
| `order` | number | Sorteervolgorde (1 = bovenaan) |

**`dataFlow`** = één-regel samenvatting van de volledige request flow (voor snelle context).

**Status waarden:** `done` = gebouwd en werkend, `planned` = nog niet gebouwd, `external` = externe service/database (niet door ons beheerd).

#### Voordelen t.o.v. oude model

- **Expliciete connections**: `connects_to` array i.p.v. parsen uit Mermaid `-->` pijlen
- **Expliciete endpoints/entities**: direct per component, niet fuzzy gematcht achteraf
- **Geen dubbele data**: description, files, status allemaal in één object
- **Layer als first-class concept**: sortering en groepering op basis van `order`, niet op subgraph parsing

#### Diagram (optioneel)

Het Mermaid diagram is nu **optioneel** — de Code Cards zijn de primaire view. Als een diagram beschikbaar is, toont de UI een "Diagram" toggle knop.

**Preferred**: `.project/architecture.mmd` bestand (plain Mermaid, geen JSON-escaping).
**Legacy**: Inline `diagram` string in project-context.json.

Skills mogen het diagram nog steeds genereren voor visuele context, maar het is niet meer de bron van waarheid voor connections of status. Die komen uit `components[]`.

#### Diagram conventies (als diagram gegenereerd wordt)

**classDef:**

```
classDef done fill:#13261c,stroke:#3fb950,stroke-width:1.5px,color:#c9d1d9
classDef planned fill:#1b1530,stroke:#8b5cf6,stroke-dasharray:5 5,color:#8b949e
classDef external fill:#1c2128,stroke:#30363d,color:#8b949e
```

**Node labels:** `GW[API Gateway<br/>gateway.js]:::done`
**Subgraphs:** Groepeer per `layer.name`.

#### Skills die architecture schrijven

| Skill         | Wat het schrijft                                                                              | Wanneer               |
| ------------- | --------------------------------------------------------------------------------------------- | --------------------- |
| `/dev-define` | Initiële `layers` + `components` (status planned, geen src/test) + `dataFlow`                 | Bij feature definitie |
| `/dev-build`  | Update `components`: status → done, vul `src`, `test`, `connects_to`, `endpoints`, `entities` | Na build              |
| `/dev-verify` | Update `components`: bevestig status done, voeg test files toe                                | Na test               |
| `/core-pull`  | Sync volledige `architecture` sectie bij pull                                                 | Bij context sync      |

**Write strategie:**

1. Read `project-context.json`
2. Voor elk component: check of `name` al bestaat in `components[]`
   - Zo nee: push nieuw component
   - Zo ja: merge velden (overschrijf `status`, `src`, `test`; append `connects_to`, `endpoints`, `entities` met dedup)
3. Write terug

### theme

**Design system bron van waarheid.** `theme` bevat alle design tokens (colors, typography, spacing, borderRadius, shadows, modes, motion, interactions, cssVars). De dashboard UI rendert dit als "Design System" sectie. Beheer via `/frontend-tokens`.

```json
{
  "colors": {
    "main": [
      {
        "token": "dark",
        "value": "#1a1a2e",
        "usage": "Primary text, dark backgrounds"
      },
      { "token": "light", "value": "#ffffff", "usage": "Light backgrounds" }
    ],
    "accent": [
      {
        "token": "accent-primary",
        "value": "#3B82F6",
        "usage": "CTAs, links, focus"
      }
    ],
    "semantic": [
      { "token": "success", "value": "#10B981", "usage": "Positive feedback" }
    ]
  },
  "typography": {
    "families": {
      "heading": "Inter, sans-serif",
      "body": "Inter, sans-serif",
      "mono": "JetBrains Mono, monospace"
    },
    "sizes": [{ "token": "text-base", "size": "1rem", "lineHeight": "1.5rem" }]
  },
  "spacing": {
    "base": "4px",
    "scale": [
      { "token": "spacing-4", "value": "16px", "usage": "Component padding" }
    ]
  },
  "breakpoints": [
    { "token": "screen-md", "value": "768px", "target": "Tablets" }
  ],
  "borderRadius": [
    { "token": "rounded-md", "value": "0.375rem", "usage": "Buttons, inputs" }
  ],
  "shadows": [
    {
      "token": "shadow-md",
      "value": "0 4px 6px -1px rgb(0 0 0 / 0.1)",
      "usage": "Cards"
    }
  ],
  "modes": {
    "light": ":root { --background: #fff; --foreground: #1a1a2e; }",
    "dark": ".dark { --background: #1a1a2e; --foreground: #fff; }"
  },
  "cssVars": ":root { --color-dark: #1a1a2e; --color-light: #fff; --font-heading: Inter, sans-serif; }"
}
```

`cssVars` = complete CSS variabelen export (voor consumptie door andere skills)
`modes` = light/dark mode CSS (object met mode naam als key)
Overige velden = structured tokens per categorie

### stack

```json
{
  "framework": "Next.js 14",
  "language": "TypeScript",
  "styling": "Tailwind CSS",
  "db": "PostgreSQL + Prisma",
  "auth": "NextAuth.js",
  "hosting": "Vercel",
  "packages": [{ "name": "stripe", "version": "^14.0", "purpose": "Payments" }]
}
```

### data

**Optioneel — alleen data-heavy projecten.** In de praktijk laten simpele projecten (static sites, utilities, games, UI-only components) dit leeg. Skills die schrijven (`/dev-define`, `/dev-verify`, `/dev-refactor`, `/game-define`, `/team-verify`) slaan deze update over als het domein geen expliciete entities introduceert — log dan `Skipped data.entities: no entities`.

```json
{
  "entities": [
    {
      "name": "User",
      "fields": [
        { "name": "id", "type": "uuid", "key": "PK" },
        { "name": "email", "type": "string", "key": "unique" }
      ],
      "relations": [{ "target": "Order", "type": "1:N" }]
    }
  ]
}
```

### endpoints

```json
[
  {
    "method": "POST",
    "path": "/api/auth/login",
    "auth": false,
    "status": "done",
    "description": "JWT login met email/password"
  }
]
```

**Status waarden:** `planned` | `building` | `done`

### features

```json
[
  {
    "name": "pin-mode",
    "status": "DOING",
    "stage": "defined",
    "summary": "Shift+Click multi-select voor inspect overlay",
    "depends": ["clipboard-redesign"],
    "created": "2026-02-20"
  }
]
```

**Status waarden:** `TODO` | `DOING` | `DONE`
**Stage waarden (alleen bij DOING):** `defining` | `defined` | `building` | `built` | `testing`

### thinking

```json
[
  {
    "type": "idea",
    "date": "2026-02-20",
    "title": "SaaS dashboard voor freelancers",
    "summary": "SaaS dashboard met real-time urenregistratie en factuurintegratie voor ZZP'ers.",
    "file": ".project/thinking/2026-02-20-idea-saas-dashboard.md",
    "source": "/thinking-concept"
  },
  {
    "type": "brainstorm",
    "date": "2026-02-20",
    "title": "Auth strategie",
    "summary": "JWT stateless gekozen voor schaalbaarheid en toekomstige mobile app support.",
    "file": ".project/thinking/2026-02-20-brainstorm-auth-strategie.md",
    "variants": ["JWT stateless", "Session cookies", "OAuth-only"],
    "chosen": "JWT stateless",
    "source": "/thinking-brainstorm"
  },
  {
    "type": "critique",
    "date": "2026-02-20",
    "title": "Concept review: dashboard MVP",
    "summary": "MVP scope te breed: factuurmodule uitstellen, focus op urenregistratie + rapportage.",
    "file": ".project/thinking/2026-02-20-critique-dashboard-mvp.md",
    "source": "/thinking-critique"
  },
  {
    "type": "decision",
    "date": "2026-02-20",
    "title": "JWT vs Session auth",
    "summary": "JWT gekozen: stateless API nodig voor mobile app later, acceptabele trade-off op revocation.",
    "file": ".project/thinking/2026-02-20-decision-jwt-vs-session.md",
    "options": ["JWT", "Session cookies", "OAuth-only"],
    "chosen": "JWT",
    "rationale": "Stateless API nodig voor mobile app later",
    "source": "/thinking-decide"
  }
]
```

**Type waarden:** `idea` | `brainstorm` | `critique` | `decision`

Alle entries hebben `type`, `date`, `title`, `summary`, `file`, `source`. Extra velden per type:

- `brainstorm`: `variants` (alle opties), `chosen` (gekozen optie)
- `decision`: `options`, `chosen`, `rationale`

`summary` = max 200 chars, key insight van de thinking output.
`file` = pad naar volledige markdown in `.project/thinking/`. Bestandsnaam: `{date}-{type}-{slug}.md`.

**Scope:** het top-level `thinking[]` array bevat alleen:

- `dev-todo` entries met `newFeature` veld (kritiek signaal voor `/dev-plan` independent-feature detectie)
- Legacy entries van oude runs

Nieuwe thinking-output van `/thinking-decide`, `/thinking-research`, `/thinking-brainstorm` (non-concept scope) en `/thinking-critique` (non-concept scope) schrijft **alleen** naar `.project/thinking/*.md` — geen entry in `project.json` meer. De markdown is de bron van waarheid. Concept-scope thinking blijft in `concept.thinking[]` (gebruikt door `/dev-plan` voor evolution diff en dashboard).

Skills die thinking-output consumeren (zoals `/dev-define`) lezen rechtstreeks via Grep op `.project/thinking/*.md` voor naam-match.

**Legacy:** oude entries met `content` i.p.v. `summary`+`file` blijven werken. Skills die entries lezen checken op `file` (nieuw) of `content` (legacy).

### context

```json
{
  "structure": "src/\n  app/          # Next.js pages\n  components/   # UI components\n  lib/          # Utils",
  "routing": [
    "/ → Home",
    "/diensten/:slug → Service detail",
    "/api/auth/* → Auth endpoints"
  ],
  "patterns": [
    "Path alias: @/ → src/",
    "Env setup: copy .env.example → .env",
    "Sanity preview: Draft mode via /api/preview",
    "Code maturity: student — respecteer lesmateriaal-patronen, geen over-abstractions, duplicatie <10 regels oké"
  ],
  "updated": "2026-02-20"
}
```

`structure` = file tree (zelfde formaat als voorheen in CLAUDE.md `## Project structuur`). Key directories met inline comments.
`routing` = route patterns met arrow notation. Alleen voor web projects met routing.
`patterns` = non-obvious patterns, gotchas, env setup. Eén string per item, `key: detail` formaat. Quality rules: project-specific only, concise, elk item moet z'n plek verdienen.
`updated` = datum van laatste context update.

### learnings

```json
[
  {
    "date": "2026-03-12",
    "feature": "auth-login",
    "type": "pattern",
    "summary": "JWT refresh via httpOnly cookie rotation i.p.v. DB-stored tokens"
  }
]
```

`type` waarden: `pattern` (architecturale keuze), `pitfall` (bug/gotcha), `convention` (project-breed patroon), `observation` (cross-feature inzicht).
`date` = extractie datum. `feature` = bron-feature. `summary` = max 200 chars.
Append-only log. Skills die features voltooien extracten learnings automatisch (zie dev-verify FASE 6, dev-refactor FASE 5).

**Dit vervangt de dynamische CLAUDE.md secties** (`## Project structuur`, `## Routing`, `## Non-obvious patterns`). CLAUDE.md bevat nu alleen een referentie naar `project.json` voor deze context.

## Welke skills schrijven wat

### project.json secties

| Sectie             | Geschreven door                                                                              | Wanneer                                  |
| ------------------ | -------------------------------------------------------------------------------------------- | ---------------------------------------- |
| `concept`          | `/thinking-concept`, `/thinking-brainstorm`, `/thinking-critique`, `/dev-plan`, `/game-plan` | Bij concept creatie/iteratie/plan        |
| `design`           | `/frontend-design`, `/frontend-tokens`                                                       | Bij design spec/page build/theme creatie |
| `theme`            | `/frontend-tokens`                                                                           | Na theme create/update                   |
| `stack`            | `/core-setup`, `/dev-plan`, `/dev-define`, `/dev-build`, `/frontend-design`                  | Bij detectie/nieuwe deps                 |
| `data`             | `/dev-define`, `/game-define`                                                                | Bij entity definitie                     |
| `endpoints`        | `/dev-define`, `/dev-build`                                                                  | Bij API definitie / na build             |
| `features`         | `/dev-define`, `/dev-build`, `/dev-verify`, `/team-verify`, `/game-define`, `/game-build`    | Bij status wijziging (DOING/DONE)        |
| `concept.thinking` | `/thinking-concept`, `/thinking-brainstorm`, `/thinking-critique`                            | Bij concept-scope thinking (append)      |
| `thinking`         | `/dev-todo` (entries met `newFeature` veld)                                                  | Bij nieuwe backlog items                 |

### project-context.json secties

| Sectie         | Geschreven door                                                               | Wanneer                                                                                |
| -------------- | ----------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| `architecture` | `/dev-define`, `/dev-build`, `/game-define`, `/game-build`                    | Bij architectuur definitie / na build                                                  |
| `context`      | `/core-setup`, `/dev-build`, `/dev-refactor`, `/game-build`, `/game-refactor` | Bij build/refactor (structuur, routing, patterns)                                      |
| `learnings`    | `/dev-verify`, `/dev-refactor`                                                | Bij feature completion (extractie uit build decisions, test fixes, refactor decisions) |

### Skill sync overzicht

| Skill              | project.json                                                       | project-context.json                                  | Wanneer              |
| ------------------ | ------------------------------------------------------------------ | ----------------------------------------------------- | -------------------- |
| `/core-setup`      | `stack` (volledig)                                                 | `context` (initieel)                                  | Na project generatie |
| `/dev-define`      | `data.entities`, `endpoints`, `stack.packages`, `features` (DOING) | `architecture` (write), `learnings` (read)            | FASE 6               |
| `/dev-build`       | `endpoints`, `stack.packages`, `features` (DOING+built)            | `context`, `architecture` (write), `learnings` (read) | FASE 4C              |
| `/dev-verify`      | `stack.packages`, `endpoints`, `data.entities`, `features` (DONE)  | `architecture`, `learnings` (write)                   | FASE 6 completion    |
| `/dev-refactor`    | `stack.packages`, `endpoints`, `data.entities`                     | `context`, `architecture`, `learnings` (write)        | FASE 5 completion    |
| `/frontend-design` | `design` (pages, flows, principles), `features` (batch TODO)       | —                                                     | Bij elke uitvoering  |
| `/frontend-design` | `stack.packages`, `design.pages`, `features` (DOING+built)         | —                                                     | Na FASE 4            |
| `/frontend-tokens` | `design.principles`                                                | —                                                     | Na completion        |
| `/game-define`     | `data.entities`, `stack.packages`, `features` (DOING)              | `architecture` (write)                                | FASE 6               |
| `/game-build`      | `features` (DOING+built)                                           | `context`, `architecture` (write)                     | FASE 5 completion    |
| `/team-verify`     | `features`, `stack.packages`, `endpoints`, `data.entities`         | `architecture` (write)                                | FASE 7 completion    |
| `/game-refactor`   | `features` (DONE)                                                  | `context`, `architecture` (write)                     | FASE 5 completion    |

## Server

De server draait op `http://localhost:9876` en serveert zowel backlogs als dashboards:

- `http://localhost:9876/` — overzicht alle projecten
- `http://localhost:9876/{project}` — project dashboard (hoofdpagina)
- `http://localhost:9876/{project}/backlog` — backlog kanban
- `http://localhost:9876/{project}/feature/{name}` — feature detail (unified feature.json)

De feature detail endpoint leest `feature.json` (zie `shared/FEATURE.md` voor schema).

Start de server:

```bash
curl -s http://localhost:9876/ > /dev/null 2>&1 || nohup node {skills_path}/shared/references/serve-backlog.js > /tmp/backlog-server.log 2>&1 &
```
