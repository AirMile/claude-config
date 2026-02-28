// Shared constants for the project server

const path = require("path");

const PROJECTS_ROOT = path.resolve(
  process.argv[2] || path.join(require("os").homedir(), "projects"),
);
const PORT = parseInt(process.env.BACKLOG_PORT || "9876", 10);
const BACKLOG_PATH = ".project/backlog.html";
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
  DASHBOARD_PATH,
  TEMPLATE_PATH,
  DASHBOARD_TEMPLATE_PATH,
};
