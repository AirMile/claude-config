export const meta = {
  name: "ship-game-refactor",
  description:
    "game-ship PHASE 4: single-feature game-refactor (sonnet/medium) in the worktree (pre-merge), GUT test-guarded (revert-on-red)",
  whenToUse:
    "Launched by the game-ship skill after PHASE 3 playtest — finalize runs after this workflow returns — not intended for standalone use.",
  phases: [
    {
      title: "Refactor",
      detail:
        "AGENT 3 — game-refactor in the worktree (pre-merge), GUT test-guarded",
      model: "sonnet",
    },
  ],
};

// args: {
//   feature: string,
//   refactorPromptPath: string | null,  — path to the refactor-prompt file; null when the --no-refactor escape hatch was set
//   resume?: { refactor? },             — checkpoint result on a Resume; only a COMPLETED
//                                          result short-circuits (a resumed failed refactor re-runs)
// }
// Prompts are passed by file path, not inline — the spawned agent reads the file (large inline
// args can arrive undefined in the script; the sandbox can't read files but agents can).
// Model/effort matrix rationale: see game-ship SKILL.md § Design.
// Resume: a completed refactor in the checkpoint (shared/SHIP-CHECKPOINT.md) is reused rather than
// re-run. No security scanners/triage in the game pipeline — this is a single refactor agent.

const REFACTOR_SCHEMA = {
  type: "object",
  properties: {
    status: { enum: ["applied", "clean", "failed"] },
    feature: { type: "string" },
    lenses: { type: "array", items: { type: "string" } },
    techniquesApplied: { type: "integer" },
    techniquesReverted: { type: "integer" },
    testsGreen: { type: "boolean" },
    notes: {
      type: "string",
      description: '1-line summary, or "no refactor opportunities found"',
    },
    autoDecisions: { type: "array", items: { type: "string" } },
  },
  required: [
    "status",
    "feature",
    "lenses",
    "techniquesApplied",
    "techniquesReverted",
    "testsGreen",
    "notes",
    "autoDecisions",
  ],
};

// Defensive: some runtimes deliver the `args` global as a JSON STRING, not an object —
// property access on a string yields undefined (agents then get "the file at undefined").
// Normalize once; the rest of the script reads from `A`. (See SKILL.md § Design.)
const A = typeof args === "string" ? JSON.parse(args) : (args ?? {});
if (!A.refactorPromptPath) {
  log(
    `args-delivery: no refactor prompt after normalize — refactorPromptPath=${A.refactorPromptPath} (null is valid only under --no-refactor)`,
  );
}

// Only a completed resume result short-circuits — a resumed FAILED refactor must re-run.
const resumedRefactor = ["applied", "clean"].includes(
  A.resume?.refactor?.status,
)
  ? A.resume.refactor
  : null;

phase("Refactor");
const refactor = resumedRefactor
  ? resumedRefactor
  : A.refactorPromptPath
    ? await agent(
        `Read and execute the full instructions in the file at ${A.refactorPromptPath}.`,
        {
          label: "AGENT 3: refactor",
          agentType: "general-purpose",
          model: "sonnet",
          effort: "medium",
          schema: REFACTOR_SCHEMA,
        },
      )
    : null;

return {
  refactor:
    refactor ??
    (A.refactorPromptPath
      ? {
          status: "failed",
          feature: A.feature,
          notes: "agent died (null return)",
        }
      : null),
};
