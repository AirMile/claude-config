#!/usr/bin/env node
// Migration: rename project.json `concept` → `seed`, backlog `hasConcept` → `hasSeed`,
// and rename .project/project-concept.md → project-seed.md.
// Idempotent — safe to run multiple times.

const fs = require("fs");
const path = require("path");

function readYamlValue(file, ...keys) {
  try {
    const lines = fs.readFileSync(file, "utf8").split("\n");
    let depth = 0;
    for (const line of lines) {
      const key = keys[depth];
      const m = line.match(/^(\s*)(\S[^:]*?)\s*:\s*(.*)/);
      if (!m) continue;
      const indent = m[1].length;
      const k = m[2].trim();
      const v = m[3].trim().replace(/^["']|["']$/g, "");
      if (depth === 0 && indent === 0 && k === key) {
        if (keys.length === 1) return v || null;
        depth = 1;
      } else if (depth === 1 && indent > 0 && k === keys[1]) {
        return v || null;
      }
    }
  } catch {}
  return null;
}

function resolveProjectsRoot() {
  if (process.env.CLAUDE_PROJECTS_ROOT) return process.env.CLAUDE_PROJECTS_ROOT;
  const localYaml = path.join(__dirname, "../.claude/paths.local.yaml");
  if (fs.existsSync(localYaml)) {
    const v = readYamlValue(localYaml, "paths", "projects_root");
    if (v) return v;
  }
  const defaultYaml = path.join(__dirname, "../skills/project-add/paths.yaml");
  if (fs.existsSync(defaultYaml)) {
    const v = readYamlValue(defaultYaml, "paths", "projects_root");
    if (v) return v;
  }
  return null;
}

const projectsRoot = resolveProjectsRoot();
if (!projectsRoot) {
  console.error(
    "Could not resolve projects_root. Set CLAUDE_PROJECTS_ROOT or run /core-bootstrap.",
  );
  process.exit(1);
}

const entries = fs.readdirSync(projectsRoot, { withFileTypes: true });
let migrated = 0;
let skipped = 0;
let errors = 0;

for (const entry of entries) {
  if (!entry.isDirectory()) continue;
  const projectPath = path.join(projectsRoot, entry.name);
  const projectDir = path.join(projectPath, ".project");
  const jsonPath = path.join(projectDir, "project.json");
  if (!fs.existsSync(jsonPath)) continue;

  try {
    const raw = fs.readFileSync(jsonPath, "utf8");
    const data = JSON.parse(raw);
    let changed = false;

    // 1. Rename top-level key concept → seed
    if (data.concept && !data.seed) {
      data.seed = data.concept;
      delete data.concept;
      changed = true;
    }

    // 2. Rename seed.conceptFile → seed.seedFile
    if (data.seed && data.seed.conceptFile && !data.seed.seedFile) {
      data.seed.seedFile = data.seed.conceptFile;
      delete data.seed.conceptFile;
      changed = true;
    }

    // 3. Rename project-concept.md → project-seed.md
    const oldMd = path.join(projectDir, "project-concept.md");
    const newMd = path.join(projectDir, "project-seed.md");
    if (fs.existsSync(oldMd) && !fs.existsSync(newMd)) {
      fs.renameSync(oldMd, newMd);
      if (data.seed && data.seed.seedFile === "project-concept.md") {
        data.seed.seedFile = "project-seed.md";
      }
      changed = true;
    }

    if (!changed) {
      console.log(`skipped:  ${entry.name}`);
      skipped++;
      continue;
    }

    fs.writeFileSync(jsonPath, JSON.stringify(data, null, 2) + "\n", "utf8");

    // 4. Migrate backlog flags hasConcept → hasSeed, conceptPath → seedPath.
    // Canonical store is .project/backlog.json; fall back to extracting the
    // <script id="backlog-data"> JSON from legacy .project/backlog.html
    // (this script may run on unmigrated projects). Writes go to backlog.json.
    const backlogJsonPath = path.join(projectDir, "backlog.json");
    const backlogHtmlPath = path.join(projectDir, "backlog.html");
    let bd = null;
    if (fs.existsSync(backlogJsonPath)) {
      try {
        bd = JSON.parse(fs.readFileSync(backlogJsonPath, "utf8"));
      } catch {}
    } else if (fs.existsSync(backlogHtmlPath)) {
      const html = fs.readFileSync(backlogHtmlPath, "utf8");
      const m = html.match(
        /<script id="backlog-data"[^>]*>([\s\S]*?)<\/script>/,
      );
      if (m) {
        try {
          bd = JSON.parse(m[1].trim());
        } catch {}
      }
    }
    if (bd) {
      const flags = bd.flags || {};
      let flagsChanged = false;
      if ("hasConcept" in flags) {
        flags.hasSeed = flags.hasConcept;
        delete flags.hasConcept;
        flagsChanged = true;
      }
      if ("conceptPath" in flags) {
        flags.seedPath = flags.conceptPath;
        delete flags.conceptPath;
        flagsChanged = true;
      }
      if (flagsChanged) {
        bd.flags = flags;
        if (!bd.schemaVersion) bd.schemaVersion = 2;
        fs.writeFileSync(
          backlogJsonPath,
          JSON.stringify(bd, null, 2) + "\n",
          "utf8",
        );
      }
    }

    console.log(`migrated: ${entry.name}`);
    migrated++;
  } catch (err) {
    console.error(`error:    ${entry.name}  (${err.message})`);
    errors++;
  }
}

console.log(
  `\nDone — migrated: ${migrated}, skipped: ${skipped}, errors: ${errors}`,
);
