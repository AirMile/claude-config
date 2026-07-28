---
name: dev-security
description: Use when a security audit of the codebase is needed. Use with /dev-security.
reads:
  [
    project.endpoints,
    project.entities,
    project-context.context,
    security.shipTriage,
  ]
writes: [security.audit, backlog.status]
writes-terminal: [security.reports]
metadata:
  author: claude-config
  version: 3.7.0
  category: dev
---

# Security Audit

Deep security audit — OWASP Top 10:2025 + supply-chain/SAST/secret tooling: scope → tooling → 10
parallel scanners → aggregated report → 3 fix strategies → worktree'd implementation.

## Process

**Phase tracking** — first action of the skill: call `TaskCreate` with these 6 items (status
`pending`), then use `TaskUpdate` to set each phase `in_progress` at start and `completed` at end.
During context compaction the task list remains visible — no risk of forgotten phases. If
`ToolSearch` cannot resolve `TaskCreate`/`TaskUpdate` (unavailable this session), skip phase
tracking silently and proceed — the audit-state file's own `phase` field (§ Step 5 below, patched
at every phase boundary) remains the durable resumability signal regardless.

**Durable audit state (lightweight, not a full ship checkpoint)** — beyond the compaction-safe
`TaskCreate` list, PHASE 1 writes `.project/security/audit-{id}.json` and every later phase patches
it at each boundary. Unlike `shared/SHIP-CHECKPOINT.md`'s ship pipelines, this is a plain state file
this skill owns and resumes itself — there is no `route` subcommand, no ledger, no board signal. It
is **kept on completion** (it is the durable audit record, not a transient in-flight marker).

1. PHASE 1: Scope
2. PHASE 2: Tooling scan
3. PHASE 2b: Parallel OWASP scan
4. PHASE 3: Aggregation & Report
5. PHASE 4: Fix Plans
6. PHASE 5: Selection & Implementation

## PHASE 1: Scope

> **Todo**: call `ToolSearch query="select:TaskCreate,TaskUpdate,Workflow"` first — deferred tools
> are unusable without their schemas, and PHASE 2b needs `Workflow` loaded regardless of which
> branch below fires. If `TaskCreate`/`TaskUpdate` don't resolve, skip task tracking and continue —
> `Workflow` is still required.

### Step 0: Resume check (before seeding tasks)

`ls .project/security/audit-*.json` (glob, may be empty). For each match with `status: "running"`:

- `updatedAt` within the last 24h → AskUserQuestion — header: "Resume audit", question: "An
  in-progress audit from {relative time} exists ({phase}, scope: {scope.choice}). Resume it?":
  - "Resume (Recommended)" — load the audit state, re-seed `TaskCreate` (phases before the
    recorded `phase` created `completed`, the rest `pending` — never seed all 6 `pending` then
    flip), jump straight to that `phase` below (PHASE 2b's scan Workflow gets `resume.scanners`
    from `scanners` already collected; PHASE 4 similarly skips if `plans` is already populated).
  - "Restart fresh" — leave the stale file on disk (do not delete — it's evidence of an
    interruption), fall through to Step 1.
  - "Inspect first" — print the audit state's `scope`/`phase`/`aggregate.overallScore` (if any),
    re-ask.
- Older than 24h, or `status: "complete"` → skip silently (stale or already-done), continue to
  Step 1.

No matches → continue to Step 1.

> **Todo**: call `TaskCreate` with the 6 phase items (see above) — on a resume, seed per the
> re-seed rule just described. Mark PHASE 1 → `in_progress` via `TaskUpdate`.

### Step 1: Detect tech stack

Project CLAUDE.md or `.project/project.json#stack` already documents the stack → reuse it, skip
the scan. Otherwise, scan the project for languages, frameworks, and entry points:

- Glob for `package.json`, `requirements.txt`, `composer.json`, `go.mod`, `Cargo.toml`, `Gemfile`
- Identify framework (Express, Django, Laravel, Rails, Next.js, etc.)
- Map source directories (controllers, routes, API handlers, middleware)

### Step 2: Confirm scope

**Explicit feature-arg auto-resolve** — when invoked as `/dev-security {feature}` (an explicit
feature-name arg), resolve scope automatically, no modal:

1. `.project/security/ship-triage-{feature}.json` exists → scope = "Ship-triage follow-up":
   `feature.json#files[]` for `{feature}` — check `.project/features/{feature}/feature.json` first,
   then `.project/features/archive/*-{feature}/feature.json` (ship-triage is inherently post-ship,
   so the archived path is the common case, not the exception); preload `triage.confirmed` from the
   ship-triage file as known findings (see Step 4). Log: `Scope: ship-triage follow-up voor {feature}
(auto, feature-arg gegeven)`.
2. No ship-triage file, but `.project/features/{feature}/feature.json#files[]` exists → scope =
   that file list. Log: `Scope: {feature}#files[] (auto, feature-arg gegeven)`.
3. Neither exists → fall back to the most recent completed audit's `scope.files[]` for this
   feature if one exists in `.project/security/audit-*.json`.
4. None of the above resolve anything → fall through to the modal below (the only remaining case
   where scope is genuinely ambiguous even with a feature name given).

**No feature-arg (bare `/dev-security`)** → always ask. AskUserQuestion:

- header: "Scan Scope"
- question: "Which parts of the codebase do you want to scan?"
- options:
  - "Full codebase (Recommended)" — Scan everything except node_modules/vendor/dist
  - "Backend/API only" — Focus on server-side code
  - "Changed features only" — Only pipeline files of DONE/shipped backlog features
  - "Specific directory" — Enter a path
- multiSelect: false

**"Changed features only":** read `.project/backlog.json` (+ `.project/archive/backlog-archive.json`), take features with status DONE or shipped, and collect their `files[]` from `.project/features/{name}/feature.json`. That union is the file list for step 3. No backlog or no feature.json files → fall back to "Full codebase" with a log line. Faster targeted audit between full scans; PHASE 2b tooling (lockfiles, git history) still runs repo-wide.

### Step 3: Build file list

Collect relevant source files (exclude dependencies, build output, static assets).
Group by type: routes/controllers, models/data, config, middleware, templates/views.

### Step 4: Load project context

Read `.project/project.json` (if it exists). Extract:

- `endpoints` — API surface (method, path, auth per route)
- `data.entities` — data model (entity names, fields, relations)

Read `.project/project-context.json` (if it exists). Extract:

- `context.patterns` — auth patterns, middleware setup

**Assemble OWASP_CONTEXT** (pass to scanner agents in PHASE 2b):

```
API SURFACE: {endpoints of "not available — scanners must discover endpoints themselves"}
DATA MODEL: {entities of "not available"}
AUTH PATTERNS: {auth-related patterns of "not available"}
```

If project.json does not exist → continue without it (backwards compatible).

**Ship-triage preload** (only on the "Ship-triage follow-up" scope choice): read
`.project/security/ship-triage-{feature}.json`, carry its `triage.confirmed[]` array forward as
`shipTriageRef` in the audit state — PHASE 3 folds these in as already-known findings (no
duplicate scanner re-discovery credit needed, but they still count toward the report) and PHASE 4's
findings file includes them.

### Step 5: Create the audit state

```bash
mkdir -p .project/security
main_root=$(git worktree list --porcelain | head -1 | awk '{print $2}')
```

Atomic-write (tmp+rename) `.project/security/audit-{YYYYMMDD-HHmm}.json`:

```json
{
  "schemaVersion": 1,
  "id": "{YYYYMMDD-HHmm}",
  "startedAt": "{ISO 8601, now}",
  "updatedAt": "{ISO 8601, now}",
  "status": "running",
  "phase": "PHASE 2",
  "mainRoot": "{main_root}",
  "scope": { "choice": "{scope}", "dir": null, "fileCount": 0 },
  "stack": "{detected stack summary}",
  "shipTriageRef": null,
  "tooling": {},
  "scanners": {},
  "aggregate": {},
  "plans": {},
  "chosenStrategy": null,
  "worktree": null
}
```

Every later phase boundary patches `updatedAt` + `phase` (and its own fields) into this same file —
resolve via `mainRoot` from here on, never a relative `.project/security/` path (PHASE 5 changes cwd
into a worktree where that path does not exist — see `references/fix-implement.md § Worktree`).

---

## PHASE 2: Tooling scan

> **Todo**: mark PHASE 1 → `completed`, PHASE 2 → `in_progress`.

LLM pattern scanners (PHASE 2b) miss CVE data, malicious-package signals, and leaked secrets in git history. Supplement with OSS tooling. Read `references/supply-chain.md` for the full procedure (OSV-Scanner V2 + Semgrep CE + gitleaks detection, invocation, severity mapping).

**Steps summarized:**

1. Detect lockfiles (`package-lock.json`, `yarn.lock`, etc.). No lockfile → skip OSV with log (gitleaks still runs — it scans the repo, not lockfiles).
2. Run `osv-scanner --format=json scan source ./` → `.project/security/osv-report.json`. Not installed + npm project → fallback `npm audit --json --omit=dev`.
3. Run `semgrep scan --config auto --json --quiet` → `.project/security/semgrep-report.json`. Semgrep not installed → skip with log (not a blocker).
4. Run `gitleaks detect --report-format json --report-path .project/security/gitleaks-report.json` (secrets in working tree + git history). Not installed → skip with log.
5. Tools not installed → log an installation hint, not a blocker. User can rerun after install.

Patch the audit state's `tooling` field with each tool's status (`ran` / `skipped: "not installed"` / `fallback: "npm audit"`) and report paths. The actual finding-merge into PHASE 2b's scan results (OSV/npm-audit → A03; Semgrep per rule `metadata.category`; gitleaks → A04) happens in PHASE 3 — this script/tool output can only be read from the main chat, not from inside a Workflow sandbox.

**Threshold:** CRITICAL OSV vuln with `fixed_version` → automatically into the Minimal fix strategy (PHASE 4). Otherwise follow the normal strategy choice.

---

## PHASE 2b: Parallel OWASP scan

> **Todo**: mark PHASE 2 → `completed`, PHASE 2b → `in_progress`.
> On a resume (`§ PHASE 1 Step 0`), OWASP_CONTEXT is not persisted in the audit state — re-derive
> it now via PHASE 1 Step 4 (`project.json`/`project-context.json`) before writing scanner
> prompts. On a fresh (non-resumed) run it is already in hand from Step 4.
> Read `.claude/skills/dev-security/references/orchestration.md § 2` and follow it: write the 10
> scanner prompt files, launch `security-scan.js`, patch the audit state. **End the turn** — no
> further tool calls until the task-notification arrives.

| Agent             | Category                    | Risk     | Focus                                                            |
| ----------------- | --------------------------- | -------- | ---------------------------------------------------------------- |
| owasp-a01-scanner | Broken Access Control       | CRITICAL | Missing authz on mutations/routes; IDOR via client-supplied IDs  |
| owasp-a02-scanner | Security Misconfiguration   | HIGH     | Insecure defaults, headers, env exposure, verbose errors         |
| owasp-a03-scanner | Supply Chain Failures       | HIGH     | Unpinned/vulnerable deps, untrusted script/CDN sources           |
| owasp-a04-scanner | Cryptographic Failures      | HIGH     | Weak/missing hashing, secret exposure, premature data reveal     |
| owasp-a05-scanner | Injection                   | CRITICAL | SQL/NoSQL/XSS/command/template injection, unvalidated input      |
| owasp-a06-scanner | Insecure Design             | MEDIUM   | Abuse cases, missing rate limits, race conditions                |
| owasp-a07-scanner | Authentication Failures     | HIGH     | Session/device binding, PIN/lockout robustness                   |
| owasp-a08-scanner | Data Integrity Failures     | MEDIUM   | Client-trusted state affecting scoring/results integrity         |
| owasp-a09-scanner | Logging & Alerting Failures | MEDIUM   | Missing audit trail on privileged/destructive actions            |
| owasp-a10-scanner | Exceptional Conditions      | MEDIUM   | Malformed input handling, unhandled rejections, DoS via bad data |

Each agent receives: tech stack summary, file list (grouped by type), OWASP_CONTEXT (from PHASE 1
Step 4), project root path. Each agent returns structured output (schema-validated by the workflow):
category score (/10), justification, positives, findings (file, line, severity, confidence, issue,
fix, CWE), verdict.

On the task-notification, the workflow has already computed `aggregate` (weighted score, findings
at confidence ≥60%, severity counts, anti-fantasy suspicion) — continue to PHASE 3.

---

## PHASE 3: Aggregation & Report

> **Todo**: mark PHASE 2b → `completed`, PHASE 3 → `in_progress`.

**Persist first** (`orchestration.md § 2`'s "On return" step already writes `scanners` + `aggregate`
into the audit state) — this happens **before** entering plan mode below, since plan mode blocks
`.project/` writes (`shared/PLAN-MODE.md § Entry`).

`EnterPlanMode` per `shared/PLAN-MODE.md § Entry` — the judgment work below (tool-finding merge,
anti-fantasy check, verdict) is exactly the "thought-heavy phase" the protocol targets.

Inside plan mode:

1. **Merge PHASE 2 tool findings** into the scanner aggregate (only the main chat can read the tool
   report files): OSV/npm-audit findings → A03; Semgrep findings → per rule `metadata.category`;
   gitleaks findings → A04 (CRITICAL when the credential looks active, otherwise HIGH). OSV severity
   mapping: CRITICAL/HIGH/MODERATE/LOW → severity 1-to-1.
2. **Fold in the ship-triage findings** (only when PHASE 1 preloaded `shipTriageRef`) — already-known
   `confirmed[]` items from the dev-ship handoff, deduped against anything the scanners rediscovered.
   If the relevant category's scanner re-verified the item as fixed (its own findings/verdict no
   longer show it) → report it as resolved, not as an open finding. Only count a `shipTriageRef`
   item toward the open-findings tally when its scanner did not independently confirm a fix.
3. **Anti-fantasy judgment**: `aggregate.antiFantasySuspect` flags 3+ scores of 9-10 — apply
   judgment on top of the mechanical flag: expect justification per high score, reconsider "would a
   pentester give these scores?"
4. **Verdict**: PASS (score ≥7.0, 0 CRITICAL findings) | NEEDS WORK (score <7.0 OR CRITICAL findings).
5. **Second-opinion escalation** (still in plan mode — the consult agent is read-only): if
   (a) two sources conflict on the same finding (scanner vs PHASE 2 tool vs `shipTriageRef`), or
   (b) ≥1 CRITICAL finding has confidence < 80%, or (c) `antiFantasySuspect` fired AND the
   verdict flips on judgment —

   > **Todo**: Read `.claude/skills/shared/SECOND-OPINION.md` and follow it — confirm modal,
   > then the consult with INPUT = the audit state file + the disputed findings' cited source
   > files, disputed findings inline as compact JSON (security row of § Brief contents). Apply
   > the digest's per-finding verdicts to the report below (advisory — flips are shown, not
   > silent), set `secondOpinionUsed`.

Present consolidated report:

```
SECURITY AUDIT
Project: [name]
Tech Stack: [detected]
Files Scanned: [count]

Overall Security Score: [X.X]/10

| Category                  | Score | Findings   |
| -------------------------- | ----- | ---------- |
| A01 Broken Access Control | X/10  | N findings |
| A02 Security Misconfig    | X/10  | N findings |
| ...                        |       |            |

Summary:
CRITICAL: [N] | HIGH: [N] | MEDIUM: [N] | LOW: [N]

TOP CRITICAL/HIGH FINDINGS:
1. [severity] [category] — [issue] — [file:line]
2. ...
(findings sharing one root cause/fix → group under a shared heading instead of listing flatly;
each finding still cites its own severity/category/file:line within the group)

Verdict: PASS (score ≥7.0, 0 CRITICAL findings) | NEEDS WORK (score <7.0 OR CRITICAL findings)
Second opinion: {consulted ({trigger}) — {n} finding verdict(s) revised | declined | not triggered | unavailable}
```

**Explicit feature-arg auto-proceed** — when PHASE 1 was invoked with an explicit `{feature}`
arg, skip the modal: proceed straight to "Yes, generate fix plans" (log: `Next step: fix-plannen
genereren (auto, feature-arg gegeven)`). `ExitPlanMode` first (a Workflow cannot launch from
inside plan mode — this closes the aggregation session with the report as its output), then Read
`.claude/skills/dev-security/references/fix-implement.md` and continue there (PHASE 4).

**No feature-arg (full-codebase run)** → AskUserQuestion:

- header: "Next step"
- question: "Do you want to generate fix plans for the found issues?"
- options:
  - "Yes, generate fix plans (Recommended)" — 3 parallel fix strategies
  - "No, report only" — Stop here with the audit report
- multiSelect: false

**"No"** → `ExitPlanMode` with the report as the plan output. Patch audit state `status:
"complete"`, `phase: "PHASE 3"`. Show the report.

> **Todo**: mark PHASE 3 → `completed`. Leave PHASE 4/5 `pending` — "No, report only" ends the run
> here by design, not on a failure, so there is nothing to mark done or in-progress for them. Apply
> the Next-Step Clipboard Offer (binary Ja/Nee) — read `.claude/skills/shared/NEXT-STEP-OFFER.md`.
> Recommended command: `/dev-ship {feature}` → apply security hardening as a refactor step.

**"Yes"** → `ExitPlanMode` first (a Workflow cannot launch from inside plan mode — this closes the
aggregation session with the report as its output), then Read
`.claude/skills/dev-security/references/fix-implement.md` and continue there (PHASE 4).

---

## PHASE 4 & PHASE 5

> **Todo**: Read `.claude/skills/dev-security/references/fix-implement.md` and follow it — it owns
> the fix-plan fan-out, the strategy-selection plan-mode gate, the worktree'd implementation, and
> the finalize offer.

## Best Practices

### Language

Follow the Language Policy in CLAUDE.md.
