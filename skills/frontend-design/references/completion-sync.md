# Completion

## Backlog Sync

After defining pages, sync them to the backlog:

1. Read `project.json` → get `design.pages[]` array
2. Read `.project/backlog.html` (if it exists) → parse JSON from `<script id="backlog-data" type="application/json">...</script>`
   - **If backlog doesn't exist**: create it from template `{skills_path}/shared/references/backlog-template.html` → `.project/backlog.html`. Set `data.source` to `"/frontend-design"`, `data.project` to project directory name.
3. For each page in `design.pages[]`:
   - Generate kebab-case name from page name
   - Check if `data.features.find(f => f.name === name)` exists
   - **Not found**: add to `data.features[]`:
     ```json
     {
       "name": "{kebab-case-name}",
       "type": "PAGE",
       "status": "TODO",
       "transition": "designing",
       "phase": "P3",
       "description": "{page.purpose}",
       "dependencies": []
     }
     ```
     Track this item in `$NEW_ITEMS[]` for the handoff prompt.
   - **Found**: skip (don't overwrite existing items)
4. Set `data.updated` to today's date
5. Write back via Edit (keep `<script>` tags intact)

## Update DevInfo

Update `.project/session/devinfo.json`:

```json
{
  "currentSkill": { "name": "frontend-design", "phase": "COMPLETE" },
  "handoff": {
    "from": "frontend-design",
    "to": null,
    "data": {
      "designLocation": ".project/project.json#design",
      "pages": {
        "count": 4,
        "names": ["dashboard", "settings", "login", "checkout"]
      },
      "flows": {
        "count": 2,
        "names": ["onboarding", "purchase"]
      },
      "principles": {
        "count": 3,
        "names": ["Mobile-first", "Accessibility", "Consistent spacing"]
      }
    }
  }
}
```

## Completion Report

```
DESIGN SPEC [CREATED|UPDATED]
═══════════════════════════════════════════════════════════════

Location: .project/project.json (design section)

[Only show if design-history.json exists and is not empty:]
CHANGES THIS SESSION
─────────────────────────────────────────────────
+ {name}  (new page/flow/principle)
~ {name}  (changed — field: {purpose|sections|steps|...})
- {name}  (removed)
[If no changes: omit this block]
─────────────────────────────────────────────────

| Category   | Count | Details                            |
|------------|-------|------------------------------------|
| Pages      | {N}   | {status breakdown: 2 DEF, 1 BLT}  |
| Flows      | {M}   | {flow names joined}                |
| Principles | {P}   | {principle names joined}           |

Backlog: {X} new PAGE items added (transition: designing)
  {list of added page names}
Seed:  {only when X > 0} .project/project-seed.md may be outdated — update manually if needed.

Next steps:
  1. /frontend-design       → add more pages/flows (iterative)
  2. /frontend-tokens       → design tokens and colors based on principles
  3. /frontend-design       → generate Claude Design brief (brief-mode)
  4. /frontend-design       → convert an existing design to code (paste sketch/URL)
  5. /frontend-check        → performance/SEO audit (if flows defined: Flow scope also available)
  6. /frontend-check --scope=a11y → accessibility audit

═══════════════════════════════════════════════════════════════
```

## Handoff Prompt (after report, only when `$NEW_ITEMS[]` is non-empty)

```yaml
header: "Continue"
question: "New items added to backlog. Build one now?"
options:
  - label: "Later (Recommended)", description: "Items are queued in backlog with transition: designing — build when ready"
  - label: "Build {$NEW_ITEMS[0].name}", description: "Start Build route for this item now"
multiSelect: false
```

"Build {name}" → continue with `route-build.md` flow using `$TARGET = $NEW_ITEMS[0].name` and `$TARGET_TYPE = $NEW_ITEMS[0].type`.
"Later" → end skill.
