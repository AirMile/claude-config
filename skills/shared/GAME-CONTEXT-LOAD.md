# Game Context Load Protocol

Extracts fields from `.project/project.json` and `.project/project-context.json` in game-pipeline
skills. Read-only — PHASE 0 context loading only.

**Not for** mutations — those remain the responsibility of writer-paths:
`game-ship/references/game-define/references/phase5-sync.md`, game-ship build phase (PHASE 4b
sync), `game-ship/references/game-verify/references/completion-finalize.md`.

> **Schema**: see [DASHBOARD.md](DASHBOARD.md). Game-specific: `architecture` carries `componentTree`, `scenes[]`, `scripts[]`, `signals[]`, `resources[]`.

```
node scripts/context-load.js <repo-root> <profile> [feature-name]
```

| Profile       | Feature name? | Used by                                                      |
| ------------- | ------------- | ------------------------------------------------------------ |
| `game-define` | required      | game-ship define PHASE 0 step 5                              |
| `game-build`  | —             | game-ship build PHASE 0 step 3, game-debug PHASE 0           |
| `game-verify` | —             | game-ship verify PHASE 0, game-debug PHASE 0 (verify output) |

Output: one JSON object, `{ project, projectContext }` — either key is `null` if that source file
is absent. `$FEAT` not set on `game-define`: script exits 2 — set feature-name first.

**`architecture` is passed through in full** (not truncated to a count like the dev `build`
profile) — game-ship's build phase and game-debug need the full scene graph and signal list for
technique mapping.

Dev-pipeline equivalent: [PROJECT-CONTEXT-LOAD.md](PROJECT-CONTEXT-LOAD.md) (dev `build` profile
truncates `architecture` to `componentsCount`; game profiles pass the full object).
