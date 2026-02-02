---
description: Resume saved command or chat sessions
disable-model-invocation: true
---

# Resume

Resumes a previously saved session from `.workspace/sessions/`.

## Trigger

`/core-resume` or `/core-resume [search term]`

## Process

### Step 1: Determine Search Mode

**If search term provided** (`/core-resume auth`):
- Skip type selection
- Search across ALL sessions (commands + chats) for matching title
- Show filtered results

**If no search term** (`/core-resume`):
- Proceed to Step 2

### Step 2: Select Session Type

Use **AskUserQuestion**:
- header: "Session Type"
- question: "Welk type sessie wil je hervatten?"
- options:
  - label: "Command sessie", description: "Hervat een workflow (1-plan, debug, etc.)"
  - label: "Chat sessie", description: "Hervat een eerder gesprek"
- multiSelect: false

### Step 3: List Sessions

#### For Command Sessions:

1. List available command folders:
   ```
   Glob: .workspace/sessions/commands/*/
   ```

2. Use **AskUserQuestion**:
   - header: "Command"
   - question: "Welke command?"
   - options: [list of found command folders]
   - multiSelect: false

3. List sessions in selected command folder (newest first):
   ```
   Glob: .workspace/sessions/commands/{command}/*.md
   ```

4. Use **AskUserQuestion**:
   - header: "Session"
   - question: "Welke sessie hervatten?"
   - options: [max 10 sessions, formatted as "{date} - {title}"]
   - multiSelect: false

#### For Chat Sessions:

1. List chat sessions (newest first):
   ```
   Glob: .workspace/sessions/chats/*.md
   ```

2. Use **AskUserQuestion**:
   - header: "Session"
   - question: "Welke chat hervatten?"
   - options: [max 10 sessions, formatted as "{date} - {title}"]
   - multiSelect: false

### Step 4: Load Session

1. Read the selected session file
2. Parse the content:
   - **Command session**: Extract metadata, current position, and context
   - **Chat session**: Extract topics, decisions, and notes

### Step 5: Resume

#### For Command Sessions:

Output:
```
📂 RESUMING: {command} - {title}

**Position:** FASE {number} - {fase name}, Step {step}
**Task:** {task description}

**Context loaded:**
{summarize key context from each completed step}

Continuing from FASE {number}, Step {step}...
```

Then immediately continue the command workflow from the saved position.

#### For Chat Sessions:

Output:
```
📂 RESUMING: {title}

**Topics:** {topics list}
**Key decisions:** {decisions summary}

Context loaded. How can I help?
```

Wait for user input.

## Session File Locations

```
.workspace/sessions/
├── commands/
│   ├── 1-plan/
│   │   └── {date}-{title}.md
│   ├── debug/
│   │   └── {date}-{title}.md
│   └── {command}/
│       └── ...
└── chats/
    └── {date}-{title}.md
```

## Error Handling

**No sessions found:**
```
Geen opgeslagen sessies gevonden.

Gebruik /core-save om een sessie op te slaan.
```

**No matching search results:**
```
Geen sessies gevonden voor "{search term}".

Probeer een andere zoekterm of gebruik /core-resume zonder zoekterm.
```

## Examples

### Example 1: Resume command session

**User:** `/core-resume`

```
Session Type

Welk type sessie wil je hervatten?

○ Command sessie
○ Chat sessie
```

**User:** Selects "Command sessie"

```
Command

Welke command?

○ 1-plan (3 sessies)
○ debug (1 sessie)
○ 3-verify (2 sessies)
```

**User:** Selects "1-plan"

```
Session

Welke sessie hervatten?

○ 2026-01-03 - portfolio-layout
○ 2026-01-02 - auth-system
○ 2025-12-31 - api-design
```

**User:** Selects first option

```
📂 RESUMING: 1-plan - portfolio-layout

**Position:** FASE 2 - Research, Step 2.3
**Task:** Design portfolio grid layout

**Context loaded:**
- FASE 1: Requirements gathered, mobile-first approach confirmed
- FASE 2.1: Existing components analyzed
- FASE 2.2: Grid libraries compared, CSS Grid selected

Continuing from FASE 2, Step 2.3...
```

### Example 2: Search across sessions

**User:** `/core-resume auth`

```
Session

Sessies gevonden voor "auth":

○ [command] 1-plan: 2026-01-02 - auth-system
○ [chat] 2025-12-30 - auth-research
```

### Example 3: Resume chat

**User:** `/core-resume`
**User:** Selects "Chat sessie"

```
Session

Welke chat hervatten?

○ 2026-01-03 - boris-verify-infrastructure
○ 2026-01-02 - tailwind-config
○ 2026-01-01 - react-router-setup
```

**User:** Selects first option

```
📂 RESUMING: boris-verify-infrastructure

**Topics:** PostToolUse hooks, verificatie-infrastructuur, /dev-legacy-3-verify verbeteringen
**Key decisions:**
- Hook in settings.local.json
- Twee verificatie niveaus (/dev-legacy-verify quick, /dev-legacy-3-verify full)

Context loaded. How can I help?
```
