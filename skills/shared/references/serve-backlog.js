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
//   /{project}/asset?path=<rel>   → binary asset (whitelist: .project/snapshots|screenshots/)
//   /{project}/backlog            → backlog kanban
//   /{project}/backlog/save       → save backlog changes to disk
//   /{project}/backlog/create     → create new backlog

const http = require("http");
const fs = require("fs");
const path = require("path");

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
} = require("./lib/projects");
const { populateFromProject } = require("./lib/populate");
const {
  getNavBarHtml,
  serveDashboard,
  indexPage,
  esc,
} = require("./lib/templates");
const buildBacklogPatch = require("./lib/backlog-patches");

// Theme head injection (for existing backlogs that lack the theme tags)
const themeHeadTags =
  '<meta name="color-scheme" content="dark light" />' +
  '<script src="/lib/themes.js"></script>' +
  '<link rel="stylesheet" href="/css/theme-picker.css" />';

http
  .createServer(function (req, res) {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
    res.setHeader("Pragma", "no-cache");

    if (req.method === "OPTIONS") {
      res.writeHead(204);
      return res.end();
    }

    const url = new URL(req.url, "http://localhost:" + PORT);
    const parts = url.pathname.split("/").filter(Boolean);

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

        const backlogFile = path.join(projectPath, BACKLOG_PATH);
        const dashFile = path.join(projectPath, DASHBOARD_PATH);
        const sessionDir = path.join(projectPath, ".project/session");
        var lastBacklogMtime = 0;
        var lastDashMtime = 0;
        var lastSessionMtime = 0;

        try {
          lastBacklogMtime = fs.existsSync(backlogFile)
            ? fs.statSync(backlogFile).mtimeMs
            : 0;
        } catch {}
        try {
          lastDashMtime = fs.existsSync(dashFile)
            ? fs.statSync(dashFile).mtimeMs
            : 0;
        } catch {}
        try {
          lastSessionMtime = fs.existsSync(sessionDir)
            ? fs.statSync(sessionDir).mtimeMs
            : 0;
        } catch {}

        const poll = setInterval(function () {
          try {
            const bm = fs.existsSync(backlogFile)
              ? fs.statSync(backlogFile).mtimeMs
              : 0;
            const dm = fs.existsSync(dashFile)
              ? fs.statSync(dashFile).mtimeMs
              : 0;
            const am = fs.existsSync(sessionDir)
              ? fs.statSync(sessionDir).mtimeMs
              : 0;
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
        const file = path.join(projectPath, BACKLOG_PATH);
        try {
          const html = fs.readFileSync(file, "utf8");
          const match = html.match(
            /<script id="backlog-data" type="application\/json">([\s\S]*?)<\/script>/,
          );
          if (match) {
            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(match[1].trim());
          } else {
            res.writeHead(404);
            res.end("{}");
          }
        } catch {
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
        res.writeHead(302, { Location: "/" + projectDir + "/backlog" });
        res.end();
        return;
      }

      // Serve backlog — auto-migration: data persists in .project/backlog.html, layout always from template
      if (
        req.method === "GET" &&
        parts[1] === "backlog" &&
        parts.length === 2
      ) {
        touchProject(projectDir);
        const file = path.join(projectPath, BACKLOG_PATH);

        // Extract data from existing backlog file
        var backlogData = null;
        if (fs.existsSync(file)) {
          try {
            const existingHtml = fs.readFileSync(file, "utf8");
            const dataMatch = existingHtml.match(
              /<script id="backlog-data" type="application\/json">([\s\S]*?)<\/script>/,
            );
            if (dataMatch) backlogData = dataMatch[1].trim();
          } catch {}
        }

        // If no existing file, create one to initialize the data store
        if (!backlogData) {
          try {
            createBacklog(projectDir);
            const existingHtml = fs.readFileSync(file, "utf8");
            const dataMatch = existingHtml.match(
              /<script id="backlog-data" type="application\/json">([\s\S]*?)<\/script>/,
            );
            if (dataMatch) backlogData = dataMatch[1].trim();
          } catch (e) {
            res.writeHead(500);
            res.end("Create error: " + e.message);
            return;
          }
        }

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
                      projJson.subtitle || projJson.concept || "";
                } else if (!parsedData.project) {
                  parsedData.project = projectDir;
                }
                backlogData = JSON.stringify(parsedData, null, 2);
              }
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
        const file = path.join(projectPath, BACKLOG_PATH);
        var body = "";
        req.on("data", function (chunk) {
          body += chunk;
        });
        req.on("end", function () {
          try {
            const jsonData = JSON.parse(body);
            const jsonStr = JSON.stringify(jsonData, null, 2);

            const html = fs.readFileSync(file, "utf8");
            var startTag = '<script id="backlog-data" type="application/json">';
            var sIdx = html.indexOf(startTag) + startTag.length;
            var eIdx = html.indexOf("</script>", sIdx);
            const updated =
              html.substring(0, sIdx) +
              "\n" +
              jsonStr +
              "\n" +
              html.substring(eIdx);

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

            // Split concept.content to project-concept.md if conceptFile is set
            if (jsonData.concept && jsonData.concept.conceptFile) {
              const conceptMdPath = path.join(
                projectPath,
                ".project/project-concept.md",
              );
              if (jsonData.concept.content) {
                const conceptDir = path.join(projectPath, ".project");
                if (!fs.existsSync(conceptDir))
                  fs.mkdirSync(conceptDir, { recursive: true });
                fs.writeFileSync(
                  conceptMdPath,
                  jsonData.concept.content,
                  "utf8",
                );
                // Keep only metadata in project.json
                delete jsonData.concept.content;
              }
            }

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

        // Read feature.json (optional — Path A frontend cards may not have it)
        const featurePath = path.join(
          projectPath,
          ".project/features",
          featureName,
        );
        const featureJson = path.join(featurePath, "feature.json");
        let result = null;
        if (fs.existsSync(featureJson)) {
          try {
            result = JSON.parse(fs.readFileSync(featureJson, "utf8"));
          } catch {
            result = { name: featureName };
          }
        }

        // Merge backlog metadata (type, status, phase, audit.*)
        const backlogFile = path.join(projectPath, BACKLOG_PATH);
        if (fs.existsSync(backlogFile)) {
          try {
            const backlogHtml = fs.readFileSync(backlogFile, "utf8");
            const jsonMatch = backlogHtml.match(
              /<script id="backlog-data" type="application\/json">([\s\S]*?)<\/script>/,
            );
            if (jsonMatch) {
              const backlogData = JSON.parse(jsonMatch[1]);
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
