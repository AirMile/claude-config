# Context Fabricate + Confirm (mature PHASE 4.5)

**Inputs**: PHASE 1 scan result (dir name), PHASE 2a detected stack, PHASE 2f packages, `README.md`, `package.json`.

Infer project metadata from available sources so the user doesn't have to go through a wizard. Read:

- `README.md`: first H1 as name candidate, first paragraph after the title as pitch candidate
- `package.json`: `name` as name fallback, `description` as pitch fallback
- PHASE 1 scan result: dir name as name fallback-fallback
- PHASE 2a: detected `stack.framework` / `stack.language`
- PHASE 2f: detected `stack.packages`

Assemble:

```
seed.name          ← README H1 | package.json#name | dir name
seed.pitch         ← README first paragraph | package.json#description | ""
seed.seedFile      ← "project-seed.md"
stack.framework    ← PHASE 2a
stack.language     ← PHASE 2a (derived from framework + package.json engines)
stack.packages     ← PHASE 2f
```

**Pre-filter against existing values.** For each inferred field, read the current value from `project.json`:

- If the existing value is **empty/null/missing** → include in modal, default checked.
- If the existing value is **non-empty** → exclude from modal (already set, do not overwrite). Log inline: `Kept existing {field}: {current value}`.

Then show one AskUserQuestion (multi-select) over the remaining (empty) fields only:

- header: "Context"
- question: "I inferred this from the existing code and README. Which fields do you want to accept?"
- options: one checkbox per field with `label: "{field}: {value}"`, all checked by default
- multiSelect: true

If all fields are pre-filled and the modal would be empty: skip the modal entirely, log `All seed/stack fields already present — no inference needed.`

For selected fields: write to `project.json`. Deselected fields remain empty (user fills in later via `/project-seed`).

Do NOT create `.project/project-seed.md`. The accepted pitch lives in `project.json#seed.pitch` only — `/project-seed` is the sole author of the concept document (`shared/SEED.md § Owner`); the mature report's next steps prompt for it.

If `.project/backlog.json` already exists (non-frontend projects that skip PHASE 5.7): read backlog.json → parse JSON → set `data.flags.seedPath = ".project/project-seed.md"` and `data.flags.hasSeed = true` ONLY when `.project/project-seed.md` already exists with > 50 chars (otherwise `false`) → write the JSON back. The `/project-backlog` button appears once a real concept exists.

When done: return to PHASE 5.
