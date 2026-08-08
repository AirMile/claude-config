#!/usr/bin/env node
// Sync feature.json / backlog.json / project-context.json / project.json to
// DONE after a dev-verify or game-verify completion round — the "3-file sync"
// (dev-ship/references/dev-verify/references/completion-sync.md,
//  game-ship/references/game-verify/references/completion-finalize.md).
//
// WHY THIS SCRIPT EXISTS: the DONE-flip sync mutated three files by hand from
// ~50 lines of mutate-in-memory prose — derived fields (finalStatus, session
// pass/fail/skip counts) drifted between the dev and game docs, and the
// "verify may never write shipped/shippedAt/shippedSha" invariant (those keys
// belong exclusively to /dev-refactor — see shared/BACKLOG.md § Lifecycle
// Protocol) was only an assertion the model had to remember to run. This
// script computes every derived field itself and structurally never writes
// the forbidden keys; the model supplies only judgment (verdicts, evidence,
// free text). It resolves main-root the same way ship-checkpoint.js does, so
// it is also safe to call from dev-ship's cwd-in-worktree PHASE 3.
//
// Usage:
//   echo '<payload>' | node scripts/completion-sync.js sync <feature-name>
//
// Payload (see the reference docs above for full field meaning):
//   {
//     "requirements": [{ "id", "verdict": "PASS|FAIL|BLOCKED|UNCLEAR",
//                         "evidence"?, "acceptancePass"?, "acceptanceTotal"?,
//                         "builderPass"?, "builderTotal"? }],
//     "checklist": { "<checklist-id>": "PASS|FAIL|skip" },
//     "fixSync"?: [string], "observations"?: [string],
//     "verificationCheckpoint"?: { gaps, mismatches, adjustments },
//     "acceptanceTestFile"?: string,
//     "knownIssues"?: [{ "id", "title", "verdict": "deferred|accepted", "reason",
//                         "source"?: "ship-ledger|dev-verify",
//                         "blocker"?: "<backlog-card-name>" }],
//     // A "deferred" knownIssues entry auto-creates/updates a `verify-<name>`
//     // VERIFY backlog card (dependencies = valid blocker names) and sets
//     // hasDeferred:true on feature.tests and the backlog entry — see
//     // shared/BACKLOG.md § VERIFY cards.
//     "seedPages"?: [{ "name", "routePattern" }],
//     "componentSync"?: [{ "name", "src": [string], "test": [string] }],
//     "designComponent"?: string,
//     "pipeline"?: "dev" | "game" (default "dev")
//   }
//
// Exit 0 = full sync. 1 = post-write verification failed (script-bug guard).
//   2 = usage. 3 = main-root unresolved (not a git repo).
//   4 = feature.json or backlog.json not found.
//   5 = invalid JSON on stdin.
//   6 = validation failed BEFORE any write (missing/unknown verdict,
//       forbidden key in payload, ...) — caller falls back to manual authoring
//       per dev-ship/references/dev-verify/references/completion-sync-fallback.md
//       (never by reading this source at runtime).
//   7 = feature.json written, but no backlog entry matched feature.name
//       (warn + stop — backlog/context/project files left untouched).

import { execFileSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";

const FORBIDDEN_BACKLOG_KEYS = ["shipped", "shippedAt", "shippedSha"];
const VERDICTS = ["PASS", "FAIL", "BLOCKED", "UNCLEAR"];
const CHECKLIST_STATUSES = ["PASS", "FAIL", "skip"];
const KNOWN_ISSUE_VERDICTS = ["deferred", "accepted"];

const [cmd, name] = process.argv.slice(2);
if (cmd !== "sync" || !name) {
  console.error("Usage: completion-sync.js sync <feature-name>");
  process.exit(2);
}

function readStdin() {
  try {
    return readFileSync(0, "utf8");
  } catch {
    return "";
  }
}

let payload;
try {
  payload = JSON.parse(readStdin());
} catch (err) {
  console.error(`completion-sync: invalid JSON on stdin: ${err.message}`);
  process.exit(5);
}
if (payload === null || typeof payload !== "object" || Array.isArray(payload)) {
  console.error("completion-sync: stdin payload must be a JSON object");
  process.exit(5);
}

// Main-root resolution (identical to ship-checkpoint.js): the first porcelain
// line is always "worktree <main-root>", even from inside a linked worktree.
let mainRoot = "";
try {
  const out = execFileSync("git", ["worktree", "list", "--porcelain"], {
    encoding: "utf8",
  });
  const first = out.split("\n")[0] || "";
  if (first.startsWith("worktree "))
    mainRoot = first.slice("worktree ".length).trim();
} catch (err) {
  console.error(`completion-sync: git worktree list failed: ${err.message}`);
  process.exit(3);
}
if (!mainRoot) {
  console.error("completion-sync: could not resolve the main worktree root");
  process.exit(3);
}

const featurePath = join(
  mainRoot,
  ".project",
  "features",
  name,
  "feature.json",
);
const backlogPath = join(mainRoot, ".project", "backlog.json");
const contextPath = join(mainRoot, ".project", "project-context.json");
const projectPath = join(mainRoot, ".project", "project.json");

function readJsonFile(path, label, { optional = false } = {}) {
  if (!existsSync(path)) {
    if (optional) return null;
    console.error(`completion-sync: ${label} not found: ${path}`);
    process.exit(4);
  }
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch (err) {
    console.error(`completion-sync: invalid JSON in ${label}: ${err.message}`);
    process.exit(5);
  }
}

function atomicWrite(path, obj) {
  mkdirSync(dirname(path), { recursive: true });
  const tmp = `${path}.tmp`;
  writeFileSync(tmp, JSON.stringify(obj, null, 2) + "\n", "utf8");
  renameSync(tmp, path);
}

function fail6(msg) {
  console.error(`completion-sync: ${msg}`);
  process.exit(6);
}

// ── Validation phase — nothing is written until ALL of this passes ─────────

function containsForbiddenKey(value) {
  if (Array.isArray(value)) return value.some(containsForbiddenKey);
  if (value && typeof value === "object") {
    for (const k of Object.keys(value)) {
      if (FORBIDDEN_BACKLOG_KEYS.includes(k)) return true;
      if (containsForbiddenKey(value[k])) return true;
    }
  }
  return false;
}
if (containsForbiddenKey(payload)) {
  fail6(
    `payload contains a forbidden refactor-owned key (${FORBIDDEN_BACKLOG_KEYS.join(", ")}) — these belong exclusively to /dev-refactor and may never be written by verify`,
  );
}

const feature = readJsonFile(featurePath, "feature.json");

if (!Array.isArray(payload.requirements))
  fail6("payload.requirements must be an array");
if (
  payload.checklist === undefined ||
  typeof payload.checklist !== "object" ||
  Array.isArray(payload.checklist)
) {
  fail6('payload.checklist must be an object of { "<id>": "PASS|FAIL|skip" }');
}

const reqs = Array.isArray(feature.requirements) ? feature.requirements : [];
const activeReqIds = new Set(
  reqs.filter((r) => r.deltaOp !== "REMOVED").map((r) => r.id),
);
const removedReqIds = new Set(
  reqs.filter((r) => r.deltaOp === "REMOVED").map((r) => r.id),
);

const verdictById = new Map();
for (const r of payload.requirements) {
  if (!r || typeof r.id !== "string" || !r.id)
    fail6("every requirements[] payload entry needs a non-empty string id");
  if (removedReqIds.has(r.id))
    fail6(
      `requirement ${r.id} has deltaOp:"REMOVED" in feature.json — it must not receive a verdict`,
    );
  if (!activeReqIds.has(r.id))
    fail6(
      `requirement ${r.id} in the payload does not exist in feature.json#requirements[]`,
    );
  if (!VERDICTS.includes(r.verdict))
    fail6(
      `requirement ${r.id} has an invalid verdict "${r.verdict}" (expected one of ${VERDICTS.join(", ")})`,
    );
  verdictById.set(r.id, r);
}
for (const id of activeReqIds) {
  if (!verdictById.has(id))
    fail6(`requirement ${id} is missing a verdict in the payload`);
}

const checklist =
  feature.tests && Array.isArray(feature.tests.checklist)
    ? feature.tests.checklist
    : [];
const checklistIds = new Set(checklist.map((c) => String(c.id)));
for (const [id, status] of Object.entries(payload.checklist)) {
  if (!checklistIds.has(id))
    fail6(
      `checklist id "${id}" in the payload does not exist in feature.json#tests.checklist[]`,
    );
  if (!CHECKLIST_STATUSES.includes(status))
    fail6(
      `checklist id "${id}" has an invalid status "${status}" (expected one of ${CHECKLIST_STATUSES.join(", ")})`,
    );
}

if (payload.knownIssues !== undefined && !Array.isArray(payload.knownIssues))
  fail6("payload.knownIssues must be an array when present");
const knownIssues = (payload.knownIssues || []).map((issue) => {
  if (!issue || typeof issue.id !== "string" || !issue.id)
    fail6("every knownIssues[] payload entry needs a non-empty string id");
  if (typeof issue.title !== "string" || !issue.title)
    fail6(`knownIssues entry "${issue.id}" needs a non-empty string title`);
  if (typeof issue.reason !== "string" || !issue.reason)
    fail6(`knownIssues entry "${issue.id}" needs a non-empty string reason`);
  if (!KNOWN_ISSUE_VERDICTS.includes(issue.verdict))
    fail6(
      `knownIssues entry "${issue.id}" has an invalid verdict "${issue.verdict}" (expected one of ${KNOWN_ISSUE_VERDICTS.join(", ")})`,
    );
  const clean = {
    id: issue.id,
    title: issue.title,
    verdict: issue.verdict,
    reason: issue.reason,
  };
  if (typeof issue.source === "string" && issue.source)
    clean.source = issue.source;
  if (typeof issue.blocker === "string" && issue.blocker)
    clean.blocker = issue.blocker;
  return clean;
});
const pipeline =
  typeof payload.pipeline === "string" ? payload.pipeline : "dev";
const hasDeferredIssue = knownIssues.some((i) => i.verdict === "deferred");

function upsertKnownIssues(existing, incoming) {
  const list = Array.isArray(existing) ? existing.slice() : [];
  for (const issue of incoming) {
    const idx = list.findIndex((i) => i.id === issue.id);
    if (idx === -1) list.push(issue);
    else list[idx] = issue;
  }
  return list;
}

// ── Mutate feature.json in memory, single write ─────────────────────────────

feature.status = "DONE";
for (const r of reqs) {
  if (r.deltaOp === "REMOVED") continue;
  const v = verdictById.get(r.id);
  r.status = v.verdict;
  if (
    (v.verdict === "BLOCKED" || v.verdict === "UNCLEAR") &&
    typeof v.evidence === "string"
  ) {
    r.evidence = v.evidence;
  }
}
for (const c of checklist) {
  if (Object.prototype.hasOwnProperty.call(payload.checklist, c.id))
    c.status = payload.checklist[c.id];
}

const verdicts = [...verdictById.values()].map((v) => v.verdict);
const finalStatus = verdicts.some((v) => v === "FAIL")
  ? "FAILED"
  : verdicts.some((v) => v === "BLOCKED" || v === "UNCLEAR")
    ? "PARTIAL"
    : "PASSED";

feature.tests = feature.tests || {};
feature.tests.finalStatus = finalStatus;

const today = new Date().toISOString().slice(0, 10);
const checklistValues = Object.values(payload.checklist);
const session = {
  date: today,
  pass: checklistValues.filter((s) => s === "PASS").length,
  fail: checklistValues.filter((s) => s === "FAIL").length,
  skip: checklistValues.filter((s) => s === "skip").length,
};
if (Array.isArray(payload.fixSync) && payload.fixSync.length)
  session.fixes = payload.fixSync.length;
feature.tests.sessions = Array.isArray(feature.tests.sessions)
  ? feature.tests.sessions
  : [];
feature.tests.sessions.push(session);

feature.tests.evaluation = [...verdictById.entries()].map(([reqId, v]) => {
  const entry = { reqId, verdict: v.verdict };
  for (const k of [
    "acceptancePass",
    "acceptanceTotal",
    "builderPass",
    "builderTotal",
  ]) {
    if (v[k] !== undefined) entry[k] = v[k];
  }
  return entry;
});

if (payload.fixSync !== undefined) feature.tests.fixSync = payload.fixSync;
if (payload.verificationCheckpoint !== undefined)
  feature.tests.verificationCheckpoint = payload.verificationCheckpoint;
if (payload.acceptanceTestFile !== undefined)
  feature.tests.acceptanceTestFile = payload.acceptanceTestFile;
if (Array.isArray(payload.observations) && payload.observations.length) {
  feature.observations = Array.isArray(feature.observations)
    ? feature.observations
    : [];
  feature.observations.push(...payload.observations);
}
if (knownIssues.length)
  feature.tests.knownIssues = upsertKnownIssues(
    feature.tests.knownIssues,
    knownIssues,
  );
if (hasDeferredIssue) feature.tests.hasDeferred = true;

atomicWrite(featurePath, feature);

const rereadFeature = readJsonFile(featurePath, "feature.json (post-write)");
if (
  rereadFeature.status !== "DONE" ||
  !rereadFeature.tests ||
  !rereadFeature.tests.finalStatus
) {
  console.error(
    "completion-sync: post-write verification failed — feature.json status/finalStatus not set",
  );
  process.exit(1);
}

const filesWritten = ["feature.json"];

// ── backlog.json ─────────────────────────────────────────────────────────

const backlog = readJsonFile(backlogPath, "backlog.json");
const backlogFeatures = Array.isArray(backlog.features) ? backlog.features : [];
const entry = backlogFeatures.find((f) => f.name === name);

if (!entry) {
  console.error(
    `completion-sync: warning: no backlog entry matched feature.name "${name}" — backlog.json (and any further sync) left untouched`,
  );
  console.log(`completion-sync: wrote ${filesWritten.join(", ")}`);
  process.exit(7);
}

entry.status = "DONE";
delete entry.stage;
if (entry.transition !== "shipping") delete entry.transition;
if (knownIssues.length)
  entry.knownIssues = upsertKnownIssues(entry.knownIssues, knownIssues);

if (hasDeferredIssue) {
  entry.hasDeferred = true;
  const deferredIssues = knownIssues.filter((i) => i.verdict === "deferred");
  const blockers = [
    ...new Set(
      deferredIssues
        .map((i) => i.blocker)
        .filter((b) => b && backlogFeatures.some((f) => f.name === b)),
    ),
  ];
  const cardName = `verify-${name}`;
  const pickupCmd =
    pipeline === "game" ? `/game-ship ${name}` : `/dev-manual ${name}`;
  const description =
    `Re-run deferred manual test(s) for ${name}: ` +
    deferredIssues.map((i) => i.title).join("; ") +
    `. Reason(s): ` +
    deferredIssues.map((i) => i.reason).join(" | ") +
    `. Deferred from the ${name} ship on ${today}. Pick up with ${pickupCmd} once the blocker lands.`;
  const existingVerifyCard = backlogFeatures.find((f) => f.name === cardName);
  if (existingVerifyCard) {
    existingVerifyCard.description = description;
    if (blockers.length) existingVerifyCard.dependencies = blockers;
  } else {
    backlogFeatures.push({
      name: cardName,
      type: "VERIFY",
      status: "TODO",
      phase: entry.phase || "P2",
      description,
      source: pipeline === "game" ? "/game-ship" : "/dev-ship",
      // A VERIFY card is minted by this script off a ship ledger, never asked
      // for by a human — see shared/BACKLOG.md § Card provenance.
      origin: "agent",
      dependencies: blockers,
      parentFeature: name,
      auto: true,
    });
  }
}

if (Array.isArray(payload.seedPages)) {
  for (const p of payload.seedPages) {
    backlogFeatures.push({
      name: p.name,
      type: "PAGE",
      status: "TODO",
      phase: "P3",
      description: `Page introduced via fix in ${name}. Routes: ${p.routePattern}`,
      source: "/dev-verify",
      // Discovered by the verify pass, not requested — § Card provenance.
      origin: "agent",
      dependencies: [name],
      parentFeature: name,
      auto: true,
    });
  }
}
backlog.features = backlogFeatures;
backlog.updated = today;
atomicWrite(backlogPath, backlog);
filesWritten.push("backlog.json");

const rereadBacklog = readJsonFile(backlogPath, "backlog.json (post-write)");
const rereadEntry = rereadBacklog.features.find((f) => f.name === name);
if (!rereadEntry || rereadEntry.status !== "DONE") {
  console.error(
    `completion-sync: post-write verification failed — backlog entry "${name}" is not status DONE`,
  );
  process.exit(1);
}
const leaked = FORBIDDEN_BACKLOG_KEYS.filter((k) => k in rereadEntry);
if (leaked.length) {
  console.error(
    `completion-sync: ABORT: verify wrote forbidden refactor-key(s) ${leaked.join(", ")} to backlog entry "${name}". Remove them and retry — these belong to /dev-refactor.`,
  );
  process.exit(1);
}

// ── project-context.json — componentSync (architecture.components[]) ──────

if (Array.isArray(payload.componentSync) && payload.componentSync.length) {
  const context =
    readJsonFile(contextPath, "project-context.json", { optional: true }) || {};
  context.architecture = context.architecture || {};
  const components = Array.isArray(context.architecture.components)
    ? context.architecture.components
    : [];
  context.architecture.components = components;
  let contextChanged = false;
  for (const c of payload.componentSync) {
    const comp = components.find((x) => x.name === c.name);
    if (!comp) {
      console.error(
        `completion-sync: warning: componentSync target "${c.name}" not found in architecture.components[] — skipped`,
      );
      continue;
    }
    comp.src = Array.from(new Set([...(comp.src || []), ...(c.src || [])]));
    comp.test = Array.from(new Set([...(comp.test || []), ...(c.test || [])]));
    comp.status = "done";
    contextChanged = true;
  }
  if (contextChanged) {
    atomicWrite(contextPath, context);
    filesWritten.push("project-context.json");
  }
}

// ── COMPONENT design sync (project.json#design.components[] upsert) ───────

if (typeof payload.designComponent === "string" && payload.designComponent) {
  const project =
    readJsonFile(projectPath, "project.json", { optional: true }) || {};
  project.design = project.design || {};
  project.design.components = Array.isArray(project.design.components)
    ? project.design.components
    : [];
  const designComp = project.design.components.find(
    (c) => c.name === payload.designComponent,
  );
  if (designComp) designComp.status = "DONE";
  else
    project.design.components.push({
      name: payload.designComponent,
      status: "DONE",
    });
  atomicWrite(projectPath, project);
  if (!filesWritten.includes("project.json")) filesWritten.push("project.json");

  if (Array.isArray(payload.componentSync) && payload.componentSync.length) {
    const context =
      readJsonFile(contextPath, "project-context.json", { optional: true }) ||
      {};
    const inventory = Array.isArray(context.components)
      ? context.components
      : [];
    const inv = inventory.find((c) => c.name === payload.designComponent);
    const testPaths = payload.componentSync.flatMap((c) => c.test || []);
    if (inv && testPaths.length) {
      const existing = Array.isArray(inv.test)
        ? inv.test
        : inv.test
          ? [inv.test]
          : [];
      inv.test = Array.from(new Set([...existing, ...testPaths]));
      atomicWrite(contextPath, context);
      if (!filesWritten.includes("project-context.json"))
        filesWritten.push("project-context.json");
    }
  }
}

console.log(`completion-sync: wrote ${filesWritten.join(", ")}`);
