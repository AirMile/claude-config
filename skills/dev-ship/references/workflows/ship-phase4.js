export const meta = {
  name: "ship-refactor-security",
  description:
    "dev-ship PHASE 4: single-feature refactor (sonnet/medium) in parallel with targeted OWASP scanners (sonnet/medium), then one sonnet triage pass over the findings",
  whenToUse:
    "Launched by the dev-ship skill after PHASE 3 manual tests — finalize runs after this workflow returns — not intended for standalone use.",
  phases: [
    {
      title: "Refactor",
      detail:
        "AGENT 3 — dev-refactor in the worktree (pre-merge), test-guarded",
      model: "sonnet",
    },
    {
      title: "Security",
      detail: "AGENT S — selected OWASP scanners + sonnet triage",
      model: "sonnet",
    },
  ],
};

// args: {
//   feature: string,
//   refactorPromptPath: string | null,       — path to the refactor-prompt file; null when the --no-refactor escape hatch was set
//   scanners: [{ code: string, promptPath: string }],  — one per SHIP_PLAN.securityDeep code (e.g. "A05"); [] when none
//   triagePromptPath: string,                — path to the triage-prompt file (agent-security.md § Triage); findings JSON appended at call time
//   resume?: { refactor?, triage? },         — checkpoint results on a Resume; only a COMPLETED
//                                               result short-circuits (a resumed failed refactor re-runs)
// }
// Prompts are passed by file path, not inline — the spawned agent reads the file (large inline
// args can arrive undefined in the script; the sandbox can't read files but agents can).
// Model/effort matrix rationale: see dev-ship SKILL.md § Design.
// Resume: a completed refactor/triage in the checkpoint (shared/SHIP-CHECKPOINT.md) is reused
// rather than re-run; if triage is already done the scanners are skipped too. In that case
// scannersRun/scannersFailed return [] — the report keeps the original run's values.

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

const SCAN_SCHEMA = {
  type: "object",
  properties: {
    score: { type: "number", description: "category score out of 10" },
    positives: { type: "array", items: { type: "string" } },
    findings: {
      type: "array",
      items: {
        type: "object",
        properties: {
          file: { type: "string" },
          line: { type: "integer" },
          severity: { enum: ["critical", "high", "medium", "low"] },
          confidence: { type: "integer", description: "0-100" },
          issue: { type: "string" },
          fix: { type: "string" },
          cwe: { type: "string" },
        },
        required: ["file", "line", "severity", "confidence", "issue", "fix"],
      },
    },
    verdict: { type: "string" },
  },
  required: ["score", "findings", "verdict"],
};

const TRIAGE_SCHEMA = {
  type: "object",
  properties: {
    confirmed: {
      type: "array",
      description: "real findings, deduped, priority-ordered (1 = highest)",
      items: {
        type: "object",
        properties: {
          category: { type: "string", description: "OWASP code, e.g. A05" },
          file: { type: "string" },
          line: { type: "integer" },
          severity: { enum: ["critical", "high", "medium", "low"] },
          issue: { type: "string" },
          fix: { type: "string" },
          priority: { type: "integer" },
        },
        required: [
          "category",
          "file",
          "line",
          "severity",
          "issue",
          "fix",
          "priority",
        ],
      },
    },
    dismissed: {
      type: "array",
      description:
        "findings judged false-positive or duplicate, with the reason",
      items: {
        type: "object",
        properties: {
          file: { type: "string" },
          line: { type: "integer" },
          reason: { type: "string" },
        },
        required: ["file", "line", "reason"],
      },
    },
    summary: {
      type: "string",
      description: "1-2 line overall security verdict for the PHASE 5 report",
    },
  },
  required: ["confirmed", "dismissed", "summary"],
};

// Defensive: some runtimes deliver the `args` global as a JSON STRING, not an object —
// property access on a string yields undefined (agents then get "the file at undefined").
// Normalize once; the rest of the script reads from `A`. (See SKILL.md § Design.)
const A = typeof args === "string" ? JSON.parse(args) : (args ?? {});
if (!A.refactorPromptPath && !A.scanners?.length) {
  log(
    `args-delivery: no refactor prompt and no scanners after normalize — refactorPromptPath=${A.refactorPromptPath}, scanners=${A.scanners?.length ?? 0}`,
  );
}

// Refactor and scanners are independent (scanners are read-only, no .project/ writes) → run in
// parallel. The barrier before triage is justified: triage needs ALL scanner findings at once.
// If triage was already resumed from the checkpoint, the scanners don't need to re-run.
const scanners = A.resume?.triage ? [] : (A.scanners ?? []);
// Only a completed resume result short-circuits — a resumed FAILED refactor must re-run.
const resumedRefactor = ["applied", "clean"].includes(
  A.resume?.refactor?.status,
)
  ? A.resume.refactor
  : null;
const thunks = [
  () =>
    resumedRefactor
      ? Promise.resolve(resumedRefactor)
      : A.refactorPromptPath
        ? agent(
            `Read and execute the full instructions in the file at ${A.refactorPromptPath}.`,
            {
              label: "AGENT 3: refactor",
              agentType: "general-purpose",
              model: "sonnet",
              effort: "medium",
              phase: "Refactor",
              schema: REFACTOR_SCHEMA,
            },
          )
        : Promise.resolve(null),
  ...scanners.map(
    (s) => () =>
      agent(
        `Read and execute the full instructions in the file at ${s.promptPath}.`,
        {
          label: `scan:${s.code}`,
          agentType: `owasp-${s.code.toLowerCase()}-scanner`,
          model: "sonnet",
          effort: "medium",
          phase: "Security",
          schema: SCAN_SCHEMA,
        },
      ).then((r) => (r ? { code: s.code.toUpperCase(), ...r } : null)),
  ),
];

const [refactor, ...scans] = await parallel(thunks);

// dev-security's confidence threshold; below it findings are noise.
const findings = scans
  .filter(Boolean)
  .flatMap((r) => (r.findings ?? []).map((f) => ({ category: r.code, ...f })))
  .filter((f) => f.confidence >= 60);
if (scanners.length) {
  log(
    `security: ${findings.length} finding(s) at confidence >= 60% from ${scans.filter(Boolean).length}/${scanners.length} scanner(s)`,
  );
}

phase("Security");
const triage =
  A.resume?.triage ??
  (findings.length
    ? await agent(
        `Read the triage instructions in the file at ${A.triagePromptPath}, then triage these findings:\n\nFINDINGS (JSON):\n${JSON.stringify(findings, null, 2)}`,
        {
          label: "security triage",
          model: "sonnet",
          effort: "high",
          schema: TRIAGE_SCHEMA,
        },
      )
    : null);

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
  scannersRun: scanners.map((s) => s.code.toUpperCase()),
  scannersFailed: scanners
    .filter((_, i) => !scans[i])
    .map((s) => s.code.toUpperCase()),
  findingsAboveThreshold: findings.length,
  triage,
};
