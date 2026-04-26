---
name: core-promote-learnings
description: >-
  Scan all projects for recurring learnings, cluster duplicates via Jaccard
  similarity, and promote items that occur in 3+ projects to a global memory
  file. Use with /core-promote-learnings.
disable-model-invocation: true
metadata:
  author: mileszeilstra
  version: 1.0.0
  category: core
---

# Promote Learnings

Scan alle projecten voor learnings die in meerdere projecten terugkomen, en promoot duplicaten naar een globale memory file. Bedoeld om project-overstijgende patronen te consolideren — als dezelfde les in 3+ projecten staat, hoort die thuis op globaal niveau.

**Trigger**: `/core-promote-learnings`

## References

- `shared/RULES.md` — algemene skill conventies
- `skills/project-add/paths.yaml` — projects_root resolutie
- `skills/shared/DASHBOARD.md` — `learnings[]` schema in `project-context.json`

## Process

### FASE 0: Pre-flight

> **Todo**: roep `TodoWrite` aan met de 5 fase-items. Markeer FASE 0 → `in_progress`.

**Resolve `{projects_root}`** (volgens `paths.yaml`):

1. Check env var `CLAUDE_PROJECTS_ROOT` → gebruik die als gezet
2. Anders: lees platform-default uit `skills/project-add/paths.yaml`
   - macOS: `$HOME/projects`
   - Windows: `C:\Projects`
3. Log: `projects_root: {path}`

**Globale memory pad**: `~/.claude/memory/MEMORY.md`

```bash
mkdir -p ~/.claude/memory
```

**Lees bestaande globale memory** (skip als niet bestaat):

- Read `~/.claude/memory/MEMORY.md`
- Parse alle bullet items per `## {Type}` sectie
- Bouw `existingPromoted` set: voor elk item, normalizeer summary (lowercase, trim) → store
- Wordt later gebruikt om duplicaten te skippen

### FASE 1: Scan

> **Todo**: markeer FASE 0 → `completed`, FASE 1 → `in_progress`.

**Discover projecten**:

```bash
find {projects_root} -maxdepth 3 -name "project-context.json" -path "*/.project/*" 2>/dev/null
```

Voor elk gevonden bestand:

1. Read `{projectPath}/.project/project-context.json`
2. Extract `learnings[]` (skip als leeg of ontbreekt)
3. Bepaal projectnaam: laatste segment van `{projectPath}` (bijv. `my-app`)
4. Voeg per learning toe aan aggregatie: `{ project, date, feature, type, source, summary }`

**Log**: `Scanned: {n} projects, {m} learnings total, {k} projects with learnings`

Skip vroeg als minder dan 3 projecten met learnings → niet genoeg basis voor clustering. Rapporteer en exit.

### FASE 2: Cluster duplicaten

> **Todo**: markeer FASE 1 → `completed`, FASE 2 → `in_progress`.

**Tokenisatie** per summary:

1. Lowercase
2. Strip leestekens (`.,;:!?()[]{}'"` → spaties)
3. Split op whitespace
4. Filter stopwoorden:
   ```
   de het een en of maar dus dat die deze dit met via voor bij naar van uit op
   in te is zijn was waren wordt worden werd geworden niet geen ook al alle
   alleen wel dan toen toch nog
   ```
5. Filter tokens met length < 3
6. Resultaat: `tokenSet` (uniek)

**Cluster algoritme** (alleen binnen zelfde `type` — pattern blijft pattern, etc.):

```
clusters = []
for each entry e:
  if e is already in a cluster: continue
  cluster = [e]
  for each other entry o (different project, same type):
    sim = jaccard(e.tokenSet, o.tokenSet)
    if sim >= 0.5:
      cluster.push(o)
  if cluster.size >= 2: clusters.push(cluster)
```

**Jaccard similarity**:

```
jaccard(A, B) = |A ∩ B| / |A ∪ B|
```

**Filter clusters**:

- Alleen clusters met ≥ 3 verschillende `project` waarden behouden
- Skip cluster als `existingPromoted` set al een match bevat (genormaliseerde summary)
- Sorteer op `cluster.size` desc

**Log**: `Clusters detected: {n} (≥3 projects, not yet promoted)`

Geen clusters → spring naar FASE 5 met "no clusters" rapport.

### FASE 3: Review met user

> **Todo**: markeer FASE 2 → `completed`, FASE 3 → `in_progress`.

Voor elk cluster (één voor één, niet batch):

**Genereer suggested summary**: kies de kortste summary uit het cluster als basis, max 200 chars.

**Toon cluster preview**:

```
CLUSTER {i+1}/{total}

Type: {type}
Suggested summary: {generatedSummary}

Voorkomt in {n} projecten:
- {project-a}: "{originele summary uit project-a}"
- {project-b}: "{originele summary uit project-b}"
- {project-c}: "{originele summary uit project-c}"
```

**AskUserQuestion**:

```yaml
header: "Promote"
question: "Promoot dit cluster naar globale memory?"
options:
  - label: "Promote (Recommended)"
    description: "Append met de suggested summary"
  - label: "Edit summary"
    description: "Geef een eigen geformuleerde summary op"
  - label: "Skip"
    description: "Niet promoten, naar volgend cluster"
multiSelect: false
```

Bij `Edit summary`: vraag aanvullend `Wat wordt de summary?` (vrije tekst), gebruik die i.p.v. suggested.

Track per cluster: `decision` (`promoted` | `edited` | `skipped`), `finalSummary`.

### FASE 4: Append

> **Todo**: markeer FASE 3 → `completed`, FASE 4 → `in_progress`.

**Voor elk goedgekeurd cluster** (`promoted` of `edited`):

Lees `~/.claude/memory/MEMORY.md`:

- Bestaat niet → maak aan met header:

  ```markdown
  # Cross-project memory

  Patronen die in meerdere projecten zijn waargenomen en zijn gepromoot via /core-promote-learnings.
  ```

- Bestaat → behoud bestaande inhoud

**Bepaal sectie** op basis van `cluster.type`:

- `pattern` → `## Patterns`
- `pitfall` → `## Pitfalls`
- `observation` → `## Observations`

**Append entry** onder de juiste sectie (maak sectie aan als ontbreekt):

```markdown
- **{vandaag YYYY-MM-DD}** — {finalSummary}
  - Projects: {project-a}, {project-b}, {project-c}{...}
```

**Write** terug naar `~/.claude/memory/MEMORY.md`.

### FASE 5: Report

> **Todo**: markeer FASE 4 → `completed`, FASE 5 → `in_progress`.

Toon ASCII tabel:

```
PROMOTE COMPLETE

| Type        | Promoted | Edited | Skipped | Total |
| ----------- | -------- | ------ | ------- | ----- |
| pattern     |        2 |      1 |       0 |     3 |
| pitfall     |        1 |      0 |       1 |     2 |
| observation |        0 |      0 |       1 |     1 |

Globale memory: ~/.claude/memory/MEMORY.md
Projecten gescand: 7
Projecten met learnings: 5
```

**Suggestie aan user**:

> Globale memory is nu gevuld. Refereer hieraan bij architecturale beslissingen in nieuwe projecten — bijvoorbeeld door deze file als context op te nemen bij `/dev-define` of `/thinking-decide` runs.

Markeer FASE 5 → `completed`.

## Edge cases

- **0 projecten met learnings**: skill rapporteert "no learnings found across projects" en exit voor FASE 2.
- **<3 projecten totaal met learnings**: niet genoeg basis voor clustering, exit met "need at least 3 projects".
- **Cluster bevat 2 projecten**: filter weg (drempel = 3).
- **Bestaande globale memory**: dedup tegen `existingPromoted` set — entry met genormaliseerde summary die al gepromoot is wordt geskipped.
- **Geen `~/.claude/memory/`**: maak aan voor write.
- **Worktree-context**: deze skill werkt cross-project, niet binnen één project. Geen worktree-aware path resolution nodig.

## Notes

- Drempel `≥ 3 projecten` is bewust strikt: 2 projecten kan toeval zijn, 3+ is een echt patroon.
- Jaccard-drempel `0.5` is empirisch; pas aan als clustering te ruim of te krap blijkt.
- De skill is read-only voor projecten — schrijft alleen naar `~/.claude/memory/MEMORY.md`.
- Re-run is veilig: dedup tegen bestaande globale memory voorkomt dubbele promoties.
