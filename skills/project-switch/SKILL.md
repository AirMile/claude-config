---
name: project-switch
description: List all git repos in {projects_root} plus any extra_paths bookmarks (vaults, scratch dirs, etc.) and automatically switch to the chosen project in the same terminal tab. Use with /project-switch or /project-switch <name> to quickly switch between projects with the correct CLAUDE.md, permissions, and skills-symlinks loaded.
argument-hint: "[project-name|-]"
metadata:
  author: mileszeilstra
  version: 1.0.0
  category: project
---

# Project Switch

Geeft een lijst van alle git repos in `{projects_root}` plus eventuele `extra_paths` bookmarks (vaults, scratch-dirs, etc.), en schakelt automatisch over naar het gekozen project door de huidige sessie te sluiten en een nieuwe te starten in dezelfde terminal-tab.

## Trigger

`/project-switch` of `/project-switch [naam]`

## Waarom een nieuwe sessie

Claude Code heeft twee CWD-niveaus:

- **Harness-CWD** (vast bij sessie-start) — bepaalt welke `CLAUDE.md`, `.claude/settings.local.json` permissions en `.claude/`-symlinks (skills/agents/hooks) geladen worden, en wat de UI als actief project toont.
- **Bash-subshell-CWD** (verandert wel met `cd`) — alleen relevant voor shell-commando's, laadt geen project-context.

Switchen via `cd` in een Bash-call werkt voor commando's maar laadt geen project-context. Een nieuwe sessie starten via `/exit` + `cd <pad> && claude` schuift de hele harness mee.

## Process

### FASE 0: Pre-flight

**Detecteer platform:**

```bash
case "$(uname -s)" in
  Darwin*)           PLATFORM="macos" ;;
  Linux*)            PLATFORM="linux" ;;
  MINGW*|MSYS*|CYGWIN*) PLATFORM="windows" ;;
  *)                 PLATFORM="windows" ;;
esac
```

**Resolve `{projects_root}`** in deze volgorde (eerste match wint):

1. Env var `CLAUDE_PROJECTS_ROOT`
2. `paths.local.yaml` in huidige project (als aanwezig)
3. `skills/project-add/paths.yaml` defaults voor het platform

**Validatie:**

- `{projects_root}` bestaat als directory → anders: foutmelding met instructie om env var of `paths.local.yaml` te zetten, stop.

### FASE 1: Discover

**Git repos in `{projects_root}` (max-depth 2):**

```bash
find "{projects_root}" -mindepth 1 -maxdepth 2 -name ".git" -type d 2>/dev/null \
  | xargs -I {} dirname {} \
  | sort
```

**Extra paden uit `paths.yaml`** (vaults, scratch-dirs, bookmarks):

Lees `extra_paths` in dezelfde resolutie-volgorde als `projects_root`:

1. `paths.local.yaml` `extra_paths` in huidige project (user-specifiek)
2. `skills/project-add/paths.yaml` `extra_paths` voor het platform (leeg by default)

Voor elk item: lees `name`, `path`, en optioneel `type` (default `dir`). Resolve env-variabelen in `path` (`$HOME`, `$env:USERPROFILE`). Skip items waarvan het pad niet bestaat.

**Bouw lijst:**

- Git repos eerst, alfabetisch gesorteerd
- `extra_paths` items daarna, in volgorde zoals gedeclareerd
- Dedupe op pad

Als de lijst leeg is → foutmelding ("Geen projects gevonden in {projects_root}"), stop.

**Recent-first sortering:**

Lees `~/.claude/state/recent-projects.txt` (één pad per regel, meest-recente bovenaan, max 5 entries). Herorder de lijst:

- Recente paden die ook in de discover-resultaten staan → bovenaan, in volgorde van recentheid, gemarkeerd met `(recent)`
- Overige projects → eronder, alfabetisch (git repos dan extra_paths)
- Visuele scheidingsregel tussen de twee groepen

State-file mist of paden zijn niet aanwezig in discover → sla reorder stilzwijgend over, toon gewone alfabetische volgorde.

### FASE 2: Filter & Pick

**Speciaal: argument `-`** (vorige project, à la `cd -`):

Lees regel 1 van `~/.claude/state/recent-projects.txt`.

- Pad staat in de huidige discover-lijst → ga direct naar FASE 3
- State-file leeg of pad niet meer aanwezig → toon melding "Geen recent project bekend" en val terug naar FASE 2.b

**Met argument (`/project-switch [naam]`):**

Match in deze volgorde (eerste tier met hits wint, lagere tiers worden genegeerd):

1. **Exact** — naam matcht volledig (case-insensitive). Bv. `claude-config`.
2. **Acroniem** — initialen van dash-segmenten. Bv. `cc` → `claude-config`, `se` → `strike-edge`, `pa` → `project-add`. Werkt voor argumenten van 2+ tekens die volledig uit letters bestaan.
3. **Substring** — case-insensitive substring match. Bv. `conf` → `claude-config`.

Per gekozen tier:

- **1 hit** → ga direct naar FASE 3 met die match
- **0 hits** in alle tiers → toon volledige lijst (FASE 2.b) met melding "Geen match voor '[naam]', kies uit de lijst:"
- **2+ hits** in de winnende tier → toon gefilterde lijst (FASE 2.b) met melding "Meerdere matches voor '[naam]':"

**Zonder argument (FASE 2.b — lijst tonen):**

Print de genummerde plain-text lijst:

```
Beschikbare projects:

 1. strike-edge          git    /Users/.../Projects/strike-edge           (recent)
 2. claude-config        git    /Users/.../Projects/claude-config         (recent)
 ─────────────────────────────────────────────────────────────────────────────────
 3. my-app               git    /Users/.../Projects/my-app
 4. website              git    /Users/.../Projects/website
 5. obsidian-vault       vault  /Users/.../Documents/ObsidianVault
```

Print direct daarna, zonder modal:

Welk project wil je openen? Typ het nummer of (deel van) de naam.
Lege response of "annuleer" stopt de switch.

Stop daarna met output. Wacht op de volgende user-message.

Op de volgende turn parse de user-input:

- Pure nummer → kies dat item uit de lijst, ga naar FASE 3
- Tekst → fuzzy match (zelfde regels als argument-flow); bij meerdere hits opnieuw de lijst + vraag tonen
- Leeg / "annuleer" / "stop" → stop, geen verdere actie
- Out-of-range nummer → print "Ongeldig nummer (geldig: 1..N)" en herhaal de vraag

### FASE 3: Auto-switch

**Skip-current guard:**

```bash
TARGET_RESOLVED="$(cd "$TARGET_PATH" 2>/dev/null && pwd -P)"
CURRENT_RESOLVED="$(pwd -P)"
if [ "$TARGET_RESOLVED" = "$CURRENT_RESOLVED" ]; then
  echo "Already in <naam> — no switch needed."
  # stop, geen osascript-call
fi
```

Vergelijkt op resolved paden zodat `~/Projects/foo` en `/Users/x/Projects/foo` hetzelfde zijn.

**Pre-check target bestaat:**

```bash
if [ ! -d "$TARGET_PATH" ]; then
  echo "Target directory verdwenen: $TARGET_PATH"
  echo "Run /project-switch opnieuw of verwijder via /project-remove."
  # stop
fi
```

**Update recent-history** (atomic write via tmp-file + rename):

```bash
STATE_DIR="$HOME/.claude/state"
STATE_FILE="$STATE_DIR/recent-projects.txt"
mkdir -p "$STATE_DIR"

TMP="$(mktemp)"
{
  echo "$TARGET_PATH"
  [ -f "$STATE_FILE" ] && grep -vxF "$TARGET_PATH" "$STATE_FILE" | head -n 4
} > "$TMP"
mv "$TMP" "$STATE_FILE"
```

**Detecteer terminal:**

```bash
case "$TERM_PROGRAM" in
  iTerm.app)        TERM_KIND="iterm" ;;
  Apple_Terminal)   TERM_KIND="apple-terminal" ;;
  *)                TERM_KIND="unknown" ;;
esac
```

**Waarom een gedetacht background-script** — directe back-to-back `osascript write text "/exit"; write text "cd ... && claude"` werkt NIET. De tweede regel arriveert vóórdat de shell de TTY heeft overgenomen; de cd-input wordt geëchood maar door geen enkel proces gelezen (cd-regel verschijnt zichtbaar maar wordt nooit uitgevoerd).

Oplossing: spawn een **gedetacht** background-script (`nohup ... & disown`) met sleep'jes tussen de stappen. Het script overleeft Claude's exit doordat het losgekoppeld is van Claude's process-tree (na `disown` reparented naar init).

**iTerm2 (macOS) auto-switch:**

```bash
TARGET_PATH='<volledig pad>'
SWITCH_SCRIPT="$(mktemp -t claude-switch.XXXXXX)"

cat > "$SWITCH_SCRIPT" <<EOF
#!/bin/bash
sleep 0.5
osascript -e 'tell application "iTerm" to tell current session of current window to write text "/exit"'
sleep 2
osascript -e "tell application \"iTerm\" to tell current session of current window to write text \"cd '$TARGET_PATH' && claude\""
rm -f "\$0"
EOF

chmod +x "$SWITCH_SCRIPT"
nohup "$SWITCH_SCRIPT" </dev/null >/dev/null 2>&1 &
disown

echo "Switching to <naam>..."
```

Stappen in het script:

1. `sleep 0.5` — laat Claude's huidige turn afronden, REPL terug op input-prompt
2. `osascript ... write text "/exit"` — Claude REPL termineert clean, shell neemt TTY over
3. `sleep 2` — geeft shell tijd om prompt te tonen en input-handling op te zetten
4. `osascript ... write text "cd '<pad>' && claude"` — shell ontvangt en executeert; nieuwe Claude start in target dir
5. `rm -f "$0"` — script verwijdert zichzelf

Pad-quoting: single quotes rond `$TARGET_PATH` in de AppleScript-string werken voor paden met spaties. Paden met embedded single quotes komen zelden voor; pre-escape indien nodig.

**Apple Terminal (macOS) auto-switch:**

Zelfde structuur, ander osascript-target. `do script ... in selected tab of front window` voorkomt dat Terminal een nieuw venster opent:

```bash
TARGET_PATH='<volledig pad>'
SWITCH_SCRIPT="$(mktemp -t claude-switch.XXXXXX)"

cat > "$SWITCH_SCRIPT" <<EOF
#!/bin/bash
sleep 0.5
osascript -e 'tell application "Terminal" to do script "/exit" in selected tab of front window'
sleep 2
osascript -e "tell application \"Terminal\" to do script \"cd '$TARGET_PATH' && claude\" in selected tab of front window"
rm -f "\$0"
EOF

chmod +x "$SWITCH_SCRIPT"
nohup "$SWITCH_SCRIPT" </dev/null >/dev/null 2>&1 &
disown

echo "Switching to <naam>..."
```

**Bij `TERM_KIND=unknown`** (Windows Terminal, Linux DE's, tmux, etc.) — fallback naar print:

```
Switch naar: <naam>
Pad:         <volledig pad>
Type:        <git|vault|dir>

Auto-switch niet beschikbaar voor deze terminal. Doe handmatig:

  /exit
  cd "<volledig pad>" && claude
```

Bij succesvolle auto-switch: huidige Claude-sessie sluit binnen ~0.5s; nieuwe sessie start binnen ~3s in dezelfde tab.

## Foutgevallen

- `{projects_root}` bestaat niet → toon resolved pad + instructie env var of `paths.local.yaml`, stop.
- 0 git repos en 0 `extra_paths` gevonden → toon scan-pad + tip om `extra_paths` toe te voegen in `paths.local.yaml`, suggereer `/project-add`, stop.
- Argument matcht niets → fallback naar volledige lijst (FASE 2.b) met melding.
- Argument `-` maar geen recent-history → melding "Geen recent project bekend", fallback naar FASE 2.b.
- Target directory bestaat niet meer → melding + stop, géén osascript-call.
- Target is het project waar je al in zit → "Already in <naam> — no switch needed.", stop.

## Configuratie

`{projects_root}` en `extra_paths` worden gelezen uit `skills/project-add/paths.yaml` — dezelfde resolutie als alle andere project-\* skills:

| Instelling      | macOS default    | Windows default | Linux default    | Env var override       |
| --------------- | ---------------- | --------------- | ---------------- | ---------------------- |
| `projects_root` | `$HOME/projects` | `C:\Projects`   | `$HOME/projects` | `CLAUDE_PROJECTS_ROOT` |
| `extra_paths`   | `[]`             | `[]`            | `[]`             | —                      |

**Eigen vaults of bookmarks toevoegen** via `paths.local.yaml` in je project:

```yaml
paths:
  extra_paths:
    - { name: "obsidian-vault", path: "$HOME/Documents/MyVault", type: "vault" }
    - { name: "scratch", path: "$HOME/scratch", type: "dir" }
```

`type` is een weergave-label (`git` / `vault` / `dir`). Paden die niet bestaan worden stil overgeslagen.
