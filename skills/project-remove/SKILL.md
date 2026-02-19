---
name: project-remove
description: Remove project with safe symlink/junction cleanup. Use with /project-remove to unregister a project and clean up links.
disable-model-invocation: true
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
# Verifieer pad
test -d "{projects_root}/[naam]"

# Check voor links
test -L "{projects_root}/[naam]/.claude/agents"
```

**Safety checks:**

- NOOIT claude-config zelf verwijderen
- NOOIT projecten zonder links (andere workflow)
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
    description: "Verwijdert links en project folder. Master config blijft intact."
  - label: "Nee, annuleer"
    description: "Geen wijzigingen"
multiSelect: false
```

### FASE 4: Link Removal

**KRITIEK: Verwijder links veilig — target moet intact blijven!**

**Linux (symlinks):**

```bash
unlink "{projects_root}/[naam]/.claude/agents"
unlink "{projects_root}/[naam]/.claude/commands"
unlink "{projects_root}/[naam]/.claude/resources"
unlink "{projects_root}/[naam]/.claude/scripts"
```

**Windows (junctions):**

```bash
cmd //c "rmdir {projects_root}\[naam]\.claude\agents"
cmd //c "rmdir {projects_root}\[naam]\.claude\commands"
cmd //c "rmdir {projects_root}\[naam]\.claude\resources"
cmd //c "rmdir {projects_root}\[naam]\.claude\scripts"
```

**Verificatie:**

```bash
# Check dat links weg zijn
test ! -L "{projects_root}/[naam]/.claude/agents"
```

### FASE 5: Project Folder Removal

**Vraag:**

```yaml
question: "Links verwijderd. Wil je ook de project folder verwijderen?"
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

- Links: verwijderd (4x)
- Project folder: [verwijderd/behouden]
- Master config: intact
```

## Configuration

| Placeholder       | Linux default    | Windows default | Env var                |
| ----------------- | ---------------- | --------------- | ---------------------- |
| `{projects_root}` | `$HOME/projects` | `C:\Projects`   | `CLAUDE_PROJECTS_ROOT` |

**Resolution order (eerste match wint):**

1. Environment variable
2. `.claude/paths.local.yaml` (lokaal per project, niet in git)
3. `resources/paths.yaml` (gedeelde defaults)

## Restrictions

- Kan NOOIT claude-config verwijderen (hard check)
- Verwijdert alleen projecten met link-based setup
- Vraagt altijd bevestiging
- Link removal is altijd veilig (target intact)

## Safety Notes

**WAAROM unlink/rmdir en niet rm -rf op links:**

- `unlink` (Linux) en `rmdir` (Windows) verwijderen alleen de link pointer
- `rm -rf` of `del /s` volgt de link en verwijdert TARGET bestanden
- Dit zou de master config vernietigen!

**Recovery:**

- Als project per ongeluk verwijderd: `git clone` + `/project-add`
- Als links per ongeluk verwijderd: maak opnieuw met `ln -s` (Linux) of `mklink /J` (Windows)
- Als master config beschadigd: restore van backup/git
