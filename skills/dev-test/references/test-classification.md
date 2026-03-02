# Dev Test — Test Classification Reference

Detailed classification criteria and automation patterns for the dev-test skill.
Extracted from SKILL.md for progressive disclosure (Anthropic skill spec).

---

## Test Classification

Each test item is classified as **AUTO** or **MANUAL** before testing begins.

AUTO items have two sub-methods — the Task agent picks the best one per item:

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

### MANUAL (human walkthrough)

Assign MANUAL **only** when human perception or judgment is truly required — if it can be objectively checked, it's AUTO.

MANUAL when ANY of the following are true:

- **Subjective visual quality**: animation smoothness, design "feel", whitespace balance, color harmony
- **Perception-based**: "feels fast enough", "feels intuitive", "looks professional"
- **Assistive technology**: screen reader flow, VoiceOver, keyboard-only UX feel
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

**Principe:** dev-build tests verifiëren per-requirement logica (unit niveau). dev-test verifieert geïntegreerd gedrag (E2E). Bestaande test suite draaien is een baseline gate, geen test item.

**Override regels:**

| Originele Classificatie        | Post-Build Override       | Conditie                     |
| ------------------------------ | ------------------------- | ---------------------------- |
| AUTO/CLI "Existing test suite" | AUTO/BROWSER              | Feature heeft UI             |
| AUTO/CLI "Existing test suite" | AUTO/CLI "API integratie" | Pure API feature             |
| AUTO/CLI (specifiek command)   | Ongewijzigd               | Build, typecheck, file state |
| AUTO/BROWSER                   | Ongewijzigd               | Al E2E verificatie           |
| MANUAL                         | Ongewijzigd               | Subjectief oordeel           |

**Post-build specifieke patronen:**

| Pattern              | Steps                                                          |
| -------------------- | -------------------------------------------------------------- |
| E2E user flow        | navigate → fill_form → submit → verify redirect + success      |
| Cross-page flow      | actie pagina A → navigeer B → verify state carries over        |
| API integratie chain | curl POST (create) → curl GET (verify) → curl DELETE (cleanup) |
| Cross-requirement    | complete flow A → verify dat flow B correct beïnvloed is       |
