---
name: dev-inspect
description: Edit the element behind a pasted inspect-overlay ref, then screenshot-verify. Use with /dev-inspect, or auto-triggers on a bracketed [path:line ...] element ref with an edit request.
argument-hint: "[pasted [ref] block(s) + change description]"
reads: [project.theme]
metadata:
  author: claude-config
  version: 1.2.1
  category: dev
---

# Inspect Edit

Pinpoint fast path for frontend changes anchored to a pasted **inspect-overlay ref** — the
bracketed locator the overlay (installed via `core-setup`) copies to the clipboard on click. Where
`/dev-tweak` starts from a description and must locate the change, dev-inspect starts from an exact
element and exists to make the edit disciplined: theme tokens, minimal diff, visual verification.
It **never commits** — rapid-fire sessions stack edits; the user commits via `/core-commit`. No
backlog guard, no learnings, no `TaskCreate` tracking (a run is minutes; ceremony is what this
skill avoids). Skill file stays English; user-facing output follows
`CLAUDE.md § User Preferences → Language:`.

Escalation reuses [shared/TWEAK-DISCIPLINE.md](../shared/TWEAK-DISCIPLINE.md) **§ Size gate +
§ Escalation gate only** — the backlog guard, branch guard, and registration policy do not apply
(nothing is committed or registered here). Escalation targets: `/dev-ship` (pipeline),
`/dev-tweak` (needs commit machinery), `/project-todo` (park).

Ref grammar (ground truth:
[core-setup setup-guide § Ref format](../core-setup/references/modules/inspect-overlay/setup-guide.md)):

```
Full:     [<path>:<line>[:<col>] ["<name>"] [#<i>/<N>] [— in <ancestorPath>:<line>] [> <innerTarget>]]
Degraded: [<tag>[#id | .c1.c2.c3][:nth-of-type(k)] ["<name>"] [— in <anchor>] [> <innerTarget>]]
Multi:    refs joined as "--- 1/N ---" blocks (Shift+Click pins / region select, max 20)
```

## PHASE 0 — Parse & pre-flight

**Re-invocation guard**: this skill's auto-trigger fires on every bracketed `[path:line ...]` ref,
so a second paste in the same chat looks like a fresh trigger. It isn't — once this workflow has
run once in this session, SKILL.md and the theme digest are already in context. For every
**subsequent** pasted ref this session: do **not** re-invoke the Skill tool — run PHASE 0-4
directly on the new payload, reusing the memoized digest (step 4) and any files already read (step
5). Only an explicit user-typed `/dev-inspect` re-loads deliberately. Re-reading the skill body per
paste is wasted tokens in a rapid-fire session.

1. **Parse the payload**: split multi-select blocks on `--- i/N ---` separators; also accept
   multiple bare bracketed refs. Classify each ref: **full** (path with a source extension
   followed by `:digits`) vs **degraded** (anything else bracketed). Keep the optional segments
   per ref — `"name"`, `#i/N`, `— in ancestor`, `> innerTarget`. The prose around the refs is the
   change description; a ref without any instruction → ask one short question.
2. **Overlay check** — a full-mode ref proves the overlay is installed: skip this step entirely.

   > **Todo**: no ref at all, or only degraded ref(s) → Read
   > `.claude/skills/dev-inspect/references/overlay-check.md` and follow it.

3. **Validate** full refs cheaply: file exists, line within range (`wc -l`). A stale ref (file
   shorter, content moved) keeps its segments and is treated as degraded-resolution input.
4. **Theme preload** — the only `.project/` read. Resolve `$REPO` to the main worktree (per
   `shared/SYNC.md` Worktree-aware Path Resolution), then extract **only** the `theme` key from
   `.project/project.json` (one `node -e` call) into a compact digest: color tokens, typography,
   spacing scale, radius, shadows, `motion` (pack, durations, easings, springs), `interactions`,
   and the `cssVars` variable names — schema:
   [shared/DASHBOARD-THEME.md](../shared/DASHBOARD-THEME.md). **Session memoization**: a previous
   dev-inspect run in this session already printed the digest → skip the reload. `.project/` or
   `theme` absent → one line `Theme: none — follow existing file conventions` and continue (never
   scaffold).
5. **Size gate** on the projected scope per
   [shared/TWEAK-DISCIPLINE.md](../shared/TWEAK-DISCIPLINE.md) § Size gate — criteria 1-4 and 6
   (criterion 5 is the backlog guard, which does not run here). Skip the Read when the file is
   already in context this session.

   > **Todo**: any criterion fires → Read
   > `.claude/skills/dev-inspect/references/escalate.md` and follow it — never continue silently.

## PHASE 1 — Resolve targets

- **Full ref**: targeted Read around `path:line` (±40 lines), sanity-check that the line renders
  the element (tag / `"name"` text nearby). Interpret segments:
  - `#i/N` — the source line renders N times (`.map()` list): the edit lands once in the shared
    source and affects all instances; verify the i-th rendered instance in PHASE 3.
  - `— in ancestorPath:line` — the element lives in a reused component; read the callsite too.
    When it is ambiguous whether the change belongs in the component (all instances) or at this
    callsite (this one), ask one short question — this is the load-bearing judgment for shared
    components.
  - `> innerTarget` — the clicked icon/img inside the resolved element is the real subject.
- **Degraded ref**:

  > **Todo**: for each degraded ref → Read
  > `.claude/skills/dev-inspect/references/resolve-degraded.md` and resolve per its ladder.

- **Multi-ref**: resolve every ref first, group by file, then implement file-by-file. Re-run the
  size gate on the resolved file set.

## PHASE 2 — Implement

Minimal, surgical edits only — then hold the diff against
[shared/EDIT-DISCIPLINE.md](../shared/EDIT-DISCIPLINE.md) (tokens, scope, states/responsive,
motion, a11y — the theme digest from PHASE 0 step 4 is the "prerequisite" it expects). The
scope-check "component vs callsite" call is the PHASE 1 decision above, applied here before
editing.

**Mid-flight re-check**: a 4th file or a discovered net-new surface → stop and Read
`references/escalate.md`.

## PHASE 3 — Screenshot-verify

Always runs — the edit is not done until it is seen working.

1. **Tooling**: **Tauri project** (`src-tauri/` present or `project.json#stack.framework ==
"Tauri"`) → the target is a native window, not a URL — use the Tauri app vehicle per
   [shared/TAURI-VEHICLE.md](../shared/TAURI-VEHICLE.md) instead of any browser vehicle below;
   follow its smart-install gate if `mcp__tauri-mcp__*` isn't connected yet. **Otherwise**:
   `playwright-cli` daemon by default (scriptable single-shot verify — see
   [shared/BROWSER-VEHICLES.md](../shared/BROWSER-VEHICLES.md)). **Opt into Claude-in-Chrome**
   only when `tabs_context_mcp` finds the exact page already open in a live Chrome tab — the user
   just clicked the overlay there, so reusing that tab (real session, no fresh navigation) is
   faster than a cold CLI launch. Mechanics per
   [shared/CLAUDE-IN-CHROME.md](../shared/CLAUDE-IN-CHROME.md) and
   [shared/PLAYWRIGHT.md](../shared/PLAYWRIGHT.md) § Pre-flight Validation.
2. **URL**: skip this step entirely for a Tauri project — the running app window is already
   showing the current state, there's nothing to navigate to. Otherwise: an open tab showing the
   app → use it. Otherwise derive the route from the ref path (Next.js `app/`/`pages/`
   conventions) on the detected dev-server port (Vite `server.port` / `--port` script flag /
   fallback 5173/3000). Still unclear → one short question. Dev server not running → ask: start
   it, or skip verify.
3. **Locate the element live**: full mode → the overlay's attrs are in the dev DOM — selector
   `[data-inspector-relative-path="<path>"][data-inspector-line="<line>"]` (deterministic);
   degraded → the CSS selector from the ref. Scroll into view; brief wait for HMR after edits.
4. **Capture & judge**: element-scoped screenshot plus one wider container shot. Verdict on:
   (a) the requested change is visible, (b) theme tokens are honored — spot-check one
   `getComputedStyle` eval against the digest when in doubt, (c) surrounding layout is
   unregressed (container shot). Cheap console-error check (error level only, ignore patterns per
   PLAYWRIGHT.md § Console Error Inspection) when the edit touched logic. Optionally grep the
   touched files against the relevant `shared/ANTI-SLOP.md` packs (`tokens` always; `dark` /
   `motion` when applicable) as a static complement.
5. **On fail**: one inline fix round (back to PHASE 2 for that ref, evidence first — what does
   the screenshot/computed style actually show?).

   > **Todo**: verify fails a second time → Read
   > `.claude/skills/dev-inspect/references/fix-round.md` and follow it. No silent retry loops.

6. **Multi-ref**: verify per ref, batching captures on the same page into one navigation. No
   browser available → degradation ladder per PLAYWRIGHT.md § Graceful Degradation; report
   `verify: skipped (manual: open {url})`. Playwright runner: always `close` at the end.

## PHASE 4 — Confirm & report

Runs once per prompt, after every ref in the payload has been edited and PHASE-3-verified — not per
ref mid-run.

1. **Confirm**: one AskUserQuestion, one question per ref (max 4 per modal — batch larger payloads
   into consecutive modals), `multiSelect: false` per question:

   ```yaml
   header: "Change OK?"
   question: "Did «{change}» at {file:line} land correctly?"
   options:
     - label: "Yes, keep it (Recommended)"
       description: "Change is correct — keep it as-is"
     - label: "No, adjust"
       description: "Something's off — back to a fix round (PHASE 2), then re-verify and re-ask"
     - label: "Revert it"
       description: "Undo this edit — restore the file to its pre-run state"
   ```

   - **Yes** — keep the edit, this ref goes to the report as-is.
   - **No, adjust** — back to PHASE 2 for that ref, evidence-first. A user rejection counts as a
     verify failure for the retry ladder: a second rejection/failure on the same ref → Read
     `references/fix-round.md` and follow it (no silent retry loops). Otherwise re-run PHASE 3,
     then re-ask for that ref.
   - **Revert it** — restore the file to its pre-run state for that ref (nothing was committed, so
     revert is a working-tree restore of the edited hunk/file). Mark the ref `reverted` in the
     report below.

2. **Report**: single ref → three lines of prose: what changed (`file:line`), verify verdict, theme
   line, confirm outcome. Multi-ref → one compact table:

   ```
   ref (short)              | edited        | change            | verify | confirm
   [Button.tsx:12 "Delete"] | Button.tsx:14 | token color swap  | ✓      | yes
   ```

   Always close with: `Not committed — review with git diff, commit with /core-commit.` Add
   `Escalation overridden: {criterion}` when applicable. Nothing else — no learnings, no state
   writes. The confirm step above is the terminal interaction; no separate next-step offer beyond
   it.
