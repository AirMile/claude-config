#!/usr/bin/env node
/**
 * Guard script: validates that scripts/context-load.js and
 * scripts/backlog-load.js return the expected keys for every profile,
 * running the real scripts (not a re-implementation) against a throwaway
 * .project/ tree built from scripts/fixtures/.
 *
 * Run: node scripts/check-context-load.js
 * Exit 0 = all profiles OK. Exit 1 = one or more failures.
 *
 * Add to release checklist alongside check-handoff.py and check-dashboard-writers.py.
 */

"use strict";

const path = require("path");
const fs = require("fs");
const os = require("os");
const { execFileSync } = require("child_process");

const ROOT = path.join(__dirname, "..");
const FIXTURES = path.join(__dirname, "fixtures");
const FEAT = "fixture-feature";

let passed = 0;
let failed = 0;

function ok(label) {
  console.log(`OK   ${label}`);
  passed++;
}

function fail(label, reason) {
  console.error(`FAIL ${label}: ${reason}`);
  failed++;
}

function checkKeys(label, obj, requiredKeys) {
  const missing = requiredKeys.filter((k) => obj[k] === undefined);
  if (missing.length) {
    fail(label, `missing keys: ${missing.join(", ")}`);
  } else {
    ok(label);
  }
}

function runScript(script, args) {
  const out = execFileSync(
    "node",
    [path.join(ROOT, "scripts", script), ...args],
    { encoding: "utf8" },
  );
  return JSON.parse(out);
}

function check(label, script, args, requiredKeys) {
  try {
    const result = runScript(script, args);
    if (result === null || typeof result !== "object") {
      fail(label, `expected object, got ${typeof result}`);
      return;
    }
    checkKeys(label, result, requiredKeys);
  } catch (e) {
    fail(label, `threw: ${e.message}`);
  }
}

// ─── Build a throwaway .project/ tree from fixtures ───────────────────────────

const tmpBase = fs.mkdtempSync(path.join(os.tmpdir(), "context-load-guard-"));
const devRepo = path.join(tmpBase, "dev");
const gameRepo = path.join(tmpBase, "game");
const legacyRepo = path.join(tmpBase, "legacy");

function seed(repoRoot, files) {
  fs.mkdirSync(path.join(repoRoot, ".project", "features", FEAT), {
    recursive: true,
  });
  for (const [dest, src] of Object.entries(files)) {
    fs.copyFileSync(
      path.join(FIXTURES, src),
      path.join(repoRoot, ".project", dest),
    );
  }
}

seed(devRepo, {
  "project.json": "project.json",
  "project-context.json": "project-context.json",
  "backlog.json": "backlog.json",
  [`features/${FEAT}/feature.json`]: "feature.json",
});

seed(gameRepo, {
  "project.json": "game-project.json",
  "project-context.json": "game-project-context.json",
  "backlog.json": "game-backlog.json",
  [`features/${FEAT}/feature.json`]: "game-feature.json",
});

// Legacy repo: backlog.html only, no backlog.json — proves the fallback path.
fs.mkdirSync(path.join(legacyRepo, ".project"), { recursive: true });
fs.copyFileSync(
  path.join(FIXTURES, "backlog.html"),
  path.join(legacyRepo, ".project", "backlog.html"),
);

// ─── context-load.js ───────────────────────────────────────────────────────────

check(
  "context-load / build",
  "context-load.js",
  [devRepo, "build"],
  ["project", "projectContext"],
);
check(
  "context-load / define",
  "context-load.js",
  [devRepo, "define", FEAT],
  ["project", "projectContext"],
);
check(
  "context-load / verify",
  "context-load.js",
  [devRepo, "verify"],
  ["project", "projectContext"],
);
check(
  "context-load / feature-build",
  "context-load.js",
  [devRepo, "feature-build", FEAT],
  [
    "present",
    "type",
    "requirements",
    "buildSequence",
    "files",
    "testStrategy",
    "architecture",
    "clarifications",
    "blockers",
    "research",
    "durableDecisions",
  ],
);
check(
  "context-load / feature-verify",
  "context-load.js",
  [devRepo, "feature-verify", FEAT],
  [
    "present",
    "type",
    "checklist",
    "requirements",
    "files",
    "runCommand",
    "design",
    "apiContract",
  ],
);
check(
  "context-load / feature-build (missing feature → present:false)",
  "context-load.js",
  [devRepo, "feature-build", "no-such-feature"],
  ["present"],
);

check(
  "context-load / game-define",
  "context-load.js",
  [gameRepo, "game-define", FEAT],
  ["project", "projectContext"],
);
check(
  "context-load / game-build",
  "context-load.js",
  [gameRepo, "game-build"],
  ["project", "projectContext"],
);
check(
  "context-load / game-verify",
  "context-load.js",
  [gameRepo, "game-verify"],
  ["project", "projectContext"],
);
check(
  "context-load / game-feature-build",
  "context-load.js",
  [gameRepo, "game-feature-build", FEAT],
  [
    "present",
    "type",
    "requirements",
    "buildSequence",
    "files",
    "testStrategy",
    "architecture",
    "design",
    "clarifications",
    "blockers",
    "research",
  ],
);
check(
  "context-load / game-feature-verify",
  "context-load.js",
  [gameRepo, "game-feature-verify", FEAT],
  ["present", "type", "checklist", "requirements", "files", "design", "build"],
);

// ─── backlog-load.js ───────────────────────────────────────────────────────────

check(
  "backlog-load / read-feature",
  "backlog-load.js",
  [devRepo, "read-feature", FEAT],
  [
    "present",
    "name",
    "type",
    "status",
    "shipped",
    "risk",
    "dependencies",
    "externalRef",
    "transition",
    "pageHint",
  ],
);
check(
  "backlog-load / ready-queue",
  "backlog-load.js",
  [devRepo, "ready-queue"],
  ["backlogPresent", "items"],
);
check(
  "backlog-load / queue / DONE",
  "backlog-load.js",
  [devRepo, "queue", "DONE"],
  ["backlogPresent", "items"],
);
check(
  "backlog-load / open-items",
  "backlog-load.js",
  [devRepo, "open-items", FEAT],
  ["backlogPresent", "items"],
);
check(
  "backlog-load / guard-items",
  "backlog-load.js",
  [devRepo, "guard-items"],
  ["backlogPresent", "items"],
);
check(
  "backlog-load / pages",
  "backlog-load.js",
  [devRepo, "pages"],
  ["backlogPresent", "items"],
);
check(
  "backlog-load / game-read-feature",
  "backlog-load.js",
  [gameRepo, "game-read-feature", FEAT],
  [
    "present",
    "name",
    "type",
    "status",
    "shipped",
    "stage",
    "risk",
    "dependencies",
    "externalRef",
    "transition",
    "pageHint",
  ],
);
check(
  "backlog-load / game-queue / DEFINED",
  "backlog-load.js",
  [gameRepo, "game-queue", "DEFINED"],
  ["backlogPresent", "items"],
);
check(
  "backlog-load / game-queue / DOING+verifying",
  "backlog-load.js",
  [gameRepo, "game-queue", "DOING", "verifying"],
  ["backlogPresent", "items"],
);
{
  const result = runScript("backlog-load.js", [
    gameRepo,
    "game-queue",
    "DOING",
    "verifying",
  ]);
  if (!Array.isArray(result.items) || result.items.length === 0) {
    fail(
      "backlog-load / game-queue / DOING+verifying (non-empty)",
      "expected >=1 DOING+verifying feature in fixture",
    );
  } else {
    ok("backlog-load / game-queue / DOING+verifying (non-empty)");
  }
}

// ─── Legacy fallback: pre-migration backlog.html still readable ───────────────

check(
  "backlog-load / legacy backlog.html fallback",
  "backlog-load.js",
  [legacyRepo, "read-feature", FEAT],
  ["present", "name", "status"],
);

// ─── Cleanup ───────────────────────────────────────────────────────────────────

fs.rmSync(tmpBase, { recursive: true, force: true });

// ─── Summary ──────────────────────────────────────────────────────────────────

console.log(`\nContext-load guard: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
