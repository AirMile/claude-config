# completion-sync fallback — hand-authoring the DONE sync

> Canonical source: `scripts/completion-sync.js`. Update this file whenever the
> script's write surface changes. Never read the script source during a ship run —
> this table replaces it.

Only used when `completion-sync.js` exits 6 (validation failed before any write —
forbidden key, malformed checklist/requirements, missing verdict). Author these
mutations by hand, in this order, then verify each write per the script's own
post-write re-read checks.

## feature.json

- `status: "DONE"`
- per requirement (skip `deltaOp: "REMOVED"` entries): `requirements[].status = verdict`; if verdict is `BLOCKED` or `UNCLEAR` and evidence was given, also set `requirements[].evidence`
- checklist items: `checklist[id].status` from the payload, for every id present in the payload
- `tests.finalStatus` derivation: any verdict `FAIL` → `"FAILED"`; else any `BLOCKED`/`UNCLEAR` → `"PARTIAL"`; else `"PASSED"`
- `tests.sessions[]`: push `{ date: <today>, pass, fail, skip }` counted from the checklist values, plus `fixes: <count>` if `fixSync` was non-empty
- `tests.evaluation[]`: one entry per requirement `{ reqId, verdict, acceptancePass?, acceptanceTotal?, builderPass?, builderTotal? }`
- `tests.fixSync`, `tests.verificationCheckpoint`, `tests.acceptanceTestFile`: copy verbatim from the payload when present
- `observations[]`: append payload observations (if any)

## backlog.json

- matching entry (`features[].name === feature.name`): `status: "DONE"`, delete `stage`, delete `transition` unless it equals `"shipping"`
- `seedPages[]` in the payload → push new backlog entries: `{ name, type: "PAGE", status: "TODO", phase: "P3", description: "Page introduced via fix in {feature}. Routes: {routePattern}", source: "/dev-verify", dependencies: [feature], parentFeature: feature, auto: true }`
- top-level `backlog.updated = <today>`
- **never** write `shipped` / `shippedAt` / `shippedSha` on the entry — those keys belong exclusively to `/dev-refactor`

## project-context.json (componentSync)

- for each `payload.componentSync[]` entry: find `architecture.components[]` by `name`; merge `src`/`test` arrays (union, no duplicates); skip with a warning if the named component isn't found — never create one here

## project.json (designComponent)

- if `payload.designComponent` is a non-empty string: find or create the entry in `designComponent` inventory by `name`; set `status: "DONE"`; if `componentSync` also matched this component, fold its `test` paths in

## Verification after hand-authoring

- Re-read `feature.json`: confirm `status === "DONE"` and `tests.finalStatus` is set
- Re-read `backlog.json`: confirm the matched entry has `status === "DONE"` and none of `shipped`/`shippedAt`/`shippedSha` are present
