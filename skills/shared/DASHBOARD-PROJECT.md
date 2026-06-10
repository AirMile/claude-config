# Dashboard: project.json Format

> Part of the dashboard schema docs — see [DASHBOARD.md](DASHBOARD.md) for the section map. This file covers `project.json`. Runtime context (`project-context.json`) lives in [DASHBOARD-CONTEXT.md](DASHBOARD-CONTEXT.md); the `theme` section schema lives in [DASHBOARD-THEME.md](DASHBOARD-THEME.md).

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

### theme

**Design system source of truth.** Full schema (tokens, motion packs, springs, choreography, glass surfaces): see [DASHBOARD-THEME.md](DASHBOARD-THEME.md). All fields owned and written by `/frontend-tokens`.

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

For the `project-context.json` writer table see [DASHBOARD-CONTEXT.md](DASHBOARD-CONTEXT.md) § Which skills write what.

### Skill sync overview

| Skill                       | project.json                                                        | project-context.json                                              | When                     |
| --------------------------- | ------------------------------------------------------------------- | ----------------------------------------------------------------- | ------------------------ |
| `/core-setup`               | `stack` (full)                                                      | `context` (initial)                                               | After project generation |
| `/dev-define`               | `data.entities`, `endpoints`, `stack.packages`, `features` (DOING)  | `architecture` (write), `learnings` (read)                        | PHASE 6                  |
| `/dev-build`                | `endpoints`, `stack.packages`, `features` (DOING+built)             | `context`, `architecture`, `learnings` (write)                    | PHASE 4C                 |
| `/dev-verify`               | `stack.packages`, `endpoints`, `data.entities`, `features` (DONE)   | `architecture`, `learnings` (write)                               | PHASE 6 completion       |
| `/dev-refactor`             | `stack.packages`, `endpoints`, `data.entities`                      | `context`, `architecture`, `learnings` (write)                    | PHASE 5 completion       |
| `/frontend-design`          | `design` (pages, flows, principles), `features` (batch TODO)        | —                                                                 | On each run              |
| `/frontend-design`          | `stack.packages`, `design.pages`, `features` (DOING+built)          | —                                                                 | After PHASE 4            |
| `/frontend-tokens`          | `design.principles`                                                 | —                                                                 | After completion         |
| `/frontend-sketch`          | `design.canvases`                                                   | —                                                                 | new / generate / promote |
| `/game-define`              | `data.entities`, `stack.packages`, `features` (DOING)               | `architecture` (write)                                            | PHASE 6                  |
| `/game-build`               | `features` (DOING+built)                                            | `context`, `architecture`, `learnings` (write)                    | PHASE 5 completion       |
| `/team-verify`              | `features`, `stack.packages`, `endpoints`, `data.entities`          | `architecture` (write)                                            | PHASE 7 completion       |
| `/game-refactor`            | `features` (DONE)                                                   | `context`, `architecture`, `learnings` (write)                    | PHASE 5 completion       |
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
