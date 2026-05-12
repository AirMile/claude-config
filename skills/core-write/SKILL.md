---
name: core-write
description: >-
  Write a text from scratch in a Miles writing style with guided context-gathering.
  Detects style automatically based on text type (blog/post/note → personal, README/docs → clear, portfolio/showcase → portfolio, analyse/rapport → insights).
  Supports Quick (one question round), Standard (two rounds), and Full (with outline approval) flows.
  Use with /core-write [what to write].
argument-hint: "[what to write]"
user-invocable: true
metadata:
  author: mileszeilstra
  version: 1.0.0
  category: core
---

# Write

Writing assistant that generates text in Miles style. Gathers context via questions, selects the appropriate guidance level automatically, and applies the chosen style strictly.

## 1. Parse Input

Analyze the argument for:

- **Subject** — what the text is about
- **Text type** — blog, post, note, README, docs, portfolio-page, etc.
- **Context richness** — how much has already been provided (see Step 3)

If no argument: ask for text type and subject before continuing.

## 2. Auto-Detect Style

Match keywords in the argument against known types:

| Keywords in argument                                      | Style     | Example                       |
| --------------------------------------------------------- | --------- | ----------------------------- |
| blog, post, note, essay, artikel, journal                 | personal  | "blog about my first project" |
| README, docs, documentation, explanation, guide, tutorial | clear     | "README for draftgap"         |
| portfolio, showcase, CV, demo-page, project-page          | portfolio | "portfolio text for draftgap" |
| report, analysis, insights, deep dive, review             | insights  | "analysis of my development"  |

No match found? Ask:

```yaml
header: "Style"
question: "Which writing style?"
options:
  - label: "Personal"
    description: "Personal first-person voice. Write as if telling someone across the table. For blogs, posts, notes."
  - label: "Clear"
    description: "Objective in Miles style. Conversational-narrative, no 'I'. For READMEs, docs, explanations."
  - label: "Portfolio"
    description: "Direct, active, shows don't tells. Professional but natural. For demo/showcase."
  - label: "Insights"
    description: "Analytical, data-woven, confident. Claim-evidence-conclusion."
multiSelect: false
```

Match found? Inform which style was detected and ask for confirmation:

```yaml
header: "Style"
question: "Detected style: {X}. Is that correct?"
options:
  - label: "Yes, use {X}"
    description: ""
  - label: "Choose a different style"
    description: ""
multiSelect: false
```

## 3. Determine Flow Level

Assess context richness of the argument based on how much is already known:

**Sparse** (< 5 content words, e.g. "blog about X"):
→ Ask flow level via AskUserQuestion:

```yaml
header: "Guidance"
question: "How much guidance do you want?"
options:
  - label: "Standard (Recommended)"
    description: "Two short question rounds (audience + goal, then key points + angle), then straight to draft."
  - label: "Quick"
    description: "One question round (key points + length), draft immediately. For when you already know what you want."
  - label: "Full"
    description: "Two rounds + outline approval + iteration round afterwards. For important texts."
multiSelect: false
```

**Medium** (5–15 words with clear subject + angle or audience):
→ Default **Standard**, skip flow question.

**Rich** (15+ words with multiple context elements already filled in):
→ Default **Quick**, skip flow question.

**Keyword-override** (always applies):

- "detailed", "guided", "deep" in argument → force **Full**
- "quick", "short", "draft" in argument → force **Quick**

## 4. Gather Context

### Quick

One AskUserQuestion block (can cover everything at once):

```yaml
header: "Context"
question: "Fill in briefly so I can get started:"
options:
  - label: "Key points + length"
    description: "What must definitely be included? (3-5 points). How long? (short/medium/long)"
multiSelect: false
```

Also accept free text via "Other". Proceed directly to Step 5 after answering.

### Standard

**Round 1 — AskUserQuestion:**

```yaml
header: "Audience"
question: "Who is the reader and what is the goal?"
options:
  - label: "Audience + goal"
    description: "Who reads this? Developers / managers / friends / everyone? Goal: inform / persuade / entertain?"
multiSelect: false
```

Length preference as a separate option or via "Other":

```yaml
header: "Length"
question: "How long should the text be?"
options:
  - label: "Short (< 300 words)"
    description: ""
  - label: "Medium (300–700 words)"
    description: ""
  - label: "Long (700+ words)"
    description: ""
multiSelect: false
```

**Round 2 — AskUserQuestion:**

```yaml
header: "Content"
question: "What must definitely be included?"
options:
  - label: "Key points"
    description: "3-5 things that must definitely appear in the text. Use 'Other' for a list."
  - label: "Angle / perspective"
    description: "Is there a specific angle, thesis, or message that should be central?"
multiSelect: true
```

Proceed to Step 5 after both rounds.

### Full

Same as Standard (Round 1 + 2) plus after context:

**Outline phase:**

Generate an outline: section headers + one sentence per section. Show to user and ask:

```yaml
header: "Outline"
question: "Does the structure look right?"
options:
  - label: "Good, write the draft"
    description: ""
  - label: "Adjust"
    description: "Tell me what needs to change, I'll update the outline and ask again."
multiSelect: false
```

Adjust outline until approved, then proceed to Step 5.

**Iteration phase** (after draft):

```yaml
header: "Draft"
question: "How is the draft?"
options:
  - label: "Looks good"
    description: ""
  - label: "Iteration round"
    description: "Tell me what needs to change. I'll adjust and show the new version."
multiSelect: false
```

## 5. Write Draft

```
Read("../shared/styles/_anti-patterns.md")
Read("../shared/styles/style-{style}.md")
```

Write the full text with all rules from both files strictly applied.

Preserve:

- Language of the context input (NL → NL, EN → EN)
- Tech terms in English

## 5b. Self-Check

Verify the draft before output. Silently:

1. Loop through the draft sentence by sentence. Flag:
   - Sentences > 25 words
   - Em dashes
   - Every forbidden word from `_anti-patterns.md` or the style-specific list
   - Three sentences of similar length in a row (no burstiness)
   - Style-specific violations (panoramic opener for personal, marketing-speak for clear, etc.)
2. Found violations: rewrite those sentences in place. Do not output the violations list.
3. Repeat at most once if a rewrite introduces new problems. After two passes: accept remaining imperfection.

Self-check is silent. Output remains text-only (Step 6).

## 6. Output

Output ONLY the text. No commentary, no "here is your draft", no wrapping.
