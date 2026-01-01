---
description: Save current session (command workflow or chat)
---

# Save

Saves the current session to `.workspace/sessions/` for later reference.

## Trigger

`/save` or `/save [title]`

## Process

### 1. Detect Context

Determine session type:
- **Command session**: If currently in a command workflow (/1-plan, /debug, etc.)
- **Chat session**: If no command workflow is active

### 2. Generate Title

If no title provided:
1. Analyze conversation content
2. Generate descriptive slug (max 40 chars, lowercase, dashes)
3. Show suggestion to user

**Title rules:**
- Lowercase with dashes
- No stopwords (the, a, an, etc.)
- Describes main content
- Max 40 characters

### 3. Confirm Save

Use AskUserQuestion:

```
header: "Save Session"
question: "Save this session?"
options:
  1. label: "Save as: {generated-title} (Recommended)"
     description: "Save with suggested title"
  2. label: "Different title"
     description: "Choose your own title"
  3. label: "Cancel"
     description: "Don't save"
multiSelect: false
```

### 4. Create File

Get timestamp via Time MCP: `mcp__time__get_current_time` with timezone "Europe/Amsterdam"

**Filename format:**
- Command: `.workspace/sessions/commands/{date}-{command}-{title}.md`
- Chat: `.workspace/sessions/chats/{date}-{title}.md`

**Examples:**
- `.workspace/sessions/commands/2025-12-31-1-plan-portfolio-layout.md`
- `.workspace/sessions/commands/2025-12-31-debug-jwt-expiry.md`
- `.workspace/sessions/chats/2025-12-31-tailwind-research.md`

### 5. Write Content

#### Command Session Format

```markdown
# Session: **{command}** - {title}

## Metadata
- **Started**: {timestamp}
- **Last Updated**: {timestamp}
- **Task**: {one-line task description}

## Current Position
- **FASE**: {number} - {fase name}
- **Step**: {current step description}

## Context

### FASE 1: {fase name}

#### Step 1.1: {step name}
- {context, findings, decisions}

#### Step 1.2: {step name}
- {context}

### FASE 2: {fase name}

#### Step 2.1: {step name}
- {context}

(continue for each completed fase/step)
```

**Context per step includes:**
- What was investigated/done
- Decisions made and why
- Files created/modified
- Important findings

#### Chat Session Format

```markdown
# Chat: {title}

## Metadata
- **Saved**: {timestamp}

## Topics
- {topic 1}
- {topic 2}
- {topic 3}

## Decisions
- {decision 1}: {brief rationale}
- {decision 2}: {brief rationale}

## Notes
{Any additional relevant context or links}
```

### 6. Confirmation

```
✅ Session saved: {filename}

Location: .workspace/sessions/{commands|chats}/{filename}
```

## Examples

### Example 1: Save command session

**Context**: User is in /1-plan workflow, FASE 2

**User**: `/save`

```
Save Session

Save this session?

○ Save as: "portfolio-grid-design" (Recommended)
○ Different title
○ Cancel
```

**User**: Selects first option

```
✅ Session saved: 2025-12-31-1-plan-portfolio-grid-design.md

Location: .workspace/sessions/commands/2025-12-31-1-plan-portfolio-grid-design.md
```

### Example 2: Save chat with custom title

**Context**: Normal chat about Tailwind

**User**: `/save my-tailwind-notes`

```
✅ Session saved: 2025-12-31-my-tailwind-notes.md

Location: .workspace/sessions/chats/2025-12-31-my-tailwind-notes.md
```

### Example 3: Save chat with suggestion

**Context**: Chat about React Router configuration

**User**: `/save`

```
Save Session

Save this session?

○ Save as: "react-router-config" (Recommended)
○ Different title
○ Cancel
```

## Error Handling

**Invalid title:**
```
Invalid title. Use only letters, numbers and dashes.
Max 40 characters.
```

**File already exists:**
```
A session with this name already exists.

1. Overwrite
2. Choose different name
3. Cancel
```

## Best Practices

### Language
Follow the Language Policy in CLAUDE.md.

### Do's
- Generate descriptive, specific titles
- Include all relevant context per step
- Update timestamps via Time MCP

### Don'ts
- Don't save empty sessions
- Don't include sensitive data
- Don't duplicate content already in session files
