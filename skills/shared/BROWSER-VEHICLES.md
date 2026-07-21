# Browser Vehicles — Routing Decision

Canonical decision source for which browser-automation vehicle to use. Five vehicles exist, each
owning exactly one lane — **no overlap, no judgment call**. Vehicle-specific tool-loading rituals
and command references live in their own docs (`CLAUDE-IN-CHROME.md`, `PLAYWRIGHT.md`,
`PLAYWRIGHT-MCP.md`, `TAURI-VEHICLE.md`); this file only decides **which** vehicle a skill should
reach for. Skills reference this file rather than restating the rule.

**Despite the name, lane 0 below isn't a browser at all.** A Tauri desktop app's window has no URL
and no CDP — none of the other four vehicles can reach it. That lane is checked first, before any
of the URL-based reasoning below even applies.

---

## Why four browser vehicles, not one

- **Playwright CLI (daemon)** and **the Playwright runner** (`@playwright/test`) carry zero
  context-window cost — plain Bash calls, no MCP schema loaded.
- **Claude-in-Chrome** and **Playwright MCP** are both MCP tool families with deferred schemas —
  loading either costs context; loading **both in the same session doubles that cost for no
  added capability**. At most one browser MCP should be loaded per session.
- Each vehicle has exactly one capability the others lack (real user session vs. headless
  determinism vs. zero-cost scripting vs. regression baselines) — the table below routes on
  that capability, not preference.
- The fifth vehicle (**Tauri app**) sits outside this reasoning entirely — it's not competing for
  "which browser," it owns the case where there is no browser to compete for.

---

## The five lanes

| Vehicle                                           | Owns this lane                                                                                                 | Cost                                    |
| ------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- | --------------------------------------- |
| **Tauri app** (`mcp__tauri-mcp__*`)               | Target is a Tauri desktop app's **native window**, not a URL — no CDP reaches it (`TAURI-VEHICLE.md`)          | MCP schema cost, project-install gated  |
| **Playwright CLI** (daemon)                       | Scriptable / repeatable ad-hoc checks — the **default** for automated browser verification                     | Zero context cost (Bash)                |
| **Playwright CLI** (runner, `@playwright/test`)   | Regression baselines, HiDPI 2×, multi-viewport sweeps, network throttling/offline                              | Zero context cost (Bash)                |
| **Playwright MCP** (`mcp__playwright__*`)         | Interactive, turn-by-turn exploration with **no live Chrome connected** and no pre-written script              | MCP schema cost, no Chrome interference |
| **Claude-in-Chrome** (`mcp__claude-in-chrome__*`) | Interactive work where the **real user session** matters (logged-in state, extensions, "check my own browser") | MCP schema cost, live-Chrome-only       |

---

## Mechanical routing rule

Evaluate top to bottom — the first lane whose conditions are ALL true owns the item. Never pick a
vehicle by preference once a lane matches.

0. **Target is a Tauri desktop app's native window** (see `TAURI-VEHICLE.md § Detection` —
   `project.json#stack.framework == "Tauri"` or a `src-tauri/` directory) → **Tauri app**
   (`TAURI-VEHICLE.md`), unconditionally. Checked before everything below — a native window has no
   URL, so none of the URL-based reasoning in steps 1-4 applies. If the vehicle isn't installed or
   connected, follow `TAURI-VEHICLE.md § Smart-install gate` — never fall through to a browser lane.

1. **Regression / HiDPI / multi-viewport sweep / network throttling** → **Playwright runner or CLI
   daemon** (`PLAYWRIGHT.md`). Always — never flips to an MCP vehicle, regardless of Chrome
   availability. (`toHaveScreenshot()`, `toMatchAriaSnapshot()`, `deviceScaleFactor:2`,
   `setOffline`/slow-3G, 6-viewport sweeps.)

2. **Scriptable, known sequence** (navigate → assert → screenshot, steps knowable in advance,
   no live back-and-forth with a human) → **Playwright CLI daemon** (`PLAYWRIGHT.md`). This is
   the default for automated verification (e.g. `dev-ship` AGENT 2 BROWSER items).

3. **Interactive** (steps discovered as you go, or a human is watching live) — pick by whether the
   real user session matters:
   - Session/credentials/extensions/"my own browser" needed, **and** a live local Chrome is
     connected → **Claude-in-Chrome** (`CLAUDE-IN-CHROME.md`).
   - Otherwise (no live Chrome, or a clean/isolated session is fine) → **Playwright MCP**
     (`PLAYWRIGHT-MCP.md`).

4. **Neither MCP vehicle available** (no live Chrome AND Playwright MCP not connected) → degrade to
   the **Playwright CLI daemon** even for interactive work (script the best approximation), then the
   graceful-degradation ladder in `PLAYWRIGHT.md § Error Recovery`.

---

## Quick examples

| Item                                                                      | Lane                               |
| ------------------------------------------------------------------------- | ---------------------------------- |
| Verify a click opens the right panel in a Tauri desktop app               | Tauri app                          |
| AGENT 2 verify: "clicking Save shows a success toast"                     | Playwright CLI daemon (scriptable) |
| Visual regression baseline for the pricing page                           | Playwright runner                  |
| Debug round: poke around an unfamiliar page to find a bug, no live Chrome | Playwright MCP                     |
| "Check this renders correctly in my actual logged-in Gmail tab"           | Claude-in-Chrome                   |
| HiDPI marketing screenshot, dark mode variant                             | Playwright runner (CLI daemon)     |

---

## Cross-references

- Tool-loading + command mapping: `CLAUDE-IN-CHROME.md`, `PLAYWRIGHT-MCP.md`, `PLAYWRIGHT.md`,
  `TAURI-VEHICLE.md`.
- Visual verification loop pattern (compare/fix rounds): `VERIFICATION.md`.
- `dev-ship`/`dev-verify` classification that feeds into this routing: `dev-ship/references/dev-verify/references/test-classification.md`.
