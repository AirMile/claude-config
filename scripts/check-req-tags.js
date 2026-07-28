#!/usr/bin/env node
/**
 * REQ-pointer checker — validates the `// {REQ-id} · {feature-name}` comment
 * convention that dev-build (dev-build/techniques/tdd.md § Step 1) and
 * dev-verify (dev-verify/references/auto-test-runner.md) write above every
 * generated test.
 *
 * The tag is a machine-readable bridge from a test file (repo-committed,
 * survives a fresh clone) back to `feature.json#requirements[]` and its
 * `#durableDecisions[]` (gitignored, `.project/`-local) — see the plan at
 * ~/.claude/plans/wat-voor-tests-schrijft-ancient-kurzweil.md. REQ-ids are
 * not stable across a feature's lifetime (dev-define's update-mode
 * renumbers via `deltaOp` ADDED/REMOVED), so a tag can go stale silently
 * without this check.
 *
 * Two modes:
 *
 *   node scripts/check-req-tags.js
 *       Self-test mode (no args) — builds a throwaway project from
 *       scripts/fixtures/feature.json, plants tag fixtures (valid, stale
 *       REQ-id, wrong feature-name, archive-fallback), and asserts each
 *       resolves as expected. This is the release-checklist invocation
 *       (alongside check-context-load.js) — claude-config itself is a skill
 *       library, not a dev-ship project, so there is nothing real to scan.
 *
 *   node scripts/check-req-tags.js --project <dir>
 *       Operational mode — scans <dir> for test files carrying the tag and
 *       verifies each pair resolves against <dir>/.project/features/. Run
 *       this inside an actual dev-ship-built project, not claude-config.
 *
 * Exit 0 = every found tag resolves (or none exist). Exit 1 = one or more
 * dangling tags (missing feature.json, or REQ-id not in requirements[]).
 */

"use strict";

const path = require("path");
const fs = require("fs");
const os = require("os");

const ROOT = path.join(__dirname, "..");
const FIXTURES = path.join(__dirname, "fixtures");

// Matches `// REQ-005 · pin-mode` (and `// REQ-005 (category: boundary): ...`
// style trailing prose, which the tag format allows but does not require).
const TAG_RE = /\/\/\s*(REQ-[A-Za-z0-9]+)\s*·\s*([a-z0-9][a-z0-9-]*)/g;

const TEST_FILE_RE =
  /\.(test|spec|acceptance\.test|integration\.test)\.[jt]sx?$/;

const SKIP_DIRS = new Set([
  "node_modules",
  ".git",
  "dist",
  "build",
  ".next",
  ".project",
]);

function walkTestFiles(dir) {
  const out = [];
  (function recurse(d) {
    let entries;
    try {
      entries = fs.readdirSync(d, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (SKIP_DIRS.has(entry.name)) continue;
      const full = path.join(d, entry.name);
      if (entry.isDirectory()) recurse(full);
      else if (TEST_FILE_RE.test(entry.name)) out.push(full);
    }
  })(dir);
  return out;
}

function extractTags(filePath) {
  const text = fs.readFileSync(filePath, "utf8");
  const tags = [];
  let m;
  TAG_RE.lastIndex = 0;
  while ((m = TAG_RE.exec(text))) {
    tags.push({ reqId: m[1], feature: m[2] });
  }
  return tags;
}

// Resolve a feature.json for `feature`, live first, then archive fallback
// (features/archive/{shippedAt-date}-{name}/feature.json — see
// dev-refactor/references/completion-batch.md).
function loadFeatureJson(projectDir, feature) {
  const live = path.join(
    projectDir,
    ".project",
    "features",
    feature,
    "feature.json",
  );
  if (fs.existsSync(live)) return JSON.parse(fs.readFileSync(live, "utf8"));

  const archiveDir = path.join(projectDir, ".project", "features", "archive");
  if (fs.existsSync(archiveDir)) {
    const match = fs
      .readdirSync(archiveDir, { withFileTypes: true })
      .find((e) => e.isDirectory() && e.name.endsWith(`-${feature}`));
    if (match) {
      const archived = path.join(archiveDir, match.name, "feature.json");
      if (fs.existsSync(archived)) {
        return JSON.parse(fs.readFileSync(archived, "utf8"));
      }
    }
  }
  return null;
}

// Returns null on success, an error string on failure.
function checkTag(projectDir, tag, relPath) {
  const featureJson = loadFeatureJson(projectDir, tag.feature);
  if (!featureJson) {
    return `${relPath}: // ${tag.reqId} · ${tag.feature} — no feature.json for "${tag.feature}" (checked live + archive)`;
  }
  const requirements = featureJson.requirements || [];
  const hit = requirements.some((r) => r.id === tag.reqId);
  if (!hit) {
    return `${relPath}: // ${tag.reqId} · ${tag.feature} — "${tag.feature}"'s feature.json has no requirement "${tag.reqId}" (stale REQ-id? update-mode may have renumbered it)`;
  }
  return null;
}

function scanProject(projectDir) {
  const files = walkTestFiles(projectDir);
  const errors = [];
  let tagCount = 0;
  for (const file of files) {
    const rel = path.relative(projectDir, file);
    for (const tag of extractTags(file)) {
      tagCount++;
      const err = checkTag(projectDir, tag, rel);
      if (err) errors.push(err);
    }
  }
  return { filesScanned: files.length, tagCount, errors };
}

// ─── Operational mode ───────────────────────────────────────────────────────

function runOperational(projectDir) {
  const resolved = path.resolve(projectDir);
  if (!fs.existsSync(resolved)) {
    console.error(`error: no such directory: ${resolved}`);
    process.exit(1);
  }
  const { filesScanned, tagCount, errors } = scanProject(resolved);
  console.log(
    `REQ-tag check: ${tagCount} tag(s) found across ${filesScanned} test file(s)`,
  );
  for (const e of errors) console.error(`FAIL ${e}`);
  if (errors.length === 0) console.log("OK: all REQ-tags resolve.");
  process.exit(errors.length > 0 ? 1 : 0);
}

// ─── Self-test mode (release checklist) ─────────────────────────────────────

function runSelfTest() {
  let passed = 0;
  let failed = 0;
  const ok = (label) => {
    console.log(`OK   ${label}`);
    passed++;
  };
  const fail = (label, reason) => {
    console.error(`FAIL ${label}: ${reason}`);
    failed++;
  };

  const tmpBase = fs.mkdtempSync(path.join(os.tmpdir(), "req-tags-guard-"));
  const proj = path.join(tmpBase, "project");

  // Live feature: reuse the shared fixture (name "fixture-feature", REQ-001).
  fs.mkdirSync(path.join(proj, ".project", "features", "fixture-feature"), {
    recursive: true,
  });
  fs.copyFileSync(
    path.join(FIXTURES, "feature.json"),
    path.join(proj, ".project", "features", "fixture-feature", "feature.json"),
  );

  // Archived feature: same fixture, moved to features/archive/{date}-{name}/.
  fs.mkdirSync(
    path.join(
      proj,
      ".project",
      "features",
      "archive",
      "2026-01-10-shipped-feature",
    ),
    { recursive: true },
  );
  const archivedFixture = JSON.parse(
    fs.readFileSync(path.join(FIXTURES, "feature.json"), "utf8"),
  );
  archivedFixture.name = "shipped-feature";
  fs.writeFileSync(
    path.join(
      proj,
      ".project",
      "features",
      "archive",
      "2026-01-10-shipped-feature",
      "feature.json",
    ),
    JSON.stringify(archivedFixture, null, 2),
  );

  // Test files with tags: valid, stale REQ-id, wrong feature-name, archive-valid.
  fs.mkdirSync(path.join(proj, "src"), { recursive: true });
  fs.writeFileSync(
    path.join(proj, "src", "valid.test.ts"),
    `// REQ-001 · fixture-feature\ntest("valid", () => {});\n`,
  );
  fs.writeFileSync(
    path.join(proj, "src", "stale.test.ts"),
    `// REQ-999 · fixture-feature\ntest("stale REQ-id", () => {});\n`,
  );
  fs.writeFileSync(
    path.join(proj, "src", "wrong-feature.test.ts"),
    `// REQ-001 · no-such-feature\ntest("wrong feature", () => {});\n`,
  );
  fs.writeFileSync(
    path.join(proj, "src", "archive.test.ts"),
    `// REQ-001 · shipped-feature\ntest("resolves via archive fallback", () => {});\n`,
  );

  const { tagCount, errors } = scanProject(proj);

  if (tagCount === 4) ok("scan finds all 4 planted tags");
  else fail("scan finds all 4 planted tags", `found ${tagCount}`);

  const hasError = (substr) => errors.some((e) => e.includes(substr));

  if (!hasError("valid.test.ts")) ok("valid tag resolves clean");
  else fail("valid tag resolves clean", "unexpectedly flagged");

  if (hasError("stale.test.ts") && hasError("REQ-999"))
    ok("stale REQ-id is caught");
  else fail("stale REQ-id is caught", "not flagged");

  if (hasError("wrong-feature.test.ts") && hasError("no-such-feature"))
    ok("unknown feature-name is caught");
  else fail("unknown feature-name is caught", "not flagged");

  if (!hasError("archive.test.ts")) ok("archive fallback resolves clean");
  else fail("archive fallback resolves clean", "unexpectedly flagged");

  fs.rmSync(tmpBase, { recursive: true, force: true });

  console.log(`\nREQ-tag guard: ${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

// ─── CLI ─────────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const projectFlagIndex = args.indexOf("--project");

if (projectFlagIndex !== -1) {
  const dir = args[projectFlagIndex + 1];
  if (!dir) {
    console.error("error: --project requires a directory argument");
    process.exit(1);
  }
  runOperational(dir);
} else if (args.length === 0) {
  runSelfTest();
} else {
  console.error(
    "usage: node scripts/check-req-tags.js [--project <dir>]\n" +
      "  no args      self-test (release checklist)\n" +
      "  --project    scan a real dev-ship project for dangling REQ-tags",
  );
  process.exit(1);
}
