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

Shows a list of all git repos in `{projects_root}` plus any `extra_paths` bookmarks (vaults, scratch dirs, etc.), and automatically switches to the chosen project by closing the current session and starting a new one in the same terminal tab.

## Trigger

`/project-switch` or `/project-switch [name]`

## Why a new session

Claude Code has two CWD levels:

- **Harness-CWD** (fixed at session start) — determines which `CLAUDE.md`, `.claude/settings.local.json` permissions, and `.claude/`-symlinks (skills/agents/hooks) are loaded, and what the UI shows as the active project.
- **Bash-subshell-CWD** (changes with `cd`) — only relevant for shell commands, does not load project context.

Switching via `cd` in a Bash call works for commands but does not load project context. Starting a new session via `/exit` + `cd <path> && claude` moves the entire harness along.

## Process

### PHASE 0: Pre-flight

**Detect platform:**

```bash
case "$(uname -s)" in
  Darwin*)           PLATFORM="macos" ;;
  Linux*)            PLATFORM="linux" ;;
  MINGW*|MSYS*|CYGWIN*) PLATFORM="windows" ;;
  *)                 PLATFORM="windows" ;;
esac
```

**Resolve `{projects_root}`** in this order (first match wins):

1. Env var `CLAUDE_PROJECTS_ROOT`
2. `paths.local.yaml` in current project (if present)
3. `skills/project-add/paths.yaml` defaults for the platform

**Validation:**

- `{projects_root}` exists as a directory → otherwise: error message with instruction to set env var or `paths.local.yaml`, stop.

### PHASE 1: Discover

**Git repos in `{projects_root}` (max-depth 2):**

```bash
find "{projects_root}" -mindepth 1 -maxdepth 2 -name ".git" -type d 2>/dev/null \
  | xargs -I {} dirname {} \
  | sort
```

**Extra paths from `paths.yaml`** (vaults, scratch dirs, bookmarks):

Read `extra_paths` in the same resolution order as `projects_root`:

1. `paths.local.yaml` `extra_paths` in current project (user-specific)
2. `skills/project-add/paths.yaml` `extra_paths` for the platform (empty by default)

For each item: read `name`, `path`, and optionally `type` (default `dir`). Resolve env variables in `path` (`$HOME`, `$env:USERPROFILE`). Skip items whose path does not exist.

**Build list:**

- Git repos first, sorted alphabetically
- `extra_paths` items after, in the order declared
- Deduplicate on path

If the list is empty → error message ("No projects found in {projects_root}"), stop.

**Recent-first sorting:**

Read `~/.claude/state/recent-projects.txt` (one path per line, most recent at top, max 5 entries). Reorder the list:

- Recent paths that are also in the discover results → at the top, in order of recency, marked with `(recent)`
- Other projects → below, alphabetically (git repos then extra_paths)
- Visual separator between the two groups

State file missing or paths not present in discover → silently skip reorder, show plain alphabetical order.

### PHASE 2: Filter & Pick

**Special: argument `-`** (previous project, like `cd -`):

Read line 1 of `~/.claude/state/recent-projects.txt`.

- Path is in the current discover list → go directly to PHASE 3
- State file empty or path no longer present → show message "No recent project known" and fall back to PHASE 2.b

**With argument (`/project-switch [name]`):**

Match in this order (first tier with hits wins, lower tiers are ignored):

1. **Exact** — name matches fully (case-insensitive). E.g. `claude-config`.
2. **Acronym** — initials of dash-segments. E.g. `cc` → `claude-config`, `se` → `strike-edge`, `pa` → `project-add`. Works for arguments of 2+ characters consisting entirely of letters.
3. **Substring** — case-insensitive substring match. E.g. `conf` → `claude-config`.

Per chosen tier:

- **1 hit** → go directly to PHASE 3 with that match
- **0 hits** in all tiers → show full list (PHASE 2.b) with message "No match for '[name]', choose from the list:"
- **2+ hits** in the winning tier → show filtered list (PHASE 2.b) with message "Multiple matches for '[name]':"

**Without argument (PHASE 2.b — show list):**

Print the numbered plain-text list:

```
Available projects:

 1. strike-edge          git    /Users/.../Projects/strike-edge           (recent)
 2. claude-config        git    /Users/.../Projects/claude-config         (recent)
 ─────────────────────────────────────────────────────────────────────────────────
 3. my-app               git    /Users/.../Projects/my-app
 4. website              git    /Users/.../Projects/website
 5. obsidian-vault       vault  /Users/.../Documents/ObsidianVault
```

Then print directly, without a modal:

Which project do you want to open? Type the number or (part of) the name.
Empty response or "cancel" stops the switch.

Then stop output. Wait for the next user message.

On the next turn parse the user input:

- Pure number → choose that item from the list, go to PHASE 3
- Text → fuzzy match (same rules as argument flow); on multiple hits show the list + question again
- Empty / "cancel" / "stop" → stop, no further action
- Out-of-range number → print "Invalid number (valid: 1..N)" and repeat the question

### PHASE 3: Auto-switch

**Skip-current guard:**

```bash
TARGET_RESOLVED="$(cd "$TARGET_PATH" 2>/dev/null && pwd -P)"
CURRENT_RESOLVED="$(pwd -P)"
if [ "$TARGET_RESOLVED" = "$CURRENT_RESOLVED" ]; then
  echo "Already in <name> — no switch needed."
  # stop, no osascript call
fi
```

Compares on resolved paths so that `~/Projects/foo` and `/Users/x/Projects/foo` are the same.

**Pre-check target exists:**

```bash
if [ ! -d "$TARGET_PATH" ]; then
  echo "Target directory gone: $TARGET_PATH"
  echo "Run /project-switch again or remove via /project-remove."
  # stop
fi
```

**Update recent-history** (atomic write via tmp file + rename):

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

**Detect terminal:**

```bash
case "$TERM_PROGRAM" in
  iTerm.app)        TERM_KIND="iterm" ;;
  Apple_Terminal)   TERM_KIND="apple-terminal" ;;
  *)                TERM_KIND="unknown" ;;
esac
```

**Why a detached background script** — direct back-to-back `osascript write text "/exit"; write text "cd ... && claude"` does NOT work. The second line arrives before the shell has taken over the TTY; the cd input is echoed but read by no process (the cd line appears visibly but is never executed).

Solution: spawn a **detached** background script (`nohup ... & disown`) with sleeps between the steps. The script survives Claude's exit because it is decoupled from Claude's process tree (after `disown` reparented to init).

**iTerm2 (macOS) auto-switch:**

```bash
TARGET_PATH='<full path>'
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

echo "Switching to <name>..."
```

Steps in the script:

1. `sleep 0.5` — let Claude's current turn finish, REPL back on input prompt
2. `osascript ... write text "/exit"` — Claude REPL terminates cleanly, shell takes over TTY
3. `sleep 2` — gives the shell time to show prompt and set up input handling
4. `osascript ... write text "cd '<path>' && claude"` — shell receives and executes; new Claude starts in target dir
5. `rm -f "$0"` — script removes itself

Path quoting: single quotes around `$TARGET_PATH` in the AppleScript string work for paths with spaces. Paths with embedded single quotes are rare; pre-escape if needed.

**Apple Terminal (macOS) auto-switch:**

Same structure, different osascript target. `do script ... in selected tab of front window` prevents Terminal from opening a new window:

```bash
TARGET_PATH='<full path>'
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

echo "Switching to <name>..."
```

**On `TERM_KIND=unknown`** (Windows Terminal, Linux DEs, tmux, etc.) — fall back to print:

```
Switch to: <name>
Path:      <full path>
Type:      <git|vault|dir>

Auto-switch not available for this terminal. Do it manually:

  /exit
  cd "<full path>" && claude
```

On successful auto-switch: current Claude session closes within ~0.5s; new session starts within ~3s in the same tab.

## Error Cases

- `{projects_root}` does not exist → show resolved path + instruction to set env var or `paths.local.yaml`, stop.
- 0 git repos and 0 `extra_paths` found → show scan path + tip to add `extra_paths` in `paths.local.yaml`, suggest `/project-add`, stop.
- Argument matches nothing → fall back to full list (PHASE 2.b) with message.
- Argument `-` but no recent history → message "No recent project known", fall back to PHASE 2.b.
- Target directory no longer exists → message + stop, no osascript call.
- Target is the project you are already in → "Already in <name> — no switch needed.", stop.

## Configuration

`{projects_root}` and `extra_paths` are read from `skills/project-add/paths.yaml` — the same resolution as all other project-\* skills:

| Setting         | macOS default    | Windows default | Linux default    | Env var override       |
| --------------- | ---------------- | --------------- | ---------------- | ---------------------- |
| `projects_root` | `$HOME/projects` | `C:\Projects`   | `$HOME/projects` | `CLAUDE_PROJECTS_ROOT` |
| `extra_paths`   | `[]`             | `[]`            | `[]`             | —                      |

**Add your own vaults or bookmarks** via `paths.local.yaml` in your project:

```yaml
paths:
  extra_paths:
    - { name: "obsidian-vault", path: "$HOME/Documents/MyVault", type: "vault" }
    - { name: "scratch", path: "$HOME/scratch", type: "dir" }
```

`type` is a display label (`git` / `vault` / `dir`). Paths that do not exist are silently skipped.
