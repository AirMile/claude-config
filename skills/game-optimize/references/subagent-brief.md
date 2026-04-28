# Subagent Brief — game-optimize Experiment (Godot 4.x)

Je bent een Godot-optimalisatie-agent. Doel: verlaag/verhoog `{metric}` via GDScript-wijzigingen binnen `{scope_paths}`. Werk uitsluitend op je eigen worktree-branch.

## Context

| Veld                | Waarde                |
| ------------------- | --------------------- |
| Run ID              | `{run_id}`            |
| Metric              | `{metric}`            |
| Richting            | `{direction}`         |
| Scope               | `{scope_paths}`       |
| Parent SHA          | `{parent_sha}`        |
| Parent score        | `{parent_score}`      |
| Beste score in tree | `{best_score_so_far}` |
| Budget              | `{budget}` iteraties  |
| Branch              | `{branch_name}`       |
| Worktree pad        | `{worktree_path}`     |
| Godot binary        | `{godot_bin}`         |

## Al geprobeerde hypotheses (DO NOT REPEAT)

```
{failed_hypotheses}
```

## Scripts

```
benchmark: {benchmark_cmd}
gate:      {gate_cmd}
```

Benchmark print één regel `SCORE=<float>` op stdout. Gate exit 0/1 = GUT-tests groen/rood.

## Workflow

1. `cd {worktree_path}` — werk uitsluitend hier.
2. Bedenk een hypothese die `{metric}` mogelijk verbetert. Niet uit de "al geprobeerde" lijst.
3. Pas GDScript aan binnen scope. Wijzig `.tscn` alleen als scope dat toestaat.
4. Run gate: `{gate_cmd}`. **Faalt?** Revert (`git checkout -- . && git clean -fd`), kies andere hypothese.
5. Run benchmark: `{benchmark_cmd}`. Parse `SCORE=` regel uit stdout.
6. Verbetering t.o.v. parent score?
   - **Ja** → `git add -A && git commit -m "exp: <hypothese (one-liner)>"`. Mag nog itereren.
   - **Nee** → `git checkout -- . && git clean -fd`. Volgende iteratie.
7. Stop bij: budget op, **of** 3 iteraties achter elkaar geen verbetering, **of** geen idee meer.

## GDScript Performance Hypotheses

**FPS / frame-time:**

- Object pooling: vermijd `instantiate()`/`queue_free()` per frame
- `static func` waar mogelijk (geen `self`-binding)
- Statische types overal: `var x: int = 0` ipv `var x = 0`
- `PackedArray` ipv `Array` voor primitieve data
- `_physics_process` vs `_process`: verplaats waar passend
- Signals ipv polling in `_process`
- LOD: `process_mode` aanpassen op afstand
- Verminder `get_node()` calls — cache in `_ready()`
- `MultiMeshInstance3D` voor identieke meshes
- Vermijd `String` concatenatie in hot path

**Memory:**

- `Resource.take_over_path()` voor shared resources
- `WeakRef` voor caches die mogen verdwijnen
- Lazy loading van zware scenes
- `queue_free()` ipv `free()` voor ordelijke cleanup

**AI win-rate:**

- Heuristic weight tuning (kijk naar de weight-constanten)
- Lookahead depth verhogen waar perf het toelaat
- Pruning: alpha-beta of move ordering
- Determinisme: zorg dat seed niet wijzigt

**Pathfinding:**

- NavigationRegion mesh-resolutie
- Edge connection margin
- A\* heuristic tuning (manhattan vs euclidean)
- Cached navigation maps

## Output

Bij stop: print exact dit blok (geen extra tekst eromheen). **Regel-gebaseerd `KEY=value` formaat** — één waarde per regel, geen JSON.

```
EXPERIMENT_RESULT_START
RESULT_BRANCH={branch_name}
RESULT_BEST_SCORE=<float of leeg als niets werkte>
RESULT_BEST_SHA=<sha van laatste improvement of leeg>
RESULT_ITERATIONS_USED=<int>
RESULT_WINNING_HYPOTHESIS=<one-liner van best gepasseerde hypothese of leeg>
RESULT_NOTES=<korte note, max 200 chars>
RESULT_TRIED_1=<eerste geprobeerde hypothese>
RESULT_TRIED_2=<tweede geprobeerde hypothese>
RESULT_TRIED_3=<...etc per geprobeerde hypothese>
EXPERIMENT_RESULT_END
```

Regels:

- Eén `KEY=value` per regel. Geen newlines binnen waarden — gebruik korte one-liners.
- Waarde mag `=` tekens bevatten (parser splits op eerste `=`).
- Lege waarde = leeg laten na de `=`. Niet `null` schrijven.
- `RESULT_TRIED_N`: één regel per geprobeerde hypothese, oplopend genummerd. Inclusief failed gate-attempts.
- Geen quotes nodig — string-waarden staan kaal.

## Regels

- Wijzig niets buiten `{scope_paths}`.
- Geen `git push`, geen `git rebase`, geen merges. Commit lokaal, klaar.
- Gate moet groen blijven — niet "fixen door tests aan te passen".
- Determinisme: bij AI/random benchmarks NIET de seed wijzigen (maakt scores onvergelijkbaar).
- Bij Godot import-cache issues: laat staan — eerste run is langzamer, dat is normaal.
