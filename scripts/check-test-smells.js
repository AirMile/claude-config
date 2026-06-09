#!/usr/bin/env node
// Heuristic test-smell detector for dev-verify PHASE 5d AI-test-review.
// Usage: node scripts/check-test-smells.js <testFile1> [testFile2 ...]
// Output: JSON array on stdout — one object per file:
//   { file, mockCount, behaviorCount, mockRatio, snapshotLines, overMocking, behaviorVsImpl }
//
// Empirisch grounded — MSR 2026 (Hora & Robbes): agent-tests gebruiken in 95%
// mono-type `mock`, mensen variëren (mock 91%, fake 57%, spy 51%). Hoge mockRatio
// is correleert met test-implementation-not-behavior anti-pattern.

import { readFileSync } from "node:fs";
import { basename } from "node:path";

const MOCK_PATTERNS = [
  /\bvi\.mock\s*\(/g,
  /\bvi\.fn\s*\(/g,
  /\bvi\.spyOn\s*\(/g,
  /\bjest\.mock\s*\(/g,
  /\bjest\.fn\s*\(/g,
  /\bjest\.spyOn\s*\(/g,
  /\bsinon\.(stub|spy|mock)\s*\(/g,
];

const BEHAVIOR_ASSERT_PATTERNS = [
  // Equality / value assertions on real return values or state
  /expect\s*\([^)]*\)\.toBe\b/g,
  /expect\s*\([^)]*\)\.toEqual\b/g,
  /expect\s*\([^)]*\)\.toStrictEqual\b/g,
  /expect\s*\([^)]*\)\.toContain\b/g,
  /expect\s*\([^)]*\)\.toMatch\b/g,
  /expect\s*\([^)]*\)\.toHaveLength\b/g,
  /expect\s*\([^)]*\)\.toBeGreaterThan\b/g,
  /expect\s*\([^)]*\)\.toBeLessThan\b/g,
  /expect\s*\([^)]*\)\.toBeCloseTo\b/g,
  /expect\s*\([^)]*\)\.toThrow\b/g,
  /expect\s*\([^)]*\)\.resolves\b/g,
  /expect\s*\([^)]*\)\.rejects\b/g,
];

const IMPL_ASSERT_PATTERNS = [
  // Mock-coupled assertions — verify implementation calls, not behavior
  /expect\s*\([^)]*\)\.toHaveBeenCalled(With|Times)?\b/g,
  /expect\s*\([^)]*\)\.toBeCalled(With|Times)?\b/g,
  /expect\s*\([^)]*\)\.lastCalledWith\b/g,
  /expect\s*\([^)]*\)\.nthCalledWith\b/g,
];

const WEAK_ASSERT_PATTERNS = [
  // Existence checks without value — often hide weak tests
  /expect\s*\([^)]*\)\.toBeDefined\b/g,
  /expect\s*\([^)]*\)\.toBeTruthy\b/g,
  /expect\s*\([^)]*\)\.not\.toBeNull\b/g,
];

const SNAPSHOT_PATTERNS = [
  /\.toMatchSnapshot\s*\(/g,
  /\.toMatchInlineSnapshot\s*\(/g,
  /\.toMatchAriaSnapshot\s*\(/g,
  /\.toHaveScreenshot\s*\(/g,
];

function countMatches(text, patterns) {
  return patterns.reduce((sum, re) => sum + (text.match(re)?.length ?? 0), 0);
}

function snapshotBlockSize(text) {
  // Count lines inside toMatchInlineSnapshot(`...`) backtick blocks
  const inlineRe = /toMatchInlineSnapshot\s*\(\s*`([\s\S]*?)`\s*\)/g;
  let total = 0;
  let m;
  while ((m = inlineRe.exec(text)) !== null) {
    total += m[1].split("\n").length;
  }
  return total;
}

// Drift-threshold relative to project baseline. When baseline is given,
// over-mocking triggers on `mockRatio > baselineP90 + DRIFT_MARGIN` instead of
// the static 0.6 fallback. Avoids false positives on projects where the realistic
// average sits above 0.6 (heavy external boundaries, integration suites).
const DRIFT_MARGIN = 0.1;
const STATIC_FALLBACK = 0.6;

function classify(mockCount, behaviorCount, implCount, weakCount, baselineP90) {
  // mockRatio = impl-coupled / (impl-coupled + behavior)
  // When 0 behavior asserts → 1.0 by definition (worst case)
  const denom = behaviorCount + implCount;
  const mockRatio =
    denom === 0 ? (mockCount > 0 ? 1.0 : 0.0) : implCount / denom;

  const threshold =
    typeof baselineP90 === "number" && baselineP90 > 0
      ? baselineP90 + DRIFT_MARGIN
      : STATIC_FALLBACK;

  const overMocking =
    mockRatio > threshold ||
    (mockCount >= 5 && behaviorCount === 0) ||
    (weakCount > behaviorCount && weakCount > 0);

  let behaviorVsImpl;
  if (mockRatio >= 0.7) behaviorVsImpl = "implementation";
  else if (mockRatio >= 0.3) behaviorVsImpl = "mixed";
  else behaviorVsImpl = "behavior";

  return {
    mockRatio: Number(mockRatio.toFixed(2)),
    overMocking,
    behaviorVsImpl,
    threshold: Number(threshold.toFixed(2)),
  };
}

function analyzeFile(filePath, baselineP90) {
  let text;
  try {
    text = readFileSync(filePath, "utf8");
  } catch (err) {
    return { file: filePath, error: `unreadable: ${err.code}` };
  }

  const mockCount = countMatches(text, MOCK_PATTERNS);
  const behaviorCount = countMatches(text, BEHAVIOR_ASSERT_PATTERNS);
  const implCount = countMatches(text, IMPL_ASSERT_PATTERNS);
  const weakCount = countMatches(text, WEAK_ASSERT_PATTERNS);
  const snapshotCount = countMatches(text, SNAPSHOT_PATTERNS);
  const snapshotLines = snapshotBlockSize(text);

  const { mockRatio, overMocking, behaviorVsImpl, threshold } = classify(
    mockCount,
    behaviorCount,
    implCount,
    weakCount,
    baselineP90,
  );

  return {
    file: filePath,
    mockCount,
    behaviorCount,
    implCount,
    weakCount,
    snapshotCount,
    snapshotLines,
    mockRatio,
    overMocking,
    behaviorVsImpl,
    threshold,
  };
}

function percentile(sortedValues, p) {
  if (sortedValues.length === 0) return 0;
  const idx = Math.min(
    sortedValues.length - 1,
    Math.floor(p * sortedValues.length),
  );
  return sortedValues[idx];
}

function summarize(results, baselineP90) {
  const valid = results.filter((r) => !r.error);
  if (valid.length === 0) {
    return {
      checkedAt: new Date().toISOString(),
      overMockedCount: 0,
      avgMockRatio: 0,
      p90MockRatio: 0,
      anyOverMocking: false,
      baselineP90: baselineP90 ?? null,
    };
  }
  const overMockedCount = valid.filter((r) => r.overMocking).length;
  const ratios = valid.map((r) => r.mockRatio).sort((a, b) => a - b);
  const avgMockRatio = ratios.reduce((sum, r) => sum + r, 0) / ratios.length;
  const p90MockRatio = percentile(ratios, 0.9);
  return {
    checkedAt: new Date().toISOString(),
    overMockedCount,
    avgMockRatio: Number(avgMockRatio.toFixed(2)),
    p90MockRatio: Number(p90MockRatio.toFixed(2)),
    anyOverMocking: overMockedCount > 0,
    baselineP90: baselineP90 ?? null,
  };
}

const args = process.argv.slice(2);
if (args.length === 0) {
  console.error(
    "Usage: node scripts/check-test-smells.js [--baseline-p90=N] <testFile> [...]",
  );
  process.exit(2);
}

const baselineArg = args.find((a) => a.startsWith("--baseline-p90="));
const baselineP90 = baselineArg ? Number(baselineArg.split("=")[1]) : undefined;
const fileArgs = args.filter((a) => !a.startsWith("--"));

const results = fileArgs.map((f) => analyzeFile(f, baselineP90));
const summary = summarize(results, baselineP90);

process.stdout.write(JSON.stringify({ summary, results }, null, 2));
process.stdout.write("\n");
