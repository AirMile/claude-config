---
name: team-issues
description: >-
  Import issues from GitHub, Jira, or Linear into the local backlog. Smart-splits
  larger issues into multiple frontend/dev todos based on body analysis. Use /team-issues
  to browse GitHub issues, /team-issues <number> to import a specific issue,
  /team-issues --paste for Jira/Linear paste flow, /team-issues --mine to filter on
  assignee=@me. See shared/TEAM.md for the full team-repo workflow.
argument-hint: "[number] [--mine] [--paste] [--label <label>]"
metadata:
  author: mileszeilstra
  version: 1.0.0
  category: team
---

# Team Issues

Import issues from a team tracker into your local backlog. Smart-splits multi-area issues into separate frontend/dev todos so each item maps cleanly to one skill pipeline.

**Trigger**: `/team-issues`, `/team-issues <number>`, `/team-issues --mine`, `/team-issues --paste`

## Process

> **Seed task list at start:**
>
> TaskCreate with phases:
>
> - FASE 0: Pre-flight + tracker detection
> - FASE 1: Issue intake
> - FASE 2: Dedup + selectie
> - FASE 3: Smart split analyse
> - FASE 4: User confirmation
> - FASE 5: Fragment confirm + checkpoint
> - FASE 6: Write to backlog
> - FASE 7: Output

### FASE 0: Pre-flight + tracker detection

> **Todo**: markeer FASE 0 → `in_progress`.

1. Read `.project/project.json`:
   - Check `team.tracker` — als gezet, gebruik dat.
   - Als niet gezet: probeer `gh repo view --json nameWithOwner` (succes → `tracker = "github"`).
   - Als dat ook faalt, of als `--paste` flag aanwezig → `tracker = "paste"`.
   - Sla tracker op in `project.json#team.tracker` als die nog ontbrak.

2. Read `.project/backlog.html` → parse `<script id="backlog-data">` JSON → `data`.

3. Als argument een getal is (bijv. `/team-issues 42`) → sla op als `directIssueId`, skip FASE 1 en 2.

> **Todo**: markeer FASE 0 → `completed`, FASE 1 → `in_progress`.

### FASE 1: Issue intake

> **Todo**: markeer FASE 1 → `in_progress`.

**GitHub:**

```bash
gh issue list --state open --json number,title,body,labels,assignees,url,updatedAt --limit 50
```

Extra filters:

- `--mine` flag → voeg `--assignee @me` toe
- `--label <label>` arg → voeg `--label <label>` toe

**Jira / Linear / paste:**

AskUserQuestion:

```yaml
header: "Issue intake"
question: "Plak de issue URL of beschrijving hieronder."
options:
  - label: "URL plakken"
    description: "Bijv. https://company.atlassian.net/browse/JIRA-456"
  - label: "Tekst plakken"
    description: "Titel + body — eerste regel wordt de titel"
multiSelect: false
```

Vraag daarna om de inhoud via freetext. Parse:

- URL → extraheer `id` via regex (`/([A-Z]+-\d+)/` of `/(\d+)$/`), `type` uit domein
- Body → eerste regel = title, rest = body

> **Todo**: markeer FASE 1 → `completed`, FASE 2 → `in_progress`.

### FASE 2: Dedup + selectie

> **Todo**: markeer FASE 2 → `in_progress`.

Filter al-geïmporteerde issues — een issue geldt als geïmporteerd zodra **één** backlog-item `externalRef.id === issue.id && externalRef.type === tracker` heeft. Toon die niet opnieuw in de selectie.

Als `directIssueId` gezet is → selecteer direct dat issue en skip de multi-select.

Anders: toon AskUserQuestion (multiSelect=true) met per issue:

```
#42  Implement OAuth login        [enhancement, P1]  — @miles
#38  Fix signup validation error  [bug, P2]
#35  Add dashboard export         [feature, P2]
```

> **Todo**: markeer FASE 2 → `completed`, FASE 3 → `in_progress`.

### FASE 3: Smart split analyse

> **Todo**: markeer FASE 3 → `in_progress`.

Per gekozen issue: analyseer body inline voor split-signalen.

**Detect-signalen (in volgorde van betrouwbaarheid):**

1. Headings (`## Frontend`, `## Backend`, `## Database`, `## API`, `## Tests`, `## Mobile`)
2. Labeled lijsten (`- [ ] API endpoint`, `- [ ] UI component`)
3. Keyword clusters in bullet-points (`page`, `endpoint`, `migration`, `schema`, `component`, `test`)
4. Lengte: body > 500 chars met ≥3 alinea-breaks → mogelijk splitsbaar

**Type-mapping per fragment:**

| Signaal                            | Voorgesteld type  | Track    |
| ---------------------------------- | ----------------- | -------- |
| Frontend / UI / page / component   | PAGE of COMPONENT | Frontend |
| Backend / API / endpoint / service | API of FEATURE    | Dev      |
| Database / migration / schema      | FEATURE           | Dev      |
| Tests / test coverage              | FEATURE           | Dev      |
| Bug fix                            | BUG               | Dev      |
| Onbekend / gemengd                 | FEATURE           | Dev      |

**ASCII diagram:** genereer een visuele split-boom voor de user zodat ze in één oogopslag zien wat voorgesteld wordt:

```
Issue #42: Implement OAuth login
├── oauth-login       PAGE  · Frontend  · P1
├── oauth-callback    API   · Dev       · P1
└── oauth-tests       FEATURE · Dev    · P2
```

Bij één enkel fragment → sla de boom over, ga direct naar FASE 4 single-todo path.

> **Todo**: markeer FASE 3 → `completed`, FASE 4 → `in_progress`.

### FASE 4: User confirmation per issue

> **Todo**: markeer FASE 4 → `in_progress`.

AskUserQuestion (single select):

```yaml
header: "Import aanpak"
question: "Hoe wil je dit issue importeren?"
options:
  - label: "Smart split (Recommended)"
    description: "Meerdere todos op basis van de analyse"
  - label: "Single todo"
    description: "Één backlog-item voor het hele issue"
  - label: "Overslaan"
    description: "Importeer dit issue niet"
multiSelect: false
```

**Smart split:** ga naar FASE 5.

**Single todo:** vraag via gecombineerde AskUserQuestion:

```yaml
# Vraag 1
header: "Priority"
question: "Welke prioriteit?"
options:
  - label: "P1 (Recommended)", description: "Hoogste prioriteit"
  - label: "P2", description: "Belangrijk, niet blokkerend"
  - label: "P3", description: "Als er tijd is"
  - label: "P4", description: "Parkeren voor later"
multiSelect: false

# Vraag 2
header: "Type"
question: "Type item?"
options:
  - label: "FEATURE (Recommended)"
  - label: "BUG"
  - label: "API"
  - label: "PAGE"
  - label: "CHANGE"
multiSelect: false
```

Ga dan direct naar FASE 6 (write).

**Overslaan:** ga naar volgende gekozen issue (loop terug naar FASE 3 als nog issues wachten).

> **Todo**: markeer FASE 4 → `completed`, FASE 5 → `in_progress`.

### FASE 5: Fragment confirm + checkpoint

> **Todo**: markeer FASE 5 → `in_progress`.

Toon de split-voorstellen als multi-select (default: all checked):

```yaml
header: "Fragmenten"
question: "Welke fragments importeer je?"
options:
  - label: "oauth-login · PAGE · Frontend · P1"
  - label: "oauth-callback · API · Dev · P1"
  - label: "oauth-tests · FEATURE · Dev · P2"
multiSelect: true
```

Per geselecteerd fragment: toon gecombineerde confirm voor `type` + `phase` (pre-filled met voorstel, user kan overrulen).

**Interview checkpoint** (vóór FASE 6 schrijft):

Toon summary table van alles wat geïmporteerd wordt:

```
IMPORT OVERZICHT
════════════════════════════════════════════════════
Issue  #42 · Implement OAuth login (github)
  oauth-login       PAGE    · Frontend · P1
  oauth-callback    API     · Dev      · P1
  oauth-tests       FEATURE · Dev      · P2

Issue  #38 · Fix signup validation error (github)
  signup-validation BUG     · Dev      · P2
════════════════════════════════════════════════════
```

AskUserQuestion:

```yaml
header: "Confirm import"
question: "Klopt dit overzicht? Items worden naar de backlog geschreven."
options:
  - label: "Ja, importeren (Recommended)"
  - label: "Aanpassen"
    description: "Ga terug naar selectie"
multiSelect: false
```

> **Todo**: markeer FASE 5 → `completed`, FASE 6 → `in_progress`.

### FASE 6: Write to backlog

> **Todo**: markeer FASE 6 → `in_progress`.

Per geaccepteerd todo: insert in `data.features[]` (na dedup-check op `name`):

```json
{
  "name": "{kebab-case van title of fragment-label}",
  "type": "{type}",
  "status": "TODO",
  "phase": "{phase}",
  "description": "{issue title}\n\n{fragment excerpt, max 500 chars}",
  "source": "/team-issues",
  "externalRef": {
    "type": "{github|jira|linear}",
    "id": "{issue id}",
    "url": "{url of null bij paste zonder URL}",
    "labels": ["{label.name}"],
    "split": "{frontend|backend|tests|null}"
  },
  "dependencies": []
}
```

Schrijf `data.updated` naar vandaag (`YYYY-MM-DD`).

Schrijf `project.json#team.tracker` als dat nog niet gezet was.

Edit het JSON-blok in `backlog.html` — houd `<script>` tags intact.

> **Todo**: markeer FASE 6 → `completed`, FASE 7 → `in_progress`.

### FASE 7: Output

> **Todo**: markeer FASE 7 → `in_progress`.

```
GEÏMPORTEERD

  Issue #42: Implement OAuth login (github)
    oauth-login       P1 · PAGE    · Frontend track
    oauth-callback    P1 · API     · Dev track
    oauth-tests       P2 · FEATURE · Dev track

  Issue #38: Fix signup validation error (github)
    signup-validation P2 · BUG     · Dev track

  Backlog: .project/backlog.html

  Next steps:
  - /dev-define oauth-callback     (start dev pipeline)
  - /dev-define signup-validation  (start dev pipeline)
  - /frontend-design oauth-login   (start frontend pipeline)
```

> **Todo**: markeer FASE 7 → `completed`.

## Restrictions

- Smart split is **suggestie** — gebruiker bepaalt finaal welke fragmenten geïmporteerd worden
- Geen bidirectionele sync — issue-updates in de tracker worden niet automatisch verwerkt in de backlog
- Één issue tegelijk smart-splitten — geen bulk-split van meerdere issues in één keer
- Dedup op `externalRef.id` + tracker — een issue dat al (deels) geïmporteerd is verschijnt niet opnieuw in de selectie
- Schrijf GEEN code, voer GEEN git-commando's uit

## Tracker-support matrix

| Tracker | Methode    | ID-formaat |
| ------- | ---------- | ---------- |
| GitHub  | `gh` CLI   | `#123`     |
| Jira    | paste-flow | `PROJ-456` |
| Linear  | paste-flow | `ABC-789`  |

Native Jira/Linear integratie (API/MCP) is out of scope voor v1. Zie `shared/TEAM.md` voor Jira/Linear handmatige workflow.

### Terminal Formatting

- NEVER use blockquote syntax (`>`) for displaying content in user-facing output
- Backticks only for actual code, file paths, and command references

### Language

Follow the Language Policy in CLAUDE.md (instructies Nederlands, technische termen Engels).
