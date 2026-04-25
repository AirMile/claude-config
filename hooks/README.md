# hooks/

Claude Code hooks. Geregistreerd via `local/settings.json.template` → kopiëren naar `~/.claude/settings.json`.

## Hooks

| Bestand                | Event            | Matcher                  | Doel                                                   |
| ---------------------- | ---------------- | ------------------------ | ------------------------------------------------------ |
| `prompt-timer.cjs`     | UserPromptSubmit | (alle)                   | Statusline voedt timer                                 |
| `security-reminder.py` | PreToolUse       | `Write\|Edit\|MultiEdit` | Waarschuw bij riskante patronen (eval, XSS, injection) |
| `format-on-save.cjs`   | PostToolUse      | `Write\|Edit`            | Auto-format via Biome/Prettier/gdformat                |

## Runtime-vereisten

- **Node.js** (voor `*.cjs` hooks) — meestal al geïnstalleerd
- **Python 3** (voor `security-reminder.py`) — stdlib only, geen `pip install` nodig

## security-reminder.py

PreToolUse hook die niet-blokkerende waarschuwingen toont voor high-signal patronen:

| Pattern                           | Scope                            |
| --------------------------------- | -------------------------------- |
| `eval(`                           | `*.{js,ts,jsx,tsx,mjs,cjs,py}`   |
| `new Function(`                   | `*.{js,ts,jsx,tsx,mjs,cjs}`      |
| `dangerouslySetInnerHTML`         | `*.{jsx,tsx,js,ts}`              |
| `${{ github.event.* }}` in `run:` | `.github/workflows/*.{yml,yaml}` |
| `pickle.load(s)(`                 | `*.py`                           |

**Filters:** skipt `node_modules/`, `dist/`, `build/`, `.next/`, `coverage/`, `vendor/`, `.venv/`, en `*.test.*` / `*.spec.*` / `tests/` / `__tests__/` / `__mocks__/` paden.

**Dedup:** per Claude-sessie + regel-naam wordt elke waarschuwing maximaal één keer getoond. State in `~/.claude/.cache/security-warnings-<session_id>.json`, auto-cleanup na 7 dagen.

**Niet blokkerend:** exit code is altijd 0. Claude beslist zelf of de waarschuwing relevant is.
