---
description: Maak nieuw project met junction-based .claude/ config en optionele GitHub publish
---

# Project New

Creëert een nieuw project met junctions naar de gedeelde claude-config.

## Trigger

`/project-new [naam]` of `/project-new`

## Process

### FASE 1: Project Naam

**Als geen naam gegeven:**
```yaml
question: "Wat is de naam van het nieuwe project?"
header: "Project"
options:
  - label: "Typ een naam"
    description: "Korte, lowercase naam zonder spaties (bijv: my-app)"
multiSelect: false
```

**Validatie:**
- Lowercase letters, cijfers, hyphens
- Geen spaties of speciale tekens
- Niet bestaand in C:\Projects\

### FASE 2: Project Aanmaken

```bash
# Maak project folder
mkdir C:\Projects\[naam]

# Maak .claude subfolder
mkdir C:\Projects\[naam]\.claude

# Maak project-specifieke folders
mkdir C:\Projects\[naam]\.claude\docs
mkdir C:\Projects\[naam]\.claude\research
mkdir C:\Projects\[naam]\.workspace
mkdir C:\Projects\[naam]\.workspace\sessions\chats
mkdir C:\Projects\[naam]\.workspace\sessions\commands
mkdir C:\Projects\[naam]\.workspace\plans
mkdir C:\Projects\[naam]\.workspace\features
```

### FASE 3: Junctions Maken

```bash
# Maak junctions naar master config (absolute paths!)
cmd /c "mklink /J C:\Projects\[naam]\.claude\agents C:\Projects\claude-config\agents"
cmd /c "mklink /J C:\Projects\[naam]\.claude\commands C:\Projects\claude-config\commands"
cmd /c "mklink /J C:\Projects\[naam]\.claude\resources C:\Projects\claude-config\resources"
cmd /c "mklink /J C:\Projects\[naam]\.claude\scripts C:\Projects\claude-config\scripts"
```

### FASE 4: Basis Bestanden

**Kopieer templates:**
```bash
# settings.local.json met default permissions
echo '{"permissions": {"allow": []}}' > C:\Projects\[naam]\.claude\settings.local.json

# .gitignore met standaard excludes
```

**.gitignore inhoud:**
```
# Dependencies
node_modules/

# Build output
dist/
build/

# Environment
.env
.env.local
.env.*.local

# IDE
.idea/
.vscode/
*.swp

# OS
.DS_Store
Thumbs.db

# Claude workspace (runtime data)
.workspace/sessions/
.workspace/features/

# Junctions (tracked via master repo, not this one)
.claude/agents/
.claude/commands/
.claude/resources/
.claude/scripts/
```

### FASE 5: Git Initialisatie

```bash
cd C:\Projects\[naam]
git init
git add .gitignore
```

### FASE 6: Project Configuratie

**Roep /setup aan:**
```
Vraag gebruiker: "Wil je nu /setup uitvoeren om CLAUDE.md te configureren?"

Options:
- "Ja, configureer nu (Recommended)" → roep /setup aan
- "Nee, later" → toon instructies voor handmatige setup
```

**Als /setup wordt uitgevoerd:**
- Lees CLAUDE.base.md van C:\Projects\claude-config\
- Volg normale /setup flow
- Schrijf naar C:\Projects\[naam]\.claude\CLAUDE.md

### FASE 7: GitHub Publish (Optioneel)

**Vraag:**
```yaml
question: "Wil je de repo publiceren naar GitHub?"
header: "Publish"
options:
  - label: "Ja, maak private repo (Recommended)"
    description: "Publiceer als private GitHub repository"
  - label: "Ja, maak public repo"
    description: "Publiceer als public GitHub repository"
  - label: "Nee, later"
    description: "Sla over, handmatig publiceren later"
multiSelect: false
```

**Als publish gewenst:**
1. Stage alle bestanden en maak initial commit:
```bash
cd C:\Projects\[naam]
git add -A
git commit -m "feat: initial commit - [naam]

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

2. Maak GitHub repo en push:
```bash
# Private repo
gh repo create [naam] --private --source=. --push --description "[project description]"

# OF public repo
gh repo create [naam] --public --source=. --push --description "[project description]"
```

3. Toon repo URL na succesvolle publish

**Vereisten voor publish:**
- `gh` CLI geïnstalleerd en authenticated
- Check met `gh auth status` voordat je begint

### FASE 8: Afronden

**Vraag:**
```yaml
question: "Project aangemaakt. Wat wil je doen?"
header: "Open"
options:
  - label: "Open in VS Code (Recommended)"
    description: "Open nieuw project in VS Code window"
  - label: "Blijf hier"
    description: "Blijf in huidige project werken"
multiSelect: false
```

**Als VS Code:**
```bash
code C:\Projects\[naam]
```

**Output:**
```
✅ Project [naam] aangemaakt

Structuur:
C:\Projects\[naam]\
├── .claude\
│   ├── agents\     → junction
│   ├── commands\   → junction
│   ├── resources\  → junction
│   ├── scripts\    → junction
│   ├── docs\
│   ├── research\
│   └── CLAUDE.md (of nog te configureren)
├── .workspace\
└── .gitignore

GitHub: https://github.com/[user]/[naam] (indien gepubliceerd)
```

## Restrictions

- Alleen voor Windows (junctions zijn Windows-specifiek)
- Project naam moet uniek zijn in C:\Projects\
- Master config moet bestaan in C:\Projects\claude-config\
- GitHub publish vereist `gh` CLI authenticated
