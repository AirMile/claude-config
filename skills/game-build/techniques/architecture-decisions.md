# Architecture Decision Tree

Decision tree for Godot 4.x architecture choices. Use during PHASE 3 (implementation) when choosing how to structure data, behavior, and communication.

## Data Storage

| When                              | Pattern                   | Example                             |
| --------------------------------- | ------------------------- | ----------------------------------- |
| Static, shared between instances  | Custom Resource (`.tres`) | `AbilityData`, `EnemyStats`         |
| Per-instance, editor-tunable      | `@export` variable        | `move_speed`, `max_health`          |
| Per-instance, group configuration | `@export` Resource        | `@export var stats: CharacterStats` |
| Runtime-only, transient           | Regular variable          | `_current_health`, `_dash_timer`    |
| Global state, cross-scene         | Autoload (sparingly)      | `GameState`, `EventBus`             |

**Rule of thumb:** if it needs to appear in the Inspector → `@export`. If multiple nodes share the same data → Resource. If it only exists at runtime → regular var.

## Behavior & Architecture

| When                              | Pattern                   | Example                              |
| --------------------------------- | ------------------------- | ------------------------------------ |
| Shared behavior across node types | Component (child node)    | `HealthComponent`, `HitboxComponent` |
| IS-A relationship (rarely)        | Inheritance               | `EnemyBase` → `EnemyMelee`           |
| Variation in data, not behavior   | Resource + generic script | `Ability.gd` + `fire_blast.tres`     |

**Rule of thumb:** when in doubt between inheritance and composition → composition. Inheritance only for true IS-A relationships where the subclass OVERRIDES behavior, not just varies data.

## Communication

| When                          | Pattern                 | Example                                   |
| ----------------------------- | ----------------------- | ----------------------------------------- |
| Child → parent (1:1)          | Signal on child         | `health_changed.emit()`                   |
| Cross-system, loosely coupled | Signal (direct connect) | `player.died.connect(ui._on_player_died)` |
| Cross-scene, >5 connections   | EventBus Autoload       | `EventBus.score_changed.emit(score)`      |
| Parent → child (1:1, direct)  | Method call             | `health_component.apply_damage(10)`       |

**Rules of thumb:**

- Signals flow UP (child → parent). Method calls flow DOWN (parent → child).
- Components NEVER communicate via `get_parent()` or `get_node("../../")` — always via signals upward.
- EventBus only when >5 nodes listen to the same event OR the emitter and receiver are in different scenes.

## Anti-patterns

- `get_parent().get_parent().do_thing()` → use signal or exported NodePath
- Gameplay logic in Autoload → cannot be tested/instantiated
- Inheritance pyramid (>2 levels) → decompose into components
- Untyped Dictionary as data container → create a Resource class
