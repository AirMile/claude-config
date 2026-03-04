// Project operations: find, create backlog, create dashboard

const fs = require("fs");
const path = require("path");
const {
  PROJECTS_ROOT,
  BACKLOG_PATH,
  DASHBOARD_PATH,
  TEMPLATE_PATH,
} = require("./config");
const { createDefaultDashboardData } = require("./defaults");

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
      const hasBacklog = fs.existsSync(file);
      const hasDashboard = fs.existsSync(dashFile);
      var project = name;
      var updated = null;

      if (hasBacklog) {
        try {
          const html = fs.readFileSync(file, "utf8");
          const match = html.match(
            /<script id="backlog-data" type="application\/json">([\s\S]*?)<\/script>/,
          );
          if (match) {
            const data = JSON.parse(match[1]);
            project = data.project || name;
            updated = data.updated || null;
          }
        } catch {}
      }

      if (hasDashboard && !hasBacklog) {
        try {
          const json = JSON.parse(fs.readFileSync(dashFile, "utf8"));
          if (json.concept && json.concept.name) project = json.concept.name;
        } catch {}
      }

      // Use most recent mtime of backlog.html or project.json
      var mtime = 0;
      if (hasBacklog) {
        try {
          mtime = Math.max(mtime, fs.statSync(file).mtimeMs);
        } catch {}
      }
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
      });
    }
  } catch {}
  // Active projects first (most recently used first), then empty (alphabetical)
  return projects.sort(function (a, b) {
    const aActive = a.hasBacklog || a.hasDashboard;
    const bActive = b.hasBacklog || b.hasDashboard;
    if (aActive && !bActive) return -1;
    if (!aActive && bActive) return 1;
    if (aActive && bActive) return b.mtime - a.mtime;
    return a.dir.localeCompare(b.dir);
  });
}

function createBacklog(projectDir) {
  const file = path.join(PROJECTS_ROOT, projectDir, BACKLOG_PATH);
  const wsDir = path.dirname(file);
  if (!fs.existsSync(wsDir)) fs.mkdirSync(wsDir, { recursive: true });

  const today = new Date().toISOString().slice(0, 10);
  const emptyData = JSON.stringify(
    {
      project: projectDir,
      generated: today,
      updated: today,
      source: "manual",
      overview: "",
      features: [],
      notes: "",
    },
    null,
    2,
  );

  var html = fs.readFileSync(TEMPLATE_PATH, "utf8");
  html = html.replace(
    /(<script id="backlog-data" type="application\/json">)([\s\S]*?)(<\/script>)/,
    "$1\n" + emptyData + "\n$3",
  );
  fs.writeFileSync(file, html, "utf8");
  return file;
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
};
