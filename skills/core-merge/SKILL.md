---
name: core-merge
description: Merge a feature worktree branch back to a target branch with optional push/PR creation and worktree cleanup. Use with /core-merge or /core-merge [feature-name]. Detects worktree state, offers squash/no-ff/PR-flow strategies, handles cleanup.
disable-model-invocation: true
argument-hint: "[feature-name]"
metadata:
  author: mileszeilstra
  version: 1.0.0
  category: core
---

# Merge

Integrate a finished feature branch (created via `EnterWorktree` in the build skill) back into the target branch. Supports PR-flow for OTAP/review setups and local merge (squash or `--no-ff`) for solo work. Handles worktree cleanup.

## Trigger

`/core-merge` of `/core-merge [feature-name]`

## When to Use

- Feature is `DONE` in backlog and lives on a `worktree-{feature}` branch
- You want to integrate the branch (PR, local merge, or push-only)
- You want to clean up the worktree after merging

Not for: regular commits (use `/core-commit`), pulling remote changes (use `/core-pull`), creating new branches.

## FASE 0: Pre-flight + State Detection

### Detect current state

Run in parallel:

```bash
git branch --show-current        # current branch name
git worktree list --porcelain    # all worktrees + branches
git status --porcelain           # uncommitted changes check
git rev-parse --show-toplevel    # current repo root
```

### Determine source branch and worktree path

Parse `git worktree list --porcelain` once. The first entry is always the main checkout — skip it. Remaining entries are candidate source worktrees, regardless of branch naming convention.

**If feature-name argument provided** (`/core-merge auth`):

- Search candidate entries for a match:
  - Branch == `worktree-auth` (build-skill default), OR
  - Branch == `auth` (manual `git worktree add` with same-name branch), OR
  - Path ends with `/auth` (manual worktree path-based match)
- Pick first match. If multiple matches → AskUserQuestion to disambiguate.
- Not found → fail: "Geen worktree gevonden voor 'auth'. Bestaande worktrees: {list}."

**If no argument and currently in a worktree** (current pwd != main_root):

- Source branch = current branch (any name, no pattern restriction)
- Source worktree path = current `git rev-parse --show-toplevel`

**If no argument and currently on main**:

- List all candidate worktrees from parsed output (already excluded main).
- Use AskUserQuestion to pick one:
  - header: "Worktree"
  - question: "Welke worktree wil je integreren?"
  - options: per worktree: `{branch} ({short path}, {N} commits ahead)`. Limit to 4 — if more, show top 4 by recency and add "Other" for free input.
- 0 candidates → exit: "Geen actieve worktrees gevonden."

### Validate state

Before proceeding:

- Source worktree must not have uncommitted changes:
  - Run `cd "{worktree_path}" && git status --porcelain`
  - If non-empty → AskUserQuestion: "Worktree heeft ongecommitteerde changes. Wat doen?"
    - "Stop, ik commit eerst (Recommended)" → exit
    - "Stash en doorgaan" → `cd "{worktree_path}" && git stash push -u`
    - "Negeer (gevaarlijk)" → continue, warn user

## FASE 0b: Already-merged Detection

After source branch is determined, check if it's already integrated:

1. Detect target candidates (same as FASE 1): `git branch -a` filtered on `main|master|develop|staging`
2. Per candidate: `git branch --merged {target} | grep -E "^[* ]+{source}$"` — branch is in `--merged` output?
3. If source-branch is merged in any target:
   - AskUserQuestion:
     - header: "Already merged"
     - question: "Branch `{source}` is al gemerged in `{merged_target}`. Wat nu?"
     - options:
       - "Cleanup only (Recommended)" — verwijder worktree + branch, geen nieuwe merge
       - "Cancel" — exit zonder actie
   - Cleanup only → skip FASE 1, FASE 2, FASE 3 en spring direct naar FASE 4 cleanup-prompt
     - Set `strategy = "cleanup-only"`, `merged_into = "{merged_target}"` voor FASE 5 rapport
4. Niet gemerged → check commits-ahead voor remaining targets:
   - `git log {target}..{source} --oneline | wc -l` — if 0 commits ahead op alle targets → "Niets te mergen.", exit
   - Else → continue normaal naar FASE 1

> **Caveat (rebase-workflow)**: `git branch --merged` herkent rebase-merged commits niet altijd. Bij rebase-flow kan deze check een false negative geven. Werkaround: handmatig `git worktree remove --force` + `git branch -D`.

## FASE 1: Target Branch Selection

Detect candidate targets:

```bash
git branch -a | grep -E '^[* ]+(main|master|develop|staging)$' | sed 's/^[* ]*//'
```

Use AskUserQuestion:

- header: "Target"
- question: "Naar welke branch mergen?"
- options: gevonden candidates (default first = `main` of `master`)

If no candidates found → ask user freeform via "Other".

## FASE 2: Strategy Selection

Detect `gh` availability:

```bash
command -v gh >/dev/null 2>&1 && gh auth status >/dev/null 2>&1
```

### Existing PR check (only if `gh` available)

Before showing strategy options, check whether a PR already exists for this branch:

```bash
gh pr list --head {source-branch} --state all --json number,url,state --limit 1
```

If a PR exists:

- **state == "OPEN"**:
  - AskUserQuestion:
    - header: "Existing PR"
    - question: "PR #{n} bestaat al ({url}). Wat doen?"
    - options:
      - "Toon PR-URL en exit (Recommended)" — print URL, exit succesvol
      - "Update PR (push extra commits)" — `git push` op branch, geen nieuwe PR
      - "Force nieuwe PR" — `gh pr close {n} --comment "Replaced by new PR"`, dan normale PR-flow
      - "Cancel" — exit
- **state == "MERGED"**:
  - Auto-route naar cleanup-only path (zelfde als FASE 0b cleanup-only):
    - Set `strategy = "cleanup-only"`, `pr_url = {url}` voor FASE 5 rapport
    - Spring direct naar FASE 4 cleanup-prompt
- **state == "CLOSED"** (en niet merged):
  - AskUserQuestion: "PR #{n} is gesloten. Force nieuwe?"
    - "Ja, nieuwe PR aanmaken (Recommended)"
    - "Cancel" — exit

If no PR exists: continue to strategy options below.

### Strategy options

Build options list dynamically:

| Strategy                           | Show always                              |
| ---------------------------------- | ---------------------------------------- |
| Push + open PR via gh              | Only if `gh` installed AND authenticated |
| Squash-merge lokaal naar {target}  | Always                                   |
| Merge --no-ff lokaal naar {target} | Always                                   |
| Alleen push (geen PR/merge)        | Only if remote configured                |

AskUserQuestion:

- header: "Strategie"
- question: "Hoe wil je deze feature integreren?"
- options: dynamic list (first = "Push + open PR" if available, else "Squash-merge lokaal")
- multiSelect: false

## FASE 3: Execute

> **Cross-platform**: gebruik `cd "{worktree_path}" && git <cmd>` i.p.v. `git -C <path>`. Op Windows breekt `git -C` met paden die backslashes bevatten. Quote het pad altijd.

### Strategy: Push + open PR

1. If session is in a worktree → `ExitWorktree(action: "keep")`
2. From main checkout: `cd "{worktree_path}" && git push -u origin worktree-{feature}`
3. Build PR title from latest skill-commit subject:
   - Read `git log -1 --format=%s worktree-{feature}` → if matches `build({feature}): ...` → title = `feat({feature}): {feature description}`
   - Else → title = `feat({feature}): merge worktree-{feature}`
4. Build PR body from commit list:

   ```
   ## Summary
   - {commit subjects from worktree-{feature}, oldest to newest}

   ## Test plan
   - [ ] Review changes
   - [ ] CI passes
   ```

5. `gh pr create --base {target} --head worktree-{feature} --title "{title}" --body "{body}"`
6. Capture PR URL from output
7. Skip cleanup (PR must be reviewed first)

### Strategy: Squash-merge lokaal

1. If session is in a worktree → `ExitWorktree(action: "keep")`
2. Defensive checkout — als target alleen remote bestaat, maak een lokale tracking branch:
   ```bash
   git show-ref --verify --quiet "refs/heads/{target}" \
     && git checkout {target} \
     || (git fetch origin "{target}" && git checkout -B "{target}" "origin/{target}")
   ```
3. `git pull --rebase` (sync first; skip if no remote)
4. `git merge --squash worktree-{feature}`
5. Build commit message:
   - Subject: `feat({feature}): {summary}` — derive `{summary}` from latest `build({feature})` commit body or first paragraph of feature.json description if available
   - Body: list of squashed skill-commits as bullets
6. `git commit -m "{subject}\n\n{body}"`
7. → FASE 4 cleanup-prompt

### Strategy: Merge --no-ff

1. If session is in a worktree → `ExitWorktree(action: "keep")`
2. Defensive checkout (zelfde patroon als Squash-merge step 2):
   ```bash
   git show-ref --verify --quiet "refs/heads/{target}" \
     && git checkout {target} \
     || (git fetch origin "{target}" && git checkout -B "{target}" "origin/{target}")
   ```
3. `git pull --rebase` (skip if no remote)
4. `git merge --no-ff worktree-{feature} -m "Merge feature {feature}\n\n{commit subjects bullet list}"`
5. → FASE 4 cleanup-prompt

### Strategy: Push only

1. If session is in a worktree → `ExitWorktree(action: "keep")`
2. `cd "{worktree_path}" && git push -u origin worktree-{feature}`
3. Skip cleanup, output remote-tracking confirmation

## FASE 4: Cleanup (only after local merge)

Only run after Squash-merge or Merge --no-ff strategies. Skip after PR-flow and Push-only.

AskUserQuestion:

- header: "Cleanup"
- question: "Worktree opruimen?"
- options:
  - "Ja, remove worktree + delete branch (Recommended)" → execute cleanup
  - "Nee, behoud worktree" → skip cleanup, log path
- multiSelect: false

If cleanup chosen:

```bash
git worktree remove --force {worktree_path}
git branch -D worktree-{feature}
```

If branch was pushed to remote and merged via PR / local-merge:

- Detect remote tracking: `git config branch.worktree-{feature}.remote`
- If set → AskUserQuestion: "Ook remote branch verwijderen?"
  - "Ja" → `git push origin --delete worktree-{feature}`
  - "Nee" → skip

## FASE 5: Output Report

Generate ASCII table summary:

```
CORE-MERGE COMPLETE

Strategy:    {Push + PR | Squash-merge | Merge --no-ff | Push only | Cleanup only}
Source:      {source-branch}
Target:      {target}                                  (skip line voor Cleanup only zonder context)
Commits:     {N} commits integrated                    (skip line voor Cleanup only)
Result:      {merge SHA | PR URL | push ref | already merged in {target} | PR #{n} merged}
Worktree:    {removed | kept at {path}}
Branch:      {deleted | kept ({source-branch})}
```

For PR-flow, output PR URL prominently:

```
✅ PR opened: {url}

Next steps:
- Review and merge via GitHub
- Run /core-merge {feature} again after PR merge for cleanup
```

For local merges:

```
✅ Merged into {target}: {sha}

Next steps:
- Push {target} to remote: git push
- Worktree {removed | kept}
```

For cleanup-only:

```
✅ Cleanup complete: {source-branch} was already merged in {target}{ via PR #{n}}.

Next steps:
- Worktree {removed | kept}
- Branch {deleted | kept}
```

## Error Handling

### Source equals target

If source branch equals target branch (e.g. `/core-merge` triggered while on `main`):

- "Source en target zijn dezelfde branch ({target}). Niets te doen.", exit

### Uncommitted changes in worktree

Already handled in FASE 0 validate.

### `gh` not installed or not authenticated

PR-strategy verborgen in FASE 2. Geen error, gewoon andere opties.

### Merge conflicts

`git merge --squash` of `git merge --no-ff` faalt:

```
❌ Merge conflict in {N} bestanden:
  - {file1}
  - {file2}

Los handmatig op:
  1. Edit conflicts in working tree
  2. git add {resolved files}
  3. git commit (voor --no-ff) of git commit -m "feat({feature}): ..." (voor squash)
  4. /core-merge {feature} opnieuw voor cleanup
```

Exit, geen automatic retry. User moet conflicts oplossen.

### Push rejected

`git push` failed met "rejected" / "behind remote":

- AskUserQuestion: "Push rejected. Wat doen?"
  - "Pull --rebase eerst (Recommended)" → `git pull --rebase` then retry push
  - "Force push (gevaarlijk)" → confirm with second AskUserQuestion, then `git push --force-with-lease`
  - "Cancel" → exit

### `gh pr create` failure

If PR creation fails after successful push:

- Show error
- AskUserQuestion: "PR-creation gefaald. Wat doen?"
  - "Skip — branch is gepusht, maak PR handmatig" → exit met success op push
  - "Retry" → `gh pr create` opnieuw
  - "Cancel" → exit

## Output

**Success (PR):**

```
✅ PR opened: https://github.com/{owner}/{repo}/pull/{n}

   Strategy:  Push + PR
   Branch:    worktree-{feature} → {target}
   Commits:   {N}
```

**Success (local merge):**

```
✅ Merged: {sha} on {target}

   Strategy:  {Squash-merge | Merge --no-ff}
   Source:    {source-branch} ({N} commits)
   Worktree:  {removed | kept at {path}}
```

**Success (cleanup-only):**

```
✅ Cleanup complete: {source-branch} was already merged in {target}{ via PR #{n}}.

   Strategy:  Cleanup only
   Source:    {source-branch} (reason: {already merged in {target} | PR #{n} merged})
   Worktree:  {removed | kept at {path}}
   Branch:    {deleted | kept}
```

**Failure:**

```
❌ {operation} failed: {reden}

   💡 {suggestie}
```
