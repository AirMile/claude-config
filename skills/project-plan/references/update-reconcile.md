# Update Mode: Insight Diff + Cancel Proposals

Loaded only in update mode (PHASE 0 Scenario A/C chose "Update backlog"). Runs at the top of PHASE 1, before the merged feature list is built. Turns new insights into NEW-item proposals and obsolete not-yet-built items into explicit CANCELLED proposals — the user confirms every cancellation.

## 1. Gather insight sources

- **Updated seed**: `SEED_CONTEXT.markdown` (already loaded in PHASE 0).
- **New thinking outputs** since the last backlog write:

  ```bash
  find .project/thinking -name '*.md' -newer .project/backlog.json 2>/dev/null
  ```

  For each hit: read the H1 + first section only (never the full file). Classify by name-token match against `features[].name` (tokens ≥ 3 chars): match → refinement of an existing item; no match → new-feature insight.

- **Existing `backlog.json#seedDrift[]`** entries: known divergence already recorded by earlier runs — show as context, do not double-count as new insights.

## 2. Build the diff

Compare seed + new thinking against the existing backlog features:

| Bucket                  | Definition                                                                                         |
| ----------------------- | -------------------------------------------------------------------------------------------------- |
| **NEW**                 | In seed/thinking, not in backlog → proposed as TODO (priority assigned in PHASE 3)                 |
| **MODIFIED**            | In both, description/scope changed → update description, preserve priority/notes                   |
| **UNCHANGED**           | In both, no meaningful change                                                                      |
| **OBSOLETE candidates** | Status TODO or DEFINED, AND subject absent from or contradicted by the updated seed + new thinking |

Split OBSOLETE candidates into:

- **concept-derived** — `source` absent or `"/project-plan"` (managed by this skill)
- **INDEPENDENT** — `source` is anything else (e.g. `/project-todo`, `/team-issues`) — never auto-cancelled

DOING and DONE features are **never** OBSOLETE candidates — in-progress or finished work is protected (existing rule, unchanged).

## 3. Cancel-proposal UX

Skip this step when there are zero OBSOLETE candidates.

Show the candidate table first:

```
OBSOLETE CANDIDATES ({N})

| # | Feature | Status | Source | Why obsolete |
|---|---------|--------|--------|--------------|
| 1 | {name}  | TODO   | /project-plan | {absent from updated seed / contradicted by {thinking-file}} |
| 2 | {name}  | DEFINED | /project-todo ← INDEPENDENT | {reason} |
```

Then AskUserQuestion:

```yaml
header: "Cancel proposals"
question: "{N} not-yet-built items look obsolete given the updated concept. Cancel them?"
options:
  - label: "Cancel {M} concept-derived items (Recommended)"
    description: "Cancel only the concept-derived candidates — INDEPENDENT items stay untouched"
  - label: "Select per item"
    description: "Choose by number — the only way INDEPENDENT items can be cancelled"
  - label: "Keep all"
    description: "No cancellations; obsolete items keep their current status"
multiSelect: false
```

- **"Select per item"** → numbered-list selection (give numbers, e.g. `1, 3` or `all`). INDEPENDENT items require being explicitly named here — a bulk choice never touches them.
- Selected items → `status: "CANCELLED"` + `cancelledReason: "{one-line reason from the diff}"`. Items stay in `features[]` (restorable via the board UI, per `shared/BACKLOG.md`).

## 4. seedDrift integration

Cancellations and NEW items are explicit inputs to the PHASE 3 Seed Alignment Check (`shared/SEED.md § Alignment Check`) — no separate machinery:

- A cancellation of a feature the seed **still describes** → `contradiction` drift item.
- On "Skip — leave seed as-is" → entry lands in `backlog.json#seedDrift[]` with `source: "/project-plan"`, `ref: "feature:{name}"`.

## Output

Continue PHASE 1 step 1 with the merged baseline: existing features + NEW + MODIFIED + CANCELLED markers. The change-marker column in the extraction table uses `CANCELLED` for cancelled items.
