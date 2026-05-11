---
name: project-add
description: Add project (new or clone existing) and register it in the multi-project setup. Use with /project-add.
metadata:
  author: mileszeilstra
  version: 1.0.0
  category: project
---

# Project Add

Voegt een project toe — maak een nieuw project aan of clone een bestaande GitHub repo — met symlinks (macOS) of junctions (Windows) naar de gedeelde claude-config.

## Trigger

`/project-add [naam]` of `/project-add`

## Process

### FASE 0: Pre-flight Checks

**Detecteer platform:**

```bash
# Detect OS
case "$(uname -s)" in
  Darwin)                PLATFORM="macos" ;;
  Linux)                 PLATFORM="linux" ;;
  MINGW*|CYGWIN*|MSYS*) PLATFORM="windows" ;;
  *) echo "Unsupported platform: $(uname -s)" >&2; exit 1 ;;
esac
```

Use the detected platform to resolve `{projects_root}` and `{config_repo}` from `paths.yaml` (see Configuration section below).

**Voordat iets aangemaakt wordt, valideer:**

```bash
# Check claude-config bestaat en compleet is
test -d "{config_repo}"
test -d "{config_repo}/scripts"

# Check gh CLI authenticated (nodig voor clone mode en publish)
gh auth status
```

**Als config check faalt:**

```
❌ claude-config niet gevonden of incompleet

Verwacht: {config_repo}
Met folders: agents/, skills/, scripts/

Oplossing:
1. Clone claude-config repo naar {config_repo}
2. Of pas pad aan via CLAUDE_CONFIG_REPO environment variable
```

→ Stop command, maak GEEN folders aan

**Als gh auth faalt:**
→ Sla op: `GH_AVAILABLE=false`. Toon: `gh niet beschikbaar — clone mode en GitHub publish overgeslagen.`

**Als checks slagen:**
→ Ga door naar FASE 1

### FASE 1: Mode Selectie

**Als naam meegegeven via `/project-add [naam]`:**
→ Neem aan: **nieuw project** modus. Valideer de naam direct (zelfde regels als FASE 2 (new): lowercase letters/cijfers/hyphens, geen spaties of speciale tekens, niet bestaand in `{projects_root}`). Bij validatiefout: toon de fout en stop. Bij geldig: sla naam op en ga naar FASE 3 (skip FASE 2 (new) naam-vraag).

**Als geen naam meegegeven:**

Als `GH_AVAILABLE=false`: toon alleen "Nieuw project aanmaken" (Clone vereist gh).

```yaml
question: "Wat wil je doen?"
header: "Modus"
options:
  - label: "Nieuw project aanmaken (Recommended)"
    description: "Maak een leeg project met claude-config symlinks"
  - label: "Bestaande repo clonen" # alleen tonen als GH_AVAILABLE=true
    description: "Clone een GitHub repo en configureer claude-config symlinks"
multiSelect: false
```

→ **Nieuw project:** ga naar FASE 2 (new)
→ **Clone:** ga naar FASE 2 (clone)

### FASE 2 (new): Project Naam

**Vraag naam:**

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

→ Ga naar FASE 3

### FASE 2 (clone): Repo Selectie

**Twee sub-opties:**

```yaml
question: "Hoe wil je de repo selecteren?"
header: "Repo"
options:
  - label: "Browse mijn repos (Recommended)"
    description: "Toon lijst van je GitHub repos"
  - label: "Handmatig invoeren"
    description: "Typ owner/repo of volledige GitHub URL"
multiSelect: false
```

#### Browse modus:

```bash
gh repo list --limit 30 --json name,description,isPrivate,url --jq '.[] | "\(.name)\t\(.description // "-")\t\(if .isPrivate then "🔒" else "🌐" end)\t\(.url)"'
```

Toon als genummerde lijst in plain text:

```
Beschikbare repos:

 1. my-app          — My cool app             🔒
 2. website         — Personal site            🌐
 3. api-backend     — REST API service         🔒
...

M. Meer laden
Q. Handmatig invoeren

Welke repo? (nummer)
```

- User kiest nummer → selecteer die repo
- **M** → laad volgende 30 (`--limit 30` met offset)
- **Q** → switch naar handmatige invoer

#### Handmatige modus:

User typt `owner/repo` of volledige GitHub URL (bijv. `https://github.com/owner/repo`).
Parse naar `owner/repo` formaat.

**Na repo selectie:**

1. Extract project naam uit repo naam
2. Check dat `{projects_root}/[naam]` nog niet bestaat
3. Clone:

```bash
gh repo clone <owner/repo> {projects_root}/[naam]
```

→ Ga naar FASE 3

### FASE 3: Setup Directories

**Maak project subdirectories (mkdir -p is veilig voor beide modes):**

```bash
mkdir -p {projects_root}/[naam]/.claude/docs
mkdir -p {projects_root}/[naam]/.claude/research
mkdir -p {projects_root}/[naam]/.project/sessions/chats
mkdir -p {projects_root}/[naam]/.project/sessions/commands
mkdir -p {projects_root}/[naam]/.project/plans
mkdir -p {projects_root}/[naam]/.project/features
```

**New mode:** maakt alles vanaf scratch.
**Clone mode:** project root bestaat al, maakt alleen `.claude/` en `.project/` subdirs aan.

### FASE 4: Basis Bestanden

#### New mode:

**Kopieer templates:**

**Schrijf initiële projectbestanden:**

macOS / Linux:

```bash
cat > "{projects_root}/[naam]/.project/project.json" << 'ENDJSON'
{
  "concept": { "name": "[naam]", "pitch": "", "content": "" },
  "localUrl": "",
  "theme": {
    "colors": { "main": [], "accent": [], "semantic": [] },
    "typography": { "families": { "heading": "", "body": "", "mono": "" }, "sizes": [] },
    "spacing": { "base": "", "scale": [] },
    "breakpoints": [],
    "borderRadius": [],
    "shadows": [],
    "modes": {},
    "cssVars": ""
  },
  "stack": { "framework": "", "language": "", "styling": "", "db": "", "auth": "", "hosting": "", "packages": [] },
  "data": { "entities": [] },
  "endpoints": [],
  "features": [],
  "thinking": []
}
ENDJSON

cat > "{projects_root}/[naam]/.project/project-context.json" << 'ENDJSON'
{
  "architecture": { "routes": [], "components": [], "endpoints": [], "entities": [], "diagram": "", "dataFlow": "" },
  "context": { "structure": "", "routing": [], "patterns": [] },
  "learnings": []
}
ENDJSON
```

Windows (PowerShell):

```powershell
$projectJson = '{
  "concept": { "name": "[naam]", "pitch": "", "content": "" },
  "localUrl": "",
  "theme": {
    "colors": { "main": [], "accent": [], "semantic": [] },
    "typography": { "families": { "heading": "", "body": "", "mono": "" }, "sizes": [] },
    "spacing": { "base": "", "scale": [] },
    "breakpoints": [], "borderRadius": [], "shadows": [], "modes": {}, "cssVars": ""
  },
  "stack": { "framework": "", "language": "", "styling": "", "db": "", "auth": "", "hosting": "", "packages": [] },
  "data": { "entities": [] },
  "endpoints": [], "features": [], "thinking": []
}'
Set-Content -Path "{projects_root}\[naam]\.project\project.json" -Value $projectJson -Encoding UTF8

$ctxJson = '{
  "architecture": { "routes": [], "components": [], "endpoints": [], "entities": [], "diagram": "", "dataFlow": "" },
  "context": { "structure": "", "routing": [], "patterns": [] },
  "learnings": []
}'
Set-Content -Path "{projects_root}\[naam]\.project\project-context.json" -Value $ctxJson -Encoding UTF8
```

**Vervang `[naam]` letterlijk met de werkelijke projectnaam in beide bestanden.**

```bash
# settings.local.json met default permissions
echo '{"permissions": {"allow": []}}' > {projects_root}/[naam]/.claude/settings.local.json
```

**.gitignore aanmaken met standaard inhoud:**

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

# Claude project (runtime data)
.project/session/
.project/sessions/
.project/features/

# Claude local config (per-device, not shared)
.claude/paths.local.yaml

# Symlinks/junctions (tracked via master repo, not this one)
.claude/agents/
.claude/hooks/
.claude/skills/
.claude/scripts/
```

#### Clone mode:

**settings.local.json aanmaken:**

```bash
echo '{"permissions": {"allow": []}}' > {projects_root}/[naam]/.claude/settings.local.json
```

**.gitignore — append claude-specifieke entries als ze nog niet bestaan:**

Check of de volgende entries al in `.gitignore` staan. Voeg alleen ontbrekende entries toe:

```
# Claude project (runtime data)
.project/session/
.project/sessions/
.project/features/

# Claude local config (per-device, not shared)
.claude/paths.local.yaml

# Symlinks/junctions (tracked via master repo, not this one)
.claude/agents/
.claude/hooks/
.claude/skills/
.claude/scripts/
```

Als `.gitignore` niet bestaat, maak deze aan met bovenstaande entries.

### FASE 6: Git Initialisatie

#### New mode:

```bash
cd {projects_root}/[naam]
git init
git add .gitignore
```

#### Clone mode:

→ Skip (repo is al geïnitialiseerd door `gh repo clone`)

### FASE 7: Project Configuratie

**Bepaal beoogde core-setup mode:**

- New mode → `setup_mode = "greenfield"`
- Clone mode → `setup_mode = "mature"` (cloned repo kan al broncode hebben)

**AskUserQuestion (single-select):**

```yaml
header: "Setup wizard"
question: "Wil je nu de project setup wizard draaien? (stack, CLAUDE.md, design tokens)"
options:
  - label: "Ja, configureer nu (Recommended)"
    description: "Direct doorgaan met /core-setup --mode={setup_mode}"
  - label: "Nee, later"
    description: "Session marker schrijven — volgende /core-setup start direct in {setup_mode} mode"
multiSelect: false
```

**Bij "Ja, configureer nu":** roep `/core-setup --mode={setup_mode}` aan. Geen marker nodig — flow is sequentieel.

**Bij "Nee, later":** schrijf marker zodat de volgende `/core-setup` run detectie overslaat:

```bash
mkdir -p .project/session
cat > ".project/session/setup-pending.json" << ENDJSON
{
  "source": "project-add",
  "mode": "{setup_mode}",
  "createdAt": "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
}
ENDJSON
```

Toon: `Setup later: run /core-setup in een nieuwe sessie — de wizard start direct in {setup_mode} mode.`

### FASE 8: GitHub Publish

#### New mode:

Als `GH_AVAILABLE=false`: sla deze fase over. Toon: `GitHub publish overgeslagen — gh niet geauthenticeerd.` Ga naar FASE 9.

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
cd {projects_root}/[naam]
git add -A
git commit -m "feat: initial commit - [naam]"
```

2. **Vraag korte description** (optioneel — vrije tekst):

Toon: `Korte GitHub description (optioneel, Enter om over te slaan):`
Lees user input → sla op als `REPO_DESC` (kan leeg zijn).

3. Maak GitHub repo en push:

```bash
# Bouw description-argument als bash array (leeg = geen flag)
if [ -n "$REPO_DESC" ]; then
  DESC_FLAG=(--description "$REPO_DESC")
else
  DESC_FLAG=()
fi

# Private repo
gh repo create [naam] --private --source=. --push "${DESC_FLAG[@]}"

# OF public repo
gh repo create [naam] --public --source=. --push "${DESC_FLAG[@]}"
```

4. Toon repo URL na succesvolle publish

**Vereisten voor publish:**

- `gh` CLI geïnstalleerd en authenticated
- Check met `gh auth status` voordat je begint

#### Clone mode:

→ Skip (repo is al op GitHub)

Toon: `GitHub: [repo URL]`

### FASE 9: Shell Alias

**Vraag:**

```yaml
question: "Wil je een shell alias aanmaken om dit project snel te openen?"
header: "Alias"
options:
  - label: "Ja, maak alias (Recommended)"
    description: "Voeg alias toe aan ~/.bashrc die cd + claude uitvoert"
  - label: "Nee, overslaan"
    description: "Geen alias aanmaken"
multiSelect: false
```

**Als alias gewenst:**

Stel een korte alias voor op basis van de projectnaam (eerste letters, afkorting, of initialen). Laat de user bevestigen of aanpassen.

```yaml
question: "Welke alias wil je gebruiken?"
header: "Alias"
options:
  - label: "[suggestie] (Recommended)"
    description: "alias [suggestie]='cd {projects_root}/[naam] && claude'"
  - label: "Andere naam"
    description: "Typ zelf een alias naam"
multiSelect: false
```

**Validatie:**

- Alias mag niet al bestaan in de target rc-file
- Alleen lowercase letters, max 4 karakters (kort en snel)

**Toevoegen:**

Detecteer shell en kies rc-file:

```bash
case "$SHELL" in
  */zsh)  RC_FILE="$HOME/.zshrc" ;;
  */bash) RC_FILE="$HOME/.bashrc" ;;
  */fish) RC_FILE="$HOME/.config/fish/config.fish" ;;
  *)      RC_FILE="$HOME/.profile" ;;
esac

echo "alias [alias]='cd {projects_root}/[naam] && claude'" >> "$RC_FILE"
```

**Bevestig:**

```
Alias aangemaakt: [alias] → cd {projects_root}/[naam] && claude
Toegevoegd aan: $RC_FILE
Gebruik: source $RC_FILE (of open nieuwe terminal) om te activeren
```

### FASE 10: Afronden

**Vraag:**

```yaml
question: "Project toegevoegd. Wat wil je doen?"
header: "Open"
options:
  - label: "Open in VS Code (Recommended)"
    description: "Open project in VS Code window"
  - label: "Blijf hier"
    description: "Blijf in huidige project werken"
multiSelect: false
```

**Als VS Code:**

```bash
code {projects_root}/[naam]
```

**Output (new mode):**

```
✅ Project [naam] aangemaakt

Structuur:
{projects_root}/[naam]/
├── .claude/
│   ├── docs/
│   ├── research/
│   └── CLAUDE.md (of nog te configureren)
├── .project/
└── .gitignore

Alias: [alias] → cd {projects_root}/[naam] && claude (indien aangemaakt)
GitHub: https://github.com/[user]/[naam] (indien gepubliceerd)
```

**Output (clone mode):**

```
✅ Project [naam] geclonet en geconfigureerd

Bron: https://github.com/[owner]/[repo]

Structuur:
{projects_root}/[naam]/
├── .claude/
│   ├── docs/
│   ├── research/
│   └── CLAUDE.md (of nog te configureren)
├── .project/
├── .gitignore (bijgewerkt met claude entries)
└── [bestaande repo bestanden]

Alias: [alias] → cd {projects_root}/[naam] && claude (indien aangemaakt)
GitHub: https://github.com/[owner]/[repo]
```

## Configuration

Paths zijn configureerbaar per apparaat. Defaults zijn platform-afhankelijk:

| Placeholder       | macOS Default         | Windows Default             | Environment Variable   |
| ----------------- | --------------------- | --------------------------- | ---------------------- |
| `{projects_root}` | `$HOME/projects`      | `C:\Projects`               | `CLAUDE_PROJECTS_ROOT` |
| `{config_repo}`   | `$HOME/claude-config` | `C:\Projects\claude-config` | `CLAUDE_CONFIG_REPO`   |

**Resolution order (eerste match wint):**

1. Environment variable
2. `.claude/paths.local.yaml` (lokaal per project, niet in git)
3. `resources/paths.yaml` (gedeelde defaults, platform-sectie)

## Restrictions

- Supported on macOS (symlinks) and Windows (junctions)
- Project naam moet uniek zijn in `{projects_root}`
- Master config moet bestaan in `{config_repo}`
- Clone mode vereist `gh` CLI authenticated
- GitHub publish vereist `gh` CLI authenticated
