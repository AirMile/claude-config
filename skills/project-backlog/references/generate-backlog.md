# PHASE 4: Generate Backlog

**Goal:** Write the interactive HTML kanban backlog.

**Refer to `shared/BACKLOG.md` for the full data format.**

1. **Template or merge:**
   - **Create mode**: Copy template from `{skills_path}/shared/references/backlog-template.html` → `.project/backlog.html`. Create `.project/` if it does not exist.
   - **Update mode**: Read existing `.project/backlog.html`, parse the current JSON block. Do NOT copy the template again — update in-place.

2. **Build the JSON data object:**

   **[WEB MODE]:**

   ```json
   {
     "project": "{Project Name}",
     "generated": "{YYYY-MM-DD}",
     "updated": "{YYYY-MM-DD}",
     "source": "/project-backlog",
     "overview": "{Brief description from source}",
     "features": [
       {
         "name": "{feature-name}",
         "type": "FEATURE|API|INTEGRATION|UI|REFACTOR|PAGE|COMPONENT|PAGE-GAP",
         "status": "TODO",
         "transition": "designing",
         "phase": "P1|P2|P3|P4",
         "description": "{description}",
         "source": "/project-backlog",
         "dependencies": ["{other-feature}"],
         "risk": "{1-5 from PHASE 1 risk-score}"
       }
     ],
     "notes": "{Any notes or considerations}"
   }
   ```

   **`transition` field rule:** only set `transition: "designing"` on items with `type === "PAGE"` or `type === "COMPONENT"`. All other types (FEATURE, API, etc.) must have `transition` absent — the dashboard sets it when the user copies the define/build prompt.

   **[GAME MODE]:**

   ```json
   {
     "project": "{Project Name}",
     "generated": "{YYYY-MM-DD}",
     "updated": "{YYYY-MM-DD}",
     "source": "/project-backlog",
     "overview": "{Brief description from source}",
     "features": [
       {
         "name": "{feature-name}",
         "type": "CORE|MECHANIC|CONTENT|POLISH|UI",
         "status": "TODO",
         "phase": "P1|P2|P3|P4",
         "description": "{description}",
         "source": "/project-backlog",
         "dependencies": ["{other-feature}"]
       }
     ],
     "notes": "{Any notes or considerations}"
   }
   ```

   **[WEB MODE] Sort `features[]` to match the PHASE 2 suggested order:**
   1. **Group by `phase`** in order: P1 → P2 → P3 → P4
   2. **Within each phase, apply topological sort** based on `dependencies[]`:
      - Features with `dependencies: []` first (within that phase)
      - Then features whose all dependencies appear earlier in the array
      - Cross-phase dependencies (e.g. P2-feature depending on P1-feature) are automatically correct: P1 is already before P2
   3. **Tie-breaker** within the same topological "layer": preserve the order from PHASE 1 (extraction order)

   **[WEB MODE] In update mode, apply merge rules:**
   - For each existing backlog feature: preserve `status`, `stage`, `phase`, `date` from the current backlog
   - For MODIFIED features (TODO status): update `description` and `type` from new extraction
   - For MODIFIED features (DOING/DONE status): only enrich `description` if concept adds new insights — never overwrite
   - For NEW features: add with `status: "TODO"`, `stage: null`, `source: "/project-backlog"`
   - For DEPRECATED features: keep in the array but set `status: "DEPRECATED"`
   - For MODIFIED features: preserve existing `source` field; set `"/project-backlog"` only if missing
   - Set `updated` to current date, keep original `generated` date
   - INDEPENDENT features (added outside project-backlog): always preserve intact

3. **Replace the JSON block** in the template:
   - Find: `<script id="backlog-data" type="application/json">...</script>`
   - Replace the content between the tags with the built JSON object

4. **Start backlog server** (if not already running):

   ```bash
   # Respects $CLAUDE_PROJECTS_ROOT via lib/config.js (fallback: ~/projects)
   curl -s http://localhost:9876/ > /dev/null 2>&1 || nohup node --watch ~/.claude/skills/shared/references/serve-backlog.js > /tmp/backlog-server.log 2>&1 &
   ```

5. **Seed mutations** (parallel with dashboard update):
   - **If `seedUpdateApproved: true`:** Write the rewritten content (from the plan file's `## Proposed seed update` section, reviewed in plan mode) to `.project/project-seed.md` — full file overwrite. Update `project.json#concept.pitch` if the new pitch differs; update `concept.name` only if H1 title changed. Log: `Seed: ✓ updated — N section(s) rewritten`.
   - **If `seedUpdateApproved: false` AND `seedDrift[]` non-empty:** Write drift entries into the backlog JSON data object as `data.seedDrift[]` (merge with existing entries if any). Each entry follows the schema from `shared/SEED.md` § Drift entry schema.
   - **If no drift detected:** skip silently.

6. **Update project dashboard** (see `shared/DASHBOARD.md`):

   If concept info is available from input:
   1. Read `.project/project.json` (or create new with empty schema)
   2. Fill `concept` section with name, description, goals, audience, scope — **OVERWRITE**
   3. **[WEB MODE]** Also fill `stack` section with detected framework, language, DB, etc. — only if fields are empty
   4. Write `.project/project.json`

**Output:**

**[WEB MODE]:**

```
BACKLOG CREATED

File: .project/backlog.html
Dashboard: .project/project.json (concept + stack)
Server: http://localhost:9876/{project-dir}

| Priority | Features |
|----------|----------|
| P1       | {count}  |
| P2       | {count}  |
| P3       | {count}  |
| P4       | {count}  |
| Total    | {count}  |

View backlog:  /project-viewer
Start building: /dev-define {first-P1-feature}
```

**[GAME MODE]:**

```
BACKLOG CREATED

File: .project/backlog.html
Dashboard: .project/project.json (concept)
Server: http://localhost:9876/{project-dir}

| Priority | Features |
|----------|----------|
| P1       | {count}  |
| P2       | {count}  |
| P3       | {count}  |
| P4       | {count}  |
| Total    | {count}  |

View backlog:  /project-viewer
Start building: /game-define {first-P1-feature}
```
