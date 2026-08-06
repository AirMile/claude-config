# feature.json Field Conditions

These conditions govern the **complete feature.json draft authored in the PHASE 2 machine-contract appendix** (and the PHASE 3 hand-authored fallback). PHASE 3 normally just extracts the appendix via `scripts/feature-from-plan.js` — no re-authoring.

## Field Table

| Field                       | Condition                                                                                                                                                                                                                                                                                                                                                                              |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `name`, `created`, `status` | always (status = `"DEFINED"`, no stage — wait for `/dev-ship (build phase)`)                                                                                                                                                                                                                                                                                                           |
| `summary`                   | always                                                                                                                                                                                                                                                                                                                                                                                 |
| `depends`                   | always (empty array if none)                                                                                                                                                                                                                                                                                                                                                           |
| `requirements`              | always (each REQ with `status: "pending"`, `acceptance: [{when, then, category?}]` where `category` ∈ `"happy" \| "edge" \| "boundary"` — omit `category` only on pre-existing `feature.json` files being updated without full re-synthesis; optional `errorScenarios: [{when, then}]` — only for REQs with user input / validation / external calls; omit if no plausible error path) |
| `files`                     | always (normalized: `path`, `type`, `action`, `purpose`, `requirements`)                                                                                                                                                                                                                                                                                                               |
| `architecture`              | always (`componentTree`, `interfaces`, optional `registries[]`)                                                                                                                                                                                                                                                                                                                        |
| `design`                    | visual features only                                                                                                                                                                                                                                                                                                                                                                   |
| `apiContract`               | backend only                                                                                                                                                                                                                                                                                                                                                                           |
| `buildSequence`             | always                                                                                                                                                                                                                                                                                                                                                                                 |
| `testStrategy`              | always (optional `location` field). No per-REQ property-testing note needed: `acceptance[].category: "boundary"` is the machine-readable trigger — `dev-ship`'s build phase automatically creates a checklist item with `kind: "property"` + seed for boundary REQs (see `dev-ship/references/dev-build/techniques/tdd.md`).                                                           |
| `clarifications`            | only include if PHASE 1b produced at least 1 entry — otherwise OMIT the field. Single home for interview-derived decisions: design choices resolved in PHASE 1b + factual follow-up answers, each as `{ question, answer, impact }`.                                                                                                                                                   |
| `durableDecisions`          | with >3 requirements — decisions that apply across all REQs                                                                                                                                                                                                                                                                                                                            |
| `research`                  | only if research was performed                                                                                                                                                                                                                                                                                                                                                         |
| `externalRef`               | only if the backlog item had this field — copy 1:1 (`type`, `id`, `url`, `labels`, `split`). Traceability to external issue tracker for downstream skills (`/dev-ship (build phase)`, `/core-commit`).                                                                                                                                                                                 |
| `pageHint`                  | frontend projects only — array of PAGE names this feature surfaces on. Written from PHASE 1 page-placement sparring. Omit if empty or "Not on a page" was selected. Read by `/design-convert` Build to pre-populate the page-composition selection menu.                                                                                                                               |
| `seedDrift`                 | only if PHASE 2 Seed Alignment Check ran and user chose "Skip" — array of `{ category, seedSays, featureDecides, requirementRef? }`. Omit when seed was updated (drift resolved) or no drift was detected.                                                                                                                                                                             |

## deltaOp on requirements

Only write in update-mode (PHASE 0b). On a fresh definition: omit `deltaOp` and `previousDescription` entirely. PHASE 0b adds these when requirements are updated via add/modify/remove.

## durableDecisions categories

Decisions that do NOT change during the build:

- Persistence strategy (which storage API, which format)
- ID generation and idempotency contract
- Key data models and their relations
- External service boundaries
- Route structures / URL patterns (for routing features)
- Auth/authz approach (for auth features)

## buildSequence structure

dev-ship's build phase iterates this directly:

```json
[
  {
    "step": 1,
    "requirements": ["REQ-001"],
    "description": "...",
    "dependsOn": []
  },
  {
    "step": 2,
    "requirements": ["REQ-002", "REQ-003"],
    "description": "...",
    "dependsOn": [1]
  }
]
```

## Role split

The plan file has two parts, both written in PHASE 2 under plan mode:

1. **Review surface** (top of the plan file) — the human-facing narrative: context / rationale / why, REQ list (1-line descriptions), file-structure table, feature flow (→ chain), verification steps, out of scope, durable decisions (1-line each).
2. **Machine-contract appendix** (`## Appendix — machine contract (skip review)`) — a single ```json fence holding the **complete feature.json draft**: full acceptance criteria, `files`, `architecture` (incl. `interfaces[].definition` type signatures and `registries[]`), `buildSequence`, `testStrategy`, durable decisions (full rationale), and all conditional fields. Authored under the approval gate (the session model, `opus`, throughout) so the canonical contract is written once. The heading tells the reviewer to skip it.

PHASE 3 extracts the appendix into `.project/features/{name}/feature.json` mechanically via `scripts/feature-from-plan.js` — no transcription, no re-authoring. Dependency analysis stays implicit (derived from `buildSequence[].dependsOn`, no separate section).
