---
description: Toon alle projecten met junction-based .claude/ config
---

# Project List

Toont overzicht van alle projecten die junction-based .claude/ config gebruiken.

## Trigger

`/project-list`

## Process

### FASE 1: Scan Projects

**Scan C:\Projects\ voor projecten:**
```bash
# Vind alle folders met .claude\agents junction
for dir in /c/Projects/*/; do
  if [ -L "$dir.claude/agents" ]; then
    echo "$dir"
  fi
done
```

### FASE 2: Verzamel Info

**Per gevonden project:**
1. Project naam (folder naam)
2. Project type (uit CLAUDE.md indien aanwezig)
3. Junction status (intact/broken)
4. Git status (clean/dirty)

**Junction status check:**
```bash
# Check of junction target bereikbaar is
test -d "C:\Projects\[naam]\.claude\agents\."
```

### FASE 3: Output

**Format:**
```
┌─────────────────────────────────────────────────────────────┐
│ 📁 PROJECTS MET JUNCTION-BASED CONFIG                       │
├─────────────────────────────────────────────────────────────┤
│ NAME              │ TYPE         │ JUNCTIONS │ GIT          │
│ ─────────────────────────────────────────────────────────── │
│ school-website    │ Web Frontend │ ✓ OK      │ clean        │
│ api-backend       │ REST API     │ ✓ OK      │ 3 changes    │
│ mobile-app        │ React Native │ ⚠ broken  │ clean        │
├─────────────────────────────────────────────────────────────┤
│ MASTER CONFIG: C:\Projects\claude-config\                   │
│ Status: ✓ Intact                                            │
│ Agents: 67 │ Commands: 24 │ Resources: 11 dirs              │
└─────────────────────────────────────────────────────────────┘
```

**Broken junction handling:**
```
⚠️ Project 'mobile-app' heeft broken junctions.
   Herstel met: cmd /c "mklink /J .claude\agents C:\Projects\claude-config\agents"
```

### FASE 4: Quick Actions

**Na output, bied opties:**
```yaml
question: "Wat wil je doen?"
header: "Actie"
options:
  - label: "Nieuw project maken"
    description: "Start /project-new"
  - label: "Project verwijderen"
    description: "Start /project-remove"
  - label: "Herstel broken junctions"
    description: "Fix broken junctions voor [project-naam]"
  - label: "Klaar"
    description: "Geen verdere actie"
multiSelect: false
```

## Output Details

**Junction status indicators:**
- `✓ OK` - Alle 4 junctions intact en bereikbaar
- `⚠ broken` - Een of meer junctions wijzen naar non-existent target
- `✗ missing` - .claude folder bestaat maar geen junctions

**Git status indicators:**
- `clean` - Geen uncommitted changes
- `N changes` - Aantal uncommitted changes
- `not a repo` - Geen git repository

## Restrictions

- Toont alleen projecten in C:\Projects\
- Negeert claude-config zelf (dat is de master, geen project)
- Negeert folders zonder .claude\ subfolder
