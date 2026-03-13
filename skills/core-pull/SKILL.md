---
name: core-pull
description: Pull git changes, analyze diff, and sync .project/project.json context based on what actually changed. Use with /core-pull after team members push code.
disable-model-invocation: true
metadata:
  author: mileszeilstra
  version: 2.0.0
  category: core
---

# Pull

Pull remote changes, analyseer de diff, en ververs `.project/project.json` context gericht op basis van wat daadwerkelijk veranderd is.

**Trigger**: `/core-pull` of `/core-pull [remote/branch]`

## Process

### FASE 0: Pre-flight

1. Check git status:

   ```bash
   git status --porcelain
   ```

   Als dirty → **AskUserQuestion**:
   - header: "Uncommitted"
   - question: "Er zijn uncommitted changes. Wat wil je doen?"
   - options:
     - "Stash (Recommended)" — "Stash changes, pull, dan re-apply"
     - "Commit eerst" — "Commit huidige changes voordat je pullt"
     - "Annuleren" — "Stop, ik fix dit zelf"
   - multiSelect: false

   Bij "Stash": `git stash push -m "core-pull auto-stash"`. Na succesvolle pull in FASE 1: `git stash pop`. Bij conflict na pop → meld en laat user resolven.
   Bij "Commit eerst" → exit met instructie om `/core-commit` te runnen en daarna `/core-pull`.
   Bij "Annuleren" → exit.

2. Check remote:

   ```bash
   git remote -v
   git fetch 2>&1
   ```

   Als geen remote of fetch faalt → exit met error.

3. Check `.project/project-context.json` existence → onthoud als `has_context_json`. Fallback: check `.project/project.json` → onthoud als `has_project_json`.

### FASE 1: Pull

Bewaar pre-pull ref:

```bash
PRE_REF=$(git rev-parse HEAD)
```

Pull:

```bash
git pull --rebase
```

Als conflicts → toon conflicting files, exit met instructie om conflicts te resolven en daarna `/core-pull` opnieuw te runnen.

**Bepaal of we doorgaan:**

- Pull had nieuwe commits → door naar FASE 2
- "Already up to date" EN (`has_context_json` OF `has_project_json`) = true → door naar FASE 2 met `force_full_scan = true` (context kan stale zijn)
- "Already up to date" EN geen van beide bestaan → exit:
  ```
  ALREADY UP TO DATE (no project-context.json or project.json — run /core-setup to initialize)
  ```

Als gestasht in FASE 0: `git stash pop`. Bij conflict → meld en exit.

### FASE 2: Diff Analysis

**Doel:** toon wat er veranderd is en bepaal welke context-secties een update nodig hebben.

**2a) Commits overzicht**

```bash
git log $PRE_REF..HEAD --oneline
```

Als geen commits (already up to date) → sla 2a/2b/2c over, ga naar 2d.

**2b) Changed files overzicht**

```bash
git diff $PRE_REF..HEAD --stat
git diff $PRE_REF..HEAD --name-status
```

Toon samenvatting aan de user:

```
PULL COMPLETE

Branch:  {branch} ← {remote/branch}
Commits: {N} new

  {hash} {message}
  {hash} {message}

Files: {N} changed ({added} added, {modified} modified, {deleted} deleted)
```

**2c) Categoriseer changed files**

Lees de `--name-status` output en categoriseer elk bestand:

| Categorie      | Match                                                                                                         | Impact              |
| -------------- | ------------------------------------------------------------------------------------------------------------- | ------------------- |
| **Structural** | Files met status A (added), D (deleted), of R (renamed/moved)                                                 | `context.structure` |
| **Route**      | `app/**/page.{tsx,jsx,ts,js}`, `app/**/route.{ts,js}`, `pages/**/*.{tsx,jsx,ts,js}`, `*.tscn`                 | `context.routing`   |
| **Config**     | `tsconfig.json`, `vite.config.*`, `next.config.*`, `.env.example`, `.nvmrc`, `.node-version`, `project.godot` | `context.patterns`  |
| **Code-only**  | Overige modified files (status M, geen match met bovenstaande)                                                | Geen context impact |

Route file patterns zijn stack-afhankelijk. Lees `stack.framework` uit `project.json` om te bepalen welke patterns relevant zijn.

**2d) Impact bepaling**

```
needs_structure = structural_files.length > 0 OF force_full_scan
needs_routing   = route_files.length > 0 OF force_full_scan
needs_patterns  = config_files.length > 0 OF force_full_scan
```

**Fallback:** als `$PRE_REF` niet beschikbaar is (eerste pull, shallow clone) → `force_full_scan = true`.

### FASE 3: Context Sync

Skip volledig als noch `has_context_json` noch `has_project_json` = true. Toon:

```
SKIP CONTEXT SYNC (no project-context.json or project.json — run /core-setup to initialize)
```

Lees `.project/project-context.json`, parse JSON. Update `context` sectie gericht:

**3a) Structure scan** (alleen als `needs_structure`)

Scan de project root voor de file tree. Bouw een compacte structure string:

- Gebruik Glob tool voor directory discovery
- Exclude: node_modules, .git, .project, dist, build, .next, vendor, **pycache**, .godot
- Eén-regel comments per directory die het doel beschrijft
- Formaat: zelfde als in `DASHBOARD.md` context.structure schema

Overwrite `context.structure` volledig.

**3b) Route detection** (alleen als `needs_routing`)

Detect stack uit `project.json.stack.framework`.

| Stack                | Detectie methode                                             |
| -------------------- | ------------------------------------------------------------ |
| Next.js (App Router) | Scan `app/**/page.{tsx,jsx,ts,js}` → extract route patterns  |
| Next.js (Pages)      | Scan `pages/**/*.{tsx,jsx,ts,js}` → extract route patterns   |
| Express/Fastify      | Grep voor `router.get\|post\|put\|delete\|app.get\|app.post` |
| Godot                | Scan `*.tscn` scene files → extract scene tree               |
| Overig               | Skip routing, set `context.routing = []`                     |

Route formaat: `"/path" → Description` (arrow notation).

Overwrite `context.routing` volledig.

**3c) Pattern auto-detect** (alleen als `needs_patterns`)

Scan voor automatisch detecteerbare patterns:

| Bron                                      | Pattern                                 |
| ----------------------------------------- | --------------------------------------- |
| `tsconfig.json` → `compilerOptions.paths` | Path alias: `@/* → src/*`               |
| `vite.config.*` → `resolve.alias`         | Path alias: `@/ → src/`                 |
| `.env.example` exists                     | Env setup: copy `.env.example` → `.env` |
| `project.godot` → `[autoload]`            | Autoload: `{name} → {path}` per entry   |
| `.nvmrc` / `.node-version` exists         | Node version: `{version}`               |

**Merge** met bestaande `context.patterns`:

- Auto-detected patterns (prefix: "Path alias:", "Env setup:", "Autoload:", "Node version:"): overwrite
- Handmatige patterns (zonder deze prefixes): behouden

**3d) Update timestamp**

Set `context.updated` naar huidige datum (`YYYY-MM-DD`). Doe dit altijd, ook als alleen code-only changes.

Write `project-context.json` terug met `JSON.stringify(data, null, 2)`.

### FASE 4: Report

**Normaal (met commits + context sync):**

```
PULL & SYNC COMPLETE

Branch:  {branch} ← {remote/branch}
Commits: {N} new
Files:   {N} changed

Context:
  Structure: refreshed | skipped (no structural changes)
  Routing:   {N} routes | skipped (no route changes)
  Patterns:  {N} auto, {M} manual | skipped (no config changes)
  Updated:   {date}
```

**Already up to date, context was stale:**

```
CONTEXT REFRESHED (no new commits, stale context updated)

  Structure: refreshed | up to date
  Routing:   {N} routes | up to date
  Patterns:  {N} auto, {M} manual | up to date
  Updated:   {date}
```

**Geen project.json:**

```
PULL COMPLETE (no project-context.json or project.json — run /core-setup to initialize)

Commits: {N} new
Files:   {N} changed
```
