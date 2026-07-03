// Project server — serves backlogs and dashboards for all projects
// Usage: node serve-backlog.js [projects-root]
// Default: ~/projects
//
// Routes:
//   /css/{file}.css               → static CSS files
//   /js/{file}.js                 → static JS files
//   /                             → index with all projects
//   /{project}                    → dashboard (main page)
//   /{project}/save               → save dashboard (project.json)
//   /{project}/create             → create empty project.json
//   /{project}/feature/:name       → feature detail (JSON, merged: feature.json + backlog + design spec)
//   /{project}/review/:entity      → visual design review (wireframe + spec + open questions)
//   /{project}/review/:entity/data → review data (JSON: spec + reviewNotes)
//   /{project}/review/:entity/save → POST: persist reviewNotes to project.json#design
//   /{project}/asset?path=<rel>   → binary asset (whitelist: .project/snapshots|screenshots/)
//   /{project}/backlog                        → backlog kanban
//   /{project}/backlog/save                   → save backlog changes to disk
//   /{project}/backlog/create                 → create new backlog

const http = require("http");
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const {
  PROJECTS_ROOT,
  PORT,
  BACKLOG_PATH,
  DASHBOARD_PATH,
  TEMPLATE_PATH,
} = require("./lib/config");
const {
  findProjects,
  createBacklog,
  createDashboard,
  touchProject,
  readBacklogData,
  writeBacklogData,
  mergeArchivedFeatures,
  backlogExists,
  backlogMtime,
} = require("./lib/projects");
const { populateFromProject } = require("./lib/populate");
const {
  getNavBarHtml,
  serveDashboard,
  indexPage,
  esc,
} = require("./lib/templates");
const buildBacklogPatch = require("./lib/backlog-patches");

// ── Worktree helpers ──

const worktreeCache = {};
const WORKTREE_CACHE_TTL = 30000;

function parseWorktreeListPorcelain(output) {
  const entries = [];
  let current = null;
  for (const line of output.split("\n")) {
    if (line.startsWith("worktree ")) {
      if (current) entries.push(current);
      current = { path: line.slice(9).trim() };
    } else if (line.startsWith("branch ")) {
      if (current)
        current.branch = line.slice(7).trim().replace("refs/heads/", "");
    } else if (line === "") {
      if (current) {
        entries.push(current);
        current = null;
      }
    }
  }
  if (current) entries.push(current);
  return entries;
}

function getOpenWorktrees(projectRoot, forceRefresh) {
  const now = Date.now();
  if (
    !forceRefresh &&
    worktreeCache[projectRoot] &&
    now - worktreeCache[projectRoot].ts < WORKTREE_CACHE_TTL
  ) {
    return worktreeCache[projectRoot].data;
  }
  try {
    const raw = execSync("git worktree list --porcelain", {
      cwd: projectRoot,
      encoding: "utf8",
      timeout: 5000,
    });
    const all = parseWorktreeListPorcelain(raw);
    const secondary = all.slice(1); // skip main checkout

    let mainBranch = "main";
    try {
      const branches = execSync("git branch -a", {
        cwd: projectRoot,
        encoding: "utf8",
        timeout: 3000,
      });
      const m = branches.match(
        /^[* ]+(?:remotes\/origin\/)?(main|master|develop|staging)$/m,
      );
      if (m) mainBranch = m[1];
    } catch {}

    const worktrees = secondary
      .filter((w) => w.branch && w.branch.startsWith("worktree-"))
      .map((w) => {
        const feature = w.branch.replace(/^worktree-/, "");

        let ahead = 0;
        try {
          ahead =
            parseInt(
              execSync(`git rev-list --count ${mainBranch}..${w.branch}`, {
                cwd: projectRoot,
                encoding: "utf8",
                timeout: 3000,
              }).trim(),
              10,
            ) || 0;
        } catch {}

        let dirty = false;
        try {
          dirty =
            execSync("git status --porcelain", {
              cwd: w.path,
              encoding: "utf8",
              timeout: 3000,
            }).trim().length > 0;
        } catch {}

        let lastCommitAt = null;
        try {
          lastCommitAt = execSync(`git log -1 --format=%cI ${w.branch}`, {
            cwd: projectRoot,
            encoding: "utf8",
            timeout: 3000,
          }).trim();
        } catch {}

        let prState = null;
        let prUrl = null;
        let prNumber = null;
        try {
          const prRaw = execSync(
            `gh pr list --head "${w.branch}" --state all --json number,url,state --limit 1`,
            { cwd: projectRoot, encoding: "utf8", timeout: 8000 },
          );
          const prData = JSON.parse(prRaw);
          if (prData.length > 0) {
            prState = prData[0].state;
            prUrl = prData[0].url;
            prNumber = prData[0].number;
          }
        } catch {}

        return {
          feature,
          branch: w.branch,
          path: w.path,
          ahead,
          dirty,
          lastCommitAt,
          prState,
          prUrl,
          prNumber,
        };
      });

    worktreeCache[projectRoot] = { ts: now, data: worktrees };
    return worktrees;
  } catch {
    return [];
  }
}

function getMainState(projectRoot) {
  let dirty = false;
  let behindOrigin = 0;
  try {
    dirty =
      execSync("git status --porcelain", {
        cwd: projectRoot,
        encoding: "utf8",
        timeout: 3000,
      }).trim().length > 0;
  } catch {}
  try {
    behindOrigin =
      parseInt(
        execSync("git rev-list --count HEAD..@{u}", {
          cwd: projectRoot,
          encoding: "utf8",
          timeout: 3000,
        }).trim(),
        10,
      ) || 0;
  } catch {}
  return { dirty, behindOrigin };
}

// ── Design review helper ──
// Builds the data block for the visual review route: locates a PAGE/COMPONENT
// in project.json#design by name and returns its spec + user-owned reviewNotes.
function buildReviewData(projectPath, projectDir, entity) {
  const dashFile = path.join(projectPath, DASHBOARD_PATH);
  let proj = {};
  try {
    proj = JSON.parse(fs.readFileSync(dashFile, "utf8"));
  } catch {}
  const design = proj.design || {};
  let type = null;
  let spec = null;
  const page = (design.pages || []).find((p) => p.name === entity);
  if (page) {
    type = "PAGE";
    spec = page;
  } else {
    const comp = (design.components || []).find((c) => c.name === entity);
    if (comp) {
      type = "COMPONENT";
      spec = comp;
    }
  }
  return {
    project: proj.name || projectDir,
    projectDir,
    entity,
    type,
    spec,
    reviewNotes: (spec && spec.reviewNotes) || [],
  };
}

// Theme head injection (for existing backlogs that lack the theme tags)
const themeHeadTags =
  '<meta name="color-scheme" content="dark light" />' +
  '<script src="/lib/themes.js"></script>' +
  '<link rel="stylesheet" href="/css/theme-picker.css" />';

http
  .createServer(function (req, res) {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
    res.setHeader("Pragma", "no-cache");

    if (req.method === "OPTIONS") {
      res.writeHead(204);
      return res.end();
    }

    const url = new URL(req.url, "http://localhost:" + PORT);
    const parts = url.pathname.split("/").filter(Boolean);

    // Health endpoint — lets project-viewer detect a server bound to a stale root
    if (req.method === "GET" && url.pathname === "/__root") {
      res.writeHead(200, {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
      });
      res.end(JSON.stringify({ root: PROJECTS_ROOT }));
      return;
    }

    // ── Static files ──

    // Favicon SVG (top-level static)
    const faviconMatch = url.pathname.match(/^\/(favicon-[\w-]+\.svg)$/);
    if (req.method === "GET" && faviconMatch) {
      const file = path.join(__dirname, faviconMatch[1]);
      if (fs.existsSync(file)) {
        res.writeHead(200, {
          "Content-Type": "image/svg+xml",
          "Cache-Control": "no-cache",
        });
        res.end(fs.readFileSync(file, "utf8"));
        return;
      }
    }

    // Static CSS and JS files
    const staticMatch = url.pathname.match(
      /^\/(css|js|lib)\/([\w-]+\.(css|js))$/,
    );
    if (req.method === "GET" && staticMatch) {
      const subdir = staticMatch[1];
      const filename = staticMatch[2];
      const contentTypes = {
        css: "text/css; charset=utf-8",
        js: "text/javascript; charset=utf-8",
        lib: "text/javascript; charset=utf-8",
      };
      const staticFile = path.join(__dirname, subdir, filename);
      if (fs.existsSync(staticFile)) {
        res.writeHead(200, {
          "Content-Type": contentTypes[subdir],
          "Cache-Control": "no-cache",
        });
        res.end(fs.readFileSync(staticFile, "utf8"));
        return;
      }
    }

    // Prototype HTML files
    const protoMatch = url.pathname.match(/^\/prototypes\/([\w-]+\.html)$/);
    if (req.method === "GET" && protoMatch) {
      const protoFile = path.join(__dirname, "prototypes", protoMatch[1]);
      if (fs.existsSync(protoFile)) {
        res.writeHead(200, {
          "Content-Type": "text/html; charset=utf-8",
          "Cache-Control": "no-cache",
        });
        res.end(fs.readFileSync(protoFile, "utf8"));
        return;
      }
    }

    // Index
    if (req.method === "GET" && parts.length === 0) {
      var projects = findProjects();
      res.writeHead(200, {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-cache, no-store",
      });
      res.end(indexPage(projects));
      return;
    }

    // Global CLAUDE.md (read/write)
    if (
      parts[0] === "global" &&
      parts[1] === "claude-md" &&
      parts.length === 2
    ) {
      const globalPath = path.join(
        require("os").homedir(),
        ".claude/CLAUDE.md",
      );

      if (req.method === "GET") {
        let content = "";
        if (fs.existsSync(globalPath)) {
          try {
            content = fs.readFileSync(globalPath, "utf8");
          } catch {}
        }
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ content }));
        return;
      }

      if (req.method === "POST") {
        let body = "";
        req.on("data", (chunk) => (body += chunk));
        req.on("end", () => {
          try {
            const { content } = JSON.parse(body);
            fs.writeFileSync(globalPath, content, "utf8");
            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ ok: true }));
          } catch (err) {
            res.writeHead(500, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: err.message }));
          }
        });
        return;
      }
    }

    // Project routes:
    //   /{project}              → dashboard (main page)
    //   /{project}/save         → save dashboard (project.json)
    //   /{project}/create       → create dashboard
    //   /{project}/data         → dashboard JSON (API)
    //   /{project}/events       → SSE file-change stream
    //   /{project}/backlog      → backlog kanban
    //   /{project}/backlog/save → save backlog
    //   /{project}/backlog/create → create backlog
    //   /{project}/backlog/data → backlog JSON (API)
    if (parts.length >= 1) {
      const projectDir = parts[0];

      // Security: no path traversal
      if (projectDir.includes("..")) {
        res.writeHead(400);
        res.end("Invalid path");
        return;
      }

      const projectPath = path.join(PROJECTS_ROOT, projectDir);
      if (!fs.existsSync(projectPath)) {
        res.writeHead(404);
        res.end("Project not found: " + esc(projectDir));
        return;
      }

      // ── SSE: push file-change events to browser ──
      if (req.method === "GET" && parts[1] === "events" && parts.length === 2) {
        res.writeHead(200, {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
        });
        res.write("data: connected\n\n");

        const dashFile = path.join(projectPath, DASHBOARD_PATH);
        const sessionDir = path.join(projectPath, ".project/session");
        var lastBacklogMtime = 0;
        var lastDashMtime = 0;
        var lastSessionMtime = 0;

        // Dir mtime alone misses in-place rewrites of active-*.json
        // (skills update the same file per phase) — include file mtimes.
        function sessionMtime() {
          if (!fs.existsSync(sessionDir)) return 0;
          var m = fs.statSync(sessionDir).mtimeMs;
          fs.readdirSync(sessionDir).forEach(function (f) {
            if (!f.startsWith("active-") || !f.endsWith(".json")) return;
            try {
              var fm = fs.statSync(path.join(sessionDir, f)).mtimeMs;
              if (fm > m) m = fm;
            } catch {}
          });
          return m;
        }

        try {
          lastBacklogMtime = backlogMtime(projectPath);
        } catch {}
        try {
          lastDashMtime = fs.existsSync(dashFile)
            ? fs.statSync(dashFile).mtimeMs
            : 0;
        } catch {}
        try {
          lastSessionMtime = sessionMtime();
        } catch {}

        const poll = setInterval(function () {
          try {
            const bm = backlogMtime(projectPath);
            const dm = fs.existsSync(dashFile)
              ? fs.statSync(dashFile).mtimeMs
              : 0;
            const am = sessionMtime();
            if (bm !== lastBacklogMtime) {
              lastBacklogMtime = bm;
              res.write("data: backlog\n\n");
            }
            if (dm !== lastDashMtime) {
              lastDashMtime = dm;
              res.write("data: dashboard\n\n");
            }
            if (am !== lastSessionMtime) {
              lastSessionMtime = am;
              res.write("data: session\n\n");
            }
          } catch {}
        }, 1000);

        req.on("close", function () {
          clearInterval(poll);
        });
        return;
      }

      // ── Session active API ──
      if (
        req.method === "GET" &&
        parts[1] === "session" &&
        parts.length === 2
      ) {
        const sessionDir = path.join(projectPath, ".project/session");
        var active = [];
        try {
          if (fs.existsSync(sessionDir)) {
            var now = Date.now();
            fs.readdirSync(sessionDir).forEach(function (f) {
              if (!f.startsWith("active-") || !f.endsWith(".json")) return;
              try {
                var entry = JSON.parse(
                  fs.readFileSync(path.join(sessionDir, f), "utf8"),
                );
                // Skip stale entries (older than 2 hours)
                if (
                  entry.startedAt &&
                  now - new Date(entry.startedAt).getTime() > 7200000
                )
                  return;
                active.push(entry);
              } catch {}
            });
          }
        } catch {}
        res.writeHead(200, {
          "Content-Type": "application/json",
          "Cache-Control": "no-cache",
        });
        res.end(JSON.stringify(active));
        return;
      }

      // ── Backlog data API ──
      if (
        req.method === "GET" &&
        parts[1] === "backlog" &&
        parts[2] === "data" &&
        parts.length === 3
      ) {
        const data = readBacklogData(projectPath);
        if (data) {
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify(data, null, 2));
        } else {
          res.writeHead(404);
          res.end("{}");
        }
        return;
      }

      // ── Dashboard data API ──
      if (req.method === "GET" && parts[1] === "data" && parts.length === 2) {
        const dashFile = path.join(projectPath, DASHBOARD_PATH);
        try {
          var dashData = JSON.parse(fs.readFileSync(dashFile, "utf8"));
          dashData = populateFromProject(projectDir, dashData);
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify(dashData));
        } catch {
          res.writeHead(404);
          res.end("{}");
        }
        return;
      }

      // ── Backlog routes: /{project}/backlog/* ──

      // Create backlog — admin only
      if (
        req.method === "POST" &&
        parts[1] === "backlog" &&
        parts[2] === "create"
      ) {
        if (!backlogExists(projectPath)) {
          try {
            createBacklog(projectDir);
          } catch (e) {
            res.writeHead(500);
            res.end("Create error: " + e.message);
            return;
          }
        }
        res.writeHead(302, { Location: "/" + projectDir + "/backlog" });
        res.end();
        return;
      }

      // Serve backlog — data persists in .project/backlog.json, layout always from template
      if (
        req.method === "GET" &&
        parts[1] === "backlog" &&
        parts.length === 2
      ) {
        touchProject(projectDir);

        // Read data from the store (backlog.json, legacy backlog.html fallback)
        var backlogDataObj = readBacklogData(projectPath);

        // If no existing store, create one to initialize the data store
        if (!backlogDataObj) {
          try {
            createBacklog(projectDir);
            backlogDataObj = readBacklogData(projectPath);
          } catch (e) {
            res.writeHead(500);
            res.end("Create error: " + e.message);
            return;
          }
        }
        // Merge shipped dev-track features back from the archive so the board
        // can resolve dependencies on them (a "blocked by X" tag must clear
        // once X ships). Shipped items are filtered out of the rendered
        // columns client-side, so this never adds stray cards.
        if (backlogDataObj && Array.isArray(backlogDataObj.features)) {
          backlogDataObj.features = mergeArchivedFeatures(
            projectPath,
            backlogDataObj.features,
          );
        }
        var backlogData = backlogDataObj
          ? JSON.stringify(backlogDataObj, null, 2)
          : null;

        try {
          var html = fs.readFileSync(TEMPLATE_PATH, "utf8");
          if (backlogData) {
            // Enrich backlog data with project name/overview from project.json if missing
            try {
              var parsedData = JSON.parse(backlogData);
              if (!parsedData.project || !parsedData.overview) {
                var projFile = path.join(
                  PROJECTS_ROOT,
                  projectDir,
                  DASHBOARD_PATH,
                );
                if (fs.existsSync(projFile)) {
                  var projJson = JSON.parse(fs.readFileSync(projFile, "utf8"));
                  if (!parsedData.project)
                    parsedData.project = projJson.name || projectDir;
                  if (!parsedData.overview)
                    parsedData.overview =
                      projJson.subtitle || projJson.seed?.pitch || "";
                } else if (!parsedData.project) {
                  parsedData.project = projectDir;
                }
                backlogData = JSON.stringify(parsedData, null, 2);
              }
            } catch {}
            // Inject live worktree state (best-effort, never blocks render)
            try {
              if (!parsedData) parsedData = JSON.parse(backlogData);
              const forceRefresh = url.searchParams.get("refresh") === "1";
              const projectRoot = path.join(PROJECTS_ROOT, projectDir);
              parsedData.worktrees = getOpenWorktrees(
                projectRoot,
                forceRefresh,
              );
              parsedData.mainState = getMainState(projectRoot);
              backlogData = JSON.stringify(parsedData, null, 2);
            } catch {}
            var startTag = '<script id="backlog-data" type="application/json">';
            var startIdx = html.indexOf(startTag) + startTag.length;
            var endIdx = html.indexOf("</script>", startIdx);
            html =
              html.substring(0, startIdx) +
              "\n" +
              backlogData +
              "\n" +
              html.substring(endIdx);
          }
          const nav = getNavBarHtml(projectDir, "backlog");
          const projectRoot = path.join(PROJECTS_ROOT, projectDir);
          const rootScript = `<script>window.__projectRoot=${JSON.stringify(projectRoot)};</script>`;
          html = html.replace(
            "</body>",
            rootScript + buildBacklogPatch() + nav + "</body>",
          );
          res.writeHead(200, {
            "Content-Type": "text/html; charset=utf-8",
            "Cache-Control": "no-cache, no-store",
          });
          res.end(html);
        } catch (e) {
          res.writeHead(500);
          res.end("Read error: " + e.message);
        }
        return;
      }

      // Save backlog
      if (
        req.method === "POST" &&
        parts[1] === "backlog" &&
        parts[2] === "save"
      ) {
        var body = "";
        req.on("data", function (chunk) {
          body += chunk;
        });
        req.on("end", function () {
          try {
            const jsonData = JSON.parse(body);
            // Defensive fallback: client (backlog-template.html → syncJSON) already strips
            // these before POSTing. This guard catches direct API calls or older clients.
            delete jsonData.worktrees;
            delete jsonData.mainState;
            writeBacklogData(projectPath, jsonData);
            res.writeHead(200, { "Content-Type": "application/json" });
            res.end('{"ok":true}');
          } catch (e) {
            res.writeHead(500, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: e.message }));
          }
        });
        return;
      }

      // ── Dashboard routes: /{project} (main page) ──

      // Create dashboard — admin only
      if (
        req.method === "POST" &&
        parts[1] === "create" &&
        parts.length === 2
      ) {
        const dashFile = path.join(projectPath, DASHBOARD_PATH);
        if (!fs.existsSync(dashFile)) {
          try {
            createDashboard(projectDir);
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

      // Save dashboard
      if (req.method === "POST" && parts[1] === "save" && parts.length === 2) {
        var body = "";
        req.on("data", function (chunk) {
          body += chunk;
        });
        req.on("end", function () {
          try {
            const jsonData = JSON.parse(body);

            // Split seed.content to .md file if seedFile is set
            const seedMdName = jsonData.seed?.seedFile;
            if (jsonData.seed && seedMdName) {
              const seedMdPath = path.join(projectPath, ".project", seedMdName);
              if (jsonData.seed.content) {
                const seedDir = path.join(projectPath, ".project");
                if (!fs.existsSync(seedDir))
                  fs.mkdirSync(seedDir, { recursive: true });
                fs.writeFileSync(seedMdPath, jsonData.seed.content, "utf8");
                // Keep only metadata in project.json
                delete jsonData.seed.content;
              }
            }

            // Strip derived fields — features come from the backlog store and
            // are injected in-memory by populate.js; never persist them here.
            delete jsonData.features;

            // Split architecture + context + learnings to project-context.json
            const contextFields = ["architecture", "context", "learnings"];
            const contextData = {};
            var hasContextFields = false;
            for (const field of contextFields) {
              if (jsonData[field]) {
                contextData[field] = jsonData[field];
                delete jsonData[field];
                hasContextFields = true;
              }
            }
            if (hasContextFields) {
              const ctxPath = path.join(
                projectPath,
                ".project/project-context.json",
              );
              var existingCtx = {};
              try {
                existingCtx = JSON.parse(fs.readFileSync(ctxPath, "utf8"));
              } catch {}
              Object.assign(existingCtx, contextData);
              const ctxDir = path.join(projectPath, ".project");
              if (!fs.existsSync(ctxDir))
                fs.mkdirSync(ctxDir, { recursive: true });
              fs.writeFileSync(
                ctxPath,
                JSON.stringify(existingCtx, null, 2),
                "utf8",
              );
            }

            const dashFile = path.join(projectPath, DASHBOARD_PATH);
            const wsDir = path.dirname(dashFile);
            if (!fs.existsSync(wsDir)) fs.mkdirSync(wsDir, { recursive: true });
            fs.writeFileSync(
              dashFile,
              JSON.stringify(jsonData, null, 2),
              "utf8",
            );
            res.writeHead(200, { "Content-Type": "application/json" });
            res.end('{"ok":true}');
          } catch (e) {
            res.writeHead(500, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: e.message }));
          }
        });
        return;
      }

      // Settings: team-mode toggle (solo/team) — patches project.json#team.mode
      if (
        req.method === "POST" &&
        parts[1] === "settings" &&
        parts[2] === "team-mode" &&
        parts.length === 3
      ) {
        var body = "";
        req.on("data", function (chunk) {
          body += chunk;
        });
        req.on("end", function () {
          try {
            const parsed = JSON.parse(body);
            const mode = parsed && parsed.mode;
            if (mode !== "solo" && mode !== "team") {
              res.writeHead(400, { "Content-Type": "application/json" });
              res.end(
                JSON.stringify({
                  error: 'mode must be "solo" or "team"',
                }),
              );
              return;
            }
            const dashFile = path.join(projectPath, DASHBOARD_PATH);
            var jsonData = {};
            try {
              jsonData = JSON.parse(fs.readFileSync(dashFile, "utf8"));
            } catch {
              jsonData = {};
            }
            if (!jsonData.team || typeof jsonData.team !== "object") {
              jsonData.team = {};
            }
            jsonData.team.mode = mode;
            const wsDir = path.dirname(dashFile);
            if (!fs.existsSync(wsDir)) fs.mkdirSync(wsDir, { recursive: true });
            fs.writeFileSync(
              dashFile,
              JSON.stringify(jsonData, null, 2),
              "utf8",
            );
            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ ok: true, mode: mode }));
          } catch (e) {
            res.writeHead(500, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: e.message }));
          }
        });
        return;
      }

      // Research files (stack-baseline.md, architecture-baseline.md)
      if (
        req.method === "GET" &&
        parts[1] === "research" &&
        parts.length === 2
      ) {
        const researchDir = path.join(projectPath, ".claude/research");
        const result = {};

        const files = [
          ["stack", "stack-baseline.md"],
          ["architecture", "architecture-baseline.md"],
        ];

        for (const [key, filename] of files) {
          const filePath = path.join(researchDir, filename);
          if (fs.existsSync(filePath)) {
            try {
              result[key] = fs.readFileSync(filePath, "utf8");
            } catch {}
          }
        }

        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify(result));
        return;
      }

      // CLAUDE.md (read/write)
      if (parts[1] === "claude-md" && parts.length === 2) {
        const claudePath = path.join(projectPath, "CLAUDE.md");

        if (req.method === "GET") {
          let content = "";
          if (fs.existsSync(claudePath)) {
            try {
              content = fs.readFileSync(claudePath, "utf8");
            } catch {}
          }
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ content }));
          return;
        }

        if (req.method === "POST") {
          let body = "";
          req.on("data", (chunk) => (body += chunk));
          req.on("end", () => {
            try {
              const { content } = JSON.parse(body);
              const dir = path.dirname(claudePath);
              if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
              fs.writeFileSync(claudePath, content, "utf8");
              res.writeHead(200, { "Content-Type": "application/json" });
              res.end(JSON.stringify({ ok: true }));
            } catch (err) {
              res.writeHead(500, { "Content-Type": "application/json" });
              res.end(JSON.stringify({ error: err.message }));
            }
          });
          return;
        }
      }

      // Feature detail (feature.json) — merged with backlog metadata + design spec
      if (
        req.method === "GET" &&
        parts[1] === "feature" &&
        parts[2] &&
        parts.length === 3
      ) {
        const featureName = parts[2];

        if (featureName.includes("..")) {
          res.writeHead(400);
          res.end("Invalid path");
          return;
        }

        // Read feature.json (optional — Path A design cards may not have it).
        // Live path first; fall back to archive (dev-ship's refactor phase moves shipped
        // features to .project/features/archive/{shippedAt-date}-{name}/feature.json).
        const featuresDir = path.join(projectPath, ".project/features");
        let featureJson = path.join(featuresDir, featureName, "feature.json");
        if (!fs.existsSync(featureJson)) {
          const archiveDir = path.join(featuresDir, "archive");
          if (fs.existsSync(archiveDir)) {
            try {
              const suffix = "-" + featureName;
              const match = fs
                .readdirSync(archiveDir)
                .find((d) => d.endsWith(suffix));
              if (match) {
                featureJson = path.join(archiveDir, match, "feature.json");
              }
            } catch {}
          }
        }
        let result = null;
        if (fs.existsSync(featureJson)) {
          try {
            result = JSON.parse(fs.readFileSync(featureJson, "utf8"));
          } catch {
            result = { name: featureName };
          }
        }

        // Merge backlog metadata (type, status, phase, audit.*)
        {
          try {
            const backlogData = readBacklogData(projectPath);
            if (backlogData) {
              const f = (backlogData.features || []).find(
                (x) => x.name === featureName,
              );
              if (f) {
                if (!result) result = { name: featureName };
                if (!result.type) result.type = f.type;
                if (!result.status) result.status = f.status;
                if (!result.phase) result.phase = f.phase;
                if (!result.description) result.description = f.description;
                result.shipped = f.shipped;
                if (f.shippedAt) result.shippedAt = f.shippedAt;
                if (f.shippedSha) result.shippedSha = f.shippedSha;
                if (f.audit)
                  result.audit = { ...f.audit, ...(result.audit || {}) };
              }
            }
          } catch {}
        }

        // Merge design spec for PAGE/COMPONENT
        if (result && (result.type === "PAGE" || result.type === "COMPONENT")) {
          const dashFile = path.join(projectPath, DASHBOARD_PATH);
          if (fs.existsSync(dashFile)) {
            try {
              const proj = JSON.parse(fs.readFileSync(dashFile, "utf8"));
              const designKey = result.type === "PAGE" ? "pages" : "components";
              const specList = (proj.design || {})[designKey];
              if (Array.isArray(specList)) {
                const spec = specList.find((x) => x.name === featureName);
                if (spec) result.design = spec;
              }
            } catch {}
          }
          // Demo-page link for atomic/section COMPONENTs
          if (result.type === "COMPONENT") {
            const scope = result.design && result.design.scope;
            if (scope === "atomic" || scope === "section") {
              const demoRel = `app/_dev/components/${featureName}/page.tsx`;
              if (fs.existsSync(path.join(projectPath, demoRel))) {
                result.demoPath = demoRel;
              }
            }
          }
        }

        if (!result) {
          res.writeHead(404, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Feature not found" }));
          return;
        }

        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify(result, null, 2));
        return;
      }

      // ── Design review routes: /{project}/review/{entity}[/data|/save] ──

      // Review data API: GET /{project}/review/{entity}/data
      if (
        req.method === "GET" &&
        parts[1] === "review" &&
        parts[2] &&
        parts[3] === "data" &&
        parts.length === 4
      ) {
        const entity = decodeURIComponent(parts[2]);
        if (entity.includes("..")) {
          res.writeHead(400);
          res.end("Invalid path");
          return;
        }
        res.writeHead(200, {
          "Content-Type": "application/json",
          "Cache-Control": "no-cache",
        });
        res.end(
          JSON.stringify(buildReviewData(projectPath, projectDir, entity)),
        );
        return;
      }

      // Save review notes: POST /{project}/review/{entity}/save
      if (
        req.method === "POST" &&
        parts[1] === "review" &&
        parts[2] &&
        parts[3] === "save" &&
        parts.length === 4
      ) {
        const entity = decodeURIComponent(parts[2]);
        if (entity.includes("..")) {
          res.writeHead(400);
          res.end("Invalid path");
          return;
        }
        var body = "";
        req.on("data", function (chunk) {
          body += chunk;
        });
        req.on("end", function () {
          try {
            const parsed = JSON.parse(body);
            const reviewNotes = Array.isArray(parsed.reviewNotes)
              ? parsed.reviewNotes
              : [];
            const dashFile = path.join(projectPath, DASHBOARD_PATH);
            var proj;
            try {
              proj = JSON.parse(fs.readFileSync(dashFile, "utf8"));
            } catch {
              res.writeHead(404, { "Content-Type": "application/json" });
              res.end(JSON.stringify({ error: "project.json not found" }));
              return;
            }
            proj.design = proj.design || {};
            const target =
              (proj.design.pages || []).find((p) => p.name === entity) ||
              (proj.design.components || []).find((c) => c.name === entity);
            if (!target) {
              res.writeHead(404, { "Content-Type": "application/json" });
              res.end(
                JSON.stringify({ error: "Entity not found in design spec" }),
              );
              return;
            }
            // reviewNotes is user-owned and additive — design-create merges
            // never touch it, so writing here is safe.
            target.reviewNotes = reviewNotes;
            fs.writeFileSync(dashFile, JSON.stringify(proj, null, 2), "utf8");
            res.writeHead(200, { "Content-Type": "application/json" });
            res.end('{"ok":true}');
          } catch (e) {
            res.writeHead(500, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: e.message }));
          }
        });
        return;
      }

      // Serve review page: GET /{project}/review/{entity}
      if (
        req.method === "GET" &&
        parts[1] === "review" &&
        parts[2] &&
        parts.length === 3
      ) {
        const entity = decodeURIComponent(parts[2]);
        if (entity.includes("..")) {
          res.writeHead(400);
          res.end("Invalid path");
          return;
        }
        const reviewTemplatePath = path.join(__dirname, "review-template.html");
        if (!fs.existsSync(reviewTemplatePath)) {
          res.writeHead(500);
          res.end("Review template not found: " + reviewTemplatePath);
          return;
        }
        try {
          const reviewData = buildReviewData(projectPath, projectDir, entity);
          var html = fs.readFileSync(reviewTemplatePath, "utf8");
          var startTag = '<script id="review-data" type="application/json">';
          var startIdx = html.indexOf(startTag) + startTag.length;
          var endIdx = html.indexOf("</script>", startIdx);
          html =
            html.substring(0, startIdx) +
            "\n" +
            JSON.stringify(reviewData, null, 2) +
            "\n" +
            html.substring(endIdx);
          const nav = getNavBarHtml(projectDir, "review");
          html = html.replace("</body>", nav + "</body>");
          res.writeHead(200, {
            "Content-Type": "text/html; charset=utf-8",
            "Cache-Control": "no-cache, no-store",
          });
          res.end(html);
        } catch (e) {
          res.writeHead(500);
          res.end("Review error: " + e.message);
        }
        return;
      }

      // Static asset endpoint: GET /{project}/asset?path=<rel>
      // Whitelist: .project/snapshots/* and .project/screenshots/*
      if (req.method === "GET" && parts[1] === "asset" && parts.length === 2) {
        const assetUrl = new URL(req.url, "http://localhost");
        const rel = assetUrl.searchParams.get("path");
        if (!rel || rel.includes("..")) {
          res.writeHead(400);
          res.end("Invalid path");
          return;
        }
        if (!/^\.project\/(snapshots|screenshots)\//.test(rel)) {
          res.writeHead(403);
          res.end("Path not allowed");
          return;
        }
        const absAsset = path.join(projectPath, rel);
        if (!fs.existsSync(absAsset)) {
          res.writeHead(404);
          res.end("Not found");
          return;
        }
        const ext = path.extname(absAsset).toLowerCase();
        const mime = {
          ".png": "image/png",
          ".jpg": "image/jpeg",
          ".jpeg": "image/jpeg",
          ".webp": "image/webp",
          ".svg": "image/svg+xml",
        }[ext];
        if (!mime) {
          res.writeHead(415);
          res.end("Invalid type");
          return;
        }
        res.writeHead(200, {
          "Content-Type": mime,
          "Cache-Control": "max-age=300",
        });
        res.end(fs.readFileSync(absAsset));
        return;
      }

      // File snippet endpoint: GET /{project}/file?path=<rel>&from=<n>&to=<m>
      if (req.method === "GET" && parts[1] === "file" && parts.length === 2) {
        var fileUrl = new URL(req.url, "http://localhost");
        var relPath = fileUrl.searchParams.get("path");
        var fromLine = parseInt(fileUrl.searchParams.get("from"), 10) || null;
        var toLine = parseInt(fileUrl.searchParams.get("to"), 10) || null;

        if (!relPath) {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "path parameter required" }));
          return;
        }

        // Security: prevent path traversal
        var resolvedPath = path.resolve(projectPath, relPath);
        var projectSep = projectPath.endsWith(path.sep)
          ? projectPath
          : projectPath + path.sep;
        if (
          !resolvedPath.startsWith(projectSep) &&
          resolvedPath !== projectPath
        ) {
          res.writeHead(403, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Access denied" }));
          return;
        }

        // Extension allowlist — no binaries
        var ALLOWED_EXTS = [
          ".ts",
          ".tsx",
          ".js",
          ".jsx",
          ".mjs",
          ".cjs",
          ".gd",
          ".py",
          ".rb",
          ".go",
          ".rs",
          ".css",
          ".scss",
          ".sass",
          ".less",
          ".html",
          ".json",
          ".md",
          ".txt",
          ".yaml",
          ".yml",
          ".toml",
          ".env.example",
        ];
        var fileExt = path.extname(resolvedPath).toLowerCase();
        if (!ALLOWED_EXTS.includes(fileExt)) {
          res.writeHead(403, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "File type not allowed" }));
          return;
        }

        if (!fs.existsSync(resolvedPath)) {
          res.writeHead(404, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "File not found" }));
          return;
        }

        try {
          var fileContent = fs.readFileSync(resolvedPath, "utf8");
          var lines = fileContent.split("\n");
          var totalLines = lines.length;

          var fromIdx = fromLine ? Math.max(1, fromLine) : 1;
          var toIdx = toLine ? Math.min(totalLines, toLine) : totalLines;
          var excerpt = lines.slice(fromIdx - 1, toIdx).join("\n");

          // Get git blob sha for drift detection
          var sha = null;
          try {
            var cp = require("child_process");
            sha = cp
              .execSync(
                'git -C "' +
                  projectPath +
                  '" hash-object "' +
                  resolvedPath +
                  '"',
                { timeout: 2000 },
              )
              .toString()
              .trim();
          } catch (_) {}

          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(
            JSON.stringify({
              path: relPath,
              from: fromIdx,
              to: toIdx,
              content: excerpt,
              totalLines,
              sha,
            }),
          );
        } catch (err) {
          res.writeHead(500, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: err.message }));
        }
        return;
      }

      // Open file in VS Code
      if (req.method === "POST" && parts[1] === "open" && parts.length >= 3) {
        const relPath = parts.slice(2).join("/");
        if (relPath.includes("..")) {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Invalid path" }));
          return;
        }
        const filePath = path.join(projectPath, relPath);
        if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
          res.writeHead(404, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "File not found" }));
          return;
        }
        try {
          const { execSync } = require("child_process");
          const candidates = [];

          // 1. Linux/Codespaces remote-CLI
          try {
            const cli = execSync(
              "ls -t /home/claude/.vscode-server/cli/servers/*/server/bin/remote-cli/code 2>/dev/null | head -1",
              { encoding: "utf8" },
            ).trim();
            const sock = execSync(
              "ls -t /run/user/$(id -u)/vscode-ipc-*.sock 2>/dev/null | head -1",
              { encoding: "utf8" },
            ).trim();
            if (cli && sock)
              candidates.push({ cli, env: { VSCODE_IPC_HOOK_CLI: sock } });
          } catch {}

          // 2. macOS bundle
          if (process.platform === "darwin") {
            for (const p of [
              "/Applications/Visual Studio Code.app/Contents/Resources/app/bin/code",
              "/Applications/Visual Studio Code - Insiders.app/Contents/Resources/app/bin/code",
            ]) {
              if (fs.existsSync(p)) candidates.push({ cli: p, env: {} });
            }
          }

          // 3. PATH fallback
          try {
            const onPath = execSync("command -v code 2>/dev/null", {
              encoding: "utf8",
            }).trim();
            if (onPath) candidates.push({ cli: onPath, env: {} });
          } catch {}

          if (!candidates.length) {
            res.writeHead(500, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: "VS Code CLI not found" }));
            return;
          }

          const { cli, env } = candidates[0];
          execSync(`"${cli}" "${projectPath}" --goto "${filePath}"`, {
            timeout: 5000,
            env: { ...process.env, ...env },
          });
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ ok: true, file: relPath }));
        } catch (e) {
          res.writeHead(500, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: e.message }));
        }
        return;
      }

      // Diff preview for a file
      if (req.method === "GET" && parts[1] === "diff" && parts.length >= 3) {
        const relPath = parts.slice(2).join("/");
        if (relPath.includes("..")) {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Invalid path" }));
          return;
        }
        const isGit = fs.existsSync(path.join(projectPath, ".git"));
        if (!isGit) {
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ ok: true, git: false }));
          return;
        }
        try {
          const { execSync } = require("child_process");
          const run = (cmd) =>
            execSync(cmd, {
              cwd: projectPath,
              encoding: "utf8",
              maxBuffer: 5 * 1024 * 1024,
            }).trim();
          const working = run(`git diff --no-color HEAD -- "${relPath}"`);
          const recent = run(
            `git log -n 3 -p --no-color --follow --pretty=format:"%H%x09%s%x09%ar" -- "${relPath}"`,
          );
          const tracked = (() => {
            try {
              run(`git ls-files --error-unmatch -- "${relPath}"`);
              return true;
            } catch {
              return false;
            }
          })();
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(
            JSON.stringify({ ok: true, git: true, tracked, working, recent }),
          );
        } catch (e) {
          res.writeHead(500, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: e.message }));
        }
        return;
      }

      // Serve dashboard (main page for project)
      if (req.method === "GET" && parts.length === 1) {
        touchProject(projectDir);
        try {
          const html = serveDashboard(projectDir);
          res.writeHead(200, {
            "Content-Type": "text/html; charset=utf-8",
            "Cache-Control": "no-cache, no-store",
          });
          res.end(html);
        } catch (e) {
          res.writeHead(500);
          res.end("Dashboard error: " + e.message);
        }
        return;
      }
    }

    res.writeHead(404);
    res.end("Not found");
  })
  .listen(PORT, function () {
    console.log("\nProjects: http://localhost:" + PORT);
    console.log("Scanning: " + PROJECTS_ROOT + "/*/");
    console.log("  Backlog:   " + BACKLOG_PATH);
    console.log("  Dashboard: " + DASHBOARD_PATH + "\n");
  });
