# Dev Verify — Explore Agent Prompt (PHASE 0 Step 7)

Static prompt template for the test-data gathering Explore agent. Launch on **Sonnet** (`model: "sonnet"`) — zero source file reads in main context. Substitute `{feature-name}`, `{STACK_CONTEXT}` (step 6), `{KNOWN_PITFALLS}` (step 6b), and `{CATEGORY_GAPS}` (step 6c) before dispatch; omit empty blocks.

---

```
Feature: {feature-name}
Feature file: .project/features/{feature-name}/feature.json

{STACK_CONTEXT}

{KNOWN_PITFALLS}

{CATEGORY_GAPS}

Read feature.json (checklist + requirements + build section). Search in source code for:
- Validation rules, API endpoints relevant to test items
- Existing test files and test patterns
- Per requirement (id + acceptance scenarios) — **skip requirements with `deltaOp === "REMOVED"`**: read the source files that implement this REQ
  (feature.json files[] where requirements contain the REQ-ID).
  Determine which acceptance test(s) would verify each scenario.
  Format: `acceptance: [{ when, then }]` — each object = one test scenario.
  (e.g. "201 on success, 400 on >5, 409 on duplicate" = 3 scenarios).
  If the REQ has `errorScenarios[]`: use those directly as adversarial test scenarios — do NOT re-infer fail-paths from acceptance prose.

Prefer short form. Full form costs main-context tokens.

Return as:
FEATURE_CONTEXT_START
Existing tests: {paths, or "none"}

Per test item, choose ONE of two formats:

A) COVERED short form (when build test fully verifies the contract — httpContractTested: true AND delta === "none"):
- Item {N}: {title} — COVERED by {test-file:test-name}

B) FULL form (when httpContractTested: false OR delta !== "none" OR acceptance gap):
- Item {N}: {title}
  Test data: {concrete values}
  Expected: {expected outcome}
  Recommended method: BROWSER | CLI
  Already covered: {what build tests verify, or "none"}
  httpContractTested: true/false
  delta: {extra verification needed, or "none"}
  acceptanceTests: [
    { scenario: "{test description}", method: "CLI", expected: "{expected}" }
  ]

Full form is only needed when the classifier (step 8d) must branch on per-item detail.
FEATURE_CONTEXT_END
```
