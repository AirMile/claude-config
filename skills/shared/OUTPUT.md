# Output Readability

How skill runtime output is formatted in the terminal. Runtime behavior
for free-form updates comes from global `CLAUDE.md § Output Readability`
(always in context); this file is the detailed rulebook for skill
reports — cited by section from skills and `/core-audit`, never restated
and never Read on a skill's hot path.

Terminal reality: markdown prose reflows to the full window width and
becomes unreadable fullscreen; fenced code blocks do NOT reflow. Reports
therefore live in fences; everything else stays short and structured.

## Running Updates

- Lead with the outcome, then the detail: "PASS — 12/12 tests", not
  "After running the tests, all twelve of them passed".
- Short markdown bullets, max 1-2 sentences per bullet.
- Prose paragraphs max 3 sentences — never a full-width prose wall.
- One update per action; no mid-turn recaps of output already shown.

## Bullets vs Table vs Fenced Block

| Content                                | Format         |
| -------------------------------------- | -------------- |
| Progress, decisions, findings          | Bullets        |
| Gathered inputs (Interview Checkpoint) | Markdown table |
| Phase/final report, status summary     | Fenced block   |

Tables: max 4 columns, short cells, total width ≤72 chars. Wider data →
fenced block, or split into two tables.

## Report Block

Grammar for every fenced report/status block:

```
{TITLE}: {subject}
==================
Label:    {value}
Label:    {value — wrap continuation lines,
          indented to the value column}

{Section} ({N}):
- {item}
```

- Max 72 chars per line **including filled-in values** — wrap onto an
  indented continuation line, never run long.
- `====` underline matches the title line length.
- Labels align to one value column. Labels translate at runtime
  (`shared/LANGUAGE.md`) — realign after translation, don't keep the
  English spacing.
- Values are data, not sentences. Conditional variants and explanations
  belong in prose around the block, never inside it.
- Fences suppress markdown: no bold, links, or clickable `/commands`
  inside. Anything that must render goes after the fence.
- Completion reports end with a `Next steps:` numbered block **after**
  the fence (`shared/SKILL-PATTERNS.md § Next Steps`).

## Avoid

- Full-width prose walls (any paragraph over 3 sentences)
- Mid-turn recaps or re-summaries of output already shown
- Echoing file contents or tool results back verbatim
- Verbose completion confirmations ("I have now successfully…")
- Rigid templates where the format isn't load-bearing — per
  `shared/SKILL-PATTERNS.md § Token Efficiency` item 5, trust Claude to
  format free-form output; prescribe only report blocks.

## Language

Language and label translation follow `shared/LANGUAGE.md` (cite, don't
restate): status labels and table headers translate; the standard column
names listed there stay English; code, paths, and identifiers stay
English. Width and alignment rules here apply after translation.
