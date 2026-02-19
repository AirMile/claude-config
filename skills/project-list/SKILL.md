---
name: project-list
description: List all projects with symlink/junction-based .claude/ config and their status. Use with /project-list to see registered projects.
disable-model-invocation: true
metadata:
  author: mileszeilstra
  version: 1.1.0
  category: project
---

# Project List

Toont overzicht van alle projecten die symlink/junction-based .claude/ config gebruiken.

## Trigger

`/project-list`

## Process

### FASE 1: Scan Projects

**Scan `{projects_root}` voor projecten:**

```bash
for dir in "{projects_root}/"*/; do
  if [ -L "$dir.claude/agents" ] || [ -d "$dir.claude/agents" ]; then
    echo "$dir"
  fi
done
```

### FASE 2: Verzamel Info

**Per gevonden project:**

1. Project naam (folder naam)
2. Project type (uit CLAUDE.md indien aanwezig)
3. Link status (intact/broken)
4. Git status (clean/dirty)

**Link status check:**

```bash
# Check of link target bereikbaar is
test -d "{projects_root}/[naam]/.claude/agents/."
```

### FASE 3: Output

**Format:**

```
┌─────────────────────────────────────────────────────────────┐
│ PROJECTS MET LINKED CONFIG                                    │
├─────────────────────────────────────────────────────────────┤
│ NAME              │ TYPE         │ LINKS     │ GIT          │
│ ─────────────────────────────────────────────────────────── │
│ school-website    │ Web Frontend │ OK        │ clean        │
│ api-backend       │ REST API     │ OK        │ 3 changes    │
│ mobile-app        │ React Native │ broken    │ clean        │
├─────────────────────────────────────────────────────────────┤
│ MASTER CONFIG: {projects_root}/claude-config/                 │
│ Status: Intact                                                │
└─────────────────────────────────────────────────────────────┘
```

**Broken link handling:**

```
Project 'mobile-app' heeft broken links.
Herstel met:
  Linux:   ln -s {projects_root}/claude-config/skills .claude/agents
  Windows: cmd /c "mklink /J .claude\agents {projects_root}\claude-config\agents"
```

### FASE 4: Quick Actions

**Na output, bied opties:**

```yaml
question: "Wat wil je doen?"
header: "Actie"
options:
  - label: "Nieuw project maken"
    description: "Start /project-add"
  - label: "Project verwijderen"
    description: "Start /project-remove"
  - label: "Herstel broken links"
    description: "Fix broken links voor [project-naam]"
  - label: "Klaar"
    description: "Geen verdere actie"
multiSelect: false
```

## Output Details

**Link status indicators:**

- `OK` - Alle links intact en bereikbaar
- `broken` - Een of meer links wijzen naar non-existent target
- `missing` - .claude folder bestaat maar geen links

**Git status indicators:**

- `clean` - Geen uncommitted changes
- `N changes` - Aantal uncommitted changes
- `not a repo` - Geen git repository

## Configuration

| Placeholder       | Linux default    | Windows default | Env var                |
| ----------------- | ---------------- | --------------- | ---------------------- |
| `{projects_root}` | `$HOME/projects` | `C:\Projects`   | `CLAUDE_PROJECTS_ROOT` |

**Resolution order (eerste match wint):**

1. Environment variable `CLAUDE_PROJECTS_ROOT`
2. `.claude/paths.local.yaml` (lokaal per project, niet in git)
3. `resources/paths.yaml` (gedeelde defaults)

## Restrictions

- Toont alleen projecten in `{projects_root}`
- Negeert claude-config zelf (dat is de master, geen project)
- Negeert folders zonder .claude/ subfolder
