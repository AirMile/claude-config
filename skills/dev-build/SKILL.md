---
name: dev-build
description: "Build features test-first with TDD. Use with /dev-build, or when the user asks to implement a defined feature."
reads: [feature.requirements, feature.architecture, feature.files]
writes: [feature.requirements, feature.build, backlog.status, learnings]
metadata:
  author: claude-config
  version: 1.15.0
  category: dev
---

# Build

**PHASE 2** of the dev workflow: define → **build** → verify → refactor (optional)

Auto-detects stack from CLAUDE.md, assigns TDD to all testable requirements; Implementation Only only when automated tests add no value (visual/config/prototype).

**Trigger**: `/dev-build` or `/dev-build [feature-name]`

## Input

Reads `.project/features/{feature-name}/feature.json`: requirements (REQ-XXX), architecture, implementation order.

## Output

```
.project/features/{feature-name}/
└── feature.json    # Enriched with build, packages, tests.checklist sections
```

## Process

Six phases run sequentially:

1. PHASE 0: Context Loading
2. PHASE 1: Technique Mapping
3. PHASE 2: Execute Build
4. PHASE 2b: Regression Gate + Diagnostics
5. PHASE 3A: Project Sync
6. PHASE 3B: Scoped Commit

### PHASE 0: Context Loading

> **Todo**: Call `ToolSearch query="select:TaskCreate,TaskUpdate"` — both tools are deferred and unusable without their schemas. Then `TaskCreate` with the 6 phase items above (status `pending`); use `TaskUpdate` to flip each PHASE to `in_progress` at start and `completed` at end (task list survives context compaction). Mark PHASE 0 → `in_progress`. Read `.claude/skills/dev-build/references/context-loading.md` and follow all steps in order.

### PHASE 1: Technique Mapping

> **Todo**: mark PHASE 0 → `completed`, PHASE 1 → `in_progress`.

**REMOVED filter**: Requirements with `deltaOp === "REMOVED"` — skip, don't assign technique, don't show in technique map table.

Assign per requirement:

- **TDD** (default): validation rules, business logic, calculations, complex conditions, CRUD, middleware, config wiring — anything with testable behavior.
- **Implementation Only**: no automated test — only when tests add no value.

| Reason        | When                                                        |
| ------------- | ----------------------------------------------------------- |
| `visual-only` | Pure styling, layout, CSS, visual effects, particles        |
| `config-only` | Env vars, route registration, package config, static assets |
| `prototype`   | Deliberately temporary code, throwaway MVP                  |

**Pitfall overlap check**: for each requirement, compare against the pitfall list from PHASE 0. On clear thematic overlap (same domain, same type of bug risk):

1. **Log** the pitfall and the affected REQ in the technique map output
2. **State the concrete mitigation in 1 sentence** before writing code for that REQ (e.g., "Use `currencyDisplay: 'narrowSymbol'` in `Intl.NumberFormat` to avoid 'US$' output")
3. **Define verification marker**: name the literal API/option/pattern (or grep regex) that proves the mitigation is in the code. For non-grep checks (type-level, runtime), state the verification command. This marker is consumed in **PHASE 2 step 5 (Pitfall verification)** after each Write.

No forcing on irrelevant pitfalls — only on clear thematic overlap.

Display technique map as a table. Proceed automatically — do NOT confirm with the user.

### PHASE 2: Execute Build

> **Todo**: mark PHASE 1 → `completed`, PHASE 2 → `in_progress`.

> **COMPONENT builds only**: if `IS_COMPONENT_BUILD = true`, follow `COMPONENT-BUILD.md` for PHASE 2 and PHASE 3A overlay steps in addition to the instructions below. FEATURE builds: ignore all COMPONENT-BUILD.md references — the steps below cover the full flow.

For each buildSequence step:

**REMOVED filter per step**: filter `step.requirements` per REMOVED filter (see PHASE 1). If step is empty after filter → skip step, continue to next.

**Parallel build check** (per step with >1 requirement):

1. Check file overlap: compare `files[]` where `requirements` arrays overlap between REQs in this step.
2. **Overlap** → build sequentially (continue with "Sequential build" below).
3. **No overlap** → launch Agent per REQ (max 3 parallel). Each agent receives: technique file content, relevant source files from feature.json `files[]`, stack context (CLAUDE.md ### Stack), earlier SYNC notes from this build, **plus the full content of any files created in earlier steps of this build that this REQ may need to import** (read them with the Read tool and pass the content inline — SYNC one-liners are not enough for the agent to know exact export names and signatures).

   Parse agent results via `BUILD_RESULT_START...BUILD_RESULT_END` markers and update feature.json per REQ. Required format:

   ```
   BUILD_RESULT_START
   REQ: {id}
   Technique: {TDD | Implementation Only}
   Status: {GREEN | BLOCKED}
   Files modified: {list}
   Files created: {list}
   Test output: {PASS | FAIL with details}
   SYNC: {pattern/concept in file(s) — what, why, depends on}
   BUILD_RESULT_END
   ```

   **BLOCKED handling**: collect all parallel results first — a BLOCKED agent does NOT halt other in-flight agents. After all agents complete:
   - GREEN REQs → log SYNC line, move to next step.
   - BLOCKED REQs → log in `build.blockers[]` with the agent's error output, then retry sequentially (re-enter "Sequential build" below for that REQ). One retry only; if still BLOCKED, leave in `build.blockers[]` and continue with the next buildSequence step.

**Sequential build** — for steps with 1 requirement or with overlap, for each requirement sequentially:

1. Load technique:
   - **TDD** → `Read(".claude/skills/dev-build/techniques/tdd.md")`
   - **Implementation Only** → no file loaded. Workflow: implement, verify manually, no automated test. Output: `IMPLEMENTED: {what} / TESTED: SKIPPED ({reason})`. Set `skipTestReason` in SYNC line.
2. **Read existing code**:
   - All files from feature.json `files[]` that have `action: "modify"`
   - **All files from feature.json `files[]` that have `action: "create"` AND were built in an earlier step of this build** — needed to know exact exports/types/signatures to import (prevents inline-redefine of types/utilities already created)
   - **One existing test file** for setup/teardown patterns. Selection order: (a) most-recently-modified `*.test.{ts,tsx,js,jsx}` in the same directory as the target file; (b) `src/test/setup.*` or `tests/setup.*` if present; (c) skip entirely for pure schema/config files without DB or component lifecycle. Don't pick at random — a mismatched setup-style introduces irrelevant fixtures.
3. Execute technique workflow. Max 3 TypeScript type-error fix attempts per REQ — after 3 failed attempts log as blocker with `cause: "type-resolution-failure"` and continue with the next REQ.
4. **Stack-aware enforcement**:
   - **Code clarity**: follow existing project comment style. Add comments only for non-obvious "why" decisions, workarounds, and compatibility notes.
   - **Code rules**: follow `shared/CODING-RULES.md` — General (R007-R009) + TypeScript (T001-T203) + Testing (TST001-TST203). When in doubt: MUST_DO rules always, SHOULD_DO rules unless deliberate deviation with reason. Frontend projects: also `shared/FRONTEND-RULES.md`.
   - **Token enforcement** (only for `.tsx`/`.jsx`/`.vue`/`.svelte` — skip for API routes, tests, config): always use token names (`bg-primary`, `text-foreground`) — never hex literals or `bg-[#hex]`. Theme empty → use fallback defaults from `shared/TOKENS.md`. Run a grep after each Write for T101 (`#[0-9a-fA-F]{3,8}`) and T102 (`bg-\[#`, `text-\[#`) on the generated file — replace violations directly before output.
   - **Motion token enforcement** (only if `theme.motion.pack` is set, only for component files with interactive elements — `button`, `a`, card containers): use token-based transition classes from the active pack — never hardcoded `ms` values or `cubic-bezier()` literals (T106/T107 violation). Pack-specific class-strings: see `shared/PATTERNS.md § Motion Patterns`. All choreography must include `@media (prefers-reduced-motion: reduce)` fallback (`shared/PATTERNS.md § prefers-reduced-motion Fallback`). After each Write on a component file: grep for hardcoded `\d+ms` and `cubic-bezier(` patterns — replace with token classes before output.
5. **Pitfall verification** (only if PHASE 1 flagged a pitfall for this REQ): run the `grep -q '<marker>' <file>` check stated in the technique map. Output `PITFALL-CHECK REQ-XXX: <pitfall> → PRESENT | ABSENT`. ABSENT → log as deviation in `build.decisions[]` with rationale (intentional or oversight).
6. **Track REQ progress in transcript** via the SYNC line — feature.json is enriched in bulk in PHASE 3A. For Implementation Only: note `skipTestReason` (`visual-only`, `config-only`, or `prototype`) in the SYNC line so PHASE 3A can write it.
7. Output per requirement:
   ```
   REQ-XXX: {description}
   Technique: {TDD | Implementation Only}
   {technique-specific output}
   SYNC: {pattern/concept} in {file(s)} — {what, why, what depends on it}
   Progress: {done}/{total}
   ```

After each requirement: continue directly to the next REQ in buildSequence. Do NOT pause for user confirmation between REQs — proceed automatically until all REQs in the step are GREEN or BLOCKED.

**Edge cases:**

- **Combined steps** (e.g. "REQ-002 + REQ-003"): build as one unit. Technique = that of the first REQ in the combination.
- **Already covered**: if a REQ already (partially) works due to an earlier REQ → only write tests, verify GREEN. Output: `RED: N/A (covered by REQ-XXX)`

**On blocker:** log in feature.json `build.blockers[]`, mark BLOCKED, continue with other requirements.

**On unexpected runtime/environment error** (test runner crashes, missing globals, broken APIs that should exist): do NOT immediately patch — root-cause first.

1. **Identify the actual provider**: which package/runtime owns the failing API? Read `package.json`, check `node --version`, inspect the test runner config (e.g. `vitest.config.ts → environment`). Search the error string verbatim in node_modules to find which layer throws it.
2. **Confirm the cause before mitigating**: state in one sentence which component is responsible (e.g. `Node 22 experimental webstorage shadows jsdom's localStorage`) — not which one you assume is responsible (`jsdom is broken`).
3. **Then patch**, and record the confirmed cause in the learning (PHASE 3A → learnings). A learning that names the wrong layer will misdirect future builds.

If root-cause cannot be confirmed within 2 attempts: log as blocker with `"cause": "unknown"` rather than guessing.

**On `npm install ERESOLVE`** (peer-dep conflict during dependency add/upgrade):

1. **Read the error verbatim** — `Found: pkg@X / peer: pkg@Y` lines tell you exactly which versions clash.
2. **Identify which package needs to move**:
   - If the requested package is the one with the strict peer dep → look for an older compatible release that matches the installed peer.
   - If the existing package is the holdout → check whether upgrading it is appropriate (e.g. its major version is now out of date for the project's framework version).
3. **Decide and execute**:
   - Compatible older version of requested pkg exists → install with that version.
   - Upgrade of existing pkg is the right move → upgrade it + matching peer-deps in one `npm install` call. Note the upgrade in `build.decisions[]` (type: `pitfall` — see PHASE 3A).
   - Neither option is clean → log as blocker with `cause: "peer-dep-deadlock"`, skip the dependent REQ.
4. **`--legacy-peer-deps` is a last resort** — only after a documented decision in `build.decisions[]`, never as the first reflex. It bypasses the conflict but doesn't resolve it.

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

# Detect linter from package.json (biome → eslint → none). Skip if no SCOPED files.
if [ -n "$SCOPED" ]; then
  if node -e "const d=require('$REPO/package.json'); const all={...d.dependencies,...d.devDependencies}; if(!('@biomejs/biome' in all)) process.exit(1)" 2>/dev/null; then
    npx biome check --write $SCOPED 2>&1 | tail -3
  elif node -e "const d=require('$REPO/package.json'); const all={...d.dependencies,...d.devDependencies}; if(!('eslint' in all)) process.exit(1)" 2>/dev/null; then
    npx eslint --fix $SCOPED 2>&1 | tail -5
  else
    echo "LINT: skipped (no biome or eslint in package.json)"
  fi
fi
npx tsc --noEmit 2>&1 | head -20
```

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

**Test output format** — condense raw test runner output before printing:

- PASS: `TESTS: {n}/{n} PASS ({time})`
- FAIL:
  ```
  TESTS: {passed}/{total} PASS ({time})
  FAILED:
  - {file}:{line} - {reason <50 chars}
  ```

### PHASE 3A: Project Sync

> **Todo**: mark PHASE 2b → `completed`, PHASE 3A → `in_progress`.

Follow `shared/SYNC.md` 3-File Sync Pattern. Skill-specific mutations:

**feature.json**: `status → "DOING"`, `files[]` → merge with actual files. Add: `build {}` (started, completed, techniques, testsPass, testsTotal, decisions), `packages[]`, `tests.checklist[]`. Do NOT overwrite existing sections. Note: `requirements[]` is already enriched in PHASE 2 step 4.

**tests.checklist[]** — **one test item per `acceptance[]` scenario** (not per requirement). For each REQ, iterate `REQ.acceptance[]`; push one item per entry:

```json
{
  "id": 1,
  "title": "description of what to verify",
  "requirementId": "REQ-XXX",
  "acceptanceIndex": 0,
  "category": "happy",
  "kind": "example",
  "steps": ["step 1", "step 2"],
  "expected": "expected result",
  "status": "pending"
}
```

`acceptanceIndex` = index of the entry in `requirements[].acceptance[]`. `category` copies `acceptance[i].category`; default `"happy"` if the entry lacks `category` (legacy feature.json backward-compat).

**`kind` assignment rule:**

- `category: "happy"` → `kind: "example"` (concrete scenario reads better as golden-path spec).
- `category: "edge"` → `kind: "example"` by default; mark `kind: "property"` if the criterion describes an invariant over an input space (e.g. "any non-empty array", "any timestamp in 24h window").
- `category: "boundary"` → `kind: "property"` by default + mandatory `seed: <random uint32>` field. Boundary criteria are by definition a claim about an edge-case space, not about a single example. Generate the seed with `Math.floor(Math.random() * 2**32)` once at checklist-write. The TDD technique (`techniques/tdd.md` § Pattern Property-based) then reads these items with `@fast-check/vitest`.

For `kind: "property"`: omit `steps` and set `expected` to the invariant in plain language (e.g. "cart-total is order-independent over any items array").

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

**Sub-component Reuse-Discovery** (frontend projects only):

Follow [Discovery — Reuse-Discovery](../shared/SKILL-PATTERNS.md#reuse-discovery) for the canonical protocol.

**Trigger:** repeating JSX block after code-gen — ≥2× in the same file or ≥1× across multiple files of the same feature. Candidates: clear visual/functional unit with its own props and rendering.

**Source:** `"/dev-build"` · **Direction:** `"dev→frontend"` · **Type:** `COMPONENT`

**Learning extraction** (after feature.json sync): write to `project-context.json learnings[]` (append-only, identical format as `dev-verify`/`dev-refactor`):

Each `build.decisions[]` entry maps to either `pattern` or `pitfall` based on its content:

- **`type: "pattern"`** — architectural/structural choices that future builds should reuse (e.g. "centralised env-loader via assertEnv()", "RHF + Zod for forms").
- **`type: "pitfall"`** — version pins, peer-dep workarounds, package upgrades forced by ecosystem mismatch, or "don't do X because Y" guidance (e.g. "next-sanity@9 incompatible with Next 15 — use v10+").

`build.blockers[]` where the blocker is resolved (no longer BLOCKED at end of build) → always `type: "pitfall"`.

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

**Atomic write rule**: collect all `project-context.json` mutations (components, context.patterns, learnings) in the current context first — don't write until all mutations for PHASE 3A are determined — then issue a **single Write** (or at most 2 Edits for non-overlapping regions) right before closing PHASE 3A. Do NOT issue separate Edit calls per section — each hook-fire and round-trip adds ~15s.

### PHASE 3B: Scoped Commit

> **Todo**: mark PHASE 3A → `completed`, PHASE 3B → `in_progress`.

**Strategy**: stage only files created or modified by this build. Leave pre-existing dirty files untouched.

Diagnostics ran in PHASE 2b — if both gates passed there, proceed directly to staging.

```bash
# $REPO is set in PHASE 0 (see references/context-loading.md → "Capture git baseline")
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
git -C "$REPO" commit -m "build({feature}): {n} requirements ({tdd} TDD, {only} impl-only)"
```

Clean up: `rm -f "$REPO/.project/session/pre-skill-sha.txt" "$REPO/.project/session/active-{feature-name}.json" "$REPO/.project/session/worktree-status.txt"`

**Output:**

```
BUILD COMPLETE: {feature}
========================
Techniques: TDD ({n}), Implementation Only ({n})
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
