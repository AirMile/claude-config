# Backlog: JSON Data Store

The backlog is a plain JSON data store. The kanban board UI is rendered by the server from a template with the data injected at request time — data and presentation are fully separated. All skills that read or write the backlog use the same approach.

**Data store:** `.project/backlog.json` (canonical, `schemaVersion: 2`)
**Template (presentation only):** `{skills_path}/shared/references/backlog-template.html`
**Server:** `{skills_path}/shared/references/serve-backlog.js` (port 9876)
**Archive:** `.project/archive/backlog-archive.json` (shipped dev-track features — see § Archiving)

**Legacy format:** pre-migration projects embed the same JSON in `.project/backlog.html` inside `<script id="backlog-data">`. Readers fall back to it (see `BACKLOG-LOAD.md`); writers migrate first (see § Writing). Run `python3 {config_repo}/scripts/migrate-project.py <project-root>` to convert in one step.

## Live runtime data

`serve-backlog.js` injects one server-computed field into the JSON payload on every `GET /{project}/backlog` request:

- **`data.seedDrift[]`** — deferred seed-drift entries, written when a skill detects seed divergence without rewriting the seed inline (the user chose "Skip — leave seed as-is" at the Seed Alignment Check, or the skill records drift silently like `/project-todo`). Each entry: `{ category, seedSays, featureDecides, source, ref, detectedAt }` (see `shared/SEED.md § Alignment Check § Drift entry schema`). `category` ∈ `{ "contradiction", "new-direction", "scope-expansion" }`. `source` identifies the writing skill (`/project-backlog`, `/project-todo`, `/project-retire`). Consumed by `/project-seed § Sync`, `/project-brainstorm`, and `/project-critique` on concept-scope save — first successful seed rewrite removes the processed entries. Optional; absent on backlogs that never deferred drift. Strip before saving if accidentally included in a payload.

## Reading the backlog

Read `.project/backlog.json` and parse as JSON. For PHASE 0 read-only access, prefer the extraction profiles in `BACKLOG-LOAD.md` / `GAME-BACKLOG-LOAD.md` over a full Read — they return only the fields needed and handle the legacy fallback.

**Data structure:**

```json
{
  "schemaVersion": 2,
  "project": "Project name",
  "generated": "2026-01-15",
  "updated": "2026-01-20",
  "source": "/project-backlog",
  "overview": "Short description",
  "features": [
    {
      "name": "feature-name",
      "type": "FEATURE|API|INTEGRATION|UI|REFACTOR|PAGE|COMPONENT|THEME|A11Y|PERF|PAGE-GAP",
      "status": "TODO|DEFINED|DOING|DONE|CANCELLED",
      "phase": "P1|P2|P3|P4",
      "description": "Description",
      "source": "/project-backlog",
      "dependencies": ["other-feature"],
      "risk": "1-5|null",
      "date": "2026-01-15|null",
      "auto": "true|null",
      "refactor": "REFACTORED|ROLLED_BACK|null",
      "audit": {
        "buildScreenshot": "<path>",
        "buildSmokeStatus": "PASS|FAIL|SKIPPED",
        "buildSmokeError": "<short reason — only on FAIL>",
        "lastRun": "<YYYY-MM-DD>",
        "scopes": ["<scope-name>"],
        "findings": { "critical": "<N>", "warnings": "<N>", "passed": "<N>" }
      },
      "transition": "designing|converting|auditing|defining|building|verifying|refactoring|shipping|null",
      "pageHint": ["page-name"],
      "externalRef": {
        "type": "github|jira|linear",
        "id": "<issue/ticket id>",
        "url": "<full URL>",
        "itemId": "<ProjectV2 node id or null>",
        "assignees": ["<username>"],
        "labels": ["<label>"],
        "direction": "inbound|outbound",
        "syncedStatus": "open|closed|null",
        "syncedAt": "<YYYY-MM-DD>",
        "split": "frontend|backend|tests|null"
      }
    }
  ],
  "notes": "Any notes"
}
```

The `audit` field is **design-track-specific** (type `PAGE` or `COMPONENT`). `buildScreenshot`/`buildSmokeStatus`/`buildSmokeError` are written by `/design-create` Build (smoke-render). `lastRun`/`scopes`/`findings` are written by `/design-check` PHASE 4.3. No field is required; consumers check for presence. PASS status can be derived from `findings.critical === 0` — no separate boolean needed.

## Writing the backlog

**Legacy migration on first write:** if `.project/backlog.json` does not exist but `.project/backlog.html` does, migrate before mutating: extract the JSON from `<script id="backlog-data">`, add `"schemaVersion": 2`, write it to `.project/backlog.json`, and delete `.project/backlog.html`. Then proceed below. (Idempotent — once `backlog.json` exists this step never fires again.)

1. Read `.project/backlog.json`
2. Parse as JSON
3. Mutate the data object (change status, add items, etc.)

   **When adding items — dedup check (always, before every `data.features.push()`):**
   1. `data.features.find(f => f.name === kebab-name)` → already in backlog? → skip.
   2. Type COMPONENT: also `project.json#design.components.find(c => c.name === kebab-name)` → already specified? → link instead of push.
   3. Discovery flows: `feature.json#suggestionsLog.find(s => s.name === name && s.status === "rejected" && s.skill === current-skill)` → previously rejected by current skill? → skip.

4. Set `updated` to current date (`YYYY-MM-DD`)
5. Serialize and write back: `JSON.stringify(data, null, 2)` → `.project/backlog.json`

For small mutations (status flip, one field) prefer the Edit tool on the JSON file over a full rewrite.

## Source field convention

The `source` field on a backlog item indicates which skill created it. Convention: **always with leading slash**, e.g. `"/project-todo"`, `"/dev-define"`, `"/design-create"`.

**Independent rule:** A feature is INDEPENDENT (never overwritten by `/project-backlog` during rebuild) when `source` is set to anything other than `"/project-backlog"`. Features without a `source` field, or with `"/project-backlog"`, are concept-derived and managed by `/project-backlog`.

Readers also accept slash-less variants (`"project-todo"`) and legacy values (`"dev-todo"`) — both are still INDEPENDENT under the rule above.

## Team context

In team repos where colleagues do not use claude-config: backlog remains local (`.project/` is gitignored), team uses its own tracker. See `shared/TEAM.md` for the full workflow.

The **externalRef field** links a backlog item to an external issue/ticket. One issue can generate multiple items via `/team-issues` smart split — those share the same `id` with different `split` values.

```json
{
  "name": "oauth-login",
  "type": "PAGE",
  "source": "/team-issues",
  "externalRef": {
    "type": "github",
    "id": "123",
    "url": "https://github.com/owner/repo/issues/123",
    "labels": ["enhancement", "P1"],
    "split": "frontend"
  }
}
```

- `/team-issues` writes it on intake
- `/dev-define` and `/design-create` copy to `feature.json`
- `/core-commit` reads to prefix commit messages

## Parallel sync

When a skill synchronizes multiple files at the same time (backlog + project.json + feature.json):

1. **Read in parallel**: all files in one tool call batch
2. **Mutate in memory**: update all data objects
3. **Write in parallel**: all files in one tool call batch

This reduces 6+ sequential round-trips to 2. Files are independent — no ordering required.

## Generating the backlog (new backlog)

1. Build the JSON data object with all features (top-level keys: `schemaVersion: 2`, `project`, `generated`, `updated`, `source`, `overview`, `features`, `notes`)
2. Write it to `.project/backlog.json`
3. Start the server if it is not running:
   ```bash
   # Respects $CLAUDE_PROJECTS_ROOT via lib/config.js (fallback: ~/projects)
   curl -s http://localhost:9876/ > /dev/null 2>&1 || nohup node --watch {skills_path}/shared/references/serve-backlog.js > /tmp/backlog-server.log 2>&1 &
   ```
4. Show the URL: `http://localhost:9876/{project-dir}/backlog` (the server renders the board from the template + data)

## Status flow (two tracks)

The backlog is divided into two tracks: **Design** (PAGE/COMPONENT) and **Dev** (all other types). Status values are identical, but labels and skills per status differ.

### Design track (PAGE/COMPONENT)

```
TODO (To design) → DEFINED (To convert) → DOING (Building) → DONE (Shipped) → shipped
                        ↑ Path B only              ↑ Path A skips DEFINED
```

| Status      | Label      | Set by                                                                                                       |
| ----------- | ---------- | ------------------------------------------------------------------------------------------------------------ |
| `TODO`      | To design  | `/design-create` Capture, `/project-todo`, `/project-backlog`, reuse-discovery                               |
| `DEFINED`   | To convert | `/design-create` Brief (Path B — offline handoff)                                                            |
| `DOING`     | Building   | `/design-create` Build (Path A) or `/design-create` Convert route (Path B)                                   |
| `DONE`      | Shipped    | `/design-check` (PAGE PASS) — both build and convert pages                                                   |
| `CANCELLED` | Archived   | Manually via UI (○ button), `/project-backlog` update mode (cancel-proposal), `/project-retire` — restorable |

**Path A** (Build with Claude Code): TODO → DOING → DONE — DEFINED is skipped.

**Path B** (Brief for external design): TODO → DEFINED → DOING → DONE.

`/design-check` (batch mode or targeted) runs at end of release cycle across DOING features — not per-component inline. Sets `lastCheckedSha`; for PAGE scope on PASS: sets `f.shipped = true` and `status: "DONE"`. A COMPONENT is never auto-`DONE` — it ships with the page/feature that consumes it.

`/core-finalize` (and any PHASE Finalize via `shared/FINALIZE.md`) is a merge/cleanup step — it **never promotes `DOING` → `DONE`**. It only stamps `shipped`/`shippedSha` on a PAGE that is **already `DONE`**; a `DOING` PAGE stays at TO CHECK until `/design-check` ships it, and a COMPONENT is left untouched. This mirrors dev-track, where `/dev-verify` finalize never writes `shipped` — `/dev-refactor` does.

### When to use which skill for PAGE/COMPONENT

| Situation                                               | Skill                                                                   |
| ------------------------------------------------------- | ----------------------------------------------------------------------- |
| Quick "just thought of something" addition              | `/project-todo`                                                         |
| Full design (screenshot, Figma, brief)                  | `/design-create` Capture                                                |
| Bulk-init from concept or brainstorm output             | `/project-backlog`                                                      |
| Pattern detection during build (cross-page reuse)       | `/project-backlog` reuse-discovery                                      |
| Convert existing card from sketch/wireframe/Figma/Canva | `/design-create` (paste sketch/URL, or board ⋯ → "Convert from sketch") |

All routes write the same JSON structure to `data.features[]` with `type=PAGE` or `COMPONENT` and `status=TODO`. All routes **except `/project-backlog` bulk-init** also set **`transition: "designing"`**, which enables `/design-create` to auto-detect these items without a manual dashboard click. `/project-backlog` omits `transition` at creation — the dashboard sets it when the user clicks copy-prompt (see `project-backlog/references/generate-backlog.md` transition field rule). `/design-create` Capture adds extra spec fields (mock paths, brief, audit). Other routes leave those fields empty — `/design-create` Build fills them in later.

### Dev track (FEATURE/API/UI/REFACTOR/BUG/etc.)

```
TODO (To define) → DEFINED (To build) → DOING (To verify) → DONE (To refactor) → shipped
                                                                  ↓ (manual)
                                                              CANCELLED (Archived)
```

| Status      | Label       | Set by                                                                                                       |
| ----------- | ----------- | ------------------------------------------------------------------------------------------------------------ |
| `TODO`      | To define   | `/project-todo`, `/project-backlog`                                                                          |
| `DEFINED`   | To build    | `/dev-define` (completion)                                                                                   |
| `DOING`     | To verify   | `/dev-build` (completion)                                                                                    |
| `DONE`      | To refactor | `/dev-verify` (completion)                                                                                   |
| `CANCELLED` | Archived    | Manually via UI (○ button), `/project-backlog` update mode (cancel-proposal), `/project-retire` — restorable |

**Optional fields on CANCELLED items**: `cancelledReason` (one-line why, set by skill-driven cancellations) and `cancelledAt` (`YYYY-MM-DD`, set by `/project-retire`). UI cancellations omit both. Archived features (see § Archiving) can also carry `status: "CANCELLED"` after a `/project-retire` run — history stays, flagged.

`/dev-refactor` is the **promotion trigger** for dev-cards: after CLEAN or REFACTORED it sets `f.shipped = true` + `f.shippedAt` + `f.shippedSha`, then **moves the feature object to the archive** (see § Archiving). Shipped items leave the backlog data and appear on the Dashboard via the archive.

## Archiving (shipped dev-track features)

At scale, shipped features become dead weight for every backlog load (measured: 54% of the data on a 150-feature project). Dev-track features therefore move out of `backlog.json` when they ship:

- **File:** `.project/archive/backlog-archive.json` — `{ "schemaVersion": 2, "archived": [ <full feature objects> ] }`
- **Writer:** `/dev-refactor` and `/game-refactor` completion — in the same sync that sets `shipped: true`, remove the feature object from `backlog.json#features[]` and append it to `archived[]` (create the file with the scaffold above if absent). Mirrors the existing `.project/features/archive/` dir convention.
- **Readers:** the dashboard shipped-showcase (server merges `archived[]` into the served features view, in-memory) and humans. Pipeline skills never need archived features — that is the point.
- **Design-track exception:** PAGE/COMPONENT features shipped by `/design-check` **stay in `backlog.json`** — the batch filter `lastCheckedSha !== shippedSha` re-audits them when the page changes after shipping. Only dev-track (non-PAGE/COMPONENT) features archive.
- **Restore:** move the object back to `features[]` manually (or via board UI in a future iteration); idempotent in both directions.

**`f.shipped` field:**

| Value             | Meaning                                               |
| ----------------- | ----------------------------------------------------- |
| `false` / missing | Waiting for next step — visible in the active section |
| `true`            | Promoted to Dashboard — no longer visible in backlog  |

### UI: dual-track swimlanes

The backlog board shows two top-level swimlanes with their own status sections and verb labels. Track pills (`All | Design | Dev`) at the top of the board filter by track. Within each track, features are grouped by phase (P1/P2/P3/P4).

```
═══ DESIGN ════════════════════════════════════════
  ▾ To design    (PAGE/COMPONENT TODO)
  ▾ To convert   (PAGE/COMPONENT DEFINED — Path B)
  ▾ Building     (PAGE/COMPONENT DOING)

═══ DEV ══════════════════════════════════════════════
  ▾ To define    (other TODO)
  ▾ To build     (other DEFINED)
  ▾ To verify    (other DOING)
  ▾ To refactor  (other DONE)
```

DONE+`shipped: true` (both tracks) move to the Dashboard. CANCELLED is one shared archived section at the bottom.

## Refactor-badges ("To refactor" section)

Items with `status === "DONE"` are shown in the **"To refactor"** section of the backlog. They show a badge reflecting `/dev-refactor`'s outcome:

| `f.refactor` value | Badge  | Meaning                                                                       |
| ------------------ | ------ | ----------------------------------------------------------------------------- |
| `null` / missing   | (none) | Refactor not yet run — feature is a refactor candidate                        |
| `"REFACTORED"`     | ✓      | Refactor completed (CLEAN analysis and REFACTORED both counted here)          |
| `"ROLLED_BACK"`    | ⚠      | Refactor attempted, rolled back (see `feature.json.refactor.failureAnalysis`) |

`/dev-refactor` writes this field on both `feature.json` and the backlog feature in the same sync. On CLEAN or REFACTORED, `f.shipped = true` also follows and the item moves to the Dashboard.

> **Invariant:** `f.refactor === "REFACTORED"` implies `f.shipped === true` + feature absent from `backlog.json#features[]` + feature present in `backlog-archive.json#archived[]` + feature-dir under `features/archive/`. A `refactor`-without-`shipped` state is invalid — `/dev-refactor` must detect and self-heal this before printing `REFACTOR COMPLETE` (see `completion-batch.md § Step 3b`).

## COMPONENT as first-class type

`type: "COMPONENT"` is a first-class backlog type alongside `PAGE`, `FEATURE`, `API`, etc. COMPONENT features live on the **Design track** — together with PAGE — and go through the design pipeline.

### Creating

COMPONENT todos are created by:

- `/design-create` Component-route (explicit user input)
- Dev-skills as reuse-discovery (suggestion, user-accept-only) — see below

Schema when creating:

```json
{
  "name": "button",
  "type": "COMPONENT",
  "status": "TODO",
  "transition": "designing",
  "phase": "P3",
  "description": "Primary action trigger with primary/ghost/destructive variants",
  "source": "/design-create",
  "scope": "atomic",
  "dependencies": []
}
```

**`pageHint` field** (optional, on any FEATURE/API/etc. type): list of PAGE names this feature surfaces on. Set by `/dev-define` during requirements sparring. Read by `/design-create` Build to pre-populate the page-composition selection menu.

```json
{ "name": "cart-total", "type": "FEATURE", "pageHint": ["checkout", "cart"] }
```

**Bidirectional link convention:** PAGE task `dependencies[]` ↔ FEATURE `pageHint[]`. When `/design-create` Build composes a PAGE, it writes the selected feature names into `page.dependencies[]`. When `/dev-define` spars on page placement, it writes the page name(s) into `feature.pageHint[]`.

**scope field on backlog item** (mirrors `design.components[].scope`):

| Value     | Meaning                           |
| --------- | --------------------------------- |
| `atomic`  | Small reusable element            |
| `section` | Composite within a single page    |
| `layout`  | Multi-page wrapper (all/multiple) |

### Pipeline (Design track — identical to PAGE)

```
TODO (To design) → DOING (Building) → DONE (Shipped)       ← Path A
TODO (To design) → DEFINED (To convert) → DOING → DONE     ← Path B
```

| Step    | Skill            | Output                                                  |
| ------- | ---------------- | ------------------------------------------------------- |
| Design  | `/design-create` | code (Build) or brief (Brief) + demo-page for COMPONENT |
| Convert | `/design-create` | code from visual input — Convert route (Path B)         |
| Audit   | `/design-check`  | A11Y + tokens + responsive — terminal, sets `shipped`   |

**`/design-check` PASS is terminal** — no refactor step. Item ships directly to Dashboard.

### Discovery by dev-skills

Triggers, resolution and persistence schema: see [Discovery — Reuse-Discovery and Page-Discovery](./SKILL-PATTERNS.md#reuse-discovery).

All suggestions are **user-accept-only** — no auto-create. Accepted and rejected suggestions are logged in `feature.json#suggestionsLog[]` (for dedup — no repeated prompts).

### Multi-page components

A NavBar with `scope: layout, appliesTo: all` is **one backlog item** — not one per page. Build patches `app/layout.tsx` (or framework equivalent) once. All PAGE features built afterwards inherit the NavBar automatically via the layout import.

For route-group-specific layout components: `appliesTo: "route-group:authenticated"` → patch in `app/(auth)/layout.tsx`.

### Backlog filter (dashboard)

The backlog dashboard shows track pills (`All | Design | Dev`) to filter the kanban view. `Design` shows only PAGE/COMPONENT items; `Dev` shows all other types. The existing `type` field is the data source.

## Filtering features

Examples of common queries on the JSON object:

```
Next TODO feature:          data.features.find(f => f.status === "TODO")
All DEFINED features:       data.features.filter(f => f.status === "DEFINED")
All DOING features:         data.features.filter(f => f.status === "DOING")
Defined (ready to build):   data.features.filter(f => f.status === "DEFINED")
Active (DOING):             data.features.filter(f => f.status === "DOING")
All DONE features:          data.features.filter(f => f.status === "DONE")
DONE not-refactored:        data.features.filter(f => f.status === "DONE" && !f.refactor)
Waiting for refactor:       data.features.filter(f => f.status === "DONE" && !f.shipped)
Shipped (to dashboard):     data.features.filter(f => f.shipped === true)
P1 features:                data.features.filter(f => f.phase === "P1")
Blocked:                    data.features.filter(f => (f.dependencies||[]).some(d => { const x=data.features.find(g=>g.name===d); return !x||x.status!=="DONE"; }))
High risk (TODO/DEFINED):   data.features.filter(f => f.risk >= 4 && (f.status === "TODO" || f.status === "DEFINED"))
Archived:                   data.features.filter(f => f.status === "CANCELLED")
```

---

## Lifecycle Protocol

Backlog tasks flow through states via two actors:

1. **Backlog dashboard UI** sets `transition` when the user clicks "Copy prompt" — this is the queue marker that tells the next skill which task is being requested.
2. **Skill** reads `transition` to identify its task, runs the work, then writes `status` to the next state and removes `transition` on success.

Skills do **not** write to the backlog at start — saves a read+write roundtrip and keeps abort idempotent (if aborted, user re-copies the prompt).

### transition field semantics

`feature.transition` — optional string, set by the dashboard, consumed by skills:

| Value           | Dashboard sets when user copies prompt for                                                            | Consumed by                                      |
| --------------- | ----------------------------------------------------------------------------------------------------- | ------------------------------------------------ |
| `"defining"`    | THEME setup or FEATURE definition prompt                                                              | `design-tokens` (THEME) / `dev-define` (FEATURE) |
| `"building"`    | Build prompt for a DEFINED feature                                                                    | `dev-build`                                      |
| `"verifying"`   | Verify prompt for a DOING feature                                                                     | `dev-verify`                                     |
| `"refactoring"` | Refactor prompt for a DONE+!shipped feature                                                           | `dev-refactor`                                   |
| `"designing"`   | Design/build prompt for a TODO PAGE or COMPONENT                                                      | `design-create`                                  |
| `"converting"`  | Convert prompt for a DEFINED PAGE or COMPONENT                                                        | `design-create`                                  |
| `"contenting"`  | Fill-content prompt for a built (DOING) PAGE/COMPONENT                                                | `design-content`                                 |
| `"shipping"`    | ⚡ Ship (auto) menu item on a TODO feature — dev-track → `/dev-ship`, PAGE/COMPONENT → `/design-ship` | `dev-ship` / `design-ship`                       |

On successful completion the skill removes the `transition` field. **Exception**: `"shipping"` is
a whole-run marker — the ship sub-phase syncs (the copies under `dev-ship/references/` and
`design-ship/references/`) preserve it; only the ship skill's own completion (dev-ship: refactor's
completion-batch or PHASE 5 cleanup; design-ship: PHASE 4 completion or PHASE 5 cleanup) removes
it. No-arg pickup is disambiguated by type: `dev-ship` picks `"shipping"` on non-design types
(+ PAGE-GAP), `design-ship` on PAGE/COMPONENT.

**Board rendering (three progress states).** The dashboard shows a `transition` without a live
skill signal as **queued** (dim, "⧉ {transition} · queued"), a feature with a
`.project/session/active-{name}.json` signal as **live** (pulsing "{skill}ing" badge), and a live
signal with the optional `waiting` field as **waiting for input** (amber, static
"⏸ {label} · input needed" — sorted to the top; written by dev-verify's manual walkthrough,
game-verify's playtest wait, and design-ship's PHASE 4 review). All three group in the IN PROGRESS
section at the top of the board. See `DEVINFO.md § Active Feature Signal`.

### Read (PHASE 0)

```
Read .project/backlog.json (or use BACKLOG-LOAD.md / GAME-BACKLOG-LOAD.md profiles).
Find a task matching the skill's filter (see table below).

Found     → note taskName, continue.
           Show: Backlog: ✓ Task picked up — {taskName}
Not found → standalone run, no task to link.
           Show: Backlog: ✓ No matching task in backlog (standalone run)
```

### Write (on success)

```
Re-read backlog.json, find taskName.
Set status → {new status}, remove transition field.
Write back.
Show: Backlog: ✓ Task "{taskName}" → {newStatus}
```

### Abort (cancel / postflight fail)

No backlog write — `transition` remains as set by the dashboard, user can re-copy the prompt to retry. Idempotent by design.

### Skill filter & status transition table

The DEV pipeline uses `transition` values `"defining"` / `"building"` / `"verifying"` / `"refactoring"`. The DESIGN pipeline (PAGE/COMPONENT) uses `"designing"` / `"converting"` / `"contenting"` — same pattern, different vocab. There is no `"auditing"` transition — `design-check` runs in batch mode at release end, not per item.

| Skill            | Filter                                                                                     | New status on success                           |
| ---------------- | ------------------------------------------------------------------------------------------ | ----------------------------------------------- |
| `design-tokens`  | `type === "THEME" && transition === "defining"`                                            | `"DONE"`                                        |
| `dev-define`     | `type === "FEATURE" && transition === "defining"`                                          | `"DEFINED"`                                     |
| `dev-build`      | `type === "FEATURE" && transition === "building"`                                          | `"DOING"`                                       |
| `dev-verify`     | `type === "FEATURE" && transition === "verifying"`                                         | `"DONE"`                                        |
| `dev-refactor`   | `transition === "refactoring"`                                                             | keep status, set `shipped: true`                |
| `dev-ship`       | `transition === "shipping" && type !== PAGE/COMPONENT` (no-arg pickup)                     | full pipeline → `shipped: true` via refactor    |
| `design-create`  | `(type === "PAGE" \|\| type === "COMPONENT") && transition === "designing"`                | `"DOING"` (Path A — DEFINED is skipped)         |
| `design-create`  | `(type === "PAGE" \|\| type === "COMPONENT") && transition === "converting"`               | `"DOING"`                                       |
| `design-content` | `(type === "PAGE" \|\| type === "COMPONENT") && transition === "contenting"`               | keep `"DOING"`, sets `contentStatus: "filled"`  |
| `design-check`   | batch: `status === "DOING"` or `lastCheckedSha !== shippedSha`                             | sets `lastCheckedSha`; PAGE PASS → `"DONE"`     |
| `design-ship`    | `(type === "PAGE" \|\| type === "COMPONENT") && transition === "shipping"` (no-arg pickup) | full pipeline → PAGE `"DONE"` + `shipped: true` |
| `game-define`    | `type === "FEATURE" && transition === "defining"`                                          | `"DEFINED"`                                     |
| `game-build`     | `type === "FEATURE" && transition === "building"`                                          | `"DOING"`                                       |
| `game-verify`    | `type === "FEATURE" && transition === "verifying"`                                         | `"DONE"`                                        |
| `game-refactor`  | `transition === "refactoring"`                                                             | keep status, set `shipped: true`                |
