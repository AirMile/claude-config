---
name: dev-owasp
description: Complete OWASP Top 10:2025 security audit with parallel agents. Use with /dev-owasp to scan for security vulnerabilities in web applications.
metadata:
  author: mileszeilstra
  version: 2.0.0
  category: dev
---

# OWASP Security Audit

Full OWASP Top 10:2025 scan: scope → 10 parallel scanners → aggregated report → 3 fix strategies → implement.

## Process

**Fase tracking** — eerste actie van de skill: roep `TaskCreate` aan met deze 5 items (status `pending`), daarna gebruik `TaskUpdate` om per fase `in_progress` te zetten aan begin en `completed` aan einde. Bij context compaction blijft de task list zichtbaar — geen risico op vergeten fases.

1. PHASE 1: Scope
2. PHASE 2: Parallel Scan
3. PHASE 3: Aggregation & Report
4. PHASE 4: Fix Plans
5. PHASE 5: Selection & Implementation

## PHASE 1: Scope

> **Todo**: roep `TaskCreate` aan met de 5 fase-items (zie boven). Markeer PHASE 1 → `in_progress` via `TaskUpdate`.

### Step 1: Detect tech stack

Scan project for languages, frameworks, and entry points:

- Glob for `package.json`, `requirements.txt`, `composer.json`, `go.mod`, `Cargo.toml`, `Gemfile`
- Identify framework (Express, Django, Laravel, Rails, Next.js, etc.)
- Map source directories (controllers, routes, API handlers, middleware)

### Step 2: Confirm scope

AskUserQuestion:

- header: "Scan Scope"
- question: "Welke delen van de codebase wil je scannen?"
- options:
  - "Volledige codebase (Aanbevolen)" — Scan alles behalve node_modules/vendor/dist
  - "Alleen backend/API" — Focus op server-side code
  - "Specifieke map" — Geef een pad op
- multiSelect: false

### Step 3: Build file list

Collect relevant source files (exclude dependencies, build output, static assets).
Group by type: routes/controllers, models/data, config, middleware, templates/views.

### Step 4: Load project context

Lees `.project/project.json` (als bestaat). Extract:

- `endpoints` — API surface (method, path, auth per route)
- `data.entities` — data model (entity names, fields, relations)

Lees `.project/project-context.json` (als bestaat). Extract:

- `context.patterns` — auth patterns, middleware setup

**Stel OWASP_CONTEXT samen** (meegeven aan scanner agents in PHASE 2):

```
API SURFACE: {endpoints of "niet beschikbaar — scanners moeten zelf endpoints ontdekken"}
DATA MODEL: {entities of "niet beschikbaar"}
AUTH PATTERNS: {auth-gerelateerde patterns of "niet beschikbaar"}
```

Als project.json niet bestaat → ga door zonder (backwards compatible).

---

## PHASE 2: Parallel Scan

> **Todo**: markeer PHASE 1 → `completed`, PHASE 2 → `in_progress`.

Launch 10 scanner agents in parallel via Task tool (zie `shared/SKILL-PATTERNS.md#parallel-dispatch` voor dispatch-criteria en integratie-stappen):

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
- OWASP_CONTEXT (uit stap 4 — endpoints, data model, auth patterns)
- Project root path

Each agent returns structured output with: category score (/10), positives, findings (file, line, severity, confidence, issue, fix, CWE), verdict.

Run all 10 in background. Collect results when all complete.

---

## PHASE 3: Aggregation & Report

> **Todo**: markeer PHASE 2 → `completed`, PHASE 3 → `in_progress`.

Analyze:

1. Collect all 10 category scores
2. Calculate overall security score (weighted average — CRITICAL categories x1.5 weight)
3. **Anti-fantasy check:** Als 3+ scanners score 9-10 geven → flag als verdacht. Verwacht onderbouwing per hoge score. Heroverweeg: "Zou een pentester deze scores geven?"
4. Filter findings: discard confidence < 60%
5. Group findings by severity: CRITICAL → HIGH → MEDIUM → LOW
6. Count totals per severity

Present consolidated report:

```
OWASP SECURITY AUDIT
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

Verdict: PASS (score ≥7.0, 0 CRITICAL findings) | NEEDS WORK (score <7.0 OF CRITICAL findings)
```

AskUserQuestion:

- header: "Next step"
- question: "Do you want to generate fix plans for the found issues?"
- options:
  - "Yes, generate fix plans (Recommended)" — 3 parallel fix strategies
  - "No, report only" — Stop here with the audit report
- multiSelect: false

If "Nee" → stop. Show report.

---

## PHASE 4: Fix Plans

> **Todo**: markeer PHASE 3 → `completed`, PHASE 4 → `in_progress`.

Launch 3 fix agents in parallel via Task tool:

| Agent               | Philosophy             | Scope                               |
| ------------------- | ---------------------- | ----------------------------------- |
| owasp-fix-minimal   | "Hotfix critical only" | CRITICAL findings, smallest changes |
| owasp-fix-pragmatic | "Pragmatic balance"    | CRITICAL + HIGH, grouped by file    |
| owasp-fix-extensive | "Full remediation"     | All findings + preventive measures  |

Each receives: aggregated scan results with all findings, severity counts, file references.

---

## PHASE 5: Selection & Implementation

> **Todo**: markeer PHASE 4 → `completed`, PHASE 5 → `in_progress`.

### Step 1: Present options

Show all 3 plans side by side:

```


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

- header: "Fix Strategie"
- question: "Welke fix strategie wil je toepassen?"
- options:
  - "Pragmatic (Aanbevolen)" — CRITICAL + HIGH, goede balans
  - "Minimal" — Alleen CRITICAL, laagste risico
  - "Extensive" — Alles, inclusief preventieve maatregelen
- multiSelect: false

### Step 3: Implement

Apply selected fix plan. Per fix: show file:line, apply change, verify syntax.

### Step 4: Summary

```

OWASP AUDIT COMPLETE
Score: [before] → estimated [after]
Strategy: [chosen]
Fixes applied: [N]
Files modified: [N]
Remaining items: [N] (deferred)

```

> **Todo**: markeer PHASE 5 → `completed`.

## Best Practices

### Language

Follow the Language Policy in CLAUDE.md.
```
