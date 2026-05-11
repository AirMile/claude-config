---
name: core-rewrite
description: >-
  Rewrite freewritten text in a specific writing style, or check text against a style without rewriting.
  Use with /core-rewrite [style] [text], /core-rewrite [style] @path, or /core-rewrite check [style] [text|@path].
  Available styles: personal, clear, portfolio, insights.
argument-hint: "[check?] [style] [text|@path]"
user-invocable: true
metadata:
  author: mileszeilstra
  version: 1.1.0
  category: core
---

# Rewrite

Rewrite freewritten text in a chosen writing style, or check text for style compliance.

## 1. Parse Input

The argument can take these forms:

- `[style] [text]` — rewrite text
- `[style] @path/to/file.md` — read file, rewrite content
- `check [style] [text|@path]` — compliance check, no rewrite
- `[text]` — ask which style, then rewrite
- (empty) — ask for both style and text

Detection order:

1. If first token equals `check`: set `mode = "check"`, shift it off. Otherwise `mode = "rewrite"`.
2. Next token: match against known styles `personal`, `clear`, `portfolio`, `insights`. On match, set `style` and shift it off. Otherwise `style = null`.
3. Remaining argument: if it starts with `@`, read the file at that path and use its content as `text`. Otherwise treat the remainder as `text`.

If `style` is null, ask:

```yaml
header: "Style"
question: "Welke schrijfstijl?"
options:
  - label: "Personal"
    description: "Persoonlijke ik-voice. Schrijf alsof je het iemand vertelt aan tafel. Voor blogs, posts, notes."
  - label: "Clear"
    description: "Objectief in Miles-stijl. Sprekend-vertellend, geen 'ik'. Voor README's, docs, uitleg."
  - label: "Portfolio"
    description: "Direct, actief, toont niet claimt. Professioneel maar natuurlijk. Voor demo/showcase."
  - label: "Insights"
    description: "Analytisch, data-verweven, zelfverzekerd. Claim-bewijs-conclusie."
multiSelect: false
```

If `text` is null, ask the user to provide it (no fixed format — accept whatever they paste or reference via `@path`).

## 2. Load Style Profile

```
Read("../shared/styles/_anti-patterns.md")
Read("../shared/styles/style-{style}.md")
```

Both files are in force. Apply the shared anti-patterns AND the style-specific rules. The style file references `_anti-patterns.md` for its inherited rules — treat them as part of the profile.

## 3. Execute

### If `mode == "rewrite"`

Apply every rule from the loaded style profile to `text`. Follow the profile strictly. Do not blend styles or add rules not in the profile.

Preserve:

- The original meaning and information
- Technical terms and proper nouns
- The language of the input (Dutch stays Dutch, English stays English)

### If `mode == "check"`

Do NOT rewrite. Walk through `text` sentence-by-sentence and check each rule from the loaded style profile. Output format:

```
Style: {style}

✓ {rule that passes}: {brief evidence}
✗ Zin {N}: "{quote}" — {rule violated, brief reason}
...

Score: {X overtredingen / Y zinnen}
```

Group passes at the top, violations below, ordered by sentence number. Quote the offending text inline. Keep each violation to one line — name the rule, name what's wrong, no over-explanation.

## 4. Output

### Rewrite mode

Output ONLY the rewritten text. No explanations, no "here's the rewrite", no meta-commentary.

### Check mode

Output ONLY the check report (format above). No rewrite, no fix-suggestions unless explicitly asked in a follow-up.
