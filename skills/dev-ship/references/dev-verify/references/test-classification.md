# Dev Verify — Classify and Plan Test Execution (PHASE 0 Step 8)

Full heuristics for step 8 (baseline run, mode flags, token scan, COMPONENT matrix item, integration scenarios, display rules, goal-backward verification) plus the per-item classification criteria (COVERED/AUTO/MANUAL) they rely on.

---

## Classify and Plan (step 8 flow)

a) **Baseline check**: `npm test 2>&1 | tail -20` (or project-specific command). (can run in parallel with the Explore agent in Step 7 to save time)
Display: `BASELINE: npm test → {PASS|FAIL} ({n}/{n})`

b) **Detect mode flags:**

```
hasUI = feature.json has "design" field OR files[] contains frontend files (.tsx, .vue, .svelte)
isPureAPI = feature.json has "apiContract" AND NOT hasUI
isComponent = IS_COMPONENT_VERIFY === true
```

**Token scan** (only if `hasUI = true` or `isComponent = true`):

Grep all files in `feature.json files[]` matching `.tsx`, `.jsx`, `.vue`, `.svelte` for TOKENS.md T101 (`#[0-9a-fA-F]{3,8}` in JSX/className) and T102 (`bg-\[#`, `text-\[#`). Violations found → add AUTO/CLI test item: `"Token violations: {N} hardcoded values (T101/T102)"`, fix directly via `shared/TOKENS.md` mapping. No violations → skip (no output).

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
- `httpContractTested: false` → classify based on steps/hasUI/isPureAPI per § Test Classification below
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

---

## Test Classification

Each test item is classified as **COVERED**, **AUTO**, or **MANUAL** before testing begins.

- **COVERED** — build tests already verify this item's contract (only in post-build mode)
- **AUTO** — can be tested automatically (three sub-methods: BROWSER, CLI, or A11Y)
- **MANUAL** — requires human perception or judgment

AUTO items have three sub-methods — the Task agent picks the best one per item:

### AUTO/BROWSER (Claude-in-Chrome, or the playwright-cli daemon)

Assign AUTO/BROWSER when ALL of the following are true:

- **DOM-verifiable**: pass/fail can be determined by inspecting elements, text content, attributes, or URL state
- **Simple interactions**: test steps are limited to: navigate, click, type, fill_form, select_option, press_key, resize, wait_for
- **Observable outcome**: result is visible in a snapshot, screenshot, or URL

Execution vehicle: prefer Claude-in-Chrome when a live local Chrome is connected (interactive,
ad-hoc — the common case for a single verify item); fall back to the `playwright-cli` daemon
otherwise, or for a scripted/repeatable sweep. See `shared/CLAUDE-IN-CHROME.md` for the tool-loading
ritual and the full decision rule. Caveat for workflow subagents: they reach the
`mcp__claude-in-chrome__*` tools via `ToolSearch` like any other agent, but a headless/remote run
with no live Chrome connected always falls back to Playwright.

### AUTO/CLI (bash commands)

Assign AUTO/CLI when ALL of the following are true:

- **Command-verifiable**: pass/fail can be determined by running a command and checking stdout/stderr/exit code
- **Deterministic output**: the command produces a concrete, parseable result (JSON response, HTTP status code, file contents, test runner output)
- **No human judgment needed**: result is objectively pass or fail

Common AUTO/CLI scenarios:

- API endpoint testing (curl + check HTTP status/response body)
- Database state verification (query + check result)
- File system checks (file exists, contents match)
- Running existing test suites (npm test, npx vitest, npx playwright test)
- Build verification (npm run build + check exit code)
- Linting/type checking (npx tsc --noEmit, npx eslint)

### AUTO/A11Y (accessibility checks via browser)

Assign AUTO/A11Y when ALL of the following are true:

- **Programmatically verifiable**: pass/fail determined by automated a11y scan or DOM inspection
- **WCAG-based**: check maps to a concrete WCAG 2.2 success criterion
- **No assistive tech needed**: doesn't require actual screen reader or physical device

Execution detail (axe-core injection snippet + common A11Y patterns): `references/test-classification-patterns.md § A11Y patterns` — loaded by the Task agent, not needed for classification.

### MANUAL (human walkthrough)

Assign MANUAL **only** when human perception or judgment is truly required — if it can be objectively checked, it's AUTO. **When in doubt, it is AUTO.**

**Contract**: every MANUAL item carries a `manualReason` field naming exactly one criterion from the
list below. An item with no `manualReason`, or one that doesn't match any of these, is not a valid
MANUAL item — reclassify it as AUTO instead of returning it in `remainingManualItems`.

MANUAL when ANY of the following are true (the matching `manualReason` value in parens):

- **Subjective visual quality** (`perception`): animation smoothness, design "feel", whitespace balance, color harmony
- **Perception-based** (`perception`): "feels fast enough", "feels intuitive", "looks professional"
- **Assistive technology** (`screen-reader`): screen reader flow, VoiceOver experience
- **Audio/sound** (`audio`): sounds play correctly, volume appropriate, timing right
- **Physical multi-device** (`physical-device`): "log out on phone, log in on desktop" (requires actual second device)
- **Real-credential auth** (`real-credentials`): a login/flow that requires a genuine third-party account, OAuth consent, or production credentials no test double can stand in for

NOT MANUAL (these are AUTO):

- Data correctness in charts/tables/lists → AUTO/BROWSER (snapshot + check values)
- Element exists on page → AUTO/BROWSER (snapshot)
- Correct text/numbers displayed → AUTO/BROWSER (snapshot)
- API returns expected data → AUTO/CLI (curl + check response)
- Component renders with props → AUTO/BROWSER (navigate + snapshot)
- Redirect happens after action → AUTO/BROWSER (navigate + check URL)
- Error messages appear → AUTO/BROWSER (trigger error + snapshot)
- Multi-step flows with deterministic outcomes → AUTO/BROWSER (sequence of actions + snapshots)
- Heading hierarchy, alt text, ARIA labels, contrast ratio → AUTO/A11Y
- Keyboard tab order (logical sequence) → AUTO/A11Y

### COVERED (post-build only)

Assign COVERED when ALL of the following are true:

- **Post-build mode is active** (feature.json has `build` section)
- **Baseline passes** (npm test → all green)
- **Build tests already verify the HTTP/function contract** for this item (`httpContractTested: true` from Explore agent)
- **No meaningful delta** beyond what build tests cover (`delta: "none"`)

COVERED items:

- Are NOT sent to the Task agent for execution
- Count as PASS automatically (verified by baseline test suite)
- Are displayed in the classification table with reason "Build tests cover contract"

NOT COVERED (even when build tests exist):

- Cross-requirement integration scenarios — always AUTO (new verification by definition)
- Items where build tests only test function-level but the item requires HTTP contract verification
- Items with external dependencies not covered by build tests (e.g., email delivery, third-party API responses)
- Items where the Explore agent identifies a meaningful delta

> Test patterns (BROWSER/CLI/A11Y) and post-build override table: `references/test-classification-patterns.md` — load when writing test specs or applying post-build overrides.
