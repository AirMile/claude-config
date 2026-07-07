# Game Feature Load Protocol

Extracts fields from `.project/features/{name}/feature.json` in game-pipeline skills. Read-only —
PHASE 0 context loading only.

**Not for**:

- `game-ship/references/game-define/references/update-mode.md` — full Read required to preserve
  all sections during update.
- game-ship build phase (PHASE 4b sync) — full Read → mutate-in-memory → Write. Round-trip contract.
- `game-ship/references/game-verify/references/completion-finalize.md` — full Read for
  `tests.finalStatus`, `sessions[]`, `observations[]`, learnings write. Round-trip contract.
- game-ship refactor phase `feature.refactor` writes — full Read required.
- game-ship define phase PHASE 4 `feature.json` write — full Read required.

> **Schema**: see [FEATURE.md](FEATURE.md) — includes game-specific `tuningLevers[]`, `architecture.componentTree`, `design.sceneLayout`.

```
node scripts/context-load.js <repo-root> game-feature-build <feature-name>
node scripts/context-load.js <repo-root> game-feature-verify <feature-name>
```

| Profile               | Used by                                                                                                                                                                        |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `game-feature-build`  | game-ship build PHASE 0 "Load feature.json", refactor batch-scan (requirements + tuningLevers, buildSequence, files, architecture, design, clarifications, blockers, research) |
| `game-feature-verify` | game-ship verify PHASE 0 (checklist, requirements + tuningLevers, files, design, build)                                                                                        |

Output: `{ present: false }` if `feature.json` is absent (skill should exit: "Run `/game-ship`
first."), else `{ present: true, ...fields }`. `architecture`/`design` pass through in full — no
field-by-field truncation, so game-specific sub-fields (`componentTree`, `scenes[]`, `signals[]`,
`sceneLayout`) survive automatically.

Dev-pipeline equivalent: [FEATURE-LOAD.md](FEATURE-LOAD.md) (different profiles —
`httpContractTested`, `apiContract`, `hasUI` are dev-only; `tuningLevers[]`,
`design.sceneLayout`, `architecture.componentTree` are game-only).
