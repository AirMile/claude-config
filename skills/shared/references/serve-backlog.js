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
//   /{project}/feature/:name       → feature detail (JSON)
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
const backlogPatch = require("./lib/backlog-patches");

// Async exec helper for GitHub CLI commands
function ghExec(cmd) {
  return new Promise(function (resolve, reject) {
    require("child_process").exec(
      cmd,
      { encoding: "utf8", timeout: 30000 },
      function (err, stdout) {
        if (err) reject(err);
        else resolve(stdout.trim());
      },
    );
  });
}

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
        res.end("Ongeldig pad");
        return;
      }

      const projectPath = path.join(PROJECTS_ROOT, projectDir);
      if (!fs.existsSync(projectPath)) {
        res.writeHead(404);
        res.end("Project niet gevonden: " + esc(projectDir));
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
            rootScript + backlogPatch + nav + "</body>",
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
        const claudePath = path.join(projectPath, ".claude/CLAUDE.md");

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

      // Feature detail (feature.json)
      if (
        req.method === "GET" &&
        parts[1] === "feature" &&
        parts[2] &&
        parts.length === 3
      ) {
        const featureName = parts[2];
        const featurePath = path.join(
          projectPath,
          ".project/features",
          featureName,
        );

        if (featureName.includes("..")) {
          res.writeHead(400);
          res.end("Ongeldig pad");
          return;
        }

        if (!fs.existsSync(featurePath)) {
          res.writeHead(404, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Feature niet gevonden" }));
          return;
        }

        var result;

        const featureJson = path.join(featurePath, "feature.json");
        if (fs.existsSync(featureJson)) {
          try {
            result = JSON.parse(fs.readFileSync(featureJson, "utf8"));
          } catch {
            result = { name: featureName };
          }
        } else {
          result = { name: featureName };
        }

        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify(result, null, 2));
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
          res.end(JSON.stringify({ error: "path parameter verplicht" }));
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
          res.end(JSON.stringify({ error: "Toegang geweigerd" }));
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
          res.end(JSON.stringify({ error: "Bestandstype niet toegestaan" }));
          return;
        }

        if (!fs.existsSync(resolvedPath)) {
          res.writeHead(404, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Bestand niet gevonden" }));
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

      // GitHub config check
      if (
        req.method === "GET" &&
        parts[1] === "github" &&
        parts[2] === "config-check" &&
        parts.length === 3
      ) {
        var ghConfigPath = path.join(
          projectPath,
          ".project",
          "github-project.json",
        );
        var configured = false;
        if (fs.existsSync(ghConfigPath)) {
          try {
            var cfg = JSON.parse(fs.readFileSync(ghConfigPath, "utf8"));
            configured = !!(
              cfg.owner &&
              cfg.repo &&
              cfg.project_number &&
              cfg.username
            );
          } catch {}
        }
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ configured: configured }));
        return;
      }

      // Push backlog item to GitHub as Done
      if (
        req.method === "POST" &&
        parts[1] === "github" &&
        parts[2] === "push-done"
      ) {
        var ghBody = "";
        req.on("data", function (chunk) {
          ghBody += chunk;
        });
        req.on("end", async function () {
          try {
            var payload = JSON.parse(ghBody);
            var itemName = payload.name;
            if (!itemName) {
              res.writeHead(400, { "Content-Type": "application/json" });
              res.end('{"error":"name is verplicht"}');
              return;
            }

            // Read github-project config
            var ghConfigPath = path.join(
              projectPath,
              ".project",
              "github-project.json",
            );
            if (!fs.existsSync(ghConfigPath)) {
              res.writeHead(400, { "Content-Type": "application/json" });
              res.end('{"error":"Geen .project/github-project.json gevonden"}');
              return;
            }
            var ghConfig = JSON.parse(fs.readFileSync(ghConfigPath, "utf8"));
            if (
              !ghConfig.owner ||
              !ghConfig.repo ||
              !ghConfig.project_number ||
              !ghConfig.username
            ) {
              res.writeHead(400, { "Content-Type": "application/json" });
              res.end(
                '{"error":"github-project.json mist owner, repo, project_number of username"}',
              );
              return;
            }

            // Read backlog data
            var backlogFile = path.join(projectPath, BACKLOG_PATH);
            var html = fs.readFileSync(backlogFile, "utf8");
            var jsonMatch = html.match(
              /<script id="backlog-data" type="application\/json">([\s\S]*?)<\/script>/,
            );
            if (!jsonMatch) {
              res.writeHead(500, { "Content-Type": "application/json" });
              res.end('{"error":"Backlog JSON niet gevonden"}');
              return;
            }
            var backlogData = JSON.parse(jsonMatch[1]);
            var item = backlogData.features.find(function (f) {
              return f.name === itemName;
            });
            if (!item) {
              res.writeHead(404, { "Content-Type": "application/json" });
              res.end('{"error":"Item niet gevonden in backlog"}');
              return;
            }

            var ownerRepo = ghConfig.owner + "/" + ghConfig.repo;
            var issueUrl = item.github_issue || null;
            var issueNumber = null;
            var ghItemId = item.github_item_id || null;

            // Step 1: Create issue if it doesn't exist on GitHub
            if (!issueUrl) {
              // Title: readable name (kebab-case → Title Case)
              var title = item.name
                .replace(/-/g, " ")
                .replace(/\b\w/g, function (c) {
                  return c.toUpperCase();
                });
              var body = item.description || "";
              var createOut = await ghExec(
                "gh issue create -R " +
                  ownerRepo +
                  " --title " +
                  JSON.stringify(title) +
                  " --body " +
                  JSON.stringify(body) +
                  " --assignee " +
                  ghConfig.username,
              );
              // gh issue create returns the issue URL
              issueUrl = createOut;
              var numMatch = issueUrl.match(/\/(\d+)$/);
              issueNumber = numMatch ? numMatch[1] : null;
            } else {
              // Extract issue number from existing URL
              var urlMatch = issueUrl.match(/\/issues\/(\d+)$/);
              issueNumber = urlMatch ? urlMatch[1] : null;
            }

            // Step 2: Get project ID and field IDs via GraphQL
            var projectQuery = await ghExec(
              "gh api graphql -f query='{ user(login: \"" +
                ghConfig.owner +
                '") { projectV2(number: ' +
                ghConfig.project_number +
                ") { id fields(first: 20) { nodes { ... on ProjectV2SingleSelectField { name id options { name id } } } } } } }'",
            );
            var projectData = JSON.parse(projectQuery);
            var proj = projectData.data.user.projectV2;
            var projectId = proj.id;
            var statusField = proj.fields.nodes.find(function (f) {
              return f.name === "Status";
            });
            var statusFieldId = statusField.id;
            var doneOptionId = statusField.options.find(function (o) {
              return o.name === "Done";
            }).id;

            // Step 3: Add issue to project if not already there
            if (!ghItemId) {
              // Get issue node ID
              var repoMatch = issueUrl.match(
                /github\.com\/([^/]+)\/([^/]+)\/issues\/(\d+)/,
              );
              var repoOwner = repoMatch ? repoMatch[1] : ghConfig.owner;
              var repoName = repoMatch ? repoMatch[2] : ghConfig.repo;
              var repoIssueNum = repoMatch ? repoMatch[3] : issueNumber;
              var issueIdQuery = await ghExec(
                "gh api graphql -f query='{ repository(owner: \"" +
                  repoOwner +
                  '", name: "' +
                  repoName +
                  '") { issue(number: ' +
                  repoIssueNum +
                  ") { id } } }'",
              );
              var issueNodeId =
                JSON.parse(issueIdQuery).data.repository.issue.id;

              var addResult = await ghExec(
                "gh api graphql -f query='mutation { addProjectV2ItemById(input: { projectId: \"" +
                  projectId +
                  '" contentId: "' +
                  issueNodeId +
                  "\" }) { item { id } } }'",
              );
              ghItemId =
                JSON.parse(addResult).data.addProjectV2ItemById.item.id;
            }

            // Step 4: Set status to Done
            await ghExec(
              "gh api graphql -f query='mutation { updateProjectV2ItemFieldValue(input: { projectId: \"" +
                projectId +
                '" itemId: "' +
                ghItemId +
                '" fieldId: "' +
                statusFieldId +
                '" value: { singleSelectOptionId: "' +
                doneOptionId +
                "\" } }) { projectV2Item { id } } }'",
            );

            // Step 5: Close the issue
            if (issueNumber) {
              await ghExec(
                "gh issue close " + issueNumber + " -R " + ownerRepo,
              );
            }

            // Step 6: Update backlog with github_issue and github_item_id
            item.github_issue = issueUrl;
            item.github_item_id = ghItemId;
            var startTag = '<script id="backlog-data" type="application/json">';
            var sIdx = html.indexOf(startTag) + startTag.length;
            var eIdx = html.indexOf("</script>", sIdx);
            var updated =
              html.substring(0, sIdx) +
              "\n" +
              JSON.stringify(backlogData, null, 2) +
              "\n" +
              html.substring(eIdx);
            fs.writeFileSync(backlogFile, updated, "utf8");

            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(
              JSON.stringify({
                ok: true,
                issue_url: issueUrl,
                issue_number: issueNumber ? parseInt(issueNumber) : null,
              }),
            );
          } catch (e) {
            res.writeHead(500, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: e.message }));
          }
        });
        return;
      }

      // Open file in VS Code
      if (req.method === "POST" && parts[1] === "open" && parts.length >= 3) {
        const relPath = parts.slice(2).join("/");
        if (relPath.includes("..")) {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Ongeldig pad" }));
          return;
        }
        const filePath = path.join(projectPath, relPath);
        if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
          res.writeHead(404, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Bestand niet gevonden" }));
          return;
        }
        try {
          const { execSync } = require("child_process");
          // Find VS Code remote CLI and IPC socket
          const codeCliGlob = require("child_process")
            .execSync(
              "ls -t /home/claude/.vscode-server/cli/servers/*/server/bin/remote-cli/code 2>/dev/null | head -1",
              { encoding: "utf8" },
            )
            .trim();
          const ipcSock = require("child_process")
            .execSync(
              "ls -t /run/user/$(id -u)/vscode-ipc-*.sock 2>/dev/null | head -1",
              { encoding: "utf8" },
            )
            .trim();
          if (!codeCliGlob || !ipcSock) {
            res.writeHead(500, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: "VS Code CLI niet beschikbaar" }));
            return;
          }
          execSync(
            'VSCODE_IPC_HOOK_CLI="' +
              ipcSock +
              '" "' +
              codeCliGlob +
              '" "' +
              filePath +
              '"',
            {
              timeout: 5000,
            },
          );
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ ok: true, file: relPath }));
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
