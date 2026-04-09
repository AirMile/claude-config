# Session Tracking

Lichtgewicht session state voor cross-skill coördinatie. Pipeline skills gebruiken de onderstaande bestanden. Frontend pipeline skills gebruiken daarnaast `.project/session/devinfo.json` voor handoff data tussen skills (bijv. `frontend-compose` → `frontend-convert`).

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
