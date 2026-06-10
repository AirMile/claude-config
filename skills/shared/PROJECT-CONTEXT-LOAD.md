# Project Context Load Protocol

Shared protocol for extracting fields from `.project/project.json` and `.project/project-context.json` without loading entire files into context. Skills reference this instead of duplicating their own `node -e` snippets.

> **Schema**: `project.json` and `project-context.json`. Velden: see [DASHBOARD.md](DASHBOARD.md).

**Prerequisites** (must be set before running any snippet):

- `$REPO` — absolute path to project root (set in PHASE 0 git baseline detection)
- `$FEAT` — current feature name in kebab-case (only required for `define` profile)

---

## When to load

Skills load project context during their **PHASE 0 context-load phase** — read-only, before any generation or writes. Use the profile that matches the skill.

---

## Three profiles

### Profile: `build`

For `dev-build`. Extracts fields needed to prevent duplicate routes, avoid schema conflicts, apply tokens, and follow code patterns.

```bash
node -e "
  const p = require('$REPO/.project/project.json');
  console.log(JSON.stringify({
    stack: p.stack || null,
    endpoints: (p.endpoints || []).map(e => ({method:e.method, path:e.path, auth:e.auth})),
    entities: (p.data?.entities || []).map(e => e.name),
    themeColors: p.theme?.colors || [],
    themeMotionPack: p.theme?.motion?.pack || null,
    themeCssVarsEmpty: !p.theme?.cssVars || p.theme.cssVars.trim() === ''
  }, null, 2));
" 2>/dev/null || echo "PROJECT_JSON: not present"

node -e "
  const c = require('$REPO/.project/project-context.json');
  console.log(JSON.stringify({
    structure: c.context?.structure || null,
    routing: c.context?.routing || null,
    patterns: (c.context?.patterns || []).slice(0, 15),
    componentsCount: (c.architecture?.components || []).length
  }, null, 2));
" 2>/dev/null || echo "PROJECT_CONTEXT_JSON: not present"
```

### Profile: `define`

For `dev-define`. Extracts fields needed for the interview context, reuse-discovery, architecture decisions, and duplicate-prevention.

Requires `$FEAT` to be set to the current feature name.

```bash
node -e "
  const fs = require('fs');
  const p = require('$REPO/.project/project.json');
  const f = '$FEAT';
  // Feature list comes from the backlog store (single source of truth) —
  // project.json no longer carries a features[] copy.
  let bl = null;
  try { bl = JSON.parse(fs.readFileSync('$REPO/.project/backlog.json', 'utf8')); }
  catch { try {
    const html = fs.readFileSync('$REPO/.project/backlog.html', 'utf8');
    const m = html.match(/<script id=\"backlog-data\"[^>]*>([\s\S]*?)<\/script>/);
    if (m) bl = JSON.parse(m[1]);
  } catch {} }
  console.log(JSON.stringify({
    stack: p.stack,
    pitch: p.seed?.pitch || (p.seed?.content || '').slice(0, 240),
    features: ((bl && bl.features) || []).map(x => ({name:x.name, status:x.status, summary:x.summary || x.description})),
    endpoints: (p.endpoints || []).map(e => ({method:e.method, path:e.path})),
    entities: (p.data?.entities || []).map(e => e.name),
    thinking: (p.thinking || []).filter(t => t.newFeature === f),
    designComponents: (p.design?.components || []).map(c => c.name),
    designPages: (p.design?.pages || []).map(pg => pg.name)
  }, null, 2));
" 2>/dev/null || echo "PROJECT_JSON: not present"

node -e "
  const c = require('$REPO/.project/project-context.json');
  console.log(JSON.stringify({
    patterns: (c.context?.patterns || []).slice(0, 15),
    components: (c.architecture?.components || []).map(x => ({
      name: x.name, description: x.description, feature: x.feature
    }))
  }, null, 2));
" 2>/dev/null || echo "{}"
```

### Profile: `verify`

For `dev-verify`. Extracts fields needed to compose the STACK_CONTEXT block passed to the Explore agent in step 7.

```bash
node -e "
  const p = require('$REPO/.project/project.json');
  console.log(JSON.stringify({
    stack: p.stack || null,
    endpoints: (p.endpoints || []).map(e => ({method:e.method, path:e.path, auth:e.auth})),
    entities: (p.data?.entities || []).map(e => e.name)
  }, null, 2));
" 2>/dev/null || echo "PROJECT_JSON: not present"

node -e "
  const c = require('$REPO/.project/project-context.json');
  console.log(JSON.stringify({
    structure: c.context?.structure || null,
    routing: c.context?.routing || null,
    patterns: (c.context?.patterns || []).slice(0, 15),
    components: (c.architecture?.components || []).map(x => x.name)
  }, null, 2));
" 2>/dev/null || echo "PROJECT_CONTEXT_JSON: not present"
```

---

## Output format

Each profile returns two JSON blobs (one per source file). Skills read the combined output and compose their own context block from it.

`PROJECT_JSON: not present` → file is absent; trigger onboarding check or skip gracefully.

`PROJECT_CONTEXT_JSON: not present` / `{}` → context file is absent; treat all fields as `null` / empty.

---

## Edge cases

- **`$REPO` not set**: snippet will error → fallback-echo fires → treat as "not present". Skills must set `$REPO` in PHASE 0 git baseline before calling this protocol.
- **`project.json` missing**: `node -e require()` throws → `2>/dev/null || echo "PROJECT_JSON: not present"` catches it.
- **`project-context.json` missing**: same — `|| echo "{}"` or `|| echo "PROJECT_CONTEXT_JSON: not present"` catches it.
- **Field missing in schema** (e.g. no `theme` key): optional chaining (`p.theme?.colors`) and `|| []` / `|| null` defaults return safe empties without throwing.
- **`require()` cache**: each `node -e` spawns a fresh process — no stale cache between calls.
- **`$FEAT` not set** (define profile): `filter(t => t.newFeature === '')` returns `[]` — no thinking items selected. Acceptable degradation; skill should warn or skip.

---

## Skill-specific configuration

Each skill specifies in its SKILL.md or references file:

```
Project context load (via shared/PROJECT-CONTEXT-LOAD.md):
- profile: build          # or: define | verify
- feature-name: <kebab>   # only required for "define" profile
```

The skill's PHASE 0 then reads the relevant profile block above and runs the matching `node -e` snippets.

---

## Implementation note

This is a **read-only** protocol. No mutations to `project.json` or `project-context.json` — those remain the responsibility of writer-skills (`dev-define`, `dev-build`, `dev-verify`, `core-setup --mode=mature`).

Skills that spawn agents pass the extracted JSON as a `PROJECT_CONTEXT` block — see `shared/SKILL-PATTERNS.md § Agent Context Block`. Do not pass full file contents to agents.
