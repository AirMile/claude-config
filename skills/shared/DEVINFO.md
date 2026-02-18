# DevInfo Session Tracking

Session state tracking specificatie voor cross-skill coördinatie. Gebaseerd op Agiflow's devInfo pattern.

---

## Purpose

Track progress across skill invocations binnen een sessie:

- **Progress tracking**: Welke taken zijn klaar, welke lopen
- **File tracking**: Welke bestanden zijn gemaakt/gewijzigd
- **Cross-skill handoff**: Data doorgeven tussen skills

> **Note:** Rollback wordt afgehandeld door Claude Code's ingebouwde "Rewind" functie.

**Storage locatie:** `.workspace/session/devinfo.json`

---

## Schema

```json
{
  "$schema": "DevInfo Session Schema v1",
  "sessionId": "uuid-v4",
  "startedAt": "2024-01-15T10:30:00Z",
  "lastUpdatedAt": "2024-01-15T11:45:00Z",

  "workflow": {
    "name": "frontend-pipeline",
    "description": "Theme → Compose → Build"
  },

  "currentSkill": {
    "name": "frontend-compose",
    "phase": "FASE_2",
    "startedAt": "2024-01-15T10:45:00Z"
  },

  "executionPlan": [
    {
      "skill": "frontend-theme",
      "status": "completed",
      "startedAt": "2024-01-15T10:30:00Z",
      "completedAt": "2024-01-15T10:44:00Z",
      "output": {
        "file": ".workspace/config/THEME.md",
        "preset": "Anthropic Style"
      }
    },
    {
      "skill": "frontend-compose",
      "status": "in_progress",
      "startedAt": "2024-01-15T10:45:00Z",
      "completedAt": null,
      "input": {
        "page": "dashboard",
        "platform": "desktop",
        "atomicLevel": "organism"
      }
    },
    {
      "skill": "frontend-build",
      "status": "pending",
      "startedAt": null,
      "completedAt": null
    }
  ],

  "progress": {
    "completedTasks": 4,
    "totalTasks": 8,
    "currentTask": "Generate Rich wireframe v1",
    "taskHistory": [
      { "task": "Create THEME.md", "status": "completed", "duration": 120 },
      {
        "task": "Gather wireframe requirements",
        "status": "completed",
        "duration": 180
      },
      {
        "task": "Generate UX wireframe v1",
        "status": "completed",
        "duration": 45
      },
      {
        "task": "Generate Minimal wireframe v1",
        "status": "completed",
        "duration": 42
      }
    ]
  },

  "files": {
    "created": [
      {
        "path": ".workspace/config/THEME.md",
        "skill": "frontend-theme",
        "timestamp": "2024-01-15T10:44:00Z"
      },
      {
        "path": ".workspace/wireframes/dashboard/ux/v1.html",
        "skill": "frontend-compose",
        "timestamp": "2024-01-15T11:30:00Z"
      }
    ],
    "modified": [],
    "deleted": []
  },

  "errors": [],

  "validation": {
    "lastCheck": {
      "phase": "POST_FASE_1",
      "timestamp": "2024-01-15T10:50:00Z",
      "status": "PASS",
      "details": {
        "context": true,
        "resources": true,
        "scope": true
      }
    }
  },

  "handoff": {
    "from": "frontend-theme",
    "to": "frontend-compose",
    "data": {
      "themeFile": ".workspace/config/THEME.md",
      "preset": "Anthropic Style",
      "tokens": {
        "colors": 12,
        "typography": 3,
        "spacing": 9
      }
    }
  }
}
```

---

## Operations

### Initialize Session

Roep aan bij skill start als geen actieve sessie bestaat.

````markdown
**Trigger:** Skill start zonder bestaande devinfo.json

**Actie:**

1. Genereer nieuw sessionId (UUID v4)
2. Zet startedAt op huidige timestamp
3. Initialiseer executionPlan met huidige skill
4. Schrijf naar `.workspace/session/devinfo.json`

**Output:**

```json
{
  "sessionId": "generated-uuid",
  "startedAt": "now",
  "currentSkill": { "name": "skill-name", "phase": "INIT" },
  "executionPlan": [{ "skill": "skill-name", "status": "in_progress" }]
}
```
````

````

---

### Continue Session

Roep aan bij skill start als sessie al bestaat.

```markdown
**Trigger:** Skill start met bestaande devinfo.json

**Actie:**
1. Lees huidige devinfo.json
2. Valideer of skill logisch volgt op vorige
3. Update currentSkill
4. Voeg toe aan executionPlan als nieuw
5. Update lastUpdatedAt

**Validation:**
- Check of vorige skill "completed" status heeft
- Check of handoff data beschikbaar is (indien vereist)
- Warn als skill out-of-order wordt uitgevoerd
````

---

### Update Progress

Roep aan na elke fase/task completion.

````markdown
**Trigger:** Fase of task voltooid

**Actie:**

1. Update currentSkill.phase
2. Increment progress.completedTasks
3. Add to progress.taskHistory
4. Update lastUpdatedAt

**Voorbeeld:**

```javascript
updateProgress({
  phase: "FASE_3",
  task: "Visual reflection complete",
  duration: 60, // seconds
});
```
````

````

---

### Record File Operation

Roep aan bij elke file create/modify/delete.

```markdown
**Trigger:** File operatie door skill

**Actie:**
1. Add to files.created/modified/deleted
2. Include skill name en timestamp

**Voorbeeld:**
```javascript
recordFile({
  operation: "created",
  path: ".workspace/wireframes/dashboard/ux/v1.html",
  skill: "frontend-compose"
})
````

````

---

### Record Error

Roep aan bij failure.

```markdown
**Trigger:** Error tijdens skill execution

**Actie:**
1. Add error to errors array
2. Include severity, message, recovery options
3. Update lastUpdatedAt

**Schema:**
```json
{
  "timestamp": "ISO timestamp",
  "skill": "frontend-compose",
  "phase": "FASE_2",
  "severity": "CRITICAL | HIGH | MEDIUM | LOW",
  "message": "Agent task timeout after 60s",
  "recovery": {
    "attempted": "retry",
    "success": false,
    "fallback": "sequential-mode"
  }
}
````

````

---

### Complete Session

Roep aan bij skill completion.

```markdown
**Trigger:** Skill successfully completed

**Actie:**
1. Update skill status to "completed"
2. Set completedAt timestamp
3. Record output data
4. Prepare handoff data for next skill
5. Archive if workflow complete

**Handoff Preparation:**
```json
{
  "from": "frontend-compose",
  "to": "frontend-build",
  "data": {
    "selectedWireframe": ".workspace/wireframes/dashboard/ux/v2.html",
    "atomicLevel": "organism",
    "components": ["Header", "Sidebar", "MetricCard", "DataTable"],
    "themeApplied": true
  }
}
````

````

---

### Archive Session

Roep aan als volledige workflow klaar is.

```markdown
**Trigger:** Laatste skill in executionPlan completed

**Actie:**
1. Mark session as archived
2. Move to `.workspace/session/history/[sessionId].json`
3. Generate summary report

**Archive Location:**
`.workspace/session/history/2024-01-15-frontend-pipeline-uuid.json`
````

---

## Cross-Skill Handoff Protocol

### Handoff Data Contracts

#### theme → compose

```json
{
  "from": "frontend-theme",
  "to": "frontend-compose",
  "data": {
    "themeFile": ".workspace/config/THEME.md",
    "preset": "Anthropic Style | Custom",
    "tokens": {
      "colors": { "count": 12, "hasSemanticColors": true },
      "typography": { "count": 3, "fonts": ["Poppins", "Lora", "Fira Code"] },
      "spacing": { "count": 9, "base": "4px" }
    },
    "cssExport": "valid"
  }
}
```

#### compose → create

```json
{
  "from": "frontend-compose",
  "to": "frontend-build",
  "data": {
    "selectedWireframe": ".workspace/wireframes/[page]/[agent]/v2.html",
    "selection": {
      "agent": "ux | minimal | rich",
      "version": "v2"
    },
    "atomicLevel": "atom | molecule | organism | template | page",
    "platform": "mobile | desktop | both",
    "components": [
      { "name": "Header", "atomic": "organism", "variants": 2 },
      { "name": "MetricCard", "atomic": "molecule", "variants": 3 }
    ],
    "themeApplied": true,
    "themeFile": ".workspace/config/THEME.md"
  }
}
```

#### create → data

`/build` levert gebouwde components af voor data hookup (Pad A). Zie `build → data` contract hieronder.

#### convert → data

`/convert` levert gebouwde components af voor data hookup (Pad B: extern design).

```json
{
  "from": "frontend-convert",
  "to": "frontend-data",
  "data": {
    "inputType": "screenshot | html | url",
    "pageFile": "src/pages/[page].tsx",
    "componentsDirectory": "src/components/[page]/",
    "tailwindConfig": "tailwind.config.js",
    "componentsCompleted": [
      {
        "name": "Header",
        "atomic": "organism",
        "files": ["Header.tsx", "Header.types.ts"]
      }
    ],
    "componentsSkipped": []
  }
}
```

#### build → data

`/build` levert gebouwde components af voor data hookup (Pad A: intern ontwerp).

```json
{
  "from": "frontend-build",
  "to": "frontend-data",
  "data": {
    "hifiPreview": ".workspace/wireframes/[page]/hifi/preview.html",
    "pageFile": "src/pages/[page].tsx",
    "componentsDirectory": "src/components/[page]/",
    "tailwindConfig": "tailwind.config.js",
    "componentsCompleted": [
      {
        "name": "Header",
        "atomic": "organism",
        "files": ["Header.tsx", "Header.types.ts"],
        "approved": true
      }
    ],
    "componentsSkipped": []
  }
}
```

#### data → (completion)

`/data` is het eindpunt voor data integratie. Output:

```json
{
  "from": "frontend-data",
  "to": null,
  "data": {
    "pageFile": "src/pages/[page].tsx",
    "componentsDirectory": "src/components/[page]/",
    "componentsHooked": [
      {
        "name": "Header",
        "dataSource": "server-component",
        "hasLoadingState": true,
        "hasErrorState": true
      }
    ],
    "componentsSkipped": [],
    "servicesCreated": ["src/services/users.ts"],
    "dataStrategy": "react-query | server-components | swr | plain-fetch"
  }
}
```

---

### Handoff Validation

Bij skill start, valideer handoff data:

````markdown
**Check:**

1. Expected `from` skill matches previous completed skill
2. Required data fields present
3. Referenced files exist
4. Data values valid

**On Failure:**

```yaml
header: "Handoff Mismatch"
question: "Expected handoff from [expected], got [actual]. Hoe doorgaan?"
options:
  - label: "Gebruik beschikbare data (Recommended)"
    description: "Ga door met wat er is"
  - label: "Run vorige skill eerst"
    description: "Complete [expected] voordat je doorgaat"
  - label: "Start fresh"
    description: "Begin zonder handoff data"
```
````

```

---

## Directory Structure

```

.workspace/ # Intermediate artifacts
├── session/
│ ├── devinfo.json # Huidige sessie state
│ └── history/ # Gearchiveerde sessies
│ ├── 2024-01-14-_.json
│ └── 2024-01-15-_.json
├── config/
│ └── THEME.md # Theme output (van /theme)
└── wireframes/ # Wireframe output (van /compose)
└── [page]/
├── ux/
│ ├── v1.html
│ └── v2.html
├── minimal/
└── rich/

src/components/ # Final output (van /build of /convert)
└── [page]/
├── index.ts
├── organisms/
│ └── Header/
│ ├── Header.tsx
│ └── Header.types.ts
├── molecules/
└── atoms/

tailwind.config.js # Extended met theme tokens

````

---

## Usage in Skills

### Bij Skill Start

```markdown
### Session Check

1. Check of `.workspace/session/devinfo.json` bestaat
2. Als JA:
   - Lees en parse devinfo
   - Check of dit skill in executionPlan past
   - Lees handoff data indien beschikbaar
   - Continue session
3. Als NEE:
   - Initialize nieuwe session
   - Start fresh

**Output:**
````

SESSION CHECK
─────────────
Status: [New session | Continuing session xyz]
Previous skill: [name | none]
Handoff data: [available | not available]

```

```

### Bij Fase Transitions

```markdown
### Progress Update

Na elke fase completion:

1. Update devinfo.currentSkill.phase
2. Update devinfo.progress
3. Write to file

Dit gebeurt automatisch bij elke FASE → FASE transitie.
```

### Bij File Operations

```markdown
### File Tracking

Bij elke file write:

1. Record in devinfo.files
2. Include skill en timestamp

Dit helpt met debugging en audit trails.
```

### Bij Errors

```markdown
### Error Recording

Bij elke error:

1. Record in devinfo.errors
2. Include recovery attempt
3. Update validation status

Dit helpt met debugging en recovery.
```

### Bij Completion

```markdown
### Skill Completion

1. Mark skill completed in executionPlan
2. Prepare handoff data voor volgende skill
3. Suggest next skill
4. Archive session if last skill

**Output:**
```

SKILL COMPLETE
──────────────
Skill: frontend-compose
Duration: 15 minutes
Files created: 6
Next suggested: /build dashboard

```

```

---

## Backward Compatibility

DevInfo tracking is **optioneel**:

- Skills werken zonder devinfo.json
- Handoff data is nice-to-have, niet required
- Progress tracking degradeert gracefully

```markdown
### Fallback Behavior

Als devinfo niet beschikbaar:

- Skill vraagt handmatig om dependencies
- Geen progress tracking
- Skill werkt nog steeds, maar minder smooth

### Rollback

Rollback wordt afgehandeld door Claude Code's ingebouwde "Rewind" functie.
Geen custom rollback logica nodig in skills.
```
