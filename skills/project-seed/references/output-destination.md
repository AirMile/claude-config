# Step 5: Output Destination

After generating the markdown content, determine output destination based on scope.

**If scope = feature or page (from Step 1a):**

Save automatically to the scope location:

- Scope = feature → write to `.project/features/{name}/thinking.md`
- Scope = page/UX → create `.project/thinking/` if needed, write to `.project/thinking/{topic}.md`

```
THINKING OUTPUT SAVED

File: {output-path}
Scope: {feature:{name} | page:{topic}}
```

**Dashboard sync — thinking log** (see `shared/DASHBOARD.md`):

1. Read `.project/project.json` (skip if not present)
2. Write full markdown to `.project/thinking/{today}-idea-{slug}.md`
3. Push to `thinking` array:
   ```json
   {
     "type": "idea",
     "date": "{today}",
     "title": "{concept title}",
     "summary": "{key insight, max 200 chars}",
     "file": ".project/thinking/{today}-idea-{slug}.md",
     "source": "/project-seed"
   }
   ```
4. Write `.project/project.json`

Then optionally ask:

```yaml
header: "Concept"
question: "Do you also want to save this as the project concept?"
options:
  - label: "No (Recommended)", description: "Output is saved at the scope location"
  - label: "Yes, also to concept", description: "Also update project-seed.md"
multiSelect: false
```

If "Yes": Write the full concept document as plain markdown to `.project/project-seed.md`. Also update project.json: Read `.project/project.json` (or create with `{}`), set `concept.name` (H1 title), `concept.pitch` (first paragraph, 1-2 sentences), `seed.seedFile = "project-seed.md"`. Remove `concept.content` if it exists (migrated to .md). Write back.

**If scope = standalone idea (from Step 1a):**

Save to `.project/thinking/{today}-idea-{slug}.md`:

1. Create `.project/thinking/` if needed
2. Write to `.project/thinking/{today}-idea-{slug}.md`

```
THINKING OUTPUT SAVED

File: .project/thinking/{today}-idea-{slug}.md
Scope: standalone idea
```

**Dashboard sync — thinking log** (see `shared/DASHBOARD.md`):

1. Read `.project/project.json` (skip if not present)
2. Push to `thinking` array (file already written above):
   ```json
   {
     "type": "idea",
     "date": "{today}",
     "title": "{concept title}",
     "summary": "{key insight, max 200 chars}",
     "file": ".project/thinking/{today}-idea-{slug}.md",
     "source": "/project-seed"
   }
   ```
3. Write `.project/project.json`

**If scope = concept (default) or no scope chosen:**

Use AskUserQuestion:

```yaml
header: "Output"
question: "What do you want to do with the concept?"
options:
  - label: "Save to concept (Recommended)", description: "Save to project-seed.md for further use"
  - label: "Copy to clipboard", description: "Copy markdown to clipboard (don't save)"
multiSelect: false
```

**If "Save to concept":**

1. Create `.project/` folder if it doesn't exist
2. Write the full concept document as plain markdown to `.project/project-seed.md`
3. Also update project.json: Read `.project/project.json` (or create with `{}`), set `concept.name` (H1 title), `concept.pitch` (first paragraph, 1-2 sentences), `seed.seedFile = "project-seed.md"`. Remove `concept.content` if it exists (migrated to .md). Write back.
4. Confirm:

   ```
   SEED SAVED

   File: .project/project-seed.md
   Name: {concept.name}

   Next steps:
   - /project-critique - Critically analyze and strengthen
   - /project-brainstorm - Creatively expand and create variations
   - /project-backlog - Convert to feature backlog
   ```

**Seed-scope output is integrated into `project-seed.md`.** No separate `.project/thinking/*.md` for concept-scope and no `concept.thinking[]` append — the living document is the source. Update `concept.name` and `concept.pitch` in `project.json` if metadata changes.

**If "Copy to clipboard":**

Follow [`shared/CLIPBOARD.md`](../shared/CLIPBOARD.md) — wrap output in a `markdown` code block so the user can copy via the UI's code-block copy button, or execute the platform `pbcopy` / `Set-Clipboard` command to send it directly to the system clipboard.
