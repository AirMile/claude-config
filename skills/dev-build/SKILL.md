---
name: dev-build
description: Build features with TDD or implementation-first per requirement. Use with /dev-build or /dev-build [feature-name] after /dev-define. For PAGE/COMPONENT features dev-build reads design.pages[]/design.components[] as visual spec source if present.
reads: [feature.requirements]
writes: [feature.requirements, feature.build, backlog.status, learnings]
metadata:
  author: claude-config
  version: 1.8.0
  category: dev
---

# Build

**PHASE 2** of the dev workflow: define -> **build** -> test

Auto-detects stack from CLAUDE.md, selects technique per requirement (TDD, Implementation First, or Implementation Only), builds sequentially.

**Trigger**: `/dev-build` or `/dev-build [feature-name]`

## Input

Reads `.project/features/{feature-name}/feature.json`: requirements (REQ-XXX), architecture, implementation order.

## Output

```
.project/features/{feature-name}/
└── feature.json    # Enriched with build, packages, tests.checklist sections
```

## Process

**Phase tracking** — first action of the skill: call `TaskCreate` with these 6 items (status `pending`), then use `TaskUpdate` to set each phase `in_progress` at the start and `completed` at the end. During context compaction the task list remains visible — no risk of forgetting phases.

1. PHASE 0: Context Loading
2. PHASE 1: Technique Mapping
3. PHASE 2: Execute Build
4. PHASE 2b: Regression Gate
5. PHASE 3A: Project Sync
6. PHASE 3B: Scoped Commit

### PHASE 0: Context Loading

> **Todo**: call `TaskCreate` with the 6 phase items (see above). Mark PHASE 0 → `in_progress` via `TaskUpdate`.

**Capture git baseline** (first action):

First determine the repo root. If CWD is not a git repo, locate the repo via the feature location:

```bash
REPO=$(git rev-parse --show-toplevel 2>/dev/null) || \
  REPO=$(cd "$(dirname "$(find . -maxdepth 6 -name 'feature.json' -path '*/.project/features/*' | head -1)")/../../.." && pwd)
```

No repo found → exit: "No git repo detected; /dev-build requires a tracked project."

Store `$REPO` — all subsequent git commands use `git -C "$REPO" ...`.

```bash
mkdir -p "$REPO/.project/session"
find "$REPO/.project/session" -maxdepth 1 \( -name "active-*.json" -o -name "pre-skill-*.txt" \) -mtime +1 -delete 2>/dev/null
git -C "$REPO" rev-parse HEAD > "$REPO/.project/session/pre-skill-sha.txt"
```

**Detect stack:** read CLAUDE.md `### Stack` section + `.claude/research/stack-baseline.md` (if available). Fallback: `project.json.stack`.

**Project context** (skip if not present):

Read `.project/project.json` and `.project/project-context.json`. Use for:

- Existing endpoints (prevent duplicate routes)
- Existing DB schema (prevent conflicts)
- Code patterns to follow
- Learnings from earlier features
- `theme.cssVars` — present and non-empty: log `"Theme loaded"`. Empty or missing: log `"Theme empty — fallback defaults (shared/TOKENS.md) will be used"`.

**Token-bootstrap safety net** (only if `feature.hasUI === true` or `IS_COMPONENT_BUILD === true`): execute the Bootstrap Procedure from `shared/TOKENS.md`. Fully idempotent — guards skip automatically if Tailwind is missing or `tokens.css` already exists.

**Learnings load** (via [shared/LEARNINGS-LOAD.md](../shared/LEARNINGS-LOAD.md)):

Configuration:

```
scopes: [component]
pitfall-prefix: true
current-feature: <feature-name>
```

Display the loaded output. The pitfall-prefix section + component-scoped patterns provide context for the build (not a constraint — when in doubt assume root cause, don't pattern-match).

Store the loaded learnings for PHASE 1 (Technique Mapping).

**COMPONENT Build Detection** (after feature.json load):

If `feature.type === "COMPONENT"` (or backlog item type is COMPONENT):

1. Determine `COMPONENT_SCOPE`:
   - Check `feature.json#architecture.scope` or top-level `scope` field
   - Fallback: check `project.json#design.components[]` — match on name → read `scope`
   - Fallback: ask user via AskUserQuestion: `"What is the scope of this component?"` (atomic/section/layout)

2. Determine `COMPONENT_OUTPUT_PATH` based on scope and framework (see PHASE 2):
   - `atomic` → `src/components/ui/{Name}.tsx`
   - `section` → `src/components/{Name}.tsx`
   - `layout` → `src/components/{Name}.tsx` (+ auto-patch `app/layout.tsx` after build)

3. Store as `IS_COMPONENT_BUILD = true`, `COMPONENT_SCOPE`, `COMPONENT_OUTPUT_PATH`.

**Load feature:**

Ready queue (only if no feature name provided via CLI):

Parse `.project/backlog.html`. For each DEFINED feature calculate whether all `dependencies[]` have `status === "DONE"` (or the dep list is empty). Display before the feature selection:

```
Ready to build:
  ✓ auth-login        P1  (no deps)
  ✓ user-profile      P2  deps: [auth-login ✓]

Blocked:
  ✗ payment-flow      P1  waiting for: [stripe-integration — DOING]
  ✗ checkout          P2  waiting for: [payment-flow ✗, cart — TODO]
```

- Only show "Blocked" section if blocked features exist
- If no DEFINED features exist → "No features ready to build." → exit

If no feature name provided:

1. Parse `.project/backlog.html` (see `shared/BACKLOG.md → Lifecycle Protocol → Read`).
   - First check: `data.features.find(f => f.type === "FEATURE" && f.transition === "building")` → if found, auto-select, show: `Backlog: ✓ Task picked up — {name}`.
   - Fallback: filter `status === "DEFINED"` → suggest via **AskUserQuestion** (ready features at the top)
2. Fallback: list `.project/features/` with `feature.json`, let user select

Load `feature.json`. Extract: `requirements[]`, `buildSequence[]`, `files[]`, `testStrategy[]`, `architecture` (specifically `registries[]` and `interfaces`). If `clarifications[]` is present: treat as hard constraints during implementation (gray-area decisions from the user). If `architecture.registries[]` is present: use as a guide — add new instances (endpoints, commands, entities) to the indicated registry file, don't scatter them across loose files.

Not found → exit: "Run `/dev-define` first."

**Dependency check:**

Skip if no `depends[]` or empty.

1. Parse `.project/backlog.html`. Not found → skip.
2. Per dependency: status must be `"DONE"`.
3. Blockers found → **AskUserQuestion**:
   - "Stop — finish {dep} first (Recommended)" / "Continue anyway"
   - Stop → exit. Continue → proceed.

**Workspace setup:**

Follow `shared/WORKTREE.md → Auto-create worktree` with `feature-name = "{feature-name}"`. The procedure auto-creates an isolated worktree and wires `.project/` symlinks. No AskUserQuestion needed — creation is automatic when no worktree exists for the feature yet. Skip if already in a worktree (procedure detects).

**Mandatory output** (always log, never silent):

```
WORKTREE: {absolute-path} ({created | reused | skipped: already-in-worktree})
```

If the procedure did not run (e.g. no git repo, error), log `WORKTREE: not-applied ({reason})` instead. This line is non-negotiable — without it, the auditor cannot verify whether isolation was achieved.

**Pre-PHASE-1 gate** (hard check — shell-state verification):

```bash
CURRENT="$(pwd)"
EXPECTED_SUFFIX="/.claude/worktrees/{feature-name}"
if [[ "$CURRENT" == *"$EXPECTED_SUFFIX" ]]; then
  echo "GATE: ok — inside worktree"
elif grep -q "^WORKTREE: not-applied" <<< "$WORKTREE_LOG"; then
  echo "GATE: ok — worktree explicitly skipped"
else
  echo "ABORT: PHASE 0 incomplete — not inside expected worktree and no 'WORKTREE: not-applied' marker found."
  echo "Re-run /dev-build from the start; follow shared/WORKTREE.md → Auto-create worktree literally."
  exit 1
fi
```

| Condition                                           | Result                                                     |
| --------------------------------------------------- | ---------------------------------------------------------- |
| `pwd` ends with `/.claude/worktrees/{feature-name}` | Pass — worktree created and switched into                  |
| `WORKTREE: not-applied (...)` was logged            | Pass — worktree intentionally skipped (no git repo / etc.) |
| Otherwise                                           | ABORT — silent skip detected                               |

This gate is falsifiable from shell state; it cannot be bypassed by skipping the prose log.

**Clear backlog transition flag** (immediately after loading feature):

Read `.project/backlog.html` (if exists), find feature by name → remove `transition` field if present (auto-pickup signal consumed), `updated` to current date. **Keep status as `"DEFINED"`** — the DEFINED → DOING transition happens in PHASE 3A on successful completion (per `shared/BACKLOG.md`: dev-build result-status = DOING at completion).

**Signal active feature** (after backlog update):

```bash
echo '{"feature":"{feature-name}","skill":"build","startedAt":"{ISO timestamp}"}' > .project/session/active-{feature-name}.json
```

**Display** feature overview:

```
FEATURE: {feature-name}

REQUIREMENTS:
- REQ-001: {description}
  ...

IMPLEMENTATION ORDER:
(from buildSequence, sorted by step)
```

**Risk check (only if backlog feature `risk >= 4`):**

If the loaded backlog feature has a `risk` score of 4 or 5, show this warning before PHASE 1:

```
⚠ HIGH RISK — Complexity {risk}/5

Consider before building:
- Are all dependencies available (status DONE)?
- Is the feature definition complete (all REQs clear)?
- Build in small steps — commit after each working REQ
```

### PHASE 1: Technique Mapping

> **Todo**: mark PHASE 0 → `completed`, PHASE 1 → `in_progress`.

**REMOVED filter**: Requirements with `deltaOp === "REMOVED"` — skip, don't assign technique, don't show in technique map table.

Assign per requirement:

- **TDD**: validation rules, business logic, calculations, complex conditions, testable math
- **Implementation First**: CRUD, middleware, config, wiring
- **Implementation Only**: pure styling/layout, visual/particle effects, static content, env config, prototype code — only when automated tests add no value. Required reason: `visual-only`, `config-only`, or `prototype`

**Pitfall overlap check**: for each requirement, compare against the pitfall list from PHASE 0. On clear thematic overlap (same domain, same type of bug risk) → explicitly log which pitfall is touched and how this build avoids it. No forcing — only flag where relevant.

Display technique map as a table. Proceed automatically — do NOT confirm with the user.

### PHASE 2: Execute Build

> **Todo**: mark PHASE 1 → `completed`, PHASE 2 → `in_progress`.

**COMPONENT output path routing** (only if `IS_COMPONENT_BUILD = true`):

Override `feature.json files[]` paths with the definitive output paths based on `COMPONENT_SCOPE`:

| Scope     | Main component file            | Demo page                             |
| --------- | ------------------------------ | ------------------------------------- |
| `atomic`  | `src/components/ui/{Name}.tsx` | `app/_dev/components/{name}/page.tsx` |
| `section` | `src/components/{Name}.tsx`    | `app/_dev/components/{name}/page.tsx` |
| `layout`  | `src/components/{Name}.tsx`    | `app/_dev/components/{name}/page.tsx` |

Generate the demo page alongside the component file. The demo page shows a variant matrix of all `variants × sizes × states`:

```tsx
// app/_dev/components/{name}/page.tsx (gitignored via _dev/)
export default function {Name}Demo() {
  return (
    <main aria-label="{Name} demo">
      {variants.map(v => sizes.map(s => states.map(state => (
        <{Name} key={`${v}-${s}-${state}`} variant={v} size={s} {...stateProps[state]}>
          {v}/{s}/{state}
        </{Name}>
      ))))}
    </main>
  );
}
```

Add `app/_dev/` to `.gitignore` if not already there (check first):

```bash
grep -q "_dev/" .gitignore 2>/dev/null || echo "app/_dev/" >> .gitignore
```

**Variant visual spec (G1 — only if component has >1 variant):**

Condition: `feature.json.requirements` contains `cva(...)` with more than one variant key or more than one value per key. Skip for 1-variant components.

**Pre-flight (Playwright runner)**: Check `package.json` for `@playwright/test` devDep. If missing:

```yaml
header: "Playwright runner"
question: "Variant visual specs require @playwright/test. How to proceed?"
options:
  - label: "Run /core-setup playwright (Recommended)"
    description: "Installs daemon + runner + base config"
  - label: "Skip variant specs"
    description: "Skip this step, continue with build"
multiSelect: false
```

On **Skip** → jump to "Layout auto-patch" section below.

Generate `.project/playwright-runs/component-{name}.spec.ts`:

```typescript
import { test, expect } from "@playwright/test";

const variants = { variants_array }; // e.g. ['default', 'destructive', 'outline']
const sizes = { sizes_array }; // e.g. ['sm', 'md', 'lg'] — [] if no size variant

test.beforeEach(async ({ page }) => {
  await page.goto("http://localhost:3000/_dev/components/{name}");
  await page.waitForLoadState("networkidle");
});

for (const variant of variants) {
  for (const size of sizes.length ? sizes : [null]) {
    const label = size ? `${variant}-${size}` : variant;
    test(`{name} — ${label}`, async ({ page }) => {
      const selector = size
        ? `[data-variant="${variant}"][data-size="${size}"]`
        : `[data-variant="${variant}"]`;
      await expect(page.locator(selector).first()).toHaveScreenshot(
        `{name}-${label}.png`,
        { maxDiffPixelRatio: 0.02 },
      );
    });
  }
}
```

Generate `.project/playwright-runs/playwright.config.ts` (see `shared/PLAYWRIGHT.md → Runner Mode`).

First run (create baseline):
`npx playwright test .project/playwright-runs/component-{name}.spec.ts --update-snapshots`

Subsequent runs (regression check):
`npx playwright test .project/playwright-runs/component-{name}.spec.ts`
→ FAIL = visual regression in a specific variant/size combination.

Display after first successful run:

```
VARIANT VISUAL SPEC
  Component:  {Name}
  Variants:   {N} ({variant names})
  Sizes:      {M} ({size names}) / n/a
  Spec:       .project/playwright-runs/component-{name}.spec.ts
  Baselines:  .project/playwright-runs/__screenshots__/ ({N×M} PNGs)
```

**Layout auto-patch** (only if `COMPONENT_SCOPE === "layout"`):

After generating the component file: add import + render to `app/layout.tsx` (or framework equivalent). Conflict detection: check if the component name is already imported. On conflict → show diff and ask user via AskUserQuestion: "Patch (Recommended)" | "Apply manually". No conflict → patch directly. Display:

```
AUTO-PATCH layout.tsx: import {Name} from "{path}" added + <{Name} /> in render.
```

For each buildSequence step:

**REMOVED filter per step**: filter `step.requirements` → remove IDs where `feature.json.requirements[id].deltaOp === "REMOVED"`. If step is empty after filter → skip step, continue to next.

**Parallel build check** (per step with >1 requirement):

1. Check file overlap: compare `files[]` where `requirements` arrays overlap between REQs in this step
2. **No overlap** → launch Agent per REQ (max 3 parallel). Each agent receives: technique file content, relevant source files from feature.json `files[]`, stack context (CLAUDE.md ### Stack), earlier SYNC notes from this build
3. **Overlap** → build sequentially (steps below)
4. Parse agent results via `BUILD_RESULT_START...BUILD_RESULT_END` markers, update feature.json per REQ

   ```
   BUILD_RESULT_START
   REQ: {id}
   Technique: {TDD | Implementation First | Implementation Only}
   Status: {GREEN | BLOCKED}
   Files modified: {list}
   Files created: {list}
   Test output: {PASS | FAIL with details}
   SYNC: {pattern/concept in file(s) — what, why, depends on}
   BUILD_RESULT_END
   ```

For steps with 1 requirement or with overlap, for each requirement sequentially:

1. Load technique:
   - **TDD** → `Read(".claude/skills/dev-build/techniques/tdd.md")`
   - **Implementation First** → `Read(".claude/skills/dev-build/techniques/implementation-first.md")`
   - **Implementation Only** → no file loaded (technique = no tests; `skipTestReason` must be filled in)
2. **Read existing code**: read all files from feature.json `files[]` that have `action: "modify"`, plus 1 existing test file for setup/teardown patterns (before/after hooks, DB lifecycle, import conventions).
3. Execute technique workflow
4. **Stack-aware enforcement**:
   - **Code clarity**: descriptive names over comments. Do use comments for: non-obvious "why" decisions, workarounds, compatibility notes. Follow existing project comment style.
   - **Code rules**: follow `shared/RULES.md` — General (R007-R009) + stack-specific sections. When in doubt: MUST_DO rules always, SHOULD_DO rules unless deliberate deviation with reason.
   - **Token enforcement** (only for `.tsx`/`.jsx`/`.vue`/`.svelte` — skip for API routes, tests, config): always use token names (`bg-primary`, `text-foreground`) — never hex literals or `bg-[#hex]`. Theme empty → use fallback defaults from `shared/TOKENS.md`. Run a grep after each Write for T101 (`#[0-9a-fA-F]{3,8}`) and T102 (`bg-\[#`, `text-\[#`) on the generated file — replace violations directly before output.
5. **Update feature.json** after each REQ: set `requirements[].status` → `"built"` and add `technique` + `syncNote`. For Implementation Only: also add `skipTestReason` (`visual-only`, `config-only`, or `prototype`). This preserves progress during context compaction.
6. Output per requirement:
   ```
   REQ-XXX: {description}
   Technique: {TDD | Implementation First | Implementation Only}
   {technique-specific output}
   SYNC: {pattern/concept} in {file(s)} — {what, why, what depends on it}
   Progress: {done}/{total}
   ```

**Edge cases:**

- **Combined steps** (e.g. "REQ-002 + REQ-003"): build as one unit. Technique = that of the first REQ in the combination.
- **Already covered**: if a REQ already (partially) works due to an earlier REQ → only write tests, verify GREEN. Output: `RED: N/A (covered by REQ-XXX)`

**On blocker:** log in feature.json `build.blockers[]`, mark BLOCKED, continue with other requirements.

**On unexpected runtime/environment error** (test runner crashes, missing globals, broken APIs that should exist): do NOT immediately patch — root-cause first.

1. **Identify the actual provider**: which package/runtime owns the failing API? Read `package.json`, check `node --version`, inspect the test runner config (e.g. `vitest.config.ts → environment`). Search the error string verbatim in node_modules to find which layer throws it.
2. **Confirm the cause before mitigating**: state in one sentence which component is responsible (e.g. `Node 22 experimental webstorage shadows jsdom's localStorage`) — not which one you assume is responsible (`jsdom is broken`).
3. **Then patch**, and record the confirmed cause in the learning (PHASE 3A → learnings). A learning that names the wrong layer will misdirect future builds.

If root-cause cannot be confirmed within 2 attempts: log as blocker with `"cause": "unknown"` rather than guessing.

### PHASE 2b: Regression Gate

> **Todo**: mark PHASE 2 → `completed`, PHASE 2b → `in_progress`.

After successful completion of all requirements, run the **full test suite** with timeout (hanging tests = FAIL). Including acceptance tests from earlier `/dev-verify` runs (`test/acceptance/*.test.js`) — these protect against spec regressions.

Use the Bash tool with `timeout: 300000` parameter (milliseconds) — not the shell `timeout` command (doesn't work on macOS).

**PASS:** All tests pass → proceed to PHASE 3A.

```
REGRESSION CHECK: {total}/{total} PASS — no regressions
```

**FAIL:** Other feature tests fail — this is a gate.

```
REGRESSION CHECK: {passed}/{total} PASS
REGRESSIONS FOUND:
- {test_file}.{test_name}: {reason}

File overlap: {list of files referenced by both this feature
and the failing tests}
```

On regression:

1. Analyze whether the current feature caused the regression (check shared files/imports)
2. If YES: fix the regression before continuing. Re-run full suite after fix.
3. If NO (pre-existing failure): warn the user, let them choose via AskUserQuestion:
   - "Fix the regression first (Recommended)" — "Prevents the regression from carrying into /dev-verify"
   - "Continue anyway" — "Regression existed before this build"
4. Max 2 fix attempts. After that: report as blocker and let user decide.

**Skip:** If no test files exist, no test runner configured, or stack not recognized.

```
REGRESSION CHECK: skipped ({reason})
```

### PHASE 3A: Project Sync

> **Todo**: mark PHASE 2b → `completed`, PHASE 3A → `in_progress`.

Follow `shared/SYNC.md` 3-File Sync Pattern. Skill-specific mutations:

**feature.json**: `status → "DOING"`, `files[]` → merge with actual files. Add: `build {}` (started, completed, techniques, testsPass, testsTotal, decisions), `packages[]`, `tests.checklist[]`. Do NOT overwrite existing sections. Note: `requirements[]` is already enriched in PHASE 2 step 4.

**tests.checklist[]** — at least 1 test item per requirement:

```json
{
  "id": 1,
  "title": "description of what to verify",
  "requirementId": "REQ-XXX",
  "steps": ["step 1", "step 2"],
  "expected": "expected result",
  "status": "pending"
}
```

Guidelines:

- UI features: steps as browser interactions (navigate, click, fill in)
- API features: steps as HTTP requests with concrete endpoints and payloads
- Expected = observable result (response body, status code, visible effect)
- Do NOT add "run npm test" items — unit tests are already covered by the build

**Backlog**: find feature by name → set `"status": "DOING"` (transition DEFINED → DOING at successful build completion, per `shared/BACKLOG.md`), `data.updated` → now. This is the only place where DOING is written.

**Context**: update `context.structure` (overwrite), `context.routing` (overwrite), `context.patterns` (merge), `context.updated`. Skip if no structural impact.

**Architecture** (follow component-first model from `shared/DASHBOARD.md`): update `architecture.components[]` — built components `status: "planned"` → `"done"`, fill `description` (short functional description, max 200 chars — what does this component do?), `src`, `test`, `connects_to` (typed edges `{ to, type }` from actual imports and runtime IO — `calls` for function/HTTP calls, `reads`/`writes` for DB or state IO, `depends_on` for pure library/config dependencies), `endpoints` (e.g. `"POST /api/auth/login"`), `entities` (used model names), `feature` (current feature name). New components that emerged during the build: push with all fields including `feature`. Skip if no structural impact.

**Routes** (`architecture.routes[]`): confirm routes that were actually implemented during the build — verify `auth` field matches the actual middleware/guard (`"public" | "user" | "admin"`), update `purpose` if the page can now be described better. New routes that emerged during the build: push `{ path, purpose, auth, feature }`. Endpoints in `endpoints[]` with actual auth check: migrate `auth: false` → `"public"` and `auth: true` → `"user"` (or `"admin"` for role check).

**PAGE seeding** (safety net — frontend projects only):

Follow [Discovery — Page-Discovery](../shared/SKILL-PATTERNS.md#page-discovery) for the canonical protocol.

**Trigger (safety net):** same patterns as dev-define. Skip candidates already seeded by dev-define: `data.features.find(f => f.source === "/dev-define" && f.parentFeature === current)`. Resolution: batch "Yes" / "No".

**Source:** `"/dev-build"` · **Direction:** `"dev→frontend"` · **Type:** `PAGE`

**COMPONENT design sync** (only if `IS_COMPONENT_BUILD = true`):

After successful build: update `project.json#design.components[]` — find by name, set `status: "BLT"`. Not found → add with status `"BLT"`, scope `COMPONENT_SCOPE`. Also update `project-context.json#components[]` inventory: check by name → new: push `{ name, src: COMPONENT_OUTPUT_PATH, exports: ["{Name}"], variants, sizes }` → existing: update `src`.

**Sub-component Reuse-Discovery** (frontend projects only):

Follow [Discovery — Reuse-Discovery](../shared/SKILL-PATTERNS.md#reuse-discovery) for the canonical protocol.

**Trigger:** repeating JSX block after code-gen — ≥2× in the same file or ≥1× across multiple files of the same feature. Candidates: clear visual/functional unit with its own props and rendering.

**Source:** `"/dev-build"` · **Direction:** `"dev→frontend"` · **Type:** `COMPONENT`

**PAGE suggestions via COMPONENT links** (only if `IS_COMPONENT_BUILD = true`):

Follow [Discovery — Page-Discovery](../shared/SKILL-PATTERNS.md#page-discovery) for the canonical protocol.

**Trigger (COMPONENT→route):** scan `<Link href="...">` and `router.push(...)` in generated files. Candidate if route does not appear in `design.pages[]` or `backlog.html`. Resolution: per route AskUserQuestion "Yes, add PAGE todo (Recommended)" / "Skip".

**Source:** `"/dev-build"` · **Direction:** `"dev→frontend"` · **Type:** `PAGE`

**Learning extraction** (after feature.json sync): write to `project-context.json learnings[]` (append-only, identical format as `dev-verify`/`dev-refactor`):

- `build.decisions[]` → `type: "pattern"` (architectural choice made)
- `build.blockers[]` where the blocker is resolved (no longer BLOCKED at end of build) → `type: "pitfall"`

```json
{
  "date": "...",
  "feature": "{name}",
  "type": "pattern|pitfall",
  "source": "extracted",
  "summary": "..."
}
```

Only write if decisions or resolved blockers are present — no empty entries.

### PHASE 3B: Scoped Commit

> **Todo**: mark PHASE 3A → `completed`, PHASE 3B → `in_progress`.

**Strategy**: stage only files created or modified by this build. Leave pre-existing dirty files untouched.

**Step 0: Pre-commit diagnostics** (stack-aware):

- Read `package.json` → check `scripts` for keys matching `typecheck|type-check|tsc|lint`
- Python project (no package.json): check for `mypy.ini` or `[tool.mypy]` in `pyproject.toml`
- No match found → skip silently

On match: run found script(s) (multiple matches → parallel) via Bash tool with `timeout: 60000`:

- **PASS** → display `DIAGNOSTICS: PASS`, proceed to git status
- **FAIL** → display errors (max 30 lines) + AskUserQuestion:
  - `"Fix first (Recommended)"` — stop PHASE 3C, no commit; user fixes errors and restarts the skill
  - `"Commit anyway"` — proceed to git add + commit; add `[diagnostics-warnings]` to commit message

```bash
git -C "$REPO" status --porcelain
```

Categorize each file:

1. **Check baseline**: compare with the SHA from `$REPO/.project/session/pre-skill-sha.txt`:
   ```bash
   git -C "$REPO" diff --name-only $(cat "$REPO/.project/session/pre-skill-sha.txt") HEAD 2>/dev/null
   ```
   If diff is empty (no mid-build commits): use `git -C "$REPO" diff --name-only $(cat "$REPO/.project/session/pre-skill-sha.txt")` (without HEAD) for unstaged changes, plus `git -C "$REPO" ls-files --others --exclude-standard` for new files.
   Files NOT modified by this build AND already dirty → PRE-EXISTING, don't stage.
2. **New/modified files from this feature** (files from `feature.json files[]`, test files, feature.json itself) → `git add`.
3. **Untracked files** not belonging to the feature → don't stage.
4. **.project/ files** (project.json, backlog.html, project-context.json) → try to add. If skip-worktree or sparse-checkout blocks this: accept and continue (these files are updated locally but won't be committed).

```bash
git -C "$REPO" commit -m "build({feature}): {n} requirements ({tdd} TDD, {impl} impl-first)"
```

Clean up: `rm -f "$REPO/.project/session/pre-skill-sha.txt" "$REPO/.project/session/active-{feature-name}.json"`

**Output:**

```
BUILD COMPLETE: {feature}
========================
Techniques: TDD ({n}), Implementation First ({n}), Implementation Only ({n})
Tests: {passed}/{total} PASS
Files created: {count} | modified: {count}

Next steps:
  1. /dev-verify {feature} → hybrid test verification
  2. /dev-debug → if there are unexpected failures
```

**Worktree reminder** — add one extra block to the output if the current branch matches the `worktree-*` pattern (`git -C "$REPO" branch --show-current`):

```
💡 Worktree active: {worktree_path}
   Next skills (/dev-verify, /dev-refactor, /dev-debug) start in a NEW chat —
   they detect this worktree automatically and switch into it.
   For merge/cleanup: /core-finalize {feature}
```

> **Todo**: mark PHASE 3B → `completed`. All 6 phases should now be `completed`.

## Test Output Parsing

Condense test output:

**PASS:** `TESTS: {n}/{n} PASS ({time})`

**FAIL:**

```
TESTS: {passed}/{total} PASS ({time})
FAILED:
- {file}:{line} - {reason <50 chars}
```
