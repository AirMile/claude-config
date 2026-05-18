---
name: dev-build
description: Build features with TDD or implementation-first. Use with /dev-build.
reads: [feature.requirements, feature.architecture, feature.files]
writes: [feature.requirements, feature.build, backlog.status, learnings]
metadata:
  author: claude-config
  version: 1.9.1
  category: dev
---

# Build

**PHASE 2** of the dev workflow: define → **build** → verify → refactor (optional)

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

**Schema preload** — TaskCreate/TaskUpdate zijn deferred tools; aanroepen zonder schema-load mislukt. Allereerste actie van de skill:

1. Call `ToolSearch query="select:TaskCreate,TaskUpdate"` — laadt beide schemas.
2. Direct daarna: `TaskCreate` aanroepen met de 6 items hieronder (status `pending`). Gebruik `TaskUpdate` om elke PHASE `in_progress` te zetten bij start en `completed` bij einde. Tijdens context compaction blijft de takenlijst zichtbaar — geen risico op vergeten phases.

Phases:

1. PHASE 0: Context Loading
2. PHASE 1: Technique Mapping
3. PHASE 2: Execute Build
4. PHASE 2b: Regression Gate + Diagnostics
5. PHASE 3A: Project Sync
6. PHASE 3B: Scoped Commit

### PHASE 0: Context Loading

> **Todo**: call `ToolSearch query="select:TaskCreate,TaskUpdate"`, then `TaskCreate` with the 6 phase items. Mark PHASE 0 → `in_progress` via `TaskUpdate`. Read `.claude/skills/dev-build/references/context-loading.md` and follow all steps in order.

### PHASE 1: Technique Mapping

> **Todo**: mark PHASE 0 → `completed`, PHASE 1 → `in_progress`.

**REMOVED filter**: Requirements with `deltaOp === "REMOVED"` — skip, don't assign technique, don't show in technique map table.

Assign per requirement:

- **TDD**: validation rules, business logic, calculations, complex conditions, testable math
- **Implementation First**: CRUD, middleware, config, wiring
- **Implementation Only**: pure styling/layout, visual/particle effects, static content, env config, prototype code — only when automated tests add no value. Required reason: `visual-only`, `config-only`, or `prototype`

**Pitfall overlap check**: for each requirement, compare against the pitfall list from PHASE 0. On clear thematic overlap (same domain, same type of bug risk):

1. **Log** the pitfall and the affected REQ in the technique map output
2. **State the concrete mitigation in 1 sentence** before writing code for that REQ (e.g., "Use `currencyDisplay: 'narrowSymbol'` in `Intl.NumberFormat` to avoid 'US$' output")
3. **Define verification marker**: name the literal API/option/pattern (or grep regex) that proves the mitigation is in the code. For non-grep checks (type-level, runtime), state the verification command. This marker is consumed in **PHASE 2 step 5 (Pitfall verification)** after each Write.

No forcing on irrelevant pitfalls — only on clear thematic overlap.

Display technique map as a table. Proceed automatically — do NOT confirm with the user.

### PHASE 2: Execute Build

> **Todo**: mark PHASE 1 → `completed`, PHASE 2 → `in_progress`.

**COMPONENT-only steps** (only if `IS_COMPONENT_BUILD = true`): follow `COMPONENT-BUILD.md` → "Phase 2 steps" (output path routing, demo page generation, variant visual spec G1, layout auto-patch). Skip entirely for FEATURE builds.

For each buildSequence step:

**REMOVED filter per step**: filter `step.requirements` per REMOVED filter (see PHASE 1). If step is empty after filter → skip step, continue to next.

**Parallel build check** (per step with >1 requirement):

1. Check file overlap: compare `files[]` where `requirements` arrays overlap between REQs in this step
2. **No overlap** → launch Agent per REQ (max 3 parallel). Each agent receives: technique file content, relevant source files from feature.json `files[]`, stack context (CLAUDE.md ### Stack), earlier SYNC notes from this build, **plus the full content of any files created in earlier steps of this build that this REQ may need to import** (read them with the Read tool and pass the content inline — SYNC one-liners are not enough for the agent to know exact export names and signatures)
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
2. **Read existing code**:
   - All files from feature.json `files[]` that have `action: "modify"`
   - **All files from feature.json `files[]` that have `action: "create"` AND were built in an earlier step of this build** — needed to know exact exports/types/signatures to import (prevents inline-redefine of types/utilities already created)
   - 1 existing test file for setup/teardown patterns (before/after hooks, DB lifecycle, import conventions)
3. Execute technique workflow
4. **Stack-aware enforcement**:
   - **Code clarity**: descriptive names over comments. Do use comments for: non-obvious "why" decisions, workarounds, compatibility notes. Follow existing project comment style.
   - **Code rules**: follow `shared/CODING-RULES.md` — General (R007-R009) + TypeScript. When in doubt: MUST_DO rules always, SHOULD_DO rules unless deliberate deviation with reason. Frontend projects: also `shared/FRONTEND-RULES.md`.
   - **Token enforcement** (only for `.tsx`/`.jsx`/`.vue`/`.svelte` — skip for API routes, tests, config): always use token names (`bg-primary`, `text-foreground`) — never hex literals or `bg-[#hex]`. Theme empty → use fallback defaults from `shared/TOKENS.md`. Run a grep after each Write for T101 (`#[0-9a-fA-F]{3,8}`) and T102 (`bg-\[#`, `text-\[#`) on the generated file — replace violations directly before output.
   - **Motion token enforcement** (only if `theme.motion.pack` is set, only for component files): interactive elements (`button`, `a`, card containers) must use token-based transition classes — never hardcoded `ms` values or `cubic-bezier()` literals (T106/T107 violation). Apply per pack: `"subtle"` → `transition-transform duration-fast ease-[var(--ease-expo-out)]`; `"standard"` → `transition-transform duration-[var(--duration-md-short4)] ease-[var(--ease-md-emphasized)]`; `"apple"` / `"playful"` → `transition-transform duration-ios-fast ease-[var(--ease-ios-spring)]` or motion.dev `whileTap={{ scale: 0.97 }} transition={{ type: "spring", stiffness: 300, damping: 25 }}`. All choreography must include `@media (prefers-reduced-motion: reduce)` fallback (see `shared/PATTERNS.md § prefers-reduced-motion Fallback`).
5. **Pitfall verification** (only if PHASE 1 flagged a pitfall for this REQ): run the `grep -q '<marker>' <file>` check stated in the technique map. Output `PITFALL-CHECK REQ-XXX: <pitfall> → PRESENT | ABSENT`. ABSENT → log as deviation in `build.decisions[]` with rationale (intentional or oversight).
6. **Track REQ progress in transcript** via the SYNC line — feature.json is enriched in bulk in PHASE 3A. For Implementation Only: note `skipTestReason` (`visual-only`, `config-only`, or `prototype`) in the SYNC line so PHASE 3A can write it.
7. Output per requirement:
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

### PHASE 2b: Regression Gate + Diagnostics

> **Todo**: mark PHASE 2 → `completed`, PHASE 2b → `in_progress`.

After successful completion of all requirements, run the **full test suite and pre-commit diagnostics in parallel** (two independent Bash tool calls in a single assistant message):

**Parallel call 1 — regression gate** (Bash `timeout: 300000` — not shell `timeout`, doesn't work on macOS):

```bash
npm run test -- --run 2>&1 | tail -8
```

Including acceptance tests from earlier `/dev-verify` runs (`test/acceptance/*.test.js`) — these protect against spec regressions.

**Parallel call 2 — scoped diagnostics** (Bash `timeout: 60000`):

Compute the set of source files changed since baseline and run linter only on those. `tsc --noEmit` always runs globally (no scope possible):

```bash
PRE_SHA=$(cat "$REPO/.project/session/pre-skill-sha.txt")
SCOPED=$(git -C "$REPO" diff --name-only "$PRE_SHA" HEAD -- '*.ts' '*.tsx' '*.js' '*.jsx' 2>/dev/null)
[ -z "$SCOPED" ] && SCOPED=$(git -C "$REPO" diff --name-only "$PRE_SHA" -- '*.ts' '*.tsx' '*.js' '*.jsx')
[ -n "$SCOPED" ] && npx biome check --write $SCOPED 2>&1 | tail -3
npx tsc --noEmit 2>&1 | head -20
```

Wait for both calls to complete, then evaluate:

**Regression PASS** (all tests pass):

```
REGRESSION CHECK: {total}/{total} PASS — no regressions
```

**Regression FAIL** — gate:

```
REGRESSION CHECK: {passed}/{total} PASS
REGRESSIONS FOUND:
- {test_file}.{test_name}: {reason}

File overlap: {list of files referenced by both this feature and the failing tests}
```

On regression: (1) analyze if this build caused it — yes → fix + re-run; no → AskUserQuestion "Fix first (Recommended)" / "Continue anyway". Max 2 fix attempts → blocker.

**Diagnostics FAIL** → display errors (max 30 lines) + AskUserQuestion "Fix first (Recommended)" / "Commit anyway".

**Skip** (no test files, no runner, or stack unrecognized): `REGRESSION CHECK: skipped ({reason})`

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

**Backlog**: find feature by name → set `"status": "DOING"`, remove `transition` field if present (auto-pickup signal consumed), `data.updated` → now.

**Page-dependency sync** (only when `feature.pageHint[]` is non-empty AND `feature.type in ["FEATURE", "COMPONENT"]`):

For each `pageName` in `feature.pageHint[]`:

- Find `data.features[name===pageName]` in `backlog.html` (type must be `"PAGE"`).
- If found: add `{feature-name}` to `page.dependencies[]` (dedupe). Write back to backlog.html.
- If not found: silent skip (PAGE may not be in backlog yet — `/frontend-design` Route:Page will create it later).

Add to completion report when ≥1 update: `Page deps: {N} PAGEs updated ({comma-separated names})`

**Context**: update `context.structure` (overwrite), `context.routing` (overwrite), `context.patterns` (merge), `context.updated`. Skip if no structural impact.

**Architecture** (follow component-first model from `shared/DASHBOARD.md`): update `architecture.components[]` — built components `status: "planned"` → `"done"`, fill `description` (short functional description, max 200 chars — what does this component do?), `src`, `test`, `connects_to` (typed edges `{ to, type }` from actual imports and runtime IO — `calls` for function/HTTP calls, `reads`/`writes` for DB or state IO, `depends_on` for pure library/config dependencies), `endpoints` (e.g. `"POST /api/auth/login"`), `entities` (used model names), `feature` (current feature name). New components that emerged during the build: push with all fields including `feature`. Skip if no structural impact.

**Routes** (`architecture.routes[]`): confirm routes that were actually implemented during the build — verify `auth` field matches the actual middleware/guard (`"public" | "user" | "admin"`), update `purpose` if the page can now be described better. New routes that emerged during the build: push `{ path, purpose, auth, feature }`. Endpoints in `endpoints[]` with actual auth check: migrate `auth: false` → `"public"` and `auth: true` → `"user"` (or `"admin"` for role check).

**PAGE seeding** (warning-only — frontend projects only):

Scan for new page routes (same patterns as dev-define): `app/**/page.tsx`, `src/routes/**`, `pages/**/*.{tsx,vue}`. Skip candidates already seeded by dev-define: `data.features.find(f => f.source === "/dev-define" && f.parentFeature === current)`.

If new route patterns found and not in backlog: log `⚠ Detected new route patterns: {list}. Run /dev-define on the affected feature or /frontend-design <name> to add them to the backlog.`

Do NOT write to backlog.html — `/dev-define` is the sole author of PAGE entries from the dev track (see `SKILL-PATTERNS.md → Page-Discovery` doctrine).

**COMPONENT-only sync** (only if `IS_COMPONENT_BUILD = true`): follow `COMPONENT-BUILD.md` → "Phase 3A steps" (design.components[] status BLT, project-context components inventory, PAGE suggestions via Link/router scan).

**Sub-component Reuse-Discovery** (frontend projects only):

Follow [Discovery — Reuse-Discovery](../shared/SKILL-PATTERNS.md#reuse-discovery) for the canonical protocol.

**Trigger:** repeating JSX block after code-gen — ≥2× in the same file or ≥1× across multiple files of the same feature. Candidates: clear visual/functional unit with its own props and rendering.

**Source:** `"/dev-build"` · **Direction:** `"dev→frontend"` · **Type:** `COMPONENT`

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

**Atomic write rule**: collect all `project-context.json` mutations (components, context.patterns, learnings) in memory first, then issue a **single Write** (or at most 2 Edits for non-overlapping regions). Do NOT issue separate Edit calls per section — each hook-fire and round-trip adds ~15s.

### PHASE 3B: Scoped Commit

> **Todo**: mark PHASE 3A → `completed`, PHASE 3B → `in_progress`.

**Strategy**: stage only files created or modified by this build. Leave pre-existing dirty files untouched.

Diagnostics ran in PHASE 2b — if both gates passed there, proceed directly to staging.

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

Clean up: `rm -f "$REPO/.project/session/pre-skill-sha.txt" "$REPO/.project/session/active-{feature-name}.json" "$REPO/.project/session/worktree-status.txt"`

**Output:**

```
BUILD COMPLETE: {feature}
========================
Techniques: TDD ({n}), Implementation First ({n}), Implementation Only ({n})
Tests: {passed}/{total} PASS
Files created: {count} | modified: {count}
```

**Next steps block** — check whether the current branch matches the `worktree-*` pattern (`git -C "$REPO" branch --show-current`), then print exactly ONE variant:

**Variant A — worktree active:**

```
Next steps (start in a NEW chat — worktree auto-detected):
  1. /dev-verify {feature}    → hybrid acceptance verification (auto-finalizes worktree on green)
  2. /dev-refactor {feature}  → optional polish after verify (runs on main)
  ?. /dev-debug               → only on unexpected build failures
  ?. /core-finalize {feature} → recovery only — when verify was skipped or interrupted

💡 Worktree: {worktree_path}
```

**Variant B — no worktree (built on main or detached):**

```
Next steps:
  1. /dev-verify {feature}   → hybrid acceptance verification
  2. /dev-refactor {feature} → optional polish after verify
  ?. /dev-debug              → only on unexpected build failures
```

> **Todo**: mark PHASE 3B → `completed`.

## Test Output Parsing

Condense test output:

**PASS:** `TESTS: {n}/{n} PASS ({time})`

**FAIL:**

```
TESTS: {passed}/{total} PASS ({time})
FAILED:
- {file}:{line} - {reason <50 chars}
```
