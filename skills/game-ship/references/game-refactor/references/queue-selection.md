# Queue Selection (PHASE 0 step 2)

**Determine feature queue:**

**a) Feature name provided** (`/game-refactor water-ability`):

- Validate feature exists in `.project/features/`
- Feature queue = `[water-ability]` (regardless of refactor status)

**b) No feature name** (`/game-refactor`):

- Present scope selection via **AskUserQuestion**:
  - header: "Scope"
  - question: "What do you want to refactor?"
  - options:
    - label: "Unrefactored features (Recommended)", description: "{N} features: {feature1}, {feature2}, ..."
    - label: "All DONE features", description: "All {M} DONE features, including previously refactored ones"
    - label: "Entire codebase", description: "Scan all source files, not feature-bound"
  - multiSelect: false
- If "Unrefactored features" → feature queue = unrefactored DONE features
- If "All DONE features" → feature queue = all DONE features
- If "Entire codebase" → **codebase mode** (see below)
- If 0 unrefactored features: show "All features have already been refactored" in the option description

**c) "recent"**: find most recently modified `feature.json` with `tests` section, queue = `[that feature]`

**Codebase mode** ("Entire codebase"):

- Pipeline files = all GDScript files from project (detect `src/`, `scripts/`, or scene directories from project.json or CLAUDE.md)
- Exclude: `.godot/`, `.project/`, `addons/gut/`, test files
- Do not write feature.json — save result to `.project/session/codebase-refactor.json`
- Commit message: `refactor(codebase): {summary}`
- Skip PHASE 5 feature.json/backlog updates — only commit + report
