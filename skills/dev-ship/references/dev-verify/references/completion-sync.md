# Dev Verify — Completion Sync Reference

Full sync logic for PHASE 6 Step 3. Loaded inline when executing Step 3.

---

## Step 3: 3-File Sync

`node ~/.claude/scripts/completion-sync.js` owns the whole feature.json + backlog.json +
project-context.json/project.json sync — it computes every derived field (`finalStatus`, session
pass/fail/skip counts, per-REQ `evaluation`) and structurally never writes the backlog's
refactor-owned keys (`shipped`/`shippedAt`/`shippedSha` — see `shared/BACKLOG.md` Lifecycle
Protocol). You supply only judgment: verdicts, evidence, free text.

**PAGE-seeding (safety net — frontend projects only):** if PHASE 4 applied fixes (`fixSync` entries
this session) AND the diff against `pre-skill-status.txt` shows new page-files not yet in
`feature.json#files[]` (paths like `app/**/page.tsx`, `src/routes/**`, `pages/**`, or
`*Page`/`*Screen`/`*View` components) that don't already exist as backlog features →
AskUserQuestion ("PHASE 4 added {N} new page-file(s) — add as PAGE-todos?": Yes all (Recommended) /
Selection / No). Pass the approved pages as `seedPages: [{ name, routePattern }]` in the payload
below — the script pushes the full backlog object.

Build the payload and run:

```bash
echo '{
  "requirements": [{ "id": "REQ-001", "verdict": "PASS", "acceptancePass": 2, "acceptanceTotal": 2, "builderPass": 3, "builderTotal": 3 }],
  "checklist": { "T-001": "PASS" },
  "fixSync": ["..."],
  "observations": ["..."],
  "verificationCheckpoint": { "gaps": [], "mismatches": [], "adjustments": "none" },
  "acceptanceTestFile": "tests/acceptance/....spec.ts",
  "seedPages": [{ "name": "admin-settings", "routePattern": "app/admin/settings/page.tsx" }],
  "componentSync": [{ "name": "auth", "src": ["..."], "test": ["..."] }],
  "designComponent": "Button"
}' | node ~/.claude/scripts/completion-sync.js sync {feature-name}
```

Field notes:

- `requirements[]`: one entry per non-`REMOVED` requirement, `verdict` ∈ `PASS|FAIL|BLOCKED|UNCLEAR`
  (BLOCKED/UNCLEAR need `evidence`); score fields optional.
- `checklist`: `{ "<checklist-id>": "PASS"|"FAIL"|"skip" }` for every `tests.checklist[]` item.
- `componentSync`/`designComponent`: only when PHASE 4 touched components / `IS_COMPONENT_VERIFY = true`.

Exit codes: `0` full sync · `6` validation failed before any write (missing/unknown verdict, or a
forbidden key anywhere in the payload) — fall back to authoring the mutations by hand per the field
list the script's header documents · `7` feature.json was written but no backlog entry matched
`feature.name` — warn and stop (backlog/context/project files are left untouched) · `3`/`4`/`5` —
main-root/feature.json/JSON problems, see the script's usage.

---

## Step 3b: Learning Extraction

Append to `project-context.json#learnings[]` per [shared/LEARNING-WRITE.md § Writer Append Protocol](.claude/skills/shared/LEARNING-WRITE.md) (schema, relevance filter, two-stage dedup). dev-verify source mapping — read the just-written `feature.json`:

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

Clean up: `rm -f .project/session/pre-skill-status.txt .project/session/pre-skill-lint.txt` plus
`node ~/.claude/scripts/ship-checkpoint.js signal-clear {name}`

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
