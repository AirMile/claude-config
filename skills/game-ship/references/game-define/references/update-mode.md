# Update-mode (PHASE 0b)

Only enter this flow if `.project/features/{feature-name}/feature.json` already exists.

1. Read `.project/features/{feature-name}/feature.json`.

2. Show existing requirements summary:

   | ID      | Description (first 60 chars) | Status  |
   | ------- | ---------------------------- | ------- |
   | REQ-001 | {description}                | pending |

3. AskUserQuestion: "Feature **{name}** already exists with {N} requirements. What do you want to change?"

   ```yaml
   header: "Update-mode"
   options:
     - label: "Add requirements (Recommended)", description: "New requirements, numbered from REQ-{N+1}"
     - label: "Edit requirements", description: "Reformulate existing requirements or adjust acceptance"
     - label: "Remove requirements", description: "Remove requirements from scope (soft-delete)"
     - label: "Multiple of the above", description: "Combination of add, edit and/or remove"
   multiSelect: false
   ```

4. Process delta based on choice:
   - **Add**: Run through PHASE 1 Requirements Gathering for the new requirements only. Number from `REQ-{N+1}`.
   - **Edit**: Ask which REQ-IDs. Per REQ: show current description + acceptance, ask for new version. Use format `[{ when, then }]` per scenario.
   - **Remove**: Ask which REQ-IDs. Mark with `deltaOp: "REMOVED"` — do not physically delete from the array. Also: remove the REQ-ID from all `buildSequence[].requirements[]` arrays; if a step becomes empty → remove the step.
   - **Multiple**: Combine the above flows in one round.

5. Save `deltaOp` per requirement:
   - Unchanged: `"deltaOp": "UNCHANGED"`
   - New: `"deltaOp": "ADDED"`
   - Modified: `"deltaOp": "MODIFIED"` + `"previousDescription": "{original text}"`
   - Removed: `"deltaOp": "REMOVED"` (stays in array, is not built or tested)

6. **Status-reset**: if feature `status` was `"DOING"` → reset to `"DEFINED"` in `feature.json` and backlog.

7. Skip PHASE 1b (feature splitting) unless the number of requirements after update exceeds 6 and there are clear clusters.

8. Go to PHASE 2 for ADDED and MODIFIED requirements only. **Appendix draft in update-mode**: author the machine-contract appendix as the **full merged define-owned state** — carry existing `architecture`, `testStrategy`, `durableDecisions` and UNCHANGED requirements verbatim from the existing `feature.json` (read in step 1) into the draft, and overlay the deltas (ADDED/MODIFIED/REMOVED with their `deltaOp`). `buildSequence`: remove steps empty after REMOVED-filtering; add steps for ADDED requirements; leave UNCHANGED steps unchanged. At PHASE 4 the `feature-from-plan.js` extract writes this draft; its top-level merge automatically preserves the build-phase-and-later keys (`build`, `tests`, `refactor`, …) that the draft does not carry. Do not hand-edit feature.json unless the script hits the fallback path. The Seed Alignment Check at the end of PHASE 3 still runs — update-mode can drift just as easily as a fresh define.
