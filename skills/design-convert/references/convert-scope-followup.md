# Convert Scope Follow-up

Loaded from `route-convert.md` PHASE 0.4c, only for `$SCOPE ∈ {"Full page", "Single component"}` —
patch has its own follow-up (0.4b), audit has its own (`convert-audit-scope.md`). Decides **which
sections** this run touches and **whether** it builds layout or fills content, so a long page can be
split across several runs instead of converted in one pass.

---

## 1. Resolve the candidate pool

Reuse `$RESUME_STATE` from `route-convert.md § 0.26` if it was set. Otherwise (first-ever run on this
target, `$RESUME_STATE = null`): `$UNBUILT = $ANALYSIS.Sections` (every section from 0.2, none built
yet) and `$BUILT_NO_CONTENT = []`.

## 2. Aspect gate

Only ask when genuinely ambiguous — a moot option is omitted, not asked and then ignored:

- `$BUILT_NO_CONTENT` is empty → `$ASPECT = "build"`, no question (nothing built yet to fill content
  for).
- `$UNBUILT` is empty → `$ASPECT = "content"`, no question (the page is already fully built; the only
  thing left is content).
- Both non-empty → ask:

  ```yaml
  header: "Aspect"
  question: "What do you want to do for {target}?"
  options:
    - label: "Build layout"
      description: "Generate markup/styling for unbuilt sections — content stays placeholder"
    - label: "Fill content"
      description: "Write real on-brand copy for sections already built — no layout changes"
  multiSelect: false
  ```

  Mark "Build layout" `(Recommended)` when `len($UNBUILT) >= len($BUILT_NO_CONTENT)`, else mark "Fill
  content" `(Recommended)` — whichever bucket has more outstanding work is the more likely next step.

## 3. Section picker

Pool = `$UNBUILT` when `$ASPECT = "build"`, else `$BUILT_NO_CONTENT`.

- **Pool empty** (can only happen if step 2 mis-set `$ASPECT` — defensive only): fall back to the
  other bucket; if that is also empty, skip this step entirely and treat the run as a normal full
  build/fill (no section scoping — `$BUILD_SECTIONS = null`).
- **Pool size ≤ 4**: standard modal, one option per section, `multiSelect: true`.

  ```yaml
  header: "Sections"
  question: "Which section(s) should this run cover?"
  options:
    - label: "All {N} sections (Recommended)"
      description: "{comma-joined section names}"
    - label: "{section name}"
      description: "…"
    # one row per section in the pool
  multiSelect: true
  ```

- **Pool size > 4**: print the full pool as a numbered prose list above the modal (same workaround
  already used at `route-convert.md § 0.6b`), then offer buckets instead of one option per section:

  ```yaml
  header: "Sections"
  question: "Which section(s) should this run cover? (see the numbered list above)"
  options:
    - label: "All {N} sections (Recommended)"
      description: "Cover the full pool listed above"
    - label: "Only the next section"
      description: "Just {pool[0]} — smallest possible run"
  multiSelect: false
  ```

  A pick outside these two (e.g. "1, 3, 5") reaches the built-in Other free-text option — parse it
  against the numbered list.

Store the resolved list as `$BUILD_SECTIONS[]`.

## 4. Branch

- **`$ASPECT = "content"`** → skip `route-convert.md § 0.5` (Backlog Task Lookup — the target name is
  already resolved) and continue at **§ 0.5b** (worktree setup — content-fill still Edits app code, so
  it still needs the rollback safety net), then **§ 0.5c**, then jump directly to **PHASE 2c: Content
  Fill** — PHASE 0.6/0.6b/0.6c, PHASE 1 and PHASE 2 are all skipped; none of them apply to a text-only
  run.
- **`$ASPECT = "build"`** → continue exactly as today from `route-convert.md § 0.5` onward.
  `$BUILD_SECTIONS` (when non-null) scopes PHASE 2's `Strategy per section` plan (§ 2.1) — sections
  outside it are not generated and not stubbed this run — and `convert-verification-loop.md`'s vision
  comparison (sections outside it are reported `deferred (not in this run's scope)`, never as
  missing).
