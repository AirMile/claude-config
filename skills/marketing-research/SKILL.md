---
name: marketing-research
argument-hint: "[topic]"
description: >-
  Marketing-focused trend and audience research. Identifies trend momentum,
  platform sentiment, messaging opportunities, and campaign timing windows.
  Use with /marketing-research [topic] for product launches, content strategy,
  or competitive positioning.
metadata:
  author: mileszeilstra
  version: 1.0.0
  category: marketing
---

# Marketing Research

Research marketing opportunities by analyzing trend signals, platform sentiment, and audience language. Identifies timing windows and produces actor-specific recommendations — no vague "keep monitoring" output.

**Trigger**: `/marketing-research` or `/marketing-research [topic]`

Complementary to `/thinking-research` (concept validation) — this skill actively searches for marketing opportunities, timing windows, and messaging entry points.

## PHASE 0: Scope Definition

**Existing report check:**

Search for `.project/thinking/*-marketing-research.md`. If found, ask via AskUserQuestion:

```yaml
header: "Existing report"
question: "A marketing research report already exists for this topic. What do you want to do?"
options:
  - label: "Load and continue (Recommended)", description: "Use existing report as basis for marketing-content"
  - label: "Research again", description: "Overwrite the existing report with new research"
multiSelect: false
```

On "Load and continue": show the SCOPE ANCHORS from the existing report and close PHASE 0. Go directly to PHASE 3 (Recommendations) or suggest next steps.

**If `$1` provided** → use as starting point.

**If no argument:**

Ask via AskUserQuestion:

```yaml
header: "Topic"
question: "What do you want to research for marketing?"
options:
  - label: "Product or feature launch", description: "Timing, messaging, audience for a launch"
  - label: "Content strategy", description: "Which topics, formats, platforms are relevant now"
  - label: "Competitive positioning", description: "How competitors position themselves and where the gap is"
  - label: "Campaign timing", description: "When a theme or topic has momentum"
multiSelect: false
```

Then ask for free-text input: product/concept + target audience + optional time window.

**Scope extraction (two-step):**

Extract 5-10 structured research angles from the free-text input. Categorize them:

- **Audience**: who are they, what do they say, what language do they use?
- **Trending topics**: what has momentum in this domain right now?
- **Competitors**: how do they position themselves, what is their messaging?
- **Channels**: where is the audience active?
- **Timing signals**: when is the conversation most active?

Present as a mandatory output block — this is the contract between PHASE 0 and the rest of the skill, and the input for `/marketing-content`:

```
SCOPE ANCHORS

Topic: {topic in one sentence}
Audience: {who + 2-3 characteristics}
Trending topics: [{topic 1}, {topic 2}, ...]
Competitors: [{name 1}, {name 2}]
Active channels: [{platform 1}, {platform 2}]
Timing window: {active now / seasonal: {when} / open}
Research type: {launch / content / positioning / campaign timing}
```

Confirm via AskUserQuestion (Yes / Adjust).

## PHASE 1: Multi-Source Research

Run WebSearch queries in parallel, derived from the scope angles. Cover at minimum:

- Trend signals per platform (Twitter/X, Reddit, LinkedIn, HN, news sources)
- Competitor messaging and positioning
- Audience language and pain points (forums, reviews, comments)

Present findings per source with platform label:

```
PLATFORM — {platform name}

Query: "{search query}"

Findings:
- {key finding 1}
- {key finding 2}

Sources: {URLs}
```

## PHASE 2: Signal Analysis

Analyze the collected data on three axes:

**Platform temperature differences:**

| Platform     | Character                                      |
| ------------ | ---------------------------------------------- |
| Twitter/X    | Early adoption, emotional, fast cycles         |
| Reddit       | Critical, detailed, niche communities          |
| LinkedIn     | Professional, lagging indicator, B2B sentiment |
| Hacker News  | Tech/startup, skeptical, anti-hype             |
| Product Hunt | Launch-moment buzz, early adopters             |

Temperature difference = actively interpret: "trending on X but not on LinkedIn" is a signal, not a gap.

**Trajectory per topic** — label each relevant topic:

- `acute_rise`: appears and rises quickly → time-sensitive window
- `plateau`: high but stable → mainstream, commodity risk
- `zombie`: lingers without growth → exhausted momentum
- `comeback`: was gone, returns → new trigger, investigate cause

**Sentiment conflict:**

Look for where consensus breaks — not "positive or negative?" but "where does sentiment fracture?" That breaking point is the most relevant moment for campaign timing.

Present:

```
SIGNAL ANALYSIS

Platform temperatures:
- {platform}: {trajectory label} — {character of the conversation}
- {platform}: {trajectory label} — {character of the conversation}

Temperature difference: {interpretation of the difference between platforms}

Weak signals: {what is in niche sources but not in mainstream?}

Sentiment conflict: {where does consensus fracture? what is the actual conflict?}
```

## PHASE 3: Actor-Specific Recommendations

Ask via AskUserQuestion which actor type is relevant:

```yaml
header: "Actor type"
question: "Who are the recommendations for?"
options:
  - label: "Brand / company (Recommended)", description: "Marketing team, content strategy, campaigns"
  - label: "Solo creator / personal brand", description: "Content creator, thought leader, freelancer"
  - label: "Agency / consultant", description: "Advice for clients, positioning"
multiSelect: false
```

Generate a concrete recommendation per relevant scope angle:

- **Action**: what specifically to do (not "consider X" but "publish Y on Z")
- **Timing window**: when — based on trajectory label
- **Reasoning**: which signal justifies this
- **Platform**: where to activate

No "keep monitoring" advice allowed. Every recommendation ends with a concrete action or decision. If the moment is not yet right: say that explicitly with the condition under which it becomes right.

Present as table:

```
RECOMMENDATIONS — {actor type}

| # | Action | Timing | Platform | Reasoning |
|---|--------|--------|----------|-----------|
| 1 | {concrete action} | {now / in N weeks / wait for X} | {platform} | {signal} |
| 2 | ... | ... | ... | ... |
```

## PHASE 4: Report + Save

Generate a markdown report:

```markdown
# Marketing Research: {topic}

## Summary

{2-3 sentences: what is the core opportunity and the core risk?}

## Signal Analysis

### Platform Temperatures

{temperature differences + trajectories}

### Sentiment Conflict

{where does consensus fracture?}

### Weak Signals

{what mainstream doesn't cover}

## Audience Language

{exact words, frames, and pain points the audience uses}

## Competitive Positioning

{how do competitors position themselves and where is the gap?}

## Recommendations

| #   | Action | Timing | Platform | Reasoning |
| --- | ------ | ------ | -------- | --------- |

{table from PHASE 3}

## Sources

- [{source title}]({url})
```

Save to `.project/thinking/{topic}-marketing-research.md`.

Show next steps:

```
Next steps:
- /marketing-content  — write text variants based on these signals
- /thinking-decide    — make a decision based on these insights
- /marketing-screenshots — marketing screenshots for launch
- /project-plan       — feature backlog based on market insights
```

## Guidelines

**Formatting:**

- NEVER blockquote syntax (`>`) — unreadable background in dark terminals
- NEVER backticks for emphasis on regular words — use **bold**
- Backticks only for code, file paths, and command references

**Language:** Follow the Language Policy in CLAUDE.md.
