# CLAUDE.md Sync Protocol

Shared logic for CLAUDE.md updates. Used by `mode-resync` (full flow) and `mode-mature` PHASE 5.5 (partial flow after project.json sync).

See `references/claude-md-sections.md` for canonical section templates.

---

## Inputs (caller specifies)

| Parameter             | Type                               | Description                                                 |
| --------------------- | ---------------------------------- | ----------------------------------------------------------- |
| `mode`                | `"resync"` \| `"mature"`           | Determines report output and generate behavior              |
| `generate-if-missing` | `bool`                             | `true` → generate complete CLAUDE.md if missing (mature)    |
| `stack-overwrite`     | `"always"` \| `"ask"` \| `"never"` | Determines how `### Stack` is handled                       |
| `inferred-stack`      | object \| null                     | Stack inferred from PHASE 2 (mature only, otherwise `null`) |

---

## PHASE A: Detect

1. Check if `CLAUDE.md` exists.
   - Missing + `generate-if-missing=false` → exit with error: `CLAUDE.md not found — run /core-setup --mode=greenfield or create manually.`
   - Missing + `generate-if-missing=true` → go directly to **Generate complete** (skip PHASE B).

2. Read `CLAUDE.md` and the root `CLAUDE.base.md` (used for canonical marker templates).

3. Parse all section blocks marked by:

   ```
   <!-- claude-config:section:<id> start -->
   ...
   <!-- claude-config:section:<id> end -->
   ```

4. Classify each section:

   | Status         | Definition                                                             |
   | -------------- | ---------------------------------------------------------------------- |
   | **Missing**    | Marker exists in base, not in project → candidate to add               |
   | **Drift**      | Marker exists in both but content differs → candidate to update        |
   | **Match**      | Identical → skip                                                       |
   | **Local-only** | Marker in project but not in base → leave as-is, project customization |

5. **Handle `### Stack` separately** (only if `inferred-stack` is present):
   - Compare `### Stack` section in CLAUDE.md with `inferred-stack` values.
   - Classify as Stack-drift if they differ.

**Outside markers**: all content without a marker (User Preferences, Project, Project Context, custom edits) remains **unchanged**.

---

## Generate complete (if CLAUDE.md missing and generate-if-missing=true)

Generate a completely new `CLAUDE.md` with:

- All canonical sections from `references/claude-md-sections.md`
- Fill `### Stack` template with `inferred-stack` values (if present)
- `## Project Context` referencing `.project/project.json` and `.project/project-context.json`

Write directly — no modal needed. Go to PHASE D.

---

## PHASE B: Strategy

If there are no missing and no drift sections → skip PHASE B and C, go to PHASE D with message "already complete".

AskUserQuestion (multi-select) with drift/missing sections as options:

- **Default checked**: only missing sections (safe — adds, doesn't overwrite anything)
- **Default unchecked**: all drift sections (requires explicit opt-in — drift may be an intentional user edit)
- Per drift section: show inline diff (project ↔ base)
- **Stack-drift item** (only if `stack-overwrite="ask"` and Stack-drift present):
  - Separate checkbox: `### Stack — update to actual stack`
  - Inline diff: CLAUDE.md current stack ↔ `inferred-stack`
  - Default unchecked

If `stack-overwrite="always"`: replace `### Stack` without modal, before PHASE B.

---

## PHASE C: Apply

Write only selected changes. Placeholder substitutions (`{{PROJECT_NAME}}` etc.) are outside markers and remain untouched.

Per chosen section: replace content between markers with base version. Stack-overwrite: replace `### Stack` block with `inferred-stack` values.

---

## PHASE D: Report

**Resync mode** — standalone ASCII table:

```
| Section | Action                                    | Source version |
| ------- | ----------------------------------------- | -------------- |
| {id}    | added / updated / kept-local / skipped    | {base version} |
```

**Mature mode** — summarized as a single line in PHASE 6 report:

```
CLAUDE.md: {generated | {N} sections added | already complete}
```
