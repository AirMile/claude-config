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
| `decisions[]` (APPLY, overig)                | `pattern`     | `extracted`     |
| `decisions[]` (SKIP, cross-feature relevant) | `pattern`     | `inferred`      |
| `positiveObservations[]`                     | `observation` | `inferred`      |

**APPLY → pitfall criteria (≥1 vereist):**

- **Cross-cutting**: raakt naming, typing, error-handling, layering/architectuur, dependency-richting, DRY-violation tegen bestaande shared/utility, async/sync misbruik, of security-gevoelig domein (input validation, auth checks, data leak).
- **Convention-derived**: fix is direct herleidbaar tot een regel in `shared/PATTERNS.md`, een bestaande `pattern` learning in `project-context.json`, of een convention in `project.json#context.patterns`.
- **Auto-promote**: bestaat er al een `pattern` learning met dezelfde dedup-key (zie `shared/LEARNING-EXTRACTION.md § Dedup Tokenizer`) → emit als `pitfall` in plaats van pattern.

Niet als pitfall markeren als: fix is feature-specifiek (één entity/route/business-rule), puur performance zonder generaliseerbaar principe, of cosmetisch (whitespace, comment).

Pitfall-summary framing (negatief, ≤200 chars): `Avoid {anti-pattern}: {why}. Refactor extracted to {fix-location}.`

**SKIP → pattern criteria:**

Emit alleen als rationale een algemeen principe beschrijft: security, numerieke correctheid, browser-compat, async-ordering, race-condition guard. Feature-specifieke business logic → niet emiten.

Convention-framing (≤200 chars): `Convention: keep {pattern}. {why-skipped}.`

**Filter en dedup:** cross-feature relevance only. Schema/dedup: same as dev-verify completion-sync.md § Step 3b (Jaccard 0.55). Append to `project-context.json → learnings[]` (written in step 3). Log confirmation or "no learnings — skip".

## Step 3 — Parallel sync

Follow `shared/SYNC.md` 3-File Sync Pattern. Read backlog.html + project.json + project-context.json in parallel.

**Backlog**: per feature → CLEAN/REFACTORED: `f.refactor="REFACTORED"`, `f.shipped=true`, `f.shippedAt`, `f.shippedSha=""` (omit if untracked), remove `transition`. ROLLED_BACK: `f.refactor="ROLLED_BACK"`, remove `transition`. Set `data.updated`.

**Dashboard**: merge changed packages/endpoints/entities. Features: set `refactor`/`shipped`/`shippedAt`/`shippedSha` analogous. Small-items mode: add to `recentChanges[]`.

**Context sync** (only if structural changes: files renamed/moved/extracted, patterns fundamentally changed): update `context.structure`, `context.patterns`, `context.updated`, `architecture.components` (see `shared/DASHBOARD.md` for edge types). Log `context: {N} updates` or `context: no updates needed`.

Write back in parallel: Edit backlog.html (keep `<script>` tags), Write project.json, Write project-context.json.

## Step 4 — Scoped auto-commit

Compare `git status --porcelain | sort` with baseline from PHASE 0 (`pre-skill-status-worktree.txt` if worktree-switch, else `pre-skill-status.txt`). Guard: skip commit if diff is empty + no new staged files.

Stage: NEW → `git add`, OVERLAP → AskUserQuestion (Include/Skip), PRE-EXISTING → skip. `.project/` files: use `git add -f` (may be gitignored-but-tracked). Fallback: `git add -A` if no baseline.

Batch commit: `refactor(batch): {summary}` with per-feature lines (REFACTORED/CLEAN/ROLLED_BACK). Single-feature: `refactor({feature}): {summary}`.

Clean up session files after commit.

## Step 5 — Backfill shippedSha

Skip entirely if `TRACKING_MODE=untracked`. Otherwise:

```bash
SHA=$(git rev-parse HEAD)
```

a. **Reuse the parsed `backlog.html` and `project.json` from step 3 (in-memory).** Do not re-read — the only mutations since step 3 came from this skill's step 4 commit, and we know exactly which fields changed. If the step-4 commit was skipped OR a concurrent external write is suspected (check: `git status --porcelain .project/backlog.html .project/project.json` shows unstaged changes since step 4), invalidate the cache and re-read before mutating.
b. Replace empty `shippedSha: ""` for CLEAN/REFACTORED features with `SHA`.
c. Write back: Edit `backlog.html` for the `shippedSha` lines, Write `project.json`.
d. Stage and commit:

```bash
git add .project/backlog.html .project/project.json
git commit -m "chore(refactor): backfill shippedSha for {feature-list}"
```

If the step-4 commit was skipped (nothing to commit), use the pre-skill HEAD as `SHA` — still create the backfill commit.

## Step 6 — Feature archiving

Only features with `feature.json`, not small items without pipeline:

```bash
mkdir -p .project/features/archive
mv .project/features/{name}/ .project/features/archive/{shippedAt-date}-{name}/
```

- `{shippedAt-date}` = the date from the just-written `shippedAt` field (YYYY-MM-DD format)
- Multiple features in one run → each to its own archive-dir
- ROLLED_BACK features: do not archive (stay in `.project/features/`)
- Skip if feature-dir no longer exists (idempotent)

## Step 7 — Completion output

Print `REFACTOR COMPLETE` with per-feature ✓/✗ lines (name, status, improvement count). Next steps: /dev-define → next feature, /project-backlog → revise scope.

**PHASE Finalize** (single-mode only — skip if `feature_queue.length > 1`): follow `shared/FINALIZE.md → Finalize Offer Decision` (TEAM_MODE + PR-state dispatch). Team mode never auto-solo-merges.
