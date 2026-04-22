---
name: core-note
description: Quick-note context from chat or free text to Obsidian. Use with /core-note for lightweight saving of decisions, insights, or action items.
disable-model-invocation: true
metadata:
  author: mileszeilstra
  version: 1.0.0
  category: core
---

# Note

Quick-note workflow to save context from a conversation or free text to Obsidian. Lightweight and focused on saving, not generating.

## When to Use

- User starts with `/core-note` (with or without description)
- User wants to quickly save a decision, insight, or action item
- User wants to capture something from the current conversation

## Process

### Step 1: Choose Input Source

Use AskUserQuestion:

```yaml
header: "Bron"
question: "Wat wil je capturen?"
options:
  - label: "Chat context (Recommended)", description: "Analyseer dit gesprek en extraheer kernpunten"
  - label: "Vrije tekst", description: "Typ of plak nieuwe content"
  - label: "Beide", description: "Chat context als basis, aangevuld met eigen tekst"
multiSelect: false
```

If an inline argument was provided with `/core-note`, treat it as free text input and skip this step.

### Step 2: Compose Content

**If "Chat context":**

1. Analyze the conversation:
   - What key decision, insight, or action item was discussed?
   - What is the most important takeaway?
2. Formulate a concise title + body (max 3-5 sentences)

**If "Vrije tekst":**

1. If no inline argument provided, ask: "Wat wil je vastleggen?"
2. Use the input as-is, formulate a title from the content

**If "Beide":**

1. Extract chat context first (same as above)
2. Show the extracted context to the user
3. Ask: "Wat wil je toevoegen of aanpassen?"
4. Merge into final content

**Always show a preview:**

```
CAPTURE PREVIEW

Title: [titel]
Content: [samenvatting, max 3-5 zinnen]
```

Use AskUserQuestion:

```yaml
header: "Preview"
question: "Klopt dit?"
options:
  - label: "Ja, klopt (Recommended)", description: "Ga door met opslaan"
  - label: "Aanpassen", description: "Ik wil de tekst wijzigen"
multiSelect: false
```

If "Aanpassen": ask what to change, update, and show preview again.

### Step 3: Choose Destination

Use AskUserQuestion:

```yaml
header: "Bestemming"
question: "Waar wil je dit opslaan?"
options:
  - label: "Obsidian (Recommended)", description: "Sla op als notitie in je vault"
  - label: "Kopieer naar clipboard", description: "Kopieer markdown naar clipboard (niet opslaan)"
multiSelect: false
```

### Step 4a: Obsidian (if chosen)

**Auto-detect folder** based on content:

| Content signal                   | Obsidian folder                                                  |
| -------------------------------- | ---------------------------------------------------------------- |
| Idee, concept, brainstorm        | `Ideas/` (subfolder: Games/, Apps/, Stories/, Websites/, Other/) |
| Academic, studie, onderzoek      | `Academic/`                                                      |
| Project-specifiek, architectuur  | `Projects/`                                                      |
| Referentie, documentatie, how-to | `Reference/`                                                     |
| Creatief schrijven, verhaal      | `Writing/`                                                       |
| Onduidelijk                      | Root (`/`)                                                       |

Use AskUserQuestion:

```yaml
header: "Map"
question: "Opslaan in {suggested folder}?"
options:
  - label: "Ja (Recommended)", description: "Opslaan in {suggested folder}"
  - label: "Andere map", description: "Kies een andere locatie"
multiSelect: false
```

If "Andere map": ask which folder to use.

**Write the note:**

```
mcp__obsidian__write_note(
  path="{folder}/{title}.md",
  content="{body}",
  frontmatter={type: "capture", created: "{YYYY-MM-DD}", source: "claude-chat"}
)
```

**Update Home.md** (only if folder is `Ideas/`):

```
mcp__obsidian__patch_note(
  path="Home.md",
  oldString="## Recent Ideas\n",
  newString="## Recent Ideas\n- [[{title}]]\n"
)
```

If patch fails (string not found), skip silently.

### Step 4b: Clipboard (if chosen)

1. Wrap output in a code block with `markdown` language tag for copy button
2. Display the content — user copies via the code block's copy button

### Step 5: Confirmation

Show a confirmation message:

```
CAPTURED!

Obsidian: {folder}/{title}.md
```

## Best Practices

- Keep it lightweight — this is quick capture, not idea development
- Title should be concise and scannable (max ~8 words)
- Body should be 3-5 sentences max
- Auto-detect should be a sensible default, not a complex analysis
- If clipboard chosen, wrap in markdown code block for easy copying

### Language

Follow the Language Policy in CLAUDE.md.
