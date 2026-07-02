# Dev Verify — Completion Sync Reference

Full sync logic for PHASE 6 Step 3. Loaded inline when executing Step 3.

---

## Step 3: 3-File Sync

Update three files so the project state matches the verify result. **For feature.json: use a single Read → mutate-in-memory → Write cycle**, not per-field Edit calls.

**feature.json** — Read once, parse JSON, apply all mutations in memory, Write once:

- `status` → `"DONE"`
- Per `requirements[]` (skip `deltaOp === "REMOVED"`): `status` → `"PASS"` / `"FAIL"` / `"BLOCKED"` / `"UNCLEAR"` per REQ (BLOCKED/UNCLEAR include `evidence` string)
- Per `tests.checklist[]`: `status` → `"PASS"` / `"FAIL"` / `"skip"` per item
- `tests.finalStatus` → `"PASSED"` (all requirements PASS) / `"FAILED"` (≥1 FAIL) / `"PARTIAL"` (≥1 BLOCKED or UNCLEAR, 0 FAIL). PARTIAL signals incomplete verification; feature `status` remains `"DONE"`.
- `tests.sessions[]` → append `{ "date": "YYYY-MM-DD", "pass": N, "fail": N, "skip": N }`
- `tests.fixSync` → fix summaries (if fixes applied)
- `observations[]` → add (if present)
- `tests.verificationCheckpoint` → `{ "gaps": ["REQ-ID"], "mismatches": ["description"], "adjustments": "none|added|reworded" }`
- `tests.evaluation` → per-REQ scores `[{ reqId, acceptancePass, acceptanceTotal, builderPass, builderTotal, verdict }]`
- `tests.acceptanceTestFile` → path to written acceptance test file (persistent in codebase)

Single Write replaces the entire file. Prevents drift across ~10 sequential Edits.

**Verification**: parse feature.json once after writing — verify `status === "DONE"` + `tests.finalStatus` set. Display verification result ONLY if it fails.

**PAGE-seeding (safety net — frontend projects only):** before the backlog mutation, if PHASE 4 applied fixes (`tests.fixSync` entries this session) AND the diff against `pre-skill-status.txt` shows new page-files not yet in `feature.json#files[]` (paths like `app/**/page.tsx`, `src/routes/**`, `pages/**`, or `*Page`/`*Screen`/`*View` components) that don't already exist as backlog features → AskUserQuestion ("PHASE 4 added {N} new page-file(s) — add as PAGE-todos?": Yes all (Recommended) / Selection / No). Per selected page push to `data.features[]`: `{ name: "{kebab-name}", type: "PAGE", status: "TODO", phase: "P3", description: "Page introduced via fix in {parentFeature}. Routes: {route-pattern}", source: "/dev-verify", dependencies: ["{parentFeature}"], parentFeature, auto: true }`. Update `data.updated`, write backlog back.

**backlog:** read `.project/backlog.json` → parse JSON (see `shared/BACKLOG.md`). Match on `feature.name` (not `id` — the backlog format uses `name` as the unique key).

Set on the matched entry:

- `status = "DONE"`
- remove `stage` and `transition` (if present — **except** `transition: "shipping"`, the dev-ship run marker: keep it)

**Forbidden keys** — verify MAY NOT write these on the backlog entry; they belong exclusively to `/dev-refactor` (see `shared/BACKLOG.md` Lifecycle Protocol):

- `shipped`
- `shippedAt`
- `shippedSha`

This applies even when a merge SHA is available from PHASE Finalize: the SHA is informational only — never propagate it to the backlog from verify.

**Verification** (after writing, parse the backlog again):

1. Matched entry has `status === "DONE"`. Fails → warning + stop (silent no-op is a bug).
2. Matched entry has **none** of `["shipped", "shippedAt", "shippedSha"]`. Any present → ABORT: `"Verify wrote forbidden refactor-key(s) {list} to backlog entry {name}. Remove them and retry — these belong to /dev-refactor."`
3. No match on `feature.name`: log a warning and stop.

**project-context.json**: When fixes in PHASE 4: update `architecture.components[]` — merge changed files into component `src`/`test`, confirm `status: "done"`, add test files.

**COMPONENT design sync** (only if `IS_COMPONENT_VERIFY = true`):

Update `project.json#design.components[]` — look up by name, set `status: "DONE"`. Not found → add with status `"DONE"`. Update `project-context.json#components[]` inventory: add test paths to existing inventory item (merge, do not overwrite).

---

## Step 3b: Learning Extraction

Append to `project-context.json#learnings[]` per [shared/LEARNING-EXTRACTION.md § Writer Append Protocol](.claude/skills/shared/LEARNING-EXTRACTION.md) (schema, relevance filter, two-stage dedup). dev-verify source mapping — read the just-written `feature.json`:

- `tests.fixSync[]` → type `pitfall`, source `extracted` (bugs with root causes)
- `observations[]` → type `observation`, source `inferred` (cross-feature insights)

`build.decisions[]` is mapped by dev-build PHASE 3A (single writer) — do not re-map here.

---

## Step 4: Scoped Commit

Follow [shared/SCOPED-COMMIT.md](.claude/skills/shared/SCOPED-COMMIT.md). dev-verify deltas:

- **Baseline**: status form — `.project/session/pre-skill-status.txt`; lint baseline `.project/session/pre-skill-lint.txt` (written in PHASE 0 step 5).
- **Diagnostics**: run the § 3 set-diff. Source detection: `package.json#scripts` keys matching `typecheck|type-check|tsc|lint`; Python (no package.json): `mypy.ini` or `[tool.mypy]` in `pyproject.toml`. No match → skip silently. Multiple matches → parallel Bash calls, `timeout: 60000`.
- **OVERLAP policy**: interactive. **Staging**: `.project/` is local-only — omit it. Stage NEW and included OVERLAP (codebase files only — source, tests, acceptance test files) via plain `git add`.
- **Fallback**: `git add -A`.
- **Worktree**: stage and commit app-code (source, tests, acceptance test files) inside the worktree. No main-repo sync commit — `.project/` is local-only state.

**Commit type selection:**

- `{specFixes} + {otherFixes} > 0` → use type `fix` (production code was changed)
- otherwise → use type `test` (tests only)

**Subject:** write a short sentence (≤65 chars) in the project's language (`CLAUDE.md → Language`) describing what was verified or fixed. Base it on the feature's requirements. No counts, no internal labels.

- tests-only example: `test(map-home): acceptatietests voor het kaartscherm`
- with fixes example: `fix(app-navigation): gesture-handler werkend in tests`

**Body (1-2 sentences, plain language):**

- `fix` commit: briefly mention that tests were also added.
- `test` commit: no body needed unless something notable happened.

```bash
git commit -m "{type}({feature}): {subject}

{body}"
```

Note: `{acceptance}`, `{auto}`, `{manual}`, `{covered}` counts are used for the VERIFY COMPLETE output table below — not for the commit message.

Clean up: `rm -f .project/session/pre-skill-status.txt .project/session/pre-skill-lint.txt .project/session/active-{name}.json`

---

## Output

```
VERIFY COMPLETE: {feature-name}

| Dimension         | Score               |
| ----------------- | ------------------- |
| Acceptance Tests  | {pass}/{total} PASS |
| Builder Tests     | {pass}/{total} PASS |
| Spec Issues Fixed | {n}                 |
```

Append a single Next step line (pick the most relevant — do NOT list multiple):

- Worktree finalized in PHASE Finalize → `Next: /dev-refactor {feature-name}` (optional polish on main)
- User chose "Keep open" → omit Next line (finalize prompt already explained the path)
- No worktree + more items in backlog → `Next: /dev-define {next-feature}`
- All else → omit Next line.

Refactor is optional. Skip if scope was small and the feature is clean.

> **Todo**: Apply the Next-Step Clipboard Offer (binary Ja/Nee) —
> read '.claude/skills/shared/NEXT-STEP-OFFER.md'.
> Recommended command: if worktree finalized → /dev-refactor {feature-name} (optional polish on main); else if more items in backlog → /dev-define {next-feature} (continues pipeline); else omit the offer.
