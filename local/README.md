# local/

Portable configuratiebestanden voor `~/.claude/`. Kopieer naar je machine en pas aan.

## Setup

```powershell
# Windows
Copy-Item "C:\Projects\claude-config\local\statusline-command.cjs" "$env:USERPROFILE\.claude\"
Copy-Item "C:\Projects\claude-config\local\keybindings.json" "$env:USERPROFILE\.claude\"
Copy-Item "C:\Projects\claude-config\local\settings.json.template" "$env:USERPROFILE\.claude\settings.json"
Copy-Item "C:\Projects\claude-config\local\CLAUDE.md.base" "$env:USERPROFILE\.claude\CLAUDE.md"
```

```bash
# macOS
cp local/statusline-command.cjs ~/.claude/
cp local/keybindings.json ~/.claude/
cp local/settings.json.template ~/.claude/settings.json
cp local/CLAUDE.md.base ~/.claude/CLAUDE.md
```

## Na kopiëren

- **settings.json**: controleer of hook-paden kloppen voor je platform
- **CLAUDE.md**: voeg machine-specifieke secties toe (bijv. Obsidian vault pad)

## Bestanden

| Bestand                  | Doel                                                        |
| ------------------------ | ----------------------------------------------------------- |
| `statusline-command.cjs` | Statusline: repo naam, git branch, context %                |
| `keybindings.json`       | Keybindings (autocomplete dismiss op pijltjes)              |
| `settings.json.template` | Settings template zonder VPS-specifieke hooks               |
| `CLAUDE.md.base`         | Universele CLAUDE.md secties (gedrag, communicatie, skills) |
