#!/usr/bin/env node
// Map Stryker survived mutants to requirementId via tests.checklist[].name.
// Usage: node scripts/stryker-map-survivors.js <stryker-report.json> <feature.json>
// Output: JSON on stdout — { survivedDetails: [{file, line, mutator, requirementId?}], unmapped: [...] }
//
// Replaces the LLM prompt-instruction in shared/MUTATION-TESTING.md § Output-parsing
// with deterministic code. Uses Stryker mutation-testing-report-schema v2:
//   - report.tests: Record<id, {id, name, location?}>
//   - report.files[path].mutants: [{id, status, coveredBy[], killedBy[], mutatorName, location}]
//
// Mapping per survived mutant:
//   1. mutant.coveredBy[] → resolve via report.tests[id].name → set of test-names
//   2. Match each name against feature.tests.checklist[].name (exact or `describe > it` substring)
//   3. Collect unique requirementId values from matching checklist entries
//   4. Exactly 1 unique requirementId → assigned. Multiple or zero → omitted (no guessing).

import { existsSync, readFileSync } from "node:fs";

const args = process.argv.slice(2);
if (args.length < 2) {
  console.error(
    "Usage: node scripts/stryker-map-survivors.js <stryker-report.json> <feature.json>",
  );
  process.exit(2);
}

for (const path of args.slice(0, 2)) {
  if (!existsSync(path)) {
    console.error(`stryker-map-survivors: file not found: ${path}`);
    process.exit(2);
  }
}

function parseJson(path) {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch (err) {
    console.error(
      `stryker-map-survivors: invalid JSON in ${path}: ${err.message}`,
    );
    process.exit(2);
  }
}

const strykerReport = parseJson(args[0]);
const feature = parseJson(args[1]);

const checklist = feature?.tests?.checklist ?? [];
const testIdToName = strykerReport.tests ?? {};

// Pre-v6 Stryker reports lack the `tests` record (and mutant.coveredBy). All
// survivors then land in unmapped[] — documented fallback, no heuristic guessing.
if (!strykerReport.tests) {
  console.error(
    "mutation-mapping: stryker schema lacks coveredBy/tests fields (pre-v6?) — all survivors emitted as unmapped",
  );
}

function resolveNames(coveredByIds) {
  const names = [];
  for (const id of coveredByIds) {
    const entry = testIdToName[id];
    if (entry?.name) names.push(entry.name);
  }
  return names;
}

function matchChecklist(testNames) {
  const reqIds = new Set();
  for (const name of testNames) {
    for (const item of checklist) {
      if (!item.name) continue;
      // Exact match, or substring (handles `describe > it` concatenation).
      if (
        item.name === name ||
        name.includes(item.name) ||
        item.name.includes(name)
      ) {
        if (item.requirementId) reqIds.add(item.requirementId);
      }
    }
  }
  return [...reqIds];
}

const survivedDetails = [];
const unmapped = [];

const files = strykerReport.files ?? {};
for (const [filePath, fileEntry] of Object.entries(files)) {
  const mutants = fileEntry.mutants ?? [];
  for (const mutant of mutants) {
    if (mutant.status !== "Survived" && mutant.status !== "NoCoverage")
      continue;
    const detail = {
      file: filePath,
      line: mutant.location?.start?.line ?? null,
      mutator: mutant.mutatorName ?? "unknown",
    };
    const testNames = resolveNames(mutant.coveredBy ?? []);
    const reqIds = matchChecklist(testNames);
    if (reqIds.length === 1) {
      detail.requirementId = reqIds[0];
      survivedDetails.push(detail);
    } else if (reqIds.length > 1) {
      // Multiple matches — leave requirementId off (no guessing).
      survivedDetails.push(detail);
    } else {
      // No match — track separately for manual inspection.
      unmapped.push({ ...detail, coveredByTestNames: testNames });
    }
  }
}

// Deterministic ordering for diffable output.
survivedDetails.sort((a, b) =>
  (a.file + a.line).localeCompare(b.file + b.line),
);
unmapped.sort((a, b) => (a.file + a.line).localeCompare(b.file + b.line));

process.stdout.write(JSON.stringify({ survivedDetails, unmapped }, null, 2));
process.stdout.write("\n");
