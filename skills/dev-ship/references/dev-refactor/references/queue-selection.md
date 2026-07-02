# Queue & Scope Selection (PHASE 0 step 2 — no-argument path)

Loaded only for `/dev-refactor` without argument. (Name-provided and "recent" cases are handled inline in workflow.md step 2.)

### b0) UI-queue detection (check first)

`queued = data.features.filter(f => f.transition === "refactoring" && f.status === "DONE" && !f.shipped)` (see `shared/BACKLOG.md → Lifecycle Protocol`)

If `queued.length > 0`:

- Show: `Backlog: ✓ Task picked up — {names}`
- **Auto-select if `queued.length <= 3`**: set `feature_queue = queued`, `mode = "feature"`, log `Queue: auto-selected {names}`, jump to **step 3** (worktree-switch). No prompt needed — small queue is always the right choice.
- **AskUserQuestion only if `queued.length > 3`**:
  - header: "Queue"
  - question: "{N} features marked for refactor: {names}. Use as queue?"
  - options:
    - label: "Yes, use queue (Recommended)", description: "{names}" → `feature_queue = queued`, `mode = "feature"`, jump to **step 3**
    - label: "No, choose different scope" → continue to b1 below
  - multiSelect: false

If `queued.length == 0` → continue directly to b1 below.

### b1) Scope selection (if no UI-queue or user chose "different scope")

Present scope selection via **AskUserQuestion**:

- header: "Scope"
- question: "What do you want to refactor?"
- options:
  - label: "Not yet refactored features (Recommended)", description: "{N} features: {feature1}, {feature2}, ..."
  - label: "Small items check (CHANGE/BUG/etc)", description: "{K} small items without pipeline: {item1}, {item2}, ... — light convention check, mark as shipped after approval"
  - label: "All DONE features", description: "All {M} DONE features, including previously refactored"
- multiSelect: false

- If "Not yet refactored features" → feature queue = unrefactored DONE features, mode = `feature`
- If "Small items check" → **small-items mode** (see below), mode = `small-items`
- If "All DONE features" → feature queue = all DONE features, mode = `feature`
- If 0 unrefactored features: show "All features have already been refactored" in the option description
- If 0 small-items: show "No small items waiting for check" in the option description

## Small-items mode (`--small-items` or via choice)

- Item queue = all `data.features` with `status === "DONE" && !shipped && !feature.json`
- For each item: determine scope via git log — find commits with item name in commit message: `git log --oneline --grep="{item.name}" -- {src/}`
- If no commits found: log warning "No commits found for {name} — skip or check manually", skip the item
- Scope files = all files changed in those commits: `git diff {first_hash}^..{last_hash} --name-only`
- Scope rule for small-items: **only files from the commit-scope may be inspected** (no pipeline files list, but commit-diff scope)

**Small-items PHASE-routing** (skip PHASE 0 steps 3-5, jump directly to PHASE 1):

- PHASE 1: one light Quality-lens Explore agent per item (not Reuse/Efficiency — those are feature-pipeline specific). Input: commit-diff + `shared/CODING-RULES.md` + (frontend files) `shared/FRONTEND-RULES.md` + `shared/PATTERNS.md` + stack-baseline
- PHASE 2: skip
- PHASE 3: combined approval for all items that pass the check: "X items: CLEAN. Mark as shipped?" (one AskUserQuestion, default = Yes)
- PHASE 4: skip — no code edits for light check (only code edits if Quality-lens has HIGH findings, then normal apply flow)
- PHASE 5: write `shipped = true`, `shippedAt`, append to `project.json.recentChanges[]`

> Whole-codebase passes are out of scope for this skill — use `/simplify` or `/code-review` for ad-hoc non-feature-bound refactoring.
