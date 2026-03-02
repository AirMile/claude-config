// HTML generation: navbar, dashboard, index page, escape helper

const fs = require("fs");
const path = require("path");
const {
  PROJECTS_ROOT,
  DASHBOARD_PATH,
  DASHBOARD_TEMPLATE_PATH,
} = require("./config");
const { populateFromProject } = require("./populate");

function esc(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function getNavBarHtml(projectDir, activePage) {
  const dashClass = activePage === "dashboard" ? "active" : "";
  const backlogClass = activePage === "backlog" ? "active" : "";
  const projectName = projectDir;

  return `
<style>
  body { padding-top: 48px !important; }
  body > header { display:none !important; }
  #project-nav { position:fixed; top:0; left:0; right:0; height:48px; background:#0d1117; border-bottom:1px solid #30363d; display:flex; align-items:center; z-index:9999; font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Helvetica,Arial,sans-serif; font-size:14px; padding:0 20px; }
  #project-nav a { text-decoration:none; transition:all 0.15s; }
  #project-nav .pn-back { color:#8b949e; }
  #project-nav .pn-back:hover { color:#58a6ff; }
  #project-nav .pn-sep { color:#30363d; margin:0 8px; }
  #project-nav .pn-tabs { display:flex; gap:4px; }
  #project-nav .pn-tab { color:#8b949e; padding:6px 14px; border-bottom:2px solid transparent; }
  #project-nav .pn-tab:hover { color:#e6edf3; }
  #project-nav .pn-tab.active { color:#e6edf3; border-bottom-color:#58a6ff; }
  #project-nav .pn-name { color:#e6edf3; font-weight:600; margin-left:auto; white-space:nowrap; }
</style>
<nav id="project-nav">
  <a href="/" class="pn-back">&larr; Projects</a>
  <span class="pn-sep">/</span>
  <div class="pn-tabs">
    <a href="/${esc(projectDir)}/backlog" class="pn-tab ${backlogClass}">Backlog</a>
    <a href="/${esc(projectDir)}" class="pn-tab ${dashClass}">Dashboard</a>
  </div>
  <span class="pn-name">${esc(projectName)}</span>
</nav>`;
}

function serveDashboard(projectDir) {
  const dashFile = path.join(PROJECTS_ROOT, projectDir, DASHBOARD_PATH);
  var dashData = {
    concept: {
      name: projectDir,
      content: "",
    },
    theme: {
      colors: { main: [], accent: [], semantic: [] },
      typography: { families: { heading: "", body: "", mono: "" }, sizes: [] },
      spacing: { base: "", scale: [] },
      breakpoints: [],
      borderRadius: [],
      shadows: [],
      modes: {},
      cssVars: "",
    },
    stack: {
      framework: "",
      language: "",
      styling: "",
      db: "",
      auth: "",
      hosting: "",
      packages: [],
    },
    data: { entities: [] },
    endpoints: [],
    features: [],
    thinking: [],
  };

  if (fs.existsSync(dashFile)) {
    try {
      dashData = JSON.parse(fs.readFileSync(dashFile, "utf8"));
    } catch {}
  }

  // Auto-populate from project files if sections are empty
  dashData = populateFromProject(projectDir, dashData);

  var html = fs.readFileSync(DASHBOARD_TEMPLATE_PATH, "utf8");
  var startTag = '<script id="dashboard-data" type="application/json">';
  var startIdx = html.indexOf(startTag) + startTag.length;
  var endIdx = html.indexOf("</script>", startIdx);
  html =
    html.substring(0, startIdx) +
    "\n" +
    JSON.stringify(dashData, null, 2) +
    "\n" +
    html.substring(endIdx);
  const nav = getNavBarHtml(projectDir, "dashboard");
  const dashRefresh = `<script>
(function(){
  var base = location.pathname.replace(/\\/+$/, "");
  var es = new EventSource(base + "/events");
  es.onmessage = function(e) {
    if (e.data !== "dashboard") return;
    if (document.querySelector(".modal.visible, .modal[style*='display: flex']")) return;
    fetch(base + "/data").then(function(r){ return r.json(); }).then(function(newData) {
      if (JSON.stringify(newData) === JSON.stringify(data)) return;
      data = newData;
      render();
    }).catch(function(){});
  };
})();
</script>`;
  html = html.replace("</body>", dashRefresh + nav + "</body>");
  return html;
}

function indexPage(projects) {
  const activeProjects = projects.filter(function (p) {
    return p.hasBacklog || p.hasDashboard;
  });
  const emptyProjects = projects.filter(function (p) {
    return !p.hasBacklog && !p.hasDashboard;
  });

  const projectCard = function (p) {
    const displayName = p.dir;

    const dashBtn = p.hasDashboard
      ? `<a href="/${p.dir}" class="nav-btn nav-dash"><svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="1" y="1" width="6" height="6" rx="1" stroke="currentColor" stroke-width="1.5"/><rect x="9" y="1" width="6" height="6" rx="1" stroke="currentColor" stroke-width="1.5"/><rect x="1" y="9" width="6" height="6" rx="1" stroke="currentColor" stroke-width="1.5"/><rect x="9" y="9" width="6" height="6" rx="1" stroke="currentColor" stroke-width="1.5"/></svg>Dashboard</a>`
      : `<form method="POST" action="/${p.dir}/create" style="margin:0"><button type="submit" class="nav-btn nav-new"><svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="1" y="1" width="6" height="6" rx="1" stroke="currentColor" stroke-width="1.5"/><rect x="9" y="1" width="6" height="6" rx="1" stroke="currentColor" stroke-width="1.5"/><rect x="1" y="9" width="6" height="6" rx="1" stroke="currentColor" stroke-width="1.5"/><rect x="9" y="9" width="6" height="6" rx="1" stroke="currentColor" stroke-width="1.5"/></svg>Dashboard</button></form>`;

    const backlogBtn = p.hasBacklog
      ? `<a href="/${p.dir}/backlog" class="nav-btn nav-backlog"><svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="1" y="2" width="14" height="3" rx="1" stroke="currentColor" stroke-width="1.5"/><rect x="1" y="7" width="14" height="3" rx="1" stroke="currentColor" stroke-width="1.5"/><rect x="1" y="12" width="14" height="3" rx="1" stroke="currentColor" stroke-width="1.5"/></svg>Backlog</a>`
      : `<form method="POST" action="/${p.dir}/backlog/create" style="margin:0"><button type="submit" class="nav-btn nav-new"><svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="1" y="2" width="14" height="3" rx="1" stroke="currentColor" stroke-width="1.5"/><rect x="1" y="7" width="14" height="3" rx="1" stroke="currentColor" stroke-width="1.5"/><rect x="1" y="12" width="14" height="3" rx="1" stroke="currentColor" stroke-width="1.5"/></svg>Backlog</button></form>`;

    return `
      <div class="project-row" onclick="window.location='/${p.dir}'">
        <div class="row-info">
          <span class="row-name">${esc(displayName)}</span>
        </div>
        <div class="row-actions" onclick="event.stopPropagation()">
          ${backlogBtn}
          ${dashBtn}
        </div>
      </div>`;
  };

  const emptyCard = function (p) {
    return `
      <div class="project-row empty-row">
        <div class="row-info">
          <span class="row-name">${esc(p.dir)}</span>
        </div>
        <div class="row-actions">
          <form method="POST" action="/${p.dir}/backlog/create" style="margin:0"><button type="submit" class="nav-btn nav-new"><svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="1" y="2" width="14" height="3" rx="1" stroke="currentColor" stroke-width="1.5"/><rect x="1" y="7" width="14" height="3" rx="1" stroke="currentColor" stroke-width="1.5"/><rect x="1" y="12" width="14" height="3" rx="1" stroke="currentColor" stroke-width="1.5"/></svg>Backlog</button></form>
          <form method="POST" action="/${p.dir}/create" style="margin:0"><button type="submit" class="nav-btn nav-new"><svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="1" y="1" width="6" height="6" rx="1" stroke="currentColor" stroke-width="1.5"/><rect x="9" y="1" width="6" height="6" rx="1" stroke="currentColor" stroke-width="1.5"/><rect x="1" y="9" width="6" height="6" rx="1" stroke="currentColor" stroke-width="1.5"/><rect x="9" y="9" width="6" height="6" rx="1" stroke="currentColor" stroke-width="1.5"/></svg>Dashboard</button></form>
        </div>
      </div>`;
  };

  const activeRows = activeProjects.map(projectCard).join("");
  const emptyRows = emptyProjects.map(emptyCard).join("");

  return `<!doctype html>
<html lang="nl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Projects</title>
  <style>
    :root { --bg:#0d1117; --surface:#161b22; --border:#30363d; --text:#e6edf3; --muted:#8b949e; --accent:#58a6ff; --purple:#d2a8ff; --green:#3fb950; }
    * { margin:0; padding:0; box-sizing:border-box; }
    body { font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Helvetica,Arial,sans-serif; background:var(--bg); color:var(--text); min-height:100vh; scrollbar-color:var(--border) transparent; }
    ::-webkit-scrollbar { width:8px; height:8px; }
    ::-webkit-scrollbar-track { background:transparent; }
    ::-webkit-scrollbar-thumb { background:var(--border); border-radius:4px; }
    ::-webkit-scrollbar-thumb:hover { background:var(--muted); }

    .page-header { padding:40px 48px 0; max-width:800px; margin:0 auto; }
    .page-header h1 { font-size:24px; font-weight:700; letter-spacing:-0.5px; }

    .projects-list { display:flex; flex-direction:column; gap:8px; padding:24px 48px 48px; max-width:800px; margin:0 auto; }

    .section-label { font-size:11px; font-weight:600; text-transform:uppercase; letter-spacing:1px; color:var(--muted); padding:20px 0 8px; }
    .section-label:first-child { padding-top:0; }

    .project-row { display:flex; align-items:center; gap:16px; padding:14px 20px; background:var(--surface); border:1px solid var(--border); border-radius:8px; transition:all 0.15s ease; cursor:pointer; }
    .project-row:hover { border-color:#484f58; background:#1c2333; }

    .empty-row { border-style:dashed; opacity:0.5; }
    .empty-row:hover { opacity:0.8; }

    .row-info { display:flex; align-items:baseline; gap:10px; min-width:0; flex:1; }
    .row-name { font-weight:600; font-size:15px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; color:var(--text); text-decoration:none; }
    .row-name:hover { color:var(--accent); }
    .row-dir { font-size:12px; color:var(--muted); white-space:nowrap; }

    .row-actions { display:flex; gap:8px; flex-shrink:0; margin-left:auto; }

    .nav-btn { display:inline-flex; align-items:center; gap:6px; padding:7px 16px; border-radius:6px; font-size:13px; font-weight:500; font-family:inherit; cursor:pointer; text-decoration:none; transition:all 0.15s ease; border:1px solid transparent; white-space:nowrap; }

    .nav-dash { background:rgba(210,168,255,0.1); color:var(--purple); border-color:rgba(210,168,255,0.2); }
    .nav-dash:hover { background:rgba(210,168,255,0.18); border-color:rgba(210,168,255,0.4); }

    .nav-backlog { background:rgba(88,166,255,0.1); color:var(--accent); border-color:rgba(88,166,255,0.2); }
    .nav-backlog:hover { background:rgba(88,166,255,0.18); border-color:rgba(88,166,255,0.4); }

    .nav-new { background:none; color:var(--muted); border:1px dashed var(--border); }
    .nav-new:hover { color:var(--accent); border-color:var(--accent); border-style:solid; background:rgba(88,166,255,0.05); }

    @media (max-width:600px) {
      .projects-list { padding:24px; }
      .page-header { padding:32px 24px 0; }
      .project-row { flex-wrap:wrap; }
    }
  </style>
</head>
<body>
  <div class="page-header">
    <h1>Projects</h1>
  </div>
  <div class="projects-list">
    ${activeRows}
  </div>
</body>
</html>`;
}

module.exports = {
  getNavBarHtml,
  serveDashboard,
  indexPage,
  esc,
};
