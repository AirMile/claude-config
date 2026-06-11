# PHASE 0: Context Loading — dev-build

Full context-loading procedure for `/dev-build`. Executed via Todo-marker in SKILL.md.

> **Note**: this file loads on every run — it is a deliberate size-split of SKILL.md, not lazy loading. Genuinely conditional blocks inside it (theme-token guard, dependency-blocker dialog) are small enough to stay inline.

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
# Detect setup file: root/src/test dirs (vitest.setup.*, jest.setup.*, setup-tests.*, */setup.*),
# fallback: setupFiles entry in vitest.config.*
SETUP=$(ls vitest.setup.* jest.setup.* src/test-setup.* setup-tests.* \
          src/test/setup.* tests/setup.* test/setup.* 2>/dev/null | head -1)
# Check jest-dom: imported in the setup file AND installed
[ -n "$SETUP" ] && grep -q "@testing-library/jest-dom" "$SETUP" \
  || echo "MISSING: @testing-library/jest-dom import not found in setup file"
node -e "require.resolve('@testing-library/jest-dom')" 2>&1 || echo "MISSING: @testing-library/jest-dom"
# Stack-aware component-library check: @testing-library/{react|vue|svelte|angular} per detected stack
node -e "require.resolve('@testing-library/{framework}')" 2>&1 || echo "MISSING: @testing-library/{framework}"
```

No component framework detected → skip the framework check.

Missing → auto-install (default) if `package.json` already contains `vitest`, `jest`, or `playwright` as a key anywhere in its content. Otherwise → **AskUserQuestion**: "Install + add import (Recommended)" / "Skip and continue".

Output: `TEST-DEPS: ok | patched ({list}) | skipped`.

**Project context** (skip if not present):

Project context load (via [shared/PROJECT-CONTEXT-LOAD.md](../../shared/PROJECT-CONTEXT-LOAD.md)):

```
profile: build
```

Run the two `node -e` snippets for the `build` profile. Use the extracted output for:

- Existing endpoints (prevent duplicate routes)
- Existing DB schema / entity names (prevent conflicts)
- Code patterns to follow
- `themeCssVarsEmpty === false`: log `"Theme loaded"`. `true` or missing: log `"Theme empty — fallback defaults (shared/TOKENS.md) will be used"`.

**Conventions** (per [shared/CONVENTIONS.md](../../shared/CONVENTIONS.md) load rules):

```bash
CONV_STATUS=$(head -1 .project/conventions.md 2>/dev/null | sed -n 's/.*conventions-status: \([a-z]*\).*/\1/p')
```

`set` → `Read` `.project/conventions.md` in full (main context — dev-build writes the code itself); `none` or absent → skip silently, **no elicitation here** (that lives in core-setup + dev-refactor). Log: `CONVENTIONS: loaded | none | not set up`.

**Learnings load** (via [shared/LEARNINGS-LOAD.md](../../shared/LEARNINGS-LOAD.md)):

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

Backlog load (via [shared/BACKLOG-LOAD.md](../../shared/BACKLOG-LOAD.md)):

```
profile: ready-queue
```

Run the `ready-queue` snippet. For each returned feature, compute `ready` (all deps DONE) vs blocked. Display before the feature selection:

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

1. Backlog load (via [shared/BACKLOG-LOAD.md](../../shared/BACKLOG-LOAD.md)):

   ```
   profile: ready-queue
   ```

   From the `ready-queue` output: first check for a feature with `transition === "building"` → if found, auto-select, show: `Backlog: ✓ Task picked up — {name}`. Fallback: filter `ready === true` → suggest via **AskUserQuestion** (ready features at the top).

2. Fallback: list `.project/features/` with `feature.json`, let user select

Feature load (via [shared/FEATURE-LOAD.md](../../shared/FEATURE-LOAD.md)):

```
profile: build
feature-name: {feature-name}
```

Run the `build` snippet. Use extracted fields: `requirements[]`, `buildSequence[]`, `files[]`, `testStrategy[]`, `architecture` (specifically `registries[]` and `interfaces`). If `clarifications[]` is present: treat as hard constraints during implementation (gray-area decisions from the user). If `architecture.registries[]` is present: use as a guide — add new instances (endpoints, commands, entities) to the indicated registry file, don't scatter them across loose files.

`FEATURE_JSON: not present` → exit: "Run `/dev-define` first."

**COMPONENT detection** (immediately after feature.json load):

If `feature.type === "COMPONENT"` (or backlog item type is COMPONENT): set `IS_COMPONENT_BUILD = true`. Otherwise: `IS_COMPONENT_BUILD = false`.

**Token-bootstrap safety net** (only if `feature.hasUI === true` or `IS_COMPONENT_BUILD = true`): execute the Bootstrap Procedure from `shared/TOKENS.md`. Fully idempotent — guards skip automatically if Tailwind is missing or `tokens.css` already exists.

**Token-theme guard** (only when `feature.hasUI === true` or `IS_COMPONENT_BUILD = true`): after Bootstrap Procedure completes, read `project.json#theme.colors[]`. If absent or empty:

```yaml
header: "Theme tokens"
question: "No design tokens found. /dev-build generates UI with token classes that stay unstyled without a theme. How to proceed?"
options:
  - label: "Run /frontend-tokens first (Recommended)", description: "Set up color + spacing tokens, then run /dev-build again"
  - label: "Continue with fallback defaults", description: "Use defaults from shared/TOKENS.md (neutral gray-scale)"
  - label: "Cancel", description: "Stop this build"
multiSelect: false
```

- "Run /frontend-tokens first" → exit: `Run /frontend-tokens, then /dev-build {feature} again.`
- "Continue with fallback defaults" → set `$USE_FALLBACK_TOKENS = true`; Token-styled UI rule uses `shared/TOKENS.md` defaults.
- "Cancel" → exit.

**Token-styled UI rule** (applies to both `feature.hasUI === true` FEATURE builds and all COMPONENT builds): dev-build writes functional, presentably-styled UI using the project's design tokens — sufficient for `/dev-verify` manual checks; polish via browser inspect + commit without re-running `/frontend-design` (run it on-demand only for layout reshaping).

- Use semantic HTML and token-based Tailwind classes (`bg-background`, `text-foreground`, `bg-primary`, `rounded-md`, `p-4`, semantic headings). Read `project.json#theme` for token names; empty → defaults from `shared/TOKENS.md`.
- **Motion** (if `theme.motion.pack` set and not `"none"`): token-based transitions + hover lift + active scale on interactive elements; Expressive/Playful packs use `var(--ease-ios-spring)`/`var(--spring-snappy-bezier)`; `motion.dev`/`framer-motion` in package.json → `<motion.*>` with spring token values from `theme.motion.spring[]`.
- Enforcement (TOKENS.md T101/T102/T106/T107 greps + prefers-reduced-motion fallback): PHASE 2 step 4 — single canon, applied where the code is written.

**Dependency check:**

Skip if no `depends[]` or empty.

1. Parse `.project/backlog.json`. Not found → skip.
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

After completing all steps above: mark PHASE 0 → `completed`, PHASE 1 → `in_progress` via `TaskUpdate`. Then return to SKILL.md for PHASE 1.
