# Playwright MCP Browser Automation

Vehicle for **interactive, turn-by-turn browser exploration with no live local Chrome connected**
(or where a clean/isolated session is fine). Own Chromium instance, deterministic a11y-tree
element refs (no vision/coordinate clicking). See `shared/BROWSER-VEHICLES.md` for the full routing
decision — this file only covers the tool-loading ritual and command reference once that decision
has already picked this vehicle.

**Narrow lane, deliberately.** Scriptable/repeatable work stays on the Playwright CLI daemon
(`PLAYWRIGHT.md`) — zero context cost there vs. MCP schema cost here. Only reach for this vehicle
when the sequence genuinely can't be scripted in advance (exploration, live back-and-forth) **and**
Claude-in-Chrome doesn't apply (no live Chrome, or the real user session doesn't matter for this
check). Loading this MCP alongside Claude-in-Chrome in the same session is never correct — at most
one browser MCP per session (`BROWSER-VEHICLES.md § Why four vehicles`).

---

## Tool-loading ritual (deferred tools — MUST load before use)

The `mcp__playwright__*` tools are deferred: their schemas are not loaded until requested via
`ToolSearch`.

- Load the core set (plus any task-specific tools already known to be needed) in **one**
  `ToolSearch` call — never one call per tool:
  `ToolSearch query="select:mcp__playwright__browser_navigate,mcp__playwright__browser_snapshot,mcp__playwright__browser_click,mcp__playwright__browser_type,mcp__playwright__browser_take_screenshot"`
  — add `browser_evaluate`, `browser_console_messages`, `browser_network_requests`,
  `browser_fill_form`, `browser_select_option`, `browser_press_key`, `browser_hover`,
  `browser_drag`/`browser_drop`, `browser_file_upload`, `browser_wait_for`, `browser_tabs`,
  `browser_resize` to the same call when the task obviously needs them.
- Only issue a second `ToolSearch` if a later step needs a tool not anticipated up front.

---

## Command mapping (Playwright CLI → Playwright MCP)

| Playwright CLI                            | Playwright MCP tool                   | Notes                                                               |
| ----------------------------------------- | ------------------------------------- | ------------------------------------------------------------------- |
| `playwright-cli goto/open [url]`          | `browser_navigate`                    | opens a page in the MCP's own Chromium                              |
| `playwright-cli screenshot`               | `browser_take_screenshot`             | full viewport control (unlike Claude-in-Chrome's display-DPI bound) |
| `playwright-cli snapshot`                 | `browser_snapshot`                    | structured a11y tree with element refs                              |
| `playwright-cli eval` / `run-code`        | `browser_evaluate`                    | sync + async page scripting                                         |
| `playwright-cli console [level]`          | `browser_console_messages`            | apply the same ignore-patterns as `PLAYWRIGHT.md`                   |
| `playwright-cli requests` / `request <i>` | `browser_network_requests`            | network inspection                                                  |
| `playwright-cli resize [w] [h]`           | `browser_resize`                      | true viewport resize (not an OS window)                             |
| fill / click                              | `browser_fill_form` / `browser_click` | deterministic ref-based targeting from `browser_snapshot`           |
| (drag interactions)                       | `browser_drag` / `browser_drop`       | —                                                                   |
| (file input)                              | `browser_file_upload`                 | —                                                                   |
| `playwright-cli close`                    | `browser_close`                       | `browser_tabs` to manage multiple tabs                              |

---

## Preference / fallback

1. **Interactive exploration, no live Chrome connected, or a clean isolated session is fine** →
   Playwright MCP (this file).
2. **Scriptable/repeatable, known sequence** → never this vehicle — use the Playwright CLI daemon
   (`PLAYWRIGHT.md`) instead, even mid-session.
3. **Regression, HiDPI, multi-viewport, throttling** → never this vehicle — Playwright runner/CLI
   daemon owns those unconditionally (`BROWSER-VEHICLES.md § Mechanical routing rule` step 1).
4. **Real user session matters and a live local Chrome is connected** → Claude-in-Chrome instead
   (`CLAUDE-IN-CHROME.md`).

---

## Graceful degradation

- If the Playwright MCP server is not connected in this environment, degrade to the Playwright CLI
  daemon (script the closest approximation) — see `PLAYWRIGHT.md § Graceful Degradation` for the
  full ladder.
- No install is required to use this vehicle when the MCP server is already connected in the
  session's tool list — unlike the CLI/runner, there is nothing for `core-setup` to install.
