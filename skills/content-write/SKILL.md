---
name: content-write
description: Write text from scratch in your configured style. Use with /content-write.
argument-hint: "[what to write]"
user-invocable: true
metadata:
  author: claude-config
  version: 1.0.0
  category: content
---

# Write

Writing assistant that generates text in your configured style. Gathers context via questions, selects the appropriate guidance level automatically, and applies the chosen style strictly.

Styles are loaded dynamically from `~/.claude/styles/*.md`. Add your own style files
there to make them available. See `skills/shared/styles/style-example.md` for the
format.

## 1. Parse Input

Analyze the argument for:

- **Subject** — what the text is about
- **Text type** — blog, post, note, README, docs, portfolio-page, etc.
- **Context richness** — how much has already been provided (see Step 3)

If no argument: ask for text type and subject before continuing.

## 2. Discover and Select Style

Before presenting style options, discover available styles:

```bash
# Primary: user-owned styles
ls ~/.claude/styles/*.md 2>/dev/null | xargs -I{} basename {} .md
# Fallback if directory is empty or doesn't exist:
ls "$CONFIG_REPO/skills/shared/styles/style-*.md" 2>/dev/null | xargs -I{} basename {} .md | sed 's/^style-//'
```

If no styles are found, output:

> "No styles configured. Add style files to `~/.claude/styles/` — see `skills/shared/styles/style-example.md` for the format."
> Then stop.

Try to auto-detect a style by matching keywords in the argument against the discovered style names and any keyword hints in each style file's `## When to use` section. If a match is found, inform which style was detected and ask for confirmation:

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

No match found? Present the discovered style names as options (read the first line of each style file as its description):

```yaml
header: "Style"
question: "Which writing style?"
options:
  - label: "{style-name}"
    description: "{first non-header line from the style file}"
  # … one entry per discovered style
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

Load the style file for the selected style:

```bash
# Primary: user-owned styles
STYLE_FILE="$HOME/.claude/styles/style-{style}.md"
# Fallback:
STYLE_FILE="$CONFIG_REPO/skills/shared/styles/style-{style}.md"
```

```
Read(resolved STYLE_FILE path)
```

Write the full text with all rules from the loaded style file strictly applied.

Preserve:

- Language of the context input (NL → NL, EN → EN)
- Tech terms in English

## 5b. Self-Check

Verify the draft before output. Silently:

1. Loop through the draft sentence by sentence. Flag:
   - Sentences > 25 words
   - Em dashes
   - Every forbidden word from the style-specific anti-patterns list
   - Three sentences of similar length in a row (no burstiness)
   - Style-specific violations defined in the loaded style file
2. Found violations: rewrite those sentences in place. Do not output the violations list.
3. Repeat at most once if a rewrite introduces new problems. After two passes: accept remaining imperfection.

Self-check is silent. Output remains text-only (Step 6).

## 6. Output

Output ONLY the text. No commentary, no "here is your draft", no wrapping.
