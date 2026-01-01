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

# Clone school-website project
git clone https://github.com/AirMile/claude-code-setup.git school-website

# === STAP 2: Verwijder lege Git-gemaakte folders ===
cd C:\Projects\school-website\.claude
Remove-Item -Path agents, commands, resources, scripts -Recurse -Force -ErrorAction SilentlyContinue

# === STAP 3: Maak junctions naar shared config ===
cmd /c "mklink /J agents C:\Projects\claude-config\agents"
cmd /c "mklink /J commands C:\Projects\claude-config\commands"
cmd /c "mklink /J resources C:\Projects\claude-config\resources"
cmd /c "mklink /J scripts C:\Projects\claude-config\scripts"

# === STAP 4: Verifieer ===
Write-Host "`n=== Setup Compleet ===" -ForegroundColor Green
Write-Host "Junctions aangemaakt:"
Get-ChildItem -Filter "agents","commands","resources","scripts" | ForEach-Object {
    $target = (Get-Item $_).Target
    Write-Host "  $($_.Name) -> $target"
}

# === STAP 5: Open in VS Code ===
code C:\Projects\school-website
```

## Handmatige Stappen (als bovenstaande niet werkt)

### 1. Clone repositories

```powershell
cd C:\Projects
git clone https://github.com/AirMile/claude-config.git
git clone https://github.com/AirMile/claude-code-setup.git school-website
```

### 2. Maak junctions

```powershell
cd C:\Projects\school-website\.claude

# Verwijder lege folders eerst
rmdir agents
rmdir commands
rmdir resources
rmdir scripts

# Maak junctions
cmd /c "mklink /J agents C:\Projects\claude-config\agents"
cmd /c "mklink /J commands C:\Projects\claude-config\commands"
cmd /c "mklink /J resources C:\Projects\claude-config\resources"
cmd /c "mklink /J scripts C:\Projects\claude-config\scripts"
```

### 3. Verifieer

```powershell
dir C:\Projects\school-website\.claude
# Je zou moeten zien: agents, commands, resources, scripts met <JUNCTION> tag
```

## Dagelijkse Workflow (Multi-Device)

### Voor je begint te werken (pull latest)

```powershell
# In school-website
cd C:\Projects\school-website
git pull

# In claude-config (als je commands/agents hebt aangepast)
cd C:\Projects\claude-config
git pull
```

### Na het werken (push changes)

```powershell
# In school-website
cd C:\Projects\school-website
git add -A && git commit -m "jouw message" && git push

# In claude-config (alleen als je commands/agents hebt aangepast)
cd C:\Projects\claude-config
git add -A && git commit -m "jouw message" && git push
```

## Troubleshooting

### "Junction already exists"
```powershell
# Verwijder bestaande junction eerst
cmd /c "rmdir C:\Projects\school-website\.claude\agents"
# Dan opnieuw aanmaken
cmd /c "mklink /J agents C:\Projects\claude-config\agents"
```

### "Administrator privilege required"
Je school-account blokkeert symlinks. Junctions werken WEL zonder admin.
Als het niet werkt, check of je `mklink /J` gebruikt (niet `mklink` zonder /J).

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
└── school-website\          ← Project (eigen Git repo)
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
