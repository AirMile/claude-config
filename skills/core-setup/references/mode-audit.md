# Audit Mode

Scan the project and suggest improvements without a full setup. Non-destructive: no files are changed without explicit opt-in.

**Skip Phase 2-4, go directly to audit.**

---

## PHASE 1: Project Scan

1. Scan for missing essentials:
   - Formatter config (`.prettierrc`, `pyproject.toml [tool.black]`, etc.)
   - `.env.example`
   - `.gitignore`
   - Type checking config (`tsconfig.json`, `mypy.ini`, etc.)
   - Testing framework (`jest.config`, `vitest.config`, `pytest.ini`, etc.)

2. Check Claude config:
   - `.claude/settings.local.json` present?
   - `format-on-save` hook configured?
   - Permissions set?

3. Check CLAUDE.md:
   - Exists?
   - Has canonical sections? (see `references/claude-md-sections.md`)
   - Is `### Stack` up-to-date with actual `package.json` / project files?

4. Check `.project/project.json`:
   - Exists?
   - `stack` section filled?
   - `concept` present?

5. Check design tokens (frontend projects only):
   - Detect `stack.framework` from `.project/project.json`, or if missing, from `package.json` dependencies
   - Frontend trigger: framework ∈ {React, Vue, Svelte, Next.js, Nuxt, Astro, Remix, SolidJS}
   - `needsTheme` = `project.json#theme.colors` missing or empty
   - Store finding as `frontend_needs_theme` (only true when both conditions hold)

6. Tier-1 module sweep:
   For each module in the tier-1 set (see `references/mode-install.md` tier-1 table):
   - Read `references/modules/{module}/setup-guide.md` Detection section
   - Apply the described check to the project (package.json + config files)
   - Store result: `already-installed-configured` | `installed-not-configured` | `not-installed`

   Cache results as `module_states` for PHASE 2. Do not store `not-installed` modules as findings (only the two installed states are relevant for audit).

---

## PHASE 2: Present Findings

Present findings as a checklist via AskUserQuestion (multi-select): which fixes to apply?

Format per finding:

```
[ ] ✗ {missing item} — {brief reason why it's useful}
```

Default: all critical items checked (formatter, .gitignore, type checking). Optional items (testing framework) default unchecked.

Show design-tokens item only if `frontend_needs_theme = true` (from PHASE 1 step 5). Show as optional item, default unchecked:

```
[ ] ✗ design-tokens — frontend stack without color/typography/spacing tokens
```

Module sweep findings from PHASE 1 step 6 (only show if `module_states` is not empty):

```
[ ] ⚠ {module} — installed-not-configured ({configfile} missing)
[ ] ℹ {module} — already-installed-configured (no action needed)
```

`installed-not-configured` items default checked — these are high-signal (library present, config missing or broken). `already-installed-configured` items default unchecked and informational only.

---

## PHASE 3: Apply Selected Fixes

For each selected fix:

- **Tier-1 module (installed-not-configured)**: delegate to `references/mode-install.md` PHASE 5 for that specific module. Step 0 detects `installed-not-configured` → skips install, starts at step 2 Configure.
- **Formatter config**: generate config file based on detected stack
- **.env.example**: generate empty template with comment per section
- **.gitignore**: generate based on stack (Node/Python/Go/Rust/etc.). Always append `.project/` if not present: `grep -qxF '.project/' .gitignore 2>/dev/null || echo '.project/' >> .gitignore`
- **Type checking**: generate `tsconfig.json` / `mypy.ini` with strict-mode defaults
- **Testing framework**: ask choice (Vitest/Jest/Playwright for JS, pytest for Python, etc.), generate config
- **Claude config**: write `settings.local.json` with Full Access defaults + format-on-save hook for detected stack
- **CLAUDE.md**: add missing canonical sections (see `references/claude-md-sections.md`). Existing content unchanged.
- **project.json**: create or fill missing `concept`/`stack` fields via short prompt (name, description)
- **design-tokens**: seed `setup-design-tokens` feature to `.project/backlog.json`:
  ```json
  {
    "name": "setup-design-tokens",
    "type": "THEME",
    "status": "TODO",
    "phase": "P1",
    "description": "Define color palette, typography scale, and spacing tokens via /frontend-tokens before UI work begins.",
    "source": "/core-setup",
    "dependencies": []
  }
  ```
  Create `.project/backlog.json` with the schemaVersion-2 scaffold (see `shared/BACKLOG.md`) if missing. Skip if feature named `setup-design-tokens` already exists (idempotent).

---

## PHASE 3b: Protect `.project/` (always runs)

After all selected fixes, always run this guard — regardless of whether `.gitignore` was a selected fix:

1. **Ensure `.project/` is gitignored** (idempotent):

   ```bash
   grep -qxF '.project/' .gitignore 2>/dev/null || echo '.project/' >> .gitignore
   ```

2. **Untrack guard** — if `.project/` files are in the git index, they should be removed (they are developer-local state, never repo state):
   ```bash
   TRACKED=$(git ls-files | grep -E '^\.project/')
   ```
   If `$TRACKED` is non-empty → AskUserQuestion: "These `.project/` files are tracked in git but should be local-only: {list}. Remove from the git index?" → **"Yes, remove (Recommended)"** (`git rm --cached -r .project/` — files stay on disk) | "No, leave as is".

This corrects accidental tracking rather than hiding it with skip-worktree. (Analogous to `references/mode-mature.md` PHASE 0.4.)

---

## PHASE 4: Summary

Render rule: bullets with `{if <condition>}` prefix only show when condition is true — prefix not literally in output. `design-tokens-applied` is true when user checked `design-tokens` in PHASE 2 and PHASE 3 completed successfully.

```
AUDIT COMPLETE

Fixes applied:
  {N} files created/updated

Skipped:
  {M} items (not selected)

Next step:
  /core-setup                 → deep codebase scan + learnings extraction
  /core-setup --mode=resync   → resync CLAUDE.md template sections
{if design-tokens-applied}  /frontend-tokens            → design tokens (color, typography, spacing)
```
