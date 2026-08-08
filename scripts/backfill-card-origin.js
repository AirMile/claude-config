#!/usr/bin/env node
/**
 * One-time migration: stamp `origin` / `source` on backlog cards that predate
 * the provenance field (shared/BACKLOG.md § Card provenance).
 *
 * WHY THIS SCRIPT EXISTS
 * ----------------------
 * Without a backfill, the board's Mine/Auto filter is empty on exactly the
 * projects that motivated it — the ones already carrying dozens of machine-
 * parked cards. But provenance that is guessed is worse than provenance that
 * is missing: a card wrongly labelled "you asked for this" is a lie the user
 * cannot detect.
 *
 * So this stamps ONLY on hard evidence: a literal provenance sentence that a
 * skill wrote into the description at park time ("parked from /dev-ship
 * manual round"). No inference from card naming, phrasing, type, or writing
 * style — those would be a guess wearing a heuristic's clothes. A card with no
 * such sentence is left completely untouched, and absent stays absent.
 *
 * Idempotent: a card that already has an `origin` is never rewritten.
 *
 * Usage:
 *   node scripts/backfill-card-origin.js --project <dir>            # dry run
 *   node scripts/backfill-card-origin.js --project <dir> --apply    # write
 *
 * Exit 0 = ran (with or without changes). Exit 1 = bad arguments or unreadable
 * project. Exit 5 = a target file exists but is not valid JSON.
 */

"use strict";

const fs = require("fs");
const path = require("path");

// Ordered: first match wins. Each pattern must anchor on wording a SKILL wrote,
// never on wording a human might coincidentally use.
const EVIDENCE = [
  {
    // "parked from /dev-ship manual round", "parked from /game-tweak escalation"
    re: /\bparked from (\/[a-z][a-z0-9-]*)/i,
    source: (m) => m[1].toLowerCase(),
  },
  {
    // deferred-reverify's Fail branch wording
    re: /\bre-tested from the verify-[a-z0-9-]+ card\b/i,
    source: () => "/dev-manual",
  },
];

function parseArgs(argv) {
  const args = { project: null, apply: false };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--apply") args.apply = true;
    else if (a === "--project") args.project = argv[++i];
    else if (a.startsWith("--project=")) args.project = a.slice(10);
    else {
      console.error(`Unknown argument: ${a}`);
      return null;
    }
  }
  return args.project ? args : null;
}

function readJson(file) {
  if (!fs.existsSync(file)) return null;
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (e) {
    console.error(`Not valid JSON: ${file}\n  ${e.message}`);
    process.exit(5);
  }
}

function classify(card) {
  // Never overwrite an existing decision — this script is a migration, not an
  // authority. A card already carrying origin was stamped by its writer.
  if (card.origin) return null;
  const text = card.description || "";
  for (const rule of EVIDENCE) {
    const m = text.match(rule.re);
    if (m) return { origin: "agent", source: rule.source(m) };
  }
  return null;
}

const args = parseArgs(process.argv);
if (!args) {
  console.error(
    "Usage: node scripts/backfill-card-origin.js --project <dir> [--apply]",
  );
  process.exit(1);
}

const root = path.resolve(args.project);
if (!fs.existsSync(root)) {
  console.error(`No such directory: ${root}`);
  process.exit(1);
}

const targets = [
  { file: path.join(root, ".project", "backlog.json"), key: "features" },
  {
    file: path.join(root, ".project", "archive", "backlog-archive.json"),
    key: "archived",
  },
];

let scanned = 0;
let stamped = 0;
let skipped = 0;
const changes = [];

for (const { file, key } of targets) {
  const data = readJson(file);
  if (!data || !Array.isArray(data[key])) continue;

  let dirty = false;
  for (const card of data[key]) {
    scanned++;
    const verdict = classify(card);
    if (!verdict) {
      skipped++;
      continue;
    }
    changes.push({
      file: path.relative(root, file),
      name: card.name,
      from: card.source || "(none)",
      to: verdict.source,
    });
    stamped++;
    if (args.apply) {
      card.origin = verdict.origin;
      card.source = verdict.source;
      dirty = true;
    }
  }

  if (args.apply && dirty) {
    fs.writeFileSync(file, JSON.stringify(data, null, 2) + "\n", "utf8");
  }
}

const mode = args.apply ? "APPLIED" : "DRY RUN";
console.log(`backfill-card-origin (${mode})`);
console.log(`  scanned:   ${scanned} card(s)`);
console.log(`  stamped:   ${stamped}  → origin: agent`);
console.log(
  `  untouched: ${skipped}  (no provenance sentence, or already stamped)`,
);

if (changes.length) {
  console.log("");
  for (const c of changes) {
    console.log(`  ${c.name}`);
    console.log(`    source ${c.from} → ${c.to}   [${c.file}]`);
  }
}
if (!args.apply && changes.length) {
  console.log("\nRe-run with --apply to write these.");
}
