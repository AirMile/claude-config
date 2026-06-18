#!/usr/bin/env node
const { execSync } = require("child_process");
const path = require("path");

const HIDDEN_BRANCHES = new Set(["main", "master"]);

function formatDuration(epochSec) {
  const ms = epochSec * 1000 - Date.now();
  if (ms <= 0) return null;
  const totalSec = Math.floor(ms / 1000);
  if (totalSec < 60) return `${totalSec}s`;
  const totalMin = Math.floor(totalSec / 60);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h === 1 && m === 0) return "60m";
  return h > 0 ? (m > 0 ? `${h}h ${m}m` : `${h}h`) : `${m}m`;
}

function formatBranch(branch, worktree) {
  if (worktree?.name) return `${worktree.name} (worktree)`;
  if (!branch || HIDDEN_BRANCHES.has(branch)) return null;
  return branch;
}

function formatCtx(ctx) {
  const pct = ctx?.used_percentage;
  const size = ctx?.context_window_size;
  if (pct == null || size == null) return null;
  const tokens = Math.round((pct / 100) * size);
  return `${Math.round(tokens / 1000)}k`;
}

function formatSession(rl) {
  const fh = rl?.five_hour;
  if (!fh || typeof fh.used_percentage !== "number") return null;
  const pct = Math.round(fh.used_percentage);
  const dur = formatDuration(fh.resets_at);
  if (!dur) return null;
  return `session ${pct}% · ${dur}`;
}

function formatWeekDuration(epochSec) {
  const ms = epochSec * 1000 - Date.now();
  if (ms <= 0) return null;
  const totalSec = Math.floor(ms / 1000);
  const totalMin = Math.floor(totalSec / 60);
  const totalH = Math.floor(totalMin / 60);
  const d = Math.floor(totalH / 24);
  const h = totalH % 24;
  if (d > 0) return h > 0 ? `${d}d ${h}h` : `${d}d`;
  if (totalH > 0) return `${totalH}h`;
  if (totalMin > 0) return `${totalMin}m`;
  return `${totalSec}s`;
}

function formatWeek(rl) {
  const sd = rl?.seven_day;
  if (!sd || typeof sd.used_percentage !== "number") return null;
  const pct = Math.round(sd.used_percentage);
  const dur = formatWeekDuration(sd.resets_at);
  if (!dur) return null;
  return `week ${pct}% · ${dur}`;
}

let input = "";
process.stdin.on("data", (c) => (input += c));
process.stdin.on("end", () => {
  const data = JSON.parse(input);
  const dir = data.workspace?.current_dir || data.cwd || "~";

  let repo = path.basename(dir);
  if (data.worktree?.name) {
    try {
      const commonDir = execSync("git rev-parse --git-common-dir 2>/dev/null", {
        cwd: dir,
        encoding: "utf8",
        env: { ...process.env, GIT_OPTIONAL_LOCKS: "0" },
      }).trim();
      if (commonDir) {
        const absCommon = path.resolve(dir, commonDir);
        if (path.basename(absCommon) === ".git") {
          repo = path.basename(path.dirname(absCommon));
        }
      }
    } catch {}
  }
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
  const ctxStr = formatCtx(data.context_window);
  if (ctxStr) location.push(ctxStr);
  if (sessionStr) location.push(sessionStr);
  if (weekStr) location.push(weekStr);

  console.log(location.join(" | "));
});
