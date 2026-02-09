---
description: Browse Todoist tasks and pick one up to work on with Claude
argument-hint: [project or search term]
disable-model-invocation: true
---

# Task

Browse Todoist tasks, pick one up, classify it, and work on it with Claude.

**Trigger**: `/core-task`, `/core-task [project or search]`, `/core-task done`

## FASE 0: Browse

Parse `$ARGUMENTS`:

- **`done`** → skip to FASE 3
- **Empty** → project selection
- **Text** → match against project names (case-insensitive partial match). If no project matches, search tasks via `get_tasks_list(filter="search: $ARGUMENTS")`

### Project Selection

1. Fetch all projects with `get_projects_list`
2. For each project, fetch task count with `get_tasks_list(project_id=...)`
3. Group projects into **Dev** and **Overig** based on project content
4. Hide **Watch Later** and **Subscriptions** projects (skip them from display)
5. Use **AskUserQuestion**:
   - header: "Project"
   - question: "Welk project?"
   - options: top projects with task count, e.g. "ProjectName (12 taken)". Recommended = most active dev project
   - multiSelect: false

### Task Selection

1. Fetch tasks for selected project with `get_tasks_list(project_id=...)`
2. Use **AskUserQuestion** to present tasks:
   - header: "Taak"
   - question: "Welke taak oppakken?"
   - options: max 4 tasks, formatted as compact entries:
     - `{name} [P{priority}] {icons}` where icons: `D` = has description, `S` = has subtasks, `C` = has comments
   - Recommended = first task with description, or first P1 task, or first task
   - multiSelect: false
3. If >10 tasks exist, mention in the question: "({total} taken — typ een zoekterm voor meer)"

## FASE 1: Enrich & Classify

### Step 1: Fetch Full Context

1. `get_tasks` — full task details (description, labels, due date)
2. `get_comments_list(task_id=...)` — all comments
3. `get_tasks_list(filter="subtask", project_id=...)` — check for subtasks by checking parent_id

### Step 2: Display Task Card

```
TASK: {name}
Project: {project} | Priority: P{n} | Due: {date or "none"}
Labels: {labels or "none"}

Description:
{description or "Geen beschrijving"}

Comments ({count}):
{latest 3 comments, summarized}

Subtasks ({count}):
{list subtask names with completion status}
```

### Step 3: Classify Task Type

Use sequential thinking to classify the task based on its name, description, comments, and labels:

| Type       | Signals                                                                                    | Claude can help? |
| ---------- | ------------------------------------------------------------------------------------------ | ---------------- |
| `DEV`      | code terms, "implement", "fix", "build", "refactor", "bug", "feature", tech stack keywords | Yes              |
| `RESEARCH` | "research", "find out", "compare", URLs, "how to", "look into"                             | Yes              |
| `CREATIVE` | "idea", "brainstorm", "write", "concept", "design", "draft"                                | Yes              |
| `PLAN`     | "plan", "strategy", "decide", "roadmap", "prioritize"                                      | Yes              |
| `SIMPLE`   | short actionable items, clear single-step tasks                                            | Yes              |
| `PHYSICAL` | "buy", "clean", "call", "go to", physical/real-world actions                               | No               |
| `EXTERNAL` | "download", "install", "sign up", account management, waiting on others                    | Partially        |

Display classification:

```
TYPE: {type} — {one-line reasoning}
```

### Step 4: Context Gap Check

If the task has no description AND no comments AND name is fewer than 8 words:

Use **AskUserQuestion**:

- header: "Context"
- question: "Deze taak heeft weinig context. Wat is het doel en gewenste resultaat?"
- options:
  - label: "Ik typ context", description: "Voeg extra toelichting toe"
  - label: "Niet nodig", description: "Taak is duidelijk genoeg"
- multiSelect: false

### Step 5: Actionability Gate

**If `PHYSICAL`:**

Use **AskUserQuestion**:

- header: "Taaktype"
- question: "Dit is een fysieke taak waar Claude weinig bij kan helpen. Wat wil je doen?"
- options:
  - label: "Andere taak kiezen", description: "Ga terug naar taakselectie"
  - label: "Toch doorgaan", description: "Misschien kan Claude toch helpen met plannen/voorbereiding"
  - label: "Afsluiten", description: "Sluit taak af of laat open"
- multiSelect: false

- "Andere taak kiezen" → go back to FASE 0 task selection
- "Toch doorgaan" → proceed to FASE 2
- "Afsluiten" → go to FASE 3

## FASE 2: Execute

### Strategy Proposal

Based on task type, propose a strategy:

**DEV:**

- Complex feature → suggest `/dev-plan` then `/dev-build`
- Bug fix or small change → suggest direct execution or `/dev-build`
- Refactor → suggest `/dev-refactor`

**RESEARCH:**

- Web research → use WebSearch, WebFetch, Context7
- Codebase question → suggest `/core-explore`
- Analysis → suggest `/thinking-analyze`

**CREATIVE:**

- Brainstorm → suggest `/thinking-brainstorm`
- Ideation → suggest `/thinking-idea`
- Writing → direct execution

**PLAN:**

- Strategic planning → suggest `/thinking-plan`
- Analysis → suggest `/thinking-analyze`

**SIMPLE:**

- Direct execution with available tools

**EXTERNAL:**

- Prepare what can be done (draft emails, prepare configs, create checklists)

### Handoff

Use **AskUserQuestion**:

- header: "Aanpak"
- question: "Hoe wil je deze taak aanpakken?"
- options: 2-3 relevant options based on type. Always include "Direct beginnen" as an option.
  - For skill suggestions: label = skill name, description = what it does for this task
  - label: "Direct beginnen", description: "Begin freeform zonder specifieke workflow"
- multiSelect: false

**If skill selected:**

Display task context summary for the next skill:

```
TASK CONTEXT (for handoff):
Task: {name}
Type: {type}
Goal: {description or user-provided context}
Key details: {relevant comments/subtasks}
```

Then suggest the exact command, e.g.: "Gebruik `/dev-plan {task name}` om te starten."

**If "Direct beginnen":**

Start working on the task freeform using all available tools. Refer back to the task card for context.

## FASE 3: Close Loop

Trigger: after task completion OR via `/core-task done`

Use **AskUserQuestion**:

- header: "Afsluiten"
- question: "Wat wil je met deze taak doen?"
- options:
  - label: "Afsluiten (Recommended)", description: "Markeer als voltooid in Todoist"
  - label: "Afsluiten met notitie", description: "Voeg een afrondingsnotitie toe en sluit af"
  - label: "Open laten", description: "Laat de taak open in Todoist"
  - label: "Volgende taak", description: "Pak een andere taak op"
- multiSelect: false

**Response handling:**

- **Afsluiten** → `close_tasks(task_id=...)`, display confirmation
- **Afsluiten met notitie** → ask for note content or auto-generate summary, then `create_comments(task_id=..., content=...)` + `close_tasks(task_id=...)`
- **Open laten** → display confirmation, no Todoist changes
- **Volgende taak** → go back to FASE 0 (project selection)

### Confirmation

```
DONE: {task name}
Project: {project}
Status: {Afgesloten / Afgesloten met notitie / Open gelaten}
```

## Error Handling

**No projects found:**

```
Geen projecten gevonden in Todoist. Check je Todoist-verbinding.
```

**No tasks in project:**

```
Geen open taken in {project}. Kies een ander project of gebruik een zoekterm.
```

**Search returns no results:**

```
Geen taken gevonden voor "{search}". Probeer een andere zoekterm of gebruik /core-task zonder argument.
```
