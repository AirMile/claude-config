# Route: interactive (no-args entry point)

Fires when `/frontend-sketch` is called without arguments. Detects whether this is a
first visit or a returning session, then guides the user to the right action.

---

## Step 1: Detect state

```bash
INDEX=".project/canvas/index.json"
PROJECT="$(basename "$PWD")"
```

Read `$INDEX`. Count entries:

| State                         | Condition                | Branch |
| ----------------------------- | ------------------------ | ------ |
| First-time (no index)         | `$INDEX` does not exist  | A      |
| First-time (empty index)      | `$INDEX` exists but `[]` | A      |
| Returning — 1 canvas          | `$INDEX` has exactly 1   | B1     |
| Returning — multiple canvases | `$INDEX` has ≥2 entries  | B2     |

---

## Branch A — First-time

No slug question. Canvas will be named `default`.

Ask via AskUserQuestion:

```
Question: "What do you want to sketch?"
Header:   "Start"
Options:
  1. "Open an empty canvas"  (Recommended)
        description: "Open an empty canvas in the browser. Draw yourself or ask Claude later."
  2. "Claude creates frames right away"
        description: "Give a description — Claude sketches screens on the canvas immediately."
  3. "Cancel"
        description: "Do nothing."
```

### A.1 — Open an empty canvas

- `$SLUG = "default"`

> **Todo**: Read '.claude/skills/frontend-sketch/references/route-new.md'

Run route-new with slug `default`. Then print URL and copy to clipboard (§ URL output).

### A.2 — Claude creates frames right away

- `$SLUG = "default"`

Ask a follow-up for the prompt:

```
Question: "Describe what Claude should sketch."
Header:   "Prompt"
Options:
  1. "3 variants of the login screen"
  2. "Dashboard overview with statistics"
  3. "Onboarding flow — step by step"
  + Other (user types custom description)
```

> **Todo**: Read '.claude/skills/frontend-sketch/references/route-new.md'

Run route-new with slug `default` (idempotent).

> **Todo**: Read '.claude/skills/frontend-sketch/references/route-generate.md'

Run route-generate with `default "$PROMPT"`. Then print URL and copy to clipboard.

### A.3 — Cancel

Print: `Cancelled.` — stop.

---

## Branch B1 — Returning, 1 canvas

Print the existing canvas context:

```
Canvas: {slug}   ·   {n} frames   ·   {project}
URL: http://localhost:9876/{project}/canvas/{slug}
```

Ask via AskUserQuestion:

```
Question: "What do you want to do?"
Header:   "Sketch"
Options:
  1. "Open canvas"  (Recommended)
        description: "Print URL and copy to clipboard."
  2. "Have Claude add frames"
        description: "Give a description — Claude generates frames on the existing canvas."
  3. "Promote frame to high-fi code"
        description: "Export a frame and hand it to /frontend-design Convert."
```

### B1.1 — Open canvas

Print URL and copy to clipboard (§ URL output). Done.

### B1.2 — Have Claude add frames

- `$SLUG` = slug of the only canvas

Ask prompt (same follow-up as A.2).

> **Todo**: Read '.claude/skills/frontend-sketch/references/route-generate.md'

Run route-generate with `$SLUG "$PROMPT"`.
Print "Frames added — the canvas reloads automatically if it is open."

### B1.3 — Promote frame

- `$SLUG` = slug of the only canvas

> **Todo**: Read '.claude/skills/frontend-sketch/references/route-promote.md'

Run route-promote with `$SLUG`. (route-promote handles frame selection internally.)

---

## Branch B2 — Returning, multiple canvases

Print the canvas list first:

```
Canvases in {project}:
  #  Name           Frames  Modified
  ──────────────────────────────────
  1  default        3       14:30
  2  marketing      1       yesterday
  3  admin          0       Jun 3
```

Then ask via AskUserQuestion:

```
Question: "What do you want to do?"
Header:   "Sketch"
Options:
  1. "Open a canvas"  (Recommended)
        description: "Choose which canvas to open."
  2. "Have Claude add frames"
        description: "Choose a canvas and give a description."
  3. "Create a new canvas"
        description: "Create an extra canvas next to the existing ones."
  4. "Promote frame to high-fi code"
        description: "Choose a canvas and export a frame."
```

### B2.1 — Open a canvas

Ask canvas selection:

```
Question: "Which canvas?"
Header:   "Canvas"
Options:  one per entry in $INDEX — label = slug, description = "{n} frames · {mtime}"
```

Print URL for selected canvas and copy to clipboard.

### B2.2 — Have Claude add frames

Ask canvas selection (same as B2.1).
Ask prompt (same as A.2).

> **Todo**: Read '.claude/skills/frontend-sketch/references/route-generate.md'

Run route-generate.

### B2.3 — Create a new canvas

Ask for a new slug:

```
Question: "Name for the new canvas?"
Header:   "Name"
Options:
  1. "marketing"
  2. "admin"
  3. "mobile"
  + Other (user types custom slug)
```

> **Todo**: Read '.claude/skills/frontend-sketch/references/route-new.md'

Run route-new with the chosen slug. Print URL.

### B2.4 — Promote frame

Ask canvas selection (same as B2.1).

> **Todo**: Read '.claude/skills/frontend-sketch/references/route-promote.md'

Run route-promote with the selected slug.

---

## URL output (shared helper)

After any action that creates or opens a canvas:

```bash
URL="http://localhost:9876/{project}/canvas/{slug}"
printf '%s' "$URL" | pbcopy   # macOS
```

Print:

```
Canvas: {url}
Link copied to clipboard.
```
