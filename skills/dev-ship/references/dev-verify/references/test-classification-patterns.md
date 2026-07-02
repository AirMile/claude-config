# Test Classification — Patterns Reference

Loaded by the AUTO agent in PHASE 1 when writing test specs. Not needed for initial classification.

---

## Auto Test Patterns

**BROWSER patterns** (playwright-cli daemon):

| Pattern               | Steps                                                                                               |
| --------------------- | --------------------------------------------------------------------------------------------------- |
| Form submit           | navigate, fill_form, click submit, snapshot (check success state)                                   |
| Route protection      | navigate to protected URL, snapshot (check redirect to login)                                       |
| Element presence      | navigate, snapshot, find element text/role in snapshot                                              |
| URL state             | interact, evaluate(() => location.href)                                                             |
| Keyboard navigation   | press_key (Tab/Enter/Esc), snapshot (check focus state)                                             |
| Responsive layout     | resize per breakpoint, take_screenshot. Presets: Desktop 1920×1080, Tablet 768×1024, Mobile 375×667 |
| Error validation      | fill invalid input, submit, snapshot (check error messages)                                         |
| Toast/notification    | trigger action, wait_for(text), snapshot (check notification)                                       |
| Cookie/consent banner | wait_for(text: "Accept"/"OK"/"I agree", timeout: 3s), click dismiss, snapshot (verify banner gone)  |

**A11Y patterns** (axe-core injection):

Inject axe-core before any A11Y scan:

```js
evaluate(() => {
  const s = document.createElement("script");
  s.src = "https://cdnjs.cloudflare.com/ajax/libs/axe-core/4.10.2/axe.min.js";
  document.head.appendChild(s);
  return new Promise((r) => (s.onload = r));
});
```

| Pattern            | Steps                                                                          |
| ------------------ | ------------------------------------------------------------------------------ |
| axe-core scan      | navigate, inject axe, evaluate(() => axe.run()), check violations              |
| Heading hierarchy  | navigate, snapshot, verify h1→h2→h3 order                                      |
| ARIA labels        | navigate, snapshot, verify interactive elements have accessible names          |
| Color contrast     | navigate, inject axe, evaluate(() => axe.run({ runOnly: ['color-contrast'] })) |
| Keyboard tab order | press_key Tab × N, snapshot per focus, verify logical order                    |
| Form labels        | navigate, snapshot, verify all inputs have associated labels                   |

**CLI patterns** (bash commands):

| Pattern             | Steps                                                                             |
| ------------------- | --------------------------------------------------------------------------------- |
| API auth check      | curl endpoint without/with token → check HTTP status (401/403/200)                |
| API response body   | curl endpoint → parse JSON, check expected fields/values                          |
| API validation      | curl POST with invalid data → check 400 + error message                           |
| Existing test suite | npm test / npx vitest / npx playwright test → check exit code                     |
| Type checking       | npx tsc --noEmit → check exit code + error count                                  |
| DB state            | query command → check result matches expected                                     |
| Dev server detect   | curl HEAD on common ports (3000, 3001, 5173, 8080) → first 200 response is target |

---

## Post-Build Classification Override

When `feature.json` has a `build` section (dev-build completed):

**Principle:** dev-build tests verify per-requirement logic. dev-verify writes acceptance tests and verifies integrated behavior. The existing test suite is a baseline gate, not a test item.

| Original Classification             | Post-Build Override        | Condition                                       |
| ----------------------------------- | -------------------------- | ----------------------------------------------- |
| Any (httpContractTested + no delta) | **COVERED**                | Build tests cover HTTP contract, no extra delta |
| AUTO/CLI "Existing test suite"      | AUTO/BROWSER               | Feature has UI, delta exists                    |
| AUTO/CLI "Existing test suite"      | AUTO/CLI "API integration" | Pure API feature, delta exists                  |
| AUTO/CLI (specific command)         | Unchanged                  | Build, typecheck, file state                    |
| AUTO/BROWSER                        | Unchanged                  | Already E2E                                     |
| MANUAL                              | Unchanged                  | Subjective judgment                             |
| Integration scenario                | AUTO (never COVERED)       | Cross-req is always new verification            |

**Post-build patterns:**

| Pattern               | Steps                                                          |
| --------------------- | -------------------------------------------------------------- |
| E2E user flow         | navigate → fill_form → submit → verify redirect + success      |
| Cross-page flow       | action page A → navigate B → verify state carries over         |
| API integration chain | curl POST (create) → curl GET (verify) → curl DELETE (cleanup) |
| Cross-requirement     | complete flow A → verify that flow B is correctly affected     |
