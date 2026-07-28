# Game Backlog Load Protocol

Extracts fields from `.project/backlog.json` (legacy `.project/backlog.html` fallback) in
game-pipeline skills. Read-only — PHASE 0 context loading only.

**Not for mutations.** Backlog `stage`, `status`, `transition`, date, and `audit` writes use the
full Read → mutate-in-memory → Write cycle documented in
[BACKLOG.md → Lifecycle Protocol → Write](BACKLOG.md).

> **Schema**: backlog feature objects — see [BACKLOG.md](BACKLOG.md). Game-pipeline adds `stage` (e.g. `"ready"`, `"built"`, `"defining"`) alongside `status` and `transition`.

```
node scripts/backlog-load.js <repo-root> game-read-feature <feature-name>
node scripts/backlog-load.js <repo-root> game-queue <status> [transition]
```

| Profile             | Used by                                                                                        |
| ------------------- | ---------------------------------------------------------------------------------------------- |
| `game-read-feature` | game-ship define (backlog check), build (dependency-status per dep), verify (feature metadata) |
| `game-queue`        | feature-selection display across game-ship build/verify/refactor and game-debug                |

**`game-queue` caller configuration** — `<status>`/`[transition]`:

| Skill / use case                              | `status`  | `transition`  |
| --------------------------------------------- | --------- | ------------- |
| game-ship build phase selection (auto-pickup) | `DEFINED` | `building`    |
| game-ship build phase selection (fallback)    | `DEFINED` | _(omit)_      |
| game-ship verify phase selection              | `DOING`   | `verifying`   |
| game-ship verify fallback (stage: built)      | `DOING`   | _(omit)_      |
| game-ship refactor phase queue                | `DONE`    | `refactoring` |
| game-debug active feature                     | `DOING`   | _(omit)_      |

`ready`/`blocking` are only computed when `status === "DEFINED"` — `null` otherwise. Each
dependency resolves against **live + archived** features via the same completion predicate as the
board (`shipped`, not plain `status === "DONE"` — see [BACKLOG.md § Completion & dependency
resolution](BACKLOG.md)), so an already-shipped-and-archived dependency reads as resolved.

Output: `game-read-feature` → `{ present: false }` if the store or feature is absent, else
`{ present: true, name, type, status, shipped, stage, description, risk, dependencies, externalRef, transition, pageHint }`.
`game-queue` → `{ backlogPresent, items }` — `items` may be `[]`.

Dev-pipeline equivalent: [BACKLOG-LOAD.md](BACKLOG-LOAD.md) — the dev `ready-queue` profile
hardcodes `DEFINED`; `game-queue` is parameterized for game-ship's multi-stage lifecycle (TODO →
DEFINED → DOING/building → DOING/verifying → DONE/refactoring).
