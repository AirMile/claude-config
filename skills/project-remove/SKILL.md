---
name: project-remove
description: Remove a registered project — optionally delete the folder. Master config blijft intact. Use with /project-remove.
metadata:
  author: mileszeilstra
  version: 1.1.0
  category: project
---

# Project Remove

Verwijdert een project met veilige link removal (target blijft intact).

## Trigger

`/project-remove [naam]` of `/project-remove`

## Process

### FASE 1: Project Selectie

**Als geen naam gegeven:**

1. Scan `{projects_root}` voor projecten met .claude/ links
2. Toon lijst via AskUserQuestion

```yaml
question: "Welk project wil je verwijderen?"
header: "Project"
options:
  - label: "[project-naam-1]"
    description: "{projects_root}/[project-naam-1]"
  - label: "[project-naam-2]"
    description: "{projects_root}/[project-naam-2]"
  # ... dynamisch gegenereerd
multiSelect: false
```

### FASE 2: Validatie

**Check dat project bestaat:**

```bash
test -d "{projects_root}/[naam]"
test -f "{projects_root}/[naam]/.claude/settings.local.json"
```

**Safety checks:**

- NOOIT claude-config zelf verwijderen
- Waarschuw als uncommitted changes

```bash
cd "{projects_root}/[naam]" && git status --porcelain
```

### FASE 3: Bevestiging

```yaml
question: "Weet je zeker dat je [naam] wilt verwijderen?"
header: "Bevestig"
options:
  - label: "Ja, verwijder project"
    description: "Verwijdert project folder. Master config blijft intact."
  - label: "Nee, annuleer"
    description: "Geen wijzigingen"
multiSelect: false
```

### FASE 4: Project Folder Removal

**Vraag:**

```yaml
question: "Wil je de project folder verwijderen?"
header: "Folder"
options:
  - label: "Ja, verwijder alles (Recommended)"
    description: "Verwijdert {projects_root}/[naam] volledig"
  - label: "Nee, behoud folder"
    description: "Alleen links verwijderd, rest blijft"
multiSelect: false
```

**Als ja:**

```bash
rm -rf "{projects_root}/[naam]"
```

### FASE 6: Afronden

**Output:**

```
Project [naam] verwijderd

- Project folder: [verwijderd/behouden]
- Master config: intact
```

## Configuration

| Placeholder       | macOS default    | Windows default | Env var                |
| ----------------- | ---------------- | --------------- | ---------------------- |
| `{projects_root}` | `$HOME/projects` | `C:\Projects`   | `CLAUDE_PROJECTS_ROOT` |

**Resolution order (eerste match wint):**

1. Environment variable
2. `.claude/paths.local.yaml` (lokaal per project, niet in git)
3. `skills/project-add/paths.yaml` (canonical defaults)

## Restrictions

- Kan NOOIT claude-config verwijderen (hard check)
- Verwijdert alleen projecten met link-based setup
- Vraagt altijd bevestiging
- Link removal is altijd veilig (target intact)

## Safety Notes

**WAAROM unlink/rmdir en niet rm -rf op links:**

- `unlink` (macOS) en `rmdir` (Windows) verwijderen alleen de link pointer
- `rm -rf` of `del /s` volgt de link en verwijdert TARGET bestanden
- Dit zou de master config vernietigen!

**Recovery:**

- Als project per ongeluk verwijderd: `git clone` + `/project-add`
- Als links per ongeluk verwijderd: maak opnieuw met `ln -s` (macOS) of `mklink /J` (Windows)
- Als master config beschadigd: restore van backup/git
