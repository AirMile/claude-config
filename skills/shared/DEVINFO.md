# Session Tracking

Lightweight session state for cross-skill coordination. Pipeline skills use the files below. Frontend pipeline skills also use `.project/session/devinfo.json` for handoff data between skills (e.g. `frontend-design` → `frontend-convert`).

---

## Skill Handoff Contract (frontmatter)

Pipeline skills that touch shared state declare this explicitly via `reads:` and `writes:` in the YAML frontmatter. Purpose: make per-skill which shared fields are read/written visible, so dependencies between pipeline phases are verifiable without reading the SKILL.md text.

### Namespaces

| Prefix           | File                                                 | Usage                                                                                |
| ---------------- | ---------------------------------------------------- | ------------------------------------------------------------------------------------ |
| `feature.*`      | `.project/features/{name}/feature.json` (top-level)  | dev-pipeline, game-pipeline                                                          |
| `backlog.status` | `.project/backlog.html` (feature status transitions) | dev-pipeline, game-pipeline                                                          |
| `concept.*`      | `.project/project-seed.md` + `project.json#concept`  | project-seed (owner), dev-define / game-define / project-backlog (conditional write) |
| `devinfo.*`      | `.project/session/devinfo.json` (top-level key)      | frontend-pipeline                                                                    |

### Granularity

Top-level sections only — no sub-paths like `feature.build.decisions`. Schema evolution of sub-fields must not affect the frontmatter.

### Example

```yaml
---
name: dev-build
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
- `.project/session/pre-skill-sha.txt` / `pre-skill-status.txt` — git baseline for scoped commits, local to one skill run.
- `devinfo.currentSkill` (`{name, phase, startedAt}`) — runtime progress within one frontend skill (PREFLIGHT → COMPLETE), not read by subsequent skills for decision-making.

---

## Active Feature Signal

When a dev/game skill processes a feature, write a signal file so the backlog dashboard can highlight the active feature.

**Storage:** `.project/session/active-{feature-name}.json` (one file per active feature)

### Schema

```json
{
  "feature": "auth-login",
  "skill": "build",
  "startedAt": "2024-01-15T10:30:00Z"
}
```

**Valid `skill` values:** `define`, `plan`, `build`, `test`, `debug`, `refactor`

### Protocol

**On skill start** (after feature name is known):

```bash
mkdir -p .project/session
echo '{"feature":"FEATURE_NAME","skill":"SKILL_VERB","startedAt":"TIMESTAMP"}' > .project/session/active-FEATURE_NAME.json
```

**On skill end** (completion or error exit):

```bash
rm -f .project/session/active-FEATURE_NAME.json
```

Multiple features can be active simultaneously (e.g. parallel Claude sessions). Entries older than 2 hours are automatically ignored (staleness protection).

The backlog dashboard detects changes in the session directory via SSE and automatically shows a visual indicator (pulsing border + skill label) on each active feature card.

---

## Git Baseline

**Storage:** `.project/session/pre-skill-sha.txt` or `pre-skill-status.txt`

**Purpose:** scoped commits — only stage files from this skill.

**On skill start:**

```bash
git rev-parse HEAD > .project/session/pre-skill-sha.txt
```

**On skill end (commit):**

```bash
git diff --name-only $(cat .project/session/pre-skill-sha.txt) HEAD
```

Files NOT in this diff AND already dirty → pre-existing, do not stage.

**Cleanup:**

```bash
rm -f .project/session/pre-skill-sha.txt .project/session/active-FEATURE_NAME.json
```

---

## Frontend Pipeline Schemas

### `devinfo.handoff` — Build Incomplete

Written by `frontend-design` (Build route) when user chooses "Open in convert" after smoke-failure. Read by `frontend-convert` PHASE 0.0.

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
    "buildScreenshot": ".project/smoke-render-dashboard.png",
    "timestamp": "2026-05-07T14:23:00Z"
  }
}
```

`source` values: `"build-incomplete"` (from Build-route failure). Other `source` values come from `frontend-convert` itself (see PHASE 4.1).

**Cleanup:** `frontend-convert` PHASE 4.1 after success → set `devinfo.handoff = null`. If handoff is older than 24h: `frontend-convert` PHASE 0.0 shows staleness warning.

---

### `devinfo.tokenDrift` — Token Drift Log

Written by `frontend-tokens` (Update/Extract route) when existing token keys get a different value while DOING/DONE PAGE features exist. Read and cleaned up by `frontend-design` (Step 5), `frontend-convert` (PHASE 4.1), and `dev-verify`/`dev-refactor` (if feature is in `affectedFeatures`).

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
