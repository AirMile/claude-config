# PHASE 0: Context Loading — dev-build

Full context-loading procedure for the build phase (dev-ship PHASE 1). Executed via Todo-marker in workflow.md.

> **Note**: this file loads on every run — it is a deliberate size-split of workflow.md, not lazy loading. Genuinely conditional blocks inside it (theme-token guard, dependency-blocker dialog) are small enough to stay inline.

---

**Capture git baseline** (first action):

First determine the repo root. If CWD is not a git repo, locate the repo via the feature location:

```bash
REPO=$(git rev-parse --show-toplevel 2>/dev/null) || \
  REPO=$(cd "$(dirname "$(find . -maxdepth 6 -name 'feature.json' -path '*/.project/features/*' | head -1)")/../../.." && pwd)
```

No repo found → exit: "No git repo detected; the build phase requires a tracked project."

Store `$REPO` — all subsequent git commands use `git -C "$REPO" ...`.

```bash
mkdir -p "$REPO/.project/session"
find "$REPO/.project/session" -maxdepth 1 \( -name "active-*.json" -o -name "pre-skill-*.txt" \) -mtime +1 -delete 2>/dev/null
git -C "$REPO" rev-parse HEAD > "$REPO/.project/session/pre-skill-sha.txt"
```

**Detect stack:** read CLAUDE.md `### Stack` section + `.claude/research/stack-baseline.md` (if available). Fallback: `project.json.stack`.

**Project context** (skip if not present):

Project context load: `node ~/.claude/scripts/context-load.js "$REPO" build` → `{ project, projectContext }` (see [shared/PROJECT-CONTEXT-LOAD.md](.claude/skills/shared/PROJECT-CONTEXT-LOAD.md)). Use the extracted output for:

- Existing endpoints (prevent duplicate routes)
- Existing DB schema / entity names (prevent conflicts)
- Code patterns to follow
- `themeCssVarsEmpty === false`: log `"Theme loaded"`. `true` or missing: log `"Theme empty — fallback defaults (shared/TOKENS.md) will be used"`.

**Conventions** (per [shared/CONVENTIONS.md](.claude/skills/shared/CONVENTIONS.md) load rules):

```bash
CONV_STATUS=$(head -1 .project/conventions.md 2>/dev/null | sed -n 's/.*conventions-status: \([a-z]*\).*/\1/p')
```

`set` → `Read` `.project/conventions.md` in full (main context — dev-build writes the code itself); `none` or absent → skip silently, **no elicitation here** (that lives in core-setup + dev-refactor). Log: `CONVENTIONS: loaded | none | not set up`.

**Learnings load** (via [shared/LEARNINGS-LOAD.md](.claude/skills/shared/LEARNINGS-LOAD.md)):

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

Backlog load: `node ~/.claude/scripts/backlog-load.js "$REPO" ready-queue` → `{ backlogPresent, items }` (see [shared/BACKLOG-LOAD.md](.claude/skills/shared/BACKLOG-LOAD.md)). `items[]` already carries computed `ready`/`blocking`. Display before the feature selection:

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

1. Backlog load: `node ~/.claude/scripts/backlog-load.js "$REPO" ready-queue` → `{ backlogPresent, items }` (see [shared/BACKLOG-LOAD.md](.claude/skills/shared/BACKLOG-LOAD.md)). From `items[]`: first check for a feature with `transition === "building"` → if found, auto-select, show: `Backlog: ✓ Task picked up — {name}`. Fallback: filter `ready === true` → suggest via **AskUserQuestion** (ready features at the top).

2. Fallback: list `.project/features/` with `feature.json`, let user select

Feature load: `node ~/.claude/scripts/context-load.js "$REPO" feature-build "{feature-name}"` (see [shared/FEATURE-LOAD.md](.claude/skills/shared/FEATURE-LOAD.md)). Use extracted fields: `requirements[]`, `buildSequence[]`, `files[]`, `testStrategy[]`, `architecture` (specifically `registries[]` and `interfaces`), `research`. If `clarifications[]` is present: treat as hard constraints during implementation (gray-area decisions from the user). If `architecture.registries[]` is present: use as a guide — add new instances (endpoints, commands, entities) to the indicated registry file, don't scatter them across loose files. If `research` is present: it is define-scout's library digest for exactly this feature's unfamiliar-API areas — first stop during PHASE 2 GREEN steps, before any new Context7 query (cache order: [shared/CONTEXT7.md](.claude/skills/shared/CONTEXT7.md)).

`present: false` → exit: "Run `/dev-ship {feature-name}` first."

**COMPONENT detection** (immediately after feature.json load):

If `feature.type === "COMPONENT"` (or backlog item type is COMPONENT): set `IS_COMPONENT_BUILD = true`. Otherwise: `IS_COMPONENT_BUILD = false`.

**Token-bootstrap safety net** (only if `feature.hasUI === true` or `IS_COMPONENT_BUILD = true`): execute the Bootstrap Procedure from `shared/TOKENS.md`. Fully idempotent — guards skip automatically if Tailwind is missing or `tokens.css` already exists.

**Token-theme guard** (only when `feature.hasUI === true` or `IS_COMPONENT_BUILD = true`): after Bootstrap Procedure completes, read `project.json#theme.colors[]`. If absent or empty:

```yaml
header: "Theme tokens"
question: "No design tokens found. This build phase generates UI with token classes that stay unstyled without a theme. How to proceed?"
options:
  - label: "Run /design-tokens first (Recommended)", description: "Set up color + spacing tokens, then re-run /dev-ship {feature-name}"
  - label: "Continue with fallback defaults", description: "Use defaults from shared/TOKENS.md (neutral gray-scale)"
  - label: "Cancel", description: "Stop this build"
multiSelect: false
```

- "Run /design-tokens first" → exit: `Run /design-tokens, then re-run /dev-ship {feature} again.`
- "Continue with fallback defaults" → set `$USE_FALLBACK_TOKENS = true`; Token-styled UI rule uses `shared/TOKENS.md` defaults.
- "Cancel" → exit.

**Token-styled UI rule** (applies to both `feature.hasUI === true` FEATURE builds and all COMPONENT builds): the build phase writes functional, presentably-styled UI using the project's design tokens — sufficient for the verify phase's manual checks; polish via browser inspect + commit without re-running `/design-convert` (run it on-demand only for layout reshaping).

- Use semantic HTML and token-based Tailwind classes (`bg-background`, `text-foreground`, `bg-primary`, `rounded-md`, `p-4`, semantic headings). Read `project.json#theme` for token names; empty → defaults from `shared/TOKENS.md`.
- **Motion** (if `theme.motion.pack` set and not `"none"`): token-based transitions + hover lift + active scale on interactive elements; Expressive/Playful packs use `var(--ease-ios-spring)`/`var(--spring-snappy-bezier)`; `motion.dev`/`framer-motion` in package.json → `<motion.*>` with spring token values from `theme.motion.spring[]`.
- Enforcement (TOKENS.md T101/T102/T106/T107 greps + prefers-reduced-motion fallback): PHASE 2 step 4 — single canon, applied where the code is written.

**Dependency check:**

Skip if no `depends[]` or empty.

1. Parse `.project/backlog.json`. Not found → skip.
2. Per dependency: status must be `"DONE"`.
3. Blockers found → **AskUserQuestion**:
   - "Stop — finish {dep} first (Recommended)" / "Continue anyway"
   - Stop → exit with message: `Run /dev-ship {dep}` (for FEATURE or COMPONENT deps) or `Run /design-convert {dep}` (for PAGE deps). Continue → proceed.

**Workspace setup:**

Follow `shared/WORKTREE-CREATE.md → Auto-create worktree` with `feature-name = "{feature-name}"`. The procedure auto-creates an isolated worktree and wires `.project/` symlinks. No AskUserQuestion needed — creation is automatic when no worktree exists for the feature yet. Skip if already in a worktree (procedure detects).

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
  echo "Re-run /dev-ship {feature-name} from the start; follow shared/WORKTREE-CREATE.md → Auto-create worktree literally."
  exit 1
fi
```

Clean up `$MARKER` together with the other session files in PHASE 3B.

Follow `shared/WORKTREE.md → Symlink Integrity Gate (post-switch auto-repair)`.

**Test-runner pre-flight** (intentionally placed AFTER the worktree-switch above — any install lands in the worktree branch, not in main; skip if no `package.json` or no TDD-capable stack detected):

**Step 1 — detect RN/Expo stack:**

```bash
IS_RN=$(node -e "try { var p = require('./package.json'); var d = Object.assign({}, p.devDependencies||{}, p.dependencies||{}); var preset = (p.jest && p.jest.preset) || ''; console.log(d['jest-expo'] || d['react-native'] || preset.indexOf('jest-expo') !== -1 ? 'true' : 'false'); } catch(e) { console.log('false'); }" 2>/dev/null)
```

**RN/Expo stack (`IS_RN = true`):** skip `@testing-library/jest-dom` entirely — it is incompatible with React Native's test renderer. Instead verify:

```bash
node -e "require.resolve('@testing-library/react-native')" 2>&1 || echo "MISSING: @testing-library/react-native"
SETUP=$(ls jest.setup.* src/test-setup.* setup-tests.* src/test/setup.* tests/setup.* test/setup.* 2>/dev/null | head -1)
[ -n "$SETUP" ] && grep -qE "@testing-library/react-native/extend-expect|@testing-library/jest-native" "$SETUP" \
  || echo "MISSING: extend-expect import not found (add: import '@testing-library/react-native/extend-expect' to setup file)"
```

Missing `@testing-library/react-native` → auto-install if `package.json` contains `jest-expo` or `react-native`. It provides all matchers via `extend-expect` — no jest-dom needed. Output: `TEST-DEPS: ok | patched (react-native) | skipped`.

**Web stack (`IS_RN = false`):** verify `@testing-library/jest-dom` is resolvable and imported in the setup file (without it `toBeInTheDocument` / `toHaveAttribute` fail silently with "Invalid Chai property"). **Do not run the test suite** — the first real run is the regression gate in PHASE 2b.

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

**Signal active feature**:

```bash
echo '{"skill":"build"}' | node ~/.claude/scripts/ship-checkpoint.js signal {feature-name}
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

After completing all steps above: mark PHASE 0 → `completed`, PHASE 1 → `in_progress` via `TaskUpdate`. Then return to workflow.md for PHASE 1.
