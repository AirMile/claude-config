export const meta = {
  name: "security-fix-plans",
  description:
    "dev-security PHASE 4: 3 parallel fix-strategy planners (sonnet/high) over the aggregated findings",
  whenToUse:
    "Launched by the dev-security skill after PHASE 3 aggregation — not intended for standalone use.",
  phases: [
    {
      title: "Fix Plans",
      detail: "owasp-fix-{minimal,pragmatic,extensive} planning agents",
      model: "sonnet",
    },
  ],
};

// args: {
//   auditId: string,
//   planners: [{ strategy: "minimal"|"pragmatic"|"extensive", promptPath: string }],
// }
// The main chat writes one findings file (.project/security/audit-{id}-findings.json) plus one
// small pointer-prompt file per strategy, and passes only the paths — the sandbox can't read
// files but agents can (same rationale as the ship-phase4.js prompt pattern).

const FIX_PLAN_SCHEMA = {
  type: "object",
  properties: {
    strategy: { enum: ["minimal", "pragmatic", "extensive"] },
    fixes: {
      type: "array",
      items: {
        type: "object",
        properties: {
          findingRef: {
            type: "string",
            description: "category + file:line, e.g. A05 src/api/x.ts:42",
          },
          file: { type: "string" },
          line: { type: "integer" },
          severity: { enum: ["critical", "high", "medium", "low"] },
          change: { type: "string" },
          risk: { enum: ["low", "medium", "high"] },
        },
        required: ["findingRef", "file", "line", "severity", "change", "risk"],
      },
    },
    filesTouched: { type: "integer" },
    effortEstimate: { type: "string" },
    coverage: { type: "string" },
    notes: { type: "string" },
  },
  required: [
    "strategy",
    "fixes",
    "filesTouched",
    "effortEstimate",
    "coverage",
    "notes",
  ],
};

const A = typeof args === "string" ? JSON.parse(args) : (args ?? {});
if (!A.planners?.length) {
  log(
    `args-delivery: no planners after normalize — planners=${A.planners?.length ?? 0}`,
  );
}

const results = await parallel(
  (A.planners ?? []).map(
    (p) => () =>
      agent(
        `Read and execute the full instructions in the file at ${p.promptPath}.`,
        {
          label: `fix-plan:${p.strategy}`,
          agentType: `owasp-fix-${p.strategy}`,
          model: "sonnet",
          effort: "high",
          phase: "Fix Plans",
          schema: FIX_PLAN_SCHEMA,
        },
      ).then((r) => ({ strategy: p.strategy, result: r })),
  ),
);

const plans = {};
const plannersFailed = [];
for (const { strategy, result } of results) {
  if (result) plans[strategy] = result;
  else plannersFailed.push(strategy);
}

log(
  `fix-plans: ${Object.keys(plans).length}/${(A.planners ?? []).length} strategies complete`,
);

return { plans, plannersFailed };
