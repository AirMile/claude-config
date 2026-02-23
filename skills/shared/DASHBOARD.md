# Dashboard: project.json Format

Het project dashboard is een interactieve UI die project metadata toont en bewerkt. Alle skills die het dashboard lezen of schrijven gebruiken dezelfde aanpak.

**Bestand:** `.project/project.json`
**Template:** `{skills_path}/shared/references/dashboard-template.html`
**Server:** `{skills_path}/shared/references/serve-backlog.js` (poort 9876)

## Dashboard lezen

1. Read `.project/project.json`
2. Parse als JSON
3. Gebruik de relevante sectie

**Secties:**

| Sectie      | Beschrijving                                           |
| ----------- | ------------------------------------------------------ |
| `concept`   | Project naam + volledige concept (markdown)            |
| `theme`     | Kleuren, fonts, spacing, CSS vars                      |
| `stack`     | Framework, taal, DB, hosting, packages                 |
| `data`      | Entities, velden, relaties                             |
| `endpoints` | Method, path, auth, status, beschrijving               |
| `features`  | Naam, status, summary, depends, created                |
| `thinking`  | Chronologisch log van ideeën en beslissingen           |
| `context`   | Project structuur, routing, patterns (runtime context) |

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

| Sectie      | Strategie           | Toelichting                                          |
| ----------- | ------------------- | ---------------------------------------------------- |
| `concept`   | **OVERWRITE**       | `name`+`content` overschrijven, `thinking` is APPEND |
| `theme`     | **OVERWRITE**       | Volledig overschrijven bij `/frontend-theme`         |
| `stack`     | **MERGE**           | Voeg packages toe, overschrijf geen bestaande        |
| `data`      | **MERGE**           | Voeg entities/velden/relaties toe per entity         |
| `endpoints` | **MERGE**           | Voeg toe of update status, verwijder niet            |
| `features`  | **MERGE op `name`** | Update status, voeg nieuwe toe, verwijder niet       |
| `thinking`  | **APPEND**          | Altijd toevoegen, nooit overschrijven of verwijderen |
| `context`   | **MERGE per key**   | Update structure/routing/patterns individueel        |

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
  "content": "# Project Naam\n\nVolledige concept beschrijving in markdown.\n\n## Core Concept\n\n...\n\n## Doelgroep\n\n...",
  "thinking": [
    {
      "type": "idea",
      "date": "2026-02-20",
      "title": "Initieel idee",
      "content": "Volledige markdown output van /thinking-idea",
      "source": "/thinking-idea"
    }
  ]
}
```

`name` = korte project naam (voor dashboard header)
`content` = volledige concept document in markdown (vervangt legacy `concept.md`)
`thinking` = concept progressie log (append-only) — toont de stappen van idea → brainstorm → critique voor het concept. Zelfde entry-formaat als main `thinking`, maar specifiek voor concept-scope.

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
    "content": "Volledige markdown output van de thinking skill",
    "source": "/thinking-idea"
  },
  {
    "type": "brainstorm",
    "date": "2026-02-20",
    "title": "Auth strategie",
    "content": "Volledige refined markdown output",
    "variants": ["JWT stateless", "Session cookies", "OAuth-only"],
    "chosen": "JWT stateless",
    "source": "/thinking-brainstorm"
  },
  {
    "type": "critique",
    "date": "2026-02-20",
    "title": "Concept review: dashboard MVP",
    "content": "Volledige refined markdown output",
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
    "Sanity preview: Draft mode via /api/preview"
  ],
  "updated": "2026-02-20"
}
```

`structure` = file tree (zelfde formaat als voorheen in CLAUDE.md `## Project structuur`). Key directories met inline comments.
`routing` = route patterns met arrow notation. Alleen voor web projects met routing.
`patterns` = non-obvious patterns, gotchas, env setup. Eén string per item, `key: detail` formaat. Quality rules: project-specific only, concise, elk item moet z'n plek verdienen.
`updated` = datum van laatste context update.

**Dit vervangt de dynamische CLAUDE.md secties** (`## Project structuur`, `## Routing`, `## Non-obvious patterns`). CLAUDE.md bevat nu alleen een referentie naar `project.json` voor deze context.

## Feature files (JSON)

Features worden opgeslagen in `.project/features/{feature-name}/` als JSON bestanden. Dit is de **enige output** van de dev skills — geen aparte markdown bestanden.

### define.json

Geschreven door `/dev-define` in FASE 3.

```json
{
  "name": "pin-mode",
  "created": "2026-02-20",
  "status": "DEF",
  "depends": ["clipboard-redesign"],
  "summary": "Shift+Click multi-select voor inspect overlay",
  "userAnswers": { "coreFunction": "...", "patterns": "..." },
  "stackResearch": "Optioneel. Markdown string met research bevindingen.",
  "requirements": [
    {
      "id": "REQ-001",
      "description": "Shift+Click op element pint het",
      "category": "core",
      "testType": "integration",
      "acceptance": "Element heeft pinned state na Shift+Click"
    }
  ],
  "design": {
    "layout": "ASCII wireframe tekst (alleen visuele features)",
    "components": ["PinBar", "PinOverlay"]
  },
  "architecture": {
    "files": [
      {
        "path": "src/hooks/usePinMode.ts",
        "action": "create",
        "purpose": "State management voor pin mode"
      },
      {
        "path": "src/components/Inspector.tsx",
        "action": "modify",
        "purpose": "Shift+Click handler toevoegen"
      }
    ],
    "interfaces": [
      {
        "name": "PinnedElement",
        "definition": "interface PinnedElement { id: string; selector: string; rect: DOMRect }"
      }
    ]
  },
  "apiContract": [
    {
      "method": "POST",
      "path": "/api/pins",
      "request": "CreatePinRequest",
      "response": "PinResource",
      "auth": "bearer",
      "description": "Pin een element permanent op"
    }
  ],
  "buildSequence": [
    {
      "step": 1,
      "requirements": ["REQ-001"],
      "description": "State hook implementeren",
      "dependsOn": []
    },
    {
      "step": 2,
      "requirements": ["REQ-002"],
      "description": "Shift+Click handler wiring",
      "dependsOn": [1]
    },
    {
      "step": 3,
      "requirements": ["REQ-003", "REQ-004"],
      "description": "PinBar UI (gecombineerd)",
      "dependsOn": [2]
    }
  ],
  "testStrategy": [
    {
      "requirementId": "REQ-001",
      "testFile": "src/hooks/__tests__/usePinMode.test.ts",
      "description": "Valideert dat pin state correct toggled"
    }
  ]
}
```

**Conditionele velden:** `stackResearch` (alleen bij research), `design` (alleen visuele features), `architecture.interfaces` (als relevant), `apiContract` (alleen backend).

**Altijd aanwezig:** `name`, `created`, `status`, `summary`, `requirements`, `architecture.files`, `buildSequence`, `testStrategy`.

### build.json

Geschreven door `/dev-build` in FASE 4C.

```json
{
  "feature": "pin-mode",
  "started": "2026-02-20",
  "completed": "2026-02-20",
  "summary": {
    "techniques": { "tdd": 3, "implementationFirst": 2 },
    "testsPass": 8,
    "testsTotal": 8,
    "filesCreated": 2,
    "filesModified": 1
  },
  "filesChanged": [
    "src/hooks/usePinMode.ts",
    "src/components/PinBar.tsx",
    "src/components/Inspector.tsx"
  ],
  "packagesAdded": [{ "name": "zustand", "version": "^4.4.0" }],
  "decisions": [
    "Used local state instead of context — context would re-render entire tree on every pin"
  ],
  "requirements": [
    {
      "id": "REQ-001",
      "description": "usePinMode hook",
      "technique": "TDD",
      "files": ["src/hooks/usePinMode.ts"],
      "tests": ["src/hooks/__tests__/usePinMode.test.ts"],
      "syncNote": "Hook exposes togglePin(id), pinnedIds array, clearAll. Uses Map internally for O(1) lookup."
    }
  ],
  "integrationTests": {
    "passed": true,
    "notes": "Alle cross-REQ integratie tests geslaagd"
  },
  "blockers": [],
  "codeSyncExplanation": "Markdown string met plain-language uitleg van de feature. Dashboard rendert via md().",
  "testChecklist": [
    {
      "id": 1,
      "title": "Pin element via Shift+Click",
      "requirementId": "REQ-001",
      "steps": [
        "Open de inspector",
        "Shift+Click op element",
        "Controleer PinBar"
      ],
      "expected": "Element verschijnt in PinBar",
      "status": "pending"
    }
  ]
}
```

**`testChecklist[].status`**: `"pending"` (initieel door `/dev-build`), `"pass"` / `"fail"` / `"skip"` (bijgewerkt door `/dev-test`).

### test.json

Geschreven door `/dev-test` in FASE 6.

```json
{
  "feature": "pin-mode",
  "finalStatus": "PASSED",
  "coverage": { "statements": 92, "branches": 85 },
  "sessions": [
    {
      "sessionNumber": 1,
      "date": "2026-02-21",
      "totals": {
        "pass": 4,
        "fail": 2,
        "skip": 0,
        "autoPass": 2,
        "autoFail": 1,
        "manualPass": 2,
        "manualFail": 1
      },
      "items": [
        {
          "id": 1,
          "title": "Pin element via Shift+Click",
          "type": "AUTO",
          "initialStatus": "PASS",
          "finalStatus": "PASS",
          "evidence": "DOM snapshot: PinBar zichtbaar met 1 element",
          "fixApplied": null
        },
        {
          "id": 2,
          "title": "Unpin via Shift+Click",
          "type": "AUTO",
          "initialStatus": "FAIL",
          "finalStatus": "PASS",
          "evidence": "DOM snapshot: PinBar leeg na tweede Shift+Click",
          "fixApplied": "usePinMode toggle logica gecorrigeerd"
        }
      ]
    }
  ],
  "runs": [
    {
      "date": "2026-02-21",
      "passed": 4,
      "failed": 0,
      "fixes": ["usePinMode toggle fix"]
    }
  ],
  "fixSync": "Optioneel. Markdown string met plain-language beschrijving van fixes. Dashboard rendert via md().",
  "observations": [
    "Inspector z-index conflict bij overlapping modals — suggest: /dev-define z-index-system"
  ],
  "testsAdded": ["src/hooks/__tests__/usePinMode.test.ts"],
  "filesModified": [
    {
      "path": "src/hooks/usePinMode.ts",
      "description": "Toggle fix voor reeds gepind element (regel 34)"
    }
  ]
}
```

**`runs[]`**: compact overzicht (backward compat). **`sessions[]`**: volledige detail per test sessie.

### refactor.json

Geschreven door `/dev-refactor` in FASE 5.

**REFACTORED variant:**

```json
{
  "feature": "pin-mode",
  "date": "2026-02-22",
  "status": "REFACTORED",
  "summary": {
    "scope": "ALL",
    "improvementsApplied": 4,
    "filesModified": 2,
    "testsPassing": "8/8"
  },
  "improvements": {
    "security": [],
    "performance": [
      {
        "file": "src/hooks/usePinMode.ts",
        "line": 23,
        "issue": "Array.find() in hot path",
        "fix": "Vervangen door Map",
        "result": "Render tijd -40%",
        "risk": "LOW"
      }
    ],
    "dry": [],
    "simplification": [
      {
        "file": "src/components/PinBar.tsx",
        "line": 45,
        "issue": "Inline conditional 3 niveaus diep",
        "fix": "Extracted naar helper",
        "result": "Leesbaarheid verbeterd",
        "risk": "LOW"
      }
    ],
    "clarity": [],
    "quality": [],
    "errorHandling": []
  },
  "decisions": [
    {
      "decision": "Map ipv Array voor pin state",
      "rationale": "PinBar kan 50+ elementen tonen — O(1) lookup"
    }
  ],
  "positiveObservations": ["Error boundaries correct geïmplementeerd"],
  "filesModified": ["src/hooks/usePinMode.ts", "src/components/PinBar.tsx"],
  "failureAnalysis": null,
  "pendingImprovements": []
}
```

**CLEAN variant:** `status: "CLEAN"`, lege `improvements`, alleen `positiveObservations`.

**ROLLED_BACK variant:** `status: "ROLLED_BACK"`, `failureAnalysis` met markdown string, `pendingImprovements[]` met items die herpoging nodig hebben.

**Status waarden:** `CLEAN` | `REFACTORED` | `ROLLED_BACK`
**Improvement categorieën:** `security` | `performance` | `dry` | `simplification` | `clarity` | `quality` | `errorHandling`
**Risk waarden:** `LOW` | `MED`

## Welke skills schrijven wat

| Sectie             | Geschreven door                                                                           | Wanneer                                           |
| ------------------ | ----------------------------------------------------------------------------------------- | ------------------------------------------------- |
| `concept`          | `/thinking-idea`, `/thinking-brainstorm`, `/thinking-critique`, `/dev-plan`, `/game-plan` | Bij concept creatie/iteratie/plan                 |
| `theme`            | `/frontend-theme`                                                                         | Na THEME.md generatie                             |
| `stack`            | `/core-setup`, `/dev-plan`, `/dev-define`, `/dev-build`, `/frontend-page`                 | Bij detectie/nieuwe deps                          |
| `data`             | `/dev-define`, `/game-define`                                                             | Bij entity definitie                              |
| `endpoints`        | `/dev-define`, `/dev-build`                                                               | Bij API definitie / na build                      |
| `features`         | `/dev-define`, `/dev-build`, `/dev-test`, `/dev-refactor`, `/game-define`, `/game-build`  | Bij status wijziging (DEF/BLT/TST/DONE)           |
| `concept.thinking` | `/thinking-idea`, `/thinking-brainstorm`, `/thinking-critique`                            | Bij concept-scope thinking (append)               |
| `thinking`         | `/thinking-idea`, `/thinking-brainstorm`, `/thinking-critique`, `/thinking-decide`        | Bij non-concept thinking (append)                 |
| `context`          | `/core-setup`, `/dev-build`, `/dev-refactor`, `/game-build`, `/game-refactor`             | Bij build/refactor (structuur, routing, patterns) |

### Skill → project.json sync overzicht

| Skill            | Wat schrijven                                                                                                  | Wanneer              |
| ---------------- | -------------------------------------------------------------------------------------------------------------- | -------------------- |
| `/core-setup`    | `stack` (volledig), `context` (initieel: structure, routing, patterns)                                         | Na project generatie |
| `/dev-define`    | `data.entities`, `endpoints`, `stack.packages`, `features` (status DEF)                                        | FASE 6               |
| `/dev-build`     | `endpoints` (status done), `stack.packages`, `features` (status BLT), `context` (structure, routing, patterns) | FASE 4C              |
| `/dev-test`      | `stack.packages`, `endpoints`, `data.entities`, `features` (status TST)                                        | FASE 6 completion    |
| `/dev-refactor`  | `stack.packages`, `endpoints`, `data.entities`, `features` (status DONE), `context` (conditional)              | FASE 5 completion    |
| `/frontend-page` | `stack.packages`                                                                                               | Na FASE 4            |
| `/game-define`   | `data.entities`, `stack.packages`, `features` (status DEF)                                                     | FASE 6               |
| `/game-build`    | `features` (status BLT), `context` (structure, patterns)                                                       | FASE 5 completion    |
| `/game-refactor` | `features` (status DONE), `context` (conditional)                                                              | FASE 5 completion    |

## Server

De server draait op `http://localhost:9876` en serveert zowel backlogs als dashboards:

- `http://localhost:9876/` — overzicht alle projecten
- `http://localhost:9876/{project}` — project dashboard (hoofdpagina)
- `http://localhost:9876/{project}/backlog` — backlog kanban
- `http://localhost:9876/{project}/feature/{name}` — feature detail (define + build + test + refactor JSON)

Start de server:

```bash
curl -s http://localhost:9876/ > /dev/null 2>&1 || nohup node {skills_path}/shared/references/serve-backlog.js > /tmp/backlog-server.log 2>&1 &
```
