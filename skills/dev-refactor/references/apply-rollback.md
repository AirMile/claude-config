# PHASE 4: Apply + Test Per Feature

**Goal:** Apply approved improvements and test, with per-feature rollback isolation.

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
     cp "$file" "/tmp/refactor-snapshot-{feature_name}-$(basename $file)"
   done
   ```

   Rollback for shared files uses the snapshot, not `git checkout` (which would also undo preceding features' accepted changes to that file).

   b. **Apply improvements using Edit tool:**
   - Follow priority order strictly
   - **Re-read each file immediately before editing** (prevents "File has not been read yet" errors)
   - Group edits by file: read file → apply ALL edits for that file → move to next file
   - **Pipeline scope only** (see "Scope Rule" top of skill) — assert before each edit
   - Keep changes non-breaking
   - Track: `modified_files[feature_name] = [list of existing files changed]`
   - Track: `created_files[feature_name] = [list of new files created]`

   c. **Run test suite after this feature's changes:**
   - Detect test command from CLAUDE.md `### Testing` section
   - **All pass** → mark feature as APPLIED, continue to next feature
   - **Any fail → analyze before rollback:**

     | Test failure type                                         | Action                     |
     | --------------------------------------------------------- | -------------------------- |
     | Test expects old behavior that was intentionally improved | Update test, re-run        |
     | Genuine regression (broke unrelated functionality)        | Rollback THIS feature only |
     | Flaky or environment-dependent                            | Re-run once, then decide   |

     **If test update needed:**
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
       cp "/tmp/refactor-snapshot-{feature_name}-$(basename $file)" "$file"
     done
     ```

     Mark feature as ROLLED_BACK with reason. Continue to next feature.

   d. **Report per feature:**

   ```
   ✓ {feature-name}: {N} improvements applied
   ```

   or:

   ```
   ✗ {feature-name}: rolled back ({reason})
   ```

## Non-breaking rule

Skip improvements that change public signatures, schemas, or remove public APIs. If a breaking change is needed → note it and skip.
