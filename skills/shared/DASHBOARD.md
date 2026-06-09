# Dashboard: project.json Format

The project dashboard is an interactive UI that displays and edits project metadata. All skills that read or write the dashboard use the same approach.

**File:** `.project/project.json`
**Template:** `{skills_path}/shared/references/dashboard-template.html`
**Server:** `{skills_path}/shared/references/serve-backlog.js` (port 9876)

**API endpoint `/{project}/feature/{name}`:** merges three sources — `feature.json` (if present), backlog-feature object (type/status/audit.\*), and `design.{pages|components}[name]` (for PAGE/COMPONENT). Path A frontend cards (no feature.json) are fully built from backlog + design spec.

**UI sections (single-scroll):** Concept | Components | Stack | Config (CLAUDE.md)
All sections are visible at once in one scroll — no tabs. Sidebar links are anchor-links that scroll to the relevant section. `stack`, `data`, `endpoints` and `theme` remain separate sections in project.json; the dashboard sections are project-specifically configured via the `visibleTabs` array in the template.

## Reading the dashboard

1. Read `.project/project.json`
2. Parse as JSON
3. Use the relevant section

**Sections:**

| Section             | Description                                            |
| ------------------- | ------------------------------------------------------ |
| `seed`              | Project name + full seed (markdown)                    |
| `architecture`      | Mermaid diagram + description of the architecture      |
| `design`            | Pages, user flows, design principles                   |
| `theme`             | Colors, fonts, spacing, CSS vars                       |
| `stack`             | Framework, language, DB, hosting, packages             |
| `data`              | Entities, fields, relations                            |
| `endpoints`         | Method, path, auth, status, description                |
| `features`          | Name, status, summary, depends, created                |
| `context`           | Project structure, routing, patterns (runtime context) |
| `optimization_runs` | Append-only log of dev-optimize / game-optimize runs   |

## Writing the dashboard

1. Read `.project/project.json` (or create new if it doesn't exist)
2. Parse JSON
3. Mutate the relevant section (do NOT overwrite other sections)
4. Write back as `JSON.stringify(data, null, 2)`

**Create new file** if `.project/project.json` does not exist:

```json
{
  "seed": {
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
    "principles": [],
    "components": []
  },
  "theme": {
    "colors": [],
    "fonts": { "headings": "", "body": "", "mono": "" },
    "spacing": "",
    "motion": {
      "durations": [],
      "easings": [],
      "pack": "",
      "axes": {
        "expressiveness": "",
        "springiness": "",
        "tempo": "normal",
        "surfaces": "flat"
      },
      "spring": [],
      "choreography": {}
    },
    "interactions": { "focusRing": {}, "hover": {}, "active": {} },
    "surfaces": {
      "glass": {
        "enabled": false,
        "blur": "20px",
        "saturation": "180%",
        "tint": "",
        "border": "",
        "vibrancy": false,
        "fallback": "solid"
      },
      "elevation": []
    },
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
  "context": {
    "structure": "",
    "routing": [],
    "patterns": [],
    "updated": ""
  },
  "optimization_runs": [],
  "testSmellBaseline": {
    "avgMockRatio": 0,
    "p90MockRatio": 0,
    "sampleCount": 0,
    "lastUpdated": ""
  },
  "team": {
    "mode": "solo",
    "commitConvention": "conventional|ticket-prefix|bracket|freeform",
    "ticketPrefix": null,
    "tracker": "github|jira|linear|null",
    "githubProject": {
      "owner": "",
      "repo": "",
      "projectNumber": null,
      "defaultAssignee": null
    }
  }
}
```

## Merge strategy per section

| Section             | Strategy            | Notes                                                                            |
| ------------------- | ------------------- | -------------------------------------------------------------------------------- |
| `seed`              | **OVERWRITE**       | `name`+`pitch`+`content` overwritten, `thinking` is APPEND                       |
| `architecture`      | **OVERWRITE**       | Diagram + description fully overwritten                                          |
| `design`            | **MERGE on `name`** | Pages/flows/principles/components/canvases merged on name, never auto-delete     |
| `theme`             | **OVERWRITE**       | All fields owned and written by `/frontend-tokens` (tokens + motion pack routes) |
| `stack`             | **MERGE**           | Add packages, do not overwrite existing ones                                     |
| `data`              | **MERGE**           | Add entities/fields/relations per entity                                         |
| `endpoints`         | **MERGE**           | Add or update status, do not delete                                              |
| `features`          | **MERGE on `name`** | Update status, add new ones, do not delete                                       |
| `context`           | **MERGE per key**   | Update structure/routing/patterns individually                                   |
| `optimization_runs` | **APPEND**          | Append-only log, dedup on `run_id`. Never delete.                                |

### Stack merge

```
1. Read project.json
2. For each new package:
   - Check if package.name already exists in stack.packages
   - If not: push to stack.packages
   - If yes: update version if newer version is newer
3. Overwrite top-level stack fields (framework, language, etc.) only if they are empty OR during initial population
4. Write project.json
```

### Data merge

```
1. Read project.json
2. For each entity:
   - Check if entity.name already exists in data.entities
   - If not: push entire entity
   - If yes: merge fields (add new ones, do not overwrite existing) and relations
3. Write project.json
```

### Endpoints merge

```
1. Read project.json
2. For each endpoint:
   - Check if method+path combination already exists
   - If not: push new endpoint
   - If yes: update status (e.g. "planned" -> "done"), keep the rest
3. Write project.json
```

### Design merge

```
1. Read project.json
2. For each page:
   - Check if page.name already exists in design.pages
   - If not: push new page
   - If yes: update purpose, status, sections, flows, notes
3. Same for flows (merge on name, update steps/notes)
   Flow object shape: `{ "name": string, "steps": [page-name, ...], "notes": string }`
   Steps are page-names from `design.pages[].name` — orphan steps are allowed but generate a warning.
4. Same for principles (merge on name, update description)
5. Same for components (merge on name, update purpose/status/scope/appliesTo/variants/sizes/states/props/slots/notes)
   Component object shape: see `design` schema below.
   `usedIn[]` is auto-maintained by Build/convert post-pass — do not overwrite manually.
6. Never auto-delete — only via explicit delete action
7. Write project.json
```

### design schema

`design.components[]` object shape:

```json
{
  "name": "Button",
  "purpose": "Primary action trigger with icon support",
  "status": "DEF",
  "scope": "atomic",
  "appliesTo": "all",
  "variants": ["primary", "ghost", "destructive"],
  "sizes": ["sm", "md", "lg"],
  "states": ["default", "hover", "disabled", "loading"],
  "props": ["label", "icon?", "onClick", "disabled?"],
  "slots": [],
  "usedIn": [],
  "gaps": [],
  "notes": ""
}
```

**Status:** `IDEA` | `DEF` | `BLT` | `DONE`

**scope:**

| Value     | Meaning                                                     | Example                 |
| --------- | ----------------------------------------------------------- | ----------------------- |
| `atomic`  | Small reusable element                                      | Button, Input, Avatar   |
| `section` | Composite within a single page                              | StatCard, ProductCard   |
| `layout`  | Multi-page wrapper, lives in `app/layout.tsx` or equivalent | NavBar, Footer, Sidebar |

**appliesTo:**

- `"all"` — applies to all pages (default for `layout`)
- `["dashboard", "settings"]` — specific pages only
- `"route-group:authenticated"` — for Next.js route-groups

**usedIn:** auto-maintained by Build/convert post-pass — list of pages that import this component. Never overwrite manually.

**gaps:** auto-maintained by `frontend-design` Capture/Build/Convert — list of handler-props without a linked FEATURE. Schema per item: `{ prop, context, status: "pending"|"linked"|"created"|"skipped", featureRef?, at }`. Read-only for user; update via gap-discovery flow.

### Features merge

```
1. Read project.json
2. For each feature:
   - Check if feature.name already exists in features array
   - If not: push new feature
   - If yes: update status/stage (e.g. "DOING" stage "defined" -> "built"), update summary if changed
3. Write project.json
```

### Context merge

```
1. Read project.json
2. For each field in context:
   - structure: OVERWRITE (full file tree)
   - routing: OVERWRITE (full routing array)
   - patterns: MERGE (add new ones, update existing on key)
   - updated: set to current date
3. Write project.json
```

Skills write to `context` after each build/refactor. CLAUDE.md refers to `project.json` for this runtime context.

## Section schemas

### seed

```json
{
  "name": "Project Name",
  "pitch": "Short summary of the seed in 1-2 sentences.",
  "seedFile": "project-seed.md",
  "content": ""
}
```

`name` = short project name (for dashboard header)
`pitch` = 1-2 sentence summary of the seed (for lightweight context loading by dev skills). Must always be filled — not dependent on fallback to `content`.
`seedFile` = reference to `.project/project-seed.md` (preferred format for new projects). Legacy alias: `conceptFile` (deprecated).
`content` = legacy inline seed content. For new projects empty — full content lives in `project-seed.md`.

The seed is a **living document**. Thinking-skills (`/project-seed`, `/project-brainstorm`, `/project-critique`, `/project-research`) integrate their concept-scope output directly into `project-seed.md` — there is no history log in `project.json`. `/project-backlog` and `/dev-define` only read the current state of `project-seed.md` as seed context.

### Single source of truth

**NEVER populate both** `content` and `project-seed.md` at the same time. Rules for writes:

1. **New project** (preferred): create `.project/project-seed.md`, set `seed.seedFile = "project-seed.md"`, keep `seed.content = ""`.
2. **Legacy project** (existing inline `content`): leave as-is or migrate once (move `content` → `.md`, set `content = ""`).
3. **On concept write**: first check if `project-seed.md` exists. If yes → write to .md, set `content = ""`. If not + legacy content → keep writing inline.

### project-seed.md

Full concept document as plain markdown (not JSON-escaped).

**Read:** `Read .project/project-seed.md`
**Write:** Write markdown directly. Also update `seed.name` and `seed.pitch` in project.json (so lightweight readers have current metadata).

Dashboard server's `populateFromProject()` handles both formats — existing legacy projects continue to work.

## project-context.json

New file `.project/project-context.json` contains runtime context read only by build/test/refactor skills. Schema:

```json
{
  "architecture": {},
  "context": {},
  "learnings": []
}
```

The dashboard server's `populateFromProject()` merges this file into the unified response. Backward compatible: if fields still exist in project.json (legacy), those are used.

### architecture

```json
{
  "dataFlow": "Request → API Gateway → Auth check → Service → Database",
  "layers": [
    { "name": "API Layer", "order": 1 },
    { "name": "Services", "order": 2 },
    { "name": "Data Layer", "order": 3 }
  ],
  "components": [
    {
      "name": "API Gateway",
      "layer": "API Layer",
      "description": "Routing and rate limiting for all endpoints",
      "status": "done",
      "src": ["src/gateway.js", "src/middleware/rateLimit.js"],
      "test": ["test/gateway.test.js"],
      "connects_to": [
        { "to": "Auth Service", "type": "calls" },
        { "to": "App Service", "type": "calls" }
      ],
      "endpoints": ["/api/auth/*", "/api/users/*"],
      "entities": ["User"]
    },
    {
      "name": "Auth Service",
      "layer": "Services",
      "description": "JWT authentication and session management",
      "status": "planned",
      "connects_to": [{ "to": "PostgreSQL", "type": "writes" }]
    },
    {
      "name": "PostgreSQL",
      "layer": "Data Layer",
      "status": "external"
    }
  ]
}
```

#### Component-first model

The component is the atomic unit. All data per component lives in one object — no fuzzy matching needed.

**Component fields:**

| Field         | Type     | Required | Description                                    |
| ------------- | -------- | -------- | ---------------------------------------------- |
| `name`        | string   | yes      | Unique functional name                         |
| `layer`       | string   | yes      | Layer name (must match `layers[].name`)        |
| `description` | string   | no       | Short functional description (max 200 chars)   |
| `status`      | string   | yes      | `done` \| `planned` \| `external`              |
| `src`         | string[] | no       | Source files (relative to project root)        |
| `test`        | string[] | no       | Test files                                     |
| `connects_to` | edge[]   | no       | Typed edges to other components (see below)    |
| `endpoints`   | string[] | no       | Endpoint paths belonging to this component     |
| `entities`    | string[] | no       | Entity names this component uses               |
| `feature`     | string   | no       | Feature name that created/built this component |

**Edge fields (`connects_to[]`):**

| Field  | Type   | Required | Description                  |
| ------ | ------ | -------- | ---------------------------- |
| `to`   | string | yes      | Name of the target component |
| `type` | string | yes      | Edge type: see values below  |

**Edge type values:**

- `calls` — RPC/HTTP/function-call (mockable in tests)
- `reads` — reads state/data (read-only dependency)
- `writes` — writes state/data (migration impact on change)
- `depends_on` — library/configuration (no runtime IO)

Choose the type based on the actual interaction. For multiple relations between the same components: multiple edge entries (e.g. both `reads` and `writes` to the same DB).

**Layer fields:**

| Field   | Type   | Description          |
| ------- | ------ | -------------------- |
| `name`  | string | Unique layer name    |
| `order` | number | Sort order (1 = top) |

**`dataFlow`** = one-line summary of the full request flow (for quick context).

**Status values:** `done` = built and working, `planned` = not yet built, `external` = external service/database (not managed by us).

#### Advantages over the old model

- **Explicit connections**: `connects_to` array instead of parsing from Mermaid `-->` arrows
- **Explicit endpoints/entities**: directly per component, not fuzzy-matched afterwards
- **No duplicate data**: description, files, status all in one object
- **Layer as first-class concept**: sorting and grouping based on `order`, not subgraph parsing

#### Diagram (optional)

The Mermaid diagram is now **optional** — the Code Cards are the primary view. If a diagram is available, the UI shows a "Diagram" toggle button.

**Preferred**: `.project/architecture.mmd` file (plain Mermaid, no JSON-escaping).
**Legacy**: Inline `diagram` string in project-context.json.

Skills may still generate the diagram for visual context, but it is no longer the source of truth for connections or status. Those come from `components[]`.

#### Diagram conventions (when diagram is generated)

**classDef:**

```
classDef done fill:#13261c,stroke:#3fb950,stroke-width:1.5px,color:#c9d1d9
classDef planned fill:#1b1530,stroke:#8b5cf6,stroke-dasharray:5 5,color:#8b949e
classDef external fill:#1c2128,stroke:#30363d,color:#8b949e
```

**Node labels:** `GW[API Gateway<br/>gateway.js]:::done`
**Subgraphs:** Group per `layer.name`.

#### Skills that write architecture

| Skill         | What it writes                                                                                 | When                      |
| ------------- | ---------------------------------------------------------------------------------------------- | ------------------------- |
| `/dev-define` | Initial `layers` + `components` (status planned, no src/test) + `dataFlow`                     | During feature definition |
| `/dev-build`  | Update `components`: status → done, fill `src`, `test`, `connects_to`, `endpoints`, `entities` | After build               |
| `/dev-verify` | Update `components`: confirm status done, add test files                                       | After test                |
| `/core-pull`  | Sync full `architecture` section on pull                                                       | On context sync           |

**Write strategy:**

1. Read `project-context.json`
2. For each component: check if `name` already exists in `components[]`
   - If not: push new component
   - If yes: merge fields (overwrite `status`, `src`, `test`; merge `endpoints`, `entities` with dedup; merge `connects_to[]` with dedup on `to+type` combination)
3. Write back

### theme

**Design system source of truth.** `theme` contains all design tokens (colors, typography, spacing, borderRadius, shadows, modes, motion, interactions, cssVars) plus animation packs, spring physics, choreography, and surface effects. The dashboard UI renders this as the "Design System" section.

**Skill ownership:**

- Base tokens (colors, typography, spacing, shadows, motion.durations, motion.easings, interactions): managed by `/frontend-tokens`
- Animation packs + springs + choreography + surfaces: managed by `/frontend-tokens` (Motion Pack route)

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
  "motion": {
    "durations": [
      {
        "token": "duration-fast",
        "value": "200ms",
        "usage": "Tooltip, hover state"
      }
    ],
    "easings": [
      {
        "token": "ease-out",
        "value": "cubic-bezier(0.25, 1, 0.5, 1)",
        "usage": "Elements entering"
      }
    ],
    "pack": "standard",
    "axes": {
      "expressiveness": "standard",
      "springiness": "smooth",
      "tempo": "normal",
      "surfaces": "flat"
    },
    "spring": [
      {
        "token": "spring-snappy",
        "stiffness": 300,
        "damping": 25,
        "mass": 1,
        "cssApprox": "cubic-bezier(0.4, 1.15, 0.7, 1.05)",
        "cssDuration": "420ms",
        "usage": "Press, tap feedback"
      }
    ],
    "choreography": {
      "entrance": "entrance.float-in",
      "exit": "exit.fade-out",
      "success": null
    }
  },
  "interactions": {
    "focusRing": {
      "width": "2px",
      "color": "var(--color-accent-primary)",
      "offset": "2px"
    },
    "hover": {
      "transition": "var(--duration-fast) var(--ease-out)",
      "transform": "translateY(-1px)"
    },
    "active": { "transform": "scale(0.98)" }
  },
  "surfaces": {
    "glass": {
      "enabled": false,
      "blur": "20px",
      "saturation": "180%",
      "tint": "color-mix(in oklch, var(--color-surface) 70%, transparent)",
      "border": "1px solid color-mix(in oklch, var(--color-foreground) 8%, transparent)",
      "vibrancy": false,
      "fallback": "solid"
    },
    "elevation": [
      {
        "token": "elevation-1",
        "shadow": "shadow-sm",
        "tint": "none",
        "usage": "Resting cards"
      },
      {
        "token": "elevation-2",
        "shadow": "shadow-md",
        "tint": "surface-raised",
        "usage": "Hover, dropdowns"
      },
      {
        "token": "elevation-3",
        "shadow": "shadow-lg",
        "tint": "surface-overlay",
        "usage": "Modals, popovers"
      },
      {
        "token": "elevation-4",
        "shadow": "shadow-xl",
        "tint": "surface-floating",
        "usage": "Toasts, command-K"
      }
    ]
  },
  "modes": {
    "light": ":root { --background: #fff; --foreground: #1a1a2e; }",
    "dark": ".dark { --background: #1a1a2e; --foreground: #fff; }"
  },
  "cssVars": ":root { --color-dark: #1a1a2e; --color-light: #fff; --font-heading: Inter, sans-serif; }",
  "setupContext": [
    {
      "source": "vercel-labs/web-interface-guidelines",
      "url": "https://raw.githubusercontent.com/vercel-labs/web-interface-guidelines/main/command.md",
      "fetchedAt": "2026-05-25T14:00:00Z",
      "appliedBy": "frontend-tokens@3.7.1"
    }
  ]
}
```

`cssVars` = complete CSS variables export (for consumption by other skills)
`modes` = light/dark mode CSS (object with mode name as key)
`motion.pack` + `motion.axes` + `motion.spring[]` + `motion.choreography{}` + `surfaces{}` = managed by `/frontend-tokens` (Motion Pack route)
`setupContext[]` = append-only log of external sources used during setup (written by `/frontend-tokens` Create and `/frontend-design` Convert); each entry: `{source, url, fetchedAt, appliedBy}`; keyed on `appliedBy` — re-run replaces, does not duplicate
Other fields = structured tokens per category

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

**Optional — only for data-heavy projects.** In practice, simple projects (static sites, utilities, games, UI-only components) leave this empty. Skills that write (`/dev-define`, `/dev-verify`, `/dev-refactor`, `/game-define`, `/team-verify`) skip this update if the domain introduces no explicit entities — log `Skipped data.entities: no entities`.

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
    "auth": "public",
    "status": "done",
    "description": "JWT login with email/password"
  }
]
```

**Status values:** `planned` | `building` | `done`

**Auth values:** `"public"` | `"user"` | `"admin"` (enum). Backwards-compat: `false` → `"public"`, `true` → `"user"`. The dashboard renders protected routes/endpoints with a 🔒 icon and role-badge.

### localUrl

Top-level string in `project.json` for the local dev URL (default `"http://localhost:3000"`). Routes in `architecture.routes[]` are rendered as clickable links that open on `${localUrl}${path}` in a new tab. Manual override per project.

### team

Contains team-repo awareness fields. The `mode` field is the explicit toggle; all other fields are optional. Absent `team` block OR absent `mode` = `"solo"` (backwards compatible).

| Field              | Values                                                               | Set by                                                                           | Read by                                                                                                                  |
| ------------------ | -------------------------------------------------------------------- | -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `mode`             | `"solo"` \| `"team"` (default `"solo"`)                              | `/core-setup` (greenfield asks, mature auto-detects), backlog/dashboard ⚙ toggle | `team-outsource` / `team-review` / `team-verify` (warn-gate), PR offer in refactor/verify, backlog action-btn visibility |
| `commitConvention` | `"conventional"` \| `"ticket-prefix"` \| `"bracket"` \| `"freeform"` | `/core-commit` PHASE 0.5                                                         | `/core-commit` PHASE 4 (compose)                                                                                         |
| `ticketPrefix`     | string \| `null` (e.g. `"JIRA"`, `"PROJ"`)                           | `/core-commit` PHASE 0.5                                                         | `/core-commit` PHASE 4 (compose)                                                                                         |
| `tracker`          | `"github"` \| `"jira"` \| `"linear"` \| `null`                       | `/team-issues` (first run)                                                       | `/team-issues` afterwards, backlog action-btn                                                                            |

**Backwards compatibility:** absent or unrecognized `mode` value → treat as `"solo"`. Do not error.

### architecture.routes (project-context.json)

```json
[
  {
    "path": "/dashboard",
    "purpose": "Home — overview cards and recent activity",
    "auth": "user",
    "feature": "dashboard-layout"
  }
]
```

| Field     | Type   | Required | Description                                              |
| --------- | ------ | -------- | -------------------------------------------------------- |
| `path`    | string | yes      | Route path (e.g. `/dashboard`)                           |
| `purpose` | string | no       | Short description of the page                            |
| `auth`    | enum   | no       | `"public"` \| `"user"` \| `"admin"` (default `"public"`) |
| `feature` | string | no       | Feature that introduced the route (kebab-case)           |

Written by `/dev-define` (initial) and `/dev-build` (confirmed after implementation). Merge on `path` — update existing record instead of duplicating.

### features

```json
[
  {
    "name": "pin-mode",
    "type": "FEATURE",
    "status": "DONE",
    "summary": "Shift+Click multi-select for inspect overlay",
    "depends": ["clipboard-redesign"],
    "created": "2026-02-20",
    "refactor": "REFACTORED",
    "shipped": true,
    "shippedAt": "2026-02-24",
    "shippedSha": "a1b2c3d4e5f6..."
  }
]
```

**Status values:** `TODO` | `DEFINED` | `DOING` | `DONE`
**Stage values (DOING only):** `defining` | `defined` | `building` | `built` | `testing`
**`shipped`**: only `true` after `/dev-refactor` (CLEAN or REFACTORED). Dashboard only shows `features[]` with `shipped: true`.

### recentChanges

Small shipped items (type CHANGE/BUG/PAGE/COMPONENT/etc) that did not go through the full feature pipeline. Promoted via `/dev-refactor --small-items` after a lightweight convention check.

```json
[
  {
    "name": "fix-button-spacing",
    "type": "CHANGE",
    "description": "Button padding inconsistent on mobile",
    "shipped": true,
    "shippedAt": "2026-02-25"
  }
]
```

Dashboard shows `recentChanges[]` as a compact strip below the features grid.

### optimization_runs

Append-only log of `/dev-optimize` and `/game-optimize` runs. One entry per completed run. Serves as history for the dashboard — not for live state (that lives in `.project/optimize/{run-id}/`).

```json
[
  {
    "run_id": "20260426-153022",
    "skill": "dev-optimize",
    "metric": "bundle_size_kb",
    "direction": "minimize",
    "baseline": 420.5,
    "final": 312.1,
    "improvement_pct": 25.8,
    "rounds": 4,
    "experiments_kept": 6,
    "experiments_discarded": 14,
    "winner_branch": "optimize/20260426-153022/winner",
    "stopped_reason": "stall",
    "date": "2026-04-26T15:30:22Z"
  }
]
```

**Field values:**

| Field                   | Type     | Description                                                                                                                                        |
| ----------------------- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `run_id`                | string   | Timestamp ID `YYYYMMDD-HHMMSS` (unique per run)                                                                                                    |
| `skill`                 | string   | `dev-optimize` or `game-optimize`                                                                                                                  |
| `metric`                | string   | `bundle_size_kb`, `lighthouse`, `coverage`, `latency_p95_ms`, `fps`, `frame_time_ms`, `memory_mb`, `ai_winrate_pct`, `pathfinding_ms`, or `custom` |
| `direction`             | string   | `minimize` or `maximize`                                                                                                                           |
| `baseline`              | number   | Score before the optimize run                                                                                                                      |
| `final`                 | number   | Best achieved score                                                                                                                                |
| `improvement_pct`       | number   | Percentage improvement vs baseline (positive = better)                                                                                             |
| `rounds`                | int      | Number of completed rounds                                                                                                                         |
| `experiments_kept`      | int      | Number of subagent branches that produced improvement                                                                                              |
| `experiments_discarded` | int      | Number of subagent branches that were discarded                                                                                                    |
| `winner_branch`         | string   | Full branch name of the winning experiments                                                                                                        |
| `stopped_reason`        | string   | `stall`, `wallclock`, `user`, `no_improvement`                                                                                                     |
| `date`                  | ISO date | Completion date                                                                                                                                    |

**Append strategy:**

```
1. Read project.json
2. Initialize optimization_runs = [] if field does not exist
3. Check if run_id already exists — if yes: skip (idempotent)
4. Push new entry to end of array
5. Write project.json
```

No deletion, no update — append only. For live status of a running run: see `.project/optimize/{run-id}/spec.json` + `tree.json`.

### thinking-output

Thinking-skills (`/project-research`, `/project-brainstorm`, `/project-critique`) write their full output to `.project/thinking/*.md` (filename: `{date}-{type}-{slug}.md`). Those markdown files are the only source of truth — there is no top-level `thinking[]` array in `project.json`.

Seed-scope thinking-output (`/project-seed`, `/project-brainstorm` concept, `/project-critique` concept, `/project-research` concept) integrates directly into `project-seed.md` — no history log in `project.json`.

Skills that consume thinking-output (such as `/dev-define`) read directly via Grep on `.project/thinking/*.md` for name matching.

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
    "Code maturity: student — respect lesson-material patterns, no over-abstractions, duplication <10 lines ok"
  ],
  "updated": "2026-02-20"
}
```

`structure` = file tree (same format as previously in CLAUDE.md `## Project structure`). Key directories with inline comments.
`routing` = route patterns with arrow notation. Only for web projects with routing.
`patterns` = non-obvious patterns, gotchas, env setup. One string per item, `key: detail` format. Quality rules: project-specific only, concise, each item must earn its place.
`updated` = date of last context update.

### learnings

```json
[
  {
    "date": "2026-03-12",
    "feature": "auth-login",
    "type": "pattern",
    "source": "extracted",
    "summary": "JWT refresh via httpOnly cookie rotation instead of DB-stored tokens"
  },
  {
    "date": "2026-04-28",
    "feature": "payments",
    "type": "pattern",
    "source": "synced",
    "author": "Alice",
    "summary": "Stripe webhooks via idempotency keys per request"
  }
]
```

`type` values: `pattern` (architectural choice), `pitfall` (bug/gotcha), `observation` (cross-feature insight).
`source` values: `extracted` (direct observation from code output or test result) | `inferred` (cross-feature pattern recognition or LLM inference) | `synced` (extracted from teammate code or mature codebase via core-pull / core-setup --mode=mature).
`date` = extraction date. `feature` = source feature (kebab-case). For `synced` learnings without a structured feature: use primary directory (`auth`, `payments`). `summary` = max 200 chars.
`author` = optional, only for `source === "synced"`. Mirrors `features[].author`.

**Source mapping** (own work, in dev-verify / game-verify / dev-refactor / game-refactor):

| Source in feature.json                        | learning.type | learning.source |
| --------------------------------------------- | ------------- | --------------- |
| `build.decisions[]`                           | `pattern`     | `extracted`     |
| `tests.fixSync[]`                             | `pitfall`     | `extracted`     |
| `observations[]`                              | `observation` | `inferred`      |
| `refactor.decisions[]` (APPLY, cross-cutting) | `pitfall`     | `inferred`      |
| `refactor.decisions[]` (APPLY, overig)        | `pattern`     | `extracted`     |
| `refactor.decisions[]` (SKIP, cross-feature)  | `pattern`     | `inferred`      |
| `refactor.positiveObservations[]`             | `observation` | `inferred`      |

**Source mapping** (teammate / mature codebase, in core-pull / core-setup --mode=mature):

| Source                                           | learning.type              | learning.source |
| ------------------------------------------------ | -------------------------- | --------------- |
| Fix-commits with body (≥10 words + cause-clue)   | `pitfall`                  | `synced`        |
| TODO/FIXME/HACK comments (≥10 words)             | `pitfall`                  | `synced`        |
| New abstraction-dirs (repository/middleware)     | `pattern`                  | `synced`        |
| New wrapper-deps in package.json                 | `pattern`                  | `synced`        |
| LLM-inferred patterns (signal-triggered/onboard) | `pattern` or `observation` | `synced`        |

See [skills/shared/LEARNING-EXTRACTION.md](skills/shared/LEARNING-EXTRACTION.md) for heuristics and filters.

Append-only log. Skills that complete features extract learnings automatically (see dev-verify PHASE 6, dev-refactor PHASE 5). `core-pull` (incremental) and `core-setup --mode=mature` (one-time) extract learnings from teammate/legacy code. `source` is required on new writes.

**This replaces the dynamic CLAUDE.md sections** (`## Project structure`, `## Routing`, `## Non-obvious patterns`). CLAUDE.md now only contains a reference to `project.json` for this context.

## Which skills write what

### project.json sections

| Section             | Written by                                                                                | When                                     |
| ------------------- | ----------------------------------------------------------------------------------------- | ---------------------------------------- |
| `seed`              | `/project-seed`, `/project-brainstorm`, `/project-critique`, `/project-backlog`           | On seed creation/iteration/plan          |
| `design`            | `/frontend-design`, `/frontend-tokens`, `/frontend-sketch`                                | On design spec/page build/theme creation |
| `design.canvases`   | `/frontend-sketch`                                                                        | On new canvas / generate / promote       |
| `theme`             | `/frontend-tokens`                                                                        | After theme create/update                |
| `stack`             | `/core-setup`, `/project-backlog`, `/dev-define`, `/dev-build`, `/frontend-design`        | On detection/new deps                    |
| `data`              | `/dev-define`, `/game-define`                                                             | On entity definition                     |
| `endpoints`         | `/dev-define`, `/dev-build`                                                               | On API definition / after build          |
| `features`          | `/dev-define`, `/dev-build`, `/dev-verify`, `/team-verify`, `/game-define`, `/game-build` | On status change (DOING/DONE)            |
| `optimization_runs` | `/dev-optimize`, `/game-optimize`                                                         | On run completion (PHASE 6)              |

### project-context.json sections

| Section        | Written by                                                                                | When                                                                     |
| -------------- | ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| `architecture` | `/dev-define`, `/dev-build`, `/game-define`, `/game-build`                                | On architecture definition / after build                                 |
| `context`      | `/core-setup`, `/dev-build`, `/dev-refactor`, `/game-build`, `/game-refactor`             | On build/refactor (structure, routing, patterns)                         |
| `learnings`    | `/dev-verify`, `/dev-refactor`, `/game-verify`, `/core-pull`, `/core-setup --mode=mature` | Feature completion (extracted/inferred) or teammate/legacy code (synced) |

### Skill sync overview

| Skill                       | project.json                                                        | project-context.json                                              | When                     |
| --------------------------- | ------------------------------------------------------------------- | ----------------------------------------------------------------- | ------------------------ |
| `/core-setup`               | `stack` (full)                                                      | `context` (initial)                                               | After project generation |
| `/dev-define`               | `data.entities`, `endpoints`, `stack.packages`, `features` (DOING)  | `architecture` (write), `learnings` (read)                        | PHASE 6                  |
| `/dev-build`                | `endpoints`, `stack.packages`, `features` (DOING+built)             | `context`, `architecture` (write)                                 | PHASE 4C                 |
| `/dev-verify`               | `stack.packages`, `endpoints`, `data.entities`, `features` (DONE)   | `architecture`, `learnings` (write)                               | PHASE 6 completion       |
| `/dev-refactor`             | `stack.packages`, `endpoints`, `data.entities`                      | `context`, `architecture`, `learnings` (write)                    | PHASE 5 completion       |
| `/frontend-design`          | `design` (pages, flows, principles), `features` (batch TODO)        | —                                                                 | On each run              |
| `/frontend-design`          | `stack.packages`, `design.pages`, `features` (DOING+built)          | —                                                                 | After PHASE 4            |
| `/frontend-tokens`          | `design.principles`                                                 | —                                                                 | After completion         |
| `/frontend-sketch`          | `design.canvases`                                                   | —                                                                 | new / generate / promote |
| `/game-define`              | `data.entities`, `stack.packages`, `features` (DOING)               | `architecture` (write)                                            | PHASE 6                  |
| `/game-build`               | `features` (DOING+built)                                            | `context`, `architecture` (write)                                 | PHASE 5 completion       |
| `/team-verify`              | `features`, `stack.packages`, `endpoints`, `data.entities`          | `architecture` (write)                                            | PHASE 7 completion       |
| `/game-refactor`            | `features` (DONE)                                                   | `context`, `architecture` (write)                                 | PHASE 5 completion       |
| `/dev-optimize`             | `optimization_runs` (append)                                        | —                                                                 | PHASE 6 completion       |
| `/game-optimize`            | `optimization_runs` (append)                                        | —                                                                 | PHASE 6 completion       |
| `/core-pull`                | `features` (synced), `endpoints`, `data.entities`, `stack.packages` | `context`, `architecture`, `learnings` (synced, signal-triggered) | Per pull                 |
| `/core-setup --mode=mature` | `features` (synced), `endpoints`, `data.entities`, `stack.packages` | `context`, `architecture`, `learnings` (synced, full LLM scan)    | One-time on join         |

## Server

The server runs on `http://localhost:9876` and serves both backlogs and dashboards:

- `http://localhost:9876/` — overview of all projects
- `http://localhost:9876/{project}` — project dashboard (main page)
- `http://localhost:9876/{project}/backlog` — backlog (single-scroll list view)
- `http://localhost:9876/{project}/feature/{name}` — feature detail (unified feature.json)

The feature detail endpoint reads `feature.json` (see `shared/FEATURE.md` for schema).

Start the server:

```bash
# Respects $CLAUDE_PROJECTS_ROOT via lib/config.js (fallback: ~/projects)
curl -s http://localhost:9876/ > /dev/null 2>&1 || nohup node --watch {skills_path}/shared/references/serve-backlog.js > /tmp/backlog-server.log 2>&1 &
```

---

## Design Section

The `design` key in `project.json` is managed exclusively by the `frontend-design` skill. Other skills must not mutate it. Schema:

```json
{
  "design": {
    "pages": [
      {
        "name": "dashboard",
        "purpose": "Overview with metrics and status",
        "status": "DEF",
        "sections": ["hero", "metrics-grid", "activity-feed"],
        "flows": ["login → dashboard", "dashboard → settings"],
        "uses": [],
        "notes": "",
        "transitions": {
          "route": null,
          "sectionReveal": null
        }
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
        "description": "Design for mobile viewport first, progressive enhancement",
        "forbid": [
          "no fixed px widths on containers — use max-w-* or %",
          "no layout classes without sm:/md:/lg: responsive counterpart"
        ]
      }
    ],
    "banPacks": ["tokens", "a11y", "motion"],
    "components": [
      {
        "name": "Button",
        "purpose": "Primary action trigger with icon support",
        "status": "DEF",
        "scope": "atomic",
        "appliesTo": "all",
        "variants": ["primary", "ghost", "destructive"],
        "sizes": ["sm", "md", "lg"],
        "states": ["default", "hover", "disabled", "loading"],
        "props": ["label", "icon?", "onClick", "disabled?"],
        "slots": [],
        "usedIn": [],
        "notes": "",
        "motion": {
          "onHover": null,
          "onPress": null,
          "onEnter": "entrance.float-in",
          "onExit": "exit.fade-out",
          "onSuccess": null,
          "onError": null
        }
      }
    ]
  }
}
```

**Status values (pages and components):** `IDEA` | `DEF` | `BLT` | `DONE`

**`pages[].uses[]`** — auto-maintained by Build/convert post-pass. List of component names imported by this page. Do not edit manually.

**`components[].usedIn[]`** — auto-maintained by Build/convert post-pass. List of page names that import this component. Do not edit manually.

**`components[].scope`:**

| Value     | Meaning                                                     | Example                 |
| --------- | ----------------------------------------------------------- | ----------------------- |
| `atomic`  | Small reusable element                                      | Button, Input, Avatar   |
| `section` | Composite within a single page                              | StatCard, ProductCard   |
| `layout`  | Multi-page wrapper, lives in `app/layout.tsx` or equivalent | NavBar, Footer, Sidebar |

**`components[].appliesTo`:** `"all"` | `["page1", "page2"]` | `"route-group:groupname"` (only relevant for `scope: layout`)

**`principles[].forbid?: string[]`** — Machine-binding ban-list injected into Convert PHASE 2 codegen prompt. Each item is a natural-language rule or grep-pattern. During code generation, these patterns must not appear in generated output. Examples: `"no hex literals in src/components/"`, `"no Tailwind color class without dark: counterpart"`, `"no @keyframes without prefers-reduced-motion fallback"`. Merged on name along with other principle fields — never auto-deleted.

**`design.banPacks?: string[]`** — Optional shorthand for activating universal rule packs from `shared/ANTI-SLOP.md`. Values: `"tokens"` | `"a11y"` | `"dark"` | `"responsive"` | `"motion"`. When present, Convert PHASE 2 loads the named pack(s) from `ANTI-SLOP.md` and merges them with `principles[].forbid[]`. Using both is valid — project-specific `forbid` entries extend the universal packs.

**`design.canvases[]`** — Low-fi sketch canvases managed by `/frontend-sketch`. One entry per canvas file in `.project/canvas/<slug>.excalidraw`.

```json
{
  "name": "login-v1",
  "pageRef": "login",
  "frames": [{ "id": "f1", "title": "Variant A — Minimal", "promoted": false }],
  "mtime": "2026-06-05T14:30:00Z"
}
```

| Field     | Type   | Description                                 |
| --------- | ------ | ------------------------------------------- |
| `name`    | string | Canvas slug (kebab-case), matches filename  |
| `pageRef` | string | Optional ref to `design.pages[].name`       |
| `frames`  | array  | Frames added by `/frontend-sketch generate` |
| `mtime`   | string | ISO timestamp of last write                 |

`frames[].promoted` — set to `true` by `/frontend-sketch promote`. Never auto-deleted.

**Merge strategy:** MERGE on `name`. `frames[]` merge on `id`. Never auto-delete. Written exclusively by `/frontend-sketch`.

---

**`features[].lastCheckedSha?: string`** — Set by `frontend-check` after a successful runtime-scan of this feature. Used by batch-mode to skip features where `lastCheckedSha === shippedSha` (no code changes since last check).

**Merge strategy:** `MERGE on name` — pages/flows/principles/components merge on name, update fields, never auto-delete. `components[].motion{}` and `pages[].transitions{}` use key-level merge (never auto-delete keys, only add/update).
