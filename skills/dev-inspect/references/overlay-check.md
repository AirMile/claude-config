# Overlay check (dev-inspect)

Loaded when `/dev-inspect` is invoked **without** a pasted ref, or when every pasted ref is
**degraded-mode** (CSS-selector form, no `path:line`). A full-mode ref never lands here — its
presence proves the overlay is installed and injecting.

## 1. Detect installation

Run the detection from
[core-setup setup-guide § Detection](../../core-setup/references/modules/inspect-overlay/setup-guide.md)
(cite, don't restate): Vite → `inspectOverlay` in `vite.config.*`; Next.js →
`public/_inspect/client.js` present; plain HTML → `inspect-overlay-client.js` referenced in
`index.html`. `installed` implies `configured` (no half state).

Additionally note the **mode**: a degraded ref in a Vite/Next React project where full mode should
be available means the Babel plugin is not injecting `data-inspector-*` attrs — say so explicitly:
_"full mode broken or not configured (Babel plugin not injecting data-attrs)"_ — the install path
below repairs it.

## 2. Branch

**Installed + no ref** — the user invoked the skill without picking an element. Two lines, no
question: how to pick (toggle Cmd/Ctrl+`.` → click the element → paste the `[…]` ref), or continue
directly when the invocation carries a usable change description → manual locate (§ 3).

**Installed + degraded ref only** — continue with `references/resolve-degraded.md`; when full mode
should be available (React project), append the broken-full-mode notice above and offer the repair
option (a) alongside continuing.

**Not installed (or full mode broken)** — one AskUserQuestion (`multiSelect: false`):

```yaml
header: "Inspect overlay"
question: "The inspect overlay is not installed{/ full mode is broken} in this project. How to proceed?"
options:
  - label: "Install via core-setup (Recommended)"
    description: "Runs /core-setup install inspect-overlay — then toggle Cmd/Ctrl+., click the element, and repaste the ref"
  - label: "Continue without overlay"
    description: "Locate the element manually from the description/ref text (grep-based)"
  - label: "Cancel"
    description: "Stop here"
```

- **(a) Install** — invoke the `core-setup` skill (Skill tool) with `install inspect-overlay`; its
  module setup-guide owns detection, framework routing, and install. This run ends after install
  with one line: _"Overlay active — pick the element (Cmd/Ctrl+`.` → click) and repaste the ref."_
- **(b) Continue without overlay** — manual locate à la dev-tweak PHASE 1: Grep → targeted Read,
  seeded with whatever the ref/description offers (id, distinctive classes, accessible-name text).
  Then rejoin the normal flow at PHASE 1; PHASE 3 locates the element by CSS selector instead of
  data-attrs.
- **(c) Cancel** — stop, no edits.
