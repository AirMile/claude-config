// Backlog server — serves all project backlogs from one server
// Usage: node serve-backlog.js [projects-root]
// Default: ~/projects
//
// Routes:
//   /                    → index with all backlogs
//   /{project}           → that project's backlog
//   /{project}/save      → save changes to disk

const http = require("http");
const fs = require("fs");
const path = require("path");

const PROJECTS_ROOT = path.resolve(
  process.argv[2] || path.join(require("os").homedir(), "projects"),
);
const PORT = parseInt(process.env.BACKLOG_PORT || "9876", 10);
const BACKLOG_PATH = ".workspace/backlog.html";
const TEMPLATE_PATH = path.join(__dirname, "backlog-template.html");

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
      const hasBacklog = fs.existsSync(file);
      let project = name;
      let updated = null;

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

      projects.push({ dir: name, project, updated, hasBacklog, file });
    }
  } catch {}
  // Backlogs first (by updated desc), then non-backlogs (alphabetical)
  return projects.sort((a, b) => {
    if (a.hasBacklog && !b.hasBacklog) return -1;
    if (!a.hasBacklog && b.hasBacklog) return 1;
    if (a.hasBacklog && b.hasBacklog)
      return (b.updated || "").localeCompare(a.updated || "");
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
      adhoc: [],
      notes: "",
    },
    null,
    2,
  );

  let html = fs.readFileSync(TEMPLATE_PATH, "utf8");
  html = html.replace(
    /(<script id="backlog-data" type="application\/json">)([\s\S]*?)(<\/script>)/,
    `$1\n${emptyData}\n$3`,
  );
  fs.writeFileSync(file, html, "utf8");
  return file;
}

function indexPage(projects) {
  const rows = projects
    .map((p) => {
      if (p.hasBacklog) {
        return `
      <a href="/${p.dir}" class="project">
        <span class="name">${esc(p.project)}</span>
        <span class="dir">${esc(p.dir)}</span>
        <span class="date">${esc(p.updated || "—")}</span>
      </a>`;
      }
      return `
      <div class="project empty-project">
        <span class="name dim">${esc(p.dir)}</span>
        <span class="dir">geen backlog</span>
        <form method="POST" action="/${p.dir}/create" style="margin:0">
          <button type="submit" class="create-btn">+ Nieuw</button>
        </form>
      </div>`;
    })
    .join("");

  return `<!doctype html>
<html lang="nl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Backlogs</title>
  <style>
    :root { --bg:#0d1117; --surface:#161b22; --border:#30363d; --text:#e6edf3; --muted:#8b949e; --accent:#58a6ff; }
    * { margin:0; padding:0; box-sizing:border-box; }
    body { font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Helvetica,Arial,sans-serif; background:var(--bg); color:var(--text); padding:40px 24px; scrollbar-color:var(--border) transparent; }
    ::-webkit-scrollbar { width:8px; height:8px; }
    ::-webkit-scrollbar-track { background:transparent; }
    ::-webkit-scrollbar-thumb { background:var(--border); border-radius:4px; }
    ::-webkit-scrollbar-thumb:hover { background:var(--muted); }
    h1 { font-size:18px; margin-bottom:24px; }
    .projects { display:flex; flex-direction:column; gap:8px; max-width:500px; }
    .project { display:flex; align-items:center; gap:12px; padding:12px 16px; background:var(--surface); border:1px solid var(--border); border-radius:6px; text-decoration:none; color:var(--text); transition:all 0.15s; }
    .project:hover { border-color:var(--accent); background:#1c2333; }
    .empty-project { border-style:dashed; opacity:0.7; }
    .empty-project:hover { opacity:1; }
    .name { font-weight:600; font-size:14px; flex:1; }
    .name.dim { color:var(--muted); }
    .dir { font-size:12px; color:var(--muted); }
    .date { font-size:12px; color:var(--muted); }
    .create-btn { background:none; border:1px solid var(--accent); color:var(--accent); padding:4px 12px; border-radius:4px; font-size:12px; cursor:pointer; transition:all 0.15s; }
    .create-btn:hover { background:var(--accent); color:var(--bg); }
    .hint { margin-top:24px; font-size:12px; color:var(--muted); }
    .hint code { background:var(--surface); padding:2px 6px; border-radius:3px; color:var(--accent); }
  </style>
</head>
<body>
  <h1>Backlogs</h1>
  <div class="projects">${rows}</div>
</body>
</html>`;
}

function esc(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

http
  .createServer((req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

    if (req.method === "OPTIONS") {
      res.writeHead(204);
      return res.end();
    }

    const url = new URL(req.url, `http://localhost:${PORT}`);
    const parts = url.pathname.split("/").filter(Boolean);

    // Index
    if (req.method === "GET" && parts.length === 0) {
      const projects = findProjects();
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(indexPage(projects));
      return;
    }

    // Project routes: /{project}, /{project}/save, /{project}/create
    if (parts.length >= 1) {
      const projectDir = parts[0];

      // Security: no path traversal
      if (projectDir.includes("..")) {
        res.writeHead(400);
        res.end("Ongeldig pad");
        return;
      }

      const projectPath = path.join(PROJECTS_ROOT, projectDir);
      if (!fs.existsSync(projectPath)) {
        res.writeHead(404);
        res.end("Project niet gevonden: " + esc(projectDir));
        return;
      }

      // Create backlog
      if (req.method === "POST" && parts[1] === "create") {
        const file = path.join(projectPath, BACKLOG_PATH);
        if (!fs.existsSync(file)) {
          try {
            createBacklog(projectDir);
          } catch (e) {
            res.writeHead(500);
            res.end("Create error: " + e.message);
            return;
          }
        }
        res.writeHead(302, { Location: "/" + projectDir });
        res.end();
        return;
      }

      const file = path.join(projectPath, BACKLOG_PATH);

      // No backlog yet — redirect to index
      if (!fs.existsSync(file)) {
        res.writeHead(302, { Location: "/" });
        res.end();
        return;
      }

      // Serve backlog
      if (req.method === "GET" && parts.length === 1) {
        try {
          const html = fs.readFileSync(file, "utf8");
          res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
          res.end(html);
        } catch (e) {
          res.writeHead(500);
          res.end("Read error: " + e.message);
        }
        return;
      }

      // Save
      if (req.method === "POST" && parts[1] === "save") {
        let body = "";
        req.on("data", (chunk) => (body += chunk));
        req.on("end", () => {
          try {
            const jsonData = JSON.parse(body);
            const jsonStr = JSON.stringify(jsonData, null, 2);

            const html = fs.readFileSync(file, "utf8");
            const updated = html.replace(
              /(<script id="backlog-data" type="application\/json">)([\s\S]*?)(<\/script>)/,
              `$1\n${jsonStr}\n$3`,
            );

            fs.writeFileSync(file, updated, "utf8");
            res.writeHead(200, { "Content-Type": "application/json" });
            res.end('{"ok":true}');
          } catch (e) {
            res.writeHead(500, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: e.message }));
          }
        });
        return;
      }
    }

    res.writeHead(404);
    res.end("Not found");
  })
  .listen(PORT, () => {
    console.log(`\nBacklogs: http://localhost:${PORT}`);
    console.log(`Scanning: ${PROJECTS_ROOT}/*/${BACKLOG_PATH}\n`);
  });
