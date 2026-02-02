# Unity Game Documentation Generators

## Overview
Documentation generators specifically for Unity game engine projects (C# scripts, scenes, prefabs).

---

## Generators for Unity Projects

### 1. **update_scenes.py**
**Output:** `docs/scenes.mmd`

**Scans:**
- `Assets/Scenes/*.unity` files
- Scene hierarchy (GameObjects)
- Component attachments
- Prefab instances

**Generates:**
```mermaid
graph TD
  MainScene[Scene: MainLevel]

  MainScene --> Player[Player GameObject]
  MainScene --> Environment
  MainScene --> GameManager
  MainScene --> UI[UI Canvas]

  Player --> PlayerModel[Mesh Renderer]
  Player --> PlayerController[PlayerController Script]
  Player --> Rigidbody

  Environment --> Terrain
  Environment --> Buildings[Buildings Container]
  Buildings --> House1[House Prefab Instance]
  Buildings --> House2[House Prefab Instance]

  UI --> HealthBar
  UI --> ScoreText
```

**Implementation Notes:**
- Parse `.unity` scene files (YAML format)
- Extract GameObject hierarchy
- Show attached components (scripts, renderers, colliders)
- Mark prefab instances vs regular GameObjects
- Show parent-child relationships
- Color-code: Player, Environment, UI, Managers, Prefabs

---

### 2. **update_game_classes.py**
**Output:** `docs/game-classes.mmd`

**Scans:**
- `Assets/Scripts/**/*.cs`
- Class definitions and inheritance
- MonoBehaviour classes
- ScriptableObject classes
- Interfaces and abstract classes

**Generates:**
```mermaid
classDiagram
  MonoBehaviour <|-- Player
  MonoBehaviour <|-- Enemy
  MonoBehaviour <|-- GameManager

  Player --> PlayerController : uses
  Player --> Inventory : has
  Player --> Weapon : equipped

  Enemy <|-- MeleeEnemy
  Enemy <|-- RangedEnemy

  Weapon <|-- Sword
  Weapon <|-- Bow

  class Player {
    +int health
    +float speed
    +Inventory inventory
    +Move()
    +Attack()
    +TakeDamage()
  }
```

**Implementation Notes:**
- Parse C# class definitions
- Extract: classes, fields, methods, properties
- Detect inheritance (`class Player : MonoBehaviour`)
- Show composition (`has`, `uses`, `equipped`)
- Identify MonoBehaviour vs regular classes
- Extract public fields (Inspector-visible)

---

### 3. **update_state_machines.py**
**Output:** `docs/state-machines.mmd`

**Scans:**
- Animator Controllers (`*.controller`)
- State machine scripts (custom implementations)
- Enemy AI states
- Player states

**Generates:**
```mermaid
stateDiagram-v2
  [*] --> Idle

  Idle --> Walking : Move Input
  Idle --> Jumping : Jump Input
  Idle --> Attacking : Attack Input

  Walking --> Running : Sprint
  Walking --> Idle : No Input

  Jumping --> Falling : Apex
  Falling --> Landing : Ground
  Landing --> Idle

  Attacking --> Idle : Complete
```

**Implementation Notes:**
- Parse Animator Controller files (YAML)
- Extract states, transitions, parameters
- Detect custom state machine scripts
- Show trigger conditions
- Map state → animation clips
- Support multiple state machines (Player, Enemy, Boss)

---

## Priority Implementation

1. **HIGH:** `update_scenes.py` - Scene hierarchy
2. **HIGH:** `update_game_classes.py` - C# class diagram
3. **MEDIUM:** `update_state_machines.py` - AI states

---

## Unity Project Detection

**Markers:**
- `Assets/` folder exists
- `ProjectSettings/` folder exists
- `*.csproj` files (Unity-generated)
- `Packages/manifest.json` exists

---

*Planning document - Not yet implemented*
