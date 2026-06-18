# Review Gate — PHASE 4

Loaded at the start of PHASE 4. Inputs: `$COPY_MAP`, `$BRIEF`, `$TARGETS`, `$MODE`.

Present the generated copy for approval before writing anything to disk. Copy is subjective —
never auto-apply without explicit user confirmation.

---

## 4.1 Before→after tabel

Print a compact review table grouped by target (for batch: one section per target):

```
### Copy review: {target} ({archetype})

| Element           | Category    | Before                        | After                                   |
| ----------------- | ----------- | ----------------------------- | --------------------------------------- |
| h1                | heading     | Welcome                       | Plan je week in één oogopslag           |
| button#submit     | cta         | Submit                        | Account aanmaken                        |
| .empty-state p    | empty-state | No data                       | Nog geen taken. Voeg je eerste toe.     |
| label[for=email]  | label       | Email                         | E-mailadres                             |
| aria-label        | label       | Button                        | Sluit dialoog                           |
| error.network     | error       | Something went wrong          | Kon {service} niet bereiken. Controleer …|
```

Keep "Before" values truncated to 40 chars; "After" to 60 chars. For batch: repeat per target.

Print total at the bottom:

```
Total: {N} items across {K} categories over {M} target(s)
```

---

## 4.2 Approval AskUserQuestion

```yaml
header: "Review copy"
question: "How do you want to proceed with the generated copy?"
options:
  - label: "Apply all (Recommended)"
    description: "Write all {N} items to the file(s). Reviewable via git diff."
  - label: "Edit per item"
    description: "Step through each item and confirm, skip, or override the text."
  - label: "Regenerate — adjust tone"
    description: "Change tone/style and regenerate. Loops back to generation."
  - label: "Cancel"
    description: "Discard all generated copy. No files written, no backlog change."
multiSelect: false
```

---

## 4.3 Branch: Apply all

User chose "Apply all" → proceed directly to PHASE 5 (`apply-and-sync.md`).

---

## 4.4 Branch: Edit per item

Step through `$COPY_MAP` one entry at a time. Per item:

```
Item {i}/{N} — {target} · {category} · {element}

  Before:  {old}
  After:   {new}

  [Keep generated] [Override: type your text] [Skip this item]
```

Use AskUserQuestion:

```yaml
header: "Item {i}/{N}"
question: "Keep, override, or skip this copy item?"
options:
  - label: "Keep generated (Recommended)"
    description: "{new}"
  - label: "Override"
    description: "Enter your own text for this element."
  - label: "Skip"
    description: "Leave the original placeholder unchanged."
```

If "Override": follow up with a free-text question (`argument-hint: "your copy here"`). Replace
`$COPY_MAP[i].new` with the user's input.

If "Skip": remove item from `$COPY_MAP` (no replacement for this element).

After stepping through all items: show summary (`{kept} kept, {overridden} overridden, {skipped} skipped`)
and confirm before PHASE 5. If 0 items remain → stop without backlog write.

---

## 4.5 Branch: Regenerate — adjust tone

Ask for tone adjustment:

```yaml
header: "Adjust tone"
question: "How should the tone change?"
options:
  - label: "More concise"
    description: "Shorter sentences, fewer words per element."
  - label: "More formal"
    description: "Professional register, no contractions."
  - label: "More friendly / casual"
    description: "Conversational, first-person where appropriate."
  - label: "Different language"
    description: "Change copy language (currently: {$BRIEF.language})."
```

Update `$BRIEF.tone` (or `$BRIEF.language`) with the selection. Loop back to PHASE 3:

> **Todo**: mark PHASE 4 → `in_progress` (stay in-phase for the retry). Read
> `.claude/skills/frontend-content/references/content-generation.md` and regenerate
> `$COPY_MAP` with the updated `$BRIEF`, then reload this review gate (§4.1).

Cap regenerate loops at 3 — after the third loop without Apply/Cancel, ask:

```yaml
question: "Still not quite right after 3 rounds. How do you want to continue?"
options:
  - label: "Apply best version so far"
  - label: "Edit per item"
  - label: "Cancel"
```

---

## 4.6 Branch: Cancel

```
frontend-content: Cancelled — no files written.
Transition "contenting" remains set; re-copy the prompt from the board to retry.
```

Stop. No PHASE 5.
