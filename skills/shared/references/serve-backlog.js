// Project server — serves backlogs and dashboards for all projects
// Usage: node serve-backlog.js [projects-root]
// Default: ~/projects
//
// Routes:
//   /css/{file}.css               → static CSS files
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
} = require("./lib/config");
const {
  findProjects,
  createBacklog,
  createDashboard,
} = require("./lib/projects");
const { populateFromProject } = require("./lib/populate");
const {
  getNavBarHtml,
  serveDashboard,
  indexPage,
  esc,
} = require("./lib/templates");
const backlogPatch = require("./lib/backlog-patches");

http
  .createServer(function (req, res) {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

    if (req.method === "OPTIONS") {
      res.writeHead(204);
      return res.end();
    }

    const url = new URL(req.url, "http://localhost:" + PORT);
    const parts = url.pathname.split("/").filter(Boolean);

    // Static CSS files
    if (req.method === "GET" && url.pathname.match(/^\/css\/[\w-]+\.css$/)) {
      const cssFile = path.join(__dirname, "css", path.basename(url.pathname));
      if (fs.existsSync(cssFile)) {
        res.writeHead(200, {
          "Content-Type": "text/css; charset=utf-8",
          "Cache-Control": "no-cache",
        });
        res.end(fs.readFileSync(cssFile, "utf8"));
        return;
      }
    }

    // Index
    if (req.method === "GET" && parts.length === 0) {
      const projects = findProjects();
      res.writeHead(200, {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-cache, no-store",
      });
      res.end(indexPage(projects));
      return;
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

      // Create backlog
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

      // Serve backlog
      if (
        req.method === "GET" &&
        parts[1] === "backlog" &&
        parts.length === 2
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
        try {
          var html = fs.readFileSync(file, "utf8");
          // Strip legacy elements from old backlogs
          html = html.replace(/<a[^>]*class="back-btn"[^>]*>[^<]*<\/a>/g, "");
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

      // Create dashboard
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

      // Open file in VS Code: /{project}/open/{filepath...}
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
