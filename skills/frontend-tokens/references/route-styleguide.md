# Route: Extract from styleguide

Extracts design tokens from an external brand document: PDF, image (PNG/JPG), or URL. Use when the user has a huisstijl, brand guideline, or visual identity document.

Scope: colors, typography, borderRadius, button styles, logo/spacing hints. Does **not** replace `motion/route-create.md` or spacing scale — those remain separate steps.

---

## Step 1: Request source

**AskUserQuestion:**

```yaml
header: "Source"
question: "What's the source of your brand document?"
options:
  - label: "File path (PDF or image)", description: "Provide the local path to the file"
  - label: "URL", description: "Provide a web URL to the brand page or asset"
multiSelect: false
```

After selection, ask for the path/URL as a follow-up if not already provided in the user's message. Check if value was already given in the triggering message — if so, skip the question.

---

## Step 2: Load document

- **PDF or image (file path):** Use the Read tool. Claude is multimodal — it can read PDFs and images directly.
- **URL:** Use WebFetch. If the URL returns HTML, look for inline color swatches, font-family declarations, `og:image` meta, and linked CSS.

If the file or URL is not found → show error and ask user to re-enter.

---

## Step 3: Extraction

Extract all available tokens. For each, record: token name (inferred), value, and usage (how it's used in the brand doc).

**Target categories:**

| Category | What to look for |
|----------|-----------------|
| Colors | Color swatches, hex codes, CMYK/Pantone with conversion, background/foreground usage |
| Typography | Font family names, size scale, weight usage (headings vs body), line height hints |
| Border radius | Buttons/cards with rounded corners — estimate px from visual if not stated explicitly |
| Button styles | Shape (rounded-full vs rounded-md), fill vs outline vs ghost, CTA vs secondary |
| Logo/spacing | Whitespace around logo (clearspace rule), column grid hints |
| Shadows | Any drop shadow, elevation, or card shadow references |

Mark categories not found as `null` — these will be filled by Fill-In route or manual input.

---

## Step 4: Show extraction table

```
STYLEGUIDE EXTRACTION
════════════════════════════════════════════════
Source: {filename or URL}

COLORS
  ✓ {N} colors found:
  | Token              | Value    | Usage                  |
  |--------------------|----------|------------------------|
  | color-primary      | #2B2171  | Primary brand color    |
  | color-accent       | #F39200  | CTA, highlights        |
  | ...                | ...      | ...                    |

TYPOGRAPHY
  ✓ Families: {font list}
  ✓ Scale: {size list or "not specified"}

BORDER RADIUS
  ✓ Card: {value}
  ✓ Button: {value}
  ⚠ Not found: borderRadius-sm, borderRadius-lg (will use defaults)

BUTTON STYLES
  ✓ Primary: {shape, fill}
  ✓ Secondary: {shape, variant}

SHADOWS / SPACING
  {found / ⚠ Not found}

Summary: {N} categories extracted · {M} null (will need Fill-In)
════════════════════════════════════════════════
```

---

## Step 5: Confirm and map to theme schema

**AskUserQuestion:**

```yaml
header: "Extraction"
question: "Does this look correct? Proceed to write these tokens to the theme?"
options:
  - label: "Yes, write to theme (Recommended)", description: "Saves extracted tokens to .project/project.json theme section"
  - label: "Adjust first", description: "I want to correct some values before saving"
  - label: "Cancel", description: "Discard extraction"
multiSelect: false
```

If "Adjust first": ask which category to adjust, let user provide corrected values, then re-show summary.

---

## Step 6: Write to project.json

Map extracted values to the `theme` JSON schema (per `references/THEME_TEMPLATE.md`).

- Null categories are omitted (not written as empty keys).
- Existing theme data: if a key already exists, show a diff and confirm overwrite.
- After writing: check which theme sections are still missing → set `$MISSING_SECTIONS` for postflight.

→ Go to PHASE X: Post-flight Validation  
→ Go to X.6: Theme Infrastructure Sync  
→ Go to X.7: Backlog Write

---

## Step 7: Return or suggest next step

**If called from `route-create.md` Step 0.5 (Create context):**

- Set `$EXTRACTED_SECTIONS` = list of sections written (e.g. `["colors", "typography", "borderRadius"]`).
- Do NOT run PHASE X postflight or Backlog Write here — those run at the end of the Create flow.
- Return to `route-create.md` Step 1. The per-step skip logic will handle already-extracted sections.

**If called standalone (from ACTION_SELECT):**

→ Go to PHASE X: Post-flight Validation  
→ Go to X.6: Theme Infrastructure Sync  
→ Go to X.7: Backlog Write

If `$MISSING_SECTIONS` is non-empty:

```
⚠ {N} sections still missing: {list}
→ Run /frontend-tokens → Fill in to complete the remaining sections.
```

If all 10 sections filled:

```
✓ All sections complete.
→ Run /frontend-tokens → Motion Pack to add animation (spring physics, glass surfaces).
```
