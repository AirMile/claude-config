# Route: promote

Promotes a sketch frame to high-fidelity code via `/frontend-design` Convert route.

## Arguments

```
/frontend-sketch promote <slug> [--frame <frameId>]
```

- `--frame` — optional. If omitted and the canvas has exactly one frame, use it
  automatically. If multiple frames exist, ask the user to choose.

---

## Steps

### 1. Resolve frame

Read `.project/canvas/<slug>.excalidraw`.

If `--frame` is omitted:

- Count frames (elements with `customData.frameId`).
- If 1 frame: use it silently.
- If >1 frames: ask via AskUserQuestion:
  - Options: one per frame, label = `{frameId} — {frameTitle}`

### 2. Export frame as PNG via canvas endpoint

The server exposes a POST export endpoint. Call it:

```bash
curl -s -X POST \
  "http://localhost:9876/{project}/canvas/{slug}/export?frame={frameId}" \
  -o ".project/wireframes/{slug}-{frameId}.png"
```

If the server is not running or the endpoint returns an error: fall back to writing
the frame elements JSON to `.project/wireframes/{slug}-{frameId}.excalidraw` and skip
the PNG export.

Verify the output file exists. If not, print a warning and continue with the JSON
fallback.

### 3. Hand off to /frontend-design Convert

The Convert route accepts a file path as input with `$FIDELITY=sketch`.

Print handoff instructions:

```
Frame {frameId} exported to: .project/wireframes/{slug}-{frameId}.png

Handing off to /frontend-design Convert route (Sketch mode)…
```

Then invoke `/frontend-design` with the wireframe path as argument. The Convert route
will:

- Detect `.project/wireframes/` path → `$FIDELITY = sketch`
- Treat the sketch as layout reference (structure/hierarchy)
- Apply design tokens from `project.json → theme.cssVars`
- Generate high-fi code

### 4. Update canvas index

Mark the promoted frame in `.project/canvas/index.json`:

```json
{ "id": "{frameId}", "title": "...", "promoted": true, "promotedAt": "<ISO>" }
```

Update `project.json → design.canvases[].frames[]` with same merge.

### 5. Print result

```
Promoted frame {frameId} from canvas {slug}

  Wireframe:   .project/wireframes/{slug}-{frameId}.png
  Handed to:   /frontend-design Convert (sketch mode)

The Convert route will now generate high-fi code from the sketch.
```
