---
name: core-md-revise
description: >-
  Change-aware CLAUDE.md sync. Detects codebase changes via git and proposes
  CLAUDE.md updates. Use with /core-md-revise or when user says "sync CLAUDE.md",
  "update project memory", or "catch up with team changes".
metadata:
  author: mileszeilstra
  version: 2.0.0
  category: core
disable-model-invocation: true
---

# CLAUDE.md Revise

Change-aware sync between the codebase and CLAUDE.md. Detects what changed (your session, team commits, or a timeframe) and proposes targeted updates following the canonical CLAUDE.md structure and audit quality guidelines.

## Trigger

`/core-md-revise`

## Process

### 0. Scope Selection

Use **AskUserQuestion**:

- header: "Sync scope"
- question: "Wat wil je syncen naar CLAUDE.md?"
- options:
  - label: "Mijn wijzigingen (Recommended)", description: "Uncommitted changes + mijn commits sinds laatste CLAUDE.md update"
  - label: "Team wijzigingen", description: "Commits van andere authors sinds laatste CLAUDE.md update"
  - label: "Alles sinds...", description: "Alle commits in een tijdsperiode (vraagt om periode)"
- multiSelect: false

**If "Alles sinds..."** → follow up with plain text question: "Sinds wanneer? (bijv. '3 days', '1 week', '2025-02-01')"

**Not needed after:** `/dev-build` (has auto-sync), `/dev-refactor` (has conditional sync), `/core-setup` (generates CLAUDE.md).

## Process

### 1. Detect Changes

Based on scope selection from Step 0:

**"Mijn wijzigingen":** Uncommitted changes + own commits since last CLAUDE.md modification.

```bash
git log -1 --format="%aI" -- CLAUDE.md
git log --oneline --author="$(git config user.email)" --since="$(git log -1 --format='%aI' -- CLAUDE.md)" --name-only
git diff --name-only
git diff --name-only --staged
```

**"Team wijzigingen":** Only commits by other authors since last CLAUDE.md modification.

```bash
ME=$(git config user.email)
git log --oneline --invert-grep --author="$ME" --since="$(git log -1 --format='%aI' -- CLAUDE.md)" --name-only
```

**"Alles sinds...":** All commits in the given timeframe.

```bash
git log --oneline --since="{user-provided timeframe}" --name-only
```

**Output:**

```
CHANGES DETECTED

Source: {default | team | since "X"}
Period: {last CLAUDE.md edit} → now
Commits: {N}
Files changed: {N}

Changed areas:
- src/components/ ({N} files)
- src/hooks/ ({N} files)
- src/pages/ ({N} files)
- api/ ({N} files)
```

**If no changes detected** → exit: "No changes found since last CLAUDE.md update."

### 2. Load & Compare

1. Read current `CLAUDE.md`
2. Read changed files (or their directory structure if many)
3. Compare against each canonical section:

   | Target                               | What to check                                                       |
   | ------------------------------------ | ------------------------------------------------------------------- |
   | CLAUDE.md `## Commands`              | New scripts in package.json? Changed build commands?                |
   | CLAUDE.md `## Project` / `### Stack` | New dependencies added? Libraries changed?                          |
   | project.json `context.structure`     | New directories/files? Moved/renamed files? Deleted directories?    |
   | project.json `context.routing`       | New routes? Changed route patterns?                                 |
   | project.json `context.patterns`      | New patterns visible in changed code? Gotchas from session context? |

4. Also check session context (conversation history) for:
   - Gotchas or workarounds discovered during debugging
   - Commands that were needed but not documented
   - Configuration quirks encountered

### 3. Propose Updates

Show each proposed change with context:

````
PROPOSED UPDATES ({N})

1. project.json context.structure — add new directories
   Reason: src/utils/ and src/types/ were added by team

   ```diff
    src/
      components/
   +  utils/          # Shared utility functions
   +  types/          # TypeScript type definitions
      hooks/
````

2. project.json context.patterns — add new gotcha

   Reason: discovered during debugging session

   ```diff
   +- **API timeout**: Vercel serverless functions have 10s timeout on hobby plan. Long operations need background jobs
   ```

3. ## Commands — update build command

   Reason: build script changed in package.json

   ```diff
   -npm run build    # tsc -b && vite build
   +npm run build    # vite build (tsc check removed)
   ```

```

**Quality rules** — follow core-md-audit guidelines:
- Only project-specific, non-obvious information
- One line per item, concise
- No generic best practices or obvious info
- No one-off fixes that won't recur
- Each line must earn its place in the context window
- Verify file paths are accurate before proposing

### 4. Apply with Approval

Use **AskUserQuestion**:
- header: "CLAUDE.md Sync"
- question: "{N} updates voorgesteld. Toepassen?"
- options:
  - label: "Alles toepassen (Recommended)", description: "Alle {N} updates"
  - label: "Per stuk kiezen", description: "Goedkeuren per update"
  - label: "Annuleren", description: "Geen wijzigingen"
- multiSelect: false

**If "Per stuk kiezen"** → show each update individually with accept/skip options.

Apply approved changes with Edit tool. Target the correct canonical sections.

### 5. Report

```

CLAUDE.md SYNCED

Applied: {N} updates
Sections touched: {list}
Skipped: {N} (if any)

Source: {default | team | since "X"}

```

## Canonical Sections Reference

These are the standard CLAUDE.md section names. Always target the correct section when updating:

**CLAUDE.md sections:**
1. `## Commands` — build/dev/lint/test commands
2. `## Project` / `### Stack` — project metadata and tech stack
3. `## Project Context` — reference to `.project/project.json`

**project.json context keys** (zie `shared/DASHBOARD.md`):
4. `context.structure` — directory tree with comments
5. `context.routing` — route patterns (web projects)
6. `context.patterns` — gotchas, quirks, non-obvious architecture decisions

For CLAUDE.md sections (1-3), propose Edit tool changes. For project.json context (4-6), propose JSON updates to `.project/project.json`.

## Edge Cases

### No CLAUDE.md exists
Suggest running `/core-setup` first. Do not generate a full CLAUDE.md — that's setup's job.

### CLAUDE.md uses non-canonical structure
If the existing CLAUDE.md doesn't follow canonical section names (e.g., `## Tech stack` instead of `## Project` / `### Stack`), work with the existing structure. Do not restructure — that's `/core-md-audit`'s job.

### Large number of changes
If >20 files changed, group by directory and focus on structural changes. Don't propose an update for every single file — focus on what impacts CLAUDE.md sections.

### Merge conflicts in CLAUDE.md
If CLAUDE.md has merge conflict markers, resolve them first before proposing updates. Flag this to the user.
```
