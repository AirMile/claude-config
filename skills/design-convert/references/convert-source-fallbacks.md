# Convert Source Fallbacks

Loaded from `route-convert.md` PHASE 0.1 in two cases only: the Figma MCP server is not connected, or the URL points at a Figma Make file. A run whose Figma MCP answers normally never needs this file.

## Figma MCP not connected

Do NOT degrade silently — the fallback ladder matters: REST API (still ground truth) beats screenshot estimation. Check whether a Figma API token is available (`$FIGMA_TOKEN` env var), then ask:

```yaml
header: "Figma MCP"
question: "The Figma MCP server is not connected. How to proceed?"
options:
  - label: "Fix the connection first (Recommended)", description: "Stop here — run /mcp to (re)authenticate figma, then re-run this conversion"
  - label: "REST API fallback", description: "Exact values via api.figma.com — ground truth without MCP" # include only when $FIGMA_TOKEN was found
  - label: "Screenshot fallback", description: "Vision estimation — values will be marked 'estimated'. Best source: a frame PNG exported from Figma (right-click frame → Export)"
multiSelect: false
```

On "Fix the connection first": exit the skill. On "REST API fallback": follow the REST procedure below. On "Screenshot fallback": ask the user to export the frame as PNG and provide the file path (pixel-perfect, preferred); only if they can't, fall back to the design-tool row (Playwright capture of figma.com — last resort, canvas rendering is unreliable).

**Do not offer `.fig` file parsing as a fallback** — the format is a proprietary binary (fig-kiwi); community parsers are reverse-engineered and break on format updates. A user who can export `.fig` can also export a frame PNG or create an API token.

## REST API fallback (`$INPUT_SOURCE = "figma-rest"`)

Parse the file key and node id from the URL — `figma.com/design/{key}/...?node-id={id}` (the id uses `-` in URLs, `:` in API calls).

```
curl -sH "X-Figma-Token: $FIGMA_TOKEN" "https://api.figma.com/v1/images/{key}?ids={id}&format=png&scale=2"
  → returns JSON with an image URL — download it to .project/tmp/source-capture.png → Read it → $SOURCE_IMAGE
curl -sH "X-Figma-Token: $FIGMA_TOKEN" "https://api.figma.com/v1/files/{key}/nodes?ids={id}" > .project/tmp/source-node.json
  → node tree with exact fills, typography, layout → $SOURCE_STRUCTURE
```

Downstream, `figma-rest` behaves like `figma-mcp`: 0.2 derives structure from `$SOURCE_STRUCTURE`, and the mode files (PHASE 1) take ground-truth values (labeled `computed`) from the node-tree JSON instead of `get_design_context` / `get_variable_defs`.

## Figma Make URLs (`$INPUT_SOURCE = "figma-make"`)

Make files are not design canvases — the Figma MCP canvas tools (`get_metadata` / `get_design_context`) do not work on them. The preview **is** real DOM, and the interaction spec typically lives as text in the Make chat panel. Do not route these through the MCP or design-tool paths.

1. Capture the live preview via Claude-in-Chrome (the user's logged-in Chrome session — Make previews require auth): load tools per `shared/CLAUDE-IN-CHROME.md`, `navigate` to the URL, wait for the preview to render, screenshot → `.project/tmp/source-capture.png` → Read it → `$SOURCE_IMAGE`. If Claude-in-Chrome is unavailable: ask the user to publish the Make preview (Share → Publish) and provide the published URL (then treat as a normal `url` source), or to export a full-page screenshot (`file` fallback, vision-estimated values).
2. Downstream, `figma-make` behaves like `url`: the preview DOM is ground truth — copy mode's § 1.0 computed-style extraction applies (`$EXTRACTED_STYLES` labeled `computed`), run through the same Claude-in-Chrome session.
3. Ask once (optional, recommended): _"Paste the Make spec / chat description of the interactions, if there is one — it becomes interaction ground truth."_ Store the pasted text; `convert-interactions.md` Step 1 (loaded in 0.2) parses it.
4. If the user offers Make-generated code (copy/download): treat it as a **value source, not a code source** — same rule as Figma-emitted code in the mode files' codegen rules.
