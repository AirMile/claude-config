# Dashboard Init (greenfield Phase 7b)

**Inputs**: `PROJECT_NAME`, `PROJECT_PITCH` (Phase 2 answers or seed preflight), `TEAM_MODE` (Phase 2 step 0.5), stack answers (Phase 2 Q3-Q5), generated package.json (Phase 3).

**Goal:** Create `.project/project.json` as the first dashboard file for this project. core-setup is the first skill to run — all later skills build on this.

See `{skills_root}/shared/DASHBOARD.md` for the full schema and merge strategies (found via `find ~/.claude -name DASHBOARD.md` or in the claude-config repo).

**Steps:**

1. First check if `.project/project.json` already exists (e.g. from an initial commit). If yes: read + merge instead of overwriting. If no: create with the full empty schema from `shared/DASHBOARD.md`
2. Fill `seed` section in `project.json` — pitch only, NEVER author the markdown file:
   - `name`: project name — use existing `seed.name` if filled, otherwise from user answers; do NOT overwrite if already filled
   - `pitch`: 1-2 sentence summary distilled from the Phase 2.1 description — use existing `seed.pitch` if filled, otherwise from user answers; do NOT overwrite if already filled. Keep it short even when the user pasted more — the full concept is `/project-seed`'s job, not core-setup's.
   - `seedFile`: `"project-seed.md"` (reference path; the file itself is authored later by `/project-seed`)
   - `content`: empty string `""` — NEVER fill inline
   - **Do NOT create or fabricate `.project/project-seed.md`.** `/project-seed` is the sole author of the concept document (`shared/SEED.md § Owner`). core-setup captures only the one-line `pitch` above and prompts for `/project-seed` in Phase 9.
   - Exception — `.project/project-seed.md` already exists with > 50 chars (from `/project-seed` or project-add): leave it untouched, do NOT overwrite or append.
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
   - Set `flags.seedPath = ".project/project-seed.md"`. Set `flags.hasSeed = true` ONLY if `.project/project-seed.md` exists with > 50 chars (a real concept authored by `/project-seed` or project-add); otherwise `false`. (`flags` is a root-level object in `backlog.json` — see `shared/BACKLOG.md` / `backlog-template.html:693` — NOT nested under a `data` key.)
   - Set `source = "/core-setup"` and `updated` to current date
   - Write the JSON back to `.project/backlog.json`
   - The `/project-plan` button appears once a real concept exists. When it does not yet, Phase 9 prompts the user to run `/project-seed` first.
6. Create `.project/project-context.json` with `context` section (initial, updated by build/refactor skills):
   - `context.structure`: file tree of project (same format as previously in CLAUDE.md). Generate from actual file tree after Phase 3/4
   - `context.routing`: route patterns with arrow notation (only web projects with routing, otherwise empty array)
   - `context.patterns`: non-obvious patterns discovered during setup (path aliases, env config, etc.)
   - `context.updated`: current date
   - Write `.project/project-context.json`
7. Protect `.project/` from git tracking (corrects rather than masks):

   ```bash
   # Ensure .project/ is gitignored (idempotent)
   grep -qxF '.project/' .gitignore 2>/dev/null || echo '.project/' >> .gitignore
   # Remove any accidentally tracked .project/ files from the index (keep on disk)
   TRACKED=$(git ls-files .project/ 2>/dev/null)
   if [ -n "$TRACKED" ]; then
     git rm --cached -r .project/ 2>/dev/null || true
   fi
   ```

**Output:**

```
DASHBOARD CREATED

Project: {name}
Stack: {framework} / {language}
Packages: {N} packages
```

When done: return to Phase 7c.
