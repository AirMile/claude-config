# Tauri App Vehicle

Vehicle for verifying a **Tauri desktop app's native window** — not a URL. Tauri apps render in the
OS webview (WKWebView/WebView2/WebKitGTK), not Chrome: **no CDP**, so none of the four browser
vehicles in `shared/BROWSER-VEHICLES.md` can reach them. This file is that routing table's fifth
lane — see it for the full decision, this file only covers detection, the install gate, and the
tool-loading/command reference once "Tauri app" has already been picked.

**Degrading to a browser vehicle here is always wrong, never silent.** A Tauri window isn't a URL —
there is nothing for Playwright/Claude-in-Chrome to navigate to. If this vehicle is unavailable,
stop and ask (see `## Smart-install gate` below); never quietly fall back to screenshotting the Vite
dev server in a browser tab and calling it verified — `@tauri-apps/plugin-fs|dialog|store` and other
native APIs are `undefined` there, so native-dependent items would silently "pass" against a broken
surface.

---

## Detection

A project is a Tauri app when **either**:

- `.project/project.json#stack.framework == "Tauri"` (auto-populated by `populate.js`), **or**
- a `src-tauri/` directory exists at the project root (cheap fallback when `project.json` is stale
  or absent — e.g. a project never run through `core-setup`).

---

## Smart-install gate

Mirrors `shared/APP-INSTALL-CHECK.md`'s cheap-check shape for presence, and
`design-convert/references/route-convert.md`'s Figma-MCP-gate shape for the interactive ask —
**do NOT degrade silently** in either case.

**Check**: are `mcp__tauri-mcp__*` tools available in this session? (Load via `ToolSearch
query="select:mcp__tauri-mcp__take_screenshot,mcp__tauri-mcp__query_page,mcp__tauri-mcp__click"` —
success means the project's `.mcp.json` registered the server and it connected.)

**If available** → nothing to do, proceed to the tool-loading ritual below.

**If NOT available**, check one level deeper before asking anything — is the project-side plugin
even installed (`src-tauri/Cargo.toml` has a `tauri-plugin-mcp` dependency, and a project `.mcp.json`
registers it)?

- **Not installed at the project level** →

  > **Todo**: Read `.claude/skills/core-setup/references/modules/tauri-mcp/setup-guide.md` and
  > follow its **Install** section — installs the debug-gated Rust plugin, frontend dev-init,
  > capability permission, and project `.mcp.json`.

  Then ask:

  ```yaml
  header: "Tauri MCP"
  question: "This is a Tauri app but tauri-mcp isn't installed yet. Install it now for interactive
    verification against the real app window?"
  options:
    - label: "Install now (Recommended)", description: "Runs the tauri-mcp module install — one-time, debug-only, ~5 files touched"
    - label: "Skip — verify manually instead", description: "You run `npm run tauri dev` yourself and report back what you see; no automated screenshot/click"
  multiSelect: false
  ```

- **Installed at the project level but not connected in this session** (Cargo dep + `.mcp.json`
  both present) → the tools simply haven't loaded yet; a session restart is required for Claude Code
  to read `.mcp.json`. Ask:

  ```yaml
  header: "Tauri MCP"
  question: "tauri-mcp is installed but not connected in this session. How to proceed?"
  options:
    - label: "Restart session first (Recommended)", description: "Stop here — restart Claude Code (or open a fresh session in this project) so .mcp.json loads, then re-run"
    - label: "Verify manually instead", description: "You run `npm run tauri dev` yourself and report back what you see; no automated screenshot/click"
  multiSelect: false
  ```

On "Skip"/"Verify manually" in either case: proceed, but mark any resulting verification as
**manual, unverified-by-tool** — not equivalent to an automated screenshot/click pass. Never silently
report it as if the vehicle ran.

**Non-blocking note**: unlike `APP-INSTALL-CHECK.md`'s background service, this gate blocks its
caller's verify step specifically (that's the point — a native-only item can't be verified any other
way) but must never crash the caller's overall flow. A caller that hits "Skip" should degrade its own
report to "manual verification only", not fail outright.

---

## Tool-loading ritual (deferred tools — MUST load before use)

The `mcp__tauri-mcp__*` tools are deferred: their schemas are not loaded until requested via
`ToolSearch`.

- Load the core set in **one** `ToolSearch` call — never one call per tool:
  `ToolSearch query="select:mcp__tauri-mcp__take_screenshot,mcp__tauri-mcp__query_page,mcp__tauri-mcp__click,mcp__tauri-mcp__type_text,mcp__tauri-mcp__wait_for"`
  — add `execute_js`, `inspect_element`, `read_text`, `manage_window`, `query_logs`, `manage_storage`,
  `manage_ipc`, `restart_app`, `press_key`, `mouse_action`, `dispatch_pointer`, `navigate`,
  `log_mark`, `app_bridge` to the same call when the task obviously needs them.
- Only issue a second `ToolSearch` if a later step needs a tool not anticipated up front.
- The app must actually be running (`npm run tauri dev` or equivalent) — these tools drive an
  already-launched window, they don't launch one.

---

## Command mapping (Playwright CLI → tauri-mcp tool)

| Playwright CLI                     | tauri-mcp tool                       | Notes                                                                                                                                 |
| ---------------------------------- | ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------- |
| `playwright-cli goto/open [url]`   | `navigate`                           | in-app routing only — there's no URL to open, just app-internal state                                                                 |
| `playwright-cli screenshot`        | `take_screenshot`                    | captures the native window, not a browser viewport                                                                                    |
| `playwright-cli snapshot`          | `query_page`                         | structured page/DOM query inside the webview                                                                                          |
| `playwright-cli eval` / `run-code` | `execute_js`                         | sync/async scripting inside the webview                                                                                               |
| `playwright-cli console [level]`   | `query_logs`                         | plugin's own ring buffer of forwarded console/IPC activity                                                                            |
| fill / click                       | `type_text` / `click`                | selector-based by default — no OS Accessibility permission needed                                                                     |
| (raw coordinate input)             | `dispatch_pointer` / `mouse_action`  | uses `CGEventPost` on macOS — **requires Accessibility permission**; prefer selector-based `click` unless coordinates are unavoidable |
| (window management)                | `manage_window`                      | list/focus windows — useful for multi-window Tauri apps                                                                               |
| (app lifecycle)                    | `restart_app`                        | restart the app under test without leaving the session                                                                                |
| (IPC inspection)                   | `manage_ipc`                         | inspect/observe Tauri command invocations — no browser equivalent                                                                     |
| (storage inspection)               | `manage_storage`                     | inspect `plugin-store`/localStorage-equivalent state                                                                                  |
| — (no Playwright equivalent)       | `app_bridge`, `log_mark`, `wait_for` | app-specific bridging, log markers, and condition waiting                                                                             |

---

## Preference / fallback

1. **Target is a Tauri native window** (see `## Detection`) → this vehicle, always — never a browser
   vehicle, regardless of whether the frontend also happens to run on a dev-server URL.
2. **tauri-mcp unavailable** → the smart-install gate above, never a silent fallback to a browser
   vehicle.
3. **Target is a URL the Tauri app's frontend also serves in a plain browser tab for unrelated
   reasons** (e.g. a docs site) → that's not this vehicle's lane; route normally via
   `BROWSER-VEHICLES.md`.

---

## Graceful degradation

- If the gate resolves to "verify manually" (either branch above): the caller records the check as
  user-reported, not tool-verified. This is a legitimate, explicit degradation — the failure mode
  this file guards against is _silent_ degradation to the wrong vehicle, not manual verification
  itself.
- macOS Accessibility permission (only needed for `dispatch_pointer`/`mouse_action` raw coordinate
  input) is a manual, one-time OS grant — if missing, prefer selector-based `click`/`type_text`
  instead of asking the user to grant it.
