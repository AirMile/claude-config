// HTML generation: navbar, dashboard, index page, escape helper

const fs = require("fs");
const path = require("path");
const {
  PROJECTS_ROOT,
  DASHBOARD_PATH,
  DASHBOARD_TEMPLATE_PATH,
} = require("./config");
const { populateFromProject } = require("./populate");
const { createDefaultDashboardData } = require("./defaults");

function esc(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function getNavBarHtml(projectDir, activePage, session) {
  const dashClass = activePage === "dashboard" ? "active" : "";
  const backlogClass = activePage === "backlog" ? "active" : "";
  const projectName = projectDir;

  // Teammates with 1 project: no back link. Multiple projects: show back link.
  const isTeammate = session && session.role === "teammate";
  const showBack =
    !isTeammate || (session.projects && session.projects.length > 1);
  const backHtml = showBack
    ? '<a href="/" class="pn-back">&larr; Projects</a><span class="pn-sep">/</span>'
    : "";

  return `
<style>
  body { padding-top: 48px !important; }
  body > header { display:none !important; }
  #project-nav { position:fixed; top:0; left:0; right:0; height:48px; background:var(--bg); border-bottom:1px solid var(--border); display:flex; align-items:center; z-index:9999; font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Helvetica,Arial,sans-serif; font-size:14px; padding:0 20px; }
  #project-nav a { text-decoration:none; transition:all 0.15s; }
  #project-nav .pn-back { color:var(--text-muted); }
  #project-nav .pn-back:hover { color:var(--accent); }
  #project-nav .pn-sep { color:var(--border); margin:0 8px; }
  #project-nav .pn-tabs { display:flex; gap:4px; }
  #project-nav .pn-tab { color:var(--text-muted); padding:6px 14px; border-bottom:2px solid transparent; }
  #project-nav .pn-tab:hover { color:var(--text); }
  #project-nav .pn-tab.active { color:var(--text); border-bottom-color:var(--accent); }
  #project-nav .pn-name { color:var(--text); font-weight:600; margin-left:auto; white-space:nowrap; }
</style>
<nav id="project-nav">
  ${backHtml}
  <div class="pn-tabs">
    <a href="/${esc(projectDir)}/backlog" class="pn-tab ${backlogClass}">Backlog</a>
    <a href="/${esc(projectDir)}" class="pn-tab ${dashClass}">Dashboard</a>
  </div>
  <span class="pn-name">${esc(projectName)}</span>
</nav>`;
}

function serveDashboard(projectDir, session) {
  const dashFile = path.join(PROJECTS_ROOT, projectDir, DASHBOARD_PATH);
  var dashData = createDefaultDashboardData(projectDir);

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
  const nav = getNavBarHtml(projectDir, "dashboard", session);

  // Inject role script for teammates
  var roleScript = "";
  if (session && session.role === "teammate") {
    roleScript =
      "<script>window.__role=" +
      JSON.stringify(session.role) +
      ";window.__userName=" +
      JSON.stringify(session.name || "") +
      ";</script>";
  }

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
  html = html.replace("</body>", roleScript + dashRefresh + nav + "</body>");
  return html;
}

function indexPage(projects, session, tunnelUrl) {
  const isAdmin = !session || session.role === "admin";
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
  const emptyRows = isAdmin ? emptyProjects.map(emptyCard).join("") : "";

  return `<!doctype html>
<html lang="nl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="color-scheme" content="dark light">
  <title>Projects</title>
  <script src="/lib/themes.js"></script>
  <link rel="stylesheet" href="/css/theme-picker.css">
  <script src="https://cdn.jsdelivr.net/npm/marked@15/marked.min.js"></script>
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
    .project-row:hover { border-color:color-mix(in srgb, var(--border) 70%, var(--text-muted)); background:var(--surface-hover); }

    .empty-row { border-style:dashed; opacity:0.5; }
    .empty-row:hover { opacity:0.8; }

    .row-info { display:flex; align-items:baseline; gap:10px; min-width:0; flex:1; }
    .row-name { font-weight:600; font-size:15px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; color:var(--text); text-decoration:none; }
    .row-name:hover { color:var(--accent); }
    .row-dir { font-size:12px; color:var(--muted); white-space:nowrap; }

    .row-actions { display:flex; gap:8px; flex-shrink:0; margin-left:auto; }

    .nav-btn { display:inline-flex; align-items:center; gap:6px; padding:7px 16px; border-radius:6px; font-size:13px; font-weight:500; font-family:inherit; cursor:pointer; text-decoration:none; transition:all 0.15s ease; border:1px solid transparent; white-space:nowrap; }

    .nav-dash { background:color-mix(in srgb, var(--purple) 10%, transparent); color:var(--purple); border-color:color-mix(in srgb, var(--purple) 20%, transparent); }
    .nav-dash:hover { background:color-mix(in srgb, var(--purple) 18%, transparent); border-color:color-mix(in srgb, var(--purple) 40%, transparent); }

    .nav-backlog { background:color-mix(in srgb, var(--accent) 10%, transparent); color:var(--accent); border-color:color-mix(in srgb, var(--accent) 20%, transparent); }
    .nav-backlog:hover { background:color-mix(in srgb, var(--accent) 18%, transparent); border-color:color-mix(in srgb, var(--accent) 40%, transparent); }

    .nav-new { background:none; color:var(--muted); border:1px dashed var(--border); }
    .nav-new:hover { color:var(--accent); border-color:var(--accent); border-style:solid; background:color-mix(in srgb, var(--accent) 5%, transparent); }

    .page-header { display:flex; align-items:center; justify-content:space-between; }
    .config-open-btn { padding:6px 14px; border-radius:6px; font-size:13px; font-weight:500; cursor:pointer; font-family:inherit; border:1px solid var(--border); background:var(--surface); color:var(--muted); transition:all 0.15s; }
    .config-open-btn:hover { color:var(--text); border-color:color-mix(in srgb, var(--border) 70%, var(--text-muted)); background:var(--surface-hover); }
    .config-overlay { display:none; position:fixed; inset:0; background:rgba(0,0,0,0.6); z-index:10000; justify-content:center; align-items:start; padding:48px 24px; overflow-y:auto; }
    .config-overlay.visible { display:flex; }
    .config-modal { background:var(--surface); border:1px solid var(--border); border-radius:12px; width:100%; max-width:720px; max-height:calc(100vh - 96px); overflow-y:auto; padding:24px; }
    .config-header { display:flex; align-items:center; justify-content:space-between; margin-bottom:16px; }
    .config-header h3 { font-size:16px; font-weight:600; }
    .config-btn { padding:4px 14px; border-radius:6px; font-size:13px; cursor:pointer; font-family:inherit; }
    .config-btn-edit { border:1px solid var(--border); background:none; color:var(--muted); }
    .config-btn-edit:hover { color:var(--text); border-color:color-mix(in srgb, var(--border) 70%, var(--text-muted)); }
    .config-btn-save { border:1px solid var(--accent); background:color-mix(in srgb, var(--accent) 15%, transparent); color:var(--accent); }
    .config-btn-cancel { border:1px solid var(--border); background:none; color:var(--muted); }
    .config-btn-close { border:1px solid var(--border); background:none; color:var(--muted); font-size:18px; line-height:1; padding:4px 8px; }
    .config-btn-close:hover { color:var(--text); border-color:color-mix(in srgb, var(--border) 70%, var(--text-muted)); }
    .config-md { font-size:13px; line-height:1.6; color:var(--muted); }
    .config-md h1 { font-size:18px; color:var(--text); margin:0 0 8px; }
    .config-md h2 { font-size:15px; color:var(--accent); margin:20px 0 6px; padding-bottom:4px; border-bottom:1px solid var(--border); }
    .config-md h3 { font-size:14px; color:var(--text); margin:16px 0 4px; }
    .config-md p { margin:0 0 8px; }
    .config-md ul, .config-md ol { margin:0 0 8px; padding-left:20px; }
    .config-md li { margin-bottom:2px; }
    .config-md strong { color:var(--text); }
    .config-md code { background:color-mix(in srgb, var(--text-dim) 15%, transparent); padding:1px 5px; border-radius:3px; font-size:12px; }
    .config-md pre { background:var(--bg); padding:12px; border-radius:6px; overflow-x:auto; margin:8px 0; }
    .config-md pre code { background:none; padding:0; }
    .config-md hr { border:none; border-top:1px solid var(--border); margin:12px 0; }
    .config-md a { color:var(--accent); text-decoration:none; }

    @media (max-width:600px) {
      .projects-list { padding:24px; }
      .page-header { padding:32px 24px 0; }
      .project-row { flex-wrap:wrap; }
      .global-config { padding:0 24px 24px; }
    }
  </style>
</head>
<body>
  <div class="page-header">
    <h1>Projects</h1>
    ${isAdmin ? '<div style="display:flex;gap:8px"><button class="config-open-btn" id="invite-open">Invite</button><button class="config-open-btn" id="config-open">Global Config</button></div>' : ""}
  </div>
  <div class="projects-list">
    ${activeRows}
  </div>
  <div class="config-overlay" id="invite-overlay">
    <div class="config-modal" id="invite-modal"></div>
  </div>
  <div class="config-overlay" id="config-overlay">
    <div class="config-modal" id="config-modal"></div>
  </div>
  ${
    isAdmin
      ? "<script>var __projectDirs=" +
        JSON.stringify(
          activeProjects.map(function (p) {
            return p.dir;
          }),
        ) +
        ";var __tunnelUrl=" +
        JSON.stringify(tunnelUrl || null) +
        ";</script>"
      : ""
  }
  <script>
  (function() {
    if (!document.getElementById("invite-open")) return;
    var overlay = document.getElementById("invite-overlay");
    var modal = document.getElementById("invite-modal");
    var invites = null;

    function esc(s) { return String(s||"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;"); }

    function renderInvites() {
      var formHtml =
        '<div class="config-header"><h3>Teammates uitnodigen</h3>' +
        '<button class="config-btn config-btn-close" id="inv-close">&times;</button></div>' +
        '<div style="display:flex;flex-direction:column;gap:16px">' +
        '<div><label style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;color:var(--muted);display:block;margin-bottom:6px">Naam</label>' +
        '<input id="inv-name" style="width:100%;max-width:240px;background:var(--bg);border:1px solid var(--border);border-radius:6px;color:var(--text);padding:8px 12px;font-size:13px;font-family:inherit;outline:none;transition:border-color 0.15s;color-scheme:dark" placeholder="Jan"></div>' +
        '<div><label style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;color:var(--muted);display:block;margin-bottom:6px">Projecten</label>' +
        '<div id="inv-projects" style="display:flex;gap:6px;flex-wrap:wrap">' +
        (__projectDirs||[]).map(function(d) {
          return '<label style="font-size:13px;color:var(--muted);display:flex;align-items:center;gap:6px;cursor:pointer;padding:5px 10px;background:var(--bg);border:1px solid var(--border);border-radius:6px;transition:all 0.15s;user-select:none">' +
            '<input type="checkbox" value="' + esc(d) + '" style="accent-color:var(--accent);margin:0"> ' + esc(d) + '</label>';
        }).join("") +
        '</div></div>' +
        '<div style="padding-top:4px"><button class="config-btn config-btn-save" id="inv-create" style="padding:8px 20px">Invite aanmaken</button></div></div>' +
        '<div style="height:20px"></div>';

      var listHtml = "";
      if (invites && invites.length) {
        listHtml = '<div style="border-top:1px solid var(--border);padding-top:16px">' +
          '<div style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:1px;color:var(--muted);margin-bottom:10px">Actieve invites</div>';
        invites.forEach(function(inv) {
          var base = __tunnelUrl || location.origin;
          var url = base + "/invite/" + inv.token;
          listHtml +=
            '<div style="display:flex;align-items:center;gap:10px;padding:10px 12px;margin-bottom:6px;background:var(--bg);border:1px solid var(--border);border-radius:6px">' +
            '<span style="font-weight:600;font-size:13px;color:var(--text)">' + esc(inv.name) + '</span>' +
            '<span style="font-size:12px;color:var(--muted)">' + esc(inv.projects.join(", ")) + '</span>' +
            '<span style="flex:1"></span>' +
            '<button class="config-btn config-btn-edit inv-copy" data-url="' + esc(url) + '" style="font-size:12px;padding:4px 12px">Kopieer link</button>' +
            '<button class="config-btn config-btn-close inv-del" data-token="' + esc(inv.token) + '" style="font-size:14px;padding:2px 8px">&times;</button>' +
            '</div>';
        });
        listHtml += '</div>';
      }

      modal.innerHTML = formHtml + listHtml;
    }

    function loadInvites() {
      fetch("/admin/invites").then(function(r){return r.json()}).then(function(data) {
        invites = data;
        renderInvites();
      }).catch(function() { invites = []; renderInvites(); });
    }

    document.getElementById("invite-open").addEventListener("click", function() {
      overlay.classList.add("visible");
      loadInvites();
    });

    overlay.addEventListener("click", function(e) {
      if (e.target === overlay) overlay.classList.remove("visible");
    });

    document.addEventListener("keydown", function(e) {
      if (e.key === "Escape" && overlay.classList.contains("visible")) overlay.classList.remove("visible");
    });

    document.addEventListener("click", function(e) {
      if (e.target.id === "inv-close") overlay.classList.remove("visible");

      if (e.target.id === "inv-create") {
        var name = document.getElementById("inv-name").value.trim();
        var checks = document.querySelectorAll("#inv-projects input:checked");
        var projects = [];
        checks.forEach(function(c) { projects.push(c.value); });
        if (!name || !projects.length) return;
        fetch("/admin/invite", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({name:name,projects:projects}) })
          .then(function(r){return r.json()}).then(function(d) {
            if (d.ok) {
              document.getElementById("inv-name").value = "";
              document.querySelectorAll("#inv-projects input").forEach(function(c){c.checked=false});
              loadInvites();
            }
          });
      }

      if (e.target.classList.contains("inv-copy")) {
        var url = e.target.dataset.url;
        navigator.clipboard.writeText(url).then(function() {
          e.target.textContent = "Gekopieerd!";
          setTimeout(function() { e.target.textContent = "Link"; }, 1500);
        });
      }

      if (e.target.classList.contains("inv-del")) {
        var token = e.target.dataset.token;
        fetch("/admin/invite/" + token, { method:"DELETE" })
          .then(function(r){return r.json()}).then(function(d) { if(d.ok) loadInvites(); });
      }
    });
  })();
  </script>
  <script>
  (function() {
    if (!document.getElementById("config-open")) return;
    var cache = null;
    var editing = false;
    var overlay = document.getElementById("config-overlay");
    var modal = document.getElementById("config-modal");

    function esc(s) { return String(s||"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;"); }
    function md(s) { try { return marked.parse(s||""); } catch(e) { return esc(s); } }

    function renderModal() {
      if (cache === null) {
        modal.innerHTML = '<div style="color:var(--muted);padding:12px">Laden...</div>';
        fetch("/global/claude-md").then(function(r){return r.json()}).then(function(d) {
          cache = d.content || "";
          renderModal();
        }).catch(function() { cache = ""; renderModal(); });
        return;
      }

      if (editing) {
        modal.innerHTML =
          '<div class="config-header"><h3>~/.claude/CLAUDE.md</h3><div style="display:flex;gap:8px">' +
          '<button class="config-btn config-btn-save" id="gcfg-save">Opslaan</button>' +
          '<button class="config-btn config-btn-cancel" id="gcfg-cancel">Annuleren</button>' +
          '</div></div>' +
          '<textarea id="gcfg-editor" style="width:100%;min-height:400px;background:var(--bg);color:var(--text);border:1px solid var(--border);border-radius:6px;padding:12px;font-family:monospace;font-size:13px;line-height:1.5;resize:vertical;tab-size:2">' + esc(cache) + '</textarea>';
        return;
      }

      modal.innerHTML =
        '<div class="config-header"><h3>~/.claude/CLAUDE.md</h3><div style="display:flex;gap:8px">' +
        '<button class="config-btn config-btn-edit" id="gcfg-edit">Bewerken</button>' +
        '<button class="config-btn config-btn-close" id="gcfg-close">&times;</button>' +
        '</div></div>' +
        '<div class="config-md">' + md(cache) + '</div>';
    }

    document.getElementById("config-open").addEventListener("click", function() {
      overlay.classList.add("visible");
      renderModal();
    });

    overlay.addEventListener("click", function(e) {
      if (e.target === overlay) { overlay.classList.remove("visible"); editing = false; }
    });

    document.addEventListener("keydown", function(e) {
      if (e.key === "Escape" && overlay.classList.contains("visible")) { overlay.classList.remove("visible"); editing = false; }
    });

    document.addEventListener("click", function(e) {
      if (e.target.id === "gcfg-close") { overlay.classList.remove("visible"); editing = false; }
      if (e.target.id === "gcfg-edit") { editing = true; renderModal(); }
      if (e.target.id === "gcfg-cancel") { editing = false; renderModal(); }
      if (e.target.id === "gcfg-save") {
        var ta = document.getElementById("gcfg-editor");
        if (!ta) return;
        fetch("/global/claude-md", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({content:ta.value}) })
          .then(function(r){return r.json()}).then(function(d) { if(d.ok){cache=ta.value;editing=false;renderModal()} })
          .catch(function(err){alert("Opslaan mislukt: "+err.message)});
      }
    });
  })();
  </script>
</body>
</html>`;
}

module.exports = {
  getNavBarHtml,
  serveDashboard,
  indexPage,
  esc,
};
