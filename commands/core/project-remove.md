---
description: Verwijder project met veilige junction cleanup
---

# Project Remove

Verwijdert een project met veilige junction removal (target blijft intact).

## Trigger

`/project-remove [naam]` of `/project-remove`

## Process

### FASE 1: Project Selectie

**Als geen naam gegeven:**
1. Scan `{projects_root}` voor projecten met .claude\ junctions
2. Toon lijst via AskUserQuestion

```yaml
question: "Welk project wil je verwijderen?"
header: "Project"
options:
  - label: "[project-naam-1]"
    description: "{projects_root}\[project-naam-1]"
  - label: "[project-naam-2]"
    description: "{projects_root}\[project-naam-2]"
  # ... dynamisch gegenereerd
multiSelect: false
```

### FASE 2: Validatie

**Check dat project bestaat:**
```bash
# Verifieer pad
test -d "{projects_root}\[naam]"

# Check voor junctions
test -L "{projects_root}\[naam]\.claude\agents"
```

**Safety checks:**
- NOOIT claude-config zelf verwijderen
- NOOIT projecten zonder junctions (andere workflow)
- Waarschuw als uncommitted changes

```bash
cd {projects_root}\[naam]
git status --porcelain
```

### FASE 3: Bevestiging

```yaml
question: "⚠️ Weet je zeker dat je [naam] wilt verwijderen?"
header: "Bevestig"
options:
  - label: "Ja, verwijder project"
    description: "Verwijdert junctions en project folder. Master config blijft intact."
  - label: "Nee, annuleer"
    description: "Geen wijzigingen"
multiSelect: false
```

### FASE 4: Junction Removal

**KRITIEK: Gebruik rmdir, NOOIT del /s of rm -rf!**

```bash
# Verwijder junctions EERST (veilig - target blijft intact)
cmd /c "rmdir {projects_root}\[naam]\.claude\agents"
cmd /c "rmdir {projects_root}\[naam]\.claude\commands"
cmd /c "rmdir {projects_root}\[naam]\.claude\resources"
cmd /c "rmdir {projects_root}\[naam]\.claude\scripts"
```

**Verificatie:**
```bash
# Check dat junctions weg zijn
test ! -L "{projects_root}\[naam]\.claude\agents"
```

### FASE 5: Project Folder Removal

**Vraag:**
```yaml
question: "Junctions verwijderd. Wil je ook de project folder verwijderen?"
header: "Folder"
options:
  - label: "Ja, verwijder alles (Recommended)"
    description: "Verwijdert {projects_root}\[naam] volledig"
  - label: "Nee, behoud folder"
    description: "Alleen junctions verwijderd, rest blijft"
multiSelect: false
```

**Als ja:**
```bash
rm -rf "{projects_root}\[naam]"
```

### FASE 6: Afronden

**Output:**
```
✅ Project [naam] verwijderd

- Junctions: verwijderd (4x)
- Project folder: [verwijderd/behouden]
- Master config: intact ✓
```

## Configuration

Paths zijn configureerbaar per apparaat:

| Placeholder | Default | Environment Variable |
|-------------|---------|---------------------|
| `{projects_root}` | `C:\Projects` | `CLAUDE_PROJECTS_ROOT` |

**Resolution order (eerste match wint):**
1. Environment variable
2. `.claude/paths.local.yaml` (lokaal per project, niet in git)
3. `resources/paths.yaml` (gedeelde defaults)

## Restrictions

- Kan NOOIT claude-config verwijderen (hard check)
- Verwijdert alleen projecten met junction-based setup
- Vraagt altijd bevestiging
- Junction removal is altijd veilig (target intact)

## Safety Notes

**WAAROM rmdir en niet rm -rf:**
- `rmdir` verwijdert alleen de junction pointer
- `rm -rf` of `del /s` volgt de junction en verwijdert TARGET bestanden
- Dit zou de master config vernietigen!

**Recovery:**
- Als project per ongeluk verwijderd: `git clone` + `/project-new`
- Als junctions per ongeluk verwijderd: maak opnieuw met `mklink /J`
- Als master config beschadigd: restore van backup/git
