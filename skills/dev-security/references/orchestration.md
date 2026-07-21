# Orchestration — Workflow launches (executed by the main chat)

Both fan-outs (PHASE 2b scan, PHASE 4 fix plans) run as background Workflows, launched directly by
the main chat — same rationale as `dev-ship`/`game-ship`: a background subagent cannot call the
`Workflow` tool (not reachable even via `ToolSearch`), so there is no separate orchestrator agent.
Running it inline costs nothing extra — `Workflow` already runs in the background and notifies you
on return.

## 1. Ground rules

- If the `Workflow` tool's schema is not yet loaded, call `ToolSearch query="select:Workflow"`
  first.
- Each `Workflow(...)` launch below ends your turn with a short one-liner ("Scanning in the
  background — I'll report when it returns.") — no further tool calls until the task-notification
  arrives.
- **Never launch a Workflow from inside plan mode** — `ExitPlanMode` first if a plan-mode session is
  open (PHASE 3's "generate fix plans?" branch does this explicitly before PHASE 4).
- You are the audit-state file's only writer (workers never touch `.project/security/audit-*.json`
  — same non-interactive-contract principle as the ship pipelines).

## 2. PHASE 2b: OWASP scan — Workflow 1

Write the 10 scanner prompt files to `.project/security/prompts/{auditId}/{code}.md` —
**absolute paths** (since PHASE 5 later changes cwd into a worktree and these files must still
resolve) **and namespaced by `auditId`** — a bare `prompts/{code}.md` path collides when two
`/dev-security` runs are in flight at once (each run silently overwrites the other's scanner
prompts mid-write, corrupting both runs' findings with no error). The audit-state file is already
id-namespaced (`audit-{id}.json`); this brings the prompts directory in line with that convention.

Use this template per code (SKILL.md's PHASE 2b table gives `{category name}`/`{risk}` per code;
keep a one-line `{focus}` per category alongside that table):

```
# OWASP {CODE} Scanner — {feature or "full codebase"} audit

## Project root
{mainRoot}

## Tech stack
{stack summary}

## Scan scope
{file list, grouped by type: data/schema, backend logic, tests, frontend, config}

## OWASP_CONTEXT
API SURFACE: {endpoints or "not available"}
DATA MODEL: {entities or "not available"}
AUTH PATTERNS: {patterns or "not available"}

## Your task
Scan the files listed above for {category name} ({risk} risk) issues per your agent instructions.
Focus specifically on: {focus}. Report findings only within the scanned file list above.
```

Launch: `Workflow({scriptPath: ".claude/skills/dev-security/references/workflows/security-scan.js",
args: {auditId, scanners: [{code, promptPath}, ...], resume}})` — `scanners` is all 10 codes on a
fresh run; `resume.scanners` (from the audit-state file, PHASE 1's resume detection) carries any
codes a prior interrupted run already completed — the script skips re-spawning those.

Patch the audit state `phase: "PHASE 2b"` before launch. **End the turn here.**

On return: patch `scanners` and `aggregate` into the audit state (`updatedAt` stamped) — this
persists the scan **before** entering plan mode for PHASE 3 (plan mode blocks `.project/` writes;
see `shared/PLAN-MODE.md § Entry`). Then continue to `SKILL.md § PHASE 3`.

## 3. PHASE 4: Fix plans — Workflow 2

Only after the PHASE 3 AskUserQuestion chose "Yes, generate fix plans" and `ExitPlanMode` closed
the aggregation/report plan-mode session (a Workflow cannot launch from inside plan mode).

Write the findings file `.project/security/audit-{id}-findings.json` (the merged, threshold-filtered
findings from PHASE 3 — tool findings included) plus 3 small pointer-prompt files, one per strategy,
at `.project/security/prompts/{auditId}/fix-{strategy}.md` (same auditId-namespacing as § 2's
scanner prompts, and § 3 previously specified no directory for these at all), each: "Read
`.claude/skills/dev-security/references/fix-implement.md`'s findings file at `{findingsPath}` and
the fix philosophy in your own agent definition, then produce your fix plan."

Launch:
`Workflow({scriptPath: ".claude/skills/dev-security/references/workflows/security-fix-plans.js",
args: {auditId, planners: [{strategy, promptPath}, ...]}})` — always all 3 strategies, no resume
short-circuit (fix plans are cheap to regenerate and a stale plan against updated findings is worse
than a fresh one).

Patch the audit state `phase: "PHASE 4"` before launch. **End the turn here.**

On return: patch `plans` into the audit state. Continue to
`.claude/skills/dev-security/references/fix-implement.md § PHASE 5 gate`.

## 4. Fallback (Workflow tool unavailable)

**Scan**: spawn the 10 scanners via the `Agent` tool in **one message** (parallel — they are
independent and read-only), `subagent_type: "owasp-{code}-scanner"` (model per its agent
definition — already `sonnet`). Parse each structured report, then run the same aggregation this
file's Workflow 1 does in-script: confidence ≥60% filter, weight table (A01/A05 ×1.5), weighted
average, severity counts, anti-fantasy check (≥3 scores ≥9).

**Fix plans**: spawn the 3 planners via the `Agent` tool in one message,
`subagent_type: "owasp-fix-{minimal,pragmatic,extensive}"`, parse each structured plan.
