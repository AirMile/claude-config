# Game Feature Load Protocol

Shared protocol for extracting fields from `.project/features/{name}/feature.json` in game-pipeline skills. Use instead of full `Read` for PHASE 0 read-only context loading.

> **Schema**: `feature.json` velden — zie [shared/FEATURE.md](FEATURE.md) voor het volledige schema (inclusief game-specifieke velden `tuningLevers[]`, `architecture.componentTree`, `design.sceneLayout`).

**Prerequisites** (must be set before running any snippet):

- `$REPO` — absolute path to project root (set in PHASE 0 git baseline detection)
- `$FEAT` — current feature name in kebab-case

---

## When to load

Game-pipeline skills load feature context during their **PHASE 0 context-load phase** for read-only purposes: requirements (with tuning levers), build sequence, file list, architecture constraints, design layout.

**This protocol is NOT for:**

- `game-define/references/update-mode.md` — full Read required to preserve all sections during update.
- `game-build` PHASE 4b sync (SKILL.md:508-518) — full Read → mutate-in-memory → Write. Round-trip contract requires all fields.
- `game-verify/references/completion-finalize.md` — full Read for `tests.finalStatus`, `sessions[]`, `observations[]`, learnings write. Round-trip contract.
- `game-refactor` `feature.refactor` writes — full Read required.
- `game-define` PHASE 4 `feature.json` write — full Read required.

---

## Two profiles

### Profile: `build`

For game-build PHASE 0 step "Load feature.json" and game-refactor batch-scan — extracts all fields needed for PHASE 1 TDD cycle and scene implementation.

```bash
node -e "
  const f = require('$REPO/.project/features/$FEAT/feature.json');
  console.log(JSON.stringify({
    type: f.type || 'FEATURE',
    requirements: (f.requirements || []).map(r => ({
      id: r.id,
      description: r.description,
      acceptance: r.acceptance,
      errorScenarios: r.errorScenarios,
      tuningLevers: r.tuningLevers || null
    })),
    buildSequence: f.buildSequence || [],
    files: (f.files || []).map(x => ({path: x.path, action: x.action})),
    testStrategy: f.testStrategy || [],
    architecture: f.architecture || null,
    design: f.design || null,
    clarifications: f.clarifications || [],
    blockers: f.build?.blockers || []
  }, null, 2));
" 2>/dev/null || echo "FEATURE_JSON: not present"
```

**Use for**: requirements + acceptance criteria + tuning levers, build order, file paths, scene/signal architecture, design layout, clarifications as hard constraints, blocker check.

**Not included** (not needed in PHASE 0): `durableDecisions[]`, `tests.checklist`, `tests.finalStatus`, `build.decisions`, `status`.

### Profile: `verify`

For game-verify PHASE 0 (checklist load + PHASE 0b baseline check) — extracts checklist, requirements with acceptance, design, and build metadata.

```bash
node -e "
  const f = require('$REPO/.project/features/$FEAT/feature.json');
  console.log(JSON.stringify({
    type: f.type || 'FEATURE',
    checklist: f.tests?.checklist || [],
    requirements: (f.requirements || []).map(r => ({
      id: r.id,
      description: r.description,
      acceptance: r.acceptance,
      errorScenarios: r.errorScenarios,
      tuningLevers: r.tuningLevers || null
    })),
    files: (f.files || []).map(x => ({path: x.path, action: x.action})),
    design: f.design || null,
    build: f.build || null
  }, null, 2));
" 2>/dev/null || echo "FEATURE_JSON: not present"
```

**Use for**: test checklist (playtest items), requirements per REQ (acceptance + tuning levers), file paths for source discovery, design (sceneLayout/gameplayFlow for COMPONENT detection), build section (runCommand + blockers for baseline check).

**Not included** (not needed in PHASE 0): `durableDecisions[]`, `tests.finalStatus`, `clarifications`, `buildSequence`, `architecture`, `status`.

---

## Output format

Both profiles return a compact JSON object. `FEATURE_JSON: not present` → file absent; skill should exit with "Run `/game-define` first."

---

## Edge cases

- **`$FEAT` not set**: `require()` path resolves to `$REPO/.project/features//feature.json` → throws → fallback-echo fires.
- **Feature directory exists but `feature.json` missing**: `require()` throws → `FEATURE_JSON: not present`.
- **Optional fields absent** (e.g. no `tuningLevers[]`, no `design`, no `build.blockers`): `|| null` / `|| []` returns safe empties without throwing.
- **`architecture` absent or partial**: `f.architecture || null` returns the whole object or null — no field-by-field truncation, so game-specific sub-fields (`componentTree`, `scenes[]`, `signals[]`) survive automatically.
- **`require()` cache**: each `node -e` spawns a fresh process — no stale cache between calls.

---

## Skill-specific configuration

Each skill specifies in its SKILL.md or references file:

```
Feature load (via shared/GAME-FEATURE-LOAD.md):
- profile: build       # or: verify
- feature-name: <kebab>
```

---

## Implementation note

This is a **read-only** protocol for PHASE 0 context loading. Mutations to `feature.json` remain the responsibility of writer-paths per `game-build` PHASE 4b sync, `game-verify/references/completion-finalize.md`, and `game-define/references/update-mode.md`.

Dev-pipeline equivalent: [FEATURE-LOAD.md](FEATURE-LOAD.md) (different profiles — `httpContractTested`, `apiContract`, `hasUI` are dev-only; `tuningLevers[]`, `design.sceneLayout`, `architecture.componentTree` are game-only).
