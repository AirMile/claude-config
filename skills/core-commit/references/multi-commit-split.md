# Multi-Commit Split

For more than 2 unrelated concerns, or a shared file (README, CHANGELOG, a config/registry doc)
touched by more than one concern. Do this before staging anything.

## 0. Inventory the concerns

§ 1's granularity question is only answerable against a real inventory — derive it first, do not
infer concerns from directory names.

1. **Read the shared narrative files first** — CHANGELOG, README, a config/registry doc in the
   diff. On a documented changeset these name most of the concerns outright and hand you the
   vocabulary for the rest.
2. **Classify every changed file** by matching its _added_ lines against those concerns
   (`git diff -U0 -- <file> | grep '^+'`), not against its path. A theme-keyword sweep across all
   changed files at once is cheaper than reading them one by one.
3. **Inspect what stays unclassified** — anything the narrative files didn't name, largest diffs
   first. These are the undocumented concerns.
4. **Record, per file, which concerns touch it.** A file touched by 2+ concerns is a shared file
   and goes through § 3's incremental build; everything else is wholly owned.

State the inventory (concern count, file count, and which files are shared) in § 1's scope
disclosure. A concern you cannot name in one line is not yet a concern — keep classifying.

## 1. Ask granularity

AskUserQuestion, recommended-first:

- "Split per feature/concern (Recommended)" — one commit per distinct concern
- "Coarser, grouped by theme" — bundle closely-related concerns into fewer commits
- "One commit" — proceed with everything as a single commit

If the changeset spans many files/directories, say so before asking — the user's answer should
reflect the real scope, not a guess.

**Gating (only when the chosen granularity produces 2+ commits)** — one more AskUserQuestion,
recommended-first:

- header: "Gating"
- question: "This will produce {n} commits. How do you want to approve them?"
- options:
  - "Confirm each commit (Recommended)" — Step 5's Confirm gate fires once per commit, as usual
  - "Auto-commit all" — show the full numbered list of planned commit **subjects** once (one
    line each, in execution order); one approval covers the whole split. Each body is authored
    at its own commit against the hunks actually staged, under Step 4's rules — bodies are not
    drafted up front and are not re-approved. Execute all commits back-to-back with no
    per-commit modal. Still stop immediately and report if any commit fails (hook failure,
    conflict) — auto mode does not suppress error handling (SKILL.md Step 6).

An explicit delegation from the user ("do what you think", "just pick") answers this gating
question on its own — default to "Auto-commit all", state the choice, don't ask.

Carry the chosen gating mode through Step 3 below.

**If execution reveals materially more scope than the granularity ask covered** (the
file/directory count from § 1's own scope-disclosure was itself an estimate) — do not
re-ask by default. A small undocumented fragment discovered while building a shared file
folds into whichever approved commit it's most closely related to, noted in that commit's
body; this is expected, not a deviation. Only re-run § 1's granularity ask when the total
commit count would grow past roughly double the originally approved number, or a newly
discovered concern has no reasonable home in any approved commit.

## 2. Map files to commits

For each planned commit, list the files it fully owns. For a file touched by more than one
commit, identify the specific hunks belonging to each commit — never assign the whole file to
one commit if that would silently drop another commit's content. When a single line or
paragraph mixes two commits' content (e.g. one sentence gets a mid-sentence clause added for
commit A, then a whole new sentence for commit B), split at the sub-line level by content, not
by hunk boundary — treat it as two sequential edits, not one hunk.

## 3. Stage whole-owned files, then build shared files incrementally

For each commit, in dependency order:

1. Before staging, apply `staging-safety.md`'s secret blocklist (`.env*`, `*.key`, `*.pem`,
   `*.pfx`, `*.p12`, `*.crt`, `credentials.json`, `secrets.*`, `**/service-account*.json`) to
   every file about to be added — block and warn on a match, exactly as the single-commit path
   does. Then `git add` every file wholly owned by this commit.

   `staging-safety.md`'s `.gitignore` coverage check is **not** per-commit: run it once, against
   the whole changeset, before the first commit of the split. A split otherwise skips it
   entirely — SKILL.md Step 2's load sits behind the blanket "Stage all?" ask this flow bypasses.

2. For each shared file this commit touches, pick one technique:
   - **`git apply --cached <patch>`** (default when the target hunks are already cleanly
     `@@`-separated in `git diff <file>`): build a patch containing just those hunks and apply it
     to the index, leaving the working tree untouched. `git diff` re-lists only the remaining
     hunks after each apply, so the next commit's selection stays correct by construction.
   - **Progressive Read+Edit** (fallback — works for any file, no patch-format risk; required
     when two commits' content interleaves below hunk level): the working tree already holds the
     _final_ state. Save it aside, temporarily Edit out every hunk that belongs to a _later_
     commit, stage the file, commit, then restore so those hunks are available for their own
     commit later.
3. Commit — still subject to Step 5's Confirm gate (or the batch gate on "Auto-commit all").
4. If a later commit needs to add more content to that same shared file, it starts from the
   state this commit just left behind — do not pre-populate all commits' content at once.

## 3.5. Integrity check (before the final commit)

Compare the split's cumulative diff against the original pre-split diff:
`git diff <pre-split-HEAD>..HEAD --stat`. File count and **deletion count** must match the
original diff exactly (deletions are a reliable invariant; insertion counts can drift a little
from estimation but should be in the same ballpark). Mismatch → stop before the final commit
and find the dropped/duplicated hunk — do not push a split you haven't verified. **Exception**:
a deletion-count drift of 1-2 lines may be accepted without tracing the exact line only after
confirming via `git diff` on the specific file(s) involved that the difference is a formatter
reflow (e.g. re-wrapped prose, reindented table) and not lost content — cite the file and line
checked. Any larger drift, or one that can't be confirmed as a reflow, must be traced to a
specific dropped/duplicated hunk before proceeding. A drift that still can't be located after a
reasonable search stops the split — report the numbers and what was ruled out; never accept an
untraced mismatch silently.

## 4. Verify before committing when a test suite exists

Discover the suite once, before the first commit: the project `CLAUDE.md`'s own pre-release check
list, then `package.json` scripts (`test`, `check`, `lint`), then a `scripts/tests/` runner. None
found → state "no suite found, skipping § 4" once and move on.

Run it before **every commit whose staged set touches an executable file** (code, scripts, config
the tools read) — a partial split can leave a file syntactically valid but semantically broken,
and catching that before it is in history is much cheaper than after. Docs/prose-only commits skip
it. Non-zero exit → **STOP**: do not commit, report the failure and which commit's partial state
produced it.

## 5. Report the split

SKILL.md § Output's success block is per-commit and does not fit a split. Report once, after the
last commit, per `shared/OUTPUT.md § Report Block`:

```
✅ {n} commits on {branch}

{sha}  {subject}
...

Integrity check {base}..HEAD:
  {n} files, +{ins} / -{del}
  deletions match the pre-split diff ({n})
```

Name the shared files that were built incrementally rather than staged whole — that is the part
of the split a reader cannot reconstruct from the log. Then continue to SKILL.md Step 7 (push).

## 6. If a split is built wrong

`git reset --soft HEAD~1` undoes the most recent commit while keeping everything staged exactly
as it was — safe as long as nothing has been pushed. Fix the staged content, then re-commit.
Never `git reset --hard` or force-push to recover from a self-made splitting mistake.
