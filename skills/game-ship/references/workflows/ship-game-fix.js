export const meta = {
  name: "ship-game-fix-round",
  description:
    "game-ship PHASE 3: plan-bound fix agents over file-disjoint groups — parallel within a wave, sequential across waves, all in the same worktree, GUT test-guarded",
  whenToUse:
    "Launched by game-ship's fix-round.md after the PHASE 3 fix-plan gate accepts — not intended for standalone use.",
  phases: [
    {
      title: "Fix",
      detail:
        "AGENT F — one fix agent per group, wave-ordered, headless GUT verification",
      model: "sonnet",
    },
  ],
};

// args: {
//   feature: string,
//   worktreePath: string,
//   waves: [ [ { id: string, promptPath: string } ] ],  — outer array = waves (sequential),
//                                                          inner array = file-disjoint groups (parallel)
//   resume?: { groups: { [id]: FixResult } },            — only status:"fixed" short-circuits;
//                                                          partial/failed groups re-run
// }
// Prompts are passed by file path, not inline (same discipline as ship-game-phase12.js/
// ship-game-phase4.js) — the descriptor + pointers live in the file at promptPath, written by
// fix-round.md at gate-accept. No game window in a subagent (contract rule 8) — fix agents verify
// headless via GUT.

const FIX_SCHEMA = {
  type: "object",
  properties: {
    status: { enum: ["fixed", "partial", "failed"] },
    group: { type: "string" },
    itemsFixed: { type: "array", items: { type: "string" } },
    testsGreen: { type: "boolean" },
    notes: {
      type: "string",
      description: "1-line summary, or the blocker if not fully fixed",
    },
    autoDecisions: { type: "array", items: { type: "string" } },
  },
  required: [
    "status",
    "group",
    "itemsFixed",
    "testsGreen",
    "notes",
    "autoDecisions",
  ],
};

// Defensive: some runtimes deliver the `args` global as a JSON STRING, not an object — property
// access on a string yields undefined (agents then get "the file at undefined").
const A = typeof args === "string" ? JSON.parse(args) : (args ?? {});
if (!A.waves?.flat?.().length) {
  log(
    `args-delivery: no groups after normalize — waves=${JSON.stringify(A.waves)}`,
  );
}

const results = {};
for (const [i, wave] of (A.waves ?? []).entries()) {
  phase("Fix");
  const out = await parallel(
    wave.map((g) => () => {
      const resumed = A.resume?.groups?.[g.id];
      if (resumed?.status === "fixed") return Promise.resolve(resumed);
      return agent(
        `Read and execute the full instructions in the file at ${g.promptPath}.`,
        {
          label: `fix:${g.id}`,
          agentType: "general-purpose",
          model: "sonnet",
          effort: "high",
          phase: "Fix",
          schema: FIX_SCHEMA,
        },
      ).then(
        (r) =>
          r ?? {
            status: "failed",
            group: g.id,
            itemsFixed: [],
            testsGreen: false,
            notes: "agent died (null return)",
            autoDecisions: [],
          },
      );
    }),
  );
  wave.forEach((g, j) => (results[g.id] = out[j]));
  log(
    `wave ${i + 1}/${A.waves.length}: ${out.filter((r) => r.status === "fixed").length}/${wave.length} fixed`,
  );
  // Continue to later waves even on a failure in this one — groups are file-disjoint from anything
  // in the SAME wave only; the re-check round (fix-round.md § Re-check) is what surfaces and
  // escalates anything still broken.
}

return {
  groups: results,
  allFixed: Object.values(results).every((r) => r.status === "fixed"),
};
