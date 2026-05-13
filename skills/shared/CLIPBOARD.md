# Clipboard Helper

Two patterns for skills that want to give users their final markdown output:

1. **Code-block (default)** — output as ` ```markdown ``` ` block; the Claude Code UI shows a copy button on every code block. No tool calls needed, works everywhere.
2. **System clipboard** — execute `pbcopy` / `Set-Clipboard` via the Bash tool to push directly to the OS clipboard. Use when the user explicitly asked for it or when the content is too large to scroll-and-click.

## Pattern 1 — Code-block (preferred)

Simply wrap the final markdown content in a fenced code block:

````
```markdown
{content}
```
````

The UI handles the rest. No platform detection, no flaky shell commands.

## Pattern 2 — System clipboard

Use when the user requested "copy to system clipboard" explicitly or the output is large/multi-screen.

## Platform commands

**macOS / Linux** (use Bash tool):

```bash
cat <<'CLIPBOARD_EOF' | pbcopy
{content}
CLIPBOARD_EOF
```

If `pbcopy` is unavailable (Linux without xclip): fall back to writing to a temp file and report the path.

**Windows** (use Bash tool with PowerShell):

```bash
powershell -NoProfile -Command "@'
{content}
'@ | Set-Clipboard"
```

## Detection

Determine platform from `$OSTYPE`, `uname -s`, or the bootstrap's saved platform marker. If unclear: ask the user once, cache the answer in `.project/session/devinfo.json#platform` for re-use.

## Confirmation

After copy, output one line:

```
Copied to clipboard ({N} chars).
```

Do not echo the full content back — the chat already shows it.
