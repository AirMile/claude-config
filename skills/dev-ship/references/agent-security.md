# AGENT S — Targeted OWASP audit (opt-in, read-only)

Runs only when `SHIP_PLAN.securityDeep` is non-empty. `securityDeep` is **auto-derived** in PHASE 0
from the feature's signals + pitfalls (no user prompt — see `phase-0-define-classify.md` Step 4).
Spawns **only those auto-derived** OWASP scanner agent(s) — never the full fleet — scoped to this
feature's files. Read-only: it **reports** findings;
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

**Primary (Workflow)**: for each code in `SHIP_PLAN.securityDeep`, write one scanner prompt (below)
to its own file, and pass the list as `args.scanners = [{code, promptPath}, ...]` to
`references/workflows/ship-phase4.js`. The script spawns them in parallel with
`agentType: "owasp-aNN-scanner"`, `model: "sonnet"`, `effort: "medium"`, validates each against
`SCAN_SCHEMA`, threshold-filters (confidence ≥ 60%) and runs the **opus triage pass** (§ Triage
below) over the merged findings.

**Fallback (Agent tool, when Workflow is unavailable)**: spawn each scanner via the `Agent` tool
with `subagent_type: "owasp-aNN-scanner"` (model per its agent definition — already `sonnet`). If
≥2 codes are selected, spawn them **in one message** (parallel — they are independent and
read-only); run the triage judgment inline in the main chat.

Pass paths, not content (see
`shared/SKILL-PATTERNS.md#pass-paths-not-content`): discover this feature's files via
`feature.json#files[]`, group them, and pass the categorized `<reference-paths>` block plus a short
`OWASP_CONTEXT` (stack, endpoints, auth pattern, data model) — the same inputs `dev-security` gives
its scanners. The scanner prompt is short and fully dynamic, so it is written directly (no static
prompt-body file needed):

```
Scope: security audit of feature "{feature}" ONLY — read the files in <reference-paths> below.
The feature lives in the worktree at {worktreePath} — the paths in <reference-paths> are prefixed
accordingly (pre-merge; these files do not exist on main yet).
This is REPORT-ONLY: do not modify any file, do not fix, do not write .project/. Return your
standard scanner output (score /10, positives, findings[{file,line,severity,confidence,issue,fix,
CWE}], verdict) — via your structured-output tool if you have one, otherwise as your normal
scanner report.

<reference-paths>
{categorized paths from feature.json#files[], each prefixed with {worktreePath}/}
</reference-paths>

OWASP_CONTEXT:
{stack summary · endpoints · auth pattern · data model}
```

## Triage (opus pass over the merged findings)

The full triage instruction body is the **static** file
`.claude/skills/dev-ship/references/prompts/security-triage.md` — the triage agent reads it itself.
`ship-phase4.js` calls that agent with `"Read the triage instructions in the file at
{triagePromptPath}, then triage these findings: …"` and appends the threshold-filtered findings as
JSON at call time; it runs as one `model: "opus"`, `effort: "high"` agent (matrix: SKILL.md § Design
— the only pass without a test backstop).

The main chat writes only a small **pointer + context** file to `triagePromptPath` (it does
**not** read `prompts/security-triage.md`):

```
Read `.claude/skills/dev-ship/references/prompts/security-triage.md` — it is your full instruction
set, for the feature "{feature}".

OWASP_CONTEXT:
{stack summary · endpoints · auth pattern · data model}
```

## Main-chat handling (PHASE 4, inside Workflow 2)

1. **Workflow path**: `ship-phase4.js` returns `{scannersRun, scannersFailed,
findingsAboveThreshold, triage: {confirmed[], dismissed[], summary}}` — read directly.
   **Fallback path**: collect each scanner's report, filter to `confidence ≥ 60%`
   (dev-security's threshold), and apply the triage judgment inline in the main chat (same
   criteria as the static triage file).
2. **Do not apply fixes.** In PHASE 5, present `triage.confirmed` (priority-ordered) +
   `triage.summary` and offer (as plain text, not an auto-run): "Run `/dev-security {feature}` to
   remediate." The PHASE 4 finalize still merges the verified feature regardless.
