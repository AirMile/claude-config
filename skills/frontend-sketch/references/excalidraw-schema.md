# Excalidraw Element Schema Cheatsheet

Quick reference for building valid Excalidraw JSON for low-fi UI sketches.

---

## Top-level scene structure

```json
{
  "type": "excalidraw",
  "version": 2,
  "source": "frontend-sketch",
  "elements": [
    /* element objects */
  ],
  "appState": {
    "viewBackgroundColor": "#ffffff",
    "gridSize": 20,
    "theme": "light"
  },
  "files": {}
}
```

---

## Common element fields (all types)

| Field             | Type    | Notes                                                                |
| ----------------- | ------- | -------------------------------------------------------------------- |
| `type`            | string  | `rectangle`, `ellipse`, `line`, `arrow`, `text`, `freedraw`, `frame` |
| `id`              | string  | Unique per element                                                   |
| `x`, `y`          | number  | Top-left corner (canvas coordinates)                                 |
| `width`           | number  | Element width in px                                                  |
| `height`          | number  | Element height in px                                                 |
| `angle`           | number  | Rotation in radians (0 = no rotation)                                |
| `strokeColor`     | string  | Hex color string                                                     |
| `backgroundColor` | string  | `"transparent"` or hex                                               |
| `fillStyle`       | string  | `"solid"`, `"hachure"`, `"cross-hatch"`, `"dots"`                    |
| `strokeWidth`     | number  | 1 (thin), 2 (medium), 4 (thick)                                      |
| `strokeStyle`     | string  | `"solid"`, `"dashed"`, `"dotted"`                                    |
| `roughness`       | number  | 0 = clean, 1 = low-fi sketch, 2 = very rough                         |
| `opacity`         | number  | 0–100                                                                |
| `groupIds`        | array   | Optional sub-grouping inside a frame — leave `[]` by default         |
| `frameId`         | string  | Set on child elements to bind them to a `type:"frame"` parent        |
| `seed`            | number  | Deterministic: `frameIndex * 10000 + elementIndex * 7 + 42`          |
| `version`         | number  | Always `1` for new elements                                          |
| `versionNonce`    | number  | `seed + 1`                                                           |
| `isDeleted`       | boolean | Always `false` for new elements                                      |
| `boundElements`   | array   | `[]` or `null`                                                       |
| `link`            | null    | Always `null` for sketches                                           |
| `locked`          | boolean | `false`                                                              |

---

## Text element extra fields

```json
{
  "type": "text",
  "text": "Label",
  "originalText": "Label",
  "fontSize": 14,
  "fontFamily": 3,
  "textAlign": "left",
  "verticalAlign": "top",
  "containerId": null,
  "lineHeight": 1.25
}
```

`fontFamily`: 1 = Virgil (hand-drawn), 2 = Helvetica, 3 = Cascadia (mono). Use **1 (Virgil)** for all low-fi sketch text — it gives the hand-drawn aesthetic.

`containerId`: set to the parent rectangle's `id` when text is bound inside a shape.

---

## Low-fi color palette

All sketches use this minimal palette (black/white/gray):

| Role             | Color     |
| ---------------- | --------- |
| Frame border     | `#adb5bd` |
| Frame fill       | `#f8f9fa` |
| Component border | `#495057` |
| Component fill   | `#ffffff` |
| Input fill       | `#f1f3f5` |
| Button fill      | `#212529` |
| Button text      | `#ffffff` |
| Label text       | `#212529` |
| Placeholder text | `#adb5bd` |
| Divider          | `#dee2e6` |
| Frame title      | `#868e96` |
| Icon placeholder | `#ced4da` |

Use `roughness: 1` for all components (low-fi sketch look). Use `roughness: 0` only for
dividers and image placeholders.

---

## Roughness guide

| Component         | roughness | Why                     |
| ----------------- | --------- | ----------------------- |
| Frame container   | 1         | Loose sketch border     |
| Button            | 1         | Hand-drawn feel         |
| Input             | 1         | Hand-drawn feel         |
| Card              | 1         | Hand-drawn feel         |
| Image placeholder | 0         | Clean box with X inside |
| Divider           | 0         | Clean line              |
| Nav bar           | 0         | Structural element      |
| Modal overlay     | 0         | Overlay backdrop        |
| Text              | 0         | Text is always clean    |

---

## Frame element (Figma-style container)

Frames are a native Excalidraw primitive — they clip their children, move as a unit,
and display a header label above the frame. Always prefer `type: "frame"` over
rectangle+text combinations.

```json
{
  "type": "frame",
  "id": "frame-1749120000000",
  "x": 60,
  "y": 60,
  "width": 380,
  "height": 600,
  "name": "Variant A — Minimal",
  "strokeColor": "#bbb",
  "backgroundColor": "transparent",
  "fillStyle": "solid",
  "strokeWidth": 2,
  "strokeStyle": "solid",
  "roughness": 0,
  "opacity": 100,
  "angle": 0,
  "seed": 42,
  "version": 1,
  "versionNonce": 43,
  "isDeleted": false,
  "groupIds": [],
  "frameId": null,
  "boundElements": [],
  "link": null,
  "locked": false,
  "roundness": null
}
```

`name` becomes the visible header label. `frameId: null` on the frame itself
(only children carry the parent reference).

**Binding children to a frame:** every child element must include
`"frameId": "<parent frame id>"` as a top-level field. Children also need normal
absolute `x/y` coordinates within the frame's bbox — Excalidraw handles the visual
parenting via `frameId`, not via coordinate transforms.

```json
{
  "type": "rectangle",
  "id": "btn-1",
  "x": 84,
  "y": 280,
  "width": 332,
  "height": 44,
  "frameId": "frame-1749120000000",
  "...": "..."
}
```

**Programmatic creation:** the canvas template uses
`ExcalidrawLib.convertToExcalidrawElements([{type:"frame", id, x, y, width, height, name}])`
which fills in all required defaults (seed, versionNonce, roundness, etc).

---

## Binding text inside a rectangle

For component-level text labels (e.g. button label), bind text inside its container:

```json
// Rectangle
{ "id": "btn-1", "boundElements": [{ "id": "btn-1-label", "type": "text" }] }

// Text bound inside
{ "id": "btn-1-label", "containerId": "btn-1", "textAlign": "center", "verticalAlign": "middle" }
```

This is independent of frame binding — a button inside a frame uses BOTH `frameId`
(to bind to the frame) AND `boundElements`/`containerId` (to bind label to button).
