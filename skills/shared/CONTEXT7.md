# Context7 research protocol (shared)

Single source of truth for when and how skills query Context7
(`mcp__context7__resolve-library-id` + `mcp__context7__query-docs`). Loaded on demand by any phase
that hits a library-API decision point — build's TDD GREEN step, `dev-verify`'s fix-loop, `fix-round`'s
plan-mode gate and debug-round, `dev-ship`'s `debug-round.md § 5` / `debug-round-heavy.md`, `game-debug` PHASE 4.

## When to research

- Unfamiliar external library API (symbol, options, lifecycle)
- Suspected deprecation / version mismatch
- Error signature that implicates a dependency

**Skip when** the root cause is purely internal logic — no external library in the causal chain.
(Same condition as `dev-ship`'s `debug-round.md § 5` / `game-debug` PHASE 4.)

## Cache order — check before any query

1. `feature.json#research` — define-scout's digest for this feature
2. `.claude/research/stack-baseline.md` — including the `## Context7 Library IDs` table; a table
   hit means skip `resolve-library-id` and go straight to `query-docs`
3. `.claude/research/refactor-patterns.md` — only if already loaded in this session

## Query protocol

- Load only the two tools you need: `ToolSearch query="select:mcp__context7__resolve-library-id,mcp__context7__query-docs"`
- `resolve-library-id` → `query-docs`
- Query shape: `{library} {symbol/API} {error signature or goal}`

## Caps

≤2 queries per finding/requirement, ≤4 per agent run or session. Cap hit → proceed best-effort and
note the gap in your output/SYNC line — never burn the whole budget chasing one lookup.

## Plan mode

Both tools are read-only, so they keep working inside plan mode (`shared/PLAN-MODE.md`).

## Context discipline

- **Isolated subagents** (build agent, Explore agent, debug-round investigation): query directly —
  no digest ceremony, the isolation already keeps results out of the main session.
- **Main chat**: route bulky research through one Explore agent (pattern: `dev-refactor/workflow.md`
  § Aggregated Research Decision), or condense results to ≤5 bullets before showing them.

## Degradation

Context7 unavailable or no library match → fall back to `WebSearch` → still nothing: proceed without
research and note the gap. (Mirrors `dev-refactor/references/error-handling.md`.)
