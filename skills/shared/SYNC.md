# Project Sync Protocol

Shared sync pattern voor skill completion. Skills verwijzen hiernaar voor het generieke protocol en specificeren alleen hun eigen mutaties.

---

## Worktree-aware Pad Resolutie

Skills kunnen draaien in een git worktree (parallelle feature development). Omdat `.project/` gitignored is, bestaat het alleen in de main worktree.

### Detectie (eenmalig per skill)

Bij de eerste `.project/` operatie (read of write):

1. `git worktree list --porcelain | head -1` → extraheer pad na `worktree ` → `{main_worktree}`
2. `git rev-parse --show-toplevel` → `{current}`
3. **Verschillend** → in worktree. Gebruik `{main_worktree}/.project/` voor ALLE `.project/` operaties.
   Log: `WORKTREE: .project/ → {main_worktree}/.project/`
4. **Gelijk** → niet in worktree. Gebruik `.project/` relatief.

### Scope

- **`.project/`** (feature.json, backlog.html, project.json, session) → altijd main worktree
- **Source code** (implementatie, tests) → lokale worktree (eigen branch)
- Detectie eenmaal uitvoeren, geresolvd pad hergebruiken in alle fases

---

## Sync Pattern

Bij skill completion, sync feature state naar de relevante bestanden:

### Stap 1: Read (parallel, skip als niet bestaat)

Lees **direct voor het editen** — vertrouw NIET op reads uit eerdere fases (Prettier/linters kunnen bestanden tussentijds wijzigen):

- `.project/features/{feature-name}/feature.json`
- `.project/backlog.html`
- `.project/project.json`
- `.project/project-context.json` (alleen als context/architecture/learnings gewijzigd — build/test/refactor skills)
- `.project/project-concept.md` (alleen als concept gewijzigd — thinking/plan skills)

### Stap 2: Muteer in memory

**feature.json** — read-modify-write, behoud alle bestaande secties. Skill voegt specifieke velden toe/update (zie skill-specifieke mutaties).

**backlog.html** (zie `shared/BACKLOG.md`):

- Parse JSON uit `<script id="backlog-data">`
- Zoek feature op naam
- Update `status` naar skill-specifieke waarde
- Zet `data.updated` → huidige datum
- Niet gevonden → voeg toe aan `data.features`

**project.json** (zie `shared/DASHBOARD.md`):

Merge per sectie — check altijd op bestaande entries voor push:

| Sectie           | Merge logica                                                       |
| ---------------- | ------------------------------------------------------------------ |
| `features[]`     | Check op naam → nieuw: push → bestaand: update status              |
| `stack.packages` | Check op naam → nieuw: push `{ name, version, purpose }` → skip    |
| `endpoints`      | Check op method+path → nieuw: push → bestaand: update status       |
| `data.entities`  | Check op naam → nieuw: push met fields/relations → bestaand: merge |

**project-context.json** (zie `shared/DASHBOARD.md`):

Lees `.project/project-context.json` (of maak aan met `{}`). Merge per sectie:

| Sectie         | Merge logica                                                                                                                                                                       |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `context`      | Update structure/routing/patterns individueel (alleen bij impact)                                                                                                                  |
| `architecture` | Volg component-first model uit `shared/DASHBOARD.md` (alleen bij impact). Update `components[]` (status, src, test, connects_to). Diagram optioneel → `.project/architecture.mmd`. |
| `learnings`    | Check op date+feature → nieuw: push → bestaand: skip (append-only)                                                                                                                 |

**project-concept.md** (alleen bij concept-schrijvende skills):

Schrijf het volledige concept document als plain markdown naar `.project/project-concept.md`. Update gelijktijdig `concept.name` en `concept.pitch` in `project.json` (zodat lichte readers actuele metadata hebben).

### Stap 3: Write (parallel)

- Write `feature.json` (of targeted Edit als alleen specifieke velden wijzigen)
- Edit `backlog.html` (keep `<script>` tags intact)
- Write `project.json` (of targeted Edit)
- Write `project-context.json` (als context/architecture/learnings gewijzigd)

### Stap 4: Skip-worktree herstellen

Na het schrijven van `.project/` bestanden, zet skip-worktree op eventuele nieuwe bestanden:

```bash
git ls-files .project/ | xargs git update-index --skip-worktree 2>/dev/null
```

Dit voorkomt dat `.project/` wijzigingen in git status verschijnen en pull/stash verstoren.

### Active Feature Cleanup

```bash
rm -f .project/session/active-{feature-name}.json
```

---

## Skill-specifieke mutaties

Elke skill beschrijft in zijn eigen SKILL.md **alleen** wat afwijkt van het standaard protocol:

- Welke `status` waarde voor backlog en feature.json
- Welke velden worden toegevoegd/geupdate in feature.json
- Welke project.json secties worden geraakt (endpoints, entities, architecture, etc.)
- Eventuele extra bestanden of stappen

Het generieke leespatroon, backlog-update formaat, merge-logica en schrijfpatroon hoeven niet herhaald te worden.

## Frontend skills

Frontend skills volgen hetzelfde sync protocol met dezelfde stages als dev skills (`building/built/testing`). Verschil: frontend items gebruiken geen `feature.json` — status wordt alleen in backlog + `project.json` `features[]` bijgehouden.

| Skill               | Backlog mutatie                      | project.json mutatie                              |
| ------------------- | ------------------------------------ | ------------------------------------------------- |
| `/frontend-plan`    | Maakt batch PAGE TODOs               | `design` (pages, flows, principles), `features[]` |
| `/frontend-compose` | DOING + `building` → `built`         | `stack.packages`, `design.pages`, `features[]`    |
| `/frontend-convert` | DOING + `building` → `built`         | `features[]`                                      |
| `/frontend-audit`   | `testing` → DONE                     | `features[]`                                      |
| `/frontend-wcag`    | `testing` → DONE + nieuwe A11Y TODOs | `features[]`                                      |

Frontend items slaan `defining/defined` over — `/frontend-plan` maakt items aan als TODO, en `/frontend-compose` pakt ze direct op als `building`.
