# Game Backlog Load Protocol

Shared protocol for extracting fields from `.project/backlog.json` in game-pipeline skills. Use instead of full `Read` for PHASE 0 read-only access only.

**Legacy fallback**: pre-migration projects store the data embedded in `.project/backlog.html`. Both snippets fall back to extracting from the legacy file so reads keep working until `scripts/migrate-project.py` has run. Write paths migrate first — see BACKLOG.md.

> **Schema**: backlog feature-objecten — zie [BACKLOG.md](BACKLOG.md). Game-pipeline gebruikt extra veld `stage` (bijv. `"ready"`, `"built"`, `"defining"`) naast `status` en `transition`.

**Prerequisites** (must be set before running any snippet):

- `$REPO` — absolute path to project root
- `$FEAT` — current feature name in kebab-case (required for `read-feature` profile; not needed for `queue`)

---

## When to load

Game-pipeline skills load backlog context during their **PHASE 0 context-load phase** for read-only purposes: feature selection, dependency checks, transition auto-pickup.

**This protocol is NOT for mutations.** Backlog `stage`, `status`, `transition`, date, and `audit` writes use the full Read → mutate-in-memory → Write cycle documented in [BACKLOG.md → Lifecycle Protocol → Write](BACKLOG.md).

---

## Two profiles

### Profile: `read-feature`

For single-feature lookup — extracts the record for `$FEAT` only. Used by game-define (backlog check), game-build (dependency-status check per dep), game-verify (feature metadata).

```bash
node -e "
  const fs = require('fs');
  let data = null;
  try { data = JSON.parse(fs.readFileSync('$REPO/.project/backlog.json', 'utf8')); }
  catch { try {
    const html = fs.readFileSync('$REPO/.project/backlog.html', 'utf8');
    const m = html.match(/<script id=\"backlog-data\"[^>]*>([\s\S]*?)<\/script>/);
    if (m) data = JSON.parse(m[1]);
  } catch {} }
  if (!data) { console.log('BACKLOG_NOT_PRESENT'); process.exit(0); }
  const feat = (data.features || []).find(f => f.name === '$FEAT');
  if (!feat) { console.log('BACKLOG_FEATURE_NOT_FOUND'); process.exit(0); }
  console.log(JSON.stringify({
    name: feat.name,
    type: feat.type,
    status: feat.status,
    stage: feat.stage || null,
    description: feat.description || null,
    risk: feat.risk ?? null,
    dependencies: feat.dependencies || [],
    externalRef: feat.externalRef || null,
    transition: feat.transition || null,
    pageHint: feat.pageHint || []
  }, null, 2));
" 2>/dev/null || echo "BACKLOG_NOT_PRESENT"
```

**Use for**: risk-check, dependency-status check, `transition` auto-pickup, `externalRef` passthrough, and `description` as interview anchor in PHASE 1a (context echo + coverage check — see `BACKLOG.md § Description quality`).

### Profile: `queue`

For feature-selection display — lists features filtered by status and optionally by transition. Used by game-build, game-verify, game-refactor, game-debug.

**Required variables** (caller must set before running snippet):

- `$STATUS` — status filter: `DEFINED`, `DOING`, or `DONE`
- `$TRANSITION` — transition filter (optional): `building`, `verifying`, `refactoring`, `defining`. Leave empty (`""`) to skip transition filter.

```bash
node -e "
  const fs = require('fs');
  let data = null;
  try { data = JSON.parse(fs.readFileSync('$REPO/.project/backlog.json', 'utf8')); }
  catch { try {
    const html = fs.readFileSync('$REPO/.project/backlog.html', 'utf8');
    const m = html.match(/<script id=\"backlog-data\"[^>]*>([\s\S]*?)<\/script>/);
    if (m) data = JSON.parse(m[1]);
  } catch {} }
  if (!data) { console.log('BACKLOG_NOT_PRESENT'); process.exit(0); }
  const status = '$STATUS';
  const transition = '$TRANSITION';
  const doneNames = new Set(
    (data.features || []).filter(f => f.status === 'DONE').map(f => f.name)
  );
  const result = (data.features || [])
    .filter(f => f.status === status && (!transition || f.transition === transition))
    .map(f => ({
      name: f.name,
      status: f.status,
      stage: f.stage || null,
      phase: f.phase,
      dependencies: f.dependencies || [],
      transition: f.transition || null,
      ready: status === 'DEFINED'
        ? (f.dependencies || []).every(d => doneNames.has(d))
        : null,
      blocking: status === 'DEFINED'
        ? (f.dependencies || []).filter(d => !doneNames.has(d))
        : null
    }));
  console.log(JSON.stringify(result, null, 2));
" 2>/dev/null || echo "BACKLOG_NOT_PRESENT"
```

**Caller configuration** — specify in skill SKILL.md or references file:

| Skill / Use case                           | `$STATUS` | `$TRANSITION` |
| ------------------------------------------ | --------- | ------------- |
| game-build feature selection (auto-pickup) | `DEFINED` | `building`    |
| game-build feature selection (fallback)    | `DEFINED` | _(empty)_     |
| game-verify feature selection              | `DOING`   | `verifying`   |
| game-verify fallback (stage: built)        | `DOING`   | _(empty)_     |
| game-refactor queue                        | `DONE`    | `refactoring` |
| game-debug active feature                  | `DOING`   | _(empty)_     |

**`ready` / `blocking` fields**: only computed when `$STATUS === "DEFINED"` (meaningful for build-selection). For DOING/DONE queues these fields are `null`.

---

## Output format

- `read-feature` returns a single JSON object or a sentinel string.
- `queue` returns a JSON array (possibly empty).

Sentinel values:

- `BACKLOG_NOT_PRESENT` → no backlog store (neither `backlog.json` nor legacy `backlog.html` with data); log `Backlog: ⓘ not present — skip.`
- `BACKLOG_FEATURE_NOT_FOUND` → feature not in backlog; log `Backlog: ⓘ not found — skip.`

---

## Edge cases

- **`$REPO` not set**: `fs.readFileSync` throws → fallback chain ends in `BACKLOG_NOT_PRESENT`.
- **Malformed JSON**: `JSON.parse` throws → caught, falls through to `BACKLOG_NOT_PRESENT`.
- **Legacy `<script>` tag with extra attributes**: regex `[^>]*` tolerates any attribute order.
- **`$TRANSITION` empty string**: `!transition` evaluates to `true` → transition filter skipped, only status filter applies.
- **No features match filter**: `queue` returns `[]`. Skill shows "No features in {status} stage."
- **`stage` field absent**: `feat.stage || null` returns null safely.

---

## Skill-specific configuration

Each skill specifies in its SKILL.md or references file:

```
Backlog load (via shared/GAME-BACKLOG-LOAD.md):
- profile: read-feature       # or: queue
- feature-name: <kebab>       # only for read-feature
- status: DEFINED             # only for queue
- transition: building        # only for queue (optional)
```

---

## Implementation note

This is a **read-only** protocol. Unlike the dev-pipeline equivalent (`BACKLOG-LOAD.md`), the `queue` profile is parameterized on `status` + `transition` to support game-pipeline's multi-stage lifecycle (TODO → DEFINED → DOING/building → DOING/verifying → DONE/refactoring). The dev `ready-queue` profile hardcodes `DEFINED` — inappropriate for game skills that select DOING or DONE features.

Dev-pipeline equivalent: [BACKLOG-LOAD.md](BACKLOG-LOAD.md).
