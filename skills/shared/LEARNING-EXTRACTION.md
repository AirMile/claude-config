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

## Dedup Tokenizer

Tokenization algorithm. Used for:

- Pre-write dedup within a single skill run
- Cross-run dedup against existing `learnings[]`

**Steps:**

1. Lowercase
2. Strip punctuation (`.,;:!?()[]{}'"` → spaces)
3. Split on whitespace
4. Filter stopwords:
   ```
   de het een en of maar dus dat die deze dit met via voor bij naar van uit op
   in te is zijn was waren wordt worden werd geworden niet geen ook al alle
   alleen wel dan toen toch nog
   the a an and or but so that this these those with for at by from into
   to is are was were be been being have has had do does did will would could
   should may might shall not no also all only then when though still just
   ```
5. Filter tokens with length < 3
   5b. Suffix normalization (tokens with length > 5):
   - ends in `tion` or `sion` → remove last 3 chars (`condition` → `condit`)
   - ends in `ing` → remove last 3 chars (`caching` → `cach`)
   - ends in `ed` → remove last 2 chars (`failed` → `fail`)
   - ends in `s` but NOT in `ss` → remove last char (`requests` → `request`)
   - ends in `er` and length > 6 → remove last 2 chars (`handler` → `handl`)
6. Result: `tokenSet` (unique)

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
  "summary": "max 200 chars"
}
```

**Filter**: only items relevant beyond the current feature — skip feature-specific implementation details.

**Dedup (two stages, in order):**

1. **Exact shortcut**: tuple `(type, normalize(summary), author ?? null)` matches an existing entry (normalize = lowercase + strip punctuation) → skip candidate.
2. **Near-duplicate**: tokenize the summary via § Dedup Tokenizer; for each existing learning with the same `type`: `Jaccard(candidate.tokens, existing.tokens) >= 0.55` → skip candidate.

Passes both stages → append. No candidates → skip the step silently.

**Single writer for build decisions**: `dev-build` PHASE 3A owns the `build.decisions[] → learnings` mapping (type `pattern`, source `extracted`). Downstream skills must not re-map decisions — `dev-verify` maps only `tests.fixSync[]` → `pitfall` and `observations[]` → `observation`.

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

`learnings[]` is append-only at write time, but not unbounded: when the list grows past the threshold, `/core-pull` consolidates it (PHASE 4j.7). This keeps the active list small enough that scoped loads stay sharp and dedup passes stay cheap.

**Trigger**: after the dedup-and-sync step, `learnings.length > 60`.

**Archive file**: `.project/archive/learnings-{YYYY-MM}.json` — shape `{ "schemaVersion": 2, "archived": [ <original learning objects> ] }`. Append; create dir/scaffold if absent. Archived entries are never loaded as context (LEARNINGS-LOAD ignores the archive) — they exist for human reference and provenance.

**Procedure** (target: active list ≤ 40 after the pass):

1. **Age-out observations**: entries with `type === "observation"` older than 12 months → move to archive (no summary needed; observations age poorly).
2. **Group by `feature`**: for every feature group with ≥ 4 remaining entries, merge each type-cluster (patterns together, pitfalls together) into max 1 consolidated entry per type:
   - `summary`: one merged summary (≤ 200 chars) that preserves each distinct point — drop only true repetition, never distinct pitfalls.
   - `type`: kept; `source: "consolidated"`; `date`: newest of the group; `feature`: kept; `author`: kept if identical across group, else `null`.
   - Originals → archive.
3. **Still > 40?** Repeat step 2 for groups with ≥ 3 entries. Never consolidate entries newer than 3 months — recent learnings keep full resolution.

**Guarantees**: idempotent (a consolidated list under the threshold never triggers another pass); lossless in provenance (originals live in the archive); pitfalls are never silently dropped — only merged or archived with a consolidated successor in place.
