# Project Sync Protocol

Shared 3-file sync pattern voor skill completion. Skills verwijzen hiernaar voor het generieke protocol en specificeren alleen hun eigen mutaties.

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

## 3-File Sync Pattern

Bij skill completion, sync feature state naar 3 bestanden:

### Stap 1: Read (parallel, skip als niet bestaat)

Lees **direct voor het editen** — vertrouw NIET op reads uit eerdere fases (Prettier/linters kunnen bestanden tussentijds wijzigen):

- `.project/features/{feature-name}/feature.json`
- `.project/backlog.html`
- `.project/project.json`

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

| Sectie           | Merge logica                                                          |
| ---------------- | --------------------------------------------------------------------- |
| `features[]`     | Check op naam → nieuw: push → bestaand: update status                 |
| `stack.packages` | Check op naam → nieuw: push `{ name, version, purpose }` → skip       |
| `endpoints`      | Check op method+path → nieuw: push → bestaand: update status          |
| `data.entities`  | Check op naam → nieuw: push met fields/relations → bestaand: merge    |
| `context`        | Update structure/routing/patterns individueel (alleen bij impact)     |
| `architecture`   | Volg diagram conventies uit `shared/DASHBOARD.md` (alleen bij impact) |

### Stap 3: Write (parallel)

- Write `feature.json` (of targeted Edit als alleen specifieke velden wijzigen)
- Edit `backlog.html` (keep `<script>` tags intact)
- Write `project.json` (of targeted Edit)

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
