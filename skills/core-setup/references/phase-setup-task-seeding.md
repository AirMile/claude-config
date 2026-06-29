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

1. If `backlog.json` does not exist: create it with the schemaVersion-2 scaffold (see `shared/BACKLOG.md`), set `data.source = "/core-setup"`
2. Read `.project/backlog.json` → parse as JSON
3. Check `data.features.find(f => f.name === "setup-design-tokens")` — skip adding if it already exists (idempotent)
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

5. Always set `data.flags.hasSeed = true` and `data.flags.seedPath = ".project/project-seed.md"` (even if the design-tokens item already existed) — this makes the `/project-backlog` button appear in the backlog dashboard
6. Set `data.updated` to current date (`YYYY-MM-DD`)
7. Write the JSON back to `.project/backlog.json`

## Step 3 — Follow-up per variant

- **`auto-execute: true`** (greenfield): no prompt. Skill chaining is silent — after seeding, exit core-setup and run `/design-tokens` directly. Report in the summary under "Next skill running".
- **`auto-execute: false`** (mature): no interactive modal — only show `Setup task added to backlog` in stdout. The report "Next steps" section then automatically shows the `/design-tokens` bullet.

When done: return to the caller's next phase.
