# core-pull — PHASE 4: Teammate Deep Analysis

Loaded from PHASE 2e when `has_teammate_commits = true`. This phase enriches project.json and project-context.json with context from code you didn't write. For a full codebase scan (first time joining): use `/core-setup`.

**Inputs** (from earlier phases): teammate commit list + merge commits (PHASE 2e), `$PRE_REF`, `GIT_USER`, route file contents cached in PHASE 3b, `--no-learn` flag state.

**4a) Determine scope**

Analyze only files changed by teammate commits. For each teammate commit, get changed files:

```bash
git diff-tree --no-commit-id -r --name-status $COMMIT_HASH
```

**4b) Group commits into candidate features**

Group teammate commits into features using these heuristics (priority order):

1. **Merge commit message** — if matches `Merge.*feature/(.+)` or `Merge.*branch '(.+)'` → feature name from branch. Associate all commits between this merge and the previous merge with this feature.
2. **Fallback** — group remaining (unmatched) commits by primary affected directory (e.g., commits touching `src/services/auth/` → component `auth`)

For each candidate feature, collect: name (kebab-case), author (git name), files (path + A/M/D status), summary (from commit messages).

**4c) Categorize files for deep analysis**

Across all in-scope files, categorize:

| Category     | Match pattern                                                          | Extracts                  |
| ------------ | ---------------------------------------------------------------------- | ------------------------- |
| **Models**   | `**/models/*.{js,ts,py}`, `**/schema*.{js,ts}`, `*.prisma`             | `data.entities`           |
| **Routes**   | `**/routes/*.{js,ts}`, `app/**/page.*`, `app/**/route.*`, `pages/**/*` | `endpoints`               |
| **Services** | `**/services/**/*`, `**/lib/**/*`, `**/utils/**/*`                     | `architecture.components` |
| **Tests**    | `**/test/**/*`, `**/tests/**/*`, `**/*.test.*`, `**/*.spec.*`          | `architecture.components` |

**4d) Extract entities from models**

For each model file (added or modified), read source and extract:

| Stack             | Detection                                                                                                                                                                                                 |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Mongoose          | `new Schema({...})` or `mongoose.model('Name', ...)` → fields + types                                                                                                                                     |
| Prisma            | `model Name { ... }` blocks → fields + relations                                                                                                                                                          |
| Sequelize         | `define('Name', { ... })` → fields + types                                                                                                                                                                |
| Django            | `class Name(models.Model)` → fields                                                                                                                                                                       |
| GDScript Resource | `class_name` + `@export` vars → properties                                                                                                                                                                |
| Sanity            | `defineType({ name, fields: [...] })` in `**/sanity/schemas/**/*.{ts,js}` → one entity per `defineType`, `defineField({ name, type })` per field, `required` from `validation: (Rule) => Rule.required()` |

Output per entity: `{ name, source: "src/models/Track.js", fields: [{ name, type, required }], relations: [{ target, type }] }`

The `source` field tracks which file defines this entity — used by 4g to detect deletions.

**4e) Extract endpoints from routes**

Reuse route file contents cached in PHASE 3b if available. Only read additional route files that weren't covered by 3b (e.g., new files from teammate commits not yet in the working tree during 3b).

Detect stack from `project.json.stack.framework`:

| Stack                | Detection method                                                  |
| -------------------- | ----------------------------------------------------------------- |
| Express/Fastify      | Grep for `router.get\|post\|put\|delete\|patch` → method + path   |
| Next.js (App Router) | File path `app/**/page.*` → GET route, `app/**/route.*` → methods |
| Next.js (Pages)      | File path `pages/**/*` → GET route                                |
| Django               | `urlpatterns` + `path()` entries                                  |
| Godot                | Skip (no HTTP endpoints)                                          |

Output per endpoint: `{ method, path, description, status: "active" }`

**4f) Extract architecture components**

For each service/lib file, determine component name from directory structure (e.g., `src/services/auth/` → "Auth Service"). Map source files and corresponding test files.

Output: `{ component, src: [...], test: [...] }`

**4g) Detect deleted code → clean stale context**

For files with status `D` (deleted) in teammate commits:

1. **Entities**: if a model file was deleted, check `data.entities[]` — match on `source` field and remove entries whose source file no longer exists.
2. **Endpoints**: if a route file was deleted, check `endpoints[]` — remove entries from that route file.
3. **Architecture components**: if a source file was deleted, remove it from `architecture.components[].src` or `.test` arrays. Remove component entries with empty `src` arrays.
4. **Routing**: already handled by PHASE 3 (full overwrite of `context.routing`).

**4h) Sync to project files**

Follow `shared/SYNC.md` protocol. Re-read both files immediately before writing.

**project.json mutations:**

- **Features** — for each candidate feature:
  Check if exists by name. If new → push:

  ```json
  {
    "name": "feature-name",
    "status": "DONE",
    "summary": "...",
    "source": "sync",
    "author": "Teammate Name",
    "created": "2026-03-10"
  }
  ```

  If exists with `source` NOT `"sync"` → skip (user's own feature).
  If exists with `source: "sync"` → update summary if richer info available.

- **Entities** — merge per SYNC.md: check on name → new: push → existing: merge fields/relations. Remove entities from deleted model files (4g).

- **Endpoints** — merge per SYNC.md: check on method+path → new: push → existing: update. Remove endpoints from deleted route files (4g).

- **Packages** — if `package.json` was changed by teammates, diff for new dependencies:

  ```bash
  git diff $OLDEST_TEAMMATE_COMMIT..HEAD -- package.json
  ```

  Check on name → new: push `{ name, version, purpose: "dependency" }`.

**project-context.json mutations:**

- **Architecture components** — update `architecture.components[]` following component-first model from `shared/DASHBOARD.md`: check on component name → new: push with layer/status/src/test and `connects_to[]` as typed edges `{ to, type }` (`calls` | `reads` | `writes` | `depends_on`) → existing: merge src/test arrays (dedup), merge `connects_to[]` on `to+type` combination. Clean stale entries (4g).

**4i) Save sync state**

Write `.project/session/sync-state.json`:

```json
{ "lastSync": "2026-03-13T00:00:00Z" }
```

**4j) Learning extraction**

Skip entirely if `--no-learn` flag is set. Heuristics: see [shared/LEARNING-EXTRACTION.md](../../shared/LEARNING-EXTRACTION.md).

**4j.1) MVP — fix-commit pitfalls**

```bash
git log $PRE_REF..HEAD --grep='^fix\|^bugfix' --format='%H|%an|%s%n%b' --no-merges
```

Per commit: filter author ≠ self. Body ≥10 words OR contains root-cause keyword (`because|waardoor|caused|door|root cause|reason|reden|oorzaak`). Skip bare `fix: typo`. Output `{ type: "pitfall", source: "synced", author, feature: <primary-dir>, summary: <subject without prefix> — <body sample> }`.

**4j.2) MVP — TODO/FIXME comments**

For each teammate-changed file (from PHASE 4a):

```bash
grep -nE '(TODO|FIXME|HACK|XXX|NOTE):' <file>
git blame --porcelain -L <line>,<line> <file>
```

Filter: ≥10 words body, contains verb clue (`breaks|fails|causes|veroorzaakt|kapot|werkt niet|moet|should|hangs|blocks|crashes|leaks`). Skip generic patterns (`TODO: implement`, `FIXME: fix this`). Author from `git blame` ≠ self. Output `{ type: "pitfall", source: "synced", author, feature: <dir-segment>, summary: <comment body, ≤200 chars> }`.

**4j.3) MVP — new abstraction dirs**

Compare component list from PHASE 4f against existing `architecture.components[]`. For new entries: match directory keyword against mapping table in `LEARNING-EXTRACTION.md`. Output `{ type: "pattern", source: "synced", author, feature: <dir>, summary: "<Pattern label> introduced in <path> (<N> files)" }`.

**4j.4) MVP — wrapper deps**

Reuse package.json diff from PHASE 4h. For each new dep: lookup in wrapper mapping table (zod, pino, axios, prisma, etc). No match → skip. Output `{ type: "pattern", source: "synced", author, feature: "stack", summary: "<Pattern label>" }`.

**4j.5) Signal detection + LLM extraction**

Determine signal:

```
1. Group teammate-changed files per top-level component directory (first 2 segments)
2. Trigger if: one directory ≥10 files (status A/M), OR new top-level directory (all status A)
3. No trigger → skip 4j.5
```

On trigger: call `learning-extractor` agent via Agent tool:

- `subagent_type: "learning-extractor"`
- prompt contains: `mode: "pull-signal"`, `files: [<triggered paths>]`, `existing_learnings: <current learnings[]>`, `cap: 5`

Parse JSON output. For each entry: set `source: "synced"`, `author: null` (codebase-wide), `feature: <triggered dir>`, and keep the agent's `tags` (0–3 from `LEARNING-WRITE.md § Tag Vocabulary`; default `[]`). Append to extraction results.

**4j.6) Dedup and sync**

Read `project-context.json` (re-read immediately before write per SYNC.md). For each new entry from 4j.1-4j.5:

- Exact dedup key: `(type, normalize(summary), author ?? null)`. Normalize = lowercase + strip punctuation. Match → skip.
- Jaccard dedup (second layer): tokenize candidate.summary via `shared/LEARNING-WRITE.md` Dedup Tokenizer. For each existing learning in `learnings[]` with the same `type`: `Jaccard(candidate.tokens, existing.tokens) >= 0.55` → skip.
- Intra-run Jaccard: same check but against other entries in this run (same `type`, Jaccard ≥ 0.55) → skip.
- Cap total new entries per run at **20**. On overflow: prefer pitfalls over patterns over observations, then most recent date.

Add surviving entries to `learnings[]`. Write `project-context.json` back.

Track counts for PHASE 5 report: `{ patterns: P, pitfalls: Q, observations: R, by_authors: [...] }`.

**4j.7) Consolidation**

Run the consolidation gate per `shared/LEARNING-WRITE.md § Consolidation Gate` — that section owns the trigger; empty output is the normal no-op, not a broken script. Fold its write into the same `learnings[]`/archive write as 4j.6/4j.8.

**4j.8) Opportunistic tag backfill**

Older projects predate the `tags[]` field. When any active entry lacks `tags`, run:

```bash
node ~/.claude/scripts/learnings-search.js "$REPO" suggest-tags
```

It emits JSON `[{index, date, feature, summary, suggested: [...]}]` (read-only — no writes). Review each suggestion, drop wrong ones (the aliases are heuristic), and merge the accepted tags into those `learnings[]` entries in the **same single write** as 4j.6/4j.7 (do not re-read/re-write the file separately). Suggestions are best-effort: leave an entry untagged rather than attach a wrong tag. Add to the PHASE 5 report: `Tags backfilled: {K} entries`. Skip silently when every entry is already tagged or `suggest-tags` returns `[]`.

When done: return to the skill's PHASE 5 (Report).
