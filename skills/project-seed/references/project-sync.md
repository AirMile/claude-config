# Step 1c: Project Sync

Loaded only when the user chose "Sync with project" in Step 1. Enrich the existing concept with features/functionality that exist in the project but are not yet described in the concept document.

**1. Gather project state:**

- Read existing concept from `.project/project-seed.md`
- Read `.project/backlog.json` → parse JSON (see `shared/BACKLOG.md`)
- Collect all feature names, descriptions, and types from backlog
- Read `.project/project.json` → extract `entities` (names, descriptions) and `endpoints` (paths, methods) if present
- **Built architecture**: run the `ideation` profile from [shared/PROJECT-CONTEXT-LOAD.md](../../shared/PROJECT-CONTEXT-LOAD.md) — components with `status: "done"` are a gap source (built but possibly undescribed); `planned` components are context only
- **Learnings** via [shared/LEARNINGS-LOAD.md](../../shared/LEARNINGS-LOAD.md) (`scopes: [architectural]`, `pitfall-prefix: true`, `current-feature: none`) — shown as context in the analysis, never as gap rows
- Scan codebase for routes/pages:
  - Glob `app/**/page.tsx`, `src/pages/**/*.tsx`, `src/routes/**/*.tsx`
  - Glob `app/**/route.ts`, `src/api/**/*.ts` (API routes)
- **Accumulated drift from prior skill runs:**
  - Glob `.project/features/*/feature.json` → collect all `seedDrift[]` entries (skip features where array is absent or empty)
  - Check `backlog.json#seedDrift[]` if present
  - Carry as `driftEntries[]` in memory for the gap-detection step

**2. Detect gaps:**

Compare all sources (backlog features, codebase routes, project.json entities/endpoints) against concept content.

**Match detection:**

- **No** — item name/description has no mention anywhere in the concept document
- **Partial** — item name appears in the concept but with significantly less detail than the backlog/codebase version (e.g. mentioned in a list but not explained, or described in one sentence while backlog has full requirements)
- **Yes** (covered) — item is meaningfully described in the concept

Present findings:

```
PROJECT SYNC ANALYSIS

Concept: {title}
Backlog features: {count} · Codebase routes: {count} · Entities: {count} · Endpoints: {count} · Built components: {count} · Deferred drift: {count}

GAPS DETECTED:

| #  | Source            | Name             | Type    | In Concept         |
| -- | ----------------- | ---------------- | ------- | ------------------ |
| 1  | Backlog           | {feature-name}   | FEATURE | No                 |
| 2  | Codebase          | /api/webhooks    | API     | No                 |
| 3  | Entity            | User             | DATA    | Partial            |
| 4  | Architecture      | {component-name} | BUILT   | No                 |
| 5  | /dev-ship (define phase) drift | {featureDecides} | drift   | drift — {category} |

ALREADY COVERED:
- {feature described in both concept and backlog}

{LEARNINGS CONTEXT block, if any — context for integration phrasing, not gap rows}
```

Architecture rows (source = `Architecture`, type `BUILT`) are components with `status: "done"` in `project-context.json` that the concept does not describe — built reality the concept is missing. Drift rows (source = `/dev-ship (define phase) drift`, `/game-ship (define phase) drift`, `/project-plan drift`, `/project-todo drift`) originate from deferred `seedDrift[]` entries — decisions that already happened in earlier skill runs and were explicitly skipped or hit `/project-todo`'s record-only path. The `In Concept` column renders `drift — {category}` so contradiction / new-direction / scope-expansion are visibly distinct. Show `seedSays` in the `Name` column (for contradictions this is a verbatim seed quote) and `featureDecides` as context so the user understands what changed.

**3. Select gaps to integrate:**

Use AskUserQuestion:

```yaml
header: "Gaps"
question: "Which items do you want to add to the concept?"
options:
  - label: "All gaps (Recommended)", description: "Add all {count} missing items"
  - label: "Select items", description: "Choose per item what to add"
  - label: "None, just view", description: "Close sync without changes"
multiSelect: false
```

**If "Select items":** show the gaps as a numbered list and ask: "Which gaps do you want to add? Give numbers (e.g. `1, 3, 5`) or `all`." Parse → selected-set, integrate only those items.

**If "None":** show the analysis as informational output and end.

**4. Integrate into concept:**

- For each selected gap, draft a section or bullet point that fits naturally into the existing concept structure
- Show the updated concept as a diff preview (new sections marked)
- Confirm before writing via AskUserQuestion: "Yes, update concept (Recommended)" / "Adjust" (adjust the integration before writing)

**5. Write updated seed:**

- Write to `.project/project-seed.md`
- Update project.json metadata (seed.name, seed.pitch) if changed
- **Drift cleanup** — for each `driftEntries[]` item that was selected and integrated:
  - If from `feature.json#seedDrift[]`: remove the entry from the array (rewrite `feature.json`). If the array is empty after cleanup, omit the field.
  - If from `backlog.json#seedDrift[]`: remove the entry from the array (rewrite `.project/backlog.json`).
  - Not integrated (user skipped): leave intact for a future sync.

```
SEED SYNCED

Added: {count} items
Source: {backlog: X, codebase: Y, drift: Z}
File: .project/project-seed.md

Next steps:
- /project-seed critique - Analyze the updated seed
- /project-seed brainstorm - Brainstorm on the new components
- /project-plan - Turn the updated seed into a gap-checked backlog
```
