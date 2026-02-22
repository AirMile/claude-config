# Dashboard: project.json Format

Het project dashboard is een interactieve UI die project metadata toont en bewerkt. Alle skills die het dashboard lezen of schrijven gebruiken dezelfde aanpak.

**Bestand:** `.workspace/project.json`
**Template:** `{skills_path}/shared/references/dashboard-template.html`
**Server:** `{skills_path}/shared/references/serve-backlog.js` (poort 9876)

## Dashboard lezen

1. Read `.workspace/project.json`
2. Parse als JSON
3. Gebruik de relevante sectie

**Secties:**

| Sectie      | Beschrijving                                 |
| ----------- | -------------------------------------------- |
| `concept`   | Project naam + volledige concept (markdown)  |
| `theme`     | Kleuren, fonts, spacing, CSS vars            |
| `stack`     | Framework, taal, DB, hosting, packages       |
| `data`      | Entities, velden, relaties                   |
| `endpoints` | Method, path, auth, status, beschrijving     |
| `features`  | Naam, status, summary, depends, created      |
| `thinking`  | Chronologisch log van ideeën en beslissingen |

## Dashboard schrijven

1. Read `.workspace/project.json` (of maak nieuw als niet bestaat)
2. Parse JSON
3. Muteer de relevante sectie (NIET andere secties overschrijven)
4. Write terug als `JSON.stringify(data, null, 2)`

**Nieuw bestand aanmaken** als `.workspace/project.json` niet bestaat:

```json
{
  "concept": {
    "name": "",
    "content": ""
  },
  "theme": {
    "colors": [],
    "fonts": { "headings": "", "body": "", "mono": "" },
    "spacing": "",
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
  "thinking": []
}
```

## Merge-strategie per sectie

| Sectie      | Strategie           | Toelichting                                            |
| ----------- | ------------------- | ------------------------------------------------------ |
| `concept`   | **OVERWRITE**       | Volledig overschrijven bij `/dev-plan` of `/game-plan` |
| `theme`     | **OVERWRITE**       | Volledig overschrijven bij `/frontend-theme`           |
| `stack`     | **MERGE**           | Voeg packages toe, overschrijf geen bestaande          |
| `data`      | **MERGE**           | Voeg entities/velden/relaties toe per entity           |
| `endpoints` | **MERGE**           | Voeg toe of update status, verwijder niet              |
| `features`  | **MERGE op `name`** | Update status, voeg nieuwe toe, verwijder niet         |
| `thinking`  | **APPEND**          | Altijd toevoegen, nooit overschrijven of verwijderen   |

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

### Features merge

```
1. Read project.json
2. Voor elke feature:
   - Check of feature.name al bestaat in features array
   - Zo nee: push nieuwe feature
   - Zo ja: update status (bijv. "DEF" -> "BLT"), update summary als gewijzigd
3. Write project.json
```

### Thinking append

```
1. Read project.json
2. Push nieuw thinking entry naar thinking array
3. Write project.json
```

Nooit bestaande entries wijzigen of verwijderen — append-only log.

## Sectie schema's

### concept

```json
{
  "name": "Project Naam",
  "content": "# Project Naam\n\nVolledige concept beschrijving in markdown.\n\n## Core Concept\n\n...\n\n## Doelgroep\n\n..."
}
```

`name` = korte project naam (voor dashboard header)
`content` = volledige concept document in markdown (vervangt legacy `concept.md`)

### theme

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
    "status": "DEF",
    "summary": "Shift+Click multi-select voor inspect overlay",
    "depends": ["clipboard-redesign"],
    "created": "2026-02-20"
  }
]
```

**Status waarden:** `TODO` | `DEF` | `BLT` | `TST` | `DONE`

### thinking

```json
[
  {
    "type": "idea",
    "date": "2026-02-20",
    "title": "SaaS dashboard voor freelancers",
    "content": "Kort markdown overzicht van het idee of de analyse",
    "source": "/thinking-idea"
  },
  {
    "type": "brainstorm",
    "date": "2026-02-20",
    "title": "Auth strategie",
    "content": "Gekozen aanpak + samenvatting",
    "variants": ["JWT stateless", "Session cookies", "OAuth-only"],
    "chosen": "JWT stateless",
    "source": "/thinking-brainstorm"
  },
  {
    "type": "critique",
    "date": "2026-02-20",
    "title": "Concept review: dashboard MVP",
    "content": "Analyse + refined versie",
    "source": "/thinking-critique"
  },
  {
    "type": "decision",
    "date": "2026-02-20",
    "title": "JWT vs Session auth",
    "content": "Volledige analyse",
    "options": ["JWT", "Session cookies", "OAuth-only"],
    "chosen": "JWT",
    "rationale": "Stateless API nodig voor mobile app later",
    "source": "/thinking-decide"
  }
]
```

**Type waarden:** `idea` | `brainstorm` | `critique` | `decision`

Alle entries hebben `type`, `date`, `title`, `content`, `source`. Extra velden per type:

- `brainstorm`: `variants` (alle opties), `chosen` (gekozen optie)
- `decision`: `options`, `chosen`, `rationale`

## Feature files (JSON)

Features worden opgeslagen in `.workspace/features/{feature-name}/` als JSON bestanden:

### define.json

```json
{
  "name": "pin-mode",
  "created": "2026-02-20",
  "status": "DEF",
  "depends": ["clipboard-redesign"],
  "summary": "Shift+Click multi-select voor inspect overlay",
  "requirements": [
    {
      "id": "REQ-001",
      "description": "Shift+Click op element pint het",
      "category": "core",
      "testType": "integration",
      "acceptance": "Element heeft pinned state na Shift+Click"
    }
  ],
  "userAnswers": { "coreFunction": "...", "patterns": "..." },
  "design": { "layout": "ASCII wireframe text", "components": [] },
  "apiContract": [
    { "method": "POST", "path": "/api/pins", "description": "..." }
  ]
}
```

### build.json

```json
{
  "feature": "pin-mode",
  "started": "2026-02-20",
  "completed": "2026-02-20",
  "filesChanged": ["src/hooks/usePinMode.ts", "src/components/PinBar.tsx"],
  "packagesAdded": [{ "name": "...", "version": "..." }],
  "decisions": ["Used local state instead of context for performance"],
  "testChecklist": [
    { "id": "REQ-001", "description": "...", "status": "pending" }
  ]
}
```

### test.json

```json
{
  "feature": "pin-mode",
  "runs": [
    {
      "date": "2026-02-20",
      "passed": 5,
      "failed": 1,
      "fixes": ["Fixed edge case in unpinItem when array empty"]
    }
  ],
  "finalStatus": "PASSED",
  "coverage": { "statements": 92, "branches": 85 }
}
```

**Naast JSON**: de bestaande markdown bestanden (01-define.md, 02-build-log.md, 03-test-checklist.md) blijven bestaan als leesbare documentatie. De JSON bestanden zijn de machine-readable versie voor het dashboard.

## Welke skills schrijven wat

| Sectie      | Geschreven door                                                                           | Wanneer                                 |
| ----------- | ----------------------------------------------------------------------------------------- | --------------------------------------- |
| `concept`   | `/thinking-idea`, `/thinking-brainstorm`, `/thinking-critique`, `/dev-plan`, `/game-plan` | Bij concept creatie/iteratie/plan       |
| `theme`     | `/frontend-theme`                                                                         | Na THEME.md generatie                   |
| `stack`     | `/core-setup`, `/dev-plan`, `/dev-define`, `/dev-build`, `/frontend-page`                 | Bij detectie/nieuwe deps                |
| `data`      | `/dev-define`, `/game-define`                                                             | Bij entity definitie                    |
| `endpoints` | `/dev-define`, `/dev-build`                                                               | Bij API definitie / na build            |
| `features`  | `/dev-define`, `/dev-build`, `/dev-test`, `/dev-refactor`, `/game-define`, `/game-build`  | Bij status wijziging (DEF/BLT/TST/DONE) |
| `thinking`  | `/thinking-idea`, `/thinking-brainstorm`, `/thinking-critique`, `/thinking-decide`        | Na elke thinking sessie (append)        |

### Skill → project.json sync overzicht

| Skill            | Wat schrijven                                                                 | Wanneer              |
| ---------------- | ----------------------------------------------------------------------------- | -------------------- |
| `/core-setup`    | `stack` (volledig: framework, language, styling, db, auth, hosting, packages) | Na project generatie |
| `/dev-define`    | `data.entities`, `endpoints`, `stack.packages`, `features` (status DEF)       | FASE 6               |
| `/dev-build`     | `endpoints` (status done), `stack.packages`, `features` (status BLT)          | FASE 4 step 3b       |
| `/dev-test`      | `stack.packages`, `endpoints`, `data.entities`, `features` (status TST)       | FASE 6 completion    |
| `/dev-refactor`  | `stack.packages`, `endpoints`, `data.entities`, `features` (status DONE)      | FASE 5 completion    |
| `/frontend-page` | `stack.packages`                                                              | Na FASE 4            |
| `/game-define`   | `data.entities`, `stack.packages`, `features` (status DEF)                    | FASE 6               |
| `/game-build`    | `features` (status BLT)                                                       | FASE 5 completion    |

## Server

De server draait op `http://localhost:9876` en serveert zowel backlogs als dashboards:

- `http://localhost:9876/` — overzicht alle projecten
- `http://localhost:9876/{project}` — project dashboard (hoofdpagina)
- `http://localhost:9876/{project}/backlog` — backlog kanban
- `http://localhost:9876/{project}/feature/{name}` — feature detail (define + build + test JSON)

Start de server:

```bash
curl -s http://localhost:9876/ > /dev/null 2>&1 || nohup node {skills_path}/shared/references/serve-backlog.js > /tmp/backlog-server.log 2>&1 &
```
