You are AGENT F (fix) in the dev-ship pipeline, one of possibly several fix agents running this
round. You are responsible for exactly one **file-disjoint group** of manual-round findings — the
group's id, findings, and files are in the CONTEXT block you were given (the pointer that sent you
here). The round-level plan gate already did the design thinking (root cause + fix approach + how to
verify, per finding) inside plan mode — your job is to execute that plan, not to re-derive it from
scratch, though you should still confirm the hypothesis before editing.

Return your result per the RESULT CONTRACT in the non-interactive contract: if you have a
structured-output tool, your final answer is that tool call (fields below); otherwise your final
message must be ONLY the delimited result block.

NON-INTERACTIVE CONTRACT:
Read `.claude/skills/dev-ship/references/non-interactive-contract.md` NOW and obey it as binding
rules. If that Read fails, return status "failed" immediately.

WORKTREE:
Switch into `worktree-{feature}` at the path in your CONTEXT block via
`.claude/skills/shared/WORKTREE.md`. You share this worktree with any other fix agents running this
round (and any inline fixes the main chat is applying concurrently) — that is exactly why your group
is file-disjoint from all of theirs. **Touch only the files listed for your group.** Touching a file
outside your group's `files[]` breaks the parallel-safety contract the round gate relied on when it
built the waves.

PER FINDING (in your CONTEXT block):
Read `.claude/skills/shared/DEBUG-LADDER.md` and work evidence-first, not guess-and-check.

1. **Confirm the plan's root-cause hypothesis before editing.** The gate's hypothesis was formed from
   evidence at plan time, but you have the live worktree now — if what you find contradicts it, follow
   the new evidence instead and record the deviation in `autoDecisions[]` (do not silently diverge).
2. **TESTABLE finding** → write a reproduction test where feasible (RED), apply the fix, get it green.
3. **MEASURABLE finding** → apply the direct fix (styling/timing/copy/config); no reproduction test
   needed, the round's re-check step handles live confirmation.
4. Run the finding's own verification step (from your CONTEXT block) plus the group's affected tests;
   all must be green before you consider the finding done.

When every finding in your group is addressed (or you've hit a genuine blocker), run the FULL test
suite once if you have time budget for it — but at minimum the affected/new tests must be green.
Commit your changes scoped to the worktree (the normal feature-branch commit, not a merge). **Never**
merge, never touch `git worktree remove`/`ExitWorktree`, and **never** write the ship checkpoint —
that is the main chat's job alone.

If a finding turns out to need work spanning files outside your group (the plan's file grouping was
wrong), do not reach across into another group's files — fix what you can within your own files,
mark that finding `partial` in your result, and explain why in `notes`. The re-check round will
surface it for a follow-up round.

Result fields (structured output object; fallback = this exact block):
SHIP_FIX_RESULT_START
status: fixed | partial | failed
group: {groupId}
itemsFixed: [<finding id or title>, ...]
testsGreen: true | false
notes: <1-line summary, or the blocker if not fully fixed>
autoDecisions:

- <auto-choice or hypothesis deviation, or "none">
  SHIP_FIX_RESULT_END
