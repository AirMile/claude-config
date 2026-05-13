# Learnings Load Protocol

Shared protocol for loading learnings as context in architectural skills. Skills reference this instead of duplicating their own filter logic.

> **Schema**: `learnings[]` in `project-context.json`. Velden: `date`, `feature`, `type`, `source`, `author?`, `summary`. Zie [DASHBOARD.md](DASHBOARD.md).

---

## When to load

Skills load learnings during their **context-load phase** (typically PHASE 0 or an early PHASE where architecture context is being built). Reading is cheap — no LLM tokens, only file reads.

## Three scopes

Each skill specifies one or more scopes. No wildcards — choose explicitly.

### Scope: `component`

Filter learnings that match the current feature/component name. Two steps, combined.

**Step 1 — substring match op `feature` veld:**

```
substrMatches = learnings.filter(l =>
  l.feature.toLowerCase().includes(currentFeature.toLowerCase()) OR
  currentFeature.toLowerCase().includes(l.feature.toLowerCase())
)
```

**Step 2 — summary-keyword match (fallback):**

```
featureTokens = currentFeature.split(/[-\s]/).filter(t => t.length >= 3)

keywordMatches = learnings
  .filter(l => l NOT in substrMatches)
  .filter(l => featureTokens.some(t => l.summary.toLowerCase().includes(t)))
  .slice(0, 5)
```

`featureTokens`: split on `-` and space, filter tokens < 3 chars. Examples: `"auth-login"` → `["auth", "login"]`, `"jwt-refresh"` → `["jwt", "refresh"]`, `"db-migration"` → `["migration"]` (db < 3 → skip).

**Combine:**

```
matches = [...substrMatches, ...keywordMatches]
  .sort desc by date
  .slice(0, 10)
```

Sort desc by `date`. Cap at 10 entries total.

**Use case**: feature-specific patterns and pitfalls that are directly relevant to the current working feature.

**Used by**: `dev-build`, `dev-refactor`, `dev-define`, `frontend-design`.

### Scope: `architectural`

Filter by type `pattern` with source `synced` or `extracted` (exclude `inferred` — those are cross-feature observations, too broad for architecture choices).

```
matches = learnings.filter(l =>
  l.type === "pattern" AND
  l.source IN ["synced", "extracted"]
)
```

Sort desc by `date`. Cap at 15 entries.

**Use case**: when making architecture decisions you want to see which patterns the project already uses to stay consistent.

**Used by**: `project-backlog`, `project-decide`.

### Scope: `pitfall-prefix`

Last 5 pitfalls (all types `pitfall`, sorted desc by `date`), independent of feature scope.

```
matches = learnings
  .filter(l => l.type === "pitfall")
  .sort((a, b) => b.date.localeCompare(a.date))
  .slice(0, 5)
```

**Use case**: brief recap of recent bugs as a prefix in every skill that loads context. This is what [dev-build](../dev-build/SKILL.md) already does — now shared.

**Used by**: prefix in every skill that uses this loader. Not a separate scope choice but a default-on prefix you can disable with `pitfall-prefix: false`.

---

## Output format

Skill receives an ASCII block that fits in its context output:

```
LEARNINGS CONTEXT

Project pitfalls (laatste 5):
  [2026-04-20] auth-login — JWT refresh race condition bij parallel requests
  [2026-04-15] payments — Stripe webhook idempotency key collision
  ...

Component-scoped (auth):
  [2026-04-15] pattern — JWT via httpOnly cookie rotation
  [2026-04-10] pattern — DomainError subclass voor auth fouten

Architectural patterns (project-wide):
  [2026-04-20] pattern — Repository pattern in src/repositories/ (12 files)
  [2026-04-15] pattern — Input validation via zod schemas in services laag
```

Empty sections (no matches) → omit, do not show "0 entries".

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

- **No `project-context.json`**: skip all scopes — no output.
- **Empty `learnings[]`**: skip all project scopes.
- **No `current-feature` specified**: skip `component` scope. Other scopes remain.
- **Worktree-aware**: read `project-context.json` from main worktree (per [SYNC.md](SYNC.md) Worktree-aware Path Resolution).

---

## Implementation note

This is a **read-only** protocol. No mutations to `learnings[]` — that remains the responsibility of writer-skills (`dev-verify`, `dev-refactor` (PHASE 5), `project-pull`, `core-setup --mode=mature`).

Skill can read + filter inline (no separate tool needed), or if the skill uses an agent: agent prompt already contains filtered learnings (not the full list).
