export const meta = {
  name: "security-owasp-scan",
  description:
    "dev-security PHASE 2b: 10 parallel OWASP category scanners (sonnet/medium), deterministic weighted aggregation",
  whenToUse:
    "Launched by the dev-security skill after PHASE 2 tooling — not intended for standalone use.",
  phases: [
    {
      title: "Scan",
      detail: "10 owasp-aNN-scanner agents, one per OWASP category",
      model: "sonnet",
    },
  ],
};

// args: {
//   auditId: string,
//   scanners: [{ code: string, promptPath: string }],  — one per OWASP category (A01..A10)
//   resume?: { scanners: { [code]: { score, findings, verdict, ... } } },  — audit-state
//                                                       results already collected; those codes
//                                                       are not re-spawned
// }
// Prompts are passed by file path, not inline (the sandbox can't read files but agents can).
// This script only does DETERMINISTIC aggregation (weighted average, confidence filter, counts) —
// it cannot read the PHASE 2 tool report files (OSV/Semgrep/gitleaks), so merging those into the
// findings and the PASS/NEEDS-WORK verdict stays in the main chat (SKILL.md § PHASE 3).

const SCAN_SCHEMA = {
  type: "object",
  properties: {
    score: { type: "number", description: "category score out of 10" },
    scoreJustification: { type: "string" },
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
  required: ["score", "positives", "findings", "verdict"],
};

// Category weight table — mirrors dev-security SKILL.md § PHASE 3's "CRITICAL categories x1.5".
const WEIGHTS = { A01: 1.5, A05: 1.5 };
const weightOf = (code) => WEIGHTS[code] ?? 1;

const A = typeof args === "string" ? JSON.parse(args) : (args ?? {});
if (!A.scanners?.length) {
  log(
    `args-delivery: no scanners after normalize — scanners=${A.scanners?.length ?? 0}`,
  );
}

const resumedCodes = new Set(Object.keys(A.resume?.scanners ?? {}));
const toRun = (A.scanners ?? []).filter(
  (s) => !resumedCodes.has(s.code.toUpperCase()),
);
if (resumedCodes.size) {
  log(
    `resume: ${resumedCodes.size} scanner(s) already complete, running ${toRun.length} more`,
  );
}

const results = await parallel(
  toRun.map(
    (s) => () =>
      agent(
        `Read and execute the full instructions in the file at ${s.promptPath}.`,
        {
          label: `scan:${s.code}`,
          agentType: `owasp-${s.code.toLowerCase()}-scanner`,
          model: "sonnet",
          effort: "medium",
          phase: "Scan",
          schema: SCAN_SCHEMA,
        },
      ).then((r) => ({ code: s.code.toUpperCase(), result: r })),
  ),
);

const scanners = { ...(A.resume?.scanners ?? {}) };
const scannersFailed = [];
for (const { code, result } of results) {
  if (result) scanners[code] = result;
  else scannersFailed.push(code);
}

const codes = Object.keys(scanners);
const totalWeight = codes.reduce((sum, c) => sum + weightOf(c), 0);
const overallScore = totalWeight
  ? codes.reduce((sum, c) => sum + scanners[c].score * weightOf(c), 0) /
    totalWeight
  : 0;

const allFindings = codes.flatMap((c) =>
  (scanners[c].findings ?? [])
    .filter((f) => f.confidence >= 60)
    .map((f) => ({ category: c, ...f })),
);
const counts = { critical: 0, high: 0, medium: 0, low: 0 };
for (const f of allFindings) counts[f.severity] = (counts[f.severity] ?? 0) + 1;

const highScoreCount = codes.filter((c) => scanners[c].score >= 9).length;

log(
  `scan: ${codes.length}/${(A.scanners ?? []).length} categories complete, ${allFindings.length} finding(s) at confidence >= 60%, overall ${overallScore.toFixed(1)}/10`,
);

return {
  scanners,
  aggregate: {
    overallScore,
    findings: allFindings,
    counts,
    scannersFailed,
    antiFantasySuspect: highScoreCount >= 3,
  },
};
