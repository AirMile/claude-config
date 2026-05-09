---
name: team-outsource
description: >-
  Outsource a backlog item or defined feature to a teammate by creating an issue
  in GitHub, Jira, or Linear. Generates a tailored brief from feature.json or
  backlog data, assigns the teammate, and writes externalRef back so the local
  item links to the external issue. Use /team-outsource <name> for a specific item,
  /team-outsource to browse and pick, or /team-outsource --paste for Jira/Linear.
  See shared/TEAM.md for the full team-repo workflow.
argument-hint: "[name] [--paste] [--tracker github|jira|linear]"
metadata:
  author: mileszeilstra
  version: 1.0.0
  category: team
---

# Team Outsource

Maak een externe issue aan voor een teammate op basis van een lokaal backlog-item of feature.json brief. Schrijft `externalRef.direction: "outbound"` terug zodat het item in het lokale dashboard gelinkt blijft aan de externe issue.

**Trigger**: `/team-outsource`, `/team-outsource <name>`, `/team-outsource --paste`

## Process

> **Seed task list at start:**
>
> TaskCreate met fases:
>
> - FASE 0: Pre-flight + tracker detection
> - FASE 1: Item selectie + brief composition
> - FASE 2: Format selection
> - FASE 3: Assignee + tracker target
> - FASE 4: Confirm preview
> - FASE 5: Create issue
> - FASE 6: Write externalRef terug
> - FASE 7: Output

### FASE 0: Pre-flight + tracker detection

> **Todo**: markeer FASE 0 → `in_progress`.

1. Read `.project/project.json` → check `team.tracker`. Onbekend → run `gh repo view --json nameWithOwner` (succes → `tracker = "github"`). `--paste` flag aanwezig of `gh` faalt → `tracker = "paste"`.
2. Read `.project/backlog.html` → parse `<script id="backlog-data">` JSON → `data`.
3. Als argument `<name>` gezet → zoek in `data.features` op exacte naam. Geen match → toon "Geen item gevonden met naam `{name}`" + lijst van top-3 vergelijkbare namen en exit.
4. Check of gevonden item al `externalRef` heeft → toon "Al outsourced naar {externalRef.type} #{externalRef.id}" en exit (geen dubbele issues).

> **Todo**: markeer FASE 0 → `completed`, FASE 1 → `in_progress`.

### FASE 1: Item selectie + brief composition

> **Todo**: markeer FASE 1 → `in_progress`.

**Als geen argument gegeven:** toon AskUserQuestion (multiSelect=true) van alle backlog-items met `status ∈ {TODO, DEFINED}` en zonder `externalRef.direction === "outbound"`:

```
#  oauth-callback    DEFINED · API · P1
#  signup-form       TODO · PAGE · P2
#  user-profile      DEFINED · FEATURE · P2
```

**Per geselecteerd item — brief composition:**

Lees `.project/features/<name>/feature.json` als die bestaat.

| Bron                        | Content                                                  |
| --------------------------- | -------------------------------------------------------- |
| `feature.json#summary`      | Issue-body lead-paragraph                                |
| `feature.json#requirements` | Acceptance criteria als genummerde lijst                 |
| `feature.json#architecture` | Implementation hints (file paths, components, endpoints) |
| `feature.json#technique`    | Voorgestelde aanpak (TDD / Implementation First)         |
| backlog-item `description`  | Fallback als feature.json ontbreekt (TODO items)         |

Bij DEFINED items met feature.json → sla `briefSource = "feature"` op. Bij TODO zonder feature.json → `briefSource = "backlog"`.

> **Todo**: markeer FASE 1 → `completed`, FASE 2 → `in_progress`.

### FASE 2: Format selection

> **Todo**: markeer FASE 2 → `in_progress`.

AskUserQuestion (single select):

```yaml
header: "Brief format"
question: "In welke vorm wil je de issue aanmaken?"
options:
  - label: "Technical brief (Recommended)"
    description: "Requirements, architecture, acceptance criteria, file paths. Optimaal voor DEFINED items met feature.json."
  - label: "User story"
    description: "Als <rol>, wil ik <doel>, zodat <waarom>. Plus acceptance criteria. Korter."
  - label: "Minimal task"
    description: "Titel + 1-2 zinnen beschrijving. Gebruik dit voor eenvoudige TODO items."
multiSelect: false
```

Stel default op basis van `briefSource`:

- `briefSource === "feature"` → default Technical brief
- `briefSource === "backlog"` → default Minimal task

**Compose issue body** op basis van gekozen format:

**Technical brief:**

```markdown
## Summary

{feature.json#summary of backlog description}

## Acceptance criteria

1. {criterion 1}
2. {criterion 2}
   ...

## Architecture

- {file/component/endpoint hint}
- {additional hints}

## Approach

{technique: TDD / Implementation First / etc.}
```

**User story:**

```markdown
Als {rol uit summary}, wil ik {doel}, zodat {waarom}.

## Acceptance criteria

1. {criterion 1}
2. {criterion 2}
```

**Minimal task:**

```markdown
{backlog description of summary — max 2 zinnen}
```

> **Todo**: markeer FASE 2 → `completed`, FASE 3 → `in_progress`.

### FASE 3: Assignee + tracker target

> **Todo**: markeer FASE 3 → `in_progress`.

**GitHub config check:**

Read `project.json#team.githubProject`. Als ontbreekt of incompleet: vraag eenmalig via AskUserQuestion:

```yaml
header: "GitHub project"
question: "Geef je GitHub project details op. Dit wordt gecached in project.json."
```

Gevraagde velden (vrije tekst per stuk):

1. Owner + repo (default: `gh repo view --json nameWithOwner`)
2. Default assignee GitHub-username (kan leeg)
3. Project board nummer (optioneel — voor ProjectV2 koppeling, vul in als je op een GitHub Project werkt)

Schrijf ingevulde velden naar `project.json#team.githubProject`.

**Assignee selectie:**

```yaml
header: "Assignee"
question: "Aan wie wijs je dit toe?"
options:
  - label: "{defaultAssignee} (Recommended)"
    description: "Gecachede standaard — wijzig via project.json#team.githubProject.defaultAssignee"
  - label: "Andere username"
    description: "Typ een GitHub-username"
  - label: "Geen assignee"
    description: "Issue zonder toewijzing aanmaken"
multiSelect: false
```

Als `defaultAssignee` leeg → sla "gecachede standaard" optie over, toon direct "Andere username" + "Geen assignee".

> **Todo**: markeer FASE 3 → `completed`, FASE 4 → `in_progress`.

### FASE 4: Confirm preview

> **Todo**: markeer FASE 4 → `in_progress`.

Toon issue preview:

```
ISSUE PREVIEW
══════════════════════════════════════════════════
Tracker:    github (owner/repo)
Title:      {feature name of backlog naam}
Assignee:   @{username}
Labels:     {phase als label, bijv. P1}

Body:
  ## Summary
  {eerste 3 regels van body}
  ...
══════════════════════════════════════════════════
```

AskUserQuestion (single select):

```yaml
header: "Confirm"
question: "Issue aanmaken met bovenstaande inhoud?"
options:
  - label: "Aanmaken (Recommended)"
  - label: "Annuleren"
multiSelect: false
```

> **Todo**: markeer FASE 4 → `completed`, FASE 5 → `in_progress`.

### FASE 5: Create issue

> **Todo**: markeer FASE 5 → `in_progress`.

**GitHub:**

Schrijf body naar tijdelijk bestand:

```bash
cat > /tmp/team-outsource-body-{name}.md << 'EOF'
{gecomponeerde body}
EOF
```

Maak issue aan:

```bash
gh issue create \
  -R {owner}/{repo} \
  --title "{title}" \
  --body-file /tmp/team-outsource-body-{name}.md \
  --assignee {username} \
  --label "{phase}"
```

Skip `--assignee` flag als geen assignee gekozen. Capture stdout voor issue URL + nummer.

**Jira/Linear/paste:**

Toon body in terminal:

```
ISSUE BODY — kopieer onderstaande tekst naar {tracker}

────────────────────────────────────────────────────
{title}

{body}
────────────────────────────────────────────────────

Na aanmaken: plak de issue URL hieronder.
```

AskUserQuestion vrije tekst: paste URL → parse `id` via:

- GitHub: `/(\d+)$/`
- Jira: `/([A-Z]+-\d+)/`
- Linear: `/([A-Z]+-\d+)/`

Bij parse-fout: toon "Kon ID niet extraheren uit URL — handmatig invullen?" en vraag opnieuw.

> **Todo**: markeer FASE 5 → `completed`, FASE 6 → `in_progress`.

### FASE 6: Write externalRef terug

> **Todo**: markeer FASE 6 → `in_progress`.

Re-read `.project/backlog.html` direct vóór write (Prettier/linters kunnen bestand tussentijds wijzigen).

Zoek feature op naam → update `externalRef` veld:

```json
{
  "type": "github",
  "id": "456",
  "url": "https://github.com/owner/repo/issues/456",
  "itemId": null,
  "assignees": ["alice"],
  "labels": ["P1"],
  "direction": "outbound",
  "syncedStatus": "open",
  "syncedAt": "YYYY-MM-DD",
  "split": null
}
```

Zet `data.updated` naar vandaag. Edit JSON-blok terug in `backlog.html` (script-tags intact).

Als `.project/features/<name>/feature.json` bestaat: voeg ook hier `externalRef` aan toe (1:1 copy).

> **Todo**: markeer FASE 6 → `completed`, FASE 7 → `in_progress`.

### FASE 7: Output

> **Todo**: markeer FASE 7 → `in_progress`.

```
OUTSOURCED

  {name}  →  {tracker} #{id}
  {url}

  Assignee:  @{username}
  Status:    {backlog status} · gemarkeerd als outbound

  Next: monitor via /team-verify zodra er commits zijn op deze branch
```

> **Todo**: markeer FASE 7 → `completed`.

## Restrictions

- Geen bidirectionele sync — externe status-updates komen niet automatisch terug naar backlog
- Skip items die al een `externalRef` hebben (zowel inbound als outbound) — geen dubbele issues
- Eén item tegelijk voor technical brief / user story formats. Multi-select OK voor minimal-task batch
- Backlog status verandert niet bij outsourcen — `externalRef.direction` is het signaal, niet de statuskolom
- `paste` flow: minimale URL-validatie — gebruiker is verantwoordelijk voor correcte paste

## Tracker-support matrix

| Tracker | Methode    | Assignee-support |
| ------- | ---------- | ---------------- |
| GitHub  | `gh` CLI   | GitHub username  |
| Jira    | paste-flow | Handmatig in UI  |
| Linear  | paste-flow | Handmatig in UI  |

## Terminal Formatting

- NEVER use blockquote syntax (`>`) for displaying content in user-facing output
- Backticks only for actual code, file paths, and command references

## Language

Follow the Language Policy in CLAUDE.md (instructies Nederlands, technische termen Engels).
