# Learning Extraction Heuristics

Shared rules for extracting learnings from teammate code and mature codebases. Used by `/project-pull` (incremental, signal-triggered) and `/core-setup --mode=mature` (once, full scan).

> **Output schema**: all extractions produce entries for `project-context.json.learnings[]` with `source: "synced"` and optional `author`. See [shared/DASHBOARD.md](DASHBOARD.md) `learnings` section.

---

## MVP Signalen (regex/AST, deterministisch, 0 LLM-tokens)

### 1. Pitfalls uit fix-commits

**Detectie:**

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
  "feature": "{primary-directory uit changed files}",
  "summary": "{commit subject without 'fix:' prefix} — {body summary max 200 chars}"
}
```

### 2. Pitfalls uit code-comments

**Detectie:**

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

### 3. Patterns uit nieuwe abstraction-dirs

**Detection:** compare component list (from `project-pull` PHASE 4f / `core-setup --mode=mature` PHASE 2) against existing `architecture.components[]` in `project-context.json`.

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

### 4. Patterns uit nieuwe wrapper-deps

**Detectie:**

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

## Signal Detection (only `project-pull`)

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

### `project-pull` (signal-triggered)

- **Input**: lijst paden van getriggerde files
- **Scope**: read only those files, no wider scan
- **Output**: 0-5 patterns/pitfalls
- **Cap**: max 5 entries

### `core-setup --mode=mature` (eenmalig, mature codebase)

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
2. Strip leestekens (`.,;:!?()[]{}'"` → spaties)
3. Split op whitespace
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
   5b. Suffix-normalisering (tokens met length > 5):
   - eindigt op `tion` of `sion` → verwijder laatste 3 chars (`condition` → `condit`)
   - eindigt op `ing` → verwijder laatste 3 chars (`caching` → `cach`)
   - eindigt op `ed` → verwijder laatste 2 chars (`failed` → `fail`)
   - eindigt op `s` maar NIET op `ss` → verwijder laatste char (`requests` → `request`)
   - eindigt op `er` en length > 6 → verwijder laatste 2 chars (`handler` → `handl`)
6. Result: `tokenSet` (unique)

**Dedup-key** voor `learnings[]`: `(type, normalize(summary), author ?? null)`.

Match = exact tuple match. Geen Jaccard binnen één project (alleen cross-project in `core-promote-learnings`).

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
