# Dashboard: project-context.json Format

> Part of the dashboard schema docs — see [DASHBOARD.md](DASHBOARD.md) for the section map. This file covers `.project/project-context.json` (runtime context: architecture, context, learnings, thinking-output). The `project.json` schema lives in [DASHBOARD-PROJECT.md](DASHBOARD-PROJECT.md).

## project-context.json

The file `.project/project-context.json` contains runtime context read only by build/test/refactor skills. Schema:

```json
{
  "architecture": {},
  "context": {},
  "learnings": []
}
```

The dashboard server's `populateFromProject()` merges this file into the unified response. Backward compatible: if fields still exist in project.json (legacy), those are used.

## architecture

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

### Component-first model

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

### Advantages over the old model

- **Explicit connections**: `connects_to` array instead of parsing from Mermaid `-->` arrows
- **Explicit endpoints/entities**: directly per component, not fuzzy-matched afterwards
- **No duplicate data**: description, files, status all in one object
- **Layer as first-class concept**: sorting and grouping based on `order`, not subgraph parsing

### Diagram (optional)

The Mermaid diagram is now **optional** — the Code Cards are the primary view. If a diagram is available, the UI shows a "Diagram" toggle button.

**Preferred**: `.project/architecture.mmd` file (plain Mermaid, no JSON-escaping).
**Legacy**: Inline `diagram` string in project-context.json.

Skills may still generate the diagram for visual context, but it is no longer the source of truth for connections or status. Those come from `components[]`.

### Diagram conventions (when diagram is generated)

**classDef:**

```
classDef done fill:#13261c,stroke:#3fb950,stroke-width:1.5px,color:#c9d1d9
classDef planned fill:#1b1530,stroke:#8b5cf6,stroke-dasharray:5 5,color:#8b949e
classDef external fill:#1c2128,stroke:#30363d,color:#8b949e
```

**Node labels:** `GW[API Gateway<br/>gateway.js]:::done`
**Subgraphs:** Group per `layer.name`.

### Skills that write architecture

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

## architecture.routes

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

## context

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

## learnings

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
| `refactor.decisions[]` (APPLY, other)         | `pattern`     | `extracted`     |
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

See [skills/shared/LEARNING-EXTRACTION.md](LEARNING-EXTRACTION.md) for heuristics and filters.

Append-only log. Skills that complete features extract learnings automatically (see dev-verify PHASE 6, dev-refactor PHASE 5). `core-pull` (incremental) and `core-setup --mode=mature` (one-time) extract learnings from teammate/legacy code. `source` is required on new writes.

**This replaces the dynamic CLAUDE.md sections** (`## Project structure`, `## Routing`, `## Non-obvious patterns`). CLAUDE.md now only contains a reference to `project.json` for this context.

## thinking-output

Thinking-skills (`/project-research`, `/project-brainstorm`, `/project-critique`) write their full output to `.project/thinking/*.md` (filename: `{date}-{type}-{slug}.md`). Those markdown files are the only source of truth — there is no top-level `thinking[]` array in `project.json`.

Seed-scope thinking-output (`/project-seed`, `/project-brainstorm` concept, `/project-critique` concept, `/project-research` concept) integrates directly into `project-seed.md` — no history log in `project.json`.

Skills that consume thinking-output (such as `/dev-define`) read directly via Grep on `.project/thinking/*.md` for name matching.

## Which skills write what

### project-context.json sections

| Section        | Written by                                                                                                                               | When                                                                     |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| `architecture` | `/dev-define`, `/dev-build`, `/game-define`, `/game-build`                                                                               | On architecture definition / after build                                 |
| `context`      | `/core-setup`, `/dev-build`, `/dev-refactor`, `/game-build`, `/game-refactor`                                                            | On build/refactor (structure, routing, patterns)                         |
| `learnings`    | `/dev-build`, `/dev-verify`, `/dev-refactor`, `/game-build`, `/game-verify`, `/game-refactor`, `/core-pull`, `/core-setup --mode=mature` | Feature completion (extracted/inferred) or teammate/legacy code (synced) |

Handoff namespace for `learnings` is `project-context.learnings` — matches the `reads:`/`writes:` declarations in skill frontmatter (see `shared/DEVINFO.md`).

For the `project.json` writer table and the cross-file skill sync overview see [DASHBOARD-PROJECT.md](DASHBOARD-PROJECT.md) § Which skills write what.
