# Dev Server Launch Procedure

Loaded from PHASE 0 step 9 when ≥1 MANUAL, AUTO/BROWSER, or live-server AUTO/CLI item requires a running dev server.

## Launch procedure

0. **Pre-launch staleness gate** — if `git -C {worktree-path} rev-list --count HEAD..main` > 0 → AskUserQuestion: "Rebase worktree on main first (Recommended)" (invoke `shared/WORKTREE.md → Staleness rebase`, re-run this check) / "Launch without rebase" (continue, tag output `DEV SERVER (stale, {n} commits behind): {url}`) / "Stop" (abort; user resolves manually).
1. Resolve the dev command in this precedence:
   - `feature.json` → `build.runCommand` (per-feature override)
   - `.project/project.json` → `scripts.dev` (project default)
   - Fallback: `npm run dev`
2. Probe the default port (e.g. `curl -sf http://localhost:3000 -o /dev/null`):
   - **Miss** → proceed to item 3 (launch).
   - **Hit** → do NOT silently reuse. Verify the running server is the worktree project (process cwd via `lsof -p <pid> | grep cwd` / `pwdx <pid>`, or its git HEAD vs the worktree branch). Confirmed worktree → reuse the URL, skip launch. Main or another project serving → kill it or launch from the worktree on a free port. Never run MANUAL tests against a server with unverified branch identity.
3. Otherwise start via `Bash` with `run_in_background: true`. If the URL is already known (fixed
   port from `feature.json`/`project.json`/the default probed in step 2), poll it directly:
   `curl -sf {url} -o /dev/null`, retry every 1-2s — 2xx/3xx/4xx all count as "server up" (same
   readiness contract as Playwright's own `webServer` config). This is more robust than matching
   ready-line wording, which varies by framework/version and silently breaks detection with no
   fallback but the timeout. If the port is dynamic and the URL is only known once the process
   prints it (e.g. an auto-assigned port), fall back to the `Monitor`-based scan for a `Local:` /
   `ready` / `listening on` line to extract the URL, then switch to URL-polling to confirm
   readiness. Timeout 30s (either path) → graceful fallback.
4. Store `{devServerUrl, devServerPid}` on the live signal so PHASE 6 / PHASE Finalize can stop the
   process: `echo '{"skill":"verify","devServerUrl":"{url}","devServerPid":{pid}}' | node ~/.claude/scripts/ship-checkpoint.js signal {name}`
   (replace-wholesale, same as every other signal write — re-send `skill` and any other fields you
   want to keep).
5. Display once: `DEV SERVER: {url}`.

## Tunnel (team-mode only)

When `TEAM_MODE === "team"` AND there are MANUAL items, append a one-liner after the launch: `💡 Stakeholder review? Run /project-tunnel {url} to expose this.` Do NOT auto-launch — the user decides.

## Failure fallback

On failure (port in use by another project, command not found, ready-line never reached) → graceful fallback:

- All non-COVERED items become MANUAL, skip PHASE 1.
- Show: `DEV SERVER: failed to start ({reason}). MANUAL items require the user to start the server themselves — run \`{resolved-command}\` in another terminal, then continue.`

## Cleanup hook

PHASE 6 (Completion) and PHASE Finalize must kill `devServerPid` if the skill launched it (not when reused). Skipped when launch was skipped or reused.
