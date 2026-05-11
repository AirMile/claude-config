// Backlog patches loader: reads CSS + JS from separate files, builds injection string
// CSS served as external stylesheet (cacheable, visible in devtools)
// JS read fresh per request so edits are picked up without server restart

const fs = require("fs");
const path = require("path");

const JS_DIR = path.join(__dirname, "../js");

// Ordered list — volgorde is belangrijk (patches chainen globals)
const JS_FILES = [
  "backlog-overrides.js",
  "backlog-dependency.js",
  "backlog-actions.js",
  "backlog-session.js",
  "backlog-brief.js",
  "backlog-sort.js",
];

function buildBacklogPatch() {
  const scripts = JS_FILES.map(function (f) {
    const js = fs.readFileSync(path.join(JS_DIR, f), "utf8");
    return "<script>" + js + "</script>";
  }).join("");
  return '<link rel="stylesheet" href="/css/backlog-patches.css">' + scripts;
}

module.exports = buildBacklogPatch;
