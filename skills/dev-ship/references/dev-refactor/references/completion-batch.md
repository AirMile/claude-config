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
- **Auto-promote**: if a `pattern` learning with the same dedup-key already exists (see `shared/LEARNING-WRITE.md § Dedup Tokenizer`) → emit as `pitfall` instead of pattern.

Do not mark as pitfall if: the fix is feature-specific (a single entity/route/business rule), pure performance without a generalizable principle, or cosmetic (whitespace, comment).

Pitfall-summary framing (negative, ≤200 chars): `Avoid {anti-pattern}: {why}. Refactor extracted to {fix-location}.`

**SKIP → pattern criteria:**

Emit only if the rationale describes a general principle: security, numerical correctness, browser compat, async ordering, race-condition guard. Feature-specific business logic → do not emit.

Convention framing (≤200 chars): `Convention: keep {pattern}. {why-skipped}.`

**Filter and dedup:** schema, relevance filter, and two-stage dedup per [shared/LEARNING-WRITE.md § Writer Append Protocol](.claude/skills/shared/LEARNING-WRITE.md). Append to `project-context.json → learnings[]` (written in step 3). Log confirmation or "no learnings — skip".

## Step 3 — Parallel sync

> **Todo (symlink self-heal, before any write below):** `learnings-write.js`'s atomic temp+rename
> (Step 2 above) replaces a symlinked path with a real file if the target was a symlink pointing
> outside the worktree — a known failure mode, not hypothetical. Before writing, check `.project/archive`
> and `.project/project-context.json` inside the worktree: if either is no longer a symlink (`[ ! -L path ]`)
> but main's real file/dir at `{main_root}/.project/{archive,project-context.json}` still exists, re-run
> `ln -sfn` for that one path only (idempotent, no abort branch — this is a targeted repair, not the
> full gate). Skip silently if it's already a symlink. Without this, the archive entry and any
> just-appended learnings land in a worktree-local copy that the later `git worktree remove` silently
> destroys.

Follow `shared/SYNC.md` 3-File Sync Pattern. Read backlog.json + project.json + project-context.json in parallel (see `shared/BACKLOG.md § Writing` for the legacy backlog.html migration rule).

**Backlog**: per feature (CLEAN/REFACTORED) — set `f.refactor="REFACTORED"`, `f.shipped=true`, `f.shippedAt`, `f.shippedSha=$(git rev-parse HEAD)` (the PHASE 4 refactor commit), `f.summary` (see below), remove `transition`, set `data.updated`. These mutations are **one atomic unit** — never write `f.refactor` without also writing `f.shipped`/`f.shippedAt`/`f.shippedSha`/`f.summary` in the same file write. ROLLED_BACK: `f.refactor="ROLLED_BACK"`, remove `transition`, set `data.updated` — do NOT set shipped or summary.

**`f.summary`** (≤200 chars, human-readable — what shipped and why it's worth remembering; this is the dashboard card headline): base it on `f.description`, then fold in the single most notable `APPLY` entry from `feature.json#build.decisions[]` or `#refactor.decisions[]` if one exists (pick by cross-cutting relevance, same bar as the pitfall criteria in Step 2). No notable decision → `f.summary = f.description` verbatim. Example: `JWT-login met refresh-tokens — httpOnly cookie i.p.v. localStorage (XSS-risico)`.

**Backlog archive** (CLEAN/REFACTORED dev-track features only): after setting the shipped flags, remove each shipped feature object from `backlog.json#features[]` and append it (with all shipped fields) to `.project/archive/backlog-archive.json` — shape `{ "schemaVersion": 2, "archived": [ <full feature objects> ] }`. Create `.project/archive/` and the scaffold if absent; dedup on `name` before appending. ROLLED_BACK features are NOT archived (consistent with the feature-dir rule in step 5); PAGE/COMPONENT items also stay (design-track exception — see `shared/BACKLOG.md § Archiving`). The dashboard shipped-showcase reads the archive via the server — archived features are no longer in `backlog.json`.

**Dashboard**: merge changed packages/endpoints/entities.

**Context sync** (only if structural changes: files renamed/moved/extracted, patterns fundamentally changed): update `context.structure`, `context.patterns`, `context.updated`. Log `context: {N} updates` or `context: no updates needed`.

**Write order**: Write `.project/archive/backlog-archive.json` first (only if features were archived) — then, once that succeeds, write `backlog.json`, `project.json`, and `project-context.json` in parallel. This ordering matters: if the run is interrupted, the failure mode is a feature present in _both_ files (healable duplicate — see Step 3b self-heal) rather than a feature missing from both.

## Step 3b — Completion consistency check (invariant)

After the parallel writes complete, verify each CLEAN/REFACTORED feature from this run:

1. Re-read `backlog.json#features[]` — feature must **not** be present (removed by archive step).
2. Re-read `backlog-archive.json#archived[]` — feature must be present with `shipped: true`, `shippedAt`, `shippedSha`, and a non-empty `summary`.
3. `f.refactor === "REFACTORED"` iff `f.shipped === true` — never one without the other.
4. Feature-dir check (post-Step-5): `.project/features/archive/{shippedAt}-{name}/` must exist.

**Queue-level backstop (run this check over the WHOLE run queue, not just CLEAN/REFACTORED):**

5. For **every** feature in this run's queue, re-read its `backlog.json` / `backlog-archive.json` entry: it must **not** retain `transition: "refactoring"`. A leftover `transition` means a feature was silently dropped from completion (e.g. a scope filter emptied its applied set but it was never reclassified to CLEAN — see workflow.md PHASE 3 step 5). This is the exact failure that leaves a stale card in the dashboard's TO REFACTOR column. Such a feature must be closed out now: reclassify to CLEAN, then apply the full atomic shipped-set + archive + feature-dir move (self-heal below).

**On invariant failure — self-heal:**

- Missing `shipped` fields (or missing `summary`) on an already-written `f.refactor`: re-write the backlog entry with the full atomic set (shipped + shippedAt + shippedSha + summary — fallback `summary = f.description` if the decisions-based derivation was skipped — + remove from features[] + append to archive).
- Feature still in `backlog.json#features[]` but present in archive: remove it from features[] and rewrite backlog.json.
- Feature removed from `backlog.json#features[]` but absent from `backlog-archive.json#archived[]` (archive write failed or was skipped after the backlog write): reconstruct the archive entry from the still-present `feature.json` (shipped fields + status) and append it. A completed run always ends archive-only — never missing from both.
- Feature-dir not yet moved (Step 5 ran before check): run the mv again (idempotent).
- Leftover `transition: "refactoring"` (invariant 5): treat the feature as CLEAN — add a `refactor` section with `status: "CLEAN"` and its deferred findings as `SKIP` decisions (Step 1), then run the full atomic shipped-set + archive + feature-dir move. This closes the stale TO REFACTOR card.

**If self-heal fails** (e.g. file write error): print a clear `SYNC ERROR` block listing which invariant failed and which file could not be written. Do NOT print `REFACTOR COMPLETE`. Leave the exact state visible so the user can manually complete the sync.

**Deferred refactor-patterns append**: when PHASE 2 collected `pendingPatternAppends` (uncovered-library research ran inside plan mode — the write was deferred), append those sections to `.claude/research/refactor-patterns.md` in the same parallel batch. Empty or absent → skip silently.

## Step 4 — Scoped auto-commit

Follow [shared/SCOPED-COMMIT.md](.claude/skills/shared/SCOPED-COMMIT.md). dev-refactor deltas:

- **Baseline**: status form — `.project/session/pre-skill-status.txt` (PHASE 0 step 3, post-worktree-switch).
- **OVERLAP policy**: interactive. **Fallback**: `git add -A`.
- **Commit**: batch `refactor(batch): {summary}` with a short body listing what changed per feature in plain language (e.g. `map-home: dubbele logica samengevoegd`, `data-store: ongewijzigd gelaten`). Single-feature: `refactor({feature}): {summary}`. No internal status labels (REFACTORED/CLEAN/ROLLED_BACK) in the commit message.
- **Cleanup**: session files after commit.

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

Print `REFACTOR COMPLETE` with per-feature ✓/✗ lines (name, status, improvement count). Next steps: `/dev-ship {next-feature}` → next feature, `/project-plan` → revise scope.

> **Todo**: Apply the Next-Step Clipboard Offer (binary Ja/Nee) —
> read '.claude/skills/shared/NEXT-STEP-OFFER.md'.
> Recommended command: `/dev-ship {next-feature}` → loop to next backlog feature.

**PHASE Finalize** (single-mode only — skip if `feature_queue.length > 1`): follow `shared/FINALIZE-REFERENCE.md → Finalize Offer Decision` (TEAM_MODE + PR-state dispatch). In team mode, the matrix offers a 3-way choice: Open PR / Merge directly to main / Keep open.
