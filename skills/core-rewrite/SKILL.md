---
name: core-rewrite
description: >-
  Rewrite freewritten text in a specific writing style.
  Use with /core-rewrite [style] [text] or /core-rewrite [text].
  Available styles: portfolio, insights.
argument-hint: "[style] [text]"
user-invocable: true
metadata:
  author: mileszeilstra
  version: 1.0.0
  category: core
---

# Rewrite

Rewrite freewritten text in a chosen writing style.

## 1. Parse Input

Check the first word of the argument against known styles: `portfolio`, `insights`.

- **Match found**: first word is the style, rest is the text to rewrite
- **No match**: entire argument is the text, ask which style to use
- **No argument**: ask for both style and text

If no style detected, ask:

```yaml
header: "Style"
question: "Welke schrijfstijl?"
options:
  - label: "Portfolio"
    description: "Direct, actief, toont niet claimt. Professioneel maar natuurlijk."
  - label: "Insights"
    description: "Analytisch, data-verweven, zelfverzekerd. Claim-bewijs-conclusie."
multiSelect: false
```

## 2. Load Style Profile

```
Read("references/style-{selected_style}.md")
```

The style profile contains the complete writing rules: sentence structure, word choice, structural patterns, tone, and anti-patterns.

## 3. Rewrite

Apply every rule from the loaded style profile to the input text. Follow the profile strictly. Do not blend styles or add rules not in the profile.

Preserve:

- The original meaning and information
- Technical terms and proper nouns
- The language of the input (Dutch stays Dutch, English stays English)

## 4. Output

Output ONLY the rewritten text. No explanations, no "here's the rewrite", no meta-commentary. Just the text.
