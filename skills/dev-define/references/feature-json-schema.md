# feature.json Field Conditions (PHASE 3)

## Field Table

| Field                       | Condition                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `name`, `created`, `status` | always (status = `"DEFINED"`, no stage — wait for `/dev-build`)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `summary`                   | always                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| `depends`                   | always (empty array if none)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `requirements`              | always (each REQ with `status: "pending"`, `acceptance: [{when, then, category?}]` where `category` ∈ `"happy" \| "edge" \| "boundary"` — omit `category` only on pre-existing `feature.json` files being updated without full re-synthesis; optional `errorScenarios: [{when, then}]` — only for REQs with user input / validation / external calls; omit if no plausible error path; optional `derivedFrom: "interview:{dimension}"` or `"clarification:{branch-name}"` — only for non-trivial derivations; omit for mechanical REQs like "feature has an API endpoint") |
| `files`                     | always (normalized: `path`, `type`, `action`, `purpose`, `requirements`)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `architecture`              | always (`componentTree`, `interfaces`, optional `registries[]`)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `design`                    | visual features only                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `apiContract`               | backend only                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `buildSequence`             | always                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| `testStrategy`              | always (optional `location` field). No per-REQ property-testing note needed: `acceptance[].category: "boundary"` is the machine-readable trigger — `dev-build` automatically creates a checklist item with `kind: "property"` + seed for boundary REQs (see `dev-build/techniques/tdd.md`).                                                                                                                                                                                                                                                                                |
| `clarifications`            | only include if PHASE 1b produced at least 1 entry — otherwise OMIT the field. Single home for interview-derived decisions: design choices resolved in PHASE 1b + factual follow-up answers, each as `{ question, answer, impact }`.                                                                                                                                                                                                                                                                                                                                       |
| `durableDecisions`          | with >3 requirements — decisions that apply across all REQs                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `research`                  | only if research was performed                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `externalRef`               | only if the backlog item had this field — copy 1:1 (`type`, `id`, `url`, `labels`, `split`). Traceability to external issue tracker for downstream skills (`/dev-build`, `/core-commit`).                                                                                                                                                                                                                                                                                                                                                                                  |
| `pageHint`                  | frontend projects only — array of PAGE names this feature surfaces on. Written from PHASE 1 page-placement sparring. Omit if empty or "Not on a page" was selected. Read by `/frontend-design` Build to pre-populate the page-composition selection menu.                                                                                                                                                                                                                                                                                                                  |
| `seedDrift`                 | only if PHASE 2 Seed Alignment Check ran and user chose "Skip" — array of `{ category, seedSays, featureDecides, requirementRef? }`. Omit when seed was updated (drift resolved) or no drift was detected.                                                                                                                                                                                                                                                                                                                                                                 |
| `interviewSummary`          | always when PHASE 1a ran — object with `goal`, `successCriteria`, `edgeCases` (each 1–2 sentences from the closing summary), optional `userContext` (only if User & context dimension was covered), optional `unresolvedDimensions: string[]` (only if ≥1 dimension stayed unresolved).                                                                                                                                                                                                                                                                                    |

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

## Role split

What goes where between the plan file (review artefact) and feature.json (canonical contract):

| Content                            | Plan file | feature.json                             |
| ---------------------------------- | --------- | ---------------------------------------- |
| Context / rationale / why          | ✓         | —                                        |
| REQ list (1-line descriptions)     | ✓         | —                                        |
| Full acceptance criteria           | —         | ✓ (canonical)                            |
| File structure table               | ✓         | ✓                                        |
| Type signatures (typescript fence) | —         | ✓ (`interfaces[].definition`)            |
| Build sequence                     | —         | ✓ (canonical)                            |
| Test strategy table                | —         | ✓ (canonical)                            |
| Dependency analysis                | —         | — (derived from buildSequence.dependsOn) |
| Durable decisions (1-line each)    | ✓         | ✓ (canonical with full rationale)        |
| AI-navigability                    | —         | ✓ (`architecture.registries[]`)          |
| Feature flow (→ chain)             | ✓         | —                                        |
| Verification steps                 | ✓         | —                                        |
| Out of scope                       | ✓         | —                                        |
