---
name: core-rewrite
description: Rewrite text in a configured writing style. Use with /core-rewrite.
argument-hint: "[check?] [style] [text|@path]"
user-invocable: true
metadata:
  author: claude-config
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
2. Discover available styles:
   ```bash
   # Primary: user-owned styles
   ls ~/.claude/styles/*.md 2>/dev/null | xargs -I{} basename {} .md
   # Fallback if directory is empty or doesn't exist:
   ls "$CONFIG_REPO/skills/shared/styles/style-*.md" 2>/dev/null | xargs -I{} basename {} .md | sed 's/^style-//'
   ```
   If no styles are found, output: "No styles configured. Add style files to `~/.claude/styles/` — see `skills/shared/styles/style-example.md` for the format." Then stop.
3. Next token: match against discovered style names. On match, set `style` and shift it off. Otherwise `style = null`.
4. Remaining argument: if it starts with `@`, read the file at that path and use its content as `text`. Otherwise treat the remainder as `text`.

If `style` is null, ask (present the discovered style names as options, using the first non-header line of each style file as its description):

```yaml
header: "Style"
question: "Which writing style?"
options:
  - label: "{style-name}"
    description: "{first non-header line from the style file}"
  # … one entry per discovered style
multiSelect: false
```

If `text` is null, ask the user to provide it (no fixed format — accept whatever they paste or reference via `@path`).

## 2. Load Style Profile

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

Apply all rules from the loaded style file strictly. The style file is the single source of truth — do not blend styles or add rules not in the profile.

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
