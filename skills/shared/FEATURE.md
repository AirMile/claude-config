# Feature file: feature.json Format

Each feature is stored as **one file**: `.project/features/{feature-name}/feature.json`. This file is progressively enriched by each skill in the pipeline.

**Filename:** always `feature.json` (not `define.json`, `build.json`, etc.)

**Lifecycle:**

```
/dev-ship (define phase)   → creates feature.json (header, requirements, files, architecture, clarifications)
/dev-ship (build phase)    → enriches (build summary, decisions, syncNotes, packages, tests.checklist)
/dev-ship (verify phase)   → enriches (evaluation, acceptance tests, test results, coverage, observations)
/dev-ship (refactor phase) → enriches (improvements, positive observations)
```

**Write pattern for skills after define:**

```
1. Read feature.json
2. Merge the relevant section (do NOT overwrite other sections)
3. Update status
4. Write feature.json as JSON.stringify(data, null, 2)
```

## feature.json schema

```json
{
  "name": "pin-mode",
  "status": "DONE",
  "created": "2026-02-20",
  "depends": ["clipboard-redesign"],
  "summary": "Shift+Click multi-select for inspect overlay",

  "clarifications": [
    {
      "question": "What if max pins is reached and the user pins another?",
      "answer": "Block with visual feedback",
      "impact": "REQ-001 edge case"
    }
  ],

  "requirements": [
    {
      "id": "REQ-001",
      "description": "Shift+Click on element pins it",
      "category": "core",
      "acceptance": "Element has pinned state after Shift+Click",
      "technique": "TDD",
      "syncNote": "Hook exposes togglePin(id), pinnedIds array, clearAll. Uses Map internally for O(1) lookup.",
      "status": "PASS",
      "tuningLevers": [
        {
          "parameter": "max_pins",
          "default": 10,
          "min": 1,
          "max": 50,
          "impact": "How many elements can be compared simultaneously"
        }
      ],
      "edgeCases": ["What if max pins is reached and the user pins another?"],
      "implicitCoverage": "REQ-002 test also validates this via integration flow"
    }
  ],

  "files": [
    {
      "path": "src/hooks/usePinMode.ts",
      "type": "source",
      "action": "create",
      "purpose": "State management for pin mode",
      "requirements": ["REQ-001"]
    },
    {
      "path": "src/components/Inspector.tsx",
      "type": "source",
      "action": "modify",
      "purpose": "Add Shift+Click handler",
      "requirements": ["REQ-002"]
    },
    {
      "path": "src/hooks/__tests__/usePinMode.test.ts",
      "type": "test",
      "action": "create",
      "purpose": "Validates pin state toggling",
      "requirements": ["REQ-001"]
    }
  ],

  "design": {
    "wireframe": "ASCII wireframe text (visual features only)",
    "components": ["PinBar", "PinOverlay"]
  },

  "architecture": {
    "componentTree": "Inspector\n├── PinBar\n└── PinOverlay",
    "interfaces": [
      {
        "name": "PinnedElement",
        "definition": "interface PinnedElement { id: string; selector: string; rect: DOMRect }"
      }
    ],
    "registries": [
      {
        "name": "endpoint registry",
        "file": "src/routes/index.ts",
        "pattern": "barrel export"
      }
    ]
  },

  "apiContract": [
    {
      "method": "POST",
      "path": "/api/pins",
      "auth": "bearer",
      "description": "Permanently pin an element"
    }
  ],

  "buildSequence": [
    {
      "step": 1,
      "requirements": ["REQ-001"],
      "description": "Implement state hook",
      "dependsOn": []
    },
    {
      "step": 2,
      "requirements": ["REQ-002"],
      "description": "Shift+Click handler wiring",
      "dependsOn": [1]
    }
  ],

  "testStrategy": [
    {
      "requirementId": "REQ-001",
      "testFile": "src/hooks/__tests__/usePinMode.test.ts",
      "description": "Validates that pin state toggles correctly"
    }
  ],

  "testStrategyLocation": "colocated",

  "research": "Optional. Markdown string with stack/architecture research findings.",

  "build": {
    "started": "2026-02-20",
    "completed": "2026-02-20",
    "techniques": { "tdd": 3, "implementationOnly": 2 },
    "testsPass": 8,
    "testsTotal": 8,
    "decisions": [
      "Used local state instead of context — context would re-render entire tree on every pin"
    ],
    "explanation": "Markdown string with plain-language explanation of the feature. Dashboard renders via md()."
  },

  "packages": [
    { "name": "zustand", "version": "^4.4.0", "purpose": "State management" }
  ],

  "tests": {
    "finalStatus": "PASSED",
    "coverage": { "statements": 92, "branches": 85 },
    "checklist": [
      {
        "id": 1,
        "title": "Pin element via Shift+Click",
        "type": "AUTO",
        "kind": "example",
        "requirementId": "REQ-001",
        "status": "PASS",
        "evidence": "DOM snapshot: PinBar visible with 1 element",
        "fixApplied": null
      },
      {
        "id": 2,
        "title": "Pin-toggle is idempotent for any element count",
        "type": "AUTO",
        "kind": "property",
        "seed": 4242,
        "requirementId": "REQ-002",
        "status": "PASS"
      }
    ],
    "sessions": [
      {
        "date": "2026-02-21",
        "pass": 4,
        "fail": 0,
        "fixes": ["usePinMode toggle fix"]
      }
    ],
    "verificationCheckpoint": {
      "gaps": [],
      "mismatches": [],
      "adjustments": "none"
    },
    "evaluation": [
      {
        "reqId": "REQ-001",
        "acceptancePass": 3,
        "acceptanceTotal": 3,
        "builderPass": 2,
        "builderTotal": 2,
        "verdict": "PASS"
      }
    ],
    "acceptanceTestFile": "test/acceptance/pin-mode.acceptance.test.js",
    "mutationScore": {
      "score": 0.78,
      "killed": 39,
      "survived": 11,
      "timedOut": 0,
      "ranAt": "2026-02-21T16:00:00Z",
      "survivedDetails": [
        {
          "file": "src/hooks/usePinMode.ts",
          "line": 23,
          "mutator": "ConditionalExpression",
          "requirementId": "REQ-001"
        }
      ]
    }
  },

  "refactor": {
    "status": "REFACTORED",
    "improvements": {
      "security": [],
      "performance": [
        {
          "file": "src/hooks/usePinMode.ts",
          "line": 23,
          "issue": "Array.find() in hot path",
          "fix": "Replace with Map",
          "result": "Render time -40%",
          "risk": "LOW"
        }
      ],
      "dry": [],
      "simplification": [],
      "clarity": [],
      "quality": [],
      "errorHandling": []
    },
    "decisions": [
      {
        "decision": "Map instead of Array for pin state",
        "rationale": "PinBar can show 50+ elements — O(1) lookup"
      }
    ],
    "positiveObservations": ["Error boundaries correctly implemented"],
    "failureAnalysis": null,
    "pendingImprovements": []
  },

  "durableDecisions": [
    {
      "decision": "State management for pin-mode",
      "chosen": "Local hook with Map",
      "constraint": "PinBar must render 50+ elements smoothly",
      "rationale": "Context would re-render the entire tree on every pin-toggle",
      "rejected": [
        {
          "option": "Zustand global store",
          "reason": "Overkill for 1 component"
        },
        {
          "option": "React context",
          "reason": "Re-render storm with high-frequency toggles"
        }
      ],
      "date": "2026-02-20"
    }
  ],

  "observations": [
    "Inspector z-index conflict with overlapping modals — suggest: /dev-ship z-index-system"
  ],

  "suggestionsLog": [
    {
      "skill": "project-plan",
      "type": "COMPONENT",
      "name": "Modal",
      "status": "accepted",
      "at": "2026-05-07T14:00:00Z"
    },
    {
      "skill": "dev-ship",
      "type": "COMPONENT",
      "name": "EmptyState",
      "status": "rejected",
      "at": "2026-05-07T15:30:00Z"
    }
  ]
}
```

## Fields per lifecycle phase

**Always present** (written by define):

`name`, `status`, `created`, `depends`, `summary`, `requirements`, `files`, `architecture`, `buildSequence`, `testStrategy`

**Conditional from define:**

- `design` — visual features only
- `apiContract` — backend features only
- `research` — only when stack/architecture research was done
- `requirements[].tuningLevers` — only for mechanic-requirements with numbers/timing
- `requirements[].edgeCases` — only for requirements with interactions/state changes
- `clarifications` — only when gray-area resolution was performed (open branches found)

**Added by build:**

- `build` — summary with techniques, test counts, decisions, explanation
- `packages` — npm/packages added by this feature
- `tests.checklist` — test items with status `"pending"` (initial). Per-item `kind: "example" \| "property"` (default `example`); REQs with `category: "boundary"` automatically get `kind: "property"` with a generated `seed`. See `dev-ship/references/dev-build/techniques/tdd.md` § Pattern Property-based.
- `requirements[].technique` — TDD or implementation-only per REQ
- `requirements[].syncNote` — plain-language explanation of how REQ was built
- `requirements[].status` → `"built"`

**Added by verify:**

- `tests.finalStatus` — `PASSED` (all requirements PASS), `FAILED` (≥1 FAIL), or `PARTIAL` (≥1 BLOCKED or UNCLEAR, 0 FAIL). PARTIAL = build runs, but verification is incomplete — reopen after dependency-fix or clarification. Feature `status` stays `"DONE"` to avoid blocking the pipeline; the signal for incomplete verification lives in `finalStatus`.
- `tests.coverage` — statement/branch coverage
- `tests.sessions` — per-session results
- `tests.checklist[].status` → PASS/FAIL/skip per item
- `tests.evaluation` — per-REQ scoring (acceptancePass, acceptanceTotal, builderPass, builderTotal, verdict)
- `tests.acceptanceTestFile` — path to generated acceptance test (stays in codebase)
- `tests.mutationScore` — **(dev-pipeline only — GUT has no mutation runner)** assertion-strength measurement via Stryker `--incremental`, diff-scoped on `files[].path`. Schema: `{ score: 0..1, killed, survived, timedOut, ranAt, survivedDetails: [{ file, line, mutator, requirementId? }] }`. Survivors mapped to REQs via `tests.checklist[].acceptanceIndex` → `requirements[].acceptance[i]`. Low score on happy-only REQs → AUTO test items in the fix loop. No hard fail; informative signal next to the PASS count.
- `tests.checklist[].kind` — `"example"` (default) or `"property"`. Property tests use fast-check (`@fast-check/vitest`). With `kind: "property"`, `seed` is mandatory for reproducibility.
- `tests.qualityVerdict` — **(game-pipeline only)** aggregate verdict on test quality, rendered as the first output line. game-verify writes a 2-way form `STRONG` | `WEAK` based on PASS-ratio + test-gap observations (GUT has no mutation runner), schema `{ verdict, ranAt, passRatio, testGapCount }`.
- `requirements[].status` → `"PASS"` or `"FAIL"`
- `requirements[].implicitCoverage` — when a requirement is covered by another test (set by PHASE 5d)
- `observations` — findings, suggestions for other features
- `tests.verificationCheckpoint` — acceptance criteria mapping result (gaps, mismatches, adjustments)

**Added by reuse-discovery (dev-ship define phase, project-plan, dev-ship build phase, dev-ship verify phase):**

- `suggestionsLog[]` — maintained by all four pipeline skills that suggest COMPONENT/PAGE todos, and by `design-create` (Build/Convert routes) for gap-discovery (direction-flag `frontend→dev`). Append-only. Schema: `{ skill, type, name, status: "accepted"|"rejected", at, direction? }`. Dedup key: `(name, skill)`. A proposal that was once rejected (`status: "rejected"`) is not re-proposed by the same skill, even if the trigger recurs. A new trigger from a different skill may re-propose (different detection source) — see dedupe logic in the individual skill docs.

**Added by gap-discovery (design-create Build/Convert routes):**

- `frontend.linkedEntities[]` — cross-pipeline traceability: which visual entities (components, pages) link their handler-props to this feature. Schema per item: `{ type: "component"|"page", name, prop }`. Read by dev-ship's build phase to replace stub-handlers with real implementation after build.

**Read by refactor as safety-net baseline:**

- `tests.mutationScore.score` — PHASE 0 pre-flight compares the current Stryker run against this baseline. Drop >5 points, or <60% killed with a missing baseline → warning for user-confirm (no auto-rollback).

**Added by refactor:**

- `refactor.status` — CLEAN, REFACTORED, or ROLLED_BACK
- `refactor.improvements` — per category (security, performance, dry, simplification, clarity, quality, errorHandling)
- `refactor.decisions` — with rationale
- `refactor.positiveObservations`
- `refactor.failureAnalysis` — only for ROLLED_BACK
- `refactor.pendingImprovements` — only for ROLLED_BACK
- `shipped` — `true` if refactor was CLEAN or REFACTORED; feature is now promoted to Dashboard
- `shippedAt` — ISO date string (moment of promotion)
- `shippedSha` — git blob sha of the refactor commit (for "as-shipped" snapshot detection in Dashboard modal)

## Requirement status flow

```
pending → built → PASS
                → FAIL
                → BLOCKED   (external dependency missing)
                → UNCLEAR   (acceptance criteria too vague to test)
```

- `BLOCKED` — test could not run due to an external dependency (service down, missing API key, missing fixture). Signal to reopen: fix dependency, then re-verify.
- `UNCLEAR` — acceptance criteria is too vague to test deterministically ("feels fast", "works well"). Signal to reopen `/dev-ship` (define phase) to formulate concrete criteria.
- `FAIL` remains the default for missing tests without one of the above legitimate reasons — no escape hatch for forgotten tests.

## Refactor status values

`CLEAN` | `REFACTORED` | `ROLLED_BACK`

## Improvement categories

`security` | `performance` | `dry` | `simplification` | `clarity` | `quality` | `errorHandling`

## Risk values

`LOW` | `MED`

## Which skills write to feature.json

**Frontmatter `writes:` convention.** Pipeline-skills declare _parent_ top-level keys (e.g. `feature.tests`, `feature.refactor`, `feature.requirements`), not sub-fields (`feature.tests.qualityVerdict`). Rationale: the handoff-validator (`scripts/check-handoff.py`) matches at parent granularity; sub-field explicitness would require fanning out every new field across all touching skills' frontmatter and yield no extra safety. New `tests.*` fields therefore inherit coverage from the existing `feature.tests` declaration — no frontmatter edit needed when adding `tests.qualityVerdict`, `tests.mutationScore`, etc.

| Skill                        | What they write to feature.json                                                                                                                                        | When     |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| `/dev-ship` (define phase)   | Creates feature.json: header, clarifications, requirements, files, architecture, buildSequence, tests                                                                  | PHASE 3  |
| `/dev-ship` (build phase)    | Enriches: build, packages, tests.checklist (incl. kind/seed for property-tests), requirements (technique/syncNote/status). Reads clarifications as constraints         | PHASE 4C |
| `/dev-ship` (verify phase)   | Enriches: tests (evaluation/acceptanceTestFile/finalStatus/coverage/sessions/checklist status/verificationCheckpoint/mutationScore), requirements status, observations | PHASE 6  |
| `/dev-ship` (refactor phase) | Enriches: refactor (status/improvements/decisions/observations), status → DONE. Reads tests.mutationScore as PHASE 0 baseline                                          | PHASE 5  |
| `/game-define`               | Creates feature.json (same as dev-ship's define phase + clarifications, game-specific design fields)                                                                   | PHASE 4  |
| `/game-build`                | Enriches: build, tests.checklist (playtest items), requirements. Reads clarifications as constraints                                                                   | PHASE 5  |
| `/game-verify`               | Enriches: tests (incl. verificationCheckpoint), requirements status, observations                                                                                      | PHASE 6  |
| `/game-refactor`             | Enriches: refactor, status → DONE                                                                                                                                      | PHASE 5  |
