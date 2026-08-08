#!/usr/bin/env node
/**
 * Guard script: every skill call site that invokes /project-todo to create a
 * backlog card must pass the explicit provenance token
 *
 *     origin agent via /{skill}
 *
 * inside its payload sentence (shared/BACKLOG.md § Card provenance).
 *
 * WHY THIS SCRIPT EXISTS
 * ----------------------
 * `origin` distinguishes "the user asked for this" from "a run parked it by
 * itself". The value can only be trusted if every machine writer actually
 * stamps it, and a skill author adding a twelfth offload path has no way to
 * know the convention exists. Without a guard, one forgotten token silently
 * files a machine finding as human intent — and an absent-but-wrong provenance
 * label is worse than no label at all, because the board filter then lies.
 *
 * Deliberately NOT a semantic check, and deliberately FILE-scoped rather than
 * line-scoped: a file that invokes /project-todo anywhere must carry the token
 * somewhere. A line-scoped version was tried first and drowned in false
 * positives — payload templates wrap across many lines, invocation lead-ins sit
 * a dozen lines above the sentence they introduce, and several files legitimately
 * say "hands to project-todo" as a cross-reference to a payload elsewhere in the
 * same file.
 *
 * KNOWN LIMITATION (accepted): a file with two payload templates where only one
 * carries the token still passes. The failure this guards against is a NEW
 * offload path added by an author who never learned the convention — that path
 * lands in a new file or a file with no token at all, which this does catch.
 *
 * Run: node scripts/check-card-provenance.js
 * Exit 0 = clean. Exit 1 = a file invokes /project-todo but stamps no token.
 */

"use strict";

const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const SKILLS = path.join(ROOT, "skills");

const TOKEN_RE = /origin\s+agent\s+via\s+\/[a-z][a-z0-9-]*/i;

// An invocation reads like "invoke /project-todo", "route to /project-todo",
// "→ /project-todo", "hands to project-todo". Prose references ("see
// /project-todo", "project-todo owns naming") do not create a card.
const INVOCATION_RE =
  /(invoke|invoking|route to|routing to|send .{0,20}to|hand(?:s|ed)? (?:it |them )?to|→)\s*[`'"]?\/?project-todo/i;

// A line that tells the reader NOT to invoke, or that the invocation happens
// elsewhere, is not itself a call site.
const NEGATION_RE =
  /\b(not|never|rather than|instead of|re-invok|without)\b[^.]{0,60}project-todo|project-todo[^.]{0,40}\b(owns|refuses|is the writer)\b/i;

// Files where /project-todo appears in an invocation-shaped sentence that
// nonetheless creates no card. Each entry needs a reason.
const ALLOWLIST = [
  [
    "skills/project-todo/",
    "project-todo documenting itself — it is the writer, not a caller",
  ],
  [
    "skills/shared/BACKLOG.md",
    "the contract that defines the token; its examples are specimens",
  ],
  [
    "skills/shared/PIPELINE.md",
    "ASCII pipeline diagram — routing overview, no payload",
  ],
  [
    "skills/dev-ship/references/fix-round.md",
    "routes through phase-3-manual-finalize.md's flush; no payload of its own",
  ],
  [
    "skills/game-ship/references/playtest-interview-walkthrough.md",
    "describes routing decisions; the invocation lives in phase-3-playtest.md",
  ],
  [
    "skills/dev-ship/references/manual-interview-walkthrough.md",
    "describes routing decisions; the invocation lives in phase-3-manual-finalize.md",
  ],
];

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (entry.name.endsWith(".md")) out.push(full);
  }
  return out;
}

function allowlisted(rel) {
  return ALLOWLIST.some(([prefix]) => rel.startsWith(prefix));
}

const failures = [];
let callSiteFiles = 0;

for (const file of walk(SKILLS)) {
  const rel = path.relative(ROOT, file);
  if (allowlisted(rel)) continue;

  const raw = fs.readFileSync(file, "utf8");
  const lines = raw.split("\n");

  const hits = [];
  lines.forEach((line, i) => {
    if (!INVOCATION_RE.test(line)) return;
    if (NEGATION_RE.test(line)) return;
    hits.push({ line: i + 1, text: line.trim().slice(0, 110) });
  });
  if (hits.length === 0) continue;

  callSiteFiles++;
  if (!TOKEN_RE.test(raw)) failures.push({ rel, hits });
}

if (failures.length === 0) {
  console.log(
    `check-card-provenance: OK — ${callSiteFiles} file(s) invoke /project-todo, all stamp a provenance token.`,
  );
  process.exit(0);
}

console.error(
  `check-card-provenance: ${failures.length} file(s) invoke /project-todo without an "origin agent via /{skill}" token:\n`,
);
for (const f of failures) {
  console.error(`  ${f.rel}`);
  for (const h of f.hits) console.error(`    :${h.line}  ${h.text}`);
}
console.error(
  `\nAdd the token to the payload sentence (shared/BACKLOG.md § Card provenance),`,
);
console.error(
  `or add the file to ALLOWLIST in this script with a reason if it creates no card.`,
);
process.exit(1);
