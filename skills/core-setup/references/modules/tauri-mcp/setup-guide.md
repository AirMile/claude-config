# Tauri MCP Setup

Installs `tauri-plugin-mcp` (P3GLEG) — the interactive-verification vehicle for Tauri desktop apps.
Lets an MCP client (Claude Code) drive the app's real native window (WKWebView/WebView2) for
screenshot/click/query verification. No CDP needed — this is the only vehicle that can reach a
Tauri window at all; see `shared/TAURI-VEHICLE.md` for the routing decision and tool reference.

## Detection

Check both, independently:

- **Rust side**: `src-tauri/Cargo.toml` has a `tauri-plugin-mcp` dependency
- **Client side**: a project `.mcp.json` (project root) registers a `tauri-mcp` server entry

Store as `$HAS_PLUGIN` and `$HAS_CLIENT` (true/false). Both true → already installed (offer
skip/teardown upstream, per the caller's own gate — this file has no internal AskUserQuestion).

## Install

### 1. Rust dependency

Add to `src-tauri/Cargo.toml` under `[dependencies]`:

```toml
tauri-plugin-mcp = { git = "https://github.com/P3GLEG/tauri-plugin-mcp" }
```

### 2. Plugin registration (debug-only)

In `src-tauri/src/lib.rs`, the app's `run()` function builds a `tauri::Builder` and calls `.run(...)`
at the end. Restructure it to a mutable binding so the plugin can be registered conditionally,
**preserving every existing `.plugin(...)`/`.manage(...)`/`.invoke_handler(...)`/`.on_window_event(...)`
call** — only the `let` binding and the tail change:

```rust
// `mut` is only exercised by the debug-only tauri-mcp registration below;
// release builds don't touch it, hence the targeted allow.
#[allow(unused_mut)]
let mut builder = tauri::Builder::default()
    // ...all existing .plugin/.manage/.invoke_handler/.on_window_event calls, unchanged...
    ;

// tauri-mcp: debug-only interactive verification bridge. The plugin's own
// socket server also refuses to start in release builds unless explicitly
// opted in, so this is defense in depth.
#[cfg(debug_assertions)]
{
    builder = builder.plugin(tauri_plugin_mcp::init_with_config(
        tauri_plugin_mcp::PluginConfig::new("{app_name}".to_string())
            .start_socket_server(true)
            .socket_path("/tmp/tauri-mcp.sock".into()),
    ));
}

builder.run(tauri::generate_context!()).expect("error while running tauri application");
```

Replace `{app_name}` with the app's `productName` from `tauri.conf.json`. If multiple Tauri apps on
the same machine might run this plugin simultaneously, give each a distinct `socket_path` to avoid
collisions (e.g. `/tmp/tauri-mcp-{app_name}.sock`).

**Two API pitfalls not obvious from the plugin's own README** (caught by compiling against the
published 0.3.1 crate, not by reading docs — verify against `cargo check` regardless of README
wording):

- `socket_path()` takes a `PathBuf`, not `&str` — the bare string literal shown in the README does
  **not** compile; always append `.into()`.
- `builder` needs `#[allow(unused_mut)]` — in a release build the `#[cfg(debug_assertions)]` block
  compiles out entirely, so `mut` goes unused and triggers a warning without the allow.

### 3. Frontend dev-init

In the app's entry point (`src/main.tsx` for React, or the equivalent framework entry file), add:

```typescript
import { setupPluginListeners } from "tauri-plugin-mcp";

if (import.meta.env.DEV) {
  setupPluginListeners();
}
```

Place the import with the other top-level imports; the guarded call can go right before the root
render call.

### 4. npm dependency

Use the detected package manager:

```bash
# npm
npm install --save-dev tauri-plugin-mcp
# pnpm
pnpm add -D tauri-plugin-mcp
# yarn
yarn add -D tauri-plugin-mcp
# bun
bun add -d tauri-plugin-mcp
```

### 5. Capability permission

In the app's active capability file (typically `src-tauri/capabilities/default.json`), add to the
`permissions` array:

```json
"mcp:default"
```

Without this, webview→plugin commands are denied at runtime (`"mcp.push_log not allowed"`). This
entry is harmless in release builds — the plugin isn't registered there at all (see step 2), so the
permission is simply unused.

### 6. Project `.mcp.json`

Create at the project root if absent, or merge the `tauri-mcp` entry into an existing `mcpServers`
object if present:

```json
{
  "mcpServers": {
    "tauri-mcp": {
      "command": "npx",
      "args": ["tauri-plugin-mcp-server"]
    }
  }
}
```

**Project scope, not user scope** — deliberate. The server's socket path ties it to one specific
app; a user-scope registration would appear (and fail to connect) in every other project's session.

### 7. Resolve + compile-check

```bash
npm install   # or detected package manager — resolves the new devDependency
```

```bash
cd src-tauri && cargo check && cargo check --release
```

Both must succeed. The `--release` run should show no `unused_mut` warning if step 2's
`#[allow(unused_mut)]` was applied correctly — that warning's absence is itself a signal the
debug-only block is correctly excluded from release.

## Gitignore

No new entries needed. `.mcp.json` is meant to be committed (a normal, project-scoped config file,
same as any other), and the plugin produces no build artifacts in the repo — its socket lives in
`/tmp`, outside the project tree.

## Verification

- `cargo check` and `cargo check --release` (from step 7) both exit 0.
- Existing test suite (e.g. `npm run test`) still passes — this install touches no application logic.
- **Session restart required**: Claude Code only reads `.mcp.json` at session start. After install,
  tell the user to restart the session (or open a fresh one in this project) before the
  `mcp__tauri-mcp__*` tools become available — this cannot be verified automatically within the same
  session that ran the install.
- Once restarted, with the app running (`npm run tauri dev` or equivalent): load
  `mcp__tauri-mcp__take_screenshot` via ToolSearch and confirm it captures the real window.

Exit code 0 on both `cargo check` runs = installation successful; the interactive check above
confirms end-to-end wiring but depends on user action (session restart) to complete.

## Teardown

1. Remove the `tauri-plugin-mcp` dependency line from `src-tauri/Cargo.toml`.
2. Remove the `#[cfg(debug_assertions)] { builder = builder.plugin(...) }` block from `lib.rs`. If
   nothing else needs `mut builder`, revert `#[allow(unused_mut)] let mut builder` back to
   `let builder`.
3. Remove the `setupPluginListeners` import and guarded call from the frontend entry point.
4. Remove `tauri-plugin-mcp` from `package.json` devDependencies; run
   `npm uninstall tauri-plugin-mcp` (or the detected package manager's equivalent).
5. Remove `"mcp:default"` from the capability file's `permissions` array.
6. Remove the `tauri-mcp` entry from `.mcp.json` — delete the file entirely if it was the only
   registered server.

## Notes

- **P3GLEG/tauri-plugin-mcp is the canonical upstream** — install from
  `https://github.com/P3GLEG/tauri-plugin-mcp` directly. Forks surfaced via MCP marketplace listings
  (e.g. under other GitHub usernames) may lag or diverge; don't substitute one without checking it's
  actually the same project.
- **Debug-only by design, defense in depth**: the `#[cfg(debug_assertions)]` gate excludes the
  plugin from release builds at compile time; the plugin's own socket server additionally refuses to
  start in release builds unless the caller explicitly opts in via `.allow_release_builds(true)` —
  never set that.
- **Permission identifier is `mcp:default`**, not something guessable from the crate name alone —
  derived from the plugin's own `permissions/default.toml` (`[default]` permission set) plus Tauri's
  convention of stripping the `tauri-plugin-` prefix from the crate name (`tauri-plugin-mcp` →
  plugin identifier `mcp`). Not stated directly in the plugin's README; confirmed from its
  `permissions/` directory on GitHub.
- **macOS**: selector-based interactions (`click`, `type_text`, `query_page`) work without OS
  permissions. Only raw coordinate input (`dispatch_pointer`/`mouse_action`, via `CGEventPost`)
  needs Accessibility permission — prefer selector-based tools and this is a non-issue.
- **No `stack.*` slot** — dev-only tool, like `inspect-overlay`. Nothing is written to
  `project.json#stack` on install.
- See `shared/TAURI-VEHICLE.md` for the full tool-loading ritual, command mapping, and the
  smart-install gate that other skills use when this module isn't installed yet.
