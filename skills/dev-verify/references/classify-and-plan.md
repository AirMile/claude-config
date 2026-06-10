# Dev Verify — Classify and Plan Test Execution (PHASE 0 Step 8)

Full heuristics for step 8: baseline run, mode flags, token scan, COMPONENT matrix item, cross-requirement integration scenarios, per-item classification, display rules, and goal-backward verification. Per-item classification criteria (COVERED/AUTO/MANUAL definitions): `references/test-classification.md`.

---

a) **Baseline check**: `npm test 2>&1 | tail -20` (or project-specific command). (can run in parallel with the Explore agent in Step 7 to save time)
Display: `BASELINE: npm test → {PASS|FAIL} ({n}/{n})`

b) **Detect mode flags:**

```
hasUI = feature.json has "design" field OR files[] contains frontend files (.tsx, .vue, .svelte)
isPureAPI = feature.json has "apiContract" AND NOT hasUI
isComponent = IS_COMPONENT_VERIFY === true
```

**Token scan** (only if `hasUI = true` or `isComponent = true`):

Grep all files in `feature.json files[]` matching `.tsx`, `.jsx`, `.vue`, `.svelte` for T101 (`#[0-9a-fA-F]{3,8}` in JSX/className) and T102 (`bg-\[#`, `text-\[#`). Violations found → add AUTO/CLI test item: `"Token violations: {N} hardcoded values (T101/T102)"`, fix directly via `shared/TOKENS.md` mapping. No violations → skip (no output).

**COMPONENT extra check** (only if `isComponent = true`): add mandatory test item:

```json
{
  "id": "COMP-MATRIX",
  "title": "Variant matrix visible on demo-page",
  "steps": [
    "Navigate to /_dev/components/{name}",
    "Verify presence of all variants × sizes × states cards"
  ],
  "expected": "All {variants × sizes × states} combinations are visible without errors",
  "type": "AUTO/BROWSER"
}
```

c) **Cross-requirement integration** — Analyze `requirements[]`, identify combinations where output of one requirement is input for another. Max 3 scenarios, add as extra test items (not persisted to feature.json checklist). No logical combinations → skip.

d) **Per item, use Explore agent output:**

- `httpContractTested: true` + `delta: "none"` → **COVERED**
- `httpContractTested: true` + delta → **AUTO/CLI** or **AUTO/BROWSER** (delta only)
- `httpContractTested: false` → classify based on steps/hasUI/isPureAPI per `references/test-classification.md`
- Integration scenarios → always **AUTO** (never COVERED)

e) **Display:**

- One-line summary: `COVERED: {n}  AUTO: {n} (BROWSER: {n}, CLI: {n})  MANUAL: {n}`
- If `AUTO + MANUAL > 0`: show table with ONLY non-COVERED items (Type column + reason).
- If `AUTO + MANUAL == 0` AND `COVERED > 0`: skip table entirely.
- If ALL items are non-COVERED (no build tests cover any contract): show full table.

f) With mixed types (COVERED + AUTO + MANUAL): show ASCII flowchart of the test execution flow. With only COVERED + AUTO/CLI: skip flowchart.

g) Proceed automatically with the recommended classification. No user approval needed — continue directly to step h.

h) **Goal-backward verification + acceptance test planning:**

CATEGORY-GAPs are already computed in step 6c and were passed to the Explore agent. Now consume them:

- Per gap `(REQ.id, category)` in CATEGORY_GAPs: add to AUTO/CLI queue with `source: "category-coverage"`, title `"{category} coverage missing for {REQ.id}"`, and test scenario from the matching `acceptance[]` entry's `{ when, then }`.

Internally map tests back to acceptance criteria. **GAP**: requirement where builder's tests verify internal methods/data structures instead of the acceptance criterion itself.

Per GAP with CLI-testable acceptance tests (from Explore agent `acceptanceTests[]`): add to AUTO/CLI queue (PHASE 1) with `source: "acceptance"` marker.
BROWSER and MANUAL gaps → add items via existing classification (step d).

Display:

- No gaps → single line: `Acceptance mapping: {n}/{n} REQs covered`
- Gaps found → two lines (suppress the second if no category-coverage items were added):
  - `ACCEPTANCE TESTS: {n} test(s) planned for {m} requirement(s) — gaps: {REQ-ID list}`
  - `ADDED {n} checklist items for category coverage: {item-titles}`
- Category-gaps: include in AUTO count and table rows; label with `(category-coverage)` in the Type column.
- Show full GAP-only table ONLY if {m} >= 3 (helps user scan multiple gaps).
