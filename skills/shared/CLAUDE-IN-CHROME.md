# Claude-in-Chrome Browser Automation

Preferred path for interactive / ad-hoc browser work when a live local Chrome is connected. Built-in MCP tool set (`mcp__claude-in-chrome__*`) — no install required. For pixel/aria regression, HiDPI 2x screenshots, and token-heavy multi-viewport sweeps, use `PLAYWRIGHT.md` instead (fallback + regression owner).

---

## Tool-loading ritual (deferred tools — MUST load before use)

The `mcp__claude-in-chrome__*` tools are deferred: their schemas are not loaded until requested via `ToolSearch`.

- Load the core set (plus any task-specific tools you already know you'll need) in **one** `ToolSearch` call — never one call per tool:
  `ToolSearch query="select:mcp__claude-in-chrome__tabs_context_mcp,mcp__claude-in-chrome__navigate,mcp__claude-in-chrome__computer,mcp__claude-in-chrome__read_page,mcp__claude-in-chrome__tabs_create_mcp"` — add `read_console_messages`, `read_network_requests`, `javascript_tool`, `form_input`, `file_upload`, `gif_creator`, `resize_window` to the same call when the task obviously needs them.
- Call `tabs_context_mcp` **first**, before any other browser tool — it establishes the current tab context and doubles as the "is a live browser connected" probe (see Graceful degradation below).
- Only issue a second `ToolSearch` if a later step needs a tool you didn't anticipate.

---

## Command mapping (Playwright CLI → Claude-in-Chrome tool)

| Playwright CLI                            | Claude-in-Chrome tool                      | Notes                                                        |
| ----------------------------------------- | ------------------------------------------ | ------------------------------------------------------------ |
| `playwright-cli goto/open [url]`          | `navigate`                                 | opens/navigates a tab in the user's real Chrome              |
| `playwright-cli screenshot`               | `computer` (screenshot action)             | bound to physical display DPI — no `deviceScaleFactor:2`     |
| `playwright-cli snapshot`                 | `read_page`                                | structured a11y-tree-like read; raw text via `get_page_text` |
| `playwright-cli eval` / `run-code`        | `javascript_tool`                          | sync + async page scripting                                  |
| `playwright-cli console [level]`          | `read_console_messages`                    | apply the same ignore-patterns as `PLAYWRIGHT.md`            |
| `playwright-cli requests` / `request <i>` | `read_network_requests`                    | network inspection                                           |
| `playwright-cli resize [w] [h]`           | `resize_window`                            | resizes the OS window, not a true viewport — imprecise       |
| fill / click                              | `form_input` / `computer` (click) + `find` | `find` locates elements first                                |
| (file input)                              | `file_upload`                              | —                                                            |
| — (no Playwright equivalent)              | `gif_creator`                              | records a GIF of an interaction — new capability             |
| `playwright-cli close`                    | `tabs_close_mcp`                           | `tabs_create_mcp` to open additional tabs                    |

---

## Preference / fallback decision

1. **Ad-hoc or interactive browser work, live local Chrome connected** → Claude-in-Chrome (**preferred**).
2. **No live Chrome connected, or a scripted/repeatable capture is needed** → `playwright-cli` daemon (**fallback**).
3. **Regression** (`toHaveScreenshot()`, `toMatchAriaSnapshot()`, trace, persistent `.spec.ts`), **HiDPI 2x marketing screenshots**, or **token-heavy multi-viewport sweeps / precise viewport sizing** → Playwright, **never flip to Chrome**. See `PLAYWRIGHT.md`.

---

## Graceful degradation

- Verify a live browser is connected: `tabs_context_mcp` (or `list_connected_browsers`) succeeding is the signal.
- If no browser is connected, or the tool-loading ritual fails → fall back to the `playwright-cli` daemon (see `PLAYWRIGHT.md` § Graceful Degradation), then the runner for regression needs.
- Network throttling / offline emulation (`context.setOffline`, slow-3G) has **no Claude-in-Chrome equivalent** — those checks always stay on Playwright regardless of Chrome availability.
