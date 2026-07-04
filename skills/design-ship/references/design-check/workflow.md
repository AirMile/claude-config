# Check (design-ship copy)

> **design-ship copy** — executed by AGENT 3 (check) under the non-interactive contract, inside
> the build worktree. Always **targeted mode** with `targetType = "feature"` and `featureName`
> from your prompt — the batch-mode branches in this file never fire; skip every `$BATCH_MODE`
> block. Auto-scope per the §0.2 table (feature with/without routes) — do not present scope
> modals. **You choose the fixes yourself**: fix scope = All CRITICAL + HIGH (log it in
> `autoDecisions`). The dev server runs against the worktree; `.project/` paths resolve to the
> main repo. Scan procedure files (`scan-*.md`) are read from design-ship's own vendored
> `references/design-check/references/` copies.

Runtime-only audit hub for performance (Lighthouse/CWV), SEO, responsive layout, darkmode pixel diff, error states, smoke, and user flows. Generation-time static checks (token literals, dark/responsive coverage, A11Y static patterns, motion literals) are now enforced during `/design-convert` Convert via `design.principles[].forbid` and `design.banPacks` — they are not repeated here.

**Two modes:**

- **Batch-mode** (no argument): iterate over all features in backlog where `status === "DOING"` (and not already checked at HEAD) or `lastCheckedSha !== shippedSha`. Runs at end of release cycle.
- **Targeted mode**: single feature or URL, all runtime scopes. (This is the only mode design-ship's check runs.)

**Related skills:** `/design-convert` · `/design-tokens` · `/core-setup`

## References

- `.claude/skills/shared/BACKLOG.md` — Backlog HTML+JSON format, read/write protocol
- `.claude/skills/shared/DOMAIN.md` — Domain resolution (web / game / native) — selects the audit path
- `references/scan-godot.md` — Game-domain static audit; runtime/playtest deferred to a human (loaded when `$DOMAIN === "game"`)
- `.claude/skills/shared/CODING-RULES.md` — General (R009)
- `.claude/skills/shared/FRONTEND-RULES.md` — P-series (performance), A-series (accessibility), H-series (responsive/HTML), E-series, F-series
- `.claude/skills/shared/DESIGN.md` — Anti-patterns (AI design tells), motion timing, interaction states
- `.claude/skills/shared/PLAYWRIGHT.md` — Playwright CLI: CWV measurement, multi-viewport captures, overflow detection
- `.claude/skills/shared/PATTERNS.md` — Code splitting, memoization patterns
- `.claude/skills/shared/DEVINFO.md` — Session tracking, cross-skill handoff

---

## Process

**Phase tracking** — first action of the skill: call `TaskCreate` with these 5 items (status `pending`), then use `TaskUpdate` to set each phase to `in_progress` at the start and `completed` at the end. During context compaction the task list stays visible — no risk of forgotten phases.

1. PHASE 0: Pre-flight
2. PHASE 1: Scan
3. PHASE 2: Report
4. PHASE 3: Fix
5. PHASE 4: Re-audit & Completion

## PHASE 0: Pre-flight

> **Todo**: call `TaskCreate` with the 5 phase items (see above). Mark PHASE 0 → `in_progress` via `TaskUpdate`.

### 0.1 Target Selection

**Batch-mode** — if `$1` is empty:

1. Read `.project/backlog.json` → parse features.
2. Collect candidates (HEAD = current commit SHA):
   - `status === "DOING"` AND `lastCheckedSha !== HEAD` — in progress, not yet checked at this commit; OR
   - `status === "DONE"` AND (`!lastCheckedSha` OR `lastCheckedSha !== shippedSha`) — shipped but changed since last check.

   A COMPONENT stays `DOING` until its consuming page ships, but once checked at HEAD it leaves the queue until code changes — so it is not re-audited every run.

3. If no candidates: show `"No features pending runtime audit."` and stop.
4. Set `$BATCH_MODE = true`, `$BATCH_TARGETS = [candidate list]`. Queue presentation + confirmation are owned by `batch.md §0` (auto-proceed ≤3, else confirm) — do not pre-print a queue block here. The full batch flow — queue confirmation, sequential scan + triage, ONE combined report, ONE fix-scope approval, per-feature fix with rollback, single batch completion — is driven entirely by the batch reference. Do NOT run the per-feature single-target loop or per-feature approval prompts.

   **Team-mode batch guard:** If `TEAM_MODE == "team"` → follow `shared/PROJECT-MODE.md § Team-mode batch guard` before proceeding to the batch reference. (Each PAGE ships via its own PR in team mode — batch check produces a combined pass without per-feature finalize.)

> **Batch mode does not run in design-ship** — this is a single-target ship (per the header, batch
> branches never fire). This Todo is inert; no batch reference is read.

Batch-mode skips PHASE 0.2 scope selection (scope is auto-derived per feature from the §0.2 table inside the batch flow).

---

Detect input type via fixed order:

**1. URL** — `$1` starts with `http://` or `https://` → `targetType = "url"`, `urlTarget = $1`

**2. Feature-name** — `$1` has no path separator (`/` or `\`) and no extension, and appears in `.project/backlog.json#data.features[].name`:

- Read `.project/features/{$1}/feature.json`
- If not found → fallback to step 3 (source-path)
- `targetType = "feature"`, `featureName = $1`
- Build targets:
  - `routeTargets = feature.json#architecture.routes[].path` — resolve to full URLs via dev-server base (read from `project.json#devServer` or default `http://localhost:3000`)
  - `fileTargets = feature.json#files[].path` — component/page files for static scopes
- Show confirmation:
  ```
  FEATURE TARGET: {featureName}
  Routes: {N} ({route-list})
  Files:  {N} ({file-list})
  ```

**3. Source-path** — `$1` has path separator or extension, no http-prefix → `targetType = "path"`, `fileTargets = [$1]`

**4. No argument** → AskUserQuestion:

```yaml
header: "Target"
question: "What do you want to check?"
options:
  - label: "Running dev server (Recommended)", description: "Lighthouse + captures on dev server"
  - label: "Specific URL", description: "Enter a URL"
  - label: "Feature", description: "Audit a specific feature — auto-scope on files[] + routes[]"
  - label: "Production build", description: "Build first, then analyze"
  - label: "Quick smoke check", description: "Health check only — all routes in < 2 min"
multiSelect: false
```

- "Quick smoke check" → `scope = [Smoke]`, skip PHASE 0.2
- "Feature" → AskUserQuestion (free text): "Which feature? (kebab-case name)" → feature-target flow from step 2

### 0.2 Scope Selection

**Auto-scope** — if `targetType` is known, detect the optimal scope and confirm first:

| Target type              | Auto-scope                                                                            |
| ------------------------ | ------------------------------------------------------------------------------------- |
| `url`                    | Performance + SEO + AEO + Responsive + Darkmode                                       |
| `path` (component)       | A11Y runtime (focus-trap + axe) + Smoke                                               |
| `feature` with routes    | Performance + SEO + AEO + Responsive + Darkmode + A11Y runtime + Error states + Smoke |
| `feature` without routes | A11Y runtime (focus-trap + axe) + Smoke                                               |

**Auditing a COMPONENT** — pick the mount in this order:

1. **Through its consuming page** — if a page that renders it has a route (built/DONE, or also a candidate in this batch), audit the component via that route. Real context, best coverage, no harness. Find the page via the component's `pageHint[]`, or a page whose `dependencies[]` lists it.
2. **Temporary harness route** — component is the audit target and no page renders it yet: mount it on a throwaway route (realistic props, all variants), run A11Y + Smoke, then remove the route + harness file before completion.
3. **Defer** — incidental and unrendered: record `lastCheckedSha`, note it ships with its page.

If `targetType` is `url`, `path`, or `feature` → show auto-scope confirmation:

```yaml
header: "Scope"
question: "Auto-scope: {detected-scopes}. Continue or adjust?"
options:
  - label: "Continue (Recommended)"
    description: "Use detected scope"
  - label: "Adjust"
    description: "Manually choose which checks to run"
multiSelect: false
```

"Adjust" or no arg (manual target) → full scope selection:

```yaml
header: "Scope"
question: "Which checks do you want to run?"
options:
  - label: "Everything (Recommended)", description: "Performance + SEO + AEO + A11Y runtime + Responsive + Darkmode + Error states + Smoke + Flow + Motion runtime"
  - label: "I'll choose myself", description: "Select specific checks"
multiSelect: false
```

If "I'll choose myself" → present a numbered plain-text list and parse free-form input (10 options exceeds the modal cap; scope selection needs the holistic view — see `shared/SKILL-PATTERNS.md § Modal Option Cap` and `§ Free-form List Selection` for the input syntax: `1, 3-5, 8` / `all` / `none`):

```
Which checks do you want to run?

 1. Performance  — Lighthouse, CWV, bundle sizes
 2. SEO          — Google search optimization
 3. AEO          — AI search optimization (ChatGPT, Perplexity, Gemini)
 4. A11Y         — Accessibility: focus-trap test, aria-snapshot regression, axe-runtime, console warnings (WCAG 2.1 AA)
 5. Responsive   — Multi-viewport layout audit: 6 viewports, overflow, touch targets, font sizes (Playwright)
 6. Darkmode     — Light + dark comparison, computed contrast D102 (Playwright pixel diff)
 7. Error states — 404, offline, slow-3G UI rendering (Playwright)
 8. Smoke        — Quick multi-route health check (200 + render + no errors)
 9. Flow         — Execute design.flows[] from project.json (navigation journeys)
10. Motion       — Runtime reduced-motion compliance: M006/M007 (Playwright emulation)

Pick checks (e.g. `1, 3-5, 8` or `all`):
```

### 0.2.5 Scope Validation

If scope contains **Flow**:

- Read `.project/project.json → design.flows`
- If flows is missing or empty → stop with message:
  > "No flows defined in `design.flows[]`. Run `/design-convert` first to add flows, then re-run the check's Flow scope."
- If flows is non-empty → continue.

### 0.3 Domain & Project Detection

**First resolve `$DOMAIN`** per `shared/DOMAIN.md` (explicit `theme.domain` → infer from
`stack.framework`/`language` → codebase fallback → ask).

- **game** → this is the **static** audit path. Skip the web scope menu (0.2), the Build & Serve
  health gate (0.3.5), and the entire Playwright PHASE 1 (1.1–1.x). Instead run the static
  Theme-consistency checks and defer the runtime/playtest to a human (the interactive playtest lives
  in `/game-ship` PHASE 3). PHASE 2 (report), PHASE 3 (fix), and PHASE 4 (completion) run unchanged
  on the static findings.
  > **Todo**: Read '.claude/skills/design-ship/references/design-check/references/scan-godot.md' and run G1–G5; then jump to PHASE 2.
- **native** → no renderer/runtime yet: print the `shared/DOMAIN.md` native fallback line, run only
  G3 design-principle adherence statically if a spec exists, and stop (no code audit).
- **web** → continue below (the historical runtime path).

Detect framework, bundler, CSS approach, rendering strategy (SSR/SSG/CSR).

```
PRE-FLIGHT COMPLETE
═════════════════════════════════════════════════════════════
Target:     [URL]
Framework:  [Next.js 14 App Router | Vite + React | etc.]
Bundler:    [Webpack | Vite | Turbopack]
Renderer:   [SSR | SSG | CSR | mixed]
CSS:        [Tailwind | CSS Modules | styled-components]
Audits:     [Performance, SEO, AEO, Responsive]
═════════════════════════════════════════════════════════════
```

### 0.3.5 Build & Serve Health Gate

Runtime scans need a compiling app on a reachable dev server — gate before PHASE 1 (in batch mode, once before the sequential scan):

1. Probe the dev-server URL (`project.json#localUrl`/`devServer`, else framework default). If unreachable, start it in the background (`npm run dev`/`start`) and wait until it responds.
2. Confirm the app compiles — watch the dev-server/build log for compile errors, or run the typecheck/build once.
3. If the build fails or the server never serves: emit a CRITICAL build finding (missing deps, typecheck error, …), surface the error, and STOP. Do not scan a non-serving app; re-run once the build is fixed.

### 0.4 Backlog Stage (optional)

Read `.project/backlog.json` (if exists) → parse JSON.

See `shared/BACKLOG.md → Lifecycle Protocol → Read`.

**If `targetType === "feature"`**: match directly on `featureName`. Find `data.features.find(f => f.name === featureName)` → record `f.lastCheckedSha` (current HEAD SHA, updated at end of PHASE 4 after success). Write back via Edit (see `shared/BACKLOG.md § Writing`).

**All other target types**: best-effort match URL/path to a feature name. If match found: same `lastCheckedSha` update at end of PHASE 4.

If no match or no backlog: skip (audit can run on non-backlog pages too).

**Note:** for scope `Smoke` or `Flow` (cross-cutting checks): skip per-feature matching. Do not mark any specific backlog item as `testing`. The checks run project-wide; report findings generally.

---

## PHASE 1: Scan

> **Todo**: mark PHASE 0 → `completed`, PHASE 1 → `in_progress`.

Run all selected checks. Each produces findings with severity + category.

### 1.0 Auth Setup (optional)

Skip entirely if `project.json#stack.auth` is empty — no auth in the project, so the answer is always "no auth needed".

Otherwise, if scope contains Flow, Smoke, or Darkmode:

```yaml
header: "Auth"
question: "Does one or more checks require login?"
options:
  - label: "No auth needed (Recommended)", description: "All checks on public routes"
  - label: "Login first", description: "state-save flow — reused for all checks"
multiSelect: false
```

If "Login first" → perform auth setup (see `.claude/skills/shared/PLAYWRIGHT.md` → Use Cases: Auth State Persistence):

```
playwright-cli open [login-url]
playwright-cli snapshot                              ← fetch refs
playwright-cli fill [email-ref] "[email]"
playwright-cli fill [password-ref] "[password]"
playwright-cli click [submit-ref]
playwright-cli run-code "async p => { await p.waitForLoadState('networkidle'); }"
playwright-cli state-save .project/auth-state.json
```

Auth state is reused for all subsequent checks. **Cleanup** `.project/auth-state.json` always at end of PHASE 4.

### 1.1 Performance Scan

> **Todo**: Read '.claude/skills/design-ship/references/design-check/references/scan-performance.md'

### 1.2 SEO Scan + 1.3 AEO Scan

> **Todo**: Read '.claude/skills/design-ship/references/design-check/references/scan-seo-aeo.md'

### 1.4 A11Y Scan (Accessibility — WCAG 2.1 AA)

> **Todo**: Read '.claude/skills/design-ship/references/design-check/references/scan-a11y.md'

### 1.5 Responsive Scan + 1.6 Darkmode Scan

> **Todo**: Read '.claude/skills/design-ship/references/design-check/references/scan-visual.md' (Responsive + Darkmode + Motion — run only the in-scope subsections)

### 1.7 Error States Scan

> **Todo**: Read '.claude/skills/design-ship/references/design-check/references/scan-error-states.md'

### 1.8 Smoke Scan + 1.9 Flow Scan

> **Todo**: Read '.claude/skills/design-ship/references/design-check/references/scan-smoke-flow.md'

### 1.10 Motion Runtime Scan (M006/M007)

> **Todo**: Read '.claude/skills/design-ship/references/design-check/references/scan-visual.md' (Motion subsection — already loaded if Responsive/Darkmode were in scope)

---

### 1.11 Finding Format (all checks)

```
FINDING: [ID]
─────────────
Check:    [Performance | SEO | AEO | A11Y | Responsive | Darkmode | Error states | Smoke | Flow | Motion]
Severity: [CRITICAL | HIGH | MEDIUM]
Rule:     [P001 | S001 | D001 | E001 | F001 | M006 | etc.]
Impact:   [CWV metric | search visibility | AI citability | viewport | UX]
File:     [path:line | route]
Issue:    [description]
Fix:      [suggestion]
```

---

## PHASE 2: Report

> **Todo**: mark PHASE 1 → `completed`, PHASE 2 → `in_progress`.

> **Batch mode** (`$BATCH_MODE`): emit the single combined cross-feature report and the single fix-scope approval from `references/batch.md § §2` instead of the per-feature single-target report + Scope Selection below. Skip the rest of this PHASE 2 single-target block.

Combined report across all audit axes:

```
OPTIMIZATION REPORT
═════════════════════════════════════════════════════════════

PERFORMANCE
  Lighthouse: [score]/100
  CWV: LCP [val] | CLS [val] | INP [val]
  Bundle: [size] gzipped ([N] routes over budget)
  Network: [N] failed | [N] over 500KB | [N] missing cache
  JS errors: [N] runtime errors detected
  Findings: [N] (C:[N] H:[N] M:[N])

SEO
  Score: [N]/[total] checks passed
  Critical missing: [titles, descriptions, etc.]
  Findings: [N] (C:[N] H:[N] M:[N])

AEO
  AI bot access: [allowed | blocked | partial]
  Structured content: [semantic | div-heavy]
  FAQ/HowTo schema: [present | missing]
  E-E-A-T signals: [strong | weak | missing]
  Findings: [N] (C:[N] H:[N] M:[N])

A11Y
  Lighthouse a11y: [score]/100
  Files scanned:  [N]
  Critical:       [A001, A002, R004, ...]
  Focus traps:    [PASS | FAIL — N dialogs]
  Findings: [N] (C:[N] H:[N] M:[N])

RESPONSIVE
  Overflow viewports: [list]
  Touch target violations: [N]
  Findings: [N] (C:[N] H:[N] M:[N])

DARKMODE
  Theme support: [yes | no]
  Light vs dark: [different | identical — no dark variants]
  Findings: [N] (C:[N] H:[N])

ERROR STATES
  404 page: [custom app-404 | browser-default]
  Offline UI: [present | missing]
  Loading state: [skeleton | spinner | nothing]
  Findings: [N] (C:[N] H:[N])

SMOKE
  Routes checked: [N]
  Failing: [N] ([list of routes])
  Findings: [N]

FLOW
  Flows checked: [N]/[total in design.flows]
  Failing: [list — flow-name: broke at step N]
  Findings: [N]

MOTION
  Reduced-motion emulation: [PASS | N violations]
  Findings: [N] (H:[N])

COMBINED PRIORITIES (top 10):
  1. [finding] — [check] — [impact]
  2. [finding] — [check] — [impact]
  ...

Total: [N] findings (C:[N] H:[N] M:[N])

═════════════════════════════════════════════════════════════
```

### Scope Selection

```yaml
header: "Fix Scope"
question: "Which issues do you want to fix?"
options:
  - label: "All CRITICAL + HIGH (Recommended)", description: "[N] fixes with the biggest impact"
  - label: "CRITICAL only", description: "[N] fixes, quick wins"
  - label: "Everything", description: "[N] fixes total"
  - label: "I'll choose myself", description: "Select specific findings"
multiSelect: false
```

---

### Worktree setup (before fix)

> **design-ship: SKIP worktree creation.** You are already inside the build worktree
> (`worktree-{feature}`, path in your prompt) — AGENT 1 created it and AGENT 2 committed the
> copy there. Apply fixes on this branch directly. Never create a nested worktree, never merge.

---

## PHASE 3: Fix

> **Todo**: mark PHASE 2 → `completed`, PHASE 3 → `in_progress`.

> **Batch mode** (`$BATCH_MODE`): fix + re-audit + completion are driven by `references/batch.md § §3` and `§ §5` (per-feature fix with snapshot rollback, then a single batch completion). It reuses `fix-reaudit.md`'s Fix Order, Per Fix format, and 4.1 Re-scan. Single-target mode continues with `fix-reaudit.md` directly below.

> **Todo**: Read '.claude/skills/design-ship/references/design-check/fix-reaudit.md'

## Restrictions

This skill must **NEVER**:

- Apply fixes without measuring first (always scan before fix)
- Run Lighthouse on dev mode when production scores are needed
- Apply memoization everywhere (only for measured re-render issues)
- Hide elements as responsive fix (unless intentional design choice)
- Skip before/after comparison
- Leave `.project/auth-state.json` behind after completion (contains session tokens)
- Continue flow scan after first fail (stop + screenshot + finding)

This skill must **ALWAYS**:

- Scan before fixing (measure → fix → re-measure)
- Tag CWV impact per performance finding
- Use Context7 for framework-specific optimization patterns
- Follow mobile-first approach for responsive fixes
- Follow rules from `shared/FRONTEND-RULES.md` (P-series, H-series, E-series, F-series, A-series)
- Update DevInfo at each phase transition
- Use Playwright for render validation (S003), responsive captures, smoke, flow and error states
- Clean up `.project/auth-state.json` at the end of every run where auth was used
