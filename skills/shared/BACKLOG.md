# Backlog: JSON Data Store

The backlog is a plain JSON data store. The kanban board UI is rendered by the server from a template with the data injected at request time — data and presentation are fully separated. All skills that read or write the backlog use the same approach.

**Data store:** `.project/backlog.json` (canonical, `schemaVersion: 2`)
**Template (presentation only):** `{skills_path}/shared/references/backlog-template.html`
**Server:** `{skills_path}/shared/references/serve-backlog.js` (port 9876)
**Archive:** `.project/archive/backlog-archive.json` (shipped dev-track features — see § Archiving)

**Legacy format:** pre-migration projects embed the same JSON in `.project/backlog.html` inside `<script id="backlog-data">`. Readers fall back to it (see `BACKLOG-LOAD.md`); writers migrate first (see § Writing). Run `python3 {config_repo}/scripts/migrate-project.py <project-root>` to convert in one step.

## Live runtime data

`serve-backlog.js` injects one server-computed field into the JSON payload on every `GET /{project}/backlog` request:

- **`data.seedDrift[]`** — deferred seed-drift entries, written when a skill detects seed divergence without rewriting the seed inline (the user chose "Skip — leave seed as-is" at the Seed Alignment Check, or the drift hit `/project-todo`'s record-only path). Each entry: `{ category, seedSays, featureDecides, source, ref, detectedAt }` (see `shared/SEED.md § Alignment Check § Drift entry schema`). `category` ∈ `{ "contradiction", "new-direction", "scope-expansion" }`. `source` identifies the writing skill (`/project-plan`, `/project-todo`). Consumed by `/project-seed § Sync`, `/project-seed brainstorm`, and `/project-seed critique` on concept-scope save — first successful seed rewrite removes the processed entries. Optional; absent on backlogs that never deferred drift. Strip before saving if accidentally included in a payload.

## Reading the backlog

Read `.project/backlog.json` and parse as JSON. For PHASE 0 read-only access, prefer the extraction profiles in `BACKLOG-LOAD.md` / `GAME-BACKLOG-LOAD.md` over a full Read — they return only the fields needed and handle the legacy fallback.

**Data structure:**

```json
{
  "schemaVersion": 2,
  "project": "Project name",
  "generated": "2026-01-15",
  "updated": "2026-01-20",
  "source": "/project-plan",
  "overview": "Short description",
  "features": [
    {
      "name": "feature-name",
      "type": "FEATURE|CHANGE|BUG|API|INTEGRATION|UI|REFACTOR|PAGE|COMPONENT|THEME|A11Y|PERF|PAGE-GAP|SECURITY|TWEAK|VERIFY",
      "status": "TODO|DEFINED|DOING|DONE|CANCELLED",
      "phase": "P1|P2|P3|P4",
      "description": "Description",
      "source": "/project-plan",
      "dependencies": ["other-feature"],
      "risk": "1-5|null",
      "date": "2026-01-15|null",
      "auto": "true|null",
      "refactor": "REFACTORED|ROLLED_BACK|null",
      "summary": "<=200 chars, human-readable — set at ship time, see § Shipped summary",
      "knownIssues": [
        {
          "id": "REQ-003",
          "title": "...",
          "verdict": "deferred|accepted",
          "reason": "...",
          "source": "ship-ledger|dev-verify",
          "blocker": "<backlog-card-name>|null"
        }
      ],
      "hasDeferred": "true|null",
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

The `audit` field is **design-track-specific** (type `PAGE` or `COMPONENT`). `buildScreenshot`/`buildSmokeStatus`/`buildSmokeError` are written by `/design-convert` Build (smoke-render). `lastRun`/`scopes`/`findings` are written by `/design-ship`'s check phase. No field is required; consumers check for presence. PASS status can be derived from `findings.critical === 0` — no separate boolean needed.

## Description quality

The `description` field is the only planning context that survives until `/dev-ship` (define phase) / `/game-ship` (define phase) picks the card up — the define interview anchors its questions on it, and the conversation in which the feature was extracted is long gone by then. Every writer (`/project-plan`, `/project-todo`, `/team-issues`, discovery flows) applies the same norm:

- **Self-contained**: readable weeks later by a user who forgot the planning conversation. The card is the memory.
- **Concrete behavior**: what the user/player can observably do or see when this ships — never a noun phrase that restates the title. `user-dashboard` → not "Dashboard for users" but "Logged-in user sees an overview of their own listings with status and can archive from there."
- **Scope boundary**: when planning decided something is out of scope, deferred, or assumed, name it ("excludes admin stats", "assumes auth exists").
- **Decisions folded in**: answers from planning question-rounds (open-question resolutions, thinking rounds) that shape this feature land in the description — a decision that only lives in the planning chat is lost.
- **Length**: 1–3 sentences. Needing more usually means the feature is too large (split it) or the detail belongs in define, not on the card.

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

The `source` field on a backlog item indicates which skill created it. Convention: **always with leading slash**, e.g. `"/project-todo"`, `"/project-plan"`, `"/design-convert"`.

**Independent rule:** A feature is INDEPENDENT (never overwritten by `/project-plan` during rebuild) when `source` is set to anything other than `"/project-plan"`. Features without a `source` field, or with `"/project-plan"`, are concept-derived and managed by `/project-plan`.

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
- `/dev-ship` (define phase) and `/design-convert` copy to `feature.json`
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

| Status      | Label      | Set by                                                                                 |
| ----------- | ---------- | -------------------------------------------------------------------------------------- |
| `TODO`      | To design  | `/design-convert` Capture, `/project-todo`, `/project-plan`, reuse-discovery           |
| `DEFINED`   | To convert | `/design-convert` Brief (Path B — offline handoff)                                     |
| `DOING`     | Building   | `/design-convert` Build (Path A) or `/design-convert` Convert route (Path B)           |
| `DONE`      | Shipped    | `/design-ship` (PAGE PASS at PHASE 4) — both build and convert pages                   |
| `CANCELLED` | Archived   | Manually via UI (○ button), `/project-plan` update mode (cancel-proposal) — restorable |

**Path A** (Build with Claude Code): TODO → DOING → DONE — DEFINED is skipped.

**Path B** (Brief for external design): TODO → DEFINED → DOING → DONE.

`/design-ship` runs the runtime audit as its check phase and finalizes on PASS at PHASE 4: sets `lastCheckedSha`; for PAGE scope: sets `f.shipped = true` and `status: "DONE"`. A COMPONENT is never auto-`DONE` — it ships with the page/feature that consumes it. (The former release-cycle **batch** audit across all DOING features — the standalone `/design-check` — no longer exists; pages are checked per ship run.)

`/core-finalize` (and any PHASE Finalize via `shared/FINALIZE.md`) is a merge/cleanup step — it **never promotes `DOING` → `DONE`**. It only stamps `shipped`/`shippedSha` on a PAGE that is **already `DONE`**; a `DOING` PAGE stays at TO CHECK until `/design-ship` ships it, and a COMPONENT is left untouched. This mirrors dev-track, where `/dev-ship`'s verify phase never writes `shipped` — its refactor phase does.

### When to use which skill for PAGE/COMPONENT

| Situation                                               | Skill                                                                    |
| ------------------------------------------------------- | ------------------------------------------------------------------------ |
| Quick "just thought of something" addition              | `/project-todo`                                                          |
| Full design (screenshot, Figma, brief)                  | `/design-convert` Capture                                                |
| Bulk-init from concept or brainstorm output             | `/project-plan`                                                          |
| Pattern detection during build (cross-page reuse)       | `/project-plan` reuse-discovery                                          |
| Convert existing card from sketch/wireframe/Figma/Canva | `/design-convert` (paste sketch/URL, or board ⋯ → "Convert from sketch") |

All routes write the same JSON structure to `data.features[]` with `type=PAGE` or `COMPONENT` and `status=TODO`. All routes **except `/project-plan` bulk-init** also set **`transition: "designing"`**, which enables `/design-convert` to auto-detect these items without a manual dashboard click. `/project-plan` omits `transition` at creation — the dashboard sets it when the user clicks copy-prompt (see `project-plan/references/generate-backlog.md` transition field rule). `/design-convert` Capture adds extra spec fields (mock paths, brief, audit). Other routes leave those fields empty — `/design-convert` Build fills them in later.

### Dev track (FEATURE/API/UI/REFACTOR/BUG/etc.)

```
TODO (To define) → DEFINED (To build) → DOING (To verify) → DONE (To refactor) → shipped
                                                                  ↓ (manual)
                                                              CANCELLED (Archived)
```

| Status      | Label       | Set by                                                                                 |
| ----------- | ----------- | -------------------------------------------------------------------------------------- |
| `TODO`      | To define   | `/project-todo`, `/project-plan`                                                       |
| `DEFINED`   | To build    | `/dev-ship` (define phase — advanced internally)                                       |
| `DOING`     | To verify   | `/dev-ship` (build phase — advanced internally)                                        |
| `DONE`      | To refactor | `/dev-ship` (verify phase — advanced internally)                                       |
| `CANCELLED` | Archived    | Manually via UI (○ button), `/project-plan` update mode (cancel-proposal) — restorable |

**Optional fields on CANCELLED items**: `cancelledReason` (one-line why, set by skill-driven cancellations) and `cancelledAt` (`YYYY-MM-DD`, set by the dev/game Impact-Check cancellation flows). UI cancellations omit both. Archived features (see § Archiving) can also carry `status: "CANCELLED"` — history stays, flagged.

`/dev-ship`'s refactor phase is the **promotion trigger** for dev-cards: after CLEAN or REFACTORED it sets `f.shipped = true` + `f.shippedAt` + `f.shippedSha` + `f.summary`, then **moves the feature object to the archive** (see § Archiving). Shipped items leave the backlog data and appear on the Dashboard via the archive.

## Shipped summary (`f.summary`)

Written once, at the same atomic write as `f.shipped` — never edited afterwards. This is the dashboard shipped-card headline (see `shared/DASHBOARD-PROJECT.md § Shipped showcase`): a ≤200-char human-readable line covering what shipped and why it's worth remembering, derived from `f.description` folded with the single most notable `APPLY` decision from `feature.json#build.decisions[]` / `#refactor.decisions[]` (see `dev-ship/references/dev-refactor/references/completion-batch.md § Step 3`). No notable decision, or a small item without a `feature.json` pipeline → `f.summary = f.description` verbatim. The full decision/observation detail behind the headline stays in `feature.json` — the dashboard card-detail view reads it live from there, not from a copy on the backlog entry.

## Archiving (shipped dev-track features)

At scale, shipped features become dead weight for every backlog load (measured: 54% of the data on a 150-feature project). Dev-track features therefore move out of `backlog.json` when they ship:

- **File:** `.project/archive/backlog-archive.json` — `{ "schemaVersion": 2, "archived": [ <full feature objects> ] }`
- **Writer:** `/dev-ship` (refactor phase) and `/game-ship` (refactor phase) — in the same sync that sets `shipped: true`, remove the feature object from `backlog.json#features[]` and append it to `archived[]` (create the file with the scaffold above if absent). Mirrors the existing `.project/features/archive/` dir convention.
- **Readers:** the dashboard shipped-showcase (server merges `archived[]` into the served features view, in-memory) and humans. Pipeline skills never need archived features — that is the point.
- **Design-track exception:** PAGE/COMPONENT features shipped by `/design-ship` **stay in `backlog.json`** — the `lastCheckedSha`/`shippedSha` fields let a later re-ship detect that the page changed after shipping. Only dev-track (non-PAGE/COMPONENT) features archive.
- **Restore:** move the object back to `features[]` manually (or via board UI in a future iteration); idempotent in both directions.

**`f.shipped` field:**

| Value             | Meaning                                               |
| ----------------- | ----------------------------------------------------- |
| `false` / missing | Waiting for next step — visible in the active section |
| `true`            | Promoted to Dashboard — no longer visible in backlog  |

### UI: dual-track swimlanes

The backlog board is **ship-only**: `/dev-ship`, `/design-ship`, and `/game-ship` run the whole pipeline in one flow, so there are no intermediate resting columns. All ship-skills set `transition: "shipping"` on the feature and keep the card in the **In progress** section for the entire run; on completion they set `shipped: true`, which removes it from the board. Track pills (`All | Design | Dev`) at the top filter by track. Within each section, features are grouped by phase (P1/P2/P3/P4).

```
  ▾ To do        (all TODO — both tracks)
  ▾ In progress  (transition: "shipping" or a live skill signal, either track)
  ▾ Archived     (CANCELLED — shared, collapsed)
```

The former resting columns — dev's **To build** (DEFINED) / **To verify** (DOING) / **To refactor** (DONE), and design's **To convert** (DEFINED) / **To check** (DOING) — no longer render: those statuses are transient internal states a ship-run passes through while the card sits in **In progress**. The underlying status field still moves TODO → DEFINED → DOING → DONE (see the status table above); only the board columns collapsed. DONE+`shipped: true` (both tracks) move to the Dashboard.

## TWEAK cards

`type: "TWEAK"` is a dev-track type for a small improvement offloaded from a ship's verify/manual round (`shared/TWEAK-DISCIPLINE.md`, `dev-ship/references/phase-3-manual-finalize.md § Findings ledger + routing`), or added ad hoc via `/project-todo`. Semantics: "works, but I want it different" — never a `fail`-class finding (the hard policy — a `fail` never leaves a ship via a backlog todo — is unchanged).

- **Dependency**: a ship-offloaded TWEAK card always carries `dependencies: ["{feature}"]` — the parent feature it was observed against. This isn't cosmetic bookkeeping: `/dev-tweak` warns before picking up a card whose dependency hasn't shipped yet, because the tweak targets code that may not be on `main`.
- **Lifecycle**: `TODO → shipped` directly — a TWEAK card never enters `DEFINED`/`DOING`/`DONE` and never runs through a ship pipeline. `/dev-tweak {card-name}` executes it on `main` (no worktree) and flips it straight to `shipped: true` + archive on completion (`shared/TWEAK-DISCIPLINE.md § Card pickup`).
  - **Escalation exception**: when a tweak run escalates and hands the card off to `/dev-ship` (`shared/TWEAK-DISCIPLINE.md § Escalation gate` (b)), the card leaves the TWEAK lifecycle instead — `dev-ship`'s define phase overwrites its `type` away from `TWEAK` in the same write that sets `status: "DEFINED"` (`dev-ship/references/dev-define/references/phase4-sync.md` § TWEAK promotion), so it never sits as `type: "TWEAK"` + `status: "DEFINED"`. From that point it is an ordinary feature card and follows the normal `TODO → DEFINED → DOING → DONE → shipped` track.
- **Track**: dev-track (not in `DESIGN_TYPES`/`DESIGN_PIPELINE_TYPES` — the track filter and board sections treat it like any other dev-track type).
- **Game equivalent**: `POLISH` already covers this case on the game side — there is no `TWEAK` type in the GAME inference table (`project-todo/references/inference-rules.md`). The same escalation exception applies: `/game-ship`'s define phase promotes a `type: "POLISH"` card away from `POLISH` on handoff (`game-ship/references/game-define/references/phase5-sync.md` § POLISH promotion).

## VERIFY cards

`type: "VERIFY"` is a dev-track type for re-running a **deferred** manual/playtest test after its external blocker has cleared — a verification action, not a code change (unlike TWEAK, it never touches product code). Named `verify-{feature}` — one card aggregates all of that feature's open deferred items.

- **Writer**: `scripts/completion-sync.js`, automatic — created/updated whenever a completion-sync payload carries a `knownIssues[]` entry with `verdict: "deferred"` (see § Known-issue badges). Never created by hand-authored prose; both the ship-walkthrough path (`dev-ship/references/phase-3-manual-finalize.md § Known-issue payload`, `game-ship/references/phase-3-playtest.md`) and the standalone `/dev-verify` path converge on this one script, so capture never drifts between them.
- **Dependency**: `dependencies[]` holds the `blocker` name(s) named on the triggering knownIssues entries (only names that exist in `backlog.json#features[]` — an unresolvable blocker name stays in the description text only). The board's existing "BLOCKED BY" chip renders it; the chip clears once the blocker feature ships (chips resolve against archived shipped features too).
- **Lifecycle**: `TODO → shipped` directly — a VERIFY card never enters `DEFINED`/`DOING`/`DONE` and never runs through a ship pipeline.
- **Pickup**: `/dev-manual {feature}` — when no open ship run exists for `{feature}` but a live `verify-{feature}` card does, `/dev-manual` runs a short deferred-reverify round instead of refusing (`dev-manual/references/deferred-reverify.md`). Game side: no `dev-manual` equivalent exists yet — pick up via `/game-ship {feature}` re-entry.
- **Completion write**: mirrors TWEAK's card-mode completion (`shared/TWEAK-DISCIPLINE.md § Card pickup`) — only once every deferred item on the card re-verifies (PASS or converts to a BUG card on FAIL): `shipped: true` + `shippedAt` + `shippedSha` + `summary`, archived to `backlog-archive.json#archived[]`, dual-write to `project.json#features[]`. A card with items still `"Still blocked"` gets no completion write and stays `TODO` for a later pickup.
- **Track**: dev-track (not in `DESIGN_TYPES`/`DESIGN_PIPELINE_TYPES`).

## Refactor-badges

Items with `status === "DONE"` that have not yet shipped render in the **In progress** section (a ship-run holds them there via `transition: "shipping"`); once shipped they appear in the Dashboard showcase. In both places they show a badge reflecting the refactor outcome:

| `f.refactor` value | Badge  | Meaning                                                                       |
| ------------------ | ------ | ----------------------------------------------------------------------------- |
| `null` / missing   | (none) | Refactor not yet run — feature is a refactor candidate                        |
| `"REFACTORED"`     | ✓      | Refactor completed (CLEAN analysis and REFACTORED both counted here)          |
| `"ROLLED_BACK"`    | ⚠      | Refactor attempted, rolled back (see `feature.json.refactor.failureAnalysis`) |

`/dev-ship`'s refactor phase writes this field on both `feature.json` and the backlog feature in the same sync. On CLEAN or REFACTORED, `f.shipped = true` also follows and the item moves to the Dashboard.

> **Invariant:** `f.refactor === "REFACTORED"` implies `f.shipped === true` + feature absent from `backlog.json#features[]` + feature present in `backlog-archive.json#archived[]` + feature-dir under `features/archive/`. A `refactor`-without-`shipped` state is invalid — `/dev-ship`'s refactor phase must detect and self-heal this before completing (see `dev-ship/references/dev-refactor/workflow.md`).

## Known-issue badges

A ship run's manual/playtest ledger can end an item with `verdict: "accepted"` (explicit "Accept
anyway" at a debug-ladder ceiling or a non-converging tweak loop) or `verdict: "deferred"` (external
blocker, or a `/dev-verify` DEFERRED item) — see `shared/SHIP-CHECKPOINT.md`'s `manual.items[]`
schema comment for the full distinction. That ledger lives in the session checkpoint and is deleted
on green completion, so `scripts/completion-sync.js` folds any such items into a durable
`f.knownIssues[]` array at completion-sync time — same moment `f.status` flips to `DONE`:

```json
"knownIssues": [
  {
    "id": "REQ-003",
    "title": "Empty-state spacing off by 4px",
    "verdict": "deferred",
    "reason": "cosmetic, external design review pending",
    "source": "ship-ledger",
    "blocker": "dev-server-lan-allowed-origins"
  }
]
```

| Field     | Meaning                                                                                                                       |
| --------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `id`      | The REQ/checklist/ledger item id this outcome belongs to                                                                      |
| `title`   | Short human-readable summary                                                                                                  |
| `verdict` | `"deferred"` \| `"accepted"` — never a third value; orthogonal to `f.status`                                                  |
| `reason`  | Free text — why it was accepted/deferred                                                                                      |
| `source`  | `"ship-ledger"` (dev-ship/game-ship manual/playtest walkthrough) \| `"dev-verify"` (a standalone `/dev-verify` DEFERRED item) |
| `blocker` | Optional — the name of an existing backlog card that must ship first before this item is re-testable                          |

Optional; absent when a ship completed with no accepted/deferred items. Rendered on the dashboard
card as a `⚠ N known issue(s)` badge regardless of `f.status` (unlike the refactor-badge, it is not
gated to DONE — a known issue can persist through shipping), expandable to list each item's title,
verdict, and reason. Survives archiving: carried verbatim when the feature object moves to
`backlog-archive.json#archived[]` (same as `refactor`/`summary`).

**A `verdict: "deferred"` entry is not just a badge.** `scripts/completion-sync.js` also (1) sets
`hasDeferred: true` on both `feature.json#tests` and the backlog entry, and (2) auto-creates/updates
a `verify-{feature}` VERIFY card (`dependencies` = any valid `blocker` names) — see § VERIFY cards
below. `"accepted"` entries never do this; they remain badge-only, permanently. On a later re-verify
PASS (`/dev-manual`'s deferred-reverify round), the deferred entry is removed from `knownIssues[]`
(badge and VERIFY card retire together); a re-verify FAIL instead converts it into a `BUG` card and
removes the deferred entry (the BUG card supersedes it).

## COMPONENT as first-class type

`type: "COMPONENT"` is a first-class backlog type alongside `PAGE`, `FEATURE`, `API`, etc. COMPONENT features live on the **Design track** — together with PAGE — and go through the design pipeline.

### Creating

COMPONENT todos are created by:

- `/design-convert` Component-route (explicit user input)
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
  "source": "/design-convert",
  "scope": "atomic",
  "dependencies": []
}
```

**`pageHint` field** (optional, on any FEATURE/API/etc. type): list of PAGE names this feature surfaces on. Set by `/dev-ship` (define phase) during requirements sparring. Read by `/design-convert` Build to pre-populate the page-composition selection menu.

```json
{ "name": "cart-total", "type": "FEATURE", "pageHint": ["checkout", "cart"] }
```

**Bidirectional link convention:** PAGE task `dependencies[]` ↔ FEATURE `pageHint[]`. When `/design-convert` Build composes a PAGE, it writes the selected feature names into `page.dependencies[]`. When `/dev-ship` (define phase) spars on page placement, it writes the page name(s) into `feature.pageHint[]`.

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

| Step    | Skill             | Output                                                             |
| ------- | ----------------- | ------------------------------------------------------------------ |
| Design  | `/design-convert` | code (Build) or brief (Brief) + demo-page for COMPONENT            |
| Convert | `/design-convert` | code from visual input — Convert route (Path B)                    |
| Audit   | `/design-ship`    | check phase: A11Y + tokens + responsive — terminal, sets `shipped` |

**`/design-ship`'s check PASS is terminal** — no refactor step. Item ships directly to Dashboard.

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

| Value          | Dashboard sets when user copies prompt for                                                                                       | Consumed by                              |
| -------------- | -------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------- |
| `"defining"`   | THEME setup prompt                                                                                                               | `design-tokens` (THEME)                  |
| `"designing"`  | Design/build prompt for a TODO PAGE or COMPONENT                                                                                 | `design-convert`                         |
| `"converting"` | Convert prompt for a DEFINED PAGE or COMPONENT                                                                                   | `design-convert`                         |
| `"contenting"` | Fill-content prompt for a built (DOING) PAGE/COMPONENT                                                                           | `design-content`                         |
| `"shipping"`   | ⚡ Ship (auto) menu item on a TODO feature — dev-track → `/dev-ship`, game-track → `/game-ship`, PAGE/COMPONENT → `/design-ship` | `dev-ship` / `game-ship` / `design-ship` |

On successful completion the skill removes the `transition` field. **Exception**: `"shipping"` is
a whole-run marker — the ship sub-phase syncs (the copies under `dev-ship/references/`,
`game-ship/references/`, and `design-ship/references/`) preserve it; only the ship skill's own
completion (dev-ship: refactor's completion-batch or PHASE 5 cleanup; game-ship: PHASE 5 cleanup;
design-ship: PHASE 4 completion or PHASE 5 cleanup) removes it. No-arg pickup is disambiguated by
type: `design-ship` picks `"shipping"` on PAGE/COMPONENT, while a non-design (FEATURE) type routes to
`dev-ship` in a dev project and `game-ship` in a game project (dev-ship vs game-ship is disambiguated
by project type — a project is one or the other).

**Board rendering (four progress states).** The dashboard shows a `transition` without a live
skill signal as **queued** (dim, "⧉ {transition} · queued"), a feature with a
`.project/session/active-{name}.json` signal as **live** (pulsing "{skill}ing" badge), and a live
signal with the optional `waiting` field as **waiting for input** (amber, static
"⏸ {label} · input needed" — sorted to the top; written by dev-ship's manual walkthrough (PHASE 3),
game-ship's playtest wait (PHASE 3), and design-ship's PHASE 4 review). The fourth state is
**parked**: a ship checkpoint (`.project/session/ship-{name}.json` — see `SHIP-CHECKPOINT.md`) with
`status != "complete"` and **no** live signal for that feature. Because the checkpoint survives a full
session end (unlike `active-*.json`), it renders across sessions as an amber, static
"⏸ {label} · parked" row (`plan approval pending` at the plan gate, `manual tests pending` /
`playtest pending` / `review pending` at the interactive phase, `interrupted at {phase}` otherwise,
`failed at {phase}` on a failed run). Its action is a **copy button carrying the
`/{pipeline}-ship {name}` resume command** (one-click resume), not a live dot. Live/waiting wins over
parked for the same feature; the parked row disappears when the run resumes (a live signal returns)
or completes (the checkpoint is removed). All four group in the IN PROGRESS section at the top of the
board. See `DEVINFO.md § Active Feature Signal`.

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

The GAME pipeline's standalone skills use `transition` values `"defining"` / `"building"` / `"verifying"` / `"refactoring"`; `/game-ship` runs the whole game flow end-to-end via `"shipping"` (dev-track features likewise run through `/dev-ship` via `"shipping"`). The DESIGN pipeline (PAGE/COMPONENT) uses `"designing"` / `"converting"` / `"contenting"` — same pattern, different vocab. There is no `"auditing"` transition — the runtime audit runs as the check phase inside `/design-ship`, not as a separate per-item skill.

| Skill            | Filter                                                                                     | New status on success                           |
| ---------------- | ------------------------------------------------------------------------------------------ | ----------------------------------------------- |
| `design-tokens`  | `type === "THEME" && transition === "defining"`                                            | `"DONE"`                                        |
| `dev-ship`       | `transition === "shipping" && type !== PAGE/COMPONENT` (no-arg pickup)                     | full pipeline → `shipped: true` via refactor    |
| `design-convert` | `(type === "PAGE" \|\| type === "COMPONENT") && transition === "designing"`                | `"DOING"` (Path A — DEFINED is skipped)         |
| `design-convert` | `(type === "PAGE" \|\| type === "COMPONENT") && transition === "converting"`               | `"DOING"`                                       |
| `design-content` | `(type === "PAGE" \|\| type === "COMPONENT") && transition === "contenting"`               | keep `"DOING"`, sets `contentStatus: "filled"`  |
| `design-ship`    | `(type === "PAGE" \|\| type === "COMPONENT") && transition === "shipping"` (no-arg pickup) | full pipeline → PAGE `"DONE"` + `shipped: true` |
| `game-ship`      | `transition === "shipping" && type !== PAGE/COMPONENT` (game project; no-arg pickup)       | full pipeline → `shipped: true` via refactor    |

---

## Impact Check (consumer protocol)

The backlog is living state: crystallizing one feature's scope can absorb or invalidate other open items — a REQ that already ships what another card asks for, or a design choice that removes a card's reason to exist. This check catches that drift at the moment it is created, instead of months later during a board cleanup. It mirrors `shared/SEED.md § Alignment Check` (seed drift ↔ backlog drift).

### Skip condition

`BACKLOG_NOT_PRESENT` or `BACKLOG_NO_OPEN_ITEMS` from the `open-items` load ([BACKLOG-LOAD.md § open-items](BACKLOG-LOAD.md)) → log nothing, continue.

### Impact scan

Compare this feature's crystallized scope — REQ descriptions + `acceptance[]` + `clarifications[]` + `durableDecisions[]` — against each open item from the `open-items` list. Classify only high-confidence semantic matches:

- **covered** — this feature's requirements fully implement the item's described behavior (item `dark-mode-toggle` while REQ-004 already ships a theme switcher)
- **partial** — concrete overlap; the item's remaining scope shrinks (this feature does part of it, the item keeps the rest)
- **obsolete** — a decision made here removes the item's reason to exist (clarification chose hosted auth → item `build-own-auth` is dead)

Skip thematic adjacency ("both touch settings") — flag only when a concrete REQ or decision maps onto the item's described behavior. Items with status `DOING`/`DONE`/shipped and design-track items (PAGE/COMPONENT/THEME) are never flagged — the `open-items` profile already excludes them.

### Reporting

**No impact:** log `Backlog: ✓ open items unaffected` (one line inline), continue.

**Impact detected:** log `Backlog: ⚠ impact — N item(s)` inline. Write the impact table to the plan file (or inline in chat if the skill is not in plan mode):

| #   | Item             | Verdict  | Because                                             |
| --- | ---------------- | -------- | --------------------------------------------------- |
| 1   | dark-mode-toggle | covered  | REQ-004 ships the theme switcher this card asks for |
| 2   | build-own-auth   | obsolete | clarification chose hosted auth (Clerk)             |
| 3   | user-settings    | partial  | REQ-002 covers profile edit; notifications remain   |

### Resolution prompt

```yaml
header: "Backlog impact"
question: "This feature affects {N} open backlog item(s) — apply the proposed updates?"
options:
  - label: "Yes, apply all (Recommended)", description: "Covered/obsolete items → CANCELLED (restorable); partial items → description rescoped"
  - label: "Select per item", description: "Choose which verdicts to apply"
  - label: "No, leave backlog as-is", description: "No mutations — verdicts are dropped"
multiSelect: false
```

**Select per item** → follow-up `AskUserQuestion` (multiSelect, ≤4 items per question) listing each flagged item with its verdict; only selected items carry forward.

### Mutations (applied in the consumer skill's sync phase — never inside plan mode)

Approved verdicts travel to the sync phase as `backlogImpact[]` (`{ name, verdict, because, ref }`) and are applied in the same backlog write-batch as the skill's own status flip:

| Verdict                | Mutation                                                                                                                                                                                        |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `covered` / `obsolete` | `status: "CANCELLED"`, `cancelledReason: "superseded by {feature}: {REQ-ids or decision}"`, `cancelledAt: <YYYY-MM-DD>`, remove `transition` — restorable via the board's archived section      |
| `partial`              | Rewrite `description` per § Description quality — state only the remaining scope and name the boundary ("remaining after {feature}: …"); add `{feature}` to the item's `dependencies[]` (dedup) |

Guard rails:

- **`externalRef` items are report-only** — the external tracker owns them. Surface the finding ("close/rescope via the tracker or `/team-outsource`") but never mutate the item.
- A cancelled `DEFINED` item already has `.project/features/{name}/feature.json` — leave the folder in place (history), mention it in the log line.
- Log line after sync: `Backlog: ✓ impact applied — {N} cancelled, {M} rescoped` (append ` · {K} external — report-only` when applicable).

### Designated impact points

| Skill        | Impact point                                                                               | Plan mode? |
| ------------ | ------------------------------------------------------------------------------------------ | ---------- |
| `/dev-ship`  | Define phase — end of PHASE 2 Architecture, directly after the Seed Alignment Check        | Yes        |
| `/game-ship` | Define phase — end of PHASE 3 Architecture Design, directly after the Seed Alignment Check | Yes        |

`/design-ship` inherits the check via its copied define workflow — no separate integration.
