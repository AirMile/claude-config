# Learning Write — schema, dedup, tags, append & consolidation

The write side of the learnings system (companion to `scripts/learnings-write.js`). Signal detection and extraction heuristics (MVP Signals, Signal Detection, LLM Extraction Scope, Author Resolution, Quality Filters) live in `shared/LEARNING-EXTRACTION.md`.

> **Output schema**: all extractions produce entries for `project-context.json.learnings[]` with `source: "synced"` and optional `author`. See [shared/DASHBOARD.md](DASHBOARD.md) `learnings` section.

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
