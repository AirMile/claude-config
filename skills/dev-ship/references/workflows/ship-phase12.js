export const meta = {
  name: "ship-build-verify",
  description:
    "dev-ship PHASE 1+2: build the feature (sonnet/high), then adversarial auto-verify in a fresh context (opus/high)",
  whenToUse:
    "Launched by the dev-ship skill after PHASE 0 — not intended for standalone use.",
  phases: [
    {
      title: "Build",
      detail: "AGENT 1 — dev-build in worktree, never merges",
      model: "sonnet",
    },
    {
      title: "Verify",
      detail: "AGENT 2 — dev-verify AUTO/COVERED items, fresh context",
      model: "opus",
    },
  ],
};

// args: {
//   feature: string,
//   buildPrompt: string,           — fully assembled per agent-build.md (contract + build-slice inlined)
//   verifyPromptTemplate: string,  — per agent-verify.md, containing the literal placeholder {worktreePath}
//   resume?: { build?, verify? },  — green checkpoint results on a Resume; only a GREEN result
//                                     short-circuits its agent (a resumed failed result re-runs)
// }
// Model/effort matrix rationale: see dev-ship SKILL.md § Design.
// Resume: cross-session recovery reuses already-completed phase results from the checkpoint
// (shared/SHIP-CHECKPOINT.md) so credits/crash interruptions don't rebuild. Same-session resume
// additionally hits the Workflow runId cache via resumeFromRunId.

const BUILD_SCHEMA = {
  type: "object",
  properties: {
    status: { enum: ["green", "failed"] },
    feature: { type: "string" },
    worktreePath: {
      type: "string",
      description: "absolute path of the created worktree",
    },
    branch: { type: "string" },
    testsPass: { type: "integer" },
    testsTotal: { type: "integer" },
    filesCreated: { type: "integer" },
    filesModified: { type: "integer" },
    failedAt: {
      type: "string",
      description: 'REQ-id + short reason, or "none"',
    },
    autoDecisions: {
      type: "array",
      items: { type: "string" },
      description:
        "auto-choices made in place of AskUserQuestion (contract rule 3)",
    },
  },
  required: [
    "status",
    "feature",
    "worktreePath",
    "branch",
    "testsPass",
    "testsTotal",
    "failedAt",
    "autoDecisions",
  ],
};

const VERIFY_SCHEMA = {
  type: "object",
  properties: {
    status: { enum: ["green", "failed"] },
    feature: { type: "string" },
    autoPass: { type: "integer" },
    autoTotal: { type: "integer" },
    covered: { type: "integer" },
    remainingManualItems: {
      type: "array",
      description:
        "MANUAL items for the main-chat walkthrough (PHASE 3); empty when none",
      items: {
        type: "object",
        properties: {
          id: { type: "integer" },
          title: { type: "string" },
          steps: { type: "array", items: { type: "string" } },
          expected: { type: "string", description: "observable outcome" },
        },
        required: ["id", "title", "steps", "expected"],
      },
    },
    failedAt: {
      type: "string",
      description: 'item id + short reason, or "none"',
    },
    autoDecisions: { type: "array", items: { type: "string" } },
  },
  required: [
    "status",
    "feature",
    "autoPass",
    "autoTotal",
    "covered",
    "remainingManualItems",
    "failedAt",
    "autoDecisions",
  ],
};

// Only a green resume result short-circuits — passing a resumed FAILED result through would
// return the same failure forever instead of retrying the agent.
const resumedBuild =
  args.resume?.build?.status === "green" ? args.resume.build : null;
const resumedVerify =
  args.resume?.verify?.status === "green" ? args.resume.verify : null;

phase("Build");
const build =
  resumedBuild ??
  (await agent(args.buildPrompt, {
    label: "AGENT 1: build",
    agentType: "general-purpose",
    model: "sonnet",
    effort: "high",
    schema: BUILD_SCHEMA,
  }));
if (resumedBuild)
  log(`build resumed from checkpoint: worktree ${build.worktreePath}`);

if (!build || build.status !== "green") {
  // Failed build: never run verify; the worktree stays intact for /dev-debug.
  return {
    status: "failed",
    failedPhase: "build",
    build: build ?? {
      status: "failed",
      feature: args.feature,
      failedAt: "agent died (null return)",
    },
    verify: null,
  };
}
log(
  `build green: ${build.testsPass}/${build.testsTotal} tests, worktree ${build.worktreePath}`,
);

phase("Verify");
const verify =
  resumedVerify ??
  (await agent(
    args.verifyPromptTemplate.split("{worktreePath}").join(build.worktreePath),
    {
      label: "AGENT 2: verify",
      agentType: "general-purpose",
      model: "opus",
      effort: "high",
      schema: VERIFY_SCHEMA,
    },
  ));

if (!verify || verify.status !== "green") {
  return {
    status: "failed",
    failedPhase: "verify",
    build,
    verify: verify ?? {
      status: "failed",
      feature: args.feature,
      failedAt: "agent died (null return)",
    },
  };
}

return { status: "green", failedPhase: null, build, verify };
