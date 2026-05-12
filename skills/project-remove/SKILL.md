---
name: project-remove
description: Remove a registered project — optionally delete the folder. Master config stays intact. Use with /project-remove.
metadata:
  author: mileszeilstra
  version: 1.1.0
  category: project
---

# Project Remove

Removes a project with safe link removal (target stays intact).

## Trigger

`/project-remove [name]` or `/project-remove`

## Process

### PHASE 1: Project Selection

**If no name given:**

1. Scan `{projects_root}` for projects with .claude/ links
2. Show list via AskUserQuestion

```yaml
question: "Which project do you want to remove?"
header: "Project"
options:
  - label: "[project-name-1]"
    description: "{projects_root}/[project-name-1]"
  - label: "[project-name-2]"
    description: "{projects_root}/[project-name-2]"
  # ... dynamically generated
multiSelect: false
```

### PHASE 2: Validation

**Check that project exists:**

```bash
test -d "{projects_root}/[name]"
test -f "{projects_root}/[name]/.claude/settings.local.json"
```

**Safety checks:**

- NEVER remove claude-config itself
- Warn if uncommitted changes

```bash
cd "{projects_root}/[name]" && git status --porcelain
```

### PHASE 3: Confirmation

```yaml
question: "Are you sure you want to remove [name]?"
header: "Confirm"
options:
  - label: "Yes, remove project"
    description: "Removes project folder. Master config stays intact."
  - label: "No, cancel"
    description: "No changes"
multiSelect: false
```

### PHASE 4: Project Folder Removal

**Question:**

```yaml
question: "Do you want to remove the project folder?"
header: "Folder"
options:
  - label: "Yes, remove everything (Recommended)"
    description: "Removes {projects_root}/[name] completely"
  - label: "No, keep folder"
    description: "Only links removed, rest stays intact"
multiSelect: false
```

**If yes:**

```bash
rm -rf "{projects_root}/[name]"
```

### PHASE 6: Wrap Up

**Output:**

```
Project [name] removed

- Project folder: [removed/kept]
- Master config: intact
```

## Configuration

| Placeholder       | macOS default    | Windows default | Env var                |
| ----------------- | ---------------- | --------------- | ---------------------- |
| `{projects_root}` | `$HOME/projects` | `C:\Projects`   | `CLAUDE_PROJECTS_ROOT` |

**Resolution order (first match wins):**

1. Environment variable
2. `.claude/paths.local.yaml` (local per project, not in git)
3. `skills/project-add/paths.yaml` (canonical defaults)

## Restrictions

- Can NEVER remove claude-config (hard check)
- Only removes projects with link-based setup
- Always asks for confirmation
- Link removal is always safe (target intact)

## Safety Notes

**WHY unlink/rmdir and not rm -rf on links:**

- `unlink` (macOS) and `rmdir` (Windows) remove only the link pointer
- `rm -rf` or `del /s` follows the link and removes TARGET files
- This would destroy the master config!

**Recovery:**

- If project accidentally removed: `git clone` + `/project-add`
- If links accidentally removed: recreate with `ln -s` (macOS) or `mklink /J` (Windows)
- If master config corrupted: restore from backup/git
