#!/usr/bin/env node
// Read / init / patch / complete the auto-mode ship checkpoint, plus the
// active-feature live signal and the manual/playtest ledger upsert
// (dev-ship / game-ship / design-ship — shared/SHIP-CHECKPOINT.md, shared/DEVINFO.md).
//
// WHY THIS SCRIPT EXISTS: the checkpoint (and, since `signal`/`item` were added,
// the live-signal file and the manual-test ledger) live in the MAIN checkout's
//   <main_root>/.project/session/{ship-<name>,active-<name>}.json
// but the ship orchestrator runs with cwd INSIDE the feature worktree during
// PHASE 3/4 (manual tests / refactor+finalize). `.project/session/` is
// worktree-local — deliberately NOT symlinked — so a relative path would
// silently write the wrong (worktree-local) location, or silently delete
// nothing (a relative `rm -f` on signal-clear). This script resolves
// main_root itself (first line of `git worktree list --porcelain`), so callers
// may invoke it from ANY cwd and the write always lands in main. That removes
// the whole cwd-in-worktree bug class the inline heredoc/`echo >`/`rm -f` form had.
// `item` additionally removes the "re-send the FULL items array on every patch"
// footgun (manual-interview-walkthrough.md) by upserting a single item by `id`.
//
// Usage (payload commands read JSON from STDIN — never argv, to avoid shell
// quoting breakage on the JSON blob):
//   echo '<full object>' | node scripts/ship-checkpoint.js init         <name>
//   echo '<delta patch>' | node scripts/ship-checkpoint.js patch        <name>
//                          node scripts/ship-checkpoint.js complete     <name>
//                          node scripts/ship-checkpoint.js path         <name>
//   echo '<signal obj>'  | node scripts/ship-checkpoint.js signal       <name>
//                          node scripts/ship-checkpoint.js signal-clear <name>
//   echo '<one item>'    | node scripts/ship-checkpoint.js item         <name> <manual|playtest>
//
// - init:         create the checkpoint (atomic tmp+rename). Stamps updatedAt.
// - patch:        deep-merge the delta into the existing checkpoint (nested objects
//                 merged; arrays + scalars replaced), stamp updatedAt, atomic write.
//                 Pass a key value of null to clear it (e.g. "activeWorkflow": null).
// - complete:     set status:"complete", stamp updatedAt, then remove the file.
// - path:         print the resolved absolute checkpoint path (no write).
// - signal:       write .project/session/active-<name>.json wholesale (replaces any
//                 existing file). Stdin supplies "skill" (required) and optionally
//                 "waiting" / other DEVINFO.md fields; the script stamps "feature"
//                 (from <name>) and "startedAt" (now).
// - signal-clear: remove active-<name>.json. Exit 0 whether or not it existed.
// - item:         upsert one ledger item by "id" into the checkpoint's
//                 manual.items (or playtest.items) array — append if the id is
//                 new, replace in place if it already exists.
//
// Exit 0 = ok. 2 = usage. 3 = main_root unresolved (not a git repo).
//   4 = checkpoint missing (patch/complete/item). 5 = invalid JSON, or missing
//   required field (stdin / existing file).

import { execFileSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";

const [cmd, name, extra] = process.argv.slice(2);
const COMMANDS = [
  "init",
  "patch",
  "complete",
  "path",
  "signal",
  "signal-clear",
  "item",
];
const LEDGERS = ["manual", "playtest"];

if (!cmd || !name || !COMMANDS.includes(cmd)) {
  console.error(
    "Usage: ship-checkpoint.js <init|patch|complete|path> <name>\n" +
      "       ship-checkpoint.js <signal|signal-clear> <name>\n" +
      "       ship-checkpoint.js item <name> <manual|playtest>\n" +
      "  init/patch/signal/item read their JSON payload from stdin.",
  );
  process.exit(2);
}

if (cmd === "item" && (!extra || !LEDGERS.includes(extra))) {
  console.error(
    `Usage: ship-checkpoint.js item <name> <manual|playtest> (got: ${extra ?? ""})`,
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
const signalFile = join(mainRoot, ".project", "session", `active-${name}.json`);

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

function atomicWrite(obj, target = file) {
  mkdirSync(dirname(target), { recursive: true });
  const tmp = `${target}.tmp`;
  writeFileSync(tmp, JSON.stringify(obj, null, 2), "utf8");
  renameSync(tmp, target);
}

function readExisting() {
  if (!existsSync(file)) {
    console.error(
      `ship-checkpoint: checkpoint not found: ${file} (run 'init' first)`,
    );
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
} else if (cmd === "signal") {
  const payload = parseObject(readStdin(), "stdin (signal object)");
  if (typeof payload.skill !== "string" || !payload.skill) {
    console.error('ship-checkpoint: signal requires a "skill" string field');
    process.exit(5);
  }
  const VALID_SKILLS = [
    "define",
    "plan",
    "build",
    "verify",
    "test",
    "debug",
    "refactor",
    "design",
    "content",
    "check",
    "ship",
  ];
  if (!VALID_SKILLS.includes(payload.skill)) {
    console.error(
      `ship-checkpoint: warning: "${payload.skill}" is not a known skill value (${VALID_SKILLS.join(", ")})`,
    );
  }
  const obj = {
    ...payload,
    feature: name,
    startedAt: new Date().toISOString(),
  };
  atomicWrite(obj, signalFile);
  console.error(`ship-checkpoint: signal ${signalFile}`);
} else if (cmd === "signal-clear") {
  rmSync(signalFile, { force: true });
  console.error(`ship-checkpoint: signal-clear ${signalFile}`);
} else if (cmd === "item") {
  const item = parseObject(readStdin(), "stdin (ledger item)");
  if (typeof item.id !== "string" || !item.id) {
    console.error(
      'ship-checkpoint: item requires a non-empty "id" string field',
    );
    process.exit(5);
  }
  const cur = readExisting();
  if (
    !cur[extra] ||
    typeof cur[extra] !== "object" ||
    Array.isArray(cur[extra])
  ) {
    cur[extra] = {};
  }
  if (!Array.isArray(cur[extra].items)) cur[extra].items = [];
  const items = cur[extra].items;
  const existingIndex = items.findIndex((i) => i && i.id === item.id);
  if (existingIndex >= 0) items[existingIndex] = item;
  else items.push(item);
  cur.updatedAt = new Date().toISOString();
  atomicWrite(cur);
  console.error(
    `ship-checkpoint: item ${existingIndex >= 0 ? "updated" : "appended"} ${extra}.items[${existingIndex >= 0 ? existingIndex : items.length - 1}] (id=${item.id})`,
  );
}
