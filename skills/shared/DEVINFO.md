# Session Tracking

Lightweight session state for cross-skill coordination. Pipeline skills use the files below. Design pipeline skills also use `.project/session/devinfo.json` for handoff data (e.g. the `design-convert` Build route → Convert route self-handoff).

---

## Skill Handoff Contract (frontmatter)

Pipeline skills that touch shared state declare this explicitly via `reads:` and `writes:` in the YAML frontmatter. Purpose: make per-skill which shared fields are read/written visible, so dependencies between pipeline phases are verifiable without reading the SKILL.md text.

A third key, `writes-terminal:`, declares **intentional terminal writes**: fields written for the dashboard, history, or user-facing reporting that no downstream skill consumes (e.g. `feature.refactor`, `backlog.overview`). `scripts/check-handoff.py` counts them as writes for the read-match but suppresses the "written but never read" INFO line. A field belongs in `writes:` OR `writes-terminal:`, never both.

### Namespaces

| Prefix                | File                                                                                                                   | Usage                                                                                                                                                                                               |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `feature.*`           | `.project/features/{name}/feature.json` (top-level)                                                                    | dev-pipeline, game-pipeline (incl. `feature.seedDrift`, `feature.externalRef`)                                                                                                                      |
| `backlog.status`      | `.project/backlog.json` (feature status transitions)                                                                   | dev-pipeline, game-pipeline                                                                                                                                                                         |
| `backlog.seedDrift`   | `.project/backlog.json` (`data.seedDrift[]` deferred drift entries)                                                    | project-plan / project-todo (write), project-seed / project-brainstorm / project-critique (read + reconcile)                                                                                        |
| `backlog.externalRef` | `.project/backlog.json` (per-feature `externalRef` issue link)                                                         | team-issues, team-outsource                                                                                                                                                                         |
| `concept.*`           | `.project/project-seed.md` + `project.json#concept`                                                                    | project-seed (owner), dev-ship (define phase) / game-ship (define phase) / project-plan (conditional write), project-todo (approved surgical edit)                                                  |
| `devinfo.*`           | `.project/session/devinfo.json` (top-level key)                                                                        | design-pipeline                                                                                                                                                                                     |
| `project.*`           | `.project/project.json` (top-level key, e.g. `stack`, `features`, `endpoints`, `entities`, `team`, `optimizationRuns`) | dashboard-sync skills (core-pull, team-verify, project-todo, project-add, dev-optimize)                                                                                                             |
| `project.thinking`    | `.project/thinking/*.md` + `.project/features/{name}/thinking.md`                                                      | thinking skills (project-seed, project-brainstorm, project-critique, project-todo, project-research)                                                                                                |
| `project-context.*`   | `.project/project-context.json` (top-level section: `learnings`, `context`, `architecture`)                            | core-pull, dev/game build + debug + refactor, team-verify, dev-security (read)                                                                                                                      |
| `conventions`         | `.project/conventions.md` (whole file — see [CONVENTIONS.md](CONVENTIONS.md))                                          | core-setup (writer, allowlisted), dev-ship (refactor phase) (fallback write + read), dev-ship (build phase) / dev-ship (verify phase) / game-ship (refactor phase) / game-ship (build phase) (read) |
| `security.shipTriage` | `.project/security/ship-triage-{feature}.json` (per-feature)                                                           | dev-ship (PHASE 4, write — persists AGENT S's triage past the checkpoint's deletion), dev-security (read — PHASE 1 preload)                                                                         |
| `security.audit`      | `.project/security/audit-{id}.json` + `audit-{id}-findings.json` (per audit run)                                       | dev-security (owner — resume state, scanner/aggregate/plan results)                                                                                                                                 |
| `security.reports`    | `.project/security/{osv,semgrep,gitleaks}-report.json` (per audit run, `writes-terminal`)                              | dev-security (owner — tool output, merged into the PHASE 3 report, no downstream reader)                                                                                                            |

### Granularity

Top-level sections only — no sub-paths like `feature.build.decisions`. Schema evolution of sub-fields must not affect the frontmatter.

### Example

```yaml
---
name: dev-ship
description: ...
disable-model-invocation: true
reads: [feature.requirements, backlog.status]
writes: [feature.requirements, feature.build, backlog.status]
metadata:
  author: claude-config
  version: 1.6.1
  category: dev
---
```

### When to apply

- Skill reads or writes `feature.json` / `devinfo.json` / `backlog.status` → declare.
- Skill works only with its own artifacts (e.g. `optimize/{run-id}/`) → omit.
- Leave out empty lists instead of writing `reads: []`.

### Implicit signals (do not declare)

Some files are touched by every pipeline skill as runtime lifecycle, not as handoff. These are **not** in `reads:`/`writes:`:

- `.project/session/active-{name}.json` — runtime signal for the backlog dashboard, written on skill start and cleaned up on end. No subsequent skill reads this for decisions.
- `.project/session/ship-{name}.json` — auto-mode ship checkpoint (`dev-ship`/`game-ship`/`design-ship`). Written **only by the ship orchestrator (main chat)** at each phase boundary; records the phase pointer, the PHASE 0 selections, and the structured agent results so an interrupted run (credits/crash/kill) can resume. Unlike `active-{name}.json` it is **kept on failure/interruption** and removed only on `status: "complete"`. It is **also a board signal**: because it survives a full session end, the board watches `ship-*.json` mtimes and renders a checkpoint with no live signal as a **parked** row (amber ⏸ `{label} · parked`, copy-button carrying the resume command) — see `BACKLOG.md § Board rendering`. Full schema + resume/preflight/cleanup routine: [SHIP-CHECKPOINT.md](SHIP-CHECKPOINT.md).
- `.project/session/pre-skill-sha.txt` / `pre-skill-status.txt` — git baseline for scoped commits, local to one skill run.
- `devinfo.currentSkill` (`{name, phase, startedAt}`) — runtime progress within one design skill (PREFLIGHT → COMPLETE), not read by subsequent skills for decision-making.

---

## Active Feature Signal

When a dev/game skill processes a feature, write a signal file so the backlog dashboard can highlight the active feature.

**Storage:** `.project/session/active-{feature-name}.json` (one file per active feature)

### Schema

```json
{
  "feature": "auth-login",
  "skill": "build",
  "startedAt": "2024-01-15T10:30:00Z",
  "waiting": "manual-tests"
}
```

`waiting` is **optional**: absent/null = the skill is actively running; a short reason string
(`"manual-tests"`, `"fix-plan"`, `"playtest"`, `"review"`) = the skill is **paused for user input**
(`"fix-plan"` = dev-ship / game-ship PHASE 3's round-level fix-plan gate, each pipeline's own
`references/fix-round.md`). The board
renders waiting rows amber with a static ⏸ badge ("{label} · input needed") and sorts them to the
top of the IN PROGRESS section — the user sees at a glance that the pipeline is blocked on them.
Write it by rewriting the signal file with the `waiting` field when an interactive gate follows
autonomous work (dev-ship (verify phase) manual walkthrough, game-ship playtest, design-ship PHASE 4 review);
rewrite without the field the moment input is received and work resumes.

**Valid `skill` values:** `define`, `plan`, `build`, `verify`, `test`, `debug`, `refactor`,
`design`, `content`, `check`, `ship` (the last four: design-ship phases — PHASE 0, AGENT 2,
AGENT 3, PHASE 4 review/merge)

### Protocol

**On skill start** (after feature name is known), via `node ~/.claude/scripts/ship-checkpoint.js` —
never a raw `echo >` (see below for why):

```bash
echo '{"skill":"SKILL_VERB"}' | node ~/.claude/scripts/ship-checkpoint.js signal FEATURE_NAME
```

The script stamps `feature` (from the argument) and `startedAt` itself; pass `"waiting":"..."` in
the JSON when the skill is paused for user input (see below).

**On skill end** (completion or error exit):

```bash
node ~/.claude/scripts/ship-checkpoint.js signal-clear FEATURE_NAME
```

**Worktree-safe by construction.** The signal always lives in the **main checkout's**
`.project/session/` — that is what the board watches. A skill whose cwd is **inside a worktree** (the
ship pipelines during their in-worktree PHASE 3/4) cannot use a relative `echo >`/`rm -f` — `.project/session/`
is worktree-local (not symlinked), so a relative write would land in the worktree and the board would
never see it. `ship-checkpoint.js signal`/`signal-clear` resolve the main checkout root themselves
(same mechanism as the ship checkpoint file), so calling them is safe from **any** cwd.

Multiple features can be active simultaneously (e.g. parallel Claude sessions). Entries older than 2 hours are automatically ignored (staleness protection).

The backlog dashboard detects changes in the session directory via SSE (`/{project}/session` API) and renders each active feature as a **live** row: pulsing dot + skill label ("building", "verifying", …), grouped in the IN PROGRESS section at the top of the board. This is distinct from the **queued** state (`transition` field in `backlog.json`, set by a board copy action) — queued means "command copied, waiting for pickup"; live means "a skill is running right now". `dev-ship` rewrites this file at every phase boundary (`define` → `build` → `verify` → `refactor`) and `design-ship` does the same (`design` → `build` → `content` → `check` → `ship`, the agents rewrite it themselves per the non-interactive contract), so the badge follows the pipeline; see `BACKLOG.md § Lifecycle Protocol` for the accompanying `transition: "shipping"` run marker.

---

## Git Baseline

**Storage:** `.project/session/pre-skill-sha.txt` or `pre-skill-status.txt`

**Purpose:** scoped commits — only stage files from this skill. Full protocol (baseline forms, NEW/OVERLAP/PRE-EXISTING categorization, fallbacks, cleanup): [SCOPED-COMMIT.md](SCOPED-COMMIT.md).

---

## Design Pipeline Schemas

### `devinfo.handoff` — Build Incomplete

Written by `design-convert` (Build route) when user chooses "Open in convert" after smoke-failure. Read by `design-convert` router PHASE 0.2 (self-handoff to Convert route).

```json
{
  "handoff": {
    "source": "build-incomplete",
    "target": "dashboard",
    "files": [
      "app/dashboard/page.tsx",
      "app/dashboard/_components/StatCard.tsx"
    ],
    "failedChecks": ["section-collapse", "axe-critical"],
    "reason": "smoke-fail",
    "buildScreenshot": ".project/tmp/smoke-render-dashboard.png",
    "timestamp": "2026-05-07T14:23:00Z"
  }
}
```

`source` values: `"build-incomplete"` (from Build-route failure). Other `source` values come from `design-convert` Convert route (see PHASE 4.1).

**Cleanup:** `design-convert` Convert route PHASE 4.1 after success → set `devinfo.handoff = null`. If handoff is older than 24h: router PHASE 0.2 shows a staleness notice AND auto-cleans (`devinfo.handoff = null`, mentioned in output) before route classification — the patch flow is not offered for stale handoffs.

---

### `devinfo.tokenDrift` — Token Drift Log

Written by `design-tokens` (Update/Extract route) when existing token keys get a different value while DOING/DONE PAGE features exist. Read and cleaned up by `design-convert` (Build route Step 10 and Convert route PHASE 4.1), and dev-ship's verify and refactor phases (if feature is in `affectedFeatures`).

```json
{
  "tokenDrift": {
    "changedAt": "2026-05-07T15:00:00Z",
    "changes": [
      { "path": "colors.primary", "from": "#2563eb", "to": "#dc2626" }
    ],
    "affectedFeatures": ["dashboard", "settings", "billing"],
    "resolved": false
  }
}
```

**Cleanup:** after each successful Build or convert-run on a feature in `affectedFeatures`, that feature is removed from the list. When list is empty → `resolved: true`.
