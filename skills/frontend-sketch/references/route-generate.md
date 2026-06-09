# Route: generate

Claude designs and writes low-fi UI frames into an existing (or auto-created) canvas.

## Arguments

```
/frontend-sketch generate <slug> "<prompt>"
/frontend-sketch "<prompt>"          # shorthand: slug inferred from cwd or last canvas
```

Examples:

- `generate login "3 versions: minimal, social-first, side-image"`
- `generate dashboard "overview with metrics, recent activity, and quick-actions"`

---

## Steps

### 1. Resolve canvas

If `<slug>` is omitted: use the first entry in `.project/canvas/index.json`. If index is
empty, auto-run `route-new.md` with slug derived from the prompt (first 2–3 words,
kebab-cased).

Read `.project/canvas/<slug>.excalidraw`. If missing, run `route-new.md` first.

### 2. Read component library context

Load the built-in component vocabulary:

> **Todo**: Read '.claude/skills/frontend-sketch/references/component-library.md'

Also read `.project/project.json` → `design.components[]`. For each project component,
note its `name`, `scope`, and `variants` — these are available as additional draggable
items in the sidebar.

### 3. Read Excalidraw schema

> **Todo**: Read '.claude/skills/frontend-sketch/references/excalidraw-schema.md'

### 4. Plan frames (inline reasoning)

Before writing JSON, think through the frames:

- How many frames does the prompt request? (default: 1, max: 5 per call)
- For each frame: what is the primary layout pattern? (single-column, two-column, hero+content, etc.)
- Which built-in or project components appear in each frame?
- What are the key differentiators between variants?

Output a brief frame plan (not shown to user unless debug mode):

```
Frame plan:
  f1 — Minimal: email+password input, single CTA button, logo top-center
  f2 — Social-first: Google/GitHub OAuth buttons prominent, email below fold
  f3 — Side-image: 50/50 split, decorative left, form right
```

### 5. Compute frame placement

Read existing `elements[]` from the canvas file. Compute bounding box of all non-deleted
elements:

```
maxX = max(element.x + element.width) over all elements, or 0
```

Place new frames starting at `x = maxX + 80`, `y = 60`. Each frame is `380px` wide,
`600px` tall. Gap between frames: `60px`.

Frame positions:

- frame 1: `(maxX + 80, 60)`
- frame 2: `(maxX + 80 + 440, 60)`
- frame 3: `(maxX + 80 + 880, 60)`

**Frame ID schema:** use `"frame-" + timestamp_ms` per frame (increment by 1ms if
generating multiple in one call to keep IDs unique). Example: `"frame-1749120000000"`.
This matches the browser toolbar's "+ Nieuw frame" pattern.

### 6. Build Excalidraw elements

Use Excalidraw's **native `type: "frame"` element** — this gives proper container
behavior (clips children, moves them as a unit, displays a header label above the
frame). Do not build frames as rectangle+text combinations.

**Frame element:**

```json
{
  "type": "frame",
  "id": "{frameId}",
  "x": {x}, "y": {y},
  "width": 380, "height": 600,
  "name": "{title}",
  "strokeColor": "#bbb",
  "backgroundColor": "transparent",
  "fillStyle": "solid",
  "strokeWidth": 2,
  "strokeStyle": "solid",
  "roughness": 0,
  "opacity": 100,
  "angle": 0,
  "seed": {deterministicSeed},
  "version": 1,
  "versionNonce": {deterministicSeed + 1},
  "isDeleted": false,
  "groupIds": [],
  "frameId": null,
  "boundElements": [],
  "link": null,
  "locked": false,
  "roundness": null
}
```

`name` becomes the visible header label. `frameId` on the frame element itself is
always `null` — only its children carry a `frameId`.

**Component placement inside frame:**

Use the component recipes from `component-library.md`. Place components in absolute
canvas coordinates within the frame's bounding box. Add `frameId: "{frameId}"` to
every child element — this tells Excalidraw they belong to the frame (they will move
together and be clipped to its bounds).

Add 24px padding from frame edges.

Typical vertical layout (single-column):

- Logo area: y+24, h=48
- Heading text: y+88, h=24
- Input (email): y+128, h=40
- Input (password): y+180, h=40
- Button (primary CTA): y+236, h=44
- Divider: y+296, h=1
- Secondary action text: y+312, h=20

All child elements within a frame get `"frameId": "{frameId}"` (top-level field, not
inside `customData`) so Excalidraw knows they belong to that frame. They move together
and are clipped to the frame's bounds — Figma-style. Leave `groupIds: []` unless you
want a separate visual sub-grouping inside the frame.

**Deterministic seeds:** Use `(frameIndex * 10000 + elementIndex * 7 + 42)` as the seed
value. This makes the sketch reproducible.

### 7. Merge into canvas file

Read current `elements[]` from `.project/canvas/<slug>.excalidraw`. Filter out any
existing frame element with the same `id` we're about to write, plus any element whose
`frameId` matches (these are children of the frame being replaced). Append new elements.

Write the complete updated scene back to `.project/canvas/<slug>.excalidraw`.

### 8. Update canvas index + project.json

Update `index.json` entry for this slug:

- `frames`: array of `{ "id": "{frameId}", "title": "{title}" }` — MERGE on `id`
- `mtime`: now (ISO string)

Update `project.json → design.canvases[]` entry — same merge on `name`.

### 9. Print result

```
Generated {n} frame(s) in {slug}:

  f1  Minimal             → x=80,   y=60
  f2  Social-first        → x=520,  y=60
  f3  Side-image          → x=960,  y=60

Canvas updates live at:
  http://localhost:9876/{project}/canvas/{slug}

The canvas polls every 1.5s — changes appear automatically.

Next: /frontend-sketch promote {slug} --frame f2
```
