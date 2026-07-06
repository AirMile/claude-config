# Thinking Output Destination

Shared output-destination protocol for the thinking skills (`project-seed`, `project-brainstorm`, `project-critique`). Load at the start of the final output phase — after `ExitPlanMode`, when the refined document is approved and `.project/` writes are allowed again.

**Caller parameters:**

| Caller               | `{kind}`     | Extras                                                   |
| -------------------- | ------------ | -------------------------------------------------------- |
| `project-seed`       | `idea`       | Seed save procedure also writes `seed.scope`             |
| `project-brainstorm` | `brainstorm` | Confirmation blocks include `Applied techniques: {list}` |
| `project-critique`   | `critique`   | Confirmation blocks include `Applied techniques: {list}` |

`{next-steps}` in confirmation blocks = the two sibling thinking skills + `/project-plan` (e.g. for brainstorm: `/project-critique`, `/project-seed`, `/project-plan`).

---

## Scope = feature or page (from input parsing)

Save automatically to the scope location:

- Scope = feature → write to `.project/features/{name}/thinking.md`
- Scope = page/UX → create `.project/thinking/` if needed, write to `.project/thinking/{topic}.md`

```
THINKING OUTPUT SAVED

File: {output-path}
Scope: {feature:{name} | page:{topic}}
```

**Thinking log** (`shared/DASHBOARD-CONTEXT.md § thinking-output`): also write the full markdown to `.project/thinking/{today}-{kind}-{slug}.md` so name-matching consumers (e.g. `/dev-ship (define phase)`) can discover it via Grep. No `project.json` write — the `.md` files are the only source of truth.

Then optionally ask:

```yaml
header: "Concept"
question: "Do you also want to save this as the project concept?"
options:
  - label: "No (Recommended)", description: "Output is saved at the scope location"
  - label: "Yes, also to concept", description: "Also update project-seed.md"
multiSelect: false
```

If "Yes": run the [Seed save procedure](#seed-save-procedure).

## Scope = standalone (from input parsing)

1. Create `.project/thinking/` if needed
2. Write to `.project/thinking/{today}-{kind}-{slug}.md`

```
THINKING OUTPUT SAVED

File: .project/thinking/{today}-{kind}-{slug}.md
Scope: standalone idea
```

No `project.json` write — `.project/thinking/*.md` is the only source of truth (`shared/DASHBOARD-CONTEXT.md § thinking-output`).

## Scope = concept (default) or no scope chosen

**Caller `project-seed`**: skip the modal — the concept was already approved at `ExitPlanMode`. Run the [Seed save procedure](#seed-save-procedure) directly (clipboard is not offered) and show the confirmation block below.

**Other callers** (`project-brainstorm`, `project-critique`): use AskUserQuestion:

```yaml
header: "Output"
question: "What do you want to do with the {refined/expanded} concept?"
options:
  - label: "Save to concept (Recommended)", description: "Update project-seed.md with this version"
  - label: "Copy to clipboard", description: "Copy markdown to clipboard (don't save)"
multiSelect: false
```

**On save** (project-seed direct, or "Save to concept"): run the [Seed save procedure](#seed-save-procedure), then confirm:

```
CONCEPT SAVED

File: .project/project-seed.md
Name: {seed.name}

Next steps:
{next-steps}
```

**Concept-scope output is integrated into `project-seed.md`.** No separate `.project/thinking/*.md` for concept-scope and no `seed.thinking[]` append — the living document is the source. Update `seed.name` and `seed.pitch` in `project.json` if metadata changes.

**If "Copy to clipboard"**: follow [shared/CLIPBOARD.md](CLIPBOARD.md) — wrap output in a `markdown` code block so the user can copy via the UI's code-block copy button, or execute the platform `pbcopy` / `Set-Clipboard` command.

---

## Seed save procedure

1. Create `.project/` folder if it doesn't exist
2. Write the full concept document as plain markdown to `.project/project-seed.md`
3. Update project.json: Read `.project/project.json` (or create with `{}`), set `seed.name` (H1 title), `seed.pitch` (first paragraph, 1-2 sentences), `seed.seedFile = "project-seed.md"`. `project-seed` only: also set `seed.scope` (active scope: `concept` | `implementation` | `feature` | `page` | `standalone`). Remove `seed.content` if it exists (legacy, migrated to .md). Write back.
4. **Drift reconciliation**: if `accumulatedDrift[]` (collected during input parsing) is non-empty, remove those entries from their source arrays — from each `feature.json#seedDrift[]` and from `backlog.json#seedDrift[]`. Log: `Reconciled {N} drift item(s) from {sources}.` Empty or absent → skip silently.
