# Learnings Load Protocol

Shared protocol for loading learnings as context in architectural skills. Skills reference this instead of duplicating their own filter logic.

> **Schema**: `learnings[]` in `project-context.json`. Fields: `date`, `feature`, `type`, `source`, `author?`, `summary`. See [DASHBOARD.md](DASHBOARD.md).

---

## When to load

Skills load learnings during their **context-load phase** (typically PHASE 0 or an early PHASE where architecture context is being built).

**Why a script and not an inline read:** `learnings[]` is append-only and grows with the project — at 500 entries a full inline read costs ~43k tokens per skill run while at most 10–15 entries are ever shown. `scripts/learnings-search.js` scores and filters in-process and prints only the matching entries, so context cost scales with what is _shown_, not with what is _stored_. It selects by **relevance** (tag → feature → keyword overlap), with recency only as a tiebreak — so an old-but-relevant entry is no longer buried by newer noise, and the consolidation archive stays reachable (see § Relevance model).

## Three scopes

Each skill specifies one or more scopes. No wildcards — choose explicitly. The scope maps 1:1 to a `--scope` in `learnings-search.js`.

- **`component`** — learnings relevant to the current feature/component: scored on feature-name match, shared tags, and summary-keyword overlap; **includes the archive** as a damped tier so a strongly-matching old entry resurfaces. Capped at 10. _Used by_: `dev-ship`, `design-convert`; `project-brainstorm` / `project-critique` (feature/page scope, via `INPUT-PARSING.md § Project Memory Load`).
- **`architectural`** — `type === "pattern"` with source `synced`, `extracted`, or `consolidated` (exclude `inferred` — too broad for architecture choices). Active list only. With feature/query context relevant patterns float up; otherwise date-ordered. Capped at 15. _Used by_: `project-plan`; `project-seed` / `project-brainstorm` / `project-critique` (via `INPUT-PARSING.md § Project Memory Load`).
- **`pitfall-prefix`** — pitfalls scored against the current feature (archive included); with no feature context or no relevant hit it falls back to the **last 5 pitfalls** by date. Default-on prefix for every skill that uses this loader; disable with `pitfall-prefix: false`.

## Load command

**Prerequisites**: `$REPO` (project root — the **main** worktree, see edge cases below), `$FEAT` (kebab-case feature name, or empty for non-feature skills), `$SCOPES` (comma-separated: `component,architectural`).

```bash
node ~/.claude/scripts/learnings-search.js "$REPO" load \
  --feature "$FEAT" --scopes "$SCOPES" --pitfall-prefix true
```

One process runs the pitfall-prefix, `component`, and `architectural` scopes in the order above and prints the whole `LEARNINGS CONTEXT` block (or nothing when there are no matches). Pass `--pitfall-prefix false` to drop the pitfall block. Empty output = no matches; show nothing (no "0 entries" lines). The script never writes and exits 0 even when `project-context.json` is absent.

## Relevance model

`scoreEntry()` in `learnings-search.js` is the single relevance function:

- **+4** per shared tag (entry `tags[]` ∩ tags implied by the feature/query — see `LEARNING-EXTRACTION.md § Tag Vocabulary`)
- **+2** feature-name match (bidirectional substring)
- **+1** per summary keyword overlap (same tokenizer as dedup), capped at 5
- **recency**: a sub-point tiebreak (`< 1`), so relevance always outranks date
- **archive entries**: score damped ×0.7 and gated — they surface only on a tag match or a strong textual score, never on recency alone

Entries without `tags[]` still score on feature + keyword overlap, so the loader is fully backwards-compatible with pre-tag projects.

## Output format

The script prints the ASCII block directly — include it verbatim in the skill's context output:

```
LEARNINGS CONTEXT

Project pitfalls (relevant / recent):
  [2026-04-20] auth-login — JWT refresh race condition bij parallel requests  #auth #async
  [2025-01-10] auth-oauth — OAuth state param must be validated on callback  #auth #security (archived)

Component-scoped (auth):
  [2026-04-15] auth — JWT via httpOnly cookie rotation  #auth

Architectural patterns (project-wide):
  [2026-04-20] core — Repository pattern in src/repositories/ (12 files)  #data-model
```

Each line is `  [date] feature — summary  #tags (archived)`; `#tags` appears only when the entry has them and `(archived)` only for consolidation-archive hits. Empty sections (no matches) are omitted by the script.

---

## Skill-specific configuration

Each skill specifies in its SKILL.md:

```
Load learnings via shared/LEARNINGS-LOAD.md:
- scopes: [component, architectural]
- pitfall-prefix: true
- current-feature: <kebab-case name, or "none" for non-feature skills>
```

`pitfall-prefix` defaults to `true` — only explicitly disable if the skill genuinely does not need pitfall context.

---

## Edge cases

- **No `project-context.json`**: script exits 0 silently — no output, skip all scopes.
- **Empty `learnings[]`**: script exits 0 silently.
- **No `current-feature` specified**: `component` scope produces nothing; the pitfall-prefix falls back to the last 5 by date; `architectural` falls back to date order.
- **Worktree-aware**: point `$REPO` at the main worktree (per [SYNC.md](SYNC.md) Worktree-aware Path Resolution) — the archive lives there, not in the feature worktree.
- **Archived learnings** (`.project/archive/learnings-*.json`, see [LEARNING-EXTRACTION.md](LEARNING-EXTRACTION.md) § Consolidation): loaded as a **damped on-demand tier** by the `component` and `pitfall` scopes — a strongly-relevant or tag-matching old entry resurfaces, but archive never surfaces on recency alone. `architectural` never reads the archive (the consolidated successor is already in the active list).

---

## Implementation note

This is a **read-only** protocol. No mutations to `learnings[]` — that remains the responsibility of writer-skills (`dev-ship (verify phase)`, `dev-ship (refactor phase)` (PHASE 5), `core-pull`, `core-setup --mode=mature`). Consolidation/archiving of the learnings list itself happens in `core-pull` — see [LEARNING-EXTRACTION.md](LEARNING-EXTRACTION.md) § Consolidation.

Skills that pass learnings to an agent: run the script first and embed the filtered block in the agent prompt (never the full list).

For free-text interrogation across the whole memory (learnings + architecture + backlog + thinking), skills and users go through `/project-memory`, which calls `learnings-search.js search --json` under the hood.
