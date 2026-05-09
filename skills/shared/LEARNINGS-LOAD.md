# Learnings Load Protocol

Gedeeld protocol voor het laden van learnings als context bij architecturale skills. Skills refereren hiernaar i.p.v. eigen filterlogica te dupliceren.

> **Schema**: `learnings[]` in `project-context.json`. Velden: `date`, `feature`, `type`, `source`, `author?`, `summary`. Zie [DASHBOARD.md](DASHBOARD.md).

---

## Wanneer laden

Skills laden learnings tijdens hun **context-load fase** (typisch FASE 0 of een vroege FASE waarin architectuur-context wordt opgebouwd). Lezen is goedkoop — geen LLM-tokens, alleen file-reads.

## Drie scopes

Elke skill specificeert één of meer scopes. Geen wildcards — expliciet kiezen.

### Scope: `component`

Filter learnings die matchen op de huidige feature/component naam. Twee stappen, gecombineerd.

**Stap 1 — substring match op `feature` veld:**

```
substrMatches = learnings.filter(l =>
  l.feature.toLowerCase().includes(currentFeature.toLowerCase()) OR
  currentFeature.toLowerCase().includes(l.feature.toLowerCase())
)
```

**Stap 2 — summary-keyword match (fallback):**

```
featureTokens = currentFeature.split(/[-\s]/).filter(t => t.length >= 3)

keywordMatches = learnings
  .filter(l => l NOT in substrMatches)
  .filter(l => featureTokens.some(t => l.summary.toLowerCase().includes(t)))
  .slice(0, 5)
```

`featureTokens`: split op `-` en spatie, filter tokens < 3 chars. Voorbeelden: `"auth-login"` → `["auth", "login"]`, `"jwt-refresh"` → `["jwt", "refresh"]`, `"db-migration"` → `["migration"]` (db < 3 → skip).

**Combineer:**

```
matches = [...substrMatches, ...keywordMatches]
  .sort desc op date
  .slice(0, 10)
```

Sorteer desc op `date`. Cap op 10 entries totaal.

**Use case**: feature-specifieke patterns en pitfalls die direct relevant zijn voor de huidige werkfeature.

**Gebruikt door**: `dev-build`, `dev-refactor`, `dev-define`, `frontend-design`.

### Scope: `architectural`

Filter op type `pattern` met source `synced` of `extracted` (geen `inferred` — die zijn cross-feature observaties, te vaag voor architectuurkeuzes).

```
matches = learnings.filter(l =>
  l.type === "pattern" AND
  l.source IN ["synced", "extracted"]
)
```

Sorteer desc op `date`. Cap op 15 entries.

**Use case**: bij architectuur-beslissingen wil je zien welke patterns het project al gebruikt om consistent te blijven.

**Gebruikt door**: `project-plan`, `thinking-decide`.

### Scope: `pitfall-prefix`

Laatste 5 pitfalls (alle types `pitfall`, sorted desc op `date`), independent van feature-scope.

```
matches = learnings
  .filter(l => l.type === "pitfall")
  .sort((a, b) => b.date.localeCompare(a.date))
  .slice(0, 5)
```

**Use case**: korte recap van recente bugs als prefix bij elke skill die context laadt. Dit is wat [dev-build](../dev-build/SKILL.md) al doet — nu shared.

**Gebruikt door**: prefix bij elke skill die deze loader gebruikt. Niet een aparte scope-keuze maar een default-on prefix die je kunt uitschakelen met `pitfall-prefix: false`.

---

## Output format

Skill ontvangt een ascii-blok dat in z'n context-output past:

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

Secties die leeg zijn (geen matches) → weglaten, niet "0 entries" tonen.

---

## Skill-specifieke configuratie

Elke skill specificeert in z'n SKILL.md:

```
Load learnings via shared/LEARNINGS-LOAD.md:
- scopes: [component, architectural]
- pitfall-prefix: true
- current-feature: <kebab-case naam, of "none" voor non-feature skills>
```

`pitfall-prefix` defaultt op `true` — alleen expliciet uitzetten als de skill echt geen pitfall-context nodig heeft.

---

## Edge cases

- **Geen `project-context.json`**: skip alle scopes — geen output.
- **Lege `learnings[]`**: skip alle project-scopes.
- **Geen `current-feature` opgegeven**: skip `component` scope. Andere scopes blijven.
- **Worktree-aware**: lees `project-context.json` uit main worktree (volgens [SYNC.md](SYNC.md) Worktree-aware Pad Resolutie).

---

## Implementatie-noot

Dit is een **read-only** protocol. Geen mutaties aan `learnings[]` — dat blijft de verantwoordelijkheid van schrijver-skills (`dev-verify`, `dev-refactor` (FASE 5), `project-pull`, `core-setup --mode=mature`).

Skill kan inline lezen + filteren (geen aparte tool nodig), of als de skill een agent gebruikt: agent prompt bevat al gefilterde learnings (niet de hele lijst).
