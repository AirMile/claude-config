# local/

Portable config files for `~/.claude/`. Copy to your machine and customise.

## Setup

For automatic setup: use `/core-bootstrap` after cloning — deploys 4 user-files + 4 global symlinks to `~/.claude/`. The commands below are the manual fallback.

```powershell
# Windows — replace <your-clone-path> with the path where you cloned the repo
Copy-Item "<your-clone-path>\local\statusline-command.cjs" "$env:USERPROFILE\.claude\"
Copy-Item "<your-clone-path>\local\keybindings.json" "$env:USERPROFILE\.claude\"
Copy-Item "<your-clone-path>\local\settings.json.template" "$env:USERPROFILE\.claude\settings.json"
Copy-Item "<your-clone-path>\local\CLAUDE.md.base" "$env:USERPROFILE\.claude\CLAUDE.md"
```

```bash
# macOS — run from inside the cloned repo directory
cp local/statusline-command.cjs ~/.claude/
cp local/keybindings.json ~/.claude/
cp local/settings.json.template ~/.claude/settings.json
cp local/CLAUDE.md.base ~/.claude/CLAUDE.md
```

## After copying

- **settings.json**: verify hook paths are correct for your platform
- **CLAUDE.md**: add machine-specific sections if needed (e.g. project root path)

## Files

| File                     | Purpose                                                                       |
| ------------------------ | ----------------------------------------------------------------------------- |
| `statusline-command.cjs` | Statusline: repo name, git branch, context %                                  |
| `keybindings.json`       | Keybindings (dismiss autocomplete on arrow keys)                              |
| `settings.json.template` | Settings template — safe defaults, hooks wired up                             |
| `CLAUDE.md.base`         | Template for `~/.claude/CLAUDE.md`: behaviour, language policy, command rules |
