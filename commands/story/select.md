---
description: Select a story to work on and view its summary
---

# Story Select

Select which story to work on. Shows all stories with their status and activates the chosen one for other story commands.

## Process

### Step 1: Scan Stories

Scan the `stories/` folder for story directories:

```bash
Get-ChildItem -Path "stories" -Directory | Select-Object -ExpandProperty Name
```

For each story folder, read `stories/{name}/_meta.md` to extract:
- Title
- Status (concept/writing/editing/complete)
- Genre
- Logline

### Step 2: Present Selection

Show stories with status indicators:

| Status | Indicator |
|--------|-----------|
| concept | 💭 |
| writing | ✍️ |
| editing | 📝 |
| complete | ✅ |

Use **AskUserQuestion**:
- header: "Story"
- question: "Welk verhaal wil je bewerken?"
- options: [list of stories with status indicator and genre]
- multiSelect: false

### Step 3: Show Summary

After selection, read and display:

1. **From `_meta.md`**: Title, genre, logline
2. **From `scenes/_outline.md`**: Current progress, last completed scene
3. **From `characters/`**: Main character count
4. **Open questions**: Any `<!-- TODO: -->` or `<!-- QUESTION: -->` comments found

Format:
```
📖 {TITLE}

Genre: {genre}
Status: {status}
Logline: {logline}

📊 Progress:
- Scenes: {completed}/{total}
- Last: {last scene name}
- Characters: {count}

❓ Open Questions:
- {question 1}
- {question 2}
```

### Step 4: Activate Story

Write active story to `.workspace/active-story.json`:

```json
{
  "name": "{folder-name}",
  "title": "{title}",
  "path": "stories/{folder-name}",
  "activatedAt": "{timestamp}"
}
```

Confirm:
```
✅ "{title}" is nu actief. Andere story commands gebruiken dit verhaal.
```

## Output

- Displays story summary
- Creates/updates `.workspace/active-story.json`
- Other story commands read this file to know which story is active
