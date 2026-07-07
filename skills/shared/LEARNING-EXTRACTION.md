# Learning Extraction Heuristics

Shared rules for extracting learnings from teammate code and mature codebases. Used by `/core-pull` (incremental, signal-triggered) and `/core-setup --mode=mature` (once, full scan).

> **Output schema**: all extractions produce entries for `project-context.json.learnings[]` with `source: "synced"` and optional `author`. See [shared/DASHBOARD.md](DASHBOARD.md) `learnings` section.

---

## MVP Signals (regex/AST, deterministic, 0 LLM tokens)

### 1. Pitfalls from fix-commits

**Detection:**

```bash
git log --grep='^fix\|^bugfix' --format='%H|%an|%s%n%b' $RANGE
```

`$RANGE` = `$PRE_REF..HEAD` in pull, `--since="6 months ago"` in onboard.

**Filter (cumulative):**

- Body not empty (skip bare `fix: typo`)
- Body ≥10 words, OR body contains root-cause keyword: `because|waardoor|caused|door|root cause|reason|reden|oorzaak`
- Skip if author === `git config user.name` (own work → already in feature.json)

**Output:**

```json
{
  "type": "pitfall",
  "source": "synced",
  "author": "{commit author}",
  "feature": "{primary directory from changed files}",
  "summary": "{commit subject without 'fix:' prefix} — {body summary max 200 chars}"
}
```

### 2. Pitfalls from code-comments

**Detection:**

```bash
grep -rn -E '(TODO|FIXME|HACK|XXX|NOTE):' {scope}
```

`{scope}` in pull: only teammate-changed files (filter via `git blame --porcelain` on author ≠ self).
`{scope}` in onboard: all source files (excl. node_modules, .git, .project, dist, build).

**Filter (cumulative):**

- ≥10 words in comment body
- Contains verb-clue: `breaks|fails|causes|veroorzaakt|kapot|werkt niet|moet|should|hangs|blocks|crashes|leaks|loses|loses`
- Reject generic patterns: `TODO: implement`, `FIXME: fix this`, `TODO: refactor`

**Output:**

```json
{
  "type": "pitfall",
  "source": "synced",
  "author": "{git blame line author}",
  "feature": "{file directory primary segment}",
  "summary": "{comment body, max 200 chars}"
}
```

### 3. Patterns from new abstraction-dirs

**Detection:** compare component list (from `core-pull/references/teammate-analysis.md` § 4f / `core-setup --mode=mature` PHASE 2) against existing `architecture.components[]` in `project-context.json`.

**Mapping table:**

| Directory keyword              | Pattern label             |
| ------------------------------ | ------------------------- |
| `repositories/`, `repository/` | Repository pattern        |
| `middleware/`, `middlewares/`  | Middleware pipeline       |
| `factories/`, `factory/`       | Factory pattern           |
| `decorators/`, `decorator/`    | Decorator pattern         |
| `interceptors/`                | Interceptor pattern       |
| `handlers/`                    | Handler/Command pattern   |
| `services/` (new)              | Service layer             |
| `usecases/`, `use-cases/`      | Use case / Clean Arch     |
| `domains/`, `domain/`          | Domain-driven design      |
| `events/`, `subscribers/`      | Event-driven architecture |

**Output (per new match):**

```json
{
  "type": "pattern",
  "source": "synced",
  "author": "{primary commit author who created the dir}",
  "feature": "{dir name}",
  "summary": "{Pattern label} introduced in {path} ({N} files)"
}
```

### 4. Patterns from new wrapper-deps

**Detection:**

```bash
git diff $RANGE -- package.json
```

Parse added entries in `dependencies` or `devDependencies`. Match against list:

| Package                                   | Pattern label                    |
| ----------------------------------------- | -------------------------------- |
| `zod`                                     | Schema validation via zod        |
| `yup`, `joi`                              | Schema validation                |
| `pino`                                    | Structured logging via pino      |
| `winston`                                 | Structured logging via winston   |
| `axios`                                   | HTTP client via axios            |
| `ky`, `got`                               | HTTP client                      |
| `tanstack-query`, `@tanstack/react-query` | Data fetching via TanStack Query |
| `swr`                                     | Data fetching via SWR            |
| `prisma`                                  | ORM via Prisma                   |
| `drizzle-orm`                             | ORM via Drizzle                  |
| `mongoose`                                | ODM via Mongoose                 |
| `zustand`                                 | Client state via Zustand         |
| `redux`, `@reduxjs/toolkit`               | Client state via Redux           |
| `vitest`, `jest`                          | Test runner                      |
| `playwright`                              | E2E testing via Playwright       |

No match → skip (no pattern emitted).

**Output:**

```json
{
  "type": "pattern",
  "source": "synced",
  "author": "{commit author who added the dep}",
  "feature": "stack",
  "summary": "{Pattern label}"
}
```

---

## Signal Detection (only `core-pull`)

Determines whether the LLM sub-agent should be invoked. **Convention-free**: no commit-title parsing, only file-system and git diff.

```
1. Parse `git diff $PRE_REF..HEAD --name-status`
2. Group changed files per top-level component-directory
   (first 2 segments: src/payments/, app/api/billing/, etc.)
3. Trigger if:
   - One directory ≥10 files changed (A/M, not D), OR
   - New top-level directory created (all files status=A)
4. No trigger → MVP only, done
5. Trigger → call `learning-extractor` agent on triggered files
```

Skip entirely if `--no-learn` flag is set.

---

## LLM Extraction Scope

Behavior of `learning-extractor` agent differs per skill:

### `core-pull` (signal-triggered)

- **Input**: list of paths of triggered files
- **Scope**: read only those files, no wider scan
- **Output**: 0-5 patterns/pitfalls
- **Cap**: max 5 entries

### `core-setup --mode=mature` (one-time, mature codebase)

- **Input**: representative files per component (5-10 per component, chosen based on: file size > 50 LOC, not test files, not generated)
- **Scope**: naming conventions + error handling style + response shapes + architecture patterns
- **Output**: 5-15 atomic learnings
- **Cap**: max 50 entries total in first run

### What the LLM produces (atomic)

| Aspect             | Example output                                                          |
| ------------------ | ----------------------------------------------------------------------- |
| Naming conventions | "Handler files end with `-handler.ts`, services with `-service.ts`"     |
| Error handling     | "Services throw `DomainError` subclasses, controllers catch only those" |
| Response shapes    | "API responses use `{ ok: bool, data?: T, error?: string }`"            |
| Architecture       | "CQRS-style split: reads via Repository, writes via Service"            |

**Do NOT produce**: narrative paragraphs, project-level summaries, code examples. Everything atomic, ≤200 chars per summary.

---

## Tag Vocabulary

Controlled vocabulary for the optional `tags[]` field on learning entries (see § Writer Append Protocol). Rules: 0–3 tags, kebab-case, prefer these names; at most one free tag when nothing here fits; never force a tag. Tags describe the _domain_ of the learning so relevance search can resurface an old entry by topic instead of by date.

The tag NAMES below are the single source of truth — `scripts/learnings-search.js --print-vocab` must match this list exactly (enforced by `scripts/tests/run.sh`). The aliases are illustrative matching hints only; they live in the script's reverse index and may evolve freely.

| tag             | when to use                                  | example aliases                     |
| --------------- | -------------------------------------------- | ----------------------------------- |
| `auth`          | authn/authz, sessions, tokens, login         | jwt, oauth, session, cookie, login  |
| `api`           | endpoints, request/response, REST/GraphQL    | endpoint, rest, graphql, http       |
| `db`            | database, ORM, queries, migrations           | postgres, prisma, sql, migration    |
| `state`         | client/server state management               | redux, zustand, store, reducer      |
| `routing`       | navigation, routes, redirects, middleware    | router, navigation, redirect, route |
| `ui`            | components, rendering, DOM, accessibility    | component, render, modal, widget    |
| `styling`       | CSS, theming, layout, responsive             | css, tailwind, theme, grid          |
| `forms`         | form input, submit, field handling           | form, input, field, submit          |
| `validation`    | input validation, schemas, constraints       | validate, zod, yup, constraint      |
| `errors`        | error handling, exceptions, crashes          | error, exception, throw, catch      |
| `async`         | concurrency, promises, races, queues         | race, promise, await, concurrency   |
| `perf`          | performance, optimization, memoization       | optimize, memo, lazy, latency       |
| `security`      | XSS/CSRF/injection, secrets, encryption      | xss, csrf, injection, encrypt       |
| `testing`       | tests, mocks, fixtures, coverage             | jest, vitest, mock, coverage        |
| `build-tooling` | bundlers, transpilers, linters, compile      | vite, webpack, esbuild, tsconfig    |
| `deploy`        | deployment, CI/CD, containers, releases      | docker, vercel, pipeline, release   |
| `config`        | environment, settings, feature flags         | env, dotenv, setting, flag          |
| `caching`       | caches, memoization, invalidation, TTL       | redis, memoize, invalidate, ttl     |
| `data-model`    | entities, relations, domain modelling        | entity, model, relation, domain     |
| `logging`       | logging, tracing, monitoring, telemetry      | logger, trace, monitor, metric      |
| `godot`         | Godot engine specifics                       | engine, autoload                    |
| `gdscript`      | GDScript language patterns                   | gdextension, onready                |
| `scene`         | scene tree, nodes, signals, instancing       | tscn, node2d, signal, instance      |
| `game-loop`     | physics, input, animation, per-frame process | physics, input, animation, delta    |

---

## Dedup Tokenizer

Lowercase → strip punctuation → split on whitespace → filter Dutch/English stopwords and tokens
under 3 chars → suffix-normalize (strip `-tion`/`-sion`/`-ing`/`-ed`/plural `-s`/agentive `-er`) →
unique `tokenSet`. Implemented once in `scripts/learnings-search.js` (exported `tokenize`) and
applied by `scripts/learnings-write.js append` for both dedup stages below — the algorithm lives in
the script, not here.

**Dedup** for `learnings[]`: see § Writer Append Protocol below — exact-tuple shortcut, then Jaccard ≥ 0.55.

---

## Writer Append Protocol

Single canon for every skill that appends to `project-context.json#learnings[]` (pipeline completion phases, debug, core-pull).

**Schema** (append-only):

```json
{
  "date": "YYYY-MM-DD",
  "feature": "{feature-name}",
  "type": "pattern|pitfall|observation",
  "source": "extracted|inferred|synced|consolidated",
  "author": "(only when source === \"synced\")",
  "summary": "max 200 chars",
  "tags": ["auth", "async"]
}
```

**Filter**: only items relevant beyond the current feature — skip feature-specific implementation details.

**Tags**: assign 0–3 domain tags from § Tag Vocabulary describing what the learning is _about_ (kebab-case; at most one free tag when nothing fits; omit rather than force). Tags let relevance search resurface an old entry by topic — a stale `auth` pitfall stays reachable when a new auth feature is built. Optional and backwards-compatible: entries without `tags` still match on feature name + summary keywords. **Tags are NOT part of the dedup key.**

**Append + dedup** — never hand-write the mutation; the script owns the two-stage dedup (exact
tuple `(type, normalize(summary), author ?? null)`, then Jaccard ≥ 0.55 tokenized, same `type`
only) against existing `learnings[]` **and** earlier entries in the same call, appends survivors,
and stamps `date`:

```bash
echo '{"entries":[{"feature":"...","type":"pitfall","source":"extracted","summary":"...","tags":["auth"]}]}' \
  | node ~/.claude/scripts/learnings-write.js append {project-root}
```

Stdout: `{ "appended": N, "skipped": [{"summary","reason":"exact"|"jaccard","matched"}] }`. Exit 0
even when everything dedups — a skip is expected behavior, not an error.

**Single writer for build decisions**: `dev-ship (build phase)` PHASE 3A owns the `build.decisions[] → learnings` mapping (type `pattern`, source `extracted`). Downstream skills must not re-map decisions — `dev-ship (verify phase)` maps only `tests.fixSync[]` → `pitfall` and `observations[]` → `observation`.

---

## Author Resolution

For MVP signals:

| Source                        | Author source                                                   |
| ----------------------------- | --------------------------------------------------------------- |
| Fix-commit pitfall            | `git log --format=%an` of that commit                           |
| TODO/FIXME comment            | `git blame --porcelain` on the line where the comment appears   |
| New abstraction-dir           | `git log --diff-filter=A --format=%an` of the first file in dir |
| New wrapper-dep               | `git log --format=%an -- package.json` of that addition         |
| LLM-inferred (signal/onboard) | `null` (codebase-wide, not attributable to one person)          |

Author === git user → skip (own work).

---

## Quality Filters (all sources)

- Summary ≥10 words or contains specific terms (no generic filler)
- No duplicate of existing `learnings[]` (dedup-key match)
- Pattern label must be non-empty (no "introduced X in Y" without X)

When in doubt → do not emit. Append-only contract makes cleanup expensive.

---

## Consolidation (size lifecycle)

`learnings[]` is append-only at write time. Consolidation is **opportunistic noise reduction** — merging redundant same-`feature`+`type` clusters and aging out stale observations — not a hard cap on active-list size: loads are relevance-scored (`scripts/learnings-search.js` / `LEARNINGS-LOAD.md`), so context cost scales with what a load _shows_ (per-scope capped, e.g. 10/15/5), never with how many entries are _stored_. A large, diverse active list costs nothing to load.

**Trigger**: after the dedup-and-sync step, `learnings.length > 60` — this is a merge-opportunity check, not a size ceiling. If nothing qualifies (no cluster reaches the group-size threshold, no observation is old enough to age out), the correct outcome is a no-op, not a forced reduction.

**Archive file**: `.project/archive/learnings-{YYYY-MM}.json` — shape `{ "schemaVersion": 2, "archived": [ <original learning objects> ] }`. Append; create dir/scaffold if absent. Archived entries are excluded from the default recency loads, but they remain **reachable by relevance search** — `scripts/learnings-search.js` scans the archive as a damped on-demand tier (`--archive`), so a strongly-matching old entry still surfaces for a related feature (it just never surfaces on recency alone). This is why consolidation is lossy-summary but not memory-loss.

**Procedure** (target: active list ≤ 40 after the pass) — `scripts/learnings-write.js` owns the
mechanics (age-out, grouping by `feature`+`type` at a ≥4 threshold escalating to ≥3 when the
projected size still exceeds 40, tag-union, author-unification); you author only the merged
summary text for each group:

```bash
node ~/.claude/scripts/learnings-write.js gate {project-root}
```

Empty output → nothing to do. Otherwise it prints a plan — age-out list plus, per group, the
original entries and a merge scaffold with every field filled except `summary`. For each group,
write one merged `summary` (≤ 200 chars) that preserves each distinct point — drop only true
repetition, never distinct pitfalls (this judgment call is yours, not the script's) — then:

```bash
echo '{"merges":[{"feature":"...","type":"pitfall","summary":"<your merged text>"}]}' \
  | node ~/.claude/scripts/learnings-write.js consolidate {project-root}
```

The script recomputes the plan, replaces each matched group with your completed entry, and moves
group originals + age-outs to the archive. Never consolidate entries newer than 3 months — the
script already excludes them from grouping.

**Guarantees**: idempotent (a consolidated list under the threshold never triggers another pass); lossless in provenance (originals live in the archive); pitfalls are never silently dropped — only merged or archived with a consolidated successor in place. A list over the threshold with no qualifying cluster or age-out candidate is a legitimate no-op — `gate` reports nothing to do, and the list is expected to stay over 60 until a matching cluster or stale observation appears.

---

## Consolidation Gate (caller protocol)

**Single source of truth for _when_ to run § Consolidation.** Every flow that appends to `learnings[]` runs this gate **once, after its append(s)** — batched at the end of the flow, never per entry.

Run `node ~/.claude/scripts/learnings-write.js gate {project-root}`: empty output → done, nothing
to do; otherwise author the merged summaries per § Consolidation and run `consolidate` with them.
The script's own report line (`Learnings consolidated: {N} merged, {M} archived ({before} → {after})`)
is the output — nothing else to emit.

Properties: idempotent (a list already ≤ 60, or over 60 with nothing to cluster/age-out, is a no-op check); `.project/`-only writes (the consolidation is never part of a code commit — `.project/` is gitignored / state-branch). **Callers reference this section — do not restate the trigger or the procedure inline.**

**Who runs it** (every terminal append point): `/core-pull` (after its dedup-and-sync), the ship orchestrators `dev-ship` / `game-ship` / `design-ship` (PHASE 5, after ship-level extraction), `dev-ship` / `game-ship` are covered at the orchestrator level so their build/verify/refactor domain phases do **not** each run it, `dev-debug` / `game-debug` (PHASE 10, after the per-bug pitfall append), and `core-setup --mode=mature` (after the onboard write-back).
