# Architecture Decision Tree

Beslisboom voor Godot 4.x architectuurkeuzes. Gebruik tijdens FASE 3 (implementatie) wanneer je kiest hoe data, gedrag, en communicatie te structureren.

## Data Opslag

| Wanneer                            | Patroon                   | Voorbeeld                           |
| ---------------------------------- | ------------------------- | ----------------------------------- |
| Statisch, gedeeld tussen instances | Custom Resource (`.tres`) | `AbilityData`, `EnemyStats`         |
| Per-instance, editor-tunable       | `@export` variabele       | `move_speed`, `max_health`          |
| Per-instance, groep configuratie   | `@export` Resource        | `@export var stats: CharacterStats` |
| Runtime-only, transient            | Gewone variabele          | `_current_health`, `_dash_timer`    |
| Globale state, cross-scene         | Autoload (spaarzaam)      | `GameState`, `EventBus`             |

**Vuistregel:** als het in de Inspector moet verschijnen → `@export`. Als meerdere nodes dezelfde data delen → Resource. Als het alleen runtime bestaat → gewone var.

## Gedrag & Architectuur

| Wanneer                        | Patroon                    | Voorbeeld                            |
| ------------------------------ | -------------------------- | ------------------------------------ |
| Gedeeld gedrag over node types | Component (child node)     | `HealthComponent`, `HitboxComponent` |
| IS-A relatie (zelden)          | Inheritance                | `EnemyBase` → `EnemyMelee`           |
| Variatie in data, niet gedrag  | Resource + generiek script | `Ability.gd` + `fire_blast.tres`     |

**Vuistregel:** als je twijfelt tussen inheritance en composition → composition. Inheritance alleen bij echte IS-A relaties waar de subclass gedrag OVERSCHRIJFT, niet alleen data varieert.

## Communicatie

| Wanneer                        | Patroon                 | Voorbeeld                                 |
| ------------------------------ | ----------------------- | ----------------------------------------- |
| Kind → ouder (1:1)             | Signal op kind          | `health_changed.emit()`                   |
| Cross-system, losjes gekoppeld | Signal (direct connect) | `player.died.connect(ui._on_player_died)` |
| Cross-scene, >5 verbindingen   | EventBus Autoload       | `EventBus.score_changed.emit(score)`      |
| Ouder → kind (1:1, direct)     | Methode-aanroep         | `health_component.apply_damage(10)`       |

**Vuistregels:**

- Signals stromen OMHOOG (kind → ouder). Methode-aanroepen stromen OMLAAG (ouder → kind).
- Componenten communiceren NOOIT via `get_parent()` of `get_node("../../")` — altijd via signals omhoog.
- EventBus alleen als >5 nodes naar dezelfde event luisteren OF de emitter en receiver in verschillende scenes zitten.

## Anti-patronen

- `get_parent().get_parent().do_thing()` → gebruik signal of exported NodePath
- Gameplay logica in Autoload → kan niet getest/geïnstantieerd worden
- Inheritance piramide (>2 niveaus) → decomposeer naar componenten
- Untyped Dictionary als data container → maak een Resource class
