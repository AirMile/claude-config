# PHASE 5: Memory Sync

Runs only after the PHASE 4 test gate passes. One parallel read-mutate-write batch per file (read each JSON once, apply all mutations, write once).

## 1. Backlog

- Feature in `backlog.json#features[]` → set `status: "CANCELLED"`, add `cancelledReason: "{one-line reason from PHASE 0/2}"` and `cancelledAt: "{YYYY-MM-DD}"`, remove `transition` and `shipped` fields. Set `data.updated`.
- Feature in `.project/archive/backlog-archive.json#archived[]` (shipped origin) → set the same three fields **there** — the archive entry stays, flagged as retired.
- Other features with `"{name}"` in `dependencies[]` → remove the entry (these were surfaced as WARNING in PHASE 1; log each removal).

## 2. Architecture (`project-context.json`)

- Delete components where `feature === "{name}"`.
- For all remaining components: strip `connects_to[]` edges whose `to` named a deleted component.
- `architecture.routes[]`: drop entries with `feature === "{name}"`.
- `dataFlow`: if it names a deleted component, rewrite the one-liner to match the remaining flow.
- Set `context.updated` to today.

## 3. Learnings — archive, never delete

1. Select entries matching the feature (same matching rules as `shared/LEARNINGS-LOAD.md` `component` scope).
2. Append them to `.project/archive/learnings-{YYYY-MM}.json` using the archive shape from `shared/LEARNING-EXTRACTION.md § Consolidation` (`{ schemaVersion: 2, archived: [...] }` — create the file if absent), then remove them from the active `learnings[]`.
3. Append one **tombstone** learning to the active list so future ideation/backlog runs know the concept changed:

   ```json
   {
     "date": "{YYYY-MM-DD}",
     "feature": "{name}",
     "type": "observation",
     "source": "extracted",
     "summary": "Feature retired: {reason} — code removed, {N} learnings archived"
   }
   ```

## 4. Seed drift

Skip when `SEED_CONTEXT.present` is false or the seed never mentions the feature. Otherwise append to `backlog.json#seedDrift[]` (same write pass as step 1):

```json
{
  "category": "contradiction",
  "seedSays": "{short seed quote describing the feature, or '(seed describes {name})'}",
  "featureDecides": "feature retired and removed from codebase",
  "source": "/project-retire",
  "ref": "feature:{name}",
  "detectedAt": "{ISO timestamp}"
}
```

Picked up by `/project-seed § Sync` exactly like define/backlog drift.

## 5. Feature directory

Move `.project/features/{name}/` → `.project/features/archive/{name}/` (create `archive/` if needed). Skip silently when the feature has no directory (small items).

## Output

Log one line per mutation target: `backlog ✓ · architecture ✓ ({N} components) · learnings ✓ ({N} archived + tombstone) · seedDrift ✓ · feature-dir ✓`. → PHASE 6.
