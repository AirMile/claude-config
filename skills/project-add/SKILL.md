---
name: project-add
description: Add project (new or clone existing) with symlinks/junctions to shared claude-config. Use with /project-add to register a new project in the multi-project setup.
disable-model-invocation: true
metadata:
  author: mileszeilstra
  version: 1.0.0
  category: project
---

# Project Add

Voegt een project toe — maak een nieuw project aan of clone een bestaande GitHub repo — met symlinks (Linux) of junctions (Windows) naar de gedeelde claude-config.

## Trigger

`/project-add [naam]` of `/project-add`

## Process

### FASE 0: Pre-flight Checks

**Detecteer platform:**

```bash
# Detect OS
if [[ "$(uname -s)" == "Linux" ]]; then
  PLATFORM="linux"
else
  PLATFORM="windows"
fi
```

Use the detected platform to resolve `{projects_root}` and `{config_repo}` from `paths.yaml` (see Configuration section below).

**Voordat iets aangemaakt wordt, valideer:**

```bash
# Check claude-config bestaat en compleet is
test -d "{config_repo}"
test -d "{config_repo}/agents"
test -d "{config_repo}/skills"
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
→ Toon waarschuwing maar ga door (clone mode en publish worden niet beschikbaar)

**Als checks slagen:**
→ Ga door naar FASE 1

### FASE 1: Mode Selectie

**Als naam meegegeven via `/project-add [naam]`:**
→ Neem aan: **nieuw project** modus. Ga naar FASE 2 (new).

**Als geen naam meegegeven:**

```yaml
question: "Wat wil je doen?"
header: "Modus"
options:
  - label: "Nieuw project aanmaken (Recommended)"
    description: "Maak een leeg project met claude-config symlinks"
  - label: "Bestaande repo clonen"
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
mkdir -p {projects_root}/[naam]/.workspace/sessions/chats
mkdir -p {projects_root}/[naam]/.workspace/sessions/commands
mkdir -p {projects_root}/[naam]/.workspace/plans
mkdir -p {projects_root}/[naam]/.workspace/features
```

**New mode:** maakt alles vanaf scratch.
**Clone mode:** project root bestaat al, maakt alleen `.claude/` en `.workspace/` subdirs aan.

### FASE 3.5: Profiel Selectie

Read profiles from `{config_repo}/skills/core-profile/profiles.yaml`.

Show a **numbered list** of all profiles (except "core" and "all") with their unique skills (skills not in "core"). Format:

```
**Beschikbare profielen:**

1. **dev** — dev-build, dev-debug, dev-define, dev-plan, dev-refactor, dev-test, dev-worktree
2. **dev-legacy** — dev-legacy-owasp, ...
3. **frontend** — frontend-theme, frontend-compose, frontend-build, frontend-convert
4. **game** — game-backlog, game-build, game-define, game-test
...
A. **all** — Alle skills

Welk profiel wil je activeren? (nummer, naam, of komma-gescheiden)
```

Do NOT use AskUserQuestion — present the list in plain text so all options are visible. Let user type their choice (number(s), name(s), or comma-separated combinations).

**Default suggestion:** "dev" (mention as recommended).

Store the selected profile name(s) for FASE 4.

### FASE 4: Symlinks/Junctions Maken

**Whole-directory links (agents, hooks, scripts):**

Linux:

```bash
ln -sfn {config_repo}/agents {projects_root}/[naam]/.claude/agents
ln -sfn {config_repo}/hooks {projects_root}/[naam]/.claude/hooks
ln -sfn {config_repo}/scripts {projects_root}/[naam]/.claude/scripts
```

Windows:

```bash
cmd /c "mklink /J {projects_root}\[naam]\.claude\agents {config_repo}\agents"
cmd /c "mklink /J {projects_root}\[naam]\.claude\hooks {config_repo}\hooks"
cmd /c "mklink /J {projects_root}\[naam]\.claude\scripts {config_repo}\scripts"
```

**Per-skill links via profile selection (cross-platform):**

```bash
mkdir -p {projects_root}/[naam]/.claude/skills

python3 {config_repo}/skills/core-profile/switch-profile.py \
  --profiles <selected_profiles_from_fase_3.5> \
  --skills-dir {projects_root}/[naam]/.claude/skills \
  --source-dir {config_repo}/skills
```

**Note:** Skills uses per-skill symlinks/junctions (not a single directory link) so profiles can be switched later with `/core-profile`.

### FASE 5: Basis Bestanden

#### New mode:

**Kopieer templates:**

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

# Claude workspace (runtime data)
.workspace/sessions/
.workspace/features/

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
# Claude workspace (runtime data)
.workspace/sessions/
.workspace/features/

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

**Roep /core-setup aan:**

```
Vraag gebruiker: "Wil je nu /core-setup uitvoeren om CLAUDE.md te configureren?"

Options:
- "Ja, configureer nu (Recommended)" → roep /core-setup aan
- "Nee, later" → toon instructies voor handmatige setup
```

**Als /core-setup wordt uitgevoerd:**

- Lees CLAUDE.base.md van `{config_repo}`
- Volg normale /core-setup flow
- Schrijf naar `{projects_root}/[naam]/.claude/CLAUDE.md`

### FASE 8: GitHub Publish

#### New mode:

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

- Alias mag niet al bestaan in `~/.bashrc`
- Alleen lowercase letters, max 4 karakters (kort en snel)

**Toevoegen:**

```bash
# Append alias naar ~/.bashrc
echo "alias [alias]='cd {projects_root}/[naam] && claude'" >> ~/.bashrc
```

**Bevestig:**

```
Alias aangemaakt: [alias] → cd {projects_root}/[naam] && claude
Gebruik: source ~/.bashrc (of open nieuwe terminal) om te activeren
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
│   ├── agents/     → symlink/junction (hele map)
│   ├── hooks/      → symlink/junction (hele map)
│   ├── scripts/    → symlink/junction (hele map)
│   ├── skills/     → per-skill symlinks/junctions (profiel: [naam])
│   ├── docs/
│   ├── research/
│   └── CLAUDE.md (of nog te configureren)
├── .workspace/
└── .gitignore

Actief profiel: [profiel naam(en)]
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
│   ├── agents/     → symlink/junction (hele map)
│   ├── hooks/      → symlink/junction (hele map)
│   ├── scripts/    → symlink/junction (hele map)
│   ├── skills/     → per-skill symlinks/junctions (profiel: [naam])
│   ├── docs/
│   ├── research/
│   └── CLAUDE.md (of nog te configureren)
├── .workspace/
├── .gitignore (bijgewerkt met claude entries)
└── [bestaande repo bestanden]

Actief profiel: [profiel naam(en)]
Alias: [alias] → cd {projects_root}/[naam] && claude (indien aangemaakt)
GitHub: https://github.com/[owner]/[repo]
```

## Configuration

Paths zijn configureerbaar per apparaat. Defaults zijn platform-afhankelijk:

| Placeholder       | Linux Default         | Windows Default             | Environment Variable   |
| ----------------- | --------------------- | --------------------------- | ---------------------- |
| `{projects_root}` | `$HOME/projects`      | `C:\Projects`               | `CLAUDE_PROJECTS_ROOT` |
| `{config_repo}`   | `$HOME/claude-config` | `C:\Projects\claude-config` | `CLAUDE_CONFIG_REPO`   |

**Resolution order (eerste match wint):**

1. Environment variable
2. `.claude/paths.local.yaml` (lokaal per project, niet in git)
3. `resources/paths.yaml` (gedeelde defaults, platform-sectie)

## Restrictions

- Supported on Linux (symlinks) and Windows (junctions)
- Project naam moet uniek zijn in `{projects_root}`
- Master config moet bestaan in `{config_repo}`
- Clone mode vereist `gh` CLI authenticated
- GitHub publish vereist `gh` CLI authenticated
