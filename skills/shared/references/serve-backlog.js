// Project server — serves backlogs and dashboards for all projects
// Usage: node serve-backlog.js [projects-root]
// Default: ~/projects
//
// Routes:
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

const PROJECTS_ROOT = path.resolve(
  process.argv[2] || path.join(require("os").homedir(), "projects"),
);
const PORT = parseInt(process.env.BACKLOG_PORT || "9876", 10);
const BACKLOG_PATH = ".project/backlog.html";
const DASHBOARD_PATH = ".project/project.json";
const TEMPLATE_PATH = path.join(__dirname, "backlog-template.html");
const DASHBOARD_TEMPLATE_PATH = path.join(__dirname, "dashboard-template.html");

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
      const dashFile = path.join(dirPath, DASHBOARD_PATH);
      const hasBacklog = fs.existsSync(file);
      const hasDashboard = fs.existsSync(dashFile);
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

      if (hasDashboard && !hasBacklog) {
        try {
          const json = JSON.parse(fs.readFileSync(dashFile, "utf8"));
          if (json.concept && json.concept.name) project = json.concept.name;
        } catch {}
      }

      // Use most recent mtime of backlog.html or project.json
      let mtime = 0;
      if (hasBacklog) {
        try {
          mtime = Math.max(mtime, fs.statSync(file).mtimeMs);
        } catch {}
      }
      if (hasDashboard) {
        try {
          mtime = Math.max(mtime, fs.statSync(dashFile).mtimeMs);
        } catch {}
      }

      projects.push({
        dir: name,
        project,
        updated,
        hasBacklog,
        hasDashboard,
        file,
        mtime,
      });
    }
  } catch {}
  // Active projects first (most recently used first), then empty (alphabetical)
  return projects.sort((a, b) => {
    const aActive = a.hasBacklog || a.hasDashboard;
    const bActive = b.hasBacklog || b.hasDashboard;
    if (aActive && !bActive) return -1;
    if (!aActive && bActive) return 1;
    if (aActive && bActive) return b.mtime - a.mtime;
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

function createDashboard(projectDir) {
  const file = path.join(PROJECTS_ROOT, projectDir, DASHBOARD_PATH);
  const wsDir = path.dirname(file);
  if (!fs.existsSync(wsDir)) fs.mkdirSync(wsDir, { recursive: true });

  const emptyData = {
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

  fs.writeFileSync(file, JSON.stringify(emptyData, null, 2), "utf8");
  return file;
}

// Auto-populate empty dashboard sections from project files (legacy migration)
function populateFromProject(projectDir, dashData) {
  const projectPath = path.join(PROJECTS_ROOT, projectDir);
  let changed = false;

  // ── Concept: migrate from legacy .project/concept.md ──
  const conceptEmpty = !dashData.concept || !dashData.concept.content;
  const conceptFile = path.join(projectPath, ".project/concept.md");

  if (conceptEmpty && fs.existsSync(conceptFile)) {
    try {
      const md = fs.readFileSync(conceptFile, "utf8");
      if (!dashData.concept) dashData.concept = {};

      const titleMatch = md.match(/^#\s+(.+)$/m);
      if (titleMatch) dashData.concept.name = titleMatch[1].trim();
      dashData.concept.content = md;
      changed = true;
    } catch {}
  }

  // ── Theme: migrate from legacy .project/config/THEME.md ──
  const themeEmpty =
    !dashData.theme ||
    (!dashData.theme.colors?.main?.length && !dashData.theme.cssVars);
  const themeFile = path.join(projectPath, ".project/config/THEME.md");

  if (themeEmpty && fs.existsSync(themeFile)) {
    try {
      const md = fs.readFileSync(themeFile, "utf8");
      if (!dashData.theme) dashData.theme = {};

      // Helper: parse a markdown table into array of objects
      // Expects header row, separator row, then data rows
      function parseTable(text) {
        const lines = text
          .split("\n")
          .map((l) => l.trim())
          .filter((l) => l.startsWith("|"));
        if (lines.length < 3) return [];
        const headers = lines[0]
          .split("|")
          .map((h) => h.trim())
          .filter(Boolean);
        // Skip separator line (index 1)
        const rows = [];
        for (let i = 2; i < lines.length; i++) {
          const cells = lines[i]
            .split("|")
            .map((c) => c.trim())
            .filter(Boolean);
          if (cells.length >= headers.length) {
            const row = {};
            for (let j = 0; j < headers.length; j++) {
              row[headers[j].toLowerCase()] = cells[j];
            }
            rows.push(row);
          }
        }
        return rows;
      }

      // Helper: get section content between heading and next heading of same/higher level
      function getSection(md, heading, level) {
        const esc = heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const re = new RegExp(
          "#{" +
            level +
            "}\\s+" +
            esc +
            "\\s*\\n([\\s\\S]*?)(?=\\n#{1," +
            level +
            "}\\s|$)",
        );
        const m = md.match(re);
        return m ? m[1] : "";
      }

      // Helper: get sub-section (### under ## Colors, etc.)
      function getSubSection(sectionText, heading) {
        const esc = heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const re = new RegExp(
          "###\\s+" + esc + "\\s*\\n([\\s\\S]*?)(?=\\n###\\s|$)",
        );
        const m = sectionText.match(re);
        return m ? m[1] : "";
      }

      // Helper: extract fenced code block content
      function getCodeBlock(text) {
        const m = text.match(/```[\w]*\n([\s\S]*?)```/);
        return m ? m[1].trim() : "";
      }

      // Colors
      try {
        const colorsSection = getSection(md, "Colors", 2);
        if (colorsSection) {
          if (!dashData.theme.colors)
            dashData.theme.colors = { main: [], accent: [], semantic: [] };

          const mainText = getSubSection(colorsSection, "Main Colors");
          if (mainText) {
            dashData.theme.colors.main = parseTable(mainText).map((r) => ({
              token: r.token || "",
              value: r.value || "",
              usage: r.usage || "",
            }));
          }

          const accentText = getSubSection(colorsSection, "Accent Colors");
          if (accentText) {
            dashData.theme.colors.accent = parseTable(accentText).map((r) => ({
              token: r.token || "",
              value: r.value || "",
              usage: r.usage || "",
            }));
          }

          const semanticText = getSubSection(colorsSection, "Semantic Colors");
          if (semanticText) {
            dashData.theme.colors.semantic = parseTable(semanticText).map(
              (r) => ({
                token: r.token || "",
                value: r.value || "",
                usage: r.usage || "",
              }),
            );
          }

          changed = true;
        }
      } catch {}

      // Typography
      try {
        const typoSection = getSection(md, "Typography", 2);
        if (typoSection) {
          if (!dashData.theme.typography)
            dashData.theme.typography = {
              families: { heading: "", body: "", mono: "" },
              sizes: [],
            };

          const familiesText = getSubSection(typoSection, "Font Families");
          if (familiesText) {
            const rows = parseTable(familiesText);
            for (const r of rows) {
              const role = (r.role || r.token || "").toLowerCase();
              const value = r.family || r.value || "";
              if (role.includes("heading"))
                dashData.theme.typography.families.heading = value;
              else if (role.includes("body"))
                dashData.theme.typography.families.body = value;
              else if (role.includes("mono"))
                dashData.theme.typography.families.mono = value;
            }
          }

          const sizesText =
            getSubSection(typoSection, "Font Sizes") ||
            getSubSection(typoSection, "Sizes") ||
            getSubSection(typoSection, "Type Scale");
          if (sizesText) {
            dashData.theme.typography.sizes = parseTable(sizesText).map(
              (r) => ({
                token: r.token || "",
                size: r.size || r.value || "",
                lineHeight:
                  r.lineheight || r["line-height"] || r["line height"] || "",
              }),
            );
          }

          changed = true;
        }
      } catch {}

      // Spacing
      try {
        const spacingSection = getSection(md, "Spacing", 2);
        if (spacingSection) {
          if (!dashData.theme.spacing)
            dashData.theme.spacing = { base: "", scale: [] };

          const baseMatch = spacingSection.match(
            /[Bb]ase\s*(?:unit)?\s*[:：]\s*[`]?(\d+\s*px)[`]?/,
          );
          if (baseMatch) dashData.theme.spacing.base = baseMatch[1].trim();

          const scaleRows = parseTable(spacingSection);
          if (scaleRows.length) {
            dashData.theme.spacing.scale = scaleRows.map((r) => ({
              token: r.token || "",
              value: r.value || "",
              usage: r.usage || "",
            }));
          }

          changed = true;
        }
      } catch {}

      // Breakpoints
      try {
        const bpSection = getSection(md, "Breakpoints", 2);
        if (bpSection) {
          dashData.theme.breakpoints = parseTable(bpSection).map((r) => ({
            token: r.token || "",
            value: r.value || "",
            target: r.target || r.description || r.usage || "",
          }));
          changed = true;
        }
      } catch {}

      // Border Radius
      try {
        const brSection =
          getSection(md, "Border Radius", 2) ||
          getSection(md, "BorderRadius", 2) ||
          getSection(md, "Border-Radius", 2);
        if (brSection) {
          dashData.theme.borderRadius = parseTable(brSection).map((r) => ({
            token: r.token || "",
            value: r.value || "",
            usage: r.usage || "",
          }));
          changed = true;
        }
      } catch {}

      // Shadows
      try {
        const shadowSection = getSection(md, "Shadows", 2);
        if (shadowSection) {
          dashData.theme.shadows = parseTable(shadowSection).map((r) => ({
            token: r.token || "",
            value: r.value || "",
            usage: r.usage || "",
          }));
          changed = true;
        }
      } catch {}

      // CSS Variables Export
      try {
        const cssVarsSection =
          getSection(md, "CSS Variables Export", 2) ||
          getSection(md, "CSS Variables", 2);
        if (cssVarsSection) {
          const code = getCodeBlock(cssVarsSection);
          if (code) {
            dashData.theme.cssVars = code;
            changed = true;
          }
        }
      } catch {}

      // Theme Modes (Light / Dark)
      try {
        const modesSection =
          getSection(md, "Theme Modes", 2) || getSection(md, "Modes", 2);
        if (modesSection) {
          if (!dashData.theme.modes) dashData.theme.modes = {};

          const lightText = getSubSection(modesSection, "Light Mode");
          if (lightText) {
            const code = getCodeBlock(lightText);
            if (code) dashData.theme.modes.light = code;
          }

          const darkText = getSubSection(modesSection, "Dark Mode");
          if (darkText) {
            const code = getCodeBlock(darkText);
            if (code) dashData.theme.modes.dark = code;
          }

          if (dashData.theme.modes.light || dashData.theme.modes.dark)
            changed = true;
        }
      } catch {}
    } catch {}
  }

  // ── Stack from CLAUDE.md ### Stack section ──
  const stackEmpty =
    !dashData.stack || (!dashData.stack.framework && !dashData.stack.language);
  const claudeMdFile = path.join(projectPath, "CLAUDE.md");

  if (stackEmpty && fs.existsSync(claudeMdFile)) {
    try {
      const md = fs.readFileSync(claudeMdFile, "utf8");
      const stackMatch = md.match(
        /###\s+Stack\s*\n([\s\S]*?)(?=\n###?\s|\n## |\Z)/,
      );
      if (stackMatch) {
        if (!dashData.stack) dashData.stack = {};
        const stackText = stackMatch[1];
        const pairs = [
          ...stackText.matchAll(
            /[-*]\s*\*?\*?(\w[\w\s/]*?)\*?\*?\s*[:：]\s*(.+)/g,
          ),
        ];
        const keyMap = {
          framework: "framework",
          language: "language",
          taal: "language",
          styling: "styling",
          css: "styling",
          database: "db",
          db: "db",
          auth: "auth",
          hosting: "hosting",
          deploy: "hosting",
        };
        for (const [, key, val] of pairs) {
          const normalized = key.trim().toLowerCase();
          const field = keyMap[normalized];
          if (field) dashData.stack[field] = val.trim();
        }
        changed = true;
      }
    } catch {}
  }

  // ── Stack fallback: detect from project files if still empty ──
  const stackStillEmpty =
    !dashData.stack || (!dashData.stack.framework && !dashData.stack.language);

  if (stackStillEmpty) {
    // ── package.json (Node.js / JavaScript) ──
    const pkgFile = path.join(projectPath, "package.json");
    if (fs.existsSync(pkgFile)) {
      try {
        const pkg = JSON.parse(fs.readFileSync(pkgFile, "utf8"));
        if (!dashData.stack) dashData.stack = {};
        const deps = pkg.dependencies || {};
        const devDeps = pkg.devDependencies || {};
        const allDeps = { ...deps, ...devDeps };

        // Framework detection
        const frameworkMap = [
          ["next", "Next.js"],
          ["nuxt", "Nuxt"],
          ["@angular/core", "Angular"],
          ["svelte", "Svelte"],
          ["vue", "Vue.js"],
          ["react", "React"],
          ["express", "Express"],
          ["fastify", "Fastify"],
          ["hono", "Hono"],
          ["koa", "Koa"],
          ["@nestjs/core", "NestJS"],
          ["gatsby", "Gatsby"],
          ["@remix-run/react", "Remix"],
          ["astro", "Astro"],
        ];
        for (const [dep, name] of frameworkMap) {
          if (allDeps[dep]) {
            dashData.stack.framework = name;
            break;
          }
        }

        // Language
        dashData.stack.language = allDeps["typescript"]
          ? "TypeScript"
          : "JavaScript";

        // Styling detection
        const stylingMap = [
          ["tailwindcss", "Tailwind CSS"],
          ["@tailwindcss/postcss", "Tailwind CSS"],
          ["sass", "Sass"],
          ["styled-components", "Styled Components"],
          ["@emotion/react", "Emotion"],
          ["@mui/material", "Material UI"],
          ["bootstrap", "Bootstrap"],
        ];
        for (const [dep, name] of stylingMap) {
          if (allDeps[dep]) {
            dashData.stack.styling = name;
            break;
          }
        }

        // Database detection
        const dbMap = [
          ["prisma", "Prisma"],
          ["@prisma/client", "Prisma"],
          ["drizzle-orm", "Drizzle"],
          ["mongoose", "MongoDB/Mongoose"],
          ["mongodb", "MongoDB"],
          ["pg", "PostgreSQL"],
          ["mysql2", "MySQL"],
          ["better-sqlite3", "SQLite"],
          ["typeorm", "TypeORM"],
          ["sequelize", "Sequelize"],
          ["knex", "Knex"],
        ];
        for (const [dep, name] of dbMap) {
          if (allDeps[dep]) {
            dashData.stack.db = name;
            break;
          }
        }

        // Auth detection
        const authMap = [
          ["next-auth", "NextAuth.js"],
          ["@auth/core", "Auth.js"],
          ["passport", "Passport.js"],
          ["@clerk/nextjs", "Clerk"],
          ["@supabase/supabase-js", "Supabase Auth"],
          ["firebase", "Firebase Auth"],
          ["lucia", "Lucia"],
        ];
        for (const [dep, name] of authMap) {
          if (allDeps[dep]) {
            dashData.stack.auth = name;
            break;
          }
        }

        // Packages: map all dependencies
        const packages = [];
        for (const [name, version] of Object.entries(deps)) {
          packages.push({ name, version, purpose: "dependency" });
        }
        for (const [name, version] of Object.entries(devDeps)) {
          packages.push({ name, version, purpose: "devDependency" });
        }
        dashData.stack.packages = packages;

        changed = true;
      } catch {}
    }

    // ── project.godot (Godot) ──
    else {
      const godotFile = path.join(projectPath, "project.godot");
      if (fs.existsSync(godotFile)) {
        try {
          const content = fs.readFileSync(godotFile, "utf8");
          if (!dashData.stack) dashData.stack = {};

          // Godot version from features
          const featuresMatch = content.match(
            /config\/features\s*=\s*PackedStringArray\(([^)]*)\)/,
          );
          if (featuresMatch) {
            const versionMatch = featuresMatch[1].match(/"(\d+\.\d+)"/);
            if (versionMatch) {
              dashData.stack.framework = "Godot " + versionMatch[1];
            }
          }
          // Fallback: config_version
          if (!dashData.stack.framework) {
            const configVer = content.match(/config_version\s*=\s*(\d+)/);
            if (configVer) {
              const major = parseInt(configVer[1]) >= 5 ? "4.x" : "3.x";
              dashData.stack.framework = "Godot " + major;
            }
          }

          dashData.stack.language = "GDScript";

          // Project name
          const nameMatch = content.match(/config\/name\s*=\s*"([^"]*)"/);
          if (nameMatch && dashData.concept && !dashData.concept.name) {
            dashData.concept.name = nameMatch[1];
          }

          // Autoloads as packages
          const autoloads = [
            ...content.matchAll(/(\w+)\s*=\s*"\*res:\/\/([^"]+)"/g),
          ];
          if (autoloads.length) {
            dashData.stack.packages = autoloads.map(([, name]) => ({
              name,
              version: "",
              purpose: "autoload",
            }));
          }

          changed = true;
        } catch {}
      }

      // ── Cargo.toml (Rust) ──
      else {
        const cargoFile = path.join(projectPath, "Cargo.toml");
        if (fs.existsSync(cargoFile)) {
          try {
            const content = fs.readFileSync(cargoFile, "utf8");
            if (!dashData.stack) dashData.stack = {};

            dashData.stack.language = "Rust";

            // Framework detection from [dependencies]
            const rustFrameworkMap = [
              ["actix-web", "Actix Web"],
              ["axum", "Axum"],
              ["rocket", "Rocket"],
              ["warp", "Warp"],
              ["tide", "Tide"],
              ["tauri", "Tauri"],
              ["dioxus", "Dioxus"],
              ["leptos", "Leptos"],
              ["yew", "Yew"],
              ["bevy", "Bevy"],
            ];
            for (const [dep, name] of rustFrameworkMap) {
              const depRe = new RegExp(
                "^\\s*" + dep.replace(/-/g, "[-_]") + "\\s*=",
                "m",
              );
              if (depRe.test(content)) {
                dashData.stack.framework = name;
                break;
              }
            }

            changed = true;
          } catch {}
        }

        // ── requirements.txt / pyproject.toml (Python) ──
        else {
          const reqFile = path.join(projectPath, "requirements.txt");
          const pyprojectFile = path.join(projectPath, "pyproject.toml");
          const hasPython =
            fs.existsSync(reqFile) || fs.existsSync(pyprojectFile);

          if (hasPython) {
            try {
              if (!dashData.stack) dashData.stack = {};
              dashData.stack.language = "Python";

              let content = "";
              if (fs.existsSync(reqFile)) {
                content += fs.readFileSync(reqFile, "utf8");
              }
              if (fs.existsSync(pyprojectFile)) {
                content += "\n" + fs.readFileSync(pyprojectFile, "utf8");
              }

              const pyFrameworkMap = [
                [/\bdjango\b/i, "Django"],
                [/\bflask\b/i, "Flask"],
                [/\bfastapi\b/i, "FastAPI"],
                [/\bstarlette\b/i, "Starlette"],
                [/\btornado\b/i, "Tornado"],
                [/\bsanic\b/i, "Sanic"],
                [/\blitestar\b/i, "Litestar"],
                [/\bstreamlit\b/i, "Streamlit"],
              ];
              for (const [re, name] of pyFrameworkMap) {
                if (re.test(content)) {
                  dashData.stack.framework = name;
                  break;
                }
              }

              changed = true;
            } catch {}
          }
        }
      }
    }
  }

  // ── Features: populate from .project/features/ dirs ──
  const featuresDir = path.join(projectPath, ".project/features");
  if (fs.existsSync(featuresDir)) {
    try {
      if (!dashData.features) dashData.features = [];
      for (const featureName of fs.readdirSync(featuresDir)) {
        const featurePath = path.join(featuresDir, featureName);
        if (!fs.statSync(featurePath).isDirectory()) continue;

        // Promote status based on pipeline JSON files
        function promoteStatus(s, fp) {
          if (s === "DEF" || s === "TODO") {
            if (fs.existsSync(path.join(fp, "build.json"))) s = "BLT";
          }
          if (s === "BLT") {
            if (fs.existsSync(path.join(fp, "test.json"))) s = "TST";
          }
          if (s === "TST") {
            const refJson = path.join(fp, "refactor.json");
            if (fs.existsSync(refJson)) {
              try {
                const ref = JSON.parse(fs.readFileSync(refJson, "utf8"));
                if (ref.status === "CLEAN" || ref.status === "REFACTORED")
                  s = "DONE";
              } catch {
                s = "DONE";
              }
            }
          }
          return s;
        }

        // Update existing feature status, or add new
        const existing = dashData.features.find((f) => f.name === featureName);
        if (existing) {
          const promoted = promoteStatus(existing.status, featurePath);
          if (promoted !== existing.status) {
            existing.status = promoted;
            changed = true;
          }
          // Also fill summary from define.json if missing
          if (!existing.summary) {
            const defineJson = path.join(featurePath, "define.json");
            if (fs.existsSync(defineJson)) {
              try {
                const def = JSON.parse(fs.readFileSync(defineJson, "utf8"));
                if (def.summary) {
                  existing.summary = def.summary;
                  changed = true;
                }
              } catch {}
            }
          }
          continue;
        }

        let status = "TODO";
        let summary = "";
        let created = "";
        let depends = [];

        const defineJson = path.join(featurePath, "define.json");

        if (fs.existsSync(defineJson)) {
          try {
            const def = JSON.parse(fs.readFileSync(defineJson, "utf8"));
            status = def.status || "DEF";
            summary = def.summary || "";
            created = def.created || "";
            depends = def.depends || [];
          } catch {}
        }

        status = promoteStatus(status, featurePath);

        dashData.features.push({
          name: featureName,
          status,
          summary,
          depends,
          created: created || new Date().toISOString().slice(0, 10),
        });
        changed = true;
      }
    } catch {}
  }

  // Write back if populated
  if (changed) {
    const dashFile = path.join(projectPath, DASHBOARD_PATH);
    const wsDir = path.dirname(dashFile);
    if (!fs.existsSync(wsDir)) fs.mkdirSync(wsDir, { recursive: true });
    fs.writeFileSync(dashFile, JSON.stringify(dashData, null, 2), "utf8");
  }

  return dashData;
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
  let dashData = {
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

  let html = fs.readFileSync(DASHBOARD_TEMPLATE_PATH, "utf8");
  html = html.replace(
    /(<script id="dashboard-data" type="application\/json">)([\s\S]*?)(<\/script>)/,
    `$1\n${JSON.stringify(dashData, null, 2)}\n$3`,
  );
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
  const activeProjects = projects.filter((p) => p.hasBacklog || p.hasDashboard);
  const emptyProjects = projects.filter(
    (p) => !p.hasBacklog && !p.hasDashboard,
  );

  const projectCard = (p) => {
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

  const emptyCard = (p) => `
      <div class="project-row empty-row">
        <div class="row-info">
          <span class="row-name">${esc(p.dir)}</span>
        </div>
        <div class="row-actions">
          <form method="POST" action="/${p.dir}/backlog/create" style="margin:0"><button type="submit" class="nav-btn nav-new"><svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="1" y="2" width="14" height="3" rx="1" stroke="currentColor" stroke-width="1.5"/><rect x="1" y="7" width="14" height="3" rx="1" stroke="currentColor" stroke-width="1.5"/><rect x="1" y="12" width="14" height="3" rx="1" stroke="currentColor" stroke-width="1.5"/></svg>Backlog</button></form>
          <form method="POST" action="/${p.dir}/create" style="margin:0"><button type="submit" class="nav-btn nav-new"><svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="1" y="1" width="6" height="6" rx="1" stroke="currentColor" stroke-width="1.5"/><rect x="9" y="1" width="6" height="6" rx="1" stroke="currentColor" stroke-width="1.5"/><rect x="1" y="9" width="6" height="6" rx="1" stroke="currentColor" stroke-width="1.5"/><rect x="9" y="9" width="6" height="6" rx="1" stroke="currentColor" stroke-width="1.5"/></svg>Dashboard</button></form>
        </div>
      </div>`;

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

    .projects-list { display:flex; flex-direction:column; gap:4px; padding:24px 48px 48px; max-width:800px; margin:0 auto; }

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
        let lastBacklogMtime = 0;
        let lastDashMtime = 0;

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

        const poll = setInterval(() => {
          try {
            const bm = fs.existsSync(backlogFile)
              ? fs.statSync(backlogFile).mtimeMs
              : 0;
            const dm = fs.existsSync(dashFile)
              ? fs.statSync(dashFile).mtimeMs
              : 0;
            if (bm !== lastBacklogMtime) {
              lastBacklogMtime = bm;
              res.write("data: backlog\n\n");
            }
            if (dm !== lastDashMtime) {
              lastDashMtime = dm;
              res.write("data: dashboard\n\n");
            }
          } catch {}
        }, 1000);

        req.on("close", () => clearInterval(poll));
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
          let dashData = JSON.parse(fs.readFileSync(dashFile, "utf8"));
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
          let html = fs.readFileSync(file, "utf8");
          // Strip legacy elements from old backlogs
          html = html.replace(/<a[^>]*class="back-btn"[^>]*>[^<]*<\/a>/g, "");
          const nav = getNavBarHtml(projectDir, "backlog");
          // Patch: hide old header/promote, add copy-cmd buttons, fix detail modal
          const backlogPatch = `<style>
  body > header { display:none !important; }
  .promote-btn { display:none !important; }
  #detail-promote { display:none !important; }
  .stats { display:none !important; }
  .board { min-height: calc(100vh - 48px) !important; }
  .column-header { padding: 10px 12px !important; }
  .edit-btn { display:none !important; }
  .card-actions button { width:20px !important; height:20px !important; border-radius:3px !important; font-size:10px !important; }
  .detail-actions { justify-content:flex-start !important; }
  .detail-actions button { flex:none !important; width:auto !important; height:auto !important; padding:4px 10px !important; font-size:12px !important; display:inline-flex !important; align-items:center !important; gap:4px !important; background:var(--surface) !important; color:var(--text-muted) !important; border:1px solid var(--border) !important; border-radius:4px !important; transition:all 0.15s !important; }
  .detail-actions button:hover { border-color:var(--text-dim) !important; color:var(--text) !important; }
  .detail-actions button.btn-danger:hover { background:var(--danger) !important; color:#fff !important; border-color:var(--danger) !important; }
  .detail-actions .btn-copy:hover { background:var(--accent) !important; color:#fff !important; border-color:var(--accent) !important; }
  .phase-tag { background:transparent !important; border:1px solid !important; }
  .phase-p1 { border-color:#58a6ff55 !important; }
  .phase-p2 { border-color:#d2a8ff55 !important; }
  .phase-p3 { border-color:#8b949e55 !important; }
  .phase-p4 { border-color:#ffa65755 !important; }
  .status-tag { font-size:10px; padding:1px 6px; border-radius:10px; font-weight:600; display:inline-flex; align-items:center; gap:4px; background:transparent; letter-spacing:0.3px; }
  .status-tag::before { content:""; width:6px; height:6px; border-radius:50%; background:currentColor; flex-shrink:0; }
  .copy-cmd-btn { display:none !important; }
  .card-menu { position:relative; }
  .card-menu-dropdown { display:none; position:absolute; top:100%; right:0; margin-top:4px; background:var(--surface); border:1px solid var(--border); border-radius:6px; padding:2px 0; min-width:80px; z-index:100; box-shadow:0 4px 12px rgba(0,0,0,0.4); }
  .card-menu-dropdown.open { display:block; }
  .card-menu-dropdown button { display:flex; align-items:center; gap:6px; width:100% !important; padding:5px 10px !important; background:none !important; border:none !important; color:var(--text-dim); font-size:12px; cursor:pointer; transition:all 0.1s; font-family:inherit; height:auto !important; border-radius:0 !important; justify-content:flex-start !important; white-space:nowrap; }
  .card-menu-dropdown button:hover { background:var(--surface-hover,#1c2333); color:var(--text,#e6edf3); }
  .card-menu-dropdown .menu-delete:hover { color:var(--danger,#f85149) !important; background:var(--danger-bg,rgba(248,81,73,0.1)) !important; }
</style>
<script>
(function(){
  var NEXT = {TODO:"define",DEF:"build",BLT:"test",TST:"refactor"};
  var prefix = (window.data && window.data.source && window.data.source.startsWith("/game")) ? "game" : "dev";
  // Patch createCard: replace old buttons with hamburger menu
  var origCreate = window.createCard;
  if (origCreate) {
    window.createCard = function(f) {
      var card = origCreate(f);
      var old = card.querySelector(".copy-cmd-btn");
      if (old) old.remove();
      var actions = card.querySelector(".card-actions");
      if (actions && !actions.querySelector(".card-menu")) {
        // Remove old buttons
        actions.querySelectorAll(".detail-btn, .delete-btn, .edit-btn").forEach(function(b) { b.remove(); });
        // Add hamburger menu
        var menu = document.createElement("div");
        menu.className = "card-menu";
        menu.innerHTML = '<button class="menu-btn" title="Menu">\u2630</button><div class="card-menu-dropdown"><button class="menu-details">Details</button><button class="menu-delete">Verwijder</button></div>';
        actions.appendChild(menu);
        menu.querySelector(".menu-btn").addEventListener("click", function(e) {
          e.stopPropagation();
          var dd = menu.querySelector(".card-menu-dropdown");
          document.querySelectorAll(".card-menu-dropdown.open").forEach(function(d) { if (d !== dd) d.classList.remove("open"); });
          dd.classList.toggle("open");
        });
        menu.querySelector(".menu-details").addEventListener("click", function(e) {
          e.stopPropagation();
          menu.querySelector(".card-menu-dropdown").classList.remove("open");
          openDetailModal(f.name);
        });
        menu.querySelector(".menu-delete").addEventListener("click", function(e) {
          e.stopPropagation();
          menu.querySelector(".card-menu-dropdown").classList.remove("open");
          openDeleteModal(f.name);
        });
      }
      return card;
    };
  }
  // Close menus on outside click
  document.addEventListener("click", function() {
    document.querySelectorAll(".card-menu-dropdown.open").forEach(function(d) { d.classList.remove("open"); });
  });
  // Capture card clicks: copy command instead of opening modal
  document.addEventListener("click", function(e) {
    var card = e.target.closest(".card");
    if (!card || e.target.closest("button")) return;
    var name = card.dataset.name;
    if (!name || !window.findItem) return;
    var found = window.findItem(name);
    if (!found) return;
    var verb = NEXT[found.item.status];
    if (verb) {
      e.stopImmediatePropagation();
      var cmd = "/" + prefix + "-" + verb + " " + found.item.name;
      navigator.clipboard.writeText(cmd).then(function() { toast("Gekopieerd: " + cmd); });
    }
  }, true);
  // Patch detail modal: hide promote, add copy button, make buttons compact with text
  var promoteBtn = document.getElementById("detail-promote");
  if (promoteBtn) promoteBtn.style.display = "none";
  var copySvg = '<svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="5" y="5" width="9" height="9" rx="1.5"/><path d="M5 11H3.5A1.5 1.5 0 012 9.5v-7A1.5 1.5 0 013.5 1h7A1.5 1.5 0 0112 2.5V5"/></svg>';
  var detailActions = document.querySelector("#detail-modal .detail-actions");
  if (detailActions) {
    detailActions.querySelectorAll("button").forEach(function(b) {
      if (b.id === "detail-edit" || b.textContent.match(/bewerk/i)) { b.innerHTML = "\u270E Bewerk"; b.title = "Bewerken"; }
      if (b.id === "detail-delete" || b.textContent.match(/verwijder/i)) { b.innerHTML = "\u2715 Verwijder"; b.title = "Verwijderen"; b.className = "btn-danger"; }
      if (b.classList.contains("btn-cancel") || b.textContent.match(/sluit/i)) b.remove();
    });
  }
  if (detailActions && !document.getElementById("detail-copy")) {
    var copyBtn = document.createElement("button");
    copyBtn.id = "detail-copy";
    copyBtn.className = "btn-copy";
    copyBtn.innerHTML = copySvg + " Kopieer";
    copyBtn.style.display = "none";
    detailActions.insertBefore(copyBtn, detailActions.firstChild);
    copyBtn.addEventListener("click", function() {
      var cmd = copyBtn.dataset.cmd;
      if (cmd) navigator.clipboard.writeText(cmd).then(function() { toast("Gekopieerd: " + cmd); });
    });
  }
  // Patch openDetailModal to populate copy button
  var origOpen = window.openDetailModal;
  if (origOpen) {
    window.openDetailModal = function(name) {
      origOpen(name);
      var found = window.findItem(name);
      if (!found) return;
      var verb = NEXT[found.item.status];
      var cb = document.getElementById("detail-copy");
      if (cb) {
        if (verb) {
          var cmd = "/" + prefix + "-" + verb + " " + found.item.name;
          cb.innerHTML = '<svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="5" y="5" width="9" height="9" rx="1.5"/><path d="M5 11H3.5A1.5 1.5 0 012 9.5v-7A1.5 1.5 0 013.5 1h7A1.5 1.5 0 0112 2.5V5"/></svg> Kopieer';
          cb.title = cmd;
          cb.dataset.cmd = cmd;
          cb.style.display = "";
        } else {
          cb.style.display = "none";
        }
      }
    };
  }
  if (window.render) render();
})();
</script>
<script>
(function(){
  var base = location.pathname.replace(/\\/backlog\\/?$/, "");
  var es = new EventSource(base + "/events");
  es.onmessage = function(e) {
    if (e.data !== "backlog") return;
    var modal = document.getElementById("detail-modal");
    if (modal && modal.classList.contains("visible")) return;
    fetch(base + "/backlog/data").then(function(r){ return r.json(); }).then(function(newData) {
      if (JSON.stringify(newData) === JSON.stringify(data)) return;
      data = newData;
      render();
      toast("Backlog bijgewerkt");
    }).catch(function(){});
  };
})();
</script>`;
          html = html.replace("</body>", backlogPatch + nav + "</body>");
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
        let body = "";
        req.on("data", (chunk) => (body += chunk));
        req.on("end", () => {
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

      // Feature detail (all JSON files for a feature)
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

        const result = { name: featureName };

        // Read define.json
        const defineJson = path.join(featurePath, "define.json");
        if (fs.existsSync(defineJson)) {
          try {
            result.define = JSON.parse(fs.readFileSync(defineJson, "utf8"));
          } catch {}
        }

        // Read build.json
        const buildJson = path.join(featurePath, "build.json");
        if (fs.existsSync(buildJson)) {
          try {
            result.build = JSON.parse(fs.readFileSync(buildJson, "utf8"));
          } catch {}
        }

        // Read test.json
        const testJson = path.join(featurePath, "test.json");
        if (fs.existsSync(testJson)) {
          try {
            result.test = JSON.parse(fs.readFileSync(testJson, "utf8"));
          } catch {}
        }

        // Read refactor.json
        const refactorJson = path.join(featurePath, "refactor.json");
        if (fs.existsSync(refactorJson)) {
          try {
            result.refactor = JSON.parse(fs.readFileSync(refactorJson, "utf8"));
          } catch {}
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
            `VSCODE_IPC_HOOK_CLI="${ipcSock}" "${codeCliGlob}" "${filePath}"`,
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
  .listen(PORT, () => {
    console.log(`\nProjects: http://localhost:${PORT}`);
    console.log(`Scanning: ${PROJECTS_ROOT}/*/`);
    console.log(`  Backlog:   ${BACKLOG_PATH}`);
    console.log(`  Dashboard: ${DASHBOARD_PATH}\n`);
  });
