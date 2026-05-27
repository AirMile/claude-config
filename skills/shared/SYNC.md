# Project Sync Protocol

Shared sync pattern for skill completion. Skills reference this for the generic protocol and only specify their own mutations.

---

## Worktree-aware Path Resolution

Skills can run in a git worktree (parallel feature development). Because `.project/` is gitignored, it only exists in the main worktree.

### Detection (once per skill)

On the first `.project/` operation (read or write):

1. `git worktree list --porcelain | head -1` → extract path after `worktree ` → `{main_worktree}`
2. `git rev-parse --show-toplevel` → `{current}`
3. **Different** → in worktree. Use `{main_worktree}/.project/` for ALL `.project/` operations.
   Log: `WORKTREE: .project/ → {main_worktree}/.project/`
4. **Same** → not in worktree. Use `.project/` relative.

### Scope

- **`.project/`** (feature.json, backlog.html, project.json, session) → always main worktree
- **Source code** (implementation, tests) → local worktree (own branch)
- Run detection once, reuse the resolved path in all phases

---

## Sync Pattern

On skill completion, sync feature state to the relevant files:

### Step 1: Read (parallel, skip if not present)

Read **immediately before editing** — do NOT rely on reads from earlier phases (Prettier/linters may have modified files in between):

- `.project/features/{feature-name}/feature.json`
- `.project/backlog.html`
- `.project/project.json`
- `.project/project-context.json` (only if context/architecture/learnings changed — build/test/refactor skills)
- `.project/project-seed.md` (only if concept changed — thinking/plan skills)

### Step 2: Mutate in memory

**feature.json** — read-modify-write, preserve all existing sections. Skill adds/updates specific fields (see skill-specific mutations).

**backlog.html** (see `shared/BACKLOG.md`):

- Parse JSON from `<script id="backlog-data">`
- Find feature by name
- Update `status` to skill-specific value
- Set `data.updated` → current date
- Not found → add to `data.features`

**project.json** (see `shared/DASHBOARD.md`):

Merge per section — always check for existing entries before push:

| Section          | Merge logic                                                       |
| ---------------- | ----------------------------------------------------------------- |
| `features[]`     | Check by name → new: push → existing: update status               |
| `stack.packages` | Check by name → new: push `{ name, version, purpose }` → skip     |
| `endpoints`      | Check by method+path → new: push → existing: update status        |
| `data.entities`  | Check by name → new: push with fields/relations → existing: merge |

**project-context.json** (see `shared/DASHBOARD.md`):

Read `.project/project-context.json` (or create with `{}`). Merge per section:

| Section        | Merge logic                                                                                                                                                                                                                            |
| -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `context`      | Update structure/routing/patterns individually (only when impacted)                                                                                                                                                                    |
| `architecture` | Follow component-first model from `shared/DASHBOARD.md` (only when impacted). Update `components[]` (status, src, test). Merge `connects_to[]` on `to+type` combination (typed edges). Diagram optional → `.project/architecture.mmd`. |
| `learnings`    | Dedup-key: `(type, normalized_summary, author ?? null)`. Normalize summary = lowercase + strip punctuation. New: push with required `source` field → existing: skip (append-only). `author` only when `source === "synced"`.           |

**project-seed.md** (only for concept-writing skills):

Write the full concept document as plain markdown to `.project/project-seed.md`. Simultaneously update `seed.name` and `seed.pitch` in `project.json` (so lightweight readers have current metadata).

### Step 3: Write (parallel)

- Write `feature.json` (or targeted Edit if only specific fields change)
- Edit `backlog.html` (keep `<script>` tags intact)
- Write `project.json` (or targeted Edit)
- Write `project-context.json` (if context/architecture/learnings changed)

### Step 4: Restore skip-worktree

After writing `.project/` files, set skip-worktree on any new files:

```bash
git ls-files .project/ | xargs git update-index --skip-worktree 2>/dev/null
```

This prevents `.project/` changes from appearing in git status and interfering with pull/stash.

### Active Feature Cleanup

```bash
rm -f .project/session/active-{feature-name}.json
```

---

## Skill-specific mutations

Each skill describes in its own SKILL.md **only** what deviates from the standard protocol:

- Which `status` value for backlog and feature.json
- Which fields are added/updated in feature.json
- Which project.json sections are touched (endpoints, entities, architecture, etc.)
- Any extra files or steps

The generic read pattern, backlog-update format, merge logic, and write pattern do not need to be repeated.

## Frontend skills

Frontend skills follow the same sync protocol with the same stages as dev skills (`building/built/testing`). Difference: frontend items do not use `feature.json` — status is tracked only in backlog + `project.json` `features[]`.

| Skill              | Backlog mutation                              | project.json mutation                             |
| ------------------ | --------------------------------------------- | ------------------------------------------------- |
| `/frontend-design` | Creates batch PAGE TODOs                      | `design` (pages, flows, principles), `features[]` |
| `/frontend-design` | DOING + `building` → `built`                  | `stack.packages`, `design.pages`, `features[]`    |
| `/frontend-design` | DOING + `building` → `built` (Convert route)  | `features[]`                                      |
| `/frontend-check`  | `testing` → DONE                              | `features[]`                                      |
| `/frontend-check`  | A11Y scope: `testing` → DONE + new A11Y TODOs | `features[]`                                      |

Frontend items skip `defining/defined` — `/frontend-design` (capture-mode) creates items as TODO, and `/dev-build` picks them up directly as `building` after Claude Design handoff.
