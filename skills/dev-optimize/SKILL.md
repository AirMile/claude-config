---
name: dev-optimize
description: Optimaliseer een meetbare metric (bundle size, Lighthouse, coverage, latency) via parallelle subagent-experimenten in git worktrees. Gebruik met /dev-optimize voor performance-, kwaliteit- of bundle-verbeteringen waar je een score kunt definiëren. Standalone — niet gekoppeld aan een feature in de pipeline.
disable-model-invocation: true
metadata:
  author: mileszeilstra
  version: 0.1.0
  category: dev
---

# Optimize

Autonome verbeter-loop: definieer metric → spawn parallelle subagents in worktrees → houd verbeteringen, gooi regressies weg → loop tot stall.

**Trigger**: `/dev-optimize` of `/dev-optimize [auto]`

Geïnspireerd op `evo-hq/evo` autoresearch patroon, geïntegreerd met de `.project/` conventie. Geen externe dependency.

## Input

Geen verplichte input. Alle config wordt interactief opgehaald in FASE 1 of overgenomen uit een eerdere run (resume).

## Output

```
.project/optimize/{run-id}/
├── spec.json          # metric, gate, scope, baseline, parameters
├── tree.json          # nodes (id, parent, branch, score, status, hypotheses)
├── runs/{NNNN}.json   # per-ronde resultaat
└── branches.txt       # cleanup-lijst voor abort
```

Update bij voltooiing: `.project/project.json` → push naar `optimization_runs[]` (zie `shared/DASHBOARD.md`).

## Process

**Fase tracking** — eerste actie: roep `TodoWrite` aan met deze 7 items (status `pending`), markeer per fase `in_progress` aan begin en `completed` aan einde:

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

1. `git status --porcelain` — moet leeg zijn. Als dirty:
   - **AskUserQuestion** (Auto-mode: stash):
     - "Stash changes (Recommended)" — `git stash push -u -m "dev-optimize pre-run"`
     - "Abort" — exit, gebruiker commit zelf eerst
2. Detect default branch:
   ```bash
   DEFAULT_BRANCH=$(git symbolic-ref refs/remotes/origin/HEAD 2>/dev/null | sed 's@^refs/remotes/origin/@@' || echo "main")
   ```
3. Bewaar `BASE_SHA=$(git rev-parse HEAD)` — alle worktrees forken hieruit (of uit een parent-node verderop in de loop).

**Detect tools:**

```bash
node --version 2>/dev/null
npm --version 2>/dev/null
git worktree list --porcelain 2>/dev/null
```

Geen node/npm → exit met "dev-optimize vereist Node + npm in PATH."

**Resume detection:**

Scan `.project/optimize/` voor bestaande run-dirs zonder `runs/final.json`:

- Geen open run → nieuwe run, genereer `RUN_ID=$(date +%Y%m%d-%H%M%S)`.
- ≥1 open run → **AskUserQuestion** (Auto-mode: nieuwe run):
  - "Hervat {oudste-open-run-id}" — laad `spec.json` + `tree.json`, ga naar FASE 4
  - "Nieuwe run starten (Recommended)" — archiveer oude (rename → `{run-id}.aborted/`), maak nieuwe
  - "Bekijk eerst" — toon `git worktree list` + samenvatting per open run, vraag opnieuw

**Auto-mode** (actief bij argument `auto`):

| Beslispunt            | Default                    | Reden                                    |
| --------------------- | -------------------------- | ---------------------------------------- |
| Dirty working tree    | **Stash**                  | Niet de user's changes verliezen         |
| Open run gedetecteerd | **Nieuwe run**             | Vorige is mogelijk halverwege gecrasht   |
| Metric keuze          | **Bundle size** (default)  | Meest universele meting                  |
| Subagents per ronde   | **3**                      | Conservatief, voorkomt resource overload |
| Budget per subagent   | **5 iteraties**            | Zoals evo default                        |
| Stall threshold       | **5 rondes**               | Zoals evo default                        |
| Continue/Stop prompt  | **Continue tot stall**     | Geen gebruiker aanwezig                  |
| Winner-merge          | **Top branch automatisch** | Op nieuwe branch, niet op base           |

Schrijf bij start: `.project/session/active-optimize-{run-id}.json`:

```json
{
  "run_id": "{run-id}",
  "skill": "optimize",
  "startedAt": "{ISO}"
}
```

**Project context** (skip als niet bestaat):

Lees `.project/project.json` voor stack-info en eerdere `optimization_runs[]` (toon laatste 3 als context).

### FASE 1: Define Metric

> **Todo**: markeer FASE 0 → `completed`, FASE 1 → `in_progress`.

Bij resume: skip deze fase, `spec.json` is al gevuld.

**AskUserQuestion 1 — wat optimaliseren?** (Auto-mode: bundle size)

```yaml
header: "Metric"
question: "Wat wil je optimaliseren?"
options:
  - label: "Bundle size (Recommended)"
    description: "kB van production build (npm run build → dist/)"
  - label: "Lighthouse score"
    description: "Performance/A11y/Best-Practices/SEO via Lighthouse CLI"
  - label: "Test coverage"
    description: "% covered lines/branches via vitest --coverage of jest --coverage"
  - label: "API latency"
    description: "p95 ms via ab/wrk tegen lokale server"
multiSelect: false
```

(Custom optie via "Other" → vraag follow-up: benchmark command + score-extractie regex.)

**AskUserQuestion 2 — richting** (Auto-mode: minimize voor size/latency, maximize voor coverage/lighthouse):

```yaml
header: "Richting"
question: "Lager of hoger is beter?"
options:
  - label: "Lager is beter (minimize)"
  - label: "Hoger is beter (maximize)"
multiSelect: false
```

**AskUserQuestion 3 — scope** (Auto-mode: hele `src/`):

```yaml
header: "Scope"
question: "Welke directories mogen subagents wijzigen?"
options:
  - label: "src/ (Recommended)"
  - label: "src/ + package.json"
    description: "Sta dependency-swaps toe (pas op: kan tests breken)"
  - label: "Heel project (incl. config)"
  - label: "Custom paths"
multiSelect: false
```

**AskUserQuestion 4 — loop parameters** (Auto-mode: defaults). De keuze bepaalt ook welk subagent-model gebruikt wordt:

```yaml
header: "Parameters"
question: "Hoe agressief mag de loop draaien?"
options:
  - label: "Conservatief: 3 agents × 5 iter, stall 5, 60min cap, sonnet (Recommended)"
    description: "Goedkoop en snel. Geschikt voor de meeste use cases."
  - label: "Standaard: 5 agents × 5 iter, stall 5, 90min cap, sonnet"
  - label: "Aggressief: 8 agents × 8 iter, stall 8, 180min cap, opus"
    description: "Veel meer compute en duurder model — alleen voor lange, lastige problemen."
multiSelect: false
```

Mapping:

| Keuze        | subagents | budget | stall | wallclock | model    |
| ------------ | --------- | ------ | ----- | --------- | -------- |
| Conservatief | 3         | 5      | 5     | 60 min    | `sonnet` |
| Standaard    | 5         | 5      | 5     | 90 min    | `sonnet` |
| Aggressief   | 8         | 8      | 8     | 180 min   | `opus`   |

**Schrijf `.project/optimize/{run-id}/spec.json`:**

```json
{
  "run_id": "{run-id}",
  "metric": "bundle_size_kb",
  "direction": "minimize",
  "scope_paths": ["src/"],
  "subagents_per_round": 3,
  "budget_per_subagent": 5,
  "stall_threshold": 5,
  "max_wallclock_minutes": 60,
  "subagent_model": "sonnet",
  "run_started_at": null,
  "benchmark_cmd": "bash .project/optimize/{run-id}/benchmark.sh",
  "gate_cmd": "bash .project/optimize/{run-id}/gate.sh",
  "baseline": null,
  "base_sha": "{BASE_SHA}",
  "default_branch": "{DEFAULT_BRANCH}"
}
```

### FASE 2: Instrument Benchmark

> **Todo**: markeer FASE 1 → `completed`, FASE 2 → `in_progress`.

**Stap 1 — kopieer template:**

Kopieer benchmark template naar `.project/optimize/{run-id}/benchmark.sh`. Templates per metric:

| Metric      | Template path                           |
| ----------- | --------------------------------------- |
| bundle_size | `references/benchmarks/bundle-size.sh`  |
| lighthouse  | `references/benchmarks/lighthouse.sh`   |
| coverage    | `references/benchmarks/coverage.sh`     |
| latency     | `references/benchmarks/latency.sh`      |
| custom      | minimal stub die `echo SCORE=<n>` print |

Templates printen één regel `SCORE=<float>` op stdout. Skill parsed laatste `SCORE=` regel.

**Stap 2 — gate script:**

Default `references/gates/tests-green.sh` → kopieer naar `.project/optimize/{run-id}/gate.sh`. Detecteer test-commando via `package.json scripts.test`. Geen `test` script → toon waarschuwing en gebruik `:` (no-op gate).

**Stap 3 — review + edit:**

Toon beide scripts, vraag via **AskUserQuestion** (Auto-mode: Run as-is):

```yaml
header: "Scripts"
question: "Klopt benchmark.sh en gate.sh?"
options:
  - label: "Run as-is (Recommended)"
  - label: "Edit eerst"
    description: "Open in editor, daarna verder"
  - label: "Abort"
multiSelect: false
```

"Edit eerst" → toon paths, wacht tot user terugkomt, dan re-prompt.

`chmod +x` op beide scripts.

### FASE 3: Baseline Run

> **Todo**: markeer FASE 2 → `completed`, FASE 3 → `in_progress`.

```bash
cd "$(git rev-parse --show-toplevel)"

# Gate eerst (faalt → abort, repo is niet healthy)
if ! bash .project/optimize/{run-id}/gate.sh; then
  echo "BASELINE GATE FAIL: fix tests eerst"
  exit 1
fi

# Benchmark
BASELINE=$(bash .project/optimize/{run-id}/benchmark.sh | grep -E '^SCORE=' | tail -1 | cut -d= -f2)
```

Schrijf `runs/0000.json`:

```json
{
  "round": 0,
  "type": "baseline",
  "score": 1234.5,
  "branch": "{DEFAULT_BRANCH}",
  "sha": "{BASE_SHA}",
  "timestamp": "{ISO}"
}
```

Update `spec.json.baseline = <score>`.

Initialiseer `tree.json`:

```json
{
  "nodes": [
    {
      "id": "root",
      "parent": null,
      "branch": "{DEFAULT_BRANCH}",
      "sha": "{BASE_SHA}",
      "score": 1234.5,
      "status": "baseline",
      "hypotheses_tried": []
    }
  ],
  "rounds": []
}
```

**Display + kostenraming** (na baseline, vóór de loop start):

Bereken op basis van de werkelijk gemeten baseline-tijd:

```
BENCHMARK_SECONDS = werkelijke duur van baseline benchmark.sh
GATE_SECONDS      = werkelijke duur van baseline gate.sh
PER_ITER_SECONDS  = BENCHMARK_SECONDS + GATE_SECONDS + 10  # 10s overhead voor edit
TOTAL_ITERS       = subagents_per_round × budget_per_subagent × stall_threshold  # worst-case
TOTAL_MINUTES     = (TOTAL_ITERS × PER_ITER_SECONDS) / 60

# Token kosten ruwe schatting (Claude pricing april 2026):
# sonnet: ~$0.15 per iteratie (50k input + 5k output)
# opus:   ~$0.75 per iteratie
TOKEN_COST_PER_ITER  = 0.15 als spec.subagent_model == "sonnet" else 0.75
TOTAL_DOLLARS        = TOTAL_ITERS × TOKEN_COST_PER_ITER
```

Display:

```
BASELINE: {metric} = {score} ({direction})
Repo healthy, gate green.

KOSTENRAMING (worst-case):
- {subagents} agents × {budget} iter × {stall} rondes = {TOTAL_ITERS} agent-iteraties
- ~{PER_ITER_SECONDS}s per iteratie ({BENCHMARK_SECONDS}s benchmark + {GATE_SECONDS}s gate)
- Geschatte tijd: ~{TOTAL_MINUTES} min (capped op {max_wallclock_minutes} min)
- Geschatte cost: ~${TOTAL_DOLLARS} ({subagent_model})
```

**AskUserQuestion** (Auto-mode: bij `TOTAL_DOLLARS > 10` OR `TOTAL_MINUTES > 120` → abort, anders door):

```yaml
header: "Doorgaan?"
question: "Klopt deze schatting? Doorgaan met de loop?"
options:
  - label: "Doorgaan (Recommended)"
  - label: "Verlaag budget"
    description: "Terug naar FASE 1 voor lagere subagents/budget/stall"
  - label: "Abort"
multiSelect: false
```

"Verlaag budget" → FASE 1 AskUserQuestion 4 opnieuw, recompute spec.json + raming, terug naar FASE 3 display.

**Markeer run-start**:

```bash
# Schrijf timestamp voor wallclock-cap
NOW_ISO=$(date -u +%Y-%m-%dT%H:%M:%SZ)
# Update spec.json: run_started_at = NOW_ISO
```

### FASE 4: Optimize Loop

> **Todo**: markeer FASE 3 → `completed`, FASE 4 → `in_progress`.

Initialiseer `ROUND=1`, `STALL_COUNT=0`, `BEST_SCORE=baseline`.

**Per ronde:**

#### Stap a — Selecteer parents

Lees `tree.json`. Filter nodes met `status in ["baseline", "kept"]`. Sorteer op score (richting). Doel: pak K = `subagents_per_round` parents.

**Selectie-regel** (mechanisch, geen file-overlap berekening):

```
candidates = nodes met status in ["baseline", "kept"], gesorteerd op score
parent_ids_in_last_2_rounds = set van node-ids die parent waren in runs[N-1] of runs[N-2]

parents = []
for c in candidates:
  if len(parents) >= K: break
  if c.id in parent_ids_in_last_2_rounds: continue   # diversiteit afdwingen
  parents.append(c)

# Fallback: als <K candidates voldoen aan filter (vroege rondes of kleine boom),
# vul aan met de best-scorende beschikbare candidates zonder filter
while len(parents) < K and remaining_candidates:
  parents.append(next_best_candidate)
```

Resultaat: dezelfde node kan niet 2× achter elkaar parent zijn — de boom blijft breed in plaats van te convergeren naar één pad. Geen string- of file-overlap analyse nodig.

**Wallclock cap check** (zie Fix 1 in v0.1.1): bereken `elapsed_minutes = (now - run_started_at) / 60`. Als `elapsed_minutes >= max_wallclock_minutes` → break naar FASE 5 met `stopped_reason = "wallclock"`.

#### Stap b — Spawn subagents (parallel)

Voor elke parent: bouw brief en spawn agent.

**Brief samenstellen** (per subagent):

Lees `references/subagent-brief.md` template. Vul placeholders:

- `{run_id}`, `{metric}`, `{direction}`, `{scope_paths}`
- `{parent_sha}`, `{parent_score}`
- `{budget}` = `budget_per_subagent`
- `{benchmark_cmd}`, `{gate_cmd}`
- `{failed_hypotheses}` = unie van alle `hypotheses_tried[]` uit tree, dedup op string-gelijkheid (case-insensitive, trim whitespace). Geen cap — pass alles. Eén hypothese per regel in de brief.
- `{best_score_so_far}` voor context
- `{branch_name}` = `optimize/{run-id}/exp_{short-id}` waar short-id = `printf "r%02d_p%02d_$(openssl rand -hex 2)" $ROUND $PARENT_IDX`

**Worktree creëren** (orchestrator-side, niet in agent):

```bash
EXP_BRANCH="optimize/{run-id}/exp_{short-id}"
EXP_PATH=".project/optimize/{run-id}/worktrees/exp_{short-id}"
git worktree add -b "$EXP_BRANCH" "$EXP_PATH" "$PARENT_SHA"
echo "$EXP_BRANCH" >> .project/optimize/{run-id}/branches.txt
```

**Spawn Agent** met `subagent_type: general-purpose`, `run_in_background: true`, `model: <spec.subagent_model>` (default `sonnet`, `opus` alleen bij Aggressief), prompt = brief + extra:

```
Werk uitsluitend binnen worktree: {EXP_PATH}
Branch: {EXP_BRANCH}
Cd er eerst heen. Commit op deze branch alleen jouw eigen wijzigingen.

Max iteraties: {budget}.

Per iteratie:
1. Verzin een hypothese die {metric} kan verbeteren binnen scope: {scope_paths}.
   Niet uit deze lijst (al geprobeerd of mislukt): {failed_hypotheses}
2. Pas code aan.
3. Run: {gate_cmd}. Faalt? Revert je wijzigingen, probeer iets anders.
4. Run: {benchmark_cmd}. Parse SCORE=.
5. Score verbeterd t.o.v. {parent_score} ({direction})?
   Ja → git commit -am "exp: <hypothese>". Mag nog iteraties doen op deze branch.
   Nee → revert, volgende iteratie. Tel geen commit.

Stop bij: budget op, of 3 iteraties achter elkaar geen verbetering, of niet meer kunnen bedenken.

Return als regel-gebaseerde key=value tussen markers (zie subagent-brief.md voor volledig formaat):
EXPERIMENT_RESULT_START
RESULT_BRANCH={EXP_BRANCH}
RESULT_BEST_SCORE=<float of leeg>
RESULT_BEST_SHA=<sha of leeg>
RESULT_ITERATIONS_USED=<int>
RESULT_WINNING_HYPOTHESIS=<one-liner of leeg>
RESULT_NOTES=<max 200 chars>
RESULT_TRIED_1=<hypothese>
RESULT_TRIED_2=<hypothese>
EXPERIMENT_RESULT_END
```

**Spawn alle K agents in één bericht** (run_in_background: true) zodat ze parallel draaien.

#### Stap c — Verzamel resultaten

Per agent: parse `EXPERIMENT_RESULT_*` blok. Robuuste regel-parser:

```bash
# Extract block between markers, dan grep per key
BLOCK=$(echo "$AGENT_OUTPUT" | sed -n '/EXPERIMENT_RESULT_START/,/EXPERIMENT_RESULT_END/p')
BRANCH=$(echo "$BLOCK" | grep -E '^RESULT_BRANCH=' | head -1 | cut -d= -f2-)
BEST_SCORE=$(echo "$BLOCK" | grep -E '^RESULT_BEST_SCORE=' | head -1 | cut -d= -f2-)
BEST_SHA=$(echo "$BLOCK" | grep -E '^RESULT_BEST_SHA=' | head -1 | cut -d= -f2-)
WINNING=$(echo "$BLOCK" | grep -E '^RESULT_WINNING_HYPOTHESIS=' | head -1 | cut -d= -f2-)
# Hypothesen-lijst: alle RESULT_TRIED_N regels, in volgorde
TRIED=$(echo "$BLOCK" | grep -E '^RESULT_TRIED_[0-9]+=' | cut -d= -f2-)
```

Lege `RESULT_BEST_SCORE` of marker-blok ontbreekt → behandel als `discarded`, log `notes: "agent returned no result"`.

Voor elk resultaat:

**Verbetering ten opzichte van parent:**

```
improved = (direction == "minimize" && best_score < parent_score) ||
           (direction == "maximize" && best_score > parent_score)
```

**Verbeterd:**

- Status `kept`. Append node aan `tree.json`:
  ```json
  {
    "id": "exp_{short-id}",
    "parent": "{parent-id}",
    "branch": "{EXP_BRANCH}",
    "sha": "{best_sha}",
    "score": {best_score},
    "status": "kept",
    "hypotheses_tried": [...]
  }
  ```
- Behoud worktree (mogelijk parent in volgende ronde).

**Niet verbeterd of gate gefaald:**

- Status `discarded`. Append node met `status: "discarded"`.
- Ruim worktree op:
  ```bash
  git worktree remove --force "$EXP_PATH"
  git branch -D "$EXP_BRANCH" 2>/dev/null
  ```

**Append `hypotheses_tried` van álle agents** (winners + losers) aan globale lijst — voorkomt herhaling in volgende rondes.

**Schrijf `runs/{NNNN}.json`** (NNNN = ronde, zero-padded):

```json
{
  "round": 1,
  "parents": ["root"],
  "experiments": [
    { "id": "exp_r01_p00_abcd", "score": 230.1, "status": "kept", "hypothesis": "..." },
    ...
  ],
  "best_score_after": 230.1,
  "stall_count": 0,
  "timestamp": "{ISO}"
}
```

#### Stap d — Stall check

```
NEW_BEST = best score over alle "kept" nodes in tree
if NEW_BEST verbeterd t.o.v. BEST_SCORE_PRE_RONDE:
  BEST_SCORE = NEW_BEST
  STALL_COUNT = 0
else:
  STALL_COUNT += 1
  if STALL_COUNT >= stall_threshold:
    break # naar FASE 5
```

#### Stap e — Continue prompt

Na elke ronde, **AskUserQuestion** (Auto-mode: skip = continue):

```yaml
header: "Volgende ronde?"
question: "Ronde {N} klaar. Beste score: {best}. Doorgaan?"
options:
  - label: "Continue (Recommended)"
  - label: "Stop nu, kies winner"
  - label: "Adjust budget"
    description: "Verhoog/verlaag agents of iteraties"
multiSelect: false
```

"Adjust budget" → follow-up vragen, update spec.json, ga door.

`ROUND++`, ga naar Stap a.

### FASE 5: Pick Winner

> **Todo**: markeer FASE 4 → `completed`, FASE 5 → `in_progress`.

Lees `tree.json`, sorteer alle `kept` nodes op score (richting). Toon top-3:

```
TOP BRANCHES:
  1. exp_r03_p01_a1b2 — score {x} (Δ {improvement}, {commits} commits, {files} files)
     Hypothese: "..."
  2. ...
  3. ...
```

**AskUserQuestion** (Auto-mode: top branch):

```yaml
header: "Winner"
question: "Welke branch wil je behouden?"
options:
  - label: "Top branch (Recommended)"
  - label: "Tweede branch"
  - label: "Derde branch"
  - label: "Geen — losers opruimen, niets mergen"
multiSelect: false
```

**Voor de gekozen winner:**

```bash
WINNER_BRANCH="optimize/{run-id}/exp_{id}"
TARGET_BRANCH="optimize/{run-id}/winner"
git branch "$TARGET_BRANCH" "$WINNER_BRANCH"
```

NIET mergen naar default branch — user reviewt zelf via PR/merge.

**Cleanup losers:**

```bash
while read -r BR; do
  if [ "$BR" != "$WINNER_BRANCH" ]; then
    WT_PATH=".project/optimize/{run-id}/worktrees/$(basename "$BR" | sed 's@.*/@@')"
    git worktree remove --force "$WT_PATH" 2>/dev/null
    git branch -D "$BR" 2>/dev/null
  fi
done < .project/optimize/{run-id}/branches.txt
```

Behoud de winner-worktree zodat user direct kan inspecteren.

### FASE 6: Sync + Report

> **Todo**: markeer FASE 5 → `completed`, FASE 6 → `in_progress`.

**Append aan `.project/project.json`** onder `optimization_runs[]` (schema in [shared/DASHBOARD.md](../shared/DASHBOARD.md) sectie `optimization_runs`):

```json
{
  "run_id": "{run-id}",
  "skill": "dev-optimize",
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

`stopped_reason` waarden: `stall` | `wallclock` | `user` | `no_improvement`.

Als `optimization_runs[]` veld nog niet bestaat: maak aan met dit als enige entry. Append-only — dedup op `run_id` zodat re-runs van dezelfde skill niet duplicaten produceren.

**Schrijf `runs/final.json`** (signaleert: deze run is klaar):

```json
{
  "run_id": "{run-id}",
  "completed_at": "{ISO}",
  "winner_branch": "...",
  "stats": { ... }
}
```

**Cleanup session:**

```bash
rm -f .project/session/active-optimize-{run-id}.json
rm -f .project/session/pre-skill-sha.txt
```

Bij gestashed work: stash list tonen → user kiest pop.

**Display rapport (ASCII tabel):**

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
DEV-OPTIMIZE COMPLETE: {run-id}
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
  1. git checkout {winner_branch} → inspect changes
  2. git diff {default_branch}..{winner_branch}
  3. /core-commit → bij goedkeuring branch mergen via PR
  4. /dev-optimize → nog een run met andere metric
```

> **Todo**: markeer FASE 6 → `completed`. Alle 7 fases moeten nu `completed` zijn.

## Edge Cases

- **Geen testsuite (geen `npm test`)**: gate is no-op. Waarschuw dat subagents tests kunnen breken zonder detectie. Gebruik strikt scope om risk te beperken.
- **Worktree disk-vol**: detecteer ENOSPC bij `git worktree add` → abort, ruim losers op, verlaag `subagents_per_round`.
- **Subagent timeout / crash**: behandel als `discarded`, log `notes: "agent timeout"`.
- **Cyclic improvement** (score oscilleert): de diversity filter in Stap a voorkomt dat je dezelfde edits blijft proberen via verschillende parents.
- **Pre-existing failing tests**: gate faalt op baseline → abort vóór de loop. User moet eerst tests groen maken.
- **Auto-mode zonder gebruiker beschikbaar**: alle prompts gebruiken defaults, run draait zelfstandig tot stall.

## Rationale

Waarom geen externe `evo-hq-cli` dep? Volgens plan: volledige controle, geen Python tool-install vereist, naadloze integratie met `.project/` en bestaande pipeline-conventies. De prijs: tree search v1 = greedy met diversiteit (geen full backtrack-search). Toereikend voor alle bedoelde use cases (bundle/coverage/latency).

Waarom standalone (niet in pipeline)? Optimize is geen feature-build maar een meet-driven verbeter-cyclus. Werkt op bestaande code, niet op een feature in DOING-status.
