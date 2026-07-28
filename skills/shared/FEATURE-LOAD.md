# Feature Load Protocol

Extracts fields from `.project/features/{name}/feature.json` without loading the full file into
context. Read-only — PHASE 0 context loading only.

**Not for**:

- `dev-ship/references/dev-verify/references/completion-sync.md` — full Read → mutate-in-memory →
  Write for `tests.finalStatus`, `status`, `suggestionsLog[]`. Round-trip contract requires all fields.
- `dev-ship/references/dev-define/references/update-mode.md` — full Read required to preserve
  `architecture`, `apiContract`, `design`, `testStrategy`, `durableDecisions`, `research`.
- `dev-ship/references/dev-build/references/context-loading.md` file-recovery block — `require()`s
  the path directly for worktree restoration.

> **Schema**: `feature.json` fields — see [feature-json-schema.md](feature-json-schema.md).

```
node scripts/context-load.js <repo-root> feature-build <feature-name>
node scripts/context-load.js <repo-root> feature-verify <feature-name>
```

| Profile          | Used by                                                                                                                                            |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `feature-build`  | dev-ship build PHASE 0 "Load feature" (requirements, buildSequence, files, architecture, clarifications, blockers, research, `durableDecisions[]`) |
| `feature-verify` | dev-ship verify PHASE 0 (checklist, requirements, files, runCommand, design, apiContract)                                                          |

Output: `{ present: false }` if `feature.json` is absent (skill should exit: "Run `/dev-ship`
first."), else `{ present: true, ...fields }`.

**`durableDecisions[]` is on `feature-build` only** (not `feature-verify`): build is the phase that
writes new code against already-settled design questions — it needs to see the "does-not-change"
constraint/rationale record so a later REQ doesn't silently re-decide one. verify checks behavior
against `acceptance[]`, not design choices, so it stays without it. This was previously on the
excluded list below (no load profile carried it at all — a design-time gap noted in
`shared/SECOND-OPINION.md`-triggered analysis: every other reader of `durableDecisions[]` runs at
plan/define time, never on the modify path).

Fields deliberately excluded (not needed in PHASE 0): `audit{}`, `tests.checklist`/`tests.finalStatus`,
`suggestionsLog[]`, `status`, plus whichever of `design`/`apiContract`/`clarifications`/`buildSequence`/
`architecture` the other profile doesn't list above. `research` (define-scout's Context7/library
digest) is now carried by `feature-build` only — see `shared/CONTEXT7.md`.

## Game-pipeline equivalent

[GAME-FEATURE-LOAD.md](GAME-FEATURE-LOAD.md) — `game-feature-build` / `game-feature-verify`
profiles on the same script (adds `tuningLevers[]`, `design.sceneLayout`,
`architecture.componentTree`; drops `httpContractTested`/`apiContract`/`hasUI`, which are dev-only).
