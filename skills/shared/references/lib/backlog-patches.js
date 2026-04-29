// Backlog patches loader: reads CSS + JS from separate files, builds injection string
// CSS served as external stylesheet (cacheable, visible in devtools)
// JS read at startup and inlined (patches chain globals like window.render, window.createCard)

const fs = require("fs");
const path = require("path");

const JS_DIR = path.join(__dirname, "../js");

// Ordered list — volgorde is belangrijk (patches chainen globals)
const JS_FILES = [
  "backlog-overrides.js",
  "backlog-assignee.js",
  "backlog-dependency.js",
  "backlog-actions.js",
  "backlog-session.js",
  "backlog-brief.js",
  "backlog-sort.js",
  "backlog-github.js",
];

// Read at startup, cache in memory
const jsContent = JS_FILES.map(function (f) {
  return fs.readFileSync(path.join(JS_DIR, f), "utf8");
});

const backlogPatch =
  '<link rel="stylesheet" href="/css/backlog-patches.css">' +
  jsContent
    .map(function (js) {
      return "<script>" + js + "</script>";
    })
    .join("");

module.exports = backlogPatch;
