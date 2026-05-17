#!/usr/bin/env node
const { execSync } = require("child_process");
const path = require("path");

const CTX_THRESHOLD = 0;
const SESSION_THRESHOLD = 30;
const WEEK_THRESHOLD = 30;
const HIDDEN_BRANCHES = new Set(["main", "master"]);

function formatDuration(epochSec) {
  const ms = epochSec * 1000 - Date.now();
  if (ms <= 0) return null;
  const totalMin = Math.floor(ms / 60_000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function formatBranch(branch, worktree) {
  if (worktree?.name) return `${worktree.name} (worktree)`;
  if (!branch || HIDDEN_BRANCHES.has(branch)) return null;
  return branch;
}

function formatCtx(used) {
  if (used == null || used < CTX_THRESHOLD) return null;
  return `${Math.floor(used)}%`;
}

function formatSession(rl) {
  const fh = rl?.five_hour;
  if (!fh || typeof fh.used_percentage !== "number") return null;
  if (fh.used_percentage < SESSION_THRESHOLD) return null;
  const pct = Math.round(fh.used_percentage);
  const dur = formatDuration(fh.resets_at);
  return dur ? `session ${pct}% · ${dur}` : `session ${pct}%`;
}

function formatWeekDuration(epochSec) {
  const ms = epochSec * 1000 - Date.now();
  if (ms <= 0) return null;
  const totalH = Math.floor(ms / 3_600_000);
  const d = Math.floor(totalH / 24);
  const h = totalH % 24;
  return d > 0 ? `${d}d ${h}h` : `${h}h`;
}

function formatWeek(rl) {
  const sd = rl?.seven_day;
  if (!sd || typeof sd.used_percentage !== "number") return null;
  if (sd.used_percentage < WEEK_THRESHOLD) return null;
  const pct = Math.round(sd.used_percentage);
  const dur = formatWeekDuration(sd.resets_at);
  return dur ? `week ${pct}% · ${dur}` : `week ${pct}%`;
}

let input = "";
process.stdin.on("data", (c) => (input += c));
process.stdin.on("end", () => {
  const data = JSON.parse(input);
  const dir = data.workspace?.current_dir || data.cwd || "~";

  const repo = path.basename(dir);
  let branch = "";
  try {
    branch = execSync("git symbolic-ref --short HEAD 2>/dev/null", {
      cwd: dir,
      encoding: "utf8",
      env: { ...process.env, GIT_OPTIONAL_LOCKS: "0" },
    }).trim();
  } catch {}

  const location = [repo];
  const fb = formatBranch(branch, data.worktree);
  if (fb) location.push(fb);
  const sessionStr = formatSession(data.rate_limits);
  const weekStr = formatWeek(data.rate_limits);
  const ctxStr = formatCtx(data.context_window?.used_percentage);
  if (ctxStr) location.push(ctxStr);
  if (sessionStr) location.push(sessionStr);
  if (weekStr) location.push(weekStr);

  console.log(location.join(" | "));
});
