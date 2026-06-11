# PHASE 5: Batch Completion

**Goal:** Proportional documentation, single backlog update, single commit.

## Step 1 — Write feature.json per feature (read-modify-write)

If N > 1 features: read all `.project/features/{name}/feature.json` in parallel, mutate each in memory, write all back in parallel.

Add `refactor` section per feature:

**Always present in refactor:** `status`, `improvements` (object with categories), `decisions[]`, `positiveObservations[]`, `failureAnalysis`, `pendingImprovements[]`.

**Per status variant:**

- CLEAN: `refactor.status = "CLEAN"`, empty `improvements`, only `positiveObservations`
- REFACTORED: `refactor.status = "REFACTORED"`, populated `improvements` per category, `decisions` with rationale
- ROLLED_BACK: `refactor.status = "ROLLED_BACK"`, `failureAnalysis` (markdown string), `pendingImprovements[]`

**Decision entry format** — one per balance-filter SKIP or applied improvement:

`{file:line} — {finding-summary} — {SKIP|APPLY} — {why}`

Examples:

- `src/stores/bankroll-store.ts:115 — redundant inner round2() — SKIP — intentional belt-and-suspenders against floating-point drift, see REQ-004`
- `src/utils/format.ts:23 — duplicate currency formatter — APPLY — extracted to shared/format.ts, 3 callers consolidated`

SKIP entries MUST be recorded so future refactor runs can dedup against them (agents see existing decisions in PROJECT CONVENTIONS and skip re-reporting).

**Update top-level feature status:**

- CLEAN: `status: "DONE"` (unchanged)
- REFACTORED: `status: "DONE"` (unchanged)
- ROLLED_BACK: `status: "DONE"` (unchanged — refactor.status documents the rollback)

Do NOT overwrite existing sections.

## Step 2 — Learning extraction [checkpoint]

REFACTORED/CLEAN only (skip ROLLED_BACK):

**Mapping per source:**

| Source                                       | learning.type | learning.source |
| -------------------------------------------- | ------------- | --------------- |
| `decisions[]` (APPLY, cross-cutting)         | `pitfall`     | `inferred`      |
| `decisions[]` (APPLY, other)                 | `pattern`     | `extracted`     |
| `decisions[]` (SKIP, cross-feature relevant) | `pattern`     | `inferred`      |
| `positiveObservations[]`                     | `observation` | `inferred`      |

**APPLY → pitfall criteria (≥1 required):**

- **Cross-cutting**: touches naming, typing, error handling, layering/architecture, dependency direction, a DRY violation against an existing shared/utility, async/sync misuse, or a security-sensitive domain (input validation, auth checks, data leak).
- **Convention-derived**: the fix is directly traceable to a rule in `shared/PATTERNS.md`, an existing `pattern` learning in `project-context.json`, or a convention in `project.json#context.patterns`.
- **Auto-promote**: if a `pattern` learning with the same dedup-key already exists (see `shared/LEARNING-EXTRACTION.md § Dedup Tokenizer`) → emit as `pitfall` instead of pattern.

Do not mark as pitfall if: the fix is feature-specific (a single entity/route/business rule), pure performance without a generalizable principle, or cosmetic (whitespace, comment).

Pitfall-summary framing (negative, ≤200 chars): `Avoid {anti-pattern}: {why}. Refactor extracted to {fix-location}.`

**SKIP → pattern criteria:**

Emit only if the rationale describes a general principle: security, numerical correctness, browser compat, async ordering, race-condition guard. Feature-specific business logic → do not emit.

Convention framing (≤200 chars): `Convention: keep {pattern}. {why-skipped}.`

**Filter and dedup:** cross-feature relevance only. Schema/dedup: same as dev-verify completion-sync.md § Step 3b (Jaccard 0.55). Append to `project-context.json → learnings[]` (written in step 3). Log confirmation or "no learnings — skip".

## Step 3 — Parallel sync

Follow `shared/SYNC.md` 3-File Sync Pattern. Read backlog.json + project.json + project-context.json in parallel (see `shared/BACKLOG.md § Writing` for the legacy backlog.html migration rule).

**Backlog**: per feature → CLEAN/REFACTORED: `f.refactor="REFACTORED"`, `f.shipped=true`, `f.shippedAt`, `f.shippedSha=$(git rev-parse HEAD)` (the PHASE 4 refactor commit — best-effort "as-shipped" pointer for the dashboard), remove `transition`. ROLLED_BACK: `f.refactor="ROLLED_BACK"`, remove `transition`. Set `data.updated`.

**Backlog archive** (CLEAN/REFACTORED dev-track features only): after setting the shipped flags, remove each shipped feature object from `backlog.json#features[]` and append it to `.project/archive/backlog-archive.json` — shape `{ "schemaVersion": 2, "archived": [ <full feature objects> ] }`. Create `.project/archive/` and the scaffold if absent; dedup on `name` before appending. ROLLED_BACK features are NOT archived (consistent with the feature-dir rule in step 5); PAGE/COMPONENT items also stay (frontend-track exception — see `shared/BACKLOG.md § Archiving`). The dashboard shipped-showcase reads the archive via the server — archived features are no longer in `backlog.json`.

**Dashboard**: merge changed packages/endpoints/entities. Small-items mode: add to `recentChanges[]`.

**Context sync** (only if structural changes: files renamed/moved/extracted, patterns fundamentally changed): update `context.structure`, `context.patterns`, `context.updated`, `architecture.components` (see `shared/DASHBOARD.md` for edge types). Log `context: {N} updates` or `context: no updates needed`.

Write back in parallel: Write backlog.json, Write `.project/archive/backlog-archive.json` (only if features were archived), Write project.json, Write project-context.json.

## Step 4 — Scoped auto-commit

Compare `git status --porcelain | sort` with the PHASE 0 step-3 baseline (`pre-skill-status.txt`). Guard: skip commit if diff is empty + no new staged files.

Stage: NEW → `git add`, OVERLAP → AskUserQuestion (Include/Skip), PRE-EXISTING → skip. `.project/` files: use `git add -f` (may be gitignored-but-tracked). Fallback: `git add -A` if no baseline.

Batch commit: `refactor(batch): {summary}` with per-feature lines (REFACTORED/CLEAN/ROLLED_BACK). Single-feature: `refactor({feature}): {summary}`.

Clean up session files after commit.

## Step 5 — Feature archiving

Only features with `feature.json`, not small items without pipeline:

```bash
mkdir -p .project/features/archive
mv .project/features/{name}/ .project/features/archive/{shippedAt-date}-{name}/
```

- `{shippedAt-date}` = the date from the just-written `shippedAt` field (YYYY-MM-DD format)
- Multiple features in one run → each to its own archive-dir
- ROLLED_BACK features: do not archive (stay in `.project/features/`)
- Skip if feature-dir no longer exists (idempotent)

## Step 6 — Completion output

Print `REFACTOR COMPLETE` with per-feature ✓/✗ lines (name, status, improvement count). Next steps: /dev-define → next feature, /project-backlog → revise scope.

**PHASE Finalize** (single-mode only — skip if `feature_queue.length > 1`): follow `shared/FINALIZE.md → Finalize Offer Decision` (TEAM_MODE + PR-state dispatch). Team mode never auto-solo-merges.
