# Design Fidelity Audit (scope = audit)

Reconciles an already-built page against its full Figma design and patches wrong-but-plausible values — the motivating case: a card `background-color: #141414` (near-black) hardcoded in code while Figma specifies `#00111e` (navy), which a thumbnail visual diff never catches. Unlike patch detection (which diffs a NEW screenshot against the CURRENT render and never consults the design), the audit sweeps EVERY section, pulls exact Figma values per section node, and diffs them against the rendered values.

**Reached from** route-convert PHASE 0.4 (`$SCOPE = "audit"`). Runs after 0.5 (backlog), 0.5b (worktree), 0.6 (theme + light component scan). Replaces PHASE 1 + code generation: it ends with a confirmed `$PATCH_SECTIONS`, then hands back to the route's **PHASE 2.0 Patch Guard** for application and **PHASE 3** for verification (including 3.2c).

**Requires ground truth** — valid only when `$INPUT_SOURCE ∈ {figma-mcp, figma-rest, url}` (enforced by the availability guard in route-convert PHASE 0.4).

**Vars produced:** `$AUDIT_SECTIONS` (section map), `$SECTION_GROUND_TRUTH` (per-section Figma values), `$DISCREPANCIES` (report), `$PATCH_SECTIONS` (accepted mismatches — consumed by PHASE 2.0, same shape convention as the patch path).

**Extraction overrides `$MODE`:** the audit always compares against exact Figma values (copy-mode Ground-Truth Extraction, see `convert-mode-copy.md § 1.0`). `$MODE` is not selected for this scope — it only matters if the audit surfaces a section present in Figma but entirely missing from code, in which case that one section falls back to the normal mode-selection + PHASE 1 flow before rejoining the audit report.

---

#### Step A: Section discovery + Figma↔code mapping

1. Locate the built page. Use `$CONVERT_TARGET` (from 0.5) → its page file + the section components from 0.6's light component scan. Read the page file for the rendered section order (top-to-bottom JSX/import order) → `$CODE_SECTIONS = [{name, file, order}]`.
2. Enumerate Figma sections from the full-page frame's `get_metadata` result (`$SOURCE_STRUCTURE` from 0.1, when it fit inline).
   - **Overflow-to-file (required handling):** on a full-page frame, `get_metadata` routinely exceeds the MCP token limit and dumps the outline to a file. Do NOT treat the page as one blob and do NOT fall back to a single `get_design_context` on the whole frame (that collapses every section's fills into one result). Instead: Read the dumped file (`$SOURCE_STRUCTURE_FILE` from 0.1), harvest the immediate child node-ids of the top-level frame — each top-level child is a section — record `{figmaNodeId, name, x, y, w, h}`, sort by `y` → `$FIGMA_SECTIONS`.
3. **Content-source tag (per code section):** does the section's component render literal content (text/images in JSX), or does it consume props/data from a fetching call — a CMS client import, a `get*()` query function, an API fetch — instead? This matters because a mismatch in a CMS-backed section isn't fixable with an Edit: tag each `$CODE_SECTIONS` entry `contentSource: "code"` (literal, `codeFile` is the patch target) or `contentSource: "cms"` (data-fetched — note the query/client call site and, if resolvable, the underlying dataset/document reference instead of a patchable file location). Do not silently drop `contentSource: "cms"` sections from the audit — they get ground-truth-compared like any other section (Step B/C), only their *patch* path differs (`route-convert.md` PHASE 2.0 §2a).
4. Align `$FIGMA_SECTIONS` ↔ `$CODE_SECTIONS`. Layer names are typically generic ("Container", "Rectangle 8/9") or non-obvious (e.g. a "Brandveiligheids opsomming" frame that is actually the compliance section) — **do not match by name**. Align by **vertical order + bounding-box position**, cross-checked against `$SOURCE_IMAGE` (frame screenshot) and a Playwright/Claude-in-Chrome screenshot of the live page. Produce `$AUDIT_SECTIONS = [{name (code), figmaNodeId, contentSource, codeFile (contentSource="code") | dataSource (contentSource="cms"), domSelector, bbox}]`.
5. If section counts differ or any alignment is ambiguous, confirm the mapping with the user (AskUserQuestion, one row per uncertain pair, plus explicit "Figma section has no code match (missing)" / "code section has no Figma match (extra)" rows). **Skip this prompt when the mapping is a clean 1:1 by order and position** — don't turn a routine audit into a modal per run.

#### Step B: Per-section ground-truth extraction

For each `$AUDIT_SECTIONS` entry, pull exact Figma values from the **section node** — never the whole frame. Under `$AUDIT_PROPERTY_SCOPE = "content"` (route-convert.md PHASE 0.4 follow-up), extract only text and image-asset references per section — skip fills/typography/radii/spacing entirely, there is nothing downstream that will compare them (Step C, and PHASE 3.2c, both become no-ops for style under this scope).

**Delegation (`$AUDIT_SECTIONS.length >= 4`):** dispatch one fresh (sonnet) agent to run every section's extraction — do not fan out N parallel forks (forks run the parent model and re-read the full conversation as cached input per fork; for N independent mechanical MCP calls that's the most expensive shape available, not the cheapest — see `shared/SKILL-PATTERNS.md § Fork Delegation`). Pass the agent `$AUDIT_SECTIONS` node-ids and the active `$AUDIT_PROPERTY_SCOPE` (not conversation content — `§ Pass Paths, Not Content`); it runs steps 1-2 below per section and returns one compact, **verbatim-exact** digest array — not a paraphrase or summary, Step C does exact string/hex compares and a lossy digest silently corrupts ground truth:

```
{section, figmaNodeId, text: [...], imageAssetUrls: [...],
 keyStyleValues: {...} }   // keyStyleValues omitted entirely when scope = "content"
```

Below the threshold (< 4 sections), or when agent delegation is unavailable, run steps 1-2 inline as before — delegation overhead isn't worth it for a handful of sections.

1. `get_design_context` on `figmaNodeId` → exact fills, text, typography, radii, spacing (or, under content scope, text + image assets only) → `$SECTION_GROUND_TRUTH[section]`.
2. `get_variable_defs` on `figmaNodeId` will typically return `{}` on files without bound variables (raw hex fills) — that is normal (see `convert-mode-copy.md § 1.0`), not a failure. **Skip this call per-section** if the whole-frame `get_variable_defs` in 0.1 already returned `{}` — that result holds for every section of the same file, so repeating it N times per audit only adds empty round-trips. Only call it per-section when the whole-frame check returned actual bindings, and never call it at all under content scope (no style values are being compared). Exact values come from `get_design_context` regardless.

This is what fixes the single-target-frame gap: ground truth is pulled per section, not once for the whole page.

#### Step C: Discrepancy report

**Escalation check (run first):** if Step A found the mapping to be a clean 1:1 by order and position for **most** sections, proceed with the property-level diff below. If instead a large share of sections are missing/extra/reordered (rule of thumb: more than 1-2 sections affected, or the page reads as a different composition rather than a drifted one) — this is a **structural mismatch**, not a value mismatch. Skip the property-level diff entirely (it would either flood the report with near-100% "MISMATCH" rows from copy differences, or miss the actually-actionable finding) and instead emit a structural report: per section, `present in code (right position) | present but reordered | missing in code | extra in code`, plus a one-line content-delta note (e.g. "Figma has 6 grid items, code has 4 stacked cards — different composition, not just wrong values"). Carry this into Step D's escalated question below.

Render the live page (reuse `convert-patch-detection.md` Step 2 conventions — start the dev server per PHASE 3.1 if needed, then `navigate`/`goto` + screenshot). For `contentSource: "cms"` sections mutated earlier in this run, hard-reload / bypass cache before rendering — a stale ISR/data-cache response reads as an unfixed mismatch. For each section, extract rendered computed styles scoped to that section's DOM node — reuse the `getComputedStyle` snippet from `convert-mode-copy.md § 1.0`, scoped via `domSelector` — then diff against `$SECTION_GROUND_TRUTH`.

**Scope gate:** under `$AUDIT_PROPERTY_SCOPE = "content"` (route-convert.md PHASE 0.4 follow-up), compare only exact text content and images — skip `background-color`/`color`/`border-radius`/spacing/font entirely, both extraction (Step B) and comparison. State the active scope in the report header (`CONTENT & IMAGE AUDIT` vs the full `DESIGN FIDELITY AUDIT`) so the user can see what was and wasn't checked. Otherwise (scope = `everything`), compare, per section: `background-color`, `color`, `border-radius`, key spacing (`padding`/`gap`), `font-size`/`font-weight`, exact text content, image `src`.

- **Color:** normalize both sides to rgb; exact match required (allow ≤2/255 per-channel rounding delta only). `#141414` vs `#00111e` is a large delta → MISMATCH.
- **Text:** trimmed exact string compare. **Content-fill guard:** check the backlog feature first — if the page went through `/design-content` (feature has `contentStatus: "filled"`, or `contentStatus` was reset by a re-convert after a fill): the code's copy was _deliberately rewritten_ and Figma's text is the outdated side. Under scope = `everything`, report text differences as `ℹ INFO (copy intentionally rewritten)` and exclude them from the default `$PATCH_SECTIONS` (opt back in via Step D's "Select which to fix"). Under scope = `content`, the user explicitly asked to reconcile content — don't let this guard exclude the entire audit; keep the `ℹ INFO` label on each affected row (so the deliberate-rewrite context isn't lost) but still surface it as a selectable row in Step D rather than dropping it. Without a content-fill signal, exact compare applies as-is.
- **Image:** Figma ground truth rarely yields a comparable `src` string (assets are exported PNGs/JPEGs, not stable URLs) — this is a judgment call, not a string diff. Compare the section's rendered screenshot against the Figma section screenshot (`get_screenshot` on `figmaNodeId`): a placeholder/stock/generic photo where Figma shows a specific real one is a MISMATCH, flagged `✗ MISMATCH (wrong photo)`, not silently skipped for lack of an exact-match mechanism. **When the user names or provides an external asset source** (a shared Drive/asset folder, a brand library) instead of or alongside Figma: that folder is ground truth for the image row, not Figma — Figma still confirms *which subject* belongs in the section (composition/placement), the external source supplies the actual file. Browse it, match by visual subject per section, and flag `✗ MISMATCH (higher-quality source available)` for a photo that already shows the right subject but is sourced from a lower-resolution export than the external library offers — this is a distinct row type from wrong-subject, and the fix is a file swap, not a re-selection of which photo belongs there.
- **Spacing / radius:** exact px, ≤1px rounding tolerance. (Skipped entirely under scope = `content` — see Scope gate above.)

Emit the report inline (same convention as PATCH ANALYSIS / FIDELITY EXTRACTION — no file written):

```
DESIGN FIDELITY AUDIT
════════════════════════════════════════════════════════════
Section: [name]  →  [codeFile]
  Property           Figma       Code        Verdict
  background-color   #00111e     #141414     ✗ MISMATCH
  border-radius      12px        12px        ✓
  h2 color           #ffffff     #ffffff     ✓

Section: [name]  →  [codeFile]
  ...

Missing in code:   [Figma sections with no code match, if any]
Extra in code:     [code sections with no Figma match, if any]
────────────────────────────────────────────────────────────
Mismatches: [N] across [M] sections
════════════════════════════════════════════════════════════
```

Store as `$DISCREPANCIES`.

#### Step D: Confirm + hand-off

**If the Step C escalation check fired (structural mismatch):** the `{file, property, oldValue, figmaValue}` shape below doesn't fit — a missing/extra/reordered section isn't a value swap. Ask instead:

```yaml
header: "Aanpak"
question: "This is a structural mismatch, not a value drift — how thorough should the fix be?"
options:
  - label: "Full restructure (Recommended)", description: "Reorder sections, add missing ones, retire/relocate extras, align copy per section"
  - label: "Only the sections you named", description: "Limit to what was explicitly asked about; leave the rest of the structure as-is"
  - label: "Keep structure, fix values only", description: "Leave sections/order/copy alone; patch only unambiguous value errors within existing sections"
multiSelect: false
```

Store the resulting per-section work items (add/reorder/retire/rewrite) as `$PATCH_SECTIONS` in whatever shape fits — this scope doesn't use `{file, property, oldValue, figmaValue}`, since the unit of change is a section, not a property. PHASE 2.0 Patch Guard's "direct value swap" instruction does not apply here; treat added/rewritten sections as normal codegen (Write for new files, full-file Edit for rewrites) and skip straight to PHASE 3 for verification once applied.

**Otherwise (value-level mismatches only):**

```yaml
header: "Audit fixes"
question: "Apply these [N] fixes to match the design?"
options:
  - label: "Yes, patch all mismatches (Recommended)", description: "Edit each flagged value to the Figma value — changed values only, untouched code stays untouched"
  - label: "Select which to fix", description: "Choose a subset — by number (1,3,5), or by category (e.g. 'all content + image rows', 'all text')"
  - label: "Report only", description: "Keep the report, make no edits"
multiSelect: false
```

"Select which to fix" accepts both a numbered selection (`SKILL-PATTERNS.md § Numbered List Selection` syntax) and a category keyword matching the report's row groupings (e.g. "images", "text", "certifications") — useful when the scope decision is made *after* seeing the report rather than up front at PHASE 0.4 (a real, observed path: a user restricting scope only once they saw which findings were style-only noise).

Store accepted mismatches as `$PATCH_SECTIONS` — one entry per mismatch carrying `{file, property, oldValue, figmaValue}` for `contentSource: "code"` sections, or `{dataSource, property, oldValue, figmaValue}` (no `file`) for `contentSource: "cms"` sections — PHASE 2.0 §2a reads the latter. "Report only" → `$PATCH_SECTIONS = []` (PHASE 2.0 becomes a no-op; the report still ships in the PHASE 4 completion report).

> **Todo**: Use the `ExitPlanMode` tool now (if plan mode is active) — present the DESIGN FIDELITY AUDIT report as plan output. PHASE 2.0 Patch Guard (Edits) then runs in Sonnet. This is the audit path's single `ExitPlanMode` point (mirrors patch detection Step 4).

Return to route-convert **PHASE 2.0 Patch Guard**.
