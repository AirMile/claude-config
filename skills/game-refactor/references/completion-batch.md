# PHASE 5: Batch Completion

**Goal:** Proportional documentation, single backlog update, single commit.

## Step 1 — Write feature.json per feature (read-modify-write)

For each feature:

1. Read `.project/features/{feature-name}/feature.json`
2. Add `refactor` section:

   **For CLEAN features:**

   ```json
   {
     "refactor": {
       "status": "CLEAN",
       "improvements": {},
       "decisions": [],
       "positiveObservations": ["..."],
       "failureAnalysis": null,
       "pendingImprovements": []
     }
   }
   ```

   **For REFACTORED features:**

   ```json
   {
     "refactor": {
       "status": "REFACTORED",
       "improvements": {
         "security": [{ "file": "...", "issue": "...", "fix": "..." }],
         "performance": [],
         "signals": [],
         "dry": [],
         "clarity": []
       },
       "decisions": [{ "decision": "...", "rationale": "..." }],
       "positiveObservations": ["..."],
       "failureAnalysis": null,
       "pendingImprovements": []
     }
   }
   ```

   **For ROLLED_BACK features:**

   ```json
   {
     "refactor": {
       "status": "ROLLED_BACK",
       "improvements": {},
       "decisions": [],
       "positiveObservations": [],
       "failureAnalysis": "...",
       "pendingImprovements": ["..."]
     }
   }
   ```

3. Update top-level `status`:
   - CLEAN/REFACTORED: `"DONE"`, `"shipped": true`, `"shippedAt": <ISO-date>`, `"shippedSha": <git-sha after auto-commit>`
   - ROLLED_BACK: keep `"DONE"` (refactor.status documents the rollback), no shipped fields
4. Write feature.json back (do NOT overwrite other sections)

If N > 1 features: read all feature.json in parallel, mutate each in memory, write all back in parallel.

## Step 2 — Parallel sync (backlog + dashboard + conditional context sync)

Read in parallel (skip if not exists):

- `.project/backlog.html`
- `.project/project.json`
- `.project/project-context.json`

Mutate in memory:

**Backlog** (see `shared/BACKLOG.md`): status remains `"DONE"` for all features (CLEAN, REFACTORED, and ROLLED_BACK). Set per feature the `refactor` field:

- CLEAN or REFACTORED → `f.refactor = "REFACTORED"`, `f.shipped = true`, `f.shippedAt = <ISO-date>`, `f.shippedSha = <git-sha>`, remove `transition` (if present)
- ROLLED_BACK → `f.refactor = "ROLLED_BACK"`, remove `transition` (if present)

Set `data.updated` to current date.

**Dashboard** (see `shared/DASHBOARD.md`): unchanged — no separate dashboard merge in game-refactor other than feature status. Learning extraction: see Step 2.5 below.

**Context sync (conditional)** — only if REFACTORED features contain structural changes:

Trigger if ANY: scripts renamed/moved, new scripts via extraction, scene structure fundamentally changed, autoload/singleton patterns changed.
Skip if: only internal code quality (naming, DRY, type hints, clarity), performance without structural impact.

When triggered (in `project-context.json` mutation):

- `context.structure` → overwrite full tree with changed script paths
- Extracted scripts/scenes → add to structure tree
- `context.patterns` → merge changed patterns
- `context.updated` → current date
- `architecture.components` → update existing components (status, src, test, connects_to), add new ones if scenes/signals were renamed/split. Follow component-first model from `shared/DASHBOARD.md`.
- Log: `context: {N} updates ({keys touched})` or `context: no updates needed`

Write back in parallel:

- Edit `backlog.html` (keep `<script>` tags intact)
- Write `project.json`
- Write `project-context.json` (if context/architecture changed)

## Step 2.5 — Learning extraction [checkpoint]

REFACTORED/CLEAN only (skip ROLLED_BACK):

**Mapping per source:**

| Source                                       | learning.type | learning.source |
| -------------------------------------------- | ------------- | --------------- |
| `decisions[]` (APPLY, cross-cutting)         | `pitfall`     | `inferred`      |
| `decisions[]` (APPLY, other)                 | `pattern`     | `extracted`     |
| `decisions[]` (SKIP, cross-feature relevant) | `pattern`     | `inferred`      |
| `positiveObservations[]`                     | `observation` | `inferred`      |

**APPLY → pitfall criteria (≥1 required):**

- **Cross-cutting**: touches naming, typing (GDScript type-hints), error handling, layering, a DRY violation against an existing shared/utility, async/sync misuse.
- **Godot-specific**: signal pollution (too many `connect()` chains on a single node), node-lifecycle violations (`_ready` doing work that belongs in `_init` or vice versa), autoload misuse, scene leaks (missing `queue_free` after instantiation), shader/material allocations in `_process`, the `_physics_process` vs `_process` choice, hardcoded paths (`get_node("../../../foo")`) instead of `@onready var`, security-sensitive netcode (input validation, state authority leak).
- **Convention-derived**: the fix is directly traceable to a rule in `.claude/research/architecture-baseline.md`, an existing `pattern` learning in `project-context.json`, or `context.patterns` in `project.json`.
- **Auto-promote**: if a `pattern` learning with the same dedup-key already exists (see `shared/LEARNING-EXTRACTION.md § Dedup Tokenizer`) → emit as `pitfall` instead of pattern.

Do not mark as pitfall if: the fix is feature-specific (a single scene/node/script without a generalizable principle), pure performance without architectural implications, or cosmetic (whitespace, comment).

Pitfall-summary framing (negative, ≤200 chars): `Avoid {anti-pattern}: {why}. Refactor extracted to {fix-location}.`

**SKIP → pattern criteria:**

Emit only if the rationale describes a general principle: security/netcode, numerical correctness (delta-timing), platform compat, frame ordering, race conditions against autoload init. Feature-specific business logic → do not emit.

Convention framing (≤200 chars): `Convention: keep {pattern}. {why-skipped}.`

**Filter and dedup:** cross-feature relevance only. Schema/dedup: same as game-verify completion-sync.md § Step 3b (Jaccard 0.55). Append to `project-context.json → learnings[]` (add to the in-memory mutation from Step 2 and write in the parallel write-back above). Log confirmation or "no learnings — skip".

## Step 3 — Scoped auto-commit

Compare current git status with baseline from PHASE 0:

```bash
git status --porcelain | sort > /tmp/current-status.txt
```

Categorize files by comparing with `.project/session/pre-skill-status.txt`:

- **NEW** (only in current, not in baseline) → `git add` automatically
- **OVERLAP** (in both baseline AND current) → warn user via AskUserQuestion: "These files had pre-existing uncommitted changes and were also modified by this skill: {list}. Include in commit?" Options: "Include (Recommended)" / "Skip"
- **PRE-EXISTING** (only in baseline) → do NOT stage

If baseline file doesn't exist, fall back to `git add -A`.

```bash
git commit -m "$(cat <<'EOF'
refactor(batch): {summary}

{N} features analyzed, {clean} clean, {refactored} refactored, {rolled_back} rolled back

{for each REFACTORED feature:}
- {feature}: {improvement count} improvements ({categories})
{for each CLEAN feature:}
- {feature}: clean (no changes needed)
{for each ROLLED_BACK feature:}
- {feature}: rolled back ({reason})
EOF
)"
```

For single-feature commits, use: `refactor({feature}): {summary}`

Clean up: `rm -f .project/session/pre-skill-status.txt .project/session/active-{feature-name}.json /tmp/current-status.txt`

## Step 3b — Feature archiving

For each CLEAN or REFACTORED feature where `.project/features/{name}/feature.json` exists:

```bash
mkdir -p .project/features/archive
mv .project/features/{name}/ .project/features/archive/{shippedAt-date}-{name}/
```

- `{shippedAt-date}` = date from the just-written `shippedAt` field (YYYY-MM-DD format)
- Multiple features in one run → each to its own archive dir
- ROLLED_BACK features: do not archive
- Skip if feature dir no longer exists (idempotent)

## Step 4 — Completion output

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
REFACTOR COMPLETE

{N} feature(s) processed:
{for each CLEAN feature:}
✓ {name} — clean (no changes needed)
{for each REFACTORED feature:}
✓ {name} — {improvement-count} improvements applied
{for each ROLLED_BACK feature:}
✗ {name} — rolled back ({reason})

Refactoring complete. Features remain in DONE status.

Next steps:
  1. /game-define {next-feature} → next feature from backlog
  2. /project-backlog → revisit backlog if scope has changed
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

**PHASE Finalize** — run after commit, only if BOTH true:

1. Single-mode (`feature_queue.length == 1`, not codebase-mode)
2. Current branch matches `worktree-*` pattern (`git branch --show-current`)

**Step A — PR offer** (show only if ALL: `TEAM_MODE === "team"` (read via `shared/PROJECT-MODE.md`), `gh` on PATH + `gh auth status` exit 0, clean tree):

```yaml
header: "Open PR"
question: "Push + open PR for worktree-{feature-name}?"
options:
  - label: "Yes, push + PR (Recommended)"
    description: "Push the branch and open a PR via gh. Worktree stays until merged."
  - label: "No, skip PR"
    description: "Skip the PR; show finalize prompt instead."
multiSelect: false
```

On "Yes" → follow `{skills_path}/shared/PR.md`. Print PR URL. Suppress finalize prompt below.
On "No" or any precondition fail → fall through to finalize prompt.

**Step B — Finalize prompt**: follow `shared/FINALIZE.md → Finalize Offer Decision`.

On "Keep open" → print `💡 Run /game-refactor {feature-name} on this worktree when ready`.
