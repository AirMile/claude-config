# PHASE 4: Generate Backlog

**Goal:** Write the backlog JSON data store — the server renders the kanban board from the template + this data.

**Refer to `shared/BACKLOG.md` for the full data format.**

1. **New or merge:**
   - **Create mode**: Start a fresh data object (step 2). Create `.project/` if it does not exist. No template copy — the server owns presentation.
   - **Update mode**: Read existing `.project/backlog.json`, parse JSON — update in-place.

2. **Build the JSON data object:**

   ```json
   {
     "schemaVersion": 2,
     "project": "{Project Name}",
     "generated": "{YYYY-MM-DD}",
     "updated": "{YYYY-MM-DD}",
     "source": "/project-plan",
     "overview": "{Brief description from source}",
     "features": [
       {
         "name": "{feature-name}",
         "type": "{see mode note}",
         "status": "TODO",
         "phase": "P1|P2|P3|P4",
         "description": "{description}",
         "source": "/project-plan",
         "dependencies": ["{other-feature}"],
         "risk": "{1-5 from PHASE 1 risk-score — WEB MODE only, omit in game mode}"
       }
     ],
     "notes": "{Any notes or considerations}"
   }
   ```

   **`type` enum per mode:** WEB — `FEATURE|API|INTEGRATION|UI|REFACTOR|PAGE|COMPONENT|PAGE-GAP` · GAME — `CORE|MECHANIC|CONTENT|POLISH|UI`.

   **`transition` field rule:** NEVER write `transition` in the initial backlog data — regardless of feature type. The dashboard sets `transition` dynamically when the user clicks the copy-skill button on a card, and clears it when the cancel button is used. Pre-setting it makes cards appear "actively in progress" before any user action and replaces the copy button with a cancel button, breaking the entry-point UX.

   **[WEB MODE] Sort `features[]` to match the PHASE 2 suggested order:**
   1. **Group by `phase`** in order: P1 → P2 → P3 → P4
   2. **Within each phase, apply topological sort** based on `dependencies[]`:
      - Features with `dependencies: []` first (within that phase)
      - Then features whose all dependencies appear earlier in the array
      - Cross-phase dependencies (e.g. P2-feature depending on P1-feature) are automatically correct: P1 is already before P2
   3. **Tie-breaker** within the same topological "layer": higher `risk` first (build/validate the uncertain features — external APIs, native modules — earliest), then PHASE 1 extraction order

   **[WEB MODE] In update mode, apply merge rules:**
   Merge-rule canon (DOING/DONE protected, MODIFIED-TODO update, obsolete → cancel-proposal flow, INDEPENDENT preserve): `input-detection.md` § "Update backlog" + `update-reconcile.md`. Write-level specifics on top: preserve `status`/`stage`/`phase`/`date` from the current backlog; NEW features get `status: "TODO"`, `stage: null`, `source: "/project-plan"`; MODIFIED features keep their existing `source` (set `"/project-plan"` only if missing); user-confirmed cancellations stay in the array with `status: "CANCELLED"` + `cancelledReason`; set `updated` to current date, keep original `generated`.

3. **Write the data store:**
   - Serialize the built data object (`JSON.stringify(data, null, 2)`) → Write to `.project/backlog.json`

4. **Start backlog server** (if not already running):

   ```bash
   # Respects $CLAUDE_PROJECTS_ROOT via lib/config.js (fallback: ~/projects)
   curl -s http://localhost:9876/ > /dev/null 2>&1 || nohup node --watch ~/.claude/skills/shared/references/serve-backlog.js > /tmp/backlog-server.log 2>&1 &
   ```

5. **Seed mutations** (parallel with dashboard update):
   - **If `seedUpdateApproved: true`:** Source content: plan file's `## Proposed seed update` section. Apply all writes per [shared/SEED.md § Write targets](../../shared/SEED.md#write-targets-sync-phase) — that table is canonical for file set and log line.
   - **If `seedUpdateApproved: false` AND `seedDrift[]` non-empty:** Write drift entries into the backlog JSON data object as `data.seedDrift[]` (merge with existing entries if any). Each entry follows the schema from `shared/SEED.md` § Drift entry schema.
   - **If no drift detected:** skip silently.

6. **Update project dashboard** (see `shared/DASHBOARD.md`):

   If concept info is available from input:
   1. Read `.project/project.json` (or create new with empty schema)
   2. Fill `concept` section with name, description, goals, audience, scope — **OVERWRITE**
   3. **[WEB MODE]** Also fill `stack` section with detected framework, language, DB, etc. — only if fields are empty
   4. Write `.project/project.json`

**Output** (both modes — `{dev|game}` per mode; "(+ stack)" only in web mode):

```
BACKLOG CREATED

File: .project/backlog.json
Dashboard: .project/project.json (concept{ + stack})
Server: http://localhost:9876/{project-dir}

| Priority | Features |
|----------|----------|
| P1       | {count}  |
| P2       | {count}  |
| P3       | {count}  |
| P4       | {count}  |
| Total    | {count}  |

View backlog:  /project-app
Start building: /{dev|game}-define {first-P1-feature}
```
