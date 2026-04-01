# Dev Verify — Test Classification Reference

Detailed classification criteria and automation patterns for the dev-verify skill.
Extracted from SKILL.md for progressive disclosure (Anthropic skill spec).

---

## Test Classification

Each test item is classified as **COVERED**, **AUTO**, or **MANUAL** before testing begins.

- **COVERED** — build tests already verify this item's contract (only in post-build mode)
- **AUTO** — can be tested automatically (three sub-methods: BROWSER, CLI, or A11Y)
- **MANUAL** — requires human perception or judgment

AUTO items have three sub-methods — the Task agent picks the best one per item:

### AUTO/BROWSER (MCP browser tools)

Assign AUTO/BROWSER when ALL of the following are true:

- **DOM-verifiable**: pass/fail can be determined by inspecting elements, text content, attributes, or URL state
- **Simple interactions**: test steps are limited to: navigate, click, type, fill_form, select_option, press_key, resize, wait_for
- **Observable outcome**: result is visible in a snapshot, screenshot, or URL

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

axe-core injection (Task agent does this before any A11Y scan):

```js
evaluate(() => {
  const s = document.createElement("script");
  s.src = "https://cdnjs.cloudflare.com/ajax/libs/axe-core/4.10.2/axe.min.js";
  document.head.appendChild(s);
  return new Promise((r) => (s.onload = r));
});
```

Common AUTO/A11Y scenarios:

| Pattern            | Steps                                                                          |
| ------------------ | ------------------------------------------------------------------------------ |
| axe-core scan      | navigate, inject axe, evaluate(() => axe.run()), check violations              |
| Heading hierarchy  | navigate, snapshot, verify h1→h2→h3 order (no skipped levels)                  |
| Image alt text     | navigate, snapshot, verify all `<img>` have meaningful alt                     |
| ARIA labels        | navigate, snapshot, verify interactive elements have accessible names          |
| Color contrast     | navigate, inject axe, evaluate(() => axe.run({ runOnly: ['color-contrast'] })) |
| Keyboard tab order | press_key Tab × N, snapshot per focus, verify logical order                    |
| Focus visible      | press_key Tab, snapshot, verify focus indicator visible                        |
| Form labels        | navigate, snapshot, verify all inputs have associated labels                   |
| Skip navigation    | press_key Tab (first), snapshot, verify skip link present                      |
| Language attribute | evaluate(() => document.documentElement.lang), verify non-empty                |

### MANUAL (human walkthrough)

Assign MANUAL **only** when human perception or judgment is truly required — if it can be objectively checked, it's AUTO.

MANUAL when ANY of the following are true:

- **Subjective visual quality**: animation smoothness, design "feel", whitespace balance, color harmony
- **Perception-based**: "feels fast enough", "feels intuitive", "looks professional"
- **Assistive technology**: screen reader flow, VoiceOver experience
- **Audio/sound**: sounds play correctly, volume appropriate, timing right
- **Physical multi-device**: "log out on phone, log in on desktop" (requires actual second device)

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
- **No meaningful delta** beyond what build tests cover (`delta: "geen"`)

COVERED items:

- Are NOT sent to the Task agent for execution
- Count as PASS automatically (verified by baseline test suite)
- Are displayed in the classification table with reason "Build test dekken contract"

NOT COVERED (even when build tests exist):

- Cross-requirement integration scenarios — always AUTO (new verification by definition)
- Items where build tests only test function-level but the item requires HTTP contract verification
- Items with external dependencies not covered by build tests (e.g., email delivery, third-party API responses)
- Items where the Explore agent identifies a meaningful delta

### Auto Test Patterns Reference

**BROWSER patterns** (MCP browser tools):

| Pattern               | Steps                                                                                                              |
| --------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Form submit           | navigate, fill_form, click submit, snapshot (check success state)                                                  |
| Route protection      | navigate to protected URL, snapshot (check redirect to login)                                                      |
| Element presence      | navigate, snapshot, find element text/role in snapshot                                                             |
| URL state             | interact, evaluate(() => location.href)                                                                            |
| Keyboard navigation   | press_key (Tab/Enter/Esc), snapshot (check focus state)                                                            |
| Responsive layout     | resize per breakpoint, take_screenshot (check layout). Presets: Desktop 1920×1080, Tablet 768×1024, Mobile 375×667 |
| Error validation      | fill invalid input, submit, snapshot (check error messages)                                                        |
| Toast/notification    | trigger action, wait_for(text), snapshot (check notification)                                                      |
| Cookie/consent banner | wait_for(text: "Accept"/"OK"/"I agree", timeout: 3s), click dismiss, snapshot (verify banner gone)                 |

**CLI patterns** (bash commands):

| Pattern             | Steps                                                                             |
| ------------------- | --------------------------------------------------------------------------------- |
| API auth check      | curl endpoint without/with token → check HTTP status (401/403/200)                |
| API response body   | curl endpoint → parse JSON, check expected fields/values                          |
| API validation      | curl POST with invalid data → check 400 + error message                           |
| Existing test suite | npm test / npx vitest / npx playwright test → check exit code                     |
| Type checking       | npx tsc --noEmit → check exit code + error count                                  |
| Build verification  | npm run build → check exit code                                                   |
| File state          | cat/read file → check contents match expected                                     |
| DB state            | query command → check result matches expected                                     |
| Dev server detect   | curl HEAD on common ports (3000, 3001, 5173, 8080) → first 200 response is target |

---

### Post-Build Classification Override

Wanneer `feature.json` een `build` sectie heeft (dev-build is voltooid, tests bestaan al):

**Principe:** dev-build tests verifiëren per-requirement logica (unit niveau). dev-verify schrijft acceptance tests vanuit de spec en verifieert geïntegreerd gedrag (E2E). Bestaande test suite draaien is een baseline gate, geen test item.

**Override regels:**

| Originele Classificatie               | Post-Build Override       | Conditie                                           |
| ------------------------------------- | ------------------------- | -------------------------------------------------- |
| Any (httpContractTested + geen delta) | **COVERED**               | Build tests dekken HTTP contract, geen extra delta |
| AUTO/CLI "Existing test suite"        | AUTO/BROWSER              | Feature heeft UI, delta bestaat                    |
| AUTO/CLI "Existing test suite"        | AUTO/CLI "API integratie" | Pure API feature, delta bestaat                    |
| AUTO/CLI (specifiek command)          | Ongewijzigd               | Build, typecheck, file state                       |
| AUTO/BROWSER                          | Ongewijzigd               | Al E2E verificatie                                 |
| MANUAL                                | Ongewijzigd               | Subjectief oordeel                                 |
| Integratie-scenario (5c)              | AUTO (nooit COVERED)      | Cross-req is altijd nieuwe verificatie             |

**Post-build specifieke patronen:**

| Pattern              | Steps                                                          |
| -------------------- | -------------------------------------------------------------- |
| E2E user flow        | navigate → fill_form → submit → verify redirect + success      |
| Cross-page flow      | actie pagina A → navigeer B → verify state carries over        |
| API integratie chain | curl POST (create) → curl GET (verify) → curl DELETE (cleanup) |
| Cross-requirement    | complete flow A → verify dat flow B correct beïnvloed is       |
