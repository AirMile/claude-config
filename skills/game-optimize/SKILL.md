---
name: game-optimize
description: Optimaliseer een meetbare metric (FPS, frame-time, memory, AI win-rate, pathfinding speed) in een Godot 4.x project via parallelle subagent-experimenten in git worktrees. Gebruik met /game-optimize voor performance- of balance-tuning waar je een score kunt definiëren. Standalone — niet gekoppeld aan een feature in de pipeline.
disable-model-invocation: true
metadata:
  author: mileszeilstra
  version: 0.1.0
  category: game
---

# Optimize

Autonome verbeter-loop voor Godot 4.x: definieer metric → spawn parallelle subagents in worktrees → houd verbeteringen, gooi regressies weg → loop tot stall.

**Trigger**: `/game-optimize` of `/game-optimize [auto]`

Geïnspireerd op `evo-hq/evo` autoresearch patroon, geïntegreerd met `.project/` en GUT testing. Geen externe dependency.

## Input

Geen verplichte input. Config interactief in FASE 1 of via resume.

## Output

```
.project/optimize/{run-id}/
├── spec.json          # metric, gate, scope, baseline, parameters
├── tree.json          # nodes (id, parent, branch, score, status, hypotheses)
├── runs/{NNNN}.json   # per-ronde resultaat
├── benchmark.tscn     # Godot benchmark scene (gegenereerd uit template)
├── benchmark.gd       # Godot benchmark script (parsed SCORE= regel)
├── gate.sh            # default: GUT testsuite headless
└── branches.txt       # cleanup-lijst voor abort
```

Update bij voltooiing: `.project/project.json` → push naar `optimization_runs[]`.

## Process

**Fase tracking** — eerste actie: roep `TodoWrite` aan met deze 7 items (status `pending`):

1. FASE 0: Pre-flight
2. FASE 1: Define Metric
3. FASE 2: Instrument Benchmark
4. FASE 3: Baseline Run
5. FASE 4: Optimize Loop
6. FASE 5: Pick Winner
7. FASE 6: Sync + Report

### FASE 0: Pre-flight

> **Todo**: markeer FASE 0 → `in_progress`.

**Capture git baseline:**

```bash
mkdir -p .project/session .project/optimize
find .project/session -maxdepth 1 -name "active-optimize-*.json" -mtime +1 -delete 2>/dev/null
git rev-parse HEAD > .project/session/pre-skill-sha.txt
```

**Ensure .gitignore covers optimize artifacts** (idempotent):

```bash
GITIGNORE=".project/.gitignore"
touch "$GITIGNORE"
ensure_pattern() {
  grep -qxF "$1" "$GITIGNORE" || echo "$1" >> "$GITIGNORE"
}
ensure_pattern "optimize/*/worktrees/"
ensure_pattern "session/active-optimize-*.json"
ensure_pattern "session/pre-skill-sha.txt"
```

Voorkomt dat full repo-checkouts (worktrees) of lokale session-state per ongeluk in een commit terechtkomen.

**Git safety:**

1. `git status --porcelain` leeg? Anders **AskUserQuestion** (Auto-mode: stash):
   - "Stash changes (Recommended)" / "Abort"
2. Default branch detecteren (zie shared/SKILL-PATTERNS.md Git Safety Gates).
3. `BASE_SHA=$(git rev-parse HEAD)`.

**Detect Godot:**

Cross-platform path detection via `paths.yaml`:

```bash
# Windows: /c/Godot/Godot_v4.4.1-stable_win64.exe
# macOS:   /Applications/Godot.app/Contents/MacOS/Godot
# Linux:   godot4 (assume in PATH)
GODOT_BIN="${GODOT_BIN:-$(command -v godot4 || command -v godot)}"
"$GODOT_BIN" --version 2>/dev/null
```

Geen Godot → exit met "game-optimize vereist Godot 4.x. Set GODOT_BIN env var of voeg toe aan PATH."

**Detect GUT:**

```bash
test -d addons/gut && echo "GUT installed" || echo "GUT not found, gate disabled"
```

Geen GUT → waarschuw dat default gate niet werkt; user moet eigen gate definiëren of accepteren dat tests subagents niet detecteert.

**Resume detection** + **Auto-mode** + **active signal**: zie identiek aan `dev-optimize` FASE 0.

**Auto-mode defaults** (specifiek voor game):

| Beslispunt          | Default                    |
| ------------------- | -------------------------- |
| Metric keuze        | **FPS** (default)          |
| Subagents per ronde | **3**                      |
| Budget per subagent | **5 iteraties**            |
| Stall threshold     | **5 rondes**               |
| Winner-merge        | **Top branch automatisch** |

**Project context** (skip als niet bestaat):

Lees `.project/project.json` voor stack-info en eerdere `optimization_runs[]`.

### FASE 1: Define Metric

> **Todo**: markeer FASE 0 → `completed`, FASE 1 → `in_progress`.

Bij resume: skip.

**AskUserQuestion 1 — wat optimaliseren?** (Auto-mode: FPS)

```yaml
header: "Metric"
question: "Wat wil je optimaliseren?"
options:
  - label: "FPS in stress-scene (Recommended)"
    description: "Gemiddelde FPS bij N entities/sprites. Higher is better."
  - label: "Frame time"
    description: "ms per frame in vaste benchmark scene. Lower is better."
  - label: "Memory footprint"
    description: "MB peak (Performance.MEMORY_STATIC). Lower is better."
  - label: "AI win-rate"
    description: "% wins van AI in M simulated matches. Higher is better."
  - label: "Pathfinding speed"
    description: "ms voor N paths op een vaste map. Lower is better."
multiSelect: false
```

(Custom optie via "Other" → vraag follow-up: scene path + score-extractie regel.)

**AskUserQuestion 2 — richting** (Auto-mode: minimize voor frame-time/memory/pathfinding, maximize voor FPS/winrate):

```yaml
header: "Richting"
options:
  - label: "Lager is beter (minimize)"
  - label: "Hoger is beter (maximize)"
multiSelect: false
```

**AskUserQuestion 3 — scope** (Auto-mode: hele `scripts/`):

```yaml
header: "Scope"
question: "Welke directories mogen subagents wijzigen?"
options:
  - label: "scripts/ (Recommended)"
    description: "Alleen GDScript, scenes intact"
  - label: "scripts/ + scenes/"
    description: "Sta scene-edits toe (riskanter)"
  - label: "scripts/ + addons/{name}"
    description: "Custom subset"
  - label: "Custom paths"
multiSelect: false
```

**AskUserQuestion 4 — loop parameters** (Auto-mode: defaults). De keuze bepaalt ook welk subagent-model gebruikt wordt:

```yaml
header: "Parameters"
options:
  - label: "Conservatief: 3 agents × 5 iter, stall 5, 60min cap, sonnet (Recommended)"
    description: "Goedkoop en snel."
  - label: "Standaard: 5 agents × 5 iter, stall 5, 90min cap, sonnet"
  - label: "Aggressief: 8 agents × 8 iter, stall 8, 180min cap, opus"
    description: "Veel meer compute en duurder model — alleen voor lange, lastige runs."
multiSelect: false
```

Mapping (zelfde als dev-optimize):

| Keuze        | subagents | budget | stall | wallclock | model    |
| ------------ | --------- | ------ | ----- | --------- | -------- |
| Conservatief | 3         | 5      | 5     | 60 min    | `sonnet` |
| Standaard    | 5         | 5      | 5     | 90 min    | `sonnet` |
| Aggressief   | 8         | 8      | 8     | 180 min   | `opus`   |

Voor Godot is benchmark-tijd vaak hoger (Godot import-cache, scene-load) — wallclock-cap dus relatief belangrijker dan bij dev-optimize.

**AskUserQuestion 5 — benchmark parameters (per metric):**

| Metric      | Vraag                                       | Default         |
| ----------- | ------------------------------------------- | --------------- |
| FPS         | Aantal entities in stress-scene?            | 1000            |
| frame_time  | Run-duur (seconden)?                        | 10              |
| memory      | Run-duur (seconden) voor peak meting?       | 30              |
| ai_winrate  | Aantal simulated matches?                   | 100             |
| pathfinding | Aantal paths + map-naam (uit scenes/maps/)? | 1000 + selectie |

**Schrijf `.project/optimize/{run-id}/spec.json`** (zie dev-optimize voor volledige schema, inclusief `max_wallclock_minutes`, `subagent_model`, `run_started_at`). Vervang `benchmark_cmd` door:

```bash
"benchmark_cmd": "$GODOT_BIN --headless --path . res://.project/optimize/{run-id}/benchmark.tscn --quit-after 120"
```

`gate_cmd`:

```bash
"gate_cmd": "bash .project/optimize/{run-id}/gate.sh"
```

### FASE 2: Instrument Benchmark

> **Todo**: markeer FASE 1 → `completed`, FASE 2 → `in_progress`.

**Stap 1 — kopieer benchmark template (Godot scene + script):**

Eén universele scene `references/benchmarks/benchmark.tscn` (Node met script-ref) + per-metric GDScript:

| Metric      | Script template                        |
| ----------- | -------------------------------------- |
| fps         | `references/benchmarks/fps-stress.gd`  |
| frame_time  | `references/benchmarks/frame-time.gd`  |
| memory      | `references/benchmarks/memory.gd`      |
| ai_winrate  | `references/benchmarks/ai-winrate.gd`  |
| pathfinding | `references/benchmarks/pathfinding.gd` |

Workflow:

1. Kopieer `benchmark.tscn` → `.project/optimize/{run-id}/benchmark.tscn`. Substitueer `{RUN_ID}` in het `path` van de ExtResource zodat het script-pad klopt.
2. Kopieer gekozen `<metric>.gd` → `.project/optimize/{run-id}/benchmark.gd`. Substitueer placeholders (`{ENTITY_COUNT}`, `{DURATION_FRAMES}`, `{SCENE_TO_LOAD}`, etc.) met user-gekozen waarden uit AskUserQuestion 5.

Templates printen één regel `SCORE=<float>` op stdout via `print()` voor `get_tree().quit()`. Skill parsed laatste `SCORE=` regel uit Godot stdout.

**Stap 2 — gate script:**

Default `references/gates/gut-green.sh` → kopieert script dat GUT headless draait:

```bash
#!/bin/bash
"$GODOT_BIN" --headless --path . -s addons/gut/gut_cmdln.gd -gtest_dirs=test/ -gexit
```

Geen GUT → kopieert no-op gate met waarschuwing.

**Stap 3 — review + edit:**

**AskUserQuestion** (Auto-mode: Run as-is):

```yaml
header: "Scripts"
question: "Klopt benchmark.gd en gate.sh?"
options:
  - label: "Run as-is (Recommended)"
  - label: "Edit eerst"
  - label: "Abort"
multiSelect: false
```

`chmod +x` op gate.sh.

### FASE 3: Baseline Run

> **Todo**: markeer FASE 2 → `completed`, FASE 3 → `in_progress`.

```bash
cd "$(git rev-parse --show-toplevel)"

# Gate eerst
if ! bash .project/optimize/{run-id}/gate.sh; then
  echo "BASELINE GATE FAIL: fix GUT tests eerst"
  exit 1
fi

# Benchmark — capture stdout, parse SCORE
RAW=$("$GODOT_BIN" --headless --path . res://.project/optimize/{run-id}/benchmark.tscn --quit-after 120 2>&1)
BASELINE=$(echo "$RAW" | grep -E '^SCORE=' | tail -1 | cut -d= -f2)
```

Schrijf `runs/0000.json` en initialiseer `tree.json` (zie dev-optimize FASE 3).

**Display + kostenraming** (zelfde berekening als dev-optimize FASE 3 — zie daar voor de formules). Godot benchmark-tijden zijn vaak hoger (eerste run per worktree heeft import-cache overhead van 30-60s), houd daar rekening mee in de schatting.

```
BASELINE: {metric} = {score} ({direction})
GUT: {pass}/{total} tests green.

KOSTENRAMING (worst-case):
- {subagents} agents × {budget} iter × {stall} rondes = {TOTAL_ITERS} agent-iteraties
- ~{PER_ITER_SECONDS}s per iteratie ({BENCHMARK_SECONDS}s benchmark + {GATE_SECONDS}s gate + 30s import)
- Geschatte tijd: ~{TOTAL_MINUTES} min (capped op {max_wallclock_minutes} min)
- Geschatte cost: ~${TOTAL_DOLLARS} ({subagent_model})
```

**AskUserQuestion** (Auto-mode: bij `TOTAL_DOLLARS > 10` OR `TOTAL_MINUTES > 120` → abort):

Identieke optie-set als dev-optimize: Doorgaan / Verlaag budget / Abort.

**Markeer run-start**: schrijf `run_started_at = now_iso` naar `spec.json` (voor wallclock-cap in FASE 4).

### FASE 4: Optimize Loop

> **Todo**: markeer FASE 3 → `completed`, FASE 4 → `in_progress`.

Identieke loop-mechaniek als `dev-optimize` FASE 4 (selecteer parents → spawn subagents in worktrees → verzamel → stall check → continue prompt).

**Verschil — subagent brief:**

Lees `references/subagent-brief.md` template (game-versie). Extra context:

- Godot binary path (uit `GODOT_BIN`)
- GUT-tests moeten groen blijven (gate)
- GDScript-specifieke pitfalls (zie `references/gdscript-pitfalls.md`)

**Brief extra clausule:**

```
Werk in worktree {EXP_PATH}.
GDScript-only wijzigingen tenzij scope ook scenes/ bevat.
Performance hypotheses (FPS/frame-time):
  - Object pooling
  - Signal-vs-poll patronen
  - PackedArray ipv Array
  - Static typing toevoegen
  - LOD via visibility/process_mode
  - Batch draw calls
AI hypotheses (winrate):
  - Heuristic weight tuning
  - Decision tree pruning
  - Lookahead depth
Run benchmark per iteratie:
  $GODOT_BIN --headless --path . {benchmark.tscn} --quit-after 120
Parse SCORE= regel.
```

**Worktree-naming:** `optimize/{run-id}/exp_{short-id}` (identiek aan dev-optimize).

**Resultaat-aggregatie:** identiek aan dev-optimize.

### FASE 5: Pick Winner

> **Todo**: markeer FASE 4 → `completed`, FASE 5 → `in_progress`.

Identiek aan `dev-optimize` FASE 5: top-3 tonen, AskUserQuestion, branch behouden, losers opruimen.

### FASE 6: Sync + Report

> **Todo**: markeer FASE 5 → `completed`, FASE 6 → `in_progress`.

Append aan `.project/project.json → optimization_runs[]` (schema in [shared/DASHBOARD.md](../shared/DASHBOARD.md) sectie `optimization_runs`):

```json
{
  "run_id": "{run-id}",
  "skill": "game-optimize",
  "metric": "{metric}",
  "direction": "{direction}",
  "baseline": {baseline},
  "final": {best_score},
  "improvement_pct": {pct},
  "rounds": {N},
  "experiments_kept": {total_kept},
  "experiments_discarded": {total_discarded},
  "winner_branch": "optimize/{run-id}/winner",
  "stopped_reason": "{reason}",
  "date": "{ISO}"
}
```

`stopped_reason` waarden: `stall` | `wallclock` | `user` | `no_improvement`. Append-only — dedup op `run_id`.

Cleanup session-files (`pre-skill-sha.txt`, `active-optimize-{run-id}.json`).

**Display rapport:**

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
GAME-OPTIMIZE COMPLETE: {run-id}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Metric:        {metric} ({direction})
Baseline:      {baseline}
Final:         {best_score}
Improvement:   {improvement_pct}%
Rondes:        {N}
Experimenten:  {kept} kept / {discarded} discarded
Winner:        {winner_branch}

TOP 3 HYPOTHESES (kept):
  1. "..." (Δ {x})
  2. "..." (Δ {y})
  3. "..." (Δ {z})

Next steps:
  1. git checkout {winner_branch} → inspect changes in Godot editor
  2. Open project in editor om visueel te valideren (geen visuele regressie)
  3. /core-commit → bij goedkeuring branch mergen via PR
  4. /game-optimize → nog een run met andere metric
```

> **Todo**: markeer FASE 6 → `completed`.

## Edge Cases

- **Geen GUT installed**: gate is no-op. Subagents kunnen kapotte logica introduceren zonder detectie. Beperk scope strikt of skip game-optimize tot GUT staat.
- **Headless rendering werkt niet** (sommige hosts): voeg `--audio-driver Dummy --rendering-driver opengl3` toe. Bij vello-based shaders: gebruik `forward_plus` met lagere resolutie.
- **Benchmark timeout**: Godot blijft soms hangen. Skill wrapt commando in `timeout 180s`.
- **Worktree + Godot import cache**: elke worktree krijgt eigen `.godot/` cache. Eerste run van een worktree is langzamer (import). Acceptabel: amortizeert over budget-iteraties.
- **AI winrate determinisme**: zorg dat seed in benchmark gefixed is, anders is score-noise te groot voor zinvolle vergelijking. Subagent-brief moet dit benadrukken.
- **Cross-platform path issues**: `res://` paths werken cross-platform, OS-paden in shell scripts moeten via `paths.yaml` of env var.

## Rationale

Zelfde als `dev-optimize`: geen externe `evo-hq-cli` dep, volledige controle, naadloze integratie met `.project/` en GUT. Domein-verschillen (Godot CLI ipv npm, scenes ipv bundle, GUT ipv vitest) zitten alleen in benchmark/gate templates en subagent-brief — de loop-mechaniek is identiek.

Waarom standalone? Game-optimalisatie is meet-driven, niet feature-build. Werkt op bestaande scenes/scripts, niet op een feature in DOING-status.
