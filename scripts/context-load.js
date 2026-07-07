#!/usr/bin/env node
// PHASE 0 read-only context loader — extracts the fields dev-ship/game-ship
// actually need from .project/{project,project-context,features/*/feature}.json
// without loading the full files into context. Replaces the inline `node -e`
// snippets duplicated across shared/PROJECT-CONTEXT-LOAD.md, FEATURE-LOAD.md,
// GAME-CONTEXT-LOAD.md, GAME-FEATURE-LOAD.md — those docs are now thin
// pointers to this script; see them for the field-by-field rationale.
//
// Usage: node scripts/context-load.js <repo-root> <profile> [feature-name]
//
// Profiles:
//   build / define / verify                    — dev project.json + project-context.json
//   feature-build / feature-verify              — dev feature.json (feature-name required)
//   game-define / game-build / game-verify      — game project.json + project-context.json
//   game-feature-build / game-feature-verify    — game feature.json (feature-name required)
//
// "define" and "game-define" require <feature-name> (used to filter `thinking[]`).
// "feature-*" and "game-feature-*" always require <feature-name>.
//
// Output: one JSON object on stdout. Two-file profiles nest under `project` /
// `projectContext` (either `null` if the source file is absent). Feature
// profiles return `{ present: false }` if feature.json is absent, else the
// extracted fields spread at the top level.
//
// Exit 0 = always, once args are valid (missing files are a normal, expected
// degradation — not a script error). Exit 2 = usage error / unknown profile.

import { readFileSync } from "node:fs";
import { join } from "node:path";

const [repoRoot, profile, featureName] = process.argv.slice(2);

function usageError(msg) {
  console.error(`context-load: ${msg}`);
  console.error(
    "Usage: node scripts/context-load.js <repo-root> <profile> [feature-name]",
  );
  process.exit(2);
}

if (!repoRoot || !profile) usageError("missing <repo-root> or <profile>");

function loadJson(path) {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return null;
  }
}

// Mirrors BACKLOG-LOAD.md / GAME-BACKLOG-LOAD.md: canonical backlog.json
// first, legacy backlog.html fallback (pre scripts/migrate-project.py).
// Duplicated in backlog-load.js — both scripts are standalone CLIs, no
// shared lib module in scripts/ by convention.
function loadBacklogFeatures(repoRoot) {
  const jsonPath = join(repoRoot, ".project", "backlog.json");
  const data = loadJson(jsonPath);
  if (data) return data.features || [];
  try {
    const html = readFileSync(
      join(repoRoot, ".project", "backlog.html"),
      "utf8",
    );
    const m = html.match(/<script id="backlog-data"[^>]*>([\s\S]*?)<\/script>/);
    if (m) return JSON.parse(m[1]).features || [];
  } catch {
    // no legacy file either — fall through
  }
  return [];
}

function loadFeatureJson(repoRoot, feat) {
  if (!feat) usageError(`profile "${profile}" requires <feature-name>`);
  return loadJson(join(repoRoot, ".project", "features", feat, "feature.json"));
}

function emit(obj) {
  console.log(JSON.stringify(obj));
}

const projectPath = join(repoRoot, ".project", "project.json");
const contextPath = join(repoRoot, ".project", "project-context.json");

switch (profile) {
  case "build": {
    const p = loadJson(projectPath);
    const c = loadJson(contextPath);
    emit({
      project: p && {
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
      },
      projectContext: c && {
        structure: c.context?.structure || null,
        routing: c.context?.routing || null,
        patterns: (c.context?.patterns || []).slice(0, 15),
        componentsCount: (c.architecture?.components || []).length,
      },
    });
    break;
  }

  case "define": {
    if (!featureName) usageError('profile "define" requires <feature-name>');
    const p = loadJson(projectPath);
    const c = loadJson(contextPath);
    const features = loadBacklogFeatures(repoRoot);
    emit({
      project: p && {
        stack: p.stack,
        pitch: p.seed?.pitch || (p.seed?.content || "").slice(0, 240),
        features: features.map((x) => ({
          name: x.name,
          status: x.status,
          summary: x.summary || x.description,
        })),
        endpoints: (p.endpoints || []).map((e) => ({
          method: e.method,
          path: e.path,
        })),
        entities: (p.data?.entities || []).map((e) => e.name),
        thinking: (p.thinking || []).filter(
          (t) => t.newFeature === featureName,
        ),
        designComponents: (p.design?.components || []).map((c) => c.name),
        designPages: (p.design?.pages || []).map((pg) => pg.name),
      },
      projectContext: c && {
        patterns: (c.context?.patterns || []).slice(0, 15),
        components: (c.architecture?.components || []).map((x) => ({
          name: x.name,
          description: x.description,
          feature: x.feature,
        })),
      },
    });
    break;
  }

  case "verify": {
    const p = loadJson(projectPath);
    const c = loadJson(contextPath);
    emit({
      project: p && {
        stack: p.stack || null,
        endpoints: (p.endpoints || []).map((e) => ({
          method: e.method,
          path: e.path,
          auth: e.auth,
        })),
        entities: (p.data?.entities || []).map((e) => e.name),
      },
      projectContext: c && {
        structure: c.context?.structure || null,
        routing: c.context?.routing || null,
        patterns: (c.context?.patterns || []).slice(0, 15),
        components: (c.architecture?.components || []).map((x) => x.name),
      },
    });
    break;
  }

  case "feature-build": {
    const f = loadFeatureJson(repoRoot, featureName);
    if (!f) {
      emit({ present: false });
      break;
    }
    emit({
      present: true,
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
      research: f.research || null,
    });
    break;
  }

  case "feature-verify": {
    const f = loadFeatureJson(repoRoot, featureName);
    if (!f) {
      emit({ present: false });
      break;
    }
    emit({
      present: true,
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
    });
    break;
  }

  case "game-define": {
    if (!featureName)
      usageError('profile "game-define" requires <feature-name>');
    const p = loadJson(projectPath);
    const c = loadJson(contextPath);
    const features = loadBacklogFeatures(repoRoot);
    emit({
      project: p && {
        stack: p.stack || null,
        pitch: p.seed?.pitch || (p.seed?.content || "").slice(0, 240),
        features: features.map((x) => ({
          name: x.name,
          status: x.status,
          summary: x.summary || x.description,
        })),
        entities: (p.data?.entities || []).map((e) =>
          typeof e === "string" ? e : e.name,
        ),
        thinking: (p.thinking || []).filter(
          (t) => t.newFeature === featureName,
        ),
      },
      projectContext: c && {
        patterns: (c.context?.patterns || []).slice(0, 15),
        architecture: c.architecture || null,
      },
    });
    break;
  }

  case "game-build": {
    const p = loadJson(projectPath);
    const c = loadJson(contextPath);
    emit({
      project: p && {
        stack: p.stack || null,
        entities: (p.data?.entities || []).map((e) =>
          typeof e === "string" ? e : e.name,
        ),
      },
      projectContext: c && {
        structure: c.context?.structure || null,
        patterns: (c.context?.patterns || []).slice(0, 15),
        architecture: c.architecture || null,
      },
    });
    break;
  }

  case "game-verify": {
    const p = loadJson(projectPath);
    const c = loadJson(contextPath);
    emit({
      project: p && {
        stack: p.stack || null,
        entities: (p.data?.entities || []).map((e) =>
          typeof e === "string" ? e : e.name,
        ),
      },
      projectContext: c && {
        structure: c.context?.structure || null,
        routing: c.context?.routing ?? null,
        patterns: (c.context?.patterns || []).slice(0, 15),
        architecture: c.architecture || null,
      },
    });
    break;
  }

  case "game-feature-build": {
    const f = loadFeatureJson(repoRoot, featureName);
    if (!f) {
      emit({ present: false });
      break;
    }
    emit({
      present: true,
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
      research: f.research || null,
    });
    break;
  }

  case "game-feature-verify": {
    const f = loadFeatureJson(repoRoot, featureName);
    if (!f) {
      emit({ present: false });
      break;
    }
    emit({
      present: true,
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
    });
    break;
  }

  default:
    usageError(
      `unknown profile "${profile}" — expected one of: build, define, verify, feature-build, feature-verify, game-define, game-build, game-verify, game-feature-build, game-feature-verify`,
    );
}
