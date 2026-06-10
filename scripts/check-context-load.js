#!/usr/bin/env node
/**
 * Guard script: validates that all context-load helper profiles extract
 * the expected keys from the fixture files in scripts/fixtures/.
 *
 * Run: node scripts/check-context-load.js
 * Exit 0 = all profiles OK. Exit 1 = one or more failures.
 *
 * Add to release checklist alongside check-handoff.py and check-dashboard-writers.py.
 */

"use strict";

const path = require("path");
const fs = require("fs");

const FIXTURES = path.join(__dirname, "fixtures");
const FEAT = "fixture-feature";

// Backlog store loader — mirrors BACKLOG-LOAD.md / GAME-BACKLOG-LOAD.md:
// canonical .project/backlog.json first, legacy backlog.html fallback.
function loadBacklogData(jsonFixture, htmlFixture) {
  const jp = path.join(FIXTURES, jsonFixture);
  if (fs.existsSync(jp)) return JSON.parse(fs.readFileSync(jp, "utf8"));
  const html = fs.readFileSync(path.join(FIXTURES, htmlFixture), "utf8");
  const m = html.match(/<script id="backlog-data"[^>]*>([\s\S]*?)<\/script>/);
  if (!m) throw new Error("no backlog-data script tag found");
  return JSON.parse(m[1]);
}

// Legacy-only loader — used to assert the fallback path keeps working on
// pre-migration projects.
function loadLegacyBacklogData(htmlFixture) {
  const html = fs.readFileSync(path.join(FIXTURES, htmlFixture), "utf8");
  const m = html.match(/<script id="backlog-data"[^>]*>([\s\S]*?)<\/script>/);
  if (!m) throw new Error("no backlog-data script tag found");
  return JSON.parse(m[1]);
}

let passed = 0;
let failed = 0;

function ok(label) {
  console.log(`OK   ${label}`);
  passed++;
}

function fail(label, reason) {
  console.error(`FAIL ${label}: ${reason}`);
  failed++;
}

function checkKeys(label, obj, requiredKeys) {
  const missing = requiredKeys.filter((k) => obj[k] === undefined);
  if (missing.length) {
    fail(label, `missing keys: ${missing.join(", ")}`);
  } else {
    ok(label);
  }
}

function run(label, fn, requiredKeys) {
  try {
    const result = fn();
    if (result === null || typeof result !== "object") {
      fail(label, `expected object, got ${typeof result}`);
      return;
    }
    checkKeys(label, result, requiredKeys);
  } catch (e) {
    fail(label, `threw: ${e.message}`);
  }
}

// ─── PROJECT-CONTEXT-LOAD: build profile ──────────────────────────────────────

run(
  "PROJECT-CONTEXT-LOAD / build / project.json",
  () => {
    const p = require(path.join(FIXTURES, "project.json"));
    return {
      stack: p.stack || null,
      endpoints: (p.endpoints || []).map((e) => ({
        method: e.method,
        path: e.path,
        auth: e.auth,
      })),
      entities: (p.data?.entities || []).map((e) => e.name),
      themeColors: p.theme?.colors || [],
      themeMotionPack: p.theme?.motion?.pack || null,
      themeCssVarsEmpty: !p.theme?.cssVars || p.theme.cssVars.trim() === "",
    };
  },
  [
    "stack",
    "endpoints",
    "entities",
    "themeColors",
    "themeMotionPack",
    "themeCssVarsEmpty",
  ],
);

run(
  "PROJECT-CONTEXT-LOAD / build / project-context.json",
  () => {
    const c = require(path.join(FIXTURES, "project-context.json"));
    return {
      structure: c.context?.structure || null,
      routing: c.context?.routing || null,
      patterns: (c.context?.patterns || []).slice(0, 15),
      componentsCount: (c.architecture?.components || []).length,
    };
  },
  ["structure", "routing", "patterns", "componentsCount"],
);

// ─── PROJECT-CONTEXT-LOAD: define profile ─────────────────────────────────────

run(
  "PROJECT-CONTEXT-LOAD / define / project.json",
  () => {
    const p = require(path.join(FIXTURES, "project.json"));
    const f = FEAT;
    return {
      stack: p.stack,
      pitch: p.seed?.pitch || (p.seed?.content || "").slice(0, 240),
      // Feature list now comes from the backlog store (single source of truth)
      features: (
        loadBacklogData("backlog.json", "backlog.html").features || []
      ).map((x) => ({
        name: x.name,
        status: x.status,
        summary: x.summary || x.description,
      })),
      endpoints: (p.endpoints || []).map((e) => ({
        method: e.method,
        path: e.path,
      })),
      entities: (p.data?.entities || []).map((e) => e.name),
      thinking: (p.thinking || []).filter((t) => t.newFeature === f),
      designComponents: (p.design?.components || []).map((c) => c.name),
      designPages: (p.design?.pages || []).map((pg) => pg.name),
    };
  },
  [
    "stack",
    "pitch",
    "features",
    "endpoints",
    "entities",
    "thinking",
    "designComponents",
    "designPages",
  ],
);

run(
  "PROJECT-CONTEXT-LOAD / define / project-context.json",
  () => {
    const c = require(path.join(FIXTURES, "project-context.json"));
    return {
      patterns: (c.context?.patterns || []).slice(0, 15),
      components: (c.architecture?.components || []).map((x) => ({
        name: x.name,
        description: x.description,
        feature: x.feature,
      })),
    };
  },
  ["patterns", "components"],
);

// ─── PROJECT-CONTEXT-LOAD: verify profile ─────────────────────────────────────

run(
  "PROJECT-CONTEXT-LOAD / verify / project.json",
  () => {
    const p = require(path.join(FIXTURES, "project.json"));
    return {
      stack: p.stack || null,
      endpoints: (p.endpoints || []).map((e) => ({
        method: e.method,
        path: e.path,
        auth: e.auth,
      })),
      entities: (p.data?.entities || []).map((e) => e.name),
    };
  },
  ["stack", "endpoints", "entities"],
);

run(
  "PROJECT-CONTEXT-LOAD / verify / project-context.json",
  () => {
    const c = require(path.join(FIXTURES, "project-context.json"));
    return {
      structure: c.context?.structure || null,
      routing: c.context?.routing || null,
      patterns: (c.context?.patterns || []).slice(0, 15),
      components: (c.architecture?.components || []).map((x) => x.name),
    };
  },
  ["structure", "routing", "patterns", "components"],
);

// ─── BACKLOG-LOAD: read-feature profile ───────────────────────────────────────

run(
  "BACKLOG-LOAD / read-feature",
  () => {
    const data = loadBacklogData("backlog.json", "backlog.html");
    const feat = (data.features || []).find((f) => f.name === FEAT);
    if (!feat) throw new Error(`feature "${FEAT}" not found in backlog`);
    return {
      name: feat.name,
      type: feat.type,
      status: feat.status,
      risk: feat.risk ?? null,
      dependencies: feat.dependencies || [],
      externalRef: feat.externalRef || null,
      transition: feat.transition || null,
      pageHint: feat.pageHint || [],
    };
  },
  [
    "name",
    "type",
    "status",
    "risk",
    "dependencies",
    "externalRef",
    "transition",
    "pageHint",
  ],
);

// ─── BACKLOG-LOAD: ready-queue profile ────────────────────────────────────────

run(
  "BACKLOG-LOAD / ready-queue",
  () => {
    const data = loadBacklogData("backlog.json", "backlog.html");
    const doneNames = new Set(
      (data.features || [])
        .filter((f) => f.status === "DONE")
        .map((f) => f.name),
    );
    const result = (data.features || [])
      .filter((f) => f.status === "DEFINED")
      .map((f) => ({
        name: f.name,
        status: f.status,
        phase: f.phase,
        dependencies: f.dependencies || [],
        ready: (f.dependencies || []).every((d) => doneNames.has(d)),
        blocking: (f.dependencies || []).filter((d) => !doneNames.has(d)),
      }));
    // Validate item shape of the first entry (if any)
    if (result.length > 0) {
      const item = result[0];
      const itemKeys = [
        "name",
        "status",
        "phase",
        "dependencies",
        "ready",
        "blocking",
      ];
      const missing = itemKeys.filter((k) => item[k] === undefined);
      if (missing.length) {
        throw new Error(`ready-queue item missing keys: ${missing.join(", ")}`);
      }
    }
    return { queue: result };
  },
  ["queue"],
);

// ─── FEATURE-LOAD: build profile ──────────────────────────────────────────────

run(
  "FEATURE-LOAD / build",
  () => {
    const f = require(path.join(FIXTURES, "feature.json"));
    return {
      type: f.type || "FEATURE",
      hasUI: f.hasUI ?? false,
      requirements: (f.requirements || []).map((r) => ({
        id: r.id,
        description: r.description,
        acceptance: r.acceptance,
        errorScenarios: r.errorScenarios,
        deltaOp: r.deltaOp,
      })),
      buildSequence: f.buildSequence || [],
      files: (f.files || []).map((x) => ({ path: x.path, action: x.action })),
      testStrategy: f.testStrategy || [],
      architecture: {
        registries: f.architecture?.registries || [],
        interfaces: f.architecture?.interfaces || null,
        scope: f.architecture?.scope || null,
      },
      clarifications: f.clarifications || [],
      blockers: f.build?.blockers || [],
    };
  },
  [
    "type",
    "hasUI",
    "requirements",
    "buildSequence",
    "files",
    "testStrategy",
    "architecture",
    "clarifications",
    "blockers",
  ],
);

// ─── FEATURE-LOAD: verify profile ─────────────────────────────────────────────

run(
  "FEATURE-LOAD / verify",
  () => {
    const f = require(path.join(FIXTURES, "feature.json"));
    return {
      type: f.type || "FEATURE",
      checklist: f.tests?.checklist || [],
      requirements: (f.requirements || []).map((r) => ({
        id: r.id,
        description: r.description,
        acceptance: r.acceptance,
        errorScenarios: r.errorScenarios,
        deltaOp: r.deltaOp,
        httpContractTested: r.httpContractTested,
      })),
      files: (f.files || []).map((x) => ({ path: x.path, action: x.action })),
      runCommand: f.build?.runCommand || null,
      design: f.design || null,
      apiContract: f.apiContract || null,
    };
  },
  [
    "type",
    "checklist",
    "requirements",
    "files",
    "runCommand",
    "design",
    "apiContract",
  ],
);

// ─── GAME-CONTEXT-LOAD: define profile ───────────────────────────────────────

const GAME_FEAT = "fixture-feature";

run(
  "GAME-CONTEXT-LOAD / define / game-project.json",
  () => {
    const p = require(path.join(FIXTURES, "game-project.json"));
    return {
      stack: p.stack || null,
      pitch: p.seed?.pitch || (p.seed?.content || "").slice(0, 240),
      // Feature list now comes from the backlog store (single source of truth)
      features: (
        loadBacklogData("game-backlog.json", "game-backlog.html").features || []
      ).map((x) => ({
        name: x.name,
        status: x.status,
        summary: x.summary || x.description,
      })),
      entities: (p.data?.entities || []).map((e) =>
        typeof e === "string" ? e : e.name,
      ),
      thinking: (p.thinking || []).filter((t) => t.newFeature === GAME_FEAT),
    };
  },
  ["stack", "pitch", "features", "entities", "thinking"],
);

run(
  "GAME-CONTEXT-LOAD / define / game-project-context.json",
  () => {
    const c = require(path.join(FIXTURES, "game-project-context.json"));
    return {
      patterns: (c.context?.patterns || []).slice(0, 15),
      architecture: c.architecture || null,
    };
  },
  ["patterns", "architecture"],
);

// ─── GAME-CONTEXT-LOAD: build profile ────────────────────────────────────────

run(
  "GAME-CONTEXT-LOAD / build / game-project.json",
  () => {
    const p = require(path.join(FIXTURES, "game-project.json"));
    return {
      stack: p.stack || null,
      entities: (p.data?.entities || []).map((e) =>
        typeof e === "string" ? e : e.name,
      ),
    };
  },
  ["stack", "entities"],
);

run(
  "GAME-CONTEXT-LOAD / build / game-project-context.json",
  () => {
    const c = require(path.join(FIXTURES, "game-project-context.json"));
    return {
      structure: c.context?.structure || null,
      patterns: (c.context?.patterns || []).slice(0, 15),
      architecture: c.architecture || null,
    };
  },
  ["structure", "patterns", "architecture"],
);

// ─── GAME-CONTEXT-LOAD: verify profile ───────────────────────────────────────

run(
  "GAME-CONTEXT-LOAD / verify / game-project.json",
  () => {
    const p = require(path.join(FIXTURES, "game-project.json"));
    return {
      stack: p.stack || null,
      entities: (p.data?.entities || []).map((e) =>
        typeof e === "string" ? e : e.name,
      ),
    };
  },
  ["stack", "entities"],
);

run(
  "GAME-CONTEXT-LOAD / verify / game-project-context.json",
  () => {
    const c = require(path.join(FIXTURES, "game-project-context.json"));
    return {
      structure: c.context?.structure || null,
      routing: c.context?.routing ?? null,
      patterns: (c.context?.patterns || []).slice(0, 15),
      architecture: c.architecture || null,
    };
  },
  ["structure", "routing", "patterns", "architecture"],
);

// ─── GAME-FEATURE-LOAD: build profile ────────────────────────────────────────

run(
  "GAME-FEATURE-LOAD / build",
  () => {
    const f = require(path.join(FIXTURES, "game-feature.json"));
    return {
      type: f.type || "FEATURE",
      requirements: (f.requirements || []).map((r) => ({
        id: r.id,
        description: r.description,
        acceptance: r.acceptance,
        errorScenarios: r.errorScenarios,
        tuningLevers: r.tuningLevers || null,
      })),
      buildSequence: f.buildSequence || [],
      files: (f.files || []).map((x) => ({ path: x.path, action: x.action })),
      testStrategy: f.testStrategy || [],
      architecture: f.architecture || null,
      design: f.design || null,
      clarifications: f.clarifications || [],
      blockers: f.build?.blockers || [],
    };
  },
  [
    "type",
    "requirements",
    "buildSequence",
    "files",
    "testStrategy",
    "architecture",
    "design",
    "clarifications",
    "blockers",
  ],
);

// ─── GAME-FEATURE-LOAD: verify profile ───────────────────────────────────────

run(
  "GAME-FEATURE-LOAD / verify",
  () => {
    const f = require(path.join(FIXTURES, "game-feature.json"));
    return {
      type: f.type || "FEATURE",
      checklist: f.tests?.checklist || [],
      requirements: (f.requirements || []).map((r) => ({
        id: r.id,
        description: r.description,
        acceptance: r.acceptance,
        errorScenarios: r.errorScenarios,
        tuningLevers: r.tuningLevers || null,
      })),
      files: (f.files || []).map((x) => ({ path: x.path, action: x.action })),
      design: f.design || null,
      build: f.build || null,
    };
  },
  ["type", "checklist", "requirements", "files", "design", "build"],
);

// ─── GAME-BACKLOG-LOAD: read-feature profile ──────────────────────────────────

run(
  "GAME-BACKLOG-LOAD / read-feature",
  () => {
    const data = loadBacklogData("game-backlog.json", "game-backlog.html");
    const feat = (data.features || []).find((f) => f.name === GAME_FEAT);
    if (!feat) throw new Error(`feature "${GAME_FEAT}" not found in backlog`);
    return {
      name: feat.name,
      type: feat.type,
      status: feat.status,
      stage: feat.stage || null,
      risk: feat.risk ?? null,
      dependencies: feat.dependencies || [],
      externalRef: feat.externalRef || null,
      transition: feat.transition || null,
      pageHint: feat.pageHint || [],
    };
  },
  [
    "name",
    "type",
    "status",
    "stage",
    "risk",
    "dependencies",
    "externalRef",
    "transition",
    "pageHint",
  ],
);

// ─── GAME-BACKLOG-LOAD: queue profile (status=DEFINED) ───────────────────────

run(
  "GAME-BACKLOG-LOAD / queue / DEFINED",
  () => {
    const data = loadBacklogData("game-backlog.json", "game-backlog.html");
    const status = "DEFINED";
    const transition = "";
    const doneNames = new Set(
      (data.features || [])
        .filter((f) => f.status === "DONE")
        .map((f) => f.name),
    );
    const result = (data.features || [])
      .filter(
        (f) =>
          f.status === status && (!transition || f.transition === transition),
      )
      .map((f) => ({
        name: f.name,
        status: f.status,
        stage: f.stage || null,
        phase: f.phase,
        dependencies: f.dependencies || [],
        transition: f.transition || null,
        ready:
          status === "DEFINED"
            ? (f.dependencies || []).every((d) => doneNames.has(d))
            : null,
        blocking:
          status === "DEFINED"
            ? (f.dependencies || []).filter((d) => !doneNames.has(d))
            : null,
      }));
    if (result.length > 0) {
      const item = result[0];
      const itemKeys = [
        "name",
        "status",
        "stage",
        "phase",
        "dependencies",
        "transition",
        "ready",
        "blocking",
      ];
      const missing = itemKeys.filter((k) => item[k] === undefined);
      if (missing.length) {
        throw new Error(`queue item missing keys: ${missing.join(", ")}`);
      }
    }
    return { queue: result };
  },
  ["queue"],
);

// ─── GAME-BACKLOG-LOAD: queue profile (status=DOING, transition=verifying) ───

run(
  "GAME-BACKLOG-LOAD / queue / DOING+verifying",
  () => {
    const data = loadBacklogData("game-backlog.json", "game-backlog.html");
    const status = "DOING";
    const transition = "verifying";
    const result = (data.features || [])
      .filter(
        (f) =>
          f.status === status && (!transition || f.transition === transition),
      )
      .map((f) => ({
        name: f.name,
        status: f.status,
        stage: f.stage || null,
        phase: f.phase,
        dependencies: f.dependencies || [],
        transition: f.transition || null,
        ready: null,
        blocking: null,
      }));
    if (result.length === 0)
      throw new Error("expected ≥1 DOING+verifying feature in fixture");
    return { queue: result };
  },
  ["queue"],
);

// ─── Legacy fallback: pre-migration backlog.html still readable ───────────────

run(
  "BACKLOG-LOAD / legacy backlog.html fallback",
  () => {
    const data = loadLegacyBacklogData("backlog.html");
    const feat = (data.features || []).find((f) => f.name === FEAT);
    if (!feat) throw new Error(`feature "${FEAT}" not found in legacy backlog`);
    return { name: feat.name, status: feat.status };
  },
  ["name", "status"],
);

// ─── Summary ──────────────────────────────────────────────────────────────────


console.log(`\nContext-load guard: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
