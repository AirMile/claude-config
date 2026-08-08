# Project Context Load Protocol

Extracts fields from `.project/project.json` and `.project/project-context.json` without loading
either file into context.

> **Schema**: `project.json` / `project-context.json` — see [DASHBOARD.md](DASHBOARD.md).
> **Read-only**: mutations remain the responsibility of writer-skills (`dev-ship`, `core-setup --mode=mature`). Agent context blocks: pass the extracted JSON, not full file contents — see `shared/SKILL-PATTERNS.md § Agent Context Block`.

## `build` / `define` / `verify` — via script

```
node scripts/context-load.js <repo-root> <profile> [feature-name]
```

| Profile  | Feature name? | Used by                                                      |
| -------- | ------------- | ------------------------------------------------------------ |
| `build`  | —             | dev-ship build PHASE 0 (routes, entities, tokens, patterns)  |
| `define` | required      | dev-ship define PHASE 0 (interview context, reuse-discovery) |
| `verify` | —             | dev-ship verify PHASE 0 (Explore-agent STACK_CONTEXT)        |

Output: one JSON object, `{ project, projectContext }` — either key is `null` if that source file
is absent (treat as empty/degraded, not an error). `$FEAT` not set on `define`: script exits 2
(usage error) — set feature-name first.

## `ideation` — inline (not script-backed)

For the ideation modes of `project-seed` (seed, brainstorm, critique) via
`INPUT-PARSING.md § Project Memory Load`. Extracts a compact built-state and backlog summary —
"what exists and what's planned", no file paths, no `connects_to`/`endpoints` detail. Caps (40
components, 40 active features) bound the combined block at roughly 600–900 tokens.

**Three sources, not two — the archive is not optional.** A shipped feature leaves
`backlog.json` entirely when it is archived, so `DONE` counts only the features finished but not
yet cleaned up. `project-context.json#architecture.components` is the intended built-state
source, but it is empty on projects that never populated it. Read together, those two can report
"nothing built" on a project with dozens of shipped features — observed 2026-08-08 on a repo with
32 archived features, 0 components and 4 `DONE`, none of which were among the 32. The archive
listing below is what makes the count honest; do not drop it as a cheap optimisation.

```bash
# project-context.json — compact built-state
node -e "
  const c = require('$REPO/.project/project-context.json');
  console.log(JSON.stringify({
    dataFlow: c.architecture?.dataFlow || null,
    components: (c.architecture?.components || [])
      .map(x => ({ name: x.name, layer: x.layer, status: x.status, feature: x.feature || null }))
      .slice(0, 40)
  }, null, 2));
" 2>/dev/null || echo "PROJECT_CONTEXT_JSON: not present"

# backlog.json — backlog summary (counts + active items only)
node -e "
  const fs = require('fs');
  let bl = null; try { bl = JSON.parse(fs.readFileSync('$REPO/.project/backlog.json','utf8')); } catch {}
  const F = (bl && bl.features) || [];
  const count = s => F.filter(f => f.status === s).length;
  console.log(JSON.stringify({
    counts: { TODO: count('TODO'), DEFINED: count('DEFINED'), DOING: count('DOING'), DONE: count('DONE'), CANCELLED: count('CANCELLED') },
    active: F.filter(f => ['TODO','DEFINED','DOING'].includes(f.status))
      .map(f => ({ name: f.name, status: f.status, phase: f.phase, type: f.type, source: f.source || null }))
      .slice(0, 40)
  }, null, 2));
" 2>/dev/null || echo "BACKLOG: not present"

# features/archive/ — shipped features, invisible to both sources above
ARCHIVE="$REPO/.project/features/archive"
if [ -d "$ARCHIVE" ]; then
  echo "ARCHIVED_COUNT: $(ls "$ARCHIVE" | wc -l | tr -d ' ')"
  echo "ARCHIVED_RECENT:"; ls "$ARCHIVE" | sort | tail -12 | sed 's/^/  /'
else
  echo "ARCHIVED_COUNT: 0"
fi
```
