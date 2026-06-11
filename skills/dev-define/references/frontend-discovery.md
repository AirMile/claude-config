# Dev Define — Frontend Discovery (PHASE 1b tail)

Loaded only for frontend projects with feature types outside `COMPONENT`, `INTEGRATION`, `THEME`, `A11Y`, `PERF`, `INFRA`, `DOCS`. Two steps: Reuse-Discovery, then Page-placement sparring.

---

## Reuse-Discovery

Scan the extracted requirements (description + acceptance) for UI-element keywords — canonical list: [shared/SKILL-PATTERNS.md § Reuse-Discovery → dev-define trigger](../../shared/SKILL-PATTERNS.md#reuse-discovery). Apply project-specific prefixes too.

**Self-reference filter (always apply):** skip a match if the kebab-cased keyword appears in the current feature name (e.g. feature `kelly-slider` → skip "Slider" match, feature `event-modal` → skip "Modal" match). Prevents self-dependencies.

**On 1+ remaining match:**

1. Per match: kebab-case the name (e.g. "Select" → `currency-select` with context prefix when available).
2. Show inline: `Reuse detected: {kebab-name}` — one line per match, before adding to dependencies.
3. Append to the in-memory `discoveredComponents[]` (carried to PHASE 4 sync).
4. Append the kebab-name to the current feature's `dependencies[]`.

**Source:** `"/dev-define"` · **Direction:** `"dev→frontend"` · **Type:** `COMPONENT`

For the shared sync implementation of `discoveredComponents` in PHASE 4, see [shared/SKILL-PATTERNS.md#reuse-discovery](../../shared/SKILL-PATTERNS.md#reuse-discovery).

---

## Page-placement sparring

Skip for pure API/backend/game features. After Reuse-Discovery, ask which PAGE(s) this feature surfaces on. This writes `pageHint[]` to `feature.json` (PHASE 3) and enables `/frontend-design` Build to pre-populate its composition menu.

1. Read `.project/backlog.json` → collect all PAGE-type features (any status). Read `project.json#design.pages[]` — collect page names. Merge both lists (dedupe by name) as `$KNOWN_PAGES`.

2. ```yaml
   header: "Page placement"
   question: "On which page(s) does '{feature-name}' appear? (select all that apply)"
   options:
     - label: "{page-name-1}", description: "Existing PAGE in backlog/design"
     - label: "{page-name-2}", description: "..."
     - label: "+ New page", description: "This feature introduces a new screen"
     - label: "Not on a page (API/service only)", description: "Skip — no UI placement"
   multiSelect: true
   ```

   Show max 3 known pages as options; use "Other" for the rest. Always include "+ New page" and "Not on a page" as last two options.

3. **If "+ New page" selected:** follow [Smart-Todo Creation — "new PAGE"](../../shared/SKILL-PATTERNS.md#smart-todo-creation). Add the created PAGE name to `$PAGE_HINTS`.

4. **If "Not on a page" selected:** set `$PAGE_HINTS = []`, skip write.

5. Write result as `pageHint: $PAGE_HINTS` into the in-memory feature.json object (written to disk in PHASE 3).

6. **Backlog back-write** (PAGE → feature backref): for each `pageName` in `$PAGE_HINTS` where `pageName` already exists in `backlog.json` as `type === "PAGE"` (idempotent — re-runs and later Page-Discovery seeding in PHASE 4 dedupe on the same array; Smart-Todo "+ new PAGE" earlier already wrote the parent feature into dependencies[]):
   - Add `{feature-name}` to `page.dependencies[]` (dedupe). Write back to `backlog.json`.
   - Add to completion report when ≥1 update: `Page deps: {N} PAGEs updated ({comma-separated names})`
   - Applies to both FEATURE and COMPONENT types — no type filter.
