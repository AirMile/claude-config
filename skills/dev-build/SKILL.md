---
name: dev-build
description: "Build a defined feature test-first with TDD. Use with /dev-build."
reads: [feature.requirements, feature.architecture, feature.files, conventions]
writes:
  [
    feature.requirements,
    feature.build,
    backlog.status,
    project-context.learnings,
  ]
metadata:
  author: claude-config
  version: 1.19.0
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

**Pitfall overlap check**: for each requirement, compare against the pitfall list from PHASE 0. On clear thematic overlap (same domain, same type of bug risk): log the pitfall and the affected REQ in the technique map output, and **state the concrete mitigation in 1 sentence** before writing code for that REQ (e.g., "Use `currencyDisplay: 'narrowSymbol'` in `Intl.NumberFormat` to avoid 'US$' output"). No forcing on irrelevant pitfalls — only on clear thematic overlap.

Display technique map as a table. Proceed automatically — do NOT confirm with the user.

### PHASE 2: Execute Build

> **Todo**: mark PHASE 1 → `completed`, PHASE 2 → `in_progress`.

> **COMPONENT builds only**: if `IS_COMPONENT_BUILD = true`, follow `COMPONENT-BUILD.md` for PHASE 2 and PHASE 3A overlay steps in addition to the instructions below. FEATURE builds: ignore all COMPONENT-BUILD.md references — the steps below cover the full flow.

For each buildSequence step:

**REMOVED filter per step**: filter `step.requirements` per REMOVED filter (see PHASE 1). If step is empty after filter → skip step, continue to next.

**Sequential build** — for each requirement in the step, sequentially:

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
   - **Project conventions**: follow `.project/conventions.md` (loaded in PHASE 0, status `set` only) for naming, structure, and style — conventions override SHOULD_DO global rules, never MUST_DO (see `shared/CONVENTIONS.md § Precedence`).
   - **Token enforcement** (only for `.tsx`/`.jsx`/`.vue`/`.svelte` — skip for API routes, tests, config): always use token names (`bg-primary`, `text-foreground`) — never hex literals or `bg-[#hex]`. Theme empty → use fallback defaults from `shared/TOKENS.md`. Run a grep after each Write for TOKENS.md T101 (`#[0-9a-fA-F]{3,8}`) and T102 (`bg-\[#`, `text-\[#`) on the generated file — replace violations directly before output.
   - **Motion token enforcement** (only if `theme.motion.pack` is set, only for component files with interactive elements — `button`, `a`, card containers): use token-based transition classes from the active pack — never hardcoded `ms` values or `cubic-bezier()` literals (TOKENS.md T106/T107 violation). Pack-specific class-strings: see `shared/PATTERNS.md § Motion Patterns`. All choreography must include `@media (prefers-reduced-motion: reduce)` fallback (`shared/PATTERNS.md § prefers-reduced-motion Fallback`). After each Write on a component file: grep for hardcoded `\d+ms` and `cubic-bezier(` patterns — replace with token classes before output.
5. **Track REQ progress in transcript** via the SYNC line — feature.json is enriched in bulk in PHASE 3A. For Implementation Only: note `skipTestReason` (`visual-only`, `config-only`, or `prototype`) in the SYNC line so PHASE 3A can write it.
6. Output per requirement:
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

1. Read the `Found: pkg@X / peer: pkg@Y` lines verbatim — they name the clash.
2. Prefer a compatible older version of the requested package; or deliberately upgrade the existing holdout + matching peer-deps in one `npm install` call (note the upgrade in `build.decisions[]`, type `pitfall`).
3. Neither option clean → log as blocker with `cause: "peer-dep-deadlock"`, skip the dependent REQ.
4. `--legacy-peer-deps` is a last resort — only after a documented decision in `build.decisions[]`.

### PHASE 2b: Regression Gate + Diagnostics

> **Todo**: mark PHASE 2 → `completed`, PHASE 2b → `in_progress`.

After successful completion of all requirements, run the **full test suite and pre-commit diagnostics in parallel** (two independent Bash tool calls in a single assistant message):

**Parallel call 1 — regression gate** (Bash `timeout: 300000` — not shell `timeout`, doesn't work on macOS):

Resolve the test command from `package.json` `scripts.test` — do NOT assume vitest:

- Script contains `vitest` → `npm run test -- --run` (`--run` forces single-run instead of watch mode)
- Script contains `jest`, `node --test`, or anything else → `npm run test` verbatim (no extra flags — `--run` is vitest-only and errors elsewhere)
- No `test` script → skip the gate with reason `no test script`

```bash
{resolved test command} 2>&1 | tail -8
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

On regression: (1) analyze if this build caused it — **yes** → fix + re-run (autonomous, no gate); **no, or cause unclear** → plan-mode gate (mirrors `dev-verify/references/fix-loop.md § Plan-mode gate`): show `PLAN MODE: regression not caused by this build — entering plan mode (OpusPlan-aware).`, call `EnterPlanMode`, write a fix plan per regression to the plan file (problem → root cause → proposed fix → verification), then `ExitPlanMode` for approval. Approved → fix + re-run. Rejected → continue anyway (regression pre-existed this build; log it in the completion output). Max 2 fix attempts → blocker. The happy path (all tests pass) never enters plan mode.

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

**feature.json**: `status → "DOING"`, `files[]` → merge with actual files. Add: `build {}` (started, completed, techniques, testsPass, testsTotal, decisions), `packages[]`, `tests.checklist[]`. Do NOT overwrite existing sections. Note: enrich `requirements[]` here in bulk (technique/syncNote/status per REQ) from the PHASE 2 SYNC lines.

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

- Find `data.features[name===pageName]` in `backlog.json` (type must be `"PAGE"`).
- If found: add `{feature-name}` to `page.dependencies[]` (dedupe). Write back to `backlog.json`.
- If not found: silent skip (PAGE may not be in backlog yet — `/design-create` Route:Page will create it later).

Add to completion report when ≥1 update: `Page deps: {N} PAGEs updated ({comma-separated names})`

**Context**: update `context.structure` (overwrite), `context.routing` (overwrite), `context.patterns` (merge), `context.updated`. Skip if no structural impact.

**Architecture** (follow component-first model from `shared/DASHBOARD.md`): update `architecture.components[]` — built components `status: "planned"` → `"done"`, fill `description` (short functional description, max 200 chars — what does this component do?), `src`, `test`, `connects_to` (typed edges `{ to, type }` from actual imports and runtime IO — `calls` for function/HTTP calls, `reads`/`writes` for DB or state IO, `depends_on` for pure library/config dependencies), `endpoints` (e.g. `"POST /api/auth/login"`), `entities` (used model names), `feature` (current feature name). New components that emerged during the build: push with all fields including `feature`. Skip if no structural impact.

**Routes** (`architecture.routes[]`): confirm routes that were actually implemented during the build — verify `auth` field matches the actual middleware/guard (`"public" | "user" | "admin"`), update `purpose` if the page can now be described better. New routes that emerged during the build: push `{ path, purpose, auth, feature }`. Endpoints in `endpoints[]` with actual auth check: migrate `auth: false` → `"public"` and `auth: true` → `"user"` (or `"admin"` for role check).

**Sub-component Reuse-Discovery** (frontend projects only):

Follow [Discovery — Reuse-Discovery](../shared/SKILL-PATTERNS.md#reuse-discovery) for the canonical protocol.

**Trigger:** repeating JSX block after code-gen — ≥2× in the same file or ≥1× across multiple files of the same feature. Candidates: clear visual/functional unit with its own props and rendering.

**Source:** `"/dev-build"` · **Direction:** `"dev→frontend"` · **Type:** `COMPONENT`

**Learning extraction** (after feature.json sync): append to `project-context.json learnings[]` per [shared/LEARNING-EXTRACTION.md § Writer Append Protocol](../shared/LEARNING-EXTRACTION.md) (schema + two-stage dedup). dev-build is the **single writer** for `build.decisions[]` — source mapping:

- **`type: "pattern"`** — architectural/structural choices that future builds should reuse (e.g. "centralised env-loader via assertEnv()", "RHF + Zod for forms").
- **`type: "pitfall"`** — version pins, peer-dep workarounds, package upgrades forced by ecosystem mismatch, or "don't do X because Y" guidance (e.g. "next-sanity@9 incompatible with Next 15 — use v10+").
- `build.blockers[]` where the blocker is resolved at end of build → always `type: "pitfall"`.

All with `source: "extracted"`. Only write if decisions or resolved blockers are present — no empty entries.

**Atomic write rule**: collect all `project-context.json` mutations (components, context.patterns, learnings) in the current context first — don't write until all mutations for PHASE 3A are determined — then issue a **single Write** (or at most 2 Edits for non-overlapping regions) right before closing PHASE 3A. Do NOT issue separate Edit calls per section — each hook-fire and round-trip adds ~15s.

### PHASE 3B: Scoped Commit

> **Todo**: mark PHASE 3A → `completed`, PHASE 3B → `in_progress`.

Follow [shared/SCOPED-COMMIT.md](../shared/SCOPED-COMMIT.md). dev-build deltas:

> **Boundary — dev-build never integrates.** PHASE 3B's only git operations are the worktree commit below and the session-file cleanup. Do **not** run `git merge`, `git branch -d/-D`, or `git worktree remove`, and do **not** switch to `main`. The worktree stays intact on its `worktree-{feature}` branch — merging and finalizing is `/dev-verify` (PHASE Finalize) or `/core-finalize`. If you find yourself resolving a merge conflict in dev-build, you have left the skill.

- **Baseline**: SHA form — `$REPO/.project/session/pre-skill-sha.txt` (mid-build commits possible; see § 1). All git commands via `git -C "$REPO"`.
- **Stage set**: new/modified files from this feature (`feature.json files[]`, test files, feature.json itself). Untracked files outside the feature → don't stage. **Install exception**: if the pre-flight or any PHASE 2 install ran this build (detectable via `TEST-DEPS: patched` in the output, a non-empty `packages[]` in feature.json, or a PHASE 2 ERESOLVE/fast-check install), also stage `package.json` + `package-lock.json` — the install landed in the worktree, so staging these files ensures the dep reaches main via the merge without leaving main dirty.
- **`.project/` files** (project.json, backlog.json, project-context.json): local-only state — written but **never staged or committed**. Do not attempt `git add`.
- **Diagnostics**: already ran in PHASE 2b — proceed directly to staging.
- **Commit**: `feat({feature}): {subject}` — write `{subject}` yourself as a short sentence (≤65 chars) in the project's language (`CLAUDE.md → Language`) describing _what the feature does_. Base it on the requirements you just built. No counts, no `TDD`/`impl-only` labels. Example: `feat(map-home): kaartscherm met locatiemarkers en GPS`.
  Run: `git -C "$REPO" commit -m "feat({feature}): {subject}"`
- **Cleanup**: `rm -f "$REPO/.project/session/pre-skill-sha.txt" "$REPO/.project/session/active-{feature-name}.json" "$REPO/.project/session/worktree-status.txt"` — session files only; never touch the worktree, its branch, or main.

The commit and session-file cleanup above are the last git operations in this skill. Move immediately to the completion output — no further git commands:

**Completion output — print this block, then execute the Next-Step Clipboard Offer directly below. Both are required to close PHASE 3B.**

> **Note**: PHASE 3B is only `completed` after the clipboard offer below is executed — the BUILD COMPLETE block is not the endpoint.

**Output:**

```
BUILD COMPLETE: {feature}
========================
Techniques: TDD ({n}), Implementation Only ({n})
Tests: {passed}/{total} PASS
Files created: {count} | modified: {count}
```

**Next steps** — check branch (`git -C "$REPO" branch --show-current`); if it matches `worktree-*`, add the worktree annotations shown in `{...}`:

```
Next steps:{ (start in a NEW chat — worktree auto-detected)}
  1. /dev-verify {feature}   → hybrid acceptance verification{ (auto-finalizes worktree on green)}
  2. /dev-refactor {feature} → optional polish after verify
  ?. /dev-debug              → only on unexpected build failures
```

When worktree active: also append `  ?. /core-finalize {feature} → recovery only — when verify was skipped or interrupted` and `💡 Worktree: {worktree_path}`.

> **Todo (closing action — do not skip)**: Apply the Next-Step Clipboard Offer (binary Ja/Nee) —
> read '.claude/skills/shared/NEXT-STEP-OFFER.md'.
> Recommended command: /dev-verify {feature} → hybrid acceptance verification (primary next step).

> **Todo**: mark PHASE 3B → `completed`.
