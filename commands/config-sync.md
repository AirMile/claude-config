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
cd C:\Projects\claude-config
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

### FASE 3: Commit Message

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

### FASE 4: Commit & Push

```bash
cd C:\Projects\claude-config
git add -A
git commit -m "[generated or provided message]

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
git push origin main
```

### FASE 5: Bevestiging

**Output:**
```
✅ claude-config gesynchroniseerd

Commit: abc1234
Branch: main
Pushed: ✓

Wijzigingen zijn nu beschikbaar in alle projecten met junctions.
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

## Restrictions

- Werkt alleen als `C:\Projects\claude-config` bestaat
- Pusht altijd naar `origin main`
- Commit ALLE uncommitted changes in claude-config (niet selectief per default)

## Gerelateerde Commands

- `/project-new` - Nieuw project met junctions
- `/project-list` - Overzicht van projecten
- `/commit` - Commit in huidige project (niet claude-config)
