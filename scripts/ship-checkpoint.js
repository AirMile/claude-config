#!/usr/bin/env node
// Read / init / patch / complete the auto-mode ship checkpoint
// (dev-ship / game-ship / design-ship — shared/SHIP-CHECKPOINT.md).
//
// WHY THIS SCRIPT EXISTS: the checkpoint lives in the MAIN checkout's
//   <main_root>/.project/session/ship-<name>.json
// but the ship orchestrator runs with cwd INSIDE the feature worktree during
// PHASE 3/4 (manual tests / refactor+finalize). `.project/session/` is
// worktree-local — deliberately NOT symlinked — so a relative path would
// silently write the wrong (worktree-local) location. This script resolves
// main_root itself (first line of `git worktree list --porcelain`), so callers
// may invoke it from ANY cwd and the write always lands in main. That removes
// the whole cwd-in-worktree bug class the inline heredoc/`node -e` form had.
//
// Usage (init/patch read the JSON from STDIN — never argv, to avoid shell
// quoting breakage on the JSON blob):
//   echo '<full object>' | node scripts/ship-checkpoint.js init     <name>
//   echo '<delta patch>' | node scripts/ship-checkpoint.js patch    <name>
//                          node scripts/ship-checkpoint.js complete <name>
//                          node scripts/ship-checkpoint.js path     <name>
//
// - init:     create the checkpoint (atomic tmp+rename). Stamps updatedAt.
// - patch:    deep-merge the delta into the existing checkpoint (nested objects
//             merged; arrays + scalars replaced), stamp updatedAt, atomic write.
//             Pass a key value of null to clear it (e.g. "activeWorkflow": null).
// - complete: set status:"complete", stamp updatedAt, then remove the file.
// - path:     print the resolved absolute checkpoint path (no write).
//
// Exit 0 = ok. 2 = usage. 3 = main_root unresolved (not a git repo).
//   4 = checkpoint missing (patch/complete). 5 = invalid JSON (stdin / existing).

import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

const [cmd, name] = process.argv.slice(2);
const COMMANDS = ["init", "patch", "complete", "path"];

if (!cmd || !name || !COMMANDS.includes(cmd)) {
  console.error(
    "Usage: ship-checkpoint.js <init|patch|complete|path> <name>\n" +
      "  init/patch read the checkpoint JSON from stdin.",
  );
  process.exit(2);
}

// The first porcelain line is always "worktree <main-root>", even when this runs
// from inside a linked worktree — that is exactly the property we rely on.
let mainRoot = "";
try {
  const out = execFileSync("git", ["worktree", "list", "--porcelain"], {
    encoding: "utf8",
  });
  const first = out.split("\n")[0] || "";
  if (first.startsWith("worktree ")) {
    mainRoot = first.slice("worktree ".length).trim();
  }
} catch (err) {
  console.error(`ship-checkpoint: git worktree list failed: ${err.message}`);
  process.exit(3);
}
if (!mainRoot) {
  console.error("ship-checkpoint: could not resolve the main worktree root");
  process.exit(3);
}

const file = join(mainRoot, ".project", "session", `ship-${name}.json`);

if (cmd === "path") {
  process.stdout.write(`${file}\n`);
  process.exit(0);
}

function parseObject(text, label) {
  let value;
  try {
    value = JSON.parse(text);
  } catch (err) {
    console.error(`ship-checkpoint: invalid JSON in ${label}: ${err.message}`);
    process.exit(5);
  }
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    console.error(`ship-checkpoint: ${label} must be a JSON object`);
    process.exit(5);
  }
  return value;
}

function readStdin() {
  try {
    return readFileSync(0, "utf8");
  } catch {
    return "";
  }
}

function atomicWrite(obj) {
  mkdirSync(dirname(file), { recursive: true });
  const tmp = `${file}.tmp`;
  writeFileSync(tmp, JSON.stringify(obj, null, 2), "utf8");
  renameSync(tmp, file);
}

function readExisting() {
  if (!existsSync(file)) {
    console.error(`ship-checkpoint: checkpoint not found: ${file} (run 'init' first)`);
    process.exit(4);
  }
  return parseObject(readFileSync(file, "utf8"), "existing checkpoint");
}

// Deep-merge for nested objects; arrays and scalars are replaced wholesale.
// Mirrors the inline patcher SHIP-CHECKPOINT.md used before this script.
const merge = (a, b) => {
  for (const k in b) {
    const bv = b[k];
    a[k] =
      bv &&
      typeof bv === "object" &&
      !Array.isArray(bv) &&
      a[k] &&
      typeof a[k] === "object" &&
      !Array.isArray(a[k])
        ? merge(a[k], bv)
        : bv;
  }
  return a;
};

if (cmd === "init") {
  const obj = parseObject(readStdin(), "stdin (init object)");
  obj.updatedAt = new Date().toISOString();
  atomicWrite(obj);
  console.error(`ship-checkpoint: init ${file}`);
} else if (cmd === "patch") {
  const patch = parseObject(readStdin(), "stdin (patch delta)");
  const cur = readExisting();
  merge(cur, patch);
  cur.updatedAt = new Date().toISOString();
  atomicWrite(cur);
  console.error(`ship-checkpoint: patch ${file}`);
} else if (cmd === "complete") {
  const cur = readExisting();
  cur.status = "complete";
  cur.updatedAt = new Date().toISOString();
  atomicWrite(cur); // consistent on disk even if the remove below is interrupted
  rmSync(file, { force: true });
  console.error(`ship-checkpoint: complete + removed ${file}`);
}
