// Auto-populate empty dashboard sections from project files

const fs = require("fs");
const path = require("path");
const { PROJECTS_ROOT, DASHBOARD_PATH } = require("./config");

function populateFromProject(projectDir, dashData) {
  const projectPath = path.join(PROJECTS_ROOT, projectDir);
  var changed = false;

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
            dashData.stack.packages = autoloads.map(function ([, name]) {
              return {
                name,
                version: "",
                purpose: "autoload",
              };
            });
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

              var content = "";
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

        // Read feature data from feature.json
        function readFeatureData(fp) {
          const featureJson = path.join(fp, "feature.json");
          if (fs.existsSync(featureJson)) {
            try {
              return JSON.parse(fs.readFileSync(featureJson, "utf8"));
            } catch {}
          }
          return null;
        }

        // Promote status based on feature.json (migrates legacy DEF/BLT)
        function promoteStatus(s, fp) {
          if (fs.existsSync(path.join(fp, "feature.json"))) {
            try {
              const feat = JSON.parse(
                fs.readFileSync(path.join(fp, "feature.json"), "utf8"),
              );
              var st = feat.status || s;
              if (st === "DEF" || st === "BLT") st = "DOING";
              return st;
            } catch {}
          }
          return s;
        }

        // Update existing feature status, or add new
        const existing = dashData.features.find(function (f) {
          return f.name === featureName;
        });
        if (existing) {
          const promoted = promoteStatus(existing.status, featurePath);
          if (promoted !== existing.status) {
            existing.status = promoted;
            changed = true;
          }
          // Fill summary from feature data if missing
          if (!existing.summary) {
            const featData = readFeatureData(featurePath);
            if (featData && featData.summary) {
              existing.summary = featData.summary;
              changed = true;
            }
          }
          continue;
        }

        var status = "TODO";
        var summary = "";
        var created = "";
        var depends = [];

        const featData = readFeatureData(featurePath);
        if (featData) {
          status = featData.status || "DOING";
          summary = featData.summary || "";
          created = featData.created || "";
          depends = featData.depends || [];
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

module.exports = { populateFromProject };
