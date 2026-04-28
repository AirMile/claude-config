# Learning Extraction Heuristieken

Gedeelde regels voor het extraheren van learnings uit teammate code en mature codebases. Gebruikt door `/core-pull` (incremental, signal-triggered) en `/core-onboard` (eenmalig, full scan).

> **Output schema**: alle extracties produceren entries voor `project-context.json.learnings[]` met `source: "synced"` en optioneel `author`. Zie [shared/DASHBOARD.md](DASHBOARD.md) `learnings` sectie.

---

## MVP Signalen (regex/AST, deterministisch, 0 LLM-tokens)

### 1. Pitfalls uit fix-commits

**Detectie:**

```bash
git log --grep='^fix\|^bugfix' --format='%H|%an|%s%n%b' $RANGE
```

`$RANGE` = `$PRE_REF..HEAD` in pull, `--since="6 months ago"` in onboard.

**Filter (cumulatief):**

- Body niet leeg (skip kale `fix: typo`)
- Body ≥10 woorden, OF body bevat root-cause keyword: `because|waardoor|caused|door|root cause|reason|reden|oorzaak`
- Skip als auteur === `git config user.name` (eigen werk → al in feature.json)

**Output:**

```json
{
  "type": "pitfall",
  "source": "synced",
  "author": "{commit author}",
  "feature": "{primary-directory uit changed files}",
  "summary": "{commit subject zonder 'fix:' prefix} — {body samenvatting max 200 chars}"
}
```

### 2. Pitfalls uit code-comments

**Detectie:**

```bash
grep -rn -E '(TODO|FIXME|HACK|XXX|NOTE):' {scope}
```

`{scope}` in pull: alleen teammate-changed files (filter via `git blame --porcelain` op author ≠ self).
`{scope}` in onboard: alle source files (excl. node_modules, .git, .project, dist, build).

**Filter (cumulatief):**

- ≥10 woorden in comment body
- Bevat werkwoord-clue: `breaks|fails|causes|veroorzaakt|kapot|werkt niet|moet|should|hangs|blocks|crashes|leaks|loses|loses`
- Verwerp generic patterns: `TODO: implement`, `FIXME: fix this`, `TODO: refactor`

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

**Detectie:** vergelijk component lijst (uit `core-pull` FASE 4f / `core-onboard` FASE 2) tegen bestaande `architecture.components[]` in `project-context.json`.

**Mapping table:**

| Directory keyword              | Pattern label             |
| ------------------------------ | ------------------------- |
| `repositories/`, `repository/` | Repository pattern        |
| `middleware/`, `middlewares/`  | Middleware pipeline       |
| `factories/`, `factory/`       | Factory pattern           |
| `decorators/`, `decorator/`    | Decorator pattern         |
| `interceptors/`                | Interceptor pattern       |
| `handlers/`                    | Handler/Command pattern   |
| `services/` (nieuw)            | Service layer             |
| `usecases/`, `use-cases/`      | Use case / Clean Arch     |
| `domains/`, `domain/`          | Domain-driven design      |
| `events/`, `subscribers/`      | Event-driven architecture |

**Output (per nieuwe match):**

```json
{
  "type": "pattern",
  "source": "synced",
  "author": "{primary commit author die dir aanmaakte}",
  "feature": "{dir name}",
  "summary": "{Pattern label} geïntroduceerd in {path} ({N} files)"
}
```

### 4. Patterns uit nieuwe wrapper-deps

**Detectie:**

```bash
git diff $RANGE -- package.json
```

Parse added entries in `dependencies` of `devDependencies`. Match tegen lijst:

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

Geen match → skip (geen pattern emit).

**Output:**

```json
{
  "type": "pattern",
  "source": "synced",
  "author": "{commit author die dep toevoegde}",
  "feature": "stack",
  "summary": "{Pattern label}"
}
```

---

## Signal-detectie (alleen `core-pull`)

Bepaalt of de LLM-subagent moet worden aangeroepen. **Conventie-vrij**: geen commit-titel parsing, alleen file-system en git diff.

```
1. Parse `git diff $PRE_REF..HEAD --name-status`
2. Groep changed files per top-level component-directory
   (eerste 2 segmenten: src/payments/, app/api/billing/, etc.)
3. Trigger als:
   - Eén directory ≥10 files gewijzigd (A/M, niet D), OF
   - Nieuwe top-level directory aangemaakt (alle files status=A)
4. Geen trigger → MVP only, klaar
5. Trigger → roep `learning-extractor` agent aan op getriggerde files
```

Skip volledig als `--no-learn` flag gezet.

---

## LLM Extractie Scope

Gedraag van `learning-extractor` agent verschilt per skill:

### `core-pull` (signal-triggered)

- **Input**: lijst paden van getriggerde files
- **Scope**: alleen die files lezen, geen wider scan
- **Output**: 0-5 patterns/pitfalls
- **Cap**: max 5 entries

### `core-onboard` (eenmalig, mature codebase)

- **Input**: representative files per component (5-10 per component, gekozen op basis van: file size > 50 LOC, niet test-files, niet generated)
- **Scope**: naming conventions + error handling style + response shapes + architectuur patterns
- **Output**: 5-15 atomaire learnings
- **Cap**: max 50 entries totaal in eerste run

### Wat de LLM produceert (atomair)

| Aspect             | Voorbeeld output                                                           |
| ------------------ | -------------------------------------------------------------------------- |
| Naming conventions | "Handler files eindigen op `-handler.ts`, services op `-service.ts`"       |
| Error handling     | "Services throwen `DomainError` subclasses, controllers vangen alleen die" |
| Response shapes    | "API responses gebruiken `{ ok: bool, data?: T, error?: string }`"         |
| Architectuur       | "CQRS-style split: reads via Repository, writes via Service"               |

**NIET produceren**: narrative paragraphs, project-niveau samenvattingen, code voorbeelden. Alles atomair, ≤200 chars per summary.

---

## Dedup Tokenizer

Identiek aan `core-promote-learnings` FASE 2 tokenisatie. Gebruikt voor:

- Pre-write dedup binnen één skill run
- Cross-run dedup tegen bestaande `learnings[]`

**Stappen:**

1. Lowercase
2. Strip leestekens (`.,;:!?()[]{}'"` → spaties)
3. Split op whitespace
4. Filter stopwoorden:
   ```
   de het een en of maar dus dat die deze dit met via voor bij naar van uit op
   in te is zijn was waren wordt worden werd geworden niet geen ook al alle
   alleen wel dan toen toch nog
   ```
5. Filter tokens met length < 3
6. Resultaat: `tokenSet` (uniek)

**Dedup-key** voor `learnings[]`: `(type, normalize(summary), author ?? null)`.

Match = exact tuple match. Geen Jaccard binnen één project (alleen cross-project in `core-promote-learnings`).

---

## Author Resolutie

Voor MVP signalen:

| Bron                          | Author bron                                                      |
| ----------------------------- | ---------------------------------------------------------------- |
| Fix-commit pitfall            | `git log --format=%an` van die commit                            |
| TODO/FIXME comment            | `git blame --porcelain` op de regel waar comment staat           |
| Nieuwe abstraction-dir        | `git log --diff-filter=A --format=%an` van de eerste file in dir |
| Nieuwe wrapper-dep            | `git log --format=%an -- package.json` van die toevoeging        |
| LLM-inferred (signal/onboard) | `null` (codebase-wide, niet attributable aan één persoon)        |

Author === git user → skip (eigen werk).

---

## Kwaliteitsfilters (alle bronnen)

- Summary ≥10 woorden of bevat specifieke termen (geen generic filler)
- Geen duplicate van bestaande `learnings[]` (dedup-key match)
- Pattern label moet niet-leeg zijn (geen "introduced X in Y" zonder X)

Bij twijfel → niet emit. Append-only contract maakt cleanup duur.
