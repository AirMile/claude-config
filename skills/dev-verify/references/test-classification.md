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

### AUTO/BROWSER (playwright-cli daemon)

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
- **No meaningful delta** beyond what build tests cover (`delta: "none"`)

COVERED items:

- Are NOT sent to the Task agent for execution
- Count as PASS automatically (verified by baseline test suite)
- Are displayed in the classification table with reason "Build test dekken contract"

NOT COVERED (even when build tests exist):

- Cross-requirement integration scenarios — always AUTO (new verification by definition)
- Items where build tests only test function-level but the item requires HTTP contract verification
- Items with external dependencies not covered by build tests (e.g., email delivery, third-party API responses)
- Items where the Explore agent identifies a meaningful delta

> Test patterns (BROWSER/CLI/A11Y) and post-build override table: `references/test-classification-patterns.md` — load when writing test specs or applying post-build overrides.
