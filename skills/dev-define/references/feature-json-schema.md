# feature.json Field Conditions (PHASE 3)

## Field Table

| Field                       | Condition                                                                                                                                                                                                                                                                                     |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `name`, `created`, `status` | always (status = `"DEFINED"`, no stage — wait for `/dev-build`)                                                                                                                                                                                                                               |
| `summary`                   | always                                                                                                                                                                                                                                                                                        |
| `depends`                   | always (empty array if none)                                                                                                                                                                                                                                                                  |
| `choices`                   | always (user answers)                                                                                                                                                                                                                                                                         |
| `requirements`              | always (each REQ with `status: "pending"`, `acceptance: [{when, then}]`, optional `errorScenarios: [{when, then}]` — only for REQs with user input / validation / external calls; omit if no plausible error path)                                                                            |
| `files`                     | always (normalized: `path`, `type`, `action`, `purpose`, `requirements`)                                                                                                                                                                                                                      |
| `architecture`              | always (`componentTree`, `interfaces`, optional `registries[]`)                                                                                                                                                                                                                               |
| `design`                    | visual features only                                                                                                                                                                                                                                                                          |
| `apiContract`               | backend only                                                                                                                                                                                                                                                                                  |
| `buildSequence`             | always                                                                                                                                                                                                                                                                                        |
| `testStrategy`              | always (optional `location` field)                                                                                                                                                                                                                                                            |
| `clarifications`            | only include if the clarification round (PHASE 1 Clarification Round) produced at least 1 answer — otherwise OMIT the field. Contains **only** clarification-round entries (factual follow-ups + design choices), not the main questions from PHASE 1 steps 1-5; those belong in `choices[]`. |
| `durableDecisions`          | with >3 requirements — decisions that apply across all REQs                                                                                                                                                                                                                                   |
| `research`                  | only if research was performed                                                                                                                                                                                                                                                                |
| `externalRef`               | only if the backlog item had this field — copy 1:1 (`type`, `id`, `url`, `labels`, `split`). Traceability to external issue tracker for downstream skills (`/dev-build`, `/core-commit`).                                                                                                     |
| `pageHint`                  | frontend projects only — array of PAGE names this feature surfaces on. Written from PHASE 1 page-placement sparring. Omit if empty or "Not on a page" was selected. Read by `/frontend-design` Build to pre-populate the page-composition selection menu.                                     |
| `seedDrift`                 | only if PHASE 2 Seed Alignment Check ran and user chose "Skip" — array of `{ category, seedSays, featureDecides, requirementRef? }`. Omit when seed was updated (drift resolved) or no drift was detected.                                                                                    |

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

dev-build iterates this directly:

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
