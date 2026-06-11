# Project Code Conventions

Per-project code conventions (company/team/personal style guide) in `.project/conventions.md`. Single source of truth for the file format, the three-state lifecycle, elicitation, and load rules. Consumers: core-setup (writer), dev-refactor (fallback write + read), dev-build, dev-verify, game-refactor, game-build (read).

---

## Purpose & Precedence

Conventions capture **project-specific** naming, structure, and style rules — the things a company style guide mandates that global rules don't cover. Precedence when rules conflict:

```
global MUST_DO (CODING-RULES.md / FRONTEND-RULES.md)  >  .project/conventions.md  >  global SHOULD_DO
```

Conventions may specialize or override SHOULD_DO/AVOID rules, never MUST_DO (security/reliability floors).

Relation to existing mechanisms (both unchanged):

- `project-context.json#context.patterns[]` — short gotchas and env quirks, one-liners. Stays.
- `Code maturity:` pattern — steers refactor aggressiveness. Stays in `patterns[]`.

## File Format

First line is a machine-readable status marker. Filled file:

```markdown
<!-- conventions-status: set -->
<!-- source: distilled from CONTRIBUTING.md + eslint.config.js | pasted | interview -->

# Project Conventions

## Naming

- Files: kebab-case; React components: PascalCase

## Structure

- One exported component per file; co-locate tests as {name}.test.ts

## Style

- Prefer named exports; no default exports outside Next.js route files
```

Sentinel file (explicit "no conventions" choice):

```markdown
<!-- conventions-status: none -->

# Project Conventions

No project-specific conventions — global rules (shared/CODING-RULES.md, shared/FRONTEND-RULES.md) apply.
To change this: delete this file and re-run /core-setup, or edit it directly and set the status to "set".
```

**Rules**: max ~120 lines. Pasted style guides get **distilled**, never dumped verbatim. Only include rules that differ from or specialize the global rule files — a rule that repeats CODING-RULES.md doesn't earn its place.

## State Table

```bash
CONV_STATUS=$(head -1 .project/conventions.md 2>/dev/null | sed -n 's/.*conventions-status: \([a-z]*\).*/\1/p')
# "" = absent (never asked) | "none" | "set"
```

| State           | Representation                      | Consumer behavior                                                                  |
| --------------- | ----------------------------------- | ---------------------------------------------------------------------------------- |
| Never asked     | File **absent** (`CONV_STATUS=""`)  | dev-refactor PHASE 0: one-time lightweight fallback ask; all others: skip silently |
| Explicitly none | `<!-- conventions-status: none -->` | All skills skip silently — **never re-ask**                                        |
| Conventions set | `<!-- conventions-status: set -->`  | Load per § Load Rules                                                              |

## Discovery Sources

Scanned during full elicitation (core-setup mature) to distill candidate rules. Lint configs are **signals to distill** (only non-default, opinionated rules), not content to copy:

- `eslint.config.*`, `.eslintrc*`, `.prettierrc*`, `biome.json`, `biome.jsonc`, `.editorconfig`
- `CONTRIBUTING.md`, `STYLE.md`, `docs/STYLEGUIDE*`, `docs/styleguide*`

## Elicitation

**Full protocol** (core-setup — see `core-setup/references/phase-conventions.md`):

1. Discovery scan over the sources above, distill candidate rules
2. AskUserQuestion: confirm distilled candidates (multiSelect, first option recommended) — includes a "No project conventions" option that writes the sentinel
3. One anchored open question per [QUESTIONING.md](QUESTIONING.md): house-style rules the configs don't capture
4. Write `.project/conventions.md` (`set`, or sentinel)

**Lightweight fallback** (dev-refactor PHASE 0 only, when file is absent): single AskUserQuestion —

- "No project conventions (Recommended)" → write the sentinel (never asked again)
- "Set up conventions now" → paste/point to a style guide, distill ≤120 lines, write `set`

No other skill elicits. Build/verify skills with an absent file proceed silently.

## Load Rules

| Consumer type                                                      | Rule                                                                                                                                      |
| ------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Agent-dispatching skills (dev-refactor, game-refactor, dev-verify) | Pass the **path** in the agent prompt ("Read `.project/conventions.md` before scanning") — agent reads it in its own context, token-cheap |
| Main-context skills (dev-build, game-build)                        | `Read` the file once in PHASE 0 — the main session writes the code itself                                                                 |

Log one line on load: `CONVENTIONS: loaded | none | not set up`.
