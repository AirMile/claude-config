# AGENT S — Targeted OWASP audit (opt-in, read-only)

Runs only when `SHIP_PLAN.securityDeep` is non-empty. Spawns **only the selected** OWASP scanner
agent(s) — never the full fleet — scoped to this feature's files. Read-only: it **reports** findings;
it does **not** auto-fix (security fixes need human judgment; surface them in PHASE 5). May run in
parallel with AGENT 3 (writes no `.project/`).

## Scanner map (this repo's numbering — note: not OWASP-2021 order)

| Code | Agent type          | Covers                    |
| ---- | ------------------- | ------------------------- |
| A01  | `owasp-a01-scanner` | access control            |
| A02  | `owasp-a02-scanner` | security misconfiguration |
| A03  | `owasp-a03-scanner` | supply chain              |
| A04  | `owasp-a04-scanner` | cryptographic failures    |
| A05  | `owasp-a05-scanner` | injection                 |
| A06  | `owasp-a06-scanner` | insecure design           |
| A07  | `owasp-a07-scanner` | authentication failures   |
| A08  | `owasp-a08-scanner` | data integrity            |
| A09  | `owasp-a09-scanner` | logging/monitoring        |
| A10  | `owasp-a10-scanner` | exception handling        |

## Spawn

For each code in `SHIP_PLAN.securityDeep`, spawn its scanner via the `Agent` tool with
`subagent_type: "owasp-aNN-scanner"`. If ≥2 codes are selected, spawn them **in one message**
(parallel — they are independent and read-only). Pass paths, not content (see
`shared/SKILL-PATTERNS.md#pass-paths-not-content`): discover this feature's files via
`feature.json#files[]`, group them, and pass the categorized `<reference-paths>` block plus a short
`OWASP_CONTEXT` (stack, endpoints, auth pattern, data model) — the same inputs `dev-security` gives
its scanners.

## Prompt additions per scanner

```
Scope: security audit of feature "{feature}" ONLY — read the files in <reference-paths> below.
This is REPORT-ONLY: do not modify any file, do not fix, do not write .project/. Return your
standard scanner output (score /10, positives, findings[{file,line,severity,confidence,issue,fix,
CWE}], verdict).

<reference-paths>
{categorized paths from feature.json#files[]}
</reference-paths>

OWASP_CONTEXT:
{stack summary · endpoints · auth pattern · data model}
```

## Orchestrator handling (PHASE 4, parallel to AGENT 3)

1. Collect each scanner's output. Filter findings to `confidence ≥ 60%` (dev-security's threshold).
2. Aggregate into a compact `SHIP_SECURITY_RESULT` for PHASE 5:

```
SHIP_SECURITY_RESULT_START
categories: [A05, A01]
findings:
  - [A05] {file}:{line} — {severity} — {issue}  (fix: {fix})
  # ... or "none above threshold"
SHIP_SECURITY_RESULT_END
```

3. **Do not apply fixes.** In PHASE 5, present findings and offer (as plain text, not an auto-run):
   "Run `/dev-security {feature}` to remediate." The feature stays shipped/merged regardless.
