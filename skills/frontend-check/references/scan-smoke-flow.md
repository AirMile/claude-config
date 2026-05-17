# 1.8 Smoke Scan + 1.9 Flow Scan

## 1.8 Smoke Scan

Lightweight health check over all routes. Read routes in order of precedence:

1. `project.json → context.routing`
2. `design.pages[].name` if routing is missing
3. **Fallback** if both are absent: only check `/` (the target URL) + warn user: "No routes list found — only entry URL checked. Run `/frontend-design` or fill `project.json → context.routing` to smoke all routes."

Per route:

```
playwright-cli goto [route]
playwright-cli run-code "async p => { await p.waitForLoadState('networkidle'); }"
playwright-cli console error
→ Filter output against PLAYWRIGHT.md → Default Ignore Patterns before reporting; only unfiltered lines become findings.
playwright-cli requests
→ Check: no status 4xx/5xx
```

Output per route:

```
[route]  [status: ✓ OK | ✗ FAIL]  [errors: N]  [failed-requests: N]
```

Findings re-use P004 (runtime errors), P005 (failed requests). No new IDs.

Smoke table final report:

```
SMOKE CHECK
───────────────────────────────────────────────
Route               Status   Errors   Req fails
/                   ✓ OK     0        0
/dashboard          ✗ FAIL   2        1
/settings           ✓ OK     0        0
───────────────────────────────────────────────
Routes: [N] total, [M] failing
```

## 1.9 Flow Scan

Read `.project/project.json → design.flows[]`. Per flow:

1. Map each step (page name) → URL via `project.json → context.routing`
   - If no mapping found: finding F002 + skip step
2. Per step:
   ```
   playwright-cli goto [url]
   playwright-cli run-code "async p => { await p.waitForLoadState('networkidle'); }"
   playwright-cli console error
   → Filter against PLAYWRIGHT.md → Default Ignore Patterns
   playwright-cli screenshot --filename=.project/screenshots/flow-[name]-step[N].png
   ```
3. **Stop at first fail** + screenshot of break-point as finding F001
4. If auth configured in 1.0: use `state-load .project/auth-state.json` before first goto

Findings:

- **F001 (CRITICAL)**: flow broke at step N — [reason: 404 / runtime error / content not rendered]
- **F002 (HIGH)**: step page not mapped in routing — page name `X` unknown in context.routing

Flow output per step:

```
FLOW: [flow-name]
─────────────────
Step 1 [page-name] → [url]  ✓ OK  [screenshot]
Step 2 [page-name] → [url]  ✗ FAIL — runtime error: "Cannot read properties of undefined"
→ STOPPED (first fail)
```

**Codegen option for flows with interaction:**

If flow steps require interaction (click, fill, etc.) beyond navigation:

```yaml
header: "Flow interactions"
question: "Flow '{name}' may have interaction steps. How to proceed?"
options:
  - label: "Generate spec via codegen (Recommended)"
    description: "npx playwright codegen {url} — navigate the flow yourself, Playwright records it as a spec in .project/playwright-runs/flow-{name}.spec.ts"
  - label: "Navigation only (v1)"
    description: "Only execute goto steps — clicks and fills are skipped"
  - label: "Walk manually"
    description: "I'll walk the flow myself and provide feedback via PHASE 2 manual walkthrough"
multiSelect: false
```

If "codegen chosen": instruct user to run `npx playwright codegen {base_url}` in a separate terminal and navigate the flow. Save generated spec as `.project/playwright-runs/flow-{name}.spec.ts`. Then run via runner: `npx playwright test .project/playwright-runs/flow-{name}.spec.ts --config=.project/playwright-runs/playwright.config.ts --trace on`.

**Trace on Flow failure (F001):**

If runner spec was run: trace automatically available. Add to F001 finding:

```
Trace: npx playwright show-trace .project/playwright-runs/test-results/flow-{name}-*/trace.zip
```

If daemon-only: add to report: `"Repeat with codegen → runner for interactive debug timeline"`.

**Constraint v1:** flow only performs navigation (no click interactions within pages) unless codegen option was chosen. Interaction steps require `design.flows[].steps` enrichment with action data for a complete script without codegen.
