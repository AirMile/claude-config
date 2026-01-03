---
description: Maak nieuw project met junction-based .claude/ config en optionele GitHub publish
---

# Project New

Creëert een nieuw project met junctions naar de gedeelde claude-config.

## Trigger

`/project-new [naam]` of `/project-new`

## Process

### FASE 0: Pre-flight Checks

**Voordat iets aangemaakt wordt, valideer:**
```bash
# Check claude-config bestaat en compleet is
test -d "{config_repo}"
test -d "{config_repo}\agents"
test -d "{config_repo}\commands"
test -d "{config_repo}\resources"
test -d "{config_repo}\scripts"
```

**Als check faalt:**
```
❌ claude-config niet gevonden of incompleet

Verwacht: {config_repo}
Met folders: agents/, commands/, resources/, scripts/

Oplossing:
1. Clone claude-config repo naar {config_repo}
2. Of pas pad aan via CLAUDE_CONFIG_REPO environment variable
```
→ Stop command, maak GEEN folders aan

**Als check slaagt:**
→ Ga door naar FASE 1

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
- Niet bestaand in `{projects_root}`

### FASE 2: Project Aanmaken

```bash
# Maak project folder
mkdir {projects_root}\[naam]

# Maak .claude subfolder
mkdir {projects_root}\[naam]\.claude

# Maak project-specifieke folders
mkdir {projects_root}\[naam]\.claude\docs
mkdir {projects_root}\[naam]\.claude\research
mkdir {projects_root}\[naam]\.workspace
mkdir {projects_root}\[naam]\.workspace\sessions\chats
mkdir {projects_root}\[naam]\.workspace\sessions\commands
mkdir {projects_root}\[naam]\.workspace\plans
mkdir {projects_root}\[naam]\.workspace\features
```

### FASE 3: Junctions Maken

```bash
# Maak junctions naar master config (absolute paths!)
cmd /c "mklink /J {projects_root}\[naam]\.claude\agents {config_repo}\agents"
cmd /c "mklink /J {projects_root}\[naam]\.claude\commands {config_repo}\commands"
cmd /c "mklink /J {projects_root}\[naam]\.claude\resources {config_repo}\resources"
cmd /c "mklink /J {projects_root}\[naam]\.claude\scripts {config_repo}\scripts"
```

### FASE 4: Basis Bestanden

**Kopieer templates:**
```bash
# settings.local.json met default permissions
echo '{"permissions": {"allow": []}}' > {projects_root}\[naam]\.claude\settings.local.json

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

# Claude local config (per-device, not shared)
.claude/paths.local.yaml

# Junctions (tracked via master repo, not this one)
.claude/agents/
.claude/commands/
.claude/resources/
.claude/scripts/
```

### FASE 5: Git Initialisatie

```bash
cd {projects_root}\[naam]
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
- Lees CLAUDE.base.md van `{config_repo}`
- Volg normale /setup flow
- Schrijf naar `{projects_root}\[naam]\.claude\CLAUDE.md`

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
cd {projects_root}\[naam]
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
code {projects_root}\[naam]
```

**Output:**
```
✅ Project [naam] aangemaakt

Structuur:
{projects_root}\[naam]\
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

## Configuration

Paths zijn configureerbaar per apparaat:

| Placeholder | Default | Environment Variable |
|-------------|---------|---------------------|
| `{projects_root}` | `C:\Projects` | `CLAUDE_PROJECTS_ROOT` |
| `{config_repo}` | `C:\Projects\claude-config` | `CLAUDE_CONFIG_REPO` |

**Resolution order (eerste match wint):**
1. Environment variable
2. `.claude/paths.local.yaml` (lokaal per project, niet in git)
3. `resources/paths.yaml` (gedeelde defaults)

## Restrictions

- Alleen voor Windows (junctions zijn Windows-specifiek)
- Project naam moet uniek zijn in `{projects_root}`
- Master config moet bestaan in `{config_repo}`
- GitHub publish vereist `gh` CLI authenticated
