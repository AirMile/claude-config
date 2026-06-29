---
name: dev-security
description: Run a deep security audit (OWASP Top 10, supply chain, secrets). Use with /dev-security.
reads: [project.endpoints, project.entities, project-context.context]
metadata:
  author: claude-config
  version: 2.1.0
  category: dev
---

# Security Audit

Deep security audit — OWASP Top 10:2025 + supply-chain/SAST/secret tooling: scope → 10 parallel scanners → aggregated report → 3 fix strategies → implement.

## Process

**Phase tracking** — first action of the skill: call `TaskCreate` with these 6 items (status `pending`), then use `TaskUpdate` to set each phase `in_progress` at start and `completed` at end. On context compaction the task list remains visible — no risk of forgotten phases.

1. PHASE 1: Scope
2. PHASE 2: Parallel Scan
3. PHASE 2b: Supply-chain & SAST tooling
4. PHASE 3: Aggregation & Report
5. PHASE 4: Fix Plans
6. PHASE 5: Selection & Implementation

## PHASE 1: Scope

> **Todo**: call `TaskCreate` with the 6 phase items (see above). Mark PHASE 1 → `in_progress` via `TaskUpdate`.

### Step 1: Detect tech stack

Scan project for languages, frameworks, and entry points:

- Glob for `package.json`, `requirements.txt`, `composer.json`, `go.mod`, `Cargo.toml`, `Gemfile`
- Identify framework (Express, Django, Laravel, Rails, Next.js, etc.)
- Map source directories (controllers, routes, API handlers, middleware)

### Step 2: Confirm scope

AskUserQuestion:

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

**Assemble OWASP_CONTEXT** (pass to scanner agents in PHASE 2):

```
API SURFACE: {endpoints of "not available — scanners must discover endpoints themselves"}
DATA MODEL: {entities of "not available"}
AUTH PATTERNS: {auth-related patterns of "not available"}
```

If project.json does not exist → continue without it (backwards compatible).

---

## PHASE 2: Parallel Scan

> **Todo**: mark PHASE 1 → `completed`, PHASE 2 → `in_progress`.

Launch 10 scanner agents in parallel via Task tool (see `shared/SKILL-PATTERNS.md#parallel-dispatch` for dispatch criteria and integration steps):

| Agent             | Category                    | Risk     |
| ----------------- | --------------------------- | -------- |
| owasp-a01-scanner | Broken Access Control       | CRITICAL |
| owasp-a02-scanner | Security Misconfiguration   | HIGH     |
| owasp-a03-scanner | Supply Chain Failures       | HIGH     |
| owasp-a04-scanner | Cryptographic Failures      | HIGH     |
| owasp-a05-scanner | Injection                   | CRITICAL |
| owasp-a06-scanner | Insecure Design             | MEDIUM   |
| owasp-a07-scanner | Authentication Failures     | HIGH     |
| owasp-a08-scanner | Data Integrity Failures     | MEDIUM   |
| owasp-a09-scanner | Logging & Alerting Failures | MEDIUM   |
| owasp-a10-scanner | Exceptional Conditions      | MEDIUM   |

Each agent receives:

- Tech stack summary
- File list (grouped by type)
- OWASP_CONTEXT (from step 4 — endpoints, data model, auth patterns)
- Project root path

Each agent returns structured output with: category score (/10), positives, findings (file, line, severity, confidence, issue, fix, CWE), verdict.

Run all 10 in background. Collect results when all complete.

---

## PHASE 2b: Supply-chain & SAST tooling

> **Todo**: mark PHASE 2 → `completed`, PHASE 2b → `in_progress`.

LLM pattern scanners (PHASE 2) miss CVE data, malicious-package signals, and leaked secrets in git history. Supplement with OSS tooling. Read `references/supply-chain.md` for the full procedure (OSV-Scanner V2 + Semgrep CE + gitleaks detection, invocation, severity mapping).

**Steps summarized:**

1. Detect lockfiles (`package-lock.json`, `yarn.lock`, etc.). No lockfile → skip OSV with log (gitleaks still runs — it scans the repo, not lockfiles).
2. Run `osv-scanner --format=json scan source ./` → `.project/security/osv-report.json`. Not installed + npm project → fallback `npm audit --json --omit=dev`.
3. Run `semgrep scan --config auto --json --quiet` → `.project/security/semgrep-report.json`. Semgrep not installed → skip with log (not a blocker).
4. Run `gitleaks detect --report-format json --report-path .project/security/gitleaks-report.json` (secrets in working tree + git history). Not installed → skip with log.
5. Merge findings into the PHASE 3 aggregation: OSV/npm-audit → A03; Semgrep per rule `metadata.category`; gitleaks → A04 (CRITICAL when the credential looks active, otherwise HIGH). OSV severity mapping: CRITICAL/HIGH/MODERATE/LOW → severity 1-to-1.
6. Tools not installed → log an installation hint, not a blocker. User can rerun after install.

**Threshold:** CRITICAL OSV vuln with `fixed_version` → automatically into the Minimal fix strategy (PHASE 4). Otherwise follow the normal strategy choice.

---

## PHASE 3: Aggregation & Report

> **Todo**: mark PHASE 2b → `completed`, PHASE 3 → `in_progress`.

Analyze:

1. Collect all 10 category scores
2. Calculate overall security score (weighted average — CRITICAL categories x1.5 weight)
3. **Anti-fantasy check:** If 3+ scanners give a score of 9-10 → flag as suspicious. Expect justification per high score. Reconsider: "Would a pentester give these scores?"
4. Filter findings: discard confidence < 60%
5. Group findings by severity: CRITICAL → HIGH → MEDIUM → LOW
6. Count totals per severity

Present consolidated report:

```
SECURITY AUDIT
Project: [name]
Tech Stack: [detected]
Files Scanned: [count]

Overall Security Score: [X.X]/10

| Category                  | Score | Findings   |
| ------------------------- | ----- | ---------- |
| A01 Broken Access Control | X/10  | N findings |
| A02 Security Misconfig    | X/10  | N findings |
| ...                       |       |            |

Summary:
CRITICAL: [N] | HIGH: [N] | MEDIUM: [N] | LOW: [N]

TOP CRITICAL/HIGH FINDINGS:
1. [severity] [category] — [issue] — [file:line]
2. ...

Verdict: PASS (score ≥7.0, 0 CRITICAL findings) | NEEDS WORK (score <7.0 OR CRITICAL findings)
```

AskUserQuestion:

- header: "Next step"
- question: "Do you want to generate fix plans for the found issues?"
- options:
  - "Yes, generate fix plans (Recommended)" — 3 parallel fix strategies
  - "No, report only" — Stop here with the audit report
- multiSelect: false

If "No" → stop. Show report.

> **Todo**: Apply the Next-Step Clipboard Offer (binary Ja/Nee) —
> read '.claude/skills/shared/NEXT-STEP-OFFER.md'.
> Recommended command: /dev-refactor {feature} → apply security hardening as a refactor step.

---

## PHASE 4: Fix Plans

> **Todo**: mark PHASE 3 → `completed`, PHASE 4 → `in_progress`.

Launch 3 fix agents in parallel via Task tool:

| Agent               | Philosophy             | Scope                               |
| ------------------- | ---------------------- | ----------------------------------- |
| owasp-fix-minimal   | "Hotfix critical only" | CRITICAL findings, smallest changes |
| owasp-fix-pragmatic | "Pragmatic balance"    | CRITICAL + HIGH, grouped by file    |
| owasp-fix-extensive | "Full remediation"     | All findings + preventive measures  |

Each receives: aggregated scan results with all findings, severity counts, file references.

---

## PHASE 5: Selection & Implementation

> **Todo**: mark PHASE 4 → `completed`, PHASE 5 → `in_progress`.

### Step 1: Present options

Show all 3 plans side by side:

```
FIX STRATEGIES
| | Minimal | Pragmatic | Extensive |
| -------- | ------------- | ----------- | ----------- |
| Fixes | [N] | [N] | [N] |
| Files | [N] | [N] | [N] |
| Effort | [est] | [est] | [est] |
| Risk | Low | Medium | Medium-High |
| Coverage | CRITICAL only | CRIT + HIGH | All |

```

### Step 2: Select strategy

AskUserQuestion:

- header: "Fix Strategy"
- question: "Which fix strategy do you want to apply?"
- options:
  - "Pragmatic (Recommended)" — CRITICAL + HIGH, good balance
  - "Minimal" — CRITICAL only, lowest risk
  - "Extensive" — Everything, including preventive measures
- multiSelect: false

### Step 3: Implement

Apply selected fix plan. Per fix: show file:line, apply change, verify syntax.

### Step 4: Summary

```

SECURITY AUDIT COMPLETE
Score: [before] → estimated [after]
Strategy: [chosen]
Fixes applied: [N]
Files modified: [N]
Remaining items: [N] (deferred)

```

> **Todo**: mark PHASE 5 → `completed`.

> **Todo**: Apply the Next-Step Clipboard Offer (binary Ja/Nee) —
> read '.claude/skills/shared/NEXT-STEP-OFFER.md'.
> Recommended command: /dev-refactor {feature} → apply security hardening as a refactor step.

## Best Practices

### Language

Follow the Language Policy in CLAUDE.md.

```

```
