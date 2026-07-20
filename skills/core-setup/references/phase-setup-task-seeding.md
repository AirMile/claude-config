# Setup Task Seeding (shared: greenfield Phase 7c / mature PHASE 5.7)

Seed recommended setup tasks into the backlog so the user has a clear next path. Frontend projects only.

## Parameters

The caller's transition marker supplies:

- `variant`: `greenfield` | `mature`
- `auto-execute`: `true` (greenfield — chain to `/design-tokens` directly) | `false` (mature — stdout line only)

## Trigger

`stack.framework` is a frontend framework (React, Vue, Svelte, Next.js, Nuxt, Astro, Remix, SolidJS) **or** a game framework (Godot / `project.godot` present) — `/design-tokens` is cross-domain (web emits CSS, game emits a Godot Theme `.tres`). Skip entirely for CLI, backend-only, or desktop.

## Step 1 — Compute conditions

- `needsTheme` = `project.json#theme` has no `colors` or is empty

Skip this phase entirely if `needsTheme = false`.

## Step 2 — Seed feature to `.project/backlog.json`

1. If `backlog.json` does not exist: create it with the schemaVersion-2 scaffold (see `shared/BACKLOG.md`), set `source = "/core-setup"`
2. Read `.project/backlog.json` → parse as JSON
3. Check `features.find(f => f.name === "setup-design-tokens")` — skip adding if it already exists (idempotent)
4. Add if `needsTheme = true`:

```json
{
  "name": "setup-design-tokens",
  "type": "THEME",
  "status": "TODO",
  "phase": "P1",
  "description": "Define color palette, typography scale, and spacing tokens via /design-tokens before UI work begins.",
  "source": "/core-setup",
  "dependencies": []
}
```

5. Always set `flags.hasSeed = true` and `flags.seedPath = ".project/project-seed.md"` (even if the design-tokens item already existed) — this makes the `/project-plan` button appear in the backlog dashboard. `flags` is root-level (see `phase-dashboard-init.md`), not nested under a `data` key.
6. Set `updated` to current date (`YYYY-MM-DD`)
7. Write the JSON back to `.project/backlog.json`

## Step 3 — Follow-up per variant

- **`auto-execute: ask`** (greenfield): after seeding, AskUserQuestion:

  ```yaml
  header: "Design tokens"
  question: "Set up design tokens now?"
  options:
    - label: "Yes, run /design-tokens now (Recommended)"
      description: "Chain immediately — colors, typography, spacing before UI work begins"
    - label: "Skip — I'll run /design-tokens myself later"
      description: "No chain now — it stays listed under Next Steps in the Phase 9 summary"
  multiSelect: false
  ```

  On "Yes": exit core-setup and run `/design-tokens` directly. Report in the summary under "Next skill running". On "Skip": no chain — Phase 9's Smart Next Steps lists `/design-tokens` as a follow-up (it's already a `TODO` in the backlog).
- **`auto-execute: false`** (mature): unchanged — no interactive modal, only show `Setup task added to backlog` in stdout. The report "Next steps" section then automatically shows the `/design-tokens` bullet.

When done: return to the caller's next phase.
