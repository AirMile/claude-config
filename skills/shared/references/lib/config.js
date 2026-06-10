// Shared constants for the project server

const path = require("path");
const fs = require("fs");
const os = require("os");

function readProjectsRootFromYaml() {
  // lib/config.js lives in skills/shared/references/lib/ → ../../../../ = config-repo root
  const repoRoot = path.resolve(__dirname, "../../../..");
  const pathsLocal = path.join(repoRoot, ".claude", "paths.local.yaml");
  if (!fs.existsSync(pathsLocal)) return null;
  try {
    const content = fs.readFileSync(pathsLocal, "utf8");
    const match = content.match(/^\s*projects_root:\s*"?([^"\n]+)"?/m);
    if (!match) return null;
    let value = match[1].trim().replace(/"$/, "");
    if (value.startsWith("~/")) value = path.join(os.homedir(), value.slice(2));
    if (value.startsWith("$HOME/"))
      value = path.join(os.homedir(), value.slice(6));
    return value;
  } catch {
    return null;
  }
}

const platformDefault =
  process.platform === "win32"
    ? "C:\\Projects"
    : path.join(os.homedir(), "projects");

const PROJECTS_ROOT = path.resolve(
  process.argv[2] ||
    process.env.CLAUDE_PROJECTS_ROOT ||
    readProjectsRootFromYaml() ||
    platformDefault,
);
const PORT = parseInt(process.env.BACKLOG_PORT || "9876", 10);
const BACKLOG_PATH = ".project/backlog.json";
const LEGACY_BACKLOG_PATH = ".project/backlog.html";
const DASHBOARD_PATH = ".project/project.json";
const TEMPLATE_PATH = path.join(__dirname, "../backlog-template.html");
const DASHBOARD_TEMPLATE_PATH = path.join(
  __dirname,
  "../dashboard-template.html",
);

module.exports = {
  PROJECTS_ROOT,
  PORT,
  BACKLOG_PATH,
  LEGACY_BACKLOG_PATH,
  DASHBOARD_PATH,
  TEMPLATE_PATH,
  DASHBOARD_TEMPLATE_PATH,
};
