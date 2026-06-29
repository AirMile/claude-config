# Report (mature PHASE 6)

**Inputs**: scan/sync counts (PHASE 1-5), `installed_in_session[]` (PHASE 0.4 init, 5.65/5.8 appends), `needsTheme` (PHASE 5.7), `--no-llm` flag state, CLAUDE.md sync summary (PHASE 5.5 PHASE D).

**Render rules** for the report below:

- Bullets with `{if <condition>}` prefix: skill evaluates condition, renders bullet only if `true`. The `{if X}` prefix is **not** shown literally in the output.
- Bullets without prefix: always render.

**Condition syntax:**

- `<path> empty` — true if value is `null`, `undefined`, empty string `""`, empty array `[]`, or object with no own keys `{}`
- `<path> = <value>` — strict equality check
- `&&` / `||` — logical operators with short-circuit evaluation
- Undefined operand with `&&` → `false`; with `||` → skipped
- `<name>` without operator → boolean variable computed in earlier PHASE (e.g. `needsTheme` from PHASE 5.7)

| Condition                             | Bullet                                     |
| ------------------------------------- | ------------------------------------------ |
| (none — always)                       | `/core-pull`                               |
| no `project-seed.md` (>50 chars)      | `/project-seed`                            |
| `features[]` empty                    | `/dev-define`                              |
| frontend stack && `needsTheme = true` | `/frontend-tokens`                         |
| `installed_in_session[]` not empty    | show "Modules added: {list}" under Updated |

**Branch/PR context fetch (before render):**

```bash
git rev-parse --abbrev-ref HEAD                                          # current branch
git rev-list --left-right --count origin/main...HEAD 2>/dev/null         # behind/ahead of main
gh pr list --json number,title,headRefName,isDraft --limit 5 2>/dev/null # open PRs (skip if gh not available)
```

```
ONBOARD COMPLETE

Project: {project-name}
Mode:    mature (full scan {+ LLM extraction | --no-llm})

Repository:
  Branch:  {current branch}
  vs main: ↓{N} behind  ↑{M} ahead  {if no remote: "(no remote)"}
{if open PRs present}  Open PRs: {#number title (draft?), ...}

Context:
  Structure:    refreshed ({N} dirs)
  Routing:      {N} routes
  Patterns:     {N} auto, {M} manual

Deep analysis:
  Entities:     {N} total
  Endpoints:    {N} total
  Architecture: {N} components
  Packages:     {N} total

Learnings:
  Pitfalls:     {N} ({A} from fix-commits, {B} from TODO/FIXME)
  Patterns:     {N} ({C} abstraction-dirs, {D} wrapper-deps, {E} LLM)
  Observations: {N}
  Total new:    {N} (capped at 50)
  Authors:      {list, or "codebase-wide" for LLM-inferred}

CLAUDE.md:     {generated | {N} sections added | already complete}
Stack baseline: {.claude/research/stack-baseline.md created | already present | skipped (no framework)}
Claude config: {settings.local.json + hook created | already present}

Updated: {date}
{if installed_in_session[] not empty}  Modules added: {installed_in_session[]}

Next steps:
  • /core-pull              — incremental updates (sync state is on)
{if no project-seed.md > 50 chars}  • /project-seed   — build the project concept
{if features[] empty}     • /dev-define         — define the first feature
{if frontend && needsTheme}  • /frontend-tokens — design tokens (color, typography, spacing)
```
