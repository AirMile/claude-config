# Trace Analysis

Extract evidence from the target skill's real run in this conversation. Report only what actually happened — no hypothetical walkthroughs. Scan from the skill's invocation to its completion (or abandonment).

**Extract:**

1. **Deviations** — diff what SKILL.md prescribes against what Claude actually did: skipped or reordered steps, improvised output formats, instructions silently adapted. Every deviation marks an ambiguous, impractical, or unnecessary instruction. Classify each as **skip** (step not executed), **weaken** (executed below spec), or **improvise** (replaced with a reconstructed version). These classifications are the primary evidence for dimension 10 (Execution Adherence) — an observed skip on a step the static read predicted as solid caps that score at 3.
2. **User corrections** — every interruption, re-steer, rejection, or rephrase by the user. Map each friction point to the skill section that caused it.
3. **"Other" answers** — AskUserQuestion calls the user answered with custom text instead of an offered option → the option set was wrong or incomplete. Quote the custom answer.
4. **Auto-decidable modals** — questions whose answer was predictable from context already available (project files, conversation, sensible defaults). Count total modals vs avoidable ones.
5. **Unused loads** — reference files Read during the run whose content influenced no subsequent output; context blocks assembled but never used. These are direct token waste per run.
6. **Output mismatches** — output blocks the skill defines that could not be populated with available data, or were silently restructured to fit.
7. **Artifacts** — files the skill claims to create vs files actually created during the run (visible in the conversation); handoff fields updated vs the `writes:` declaration.
8. **Failed tool calls** — invocations that errored: an `Edit` whose `old_string` didn't match, Read/Bash on a path that doesn't exist, an unknown `subagent_type` or MCP tool, a schema error (wrong parameter, a 5th `AskUserQuestion` option — the tool caps at 4), a permission denial, or the same call retried 3+ times. Classify each as **skill-caused** (the skill supplied the wrong path, agent name, option set, command, or step order) or **executor noise** (stale read, transient failure, a path the skill never named). Only skill-caused errors become findings — quote the error and the instruction that produced it, and estimate the wasted tokens. A step that eventually succeeded after failed attempts is not a deviation — report it here, not in category 1.

**Not exercised:** list branches, options, and phases the run never hit. These get static-only analysis in Step 4 — do not invent observations for them.

**Report:**

```
TRACE OBSERVATIONS

Run: [skill] — [completed | partial: stopped at step X | abandoned]

Deviations:
- [what the skill prescribes] → [what actually happened] ([location]) — [skip|weaken|improvise]

Friction:
- [user correction/interruption] → [section that caused it]

Failed calls (skill-caused):
- [tool] [error] → [instruction that caused it] ([location])

Modals: [n] asked | [n] auto-decidable | "Other" answers: [n]
Tool errors: [n] total | [n] skill-caused | [n] retry loops
Unused loads: [files, or none]
Not exercised: [branches/phases]

Worked well:
- [steps that ran exactly as written]
```

Every observation cites concrete evidence (a quote or step reference) from the conversation. An empty category is reported as empty — not padded.
