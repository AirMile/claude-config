# Explanation Level Policy

Runtime explanation depth (jargon, analogies, detail level) is determined by the active project's explanation level setting.

## Reading the Explanation Level Setting

Read `CLAUDE.md § User Preferences → Explanation Level:` — match the pattern `^Explanation Level:\s*(Beginner|Novice|Intermediate|Expert)`.

- Project CLAUDE.md takes precedence over global `~/.claude/CLAUDE.md`
- When missing or unreadable: default to **Intermediate**

Supported values: Beginner, Novice, Intermediate, Expert.

## Behavior per Level

| Level        | Jargon                                          | Analogies         | Detail                                    |
| ------------ | ----------------------------------------------- | ----------------- | ----------------------------------------- |
| Beginner     | Explain every non-trivial term                  | Always use them   | Short sentences, concrete examples always |
| Novice       | Explain framework-specific terms                | Use when helpful  | Examples where helpful, not always        |
| Intermediate | Assume standard programming knowledge (default) | Skip unless asked | Normal depth, no extra scaffolding        |
| Expert       | Assume full stack familiarity                   | Never             | Compact — only what's essential           |

## What Changes at Runtime

| Category                | Beginner                       | Novice                     | Intermediate       | Expert            |
| ----------------------- | ------------------------------ | -------------------------- | ------------------ | ----------------- |
| Term introductions      | Every new term defined inline  | Framework terms defined    | None               | None              |
| Code explanations       | Explain every non-obvious line | Explain non-obvious blocks | Explain only WHY   | Skip if obvious   |
| Analogies in prose      | Always                         | When helpful               | Never              | Never             |
| Response length bias    | Longer, more scaffolding       | Moderate                   | Concise            | Minimal           |
| Assumptions about stack | None — explain everything      | General programming ok     | Stack knowledge ok | Deep expertise ok |

## Skill Authoring Rules

- Never hardcode a specific explanation depth in skill output templates
- Read this setting at runtime when generating prose explanations or error messages directed at the user
- Code identifiers, file paths, CLI flags — never translate or simplify regardless of level
