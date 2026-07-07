#!/usr/bin/env node
// PHASE 0 read-only backlog loader — extracts feature records from
// .project/backlog.json (legacy .project/backlog.html fallback) without
// loading the full store into context. Replaces the inline `node -e`
// snippets duplicated across shared/BACKLOG-LOAD.md and
// shared/GAME-BACKLOG-LOAD.md — those docs are now thin pointers to this
// script; see them for the field-by-field rationale.
//
// NOT for mutations — status/date/transition/audit writes use the full
// Read → mutate-in-memory → Write cycle documented in shared/BACKLOG.md.
//
// Usage:
//   node scripts/backlog-load.js <repo-root> read-feature <feature-name>
//   node scripts/backlog-load.js <repo-root> ready-queue
//   node scripts/backlog-load.js <repo-root> queue <status> [transition]
//   node scripts/backlog-load.js <repo-root> open-items <feature-name>
//   node scripts/backlog-load.js <repo-root> pages
//   node scripts/backlog-load.js <repo-root> game-read-feature <feature-name>
//   node scripts/backlog-load.js <repo-root> game-queue <status> [transition]
//
// Output: one JSON object on stdout. `read-feature`/`game-read-feature`
// return `{ present: false }` when the store or the feature is absent, else
// `{ present: true, ...fields }`. The queue/list profiles always return
// `{ items: [...] }` (possibly empty) plus `{ backlogPresent: false }` when
// the store itself is missing.
//
// Exit 0 = always, once args are valid. Exit 2 = usage error / unknown profile.

import { readFileSync } from "node:fs";
import { join } from "node:path";

const [repoRoot, profile, arg1, arg2] = process.argv.slice(2);

function usageError(msg) {
  console.error(`backlog-load: ${msg}`);
  console.error(
    "Usage: node scripts/backlog-load.js <repo-root> <profile> [args...]",
  );
  process.exit(2);
}

if (!repoRoot || !profile) usageError("missing <repo-root> or <profile>");

// Mirrors BACKLOG-LOAD.md / GAME-BACKLOG-LOAD.md: canonical backlog.json
// first, legacy backlog.html fallback (pre scripts/migrate-project.py).
// Duplicated in context-load.js — both scripts are standalone CLIs, no
// shared lib module in scripts/ by convention.
function loadBacklogData(repoRoot) {
  try {
    return JSON.parse(
      readFileSync(join(repoRoot, ".project", "backlog.json"), "utf8"),
    );
  } catch {
    // fall through to legacy
  }
  try {
    const html = readFileSync(
      join(repoRoot, ".project", "backlog.html"),
      "utf8",
    );
    const m = html.match(/<script id="backlog-data"[^>]*>([\s\S]*?)<\/script>/);
    if (m) return JSON.parse(m[1]);
  } catch {
    // no legacy file either
  }
  return null;
}

function emit(obj) {
  console.log(JSON.stringify(obj));
}

const data = loadBacklogData(repoRoot);
const features = data?.features || [];

switch (profile) {
  case "read-feature": {
    if (!arg1) usageError('profile "read-feature" requires <feature-name>');
    if (!data) {
      emit({ present: false });
      break;
    }
    const feat = features.find((f) => f.name === arg1);
    if (!feat) {
      emit({ present: false });
      break;
    }
    emit({
      present: true,
      name: feat.name,
      type: feat.type,
      status: feat.status,
      description: feat.description || null,
      risk: feat.risk ?? null,
      dependencies: feat.dependencies || [],
      externalRef: feat.externalRef || null,
      transition: feat.transition || null,
      pageHint: feat.pageHint || [],
    });
    break;
  }

  case "queue": {
    if (!arg1) usageError('profile "queue" requires <status>');
    const status = arg1;
    const transition = arg2 || "";
    if (!data) {
      emit({ backlogPresent: false, items: [] });
      break;
    }
    const doneNames = new Set(
      features.filter((f) => f.status === "DONE").map((f) => f.name),
    );
    const items = features
      .filter(
        (f) =>
          f.status === status && (!transition || f.transition === transition),
      )
      .map((f) => ({
        name: f.name,
        status: f.status,
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
    emit({ backlogPresent: true, items });
    break;
  }

  case "ready-queue": {
    if (!data) {
      emit({ backlogPresent: false, items: [] });
      break;
    }
    const doneNames = new Set(
      features.filter((f) => f.status === "DONE").map((f) => f.name),
    );
    const items = features
      .filter((f) => f.status === "DEFINED")
      .map((f) => ({
        name: f.name,
        status: f.status,
        phase: f.phase,
        dependencies: f.dependencies || [],
        ready: (f.dependencies || []).every((d) => doneNames.has(d)),
        blocking: (f.dependencies || []).filter((d) => !doneNames.has(d)),
      }));
    emit({ backlogPresent: true, items });
    break;
  }

  case "open-items": {
    if (!arg1) usageError('profile "open-items" requires <feature-name>');
    if (!data) {
      emit({ backlogPresent: false, items: [] });
      break;
    }
    const items = features
      .filter(
        (f) =>
          f.name !== arg1 &&
          (f.status === "TODO" || f.status === "DEFINED") &&
          f.type !== "PAGE" &&
          f.type !== "COMPONENT" &&
          f.type !== "THEME",
      )
      .map((f) => ({
        name: f.name,
        type: f.type,
        status: f.status,
        description: f.description || null,
        dependencies: f.dependencies || [],
        externalRef: f.externalRef
          ? f.externalRef.type + "#" + f.externalRef.id
          : null,
      }));
    emit({ backlogPresent: true, items });
    break;
  }

  case "pages": {
    if (!data) {
      emit({ backlogPresent: false, items: [] });
      break;
    }
    const items = features
      .filter((f) => f.type === "PAGE")
      .map((f) => ({
        name: f.name,
        status: f.status,
        pageHint: f.pageHint || [],
      }));
    emit({ backlogPresent: true, items });
    break;
  }

  case "game-read-feature": {
    if (!arg1)
      usageError('profile "game-read-feature" requires <feature-name>');
    if (!data) {
      emit({ present: false });
      break;
    }
    const feat = features.find((f) => f.name === arg1);
    if (!feat) {
      emit({ present: false });
      break;
    }
    emit({
      present: true,
      name: feat.name,
      type: feat.type,
      status: feat.status,
      stage: feat.stage || null,
      description: feat.description || null,
      risk: feat.risk ?? null,
      dependencies: feat.dependencies || [],
      externalRef: feat.externalRef || null,
      transition: feat.transition || null,
      pageHint: feat.pageHint || [],
    });
    break;
  }

  case "game-queue": {
    if (!arg1) usageError('profile "game-queue" requires <status>');
    const status = arg1;
    const transition = arg2 || "";
    if (!data) {
      emit({ backlogPresent: false, items: [] });
      break;
    }
    const doneNames = new Set(
      features.filter((f) => f.status === "DONE").map((f) => f.name),
    );
    const items = features
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
    emit({ backlogPresent: true, items });
    break;
  }

  default:
    usageError(
      `unknown profile "${profile}" — expected one of: read-feature, ready-queue, queue, open-items, pages, game-read-feature, game-queue`,
    );
}
