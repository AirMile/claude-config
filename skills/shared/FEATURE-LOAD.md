# Feature Load Protocol

Shared protocol for extracting fields from `.project/features/{name}/feature.json` without loading the full file into context. Skills reference this for PHASE 0 read-only context loading only.

> **Schema**: `feature.json` velden — zie [feature-json-schema.md](feature-json-schema.md) voor volledige schema.

**Prerequisites** (must be set before running any snippet):

- `$REPO` — absolute path to project root (set in PHASE 0 git baseline detection)
- `$FEAT` — current feature name in kebab-case

---

## When to load

Skills load feature context during their **PHASE 0 context-load phase** for read-only purposes: requirements, build sequence, file list, architecture constraints.

**This protocol is NOT for:**

- `dev-ship/references/dev-verify/references/completion-sync.md` — uses full Read → mutate-in-memory → Write for `tests.finalStatus`, `status`, `suggestionsLog[]`. Round-trip contract requires all fields.
- `dev-ship/references/dev-define/references/update-mode.md` — full Read required to preserve `architecture`, `apiContract`, `design`, `testStrategy`, `durableDecisions`, `research` during update.
- `dev-ship/references/dev-build/references/context-loading.md` file-recovery block — uses `require()` directly on the path for worktree restoration. Does not use this protocol.

---

## Two profiles

### Profile: `build`

For dev-ship's build phase PHASE 0 step "Load feature" — extracts all fields needed for PHASE 1 implementation planning and TDD cycle.

```bash
node -e "
  const f = require('$REPO/.project/features/$FEAT/feature.json');
  console.log(JSON.stringify({
    type: f.type || 'FEATURE',
    hasUI: f.hasUI ?? false,
    requirements: (f.requirements || []).map(r => ({
      id: r.id,
      description: r.description,
      acceptance: r.acceptance,
      errorScenarios: r.errorScenarios,
      deltaOp: r.deltaOp
    })),
    buildSequence: f.buildSequence || [],
    files: (f.files || []).map(x => ({path: x.path, action: x.action})),
    testStrategy: f.testStrategy || [],
    architecture: {
      registries: f.architecture?.registries || [],
      interfaces: f.architecture?.interfaces || null,
      scope: f.architecture?.scope || null
    },
    clarifications: f.clarifications || [],
    blockers: f.build?.blockers || []
  }, null, 2));
" 2>/dev/null || echo "FEATURE_JSON: not present"
```

**Use for**: requirements + acceptance criteria, build order, file paths (action: create/modify), architecture registries, clarifications as hard constraints, blocker check.

**Not included** (not needed in PHASE 0): `durableDecisions[]`, `audit{}`, `research`, `tests.checklist`, `tests.finalStatus`, `suggestionsLog[]`, `design`, `apiContract`, `status`.

### Profile: `verify`

For dev-ship's verify phase PHASE 0 steps that build the Explore-agent prompt (step 7 input) — extracts checklist, requirements with acceptance, and test-execution metadata.

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
      deltaOp: r.deltaOp,
      httpContractTested: r.httpContractTested
    })),
    files: (f.files || []).map(x => ({path: x.path, action: x.action})),
    runCommand: f.build?.runCommand || null,
    design: f.design || null,
    apiContract: f.apiContract || null
  }, null, 2));
" 2>/dev/null || echo "FEATURE_JSON: not present"
```

**Use for**: test checklist (T-xxx items), requirements per REQ (acceptance + errorScenarios + httpContractTested), file paths for source discovery, runCommand for baseline test run, design/apiContract for type-specific verification.

**Not included** (not needed in PHASE 0): `durableDecisions[]`, `audit{}`, `research`, `tests.finalStatus`, `suggestionsLog[]`, `clarifications`, `buildSequence`, `architecture`, `blockers`, `status`.

---

## Output format

Both profiles return a compact JSON object. `FEATURE_JSON: not present` → file absent; skill should exit: "Run `/dev-ship` first."

---

## Edge cases

- **`$FEAT` not set**: `require()` path resolves to `$REPO/.project/features//feature.json` → throws → fallback-echo fires.
- **Feature directory exists but `feature.json` missing**: `require()` throws → `FEATURE_JSON: not present`.
- **Optional fields absent** (e.g. no `clarifications[]`, no `build.blockers`): `|| []` / `|| null` returns safe empties without throwing.
- **`require()` cache**: each `node -e` spawns a fresh process — no stale cache between calls.

---

## Skill-specific configuration

Each skill specifies in its SKILL.md or references file:

```
Feature load (via shared/FEATURE-LOAD.md):
- profile: build       # or: verify
- feature-name: <kebab>
```

---

## Implementation note

This is a **read-only** protocol for PHASE 0 context loading. Mutations to `feature.json` (status updates, `tests.finalStatus`, `suggestionsLog[]`, `audit{}` writes) remain the responsibility of writer-paths per `dev-ship/references/dev-verify/references/completion-sync.md` and `dev-ship/references/dev-define/references/update-mode.md`.
