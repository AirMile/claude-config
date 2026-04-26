---
name: core-export
description: Export the project (whole repo, branch diff, recent commits, or a subfolder) as a single AI-friendly file via npx repomix for sharing with external AI tools or collaborators. Use with /core-export or /core-export [path]. Asks for scope, format, compression, and output destination, then writes to .project/exports/ with token count. Respects .gitignore and runs Secretlint scanning.
argument-hint: "[path]"
disable-model-invocation: true
metadata:
  author: mileszeilstra
  version: 1.1.0
  category: core
---

# Export

Export the project as a single AI-friendly file via `npx repomix@latest` for sharing with external AI tools (web Claude.ai, ChatGPT) or collaborators.

## Trigger

`/core-export` or `/core-export [path]`

If `[path]` is provided, scope is locked to that folder.

## Process

### FASE 0: Pre-flight

Run in parallel:

- `git rev-parse --show-toplevel` — confirm git repo
- `command -v npx` — confirm npx available
- Check for `repomix.config.json` at repo root
- Check `.project/exports/` exists (create if missing)
- Check `.project/exports/` is in `.gitignore`

**Stop conditions:**

- Not in a git repo → "Run inside a git repository"
- `npx` not found → "Install Node.js to use npx"

**If `repomix.config.json` exists:**

Mention that the project has a custom config and it will be respected. Skip the format/compression questions (config wins) but still ask for scope and output destination.

**If `.project/exports/` is not gitignored:**

Suggest adding the entry via AskUserQuestion:

- header: "Gitignore"
- question: ".project/exports/ staat niet in .gitignore. Toevoegen?"
- options:
  - label: "Ja, toevoegen (Recommended)", description: "Voorkomt dat exports per ongeluk gecommit worden"
  - label: "Nee, overslaan", description: "Laat .gitignore ongewijzigd"

If accepted, append `.project/exports/` to `.gitignore`.

### FASE 1: Resolve Scope

If `[path]` argument provided: skip the scope question, scope = that folder.

Otherwise, ask via AskUserQuestion:

- header: "Scope"
- question: "Wat wil je exporteren?"
- options:
  - label: "Hele repo (Recommended)", description: "Alle bestanden, respecteert .gitignore"
  - label: "Branch diff", description: "Alleen bestanden gewijzigd vs main/master — voor PR review of branch handoff"
  - label: "Recente commits", description: "Bestanden uit de laatste N commits — vraagt om N"
  - label: "Submap", description: "Specifieke folder — vraagt om pad"
- multiSelect: false

**Resolve scope to a file list (when not whole repo):**

- **Branch diff:** detect base branch (`main` or `master` via `git symbolic-ref refs/remotes/origin/HEAD` with fallback). Run `git diff --name-only <base>...HEAD`. If empty → "No changes vs <base>", stop.
- **Recente commits:** ask N (default 5). Run `git diff --name-only HEAD~N..HEAD`. If empty → stop.
- **Submap:** prompt for path. Verify it exists and is inside the repo.

For diff/commits modes, capture the file list and pass to repomix via `--include` (comma-separated patterns). For submap mode, pass the path as positional scope argument.

### FASE 2: Gather Inputs

Use a single AskUserQuestion call with multiple questions. **Skip format and compression questions if `repomix.config.json` exists.**

**Question 1 — Format:**

- header: "Format"
- question: "Welk output format?"
- options:
  - label: "XML (Recommended)", description: "Beste begrip door AI tools, default van repomix"
  - label: "Markdown", description: "Mens-leesbaar, goed voor PR descriptions of docs"
  - label: "JSON", description: "Programmatisch verwerkbaar"
  - label: "Plain text", description: "Simpele platte tekst"
- multiSelect: false

**Question 2 — Compression:**

- header: "Compress"
- question: "Tree-sitter compression toepassen?"
- options:
  - label: "Uit (Recommended)", description: "Volledige bestandsinhoud meenemen"
  - label: "Aan", description: "Alleen signatures/structuur extraheren — ~70% minder tokens, voor structurele overzichten"
- multiSelect: false

**Question 3 — Output destination:**

- header: "Output"
- question: "Waar moet de output heen?"
- options:
  - label: "Bestand (Recommended)", description: "Schrijf naar .project/exports/repomix-<scope>-<timestamp>.<ext>"
  - label: "Clipboard", description: "Direct op het clipboard zetten (macOS pbcopy / Windows clip)"
- multiSelect: false

### FASE 3: Build Command

Compose the repomix invocation.

**Base command:**

```bash
npx repomix@latest [scope-path] --style <format> [--compress] [--include <patterns>]
```

Argument matrix:

| Scope           | Positional path | `--include`                   |
| --------------- | --------------- | ----------------------------- |
| Whole repo      | `.`             | —                             |
| Submap          | `<folder>`      | —                             |
| Branch diff     | `.`             | comma-separated changed paths |
| Recente commits | `.`             | comma-separated changed paths |

**Output filename** (when destination = file):

```
.project/exports/repomix-<scope-tag>-<YYYYMMDD-HHmm>.<ext>
```

Where:

- `<scope-tag>` examples:
  - whole repo → branch name (sanitized: `/` → `-`)
  - branch diff → `diff-<branch>`
  - recente commits → `last<N>`
  - submap → folder name with `/` → `-`
- `<ext>` — `xml` | `md` | `json` | `txt`

Pass `--output <path>` to repomix.

**Clipboard path** (when destination = clipboard):

Write to a temp file, then pipe to platform clipboard tool:

```bash
# macOS
cat <tmpfile> | pbcopy

# Windows
type <tmpfile> | clip
```

Detect platform via `uname` (Darwin / Linux) or `$OS` (Windows_NT).

**Format → extension mapping:**

| Format   | --style  | Extension |
| -------- | -------- | --------- |
| XML      | xml      | xml       |
| Markdown | markdown | md        |
| JSON     | json     | json      |
| Plain    | plain    | txt       |

### FASE 4: Execute

Run the composed command. Repomix prints progress and a summary including token count and file count.

If repomix flags potential secrets (Secretlint hits), surface those warnings prominently — do not silently ignore them.

### FASE 5: Report

Print a summary table:

```
| Metric        | Value                                    |
| ------------- | ---------------------------------------- |
| Scope         | branch diff vs main                      |
| Output        | .project/exports/repomix-diff-feat-x-... |
| Format        | xml                                      |
| Compression   | off                                      |
| Files packed  | 142                                      |
| Total tokens  | 38,420                                   |
| File size     | 412 KB                                   |
| Secret hits   | 0                                        |
```

Pull the file count, token count, and secret hits from repomix's stdout — do not invent numbers.

**On clipboard destination:**

```
✅ Copied to clipboard
   Tokens: 38,420   Size: 412 KB
```

**On file destination:**

```
✅ Exported 142 files → .project/exports/repomix-diff-feat-x-202604251530.xml
   Tokens: 38,420   Size: 412 KB
```

**Suggest follow-ups (only when relevant):**

- If no `repomix.config.json` and the user runs this skill repeatedly: suggest creating one for persistent settings
- If secret hits > 0: warn explicitly, recommend reviewing before sharing externally

## Notes

- Uses `npx repomix@latest` so no global install required (cached after first run)
- Respects `.gitignore`, `.repomixignore`, and any `repomix.config.json`
- Secretlint runs automatically — flags `.env`-like content, API keys, tokens
- For persistent project-specific config (excluded paths, default format), create `repomix.config.json` in the repo root — repomix picks it up automatically on subsequent runs
- Branch diff mode is ideal for PR review handoff: share exactly what changed, nothing more
