#!/usr/bin/env node
// JUnit-XML aggregator for dev-verify flakiness detection.
// Usage: node scripts/junit-flakiness.js <junit.xml> <currentSha> [--history=path]
// Output: JSON on stdout — { lastRun, flakyTests: [{name, file, pfr, retries, firstFlipSha}] }
// Side effect: appends current run to history JSONL.
//
// Detectie-logica: een test is flaky wanneer (a) Playwright/Vitest expliciet
// "flaky" labelt, OF (b) PFR < 1.0 over de laatste N=20 runs, OF (c) de test
// flipt tussen pass/fail op de identieke commit-SHA (deterministisch onmogelijk).

import {
  readFileSync,
  existsSync,
  appendFileSync,
  mkdirSync,
  writeFileSync,
} from "node:fs";
import { dirname } from "node:path";

const HISTORY_DEFAULT = ".project/flakiness-history.jsonl";
const WINDOW_SIZE = 20;
const RETENTION_RUNS = 100; // keep at least last 100 runs ...
const RETENTION_DAYS = 30; // ... OR last 30 days, whichever covers more

const args = process.argv.slice(2);
if (args.length < 2) {
  console.error(
    "Usage: node scripts/junit-flakiness.js <junit.xml> <currentSha> [--history=path]",
  );
  process.exit(2);
}

const junitPath = args[0];
const currentSha = args[1];
const historyArg = args.find((a) => a.startsWith("--history="));
const historyPath = historyArg ? historyArg.split("=")[1] : HISTORY_DEFAULT;

// Minimal JUnit XML parser — we only need testcase tags + status attrs/children.
// Avoids xml2js dependency; the schema we target is the small Jest/Vitest/Playwright JUnit subset.
function parseJUnit(xml) {
  const testcaseRe = /<testcase\b([^>]*?)(?:\/>|>([\s\S]*?)<\/testcase>)/g;
  const attrRe = /(\w+)="([^"]*)"/g;
  const results = [];
  let m;
  while ((m = testcaseRe.exec(xml)) !== null) {
    const attrText = m[1];
    const body = m[2] || "";
    const attrs = {};
    let a;
    attrRe.lastIndex = 0;
    while ((a = attrRe.exec(attrText)) !== null) attrs[a[1]] = a[2];

    let status = "pass";
    if (/<failure\b/.test(body) || /<error\b/.test(body)) status = "fail";
    else if (/<skipped\b/.test(body)) status = "skip";

    // Playwright JUnit reporter wraps flaky tests with <properties><property name="flaky" ...
    const flakyMarker = /name="flaky"\s+value="true"/.test(body);

    // Vitest emits retry count in name="retry" properties or attribute
    let retries = 0;
    const retryAttr = attrs.retries || attrs.retry;
    if (retryAttr) retries = Number(retryAttr) || 0;
    const retryProp = body.match(/name="retry"\s+value="(\d+)"/);
    if (retryProp) retries = Math.max(retries, Number(retryProp[1]));

    const name = attrs.name || "<unknown>";
    const className = attrs.classname || attrs.file || "";
    const file = attrs.file || className.split(" ")[0] || "<unknown>";

    results.push({
      name,
      file,
      classname: className,
      status,
      retries,
      flakyMarker,
    });
  }
  return results;
}

function readHistory(path) {
  if (!existsSync(path)) return [];
  const lines = readFileSync(path, "utf8")
    .split("\n")
    .filter((l) => l.trim().length > 0);
  return lines
    .map((l) => {
      try {
        return JSON.parse(l);
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}

function appendHistory(path, entry) {
  mkdirSync(dirname(path), { recursive: true });
  appendFileSync(path, JSON.stringify(entry) + "\n", "utf8");
}

// Trim history to {RETENTION_RUNS runs} OR {RETENTION_DAYS days}, whichever yields
// MORE entries. Keeps long-tail flakes detectable on slow-iteration projects
// while bounding file size on fast-iteration ones.
function rotateHistory(path, history) {
  if (history.length === 0) return;
  const cutoffTime = Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000;
  const byTime = history.filter((e) => {
    const t = Date.parse(e.ranAt);
    return Number.isFinite(t) && t >= cutoffTime;
  });
  const byCount = history.slice(-RETENTION_RUNS);
  const kept = byTime.length >= byCount.length ? byTime : byCount;
  if (kept.length === history.length) return;
  writeFileSync(
    path,
    kept.map((e) => JSON.stringify(e)).join("\n") + "\n",
    "utf8",
  );
}

function aggregate(history, currentRun, currentSha) {
  const allRuns = [...history.slice(-(WINDOW_SIZE - 1)), currentRun];
  const perTest = new Map(); // key = name|file
  for (const run of allRuns) {
    for (const r of run.results) {
      const key = `${r.name}||${r.file}`;
      if (!perTest.has(key)) {
        perTest.set(key, {
          name: r.name,
          file: r.file,
          statuses: [],
          retries: 0,
          flakyMarkers: 0,
          shas: [],
        });
      }
      const t = perTest.get(key);
      t.statuses.push(r.status);
      t.retries += r.retries || 0;
      if (r.flakyMarker) t.flakyMarkers += 1;
      t.shas.push(run.sha);
    }
  }

  const flakyTests = [];
  for (const t of perTest.values()) {
    const total = t.statuses.length;
    if (total === 0) continue;
    const passes = t.statuses.filter((s) => s === "pass").length;
    const pfr = Number((passes / total).toFixed(2));

    // Find first flip on identical SHA
    let firstFlipSha = null;
    const perSha = new Map();
    for (let i = 0; i < t.statuses.length; i++) {
      const sha = t.shas[i];
      if (!perSha.has(sha)) perSha.set(sha, new Set());
      perSha.get(sha).add(t.statuses[i]);
    }
    for (const [sha, set] of perSha) {
      if (set.has("pass") && set.has("fail")) {
        firstFlipSha = sha;
        break;
      }
    }

    const isFlaky =
      t.flakyMarkers > 0 || (pfr < 1.0 && pfr > 0) || firstFlipSha !== null;

    if (isFlaky) {
      flakyTests.push({
        name: t.name,
        file: t.file,
        pfr,
        retries: t.retries,
        firstFlipSha,
      });
    }
  }

  flakyTests.sort((a, b) => a.pfr - b.pfr);
  return flakyTests;
}

const xmlText = readFileSync(junitPath, "utf8");
const results = parseJUnit(xmlText);
const ranAt = new Date().toISOString();
const currentRun = { sha: currentSha, ranAt, results };

const history = readHistory(historyPath);
appendHistory(historyPath, currentRun);
rotateHistory(historyPath, [...history, currentRun]);

const flakyTests = aggregate(history, currentRun, currentSha);

const output = {
  lastRun: ranAt,
  totalRunsInWindow: Math.min(history.length + 1, WINDOW_SIZE),
  flakyTests,
};

process.stdout.write(JSON.stringify(output, null, 2));
process.stdout.write("\n");
