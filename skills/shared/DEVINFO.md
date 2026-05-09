# Session Tracking

Lichtgewicht session state voor cross-skill coördinatie. Pipeline skills gebruiken de onderstaande bestanden. Frontend pipeline skills gebruiken daarnaast `.project/session/devinfo.json` voor handoff data tussen skills (bijv. `frontend-design` → `frontend-convert`).

---

## Skill Handoff Contract (frontmatter)

Pipeline-skills die gedeelde state aanraken declareren dit expliciet via `reads:` en `writes:` in de YAML frontmatter. Doel: per-skill zichtbaar maken welke gedeelde velden worden gelezen/geschreven, zodat afhankelijkheden tussen pipeline-fases controleerbaar zijn zonder de SKILL.md tekst te lezen.

### Namespaces

| Prefix           | Bestand                                              | Gebruik                     |
| ---------------- | ---------------------------------------------------- | --------------------------- |
| `feature.*`      | `.project/features/{name}/feature.json` (top-level)  | dev-pipeline, game-pipeline |
| `backlog.status` | `.project/backlog.html` (feature status transitions) | dev-pipeline, game-pipeline |
| `devinfo.*`      | `.project/session/devinfo.json` (top-level key)      | frontend-pipeline           |

### Granulariteit

Alleen top-level secties — geen sub-paths zoals `feature.build.decisions`. Schema-evolutie van sub-velden mag de frontmatter niet raken.

### Voorbeeld

```yaml
---
name: dev-build
description: ...
disable-model-invocation: true
reads: [feature.requirements, backlog.status]
writes: [feature.requirements, feature.build, backlog.status]
metadata:
  author: mileszeilstra
  version: 1.6.1
  category: dev
---
```

### Wanneer toepassen

- Skill leest of schrijft `feature.json` / `devinfo.json` / `backlog.status` → declareer.
- Skill werkt alleen met eigen artifacts (bijv. `optimize/{run-id}/`) → laat weg.
- Lege lijsten weglaten i.p.v. `reads: []` schrijven.

### Impliciete signalen (niet declareren)

Sommige bestanden worden door élke pipeline-skill aangeraakt als runtime-lifecycle, niet als handoff. Die staan **niet** in `reads:`/`writes:`:

- `.project/session/active-{name}.json` — runtime-signaal voor het backlog-dashboard, geschreven bij skill start en opgeruimd bij einde. Geen volgende skill leest dit voor beslissingen.
- `.project/session/pre-skill-sha.txt` / `pre-skill-status.txt` — git-baseline voor scoped commits, lokaal aan één skill-run.
- `devinfo.currentSkill` (`{name, phase, startedAt}`) — runtime-progressie binnen één frontend-skill (PREFLIGHT → COMPLETE), niet gelezen door volgende skills voor besluitvorming.

---

## Active Feature Signal

Wanneer een dev/game skill een feature verwerkt, schrijf een signaalbestand zodat het backlog dashboard de actieve feature kan highlighten.

**Storage:** `.project/session/active-{feature-name}.json` (één bestand per actieve feature)

### Schema

```json
{
  "feature": "auth-login",
  "skill": "build",
  "startedAt": "2024-01-15T10:30:00Z"
}
```

**Geldige `skill` waarden:** `define`, `plan`, `build`, `test`, `debug`, `refactor`

### Protocol

**Bij skill start** (nadat feature naam bekend is):

```bash
mkdir -p .project/session
echo '{"feature":"FEATURE_NAME","skill":"SKILL_VERB","startedAt":"TIMESTAMP"}' > .project/session/active-FEATURE_NAME.json
```

**Bij skill einde** (completion of error exit):

```bash
rm -f .project/session/active-FEATURE_NAME.json
```

Meerdere features kunnen tegelijk actief zijn (bijv. parallelle Claude sessies). Entries ouder dan 2 uur worden automatisch genegeerd (staleness protection).

Het backlog dashboard detecteert wijzigingen in de session directory via SSE en toont automatisch een visuele indicator (pulserende rand + skill label) op elke actieve feature card.

---

## Git Baseline

**Storage:** `.project/session/pre-skill-sha.txt` of `pre-skill-status.txt`

**Doel:** scoped commits — alleen files van deze skill stagen.

**Bij skill start:**

```bash
git rev-parse HEAD > .project/session/pre-skill-sha.txt
```

**Bij skill einde (commit):**

```bash
git diff --name-only $(cat .project/session/pre-skill-sha.txt) HEAD
```

Bestanden die NIET in deze diff staan EN al dirty waren → pre-existing, niet stagen.

**Cleanup:**

```bash
rm -f .project/session/pre-skill-sha.txt .project/session/active-FEATURE_NAME.json
```

---

## Frontend Pipeline Schemas

### `devinfo.handoff` — Build Incomplete

Geschreven door `frontend-design` (Build route) wanneer user "Open in convert" kiest na smoke-failure. Gelezen door `frontend-convert` FASE 0.0.

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

`source` waarden: `"build-incomplete"` (van Build-route failure). Overige `source`-waarden zijn van `frontend-convert` zelf (zie FASE 4.1).

**Cleanup:** `frontend-convert` FASE 4.1 na success → zet `devinfo.handoff = null`. Als handoff ouder dan 24u: `frontend-convert` FASE 0.0 toont staleness-warning.

---

### `devinfo.tokenDrift` — Token Drift Log

Geschreven door `frontend-tokens` (Updaten/Extraheren route) wanneer bestaande token-keys een andere waarde krijgen terwijl DOING/DONE PAGE-features bestaan. Gelezen en opgeruimd door `frontend-design` (Stap 5), `frontend-convert` (FASE 4.1), en `dev-verify`/`dev-refactor` (als feature in `affectedFeatures` staat).

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

**Cleanup:** na elke succesvolle Build of convert-run op een feature in `affectedFeatures`, wordt die feature uit de lijst verwijderd. Als lijst leeg → `resolved: true`.
