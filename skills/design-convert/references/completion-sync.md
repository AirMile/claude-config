# Completion

## Backlog Sync

After defining pages, sync them to the backlog:

1. Read `project.json` → get `design.pages[]` array
2. Read `.project/backlog.json` (if it exists) → parse JSON
   - **If backlog doesn't exist**: create `.project/backlog.json` with the data scaffold from `shared/BACKLOG.md` (`schemaVersion: 2`). Set `data.source` to `"/design-convert"`, `data.project` to project directory name.
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
       "source": "/design-convert",
       "origin": "user",
       "dependencies": []
     }
     ```
     `source` + `origin` per `shared/BACKLOG.md § Card provenance` — a page composed from the
     user's own visual input is `user`, not `agent`.
     Track this item in `$NEW_ITEMS[]` for the handoff prompt.
   - **Found**: skip (don't overwrite existing items)
4. Set `data.updated` to today's date
5. Write back via Edit (see `shared/BACKLOG.md § Writing`)

## Update DevInfo

Update `.project/session/devinfo.json`:

```json
{
  "currentSkill": { "name": "design-convert", "phase": "COMPLETE" },
  "handoff": {
    "from": "design-convert",
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
  1. /design-convert       → add more pages/flows (iterative)
  2. /design-tokens       → design tokens and colors based on principles
  3. /design-convert       → generate Claude Design brief (brief-mode)
  4. /design-convert       → convert an existing design to code (paste sketch/URL)
  5. /design-content      → fill built pages/components with real copy (placeholders → on-brand text)
  6. /design-ship         → build + runtime check (performance, SEO, a11y, responsive)

[Only show for each newly added/updated PAGE/COMPONENT — the spec is now persisted, so the review route resolves it:]
Visual review:
  http://localhost:9876/{project-dir}/review/{name}   → wireframe + spec + open questions

═══════════════════════════════════════════════════════════════
```

**Visual review link.** For every PAGE/COMPONENT created or updated this session, print its review URL as a plain `http://` line (one per entity) so it renders clickable in the Claude Code chat. The spec was just written in PHASE X, so the route resolves it reliably. There the user can review the spec as a wireframe and leave open questions that persist to `design.{pages|components}[].reviewNotes[]`. Omit for Flow/Principles-only sessions (no entity to review).

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

## Spec-Capture Build Offer (after report, only when spec was just captured on an existing entity)

Triggers when ALL of the following are true:

- The session action was a spec edit/add on an **existing** entity via the Page/Component field-edit route (Mode B/C — not a new capture that was already covered by the Handoff Prompt above).
- `$ARG_TYPE === "PAGE" || $ARG_TYPE === "COMPONENT"` (design track).
- The entity's backlog `status` is `"TODO"` or `"DEFINED"` (not yet built — `DOING`/`DONE` skip this offer).
- **Not** reached via Build's Step 2.5 "save spec only" off-ramp — that user explicitly chose "don't build", so re-prompting to build would contradict their choice. Suppress the offer in that case.

```yaml
header: "Spec saved"
question: "The spec for '{$ARG_NAME}' is recorded. Build it now?"
options:
  - label: "Yes, start Build (Recommended)", description: "Load the Build route with {$ARG_NAME} pre-selected — spec available inline"
  - label: "Later", description: "The item sits in the backlog, ready to build"
multiSelect: false
```

"Yes, start Build" → continue with `route-build.md` flow using `$TARGET = $ARG_NAME`, `$TARGET_TYPE = $ARG_TYPE`, `$ARG_ENTITY` pre-set (skip entity selection in Build Step 1–3).
"Later" → end skill.

Before showing this offer, print the visual review link so the user can inspect the just-saved spec either way:

```
http://localhost:9876/{project-dir}/review/{$ARG_NAME}
```
