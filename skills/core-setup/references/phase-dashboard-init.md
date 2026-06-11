# Dashboard Init (greenfield Phase 7b)

**Inputs**: `PROJECT_NAME`, `PROJECT_PITCH` (Phase 2 answers or seed preflight), `TEAM_MODE` (Phase 2 step 0.5), stack answers (Phase 2 Q3-Q5), generated package.json (Phase 3).

**Goal:** Create `.project/project.json` as the first dashboard file for this project. core-setup is the first skill to run — all later skills build on this.

See `{skills_root}/shared/DASHBOARD.md` for the full schema and merge strategies (found via `find ~/.claude -name DASHBOARD.md` or in the claude-config repo).

**Steps:**

1. First check if `.project/project.json` already exists (e.g. from an initial commit). If yes: read + merge instead of overwriting. If no: create with the full empty schema from `shared/DASHBOARD.md`
2. Fill `seed` section (preferred: markdown file, not inline):
   - `name`: project name — use existing `seed.name` if filled, otherwise from user answers; do NOT overwrite if already filled
   - `pitch`: 1-2 sentence summary — use existing `seed.pitch` if filled, otherwise from user answers; do NOT overwrite if already filled
   - `seedFile`: `"project-seed.md"` — reference to the markdown file
   - `content`: empty string `""` — NEVER also fill inline alongside `seedFile`
   - Concept-md handling:
     - **`.project/project-seed.md` exists with > 50 chars**: do NOT overwrite, do NOT append. The supplemental description from Phase 2 step 0 "Supplement" stays in-memory — only `/project-seed` writes to disk.
     - **Does not exist or < 50 chars**: create with `PROJECT_PITCH` (from Phase 2 answers or preflight) as plain markdown (what the project does, who for, core functionality). Does not need to be extensive — thinking/plan skills will expand this later.
3. Fill `team.mode` using the answer from Phase 2 step 7:
   - `"solo"` or `"team"` depending on `TEAM_MODE`.
   - If `.project/project.json` already existed and already has `team.mode` set → keep existing value (do NOT overwrite; user may have toggled via UI).
4. Fill `stack` section fully (OVERWRITE — core-setup is the first skill):
   - `framework`: from user answers (Phase 2 Q3/Q4)
   - `language`: from user answers (Phase 2 Q4)
   - `styling`: from user answers (Phase 2 Q4/Q5)
   - `db`: from user answers (Phase 2 Q4/Q5)
   - `auth`: from user answers (Phase 2 Q4/Q5)
   - `hosting`: from user answers (Phase 2 Q4/Q5)
   - `packages`: from generated package.json / project files
5. Write `.project/project.json`
   5b. Init backlog with seed flag (all project types):
   - If `.project/backlog.json` does not exist: create it with the schemaVersion-2 scaffold (see `shared/BACKLOG.md`)
   - Read `.project/backlog.json` → parse JSON
   - Set `data.flags = { "hasSeed": true, "seedPath": ".project/project-seed.md" }`
   - Set `data.source = "/core-setup"` and `data.updated` to current date
   - Write the JSON back to `.project/backlog.json`
   - This makes the `/project-backlog` button appear in the backlog dashboard once there is a concept but no features yet.
6. Create `.project/project-context.json` with `context` section (initial, updated by build/refactor skills):
   - `context.structure`: file tree of project (same format as previously in CLAUDE.md). Generate from actual file tree after Phase 3/4
   - `context.routing`: route patterns with arrow notation (only web projects with routing, otherwise empty array)
   - `context.patterns`: non-obvious patterns discovered during setup (path aliases, env config, etc.)
   - `context.updated`: current date
   - Write `.project/project-context.json`
7. Set skip-worktree on all `.project/` files so local changes do not disturb git status/pull:

   ```bash
   git add --sparse .project/
   git ls-files .project/ | xargs git update-index --skip-worktree
   ```

   Staging first is required — `update-index --skip-worktree` only works on files that are in the index.

**Output:**

```
DASHBOARD CREATED

Project: {name}
Stack: {framework} / {language}
Packages: {N} packages
```

When done: return to Phase 7c.
