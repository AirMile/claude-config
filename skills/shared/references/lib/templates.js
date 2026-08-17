// HTML generation: navbar (incl. project switcher, prefs menu, global config
// editor), dashboard, escape helper

const fs = require("fs");
const path = require("path");
const {
  PROJECTS_ROOT,
  DASHBOARD_PATH,
  DASHBOARD_TEMPLATE_PATH,
} = require("./config");
const { populateFromProject } = require("./populate");
const { createDefaultDashboardData } = require("./defaults");
const { findProjects } = require("./projects");

function esc(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// Global ~/.claude/CLAUDE.md editor — shared across every page (opened from
// the preferences menu in the nav bar). Backend: GET/POST /global/claude-md.
const GLOBAL_CONFIG_CSS = `
  .config-overlay { display:none; position:fixed; inset:0; background:rgba(0,0,0,0.6); z-index:10001; justify-content:center; align-items:start; padding:48px 24px; overflow-y:auto; }
  .config-overlay.visible { display:flex; }
  .config-modal { background:var(--surface); border:1px solid var(--border); border-radius:12px; width:100%; max-width:720px; max-height:calc(100vh - 96px); overflow-y:auto; padding:24px; }
  .config-header { display:flex; align-items:center; justify-content:space-between; margin-bottom:16px; }
  .config-header h3 { font-size:16px; font-weight:600; }
  .config-btn { padding:4px 14px; border-radius:6px; font-size:13px; cursor:pointer; font-family:inherit; }
  .config-btn-edit { border:1px solid var(--border); background:none; color:var(--muted, var(--text-muted)); }
  .config-btn-edit:hover { color:var(--text); border-color:color-mix(in srgb, var(--border) 70%, var(--text-muted)); }
  .config-btn-save { border:1px solid var(--accent); background:color-mix(in srgb, var(--accent) 15%, transparent); color:var(--accent); }
  .config-btn-cancel { border:1px solid var(--border); background:none; color:var(--muted, var(--text-muted)); }
  .config-btn-close { border:1px solid var(--border); background:none; color:var(--muted, var(--text-muted)); font-size:18px; line-height:1; padding:4px 8px; }
  .config-btn-close:hover { color:var(--text); border-color:color-mix(in srgb, var(--border) 70%, var(--text-muted)); }
  .config-md { font-size:13px; line-height:1.6; color:var(--muted, var(--text-muted)); }
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
`;

const GLOBAL_CONFIG_HTML = `
<div class="config-overlay" id="config-overlay">
  <div class="config-modal" id="config-modal"></div>
</div>
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
      modal.innerHTML = '<div style="color:var(--muted);padding:12px">Loading...</div>';
      fetch("/global/claude-md").then(function(r){return r.json()}).then(function(d) {
        cache = d.content || "";
        renderModal();
      }).catch(function() { cache = ""; renderModal(); });
      return;
    }

    if (editing) {
      modal.innerHTML =
        '<div class="config-header"><h3>Global Agent Guidelines</h3><div style="display:flex;gap:8px">' +
        '<button class="config-btn config-btn-save" id="gcfg-save">Save</button>' +
        '<button class="config-btn config-btn-cancel" id="gcfg-cancel">Cancel</button>' +
        '</div></div>' +
        '<textarea id="gcfg-editor" style="width:100%;min-height:400px;background:var(--bg);color:var(--text);border:1px solid var(--border);border-radius:6px;padding:12px;font-family:monospace;font-size:13px;line-height:1.5;resize:vertical;tab-size:2">' + esc(cache) + '</textarea>';
      return;
    }

    modal.innerHTML =
      '<div class="config-header"><h3>Global Agent Guidelines</h3><div style="display:flex;gap:8px">' +
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
        .catch(function(err){alert("Save failed: "+err.message)});
    }
  });
})();
</script>`;

function getNavBarHtml(projectDir, activePage, projects) {
  const dashClass = activePage === "dashboard" ? "active" : "";
  const backlogClass = activePage === "backlog" ? "active" : "";
  const allProjects = projects || [];

  // Target view for the project switcher: keep the user on the same kind of
  // page they're currently on, falling back to whichever view the target
  // project actually has.
  const wantsBacklog = activePage === "backlog";
  const switcherItems = allProjects
    .map(function (p) {
      const isCurrent = p.dir === projectDir;
      const goBacklog = wantsBacklog
        ? p.hasBacklog
        : p.hasBacklog && !p.hasDashboard;
      const href = goBacklog ? `/${esc(p.dir)}/backlog` : `/${esc(p.dir)}`;
      return `<a href="${href}" class="pn-project-item ${isCurrent ? "current" : ""}">${esc(p.dir)}</a>`;
    })
    .join("");

  return `
<style>
  body { padding-top: 48px !important; }
  #project-nav { position:fixed; top:0; left:0; right:0; height:48px; background:var(--bg); border-bottom:1px solid var(--border); display:grid; grid-template-columns:1fr auto 1fr; align-items:center; z-index:9999; font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Helvetica,Arial,sans-serif; font-size:14px; padding:0 20px; }
  #project-nav a, #project-nav button { text-decoration:none; transition:all 0.15s; }
  .pn-left { justify-self:start; min-width:0; position:relative; }
  .pn-center { justify-self:center; }
  .pn-right { justify-self:end; position:relative; }

  .pn-project { display:inline-flex; align-items:center; gap:6px; max-width:100%; color:var(--text); background:none; border:1px solid transparent; border-radius:8px; padding:6px 10px; font-size:14px; font-weight:600; font-family:inherit; cursor:pointer; }
  .pn-project:hover, .pn-project.open { background:rgba(255,255,255,0.06); border-color:var(--border, #30363d); }
  .pn-project .pn-project-label { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
  .pn-project svg { flex-shrink:0; color:var(--text-muted, #8b949e); }

  .pn-menu { display:none; position:absolute; top:calc(100% + 6px); background:var(--surface, #161b22); border:1px solid var(--border, #30363d); border-radius:10px; box-shadow:0 8px 24px rgba(0,0,0,0.3); padding:6px; min-width:200px; max-height:60vh; overflow-y:auto; z-index:10000; }
  .pn-menu.open { display:block; }
  .pn-left .pn-menu { left:0; }
  .pn-right .pn-menu { right:0; }

  .pn-project-item { display:block; padding:8px 12px; border-radius:6px; font-size:13px; color:var(--text-muted, #8b949e); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
  .pn-project-item:hover { background:var(--surface-hover, rgba(255,255,255,0.06)); color:var(--text); }
  .pn-project-item.current { color:var(--accent, #58a6ff); font-weight:600; }

  .pn-tabs { display:flex; align-items:center; gap:2px; background:rgba(255,255,255,0.04); border:1px solid var(--border, #30363d); border-radius:10px; padding:3px; }
  .pn-tab { color:var(--text-muted, #8b949e); padding:6px 16px; border-radius:7px; font-size:13px; font-weight:500; border:1px solid transparent; }
  .pn-tab:hover { color:var(--text, #e6edf3); background:rgba(255,255,255,0.07); }
  .pn-tab.active { color:var(--accent, #58a6ff); background:color-mix(in srgb, var(--accent, #58a6ff) 18%, transparent); border-color:color-mix(in srgb, var(--accent, #58a6ff) 40%, transparent); }
  .pn-tab.active:hover { background:color-mix(in srgb, var(--accent, #58a6ff) 18%, transparent); }

  .pn-prefs-btn { display:inline-flex; align-items:center; justify-content:center; width:38px; height:38px; color:var(--text-muted, #8b949e); background:rgba(255,255,255,0.04); border:1px solid var(--border, #30363d); border-radius:10px; cursor:pointer; }
  .pn-prefs-btn:hover, .pn-prefs-btn.open { color:var(--text, #e6edf3); background:rgba(255,255,255,0.08); border-color:var(--text-dim, #6e7681); }

  .pn-prefs-menu { padding:10px; }
  .pn-prefs-section { padding:4px 2px 10px; border-bottom:1px solid var(--border, #30363d); margin-bottom:8px; }
  .pn-prefs-section:last-child { border-bottom:none; margin-bottom:0; padding-bottom:2px; }
  #pn-theme-slot .theme-picker { position:static !important; }
  #pn-theme-slot .theme-picker-dropdown { position:static !important; box-shadow:none !important; border:none !important; padding:0 !important; display:block !important; min-width:0 !important; }
  #pn-theme-slot .theme-picker-toggle { display:none !important; }

  .pn-mode-section { display:flex; align-items:center; justify-content:space-between; gap:10px; }
  .pn-mode-section:has(#pn-mode-slot:empty) { display:none; }
  .pn-mode-label { font-size:13px; color:var(--text, #e6edf3); }

  .pn-config-btn { display:block; width:100%; text-align:left; padding:8px 12px; border-radius:6px; font-size:13px; font-family:inherit; color:var(--text-muted, #8b949e); background:none; border:1px solid var(--border, #30363d); cursor:pointer; }
  .pn-config-btn:hover { color:var(--text); background:var(--surface-hover, rgba(255,255,255,0.06)); }

  ${GLOBAL_CONFIG_CSS}
</style>
<nav id="project-nav">
  <div class="pn-left">
    <button class="pn-project" id="pn-project-btn" aria-haspopup="true" aria-expanded="false">
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M1.5 3.5h5l1.5 2h6.5v7a1 1 0 0 1-1 1h-12a1 1 0 0 1-1-1v-9z"/></svg>
      <span class="pn-project-label">${esc(projectDir)}</span>
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 6l4 4 4-4"/></svg>
    </button>
    <div class="pn-menu" id="pn-project-menu">${switcherItems}</div>
  </div>
  <div class="pn-center">
    <div class="pn-tabs">
      <a href="/${esc(projectDir)}/backlog" class="pn-tab ${backlogClass}">Backlog</a>
      <a href="/${esc(projectDir)}" class="pn-tab ${dashClass}">Dashboard</a>
    </div>
  </div>
  <div class="pn-right">
    <button class="pn-prefs-btn" id="pn-prefs-btn" title="Preferences" aria-label="Preferences" aria-haspopup="true" aria-expanded="false">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
    </button>
    <div class="pn-menu" id="pn-prefs-menu">
      <div class="pn-prefs-section pn-mode-section" id="pn-mode-section">
        <span class="pn-mode-label">Team mode</span>
        <span id="pn-mode-slot"></span>
      </div>
      <div class="pn-prefs-section" id="pn-theme-slot"></div>
      <div class="pn-prefs-section">
        <button class="pn-config-btn" id="config-open">Global Agent Guidelines</button>
      </div>
    </div>
  </div>
</nav>
${GLOBAL_CONFIG_HTML}
<script>
(function() {
  function wireMenu(btnId, menuId) {
    var btn = document.getElementById(btnId);
    var menu = document.getElementById(menuId);
    if (!btn || !menu) return;
    btn.addEventListener("click", function(e) {
      e.stopPropagation();
      var willOpen = !menu.classList.contains("open");
      document.querySelectorAll("#project-nav .pn-menu.open").forEach(function(m) { m.classList.remove("open"); });
      document.querySelectorAll("#project-nav button.open").forEach(function(b) { b.classList.remove("open"); b.setAttribute("aria-expanded", "false"); });
      if (willOpen) {
        menu.classList.add("open");
        btn.classList.add("open");
        btn.setAttribute("aria-expanded", "true");
      }
    });
  }
  wireMenu("pn-project-btn", "pn-project-menu");
  wireMenu("pn-prefs-btn", "pn-prefs-menu");

  document.addEventListener("click", function(e) {
    if (e.target.closest && e.target.closest("#project-nav")) return;
    document.querySelectorAll("#project-nav .pn-menu.open").forEach(function(m) { m.classList.remove("open"); });
    document.querySelectorAll("#project-nav button.open").forEach(function(b) { b.classList.remove("open"); b.setAttribute("aria-expanded", "false"); });
  });

  document.addEventListener("keydown", function(e) {
    if (e.key !== "Escape") return;
    document.querySelectorAll("#project-nav .pn-menu.open").forEach(function(m) { m.classList.remove("open"); });
    document.querySelectorAll("#project-nav button.open").forEach(function(b) { b.classList.remove("open"); b.setAttribute("aria-expanded", "false"); });
  });
})();
</script>`;
}

function serveDashboard(projectDir) {
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
  const nav = getNavBarHtml(projectDir, "dashboard", findProjects());

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

module.exports = {
  getNavBarHtml,
  serveDashboard,
  esc,
};
