# Backlog: HTML+JSON Format

The backlog is an interactive HTML list view with embedded JSON data. All skills that read or write the backlog use the same approach.

**File:** `.project/backlog.html`
**Template:** `{skills_path}/shared/references/backlog-template.html`
**Server:** `{skills_path}/shared/references/serve-backlog.js` (port 9876)

## Live runtime data

`serve-backlog.js` injects two server-computed fields into the JSON payload on every `GET /{project}/backlog` request:

- **`data.worktrees[]`** — open git worktrees for this project. Each entry: `{ feature, branch, path, ahead, dirty, lastCommitAt, prState, prUrl, prNumber }`. Computed from `git worktree list --porcelain` + optional `gh pr list`. Cached 30 s per project root; bust with `?refresh=1`.
- **`data.mainState`** — `{ dirty, behindOrigin }` for the main checkout.
- **`data.seedDrift[]`** — deferred seed-drift entries from `/project-backlog` runs where the user chose "Skip — leave seed as-is" at the Seed Alignment Check. Each entry: `{ category, seedSays, featureDecides, source, ref, detectedAt }` (see `shared/SEED.md § Alignment Check § Drift entry schema`). `category` ∈ `{ "contradiction", "new-direction", "scope-expansion" }`. `source` is always `"/project-backlog"` for entries on this array. Consumed by `/project-seed § Sync`, `/project-brainstorm`, and `/project-critique` on concept-scope save — first successful seed rewrite removes the processed entries. Optional; absent on backlogs that never deferred drift. Strip before saving if accidentally included in a payload.

**These fields are NOT persisted.** Skills must never write `worktrees` or `mainState` via `POST /backlog/save` — the server always re-derives them. If a `POST /save` payload accidentally includes them the server ignores them (it only replaces the `<script id="backlog-data">` block verbatim with whatever JSON it receives, so include = written to disk and persisted on the next re-inject). To be safe: strip both fields before saving.

The backlog template (`backlog-template.html`) reads these fields to render:

- A `⎇` badge on each feature card whose name matches a worktree `feature` field (exact or prefix match `feature.startsWith(name + '-')`).
- A top-nav `⎇ N worktrees` disclosure pill listing all open worktrees with state and a click-to-copy `/core-finalize` command.

## Reading the backlog

1. Read `.project/backlog.html`
2. Find the JSON block: `<script id="backlog-data" type="application/json">...</script>`
3. Parse the contents as JSON

**Data structure:**

```json
{
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

The `audit` field is **frontend-track-specific** (type `PAGE` or `COMPONENT`). `buildScreenshot`/`buildSmokeStatus`/`buildSmokeError` are written by `/frontend-design` Build (smoke-render). `lastRun`/`scopes`/`findings` are written by `/frontend-check` PHASE 4.3. No field is required; consumers check for presence. PASS status can be derived from `findings.critical === 0` — no separate boolean needed.

## Writing the backlog

1. Read `.project/backlog.html` (full contents)
2. Parse the JSON block (see above)
3. Mutate the data object (change status, add items, etc.)

   **When adding items — dedup check (always, before every `data.features.push()`):**
   1. `data.features.find(f => f.name === kebab-name)` → already in backlog? → skip.
   2. Type COMPONENT: also `project.json#design.components.find(c => c.name === kebab-name)` → already specified? → link instead of push.
   3. Discovery flows: `feature.json#suggestionsLog.find(s => s.name === name && s.status === "rejected" && s.skill === current-skill)` → previously rejected by current skill? → skip.

4. Set `updated` to current date (`YYYY-MM-DD`)
5. Serialize the JSON object: `JSON.stringify(data, null, 2)`
6. Replace the block between `<script id="backlog-data" type="application/json">` and `</script>` with the new JSON
7. Write the full file back to `.project/backlog.html`

**Use Edit tool** to replace only the JSON block — do not rewrite the whole file. Ensure the `<script>` tags remain intact.

## Source field convention

The `source` field on a backlog item indicates which skill created it. Convention: **always with leading slash**, e.g. `"/project-todo"`, `"/dev-define"`, `"/frontend-design"`.

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
- `/dev-define` and `/frontend-design` copy to `feature.json`
- `/core-commit` reads to prefix commit messages

## Parallel sync

When a skill synchronizes multiple files at the same time (backlog + project.json + feature.json):

1. **Read in parallel**: all files in one tool call batch
2. **Mutate in memory**: update all data objects
3. **Write in parallel**: all files in one tool call batch

This reduces 6+ sequential round-trips to 2. Files are independent — no ordering required.

## Generating the backlog (new backlog)

1. Copy template: `{skills_path}/shared/references/backlog-template.html` → `.project/backlog.html`
2. Build the JSON data object with all features
3. Replace the placeholder JSON in the `<script id="backlog-data">` block with the real data object
4. Start the server if it is not running:
   ```bash
   # Respects $CLAUDE_PROJECTS_ROOT via lib/config.js (fallback: ~/projects)
   curl -s http://localhost:9876/ > /dev/null 2>&1 || nohup node --watch {skills_path}/shared/references/serve-backlog.js > /tmp/backlog-server.log 2>&1 &
   ```
5. Show the URL: `http://localhost:9876/{project-dir}/backlog`

## Status flow (two tracks)

The backlog is divided into two tracks: **Frontend** (PAGE/COMPONENT) and **Dev** (all other types). Status values are identical, but labels and skills per status differ.

### Frontend track (PAGE/COMPONENT)

```
TODO (To design) → DEFINED (To convert) → DOING (To audit) → DONE (Shipped) → shipped
                        ↑ Path B only              ↑ Path A skips DEFINED
```

| Status      | Label      | Set by                                                                           |
| ----------- | ---------- | -------------------------------------------------------------------------------- |
| `TODO`      | To design  | `/frontend-design` Capture, `/project-todo`, `/project-backlog`, reuse-discovery |
| `DEFINED`   | To convert | `/frontend-design` Brief (Path B — offline handoff)                              |
| `DOING`     | To audit   | `/frontend-design` Build (Path A) or `/frontend-convert` (Path B)                |
| `DONE`      | Shipped    | `/frontend-check` PASS (terminal — no refactor step)                             |
| `CANCELLED` | Archived   | Manually via UI (○ button), restorable                                           |

**Path A** (Build with Claude Code): TODO → DOING → DONE — DEFINED is skipped.

**Path B** (Brief for external design): TODO → DEFINED → DOING → DONE.

`/frontend-check` PASS sets `f.shipped = true` directly — no refactor step for frontend cards.

### When to use which skill for PAGE/COMPONENT

| Situation                                         | Skill                              |
| ------------------------------------------------- | ---------------------------------- |
| Quick "just thought of something" addition        | `/project-todo`                    |
| Full design (screenshot, Figma, brief)            | `/frontend-design` Capture         |
| Bulk-init from concept or brainstorm output       | `/project-backlog`                 |
| Pattern detection during build (cross-page reuse) | `/project-backlog` reuse-discovery |

All four routes write the same JSON structure to `data.features[]` with `type=PAGE` or `COMPONENT` and `status=TODO`. `/frontend-design` Capture adds extra spec fields (mock paths, brief, audit). Other routes leave those fields empty — `/frontend-design` Build fills them in later.

### Dev track (FEATURE/API/UI/REFACTOR/BUG/etc.)

```
TODO (To define) → DEFINED (To build) → DOING (To verify) → DONE (To refactor) → shipped
                                                                  ↓ (manual)
                                                              CANCELLED (Archived)
```

| Status      | Label       | Set by                                 |
| ----------- | ----------- | -------------------------------------- |
| `TODO`      | To define   | `/project-todo`, `/project-backlog`    |
| `DEFINED`   | To build    | `/dev-define` (completion)             |
| `DOING`     | To verify   | `/dev-build` (completion)              |
| `DONE`      | To refactor | `/dev-verify` (completion)             |
| `CANCELLED` | Archived    | Manually via UI (○ button), restorable |

`/dev-refactor` is the **promotion trigger** for dev-cards: after CLEAN or REFACTORED it sets `f.shipped = true` + `f.shippedAt` + `f.shippedSha`. Shipped items leave the backlog and move to the Dashboard.

**`f.shipped` field:**

| Value             | Meaning                                               |
| ----------------- | ----------------------------------------------------- |
| `false` / missing | Waiting for next step — visible in the active section |
| `true`            | Promoted to Dashboard — no longer visible in backlog  |

### UI: dual-track swimlanes

The backlog board shows two top-level swimlanes with their own status sections and verb labels. Track pills (`All | Frontend | Dev`) at the top of the board filter by track. Within each track, features are grouped by phase (P1/P2/P3/P4).

```
═══ FRONTEND ════════════════════════════════════════
  ▾ To design    (PAGE/COMPONENT TODO)
  ▾ To convert   (PAGE/COMPONENT DEFINED — Path B)
  ▾ To audit     (PAGE/COMPONENT DOING)

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

## COMPONENT as first-class type

`type: "COMPONENT"` is a first-class backlog type alongside `PAGE`, `FEATURE`, `API`, etc. COMPONENT features live on the **Frontend track** — together with PAGE — and go through the frontend pipeline.

### Creating

COMPONENT todos are created by:

- `/frontend-design` Component-route (explicit user input)
- Dev-skills as reuse-discovery (suggestion, user-accept-only) — see below

Schema when creating:

```json
{
  "name": "button",
  "type": "COMPONENT",
  "status": "TODO",
  "phase": "P3",
  "description": "Primary action trigger with primary/ghost/destructive variants",
  "source": "/frontend-design",
  "scope": "atomic",
  "dependencies": []
}
```

**scope field on backlog item** (mirrors `design.components[].scope`):

| Value     | Meaning                           |
| --------- | --------------------------------- |
| `atomic`  | Small reusable element            |
| `section` | Composite within a single page    |
| `layout`  | Multi-page wrapper (all/multiple) |

### Pipeline (Frontend track — identical to PAGE)

```
TODO (To design) → DOING (To audit) → DONE (Shipped)       ← Path A
TODO (To design) → DEFINED (To convert) → DOING → DONE     ← Path B
```

| Step    | Skill               | Output                                                  |
| ------- | ------------------- | ------------------------------------------------------- |
| Design  | `/frontend-design`  | code (Build) or brief (Brief) + demo-page for COMPONENT |
| Convert | `/frontend-convert` | code from brief (Path B only)                           |
| Audit   | `/frontend-check`   | A11Y + tokens + responsive — terminal, sets `shipped`   |

**`/frontend-check` PASS is terminal** — no refactor step. Item ships directly to Dashboard.

### Discovery by dev-skills

Triggers, resolution and persistence schema: see [Discovery — Reuse-Discovery and Page-Discovery](./SKILL-PATTERNS.md#reuse-discovery).

All suggestions are **user-accept-only** — no auto-create. Accepted and rejected suggestions are logged in `feature.json#suggestionsLog[]` (for dedup — no repeated prompts).

### Multi-page components

A NavBar with `scope: layout, appliesTo: all` is **one backlog item** — not one per page. Build patches `app/layout.tsx` (or framework equivalent) once. All PAGE features built afterwards inherit the NavBar automatically via the layout import.

For route-group-specific layout components: `appliesTo: "route-group:authenticated"` → patch in `app/(auth)/layout.tsx`.

### Backlog filter (dashboard)

The backlog dashboard shows track pills (`All | Frontend | Dev`) to filter the kanban view. `Frontend` shows only PAGE/COMPONENT items; `Dev` shows all other types. The existing `type` field is the data source.

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

| Value           | Dashboard sets when user copies prompt for  | Consumed by                                        |
| --------------- | ------------------------------------------- | -------------------------------------------------- |
| `"defining"`    | THEME setup or FEATURE definition prompt    | `frontend-tokens` (THEME) / `dev-define` (FEATURE) |
| `"building"`    | Build prompt for a DEFINED feature          | `dev-build`                                        |
| `"verifying"`   | Verify prompt for a DOING feature           | `dev-verify`                                       |
| `"refactoring"` | Refactor prompt for a DONE+!shipped feature | `dev-refactor`                                     |

On successful completion the skill removes the `transition` field.

### Read (PHASE 0)

```
Read .project/backlog.html → parse <script id="backlog-data"> JSON.
Find a task matching the skill's filter (see table below).

Found     → note taskName, continue.
           Show: Backlog: ✓ Task picked up — {taskName}
Not found → standalone run, no task to link.
           Show: Backlog: ✓ No matching task in backlog (standalone run)
```

### Write (on success)

```
Re-read backlog.html, find taskName.
Set status → {new status}, remove transition field.
Write back.
Show: Backlog: ✓ Task "{taskName}" → {newStatus}
```

### Abort (cancel / postflight fail)

No backlog write — `transition` remains as set by the dashboard, user can re-copy the prompt to retry. Idempotent by design.

### Skill filter & status transition table

The DEV pipeline uses `transition` values `"defining"` / `"building"` / `"verifying"` / `"refactoring"`. The FRONTEND pipeline (PAGE/COMPONENT) uses `"designing"` / `"converting"` / `"auditing"` — same pattern, different vocab.

| Skill              | Filter                                                                       | New status on success            |
| ------------------ | ---------------------------------------------------------------------------- | -------------------------------- |
| `frontend-tokens`  | `type === "THEME" && transition === "defining"`                              | `"DONE"`                         |
| `dev-define`       | `type === "FEATURE" && transition === "defining"`                            | `"DEFINED"`                      |
| `dev-build`        | `type === "FEATURE" && transition === "building"`                            | `"DOING"`                        |
| `dev-verify`       | `type === "FEATURE" && transition === "verifying"`                           | `"DONE"`                         |
| `dev-refactor`     | `transition === "refactoring"`                                               | keep status, set `shipped: true` |
| `frontend-design`  | `(type === "PAGE" \|\| type === "COMPONENT") && transition === "designing"`  | `"DEFINED"`                      |
| `frontend-convert` | `(type === "PAGE" \|\| type === "COMPONENT") && transition === "converting"` | `"DOING"`                        |
| `frontend-check`   | `(type === "PAGE" \|\| type === "COMPONENT") && transition === "auditing"`   | `"DONE"`, set `shipped: true`    |
| `game-define`      | `type === "FEATURE" && transition === "defining"`                            | `"DEFINED"`                      |
| `game-build`       | `type === "FEATURE" && transition === "building"`                            | `"DOING"`                        |
| `game-verify`      | `type === "FEATURE" && transition === "verifying"`                           | `"DONE"`                         |
| `game-refactor`    | `transition === "refactoring"`                                               | keep status, set `shipped: true` |
