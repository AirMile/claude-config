# Built-in Low-fi Component Library

Each section defines the Excalidraw element recipe for one component. Use these as
building blocks when generating frames in `route-generate.md`.

All coordinates are **relative to the frame origin** `(fx, fy)`. Add frame `(fx, fy)` to
get canvas coordinates. Padding from frame edge: 24px.

`{fid}` = frameId, `{i}` = element index within frame (for seed calculation).

---

## Button (primary)

Width: 332px, Height: 44px. Typical position: center, below inputs.

```
Elements:
  1. rectangle — button background
     x: fx+24, y: {provided}, w: 332, h: 44
     fill: #212529, stroke: #212529, fillStyle: solid, roughness: 1
     groupIds: [{fid}, {fid}-btn]
     boundElements: [{ id: {fid}-btn-label, type: text }]

  2. text — label
     x: fx+24, y: {provided}, w: 332, h: 44
     text: "Sign in", fontSize: 15, fontFamily: 1
     textAlign: center, verticalAlign: middle
     strokeColor: #ffffff, containerId: {fid}-btn
     groupIds: [{fid}, {fid}-btn]
```

## Button (secondary / ghost)

Same shape, different fill:

```
  fill: transparent, stroke: #495057, strokeStyle: solid
  text strokeColor: #212529
```

---

## Input field

Width: 332px, Height: 40px.

```
Elements:
  1. rectangle — input box
     x: fx+24, y: {provided}, w: 332, h: 40
     fill: #f1f3f5, stroke: #ced4da, fillStyle: solid, roughness: 1
     groupIds: [{fid}, {fid}-input-N]

  2. text — placeholder
     x: fx+32, y: {provided+10}, w: 316, h: 20
     text: "Email address", fontSize: 13, fontFamily: 1
     strokeColor: #adb5bd, textAlign: left
     groupIds: [{fid}, {fid}-input-N]
```

---

## Label (above input)

```
  text — label
  x: fx+24, y: {provided}, w: 332, h: 16
  text: "Email", fontSize: 12, fontFamily: 1
  strokeColor: #495057, textAlign: left
  groupIds: [{fid}]
```

---

## Heading text

```
  text — heading
  x: fx+24, y: {provided}, w: 332, h: 32
  text: "Sign in to your account", fontSize: 22, fontFamily: 1
  strokeColor: #212529, textAlign: left
  groupIds: [{fid}]
```

---

## Body text / subheading

```
  text — body
  x: fx+24, y: {provided}, w: 332, h: 20
  text: "Enter your credentials below.", fontSize: 14, fontFamily: 1
  strokeColor: #868e96, textAlign: left
  groupIds: [{fid}]
```

---

## Logo / brand mark placeholder

Width: 40px, Height: 40px. Top-center of frame.

```
Elements:
  1. rectangle — logo box
     x: fx+170, y: fy+24, w: 40, h: 40
     fill: #212529, stroke: #212529, fillStyle: solid, roughness: 0
     groupIds: [{fid}]

  2. text — brand initial
     x: fx+170, y: fy+24, w: 40, h: 40
     text: "A", fontSize: 18, fontFamily: 1
     strokeColor: #ffffff, textAlign: center, verticalAlign: middle
     containerId: logo-rect-id
     groupIds: [{fid}]
```

---

## Divider (horizontal rule)

```
  line
  x: fx+24, y: {provided}, points: [[0,0],[332,0]]
  strokeColor: #dee2e6, strokeWidth: 1, roughness: 0
  groupIds: [{fid}]
```

---

## Divider with label ("or continue with")

```
  1. line — left  x: fx+24,  y: {provided}, points: [[0,0],[120,0]]
  2. text — label x: fx+160, y: {provided-8}, text: "or", fontSize: 12, fontFamily: 1, strokeColor: #adb5bd
  3. line — right x: fx+196, y: {provided}, points: [[0,0],[160,0]]
  All: roughness: 0, groupIds: [{fid}]
```

---

## OAuth button (Google / GitHub)

Width: 332px, Height: 40px.

```
Elements:
  1. rectangle — button
     fill: #ffffff, stroke: #ced4da, roughness: 1
     w: 332, h: 40
     groupIds: [{fid}, {fid}-oauth-N]

  2. text — icon placeholder
     x: fx+40, y: {y+10}, w: 20, h: 20
     text: "G", fontSize: 14, fontFamily: 1, strokeColor: #495057
     groupIds: [{fid}, {fid}-oauth-N]

  3. text — label
     x: fx+68, y: {y+10}, w: 240, h: 20
     text: "Continue with Google", fontSize: 13, fontFamily: 1, strokeColor: #212529
     groupIds: [{fid}, {fid}-oauth-N]
```

---

## Card

Width: 332px, Height: variable (min 80px).

```
Elements:
  1. rectangle — card
     fill: #ffffff, stroke: #dee2e6, roughness: 1
     strokeWidth: 1

  2. (optional) text — card title inside
     fontSize: 14, fontFamily: 1, strokeColor: #212529
     x: fx+24+16, textAlign: left
```

---

## Nav bar (top)

Spans full frame width. Height: 48px. Anchored to top of frame.

```
Elements:
  1. rectangle — nav background
     x: fx, y: fy, w: 380, h: 48
     fill: #ffffff, stroke: #dee2e6, strokeStyle: solid, roughness: 0
     fillStyle: solid
     groupIds: [{fid}, {fid}-nav]

  2. text — logo/brand name (left)
     x: fx+16, y: fy+14, w: 120, h: 20
     text: "Brand", fontSize: 15, fontFamily: 1, strokeColor: #212529
     groupIds: [{fid}, {fid}-nav]

  3. text — nav links (right)
     x: fx+220, y: fy+14, w: 144, h: 20
     text: "Home  About  Login", fontSize: 12, fontFamily: 1, strokeColor: #868e96
     textAlign: right
     groupIds: [{fid}, {fid}-nav]
```

---

## Image placeholder

Width: 332px, Height: 160px (adjustable).

```
Elements:
  1. rectangle — outer box
     fill: #f1f3f5, stroke: #ced4da, roughness: 0

  2. line — diagonal 1 (top-left to bottom-right)
     points: [[0,0],[332,160]], strokeColor: #ced4da, roughness: 0

  3. line — diagonal 2 (top-right to bottom-left)
     points: [[332,0],[0,160]], strokeColor: #ced4da, roughness: 0
```

---

## Avatar (circle)

Diameter: 40px.

```
Elements:
  1. ellipse — avatar circle
     w: 40, h: 40
     fill: #dee2e6, stroke: #adb5bd, roughness: 0

  2. text — initial
     text: "U", fontSize: 14, fontFamily: 1
     strokeColor: #868e96, textAlign: center, verticalAlign: middle
     containerId: ellipse-id
```

---

## Badge / chip

Width: ~60px, Height: 22px.

```
Elements:
  1. rectangle — badge
     fill: #e9ecef, stroke: #ced4da, roughness: 0
     roundness: { type: 3 }  (rounded corners)
     w: 60, h: 22

  2. text — label
     text: "New", fontSize: 11, fontFamily: 1
     strokeColor: #495057, textAlign: center, verticalAlign: middle
     containerId: badge-rect-id
```

---

## Toggle (on/off)

Width: 44px, Height: 24px.

```
Elements:
  1. rectangle — track (on state)
     w: 44, h: 24, fill: #212529, stroke: #212529, roughness: 0
     roundness: { type: 3 }

  2. ellipse — thumb
     w: 18, h: 18, fill: #ffffff, stroke: #ffffff, roughness: 0
     x: track-x + 22, y: track-y + 3
```

---

## Checkbox

Size: 18px × 18px.

```
Elements:
  1. rectangle — box
     w: 18, h: 18, fill: #ffffff, stroke: #495057, roughness: 1

  2. (if checked) line — checkmark
     points: [[2,9],[7,14],[16,4]]
     strokeColor: #212529, strokeWidth: 2, roughness: 0
```

---

## Tabs bar

Width: full frame (332px), Height: 40px.

```
Elements:
  1. rectangle — tab bar background
     w: 332, h: 40, fill: #ffffff, stroke: #dee2e6, roughness: 0

  For each tab (3 tabs = 332/3 ≈ 110px each):
  2. text — tab label
     fontSize: 13, fontFamily: 1

  3. rectangle — active tab underline
     w: 110, h: 2, fill: #212529, stroke: #212529, roughness: 0
     y: tabBar-y + 38  (bottom of bar)
```

---

## Modal overlay

Covers frame content. Width: 340px, Height: 240px. Centered in frame.

```
Elements:
  1. rectangle — backdrop
     x: fx, y: fy, w: 380, h: 600
     fill: #000000, opacity: 40, stroke: transparent
     fillStyle: solid, roughness: 0

  2. rectangle — modal card
     x: fx+20, y: fy+180, w: 340, h: 240
     fill: #ffffff, stroke: #dee2e6, roughness: 0
     strokeWidth: 1

  3. text — modal title
     inside modal card, fontSize: 16, fontFamily: 1, strokeColor: #212529
```

---

## Sidebar (left panel)

Width: 200px, Height: full frame height.

```
Elements:
  1. rectangle — sidebar
     x: fx, y: fy, w: 200, h: 600
     fill: #f8f9fa, stroke: #dee2e6, roughness: 0

  For each nav item (y spacing: 40px):
  2. text — nav label
     fontSize: 13, fontFamily: 1, strokeColor: #495057
     x: fx+16, textAlign: left
```

---

## Project component (from design.components[])

When a project component (e.g. `BrandButton`) appears in `design.components[]`, render
it as a labeled rectangle that shows its name and key variants:

```
Elements:
  1. rectangle — component box
     fill: #fff3cd, stroke: #ffc107, roughness: 1
     (yellow tint = "project component, not generic")

  2. text — component name
     text: "{component.name}", fontFamily: 1, fontSize: 13, strokeColor: #664d03

  3. text — variants hint (if variants[].length > 0)
     text: "{variants.join(' / ')}", fontSize: 10, fontFamily: 1, strokeColor: #997404
```
