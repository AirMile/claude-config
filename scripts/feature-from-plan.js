#!/usr/bin/env node
// Extract the machine-contract appendix from a dev-define/game-define plan file
// and merge it into feature.json — replaces the PHASE 3 "transcribe" step with
// deterministic code so the plan-approved contract IS the canonical contract.
//
// Usage: node scripts/feature-from-plan.js <plan-file.md> <feature.json>
// Exit 0 = feature.json written. Exit != 0 = appendix missing / invalid JSON →
//   caller falls back to manual authoring (documented in dev-define workflow.md PHASE 3).
//
// The appendix is one ```json fence under a heading matching
//   "## Appendix — machine contract" (any suffix, e.g. "(skip review)").
// The fence holds the COMPLETE feature.json draft authored under the plan-mode
// approval gate. On a fresh feature the draft is written 1:1. When feature.json
// already exists (update-mode / re-run), a shallow top-level merge preserves keys
// the draft does not own (build, tests, refactor, …) — see MERGE below.

import { existsSync, readFileSync, writeFileSync } from "node:fs";

const args = process.argv.slice(2);
if (args.length < 2) {
  console.error(
    "Usage: node scripts/feature-from-plan.js <plan-file.md> <feature.json>",
  );
  process.exit(2);
}

const [planPath, featurePath] = args;

if (!existsSync(planPath)) {
  console.error(`feature-from-plan: plan file not found: ${planPath}`);
  process.exit(2);
}

const planText = readFileSync(planPath, "utf8");

// Locate the appendix heading. Match the em-dash "—" form used in the skills.
// Tolerate a leading "#"-count of 2+ and any trailing suffix on the line.
const headingRe = /^#{2,}\s+Appendix\s+—\s+machine contract.*$/im;
const headingMatch = headingRe.exec(planText);
if (!headingMatch) {
  console.error(
    "feature-from-plan: no '## Appendix — machine contract' heading found in plan file",
  );
  process.exit(3);
}

// From the heading onward, grab the first ```json fenced block.
const afterHeading = planText.slice(
  headingMatch.index + headingMatch[0].length,
);
const fenceRe = /```json\s*\n([\s\S]*?)\n```/i;
const fenceMatch = fenceRe.exec(afterHeading);
if (!fenceMatch) {
  console.error(
    "feature-from-plan: no ```json fence found under the appendix heading",
  );
  process.exit(3);
}

let draft;
try {
  draft = JSON.parse(fenceMatch[1]);
} catch (err) {
  console.error(
    `feature-from-plan: invalid JSON in appendix fence: ${err.message}`,
  );
  process.exit(4);
}

if (draft === null || typeof draft !== "object" || Array.isArray(draft)) {
  console.error("feature-from-plan: appendix JSON must be an object");
  process.exit(4);
}

// MERGE: shallow top-level. Draft keys win; keys present only in the existing
// file are preserved (build, tests, refactor, observations, suggestionsLog,
// verificationProfile/playtestProfile, shipped*, frontend, …).
const draftKeys = Object.keys(draft);
let result = draft;
const preserved = [];
if (existsSync(featurePath)) {
  let existing;
  try {
    existing = JSON.parse(readFileSync(featurePath, "utf8"));
  } catch (err) {
    console.error(
      `feature-from-plan: existing feature.json is invalid JSON, refusing to overwrite: ${err.message}`,
    );
    process.exit(5);
  }
  if (existing && typeof existing === "object" && !Array.isArray(existing)) {
    for (const key of Object.keys(existing)) {
      if (!(key in draft)) {
        result[key] = existing[key];
        preserved.push(key);
      }
    }
  }
}

writeFileSync(featurePath, JSON.stringify(result, null, 2) + "\n", "utf8");

console.error(`feature-from-plan: wrote ${featurePath}`);
console.error(`  draft keys:     ${draftKeys.join(", ")}`);
console.error(
  `  preserved keys: ${preserved.length ? preserved.join(", ") : "(none)"}`,
);
