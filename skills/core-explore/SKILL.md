---
name: core-explore
description: Explore the codebase to answer specific questions. Use with /core-explore to investigate code structure, find implementations, or understand architecture.
disable-model-invocation: true
metadata:
  author: mileszeilstra
  version: 1.0.0
  category: core
---

# Explore

Investigate the codebase inline for a user query. Use Glob, Grep, and Read to find answers and provide a clear summary.

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

2. **Search the codebase inline**
   - Use Glob to find relevant files by pattern
   - Use Grep to search for keywords, function names, patterns
   - Use Read to examine relevant code sections
   - Follow import chains and references to build understanding

3. **Structure the answer**
   - Filter relevant information
   - Organize by relevance to the question

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
