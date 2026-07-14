# Degraded-ref resolution (dev-inspect)

Loaded when a pasted ref has no `path:line` — the CSS-selector form (or a full ref whose line went
stale). Grammar (per core-setup setup-guide § Ref format):

```
[<tag>[#id | .c1.c2.c3][:nth-of-type(k)] ["<name>"] [— in <anchor>] [> <innerTarget>]]
```

Goal: map the ref to one `file:line` in source. Work down the ladder; stop at the first step that
yields exactly one candidate.

## Resolution ladder

1. **`#id`** — grep the id literal (`id="save-btn"`, JSX `id={...}` variants). Ids are
   page-unique; one hit is authoritative.
2. **Distinctive class** — from the class chain, grep the most _semantic_ class token; skip pure
   utility classes (Tailwind `flex`, `p-4`, `text-sm`, …) in favor of custom/component classes.
   Combine with the tag name to narrow.
3. **Accessible name** — grep the `"<name>"` literal: JSX text content, `aria-label`, `title`,
   `alt`, `placeholder`. When the project keys strings through i18n, grep the message files for the
   literal, then grep the key in components.
4. **Anchor scope** — `— in <anchor>` names an id/landmark/classed ancestor: resolve the anchor
   first (steps 1-3), then constrain the element search to that component's file/subtree.
5. **Live-DOM assist** — with a dev server available (browser tooling per PHASE 3):
   eval `document.querySelector('<selector>')` and read `outerHTML` (and any partial
   `data-inspector-*` attrs — a stale full ref often still carries the correct path). Correlate
   attributes/classes back to the source candidates. When the ref is Tailwind-only with no id and
   generic text, go live-DOM **first** — grep will be noise.

## Disambiguation

- `:nth-of-type(k)` on repeated siblings almost always means one `.map()` source site: `k` selects
  _data_, not source — the edit lands once in the shared source and affects all instances. Say so
  in the resolution line.
- `> <innerTarget>` (e.g. `svg.lucide-trash`) — the clicked child is the real subject; after
  resolving the parent element, target the icon/img inside it.
- Still > 1 candidate after the ladder → one AskUserQuestion listing the candidates as `file:line`
  options (max 4) — never guess.

Print one resolution line per ref: `[ref] → src/path/File.tsx:42 (via {ladder step})`, then return
to PHASE 1 (multi-ref: resolve all before implementing).
