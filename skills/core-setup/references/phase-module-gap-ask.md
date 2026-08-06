# Module Gap Ask (mature PHASE 0.6)

**Inputs**: `gap_slots[]` (PHASE 0.5 snapshot), `stack.framework` from `project.json`, `SEED_CONTEXT` (for weighing recommendations).

Loaded only when the framework is set AND at least one relevant slot is empty (guard in mode-mature.md).

**Slot relevance** per framework:

| Framework                        | Relevant slots                                                                                   |
| -------------------------------- | ------------------------------------------------------------------------------------------------ |
| React/Vue/Svelte (frontend SPA)  | styling, componentLibrary, testing.unit, testing.e2e, linting, state.client, state.server, forms |
| Next.js/Nuxt/Astro/Remix         | same as above                                                                                    |
| Backend (Express/Fastify/Django) | testing.unit, linting                                                                            |
| Game/CLI/Desktop/Mobile          | testing.unit, linting                                                                            |

Filter `gap_slots[]`:

- Slot already filled in `project.json#stack` → skip
- Slot not relevant for framework → skip
- Tier-1 module already installed in `package.json` but not in stack-slot → skip silently (PHASE 5 sync will fill it in)

**Multi-select modal** (Modal Option Cap is 4, not 7 — `shared/SKILL-PATTERNS.md § Modal Option Cap`. This block still lists up to 8 slots; because the option set is templated per empty relevant slot rather than a fixed list, it routes to Numbered List Selection instead of a modal split — tracked as a separate follow-up, not fixed here):

```yaml
header: "Module gaps"
question: "These tier-1 categories are not yet filled in. What do you want to add? (leave empty = install nothing)"
options:
  # One option per empty relevant slot with the Recommended tier-1 module:
  - label: "Styling: Tailwind (Recommended)"
    description: "Utility-first CSS framework"
  - label: "UI components: shadcn-ui (Recommended)"
    description: "Copy-paste components on Tailwind + Radix"
  - label: "Testing (unit): Vitest (Recommended)"
    description: "Fast Vite-native unit tester"
  - label: "Testing (e2e): Playwright (Recommended)"
    description: "End-to-end browser testing"
  - label: "Linting: Biome (Recommended)"
    description: "Lint + format in one tool"
  - label: "State (client): Zustand (Recommended)"
    description: "Minimal client state"
  - label: "State (server): TanStack Query (Recommended)"
    description: "Server state + caching"
  - label: "Forms: react-hook-form + zod (Recommended)"
    description: "Form validation with schema"
multiSelect: true
```

Only show options for empty relevant slots — not all 8 always.

Store user choice in `gap_choices[]` (list of module names). **No install here** — capture only.

**Persist to disk** (survive context compaction):

```bash
mkdir -p .project/session
echo '{"gapChoices":<JSON-array>}' > .project/session/onboard-state.json
```

Show mini-confirm:

```
Module Gap choice saved: {gap_choices.join(", ") | "none"}
Install follows in PHASE 5.8 (after sync + learnings).
```

When done: return to PHASE 1.
