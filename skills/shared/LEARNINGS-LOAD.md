# Learnings Load Protocol

Shared protocol for loading learnings as context in architectural skills. Skills reference this instead of duplicating their own filter logic.

> **Schema**: `learnings[]` in `project-context.json`. Fields: `date`, `feature`, `type`, `source`, `author?`, `summary`. See [DASHBOARD.md](DASHBOARD.md).

---

## When to load

Skills load learnings during their **context-load phase** (typically PHASE 0 or an early PHASE where architecture context is being built).

**Why a script and not an inline read:** `learnings[]` is append-only and grows with the project — at 500 entries a full inline read costs ~43k tokens per skill run while at most 10–15 entries are ever shown. The extraction script below filters in-process and prints only the matching entries, so context cost scales with what is _shown_, not with what is _stored_.

## Three scopes

Each skill specifies one or more scopes. No wildcards — choose explicitly.

- **`component`** — learnings matching the current feature/component name. Two-step: substring match on the `feature` field (bidirectional), then summary-keyword fallback on feature tokens (split kebab-case, tokens ≥ 3 chars, max 5 keyword matches). Combined, sorted desc by date, capped at 10. _Used by_: `dev-ship`, `design-convert`; `project-brainstorm` / `project-critique` (feature/page scope, via `INPUT-PARSING.md § Project Memory Load`).
- **`architectural`** — `type === "pattern"` with source `synced`, `extracted`, or `consolidated` (exclude `inferred` — too broad for architecture choices). Sorted desc by date, capped at 15. _Used by_: `project-plan`; `project-seed` / `project-brainstorm` / `project-critique` (via `INPUT-PARSING.md § Project Memory Load`).
- **`pitfall-prefix`** — last 5 pitfalls regardless of feature. Default-on prefix for every skill that uses this loader; disable with `pitfall-prefix: false`.

## Extraction script

**Prerequisites**: `$REPO` (project root), `$FEAT` (kebab-case feature name, or empty for non-feature skills), `$SCOPES` (comma-separated: `component,architectural`).

```bash
node -e "
  const c = require('$REPO/.project/project-context.json');
  const L = c.learnings || [];
  if (!L.length) process.exit(0);
  const feat = '$FEAT'.toLowerCase();
  const scopes = '$SCOPES'.split(',').map(s => s.trim()).filter(Boolean);
  const byDate = (a, b) => (b.date || '').localeCompare(a.date || '');
  const line = l => '  [' + (l.date || '?') + '] ' + (l.feature || l.type) + ' — ' + l.summary;
  const out = [];

  const pitfalls = L.filter(l => l.type === 'pitfall').sort(byDate).slice(0, 5);
  if (pitfalls.length) out.push('Project pitfalls (last 5):', ...pitfalls.map(line), '');

  if (scopes.includes('component') && feat) {
    const sub = L.filter(l => {
      const f = (l.feature || '').toLowerCase();
      return f && (f.includes(feat) || feat.includes(f));
    });
    const tokens = feat.split(/[-\s]/).filter(t => t.length >= 3);
    const kw = L.filter(l => !sub.includes(l))
      .filter(l => tokens.some(t => (l.summary || '').toLowerCase().includes(t)))
      .slice(0, 5);
    const m = [...sub, ...kw].sort(byDate).slice(0, 10);
    if (m.length) out.push('Component-scoped (' + feat + '):', ...m.map(line), '');
  }

  if (scopes.includes('architectural')) {
    const m = L.filter(l => l.type === 'pattern' && ['synced','extracted','consolidated'].includes(l.source))
      .sort(byDate).slice(0, 15);
    if (m.length) out.push('Architectural patterns (project-wide):', ...m.map(line), '');
  }

  if (out.length) console.log(['LEARNINGS CONTEXT', '', ...out].join('\n').trimEnd());
" 2>/dev/null || true
```

Pass `pitfall-prefix: false` → remove the pitfalls block from the script invocation (delete those three lines, or post-filter). Empty output = no matches; show nothing (no "0 entries" lines).

## Output format

The script prints the ASCII block directly — include it verbatim in the skill's context output:

```
LEARNINGS CONTEXT

Project pitfalls (last 5):
  [2026-04-20] auth-login — JWT refresh race condition bij parallel requests
  ...

Component-scoped (auth):
  [2026-04-15] auth — JWT via httpOnly cookie rotation

Architectural patterns (project-wide):
  [2026-04-20] core — Repository pattern in src/repositories/ (12 files)
```

Empty sections (no matches) are omitted by the script.

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

- **No `project-context.json`**: script exits silently (the `|| true` guard) — no output, skip all scopes.
- **Empty `learnings[]`**: script exits silently.
- **No `current-feature` specified**: `component` scope produces nothing; other scopes remain.
- **Worktree-aware**: point `$REPO` at the main worktree (per [SYNC.md](SYNC.md) Worktree-aware Path Resolution).
- **Archived learnings** (`.project/archive/learnings-*.json`, see [LEARNING-EXTRACTION.md](LEARNING-EXTRACTION.md) § Consolidation): never loaded — archive is for human reference and dedup checks only.

---

## Implementation note

This is a **read-only** protocol. No mutations to `learnings[]` — that remains the responsibility of writer-skills (`dev-ship (verify phase)`, `dev-ship (refactor phase)` (PHASE 5), `core-pull`, `core-setup --mode=mature`). Consolidation/archiving of the learnings list itself happens in `core-pull` — see [LEARNING-EXTRACTION.md](LEARNING-EXTRACTION.md) § Consolidation.

Skills that pass learnings to an agent: run the script first and embed the filtered block in the agent prompt (never the full list).
