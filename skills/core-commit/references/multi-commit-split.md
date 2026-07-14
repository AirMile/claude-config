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

## 2. Map files to commits

For each planned commit, list the files it fully owns. For a file touched by more than one
commit, identify the specific hunks belonging to each commit — never assign the whole file to
one commit if that would silently drop another commit's content.

## 3. Stage whole-owned files, then build shared files incrementally

For each commit, in dependency order:

1. `git add` every file wholly owned by this commit.
2. For each shared file this commit touches: edit it to contain exactly (already-committed
   content) + (this commit's hunks) — no more. Stage it.
3. Commit — still subject to Step 5's Confirm gate; every commit in the split gets its own.
4. If a later commit needs to add more content to that same shared file, it starts from the
   state this commit just left behind — do not pre-populate all commits' content at once.

## 4. Verify before committing when a test suite exists

If the repo has a test/check suite, run it against the file's current (partial) state before
committing — catching a bad split before it's in history is much cheaper than after.

## 5. If a split is built wrong

`git reset --soft HEAD~1` undoes the most recent commit while keeping everything staged exactly
as it was — safe as long as nothing has been pushed. Fix the staged content, then re-commit.
Never `git reset --hard` or force-push to recover from a self-made splitting mistake.
