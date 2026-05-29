# Game Context Load Protocol

Shared protocol for extracting fields from `.project/project.json` and `.project/project-context.json` in game-pipeline skills. Use instead of full `Read` for PHASE 0 read-only context loading.

> **Schema**: velden — zie [DASHBOARD.md](DASHBOARD.md). Game-specifiek: `architecture` bevat `componentTree`, `scenes[]`, `scripts[]`, `signals[]`, `resources[]`.

**Prerequisites** (must be set before running any snippet):

- `$REPO` — absolute path to project root (set in PHASE 0 git baseline detection)
- `$FEAT` — current feature name in kebab-case (only required for `define` profile)

---

## When to load

Game-pipeline skills load project context during their **PHASE 0 context-load phase** — read-only, before any generation or writes.

**This protocol is NOT for** mutations to `project.json` or `project-context.json`. Those remain the responsibility of writer-paths: `game-define/references/phase5-sync.md`, `game-build` PHASE 4b sync, `game-verify/references/completion-finalize.md`.

---

## Three profiles

### Profile: `define`

For game-define PHASE 0 step 5 (project context load).

Requires `$FEAT` to be set to the current feature name.

```bash
node -e "
  const p = require('$REPO/.project/project.json');
  const f = '$FEAT';
  console.log(JSON.stringify({
    stack: p.stack || null,
    pitch: p.seed?.pitch || (p.seed?.content || '').slice(0, 240),
    features: (p.features || []).map(x => ({name: x.name, status: x.status, summary: x.summary})),
    entities: (p.data?.entities || []).map(e => (typeof e === 'string' ? e : e.name)),
    thinking: (p.thinking || []).filter(t => t.newFeature === f)
  }, null, 2));
" 2>/dev/null || echo "PROJECT_JSON: not present"

node -e "
  const c = require('$REPO/.project/project-context.json');
  console.log(JSON.stringify({
    patterns: (c.context?.patterns || []).slice(0, 15),
    architecture: c.architecture || null
  }, null, 2));
" 2>/dev/null || echo "{}"
```

**Use for**: stack (framework, language, packages), pitch for feature context, existing features (prevents duplicates), data entities, thinking entries for this feature, code patterns, full architecture (componentTree, scenes, signals, resources).

### Profile: `build`

For game-build PHASE 0 step 3 (project context) and game-debug PHASE 0.

```bash
node -e "
  const p = require('$REPO/.project/project.json');
  console.log(JSON.stringify({
    stack: p.stack || null,
    entities: (p.data?.entities || []).map(e => (typeof e === 'string' ? e : e.name))
  }, null, 2));
" 2>/dev/null || echo "PROJECT_JSON: not present"

node -e "
  const c = require('$REPO/.project/project-context.json');
  console.log(JSON.stringify({
    structure: c.context?.structure || null,
    patterns: (c.context?.patterns || []).slice(0, 15),
    architecture: c.architecture || null
  }, null, 2));
" 2>/dev/null || echo "{}"
```

**Use for**: stack, existing entity names (prevents scene conflicts), directory structure, code patterns, full architecture (scene graph, signals, resources) — all needed for technique mapping and TDD cycle.

### Profile: `verify`

For game-verify PHASE 0 and game-debug PHASE 0 when verifying output.

```bash
node -e "
  const p = require('$REPO/.project/project.json');
  console.log(JSON.stringify({
    stack: p.stack || null,
    entities: (p.data?.entities || []).map(e => (typeof e === 'string' ? e : e.name))
  }, null, 2));
" 2>/dev/null || echo "PROJECT_JSON: not present"

node -e "
  const c = require('$REPO/.project/project-context.json');
  console.log(JSON.stringify({
    structure: c.context?.structure || null,
    routing: c.context?.routing || null,
    patterns: (c.context?.patterns || []).slice(0, 15),
    architecture: c.architecture || null
  }, null, 2));
" 2>/dev/null || echo "{}"
```

**Use for**: stack, entities, directory structure, routing (if applicable), patterns, full architecture for COMPONENT detection and scene-graph awareness during verification.

---

## Output format

Each profile returns two JSON blobs (one per source file). Skills parse the combined output to compose their PROJECT_CONTEXT block.

- `PROJECT_JSON: not present` → file absent; show: `⚠️ No project.json found. Consider running /core-setup first.` Continue without.
- `{}` → `project-context.json` absent; treat all fields as `null` / empty.

---

## Edge cases

- **`$REPO` not set**: snippet errors → fallback-echo fires → treat as "not present".
- **`project.json` missing**: `require()` throws → `PROJECT_JSON: not present` caught.
- **`project-context.json` missing**: `|| echo "{}"` catches it — all fields resolve to null.
- **`architecture` absent**: `c.architecture || null` returns null. Skills handle gracefully (no componentTree available — proceed without).
- **`entities` as strings vs objects**: `typeof e === 'string' ? e : e.name` handles both `"Player"` and `{"name": "Player", ...}` formats.
- **`$FEAT` not set** (define profile): `filter(t => t.newFeature === '')` returns `[]`. Acceptable degradation.
- **`require()` cache**: each `node -e` spawns a fresh process — no stale cache.

---

## Skill-specific configuration

Each skill specifies in its SKILL.md or references file:

```
Project context load (via shared/GAME-CONTEXT-LOAD.md):
- profile: build        # or: define | verify
- feature-name: <kebab> # only required for "define" profile
```

---

## Implementation note

This is a **read-only** protocol. Crucially, `architecture` is returned as the **full object** (not truncated to a count as in the dev-pipeline helper) because game-build and game-debug require the full scene graph and signal list for technique mapping.

Dev-pipeline equivalent: [PROJECT-CONTEXT-LOAD.md](PROJECT-CONTEXT-LOAD.md) (dev `build` profile truncates `architecture` to `componentsCount`; game profiles pass the full `architecture` object).
