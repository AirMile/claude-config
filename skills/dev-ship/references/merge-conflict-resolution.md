# Merge Conflict Resolution (PHASE 4 finalize)

Loaded only when the solo-merge step (`shared/FINALIZE.md § Solo-Merge Procedure`, step 5) hits a
real conflict. Two independently-developed features touching the same file is common in a project
that ships many small features through worktrees — do not treat this as exceptional or improvise
from scratch each time.

## Step 1 — Abort and assess before retrying

`git merge --abort` first if the conflicted merge is still open. Read the conflicting files' marker
regions to judge scale: a handful of hunks that are each "both sides added a new, disjoint block at
the same insertion point" (no shared logic touched) is safe to resolve directly. A conflict that
edits the same lines with different intent needs real reconciliation — read both sides' surrounding
code to understand what each one is trying to do before touching anything.

For anything beyond a trivial 1-2 line conflict, tell the user what's conflicting and why (which
other feature/commit collided and on what shared surface) before spending time resolving it — this
is exactly the kind of "hard to reverse, needs judgment" work that warrants a heads-up, even inside
an otherwise-autonomous ship run.

## Step 1b — Generated files: don't hand-splice, regenerate

A conflict confined to a generated/codegen-output file (e.g. Convex `convex/_generated/*`, GraphQL
codegen, protobuf output) is not a real logic conflict — both sides independently regenerated the
same derived artifact from their own subset of source files. Do not diff/splice it by hand:

1. Resolve the conflict by picking either side (`git checkout --ours <path>` or `--theirs` — the
   content is about to be overwritten anyway).
2. `git add <path>`.
3. Regenerate for real from the now-merged source (the project's own codegen command — e.g.
   `npx convex dev --once` for Convex) so the output reflects every merged module, not just one
   side's.
4. Continue to Step 5 (verify) on the regenerated file.

Skip Steps 2–4 below for this file; they apply to hand-written source conflicts.

## Step 2 — Extract both full versions

Re-trigger the merge (`git merge --no-ff <branch> -m "..."`) to regenerate conflict markers, then
pull each side's complete pre-merge file out of the merge index instead of reasoning from the
marker fragments alone:

```bash
git show :2:<path> > /tmp/ours.txt    # HEAD's version (stage 2)
git show :3:<path> > /tmp/theirs.txt  # incoming branch's version (stage 3)
```

Having both complete files lets you diff them directly, which is far more reliable than parsing
interleaved `<<<<<<<`/`=======`/`>>>>>>>` fragments for anything beyond a one-hunk conflict.

## Step 3 — Find the common prefix/suffix, split additive blocks

When both sides added new, independent content (new functions, new struct fields, new test cases)
at the same location — the common case for two parallel features — diff the extracted files for a
byte-identical shared region:

```bash
diff <(sed -n '<start>,<end>p' ours.txt) <(sed -n '<start>,<end>p' theirs.txt)
```

An empty diff confirms that region is genuinely shared (inherited from the common ancestor,
untouched by either feature) — safe to keep once. Everything outside that shared region is one
side's unique addition; the safe resolution is: shared-prefix + ours-unique + theirs-unique
(or vice versa, order rarely matters) + shared-suffix, each unique block copied verbatim from its
source file, not reconstructed from memory.

## Step 4 — Watch for the shared-closing-brace-tail trap

**This is the sharp edge that silently produces a broken file.** When both sides' unique additions
are new functions/blocks that happen to end in identical boilerplate (e.g. both a Rust
`spawn_blocking(...).await.map_err(...)?}`-style ending, or both a JS `.catch(...)}`-style ending),
git's diff algorithm treats that identical tail as a **shared suffix** and shows it only **once**,
after the `>>>>>>>` marker — even though semantically each side's own function needs its own copy of
that closing tail to be syntactically complete.

Naively concatenating "ours-content + theirs-content + the-one-shared-tail-shown" leaves the FIRST
side's function/block unclosed (missing brace/paren), which only surfaces as a compile error or a
much-later syntax error — not at the conflict site itself. Before trusting an automated
concatenation of a hunk, check whether the content on either side of the marker ends with an
**unclosed** delimiter (an open `{`, unclosed paren, or a closure that hasn't returned) — if so, the
shared tail must be duplicated once per side, not kept once for the last side only.

Practical check: after resolving, compile/typecheck the file before moving to the next conflict.
Catching an unclosed-delimiter error immediately (one file, fresh in context) is far cheaper than
discovering it after several more hunks are resolved on top.

## Step 5 — Verify before completing the merge commit

**If the merge touched a dependency manifest** (`package.json`, `pyproject.toml`, `Cargo.toml`, …):
install/sync first (`npm install`, `pip install -e .`, …) — a clean manifest merge does not
materialize new packages into `node_modules`/the venv/etc. on its own, and skipping this step
produces spurious "Cannot find module" failures that look like a real merge regression.

Once every conflict marker is gone: run the full test suite for **every language/toolchain** the
touched files belong to (not just the one most associated with this feature) — a cross-feature
conflict by definition means code from two different ship runs is now interacting for the first
time. Only complete the merge commit (`git commit` with no `-m` needed if `MERGE_MSG` already has
one queued) once everything is green.

## Step 6 — Return to the normal finalize flow

Continue with `shared/FINALIZE.md`'s remaining Solo-Merge steps (optional push, Cleanup Procedure)
exactly as if the merge had gone through cleanly.
