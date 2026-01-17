---
description: Sync .claude wijzigingen naar claude-config repo
---

# Config Sync

Detecteert wijzigingen in junction folders en commit ze naar de juiste repo (claude-config).

## Trigger

`/config-sync` of `/config-sync [commit message]`

## Process

### FASE 1: Detecteer Wijzigingen

```bash
# Check claude-config voor uncommitted changes
cd {config_repo}
git status --porcelain
```

**Als geen wijzigingen:**
```
✓ Geen wijzigingen in claude-config
```
→ Stop

**Als wijzigingen:**
→ Toon gewijzigde bestanden en ga naar FASE 2

### FASE 2: Review Wijzigingen

**Toon overzicht:**
```
📝 Wijzigingen in claude-config:

Modified:
  - commands/commit.md
  - agents/plan-synthesizer.md

Added:
  - commands/new-command.md

Deleted:
  - agents/old-agent.md
```

**Vraag bevestiging:**
```yaml
question: "Wil je deze wijzigingen committen naar claude-config?"
header: "Sync"
options:
  - label: "Ja, commit (Recommended)"
    description: "Stage alle wijzigingen en commit"
  - label: "Selectief committen"
    description: "Kies welke bestanden te committen"
  - label: "Bekijk diff"
    description: "Toon gedetailleerde wijzigingen"
  - label: "Annuleer"
    description: "Geen wijzigingen maken"
multiSelect: false
```

### FASE 3: Branch Selectie

```yaml
question: "Naar welke branch committen?"
header: "Branch"
options:
  - label: "main (Recommended)"
    description: "Direct naar main branch pushen"
  - label: "Nieuwe feature branch"
    description: "Maak nieuwe branch voor deze wijzigingen"
  - label: "Bestaande branch"
    description: "Kies uit bestaande remote branches"
multiSelect: false
```

**Als nieuwe feature branch:**
```bash
cd {config_repo}
# Genereer branch naam op basis van wijzigingen
# Commands → feat/update-commands-YYYY-MM-DD
# Agents → feat/update-agents-YYYY-MM-DD
# Mixed → feat/config-update-YYYY-MM-DD
git checkout -b [generated-branch-name]
```

**Als bestaande branch:**
```bash
cd {config_repo}
git fetch origin
git branch -r  # Toon remote branches als opties
git checkout [selected-branch]
git pull origin [selected-branch]
```

### FASE 4: Commit Message

**Als geen message meegegeven:**
```yaml
question: "Wat is de commit message?"
header: "Message"
options:
  - label: "Auto-generate (Recommended)"
    description: "Genereer message op basis van wijzigingen"
  - label: "Typ zelf"
    description: "Voer handmatig een message in"
multiSelect: false
```

**Auto-generate logic:**
- Als alleen commands: `feat(commands): update [command-names]`
- Als alleen agents: `feat(agents): update [agent-names]`
- Als alleen resources: `feat(resources): update [resource-names]`
- Als mixed: `feat: update config ([count] files)`

### FASE 5: Commit & Push

```bash
cd {config_repo}
git add -A
git commit -m "[generated or provided message]"

# Push naar geselecteerde branch
git push origin [branch-name]

# Bij nieuwe branch, set upstream
git push -u origin [branch-name]
```

### FASE 6: Bevestiging

**Output:**
```
✅ claude-config gesynchroniseerd

Commit: abc1234
Branch: [branch-name]
Pushed: ✓

Wijzigingen zijn nu beschikbaar in alle projecten met junctions.
```

**Bij feature branch, toon ook:**
```
💡 Tip: Maak een PR aan via: gh pr create --base main
```

**Return naar originele directory:**
```bash
cd [original-project-path]
```

## Voorbeeld Gebruik

**Scenario:** Je werkt in school-website en past een command aan

```
school-website> code .claude/commands/commit.md
# ... maak wijzigingen ...

school-website> /config-sync
# Detecteert wijziging in commit.md
# Commit naar claude-config
# Push naar GitHub

school-website> # Klaar! Wijziging is nu in claude-config repo
```

**Met custom message:**
```
school-website> /config-sync fix typo in commit command
# Skip message prompt, gebruikt gegeven message
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
- Commit ALLE uncommitted changes in claude-config (niet selectief per default)

## Gerelateerde Commands

- `/project-new` - Nieuw project met junctions
- `/project-list` - Overzicht van projecten
- `/commit` - Commit in huidige project (niet claude-config)
