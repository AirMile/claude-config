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

For the ideation skills (`project-seed`, `project-brainstorm`, `project-critique`) via
`INPUT-PARSING.md § Project Memory Load`. Extracts a compact built-state and backlog summary —
"what exists and what's planned", no file paths, no `connects_to`/`endpoints` detail. Caps (40
components, 40 active features) bound the combined block at roughly 600–900 tokens.

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
```
