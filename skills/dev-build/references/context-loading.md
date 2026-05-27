# PHASE 0: Context Loading — dev-build

Full context-loading procedure for `/dev-build`. Executed via Todo-marker in SKILL.md.

---

**Capture git baseline** (first action):

First determine the repo root. If CWD is not a git repo, locate the repo via the feature location:

```bash
REPO=$(git rev-parse --show-toplevel 2>/dev/null) || \
  REPO=$(cd "$(dirname "$(find . -maxdepth 6 -name 'feature.json' -path '*/.project/features/*' | head -1)")/../../.." && pwd)
```

No repo found → exit: "No git repo detected; /dev-build requires a tracked project."

Store `$REPO` — all subsequent git commands use `git -C "$REPO" ...`.

```bash
mkdir -p "$REPO/.project/session"
find "$REPO/.project/session" -maxdepth 1 \( -name "active-*.json" -o -name "pre-skill-*.txt" \) -mtime +1 -delete 2>/dev/null
git -C "$REPO" rev-parse HEAD > "$REPO/.project/session/pre-skill-sha.txt"
```

**Detect stack:** read CLAUDE.md `### Stack` section + `.claude/research/stack-baseline.md` (if available). Fallback: `project.json.stack`.

**Test-runner pre-flight** (skip if no `package.json` or no TDD-capable stack detected):

Verify packages are resolvable and the setup file imports `@testing-library/jest-dom` (without it `toBeInTheDocument` / `toHaveAttribute` fail silently with "Invalid Chai property"). **Do not run the test suite** — the first real run is the regression gate in PHASE 2b.

**Skip entirely** for non-JS stacks (no `package.json`) or backend-only Node stacks without a component-testing framework.

```bash
# Detecteer setup-file (vitest, jest, of generieke locaties)
# Glob covers: root (vitest.setup.*, jest.setup.*, setup-tests.*),
# src/test-setup.*, src/test/setup.*, tests/setup.*, test/setup.*
SETUP=$(ls vitest.setup.* jest.setup.* src/test-setup.* setup-tests.* \
          src/test/setup.* tests/setup.* test/setup.* 2>/dev/null | head -1)
# Fallback: read setupFiles uit vitest.config.* als ls leeg is
if [ -z "$SETUP" ] && [ -f vitest.config.ts ]; then
  SETUP=$(grep -oE "setupFiles[^']*'[^']+'" vitest.config.ts 2>/dev/null | grep -oE "'[^']+'" | tr -d "'" | head -1)
fi
# Check jest-dom: geïmporteerd in setup-file én installeerbaar
[ -n "$SETUP" ] && grep -q "@testing-library/jest-dom" "$SETUP" \
  || echo "MISSING: @testing-library/jest-dom import not found in setup file"
node -e "require.resolve('@testing-library/jest-dom')" 2>&1 || echo "MISSING: @testing-library/jest-dom"

# Stack-aware component-library check (gebruikt de al gedetecteerde stack)
# React   → @testing-library/react
# Vue     → @testing-library/vue
# Svelte  → @testing-library/svelte
# Angular → @testing-library/angular
# Overig/backend → sla over
node -e "require.resolve('@testing-library/{framework}')" 2>&1 || echo "MISSING: @testing-library/{framework}"
```

Vervang `{framework}` met de waarde uit de stack-detectie hierboven. Als geen component-framework gevonden → sla de framework-check over.

Missing → auto-install (default) if `package.json` already contains `vitest`, `jest`, or `playwright` as a key anywhere in its content. Otherwise → **AskUserQuestion**: "Install + add import (Recommended)" / "Skip and continue".

Output: `TEST-DEPS: ok | patched ({list}) | skipped`.

**Project context** (skip if not present):

Read `.project/project.json` and `.project/project-context.json`. Use for:

- Existing endpoints (prevent duplicate routes)
- Existing DB schema (prevent conflicts)
- Code patterns to follow
- Learnings from earlier features
- `theme.cssVars` — present and non-empty: log `"Theme loaded"`. Empty or missing: log `"Theme empty — fallback defaults (shared/TOKENS.md) will be used"`.

**Learnings load** (via [shared/LEARNINGS-LOAD.md](../../../shared/LEARNINGS-LOAD.md)):

Configuration:

```
scopes: [component]
pitfall-prefix: true
current-feature: <feature-name>
```

Display the loaded output. The pitfall-prefix section + component-scoped patterns provide context for the build (not a constraint — when in doubt assume root cause, don't pattern-match).

Store the loaded learnings for PHASE 1 (Technique Mapping).

**Load feature:**

Ready queue (only if no feature name provided via CLI):

Parse `.project/backlog.html`. For each DEFINED feature calculate whether all `dependencies[]` have `status === "DONE"` (or the dep list is empty). Display before the feature selection:

```
Ready to build:
  ✓ auth-login        P1  (no deps)
  ✓ user-profile      P2  deps: [auth-login ✓]

Blocked:
  ✗ payment-flow      P1  waiting for: [stripe-integration — DOING]
  ✗ checkout          P2  waiting for: [payment-flow ✗, cart — TODO]
```

- Only show "Blocked" section if blocked features exist
- If no DEFINED features exist → "No features ready to build." → exit

If no feature name provided:

1. Parse `.project/backlog.html` (see `shared/BACKLOG.md → Lifecycle Protocol → Read`).
   - First check: `data.features.find(f => f.type === "FEATURE" && f.transition === "building")` → if found, auto-select, show: `Backlog: ✓ Task picked up — {name}`.
   - Fallback: filter `status === "DEFINED"` → suggest via **AskUserQuestion** (ready features at the top)
2. Fallback: list `.project/features/` with `feature.json`, let user select

Load `feature.json`. Extract: `requirements[]`, `buildSequence[]`, `files[]`, `testStrategy[]`, `architecture` (specifically `registries[]` and `interfaces`). If `clarifications[]` is present: treat as hard constraints during implementation (gray-area decisions from the user). If `architecture.registries[]` is present: use as a guide — add new instances (endpoints, commands, entities) to the indicated registry file, don't scatter them across loose files.

Not found → exit: "Run `/dev-define` first."

**COMPONENT detection** (immediately after feature.json load):

If `feature.type === "COMPONENT"` (or backlog item type is COMPONENT): set `IS_COMPONENT_BUILD = true`. Otherwise: `IS_COMPONENT_BUILD = false`.

**Token-bootstrap safety net** (only if `feature.hasUI === true` or `IS_COMPONENT_BUILD = true`): execute the Bootstrap Procedure from `shared/TOKENS.md`. Fully idempotent — guards skip automatically if Tailwind is missing or `tokens.css` already exists.

**Token-theme guard** (only when `feature.hasUI === true` or `IS_COMPONENT_BUILD = true`): after Bootstrap Procedure completes, read `project.json#theme.colors[]`. If absent or empty:

```yaml
header: "Theme tokens"
question: "Geen design tokens gevonden. /dev-build genereert UI met token-classes die zonder thema unstyled blijven. Hoe verder?"
options:
  - label: "Run /frontend-tokens first (Recommended)", description: "Zet kleuren + spacing tokens op, daarna /dev-build opnieuw"
  - label: "Continue with fallback defaults", description: "Gebruik defaults uit shared/TOKENS.md (neutrale gray-scale)"
  - label: "Cancel", description: "Stop deze build"
multiSelect: false
```

- "Run /frontend-tokens first" → exit: `Run /frontend-tokens, then /dev-build {feature} again.`
- "Continue with fallback defaults" → set `$USE_FALLBACK_TOKENS = true`; Token-styled UI rule uses `shared/TOKENS.md` defaults.
- "Cancel" → exit.

**Token-styled UI rule** (applies to both `feature.hasUI === true` FEATURE builds and all COMPONENT builds): dev-build writes functional, presentably-styled UI using the project's design tokens. This is sufficient for `/dev-verify` manual checks; polish details via browser inspect + commit without re-running `/frontend-design`.

- Use semantic HTML, form controls, and layout structure appropriate to the feature.
- Use token-based Tailwind classes: `bg-background`, `text-foreground`, `bg-primary`, `text-primary-foreground`, `rounded-md`, `p-4`, `gap-4`, semantic headings (`text-2xl font-semibold`). Read `project.json#theme` for token names; if empty → fall back to defaults from `shared/TOKENS.md`.
- T101/T102 still enforced — no hex literals or `bg-[#hex]` values.
- **Motion:** Read `project.json#theme.motion.pack`. If set and not `"none"`: apply `transition-transform duration-fast ease-out` + hover lift + active scale to all interactive elements (buttons, cards, links). For Expressive/Playful packs: use `var(--ease-ios-spring)` and `var(--spring-snappy-bezier)` via inline CSS or token classes. If `motion.dev`/`framer-motion` detected in `package.json`: use `<motion.*>` with spring token values (`stiffness/damping/mass` from `theme.motion.spring[]`). Always wrap choreography in `@media (prefers-reduced-motion: reduce)` fallback. T106/T107 enforced — no hardcoded ms or cubic-bezier literals.
- `/frontend-design` is optional: run it on-demand for layout reshaping (sidebar/hero/grid). No marker comment on generated files.

**Dependency check:**

Skip if no `depends[]` or empty.

1. Parse `.project/backlog.html`. Not found → skip.
2. Per dependency: status must be `"DONE"`.
3. Blockers found → **AskUserQuestion**:
   - "Stop — finish {dep} first (Recommended)" / "Continue anyway"
   - Stop → exit with message: `Run /dev-build {dep}` (for FEATURE or COMPONENT deps) or `Run /frontend-design {dep}` (for PAGE deps). Continue → proceed.

**Workspace setup:**

Follow `shared/WORKTREE.md → Auto-create worktree` with `feature-name = "{feature-name}"`. The procedure auto-creates an isolated worktree and wires `.project/` symlinks. No AskUserQuestion needed — creation is automatic when no worktree exists for the feature yet. Skip if already in a worktree (procedure detects).

**Mandatory output** (always log, never silent):

```
WORKTREE: {absolute-path} ({created | reused | skipped: already-in-worktree})
```

If the procedure did not run (e.g. no git repo, error), log `WORKTREE: not-applied ({reason})` **and** write the marker file so the gate below can detect the skip:

```bash
echo "not-applied: {reason}" > "$REPO/.project/session/worktree-status.txt"
```

For successful create/reuse, also write the marker (so reruns can short-circuit):

```bash
echo "active: $(pwd)" > "$REPO/.project/session/worktree-status.txt"
```

This line is non-negotiable — without it, the auditor cannot verify whether isolation was achieved.

**Pre-PHASE-1 gate** (hard check — shell-state verification):

```bash
CURRENT="$(pwd)"
EXPECTED_SUFFIX="/.claude/worktrees/{feature-name}"
MARKER="$REPO/.project/session/worktree-status.txt"
if [[ "$CURRENT" == *"$EXPECTED_SUFFIX" ]]; then
  echo "GATE: ok — inside worktree"
elif [[ -f "$MARKER" ]] && grep -q "^not-applied" "$MARKER"; then
  echo "GATE: ok — worktree explicitly skipped ($(cat "$MARKER"))"
else
  echo "ABORT: PHASE 0 incomplete — not inside expected worktree and no 'not-applied' marker found at $MARKER."
  echo "Re-run /dev-build from the start; follow shared/WORKTREE.md → Auto-create worktree literally."
  exit 1
fi
```

Clean up `$MARKER` together with the other session files in PHASE 3B.

Follow `shared/WORKTREE.md → Symlink Integrity Gate (post-switch auto-repair)`.

**Signal active feature**:

```bash
echo '{"feature":"{feature-name}","skill":"build","startedAt":"{ISO timestamp}"}' > .project/session/active-{feature-name}.json
```

**Display** feature overview:

```
FEATURE: {feature-name}

REQUIREMENTS:
- REQ-001: {description}
  ...

IMPLEMENTATION ORDER:
(from buildSequence, sorted by step)
```

**Risk check (only if backlog feature `risk >= 4`):**

If the loaded backlog feature has a `risk` score of 4 or 5, show this warning before PHASE 1:

```
⚠ HIGH RISK — Complexity {risk}/5

Consider before building:
- Are all dependencies available (status DONE)?
- Is the feature definition complete (all REQs clear)?
- Build in small steps — commit after each working REQ
```

After completing all steps above: mark PHASE 0 → `completed`, PHASE 1 → `in_progress` via `TaskUpdate`. Then return to SKILL.md for PHASE 1.
