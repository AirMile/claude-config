# PHASE 3: Execute Removal

Runs only after PHASE 2 confirmation. Order matters: snapshot first, then branch, then mutate.

## 1. Memory snapshot (before any mutation)

`.project/` is gitignored — `git reset` cannot restore it. Snapshot every file PHASE 5 will touch:

```bash
mkdir -p .project/tmp
cp .project/backlog.json .project/tmp/retire-snapshot-backlog.json 2>/dev/null
cp .project/project-context.json .project/tmp/retire-snapshot-context.json 2>/dev/null
cp .project/archive/backlog-archive.json .project/tmp/retire-snapshot-archive.json 2>/dev/null
cp .project/archive/learnings-{YYYY-MM}.json .project/tmp/retire-snapshot-learnings.json 2>/dev/null
```

Missing files are fine (`2>/dev/null`) — only existing ones are snapshotted and restored.

## 2. Branch (if chosen in PHASE 2)

```bash
git checkout -b retire/{feature}
```

## 3. Reference handling (skipped entirely on "Retire code only")

Process CRITICAL findings first, then WARNING, then INFO.

**CRITICAL call sites** — one AskUserQuestion per site, with surrounding context shown (~10 lines via `sed -n`):

```yaml
header: "Call site"
question: "How to handle this caller in {file}:{line}?"
options:
  - label: "Remove call + degrade gracefully (Recommended)"
    description: "Delete the call; adjust surrounding logic so the caller still works without the feature"
  - label: "Replace with stub"
    description: "Keep the call shape; insert a no-op/empty-result stub with a TODO comment"
  - label: "Skip"
    description: "Leave as-is — will appear as survivor in the PHASE 6 scan"
multiSelect: false
```

**WARNING/INFO** — auto-fix without asking: remove dead imports, drop conditional branches that only served the feature, delete test fixtures for removed code, update doc mentions. Keep a per-file change list for the report.

## 4. Delete the removal set

- Non-shared files: `rm` each file; remove now-empty directories.
- Shared files: surgical edits only — remove the retired feature's exports/sections/registrations, leave everything else untouched.
- Deregister routes/endpoints: route tables, router registrations, navigation links, API index files ([GAME MODE]: autoload entries in `project.godot`, signal connections in scenes that referenced removed scripts).

## 5. Track changes

Maintain `modified_files[]` and `deleted_files[]` — PHASE 4's rollback and PHASE 6's report both consume these.
