# Multi-Commit Split

For more than 2 unrelated concerns, or a shared file (README, CHANGELOG, a config/registry doc)
touched by more than one concern. Do this before staging anything.

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
  - "Auto-commit all" — show the full numbered list of planned commit messages once; one
    approval covers the whole split. Execute all commits back-to-back with no per-commit
    modal. Still stop immediately and report if any commit fails (hook failure, conflict) —
    auto mode does not suppress error handling (SKILL.md Step 6).

Carry the chosen gating mode through Step 3 below.

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
2. For each shared file this commit touches, pick one technique:
   - **Progressive Read+Edit** (default — works for any file, no patch-format risk): the
     working tree already holds the _final_ state. Temporarily Edit out every hunk that
     belongs to a _later_ commit, stage the file, commit, then Edit those hunks back in so
     they're available for their own commit later.
   - **`git apply --cached <patch>`**: only when the target hunks are already cleanly
     `@@`-separated in `git diff <file>` — hand-craft a patch containing just those hunks and
     apply it to the index without touching the working tree.
3. Commit — still subject to Step 5's Confirm gate (or the batch gate on "Auto-commit all").
4. If a later commit needs to add more content to that same shared file, it starts from the
   state this commit just left behind — do not pre-populate all commits' content at once.

## 3.5. Integrity check (before the final commit)

Compare the split's cumulative diff against the original pre-split diff:
`git diff <pre-split-HEAD>..HEAD --stat`. File count and **deletion count** must match the
original diff exactly (deletions are a reliable invariant; insertion counts can drift a little
from estimation but should be in the same ballpark). Mismatch → stop before the final commit
and find the dropped/duplicated hunk — do not push a split you haven't verified.

## 4. Verify before committing when a test suite exists

If the repo has a test/check suite, run it against the file's current (partial) state before
committing — catching a bad split before it's in history is much cheaper than after.

## 5. If a split is built wrong

`git reset --soft HEAD~1` undoes the most recent commit while keeping everything staged exactly
as it was — safe as long as nothing has been pushed. Fix the staged content, then re-commit.
Never `git reset --hard` or force-push to recover from a self-made splitting mistake.
