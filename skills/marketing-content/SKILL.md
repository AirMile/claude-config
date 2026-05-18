---
name: marketing-content
argument-hint: "[topic]"
description: Generate marketing copy variants per format. Use with /marketing-content.
metadata:
  author: claude-config
  version: 1.0.0
  category: marketing
---

# Marketing Content

Turn research signals into concrete text variants per format and platform. Each variant
is traceable to a specific signal — no generic output.

**Trigger**: `/marketing-content` or `/marketing-content [topic]`

Second step in the marketing pipeline: `/marketing-research` → **`/marketing-content`** → `/marketing-screenshots`

## PHASE 0: Input & Context

**Research auto-detect:**

Search for `.project/thinking/*-marketing-research.md`. If found:

- Load the SCOPE ANCHORS section (topic, target audience, channels, trajectory labels)
- Load the Signal Analysis section (platform temperatures, sentiment conflict)
- Load the Audience Language section (exact words and frames used by the audience)
- Confirm to the user which research file was loaded

If not found: ask for a free-text description of the topic and target audience.

**Format selection** via AskUserQuestion:

```yaml
header: "Format"
question: "What type of content do you want to generate?"
options:
  - label: "Social post (Recommended)", description: "Twitter/X, LinkedIn, Instagram"
  - label: "Email subject line", description: "3-5 variants for A/B test"
  - label: "Ad headline", description: "Google/Meta — max 30 characters"
  - label: "Landing page section", description: "Hero headline + subline"
multiSelect: true
```

**Platform selection** (only if Social post chosen) via AskUserQuestion:

```yaml
header: "Platform"
question: "Which platform?"
options:
  - label: "Twitter/X (Recommended)", description: "Max 280 characters, direct tone"
  - label: "LinkedIn", description: "Professional, more context allowed"
  - label: "Instagram", description: "Visual, caption + hashtags"
multiSelect: true
```

**Tone/voice selection** via AskUserQuestion:

```yaml
header: "Tone"
question: "Which tone fits this brand or campaign?"
options:
  - label: "Informative (Recommended)", description: "Clear, factual, educational — builds trust"
  - label: "Urgent", description: "Action-driven, time-bound — pushes to decision"
  - label: "Provocative", description: "Sharp, challenging, bold — captures attention"
  - label: "Inspiring", description: "Motivating, aspirational — connects emotionally"
multiSelect: false
```

Use the selected tone as a style constraint in PHASE 2: every variant must consistently reflect the selected tone, even if the trajectory label suggests a different direction.

## PHASE 1: Distill Messaging Angles

Map the strongest research signals to messaging frames:

| Signal             | Messaging frame                                              |
| ------------------ | ------------------------------------------------------------ |
| `acute_rise`       | Urgency — "this is the moment"                               |
| `comeback`         | Contrast — "it's back, and different now"                    |
| `plateau`          | Differentiation — "what makes you different from mainstream" |
| `zombie`           | Counter-indicator — avoid, or use as contrast                |
| sentiment-conflict | Provocation — "not everyone agrees about..."                 |
| audience language  | Mirror — use their exact words back                          |

Select the 3 strongest angles based on available signals. If no research is available: use Competitor Differentiation, Audience Mirror, and Problem/Solution as default angles.

Present:

```
MESSAGING ANGLES

1. {angle name} — {frame} — based on: {signal + source}
2. {angle name} — {frame} — based on: {signal + source}
3. {angle name} — {frame} — based on: {signal + source}
```

## PHASE 2: Generate Variants

Per chosen format: generate 3-5 variants, spread across the messaging angles.

**Length and tone rules per format:**

| Format               | Length         | Tone                               |
| -------------------- | -------------- | ---------------------------------- |
| Twitter/X post       | Max 280 chars  | Direct, no formatting              |
| LinkedIn post        | 150-300 chars  | Professional, opener allowed       |
| Instagram caption    | 100-150 + tags | Visually supportive, emojis ok     |
| Email subject line   | Max 50 chars   | Curiosity or urgency               |
| Ad headline          | Max 30 chars   | Action-driven, single core message |
| Landing page hero    | 6-10 words     | Promise or problem statement       |
| Landing page subline | 15-25 words    | Explanation of the promise         |

Each variant contains:

- The text (length rule respected)
- **Angle**: which messaging frame
- **Signal**: which research signal justifies this
- **Trajectory**: `acute_rise` / `plateau` / `comeback` / `zombie` (if applicable)

No generic text allowed. If a variant is not traceable to a concrete signal or one of the angles, do not write it.

Present per format:

```
{FORMAT} — {platform}

Variant 1:
"{text}"
Angle: {frame} | Signal: {signal} | Trajectory: {label}

Variant 2:
...
```

## PHASE 3: Save

Save to `.project/thinking/{topic}-marketing-content.md`.

Show next steps:

```
Next steps:
- /marketing-screenshots — screenshots + visuals for launch
- /marketing-research — new research round for another topic
```

## Guidelines

**Formatting:**

- NEVER blockquote syntax (`>`) — unreadable background in dark terminals
- NEVER backticks for emphasis on regular words — use **bold**
- Backticks only for code, file paths, and command references

**Language:** Follow the Language Policy in CLAUDE.md.
