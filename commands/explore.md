---
description: Explore the codebase with agents for a specific question
---

# Explore

Spawn Explore agents to investigate the codebase for a user query. Synthesize the results and provide a clear answer.

## When to Use

- User asks how something works in the codebase
- Context needed for a question that spans multiple files
- Understanding architecture or patterns

## Trigger

`/explore [question]`

Examples:
- `/explore how does authentication work here?`
- `/explore where are API calls made?`
- `/explore what is the project structure?`

## Process

1. **Parse the question**
   - Extract the core of what the user wants to know
   - Determine search strategy (patterns, files, keywords)

2. **Spawn Explore agents**
   - Use Task tool with `subagent_type: Explore`
   - Provide clear prompt with the user question
   - Specify thoroughness: "medium" for standard, "very thorough" for complex questions

3. **Synthesize results**
   - Combine findings from agents
   - Filter relevant information
   - Structure the answer

4. **Answer the question**
   - Provide a clear, summarizing answer
   - Reference specific files/functions where relevant
   - Use code references with line numbers

## Notifications

Send notifications at these points:

- After exploration phase completes:
  ```bash
  powershell -ExecutionPolicy Bypass -File .claude/scripts/notify.ps1 -Title "Claude Code" -Message "Exploration complete"
  ```

- At workflow completion:
  ```bash
  powershell -ExecutionPolicy Bypass -File .claude/scripts/notify.ps1 -Title "Claude Code" -Message "Answer ready"
  ```

## Output Format

**Answer**

[Clear summary that answers the question]

**Relevant Locations**

- [file.ts:line](path/to/file.ts#Lline) - [what it does]
- [file.ts:line](path/to/file.ts#Lline) - [what it does]

**Details** (optional, if useful)

[Additional context or explanation]
