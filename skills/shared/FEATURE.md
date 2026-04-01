# Feature file: feature.json Format

Elke feature wordt opgeslagen als **één bestand**: `.project/features/{feature-name}/feature.json`. Dit bestand wordt progressief verrijkt door elke skill in de pipeline.

**Bestandsnaam:** altijd `feature.json` (niet `define.json`, `build.json`, etc.)

**Lifecycle:**

```
/dev-define   → creates feature.json (header, requirements, files, architecture, choices)
/dev-build    → enriches (build summary, decisions, syncNotes, packages, tests.checklist)
/dev-verify   → enriches (evaluation, acceptance tests, test results, coverage, observations)
/dev-refactor → enriches (improvements, positive observations)
```

**Write patroon voor skills na define:**

```
1. Read feature.json
2. Merge de relevante sectie (NIET andere secties overschrijven)
3. Update status
4. Write feature.json als JSON.stringify(data, null, 2)
```

## feature.json schema

```json
{
  "name": "pin-mode",
  "status": "DONE",
  "created": "2026-02-20",
  "depends": ["clipboard-redesign"],
  "summary": "Shift+Click multi-select voor inspect overlay",

  "choices": {
    "coreFunction": "Multi-select voor vergelijking",
    "patterns": "Zustand store met Map"
  },

  "clarifications": [
    {
      "question": "Wat als max pins bereikt en gebruiker nog een pint?",
      "answer": "Blokkeren met visuele feedback",
      "impact": "REQ-001 edge case"
    }
  ],

  "requirements": [
    {
      "id": "REQ-001",
      "description": "Shift+Click op element pint het",
      "category": "core",
      "acceptance": "Element heeft pinned state na Shift+Click",
      "technique": "TDD",
      "syncNote": "Hook exposes togglePin(id), pinnedIds array, clearAll. Uses Map internally for O(1) lookup.",
      "status": "PASS",
      "tuningLevers": [
        {
          "parameter": "max_pins",
          "default": 10,
          "min": 1,
          "max": 50,
          "impact": "Hoeveel elementen tegelijk vergelijkbaar"
        }
      ],
      "edgeCases": ["Wat als max pins bereikt en gebruiker nog een pint?"],
      "implicitCoverage": "REQ-002 test also validates this via integration flow"
    }
  ],

  "files": [
    {
      "path": "src/hooks/usePinMode.ts",
      "type": "source",
      "action": "create",
      "purpose": "State management voor pin mode",
      "requirements": ["REQ-001"]
    },
    {
      "path": "src/components/Inspector.tsx",
      "type": "source",
      "action": "modify",
      "purpose": "Shift+Click handler toevoegen",
      "requirements": ["REQ-002"]
    },
    {
      "path": "src/hooks/__tests__/usePinMode.test.ts",
      "type": "test",
      "action": "create",
      "purpose": "Valideert pin state toggling",
      "requirements": ["REQ-001"]
    }
  ],

  "design": {
    "wireframe": "ASCII wireframe tekst (alleen visuele features)",
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
      "description": "Pin een element permanent op"
    }
  ],

  "buildSequence": [
    {
      "step": 1,
      "requirements": ["REQ-001"],
      "description": "State hook implementeren",
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
      "description": "Valideert dat pin state correct toggled"
    }
  ],

  "testStrategyLocation": "colocated",

  "research": "Optioneel. Markdown string met stack/architecture research bevindingen.",

  "build": {
    "started": "2026-02-20",
    "completed": "2026-02-20",
    "techniques": { "tdd": 3, "implementationFirst": 2 },
    "testsPass": 8,
    "testsTotal": 8,
    "decisions": [
      "Used local state instead of context — context would re-render entire tree on every pin"
    ],
    "explanation": "Markdown string met plain-language uitleg van de feature. Dashboard rendert via md()."
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
        "requirementId": "REQ-001",
        "status": "PASS",
        "evidence": "DOM snapshot: PinBar zichtbaar met 1 element",
        "fixApplied": null
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
    "acceptanceTestFile": "test/acceptance/pin-mode.acceptance.test.js"
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
          "fix": "Vervangen door Map",
          "result": "Render tijd -40%",
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
        "decision": "Map ipv Array voor pin state",
        "rationale": "PinBar kan 50+ elementen tonen — O(1) lookup"
      }
    ],
    "positiveObservations": ["Error boundaries correct geïmplementeerd"],
    "failureAnalysis": null,
    "pendingImprovements": []
  },

  "observations": [
    "Inspector z-index conflict bij overlapping modals — suggest: /dev-define z-index-system"
  ]
}
```

## Velden per lifecycle fase

**Altijd aanwezig** (geschreven door define):

`name`, `status`, `created`, `depends`, `summary`, `choices`, `requirements`, `files`, `architecture`, `buildSequence`, `testStrategy`

**Conditioneel van define:**

- `design` — alleen visuele features
- `apiContract` — alleen backend features
- `research` — alleen als stack/architecture research gedaan
- `requirements[].tuningLevers` — alleen bij mechanica-requirements met getallen/timing
- `requirements[].edgeCases` — alleen bij requirements met interacties/state changes
- `clarifications` — alleen als gray-area resolution is uitgevoerd (open branches gevonden)

**Toegevoegd door build:**

- `build` — summary met techniques, test counts, decisions, explanation
- `packages` — npm/packages die deze feature toevoegde
- `tests.checklist` — test items met status `"pending"` (initieel)
- `requirements[].technique` — TDD of implementation-first per REQ
- `requirements[].syncNote` — plain-language uitleg hoe REQ is gebouwd
- `requirements[].status` → `"built"`

**Toegevoegd door verify:**

- `tests.finalStatus` — VERIFIED, PASSED, of FAILED
- `tests.coverage` — statement/branch coverage
- `tests.sessions` — per-sessie resultaten
- `tests.checklist[].status` → PASS/FAIL/skip per item
- `tests.evaluation` — per-REQ scoring (acceptancePass, acceptanceTotal, builderPass, builderTotal, verdict)
- `tests.acceptanceTestFile` — pad naar gegenereerde acceptance test (blijft in codebase)
- `requirements[].status` → `"PASS"` of `"FAIL"`
- `requirements[].implicitCoverage` — wanneer requirement gedekt is door een andere test (set door FASE 5d)
- `observations` — bevindingen, suggesties voor andere features
- `tests.verificationCheckpoint` — acceptance criteria mapping resultaat (gaps, mismatches, adjustments)

**Toegevoegd door refactor:**

- `refactor.status` — CLEAN, REFACTORED, of ROLLED_BACK
- `refactor.improvements` — per categorie (security, performance, dry, simplification, clarity, quality, errorHandling)
- `refactor.decisions` — met rationale
- `refactor.positiveObservations`
- `refactor.failureAnalysis` — alleen bij ROLLED_BACK
- `refactor.pendingImprovements` — alleen bij ROLLED_BACK

## Requirement status flow

```
pending → built → PASS
                → FAIL
```

## Refactor status waarden

`CLEAN` | `REFACTORED` | `ROLLED_BACK`

## Improvement categorieën

`security` | `performance` | `dry` | `simplification` | `clarity` | `quality` | `errorHandling`

## Risk waarden

`LOW` | `MED`

## Welke skills schrijven naar feature.json

| Skill            | Wat schrijven naar feature.json                                                                                                                          | Wanneer |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| `/dev-define`    | Creates feature.json: header, choices, clarifications, requirements, files, architecture, buildSequence, tests                                           | FASE 3  |
| `/dev-build`     | Enriches: build, packages, tests.checklist, requirements (technique/syncNote/status). Leest clarifications als constraints                               | FASE 4C |
| `/dev-verify`    | Enriches: tests (evaluation/acceptanceTestFile/finalStatus/coverage/sessions/checklist status/verificationCheckpoint), requirements status, observations | FASE 6  |
| `/dev-refactor`  | Enriches: refactor (status/improvements/decisions/observations), status → DONE                                                                           | FASE 5  |
| `/game-define`   | Creates feature.json (zelfde als dev-define + clarifications, game-specifieke design velden)                                                             | FASE 4  |
| `/game-build`    | Enriches: build, tests.checklist (playtest items), requirements. Leest clarifications als constraints                                                    | FASE 5  |
| `/game-test`     | Enriches: tests (incl. verificationCheckpoint), requirements status, observations                                                                        | FASE 6  |
| `/game-refactor` | Enriches: refactor, status → DONE                                                                                                                        | FASE 5  |
