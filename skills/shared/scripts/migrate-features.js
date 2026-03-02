#!/usr/bin/env node
// migrate-features.js — Convert markdown feature files to JSON
// Usage: node migrate-features.js /path/to/project
//
// Scans .project/features/*/01-define.md, 02-build-log.md, 03-test-checklist.md
// Generates define.json, build.json, test.json alongside the markdown files (not replacing them)

const fs = require("fs");
const path = require("path");

const projectPath = process.argv[2];
if (!projectPath) {
  console.error("Usage: node migrate-features.js /path/to/project");
  process.exit(1);
}

const featuresDir = path.join(projectPath, ".project/features");
if (!fs.existsSync(featuresDir)) {
  console.log("No .project/features/ directory found. Nothing to migrate.");
  process.exit(0);
}

let migrated = 0;
let skipped = 0;

for (const featureName of fs.readdirSync(featuresDir)) {
  const featurePath = path.join(featuresDir, featureName);
  if (!fs.statSync(featurePath).isDirectory()) continue;

  console.log(`\n--- ${featureName} ---`);

  // ── 01-define.md → define.json ──
  const defineMd = path.join(featurePath, "01-define.md");
  const defineJson = path.join(featurePath, "define.json");

  if (fs.existsSync(defineMd) && !fs.existsSync(defineJson)) {
    try {
      const md = fs.readFileSync(defineMd, "utf8");
      const define = parseDefine(md, featureName);
      fs.writeFileSync(defineJson, JSON.stringify(define, null, 2), "utf8");
      console.log("  ✓ define.json created");
      migrated++;
    } catch (e) {
      console.log("  ✗ define.json failed: " + e.message);
    }
  } else if (fs.existsSync(defineJson)) {
    console.log("  - define.json already exists, skipping");
    skipped++;
  } else {
    console.log("  - no 01-define.md found");
  }

  // ── 02-build-log.md → build.json ──
  const buildMd = path.join(featurePath, "02-build-log.md");
  const buildJson = path.join(featurePath, "build.json");

  if (fs.existsSync(buildMd) && !fs.existsSync(buildJson)) {
    try {
      const md = fs.readFileSync(buildMd, "utf8");
      const build = parseBuild(md, featureName);
      fs.writeFileSync(buildJson, JSON.stringify(build, null, 2), "utf8");
      console.log("  ✓ build.json created");
      migrated++;
    } catch (e) {
      console.log("  ✗ build.json failed: " + e.message);
    }
  } else if (fs.existsSync(buildJson)) {
    console.log("  - build.json already exists, skipping");
    skipped++;
  } else {
    console.log("  - no 02-build-log.md found");
  }

  // ── 03-test-checklist.md or 03-test-results.md → test.json ──
  const testChecklistMd = path.join(featurePath, "03-test-checklist.md");
  const testResultsMd = path.join(featurePath, "03-test-results.md");
  const testJson = path.join(featurePath, "test.json");

  const testMdFile = fs.existsSync(testResultsMd)
    ? testResultsMd
    : fs.existsSync(testChecklistMd)
      ? testChecklistMd
      : null;

  if (testMdFile && !fs.existsSync(testJson)) {
    try {
      const md = fs.readFileSync(testMdFile, "utf8");
      const test = parseTest(md, featureName);
      fs.writeFileSync(testJson, JSON.stringify(test, null, 2), "utf8");
      console.log("  ✓ test.json created");
      migrated++;
    } catch (e) {
      console.log("  ✗ test.json failed: " + e.message);
    }
  } else if (fs.existsSync(testJson)) {
    console.log("  - test.json already exists, skipping");
    skipped++;
  } else {
    console.log("  - no test markdown found");
  }
}

console.log(`\nDone: ${migrated} files migrated, ${skipped} skipped`);

// ── Parsers ──

function parseDefine(md, featureName) {
  const result = {
    name: featureName,
    created: "",
    status: "DEF",
    depends: [],
    summary: "",
    requirements: [],
    userAnswers: {},
    design: {},
    apiContract: [],
  };

  // Created date
  const createdMatch = md.match(/\*\*Created:\*\*\s*(\d{4}-\d{2}-\d{2})/);
  if (createdMatch) result.created = createdMatch[1];

  // Status
  const statusMatch = md.match(/\*\*Status:\*\*\s*(\w+)/i);
  if (statusMatch) {
    const s = statusMatch[1].toLowerCase();
    if (s === "defined") result.status = "DEF";
    else if (s === "verified") result.status = "DONE";
    else if (s === "refactored" || s === "clean" || s === "done")
      result.status = "DONE";
    else result.status = s.toUpperCase();
  }

  // Summary
  const summaryMatch = md.match(/## Summary\s*\n\n([^\n]+)/);
  if (summaryMatch) result.summary = summaryMatch[1].trim();

  // Requirements table
  const reqTableMatch = md.match(
    /## Requirements\s*\n\n\|[^\n]+\n\|[-| ]+\n((?:\|[^\n]+\n)*)/,
  );
  if (reqTableMatch) {
    const rows = reqTableMatch[1].trim().split("\n");
    for (const row of rows) {
      const cells = row
        .split("|")
        .map((c) => c.trim())
        .filter(Boolean);
      if (cells.length >= 4) {
        result.requirements.push({
          id: cells[0],
          description: cells[1],
          category: cells[2],
          testType: cells[3],
          acceptance: cells[4] || "",
        });
      }
    }
  }

  // API Contract endpoints
  const apiMatch = md.match(
    /### Endpoints\s*\n\n\|[^\n]+\n\|[-| ]+\n((?:\|[^\n]+\n)*)/,
  );
  if (apiMatch) {
    const rows = apiMatch[1].trim().split("\n");
    for (const row of rows) {
      const cells = row
        .split("|")
        .map((c) => c.trim())
        .filter(Boolean);
      if (cells.length >= 2) {
        result.apiContract.push({
          method: cells[0],
          path: cells[1],
          description: cells[4] || cells[2] || "",
        });
      }
    }
  }

  return result;
}

function parseBuild(md, featureName) {
  const result = {
    feature: featureName,
    started: "",
    completed: "",
    filesChanged: [],
    packagesAdded: [],
    decisions: [],
    testChecklist: [],
  };

  // Build date
  const dateMatch = md.match(/\*\*Build Date:\*\*\s*(\d{4}-\d{2}-\d{2})/);
  if (dateMatch) {
    result.started = dateMatch[1];
    result.completed = dateMatch[1];
  }

  // Files from "## Files Created" or file paths in the document
  const filesSection = md.match(
    /## Files (?:Created|Modified)\s*\n([\s\S]*?)(?=\n##|\n$|$)/,
  );
  if (filesSection) {
    const fileMatches = filesSection[1].matchAll(/[-*]\s+`?([^\s`]+\.\w+)`?/g);
    for (const m of fileMatches) {
      result.filesChanged.push(m[1]);
    }
  }

  // Test checklist items
  const checklistMatch = md.match(
    /### Checklist\s*\n\n\|[^\n]+\n\|[-| ]+\n((?:\|[^\n]+\n)*)/,
  );
  if (checklistMatch) {
    const rows = checklistMatch[1].trim().split("\n");
    for (const row of rows) {
      const cells = row
        .split("|")
        .map((c) => c.trim())
        .filter(Boolean);
      if (cells.length >= 2) {
        result.testChecklist.push({
          id: cells[0],
          description: cells[1],
          status: cells[2]?.includes("[x]") ? "passed" : "pending",
        });
      }
    }
  }

  return result;
}

function parseTest(md, featureName) {
  const result = {
    feature: featureName,
    runs: [],
    finalStatus: "PENDING",
    coverage: {},
  };

  // Summary table for status
  const statusMatch = md.match(/\|\s*Status\s*\|\s*(\w+)\s*\|/i);
  if (statusMatch) {
    result.finalStatus = statusMatch[1].toUpperCase();
  }

  // Passed/failed counts
  const passedMatch = md.match(/\|\s*Passed\s*\|\s*(\d+)\s*\|/i);
  const itemsMatch = md.match(/\|\s*Items\s*\|\s*(\d+)\s*\|/i);
  const dateMatch = md.match(/\|\s*Date\s*\|\s*([^\|]+)\|/i);

  if (passedMatch || itemsMatch) {
    const run = {
      date: dateMatch
        ? dateMatch[1].trim()
        : new Date().toISOString().slice(0, 10),
      passed: passedMatch ? parseInt(passedMatch[1]) : 0,
      failed: itemsMatch
        ? parseInt(itemsMatch[1]) - (passedMatch ? parseInt(passedMatch[1]) : 0)
        : 0,
      fixes: [],
    };

    // Extract fixes from Fix Sync section
    const fixSection = md.match(/## Fix Sync\s*\n([\s\S]*?)(?=\n##|$)/);
    if (fixSection) {
      const fixMatches = fixSection[1].matchAll(
        /[-*]\s+\*\*([^*]+)\*\*:\s*([^\n]+)/g,
      );
      for (const m of fixMatches) {
        run.fixes.push(m[1].trim() + ": " + m[2].trim());
      }
    }

    result.runs.push(run);
  }

  return result;
}
