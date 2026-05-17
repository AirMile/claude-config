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
     - label: "Add requirements (Recommended)", description: "New requirements via PHASE 1 flow, numbered from REQ-{N+1}"
     - label: "Modify requirements", description: "Reword existing requirements or adjust acceptance"
     - label: "Remove requirements", description: "Remove requirements from scope (soft-delete)"
     - label: "Multiple of the above", description: "Combination of add, modify, and/or remove"
   multiSelect: false
   ```

4. Process delta based on choice:
   - **Add**: Run through PHASE 1 Requirements Gathering for new requirements only. Number from `REQ-{N+1}`.
   - **Modify**: Ask which REQ-IDs. Per REQ: show current description + acceptance, ask for new version. Use format `[{ when, then }]` per scenario.
   - **Remove**: Ask which REQ-IDs. Mark with `deltaOp: "REMOVED"` — do not physically remove from array. Also: remove the REQ-ID from all `buildSequence[].requirements[]` arrays; if a step becomes empty afterwards → remove the step.
   - **Multiple**: Combine the above flows in one round.

5. Save `deltaOp` per requirement:
   - Unchanged: `"deltaOp": "UNCHANGED"`
   - New: `"deltaOp": "ADDED"`
   - Modified: `"deltaOp": "MODIFIED"` + `"previousDescription": "{original text}"`
   - Removed: `"deltaOp": "REMOVED"` (stays in array, not built or tested)

6. **Status-reset**: if feature `status` was `"DOING"` → reset to `"DEFINED"` in `feature.json` and backlog.

7. Skip PHASE 1b (feature splitting) unless the number of requirements after update exceeds 6 and there are clear clusters.

8. Go to PHASE 2 for ADDED and MODIFIED requirements only. UNCHANGED requirements do not need re-architecture, unless MODIFIED requirements have architectural impact (ask user). The Seed Alignment Check at the end of PHASE 2 still runs — update-mode can drift just as easily as a fresh define.

9. At PHASE 3 write: **merge** delta into existing `feature.json` — do not overwrite completely. Keep existing `architecture`, `apiContract`, `design`, `testStrategy`, `durableDecisions`, `research` and UNCHANGED requirements intact (unless MODIFIED requirements have architectural impact — ask user). `buildSequence`: remove steps that are empty after REMOVED-filtering; add new steps for ADDED requirements (from PHASE 2 architecture output); leave existing steps for UNCHANGED requirements untouched.
