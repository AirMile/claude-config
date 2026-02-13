---
name: core-explore
description: Explore the codebase using parallel agents to answer specific questions. Use with /core-explore to investigate code structure, find implementations, or understand architecture.
disable-model-invocation: true
metadata:
  author: mileszeilstra
  version: 1.0.0
  category: core
---

# Explore

Spawn Explore agents to investigate the codebase for a user query. Synthesize the results and provide a clear answer.

## When to Use

- User asks how something works in the codebase
- Context needed for a question that spans multiple files
- Understanding architecture or patterns

## Trigger

`/core-explore [question]`

Examples:

- `/core-explore how does authentication work here?`
- `/core-explore where are API calls made?`
- `/core-explore what is the project structure?`

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

## Output Format

**Answer**

[Clear summary that answers the question]

**Relevant Locations**

- [file.ts:line](path/to/file.ts#Lline) - [what it does]
- [file.ts:line](path/to/file.ts#Lline) - [what it does]

**Details** (optional, if useful)

[Additional context or explanation]
