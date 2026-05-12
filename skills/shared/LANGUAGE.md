# Language Policy

All skill and agent files are written in **English**. This is a hard rule — no exceptions.

Runtime output language (assistant responses, ASCII table headers, AskUserQuestion labels, status messages, error messages) is determined by the active project's language setting.

## Reading the Language Setting

Read `CLAUDE.md § User Preferences → Language:` — match the pattern `^Language:\s*(\w+)`.

- Project CLAUDE.md takes precedence over global `~/.claude/CLAUDE.md`
- When missing or unreadable: default to **English**

Supported values: English, Nederlands, Deutsch, Français, Español.

## What Gets Translated at Runtime

| Category                                          | Translate? |
| ------------------------------------------------- | ---------- |
| ASCII table headers and columns                   | Yes        |
| AskUserQuestion labels and descriptions           | Yes        |
| Status messages (Done, Summary, Next step, etc.)  | Yes        |
| Error messages and warnings                       | Yes        |
| Prose explanations to the user                    | Yes        |
| Code, file paths, API names, library names        | No         |
| File extensions, CLI flags, environment variables | No         |
| Technical identifiers (variable/function names)   | No         |
| Section headers in CLAUDE.md                      | No         |

## Skill Authoring Rules

- Write all skill phases, steps, instructions, and template strings in English
- Use English structural headers: `PHASE 0`, `Step 1`, `Do:`, `Don't:`, `Report:`
- ASCII table column names in English: `Result`, `Description`, `Evidence`, `Status`, `Reasoning`, `Summary`
- AskUserQuestion labels in English: `Which priority?`, `Done`, `Cancel`, `Skip` — Claude translates these at runtime based on the Language setting
- Do NOT hardcode any other language in skill files — this silently breaks projects configured for other languages
