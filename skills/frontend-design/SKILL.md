---
name: frontend-design
description: Use with /frontend-design. Auto-triggers on PAGE/COMPONENT backlog tasks with transition "designing" or "converting".
argument-hint: "[name|file-path|url|sketch]"
reads:
  [
    devinfo.handoff,
    devinfo.tokenDrift,
    backlog.status,
    feature.requirements,
    feature.files,
  ]
writes: [devinfo.handoff, devinfo.tokenDrift]
metadata:
  author: claude-config
  version: 2.11.0
  category: frontend
---

# Design

One skill, two routes:

1. **Design route** — manages project design specification (pages, user flows, design principles, components) in `.project/project.json → design`. Builds code from spec or generates a Claude Design brief. Modes: Capture, Brief, Build.
2. **Convert route** — converts visual input (sketch, wireframe, Figma/Canva, screenshot, URL, pasted image) into working code using project tokens. Modes: Sketch → high-fi, 1:1 copy, Inspiration.

The router below classifies the argument and dispatches to the appropriate route reference file. Each route file is only loaded in sessions where it is needed.

**Related skills:** `/frontend-tokens` · `/frontend-check` · `/core-setup`

## References

- `../shared/DASHBOARD.md` — project.json schema and merge strategies
- `../shared/DESIGN.md` — Anti-patterns, color, typography, motion, UX writing
- `../shared/DEVINFO.md` — Session tracking, cross-skill handoff
- `../shared/BACKLOG.md` — Backlog HTML+JSON format, read/write protocol
- `../shared/CODEGEN.md` — Code-gen patterns (Build and Convert routes)
- `../shared/FRONTEND-RULES.md` — React/TypeScript coding rules (Convert route)
- `../shared/PATTERNS.md` — Component patterns (Convert route)
- `../shared/PLAYWRIGHT.md` — Playwright CLI, screenshot capture (Convert route)
- `./examples/` — Conversion examples (1:1, inspiration, Apple-style)
- External: `vercel-labs/web-interface-guidelines` — setup-context for Convert route (see `references/route-convert.md § Step 0`)

---

## State Machine

```
[*] → PREFLIGHT

PREFLIGHT → CONVERT_PATCH   (handoff build-incomplete + user picks Patch)
PREFLIGHT → DESIGN_ROUTE    ($ROUTE = design — no visual input)
PREFLIGHT → CONVERT_ROUTE   ($ROUTE = convert — visual input detected)
PREFLIGHT → ERROR           (pre-flight fail)

DESIGN_ROUTE  → [route-design.md state machine]
CONVERT_ROUTE → [route-convert.md state machine]
CONVERT_PATCH → CONVERT_ROUTE (with $PATCH_MODE = true)
```

---

## PHASE 0: Pre-flight & Route Classification

### 0.0 Directory Check

Check `.project/` exists. If not, create it.

```
Directory: [✓|✗] .project/ — [exists | created | error]
```

### 0.1 Session Check

Read `.project/session/devinfo.json`. Store as `$DEVINFO`.

```
Session: [✓] [New session | Continuing from {devinfo.handoff.source}]
```

### 0.2 Handoff Detection

Check `$DEVINFO.handoff.source === "build-incomplete"`.

**If handoff present AND `$SKILL_ARG` is empty AND no pasted image:**

Check `handoff.timestamp` — if older than 24h: show `"Handoff is {N}h old — may no longer be relevant"`.

```yaml
header: "Handoff from Build detected"
question: "Build of '{handoff.target}' is incomplete ({handoff.failedChecks}). Continue with patch on those files?"
options:
  - label: "Yes, patch (Recommended)", description: "Scope = patch, files from handoff"
  - label: "New screenshot", description: "Ignore handoff, continue normally"
  - label: "Cancel", description: "Stop, handoff remains for a later run"
multiSelect: false
```

On "Yes, patch":

1. Ask: `"Paste the desired final state as a screenshot"`
2. Store as `$SOURCE_IMAGE`. Set `$PATCH_MODE = true`, `$PATCH_FILE = handoff.files[0]`, `$BEFORE_SCREENSHOT = handoff.buildScreenshot` (if null: skip before-screenshot in patch-detection Step 2).
3. Set `$ROUTE = convert`. Handoff is cleaned up in the Convert route PHASE 4 after success.
4. Proceed to PHASE 0.3 (classification will be skipped — $ROUTE already set).

On "New screenshot": clear handoff signal, proceed to PHASE 0.3 normally.
On "Cancel": exit.

**If handoff present AND (`$SKILL_ARG` is not empty OR image is pasted):**

```yaml
header: "Handoff conflict"
question: "Build of '{handoff.target}' is incomplete. Patch it, or proceed with your new input?"
options:
  - label: "Patch the incomplete build (Recommended if {handoff.target} === {arg})", description: "Use patch flow for the previous build"
  - label: "Use my new input", description: "Ignore handoff, continue with the provided argument/image"
  - label: "Cancel", description: "Stop"
multiSelect: false
```

If `handoff.target === $SKILL_ARG`: mark "Patch" as Recommended. On "Patch": follow "Yes, patch" steps above. On "New input": proceed to PHASE 0.3 with the argument.

**If no handoff (or `handoff` empty/absent):** proceed directly to PHASE 0.3.

### 0.3 Route Classification

Classify the argument to set `$ROUTE`:

**Step 1 — Visual input (highest priority):**

`$SKILL_ARG` matches any of:

- Protocol prefix: `http://` or `https://`
- Design-tool domain: contains `figma.com` or `canva.com`
- Path separator: contains `/` or `\`
- Image extension: ends with `.png`, `.jpg`, `.jpeg`, `.webp`, `.gif`, `.svg`

**OR** an image is pasted in the chat.

→ `$ROUTE = convert`. Stop (proceed to dispatch).

**Step 2 — Name (design route):**

`$SKILL_ARG` is a non-empty string that does not match step 1 → `$ROUTE = design` (tentative — see Step 3).

The router passes `$SKILL_ARG` to route-design.md; argument-to-entity resolution (`$ARG_MODE` / `$ARG_TYPE` / `$ARG_ENTITY` / `$ARG_NAME`) happens in `route-design.md` PHASE 0.3.

**Step 3 — Backlog transition lookup (named entities only):**

Triggers when Step 2 set `$ROUTE = design` AND `$SKILL_ARG` is non-empty.

1. Check `.project/backlog.html` exists. If not → keep `$ROUTE = design`. Skip.
2. Read backlog per `shared/BACKLOG.md → Lifecycle Protocol → Read`. Find feature where `f.name === $SKILL_ARG` (case-sensitive).
3. No match → keep `$ROUTE = design`. Skip.
4. Match found and `f.transition === "converting"` →
   - Set `$ROUTE = convert`
   - Set `$CONVERT_TARGET = $SKILL_ARG`
   - Set `$BACKLOG_ROUTE_HINT = "transition=converting"`
5. Any other transition value (or absent) → keep `$ROUTE = design`.

**Step 4 — No argument:**

`$SKILL_ARG` is empty AND no image pasted AND `$ROUTE` not already set → `$ROUTE = design`.

**Pre-flight summary:**

```
PRE-FLIGHT CHECK
════════════════════════════════════════════════
Directory:  [✓|✗] .project/
Session:    [✓] [New session | Continuing from {skill}]
Route:      [Design | Convert{, patch mode}{, from backlog transition}]
════════════════════════════════════════════════
```

---

## Dispatch

**If `$ROUTE = design`:**

> **Todo**: Read `.claude/skills/frontend-design/references/route-design.md`

**If `$ROUTE = convert`:**

> **Todo**: Read `.claude/skills/frontend-design/references/route-convert.md`

---

## Restrictions

- Always run PHASE 0 before dispatching
- Never skip handoff detection
- Never guess $ROUTE — follow the classification steps exactly
- Never load both route files in the same session unless explicitly switching routes
