# Backlog Load Protocol

Extracts fields from `.project/backlog.json` (legacy `.project/backlog.html` fallback) without
loading the full store into context. Read-only — PHASE 0 context loading only.

**Not for mutations.** Status updates, date changes, `auto`/`shipped*` flag writes, and transition
flips use the full Read → mutate-in-memory → Write cycle documented in
[BACKLOG.md → Lifecycle Protocol → Write](BACKLOG.md).

> **Schema**: backlog feature objects — see [BACKLOG.md](BACKLOG.md) for the full field list and lifecycle protocol.

```
node scripts/backlog-load.js <repo-root> <profile> [feature-name]
```

| Profile        | Feature name?                   | Used by                                                                                        |
| -------------- | ------------------------------- | ---------------------------------------------------------------------------------------------- |
| `read-feature` | required                        | dev-ship build/define PHASE 0 (risk-check, dependency-status, `externalRef`, interview anchor) |
| `ready-queue`  | —                               | dev-ship build phase selection display (ready ✓ / blocked ✗)                                   |
| `open-items`   | required (excluded from result) | Backlog Impact Check — [BACKLOG.md § Impact Check](BACKLOG.md#impact-check-consumer-protocol)  |
| `guard-items`  | —                               | tweak-skill backlog guard — [TWEAK-DISCIPLINE.md § Backlog guard](TWEAK-DISCIPLINE.md)         |
| `pages`        | —                               | frontend PAGE enumeration (e.g. `dev-define/references/frontend-discovery.md`)                 |

Output: one JSON object per profile.

- `read-feature` → `{ present: false }` if the store or the feature is absent, else
  `{ present: true, name, type, status, description, risk, dependencies, externalRef, transition, pageHint }`.
- `ready-queue` / `open-items` / `guard-items` / `pages` → `{ backlogPresent, items }` — `items` may be `[]`.
  `guard-items` returns every non-CANCELLED card (all statuses and types, with `transition`/`stage`) —
  unlike `open-items`, in-pipeline cards are exactly what the tweak guard must see.

## Game-pipeline equivalent

Game-ship skills use the same script's `game-read-feature` / `game-queue` profiles (parameterized
on `status`/`transition` — see the game-define/build/verify workflow files for the exact
invocation per phase).
