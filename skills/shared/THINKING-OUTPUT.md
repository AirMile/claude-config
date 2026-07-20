# Thinking Output Destination

Shared output-destination protocol for the /project-seed modes (seed, brainstorm, critique). Load at the start of the final output phase — after `ExitPlanMode`, when the refined document is approved and `.project/` writes are allowed again.

**Mode parameters:**

| Mode         | `{kind}`     | Extras                                                   |
| ------------ | ------------ | -------------------------------------------------------- |
| `seed`       | `idea`       | Seed save procedure also writes `seed.scope`             |
| `brainstorm` | `brainstorm` | Confirmation blocks include `Applied techniques: {list}` |
| `critique`   | `critique`   | Confirmation blocks include `Applied techniques: {list}` |

Concept-scope saves end with the [§ Continue](#continue) step below.

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

**Mode `seed`**: skip the modal — the concept was already approved at `ExitPlanMode`. Run the [Seed save procedure](#seed-save-procedure) directly (clipboard is not offered) and show the confirmation block below.

**Other modes** (`brainstorm`, `critique`): use AskUserQuestion:

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
```

Then run [§ Continue](#continue).

**Concept-scope output is integrated into `project-seed.md`.** No separate `.project/thinking/*.md` for concept-scope and no `seed.thinking[]` append — the living document is the source. Update `seed.name` and `seed.pitch` in `project.json` if metadata changes.

**If "Copy to clipboard"**: follow [shared/CLIPBOARD.md](CLIPBOARD.md) — wrap output in a `markdown` code block so the user can copy via the UI's code-block copy button, or execute the platform `pbcopy` / `Set-Clipboard` command.

---

## Seed save procedure

1. Create `.project/` folder if it doesn't exist
2. Write the full concept document as plain markdown to `.project/project-seed.md`
3. Update project.json: Read `.project/project.json` (or create with `{}`), set `seed.name` (H1 title), `seed.pitch` (first paragraph, 1-2 sentences), `seed.seedFile = "project-seed.md"`. Mode `seed` only: also set `seed.scope` (active scope: `concept` | `implementation` | `feature` | `page` | `standalone`). Remove `seed.content` if it exists (legacy, migrated to .md). Write back.
4. **Drift reconciliation**: if `accumulatedDrift[]` (collected during input parsing) is non-empty, remove those entries from their source arrays — from each `feature.json#seedDrift[]` and from `backlog.json#seedDrift[]`. Log: `Reconciled {N} drift item(s) from {sources}.` Empty or absent → skip silently.

---

## Continue

Run after the CONCEPT SAVED confirmation (concept scope). Other scopes (feature/page/standalone) end as before. AskUserQuestion:

```yaml
header: "Continue"
question: "The {kind} is saved. What next?"
options:
  - label: "Plan it → /project-plan (Recommended)", description: "Turn the seed into a prioritized backlog"
  - label: "Brainstorm it in this session", description: "Chain the brainstorm mode on this result"
  - label: "Critique it in this session", description: "Chain the critique mode on this result"
  - label: "Done", description: "Stop here — the saved document is the checkpoint"
multiSelect: false
```

- Omit chain options for modes already run this session. Recommend "Plan it" when the document is decision-ready; otherwise move the most valuable unapplied mode first with "(Recommended)".
- **Chain a mode** → Read `.claude/skills/project-seed/references/mode-{brainstorm|critique}.md` directly (its chained-entry note applies: skip PHASE 1, carry over scope and applied techniques). Do not re-invoke the Skill tool — that reloads the dispatcher and redoes intake; Skill re-entry is only for a new topic.
- **Plan it** → context-weight fork (mirrors dev-ship's park pattern): light session (single mode, short dialogue) → invoke `project-plan` in-session via the Skill tool — its input detection finds `.project/project-seed.md` automatically. Heavy session (2+ modes chained, or long technique dialogues / compaction risk) → park: suggest `/project-plan` in a fresh session — the saved seed document is the durable checkpoint.
- **Done** → end.
