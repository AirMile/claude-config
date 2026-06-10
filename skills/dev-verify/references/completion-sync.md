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

**PAGE-seeding (safety net — frontend projects only):**

Execute **before** the backlog mutation. Trigger only if **all** conditions are true:

1. `project.json#stack.framework` is a frontend framework (React, Vue, Svelte, Next.js, Nuxt, Astro, Remix, SolidJS)
2. PHASE 4 applied fixes (there are `tests.fixSync` entries this session)
3. New page-files exist that were not in `feature.json#files[]` before this session — detect via diff against `pre-skill-status.txt` baseline. Paths matching: `app/**/page.tsx`, `src/routes/**`, `pages/**/*.{tsx,vue}`, `routes/**/*.svelte`, or component names ending in `Page`, `Screen`, `View`
4. After idempotency-filter (`data.features.find(f => f.name === <kebab-name>)`) ≥1 candidates remain

If all conditions are true → AskUserQuestion:

```yaml
header: "Pages detected during fix"
question: "PHASE 4 added {N} new page-files. Do you want to add them as PAGE-todos on the backlog?"
options:
  - label: "Yes, all (Recommended)"
    description: "Create a PAGE-todo for each page so they go through design → check"
  - label: "Selection"
    description: "Choose which pages get a separate todo"
  - label: "No"
    description: "No extra todos — pages are covered in fix-sync"
multiSelect: false
```

Per selected page → push to `data.features[]`:

```json
{
  "name": "{kebab-case page name}",
  "type": "PAGE",
  "status": "TODO",
  "phase": "P3",
  "description": "Page introduced via fix in {parentFeature}. Routes: {route-pattern}",
  "source": "/dev-verify",
  "dependencies": ["{parentFeature}"],
  "parentFeature": "{parentFeature}",
  "auto": true
}
```

Update `data.updated`. Write backlog JSON back to `.project/backlog.json`.

**backlog:** read `.project/backlog.json` → parse JSON (see `shared/BACKLOG.md`). Match on `feature.name` (not `id` — the backlog format uses `name` as the unique key).

Set on the matched entry:

- `status = "DONE"`
- remove `stage` and `transition` (if present)

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

**testSmellBaseline update** (only if the test-smell check ran in PHASE 5d and `tests.smellSummary` was written):

Read `project.json#testSmellBaseline` (may be absent on first run). With `N = prev.sampleCount ?? 0`, write:

```json
{
  "avgMockRatio": "(N * prev.avgMockRatio + smellSummary.avgMockRatio) / (N + 1)",
  "p90MockRatio": "(N * prev.p90MockRatio + smellSummary.p90MockRatio) / (N + 1)",
  "sampleCount": "N + 1",
  "lastUpdated": "ISO-8601"
}
```

First feature (`N === 0`) → baseline equals the feature's `smellSummary` values directly. From `sampleCount >= 3` the baseline is used as drift reference (`--baseline-p90`) in subsequent verify runs (see `test-smell-review.md` step 1).

**COMPONENT design sync** (only if `IS_COMPONENT_VERIFY = true`):

Update `project.json#design.components[]` — look up by name, set `status: "DONE"`. Not found → add with status `"DONE"`. Update `project-context.json#components[]` inventory: add test paths to existing inventory item (merge, do not overwrite).

**Reuse-Discovery** (frontend projects only — skip if `IS_COMPONENT_VERIFY = true`, skip if no BROWSER tests were run):

After successful verification of a PAGE-feature where BROWSER-tests were run: scan the test-results and screencap-context for visual patterns that repeat across multiple pages or features. Detect repeating layout blocks (stat cards, list tables, hero section, etc.) with similar structure.

**Dedup**: check `project.json#design.components[]` and `project-context.json#components[]`. Check `feature.json#suggestionsLog[]` — previously rejected from `dev-verify`? → skip.

Candidates found (max 2 per run, to not slow down verify) → AskUserQuestion:

```yaml
header: "Repeating UI patterns"
question: "Visual verification shows patterns reusable as shared components. Create COMPONENT-todos?"
options:
  - label: "{name} — {short visual description}", description: "Create COMPONENT-todo"
  - label: "..." (one per candidate)
  - label: "Skip", description: "No COMPONENT-todos to add"
multiSelect: true
```

Per accepted: append backlog + `design.components[]` (status: IDEA) + `feature.json#suggestionsLog[]` (accepted).
Per rejected: log in `suggestionsLog[]` (rejected, skill: "dev-verify").

---

## Step 3b: Learning Extraction

Extract project-wide learnings from the completed feature. Read the just-written `feature.json` and evaluate (mandatory source-tag per source):

- `build.decisions[]` → type `pattern`, source `extracted` (architectural decisions that affect other features)
- `tests.fixSync[]` → type `pitfall`, source `extracted` (bugs with root causes)
- `observations[]` → type `observation`, source `inferred` (cross-feature insights)

**Filter**: only items that are relevant beyond this one feature. Skip feature-specific implementation details.

**Append** to `project-context.json` → `learnings[]`:

```json
{
  "date": "YYYY-MM-DD",
  "feature": "{feature-name}",
  "type": "pattern|pitfall|observation",
  "source": "extracted|inferred",
  "summary": "Max 200 chars summary"
}
```

**Dedup** for each candidate learning:

1. Exact shortcut: same feature + same summary → skip (no Jaccard needed)
2. Tokenize candidate.summary via `shared/LEARNING-EXTRACTION.md` Dedup Tokenizer
3. For each existing learning in `learnings[]` with the same `type`:
   - `Jaccard(candidate.tokens, existing.tokens) >= 0.55` → skip candidate
4. Passes both checks → append

No learnings found → skip step.

---

## Step 4: Scoped Commit

**Pre-commit diagnostics** (stack-aware, identical to dev-build):

- Read `package.json` → check `scripts` for keys matching `typecheck|type-check|tsc|lint`
- Python project (no package.json): check for `mypy.ini` or `[tool.mypy]` in `pyproject.toml`
- No match found → skip silently

On match: run found script(s) (multiple matches → parallel) via Bash tool with `timeout: 60000`. Compute:

- baseline = set of error-keys (file:line:rule) from `.project/session/pre-skill-lint.txt` (written in PHASE 0 step 5)
- current = set of error-keys from this run
- new_errors = current \ baseline

If new_errors is empty → show `DIAGNOSTICS: PASS`, proceed to git status compare.
If new_errors not empty → show `DIAGNOSTICS: {len(new_errors)} new error(s) introduced` + file:line for each new error. AskUserQuestion:

- `"Fix now (Recommended)"` — stop Step 4, no commit; user fixes and restarts skill
- `"Commit anyway"` — proceed; add `[diagnostics-warnings]` to commit message
- `"Abort"` — cancel commit entirely

(Use set-diff of error-keys, not numeric delta — numeric delta produces false positives when errors shift line numbers due to surrounding edits.)

Compare `git status --porcelain | sort` with `.project/session/pre-skill-status.txt`:

- **NEW** (only in current) → `git add -f` (subdirs like `.project/features/` and `.project/session/` are gitignored — `-f` required for session files that fall under them)
- **OVERLAP** (in both, changed by this skill) → `git add -f`
- **PRE-EXISTING** (only in baseline, or overlap not changed by this skill) → do not stage

Baseline not found → fallback `git add -A`.

**Worktree split-commit** — when running inside a worktree (`current_root != main_root`),
`.project/` is a set of symlinks back to the main repo. Staging via the worktree
fails with `pathspec is beyond a symbolic link`. Resolve by splitting the commit:

1. App-code changes (tests, source files in the worktree branch) → stage + commit
   inside the worktree as normal.
2. `.project/` changes (feature.json, backlog.json, project-context.json) → stage
   and commit on main via `git -C {main_root} add -f .project/...` and
   `git -C {main_root} commit -m "..."`.

Use the same commit message body for both, but a distinct subject:

- Worktree: `verify({feature}): {N} requirements verified (...)`
- Main: `verify({feature}): sync backlog + feature.json + project-context`

**Variables** (count per PHASE 0 classification):

- `{acceptance}` = number of acceptance tests written in PHASE 1 (source: "acceptance")
- `{auto}` = number of items with type AUTO (CLI or BROWSER) — excluding COVERED
- `{manual}` = number of items with type MANUAL
- `{covered}` = number of items with type COVERED (build tests cover the contract)

```bash
git commit -m "verify({feature}): {N} requirements verified ({acceptance} acceptance, {auto} auto, {manual} manual)

Adversarial verification complete.
- Acceptance: {acceptance} | Covered: {covered} | Auto: {auto} | Manual: {manual}
- Spec fixes: {specFixes} | Other fixes: {otherFixes} | Tests added: {count}"
```

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
