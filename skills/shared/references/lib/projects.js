// Project operations: find, create backlog, create dashboard

const fs = require("fs");
const path = require("path");
const {
  PROJECTS_ROOT,
  BACKLOG_PATH,
  LEGACY_BACKLOG_PATH,
  DASHBOARD_PATH,
} = require("./config");
const { createDefaultDashboardData } = require("./defaults");

// ── Backlog data store (.project/backlog.json) ──
// Canonical store is JSON; legacy projects (pre-migration) embed the data in
// backlog.html — read-only fallback so they keep working until migrated via
// scripts/migrate-project.py.

function readBacklogData(projectRootAbs) {
  const jsonFile = path.join(projectRootAbs, BACKLOG_PATH);
  if (fs.existsSync(jsonFile)) {
    try {
      return JSON.parse(fs.readFileSync(jsonFile, "utf8"));
    } catch {
      return null;
    }
  }
  const legacyFile = path.join(projectRootAbs, LEGACY_BACKLOG_PATH);
  if (fs.existsSync(legacyFile)) {
    try {
      const html = fs.readFileSync(legacyFile, "utf8");
      const match = html.match(
        /<script id="backlog-data" type="application\/json">([\s\S]*?)<\/script>/,
      );
      if (match) return JSON.parse(match[1]);
    } catch {}
  }
  return null;
}

// Shipped dev-track features are moved out of backlog.json into the archive
// (.project/archive/backlog-archive.json — see shared/BACKLOG.md § Archiving).
// Merge them back into a features list so dependency resolution and the
// shipped-showcase can still see them. Skips names already present; returns a
// new array and never mutates the input. Best-effort — a missing/corrupt
// archive just yields the input unchanged.
function mergeArchivedFeatures(projectRootAbs, features) {
  const out = Array.isArray(features) ? features.slice() : [];
  try {
    const archiveFile = path.join(
      projectRootAbs,
      ".project/archive/backlog-archive.json",
    );
    if (fs.existsSync(archiveFile)) {
      const archive = JSON.parse(fs.readFileSync(archiveFile, "utf8"));
      if (Array.isArray(archive.archived)) {
        const names = new Set(out.map((f) => f.name));
        for (const f of archive.archived) {
          if (!names.has(f.name)) out.push(f);
        }
      }
    }
  } catch {}
  return out;
}

function writeBacklogData(projectRootAbs, data) {
  const jsonFile = path.join(projectRootAbs, BACKLOG_PATH);
  const wsDir = path.dirname(jsonFile);
  if (!fs.existsSync(wsDir)) fs.mkdirSync(wsDir, { recursive: true });
  // Defensive: GET /backlog merges archived (already-shipped) features into the
  // in-memory model via mergeArchivedFeatures above, so the board can resolve
  // dependencies on them. If a client round-trips that merged model back through
  // a save (drag-reorder, edit, etc.), archived features would otherwise be
  // written straight back into the live store, permanently re-duplicating them
  // (the exact failure this guard closes — see shared/BACKLOG.md § Archive-move
  // invariant). Strip any feature already in the archive before persisting; the
  // archive is the source of truth once a dev-track feature has shipped.
  if (data && Array.isArray(data.features)) {
    try {
      const archiveFile = path.join(
        projectRootAbs,
        ".project/archive/backlog-archive.json",
      );
      if (fs.existsSync(archiveFile)) {
        const archive = JSON.parse(fs.readFileSync(archiveFile, "utf8"));
        if (Array.isArray(archive.archived)) {
          const archivedNames = new Set(archive.archived.map((f) => f.name));
          data.features = data.features.filter(
            (f) => !archivedNames.has(f.name),
          );
        }
      }
    } catch {}
  }
  fs.writeFileSync(jsonFile, JSON.stringify(data, null, 2), "utf8");
  return jsonFile;
}

function backlogExists(projectRootAbs) {
  return (
    fs.existsSync(path.join(projectRootAbs, BACKLOG_PATH)) ||
    fs.existsSync(path.join(projectRootAbs, LEGACY_BACKLOG_PATH))
  );
}

function backlogMtime(projectRootAbs) {
  var mtime = 0;
  for (const rel of [BACKLOG_PATH, LEGACY_BACKLOG_PATH]) {
    try {
      const f = path.join(projectRootAbs, rel);
      if (fs.existsSync(f)) mtime = Math.max(mtime, fs.statSync(f).mtimeMs);
    } catch {}
  }
  return mtime;
}

// ── Last-opened tracking ──
const LAST_OPENED_FILE = path.join(PROJECTS_ROOT, ".last-opened.json");
let lastOpened = {};
try {
  lastOpened = JSON.parse(fs.readFileSync(LAST_OPENED_FILE, "utf8"));
} catch {}

function touchProject(dir) {
  lastOpened[dir] = Date.now();
  try {
    fs.writeFileSync(LAST_OPENED_FILE, JSON.stringify(lastOpened), "utf8");
  } catch {}
}

function findProjects() {
  const projects = [];
  try {
    for (const name of fs.readdirSync(PROJECTS_ROOT)) {
      const dirPath = path.join(PROJECTS_ROOT, name);
      try {
        if (!fs.statSync(dirPath).isDirectory() || name.startsWith("."))
          continue;
      } catch {
        continue;
      }

      const file = path.join(dirPath, BACKLOG_PATH);
      const dashFile = path.join(dirPath, DASHBOARD_PATH);
      const hasBacklog = backlogExists(dirPath);
      const hasDashboard = fs.existsSync(dashFile);
      var project = name;
      var updated = null;

      if (hasBacklog) {
        const data = readBacklogData(dirPath);
        if (data) {
          project = data.project || name;
          updated = data.updated || null;
        }
      }

      if (hasDashboard && !hasBacklog) {
        try {
          const json = JSON.parse(fs.readFileSync(dashFile, "utf8"));
          if (json.seed && json.seed.name) project = json.seed.name;
        } catch {}
      }

      // Use most recent mtime of backlog store or project.json
      var mtime = backlogMtime(dirPath);
      if (hasDashboard) {
        try {
          mtime = Math.max(mtime, fs.statSync(dashFile).mtimeMs);
        } catch {}
      }

      projects.push({
        dir: name,
        project,
        updated,
        hasBacklog,
        hasDashboard,
        file,
        mtime,
        lastOpened: lastOpened[name] || 0,
      });
    }
  } catch {}
  // Active projects first (most recently opened first), then empty (alphabetical)
  return projects.sort(function (a, b) {
    const aActive = a.hasBacklog || a.hasDashboard;
    const bActive = b.hasBacklog || b.hasDashboard;
    if (aActive && !bActive) return -1;
    if (!aActive && bActive) return 1;
    if (aActive && bActive) {
      // Prefer lastOpened, fall back to mtime
      var aTime = a.lastOpened || a.mtime;
      var bTime = b.lastOpened || b.mtime;
      return bTime - aTime;
    }
    return a.dir.localeCompare(b.dir);
  });
}

function createBacklog(projectDir) {
  const today = new Date().toISOString().slice(0, 10);
  return writeBacklogData(path.join(PROJECTS_ROOT, projectDir), {
    schemaVersion: 2,
    project: projectDir,
    generated: today,
    updated: today,
    source: "manual",
    overview: "",
    features: [],
    notes: "",
  });
}

function createDashboard(projectDir) {
  const file = path.join(PROJECTS_ROOT, projectDir, DASHBOARD_PATH);
  const wsDir = path.dirname(file);
  if (!fs.existsSync(wsDir)) fs.mkdirSync(wsDir, { recursive: true });

  const emptyData = createDefaultDashboardData(projectDir);

  fs.writeFileSync(file, JSON.stringify(emptyData, null, 2), "utf8");
  return file;
}

module.exports = {
  findProjects,
  createBacklog,
  createDashboard,
  touchProject,
  readBacklogData,
  writeBacklogData,
  mergeArchivedFeatures,
  backlogExists,
  backlogMtime,
};
