# PHASE 1: Impact Analysis

Inputs from PHASE 0: `files[]` (feature.json, may be empty), owned components (where `feature === "{name}"`), full `components[]`, inbound backlog `dependencies[]`.

## 1. Build the removal set

```
removal_set = union(
  feature.json#files[].path,
  owned_components[].src[],
  owned_components[].test[]
)
```

Normalize paths relative to the project root; drop entries that no longer exist on disk (log them as `already gone`).

## 2. Graph scan (connects_to dependency graph)

For every component `C` in `components[]` that is **not** owned, check each edge in `C.connects_to[]` whose `to` matches an owned component name:

| Inbound edge                                | Classification | Why                                   |
| ------------------------------------------- | -------------- | ------------------------------------- |
| `calls` or `writes` from a `status: done` C | **CRITICAL**   | runtime breakage when target vanishes |
| `reads` or `depends_on` (any status)        | **WARNING**    | data/config coupling, needs update    |
| any edge from a `status: planned` C         | **WARNING**    | planned work references retired code  |

Also WARNING: backlog features (TODO/DEFINED/DOING) with the retired feature in `dependencies[]` — their plans build on removed ground.

INFO (no code action, handled in PHASE 5):

- Learnings matching the feature — reuse the `component` scope matching rules from `shared/LEARNINGS-LOAD.md` (substring on `feature` field + summary-keyword fallback)
- `architecture.routes[]` entries with `feature === "{name}"`
- Seed mentions (`SEED_CONTEXT.markdown` name-token match) and thinking files (Grep `.project/thinking/*.md`, filenames + H1 only)

## 3. Grep scan (catches what the graph doesn't)

For each file in the removal set:

1. Extract exported symbols (exported functions/classes/consts; [GAME MODE]: `class_name` declarations and autoload names).
2. Grep the codebase (excluding the removal set itself, `node_modules`, `.project/`) for:
   - import/require/preload references to the file path
   - usages of the exported symbols

Classify each hit by location: source file → **CRITICAL**; test file → **WARNING**; docs/comments/config → **INFO**.

Dedup against graph-scan findings (same file:line → keep the higher classification, merge descriptions).

## 4. Shared-file detection

A removal-set file is **shared** when it also appears in another feature's `feature.json#files[]` or another (non-owned) component's `src[]`/`test[]`:

- Never delete it. Flag for **surgical edit**: only the retired feature's symbols/sections are removed in PHASE 3.
- List shared files separately in the PHASE 2 report (`{M} shared — surgical edit only`).

## Output

Carry to PHASE 2: `removal_set` (with shared flags), classified findings list (CRITICAL/WARNING/INFO, each `{file, line, description, source: graph|grep}`), memory-mutation preview counts (components, learnings, routes, backlog, seedDrift).
