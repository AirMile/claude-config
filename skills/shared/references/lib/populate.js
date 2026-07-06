// Auto-populate empty dashboard sections from project files.
//
// IN-MEMORY ONLY: this enriches the served dashboard response and never
// writes project.json. Canonical stores: project-context.json (architecture,
// context, learnings), backlog.json (features), seed .md file (seed.content).
// The dashboard-save endpoint (serve-backlog.js) strips these derived fields
// before persisting.

const fs = require("fs");
const path = require("path");
const { PROJECTS_ROOT } = require("./config");
const { readBacklogData, mergeArchivedFeatures } = require("./projects");

function populateFromProject(projectDir, dashData) {
  const projectPath = path.join(PROJECTS_ROOT, projectDir);

  // ── Seed: load from seedFile ──
  if (!dashData.seed?.content && dashData.seed?.seedFile) {
    const seedPath = path.join(projectPath, ".project", dashData.seed.seedFile);
    if (fs.existsSync(seedPath)) {
      try {
        const md = fs.readFileSync(seedPath, "utf8");
        if (!dashData.seed) dashData.seed = {};
        const titleMatch = md.match(/^#\s+(.+)$/m);
        if (titleMatch && !dashData.seed.name)
          dashData.seed.name = titleMatch[1].trim();
        dashData.seed.content = md;
      } catch {}
    }
  }

  // ── Context + Architecture: load from project-context.json ──
  const contextJsonFile = path.join(
    projectPath,
    ".project/project-context.json",
  );
  if (
    !fs.existsSync(contextJsonFile) &&
    fs.existsSync(path.join(projectPath, ".project"))
  ) {
    try {
      fs.writeFileSync(
        contextJsonFile,
        JSON.stringify(
          {
            schemaVersion: 2,
            architecture: {
              routes: [],
              components: [],
              endpoints: [],
              entities: [],
              diagram: "",
              dataFlow: "",
            },
            context: { structure: "", routing: [], patterns: [] },
            learnings: [],
          },
          null,
          2,
        ),
        "utf8",
      );
    } catch {}
  }
  if (fs.existsSync(contextJsonFile)) {
    try {
      const ctx = JSON.parse(fs.readFileSync(contextJsonFile, "utf8"));

      // Prefer separate .mmd file for diagram (plain Mermaid, no JSON escaping)
      const diagramFile = path.join(projectPath, ".project/architecture.mmd");
      if (fs.existsSync(diagramFile)) {
        try {
          const diagram = fs.readFileSync(diagramFile, "utf8").trim();
          if (diagram) {
            if (!ctx.architecture) ctx.architecture = {};
            ctx.architecture.diagram = diagram;
          }
        } catch {}
      }

      // Always prefer the canonical project-context.json copies — project.json
      // may still carry stale pre-migration duplicates of these fields.
      if (ctx.architecture) dashData.architecture = ctx.architecture;
      if (ctx.context) dashData.context = ctx.context;
      if (ctx.learnings) dashData.learnings = ctx.learnings;
    } catch {}
  }

  // ── Archived learnings: consolidation cold-storage, still browsable ──
  // .project/archive/learnings-{YYYY-MM}.json — excluded from the active list but
  // shown collapsed in the Knowledge tab so nothing is truly invisible.
  const archiveDir = path.join(projectPath, ".project/archive");
  if (fs.existsSync(archiveDir)) {
    const archived = [];
    try {
      for (const f of fs.readdirSync(archiveDir)) {
        if (!/^learnings-.*\.json$/.test(f)) continue;
        try {
          const data = JSON.parse(
            fs.readFileSync(path.join(archiveDir, f), "utf8"),
          );
          for (const e of data.archived || [])
            archived.push({ ...e, archivedIn: f });
        } catch {}
      }
    } catch {}
    if (archived.length) dashData.learningsArchive = archived;
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
          if (nameMatch && dashData.seed && !dashData.seed.name) {
            dashData.seed.name = nameMatch[1];
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
            } catch {}
          }
        }
      }
    }
  }

  // ── Features: derived view from the backlog store (in-memory only) ──
  // The backlog is the single feature list; project.json no longer carries a
  // persisted features[] copy. Shipped dev-track features live in the archive
  // (.project/archive/backlog-archive.json) and are merged back in for the
  // dashboard shipped-showcase. Map backlog fields to what the dashboard
  // template renders (summary, depends).
  const backlogData = readBacklogData(projectPath);
  const featureView = mergeArchivedFeatures(
    projectPath,
    backlogData && Array.isArray(backlogData.features)
      ? backlogData.features
      : [],
  );
  if (featureView.length || backlogData) {
    dashData.features = featureView.map(function (f) {
      return Object.assign({}, f, {
        summary: f.summary || f.description || "",
        depends: f.depends || f.dependencies || [],
      });
    });
  }

  // ── Theme: resolve cssVars path → CSS content (in-memory only, path stays in project.json) ──
  if (
    dashData.theme &&
    typeof dashData.theme.cssVars === "string" &&
    /\.css$/.test(dashData.theme.cssVars) &&
    !dashData.theme.cssVars.includes("\n")
  ) {
    const cssPath = path.resolve(projectPath, dashData.theme.cssVars);
    const sep = projectPath.endsWith(path.sep)
      ? projectPath
      : projectPath + path.sep;
    if (
      (cssPath.startsWith(sep) || cssPath === projectPath) &&
      fs.existsSync(cssPath)
    ) {
      try {
        dashData.theme = Object.assign({}, dashData.theme, {
          cssVars: fs.readFileSync(cssPath, "utf8"),
        });
      } catch {}
    }
  }

  return dashData;
}

module.exports = { populateFromProject };
