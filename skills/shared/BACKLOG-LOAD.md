# Backlog Load Protocol

Shared protocol for extracting fields from `.project/backlog.json` without loading the full file into context. Skills reference this for PHASE 0 read-only access only.

> **Schema**: backlog feature-objecten — zie [BACKLOG.md](BACKLOG.md) voor volledige veldlijst en lifecycle-protocol.

**Prerequisites** (must be set before running any snippet):

- `$REPO` — absolute path to project root (set in PHASE 0 git baseline detection)
- `$FEAT` — current feature name in kebab-case (required for `read-feature` profile; not needed for `ready-queue`)

---

## When to load

Skills load backlog context during their **PHASE 0 context-load phase** for read-only purposes: risk scores, dependency checks, and external references.

**This protocol is NOT for mutations.** Backlog status updates, date changes, `auto`/`shipped*` flag writes, and transition flips use the full Read → mutate-in-memory → Write cycle documented in [BACKLOG.md → Lifecycle Protocol → Write](BACKLOG.md).

**Legacy fallback**: pre-migration projects store the data embedded in `.project/backlog.html`. Both snippets fall back to extracting from the legacy file so reads keep working until `scripts/migrate-project.py` has run. Write paths migrate first — see BACKLOG.md.

---

## Two profiles

### Profile: `read-feature`

For dev-build and dev-define PHASE 0 — extracts the record for the current feature only.

Requires `$FEAT` to be set to the current feature name.

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
    description: feat.description || null,
    risk: feat.risk ?? null,
    dependencies: feat.dependencies || [],
    externalRef: feat.externalRef || null,
    transition: feat.transition || null,
    pageHint: feat.pageHint || []
  }, null, 2));
" 2>/dev/null || echo "BACKLOG_NOT_PRESENT"
```

**Use for**: risk-check (skip ≥4 warning), dependency-status check, `externalRef` passthrough to `feature.json` in PHASE 3, and `description` as interview anchor in PHASE 1a (context echo + coverage check — see `BACKLOG.md § Description quality`).

### Profile: `ready-queue`

For dev-build PHASE 0 — lists DEFINED features to compose the "Ready to build" / "Blocked" queue display.

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
  const defined = (data.features || [])
    .filter(f => f.status === 'DEFINED')
    .map(f => ({
      name: f.name,
      status: f.status,
      phase: f.phase,
      dependencies: f.dependencies || []
    }));
  const doneNames = new Set(
    (data.features || []).filter(f => f.status === 'DONE').map(f => f.name)
  );
  const result = defined.map(f => ({
    ...f,
    ready: f.dependencies.every(d => doneNames.has(d)),
    blocking: f.dependencies.filter(d => !doneNames.has(d))
  }));
  console.log(JSON.stringify(result, null, 2));
" 2>/dev/null || echo "BACKLOG_NOT_PRESENT"
```

**Use for**: feature selection display (ready ✓ / blocked ✗ indicators). Dependency-status is computed inline — no separate lookup needed.

---

## Output format

Both profiles return compact JSON. Skills parse the output to compose their PHASE 0 display.

- `BACKLOG_NOT_PRESENT` → no backlog store (neither `backlog.json` nor legacy `backlog.html` with data); skip risk-check, log `Backlog: ⓘ not present — risk-check skipped`.
- `BACKLOG_FEATURE_NOT_FOUND` → feature not in backlog; log `Backlog: ⓘ not present — risk-check skipped` and continue.

---

## Edge cases

- **`$REPO` not set**: `fs.readFileSync` throws → fallback chain ends in `BACKLOG_NOT_PRESENT`.
- **Malformed JSON**: `JSON.parse` throws → caught, falls through to `BACKLOG_NOT_PRESENT`.
- **Legacy `<script>` tag has extra attributes**: regex `[^>]*` tolerates any attribute (e.g. `type="application/json"`).
- **Feature record missing optional fields** (e.g. no `externalRef`): `|| null` / `|| []` defaults return safe empties.
- **`ready-queue` with no DEFINED features**: returns `[]` — skill shows "No features ready to build."

---

## Skill-specific configuration

Each skill specifies in its SKILL.md or references file:

```
Backlog load (via shared/BACKLOG-LOAD.md):
- profile: read-feature     # or: ready-queue
- feature-name: <kebab>     # only required for "read-feature" profile
```

---

## Implementation note

This is a **read-only** protocol for PHASE 0 context loading only. Backlog mutations (status, date, `auto` flag, `shipped*` velden, `transition`, `audit`) remain the responsibility of PHASE 4/5 writer-paths per [BACKLOG.md → Lifecycle Protocol → Write](BACKLOG.md).
