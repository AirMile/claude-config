export const meta = {
  name: "ship-design-build-content-check",
  description:
    "design-ship PHASE 1-3: build the page (sonnet/high), fill copy (sonnet/medium), runtime audit + self-selected fixes (opus/high) — sequentially in one worktree",
  whenToUse:
    "Launched by the design-ship skill after PHASE 0 — not intended for standalone use.",
  phases: [
    {
      title: "Build",
      detail: "AGENT 1 — route-build codegen in worktree, never merges",
      model: "sonnet",
    },
    {
      title: "Content",
      detail: "AGENT 2 — copy fill, auto-apply + worktree commit (non-fatal)",
      model: "sonnet",
    },
    {
      title: "Check",
      detail:
        "AGENT 3 — runtime audit, fixes CRITICAL+HIGH itself, fresh context",
      model: "opus",
    },
  ],
};

// args: {
//   feature: string,
//   buildPrompt: string,            — fully assembled per agent-build.md (contract + build-slice inlined)
//   contentPromptTemplate: string,  — per agent-content.md, containing the literal placeholder {worktreePath}
//   checkPromptTemplate: string,    — per agent-check.md, containing the literal placeholder {worktreePath}
//   resume?: { build?, content?, check? },  — green checkpoint results on a Resume; only a GREEN
//                                              result short-circuits its agent (a resumed failed or
//                                              degraded result re-runs — content gets a retry)
// }
// Model/effort matrix rationale: see design-ship SKILL.md § Design.
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
    filesCreated: { type: "integer" },
    tokensUsed: {
      type: "integer",
      description: "theme token references in generated code",
    },
    smoke: { enum: ["PASS", "FAIL", "SKIPPED"] },
    smokeUrl: {
      type: "string",
      description:
        "dev-server URL of the rendered target, or empty when smoke was skipped",
    },
    failedAt: {
      type: "string",
      description: 'step + short reason, or "none"',
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
    "filesCreated",
    "smoke",
    "smokeUrl",
    "failedAt",
    "autoDecisions",
  ],
};

const CONTENT_SCHEMA = {
  type: "object",
  properties: {
    status: { enum: ["green", "failed"] },
    feature: { type: "string" },
    itemsApplied: { type: "integer" },
    itemsKept: {
      type: "integer",
      description: "KEEP-marked strings left untouched",
    },
    filesModified: { type: "integer" },
    copyTable: {
      type: "array",
      description:
        "before→after per applied item — the main-chat review payload (PHASE 4)",
      items: {
        type: "object",
        properties: {
          element: { type: "string" },
          category: { type: "string" },
          before: { type: "string" },
          after: { type: "string" },
        },
        required: ["element", "category", "before", "after"],
      },
    },
    glossaryTerms: { type: "integer" },
    failedAt: { type: "string", description: 'step + short reason, or "none"' },
    autoDecisions: { type: "array", items: { type: "string" } },
  },
  required: [
    "status",
    "feature",
    "itemsApplied",
    "filesModified",
    "copyTable",
    "failedAt",
    "autoDecisions",
  ],
};

const CHECK_SCHEMA = {
  type: "object",
  properties: {
    status: { enum: ["green", "failed"] },
    feature: { type: "string" },
    checksRun: { type: "array", items: { type: "string" } },
    findingsTotal: { type: "integer" },
    findingsResolved: { type: "integer" },
    findingsRemaining: { type: "integer" },
    readyForDone: {
      type: "boolean",
      description:
        "no unresolved CRITICAL findings — PHASE 4 may promote to DONE after merge",
    },
    criticalRemaining: {
      type: "array",
      items: { type: "string" },
      description: "unresolved CRITICAL finding IDs + one-line descriptions",
    },
    failedAt: { type: "string", description: 'step + short reason, or "none"' },
    autoDecisions: { type: "array", items: { type: "string" } },
  },
  required: [
    "status",
    "feature",
    "checksRun",
    "findingsTotal",
    "findingsResolved",
    "findingsRemaining",
    "readyForDone",
    "criticalRemaining",
    "failedAt",
    "autoDecisions",
  ],
};

// Only a green resume result short-circuits — passing a resumed FAILED result through would
// return the same failure forever instead of retrying the agent. A degraded content result
// re-running is deliberate: the resume is its retry chance.
const resumedBuild =
  args.resume?.build?.status === "green" ? args.resume.build : null;
const resumedContent =
  args.resume?.content?.status === "green" ? args.resume.content : null;
const resumedCheck =
  args.resume?.check?.status === "green" ? args.resume.check : null;

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
  // Failed build: never run content/check; the worktree (if created) stays intact.
  return {
    status: "failed",
    failedPhase: "build",
    build: build ?? {
      status: "failed",
      feature: args.feature,
      failedAt: "agent died (null return)",
    },
    content: null,
    check: null,
  };
}
log(
  `build green: ${build.filesCreated} file(s), smoke ${build.smoke}, worktree ${build.worktreePath}`,
);

phase("Content");
const content =
  resumedContent ??
  (await agent(
    args.contentPromptTemplate.split("{worktreePath}").join(build.worktreePath),
    {
      label: "AGENT 2: content",
      agentType: "general-purpose",
      model: "sonnet",
      effort: "medium",
      schema: CONTENT_SCHEMA,
    },
  ));

// Content failure is NON-FATAL: the page works, copy just stays placeholder.
// Continue to check; the degradation is surfaced in the PHASE 4 review.
const contentDegraded = !content || content.status !== "green";
if (contentDegraded) {
  log(
    `content degraded (${content ? content.failedAt : "agent died"}) — continuing to check with placeholder copy`,
  );
} else {
  log(
    `content green: ${content.itemsApplied} item(s) in ${content.filesModified} file(s)`,
  );
}

phase("Check");
const check =
  resumedCheck ??
  (await agent(
    args.checkPromptTemplate.split("{worktreePath}").join(build.worktreePath),
    {
      label: "AGENT 3: check",
      agentType: "general-purpose",
      model: "opus",
      effort: "high",
      schema: CHECK_SCHEMA,
    },
  ));

if (!check || check.status !== "green") {
  return {
    status: "failed",
    failedPhase: "check",
    contentDegraded,
    build,
    content,
    check: check ?? {
      status: "failed",
      feature: args.feature,
      failedAt: "agent died (null return)",
    },
  };
}

return {
  status: "green",
  failedPhase: null,
  contentDegraded,
  build,
  content,
  check,
};
