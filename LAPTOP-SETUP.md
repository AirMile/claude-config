# Laptop Setup Guide

## Vereisten

- Git geïnstalleerd
- GitHub CLI (`gh`) geïnstalleerd en ingelogd
- VS Code geïnstalleerd
- Claude Code extensie geïnstalleerd

## Snelle Setup (Copy-Paste in PowerShell)

Open PowerShell en run dit hele blok:

```powershell
# === STAP 1: Clone repositories ===
cd C:\Projects

# Clone claude-config (shared commands/agents)
git clone https://github.com/AirMile/claude-config.git

# Clone signatuur-portfolio project
git clone https://github.com/AirMile/signatuur-portfolio.git

# === STAP 2: Verwijder lege Git-gemaakte folders ===
cd C:\Projects\signatuur-portfolio\.claude
Remove-Item -Path agents, commands, resources, scripts -Recurse -Force -ErrorAction SilentlyContinue

# === STAP 3: Maak junctions naar shared config ===
New-Item -ItemType Junction -Path agents -Target C:\Projects\claude-config\agents
New-Item -ItemType Junction -Path commands -Target C:\Projects\claude-config\commands
New-Item -ItemType Junction -Path resources -Target C:\Projects\claude-config\resources
New-Item -ItemType Junction -Path scripts -Target C:\Projects\claude-config\scripts

# === STAP 4: Verifieer ===
Write-Host "`n=== Setup Compleet ===" -ForegroundColor Green
Write-Host "Junctions aangemaakt:"
Get-ChildItem -Filter "agents","commands","resources","scripts" | ForEach-Object {
    Write-Host "  $($_.Name) -> $($_.Target)"
}

# === STAP 5: Open in VS Code ===
code C:\Projects\signatuur-portfolio
```

## Handmatige Stappen (als bovenstaande niet werkt)

### 1. Clone repositories

```powershell
cd C:\Projects
git clone https://github.com/AirMile/claude-config.git
git clone https://github.com/AirMile/signatuur-portfolio.git
```

### 2. Maak junctions

```powershell
cd C:\Projects\signatuur-portfolio\.claude

# Verwijder lege folders eerst
Remove-Item -Path agents, commands, resources, scripts -Recurse -Force -ErrorAction SilentlyContinue

# Maak junctions
New-Item -ItemType Junction -Path agents -Target C:\Projects\claude-config\agents
New-Item -ItemType Junction -Path commands -Target C:\Projects\claude-config\commands
New-Item -ItemType Junction -Path resources -Target C:\Projects\claude-config\resources
New-Item -ItemType Junction -Path scripts -Target C:\Projects\claude-config\scripts
```

### 3. Verifieer

```powershell
dir C:\Projects\signatuur-portfolio\.claude
# Je zou moeten zien: agents, commands, resources, scripts met <JUNCTION> tag
```

## Dagelijkse Workflow (Multi-Device)

### Voor je begint te werken (pull latest)

```powershell
# In signatuur-portfolio
cd C:\Projects\signatuur-portfolio
git pull

# In claude-config (als je commands/agents hebt aangepast)
cd C:\Projects\claude-config
git pull
```

### Na het werken (push changes)

```powershell
# In signatuur-portfolio
cd C:\Projects\signatuur-portfolio
git add -A && git commit -m "jouw message" && git push

# In claude-config (alleen als je commands/agents hebt aangepast)
cd C:\Projects\claude-config
git add -A && git commit -m "jouw message" && git push
```

## Troubleshooting

### "Junction already exists"
```powershell
# Verwijder bestaande junction eerst
Remove-Item -Path C:\Projects\signatuur-portfolio\.claude\agents -Force
# Dan opnieuw aanmaken
New-Item -ItemType Junction -Path agents -Target C:\Projects\claude-config\agents
```

### "Administrator privilege required"
Je school-account blokkeert symlinks. Junctions werken WEL zonder admin.
Gebruik `New-Item -ItemType Junction` (niet `mklink` zonder /J).

### Commands werken niet
1. Check of junctions correct zijn: `dir .claude` moet `<JUNCTION>` tonen
2. Herstart VS Code
3. Check of claude-config up-to-date is: `cd C:\Projects\claude-config && git pull`

## Structuur Referentie

```
C:\Projects\
├── claude-config\           ← Shared config (eigen Git repo)
│   ├── agents\
│   ├── commands\
│   ├── resources\
│   └── scripts\
│
└── signatuur-portfolio\          ← Project (eigen Git repo)
    ├── .claude\
    │   ├── agents\     → junction naar claude-config
    │   ├── commands\   → junction naar claude-config
    │   ├── resources\  → junction naar claude-config
    │   ├── scripts\    → junction naar claude-config
    │   ├── CLAUDE.md   ← project-specifiek (lokaal)
    │   └── docs\       ← project-specifiek (lokaal)
    ├── .workspace\
    └── src\
```
