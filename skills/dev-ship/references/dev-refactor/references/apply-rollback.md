# PHASE 4: Apply + Test Per Feature

**Goal:** Apply approved improvements and test, with per-feature rollback isolation.

**Pre-flight (Step 0, before change tracking):** safety-net mutation check against the `feature.json#tests.mutationScore` baseline. Full flow + gate conditions in `.claude/skills/shared/MUTATION-TESTING.md` § dev-refactor PHASE 4 step 0. The gate is informative (no auto-rollback) — on a score drop, or a missing baseline with a low score, the user decides whether the refactor proceeds. Runner skipped → log and continue.

## Priority order for each feature (execute in this sequence)

1. Security improvements
2. Performance optimizations
3. Efficiency improvements
4. DRY/Refactoring improvements
5. Simplification (remove over-engineering)
6. Clarity (readability improvements)
7. Code quality improvements
8. Error handling improvements

## Steps

1. **Initialize change tracking:**

   ```bash
   git rev-parse HEAD  # Store as saved_hash for global rollback
   ```

2. **For each feature with approved improvements:**

   a. **Track files for targeted rollback** (no git stash needed — file-level tracking is sufficient):

   Initialize empty lists: `modified_files[feature_name] = []`, `created_files[feature_name] = []`

   **Shared files**: detect files that appear in multiple features' pipelines (`shared_files = intersection(pipeline_files[this_feature], pipeline_files[already_applied_features])`). Snapshot each shared file BEFORE editing:

   ```bash
   for file in {shared_files_for_this_feature}; do
     # Key on the full path, not basename: src/index.ts and lib/index.ts
     # would share one snapshot and roll back the wrong file.
     slug=$(printf '%s' "$file" | tr '/' '_')
     cp "$file" "/tmp/refactor-snapshot-{feature_name}-$slug"
   done
   ```

   Rollback for shared files uses the snapshot, not `git checkout` (which would also undo preceding features' accepted changes to that file). Rebuild the same `$slug` on the rollback side — a snapshot restored under a different key silently restores nothing.

   b. **Apply improvements using Edit tool:**
   - Follow priority order strictly
   - **Re-read each file immediately before editing** (prevents "File has not been read yet" errors)
   - Group edits by file: read file → apply ALL edits for that file → move to next file
   - **Pipeline scope only** (see "Scope Rule" top of skill) — assert before each edit
   - Keep changes non-breaking
   - Track: `modified_files[feature_name] = [list of existing files changed]`
   - Track: `created_files[feature_name] = [list of new files created]`

   c. **Run test suite after this feature's changes** (Test Impact Analysis-scoped):
   - Detect test command from CLAUDE.md `### Testing` section
   - **TIA scope when vitest:** if runner = vitest, use `npx vitest run --related {modified_files[feature_name]} {created_files[feature_name]}` instead of the full suite. This runs only tests that transitively import the feature files. Vitest's `--related` falls back to an empty set without error when no tests match (unlike a normal run, which throws FilesNotFoundError) — on an empty set: treat as PASS and log "TIA: no related tests for {feature}". For other runners (jest/mocha) or when detection fails: full suite.
   - **Why TIA is safe here** (and not in dev-build PHASE 2b): in refactor we know exactly which files changed per feature. `--related` traces imports transitively, so regressions in dependent modules are caught. Non-import-based coupling (runtime registries, dynamic imports) remains a blind spot — that's why the **final full-suite run at the end of PHASE 4** (after all features) stays in place as the safety net.
   - **All pass** → mark feature as APPLIED, continue to next feature
   - **Any fail → analyze before rollback:**

     | Test failure type                                         | Action                     |
     | --------------------------------------------------------- | -------------------------- |
     | Test expects old behavior that was intentionally improved | Update test, re-run        |
     | Genuine regression (broke unrelated functionality)        | Rollback THIS feature only |
     | Flaky or environment-dependent                            | Re-run once, then decide   |

     **Guard on row 1 — check traceability before updating a test.** Refactor has no
     `acceptance[]`/`durableDecisions[]` in context (unlike build/verify), so "intentionally
     improved" is the one call in this phase most likely to be a guess. Before updating a test:

     - Read the failing test's REQ-pointer comment (`// {REQ-id} · {feature-name}` — see
       `dev-build/techniques/tdd.md` § Step 1). No tag → this is a builder-only unit test with no
       acceptance link; row 1 stays allowed as-is.
     - Tag present → the assertion traces to `feature.json#requirements[]` for `{feature-name}`.
       Check that feature's `durableDecisions[]` — already in context from the full `feature.json`
       Read at PHASE 1 step 3/4 (`workflow.md:30,98`; live path, or `features/archive/*-{feature-name}/`
       if shipped) — it just wasn't being consulted for this decision until now. If any entry's
       `constraint` or `chosen` explains the behavior the failing assertion checks → this is NOT "intentionally
       improved by refactor", it's refactor contradicting an already-settled decision. **Forbid the
       test update — go straight to rollback THIS feature only.** Rewriting the assertion here would
       make refactor the one phase that can erase a durable decision unilaterally, with the erasure
       becoming the new gate the next run trusts.
     - Tag present but no matching `durableDecisions[]` entry → row 1 remains allowed.

     **If test update needed** (guard above did not forbid it):
     - Update ONLY the specific assertion(s)
     - Re-run FULL test suite
     - If still failing → rollback THIS feature only
     - Max 1 test update attempt per failing test

     **Per-feature rollback (only this feature, not others):**

     ```bash
     # Files unique to this feature — restore via git:
     git checkout -- {unique_files_for_this_feature}
     rm -f {created_files[feature_name]}

     # Files shared with already-applied features — restore from snapshot (not git, to preserve prior feature's edits):
     for file in {shared_files_for_this_feature}; do
       slug=$(printf '%s' "$file" | tr '/' '_')   # same key as the snapshot
       cp "/tmp/refactor-snapshot-{feature_name}-$slug" "$file"
     done
     ```

     Mark feature as ROLLED_BACK with reason. Continue to next feature.

   d. **Cleanup snapshots:** after the feature is APPLIED or ROLLED_BACK, remove its snapshots — `rm -f /tmp/refactor-snapshot-{feature_name}-*`. Prevents stale snapshots from leaking across sessions.

   e. **Report per feature:**

   ```
   ✓ {feature-name}: {N} improvements applied
   ```

   or:

   ```
   ✗ {feature-name}: rolled back ({reason})
   ```

3. **Final full-suite gate (after all features):** run the complete test suite once (`npm test` / `npm run test -- --run` depending on CLAUDE.md `### Testing`). This catches regressions that TIA's per-feature `--related` scope misses: runtime registries, dynamic imports, non-import-based coupling between features. On FAIL: identify the responsible feature(s) via `git bisect` over the PHASE 4 commits OR per-feature rollback of the last-applied feature → re-run. Max 2 rollback rounds before escalating to user-confirm.

## Non-breaking rule

Skip improvements that change public signatures, schemas, or remove public APIs. If a breaking change is needed → note it and skip.
