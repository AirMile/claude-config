---
description: Draai uncommitted wijzigingen terug in claude-config
---

# Config Revert

Draai uncommitted wijzigingen in claude-config terug naar de laatste commit.

## Trigger

`/config-revert` of `/config-revert [file]`

## Process

### FASE 1: Detecteer Wijzigingen

```bash
cd {config_repo}
git status --porcelain
```

**Als geen wijzigingen:**
```
✓ Geen uncommitted wijzigingen in claude-config
```
→ Stop

**Als wijzigingen:**
→ Toon gewijzigde bestanden en ga naar FASE 2

### FASE 2: Review Wijzigingen

**Toon overzicht:**
```
⚠️ Uncommitted wijzigingen in claude-config:

Modified:
  - commands/commit.md
  - agents/plan-synthesizer.md

Added (untracked):
  - commands/new-command.md

Deleted:
  - agents/old-agent.md
```

**Vraag bevestiging:**
```yaml
question: "Welke wijzigingen wil je terugdraaien?"
header: "Revert"
options:
  - label: "Alles terugdraaien (Recommended)"
    description: "Reset alle wijzigingen naar laatste commit"
  - label: "Dry-run eerst"
    description: "Simuleer wat er gebeurt zonder wijzigingen te maken"
  - label: "Selectief terugdraaien"
    description: "Kies welke bestanden te reverten"
  - label: "Bekijk diff eerst"
    description: "Toon gedetailleerde wijzigingen voor beslissing"
  - label: "Annuleer"
    description: "Geen wijzigingen maken"
multiSelect: false
```

### FASE 2B: Dry-run (indien gekozen)

**Simuleer zonder wijzigingen:**
```bash
cd {config_repo}
# Toon wat git checkout zou doen
git diff --name-only
# Toon wat git clean zou verwijderen
git clean -n -fd
```

**Output format:**
```
🔍 Dry-run: dit zou gebeuren

Tracked files (worden gereset naar laatste commit):
  ✗ commands/commit.md
  ✗ agents/plan-synthesizer.md

Untracked files (worden VERWIJDERD):
  ✗ commands/new-command.md

Totaal: [X] bestanden worden gereset/verwijderd
```

**Na dry-run, vraag:**
```yaml
question: "Doorgaan met revert?"
header: "Bevestig"
options:
  - label: "Ja, voer revert uit"
    description: "Draai de wijzigingen daadwerkelijk terug"
  - label: "Nee, annuleer"
    description: "Geen wijzigingen maken"
multiSelect: false
```

### FASE 3A: Alles Terugdraaien

```bash
cd {config_repo}
# Reset tracked files
git checkout -- .
# Remove untracked files
git clean -fd
```

### FASE 3B: Selectief Terugdraaien

**Toon bestanden als opties:**
```yaml
question: "Welke bestanden terugdraaien?"
header: "Files"
options:
  # Dynamisch gegenereerd op basis van git status
  - label: "commands/commit.md"
    description: "Modified"
  - label: "agents/plan-synthesizer.md"
    description: "Modified"
  - label: "commands/new-command.md"
    description: "Untracked (wordt verwijderd)"
multiSelect: true
```

**Voor geselecteerde bestanden:**
```bash
# Voor modified files:
git checkout -- [file]

# Voor untracked files:
rm [file]
```

### FASE 4: Bevestiging

**Output:**
```
✅ Wijzigingen teruggedraaid in claude-config

Reverted:
  - commands/commit.md
  - agents/plan-synthesizer.md

Removed:
  - commands/new-command.md

Status: clean (geen uncommitted wijzigingen)
```

**Return naar originele directory:**
```bash
cd [original-project-path]
```

## Voorbeeld Gebruik

**Scenario:** Je hebt een command aangepast maar wilt terug

```
school-website> code .claude/commands/commit.md
# ... maakte per ongeluk iets kapot ...

school-website> /config-revert
# Toont wijzigingen
# Vraagt bevestiging
# Reset naar laatste commit

school-website> # Klaar! commit.md is weer zoals het was
```

**Specifiek bestand:**
```
school-website> /config-revert commands/commit.md
# Revert alleen dit bestand, skip selectie
```

## Configuration

Paths zijn configureerbaar per apparaat:

| Placeholder | Default | Environment Variable |
|-------------|---------|---------------------|
| `{config_repo}` | `C:\Projects\claude-config` | `CLAUDE_CONFIG_REPO` |

**Resolution order (eerste match wint):**
1. Environment variable
2. `.claude/paths.local.yaml` (lokaal per project, niet in git)
3. `resources/paths.yaml` (gedeelde defaults)

## Restrictions

- Werkt alleen als `{config_repo}` bestaat
- **WAARSCHUWING:** Dit verwijdert wijzigingen permanent!
- Untracked files worden verwijderd met `git clean`
- Kan niet terugdraaien na commit (gebruik dan `git revert`)

## Gerelateerde Commands

- `/config-sync` - Commit en push wijzigingen
- `/commit` - Commit in huidige project
