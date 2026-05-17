# Route: Import (Extract from Codebase or Screenshot)

#### Step 0: Input Selection

```yaml
header: "Import"
question: "What is your input?"
options:
  - label: "Codebase (Recommended)", description: "Scan framework files for pages and flows"
  - label: "Screenshot", description: "Analyze a screenshot of an existing design"
multiSelect: false
```

**If "Screenshot":** go to Step 0b. **If "Codebase":** go to Step 1.

#### Step 0b: Screenshot Analysis

1. **Detect input method:**
   - If there are **multiple images** in the conversation → report count and proceed directly to analysis:
     ```
     ℹ {N} screenshots detected — each image will be analyzed as a separate page.
     ```
   - If there is **one image** in the conversation → use it directly.
   - If there is **no image** in the conversation:

     ```yaml
     header: "Screenshot"
     question: "Add a screenshot to your next message, or provide a file path."
     options:
       - label: "I'll add it (Recommended)", description: "Drag or use the attachment button in VSCode"
       - label: "File path", description: "Provide an absolute or relative path"
     multiSelect: false
     ```

     - "I'll add it": wait for the next message and use the attached image(s).
     - "File path": read the image via the Read tool at the given path.

2. **Analyze visually (Claude Vision):**

   Per image separately:
   - Detect page type (landing, dashboard, form, checkout, settings, etc.)
   - Identify visible sections (hero, nav, sidebar, content-area, footer, cards, etc.)
   - Infer purpose from layout and visible content

   For multiple images: spawn N agents in parallel (one per image), merge results, show progress:

   ```
   Image 1/{N}: [page type] — {M} sections detected
   Image 2/{N}: [page type] — {M} sections detected
   ...
   ```

3. **Generate page object per image:**

   ```json
   {
     "name": "{slug of page type}",
     "purpose": "{derived from screenshot — 1-2 sentences}",
     "status": "IDEA",
     "sections": ["{section1}", "{section2}"],
     "flows": [],
     "notes": "Imported via screenshot"
   }
   ```

   Deduplicate on `name`: if two screenshots detect the same page type, suffix the second with `-2`.

4. Go to Step 4: Present and Confirm (table shows all imported page objects as rows).

---

#### Step 1: Scan

Glob for page files AND component files in common framework patterns:

**Pages:**

| Framework          | Pattern                     |
| ------------------ | --------------------------- |
| Next.js App Router | `app/**/page.{tsx,jsx}`     |
| Next.js Pages      | `src/pages/**/*.{tsx,jsx}`  |
| Vite + React       | `src/pages/**/*.{tsx,jsx}`  |
| Remix              | `app/routes/**/*.{tsx,jsx}` |
| Astro              | `src/pages/**/*.astro`      |

**Components** (scan alongside pages):

- `src/components/**/*.{tsx,jsx,svelte,vue,astro}`
- `app/components/**/*.{tsx,jsx}`
- `src/components/ui/**/*.{tsx,jsx}` (shadcn/ui convention)
- Exclude: `_dev/`, `node_modules/`, `*.test.*`, `*.stories.*`

```
SCAN RESULT
════════════════════════════════════════════════
Framework:   [detected]
Pages:       {N} found
Components:  {M} found
════════════════════════════════════════════════
```

#### Step 2: Parse Pages

For each detected page file:

- Extract page name from file path
- Analyze imports to detect section components → populate `uses[]`
- Infer purpose from component names and composition

#### Step 2b: Parse Components

For each detected component file (parallel with Step 2):

1. Extract component name from filename (PascalCase)
2. Check if name already in `design.components[]` → skip if existing
3. Detect scope heuristic:
   - File in `layout.tsx` import tree → `scope: layout`
   - Imported by ≥2 pages → `scope: section` or `atomic`
   - Only in `ui/` folder → `scope: atomic`
   - Standalone in `components/` → `scope: section`
4. Detect cva-variants/sizes via regex: `variants.variant[]`, `variants.size[]`
5. Scan all page imports → populate `usedIn[]`
6. Generate component object with `status: BLT` (already built)

Show preview of detected components:

```
COMPONENTS FOUND
════════════════════════════════════════════════
| Name    | Scope   | Variants          | UsedIn      |
|---------|---------|-------------------|-------------|
| Button  | atomic  | primary/ghost/... | dashboard   |
| NavBar  | layout  | —                 | (all pages) |
| StatCard| section | —                 | dashboard   |
════════════════════════════════════════════════
```

```yaml
header: "Import components"
question: "Which components do you want to include in the design spec?"
options:
  - label: "All ({M} components)", description: "Add all found components"
  - label: "Select", description: "Choose manually which ones"
  - label: "None", description: "Skip component import"
multiSelect: false
```

For "Select": show as multiSelect with all component names as options.

#### Step 3: Infer Flows

From routing structure and navigation components (Link, useRouter, navigate), infer user flows between pages.

#### Step 4: Present and Confirm

Show extracted design spec in same table format as Create Step 5, including components table if components were imported. Proceed to PHASE 3 (Confirm).
