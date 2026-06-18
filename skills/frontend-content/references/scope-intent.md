# Scope & Intent — PHASE 1

Loaded at the start of PHASE 1. Inputs: `$TARGETS`, `$SEED`, `$DESIGN`, `$THEME`, `$GLOSSARY`,
`$PAGE_CONTEXT`, `$REQS`, `$ENTITIES`, `$LEARNINGS`, `$MODE`.

Produce `$ARCHETYPE`, `$BRIEF`, and confirmation from the user before any generation.

---

## 1.1 Archetype classification

Classify each target. For batch: apply per target, then derive `$SHARED_ARCHETYPE` for the brief
(most common archetype; if mixed, use "functional/app" as safe default and note exceptions).

**Classification heuristics** (check in order — first match wins):

| Signal                                                                                          | Archetype         |
| ----------------------------------------------------------------------------------------------- | ----------------- |
| Route/name contains: `landing`, `home`, `index`, `pricing`, `about`, `hero`, `marketing`        | **marketing**     |
| Design spec sections include: `hero`, `value proposition`, `social proof`, `CTA`, `testimonial` | **marketing**     |
| Route/name contains: `checkout`, `payment`, `order`, `cart`, `signup`, `register`, `onboarding` | **transactional** |
| Design spec sections include: `form`, `input fields`, `validation`, `wizard`, `step`            | **transactional** |
| Default (dashboard, list, detail, profile, settings, component)                                 | **functional**    |

Store `$ARCHETYPE[target]` per target and `$SHARED_ARCHETYPE`.

```
Archetype: {target}: {marketing | transactional | functional}  (one line per target)
```

---

## 1.2 Marketing-research hook (marketing archetype only)

If any target has `$ARCHETYPE === "marketing"`:

```bash
ls .project/thinking/*-marketing-research.md 2>/dev/null | head -1
```

**File found** → read it. Extract the `## SCOPE ANCHORS` block (topic, target audience, channels,
trajectory labels, key claims). Store as `$RESEARCH_CONTEXT`. Print:

```
Research: [✓] loaded from {filename} — audience: {audience}, claims: {N}
```

**No file found** → AskUserQuestion:

```yaml
header: "Marketing research"
question: "This page looks marketing-focused. Run /marketing-research first for stronger copy?"
options:
  - label: "Run /marketing-research first (Recommended)"
    description: "Stops here — run /marketing-research then /frontend-content again."
  - label: "Continue with seed only"
    description: "Uses seed pitch and design spec. Less market-grounded."
```

If user chooses "Run /marketing-research first":

```
Paused. Run /marketing-research {topic} then /frontend-content again.
```

Stop (leave transition set — user re-triggers after research).

If user chooses "Continue with seed only": `$RESEARCH_CONTEXT = null`. Continue.

---

## 1.3 Content-brief derivation

Derive the brief from available context. Only ask for what cannot be inferred.

**Auto-infer (no question needed):**

| Field                | Source                                                                                                        |
| -------------------- | ------------------------------------------------------------------------------------------------------------- |
| Product name         | `$SEED.name`                                                                                                  |
| Pitch / value prop   | `$SEED.pitch`                                                                                                 |
| Audience             | from `$SEED.markdown` (look for "for X" / "helps X" / audience signals) or `$RESEARCH_CONTEXT.targetAudience` |
| Domain vocabulary    | `$ENTITIES[].name` + `$PAGE_CONTEXT` dep-feature descriptions                                                 |
| Current tone signals | `$THEME.voice` if present                                                                                     |
| Must-avoid terms     | `$GLOSSARY` existing terms (enforce, not propose)                                                             |

**Ask only the gaps** — fields that cannot be reliably inferred:

```yaml
header: "Content brief"
question: "A few quick choices to tune the copy for {$TARGET / 'this batch'}:"
options:
  - label: "Confirm + proceed (Recommended)"
    description: "Uses inferred values shown below. Edit individual fields if needed."
multiSelect: false
```

Before showing the AskUserQuestion, print the inferred brief as context:

```
Inferred brief:
  Product     {$SEED.name}
  Audience    {inferred audience or "not found in seed"}
  Tone        {$THEME.voice or "not set — will match seed language"}
  Length      {concise (marketing/transactional) | rich (functional detail pages)}
  Language    {detected from seed / CLAUDE.md Language setting}
  Domain      {top-5 entity/action terms from $ENTITIES + $PAGE_CONTEXT}
  Research    {loaded from marketing-research | seed-only}
```

Then show AskUserQuestion with one extra option per field the user might want to override:

```yaml
options:
  - label: "Proceed with above (Recommended)"
    description: "Start generating."
  - label: "Adjust tone"
    description: "Change voice/mood (e.g. more formal, playful, urgent)."
  - label: "Adjust length style"
    description: "Switch concise ↔ rich."
  - label: "Adjust language or add must-include terms"
    description: "Set copy language or lock in specific phrases."
```

If user picks an "Adjust" option → ask the specific follow-up (one AskUserQuestion per adjusted field),
then loop back and show the updated brief for final confirm.

Store confirmed brief as `$BRIEF`:

```json
{
  "tone": "...",
  "lengthStyle": "concise | rich",
  "language": "...",
  "audience": "...",
  "mustInclude": [],
  "researchContext": null | { ... }
}
```

---

## 1.4 CHECKPOINT

```
### CHECKPOINT: Content Brief

| Aspect       | Value                         |
| ------------ | ----------------------------- |
| Target(s)    | {names + archetypes}          |
| Tone         | {$BRIEF.tone}                 |
| Length style | {$BRIEF.lengthStyle}          |
| Language     | {$BRIEF.language}             |
| Audience     | {$BRIEF.audience}             |
| Must-include | {list or "none"}              |
| Research     | {source or "seed-only"}       |
| i18n mode    | {inline | $I18N_FILE}         |
```

AskUserQuestion:

```yaml
header: "CHECKPOINT"
question: "Does this brief look correct? Proceed to scan and generate?"
options:
  - label: "Proceed (Recommended)"
    description: "Continue to PHASE 2 scan."
  - label: "Adjust brief"
    description: "Go back to brief questions."
```

If "Adjust brief" → return to §1.3.

---

## 1.5 Batch: shared brief

For `$MODE === "batch"`: one brief covers all targets. Per-target exceptions (e.g. one target is
marketing while others are functional) are noted in `$BRIEF.perTargetOverrides[name]` and applied
during generation — not asked separately unless the user flags it in the CHECKPOINT.
